import express from "express";
import { createBooking, getBookings, getBookingById, updateBooking } from "../controllers/booking.controller.js";
import { bookingSchema } from "../validators/booking.validator.js";
import { validate } from "../middleware/validate.js";
import { authMiddleware } from "../middleware/auth.js";

const router = express.Router();

router.post("/", authMiddleware, validate(bookingSchema), createBooking);
router.get("/", authMiddleware, getBookings);
router.get("/:id", authMiddleware, getBookingById);

router.put("/:id", authMiddleware, updateBooking);  // Update booking
export default router;
