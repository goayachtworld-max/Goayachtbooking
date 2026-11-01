// models/passwordReset.model.js
// One row per "forgot password" request. Only a SHA-256 hash of the token is
// stored, so a database leak cannot be used to reset anyone's password.
import mongoose from "mongoose";

const passwordResetSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
      index: true,
    },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    consumedAt: { type: Date, default: null }, // set when used OR replaced by a newer link
    requestIp: { type: String, default: null },
  },
  { timestamps: true }
);

// Rows are deleted automatically one day after the link expires.
passwordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 24 * 60 * 60 });

export const PasswordResetModel = mongoose.model("PasswordReset", passwordResetSchema);
