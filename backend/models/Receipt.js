const mongoose = require("mongoose");

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

    items: [LineItemSchema],

    priceEstimate: { type: Number, default: 0 },
    finalPrice: { type: Number, default: 0 },
    gst: { type: Number, default: 0 },
    pst: { type: Number, default: 0 },

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
  },
  { timestamps: true }
);

ReceiptSchema.index({ customerName: "text", customerPhone: "text" });

module.exports = mongoose.model("Receipt", ReceiptSchema);
