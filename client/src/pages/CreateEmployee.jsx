import React, { useState } from "react";
import { createEmployeeAPI } from "../services/operations/authAPI";
import { toast } from "react-hot-toast";
import { useNavigate } from "react-router-dom";

const inputStyle = {
  width: "100%", padding: "0.65rem 0.9rem", fontSize: "0.9rem",
  color: "#0a2d4a", background: "#f8fafc", border: "1.5px solid #e2e8f0",
  borderRadius: 10, outline: "none", boxSizing: "border-box",
  fontFamily: "inherit", transition: "border-color 0.15s, box-shadow 0.15s",
};
const focusIn  = (e) => { e.target.style.borderColor = "#1d6fa4"; e.target.style.boxShadow = "0 0 0 3px rgba(29,111,164,0.12)"; e.target.style.background = "#fff"; };
const focusOut = (e) => { e.target.style.borderColor = "#e2e8f0"; e.target.style.boxShadow = "none"; e.target.style.background = "#f8fafc"; };

const SectionLabel = ({ children }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, marginTop: 6 }}>
    <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#c9a84c", flexShrink: 0 }} />
    <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "#7a8799", textTransform: "uppercase", letterSpacing: "0.1em" }}>{children}</span>
  </div>
);

const FieldGroup = ({ label, children }) => (
  <div style={{ marginBottom: 14 }}>
    <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: "#475569", marginBottom: 5 }}>{label}</label>
    {children}
  </div>
);

