import React, { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { getBookingsAPI } from "../services/operations/bookingAPI";
import { socket } from "../socket";
import { getEmployeesForBookingAPI } from "../services/operations/employeeAPI";
import { createTransactionAndUpdateBooking } from "../services/operations/transactionAPI";
import { FiSliders } from "react-icons/fi";
import { Eye, Copy, Phone, GlassWater, Bell, Pencil, Star } from "lucide-react";
import toast from "react-hot-toast";

import "bootstrap/dist/css/bootstrap.min.css";
import "./Bookings.css";

/* ── Cache helpers ── */
const BK_CACHE_TTL = 90 * 1000; // 90 seconds

// User-specific prefix — prevents cached booking data from leaking across accounts
const getBkUserPrefix = () => {
  try { return JSON.parse(localStorage.getItem("user") || "{}")?._id || "anon"; } catch { return "anon"; }
};

const bkGetCached = (key) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    if (Date.now() - ts > BK_CACHE_TTL) { localStorage.removeItem(key); return null; }
    return data;
  } catch { return null; }
};

const bkSetCache = (key, data) => {
  try { localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data })); } catch {}
};

const bkCacheKey = (filters) =>
  `bk_${getBkUserPrefix()}_` + JSON.stringify(Object.fromEntries(Object.entries(filters).sort()));

/* ── Skeleton card ── */
const BookingSkeletonCard = () => (
  <div className="col-lg-4 col-md-6 mb-3">
    <div className="card border-0 shadow-sm h-100 border-start border-4 bk-skel-card">
      <div className="card-body p-3">
        <div className="d-flex justify-content-between align-items-start mb-2">
          <div style={{ flex: 1 }}>
            <div className="bk-skel-line" style={{ width: "55%", height: 14, marginBottom: 6 }} />
            <div className="bk-skel-line" style={{ width: "80%", height: 11 }} />
          </div>
          <div className="bk-skel-line" style={{ width: 60, height: 22, borderRadius: 999 }} />
        </div>
        <hr className="my-2" />
        <div className="bk-skel-line" style={{ width: "70%", height: 11, marginBottom: 6 }} />
        <div className="bk-skel-line" style={{ width: "60%", height: 11, marginBottom: 6 }} />
        <div className="bk-skel-line" style={{ width: "65%", height: 11, marginBottom: 6 }} />
        <div className="bk-skel-line" style={{ width: "40%", height: 11, marginBottom: 10 }} />
        <div className="d-flex gap-2 mt-1">
          <div className="bk-skel-line" style={{ width: 34, height: 34, borderRadius: "50%" }} />
          <div className="bk-skel-line" style={{ width: 34, height: 34, borderRadius: "50%" }} />
          <div className="bk-skel-line" style={{ flex: 1, height: 34, borderRadius: 999 }} />
          <div className="bk-skel-line" style={{ flex: 1, height: 34, borderRadius: 999 }} />
        </div>
      </div>
    </div>
  </div>
);

