import express from "express";
import { createCustomer, getCustomerByContact, getCustomerById, getCustomers, searchCustomersByName, updateCustomerInfo } from "../controllers/customer.controller.js";
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
    if (req.file) {
      req.body.govtIdImage = req.file.path || req.file.buffer;
      uploadToCloudinary("yaut/govtProof")
    }
    next();
  },
  validate(customerSchema),
  createCustomer
);

router.get("/contact/:contact", authMiddleware, getCustomerByContact);
router.get("/search", authMiddleware, searchCustomersByName);
router.get("/", authMiddleware, getCustomers);
router.get("/:id", authMiddleware, getCustomerById);
router.put("/:customerId", authMiddleware, updateCustomerInfo);

export default router;
