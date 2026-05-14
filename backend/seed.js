require("dotenv").config();
const mongoose = require("mongoose");
const User = require("./models/User");

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to MongoDB");

  const existing = await User.findOne({ username: "admin" });
  if (!existing) {
    await User.create({
      username: "admin",
      password: "admin123",
      role: "superadmin",
    });
    console.log("Created default admin user (username: admin, password: admin123)");
    console.log("IMPORTANT: Change this password immediately in production!");
  } else {
    console.log("Admin user already exists.");
  }

  await mongoose.disconnect();
  console.log("Done.");
}

seed().catch(console.error);
