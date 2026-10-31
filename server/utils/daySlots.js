// server/utils/daySlots.js
//
// SINGLE SOURCE OF TRUTH RULES
// ----------------------------
//  1. A BOOKING (Booking collection, active status) is the truth for what is
//     booked. Its exact startTime/endTime always wins.
//  2. A LOCK (Availability collection, status "locked") is the truth for what
//     is temporarily held.
//  3. The SLOT LAYOUT (Slot collection) only describes the *free* grid for a
//     day. It must never overlap a booking/lock, and it must always contain the
//     exact booked/locked ranges, so every screen shows the same times.
//
// Everything below enforces rule 3. Every code path that reads or writes the
// layout (admin screens, public site, booking create/reschedule, repair
// script) goes through these helpers.

import { SlotModel } from "../models/slot.model.js";
import { YachtModel } from "../models/yacht.model.js";
import { BookingModel } from "../models/booking.model.js";
import { AvailabilityModel } from "../models/availability.model.js";

export const ACTIVE_BOOKING_STATUSES = ["pending", "initiated", "confirmed"];

export const toMin = (t) => {
  if (!t) return 0;
  const [h, m] = String(t).split(":").map(Number);
  return h * 60 + (m || 0);
};

export const toHHMM = (m) => {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
};

/** "YYYY-MM-DD" key for a request date (string preferred). */
export const toDateKey = (date) => {
  if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}/.test(date)) {
    return date.slice(0, 10);
  }
  const d = new Date(date);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/**
 * Day window used to find the Slot document. Identical to the logic that
 * createOrUpdateSlot / getDayAvailability already used, so existing Slot
 * documents keep matching.
 */
