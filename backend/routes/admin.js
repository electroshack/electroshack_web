const os = require("os");
const express = require("express");
const mongoose = require("mongoose");
const { auth, superAdmin } = require("../middleware/auth");
const router = express.Router();

/**
 * Local MongoDB is limited by disk, not Atlas. Default budget is 20 GiB so the
 * dashboard widget warns before the store PC disk fills with photos/receipts.
 * Override with MONGODB_CAP_BYTES.
 */
const DEFAULT_CAP_BYTES = 20 * 1024 * 1024 * 1024;

function lanAddresses() {
  const nets = os.networkInterfaces();
  const out = [];
  for (const list of Object.values(nets)) {
    for (const net of list || []) {
      if (net.family !== "IPv4" && net.family !== 4) continue;
      if (net.internal) continue;
      out.push(net.address);
    }
  }
  return out;
}

router.get("/storage-stats", auth, async (req, res) => {
  try {
    const stats = await mongoose.connection.db.stats({ scale: 1 });
    const dataBytes = Number(stats.dataSize || 0);
    const storageBytes = Number(stats.storageSize || 0);
    const indexBytes = Number(stats.indexSize || 0);
    const totalBytes = storageBytes + indexBytes;
    const cap = Number(process.env.MONGODB_CAP_BYTES) || DEFAULT_CAP_BYTES;
    const usedPct = Math.min(100, (totalBytes / cap) * 100);

    let level = "ok";
    if (usedPct >= 90) level = "critical";
    else if (usedPct >= 70) level = "warning";

    res.json({
      cap: cap,
      capLabel: cap === DEFAULT_CAP_BYTES ? "Local MongoDB (20 GiB budget)" : "Custom local cap",
      dataSize: dataBytes,
      storageSize: storageBytes,
      indexSize: indexBytes,
      totalBytes,
      usedPct,
      level,
      collections: stats.collections,
      objects: stats.objects,
      avgObjSize: stats.avgObjSize,
      indexes: stats.indexes,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Higher-resolution per-collection breakdown — useful when usage spikes and we
 * need to know whether to prune old quotes vs. compress inventory photos.
 * Superadmin-only since it surfaces internal collection names.
 */
router.get("/storage-stats/by-collection", auth, superAdmin, async (req, res) => {
  try {
    const collections = await mongoose.connection.db.listCollections().toArray();
    const rows = [];
    for (const c of collections) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const s = await mongoose.connection.db.collection(c.name).stats({ scale: 1 });
        rows.push({
          name: c.name,
          count: s.count || 0,
          storageBytes: s.storageSize || 0,
          indexBytes: s.totalIndexSize || 0,
          avgObjBytes: s.avgObjSize || 0,
        });
      } catch (e) {
        rows.push({ name: c.name, error: e.message });
      }
    }
    rows.sort((a, b) => (b.storageBytes || 0) - (a.storageBytes || 0));
    res.json({ collections: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/reachability", auth, (req, res) => {
  const port = process.env.PORT || 5000;
  const publicSiteUrl = (process.env.PUBLIC_SITE_URL || "").replace(/\/$/, "");
  const lan = lanAddresses();
  const worldwide = Boolean(publicSiteUrl && /^https:\/\//i.test(publicSiteUrl) && !/localhost|127\.0\.0\.1/i.test(publicSiteUrl));
  res.json({
    publicSiteUrl: publicSiteUrl || `http://localhost:${port}`,
    worldwide,
    localUrl: `http://localhost:${port}`,
    lanUrls: lan.map((ip) => `http://${ip}:${port}`),
  });
});

module.exports = router;
