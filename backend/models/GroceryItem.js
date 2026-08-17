const mongoose = require("mongoose");

const GroceryItemSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    notes: { type: String, default: "" },

    status: {
      type: String,
      enum: ["pending", "purchased", "cancelled"],
      default: "pending",
    },

    priority: {
      type: String,
      enum: ["high", "normal", "low"],
      default: "normal",
      index: true,
    },

    customerRequest: {
      name: { type: String, trim: true, default: "" },
      email: { type: String, trim: true, default: "" },
      phone: { type: String, trim: true, default: "" },
      notify: { type: String, enum: ["none", "email", "text", "both"], default: "none" },
    },

    // - Match keys: barcode/SKU used to notify the customer when stock returns.
    matchBarcode: { type: String, default: "", trim: true, index: true },
    matchItemNumber: { type: String, default: "", trim: true },

    stockNotifiedAt: { type: Date },
    linkedInventoryId: { type: mongoose.Schema.Types.ObjectId, ref: "Inventory" },
  },
  { timestamps: true }
);

GroceryItemSchema.index({ status: 1, matchBarcode: 1 });
GroceryItemSchema.index({ status: 1, matchItemNumber: 1 });

module.exports = mongoose.model("GroceryItem", GroceryItemSchema);
