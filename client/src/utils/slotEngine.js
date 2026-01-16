// // src/utils/slotEngine.js

export const IMMUTABLE_TYPES = ["booked", "pending", "locked"];

const toMin = (t) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

const toHHMM = (m) =>
  `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

const overlaps = (a, b) =>
  a.start < b.end && a.end > b.start;

export function adjustSlots({
  allSlots,
  targetIndex,
  newStart,
  newEnd,
  durationMinutes,
}) {
  console.log("adjust slots --------------------------------------")
  const editedStart = toMin(newStart);
  const editedEnd = toMin(newEnd);
  console.log({
  allSlots,
  targetIndex,
  newStart,
  newEnd,
  durationMinutes,
})

  if (editedEnd <= editedStart) {
    throw new Error("End time must be after start time");
  }

  // Normalize
  let normalized = allSlots.map((s) => ({
    ...s,
    startMin: toMin(s.start),
    endMin: toMin(s.end),
  }));

  const target = normalized[targetIndex];
  if (!target) throw new Error("Invalid slot");

  if (IMMUTABLE_TYPES.includes(target.type)) {
    throw new Error("This slot cannot be edited");
  }

  // ❌ Prevent overlap with immutable slots
  for (const s of normalized) {
    if (
      IMMUTABLE_TYPES.includes(s.type) &&
      overlaps(
        { start: editedStart, end: editedEnd },
        { start: s.startMin, end: s.endMin }
      )
    ) {
      throw new Error(`Overlaps ${s.type} slot (${s.start}-${s.end})`);
    }
  }

  // ✅ Apply edited slot
  target.startMin = editedStart;
  target.endMin = editedEnd;

  // ✅ Remove ALL overlapping FREE slots (except target)
  normalized = normalized.filter(
    (s) =>
      s === target ||
      IMMUTABLE_TYPES.includes(s.type) ||
      !overlaps(
        { start: editedStart, end: editedEnd },
        { start: s.startMin, end: s.endMin }
      )
  );

  // Sort
  normalized.sort((a, b) => a.startMin - b.startMin);

  // 🧩 Fill gaps strictly by yacht duration
  const filled = [];

  for (let i = 0; i < normalized.length; i++) {
    const curr = normalized[i];
    filled.push(curr);

    const next = normalized[i + 1];
    if (!next) continue;

    let gapStart = curr.endMin;
    const gapEnd = next.startMin;

    while (gapEnd - gapStart >= durationMinutes) {
      filled.push({
        startMin: gapStart,
        endMin: gapStart + durationMinutes,
        type: "free",
        date: curr.date,
      });
      gapStart += durationMinutes;
    }
  }

  return filled.map((s) => ({
    ...s,
    start: toHHMM(s.startMin),
    end: toHHMM(s.endMin),
  }));
}
