/**
 * Local preview server for the email templates.
 *
 *   node scripts/previewEmails.js [port]
 *
 * Open http://localhost:5050/?template=quote  (or update | stock | grocery)
 * to see exactly what each rendered email looks like in a browser.
 *
 * Uses the same `brandedShell` + per-template builders as production, so the
 * preview is byte-identical to what Resend actually delivers.
 */
"use strict";

const path = require("path");
const http = require("http");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const PORT = parseInt(process.argv[2] || process.env.PREVIEW_PORT || "5050", 10);

const trackUrl = `${(process.env.PUBLIC_SITE_URL || "https://electroshack.ca").replace(/\/$/, "")}/ticket`;

function fakeQuote() {
  return {
    customerName: "Yaani Khan",
    receiptNumber: "ES-2026-000123",
    trackUrl,
    priceEstimate: 214.99,
    items: [
      { description: "iPhone 14 screen replacement (parts + labour)", price: 199.99 },
      { description: "Tempered glass install", price: 15 },
    ],
  };
}

function fakeUpdate() {
  return {
    customerName: "Yaani Khan",
    receiptNumber: "ES-2026-000123",
    status: "ready-for-pickup",
    message: "All done — your phone is tested and waiting at the counter. Please bring photo ID for pickup.",
    trackUrl,
    priceEstimate: 214.99,
  };
}

function fakeStock() {
  return {
    customerName: "Yaani Khan",
    itemTitle: "USB-C 65W charger",
    productName: "Anker 715 65W USB-C Charger",
    barcode: "194644092474",
  };
}

function fakeGrocery() {
  return {
    action: "added",
    actor: "admin",
    item: {
      title: "USB-C 65W charger",
      notes: "Anker 715 preferred — for shop stock",
      matchBarcode: "194644092474",
      matchItemNumber: "ITM-204",
      status: "pending",
      customerRequest: { email: "khanayaani@hotmail.com" },
    },
    matchedInventory: null,
  };
}

function renderHtmlForTemplate(name) {
  const email = require("../lib/email");
  if (name === "quote") return email.buildReceiptConfirmationHtml(fakeQuote());
  if (name === "update") return email.buildReceiptUpdateHtml(fakeUpdate());
  if (name === "stock") return email.buildStockNotificationHtml(fakeStock());
  if (name === "grocery") return email.buildAdminGroceryHtml(fakeGrocery());
  throw new Error(`Unknown template: ${name}`);
}

const TEMPLATES = ["quote", "update", "stock", "grocery"];

function pageShell(body) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Email previews</title>
<style>
  body { margin:0; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background:#0f172a; color:#e2e8f0; padding:24px; }
  h1 { margin:0 0 8px; font-weight:800; }
  p  { color:#94a3b8; }
  nav a { display:inline-block; margin:8px 12px 8px 0; padding:8px 14px; background:#1e293b; color:#e2e8f0; border-radius:8px; text-decoration:none; }
  nav a.active { background:#0284c7; }
  iframe { width:100%; border:0; background:#eef2f7; border-radius:12px; box-shadow:0 10px 30px rgba(0,0,0,0.45); }
</style></head><body>${body}</body></html>`;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    if (url.pathname === "/health") {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("ok");
      return;
    }
    if (url.pathname === "/raw") {
      const name = url.searchParams.get("t") || "quote";
      const html = renderHtmlForTemplate(name);
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(html);
      return;
    }
    // index / preview shell with iframe of selected template
    const name = url.searchParams.get("template") || "quote";
    const nav = TEMPLATES.map((t) => `<a href="?template=${t}" class="${t === name ? "active" : ""}">${t}</a>`).join("");
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(
      pageShell(`
        <h1>Electroshack email preview</h1>
        <p>Open this page at the viewport width you want to verify. Use the <code>/raw?t=${name}</code> URL for a clean iframe-less render.</p>
        <nav>${nav}</nav>
        <iframe src="/raw?t=${name}" style="height:1400px;"></iframe>
      `)
    );
  } catch (e) {
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end(`error: ${e?.message || e}`);
  }
});

server.listen(PORT, () => {
  console.log(`[preview] http://localhost:${PORT}/?template=quote   (templates: ${TEMPLATES.join(", ")})`);
});
