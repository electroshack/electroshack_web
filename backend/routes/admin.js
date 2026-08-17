const os = require("os");
const express = require("express");
const mongoose = require("mongoose");
const { auth, superAdmin } = require("../middleware/auth");
const OutboundSms = require("../models/OutboundSms");
const { retryFailedSms } = require("../lib/sms");
const router = express.Router();

// ### Local Mongo size budget (20 GiB default). Dashboard warns before the store PC disk fills.
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

// ## Per-collection bytes. Superadmin-only; names are internal.
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

router.get("/outbound-sms", auth, async (req, res) => {
  try {
    const items = await OutboundSms.find().sort({ createdAt: -1 }).limit(100);
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/outbound-sms/:id/retry", auth, async (req, res) => {
  try {
    const row = await OutboundSms.findById(req.params.id);
    if (!row) return res.status(404).json({ error: "SMS not found." });
    const saved = await retryFailedSms(row, req.user?.username);
    res.json(saved);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
