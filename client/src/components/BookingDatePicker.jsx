import React, { useState, useRef, useEffect } from "react";
import "../pages/Bookings.css";

const CAL_MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const CAL_MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const CAL_DAYS = ["Su","Mo","Tu","We","Th","Fr","Sa"];

const getTodayIST = () => {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
};

export default function BookingDatePicker({ value, onChange, minDate, disabled, placeholder = "Select date", label }) {
  const today    = getTodayIST();
  const initYear  = value ? parseInt(value.slice(0, 4))   : new Date().getFullYear();
  const initMonth = value ? parseInt(value.slice(5, 7))-1 : new Date().getMonth();

  const [calYear, setCalYear]   = useState(initYear);
  const [calMonth, setCalMonth] = useState(initMonth);
  const [showCal, setShowCal]   = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (value) {
      setCalYear(parseInt(value.slice(0, 4)));
      setCalMonth(parseInt(value.slice(5, 7))-1);
    }
  }, [value]);

  useEffect(() => {
    if (!showCal) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setShowCal(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showCal]);

  const navigateMonth = (dir) => {
    let m = calMonth + dir, y = calYear;
    if (m < 0)  { m = 11; y--; }
    if (m > 11) { m = 0;  y++; }
    setCalMonth(m); setCalYear(y);
  };

  const buildCells = () => {
    const firstDay = new Date(calYear, calMonth, 1).getDay();
    const total    = new Date(calYear, calMonth+1, 0).getDate();
    const cells = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= total; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  };

  const formatLabel = (ds) => {
    if (!ds) return "";
    const [, m, d] = ds.split("-");
    return `${parseInt(d)} ${CAL_MONTHS_SHORT[parseInt(m)-1]}`;
  };

  const isBefore = (ds) => minDate && ds < minDate;

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        className={`bk-cal-trigger${value ? " active" : ""}`}
        style={{
          width: "100%", justifyContent: "flex-start",
          height: 42, borderRadius: 10, fontSize: 14,
          opacity: disabled ? 0.5 : 1, cursor: disabled ? "not-allowed" : "pointer",
        }}
        disabled={disabled}
        onClick={() => !disabled && setShowCal(v => !v)}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8"  y1="2" x2="8"  y2="6"/>
          <line x1="3"  y1="10" x2="21" y2="10"/>
        </svg>
        <span className="bk-cal-label" style={{ flex: 1, textAlign: "left", fontSize: 14 }}>
          {value
            ? formatLabel(value)
            : <span style={{ color: "#94a3b8", fontWeight: 400 }}>{placeholder}</span>}
        </span>
        {value && !disabled && (
          <span
            className="bk-cal-clear"
            onClick={(e) => { e.stopPropagation(); onChange(""); }}
          >×</span>
        )}
      </button>

      {showCal && (
        <div className="bk-cal-panel" style={{ zIndex: 10000 }}>
          <div className="bk-cal-hdr">
            <button type="button" className="bk-cal-nav" onClick={() => navigateMonth(-1)}>‹</button>
            <span className="bk-cal-month-label">{CAL_MONTHS[calMonth]} {calYear}</span>
            <button type="button" className="bk-cal-nav" onClick={() => navigateMonth(1)}>›</button>
          </div>
          <div className="bk-cal-weekdays">
            {CAL_DAYS.map(d => <span key={d}>{d}</span>)}
          </div>
          <div className="bk-cal-grid">
            {buildCells().map((day, i) => {
              if (!day) return <div key={`e-${i}`} />;
              const ds = `${calYear}-${String(calMonth+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
              const isSel     = value === ds;
              const isTdy     = today === ds;
              const isBeforeD = isBefore(ds);
              return (
                <button
                  key={ds}
                  type="button"
                  className={`bk-cal-day${isSel ? " sel" : ""}${isTdy && !isSel ? " tdy" : ""}`}
                  style={isBeforeD ? { opacity: 0.3, cursor: "not-allowed", pointerEvents: "none" } : {}}
                  onClick={() => { if (!isBeforeD) { onChange(ds); setShowCal(false); } }}
                >{day}</button>
              );
            })}
          </div>
          <div className="bk-cal-footer">
            <button type="button" onClick={() => { onChange(today); setShowCal(false); }}>Today</button>
            {value && (
              <button type="button" onClick={() => { onChange(""); setShowCal(false); }}>Clear</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
