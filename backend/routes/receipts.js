const express = require("express");
const Receipt = require("../models/Receipt");
const { auth } = require("../middleware/auth");
const { nextStandardReceiptNumber, peekNextStandardReceiptNumber, generateLegacyReceiptNumber } = require("../utils/receiptNumbers");
const { sendReceiptConfirmationEmail, sendReceiptUpdateEmail } = require("../lib/email");
const { sendReceiptConfirmationSms, sendReceiptUpdateSms } = require("../lib/sms");
const router = express.Router();

function publicTicketBaseUrl() {
  const base = (process.env.PUBLIC_SITE_URL || process.env.FRONTEND_URL || "http://localhost:3000").replace(/\/$/, "");
  return `${base}/ticket`;
}

function publicTicketUrl(receipt) {
  receipt.ensurePublicAccessToken();
  return `${publicTicketBaseUrl()}/${encodeURIComponent(receipt.publicAccessToken)}`;
}

const STATUS_LABELS = {
  received: "Received",
  diagnosing: "Diagnosing",
  "waiting-for-parts": "Waiting for parts",
  "in-progress": "In progress",
  "ready-for-pickup": "Ready for pickup",
  "customer-called": "We've called you",
  completed: "Completed",
  cancelled: "Cancelled",
};

function activeReceiptFilter(extra = {}) {
  return { deletedAt: null, ...extra };
}

function publicReceiptPayload(receipt) {
  return {
    receiptNumber: receipt.receiptNumber,
    customerName: receipt.customerName,
    status: receipt.status,
    date: receipt.date,
    priceEstimate: receipt.priceEstimate,
    items: receipt.items.map((it) => ({
      _id: it._id,
      description: it.description,
      category: it.category,
      price: it.price,
      status: it.status,
      updates: it.updates ? [...it.updates] : [],
    })),
    updates: receipt.updates,
    messages: receipt.messages,
  };
}

async function saveTokenIfMissing(receipt) {
  const before = receipt.publicAccessToken;
  receipt.ensurePublicAccessToken();
  if (!before) await receipt.save();
}

async function sendCustomerNotifications({ receipt, type, message = "" }) {
  await saveTokenIfMissing(receipt);
  const trackUrl = publicTicketUrl(receipt);
  const emailParams = {
    to: receipt.customerEmail,
    customerName: receipt.customerName,
    receiptNumber: receipt.receiptNumber,
    trackUrl,
    priceEstimate: receipt.priceEstimate,
  };

  const [emailNotify, smsNotify] = await Promise.all([
    receipt.customerEmail && String(receipt.customerEmail).trim()
      ? type === "confirmation"
        ? sendReceiptConfirmationEmail({ ...emailParams, items: receipt.items })
        : sendReceiptUpdateEmail({ ...emailParams, status: receipt.status, message })
      : Promise.resolve({ sent: false, reason: "no-email" }),
    receipt.customerPhone && String(receipt.customerPhone).trim()
      ? type === "confirmation"
        ? sendReceiptConfirmationSms({ to: receipt.customerPhone, receiptNumber: receipt.receiptNumber, trackUrl })
        : sendReceiptUpdateSms({
            to: receipt.customerPhone,
            receiptNumber: receipt.receiptNumber,
            statusLabel: STATUS_LABELS[receipt.status] || receipt.status,
            message,
            trackUrl,
          })
      : Promise.resolve({ sent: false, reason: "no-phone" }),
  ]);

  if (!emailNotify?.sent && emailNotify?.reason !== "no-email") {
    console.warn("[receipt] email skipped:", emailNotify?.reason || emailNotify);
  }
  if (!smsNotify?.sent && smsNotify?.reason !== "no-phone" && smsNotify?.reason !== "twilio-not-configured") {
    console.warn("[receipt] sms skipped:", smsNotify?.reason || smsNotify);
  }
  return { emailNotify, smsNotify };
}

/** Quotes have no tax math — keep payload pure even if older clients still send the fields. */
function stripTaxFields(body) {
  delete body.gst;
  delete body.pst;
  delete body.finalPrice;
  return body;
}

/** Quote total = sum of line prices. Stored in `priceEstimate`. */
function recalcPriceEstimate(items) {
  if (!Array.isArray(items)) return 0;
  const sum = items.reduce((s, it) => s + (Number(it?.price) || 0), 0);
  return Math.round(sum * 100) / 100;
}

router.post("/", auth, async (req, res) => {
  try {
    const body = stripTaxFields({ ...req.body });
    const kind = body.receiptKind === "legacy" ? "legacy" : "standard";

    if (kind === "standard") {
      body.receiptNumber = await nextStandardReceiptNumber();
    } else {
      const manual = body.receiptNumber && String(body.receiptNumber).trim();
      if (manual) {
        body.receiptNumber = manual;
      } else {
        body.receiptNumber = await generateLegacyReceiptNumber();
      }
    }
    body.receiptKind = kind;
    body.priceEstimate = recalcPriceEstimate(body.items);

    const receipt = new Receipt(body);
    receipt.addAuditEvent("created", req.user?.username || "admin");
    await receipt.save();

    let notify = null;
    if (kind === "standard") {
      try {
        notify = await sendCustomerNotifications({ receipt, type: "confirmation" });
      } catch (e) {
        notify = {
          emailNotify: { sent: false, reason: e?.message || String(e) },
          smsNotify: { sent: false, reason: e?.message || String(e) },
        };
        console.error("[receipt] confirmation notification crashed:", e?.message || e);
      }
    }

    res.status(201).json(notify ? { ...receipt.toObject(), ...notify } : receipt);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ error: "Receipt number already exists." });
    }
    res.status(400).json({ error: err.message });
  }
});

