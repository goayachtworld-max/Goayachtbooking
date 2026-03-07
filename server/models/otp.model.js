import mongoose from "mongoose";

/**
 * Stores OTPs temporarily.
 * MongoDB TTL index auto-deletes expired records.
 */
const otpSchema = new mongoose.Schema({
  phone: {
    type: String,
    required: true,
    index: true,
  },
  otp: {
    type: String,
    required: true,
  },
  expiresAt: {
    type: Date,
    required: true,
    index: { expires: 0 }, // TTL: MongoDB auto-deletes when expiresAt is reached
  },
  attempts: {
    type: Number,
    default: 0,
  },
  verified: {
    type: Boolean,
    default: false,
  },
}, { timestamps: true });

export const OtpModel = mongoose.model("Otp", otpSchema);