import React, { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate, Navigate } from "react-router-dom";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import "bootstrap/dist/css/bootstrap.min.css";
import "./DayAvailability.css";
import { toast } from "react-hot-toast";
import "./EditableSlots.css"

import {
  getDayAvailability,
  lockSlot,
  releaseSlot,
} from "../services/operations/availabilityAPI";

import {
  getYachtById,
  updateDaySlots
} from "../services/operations/yautAPI";


function DayAvailability() {
  const location = useLocation();
  const navigate = useNavigate();
  const { yachtId, yachtName, day: incomingDay, requireDateSelection } =
    location.state || {};

  // Local day state (avoid mutating location.state directly)
  const [currentDay, setCurrentDay] = useState(incomingDay || null);

  const [timeline, setTimeline] = useState([]);
  const [isStopSale, setIsStopSale] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [yacht, setYacht] = useState(null);
  const [error, setError] = useState("");
  const [selectedDate, setSelectedDate] = useState(null);
  const [isCalendarDisabled, setIsCalendarDisabled] = useState(false);

  // prevent multiple clicks
  const [isLocking, setIsLocking] = useState(false);
  const [isReleasing, setIsReleasing] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  // React-controlled modals (replaces Bootstrap JS modals)
  const [showLockModal, setShowLockModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showBookedModal, setShowBookedModal] = useState(false);

  // Admin edit-day modal state
  const [showEditSlotsModal, setShowEditSlotsModal] = useState(false);
  const [editedDaySlots, setEditedDaySlots] = useState([]);
  const [isSavingDaySlots, setIsSavingDaySlots] = useState(false);
  const [isGlobalEdit, setIsGlobalEdit] = useState(false);
  const initialDaySlotsRef = useRef(null);

  // Inline slot edit state (no modal)
  const [inlineEditIdx, setInlineEditIdx] = useState(null);
  const [inlineEditSlot, setInlineEditSlot] = useState({ start: "", end: "" });
  const [isSavingInline, setIsSavingInline] = useState(false);

  const token = localStorage.getItem("authToken");
  const employee = JSON.parse(localStorage.getItem("user") || "{}");
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const userRole = user.type;
  const isAdmin = userRole === "admin";



  // Admin or onsite users have full access
  const isAdminOrOnsite = employee.type === "admin" || employee.type === "onsite";

  // Helper to check if this user created/applied this slot
  const isOwner = (slot) => {
    return slot.appliedBy && slot.appliedBy === employee._id;
  }

  // Handle initial state based on whether date selection is required
  useEffect(() => {
    if (requireDateSelection) {
      setError(
        "📅 Please select a date from the calendar to view available time slots"
      );
      setSelectedDate(null);
      setCurrentDay(null);
    } else if (incomingDay) {
      if (typeof incomingDay === "string") {
        setCurrentDay({
          date: incomingDay,
          day: new Date(incomingDay).toLocaleDateString("en-US", {
            weekday: "long",
          }),
        });
        setSelectedDate(new Date(incomingDay));
      } else {
        setCurrentDay(incomingDay);
        setSelectedDate(new Date(incomingDay.date));
      }
      setError("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requireDateSelection, incomingDay]);

  if (!yachtId) {
    return <Navigate to="/availability" replace />;
  }

  // ---------- Helpers ----------
  const hhmmToMinutes = (time = "00:00") => {
    if (!time || typeof time !== "string") return 0;
    const parts = time.split(":").map((p) => Number(p));
    if (parts.length < 2 || Number.isNaN(parts[0]) || Number.isNaN(parts[1]))
      return 0;
    const [h, m] = parts;
    return h * 60 + m;
  };

  const minutesToHHMM = (minutes) => {
    const m = Number(minutes) || 0;
    const h = Math.floor(m / 60);
    const mm = m % 60;
    return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
  };

  // Yacht slot duration in minutes
  const getDurationMins = (yachtObj) => {
    if (!yachtObj) return 0;
    const raw = yachtObj.slotDurationMinutes || yachtObj.duration;
    if (!raw) return 0;
    if (typeof raw === "string" && raw.includes(":")) {
      const [h, m] = raw.split(":").map(Number);
      return h * 60 + (m || 0);
    }
    return Number(raw) || 0;
  };

  // Check if a slot start time matches a special/prime slot configured on the yacht
  const isPrimeSlot = (startHHMM, yachtObj) => {
    if (!yachtObj) return false;
    const specials = [];
    if (yachtObj.specialSlotTime) specials.push(yachtObj.specialSlotTime);
    if (Array.isArray(yachtObj.specialSlotTimes)) specials.push(...yachtObj.specialSlotTimes);
    if (Array.isArray(yachtObj.specialSlots)) specials.push(...yachtObj.specialSlots);
    const startMin = hhmmToMinutes(startHHMM);
    return specials.some((t) => Math.abs(hhmmToMinutes(t) - startMin) < 1);
  };

  // Start time options: [current - 30, current, current + 30] — compact like calendar lock
  // From-time slabs: -1hr, -30, current, +30, +1hr, +1.5hr
  // Blocked below by the latest booked/locked slot end before this index
  const generateStartOpts = (currentStart, tl, idx, yachtObj) => {
    const cur = hhmmToMinutes(currentStart);

    // Lower bound: don't overlap any preceding booked/locked slot
    let minStart = yachtObj?.sailStartTime ? hhmmToMinutes(yachtObj.sailStartTime) : 0;
    if (tl) {
      for (let i = 0; i < idx; i++) {
        const s = tl[i];
        if (s.type === "booked" || s.type === "locked" || s.type === "pending") {
          const endMin = hhmmToMinutes(s.end);
          if (endMin > minStart) minStart = endMin;
        }
      }
    }

    // Upper bound: must leave at least 30 min before yacht ends
    const yachtEndMin = yachtObj?.sailEndTime ? hhmmToMinutes(yachtObj.sailEndTime) : 23 * 60 + 30;
    const maxStart = yachtEndMin - 30;

    return [-60, -30, 0, 30, 60, 90]
      .map((d) => cur + d)
      .filter((m) => m >= minStart && m <= maxStart && m >= 0 && m < 24 * 60)
      .map((m) => minutesToHHMM(m));
  };

  // End time options: from slotStart+30 to yacht sailEndTime in 30-min steps
  const generateEndOpts = (slotStart, yachtObj) => {
    const startMin = hhmmToMinutes(slotStart);
    let maxEnd = yachtObj ? hhmmToMinutes(yachtObj.sailEndTime) : startMin + 8 * 60;
    if (maxEnd <= startMin) maxEnd += 24 * 60;
    const opts = [];
    let cursor = startMin + 30;
    while (cursor <= maxEnd) {
      opts.push(minutesToHHMM(cursor));
      cursor += 30;
    }
    if (opts.length === 0) opts.push(minutesToHHMM(startMin + 30));
    return opts;
  };

  // End options starting from baseTime (current To) up to baseTime + 4 hrs, capped at yacht end
  const generateEndOptsLimited = (slotStart, yachtObj, baseTime) => {
    const startMin = hhmmToMinutes(slotStart);
    const baseMin = baseTime ? hhmmToMinutes(baseTime) : startMin + 30;
    let yachtMax = yachtObj ? hhmmToMinutes(yachtObj.sailEndTime) : startMin + 8 * 60;
    if (yachtMax <= startMin) yachtMax += 24 * 60;
    const fourHrMax = baseMin + 4 * 60;
    const maxEnd = Math.min(fourHrMax, yachtMax);
    const opts = [];
    // Start from baseTime (current To), minimum is slotStart + 30
    let cursor = Math.max(baseMin, startMin + 30);
    while (cursor <= maxEnd) {
      opts.push(minutesToHHMM(cursor));
      cursor += 30;
    }
    if (opts.length === 0) opts.push(minutesToHHMM(startMin + 30));
    return opts;
  };

  const to12HourFormat = (time24) => {
    if (!time24) return "";
    let [hour, minute] = time24.split(":").map(Number);
    // ✅ normalize hour (24 → 0, 25 → 1, etc.)
    hour = hour % 24;
    const period = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 === 0 ? 12 : hour % 12;
    return `${hour12}:${String(minute).padStart(2, "0")} ${period}`;
  };


  // Disable past slots for today
  const isPastSlot = (slot) => {
    if (!currentDay || !currentDay.date) return false;
    const today = new Date().toISOString().split("T")[0];
    if (currentDay.date !== today) return false;

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const slotEnd = hhmmToMinutes(slot.end);

    return slotEnd <= currentMinutes;
  };

  const buildSlotsForYacht = (yachtObj) => {
    if (
      !yachtObj ||
      !yachtObj.sailStartTime ||
      !yachtObj.sailEndTime ||
      !(yachtObj.slotDurationMinutes || yachtObj.duration)
    )
      return [];

    const timeToMin = (t) => {
      if (!t) return 0;
      const [h, m] = t.split(":").map(Number);
      return h * 60 + m;
    };

    const minToTime = (m) => {
      const h = Math.floor(m / 60);
      const mm = m % 60;
      return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
    };

    // Duration
    const durationRaw = yachtObj.slotDurationMinutes || yachtObj.duration;
    let duration = 0;
    if (typeof durationRaw === "string" && durationRaw.includes(":")) {
      const [h, m] = durationRaw.split(":").map(Number);
      duration = h * 60 + (m || 0);
    } else {
      duration = Number(durationRaw);
    }

    const startMin = timeToMin(yachtObj.sailStartTime);
    let endMin = timeToMin(yachtObj.sailEndTime);

    if (endMin <= startMin) {
      endMin += 24 * 60;
    }
    // Gather special slots (single + multiple)
    const specialMins = [];

    if (yachtObj.specialSlotTime) specialMins.push(yachtObj.specialSlotTime);
    if (Array.isArray(yachtObj.specialSlotTimes))
      specialMins.push(...yachtObj.specialSlotTimes);
    if (Array.isArray(yachtObj.specialSlots))
      specialMins.push(...yachtObj.specialSlots);

    const specialStarts = specialMins.map(timeToMin).sort((a, b) => a - b);

    // -----------------------------
    // PROCESS SPECIAL SLOTS (split overlaps)
    // -----------------------------
    const buildProcessedSpecialSlots = (starts, duration) => {
      const blocks = starts.map((sp) => ({
        start: sp,
        end: sp + duration,
      }));

      blocks.sort((a, b) => a.start - b.start);

      const merged = [];

      for (let block of blocks) {
        const last = merged[merged.length - 1];

        if (!last || block.start >= last.end) {
          merged.push(block);
        } else {
          // Overlap → split
          last.end = block.start;
          merged.push(block);
        }
      }

      return merged;
    };

    const processedSpecials = buildProcessedSpecialSlots(specialStarts, duration);

    // -----------------------------
    // BUILD NORMAL SLOTS
    // -----------------------------
    const slots = [];
    let cursor = startMin;

    while (cursor < endMin) {
      const next = cursor + duration;

      const hit = processedSpecials.find(
        (sp) => sp.start > cursor && sp.start < next
      );

      if (hit) {
        slots.push({ start: cursor, end: hit.start });

        const specialEnd = hit.end;
        slots.push({ start: hit.start, end: specialEnd });

        cursor = specialEnd;
        continue;
      }

      // ✅ ALLOW LAST SLOT TO EXTEND BEYOND sailEndTime
      if (next > endMin) {
        slots.push({
          start: cursor,
          end: next, // do NOT clamp to endMin
        });
        break; // last slot completed
      }

      // Normal slot
      slots.push({
        start: cursor,
        end: next,
      });

      cursor = next;
    }

    // -----------------------------
    // ADD SPECIAL SLOTS OUTSIDE SAIL WINDOW
    // -----------------------------
    processedSpecials.forEach((sp) => slots.push(sp));

    // -----------------------------
    // REMOVE DUPLICATES & SORT
    // -----------------------------
    const seen = new Set();
    const cleaned = slots.filter((s) => {
      const key = `${s.start}-${s.end}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    cleaned.sort((a, b) => a.start - b.start);

    return cleaned.map((s) => ({
      start: minToTime(s.start),
      end: minToTime(s.end),
    }));
  };

  const buildTimeline = (baseSlots, booked = [], locked = []) => {
    const normalizedBusy = [
      ...booked.map((b) => ({
        start: b.startTime || b.start,
        end: b.endTime || b.end,
        type: "booked",
        bookingStatus: b.status,
        custName: b.custName || "",
        empName: b.empName || "",
        appliedBy: b.appliedBy || null,
      })),
      ...locked.map((l) => ({
        start: l.startTime || l.start,
        end: l.endTime || l.end,
        type: "locked",
        empName: l.empName || "",
        appliedBy: l.appliedBy
      })),
    ];

    return baseSlots.map((slot) => {
      const overlaps = normalizedBusy.filter(
        (b) =>
          !(
            hhmmToMinutes(b.end) <= hhmmToMinutes(slot.start) ||
            hhmmToMinutes(b.start) >= hhmmToMinutes(slot.end)
          )
      );

      if (overlaps.length === 0) return { ...slot, type: "free" };

      const bookedOverlap = overlaps.find((o) => o.type === "booked");
      if (bookedOverlap) {
        return {
          ...slot,
          type: "booked",
          bookingStatus: bookedOverlap.bookingStatus,
          custName: bookedOverlap.custName,
          empName: bookedOverlap.empName,
          appliedBy: bookedOverlap.appliedBy
        };
      }

      const lockedOverlap = overlaps.find((o) => o.type === "locked");
      return {
        ...slot,
        type: "locked",
        empName: lockedOverlap.empName,
        appliedBy: lockedOverlap.appliedBy
      };
    });
  };


  // ---------- Fetch timeline (updated logic for fallback vs stored slots) ----------
  const fetchTimeline = async () => {
    if (!currentDay || !currentDay.date) {
      setTimeline([]);
      setLoading(false);
      setIsCalendarDisabled(false);
      return;
    }

    try {
      setLoading(true);
      setIsCalendarDisabled(true);
      setError("");

      // 1️⃣ Fetch yacht data
      const yachtRes = await getYachtById(yachtId, token);
      const yachtData = yachtRes?.data?.yacht ?? yachtRes?.yacht ?? yachtRes;
      setYacht(yachtData);

      // 2️⃣ Fetch day availability (booked + locked + stored slots)
      const dayResRaw = await getDayAvailability(yachtId, currentDay.date, token);
      const dayRes = dayResRaw?.data ?? dayResRaw;

      const booked = dayRes.bookedSlots || [];
      const locked = dayRes.lockedSlots || [];
      // 3️⃣ Check if DB has manually saved slots for this date
      const storedSlotEntry =
        dayRes?.slots && Array.isArray(dayRes.slots)
          ? dayRes.slots[0] // slot document for that date
          : null;
      let finalBaseSlots = [];

      if (storedSlotEntry) {
        // 🟦 CASE A: Use stored slots from DB
        finalBaseSlots = storedSlotEntry.slots.map((s) => ({
          start: s.start,
          end: s.end,
        }));
        // Stop sale = explicit DB entry with zero slots
        setIsStopSale(storedSlotEntry.slots.length === 0);
      } else {
        // 🟧 CASE B: No stored slots → use auto generator
        finalBaseSlots = buildSlotsForYacht(yachtData);
        setIsStopSale(false);
      }

      // 4️⃣ Build timeline with overhead (booked + locked)
      const finalTimeline = buildTimeline(finalBaseSlots, booked, locked);
      setTimeline(finalTimeline);

    } catch (err) {
      console.error(err);
      setError("Failed to load timeline");
      setTimeline([]);
    } finally {
      setLoading(false);
      setIsCalendarDisabled(false);
    }
  };

  useEffect(() => {
    if (currentDay && currentDay.date) {
      fetchTimeline();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yachtId, currentDay?.date]);

  // ---------- Slot Interactions ----------

  const handleMoveSlot = (index, direction) => {
    const newSlots = [...editedDaySlots];
    const targetIndex = index + direction;

    if (targetIndex < 0 || targetIndex >= newSlots.length) return;

    const temp = newSlots[targetIndex];
    newSlots[targetIndex] = newSlots[index];
    newSlots[index] = temp;

    setEditedDaySlots(newSlots);
  };


  const handleSlotClick = (slot) => {
    setSelectedSlot(slot);
    if (slot.type === "booked" || slot.type === "pending") setShowBookedModal(true);
    else if (slot.type === "locked") setShowConfirmModal(true);
    else setShowLockModal(true);
  };

  const handleLockSlot = async (e) => {
    e.preventDefault();
    if (!selectedSlot || isLocking) return;
    setIsLocking(true);
    try {
      const res = await lockSlot(yachtId, currentDay.date, selectedSlot.start, selectedSlot.end, token);
      if (res?.success) {
        toast.success("Slot locked successfully!");
        setShowLockModal(false);
        fetchTimeline();
      } else toast.error(res?.message || "Failed to lock slot");
    } catch {
      toast.error("Error locking slot");
    } finally {
      setIsLocking(false);
    }
  };

  const handleReleaseLock = async () => {
    if (!selectedSlot || isReleasing) return;
    setIsReleasing(true);
    try {
      const res = await releaseSlot(yachtId, currentDay.date, selectedSlot.start, selectedSlot.end, token);
      if (res?.success) {
        toast.success("Slot released successfully!");
        setShowConfirmModal(false);
        fetchTimeline();
      } else toast.error(res?.message || "Failed to release slot");
    } catch {
      toast.error("Error releasing slot");
    } finally {
      setIsReleasing(false);
    }
  };

  const handleConfirmBooking = (e) => {
    e.preventDefault();
    if (!selectedSlot || isConfirming) return;
    setIsConfirming(true);
    setShowConfirmModal(false);
    navigate("/create-booking", {
      state: { yachtId, yachtName, yacht, date: currentDay.date, startTime: selectedSlot.start, endTime: selectedSlot.end },
    });
    setIsConfirming(false);
  };

  // ---------- Edit-Day Modal logic (Replace ALL slots) ----------
  // Open edit modal and load current free slots into editedDaySlots
  const openEditDaySlotsModal = ({ globalEdit = false, focusIdx = null } = {}) => {
    const toEditable = (rawSlots) =>
      rawSlots.map((s, i) => ({
        start: s.start,
        end: s.end,
        status: s.type || s.status || "free",
        isPrime: isPrimeSlot(s.start, yacht),
        isEditing: globalEdit || i === focusIdx,
      }));

    let slots;
    if (!timeline || timeline.length === 0) {
      const defaultSlots = yacht ? buildSlotsForYacht(yacht) : [];
      slots = toEditable(defaultSlots.map((s) => ({ ...s, type: "free" })));
    } else {
      slots = toEditable(timeline);
    }

    setEditedDaySlots(slots);
    initialDaySlotsRef.current = slots.map(({ start, end }) => ({ start, end }));
    setIsGlobalEdit(globalEdit);
    setShowEditSlotsModal(true);
  };

  // Open inline editor for a specific free slot
  const openInlineEdit = (idx) => {
    setInlineEditIdx(idx);
    setInlineEditSlot({ start: timeline[idx].start, end: timeline[idx].end });
  };

  // Save inline-edited slot and reload
  const handleInlineEditSave = async () => {
    if (inlineEditIdx === null) return;
    setIsSavingInline(true);

    const newEndMin = hhmmToMinutes(inlineEditSlot.end);
    const yachtEndMin = yacht?.sailEndTime ? hhmmToMinutes(yacht.sailEndTime) : 24 * 60;

    // Find the first FREE slot strictly after inlineEditIdx
    const nextFreeIdx = timeline.findIndex(
      (s, i) => i > inlineEditIdx && s.type === "free"
    );

    const payloadSlots = timeline.map((s, i) => {
      if (i === inlineEditIdx) return { start: inlineEditSlot.start, end: inlineEditSlot.end };
      if (i === nextFreeIdx) {
        // Auto-adjust: start at edited slot's new end, duration = yacht slot duration, capped at yacht end
        const slotDur = getDurationMins(yacht) || 120;
        const adjStart = newEndMin;
        const adjEnd = Math.min(adjStart + slotDur, yachtEndMin);
        if (adjEnd <= adjStart) return null; // no room — drop this slot
        return { start: minutesToHHMM(adjStart), end: minutesToHHMM(adjEnd) };
      }
      return { start: s.start, end: s.end };
    }).filter(Boolean);

    try {
      const res = await updateDaySlots(yachtId, currentDay.date, payloadSlots, token);
      if (res?.success) {
        toast.success("Slot updated");
        setInlineEditIdx(null);
        fetchTimeline();
      } else {
        toast.error(res?.message || "Failed to update slot");
      }
    } catch {
      toast.error("Error updating slot");
    } finally {
      setIsSavingInline(false);
    }
  };

  // Quick-delete a single free slot without opening the modal
  const handleQuickDeleteSlot = async (slotIdx) => {
    const slot = timeline[slotIdx];
    if (!slot || slot.type === "booked" || slot.type === "locked") return;
    if (!window.confirm(`Delete ${to12HourFormat(slot.start)} — ${to12HourFormat(slot.end)}?`)) return;

    const payloadSlots = timeline
      .filter((_, i) => i !== slotIdx)
      .map((s) => ({ start: s.start, end: s.end }));

    try {
      const res = await updateDaySlots(yachtId, currentDay.date, payloadSlots, token);
      if (res?.success) {
        toast.success("Slot removed");
        fetchTimeline();
      } else {
        toast.error(res?.message || "Failed to remove slot");
      }
    } catch {
      toast.error("Error removing slot");
    }
  };

  const handleEditedSlotChange = (index, field, value) => {
    setEditedDaySlots((prev) => {
      const durationMins = getDurationMins(yacht);
      let updated = prev.map((s) => ({ ...s }));
      const oldVal = updated[index][field];
      updated[index][field] = value;

      if (field === "end") {
        const newEndMin = hhmmToMinutes(value);
        const oldEndMin = hhmmToMinutes(oldVal);

        // If end moved FORWARD: adjust / remove next free slot
        if (newEndMin > oldEndMin) {
          for (let i = index + 1; i < updated.length; i++) {
            if (updated[i].status === "booked" || updated[i].status === "locked") break;
            const nextStartMin = hhmmToMinutes(updated[i].start);
            const nextEndMin = hhmmToMinutes(updated[i].end);
            if (nextStartMin < newEndMin) {
              if (newEndMin >= nextEndMin) {
                updated.splice(i, 1); // absorb entirely
              } else {
                updated[i] = { ...updated[i], start: value }; // push start forward
              }
            }
            break;
          }
        }

        // If end moved BACKWARD: fill gap with duration-sized free slots
        if (newEndMin < oldEndMin && durationMins > 0) {
          const nextFreeStart = (() => {
            for (let i = index + 1; i < updated.length; i++) {
              if (updated[i].status !== "booked" && updated[i].status !== "locked")
                return hhmmToMinutes(updated[i].start);
              break;
            }
            return oldEndMin;
          })();
          const fillSlots = [];
          let cursor = newEndMin;
          while (cursor + durationMins <= nextFreeStart) {
            fillSlots.push({
              start: minutesToHHMM(cursor),
              end: minutesToHHMM(cursor + durationMins),
              status: "free",
              isPrime: isPrimeSlot(minutesToHHMM(cursor), yacht),
            });
            cursor += durationMins;
          }
          updated.splice(index + 1, 0, ...fillSlots);
        }

      } else if (field === "start") {
        const newStartMin = hhmmToMinutes(value);
        const oldStartMin = hhmmToMinutes(oldVal);

        // If start moved BACKWARD: adjust / remove prev free slot
        if (newStartMin < oldStartMin) {
          for (let i = index - 1; i >= 0; i--) {
            if (updated[i].status === "booked" || updated[i].status === "locked") break;
            const prevEndMin = hhmmToMinutes(updated[i].end);
            const prevStartMin = hhmmToMinutes(updated[i].start);
            if (prevEndMin > newStartMin) {
              if (newStartMin <= prevStartMin) {
                updated.splice(i, 1); // absorb entirely
              } else {
                updated[i] = { ...updated[i], end: value }; // pull end backward
              }
            }
            break;
          }
        }

        // If start moved FORWARD: fill gap with duration-sized free slots
        if (newStartMin > oldStartMin && durationMins > 0) {
          const prevFreeEnd = (() => {
            for (let i = index - 1; i >= 0; i--) {
              if (updated[i].status !== "booked" && updated[i].status !== "locked")
                return hhmmToMinutes(updated[i].end);
              break;
            }
            return oldStartMin;
          })();
          const fillSlots = [];
          let cursor = prevFreeEnd;
          while (cursor + durationMins <= newStartMin) {
            fillSlots.push({
              start: minutesToHHMM(cursor),
              end: minutesToHHMM(cursor + durationMins),
              status: "free",
              isPrime: isPrimeSlot(minutesToHHMM(cursor), yacht),
            });
            cursor += durationMins;
          }
          updated.splice(index, 0, ...fillSlots);
        }
      }

      // Remove any invalid (end <= start) slots
      return updated.filter((s) => hhmmToMinutes(s.end) > hhmmToMinutes(s.start));
    });
  };

  const handleAddEditedSlot = (indexAfter = null) => {
    setEditedDaySlots((prev) => {
      const copy = prev.map((s) => ({ ...s }));
      const durationMins = getDurationMins(yacht) || 60;
      // Pick start time right after the last existing slot (or 06:00 as default)
      const lastSlot = copy[copy.length - 1];
      const defaultStart = lastSlot ? lastSlot.end : "06:00";
      const defaultStartMin = hhmmToMinutes(defaultStart);
      const defaultEnd = minutesToHHMM(defaultStartMin + durationMins);
      const newSlot = { start: defaultStart, end: defaultEnd, status: "free", isPrime: false, isEditing: true };

      if (indexAfter !== null && indexAfter >= -1 && indexAfter < copy.length) {
        copy.splice(indexAfter + 1, 0, newSlot);
      } else {
        copy.push(newSlot);
      }
      return copy;
    });
  };

  const handleRemoveEditedSlot = (index) => {
    setEditedDaySlots((prev) => prev.filter((_, i) => i !== index));
  };

  // Validation: ensure start < end and no overlaps
  const validateEditedDaySlots = () => {
    if (!editedDaySlots) {
      toast.error("Add at least one slot");
      return false;
    }

    // Normalize into minutes and sort by start time
    const normalized = editedDaySlots.map((s, idx) => {
      const startMin = hhmmToMinutes(s.start);
      const endMin = hhmmToMinutes(s.end);
      return { startMin, endMin, idx, raw: s };
    });

    // Each slot must have start < end
    for (let sl of normalized) {
      if (sl.endMin <= sl.startMin) {
        toast.error("Each slot must have end time after start time");
        return false;
      }
    }

    return true;
  };

  const handleToggleSlotEdit = (index) => {
    setEditedDaySlots((prev) =>
      prev.map((s, i) => i === index ? { ...s, isEditing: !s.isEditing } : s)
    );
  };

  const handleResetDayUI = async () => {
    if (!yacht) { toast.error("Yacht data not loaded"); return; }
    if (!currentDay?.date) { toast.error("No date selected"); return; }

    const defaultSlots = buildSlotsForYacht(yacht);
    const resetFree = defaultSlots.map((s) => ({
      start: s.start, end: s.end,
      status: "free", isPrime: isPrimeSlot(s.start, yacht), isEditing: false,
    }));

    // Keep booked/locked rows in the modal UI
    const bookedLocked = editedDaySlots.filter(
      (s) => s.status === "booked" || s.status === "locked"
    );
    setEditedDaySlots([...bookedLocked, ...resetFree]);

    // Save immediately — only free slots go to API (booked/locked are tracked separately)
    setIsSavingDaySlots(true);
    try {
      const payloadSlots = resetFree.map((s) => ({ start: s.start, end: s.end }));
      const res = await updateDaySlots(yachtId, currentDay.date, payloadSlots, token);
      if (res?.success) {
        toast.success("Slots reset to default.");
        setShowEditSlotsModal(false);
        fetchTimeline();
      } else {
        toast.error(res?.message || "Failed to reset slots");
      }
    } catch {
      toast.error("Error resetting slots");
    } finally {
      setIsSavingDaySlots(false);
    }
  };

  const handleDeleteAllUI = () => {
    setEditedDaySlots((prev) =>
      prev.filter((slot) => slot.status === "booked")
    );
    setIsStopSale(true);
    toast.success("Sale stopped.");
  };



  const handleSaveEditedDaySlots = async () => {
    if (!currentDay || !currentDay.date) {
      toast.error("No date selected");
      return;
    }

    if (!validateEditedDaySlots()) return;
    setIsSavingDaySlots(true);

    try {
      // Build payload expected by backend: array of { start, end }
      const payloadSlots = editedDaySlots.map((s) => ({
        start: s.start,
        end: s.end
      }));

      const res = await updateDaySlots(yachtId, currentDay.date, payloadSlots, token);
      if (res?.success) {
        toast.success("Day slots updated!");
        setShowEditSlotsModal(false);
        fetchTimeline();
      } else {
        toast.error(res?.message || "Failed to update day slots");
      }
    } catch (err) {
      toast.error("Error updating day slots");
    } finally {
      setIsSavingDaySlots(false);
    }
  };

  // Calendar onChange handler
  const handleCalendarChange = (sd) => {
    if (isCalendarDisabled) return;

    const year = sd.getFullYear();
    const month = String(sd.getMonth() + 1).padStart(2, "0");
    const date = String(sd.getDate()).padStart(2, "0");
    const iso = `${year}-${month}-${date}`;

    const newDay = {
      date: iso,
      day: sd.toLocaleDateString("en-US", { weekday: "long" }),
    };

    setCurrentDay(newDay);
    // also update location.state safely
    if (location.state) {
      try {
        location.state.day = newDay;
        location.state.requireDateSelection = false;
      } catch (e) {
        // ignore
      }
    }
    setSelectedDate(sd);
    setError("");
    // fetchTimeline will be triggered by effect when currentDay.date changes
  };

  // ---------- Render ----------
  return (
    <div className="container py-4 day-container">
      {/* PREMIUM LOADING OVERLAY */}
      {loading && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            animation: "fadeIn 0.2s ease-in",
          }}
        >
          <div
            className="spinner-border text-light"
            role="status"
            style={{ width: "4rem", height: "4rem", borderWidth: "0.3rem" }}
          >
            <span className="visually-hidden">Loading...</span>
          </div>
          <p
            className="text-light mt-4 mb-0 fw-semibold"
            style={{ fontSize: "1.1rem", letterSpacing: "0.5px" }}
          >
            Loading time slots...
          </p>
        </div>
      )}

      <div className="card shadow-sm mb-4 border-0 rounded-4 p-3">
        <div className="d-flex align-items-center justify-content-between">
          <button className="btn-back-icon" onClick={() => navigate(-1)} title="Go back">
            <svg viewBox="0 0 20 20" fill="none"><path d="M12.5 5L7.5 10L12.5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>

          <div className="text-center flex-grow-1">
            <h4 className="fw-bold text-primary mb-1">{yachtName}</h4>
            {currentDay && currentDay.date && (
              <h6 className="text-muted mb-0">
                {new Date(currentDay.date + "T00:00:00").toLocaleDateString("en-GB", {
                  weekday: "long", day: "numeric", month: "short", year: "numeric"
                })}
              </h6>
            )}
          </div>

          <div style={{ width: "75px" }}></div>
        </div>
      </div>

      <div className="availability-wrapper">
        <div className="availability-left">
          <h5 className="text-center fw-semibold text-secondary mb-3">
            📅 Select Date
          </h5>

          <div
            style={{
              position: "relative",
              pointerEvents: isCalendarDisabled ? "none" : "auto",
              opacity: isCalendarDisabled ? 0.5 : 1,
              transition: "opacity 0.3s ease",
            }}
          >
            <Calendar
              onChange={handleCalendarChange}
              value={selectedDate}
              minDate={new Date()}
              maxDate={new Date(new Date().setMonth(new Date().getMonth() + 6))}
              next2Label={null}
              prev2Label={null}
              className="shadow-sm rounded-4"
            />
          </div>
        </div>

        <div className="availability-right">
          <div className="card shadow-sm border-0 rounded-4 p-3">
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
              <div style={{ display: "flex", gap: 5, alignItems: "center", flexWrap: "wrap" }}>
                {yacht?.runningCost > 0 && (
                  <span className="badge bg-primary bg-opacity-10 text-primary px-2 py-1 rounded-pill fw-semibold" style={{ fontSize: 11 }}>
                    B2b: ₹{Number(yacht.runningCost).toLocaleString("en-IN")}
                  </span>
                )}
                {yacht?.sellingPrice > 0 && (
                  <span className="badge bg-success bg-opacity-10 text-success px-2 py-1 rounded-pill fw-semibold" style={{ fontSize: 11 }}>
                    Selling: ₹{Number(yacht.sellingPrice).toLocaleString("en-IN")}
                  </span>
                )}
                {yacht?.maxSellingPrice > 0 && (
                  <span className="badge px-2 py-1 rounded-pill fw-semibold" style={{ fontSize: 11, background: "#fff7ed", color: "#c2410c" }}>
                    Customer: ₹{Number(yacht.maxSellingPrice).toLocaleString("en-IN")}
                  </span>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap", fontSize: 10.5, fontWeight: 600, color: "#475569" }}>
                  {[
                    { label: "Free",    color: "#22c55e" },
                    { label: "Locked",  color: "#f59e0b" },
                    { label: "Pending", color: "#3b82f6" },
                    { label: "Booked",  color: "#ef4444" },
                  ].map(({ label, color }, i, arr) => (
                    <span key={label} style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
                      {label}
                      {i < arr.length - 1 && <span style={{ color: "#cbd5e1", marginLeft: 3 }}>|</span>}
                    </span>
                  ))}
                </div>
                {isAdmin && (
                  <button
                    onClick={() => openEditDaySlotsModal({ globalEdit: true })}
                    title="Edit All Slots"
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 5,
                      padding: "4px 12px", borderRadius: 8, flexShrink: 0,
                      border: "1.5px solid #c9a84c",
                      background: "rgba(201,168,76,0.08)",
                      color: "#7a5c1e", fontSize: 12, fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    ✏️ Edit All
                  </button>
                )}
              </div>
            </div>

            {/* Separator between header bar and slot list */}
            <hr style={{ margin: "8px 0 10px", borderColor: "#e2e8f0", opacity: 1 }} />

            {error ? (
              <div className="alert alert-warning text-center py-4 my-4" role="alert">
                <i className="bi bi-calendar-event fs-3 d-block mb-2"></i>
                <p className="mb-0 fs-5">{error}</p>
              </div>
            ) : timeline.length === 0 && !loading ? (
              <div className="text-center py-5">
                {isStopSale ? (
                  <>
                    <div style={{ fontSize: 36, marginBottom: 8 }}>🚫</div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: "#dc2626" }}>Out for Maintenance</div>
                    <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>No slots available for this date</div>
                  </>
                ) : (
                  <span className="text-muted">No available slots for this date.</span>
                )}
              </div>
            ) : (
              <>
                <div className="slot-row-container gap-2">
                  {timeline.map((slot, idx) => {
                    const disabled = isPastSlot(slot);
                    const isFree = slot.type === "free";
                    const isBooked = slot.type === "booked";
                    const isLocked = slot.type === "locked";

                    const slotClass = disabled
                      ? "bg-secondary text-white opacity-50"
                      : isBooked
                        ? slot.bookingStatus === "pending"
                          ? "bg-info text-dark"
                          : "bg-danger text-white"
                        : isLocked
                          ? "bg-warning text-dark"
                          : "bg-success text-white";

                    const unauthorized =
                      !isAdminOrOnsite &&
                      (isLocked || isBooked || slot.type === "pending") &&
                      !isOwner(slot);

                    const cursorStyle = disabled || unauthorized ? "not-allowed" : "pointer";
                    const timeLabel = `${to12HourFormat(slot.start)} — ${to12HourFormat(slot.end)}`;
                    const showActions = isAdmin && !disabled && isFree;

                    // ── Inline edit mode for this slot ──
                    if (inlineEditIdx === idx) {
                      const startOpts = generateStartOpts(timeline[idx].start, timeline, idx, yacht);
                      const endOpts = generateEndOptsLimited(inlineEditSlot.start, yacht, inlineEditSlot.end);
                      return (
                        <div key={idx} style={{
                          borderRadius: 10, border: "2px solid #c9a84c",
                          background: "#fffbeb", padding: "10px 12px",
                          display: "flex", flexDirection: "column", gap: 8,
                        }}>
                          {/* Row 1: selectors */}
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 12, color: "#64748b", flexShrink: 0 }}>From</span>
                            <select
                              value={inlineEditSlot.start}
                              onChange={(e) => {
                                const newStart = e.target.value;
                                const endOpts2 = generateEndOptsLimited(newStart, yacht);
                                setInlineEditSlot({ start: newStart, end: endOpts2[0] });
                              }}
                              style={{
                                flex: 1, height: 34, padding: "0 6px", borderRadius: 8,
                                border: "1.5px solid #c9a84c", fontSize: 13, fontWeight: 600,
                                color: "#051829", background: "#fff", outline: "none",
                              }}
                            >
                              {startOpts.map((t) => <option key={t} value={t}>{to12HourFormat(t)}</option>)}
                            </select>
                            <span style={{ fontSize: 12, color: "#64748b", flexShrink: 0 }}>To</span>
                            <select
                              value={inlineEditSlot.end}
                              onChange={(e) => setInlineEditSlot((s) => ({ ...s, end: e.target.value }))}
                              style={{
                                flex: 1, height: 34, padding: "0 6px", borderRadius: 8,
                                border: "1.5px solid #c9a84c", fontSize: 13, fontWeight: 600,
                                color: "#051829", background: "#fff", outline: "none",
                              }}
                            >
                              {endOpts.map((t) => <option key={t} value={t}>{to12HourFormat(t)}</option>)}
                            </select>
                          </div>
                          {/* Row 2: actions */}
                          <div style={{ display: "flex", gap: 8 }}>
                            <button
                              onClick={() => setInlineEditIdx(null)}
                              style={{
                                flex: 1, padding: "7px 0", borderRadius: 8,
                                border: "1.5px solid #e2e8f0", background: "#fff",
                                color: "#475569", fontSize: 13, fontWeight: 600, cursor: "pointer",
                              }}
                            >Cancel</button>
                            <button
                              onClick={handleInlineEditSave}
                              disabled={isSavingInline}
                              style={{
                                flex: 2, padding: "7px 0", borderRadius: 8,
                                background: isSavingInline ? "#94a3b8" : "linear-gradient(135deg,#c9a84c,#e0b850)",
                                border: "none", color: "#051829", fontSize: 13, fontWeight: 700,
                                cursor: isSavingInline ? "not-allowed" : "pointer",
                                display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                                boxShadow: isSavingInline ? "none" : "0 2px 8px rgba(201,168,76,0.35)",
                              }}
                            >
                              {isSavingInline ? "Saving…" : "✅ Save"}
                            </button>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={idx}
                        className={`slot-btn px-3 py-2 rounded fw-semibold ${slotClass}`}
                        style={{
                          cursor: cursorStyle,
                          display: "flex", alignItems: "center",
                          justifyContent: "space-between", gap: 6,
                        }}
                        title={
                          timeLabel +
                          ((isAdminOrOnsite || slot.empName === employee.name)
                            ? isLocked
                              ? ` | Locked by: ${slot.empName}`
                              : isBooked
                                ? ` | Booked By ${slot.empName} for ${slot.custName}`
                                : ""
                            : "")
                        }
                      >
                        {/* Time label — always centred */}
                        <span
                          style={{ flex: 1, textAlign: "center", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}
                          onClick={() => {
                            if (disabled || unauthorized) return;
                            handleSlotClick(slot);
                          }}
                        >
                          {timeLabel}
                        </span>

                        {/* Admin action icons — edit + delete */}
                        {showActions && (
                          <span style={{
                            display: "flex", gap: 5, flexShrink: 0,
                            borderLeft: "1.5px solid rgba(255,255,255,0.45)",
                            paddingLeft: 8, marginLeft: 4,
                          }}>
                            <button
                              onClick={(e) => { e.stopPropagation(); openInlineEdit(idx); }}
                              title="Edit this slot"
                              style={{
                                width: 28, height: 28, borderRadius: 7,
                                border: "none", background: "#fff", color: "#7a5c1e",
                                fontSize: 14, cursor: "pointer",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                boxShadow: "0 1px 4px rgba(0,0,0,0.18)", flexShrink: 0,
                              }}
                            >✏️</button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleQuickDeleteSlot(idx); }}
                              title="Delete this slot"
                              style={{
                                width: 28, height: 28, borderRadius: 7,
                                border: "none", background: "#fff", color: "#dc2626",
                                fontSize: 14, cursor: "pointer",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                boxShadow: "0 1px 4px rgba(0,0,0,0.18)", flexShrink: 0,
                              }}
                            >🗑</button>
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Lock Slot Modal ── */}
      {showLockModal && (
        <div onClick={() => setShowLockModal(false)} style={{ position:"fixed",inset:0,zIndex:9999,background:"rgba(5,24,41,0.55)",display:"flex",alignItems:"center",justifyContent:"center",padding:"20px" }}>
          <div onClick={e => e.stopPropagation()} style={{ borderRadius:20,overflow:"hidden",boxShadow:"0 20px 60px rgba(5,24,41,0.28)",background:"#fff",width:"100%",maxWidth:380 }}>
            <form onSubmit={handleLockSlot}>
              {/* Header */}
              <div style={{ background:"linear-gradient(135deg,#051829 0%,#0a2d4a 60%,#0d4a6e 100%)",padding:"22px 24px 18px",position:"relative" }}>
                <button type="button" onClick={() => setShowLockModal(false)} style={{ position:"absolute",top:14,right:16,background:"rgba(255,255,255,0.12)",border:"none",borderRadius:"50%",width:30,height:30,color:"#fff",fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}>✕</button>
                <div style={{ display:"flex",alignItems:"center",gap:12 }}>
                  <div style={{ width:44,height:44,borderRadius:12,background:"rgba(201,168,76,0.18)",border:"1.5px solid rgba(201,168,76,0.4)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0 }}>🔒</div>
                  <div>
                    <div style={{ color:"#c9a84c",fontSize:11,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:2 }}>Availability</div>
                    <div style={{ color:"#fff",fontSize:17,fontWeight:700,lineHeight:1.2 }}>Lock Time Slot</div>
                  </div>
                </div>
                {yachtName && (
                  <div style={{ marginTop:14,display:"inline-flex",alignItems:"center",gap:6,background:"rgba(201,168,76,0.15)",border:"1px solid rgba(201,168,76,0.3)",borderRadius:20,padding:"4px 12px" }}>
                    <span style={{ fontSize:13 }}>⚓</span>
                    <span style={{ color:"#e8d5a0",fontSize:12.5,fontWeight:600 }}>{yachtName}</span>
                  </div>
                )}
              </div>
              {/* Body */}
              <div style={{ padding:"20px 24px 8px" }}>
                {selectedSlot && (
                  <>
                    <div style={{ background:"linear-gradient(135deg,#f0f7ff,#e8f4fd)",border:"1.5px solid #bfdbfe",borderRadius:14,padding:"16px 20px",marginBottom:16,textAlign:"center" }}>
                      <div style={{ fontSize:22,fontWeight:800,color:"#051829",letterSpacing:"-0.02em",lineHeight:1 }}>
                        {to12HourFormat(selectedSlot.start)}
                        <span style={{ fontSize:16,fontWeight:500,color:"#64748b",margin:"0 8px" }}>→</span>
                        {to12HourFormat(selectedSlot.end)}
                      </div>
                      {currentDay?.date && (
                        <div style={{ marginTop:6,fontSize:12.5,fontWeight:600,color:"#475569" }}>
                          {new Date(currentDay.date + "T00:00:00").toLocaleDateString("en-GB",{ weekday:"long",day:"numeric",month:"long" })}
                        </div>
                      )}
                    </div>
                    <div style={{ display:"flex",alignItems:"flex-start",gap:8,background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:10,padding:"10px 12px" }}>
                      <span style={{ fontSize:14,marginTop:1 }}>ℹ️</span>
                      <span style={{ fontSize:12,color:"#64748b",lineHeight:1.5 }}>Locking reserves this slot temporarily. It will auto-release if a booking is not confirmed in time.</span>
                    </div>
                  </>
                )}
              </div>
              {/* Footer */}
              <div style={{ padding:"16px 24px 20px",display:"flex",gap:10 }}>
                <button type="button" onClick={() => setShowLockModal(false)} style={{ flex:1,padding:"11px 0",borderRadius:12,border:"1.5px solid #e2e8f0",background:"#fff",color:"#475569",fontSize:14,fontWeight:600,cursor:"pointer" }}>Cancel</button>
                <button type="submit" disabled={isLocking} style={{ flex:2,padding:"11px 0",borderRadius:12,background:isLocking?"#94a3b8":"linear-gradient(135deg,#c9a84c,#e0b850)",border:"none",color:"#051829",fontSize:14,fontWeight:700,cursor:isLocking?"not-allowed":"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:7,boxShadow:isLocking?"none":"0 4px 14px rgba(201,168,76,0.35)" }}>
                  {isLocking ? "Locking…" : "🔒 Lock Slot"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Confirm Booking Modal ── */}
      {showConfirmModal && (
        <div onClick={() => setShowConfirmModal(false)} style={{ position:"fixed",inset:0,zIndex:9999,background:"rgba(5,24,41,0.55)",display:"flex",alignItems:"center",justifyContent:"center",padding:"20px" }}>
          <div onClick={e => e.stopPropagation()} style={{ borderRadius:20,overflow:"hidden",boxShadow:"0 20px 60px rgba(5,24,41,0.28)",background:"#fff",width:"100%",maxWidth:380 }}>
            <form onSubmit={handleConfirmBooking}>
              {/* Header */}
              <div style={{ background:"linear-gradient(135deg,#051829 0%,#0a2d4a 60%,#0d4a6e 100%)",padding:"22px 24px 18px",position:"relative" }}>
                <button type="button" onClick={() => setShowConfirmModal(false)} style={{ position:"absolute",top:14,right:16,background:"rgba(255,255,255,0.12)",border:"none",borderRadius:"50%",width:30,height:30,color:"#fff",fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}>✕</button>
                <div style={{ display:"flex",alignItems:"center",gap:12 }}>
                  <div style={{ width:44,height:44,borderRadius:12,background:"rgba(201,168,76,0.18)",border:"1.5px solid rgba(201,168,76,0.4)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0 }}>📋</div>
                  <div>
                    <div style={{ color:"#c9a84c",fontSize:11,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:2 }}>Locked Slot</div>
                    <div style={{ color:"#fff",fontSize:17,fontWeight:700,lineHeight:1.2 }}>Confirm Booking</div>
                  </div>
                </div>
                {yachtName && (
                  <div style={{ marginTop:14,display:"inline-flex",alignItems:"center",gap:6,background:"rgba(201,168,76,0.15)",border:"1px solid rgba(201,168,76,0.3)",borderRadius:20,padding:"4px 12px" }}>
                    <span style={{ fontSize:13 }}>⚓</span>
                    <span style={{ color:"#e8d5a0",fontSize:12.5,fontWeight:600 }}>{yachtName}</span>
                  </div>
                )}
              </div>
              {/* Body */}
              <div style={{ padding:"20px 24px 8px" }}>
                {selectedSlot && (
                  <div style={{ background:"linear-gradient(135deg,#f0f7ff,#e8f4fd)",border:"1.5px solid #bfdbfe",borderRadius:14,padding:"16px 20px",textAlign:"center" }}>
                    <div style={{ fontSize:22,fontWeight:800,color:"#051829",letterSpacing:"-0.02em",lineHeight:1 }}>
                      {to12HourFormat(selectedSlot.start)}
                      <span style={{ fontSize:16,fontWeight:500,color:"#64748b",margin:"0 8px" }}>→</span>
                      {to12HourFormat(selectedSlot.end)}
                    </div>
                    {currentDay?.date && (
                      <div style={{ marginTop:6,fontSize:12.5,fontWeight:600,color:"#475569" }}>
                        {new Date(currentDay.date + "T00:00:00").toLocaleDateString("en-GB",{ weekday:"long",day:"numeric",month:"long" })}
                      </div>
                    )}
                    {selectedSlot.empName && (
                      <div style={{ marginTop:8,fontSize:12,color:"#0d4a6e",fontWeight:600 }}>Locked by: {selectedSlot.empName}</div>
                    )}
                  </div>
                )}
              </div>
              {/* Footer */}
              <div style={{ padding:"16px 24px 20px",display:"flex",gap:10 }}>
                <button type="button" onClick={handleReleaseLock} disabled={isReleasing} style={{ flex:1,padding:"11px 0",borderRadius:12,border:"1.5px solid #fca5a5",background:"#fff5f5",color:"#dc2626",fontSize:14,fontWeight:600,cursor:isReleasing?"not-allowed":"pointer" }}>
                  {isReleasing ? "Releasing…" : "🔓 Release"}
                </button>
                <button type="submit" disabled={isConfirming} style={{ flex:2,padding:"11px 0",borderRadius:12,background:isConfirming?"#94a3b8":"linear-gradient(135deg,#c9a84c,#e0b850)",border:"none",color:"#051829",fontSize:14,fontWeight:700,cursor:isConfirming?"not-allowed":"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:7,boxShadow:isConfirming?"none":"0 4px 14px rgba(201,168,76,0.35)" }}>
                  {isConfirming ? "Please wait…" : "📋 Confirm Booking"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Booked Slot Modal ── */}
      {showBookedModal && (
        <div onClick={() => setShowBookedModal(false)} style={{ position:"fixed",inset:0,zIndex:9999,background:"rgba(5,24,41,0.55)",display:"flex",alignItems:"center",justifyContent:"center",padding:"20px" }}>
          <div onClick={e => e.stopPropagation()} style={{ borderRadius:20,overflow:"hidden",boxShadow:"0 20px 60px rgba(5,24,41,0.28)",background:"#fff",width:"100%",maxWidth:380 }}>
            {/* Header */}
            <div style={{ background:"linear-gradient(135deg,#051829 0%,#0a2d4a 60%,#0d4a6e 100%)",padding:"22px 24px 18px",position:"relative" }}>
              <button type="button" onClick={() => setShowBookedModal(false)} style={{ position:"absolute",top:14,right:16,background:"rgba(255,255,255,0.12)",border:"none",borderRadius:"50%",width:30,height:30,color:"#fff",fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}>✕</button>
              <div style={{ display:"flex",alignItems:"center",gap:12 }}>
                <div style={{ width:44,height:44,borderRadius:12,background:"rgba(201,168,76,0.18)",border:"1.5px solid rgba(201,168,76,0.4)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0 }}>📅</div>
                <div>
                  <div style={{ color:"#c9a84c",fontSize:11,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:2 }}>Slot Info</div>
                  <div style={{ color:"#fff",fontSize:17,fontWeight:700,lineHeight:1.2 }}>Booked Slot</div>
                </div>
              </div>
            </div>
            {/* Body */}
            <div style={{ padding:"20px 24px 8px" }}>
              {selectedSlot && (
                <div style={{ background:"linear-gradient(135deg,#f0f7ff,#e8f4fd)",border:"1.5px solid #bfdbfe",borderRadius:14,padding:"16px 20px",textAlign:"center" }}>
                  <div style={{ fontSize:22,fontWeight:800,color:"#051829",letterSpacing:"-0.02em",lineHeight:1 }}>
                    {to12HourFormat(selectedSlot.start)}
                    <span style={{ fontSize:16,fontWeight:500,color:"#64748b",margin:"0 8px" }}>→</span>
                    {to12HourFormat(selectedSlot.end)}
                  </div>
                  {selectedSlot.custName && <div style={{ marginTop:8,fontSize:13,color:"#0d4a6e",fontWeight:600 }}>Customer: {selectedSlot.custName}</div>}
                  {selectedSlot.empName && <div style={{ marginTop:4,fontSize:12,color:"#64748b",fontWeight:500 }}>Booked by: {selectedSlot.empName}</div>}
                </div>
              )}
            </div>
            {/* Footer */}
            <div style={{ padding:"16px 24px 20px" }}>
              <button type="button" onClick={() => setShowBookedModal(false)} style={{ width:"100%",padding:"11px 0",borderRadius:12,border:"1.5px solid #e2e8f0",background:"#fff",color:"#475569",fontSize:14,fontWeight:600,cursor:"pointer" }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Day Slots Modal (branded) ── */}
      {showEditSlotsModal && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setShowEditSlotsModal(false); }}
          style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "rgba(5,24,41,0.62)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "16px 16px 80px 16px",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff", borderRadius: 20, width: "100%", maxWidth: 480,
              boxShadow: "0 24px 64px rgba(5,24,41,0.32)",
              overflow: "hidden", display: "flex", flexDirection: "column",
              maxHeight: "90vh",
            }}
          >
            {/* Header */}
            <div style={{
              background: "linear-gradient(135deg, #051829 0%, #0a2d4a 60%, #0d4a6e 100%)",
              padding: "20px 24px 16px", flexShrink: 0,
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{
                    width: 42, height: 42, borderRadius: 11,
                    background: "rgba(201,168,76,0.18)", border: "1.5px solid rgba(201,168,76,0.4)",
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
                  }}>✏️</div>
                  <div>
                    <div style={{ color: "#c9a84c", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 2 }}>
                      Availability
                    </div>
                    <div style={{ color: "#fff", fontSize: 16, fontWeight: 700, lineHeight: 1.2 }}>
                      Edit Slots
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setShowEditSlotsModal(false)}
                  style={{
                    background: "rgba(255,255,255,0.1)", border: "none", borderRadius: "50%",
                    width: 32, height: 32, color: "#fff", fontSize: 16, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >✕</button>
              </div>
              {currentDay && (
                <div style={{
                  marginTop: 12, display: "inline-flex", alignItems: "center", gap: 6,
                  background: "rgba(201,168,76,0.15)", border: "1px solid rgba(201,168,76,0.3)",
                  borderRadius: 20, padding: "4px 12px",
                }}>
                  <span style={{ fontSize: 12 }}>📅</span>
                  <span style={{ color: "#e8d5a0", fontSize: 12, fontWeight: 600 }}>
                    {currentDay.day}, {currentDay.date}
                  </span>
                </div>
              )}
            </div>

            {/* Action bar — icon-only buttons, 1s hover tooltip via CSS */}
            {(() => {
              const btnBase = {
                width: 34, height: 34, borderRadius: 9, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 16, flexShrink: 0, position: "relative",
              };
              return (
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "flex-start", gap: 6, padding: "9px 16px",
                  borderBottom: "1px solid #f1f5f9", flexShrink: 0,
                }}>
                  <button onClick={() => handleAddEditedSlot(null)} data-tt="Add Slot"
                    style={{ ...btnBase, border: "1.5px solid #22c55e", background: "rgba(34,197,94,0.09)", color: "#15803d", fontSize: 18, fontWeight: 700 }}>+</button>
                  <button onClick={() => setIsGlobalEdit((v) => !v)} data-tt={isGlobalEdit ? "Exit Edit All" : "Edit All Slots"}
                    style={{ ...btnBase, border: `1.5px solid ${isGlobalEdit ? "#c9a84c" : "#94a3b8"}`, background: isGlobalEdit ? "rgba(201,168,76,0.15)" : "#f8fafc", color: isGlobalEdit ? "#92640a" : "#475569" }}>✏️</button>
                  <button onClick={handleResetDayUI} data-tt="Reset to defaults"
                    style={{ ...btnBase, border: "1.5px solid #94a3b8", background: "#f8fafc", color: "#475569" }}>🔄</button>
                  <button onClick={handleDeleteAllUI} data-tt="Stop Sale"
                    style={{ ...btnBase, border: "1.5px solid #ef4444", background: "rgba(239,68,68,0.07)", color: "#dc2626" }}>⛔</button>
                </div>
              );
            })()}

            {/* Slot list — Prime Shot first, then regular */}
            <div style={{ overflowY: "auto", flex: 1, padding: "6px 12px 10px" }}>
              {editedDaySlots.length === 0 && (
                <div style={{ textAlign: "center", color: "#94a3b8", padding: "32px 0", fontSize: 14 }}>
                  No slots — tap + to begin
                </div>
              )}
              {(() => {
                const withIdx = editedDaySlots.map((s, i) => ({ ...s, _origIdx: i }));
                const primeSlots = withIdx.filter((s) => s.isPrime);
                const regularSlots = withIdx.filter((s) => !s.isPrime);

                const selStyle = {
                  height: 34, padding: "0 8px", border: "1.5px solid #d1d5db", borderRadius: 8,
                  fontSize: 13, fontWeight: 600, color: "#051829", background: "#fff",
                  outline: "none", cursor: "pointer", flexShrink: 0, minWidth: 110,
                };
                const iconBtn = (extra) => ({
                  width: 26, height: 26, borderRadius: 6, flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 12, cursor: "pointer", ...extra,
                });

                const renderSlotRow = (slot, origIdx) => {
                  const isBooked = slot.status === "booked";
                  const isLocked = slot.status === "locked";
                  const inEditMode = !isBooked && !isLocked && (isGlobalEdit || slot.isEditing);

                  const rowBg = isBooked ? "linear-gradient(90deg,#fff1f2,#fff5f5)"
                    : isLocked ? "linear-gradient(90deg,#fffbeb,#fefce8)"
                      : inEditMode ? "linear-gradient(90deg,#eff6ff,#f0fdf4)"
                        : "linear-gradient(90deg,#f8fafc,#f0fdf4)";
                  const rowBorder = isBooked ? "#fecdd3" : isLocked ? "#fde68a"
                    : inEditMode ? "#93c5fd" : "#bbf7d0";

                  const startOpts = generateStartOpts(slot.start, editedDaySlots, origIdx, yacht);
                  const endOpts = generateEndOpts(slot.start, yacht);

                  return (
                    <div key={`slot-${origIdx}`} style={{
                      display: "flex", alignItems: "center", gap: 5,
                      background: rowBg, border: `1px solid ${rowBorder}`,
                      borderRadius: 9, padding: "5px 8px", marginBottom: 4,
                    }}>
                      {/* Status icon */}
                      {isBooked && <span style={{ fontSize: 12, flexShrink: 0 }}>🔴</span>}
                      {isLocked && <span style={{ fontSize: 12, flexShrink: 0 }}>🔒</span>}

                      {/* Content */}
                      {isBooked ? (
                        <>
                          <span style={{ flex: 1, fontSize: 12.5, fontWeight: 700, color: "#be123c" }}>
                            {to12HourFormat(slot.start)} — {to12HourFormat(slot.end)}
                          </span>
                          <span style={{
                            fontSize: 9.5, fontWeight: 700, color: "#be123c",
                            background: "rgba(239,68,68,0.1)", border: "1px solid #fecdd3",
                            borderRadius: 20, padding: "2px 7px", flexShrink: 0,
                          }}>BOOKED</span>
                        </>
                      ) : isLocked ? (
                        <span style={{ flex: 1, fontSize: 12.5, fontWeight: 700, color: "#92400e" }}>
                          {to12HourFormat(slot.start)} — {to12HourFormat(slot.end)}
                        </span>
                      ) : inEditMode ? (
                        <>
                          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                            <select value={slot.start} style={selStyle}
                              onChange={(e) => handleEditedSlotChange(origIdx, "start", e.target.value)}>
                              {startOpts.map((t) => <option key={t} value={t}>{to12HourFormat(t)}</option>)}
                            </select>
                            <span style={{ color: "#94a3b8", fontSize: 12, flexShrink: 0 }}>—</span>
                            <select value={slot.end} style={selStyle}
                              onChange={(e) => handleEditedSlotChange(origIdx, "end", e.target.value)}>
                              {endOpts.map((t) => <option key={t} value={t}>{to12HourFormat(t)}</option>)}
                            </select>
                          </div>
                          <button onClick={() => handleRemoveEditedSlot(origIdx)} data-tt="Remove slot"
                            style={iconBtn({ border: "1.5px solid #fecdd3", background: "rgba(239,68,68,0.06)", color: "#dc2626" })}>🗑</button>
                        </>
                      ) : (
                        <>
                          <span style={{ fontSize: 17, flexShrink: 0, color: "#94a3b8", lineHeight: 1 }}>🕐</span>
                          <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600, color: "#051829", textAlign: "center" }}>
                            {to12HourFormat(slot.start)} — {to12HourFormat(slot.end)}
                          </span>
                          <button onClick={() => handleRemoveEditedSlot(origIdx)} data-tt="Remove slot"
                            style={iconBtn({ border: "1.5px solid #fecdd3", background: "rgba(239,68,68,0.06)", color: "#dc2626" })}>🗑</button>
                        </>
                      )}
                    </div>
                  );
                };

                const renderSectionHeader = (icon, label, count, accent) => (
                  <div key={`hdr-${label}`} style={{
                    display: "flex", alignItems: "center", gap: 7,
                    margin: "5px 0 4px", padding: "4px 9px",
                    background: `linear-gradient(90deg,${accent}22,${accent}08)`,
                    borderRadius: 7, borderLeft: `3px solid ${accent}`,
                  }}>
                    <span style={{ fontSize: 13 }}>{icon}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: accent, letterSpacing: "0.06em", textTransform: "uppercase" }}>{label}</span>
                    <span style={{ fontSize: 10, color: "#64748b", marginLeft: "auto" }}>{count} slot{count !== 1 ? "s" : ""}</span>
                  </div>
                );

                return (
                  <>
                    {primeSlots.length > 0 && (
                      <>
                        {renderSectionHeader("🌅", "Prime Shot", primeSlots.length, "#c9a84c")}
                        {primeSlots.map((s) => renderSlotRow(s, s._origIdx))}
                      </>
                    )}
                    {regularSlots.length > 0 && (
                      <>
                        {primeSlots.length > 0 && renderSectionHeader("⚓", "Regular Slots", regularSlots.length, "#0d4a6e")}
                        {regularSlots.map((s) => renderSlotRow(s, s._origIdx))}
                      </>
                    )}
                  </>
                );
              })()}
            </div>

            {/* Footer */}
            {(() => {
              const hasChanges = initialDaySlotsRef.current !== null &&
                JSON.stringify(editedDaySlots.map(({ start, end }) => ({ start, end }))) !==
                JSON.stringify(initialDaySlotsRef.current);
              const saveDisabled = isSavingDaySlots || !hasChanges;
              return (
                <div style={{
                  display: "flex", gap: 10, padding: "12px 16px 16px",
                  borderTop: "1px solid #f1f5f9", flexShrink: 0,
                }}>
                  <button onClick={() => setShowEditSlotsModal(false)} disabled={isSavingDaySlots}
                    style={{
                      flex: 1, padding: "10px 0", borderRadius: 11,
                      border: "1.5px solid #e2e8f0", background: "#fff",
                      color: "#475569", fontSize: 13.5, fontWeight: 600,
                      cursor: isSavingDaySlots ? "not-allowed" : "pointer",
                    }}>Cancel</button>
                  <button onClick={handleSaveEditedDaySlots} disabled={saveDisabled}
                    style={{
                      flex: 2, padding: "10px 0", borderRadius: 11,
                      background: saveDisabled ? "#e2e8f0" : "linear-gradient(135deg,#c9a84c,#e0b850)",
                      border: "none", color: saveDisabled ? "#94a3b8" : "#051829",
                      fontSize: 13.5, fontWeight: 700,
                      cursor: saveDisabled ? "not-allowed" : "pointer",
                      boxShadow: saveDisabled ? "none" : "0 4px 14px rgba(201,168,76,0.32)",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                      transition: "all 0.2s",
                    }}>
                    {isSavingDaySlots ? (
                      <>
                        <span style={{ width: 13, height: 13, borderRadius: "50%", border: "2px solid rgba(5,24,41,0.3)", borderTopColor: "#051829", display: "inline-block", animation: "spin 0.7s linear infinite" }} />
                        Saving…
                      </>
                    ) : "💾 Save Changes"}
                  </button>
                </div>
              );
            })()}
          </div>
        </div>
      )}


      {/* Animations + 1-second delayed tooltip via CSS data-tt attribute */}
      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes spin { to { transform: rotate(360deg); } }
        [data-tt] { position: relative; }
        [data-tt]::after {
          content: attr(data-tt);
          position: absolute;
          bottom: calc(100% + 5px);
          left: 50%;
          transform: translateX(-50%);
          background: #1e293b;
          color: #fff;
          padding: 4px 8px;
          border-radius: 6px;
          font-size: 11px;
          white-space: nowrap;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.15s ease;
          transition-delay: 0s;
          z-index: 99999;
        }
        [data-tt]:hover::after {
          opacity: 1;
          transition-delay: 1s;
        }
      `}</style>
    </div >
  );
}

export default DayAvailability;
