import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import styles from "../styles/AdminDashboard.module.css";
import { getBookingsAPI } from "../services/operations/bookingAPI";
import {
  BsCalendar3,
  BsClipboardCheck,
  BsArrowRight,
  BsPlusCircle,
  BsPersonPlus,
  BsBuilding,
  BsClock,
  BsXCircle,
  BsCalendarPlus,
} from "react-icons/bs";

function AdminDashboard({ user }) {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    today: 0,
    upcoming7Days: 0,
    month: 0,
    createdToday: 0,
    confirmed: 0,
    pending: 0,
    cancelled: 0,
    completed: 0,
  });
  const [loaded, setLoaded] = useState(false);

  // ---------------- HELPERS ----------------
  const isBookingCompleted = (booking) => {
    if (!booking.date || !booking.endTime) return false;
    const bookingEnd = new Date(booking.date);
    const [h, m] = booking.endTime.split(":").map(Number);
    bookingEnd.setHours(h, m, 0, 0);
    return bookingEnd < new Date();
  };

  // ---------------- FETCH ----------------
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const token = localStorage.getItem("authToken");
        const res = await getBookingsAPI(token, {});
        const bookings = res?.data?.bookings || [];

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const next7Days = new Date(today);
        next7Days.setDate(today.getDate() + 7);
        const currentMonth = today.getMonth();
        const currentYear = today.getFullYear();

        let todayCount = 0, upcoming7Days = 0, monthCount = 0;
        let createdToday = 0, confirmed = 0, pending = 0, cancelled = 0, completed = 0;

        bookings.forEach((b) => {
          const bookingDate = new Date(b.date);
          const createdAt = new Date(b.createdAt);

          if (b.status === "cancelled") { cancelled++; return; }

          if (
            bookingDate.getFullYear() === today.getFullYear() &&
            bookingDate.getMonth() === today.getMonth() &&
            bookingDate.getDate() === today.getDate()
          ) todayCount++;

          if (isBookingCompleted(b)) { completed++; return; }

          if (bookingDate > today && bookingDate <= next7Days) upcoming7Days++;

          if (bookingDate.getMonth() === currentMonth && bookingDate.getFullYear() === currentYear)
            monthCount++;

          if (
            createdAt.getFullYear() === today.getFullYear() &&
            createdAt.getMonth() === today.getMonth() &&
            createdAt.getDate() === today.getDate()
          ) createdToday++;

          if (b.status === "confirmed") confirmed++;
          if (b.status === "pending") pending++;
        });

        setStats({ today: todayCount, upcoming7Days, month: monthCount, createdToday, confirmed, pending, cancelled, completed });
        setLoaded(true);
      } catch (err) {
        console.error("Dashboard stats error", err);
        setLoaded(true);
      }
    };
    fetchDashboardData();
  }, []);

  const today = new Date().toISOString().split("T")[0];
  const currentMonth = new Date().toISOString().slice(0, 7);

  // ---------------- STAT CARD ----------------
  const StatCard = ({ title, value, accent, icon, onClick, delay = 0 }) => (
    <div
      className={`${styles.statCard} ${loaded ? styles.statCardVisible : ""}`}
      style={{ animationDelay: `${delay}ms`, cursor: onClick ? "pointer" : "default", borderTop: `3px solid ${accent}` }}
      onClick={onClick}
    >
      <div className={styles.statIcon} style={{ background: `${accent}18`, color: accent }}>
        {icon}
      </div>
      <div className={styles.statValue} style={{ color: accent }}>{loaded ? value : "—"}</div>
      <div className={styles.statLabel}>{title}</div>
    </div>
  );

  // ---------------- MGMT CARD ----------------
  const MgmtCard = ({ title, desc, btnLabel, btnClass, iconBg, icon, onClick, delay = 0 }) => (
    <div className={`col-12 col-sm-6 col-lg-4`}>
      <div
        className={`${styles.mgmtCard} ${loaded ? styles.mgmtCardVisible : ""}`}
        style={{ animationDelay: `${delay}ms` }}
      >
        <div className={styles.mgmtIconWrap} style={{ background: iconBg }}>
          {icon}
        </div>
        <div className={styles.mgmtText}>
          <h5>{title}</h5>
          <p>{desc}</p>
        </div>
        <button className={`btn ${btnClass} ${styles.mgmtBtn}`} onClick={onClick}>
          {btnLabel} <BsArrowRight className="ms-1" />
        </button>
      </div>
    </div>
  );

  return (
    <div className={styles.dashboardWrapper}>
      <div className={styles.content}>

        {/* ── HEADER ── */}
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Dashboard</h1>
            <p className={styles.subTitle}>
              {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </p>
          </div>
          <div className={styles.headerBadge}>
            <span>⚓</span>
          </div>
        </div>

        {/* ── STATS GRID ── */}
        <div className={styles.statsGrid}>
          <StatCard title="Today's Bookings"   value={stats.today}        accent="#3b82f6" delay={0}   icon={<svg width="18" height="18" fill="currentColor" viewBox="0 0 16 16"><path d="M3.5 0a.5.5 0 0 1 .5.5V1h8V.5a.5.5 0 0 1 1 0V1h1a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2h1V.5a.5.5 0 0 1 .5-.5zM1 4v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V4H1z"/></svg>} onClick={() => navigate(`/bookings?date=${today}`)} />
          <StatCard title="Next 7 Days"        value={stats.upcoming7Days} accent="#f59e0b" delay={60}  icon={<svg width="18" height="18" fill="currentColor" viewBox="0 0 16 16"><path d="M8 3.5a.5.5 0 0 0-1 0V9a.5.5 0 0 0 .252.434l3.5 2a.5.5 0 0 0 .496-.868L8 8.71V3.5z"/><path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm7-8A7 7 0 1 1 1 8a7 7 0 0 1 14 0z"/></svg>} onClick={() => navigate("/bookings?range=7days")} />
          <StatCard title="This Month"         value={stats.month}        accent="#8b5cf6" delay={120} icon={<svg width="18" height="18" fill="currentColor" viewBox="0 0 16 16"><path d="M11 6.5a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5v-1zm-3 0a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5v-1zm-5 3a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5v-1zm3 0a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5v-1z"/><path d="M3.5 0a.5.5 0 0 1 .5.5V1h8V.5a.5.5 0 0 1 1 0V1h1a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2h1V.5a.5.5 0 0 1 .5-.5zM1 4v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V4H1z"/></svg>} onClick={() => navigate(`/bookings?month=${currentMonth}`)} />
          <StatCard title="Created Today"      value={stats.createdToday} accent="#64748b" delay={180} icon={<svg width="18" height="18" fill="currentColor" viewBox="0 0 16 16"><path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/><path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z"/></svg>} onClick={() => navigate("/bookings?created=today")} />
          <StatCard title="Pending"            value={stats.pending}      accent="#0ea5e9" delay={240} icon={<svg width="18" height="18" fill="currentColor" viewBox="0 0 16 16"><path d="M8 3.5a.5.5 0 0 0-1 0V9a.5.5 0 0 0 .252.434l3.5 2a.5.5 0 0 0 .496-.868L8 8.71V3.5z"/><path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm7-8A7 7 0 1 1 1 8a7 7 0 0 1 14 0z"/></svg>} onClick={() => navigate("/bookings?status=pending")} />
          <StatCard title="Confirmed"          value={stats.confirmed}    accent="#10b981" delay={300} icon={<svg width="18" height="18" fill="currentColor" viewBox="0 0 16 16"><path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zm-3.97-3.03a.75.75 0 0 0-1.08.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-.01-1.05z"/></svg>} onClick={() => navigate("/bookings?status=confirmed")} />
          <StatCard title="Completed"          value={stats.completed}    accent="#1f2937" delay={360} icon={<svg width="18" height="18" fill="currentColor" viewBox="0 0 16 16"><path d="M2.5 8a5.5 5.5 0 0 1 8.25-4.764.5.5 0 0 0 .5-.866A6.5 6.5 0 1 0 14.5 8a.5.5 0 0 0-1 0 5.5 5.5 0 1 1-11 0z"/><path d="M15.354 3.354a.5.5 0 0 0-.708-.708L8 9.293 5.354 6.646a.5.5 0 1 0-.708.708l3 3a.5.5 0 0 0 .708 0l7-7z"/></svg>} onClick={() => navigate("/bookings?status=completed")} />
          <StatCard title="Cancelled"          value={stats.cancelled}    accent="#ef4444" delay={420} icon={<svg width="18" height="18" fill="currentColor" viewBox="0 0 16 16"><path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zM5.354 4.646a.5.5 0 1 0-.708.708L7.293 8l-2.647 2.646a.5.5 0 0 0 .708.708L8 8.707l2.646 2.647a.5.5 0 0 0 .708-.708L8.707 8l2.647-2.646a.5.5 0 0 0-.708-.708L8 7.293 5.354 4.646z"/></svg>} onClick={() => navigate("/bookings?status=cancelled")} />
        </div>

        {/* ── MANAGEMENT CARDS ── */}
        <div className={`row g-2 g-md-3 mb-4`}>
          <MgmtCard
            title="Create Booking" desc="New yacht booking" btnLabel="Go" btnClass="btn-primary"
            iconBg="linear-gradient(135deg,#3b82f6,#1d4ed8)"
            icon={<BsPlusCircle size={18} color="#fff" />}
            onClick={() => navigate("/create-booking")} delay={100}
          />
          <MgmtCard
            title="View Bookings" desc="Manage all bookings" btnLabel="Go" btnClass="btn-success"
            iconBg="linear-gradient(135deg,#10b981,#059669)"
            icon={<BsClipboardCheck size={18} color="#fff" />}
            onClick={() => navigate(`/bookings?month=${currentMonth}`)} delay={200}
          />
          <MgmtCard
            title="Check Availability" desc="Yacht availability by date" btnLabel="Go" btnClass="btn-warning text-dark"
            iconBg="linear-gradient(135deg,#f59e0b,#d97706)"
            icon={<BsCalendar3 size={18} color="#fff" />}
            onClick={() => navigate("/grid-availability")} delay={300}
          />
        </div>

        {/* ── QUICK ACTIONS ── */}
        <div className={styles.quickActions}>
          <h6 className={styles.quickTitle}>Quick Actions</h6>
          <div className={styles.quickGrid}>
            {user?.systemAdministrator && (
              <button className={`${styles.quickBtn} ${styles.quickBtnDark}`} onClick={() => navigate("/register-company")}>
                <BsBuilding size={14} className="me-2" /> Create Company
              </button>
            )}
            <button className={`${styles.quickBtn} ${styles.quickBtnPrimary}`} onClick={() => navigate("/create-customer")}>
              <BsPersonPlus size={14} className="me-2" /> Create Customer
            </button>
            <button className={`${styles.quickBtn} ${styles.quickBtnSuccess}`} onClick={() => navigate("/availability")}>
              <BsCalendarPlus size={14} className="me-2" /> Book Yacht
            </button>
            <button className={`${styles.quickBtn} ${styles.quickBtnWarning}`} onClick={() => navigate("/bookings?status=pending")}>
              <BsClock size={14} className="me-2" /> Pending Approval
            </button>
            <button className={`${styles.quickBtn} ${styles.quickBtnDanger}`} onClick={() => navigate("/bookings?status=cancelled")}>
              <BsXCircle size={14} className="me-2" /> Cancelled Bookings
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

export default AdminDashboard;