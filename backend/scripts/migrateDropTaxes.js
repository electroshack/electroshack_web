/**
 * Quotes-only migration:
 *   1. Drop the legacy `gst`, `pst`, and `finalPrice` fields from every receipt
 *      so tax data is no longer stored anywhere.
 *   2. For receipts that historically used the (taxed) `finalPrice` as the
 *      number to bill — and where `priceEstimate` was zero — fall back to the
 *      sum of line items so the customer-visible quote isn't suddenly empty.
 *
 * Idempotent. Safe to run repeatedly.
 *
 *   node backend/scripts/migrateDropTaxes.js
 */
require("dotenv").config({ path: require("path").resolve(__dirname, "..", ".env") });
const dns = require("dns");
if (process.env.DNS_SERVERS) {
  dns.setServers(process.env.DNS_SERVERS.split(",").map((s) => s.trim()).filter(Boolean));
}
const mongoose = require("mongoose");

(async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI not set");
    process.exit(1);
  }
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
  console.log("connected to", new URL(uri).host);

  const col = mongoose.connection.db.collection("receipts");

  const total = await col.countDocuments({});
  console.log("total receipts:", total);

  let backfilled = 0;
  const cursor = col.find({
    $and: [
      { $or: [{ priceEstimate: { $exists: false } }, { priceEstimate: 0 }, { priceEstimate: null }] },
      { items: { $exists: true, $type: "array", $ne: [] } },
    ],
  });
  while (await cursor.hasNext()) {
    const doc = await cursor.next();
    const sum = (doc.items || []).reduce((s, it) => s + (Number(it?.price) || 0), 0);
    if (sum > 0) {
      await col.updateOne({ _id: doc._id }, { $set: { priceEstimate: Math.round(sum * 100) / 100 } });
      backfilled += 1;
    }
  }
  console.log("backfilled priceEstimate from items on", backfilled, "receipts");

  const dropRes = await col.updateMany(
    { $or: [{ gst: { $exists: true } }, { pst: { $exists: true } }, { finalPrice: { $exists: true } }] },
    { $unset: { gst: "", pst: "", finalPrice: "" } }
  );
  console.log("dropped tax fields on", dropRes.modifiedCount, "receipts");

  await mongoose.disconnect();
  console.log("done");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
