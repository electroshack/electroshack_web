/**
 * Merge IMEI/TAC + UPC hints. Prefer retail catalog for title/pricing when available;
 * use TAC for category/brand when IMEI is confident.
 */

const { digitsOnly } = require("./barcodeNormalize");
const { hintFromAnyImeiInput } = require("./imeiDeviceHint");
const { lookupExternalProduct } = require("./productBarcodeHint");

/**
 * @param {string} raw — scan or pasted single ID
 * @returns {Promise<object>} unified hint for InventoryForm
 */
async function lookupCombinedHint(raw) {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return { found: false };

  const ds = digitsOnly(trimmed);

  /** 15-digit bodies are treated as IMEI first (UPC/EAN tops at 13). */
  const preferImei = ds.length >= 14;

  const imeiPart = hintFromAnyImeiInput(trimmed);

  let upcPart = { found: false };
  if (ds.length <= 13) {
    upcPart = await lookupExternalProduct(trimmed);
  } else if (preferImei && !imeiPart.found) {
    upcPart = await lookupExternalProduct(trimmed);
  } else if (!preferImei) {
    upcPart = await lookupExternalProduct(trimmed);
  }

  const im = Boolean(imeiPart.normalized && imeiPart.found);
  const upcOk = Boolean(upcPart && upcPart.found === true);
  const found = im || upcOk;

  if (!found) return { found: false };

  const category =
    (im && imeiPart.category && imeiPart.luhnValid !== false ? imeiPart.category : null) ||
    (upcOk ? upcPart.category : null) ||
    undefined;

  const displayName =
    (upcOk && (upcPart.displayName || upcPart.title)) ||
    (im && imeiPart.brand && imeiPart.modelLabel ? `${imeiPart.brand} ${imeiPart.modelLabel}` : "") ||
    (im ? imeiPart.modelLabel : "") ||
 "";

  const notesParts = [];
  if (imeiPart.tac) notesParts.push(`IMEI TAC: ${imeiPart.tac}${imeiPart.brand ? ` (${imeiPart.brand})` : ""}`);
  if (imeiPart.notes && !imeiPart.brand) notesParts.push(imeiPart.notes);
  if (upcPart.notes) notesParts.push(upcPart.notes);
  const mergedNotes = notesParts.filter(Boolean).join("\n");

  return {
    found: true,
    source: im && upcOk ? "imei+tac+upcitemdb" : im ? "imei+tac" : "upcitemdb",
    normalized:
      (upcOk && upcPart.normalized) ||
      imeiPart.normalized ||
      trimmed,
    /** Retail UPC/EAN when catalog hit; separate from device IMEI */
    retailBarcode: upcOk ? upcPart.normalized : undefined,
    imeiNormalized: imeiPart.normalized || undefined,
    tac: imeiPart.tac,
    brand: imeiPart.brand || upcPart.brand,
    model: upcPart.model,
    modelLabel: upcPart.modelLabel || imeiPart.modelLabel,
    deviceFamily: upcPart.deviceFamily || imeiPart.deviceFamily,
    title: upcPart.title,
    displayName: displayName || undefined,
    description: upcPart.description,
    retailCategory: upcPart.retailCategory,
    category,
    suggestedCondition: upcPart.suggestedCondition,
    suggestedSellingPrice: upcPart.suggestedSellingPrice,
    priceCurrency: upcPart.priceCurrency,
    priceRangeHigh: upcPart.priceRangeHigh,
    images: upcPart.images,
    notes: mergedNotes || upcPart.notes,
    luhnValid: imeiPart.luhnValid,
  };
}

module.exports = {
  lookupCombinedHint,
};
