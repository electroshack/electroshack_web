const Inventory = require("../models/Inventory");
const StockEvent = require("../models/StockEvent");
const { catalogModels, familyRank } = require("../data/catalogModels");

function snapshot(item) {
  return {
    quantity: Number(item.quantity) || 0,
    status: item.status || "in-stock",
    showOnStorefront: item.showOnStorefront !== false,
    soldTo: item.soldTo || "",
    dateSold: item.dateSold || null,
    saleReceiptNumber: item.saleReceiptNumber || "",
  };
}

/**
 * Qty 0 → out-of-stock. Qty > 0 → in-stock. Old sold/reserved/returned map here.
 */
function canonicalStockStatus(status) {
  if (status === "in-stock" || status === "out-of-stock") return status;
  if (status === "reserved") return "in-stock";
  if (status === "sold" || status === "returned") return "out-of-stock";
  return status || "in-stock";
}

function statusAfterQty(item, newQty, explicitStatus) {
  if (explicitStatus) return canonicalStockStatus(explicitStatus);
  const qty = Math.max(0, Number(newQty) || 0);
  return qty > 0 ? "in-stock" : "out-of-stock";
}

function storefrontFilter() {
  return {
    $or: [
      { status: "in-stock", quantity: { $gt: 0 }, showOnStorefront: { $ne: false } },
      { status: "out-of-stock", showOnStorefrontWhenEmpty: true },
    ],
  };
}

async function applyChange({ item, newQuantity, newStatus, reason, actor, extra = {} }) {
  const old = snapshot(item);
  const qty = Math.max(0, Number(newQuantity));
  const status = newStatus || statusAfterQty(item, qty);
  const qtyChanged = qty !== old.quantity;
  const statusChanged = status !== old.status;
  if (!qtyChanged && !statusChanged && !extra.force) {
    return { item, event: null };
  }

  const event = await StockEvent.create({
    inventoryItemId: item._id,
    itemNumber: item.itemNumber,
    itemName: item.name,
    actor: actor || "staff",
    reason,
    oldQuantity: old.quantity,
    newQuantity: qty,
    oldStatus: old.status,
    newStatus: status,
    receiptId: extra.receiptId || null,
    receiptNumber: extra.receiptNumber || "",
    saleQty: extra.saleQty || Math.abs(old.quantity - qty),
    previousSnapshot: old,
    undoesEventId: extra.undoesEventId || null,
  });

  item.quantity = qty;
  item.status = status;
  if (status === "sold") {
    item.showOnStorefront = false;
    if (extra.soldTo) item.soldTo = extra.soldTo;
    if (extra.dateSold || extra.soldTo) item.dateSold = extra.dateSold || new Date();
    if (extra.receiptNumber) item.saleReceiptNumber = extra.receiptNumber;
  }
  if (status === "in-stock" && old.status === "sold") {
    item.soldTo = "";
    item.dateSold = undefined;
    item.saleReceiptNumber = "";
  }

  item.stockEvents = Array.isArray(item.stockEvents) ? item.stockEvents : [];
  item.stockEvents.push({
    eventId: event._id,
    actor: event.actor,
    reason,
    oldQuantity: old.quantity,
    newQuantity: qty,
    oldStatus: old.status,
    newStatus: status,
    at: event.createdAt,
  });
  if (item.stockEvents.length > 50) item.stockEvents = item.stockEvents.slice(-50);

  await item.save();
  return { item, event };
}

async function undoEvent(eventId, actor) {
  const event = await StockEvent.findById(eventId);
  if (!event) {
    const err = new Error("Stock event not found.");
    err.status = 404;
    throw err;
  }
  const already = await StockEvent.exists({ reason: "undo", undoesEventId: event._id });
  if (already) {
    const err = new Error("That change was already undone.");
    err.status = 400;
    throw err;
  }
  const item = await Inventory.findById(event.inventoryItemId);
  if (!item) {
    const err = new Error("Item not found.");
    err.status = 404;
    throw err;
  }
  const snap = event.previousSnapshot || {};
  return applyChange({
    item,
    newQuantity: snap.quantity,
    newStatus: snap.status,
    reason: "undo",
    actor,
    extra: {
      force: true,
      undoesEventId: event._id,
      soldTo: snap.soldTo,
      dateSold: snap.dateSold,
      receiptNumber: snap.saleReceiptNumber,
    },
  });
}

async function undoLastForItem(itemId, actor) {
  const last = await StockEvent.findOne({ inventoryItemId: itemId }).sort({ createdAt: -1 });
  if (!last) {
    const err = new Error("No stock events to undo.");
    err.status = 400;
    throw err;
  }
  if (last.reason === "undo") {
    const err = new Error("Last change is already an undo. History is kept; pick an earlier event if needed.");
    err.status = 400;
    throw err;
  }
  return undoEvent(last._id, actor);
}

async function applySaleFromReceipt(receipt, actor) {
  if (receipt.payment?.stockApplied) {
    return { applied: [], skipped: "already-applied" };
  }
  const applied = [];
  for (const line of receipt.items || []) {
    const id = line.inventoryItemId;
    if (!id) continue;
    // eslint-disable-next-line no-await-in-loop
    const item = await Inventory.findById(id);
    if (!item) continue;
    const saleQty = Math.max(1, Number(line.stockQty) || 1);
    const newQty = Math.max(0, (Number(item.quantity) || 0) - saleQty);
    // eslint-disable-next-line no-await-in-loop
    const { event } = await applyChange({
      item,
      newQuantity: newQty,
      newStatus: statusAfterQty(item, newQty),
      reason: "sale",
      actor,
      extra: {
        receiptId: receipt._id,
        receiptNumber: receipt.receiptNumber,
        saleQty,
        soldTo: receipt.customerName,
        dateSold: new Date(),
      },
    });
    if (event) applied.push(event._id);
  }
  return { applied };
}

