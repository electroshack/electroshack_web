const express = require("express");
const Inventory = require("../models/Inventory");
const { auth } = require("../middleware/auth");
const { notifyGroceryListMatches } = require("../utils/groceryNotifications");
const { lookupCombinedHint } = require("../utils/scanHints");
const { resolveProductHeroImageUrl } = require("../utils/productHeroImages");
const { barcodeLookupVariants } = require("../utils/barcodeNormalize");
const {
  normalizeImei,
  imeiLookupVariants,
  normalizeSerial,
  serialLookupVariants,
  extractStickerFields,
} = require("../utils/deviceIdentifiers");
const {
  applyChange,
  statusAfterQty,
  canonicalStockStatus,
  storefrontFilter,
  undoEvent,
  undoLastForItem,
  recentlyOutOfStock,
  nameSuggestions,
} = require("../lib/stock");
const router = express.Router();

/** Next sequential internal number (digits only). Safe for mixed legacy alphanumeric #s. */
async function peekNextItemNumber() {
  const r = await Inventory.aggregate([
    { $match: { itemNumber: { $regex: /^\d+$/ } } },
    { $group: { _id: null, max: { $max: { $toDouble: "$itemNumber" } } } },
  ]);
  return String(Math.max(10000, Math.floor((r[0]?.max ?? 10000) + 1)));
}

async function allocateNextItemNumber() {
  let next = parseInt(await peekNextItemNumber(), 10);
  let candidate = String(next);
  for (let i = 0; i < 5; i++) {
    const exists = await Inventory.exists({ itemNumber: candidate });
    if (!exists) return candidate;
    next += 1;
    candidate = String(next);
  }
  return String(Date.now()).slice(-10);
}

function normalizeInventoryBody(body) {
  if (typeof body.showOnStorefront === "string") {
    body.showOnStorefront = body.showOnStorefront === "true";
  }
  if (typeof body.showOnStorefrontWhenEmpty === "string") {
    body.showOnStorefrontWhenEmpty = body.showOnStorefrontWhenEmpty === "true";
  }
  if (body.itemNumber != null) body.itemNumber = String(body.itemNumber).trim();
  if (body.barcode != null) body.barcode = String(body.barcode).trim();
  if (body.imei != null) {
    const n = normalizeImei(body.imei);
    body.imei = n.canonical || String(body.imei).trim();
  }
  if (body.serialNumber != null) body.serialNumber = normalizeSerial(body.serialNumber);
  if (body.status) body.status = canonicalStockStatus(body.status);
  delete body._id;
  delete body.__v;
  delete body.createdAt;
  delete body.updatedAt;
  delete body.stockEvents;
  return body;
}

/** Inventory lookup: IMEI/serial variants first (shop ground truth), then retail barcode */
function inventoryScanClauses(code) {
  const trimmed = String(code || "").trim();
  if (!trimmed) return [];
  const clauses = [];
  const im = normalizeImei(trimmed);
  if (im.canonical) {
    const iv = imeiLookupVariants(im.canonical).slice(0, 48);
    if (iv.length) clauses.push({ imei: { $in: iv } });
  }
  const sn = normalizeSerial(trimmed);
  if (sn) {
    const sv = serialLookupVariants(sn).slice(0, 36);
    if (sv.length) clauses.push({ serialNumber: { $in: sv } });
  }
  const bars = barcodeLookupVariants(trimmed);
  if (bars.length) clauses.push({ barcode: { $in: bars } });
  return clauses;
}

