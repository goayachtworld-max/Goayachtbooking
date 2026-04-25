import { YachtModel } from "../models/yacht.model.js";
import { BookingModel } from "../models/booking.model.js";
// Create Yacht
export const createYacht = async (req, res, next) => {
  try {
    const yacht = await YachtModel.create({ ...req.body, company: req.user.company[0] });
    res.status(201).json({ success: true, yacht });
  } catch (error) {
    next(error);
  }
};

export const getAllYachts = async (req, res, next) => {
  try {
    const date = req.query.date;

    if (!date) {
      return res
        .status(400)
        .json({ success: false, message: "Date is required" });
    }

    // Start & End of day
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // 1️⃣ Fetch yachts
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

    const yachtIds = yachts.map((y) => y._id);

    // 2️⃣ Fetch bookings for those yachts for that day
    const bookings = await BookingModel.find({
      yachtId: { $in: yachtIds },
      date: { $gte: startOfDay, $lte: endOfDay },
      status: { $ne: "cancelled" }, // 🔥 Ignore cancelled bookings
    }).select("yachtId startTime endTime");

    // 3️⃣ Group bookings by yachtId
    const bookingsMap = {};

    bookings.forEach((booking) => {
      const yachtId = booking.yachtId.toString();

      if (!bookingsMap[yachtId]) {
        bookingsMap[yachtId] = [];
      }

      bookingsMap[yachtId].push(booking);
    });

    // 4️⃣ Format response
    const formatted = yachts.map((yacht) => ({
      id: yacht._id,
      _id: yacht._id,
      name: yacht.name,
      sailStartTime: yacht.sailStartTime,
      sailEndTime: yacht.sailEndTime,
      slotDurationMinutes: yacht.duration,
      specialSlots: yacht.specialSlotTimes,
      runningCost: yacht.runningCost,
      sailingCost: yacht.sailingCost,
      anchorageCost: yacht.anchorageCost,
      sailingMargin: yacht.sailingMargin,
      maxSellingPrice:yacht.maxSellingPrice,
      anchorageMargin: yacht.anchorageMargin,
      defaultSailingHours: yacht.defaultSailingHours,
      defaultAnchoringHours: yacht.defaultAnchoringHours,
      capacity: yacht.capacity,
      status: yacht.status,
      slots: yacht.slots || [],
      bookings: bookingsMap[yacht._id.toString()] || [],
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

// ── PUBLIC: No auth required ──────────────────────────────────────────────────
// Returns only active yachts with websiteSale: true
// Strips internal cost fields before sending
export const getPublicYachts = async (req, res, next) => {
  try {
    // Optional ?date=YYYY-MM-DD — when provided, also return bookings + day-slots
    // so the frontend can mark slots as taken without needing a second request.
    const dateParam = req.query.date; // e.g. "2025-03-04"

    const yachts = await YachtModel.find(
      { status: "active", websiteSale: true },
      {
        // Exclude sensitive/internal fields
        runningCost: 0, anchorageCost: 0, sailingCost: 0,
        maxSellingPrice: 0, company: 0,
        registrationNumber: 0, captain: 0, driverName: 0, totalCrew: 0,
        // NOTE: slots intentionally kept — needed for date-specific slot overrides
      }
    )
      .populate({ path: "slots", select: "date slots" })  // Slot model: { date, slots:[{start,end}] }
      .lean();

    const yachtIds = yachts.map(y => y._id);

    // Fetch confirmed/pending bookings for the requested date (to show taken slots)
    let bookingsMap = {};
    if (dateParam) {
      const startOfDay = new Date(dateParam); startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(dateParam); endOfDay.setHours(23, 59, 59, 999);

      const bookings = await BookingModel.find({
        yachtId: { $in: yachtIds },
        date: { $gte: startOfDay, $lte: endOfDay },
        status: { $in: ["pending", "initiated", "confirmed"] },
      }).select("yachtId startTime endTime date").lean();

      bookings.forEach(b => {
        const id = b.yachtId.toString();
        if (!bookingsMap[id]) bookingsMap[id] = [];
        bookingsMap[id].push({ startTime: b.startTime, endTime: b.endTime });
      });
    }

    const shaped = yachts.map(({ yachtPhotos, ...rest }) => ({
      ...rest,
      photos: yachtPhotos || [],
      // bookings for the requested date (empty array if no date param or no bookings)
      bookings: bookingsMap[rest._id?.toString()] || [],
    }));

    res.json({ success: true, yachts: shaped });
  } catch (error) {
    next(error);
  }
};
// ─────────────────────────────────────────────────────────────────────────────