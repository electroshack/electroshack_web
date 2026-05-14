const express = require("express");
const GroceryItem = require("../models/GroceryItem");
const { auth } = require("../middleware/auth");
const { sendAdminGroceryNotification } = require("../lib/email");
const router = express.Router();

router.post("/", auth, async (req, res) => {
  try {
    const row = new GroceryItem(req.body);
    await row.save();
    let emailNotify = { sent: false, reason: "not-attempted" };
    try {
      emailNotify = await sendAdminGroceryNotification({
        action: "added",
        item: row.toObject(),
        actor: req.user?.username,
      });
    } catch (e) {
      emailNotify = { sent: false, reason: e?.message || String(e) };
      console.error("[grocery] admin notify crashed (POST):", emailNotify.reason);
    }
    if (!emailNotify?.sent) {
      console.warn("[grocery] admin notify skipped (POST):", emailNotify?.reason || emailNotify);
    }
    res.status(201).json({ ...row.toObject(), emailNotify });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get("/", auth, async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {};
    if (status) filter.status = status;
    const items = await GroceryItem.find(filter).sort({ createdAt: -1 });
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/:id", auth, async (req, res) => {
  try {
    const item = await GroceryItem.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!item) return res.status(404).json({ error: "Not found." });
    let emailNotify = { sent: false, reason: "not-attempted" };
    try {
      emailNotify = await sendAdminGroceryNotification({
        action: "updated",
        item: item.toObject(),
        actor: req.user?.username,
      });
    } catch (e) {
      emailNotify = { sent: false, reason: e?.message || String(e) };
      console.error("[grocery] admin notify crashed (PUT):", emailNotify.reason);
    }
    if (!emailNotify?.sent) {
      console.warn("[grocery] admin notify skipped (PUT):", emailNotify?.reason || emailNotify);
    }
    res.json({ ...item.toObject(), emailNotify });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete("/:id", auth, async (req, res) => {
  try {
    const item = await GroceryItem.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ error: "Not found." });
    let emailNotify = { sent: false, reason: "not-attempted" };
    try {
      emailNotify = await sendAdminGroceryNotification({
        action: "removed",
        item: item.toObject(),
        actor: req.user?.username,
      });
    } catch (e) {
      emailNotify = { sent: false, reason: e?.message || String(e) };
      console.error("[grocery] admin notify crashed (DELETE):", emailNotify.reason);
    }
    if (!emailNotify?.sent) {
      console.warn("[grocery] admin notify skipped (DELETE):", emailNotify?.reason || emailNotify);
    }
    res.json({ message: "Deleted.", emailNotify });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
