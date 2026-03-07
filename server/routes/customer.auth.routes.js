// routes/customer.auth.routes.js
// Mount: app.use('/customer/auth', customerAuthRouter);
import express from 'express';
import { verifyOtp, getMe, updateProfile, sendOtp } from '../controllers/customer.auth.controller.js';
import { getMyBookings } from '../controllers/customer.booking.controller.js';
import { customerAuthMiddleware } from '../middleware/customer.auth.middleware.js';

const router = express.Router();
router.post('/send-otp',   sendOtp);
router.post('/verify-otp', verifyOtp);
router.get('/me',          customerAuthMiddleware, getMe);
router.put('/profile',     customerAuthMiddleware, updateProfile);
router.get('/bookings',    customerAuthMiddleware, getMyBookings);

export default router;
