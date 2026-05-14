const nodemailer = require("nodemailer");
const dns = require("dns").promises;

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

/**
 * Render's free tier has no outbound IPv6. Pre-resolve the SMTP host to an
 * IPv4 address (A record) and pass the literal IP to nodemailer with
 * `tls.servername` for SNI. Without this, Node opens an IPv6 socket and
 * fails with `ENETUNREACH 2603:1036:...:587 - Local (:::0)`.
 */
async function resolveIPv4(host) {
  try {
    const r = await dns.lookup(host, { family: 4 });
    return r?.address || host;
  } catch (e) {
    console.warn("[email] dns.lookup ipv4 failed for", host, "-", e?.message || e);
    return host;
  }
}

async function buildTransport() {
  const host = process.env.SMTP_HOST || process.env.EMAIL_HOST;
  const port = parseInt(process.env.SMTP_PORT || process.env.EMAIL_PORT || "587", 10);
  const user = process.env.SMTP_USER || process.env.EMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.EMAIL_PASS;
  const secure = process.env.SMTP_SECURE === "true" || port === 465;

  if (!host || !user) return null;

  const ipv4 = await resolveIPv4(host);
  console.log(`[email] SMTP transport: ${host} -> ${ipv4}:${port} (secure=${secure})`);
  return nodemailer.createTransport({
    host: ipv4,
    port,
    secure,
    auth: { user, pass },
    requireTLS: !secure,
    family: 4,
    tls: { servername: host, minVersion: "TLSv1.2" },
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 22_000,
  });
}

