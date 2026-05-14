const express = require("express");
const Receipt = require("../models/Receipt");
const { auth } = require("../middleware/auth");
const { nextStandardReceiptNumber, peekNextStandardReceiptNumber, generateLegacyReceiptNumber } = require("../utils/receiptNumbers");
const { sendReceiptConfirmationEmail, sendReceiptUpdateEmail } = require("../lib/email");
const router = express.Router();

function publicTicketBaseUrl() {
  const base = (process.env.PUBLIC_SITE_URL || process.env.FRONTEND_URL || "http://localhost:3000").replace(/\/$/, "");
  return `${base}/ticket`;
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
    await receipt.save();

    let emailNotify = null;
    if (kind === "standard" && receipt.customerEmail && String(receipt.customerEmail).trim()) {
      const trackUrl = `${publicTicketBaseUrl()}`;
      try {
        emailNotify = await sendReceiptConfirmationEmail({
          to: receipt.customerEmail,
          customerName: receipt.customerName,
          receiptNumber: receipt.receiptNumber,
          trackUrl,
          priceEstimate: receipt.priceEstimate,
          items: receipt.items,
        });
      } catch (e) {
        emailNotify = { sent: false, reason: e?.message || String(e) };
        console.error("[receipt] confirmation email crashed:", emailNotify.reason);
      }
      if (!emailNotify?.sent) {
        console.warn("[receipt] confirmation email skipped:", emailNotify?.reason || emailNotify);
      }
    }

    res.status(201).json(emailNotify ? { ...receipt.toObject(), emailNotify } : receipt);
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

    const clauses = [];
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
      Receipt.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      Receipt.aggregate([
        { $match: { status: "completed" } },
        { $group: { _id: null, total: { $sum: "$priceEstimate" } } },
      ]),
    ]);

    res.json({
      statusCounts: statusCounts.reduce((acc, s) => ({ ...acc, [s._id]: s.count }), {}),
      totalRevenue: totalRevenue[0]?.total || 0,
      totalReceipts: await Receipt.countDocuments(),
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

router.get("/:id", auth, async (req, res) => {
  try {
    const receipt = await Receipt.findById(req.params.id);
    if (!receipt) return res.status(404).json({ error: "Receipt not found." });
    res.json(receipt);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/:id", auth, async (req, res) => {
  try {
    const existing = await Receipt.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: "Receipt not found." });
    const body = stripTaxFields({ ...req.body });
    const notifyCustomer = Boolean(body.notifyCustomer);
    const updateMessage = typeof body.updateMessage === "string" ? body.updateMessage.trim() : "";
    delete body.notifyCustomer;
    delete body.updateMessage;

    body.receiptNumber = existing.receiptNumber;
    body.receiptKind = existing.receiptKind;
    body.priceEstimate = recalcPriceEstimate(body.items ?? existing.items);

    const receipt = await Receipt.findByIdAndUpdate(req.params.id, body, {
      new: true,
      runValidators: true,
    });

    let emailNotify = null;
    if (notifyCustomer && receipt?.customerEmail && String(receipt.customerEmail).trim()) {
      const trackUrl = `${publicTicketBaseUrl()}`;
      try {
        emailNotify = await sendReceiptUpdateEmail({
          to: receipt.customerEmail,
          customerName: receipt.customerName,
          receiptNumber: receipt.receiptNumber,
          status: receipt.status,
          message: updateMessage,
          trackUrl,
          priceEstimate: receipt.priceEstimate,
        });
      } catch (e) {
        emailNotify = { sent: false, reason: e?.message || String(e) };
        console.error("[receipt] update email crashed:", emailNotify.reason);
      }
      if (!emailNotify?.sent) {
        console.warn("[receipt] update email skipped:", emailNotify?.reason || emailNotify);
      }
    }

    res.json(emailNotify ? { ...receipt.toObject(), emailNotify } : receipt);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/:id/update", auth, async (req, res) => {
  try {
    const receipt = await Receipt.findById(req.params.id);
    if (!receipt) return res.status(404).json({ error: "Receipt not found." });

    const message = String(req.body.message ?? "").trim();
    if (message) {
      receipt.updates.push({ message, author: req.user.username });
    }

    if (req.body.status) {
      receipt.status = req.body.status;
    }

    await receipt.save();

    let emailNotify = null;
    if (req.body.notifyCustomer && receipt.customerEmail && String(receipt.customerEmail).trim()) {
      const trackUrl = `${publicTicketBaseUrl()}`;
      try {
        emailNotify = await sendReceiptUpdateEmail({
          to: receipt.customerEmail,
          customerName: receipt.customerName,
          receiptNumber: receipt.receiptNumber,
          status: receipt.status,
          message,
          trackUrl,
          priceEstimate: receipt.priceEstimate,
        });
      } catch (e) {
        emailNotify = { sent: false, reason: e?.message || String(e) };
        console.error("[receipt] update email crashed:", emailNotify.reason);
      }
      if (!emailNotify?.sent) {
        console.warn("[receipt] update email skipped:", emailNotify?.reason || emailNotify);
      }
    }

    res.json(emailNotify ? { ...receipt.toObject(), emailNotify } : receipt);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/:id/items/:itemId/update", auth, async (req, res) => {
  try {
    const receipt = await Receipt.findById(req.params.id);
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

    await receipt.save();
    res.json(receipt);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/:id/message", auth, async (req, res) => {
  try {
    const receipt = await Receipt.findById(req.params.id);
    if (!receipt) return res.status(404).json({ error: "Receipt not found." });

    receipt.messages.push({
      message: req.body.message,
      sender: "staff",
    });

    await receipt.save();
    res.json(receipt);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete("/:id", auth, async (req, res) => {
  try {
    const receipt = await Receipt.findByIdAndDelete(req.params.id);
    if (!receipt) return res.status(404).json({ error: "Receipt not found." });
    res.json({ message: "Receipt deleted." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUBLIC: customer ticket lookup
router.get("/lookup/:receiptNumber", async (req, res) => {
  try {
    const receipt = await Receipt.findOne({
      receiptNumber: req.params.receiptNumber,
    });
    if (!receipt) {
      return res.status(404).json({ error: "Ticket not found. Please check your receipt number." });
    }
    res.json({
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
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/lookup/:receiptNumber/message", async (req, res) => {
  try {
    const receipt = await Receipt.findOne({
      receiptNumber: req.params.receiptNumber,
    });
    if (!receipt) {
      return res.status(404).json({ error: "Ticket not found." });
    }

    receipt.messages.push({
      message: req.body.message,
      sender: "customer",
    });

    await receipt.save();
    res.json({ message: "Message sent successfully." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
