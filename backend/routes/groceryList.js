const express = require("express");
const GroceryItem = require("../models/GroceryItem");
const { auth } = require("../middleware/auth");
const { sendAdminGroceryNotification } = require("../lib/email");
const router = express.Router();

function notifyAsync(payload) {
  void sendAdminGroceryNotification(payload).catch((e) =>
    console.error("[grocery] admin notify failed:", e?.message || e)
  );
}

router.post("/", auth, async (req, res) => {
  try {
    const row = new GroceryItem(req.body);
    await row.save();
    notifyAsync({ action: "added", item: row.toObject(), actor: req.user?.username });
    res.status(201).json(row);
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
    notifyAsync({ action: "updated", item: item.toObject(), actor: req.user?.username });
    res.json(item);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete("/:id", auth, async (req, res) => {
  try {
    const item = await GroceryItem.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ error: "Not found." });
    notifyAsync({ action: "removed", item: item.toObject(), actor: req.user?.username });
    res.json({ message: "Deleted." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
