import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import styles from "../styles/AdminDashboard.module.css";
import { getBookingsAPI } from "../services/operations/bookingAPI";

function AdminDashboard({ user }) {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    today: 0,
    upcoming: 0,
    createdToday: 0,
    confirmed: 0,
    pending: 0,
    cancelled: 0,
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

        bookings.forEach((b) => {
          const bookingDate = new Date(b.date);
          const createdAt = new Date(b.createdAt);
          const bookinStatus = b.status;
          if (isSameDay(bookingDate, today, bookinStatus)) todayCount++;

          if (
            bookingDate > today &&
            bookingDate <= next7Days
          )
            upcomingCount++;

          if (isSameDay(createdAt, today)) createdToday++;

          if (b.status === "confirmed") confirmed++;
          if (b.status === "pending") pending++;
          if (b.status === "cancelled") cancelled++;
        });

        setStats({
          today: todayCount,
          upcoming: upcomingCount,
          createdToday,
          confirmed,
          pending,
          cancelled,
          specialSlotsAvailable: 0, // 🔧 hook when yacht slots logic is ready
        });
      } catch (err) {
        console.error("Dashboard stats error", err);
      }
    };

    fetchDashboardData();
  }, []);

  // ---------------- CARD COMPONENT ----------------
  const StatCard = ({ title, value, color, onClick }) => (
    <div className="col-12 col-sm-6 col-lg-3">
      <div
        className={`card shadow-sm border-${color} h-100`}
        style={{ cursor: onClick ? "pointer" : "default" }}
        onClick={onClick}
      >
        <div className="card-body text-center">
          <h6 className="text-muted">{title}</h6>
          <h2 className={`fw-bold text-${color}`}>{value}</h2>
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
        <h2 className={styles.title}>Admin Dashboard</h2>

        <p className={styles.subTitle}>
          {/* Welcome */}
        </p>

        {/* ---------------- BOOKING STATS ---------------- */}
        <div className="row g-3 mb-4">
          <StatCard
            title="Today's Bookings"
            value={stats.today}
            color="primary"
            onClick={() => navigate(`/bookings?date=${getToday()}`)}
          />

          <StatCard
            title="Pending Bookings"
            value={stats.pending}
            color="info"
            onClick={() => navigate("/bookings?status=pending")}
          />

          <StatCard
            title="Cancelled Bookings"
            value={stats.cancelled}
            color="danger"
            onClick={() => navigate("/bookings?status=cancelled")}
          />

          <StatCard
            title="Upcoming (Next 7 Days)"
            value={stats.upcoming}
            color="info"
          />

          <StatCard
            title="Created Today"
            value={stats.createdToday}
            color="secondary"
          />

          <StatCard
            title="Confirmed Bookings"
            value={stats.confirmed}
            color="success"
            onClick={() => navigate("/bookings?status=confirmed")}
          />



          {/* <StatCard
            title="Special Slots Available"
            value={stats.specialSlotsAvailable}
            color="dark"
          /> */}
        </div>

        {/* ---------------- MANAGEMENT CARDS ---------------- */}
        <div className="row g-4">
          <div className="col-12 col-md-4">
            <div className={`${styles.card} border-primary`}>
              <div className={styles.cardBody}>
                <h5>Create Employee</h5>
                <p>Add backdesk or onsite employees</p>
                <button
                  className={`${styles.cardBtn} btn-primary`}
                  onClick={() => navigate("/create-employee")}
                >
                  Go
                </button>
              </div>
            </div>
          </div>

          <div className="col-12 col-md-4">
            <div className={`${styles.card} border-success`}>
              <div className={styles.cardBody}>
                <h5>View Bookings</h5>
                <p>Manage all bookings efficiently</p>
                <button
                  className={`${styles.cardBtn} btn-success`}
                  onClick={() => navigate("/bookings")}
                >
                  Go
                </button>
              </div>
            </div>
          </div>

          <div className="col-12 col-md-4">
            <div className={`${styles.card} border-warning`}>
              <div className={styles.cardBody}>
                <h5>Yacht Management</h5>
                <p>Manage all yachts & pricing</p>
                <button
                  className={`${styles.cardBtn} btn-warning text-dark`}
                  onClick={() => navigate("/all-yachts")}
                >
                  Go
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ---------------- QUICK LINKS ---------------- */}
        <div className={styles.quickActions}>
          <h5>Quick Links</h5>
          <div className="d-flex flex-wrap justify-content-center gap-3 mt-3">
            <button
              className="btn btn-outline-primary"
              onClick={() => navigate("/create-customer")}
            >
              Create Customer
            </button>

            <button
              className="btn btn-outline-success"
              onClick={() => navigate("/create-booking")}
            >
              Create Booking
            </button>

            <button
              className="btn btn-outline-warning"
              onClick={() => navigate("/bookings?status=pending")}
            >
              Pending Approval
            </button>

            <button
              className="btn btn-outline-danger"
              onClick={() => navigate("/bookings?status=cancelled")}
            >
              Cancelled Bookings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminDashboard;
