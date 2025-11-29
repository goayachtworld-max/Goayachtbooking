import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import "bootstrap/dist/css/bootstrap.min.css";
import "./DayAvailability.css";
import { toast } from "react-hot-toast";

import {
  getDayAvailability,
  lockSlot,
  releaseSlot,
} from "../services/operations/availabilityAPI";
import { getYachtById } from "../services/operations/yautAPI";

function DayAvailability() {
  const location = useLocation();
  const navigate = useNavigate();
  let { yachtId, yachtName, day, requireDateSelection } = location.state || {};

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

  const token = localStorage.getItem("authToken");

  // Handle initial state based on whether date selection is required
  useEffect(() => {
    if (requireDateSelection) {
      // User clicked "Other" - no date selected yet
      setError("📅 Please select a date from the calendar to view available time slots");
      setSelectedDate(null);
      day = null;
    } else if (day) {
      // Convert string → object if needed
      if (typeof day === "string") {
        day = {
          date: day,
          day: new Date(day).toLocaleDateString("en-US", { weekday: "long" }),
        };
      }
      setSelectedDate(new Date(day.date));
      setError("");
    }
  }, [requireDateSelection]);

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
    const today = new Date().toISOString().split("T")[0];
    if (day.date !== today) return false;

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

    const specialStarts = specialMins
      .map(timeToMin)
      .sort((a, b) => a - b);

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

        const specialEnd = Math.min(hit.end, endMin);
        slots.push({ start: hit.start, end: specialEnd });

        cursor = specialEnd;
      } else {
        slots.push({
          start: cursor,
          end: Math.min(next, endMin),
        });
        cursor = next;
      }
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

  const buildTimeline = (yachtObj, booked = [], locked = []) => {
    const freeSlots = buildSlotsForYacht(yachtObj);

    const normalizedBusy = [
      ...booked.map((b) => ({
        start: b.startTime || b.start,
        end: b.endTime || b.end,
        type: "booked",
        custName: b.custName || b.customerName || "",
        empName: b.empName || b.employeeName || "",
      })),
      ...locked.map((l) => ({
        start: l.startTime || l.start,
        end: l.endTime || l.end,
        type: "locked",
        empName: l.empName || l.employeeName || "",
      })),
    ];

    return freeSlots.map((slot) => {
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

  // ---------- Fetch ----------
  const fetchTimeline = async () => {
    // Don't fetch if no date is selected
    if (!day || !day.date) {
      setTimeline([]);
      setLoading(false);
      setIsCalendarDisabled(false);
      return;
    }

    try {
      setLoading(true);
      setIsCalendarDisabled(true);
      setError("");

      const yachtRes = await getYachtById(yachtId, token);
      const yachtData = yachtRes?.data?.yacht ?? yachtRes?.yacht ?? yachtRes;
      setYacht(yachtData);
      console.log("Here is yaut data ", yachtData)
      const dayResRaw = await getDayAvailability(yachtId, day.date, token);
      const dayRes = dayResRaw?.data ?? dayResRaw;

      if (yachtData) {
        const booked = dayRes.bookedSlots || [];
        const locked = dayRes.lockedSlots || [];
        setTimeline(buildTimeline(yachtData, booked, locked));
      } else {
        setTimeline([]);
      }
    } catch (err) {
      setError("Failed to load timeline");
      setTimeline([]);
    } finally {
      setLoading(false);
      setIsCalendarDisabled(false);
    }
  };

  useEffect(() => {
    if (day && day.date) {
      fetchTimeline();
    }
  }, [yachtId, day?.date]);

  // ---------- Slot Interactions ----------
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
        day.date,
        selectedSlot.start,
        selectedSlot.end,
        token
      );

      if (res?.success) {
        toast.success("Slot locked successfully!");
        window.bootstrap.Modal.getInstance(
          document.getElementById("lockModal")
        )?.hide();
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
        day.date,
        selectedSlot.start,
        selectedSlot.end,
        token
      );

      if (res?.success) {
        toast.success("Slot released successfully!");
        window.bootstrap.Modal.getInstance(
          document.getElementById("confirmModal")
        )?.hide();
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

    window.bootstrap.Modal.getInstance(
      document.getElementById("confirmModal")
    )?.hide();

    navigate("/create-booking", {
      state: {
        yachtId,
        yachtName,
        yacht,
        date: day.date,
        startTime: selectedSlot.start,
        endTime: selectedSlot.end,
      },
    });

    setIsConfirming(false);
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
              {day && day.day ? `${day.day}, ${day.date}` : "Please select a date"}
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
              onChange={(selectedDate) => {
                if (isCalendarDisabled) return;

                const year = selectedDate.getFullYear();
                const month = String(selectedDate.getMonth() + 1).padStart(2, "0");
                const date = String(selectedDate.getDate()).padStart(2, "0");
                const iso = `${year}-${month}-${date}`;

                const newDay = {
                  date: iso,
                  day: selectedDate.toLocaleDateString("en-US", {
                    weekday: "long",
                  }),
                };

                day = newDay;
                location.state.day = newDay;
                location.state.requireDateSelection = false;

                setSelectedDate(selectedDate);
                setError("");
                fetchTimeline();
              }}
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
            <h5 className="fw-semibold mb-3 text-center text-secondary">
              🕒 Available Time Slots
            </h5>

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
                      disabled && slot.type !== "booked"
                        ? "not-allowed"
                        : "pointer";

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
                        {to12HourFormat(slot.start)} —{" "}
                        {to12HourFormat(slot.end)}
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
                    <div className="mt-2 fs-6">
                      Locked by: {selectedSlot.empName}
                    </div>
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
                    <div className="mt-1 fw-bold text-secondary">
                      Handled by: {selectedSlot.empName}
                    </div>
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

      {/* Add fadeIn animation */}
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}

export default DayAvailability;
