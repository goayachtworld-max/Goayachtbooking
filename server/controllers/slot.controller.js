import { SlotModel } from "../models/slot.model.js";
import { YachtModel } from "../models/yacht.model.js";

export const createOrUpdateSlot = async (req, res) => {
  try {
    const { yachtId, date, slots } = req.body;
    console.log("Inside createOrUpdateSlot:", req.body);

    if (!yachtId || !date || !Array.isArray(slots)) {
      return res.status(400).json({
        success: false,
        message: "yachtId, date, and slots are required",
      });
    }

    // Normalize date
    const d = new Date(date);
    const startOfDay = new Date(d);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(d);
    endOfDay.setHours(23, 59, 59, 999);

    // Ensure yacht exists (no save here)
    const yachtExists = await YachtModel.exists({ _id: yachtId });
    if (!yachtExists) {
      return res.status(404).json({
        success: false,
        message: "Yacht not found",
      });
    }

    // Find existing slot
    let slot = await SlotModel.findOne({
      yachtId,
      date: { $gte: startOfDay, $lte: endOfDay },
    });

    // Update slot
    if (slot) {
      slot.slots = slots;
      await slot.save();
    }
    // Create slot
    else {
      slot = await SlotModel.create({
        yachtId,
        date: startOfDay,
        slots,
      });
    }

    // ✅ SAFE UPDATE: no validation triggered
    await YachtModel.updateOne(
      { _id: yachtId },
      { $addToSet: { slots: slot._id } } // prevents duplicates
    );

    return res.status(slot.isNew ? 201 : 200).json({
      success: true,
      message: slot.isNew
        ? "Slot created successfully"
        : "Slot updated successfully",
      data: slot,
    });

  } catch (error) {
    console.error("createOrUpdateSlot error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};


// ============================================================
// GET ALL SLOTS FOR A YACHT
// ============================================================
export const getSlotsByYacht = async (req, res) => {
    try {
        const { yachtId } = req.params;

        const slots = await SlotModel.find({ yachtId }).sort({ date: 1 });

        return res.status(200).json({
            success: true,
            message: "Slots fetched",
            data: slots
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Server Error" });
    }
};

