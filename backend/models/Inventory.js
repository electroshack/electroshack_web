const mongoose = require("mongoose");

const InventorySchema = new mongoose.Schema(
  {
    itemNumber: { type: String, required: true, unique: true, index: true },
    /** Retail UPC/EAN when present; separate from device IDs */
    barcode: { type: String, default: "", trim: true },
    /** Primary cellular IMEI (phones, cellular iPad / Apple Watch, etc.) */
    imei: { type: String, default: "", trim: true },
    /** Manufacturer serial — primary laptop ID; pairs with IMEI on phones/tablets */
    serialNumber: { type: String, default: "", trim: true },
    name: { type: String, required: true },
    description: { type: String, default: "" },
    category: {
      type: String,
      enum: [
        "cell-phone",
        "laptop",
        "pc",
        "tablet",
        "smartwatch",
        "accessory",
        "part",
        "other",
      ],
      required: true,
    },
    condition: {
      type: String,
      enum: ["new", "refurbished", "used", "for-parts"],
      default: "used",
    },

    costPrice: { type: Number, default: 0 },
    sellingPrice: { type: Number, default: 0 },

    boughtFrom: { type: String, default: "" },
    boughtFromPhone: { type: String, default: "" },
    dateBought: { type: Date },
    purchaseNotes: { type: String, default: "" },

    soldTo: { type: String, default: "" },
    soldToPhone: { type: String, default: "" },
    dateSold: { type: Date },
    saleNotes: { type: String, default: "" },
    saleReceiptNumber: { type: String, default: "" },

    quantity: { type: Number, default: 1 },
    status: {
      type: String,
      enum: ["in-stock", "sold", "reserved", "returned"],
      default: "in-stock",
    },

    showOnStorefront: { type: Boolean, default: true },
    images: [{ type: String }],
    notes: { type: String, default: "" },
  },
  { timestamps: true }
);

InventorySchema.index({ name: "text", description: "text", itemNumber: "text" });
InventorySchema.index(
  { barcode: 1 },
  {
    unique: true,
    partialFilterExpression: { barcode: { $type: "string", $regex: /.+/ } },
  }
);
InventorySchema.index({ imei: 1 }, { sparse: true });
InventorySchema.index({ serialNumber: 1 }, { sparse: true });

module.exports = mongoose.model("Inventory", InventorySchema);
