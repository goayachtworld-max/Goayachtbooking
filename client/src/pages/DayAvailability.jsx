import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
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

  // Admin edit-day modal state
  const [editedDaySlots, setEditedDaySlots] = useState([]);
  const [isSavingDaySlots, setIsSavingDaySlots] = useState(false);

  const token = localStorage.getItem("authToken");
  const user = JSON.parse(localStorage.getItem("user"));
  console.log("Here is user" , user)
  const userRole = user.type;
  const isAdmin = userRole === "admin";

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
    return (
      <div className="container mt-5 text-center">
        <p>⚠️ No yacht selected. Go back to the availability page.</p>
        <button
          className="btn btn-primary shadow-sm px-4"
          onClick={() => navigate(-1)}
        >
          ← Back
        </button>
      </div>
    );
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

  const to12HourFormat = (time24) => {
    if (!time24) return "";
    const [hour, minute] = time24.split(":").map(Number);
    const period = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 === 0 ? 12 : hour % 12;
    return `${hour12}:${minute.toString().padStart(2, "0")} ${period}`;
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
    const endMin = timeToMin(yachtObj.sailEndTime);

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

  // const buildTimeline = (yachtObj, booked = [], locked = []) => {
  //   const freeSlots = buildSlotsForYacht(yachtObj);

  //   const normalizedBusy = [
  //     ...booked.map((b) => ({
  //       start: b.startTime || b.start,
  //       end: b.endTime || b.end,
  //       type: "booked",
  //       custName: b.custName || b.customerName || "",
  //       empName: b.empName || b.employeeName || "",
  //     })),
  //     ...locked.map((l) => ({
  //       start: l.startTime || l.start,
  //       end: l.endTime || l.end,
  //       type: "locked",
  //       empName: l.empName || l.employeeName || "",
  //     })),
  //   ];

  //   return freeSlots.map((slot) => {
  //     const overlaps = normalizedBusy.filter(
  //       (b) =>
  //         !(
  //           hhmmToMinutes(b.end) <= hhmmToMinutes(slot.start) ||
  //           hhmmToMinutes(b.start) >= hhmmToMinutes(slot.end)
  //         )
  //     );

  //     if (overlaps.length === 0) return { ...slot, type: "free" };

  //     const bookedOverlap = overlaps.find((o) => o.type === "booked");
  //     if (bookedOverlap) {
  //       return {
  //         ...slot,
  //         type: "booked",
  //         custName: bookedOverlap.custName,
  //         empName: bookedOverlap.empName,
  //       };
  //     }

  //     const lockedOverlap = overlaps.find((o) => o.type === "locked");
  //     return {
  //       ...slot,
  //       type: "locked",
  //       empName: lockedOverlap.empName,
  //     };
  //   });
  // };

  // // ---------- Fetch ----------
  // const fetchTimeline = async () => {
  //   if (!currentDay || !currentDay.date) {
  //     setTimeline([]);
  //     setLoading(false);
  //     setIsCalendarDisabled(false);
  //     return;
  //   }

  //   try {
  //     setLoading(true);
  //     setIsCalendarDisabled(true);
  //     setError("");

  //     const yachtRes = await getYachtById(yachtId, token);
  //     const yachtData = yachtRes?.data?.yacht ?? yachtRes?.yacht ?? yachtRes;
  //     setYacht(yachtData);

  //     const dayResRaw = await getDayAvailability(yachtId, currentDay.date, token);
  //     const dayRes = dayResRaw?.data ?? dayResRaw;

  //     if (yachtData) {
  //       const booked = dayRes.bookedSlots || [];
  //       const locked = dayRes.lockedSlots || [];
  //       const built = buildTimeline(yachtData, booked, locked);
  //       setTimeline(built);
  //     } else {
  //       setTimeline([]);
  //     }
  //   } catch (err) {
  //     setError("Failed to load timeline");
  //     setTimeline([]);
  //   } finally {
  //     setLoading(false);
  //     setIsCalendarDisabled(false);
  //   }
  // };


  // ---------- Build timeline from stored DB slots or auto-generated slots ----------
  const buildTimeline = (baseSlots, booked = [], locked = []) => {
    const normalizedBusy = [
      ...booked.map((b) => ({
        start: b.startTime || b.start,
        end: b.endTime || b.end,
        type: "booked",
        custName: b.custName || "",
        empName: b.empName || "",
      })),
      ...locked.map((l) => ({
        start: l.startTime || l.start,
        end: l.endTime || l.end,
        type: "locked",
        empName: l.empName || "",
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
          custName: bookedOverlap.custName,
          empName: bookedOverlap.empName,
        };
      }

      const lockedOverlap = overlaps.find((o) => o.type === "locked");
      return {
        ...slot,
        type: "locked",
        empName: lockedOverlap.empName,
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
        dayRes?.slots && Array.isArray(dayRes.slots) && dayRes.slots.length > 0
          ? dayRes.slots[0] // slot document for that date
          : null;

      let finalBaseSlots = [];

      if (storedSlotEntry && storedSlotEntry.slots?.length > 0) {
        // 🟦 CASE A: Use stored slots from DB
        finalBaseSlots = storedSlotEntry.slots.map((s) => ({
          start: s.start,
          end: s.end,
        }));
      } else {
        // 🟧 CASE B: No stored slots → use auto generator
        finalBaseSlots = buildSlotsForYacht(yachtData);
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

    setTimeout(() => {
      let modalId = "";
      if (slot.type === "booked") modalId = "bookedModal";
      else if (slot.type === "locked") modalId = "confirmModal";
      else modalId = "lockModal";

      const el = document.getElementById(modalId);
      if (el) new window.bootstrap.Modal(el).show();
    }, 50);
  };

  const handleLockSlot = async (e) => {
    e.preventDefault();
    if (!selectedSlot || isLocking) return;

    setIsLocking(true);

    try {
      const res = await lockSlot(
        yachtId,
        currentDay.date,
        selectedSlot.start,
        selectedSlot.end,
        token
      );

      if (res?.success) {
        toast.success("Slot locked successfully!");
        window.bootstrap.Modal.getInstance(document.getElementById("lockModal"))?.hide();
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
      const res = await releaseSlot(
        yachtId,
        currentDay.date,
        selectedSlot.start,
        selectedSlot.end,
        token
      );

      if (res?.success) {
        toast.success("Slot released successfully!");
        window.bootstrap.Modal.getInstance(document.getElementById("confirmModal"))?.hide();
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

    window.bootstrap.Modal.getInstance(document.getElementById("confirmModal"))?.hide();

    navigate("/create-booking", {
      state: {
        yachtId,
        yachtName,
        yacht,
        date: currentDay.date,
        startTime: selectedSlot.start,
        endTime: selectedSlot.end,
      },
    });

    setIsConfirming(false);
  };

  // ---------- Edit-Day Modal logic (Replace ALL slots) ----------
  // Open edit modal and load current free slots into editedDaySlots
  const openEditDaySlotsModal = () => {
    if (!timeline || timeline.length === 0) {
      // If timeline is empty, we can try to build from yacht default
      const defaultSlots = yacht ? buildSlotsForYacht(yacht) : [];
      setEditedDaySlots(defaultSlots.map((s) => ({ ...s, status: "free" })));
    } else {
      // Load timeline free/locked/booked as editable base.
      // We will only allow editing "free" and "locked" slots (booked slots marked read-only)
      setEditedDaySlots(
        timeline.map((t) => ({
          start: t.start,
          end: t.end,
          status: t.type || "free", // 'free' | 'locked' | 'booked'
        }))
      );
    }

    setTimeout(() => {
      new window.bootstrap.Modal(document.getElementById("editDaySlotsModal")).show();
    }, 50);
  };

  const handleEditedSlotChange = (index, field, value) => {
    setEditedDaySlots((prev) => {
      const copy = prev.map((s) => ({ ...s }));
      copy[index][field] = value;
      return copy;
    });
  };

  const handleAddEditedSlot = (indexAfter = null) => {
    // default new slot: one hour after previous or 1-hour default
    setEditedDaySlots((prev) => {
      const copy = prev.map((s) => ({ ...s }));
      let newSlot = { start: "00:00", end: "01:00", status: "free" };

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
    if (!editedDaySlots || editedDaySlots.length === 0) {
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

    // Check for overlaps (including touching allowed? We allow touching: end === next.start)
    normalized.sort((a, b) => a.startMin - b.startMin);

    for (let i = 0; i < normalized.length - 1; i++) {
      const cur = normalized[i];
      const next = normalized[i + 1];
      // Overlap if cur.end > next.start
      if (cur.endMin > next.startMin) {
        toast.error("Slots must not overlap. Please fix the timings.");
        return false;
      }
    }

    // Optionally ensure slots fall inside yacht sail window
    // if (yacht && yacht.sailStartTime && yacht.sailEndTime) {
    //   const sailStart = hhmmToMinutes(yacht.sailStartTime);
    //   const sailEnd = hhmmToMinutes(yacht.sailEndTime);
    //   for (let sl of normalized) {
    //     if (sl.startMin < sailStart || sl.endMin > sailEnd) {
    //       toast.error(
    //         `Slots must be within yacht sail window ${yacht.sailStartTime} - ${yacht.sailEndTime}`
    //       );
    //       return false;
    //     }
    //   }
    // }

    return true;
  };

  const handleSaveEditedDaySlots = async () => {
    if (!currentDay || !currentDay.date) {
      toast.error("No date selected");
      return;
    }

    console.log("Edited slots - ", editedDaySlots);
    if (!validateEditedDaySlots()) return;
    setIsSavingDaySlots(true);

    try {
      // Build payload expected by backend: array of { start, end }
      const payloadSlots = editedDaySlots.map((s) => ({
        start: s.start,
        end: s.end
      }));

      console.log(payloadSlots)
      const res = await updateDaySlots(yachtId, currentDay.date, payloadSlots, token);
      console.log("Here is res - ", res)
      if (res?.success) {
        toast.success("Day slots updated successfully!");
        window.bootstrap.Modal.getInstance(
          document.getElementById("editDaySlotsModal")
        )?.hide();

        // Refresh timeline from server
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
          <button
            className="btn btn-outline-secondary shadow-sm back"
            onClick={() => navigate(-1)}
          >
            ← Back
          </button>

          <div className="text-center flex-grow-1">
            <h4 className="fw-bold text-primary mb-1">{yachtName}</h4>
            <h6 className="text-muted mb-0">
              {currentDay && currentDay.day
                ? `${currentDay.day}, ${currentDay.date}`
                : "Please select a date"}
            </h6>
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
            <div className="d-flex align-items-center justify-content-between mb-2">
              <h5 className="fw-semibold mb-0 text-secondary">
                🕒 Available Time Slots
              </h5>

              {isAdmin && (
                <button
                  className="btn btn-outline-primary btn-sm"
                  onClick={openEditDaySlotsModal}
                >
                  Edit
                </button>
              )}
            </div>

            {error ? (
              <div className="alert alert-warning text-center py-4 my-4" role="alert">
                <i className="bi bi-calendar-event fs-3 d-block mb-2"></i>
                <p className="mb-0 fs-5">{error}</p>
              </div>
            ) : timeline.length === 0 && !loading ? (
              <div className="text-center text-muted py-5">
                No available slots for this date.
              </div>
            ) : (
              <>
                <div className="slot-row-container gap-2">
                  {timeline.map((slot, idx) => {
                    const disabled = isPastSlot(slot);

                    const slotClass = disabled
                      ? slot.type === "booked"
                        ? "bg-danger text-white"
                        : "bg-secondary text-white opacity-50"
                      : slot.type === "booked"
                        ? "bg-danger text-white"
                        : slot.type === "locked"
                          ? "bg-warning text-dark"
                          : "bg-success text-white";

                    const cursorStyle =
                      disabled && slot.type !== "booked" ? "not-allowed" : "pointer";

                    return (
                      <div
                        key={idx}
                        className={`slot-btn px-3 py-2 rounded fw-semibold text-center ${slotClass}`}
                        style={{ cursor: cursorStyle }}
                        onClick={() => {
                          if (disabled && slot.type !== "booked") return;
                          handleSlotClick(slot);
                        }}
                      >
                        {to12HourFormat(slot.start)} — {to12HourFormat(slot.end)}
                      </div>
                    );
                  })}
                </div>

                {timeline.length > 0 && (
                  <div className="mt-4 text-center">
                    <span className="badge bg-success me-2">Free</span>
                    <span className="badge bg-warning text-dark me-2">Locked</span>
                    <span className="badge bg-danger me-2">Booked</span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Lock Modal */}
      <div className="modal fade" id="lockModal" tabIndex="-1" aria-hidden="true">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content rounded-4">
            <form onSubmit={handleLockSlot}>
              <div className="modal-header bg-warning bg-opacity-25">
                <h5 className="modal-title">Lock Time Slot</h5>
                <button type="button" className="btn-close" data-bs-dismiss="modal"></button>
              </div>
              <div className="modal-body text-center">
                {selectedSlot && (
                  <p className="fs-6">
                    Are you sure you want to lock this slot?
                    <br />
                    <strong>{to12HourFormat(selectedSlot.start)}</strong> —
                    <strong>{to12HourFormat(selectedSlot.end)}</strong>
                  </p>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline-secondary" data-bs-dismiss="modal">
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-warning text-dark fw-semibold"
                  disabled={isLocking}
                >
                  {isLocking ? "Locking..." : "Lock Slot"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Confirm Booking Modal */}
      <div className="modal fade" id="confirmModal" tabIndex="-1" aria-hidden="true">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content rounded-4">
            <form onSubmit={handleConfirmBooking}>
              <div className="modal-header bg-primary bg-opacity-10">
                <h5 className="modal-title">Confirm Booking</h5>
                <button type="button" className="btn-close" data-bs-dismiss="modal"></button>
              </div>

              <div className="modal-body text-center">
                {selectedSlot && (
                  <>
                    <div className="fs-6">
                      Locked slot: <strong>{to12HourFormat(selectedSlot.start)}</strong> —{" "}
                      <strong>{to12HourFormat(selectedSlot.end)}</strong>
                    </div>
                    <div className="mt-2 fs-6">Locked by: {selectedSlot.empName}</div>
                  </>
                )}
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-outline-danger"
                  onClick={handleReleaseLock}
                  disabled={isReleasing}
                >
                  {isReleasing ? "Releasing..." : "Release Lock"}
                </button>

                <button
                  type="submit"
                  className="btn btn-primary fw-semibold"
                  disabled={isConfirming}
                >
                  {isConfirming ? "Please wait..." : "Confirm Booking"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Booked Slot Modal */}
      <div className="modal fade" id="bookedModal" tabIndex="-1" aria-hidden="true">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content rounded-4">
            <div className="modal-header bg-danger bg-opacity-10">
              <h5 className="modal-title">Booked Slot Details</h5>
              <button type="button" className="btn-close" data-bs-dismiss="modal"></button>
            </div>

            <div className="modal-body text-center">
              {selectedSlot && (
                <>
                  <div className="fs-6">
                    Time: <strong>{to12HourFormat(selectedSlot.start)}</strong> —{" "}
                    <strong>{to12HourFormat(selectedSlot.end)}</strong>
                  </div>

                  {selectedSlot.custName && (
                    <div className="mt-2 fw-semibold text-primary">
                      Booked for: {selectedSlot.custName}
                    </div>
                  )}

                  {selectedSlot.empName && (
                    <div className="mt-1 fw-bold text-secondary">Handled by: {selectedSlot.empName}</div>
                  )}
                </>
              )}
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-outline-secondary" data-bs-dismiss="modal">
                Close
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Entire Day Slots Modal */}
      <div className="modal fade" id="editDaySlotsModal" tabIndex="-1" aria-hidden="true">
        <div className="modal-dialog modal-dialog-centered modal-lg">
          <div className="modal-content rounded-4">

            {/* Header */}
            <div className="modal-header bg-info bg-opacity-10">
              <h5 className="modal-title">
                Edit Slots for {currentDay?.day}, {currentDay?.date}
              </h5>
              <button type="button" className="btn-close" data-bs-dismiss="modal"></button>
            </div>

            {/* Body */}
            <div className="modal-body p-3" style={{ maxHeight: "70vh", overflowY: "auto" }}>

              <div className="d-flex justify-content-between align-items-center mb-3">
                <button
                  type="button"
                  className="btn btn-success btn-sm"
                  onClick={() => handleAddEditedSlot(null)}
                >
                  + Add Slot
                </button>

                <div className="text-muted small">Avoid overlaps when editing.</div>
              </div>

              {editedDaySlots.length === 0 && (
                <div className="text-center text-muted py-4">
                  No slots yet — add one to begin.
                </div>
              )}

              {/* List */}
              <div className="slot-list">
                {editedDaySlots.map((slot, index) => {
                  const isBooked = slot.status === "booked";

                  // Determine row color
                  let rowClass = "slot-row ";
                  if (slot.status === "free") rowClass += "slot-free";
                  else if (slot.status === "locked") rowClass += "slot-locked";
                  else if (slot.status === "booked") rowClass += "slot-booked";

                  return (
                    <div key={index} className={rowClass}>

                      {/* Time Fields */}
                      <input
                        type="time"
                        className="form-control form-control-sm time-input"
                        disabled={isBooked}
                        value={slot.start}
                        onChange={(e) =>
                          handleEditedSlotChange(index, "start", e.target.value)
                        }
                      />

                      <span className="time-separator">—</span>

                      <input
                        type="time"
                        className="form-control form-control-sm time-input"
                        disabled={isBooked}
                        value={slot.end}
                        onChange={(e) =>
                          handleEditedSlotChange(index, "end", e.target.value)
                        }
                      />

                      {/* Controls */}
                      <div className="slot-controls ms-auto">

                        {/* Up */}
                        <button
                          className="icon-btn"
                          disabled={index === 0}
                          onClick={() => handleMoveSlot(index, -1)}
                        >
                          ↑
                        </button>

                        {/* Down */}
                        <button
                          className="icon-btn"
                          disabled={index === editedDaySlots.length - 1}
                          onClick={() => handleMoveSlot(index, +1)}
                        >
                          ↓
                        </button>

                        {/* Delete */}
                        <button
                          className="icon-btn text-danger"
                          disabled={isBooked}
                          onClick={() => handleRemoveEditedSlot(index)}
                        >
                          🗑
                        </button>
                      </div>

                    </div>
                  );
                })}
              </div>

            </div>

            {/* Footer */}
            <div className="modal-footer">
              <button className="btn btn-secondary" data-bs-dismiss="modal" disabled={isSavingDaySlots}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSaveEditedDaySlots}
                disabled={isSavingDaySlots}
              >
                {isSavingDaySlots ? "Saving..." : "Save Changes"}
              </button>
            </div>

          </div>
        </div>
      </div>


      {/* Add fadeIn animation */}
      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
      `}</style>
    </div>
  );
}

export default DayAvailability;
