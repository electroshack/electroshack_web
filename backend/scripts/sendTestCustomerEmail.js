/**
 * Sends one or more sample emails using the production templates so you can
 * preview them in your inbox.
 *
 *   node scripts/sendTestCustomerEmail.js you@example.com           # all samples
 *   node scripts/sendTestCustomerEmail.js you@example.com quote     # one type
 *
 * Types: quote | update | stock | grocery | all (default)
 *
 * Loads backend/.env for SMTP, PUBLIC_SITE_URL, ADMIN_EMAIL, etc.
 */
"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const {
  sendReceiptConfirmationEmail,
  sendReceiptUpdateEmail,
  sendStockNotificationEmail,
  sendAdminGroceryNotification,
} = require("../lib/email");

const site = (process.env.PUBLIC_SITE_URL || "https://electroshack.ca").replace(/\/$/, "");
const to = (process.argv[2] || process.env.TEST_CUSTOMER_EMAIL || "").trim();
const which = (process.argv[3] || "all").trim().toLowerCase();

if (!to || !to.includes("@")) {
  console.error("Usage: node scripts/sendTestCustomerEmail.js recipient@example.com [quote|update|stock|grocery|all]");
  process.exit(1);
}

const trackUrl = `${site}/ticket`;

const samples = {
  quote: () =>
    sendReceiptConfirmationEmail({
      to,
      customerName: "Test Customer",
      receiptNumber: "ES-DEMO-1001",
      trackUrl,
      priceEstimate: 89.99,
      items: [
        { description: "Screen replacement (parts + labour)", price: 79.99 },
        { description: "Tempered glass install", price: 10 },
      ],
    }),
  update: () =>
    sendReceiptUpdateEmail({
      to,
      customerName: "Test Customer",
      receiptNumber: "ES-DEMO-1001",
      status: "ready-for-pickup",
      message: "All done — your phone is tested and waiting at the counter. Bring this email or your ID for pickup.",
      trackUrl,
      priceEstimate: 89.99,
    }),
  stock: () =>
    sendStockNotificationEmail({
      to,
      customerName: "Test Customer",
      itemTitle: "USB-C 65W charger",
      productName: "Anker 715 65W USB-C Charger",
      barcode: "194644092474",
    }),
  // Admin notification — always goes to ADMIN_EMAIL from env (not `to`),
  // but we still trigger it so you receive it on the same inbox if that's
  // the configured admin address.
  grocery: () =>
    sendAdminGroceryNotification({
      action: "added",
      actor: "admin",
      item: {
        title: "USB-C charger",
        notes: "65W brick",
        matchBarcode: "999000111222",
        matchItemNumber: "ITM-204",
        status: "pending",
        customerRequest: { email: to },
      },
      matchedInventory: null,
    }),
};

async function run() {
  const list = which === "all" ? Object.keys(samples) : [which];
  for (const key of list) {
    if (!samples[key]) {
      console.error(`Unknown sample "${key}". Choose one of: ${Object.keys(samples).join(", ")}, all.`);
      process.exitCode = 1;
      continue;
    }
    process.stdout.write(`-> sending sample "${key}" ... `);
    try {
      const r = await samples[key]();
      console.log(JSON.stringify(r));
      if (!r.sent) process.exitCode = 1;
    } catch (e) {
      console.log("FAILED");
      console.error(e?.message || e);
      process.exitCode = 1;
    }
  }
}

run();
