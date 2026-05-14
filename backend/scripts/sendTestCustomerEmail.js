/**
 * Sends a sample customer-facing quote confirmation (same template as new quotes).
 * Usage: node scripts/sendTestCustomerEmail.js you@example.com
 * Loads backend/.env for SMTP and PUBLIC_SITE_URL.
 */
"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const { sendReceiptConfirmationEmail } = require("../lib/email");

const site = (process.env.PUBLIC_SITE_URL || "https://electroshack.ca").replace(/\/$/, "");
const to = process.argv[2] || process.env.TEST_CUSTOMER_EMAIL;

if (!to || !String(to).includes("@")) {
  console.error("Usage: node scripts/sendTestCustomerEmail.js recipient@example.com");
  process.exit(1);
}

sendReceiptConfirmationEmail({
  to: String(to).trim(),
  customerName: "Test Customer",
  receiptNumber: "ES-DEMO",
  trackUrl: `${site}/ticket`,
  priceEstimate: 89.99,
  items: [
    { description: "Screen replacement (parts + labour)", price: 79.99 },
    { description: "Tempered glass install", price: 10 },
  ],
})
  .then((r) => {
    console.log(JSON.stringify(r, null, 2));
    process.exit(r.sent ? 0 : 1);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
