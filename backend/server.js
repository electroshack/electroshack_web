require("dotenv").config();
const dns = require("dns");
if (process.env.DNS_SERVERS) {
  const list = process.env.DNS_SERVERS.split(",").map((s) => s.trim()).filter(Boolean);
  if (list.length) dns.setServers(list);
}
/**
 * Render's free tier has no outbound IPv6. Without this, anything that
 * resolves AAAA before A (e.g. `smtp.office365.com`) fails with ENETUNREACH.
 */
if (typeof dns.setDefaultResultOrder === "function") {
  dns.setDefaultResultOrder("ipv4first");
}
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const path = require("path");

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
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "frame-src": ["'self'", "https://www.google.com", "https://maps.google.com"],
        "img-src": ["'self'", "data:", "blob:", "https:"],
      },
    },
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

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    db: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
  });
});

app.use("/api/auth", require("./routes/auth"));
app.use("/api/receipts", require("./routes/receipts"));
app.use("/api/inventory", require("./routes/inventory"));
app.use("/api/contact-forms", require("./routes/contactForms"));
app.use("/api/grocery-list", require("./routes/groceryList"));
app.use("/api/metrics", require("./routes/metrics"));
app.use("/api/admin", require("./routes/admin"));

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong!" });
});

const clientBuildDir = path.join(__dirname, "..", "client", "build");
app.use(express.static(clientBuildDir));
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
  res.sendFile(path.join(clientBuildDir, "index.html"), (err) => {
    if (err) {
      res.json({ status: "Electroshack API is running", frontend: "not-built" });
    }
  });
});

async function startServer() {
  const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/electroshack";
  const { ensureDefaultAdmin } = require("./seedAdmin");

  function redact(u) {
    try { return new URL(u).host; } catch { return "(unparseable URI)"; }
  }
  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 8000,
      connectTimeoutMS: 8000,
      socketTimeoutMS: 30000,
    });
    console.log("Connected to MongoDB at", redact(uri));
    await ensureDefaultAdmin();
  } catch (err) {
    if (process.env.ALLOW_IN_MEMORY_DB === "true" || process.env.ALLOW_IN_MEMORY_DB === "1") {
      console.warn("[db] ALLOW_IN_MEMORY_DB is enabled. Data will be lost when the server stops.");
      const { MongoMemoryServer } = require("mongodb-memory-server");
      const mongod = await MongoMemoryServer.create();
      const memoryUri = mongod.getUri();
      await mongoose.connect(memoryUri);
      console.log("Connected to in-memory MongoDB at", memoryUri);
      await ensureDefaultAdmin();
    } else {
      console.error("[db] Could not connect to MongoDB at", redact(uri));
      console.error("[db] Start MongoDB locally, or set MONGODB_URI to the correct local server.");
      console.error("[db] Windows default: mongodb://127.0.0.1:27017/electroshack");
      console.error("[db] Refusing to start with an in-memory database because it can lose receipts.");
      console.error(err.message);
      process.exit(1);
    }
  }

  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer().catch(console.error);
