const mongoose = require("mongoose");
const crypto = require("crypto");

const ItemUpdateSchema = new mongoose.Schema({
  message: { type: String, required: true },
  date: { type: Date, default: Date.now },
  author: { type: String, default: "Staff" },
});

const LineItemSchema = new mongoose.Schema({
  description: { type: String, required: true },
  category: {
    type: String,
    enum: [
      "repair",
      "cell-phone-accessory",
      "cell-phone-purchase",
      "laptop-repair",
      "laptop-purchase",
      "pc-repair",
      "pc-purchase",
      "other",
    ],
    default: "repair",
  },
  price: { type: Number, default: 0 },
  status: {
    type: String,
    enum: [
      "received",
      "diagnosing",
      "waiting-for-parts",
      "in-progress",
      "ready-for-pickup",
      "customer-called",
      "completed",
      "cancelled",
    ],
    default: "received",
  },
  updates: [ItemUpdateSchema],
  notes: { type: String, default: "" },
  /** Optional link to an inventory row. Unlinked lines (repairs, one-offs) do not touch stock. */
  inventoryItemId: { type: mongoose.Schema.Types.ObjectId, ref: "Inventory", default: null },
  stockQty: { type: Number, default: 1 },
});

const CustomerMessageSchema = new mongoose.Schema({
  message: { type: String, required: true },
  date: { type: Date, default: Date.now },
  sender: { type: String, enum: ["customer", "staff"], required: true },
});

const ReceiptUpdateSchema = new mongoose.Schema({
  message: { type: String, required: true },
  date: { type: Date, default: Date.now },
  author: { type: String, default: "Staff" },
});

const ReceiptAuditEventSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      enum: ["created", "updated", "status-update", "line-update", "message", "deleted", "restored", "payment"],
      required: true,
    },
    actor: { type: String, default: "system" },
    note: { type: String, default: "" },
    date: { type: Date, default: Date.now },
  },
  { _id: false }
);

const ReceiptSchema = new mongoose.Schema(
  {
    receiptNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    /** standard = sequential ES-YYYY-######; legacy = old paper / hash ids (LEG-...) */
    receiptKind: {
      type: String,
      enum: ["standard", "legacy"],
      default: "standard",
      index: true,
    },

    /** Optional note for digitized historical receipts (e.g. “written as #5521 on paper”). */
    legacyNote: { type: String, default: "" },

    customerName: { type: String, required: true },
    customerPhone: { type: String, required: true },
    customerEmail: { type: String, default: "" },
    customerAddress: { type: String, default: "" },
    date: { type: Date, default: Date.now },

    shipTo: { type: String, default: "" },
    via: { type: String, default: "" },
    terms: { type: String, default: "" },
    salesperson: { type: String, default: "" },

    // # quote = untaxed. receipt = sale with HST.
    documentType: {
      type: String,
      enum: ["quote", "receipt"],
      default: "quote",
      index: true,
    },

    items: [LineItemSchema],

    priceEstimate: { type: Number, default: 0 },
    subtotal: { type: Number, default: 0 },
    hst: { type: Number, default: 0 },
    total: { type: Number, default: 0 },

    status: {
      type: String,
      enum: [
        "received",
        "diagnosing",
        "waiting-for-parts",
        "in-progress",
        "ready-for-pickup",
        "customer-called",
        "completed",
        "cancelled",
      ],
      default: "received",
    },

    updates: [ReceiptUpdateSchema],
    messages: [CustomerMessageSchema],

    notes: { type: String, default: "" },

    payment: {
      method: {
        type: String,
        enum: ["unpaid", "cash", "terminal", "etransfer", "other"],
        default: "unpaid",
      },
      amountPaid: { type: Number, default: 0 },
      terminalRef: { type: String, default: "" },
      deviceLabel: { type: String, default: "" },
      paidAt: { type: Date, default: null },
      note: { type: String, default: "" },
      stockApplied: { type: Boolean, default: false },
      stockEventIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "StockEvent" }],
    },

    publicAccessToken: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },

    deletedAt: { type: Date, default: null, index: true },
    deletedBy: { type: String, default: "" },
    deleteReason: { type: String, default: "" },

    auditEvents: [ReceiptAuditEventSchema],
  },
  { timestamps: true }
);

ReceiptSchema.index({ customerName: "text", customerPhone: "text" });
ReceiptSchema.index({ deletedAt: 1, status: 1, receiptKind: 1 });

ReceiptSchema.methods.ensurePublicAccessToken = function ensurePublicAccessToken() {
  if (!this.publicAccessToken) {
    this.publicAccessToken = crypto.randomBytes(24).toString("base64url");
  }
  return this.publicAccessToken;
};

ReceiptSchema.methods.addAuditEvent = function addAuditEvent(action, actor = "system", note = "") {
  this.auditEvents.push({ action, actor, note });
};

ReceiptSchema.pre("validate", function ensureToken(next) {
  if (!this.publicAccessToken) this.ensurePublicAccessToken();
  next();
});

module.exports = mongoose.model("Receipt", ReceiptSchema);
