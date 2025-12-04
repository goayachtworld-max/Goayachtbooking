import express from "express";
import { createTransaction, getTransactions, getTransactionById, createTransactionAndUpdateBooking } from "../controllers/transaction.controller.js";
import { transactionSchema } from "../validators/transaction.validator.js";
import { validate } from "../middleware/validate.js";
import { authMiddleware } from "../middleware/auth.js";
import { upload, uploadToCloudinary } from "../middleware/upload.js";

const router = express.Router();

router.post(
  "/",
  authMiddleware,
  upload.single("paymentProof"),
  (req, res, next) => {
    if (req.file) req.body.paymentProof =  "https://res.cloudinary.com/demo/image/upload/v1691234567/yaut/payment/sample-proof.jpg";
    if (req.body.amount) req.body.amount = Number(req.body.amount);
    next();
  },
  validate(transactionSchema),
  uploadToCloudinary("yaut/payment"),
  createTransaction
);

router.post(
  "/create-with-booking-update",
  authMiddleware,
  upload.single("paymentProof"),
  (req, res, next) => {
    if (req.file) {
      req.body.paymentProof = "https://res.cloudinary.com/demo/image/upload/v1691234567/yaut/payment/sample-proof.jpg";
    }
    if (req.body.amount) req.body.amount = Number(req.body.amount);
    next();
  },
  validate(transactionSchema),
  uploadToCloudinary("yaut/payment"),
  createTransactionAndUpdateBooking
);

router.get("/", authMiddleware, getTransactions);
router.get("/:id", authMiddleware, getTransactionById);

export default router;
