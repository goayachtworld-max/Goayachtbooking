
// routes/public.booking.routes.js
// Mount in app.js: app.use('/public', publicBookingRouter);
import express from 'express';
import { getPublicSlots, createPublicBooking } from '../controllers/public.booking.controller.js';

const router = express.Router();
router.get('/slots',    getPublicSlots);      // GET  /public/slots?yachtId=&date=YYYY-MM-DD
router.post('/bookings', createPublicBooking); // POST /public/bookings

export default router;