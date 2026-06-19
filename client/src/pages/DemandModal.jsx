import React, { useState, useRef, useEffect } from "react";
import ReactDOM from "react-dom";
import { searchCustomersByNameAPI } from "../services/operations/customerAPI";
import { getEmployeesForBookingAPI } from "../services/operations/employeeAPI";
import { getAllYachtsDetailsAPI } from "../services/operations/yautAPI";
import { apiConnector } from "../services/apiConnector";
import { demand as demandApi } from "../services/apis";
import BookingDatePicker from "../components/BookingDatePicker";
import toast from "react-hot-toast";

/* ─────────────────────────────────────────
   Shared label + input styles
   ───────────────────────────────────────── */
const S = {
  label: {
    fontSize: "0.7rem", fontWeight: 700, color: "#64748b",
    textTransform: "uppercase", letterSpacing: "0.07em",
    marginBottom: 5, display: "block",
  },
  input: {
    width: "100%", padding: "10px 14px", borderRadius: 10,
    border: "1.5px solid #e2e8f0", fontSize: "0.9rem",
    color: "#0a2d4a", outline: "none", background: "#fff",
    boxSizing: "border-box", fontFamily: "inherit",
  },
  errorBorder: { border: "1.5px solid #f87171" },
};

/* ─────────────────────────────────────────
   TypeaheadInput
   Supports:
     onFocus  — called when input is focused (use to show all options)
     required — shows red border when empty and submitted
   ───────────────────────────────────────── */
