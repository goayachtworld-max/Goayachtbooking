import React, { useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import styles from "../styles/Navbar.module.css";
import toast from "react-hot-toast";
import { updateEmployeeProfileAPI } from "../services/operations/employeeAPI";

function Navbar({ user, onLogout }) {
  const collapseRef = useRef(null);
  const [showProfile, setShowProfile] = useState(false);
  const location = useLocation();

  const token = localStorage.getItem("authToken");
  const [showEditProfile, setShowEditProfile] = useState(false);

  const [editForm, setEditForm] = useState({
    name: user?.name || "",
    email: user?.email || "",
    contact: user?.contact || "",
    currentPassword: "",
    newPassword: "",
  });

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [errors, setErrors] = useState({});


  // Collapse navbar on link click (for mobile)
  const handleNavLinkClick = () => {
    const collapseEl = collapseRef.current;
    if (collapseEl && collapseEl.classList.contains("show")) {
      const bsCollapse = new window.bootstrap.Collapse(collapseEl, {
        toggle: true,
      });
      bsCollapse.hide();
    }
  };

  // Helper: Get user initials
  const getInitials = (name) => {
    if (!name) return "";
    const parts = name.trim().split(" ");
    return parts.length > 1
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : parts[0][0].toUpperCase();
  };

  const handleProfileUpdate = async () => {
    console.log("inside call")
    try {
      const newErrors = {};

      if (!editForm.name.trim()) newErrors.name = "Name is required";
      if (!editForm.email.trim()) newErrors.email = "Email is required";
      if (!editForm.contact.trim()) newErrors.contact = "Contact is required";

      if (editForm.currentPassword && !editForm.newPassword) {
        newErrors.newPassword = "New password is required";
      }

      if (!editForm.currentPassword && editForm.newPassword) {
        newErrors.currentPassword = "Current password is required";
      }

      if (editForm.newPassword && editForm.newPassword.length < 6) {
        newErrors.newPassword = "Password must be at least 6 characters";
      }

      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        return;
      }

      setErrors({});

      const payload = {
        name: editForm.name,
        email: editForm.email,
        contact: editForm.contact,
      };

      if (editForm.currentPassword && editForm.newPassword) {
        payload.currentPassword = editForm.currentPassword;
        payload.newPassword = editForm.newPassword;
      }
      console.log("Inside call : ", payload)

      const response = await updateEmployeeProfileAPI(user._id, payload, token);

      const updatedEmployee = response.data.employee;

      // ✅ Update ONLY required fields in localStorage
      const storedUser = JSON.parse(localStorage.getItem("user"));

      localStorage.setItem(
        "user",
        JSON.stringify({
          ...storedUser,
          name: updatedEmployee.name,
          email: updatedEmployee.email,
          contact: updatedEmployee.contact,
        })
      );

      // ✅ Clear password fields from state
      setEditForm((prev) => ({
        ...prev,
        currentPassword: "",
        newPassword: "",
      }));
      toast.success("Profile updated successfully 🎉");
      setShowEditProfile(false);
      setShowProfile(false);
    } catch (err) {
      toast.error("Profile update failed ❌");
    }
  };

  const isActive = (path) => location.pathname === path;

  return (
    <>
      {/* NAVBAR */}
      <nav
        className="navbar navbar-expand-lg position-fixed w-100"
        style={{
          top: 0,
          left: 0,
          zIndex: 1030,
          background: "linear-gradient(90deg, #0d6efd, #0b5ed7)",
          boxShadow: "0 2px 5px rgba(0,0,0,0.25)",
        }}
      >
        <div className="container-fluid">
          {/* Brand */}
          <Link
            className="navbar-brand fw-bold text-white"
            style={{ letterSpacing: "0.5px", fontSize: "1.2rem" }}
            to="/"
          >
            Boating Assistance
          </Link>

          {/* Toggler */}
          <button
            className="navbar-toggler"
            type="button"
            data-bs-toggle="collapse"
            data-bs-target="#navbarNav"
          >
            <span className="navbar-toggler-icon"></span>
          </button>

          {/* Navbar links */}
          <div
            className="collapse navbar-collapse"
            id="navbarNav"
            ref={collapseRef}
          >
            <ul className="navbar-nav me-auto mb-2 mb-lg-0">
              {user?.type === "admin" && (
                <li className="nav-item">
                  <Link
                    className={`nav-link text-white ${styles.navHover} ${isActive("/admin") ? styles.activeTab : ""
                      }`}
                    to="/admin"
                    onClick={handleNavLinkClick}
                  >
                    Dashboard
                  </Link>
                </li>
              )}

              <li className="nav-item">
                <Link
                  className={`nav-link text-white ${styles.navHover} ${isActive("/bookings") ? styles.activeTab : ""
                    }`}
                  to="/bookings"
                  onClick={handleNavLinkClick}
                >
                  Bookings
                </Link>
              </li>

              {(user?.type === "admin" || user?.type === "backdesk") && (
                <li className="nav-item">
                  <Link
                    className={`nav-link text-white ${styles.navHover} ${isActive("/availability") ? styles.activeTab : ""
                      }`}
                    to="/availability"
                    onClick={handleNavLinkClick}
                  >
                    Availability
                  </Link>
                </li>
              )}

              {(user?.type === "admin" || user?.type === "backdesk") && (
                <li className="nav-item">
                  <Link
                    className={`nav-link text-white ${styles.navHover} ${isActive("/grid-availability") ? styles.activeTab : ""
                      }`}
                    to="/grid-availability"
                    onClick={handleNavLinkClick}
                  >
                    Calendar
                  </Link>
                </li>
              )}

              {user?.type === "admin" && (
                <li className="nav-item">
                  <Link
                    className={`nav-link text-white ${styles.navHover} ${isActive("/all-yachts") ? styles.activeTab : ""
                      }`}
                    to="/all-yachts"
                    onClick={handleNavLinkClick}
                  >
                    Yacht Master
                  </Link>
                </li>
              )}

              {(user?.type === "admin" || user?.type === "backdesk") && (
                <li className="nav-item">
                  <Link
                    className={`nav-link text-white ${styles.navHover} ${isActive("/create-customer") ? styles.activeTab : ""
                      }`}
                    to="/create-customer"
                    onClick={handleNavLinkClick}
                  >
                    Customer
                  </Link>
                </li>
              )}

              {user?.type === "admin" && (
                <li className="nav-item">
                  <Link
                    className={`nav-link text-white ${styles.navHover} ${isActive("/all-employees") ? styles.activeTab : ""
                      }`}
                    to="/all-employees"
                    onClick={handleNavLinkClick}
                  >
                    User Master
                  </Link>
                </li>
              )}
            </ul>

            {/* Profile + Logout */}
            <div className="d-flex align-items-center gap-2">
              {/* Profile Button */}
              <button
                className="btn bg-white rounded-circle text-primary fw-bold shadow-sm d-flex align-items-center justify-content-center"
                style={{ width: "42px", height: "42px", fontSize: "15px" }}
                onClick={() => setShowProfile(true)}
              >
                {getInitials(user?.name)}
              </button>

              {/* Logout Icon */}
              <button
                className="btn btn-outline-light d-flex align-items-center justify-content-center"
                style={{ width: "42px", height: "42px", borderRadius: "50%" }}
                onClick={onLogout}
                title="Logout"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  fill="currentColor"
                  viewBox="0 0 16 16"
                >
                  <path d="M6 2a1 1 0 0 1 1-1h3a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H7a1 1 0 0 1-1-1v-1h1v1h3a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1H7v1H6V2z" />
                  <path d="M.146 8.354a.5.5 0 0 1 0-.708l3-3a.5.5 0 1 1 .708.708L1.707 7.5H10.5a.5.5 0 0 1 0 1H1.707l2.147 2.146a.5.5 0 0 1-.708.708l-3-3z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* PROFILE MODAL */}
      {showProfile && (
        <div
          className="modal fade show"
          style={{
            display: "block",
            backgroundColor: "rgba(0,0,0,0.6)",
          }}
          onClick={() => setShowProfile(false)}
        >
          <div
            className="modal-dialog modal-dialog-centered"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-content shadow">
              <div className="modal-header bg-primary text-white">
                <h5 className="modal-title">My Profile</h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setShowProfile(false)}
                ></button>
              </div>

              <div className="modal-body text-center">
                <img
                  src={`https://ui-avatars.com/api/?name=${user.name}&background=random`}
                  alt="profile"
                  className="rounded-circle mb-3 shadow-sm"
                  width="100"
                  height="100"
                />

                <h5>{user.name}</h5>
                <p className="text-muted mb-2">
                  {user.type === "backdesk"
                        ? "Agent"
                        : user.type === "onsite"
                          ? "Staff"
                          : user.type.charAt(0).toUpperCase() +
                          user.type.slice(1)}
                </p>

                <hr />

                <p>
                  <strong>Username:</strong> {user.username}
                </p>
                <p>
                  <strong>Email:</strong> {user.email}
                </p>
                <p>
                  <strong>Contact:</strong> {user.contact}
                </p>
                <p>
                  <strong>Status:</strong> {user.status}
                </p>
              </div>

              <div className="modal-footer">
                <button
                  className="btn btn-outline-primary"
                  onClick={() => {
                    setShowProfile(false);
                    setShowEditProfile(true);
                  }}
                >
                  Edit Profile
                </button>

                <button
                  className="btn btn-secondary"
                  onClick={() => setShowProfile(false)}
                >
                  Close
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Update Profile Modal */}
      {/* Update Profile Modal */}
      {showEditProfile && (
        <div
          className="modal fade show"
          style={{
            display: "block",
            backgroundColor: "rgba(0,0,0,0.6)",
          }}
          onClick={() => setShowEditProfile(false)}
        >
          <div
            className="modal-dialog modal-dialog-centered"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-content shadow">
              <div className="modal-header bg-warning">
                <h5 className="modal-title">Edit Profile</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowEditProfile(false)}
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
                  className={`form-control mb-3 ${errors.contact ? "is-invalid" : ""
                    }`}
                  placeholder="Contact"
                  value={editForm.contact}
                  onChange={(e) =>
                    setEditForm({ ...editForm, contact: e.target.value })
                  }
                />
                {errors.contact && (
                  <div className="text-danger small mb-3">{errors.contact}</div>
                )}

                <hr />

                {/* Current Password */}
                <div className="input-group mb-2">
                  <input
                    type={showCurrentPassword ? "text" : "password"}
                    className={`form-control ${errors.currentPassword ? "is-invalid" : ""
                      }`}
                    placeholder="Current Password"
                    value={editForm.currentPassword}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        currentPassword: e.target.value,
                      })
                    }
                  />
                  <button
                    className="btn btn-outline-secondary"
                    type="button"
                    onClick={() =>
                      setShowCurrentPassword(!showCurrentPassword)
                    }
                  >
                    {showCurrentPassword ? "Hide" : "Show"}
                  </button>
                </div>
                {errors.currentPassword && (
                  <div className="text-danger small mb-2">
                    {errors.currentPassword}
                  </div>
                )}

                {/* New Password */}
                <div className="input-group">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    className={`form-control ${errors.newPassword ? "is-invalid" : ""
                      }`}
                    placeholder="New Password"
                    value={editForm.newPassword}
                    disabled={!editForm.currentPassword}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        newPassword: e.target.value,
                      })
                    }
                  />
                  <button
                    className="btn btn-outline-secondary"
                    type="button"
                    disabled={!editForm.currentPassword}
                    onClick={() => setShowNewPassword(!showNewPassword)}
                  >
                    {showNewPassword ? "Hide" : "Show"}
                  </button>
                </div>

                {/* {!editForm.currentPassword && (
                  <div className="text-muted small mt-1">
                    Enter current password to enable new password
                  </div>
                )} */}

                {errors.newPassword && (
                  <div className="text-danger small mt-1">
                    {errors.newPassword}
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowEditProfile(false)}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-success"
                  onClick={handleProfileUpdate}
                >
                  Update
                </button>
              </div>
            </div>
          </div>
        </div>
      )}


    </>
  );
}

export default Navbar;
