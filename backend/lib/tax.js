function roundMoney(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function hstRate() {
  const n = Number(process.env.TAX_HST_RATE);
  return Number.isFinite(n) && n >= 0 ? n : 0.13;
}

function lineSum(items) {
  if (!Array.isArray(items)) return 0;
  return roundMoney(
    items.reduce((s, it) => {
      const qty = Math.max(1, Number(it?.stockQty) || 1);
      const net = Math.max(0, (Number(it?.price) || 0) - (Number(it?.discount) || 0));
      return s + net * qty;
    }, 0)
  );
}

const SALE_CATEGORIES = new Set([
  "cell-phone-accessory",
  "cell-phone-purchase",
  "laptop-purchase",
  "pc-purchase",
  "other",
]);

function isSaleOnly(items) {
  if (!Array.isArray(items) || items.length === 0) return false;
  return items.every((it) => it.inventoryItemId && SALE_CATEGORIES.has(it.category || "other"));
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
  SALE_CATEGORIES,
  isSaleOnly,
  applyDocumentTotals,
};