export const dayBounds = (date) => {
  const d = new Date(date);
  const start = new Date(d);
  start.setHours(0, 0, 0, 0);
  const end = new Date(d);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

/**
 * Pure function. Takes the free grid + the protected (booked/locked) ranges and
 * returns a layout where:
 *   - every protected range appears exactly once with its exact times
 *   - no other slot overlaps a protected range (overlapping free slots are
 *     clipped; the non-overlapping remainder is kept)
 * It is idempotent: running it twice gives the same result.
 */
export const reconcileLayout = (layout = [], protectedRanges = []) => {
  const prot = [];
  const seen = new Set();
  for (const p of protectedRanges) {
    const s = toMin(p.start);
    const e = toMin(p.end);
    if (!(e > s)) continue;
    const key = `${s}-${e}`;
    if (seen.has(key)) continue;
    seen.add(key);
    prot.push({ start: s, end: e });
  }

  const out = [];
  for (const slot of layout) {
    let pieces = [{ start: toMin(slot.start), end: toMin(slot.end) }];
    for (const p of prot) {
      const next = [];
      for (const piece of pieces) {
        const overlaps = piece.start < p.end && piece.end > p.start;
        if (!overlaps) {
          next.push(piece);
          continue;
        }
        if (piece.start < p.start) next.push({ start: piece.start, end: p.start });
        if (piece.end > p.end) next.push({ start: p.end, end: piece.end });
      }
      pieces = next;
    }
    out.push(...pieces);
  }

  out.push(...prot);
  out.sort((a, b) => a.start - b.start || a.end - b.end);

  // de-duplicate exact repeats
  const unique = [];
  for (const s of out) {
    const last = unique[unique.length - 1];
    if (last && last.start === s.start && last.end === s.end) continue;
    unique.push(s);
  }
  return unique.map((s) => ({ start: toHHMM(s.start), end: toHHMM(s.end) }));
};

/** Booked (from Booking) + locked (from Availability) ranges for a yacht/day. */
export const getProtectedRanges = async (yachtId, dateKey) => {
  const [bookings, locks] = await Promise.all([
    BookingModel.find({
      yachtId,
      date: dateKey,
      status: { $in: ACTIVE_BOOKING_STATUSES },
    })
      .select("startTime endTime")
      .lean(),
    AvailabilityModel.find({ yachtId, date: dateKey, status: "locked" })
      .select("startTime endTime")
      .lean(),
  ]);

  return [
    ...bookings.map((b) => ({ start: b.startTime, end: b.endTime, type: "booked" })),
    ...locks.map((l) => ({ start: l.startTime, end: l.endTime, type: "locked" })),
  ];
};

/** Default grid built from the yacht's own configuration (no stored layout). */
export const generateDefaultSlots = (yacht) => {
  const sailStart = yacht?.sailStartTime;
  const sailEnd = yacht?.sailEndTime;
  const durationRaw = yacht?.slotDurationMinutes || yacht?.duration;
  const specialSlots = yacht?.specialSlots || [];

  if (!sailStart || !sailEnd || !durationRaw) return [];

  let duration = 0;
  if (typeof durationRaw === "string" && durationRaw.includes(":")) {
    const [h, m] = durationRaw.split(":").map(Number);
    duration = h * 60 + (m || 0);
  } else {
    duration = Number(durationRaw);
  }
  if (!duration) return [];

  const startMin = toMin(sailStart);
  let endMin = toMin(sailEnd);
  const specialMins = specialSlots.map(toMin).sort((a, b) => a - b);

  if (endMin <= startMin) endMin += 24 * 60;
  if (sailEnd === "00:00") endMin = 24 * 60 - 1;

  const slots = [];
  let cursor = startMin;
  while (cursor < endMin) {
    const next = cursor + duration;
    const hit = specialMins.find((sp) => sp > cursor && sp < next);
    if (hit) {
      slots.push({ start: cursor, end: hit });
      cursor = hit;
    } else {
      slots.push({ start: cursor, end: Math.min(next, endMin) });
      cursor = next;
    }
  }
  return slots.map((s) => ({ start: toHHMM(s.start), end: toHHMM(s.end) }));
};

const findStoredLayout = (yachtId, date) => {
  const { start, end } = dayBounds(date);
  return SlotModel.findOne({ yachtId, date: { $gte: start, $lte: end } });
};

/**
 * What every reader (public site, admin) should use for a day:
 * stored layout if the admin saved one, otherwise the generated default,
 * reconciled with bookings/locks.
 */
export const getResolvedDaySlots = async (yachtId, date, yacht = null) => {
  const dateKey = toDateKey(date);
  const stored = await findStoredLayout(yachtId, dateKey);
  let base;
  if (stored) {
    base = stored.slots.map((s) => ({ start: s.start, end: s.end }));
  } else {
    const y =
      yacht ||
      (await YachtModel.findById(yachtId)
        .select("sailStartTime sailEndTime slotDurationMinutes duration specialSlots")
        .lean());
    base = generateDefaultSlots(y);
  }
  const prot = await getProtectedRanges(yachtId, dateKey);
  return {
    hasStoredLayout: !!stored,
    slots: reconcileLayout(base, prot),
    protectedRanges: prot,
  };
};

const sameLayout = (a, b) =>
  a.length === b.length && a.every((s, i) => s.start === b[i].start && s.end === b[i].end);

/**
 * Make the stored layout agree with bookings/locks for a yacht/day.
 * - stored layout exists  -> reconcile and save if it changed
 * - no stored layout      -> only create one if a booking/lock does not fit the
 *                            default grid (custom time), so it shows correctly
 * Returns { changed, before, after }. With { dryRun: true } nothing is written.
 */
export const syncDayLayout = async (yachtId, date, { dryRun = false } = {}) => {
  const dateKey = toDateKey(date);
  const prot = await getProtectedRanges(yachtId, dateKey);
  const stored = await findStoredLayout(yachtId, dateKey);

  if (stored) {
    const before = stored.slots.map((s) => ({ start: s.start, end: s.end }));
    const after = reconcileLayout(before, prot);
    // Existing "stop sale" (empty) layout with nothing protected stays empty.
    const changed = !sameLayout(
      [...before].sort((a, b) => toMin(a.start) - toMin(b.start) || toMin(a.end) - toMin(b.end)),
      after
    );
    if (changed && !dryRun) {
      stored.slots = after;
      await stored.save();
    }
    return { changed, before, after };
  }

  if (!prot.length) return { changed: false, before: [], after: [] };

  const yacht = await YachtModel.findById(yachtId)
    .select("sailStartTime sailEndTime slotDurationMinutes duration specialSlots")
    .lean();
  const before = generateDefaultSlots(yacht);
  const after = reconcileLayout(before, prot);
  const changed = !sameLayout(before, after);

  if (changed && !dryRun) {
    const { start } = dayBounds(dateKey);
    const doc = await SlotModel.create({ yachtId, date: start, slots: after });
    await YachtModel.updateOne({ _id: yachtId }, { $addToSet: { slots: doc._id } });
  }
  return { changed, before, after };
};
