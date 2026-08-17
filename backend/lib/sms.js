const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const OutboundSms = require("../models/OutboundSms");

// ### SMS
// ## USB GSM modem only. Binary result: sent, or failed due to SIM.
const SIM_FAIL = "Message failed to send due to SIM issue";

function storeName() {
  return process.env.STORE_NAME || "Electroshack";
}

function normalizePhoneNumber(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw.startsWith("+")) {
    const digits = raw.replace(/[^\d+]/g, "");
    return /^\+\d{10,15}$/.test(digits) ? digits : "";
  }
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return "";
}

function modemPort() {
  return String(process.env.SMS_MODEM_PORT || "").trim();
}

function modemBaud() {
  const n = parseInt(process.env.SMS_MODEM_BAUD, 10);
  return Number.isFinite(n) && n > 0 ? n : 115200;
}

function sendAtScriptPath() {
  const candidates = [
    path.join(__dirname, "..", "scripts", "send-at-sms.ps1"),
    path.join(__dirname, "..", "..", "usb", "send-at-sms.ps1"),
  ];
  return candidates.find((p) => fs.existsSync(p)) || "";
}

function runProcess(command, args, extraEnv) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      windowsHide: true,
      env: { ...process.env, ...extraEnv },
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => {
      stdout += String(d);
    });
    child.stderr.on("data", (d) => {
      stderr += String(d);
    });
    child.on("error", (err) => {
      resolve({ ok: false, stdout, stderr: String(err.message || err) });
    });
    child.on("close", (code) => {
      resolve({ ok: code === 0, stdout, stderr, code });
    });
  });
}

// # AT+CMGS via PowerShell SerialPort. Windows store PC only.
async function sendViaModem(to, body) {
  const port = modemPort();
  if (!port) return { sent: false, reason: SIM_FAIL };
  const script = sendAtScriptPath();
  if (!script) return { sent: false, reason: SIM_FAIL };
  if (process.platform !== "win32") return { sent: false, reason: SIM_FAIL };
  const result = await runProcess(
    "powershell",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", script, "-Port", port, "-Baud", String(modemBaud())],
    { SMS_TO: to, SMS_BODY: String(body || "").slice(0, 1500) }
  );
  if (result.ok) return { sent: true, via: "modem", to };
  return { sent: false, reason: SIM_FAIL, to };
}

async function recordSms({ to, body, status, reason, via, relatedType, relatedId, actor }) {
  return OutboundSms.create({
    to,
    body: String(body || "").slice(0, 1500),
    status,
    reason: reason || "",
    via: via || "",
    relatedType: relatedType || "",
    relatedId: relatedId || "",
    actor: actor || "system",
  });
}

async function sendSms({ to, body, relatedType = "", relatedId = "", actor = "system", record = true } = {}) {
  const normalizedTo = normalizePhoneNumber(to);
  if (!normalizedTo) return { sent: false, reason: "invalid-phone" };
  const text = String(body || "").slice(0, 1500);

  const modem = await sendViaModem(normalizedTo, text);
  if (record) {
    await recordSms({
      to: normalizedTo,
      body: text,
      status: modem.sent ? "sent" : "failed",
      reason: modem.sent ? "" : SIM_FAIL,
      via: modem.via || "",
      relatedType,
      relatedId,
      actor,
    }).catch(() => null);
  }
  if (modem.sent) return modem;
  return { sent: false, failed: true, reason: SIM_FAIL, to: normalizedTo };
}

async function retryFailedSms(row, actor) {
  const result = await sendSms({
    to: row.to,
    body: row.body,
    relatedType: row.relatedType,
    relatedId: row.relatedId,
    actor: actor || row.actor,
    record: false,
  });
  row.status = result.sent ? "sent" : "failed";
  row.via = result.via || "";
  row.reason = result.sent ? "" : SIM_FAIL;
  await row.save();
  return row;
}

async function sendReceiptConfirmationSms({ to, receiptNumber, trackUrl, relatedId }) {
  return sendSms({
    to,
    body: `${storeName()}: your quote ${receiptNumber} is ready. Track it here: ${trackUrl}`,
    relatedType: "quote",
    relatedId,
  });
}

async function sendReceiptUpdateSms({ to, receiptNumber, statusLabel, message, trackUrl, relatedId }) {
  const statusPart = statusLabel ? ` ${statusLabel}.` : ".";
  const note = message ? ` ${String(message).trim()}` : "";
  return sendSms({
    to,
    body: `${storeName()} update for ${receiptNumber}:${statusPart}${note} Details: ${trackUrl}`,
    relatedType: "quote-update",
    relatedId,
  });
}

async function sendReceiptPaidSms({ to, receiptNumber, total, trackUrl, relatedId }) {
  const amount = Number.isFinite(Number(total)) ? Number(total).toFixed(2) : "0.00";
  return sendSms({
    to,
    body: `${storeName()}: receipt ${receiptNumber} paid. Total $${amount}. ${trackUrl}`,
    relatedType: "receipt-paid",
    relatedId,
  });
}

async function sendGroceryInStockSms({ to, itemTitle, productName, relatedId }) {
  const listed = productName ? ` (${productName})` : "";
  return sendSms({
    to,
    body: `${storeName()}: ${itemTitle}${listed} is in stock. Call (905) 893-1613 or stop by.`,
    relatedType: "grocery-stock",
    relatedId,
  });
}

module.exports = {
  SIM_FAIL,
  normalizePhoneNumber,
  sendSms,
  retryFailedSms,
  sendReceiptConfirmationSms,
  sendReceiptUpdateSms,
  sendReceiptPaidSms,
  sendGroceryInStockSms,
};
