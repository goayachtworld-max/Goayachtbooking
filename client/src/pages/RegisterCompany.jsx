import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { registerCompanyAPI } from "../services/operations/companyAPI";
import toast from "react-hot-toast";

const FIELDS_ADMIN = [
    { name: "username",  label: "Username",     type: "text",     placeholder: "Enter username",        req: true },
    { name: "password",  label: "Password",     type: "password", placeholder: "Enter password",        req: true },
    { name: "name",      label: "Full Name",    type: "text",     placeholder: "Admin's full name",     req: true },
    { name: "email",     label: "Email",        type: "email",    placeholder: "admin@company.com",     req: true },
    { name: "contact",   label: "Contact",      type: "tel",      placeholder: "Enter contact number",  req: true },
];

const FIELDS_COMPANY = [
    { name: "companyName", label: "Company Name", type: "text", placeholder: "Enter company name", req: true },
    { name: "companyCode", label: "Company Code", type: "text", placeholder: "Short unique code",  req: true },
];

function RegisterCompany() {
    const navigate = useNavigate();

    const [form, setForm] = useState({
        username: "", password: "", name: "", email: "", contact: "",
        companyName: "", companyCode: "", address: "",
    });
    const [loading, setLoading]   = useState(false);
    const [error, setError]       = useState("");
    const [fieldErr, setFieldErr] = useState({});
    const [showPass, setShowPass] = useState(false);

    const handleChange = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value });
        setFieldErr((prev) => ({ ...prev, [e.target.name]: "" }));
        setError("");
    };

    const validate = () => {
        const e = {};
        if (!form.username.trim())    e.username    = "Username is required";
        if (!form.password.trim())    e.password    = "Password is required";
        if (form.password && form.password.length < 6) e.password = "Minimum 6 characters";
        if (!form.name.trim())        e.name        = "Full name is required";
        if (!form.email.trim())       e.email       = "Email is required";
        if (!form.contact.trim())     e.contact     = "Contact is required";
        if (!form.companyName.trim()) e.companyName = "Company name is required";
        if (!form.companyCode.trim()) e.companyCode = "Company code is required";
        if (!form.address.trim())     e.address     = "Address is required";
        return e;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const errs = validate();
        if (Object.keys(errs).length) { setFieldErr(errs); return; }
        try {
            setLoading(true);
            const token = localStorage.getItem("authToken");
            await registerCompanyAPI(token, form);
            toast.success("Company & Admin created successfully!");
            navigate(-1);
        } catch (err) {
            setError(err.response?.data?.message || "Something went wrong. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ background: "#f1f5f9", minHeight: "100dvh", padding: "20px 16px 40px", fontFamily: "system-ui,-apple-system,'Segoe UI',sans-serif" }}>
            <style>{`
                @keyframes rc-fade { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
                @keyframes rc-spin { to { transform: rotate(360deg); } }
                .rc-inp:focus { border-color: #1d6fa4 !important; box-shadow: 0 0 0 3px rgba(29,111,164,0.13) !important; outline: none; }
                .rc-inp::placeholder { color: #94a3b8; }
                .rc-inp:disabled { background: #f1f5f9 !important; color: #94a3b8; cursor: not-allowed; }
                .rc-textarea:focus { border-color: #1d6fa4 !important; box-shadow: 0 0 0 3px rgba(29,111,164,0.13) !important; outline: none; }
                .rc-textarea::placeholder { color: #94a3b8; }
                .rc-submit:hover:not(:disabled) { opacity: 0.9; transform: translateY(-1px); box-shadow: 0 6px 20px rgba(5,24,41,0.28) !important; }
                .rc-submit:disabled { opacity: 0.55; cursor: not-allowed; }
                .rc-back:hover { background: rgba(255,255,255,0.18) !important; }
                @media (max-width: 620px) { .rc-grid2 { grid-template-columns: 1fr !important; } }
            `}</style>

            <div style={{ maxWidth: 980, margin: "0 auto", animation: "rc-fade 0.22s ease" }}>

                {/* ── Header ── */}
                <div style={{
                    background: "linear-gradient(135deg, #051829 0%, #0a2d4a 60%, #0d4a6e 100%)",
                    borderRadius: 16, padding: "20px 24px", marginBottom: 20,
                    display: "flex", alignItems: "center", gap: 14,
                    boxShadow: "0 4px 24px rgba(5,24,41,0.18)",
                }}>
                    <button
                        className="rc-back"
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
                    <div>
                        <div style={{ fontSize: "0.65rem", fontWeight: 700, color: "#c9a84c", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>
                            Setup
                        </div>
                        <h1 style={{ fontSize: "1.35rem", fontWeight: 800, color: "#fff", margin: 0, lineHeight: 1.1 }}>
                            Create Company &amp; Admin
                        </h1>
                    </div>
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

                <form onSubmit={handleSubmit} noValidate>
                    <div style={{
                        background: "#fff", borderRadius: 14, border: "1px solid #e8eef5",
                        boxShadow: "0 2px 12px rgba(0,0,0,0.06)", overflow: "hidden",
                    }}>

                        {/* ── Admin Details ── */}
                        <Section dot="#1d6fa4" title="Admin Details" subtitle="Login credentials and contact info for the administrator">
                            <div className="rc-grid2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                                {FIELDS_ADMIN.map((f) => (
                                    <RCField key={f.name} label={f.label} required={f.req} error={fieldErr[f.name]}>
                                        {f.name === "password" ? (
                                            <div style={{ position: "relative" }}>
                                                <input
                                                    className="rc-inp"
                                                    style={inpStyle(fieldErr[f.name])}
                                                    type={showPass ? "text" : "password"}
                                                    name="password"
                                                    value={form.password}
                                                    onChange={handleChange}
                                                    placeholder={f.placeholder}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowPass((v) => !v)}
                                                    style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: 4, display: "flex" }}
                                                >
                                                    {showPass
                                                        ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                                                        : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                                    }
                                                </button>
                                            </div>
                                        ) : (
                                            <input
                                                className="rc-inp"
                                                style={inpStyle(fieldErr[f.name])}
                                                type={f.type}
                                                name={f.name}
                                                value={form[f.name]}
                                                onChange={handleChange}
                                                placeholder={f.placeholder}
                                            />
                                        )}
                                    </RCField>
                                ))}
                            </div>
                        </Section>

                        <div style={{ height: 1, background: "#f1f5f9" }} />

                        {/* ── Company Details ── */}
                        <Section dot="#c9a84c" title="Company Details" subtitle="Legal name, short code, and registered address">
                            <div className="rc-grid2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                                {FIELDS_COMPANY.map((f) => (
                                    <RCField key={f.name} label={f.label} required={f.req} error={fieldErr[f.name]}>
                                        <input
                                            className="rc-inp"
                                            style={inpStyle(fieldErr[f.name])}
                                            type={f.type}
                                            name={f.name}
                                            value={form[f.name]}
                                            onChange={handleChange}
                                            placeholder={f.placeholder}
                                        />
                                    </RCField>
                                ))}

                                <div style={{ gridColumn: "span 2" }}>
                                    <RCField label="Address" required error={fieldErr.address}>
                                        <textarea
                                            className="rc-textarea"
                                            style={{
                                                width: "100%", padding: "10px 12px", fontSize: "0.9rem",
                                                border: `1.5px solid ${fieldErr.address ? "#f87171" : "#e2e8f0"}`,
                                                borderRadius: 10, background: "#fff", color: "#1e293b",
                                                fontFamily: "inherit", resize: "vertical", minHeight: 90,
                                                transition: "border-color 0.15s, box-shadow 0.15s", boxSizing: "border-box",
                                            }}
                                            name="address"
                                            rows={3}
                                            value={form.address}
                                            onChange={handleChange}
                                            placeholder="Street, city, state, PIN"
                                        />
                                    </RCField>
                                </div>
                            </div>
                        </Section>

                        {/* ── Submit ── */}
                        <div style={{ padding: "0 24px 24px" }}>
                            <button
                                type="submit"
                                className="rc-submit"
                                disabled={loading}
                                style={{
                                    width: "100%", height: 52, borderRadius: 12, border: "none",
                                    background: loading ? "#94a3b8" : "linear-gradient(90deg, #051829 0%, #0d4a6e 100%)",
                                    color: "#e8d5a0", fontSize: "0.97rem", fontWeight: 700,
                                    cursor: loading ? "not-allowed" : "pointer",
                                    display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                                    transition: "all 0.18s", boxShadow: "0 4px 14px rgba(5,24,41,0.22)",
                                }}
                            >
                                {loading ? (
                                    <>
                                        <div style={{ width: 18, height: 18, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#e8d5a0", borderRadius: "50%", animation: "rc-spin .7s linear infinite" }} />
                                        Creating…
                                    </>
                                ) : (
                                    <>
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                                        Create Company &amp; Admin
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}

/* ── Sub-components ── */
function Section({ dot, title, subtitle, children }) {
    return (
        <div style={{ padding: "20px 24px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, paddingBottom: 10, borderBottom: "1.5px solid #f1f5f9" }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: dot, flexShrink: 0 }} />
                <span style={{ fontSize: "0.7rem", fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em" }}>{title}</span>
            </div>
            {subtitle && <p style={{ fontSize: "0.78rem", color: "#94a3b8", margin: "6px 0 14px" }}>{subtitle}</p>}
            {children}
        </div>
    );
}

function RCField({ label, required, error, children }) {
    return (
        <div>
            <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#475569", marginBottom: 5 }}>
                {label}{required && <span style={{ color: "#ef4444", marginLeft: 2 }}>*</span>}
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

const inpStyle = (err) => ({
    width: "100%", height: 42, padding: "0 12px",
    fontSize: "0.9rem", border: `1.5px solid ${err ? "#f87171" : "#e2e8f0"}`,
    borderRadius: 10, background: "#fff", color: "#1e293b",
    fontFamily: "inherit", transition: "border-color 0.15s, box-shadow 0.15s",
    boxSizing: "border-box", display: "block",
});

export default RegisterCompany;
