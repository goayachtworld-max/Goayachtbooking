import mongoose from "mongoose";

const yachtSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    capacity: { type: Number, required: true }, // max pax
    runningCost: { type: Number, required: true },
    maxSellingPrice: { type: Number, required: true },
    sellingPrice: { type: Number, required: true },
    yachtPhotos: [String],
    sailStartTime: {
      type: String,
      required: true,
      match: [
        /^(?:[01]\d|2[0-3]):[0-5]\d$/,
        "Start Time must be in HH:MM format",
      ],
    },
    sailEndTime: {
      type: String,
      required: true,
      match: [
        /^(?:[01]\d|2[0-3]):[0-5]\d$/,
        "End Time must be in HH:MM format",
      ],
    },
    duration: {
      type: String,
      required: true,
      match: [/^(?:[01]\d|2[0-3]):[0-5]\d$/, "Duration"],
    },
    specialSlotTimes: [{
      type: String,
      match: [
        /^(?:[01]\d|2[0-3]):[0-5]\d$/,
        "Special Slot Time must be in HH:MM format",
      ],
    }],
    company: {
      type: String,
      required: true,
    },
    slots: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Slot",
      },
    ],
    // Extra details
    boardingLocation: { type: String },
    description: { type: String },
    registrationNumber: { type: String },
    size: { type: String },
    captain: { type: String },
    company: { type: String },
    driverName: { type: String },
    totalCrew: { type: Number },
    sailingArea: { type: String, enum: ["Seaside", "Backwaters"] },

    // Sale options
    agentsSale: { type: Boolean, default: true },
    websiteSale: { type: Boolean, default: true },

    // Availability tracking
    status: { type: String, enum: ["active", "inactive"], default: "active" },
  },
  { timestamps: true }
);

export const YachtModel = mongoose.model("Yacht", yachtSchema);
