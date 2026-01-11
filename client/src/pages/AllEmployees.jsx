import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getAllEmployeesAPI,
  updateEmployeeStatusAPI,
  updateEmployeeProfileByAdminAPI,
  addEmployeeToCompanyAPI,
  getEmployeesNotInCompanyAPI,
} from "../services/operations/employeeAPI";
import { toast } from "react-hot-toast";
import "bootstrap/dist/css/bootstrap.min.css";

const AllEmployees = () => {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    contact: "",
    currentPassword: "",
    newPassword: "",
  });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [activeTab, setActiveTab] = useState("current");
  const [notInCompanyEmployees, setNotInCompanyEmployees] = useState([]);
  const [loadingNotInCompany, setLoadingNotInCompany] = useState(false);


  const navigate = useNavigate();
  const token = localStorage.getItem("authToken");
  const admin = JSON.parse(localStorage.getItem("user"));

  const fetchEmployees = async () => {
    try {
      const res = await getAllEmployeesAPI(token);
      if (res.data.success) {
        setEmployees(res.data.employees || []);
      } else {
        toast.error("Failed to load employees");
      }
    } catch {
      toast.error("Error fetching employees");
    } finally {
      setLoading(false);
    }
  };

  const toggleStatus = async (id, status) => {
    const newStatus = status === "active" ? "inactive" : "active";
    try {
      const res = await updateEmployeeStatusAPI(id, newStatus, token);
      if (res.data.success) {
        toast.success(`Employee set to ${newStatus}`);
        setEmployees((prev) =>
          prev.map((e) => (e._id === id ? { ...e, status: newStatus } : e))
        );
      }
    } catch {
      toast.error("Failed to update status");
    }
  };

  const openEditModal = (emp) => {
    setSelectedEmployee(emp);
    setEditForm({
      name: emp.name || "",
      email: emp.email || "",
      contact: emp.contact || "",
      currentPassword: "",
      newPassword: "",
      isPrivate: emp.isPrivate ?? false, // ✅ IMPORTANT
    });
    setErrors({});
    setShowEditModal(true);
  };


  const handleEmployeeUpdate = async () => {
    const newErrors = {};

    if (!editForm.name.trim()) newErrors.name = "Name is required";
    if (!editForm.email.trim()) newErrors.email = "Email is required";
    if (!editForm.contact.trim()) newErrors.contact = "Contact is required";
    if (!editForm.currentPassword) newErrors.adminPassword = "Admin password is required";

    if (editForm.newPassword && editForm.newPassword.length < 6) {
      newErrors.newPassword = "Password must be at least 6 characters";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      const payload = {
        name: editForm.name,
        email: editForm.email,
        contact: editForm.contact,
        adminPassword: editForm.currentPassword, // always required
        isPrivate: editForm.isPrivate
      };

      if (editForm.newPassword) {
        payload.newPassword = editForm.newPassword; // optional
      }

      console.log("by admin : ", payload)

      const res = await updateEmployeeProfileByAdminAPI(
        selectedEmployee._id,
        payload,
        token
      );

      const updatedEmployee = res.data.employee;

      setEmployees((prev) =>
        prev.map((emp) =>
          emp._id === updatedEmployee._id ? { ...emp, ...updatedEmployee } : emp
        )
      );

      toast.success("Employee updated successfully");
      setShowEditModal(false);
      setEditForm({ name: "", email: "", contact: "", currentPassword: "", newPassword: "", isPrivate: false });
    } catch {
      toast.error("Update failed");
    }
  };

  const fetchNotInCompanyEmployees = async () => {
    try {
      setLoadingNotInCompany(true);
      const res = await getEmployeesNotInCompanyAPI(token);
      if (res.data.success) {
        setNotInCompanyEmployees(res.data.employees || []);
      }
    } catch {
      toast.error("Failed to load available employees");
    } finally {
      setLoadingNotInCompany(false);
    }
  };

  const handleAddToCompany = async (employeeId) => {
    try {
      const companyId = admin?.company[0];
      await addEmployeeToCompanyAPI(employeeId, companyId, token);
      toast.success("Employee added to company");

      // Remove from not-in-company list
      setNotInCompanyEmployees((prev) =>
        prev.filter((emp) => emp._id !== employeeId)
      );

      // Refresh current employees
      fetchEmployees();
    } catch {
      toast.error("Failed to add employee");
    }
  };


  useEffect(() => {
    if (activeTab === "not-in-company" && notInCompanyEmployees.length === 0) {
      fetchNotInCompanyEmployees();
    }
  }, [activeTab]);


  useEffect(() => {
    fetchEmployees();
  }, []);

  if (loading) {
    return (
      <div className="container text-center mt-5">
        <div className="spinner-border text-primary"></div>
        <p className="mt-3">Loading employees...</p>
      </div>
    );
  }

  return (
    <>
      <div className="container my-4 px-2">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h4 className="fw-bold mb-0">Employees</h4>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => navigate("/create-employee")}
          >
            + Add
          </button>
        </div>

        <ul className="nav nav-tabs mb-3">
          <li className="nav-item">
            <button
              className={`nav-link ${activeTab === "current" ? "active" : ""}`}
              onClick={() => setActiveTab("current")}
            >
              Current
            </button>
          </li>
          <li className="nav-item">
            <button
              className={`nav-link ${activeTab === "not-in-company" ? "active" : ""}`}
              onClick={() => {
                setActiveTab("not-in-company");
              }}
            >
              Deactivated
            </button>
          </li>
        </ul>


        {activeTab === "current" && (
          <>
            {/* MOBILE VIEW */}
            <div className="d-md-none">
              {employees.map((emp) => (
                <div key={emp._id} className="card mb-3 shadow-sm border-0">
                  <div className="card-body">
                    <div className="d-flex justify-content-between align-items-start">
                      <div>
                        <h6 className="fw-bold mb-1">{emp.name}</h6>
                        <p className="text-muted mb-1 small">
                          {emp.type === "backdesk"
                            ? "Agent"
                            : emp.type === "onsite"
                              ? "Staff"
                              : emp.type.charAt(0).toUpperCase() +
                              emp.type.slice(1)}
                        </p>
                        <span
                          className={`badge ${emp.status === "active" ? "bg-success" : "bg-secondary"
                            }`}
                        >
                          {emp.status.toUpperCase()}
                        </span>
                      </div>

                      <div className="d-flex flex-column gap-2">
                        <button
                          className="btn btn-sm btn-outline-primary"
                          disabled={emp.type === "admin"}
                          onClick={() => openEditModal(emp)}
                        >
                          Update
                        </button>
                        <button
                          className={`btn btn-sm ${emp.status === "active"
                            ? "btn-outline-secondary"
                            : "btn-outline-success"
                            }`}
                          disabled={emp.type === "admin"}
                          onClick={() => toggleStatus(emp._id, emp.status)}
                        >
                          {emp.status === "active" ? "Deactivate" : "Activate"}
                        </button>
                      </div>
                    </div>

                    <hr className="my-2" />

                    <p className="small mb-1">
                      <strong>Username:</strong> {emp.username}
                    </p>
                    <p className="small mb-1">
                      <strong>Contact:</strong> {emp.contact || "-"}
                    </p>
                    <p className="small mb-0">
                      <strong>Email:</strong> {emp.email}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* DESKTOP & TABLET */}
            <div className="d-none d-md-block">
              <div className="table-responsive">
                <table className="table table-hover align-middle text-center">
                  <thead className="table-dark">
                    <tr>
                      <th>#</th>
                      <th>Name</th>
                      <th>Role</th>
                      <th>Username</th>
                      <th>Contact</th>
                      <th>Email</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map((emp, i) => (
                      <tr key={emp._id}>
                        <td>{i + 1}</td>
                        <td className="fw-semibold">{emp.name}</td>
                        <td>
                          {emp.type === "backdesk"
                            ? "Agent"
                            : emp.type === "onsite"
                              ? "Staff"
                              : emp.type.charAt(0).toUpperCase() +
                              emp.type.slice(1)}
                        </td>
                        <td>{emp.username}</td>
                        <td>{emp.contact || "-"}</td>
                        <td>{emp.email}</td>
                        <td>
                          <span
                            className={`badge ${emp.status === "active" ? "bg-success" : "bg-secondary"
                              }`}
                          >
                            {emp.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="d-flex gap-2 justify-content-center">
                          <button
                            className="btn btn-sm btn-outline-primary"
                            disabled={emp.type === "admin"}
                            onClick={() => openEditModal(emp)}
                          >
                            Update
                          </button>
                          <button
                            className={`btn btn-sm ${emp.status === "active"
                              ? "btn-outline-secondary"
                              : "btn-outline-success"
                              }`}
                            disabled={emp.type === "admin"}
                            onClick={() => toggleStatus(emp._id, emp.status)}
                          >
                            {emp.status === "active" ? "Deactivate" : "Activate"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {employees.length === 0 && (
              <div className="text-center text-muted mt-5">No employees found.</div>
            )}
          </>
        )}
        {/* OTHER AGENTS */}
        {activeTab === "not-in-company" && (
          <div className="table-responsive">
            {loadingNotInCompany ? (
              <p className="text-center">Loading...</p>
            ) : (
              <table className="table table-hover align-middle text-center">
                <thead className="table-dark">
                  <tr>
                    <th>#</th>
                    <th>Name</th>
                    <th>Role</th>
                    <th>Email</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {notInCompanyEmployees.length === 0 ? (
                    <tr>
                      <td colSpan="5">No employees available</td>
                    </tr>
                  ) : (
                    notInCompanyEmployees.map((emp, i) => (
                      <tr key={emp._id}>
                        <td>{i + 1}</td>
                        <td>{emp.name}</td>
                        <td>{emp.type}</td>
                        <td>{emp.email}</td>
                        <td>
                          <button
                            className="btn btn-sm btn-success"
                            onClick={() => handleAddToCompany(emp._id)}
                          >
                            Add to Company
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        )}

      </div>

      {/* EDIT EMPLOYEE MODAL */}
      {showEditModal && (
        <div
          className="modal fade show"
          style={{ display: "block", background: "rgba(0,0,0,0.6)" }}
          onClick={() => setShowEditModal(false)}
        >
          <div
            className="modal-dialog modal-dialog-centered"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-content">
              <div className="modal-header bg-warning">
                <h5 className="modal-title">Edit Employee</h5>
                <button
                  className="btn-close"
                  onClick={() => setShowEditModal(false)}
                ></button>
              </div>

              <div className="modal-body">
                {/* Name */}
                <input
                  className={`form-control mb-2 ${errors.name ? "is-invalid" : ""}`}
                  placeholder="Name"
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm({ ...editForm, name: e.target.value })
                  }
                />
                {errors.name && (
                  <div className="text-danger small mb-2">{errors.name}</div>
                )}

                {/* Email */}
                <input
                  className={`form-control mb-2 ${errors.email ? "is-invalid" : ""}`}
                  placeholder="Email"
                  value={editForm.email}
                  onChange={(e) =>
                    setEditForm({ ...editForm, email: e.target.value })
                  }
                />
                {errors.email && (
                  <div className="text-danger small mb-2">{errors.email}</div>
                )}

                {/* Contact */}
                <input
                  className={`form-control mb-3 ${errors.contact ? "is-invalid" : ""}`}
                  placeholder="Contact"
                  value={editForm.contact}
                  onChange={(e) =>
                    setEditForm({ ...editForm, contact: e.target.value })
                  }
                />
                {errors.contact && (
                  <div className="text-danger small mb-3">{errors.contact}</div>
                )}

                <div className="form-check form-switch mb-3">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="privateProfile"
                    checked={editForm.isPrivate}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        isPrivate: e.target.checked, // ✅ boolean
                      })
                    }
                  />
                  <label className="form-check-label" htmlFor="privateProfile">
                    {editForm.isPrivate ? "Private Profile" : "Public Profile"}
                  </label>
                </div>

                <hr />

                {/* Current Password */}
                <div className="input-group mb-2">
                  <input
                    type={showCurrentPassword ? "text" : "password"}
                    className={`form-control ${errors.adminPassword ? "is-invalid" : ""}`}
                    placeholder="Admin Password"
                    value={editForm.currentPassword}
                    onChange={(e) =>
                      setEditForm({ ...editForm, currentPassword: e.target.value })
                    }
                  />
                  <button
                    className="btn btn-outline-secondary"
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  >
                    {showCurrentPassword ? "Hide" : "Show"}
                  </button>
                </div>
                {errors.adminPassword && (
                  <div className="text-danger small mb-2">{errors.adminPassword}</div>
                )}

                {/* New Password */}
                <div className="input-group">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    className={`form-control ${errors.newPassword ? "is-invalid" : ""}`}
                    placeholder="New Employee Password (optional)"
                    value={editForm.newPassword}
                    onChange={(e) =>
                      setEditForm({ ...editForm, newPassword: e.target.value })
                    }
                  />
                  <button
                    className="btn btn-outline-secondary"
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                  >
                    {showNewPassword ? "Hide" : "Show"}
                  </button>
                </div>

              </div>

              <div className="modal-footer">
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowEditModal(false)}
                >
                  Cancel
                </button>
                <button className="btn btn-success" onClick={handleEmployeeUpdate}>
                  Update
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AllEmployees;
