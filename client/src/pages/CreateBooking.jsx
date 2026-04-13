import React, { useEffect, useState, useRef, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { createBookingAPI } from "../services/operations/bookingAPI";
import {
  createCustomerAPI,
  getCustomerByContactAPI,
  searchCustomersByNameAPI,
} from "../services/operations/customerAPI";
import { getAllYachtsAPI, updateDaySlots } from "../services/operations/yautAPI";
import { adjustSlots } from "../utils/slotEngine";
import { toast } from "react-hot-toast";
import { createTransactionAndUpdateBooking } from "../services/operations/transactionAPI";
import { getEmployeesForBookingAPI } from "../services/operations/employeeAPI";

function CreateBooking() {
  const navigate = useNavigate();
  const location = useLocation();
  const prefill = location.state || {};


  const user = JSON.parse(localStorage.getItem("user"));
  const isAdmin = user?.type === "admin";
  const [formData, setFormData] = useState({
    name: "",
    contact: "",
    govtId: "",
    email: "",
    yachtId: prefill.yachtId || "",
    totalAmount: "",
    date: prefill.date || "",
    startTime: prefill.startTime || "",
    endTime: prefill.endTime || "",
    numPeople: "",
    advanceAmount: "",
    onBehalfEmployeeId: user?._id,
    extraDetails: "",
    bookingStatus: (location.state?.source === "bookings") ? "pending" : (isAdmin ? "confirmed" : "pending"),
    tokenAmount: ""
  });

  // Quotation mode: coming from Bookings page AND status is pending
  const isQuotation = prefill.source === "bookings" && formData.bookingStatus !== "confirmed";

  const [yachts, setYachts] = useState([]);
  const [startTimeOptions, setStartTimeOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [runningCost, setRunningCost] = useState(0);

  const [customerSuggestions, setCustomerSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const typingTimeoutRef = useRef(null);
  const originalSlotRef = useRef({ start: "", end: "" }); // stores the clean slot times before any custom override
  const [employees, setEmployees] = useState([]);
  const [showExtraDetails, setShowExtraDetails] = useState(false);
  const [
    customTimeEnabled, setCustomTimeEnabled] = useState(false);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [daySlotList, setDaySlotList] = useState([]);
  const [selectedSlotIndex, setSelectedSlotIndex] = useState(-1);

  // Dynamic pricing
  const [sailingHours, setSailingHours] = useState("");
  const [anchoringHours, setAnchoringHours] = useState("");
  const [calculatedAmount, setCalculatedAmount] = useState(null);

  const extraOptions = {
    inclusions: [
      "Soft Drink",
      "Ice Cube",
      "Water Bottles",
      "Bluetooth Speaker",
      "Captain & Crew",
      "Snacks"
    ],
    paidServices: [
      "DSLR Photography",
      "Drone - Photography & Videography",
    ],
  };

  const defaultInclusions = [
    "Soft Drink",
    "Ice Cube",
    "Water Bottles",
    "Bluetooth Speaker",
    "Captain & Crew",
  ];

  const [selectedExtras, setSelectedExtras] = useState(defaultInclusions);

  const [manualNotes, setManualNotes] = useState("");

  const handleExtraToggle = (label) => {
    setSelectedExtras((prev) =>
      prev.includes(label)
        ? prev.filter((i) => i !== label)
        : [...prev, label]
    );
  };


  useEffect(() => {
    if (!isAdmin) return;

    const fetchEmployees = async () => {
      const token = localStorage.getItem("authToken");
      const res = await getEmployeesForBookingAPI(token);
      setEmployees(res?.data?.employees || []);
    };

    fetchEmployees();
  }, []);


  const hhmmToMinutes = (time = "00:00") => {
    const [h, m] = time.split(":").map(Number);
    return h * 60 + m;
  };

  // Given a total slot duration and a yacht's default split, return proportional sailing/anchoring hours.
  // Falls back to 50/50 if no defaults are set.
  const splitHoursForSlot = (totalHrs, yacht) => {
    const fmt = (v) => v % 1 === 0 ? String(v) : parseFloat(v.toFixed(2)).toString();
    const defSail  = parseFloat(yacht?.defaultSailingHours);
    const defAnch  = parseFloat(yacht?.defaultAnchoringHours);
    const hasDefaults = !isNaN(defSail) && !isNaN(defAnch) && (defSail + defAnch) > 0;
    if (hasDefaults) {
      const defTotal = defSail + defAnch;
      const sailRatio = defSail / defTotal;
      const sailHrs   = parseFloat((totalHrs * sailRatio).toFixed(2));
      const anchHrs   = parseFloat((totalHrs - sailHrs).toFixed(2));
      return { sailing: fmt(sailHrs), anchoring: fmt(anchHrs) };
    }
    // Fallback: 50/50
    const half = totalHrs / 2;
    return { sailing: fmt(half), anchoring: fmt(totalHrs - half) };
  };

  // Total slot duration in hours (decimal), e.g. 3.0 for a 3-hr slot
  const slotTotalHours = useMemo(() => {
    const start = customTimeEnabled ? customStart : formData.startTime;
    const end   = customTimeEnabled ? customEnd   : formData.endTime;
    if (!start || !end) return 0;
    const diff = hhmmToMinutes(end) - hhmmToMinutes(start);
    return diff > 0 ? diff / 60 : 0;
  }, [formData.startTime, formData.endTime, customStart, customEnd, customTimeEnabled]);

  // Auto-populate sailing/anchoring hours when arriving with prefilled slot data
  // (e.g. from Calendar view). Runs once yachts have loaded and prefill has start+end times.
  useEffect(() => {
    if (!prefill.startTime || !prefill.endTime || !prefill.yachtId) return;
    if (!yachts.length) return;
    // Only auto-fill if not already set (don't override manual edits)
    if (sailingHours !== "" || anchoringHours !== "") return;
    const yacht = yachts.find((y) => (y.id || y._id) === prefill.yachtId);
    if (!yacht) return;
    const totalMins = hhmmToMinutes(prefill.endTime) - hhmmToMinutes(prefill.startTime);
    const totalHrs  = totalMins / 60;
    if (totalHrs <= 0) return;
    const { sailing, anchoring } = splitHoursForSlot(totalHrs, yacht);
    setSailingHours(sailing);
    setAnchoringHours(anchoring);
  }, [yachts]);

  // Auto-calculate price whenever hours or yacht changes
  useEffect(() => {
    const yacht = yachts.find((y) => (y.id || y._id) === formData.yachtId);
    if (!yacht) return;
    const sHrs = parseFloat(sailingHours) || 0;
    const aHrs = parseFloat(anchoringHours) || 0;
    if (sHrs === 0 && aHrs === 0) { setCalculatedAmount(null); return; }
    const calc = (sHrs * (yacht.sailingCost || 0)) + (aHrs * (yacht.anchorageCost || 0));
    setCalculatedAmount(calc);
    // Pre-fill total amount only if it hasn't been manually touched
    setFormData((p) => ({ ...p, totalAmount: String(Math.round(calc)) }));
  }, [sailingHours, anchoringHours, formData.yachtId, yachts]);

  // Check if a slot overlaps any existing booking for the selected yacht/date
  const isSlotBooked = (slot, bookings) => {
    if (!bookings?.length) return false;
    const slotStart = hhmmToMinutes(slot.start);
    const slotEnd   = hhmmToMinutes(slot.end);
    return bookings.some((b) => {
      const bStart = hhmmToMinutes(b.startTime);
      const bEnd   = hhmmToMinutes(b.endTime);
      return slotStart < bEnd && slotEnd > bStart;
    });
  };

  // Check if custom start/end collides with any booking (excluding the slot's own time)
  const isCustomTimeColliding = (start, end, bookings) => {
    if (!start || !end || !bookings?.length) return false;
    const s = hhmmToMinutes(start);
    const e = hhmmToMinutes(end);
    if (e <= s) return false;
    return bookings.some((b) => {
      const bStart = hhmmToMinutes(b.startTime);
      const bEnd   = hhmmToMinutes(b.endTime);
      return s < bEnd && e > bStart;
    });
  };

  const to12Hour = (time24) => {
    if (!time24) return "";
    let [hour, minute] = time24.split(":").map(Number);
    hour = hour % 24;
    const period = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 === 0 ? 12 : hour % 12;
    return `${hour12}:${String(minute).padStart(2, "0")} ${period}`;
  };

  // Fetch yachts
  useEffect(() => {
    const fetchYachts = async () => {
      try {
        const token = localStorage.getItem("authToken");
        const date = formData.date;
        const res = await getAllYachtsAPI(token, date);
        const yachtList = Array.isArray(res?.data?.yachts)
          ? res.data.yachts
          : [];
        setYachts(yachtList);
      } catch (err) {
        console.error("Failed to fetch yachts:", err);
      }
    };
    if (formData.date) fetchYachts();
  }, [formData.date]);

  const buildSlotsForYacht = (yacht, selectedDate) => {
    if (!yacht) return [];

    const sailStart = yacht.sailStartTime;
    const sailEnd = yacht.sailEndTime;
    const durationRaw = yacht.slotDurationMinutes || yacht.duration;
    const specialSlots = yacht.specialSlots || [];

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

    const slotsForDate = yacht.slots?.find(
      (slotGroup) =>
        new Date(slotGroup.date).toDateString() ===
        new Date(selectedDate).toDateString()
    );

    if (slotsForDate && slotsForDate.slots?.length > 0) {
      return slotsForDate.slots
        .map((s) => ({ start: s.start, end: s.end }))
        .sort((a, b) => timeToMin(a.start) - timeToMin(b.start));
    }

    let duration = 0;
    if (typeof durationRaw === "string" && durationRaw.includes(":")) {
      const [h, m] = durationRaw.split(":").map(Number);
      duration = h * 60 + (m || 0);
    } else {
      duration = Number(durationRaw);
    }

    const startMin = timeToMin(sailStart);
    let endMin = timeToMin(sailEnd);
    const specialMins = specialSlots.map(timeToMin).sort((a, b) => a - b);

    if (endMin <= startMin) endMin += 24 * 60;
    if (sailEnd === "00:00") endMin = 24 * 60 - 1;

    const slots = [];
    let cursor = startMin;

    while (cursor < endMin) {
      const next = cursor + duration;
      const hit = specialMins.find((sp) => sp > cursor && sp < next);

      if (hit) {
        slots.push({ start: cursor, end: hit });
        cursor = hit;
      } else {
        slots.push({ start: cursor, end: next });
        cursor = next;
      }
    }

    return slots.map((s) => ({
      start: minToTime(s.start),
      end: minToTime(s.end),
    }));
  };

  useEffect(() => {
    const selectedYacht = yachts.find((y) => (y.id || y._id) === formData.yachtId);
    if (!selectedYacht) {
      setStartTimeOptions([]);
      return;
    }

    setRunningCost(selectedYacht.runningCost || 0);

    const slots = buildSlotsForYacht(selectedYacht, formData.date);
    const slotsWithStatus = slots.map((slot) => ({
      ...slot,
      isBooked: isSlotBooked(slot, selectedYacht.bookings),
    }));
    setStartTimeOptions(slotsWithStatus);
    setDaySlotList(slots); // keep full list (plain) for slot adjustment

    if (formData.startTime) {
      const match = slots.find((s) => s.start === formData.startTime);
      if (match) {
        setFormData((p) => ({ ...p, endTime: match.end }));
        // Auto-populate sailing/anchoring hours from prefilled slot
        const totalMins = hhmmToMinutes(match.end) - hhmmToMinutes(match.start);
        const totalHrs  = totalMins / 60;
        if (totalHrs > 0 && sailingHours === "" && anchoringHours === "") {
          const { sailing, anchoring } = splitHoursForSlot(totalHrs, selectedYacht);
          setSailingHours(sailing);
          setAnchoringHours(anchoring);
        }
      }
    }
  }, [formData.yachtId, yachts, formData.date]);

  useEffect(() => {
    const close = () => setShowSuggestions(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === "yachtId" || name === "date") {
      // Changing yacht or date invalidates the slot + all custom/pricing state
      setCustomTimeEnabled(false);
      setCustomStart("");
      setCustomEnd("");
      originalSlotRef.current = { start: "", end: "" };
      setSailingHours("");
      setAnchoringHours("");
      setCalculatedAmount(null);
      setFormData((p) => ({
        ...p,
        [name]: value,
        startTime: "",
        endTime: "",
        ...(name === "yachtId" ? {} : {}),
      }));
    } else {
      setFormData((p) => ({ ...p, [name]: value }));
    }
  };

  const handleStartSelect = (e) => {
    const start = e.target.value;
    const slot = startTimeOptions.find((s) => s.start === start);
    const idx = startTimeOptions.findIndex((s) => s.start === start);

    // Always reset custom mode when a new slot is picked
    setCustomTimeEnabled(false);
    setSelectedSlotIndex(idx);

    const slotStart = start;
    const slotEnd = slot ? slot.end : "";

    // Store original slot so Cancel can always restore cleanly
    originalSlotRef.current = { start: slotStart, end: slotEnd };

    // Seed custom fields with slot times (so Edit opens pre-filled correctly)
    setCustomStart(slotStart);
    setCustomEnd(slotEnd);
    setCalculatedAmount(null);

    // Prefill sailing/anchoring using yacht's default ratio (falls back to 50/50)
    if (slot) {
      const totalMins = hhmmToMinutes(slotEnd) - hhmmToMinutes(slotStart);
      const totalHrs = totalMins / 60;
      const yacht = yachts.find((y) => (y.id || y._id) === formData.yachtId);
      const { sailing, anchoring } = splitHoursForSlot(totalHrs, yacht);
      setSailingHours(sailing);
      setAnchoringHours(anchoring);
    } else {
      setSailingHours("");
      setAnchoringHours("");
    }

    setFormData((p) => ({
      ...p,
      startTime: slotStart,
      endTime: slotEnd,
    }));
  };

  const isAmountInvalid =
    formData.totalAmount &&
    runningCost &&
    Number(formData.totalAmount) < runningCost;

  const isCapacityExceeded =
    formData.numPeople &&
    yachts.find((y) => (y.id || y._id) === formData.yachtId)?.capacity &&
    Number(formData.numPeople) >
    yachts.find((y) => (y.id || y._id) === formData.yachtId).capacity;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const token = localStorage.getItem("authToken");
      // Recompute fresh inside handler — avoids stale closure from render
      const isQuotationNow = prefill.source === "bookings" && formData.bookingStatus !== "confirmed";

      const selectedYacht = yachts.find((y) => (y.id || y._id) === formData.yachtId);
      if (!selectedYacht) {
        alert("Please select a yacht first.");
        setLoading(false);
        return;
      }

      const { data } = await getCustomerByContactAPI(formData.contact, token);
      let customerId = data.customer?._id;

      if (!data.customer) {
        const payload = new FormData();
        for (let key in formData) payload.append(key, formData[key]);
        const res = await createCustomerAPI(payload, token);
        if (res?.data?.success) toast.success("New Customer Created!");
        customerId = res?.data?._id;
      }

      const extraDetails = `
Inclusions / Services:
${selectedExtras.map((i) => `- ${i}`).join("\n")}

${manualNotes ? `Notes:\n${manualNotes}` : ""}
`.trim();

      const bookingPayload = {
        customerId,
        employeeId: user?._id,
        yachtId: formData.yachtId,
        date: formData.date,
        startTime: formData.startTime,
        endTime: formData.endTime,
        quotedAmount: Number(formData.totalAmount),
        numPeople: Number(formData.numPeople),
        onBehalfEmployeeId: formData.onBehalfEmployeeId || null,
        extraDetails,
        ...(isAdmin && { bookingStatus: formData.bookingStatus }),
        ...(isQuotationNow && formData.tokenAmount && { tokenAmount: Number(formData.tokenAmount) }),
        // Dynamic pricing breakdown
        ...(sailingHours !== "" && { sailingHours: parseFloat(sailingHours) }),
        ...(anchoringHours !== "" && { anchoringHours: parseFloat(anchoringHours) }),
        ...(calculatedAmount !== null && { calculatedAmount }),
      };

      console.log("Booking payload : ", bookingPayload)

      // Guard: sailing + anchoring must add up to total slot hours
      const finalStartForCalc = customTimeEnabled ? customStart : formData.startTime;
      const finalEndForCalc   = customTimeEnabled ? customEnd   : formData.endTime;
      if (finalStartForCalc && finalEndForCalc) {
        const slotHrs = (hhmmToMinutes(finalEndForCalc) - hhmmToMinutes(finalStartForCalc)) / 60;
        const sHrs = parseFloat(sailingHours) || 0;
        const aHrs = parseFloat(anchoringHours) || 0;
        if (Math.abs(sHrs + aHrs - slotHrs) > 0.001) {
          setError(`Sailing + Anchoring hours must add up to ${slotHrs % 1 === 0 ? slotHrs : slotHrs.toFixed(1)} hrs (currently ${(sHrs + aHrs).toFixed(1)} hrs).`);
          setLoading(false);
          return;
        }
      }

      // Resolve final start/end: use custom if enabled, else use slot selection
      const finalStartTime = customTimeEnabled ? customStart : formData.startTime;
      const finalEndTime   = customTimeEnabled ? customEnd   : formData.endTime;

      // Guard: block submit if custom time is invalid
      if (customTimeEnabled) {
        if (hhmmToMinutes(finalStartTime) >= hhmmToMinutes(finalEndTime)) {
          setError("End time must be after start time.");
          setLoading(false);
          return;
        }
        const yacht = yachts.find((y) => (y.id || y._id) === formData.yachtId);
        if (isCustomTimeColliding(finalStartTime, finalEndTime, yacht?.bookings)) {
          setError("Custom time overlaps an existing booking. Please choose a different time.");
          setLoading(false);
          return;
        }
      }

      // Update payload with resolved times
      bookingPayload.startTime = finalStartTime;
      bookingPayload.endTime = finalEndTime;

      // If admin used custom time, update the day's slot layout before booking
      const originalSlot = startTimeOptions[selectedSlotIndex];
      const isTimeEdited = customTimeEnabled && originalSlot &&
        (finalStartTime !== originalSlot.start || finalEndTime !== originalSlot.end);

      if (isTimeEdited && selectedSlotIndex >= 0) {
        const updatedSlots = adjustSlots({
          allSlots: daySlotList,
          targetIndex: selectedSlotIndex,
          newStart: finalStartTime,
          newEnd: finalEndTime,
          durationMinutes: hhmmToMinutes(
            yachts.find((y) => (y.id || y._id) === formData.yachtId)?.slotDurationMinutes ||
            yachts.find((y) => (y.id || y._id) === formData.yachtId)?.duration || "120"
          ),
        });
        await updateDaySlots(
          formData.yachtId,
          formData.date,
          updatedSlots.map(({ start, end }) => ({ start, end })),
          token
        );
      }

      const response = await createBookingAPI(bookingPayload, token);
      const booking = response.data.booking;

      toast.success(isQuotationNow ? "Quotation created successfully!" : "Booking created successfully!");

      // Only trigger transaction for normal bookings, NOT quotations
      if (!isQuotationNow && response.data.success && formData.advanceAmount > 0) {
        await createTransactionAndUpdateBooking(
          {
            bookingId: booking._id,
            type: "advance",
            amount: formData.advanceAmount,
          },
          token
        );
      }

      // navigate("/bookings");
      navigate("/bookings", { state: { bookingId: booking._id } });
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create booking");
    } finally {
      setLoading(false);
    }
  };

  const handleNameTyping = (e) => {
    const token = localStorage.getItem("authToken");
    const value = e.target.value;

    setFormData((p) => ({ ...p, name: value }));
    clearTimeout(typingTimeoutRef.current);

    if (value.length < 2) {
      setCustomerSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    typingTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await searchCustomersByNameAPI(value, token);
        const customers = res?.data?.customers || [];
        setCustomerSuggestions(customers);
        setShowSuggestions(customers.length > 0);
      } catch {
        setCustomerSuggestions([]);
        setShowSuggestions(false);
      }
    }, 500);
  };

  const handleCustomerSelect = (customer) => {
    setFormData((p) => ({
      ...p,
      name: customer.name,
      contact: customer.contact || "",
      email: customer.email || "",
      govtId: customer.govtIdNo || "",
    }));
    setShowSuggestions(false);
  };

  const selectedYachtObj = yachts.find((y) => (y.id || y._id) === formData.yachtId);
  const isMobileView = typeof window !== "undefined" && window.innerWidth < 768;
  const pendingAmount = formData.totalAmount
    ? Math.max(0, Number(formData.totalAmount) - Number(formData.advanceAmount || 0))
    : null;

  return (
    <>
      {/* Loading overlay */}
      {loading && (
        <div style={{ position: "fixed", inset: 0, backdropFilter: "blur(4px)", background: "rgba(0,0,0,0.4)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 99999 }}>
          <div style={{ width: 44, height: 44, border: "3px solid rgba(255,255,255,0.2)", borderTopColor: "#1d6fa4", borderRadius: "50%", animation: "cb-spin 0.8s linear infinite" }} />
        </div>
      )}

      <style>{`
        @keyframes cb-spin { 100%{ transform:rotate(360deg); } }
        .cb-wrap * { box-sizing:border-box; }
        .cb-wrap { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; }

        .cb-inp {
          width:100%; padding:11px 13px; font-size:15px; font-weight:500;
          border:2px solid #94a3b8; border-radius:9px;
          background:#fff; color:#0f172a; outline:none;
          transition:border-color .18s, box-shadow .18s;
          font-family:inherit; line-height:1.4; -webkit-appearance:none;
        }
        .cb-inp:focus { border-color:#1d6fa4; box-shadow:0 0 0 3px rgba(29,111,164,.15); }
        .cb-inp.warn  { border-color:#d97706; background:#fffbeb; }
        .cb-inp.err   { border-color:#dc2626; background:#fef2f2; }
        .cb-inp::placeholder { color:#94a3b8; font-weight:400; }
        select.cb-inp { cursor:pointer; }

        .cb-lbl {
          display:block; font-size:13px; font-weight:700;
          color:#1e293b; margin-bottom:5px;
        }

        .cb-f { margin-bottom:14px; }
        .cb-f:last-child { margin-bottom:0; }

        .cb-sh {
          display:flex; align-items:center; gap:10px;
          font-size:14px; font-weight:800; color:#0f172a;
          margin:0 0 16px; padding-bottom:12px;
          border-bottom:2px solid #e2e8f0;
        }
        .cb-sh-dot {
          width:10px; height:10px; border-radius:50%; flex-shrink:0;
        }

        .cb-panel {
          background:#fff; border-radius:14px;
          border:2px solid #e2e8f0;
          box-shadow:0 2px 10px rgba(0,0,0,.08);
          padding:20px;
        }

        .cb-g2 { display:grid; grid-template-columns:1fr 1fr; gap:0 16px; }
        .cb-g1 { display:grid; grid-template-columns:1fr; gap:0; }
        .cb-span2 { grid-column: span 2; }
        @media(max-width:600px){
          .cb-g2 { grid-template-columns:1fr; }
          .cb-span2 { grid-column: span 1; }
        }

        .cb-chip {
          display:inline-flex; align-items:center; gap:6px;
          padding:8px 14px; border-radius:20px; font-size:13px; font-weight:600;
          border:2px solid #94a3b8; cursor:pointer;
          transition:all .15s; user-select:none; background:#f8fafc; color:#1e293b;
          white-space:nowrap;
        }
        .cb-chip:hover { border-color:#475569; background:#f1f5f9; }
        .cb-chip.g { background:#dcfce7; border-color:#16a34a; color:#14532d; }
        .cb-chip.a { background:#fef9c3; border-color:#ca8a04; color:#713f12; }

        .cb-ac {
          position:absolute; top:calc(100% + 4px); left:0; right:0;
          background:#fff; border:2px solid #e2e8f0; border-radius:10px;
          box-shadow:0 10px 30px rgba(0,0,0,.12); z-index:100; overflow:hidden;
        }
        .cb-ac-item { padding:11px 14px; cursor:pointer; border-bottom:1px solid #f1f5f9; transition:background .12s; }
        .cb-ac-item:last-child { border-bottom:none; }
        .cb-ac-item:hover { background:#eef4fb; }

        .cb-sumbar {
          display:flex; align-items:center; gap:8px; flex-wrap:wrap;
          background:#051829; border-radius:12px; padding:13px 16px;
          margin-bottom:16px;
        }
        .cb-sum-pill {
          display:flex; align-items:center; gap:5px;
          background:rgba(255,255,255,.1); border:1.5px solid rgba(255,255,255,.2);
          border-radius:20px; padding:5px 13px;
          font-size:13px; color:rgba(255,255,255,.7); font-weight:500;
        }
        .cb-sum-pill b { color:#fff; font-weight:700; }
        .cb-sum-empty { color:rgba(255,255,255,.3); font-size:13px; }

        .cb-pending {
          display:flex; justify-content:space-between; align-items:center;
          border-radius:10px; padding:13px 15px; margin-top:8px;
          background:#f0fdf4; border:2px solid #86efac;
        }
        .cb-pending.due { background:#fef2f2; border-color:#fca5a5; }
        .cb-pend-label { font-size:13px; font-weight:700; color:#374151; }
        .cb-pend-val { font-size:18px; font-weight:800; }

        .cb-submit {
          width:100%; padding:16px; font-size:17px; font-weight:800;
          background:#1d6fa4; color:#fff; border:none; border-radius:12px;
          cursor:pointer; transition:all .2s; letter-spacing:.3px;
          box-shadow:0 4px 18px rgba(13,74,110,.35);
        }
        .cb-submit:disabled { background:#94a3b8; box-shadow:none; cursor:not-allowed; }
        .cb-submit:not(:disabled):hover { background:#0d4a6e; transform:translateY(-2px); box-shadow:0 8px 24px rgba(13,74,110,.45); }

        .cb-err-msg { font-size:12px; font-weight:700; color:#dc2626; margin-top:5px; }
        .cb-warn-msg { font-size:12px; font-weight:700; color:#d97706; margin-top:5px; }

        .cb-ext-bar { display:flex; justify-content:space-between; align-items:center; cursor:pointer; user-select:none; }
        .cb-ext-toggle {
          display:inline-flex; align-items:center; gap:5px;
          font-size:12px; font-weight:700; padding:6px 14px;
          border-radius:20px; cursor:pointer; transition:all .15s;
          border:2px dashed #f59e0b;
          background:linear-gradient(135deg,#fffbeb,#fef3c7);
          color:#92400e;
          box-shadow:0 2px 6px rgba(245,158,11,.18);
        }
        .cb-ext-toggle:hover {
          background:linear-gradient(135deg,#fef3c7,#fde68a);
          box-shadow:0 3px 10px rgba(245,158,11,.28);
          transform:translateY(-1px);
        }
        .cb-ext-toggle.open {
          border:2px solid #94a3b8; border-style:solid;
          background:#f8fafc; color:#475569;
          box-shadow:none; transform:none;
        }
        .cb-ext-toggle.open:hover { background:#f1f5f9; }

        @media(max-width:600px){
          /* Inputs — tighter */
          .cb-inp { padding:8px 10px; font-size:13px; border-width:1.5px; border-radius:8px; }

          /* Labels */
          .cb-lbl { font-size:11px; margin-bottom:3px; }

          /* Field spacing */
          .cb-f { margin-bottom:10px; }

          /* Panels — less padding, lighter border */
          .cb-panel { padding:12px; border-width:1.5px; border-radius:12px; box-shadow:0 1px 4px rgba(0,0,0,.06); }

          /* Panel section header */
          .cb-sh { font-size:12px; margin-bottom:10px; padding-bottom:8px; }
          .cb-sh-dot { width:8px; height:8px; }

          /* Summary bar — compact single-line scroll */
          .cb-sumbar {
            padding:8px 10px; gap:5px; border-radius:10px;
            overflow-x:auto; flex-wrap:nowrap; margin-bottom:10px;
          }
          .cb-sum-pill { padding:3px 8px; font-size:11px; white-space:nowrap; flex-shrink:0; }

          /* Submit button */
          .cb-submit { padding:12px; font-size:15px; border-radius:10px; }

          /* Pending balance */
          .cb-pending { padding:9px 12px; }
          .cb-pend-val { font-size:15px; }

          /* Add-ons chips */
          .cb-chip { padding:5px 10px; font-size:11px; }

          /* Autocomplete */
          .cb-ac-item { padding:8px 11px; }
        }
      `}</style>


      <div className="cb-wrap" style={{ background: "#f8fafc", minHeight: "100dvh", padding: "8px" }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>

          {/* ── Header row ── */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <button className="btn-back-icon" onClick={() => navigate(-1)} title="Go back">
              <svg viewBox="0 0 20 20" fill="none"><path d="M12.5 5L7.5 10L12.5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
            <div>
              <div style={{ fontSize: "clamp(18px, 5vw, 26px)", fontWeight: 900, color: "#051829", lineHeight: 1.1 }}>{isQuotation ? "Create Quotation" : "Create Booking"}</div>
            </div>
          </div>

          {/* ── Error banner ── */}
          {error && (
            <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 14px", color: "#dc2626", fontSize: 13, marginBottom: 12 }}>
              ⚠ {error}
            </div>
          )}

          {/* ── Live summary bar ── */}
          <div className="cb-sumbar">
            {formData.name && <span className="cb-sum-pill">👤 <b>{formData.name}</b></span>}
            {formData.date && <span className="cb-sum-pill">📅 <b>{new Date(formData.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</b></span>}
            {selectedYachtObj && <span className="cb-sum-pill">⛵ <b>{selectedYachtObj.name}</b></span>}
            {formData.startTime && <span className="cb-sum-pill">🕐 <b>{to12Hour(formData.startTime)}–{to12Hour(formData.endTime)}</b></span>}
            {formData.numPeople && <span className="cb-sum-pill">👥 <b>{formData.numPeople} pax</b></span>}
            {formData.totalAmount && (
              <span className="cb-sum-pill" style={{ marginLeft: "auto" }}>
                💰 <b style={{ color: pendingAmount > 0 ? "#ef4444" : "#22c55e" }}>
                  ₹{Number(formData.totalAmount).toLocaleString("en-IN")}
                  {formData.advanceAmount ? ` · ₹${pendingAmount.toLocaleString("en-IN")} due` : ""}
                </b>
              </span>
            )}
            {isAdmin && (
              <span className="cb-sum-pill" style={{ background: isQuotation ? "rgba(139,92,246,.25)" : formData.bookingStatus === "confirmed" ? "rgba(22,163,74,.25)" : "rgba(217,119,6,.2)" }}>
                {isQuotation ? "📋" : formData.bookingStatus === "confirmed" ? "✓" : "⏳"} <b style={{ color: isQuotation ? "#e9d5ff" : formData.bookingStatus === "confirmed" ? "#bbf7d0" : "#fde68a" }}>{isQuotation ? "Quotation" : formData.bookingStatus === "confirmed" ? "Confirmed" : "Pending"}</b>
              </span>
            )}
            {!formData.name && !formData.date && <span style={{ color: "#b0bec5", fontSize: 12 }}>Fill in the form below…</span>}
          </div>

          {/* ── FORM ── */}
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 8 }}>

            {/* ROW 1: Customer + Booking side by side on desktop */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>

              {/* ── Customer panel ── */}
              <div className="cb-panel">
                <div className="cb-sh"><span className="cb-sh-dot" style={{ background: "#1d6fa4" }}></span>Customer</div>
                <div className="cb-g1">

                  <div className="cb-f" style={{ position: "relative" }}>
                    <label className="cb-lbl">Full Name</label>
                    <input className="cb-inp" type="text" name="name" value={formData.name}
                      onChange={handleNameTyping} autoComplete="off" required placeholder="Search or type name" />
                    {showSuggestions && customerSuggestions.length > 0 && (
                      <div className="cb-ac">
                        {customerSuggestions.map((c) => (
                          <div key={c._id} className="cb-ac-item" onClick={() => handleCustomerSelect(c)}>
                            <div style={{ fontWeight: 600, fontSize: 13, color: "#1e293b" }}>{c.name}</div>
                            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 1 }}>{c.contact} · {c.email}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="cb-f">
                    <label className="cb-lbl">Contact</label>
                    <input className="cb-inp" type="tel" name="contact" value={formData.contact}
                      onChange={handleChange} required placeholder="+91 00000 00000" />
                  </div>

                  <div className="cb-f">
                    <label className="cb-lbl">Email <span style={{ color: "#b0bec5", textTransform: "lowercase", fontWeight: 400 }}>opt.</span></label>
                    <input className="cb-inp" type="email" name="email" value={formData.email}
                      onChange={handleChange} placeholder="email@example.com" />
                  </div>

                  <div className="cb-f">
                    <label className="cb-lbl">Govt. ID <span style={{ color: "#b0bec5", textTransform: "lowercase", fontWeight: 400 }}>opt.</span></label>
                    <input className="cb-inp" type="text" name="govtId" value={formData.govtId}
                      onChange={handleChange} placeholder="Aadhar / Passport" />
                  </div>
                </div>
              </div>

              {/* ── Booking details panel ── */}
              <div className="cb-panel">
                <div className="cb-sh"><span className="cb-sh-dot" style={{ background: "#c9a84c" }}></span>Booking Details</div>
                <div className="cb-g2">

                  <div className="cb-f">
                    <label className="cb-lbl">Date</label>
                    <input className="cb-inp" type="date" name="date"
                      min={new Date().toISOString().split("T")[0]}
                      value={formData.date} onChange={handleChange} required />
                  </div>

                  <div className="cb-f">
                    <label className="cb-lbl">Yacht</label>
                    <select className="cb-inp" name="yachtId" value={formData.yachtId} onChange={handleChange} required>
                      <option value="">— Select —</option>
                      {yachts.map((y) => <option key={y.id || y._id} value={y.id || y._id}>{y.name}</option>)}
                    </select>
                  </div>

                  <div className="cb-f">
                    <label className="cb-lbl">
                      Time Slot
                      {customTimeEnabled && <span style={{ fontSize: 10, color: "#94a3b8", marginLeft: 6, fontWeight: 400 }}>overridden by custom</span>}
                    </label>
                    <select
                      className="cb-inp"
                      name="startTime"
                      value={formData.startTime}
                      onChange={handleStartSelect}
                      required
                      disabled={customTimeEnabled}
                      style={{ opacity: customTimeEnabled ? 0.4 : 1, cursor: customTimeEnabled ? "not-allowed" : "pointer" }}
                    >
                      <option value="">— Select —</option>
                      {startTimeOptions.map((opt, i) => (
                        <option key={i} value={opt.start} disabled={opt.isBooked}>
                          {to12Hour(opt.start)} – {to12Hour(opt.end)}{opt.isBooked ? " (booked)" : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="cb-f">
                    <label className="cb-lbl">Guests</label>
                    <input className={`cb-inp ${isCapacityExceeded ? "warn" : ""}`} type="number"
                      name="numPeople" value={formData.numPeople} onChange={handleChange}
                      required placeholder="0" min="1" />
                    {isCapacityExceeded && (
                      <div className="cb-warn-msg">⚠ Exceeds cap ({yachts.find(y => (y.id || y._id) === formData.yachtId)?.capacity})</div>
                    )}
                  </div>

                  {/* ── Admin custom time override ── */}
                  {isAdmin && formData.startTime && (
                    <div className="cb-f cb-span2">
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                        <label className="cb-lbl" style={{ margin: 0 }}>
                          Custom Time
                          <span style={{ color: "#94a3b8", fontWeight: 400, fontSize: 11, marginLeft: 6 }}>opt. — override selected slot</span>
                        </label>
                        <button
                          type="button"
                          style={{
                            fontSize: 11, padding: "2px 10px", borderRadius: 6,
                            border: customTimeEnabled ? "1.5px solid #dc2626" : "1.5px solid #1d6fa4",
                            background: customTimeEnabled ? "#fef2f2" : "#eef4fb",
                            color: customTimeEnabled ? "#dc2626" : "#1d6fa4",
                            cursor: "pointer", fontWeight: 600
                          }}
                          onClick={() => {
                            if (customTimeEnabled) {
                              // Cancel: restore everything back to the original slot
                              const { start, end } = originalSlotRef.current;
                              setCustomStart(start);
                              setCustomEnd(end);
                              setFormData(p => ({ ...p, startTime: start, endTime: end }));
                              // Reset sailing/anchoring to original slot ratio
                              if (start && end && hhmmToMinutes(start) < hhmmToMinutes(end)) {
                                const totalHrs = (hhmmToMinutes(end) - hhmmToMinutes(start)) / 60;
                                const yacht = yachts.find((y) => (y.id || y._id) === formData.yachtId);
                                const { sailing, anchoring } = splitHoursForSlot(totalHrs, yacht);
                                setSailingHours(sailing);
                                setAnchoringHours(anchoring);
                              }
                            } else {
                              // Open: seed custom inputs with current slot times
                              setCustomStart(formData.startTime);
                              setCustomEnd(formData.endTime);
                            }
                            setCustomTimeEnabled(p => !p);
                          }}
                        >
                          {customTimeEnabled ? "✕ Cancel" : "✎ Edit"}
                        </button>
                      </div>
                      {customTimeEnabled && (
                        (() => {
                          const selectedYacht = yachts.find((y) => (y.id || y._id) === formData.yachtId);
                          const isInvalidTime = customStart && customEnd && hhmmToMinutes(customStart) >= hhmmToMinutes(customEnd);
                          const hasCollision  = !isInvalidTime && isCustomTimeColliding(customStart, customEnd, selectedYacht?.bookings);
                          const hasError = isInvalidTime || hasCollision;
                          const errorBorder = hasError ? "2px solid #dc2626" : undefined;
                          const errorBg     = hasError ? "#fef2f2" : undefined;
                          const labelColor  = hasError ? "#dc2626" : "#64748b";
                          const labelWeight = hasError ? 700 : 400;
                          return (
                            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                              <div>
                                <label style={{ fontSize:11, color: labelColor, display:"block", marginBottom:3, fontWeight: labelWeight }}>Start Time</label>
                                <input
                                  className="cb-inp"
                                  type="time"
                                  value={customStart}
                                  style={{ border: errorBorder, background: errorBg }}
                                  onChange={(e) => {
                                    const newStart = e.target.value;
                                    setCustomStart(newStart);
                                    if (newStart && customEnd && hhmmToMinutes(newStart) < hhmmToMinutes(customEnd)) {
                                      const totalHrs = (hhmmToMinutes(customEnd) - hhmmToMinutes(newStart)) / 60;
                                      const yacht = yachts.find((y) => (y.id || y._id) === formData.yachtId);
                                      const { sailing, anchoring } = splitHoursForSlot(totalHrs, yacht);
                                      setSailingHours(sailing);
                                      setAnchoringHours(anchoring);
                                    }
                                  }}
                                />
                              </div>
                              <div>
                                <label style={{ fontSize:11, color: labelColor, display:"block", marginBottom:3, fontWeight: labelWeight }}>End Time</label>
                                <input
                                  className="cb-inp"
                                  type="time"
                                  value={customEnd}
                                  style={{ border: errorBorder, background: errorBg }}
                                  onChange={(e) => {
                                    const newEnd = e.target.value;
                                    setCustomEnd(newEnd);
                                    if (customStart && newEnd && hhmmToMinutes(customStart) < hhmmToMinutes(newEnd)) {
                                      const totalHrs = (hhmmToMinutes(newEnd) - hhmmToMinutes(customStart)) / 60;
                                      const yacht = yachts.find((y) => (y.id || y._id) === formData.yachtId);
                                      const { sailing, anchoring } = splitHoursForSlot(totalHrs, yacht);
                                      setSailingHours(sailing);
                                      setAnchoringHours(anchoring);
                                    }
                                  }}
                                />
                              </div>
                              {isInvalidTime ? (
                                <div style={{ gridColumn:"span 2", fontSize:11, color:"#dc2626", background:"#fef2f2", border:"1px solid #fca5a5", borderRadius:6, padding:"5px 8px", fontWeight:600 }}>
                                  ⛔ End time must be after start time.
                                </div>
                              ) : hasCollision ? (
                                <div style={{ gridColumn:"span 2", fontSize:11, color:"#dc2626", background:"#fef2f2", border:"1px solid #fca5a5", borderRadius:6, padding:"5px 8px", fontWeight:600 }}>
                                  ⛔ This time overlaps an existing booking — please choose a different time.
                                </div>
                              ) : (
                                <div style={{ gridColumn:"span 2", fontSize:11, color:"#92400e", background:"#fffbeb", border:"1px solid #fde68a", borderRadius:6, padding:"5px 8px" }}>
                                  ⚠ Slot layout for this date will be updated to reflect the custom time.
                                </div>
                              )}
                            </div>
                          );
                        })()
                      )}
                    </div>
                  )}

                  {/* ── Sailing / Anchoring hours (shown once slot is selected) ── */}
                  {formData.yachtId && (formData.startTime || (customTimeEnabled && customStart && customEnd)) && (() => {
                    const yacht = yachts.find((y) => (y.id || y._id) === formData.yachtId);
                    const sHrs = parseFloat(sailingHours) || 0;
                    const aHrs = parseFloat(anchoringHours) || 0;
                    const totalEntered = sHrs + aHrs;
                    const isUnder = slotTotalHours > 0 && totalEntered > 0 && totalEntered < slotTotalHours - 0.001;
                    return (
                      <>
                        <div className="cb-f">
                          <label className="cb-lbl">
                            Sailing Hrs
                            {yacht?.sailingCost > 0 && <span style={{ color: "#64748b", fontWeight: 400, fontSize: 11, marginLeft: 5 }}>₹{Number(yacht.sailingCost).toLocaleString("en-IN")}/hr</span>}
                          </label>
                          <input
                            className="cb-inp"
                            type="number" step="0.5" min="0"
                            max={slotTotalHours || undefined}
                            placeholder="0"
                            required
                            value={sailingHours}
                            onChange={(e) => {
                              const raw = parseFloat(e.target.value);
                              const clamped = slotTotalHours > 0 ? Math.min(raw, slotTotalHours) : raw;
                              const val = isNaN(clamped) ? "" : (clamped % 1 === 0 ? String(clamped) : clamped.toFixed(1));
                              setSailingHours(val);
                              if (slotTotalHours > 0 && val !== "") {
                                const remaining = Math.max(0, slotTotalHours - parseFloat(val));
                                setAnchoringHours(remaining % 1 === 0 ? String(remaining) : remaining.toFixed(1));
                              }
                            }}
                          />
                        </div>
                        <div className="cb-f">
                          <label className="cb-lbl">
                            Anchoring Hrs
                            {yacht?.anchorageCost > 0 && <span style={{ color: "#64748b", fontWeight: 400, fontSize: 11, marginLeft: 5 }}>₹{Number(yacht.anchorageCost).toLocaleString("en-IN")}/hr</span>}
                          </label>
                          <input
                            className="cb-inp"
                            type="number" step="0.5" min="0"
                            max={slotTotalHours || undefined}
                            placeholder="0"
                            required
                            value={anchoringHours}
                            onChange={(e) => {
                              const raw = parseFloat(e.target.value);
                              const clamped = slotTotalHours > 0 ? Math.min(raw, slotTotalHours) : raw;
                              const val = isNaN(clamped) ? "" : (clamped % 1 === 0 ? String(clamped) : clamped.toFixed(1));
                              setAnchoringHours(val);
                              if (slotTotalHours > 0 && val !== "") {
                                const remaining = Math.max(0, slotTotalHours - parseFloat(val));
                                setSailingHours(remaining % 1 === 0 ? String(remaining) : remaining.toFixed(1));
                              }
                            }}
                          />
                        </div>
                        {/* Inline hint */}
                        {isUnder && (
                          <div className="cb-span2" style={{ fontSize: 11, color: "#92400e", marginTop: -8 }}>
                            ⚠ {(slotTotalHours - totalEntered).toFixed(1)} hrs unaccounted
                          </div>
                        )}
                        {calculatedAmount !== null && (sHrs > 0 || aHrs > 0) && !isUnder && (
                          <div className="cb-span2" style={{ fontSize: 12, color: "#15803d", fontWeight: 600, marginTop: -6 }}>
                            ₹{Math.round(calculatedAmount).toLocaleString("en-IN")} calculated → pre-filled below
                          </div>
                        )}
                      </>
                    );
                  })()}

                  {isAdmin && (
                    <div className="cb-f cb-span2">
                      <label className="cb-lbl">On Behalf Of</label>
                      <select className="cb-inp" name="onBehalfEmployeeId" value={formData.onBehalfEmployeeId} onChange={handleChange}>
                        {employees.map((emp) => <option key={emp._id} value={emp._id}>{emp.name}</option>)}
                      </select>
                    </div>
                  )}

                  {isAdmin && (
                    <div className="cb-f cb-span2">
                      <label className="cb-lbl">Booking Status</label>
                      <select className="cb-inp" name="bookingStatus" value={formData.bookingStatus} onChange={handleChange}>
                        <option value="pending">Pending</option>
                        <option value="confirmed">Confirmed</option>
                      </select>
                    </div>
                  )}
                </div>


              </div>
            </div>

            {/* ROW 2: Payment + Extras side by side on desktop */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>

              {/* ── Payment panel ── */}
              <div className="cb-panel">
                <div className="cb-sh"><span className="cb-sh-dot" style={{ background: "#16a34a" }}></span>Payment</div>
                <div className="cb-g2">
                  <div className="cb-f">
                    <label className="cb-lbl">
                      Total Amount
                      {runningCost > 0 && <span style={{ color: "#64748b", fontWeight: 500, marginLeft: 6, fontSize: 12, textTransform: "none" }}>min ₹{Number(runningCost).toLocaleString("en-IN")}</span>}
                    </label>
                    <input className={`cb-inp ${isAmountInvalid ? "err" : ""}`} type="number"
                      name="totalAmount" value={formData.totalAmount} onChange={handleChange}
                      required placeholder="₹ 0" />
                    {isAmountInvalid && <div className="cb-err-msg">⚠ Below running cost ₹{Number(runningCost).toLocaleString("en-IN")}</div>}
                  </div>

                  {isQuotation ? (
                    <div className="cb-f">
                      <label className="cb-lbl">Token Amount <span style={{ color: "#b0bec5", textTransform: "lowercase", fontWeight: 400 }}>opt.</span></label>
                      <input className="cb-inp" type="number" name="tokenAmount" value={formData.tokenAmount}
                        onChange={handleChange} placeholder="₹ 0" />
                      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>Amount customer should pay as token to confirm</div>
                    </div>
                  ) : (
                    <div className="cb-f">
                      <label className="cb-lbl">Advance <span style={{ color: "#b0bec5", textTransform: "lowercase", fontWeight: 400 }}>opt.</span></label>
                      <input className="cb-inp" type="number" name="advanceAmount" value={formData.advanceAmount}
                        onChange={handleChange} placeholder="₹ 0" />
                    </div>
                  )}
                </div>

                {!isQuotation && pendingAmount !== null && (
                  <div className={`cb-pending ${pendingAmount > 0 ? "due" : ""}`}>
                    <span className="cb-pend-label">Pending Balance</span>
                    <span className="cb-pend-val" style={{ color: pendingAmount > 0 ? "#dc2626" : "#16a34a" }}>
                      ₹{pendingAmount.toLocaleString("en-IN")}
                    </span>
                  </div>
                )}
              </div>

              {/* ── Extras panel ── */}
              <div className="cb-panel">
                <div className="cb-ext-bar" onClick={() => setShowExtraDetails(p => !p)}>
                  <div className="cb-sh" style={{ margin: 0, border: "none", padding: 0 }}>
                    <span className="cb-sh-dot" style={{ background: "#f59e0b" }}></span>Add-ons & Notes
                  </div>
                  <button type="button" className={`cb-ext-toggle ${showExtraDetails ? "open" : ""}`}>
                    {showExtraDetails ? (
                      <>
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
                        Collapse
                      </>
                    ) : (
                      <>
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
                        Add
                      </>
                    )}
                  </button>
                </div>

                {!showExtraDetails && (
                  <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 5 }}>
                    {selectedExtras.map(ex => (
                      <span key={ex} style={{
                        fontSize: 11, padding: "2px 8px", borderRadius: 12, fontWeight: 500,
                        background: extraOptions.paidServices.includes(ex) ? "#fffbeb" : "#f0fdf4",
                        color: extraOptions.paidServices.includes(ex) ? "#92400e" : "#15803d",
                        border: `1px solid ${extraOptions.paidServices.includes(ex) ? "#fde68a" : "#bbf7d0"}`,
                      }}>{ex}</span>
                    ))}
                  </div>
                )}

                {showExtraDetails && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "#16a34a", letterSpacing: ".5px", marginBottom: 8 }}>✓ INCLUDED SERVICES</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                      {extraOptions.inclusions.map((item) => (
                        <div key={item} className={`cb-chip ${selectedExtras.includes(item) ? "g" : ""}`}
                          onClick={() => handleExtraToggle(item)}>
                          {selectedExtras.includes(item) ? "✓" : "+"} {item}
                        </div>
                      ))}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "#d97706", letterSpacing: ".5px", marginBottom: 8 }}>★ PAID ADD-ONS</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                      {extraOptions.paidServices.map((item) => (
                        <div key={item} className={`cb-chip ${selectedExtras.includes(item) ? "a" : ""}`}
                          onClick={() => handleExtraToggle(item)}>
                          {selectedExtras.includes(item) ? "★" : "+"} {item}
                        </div>
                      ))}
                    </div>
                    <div className="cb-f">
                      <label className="cb-lbl">Notes</label>
                      <textarea className="cb-inp" rows={2} style={{ resize: "none" }}
                        placeholder="Special requests, decoration, snacks…"
                        value={manualNotes} onChange={(e) => setManualNotes(e.target.value)} />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ── Submit ── */}
            <button type="submit" className="cb-submit" disabled={loading}>
              {loading ? (isQuotation ? "Creating Quotation…" : "Creating Booking…") : (isQuotation ? "📋 Create Quotation" : "✓ Create Booking")}
            </button>

          </form>
        </div>
      </div>
    </>
  );
}

export default CreateBooking;