function getTransporter() {
  if (!transporterPromise) {
    transporterPromise = buildTransport().catch((e) => {
      console.error("[email] transporter init failed:", e?.message || e);
      transporterPromise = null;
      return null;
    });
  }
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
 * URL of the brand image to use in the header. Falls back to the hero PNG
 * we host on the storefront. We also render an HTML wordmark next to it so
 * the header still looks branded when Outlook / Gmail block external images.
 */
function logoUrl() {
  return process.env.EMAIL_LOGO_URL || `${publicSiteUrl()}/email-hero-logo.png`;
}

/** Extract first email from RFC-style From header or loose text (handles stray quotes). */
function bareEmailFromHeader(val) {
  if (!val || typeof val !== "string") return "";
  const t = val.trim().replace(/^["']+|["']+$/g, "");
  const innerAngle = t.match(/<([\s\S]*?)>/);
  if (innerAngle) {
    const inner = innerAngle[1].trim().replace(/^["']+|["']+$/g, "");
    const inBrackets = inner.match(/\b([\w.!#$%&'*+/=?^_`{|}~-]+@[\w.-]+\.[A-Za-z]{2,})\b/);
    if (inBrackets) return inBrackets[1];
  }
  const loose = t.match(/\b([\w.!#$%&'*+/=?^_`{|}~-]+@[\w.-]+\.[A-Za-z]{2,})\b/);
  return loose ? loose[1] : "";
}

/**
 * Recipient for internal mail (grocery alerts, Reply-To fallback).
 * Prefer ADMIN_EMAIL on hosts where SMTP_USER is only for auth — or where
 * `SMTP_FROM` / `EMAIL_FROM` holds the mailbox but LOGIN_USER is omitted.
 */
function adminEmail() {
  return (
    (process.env.ADMIN_EMAIL || "").trim() ||
    (process.env.SMTP_USER || "").trim() ||
    (process.env.EMAIL_USER || "").trim() ||
    bareEmailFromHeader(process.env.SMTP_FROM || "") ||
    bareEmailFromHeader(process.env.EMAIL_FROM || "")
  );
}

function storeName() {
  return process.env.STORE_NAME || "Electroshack";
}

/**
 * Modern transactional email shell, inspired by the Starbucks app receipt UI.
 *
 * Layout (top → bottom):
 *   - Slim dark band with the real Electroshack logo (`email-hero-logo.png`)
 *   - Section eyebrow ("REPAIR UPDATE", "QUOTE", "PARTS LIST", ...) over hairline
 *   - Headline + optional subhead
 *   - Body (per-template content)
 *   - Optional rounded CTA button
 *   - Quiet footer with address / phone / site link
 *
 * Mobile rules baked in (no media queries — many clients strip them):
 *   - Outer card uses `width:100%` + `max-width:600px` so it fills phone width
 *   - Side padding is a percentage so it scales down naturally
 *   - Body text is 16px (readable everywhere, never auto-zoomed by iOS)
 *   - Buttons are at least 48px tall for thumb taps
 *   - Logo image stays inside a fixed-height band (max-width 200px / height auto)
 *
 * `eyebrow` is rendered in primary-blue uppercase tracking, matching the
 * Starbucks "TRANSACTION" label style.
 */
function brandedShell({ headlineHtml, headlineSubHtml = "", eyebrow = "", innerHtml, ctaHtml = "", footerNote = "" }) {
  const shop = storeName();
  const site = publicSiteUrl();
  const logo = logoUrl();
  const preheaderText = (headlineSubHtml || headlineHtml || "").replace(/<[^>]+>/g, "").trim();
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light dark" />
  <meta name="supported-color-schemes" content="light dark" />
  <title>${escapeHtml(shop)}</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
  <style>
    /* Mobile tweaks. Most clients honor these even though some (Outlook desktop) ignore them. */
    @media only screen and (max-width: 520px) {
      .es-card { width: 100% !important; border-radius: 0 !important; }
      .es-pad { padding-left: 22px !important; padding-right: 22px !important; }
      .es-headline { font-size: 22px !important; }
      .es-eyebrow { font-size: 11px !important; }
      .es-cta a { display: block !important; padding: 16px 0 !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#eef2f7;color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:0;line-height:0;color:#eef2f7;">${escapeHtml(preheaderText)}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#eef2f7" style="background-color:#eef2f7;">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" class="es-card" width="600" cellspacing="0" cellpadding="0" border="0" bgcolor="#ffffff" style="width:600px;max-width:600px;background-color:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #e2e8f0;">
          <!-- Brand band: real logo, dark navy background, generous breathing room. -->
          <tr>
            <td align="center" bgcolor="#0f172a" style="background-color:#0f172a;padding:22px 20px;text-align:center;">
              <a href="${escapeHtml(site)}" style="text-decoration:none;display:inline-block;">
                <img src="${escapeHtml(logo)}" alt="${escapeHtml(shop)}" width="200" height="auto" style="display:block;margin:0 auto;max-width:60%;width:200px;height:auto;border:0;outline:none;text-decoration:none;" />
              </a>
            </td>
          </tr>
          <!-- Section eyebrow over a hairline (Starbucks "TRANSACTION" style). -->
          ${
            eyebrow
              ? `<tr>
                  <td align="center" bgcolor="#ffffff" class="es-pad" style="background-color:#ffffff;padding:26px 36px 0;text-align:center;">
                    <p class="es-eyebrow" style="margin:0;font-size:12px;font-weight:800;letter-spacing:0.22em;text-transform:uppercase;color:#0284c7;">${escapeHtml(eyebrow)}</p>
                  </td>
                </tr>`
              : ""
          }
          <!-- Headline + subhead. -->
          <tr>
            <td align="center" bgcolor="#ffffff" class="es-pad" style="background-color:#ffffff;padding:${eyebrow ? "10px" : "30px"} 36px 6px;text-align:center;">
              <h1 class="es-headline" style="margin:0;padding:0;font-size:24px;font-weight:800;letter-spacing:-0.015em;line-height:1.25;color:#0f172a;">${headlineHtml}</h1>
              ${headlineSubHtml ? `<p style="margin:10px 0 0;padding:0;font-size:15px;line-height:1.5;color:#64748b;">${headlineSubHtml}</p>` : ""}
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td bgcolor="#ffffff" class="es-pad" style="background-color:#ffffff;color:#1e293b;padding:22px 36px 8px;font-size:16px;line-height:1.6;">${innerHtml}</td>
          </tr>
          ${ctaHtml ? `<tr><td align="center" bgcolor="#ffffff" class="es-pad es-cta" style="background-color:#ffffff;padding:10px 36px 30px;">${ctaHtml}</td></tr>` : ""}
          <!-- Footer -->
          <tr>
            <td bgcolor="#f8fafc" class="es-pad" style="padding:22px 36px 26px;border-top:1px solid #e2e8f0;background-color:#f8fafc;text-align:center;font-size:13px;color:#64748b;line-height:1.65;">
              ${footerNote ? `<p style="margin:0 0 12px;color:#475569;font-size:13px;">${footerNote}</p>` : ""}
              <p style="margin:0 0 4px;font-weight:700;color:#0f172a;letter-spacing:0.02em;font-size:14px;">${escapeHtml(shop)}</p>
              <p style="margin:0;color:#64748b;">9600 Islington Ave, Woodbridge, ON L4H 2T1</p>
              <p style="margin:6px 0 0;"><a href="tel:9058931613" style="color:#0284c7;text-decoration:none;font-weight:600;">(905) 893-1613</a> &middot; <a href="${escapeHtml(site)}" style="color:#0284c7;text-decoration:none;font-weight:600;">${escapeHtml(site.replace(/^https?:\/\//, ""))}</a></p>
            </td>
          </tr>
        </table>
        <p style="margin:14px 0 0;font-size:11px;color:#94a3b8;line-height:1.5;">Sent by ${escapeHtml(shop)} &middot; ${escapeHtml(site.replace(/^https?:\/\//, ""))}</p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Pill-shaped CTA. Defaults to brand green; can be overridden per template. */
function ctaButton({ href, label, color = "#16a34a" }) {
  return `<a href="${escapeHtml(href)}" style="display:inline-block;background:${color};color:#ffffff !important;font-weight:700;font-size:15px;padding:15px 34px;border-radius:999px;text-decoration:none;letter-spacing:0.02em;mso-padding-alt:0;">${escapeHtml(label)}</a>`;
}

/**
 * Send via Resend's HTTPS API. Render's free tier blocks outbound SMTP ports
 * (25/465/587), so SMTP is unusable there. When `RESEND_API_KEY` is set, we
 * post to Resend instead. Sender (`from`) defaults to `EMAIL_FROM`/`SMTP_FROM`
 * but can be overridden with `RESEND_FROM` (handy while a custom domain is
 * still being verified — use `Electroshack <onboarding@resend.dev>`).
 */
async function sendViaResend({ to, subject, text, html, replyTo }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  const from = process.env.RESEND_FROM || fromAddress();
  const body = {
    from,
    to: [String(to).trim()],
    subject,
    text,
    html: html || `<p>${text}</p>`,
  };
  if (replyTo || adminEmail()) body.reply_to = replyTo || adminEmail();
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("[email] resend failed:", res.status, json?.message || json);
      return { sent: false, reason: json?.message || `resend ${res.status}` };
    }
    return { sent: true, messageId: json?.id || "resend", via: "resend" };
  } catch (e) {
    console.error("[email] resend crashed:", e?.message || e);
    return { sent: false, reason: e?.message || String(e) };
  }
}

/**
 * @returns {{ sent: boolean, reason?: string, messageId?: string, via?: string }}
 */
async function sendMail({ to, subject, text, html, replyTo }) {
  if (!to || !String(to).trim()) {
    return { sent: false, reason: "no-recipient" };
  }
  if (process.env.RESEND_API_KEY) {
    const r = await sendViaResend({ to, subject, text, html, replyTo });
    if (r) return r;
  }
  const transport = await getTransporter();
  if (!transport) {
    console.warn("[email] no transport (set RESEND_API_KEY for HTTPS, or SMTP_HOST / EMAIL_HOST + creds); skipping send.");
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
    return { sent: true, messageId: info?.messageId, via: "smtp" };
  } catch (e) {
    console.error("[email] send failed:", e.message);
    return { sent: false, reason: e.message };
  }
}

function buildStockNotificationHtml({ customerName, itemTitle, productName, barcode }) {
  const shop = storeName();
  const firstName = customerName ? String(customerName).split(/[ ,]/)[0].trim() : "";
  const greeting = firstName ? `Hi ${escapeHtml(firstName)},` : "Hi,";
  const innerHtml = `
    <p style="margin:0 0 16px;">${greeting}</p>
    <p style="margin:0 0 22px;">Good news — the item you asked us to hold is in stock and ready for pickup at ${escapeHtml(shop)}.</p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;margin:0 0 22px;">
      <tr>
        <td style="padding:16px 0;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.14em;color:#94a3b8;width:50%;">Item</td>
        <td align="right" style="padding:16px 0;font-size:15px;font-weight:700;color:#0f172a;">${escapeHtml(itemTitle)}</td>
      </tr>
      ${
        productName
          ? `<tr><td style="padding:14px 0;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.14em;color:#94a3b8;border-top:1px solid #f1f5f9;">Listed as</td><td align="right" style="padding:14px 0;font-size:14px;color:#334155;border-top:1px solid #f1f5f9;">${escapeHtml(productName)}</td></tr>`
          : ""
      }
      ${
        barcode
          ? `<tr><td style="padding:14px 0;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.14em;color:#94a3b8;border-top:1px solid #f1f5f9;">Code</td><td align="right" style="padding:14px 0;font-size:14px;color:#334155;border-top:1px solid #f1f5f9;font-family:ui-monospace,Consolas,monospace;">${escapeHtml(barcode)}</td></tr>`
          : ""
      }
    </table>
    <p style="margin:0;color:#64748b;font-size:14px;">Call <a href="tel:9058931613" style="color:#0284c7;text-decoration:none;font-weight:600;">(905) 893-1613</a> or drop in to grab it.</p>
  `;
  return brandedShell({
    eyebrow: "Back in stock",
    headlineHtml: `${escapeHtml(itemTitle)} is in.`,
    headlineSubHtml: "We saved this one for you.",
    innerHtml,
    ctaHtml: ctaButton({ href: `${publicSiteUrl()}/shop`, label: "View shop" }),
    footerNote: "You're getting this because you asked us to hold this item.",
  });
}

async function sendStockNotificationEmail({ to, customerName, itemTitle, productName, barcode }) {
  const shop = storeName();
  const subject = `${shop}: ${itemTitle} is back in stock`;
  const html = buildStockNotificationHtml({ customerName, itemTitle, productName, barcode });
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

/**
 * Pure HTML builder for the new-quote email. Same code path as sending —
 * exposed so the preview server can render exactly what Resend delivers.
 */
function buildReceiptConfirmationHtml({ customerName, receiptNumber, trackUrl, priceEstimate, items }) {
  const shop = storeName();
  const firstName = customerName ? String(customerName).split(/[ ,]/)[0].trim() : "";
  const greeting = firstName ? `Hi ${firstName},` : "Hi,";
  const itemRows = (Array.isArray(items) ? items : [])
    .filter((it) => it && (it.description || it.price))
    .map(
      (it, idx) =>
        `<tr><td style="padding:14px 0;font-size:15px;color:#1e293b;line-height:1.5;${idx > 0 ? "border-top:1px solid #f1f5f9;" : ""}">${escapeHtml(it.description || "Item")}</td><td align="right" style="padding:14px 0;font-size:15px;color:#0f172a;font-weight:700;${idx > 0 ? "border-top:1px solid #f1f5f9;" : ""}">${fmtMoney(it.price)}</td></tr>`
    )
    .join("");
  const innerHtml = `
    <p style="margin:0 0 16px;">${escapeHtml(greeting)}</p>
    <p style="margin:0 0 26px;">Thanks for stopping by ${escapeHtml(shop)}. Your quote is logged in our system — save this email for your records.</p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 22px;border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;">
      <tr>
        <td style="padding:16px 0;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.14em;color:#94a3b8;">Quote #</td>
        <td align="right" style="padding:16px 0;font-size:17px;font-weight:800;color:#0284c7;letter-spacing:0.04em;font-family:ui-monospace,Consolas,monospace;">${escapeHtml(receiptNumber)}</td>
      </tr>
    </table>
    ${
      itemRows
        ? `<p style="margin:0 0 6px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.14em;color:#94a3b8;">Items</p>
           <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 6px;border-bottom:1px solid #e2e8f0;"><tbody>${itemRows}</tbody></table>`
        : ""
    }
    ${
      Number(priceEstimate) > 0
        ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:18px 0 8px;"><tr>
            <td style="font-size:15px;font-weight:700;color:#0f172a;">Estimated total</td>
            <td align="right" style="font-size:24px;font-weight:800;color:#0f172a;letter-spacing:-0.01em;">${fmtMoney(priceEstimate)}</td>
          </tr></table>`
        : ""
    }
    <p style="margin:18px 0 0;font-size:13px;line-height:1.6;color:#94a3b8;">This is a quote, not a tax invoice. Final pricing may change after diagnosis — we'll email you with any updates.</p>
  `;
  return brandedShell({
    eyebrow: "Quote",
    headlineHtml: "Your quote is confirmed",
    headlineSubHtml: "We'll keep you posted as the repair moves along.",
    innerHtml,
    ctaHtml: ctaButton({ href: trackUrl, label: "Track your repair" }),
    footerNote: "Reply to this email or call the shop if you have questions.",
  });
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

  const html = buildReceiptConfirmationHtml({ customerName, receiptNumber, trackUrl, priceEstimate, items });

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

function buildReceiptUpdateHtml({ customerName, receiptNumber, status, message, trackUrl, priceEstimate }) {
  const shop = storeName();
  const firstName = customerName ? String(customerName).split(/[ ,]/)[0].trim() : "";
  const greeting = firstName ? `Hi ${firstName},` : "Hi,";
  const statusLabel = STATUS_LABELS[status] || status || "";
  const innerHtml = `
    <p style="margin:0 0 16px;">${escapeHtml(greeting)}</p>
    <p style="margin:0 0 22px;">There's an update on your quote at ${escapeHtml(shop)}.</p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 22px;border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;">
      <tr>
        <td style="padding:16px 0;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.14em;color:#94a3b8;">Quote #</td>
        <td align="right" style="padding:16px 0;font-size:17px;font-weight:800;color:#0284c7;letter-spacing:0.04em;font-family:ui-monospace,Consolas,monospace;">${escapeHtml(receiptNumber)}</td>
      </tr>
      ${
        statusLabel
          ? `<tr>
              <td style="padding:16px 0;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.14em;color:#94a3b8;border-top:1px solid #f1f5f9;">Status</td>
              <td align="right" style="padding:16px 0;border-top:1px solid #f1f5f9;"><span style="display:inline-block;padding:6px 14px;border-radius:999px;background:#dcfce7;color:#15803d;font-weight:700;font-size:12px;text-transform:uppercase;letter-spacing:0.1em;">${escapeHtml(statusLabel)}</span></td>
            </tr>`
          : ""
      }
    </table>
    ${
      message
        ? `<div style="background:#fffbeb;border-left:3px solid #f59e0b;border-radius:0 8px 8px 0;padding:14px 18px;margin:0 0 22px;">
            <p style="margin:0 0 6px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:#b45309;">Note from our team</p>
            <p style="margin:0;font-size:15px;line-height:1.55;color:#1c1917;">${escapeHtml(message)}</p>
          </div>`
        : ""
    }
    ${
      Number(priceEstimate) > 0
        ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 8px;"><tr>
            <td style="font-size:15px;font-weight:700;color:#0f172a;">Current quote</td>
            <td align="right" style="font-size:24px;font-weight:800;color:#0f172a;letter-spacing:-0.01em;">${fmtMoney(priceEstimate)}</td>
          </tr></table>`
        : ""
    }
    <p style="margin:18px 0 0;font-size:13px;line-height:1.6;color:#94a3b8;">This is a quote, not a tax invoice. Reply to this email if you have questions.</p>
  `;
  return brandedShell({
    eyebrow: "Repair update",
    headlineHtml: "Update on your repair",
    headlineSubHtml: statusLabel ? `Status: ${escapeHtml(statusLabel)}` : "",
    innerHtml,
    ctaHtml: ctaButton({ href: trackUrl, label: "View full timeline" }),
  });
}

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

  const html = buildReceiptUpdateHtml({ customerName, receiptNumber, status, message, trackUrl, priceEstimate });

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

const GROCERY_VERBS = {
  added: "added to",
  updated: "updated on",
  removed: "removed from",
  matched: "matched on",
};

function buildAdminGroceryHtml({ action, item, actor, matchedInventory }) {
  const shop = storeName();
  const verb = GROCERY_VERBS[action] || "changed on";
  const innerHtml = `
    <p style="margin:0 0 22px;">A line on the parts / grocery list was just <strong>${escapeHtml(verb)}</strong> the list at ${escapeHtml(shop)}.</p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 22px;border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;">
      <tr>
        <td style="padding:16px 0;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.14em;color:#94a3b8;width:38%;">Item</td>
        <td align="right" style="padding:16px 0;font-size:16px;font-weight:700;color:#0f172a;">${escapeHtml(item?.title || "(no title)")}</td>
      </tr>
      ${
        item?.notes
          ? `<tr><td style="padding:14px 0;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.14em;color:#94a3b8;border-top:1px solid #f1f5f9;">Notes</td><td align="right" style="padding:14px 0;font-size:14px;color:#334155;border-top:1px solid #f1f5f9;">${escapeHtml(item.notes)}</td></tr>`
          : ""
      }
      ${
        item?.matchBarcode
          ? `<tr><td style="padding:14px 0;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.14em;color:#94a3b8;border-top:1px solid #f1f5f9;">Barcode</td><td align="right" style="padding:14px 0;font-size:14px;color:#334155;border-top:1px solid #f1f5f9;font-family:ui-monospace,Consolas,monospace;">${escapeHtml(item.matchBarcode)}</td></tr>`
          : ""
      }
      ${
        item?.matchItemNumber
          ? `<tr><td style="padding:14px 0;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.14em;color:#94a3b8;border-top:1px solid #f1f5f9;">Item #</td><td align="right" style="padding:14px 0;font-size:14px;color:#334155;border-top:1px solid #f1f5f9;font-family:ui-monospace,Consolas,monospace;">${escapeHtml(item.matchItemNumber)}</td></tr>`
          : ""
      }
      <tr>
        <td style="padding:14px 0;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.14em;color:#94a3b8;border-top:1px solid #f1f5f9;">Status</td>
        <td align="right" style="padding:14px 0;border-top:1px solid #f1f5f9;"><span style="display:inline-block;padding:5px 12px;border-radius:999px;background:#e0f2fe;color:#075985;font-weight:700;font-size:12px;text-transform:uppercase;letter-spacing:0.1em;">${escapeHtml(item?.status || "pending")}</span></td>
      </tr>
      ${
        item?.customerRequest?.email
          ? `<tr><td style="padding:14px 0;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.14em;color:#94a3b8;border-top:1px solid #f1f5f9;">Notify</td><td align="right" style="padding:14px 0;font-size:14px;color:#0284c7;border-top:1px solid #f1f5f9;">${escapeHtml(item.customerRequest.email)}</td></tr>`
          : ""
      }
    </table>
    ${
      matchedInventory
        ? `<div style="background:#ecfdf5;border-left:3px solid #16a34a;border-radius:0 8px 8px 0;padding:14px 18px;margin:0 0 22px;">
            <p style="margin:0 0 4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:#047857;">In stock</p>
            <p style="margin:0;font-size:15px;color:#064e3b;font-weight:700;">${escapeHtml(matchedInventory.name || matchedInventory.itemNumber || "")}</p>
          </div>`
        : ""
    }
    <p style="margin:18px 0 0;font-size:13px;color:#94a3b8;">Triggered by ${escapeHtml(actor || "staff")}.</p>
  `;
  return brandedShell({
    eyebrow: "Parts list",
    headlineHtml: `Item ${escapeHtml(verb)} the list`,
    headlineSubHtml: escapeHtml(item?.title || ""),
    innerHtml,
    ctaHtml: ctaButton({ href: `${publicSiteUrl()}/admin/grocery-list`, label: "Open grocery list" }),
    footerNote: "Internal notification — only admins receive this.",
  });
}

/**
 * Internal admin notification when grocery list is updated.
 * action ∈ "added" | "updated" | "removed" | "matched"
 */
async function sendAdminGroceryNotification({ action, item, actor, matchedInventory }) {
  const target = adminEmail();
  if (!target) return { sent: false, reason: "no-admin-email" };
  const verb = GROCERY_VERBS[action] || "changed on";
  const subject = `[Grocery] ${item?.title || "Untitled"} ${verb} the parts list`;
  const html = buildAdminGroceryHtml({ action, item, actor, matchedInventory });
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
  buildReceiptConfirmationHtml,
  buildReceiptUpdateHtml,
  buildStockNotificationHtml,
  buildAdminGroceryHtml,
  publicSiteUrl,
  logoUrl,
  storeName,
  adminEmail,
};
