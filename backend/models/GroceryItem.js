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

    customerRequest: {
      name: { type: String, default: "" },
      email: { type: String, default: "" },
      phone: { type: String, default: "" },
    },

    /** When set, matching inventory triggers an email when the item becomes in-stock */
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
