import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createCustomerAPI } from "../services/operations/customerAPI";
import { toast } from "react-hot-toast";

function CustomerForm() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: "", contact: "", alternateContact: "",
    email: "", govtIdType: "None", govtIdNo: "", govtIdImage: null,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [fieldErr, setFieldErr] = useState({});

  const handleChange = (e) => {
    const { name, value, files } = e.target;
    setFieldErr((prev) => ({ ...prev, [name]: "" }));
    if (name === "govtIdType" && value === "None") {
      setFormData((prev) => ({ ...prev, govtIdType: "None", govtIdNo: "", govtIdImage: null }));
    } else if (name === "govtIdImage") {
      setFormData((prev) => ({ ...prev, govtIdImage: files[0] }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const errs = {};
    if (!formData.name.trim()) errs.name = "Full name is required";
    const digits = formData.contact.replace(/[\s\-()+]/g, "").replace(/^91/, "");
    if (!formData.contact.trim()) {
      errs.contact = "Contact number is required";
    } else if (!/^[6-9]\d{9}$/.test(digits)) {
      errs.contact = "Enter a valid 10-digit Indian mobile number";
    }
    if (formData.govtIdType !== "None" && !formData.govtIdNo.trim()) {
      errs.govtIdNo = "ID number is required when ID type is selected";
    }
    if (Object.keys(errs).length) { setFieldErr(errs); return; }

    try {
      setLoading(true);
      const token   = localStorage.getItem("authToken");
      const payload = new FormData();
      for (let key in formData) {
        if (formData.govtIdType === "None" && (key === "govtIdNo" || key === "govtIdImage")) continue;
        if (formData[key] !== null) {
          if (key === "alternateContact" && !formData.alternateContact?.trim()) {
            payload.append("alternateContact", formData.contact);
          } else {
            payload.append(key, formData[key]);
          }
        }
      }
      await createCustomerAPI(payload, token);
      toast.success("Customer created successfully!");
      setFormData({ name: "", contact: "", alternateContact: "", email: "", govtIdType: "None", govtIdNo: "", govtIdImage: null });
      navigate("/customer-management");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create customer. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const noId = formData.govtIdType === "None";

  return (
    <div style={{ background: "#f1f5f9", minHeight: "100dvh", padding: "20px 16px 40px", fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif" }}>
      <style>{`
        @keyframes cf-fade { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        .cf-inp:focus { border-color: #1d6fa4 !important; box-shadow: 0 0 0 3px rgba(29,111,164,0.13) !important; outline: none; }
        .cf-inp::placeholder { color: #94a3b8; }
        .cf-inp:disabled { background: #f1f5f9 !important; color: #94a3b8; cursor: not-allowed; }
        .cf-file::-webkit-file-upload-button { display:none; }
        .cf-file::before { content: "Choose file"; display:inline-block; padding:4px 12px; background:#e2e8f0; border-radius:6px; font-size:0.8rem; font-weight:600; color:#475569; margin-right:10px; cursor:pointer; }
        .cf-submit:hover:not(:disabled) { opacity: 0.9; transform: translateY(-1px); box-shadow: 0 6px 20px rgba(5,24,41,0.28) !important; }
        .cf-submit:disabled { opacity: 0.55; cursor: not-allowed; }
        .cf-manage:hover { background: rgba(201,168,76,0.28) !important; }
        .cf-back:hover { background: rgba(255,255,255,0.18) !important; }
      `}</style>

      <div style={{ maxWidth: 980, margin: "0 auto", animation: "cf-fade 0.22s ease" }}>

        {/* ── Header ── */}
        <div style={{
          background: "linear-gradient(135deg, #051829 0%, #0a2d4a 60%, #0d4a6e 100%)",
          borderRadius: 16, padding: "20px 24px", marginBottom: 20,
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14,
          boxShadow: "0 4px 24px rgba(5,24,41,0.18)",
        }}>
          <button
            className="cf-back"
            onClick={() => navigate(-1)}
            title="Go back"
            style={{
              width: 36, height: 36, borderRadius: 10, border: "1px solid rgba(255,255,255,0.18)",
              background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)",
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: "1.35rem", fontWeight: 800, color: "#fff", margin: 0, lineHeight: 1.1 }}>
              Customers
            </h1>
          </div>
          <button
            className="cf-manage"
            onClick={() => navigate("/customer-management")}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "7px 16px", borderRadius: 10, fontSize: "0.84rem", fontWeight: 700,
              border: "1.5px solid rgba(201,168,76,0.45)", background: "rgba(201,168,76,0.18)",
              color: "#e8d5a0", cursor: "pointer", transition: "all 0.15s",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            All Customers
          </button>
        </div>

        {/* ── Error banner ── */}
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

        {/* ── Form card ── */}
        <form onSubmit={handleSubmit} noValidate>
          <div style={{
            background: "#fff", borderRadius: 14, border: "1px solid #e8eef5",
            boxShadow: "0 2px 12px rgba(0,0,0,0.06)", overflow: "hidden",
          }}>

            {/* Basic Info section */}
            <div style={{ padding: "20px 24px 0" }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 8, marginBottom: 16,
                paddingBottom: 10, borderBottom: "1.5px solid #f1f5f9",
              }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#1d6fa4", flexShrink: 0 }} />
                <span style={{ fontSize: "0.7rem", fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  Basic Information
                </span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
                {/* Full Name */}
                <Field label="Full Name" required error={fieldErr.name}>
                  <input className="cf-inp" style={inpStyle(fieldErr.name)} type="text" name="name"
                    value={formData.name} onChange={handleChange} placeholder="Enter full name" />
                </Field>

                {/* Contact */}
                <Field label="Contact Number" required error={fieldErr.contact}>
                  <input className="cf-inp" style={inpStyle(fieldErr.contact)} type="tel" name="contact"
                    value={formData.contact} onChange={handleChange} placeholder="+91 00000 00000" />
                </Field>

                {/* WhatsApp */}
                <Field label="WhatsApp Number" optional>
                  <input className="cf-inp" style={inpStyle()} type="tel" name="alternateContact"
                    value={formData.alternateContact} onChange={handleChange} placeholder="Same as contact if blank" />
                </Field>

                {/* Email */}
                <Field label="Email Address" optional>
                  <input className="cf-inp" style={inpStyle()} type="email" name="email"
                    value={formData.email} onChange={handleChange} placeholder="customer@email.com" />
                </Field>
              </div>
            </div>

            {/* Divider */}
            <div style={{ height: 1, background: "#f1f5f9" }} />

            {/* Govt ID section */}
            <div style={{ padding: "20px 24px" }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 8, marginBottom: 16,
                paddingBottom: 10, borderBottom: "1.5px solid #f1f5f9",
              }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#8b5cf6", flexShrink: 0 }} />
                <span style={{ fontSize: "0.7rem", fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  Government ID
                </span>
                <span style={{ fontSize: "0.7rem", color: "#94a3b8", fontWeight: 500 }}>optional</span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                {/* ID Type */}
                <Field label="ID Type">
                  <div style={{ position: "relative" }}>
                    <select className="cf-inp" style={{ ...inpStyle(), paddingRight: 36, cursor: "pointer",
                      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%2364748b' stroke-width='1.5' stroke-linecap='round' fill='none'/%3E%3C/svg%3E")`,
                      backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center", appearance: "none",
                    }} name="govtIdType" value={formData.govtIdType} onChange={handleChange}>
                      <option value="None">None</option>
                      <option value="Aadhar">Aadhar</option>
                      <option value="PAN">PAN</option>
                      <option value="Driving License">Driving License</option>
                      <option value="Passport">Passport</option>
                    </select>
                  </div>
                </Field>

                {/* ID Number */}
                <Field label="ID Number" error={fieldErr.govtIdNo}>
                  <input className="cf-inp" style={{ ...inpStyle(fieldErr.govtIdNo), ...(noId ? { background: "#f8fafc" } : {}) }}
                    type="text" name="govtIdNo" value={formData.govtIdNo} onChange={handleChange}
                    placeholder={noId ? "Select ID type first" : "Enter ID number"}
                    disabled={noId} required={!noId} />
                </Field>

                {/* Upload */}
                <div style={{ gridColumn: "span 2" }}>
                  <Field label="Upload ID Image">
                    <div style={{
                      position: "relative",
                      border: `1.5px dashed ${noId ? "#e2e8f0" : "#cbd5e1"}`,
                      borderRadius: 10, padding: "12px 16px",
                      background: "#f8fafc",
                      display: "flex", alignItems: "center", gap: 12,
                      cursor: noId ? "not-allowed" : "pointer",
                      transition: "border-color 0.15s",
                    }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={noId ? "#cbd5e1" : "#64748b"} strokeWidth="1.8">
                        <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
                        <polyline points="21 15 16 10 5 21"/>
                      </svg>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: "0.82rem", fontWeight: 600, color: noId ? "#94a3b8" : "#475569" }}>
                          {formData.govtIdImage ? formData.govtIdImage.name : "Click to upload ID image"}
                        </div>
                        <div style={{ fontSize: "0.72rem", color: "#94a3b8", marginTop: 2 }}>PNG, JPG, JPEG accepted</div>
                      </div>
                      <input className="cf-inp" type="file" name="govtIdImage" accept="image/*"
                        onChange={handleChange} disabled={noId}
                        style={{ position: "absolute", inset: 0, opacity: 0, cursor: noId ? "not-allowed" : "pointer", width: "100%", height: "100%" }} />
                    </div>
                  </Field>
                </div>
              </div>
            </div>

            {/* Submit button */}
            <div style={{ padding: "0 24px 24px" }}>
              <button
                type="submit"
                className="cf-submit"
                disabled={loading}
                style={{
                  width: "100%", height: 52, borderRadius: 12, border: "none",
                  background: loading ? "#94a3b8" : "linear-gradient(90deg, #051829 0%, #0d4a6e 100%)",
                  color: "#e8d5a0", fontSize: "0.97rem", fontWeight: 700,
                  cursor: loading ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                  transition: "all 0.18s", boxShadow: "0 4px 14px rgba(5,24,41,0.22)",
                  letterSpacing: "0.01em",
                }}
              >
                {loading ? (
                  <>
                    <div style={{ width: 18, height: 18, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#e8d5a0", borderRadius: "50%", animation: "cf-spin .7s linear infinite" }} />
                    Creating…
                  </>
                ) : (
                  <>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="16" y1="11" x2="22" y2="11"/></svg>
                    Create Customer Profile
                  </>
                )}
              </button>
            </div>
          </div>
        </form>

        <style>{`@keyframes cf-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}

/* ── helpers ── */
const inpStyle = (err) => ({
  width: "100%", height: 42, padding: "0 12px",
  fontSize: "0.9rem", border: `1.5px solid ${err ? "#f87171" : "#e2e8f0"}`,
  borderRadius: 10, background: "#fff", color: "#1e293b",
  fontFamily: "inherit", transition: "border-color 0.15s, box-shadow 0.15s",
  boxSizing: "border-box", display: "block",
});

function Field({ label, required, optional, error, children }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#475569", marginBottom: 5 }}>
        {label}
        {required && <span style={{ color: "#ef4444", marginLeft: 2 }}>*</span>}
        {optional && <span style={{ fontSize: "0.7rem", color: "#94a3b8", marginLeft: 4, fontWeight: 400 }}>optional</span>}
      </label>
      {children}
      {error && (
        <span style={{ fontSize: "0.72rem", color: "#ef4444", marginTop: 3, display: "flex", alignItems: "center", gap: 3 }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          {error}
        </span>
      )}
    </div>
  );
}

export default CustomerForm;
