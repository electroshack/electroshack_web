const express = require("express");
const { signUserToken } = require("../utils/jwtTokens");
const User = require("../models/User");
const { auth, superAdmin } = require("../middleware/auth");
const router = express.Router();

router.post("/login", async (req, res) => {
  try {
    const username = typeof req.body.username === "string" ? req.body.username.trim() : "";
    const password = req.body.password ?? "";
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required." });
    }

    const user = await User.findOne({ username });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ error: "Invalid credentials." });
    }

    const token = await signUserToken(user);

    res.json({ token, user: user.toJSON() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/me", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: "User not found." });
    res.json(user.toJSON());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/register", auth, superAdmin, async (req, res) => {
  try {
    const { username, password, role } = req.body;
    const user = new User({ username, password, role: role || "admin" });
    await user.save();
    res.status(201).json(user.toJSON());
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ error: "Username already exists." });
    }
    res.status(400).json({ error: err.message });
  }
});

router.get("/users", auth, superAdmin, async (req, res) => {
  try {
    const users = await User.find().sort({ username: 1 }).select("-password");
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/users/:id", auth, superAdmin, async (req, res) => {
  try {
    if (req.params.id === String(req.user.id)) {
      return res.status(400).json({ error: "You cannot delete your own account." });
    }
    const deleted = await User.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: "User not found." });
    res.json({ message: "User deleted." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/change-password", auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user.id);

    if (!(await user.comparePassword(currentPassword))) {
      return res.status(400).json({ error: "Current password is incorrect." });
    }

    user.password = newPassword;
    await user.save();
    res.json({ message: "Password changed successfully." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
