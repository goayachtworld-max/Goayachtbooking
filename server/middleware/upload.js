// src/middleware/upload.js
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";

dotenv.config();

/* =============================
   CLOUDINARY CONFIG
============================= */
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/* =============================
   MULTER CONFIG
============================= */
const storage = multer.memoryStorage();
export const upload = multer({ storage });

/* =============================
   UPLOAD MULTIPLE FILES
============================= */
export const uploadToCloudinary = (folderName) => async (req, res, next) => {
  console.log("📤 In Upload to Cloudinary Middleware");

  const files = Array.isArray(req.files) ? req.files : [];

  if (files.length === 0) {
    console.log("🟢 No new images received");
    return next();
  }

  try {
    const uploadedUrls = [];

    for (const file of files) {
      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: folderName },
          (err, res) => (err ? reject(err) : resolve(res))
        );
        stream.end(file.buffer);
      });

      uploadedUrls.push(result.secure_url);
    }

    if (uploadedUrls.length > 0) {
      req.body.yachtPhotos = uploadedUrls; // only assign if non-empty
    }

    console.log("✅ Uploaded images count:", uploadedUrls.length);
    next();
  } catch (err) {
    console.error("❌ Cloudinary upload failed:", err);
    res.status(500).json({ success: false });
  }
};



/* =============================
   SINGLE FILE HELPER (OPTIONAL)
============================= */
export const uploadFileToCloudinaryV2 = (file, folderName) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: folderName },
      (error, result) => {
        if (error) return reject(error);
        resolve(result.secure_url);
      }
    );
    stream.end(file.buffer);
  });
};
