function roundMoney(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function hstRate() {
  const n = Number(process.env.TAX_HST_RATE);
  return Number.isFinite(n) && n >= 0 ? n : 0.13;
}

function lineSum(items) {
  if (!Array.isArray(items)) return 0;
  return roundMoney(items.reduce((s, it) => s + (Number(it?.price) || 0) * Math.max(1, Number(it?.stockQty) || 1), 0));
}

const REPAIR_CATEGORIES = new Set(["repair", "laptop-repair", "pc-repair"]);

function isSaleOnly(items) {
  if (!Array.isArray(items) || items.length === 0) return false;
  return items.every((it) => it.inventoryItemId && !REPAIR_CATEGORIES.has(it.category || "repair"));
}

function applyDocumentTotals(body) {
  const sub = lineSum(body.items);
  body.subtotal = sub;
  if (body.documentType === "receipt") {
    body.hst = roundMoney(sub * hstRate());
    body.total = roundMoney(sub + body.hst);
    body.priceEstimate = body.total;
  } else {
    body.documentType = body.documentType || "quote";
    body.hst = 0;
    body.total = sub;
    body.priceEstimate = sub;
  }
  return body;
}

module.exports = {
  roundMoney,
  hstRate,
  lineSum,
  REPAIR_CATEGORIES,
  isSaleOnly,
  applyDocumentTotals,
};
