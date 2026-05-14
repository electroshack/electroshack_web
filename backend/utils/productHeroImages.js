/**
 * Curated compact product shots (official manufacturer CDN paths where available).
 * Prefer catalog images from hints when present; these cover common iPhone models for a clean fallback.
 */
const IPHONE_IMAGE = {
  "iphone 15 pro max":
    "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-15-pro-finish-select-2023-6-7inch-naturaltitanium?wid=400&hei=400&fmt=jpeg&qlt=90&.v=1692985997621",
  "iphone 15 pro":
    "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-15-pro-finish-select-2023-6-1inch-naturaltitanium?wid=400&hei=400&fmt=jpeg&qlt=90&.v=1692985997621",
  "iphone 15 plus":
    "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-15-finish-select-202309-6-7inch-pink?wid=400&hei=400&fmt=jpeg&qlt=90&.v=1692831506806",
  "iphone 15":
    "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-15-finish-select-202309-6-1inch-pink?wid=400&hei=400&fmt=jpeg&qlt=90&.v=1692831506806",
  "iphone 14 pro max":
    "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-14-pro-finish-select-202209-6-7inch-deeppurple?wid=400&hei=400&fmt=jpeg&qlt=90&.v=1660753619946",
  "iphone 14 pro":
    "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-14-pro-finish-select-202209-6-1inch-deeppurple?wid=400&hei=400&fmt=jpeg&qlt=90&.v=1660753619946",
  "iphone 14 plus":
    "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-14-finish-select-202209-6-7inch-blue?wid=400&hei=400&fmt=jpeg&qlt=90&.v=1660755066286",
  "iphone 14":
    "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-14-finish-select-202209-6-1inch-blue?wid=400&hei=400&fmt=jpeg&qlt=90&.v=1660755066286",
  "iphone 13 pro max":
    "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-13-pro-family-select-202109?wid=400&hei=400&fmt=jpeg&qlt=90&.v=1631295466694",
  "iphone 13 pro":
    "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-13-pro-family-select-202109?wid=400&hei=400&fmt=jpeg&qlt=90&.v=1631295466694",
  "iphone 13":
    "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-13-family-select-202109?wid=400&hei=400&fmt=jpeg&qlt=90&.v=1631295466694",
  "iphone se":
    "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-se-select-2022?wid=400&hei=400&fmt=jpeg&qlt=90&.v=1646584568944",
};

function normalizeKey(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/\(.*?\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * @param {object} hint — merged scan hint (may include images[], modelLabel, deviceFamily)
 * @returns {string|null}
 */
function resolveProductHeroImageUrl(hint) {
  if (!hint || !hint.found) return null;
  const imgs = Array.isArray(hint.images) ? hint.images.filter((u) => typeof u === "string" && /^https?:\/\//i.test(u)) : [];
  if (imgs.length) return imgs[0];

  const label = normalizeKey(hint.modelLabel || hint.displayName || hint.title || "");
  if (hint.deviceFamily === "iphone" || /iphone/i.test(label)) {
    for (const [key, url] of Object.entries(IPHONE_IMAGE)) {
      if (label.includes(key.replace(/\s+/g, " "))) return url;
    }
    /** Generic iPhone fallback (current gen hero style) */
    if (/iphone/.test(label)) {
      return IPHONE_IMAGE["iphone 14"];
    }
  }
  return null;
}

module.exports = {
  resolveProductHeroImageUrl,
  IPHONE_IMAGE,
};
