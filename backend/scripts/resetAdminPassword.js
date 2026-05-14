/**
 * Reset username "admin" password to default (same as initial seed).
 * Usage: npm run reset-admin   (from backend/)
 * Requires MONGODB_URI in .env.
 */
require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../models/User");

const DEFAULT_USER = "admin";
const DEFAULT_PASS = "admin123";

async function connect() {
  let uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI is not set. Add it to backend/.env (e.g. mongodb://127.0.0.1:27017/electroshack)");
    process.exit(1);
  }
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
    console.log("Connected:", uri.replace(/\/\/([^:]+):([^@]+)@/, "//***:***@"));
  } catch (err) {
    console.error("Could not connect to MongoDB at MONGODB_URI.");
    console.error("Start MongoDB (Windows: Services → MongoDB), or fix the URI in backend/.env");
    console.error(err.message);
    console.error(
      "\nThis script does NOT use an in-memory database — a reset must run against your real database."
    );
    process.exit(1);
  }
}

async function main() {
  await connect();
  let user = await User.findOne({ username: DEFAULT_USER });
  if (!user) {
    user = await User.create({
      username: DEFAULT_USER,
      password: DEFAULT_PASS,
      role: "superadmin",
    });
    console.log(`Created user ${DEFAULT_USER} with password ${DEFAULT_PASS}`);
  } else {
    user.password = DEFAULT_PASS;
    await user.save();
    console.log(`Reset password for "${DEFAULT_USER}" to: ${DEFAULT_PASS}`);
  }
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
