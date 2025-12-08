import { SlotModel } from "../models/slot.model.js";
import { YachtModel } from "../models/yacht.model.js";

export const createOrUpdateSlot = async (req, res) => {
  try {
    const { yachtId, date, slots } = req.body;
    console.log("Inside createOrUpdateSlot:", req.body);

    if (!yachtId || !date || !Array.isArray(slots)) {
      return res.status(400).json({ message: "yachtId, date, slots required" });
    }

    // Convert date to real JS Date (midnight)
    const d = new Date(date);
    const startOfDay = new Date(d.setHours(0, 0, 0, 0));
    const endOfDay = new Date(d.setHours(23, 59, 59, 999));

    // Ensure yacht exists
    const yacht = await YachtModel.findById(yachtId);
    if (!yacht) return res.status(404).json({ message: "Yacht not found" });

    // Check if slot for this day already exists
    let existingSlot = await SlotModel.findOne({
      yachtId,
      date: { $gte: startOfDay, $lte: endOfDay },
    });

    if (existingSlot) {
      existingSlot.slots = slots;
      await existingSlot.save();

      return res.status(200).json({
        success: true,
        message: "Slot updated successfully",
        data: existingSlot,
      });
    }

    // Create new slot record
    const newSlot = await SlotModel.create({
      yachtId,
      date: startOfDay,
      slots,
    });

    // Add reference to yacht
    if (!yacht.slots.includes(newSlot._id)) {
      yacht.slots.push(newSlot._id);
      await yacht.save();
    }

    console.log("New slot created:", newSlot);

    return res.status(201).json({
      success: true,
      message: "Slot created successfully",
      data: newSlot,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error", error: err.message });
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

