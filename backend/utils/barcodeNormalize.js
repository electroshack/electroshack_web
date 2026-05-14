/**
 * Normalize retail barcodes for lookup and DB matching.
 * Scanners may omit leading zeros; UPCitemdb expects standard lengths.
 */

/** Digits only. */
function digitsOnly(s) {
  return String(s || "").replace(/\D/g, "");
}

/**
 * Variants to try for external DB + inventory lookup (order matters).
 * @param {string} raw
 * @returns {string[]}
 */
function barcodeLookupVariants(raw) {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return [];

  const variants = new Set();
  variants.add(trimmed);

  const digits = digitsOnly(trimmed);
  if (digits) {
    variants.add(digits);
    if (digits.length <= 11) {
      variants.add(digits.padStart(12, "0"));
    }
    if (digits.length <= 12) {
      variants.add(digits.padStart(13, "0"));
    }
    if (digits.length === 8) {
      variants.add(("000000" + digits).slice(-13));
    }
  }

  return [...variants];
}

module.exports = {
  digitsOnly,
  barcodeLookupVariants,
};