import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { PDFDownloadLink } from "@react-pdf/renderer";
import BoardingPassPDF from "./BoardingPassPDF";
import ReceiptPDF from "./ReceiptPDF";

/* ─── Helpers ─── */
const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "—";

const fmtDateShort = (d) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—";

const to12 = (t) => {
  if (!t) return "—";
  let [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
};

const fmtINR = (n) => (n != null ? `₹${Number(n).toLocaleString("en-IN")}` : "—");

const STATUS_CONFIG = {
  confirmed: { bg: "rgba(22,163,74,0.12)",  border: "rgba(22,163,74,0.35)",  color: "#16a34a", dot: "#16a34a", label: "Confirmed" },
  cancelled: { bg: "rgba(220,38,38,0.10)",  border: "rgba(220,38,38,0.3)",   color: "#dc2626", dot: "#dc2626", label: "Cancelled" },
  completed: { bg: "rgba(99,102,241,0.12)", border: "rgba(99,102,241,0.35)", color: "#6366f1", dot: "#6366f1", label: "Completed" },
  pending:   { bg: "rgba(217,119,6,0.12)",  border: "rgba(217,119,6,0.35)",  color: "#d97706", dot: "#d97706", label: "Pending" },
};

const STEPS = [
  { key: "pending",   icon: "◷", label: "Pending" },
  { key: "confirmed", icon: "✓", label: "Confirmed" },
  { key: "completed", icon: "★", label: "Completed" },
];

const INCL_KEYS  = ["Soft Drink", "Ice Cube", "Water Bottles", "Bluetooth Speaker", "Captain", "Snacks"];
const ADDON_KEYS = ["Drone", "DSLR", "Food", "DJ"];

const sanitize = (s = "") =>
  s.replace(/[\u2022\u2023\u25E6]/g, "-").replace(/[\u200B-\u200D\uFEFF]/g, "").replace(/\r\n/g, "\n").replace(/\n{2,}/g, "\n").trim();

function parseExtras(raw = "") {
  const lines = sanitize(raw).split("\n").map((l) => l.trim()).filter(Boolean);
  return {
    incl:   lines.filter((l) => INCL_KEYS.some((k) => l.includes(k))),
    addons: lines.filter((l) => ADDON_KEYS.some((k) => l.includes(k))),
    notes:  raw.includes("Notes:") ? raw.split("Notes:").slice(1).join("Notes:").trim() : "",
  };
}

/* ─── Sub-components ─── */

const SectionLabel = ({ children }) => (
  <div className="cd-section-label">{children}</div>
);

const KV = ({ label, value, mono = false, wide = false }) => (
  <div className={wide ? "cd-kv cd-kv-wide" : "cd-kv"}>
    <div className="cd-kv-label">{label}</div>
    <div className="cd-kv-value" style={mono ? { fontFamily: "'Courier New', monospace" } : {}}>
      {value || "—"}
    </div>
  </div>
);

const Chip = ({ children, variant = "default" }) => (
  <span className={`cd-chip cd-chip-${variant}`}>{children}</span>
);

const AmountBox = ({ label, value, highlight, negative }) => (
  <div className={`cd-amount-box${highlight ? (negative ? " cd-amount-negative" : " cd-amount-positive") : ""}`}>
    <div className="cd-amount-label">{label}</div>
    <div className="cd-amount-value">{value}</div>
  </div>
);

const PDFBtn = ({ doc, fileName, label, primary }) => (
  <PDFDownloadLink document={doc} fileName={fileName} style={{ textDecoration: "none", display: "block" }}>
    {({ loading }) => (
      <button className={`cd-dl-btn${primary ? " cd-dl-btn-primary" : " cd-dl-btn-secondary"}`} disabled={loading}>
        {loading ? "Generating…" : label}
      </button>
    )}
  </PDFDownloadLink>
);

/* ─── Main ─── */
export default function CustomerDetails() {
  const { state }   = useLocation();
  const navigate    = useNavigate();
  const { booking } = state || {};

  if (!booking) return (
    <div className="cd-wrap">
      <style>{CSS}</style>
      <div className="cd-empty-state">
        <div style={{ fontSize: 44, marginBottom: 12 }}>📋</div>
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 16 }}>No booking found</div>
        <button className="cd-btn-back" onClick={() => navigate(-1)}>← Go Back</button>
      </div>
    </div>
  );

  const customer  = booking.customerId || {};
  const yacht     = booking.yachtId    || {};
  const company   = booking.company    || {};
  const status    = booking.status     || "pending";
  const st        = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  const ticketId  = booking._id?.slice(-6).toUpperCase() || "------";
  const pending   = Number(booking.pendingAmount ?? 0);
  const quoted    = Number(booking.quotedAmount   ?? 0);
  const tokenPaid = quoted - pending;
  const stepIdx   = status === "cancelled" ? -1 : STEPS.findIndex((s) => s.key === status);
  const { incl, addons, notes } = parseExtras(booking.extraDetails || "");
  const fileName = (t) => `${yacht.name || "booking"}_${customer.name || "guest"}_${fmtDateShort(booking.date)}_${t}.pdf`;

  return (
    <div className="cd-wrap">
      <style>{CSS}</style>

      <div className="cd-container">

        {/* ── TOPBAR ── */}
        <div className="cd-topbar">
          <button className="cd-btn-back" onClick={() => navigate(-1)}>← Back</button>

          <div className="cd-topbar-title">
            <div className="cd-topbar-sub">Ticket #{ticketId}</div>
            <div className="cd-topbar-main">Booking Details</div>
          </div>

          <span
            className="cd-status-badge"
            style={{ background: st.bg, color: st.color, border: `1.5px solid ${st.border}` }}
          >
            <span className="cd-status-dot" style={{ background: st.dot }} />
            {st.label}
          </span>
        </div>

        {/* ── PROGRESS ── */}
        {status === "cancelled" ? (
          <div className="cd-cancelled-banner">✕ This trip has been cancelled</div>
        ) : (
          <div className="cd-card cd-progress-card">
            <div className="cd-progress-track">
              <div
                className="cd-progress-fill"
                style={{ width: stepIdx < 0 ? "0%" : `${(stepIdx / (STEPS.length - 1)) * 100}%` }}
              />
            </div>
            <div className="cd-steps">
              {STEPS.map((s, i) => {
                const done = i <= stepIdx;
                return (
                  <div key={s.key} className="cd-step">
                    <div className={`cd-step-dot${done ? " cd-step-dot-done" : ""}`}>
                      {done ? s.icon : i + 1}
                    </div>
                    <div className={`cd-step-label${done ? " cd-step-label-done" : ""}`}>{s.label}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── TWO-COLUMN LAYOUT ── */}
        <div className="cd-cols">

          {/* LEFT */}
          <div className="cd-col-left">

            <div className="cd-card">
              <SectionLabel>👤 Customer</SectionLabel>
              <div className="cd-kv-grid">
                <KV label="Full Name" value={customer.name} />
                <KV label="Contact"   value={customer.contact} />
                <KV label="Email"     value={customer.email} wide />
              </div>
            </div>

            <div className="cd-card">
              <SectionLabel>⛵ Trip Details</SectionLabel>
              <div className="cd-kv-grid">
                <KV label="Date"       value={fmtDate(booking.date)} />
                <KV label="Group Size" value={booking.numPeople ? `${booking.numPeople} Pax` : "—"} />
                <KV label="Start Time" value={to12(booking.startTime)} />
                <KV label="End Time"   value={to12(booking.endTime)} />
                <KV label="Duration"   value={`${booking.sailingHours ?? 1}hr Cruising + ${booking.anchoringHours ?? 1}hr Anchorage`} wide />
              </div>
            </div>

            <div className="cd-card">
              <SectionLabel>🛥 Yacht</SectionLabel>
              <div className="cd-kv-grid">
                <KV label="Yacht Name"   value={yacht.name} />
                <KV label="Max Capacity" value={yacht.maxCapacity ? `${yacht.maxCapacity} pax` : "—"} />
                <KV
                  label="Boarding Location"
                  value={status === "pending" ? "Will be shared upon confirmation" : (yacht.boardingLocation || "—")}
                  wide
                />
              </div>
            </div>

            {company.name && (
              <div className="cd-card">
                <SectionLabel>🏢 Company</SectionLabel>
                <div className="cd-kv-grid">
                  <KV label="Company Name" value={company.name} />
                  <KV label="Contact"      value={company.contact} />
                  {company.email   && <KV label="Email"   value={company.email}   wide />}
                  {company.address && <KV label="Address" value={company.address} wide />}
                </div>
              </div>
            )}

          </div>

          {/* RIGHT */}
          <div className="cd-col-right">

            {/* Payment */}
            <div className="cd-card">
              <SectionLabel>💳 Payment</SectionLabel>
              <div className="cd-amount-grid">
                <AmountBox label="Booking Amt" value={fmtINR(quoted)} />
                <AmountBox label="Token Paid"  value={fmtINR(tokenPaid)} highlight />
                <AmountBox label="Balance Due" value={fmtINR(pending)}   highlight negative={pending > 0} />
              </div>
              {booking.settledAmount != null && (
                <div className="cd-settled-row">
                  <span className="cd-settled-label">✓ Settled Amount</span>
                  <span className="cd-settled-value">{fmtINR(booking.settledAmount)}</span>
                </div>
              )}
            </div>

            {/* Add-ons */}
            {(incl.length > 0 || addons.length > 0 || notes) && (
              <div className="cd-card">
                <SectionLabel>✦ Add-ons & Services</SectionLabel>
                {incl.length > 0 && (
                  <div className="cd-addons-section">
                    <div className="cd-addons-heading cd-addons-green">Included</div>
                    <div>{incl.map((item, i) => <Chip key={i} variant="green">{item.replace(/^-\s*/, "")}</Chip>)}</div>
                  </div>
                )}
                {addons.length > 0 && (
                  <div className={`cd-addons-section${!notes ? " cd-addons-last" : ""}`}>
                    <div className="cd-addons-heading cd-addons-amber">Paid Add-ons</div>
                    <div>{addons.map((item, i) => <Chip key={i} variant="amber">{item.replace(/^-\s*/, "")}</Chip>)}</div>
                  </div>
                )}
                {notes && (
                  <div className="cd-notes-box">
                    <div className="cd-notes-label">Note</div>
                    <div className="cd-notes-text">{notes}</div>
                  </div>
                )}
              </div>
            )}

            {/* Dark ref card */}
            <div className="cd-card cd-ref-card">
              <div className="cd-ref-top">
                <div>
                  <div className="cd-ref-sub">Booking Reference</div>
                  <div className="cd-ref-id">#{ticketId}</div>
                </div>
                <div className="cd-ref-icon">⚓</div>
              </div>
              <div className="cd-ref-bottom">
                <div>
                  <div className="cd-ref-meta-label">VESSEL</div>
                  <div className="cd-ref-meta-value">{yacht.name || "—"}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div className="cd-ref-meta-label">DATE</div>
                  <div className="cd-ref-meta-value">{fmtDateShort(booking.date)}</div>
                </div>
              </div>
            </div>

            {/* Downloads */}
            <div className="cd-dl-wrap">
              <PDFBtn
                doc={<BoardingPassPDF booking={booking} />}
                fileName={fileName("BoardingPass")}
                label="⬇  Download Boarding Pass"
                primary
              />
              <PDFBtn
                doc={<ReceiptPDF booking={booking} />}
                fileName={fileName("Receipt")}
                label="⬇  Download Receipt"
              />
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}

/* ─── CSS ─── */
const CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  .cd-wrap {
    min-height: 100dvh;
    background: #f1f5f9;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    padding: 20px 16px 48px;
  }
  .cd-container { max-width: 1060px; margin: 0 auto; }

  /* Empty state */
  .cd-empty-state {
    max-width: 400px; margin: 80px auto;
    text-align: center; padding: 40px;
    background: #fff; border-radius: 16px; border: 1.5px solid #e2e8f0;
  }

  /* ── Topbar ── */
  .cd-topbar {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 18px;
    flex-wrap: wrap;
  }
  .cd-btn-back {
    height: 38px; padding: 0 16px; border-radius: 9px;
    border: 1.5px solid #e2e8f0; background: #fff;
    cursor: pointer; font-size: 13px; font-weight: 700;
    color: #475569; flex-shrink: 0; font-family: inherit;
    transition: all 0.15s; white-space: nowrap;
  }
  .cd-btn-back:hover { border-color: #cbd5e1; background: #f8fafc; color: #0f172a; }

  .cd-topbar-title { flex: 1; min-width: 0; }
  .cd-topbar-sub  { font-size: 11px; font-weight: 700; color: #64748b; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 2px; }
  .cd-topbar-main { font-size: 22px; font-weight: 900; color: #0f172a; letter-spacing: -0.5px; }

  .cd-status-badge {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 6px 14px; border-radius: 999px;
    font-size: 12px; font-weight: 800;
    flex-shrink: 0; white-space: nowrap;
  }
  .cd-status-dot { width: 6px; height: 6px; border-radius: 50%; display: inline-block; flex-shrink: 0; }

  /* ── Progress ── */
  .cd-cancelled-banner {
    background: rgba(220,38,38,0.07); border: 1.5px solid rgba(220,38,38,0.25);
    color: #dc2626; font-weight: 800; font-size: 14px;
    padding: 12px 20px; border-radius: 12px; text-align: center; margin-bottom: 16px;
  }
  .cd-progress-card { margin-bottom: 16px; }
  .cd-progress-track {
    position: relative; height: 4px; background: #e2e8f0;
    border-radius: 99px; margin-bottom: 16px; overflow: hidden;
  }
  .cd-progress-fill {
    position: absolute; left: 0; top: 0; height: 100%; border-radius: 99px;
    background: linear-gradient(90deg, #3b82f6, #6366f1); transition: width 0.5s ease;
  }
  .cd-steps { display: flex; justify-content: space-between; }
  .cd-step  { display: flex; flex-direction: column; align-items: center; gap: 6px; flex: 1; }
  .cd-step-dot {
    width: 28px; height: 28px; border-radius: 50%;
    background: #f1f5f9; color: #94a3b8;
    font-weight: 900; font-size: 12px;
    display: flex; align-items: center; justify-content: center;
    transition: all 0.3s; flex-shrink: 0;
  }
  .cd-step-dot-done { background: linear-gradient(135deg,#3b82f6,#6366f1); color:#fff; box-shadow:0 2px 8px rgba(99,102,241,0.35); }
  .cd-step-label      { font-size: 11px; font-weight: 700; color: #94a3b8; text-align: center; }
  .cd-step-label-done { color: #4f46e5; }

  /* ── Layout ── */
  .cd-cols {
    display: grid;
    grid-template-columns: 1fr 360px;
    gap: 16px;
    align-items: start;
  }
  .cd-col-left, .cd-col-right { display: flex; flex-direction: column; gap: 14px; }

  /* ── Card ── */
  .cd-card {
    background: #fff; border-radius: 14px;
    border: 1.5px solid #e2e8f0; padding: 18px 20px;
    box-shadow: 0 1px 6px rgba(15,23,42,0.04);
  }

  /* ── Section label ── */
  .cd-section-label {
    font-size: 10px; font-weight: 800; letter-spacing: 1.5px;
    text-transform: uppercase; color: #64748b;
    margin-bottom: 14px; padding-bottom: 8px;
    border-bottom: 1px solid rgba(226,232,240,0.7);
  }

  /* ── KV grid ── */
  .cd-kv-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px 20px; }
  .cd-kv-wide { grid-column: 1 / -1; }
  .cd-kv-label { font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.6px; margin-bottom: 3px; }
  .cd-kv-value { font-size: 14px; font-weight: 700; color: #0f172a; word-break: break-word; }

  /* ── Amount grid ── */
  .cd-amount-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 12px; }
  .cd-amount-box  { background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 10px; padding: 12px 10px; text-align: center; }
  .cd-amount-positive { background: rgba(22,163,74,0.06);  border-color: rgba(22,163,74,0.25); }
  .cd-amount-negative { background: rgba(220,38,38,0.05);  border-color: rgba(220,38,38,0.2); }
  .cd-amount-label { font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }
  .cd-amount-value { font-size: 16px; font-weight: 900; color: #0f172a; letter-spacing: -0.3px; word-break: break-all; }
  .cd-amount-positive .cd-amount-value { color: #16a34a; }
  .cd-amount-negative .cd-amount-value { color: #dc2626; }

  .cd-settled-row {
    background: rgba(5,150,105,0.08); border: 1.5px solid rgba(5,150,105,0.25);
    border-radius: 9px; padding: 11px 16px;
    display: flex; justify-content: space-between; align-items: center;
    flex-wrap: wrap; gap: 6px;
  }
  .cd-settled-label { font-size: 13px; font-weight: 800; color: #065f46; }
  .cd-settled-value { font-size: 18px; font-weight: 900; color: #065f46; }

  /* ── Chips ── */
  .cd-chip { display: inline-block; margin: 0 4px 4px 0; padding: 3px 10px; border-radius: 999px; font-size: 11px; font-weight: 700; border: 1px solid; }
  .cd-chip-green   { background: rgba(22,163,74,0.10);   color: #16a34a; border-color: rgba(22,163,74,0.25); }
  .cd-chip-amber   { background: rgba(217,119,6,0.10);   color: #d97706; border-color: rgba(217,119,6,0.25); }
  .cd-chip-default { background: rgba(148,163,184,0.10); color: #94a3b8; border-color: rgba(148,163,184,0.2); }

  /* ── Add-ons ── */
  .cd-addons-section { margin-bottom: 14px; }
  .cd-addons-last    { margin-bottom: 0; }
  .cd-addons-heading { font-size: 10px; font-weight: 800; letter-spacing: 0.8px; text-transform: uppercase; margin-bottom: 8px; }
  .cd-addons-green   { color: #16a34a; }
  .cd-addons-amber   { color: #d97706; }
  .cd-notes-box  { background: #f8fafc; border-radius: 9px; padding: 10px 14px; border: 1.5px solid #e2e8f0; }
  .cd-notes-label{ font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.6px; margin-bottom: 4px; }
  .cd-notes-text { font-size: 13px; font-weight: 600; color: #1e293b; line-height: 1.55; }

  /* ── Ref card ── */
  .cd-ref-card { background: linear-gradient(135deg,#0f172a 0%,#1e293b 100%) !important; border-color: transparent !important; }
  .cd-ref-top  { display: flex; justify-content: space-between; align-items: flex-start; }
  .cd-ref-sub  { font-size: 10px; font-weight: 700; color: rgba(148,163,184,0.8); text-transform: uppercase; letter-spacing: 1.2px; margin-bottom: 6px; }
  .cd-ref-id   { font-size: 26px; font-weight: 900; color: #fff; letter-spacing: 3px; font-family: 'Courier New', monospace; }
  .cd-ref-icon { width: 42px; height: 42px; border-radius: 10px; background: rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0; }
  .cd-ref-bottom { margin-top: 14px; padding-top: 14px; border-top: 1px solid rgba(255,255,255,0.1); display: flex; justify-content: space-between; flex-wrap: wrap; gap: 8px; }
  .cd-ref-meta-label { font-size: 10px; color: rgba(148,163,184,0.7); margin-bottom: 2px; }
  .cd-ref-meta-value { font-size: 13px; font-weight: 700; color: #e2e8f0; }

  /* ── Download buttons ── */
  .cd-dl-wrap { display: flex; flex-direction: column; gap: 10px; }
  .cd-dl-btn  { display: block; width: 100%; padding: 13px 16px; border-radius: 10px; font-weight: 800; font-size: 13px; cursor: pointer; transition: all 0.18s; letter-spacing: 0.2px; font-family: inherit; text-align: center; }
  .cd-dl-btn:disabled { opacity: 0.6; cursor: not-allowed; }
  .cd-dl-btn-primary   { background: linear-gradient(135deg,#1d4ed8,#4f46e5); color: #fff; border: none; box-shadow: 0 4px 14px rgba(79,70,229,0.35); }
  .cd-dl-btn-primary:not(:disabled):hover   { box-shadow: 0 6px 20px rgba(79,70,229,0.45); transform: translateY(-1px); }
  .cd-dl-btn-secondary { background: #fff; color: #0f172a; border: 2px solid #e2e8f0; }
  .cd-dl-btn-secondary:not(:disabled):hover { border-color: #cbd5e1; background: #f8fafc; }

  /* ════════════════════════════════════════
     RESPONSIVE
  ════════════════════════════════════════ */

  /* Tablet landscape — collapse to single column, right col rises */
  @media (max-width: 900px) {
    .cd-cols { grid-template-columns: 1fr; }
    .cd-col-right { order: -1; }
  }

  /* Tablet portrait — tighten spacing, keep 2-col KV */
  @media (max-width: 700px) {
    .cd-wrap { padding: 14px 12px 40px; }
    .cd-topbar-main { font-size: 19px; }
    .cd-kv-grid { grid-template-columns: 1fr 1fr; gap: 14px 16px; }
    .cd-amount-grid { gap: 8px; }
    .cd-amount-value { font-size: 14px; }
    .cd-amount-label { font-size: 8px; }
  }

  /* Mobile large — stack topbar title, single-col KV */
  @media (max-width: 520px) {
    .cd-wrap { padding: 12px 10px 36px; }

    /* Topbar: back btn + badge on row 1, title spans row 2 */
    .cd-topbar { row-gap: 8px; }
    .cd-btn-back     { order: 1; }
    .cd-status-badge { order: 2; margin-left: auto; }
    .cd-topbar-title { order: 3; flex: 0 0 100%; }

    .cd-topbar-main { font-size: 20px; }
    .cd-topbar-sub  { font-size: 10px; }

    .cd-card { padding: 14px; border-radius: 12px; }

    /* KV: single column */
    .cd-kv-grid { grid-template-columns: 1fr; gap: 12px; }
    .cd-kv-wide { grid-column: 1; }

    /* Amount: row layout (label left, value right) */
    .cd-amount-grid { grid-template-columns: 1fr; gap: 8px; }
    .cd-amount-box  { text-align: left; display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; }
    .cd-amount-label{ margin-bottom: 0; font-size: 10px; }
    .cd-amount-value{ font-size: 16px; }

    .cd-settled-label { font-size: 12px; }
    .cd-settled-value { font-size: 16px; }

    .cd-ref-id { font-size: 20px; letter-spacing: 2px; }
    .cd-ref-icon { width: 36px; height: 36px; font-size: 16px; }

    .cd-dl-btn { font-size: 13px; padding: 12px 14px; }

    .cd-step-dot  { width: 26px; height: 26px; font-size: 11px; }
    .cd-step-label{ font-size: 10px; }
  }

  /* Mobile small — micro adjustments */
  @media (max-width: 380px) {
    .cd-wrap { padding: 10px 8px 32px; }
    .cd-card { padding: 12px; border-radius: 10px; }

    .cd-topbar-main { font-size: 17px; }
    .cd-section-label { font-size: 9.5px; letter-spacing: 1px; }
    .cd-kv-label { font-size: 9.5px; }
    .cd-kv-value { font-size: 13px; }

    .cd-amount-value { font-size: 15px; }
    .cd-ref-id       { font-size: 17px; letter-spacing: 1.5px; }
    .cd-ref-icon     { width: 32px; height: 32px; font-size: 14px; }

    .cd-dl-btn { font-size: 12px; padding: 11px 12px; }

    .cd-step-dot  { width: 24px; height: 24px; font-size: 10px; }
    .cd-step-label{ font-size: 9px; }

    .cd-settled-label { font-size: 11px; }
    .cd-settled-value { font-size: 15px; }
  }
`;