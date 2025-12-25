import React, { useEffect, useState, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import { toast } from "react-hot-toast";
import "./GridAvailability.css"

import {
  getAllYachtsDetailsAPI,
  getYachtById,
} from "../services/operations/yautAPI";

import {
  getDayAvailability,
  lockSlot,
  releaseSlot,
} from "../services/operations/availabilityAPI";

/* ---------------- HELPERS ---------------- */
const todayISO = () => new Date().toISOString().split("T")[0];

const plusDaysISO = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
};

const hhmmToMinutes = (t) => {
  if (!t) return 0;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

const to12HourFormat = (time24) => {
  if (!time24) return "";
  let [hour, minute] = time24.split(":").map(Number);
  hour = hour % 24;
  const period = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${String(minute).padStart(2, "0")} ${period}`;
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

/* -------- BUILD TIME SLOTS -------- */
const buildSlotsForYacht = (yacht) => {
  if (!yacht?.sailStartTime || !yacht?.sailEndTime) return [];

  const durationRaw = yacht.slotDurationMinutes || yacht.duration;
  const duration =
    typeof durationRaw === "string"
      ? hhmmToMinutes(durationRaw)
      : Number(durationRaw);

  const startMin = hhmmToMinutes(yacht.sailStartTime);
  let endMin = hhmmToMinutes(yacht.sailEndTime);
  if (endMin <= startMin) endMin += 1440;

  const slots = [];
  let cursor = startMin;

  while (cursor < endMin) {
    slots.push({
      start: `${String(Math.floor(cursor / 60)).padStart(2, "0")}:${String(
        cursor % 60
      ).padStart(2, "0")}`,
      end: `${String(Math.floor((cursor + duration) / 60)).padStart(
        2,
        "0"
      )}:${String((cursor + duration) % 60).padStart(2, "0")}`,
    });
    cursor += duration;
  }

  return slots;
};

/* ================= PAGE ================= */
function GridAvailability() {
  const navigate = useNavigate();
  const location = useLocation();
  const token = localStorage.getItem("authToken");
  const params = new URLSearchParams(location.search);
  const didAutoLoad = useRef(false);

  /* -------- FILTER STATE -------- */
  const [yachtId, setYachtId] = useState(params.get("yachtId") || "");
  const [fromDate, setFromDate] = useState(
    params.get("fromDate") || todayISO()
  );
  const [toDate, setToDate] = useState(
    params.get("toDate") || plusDaysISO(6)
  );

  /* -------- DATA STATE -------- */
  const [yachts, setYachts] = useState([]);
  const [yacht, setYacht] = useState(null);
  const [dates, setDates] = useState([]);
  const [slots, setSlots] = useState([]);
  const [grid, setGrid] = useState([]);
  const [loading, setLoading] = useState(false);

  /* -------- SLOT MODAL STATE -------- */
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [modalType, setModalType] = useState(""); // "lock" | "confirm" | "booked"
  const [isLocking, setIsLocking] = useState(false);
  const [isReleasing, setIsReleasing] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  /* -------- LOAD YACHTS -------- */
  useEffect(() => {
    (async () => {
      try {
        const res = await getAllYachtsDetailsAPI(token);
        const yachtList =
          res?.data?.yachts || res?.yachts || res?.data || [];
        setYachts(Array.isArray(yachtList) ? yachtList : []);
      } catch {
        toast.error("Failed to load yachts");
      }
    })();
  }, [token]);

  /* -------- AUTO SELECT FIRST YACHT -------- */
  useEffect(() => {
    if (!yachtId && yachts.length > 0) {
      setYachtId(yachts[0]._id);
    }
  }, [yachts, yachtId]);

  /* -------- SYNC FILTERS → URL -------- */
  useEffect(() => {
    const p = new URLSearchParams();
    if (yachtId) p.set("yachtId", yachtId);
    if (fromDate) p.set("fromDate", fromDate);
    if (toDate) p.set("toDate", toDate);
    navigate({ search: p.toString() }, { replace: true });
  }, [yachtId, fromDate, toDate]);

  /* -------- LOAD GRID -------- */
  const loadGrid = async () => {
    if (!yachtId || !fromDate || !toDate) return;

    try {
      setLoading(true);

      const yachtRes = await getYachtById(yachtId, token);
      const yachtData = yachtRes?.data?.yacht ?? yachtRes;
      setYacht(yachtData);

      const slotList = buildSlotsForYacht(yachtData);
      const dateList = getDatesBetween(fromDate, toDate);

      setSlots(slotList);
      setDates(dateList);

      const availabilityByDate = {};

      await Promise.all(
        dateList.map(async (date) => {
          const res = await getDayAvailability(yachtId, date, token);
          availabilityByDate[date] = res?.data || res || {};
        })
      );

      const gridRows = dateList.map((date) => {
        const day = availabilityByDate[date] || {};
        const booked = day.bookedSlots || [];
        const locked = day.lockedSlots || [];

        return {
          date,
          slots: slotList.map((slot) => {
            const isBooked = booked.some(
              (b) =>
                hhmmToMinutes(b.startTime || b.start) < hhmmToMinutes(slot.end) &&
                hhmmToMinutes(b.endTime || b.end) > hhmmToMinutes(slot.start)
            );

            if (isBooked)
              return { type: "booked", ...slot, date };

            const isLocked = locked.some(
              (l) =>
                hhmmToMinutes(l.startTime || l.start) < hhmmToMinutes(slot.end) &&
                hhmmToMinutes(l.endTime || l.end) > hhmmToMinutes(slot.start)
            );

            if (isLocked)
              return { type: "locked", ...slot, date };

            return { type: "free", ...slot, date };
          }),
        };
      });

      setGrid(gridRows);
    } catch {
      toast.error("Failed to load grid");
    } finally {
      setLoading(false);
    }
  };

  /* -------- AUTO LOAD ONCE DEFAULTS READY -------- */
  useEffect(() => {
    if (yachtId && fromDate && toDate) {
      loadGrid();
    }
  }, [yachtId, fromDate, toDate]);

  /* -------- SLOT HANDLERS -------- */
  const handleSlotClick = (slot, type) => {
    setSelectedSlot(slot);
    setModalType(type);

    setTimeout(() => {
      const modalId =
        type === "booked"
          ? "bookedModal"
          : type === "locked"
            ? "confirmModal"
            : "lockModal";

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
        selectedSlot.date,
        selectedSlot.start,
        selectedSlot.end,
        token
      );
      if (res?.success) {
        toast.success("Slot locked successfully!");
        window.bootstrap.Modal.getInstance(document.getElementById("lockModal"))?.hide();
        loadGrid();
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
        selectedSlot.date,
        selectedSlot.start,
        selectedSlot.end,
        token
      );
      if (res?.success) {
        toast.success("Slot released successfully!");
        window.bootstrap.Modal.getInstance(document.getElementById("confirmModal"))?.hide();
        loadGrid();
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
        yachtName: yacht?.name,
        date: selectedSlot.date,
        startTime: selectedSlot.start,
        endTime: selectedSlot.end,
      },
    });

    setIsConfirming(false);
  };

  /* ---------------- RENDER ---------------- */
  return (
    <div className="container py-4">
      <h4 className="fw-bold mb-4">🗓 Yacht Availability – Grid View</h4>

      {/* Filters */}
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

      {/* Grid */}
      {loading ? (
        <div className="text-center py-5">Loading availability...</div>
      ) : grid.length > 0 ? (
        <div className="table-responsive">
          <table className="table table-bordered text-center align-middle">
            <thead className="table-light sticky-top">
              <tr>
                <th>Date</th>
                {slots.map((s, i) => (
                  <th key={i}>
                    {to12HourFormat(s.start)} – {to12HourFormat(s.end)}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {grid.map((row, i) => (
                <tr key={i}>
                  <td className="fw-semibold">{row.date}</td>
                  {row.slots.map((cell, j) => (
                    <td
                      key={j}
                      className={
                        cell.type === "booked"
                          ? "bg-danger text-white"
                          : cell.type === "locked"
                            ? "bg-warning"
                            : "bg-success text-white"
                      }
                      onClick={() => handleSlotClick(cell, cell.type)}
                      style={{ cursor: "pointer" }}
                    >
                      {cell.type}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-muted text-center py-5">
          No availability found
        </div>
      )}

      {/* ------------------- MODALS ------------------- */}
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
                <button type="submit" className="btn btn-warning text-dark fw-semibold" disabled={isLocking}>
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
                      Locked slot: <strong>{to12HourFormat(selectedSlot.start)}</strong> —
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
                    Time: <strong>{to12HourFormat(selectedSlot.start)}</strong> —
                    <strong>{to12HourFormat(selectedSlot.end)}</strong>
                  </div>
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

    </div>
  );
}

export default GridAvailability;
