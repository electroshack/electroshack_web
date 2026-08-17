const mongoose = require("mongoose");

const SnapshotSchema = new mongoose.Schema(
  {
    quantity: { type: Number, default: 0 },
    status: { type: String, default: "in-stock" },
    showOnStorefront: { type: Boolean, default: true },
    soldTo: { type: String, default: "" },
    dateSold: { type: Date, default: null },
    saleReceiptNumber: { type: String, default: "" },
  },
  { _id: false }
);

const StockEventSchema = new mongoose.Schema(
  {
    inventoryItemId: { type: mongoose.Schema.Types.ObjectId, ref: "Inventory", required: true, index: true },
    itemNumber: { type: String, default: "", index: true },
    itemName: { type: String, default: "" },
    actor: { type: String, default: "staff" },
    reason: {
      type: String,
      enum: ["sale", "manual", "undo", "restock"],
      required: true,
      index: true,
    },
    oldQuantity: { type: Number, required: true },
    newQuantity: { type: Number, required: true },
    oldStatus: { type: String, required: true },
    newStatus: { type: String, required: true },
    receiptId: { type: mongoose.Schema.Types.ObjectId, ref: "Receipt", default: null, index: true },
    receiptNumber: { type: String, default: "" },
    saleQty: { type: Number, default: 0 },
    previousSnapshot: { type: SnapshotSchema, default: () => ({}) },
    undoesEventId: { type: mongoose.Schema.Types.ObjectId, ref: "StockEvent", default: null },
  },
  { timestamps: true }
);

StockEventSchema.index({ createdAt: -1 });
StockEventSchema.index({ newStatus: 1, createdAt: -1 });

module.exports = mongoose.model("StockEvent", StockEventSchema);
