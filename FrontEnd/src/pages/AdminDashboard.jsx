// src/pages/AdminDashboard.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import styles from "../styles/AdminDashboard.module.css"; // custom CSS

function AdminDashboard({ user }) {
  const navigate = useNavigate();

  const handleNavigate = (path) => {
    navigate(path);
  };

  return (
    <div className={styles.dashboardWrapper}>
      <div className={styles.content}>
        <h2 className={styles.title}>Admin Dashboard</h2>
        <p className={styles.subTitle}>
          Welcome, <span className="fw-bold">{user?.role}</span>! Manage employees, bookings, and yachts here.
        </p>

        <div className="row g-4">
          {/* Create Employee */}
          <div className="col-12 col-md-4">
            <div className={`${styles.card} border-primary`}>
              <div className={styles.cardBody}>
                <h5>Create Employee</h5>
                <p>Add backdesk or onsite Employees</p>
                <button
                  className={`${styles.cardBtn} btn-primary`}
                  onClick={() => handleNavigate("/create-employee")}
                >
                  Go
                </button>
              </div>
            </div>
          </div>

          {/* View Bookings */}
          <div className="col-12 col-md-4">
            <div className={`${styles.card} border-success`}>
              <div className={styles.cardBody}>
                <h5>View Bookings</h5>
                <p>Check all current bookings and manage efficiently.</p>
                <button
                  className={`${styles.cardBtn} btn-success`}
                  onClick={() => handleNavigate("/bookings")}
                >
                  Go
                </button>
              </div>
            </div>
          </div>

          {/* Yacht Management */}
          <div className="col-12 col-md-4">
            <div className={`${styles.card} border-warning`}>
              <div className={styles.cardBody}>
                <h5>Yacht Management</h5>
                <p>Monitor and manage all your yachts in one place.</p>
                <button
                  className={`${styles.cardBtn} btn-warning text-dark`}
                  onClick={() => handleNavigate("/all-yachts")}
                >
                  Go
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className={styles.quickActions}>
          <h5>Quick Actions</h5>
          <div className="d-flex flex-wrap justify-content-center gap-3 mt-3">
            <button
              className="btn btn-outline-primary"
              onClick={() => handleNavigate("/create-customer")}
            >
              Create Customer
            </button>
            <button
              className="btn btn-outline-success"
              onClick={() => handleNavigate("/create-booking")}
            >
              Create Booking
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminDashboard;
