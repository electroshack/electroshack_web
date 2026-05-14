const crypto = require("crypto");
const Counter = require("../models/Counter");
const Receipt = require("../models/Receipt");

async function getNextSequential(counterId) {
  const counter = await Counter.findByIdAndUpdate(counterId, { $inc: { seq: 1 } }, { new: true, upsert: true }).lean();
  return counter.seq;
}

async function nextStandardReceiptNumber() {
  const year = new Date().getFullYear();
  const seq = await getNextSequential(`receipt-standard-${year}`);
  const n = String(seq).padStart(6, "0");
  return `ES-${year}-${n}`;
}

/** Next ES number if you saved now — does not increment (race possible if two users save at once). */
async function peekNextStandardReceiptNumber() {
  const year = new Date().getFullYear();
  const c = await Counter.findById(`receipt-standard-${year}`).lean();
  const nextSeq = (c?.seq || 0) + 1;
  return `ES-${year}-${String(nextSeq).padStart(6, "0")}`;
}

/**
 * Distinct namespace so legacy records never collide with standard ES-YYYY-###### numbers.
 */
async function generateLegacyReceiptNumber() {
  const year = new Date().getFullYear();
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const suffix = crypto.randomBytes(4).toString("hex").toUpperCase();
    const candidate = `LEG-${year}-${suffix}`;
    // eslint-disable-next-line no-await-in-loop
    const exists = await Receipt.findOne({ receiptNumber: candidate }).select("_id").lean();
    if (!exists) return candidate;
  }
  const seq = await getNextSequential(`receipt-legacy-fallback-${year}`);
  return `LEG-${year}-${String(seq).padStart(8, "0")}`;
}

module.exports = {
  nextStandardReceiptNumber,
  peekNextStandardReceiptNumber,
  generateLegacyReceiptNumber,
};