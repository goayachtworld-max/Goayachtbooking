import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
  getAllEmployeesAPI,
  updateEmployeeStatusAPI,
  updateEmployeeProfileByAdminAPI,
  addEmployeeToCompanyAPI,
  getEmployeesNotInCompanyAPI,
} from "../services/operations/employeeAPI";
import { toast } from "react-hot-toast";
import "./AllEmployees.css";

// ── helpers ─────────────────────────────────────────────────────────
const getRoleName = (type) => {
  if (type === "backdesk") return "Agent";
  if (type === "onsite")   return "Staff";
  if (type === "admin")    return "Admin";
  return type ? type.charAt(0).toUpperCase() + type.slice(1) : "—";
};

const getRoleClass = (type) => {
  if (type === "admin")    return "emp-role-admin";
  if (type === "backdesk") return "emp-role-agent";
  if (type === "onsite")   return "emp-role-staff";
  return "emp-role-default";
};

const getInitials = (name = "") => {
  const parts = name.trim().split(" ");
  return parts.length > 1
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : (parts[0]?.[0] || "?").toUpperCase();
};

const getLoginBadge = (lastLoginAt, lastSeenAt) => {
  if (!lastLoginAt) return { cls: "emp-badge-never", text: "Never", tooltip: "" };

  const loginDate = new Date(lastLoginAt);
  const now       = new Date();

  const isToday =
    loginDate.getDate()     === now.getDate()     &&
    loginDate.getMonth()    === now.getMonth()    &&
    loginDate.getFullYear() === now.getFullYear();

  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    loginDate.getDate()     === yesterday.getDate()     &&
    loginDate.getMonth()    === yesterday.getMonth()    &&
    loginDate.getFullYear() === yesterday.getFullYear();

  const tooltip = `Last Login: ${loginDate.toLocaleString()}${
    lastSeenAt ? `\nLast Seen: ${new Date(lastSeenAt).toLocaleString()}` : ""
  }`;

  if (isToday)     return { cls: "emp-badge-today",     text: "Today",     tooltip };
  if (isYesterday) return { cls: "emp-badge-yesterday", text: "Yesterday",  tooltip };
  return {
    cls:  "emp-badge-older",
    text: loginDate.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
    tooltip,
  };
};

