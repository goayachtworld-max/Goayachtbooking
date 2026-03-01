import React, { useEffect, useState } from "react";
import {
    getCustomersAPI,
    updateCustomerAPI,
    searchCustomersByNameAPI,
} from "../services/operations/customerAPI";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { GLOBAL_CSS } from "../styles/customerStyles"

const initials = (name = "") =>
    name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "?";

function CustomerManagement() {
    const token = localStorage.getItem("authToken");
    const navigate = useNavigate();

    const [customers, setCustomers] = useState([]);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [showModal, setShowModal] = useState(false);
    const [modalLoading, setModalLoading] = useState(false);
    const [selectedCustomerId, setSelectedCustomerId] = useState(null);
    const [formData, setFormData] = useState({ name: "", contact: "", email: "", alternateContact: "" });

    useEffect(() => {
        const t = setTimeout(() => { setDebouncedSearch(searchTerm); setPage(1); }, 500);
        return () => clearTimeout(t);
    }, [searchTerm]);

    const fetchCustomers = async () => {
        try {
            setLoading(true);
            const q = debouncedSearch.trim();
            if (q.length >= 2) {
                const r = await searchCustomersByNameAPI(q, token);
                setCustomers(r.data.customers || []); setTotalPages(1);
            } else if (q.length === 0) {
                const r = await getCustomersAPI(page, 10, token);
                setCustomers(r.data.customers || []); setTotalPages(r.data.totalPages || 1);
            } else {
                setCustomers([]); setTotalPages(1);
            }
        } catch { toast.error("Failed to fetch customers"); }
        finally { setLoading(false); }
    };
    useEffect(() => { fetchCustomers(); }, [page, debouncedSearch]);

    const openEdit = (c) => {
        setSelectedCustomerId(c._id);
        setFormData({ name: c.name || "", contact: c.contact || "", email: c.email || "", alternateContact: c.alternateContact || "" });
        setShowModal(true);
    };

    const handleUpdate = async (e) => {
        e.preventDefault();
        try {
            setModalLoading(true);
            await updateCustomerAPI(selectedCustomerId, formData, token);
            toast.success("Customer updated");
            setShowModal(false); fetchCustomers();
        } catch { toast.error("Update failed"); }
        finally { setModalLoading(false); }
    };

    const pageRange = () => {
        const left = Math.max(1, page - 2);
        const right = Math.min(totalPages, page + 2);
        return Array.from({ length: right - left + 1 }, (_, i) => left + i);
    };

    return (
        <div className="cm-wrap">
            <style>{GLOBAL_CSS}</style>
            <div className="cm-page">

                {/* Header */}
                <div className="cm-header">
                    <div>
                        <div className="cm-subtitle">Directory</div>
                        <div className="cm-title">Customer Management</div>
                    </div>
                    <div className="cm-hdr-btns">
                        <button className="cm-btn cm-btn-primary" onClick={() => navigate("/create-customer")}>
                            + New Customer
                        </button>
                        <button className="cm-btn cm-btn-outline" onClick={() => navigate(-1)}>
                            ← Back
                        </button>
                    </div>
                </div>

                {/* Search */}
                <div className="cm-search-wrap" style={{ marginBottom: 16 }}>
                    <span className="cm-search-ico">🔍</span>
                    <input className="cm-search" placeholder="Search customers by name…" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>

                {/* Body */}
                {loading ? (
                    <div style={{ display: "flex", justifyContent: "center", padding: "48px 0" }}>
                        <div className="cm-spinner" />
                    </div>
                ) : customers.length === 0 ? (
                    <div className="cm-card">
                        <div className="cm-empty">
                            <div className="cm-empty-icon">👤</div>
                            <div className="cm-empty-text">No customers found</div>
                            <div className="cm-empty-sub">{debouncedSearch ? "Try a different search term" : "Add your first customer to get started"}</div>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Desktop Table */}
                        <div className="cm-card cm-desk">
                            <table className="cm-table">
                                <thead>
                                    <tr>
                                        <th>Customer</th>
                                        <th>Contact</th>
                                        <th>Email</th>
                                        <th style={{ width: 110 }}>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {customers.map((c) => (
                                        <tr key={c._id} className="cm-tr">
                                            <td>
                                                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                                    <div className="cm-avatar" style={{ width: 34, height: 34, fontSize: 13 }}>{initials(c.name)}</div>
                                                    <span style={{ fontWeight: 800, color: "#0f172a" }}>{c.name}</span>
                                                </div>
                                            </td>
                                            <td>{c.contact}</td>
                                            <td style={{ color: "#64748b" }}>{c.email || <span style={{ color: "#cbd5e1" }}>—</span>}</td>
                                            <td>
                                                <button className="cm-btn cm-btn-primary cm-btn-sm" onClick={() => openEdit(c)}>✏ Edit</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile Cards */}
                        <div className="cm-card cm-mob" style={{ overflow: "hidden" }}>
                            {customers.map((c) => (
                                <div key={c._id} className="cm-cust-row">
                                    <div className="cm-avatar">{initials(c.name)}</div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: 15, fontWeight: 900, color: "#0f172a", marginBottom: 2 }}>{c.name}</div>
                                        <div style={{ fontSize: 13, color: "#475569", fontWeight: 600 }}>{c.contact}</div>
                                        {c.email && <div style={{ fontSize: 12, color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.email}</div>}
                                    </div>
                                    <button className="cm-btn cm-btn-primary cm-btn-sm" style={{ flexShrink: 0 }} onClick={() => openEdit(c)}>Edit</button>
                                </div>
                            ))}
                        </div>

                        {/* Pagination */}
                        {!debouncedSearch && totalPages > 1 && (
                            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 6, marginTop: 14, flexWrap: "wrap" }}>
                                <button className="cm-page-btn" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>‹</button>
                                {page > 3 && <><button className="cm-page-btn" onClick={() => setPage(1)}>1</button><span style={{ color: "#94a3b8" }}>…</span></>}
                                {pageRange().map((n) => (
                                    <button key={n} className={`cm-page-btn${n === page ? " active" : ""}`} onClick={() => setPage(n)}>{n}</button>
                                ))}
                                {page < totalPages - 2 && <><span style={{ color: "#94a3b8" }}>…</span><button className="cm-page-btn" onClick={() => setPage(totalPages)}>{totalPages}</button></>}
                                <button className="cm-page-btn" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>›</button>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Edit Modal */}
            {showModal && (
                <div className="cm-overlay" onClick={() => setShowModal(false)}>
                    <div className="cm-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="cm-modal-hdr">
                            <div className="cm-modal-title">✏️ Edit Customer</div>
                            <button className="cm-modal-close" onClick={() => setShowModal(false)}>✕</button>
                        </div>
                        <form onSubmit={handleUpdate}>
                            <div className="cm-modal-body">
                                <div className="cm-grid2">
                                    {[
                                        { label: "Full Name", name: "name", type: "text", req: true },
                                        { label: "Contact Number", name: "contact", type: "tel", req: true },
                                        { label: "Email", name: "email", type: "email" },
                                        { label: "WhatsApp Number", name: "alternateContact", type: "tel" },
                                    ].map((f) => (
                                        <div className="cm-field" key={f.name}>
                                            <label className="cm-lbl">{f.label}{!f.req && <span className="cm-lbl-opt">optional</span>}</label>
                                            <input className="cm-inp" type={f.type} name={f.name} value={formData[f.name]}
                                                onChange={(e) => setFormData({ ...formData, [e.target.name]: e.target.value })}
                                                required={!!f.req} placeholder={f.label} />
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="cm-modal-footer">
                                <button type="button" className="cm-btn cm-btn-outline" onClick={() => setShowModal(false)} disabled={modalLoading}>Cancel</button>
                                <button type="submit" className="cm-btn cm-btn-primary" disabled={modalLoading}>{modalLoading ? "Saving…" : "Save Changes"}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default CustomerManagement;