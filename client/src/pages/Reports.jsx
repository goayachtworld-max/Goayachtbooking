import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { getBookingsAPI } from "../services/operations/bookingAPI";
import { yaut } from "../services/apis";
import { apiConnector } from "../services/apiConnector";
import toast from "react-hot-toast";
import "./Bookings.css";

/* ── helpers ── */
const toISTDateStr = (utcStr) => {
  if (!utcStr) return "";
  const d = new Date(new Date(utcStr).toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const getNowIST = () => new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
const getTodayIST = () => {
  const n = getNowIST();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
};
const getPast7Days = () => {
  const d = getNowIST();
  d.setDate(d.getDate() - 7);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const getStartOfMonth = () => {
  const d = getNowIST();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
};
const to12h = (t) => {
  if (!t) return "—";
  const [hh, mm] = t.split(":");
  const h = parseInt(hh, 10);
  return `${h % 12 || 12}:${mm} ${h < 12 ? "AM" : "PM"}`;
};
const fmtDate = (d) => {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt)) return d;
  return dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
};
const fmtINR = (v) => {
  const n = Number(v);
  if (!v && v !== 0) return "—";
  if (isNaN(n)) return "—";
  return `₹${n.toLocaleString("en-IN")}`;
};

/* ── Calendar constants ── */
const CAL_MONTHS       = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const CAL_MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const CAL_DAYS         = ["Su","Mo","Tu","We","Th","Fr","Sa"];

const formatCalLabel = (dateStr) => {
  if (!dateStr) return "";
  const [, m, d] = dateStr.split("-");
  return `${parseInt(d)} ${CAL_MONTHS_SHORT[parseInt(m) - 1]}`;
};

/* ── Settlement localStorage persistence ── */
const SETTLE_KEY  = "rpt_settlement";
const loadSettled = () => { try { return JSON.parse(localStorage.getItem(SETTLE_KEY) || "{}"); } catch { return {}; } };
const saveSettled = (obj) => { try { localStorage.setItem(SETTLE_KEY, JSON.stringify(obj)); } catch {} };

/* ──────────────────────────────────────────────────────────────
   DatePickerField — reuses bk-cal-* CSS from Bookings.css
   ────────────────────────────────────────────────────────────── */
function DatePickerField({ label, value, onChange, minDate, maxDate, shortcuts }) {
  const today = getTodayIST();
  const initYear  = value ? parseInt(value.slice(0, 4)) : new Date().getFullYear();
  const initMonth = value ? parseInt(value.slice(5, 7)) - 1 : new Date().getMonth();

  const [open, setOpen]       = useState(false);
  const [year, setYear]       = useState(initYear);
  const [month, setMonth]     = useState(initMonth);
  const wrapRef               = useRef(null);

  /* Sync view when value prop changes */
  useEffect(() => {
    if (value) {
      setYear(parseInt(value.slice(0, 4)));
      setMonth(parseInt(value.slice(5, 7)) - 1);
    }
  }, [value]);

  /* Close on outside click */
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const navigate = (dir) => {
    let m = month + dir, y = year;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setMonth(m); setYear(y);
  };

  const buildCells = () => {
    const firstDay    = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  };

  const pick = (ds) => {
    onChange(ds);
    setOpen(false);
  };

  return (
    <div>
      <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "#334155", display: "block", marginBottom: 4 }}>{label}</label>
      <div ref={wrapRef} style={{ position: "relative" }}>
        <button
          className={`bk-cal-trigger${value ? " active" : ""}`}
          style={{ width: "100%", justifyContent: "flex-start" }}
          onClick={() => setOpen(v => !v)}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          <span className="bk-cal-label" style={{ flex: 1, textAlign: "left" }}>
            {value ? formatCalLabel(value) : <span style={{ color: "#94a3b8" }}>Select date</span>}
          </span>
          {value && (
            <span
              className="bk-cal-clear"
              onClick={(e) => { e.stopPropagation(); onChange(""); setOpen(false); }}
            >×</span>
          )}
        </button>

        {open && (
          <div className="bk-cal-panel" style={{ zIndex: 10000 }}>
            <div className="bk-cal-hdr">
              <button className="bk-cal-nav" onClick={() => navigate(-1)}>‹</button>
              <span className="bk-cal-month-label">{CAL_MONTHS[month]} {year}</span>
              <button className="bk-cal-nav" onClick={() => navigate(1)}>›</button>
            </div>
            <div className="bk-cal-weekdays">
              {CAL_DAYS.map(d => <span key={d}>{d}</span>)}
            </div>
            <div className="bk-cal-grid">
              {buildCells().map((day, i) => {
                if (!day) return <div key={`e${i}`} />;
                const ds      = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const isSel   = value === ds;
                const isTdy   = today === ds;
                const disabled = (minDate && ds < minDate) || (maxDate && ds > maxDate);
                return (
                  <button
                    key={ds}
                    className={`bk-cal-day${isSel ? " sel" : ""}${isTdy && !isSel ? " tdy" : ""}`}
                    onClick={() => !disabled && pick(ds)}
                    style={disabled ? { opacity: 0.28, cursor: "not-allowed" } : {}}
                  >{day}</button>
                );
              })}
            </div>
            {shortcuts?.length > 0 && (
              <div style={{ display: "flex", gap: 6, padding: "8px 14px 0" }}>
                {shortcuts.map(sc => {
                  const isActive = value === sc.value;
                  const isDisabled = (minDate && sc.value < minDate) || (maxDate && sc.value > maxDate);
                  return (
                    <button
                      key={sc.label}
                      onClick={() => !isDisabled && pick(sc.value)}
                      style={{
                        flex: 1, height: 28, borderRadius: 7,
                        border: isActive ? "1.5px solid #1d6fa4" : "1.5px solid #e2e8f0",
                        background: isActive ? "rgba(29,111,164,0.1)" : "#f8fafc",
                        color: isActive ? "#1d6fa4" : "#64748b",
                        fontSize: "0.74rem", fontWeight: isActive ? 700 : 600,
                        cursor: isDisabled ? "not-allowed" : "pointer",
                        opacity: isDisabled ? 0.35 : 1,
                        fontFamily: "inherit", transition: "all 0.12s",
                      }}
                    >{sc.label}</button>
                  );
                })}
              </div>
            )}
            <div className="bk-cal-footer">
              <button onClick={() => pick(today)}>Today</button>
              {value && <button onClick={() => { onChange(""); setOpen(false); }}>Clear</button>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   YachtTypeahead — search-as-you-type dropdown
   ────────────────────────────────────────────────────────────── */
function YachtTypeahead({ value, onChange, yachtNames }) {
  const [inputVal, setInputVal] = useState(value || "");
  const [open, setOpen]         = useState(false);
  const wrapRef                 = useRef(null);

  /* Keep input in sync if cleared from outside */
  useEffect(() => { setInputVal(value || ""); }, [value]);

  /* Close on outside click */
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const suggestions = useMemo(() => {
    const q = inputVal.trim().toLowerCase();
    if (!q) return yachtNames;
    return yachtNames.filter(n => n.toLowerCase().includes(q));
  }, [inputVal, yachtNames]);

  const select = (name) => {
    setInputVal(name);
    onChange(name);
    setOpen(false);
  };

  const clear = () => {
    setInputVal("");
    onChange("");
    setOpen(false);
  };

  return (
    <div>
      <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "#334155", display: "block", marginBottom: 4 }}>Yacht</label>
      <div ref={wrapRef} style={{ position: "relative" }}>
        <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
          <svg
            width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
            style={{ position: "absolute", left: 10, flexShrink: 0, pointerEvents: "none" }}
          >
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            type="text"
            value={inputVal}
            placeholder="Search yacht…"
            onChange={e => { setInputVal(e.target.value); onChange(""); setOpen(true); }}
            onFocus={() => setOpen(true)}
            style={{
              width: "100%", padding: "8px 32px 8px 30px", borderRadius: 8,
              border: `1.5px solid ${value ? "#1d6fa4" : "#cbd5e1"}`,
              fontSize: "0.83rem", color: "#1e293b",
              background: value ? "#eff6ff" : "#f8fafc",
              outline: "none", fontFamily: "inherit",
            }}
          />
          {inputVal && (
            <button
              onClick={clear}
              style={{ position: "absolute", right: 8, background: "none", border: "none", cursor: "pointer", padding: 2, color: "#94a3b8", fontSize: 14, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center", width: 18, height: 18, borderRadius: "50%", transition: "background 0.12s" }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(220,38,38,0.1)"}
              onMouseLeave={e => e.currentTarget.style.background = "none"}
            >×</button>
          )}
        </div>

        {open && suggestions.length > 0 && (
          <div style={{
            position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0,
            background: "#fff", border: "1px solid #e2e8f4",
            borderRadius: 12, boxShadow: "0 8px 30px rgba(5,24,41,0.14)",
            maxHeight: 220, overflowY: "auto", zIndex: 10000,
            animation: "bk-cal-drop 0.14s ease-out",
          }}>
            {suggestions.map(name => (
              <button
                key={name}
                onMouseDown={() => select(name)}
                style={{
                  display: "block", width: "100%", textAlign: "left",
                  padding: "9px 14px", border: "none", background: "none",
                  fontSize: "0.83rem", color: "#1e293b", cursor: "pointer",
                  fontFamily: "inherit", fontWeight: name === value ? 700 : 400,
                  borderBottom: "1px solid #f1f5f9",
                  transition: "background 0.1s",
                }}
                onMouseEnter={e => e.currentTarget.style.background = "#f0f7fd"}
                onMouseLeave={e => e.currentTarget.style.background = "none"}
              >
                {name === value && (
                  <span style={{ color: "#1d6fa4", marginRight: 6 }}>✓</span>
                )}
                {name}
              </button>
            ))}
          </div>
        )}

        {open && suggestions.length === 0 && inputVal.trim() && (
          <div style={{
            position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0,
            background: "#fff", border: "1px solid #e2e8f4", borderRadius: 12,
            padding: "12px 14px", fontSize: "0.8rem", color: "#94a3b8",
            boxShadow: "0 8px 30px rgba(5,24,41,0.14)", zIndex: 10000,
          }}>
            No yacht matches "{inputVal}"
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────── */
export default function Reports({ user }) {
  const token = localStorage.getItem("authToken");

  /* ── Filters ── */
  const [fromDate, setFromDate]       = useState(getPast7Days);
  const [toDate, setToDate]           = useState(getTodayIST);
  const [filterYacht, setFilterYacht] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  /* ── Data ── */
  const [bookings, setBookings] = useState([]);
  const [yachts, setYachts]     = useState([]);
  const [loading, setLoading]   = useState(false);

  /* ── Settlement (keyed by booking._id, persisted to localStorage) ── */
  const [settlement, setSettlement] = useState(loadSettled);

  /* ── Fetch yachts for typeahead ── */
  useEffect(() => {
    if (!token) return;
    apiConnector("GET", yaut.GET_ALL_YACHTS_API, null, { Authorization: `Bearer ${token}` })
      .then(res => {
        const list = res?.data?.data || res?.data || [];
        setYachts(Array.isArray(list) ? list : []);
      })
      .catch(() => {});
  }, [token]);

  /* ── Fetch bookings ── */
  const fetchBookings = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const filters = {};
      if (fromDate) filters.startDate = fromDate;
      if (toDate)   filters.endDate   = toDate;
      if (filterStatus && filterStatus !== "completed") filters.status = filterStatus;
      const res = await getBookingsAPI(token, filters);
      const raw = res?.data?.data || res?.data || [];
      setBookings(Array.isArray(raw) ? raw : []);
    } catch {
      toast.error("Failed to load bookings");
    } finally {
      setLoading(false);
    }
  }, [token, fromDate, toDate, filterStatus]);

  useEffect(() => { fetchBookings(); }, [fetchBookings]);

  /* ── Completed = end time already passed ── */
  const isCompleted = (b) => {
    if (!b.date || !b.endTime) return false;
    const dateIST = toISTDateStr(b.date);
    return new Date(`${dateIST}T${b.endTime}:00+05:30`) < new Date();
  };

  /* ── Client-side filtering (yacht + completed status) ── */
  const filtered = useMemo(() => bookings.filter((b) => {
    if (filterYacht && b.yachtId?.name !== filterYacht) return false;
    if (filterStatus === "completed" && !isCompleted(b)) return false;
    if (filterStatus === "pending"   && b.status !== "pending") return false;
    if (filterStatus === "confirmed" && b.status !== "confirmed") return false;
    return true;
  }), [bookings, filterYacht, filterStatus]);

  /* ── Totals ── */
  const totals = useMemo(() => {
    let b2b = 0, selling = 0, settled = 0;
    filtered.forEach(bk => {
      b2b     += Number(bk.yachtId?.runningCost || 0);
      selling += Number(bk.quotedAmount || 0);
      const s = settlement[bk._id] || {};
      if (s.settled && s.balance) settled += Number(s.balance);
    });
    return { b2b, selling, settled };
  }, [filtered, settlement]);

  /* ── Settlement handlers ── */
  const toggleSettled = (id) => {
    setSettlement(prev => { const next = { ...prev, [id]: { ...prev[id], settled: !prev[id]?.settled } }; saveSettled(next); return next; });
  };
  const setBalance = (id, val) => {
    setSettlement(prev => { const next = { ...prev, [id]: { ...prev[id], balance: val } }; saveSettled(next); return next; });
  };

  /* ── CSV export ── */
  const exportCSV = () => {
    const headers = ["Date","Customer","Phone","Pax","Yacht","Time","B2b Price","Amt Settled","Selling Amt","Status","Settled"];
    const rows = filtered.map(bk => {
      const s    = settlement[bk._id] || {};
      const stat = isCompleted(bk) ? "Completed" : (bk.status ? bk.status.charAt(0).toUpperCase() + bk.status.slice(1) : "");
      const timeStr = `${to12h(bk.startTime)} - ${to12h(bk.endTime)}`;
      return [
        fmtDate(bk.date),
        bk.customerId?.name || "",
        bk.customerId?.contact || "",
        bk.numPeople || "",
        bk.yachtId?.name || "",
        timeStr,
        bk.yachtId?.runningCost || "",
        (s.settled && s.balance) ? s.balance : "",
        bk.quotedAmount || "",
        stat,
        s.settled ? "Yes" : "No",
      ];
    });
    const csvContent = [headers, ...rows]
      .map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `bookings-report_${fromDate || "all"}_to_${toDate || "all"}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  /* ── Yacht names for typeahead ── */
  const yachtNames = useMemo(() => {
    const s = new Set();
    yachts.forEach(y => { if (y.name) s.add(y.name); });
    return [...s].sort();
  }, [yachts]);

  /* ── Status badge ── */
  const StatusBadge = ({ booking }) => {
    const comp = isCompleted(booking);
    const map  = {
      completed: { bg: "#d1fae5", color: "#065f46", label: "Completed" },
      confirmed: { bg: "#dbeafe", color: "#1e40af", label: "Confirmed" },
      pending:   { bg: "#fef3c7", color: "#92400e", label: "Pending"   },
      cancelled: { bg: "#fee2e2", color: "#991b1b", label: "Cancelled" },
    };
    const s = map[comp ? "completed" : (booking.status || "pending")] || map.pending;
    return (
      <span style={{ padding: "2px 9px", borderRadius: 999, fontSize: "0.72rem", fontWeight: 700, background: s.bg, color: s.color, whiteSpace: "nowrap" }}>
        {s.label}
      </span>
    );
  };

  return (
    <div style={{ padding: "20px 16px 40px", maxWidth: 1280, margin: "0 auto" }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div>
          <h5 style={{ margin: 0, fontWeight: 800, color: "#051829", fontSize: "1.1rem", letterSpacing: "0.01em" }}>Booking Reports</h5>
          <p style={{ margin: 0, color: "#64748b", fontSize: "0.8rem", marginTop: 2 }}>Filter and review bookings with settlement tracking</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {filtered.length > 0 && (
            <button
              onClick={exportCSV}
              style={{ padding: "7px 16px", borderRadius: 8, border: "1.5px solid #15803d", background: "#f0fdf4", color: "#15803d", fontWeight: 700, fontSize: "0.82rem", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/><path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/></svg>
              Export CSV
            </button>
          )}
          <button
            onClick={fetchBookings}
            disabled={loading}
            style={{ padding: "7px 18px", borderRadius: 8, border: "none", background: "linear-gradient(135deg,#051829,#0a2d4a)", color: "#c9a84c", fontWeight: 700, fontSize: "0.82rem", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1, display: "flex", alignItems: "center", gap: 6 }}
          >
            {loading ? (
              <><span style={{ width: 14, height: 14, border: "2px solid rgba(201,168,76,0.35)", borderTop: "2px solid #c9a84c", borderRadius: "50%", display: "inline-block", animation: "rpt-spin 0.6s linear infinite" }} />Loading…</>
            ) : (
              <><svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><path d="M11.534 7h3.932a.25.25 0 0 1 .192.41l-1.966 2.36a.25.25 0 0 1-.384 0l-1.966-2.36a.25.25 0 0 1 .192-.41zm-11 2h3.932a.25.25 0 0 0 .192-.41L2.692 6.23a.25.25 0 0 0-.384 0L.342 8.59A.25.25 0 0 0 .534 9z"/><path fillRule="evenodd" d="M8 3c-1.552 0-2.94.707-3.857 1.818a.5.5 0 1 1-.771-.636A6.002 6.002 0 0 1 13.917 7H12.9A5.002 5.002 0 0 0 8 3zM3.1 9a5.002 5.002 0 0 0 8.757 2.182.5.5 0 1 1 .771.636A6.002 6.002 0 0 1 2.083 9H3.1z"/></svg>Refresh</>
            )}
          </button>
        </div>
      </div>

      {/* ── Filter Card ── */}
      <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 1px 12px rgba(5,24,41,0.08)", border: "1px solid #e8edf2", padding: "16px 20px", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <svg width="15" height="15" fill="#0a2d4a" viewBox="0 0 16 16"><path d="M1.5 1.5A.5.5 0 0 1 2 1h12a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-.128.334L10 8.692V13.5a.5.5 0 0 1-.342.474l-3 1A.5.5 0 0 1 6 14.5V8.692L1.628 3.834A.5.5 0 0 1 1.5 3.5v-2z"/></svg>
          <span style={{ fontWeight: 700, color: "#051829", fontSize: "0.85rem" }}>Filters</span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: "14px 16px", alignItems: "end" }}>
          <DatePickerField
            label="From Date"
            value={fromDate}
            onChange={setFromDate}
            maxDate={toDate || getTodayIST()}
            shortcuts={[
              { label: "Month",  value: getStartOfMonth() },
              { label: "7 Days", value: getPast7Days() },
              { label: "Today",  value: getTodayIST() },
            ]}
          />
          <DatePickerField
            label="To Date"
            value={toDate}
            onChange={setToDate}
            minDate={fromDate}
            maxDate={getTodayIST()}
          />
          <YachtTypeahead
            value={filterYacht}
            onChange={setFilterYacht}
            yachtNames={yachtNames}
          />

          {/* Status filter */}
          <div>
            <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "#334155", display: "block", marginBottom: 4 }}>Status</label>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1.5px solid #cbd5e1", fontSize: "0.83rem", color: "#1e293b", background: "#f8fafc", outline: "none", cursor: "pointer", height: 36 }}
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          {/* Reset */}
          <div>
            <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "transparent", display: "block", marginBottom: 4 }}>‎</label>
            <button
              onClick={() => { setFromDate(getPast7Days()); setToDate(getTodayIST()); setFilterYacht(""); setFilterStatus(""); }}
              style={{ width: "100%", height: 36, borderRadius: 8, border: "1.5px solid #cbd5e1", fontSize: "0.83rem", color: "#64748b", background: "#f1f5f9", cursor: "pointer", fontWeight: 600 }}
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* ── Summary pills ── */}
      {!loading && (
        <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
          <div style={{ padding: "6px 14px", borderRadius: 999, background: "#f1f5f9", border: "1px solid #e2e8f0", fontSize: "0.8rem", color: "#334155", fontWeight: 600 }}>
            {filtered.length} booking{filtered.length !== 1 ? "s" : ""}
          </div>
          {totals.b2b > 0 && (
            <div style={{ padding: "6px 14px", borderRadius: 999, background: "#fff7ed", border: "1px solid #fed7aa", fontSize: "0.8rem", color: "#9a3412", fontWeight: 600 }}>
              B2b Total: {fmtINR(totals.b2b)}
            </div>
          )}
          {totals.settled > 0 && (
            <div style={{ padding: "6px 14px", borderRadius: 999, background: "#f5f3ff", border: "1px solid #ddd6fe", fontSize: "0.8rem", color: "#7c3aed", fontWeight: 600 }}>
              Settled Total: {fmtINR(totals.settled)}
            </div>
          )}
          <div style={{ padding: "6px 14px", borderRadius: 999, background: "#f0fdf4", border: "1px solid #bbf7d0", fontSize: "0.8rem", color: "#15803d", fontWeight: 600 }}>
            Selling Total: {fmtINR(totals.selling)}
          </div>
        </div>
      )}

      {/* ── Grid / Table ── */}
      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 200 }}>
          <div style={{ width: 36, height: 36, border: "3px solid #e2e8f0", borderTop: "3px solid #0a2d4a", borderRadius: "50%", animation: "rpt-spin 0.7s linear infinite" }} />
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e8edf2", padding: "48px 24px", textAlign: "center" }}>
          <svg width="40" height="40" fill="#cbd5e1" viewBox="0 0 16 16" style={{ marginBottom: 12 }}><path d="M2.5 1A1.5 1.5 0 0 0 1 2.5v11A1.5 1.5 0 0 0 2.5 15h11a1.5 1.5 0 0 0 1.5-1.5V6.207a1.5 1.5 0 0 0-.44-1.06l-3.707-3.707A1.5 1.5 0 0 0 9.793 1H2.5zm0 1h7.293L13 5.207V13.5a.5.5 0 0 1-.5.5h-10a.5.5 0 0 1-.5-.5v-11a.5.5 0 0 1 .5-.5z"/></svg>
          <p style={{ color: "#94a3b8", fontWeight: 600, margin: 0 }}>No bookings found for the selected filters</p>
        </div>
      ) : (
        <>
          {/* ── Desktop Table ── */}
          <div className="d-none d-md-block" style={{ background: "#fff", borderRadius: 14, boxShadow: "0 1px 12px rgba(5,24,41,0.08)", border: "1px solid #e8edf2", overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.83rem" }}>
                <thead>
                  <tr style={{ background: "linear-gradient(90deg,#051829,#0a2d4a)", color: "#c9a84c" }}>
                    {["Date","Customer","Phone","Pax","Yacht","Time","B2b Price","Amt Settled","Selling Amt","Status","Settled","Balance"].map(h => (
                      <th key={h} style={{ padding: "11px 14px", fontWeight: 700, fontSize: "0.77rem", textAlign: "left", whiteSpace: "nowrap", letterSpacing: "0.03em", textTransform: "uppercase" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((bk, i) => {
                    const s        = settlement[bk._id] || {};
                    const rowGreen = s.settled;
                    return (
                      <tr key={bk._id} style={{ background: rowGreen ? "rgba(16,185,129,0.08)" : (i % 2 === 0 ? "#fff" : "#f8fafc"), borderBottom: "1px solid #f1f5f9", transition: "background 0.25s" }}>
                        <td style={{ padding: "10px 14px", fontWeight: 600, color: "#1e293b", whiteSpace: "nowrap" }}>{fmtDate(bk.date)}</td>
                        <td style={{ padding: "10px 14px", color: "#1e293b", fontWeight: 500, maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{bk.customerId?.name || "—"}</td>
                        <td style={{ padding: "10px 14px", color: "#475569", whiteSpace: "nowrap" }}>{bk.customerId?.contact || "—"}</td>
                        <td style={{ padding: "10px 14px", textAlign: "center", color: "#475569" }}>{bk.numPeople || "—"}</td>
                        <td style={{ padding: "10px 14px", color: "#1e293b", fontWeight: 600, whiteSpace: "nowrap" }}>{bk.yachtId?.name || "—"}</td>
                        <td style={{ padding: "10px 14px", color: "#475569", whiteSpace: "nowrap" }}>{to12h(bk.startTime)} – {to12h(bk.endTime)}</td>
                        <td style={{ padding: "10px 14px", color: "#9a3412", fontWeight: 600, whiteSpace: "nowrap" }}>{fmtINR(bk.yachtId?.runningCost)}</td>
                        <td style={{ padding: "10px 14px", fontWeight: 700, whiteSpace: "nowrap", color: (s.settled && s.balance) ? "#7c3aed" : "#cbd5e1" }}>
                          {(s.settled && s.balance) ? fmtINR(s.balance) : "—"}
                        </td>
                        <td style={{ padding: "10px 14px", color: "#15803d", fontWeight: 700, whiteSpace: "nowrap" }}>{fmtINR(bk.quotedAmount)}</td>
                        <td style={{ padding: "10px 14px" }}><StatusBadge booking={bk} /></td>
                        <td style={{ padding: "10px 14px", textAlign: "center" }}>
                          <input type="checkbox" checked={!!s.settled} onChange={() => toggleSettled(bk._id)} style={{ width: 16, height: 16, cursor: "pointer", accentColor: "#059669" }} />
                        </td>
                        <td style={{ padding: "8px 14px" }}>
                          <input
                            type="number"
                            disabled={!s.settled}
                            placeholder="Enter amt"
                            value={s.balance || ""}
                            onChange={e => setBalance(bk._id, e.target.value)}
                            style={{ width: 110, padding: "5px 8px", borderRadius: 6, border: `1.5px solid ${s.settled ? "#6ee7b7" : "#e2e8f0"}`, fontSize: "0.8rem", color: "#1e293b", background: s.settled ? "#f0fdf4" : "#f8fafc", outline: "none", cursor: s.settled ? "text" : "not-allowed", opacity: s.settled ? 1 : 0.5 }}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Mobile Cards ── */}
          <div className="d-md-none" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {filtered.map((bk) => {
              const s        = settlement[bk._id] || {};
              const rowGreen = s.settled;
              return (
                <div key={bk._id} style={{ background: rowGreen ? "rgba(16,185,129,0.08)" : "#fff", border: `1.5px solid ${rowGreen ? "rgba(16,185,129,0.4)" : "#e8edf2"}`, borderRadius: 14, padding: "14px 16px", boxShadow: "0 1px 8px rgba(5,24,41,0.06)", transition: "all 0.25s" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <div>
                      <div style={{ fontWeight: 700, color: "#0a2d4a", fontSize: "0.95rem" }}>{bk.customerId?.name || "—"}</div>
                      <div style={{ fontSize: "0.78rem", color: "#64748b", marginTop: 1 }}>{bk.customerId?.contact || ""}</div>
                    </div>
                    <StatusBadge booking={bk} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 12px", marginBottom: 10 }}>
                    <CardDetail label="Date"    value={fmtDate(bk.date)} />
                    <CardDetail label="Pax"     value={bk.numPeople || "—"} />
                    <CardDetail label="Yacht"   value={bk.yachtId?.name || "—"} />
                    <CardDetail label="Time"    value={`${to12h(bk.startTime)} – ${to12h(bk.endTime)}`} />
                    <CardDetail label="B2b"         value={fmtINR(bk.yachtId?.runningCost)} color="#9a3412" bold />
                    <CardDetail label="Amt Settled" value={(s.settled && s.balance) ? fmtINR(s.balance) : "—"} color={(s.settled && s.balance) ? "#7c3aed" : "#cbd5e1"} bold />
                    <CardDetail label="Selling"     value={fmtINR(bk.quotedAmount)}         color="#15803d" bold />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, paddingTop: 8, borderTop: "1px solid #f1f5f9" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", userSelect: "none" }}>
                      <input type="checkbox" checked={!!s.settled} onChange={() => toggleSettled(bk._id)} style={{ width: 16, height: 16, accentColor: "#059669" }} />
                      <span style={{ fontSize: "0.8rem", fontWeight: 600, color: s.settled ? "#059669" : "#64748b" }}>{s.settled ? "B2b Settled ✓" : "Mark Settled"}</span>
                    </label>
                    {s.settled && (
                      <input type="number" placeholder="Balance amt" value={s.balance || ""} onChange={e => setBalance(bk._id, e.target.value)} style={{ flex: 1, padding: "5px 8px", borderRadius: 6, border: "1.5px solid #6ee7b7", fontSize: "0.8rem", background: "#f0fdf4", outline: "none", color: "#1e293b" }} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <style>{`@keyframes rpt-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function CardDetail({ label, value, color, bold }) {
  return (
    <div>
      <div style={{ fontSize: "0.7rem", color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</div>
      <div style={{ fontSize: "0.82rem", color: color || "#1e293b", fontWeight: bold ? 700 : 500, marginTop: 1 }}>{value}</div>
    </div>
  );
}
