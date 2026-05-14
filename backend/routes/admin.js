const express = require("express");
const mongoose = require("mongoose");
const { auth, superAdmin } = require("../middleware/auth");
const router = express.Router();

/**
 * MongoDB Atlas free M0 cluster cap is 512 MiB. Atlas surfaces this through
 * `dbStats()` (`storageSize` + `indexSize` for the data we control). We expose
 * it so the admin dashboard can warn before the database fills up.
 */
const FREE_TIER_CAP_BYTES = 512 * 1024 * 1024;

router.get("/storage-stats", auth, async (req, res) => {
  try {
    const stats = await mongoose.connection.db.stats({ scale: 1 });
    const dataBytes = Number(stats.dataSize || 0);
    const storageBytes = Number(stats.storageSize || 0);
    const indexBytes = Number(stats.indexSize || 0);
    const totalBytes = storageBytes + indexBytes;
    const cap = Number(process.env.MONGODB_CAP_BYTES) || FREE_TIER_CAP_BYTES;
    const usedPct = Math.min(100, (totalBytes / cap) * 100);

    let level = "ok";
    if (usedPct >= 90) level = "critical";
    else if (usedPct >= 70) level = "warning";

    res.json({
      cap: cap,
      capLabel: cap === 512 * 1024 * 1024 ? "Atlas Free M0 (512 MiB)" : "Custom cap",
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

module.exports = router;