// ── Shared IST helper: converts any UTC timestamp string to "YYYY-MM-DD" in IST ──
// Uses the browser's Intl engine via toLocaleString — avoids the
// getTimezoneOffset() double-correction bug that was in the original code.
const toISTDateStr = (utcStr) => {
  const d = new Date(new Date(utcStr).toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

function Bookings({ user }) {
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const rangeParam = params.get("range");
  const createdParam = params.get("created");

  // ---------------- IST HELPERS ----------------
  // Returns current time as a plain Date whose numeric value equals IST wall-clock time.
  const getNowIST = () => {
    return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  };

  // Returns "YYYY-MM-DD" string in IST for today
  const getTodayIST = () => {
    const now = getNowIST();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  // Returns "YYYY-MM" string in IST for current month
  const getMonthIST = () => getTodayIST().slice(0, 7);

  // Returns a Date at midnight IST for a given YYYY-MM-DD string
  const toMidnightIST = (dateStr) => {
    return new Date(`${dateStr}T00:00:00+05:30`);
  };

  // ---------------- STATE ----------------
  const [bookings, setBookings] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);

  // Screen
  const [isMobile, setIsMobile] = useState(window.innerWidth < 550);
  const [showFilters, setShowFilters] = useState(false);

  // ---------------- FILTER STATES (FROM URL) ----------------
  const [searchQuery, setSearchQuery] = useState(params.get("search") || "");
  const [filterDate, setFilterDate] = useState(params.get("date") || "");
  const [filterStatus, setFilterStatus] = useState(params.get("status") || "");
  const [selectedMonth, setSelectedMonth] = useState(params.get("month") || "");

  const employeeParam = params.get("employee");
  const parsedEmployeeId = employeeParam?.split("~")[1] || "";
  const [filterEmployee, setFilterEmployee] = useState(parsedEmployeeId);
  const [dateMode, setDateMode] = useState(params.get("date") ? "date" : "month");

  // Custom calendar picker (desktop filter bar)
  const calRef = useRef(null);
  const [showCalendar, setShowCalendar] = useState(false);
  // Custom calendar picker (mobile filter drawer)
  const calMobileRef = useRef(null);
  const [showCalendarMobile, setShowCalendarMobile] = useState(false);
  // Shared calendar view state
  const [calYear, setCalYear]   = useState(() => filterDate ? parseInt(filterDate.slice(0,4))   : new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(() => filterDate ? parseInt(filterDate.slice(5,7))-1 : new Date().getMonth());

  const [expandedAddons, setExpandedAddons] = useState({});

  // ── Feedback sent tracking (keyed by booking._id, persisted in localStorage) ──
  const [feedbackSentIds, setFeedbackSentIds] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem("ga_feedbackSent") || "[]")); }
    catch { return new Set(); }
  });

  /* ── Reminder 30-min cooldown (keyed by booking._id → timestamp) ── */
  const REMINDER_KEY         = "bk_reminder_ts";
  const REMINDER_COOLDOWN_MS = 30 * 60 * 1000;
  const [reminderTs, setReminderTs] = useState(() => {
    try { return JSON.parse(localStorage.getItem(REMINDER_KEY) || "{}"); }
    catch { return {}; }
  });
  // Re-read every 30 s so buttons auto-enable after cooldown expires
  useEffect(() => {
    const id = setInterval(() => {
      try { setReminderTs(JSON.parse(localStorage.getItem(REMINDER_KEY) || "{}")); }
      catch {}
    }, 30000);
    return () => clearInterval(id);
  }, []);
  const isReminderCooling = (id) => {
    const ts = reminderTs[id];
    return !!ts && Date.now() - ts < REMINDER_COOLDOWN_MS;
  };
  const reminderMinLeft = (id) => {
    const ts = reminderTs[id];
    if (!ts) return 0;
    return Math.max(1, Math.ceil((REMINDER_COOLDOWN_MS - (Date.now() - ts)) / 60000));
  };

  // ---------------- ADDON PARSER ----------------
  const ADDON_CONFIG = [
    { key: "drone", label: "Drone", match: "Drone", paid: true },
    { key: "dslr", label: "DSLR", match: "DSLR", paid: true },
    { key: "softdrink", label: "Soft Drink", match: "Soft Drink", paid: false },
    { key: "icecube", label: "Ice Cube", match: "Ice Cube", paid: false },
    { key: "water", label: "Water", match: "Water Bottles", paid: false },
    { key: "speaker", label: "Speaker", match: "Bluetooth Speaker", paid: false },
    { key: "crew", label: "Crew", match: "Captain", paid: false },
    { key: "snacks", label: "Snacks", match: "Snacks", paid: false },
    { key: "balloon", label: "Balloon", match: "Balloon", paid: true },
    { key: "decoration", label: "Decoration", match: "decoration", paid: true },
    { key: "cake", label: "Cake", match: "cake", paid: true },
  ];

  const parseAddons = (extraDetails = "") => {
    const text = extraDetails.toLowerCase();
    const seen = new Set();
    const all = ADDON_CONFIG.filter(({ key, match }) => {
      if (text.includes(match.toLowerCase()) && !seen.has(key)) {
        seen.add(key);
        return true;
      }
      return false;
    });
    return {
      paid: all.filter((a) => a.paid),
      included: all.filter((a) => !a.paid),
    };
  };

  const toggleAddons = (bookingId) =>
    setExpandedAddons((prev) => ({ ...prev, [bookingId]: !prev[bookingId] }));

  // ---------------- COLORS ----------------
  const statusColorMap = {
    pending: "info",
    confirmed: "success",
    cancelled: "danger",
    completed: "primary",
  };

  // ---------------- SCREEN RESIZE ----------------
  useEffect(() => {
    const onResize = () => {
      const mobile = window.innerWidth < 550;
      setIsMobile(mobile);
      if (!mobile) setShowFilters(false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Sync calendar view when filterDate changes externally (e.g. cleared)
  useEffect(() => {
    if (filterDate) {
      setCalYear(parseInt(filterDate.slice(0, 4)));
      setCalMonth(parseInt(filterDate.slice(5, 7)) - 1);
    }
  }, [filterDate]);

  // Close calendar on outside click (desktop)
  useEffect(() => {
    if (!showCalendar) return;
    const handler = (e) => {
      if (calRef.current && !calRef.current.contains(e.target)) setShowCalendar(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showCalendar]);

  // Close calendar on outside click (mobile)
  useEffect(() => {
    if (!showCalendarMobile) return;
    const handler = (e) => {
      if (calMobileRef.current && !calMobileRef.current.contains(e.target)) setShowCalendarMobile(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showCalendarMobile]);

  // ---------------- HELPERS ----------------
  const to12HourFormat = (time24) => {
    if (!time24) return "";
    let [hour, minute] = time24.split(":").map(Number);
    const period = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 === 0 ? 12 : hour % 12;
    return `${hour12}:${String(minute).padStart(2, "0")} ${period}`;
  };

  const getDuration = (start, end) => {
    if (!start || !end) return "";
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    const mins = (eh * 60 + em) - (sh * 60 + sm);
    if (mins <= 0) return "";
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h && m ? `${h}h ${m}m` : h ? `${h}h` : `${m}m`;
  };

  const getEmployeeParamValue = () => {
    if (!filterEmployee) return "";
    const emp = employees.find((e) => e._id === filterEmployee);
    return emp ? `${encodeURIComponent(emp.name)}~${emp._id}` : "";
  };

  // ---------------- CALENDAR HELPERS ----------------
  const CAL_MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const CAL_MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const CAL_DAYS = ["Su","Mo","Tu","We","Th","Fr","Sa"];

  const navigateCalMonth = (dir) => {
    let m = calMonth + dir, y = calYear;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setCalMonth(m); setCalYear(y);
  };

  const buildCalCells = () => {
    const firstDay = new Date(calYear, calMonth, 1).getDay();
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  };

  const formatCalLabel = (dateStr) => {
    if (!dateStr) return "";
    const [, m, d] = dateStr.split("-");
    return `${parseInt(d)} ${CAL_MONTHS_SHORT[parseInt(m) - 1]}`;
  };

  // A booking is "completed" when its end time has already passed (in IST)
  const isBookingCompleted = (booking) => {
    if (!booking.date || !booking.endTime) return false;
    const bookingDateIST = booking.date.split("T")[0];
    const bookingEnd = new Date(`${bookingDateIST}T${booking.endTime}:00+05:30`);
    return bookingEnd < getNowIST();
  };

  // ---------------- FETCH EMPLOYEES ----------------
  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const token = localStorage.getItem("authToken");
        const res = await getEmployeesForBookingAPI(token);
        setEmployees(res?.data?.employees || []);
      } catch (e) {
        console.error("❌ Failed to load employees", e);
      }
    };
    fetchEmployees();
  }, []);

  // ---------------- FETCH BOOKINGS ----------------
  const fetchBookings = async (filters = {}) => {
    const key = bkCacheKey(filters);
    const cached = bkGetCached(key);

    if (cached) {
      // Show cached data instantly — no spinner
      setBookings(cached);
      setLoading(false);
    } else {
      // No cache yet — show skeleton
      setLoading(true);
    }

    // Always revalidate in background (silently if cache hit)
    try {
      const token = localStorage.getItem("authToken");
      const res = await getBookingsAPI(token, filters);
      // NOTE: we do NOT mutate status to "completed" here — we keep the raw DB status
      // and derive completion purely via isBookingCompleted() in the filter pipeline.
      const data = res?.data?.bookings || [];
      setBookings(data);
      bkSetCache(key, data);
    } catch (e) {
      console.error("❌ Error fetching bookings", e);
      if (!cached) setBookings([]);
    } finally {
      setLoading(false);
    }
  };

  // ---------------- SYNC URL PARAMS ----------------
  useEffect(() => {
    const p = new URLSearchParams(location.search);

    if (rangeParam) p.set("range", rangeParam); else p.delete("range");
    if (createdParam) p.set("created", createdParam); else p.delete("created");
    if (searchQuery) p.set("search", searchQuery); else p.delete("search");
    if (filterDate) p.set("date", filterDate); else p.delete("date");
    if (filterStatus) p.set("status", filterStatus); else p.delete("status");
    if (selectedMonth) p.set("month", selectedMonth); else p.delete("month");

    const employeeValue = getEmployeeParamValue();
    if (employeeValue) p.set("employee", employeeValue); else p.delete("employee");

    navigate({ search: p.toString() }, { replace: true });
  }, [
    searchQuery, filterDate, filterStatus, filterEmployee,
    selectedMonth, employees, rangeParam, createdParam,
  ]);

  // Clear date/month when navigating via 7-days range
  useEffect(() => {
    if (rangeParam === "7days") {
      setSelectedMonth("");
      setFilterDate("");
    }
  }, [rangeParam]);

  // ---------------- TRIGGER FETCH ----------------
  useEffect(() => {
    const filters = {};

    if (filterDate) filters.date = filterDate;

    // "completed" is derived client-side from endTime, not a real DB status, so don't pass it
    if (filterStatus && filterStatus !== "completed") {
      filters.status = filterStatus;
    }

    if (filterEmployee) filters.employeeId = filterEmployee;

    if (selectedMonth && !filterDate && rangeParam !== "7days" && createdParam !== "today") {
      filters.month = selectedMonth;
    }

    if (rangeParam === "7days") {
      const today = getTodayIST();
      const next7 = new Date(`${today}T00:00:00+05:30`);
      next7.setDate(next7.getDate() + 7);
      filters.startDate = today;
      filters.endDate = next7.toISOString().slice(0, 10);
    }

    if (createdParam === "today") {
      // Do NOT send createdToday to server — server filters by UTC date which may
      // differ from IST date (e.g. bookings created 11pm–midnight UTC = next day IST).
      // Instead, fetch the current month and filter client-side, exactly as the dashboard does.
      filters.month = getMonthIST();
    }

    fetchBookings(filters);
  }, [
    filterDate, filterStatus, filterEmployee,
    location.state?.refresh, rangeParam, createdParam, selectedMonth,
  ]);

  // ---------------- AUTO SEARCH FROM NOTIFICATION ----------------
  useEffect(() => {
    if (location.state?.bookingId || location.state?.status) {
      setSearchQuery(location.state.bookingId?.slice(-5) || "");
      setFilterStatus(location.state.status || "");
      navigate(".", { replace: true, state: {} });
    }
  }, [location.state?.refresh]);

  // ---------------- REAL-TIME UPDATES ----------------
  // Bust cache and re-fetch when a booking event arrives via socket
  const bustAndRefetch = useCallback(() => {
    try {
      Object.keys(localStorage).filter(k => k.startsWith("bk_")).forEach(k => localStorage.removeItem(k));
    } catch {}
    const filters = {};
    if (filterDate) filters.date = filterDate;
    if (filterStatus && filterStatus !== "completed") filters.status = filterStatus;
    if (filterEmployee) filters.employeeId = filterEmployee;
    if (selectedMonth && !filterDate) filters.month = selectedMonth;
    fetchBookings(filters);
  }, [filterDate, filterStatus, filterEmployee, selectedMonth]);

  useEffect(() => {
    const onBookingEvent = () => bustAndRefetch();
    socket.on("booking:new",       onBookingEvent);
    socket.on("booking:updated",   onBookingEvent);
    socket.on("booking:cancelled", onBookingEvent);
    socket.on("booking:confirmed", onBookingEvent);
    return () => {
      socket.off("booking:new",       onBookingEvent);
      socket.off("booking:updated",   onBookingEvent);
      socket.off("booking:cancelled", onBookingEvent);
      socket.off("booking:confirmed", onBookingEvent);
    };
  }, [bustAndRefetch]);

  // Refresh when the user returns to this tab (stale after 60s)
  useEffect(() => {
    let lastVisible = Date.now();
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        if (Date.now() - lastVisible > 60_000) bustAndRefetch();
      } else {
        lastVisible = Date.now();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [bustAndRefetch]);

  // ---------------- ACTIONS ----------------
  const handleClear = () => {
    setSearchQuery("");
    setFilterDate("");
    setFilterStatus("");
    setFilterEmployee("");
    setSelectedMonth("");
    navigate("/bookings", { replace: true });
  };

  const generateBoardingPass = (booking) => {
    const formatDate = (dateStr) => {
      const d = new Date(dateStr);
      return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
    };
    const formatTime = (time24) => {
      let [h, m] = time24.split(":").map(Number);
      const period = h >= 12 ? "PM" : "AM";
      h = h % 12 || 12;
      return `${h}.${m.toString().padStart(2, "0")} ${period}`;
    };

    const tokenPaid = booking.quotedAmount - booking.pendingAmount;
    const tokenAmount = booking?.tokenAmount;

    const sanitizeText = (text = "") =>
      text
        .replace(/\u2022|\u2023|\u25E6/g, "-")
        .replace(/\u200B|\u200C|\u200D|\uFEFF/g, "")
        .replace(/\r\n/g, "\n")
        .replace(/\n{2,}/g, "\n")
        .trim();

    const extraDetails = sanitizeText(booking.extraDetails || "");
    const lines = extraDetails.split("\n").map((l) => l.trim()).filter(Boolean);

    const inclusions = lines.filter((i) =>
      ["Soft Drink", "Ice Cube", "Water Bottles", "Bluetooth Speaker", "Captain", "Snacks"]
        .some((k) => i.includes(k))
    );
    const paidServices = lines.filter((i) =>
      ["Drone - Photography & Videography", "DSLR Photography"].some((k) => i.includes(k))
    );
    const notes = extraDetails.includes("Notes:")
      ? extraDetails.split("Notes:").slice(1).join("Notes:").trim()
      : "";

    const isPending = booking.status === "pending";

    const hardCodedDisclaimer = `Disclaimer:\n• Reporting time is 30 minutes prior to departure\n• No refund for late arrival or no-show\n• Subject to weather and government regulations\nThank you for booking with ${booking.company?.name}`;

    const isCancelledBP = booking.status === "cancelled";

    const boardingPassText = isCancelledBP
      ? `# Ticket Number: Voided\nBooking Status: Cancelled\nGuest Name: ${booking.customerId?.name}\nContact No.: ${booking.customerId?.contact}\nGroup Size: ${booking.numPeople} Pax\nYacht Name: ${booking.yachtId?.name}\n\nTrip Date: ${formatDate(booking.date)} | ⏰ Time: ${formatTime(booking.startTime)} to ${formatTime(booking.endTime)}\n(${booking.sailingHours ?? 1} Hour Sailing + ${booking.anchoringHours ?? 1} Hour Anchor)`
      : (`# Ticket Number: ${booking._id.slice(-5).toUpperCase()}\n\nBooking Status: ${booking.status.toUpperCase()}${isPending
          ? "\n⚠️ NOTE: This is a TENTATIVE booking. Your slot is NOT yet confirmed. Please confirm by paying Token Amount."
          : ""
        }\n\n👤 Guest Name: ${booking.customerId?.name}\n📞 Contact No.: ${booking.customerId?.contact}\n👥 Group Size: ${booking.numPeople
        } Pax\n⛵ Yacht Name: ${booking.yachtId?.name}\n\n🗓️ Trip Date: ${formatDate(booking.date)} | ⏰ Time: ${formatTime(
          booking.startTime
        )} to ${formatTime(booking.endTime)}\n(${booking.sailingHours ?? 1} Hour Sailing + ${booking.anchoringHours ?? 1} Hour Anchor)\n\nBooking Price: ₹${booking.quotedAmount}/-\n${isPending && tokenAmount ? `\nToken to be Paid: ₹${tokenAmount}/- (Please share screenshot Over WhatsApp)` : ""
        }${!isPending
          ? `\nToken Paid: ₹${tokenPaid}/-\nBalance Pending: ₹${booking.pendingAmount}/- (to be collected before boarding)`
          : ""
        }\n\n📍 Boarding Location\n🔗 ${isPending ? "Will be shared upon confirmation" : booking.yachtId?.boardingLocation || "Location not provided"
        }\n\n${inclusions.length
          ? `Extra Inclusions:\n${inclusions.map((i) => `• ${i.replace("-", "").trim()}`).join("\n")}`
          : ""
        }\n${paidServices.length
          ? `\nExtra Add On's Services:\n${paidServices.map((i) => `• ${i.replace("-", "").trim()}`).join("\n")}`
          : ""
        }\n${notes ? `\nNotes:\n• ${notes.replace(/\n/g, "\n• ")}` : ""}`.trim() +
        `\n\n${booking?.company?.disclaimer
          ? `${booking.company.disclaimer}[${booking._id.slice(-5).toUpperCase()}]\n\nThank You`
          : hardCodedDisclaimer
        }\n`);

    navigator.clipboard.writeText(boardingPassText);
    toast.success("Boarding Pass copied to clipboard");
  };

  const handleViewDetails = (booking) => navigate("/customer-details", { state: { booking } });

  const handleShareWhatsApp = (booking, e) => {
    e.stopPropagation();

    const baseUrl = "https://goaboat.com";
    const ticketNumber = booking._id.slice(-5).toUpperCase();
    const customerName = booking.customerId?.name || "Customer";
    const passLink = `${baseUrl}/?ticket=${ticketNumber}`;
    const companyName = booking.company?.name || "GoaYachtWorld";
    const yachtName = booking.yachtId?.name || "your yacht";
    const tripDate = booking.date?.split("T")[0];

    const formatDate = (dateStr) => {
      const d = new Date(dateStr);
      return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
    };
    const formatTime = (time24) => {
      if (!time24) return "";
      let [h, m] = time24.split(":").map(Number);
      const period = h >= 12 ? "PM" : "AM";
      h = h % 12 || 12;
      return `${h}.${m.toString().padStart(2, "0")} ${period}`;
    };
    const sanitizeText = (text = "") =>
      text
        .replace(/\u2022|\u2023|\u25E6/g, "-")
        .replace(/\u200B|\u200C|\u200D|\uFEFF/g, "")
        .replace(/\r\n/g, "\n")
        .replace(/\n{2,}/g, "\n")
        .trim();

    const tokenPaid = booking.quotedAmount - booking.pendingAmount;
    const extraDetails = sanitizeText(booking.extraDetails || "");
    const lines = extraDetails.split("\n").map((l) => l.trim()).filter(Boolean);

    const inclusions = lines.filter((i) =>
      ["Soft Drink", "Ice Cube", "Water Bottles", "Bluetooth Speaker", "Captain", "Snacks"].some((k) => i.includes(k))
    );
    const paidServices = lines.filter((i) =>
      ["Drone - Photography & Videography", "DSLR Photography"].some((k) => i.includes(k))
    );
    const notesRaw = extraDetails.includes("Notes:")
      ? extraDetails.split("Notes:").slice(1).join("Notes:").trim()
      : "";

    const boardingLocation = booking.yachtId?.boardingLocation || "Location not provided";
    const disclaimer = booking?.company?.disclaimer
      ? `${booking.company.disclaimer}[${ticketNumber}]\n\nThank You`
      : `Terms & Conditions: \n- Please reach 10mins before boarding time at the boarding point.\n- Token amount is not refundable in case of no show or cancellation from guest side. \n- Full refundable if cancelled from yacht owners side due to change in weather conditions or technical issues.\n- You will have to do full payment before boarding to authorised person and can read more about terms & conditions https://goayachtworld.com/condtions .\nFind your ticket details at https://goaboat.com/ with ticket id :[${ticketNumber}]\n\nThank You`;

    const isCancelled = booking.status === "cancelled";
    const isPendingWA  = booking.status === "pending";

    const message = isCancelled
      ? `# Ticket Number: Voided\nBooking Status: Cancelled\nGuest Name: ${booking.customerId?.name}\nContact No.: ${booking.customerId?.contact}\nGroup Size: ${booking.numPeople} Pax\nYacht Name: ${yachtName}\n\nTrip Date: ${formatDate(booking.date)} | ⏰ Time: ${formatTime(booking.startTime)} to ${formatTime(booking.endTime)}\n(${booking.sailingHours ?? 1} Hour Sailing + ${booking.anchoringHours ?? 1} Hour Anchor)`
      : `Hi ${customerName}! \n\nThank you for booking with ${companyName} \n\nYour boarding pass for ${yachtName} on ${tripDate} is ready.\n${passLink}\n\n\nBooking summary\nTicket Number: ${ticketNumber}\n\nBooking Status: ${booking.status.toUpperCase()}\n\nGuest Name: ${booking.customerId?.name}\nContact No.: ${booking.customerId?.contact}\nGroup Size: ${booking.numPeople} Pax\nYacht Name: ${yachtName}\n\nTrip Date: ${formatDate(booking.date)} | Time: ${formatTime(booking.startTime)} to ${formatTime(booking.endTime)}\n(${booking.sailingHours ?? 1} Hour Sailing + ${booking.anchoringHours ?? 1} Hour Anchor)\n\nBooking Price: Rs.${booking.quotedAmount}/-\n\nToken Paid: Rs.${tokenPaid}/-\nBalance Pending: Rs.${booking.pendingAmount}/- (to be collected before boarding)\n\nBoarding Location\n${isPendingWA ? "Location will be shared once booking is confirmed" : boardingLocation}` +
        (inclusions.length ? `\n\nExtra Inclusions:\n${inclusions.map((i) => `* ${i.replace(/^-/, "").trim()}`).join("\n")}` : "") +
        (paidServices.length ? `\n\nExtra Add On's Services:\n${paidServices.map((i) => `* ${i.replace(/^-/, "").trim()}`).join("\n")}` : "") +
        (notesRaw ? `\n\nNotes:\n* ${notesRaw.replace(/\n/g, "\n* ")}` : "") +
        `\n\n${disclaimer}`;

    let phone = booking.customerId?.contact?.replace(/\D/g, "");
    if (phone && !phone.startsWith("91") && phone.length === 10) phone = "91" + phone;
    const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.open(waUrl, "_blank");
  };

  const handleCreateBooking = () => navigate("/create-booking", { state: { source: "bookings" } });

  const handleCompleteTrip = async (booking) => {
    const token = localStorage.getItem("authToken");
    try {
      const data = new FormData();
      data.append("bookingId", booking._id);
      data.append("type", "settlement");
      data.append("status", "confirmed");
      // Record the pending balance as a final payment (amount = pendingAmount, even if 0)
      data.append("amount", booking.pendingAmount > 0 ? booking.pendingAmount : 0);
      await createTransactionAndUpdateBooking(data, token);
      toast.success("Trip marked as complete ✅");
      // Refresh list
      setBookings((prev) =>
        prev.map((b) =>
          b._id === booking._id
            ? { ...b, status: "confirmed" }
            : b
        )
      );
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to complete trip");
    }
  };

  const handleFeedback = (booking) => {
    const name    = booking.company?.name || "Goa Yacht World";
    const contact = booking.customerId?.contact || "";
    const message =
`Hello Sir / Madam,
Hope you had a great experience with ${name}. Please do share your reviews along with some Photos to help us grow our business online. Your genuine review will help us to grow and serve better.

https://g.page/r/CVph5Ry_zbBlEBE/review

Thank you,
Goa Yacht World
☎️ +91-84462 75985 / 84462 05985
www.goayachtworld.com`;

    const wa = `https://wa.me/91${contact}?text=${encodeURIComponent(message)}`;
    window.open(wa, "_blank");

    // Mark as sent
    setFeedbackSentIds((prev) => {
      const next = new Set(prev);
      next.add(booking._id);
      try { localStorage.setItem("ga_feedbackSent", JSON.stringify([...next])); } catch {}
      return next;
    });
  };

  const handleReminder = (booking) => {
    const customerName  = booking.customerId?.name || "Guest";
    const date          = booking.date ? new Date(booking.date).toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short", year: "numeric" }) : "—";
    const time          = `${to12HourFormat(booking.startTime)} – ${to12HourFormat(booking.endTime)}`;
    const pax           = booking.numPeople || 0;
    const balance       = booking.pendingAmount > 0 ? `₹${booking.pendingAmount}` : "NIL";
    const boardingPoint = booking.yachtId?.boardingLocation || "our boarding point";
    const adminPhone    = "+91-84462 75985 / 84462 05985";
    const adminEmail    = "info@goayachtworld.com";

    const message =
`Hello ${customerName},

This is to remind you about your upcoming trip.

Date: ${date}, Time: ${time} with Pax count ${pax} | Pending Balance: ${balance}

Please reach before 10 minutes for the booked time slot at the Boarding point: ${boardingPoint}

Any query please contact us at: ${adminPhone} or email us at: ${adminEmail}

Wish you a safe and comfortable trip.
Thank you 🛥️
Goa Yacht World`;

    const contact = booking.customerId?.contact?.replace(/\D/g, "") || "";
    const phone   = contact.length === 10 ? "91" + contact : contact;

    // Stamp cooldown timestamp
    const next = { ...reminderTs, [booking._id]: Date.now() };
    setReminderTs(next);
    localStorage.setItem(REMINDER_KEY, JSON.stringify(next));

    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, "_blank");
  };

  // ---------------- FILTER PIPELINE ----------------
  const filteredBookings = bookings

    // ── 0️⃣  Date / Range / Month filter ──
    .filter((booking) => {
      const bookingDate = booking.date?.split("T")[0]; // "YYYY-MM-DD"

      // "New Today": show ALL non-cancelled bookings created today in IST,
      // including completed ones — matches dashboard's createdToday count exactly.
      if (createdParam === "today") {
        const createdIST = toISTDateStr(booking.createdAt);
        return createdIST === getTodayIST() && booking.status !== "cancelled";
      }

      // 7-day range: strictly after today midnight up to +7 days (matches dashboard count)
      if (rangeParam === "7days") {
        const todayMidnightIST = toMidnightIST(getTodayIST());
        const next7Days = new Date(todayMidnightIST);
        next7Days.setDate(todayMidnightIST.getDate() + 7);
        const bookingDateIST = toMidnightIST(bookingDate);
        return bookingDateIST > todayMidnightIST && bookingDateIST <= next7Days;
      }

      // Specific date
      if (filterDate) return bookingDate === filterDate;

      // No month selected → show everything
      if (!selectedMonth) return true;

      // Month filter
      return bookingDate.slice(0, 7) === selectedMonth;
    })

    // ── 1️⃣  Status filter ──
    .filter((booking) => {
      const completed = isBookingCompleted(booking);

      if (filterStatus === "completed") {
        return booking.status !== "cancelled" && completed;
      }

      if (filterStatus === "confirmed") {
        return booking.status === "confirmed" && !completed;
      }

      if (filterStatus === "pending") {
        return booking.status === "pending" && !completed;
      }

      if (filterStatus === "cancelled") {
        return booking.status === "cancelled";
      }

      // No status filter:
      // - When browsing by specific date OR created=today: show ALL non-cancelled
      //   (including completed) so the count matches the dashboard stat exactly.
      // - In all other views (month, 7days, no filter): hide completed so the list
      //   only shows actionable/active bookings.
      if (filterDate || createdParam === "today") {
        return booking.status !== "cancelled";
      }

      return booking.status !== "cancelled" && !completed;
    })

    // ── 2️⃣  Search filter ──
    .filter((booking) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        booking.customerId?.name?.toLowerCase().includes(q) ||
        booking.customerId?.contact?.includes(q) ||
        booking._id.toLowerCase().includes(q) ||
        booking._id.slice(-5).toLowerCase().includes(q) ||
        booking.yachtId?.name?.toLowerCase().includes(q)
      );
    })

    // ── 3️⃣  Sort by date → start time → yacht name ──
    .sort((a, b) => {
      const dateDiff = new Date(a.date) - new Date(b.date);
      if (dateDiff !== 0) return dateDiff;
      const timeDiff = a.startTime.localeCompare(b.startTime);
      if (timeDiff !== 0) return timeDiff;
      return a.yachtId?.name?.localeCompare(b.yachtId?.name);
    });

  // ---------------- MONTH NAVIGATOR HELPERS ----------------
  const navigateMonth = (dir) => {
    const src = selectedMonth || getMonthIST();
    const base = new Date(`${src}-01T00:00:00+05:30`);
    base.setMonth(base.getMonth() + dir);
    const y = base.getFullYear();
    const m = String(base.getMonth() + 1).padStart(2, "0");
    setSelectedMonth(`${y}-${m}`);
    setFilterDate("");
  };

  const monthDisplayLabel = () => {
    const src = selectedMonth || getMonthIST();
    const d = new Date(`${src}-01T00:00:00+05:30`);
    return d.toLocaleString("en-GB", { month: "short", year: "2-digit" });
  };

  // ---------------- RENDER ----------------
  return (
    <div className="container mt-1 pb-2">
      {/* Mobile header: count badge + quotation button (only on mobile) */}
      {isMobile && (
        <div className="d-flex justify-content-between align-items-center mb-3">
          <span className="booking-count-badge">Total Bookings: {filteredBookings.length}</span>
          {(user?.type === "admin" || user?.type === "backdesk") && (
            <button className="btn-new-quotation" onClick={handleCreateBooking} title="New Quotation">Q</button>
          )}
        </div>
      )}

      {/* Desktop / Tablet Filter Bar (includes count badge + quotation button on the right) */}
      {!isMobile && (
        <div className="bk-filter-bar">

          {/* Month navigator */}
          <div className="bk-month-nav">
            <button className="bk-month-arrow" onClick={() => navigateMonth(-1)} title="Previous month">‹</button>
            <span className="bk-month-label">{monthDisplayLabel()}</span>
            <button className="bk-month-arrow" onClick={() => navigateMonth(1)} title="Next month">›</button>
          </div>

          {/* Custom date picker */}
          <div ref={calRef} style={{ position: "relative", flexShrink: 0 }}>
            <button
              className={`bk-cal-trigger${filterDate ? " active" : ""}`}
              onClick={() => setShowCalendar((v) => !v)}
              title="Filter by date"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              <span className="bk-cal-label">{filterDate ? formatCalLabel(filterDate) : "Date"}</span>
              {filterDate && (
                <span className="bk-cal-clear" onClick={(e) => { e.stopPropagation(); setFilterDate(""); setSelectedMonth(getMonthIST()); setShowCalendar(false); }}>×</span>
              )}
            </button>

            {showCalendar && (
              <div className="bk-cal-panel">
                {/* Header */}
                <div className="bk-cal-hdr">
                  <button className="bk-cal-nav" onClick={() => navigateCalMonth(-1)}>‹</button>
                  <span className="bk-cal-month-label">{CAL_MONTHS[calMonth]} {calYear}</span>
                  <button className="bk-cal-nav" onClick={() => navigateCalMonth(1)}>›</button>
                </div>
                {/* Day headers */}
                <div className="bk-cal-weekdays">
                  {CAL_DAYS.map((d) => <span key={d}>{d}</span>)}
                </div>
                {/* Days grid */}
                <div className="bk-cal-grid">
                  {buildCalCells().map((day, i) => {
                    if (!day) return <div key={`e-${i}`} />;
                    const ds = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                    const isSel = filterDate === ds;
                    const isTdy = getTodayIST() === ds;
                    return (
                      <button
                        key={ds}
                        className={`bk-cal-day${isSel ? " sel" : ""}${isTdy && !isSel ? " tdy" : ""}`}
                        onClick={() => { setFilterDate(ds); setSelectedMonth(""); setShowCalendar(false); }}
                      >{day}</button>
                    );
                  })}
                </div>
                {/* Footer */}
                <div className="bk-cal-footer">
                  <button onClick={() => { setFilterDate(getTodayIST()); setSelectedMonth(""); setShowCalendar(false); }}>Today</button>
                  {filterDate && <button onClick={() => { setFilterDate(""); setSelectedMonth(getMonthIST()); setShowCalendar(false); }}>Clear</button>}
                </div>
              </div>
            )}
          </div>

          {/* Search */}
          <div className="bk-search-wrap">
            <span className="bk-search-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            </span>
            <input
              className="bk-search-inp"
              type="text"
              placeholder="Name / Phone / Ticket"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button className="bk-search-clr" onClick={() => setSearchQuery("")}>×</button>
            )}
          </div>

          {/* Status pills */}
          <div className="bk-status-pills">
            {[
              { value: "", label: "All", color: "#64748b", activeBg: "#475569" },
              { value: "pending", label: "Pending", color: "#d97706", activeBg: "#d97706" },
              { value: "confirmed", label: "Confirmed", color: "#16a34a", activeBg: "#16a34a" },
              { value: "completed", label: "Completed", color: "#2563eb", activeBg: "#2563eb" },
              { value: "cancelled", label: "Cancelled", color: "#dc2626", activeBg: "#dc2626" },
            ].map(({ value, label, color, activeBg }) => (
              <button
                key={value}
                className={`bk-status-pill${filterStatus === value ? " active" : ""}`}
                style={{ "--sp-color": color, "--sp-active-bg": activeBg }}
                onClick={() => setFilterStatus(value)}
              >
                {value && <span className="bk-sp-dot" style={{ background: filterStatus === value ? "rgba(255,255,255,0.85)" : color }} />}
                {label}
              </button>
            ))}
          </div>

          {/* Agent dropdown */}
          {employees.length > 0 && (
            <select
              className={`bk-agent-sel${filterEmployee ? " active" : ""}`}
              value={filterEmployee}
              onChange={(e) => setFilterEmployee(e.target.value)}
            >
              <option value="">All Agents</option>
              {employees.map((emp) => (
                <option key={emp._id} value={emp._id}>{emp.name}</option>
              ))}
            </select>
          )}

          {/* Clear */}
          {(searchQuery || filterDate || filterStatus || filterEmployee || selectedMonth) && (
            <button className="bk-clear-btn" onClick={handleClear} title="Clear all filters">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
              Clear
            </button>
          )}

          {/* Spacer + count badge + Quotation button pushed to the right */}
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <span className="booking-count-badge" style={{ whiteSpace: "nowrap" }}>
              {filteredBookings.length} bookings
            </span>
            {(user?.type === "admin" || user?.type === "backdesk") && (
              <button className="btn-new-quotation" onClick={handleCreateBooking} title="New Quotation">Q</button>
            )}
          </div>
        </div>
      )}

      {/* Mobile search + filter icon */}
      {isMobile && (
        <div className="d-flex align-items-center gap-2 mb-3">
          <div className="filter-input-wrapper" style={{ flex: 1 }}>
            <span className="filter-icon">🔍</span>
            <input
              type="text"
              className="form-control filter-input"
              placeholder="Name / Ticket / Phone"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: "2rem" }}
            />
            {searchQuery && (
              <button className="filter-clear-x" onClick={() => setSearchQuery("")} title="Clear search">✕</button>
            )}
          </div>

          <button
            className={`btn mobile-filter-btn ${[filterDate, filterStatus, filterEmployee, selectedMonth].filter(Boolean).length > 0 ? "has-active" : ""}`}
            onClick={() => setShowFilters(true)}
            title="Open filters"
          >
            <FiSliders size={20} />
            {[filterDate, filterStatus, filterEmployee, selectedMonth].filter(Boolean).length > 0 && (
              <span className="filter-badge">
                {[filterDate, filterStatus, filterEmployee, selectedMonth].filter(Boolean).length}
              </span>
            )}
          </button>
        </div>
      )}

      {/* Mobile filter drawer */}
      {isMobile && showFilters && (
        <div className="mobile-filter-backdrop" onClick={() => setShowFilters(false)}>
          <div className="mobile-filter-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-handle" />
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h6 className="mb-0 fw-semibold">Filters</h6>
              {[filterDate, filterStatus, filterEmployee, selectedMonth].filter(Boolean).length > 0 && (
                <button className="btn btn-link btn-sm p-0 text-danger text-decoration-none" onClick={handleClear}>
                  Clear all
                </button>
              )}
            </div>

            <div className="date-combined-filter mb-3">
              <div className="date-mode-toggle">
                <button
                  className={`date-mode-btn${dateMode === "month" ? " active" : ""}`}
                  onClick={() => { setDateMode("month"); setFilterDate(""); }}
                >Month</button>
                <button
                  className={`date-mode-btn${dateMode === "date" ? " active" : ""}`}
                  onClick={() => { setDateMode("date"); setSelectedMonth(""); }}
                >Specific</button>
              </div>
              {dateMode === "month" ? (
                <select
                  className={`form-select date-combined-input ${selectedMonth ? "filter-active" : ""}`}
                  value={selectedMonth}
                  onChange={(e) => { setSelectedMonth(e.target.value); setShowFilters(false); }}
                >
                  <option value="">All months</option>
                  {Array.from({ length: 6 }).map((_, i) => {
                    const base = getNowIST();
                    base.setMonth(base.getMonth() + i);
                    const value = base.toISOString().slice(0, 7);
                    const label = base.toLocaleString("en-GB", { month: "long", year: "numeric" });
                    return <option key={value} value={value}>{label}</option>;
                  })}
                </select>
              ) : (
                <div ref={calMobileRef} style={{ position: "relative" }}>
                  <button
                    className={`bk-cal-trigger w-100${filterDate ? " active" : ""}`}
                    style={{ justifyContent: "flex-start", width: "100%" }}
                    onClick={() => setShowCalendarMobile((v) => !v)}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                    </svg>
                    <span className="bk-cal-label" style={{ flex: 1, textAlign: "left" }}>
                      {filterDate ? formatCalLabel(filterDate) : "Pick a date"}
                    </span>
                    {filterDate && (
                      <span className="bk-cal-clear" onClick={(e) => { e.stopPropagation(); setFilterDate(""); setSelectedMonth(getMonthIST()); setShowCalendarMobile(false); }}>×</span>
                    )}
                  </button>

                  {showCalendarMobile && (
                    <div className="bk-cal-panel bk-cal-panel--mobile">
                      <div className="bk-cal-hdr">
                        <button className="bk-cal-nav" onClick={() => navigateCalMonth(-1)}>‹</button>
                        <span className="bk-cal-month-label">{CAL_MONTHS[calMonth]} {calYear}</span>
                        <button className="bk-cal-nav" onClick={() => navigateCalMonth(1)}>›</button>
                      </div>
                      <div className="bk-cal-weekdays">
                        {CAL_DAYS.map((d) => <span key={d}>{d}</span>)}
                      </div>
                      <div className="bk-cal-grid">
                        {buildCalCells().map((day, i) => {
                          if (!day) return <div key={`em-${i}`} />;
                          const ds = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                          const isSel = filterDate === ds;
                          const isTdy = getTodayIST() === ds;
                          return (
                            <button
                              key={ds}
                              className={`bk-cal-day${isSel ? " sel" : ""}${isTdy && !isSel ? " tdy" : ""}`}
                              onClick={() => { setFilterDate(ds); setSelectedMonth(""); setShowCalendarMobile(false); setShowFilters(false); }}
                            >{day}</button>
                          );
                        })}
                      </div>
                      <div className="bk-cal-footer">
                        <button onClick={() => { setFilterDate(getTodayIST()); setSelectedMonth(""); setShowCalendarMobile(false); setShowFilters(false); }}>Today</button>
                        {filterDate && <button onClick={() => { setFilterDate(""); setSelectedMonth(getMonthIST()); setShowCalendarMobile(false); }}>Clear</button>}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <label className="form-label small text-muted mb-1">Agent</label>
            <select
              className={`form-select mb-3 ${filterEmployee ? "filter-active" : ""}`}
              value={filterEmployee}
              onChange={(e) => { setFilterEmployee(e.target.value); setShowFilters(false); }}
            >
              <option value="">All Agents</option>
              {employees.map((emp) => (
                <option key={emp._id} value={emp._id}>{emp.name}</option>
              ))}
            </select>

            <label className="form-label small text-muted mb-1">Status</label>
            <div className="status-pill-group mb-4">
              {[
                { value: "", label: "All", color: "#6c757d" },
                { value: "pending", label: "Pending", color: "#0dcaf0" },
                { value: "confirmed", label: "Confirmed", color: "#198754" },
                { value: "completed", label: "Completed", color: "#0d6efd" },
                { value: "cancelled", label: "Cancelled", color: "#dc3545" },
              ].map(({ value, label, color }) => (
                <button
                  key={value}
                  className={`status-pill ${filterStatus === value ? "active" : ""}`}
                  style={{ "--pill-color": color }}
                  onClick={() => { setFilterStatus(value); setShowFilters(false); }}
                >
                  {label}
                </button>
              ))}
            </div>

            <button className="btn btn-primary w-100 rounded-pill" onClick={() => setShowFilters(false)}>
              Show {filteredBookings.length} Bookings
            </button>
          </div>
        </div>
      )}

      {/* Booking cards */}
      {loading ? (
        <div className="row">
          {Array.from({ length: 6 }).map((_, i) => <BookingSkeletonCard key={i} />)}
        </div>
      ) : (
        <div className="row">
          {filteredBookings.length > 0 ? (
            filteredBookings.map((booking) => {
              // Derive display status: show "completed" if end time has passed, else use DB status
              const displayStatus = isBookingCompleted(booking) ? "completed" : booking.status;
              const statusColor = statusColorMap[displayStatus] || "info";

              // ── MOBILE CARD (compact) ────────────────────────────
              if (isMobile) {
                const statusHex = { info: "#0dcaf0", success: "#198754", danger: "#dc3545", primary: "#0d6efd" }[statusColor] || "#0dcaf0";
                const { paid: mPaid, included: mIncluded } = parseAddons(booking.extraDetails);
                const mHasAddons = mPaid.length || mIncluded.length;
                const mIsOpen = expandedAddons[booking._id];
                const S = { fontSize: "0.72rem", color: "#64748b" };
                return (
                  <div key={booking._id} className="col-12 mb-2">
                    <div style={{ background: "#fff", borderRadius: 10, borderLeft: `3px solid ${statusHex}`, boxShadow: "0 1px 6px rgba(5,24,41,0.08)", overflow: "hidden" }}>

                      {/* ─ ROW 1: name · pax  |  ticket · status ─ */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px 2px", gap: 8 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, flex: 1 }}>
                          <span style={{ fontWeight: 700, fontSize: "0.88rem", color: "#0a2d4a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{booking.customerId?.name}</span>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: "0.7rem", color: "#475569", fontWeight: 600, flexShrink: 0, marginLeft: 4, lineHeight: 1 }}>
                            <span style={{ fontSize: "0.78rem", display: "inline-flex", alignItems: "center" }}>👥</span>
                            <span>{booking.numPeople}</span>
                          </span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                          <span style={{ fontSize: "0.65rem", color: "#94a3b8", fontWeight: 600 }}>#{booking._id.slice(-5).toUpperCase()}</span>
                          <span style={{ fontSize: "0.65rem", fontWeight: 700, padding: "2px 8px", borderRadius: 99, background: `${statusHex}18`, color: statusHex, border: `1px solid ${statusHex}40`, textTransform: "capitalize" }}>{displayStatus}</span>
                        </div>
                      </div>

                      {/* ─ PHONE + DETAILS + COPY (merged) ─ */}
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "2px 12px 8px", borderTop: "1px solid #f1f5f9", gap: 8 }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
                          <a href={`tel:${booking?.customerId?.contact}`} style={{ fontSize: "0.72rem", color: "#1d6fa4", textDecoration: "none", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                            <Phone size={12} strokeWidth={2.5} /> {booking?.customerId?.contact}
                          </a>
                          <span style={S}>{booking.yachtId?.name || "—"}</span>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            <span style={S}>📅 {booking.date?.split("T")[0]}</span>
                            <span style={{ ...S, color: "#cbd5e1" }}>·</span>
                            <span style={S}>⏰ {to12HourFormat(booking.startTime)}–{to12HourFormat(booking.endTime)}</span>
                            {getDuration(booking.startTime, booking.endTime) && (
                              <span style={{ fontSize: "0.65rem", fontWeight: 600, color: "#fff", background: "#1d6fa4", borderRadius: 99, padding: "1px 7px" }}>
                                {getDuration(booking.startTime, booking.endTime)}
                              </span>
                            )}
                          </div>
                          <span style={{ fontSize: "0.72rem", fontWeight: 700, color: isBookingCompleted(booking) ? "#15803d" : (booking.pendingAmount > 0 ? "#b45309" : "#15803d") }}>
                            {isBookingCompleted(booking) ? `Total ₹${booking.quotedAmount}` : `Balance ₹${booking.pendingAmount}`}
                          </span>
                        </div>
                        <button title="Copy summary" onClick={() => {
                          const sanitizeText = (t = "") => t.replace(/\u2022|\u2023|\u25E6/g,"-").replace(/\u200B|\u200C|\u200D|\uFEFF/g,"").replace(/\r\n/g,"\n").replace(/\n{2,}/g,"\n").trim();
                          const extraDetails = sanitizeText(booking.extraDetails || "");
                          const lines = extraDetails.split("\n").map(l=>l.trim()).filter(Boolean);
                          const INCLUDED_KEYS = ["Soft Drink","Ice Cube","Water Bottles","Bluetooth Speaker","Captain","Snacks"];
                          const PAID_KEYS = ["Drone - Photography & Videography","DSLR Photography"];
                          const inclusions = lines.filter(i => INCLUDED_KEYS.some(k=>i.includes(k)));
                          const paidServices = lines.filter(i => PAID_KEYS.some(k=>i.toLowerCase().includes(k.toLowerCase())));
                          const parts = [`Ticket Number: ${booking._id.slice(-5).toUpperCase()}`,`Yacht Name: ${booking.yachtId?.name || ""}`,`Booking Name: ${booking.customerId?.name || ""}`,`Phone Number: ${booking.customerId?.contact || ""}`,`Date: ${booking.date?.split("T")[0] || ""}`,`Time: ${to12HourFormat(booking.startTime)} - ${to12HourFormat(booking.endTime)}`,`#Pax: ${booking.numPeople}`,`Balance Amount: ${booking.pendingAmount}`];
                          if (inclusions.length) parts.push(`\nExtra Inclusions:\n${inclusions.map(i=>`* ${i.replace(/^[-*]\s*/,"").trim()}`).join("\n")}`);
                          if (paidServices.length) parts.push(`Extra Add On's Services:\n${paidServices.map(i=>`* ${i.replace(/^[-*]\s*/,"").trim()}`).join("\n")}`);
                          navigator.clipboard.writeText(parts.join("\n"));
                          toast.success("Booking summary copied!");
                        }} style={{ width: 26, height: 26, borderRadius: "50%", border: "1.5px solid #e2e8f0", background: "#f8fafc", color: "#94a3b8", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                          <Copy size={12} />
                        </button>
                      </div>

                      {/* ─ ADD-ONS (collapsed inline) ─ */}
                      {mHasAddons && (
                        <div style={{ padding: "0 12px 6px", display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
                          {mIncluded.length > 0 && (
                            <button onClick={() => toggleAddons(booking._id)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", alignItems: "center", gap: 3, fontSize: "0.68rem", color: "#1d6fa4", fontWeight: 600 }}>
                              <GlassWater size={12} strokeWidth={2} />{mIncluded.length} <span style={{ fontSize: "0.6rem", color: "#94a3b8" }}>{mIsOpen ? "▾" : "▸"}</span>
                            </button>
                          )}
                          {mPaid.map(({ key, label }) => <span key={key} className="addon-chip addon-chip--paid" style={{ fontSize: "0.62rem", padding: "1px 6px" }}>{label}</span>)}
                          {mIncluded.length > 0 && mIsOpen && mIncluded.map(({ key, label }) => <span key={key} className="addon-chip addon-chip--included" style={{ fontSize: "0.62rem", padding: "1px 6px" }}>{label}</span>)}
                        </div>
                      )}

                      {/* ─ ROW 3: actions ─ */}
                      <div style={{ display: "flex", justifyContent: "flex-start", gap: 18, alignItems: "center", padding: "6px 12px 10px" }}>
                        <button title="View" onClick={() => handleViewDetails(booking)} style={{ width: 36, height: 36, borderRadius: "50%", border: "1.5px solid #e2e8f0", background: "#f8fafc", color: "#475569", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Eye size={15} /></button>
                        <button title="WhatsApp" onClick={(e) => handleShareWhatsApp(booking, e)} style={{ width: 36, height: 36, borderRadius: "50%", border: "1.5px solid #25D366", background: "transparent", color: "#25D366", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" fill="currentColor" viewBox="0 0 16 16"><path d="M13.601 2.326A7.85 7.85 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.9 7.9 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.9 7.9 0 0 0 13.6 2.326zM7.994 14.521a6.6 6.6 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.56 6.56 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592m3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.73.73 0 0 0-.529.247c-.182.198-.691.677-.691 1.654s.71 1.916.81 2.049c.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232"/></svg>
                        </button>
                        {(user?.type === "admin" || user?.type === "backdesk" || user?.type === "onsite") && !isBookingCompleted(booking) && (
                          <button title="Update Booking" onClick={() => navigate("/update-booking", { state: { booking, user } })} style={{ width: 36, height: 36, borderRadius: "50%", border: "1.5px solid #1d6fa4", background: "transparent", color: "#1d6fa4", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Pencil size={15} /></button>
                        )}
                        {(booking.status === "confirmed" || booking.status === "pending") && !isBookingCompleted(booking) && (
                          <button title={booking.status === "confirmed" ? "Copy Boarding Pass" : "Copy Tentative Pass"} onClick={() => generateBoardingPass(booking)} style={{ width: 36, height: 36, borderRadius: "50%", border: `1.5px solid ${booking.status === "confirmed" ? "#198754" : "#ffc107"}`, background: "transparent", color: booking.status === "confirmed" ? "#198754" : "#b45309", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Copy size={15} /></button>
                        )}
                        {booking.status === "confirmed" && !isBookingCompleted(booking) && (() => {
                          const cooling = isReminderCooling(booking._id);
                          const minLeft = cooling ? reminderMinLeft(booking._id) : 0;
                          return (
                            <button
                              title={cooling ? `Reminder sent — re-enable in ${minLeft} min` : "Send Reminder via WhatsApp"}
                              onClick={() => !cooling && handleReminder(booking)}
                              style={{ width: 36, height: 36, borderRadius: "50%", border: `1.5px solid ${cooling ? "#cbd5e1" : "#c2410c"}`, background: "transparent", color: cooling ? "#94a3b8" : "#c2410c", cursor: cooling ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, opacity: cooling ? 0.55 : 1 }}
                            ><Bell size={15} /></button>
                          );
                        })()}
                        {(user?.type === "admin" || user?.type === "onsite") && isBookingCompleted(booking) && (booking.status === "pending" || booking.pendingAmount > 0) && (
                          <>
                            <button
                              onClick={() => handleCompleteTrip(booking)}
                              style={{ height: 36, paddingInline: 14, borderRadius: 99, border: "1.5px solid #198754", background: "#198754", color: "#fff", fontWeight: 700, fontSize: "0.72rem", cursor: "pointer", flexShrink: 0 }}
                            >Complete Trip</button>
                            <button
                              onClick={() => !feedbackSentIds.has(booking._id) && handleFeedback(booking)}
                              disabled={feedbackSentIds.has(booking._id)}
                              title={feedbackSentIds.has(booking._id) ? "Feedback Sent" : "Request Feedback via WhatsApp"}
                              style={{
                                width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                                cursor: feedbackSentIds.has(booking._id) ? "default" : "pointer",
                                border: feedbackSentIds.has(booking._id) ? "1.5px solid #bbf7d0" : "1.5px solid #cbd5e1",
                                background: feedbackSentIds.has(booking._id) ? "#f0fdf4" : "transparent",
                                color: feedbackSentIds.has(booking._id) ? "#15803d" : "#94a3b8",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                opacity: feedbackSentIds.has(booking._id) ? 0.75 : 1,
                              }}
                            ><Star size={15} /></button>
                          </>
                        )}
                        {isBookingCompleted(booking) && booking.status !== "pending" && !(booking.pendingAmount > 0) && (
                          <button
                            onClick={() => !feedbackSentIds.has(booking._id) && handleFeedback(booking)}
                            disabled={feedbackSentIds.has(booking._id)}
                            title={feedbackSentIds.has(booking._id) ? "Feedback Sent" : "Request Feedback via WhatsApp"}
                            style={{
                              width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                              cursor: feedbackSentIds.has(booking._id) ? "default" : "pointer",
                              border: feedbackSentIds.has(booking._id) ? "1.5px solid #bbf7d0" : "1.5px solid #cbd5e1",
                              background: feedbackSentIds.has(booking._id) ? "#f0fdf4" : "transparent",
                              color: feedbackSentIds.has(booking._id) ? "#15803d" : "#94a3b8",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              opacity: feedbackSentIds.has(booking._id) ? 0.75 : 1,
                            }}
                          ><Star size={15} /></button>
                        )}
                      </div>

                    </div>
                  </div>
                );
              }
              // ── DESKTOP CARD ──────────────────────────────────────
              return (
                <div key={booking._id} className="col-lg-4 col-md-6 mb-3">
                  <div className={`card border-0 shadow-sm h-100 border-start border-4 border-${statusColor} booking-card`}>
                    <div className="card-body p-3">
                      <div className="d-flex justify-content-between align-items-start mb-2">
                        <div>
                          <h6 className="mb-0 fw-semibold text-dark">{booking.customerId?.name}</h6>
                          <small className="d-flex align-items-center gap-3">
                            <small className="text-muted">Ticket #{booking._id.slice(-5).toUpperCase()}</small>
                            <a
                              href={`tel:${booking?.customerId?.contact}`}
                              className="text-decoration-none text-dark d-inline-flex align-items-center gap-1"
                            >
                              📞 {booking?.customerId?.contact}
                            </a>
                          </small>
                        </div>
                        <span className={`badge bg-${statusColor} bg-opacity-10 text-${statusColor}`}>
                          {displayStatus.charAt(0).toUpperCase() + displayStatus.slice(1)}
                        </span>
                      </div>
                      <hr className="my-2" />

                      <div className="small text-muted booking-info">
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          🚤 <b>Yacht:</b> {booking.yachtId?.name}
                          <button
                            title="Copy booking summary"
                            onClick={() => {
                              const sanitizeText = (text = "") =>
                                text
                                  .replace(/\u2022|\u2023|\u25E6/g, "-")
                                  .replace(/\u200B|\u200C|\u200D|\uFEFF/g, "")
                                  .replace(/\r\n/g, "\n")
                                  .replace(/\n{2,}/g, "\n")
                                  .trim();
                              const extraDetails = sanitizeText(booking.extraDetails || "");
                              const lines = extraDetails.split("\n").map((l) => l.trim()).filter(Boolean);
                              const INCLUDED_KEYS = ["Soft Drink", "Ice Cube", "Water Bottles", "Bluetooth Speaker", "Captain", "Snacks"];
                              const PAID_KEYS = ["Drone - Photography & Videography", "DSLR Photography"];
                              const inclusions = lines.filter((i) => INCLUDED_KEYS.some((k) => i.includes(k)));
                              const paidServices = lines.filter((i) => PAID_KEYS.some((k) => i.toLowerCase().includes(k.toLowerCase())));
                              const parts = [
                                `Ticket Number: ${booking._id.slice(-5).toUpperCase()}`,
                                `Yacht Name: ${booking.yachtId?.name || ""}`,
                                `Booking Name: ${booking.customerId?.name || ""}`,
                                `Phone Number: ${booking.customerId?.contact || ""}`,
                                `Date: ${booking.date?.split("T")[0] || ""}`,
                                `Time: ${to12HourFormat(booking.startTime)} - ${to12HourFormat(booking.endTime)}`,
                                `#Pax: ${booking.numPeople}`,
                                `Balance Amount: ${booking.pendingAmount}`,
                              ];
                              if (inclusions.length) {
                                parts.push(`\nExtra Inclusions:\n${inclusions.map((i) => `* ${i.replace(/^[-*]\s*/, "").trim()}`).join("\n")}`);
                              }
                              if (paidServices.length) {
                                parts.push(`Extra Add On's Services:\n${paidServices.map((i) => `* ${i.replace(/^[-*]\s*/, "").trim()}`).join("\n")}`);
                              }
                              navigator.clipboard.writeText(parts.join("\n"));
                              toast.success("Booking summary copied!");
                            }}
                            style={{ background: "none", border: "none", padding: "0 0 0 2px", cursor: "pointer", color: "#6c757d", lineHeight: 1, verticalAlign: "middle", flexShrink: 0 }}
                          >
                            <Copy size={12} />
                          </button>
                        </div>
                        <div>📅 <b>Date:</b> {booking.date?.split("T")[0]}</div>
                        <div>
                          ⏰ <b>Time:</b>{" "}
                          {to12HourFormat(booking.startTime)} – {to12HourFormat(booking.endTime)}
                        </div>
                        <div className="fw-semibold text-dark">🧑‍💼 Pax: {booking.numPeople}</div>
                        <div className="fw-semibold text-dark">
                          {isBookingCompleted(booking) ? `💰 Total: ₹${booking.quotedAmount}` : `💰 Balance: ₹${booking.pendingAmount}`}
                        </div>
                      </div>

                      {/* ADD-ONS */}
                      {(() => {
                        const { paid, included } = parseAddons(booking.extraDetails);
                        const hasAny = paid.length || included.length;
                        if (!hasAny) return null;
                        const isOpen = expandedAddons[booking._id];
                        return (
                          <div className="addon-section">
                            {included.length > 0 && (
                              <div className="addon-inline-row">
                                <button
                                  className="addon-toggle-btn"
                                  onClick={() => toggleAddons(booking._id)}
                                  aria-expanded={isOpen}
                                >
                                  <span className="addon-toggle-label">
                                    ⭐ Add-ons
                                    <span className="addon-count-pill">{included.length}</span>
                                  </span>
                                  <span className={`addon-chevron ${isOpen ? "open" : ""}`}>›</span>
                                </button>
                                {paid.length > 0 && (
                                  <div className="addon-paid-inline">
                                    {paid.map(({ key, label }) => (
                                      <span key={key} className="addon-chip addon-chip--paid">{label}</span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}

                            {included.length === 0 && paid.length > 0 && (
                              <div className="addon-paid-row">
                                {paid.map(({ key, label }) => (
                                  <span key={key} className="addon-chip addon-chip--paid">{label}</span>
                                ))}
                              </div>
                            )}

                            {included.length > 0 && isOpen && (
                              <div className="addon-chips-wrap">
                                {included.map(({ key, label }) => (
                                  <span key={key} className="addon-chip addon-chip--included">{label}</span>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      <div className="d-flex gap-3 mt-1 align-items-center">
                        {/* VIEW */}
                        <button
                          className="btn btn-sm btn-outline-secondary rounded-circle d-flex align-items-center justify-content-center"
                          title="View Booking"
                          style={{ width: 34, height: 34 }}
                          onClick={() => handleViewDetails(booking)}
                        >
                          <Eye size={16} />
                        </button>

                        {/* WHATSAPP */}
                        <button
                          className="btn btn-sm rounded-circle d-flex align-items-center justify-content-center"
                          title="Share on WhatsApp"
                          style={{ width: 34, height: 34, background: "transparent", border: "1.5px solid #25D366", color: "#25D366", flexShrink: 0 }}
                          onClick={(e) => handleShareWhatsApp(booking, e)}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                            <path d="M13.601 2.326A7.85 7.85 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.9 7.9 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.9 7.9 0 0 0 13.6 2.326zM7.994 14.521a6.6 6.6 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.56 6.56 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592m3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.73.73 0 0 0-.529.247c-.182.198-.691.677-.691 1.654s.71 1.916.81 2.049c.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232" />
                          </svg>
                        </button>

                        {/* UPDATE icon — before Pass, only for non-completed bookings */}
                        {(user?.type === "admin" || user?.type === "backdesk" || user?.type === "onsite") &&
                          !isBookingCompleted(booking) && (
                            <button
                              title="Update Booking"
                              onClick={() => navigate("/update-booking", { state: { booking, user } })}
                              style={{ width: 32, height: 32, borderRadius: "50%", border: "1.5px solid #1d6fa4", background: "transparent", color: "#1d6fa4", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
                            ><Pencil size={14} /></button>
                          )}

                        {/* BOARDING PASS copy icon — only for non-completed bookings */}
                        {(booking.status === "confirmed" || booking.status === "pending") &&
                          !isBookingCompleted(booking) && (
                            <button
                              title={booking.status === "pending" ? "Copy Tentative Pass" : "Copy Boarding Pass"}
                              onClick={() => generateBoardingPass(booking)}
                              style={{ width: 32, height: 32, borderRadius: "50%", border: `1.5px solid ${booking.status === "confirmed" ? "#198754" : "#ffc107"}`, background: "transparent", color: booking.status === "confirmed" ? "#198754" : "#b45309", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
                            ><Copy size={14} /></button>
                          )}

                        {/* REMINDER bell — only for confirmed non-completed */}
                        {booking.status === "confirmed" && !isBookingCompleted(booking) && (() => {
                          const cooling = isReminderCooling(booking._id);
                          const minLeft = cooling ? reminderMinLeft(booking._id) : 0;
                          return (
                            <button
                              title={cooling ? `Reminder sent — re-enable in ${minLeft} min` : "Send Reminder via WhatsApp"}
                              onClick={() => !cooling && handleReminder(booking)}
                              style={{ width: 32, height: 32, borderRadius: "50%", border: `1.5px solid ${cooling ? "#cbd5e1" : "#c2410c"}`, background: "transparent", color: cooling ? "#94a3b8" : "#c2410c", cursor: cooling ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, opacity: cooling ? 0.55 : 1 }}
                            ><Bell size={14} /></button>
                          );
                        })()}

                        {/* COMPLETE TRIP + FEEDBACK — for past bookings still pending or with balance */}
                        {(user?.type === "admin" || user?.type === "onsite") &&
                          isBookingCompleted(booking) &&
                          (booking.status === "pending" || booking.pendingAmount > 0) && (
                            <>
                              <button
                                className="btn btn-sm btn-success flex-grow-1 rounded-pill"
                                title="Mark trip as complete and settle balance"
                                onClick={() => handleCompleteTrip(booking)}
                              >
                                Complete Trip
                              </button>
                              <button
                                title={feedbackSentIds.has(booking._id) ? "Feedback Sent" : "Request Feedback via WhatsApp"}
                                disabled={feedbackSentIds.has(booking._id)}
                                onClick={() => !feedbackSentIds.has(booking._id) && handleFeedback(booking)}
                                style={{
                                  width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                                  cursor: feedbackSentIds.has(booking._id) ? "default" : "pointer",
                                  border: feedbackSentIds.has(booking._id) ? "1.5px solid #bbf7d0" : "1.5px solid #cbd5e1",
                                  background: feedbackSentIds.has(booking._id) ? "#f0fdf4" : "transparent",
                                  color: feedbackSentIds.has(booking._id) ? "#15803d" : "#94a3b8",
                                  display: "flex", alignItems: "center", justifyContent: "center",
                                  opacity: feedbackSentIds.has(booking._id) ? 0.75 : 1,
                                }}
                              ><Star size={14} /></button>
                            </>
                          )}

                        {/* FEEDBACK ONLY — for already-confirmed completed trips */}
                        {isBookingCompleted(booking) &&
                          booking.status !== "pending" &&
                          !(booking.pendingAmount > 0) && (
                            <button
                              title={feedbackSentIds.has(booking._id) ? "Feedback Sent" : "Request Feedback via WhatsApp"}
                              disabled={feedbackSentIds.has(booking._id)}
                              onClick={() => !feedbackSentIds.has(booking._id) && handleFeedback(booking)}
                              style={{
                                width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                                cursor: feedbackSentIds.has(booking._id) ? "default" : "pointer",
                                border: feedbackSentIds.has(booking._id) ? "1.5px solid #bbf7d0" : "1.5px solid #cbd5e1",
                                background: feedbackSentIds.has(booking._id) ? "#f0fdf4" : "transparent",
                                color: feedbackSentIds.has(booking._id) ? "#15803d" : "#94a3b8",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                opacity: feedbackSentIds.has(booking._id) ? 0.75 : 1,
                              }}
                            ><Star size={14} /></button>
                          )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-5 text-muted">
              <div style={{ fontSize: "2.5rem" }}>🔍</div>
              <p className="mt-2 mb-1 fw-semibold">No bookings found</p>
              <small>Try adjusting your filters</small>
              {(searchQuery || filterDate || filterStatus || filterEmployee || selectedMonth) && (
                <div className="mt-2">
                  <button className="btn btn-sm btn-outline-secondary rounded-pill" onClick={handleClear}>
                    Clear filters
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default Bookings;