import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { getPastBookingsAPI } from "../services/operations/bookingAPI";
import { createTransactionAndUpdateBooking } from "../services/operations/transactionAPI";
import { yaut } from "../services/apis";
import { apiConnector } from "../services/apiConnector";
import toast from "react-hot-toast";
import { FiSliders } from "react-icons/fi";
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
   YachtTypeahead — smart search-as-you-type with match highlight
   ────────────────────────────────────────────────────────────── */
function YachtTypeahead({ value, onChange, yachtNames }) {
  const [inputVal, setInputVal] = useState(value || "");
  const [open, setOpen]         = useState(false);
  const [focused, setFocused]   = useState(false);
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
    if (!q) return yachtNames; // show all when focused with empty input
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

  /* Highlight matching portion of suggestion */
  const highlight = (text, query) => {
    if (!query.trim()) return text;
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <strong style={{ color: "#1d6fa4", fontWeight: 700 }}>{text.slice(idx, idx + query.length)}</strong>
        {text.slice(idx + query.length)}
      </>
    );
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
            onFocus={() => { setFocused(true); setOpen(true); }}
            onBlur={() => setFocused(false)}
            style={{
              width: "100%", padding: "8px 32px 8px 30px", borderRadius: 8,
              border: `1.5px solid ${value ? "#1d6fa4" : focused ? "#1d6fa4" : "#cbd5e1"}`,
              fontSize: "0.83rem", color: "#1e293b",
              background: value ? "#eff6ff" : "#f8fafc",
              outline: "none", fontFamily: "inherit",
              transition: "border-color 0.15s, background 0.15s",
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
            {!inputVal.trim() && (
              <div style={{ padding: "6px 14px 4px", fontSize: "0.7rem", color: "#94a3b8", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid #f1f5f9" }}>
                All Yachts
              </div>
            )}
            {suggestions.map(name => (
              <button
                key={name}
                onMouseDown={() => select(name)}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  width: "100%", textAlign: "left",
                  padding: "9px 14px", border: "none", background: "none",
                  fontSize: "0.83rem", color: "#1e293b", cursor: "pointer",
                  fontFamily: "inherit", fontWeight: name === value ? 600 : 400,
                  borderBottom: "1px solid #f1f5f9",
                  transition: "background 0.1s",
                }}
                onMouseEnter={e => e.currentTarget.style.background = "#f0f7fd"}
                onMouseLeave={e => e.currentTarget.style.background = "none"}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                </svg>
                <span>{highlight(name, inputVal)}</span>
                {name === value && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#1d6fa4" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: "auto", flexShrink: 0 }}>
                    <path d="M20 6 9 17l-5-5"/>
                  </svg>
                )}
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

/* ──────────────────────────────────────────────────────────────
   SmartSearchBar — searches customer name, phone, yacht
   ────────────────────────────────────────────────────────────── */
function SmartSearchBar({ value, onChange, bookings }) {
  const [open, setOpen]       = useState(false);
  const [focused, setFocused] = useState(false);
  const wrapRef               = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  /* Build deduplicated suggestion list across name, phone, yacht */
  const suggestions = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q || !bookings.length) return [];
    const seen = new Set();
    const results = [];
    bookings.forEach(b => {
      const name  = b.customerId?.name  || "";
      const phone = b.customerId?.contact || "";
      const yacht = b.yachtId?.name     || "";
      if (name  && name.toLowerCase().includes(q)  && !seen.has("n:" + name))  { seen.add("n:" + name);  results.push({ type: "customer", text: name,  icon: "person" }); }
      if (phone && phone.includes(q)               && !seen.has("p:" + phone)) { seen.add("p:" + phone); results.push({ type: "phone",    text: phone, icon: "phone"  }); }
      if (yacht && yacht.toLowerCase().includes(q) && !seen.has("y:" + yacht)) { seen.add("y:" + yacht); results.push({ type: "yacht",    text: yacht, icon: "yacht"  }); }
    });
    return results.slice(0, 8);
  }, [value, bookings]);

  const highlight = (text, query) => {
    if (!query.trim()) return text;
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <strong style={{ color: "#1d6fa4", fontWeight: 700, background: "#dbeafe", borderRadius: 2, padding: "0 1px" }}>{text.slice(idx, idx + query.length)}</strong>
        {text.slice(idx + query.length)}
      </>
    );
  };

  const TypeIcon = ({ type }) => {
    if (type === "phone") return (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.15 12 19.79 19.79 0 0 1 1.08 3.38 2 2 0 0 1 3.05 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 8.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21 16z"/>
      </svg>
    );
    if (type === "yacht") return (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 20a2.4 2.4 0 0 0 2 1 2.4 2.4 0 0 0 2-1 2.4 2.4 0 0 1 2-1 2.4 2.4 0 0 1 2 1 2.4 2.4 0 0 0 2 1 2.4 2.4 0 0 0 2-1 2.4 2.4 0 0 1 2-1 2.4 2.4 0 0 1 2 1"/><path d="M4 18V8l8-6 8 6v10"/><path d="M8 18v-4h8v4"/>
      </svg>
    );
    return (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
      </svg>
    );
  };

  const typeLabel = { customer: "Name", phone: "Phone", yacht: "Yacht" };

  return (
    <div ref={wrapRef} style={{ position: "relative", marginBottom: 12 }}>
      <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
        <svg
          width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={focused ? "#1d6fa4" : "#94a3b8"} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
          style={{ position: "absolute", left: 12, pointerEvents: "none", transition: "stroke 0.15s" }}
        >
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <input
          type="text"
          value={value}
          placeholder="Search by customer name, phone or yacht…"
          onChange={e => { onChange(e.target.value); setOpen(true); }}
          onFocus={() => { setFocused(true); if (value) setOpen(true); }}
          onBlur={() => setFocused(false)}
          style={{
            width: "100%", padding: "9px 36px 9px 36px",
            borderRadius: 10, border: `1.5px solid ${focused ? "#1d6fa4" : "#cbd5e1"}`,
            fontSize: "0.85rem", color: "#1e293b", background: focused ? "#f8fbff" : "#f8fafc",
            outline: "none", fontFamily: "inherit", transition: "border-color 0.15s, background 0.15s",
            boxShadow: focused ? "0 0 0 3px rgba(29,111,164,0.08)" : "none",
          }}
        />
        {value && (
          <button
            onClick={() => { onChange(""); setOpen(false); }}
            style={{ position: "absolute", right: 10, background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: 16, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center", width: 20, height: 20, borderRadius: "50%", transition: "background 0.12s" }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(220,38,38,0.1)"}
            onMouseLeave={e => e.currentTarget.style.background = "none"}
          >×</button>
        )}
      </div>

      {open && suggestions.length > 0 && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0,
          background: "#fff", border: "1px solid #e2e8f4", borderRadius: 12,
          boxShadow: "0 8px 30px rgba(5,24,41,0.14)", maxHeight: 260,
          overflowY: "auto", zIndex: 10000,
        }}>
          <div style={{ padding: "6px 12px 4px", fontSize: "0.7rem", color: "#94a3b8", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid #f1f5f9" }}>
            Suggestions
          </div>
          {suggestions.map((s, i) => (
            <button
              key={i}
              onMouseDown={() => { onChange(s.text); setOpen(false); }}
              style={{
                display: "flex", alignItems: "center", gap: 10, width: "100%",
                textAlign: "left", padding: "8px 14px", border: "none", background: "none",
                fontSize: "0.83rem", color: "#1e293b", cursor: "pointer",
                fontFamily: "inherit", borderBottom: "1px solid #f8fafc",
                transition: "background 0.1s",
              }}
              onMouseEnter={e => e.currentTarget.style.background = "#f0f7fd"}
              onMouseLeave={e => e.currentTarget.style.background = "none"}
            >
              <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 24, height: 24, borderRadius: 6, background: "#f1f5f9", flexShrink: 0 }}>
                <TypeIcon type={s.type} />
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>{highlight(s.text, value)}</span>
              <span style={{ fontSize: "0.68rem", color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", flexShrink: 0 }}>{typeLabel[s.type]}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────── */
export default function Reports({ user }) {
  const token = localStorage.getItem("authToken");

  /* ── Filters ── */
  const [fromDate, setFromDate]         = useState(getPast7Days);
  const [toDate, setToDate]             = useState(getTodayIST);
  const [filterYacht, setFilterYacht]   = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [searchQuery, setSearchQuery]   = useState("");

  /* ── Sort ── */
  const [sortKey, setSortKey] = useState("date");   // "date" | "yacht"
  const [sortDir, setSortDir] = useState("desc");   // "asc" | "desc"

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  /* ── Mobile drawer ── */
  const [isMobile, setIsMobile]       = useState(window.innerWidth < 768);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  /* ── Data ── */
  const [bookings, setBookings] = useState([]);
  const [yachts, setYachts]     = useState([]);
  const [loading, setLoading]   = useState(false);

  /* ── Settlement (keyed by booking._id, persisted to localStorage) ── */
  const [settlement, setSettlement] = useState(loadSettled);

  /* ── Mark Complete ── */
  const [completing, setCompleting] = useState(null);

  /* ── Fetch yachts for typeahead ── */
  useEffect(() => {
    if (!token) return;
    apiConnector("GET", yaut.GET_ALL_YACHTS_DETAILS_API, null, { Authorization: `Bearer ${token}` })
      .then(res => {
        const list = res?.data?.yachts || res?.data?.data || [];
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
      const res = await getPastBookingsAPI(token, filters);
      const raw = res?.data?.bookings || [];
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

  /* ── Client-side filtering (yacht + completed status + search) + sorting ── */
  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = bookings.filter((b) => {
      if (filterYacht && b.yachtId?.name !== filterYacht) return false;
      if (filterStatus === "completed" && !isCompleted(b)) return false;
      if (filterStatus === "pending"   && b.status !== "pending") return false;
      if (filterStatus === "confirmed" && b.status !== "confirmed") return false;
      if (q) {
        const nameMatch    = b.customerId?.name?.toLowerCase().includes(q);
        const phoneMatch   = b.customerId?.contact?.includes(q);
        const yachtMatch   = b.yachtId?.name?.toLowerCase().includes(q);
        if (!nameMatch && !phoneMatch && !yachtMatch) return false;
      }
      return true;
    });
    list.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "date") {
        cmp = new Date(a.date) - new Date(b.date);
      } else if (sortKey === "yacht") {
        cmp = (a.yachtId?.name || "").localeCompare(b.yachtId?.name || "");
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [bookings, filterYacht, filterStatus, sortKey, sortDir, searchQuery]);

  /* ── Totals ── */
  const totals = useMemo(() => {
    let b2b = 0, selling = 0, settled = 0;
    filtered.forEach(bk => {
      b2b     += Number(bk.yachtId?.runningCost || 0);
      selling += Number(bk.quotedAmount || 0);
      settled += Number(bk.quotedAmount || 0) - Number(bk.pendingAmount || 0);
    });
    return { b2b, selling, settled };
  }, [filtered]);

  /* ── Settlement handlers ── */
  const toggleSettled = (id) => {
    setSettlement(prev => { const next = { ...prev, [id]: { ...prev[id], settled: !prev[id]?.settled } }; saveSettled(next); return next; });
  };
  const setBalance = (id, val) => {
    setSettlement(prev => { const next = { ...prev, [id]: { ...prev[id], balance: val } }; saveSettled(next); return next; });
  };

  /* ── Mark trip complete via API ── */
  const handleMarkComplete = async (bk) => {
    if (completing) return;
    setCompleting(bk._id);
    try {
      const s = settlement[bk._id] || {};
      // Use entered balance amount if provided, otherwise settle full pending amount
      const amountToSettle = s.balance ? Number(s.balance) : Number(bk.pendingAmount || 0);
      const data = new FormData();
      data.append("bookingId", bk._id);
      data.append("type", "settlement");
      data.append("status", "confirmed");
      data.append("amount", amountToSettle);
      await createTransactionAndUpdateBooking(data, token);
      const newPending = Number(bk.pendingAmount || 0) - amountToSettle;
      toast.success(newPending > 0 ? `✅ ₹${amountToSettle.toLocaleString("en-IN")} settled` : "Booking marked complete ✅");
      setBookings(prev => prev.map(b => b._id === bk._id ? { ...b, pendingAmount: newPending <= 0 ? 0 : newPending, status: newPending <= 0 ? "confirmed" : b.status } : b));
      // Clear the entered balance after settlement
      setSettlement(prev => { const next = { ...prev, [bk._id]: { ...prev[bk._id], balance: "" } }; saveSettled(next); return next; });
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to mark complete");
    } finally {
      setCompleting(null);
    }
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
    <div style={{ padding: isMobile ? "12px 10px 84px" : "20px 16px 40px", maxWidth: 1280, margin: "0 auto" }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: isMobile ? 12 : 20, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div>
          <h5 style={{ margin: 0, fontWeight: 800, color: "#051829", fontSize: isMobile ? "1rem" : "1.1rem", letterSpacing: "0.01em" }}>Booking Reports</h5>
          {!isMobile && <p style={{ margin: 0, color: "#64748b", fontSize: "0.8rem", marginTop: 2 }}>Filter and review bookings with settlement tracking</p>}
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

      {/* ── Mobile: filter icon + active tag chips ── */}
      {isMobile && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <button
            className={`mobile-filter-btn${(filterYacht || filterStatus) ? " has-active" : ""}`}
            onClick={() => setShowFilters(true)}
            title="Open filters"
          >
            <FiSliders size={18} />
            {[filterYacht, filterStatus].filter(Boolean).length > 0 && (
              <span className="filter-badge">{[filterYacht, filterStatus].filter(Boolean).length}</span>
            )}
          </button>
          <div style={{ display: "flex", gap: 6, flex: 1, flexWrap: "wrap" }}>
            {fromDate && <span style={{ fontSize: "0.73rem", padding: "3px 10px", borderRadius: 999, background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1d4ed8", fontWeight: 600 }}>{formatCalLabel(fromDate)} → {toDate ? formatCalLabel(toDate) : "…"}</span>}
            {filterYacht && <span style={{ fontSize: "0.73rem", padding: "3px 10px", borderRadius: 999, background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#15803d", fontWeight: 600 }}>{filterYacht}</span>}
            {filterStatus && <span style={{ fontSize: "0.73rem", padding: "3px 10px", borderRadius: 999, background: "#fef3c7", border: "1px solid #fde68a", color: "#92400e", fontWeight: 600, textTransform: "capitalize" }}>{filterStatus}</span>}
          </div>
        </div>
      )}

      {/* ── Mobile filter drawer ── */}
      {isMobile && showFilters && (
        <div className="mobile-filter-backdrop" style={{ zIndex: 1060 }} onClick={() => setShowFilters(false)}>
          <div className="mobile-filter-drawer" style={{ zIndex: 1061, maxHeight: "80dvh", display: "flex", flexDirection: "column", paddingBottom: 0 }} onClick={e => e.stopPropagation()}>
            <div className="drawer-handle" />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <span style={{ fontWeight: 700, color: "#051829", fontSize: "0.9rem" }}>Filters</span>
              <button
                onClick={() => { setFromDate(getPast7Days()); setToDate(getTodayIST()); setFilterYacht(""); setFilterStatus(""); setSearchQuery(""); }}
                style={{ background: "none", border: "none", color: "#dc2626", fontSize: "0.82rem", fontWeight: 600, cursor: "pointer", padding: 0 }}
              >Reset all</button>
            </div>
            <div style={{ overflowY: "auto", flex: 1, paddingBottom: 4 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <DatePickerField
                label="From Date"
                value={fromDate}
                onChange={v => { setFromDate(v); if (v) setShowFilters(false); }}
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
                onChange={v => { setToDate(v); if (v) setShowFilters(false); }}
                minDate={fromDate}
                maxDate={getTodayIST()}
              />
              <YachtTypeahead value={filterYacht} onChange={v => { setFilterYacht(v); if (v) setShowFilters(false); }} yachtNames={yachtNames} />
              <div>
                <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "#334155", display: "block", marginBottom: 6 }}>Status</label>
                <div className="status-pill-group">
                  {[
                    { value: "", label: "All", color: "#6c757d" },
                    { value: "pending", label: "Pending", color: "#d97706" },
                    { value: "confirmed", label: "Confirmed", color: "#16a34a" },
                    { value: "completed", label: "Completed", color: "#2563eb" },
                  ].map(({ value, label, color }) => (
                    <button
                      key={value}
                      className={`status-pill${filterStatus === value ? " active" : ""}`}
                      style={{ "--pill-color": color }}
                      onClick={() => { setFilterStatus(value); setShowFilters(false); }}
                    >{label}</button>
                  ))}
                </div>
              </div>
            </div>
            </div>
            <div style={{ padding: "12px 0 max(20px, env(safe-area-inset-bottom))", flexShrink: 0 }}>
              <button
                onClick={() => setShowFilters(false)}
                style={{ width: "100%", padding: "11px", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#051829,#0a2d4a)", color: "#c9a84c", fontWeight: 700, fontSize: "0.88rem", cursor: "pointer" }}
              >
                Show {filtered.length} Booking{filtered.length !== 1 ? "s" : ""}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Desktop Filter Card ── */}
      {!isMobile && (
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
            <YachtTypeahead value={filterYacht} onChange={setFilterYacht} yachtNames={yachtNames} />
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
            <div>
              <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "transparent", display: "block", marginBottom: 4 }}>‎</label>
              <button
                onClick={() => { setFromDate(getPast7Days()); setToDate(getTodayIST()); setFilterYacht(""); setFilterStatus(""); setSearchQuery(""); }}
                style={{ width: "100%", height: 36, borderRadius: 8, border: "1.5px solid #cbd5e1", fontSize: "0.83rem", color: "#64748b", background: "#f1f5f9", cursor: "pointer", fontWeight: 600 }}
              >Reset</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Smart Search Bar ── */}
      {!loading && (
        <SmartSearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          bookings={bookings}
        />
      )}

      {/* ── Summary pills ── */}
      {!loading && (
        <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
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
                    {[
                      { key: "date",  label: "Date",     sortable: true  },
                      { key: "customer", label: "Customer", sortable: false },
                      { key: "phone", label: "Phone",    sortable: false },
                      { key: "pax",   label: "Pax",      sortable: false },
                      { key: "yacht", label: "Yacht",    sortable: true  },
                      { key: "time",  label: "Time",     sortable: false },
                      { key: "b2b",   label: "B2b Price", sortable: false },
                      { key: "recv",  label: "Amt Received", sortable: false },
                      { key: "bal",   label: "Balance Due",  sortable: false },
                      { key: "sell",  label: "Selling Amt",  sortable: false },
                      { key: "status",label: "Status",   sortable: false },
                      { key: "settle",label: "Settle Amt", sortable: false },
                      { key: "action",label: "Action",   sortable: false },
                    ].map(({ key, label, sortable }) => (
                      <th
                        key={key}
                        onClick={sortable ? () => handleSort(sortable ? (key === "date" ? "date" : "yacht") : null) : undefined}
                        style={{
                          padding: "11px 14px", fontWeight: 700, fontSize: "0.77rem", textAlign: "left",
                          whiteSpace: "nowrap", letterSpacing: "0.03em", textTransform: "uppercase",
                          cursor: sortable ? "pointer" : "default",
                          userSelect: "none",
                        }}
                      >
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                          {label}
                          {sortable && (
                            <span style={{ display: "inline-flex", flexDirection: "column", gap: 1, opacity: sortKey === (key === "date" ? "date" : "yacht") ? 1 : 0.35 }}>
                              <svg width="7" height="5" viewBox="0 0 7 5" fill="currentColor" style={{ opacity: (sortKey === (key === "date" ? "date" : "yacht") && sortDir === "asc") ? 1 : 0.4 }}><path d="M3.5 0L7 5H0z"/></svg>
                              <svg width="7" height="5" viewBox="0 0 7 5" fill="currentColor" style={{ opacity: (sortKey === (key === "date" ? "date" : "yacht") && sortDir === "desc") ? 1 : 0.4 }}><path d="M3.5 5L0 0h7z"/></svg>
                            </span>
                          )}
                        </span>
                      </th>
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
                        <td style={{ padding: "10px 14px", fontWeight: 700, whiteSpace: "nowrap", color: (Number(bk.quotedAmount||0) - Number(bk.pendingAmount||0)) > 0 ? "#7c3aed" : "#cbd5e1" }}>
                          {fmtINR(Number(bk.quotedAmount||0) - Number(bk.pendingAmount||0))}
                        </td>
                        <td style={{ padding: "10px 14px", fontWeight: 700, whiteSpace: "nowrap", color: bk.pendingAmount > 0 ? "#b45309" : "#22c55e" }}>
                          {bk.pendingAmount > 0 ? fmtINR(bk.pendingAmount) : <span style={{fontSize:"0.75rem"}}>NIL</span>}
                        </td>
                        <td style={{ padding: "10px 14px", color: "#15803d", fontWeight: 700, whiteSpace: "nowrap" }}>{fmtINR(bk.quotedAmount)}</td>
                        <td style={{ padding: "10px 14px" }}><StatusBadge booking={bk} /></td>
                        <td style={{ padding: "8px 14px" }}>
                          {bk.pendingAmount > 0 && bk.status !== "cancelled" ? (
                            <input
                              type="number"
                              placeholder={`Max ₹${Number(bk.pendingAmount).toLocaleString("en-IN")}`}
                              value={s.balance || ""}
                              onChange={e => setBalance(bk._id, e.target.value)}
                              style={{ width: 130, padding: "5px 8px", borderRadius: 6, border: "1.5px solid #6ee7b7", fontSize: "0.8rem", color: "#1e293b", background: "#f0fdf4", outline: "none" }}
                            />
                          ) : (
                            <span style={{ fontSize: "0.75rem", color: "#cbd5e1" }}>—</span>
                          )}
                        </td>
                        <td style={{ padding: "8px 14px" }}>
                          {bk.pendingAmount > 0 && bk.status !== "cancelled" ? (
                            <button
                              disabled={completing === bk._id}
                              onClick={() => handleMarkComplete(bk)}
                              style={{ padding: "5px 12px", borderRadius: 7, border: "1.5px solid #15803d", background: completing === bk._id ? "#f0fdf4" : "#fff", color: "#15803d", fontWeight: 700, fontSize: "0.75rem", cursor: completing === bk._id ? "not-allowed" : "pointer", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 5, opacity: completing === bk._id ? 0.7 : 1 }}
                            >
                              {completing === bk._id ? "Saving…" : "Mark Complete"}
                            </button>
                          ) : bk.pendingAmount <= 0 ? (
                            <span style={{ fontSize: "0.75rem", color: "#22c55e", fontWeight: 700 }}>Done</span>
                          ) : (
                            <span style={{ fontSize: "0.75rem", color: "#cbd5e1" }}>—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Mobile Cards ── */}
          <div className="d-md-none" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {filtered.map((bk) => {
              const s        = settlement[bk._id] || {};
              const rowGreen = s.settled;
              const hasPending = bk.pendingAmount > 0 && bk.status !== "cancelled";
              const amtReceived = Number(bk.quotedAmount||0) - Number(bk.pendingAmount||0);
              return (
                <div key={bk._id} style={{ background: rowGreen ? "rgba(16,185,129,0.06)" : "#fff", borderLeft: `3px solid ${rowGreen ? "#10b981" : bk.pendingAmount > 0 ? "#f59e0b" : "#22c55e"}`, borderRadius: 10, padding: "10px 12px", boxShadow: "0 1px 6px rgba(5,24,41,0.07)", border: `1px solid ${rowGreen ? "rgba(16,185,129,0.3)" : "#e8edf2"}`, transition: "all 0.2s" }}>

                  {/* Row 1: Name + Status */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, color: "#0a2d4a", fontSize: "0.88rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{bk.customerId?.name || "—"}</div>
                      <div style={{ fontSize: "0.72rem", color: "#64748b" }}>{bk.customerId?.contact || ""} {bk.numPeople ? `· ${bk.numPeople} pax` : ""}</div>
                    </div>
                    <StatusBadge booking={bk} />
                  </div>

                  {/* Row 2: Yacht + Date + Time */}
                  <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: "0.75rem", color: "#0a2d4a", fontWeight: 600 }}>{bk.yachtId?.name || "—"}</span>
                    <span style={{ fontSize: "0.72rem", color: "#94a3b8" }}>·</span>
                    <span style={{ fontSize: "0.72rem", color: "#64748b" }}>{fmtDate(bk.date)}</span>
                    <span style={{ fontSize: "0.72rem", color: "#94a3b8" }}>·</span>
                    <span style={{ fontSize: "0.72rem", color: "#64748b" }}>{to12h(bk.startTime)}–{to12h(bk.endTime)}</span>
                  </div>

                  {/* Row 3: Financial — 2×2 grid, values never get cut off */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 8px", marginBottom: hasPending ? 8 : 0 }}>
                    <MiniStat label="B2b Cost"    value={fmtINR(bk.yachtId?.runningCost)} color="#9a3412" />
                    <MiniStat label="Amt Received" value={fmtINR(amtReceived)} color={amtReceived > 0 ? "#7c3aed" : "#94a3b8"} />
                    <MiniStat label="Balance Due"  value={bk.pendingAmount > 0 ? fmtINR(bk.pendingAmount) : "NIL"} color={bk.pendingAmount > 0 ? "#b45309" : "#22c55e"} />
                    <MiniStat label="Selling Amt"  value={fmtINR(bk.quotedAmount)} color="#15803d" />
                  </div>

                  {/* Row 4: Settle + Mark Complete (only when pending) */}
                  {hasPending && (
                    <div style={{ display: "flex", gap: 8, alignItems: "center", paddingTop: 8, borderTop: "1px solid #f1f5f9" }}>
                      <input
                        type="number"
                        placeholder={`Amt (max ₹${Number(bk.pendingAmount).toLocaleString("en-IN")})`}
                        value={s.balance || ""}
                        onChange={e => setBalance(bk._id, e.target.value)}
                        style={{ flex: 1, padding: "5px 8px", borderRadius: 6, border: "1.5px solid #6ee7b7", fontSize: "0.78rem", background: "#f0fdf4", outline: "none", color: "#1e293b", minWidth: 0 }}
                      />
                      <button
                        disabled={completing === bk._id}
                        onClick={() => handleMarkComplete(bk)}
                        style={{ flexShrink: 0, padding: "5px 12px", borderRadius: 7, border: "1.5px solid #15803d", background: "#f0fdf4", color: "#15803d", fontWeight: 700, fontSize: "0.75rem", cursor: completing === bk._id ? "not-allowed" : "pointer", opacity: completing === bk._id ? 0.7 : 1, whiteSpace: "nowrap" }}
                      >
                        {completing === bk._id ? "Saving…" : "Done"}
                      </button>
                    </div>
                  )}
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

function MiniStat({ label, value, color }) {
  return (
    <div style={{ background: "#f8fafc", borderRadius: 7, padding: "5px 8px" }}>
      <div style={{ fontSize: "0.62rem", color: "#94a3b8", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", lineHeight: 1.2, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: "0.82rem", color: color || "#1e293b", fontWeight: 700, lineHeight: 1.2 }}>{value}</div>
    </div>
  );
}