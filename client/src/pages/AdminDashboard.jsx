import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import styles from "../styles/AdminDashboard.module.css";
import { getBookingsAPI } from "../services/operations/bookingAPI";
import {
  BsCalendar3,
  BsClipboardCheck,
  BsArrowRight,
} from "react-icons/bs";
import { FaShip } from "react-icons/fa";

function AdminDashboard({ user }) {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    today: 0,
    upcoming: 0,
    createdToday: 0,
    confirmed: 0,
    pending: 0,
    cancelled: 0,
    completed: 0,
    specialSlotsAvailable: 0,
  });

  // ---------------- HELPERS ----------------
  const isSameDay = (d1, d2, bookinStatus) =>
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate() && bookinStatus != "cancelled";

  // ---------------- FETCH DASHBOARD DATA ----------------
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const token = localStorage.getItem("authToken");
        const res = await getBookingsAPI(token, {}); // get all bookings
        const bookings = res?.data?.bookings || [];

        const today = new Date();
        const next7Days = new Date();
        next7Days.setDate(today.getDate() + 7);

        let todayCount = 0;
        let upcomingCount = 0;
        let createdToday = 0;
        let confirmed = 0;
        let pending = 0;
        let cancelled = 0;
        let completed = 0;

        bookings.forEach((b) => {
          const bookingDate = new Date(b.date);
          const createdAt = new Date(b.createdAt);

          const isCompleted = isBookingCompleted(b);

          // ✅ COMPLETED COUNT
          if (isCompleted && b.status !== "cancelled") {
            completed++;
            return;
          }
          // ❌ Ignore cancelled bookings for today/upcoming
          if (b.status === "cancelled") {
            cancelled++;
            return;
          }

          // ✅ TODAY (only active bookings)
          if (isSameDay(bookingDate, today)) {
            todayCount++;
          }

          // ✅ UPCOMING (next 7 days, future only)
          if (bookingDate > today && bookingDate <= next7Days) {
            upcomingCount++;
          }

          // ✅ CREATED TODAY
          if (isSameDay(createdAt, today)) {
            createdToday++;
          }

          // ✅ STATUS COUNTS
          if (b.status === "confirmed") confirmed++;
          if (b.status === "pending") pending++;
        });

        setStats({
          today: todayCount,
          upcoming: upcomingCount,
          createdToday,
          confirmed,
          pending,
          cancelled,
          completed,
          specialSlotsAvailable: 0, // 🔧 hook when yacht slots logic is ready
        });
      } catch (err) {
        console.error("Dashboard stats error", err);
      }
    };

    fetchDashboardData();
  }, []);

  const isBookingCompleted = (booking) => {
    if (!booking.date || !booking.endTime) return false;

    const bookingEnd = new Date(booking.date);
    const [h, m] = booking.endTime.split(":").map(Number);

    bookingEnd.setHours(h, m, 0, 0);
    return bookingEnd < new Date();
  };

  // ---------------- CARD COMPONENT ----------------
  const StatCard = ({ title, value, color, onClick }) => (
    // <div className="col-6 col-sm-6 col-md-4 col-lg-3 col-xl-2 p-2">
    // <div className="p-1" style={{ minWidth: "180px" }}>
    <div className="h-100">
      <div
        className={`card shadow-sm h-100 stat-card ${styles.statCard}`}
        style={{ cursor: onClick ? "pointer" : "default" }}
        onClick={onClick}
      >
        <div className="card-body d-flex flex-column text-center p-3">
          <h6 className={`text-muted mb-2 flex-grow-1 d-flex align-items-end ${styles.cardTitle}`}>
            {title}
          </h6>
          <h3 className={`fw-bold mb-0 ${styles[`color${color.charAt(0).toUpperCase() + color.slice(1)}`]}`}>
            {value}
          </h3>
        </div>
      </div>
    </div>
  );

  const getToday = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  return (
    <div className={styles.dashboardWrapper}>
      <div className={styles.content}>
        <div className="text-center mb-4">
          <h1 className={styles.title}>Admin Dashboard</h1>
          {/* <p className={styles.subTitle}>Manage your bookings efficiently</p> */}
        </div>

        {/* ---------------- BOOKING STATS ---------------- */}
        <div className="mb-4">
          <h5 className="mb-3 fw-semibold text-center text-primary">Booking Statistics</h5>
          {/* <div className={`row g-2 g-sm-3 ${styles.statsRow}`}> */}
          {/* <div className="d-flex flex-nowrap gap-2 overflow-auto mb-2"> */}
          <div className={styles.statsGrid}>
            <StatCard
              title="Today's Booking"
              value={stats.today}
              color="primary"
              onClick={() => navigate(`/bookings?date=${getToday()}`)}
            />
            <StatCard
              title="Booking in 7 Days"
              value={stats.upcoming}
              color="warning"
            />
            <StatCard
              title="Created Today"
              value={stats.createdToday}
              color="secondary"
            />
            <StatCard
              title="Pending Bookings"
              value={stats.pending}
              color="info"
              onClick={() => navigate("/bookings?status=pending")}
            />
            <StatCard
              title="Confirmed Bookings"
              value={stats.confirmed}
              color="success"
              onClick={() => navigate("/bookings?status=confirmed")}
            />
            <StatCard
              title="Completed Bookings"
              value={stats.completed}
              color="dark"
              onClick={() => navigate("/bookings?status=completed")}
            />
            <StatCard
              title="Cancelled"
              value={stats.cancelled}
              color="danger"
              onClick={() => navigate("/bookings?status=cancelled")}
            />
          </div>
        </div>

        {/* ---------------- MANAGEMENT CARDS ---------------- */}
        <div className="row g-3 g-md-4 mb-4">
          <div className="col-12 col-sm-6 col-lg-4">
            <div className={`${styles.mgmtCard} card border-primary h-100 shadow`}>
              <div className="card-body p-4">
                <div className="d-flex align-items-start mb-3">
                  <div
                    className={`${styles.icon} bg-primary text-white rounded-circle d-flex align-items-center justify-content-center me-3`}
                  >
                    <BsCalendar3 size={20} />
                  </div>
                  <div>
                    <h5 className="mb-1 fw-semibold">Check Availability</h5>
                    <p className="text-muted mb-0 small">
                      Check Availabilities of Yachts
                    </p>
                  </div>
                </div>
                <button
                  className={`${styles.cardBtn} btn btn-primary w-100 w-md-auto`}
                  onClick={() => navigate("/grid-availability")}
                >
                  Go <BsArrowRight className="ms-1" />
                </button>
              </div>
            </div>
          </div>

          <div className="col-12 col-sm-6 col-lg-4">
            <div className={`${styles.mgmtCard} card border-success h-100 shadow`}>
              <div className="card-body p-4">
                <div className="d-flex align-items-start mb-3">
                  <div
                    className={`${styles.icon} bg-success text-white rounded-circle d-flex align-items-center justify-content-center me-3`}
                  >
                    <BsClipboardCheck size={20} />
                  </div>
                  <div>
                    <h5 className="mb-1 fw-semibold">View Bookings</h5>
                    <p className="text-muted mb-0 small">
                      Manage all bookings efficiently
                    </p>
                  </div>
                </div>
                <button
                  className={`${styles.cardBtn} btn btn-success w-100 w-md-auto`}
                  onClick={() => navigate("/bookings")}
                >
                  Go <BsArrowRight className="ms-1" />
                </button>
              </div>
            </div>
          </div>

          <div className="col-12 col-sm-6 col-lg-4">
            <div className={`${styles.mgmtCard} card border-warning h-100 shadow`}>
              <div className="card-body p-4">
                <div className="d-flex align-items-start mb-3">
                  <div
                    className={`${styles.icon} bg-warning text-dark rounded-circle d-flex align-items-center justify-content-center me-3`}
                  >
                    <FaShip size={20} />
                  </div>
                  <div>
                    <h5 className="mb-1 fw-semibold">Yacht Management</h5>
                    <p className="text-muted mb-0 small">
                      Manage all yachts & pricing
                    </p>
                  </div>
                </div>
                <button
                  className={`${styles.cardBtn} btn btn-warning text-dark w-100 w-md-auto`}
                  onClick={() => navigate("/all-yachts")}
                >
                  Go <BsArrowRight className="ms-1" />
                </button>
              </div>
            </div>
          </div>
        </div>


        {/* ---------------- QUICK LINKS ---------------- */}
        <div className={styles.quickActions}>
          <h5 className="text-center mb-4 fw-semibold text-primary">Quick Actions</h5>
          <div className="d-grid d-md-flex gap-2 gap-md-3 justify-content-center flex-wrap">
            <button
              className="btn btn-outline-primary btn-lg px-4 py-2 flex-fill flex-md-grow-0"
              onClick={() => navigate("/create-customer")}
            >
              <i className="bi bi-person-plus me-2"></i>
              Create Customer
            </button>
            <button
              className="btn btn-outline-success btn-lg px-4 py-2 flex-fill flex-md-grow-0"
              onClick={() => navigate("/create-booking")}
            >
              <i className="bi bi-calendar-plus me-2"></i>
              Create Booking
            </button>
            <button
              className="btn btn-outline-warning btn-lg px-4 py-2 flex-fill flex-md-grow-0"
              onClick={() => navigate("/bookings?status=pending")}
            >
              <i className="bi bi-clock me-2"></i>
              Pending Approval
            </button>
            <button
              className="btn btn-outline-danger btn-lg px-4 py-2 flex-fill flex-md-grow-0"
              onClick={() => navigate("/bookings?status=cancelled")}
            >
              <i className="bi bi-x-circle me-2"></i>
              Cancelled Bookings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminDashboard;