function TypeaheadInput({
  label, value, onChange, suggestions, onSelect,
  placeholder, loading, onFocus, error,
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const h = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  useEffect(() => {
    if (suggestions.length > 0) setOpen(true);
  }, [suggestions]);

  return (
    <div ref={ref} style={{ position: "relative", marginBottom: 14 }}>
      <label style={S.label}>{label}</label>
      <div style={{ position: "relative" }}>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => { onFocus && onFocus(); setOpen(true); }}
          placeholder={placeholder}
          style={{ ...S.input, ...(error ? S.errorBorder : {}) }}
          autoComplete="off"
        />
        {loading && (
          <div style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)" }}>
            <div style={{ width: 14, height: 14, border: "2px solid #e2e8f0", borderTopColor: "#1d6fa4", borderRadius: "50%", animation: "dm-spin 0.7s linear infinite" }} />
          </div>
        )}
        {value && (
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); onChange(""); }}
            style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", width: 18, height: 18, borderRadius: "50%", border: "none", background: "#cbd5e1", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, lineHeight: 1 }}
          >×</button>
        )}
      </div>
      {open && suggestions.length > 0 && (
        <div style={{ position: "absolute", left: 0, right: 0, top: "100%", zIndex: 99999, background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 10, boxShadow: "0 8px 24px rgba(5,24,41,0.15)", maxHeight: 180, overflowY: "auto", marginTop: 2 }}>
          {suggestions.map((item, i) => (
            <div
              key={item._id || i}
              onMouseDown={() => { onSelect(item); setOpen(false); }}
              style={{ padding: "9px 14px", cursor: "pointer", borderBottom: "1px solid #f1f5f9", fontSize: "0.88rem", color: "#0a2d4a" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#f0f7ff")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}
            >
              <div style={{ fontWeight: 600 }}>{item.name}</div>
              {item.contact && <div style={{ fontSize: "0.73rem", color: "#94a3b8" }}>{item.contact}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────
   Clock Time Picker
   ───────────────────────────────────────── */
const HOURS   = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
const R = 80;
const CX = 100, CY = 100;

function ClockTimePicker({ value, onConfirm, onCancel }) {
  const parse = () => {
    if (!value) return { h: 7, m: 0, ap: "AM" };
    const [hh, mm] = value.split(":").map(Number);
    const ap = hh < 12 ? "AM" : "PM";
    const h12 = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh;
    return { h: h12, m: mm || 0, ap };
  };
  const init = parse();

  const [hour,   setHour]   = useState(init.h);
  const [minute, setMinute] = useState(init.m);
  const [ampm,   setAmpm]   = useState(init.ap);
  const [phase,  setPhase]  = useState("hour");
  const [mode,   setMode]   = useState("clock");
  const [kbVal,  setKbVal]  = useState("");

  const to24 = (h, m, ap) => {
    let h24 = h;
    if (ap === "AM" && h === 12) h24 = 0;
    else if (ap === "PM" && h !== 12) h24 = h + 12;
    return `${String(h24).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  };

  const handDeg = phase === "hour"
    ? (hour % 12) * 30 - 90
    : (minute / 60) * 360 - 90;
  const handRad = handDeg * Math.PI / 180;
  const handLen = R - 14;
  const hx = CX + handLen * Math.cos(handRad);
  const hy = CY + handLen * Math.sin(handRad);
  const items   = phase === "hour" ? HOURS : MINUTES;
  const selected = phase === "hour" ? hour : minute;

  const handleSvgClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * 200;
    const svgY = ((e.clientY - rect.top) / rect.height) * 200;
    const dx = svgX - CX, dy = svgY - CY;
    let angle = Math.atan2(dy, dx) * 180 / Math.PI + 90;
    angle = ((angle % 360) + 360) % 360;
    if (phase === "hour") {
      let h = Math.round(angle / 30) % 12;
      if (h === 0) h = 12;
      setHour(h);
      setTimeout(() => setPhase("minute"), 200);
    } else {
      const raw = Math.round(angle / 6) % 60;
      setMinute(Math.round(raw / 5) * 5 % 60);
    }
  };

  const handleOK = () => {
    if (mode === "keyboard") {
      const m = kbVal.match(/^(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)?$/i);
      if (!m) { toast.error("Use format  HH:MM AM"); return; }
      const ap = (m[3] || ampm).toUpperCase();
      onConfirm(to24(Number(m[1]), Number(m[2]), ap));
    } else {
      onConfirm(to24(hour, minute, ampm));
    }
  };

  return (
    <div style={{ background: "#fff", borderRadius: 14, border: "1.5px solid #e2e8f0", boxShadow: "0 8px 28px rgba(5,24,41,0.14)", overflow: "hidden" }}>
      <div style={{ background: "#0a2d4a", padding: "8px 16px", color: "#c9a84c", fontSize: "0.65rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em" }}>
        Select Time
      </div>
      {mode === "clock" ? (
        <div style={{ display: "flex", alignItems: "stretch" }}>
          <div style={{ padding: "16px 14px 8px", minWidth: 148, display: "flex", flexDirection: "column", justifyContent: "center", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button onClick={() => setPhase("hour")} style={{ width: 64, padding: "8px 0", borderRadius: 8, border: "none", background: phase === "hour" ? "#dbeafe" : "#f1f5f9", color: phase === "hour" ? "#0a2d4a" : "#64748b", fontSize: "2rem", fontWeight: 800, cursor: "pointer", textAlign: "center" }}>
                {String(hour).padStart(2, "0")}
              </button>
              <span style={{ fontSize: "2rem", fontWeight: 800, color: "#0a2d4a" }}>:</span>
              <button onClick={() => setPhase("minute")} style={{ width: 64, padding: "8px 0", borderRadius: 8, border: "none", background: phase === "minute" ? "#dbeafe" : "#f1f5f9", color: phase === "minute" ? "#0a2d4a" : "#64748b", fontSize: "2rem", fontWeight: 800, cursor: "pointer", textAlign: "center" }}>
                {String(minute).padStart(2, "0")}
              </button>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {["AM", "PM"].map((ap) => (
                <button key={ap} onClick={() => setAmpm(ap)} style={{ flex: 1, padding: "7px 0", borderRadius: 8, border: `1.5px solid ${ampm === ap ? "#0a2d4a" : "#e2e8f0"}`, background: ampm === ap ? "#0a2d4a" : "#fff", color: ampm === ap ? "#c9a84c" : "#475569", fontWeight: 700, fontSize: "0.82rem", cursor: "pointer" }}>
                  {ap}
                </button>
              ))}
            </div>
          </div>
          <div style={{ flex: 1, padding: "10px 10px 0", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="200" height="200" style={{ cursor: "pointer", overflow: "visible" }} onClick={handleSvgClick}>
              <circle cx={CX} cy={CY} r={96} fill="#f1f5f9" />
              <line x1={CX} y1={CY} x2={hx} y2={hy} stroke="#0a2d4a" strokeWidth={2.5} strokeLinecap="round" />
              <circle cx={CX} cy={CY} r={5} fill="#0a2d4a" />
              <circle cx={hx} cy={hy} r={10} fill="#0a2d4a" />
              {items.map((num, i) => {
                const a = (i / items.length) * 2 * Math.PI - Math.PI / 2;
                const x = CX + R * Math.cos(a);
                const y = CY + R * Math.sin(a);
                const isSel = num === selected;
                return (
                  <g key={num} onClick={(e) => { e.stopPropagation(); if (phase === "hour") { setHour(num); setTimeout(() => setPhase("minute"), 200); } else { setMinute(num); } }}>
                    {isSel && <circle cx={x} cy={y} r={16} fill="#0a2d4a" />}
                    <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fill={isSel ? "#c9a84c" : "#374151"} fontSize={isSel ? 13 : 12} fontWeight={isSel ? 700 : 500}>
                      {phase === "minute" && num === 0 ? "00" : num}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      ) : (
        <div style={{ padding: "20px 18px 8px" }}>
          <input type="text" value={kbVal} onChange={(e) => setKbVal(e.target.value)} placeholder="07:30 AM" style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1.5px solid #cbd5e1", fontSize: "1.5rem", fontWeight: 700, color: "#0a2d4a", letterSpacing: 4, outline: "none", textAlign: "center", boxSizing: "border-box" }} autoFocus />
          <p style={{ fontSize: "0.7rem", color: "#94a3b8", textAlign: "center", marginTop: 6, marginBottom: 0 }}>Format: HH:MM AM / PM</p>
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px 14px" }}>
        <button onClick={() => setMode(mode === "clock" ? "keyboard" : "clock")} title={mode === "clock" ? "Type manually" : "Use clock"} style={{ width: 34, height: 34, borderRadius: 8, border: "1px solid #e2e8f0", background: "#f8fafc", color: "#64748b", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {mode === "clock"
            ? <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="7" y1="10" x2="7.01" y2="10"/><line x1="12" y1="10" x2="12.01" y2="10"/><line x1="17" y1="10" x2="17.01" y2="10"/><line x1="7" y1="14" x2="13" y2="14"/></svg>
            : <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          }
        </button>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onCancel} style={{ padding: "7px 18px", borderRadius: 8, border: "1.5px solid #e2e8f0", background: "#fff", color: "#64748b", fontWeight: 700, fontSize: "0.83rem", cursor: "pointer" }}>CANCEL</button>
          <button onClick={handleOK} style={{ padding: "7px 18px", borderRadius: 8, border: "none", background: "#0a2d4a", color: "#c9a84c", fontWeight: 700, fontSize: "0.83rem", cursor: "pointer" }}>OK</button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   DemandModal (main export)
   ───────────────────────────────────────── */
export default function DemandModal({ user, onClose }) {
  const token = localStorage.getItem("authToken");

  /* Customer */
  const [custName,   setCustName]   = useState("");
  const [custId,     setCustId]     = useState(null);
  const [custSugg,   setCustSugg]   = useState([]);
  const [custLoad,   setCustLoad]   = useState(false);
  const custTimer = useRef(null);

  /* Agent */
  const [agentName,  setAgentName]  = useState("");
  const [agentId,    setAgentId]    = useState(null);
  const [agentAll,   setAgentAll]   = useState([]);
  const [agentSugg,  setAgentSugg]  = useState([]);

  /* Yacht */
  const [yachtName,  setYachtName]  = useState("");
  const [yachtId,    setYachtId]    = useState(null);
  const [yachtAll,   setYachtAll]   = useState([]);
  const [yachtSugg,  setYachtSugg]  = useState([]);

  /* Date & Time */
  const [date,       setDate]       = useState("");
  const [time24,     setTime24]     = useState("");
  const [showClock,  setShowClock]  = useState(false);

  /* Notes */
  const [notes,      setNotes]      = useState("");

  /* Validation highlight */
  const [showErrors, setShowErrors] = useState(false);

  const [saving,     setSaving]     = useState(false);

  /* Load agents + yachts once on mount */
  useEffect(() => {
    if (!token) return;
    getEmployeesForBookingAPI(token)
      .then((res) => setAgentAll(res?.data?.employees || res?.data?.data || []))
      .catch(() => {});
    getAllYachtsDetailsAPI(token)
      .then((res) => {
        const list = res?.data?.yachts || res?.yachts || res?.data || [];
        setYachtAll(Array.isArray(list) ? list : []);
      })
      .catch(() => {});
  }, [token]);

  /* ── Customer search (debounced API) ── */
  const handleCustChange = (val) => {
    setCustName(val); setCustId(null);
    clearTimeout(custTimer.current);
    if (val.length < 2) { setCustSugg([]); return; }
    setCustLoad(true);
    custTimer.current = setTimeout(async () => {
      try {
        const res = await searchCustomersByNameAPI(val, token);
        setCustSugg(res?.data?.customers || []);
      } catch { setCustSugg([]); }
      setCustLoad(false);
    }, 400);
  };

  /* ── Agent filter (local, shows all on focus) ── */
  const filterAgents = (val) =>
    val
      ? agentAll.filter((a) => a.name?.toLowerCase().includes(val.toLowerCase())).slice(0, 10)
      : agentAll.slice(0, 10);

  const handleAgentChange = (val) => {
    setAgentName(val); setAgentId(null);
    setAgentSugg(filterAgents(val));
  };

  /* ── Yacht filter (local, shows all on focus) ── */
  const filterYachts = (val) =>
    val
      ? yachtAll.filter((y) => y.name?.toLowerCase().includes(val.toLowerCase())).slice(0, 10)
      : yachtAll.slice(0, 10);

  const handleYachtChange = (val) => {
    setYachtName(val); setYachtId(null);
    setYachtSugg(filterYachts(val));
  };

  /* Format 24hr time → 12hr display */
  const fmt12 = (t) => {
    if (!t) return "";
    const [h, m] = t.split(":").map(Number);
    const ap = h < 12 ? "AM" : "PM";
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${h12}:${String(m).padStart(2, "0")} ${ap}`;
  };

  /* ── Validation ── */
  const custOrAgentMissing = !custName.trim() && !agentName.trim();

  /* ── Submit ── */
  const handleSave = async () => {
    if (custOrAgentMissing) {
      setShowErrors(true);
      toast.error("Enter at least Customer Name or Agent Name");
      return;
    }
    if (!date)   { toast.error("Date is required"); return; }
    if (!time24) { toast.error("Time is required"); return; }

    setSaving(true);
    try {
      await apiConnector(
        "POST",
        demandApi.CREATE_DEMAND_API,
        {
          customerName: custName || undefined,
          customerId:   custId   || undefined,
          agentName:    agentName || undefined,
          agentId:      agentId   || undefined,
          yachtName:    yachtName || undefined,
          yachtId:      yachtId   || undefined,
          date,
          time: time24,
          notes: notes.trim() || undefined,
        },
        { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
      );
      toast.success("Demand saved!");
      onClose();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to save — backend endpoint needed");
    } finally {
      setSaving(false);
    }
  };

  const custError  = showErrors && !custName.trim()  && !agentName.trim();
  const agentError = showErrors && !custName.trim()  && !agentName.trim();

  return ReactDOM.createPortal(
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, zIndex: 99998, background: "rgba(5,24,41,0.55)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
    >
      <div style={{ background: "#fff", borderRadius: 18, width: "100%", maxWidth: 480, maxHeight: "92vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(5,24,41,0.35)" }}>

        {/* ── Header ── */}
        <div style={{ background: "linear-gradient(135deg,#051829,#0a2d4a)", padding: "16px 20px", borderRadius: "18px 18px 0 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ color: "#c9a84c", fontWeight: 800, fontSize: "1.05rem" }}>New Demand</div>
            <div style={{ color: "#94a3b8", fontSize: "0.72rem", marginTop: 2 }}>Quick inquiry capture</div>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: "50%", border: "1.5px solid rgba(255,255,255,0.2)", background: "transparent", color: "#94a3b8", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>✕</button>
        </div>

        {/* ── Validation banner ── */}
        {showErrors && custOrAgentMissing && (
          <div style={{ background: "#fef2f2", borderBottom: "1px solid #fecaca", padding: "8px 20px", fontSize: "0.8rem", color: "#b91c1c", display: "flex", alignItems: "center", gap: 6 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            Customer Name or Agent Name is required
          </div>
        )}

        {/* ── Form ── */}
        <div style={{ padding: "20px 20px 4px" }}>

          {/* Customer */}
          <TypeaheadInput
            label="Customer Name"
            value={custName}
            onChange={handleCustChange}
            suggestions={custSugg}
            onSelect={(c) => { setCustName(c.name); setCustId(c._id); setCustSugg([]); }}
            placeholder="Search customer…"
            loading={custLoad}
            error={custError}
          />

          {/* Agent */}
          <TypeaheadInput
            label="Agent Name"
            value={agentName}
            onChange={handleAgentChange}
            suggestions={agentSugg}
            onSelect={(a) => { setAgentName(a.name); setAgentId(a._id); setAgentSugg([]); }}
            placeholder="Search agent…"
            loading={false}
            onFocus={() => setAgentSugg(filterAgents(agentName))}
            error={agentError}
          />

          {/* OR divider when both empty */}
          {showErrors && custOrAgentMissing && (
            <div style={{ textAlign: "center", fontSize: "0.7rem", color: "#f87171", marginTop: -8, marginBottom: 10, fontWeight: 700 }}>
              ↑ At least one of these is required ↑
            </div>
          )}

          {/* Yacht — searchable dropdown from master */}
          <TypeaheadInput
            label="Yacht Name"
            value={yachtName}
            onChange={handleYachtChange}
            suggestions={yachtSugg}
            onSelect={(y) => { setYachtName(y.name); setYachtId(y._id); setYachtSugg([]); }}
            placeholder="Select yacht…"
            loading={false}
            onFocus={() => setYachtSugg(filterYachts(yachtName))}
          />

          {/* Date — BookingDatePicker (same as dashboard) */}
          <div style={{ marginBottom: 14 }}>
            <label style={S.label}>Date *</label>
            <BookingDatePicker
              value={date}
              onChange={setDate}
              placeholder="Select date"
            />
          </div>

          {/* Time */}
          <div style={{ marginBottom: 14 }}>
            <label style={S.label}>Time *</label>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <div
                onClick={() => setShowClock(true)}
                style={{ ...S.input, display: "flex", alignItems: "center", cursor: "pointer", color: time24 ? "#0a2d4a" : "#94a3b8", minHeight: 42 }}
              >
                {time24 ? fmt12(time24) : "Tap to select time…"}
              </div>
              <button
                onClick={() => setShowClock((v) => !v)}
                title="Pick time"
                style={{ width: 42, height: 42, borderRadius: 10, border: `1.5px solid ${showClock ? "#0a2d4a" : "#e2e8f0"}`, background: showClock ? "#0a2d4a" : "#f8fafc", color: showClock ? "#c9a84c" : "#475569", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              </button>
            </div>
            {showClock && (
              <div style={{ marginTop: 10 }}>
                <ClockTimePicker
                  value={time24}
                  onConfirm={(t) => { setTime24(t); setShowClock(false); }}
                  onCancel={() => setShowClock(false)}
                />
              </div>
            )}
          </div>

          {/* Notes */}
          <div style={{ marginBottom: 16 }}>
            <label style={S.label}>Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any special requests, preferences, or additional info…"
              rows={3}
              style={{ ...S.input, resize: "vertical", minHeight: 72, lineHeight: 1.5 }}
            />
          </div>
        </div>

        {/* ── Footer ── */}
        <div style={{ padding: "8px 20px 20px", display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "11px 0", borderRadius: 10, border: "1.5px solid #e2e8f0", background: "#fff", color: "#475569", fontWeight: 700, fontSize: "0.9rem", cursor: "pointer" }}>
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{ flex: 2, padding: "11px 0", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#0a2d4a,#1d6fa4)", color: "#fff", fontWeight: 700, fontSize: "0.9rem", cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
          >
            {saving
              ? <><div style={{ width: 15, height: 15, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "dm-spin 0.7s linear infinite" }} /> Saving…</>
              : "Save Demand"}
          </button>
        </div>
      </div>

      <style>{`@keyframes dm-spin { to { transform: rotate(360deg); } }`}</style>
    </div>,
    document.body
  );
}
