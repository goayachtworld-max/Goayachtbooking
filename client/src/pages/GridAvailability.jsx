import React, { useCallback, useEffect, useRef, useState } from "react";
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
import DateRangePicker from "../components/DateRangePicker";

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

// ── LockTimer: defined at module level so it is never remounted on parent re-render ──
const LockTimer = React.memo(function LockTimer({ deleteAfter }) {
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
  if (remaining <= 0) return <span style={{ color: "#dc3545", fontSize: "9.5px", fontWeight: 700, letterSpacing: "0.05em", opacity: 0.9 }}>⏰ Expired</span>;

  const totalSec = Math.ceil(remaining / 1000);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  const color = remaining < 60000 ? "#dc3545" : remaining < 180000 ? "#fd7e14" : "inherit";

  // Renders inline — caller places it in the status slot, no extra line
  return (
    <span style={{ color, fontSize: "9.5px", fontWeight: 700, letterSpacing: "0.05em", opacity: 0.9 }}>
      ⏱ {mins}:{String(secs).padStart(2, "0")}
    </span>
  );
});

// ── SlotReleaseCountdown: inline countdown shown inside the slot card instead of "Locked" label ──
// Ticks its own state every second — only this tiny element re-renders, not the grid.
const SlotReleaseCountdown = React.memo(function SlotReleaseCountdown({ initial = 10, onExpire, onCancel }) {
  const [remaining, setRemaining] = useState(initial);

  useEffect(() => {
    if (remaining <= 0) { onExpire(); return; }
    const id = setTimeout(() => setRemaining(r => r - 1), 1000);
    return () => clearTimeout(id);
  }, [remaining]);

  return (
    <span style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "center", flexWrap: "wrap" }}>
      <span style={{ fontSize: "11px", fontWeight: 700, color: "#e85555" }}>
        🔓 {remaining}s
      </span>
      <button
        style={{
          fontSize: "10px", padding: "1px 7px", borderRadius: 99,
          border: "1px solid #e85555", background: "transparent",
          color: "#e85555", cursor: "pointer", lineHeight: 1.4,
        }}
        onClick={(e) => { e.stopPropagation(); onCancel(); }}
      >
        Cancel
      </button>
    </span>
  );
});

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

  const [favYachtIds, setFavYachtIds] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem("ga_favYachts") || "[]")); }
    catch { return new Set(); }
  });
  const toggleFav = (id, e) => {
    e.stopPropagation();
    setFavYachtIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      localStorage.setItem("ga_favYachts", JSON.stringify([...next]));
      return next;
    });
  };

  const [yachtId, setYachtId] = useState(params.get("yachtId") || "");
  const [yachtName, setYachtName] = useState("");
  const [fromDate, setFromDate] = useState(
    params.get("fromDate") || todayISO()
  );
  const [toDate, setToDate] = useState(params.get("toDate") || plusDaysISO(6));

  const [yachts, setYachts] = useState([]);
  const [yacht, setYacht] = useState(null);
  // Ref always holds the latest yacht object — avoids stale-closure bugs in useCallback functions
  const yachtRef = useRef(null);
  useEffect(() => { yachtRef.current = yacht; }, [yacht]);
  const [dates, setDates] = useState([]);
  const [grid, setGrid] = useState([]); // [{date, slots: [{start,end,type,custName,empName}]}]
  const [loading, setLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);

  const [selectedSlot, setSelectedSlot] = useState(null);
  const [modalType, setModalType] = useState("");
  const [showLockModal, setShowLockModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showBookedModal, setShowBookedModal] = useState(false);
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
  const [sheetMode, setSheetMode] = useState("yacht"); // "yacht" | "date"
  const [mobileYachtSearch, setMobileYachtSearch] = useState("");

  // ── Double-click support ──
  const longPressTimer  = useRef(null);
  const pressingTimer   = useRef(null);
  const longPressFired  = useRef(false);
  const [pressingKey, setPressingKey] = useState(null); // "date-start" of slot being held
  const [pendingReleases, setPendingReleases] = useState({}); // { [key]: slot } — only changes twice per release

  const handleSlotReleaseExpire = useCallback(async (key, slot) => {
    setPendingReleases(prev => { const n = { ...prev }; delete n[key]; return n; });
    updateGridSlot(slot.date, slot.start, slot.end, { type: "free", empName: "" });
    try {
      await releaseSlot(yachtId, slot.date, slot.start, slot.end, token);
      await reloadSingleDay(slot.date);
      toast.success("🔓 Slot released!");
    } catch {
      toast.error("Failed to release");
      await reloadSingleDay(slot.date);
    }
  }, [yachtId, token]);

  const handleSlotReleaseCancel = useCallback((key) => {
    setPendingReleases(prev => { const n = { ...prev }; delete n[key]; return n; });
    toast("Release cancelled ✋", { duration: 1800 });
  }, []);

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

  useEffect(() => {
    if (!yachtId && yachts.length > 0) {
      const sorted = [...yachts].sort((a, b) => a.name.localeCompare(b.name));
      const favsSorted = sorted.filter((y) => favYachtIds.has(y._id));
      const pick = favsSorted.length > 0 ? favsSorted[0]._id : sorted[0]._id;
      setYachtId(pick);
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
              numPeople: bookedOverlap.numPeople || bookedOverlap.pax || null,
              addons: bookedOverlap.addons || bookedOverlap.addOns || [],
              ticketId: bookedOverlap.ticketId || bookedOverlap._id || null,
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
      setHasFetched(true);
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
  // useCallback so that handleSlotReleaseExpire (and others) always call the latest version
  const reloadSingleDay = useCallback(async (date) => {
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
      // Use yachtRef.current to always read the latest yacht — avoids stale-closure bug
      // where yacht was null when handleSlotReleaseExpire's useCallback deps last fired
      baseSlots = buildSlotsForYacht(yachtRef.current);
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
          type: bookedOverlap.status === "pending" ? "pending" : "booked",
          custName: bookedOverlap.custName || bookedOverlap.customerName || "",
          empName: bookedOverlap.empName || bookedOverlap.employeeName || "",
          appliedBy: bookedOverlap.appliedBy || null,
          numPeople: bookedOverlap.numPeople || bookedOverlap.pax || null,
          addons: bookedOverlap.addons || bookedOverlap.addOns || [],
          ticketId: bookedOverlap.ticketId || bookedOverlap._id || null,
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
  }, [yachtId, token]); // yachtRef is a ref so it's stable — no need to list

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

  // Auto-release a locked slot whose deleteAfter timer has already elapsed.
  // Called on click instead of opening the confirm popup.
  const autoReleaseExpiredSlot = useCallback(async (slot) => {
    updateGridSlot(slot.date, slot.start, slot.end, { type: "free", empName: "", deleteAfter: null });
    toast.loading("Releasing expired slot…", { id: "exp-rel" });
    try {
      await releaseSlot(yachtId, slot.date, slot.start, slot.end, token);
      await reloadSingleDay(slot.date);
      toast.success("🔓 Expired slot released", { id: "exp-rel" });
    } catch {
      toast.error("Failed to release", { id: "exp-rel" });
      await reloadSingleDay(slot.date);
    }
  }, [yachtId, token, reloadSingleDay]);

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
      if (type === "free") {
        setShowLockModal(true);
      } else if (type === "locked") {
        setShowConfirmModal(true);
      } else {
        setShowBookedModal(true);
      }
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

  // ── Long-press: fires at exactly 1 s; holding longer does nothing extra ──
  const startLongPress = (slot) => {
    const canLock    = slot.type === "free";
    const canRelease = slot.type === "locked" && (isAdminOrOnsite || isOwner(slot));
    if (!canLock && !canRelease) return;
    const key = `${slot.date}-${slot.start}`;
    longPressFired.current = false;
    // Show pulsing animation after 200 ms (quick taps never see it)
    pressingTimer.current = setTimeout(() => setPressingKey(key), 200);
    // Action fires at exactly 1 s — holding longer doesn't repeat
    longPressTimer.current = setTimeout(async () => {
      longPressFired.current = true;
      setPressingKey(null);
      if (canLock) {
        updateGridSlot(slot.date, slot.start, slot.end, { type: "locked" });
        try {
          await lockSlot(yachtId, slot.date, slot.start, slot.end, token);
          await reloadSingleDay(slot.date);
          toast.success("🔒 Slot locked!");
        } catch {
          toast.error("Failed to lock");
          await reloadSingleDay(slot.date);
        }
      } else {
        // Show inline countdown inside the slot card — replaces "Locked" label
        setPendingReleases(prev => ({ ...prev, [key]: slot }));
      }
    }, 1000);
  };

  // Clears timers — does NOT fire any action (action fires inside the timer itself)
  const cancelLongPress = () => {
    if (pressingTimer.current) { clearTimeout(pressingTimer.current); pressingTimer.current = null; }
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
    setPressingKey(null);
  };

  const abortLongPress = cancelLongPress;

  const handleSlotInteraction = (slot, type) => {
    if (longPressFired.current) {
      longPressFired.current = false;
      return; // long-press already handled this touch — skip click
    }
    handleSlotClick(slot, type);
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
      // Always run adjustSlots so any overlapping free slots get trimmed
      // (not just when the user explicitly changes the start/end times)
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

      // permanent = true → no auto-expiry timer; backend receives permanent:true, deleteAfter:null
      await lockSlot(yachtId, selectedDate, start, end, token, true);

      // 🔄 revalidate ONLY this day
      await reloadSingleDay(selectedDate);

      // Override any backend-set deleteAfter so no auto-release timer shows for popup locks
      updateGridSlot(selectedDate, start, end, { deleteAfter: null });

      toast.success("Slot locked successfully");
      setShowLockModal(false);
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

      setShowConfirmModal(false);
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
    setShowConfirmModal(false);

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


  // Groups a day's slots into display rows:
  //  • Slots starting 15:00–20:00 → one "fast selling" row (can be 2 or 3 wide)
  //  • All other slots → pairs of 2
  const buildSlotRows = (slots) => {
    const FAST_START = 15 * 60; // 3 pm
    const FAST_END   = 20 * 60; // 8 pm
    const fast    = slots.filter(s => { const m = hhmmToMinutes(s.start); return m >= FAST_START && m < FAST_END; });
    const regular = slots.filter(s => { const m = hhmmToMinutes(s.start); return m < FAST_START || m >= FAST_END; });

    const rows = [];

    // regular: groups of 3 in timeline order
    for (let i = 0; i < regular.length; i += 3) {
      rows.push({ kind: "pair", slots: regular.slice(i, i + 3), startMin: hhmmToMinutes(regular[i].start) });
    }

    // fast-selling: entire group on one row
    if (fast.length > 0) {
      const fastSorted = [...fast].sort((a,b) => hhmmToMinutes(a.start) - hhmmToMinutes(b.start));
      rows.push({ kind: "fast", slots: fastSorted, startMin: hhmmToMinutes(fastSorted[0].start) });
    }

    // sort rows by the first slot's start time
    rows.sort((a, b) => a.startMin - b.startMin);
    return rows;
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


          const desktopSlotKey = `${row.date}-${slot.start}`;
          const isDesktopPressing = pressingKey === desktopSlotKey;
          const isDesktopPendingRelease = !!pendingReleases[desktopSlotKey];
          return (
            <div
              key={idx}
              className={[
                styles.slot,
                styles[slot.type],
                past ? styles.past : "",
                isDesktopPressing ? styles.pressing : "",
              ].join(" ")}
              style={{
                position: "absolute",
                left: `${left}%`,
                width: `${width}%`,
                height: `100%`,
                cursor: past || unauthorized ? "not-allowed" : "pointer",
                userSelect: "none",
              }}
              onPointerDown={(e) => { if (past || unauthorized || isDesktopPendingRelease) return; e.currentTarget.setPointerCapture(e.pointerId); startLongPress({ ...slot, date: row.date }); }}
              onPointerUp={cancelLongPress}
              onPointerCancel={cancelLongPress}
              onPointerLeave={abortLongPress}
              onClick={() => {
                if (past || unauthorized || isDesktopPendingRelease) return;
                if (slot.type === "locked" && slot.deleteAfter && new Date(slot.deleteAfter) <= Date.now()) {
                  autoReleaseExpiredSlot({ ...slot, date: row.date });
                  return;
                }
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
              {isDesktopPendingRelease ? (
                <SlotReleaseCountdown
                  key={desktopSlotKey}
                  initial={10}
                  onExpire={() => handleSlotReleaseExpire(desktopSlotKey, pendingReleases[desktopSlotKey])}
                  onCancel={() => handleSlotReleaseCancel(desktopSlotKey)}
                />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 1, whiteSpace: "normal", lineHeight: 1.25, maxWidth: "100%", overflow: "hidden" }}>
                  <span style={{ fontSize: "10px", fontWeight: 800, whiteSpace: "nowrap" }}>
                    {to12HourFormat(slot.start)}–{to12HourFormat(slot.end)}
                  </span>
                  {(slot.type === "locked" || slot.type === "booked" || slot.type === "pending") &&
                    (isAdminOrOnsite || isOwner(slot)) && slot.empName && (
                    <span style={{ fontSize: "8px", opacity: 0.82, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "clip", maxWidth: "100%" }}>
                      {slot.empName}
                    </span>
                  )}
                  {slot.type === "locked" && slot.deleteAfter && (
                    <LockTimer deleteAfter={slot.deleteAfter} />
                  )}
                </div>
              )}
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

                <div style={{ flexShrink: 0 }}>
                  <DateRangePicker
                    fromDate={fromDate}
                    toDate={toDate}
                    onChange={(f, t) => { setFromDate(f); setToDate(t); }}
                  />
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
              {/* Yacht chip — opens yacht-only sheet */}
              <button
                className={styles.mobileYachtChip}
                onClick={() => { setMobileYachtSearch(""); setSheetMode("yacht"); setShowYachtSheet(true); }}
              >
                <span>⛵</span>
                <span className={styles.mobileYachtChipName}>{yachtName || "Select Yacht"}</span>
                <span className={styles.mobileYachtChipChevron}>▾</span>
              </button>

              {/* Filter button — opens date-only sheet */}
              <button
                className={`${styles.mobileFilterBtn} ${(fromDate !== todayISO() || toDate !== plusDaysISO(6)) ? styles.mobileFilterBtnActive : ""}`}
                onClick={() => { setSheetMode("date"); setShowYachtSheet(true); }}
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
                    <span className={styles.sheetTitle}>
                      {sheetMode === "yacht" ? "⛵ Select Yacht" : "📅 Select Dates"}
                    </span>
                    <button className={styles.sheetClose} onClick={() => setShowYachtSheet(false)}>✕</button>
                  </div>

                  {sheetMode === "yacht" ? (
                    /* ── Yacht mode ── */
                    <>
                      <div className={styles.sheetSearchWrap}>
                        <span className={styles.sheetSearchIcon}>🔍</span>
                        <input
                          type="text"
                          autoFocus
                          className={styles.sheetSearchInput}
                          placeholder="Search yacht..."
                          value={mobileYachtSearch}
                          onChange={(e) => setMobileYachtSearch(e.target.value)}
                        />
                        {mobileYachtSearch && (
                          <button className={styles.sheetSearchClear} onClick={() => setMobileYachtSearch("")}>✕</button>
                        )}
                      </div>

                      <ul className={`${styles.sheetList} ${styles.sheetScrollBody}`}>
                        {(() => {
                          const filtered = yachts.filter((y) => y.name.toLowerCase().includes(mobileYachtSearch.toLowerCase()));
                          const sorted = [...filtered].sort((a, b) => {
                            const aFav = favYachtIds.has(a._id);
                            const bFav = favYachtIds.has(b._id);
                            if (aFav && !bFav) return -1;
                            if (!aFav && bFav) return 1;
                            return a.name.localeCompare(b.name);
                          });
                          if (sorted.length === 0) return <li className={styles.sheetEmpty}>No yacht found</li>;
                          return sorted.map((y) => (
                            <li
                              key={y._id}
                              className={`${styles.sheetItem} ${y._id === yachtId ? styles.sheetItemActive : ""}`}
                              onClick={() => { setYachtId(y._id); setYachtName(y.name); setMobileYachtSearch(""); setShowYachtSheet(false); }}
                              style={{ display: "flex", alignItems: "center", gap: 6 }}
                            >
                              <button
                                onClick={(e) => toggleFav(y._id, e)}
                                style={{
                                  background: "none", border: "none", padding: 0,
                                  fontSize: 16, cursor: "pointer", flexShrink: 0,
                                  color: favYachtIds.has(y._id) ? "#f59e0b" : "#cbd5e1",
                                  lineHeight: 1,
                                }}
                              >{favYachtIds.has(y._id) ? "★" : "☆"}</button>
                              <span className={styles.sheetItemName} style={{ flex: 1 }}>{y.name}</span>
                              {y._id === yachtId && <span className={styles.sheetItemCheck}>✓</span>}
                            </li>
                          ));
                        })()}
                      </ul>
                    </>
                  ) : (
                    /* ── Date mode ── */
                    <>
                      <div className={styles.sheetScrollBody}>
                        <DateRangePicker
                          fromDate={fromDate}
                          toDate={toDate}
                          inline={true}
                          onChange={(f, t) => { setFromDate(f); setToDate(t); }}
                        />
                      </div>
                      <div className={styles.sheetFooter}>
                        <button className="btn btn-primary w-100 rounded-pill" onClick={() => setShowYachtSheet(false)}>
                          Apply
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
            {/* Prices + legend pinned inside the sticky header on mobile */}
            <div className={`d-flex justify-content-between align-items-center flex-wrap gap-2 ${styles.mobileInfoBar}`}>
              {yacht && (
                <div className="d-flex gap-2 align-items-center flex-wrap">
                  <span className={`badge bg-primary bg-opacity-10 text-primary px-2 py-1 rounded-pill fw-semibold ${styles.mobileInfoBadge}`} style={{ fontSize: "11px" }}>
                    B2b: ₹{Number(yacht.runningCost).toLocaleString("en-IN")}
                  </span>
                  <span className={`badge bg-success bg-opacity-10 text-success px-2 py-1 rounded-pill fw-semibold ${styles.mobileInfoBadge}`} style={{ fontSize: "11px" }}>
                    Selling: ₹{Number(yacht.sellingPrice).toLocaleString("en-IN")}
                  </span>
                  {yacht.maxSellingPrice > 0 && (
                    <span className={`badge px-2 py-1 rounded-pill fw-semibold ${styles.mobileInfoBadge}`} style={{ fontSize: "11px", background: "#fff7ed", color: "#c2410c" }}>
                      Customer: ₹{Number(yacht.maxSellingPrice).toLocaleString("en-IN")}
                    </span>
                  )}
                </div>
              )}
              <div className={styles.legend}>
                <span className={styles.legendItem}><span className={`${styles.legendDot} ${styles.legendFree}`}></span> Free</span>
                <span className={styles.legendItem}><span className={`${styles.legendDot} ${styles.legendPending}`}></span> Pending</span>
                <span className={styles.legendItem}><span className={`${styles.legendDot} ${styles.legendLocked}`}></span> Locked</span>
                <span className={styles.legendItem}><span className={`${styles.legendDot} ${styles.legendBooked}`}></span> Booked</span>
              </div>
            </div>
          </div>
          </>
        )}

        {/* Desktop: info bar + legend outside the sticky header */}
        {!isMobile && (
          <div className="mb-2 d-flex justify-content-between align-items-center flex-wrap gap-2">
            {yacht && (
              <div className="d-flex gap-2 align-items-center flex-wrap">
                <span className="badge bg-primary bg-opacity-10 text-primary px-2 py-1 rounded-pill fw-semibold" style={{ fontSize: "13px" }}>
                  B2b: ₹{Number(yacht.runningCost).toLocaleString("en-IN")}
                </span>
                <span className="badge bg-success bg-opacity-10 text-success px-2 py-1 rounded-pill fw-semibold" style={{ fontSize: "13px" }}>
                  Selling: ₹{Number(yacht.sellingPrice).toLocaleString("en-IN")}
                </span>
                {yacht.maxSellingPrice > 0 && (
                  <span className="badge px-2 py-1 rounded-pill fw-semibold" style={{ fontSize: "13px", background: "#fff7ed", color: "#c2410c" }}>
                    Customer: ₹{Number(yacht.maxSellingPrice).toLocaleString("en-IN")}
                  </span>
                )}
              </div>
            )}
            <div className={styles.legend}>
              <span className={styles.legendItem}><span className={`${styles.legendDot} ${styles.legendFree}`}></span> Free</span>
              <span className={styles.legendItem}><span className={`${styles.legendDot} ${styles.legendPending}`}></span> Pending</span>
              <span className={styles.legendItem}><span className={`${styles.legendDot} ${styles.legendLocked}`}></span> Locked</span>
              <span className={styles.legendItem}><span className={`${styles.legendDot} ${styles.legendBooked}`}></span> Booked</span>
            </div>
          </div>
        )}

        {loading ? (
          isMobile ? (
            <div className={styles.skeletonGrid}>
              {[0,1,2,3].map(i => (
                <div key={i} className={styles.skeletonCard}>
                  <div className={styles.skeletonHeader} />
                  <div className={styles.skeletonBody}>
                    <div className={styles.skeletonSlot} />
                    <div className={styles.skeletonSlot} />
                    <div className={styles.skeletonSlot} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-5 text-muted">
              <div className="spinner-border spinner-border-sm me-2" role="status" />
              Loading availability...
            </div>
          )
        ) : grid.length > 0 ? (
          <>

          {/* Mobile card view */}
          {isMobile ? (
            <div className={styles.mobileGrid}>
              {grid.map((row, i) => {
                const isToday = row.date === todayISO();
                const freeCnt    = row.slots.filter(s => s.type === "free").length;
                const bookedCnt  = row.slots.filter(s => s.type === "booked").length;
                const lockedCnt  = row.slots.filter(s => s.type === "locked").length;
                const pendingCnt = row.slots.filter(s => s.type === "pending").length;
                return (
                  <div key={i} className={styles.mobileDay}>
                    {/* ── Day header ── */}
                    <div className={isToday ? styles.mobileDayHeaderToday : styles.mobileDayHeader}>
                      {isToday ? (
                        <span className={styles.mobileDayHeaderTodayLabel}>
                          {new Date(row.date).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' })}
                          <span className={styles.todayBadge}>Today</span>
                        </span>
                      ) : (
                        <span className={styles.mobileDayHeaderLabel}>
                          {new Date(row.date).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' })}
                        </span>
                      )}
                      <div className={styles.dayCountBadges}>
                        {freeCnt > 0    && <span className={`${styles.dayCountPill} ${styles.dayCountFree}`}>{freeCnt} free</span>}
                        {pendingCnt > 0 && <span className={`${styles.dayCountPill} ${styles.dayCountPending}`}>{pendingCnt} pend</span>}
                        {lockedCnt > 0  && <span className={`${styles.dayCountPill} ${styles.dayCountLocked}`}>{lockedCnt} lock</span>}
                        {bookedCnt > 0  && <span className={`${styles.dayCountPill} ${styles.dayCountBooked}`}>{bookedCnt} bkd</span>}
                      </div>
                    </div>

                    {/* ── Slot rows ── */}
                    <div className={styles.mobileSlotList}>
                      {buildSlotRows(row.slots).map((group, gIdx) => {
                        const isFast = group.kind === "fast";
                        return (
                          <div key={gIdx}>
                            {isFast && (
                              <div className={styles.fastSellingStrip}>
                                🔥 <span>Fast Selling</span>
                              </div>
                            )}
                            <div
                              className={isFast ? styles.slotFastRow : styles.slotPairRow}
                            >
                              {group.slots.map((slot, idx) => {
                                const past = isPastSlot(slot, row.date);
                                const unauthorized =
                                  !isAdminOrOnsite &&
                                  (slot.type === "locked" || slot.type === "booked" || slot.type === "pending") &&
                                  !isOwner(slot);

                                const statusLabel = { free: "Tap to lock", locked: "Locked", booked: "Booked", pending: "Pending" }[slot.type] || slot.type;
                                const nameLine = (slot.type === "booked" || slot.type === "pending")
                                  ? (slot.custName || slot.empName || "")
                                  : slot.type === "locked" ? (slot.empName || "") : "";

                                const slotKey = `${slot.date}-${slot.start}`;
                                const isPressing = pressingKey === slotKey;
                                const isPendingRelease = !!pendingReleases[slotKey];
                                return (
                                  <div
                                    key={idx}
                                    className={[styles.slotCard, styles[slot.type], past ? styles.past : "", isPressing ? styles.pressing : ""].join(" ")}
                                    style={{ cursor: past || unauthorized ? "not-allowed" : "pointer", userSelect: "none" }}
                                    onPointerDown={(e) => { if (past || unauthorized || isPendingRelease) return; e.currentTarget.setPointerCapture(e.pointerId); startLongPress(slot); }}
                                    onPointerUp={cancelLongPress}
                                    onPointerCancel={cancelLongPress}
                                    onPointerLeave={abortLongPress}
                                    onClick={() => {
                                      if (past || unauthorized || isPendingRelease) return;
                                      if (slot.type === "locked" && slot.deleteAfter && new Date(slot.deleteAfter) <= Date.now()) {
                                        autoReleaseExpiredSlot(slot);
                                        return;
                                      }
                                      const typeToOpen = slot.type === "pending" ? "booked" : slot.type;
                                      handleSlotInteraction(slot, typeToOpen);
                                    }}
                                  >
                                    <span className={styles.slotCardTime}>
                                      {to12HourFormat(slot.start)} – {to12HourFormat(slot.end)}
                                    </span>
                                    {isPendingRelease ? (
                                      <SlotReleaseCountdown
                                        key={slotKey}
                                        initial={10}
                                        onExpire={() => handleSlotReleaseExpire(slotKey, pendingReleases[slotKey])}
                                        onCancel={() => handleSlotReleaseCancel(slotKey)}
                                      />
                                    ) : (
                                      <>
                                        <span className={styles.slotCardStatus}>
                                          {slot.type === "locked" && slot.deleteAfter
                                            ? <LockTimer deleteAfter={slot.deleteAfter} />
                                            : statusLabel}
                                        </span>
                                        {nameLine ? <span className={styles.slotCardName}>{nameLine}</span> : null}
                                      </>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
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
        ) : hasFetched ? (
          <div className="text-center py-5 text-muted">
            <div style={{ fontSize: "2rem" }}>📅</div>
            <p className="mt-2 mb-0 fw-semibold">No availability found</p>
            <small>Try selecting a different yacht or date range</small>
          </div>
        ) : null}

        {/* ── LOCK SLOT MODAL (pure React, no Bootstrap JS) ── */}
        {showLockModal && (
          <div
            onClick={() => setShowLockModal(false)}
            style={{
              position: "fixed", inset: 0, zIndex: 9999,
              background: "rgba(5,24,41,0.55)",
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: "20px",
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ borderRadius: 20, overflow: "hidden", boxShadow: "0 20px 60px rgba(5,24,41,0.28)", background: "#fff", width: "100%", maxWidth: 400 }}
            >
              <form onSubmit={handleSaveAndLock}>

                {/* ── HEADER ── */}
                <div style={{
                  background: "linear-gradient(135deg, #051829 0%, #0a2d4a 60%, #0d4a6e 100%)",
                  padding: "22px 24px 18px",
                  position: "relative",
                }}>
                  <button
                    type="button"
                    onClick={() => setShowLockModal(false)}
                    style={{
                      position: "absolute", top: 14, right: 16,
                      background: "rgba(255,255,255,0.12)", border: "none",
                      borderRadius: "50%", width: 30, height: 30,
                      color: "#fff", fontSize: 14, cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                  >✕</button>

                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: 12,
                      background: "rgba(201,168,76,0.18)",
                      border: "1.5px solid rgba(201,168,76,0.4)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 20, flexShrink: 0,
                    }}>🔒</div>
                    <div>
                      <div style={{ color: "#c9a84c", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 2 }}>
                        Availability
                      </div>
                      <div style={{ color: "#fff", fontSize: 17, fontWeight: 700, lineHeight: 1.2 }}>
                        Lock Time Slot
                      </div>
                    </div>
                  </div>

                  {yacht?.name && (
                    <div style={{
                      marginTop: 14,
                      display: "inline-flex", alignItems: "center", gap: 6,
                      background: "rgba(201,168,76,0.15)",
                      border: "1px solid rgba(201,168,76,0.3)",
                      borderRadius: 20, padding: "4px 12px",
                    }}>
                      <span style={{ fontSize: 13 }}>⚓</span>
                      <span style={{ color: "#e8d5a0", fontSize: 12.5, fontWeight: 600 }}>{yacht.name}</span>
                    </div>
                  )}
                </div>

                {/* ── BODY ── */}
                <div style={{ padding: "20px 24px 8px" }}>
                  {selectedSlot && (
                    <>
                      <div style={{
                        background: "linear-gradient(135deg, #f0f7ff, #e8f4fd)",
                        border: "1.5px solid #bfdbfe",
                        borderRadius: 14, padding: "16px 20px",
                        marginBottom: 16, textAlign: "center",
                      }}>
                        <div style={{ fontSize: 22, fontWeight: 800, color: "#051829", letterSpacing: "-0.02em", lineHeight: 1 }}>
                          {to12HourFormat(selectedSlot.start)}
                          <span style={{ fontSize: 16, fontWeight: 500, color: "#64748b", margin: "0 8px" }}>→</span>
                          {to12HourFormat(selectedSlot.end)}
                        </div>
                        <div style={{ marginTop: 6, fontSize: 12.5, fontWeight: 600, color: "#475569" }}>
                          {selectedDate && new Date(selectedDate).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
                        </div>
                      </div>

                      {(() => {
                        const baseStartMin = hhmmToMinutes(selectedSlot.start);
                        const baseEndMin   = hhmmToMinutes(selectedSlot.end);

                        // Cap end time at the next slot of ANY type (free slots included)
                        // Prevents extending into the next slot and triggering backend overlap lock
                        const maxEndMin = daySlots.reduce((cap, s) => {
                          if (s.start === selectedSlot.start) return cap;
                          const sm = hhmmToMinutes(s.start);
                          if (sm > baseStartMin) return Math.min(cap, sm);
                          return cap;
                        }, 23 * 60 + 59);

                        const currentStartMin = hhmmToMinutes(editStart || selectedSlot.start);

                        // Lower bound for start: don't overlap ANY preceding slot (free or not)
                        // Prevents moving start into a preceding slot which causes double-lock
                        const yachtSailStart = yacht?.sailStartTime ? hhmmToMinutes(yacht.sailStartTime) : 0;
                        const yachtSailEnd   = yacht?.sailEndTime   ? hhmmToMinutes(yacht.sailEndTime)   : 23 * 60 + 59;
                        const minStartMin = daySlots.reduce((acc, s) => {
                          if (s.start === selectedSlot.start) return acc;
                          const em = hhmmToMinutes(s.end);
                          if (em <= baseStartMin) return Math.max(acc, em);
                          return acc;
                        }, yachtSailStart);

                        // Slabs: -1hr, -30, current, +30, +1hr, +1.5hr
                        const startOptions = [-60, -30, 0, 30, 60, 90].map(d => ({
                          value: minutesToHHMM(baseStartMin + d),
                          minutes: baseStartMin + d,
                          disabled: (baseStartMin + d) < minStartMin
                                 || (baseStartMin + d) > yachtSailEnd - 30
                                 || (baseStartMin + d) < 0,
                        }));

                        const endDeltas = [-60, -30, 0, 30, 60, 90, 120, 150, 180];
                        const endOptions = endDeltas.map(d => ({
                          value: minutesToHHMM(baseEndMin + d),
                          minutes: baseEndMin + d,
                          disabled: (baseEndMin + d) > maxEndMin || (baseEndMin + d) <= currentStartMin,
                        }));

                        const selectStyle = {
                          width: "100%", padding: "10px 12px",
                          borderRadius: 10, border: "1.5px solid #e2e8f0",
                          fontSize: 14, fontWeight: 600, color: "#051829",
                          background: "#f8fafc", cursor: "pointer",
                          appearance: "auto",
                        };

                        return (
                          <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
                            {/* ── Start Time ── */}
                            <div style={{ flex: 1 }}>
                              <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>
                                Start Time
                              </label>
                              <select
                                style={selectStyle}
                                value={editStart || selectedSlot.start}
                                onChange={(e) => {
                                  const newStart = e.target.value;
                                  setEditStart(newStart);
                                  const newStartMin = hhmmToMinutes(newStart);
                                  const curEnd = hhmmToMinutes(editEnd || selectedSlot.end);
                                  if (curEnd <= newStartMin) {
                                    setEditEnd(minutesToHHMM(Math.min(newStartMin + 60, maxEndMin)));
                                  }
                                }}
                              >
                                {startOptions.map(opt => (
                                  <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                                    {to12HourFormat(opt.value)}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* ── End Time ── */}
                            <div style={{ flex: 1 }}>
                              <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>
                                End Time
                              </label>
                              <select
                                style={selectStyle}
                                value={editEnd || selectedSlot.end}
                                onChange={(e) => setEditEnd(e.target.value)}
                              >
                                {endOptions.map(opt => (
                                  <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                                    {to12HourFormat(opt.value)}{opt.disabled && opt.minutes > maxEndMin ? " (booked)" : ""}
                                  </option>
                                ))}
                              </select>
                              {maxEndMin < 23 * 60 + 59 && (
                                <div style={{ marginTop: 5, fontSize: 11, color: "#b45309", fontWeight: 600 }}>
                                  ⚠️ Capped at {to12HourFormat(minutesToHHMM(maxEndMin))} — next slot is booked
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })()}


                      <div style={{
                        display: "flex", alignItems: "flex-start", gap: 8,
                        background: "#f8fafc", border: "1px solid #e2e8f0",
                        borderRadius: 10, padding: "10px 12px",
                      }}>
                        <span style={{ fontSize: 14, marginTop: 1 }}>ℹ️</span>
                        <span style={{ fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>
                          Locking reserves this slot temporarily. It will auto-release if a booking is not confirmed in time.
                        </span>
                      </div>
                    </>
                  )}
                </div>

                {/* ── FOOTER ── */}
                <div style={{ padding: "16px 24px 20px", display: "flex", gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => setShowLockModal(false)}
                    style={{
                      flex: 1, padding: "11px 0", borderRadius: 12,
                      border: "1.5px solid #e2e8f0", background: "#fff",
                      color: "#475569", fontSize: 14, fontWeight: 600, cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isLocking}
                    style={{
                      flex: 2, padding: "11px 0", borderRadius: 12,
                      background: isLocking
                        ? "#94a3b8"
                        : "linear-gradient(135deg, #c9a84c, #e0b850)",
                      border: "none", color: "#051829",
                      fontSize: 14, fontWeight: 700, cursor: isLocking ? "not-allowed" : "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                      boxShadow: isLocking ? "none" : "0 4px 14px rgba(201,168,76,0.35)",
                      transition: "all 0.2s",
                    }}
                  >
                    {isLocking ? (
                      <>
                        <span style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid #fff6", borderTopColor: "#051829", display: "inline-block", animation: "spin 0.7s linear infinite" }} />
                        Locking…
                      </>
                    ) : (
                      <>🔒 Lock Slot</>
                    )}
                  </button>
                </div>

              </form>
            </div>
          </div>
        )}


        {showConfirmModal && (
          <div
            style={{
              position: "fixed", inset: 0, zIndex: 1055,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: "rgba(5,24,41,0.72)", backdropFilter: "blur(4px)",
              padding: "16px",
            }}
            onClick={(e) => { if (e.target === e.currentTarget) setShowConfirmModal(false); }}
          >
            <div
              style={{
                background: "#fff", borderRadius: 20, width: "100%", maxWidth: 420,
                boxShadow: "0 24px 64px rgba(5,24,41,0.35)",
                overflow: "hidden",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <form onSubmit={handleConfirmBooking}>
                {/* Header */}
                <div style={{
                  background: "linear-gradient(135deg, #051829, #0a2d4a)",
                  padding: "20px 24px 16px",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 22 }}>📋</span>
                    <div>
                      <div style={{ color: "#c9a84c", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                        Locked Slot
                      </div>
                      <div style={{ color: "#fff", fontSize: 17, fontWeight: 700, lineHeight: 1.2 }}>
                        Confirm Booking
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowConfirmModal(false)}
                    style={{
                      background: "rgba(255,255,255,0.1)", border: "none",
                      borderRadius: "50%", width: 32, height: 32,
                      color: "#fff", fontSize: 18, cursor: "pointer", lineHeight: 1,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                  >×</button>
                </div>

                {/* Body */}
                <div style={{ padding: "20px 24px" }}>
                  {selectedSlot && (
                    <>
                      {/* Time pill */}
                      <div style={{ textAlign: "center", marginBottom: 16 }}>
                        <span style={{
                          display: "inline-block",
                          background: "rgba(201,168,76,0.12)", border: "1.5px solid #c9a84c",
                          borderRadius: 20, padding: "8px 20px",
                          color: "#051829", fontWeight: 700, fontSize: 15,
                        }}>
                          🕐 {to12HourFormat(selectedSlot.start)} — {to12HourFormat(selectedSlot.end)}
                        </span>
                        <div style={{ color: "#64748b", fontSize: 12, marginTop: 6 }}>
                          {selectedDate && new Date(selectedDate).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" })}
                        </div>
                      </div>

                      {/* Info rows */}
                      <div style={{
                        background: "#f8fafc", border: "1px solid #e2e8f0",
                        borderRadius: 12, padding: "12px 16px",
                        display: "flex", flexDirection: "column", gap: 10, marginBottom: 14,
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                          <span style={{ color: "#64748b" }}>🔒 Locked by</span>
                          <span style={{ fontWeight: 600, color: "#051829" }}>{selectedSlot.empName || "—"}</span>
                        </div>
                        {selectedSlot.deleteAfter && (
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                            <span style={{ color: "#64748b" }}>⏳ Auto-releases in</span>
                            <span style={{ fontWeight: 600, color: "#e74c3c" }}>
                              <LockTimer deleteAfter={selectedSlot.deleteAfter} />
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Note */}
                      <div style={{
                        display: "flex", alignItems: "flex-start", gap: 8,
                        background: "#fffbeb", border: "1px solid #fde68a",
                        borderRadius: 10, padding: "10px 12px",
                      }}>
                        <span style={{ fontSize: 14, marginTop: 1 }}>ℹ️</span>
                        <span style={{ fontSize: 12, color: "#92400e", lineHeight: 1.5 }}>
                          Confirming will take you to the booking form with this slot pre-filled.
                        </span>
                      </div>
                    </>
                  )}
                </div>

                {/* Footer */}
                <div style={{ padding: "0 24px 20px", display: "flex", gap: 10 }}>
                  <button
                    type="button"
                    onClick={handleReleaseLock}
                    disabled={isReleasing}
                    style={{
                      flex: 1, padding: "11px 0", borderRadius: 12,
                      border: "1.5px solid #ef4444",
                      background: isReleasing ? "#fee2e2" : "#fff",
                      color: "#ef4444", fontSize: 13, fontWeight: 600,
                      cursor: isReleasing ? "not-allowed" : "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    }}
                  >
                    {isReleasing ? (
                      <>
                        <span style={{ width: 13, height: 13, borderRadius: "50%", border: "2px solid #ef444466", borderTopColor: "#ef4444", display: "inline-block", animation: "spin 0.7s linear infinite" }} />
                        Releasing…
                      </>
                    ) : "🔓 Release"}
                  </button>
                  <button
                    type="submit"
                    disabled={isConfirming}
                    style={{
                      flex: 2, padding: "11px 0", borderRadius: 12,
                      background: isConfirming
                        ? "#94a3b8"
                        : "linear-gradient(135deg, #c9a84c, #e0b850)",
                      border: "none", color: "#051829",
                      fontSize: 14, fontWeight: 700, cursor: isConfirming ? "not-allowed" : "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                      boxShadow: isConfirming ? "none" : "0 4px 14px rgba(201,168,76,0.35)",
                    }}
                  >
                    {isConfirming ? (
                      <>
                        <span style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid #fff6", borderTopColor: "#051829", display: "inline-block", animation: "spin 0.7s linear infinite" }} />
                        Opening…
                      </>
                    ) : "📋 Confirm Booking"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showBookedModal && selectedSlot && (
          <div
            onClick={() => setShowBookedModal(false)}
            style={{
              position: "fixed", inset: 0, background: "rgba(5,24,41,0.55)",
              zIndex: 1060, display: "flex", alignItems: "center", justifyContent: "center",
              padding: "0 16px",
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background: "#fff", borderRadius: 20, width: "100%", maxWidth: 380,
                overflow: "hidden", boxShadow: "0 20px 60px rgba(5,24,41,0.25)",
              }}
            >
              {/* Header */}
              <div style={{
                background: "linear-gradient(135deg,#051829 0%,#0a2d4a 100%)",
                padding: "18px 20px 16px",
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                <div>
                  <div style={{ color: "#c9a84c", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>
                    {selectedSlot.type === "pending" ? "Pending Booking" : "Confirmed Booking"}
                  </div>
                  <div style={{ color: "#fff", fontWeight: 700, fontSize: 17, letterSpacing: 0.2 }}>
                    {to12HourFormat(selectedSlot.start)} — {to12HourFormat(selectedSlot.end)}
                  </div>
                  <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 3 }}>
                    {selectedSlot.date
                      ? new Date(selectedSlot.date + "T00:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
                      : ""}
                  </div>
                </div>
                <button
                  onClick={() => setShowBookedModal(false)}
                  style={{
                    background: "rgba(255,255,255,0.10)", border: "none", borderRadius: "50%",
                    width: 34, height: 34, cursor: "pointer", display: "flex",
                    alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 18, flexShrink: 0,
                  }}
                >✕</button>
              </div>

              {/* Body */}
              <div style={{ padding: "20px 20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
                {/* Booking name */}
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <span style={{ fontSize: 18, lineHeight: 1, marginTop: 1 }}>🧑‍✈️</span>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 2 }}>Booking Name</div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "#0a2d4a" }}>{selectedSlot.custName || "—"}</div>
                  </div>
                </div>

                {/* Pax */}
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <span style={{ fontSize: 18, lineHeight: 1, marginTop: 1 }}>👥</span>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 2 }}>Guests (Pax)</div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "#0a2d4a" }}>
                      {selectedSlot.numPeople ? `${selectedSlot.numPeople} pax` : "—"}
                    </div>
                  </div>
                </div>

                {/* Agent */}
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <span style={{ fontSize: 18, lineHeight: 1, marginTop: 1 }}>👤</span>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 2 }}>Agent</div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "#0a2d4a" }}>{selectedSlot.empName || "—"}</div>
                  </div>
                </div>

                {/* Addons */}
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <span style={{ fontSize: 18, lineHeight: 1, marginTop: 1 }}>✨</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>Add-ons</div>
                    {Array.isArray(selectedSlot.addons) && selectedSlot.addons.length > 0 ? (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {selectedSlot.addons.map((a, i) => (
                          <span key={i} style={{
                            background: "#f0f7ff", color: "#1d6fa4", fontSize: 12,
                            fontWeight: 600, borderRadius: 20, padding: "3px 10px",
                            border: "1px solid #bee3f8",
                          }}>
                            {typeof a === "object" ? (a.name || a.label || JSON.stringify(a)) : a}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span style={{ fontSize: 14, color: "#94a3b8" }}>None</span>
                    )}
                  </div>
                </div>

                {/* Divider */}
                <div style={{ borderTop: "1px solid #e8edf3", marginTop: 2 }} />

                {/* Close button */}
                <button
                  onClick={() => setShowBookedModal(false)}
                  style={{
                    background: "#051829", color: "#fff", border: "none",
                    borderRadius: 12, padding: "12px", fontWeight: 700,
                    fontSize: 14, cursor: "pointer", width: "100%",
                    letterSpacing: 0.3,
                  }}
                >Close</button>
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}

export default GridAvailability;