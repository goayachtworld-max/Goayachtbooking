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

// ─── Helpers (mirrors CreateBooking.jsx buildSlotsForYacht exactly) ───────────
const timeToMin = (t) => {
  if (!t) return 0;
  const [h, m] = String(t).split(':').map(Number);
  return h * 60 + m;
};
const minToTime = (m) => {
  const h  = Math.floor(m / 60) % 24;
  const mm = m % 60;
  return `${String(h).padStart(2,'0')}:${String(mm).padStart(2,'0')}`;
};

const buildSlots = (yacht, dateStr) => {
  // Priority 1 — date-specific slot overrides stored on the yacht document
  const slotsForDate = yacht.slots?.find(
    (sg) => new Date(sg.date).toDateString() === new Date(dateStr).toDateString()
  );
  if (slotsForDate?.slots?.length > 0) {
    return slotsForDate.slots
      .map((s) => ({ start: s.start, end: s.end }))
      .sort((a, b) => timeToMin(a.start) - timeToMin(b.start));
  }

  // Priority 2 — compute from yacht config (same algorithm as CreateBooking.jsx)
  const sailStart    = yacht.sailStartTime;
  const sailEnd      = yacht.sailEndTime;
  const durationRaw  = yacht.slotDurationMinutes || yacht.duration;
  const specialSlots = yacht.specialSlots || [];

  if (!sailStart || !sailEnd || !durationRaw) return [];

  let duration = 0;
  if (typeof durationRaw === 'string' && durationRaw.includes(':')) {
    const [h, m] = durationRaw.split(':').map(Number);
    duration = h * 60 + (m || 0);
  } else {
    duration = Number(durationRaw);
  }
  if (!duration) return [];

  const startMin    = timeToMin(sailStart);
  let   endMin      = timeToMin(sailEnd);
  const specialMins = specialSlots.map(timeToMin).sort((a, b) => a - b);

  if (endMin <= startMin) endMin += 24 * 60;
  if (sailEnd === '00:00') endMin = 24 * 60 - 1;

  const slots  = [];
  let   cursor = startMin;
  while (cursor < endMin) {
    const next = cursor + duration;
    const hit  = specialMins.find((sp) => sp > cursor && sp < next);
    if (hit) {
      slots.push({ start: cursor, end: hit });
      cursor = hit;
    } else {
      slots.push({ start: cursor, end: Math.min(next, endMin) });
      cursor = next;
    }
  }
  return slots.map((s) => ({ start: minToTime(s.start), end: minToTime(s.end) }));
};

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
      .select('sailStartTime sailEndTime slotDurationMinutes duration specialSlots slots')
      .lean();
    if (!yacht) return res.status(404).json({ success: false, message: 'Yacht not found' });

    const slots = buildSlots(yacht, date);
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

    const yacht = await YachtModel.findById(yachtId).select('_id company name sellingPrice');
    if (!yacht) return res.status(404).json({ success: false, message: 'Yacht not found' });

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

    res.status(201).json({
      success: true,
      booking: {
        _id:      booking._id,
        ticketNo: booking.ticketNo,
      },
    });
  } catch (err) { next(err); }
};