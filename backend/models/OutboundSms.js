const mongoose = require("mongoose");

const OutboundSmsSchema = new mongoose.Schema(
  {
    to: { type: String, required: true },
    body: { type: String, required: true },
    status: {
      type: String,
      enum: ["sent", "failed"],
      default: "failed",
      index: true,
    },
    reason: { type: String, default: "" },
    via: { type: String, default: "" },
    relatedType: { type: String, default: "" },
    relatedId: { type: String, default: "" },
    actor: { type: String, default: "system" },
  },
  { timestamps: true }
);

OutboundSmsSchema.index({ createdAt: -1 });

module.exports = mongoose.model("OutboundSms", OutboundSmsSchema);
