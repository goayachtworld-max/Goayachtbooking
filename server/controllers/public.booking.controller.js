// controllers/public.booking.controller.js
// Public-facing endpoints — no staff auth required.
//
// Routes (mount as: app.use('/public', publicBookingRouter)):
//   GET  /public/slots?yachtId=&date=YYYY-MM-DD  → computed slots + availability
//   POST /public/bookings                          → create booking (customer-facing)

import { YachtModel }        from '../models/yacht.model.js';
import { BookingModel }      from '../models/booking.model.js';
import { AvailabilityModel } from '../models/availability.model.js';
import { CustomerModel }     from '../models/customer.model.js';
import { toMin, getResolvedDaySlots, syncDayLayout } from '../utils/daySlots.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────
// Slots now come from the SAME place as the admin screens (utils/daySlots.js):
// stored day layout (or generated default) reconciled with bookings/locks.
const timeToMin = toMin;

const overlaps = (slot, takenList) => {
  const sS = timeToMin(slot.start), sE = timeToMin(slot.end);
  return takenList.some(({ start, end }) => sS < timeToMin(end) && sE > timeToMin(start));
};

// ─── GET /public/slots?yachtId=&date= ────────────────────────────────────────
// Returns all computed slots for a yacht on a given date, each tagged available/full
export const getPublicSlots = async (req, res, next) => {
  try {
    const { yachtId, date } = req.query;
    if (!yachtId || !date) {
      return res.status(400).json({ success: false, message: 'yachtId and date are required' });
    }

    const yacht = await YachtModel.findById(yachtId)
      .select('sailStartTime sailEndTime slotDurationMinutes duration specialSlots')
      .lean();
    if (!yacht) return res.status(404).json({ success: false, message: 'Yacht not found' });

    const { slots } = await getResolvedDaySlots(yachtId, date, yacht);
    if (!slots.length) return res.json({ success: true, date, slots: [] });

    // Fetch booked + locked slots for this yacht+date
    const [booked, locked] = await Promise.all([
      BookingModel.find({
        yachtId, date,
        status: { $in: ['pending', 'initiated', 'confirmed'] },
      }).select('startTime endTime').lean(),
      AvailabilityModel.find({
        yachtId, date, status: 'locked',
      }).select('startTime endTime').lean(),
    ]);

    const taken = [
      ...booked.map((b) => ({ start: b.startTime, end: b.endTime })),
      ...locked.map((l) => ({ start: l.startTime, end: l.endTime })),
    ];

    const slotsWithStatus = slots.map((s) => ({
      ...s,
      available: !overlaps(s, taken),
    }));

    res.json({
      success:  true,
      date,
      yachtId,
      available: slotsWithStatus.filter((s) => s.available).length,
      total:     slotsWithStatus.length,
      slots:     slotsWithStatus,
    });
  } catch (err) { next(err); }
};

// ─── POST /public/bookings ────────────────────────────────────────────────────
// Creates booking from public site. Upserts customer. Re-checks availability.
export const createPublicBooking = async (req, res, next) => {
  try {
    const { yachtId, name, phone, email, numAdults, numKids, date, slot, addons } = req.body;

    if (!yachtId || !name || !phone || !date || !slot?.start || !slot?.end) {
      return res.status(400).json({
        success: false,
        message: 'yachtId, name, phone, date, slot.start and slot.end are required',
      });
    }

    const yacht = await YachtModel.findById(yachtId)
      .select('_id company name sellingPrice sailStartTime sailEndTime slotDurationMinutes duration specialSlots')
      .lean();
    if (!yacht) return res.status(404).json({ success: false, message: 'Yacht not found' });

    // The requested slot must exist in the day's real layout — the public site
    // may not invent times.
    const { slots: validSlots } = await getResolvedDaySlots(yachtId, date, yacht);
    const slotExists = validSlots.some((s) => s.start === slot.start && s.end === slot.end);
    if (!slotExists) {
      return res.status(409).json({
        success: false,
        message: 'Slots for this day have changed. Please reselect a slot.',
      });
    }

    // Re-check availability at submission time (race condition guard)
    const [booked, locked] = await Promise.all([
      BookingModel.findOne({
        yachtId, date,
        status: { $in: ['pending', 'initiated', 'confirmed'] },
        $or: [{ startTime: { $lt: slot.end }, endTime: { $gt: slot.start } }],
      }).lean(),
      AvailabilityModel.findOne({
        yachtId, date, status: 'locked',
        $or: [{ startTime: { $lt: slot.end }, endTime: { $gt: slot.start } }],
      }).lean(),
    ]);
    if (booked || locked) {
      return res.status(409).json({
        success: false,
        message: 'This slot was just taken. Please choose another slot.',
      });
    }

    // Upsert customer
    const cleanPhone = String(phone).replace(/\D/g,'').replace(/^(91|0)/,'').slice(-10);
    let customer = await CustomerModel.findOne({ contact: cleanPhone });
    if (!customer) {
      customer = await CustomerModel.create({
        name, contact: cleanPhone, email: email || undefined,
      });
    } else {
      // Update name/email if still defaults
      let dirty = false;
      if (customer.name === 'Guest' && name && name !== 'Guest') { customer.name = name; dirty = true; }
      if (email && !customer.email) { customer.email = email; dirty = true; }
      if (dirty) await customer.save();
    }

    const booking = await BookingModel.create({
      yachtId,
      customerId:      customer._id,
      customerContact: cleanPhone,
      company:         yacht.company,
      date,
      startTime:     slot.start,
      endTime:       slot.end,
      status:        'pending',
      tripStatus:    'pending',
      quotedAmount:  yacht.sellingPrice || 0,
      pendingAmount: yacht.sellingPrice || 0,
      numPeople:     (Number(numAdults) || 2) + (Number(numKids) || 0),
      extraDetails:  addons?.length ? `Add-ons requested: ${addons.join(', ')}` : '',
      source:        'public',
    });

    // Mark slot as booked in availability
    await AvailabilityModel.create({
      yachtId,
      date,
      startTime:  slot.start,
      endTime:    slot.end,
      status:     'booked',
      bookingId:  booking._id,
      deleteAfter: new Date(date + 'T' + slot.end + ':00'),
    });

    try { await syncDayLayout(yachtId, date); } catch (e) { console.error('syncDayLayout failed:', e); }

    res.status(201).json({
      success: true,
      booking: {
        _id:      booking._id,
        ticketNo: booking.ticketNo,
      },
    });
  } catch (err) { next(err); }
};