// models/waMessageLog.model.js
// One row per automatic WhatsApp message attempt (sent / failed / skipped).
// Lets you answer "did the customer get the cancellation message?" and stops
// the same cancellation message from being sent twice.
import mongoose from "mongoose";

const waMessageLogSchema = new mongoose.Schema(
  {
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", index: true, required: true },
    event: { type: String, enum: ["confirmed", "cancelled", "updated"], required: true },
    to: { type: String, default: null }, // international number, digits only
    status: { type: String, enum: ["sent", "failed", "skipped"], required: true },
    reason: { type: String, default: null },
    text: { type: String, default: null },
  },
  { timestamps: true }
);

export const WaMessageLogModel = mongoose.model("WaMessageLog", waMessageLogSchema);
