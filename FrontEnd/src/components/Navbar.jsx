import React, { useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import styles from "../styles/Navbar.module.css";

function Navbar({ user, onLogout }) {
  const collapseRef = useRef(null);
  const [showProfile, setShowProfile] = useState(false);
  const location = useLocation();

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

  const isActive = (path) => location.pathname === path;

  return (
    <>
      {/* NAVBAR */}
      <nav
        className="navbar navbar-expand-lg sticky-top"
        style={{
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

          <div
            className="collapse navbar-collapse"
            id="navbarNav"
            ref={collapseRef}
          >
            <ul className="navbar-nav me-auto mb-2 mb-lg-0">

              {/* Admin */}
              {user?.type === "admin" && (
                <li className="nav-item">
                  <Link
                    className={`nav-link text-white ${styles.navHover} ${isActive("/admin") ? styles.activeTab : ""}`}
                    to="/admin"
                    onClick={handleNavLinkClick}
                  >
                    Admin
                  </Link>
                </li>
              )}

              {/* Create Customer */}
              {(user?.type === "admin" || user?.type === "backdesk") && (
                <li className="nav-item">
                  <Link
                    className={`nav-link text-white ${styles.navHover} ${isActive("/create-customer") ? styles.activeTab : ""}`}
                    to="/create-customer"
                    onClick={handleNavLinkClick}
                  >
                    Create Customer
                  </Link>
                </li>
              )}

              {/* Employee Management */}
              {user?.type === "admin" && (
                <li className="nav-item">
                  <Link
                    className={`nav-link text-white ${styles.navHover} ${isActive("/all-employees") ? styles.activeTab : ""}`}
                    to="/all-employees"
                    onClick={handleNavLinkClick}
                  >
                    Employee Management
                  </Link>
                </li>
              )}

              {/* Bookings */}
              <li className="nav-item">
                <Link
                  className={`nav-link text-white ${styles.navHover} ${isActive("/bookings") ? styles.activeTab : ""}`}
                  to="/bookings"
                  onClick={handleNavLinkClick}
                >
                  Bookings
                </Link>
              </li>

              {/* Availability */}
              {(user?.type === "admin" || user?.type === "backdesk") && (
                <li className="nav-item">
                  <Link
                    className={`nav-link text-white ${styles.navHover} ${isActive("/availability") ? styles.activeTab : ""}`}
                    to="/availability"
                    onClick={handleNavLinkClick}
                  >
                    Availability
                  </Link>
                </li>
              )}

              {/* Yachts */}
              {user?.type === "admin" && (
                <li className="nav-item">
                  <Link
                    className={`nav-link text-white ${styles.navHover} ${isActive("/all-yachts") ? styles.activeTab : ""}`}
                    to="/all-yachts"
                    onClick={handleNavLinkClick}
                  >
                    Yacht Management
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

              {/* Logout */}
              <button
                className="btn btn-outline-light btn-sm px-3 fw-semibold"
                style={{ borderRadius: "50px" }}
                onClick={onLogout}
              >
                Logout
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
                <p className="text-muted mb-2">{user.type.toUpperCase()}</p>

                <hr />

                <p><strong>Username:</strong> {user.username}</p>
                <p><strong>Email:</strong> {user.email}</p>
                <p><strong>Contact:</strong> {user.contact}</p>
                <p><strong>Status:</strong> {user.status}</p>
              </div>

              <div className="modal-footer">
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
    </>
  );
}

export default Navbar;