async function undoSaleFromReceipt(receipt, actor) {
  const events = await StockEvent.find({ receiptId: receipt._id, reason: "sale" }).sort({ createdAt: -1 });
  const undone = [];
  for (const ev of events) {
    // eslint-disable-next-line no-await-in-loop
    const already = await StockEvent.exists({ reason: "undo", undoesEventId: ev._id });
    if (already) continue;
    // eslint-disable-next-line no-await-in-loop
    const { event } = await undoEvent(ev._id, actor);
    if (event) undone.push(event._id);
  }
  return { undone };
}

async function recentlyOutOfStock(limit = 20) {
  const events = await StockEvent.find({ newStatus: "out-of-stock", reason: { $ne: "undo" } })
    .sort({ createdAt: -1 })
    .limit(80)
    .lean();
  const seen = new Set();
  const rows = [];
  for (const ev of events) {
    const key = String(ev.inventoryItemId);
    if (seen.has(key)) continue;
    seen.add(key);
    // eslint-disable-next-line no-await-in-loop
    const undone = await StockEvent.exists({ reason: "undo", undoesEventId: ev._id });
    if (undone) continue;
    // eslint-disable-next-line no-await-in-loop
    const item = await Inventory.findById(ev.inventoryItemId)
      .select("itemNumber name quantity status sellingPrice showOnStorefront showOnStorefrontWhenEmpty")
      .lean();
    if (!item || item.status !== "out-of-stock") continue;
    rows.push({
      eventId: ev._id,
      at: ev.createdAt,
      actor: ev.actor,
      reason: ev.reason,
      oldQuantity: ev.oldQuantity,
      newQuantity: ev.newQuantity,
      item,
    });
    if (rows.length >= limit) break;
  }
  return rows;
}

function matchScore(query, name) {
  const q = String(query || "").trim().toLowerCase();
  const n = String(name || "").trim().toLowerCase();
  if (!q || !n) return 0;
  if (n === q) return 400;
  if (n.startsWith(q)) return 320 - Math.min(n.length, 80);
  const words = n.split(/[\s/(),-]+/).filter(Boolean);
  const tokens = q.split(/\s+/).filter(Boolean);
  if (tokens.length === 1 && words.some((w) => w.startsWith(q))) return 240 - Math.min(n.length, 80);
  const allWordStarts = tokens.every((t) => words.some((w) => w.startsWith(t)));
  if (allWordStarts) return 200 - tokens.length;
  if (n.includes(q)) return 110;
  const allContained = tokens.every((t) => n.includes(t));
  if (allContained) return 80;
  return 0;
}

async function nameSuggestions({ q, barcode, imei, serial, limit = 8 }) {
  const query = String(q || "").trim();
  const cap = Math.min(12, Math.max(1, Number(limit) || 8));
  const results = [];
  const seen = new Set();

  function push(entry, score, sourceBoost) {
    const key = `${entry.name}|${entry.category || ""}`.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    results.push({ ...entry, score: score + sourceBoost });
  }

  const scanBits = [barcode, imei, serial].map((s) => String(s || "").trim()).filter(Boolean);
  if (scanBits.length) {
    const or = [];
    for (const bit of scanBits) {
      or.push(
        { barcode: { $regex: bit, $options: "i" } },
        { imei: { $regex: bit, $options: "i" } },
        { serialNumber: { $regex: bit, $options: "i" } }
      );
    }
    const scanned = await Inventory.find({ $or: or })
      .select("name category itemNumber sellingPrice quantity status barcode imei serialNumber")
      .limit(6)
      .lean();
    for (const it of scanned) {
      push(
        {
          name: it.name,
          category: it.category,
          source: "scan",
          inventoryItemId: it._id,
          itemNumber: it.itemNumber,
          sellingPrice: it.sellingPrice,
          quantity: it.quantity,
          status: it.status,
        },
        query ? matchScore(query, it.name) || 50 : 50,
        80
      );
    }
  }

  if (query.length >= 1) {
    const rx = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    const existing = await Inventory.find({
      $or: [{ name: rx }, { itemNumber: rx }, { barcode: rx }],
    })
      .select("name category itemNumber sellingPrice quantity status")
      .sort({ updatedAt: -1 })
      .limit(40)
      .lean();
    for (const it of existing) {
      const score = matchScore(query, it.name) || matchScore(query, it.itemNumber);
      if (!score) continue;
      push(
        {
          name: it.name,
          category: it.category,
          source: "inventory",
          inventoryItemId: it._id,
          itemNumber: it.itemNumber,
          sellingPrice: it.sellingPrice,
          quantity: it.quantity,
          status: it.status,
        },
        score,
        40
      );
    }

    for (const model of catalogModels()) {
      const score = matchScore(query, model.name);
      if (!score) continue;
      push(
        {
          name: model.name,
          category: model.category,
          source: "catalog",
          family: model.family,
        },
        score - familyRank(model.family) * 0.1,
        0
      );
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, cap).map(({ score, ...rest }) => rest);
}

module.exports = {
  snapshot,
  canonicalStockStatus,
  statusAfterQty,
  storefrontFilter,
  applyChange,
  undoEvent,
  undoLastForItem,
  applySaleFromReceipt,
  undoSaleFromReceipt,
  recentlyOutOfStock,
  nameSuggestions,
  matchScore,
};
