import mongoose from "mongoose";

const slotSchema = new mongoose.Schema(
  {
    yachtId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Yacht",
      required: true,
    },

    date: {
      type: Date,   // IMPORTANT: REAL DATE TYPE
      required: true,
    },

    slots: [
      {
        start: { type: String, required: true },   // HH:MM
        end: { type: String, required: true },     // HH:MM
      },
    ],
  },
  { timestamps: true }
);

/* -----------------------------------------
   AUTO DELETE EXPIRED SLOTS AUTOMATICALLY
------------------------------------------ */
slotSchema.pre(["find", "findOne"], async function () {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  await mongoose.model("Slot").deleteMany({
    date: { $lt: today }, // now works because 'date' is a real Date
  });
});

export const SlotModel = mongoose.model("Slot", slotSchema);
