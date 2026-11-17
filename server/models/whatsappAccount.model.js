// models/whatsappAccount.model.js
// One row per WhatsApp number that can send booking messages:
//   - the COMPANY account  (key "c-<companyId>")  set up by the company admin;
//     used for bookings owned by admin / staff and for public-website bookings
//   - an AGENT account     (key "e-<employeeId>") set up by the agent;
//     used for bookings owned by that agent
// (The "system" account that sends customer login codes is not stored here.)
// The WhatsApp login itself lives on disk in .wa-session/, never in the database.
import mongoose from "mongoose";

const whatsappAccountSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    ownerType: { type: String, enum: ["company", "employee"], required: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", default: null },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", default: null },
    label: { type: String, default: "" },
    linked: { type: Boolean, default: false },   // true once a phone has been linked
    enabled: { type: Boolean, default: true },
    status: { type: String, default: "stopped" }, // last known connection state
    phone: { type: String, default: null },       // linked number (digits)
    lastError: { type: String, default: null },
    lastConnectedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export const WhatsAppAccountModel = mongoose.model("WhatsAppAccount", whatsappAccountSchema);
