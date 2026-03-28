import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import { toast } from "react-hot-toast";
import styles from "./GridAvailability.module.css";

import {
  getAllYachtsDetailsAPI,
  updateDaySlots,
} from "../services/operations/yautAPI";

import {
  getDayAvailability,
  lockSlot,
  releaseSlot,
} from "../services/operations/availabilityAPI";
import { adjustSlots } from "../utils/slotEngine";
import { FiSliders } from "react-icons/fi";

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

  const isAdminOrOnsite =
    employee.type === "admin" || employee.type === "onsite";

  const isOwner = (slot) =>
    slot.appliedBy && slot.appliedBy === employee._id;

  const navigate = useNavigate();
  const location = useLocation();
  const token = localStorage.getItem("authToken");
  const params = new URLSearchParams(location.search);

  const [yachtId, setYachtId] = useState(params.get("yachtId") || "");
  const [yachtName, setYachtName] = useState("");
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
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const [showFilters, setShowFilters] = useState(!isMobile);

  // Searchable yacht combobox
  const [yachtSearch, setYachtSearch] = useState("");
  const [showYachtDropdown, setShowYachtDropdown] = useState(false);
  const [showMoreYachts, setShowMoreYachts] = useState(false);
  const yachtSearchRef = React.useRef(null);

  // Mobile yacht bottom sheet
  const [showYachtSheet, setShowYachtSheet] = useState(false);
  const [mobileYachtSearch, setMobileYachtSearch] = useState("");

  // ── Double-click support ──
  const clickTimerRef = useRef(null);
  const DBLCLICK_DELAY = 250; // ms

  // ── Lock countdown timer component ──
  const LockTimer = ({ deleteAfter }) => {
    const [remaining, setRemaining] = useState(null);

    useEffect(() => {
      if (!deleteAfter) return;
      const tick = () => {
        const diff = new Date(deleteAfter) - Date.now();
        setRemaining(diff > 0 ? diff : 0);
      };
      tick();
      const id = setInterval(tick, 1000);
      return () => clearInterval(id);
    }, [deleteAfter]);

    if (remaining === null || !deleteAfter) return null;
    if (remaining <= 0) return <span style={{ color: "#dc3545", fontSize: "10px", fontWeight: 600 }}>⏰ Expired</span>;

    const totalSec = Math.ceil(remaining / 1000);
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    const color = remaining < 60000 ? "#dc3545" : remaining < 180000 ? "#fd7e14" : "#6c757d";

    return (
      <span style={{ color, fontSize: "10px", fontWeight: 600, display: "block", lineHeight: 1.2 }}>
        ⏱ {mins}:{String(secs).padStart(2, "0")}
      </span>
    );
  };


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
  useEffect(() => {
    const selectedYacht = yachts.find((y) => y._id === yachtId);
    setYachtName(selectedYacht?.name || "");
  }, [yachtId, yachts]);

  const loadGrid = async () => {
    if (!yachtId || !fromDate || !toDate) return;

    try {
      setLoading(true);

      // 🔹 yacht details — use already-loaded list, avoid extra API call
      const yachtData = yachts.find((y) => y._id === yachtId) || null;
      setYacht(yachtData);

      const dateList = getDatesBetween(fromDate, toDate);
      setDates(dateList);

      const rows = [];
      let globalMin = Infinity;
      let globalMax = -Infinity;

      // 🔹 Fallback slots — built ONCE from yacht config.
      // Used only for dates that have no custom slots saved in the backend.
      // Dates WITH backend slots (day.slots) will use those instead — per-date custom slots are fully preserved.
      const defaultBaseSlots = buildSlotsForYacht(yachtData);

      // Pre-cache minutes for fallback slots
      const defaultBaseSlotsWithMins = defaultBaseSlots.map((s) => ({
        ...s,
        startMin: hhmmToMinutes(s.start),
        endMin: hhmmToMinutes(s.end),
      }));

      // 🔹 Compute timeline range from fallback slots (will be updated per-date if custom slots exist)
      defaultBaseSlotsWithMins.forEach(({ startMin, endMin }) => {
        if (startMin < globalMin) globalMin = startMin;
        if (endMin > globalMax) globalMax = endMin;
      });

      // ── FIX: Fetch all dates IN PARALLEL instead of sequentially ──
      const dayResults = await Promise.all(
        dateList.map((date) => getDayAvailability(yachtId, date, token))
      );

      dateList.forEach((date, dateIdx) => {
        const res = dayResults[dateIdx];
        const day = res?.data || res || {};

        const booked = day.bookedSlots || [];
        const locked = day.lockedSlots || [];

        // Use per-day custom slots if available, else use pre-built defaults
        let baseSlotsWithMins;
        if (
          Array.isArray(day.slots) &&
          day.slots.length > 0 &&
          Array.isArray(day.slots[0].slots)
        ) {
          baseSlotsWithMins = day.slots[0].slots.map((s) => ({
            start: s.start,
            end: s.end,
            startMin: hhmmToMinutes(s.start),
            endMin: hhmmToMinutes(s.end),
          }));
          // Update global range for custom slots
          baseSlotsWithMins.forEach(({ startMin, endMin }) => {
            if (startMin < globalMin) globalMin = startMin;
            if (endMin > globalMax) globalMax = endMin;
          });
        } else {
          baseSlotsWithMins = defaultBaseSlotsWithMins;
        }

        // Pre-cache booked/locked minute values once per day
        const bookedWithMins = booked.map((b) => ({
          ...b,
          startMin: hhmmToMinutes(b.startTime || b.start),
          endMin: hhmmToMinutes(b.endTime || b.end),
        }));
        const lockedWithMins = locked.map((l) => ({
          ...l,
          startMin: hhmmToMinutes(l.startTime || l.start),
          endMin: hhmmToMinutes(l.endTime || l.end),
        }));

        // 🔹 enrich slots using pre-cached minute values
        const enriched = baseSlotsWithMins.map((slot) => {
          const bookedOverlap = bookedWithMins.find(
            (b) => b.startMin < slot.endMin && b.endMin > slot.startMin
          );

          if (bookedOverlap) {
            return {
              start: slot.start,
              end: slot.end,
              date,
              type: bookedOverlap.status === "pending" ? "pending" : "booked",
              custName: bookedOverlap.custName || bookedOverlap.customerName || "",
              empName: bookedOverlap.empName || bookedOverlap.employeeName || "",
              appliedBy: bookedOverlap.appliedBy || null,
            };
          }

          const lockedOverlap = lockedWithMins.find(
            (l) => l.startMin < slot.endMin && l.endMin > slot.startMin
          );

          if (lockedOverlap) {
            return {
              start: slot.start,
              end: slot.end,
              date,
              type: "locked",
              empName: lockedOverlap.empName || lockedOverlap.employeeName || "",
              appliedBy: lockedOverlap.appliedBy || null,
              deleteAfter: lockedOverlap.deleteAfter || null,
            };
          }

          return { start: slot.start, end: slot.end, date, type: "free" };
        });

        rows.push({ date, slots: enriched });
      });

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
          appliedBy: lockedOverlap.appliedBy || null,
          deleteAfter: lockedOverlap.deleteAfter || null,
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

  // ── Quick-action: double-click handlers ──
  const handleSlotDoubleClick = async (slot) => {
    if (slot.type === "free") {
      // Double-click on free → lock instantly, then go straight to confirm booking
      updateGridSlot(slot.date, slot.start, slot.end, { type: "locked", empName: "You" });

      try {
        await lockSlot(yachtId, slot.date, slot.start, slot.end, token);
        // Lock succeeded — navigate straight to confirm booking
        navigate("/create-booking", {
          state: {
            yachtId,
            yachtName: yacht?.name,
            date: slot.date,
            startTime: slot.start,
            endTime: slot.end,
          },
        });
      } catch {
        toast.error("Failed to lock slot");
        await reloadSingleDay(slot.date);
      }
    } else if (slot.type === "locked") {
      // Double-click on locked → go straight to confirm booking
      navigate("/create-booking", {
        state: {
          yachtId,
          yachtName: yacht?.name,
          date: slot.date,
          startTime: slot.start,
          endTime: slot.end,
        },
      });
    } else if (slot.type === "booked" || slot.type === "pending") {
      // Double-click on booked → open detail modal
      handleSlotClick(slot, "booked");
    }
  };

  // Unified click dispatcher — distinguishes single vs double click
  const handleSlotInteraction = (slot, type) => {
    if (clickTimerRef.current) {
      // Second click within delay → double-click
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
      handleSlotDoubleClick(slot);
    } else {
      // First click — wait to see if second comes
      clickTimerRef.current = setTimeout(() => {
        clickTimerRef.current = null;
        handleSlotClick(slot, type); // single click → open modal
      }, DBLCLICK_DELAY);
    }
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
          overflow: "visible",
          zIndex: 1,
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
                height: `100%`,
                cursor: past || unauthorized ? "not-allowed" : "pointer",
              }}
              onClick={() => {
                if (past || unauthorized) return; // 🚫 BLOCK ACCESS
                const typeToOpen =
                  slot.type === "pending" ? "booked" : slot.type;
                handleSlotInteraction(slot, typeToOpen);
              }}

              title={
                `${to12HourFormat(slot.start)} - ${to12HourFormat(slot.end)}` +
                ((isAdminOrOnsite || slot.empName === employee.name)
                  ? slot.type === "locked"
                    ? ` | Locked by: ${slot.empName}`
                    : slot.type === "booked"
                      ? ` | Booked By ${slot.empName} for ${slot.custName}`
                      : ""
                  : "")
              }
            >
              <span style={{ display: "block" }}>{to12HourFormat(slot.start)}–{to12HourFormat(slot.end)}</span>
              {slot.type === "locked" && <LockTimer deleteAfter={slot.deleteAfter} />}
            </div>
          );
        })}
      </td>
    );
  };


  return (
    <div className="container-fluid py-1">
      <div className="mx-auto" style={{ maxWidth: "87vw" }}>

        {/* ── DESKTOP header + filters ── */}
        {!isMobile && (
          <>
          <div className={styles.stickyHeader}>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h3 className="fw-bold mb-0">Calendar View</h3>
              <button
                className={`btn btn-sm ${showFilters ? "btn-primary" : "btn-outline-primary"}`}
                onClick={() => setShowFilters((prev) => !prev)}
                title={showFilters ? "Hide filters" : "Show filters"}
              >
                <FiSliders size={18} className="me-1" />
                {showFilters ? "Hide" : "Filters"}
              </button>
            </div>

            {showFilters && (
              <div style={{ position: "relative", zIndex: 1050, marginBottom: "1.5rem", isolation: "isolate" }}>
              <div className="d-flex flex-wrap gap-3 align-items-end">
                <div style={{ flex: "0 0 260px", position: "relative" }}>
                  <label className="form-label small text-muted mb-1">⛵ Yacht</label>
                  <div className={styles.comboWrapper}>
                    <div className={styles.comboInput}>
                      <input
                        type="text"
                        className="form-control"
                        // placeholder="Search yacht..."
                        value={yachtSearch}
                        onChange={(e) => { setYachtSearch(e.target.value); setShowYachtDropdown(true); }}
                        onFocus={() => setShowYachtDropdown(true)}
                        onBlur={() => setTimeout(() => setShowYachtDropdown(false), 150)}
                      />
                      {!yachtSearch && yachtName && (
                        <span className={styles.comboSelected}>{yachtName}</span>
                      )}
                    </div>
                    {showYachtDropdown && (
                      <ul className={styles.comboDropdown}>
                        {yachts.filter((y) => y.name.toLowerCase().includes(yachtSearch.toLowerCase())).map((y) => (
                          <li
                            key={y._id}
                            className={`${styles.comboOption} ${y._id === yachtId ? styles.comboOptionActive : ""}`}
                            onMouseDown={() => { setYachtId(y._id); setYachtName(y.name); setYachtSearch(""); setShowYachtDropdown(false); }}
                          >
                            {y._id === yachtId && <span className={styles.comboCheck}>✓</span>}
                            {y.name}
                          </li>
                        ))}
                        {yachts.filter((y) => y.name.toLowerCase().includes(yachtSearch.toLowerCase())).length === 0 && (
                          <li className={styles.comboEmpty}>No yacht found</li>
                        )}
                      </ul>
                    )}
                  </div>
                </div>

                <div style={{ flex: "0 0 160px" }}>
                  <label className="form-label small text-muted mb-1">📅 From</label>
                  <input type="date" className="form-control" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
                </div>

                <div style={{ flex: "0 0 160px" }}>
                  <label className="form-label small text-muted mb-1">📅 To</label>
                  <input type="date" className="form-control" value={toDate} min={fromDate} onChange={(e) => setToDate(e.target.value)} />
                </div>
              </div>
              </div>
            )}
          </div>
          </>
        )}

        {/* ── MOBILE: one row — selected yacht + single filter button ── */}
        {isMobile && (
          <>
          <div className={styles.stickyHeader}>
            <div className={styles.mobileTopBar}>
              {/* Yacht chip — clickable, opens combined filter sheet */}
              <button
                className={styles.mobileYachtChip}
                onClick={() => { setMobileYachtSearch(""); setShowYachtSheet(true); }}
              >
                <span>⛵</span>
                <span className={styles.mobileYachtChipName}>{yachtName || "Select Yacht"}</span>
                <span className={styles.mobileYachtChipChevron}>▾</span>
              </button>

              {/* Filter button — also opens combined sheet */}
              <button
                className={`${styles.mobileFilterBtn} ${(fromDate !== todayISO() || toDate !== plusDaysISO(6)) ? styles.mobileFilterBtnActive : ""}`}
                onClick={() => { setMobileYachtSearch(""); setShowYachtSheet(true); }}
              >
                <FiSliders size={15} />
                <span>
                  {`${new Date(fromDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${new Date(toDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`}
                </span>
              </button>
            </div>

            {/* ── Combined filter sheet ── */}
            {showYachtSheet && (
              <div className={styles.sheetBackdrop} onClick={() => setShowYachtSheet(false)}>
                <div className={styles.yachtSheet} onClick={(e) => e.stopPropagation()}>
                  <div className={styles.sheetHandle} />
                  <div className={styles.sheetHeader}>
                    <span className={styles.sheetTitle}>Filters</span>
                    <button className={styles.sheetClose} onClick={() => setShowYachtSheet(false)}>✕</button>
                  </div>

                  {/* Date row — compact, inside sheet */}
                  <div className={styles.sheetDateRow}>
                    <div className={styles.sheetDateField}>
                      <label className={styles.dateSheetLabel}>From</label>
                      <input type="date" className={styles.dateSheetInput} value={fromDate} onChange={(e) => { setFromDate(e.target.value); setShowYachtSheet(false); }} />
                    </div>
                    <span className={styles.sheetDateArrow}>→</span>
                    <div className={styles.sheetDateField}>
                      <label className={styles.dateSheetLabel}>To</label>
                      <input type="date" className={styles.dateSheetInput} value={toDate} min={fromDate} onChange={(e) => { setToDate(e.target.value); setShowYachtSheet(false); }} />
                    </div>
                  </div>

                  {/* Divider + Yacht label */}
                  <div className={styles.sheetSectionLabel}>Yacht</div>

                  {/* Search */}
                  <div className={styles.sheetSearchWrap}>
                    <span className={styles.sheetSearchIcon}>🔍</span>
                    <input
                      type="text"
                      className={styles.sheetSearchInput}
                      placeholder="Search yacht..."
                      value={mobileYachtSearch}
                      onChange={(e) => setMobileYachtSearch(e.target.value)}
                    />
                    {mobileYachtSearch && (
                      <button className={styles.sheetSearchClear} onClick={() => setMobileYachtSearch("")}>✕</button>
                    )}
                  </div>

                  {/* Yacht list */}
                  <ul className={styles.sheetList}>
                    {yachts.filter((y) => y.name.toLowerCase().includes(mobileYachtSearch.toLowerCase())).map((y) => (
                      <li
                        key={y._id}
                        className={`${styles.sheetItem} ${y._id === yachtId ? styles.sheetItemActive : ""}`}
                        onClick={() => { setYachtId(y._id); setYachtName(y.name); setShowYachtSheet(false); }}
                      >
                        <span className={styles.sheetItemName}>{y.name}</span>
                        {y._id === yachtId && <span className={styles.sheetItemCheck}>✓</span>}
                      </li>
                    ))}
                    {yachts.filter((y) => y.name.toLowerCase().includes(mobileYachtSearch.toLowerCase())).length === 0 && (
                      <li className={styles.sheetEmpty}>No yacht found</li>
                    )}
                  </ul>

                  {/* Apply */}
                  <div className={styles.sheetFooter}>
                    <button className="btn btn-primary w-100 rounded-pill" onClick={() => setShowYachtSheet(false)}>
                      Apply
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
          </>
        )}
        <div className={`mb-2 d-flex justify-content-between align-items-center flex-wrap gap-2 ${isMobile ? styles.mobileInfoBar : ""}`}>
          {yacht && (
            <div className="d-flex gap-2 align-items-center">
              <span className={`badge bg-primary bg-opacity-10 text-primary px-2 py-1 rounded-pill fw-semibold ${isMobile ? styles.mobileInfoBadge : ""}`} style={{ fontSize: isMobile ? "11px" : "13px" }}>
                B2B: ₹{Number(yacht.runningCost).toLocaleString("en-IN")}
              </span>
              <span className={`badge bg-success bg-opacity-10 text-success px-2 py-1 rounded-pill fw-semibold ${isMobile ? styles.mobileInfoBadge : ""}`} style={{ fontSize: isMobile ? "11px" : "13px" }}>
                ₹{Number(yacht.sellingPrice).toLocaleString("en-IN")}
              </span>
            </div>
          )}
          <div className={styles.legend}>
            <span className={styles.legendItem}>
              <span className={`${styles.legendDot} ${styles.legendFree}`}></span> Free
            </span>
            <span className={styles.legendItem}>
              <span className={`${styles.legendDot} ${styles.legendPending}`}></span> Pending
            </span>
            <span className={styles.legendItem}>
              <span className={`${styles.legendDot} ${styles.legendLocked}`}></span> Locked
            </span>
            <span className={styles.legendItem}>
              <span className={`${styles.legendDot} ${styles.legendBooked}`}></span> Booked
            </span>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-5 text-muted">
            <div className="spinner-border spinner-border-sm me-2" role="status" />
            Loading availability...
          </div>
        ) : grid.length > 0 ? (
          <>

          {/* Mobile card view */}
          {isMobile ? (
            <div className={styles.mobileGrid}>
              {grid.map((row, i) => (
                <div key={i} className={styles.mobileDay}>
                  <div className={row.date === todayISO() ? styles.mobileDayHeaderToday : styles.mobileDayHeader}>
                    {new Date(row.date).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' })}
                    {row.date === todayISO() && <span className="ms-2" style={{ fontSize: "11px", fontWeight: 500 }}>Today</span>}
                  </div>
                  <div className={styles.mobileSlots}>
                    {row.slots.map((slot, idx) => {
                      const past = isPastSlot(slot, row.date);
                      const unauthorized =
                        !isAdminOrOnsite &&
                        (slot.type === "locked" || slot.type === "booked" || slot.type === "pending") &&
                        !isOwner(slot);
                      return (
                        <div
                          key={idx}
                          className={[
                            styles.mobileSlot,
                            styles[slot.type],
                            past ? styles.past : ""
                          ].join(" ")}
                          style={{ cursor: past || unauthorized ? "not-allowed" : "pointer" }}
                          onClick={() => {
                            if (past || unauthorized) return;
                            const typeToOpen = slot.type === "pending" ? "booked" : slot.type;
                            handleSlotInteraction(slot, typeToOpen);
                          }}
                          title={`${to12HourFormat(slot.start)} - ${to12HourFormat(slot.end)}`}
                        >
                          <span style={{ display: "block" }}>{to12HourFormat(slot.start)}–{to12HourFormat(slot.end)}</span>
                          {slot.type === "locked" && <LockTimer deleteAfter={slot.deleteAfter} />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
          <div className={styles.wrapper}>
            <table className={`table ${styles.table} text-center align-middle`}>

              <thead className="table-light">
                <tr>
                  <th className={styles.stickyCol}>Date</th>
                  <th>{yachtName}</th>
                </tr>
              </thead>


              <tbody>
                {grid.map((row, i) => (
                  <tr key={i} className={row.date === todayISO() ? styles.todayRow : ""}>
                    <td className={`${styles.stickyCol} fw-semibold`}>
                      <div>{new Date(row.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</div>
                      <div style={{ fontSize: "11px", fontWeight: 400, color: row.date === todayISO() ? "#b45309" : "#94a3b8" }}>
                        {row.date === todayISO() ? "Today" : new Date(row.date).toLocaleDateString('en-GB', { weekday: 'short' })}
                      </div>
                    </td>
                    {renderTimelineRow(row)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
          </>
        ) : (
          <div className="text-center py-5 text-muted">
            <div style={{ fontSize: "2rem" }}>📅</div>
            <p className="mt-2 mb-0 fw-semibold">No availability found</p>
            <small>Try selecting a different yacht or date range</small>
          </div>
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
                <div className="modal-body">
                  {selectedSlot && (
                    <>
                      {/* Slot summary pill */}
                      <div className="text-center mb-3">
                        <span className="badge bg-warning bg-opacity-15 text-dark px-3 py-2 rounded-pill fw-semibold" style={{ fontSize: "14px" }}>
                          🕐 {to12HourFormat(selectedSlot.start)} — {to12HourFormat(selectedSlot.end)}
                        </span>
                        <div className="text-muted small mt-1">
                          {selectedDate && new Date(selectedDate).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}
                        </div>
                      </div>

                      {/* Editable time fields */}
                      {user?.type == "admin" && (
                        <div className="text-start">
                          <label className="form-label small text-muted">Start time</label>
                          <input
                            type="time"
                            className="form-control mb-2"
                            value={editStart || ""}
                            disabled={!canEditSlot}
                            onChange={(e) => setEditStart(e.target.value)}
                          />

                          <label className="form-label small text-muted">End time</label>
                          <input
                            type="time"
                            className="form-control"
                            value={editEnd || ""}
                            disabled={!canEditSlot}
                            onChange={(e) => setEditEnd(e.target.value)}
                          />

                          {!canEditSlot && (
                            <div className="form-text text-muted mt-2">
                              ⚠️ This slot cannot be edited
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
                <div className="modal-body">
                  {selectedSlot && (
                    <div className="text-center">
                      <span className="badge bg-warning bg-opacity-15 text-dark px-3 py-2 rounded-pill fw-semibold" style={{ fontSize: "14px" }}>
                        🕐 {to12HourFormat(selectedSlot.start)} — {to12HourFormat(selectedSlot.end)}
                      </span>
                      <div className="text-muted small mt-1 mb-3">
                        {selectedDate && new Date(selectedDate).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}
                      </div>
                      <div className="text-muted small mb-2">
                        🔒 Locked by: <span className="fw-semibold text-dark">{selectedSlot.empName || "—"}</span>
                      </div>
                      {selectedSlot.deleteAfter && (
                        <div className="mt-1">
                          <span className="text-muted small">Auto-releases in: </span>
                          <LockTimer deleteAfter={selectedSlot.deleteAfter} />
                        </div>
                      )}
                    </div>
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
              <div className="modal-body">
                {selectedSlot && (
                  <div className="text-center">
                    <span className="badge bg-danger bg-opacity-10 text-danger px-3 py-2 rounded-pill fw-semibold" style={{ fontSize: "14px" }}>
                      🕐 {to12HourFormat(selectedSlot.start)} — {to12HourFormat(selectedSlot.end)}
                    </span>
                    <div className="text-muted small mt-1 mb-3">
                      {selectedDate && new Date(selectedDate).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}
                    </div>
                    <div className="text-muted small mb-1">
                      👤 Agent: <span className="fw-semibold text-dark">{selectedSlot.empName || "—"}</span>
                    </div>
                    <div className="text-muted small">
                      🧑‍✈️ Guest: <span className="fw-semibold text-dark">{selectedSlot.custName || "—"}</span>
                    </div>
                  </div>
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