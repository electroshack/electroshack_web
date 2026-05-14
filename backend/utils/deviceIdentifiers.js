/**
 * IMEI (Luhn), serial normalization, sticker parsing, damaged-code lookup variants.
 */

function digitsOnly(s) {
  return String(s || "").replace(/\D/g, "");
}

function luhnValid(digits) {
  if (!digits || digits.length < 2) return false;
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = parseInt(digits[i], 10);
    if (Number.isNaN(n)) return false;
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

function luhnFixCheckDigit(d14) {
  if (d14.length !== 14) return null;
  for (let check = 0; check <= 9; check++) {
    const candidate = d14 + String(check);
    if (luhnValid(candidate)) return candidate;
  }
  return null;
}

function imeiDigitRepairVariants(digitStr, opts) {
  opts = opts || {};
  const maxOut = opts.maxOut != null ? opts.maxOut : 48;
  const out = new Set();
  if (!digitStr) return [];
  const tryAdd = function (s) {
    if (s.length === 15 && luhnValid(s)) out.add(s);
  };
  tryAdd(digitStr);
  if (digitStr.length === 15) {
    const fixed = luhnFixCheckDigit(digitStr.slice(0, 14));
    if (fixed) out.add(fixed);
    for (let pos = 11; pos < 15; pos++) {
      for (let d = 0; d <= 9; d++) {
        if (String(d) === digitStr[pos]) continue;
        const next = digitStr.slice(0, pos) + String(d) + digitStr.slice(pos + 1);
        tryAdd(next);
        if (out.size >= maxOut) return Array.from(out).slice(0, maxOut);
      }
    }
  }
  if (digitStr.length === 14) {
    const fixed = luhnFixCheckDigit(digitStr);
    if (fixed) out.add(fixed);
  }
  return Array.from(out).slice(0, maxOut);
}

function extractImeiCandidates(raw) {
  const text = String(raw || "");
  const candidates = [];
  const re = /\d{14,15}/g;
  let m;
  while ((m = re.exec(text)) !== null) candidates.push(m[0]);
  const allDigits = digitsOnly(text);
  if (allDigits.length >= 15) {
    for (let i = 0; i <= allDigits.length - 15; i++) {
      candidates.push(allDigits.slice(i, i + 15));
    }
  }
  return candidates;
}

function normalizeImei(raw) {
  var empty = { canonical: "", luhnValid: false, repaired: false, candidates: [] };
  if (raw == null || raw === "") return empty;
  const direct = digitsOnly(raw);
  const pool = new Set();
  if (direct.length >= 14) {
    pool.add(direct);
    extractImeiCandidates(raw).forEach(function (d) { pool.add(d); });
  }
  const ordered = Array.from(pool);
  for (let i = 0; i < ordered.length; i++) {
    const d = ordered[i];
    if (d.length === 15 && luhnValid(d)) {
      return { canonical: d, luhnValid: true, repaired: false, candidates: [d] };
    }
  }
  for (let i = 0; i < ordered.length; i++) {
    const d = ordered[i];
    if (d.length === 14) {
      const fixed = luhnFixCheckDigit(d);
      if (fixed) return { canonical: fixed, luhnValid: true, repaired: true, candidates: [fixed] };
    }
  }
  if (direct.length === 15) {
    return {
      canonical: direct,
      luhnValid: luhnValid(direct),
      repaired: false,
      candidates: imeiDigitRepairVariants(direct, { maxOut: 12 }),
    };
  }
  return empty;
}

function imeiLookupVariants(canonical15) {
  const d = digitsOnly(canonical15);
  if (d.length !== 15) return [];
  const variants = new Set([d, String(canonical15).trim()]);
  imeiDigitRepairVariants(d, { maxOut: 40 }).forEach(function (v) { variants.add(v); });
  return Array.from(variants).filter(Boolean);
}

function normalizeSerial(raw) {
  let s = String(raw || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  if (s.length > 64) s = s.slice(0, 64);
  return s;
}

function serialLookupVariants(canonical) {
  const s = normalizeSerial(canonical);
  if (!s) return [];
  const out = new Set([s]);
  if (s.length <= 20) {
    const chars = s.split("");
    const from = Math.max(0, chars.length - 6);
    for (let i = from; i < chars.length; i++) {
      const c = chars[i];
      if (c === "0") {
        const t = chars.slice();
        t[i] = "O";
        out.add(t.join(""));
      }
      if (c === "O") {
        const t = chars.slice();
        t[i] = "0";
        out.add(t.join(""));
      }
      if (c === "1") {
        const t = chars.slice();
        t[i] = "I";
        out.add(t.join(""));
      }
      if (c === "I") {
        const t = chars.slice();
        t[i] = "1";
        out.add(t.join(""));
      }
    }
  }
  return Array.from(out).slice(0, 36);
}

function extractStickerFields(blob) {
  const text = String(blob || "").replace(/\r/g, "\n");
  const imeis = [];
  const serials = [];
  const imeiLabel = /(?:IMEI\s*(?:1|2)?|MEID)\s*[:\s-]*([0-9\s]{14,18})/gi;
  let m;
  while ((m = imeiLabel.exec(text)) !== null) {
    const norm = normalizeImei(m[1]);
    if (norm.canonical) imeis.push(norm.canonical);
  }
  const serialLabel = /(?:Serial(?:\s*No\.?)?|S\/N|S\.N\.|SN)\s*[:\s#]*([A-Z0-9\s-]{4,24})/gi;
  while ((m = serialLabel.exec(text)) !== null) {
    const sn = normalizeSerial(m[1]);
    if (sn.length >= 4) serials.push(sn);
  }
  const appleSn = /\b([A-Z]{1,3}\d{6,10}[A-Z0-9]{0,4})\b/g;
  while ((m = appleSn.exec(text)) !== null) {
    const sn = normalizeSerial(m[1]);
    if (sn.length >= 10 && sn.length <= 14) serials.push(sn);
  }
  const runs = extractImeiCandidates(text);
  for (let i = 0; i < runs.length; i++) {
    const n = normalizeImei(runs[i]);
    if (n.canonical && n.luhnValid) imeis.push(n.canonical);
  }
  return { imei: imeis[0] || "", imei2: imeis[1] || "", serial: serials[0] || "" };
}

module.exports = {
  digitsOnly,
  luhnValid,
  normalizeImei,
  extractImeiCandidates,
  imeiLookupVariants,
  normalizeSerial,
  serialLookupVariants,
  extractStickerFields,
  imeiDigitRepairVariants,
};
