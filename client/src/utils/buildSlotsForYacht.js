const toMin = (t = "00:00") => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

const toTime = (m) => {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
};

export function buildSlotsForYacht(yacht) {
  if (
    !yacht ||
    !yacht.sailStartTime ||
    !yacht.sailEndTime ||
    !(yacht.slotDurationMinutes || yacht.duration)
  ) {
    return [];
  }

  // 🕒 duration
  let duration = yacht.slotDurationMinutes || yacht.duration;

  if (typeof duration === "string" && duration.includes(":")) {
    const [h, m] = duration.split(":").map(Number);
    duration = h * 60 + (m || 0);
  } else {
    duration = Number(duration);
  }

  let startMin = toMin(yacht.sailStartTime);
  let endMin = toMin(yacht.sailEndTime);

  // 🌙 overnight sailing
  if (endMin <= startMin) {
    endMin += 1440;
  }

  // ⭐ collect special slots
  const specialTimes = [];

  if (yacht.specialSlotTime) specialTimes.push(yacht.specialSlotTime);
  if (Array.isArray(yacht.specialSlotTimes))
    specialTimes.push(...yacht.specialSlotTimes);
  if (Array.isArray(yacht.specialSlots))
    specialTimes.push(...yacht.specialSlots);

  const specialStarts = specialTimes
    .map(toMin)
    .filter((v) => !isNaN(v))
    .sort((a, b) => a - b);

  // 🧠 process special slots
  const specials = specialStarts.map((s) => ({
    start: s,
    end: s + duration,
  }));

  // 🧩 build slots
  const slots = [];
  let cursor = startMin;

  while (cursor < endMin) {
    const next = cursor + duration;

    const hit = specials.find(
      (sp) => sp.start > cursor && sp.start < next
    );

    if (hit) {
      slots.push({ start: cursor, end: hit.start });
      slots.push({ start: hit.start, end: hit.end });
      cursor = hit.end;
      continue;
    }

    slots.push({
      start: cursor,
      end: Math.min(next, endMin),
    });

    cursor = next;
  }

  // ➕ add specials outside sail window
  specials.forEach((sp) => {
    if (sp.start < startMin || sp.end > endMin) {
      slots.push(sp);
    }
  });

  // 🧹 dedupe + sort
  const seen = new Set();
  const cleaned = slots
    .filter((s) => {
      const key = `${s.start}-${s.end}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.start - b.start);

  return cleaned.map((s) => ({
    start: toTime(s.start),
    end: toTime(s.end),
  }));
}
