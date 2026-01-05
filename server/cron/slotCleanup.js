import cron from "node-cron";
import {SlotModel} from "../models/slot.model.js";
import {YachtModel} from "../models/yacht.model.js";

cron.schedule("5 0 * * *", async () => {
  try {
    console.log("🧹 Running auto-delete expired slots...");
    const today = new Date().toISOString().split("T")[0];
    const expiredSlots = await SlotModel.find({ date: { $lt: today } });
    if (expiredSlots.length === 0) {
      console.log("✨ No expired slots found.");
      return;
    }
    console.log(`🗑 Found ${expiredSlots.length} expired slots.`);
    for (const slot of expiredSlots) {
      await YachtModel.updateMany(
        { slots: slot._id },
        { $pull: { slots: slot._id } }
      );
    }
    await SlotModel.deleteMany({ date: { $lt: today } });
    console.log("✔ Expired slots cleaned successfully.");
  } catch (error) {
    console.error("❌ Error in slot cleanup cron:", error);
  }
});
