import React, { useEffect, useState, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { createBookingAPI } from "../services/operations/bookingAPI";
import {
  createCustomerAPI,
  getCustomerByContactAPI,
  searchCustomersByNameAPI,
} from "../services/operations/customerAPI";
import { getAllYachtsAPI } from "../services/operations/yautAPI";
import { toast } from "react-hot-toast";
import { createTransactionAndUpdateBooking } from "../services/operations/transactionAPI";
import { getEmployeesForBookingAPI } from "../services/operations/employeeAPI";

function CreateBooking() {
  const navigate = useNavigate();
  const location = useLocation();
  const prefill = location.state || {};


  const user = JSON.parse(localStorage.getItem("user"));
  const isAdmin = user?.type === "admin";
  const isQuotation = prefill.source === "bookings";
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
    bookingStatus: "pending",
    tokenAmount: ""
  });

  const [yachts, setYachts] = useState([]);
  const [startTimeOptions, setStartTimeOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [runningCost, setRunningCost] = useState(0);

  const [customerSuggestions, setCustomerSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const typingTimeoutRef = useRef(null);
  const [employees, setEmployees] = useState([]);
  const [showExtraDetails, setShowExtraDetails] = useState(false);

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
    const selectedYacht = yachts.find((y) => y.id === formData.yachtId);
    if (!selectedYacht) {
      setStartTimeOptions([]);
      return;
    }

    setRunningCost(selectedYacht.runningCost || 0);

    const slots = buildSlotsForYacht(selectedYacht, formData.date);
    setStartTimeOptions(slots);

    if (formData.startTime) {
      const match = slots.find((s) => s.start === formData.startTime);
      if (match) setFormData((p) => ({ ...p, endTime: match.end }));
    }
  }, [formData.yachtId, yachts, formData.date]);

  useEffect(() => {
    const close = () => setShowSuggestions(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === "yachtId") {
      setFormData((p) => ({
        ...p,
        yachtId: value,
        startTime: "",
        endTime: "",
      }));
    } else {
      setFormData((p) => ({ ...p, [name]: value }));
    }
  };

  const handleStartSelect = (e) => {
    const start = e.target.value;
    const slot = startTimeOptions.find((s) => s.start === start);
    setFormData((p) => ({
      ...p,
      startTime: start,
      endTime: slot ? slot.end : "",
    }));
  };

  const isAmountInvalid =
    formData.totalAmount &&
    runningCost &&
    Number(formData.totalAmount) < runningCost;

  const isCapacityExceeded =
    formData.numPeople &&
    yachts.find((y) => y.id === formData.yachtId)?.capacity &&
    Number(formData.numPeople) >
    yachts.find((y) => y.id === formData.yachtId).capacity;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const token = localStorage.getItem("authToken");

      const selectedYacht = yachts.find((y) => y.id === formData.yachtId);
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
        ...(isQuotation && formData.tokenAmount && { tokenAmount: Number(formData.tokenAmount) }),
      };

      console.log("Booking payload : ", bookingPayload)

      const response = await createBookingAPI(bookingPayload, token);
      const booking = response.data.booking;

      toast.success(isQuotation ? "Quotation created successfully!" : "Booking created successfully!");

      // Only trigger transaction for normal bookings, NOT quotations
      if (!isQuotation && response.data.success && formData.advanceAmount > 0) {
        await createTransactionAndUpdateBooking(
          {
            bookingId: booking._id,
            type: "advance",
            amount: formData.advanceAmount,
          },
          token
        );
      }

      navigate("/bookings");
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

  const selectedYachtObj = yachts.find((y) => y.id === formData.yachtId);
  const isMobileView = typeof window !== "undefined" && window.innerWidth < 768;
  const pendingAmount = formData.totalAmount
    ? Math.max(0, Number(formData.totalAmount) - Number(formData.advanceAmount || 0))
    : null;

  return (
    <>
      {/* Loading overlay */}
      {loading && (
        <div style={{ position:"fixed",inset:0,backdropFilter:"blur(4px)",background:"rgba(0,0,0,0.4)",display:"flex",justifyContent:"center",alignItems:"center",zIndex:99999 }}>
          <div style={{ width:44,height:44,border:"3px solid rgba(255,255,255,0.2)",borderTopColor:"#3b82f6",borderRadius:"50%",animation:"cb-spin 0.8s linear infinite" }} />
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
        .cb-inp:focus { border-color:#2563eb; box-shadow:0 0 0 3px rgba(37,99,235,.15); }
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
        .cb-ac-item:hover { background:#eff6ff; }

        .cb-sumbar {
          display:flex; align-items:center; gap:8px; flex-wrap:wrap;
          background:#0f172a; border-radius:12px; padding:13px 16px;
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
          background:#2563eb; color:#fff; border:none; border-radius:12px;
          cursor:pointer; transition:all .2s; letter-spacing:.3px;
          box-shadow:0 4px 18px rgba(37,99,235,.4);
        }
        .cb-submit:disabled { background:#94a3b8; box-shadow:none; cursor:not-allowed; }
        .cb-submit:not(:disabled):hover { background:#1d4ed8; transform:translateY(-2px); box-shadow:0 8px 24px rgba(37,99,235,.45); }

        .cb-err-msg { font-size:12px; font-weight:700; color:#dc2626; margin-top:5px; }
        .cb-warn-msg { font-size:12px; font-weight:700; color:#d97706; margin-top:5px; }

        .cb-ext-bar { display:flex; justify-content:space-between; align-items:center; cursor:pointer; user-select:none; }
        .cb-ext-toggle {
          font-size:13px; font-weight:700; padding:6px 16px;
          border-radius:8px; border:2px solid #bfdbfe; cursor:pointer;
          background:#eff6ff; color:#1d4ed8; transition:all .15s;
        }
        .cb-ext-toggle:hover { background:#dbeafe; }
        .cb-ext-toggle.open { background:#f1f5f9; color:#475569; border-color:#94a3b8; }

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


      <div className="cb-wrap" style={{ background:"#f8fafc", minHeight:"100vh", padding:"8px" }}>
        <div style={{ maxWidth:960, margin:"0 auto" }}>

          {/* ── Header row ── */}
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
            <div>
              <div style={{ fontSize:12, fontWeight:700, color:"#64748b", letterSpacing:"1.5px", textTransform:"uppercase", marginBottom:2 }}>New Booking</div>
              <div style={{ fontSize:"clamp(18px, 5vw, 26px)", fontWeight:900, color:"#0f172a", lineHeight:1.1 }}>Create Booking</div>
            </div>
            <button onClick={() => navigate(-1)} style={{ padding:"9px 18px", background:"#fff", border:"2px solid #cbd5e1", borderRadius:9, fontSize:14, fontWeight:700, color:"#374151", cursor:"pointer" }}>
              ← Back
            </button>
          </div>

          {/* ── Error banner ── */}
          {error && (
            <div style={{ background:"#fef2f2", border:"1px solid #fecaca", borderRadius:8, padding:"10px 14px", color:"#dc2626", fontSize:13, marginBottom:12 }}>
              ⚠ {error}
            </div>
          )}

          {/* ── Live summary bar ── */}
          <div className="cb-sumbar">
            {formData.name    && <span className="cb-sum-pill">👤 <b>{formData.name}</b></span>}
            {formData.date    && <span className="cb-sum-pill">📅 <b>{new Date(formData.date).toLocaleDateString("en-GB",{day:"numeric",month:"short"})}</b></span>}
            {selectedYachtObj && <span className="cb-sum-pill">⛵ <b>{selectedYachtObj.name}</b></span>}
            {formData.startTime && <span className="cb-sum-pill">🕐 <b>{to12Hour(formData.startTime)}–{to12Hour(formData.endTime)}</b></span>}
            {formData.numPeople && <span className="cb-sum-pill">👥 <b>{formData.numPeople} pax</b></span>}
            {formData.totalAmount && (
              <span className="cb-sum-pill" style={{ marginLeft:"auto" }}>
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
            {!formData.name && !formData.date && <span style={{ color:"#b0bec5", fontSize:12 }}>Fill in the form below…</span>}
          </div>

          {/* ── FORM ── */}
          <form onSubmit={handleSubmit} style={{ display:"flex", flexDirection:"column", gap:8 }}>

            {/* ROW 1: Customer + Booking side by side on desktop */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(280px, 1fr))", gap:12 }}>

              {/* ── Customer panel ── */}
              <div className="cb-panel">
                <div className="cb-sh"><span className="cb-sh-dot" style={{background:"#3b82f6"}}></span>Customer</div>
                <div className="cb-g1">

                  <div className="cb-f" style={{ position:"relative" }}>
                    <label className="cb-lbl">Full Name</label>
                    <input className="cb-inp" type="text" name="name" value={formData.name}
                      onChange={handleNameTyping} autoComplete="off" required placeholder="Search or type name" />
                    {showSuggestions && customerSuggestions.length > 0 && (
                      <div className="cb-ac">
                        {customerSuggestions.map((c) => (
                          <div key={c._id} className="cb-ac-item" onClick={() => handleCustomerSelect(c)}>
                            <div style={{ fontWeight:600, fontSize:13, color:"#1e293b" }}>{c.name}</div>
                            <div style={{ fontSize:11, color:"#94a3b8", marginTop:1 }}>{c.contact} · {c.email}</div>
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
                    <label className="cb-lbl">Email <span style={{ color:"#b0bec5", textTransform:"lowercase", fontWeight:400 }}>opt.</span></label>
                    <input className="cb-inp" type="email" name="email" value={formData.email}
                      onChange={handleChange} placeholder="email@example.com" />
                  </div>

                  <div className="cb-f">
                    <label className="cb-lbl">Govt. ID <span style={{ color:"#b0bec5", textTransform:"lowercase", fontWeight:400 }}>opt.</span></label>
                    <input className="cb-inp" type="text" name="govtId" value={formData.govtId}
                      onChange={handleChange} placeholder="Aadhar / Passport" />
                  </div>
                </div>
              </div>

              {/* ── Booking details panel ── */}
              <div className="cb-panel">
                <div className="cb-sh"><span className="cb-sh-dot" style={{background:"#8b5cf6"}}></span>Booking Details</div>
                <div className="cb-g2">

                  <div className="cb-f">
                    <label className="cb-lbl">Date</label>
                    <input className="cb-inp" type="date" name="date"
                      min={new Date().toISOString().split("T")[0]}
                      value={formData.date} onChange={handleChange} required />
                  </div>

                  <div className="cb-f">
                    <label className="cb-lbl">Guests</label>
                    <input className={`cb-inp ${isCapacityExceeded ? "warn" : ""}`} type="number"
                      name="numPeople" value={formData.numPeople} onChange={handleChange}
                      required placeholder="0" min="1" />
                    {isCapacityExceeded && (
                      <div className="cb-warn-msg">⚠ Exceeds cap ({yachts.find(y=>y.id===formData.yachtId)?.capacity})</div>
                    )}
                  </div>

                  <div className="cb-f">
                    <label className="cb-lbl">Yacht</label>
                    <select className="cb-inp" name="yachtId" value={formData.yachtId} onChange={handleChange} required>
                      <option value="">— Select —</option>
                      {yachts.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
                    </select>
                  </div>

                  <div className="cb-f">
                    <label className="cb-lbl">Time Slot</label>
                    <select className="cb-inp" name="startTime" value={formData.startTime} onChange={handleStartSelect} required>
                      <option value="">— Select —</option>
                      {startTimeOptions.map((opt, i) => (
                        <option key={i} value={opt.start}>{to12Hour(opt.start)} – {to12Hour(opt.end)}</option>
                      ))}
                    </select>
                  </div>

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
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(280px, 1fr))", gap:12 }}>

              {/* ── Payment panel ── */}
              <div className="cb-panel">
                <div className="cb-sh"><span className="cb-sh-dot" style={{background:"#16a34a"}}></span>Payment</div>
                <div className="cb-g2">
                  <div className="cb-f">
                    <label className="cb-lbl">
                      Total Amount
                      {runningCost > 0 && <span style={{ color:"#64748b", fontWeight:500, marginLeft:6, fontSize:12, textTransform:"none" }}>min ₹{Number(runningCost).toLocaleString("en-IN")}</span>}
                    </label>
                    <input className={`cb-inp ${isAmountInvalid ? "err" : ""}`} type="number"
                      name="totalAmount" value={formData.totalAmount} onChange={handleChange}
                      required placeholder="₹ 0" />
                    {isAmountInvalid && <div className="cb-err-msg">⚠ Below running cost ₹{Number(runningCost).toLocaleString("en-IN")}</div>}
                  </div>

                  {isQuotation ? (
                    <div className="cb-f">
                      <label className="cb-lbl">Token Amount <span style={{ color:"#b0bec5", textTransform:"lowercase", fontWeight:400 }}>opt.</span></label>
                      <input className="cb-inp" type="number" name="tokenAmount" value={formData.tokenAmount}
                        onChange={handleChange} placeholder="₹ 0" />
                      <div style={{ fontSize:11, color:"#94a3b8", marginTop:4 }}>Amount customer should pay as token to confirm</div>
                    </div>
                  ) : (
                    <div className="cb-f">
                      <label className="cb-lbl">Advance <span style={{ color:"#b0bec5", textTransform:"lowercase", fontWeight:400 }}>opt.</span></label>
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
                  <div className="cb-sh" style={{ margin:0, border:"none", padding:0 }}>
                    <span className="cb-sh-dot" style={{background:"#f59e0b"}}></span>Add-ons & Notes
                  </div>
                  <button type="button" className={`cb-ext-toggle ${showExtraDetails ? "open" : ""}`}>
                    {showExtraDetails ? "− Hide" : "+ Add"}
                  </button>
                </div>

                {!showExtraDetails && (
                  <div style={{ marginTop:8, display:"flex", flexWrap:"wrap", gap:5 }}>
                    {selectedExtras.map(ex => (
                      <span key={ex} style={{
                        fontSize:11, padding:"2px 8px", borderRadius:12, fontWeight:500,
                        background: extraOptions.paidServices.includes(ex) ? "#fffbeb" : "#f0fdf4",
                        color: extraOptions.paidServices.includes(ex) ? "#92400e" : "#15803d",
                        border: `1px solid ${extraOptions.paidServices.includes(ex) ? "#fde68a" : "#bbf7d0"}`,
                      }}>{ex}</span>
                    ))}
                  </div>
                )}

                {showExtraDetails && (
                  <div style={{ marginTop:12 }}>
                    <div style={{ fontSize:12, fontWeight:800, color:"#16a34a", letterSpacing:".5px", marginBottom:8 }}>✓ INCLUDED SERVICES</div>
                    <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:12 }}>
                      {extraOptions.inclusions.map((item) => (
                        <div key={item} className={`cb-chip ${selectedExtras.includes(item) ? "g" : ""}`}
                          onClick={() => handleExtraToggle(item)}>
                          {selectedExtras.includes(item) ? "✓" : "+"} {item}
                        </div>
                      ))}
                    </div>
                    <div style={{ fontSize:12, fontWeight:800, color:"#d97706", letterSpacing:".5px", marginBottom:8 }}>★ PAID ADD-ONS</div>
                    <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:12 }}>
                      {extraOptions.paidServices.map((item) => (
                        <div key={item} className={`cb-chip ${selectedExtras.includes(item) ? "a" : ""}`}
                          onClick={() => handleExtraToggle(item)}>
                          {selectedExtras.includes(item) ? "★" : "+"} {item}
                        </div>
                      ))}
                    </div>
                    <div className="cb-f">
                      <label className="cb-lbl">Notes</label>
                      <textarea className="cb-inp" rows={2} style={{ resize:"none" }}
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