// ── main component ───────────────────────────────────────────────────
const AllEmployees = () => {
  const navigate = useNavigate();
  const token    = localStorage.getItem("authToken");
  const admin    = JSON.parse(localStorage.getItem("user") || "{}");

  const [employees,             setEmployees]             = useState([]);
  const [notInCompanyEmployees, setNotInCompanyEmployees] = useState([]);
  const [loading,               setLoading]               = useState(true);
  const [loadingNotInCompany,   setLoadingNotInCompany]   = useState(false);
  const [activeTab,             setActiveTab]             = useState("current");

  // Edit modal
  const [showEditModal,       setShowEditModal]       = useState(false);
  const [selectedEmployee,    setSelectedEmployee]    = useState(null);
  const [editForm,            setEditForm]            = useState({
    name: "", email: "", contact: "",
    currentPassword: "", newPassword: "", isPrivate: false,
  });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword,     setShowNewPassword]     = useState(false);
  const [errors,              setErrors]              = useState({});

  // ── fetch ──────────────────────────────────────────────────────────
  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const res = await getAllEmployeesAPI(token);
      if (res.data.success) setEmployees(res.data.employees || []);
      else toast.error("Failed to load employees");
    } catch {
      toast.error("Error fetching employees");
    } finally {
      setLoading(false);
    }
  };

  const fetchNotInCompanyEmployees = async () => {
    setLoadingNotInCompany(true);
    try {
      const res = await getEmployeesNotInCompanyAPI(token);
      if (res.data.success) setNotInCompanyEmployees(res.data.employees || []);
    } catch {
      toast.error("Failed to load available employees");
    } finally {
      setLoadingNotInCompany(false);
    }
  };

  useEffect(() => {
    if (activeTab === "current")        { setLoading(true); fetchEmployees(); }
    if (activeTab === "not-in-company") fetchNotInCompanyEmployees();
  }, [activeTab]);

  useEffect(() => { fetchEmployees(); }, []);

  // ── actions ────────────────────────────────────────────────────────
  const toggleStatus = async (id, status) => {
    const newStatus = status === "active" ? "inactive" : "active";
    try {
      const res = await updateEmployeeStatusAPI(id, newStatus, token);
      if (res.data.success) {
        toast.success(`Employee set to ${newStatus}`);
        setEmployees((prev) => prev.map((e) => e._id === id ? { ...e, status: newStatus } : e));
      }
    } catch {
      toast.error("Failed to update status");
    }
  };

  const openEditModal = (emp) => {
    setSelectedEmployee(emp);
    setEditForm({
      name: emp.name || "", email: emp.email || "", contact: emp.contact || "",
      currentPassword: "", newPassword: "", isPrivate: emp.isPrivate ?? false,
    });
    setErrors({});
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowEditModal(true);
  };

  const handleEmployeeUpdate = async () => {
    const newErrors = {};
    if (!editForm.name.trim())     newErrors.name          = "Name is required";
    if (!editForm.email.trim())    newErrors.email         = "Email is required";
    if (!editForm.contact.trim())  newErrors.contact       = "Contact is required";
    if (!editForm.currentPassword) newErrors.adminPassword = "Admin password is required";
    if (editForm.newPassword && editForm.newPassword.length < 6)
      newErrors.newPassword = "Password must be at least 6 characters";

    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }

    try {
      const payload = {
        name: editForm.name, email: editForm.email, contact: editForm.contact,
        adminPassword: editForm.currentPassword, isPrivate: editForm.isPrivate,
      };
      if (editForm.newPassword) payload.newPassword = editForm.newPassword;

      const res            = await updateEmployeeProfileByAdminAPI(selectedEmployee._id, payload, token);
      const updatedEmployee = res.data.employee;

      setEmployees((prev) =>
        prev.map((emp) => emp._id === updatedEmployee._id ? { ...emp, ...updatedEmployee } : emp)
      );
      toast.success("Employee updated successfully");
      setShowEditModal(false);
      setEditForm({ name: "", email: "", contact: "", currentPassword: "", newPassword: "", isPrivate: false });
    } catch {
      toast.error("Update failed");
    }
  };

  const handleAddToCompany = async (employeeId) => {
    try {
      const companyId = admin?.company?.[0];
      await addEmployeeToCompanyAPI(employeeId, companyId, token);
      toast.success("Employee added to company");
      setNotInCompanyEmployees((prev) => prev.filter((e) => e._id !== employeeId));
      fetchEmployees();
    } catch {
      toast.error("Failed to add employee");
    }
  };

  const [search, setSearch] = useState("");

  const activeEmployees = employees
    .filter((e) => e.status === "active")
    .filter((e) => !search.trim() || e.name?.toLowerCase().includes(search.toLowerCase()) || e.email?.toLowerCase().includes(search.toLowerCase()));

  const filteredNotInCompany = notInCompanyEmployees
    .filter((e) => !search.trim() || e.name?.toLowerCase().includes(search.toLowerCase()) || e.email?.toLowerCase().includes(search.toLowerCase()));

  // ── loading ────────────────────────────────────────────────────────
  if (loading) return (
    <div className="emp-page">
      <div className="emp-spinner-wrap">
        <div className="emp-spinner" />
        <span>Loading employees…</span>
      </div>
    </div>
  );

  // ── edit / deactivate icon buttons ────────────────────────────────
  const IconEdit = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="currentColor" viewBox="0 0 16 16">
      <path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325z"/>
    </svg>
  );
  const IconLock = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="currentColor" viewBox="0 0 16 16">
      <path d="M8 1a2 2 0 0 1 2 2v4H6V3a2 2 0 0 1 2-2zm3 6V3a3 3 0 0 0-6 0v4a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/>
    </svg>
  );
  const IconCheck = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="currentColor" viewBox="0 0 16 16">
      <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/>
    </svg>
  );

  // ── render ─────────────────────────────────────────────────────────
  return (
    <div className="emp-page">

      {/* page header — back | search | add */}
      <div className="emp-page-header" style={{ justifyContent: "space-between", marginBottom: "1rem" }}>
        <button className="btn-back-icon" onClick={() => navigate(-1)} aria-label="Go back">
          <svg viewBox="0 0 20 20" fill="none"><path d="M12.5 5L7.5 10L12.5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <input
          className="emp-search-input"
          type="text"
          placeholder="Search employee…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button className="emp-btn-add" onClick={() => navigate("/create-employee")} title="Add Employee">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M9 3V15M3 9H15" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      {/* tabs */}
      <div className="emp-tabs">
        <button
          className={`emp-tab ${activeTab === "current" ? "active" : ""}`}
          onClick={() => setActiveTab("current")}
        >
          Current Employees
          <span className="emp-tab-count">{activeEmployees.length}</span>
        </button>
        <button
          className={`emp-tab ${activeTab === "not-in-company" ? "active" : ""}`}
          onClick={() => setActiveTab("not-in-company")}
        >
          Deactivated
        </button>
      </div>

      {/* ════════════ CURRENT EMPLOYEES ════════════ */}
      {activeTab === "current" && (
        activeEmployees.length > 0 ? (
          <>
            {/* Desktop table */}
            <div className="emp-table-card d-none d-md-block">
              <div className="emp-table-wrap">
                <table className="emp-table">
                  <thead>
                    <tr>
                      <th className="emp-hide-xs">#</th>
                      <th>Name</th>
                      <th className="emp-hide-sm">Role</th>
                      <th className="emp-hide-xs">Last Login</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeEmployees.map((emp, i) => {
                      const login = getLoginBadge(emp.lastLoginAt, emp.lastSeenAt);
                      return (
                        <tr key={emp._id}>
                          <td className="emp-hide-xs" style={{ color: "#7a8799", fontSize: 12 }}>{i + 1}</td>
                          <td>
                            <div className="emp-avatar-cell">
                              <div className="emp-avatar">
                                {emp.profilePhoto
                                  ? <img src={emp.profilePhoto} alt={emp.name} style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
                                  : getInitials(emp.name)
                                }
                              </div>
                              <div>
                                <div className="emp-name">{emp.name} <span style={{ color: "#94a3b8", fontWeight: 400 }}>({emp.username})</span></div>
                              </div>
                            </div>
                          </td>
                          <td className="emp-hide-sm">
                            <span className={`emp-role-badge ${getRoleClass(emp.type)}`}>
                              {getRoleName(emp.type)}
                            </span>
                          </td>
                          <td className="emp-hide-xs">
                            <span className={`emp-badge ${login.cls}`} title={login.tooltip} style={{ cursor: "default" }}>
                              {login.text}
                            </span>
                          </td>
                          <td>
                            <div className="emp-action-btns">
                              <button
                                className="emp-btn-icon edit"
                                title="Edit employee"
                                disabled={emp.type === "admin"}
                                onClick={() => openEditModal(emp)}
                              >
                                <IconEdit />
                              </button>
                              <button
                                className={`emp-btn-icon ${emp.status === "active" ? "deactivate" : "activate"}`}
                                title={emp.status === "active" ? "Deactivate" : "Activate"}
                                disabled={emp.type === "admin"}
                                onClick={() => toggleStatus(emp._id, emp.status)}
                              >
                                {emp.status === "active" ? <IconLock /> : <IconCheck />}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile cards */}
            <div className="d-md-none">
              {activeEmployees.map((emp) => {
                const login = getLoginBadge(emp.lastLoginAt, emp.lastSeenAt);
                return (
                  <div key={emp._id} className="emp-mobile-card">
                    <div className="emp-mobile-card-header">
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div className="emp-avatar" style={{ width: 38, height: 38, fontSize: 13 }}>
                          {emp.profilePhoto
                            ? <img src={emp.profilePhoto} alt={emp.name} style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
                            : getInitials(emp.name)
                          }
                        </div>
                        <div>
                          <p className="emp-mobile-card-name">{emp.name}</p>
                          <p className="emp-mobile-card-meta">
                            <span className={`emp-role-badge ${getRoleClass(emp.type)}`} style={{ marginRight: 5 }}>{getRoleName(emp.type)}</span>
                            <span className={`emp-badge ${login.cls}`} title={login.tooltip}>{login.text}</span>
                          </p>
                        </div>
                      </div>
                      <div className="emp-mobile-card-actions">
                        <button
                          className="emp-btn-icon edit"
                          disabled={emp.type === "admin"}
                          onClick={() => openEditModal(emp)}
                          title="Edit"
                        ><IconEdit /></button>
                        <button
                          className={`emp-btn-icon ${emp.status === "active" ? "deactivate" : "activate"}`}
                          disabled={emp.type === "admin"}
                          onClick={() => toggleStatus(emp._id, emp.status)}
                          title={emp.status === "active" ? "Deactivate" : "Activate"}
                        >
                          {emp.status === "active" ? <IconLock /> : <IconCheck />}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="emp-table-card">
            <div className="emp-empty">
              <div className="emp-empty-icon">👥</div>
              <p>No active employees found.</p>
            </div>
          </div>
        )
      )}

      {/* ════════════ DEACTIVATED ════════════ */}
      {activeTab === "not-in-company" && (
        loadingNotInCompany ? (
          <div className="emp-spinner-wrap"><div className="emp-spinner" /><span>Loading…</span></div>
        ) : filteredNotInCompany.length > 0 ? (
          <>
            {/* Desktop */}
            <div className="emp-table-card d-none d-md-block">
              <div className="emp-table-wrap">
                <table className="emp-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Name</th>
                      <th>Role</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredNotInCompany.map((emp, i) => (
                      <tr key={emp._id}>
                        <td style={{ color: "#7a8799", fontSize: 12 }}>{i + 1}</td>
                        <td>
                          <div className="emp-avatar-cell">
                            <div className="emp-avatar">{getInitials(emp.name)}</div>
                            <span className="emp-name">{emp.name}</span>
                          </div>
                        </td>
                        <td><span className={`emp-role-badge ${getRoleClass(emp.type)}`}>{getRoleName(emp.type)}</span></td>
                        <td>
                          <button className="emp-btn-success-sm" onClick={() => handleAddToCompany(emp._id)}>
                            Add to Company
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile */}
            <div className="d-md-none">
              {filteredNotInCompany.map((emp) => (
                <div key={emp._id} className="emp-mobile-card">
                  <div className="emp-mobile-card-header">
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div className="emp-avatar">{getInitials(emp.name)}</div>
                      <div>
                        <p className="emp-mobile-card-name">{emp.name}</p>
                        <p className="emp-mobile-card-meta">
                          <span className={`emp-role-badge ${getRoleClass(emp.type)}`}>{getRoleName(emp.type)}</span>
                        </p>
                      </div>
                    </div>
                    <button className="emp-btn-success-sm" onClick={() => handleAddToCompany(emp._id)}>Add</button>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="emp-table-card">
            <div className="emp-empty">
              <div className="emp-empty-icon">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#1d6fa4" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                  <polyline points="16 11 18 13 22 9"/>
                </svg>
              </div>
              <p>No deactivated employees.</p>
            </div>
          </div>
        )
      )}

      {/* ════════════ EDIT MODAL ════════════ */}
      {showEditModal && createPortal(
        <>
          <div className="emp-modal-backdrop" onClick={() => setShowEditModal(false)} />
          <div className="emp-modal">
            <div className="emp-modal-dialog">

              <div className="emp-modal-header">
                <h2 className="emp-modal-title">Edit Employee</h2>
                <button className="emp-modal-close" onClick={() => setShowEditModal(false)}>✕</button>
              </div>

              <div className="emp-modal-body">

                <div className="emp-field">
                  <label className="emp-field-label">Name <span className="emp-field-required">*</span></label>
                  <input
                    className={`emp-input${errors.name ? " error" : ""}`}
                    placeholder="Full name"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  />
                  {errors.name && <span className="emp-field-error">{errors.name}</span>}
                </div>

                <div className="emp-field">
                  <label className="emp-field-label">Email <span className="emp-field-required">*</span></label>
                  <input
                    className={`emp-input${errors.email ? " error" : ""}`}
                    placeholder="Email address"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  />
                  {errors.email && <span className="emp-field-error">{errors.email}</span>}
                </div>

                <div className="emp-field">
                  <label className="emp-field-label">Contact <span className="emp-field-required">*</span></label>
                  <input
                    className={`emp-input${errors.contact ? " error" : ""}`}
                    placeholder="Phone number"
                    value={editForm.contact}
                    onChange={(e) => setEditForm({ ...editForm, contact: e.target.value })}
                  />
                  {errors.contact && <span className="emp-field-error">{errors.contact}</span>}
                </div>

                <div className="emp-toggle-row">
                  <button
                    type="button"
                    className="emp-toggle-track"
                    style={{ background: editForm.isPrivate ? "#7a8799" : "#1d6fa4" }}
                    onClick={() => setEditForm({ ...editForm, isPrivate: !editForm.isPrivate })}
                  >
                    <span className="emp-toggle-thumb" style={{ left: editForm.isPrivate ? 20 : 3 }} />
                  </button>
                  <span className="emp-toggle-label">
                    {editForm.isPrivate ? "Private Profile" : "Public Profile"}
                  </span>
                </div>

                <div className="emp-divider" />
                <div className="emp-section-label">Authentication</div>

                <div className="emp-field">
                  <label className="emp-field-label">Admin Password <span className="emp-field-required">*</span></label>
                  <div className="emp-pw-wrap">
                    <input
                      type={showCurrentPassword ? "text" : "password"}
                      className={`emp-input${errors.adminPassword ? " error" : ""}`}
                      placeholder="Your password to authorise"
                      value={editForm.currentPassword}
                      onChange={(e) => setEditForm({ ...editForm, currentPassword: e.target.value })}
                    />
                    <button type="button" className="emp-pw-toggle" onClick={() => setShowCurrentPassword(!showCurrentPassword)}>
                      {showCurrentPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                  {errors.adminPassword && <span className="emp-field-error">{errors.adminPassword}</span>}
                </div>

                <div className="emp-field">
                  <label className="emp-field-label">
                    New Employee Password&nbsp;
                    <span style={{ fontSize: 10, fontWeight: 400, textTransform: "none", letterSpacing: 0, color: "#aab0bb" }}>(optional)</span>
                  </label>
                  <div className="emp-pw-wrap">
                    <input
                      type={showNewPassword ? "text" : "password"}
                      className={`emp-input${errors.newPassword ? " error" : ""}`}
                      placeholder="Leave blank to keep current"
                      value={editForm.newPassword}
                      onChange={(e) => setEditForm({ ...editForm, newPassword: e.target.value })}
                    />
                    <button type="button" className="emp-pw-toggle" onClick={() => setShowNewPassword(!showNewPassword)}>
                      {showNewPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                  {errors.newPassword && <span className="emp-field-error">{errors.newPassword}</span>}
                </div>

              </div>

              <div className="emp-modal-footer">
                <button className="emp-btn-secondary" onClick={() => setShowEditModal(false)}>Cancel</button>
                <button className="emp-btn-primary"   onClick={handleEmployeeUpdate}>Save Changes</button>
              </div>

            </div>
          </div>
        </>
      , document.body)}

    </div>
  );
};

export default AllEmployees;