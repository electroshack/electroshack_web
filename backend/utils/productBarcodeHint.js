/**
 * UPCitemdb trial API — maps full `items[0]` payload to inventory hints.
 * @see https://www.upcitemdb.com
 */

const { barcodeLookupVariants } = require("./barcodeNormalize");

/** @param {string} title */
function guessCategoryFromTitle(title) {
  if (!title || typeof title !== "string") return "other";

  const s = title.toLowerCase();

  if (
    /iphone|pixel|galaxy phone|smartphone|android phone|cell phone|mobile phone|oneplus|motorola/.test(
      s
    )
  ) {
    return "cell-phone";
  }
  if (/apple\s*watch|galaxy\s*watch|smartwatch|wear\s*os\s*watch/.test(s)) return "smartwatch";
  if (/ipad|tablet|kindle/.test(s)) return "tablet";
  if (/macbook|laptop|notebook|chromebook/.test(s)) return "laptop";
  if (/desktop|pc tower|workstation|monitor(?!.*phone)|keyboard|mouse|printer/.test(s)) return "pc";
  if (
    /case|cover|charger|cable|adapter|screen protector|earbud|headphone|accessory/.test(s)
  ) {
    return "accessory";
  }
  if (/fan|screw|thermal paste|ribbon|ssd bracket|replacement part/.test(s)) return "part";

  return "other";
}

/**
 * UPCitemdb returns a breadcrumb category: "Electronics > … > Mobile Phones"
 */
function guessCategoryFromUpcItem(item) {
  const path = String(item.category || "").trim();
  const title = String(item.title || "");
  return guessCategoryFromTitle(`${path} ${title}`);
}

/**
 * @param {string} cond
 * @returns {"new"|"refurbished"|"used"|null}
 */
function mapOfferCondition(cond) {
  const s = String(cond || "").trim().toLowerCase();
  if (!s) return null;
  if (/\bnew\b/.test(s)) return "new";
  if (/refurb/i.test(s)) return "refurbished";
  if (/used|pre[\s-]?owned|open[\s-]?box/i.test(s)) return "used";
  return null;
}

function inferConditionFromOffers(offers) {
  if (!Array.isArray(offers) || offers.length === 0) return null;
  const fromOffers = offers.map((o) => mapOfferCondition(o?.condition)).filter(Boolean);
  if (fromOffers.includes("refurbished")) return "refurbished";
  if (fromOffers.includes("used")) return "used";
  if (fromOffers.includes("new")) return "new";
  return null;
}

/**
 * @param  {...string} chunks
 * @returns {"new"|"refurbished"|"used"|null}
 */
function inferSuggestedCondition(...chunks) {
  const s = chunks.filter(Boolean).join(" ").toLowerCase();
  if (!s) return null;
  if (/\b(refurbished|seller[\s-]?refurbished|factory[\s-]?refurbished|certified[\s-]?refurbished|renewed)\b/.test(s)) {
    return "refurbished";
  }
  if (/\b(used|pre[\s-]?owned|second[\s-]?hand)\b/.test(s)) return "used";
  if (/\b(new in box|brand new|factory new|new sealed)\b/.test(s)) return "new";
  if (/\bopen[\s-]?box\b/.test(s)) return "used";
  return null;
}

function extractDeviceDetail(title, brand) {
  const t = String(title || "").trim();
  const b = String(brand || "").trim();
  const lower = t.toLowerCase();

  const out = {
    deviceFamily: null,
    modelLabel: null,
    displayName: t || b,
  };

  if (!t && !b) return out;

  if (/\biphone\b/i.test(t)) {
    out.deviceFamily = "iphone";
    const compact =
      t.match(
        /\b(iPhone\s+(?:SE\s*\([^)]+\)|SE\b|\d{1,2}\s*(?:Pro\s*Max|Pro|Plus|mini)\b|\d{1,2}\b))/i
      )?.[1] ||
      t.match(/\b(iPhone\s+[^,;|]+)/i)?.[1];
    out.modelLabel = compact ? compact.replace(/\s+/g, " ").trim() : "iPhone";
    out.displayName = t;
    return out;
  }

  if (/\bipad\b/i.test(lower)) {
    out.deviceFamily = "ipad";
    out.modelLabel = t.match(/\b(iPad(?:\s+Pro)?(?:\s+\d{1,2}(?:\.\d+)?)?(?:\s*inch)?(?:\s+Air|mini)?[^,;|]+)/i)?.[1]?.trim() || "iPad";
    out.displayName = t;
    return out;
  }

  if (/\bmacbook\b/i.test(lower)) {
    out.deviceFamily = "macbook";
    out.modelLabel = t.match(/\b(MacBook\s+(?:Pro|Air)[^,;|]+)/i)?.[1]?.trim() || "MacBook";
    out.displayName = t;
    return out;
  }

  if (/\bapple\s+watch|galaxy\s+watch|smartwatch\b/i.test(lower)) {
    out.deviceFamily = "watch";
    out.modelLabel = t.split(/[,;|]/)[0]?.trim().slice(0, 120) || t.slice(0, 120);
    out.displayName = t;
    return out;
  }

  if (/\b(samsung\s+galaxy|google\s+pixel)\b/i.test(t)) {
    out.deviceFamily = "cell-phone";
    out.modelLabel = t.split(/[,;|]/)[0]?.trim().slice(0, 120) || t.slice(0, 120);
    out.displayName = t;
    return out;
  }

  return out;
}

