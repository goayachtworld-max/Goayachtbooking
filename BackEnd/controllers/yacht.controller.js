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

// Get all Yachts (company-scoped & only active)
export const getAllYachts = async (req, res, next) => {
  try {
    const yachts = await YachtModel.find({
      company: req.user.company,
      status: "active",
    });

    // Return array of {id, name, ...} objects
    const formatted = yachts.map((yacht) => ({
      id: yacht._id,
      name: yacht.name,
      sailStartTime: yacht.sailStartTime,
      sailEndTime: yacht.sailEndTime,
      slotDurationMinutes: yacht.duration,
      specialSlots: yacht.specialSlotTimes,
      runningCost: yacht.runningCost,
      status: yacht.status,
    }));

    res.json({ success: true, yachts: formatted });
  } catch (error) {
    next(error);
  }
};


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
export const updateYacht = async (req, res, next) => {
  try {
    const { newPhotos, ...otherFields } = req.body;

    const updateData = { ...otherFields };
    console.log("Here is updated yacht " , updateData)
    // ✅ Add photos to existing array if provided
    if (newPhotos && Array.isArray(newPhotos)) {
      updateData.$push = { yachtPhotos: { $each: newPhotos } };
    }

    const yacht = await YachtModel.findOneAndUpdate(
      {
        _id: req.params.id,
        company: req.user.company
      },
      updateData,
      { new: true, runValidators: true }
    );

    if (!yacht) {
      return res
        .status(404)
        .json({ success: false, message: "Yacht not found or inactive" });
    }

    res.json({ success: true, yacht });
  } catch (error) {
    next(error);
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

