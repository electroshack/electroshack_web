/**
 * Comprehensive API smoke test.
 *
 * Exercises every customer + admin API endpoint against a running backend
 * (default: http://localhost:5000). Uses fetch — needs Node 18+.
 *
 * Usage:  node scripts/smokeTest.js
 */
const BASE = process.env.API_BASE || "http://localhost:5000";
const ADMIN_USER = process.env.ADMIN_USERNAME || "admin";
const ADMIN_PASS = process.env.ADMIN_PASSWORD || "admin123";

let passed = 0;
let failed = 0;
const failures = [];
let token = null;

function summarise(value) {
  try {
    return typeof value === "string" ? value.slice(0, 200) : JSON.stringify(value).slice(0, 200);
  } catch {
    return String(value).slice(0, 200);
  }
}

async function step(label, fn) {
  process.stdout.write(`▶ ${label}... `);
  try {
    const result = await fn();
    passed += 1;
    console.log("OK");
    return result;
  } catch (err) {
    failed += 1;
    const msg = err && err.message ? err.message : String(err);
    failures.push({ label, msg });
    console.log("FAIL");
    console.log(`   → ${msg}`);
    return null;
  }
}

async function api(method, path, { body, auth = true, expect = 200, raw = false } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth && token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body == null ? undefined : JSON.stringify(body),
  });
  const ok = Array.isArray(expect) ? expect.includes(res.status) : res.status === expect;
  const text = await res.text();
  if (!ok) {
    throw new Error(`[${method} ${path}] expected ${expect}, got ${res.status}: ${summarise(text)}`);
  }
  if (raw) return text;
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function main() {
  console.log(`Running smoke tests against ${BASE}\n`);

  await step("API root reachable", async () => {
    const r = await api("GET", "/", { auth: false });
    if (!r || !r.status) throw new Error("root did not return JSON");
  });

  await step("Login as admin", async () => {
    const r = await api("POST", "/api/auth/login", {
      auth: false,
      body: { username: ADMIN_USER, password: ADMIN_PASS },
    });
    if (!r.token) throw new Error("no token returned");
    token = r.token;
  });

  await step("/api/auth/me returns current user", async () => {
    const me = await api("GET", "/api/auth/me");
    if (me.username !== ADMIN_USER) throw new Error("unexpected username " + me.username);
  });

  let createdUserId = null;
  await step("Superadmin can create + delete admin user", async () => {
    const u = await api("POST", "/api/auth/register", {
      body: { username: "smoketest_admin", password: "Test12345!", role: "admin" },
      expect: [200, 201],
    });
    createdUserId = u._id || u.id;
    const list = await api("GET", "/api/auth/users");
    if (!Array.isArray(list)) throw new Error("users list not array");
    if (!list.some((x) => (x._id || x.id) === createdUserId))
      throw new Error("created user not in list");
    await api("DELETE", `/api/auth/users/${createdUserId}`);
  });

  let receiptId = null;
  let receiptNumber = null;
  await step("Preview new receipt number", async () => {
    const p = await api("GET", "/api/receipts/preview-new");
    if (!p.receiptNumber) throw new Error("no preview receipt number");
  });

  await step("Create receipt with line items", async () => {
    const r = await api("POST", "/api/receipts", {
      expect: 201,
      body: {
        customerName: "Smoke Customer",
        customerPhone: "905-555-0100",
        customerEmail: "smoke@example.com",
        customerAddress: "1 Test St",
        items: [
          { description: "iPhone screen replacement", category: "repair", price: 180 },
          { description: "Lightning cable", category: "cell-phone-accessory", price: 15 },
        ],
        priceEstimate: 195,
      },
    });
    if (r.priceEstimate !== 195) throw new Error("priceEstimate did not persist on POST");
    if (r.finalPrice != null) throw new Error("backend should no longer store finalPrice");
    if (r.gst != null || r.pst != null) throw new Error("backend should no longer store gst/pst");
    receiptId = r._id;
    receiptNumber = r.receiptNumber;
    if (!receiptNumber || !receiptId) throw new Error("missing receiptNumber/_id");
  });

  let secondReceiptNumber = null;
  await step("Create legacy receipt", async () => {
    const r = await api("POST", "/api/receipts", {
      expect: 201,
      body: {
        receiptKind: "legacy",
        legacyNote: "Paper receipt #5521 from 2018",
        customerName: "Legacy Customer",
        customerPhone: "905-555-9999",
        items: [{ description: "PC repair", category: "pc-repair", price: 80 }],
        priceEstimate: 80,
        date: new Date("2018-04-12T10:00:00Z").toISOString(),
        status: "completed",
      },
    });
    secondReceiptNumber = r.receiptNumber;
    if (!secondReceiptNumber) throw new Error("no legacy receipt number");
  });

  await step("List receipts (paginated)", async () => {
    const r = await api("GET", "/api/receipts?page=1&limit=5");
    if (typeof r.total !== "number") throw new Error("missing total");
  });

  await step("Filter receipts by legacy kind", async () => {
    const r = await api("GET", "/api/receipts?receiptKind=legacy");
    if (r.total < 1) throw new Error("expected at least one legacy receipt");
  });

  await step("Search receipts by customer name", async () => {
    const r = await api("GET", "/api/receipts?search=Smoke");
    if (r.total < 1) throw new Error("search returned no rows");
  });

  await step("Receipts stats endpoint", async () => {
    const r = await api("GET", "/api/receipts/stats");
    if (typeof r.totalReceipts !== "number") throw new Error("missing totalReceipts");
  });

  await step("Push status update on receipt", async () => {
    const r = await api("POST", `/api/receipts/${receiptId}/update`, {
      body: { status: "diagnosing", message: "Began diagnosis" },
    });
    if (r.status !== "diagnosing") throw new Error("status not updated");
  });

  await step("Update single line item status", async () => {
    const r = await api("GET", `/api/receipts/${receiptId}`);
    const itemId = r.items[0]._id;
    const after = await api("POST", `/api/receipts/${receiptId}/items/${itemId}/update`, {
      body: { status: "in-progress", message: "Ordered part" },
    });
    if (after.status !== "in-progress") throw new Error("aggregate status not in-progress");
  });

  await step("Send staff message", async () => {
    const r = await api("POST", `/api/receipts/${receiptId}/message`, {
      body: { message: "Your part should arrive tomorrow." },
    });
    if (!r.messages.some((m) => m.sender === "staff")) throw new Error("staff message missing");
  });

  await step("Update receipt (PUT)", async () => {
    const r = await api("PUT", `/api/receipts/${receiptId}`, {
      body: {
        customerName: "Smoke Customer (updated)",
        customerPhone: "905-555-0100",
        items: [
          { description: "iPhone screen replacement", category: "repair", price: 200, status: "in-progress" },
        ],
        priceEstimate: 200,
      },
    });
    if (r.customerName !== "Smoke Customer (updated)") throw new Error("PUT did not persist");
    if (r.priceEstimate !== 200) throw new Error("priceEstimate did not persist on PUT");
    if (r.finalPrice != null) throw new Error("backend should no longer store finalPrice on PUT");
  });

  await step("Customer ticket lookup (public)", async () => {
    const r = await api("GET", `/api/receipts/lookup/${encodeURIComponent(receiptNumber)}`, { auth: false });
    if (r.receiptNumber !== receiptNumber) throw new Error("wrong receipt returned");
  });

  await step("Customer can post a message (public)", async () => {
    await api("POST", `/api/receipts/lookup/${encodeURIComponent(receiptNumber)}/message`, {
      auth: false,
      body: { message: "Hi, any updates?" },
    });
  });

  await step("Customer lookup shows the customer message", async () => {
    const r = await api("GET", `/api/receipts/lookup/${encodeURIComponent(receiptNumber)}`, { auth: false });
    if (!r.messages.some((m) => m.sender === "customer")) throw new Error("missing customer message");
  });

  let inventoryId = null;
  let inventoryBarcode = null;
  await step("Create inventory item (storefront visible)", async () => {
    inventoryBarcode = "012345" + Math.floor(Math.random() * 1e6).toString().padStart(6, "0");
    const item = await api("POST", "/api/inventory", {
      expect: 201,
      body: {
        name: "Refurbished iPhone 13",
        description: "128GB, unlocked",
        category: "cell-phone",
        condition: "refurbished",
        sellingPrice: 549.99,
        costPrice: 380,
        quantity: 1,
        barcode: inventoryBarcode,
        imei: "356938035643809",
        showOnStorefront: true,
        boughtFrom: "Trade-in",
      },
    });
    inventoryId = item._id;
  });

  let secondInventoryId = null;
  await step("Create non-storefront inventory item", async () => {
    const item = await api("POST", "/api/inventory", {
      expect: 201,
      body: {
        name: "Internal repair part",
        description: "Spare logic board",
        category: "part",
        condition: "used",
        sellingPrice: 0,
        showOnStorefront: false,
      },
    });
    secondInventoryId = item._id;
  });

  await step("List inventory (paginated)", async () => {
    const r = await api("GET", "/api/inventory?page=1&limit=20");
    if (r.total < 2) throw new Error("expected at least 2 inventory items");
  });

  await step("Inventory stats", async () => {
    const r = await api("GET", "/api/inventory/stats");
    if (typeof r.totalItems !== "number") throw new Error("missing totalItems");
  });

  await step("Public storefront items only show storefront-visible", async () => {
    const r = await api("GET", "/api/inventory/storefront", { auth: false });
    if (!Array.isArray(r.items)) throw new Error("storefront items not array");
    if (!r.items.some((i) => i._id === inventoryId)) throw new Error("storefront missing visible item");
    if (r.items.some((i) => i._id === secondInventoryId)) throw new Error("storefront leaked hidden item");
  });

  await step("Public inventory check counts", async () => {
    const r = await api("GET", "/api/inventory/public-check", { auth: false });
    if (typeof r.totalItems !== "number") throw new Error("missing counts");
  });

  await step("Lookup inventory by barcode", async () => {
    const r = await api("GET", `/api/inventory/by-barcode/${inventoryBarcode}`);
    if (r._id !== inventoryId) throw new Error("wrong item returned");
  });

  await step("Update inventory item", async () => {
    const r = await api("PUT", `/api/inventory/${inventoryId}`, {
      body: {
        name: "Refurbished iPhone 13 (updated)",
        category: "cell-phone",
        sellingPrice: 599.99,
        quantity: 1,
        showOnStorefront: true,
      },
    });
    if (r.sellingPrice !== 599.99) throw new Error("PUT did not persist price");
  });

  await step("Sticker parser extracts IMEI", async () => {
    const r = await api("POST", "/api/inventory/parse-sticker", {
      body: { blob: "Apple iPhone 14 Pro Max\nIMEI: 356938 03 564380 9\nSerial: F2LN1ABCDE12" },
    });
    if (!r.imei) throw new Error("no IMEI extracted");
  });

  let groceryId = null;
  await step("Create grocery list item", async () => {
    const r = await api("POST", "/api/grocery-list", {
      expect: [200, 201],
      body: { title: "USB-C charger", notes: "65W brick", matchBarcode: "999000111222" },
    });
    groceryId = r._id;
    if (!groceryId) throw new Error("no _id returned");
  });

  await step("List grocery items", async () => {
    const r = await api("GET", "/api/grocery-list");
    if (!Array.isArray(r) && !Array.isArray(r.items)) throw new Error("unexpected shape");
  });

  await step("Update + delete grocery item", async () => {
    await api("PUT", `/api/grocery-list/${groceryId}`, { body: { status: "purchased" } });
    await api("DELETE", `/api/grocery-list/${groceryId}`);
  });

  let contactFormId = null;
  await step("Public contact form submission", async () => {
    const r = await api("POST", "/api/contact-forms", {
      auth: false,
      expect: [200, 201],
      body: {
        name: "Contact Tester",
        email: "ct@example.com",
        phone: "905-555-0001",
        message: "Hello, can you fix my Samsung S22?",
      },
    });
    contactFormId = r._id || r.id;
  });

  await step("List + mark read + delete contact submission", async () => {
    const list = await api("GET", "/api/contact-forms");
    const rows = Array.isArray(list) ? list : list.items;
    if (!rows || rows.length === 0) throw new Error("no contact rows");
    const id = contactFormId || rows[0]._id;
    await api("PATCH", `/api/contact-forms/${id}/read`);
    await api("DELETE", `/api/contact-forms/${id}`);
  });

  await step("Metrics summary", async () => {
    const today = new Date();
    const start = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const end = today.toISOString().slice(0, 10);
    const r = await api("GET", `/api/metrics?startDate=${start}&endDate=${end}`);
    if (typeof r !== "object") throw new Error("metrics not object");
  });

  await step("Metrics Excel export downloads", async () => {
    const today = new Date();
    const start = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const end = today.toISOString().slice(0, 10);
    const res = await fetch(
      `${BASE}/api/metrics/export.xlsx?startDate=${start}&endDate=${end}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (res.status !== 200) throw new Error(`expected 200, got ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 200) throw new Error("xlsx response suspiciously small");
    if (!(buf[0] === 0x50 && buf[1] === 0x4b)) throw new Error("xlsx not a zip");
  });

  await step("Delete created receipts + inventory items", async () => {
    await api("DELETE", `/api/receipts/${receiptId}`);
    const all = await api("GET", "/api/receipts?limit=100");
    const legacy = all.receipts.find((r) => r.receiptNumber === secondReceiptNumber);
    if (legacy) await api("DELETE", `/api/receipts/${legacy._id}`);
    await api("DELETE", `/api/inventory/${inventoryId}`);
    await api("DELETE", `/api/inventory/${secondInventoryId}`);
  });

  await step("Reject login with bad password", async () => {
    await api("POST", "/api/auth/login", {
      auth: false,
      expect: [400, 401],
      body: { username: ADMIN_USER, password: "definitely-wrong" },
    });
  });

  await step("Reject unauth access to /api/receipts", async () => {
    await api("GET", "/api/receipts", { auth: false, expect: 401 });
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log("\nFailures:");
    for (const f of failures) console.log(`  - ${f.label}: ${f.msg}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Smoke test crashed:", err);
  process.exit(1);
});
