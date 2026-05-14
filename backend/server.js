require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");

const app = express();

// Needed when clients send X-Forwarded-For (CRA dev proxy, nginx, load balancers).
// express-rate-limit validates this; default one hop — override with TRUST_PROXY in .env.
const trustProxy = process.env.TRUST_PROXY;
if (trustProxy === "false" || trustProxy === "0") {
  app.set("trust proxy", false);
} else if (trustProxy === "true") {
  app.set("trust proxy", true);
} else {
  const n = trustProxy != null && trustProxy !== "" ? Number(trustProxy) : 1;
  app.set("trust proxy", Number.isFinite(n) && n >= 0 ? n : 1);
}

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
app.use(express.json({ limit: "10mb" }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { error: "Too many requests, please try again later." },
});
app.use("/api/", limiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: { error: "Too many login attempts, please try again later." },
});
app.use("/api/auth/login", authLimiter);

app.get("/", (req, res) => {
  res.json({ status: "Electroshack API is running" });
});

app.use("/api/auth", require("./routes/auth"));
app.use("/api/receipts", require("./routes/receipts"));
app.use("/api/inventory", require("./routes/inventory"));
app.use("/api/contact-forms", require("./routes/contactForms"));
app.use("/api/grocery-list", require("./routes/groceryList"));
app.use("/api/metrics", require("./routes/metrics"));

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong!" });
});

async function startServer() {
  let uri = process.env.MONGODB_URI;
  const { ensureDefaultAdmin } = require("./seedAdmin");

  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    console.log("Connected to MongoDB at", uri);
    await ensureDefaultAdmin();
  } catch (err) {
    console.log("Local MongoDB not available, starting in-memory database...");
    const { MongoMemoryServer } = require("mongodb-memory-server");
    const mongod = await MongoMemoryServer.create();
    uri = mongod.getUri();
    await mongoose.connect(uri);
    console.log("Connected to in-memory MongoDB at", uri);
    console.log(
      "NOTE: Data (including users) is lost when the server stops. For persistent login, install/start MongoDB and set MONGODB_URI."
    );
    await ensureDefaultAdmin();
    console.log("Default admin: username admin / password from ADMIN_PASSWORD or admin123");
  }

  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer().catch(console.error);
