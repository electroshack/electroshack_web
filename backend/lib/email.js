const nodemailer = require("nodemailer");

function escapeHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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

/**
 * @returns {{ sent: boolean, reason?: string }}
 */
async function sendMail({ to, subject, text, html }) {
  if (!to || !String(to).trim()) {
    return { sent: false, reason: "no-recipient" };
  }
  const transport = await getTransporter();
  if (!transport) {
    console.warn("[email] SMTP not configured (set SMTP_HOST / EMAIL_HOST and credentials); skipping send.");
    return { sent: false, reason: "smtp-not-configured" };
  }
  try {
    await transport.sendMail({
      from: fromAddress(),
      to: String(to).trim(),
      subject,
      text,
      html: html || `<p>${text}</p>`,
    });
    return { sent: true };
  } catch (e) {
    console.error("[email] send failed:", e.message);
    return { sent: false, reason: e.message };
  }
}

async function sendStockNotificationEmail({ to, customerName, itemTitle, productName, barcode }) {
  const shop = process.env.STORE_NAME || "Electroshack";
  const subject = `${shop}: item you asked about is in stock`;
  const text = [
    `Hi${customerName ? ` ${customerName}` : ""},`,
    "",
    `Good news — the item we noted for you is now in stock.`,
    "",
    `Request: ${itemTitle}`,
    productName ? `Product record: ${productName}` : "",
    barcode ? `Barcode / code: ${barcode}` : "",
    "",
    `— ${shop}`,
  ]
    .filter(Boolean)
    .join("\n");

  return sendMail({
    to,
    subject,
    text,
    html: text.replace(/\n/g, "<br/>"),
  });
}

/**
 * New standard receipt — confirmation with receipt # and public track link.
 * CONFIRMATION_EMAIL_OVERRIDE: send all confirmations to this address (e.g. testing).
 */
async function sendReceiptConfirmationEmail({
  to,
  customerName,
  receiptNumber,
  trackUrl,
}) {
  const shop = process.env.STORE_NAME || "Electroshack";
  const recipient = (process.env.CONFIRMATION_EMAIL_OVERRIDE || "").trim() || to;
  if (!recipient) return { sent: false, reason: "no-recipient" };

  const firstName = customerName ? String(customerName).split(",")[0].trim() : "";
  const greeting = firstName ? `Hi ${firstName},` : "Hi,";
  const greetingHtml = escapeHtml(greeting);
  const subject = `${shop} — Receipt ${receiptNumber} confirmed`;
  const text = [
    greeting,
    "",
    "Thanks for choosing us — your receipt is in our system.",
    "",
    `Receipt #: ${receiptNumber}`,
    `Track your repair: ${trackUrl}`,
    "",
    `— ${shop}`,
  ].join("\n");

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
<body style="margin:0;background:#f0f9ff;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:linear-gradient(180deg,#38bdf8 0%,#e0f2fe 35%,#f0f9ff 100%);padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border-radius:20px;box-shadow:0 12px 40px rgba(14,165,233,0.15);overflow:hidden;">
          <tr>
            <td style="padding:28px 28px 8px;text-align:center;background:linear-gradient(135deg,#0ea5e9,#38bdf8);">
              <p style="margin:0;font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.02em;">You're all set!</p>
              <p style="margin:10px 0 0;font-size:14px;color:rgba(255,255,255,0.95);">Your receipt is confirmed at ${shop}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 28px;">
              <p style="margin:0 0 16px;font-size:16px;line-height:1.5;color:#0f172a;">${greetingHtml}</p>
              <p style="margin:0 0 20px;font-size:15px;line-height:1.55;color:#334155;">Thanks for choosing us — your ticket is in our system. Save this email for your records.</p>
              <div style="background:#f8fafc;border-radius:14px;padding:18px 20px;border:1px solid #e2e8f0;margin-bottom:20px;">
                <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#64748b;">Receipt number</p>
                <p style="margin:0;font-family:ui-monospace,Consolas,monospace;font-size:22px;font-weight:800;color:#0284c7;letter-spacing:0.04em;">${escapeHtml(receiptNumber)}</p>
              </div>
              <table role="presentation" cellspacing="0" cellpadding="0" width="100%">
                <tr>
                  <td align="center" style="padding:8px 0 20px;">
                    <a href="${escapeHtml(trackUrl)}" style="display:inline-block;background:linear-gradient(180deg,#22c55e,#16a34a);color:#ffffff;font-weight:700;font-size:15px;padding:14px 28px;border-radius:999px;text-decoration:none;box-shadow:0 4px 14px rgba(22,163,74,0.35);">Track your repair</a>
                  </td>
                </tr>
              </table>
              <p style="margin:0;font-size:12px;line-height:1.5;color:#94a3b8;text-align:center;">Or copy this link: <span style="color:#334155;word-break:break-all;">${escapeHtml(trackUrl)}</span></p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px 24px;text-align:center;border-top:1px solid #f1f5f9;">
              <p style="margin:0;font-size:11px;color:#cbd5e1;">${shop}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return sendMail({ to: recipient, subject, text, html });
}

module.exports = {
  sendMail,
  sendStockNotificationEmail,
  sendReceiptConfirmationEmail,
};
