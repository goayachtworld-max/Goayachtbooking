import mongoose from "mongoose";

const availabilitySchema = new mongoose.Schema(
  {
    yachtId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Yacht",
      required: true,
    },
    date: { type: String, required: true }, // e.g. "2025-10-11"
    startTime: { type: String, required: true }, // e.g. "09:00"
    endTime: { type: String, required: true },

    status: {
      type: String,
      enum: ["available", "locked", "booked"],
      default: "available",
    },

    // 👇 Who locked or booked it
    appliedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
    },

    // ⏰ TTL field → set to actual trip end datetime
    deleteAfter: {
      type: Date,
      index: { expireAfterSeconds: 0 }, // auto-delete when this time passes
    },

    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
    },
  },
  { timestamps: true }
);

// Ensure TTL index is created
availabilitySchema.index({ deleteAfter: 1 }, { expireAfterSeconds: 0 });

export const AvailabilityModel = mongoose.model(
  "Availability",
  availabilitySchema
);
