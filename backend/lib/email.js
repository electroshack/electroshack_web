const nodemailer = require("nodemailer");

function escapeHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtMoney(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  return `$${v.toFixed(2)}`;
}

let transporterPromise;

function getTransporter() {
  if (transporterPromise) return transporterPromise;
  const host = process.env.SMTP_HOST || process.env.EMAIL_HOST;
  const port = parseInt(process.env.SMTP_PORT || process.env.EMAIL_PORT || "587", 10);
  const user = process.env.SMTP_USER || process.env.EMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.EMAIL_PASS;
  const secure = process.env.SMTP_SECURE === "true" || port === 465;

  if (!host || !user) {
    transporterPromise = Promise.resolve(null);
    return transporterPromise;
  }

  transporterPromise = Promise.resolve(
    nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
      requireTLS: !secure,
    })
  );
  return transporterPromise;
}

function fromAddress() {
  return (
    process.env.SMTP_FROM ||
    process.env.EMAIL_FROM ||
    process.env.SMTP_USER ||
    process.env.EMAIL_USER ||
    "noreply@electroshack.local"
  );
}

function publicSiteUrl() {
  return (process.env.PUBLIC_SITE_URL || process.env.FRONTEND_URL || "https://electroshack.ca").replace(/\/$/, "");
}

/**
 * Same wide hero mark as the website navbar (`hero_logo2.png`), exposed at a
 * stable URL on the static host for email clients. Override with EMAIL_LOGO_URL.
 */
function logoUrl() {
  return process.env.EMAIL_LOGO_URL || `${publicSiteUrl()}/email-hero-logo.png`;
}

function adminEmail() {
  return (process.env.ADMIN_EMAIL || process.env.SMTP_USER || process.env.EMAIL_USER || "").trim();
}

function storeName() {
  return process.env.STORE_NAME || "Electroshack";
}

/**
 * Wraps inner HTML in the brand chrome (centered hero logo + headline, footer).
 * Uses inline styles only — most mail clients strip <style> blocks.
 * Logo + title share one table row so there is no large blank strip between them
 * and the white body (a common complaint with stacked header rows).
 */
