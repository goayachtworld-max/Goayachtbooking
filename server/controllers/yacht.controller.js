import { YachtModel } from "../models/yacht.model.js";

// Create Yacht
export const createYacht = async (req, res, next) => {
  try {
    console.log("Here is req , ", req.body);
    const yacht = await YachtModel.create({ ...req.body, company: req.user.company });

    res.status(201).json({ success: true, yacht });
  } catch (error) {
    next(error);
  }
};

export const getAllYachts = async (req, res, next) => {
  try {
    const date = req.query.date; // date comes as string "YYYY-MM-DD"
    console.log("Here is date ", date);

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
      company: req.user.company,
      status: "active",
    }).populate({
      path: "slots",
      match: {
        date: { $gte: startOfDay, $lte: endOfDay },
      },
      select: "date slots", // pick fields you need
    });

    // Format response
    const formatted = yachts.map((yacht) => ({
      id: yacht._id,
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
    const yachts = await YachtModel.find({ company: req.user.company });
    res.json({ success: true, yachts });
  } catch (error) {
    next(error);
  }
};

// Get Yacht by ID
export const getYachtById = async (req, res, next) => {
  try {
    const yacht = await YachtModel.findOne({ _id: req.params.id, company: req.user.company });
    if (!yacht) return res.status(404).json({ success: false, message: "Yacht not found" });
    res.json({ success: true, yacht });
  } catch (error) {
    next(error);
  }
};

// Update Yacht
// export const updateYacht = async (req, res, next) => {
//   try {
//     const { newPhotos, ...otherFields } = req.body;

//     const updateData = { ...otherFields };
//     console.log("Here is updated yacht ", updateData)
//     // ✅ Add photos to existing array if provided
//     if (newPhotos && Array.isArray(newPhotos)) {
//       updateData.$push = { yachtPhotos: { $each: newPhotos } };
//     }

//     const yacht = await YachtModel.findOneAndUpdate(
//       {
//         _id: req.params.id,
//         company: req.user.company
//       },
//       updateData,
//       { new: true, runValidators: true }
//     );

//     if (!yacht) {
//       return res
//         .status(404)
//         .json({ success: false, message: "Yacht not found or inactive" });
//     }

//     res.json({ success: true, yacht });
//   } catch (error) {
//     next(error);
//   }
// };

// export const updateYacht = async (req, res, next) => {
//   try {
//     const { removedPhotos } = req.body;

//     // -------------------------------------------------
//     // 1️⃣ Fetch existing yacht first (for logging)
//     // -------------------------------------------------
//     const existingYacht = await YachtModel.findOne({
//       _id: req.params.id,
//       company: req.user.company,
//     });

//     if (!existingYacht) {
//       return res.status(404).json({
//         success: false,
//         message: "Yacht not found",
//       });
//     }

//     const previousImages = existingYacht.yachtPhotos || [];

//     console.log("🟡 Previous yacht images count:", previousImages.length);

//     // -------------------------------------------------
//     // 2️⃣ Build update object
//     // -------------------------------------------------
//     let update = { ...req.body };

//     // -------------------------------------------------
//     // 3️⃣ Handle removed photos (SAFE parse)
//     // -------------------------------------------------
//     let removedImagesArray = [];

//     if (removedPhotos) {
//       if (typeof removedPhotos === "string") {
//         try {
//           removedImagesArray = JSON.parse(removedPhotos);
//         } catch {
//           removedImagesArray = [removedPhotos];
//         }
//       } else if (Array.isArray(removedPhotos)) {
//         removedImagesArray = removedPhotos;
//       }

//       if (removedImagesArray.length > 0) {
//         update.$pull = {
//           yachtPhotos: { $in: removedImagesArray },
//         };
//       }
//     }

//     console.log("🔴 Removed images count:", removedImagesArray.length);

//     // -------------------------------------------------
//     // 4️⃣ Handle new uploaded photos
//     // -------------------------------------------------
//     let newImagesArray = [];

//     if (req.body.yachtPhotos?.length > 0) {
//       newImagesArray = Array.isArray(req.body.yachtPhotos)
//         ? req.body.yachtPhotos
//         : [req.body.yachtPhotos];

//       update.$push = update.$push || {};
//       update.$push.yachtPhotos = {
//         $each: newImagesArray,
//       };
//     }

//     console.log("🟢 New images added count:", newImagesArray.length);

//     // -------------------------------------------------
//     // 5️⃣ Cleanup non-schema fields
//     // -------------------------------------------------
//     delete update.removedPhotos;

//     // -------------------------------------------------
//     // 6️⃣ Perform update
//     // -------------------------------------------------
//     const updatedYacht = await YachtModel.findOneAndUpdate(
//       { _id: req.params.id, company: req.user.company },
//       update,
//       { new: true, runValidators: true }
//     );

//     // -------------------------------------------------
//     // 7️⃣ Final image count
//     // -------------------------------------------------
//     const finalImages = updatedYacht?.yachtPhotos || [];

//     console.log("✅ Final yacht images count:", finalImages.length);

//     // -------------------------------------------------
//     // 8️⃣ Response
//     // -------------------------------------------------
//     res.json({
//       success: true,
//       yacht: updatedYacht,
//       imageStats: {
//         previous: previousImages.length,
//         removed: removedImagesArray.length,
//         added: newImagesArray.length,
//         final: finalImages.length,
//       },
//     });
//   } catch (err) {
//     console.error("❌ updateYacht error:", err);
//     next(err);
//   }
// };


// export const updateYacht = async (req, res, next) => {
//   try {
//     const yachtId = req.params.id;

//     const existingYacht = await YachtModel.findOne({
//       _id: yachtId,
//       company: req.user.company,
//     });

//     if (!existingYacht) {
//       return res.status(404).json({
//         success: false,
//         message: "Yacht not found",
//       });
//     }

//     console.log(
//       "🟡 Previous yacht images count:",
//       existingYacht.yachtPhotos.length
//     );

//     const update = {};

//     /* ---------------- REMOVE IMAGES ---------------- */

//     const toRemove = Array.isArray(req.body.removedPhotos)
//       ? req.body.removedPhotos
//       : [];

//     console.log("🔴 Removed images count:", toRemove.length);

//     if (toRemove.length > 0) {
//       update.$pull = {
//         yachtPhotos: { $in: toRemove },
//       };
//     }

//     /* ---------------- ADD NEW IMAGES ---------------- */

//     const newImages = Array.isArray(req.body.yachtPhotos)
//       ? req.body.yachtPhotos
//       : [];

//     console.log("🟢 New images added count:", newImages.length);

//     if (newImages.length > 0) {
//       update.$push = {
//         yachtPhotos: { $each: newImages },
//       };
//     }

//     /* ---------------- OTHER FIELDS ---------------- */

//     const excluded = ["removedPhotos", "yachtPhotos"];

//     Object.keys(req.body).forEach((key) => {
//       if (!excluded.includes(key)) {
//         update[key] = req.body[key];
//       }
//     });

//     /* ---------------- UPDATE DB ---------------- */

//     const yacht = await YachtModel.findByIdAndUpdate(
//       yachtId,
//       update,
//       { new: true, runValidators: true }
//     );

//     console.log(
//       "✅ Final yacht images count:",
//       yacht.yachtPhotos.length
//     );

//     res.json({
//       success: true,
//       yacht,
//       previousImages: existingYacht.yachtPhotos.length,
//       removedImages: toRemove.length,
//       addedImages: newImages.length,
//       finalImages: yacht.yachtPhotos.length,
//     });
//   } catch (err) {
//     next(err);
//   }
// };

export const updateYacht = async (req, res, next) => {
  try {
    const yachtId = req.params.id;

    const existingYacht = await YachtModel.findOne({
      _id: yachtId,
      company: req.user.company,
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



// Delete Yacht 
export const deleteYacht = async (req, res, next) => {
  try {
    const yacht = await YachtModel.findOneAndDelete({
      _id: req.params.id,
      company: req.user.company,
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