router.get("/", auth, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      status,
      search,
      receiptKind,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const includeDeleted = req.query.includeDeleted === "true" || req.query.includeDeleted === "1";
    const deletedOnly = req.query.deletedOnly === "true" || req.query.deletedOnly === "1";
    const clauses = [];
    if (deletedOnly) clauses.push({ deletedAt: { $ne: null } });
    else if (!includeDeleted) clauses.push({ deletedAt: null });
    if (status) clauses.push({ status });
    if (receiptKind === "legacy") {
      clauses.push({ receiptKind: "legacy" });
    } else if (receiptKind === "standard") {
      clauses.push({ $or: [{ receiptKind: "standard" }, { receiptKind: { $exists: false } }] });
    }
    if (search) {
      clauses.push({
        $or: [
          { receiptNumber: { $regex: search, $options: "i" } },
          { customerName: { $regex: search, $options: "i" } },
          { customerPhone: { $regex: search, $options: "i" } },
        ],
      });
    }
    const filter = clauses.length === 0 ? {} : clauses.length === 1 ? clauses[0] : { $and: clauses };

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sort = { [sortBy]: sortOrder === "asc" ? 1 : -1 };

    const [receipts, total] = await Promise.all([
      Receipt.find(filter).sort(sort).skip(skip).limit(parseInt(limit)),
      Receipt.countDocuments(filter),
    ]);

    res.json({
      receipts,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/stats", auth, async (req, res) => {
  try {
    const [statusCounts, totalRevenue] = await Promise.all([
      Receipt.aggregate([{ $match: { deletedAt: null } }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
      Receipt.aggregate([
        { $match: { status: "completed", deletedAt: null } },
        { $group: { _id: null, total: { $sum: "$priceEstimate" } } },
      ]),
    ]);

    res.json({
      statusCounts: statusCounts.reduce((acc, s) => ({ ...acc, [s._id]: s.count }), {}),
      totalRevenue: totalRevenue[0]?.total || 0,
      totalReceipts: await Receipt.countDocuments({ deletedAt: null }),
      deletedReceipts: await Receipt.countDocuments({ deletedAt: { $ne: null } }),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/preview-new", auth, async (req, res) => {
  try {
    const receiptNumber = await peekNextStandardReceiptNumber();
    const d = new Date();
    res.json({
      receiptNumber,
      date: d.toISOString(),
      dateInputValue: d.toISOString().split("T")[0],
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/public/:token", async (req, res) => {
  try {
    const receipt = await Receipt.findOne(activeReceiptFilter({ publicAccessToken: req.params.token }));
    if (!receipt) {
      return res.status(404).json({ error: "Ticket link not found." });
    }
    res.json(publicReceiptPayload(receipt));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/public/:token/message", async (req, res) => {
  try {
    const receipt = await Receipt.findOne(activeReceiptFilter({ publicAccessToken: req.params.token }));
    if (!receipt) {
      return res.status(404).json({ error: "Ticket link not found." });
    }

    receipt.messages.push({
      message: req.body.message,
      sender: "customer",
    });
    receipt.addAuditEvent("message", "customer", "public token message");

    await receipt.save();
    res.json({ message: "Message sent successfully." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/lookup/:receiptNumber", async (req, res) => {
  try {
    const receipt = await Receipt.findOne(activeReceiptFilter({
      receiptNumber: req.params.receiptNumber,
    }));
    if (!receipt) {
      return res.status(404).json({ error: "Ticket not found. Please check your receipt number." });
    }
    res.json(publicReceiptPayload(receipt));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/lookup/:receiptNumber/message", async (req, res) => {
  try {
    const receipt = await Receipt.findOne(activeReceiptFilter({
      receiptNumber: req.params.receiptNumber,
    }));
    if (!receipt) {
      return res.status(404).json({ error: "Ticket not found." });
    }

    receipt.messages.push({
      message: req.body.message,
      sender: "customer",
    });
    receipt.addAuditEvent("message", "customer", "receipt-number lookup message");

    await receipt.save();
    res.json({ message: "Message sent successfully." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:id", auth, async (req, res) => {
  try {
    const receipt = await Receipt.findById(req.params.id);
    if (!receipt || receipt.deletedAt) return res.status(404).json({ error: "Receipt not found." });
    await saveTokenIfMissing(receipt);
    res.json(receipt);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/:id", auth, async (req, res) => {
  try {
    const existing = await Receipt.findOne(activeReceiptFilter({ _id: req.params.id }));
    if (!existing) return res.status(404).json({ error: "Receipt not found." });
    const body = stripTaxFields({ ...req.body });
    const notifyCustomer = Boolean(body.notifyCustomer);
    const updateMessage = typeof body.updateMessage === "string" ? body.updateMessage.trim() : "";
    delete body.notifyCustomer;
    delete body.updateMessage;

    body.receiptNumber = existing.receiptNumber;
    body.receiptKind = existing.receiptKind;
    body.publicAccessToken = existing.publicAccessToken;
    body.deletedAt = existing.deletedAt;
    body.deletedBy = existing.deletedBy;
    body.deleteReason = existing.deleteReason;
    body.auditEvents = existing.auditEvents;
    body.priceEstimate = recalcPriceEstimate(body.items ?? existing.items);

    existing.set(body);
    existing.addAuditEvent("updated", req.user?.username || "admin", notifyCustomer ? "notify-customer" : "");
    await existing.save();
    const receipt = existing;

    let notify = null;
    if (notifyCustomer) {
      try {
        notify = await sendCustomerNotifications({ receipt, type: "update", message: updateMessage });
      } catch (e) {
        notify = {
          emailNotify: { sent: false, reason: e?.message || String(e) },
          smsNotify: { sent: false, reason: e?.message || String(e) },
        };
        console.error("[receipt] update notification crashed:", e?.message || e);
      }
    }

    res.json(notify ? { ...receipt.toObject(), ...notify } : receipt);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/:id/update", auth, async (req, res) => {
  try {
    const receipt = await Receipt.findOne(activeReceiptFilter({ _id: req.params.id }));
    if (!receipt) return res.status(404).json({ error: "Receipt not found." });

    const message = String(req.body.message ?? "").trim();
    if (message) {
      receipt.updates.push({ message, author: req.user.username });
    }

    if (req.body.status) {
      receipt.status = req.body.status;
    }

    receipt.addAuditEvent("status-update", req.user?.username || "admin", message || req.body.status || "");
    await receipt.save();

    let notify = null;
    if (req.body.notifyCustomer) {
      try {
        notify = await sendCustomerNotifications({ receipt, type: "update", message });
      } catch (e) {
        notify = {
          emailNotify: { sent: false, reason: e?.message || String(e) },
          smsNotify: { sent: false, reason: e?.message || String(e) },
        };
        console.error("[receipt] update notification crashed:", e?.message || e);
      }
    }

    res.json(notify ? { ...receipt.toObject(), ...notify } : receipt);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/:id/items/:itemId/update", auth, async (req, res) => {
  try {
    const receipt = await Receipt.findOne(activeReceiptFilter({ _id: req.params.id }));
    if (!receipt) return res.status(404).json({ error: "Receipt not found." });

    const item = receipt.items.id(req.params.itemId);
    if (!item) return res.status(404).json({ error: "Item not found." });

    if (req.body.status) item.status = req.body.status;
    if (req.body.message) {
      item.updates.push({
        message: req.body.message,
        author: req.user.username,
      });
    }

    const allStatuses = receipt.items.map((it) => it.status);
    if (allStatuses.every((s) => s === "completed")) {
      receipt.status = "completed";
    } else if (allStatuses.every((s) => ["ready-for-pickup", "customer-called", "completed"].includes(s))) {
      receipt.status = "ready-for-pickup";
    } else if (allStatuses.some((s) => s === "in-progress")) {
      receipt.status = "in-progress";
    }

    receipt.addAuditEvent("line-update", req.user?.username || "admin", req.body.message || req.body.status || "");
    await receipt.save();
    res.json(receipt);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/:id/message", auth, async (req, res) => {
  try {
    const receipt = await Receipt.findOne(activeReceiptFilter({ _id: req.params.id }));
    if (!receipt) return res.status(404).json({ error: "Receipt not found." });

    receipt.messages.push({
      message: req.body.message,
      sender: "staff",
    });

    receipt.addAuditEvent("message", req.user?.username || "admin", "staff message");
    await receipt.save();
    res.json(receipt);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete("/:id", auth, async (req, res) => {
  try {
    const receipt = await Receipt.findOne(activeReceiptFilter({ _id: req.params.id }));
    if (!receipt) return res.status(404).json({ error: "Receipt not found." });
    receipt.deletedAt = new Date();
    receipt.deletedBy = req.user?.username || "admin";
    receipt.deleteReason = String(req.body?.reason || req.query?.reason || "").trim();
    receipt.addAuditEvent("deleted", receipt.deletedBy, receipt.deleteReason);
    await receipt.save();
    res.json({ message: "Receipt moved to deleted receipts.", receipt });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/:id/restore", auth, async (req, res) => {
  try {
    const receipt = await Receipt.findById(req.params.id);
    if (!receipt || !receipt.deletedAt) return res.status(404).json({ error: "Deleted receipt not found." });
    receipt.deletedAt = null;
    receipt.deletedBy = "";
    receipt.deleteReason = "";
    receipt.addAuditEvent("restored", req.user?.username || "admin");
    await receipt.save();
    res.json(receipt);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
