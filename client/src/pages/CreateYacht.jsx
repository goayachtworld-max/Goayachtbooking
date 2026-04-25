import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createYacht as createYachtAPI } from "../services/operations/yautAPI";
import { toast } from "react-hot-toast";

const SLOT_OPTIONS = [
  { value: "15:30", label: "3:30 PM – 5:30 PM" },
  { value: "16:00", label: "4:00 PM – 6:00 PM" },
  { value: "17:30", label: "5:30 PM – 7:30 PM" },
  { value: "18:00", label: "6:00 PM – 8:00 PM" },
];

function convertMinutesToHHMM(mins) {
  const h = String(Math.floor(mins / 60)).padStart(2, "0");
  const m = String(mins % 60).padStart(2, "0");
  return `${h}:${m}`;
}

function convertTo24Hour(timeStr) {
  if (!timeStr || timeStr === "none") return "";
  if (/^\d{2}:\d{2}$/.test(timeStr)) return timeStr;
  const parts = timeStr.split(" ");
  if (parts.length !== 2) return "";
  const [time, modifier] = parts;
  let [hours, minutes] = time.split(":").map(Number);
  if (modifier === "PM" && hours < 12) hours += 12;
  if (modifier === "AM" && hours === 12) hours = 0;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

const CSS = `
  @keyframes cy-fade { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
  .cy-wrap { background:#f1f5f9; min-height:100dvh; padding:80px 16px 40px; font-family:system-ui,-apple-system,'Segoe UI',sans-serif; }
  .cy-inner { max-width:980px; margin:0 auto; animation:cy-fade 0.22s ease; }
  .cy-input, .cy-select {
    width:100%; height:42px; padding:0 12px;
    border:1.5px solid #e2e8f0; border-radius:10px;
    font-size:0.9rem; color:#1e293b; background:#fff;
    outline:none; box-sizing:border-box; font-family:inherit;
    transition:border-color .15s, box-shadow .15s;
  }
  .cy-input:focus, .cy-select:focus {
    border-color:#1d6fa4;
    box-shadow:0 0 0 3px rgba(29,111,164,.12);
  }
  .cy-input.err, .cy-select.err { border-color:#dc2626; }
  .cy-input::placeholder { color:#94a3b8; }
  .cy-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:14px 16px; }
  @media(max-width:800px) { .cy-grid { grid-template-columns:repeat(2,1fr); } .cy-span3 { grid-column:span 2 !important; } }
  @media(max-width:540px) { .cy-grid { grid-template-columns:1fr; } .cy-span2,.cy-span3 { grid-column:span 1 !important; } .cy-wrap { padding-top:70px; padding-bottom:84px; } }
  .cy-span2 { grid-column:span 2; }
  .cy-span3 { grid-column:span 3; }
  .cy-drop-zone {
    border:2px dashed #cbd5e1; border-radius:12px;
    padding:28px 20px; text-align:center;
    background:#f8fafc; cursor:pointer;
    transition:border-color .15s, background .15s;
  }
  .cy-drop-zone:hover { border-color:#1d6fa4; background:#f0f7fd; }
  .cy-preview-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(100px,1fr)); gap:10px; margin-top:14px; }
  .cy-preview-item { position:relative; border-radius:10px; overflow:hidden; aspect-ratio:1; border:1.5px solid #e2e8f0; }
  .cy-preview-item img { width:100%; height:100%; object-fit:cover; display:block; }
  .cy-preview-remove {
    position:absolute; top:5px; right:5px;
    width:22px; height:22px; border-radius:50%;
    background:rgba(0,0,0,0.55); border:none; color:#fff;
    font-size:11px; cursor:pointer; display:flex; align-items:center; justify-content:center;
    transition:background .15s;
  }
  .cy-preview-remove:hover { background:rgba(220,38,38,0.9); }
  .cy-submit {
    width:100%; height:50px; border-radius:12px; border:none;
    background:linear-gradient(135deg,#051829,#0a2d4a);
    color:#e8d5a0; font-size:1rem; font-weight:700;
    cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px;
    font-family:inherit; letter-spacing:0.02em;
    transition:opacity .15s, transform .1s;
    box-shadow:0 4px 18px rgba(5,24,41,0.22);
  }
  .cy-submit:hover { opacity:0.9; }
  .cy-submit:active { transform:scale(.99); }
  .cy-submit:disabled { opacity:0.6; cursor:not-allowed; }
  .cy-spinner {
    width:18px; height:18px; border:2.5px solid rgba(232,213,160,0.3);
    border-top-color:#e8d5a0; border-radius:50%; animation:cy-spin .7s linear infinite;
  }
  @keyframes cy-spin { to { transform:rotate(360deg); } }
`;

function SectionCard({ dot, title, hint, children }) {
  return (
    <div style={{
      background: "#fff", borderRadius: 14, border: "1px solid #e8eef5",
      boxShadow: "0 2px 12px rgba(0,0,0,0.06)", padding: "20px 22px", marginBottom: 16,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: dot, flexShrink: 0 }} />
        <span style={{ fontSize: "0.78rem", fontWeight: 800, color: "#1e293b", textTransform: "uppercase", letterSpacing: "0.07em" }}>{title}</span>
        {hint && <span style={{ fontSize: "0.75rem", fontWeight: 400, color: "#94a3b8", textTransform: "none", letterSpacing: 0 }}>{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Field({ label, required, error, hint, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
      <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {label}{required && <span style={{ color: "#dc2626", marginLeft: 2 }}>*</span>}
        {hint && <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, color: "#94a3b8", marginLeft: 5, fontSize: "0.7rem" }}>{hint}</span>}
      </label>
      {children}
      {error && <span style={{ fontSize: "0.72rem", color: "#dc2626", fontWeight: 600 }}>{error}</span>}
    </div>
  );
}

// Read-only display box — used for auto-calculated fields
function CalcDisplay({ value, highlight, empty = "—" }) {
  const hasValue = value !== null && value !== undefined && value !== 0 && value !== "";
  return (
    <div style={{
      height: 42, borderRadius: 10, padding: "0 14px",
      background: hasValue
        ? highlight
          ? "linear-gradient(90deg,rgba(99,102,241,0.1),rgba(99,102,241,0.04))"
          : "linear-gradient(90deg,rgba(16,185,129,0.08),rgba(16,185,129,0.04))"
        : "#f8fafc",
      border: `1.5px solid ${hasValue ? (highlight ? "rgba(99,102,241,0.4)" : "rgba(16,185,129,0.35)") : "#e2e8f0"}`,
      display: "flex", alignItems: "center", gap: 6,
      fontSize: "0.95rem", fontWeight: 700,
      color: hasValue ? (highlight ? "#4f46e5" : "#059669") : "#94a3b8",
    }}>
      {hasValue ? `₹ ${Number(value).toLocaleString("en-IN")}` : empty}
    </div>
  );
}

function CreateYacht() {
  const navigate = useNavigate();

  const [yacht, setYacht] = useState({
    name: "",
    capacity: "",
    sailingCost: "",
    anchorageCost: "",
    sailingMargin: "",
    anchorageMargin: "",
    defaultSailingHours: "",
    defaultAnchoringHours: "",
    maxSellingPrice: "",
    sailStartTime: "06:00",
    sailEndTime: "20:00",
    duration: "120",
    customDuration: "",
    specialSlot1: null,
    specialSlot2: null,
    boardingLocation: "",
    photos: [],
    status: "active",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [photoError, setPhotoError] = useState("");
  const [photoPreviews, setPhotoPreviews] = useState([]);

  const slotDurationHours = (() => {
    if (yacht.duration === "custom") return Number(yacht.customDuration || 0) / 60;
    return Number(yacht.duration || 0) / 60;
  })();

  // ── Derived values ──────────────────────────────────────────────
  const sHrs = Number(yacht.defaultSailingHours || 0);
  const aHrs = Number(yacht.defaultAnchoringHours || 0);

  // Running cost: raw cost × hours (no margin)
  const runningCost =
    (Number(yacht.sailingCost || 0) * sHrs) +
    (Number(yacht.anchorageCost || 0) * aHrs);

  // Selling price: (cost + margin) × hours — fully auto-calculated
  const sellingPrice =
    ((Number(yacht.sailingCost || 0) + Number(yacht.sailingMargin || 0)) * sHrs) +
    ((Number(yacht.anchorageCost || 0) + Number(yacht.anchorageMargin || 0)) * aHrs);

  const sv = parseFloat(yacht.defaultSailingHours);
  const av = parseFloat(yacht.defaultAnchoringHours);
  const totalHrs = (sv || 0) + (av || 0);
  const sPct = totalHrs > 0 ? Math.round((sv || 0) / totalHrs * 100) : 0;
  const aPct = 100 - sPct;
  const isHoursOver = slotDurationHours > 0 && totalHrs > slotDurationHours + 0.001;
  const hoursMatchSlot = slotDurationHours > 0 && Math.abs(totalHrs - slotDurationHours) <= 0.001;

  // ── Validation ──────────────────────────────────────────────────
  useEffect(() => {
    const errors = {};
    const totalDefaultHrs = sHrs + aHrs;
    if (slotDurationHours > 0 && totalDefaultHrs > slotDurationHours + 0.001)
      errors.defaultHours = `Default sailing + anchoring (${totalDefaultHrs} hrs) exceeds slot duration (${slotDurationHours} hrs)`;

    const maxSell = Number(yacht.maxSellingPrice || 0);
    if (runningCost && maxSell && maxSell <= runningCost)
      errors.maxSellingPrice = "Max selling price must be > running cost";
    if (sellingPrice && maxSell && sellingPrice > maxSell)
      errors.sellingPrice = "Selling price (auto) exceeds max selling price";

    setFieldErrors(errors);
  }, [
    yacht.sailingCost, yacht.anchorageCost,
    yacht.sailingMargin, yacht.anchorageMargin,
    yacht.defaultSailingHours, yacht.defaultAnchoringHours,
    yacht.maxSellingPrice,
    yacht.duration, yacht.customDuration,
  ]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setYacht((prev) => ({ ...prev, [name]: value }));
  };

  const handlePhotoUpload = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) { setYacht((p) => ({ ...p, photos: [] })); setPhotoPreviews([]); setPhotoError(""); return; }
    for (const file of files) {
      if (file.size > 1 * 1024 * 1024) { setPhotoError("Each photo must be under 1 MB."); return; }
    }
    setPhotoError("");
    setYacht((prev) => ({ ...prev, photos: files }));
    setPhotoPreviews(files.map((f) => URL.createObjectURL(f)));
  };

  const handleRemovePhoto = (index) => {
    setYacht((prev) => { const p = [...prev.photos]; p.splice(index, 1); return { ...prev, photos: p }; });
    setPhotoPreviews((prev) => { const p = [...prev]; p.splice(index, 1); return p; });
  };

  const validateDuration = () => {
    if (yacht.duration !== "custom") return { value: convertMinutesToHHMM(Number(yacht.duration)) };
    if (!yacht.customDuration) return { error: "Please enter a custom duration." };
    if (isNaN(Number(yacht.customDuration))) return { error: "Custom duration must be numeric." };
    return { value: convertMinutesToHHMM(Number(yacht.customDuration)) };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (Object.keys(fieldErrors).length > 0) { setError(fieldErrors.defaultHours || "Fix all validation errors first."); return; }
    if (photoError) { setError("Please fix the photo upload error first."); return; }
    const { value: durationHHMM, error: durationError } = validateDuration();
    if (durationError) { setError(durationError); return; }
    try {
      setLoading(true);
      const token = localStorage.getItem("authToken");
      const s1 = convertTo24Hour(yacht.specialSlot1);
      const s2 = convertTo24Hour(yacht.specialSlot2);
      const specialSlotArr = [s1, s2].filter((v, i, a) => v && a.indexOf(v) === i);
      const formData = new FormData();
      formData.append("name", yacht.name);
      formData.append("capacity", yacht.capacity);
      formData.append("sailingCost", yacht.sailingCost);
      formData.append("anchorageCost", yacht.anchorageCost);
      formData.append("sailingMargin", yacht.sailingMargin || 0);
      formData.append("anchorageMargin", yacht.anchorageMargin || 0);
      formData.append("runningCost", runningCost);
      formData.append("sellingPrice", sellingPrice);
      formData.append("maxSellingPrice", yacht.maxSellingPrice);
      formData.append("sailStartTime", yacht.sailStartTime);
      formData.append("sailEndTime", yacht.sailEndTime);
      formData.append("duration", durationHHMM);
      formData.append("status", yacht.status);
      formData.append("specialSlotTimes", JSON.stringify(specialSlotArr));
      if (yacht.boardingLocation?.trim()) formData.append("boardingLocation", yacht.boardingLocation.trim());
      if (yacht.defaultSailingHours !== "") formData.append("defaultSailingHours", yacht.defaultSailingHours);
      if (yacht.defaultAnchoringHours !== "") formData.append("defaultAnchoringHours", yacht.defaultAnchoringHours);
      for (const file of (yacht.photos || [])) formData.append("yachtPhotos", file);
      await createYachtAPI(formData, token);
      toast.success("Yacht created successfully!", { duration: 3000 });
      navigate("/all-yachts");
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Failed to create yacht");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="cy-wrap">
      <style>{CSS}</style>
      <div className="cy-inner">

        {/* ── Header ── */}
        <div style={{
          background: "linear-gradient(135deg, #051829 0%, #0a2d4a 60%, #0d4a6e 100%)",
          borderRadius: 16, padding: "20px 24px", marginBottom: 20,
          display: "flex", alignItems: "center", gap: 14,
          boxShadow: "0 4px 24px rgba(5,24,41,0.18)",
        }}>
          <button onClick={() => navigate(-1)} title="Go back" style={{
            width: 36, height: 36, borderRadius: 10, border: "1px solid rgba(255,255,255,0.18)",
            background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)",
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <div>
            <div style={{ fontSize: "0.65rem", fontWeight: 700, color: "#c9a84c", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 3 }}>Masters</div>
            <h1 style={{ fontSize: "1.3rem", fontWeight: 800, color: "#fff", margin: 0, lineHeight: 1.15 }}>Create Yacht</h1>
          </div>
        </div>

        {/* ── Global error ── */}
        {error && (
          <div style={{
            background: "#fef2f2", border: "1.5px solid #fca5a5", color: "#dc2626",
            fontSize: "0.84rem", fontWeight: 600, padding: "11px 16px",
            borderRadius: 10, marginBottom: 16, display: "flex", alignItems: "center", gap: 8,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>

          {/* ── Basic Info ── */}
          <SectionCard dot="#1d6fa4" title="Basic Information">
            <div className="cy-grid">
              <Field label="Yacht Name" required>
                <input className="cy-input" type="text" name="name" placeholder="e.g. Sea Breeze" value={yacht.name} onChange={handleChange} required />
              </Field>
              <Field label="Capacity" required>
                <input className="cy-input" type="number" name="capacity" placeholder="Max guests" value={yacht.capacity} onChange={handleChange} required />
              </Field>
              <Field label="Status" required>
                <select className="cy-select" name="status" value={yacht.status} onChange={handleChange}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </Field>
              <div className="cy-span3">
                <Field label="Boarding Location" hint="(optional)">
                  <input className="cy-input" type="text" name="boardingLocation" placeholder="e.g. West Goa Marina" value={yacht.boardingLocation} onChange={handleChange} />
                </Field>
              </div>
            </div>
          </SectionCard>

          {/* ── Schedule ── */}
          <SectionCard dot="#c9a84c" title="Schedule & Slots">
            <div className="cy-grid">
              <Field label="Start Time" required>
                <input className="cy-input" type="time" name="sailStartTime" value={yacht.sailStartTime} onChange={handleChange} required />
              </Field>
              <Field label="End Time" required>
                <input className="cy-input" type="time" name="sailEndTime" value={yacht.sailEndTime} min={yacht.sailStartTime} onChange={(e) => {
                  if (e.target.value < yacht.sailStartTime) { toast.error("End time cannot be before start time"); return; }
                  setYacht((p) => ({ ...p, sailEndTime: e.target.value }));
                }} required />
              </Field>
              <Field label="Slot Duration" required>
                <select className="cy-select" name="duration" value={yacht.duration} onChange={(e) => {
                  setYacht((prev) => ({ ...prev, duration: e.target.value, customDuration: e.target.value === "custom" ? prev.customDuration : "" }));
                }}>
                  <option value="30">30 min</option>
                  <option value="60">1 hour</option>
                  <option value="120">2 hours</option>
                  <option value="custom">Custom…</option>
                </select>
                {yacht.duration === "custom" && (
                  <input className="cy-input" style={{ marginTop: 6 }} type="number" name="customDuration" placeholder="Enter minutes" value={yacht.customDuration} onChange={handleChange} />
                )}
              </Field>
              <Field label="Special Slot 1" hint="(optional)">
                <select className="cy-select" name="specialSlot1" value={yacht.specialSlot1 || "none"} onChange={(e) => {
                  const val = e.target.value;
                  setYacht((p) => ({ ...p, specialSlot1: val === "none" ? null : val, specialSlot2: null }));
                }}>
                  <option value="none">None</option>
                  {SLOT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </Field>
              <Field label="Special Slot 2" hint="(optional)">
                <select className="cy-select" name="specialSlot2" value={yacht.specialSlot2 || "none"} disabled={!yacht.specialSlot1 || yacht.specialSlot1 === "none"} onChange={(e) => {
                  const val = e.target.value;
                  setYacht((p) => ({ ...p, specialSlot2: val === "none" ? null : val }));
                }}>
                  <option value="none">None</option>
                  {SLOT_OPTIONS.map((o) => <option key={o.value} value={o.value} disabled={yacht.specialSlot1 === o.value}>{o.label}</option>)}
                </select>
              </Field>
            </div>
          </SectionCard>

          {/* ── Pricing ── */}
          <SectionCard dot="#10b981" title="Pricing">
            <div className="cy-grid">

              {/* ── Row 1: Base costs ── */}
              <Field label="Sailing Cost / hr" required>
                <input className="cy-input" type="number" name="sailingCost" placeholder="₹ per hour" value={yacht.sailingCost} onChange={handleChange} required />
              </Field>
              <Field label="Anchorage Cost / hr" required>
                <input className="cy-input" type="number" name="anchorageCost" placeholder="₹ per hour" value={yacht.anchorageCost} onChange={handleChange} required />
              </Field>

              {/* Running cost display */}
              <Field label="Running Cost" hint="(auto-calculated)">
                <CalcDisplay value={runningCost} />
              </Field>

              {/* ── Row 2: Margins ── */}
              <Field label="Sailing Margin / hr" hint="(added to sailing cost)">
                <input className="cy-input" type="number" name="sailingMargin" placeholder="₹ margin per hour" value={yacht.sailingMargin} onChange={handleChange} />
              </Field>
              <Field label="Anchorage Margin / hr" hint="(added to anchorage cost)">
                <input className="cy-input" type="number" name="anchorageMargin" placeholder="₹ margin per hour" value={yacht.anchorageMargin} onChange={handleChange} />
              </Field>

              {/* Selling price — auto-calculated from margins */}
              <Field label="Selling Price" hint="(auto-calculated)" error={fieldErrors.sellingPrice}>
                <CalcDisplay value={sellingPrice} highlight />
              </Field>

              {/* ── Row 3: Default hours ── */}
              <Field label="Default Sailing Hrs" hint="per slot" error={fieldErrors.defaultHours && " "}>
                <input className={`cy-input${fieldErrors.defaultHours ? " err" : ""}`} type="number" step="0.5" min="0" name="defaultSailingHours" placeholder="e.g. 1" value={yacht.defaultSailingHours} onChange={handleChange} />
              </Field>
              <Field label="Default Anchoring Hrs" hint="per slot" error={fieldErrors.defaultHours && " "}>
                <input className={`cy-input${fieldErrors.defaultHours ? " err" : ""}`} type="number" step="0.5" min="0" name="defaultAnchoringHours" placeholder="e.g. 1" value={yacht.defaultAnchoringHours} onChange={handleChange} />
              </Field>
<Field label="Max Selling Price" required error={fieldErrors.maxSellingPrice}>
                <input className={`cy-input${fieldErrors.maxSellingPrice ? " err" : ""}`} type="number" name="maxSellingPrice" placeholder="₹" value={yacht.maxSellingPrice} onChange={handleChange} required />
              </Field>
              {/* Margin breakdown hint */}
              {(Number(yacht.sailingMargin) > 0 || Number(yacht.anchorageMargin) > 0) && sHrs + aHrs > 0 && (
                <div className="cy-span3" style={{
                  background: "linear-gradient(90deg,rgba(99,102,241,0.06),rgba(99,102,241,0.02))",
                  border: "1px solid rgba(99,102,241,0.25)",
                  borderRadius: 10, padding: "10px 14px",
                  fontSize: "0.8rem", color: "#4338ca",
                }}>
                  <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 4 }}>
                    <span>
                      ⛵ Sailing: ₹{Number(yacht.sailingCost || 0).toLocaleString("en-IN")} + ₹{Number(yacht.sailingMargin || 0).toLocaleString("en-IN")} margin
                      = <b>₹{(Number(yacht.sailingCost || 0) + Number(yacht.sailingMargin || 0)).toLocaleString("en-IN")}/hr</b>
                    </span>
                    <span>
                      ⚓ Anchorage: ₹{Number(yacht.anchorageCost || 0).toLocaleString("en-IN")} + ₹{Number(yacht.anchorageMargin || 0).toLocaleString("en-IN")} margin
                      = <b>₹{(Number(yacht.anchorageCost || 0) + Number(yacht.anchorageMargin || 0)).toLocaleString("en-IN")}/hr</b>
                    </span>
                  </div>
                  <div style={{ fontWeight: 600, fontSize: "0.75rem", color: "#4f46e5" }}>
                    Selling Price = ₹{sellingPrice.toLocaleString("en-IN")}
                  </div>
                </div>
              )}
              
              {/* Hours split widget */}
              {(sv || av) ? (
                <div className="cy-span3" style={{
                  background: isHoursOver ? "#fef2f2" : "#f0fdf4",
                  border: `1px solid ${isHoursOver ? "#fca5a5" : "#86efac"}`,
                  borderRadius: 10, padding: "10px 14px",
                  fontSize: "0.8rem", color: isHoursOver ? "#dc2626" : "#1e293b",
                }}>
                  <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: (sv || av) ? 8 : 0 }}>
                    <span>⛵ Sailing: <b>{sv || 0} hr{sv !== 1 ? "s" : ""}</b> ({sPct}%)</span>
                    <span>⚓ Anchoring: <b>{av || 0} hr{av !== 1 ? "s" : ""}</b> ({aPct}%)</span>
                  </div>
                  {(sv || av) && (
                    <div style={{ background: "#e2e8f0", borderRadius: 4, height: 6, overflow: "hidden" }}>
                      <div style={{ width: `${sPct}%`, height: "100%", background: "#1d6fa4", borderRadius: 4, transition: "width .3s" }} />
                    </div>
                  )}
                  <div style={{ marginTop: 7, fontWeight: 600, fontSize: "0.75rem" }}>
                    {isHoursOver
                      ? `⛔ Total ${totalHrs} hrs exceeds ${slotDurationHours} hr slot`
                      : hoursMatchSlot
                        ? <span style={{ color: "#15803d" }}>✓ Matches slot duration exactly</span>
                        : <span style={{ color: "#64748b" }}>Ratio applied proportionally to any slot length</span>}
                  </div>
                </div>
              ) : null}

              {fieldErrors.defaultHours && (
                <div className="cy-span3" style={{
                  background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 10,
                  padding: "9px 14px", fontSize: "0.78rem", fontWeight: 700, color: "#dc2626",
                }}>⛔ {fieldErrors.defaultHours}</div>
              )}

              
            </div>
          </SectionCard>

          {/* ── Photos ── */}
          <SectionCard dot="#8b5cf6" title="Photos" hint="· optional · max 1 MB each">
            <label className="cy-drop-zone" htmlFor="cy-photo-input">
              <div style={{ fontSize: "2rem", marginBottom: 8, opacity: 0.6 }}>🖼️</div>
              <div style={{ fontSize: "0.88rem", fontWeight: 600, color: "#475569", marginBottom: 4 }}>Click to upload photos</div>
              <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>JPG, PNG, WebP · max 1 MB each</div>
              <input id="cy-photo-input" type="file" multiple accept="image/*" onChange={handlePhotoUpload} style={{ display: "none" }} />
            </label>
            {photoError && <div style={{ fontSize: "0.78rem", color: "#dc2626", fontWeight: 600, marginTop: 8 }}>{photoError}</div>}
            {photoPreviews.length > 0 && (
              <div className="cy-preview-grid">
                {photoPreviews.map((src, i) => (
                  <div key={i} className="cy-preview-item">
                    <img src={src} alt={`preview-${i}`} />
                    <button type="button" className="cy-preview-remove" onClick={() => handleRemovePhoto(i)}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          {/* ── Submit ── */}
          <button type="submit" className="cy-submit" disabled={loading}>
            {loading
              ? <><div className="cy-spinner" /> Creating Yacht…</>
              : <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12l7 7 7-7"/></svg>
                  Create Yacht
                </>}
          </button>

        </form>
      </div>

      {/* Loading overlay */}
      {loading && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(5,24,41,0.45)", backdropFilter: "blur(3px)",
          zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{
            background: "#fff", borderRadius: 16, padding: "28px 36px",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 14,
            boxShadow: "0 12px 50px rgba(0,0,0,0.22)",
          }}>
            <div style={{ width: 40, height: 40, border: "3.5px solid #e8eef5", borderTopColor: "#1d6fa4", borderRadius: "50%", animation: "cy-spin .7s linear infinite" }} />
            <span style={{ fontSize: "0.9rem", fontWeight: 700, color: "#0a2d4a" }}>Creating yacht…</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default CreateYacht;