function CreateEmployee() {
  const [formData, setFormData] = useState({
    role: "", name: "", contact: "", email: "",
    username: "", password: "", confirmPassword: "",
    status: "active", isPrivate: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [showPw, setShowPw]   = useState(false);
  const [showCPw, setShowCPw] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === "role") {
      setFormData({ ...formData, role: value, isPrivate: value === "onsite" ? true : formData.isPrivate });
      return;
    }
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match"); setLoading(false); return;
    }
    const digits = formData.contact.replace(/[\s\-()]/g, "").replace(/^\+91/, "").replace(/^91/, "").replace(/^0/, "");
    if (!/^[6-9]\d{9}$/.test(digits)) {
      setError("Please enter a valid Indian mobile number"); return;
    }
    setLoading(true);
    try {
      const token = localStorage.getItem("authToken");
      await createEmployeeAPI({
        type: formData.role, name: formData.name, contact: digits,
        email: formData.email, username: formData.username,
        password: formData.password.toLowerCase(), status: formData.status, isPrivate: formData.isPrivate,
      }, token);
      toast.success("Employee created successfully!");
      setFormData({ role: "", name: "", contact: "", email: "", username: "", password: "", confirmPassword: "", status: "active", isPrivate: false });
    } catch (err) {
      let msg = "Failed to create employee.";
      if (err.response?.data) {
        if (typeof err.response.data === "string") msg = err.response.data;
        else if (err.response.data.message) msg = err.response.data.message;
        else if (Array.isArray(err.response.data.errors))
          msg = err.response.data.errors.map((e) => `${e.path || e.field}: ${e.message}`).join(", ");
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9", paddingBottom: 40 }}>

      {/* ── Header ── */}
      <div style={{ background: "linear-gradient(135deg,#051829 0%,#0a2d4a 60%,#0d4a6e 100%)", padding: "18px 20px 20px", display: "flex", alignItems: "center", gap: 14 }}>
        <button
          onClick={() => navigate(-1)}
          style={{ width: 36, height: 36, borderRadius: 10, border: "1px solid rgba(255,255,255,0.18)", background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div>
          <div style={{ fontSize: "0.62rem", fontWeight: 700, color: "#c9a84c", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 3 }}>User Master</div>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 800, color: "#fff", margin: 0 }}>Create Employee</h1>
        </div>
      </div>

      {/* ── Form card ── */}
      <div style={{ maxWidth: 640, margin: "24px auto", padding: "0 16px" }}>
        <form onSubmit={handleSubmit}>
          <div style={{ background: "#fff", borderRadius: 16, boxShadow: "0 2px 16px rgba(5,24,41,0.08)", overflow: "hidden" }}>
            <div style={{ padding: "20px 20px 0" }}>

              <SectionLabel>Role & Visibility</SectionLabel>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
                <FieldGroup label="Role *">
                  <select name="role" value={formData.role} onChange={handleChange} required
                    style={{ ...inputStyle, cursor: "pointer" }}
                    onFocus={focusIn} onBlur={focusOut}
                  >
                    <option value="">Select role</option>
                    <option value="backdesk">Agent</option>
                    <option value="onsite">Staff</option>
                  </select>
                </FieldGroup>
                <FieldGroup label="Visibility">
                  <select
                    value={String(formData.isPrivate)}
                    disabled={formData.role === "onsite"}
                    onChange={(e) => setFormData({ ...formData, isPrivate: e.target.value === "true" })}
                    style={{ ...inputStyle, cursor: formData.role === "onsite" ? "not-allowed" : "pointer", opacity: formData.role === "onsite" ? 0.6 : 1 }}
                    onFocus={focusIn} onBlur={focusOut}
                  >
                    <option value="false">Global</option>
                    <option value="true">Local</option>
                  </select>
                </FieldGroup>
              </div>

              <SectionLabel>Personal Info</SectionLabel>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
                <FieldGroup label="Full Name *">
                  <input type="text" name="name" value={formData.name} onChange={handleChange} placeholder="Enter full name" required
                    style={inputStyle} onFocus={focusIn} onBlur={focusOut} />
                </FieldGroup>
                <FieldGroup label="Contact Number *">
                  <input type="tel" name="contact" value={formData.contact} onChange={handleChange} placeholder="10-digit mobile" required
                    style={inputStyle} onFocus={focusIn} onBlur={focusOut} />
                </FieldGroup>
                <FieldGroup label="Email Address *">
                  <input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="email@example.com" required
                    style={inputStyle} onFocus={focusIn} onBlur={focusOut} />
                </FieldGroup>
                <FieldGroup label="Status">
                  <select name="status" value={formData.status} onChange={handleChange}
                    style={{ ...inputStyle, cursor: "pointer" }} onFocus={focusIn} onBlur={focusOut}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </FieldGroup>
              </div>

              <SectionLabel>Account Credentials</SectionLabel>
              <FieldGroup label="Username *">
                <input type="text" name="username" value={formData.username} onChange={handleChange} placeholder="Login username" required
                  style={inputStyle} onFocus={focusIn} onBlur={focusOut} />
              </FieldGroup>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
                <FieldGroup label="Password *">
                  <div style={{ position: "relative" }}>
                    <input type={showPw ? "text" : "password"} name="password" value={formData.password} onChange={handleChange}
                      placeholder="Set password" required style={{ ...inputStyle, paddingRight: "3.2rem" }} onFocus={focusIn} onBlur={focusOut} />
                    <button type="button" onClick={() => setShowPw((v) => !v)}
                      style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", border: "none", background: "none", fontSize: "0.72rem", color: "#1d6fa4", cursor: "pointer", fontWeight: 700 }}>
                      {showPw ? "Hide" : "Show"}
                    </button>
                  </div>
                </FieldGroup>
                <FieldGroup label="Confirm Password *">
                  <div style={{ position: "relative" }}>
                    <input type={showCPw ? "text" : "password"} name="confirmPassword" value={formData.confirmPassword} onChange={handleChange}
                      placeholder="Re-enter password" required style={{ ...inputStyle, paddingRight: "3.2rem" }} onFocus={focusIn} onBlur={focusOut} />
                    <button type="button" onClick={() => setShowCPw((v) => !v)}
                      style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", border: "none", background: "none", fontSize: "0.72rem", color: "#1d6fa4", cursor: "pointer", fontWeight: 700 }}>
                      {showCPw ? "Hide" : "Show"}
                    </button>
                  </div>
                </FieldGroup>
              </div>

            </div>

            {error && (
              <div style={{ margin: "0 20px 16px", padding: "10px 14px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, fontSize: "0.82rem", color: "#dc2626", fontWeight: 500 }}>
                {error}
              </div>
            )}

            <div style={{ padding: "0 20px 20px" }}>
              <button type="submit" disabled={loading}
                style={{ width: "100%", padding: "12px", borderRadius: 12, border: "none", background: loading ? "#7a8799" : "linear-gradient(135deg,#051829 0%,#0a2d4a 60%,#0d4a6e 100%)", color: "#fff", fontWeight: 700, fontSize: "0.92rem", cursor: loading ? "not-allowed" : "pointer", boxShadow: "0 4px 14px rgba(29,111,164,0.35)", transition: "all 0.2s", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                {loading ? (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: "spin 1s linear infinite" }}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
                    Creating…
                  </>
                ) : "Create Employee"}
              </button>
            </div>
          </div>
        </form>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default CreateEmployee;
