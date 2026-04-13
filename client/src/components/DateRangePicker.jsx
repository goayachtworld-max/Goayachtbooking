import React, { useState, useRef, useEffect } from "react";
import styles from "../styles/DateRangePicker.module.css";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYS_SHORT = ["Su","Mo","Tu","We","Th","Fr","Sa"];

function toISO(date) {
  return date.toISOString().slice(0, 10);
}
function parseISO(str) {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function fmtShort(iso) {
  if (!iso) return "—";
  return parseISO(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
function todayISO() {
  return toISO(new Date());
}

export default function DateRangePicker({ fromDate, toDate, onChange, inline = false }) {
  const [open, setOpen]           = useState(inline);
  const [phase, setPhase]         = useState("from");
  const [hover, setHover]         = useState(null);
  const [draft, setDraft]         = useState({ from: fromDate, to: toDate });
  const [viewYear, setViewYear]   = useState(() => { const d = fromDate ? parseISO(fromDate) : new Date(); return d.getFullYear(); });
  const [viewMonth, setViewMonth] = useState(() => { const d = fromDate ? parseISO(fromDate) : new Date(); return d.getMonth(); });
  const wrapRef = useRef(null);

  useEffect(() => { setDraft({ from: fromDate, to: toDate }); }, [fromDate, toDate]);

  useEffect(() => {
    if (inline || !open) return;
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, inline]);

  const daysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();
  const firstDay    = (y, m) => new Date(y, m, 1).getDay();

  const buildCells = () => {
    const cells = [];
    for (let i = 0; i < firstDay(viewYear, viewMonth); i++) cells.push(null);
    for (let d = 1; d <= daysInMonth(viewYear, viewMonth); d++) cells.push(d);
    return cells;
  };

  const cellISO = (d) =>
    `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  const prevMonth = () => {
    setViewMonth((m) => { if (m === 0) { setViewYear((y) => y - 1); return 11; } return m - 1; });
  };
  const nextMonth = () => {
    setViewMonth((m) => { if (m === 11) { setViewYear((y) => y + 1); return 0; } return m + 1; });
  };

  const handleDayClick = (ds) => {
    if (phase === "from") {
      setDraft({ from: ds, to: ds });
      setPhase("to");
    } else {
      let f = draft.from, t = ds;
      if (t < f) { f = ds; t = draft.from; }
      setDraft({ from: f, to: t });
      setPhase("from");
      onChange(f, t);
      if (!inline) setOpen(false);
    }
  };

  const applyPreset = (days) => {
    const f = todayISO();
    const end = new Date();
    end.setDate(end.getDate() + days - 1);
    const t = toISO(end);
    setDraft({ from: f, to: t });
    setPhase("from");
    onChange(f, t);
    if (!inline) setOpen(false);
  };

  const today = todayISO();

  const effectiveTo = phase === "to" && hover && hover >= draft.from ? hover : draft.to;

  const isDayFrom    = (ds) => ds === draft.from;
  const isDayTo      = (ds) => ds === effectiveTo && ds !== draft.from;
  const isDayInRange = (ds) => draft.from && effectiveTo && ds > draft.from && ds < effectiveTo;
  const isDayToday   = (ds) => ds === today;
  const isDayDisabled = (ds) => phase === "to" && draft.from && ds < draft.from;

  const calendar = (
    <div className={styles.panel}>
      {/* From/To status strip */}
      <div className={styles.selRow}>
        <button
          className={`${styles.selBtn} ${phase === "from" ? styles.selBtnActive : ""}`}
          onClick={() => setPhase("from")}
        >
          <span className={styles.selLabel}>From</span>
          <span className={styles.selVal}>{fmtShort(draft.from)}</span>
        </button>
        <svg className={styles.selArrow} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14M13 6l6 6-6 6"/>
        </svg>
        <button
          className={`${styles.selBtn} ${phase === "to" ? styles.selBtnActive : ""}`}
          onClick={() => setPhase("to")}
        >
          <span className={styles.selLabel}>To</span>
          <span className={styles.selVal}>{fmtShort(draft.to)}</span>
        </button>
      </div>

      {/* Month nav */}
      <div className={styles.monthNav}>
        <button className={styles.navArrow} onClick={prevMonth}>‹</button>
        <span className={styles.monthLabel}>{MONTHS[viewMonth]} {viewYear}</span>
        <button className={styles.navArrow} onClick={nextMonth}>›</button>
      </div>

      {/* Weekday labels */}
      <div className={styles.weekdays}>
        {DAYS_SHORT.map((d) => <span key={d}>{d}</span>)}
      </div>

      {/* Day grid */}
      <div className={styles.grid}>
        {buildCells().map((day, i) => {
          if (!day) return <div key={`e${i}`} className={styles.empty} />;
          const ds = cellISO(day);
          const isFrom    = isDayFrom(ds);
          const isTo      = isDayTo(ds);
          const inRange   = isDayInRange(ds);
          const isToday   = isDayToday(ds);
          const disabled  = isDayDisabled(ds);
          return (
            <button
              key={ds}
              disabled={disabled}
              className={[
                styles.day,
                isFrom    ? styles.dayFrom    : "",
                isTo      ? styles.dayTo      : "",
                inRange   ? styles.dayInRange : "",
                isToday && !isFrom && !isTo ? styles.dayToday : "",
                disabled  ? styles.dayDisabled : "",
              ].filter(Boolean).join(" ")}
              onClick={() => !disabled && handleDayClick(ds)}
              onMouseEnter={() => phase === "to" && setHover(ds)}
              onMouseLeave={() => setHover(null)}
            >
              {day}
            </button>
          );
        })}
      </div>

      {/* Quick presets */}
      <div className={styles.presets}>
        <button onClick={() => applyPreset(1)}>Today</button>
        <button onClick={() => applyPreset(7)}>7 days</button>
        <button onClick={() => applyPreset(14)}>14 days</button>
        <button onClick={() => applyPreset(30)}>30 days</button>
      </div>
    </div>
  );

  if (inline) return <div className={styles.inlineWrap}>{calendar}</div>;

  return (
    <div ref={wrapRef} className={styles.wrap}>
      <button
        className={`${styles.trigger} ${open ? styles.triggerOpen : ""}`}
        onClick={() => { setOpen((v) => !v); setPhase("from"); }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        <span className={styles.triggerFrom}>{fmtShort(fromDate)}</span>
        <span className={styles.triggerSep}>→</span>
        <span className={styles.triggerTo}>{fmtShort(toDate)}</span>
      </button>

      {open && calendar}
    </div>
  );
}
