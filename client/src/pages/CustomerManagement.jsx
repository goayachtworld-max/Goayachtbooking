import React, { useEffect, useState } from "react";
import {
    getCustomersAPI,
    updateCustomerAPI,
    searchCustomersByNameAPI,
} from "../services/operations/customerAPI";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";

const initials = (name = "") =>
    name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "?";

const COLORS = ["#0d4a6e","#1d6fa4","#c9a84c","#0a2d4a","#2e7d32","#6a1b9a","#c62828","#00695c"];
const avatarColor = (name = "") => COLORS[name.charCodeAt(0) % COLORS.length];

function CustomerManagement() {
    const token = localStorage.getItem("authToken");
    const navigate = useNavigate();

    const [customers, setCustomers]           = useState([]);
    const [page, setPage]                     = useState(1);
    const [totalPages, setTotalPages]         = useState(1);
    const [totalCount, setTotalCount]         = useState(0);
    const [loading, setLoading]               = useState(false);
    const [searchTerm, setSearchTerm]         = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [showModal, setShowModal]           = useState(false);
    const [modalLoading, setModalLoading]     = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [formData, setFormData]             = useState({ name: "", contact: "", email: "", alternateContact: "" });
    const [formErrors, setFormErrors]         = useState({});

    useEffect(() => {
        const t = setTimeout(() => { setDebouncedSearch(searchTerm); setPage(1); }, 450);
        return () => clearTimeout(t);
    }, [searchTerm]);

    const fetchCustomers = async () => {
        try {
            setLoading(true);
            const q = debouncedSearch.trim();
            if (q.length >= 2) {
                const r = await searchCustomersByNameAPI(q, token);
                setCustomers(r.data.customers || []);
                setTotalPages(1);
                setTotalCount(r.data.customers?.length || 0);
            } else if (q.length === 0) {
                const r = await getCustomersAPI(page, 10, token);
                setCustomers(r.data.customers || []);
                setTotalPages(r.data.totalPages || 1);
                setTotalCount(r.data.totalCount || r.data.customers?.length || 0);
            } else {
                setCustomers([]); setTotalPages(1); setTotalCount(0);
            }
        } catch { toast.error("Failed to fetch customers"); }
        finally { setLoading(false); }
    };
    useEffect(() => { fetchCustomers(); }, [page, debouncedSearch]);

    const openEdit = (c) => {
        setSelectedCustomer(c);
        setFormData({ name: c.name || "", contact: c.contact || "", email: c.email || "", alternateContact: c.alternateContact || "" });
        setFormErrors({});
        setShowModal(true);
    };

    const validate = () => {
        const e = {};
        if (!formData.name.trim())    e.name    = "Name is required";
        if (!formData.contact.trim()) e.contact = "Contact is required";
        return e;
    };

    const handleUpdate = async (ev) => {
        ev.preventDefault();
        const e = validate();
        if (Object.keys(e).length) { setFormErrors(e); return; }
        try {
            setModalLoading(true);
            await updateCustomerAPI(selectedCustomer._id, formData, token);
            toast.success("Customer updated successfully");
            setShowModal(false);
            fetchCustomers();
        } catch { toast.error("Update failed"); }
        finally { setModalLoading(false); }
    };

    const pageRange = () => {
        const left  = Math.max(1, page - 2);
        const right = Math.min(totalPages, page + 2);
        return Array.from({ length: right - left + 1 }, (_, i) => left + i);
    };

    /* ── inline styles ── */
    const s = {
        wrap: { background: "#f1f5f9", minHeight: "100dvh", padding: "20px 16px 32px", fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif" },
        inner: { maxWidth: 980, margin: "0 auto" },

        /* header */
        header: {
            background: "linear-gradient(135deg, #051829 0%, #0a2d4a 60%, #0d4a6e 100%)",
            borderRadius: 16, padding: "20px 24px", marginBottom: 20,
            display: "flex", alignItems: "center", justifyContent: "space-between",
            flexWrap: "wrap", gap: 12,
            boxShadow: "0 4px 24px rgba(5,24,41,0.18)",
        },
        headerLeft: { display: "flex", flexDirection: "column", gap: 4 },
        headerTag: { fontSize: "0.65rem", fontWeight: 700, color: "#c9a84c", textTransform: "uppercase", letterSpacing: "0.1em" },
        headerTitle: { fontSize: "1.4rem", fontWeight: 800, color: "#fff", margin: 0, lineHeight: 1.1 },
        countBadge: {
            display: "inline-flex", alignItems: "center", gap: 6,
            background: "rgba(201,168,76,0.18)", border: "1px solid rgba(201,168,76,0.35)",
            borderRadius: 20, padding: "3px 12px", fontSize: "0.78rem", fontWeight: 700, color: "#e8d5a0",
            marginTop: 4,
        },
        headerRight: { display: "flex", gap: 8, alignItems: "center" },
        btnPrimary: {
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "8px 18px", borderRadius: 10, fontSize: "0.87rem", fontWeight: 700,
            border: "1.5px solid rgba(201,168,76,0.45)", cursor: "pointer",
            background: "rgba(201,168,76,0.18)",
            color: "#e8d5a0", transition: "all 0.15s", whiteSpace: "nowrap",
        },
        btnBack: {
            width: 36, height: 36, borderRadius: 10,
            background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.18)",
            color: "rgba(255,255,255,0.7)", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        },

        /* search */
        searchWrap: { position: "relative", marginBottom: 16 },
        searchIco: { position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#94a3b8", pointerEvents: "none" },
        search: {
            width: "100%", height: 44, padding: "0 16px 0 42px",
            fontSize: "0.92rem", border: "1.5px solid #e2e8f0", borderRadius: 12,
            background: "#fff", color: "#1e293b", outline: "none",
            fontFamily: "inherit", boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
            transition: "border-color 0.15s, box-shadow 0.15s",
        },

        /* table card */
        card: { background: "#fff", borderRadius: 14, border: "1px solid #e8eef5", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", overflow: "hidden" },

        /* table */
        th: { padding: "11px 16px", fontSize: "0.7rem", fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.07em", background: "#f8fafc", borderBottom: "2px solid #e8eef5", whiteSpace: "nowrap", textAlign: "left" },
        td: { padding: "13px 16px", fontSize: "0.875rem", color: "#1e293b", borderBottom: "1px solid #f1f5f9", verticalAlign: "middle" },

        /* mobile card row */
        mobileRow: { display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderBottom: "1px solid #f1f5f9" },

        /* action btns */
        btnEdit: {
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 32, height: 32, borderRadius: 8,
            border: "1.5px solid rgba(29,111,164,0.35)", background: "rgba(13,74,110,0.06)",
            color: "#0d4a6e", cursor: "pointer", transition: "all 0.15s", flexShrink: 0,
        },
        btnView: {
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 32, height: 32, borderRadius: 8,
            border: "1.5px solid #e2e8f0", background: "#f8fafc",
            color: "#475569", cursor: "pointer", transition: "all 0.15s", flexShrink: 0,
        },

        /* pagination */
        pageBtn: { minWidth: 34, height: 34, padding: "0 8px", borderRadius: 8, fontSize: "0.82rem", fontWeight: 600, border: "1.5px solid #e2e8f0", background: "#fff", color: "#475569", cursor: "pointer", transition: "all 0.15s", fontFamily: "inherit" },
        pageBtnActive: { background: "#0d4a6e", borderColor: "#0d4a6e", color: "#fff" },

        /* empty */
        empty: { textAlign: "center", padding: "56px 24px" },
        emptyIcon: { fontSize: "3rem", marginBottom: 12, opacity: 0.6 },

        /* modal overlay */
        overlay: { position: "fixed", inset: 0, background: "rgba(5,24,41,0.55)", backdropFilter: "blur(4px)", zIndex: 1050, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 },
        modal: { background: "#fff", borderRadius: 16, boxShadow: "0 12px 60px rgba(0,0,0,0.22)", width: "100%", maxWidth: 480, maxHeight: "90vh", overflowY: "auto" },
        modalHdr: {
            background: "linear-gradient(90deg, #051829, #0a2d4a)",
            padding: "16px 20px", borderRadius: "16px 16px 0 0",
            display: "flex", alignItems: "center", justifyContent: "space-between",
        },
        modalTitle: { color: "#e8d5a0", fontWeight: 800, fontSize: "1rem", margin: 0 },
        modalClose: { width: 30, height: 30, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.08)", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem" },
        modalAvatarRow: { display: "flex", alignItems: "center", gap: 12, padding: "16px 20px 12px", borderBottom: "1px solid #f1f5f9" },
        lbl: { display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#475569", marginBottom: 4 },
        inp: { width: "100%", height: 42, padding: "0 12px", fontSize: "0.9rem", border: "1.5px solid #e2e8f0", borderRadius: 10, background: "#fff", color: "#1e293b", outline: "none", fontFamily: "inherit", transition: "border-color 0.15s, box-shadow 0.15s" },
        inpErr: { borderColor: "#ef4444" },
        errMsg: { fontSize: "0.73rem", color: "#ef4444", marginTop: 3, display: "block" },
        modalFooter: { padding: "14px 20px", borderTop: "1px solid #f1f5f9", display: "flex", gap: 8, justifyContent: "flex-end" },
        btnCancel: { padding: "8px 18px", borderRadius: 10, fontSize: "0.87rem", fontWeight: 600, border: "1.5px solid #e2e8f0", background: "#f8fafc", color: "#475569", cursor: "pointer" },
        btnSave: { padding: "8px 20px", borderRadius: 10, fontSize: "0.87rem", fontWeight: 700, border: "none", background: "linear-gradient(90deg,#051829,#0d4a6e)", color: "#e8d5a0", cursor: "pointer" },
    };

    const spinner = (
        <div style={{ display: "flex", justifyContent: "center", padding: "56px 0" }}>
            <div style={{ width: 36, height: 36, border: "3px solid #e2e8f0", borderTopColor: "#0d4a6e", borderRadius: "50%", animation: "cm-spin .7s linear infinite" }} />
        </div>
    );

    return (
        <div style={s.wrap}>
            <style>{`
                @keyframes cm-spin { to { transform: rotate(360deg); } }
                @keyframes cm-fade { from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)} }
                .cm-row:hover td { background: #f8fafc !important; }
                .cm-mob-row:hover { background: #f8fafc; }
                .cm-search-input:focus { border-color: #1d6fa4 !important; box-shadow: 0 0 0 3px rgba(29,111,164,0.12) !important; }
                .cm-inp-field:focus { border-color: #1d6fa4 !important; box-shadow: 0 0 0 3px rgba(29,111,164,0.12) !important; }
                .cm-btn-edit:hover { background: rgba(13,74,110,0.12) !important; border-color: #0d4a6e !important; }
                .cm-btn-view:hover { background: #f1f5f9 !important; border-color: #cbd5e1 !important; }
                .cm-page-btn:hover:not(:disabled):not(.active) { border-color: #0d4a6e !important; color: #0d4a6e !important; }
                .cm-btn-new:hover { background: rgba(201,168,76,0.28) !important; }
                .cm-btn-save:hover:not(:disabled) { opacity: 0.88; }
                .cm-btn-save:disabled { opacity: 0.55; cursor: not-allowed; }
            `}</style>

            <div style={s.inner}>
                {/* ── Header ── */}
                <div style={s.header}>
                    {/* Left: back button + title */}
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                        <button style={s.btnBack} onClick={() => navigate(-1)} title="Go back">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
                        </button>
                        <div style={s.headerLeft}>
                            <h1 style={s.headerTitle}>Customer Details</h1>
                            {!loading && (
                                <span style={s.countBadge}>
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                                    {debouncedSearch ? `${customers.length} result${customers.length !== 1 ? "s" : ""}` : `${totalCount} customer${totalCount !== 1 ? "s" : ""}`}
                                </span>
                            )}
                        </div>
                    </div>
                    {/* Right: add button */}
                    <button
                        onClick={() => navigate("/create-customer")}
                        title="Add Customer"
                        style={{
                            width: 42, height: 42, borderRadius: "50%", border: "none",
                            background: "#1d6fa4", color: "#fff",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            cursor: "pointer", flexShrink: 0,
                            boxShadow: "0 4px 14px rgba(29,111,164,0.45)",
                            transition: "background 0.15s, transform 0.15s",
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = "#155f8a"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "#1d6fa4"; }}
                    >
                        <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M9 3V15M3 9H15" stroke="white" strokeWidth="2.2" strokeLinecap="round"/></svg>
                    </button>
                </div>

                {/* ── Search ── */}
                <div style={s.searchWrap}>
                    <span style={s.searchIco}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    </span>
                    <input
                        className="cm-search-input"
                        style={s.search}
                        placeholder="Search customers by name…"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    {searchTerm && (
                        <button
                            onClick={() => setSearchTerm("")}
                            style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#94a3b8", display: "flex", padding: 4 }}
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                    )}
                </div>

                {/* ── Body ── */}
                {loading ? spinner : customers.length === 0 ? (
                    <div style={s.card}>
                        <div style={s.empty}>
                            <div style={s.emptyIcon}>👥</div>
                            <div style={{ fontSize: "1rem", fontWeight: 700, color: "#1e293b", marginBottom: 6 }}>No customers found</div>
                            <div style={{ fontSize: "0.85rem", color: "#64748b" }}>
                                {debouncedSearch ? `No results for "${debouncedSearch}"` : "Add your first customer to get started"}
                            </div>
                            {!debouncedSearch && (
                                <button
                                    onClick={() => navigate("/create-customer")}
                                    style={{ ...s.btnPrimary, marginTop: 20, background: "#0d4a6e", border: "none", color: "#e8d5a0" }}
                                >
                                    + Add Customer
                                </button>
                            )}
                        </div>
                    </div>
                ) : (
                    <>
                        {/* ── Desktop Table ── */}
                        <div style={{ ...s.card, display: "block" }} className="cm-desk-view">
                            <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                <thead>
                                    <tr>
                                        <th style={s.th}>#</th>
                                        <th style={s.th}>Customer</th>
                                        <th style={s.th}>Contact</th>
                                        <th style={s.th}>WhatsApp</th>
                                        <th style={s.th}>Email</th>
                                        <th style={{ ...s.th, width: 140, textAlign: "right" }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {customers.map((c, i) => (
                                        <tr key={c._id} className="cm-row">
                                            <td style={{ ...s.td, color: "#94a3b8", fontSize: "0.78rem", fontWeight: 600, width: 44 }}>
                                                {debouncedSearch ? i + 1 : (page - 1) * 10 + i + 1}
                                            </td>
                                            <td style={s.td}>
                                                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                                    <div style={{ width: 34, height: 34, borderRadius: "50%", flexShrink: 0, background: avatarColor(c.name), color: "#fff", fontSize: "0.75rem", fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                                        {initials(c.name)}
                                                    </div>
                                                    <span style={{ fontWeight: 700, color: "#1e293b" }}>{c.name}</span>
                                                </div>
                                            </td>
                                            <td style={s.td}>
                                                <a href={`tel:${c.contact}`} style={{ color: "#0d4a6e", textDecoration: "none", fontWeight: 600, fontSize: "0.86rem" }}>{c.contact}</a>
                                            </td>
                                            <td style={s.td}>
                                                {c.alternateContact
                                                    ? <a href={`tel:${c.alternateContact}`} style={{ color: "#0d4a6e", textDecoration: "none", fontWeight: 600, fontSize: "0.86rem" }}>{c.alternateContact}</a>
                                                    : <span style={{ color: "#cbd5e1" }}>—</span>}
                                            </td>
                                            <td style={{ ...s.td, color: "#64748b", fontSize: "0.84rem" }}>
                                                {c.email || <span style={{ color: "#cbd5e1" }}>—</span>}
                                            </td>
                                            <td style={{ ...s.td, textAlign: "right" }}>
                                                <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                                                    <button className="cm-btn-view" style={s.btnView} title="View" onClick={() => navigate(`/customer-details/${c._id}`)}>
                                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                                    </button>
                                                    <button className="cm-btn-edit" style={s.btnEdit} title="Edit" onClick={() => openEdit(c)}>
                                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* ── Mobile Cards ── */}
                        <div style={{ ...s.card, display: "none" }} className="cm-mob-view">
                            {customers.map((c) => (
                                <div key={c._id} className="cm-mob-row" style={s.mobileRow}>
                                    <div style={{ width: 42, height: 42, borderRadius: "50%", flexShrink: 0, background: avatarColor(c.name), color: "#fff", fontSize: "0.88rem", fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                        {initials(c.name)}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: 700, color: "#1e293b", fontSize: "0.92rem", marginBottom: 2 }}>{c.name}</div>
                                        <div style={{ fontSize: "0.8rem", color: "#0d4a6e", fontWeight: 600 }}>{c.contact}</div>
                                        {c.email && <div style={{ fontSize: "0.75rem", color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.email}</div>}
                                    </div>
                                    <div style={{ display: "flex", flexDirection: "row", gap: 6, flexShrink: 0 }}>
                                        <button className="cm-btn-view" style={s.btnView} title="View" onClick={() => navigate(`/customer-details/${c._id}`)}>
                                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                        </button>
                                        <button className="cm-btn-edit" style={s.btnEdit} title="Edit" onClick={() => openEdit(c)}>
                                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* ── Pagination ── */}
                        {!debouncedSearch && totalPages > 1 && (
                            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 6, marginTop: 16, flexWrap: "wrap" }}>
                                <button className="cm-page-btn" style={s.pageBtn} disabled={page === 1} onClick={() => setPage((p) => p - 1)}>‹</button>
                                {page > 3 && <><button className="cm-page-btn" style={s.pageBtn} onClick={() => setPage(1)}>1</button><span style={{ color: "#94a3b8" }}>…</span></>}
                                {pageRange().map((n) => (
                                    <button key={n} className={`cm-page-btn${n === page ? " active" : ""}`} style={n === page ? { ...s.pageBtn, ...s.pageBtnActive } : s.pageBtn} onClick={() => setPage(n)}>{n}</button>
                                ))}
                                {page < totalPages - 2 && <><span style={{ color: "#94a3b8" }}>…</span><button className="cm-page-btn" style={s.pageBtn} onClick={() => setPage(totalPages)}>{totalPages}</button></>}
                                <button className="cm-page-btn" style={s.pageBtn} disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>›</button>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* ── Edit Modal ── */}
            {showModal && (
                <div style={s.overlay} onClick={() => setShowModal(false)}>
                    <div style={s.modal} onClick={(e) => e.stopPropagation()}>
                        {/* Header */}
                        <div style={s.modalHdr}>
                            <span style={s.modalTitle}>Edit Customer</span>
                            <button style={s.modalClose} onClick={() => setShowModal(false)}>✕</button>
                        </div>

                        {/* Avatar row */}
                        <div style={s.modalAvatarRow}>
                            <div style={{ width: 48, height: 48, borderRadius: "50%", background: avatarColor(selectedCustomer?.name || ""), color: "#fff", fontSize: "1rem", fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                {initials(formData.name || selectedCustomer?.name)}
                            </div>
                            <div>
                                <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "#1e293b" }}>{selectedCustomer?.name}</div>
                                <div style={{ fontSize: "0.78rem", color: "#64748b" }}>ID · {selectedCustomer?._id?.slice(-6).toUpperCase()}</div>
                            </div>
                        </div>

                        <form onSubmit={handleUpdate}>
                            <div style={{ padding: "16px 20px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                                {[
                                    { label: "Full Name",       name: "name",             type: "text", span: 2, req: true },
                                    { label: "Contact Number",  name: "contact",          type: "tel",  req: true },
                                    { label: "WhatsApp Number", name: "alternateContact", type: "tel"  },
                                    { label: "Email Address",   name: "email",            type: "email", span: 2 },
                                ].map((f) => (
                                    <div key={f.name} style={{ gridColumn: f.span === 2 ? "span 2" : "span 1" }}>
                                        <label style={s.lbl}>
                                            {f.label}
                                            {!f.req && <span style={{ fontSize: "0.7rem", color: "#94a3b8", marginLeft: 4 }}>optional</span>}
                                        </label>
                                        <input
                                            className="cm-inp-field"
                                            style={{ ...s.inp, ...(formErrors[f.name] ? s.inpErr : {}) }}
                                            type={f.type}
                                            name={f.name}
                                            value={formData[f.name]}
                                            onChange={(e) => { setFormData({ ...formData, [e.target.name]: e.target.value }); setFormErrors({ ...formErrors, [f.name]: "" }); }}
                                            required={!!f.req}
                                            placeholder={f.label}
                                        />
                                        {formErrors[f.name] && <span style={s.errMsg}>{formErrors[f.name]}</span>}
                                    </div>
                                ))}
                            </div>
                            <div style={s.modalFooter}>
                                <button type="button" style={s.btnCancel} onClick={() => setShowModal(false)} disabled={modalLoading}>Cancel</button>
                                <button type="submit" className="cm-btn-save" style={s.btnSave} disabled={modalLoading}>
                                    {modalLoading ? "Saving…" : "Save Changes"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <style>{`
                @media (max-width: 620px) {
                    .cm-desk-view { display: none !important; }
                    .cm-mob-view  { display: block !important; }
                }
                @media (min-width: 621px) {
                    .cm-mob-view  { display: none !important; }
                    .cm-desk-view { display: block !important; }
                }
            `}</style>
        </div>
    );
}

export default CustomerManagement;
