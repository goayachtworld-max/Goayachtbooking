// slotEngine.js

import { buildSlotsForYacht } from "./buildSlotsForYacht";

export function resolveSlots({
  yacht,
  day,
}) {
  // 1️⃣ Base slots
  let baseSlots = [];

  if (
    Array.isArray(day?.slots) &&
    day.slots.length > 0 &&
    Array.isArray(day.slots[0]?.slots)
  ) {
    baseSlots = day.slots[0].slots;
  } else {
    baseSlots = buildSlotsForYacht(yacht);
  }

  // 2️⃣ Overlays
  const booked = day.bookedSlots || [];
  const locked = day.lockedSlots || [];

  // 3️⃣ Enrich slots
  return baseSlots.map((slot) => {
    const bookedHit = booked.find((b) =>
      overlap(b, slot)
    );

    if (bookedHit) {
      return {
        ...slot,
        type: bookedHit.status === "pending" ? "pending" : "booked",
        custName: bookedHit.custName || "",
        empName: bookedHit.empName || "",
        appliedBy: bookedHit.appliedBy || null,
      };
    }

    const lockedHit = locked.find((l) =>
      overlap(l, slot)
    );

    if (lockedHit) {
      return {
        ...slot,
        type: "locked",
        empName: lockedHit.empName || "",
        appliedBy: lockedHit.appliedBy || null,
      };
    }

    return { ...slot,date, type: "free" };
  });
}

const overlap = (a, b) =>
  toMin(a.startTime || a.start) < toMin(b.end) &&
  toMin(a.endTime || a.end) > toMin(b.start);
