import { SlotModel } from "../models/slot.model.js";
import { YachtModel } from "../models/yacht.model.js";
import {
  reconcileLayout,
  getProtectedRanges,
  toDateKey,
} from "../utils/daySlots.js";

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

    // Validate payload shape
    const timeRe = /^\d{1,2}:\d{2}$/;
    const bad = slots.find(
      (s) => !s || !timeRe.test(String(s.start)) || !timeRe.test(String(s.end))
    );
    if (bad) {
      return res.status(400).json({
        success: false,
        message: "Every slot needs start and end in HH:MM format",
      });
    }

    // SINGLE SOURCE OF TRUTH: bookings and locks always win.
    // Whatever layout the client sends, the saved layout must contain the exact
    // booked/locked ranges and must not overlap them.
    const dateKey = toDateKey(date);
    const protectedRanges = await getProtectedRanges(yachtId, dateKey);
    const requested = slots.map((s) => ({ start: s.start, end: s.end }));
    const finalSlots = reconcileLayout(requested, protectedRanges);

    const norm = (arr) => arr.map((s) => `${s.start}-${s.end}`).sort().join("|");
    const adjusted = norm(finalSlots) !== norm(
      reconcileLayout(requested, [])   // same sort/merge, without bookings
    );

    // Find existing slot
    let slot = await SlotModel.findOne({
      yachtId,
      date: { $gte: startOfDay, $lte: endOfDay },
    });

    let created = false;
    if (slot) {
      slot.slots = finalSlots;
      await slot.save();
    } else {
      slot = await SlotModel.create({
        yachtId,
        date: startOfDay,
        slots: finalSlots,
      });
      created = true;
    }

    await YachtModel.updateOne(
      { _id: yachtId },
      { $addToSet: { slots: slot._id } } // prevents duplicates
    );

    return res.status(created ? 201 : 200).json({
      success: true,
      message: created ? "Slot created successfully" : "Slot updated successfully",
      adjusted, // true => server kept booked/locked times intact
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

