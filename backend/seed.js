require("dotenv").config();
const mongoose = require("mongoose");
const User = require("./models/User");

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/electroshack");
  console.log("Connected to MongoDB");

  const existing = await User.findOne({ username: "admin" });
  if (!existing) {
    const password = process.env.ADMIN_PASSWORD || "admin123";
    await User.create({
      username: "admin",
      password,
      role: "superadmin",
    });
    console.log(`Created default admin user (username: admin, password: ${password === "admin123" ? "admin123" : "(see ADMIN_PASSWORD)"})`);
    console.log("IMPORTANT: Change this password immediately in production!");
  } else {
    console.log("Admin user already exists.");
  }

  await mongoose.disconnect();
  console.log("Done.");
}

seed().catch(console.error);