function brandedShell({ headlineHtml, headlineSubHtml = "", innerHtml, ctaHtml = "", footerNote = "" }) {
  const shop = storeName();
  const site = publicSiteUrl();
  const logo = logoUrl();
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1" /><title>${escapeHtml(shop)}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:20px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 8px 28px rgba(15,23,42,0.06);">
          <!-- Centered hero logo + headline (single block, no spacer row) -->
          <tr>
            <td style="background:linear-gradient(180deg,#0f172a 0%,#0c4a6e 55%,#0369a1 100%);padding:14px 24px 16px;text-align:center;">
              <img src="${escapeHtml(logo)}" alt="${escapeHtml(shop)}" width="280" style="display:block;margin:0 auto;max-width:92%;width:280px;height:auto;border:0;outline:none;text-decoration:none;" />
              <h1 style="margin:10px 0 0;padding:0;font-size:20px;font-weight:800;letter-spacing:-0.02em;line-height:1.25;color:#ffffff;">${headlineHtml}</h1>
              ${headlineSubHtml ? `<p style="margin:6px 0 0;padding:0;font-size:14px;line-height:1.45;color:rgba(255,255,255,0.92);">${headlineSubHtml}</p>` : ""}
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:16px 24px 10px;">${innerHtml}</td>
          </tr>
          ${ctaHtml ? `<tr><td align="center" style="padding:8px 28px 24px;">${ctaHtml}</td></tr>` : ""}
          <!-- Footer -->
          <tr>
            <td style="padding:18px 28px 22px;border-top:1px solid #f1f5f9;background:#f8fafc;text-align:center;font-size:12px;color:#64748b;line-height:1.6;">
              ${footerNote ? `<p style="margin:0 0 8px;color:#475569;">${footerNote}</p>` : ""}
              <p style="margin:0 0 4px;font-weight:600;color:#0f172a;">${escapeHtml(shop)}</p>
              <p style="margin:0;">9600 Islington Ave, Woodbridge, ON L4H 2T1 &middot; <a href="tel:9058931613" style="color:#0284c7;text-decoration:none;">(905) 893-1613</a></p>
              <p style="margin:8px 0 0;"><a href="${escapeHtml(site)}" style="color:#0284c7;text-decoration:none;">${escapeHtml(site.replace(/^https?:\/\//, ""))}</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function ctaButton({ href, label, color = "#22c55e" }) {
  return `<a href="${escapeHtml(href)}" style="display:inline-block;background:${color};color:#ffffff !important;font-weight:700;font-size:15px;padding:14px 28px;border-radius:999px;text-decoration:none;box-shadow:0 4px 14px rgba(15,23,42,0.18);">${escapeHtml(label)}</a>`;
}

/**
 * @returns {{ sent: boolean, reason?: string, messageId?: string }}
 */
async function sendMail({ to, subject, text, html, replyTo }) {
  if (!to || !String(to).trim()) {
    return { sent: false, reason: "no-recipient" };
  }
  const transport = await getTransporter();
  if (!transport) {
    console.warn("[email] SMTP not configured (set SMTP_HOST / EMAIL_HOST and credentials); skipping send.");
    return { sent: false, reason: "smtp-not-configured" };
  }
  try {
    const info = await transport.sendMail({
      from: fromAddress(),
      to: String(to).trim(),
      subject,
      text,
      html: html || `<p>${text}</p>`,
      replyTo: replyTo || adminEmail() || undefined,
    });
    return { sent: true, messageId: info?.messageId };
  } catch (e) {
    console.error("[email] send failed:", e.message);
    return { sent: false, reason: e.message };
  }
}

async function sendStockNotificationEmail({ to, customerName, itemTitle, productName, barcode }) {
  const shop = storeName();
  const subject = `${shop}: ${itemTitle} is back in stock`;
  const greeting = customerName ? `Hi ${escapeHtml(customerName)},` : "Hi,";
  const innerHtml = `
    <p style="margin:0 0 16px;font-size:15px;line-height:1.55;color:#334155;">${greeting}</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.55;color:#334155;">Good news — the item we noted for you is in stock and ready to view.</p>
    <table role="presentation" cellspacing="0" cellpadding="0" width="100%" style="margin:14px 0 18px;">
      <tr><td style="padding:14px 18px;background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0;font-size:14px;color:#0f172a;">
        <div style="font-weight:700;color:#0284c7;font-size:13px;text-transform:uppercase;letter-spacing:0.1em;">You asked for</div>
        <div style="margin-top:4px;font-weight:700;font-size:15px;">${escapeHtml(itemTitle)}</div>
        ${productName ? `<div style="margin-top:6px;color:#475569;">Now stocked as: <span style="color:#0f172a;font-weight:600;">${escapeHtml(productName)}</span></div>` : ""}
        ${barcode ? `<div style="margin-top:4px;font-family:ui-monospace,Consolas,monospace;color:#64748b;font-size:13px;">Code: ${escapeHtml(barcode)}</div>` : ""}
      </td></tr>
    </table>
    <p style="margin:0;font-size:13px;line-height:1.55;color:#64748b;">Stop by the shop or call (905) 893-1613 to grab it.</p>
  `;
  const html = brandedShell({
    headlineHtml: "It's in stock",
    headlineSubHtml: "We saved this for you",
    innerHtml,
    ctaHtml: ctaButton({ href: `${publicSiteUrl()}/shop`, label: "View shop" }),
    footerNote: "You're getting this because you asked us to hold this item for you.",
  });
  const text = [
    customerName ? `Hi ${customerName},` : "Hi,",
    "",
    `Good news — the item we noted for you is back in stock at ${shop}.`,
    `Item: ${itemTitle}`,
    productName ? `Listed as: ${productName}` : "",
    barcode ? `Code: ${barcode}` : "",
    "",
    "Call (905) 893-1613 or stop by the shop.",
    `— ${shop}`,
  ].filter(Boolean).join("\n");
  return sendMail({ to, subject, text, html });
}

/** New quote — sent to the customer when a digital quote is created with their email. */
async function sendReceiptConfirmationEmail({
  to,
  customerName,
  receiptNumber,
  trackUrl,
  priceEstimate,
  items,
}) {
  const shop = storeName();
  const recipient = (process.env.CONFIRMATION_EMAIL_OVERRIDE || "").trim() || to;
  if (!recipient) return { sent: false, reason: "no-recipient" };

  const firstName = customerName ? String(customerName).split(/[ ,]/)[0].trim() : "";
  const greeting = firstName ? `Hi ${firstName},` : "Hi,";
  const subject = `${shop} — Quote ${receiptNumber}`;

  const itemRows = (Array.isArray(items) ? items : [])
    .filter((it) => it && (it.description || it.price))
    .map(
      (it) =>
        `<tr><td style="padding:8px 0;font-size:13px;color:#334155;border-bottom:1px solid #f1f5f9;">${escapeHtml(it.description || "Item")}</td><td align="right" style="padding:8px 0;font-size:13px;color:#0f172a;font-weight:600;border-bottom:1px solid #f1f5f9;font-family:ui-monospace,Consolas,monospace;">${fmtMoney(it.price)}</td></tr>`
    )
    .join("");

  const innerHtml = `
    <p style="margin:0 0 12px;font-size:15px;line-height:1.55;color:#334155;">${escapeHtml(greeting)}</p>
    <p style="margin:0 0 18px;font-size:15px;line-height:1.55;color:#334155;">Thanks for stopping by ${escapeHtml(shop)}. Your quote is logged in our system — save this email for your records.</p>
    <div style="background:#f8fafc;border-radius:14px;padding:18px 20px;border:1px solid #e2e8f0;margin-bottom:18px;">
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#64748b;">Quote number</p>
      <p style="margin:0;font-family:ui-monospace,Consolas,monospace;font-size:22px;font-weight:800;color:#0284c7;letter-spacing:0.04em;">${escapeHtml(receiptNumber)}</p>
    </div>
    ${itemRows ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-top:1px solid #f1f5f9;border-bottom:1px solid #f1f5f9;margin-bottom:14px;"><tbody>${itemRows}</tbody></table>` : ""}
    ${
      Number(priceEstimate) > 0
        ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:6px 0 14px;"><tr>
            <td style="padding:10px 0 0;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#64748b;">Estimated quote</td>
            <td align="right" style="padding:10px 0 0;font-size:20px;font-weight:800;color:#0f172a;font-family:ui-monospace,Consolas,monospace;">${fmtMoney(priceEstimate)}</td>
          </tr></table>`
        : ""
    }
    <p style="margin:0;font-size:12px;line-height:1.55;color:#94a3b8;">This is a quote, not a tax invoice. Final pricing may change after diagnosis — we'll message you with any updates.</p>
  `;

  const html = brandedShell({
    headlineHtml: "Your quote is confirmed",
    headlineSubHtml: "Track your repair anytime with the link below.",
    innerHtml,
    ctaHtml: ctaButton({ href: trackUrl, label: "Track your repair" }),
    footerNote: "Need to talk to us? Reply to this email or call the shop.",
  });

  const text = [
    greeting,
    "",
    `Thanks for stopping by ${shop}. Your quote is in our system.`,
    `Quote #: ${receiptNumber}`,
    Number(priceEstimate) > 0 ? `Estimated quote: ${fmtMoney(priceEstimate)}` : "",
    "",
    `Track your repair: ${trackUrl}`,
    "",
    "This is a quote, not a tax invoice.",
    `— ${shop}`,
  ].filter(Boolean).join("\n");

  return sendMail({ to: recipient, subject, text, html });
}

const STATUS_LABELS = {
  received: "Received",
  diagnosing: "Diagnosing",
  "waiting-for-parts": "Waiting for parts",
  "in-progress": "In progress",
  "ready-for-pickup": "Ready for pickup",
  "customer-called": "We've called you",
  completed: "Completed",
  cancelled: "Cancelled",
};

/**
 * Sent when admin updates a quote OR adds an "update" with the email-the-customer
 * option enabled.
 */
async function sendReceiptUpdateEmail({
  to,
  customerName,
  receiptNumber,
  status,
  message,
  trackUrl,
  priceEstimate,
}) {
  const shop = storeName();
  const recipient = (process.env.CONFIRMATION_EMAIL_OVERRIDE || "").trim() || to;
  if (!recipient) return { sent: false, reason: "no-recipient" };

  const firstName = customerName ? String(customerName).split(/[ ,]/)[0].trim() : "";
  const greeting = firstName ? `Hi ${firstName},` : "Hi,";
  const statusLabel = STATUS_LABELS[status] || status || "";
  const subject = statusLabel
    ? `${shop} — Quote ${receiptNumber} update: ${statusLabel}`
    : `${shop} — Quote ${receiptNumber} update`;

  const innerHtml = `
    <p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:#334155;">${escapeHtml(greeting)}</p>
    <p style="margin:0 0 18px;font-size:15px;line-height:1.55;color:#334155;">There's an update on your quote at ${escapeHtml(shop)}.</p>
    <div style="background:#f8fafc;border-radius:14px;padding:18px 20px;border:1px solid #e2e8f0;margin-bottom:16px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
        <tr>
          <td>
            <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#64748b;">Quote</p>
            <p style="margin:0;font-family:ui-monospace,Consolas,monospace;font-size:18px;font-weight:800;color:#0284c7;letter-spacing:0.04em;">${escapeHtml(receiptNumber)}</p>
          </td>
          ${
            statusLabel
              ? `<td align="right" style="vertical-align:top;">
                  <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#64748b;">Status</p>
                  <p style="margin:0;display:inline-block;padding:6px 12px;border-radius:999px;background:#dcfce7;color:#15803d;font-weight:700;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;">${escapeHtml(statusLabel)}</p>
                </td>`
              : ""
          }
        </tr>
      </table>
    </div>
    ${
      message
        ? `<div style="background:#fff7ed;border-left:4px solid #f59e0b;border-radius:4px;padding:12px 16px;margin-bottom:18px;">
            <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#92400e;">Note from our team</p>
            <p style="margin:0;font-size:14px;line-height:1.55;color:#0f172a;">${escapeHtml(message)}</p>
          </div>`
        : ""
    }
    ${
      Number(priceEstimate) > 0
        ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 14px;border-top:1px solid #f1f5f9;padding-top:12px;"><tr>
            <td style="font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#64748b;">Current quote</td>
            <td align="right" style="font-size:18px;font-weight:800;color:#0f172a;font-family:ui-monospace,Consolas,monospace;">${fmtMoney(priceEstimate)}</td>
          </tr></table>`
        : ""
    }
    <p style="margin:0;font-size:12px;line-height:1.55;color:#94a3b8;">This is a quote, not a tax invoice. Reply to this email if you have questions.</p>
  `;

  const html = brandedShell({
    headlineHtml: "Update on your repair",
    headlineSubHtml: statusLabel ? `Status: ${escapeHtml(statusLabel)}` : "",
    innerHtml,
    ctaHtml: ctaButton({ href: trackUrl, label: "View full timeline" }),
  });

  const text = [
    greeting,
    "",
    `There's an update on your quote at ${shop}.`,
    `Quote #: ${receiptNumber}`,
    statusLabel ? `Status: ${statusLabel}` : "",
    message ? `Note: ${message}` : "",
    Number(priceEstimate) > 0 ? `Current quote: ${fmtMoney(priceEstimate)}` : "",
    "",
    `Full timeline: ${trackUrl}`,
    `— ${shop}`,
  ].filter(Boolean).join("\n");

  return sendMail({ to: recipient, subject, text, html });
}

/**
 * Internal admin notification when grocery list is updated.
 * action ∈ "added" | "updated" | "removed" | "matched"
 */
async function sendAdminGroceryNotification({ action, item, actor, matchedInventory }) {
  const target = adminEmail();
  if (!target) return { sent: false, reason: "no-admin-email" };
  const shop = storeName();

  const verb = {
    added: "added to",
    updated: "updated on",
    removed: "removed from",
    matched: "matched on",
  }[action] || "changed on";

  const subject = `[Grocery] ${item?.title || "Untitled"} ${verb} the parts list`;

  const innerHtml = `
    <p style="margin:0 0 14px;font-size:14px;color:#334155;">A line on the parts / grocery list was just <strong>${escapeHtml(verb)}</strong> the list at ${escapeHtml(shop)}.</p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0;margin-bottom:16px;">
      <tr><td style="padding:14px 18px;font-size:14px;color:#0f172a;">
        <div style="font-weight:700;font-size:15px;">${escapeHtml(item?.title || "(no title)")}</div>
        ${item?.notes ? `<div style="margin-top:6px;color:#475569;font-size:13px;">${escapeHtml(item.notes)}</div>` : ""}
        <div style="margin-top:10px;font-family:ui-monospace,Consolas,monospace;color:#64748b;font-size:12px;">
          ${item?.matchBarcode ? `barcode: ${escapeHtml(item.matchBarcode)}<br/>` : ""}
          ${item?.matchItemNumber ? `item #: ${escapeHtml(item.matchItemNumber)}<br/>` : ""}
          status: ${escapeHtml(item?.status || "pending")}
        </div>
        ${item?.customerRequest?.email ? `<div style="margin-top:10px;font-size:12px;color:#0284c7;">notify customer at ${escapeHtml(item.customerRequest.email)}</div>` : ""}
      </td></tr>
    </table>
    ${
      matchedInventory
        ? `<div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:12px;padding:14px 18px;margin-bottom:16px;">
            <p style="margin:0 0 6px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#047857;">In stock</p>
            <p style="margin:0;font-size:14px;color:#064e3b;font-weight:600;">${escapeHtml(matchedInventory.name || matchedInventory.itemNumber || "")}</p>
          </div>`
        : ""
    }
    <p style="margin:0;font-size:12px;color:#94a3b8;">Triggered by ${escapeHtml(actor || "staff")}.</p>
  `;

  const html = brandedShell({
    headlineHtml: "Grocery list activity",
    headlineSubHtml: `${escapeHtml(item?.title || "(no title)")} — ${escapeHtml(verb)} the list`,
    innerHtml,
    ctaHtml: ctaButton({ href: `${publicSiteUrl()}/admin/grocery-list`, label: "Open grocery list" }),
    footerNote: "Internal notification — only admins receive this.",
  });

  const text = [
    `Grocery list activity (${verb}):`,
    `Title: ${item?.title || "(no title)"}`,
    item?.notes ? `Notes: ${item.notes}` : "",
    item?.matchBarcode ? `Barcode: ${item.matchBarcode}` : "",
    item?.matchItemNumber ? `Item #: ${item.matchItemNumber}` : "",
    `Status: ${item?.status || "pending"}`,
    matchedInventory ? `Now in stock: ${matchedInventory.name || matchedInventory.itemNumber || ""}` : "",
    `Actor: ${actor || "staff"}`,
  ].filter(Boolean).join("\n");

  return sendMail({ to: target, subject, text, html });
}

module.exports = {
  sendMail,
  sendStockNotificationEmail,
  sendReceiptConfirmationEmail,
  sendReceiptUpdateEmail,
  sendAdminGroceryNotification,
  publicSiteUrl,
  logoUrl,
  storeName,
  adminEmail,
};
