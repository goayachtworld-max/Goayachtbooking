import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { PDFDownloadLink } from "@react-pdf/renderer";
import BoardingPassPDF from "./BoardingPassPDF";
import { GLOBAL_CSS } from "../styles/customerDetailsStyle";

/* ── constants ── */
const STEPS = [
  { key:"pending",   label:"Pending"   },
  { key:"confirmed", label:"Confirmed" },
  { key:"completed", label:"Completed" },
];
const STEP_IDX = { pending:0, confirmed:1, completed:2 };

const fmt = (d) =>
  new Date(d).toLocaleDateString("en-GB", { day:"numeric", month:"short", year:"numeric" });

const to12 = (t) => {
  if (!t) return "—";
  let [h, m] = t.split(":").map(Number);
  const p = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2,"0")} ${p}`;
};

/* ── TripProgress ── */
const TripProgress = ({ status }) => {
  if (!status) return null;
  if (status === "cancelled") {
    return (
      <div style={{ background:"#fef2f2", border:"2px solid #fca5a5", color:"#dc2626", fontWeight:800, fontSize:14, padding:"11px 16px", borderRadius:10, textAlign:"center", marginBottom:14 }}>
        ✕ Trip Cancelled
      </div>
    );
  }
  const idx  = STEP_IDX[status] ?? 0;
  const pct  = (idx / (STEPS.length - 1)) * 100;
  return (
    <div style={{ marginBottom:18 }}>
      <div className="cm-progress-track"><div className="cm-progress-fill" style={{ width:`${pct}%` }} /></div>
      <div className="cm-steps">
        {STEPS.map((s, i) => {
          const done = i <= idx;
          return (
            <div key={s.key} className="cm-step">
              <div className={`cm-step-dot${done?" done":""}`}>{done ? "✓" : i+1}</div>
              <div className={`cm-step-lbl${done?" done":""}`}>{s.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ── InfoItem ── */
const Info = ({ label, value }) => (
  <div>
    <div className="cm-info-label">{label}</div>
    <div className="cm-info-val">{value || "—"}</div>
  </div>
);

/* ── Main ── */
function CustomerDetails() {
  const { state }   = useLocation();
  const navigate    = useNavigate();
  const { booking } = state || {};
  const customer    = booking?.customerId || {};

  if (!booking) {
    return (
      <div className="cm-wrap">
        <style>{GLOBAL_CSS}</style>
        <div className="cm-page" style={{ maxWidth:520 }}>
          <div className="cm-card" style={{ padding:32, textAlign:"center" }}>
            <div style={{ fontSize:40, marginBottom:12 }}>📋</div>
            <div style={{ fontSize:18, fontWeight:800, color:"#0f172a", marginBottom:8 }}>No booking data</div>
            <button className="btn-back-icon" onClick={() => navigate(-1)} title="Go back">
              <svg viewBox="0 0 20 20" fill="none"><path d="M12.5 5L7.5 10L12.5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* parse extras */
  const sanitize = (txt="") =>
    txt.replace(/\u2022|\u2023|\u25E6/g,"-")
       .replace(/\u200B|\u200C|\u200D|\uFEFF/g,"")
       .replace(/\r\n/g,"\n").replace(/\n{2,}/g,"\n").trim();

  const extras     = booking.extraDetails ? sanitize(booking.extraDetails) : "";
  const lines      = extras.split("\n").map((l)=>l.trim()).filter(Boolean);
  const inclusions = lines.filter((l) => ["Soft Drink","Ice Cube","Water Bottles","Bluetooth Speaker","Captain","Snacks"].some((k)=>l.includes(k)));
  const paid       = lines.filter((l) => ["Drone","DSLR"].some((k)=>l.includes(k)));
  const notes      = extras.includes("Notes:") ? extras.split("Notes:").slice(1).join("Notes:").trim() : "";

  const ticketId   = booking._id ? booking._id.slice(-6).toUpperCase() : "------";
  const pending    = booking.pendingAmount ?? 0;

  return (
    <div className="cm-wrap">
      <style>{GLOBAL_CSS}</style>
      <div className="cm-page" style={{ maxWidth:620 }}>

        {/* Header */}
        <div className="cm-header">
          <button className="btn-back-icon" onClick={() => navigate(-1)} title="Go back">
            <svg viewBox="0 0 20 20" fill="none"><path d="M12.5 5L7.5 10L12.5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <div>
            <div className="cm-subtitle">Booking · #{ticketId}</div>
            <div className="cm-title">Booking Details</div>
          </div>
        </div>

        {/* Status badge */}
        <div style={{ marginBottom:16 }}>
          <span className={`cm-tag ${
            booking.status === "confirmed"  ? "cm-tag-green" :
            booking.status === "cancelled"  ? "cm-tag-red"   :
            booking.status === "completed"  ? "cm-tag-blue"  : "cm-tag-amber"
          }`}>
            {booking.status?.charAt(0).toUpperCase() + booking.status?.slice(1)}
          </span>
        </div>

        {/* Progress */}
        <TripProgress status={booking.status} />

        {/* Main card */}
        <div className="cm-card" style={{ padding:20, marginBottom:12 }}>

          {/* Customer + Trip info grid */}
          <div className="cm-section-head">
            <span className="cm-dot" style={{ background:"#3b82f6" }} />Customer & Trip
          </div>
          <div className="cm-info-grid" style={{ marginBottom:18 }}>
            <Info label="Customer"  value={customer.name} />
            <Info label="Date"      value={booking.date ? fmt(booking.date) : "—"} />
            <Info label="Contact"   value={customer.contact} />
            <Info label="Time"      value={`${to12(booking.startTime)} – ${to12(booking.endTime)}`} />
            <Info label="Email"     value={customer.email} />
            <Info label="Guests"    value={booking.numPeople ? `${booking.numPeople} pax` : "—"} />
          </div>

          <hr style={{ border:"none", borderTop:"2px solid #f1f5f9", margin:"0 0 18px" }} />

          {/* Payment */}
          <div className="cm-section-head">
            <span className="cm-dot" style={{ background:"#16a34a" }} />Payment
          </div>
          <div style={{
            display:"flex", justifyContent:"space-between", alignItems:"center",
            background: pending > 0 ? "#fef2f2" : "#f0fdf4",
            border:`2px solid ${pending > 0 ? "#fca5a5" : "#86efac"}`,
            borderRadius:10, padding:"13px 16px"
          }}>
            <span style={{ fontSize:13, fontWeight:800, color:"#374151" }}>Pending Balance</span>
            <span style={{ fontSize:22, fontWeight:900, color: pending > 0 ? "#dc2626" : "#16a34a" }}>
              ₹{pending.toLocaleString("en-IN")}
            </span>
          </div>

          {/* Extras */}
          {extras && (
            <>
              <hr style={{ border:"none", borderTop:"2px solid #f1f5f9", margin:"18px 0" }} />
              <div className="cm-section-head">
                <span className="cm-dot" style={{ background:"#f59e0b" }} />Add-ons & Services
              </div>
              <div className="cm-grid2" style={{ marginBottom: notes ? 12 : 0 }}>
                <div>
                  <div style={{ fontSize:11, fontWeight:800, color:"#16a34a", letterSpacing:.5, marginBottom:8 }}>✓ INCLUDED</div>
                  <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
                    {inclusions.length > 0
                      ? inclusions.map((item, i) => (
                          <span key={i} className="cm-tag cm-tag-green" style={{ alignSelf:"flex-start" }}>
                            {item.replace(/^-\s*/, "")}
                          </span>
                        ))
                      : <span style={{ fontSize:12, color:"#94a3b8" }}>None</span>
                    }
                  </div>
                </div>
                <div>
                  <div style={{ fontSize:11, fontWeight:800, color:"#d97706", letterSpacing:.5, marginBottom:8 }}>★ PAID ADD-ONS</div>
                  <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
                    {paid.length > 0
                      ? paid.map((item, i) => (
                          <span key={i} className="cm-tag cm-tag-amber" style={{ alignSelf:"flex-start" }}>
                            {item.replace(/^-\s*/, "")}
                          </span>
                        ))
                      : <span style={{ fontSize:12, color:"#94a3b8" }}>None</span>
                    }
                  </div>
                </div>
              </div>
              {notes && (
                <div style={{ background:"#f8fafc", border:"2px solid #e2e8f0", borderRadius:10, padding:"12px 14px", marginTop:12 }}>
                  <div style={{ fontSize:11, fontWeight:800, color:"#64748b", textTransform:"uppercase", letterSpacing:.5, marginBottom:4 }}>Note</div>
                  <div style={{ fontSize:14, fontWeight:600, color:"#1e293b" }}>{notes}</div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Actions */}
        <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
          <button className="btn-back-icon" onClick={() => navigate(-1)} title="Go back">
            <svg viewBox="0 0 20 20" fill="none"><path d="M12.5 5L7.5 10L12.5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          {booking.status === "confirmed" && (
            <PDFDownloadLink
              document={<BoardingPassPDF booking={booking} />}
              fileName={`${booking.yachtId?.name}_${customer.name}_${fmt(booking.date)}.pdf`}
              style={{ flex:2, minWidth:180, textDecoration:"none" }}
            >
              {({ loading: pdfLoading }) => (
                <button className="cm-btn cm-btn-primary cm-btn-full" disabled={pdfLoading}>
                  {pdfLoading ? "Generating…" : "⬇ Download Boarding Pass"}
                </button>
              )}
            </PDFDownloadLink>
          )}
        </div>

      </div>
    </div>
  );
}

export default CustomerDetails;