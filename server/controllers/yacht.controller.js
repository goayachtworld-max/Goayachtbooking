import { YachtModel } from "../models/yacht.model.js";

// Create Yacht
export const createYacht = async (req, res, next) => {
  try {
    const yacht = await YachtModel.create({ ...req.body, company: req.user.company[0] });
    res.status(201).json({ success: true, yacht });
  } catch (error) {
    next(error);
  }
};

// create booking
export const getAllYachts = async (req, res, next) => {
  try {
    const date = req.query.date; // date comes as string "YYYY-MM-DD"
    if (!date) {
      return res
        .status(400)
        .json({ success: false, message: "Date is required" });
    }

    // Convert date string to start and end of day
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // Fetch yachts
    const yachts = await YachtModel.find({
      company: { $in: req.user.company },
      status: "active",
    }).populate({
      path: "slots",
      match: {
        date: { $gte: startOfDay, $lte: endOfDay },
      },
      select: "date slots",
    });

    // Format response
    const formatted = yachts.map((yacht) => ({
      id: yacht._id,
      _id:yacht._id,
      name: yacht.name,
      sailStartTime: yacht.sailStartTime,
      sailEndTime: yacht.sailEndTime,
      slotDurationMinutes: yacht.duration,
      specialSlots: yacht.specialSlotTimes,
      runningCost: yacht.runningCost,
      status: yacht.status,
      slots: yacht.slots || [],
    }));

    res.json({ success: true, yachts: formatted });
  } catch (error) {
    next(error);
  }
};

// Used for Yacht management
export const getAllYachtsDetails = async (req, res, next) => {
  try {
    const yachts = await YachtModel.find({ company: { $in: req.user.company } });
    res.json({ success: true, yachts });
  } catch (error) {
    next(error);
  }
};

// Get Yacht by ID
export const getYachtById = async (req, res, next) => {
  try {
    const yacht = await YachtModel.findOne({ _id: req.params.id, company: { $in: req.user.company } });
    if (!yacht) return res.status(404).json({ success: false, message: "Yacht not found" });
    res.json({ success: true, yacht });
  } catch (error) {
    next(error);
  }
};


export const updateYacht = async (req, res, next) => {
  try {
    const yachtId = req.params.id;

    const existingYacht = await YachtModel.findOne({
      _id: yachtId,
      company: { $in: req.user.company }
    });

    if (!existingYacht) {
      return res.status(404).json({
        success: false,
        message: "Yacht not found",
      });
    }

    const removed = Array.isArray(req.body.removedPhotos)
      ? req.body.removedPhotos
      : [];

    const newImages = Array.isArray(req.body.yachtPhotos)
      ? req.body.yachtPhotos
      : [];

    // 🧠 Build final images array
    let finalPhotos = existingYacht.yachtPhotos.filter(
      (url) => !removed.includes(url)
    );

    finalPhotos.push(...newImages);

    const excluded = ["removedPhotos", "yachtPhotos"];
    const setFields = {};

    for (const key in req.body) {
      if (!excluded.includes(key)) {
        setFields[key] = req.body[key];
      }
    }

    // ✅ Single update operator for yachtPhotos
    setFields.yachtPhotos = finalPhotos;

    const yacht = await YachtModel.findByIdAndUpdate(
      yachtId,
      { $set: setFields },
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      yacht,
      previousImages: existingYacht.yachtPhotos.length,
      removedImages: removed.length,
      addedImages: newImages.length,
      finalImages: yacht.yachtPhotos.length,
    });
  } catch (err) {
    console.error("❌ Server Error:", err);
    next(err);
  }
};

export const deleteYacht = async (req, res, next) => {
  try {
    const yacht = await YachtModel.findOneAndDelete({
      _id: req.params.id,
      company: { $in: req.user.company }
    });

    if (!yacht)
      return res
        .status(404)
        .json({ success: false, message: "Yacht not found" });

    res.json({ success: true, message: "Yacht deleted successfully" });
  } catch (error) {
    next(error);
  }
};


