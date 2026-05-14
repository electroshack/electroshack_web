const User = require("./models/User");

async function ensureDefaultAdmin() {
  const defaultPass = process.env.ADMIN_PASSWORD || "admin123";
  const forceReset =
    process.env.RESET_ADMIN_PASSWORD === "true" || process.env.RESET_ADMIN_PASSWORD === "1";

  const existing = await User.findOne({ username: "admin" });
  if (!existing) {
    await User.create({
      username: "admin",
      password: defaultPass,
      role: "superadmin",
    });
    console.log(`Created default admin (username: admin, password: ${defaultPass === "admin123" ? "admin123" : "(see ADMIN_PASSWORD)"})`);
    return;
  }

  if (forceReset) {
    existing.password = defaultPass;
    await existing.save();
    console.log(
      "RESET_ADMIN_PASSWORD was set: admin password updated. Remove RESET_ADMIN_PASSWORD from .env and restart."
    );
  }
}

module.exports = { ensureDefaultAdmin };
