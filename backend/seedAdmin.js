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
  } else if (forceReset) {
    existing.password = defaultPass;
    await existing.save();
    console.log(
      "RESET_ADMIN_PASSWORD was set: admin password updated. Remove RESET_ADMIN_PASSWORD from .env and restart."
    );
  }

  await ensureDemoInventory();
}

async function ensureDemoInventory() {
  const enabled =
    process.env.SEED_DEMO_INVENTORY === "true" ||
    process.env.SEED_DEMO_INVENTORY === "1" ||
    process.env.ALLOW_IN_MEMORY_DB === "true" ||
    process.env.ALLOW_IN_MEMORY_DB === "1";
  if (!enabled) return;
  const Inventory = require("./models/Inventory");
  const { applyChange } = require("./lib/stock");
  const count = await Inventory.countDocuments();
  if (count > 0) return;

  const samples = [
    { itemNumber: "10001", name: "iPhone 17 Pro Max", category: "cell-phone", condition: "refurbished", sellingPrice: 1299, costPrice: 900, quantity: 2, status: "in-stock", showOnStorefront: true, description: "256GB, unlocked, battery 92%." },
    { itemNumber: "10002", name: "iPhone 17 Pro", category: "cell-phone", condition: "used", sellingPrice: 1099, costPrice: 750, quantity: 1, status: "in-stock", showOnStorefront: true, imei: "356938035643809", description: "128GB, natural titanium." },
    { itemNumber: "10003", name: "iPhone 17", category: "cell-phone", condition: "used", sellingPrice: 799, costPrice: 520, quantity: 3, status: "in-stock", showOnStorefront: true, description: "128GB, blue." },
    { itemNumber: "10004", name: "USB-C 65W fast charger", category: "accessory", condition: "new", sellingPrice: 39.99, costPrice: 12, quantity: 8, status: "in-stock", showOnStorefront: true },
    { itemNumber: "10005", name: "Tempered glass screen protector", category: "accessory", condition: "new", sellingPrice: 19.99, costPrice: 3, quantity: 12, status: "in-stock", showOnStorefront: true },
    { itemNumber: "10006", name: "Google Pixel 9 Pro", category: "cell-phone", condition: "used", sellingPrice: 749, costPrice: 480, quantity: 1, status: "in-stock", showOnStorefront: true },
    { itemNumber: "10007", name: "MacBook Air 15-inch (M3)", category: "laptop", condition: "refurbished", sellingPrice: 1399, costPrice: 980, quantity: 0, status: "out-of-stock", showOnStorefront: false, soldTo: "Walk-in", dateSold: new Date(), saleReceiptNumber: "ES-2026-000001" },
    { itemNumber: "10008", name: "iPad (10th generation)", category: "tablet", condition: "used", sellingPrice: 429, costPrice: 280, quantity: 2, status: "in-stock", showOnStorefront: true },
  ];
  const created = await Inventory.insertMany(samples);

  const glass = created.find((i) => i.name.startsWith("Tempered"));
  const pixel = created.find((i) => i.name.includes("Pixel"));
  const charger = created.find((i) => i.name.includes("USB-C 65W"));
  const phone = created.find((i) => i.name === "iPhone 17 Pro Max");
  if (glass) {
    glass.showOnStorefrontWhenEmpty = true;
    await applyChange({ item: glass, newQuantity: 0, reason: "sale", actor: "demo", extra: { saleQty: 12 } });
  }
  if (pixel) {
    await applyChange({ item: pixel, newQuantity: 0, reason: "sale", actor: "demo", extra: { saleQty: 1 } });
  }

  const Receipt = require("./models/Receipt");
  const { nextStandardReceiptNumber } = require("./utils/receiptNumbers");
  const quote = new Receipt({
    receiptNumber: await nextStandardReceiptNumber(),
    receiptKind: "standard",
    customerName: "Demo Customer",
    customerPhone: "905-555-0100",
    customerEmail: "demo@electroshack.ca",
    salesperson: "admin",
    status: "in-progress",
    items: [
      {
        description: phone ? phone.name : "iPhone 17 Pro Max",
        category: "cell-phone-purchase",
        price: phone ? phone.sellingPrice : 1299,
        status: "in-progress",
        inventoryItemId: phone ? phone._id : null,
        stockQty: 1,
        notes: "Linked stock — paying this quote decrements qty",
      },
      {
        description: charger ? charger.name : "USB-C 65W fast charger",
        category: "cell-phone-accessory",
        price: charger ? charger.sellingPrice : 39.99,
        status: "in-progress",
        inventoryItemId: charger ? charger._id : null,
        stockQty: 1,
      },
      {
        description: "Screen repair (unlinked — does not touch stock)",
        category: "repair",
        price: 89,
        status: "in-progress",
      },
    ],
    priceEstimate: (phone ? phone.sellingPrice : 1299) + (charger ? charger.sellingPrice : 39.99) + 89,
    notes: "Demo quote for POS: send amount / mark cash paid to pull linked stock.",
  });
  quote.addAuditEvent("created", "demo", "seed");
  await quote.save();
  console.log(`Seeded demo inventory and quote ${quote.receiptNumber}.`);
}

module.exports = { ensureDefaultAdmin, ensureDemoInventory };