/**
 * @param {object} item — UPCitemdb items[0]
 * @param {string} lookupCode — variant that matched
 */
/** UPCitemdb may return prices as numbers or strings */
function parseFiniteNumber(v) {
  if (v == null || v === "") return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const n = parseFloat(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function hintFromUpcItemDbItem(item, lookupCode) {
  const title = String(item.title || "").trim();
  const brand = String(item.brand || "").trim();
  const model = String(item.model || "").trim();
  const description = typeof item.description === "string" ? item.description.trim() : "";
  const ean = String(item.ean || "").trim();
  const upc = String(item.upc || "").trim();
  const retailCategory = String(item.category || "").trim();
  const color = String(item.color || "").trim();
  const size = String(item.size || "").trim();

  const normalized = ean || upc || lookupCode;

  const category = guessCategoryFromUpcItem(item);
  const detail = extractDeviceDetail(title, brand);
  const fromOffers = inferConditionFromOffers(item.offers);
  const fromText = inferSuggestedCondition(title, description, retailCategory);
  const suggestedCondition = fromOffers || fromText || null;

  let displayName = detail.displayName || title || brand;
  if (model && !displayName.toLowerCase().includes(model.toLowerCase())) {
    displayName = `${displayName} (MPN ${model})`.trim();
  }

  let lowest = parseFiniteNumber(item.lowest_recorded_price);
  let highest = parseFiniteNumber(item.highest_recorded_price);

  const currency = String(item.currency || "").trim();

  const images = Array.isArray(item.images) ? item.images.filter((u) => typeof u === "string" && /^https?:\/\//i.test(u)).slice(0, 5) : [];

  const offerLines =
    Array.isArray(item.offers) && item.offers.length > 0
      ? item.offers.slice(0, 4).map((o) => {
          const priceNum = parseFiniteNumber(o.price);
          const p =
            priceNum != null
              ? `${o.currency || currency || ""} ${priceNum}`.trim()
              : o.price != null && String(o.price).trim()
                ? `${o.currency || currency || ""} ${o.price}`.trim()
                : "";
          const c = o.condition ? ` ${o.condition}` : "";
          return `- ${o.merchant || o.domain || "Offer"}: ${p}${c}`.trim();
        })
      : [];

  const notesParts = [
    retailCategory ? `Retail category: ${retailCategory}` : "",
    color ? `Color: ${color}` : "",
    size ? `Size: ${size}` : "",
    lowest != null || highest != null
      ? `Recorded price range${currency ? ` (${currency})` : ""}: ${lowest != null ? lowest : "?"} – ${highest != null ? highest : "?"}`
      : "",
    offerLines.length ? `Sample offers:\n${offerLines.join("\n")}` : "",
  ].filter(Boolean);

  const catalogNotes = notesParts.join("\n");

  return {
    found: true,
    source: "upcitemdb",
    normalized,
    ean: ean || undefined,
    upc: upc || undefined,
    title,
    brand,
    model,
    description,
    retailCategory,
    category,
    deviceFamily: detail.deviceFamily,
    modelLabel: detail.modelLabel || (model ? `MPN ${model}` : null),
    displayName,
    suggestedCondition,
    /** Prefill selling price when we have a sensible list price */
    suggestedSellingPrice: lowest != null ? lowest : null,
    priceCurrency: currency || null,
    priceRangeHigh: highest,
    images,
    notes: catalogNotes,
  };
}

async function tryUpcItemDb(code) {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 12000);
    const res = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(code)}`, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    clearTimeout(t);

    if (!res.ok) return null;

    const json = await res.json();
    if (json.code && String(json.code).toUpperCase() !== "OK") return null;
    const item = json?.items?.[0];
    if (!item) return null;

    return hintFromUpcItemDbItem(item, code);
  } catch {
    return null;
  }
}

/**
 * @param {string} barcode
 */
async function lookupExternalProduct(barcode) {
  const variants = barcodeLookupVariants(barcode);
  if (variants.length === 0) return { found: false };

  for (const code of variants) {
    const hint = await tryUpcItemDb(code);
    if (hint) return hint;
  }

  return { found: false };
}

module.exports = {
  guessCategoryFromTitle,
  extractDeviceDetail,
  inferSuggestedCondition,
  lookupExternalProduct,
};
