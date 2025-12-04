import express from "express";
import { createCustomer, getCustomers, getCustomerByEmail } from "../controllers/customer.controller.js";
import { customerSchema } from "../validators/customer.validator.js";
import { validate } from "../middleware/validate.js";
import { upload, uploadToCloudinary } from "../middleware/upload.js";
import { authMiddleware } from "../middleware/auth.js";

const router = express.Router();

router.post(
  "/",
  authMiddleware,
  upload.single("govtIdImage"),
  // Merge file into body for validation
  (req, res, next) => {
    if (req.file) req.body.govtIdImage = req.file.path || req.file.buffer;
    next();
  },
  validate(customerSchema),
  uploadToCloudinary("yaut/govtProof"),
  createCustomer
);

router.get("/:email", authMiddleware, getCustomerByEmail);
router.get("/", authMiddleware, getCustomers);

export default router;
