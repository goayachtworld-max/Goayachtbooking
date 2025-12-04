import { YachtModel } from "../models/yacht.model.js";

export const checkActiveYachtByParams = async (req, res, next) => {
  try {
    const yacht = await YachtModel.findOne({
      _id: req.params.yachtId,
      company: req.user.company,
    });

    if (!yacht) {
      return res.status(404).json({
        success: false,
        message: "Yacht not found",
      });
    }

    if (yacht.status !== "active") {
      return res.status(400).json({
        success: false,
        message: "Yacht is inactive and cannot be used",
      });
    }

    // Attach yacht to request (useful later)
    req.yacht = yacht;

    next();
  } catch (error) {
    next(error);
  }
};

export const checkActiveYachtByData = async (req, res, next) => {
  try {
    const yacht = await YachtModel.findOne({
      _id: req.body.yachtId,
      company: req.user.company,
    });

    if (!yacht) {
      return res.status(404).json({
        success: false,
        message: "Yacht not found",
      });
    }

    if (yacht.status !== "active") {
      return res.status(400).json({
        success: false,
        message: "Yacht is inactive and cannot be used",
      });
    }

    // Attach yacht to request (useful later)
    req.yacht = yacht;

    next();
  } catch (error) {
    next(error);
  }
};