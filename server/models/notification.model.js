import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema({
  company: {
    type: String,
    required: true,
  },

  title: String,
  message: String,

  type: {
    type: String,
    enum: [
      "booking_created",
      "booking_status_updated",
      "payment_received",
    ],
  },

  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Booking",
  },

  recipients: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Employee",
  }],

  readBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Employee",
  }],
}, { timestamps: true });

notificationSchema.index({ recipients: 1 });
notificationSchema.index({ readBy: 1 });

export const NotificationModel = mongoose.model(
  "Notification",
  notificationSchema
);
