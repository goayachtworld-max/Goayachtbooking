import express from "express";
import {
  createYacht,
  getAllYachts,
  getYachtById,
  updateYacht,
  deleteYacht,
  getAllYachtsDetails,
} from "../controllers/yacht.controller.js";

import { yachtSchema } from "../validators/yacht.validator.js";
import { validate } from "../middleware/validate.js";
import { upload, uploadFileToCloudinaryV2, uploadToCloudinary } from "../middleware/upload.js";
import { authMiddleware, onlyAdmin } from "../middleware/auth.js";

const router = express.Router();

// validate(yachtSchema), -- Removed as it is deleting special slot time
router.post(
  "/",
  authMiddleware,
  onlyAdmin,
  upload.array("yachtPhotos"), // multer array
  async (req, res, next) => {
    try {
      console.log("🔹 onlyAdmin middleware invoked");
      console.log("User info:", req.user);
      console.log("Form fields (req.body):", req.body);
      console.log("Uploaded files:", req.files?.map(f => f.originalname));

      if (req.files && req.files.length > 0) {
        const uploadedUrls = [];
        for (const file of req.files) {
          const url = await uploadFileToCloudinaryV2(file, "yaut/yachts");
          uploadedUrls.push(url);
        }
        req.body.yachtPhotos = uploadedUrls; // now properly set
      }

      next(); // continue to Zod validation
    } catch (err) {
      next(err);
    }
  },
  validate(yachtSchema),
  createYacht
);


// Get all yachts
router.get("/", authMiddleware, getAllYachts);
router.get("/details", authMiddleware, onlyAdmin, getAllYachtsDetails);

// Get yacht by ID
router.get("/:id", authMiddleware, getYachtById);

// Update yacht (Admin Only)
router.put(
  "/:id",
  authMiddleware,
  onlyAdmin,
  upload.array("yachtPhotos"),
  (req, res, next) => {
    if (req.files) {
      req.body.yachtPhotos = req.files.map(file => file.path || file.buffer);
    }
    next();
  },
  validate(yachtSchema),
  uploadToCloudinary("yaut/yachts"),
  updateYacht
);

// Delete yacht (Admin Only)
router.delete("/:id", authMiddleware, onlyAdmin, deleteYacht);

export default router;
