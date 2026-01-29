import express from "express";
import { createBooking, getBookings, getBookingById, updateBooking, updateBookingYachtInfo } from "../controllers/booking.controller.js";
import { bookingSchema } from "../validators/booking.validator.js";
import { validate } from "../middleware/validate.js";
import { authMiddleware, onlyAdmin } from "../middleware/auth.js";
import { getEmployeesForBooking } from "../controllers/employee.controller.js";

const router = express.Router();

router.post("/", authMiddleware, validate(bookingSchema), createBooking);
router.get("/", authMiddleware, getBookings);
router.get("/:id", authMiddleware, getBookingById);

router.put("/:id", authMiddleware, updateBooking);  // Update booking
router.put("/reschedule/:bookingId", authMiddleware, onlyAdmin, updateBookingYachtInfo);  // Update booking time and yacht
export default router;
