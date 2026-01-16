import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import { toast } from "react-hot-toast";
import styles from "./GridAvailability.module.css";

import {
  getAllYachtsDetailsAPI,
  getYachtById,
  updateDaySlots,
} from "../services/operations/yautAPI";

import {
  getDayAvailability,
  lockSlot,
  releaseSlot,
} from "../services/operations/availabilityAPI";
import { adjustSlots } from "../utils/slotEngine";

/* helpers */
const todayISO = () => new Date().toISOString().split("T")[0];

const plusDaysISO = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
};

const hhmmToMinutes = (t = "00:00") => {
  if (!t) return 0;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

const minutesToHHMM = (m) => {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
};

const to12HourFormat = (time24) => {
  if (!time24) return "";
  let [hour, minute] = time24.split(":").map(Number);
  hour = hour % 24;
  const period = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${String(minute).padStart(2, "0")} `;
};

const getDatesBetween = (start, end) => {
  const dates = [];
  let cur = new Date(start);
  const last = new Date(end);
  while (cur <= last) {
    dates.push(cur.toISOString().split("T")[0]);
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
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

  // duration
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

  if (endMin <= startMin) endMin += 1440;

  // -----------------------------
  // SPECIAL SLOT COLLECTION
  // -----------------------------
  const specialMins = [];

  if (yachtObj.specialSlotTime)
    specialMins.push(yachtObj.specialSlotTime);

  if (Array.isArray(yachtObj.specialSlotTimes))
    specialMins.push(...yachtObj.specialSlotTimes);

  if (Array.isArray(yachtObj.specialSlots))
    specialMins.push(...yachtObj.specialSlots);

  const specialStarts = specialMins
    .map(timeToMin)
    .filter(Boolean)
    .sort((a, b) => a - b);

  // -----------------------------
  // PROCESS SPECIAL SLOTS
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
        last.end = block.start;
        merged.push(block);
      }
    }

    return merged;
  };

  const processedSpecials = buildProcessedSpecialSlots(
    specialStarts,
    duration
  );

  // -----------------------------
  // BUILD FINAL SLOTS
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
      slots.push({ start: hit.start, end: hit.end });
      cursor = hit.end;
      continue;
    }

    if (next > endMin) {
      slots.push({ start: cursor, end: next });
      break;
    }

    slots.push({ start: cursor, end: next });
    cursor = next;
  }

  // add specials outside sail window
  processedSpecials.forEach((sp) => slots.push(sp));

  // dedupe + sort
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

function GridAvailability() {
  const employee = JSON.parse(localStorage.getItem("user") || "{}");
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  console.log("Logged user:", employee);

  const isAdminOrOnsite =
    employee.type === "admin" || employee.type === "onsite";

  const isOwner = (slot) =>
    slot.appliedBy && slot.appliedBy === employee._id;

  const navigate = useNavigate();
  const location = useLocation();
  const token = localStorage.getItem("authToken");
  const params = new URLSearchParams(location.search);

  const [yachtId, setYachtId] = useState(params.get("yachtId") || "");
  const [fromDate, setFromDate] = useState(
    params.get("fromDate") || todayISO()
  );
  const [toDate, setToDate] = useState(params.get("toDate") || plusDaysISO(6));

  const [yachts, setYachts] = useState([]);
  const [yacht, setYacht] = useState(null);
  const [dates, setDates] = useState([]);
  const [grid, setGrid] = useState([]); // [{date, slots: [{start,end,type,custName,empName}]}]
  const [loading, setLoading] = useState(false);

  const [selectedSlot, setSelectedSlot] = useState(null);
  const [modalType, setModalType] = useState("");
  const [isLocking, setIsLocking] = useState(false);
  const [isReleasing, setIsReleasing] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  const [editStart, setEditStart] = useState(null);
  const [editEnd, setEditEnd] = useState(null);

  const [timelineRange, setTimelineRange] = useState({
    start: 0,
    end: 0,
    total: 1,
  });

  useEffect(() => {
    if (selectedSlot) {
      setEditStart(selectedSlot.start);
      setEditEnd(selectedSlot.end);
    }
  }, [selectedSlot]);

  const canEditSlot = selectedSlot?.type === "free";

  const [selectedDate, setSelectedDate] = useState(null);
  const [daySlots, setDaySlots] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);



  useEffect(() => {
    (async () => {
      try {
        const res = await getAllYachtsDetailsAPI(token);
        const yachtList =
          res?.data?.yachts || res?.yachts || res?.data || [];
        setYachts(Array.isArray(yachtList) ? yachtList : []);

        console.log("Here are yatchs : ", yachtList)
      } catch {
        toast.error("Failed to load yachts");
      }
    })();
  }, [token]);

  useEffect(() => {
    if (!yachtId && yachts.length > 0) {
      setYachtId(yachts[0]._id);
    }
  }, [yachts, yachtId]);

  const loadGrid = async () => {
    if (!yachtId || !fromDate || !toDate) return;

    try {
      setLoading(true);

      // 🔹 yacht details (unchanged)
      const yachtRes = await getYachtById(yachtId, token);
      const yachtData = yachtRes?.data?.yacht ?? yachtRes;
      setYacht(yachtData);

      const dateList = getDatesBetween(fromDate, toDate);
      setDates(dateList);

      const rows = [];
      let globalMin = Infinity;
      let globalMax = -Infinity;

      for (const date of dateList) {
        // 🔹 day availability (unchanged)
        const res = await getDayAvailability(yachtId, date, token);
        const day = res?.data || res || {};

        const booked = day.bookedSlots || [];
        const locked = day.lockedSlots || [];

        // 🔹 base slots (unchanged)
        let baseSlots = [];
        if (
          Array.isArray(day.slots) &&
          day.slots.length > 0 &&
          Array.isArray(day.slots[0].slots)
        ) {
          baseSlots = day.slots[0].slots.map((s) => ({
            start: s.start,
            end: s.end,
          }));
        } else {
          baseSlots = buildSlotsForYacht(yachtData);
        }

        // 🔹 compute timeline range
        baseSlots.forEach((s) => {
          const sMin = hhmmToMinutes(s.start);
          const eMin = hhmmToMinutes(s.end);
          if (sMin < globalMin) globalMin = sMin;
          if (eMin > globalMax) globalMax = eMin;
        });

        // 🔹 enrich slots (unchanged)
        const enriched = baseSlots.map((slot) => {
          const bookedOverlap = booked.find(
            (b) =>
              hhmmToMinutes(b.startTime || b.start) <
              hhmmToMinutes(slot.end) &&
              hhmmToMinutes(b.endTime || b.end) >
              hhmmToMinutes(slot.start)
          );

          if (bookedOverlap) {
            return {
              ...slot,
              date,
              type:
                bookedOverlap.status === "pending"
                  ? "pending"
                  : "booked",
              custName:
                bookedOverlap.custName ||
                bookedOverlap.customerName ||
                "",
              empName:
                bookedOverlap.empName ||
                bookedOverlap.employeeName ||
                "",
              appliedBy: bookedOverlap.appliedBy || null,
            };
          }

          const lockedOverlap = locked.find(
            (l) =>
              hhmmToMinutes(l.startTime || l.start) <
              hhmmToMinutes(slot.end) &&
              hhmmToMinutes(l.endTime || l.end) >
              hhmmToMinutes(slot.start)
          );

          if (lockedOverlap) {
            return {
              ...slot,
              date,
              type: "locked",
              empName:
                lockedOverlap.empName ||
                lockedOverlap.employeeName ||
                "",
              appliedBy: lockedOverlap.appliedBy || null,
            };
          }

          return { ...slot, date, type: "free" };
        });

        rows.push({ date, slots: enriched });
      }

      // 🔹 fallback timeline range
      if (!isFinite(globalMin) || !isFinite(globalMax)) {
        if (yachtData?.sailStartTime && yachtData?.sailEndTime) {
          globalMin = hhmmToMinutes(yachtData.sailStartTime);
          globalMax = hhmmToMinutes(yachtData.sailEndTime);
          if (globalMax <= globalMin) globalMax += 1440;
        } else {
          globalMin = hhmmToMinutes("06:00");
          globalMax = hhmmToMinutes("22:00");
        }
      }

      // 🔹 REQUIRED for renderTimelineRow
      setTimelineRange({
        start: globalMin,
        end: globalMax,
        total: globalMax - globalMin || 1,
      });

      setGrid(rows);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load grid");
    } finally {
      setLoading(false);
    }
  };

  const updateGridSlot = (date, start, end, patch) => {
    setGrid((prev) =>
      prev.map((row) =>
        row.date !== date
          ? row
          : {
            ...row,
            slots: row.slots.map((slot) =>
              slot.start === start && slot.end === end
                ? { ...slot, ...patch }
                : slot
            ),
          }
      )
    );
  };

  // 🔹 reload only ONE day (not full calendar)
  const reloadSingleDay = async (date) => {
    const res = await getDayAvailability(yachtId, date, token);
    const day = res?.data || res;

    let baseSlots = [];

    if (
      Array.isArray(day.slots) &&
      day.slots.length > 0 &&
      Array.isArray(day.slots[0].slots)
    ) {
      baseSlots = day.slots[0].slots.map((s) => ({
        start: s.start,
        end: s.end,
      }));
    } else {
      baseSlots = buildSlotsForYacht(yacht);
    }

    const booked = day.bookedSlots || [];
    const locked = day.lockedSlots || [];

    const enriched = baseSlots.map((slot) => {
      const bookedOverlap = booked.find(
        (b) =>
          hhmmToMinutes(b.startTime || b.start) <
          hhmmToMinutes(slot.end) &&
          hhmmToMinutes(b.endTime || b.end) >
          hhmmToMinutes(slot.start)
      );

      if (bookedOverlap) {
        return {
          ...slot,
          date,
          type:
            bookedOverlap.status === "pending"
              ? "pending"
              : "booked",
          custName: bookedOverlap.custName || "",
          empName: bookedOverlap.empName || "",
          appliedBy: bookedOverlap.appliedBy || null,
        };
      }

      const lockedOverlap = locked.find(
        (l) =>
          hhmmToMinutes(l.startTime || l.start) <
          hhmmToMinutes(slot.end) &&
          hhmmToMinutes(l.endTime || l.end) >
          hhmmToMinutes(slot.start)
      );

      if (lockedOverlap) {
        return {
          ...slot,
          date,
          type: "locked",
          empName: lockedOverlap.empName || "",
          appliedBy: lockedOverlap.appliedBy || null
        };
      }

      return { ...slot, date, type: "free" };
    });

    setGrid((prev) =>
      prev.map((row) =>
        row.date === date ? { ...row, slots: enriched } : row
      )
    );
  };

  useEffect(() => {
    if (yachtId && fromDate && toDate) {
      loadGrid();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yachtId, fromDate, toDate]);

  const isPastSlot = (slot, slotDate) => {
    const today = new Date().toISOString().split("T")[0];
    if (slotDate !== today) return false;
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const slotEnd = hhmmToMinutes(slot.end);
    return slotEnd <= currentMinutes;
  };

  const handleSlotClick = (slot, type) => {
    setSelectedSlot(slot);
    setModalType(type);

    // 🔥 FIND DAY ROW
    const dayRow = grid.find((r) => r.date === slot.date);
    if (!dayRow) return;

    // 🔥 FIND SLOT INDEX
    const index = dayRow.slots.findIndex(
      (s) => s.start === slot.start && s.end === slot.end
    );

    setSelectedDate(slot.date);
    setDaySlots(dayRow.slots);
    setSelectedIndex(index);

    setTimeout(() => {
      const modalId =
        type === "booked" || type === "pending"
          ? "bookedModal"
          : type === "locked"
            ? "confirmModal"
            : "lockModal";

      const el = document.getElementById(modalId);
      if (el) new window.bootstrap.Modal(el).show();
    }, 50);
  };
  const handleSaveAndLock = async (e) => {
    e.preventDefault();
    if (!selectedSlot || isLocking) return;

    setIsLocking(true);

    const start = editStart;
    const end = editEnd;

    // 🔥 OPTIMISTIC UI UPDATE
    updateGridSlot(selectedDate, selectedSlot.start, selectedSlot.end, {
      type: "locked",
      start,
      end,
      empName: "You",
    });

    try {
      const isEdited =
        start !== selectedSlot.start || end !== selectedSlot.end;

      if (isEdited) {
        const updatedSlots = adjustSlots({
          allSlots: daySlots,
          targetIndex: selectedIndex,
          newStart: start,
          newEnd: end,
          durationMinutes: hhmmToMinutes(yacht.duration),
        });

        await updateDaySlots(
          yachtId,
          selectedDate,
          updatedSlots.map(({ start, end }) => ({ start, end })),
          token
        );
      }

      await lockSlot(yachtId, selectedDate, start, end, token);

      // 🔄 revalidate ONLY this day
      await reloadSingleDay(selectedDate);

      toast.success("Slot locked successfully");

      window.bootstrap.Modal.getInstance(
        document.getElementById("lockModal")
      )?.hide();
    } catch (err) {
      toast.error("Failed to lock slot");
      await reloadSingleDay(selectedDate); // rollback
    } finally {
      setIsLocking(false);
    }
  };

  const handleReleaseLock = async () => {
    if (!selectedSlot || isReleasing) return;

    setIsReleasing(true);

    // 🔥 optimistic UI
    updateGridSlot(
      selectedSlot.date,
      selectedSlot.start,
      selectedSlot.end,
      { type: "free", empName: "" }
    );

    try {
      await releaseSlot(
        yachtId,
        selectedSlot.date,
        selectedSlot.start,
        selectedSlot.end,
        token
      );

      await reloadSingleDay(selectedSlot.date);

      toast.success("Slot released successfully");

      window.bootstrap.Modal.getInstance(
        document.getElementById("confirmModal")
      )?.hide();
    } catch {
      toast.error("Failed to release slot");
      await reloadSingleDay(selectedSlot.date);
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
        yachtName: yacht?.name,
        date: selectedSlot.date,
        startTime: selectedSlot.start,
        endTime: selectedSlot.end,
      },
    });

    setIsConfirming(false);
  };


  const renderTimelineRow = (row) => {
    
    return (
      <td className={styles.timelineCell}
        style={{
          position: "relative",
          height: "100%",
          width: "100%",
          minWidth: 600,
        }}
      >
        {row.slots.map((slot, idx) => {
          let startMin = hhmmToMinutes(slot.start);
          let endMin = hhmmToMinutes(slot.end);

          if (endMin <= startMin) endMin += 1440;

          startMin -= timelineRange.start;
          endMin -= timelineRange.start;

          const left = (startMin / timelineRange.total) * 100;
          const width = ((endMin - startMin) / timelineRange.total) * 100;

          const past = isPastSlot(slot, row.date);

          // 🔐 ACCESS CONTROL (same as renderRowCells)
          const unauthorized =
            !isAdminOrOnsite &&
            (slot.type === "locked" ||
              slot.type === "booked" ||
              slot.type === "pending") &&
            !isOwner(slot);


          return (
            <div
              key={idx}
              className={[
                styles.slot,
                styles[slot.type],   // free | booked | locked | pending
                past ? styles.past : ""
              ].join(" ")}
              style={{
                position: "absolute",
                left: `${left}%`,
                width: `${width}%`,
                height: `{100%}`,
                cursor: past || unauthorized ? "not-allowed" : "pointer",
              }}
              onClick={() => {
                if (past || unauthorized) return; // 🚫 BLOCK ACCESS
                const typeToOpen =
                  slot.type === "pending" ? "booked" : slot.type;
                handleSlotClick(slot, typeToOpen);
              }}

              title={`${to12HourFormat(slot.start)} - ${to12HourFormat(slot.end)}`}
            >
              {to12HourFormat(slot.start)} – {to12HourFormat(slot.end)}
            </div>
          );
        })}
      </td>
    );
  };


  return (
    <div className="container-fluid py-4">
      <div className="mx-auto" style={{ maxWidth: "85vw" }}>

        <h4 className="fw-bold mb-4">Calendar View</h4>

        <div className="row g-3 mb-4">

          <div className="col-md-4">
            <select
              className="form-select"
              value={yachtId}
              onChange={(e) => setYachtId(e.target.value)}
            >
              {yachts.map((y) => (
                <option key={y._id} value={y._id}>
                  {y.name}
                </option>
              ))}
            </select>
          </div>

          <div className="col-md-3">
            <input
              type="date"
              className="form-control"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>

          <div className="col-md-3">
            <input
              type="date"
              className="form-control"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>

          <div className="col-md-2">
            <button className="btn btn-primary w-100" onClick={loadGrid}>
              View
            </button>
          </div>
        </div>
        {/* 
        {yacht!=null && (
          <div>
            <div>B2B Price : {yacht?.runningCost }</div>
            <div>B2C Price : {yacht?.sellingPrice }</div>
          </div>
        )} */}

        {yacht && (
          <div className="mb-3 d-flex gap-4 align-items-center">
            <div>
              <span className="text-muted me-1">B2B:</span>
              <span className="fw-semibold text-primary">
                ₹{Number(yacht.runningCost).toLocaleString("en-IN")}
              </span>
            </div>

            <div>
              <span className="text-muted me-1">B2C:</span>
              <span className="fw-semibold text-success">
                ₹{Number(yacht.sellingPrice).toLocaleString("en-IN")}
              </span>
            </div>
          </div>
        )}


        {loading ? (
          <div className="text-center py-5">Loading availability...</div>
        ) : grid.length > 0 ? (
          <div className={styles.wrapper}>
            <table className={`table ${styles.table} text-center align-middle`}>

              <thead className="table-light sticky-top">
                <tr>
                  <th className={styles.stickyCol}>Date</th>
                  <th>Timeline</th>
                </tr>
              </thead>


              <tbody>
                {grid.map((row, i) => (
                  <tr key={i}>
                    <td className={`${styles.stickyCol} fw-semibold`}>
                      {new Date(row.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                    </td>
                    {renderTimelineRow(row)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-muted text-center py-5">No availability found</div>
        )}

        <div className="modal fade" id="lockModal" tabIndex="-1">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content rounded-4">
              <form onSubmit={handleSaveAndLock}>
                {/* HEADER */}
                <div className="modal-header bg-warning ">
                  <h5 className="modal-title">Lock Time Slot</h5>
                  <button
                    type="button"
                    className="btn-close"
                    data-bs-dismiss="modal"
                  ></button>
                </div>

                {/* BODY */}
                <div className="modal-body text-center">
                  {selectedSlot && (
                    <>
                      {/* Current slot display */}
                      <p className="mb-3 fw-semibold">
                        {to12HourFormat(selectedSlot.start)} —{" "}
                        {to12HourFormat(selectedSlot.end)}
                      </p>

                      {/* Editable time fields */}
                      {user?.type == "admin" && (
                        <div className="text-start">
                          <label className="form-label">Start time</label>
                          <input
                            type="time"
                            className="form-control mb-2"
                            value={editStart || ""}
                            disabled={!canEditSlot}
                            onChange={(e) => setEditStart(e.target.value)}
                          />

                          <label className="form-label">End time</label>
                          <input
                            type="time"
                            className="form-control"
                            value={editEnd || ""}
                            disabled={!canEditSlot}
                            onChange={(e) => setEditEnd(e.target.value)}
                          />

                          {!canEditSlot && (
                            <div className="form-text text-muted mt-2">
                              This slot cannot be edited
                            </div>
                          )}
                        </div>)}

                    </>
                  )}
                </div>

                {/* FOOTER */}
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    data-bs-dismiss="modal"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-warning"
                    disabled={isLocking}
                  >
                    {isLocking ? "Locking..." : "Save & Lock"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>


        <div className="modal fade" id="confirmModal" tabIndex="-1">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content rounded-4">
              <form onSubmit={handleConfirmBooking}>
                <div className="modal-header bg-primary">
                  <h5 className="modal-title">Confirm Booking</h5>
                  <button
                    type="button"
                    className="btn-close"
                    data-bs-dismiss="modal"
                  ></button>
                </div>
                <div className="modal-body text-center">
                  {selectedSlot && (
                    <>
                      <div>
                        {to12HourFormat(selectedSlot.start)} —{" "}
                        {to12HourFormat(selectedSlot.end)}
                      </div>
                      <div className="mt-2">Locked by: {selectedSlot.empName}</div>
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
                    className="btn btn-primary"
                    disabled={isConfirming}
                  >
                    Confirm Booking
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>

        <div className="modal fade" id="bookedModal" tabIndex="-1">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content rounded-4">
              <div className="modal-header bg-danger">
                <h5 className="modal-title">Booked Slot Details</h5>
                <button
                  type="button"
                  className="btn-close"
                  data-bs-dismiss="modal"
                ></button>
              </div>
              <div className="modal-body text-center">
                {selectedSlot && (
                  <>
                    <div>
                      {to12HourFormat(selectedSlot.start)} —{" "}
                      {to12HourFormat(selectedSlot.end)}
                    </div>
                    <div className="mt-2">User Name: {selectedSlot.empName}</div>
                    <div className="mt-2">Booking Name: {selectedSlot.custName}</div>
                  </>
                )}
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  data-bs-dismiss="modal"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default GridAvailability;