router.post("/", auth, async (req, res) => {
  try {
    const body = normalizeInventoryBody({ ...req.body });
    const noItemNum = !body.itemNumber || !String(body.itemNumber).trim();
    if (noItemNum) {
      body.itemNumber = await allocateNextItemNumber();
    }
    const qty = parseInt(body.quantity, 10);
    if (Number.isFinite(qty) && qty <= 0 && !body.status) {
      body.status = "out-of-stock";
    }
    const item = new Inventory(body);
    await item.save();
    await notifyGroceryListMatches(item, null);
    res.status(201).json(item);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ error: "Item number or barcode already exists." });
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
      category,
      condition,
      search,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const filter = {};
    if (status === "out-of-stock") filter.status = { $in: ["out-of-stock", "sold", "returned"] };
    else if (status === "in-stock") filter.status = { $in: ["in-stock", "reserved"] };
    else if (status) filter.status = status;
    if (category) filter.category = category;
    if (condition) filter.condition = condition;
    if (search) {
      filter.$or = [
        { itemNumber: { $regex: search, $options: "i" } },
        { barcode: { $regex: search, $options: "i" } },
        { imei: { $regex: search, $options: "i" } },
        { serialNumber: { $regex: search, $options: "i" } },
        { name: { $regex: search, $options: "i" } },
        { boughtFrom: { $regex: search, $options: "i" } },
        { soldTo: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sort = { [sortBy]: sortOrder === "asc" ? 1 : -1 };

    const [items, total] = await Promise.all([
      Inventory.find(filter).sort(sort).skip(skip).limit(parseInt(limit)),
      Inventory.countDocuments(filter),
    ]);

    res.json({
      items,
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
    const [statusCounts, categoryCounts, totalValue] = await Promise.all([
      Inventory.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      Inventory.aggregate([{ $group: { _id: "$category", count: { $sum: 1 } } }]),
      Inventory.aggregate([
        { $match: { status: "in-stock" } },
        { $group: { _id: null, total: { $sum: { $multiply: ["$sellingPrice", "$quantity"] } } } },
      ]),
    ]);

    res.json({
      statusCounts: statusCounts.reduce((acc, s) => ({ ...acc, [s._id]: s.count }), {}),
      categoryCounts: categoryCounts.reduce((acc, c) => ({ ...acc, [c._id]: c.count }), {}),
      totalInventoryValue: totalValue[0]?.total || 0,
      totalItems: await Inventory.countDocuments(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUBLIC: quick counts for debugging / dashboards (no auth)
router.get("/public-check", async (req, res) => {
  try {
    const [total, storefront, inStock] = await Promise.all([
      Inventory.countDocuments({}),
      Inventory.countDocuments(storefrontFilter()),
      Inventory.countDocuments({ status: "in-stock", quantity: { $gt: 0 } }),
    ]);
    res.json({ totalItems: total, inStockListed: inStock, storefrontVisible: storefront });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUBLIC: storefront items
router.get("/storefront", async (req, res) => {
  try {
    const { category, search, page = 1, limit = 20 } = req.query;
    const clauses = [storefrontFilter()];
    if (category) clauses.push({ category });
    if (search) {
      clauses.push({
        $or: [
          { name: { $regex: search, $options: "i" } },
          { description: { $regex: search, $options: "i" } },
        ],
      });
    }
    const filter = clauses.length === 1 ? clauses[0] : { $and: clauses };

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [items, total] = await Promise.all([
      Inventory.find(filter)
        .select("itemNumber name description category condition sellingPrice quantity images status")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Inventory.countDocuments(filter),
    ]);

    res.json({ items, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Next internal item # that will be assigned on create (preview only). */
router.get("/recently-out-of-stock", auth, async (req, res) => {
  try {
    const limit = Math.min(40, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const items = await recentlyOutOfStock(limit);
    res.json({ items });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/name-suggestions", auth, async (req, res) => {
  try {
    const items = await nameSuggestions({
      q: req.query.q,
      barcode: req.query.barcode,
      imei: req.query.imei,
      serial: req.query.serial,
      limit: req.query.limit,
    });
    res.json({ items });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/preview-next-number", auth, async (req, res) => {
  try {
    const itemNumber = await peekNextItemNumber();
    res.json({ itemNumber });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/external-hint/:code", auth, async (req, res) => {
  try {
    const code = decodeURIComponent(String(req.params.code || "")).trim();
    if (!code) return res.status(400).json({ error: "Code required." });
    const hint = await lookupCombinedHint(code);
    const heroImage = resolveProductHeroImageUrl(hint);
    res.json({ ...hint, ...(heroImage ? { heroImage } : {}) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Paste noisy sticker text — returns IMEI / serial (instant, no network). */
router.post("/parse-sticker", auth, (req, res) => {
  try {
    const blob = String(req.body?.blob ?? "");
    res.json(extractStickerFields(blob));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get("/by-barcode/:code", auth, async (req, res) => {
  try {
    const code = decodeURIComponent(String(req.params.code || "")).trim();
    if (!code) return res.status(400).json({ error: "Code required." });
    const clauses = inventoryScanClauses(code);
    if (clauses.length === 0) return res.status(400).json({ error: "Invalid code." });
    const item = await Inventory.findOne({ $or: clauses });
    if (!item) return res.status(404).json({ error: "No inventory item with this barcode, IMEI, or serial." });
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:id", auth, async (req, res) => {
  try {
    const item = await Inventory.findById(req.params.id);
    if (!item) return res.status(404).json({ error: "Item not found." });
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/:id", auth, async (req, res) => {
  try {
    const item = await Inventory.findById(req.params.id);
    if (!item) return res.status(404).json({ error: "Item not found." });
    const previous = item.toObject();

    const update = normalizeInventoryBody({ ...req.body });
    const qtyProvided = Object.prototype.hasOwnProperty.call(update, "quantity");
    const statusProvided = Object.prototype.hasOwnProperty.call(update, "status") && Boolean(update.status);
    const nextQty = qtyProvided ? parseInt(update.quantity, 10) : item.quantity;
    const requestedStatus = statusProvided ? update.status : undefined;
    delete update.quantity;
    delete update.status;

    Object.assign(item, update);

    let nextStatus = requestedStatus;
    if (qtyProvided && Number.isFinite(nextQty) && nextQty <= 0 && !statusProvided) {
      nextStatus = statusAfterQty(item, nextQty);
    }
    if (nextStatus === "sold" || nextStatus === "out-of-stock") {
      nextStatus = "out-of-stock";
    }

    const actor = req.user?.username || "admin";
    const reason = Number.isFinite(nextQty) && nextQty > (previous.quantity || 0) ? "restock" : "manual";
    const { event } = await applyChange({
      item,
      newQuantity: qtyProvided && Number.isFinite(nextQty) ? nextQty : item.quantity,
      newStatus: nextStatus,
      reason,
      actor,
    });
    if (!event) await item.save();
    await notifyGroceryListMatches(item, previous);
    res.json(item);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ error: "Item number or barcode already exists." });
    }
    res.status(400).json({ error: err.message });
  }
});

router.post("/:id/reserve", auth, async (req, res) => {
  try {
    const item = await Inventory.findById(req.params.id);
    if (!item) return res.status(404).json({ error: "Item not found." });
    const qty = Math.max(1, parseInt(req.body?.qty, 10) || 1);
    const reserved = Number(item.reservedQty) || 0;
    const available = Math.max(0, (Number(item.quantity) || 0) - reserved);
    if (available < qty) {
      return res.status(400).json({ error: `Only ${available} available.` });
    }
    item.reservedQty = reserved + qty;
    await item.save();
    res.json(item);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/:id/unreserve", auth, async (req, res) => {
  try {
    const item = await Inventory.findById(req.params.id);
    if (!item) return res.status(404).json({ error: "Item not found." });
    const qty = Math.max(1, parseInt(req.body?.qty, 10) || 1);
    item.reservedQty = Math.max(0, (Number(item.reservedQty) || 0) - qty);
    await item.save();
    res.json(item);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/:id/undo-stock", auth, async (req, res) => {
  try {
    const actor = req.user?.username || "admin";
    const eventId = req.body?.eventId;
    const { item, event } = eventId
      ? await undoEvent(eventId, actor)
      : await undoLastForItem(req.params.id, actor);
    res.json({ item, event });
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
  }
});

router.post("/undo-stock-event/:eventId", auth, async (req, res) => {
  try {
    const actor = req.user?.username || "admin";
    const { item, event } = await undoEvent(req.params.eventId, actor);
    res.json({ item, event });
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
  }
});

router.delete("/:id", auth, async (req, res) => {
  try {
    const item = await Inventory.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ error: "Item not found." });
    res.json({ message: "Item deleted." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
