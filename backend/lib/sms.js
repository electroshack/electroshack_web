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

function smsConfig() {
  return {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID,
    from: process.env.TWILIO_FROM_NUMBER,
  };
}

function clientForConfig({ accountSid, authToken }) {
  try {
    // Loaded lazily so installs without Twilio credentials still boot cleanly.
    const twilio = require("twilio");
    return twilio(accountSid, authToken);
  } catch (e) {
    return null;
  }
}

async function sendSms({ to, body }) {
  const normalizedTo = normalizePhoneNumber(to);
  if (!normalizedTo) return { sent: false, reason: "invalid-phone" };

  const cfg = smsConfig();
  if (!cfg.accountSid || !cfg.authToken || (!cfg.messagingServiceSid && !cfg.from)) {
    return { sent: false, reason: "twilio-not-configured" };
  }

  const client = clientForConfig(cfg);
  if (!client) return { sent: false, reason: "twilio-package-missing" };

  try {
    const payload = {
      to: normalizedTo,
      body: String(body || "").slice(0, 1500),
    };
    if (cfg.messagingServiceSid) payload.messagingServiceSid = cfg.messagingServiceSid;
    else payload.from = cfg.from;

    const msg = await client.messages.create(payload);
    return { sent: true, messageId: msg.sid, via: "twilio", to: normalizedTo };
  } catch (e) {
    console.error("[sms] send failed:", e?.message || e);
    return { sent: false, reason: e?.message || String(e), to: normalizedTo };
  }
}

async function sendReceiptConfirmationSms({ to, receiptNumber, trackUrl }) {
  return sendSms({
    to,
    body: `${storeName()}: your repair quote ${receiptNumber} is ready. Track it here: ${trackUrl}`,
  });
}

async function sendReceiptUpdateSms({ to, receiptNumber, statusLabel, message, trackUrl }) {
  const statusPart = statusLabel ? ` ${statusLabel}.` : ".";
  const note = message ? ` ${String(message).trim()}` : "";
  return sendSms({
    to,
    body: `${storeName()} update for ${receiptNumber}:${statusPart}${note} Details: ${trackUrl}`,
  });
}

module.exports = {
  normalizePhoneNumber,
  sendSms,
  sendReceiptConfirmationSms,
  sendReceiptUpdateSms,
};
