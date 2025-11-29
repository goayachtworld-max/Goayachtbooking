// src/middleware/upload.js
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = multer.memoryStorage();
export const upload = multer({ storage });

/**
 * Upload to Cloudinary under a specific folder
 * @param {string} folderName - The Cloudinary folder (e.g., 'yaut/payment')
 */
// export const uploadToCloudinary = (folderName) => async (req, res, next) => {
//   console.log("In Upload to Cloud")
//   if (!req.file) return next();
//   console.log("File is present")
//   try {
//     const stream = cloudinary.uploader.upload_stream(
//       { folder: folderName }, // ✅ Use passed folder name
//       (error, result) => {
//         if (error) return res.status(500).json({ error: "Cloudinary upload failed" });

//         req.cloudinaryUrl = result.secure_url; // Attach URL to request
//         next();
//       }
//     );

//     stream.end(req.file.buffer);
//   } catch (err) {
//     return res.status(500).json({ error: err.message });
//   }
// };

export const uploadToCloudinary = (folderName) => async (req, res, next) => {
  console.log("In Upload to Cloud");

  if (!req.files || req.files.length === 0) {
    return next();
  }

  try {
    const uploadedUrls = [];

    for (const file of req.files) {
      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: folderName },
          (error, result) => {
            if (error) return reject(error);
            resolve(result);
          }
        );
        stream.end(file.buffer);
      });

      uploadedUrls.push(result.secure_url);
    }

    // Attach URLs to req.body
    req.body.newPhotos = uploadedUrls;

    next();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Cloudinary upload failed" });
  }
};


// Helper function to upload one file and return URL
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

