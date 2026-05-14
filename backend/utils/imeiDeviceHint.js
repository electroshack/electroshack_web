/**
 * Local TAC-based hints from IMEI (no network). Pairs with deviceIdentifiers.normalizeImei.
 */

const { luhnValid } = require("./deviceIdentifiers");
const tacRows = require("../data/tacPrefixes");

const TAC8 = new Map(tacRows);

/**
 * @param {string} imei15 — 15-digit IMEI
 * @returns {{ found: boolean, tac?: string, brand?: string, modelLabel?: string, category?: string, deviceFamily?: string, luhnValid?: boolean }}
 */
function lookupImeiTacHint(imei15) {
  const d = String(imei15 || "").replace(/\D/g, "");
  if (d.length !== 15) return { found: false };

  const tac8 = d.slice(0, 8);
  let row = TAC8.get(tac8);
  if (!row && tac8.length >= 6) {
    const tac6 = d.slice(0, 6);
    for (const [k, v] of TAC8) {
      if (k.startsWith(tac6)) {
        row = v;
        break;
      }
    }
  }

  if (!row) {
    return {
      found: true,
      tac: tac8,
      luhnValid: luhnValid(d),
      /** Brand not in local DB — staff still have raw IMEI */
      brand: undefined,
      modelLabel: undefined,
      category: undefined,
      deviceFamily: undefined,
      source: "imei-tac",
      notes: `TAC ${tac8}: add this prefix to backend/data/tacPrefixes.js if you see it often.`,
    };
  }

  return {
    found: true,
    source: "imei-tac",
    tac: tac8,
    brand: row.brand,
    modelLabel: row.modelHint,
    category: row.category,
    deviceFamily: row.deviceFamily,
    luhnValid: luhnValid(d),
  };
}

/**
 * @param {string} raw — user paste / scan
 */
function hintFromAnyImeiInput(raw) {
  const { normalizeImei } = require("./deviceIdentifiers");
  const norm = normalizeImei(raw);
  if (!norm.canonical) {
    return { found: false, source: "imei-tac", parseNote: norm.luhnValid === false && raw ? "Could not parse a valid 15-digit IMEI — check sticker / OCR." : undefined };
  }
  const h = lookupImeiTacHint(norm.canonical);
  return {
    ...h,
    normalized: norm.canonical,
    repaired: norm.repaired,
    luhnValid: norm.luhnValid,
  };
}

module.exports = {
  lookupImeiTacHint,
  hintFromAnyImeiInput,
};
