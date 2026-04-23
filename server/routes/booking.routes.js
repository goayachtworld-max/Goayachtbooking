import express from "express";
import {
  createBooking,
  getBookings,
  getBookingById,
  updateBooking,
  updateBookingYachtInfo,
  updateBookingExtraDetails,
  getPublicBookingByTicket,
  updateBookingAmounts,
  getPastBookings,
} from "../controllers/booking.controller.js";
import { bookingSchema } from "../validators/booking.validator.js";
import { validate } from "../middleware/validate.js";
import { authMiddleware, onlyAdmin } from "../middleware/auth.js";
import { getEmployeesForBooking } from "../controllers/employee.controller.js";

const router = express.Router();

router.post("/", authMiddleware, validate(bookingSchema), createBooking);
router.get("/", authMiddleware, getBookings);
router.get("/public/:id", getPublicBookingByTicket);        // ⚠️ must be before /:id
router.get("/past", authMiddleware, getPastBookings);           // Reports page — past bookings
router.get("/:id", authMiddleware, getBookingById);

router.put("/:id", authMiddleware, updateBooking);                                      // Update status + payment
router.put("/reschedule/:bookingId", authMiddleware, updateBookingYachtInfo);           // Update time and yacht
router.patch("/extra-details/:bookingId", authMiddleware, updateBookingExtraDetails);   // Update extra details
router.patch("/:bookingId/amounts", authMiddleware, updateBookingAmounts);              // Admin: update quoted/token amounts

export default router;