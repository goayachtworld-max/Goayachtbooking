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

// /**
//  * Adjusts adjacent FREE slots when a FREE slot is edited
//  */
// export function adjustSlots({
//   allSlots,     // [{ start, end, type }]
//   targetIndex,
//   newStart,
//   newEnd,
// }) {
//   const editedStart = toMin(newStart);
//   const editedEnd = toMin(newEnd);

//   if (editedEnd <= editedStart) {
//     throw new Error("End time must be after start time");
//   }

//   const normalized = allSlots.map((s) => ({
//     ...s,
//     startMin: toMin(s.start),
//     endMin: toMin(s.end),
//   }));

//   const target = normalized[targetIndex];

//   // ❌ Only FREE slots are editable
//   if (IMMUTABLE_TYPES.includes(target.type)) {
//     throw new Error("This slot cannot be edited");
//   }

//   // ❌ No overlap with immutable slots
//   for (let i = 0; i < normalized.length; i++) {
//     if (i === targetIndex) continue;

//     const s = normalized[i];
//     if (IMMUTABLE_TYPES.includes(s.type)) {
//       if (
//         overlaps(
//           { start: editedStart, end: editedEnd },
//           { start: s.startMin, end: s.endMin }
//         )
//       ) {
//         throw new Error(
//           `Overlaps ${s.type} slot (${s.start}–${s.end})`
//         );
//       }
//     }
//   }

//   // ✅ Apply edited slot
//   target.startMin = editedStart;
//   target.endMin = editedEnd;

//   // 🔄 Adjust previous FREE slot
//   const prev = normalized[targetIndex - 1];
//   if (prev && !IMMUTABLE_TYPES.includes(prev.type)) {
//     if (prev.endMin > editedStart) {
//       prev.endMin = editedStart;
//       if (prev.endMin <= prev.startMin) {
//         throw new Error("Previous slot collapses");
//       }
//     }
//   }

//   // 🔄 Adjust next FREE slot
//   const next = normalized[targetIndex + 1];
//   if (next && !IMMUTABLE_TYPES.includes(next.type)) {
//     if (next.startMin < editedEnd) {
//       next.startMin = editedEnd;
//       if (next.endMin <= next.startMin) {
//         throw new Error("Next slot collapses");
//       }
//     }
//   }

//   return normalized.map((s) => ({
//     ...s,
//     start: toHHMM(s.startMin),
//     end: toHHMM(s.endMin),
//   }));
// }


export function adjustSlots({
  allSlots,          // [{ start, end, type }]
  targetIndex,
  newStart,
  newEnd,
  durationMinutes,   // yacht duration in minutes
}) {
  if (!Array.isArray(allSlots)) {
    throw new Error("Invalid slots data");
  }

  const editedStart = toMin(newStart);
  const editedEnd = toMin(newEnd);

  if (editedEnd <= editedStart) {
    throw new Error("End time must be after start time");
  }

  // ----------------------------------
  // Normalize slots
  // ----------------------------------
  const normalized = allSlots.map((s) => ({
    ...s,
    startMin: toMin(s.start),
    endMin: toMin(s.end),
  }));

  const target = normalized[targetIndex];
  if (!target) {
    throw new Error("Invalid slot selection");
  }

  // ❌ Immutable slot protection
  if (IMMUTABLE_TYPES.includes(target.type)) {
    throw new Error("This slot cannot be edited");
  }

  // ❌ Overlap with immutable slots
  for (let i = 0; i < normalized.length; i++) {
    if (i === targetIndex) continue;
    const s = normalized[i];

    if (IMMUTABLE_TYPES.includes(s.type)) {
      if (
        overlaps(
          { start: editedStart, end: editedEnd },
          { start: s.startMin, end: s.endMin }
        )
      ) {
        throw new Error(
          `Overlaps ${s.type} slot (${s.start}–${s.end})`
        );
      }
    }
  }

  // ----------------------------------
  // Apply edited slot
  // ----------------------------------
  target.startMin = editedStart;
  target.endMin = editedEnd;

  // ----------------------------------
  // Adjust previous FREE slot
  // ----------------------------------
  const prev = normalized[targetIndex - 1];
  if (prev && !IMMUTABLE_TYPES.includes(prev.type)) {
    if (prev.endMin > editedStart) {
      prev.endMin = editedStart;
      if (prev.endMin <= prev.startMin) {
        normalized.splice(targetIndex - 1, 1);
      }
    }
  }

  // ----------------------------------
  // Adjust next FREE slot
  // ----------------------------------
  const next = normalized[targetIndex + 1];
  if (next && !IMMUTABLE_TYPES.includes(next.type)) {
    if (next.startMin < editedEnd) {
      next.startMin = editedEnd;
      if (next.endMin <= next.startMin) {
        normalized.splice(targetIndex + 1, 1);
      }
    }
  }

  // ----------------------------------
  // SORT slots
  // ----------------------------------
  normalized.sort((a, b) => a.startMin - b.startMin);

  // ----------------------------------
  // 🧩 FILL GAPS WITH FREE SLOTS
  // ----------------------------------
  const filled = [];

  for (let i = 0; i < normalized.length; i++) {
    const current = normalized[i];
    filled.push(current);

    const nextSlot = normalized[i + 1];
    if (!nextSlot) continue;

    let gapStart = current.endMin;
    const gapEnd = nextSlot.startMin;

    while (gapEnd - gapStart >= 30) {
      const slotSize = Math.min(durationMinutes, gapEnd - gapStart);
      if (slotSize < 30) break;

      filled.push({
        startMin: gapStart,
        endMin: gapStart + slotSize,
        type: "free",
      });

      gapStart += slotSize;
    }
  }

  // ----------------------------------
  // CLEAN + RETURN
  // ----------------------------------
  return filled.map((s) => ({
    ...s,
    start: toHHMM(s.startMin),
    end: toHHMM(s.endMin),
  }));
}
