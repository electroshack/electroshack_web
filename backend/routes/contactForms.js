const express = require("express");
const ContactForm = require("../models/ContactForm");
const { auth } = require("../middleware/auth");
const router = express.Router();

// PUBLIC: submit contact form
router.post("/", async (req, res) => {
  try {
    const { name, email, message } = req.body;
    if (!name || !email || !message) {
      return res.status(400).json({ error: "All fields are required." });
    }
    const form = new ContactForm({ name, email, message });
    await form.save();
    res.status(201).json({ message: "Message sent successfully!" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/", auth, async (req, res) => {
  try {
    const forms = await ContactForm.find().sort({ createdAt: -1 });
    res.json(forms);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/:id/read", auth, async (req, res) => {
  try {
    const form = await ContactForm.findByIdAndUpdate(
      req.params.id,
      { read: true },
      { new: true }
    );
    res.json(form);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/:id", auth, async (req, res) => {
  try {
    await ContactForm.findByIdAndDelete(req.params.id);
    res.json({ message: "Deleted." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
