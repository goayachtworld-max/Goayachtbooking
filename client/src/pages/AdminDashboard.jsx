import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import styles from "../styles/AdminDashboard.module.css";
import { getBookingsAPI } from "../services/operations/bookingAPI";

/* ── Icons (inline SVG keeps it dependency-light) ── */
const Icon = {
  Calendar: () => (
    <svg width="15" height="15" fill="currentColor" viewBox="0 0 16 16">
      <path d="M3.5 0a.5.5 0 0 1 .5.5V1h8V.5a.5.5 0 0 1 1 0V1h1a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2h1V.5a.5.5 0 0 1 .5-.5zM1 4v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V4H1z" />
    </svg>
  ),
  Clock: () => (
    <svg width="15" height="15" fill="currentColor" viewBox="0 0 16 16">
      <path d="M8 3.5a.5.5 0 0 0-1 0V9a.5.5 0 0 0 .252.434l3.5 2a.5.5 0 0 0 .496-.868L8 8.71V3.5z" />
      <path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm7-8A7 7 0 1 1 1 8a7 7 0 0 1 14 0z" />
    </svg>
  ),
  Month: () => (
    <svg width="15" height="15" fill="currentColor" viewBox="0 0 16 16">
      <path d="M11 6.5a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5v-1zm-3 0a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5v-1zm-5 3a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5v-1zm3 0a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5v-1z" />
      <path d="M3.5 0a.5.5 0 0 1 .5.5V1h8V.5a.5.5 0 0 1 1 0V1h1a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2h1V.5a.5.5 0 0 1 .5-.5zM1 4v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V4H1z" />
    </svg>
  ),
  Plus: () => (
    <svg width="15" height="15" fill="currentColor" viewBox="0 0 16 16">
      <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z" />
      <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z" />
    </svg>
  ),
  Check: () => (
    <svg width="15" height="15" fill="currentColor" viewBox="0 0 16 16">
      <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zm-3.97-3.03a.75.75 0 0 0-1.08.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-.01-1.05z" />
    </svg>
  ),
  Done: () => (
    <svg width="15" height="15" fill="currentColor" viewBox="0 0 16 16">
      <path d="M2.5 8a5.5 5.5 0 0 1 8.25-4.764.5.5 0 0 0 .5-.866A6.5 6.5 0 1 0 14.5 8a.5.5 0 0 0-1 0 5.5 5.5 0 1 1-11 0z" />
      <path d="M15.354 3.354a.5.5 0 0 0-.708-.708L8 9.293 5.354 6.646a.5.5 0 1 0-.708.708l3 3a.5.5 0 0 0 .708 0l7-7z" />
    </svg>
  ),
  X: () => (
    <svg width="15" height="15" fill="currentColor" viewBox="0 0 16 16">
      <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zM5.354 4.646a.5.5 0 1 0-.708.708L7.293 8l-2.647 2.646a.5.5 0 0 0 .708.708L8 8.707l2.646 2.647a.5.5 0 0 0 .708-.708L8.707 8l2.647-2.646a.5.5 0 0 0-.708-.708L8 7.293 5.354 4.646z" />
    </svg>
  ),
  Clipboard: () => (
    <svg width="15" height="15" fill="currentColor" viewBox="0 0 16 16">
      <path d="M10 1.5a.5.5 0 0 0-.5-.5h-3a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 .5.5h3a.5.5 0 0 0 .5-.5v-1zm-5 0A1.5 1.5 0 0 1 6.5 0h3A1.5 1.5 0 0 1 11 1.5v1A1.5 1.5 0 0 1 9.5 4h-3A1.5 1.5 0 0 1 5 2.5v-1zm-2 0h1v1A2.5 2.5 0 0 0 6.5 5h3A2.5 2.5 0 0 0 12 2.5v-1h1a2 2 0 0 1 2 2V14a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V3.5a2 2 0 0 1 2-2z" />
    </svg>
  ),
  Grid: () => (
    <svg width="15" height="15" fill="currentColor" viewBox="0 0 16 16">
      <path d="M1 2.5A1.5 1.5 0 0 1 2.5 1h3A1.5 1.5 0 0 1 7 2.5v3A1.5 1.5 0 0 1 5.5 7h-3A1.5 1.5 0 0 1 1 5.5v-3zM2.5 2a.5.5 0 0 0-.5.5v3a.5.5 0 0 0 .5.5h3a.5.5 0 0 0 .5-.5v-3a.5.5 0 0 0-.5-.5h-3zm6.5.5A1.5 1.5 0 0 1 10.5 1h3A1.5 1.5 0 0 1 15 2.5v3A1.5 1.5 0 0 1 13.5 7h-3A1.5 1.5 0 0 1 9 5.5v-3zm1.5-.5a.5.5 0 0 0-.5.5v3a.5.5 0 0 0 .5.5h3a.5.5 0 0 0 .5-.5v-3a.5.5 0 0 0-.5-.5h-3zM1 10.5A1.5 1.5 0 0 1 2.5 9h3A1.5 1.5 0 0 1 7 10.5v3A1.5 1.5 0 0 1 5.5 15h-3A1.5 1.5 0 0 1 1 13.5v-3zm1.5-.5a.5.5 0 0 0-.5.5v3a.5.5 0 0 0 .5.5h3a.5.5 0 0 0 .5-.5v-3a.5.5 0 0 0-.5-.5h-3zm6.5.5A1.5 1.5 0 0 1 10.5 9h3a1.5 1.5 0 0 1 1.5 1.5v3a1.5 1.5 0 0 1-1.5 1.5h-3A1.5 1.5 0 0 1 9 13.5v-3zm1.5-.5a.5.5 0 0 0-.5.5v3a.5.5 0 0 0 .5.5h3a.5.5 0 0 0 .5-.5v-3a.5.5 0 0 0-.5-.5h-3z" />
    </svg>
  ),
  Person: () => (
    <svg width="15" height="15" fill="currentColor" viewBox="0 0 16 16">
      <path d="M12.5 1a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h5zm-5-1a2 2 0 0 0-2 2v1a2 2 0 0 0 2 2h5a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2h-5zM8 6a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v8a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a1 1 0 0 1 1-1h3a1 1 0 0 0 0-2H2a3 3 0 0 0-3 3v7a4 4 0 0 0 4 4h10a4 4 0 0 0 4-4V6a3 3 0 0 0-3-3H9a3 3 0 0 0-3 3z" />
    </svg>
  ),
  Building: () => (
    <svg width="15" height="15" fill="currentColor" viewBox="0 0 16 16">
      <path d="M4 2.5a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5v-1zm3 0a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5v-1zm3.5-.5a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5h-1zM4 5.5a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5v-1zM7.5 5a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5h-1zm2.5.5a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5v-1zM4.5 8a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5h-1zm2.5.5a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5v-1zm3.5-.5a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5h-1z" />
      <path d="M2 1a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V1zm11 0H3v14h3v-2.5a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 .5.5V15h3V1z" />
    </svg>
  ),
  Yacht: () => (
    <svg width="15" height="15" fill="currentColor" viewBox="0 0 16 16">
      <path d="M2.52 3.515A2.5 2.5 0 0 1 4.82 2h6.362c1 0 1.904.596 2.298 1.515l.792 1.848c.075.175.21.319.38.404.5.25.855.715.965 1.262l.335 1.679c.033.161.049.325.049.49v.413c0 1.164-.47 2.215-1.23 2.977h.7a.5.5 0 0 1 0 1H3a.5.5 0 0 1 0-1h.73c-.488-.573-.805-1.273-.88-2.044l-.054-.592a.301.301 0 0 1-.048-.17V8.198c0-.165.016-.33.049-.49l.335-1.68a1.5 1.5 0 0 1 .965-1.261.5.5 0 0 0 .38-.404l.792-1.848z" />
    </svg>
  ),
  Arrow: () => (
    <svg width="12" height="12" fill="currentColor" viewBox="0 0 16 16">
      <path fillRule="evenodd" d="M1 8a.5.5 0 0 1 .5-.5h11.793l-3.147-3.146a.5.5 0 0 1 .708-.708l4 4a.5.5 0 0 1 0 .708l-4 4a.5.5 0 0 1-.708-.708L13.293 8.5H1.5A.5.5 0 0 1 1 8z" />
    </svg>
  ),
  ChevRight: () => (
    <svg width="13" height="13" fill="currentColor" viewBox="0 0 16 16">
      <path fillRule="evenodd" d="M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708z" />
    </svg>
  ),
};

// ── Shared IST helper: converts any UTC timestamp string to "YYYY-MM-DD" in IST ──
// Uses the browser's Intl engine via toLocaleString — avoids the
// getTimezoneOffset() double-correction bug that was in the original code.
const toISTDateStr = (utcStr) => {
  const d = new Date(new Date(utcStr).toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export default function AdminDashboard({ user }) {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    today: 0, upcoming7Days: 0, month: 0, createdToday: 0,
    confirmed: 0, pending: 0, cancelled: 0, completed: 0,
  });
  const [loaded, setLoaded] = useState(false);

  // Returns current time as a plain Date whose numeric value equals IST wall-clock time.
  const getNowIST = () => {
    return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  };

  // Returns "YYYY-MM-DD" string in IST for today
  const getTodayIST = () => {
    const now = getNowIST();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  // A booking is "completed" when its end time has already passed (in IST)
  const isBookingCompleted = (b) => {
    if (!b.date || !b.endTime) return false;
    const bookingDateIST = b.date.split("T")[0];
    const bookingEnd = new Date(`${bookingDateIST}T${b.endTime}:00+05:30`);
    return bookingEnd < getNowIST();
  };

  useEffect(() => {
    (async () => {
      try {
        const token = localStorage.getItem("authToken");
        const res = await getBookingsAPI(token, {});
        const bookings = res?.data?.bookings || [];

        const todayIST         = getTodayIST();                            // "YYYY-MM-DD"
        const nowIST           = getNowIST();
        const todayMidnightIST = new Date(`${todayIST}T00:00:00+05:30`);
        const next7IST         = new Date(todayMidnightIST);
        next7IST.setDate(next7IST.getDate() + 7);
        const cm = nowIST.getMonth();
        const cy = nowIST.getFullYear();

        let todayCount = 0, upcoming7Days = 0, monthCount = 0, createdToday = 0,
            confirmed  = 0, pending = 0, cancelled = 0, completed = 0;

        bookings.forEach((b) => {
          const bookingDate    = b.date.split("T")[0];                     // "YYYY-MM-DD"
          const bookingDateObj = new Date(`${bookingDate}T00:00:00+05:30`);

          // FIX A: use Intl-based helper — avoids getTimezoneOffset() double-correction
          const caISTStr = toISTDateStr(b.createdAt);

          // ── Cancelled: count and skip everything else ──
          if (b.status === "cancelled") { cancelled++; return; }

          const alreadyCompleted = isBookingCompleted(b);

          // Completed count: non-cancelled bookings whose end time has passed
          if (alreadyCompleted) { completed++; }

          // Today: ALL non-cancelled bookings whose trip date is today
          // (includes completed ones — so clicking Today shows the same bookings)
          if (bookingDate === todayIST) todayCount++;

          // Next 7 days: strictly after today midnight up to +7 days
          // Excludes completed so the list matches what Bookings shows for active future trips
          if (!alreadyCompleted && bookingDateObj > todayMidnightIST && bookingDateObj <= next7IST) upcoming7Days++;

          // This month: active bookings in the current calendar month (excludes completed)
          if (!alreadyCompleted && bookingDateObj.getMonth() === cm && bookingDateObj.getFullYear() === cy) monthCount++;

          // New today: ALL bookings created today in IST — regardless of completion
          // so clicking "New Today" always shows the same bookings the stat counted
          if (caISTStr === todayIST) createdToday++;

          // Status counts (active only — completed and cancelled excluded)
          if (!alreadyCompleted && b.status === "confirmed") confirmed++;
          if (!alreadyCompleted && b.status === "pending")   pending++;
        });

        setStats({ today: todayCount, upcoming7Days, month: monthCount, createdToday, confirmed, pending, cancelled, completed });
      } catch (e) { console.error(e); }
      finally { setLoaded(true); }
    })();
  }, []);

  // Use IST for nav URLs so ?date= and ?month= params match IST-based Bookings filters
  const todayStr = getTodayIST();
  const monthStr = getTodayIST().slice(0, 7);

  /* ── Data ── */
  const STATS = [
    { label: "Today",       value: stats.today,         accent: "#3b82f6", nav: `/bookings?date=${todayStr}` },
    { label: "Next 7 Days", value: stats.upcoming7Days, accent: "#f59e0b", nav: "/bookings?range=7days" },
    { label: "This Month",  value: stats.month,         accent: "#8b5cf6", nav: `/bookings?month=${monthStr}` },
    { label: "New Today",   value: stats.createdToday,  accent: "#06b6d4", nav: "/bookings?created=today" },
    { label: "Pending",     value: stats.pending,       accent: "#f97316", nav: "/bookings?status=pending" },
    { label: "Confirmed",   value: stats.confirmed,     accent: "#10b981", nav: "/bookings?status=confirmed" },
    { label: "Completed",   value: stats.completed,     accent: "#6366f1", nav: "/bookings?status=completed" },
    { label: "Cancelled",   value: stats.cancelled,     accent: "#ef4444", nav: "/bookings?status=cancelled" },
  ];

  const MGMT = [
    {
      label: "Create Booking", desc: "Add a new yacht reservation",
      iconBg: "#dbeafe", iconColor: "#1d4ed8", icon: <Icon.Clipboard />,
      linkColor: "#1d4ed8", nav: "/create-booking",
    },
    {
      label: "All Bookings", desc: "Browse and manage reservations",
      iconBg: "#dcfce7", iconColor: "#15803d", icon: <Icon.Grid />,
      linkColor: "#15803d", nav: `/bookings?month=${monthStr}`,
    },
    {
      label: "Availability", desc: "Yacht overview",
      iconBg: "#fef3c7", iconColor: "#b45309", icon: <Icon.Yacht />,
      linkColor: "#b45309", nav: "/availability",
    },
  ];

  const ACTIONS = [
    ...(user?.systemAdministrator ? [{
      label: "Create Company", iconBg: "#e0e7ff", iconColor: "#4338ca", icon: <Icon.Building />, nav: "/register-company",
    }] : []),
    { label: "New Customer", iconBg: "#fce7f3", iconColor: "#be185d", icon: <Icon.Person />,  nav: "/create-customer" },
    { label: "Book Yacht",   iconBg: "#d1fae5", iconColor: "#065f46", icon: <Icon.Yacht />,   nav: "/availability" },
  ];

  return (
    <div className={styles.dashboardWrapper}>

      {/* ── Slim Top Bar ── */}
      <div className={styles.topBar}>
        <div className={styles.topBarInner}>
          <div>
            <p className={styles.topBarEyebrow}>Admin Portal</p>
            <h1 className={styles.topBarTitle}>{user?.companyName || "Dashboard"}</h1>
          </div>
          <p className={styles.topBarDate}>
            {new Date().toLocaleDateString("en-US", {
              weekday: "short", month: "short", day: "numeric",
            })}
          </p>
        </div>
      </div>

      {/* ── Content ── */}
      <div className={styles.contentArea}>

        {/* Stats */}
        <div className={styles.sectionHeader}>
          <p className={styles.sectionTitle}>Overview</p>
          <div className={styles.sectionLine} />
        </div>

        <div className={styles.statsGrid}>
          {STATS.map((s, i) => (
            <div
              key={s.label}
              className={`${styles.statCard} ${loaded ? styles.statCardVisible : ""}`}
              style={{ "--card-accent": s.accent, transitionDelay: `${i * 45}ms` }}
              onClick={() => navigate(s.nav)}
            >
              <span className={styles.statValue}>{loaded ? s.value : "—"}</span>
              <span className={styles.statLabel}>{s.label}</span>
            </div>
          ))}
        </div>

        {/* Bottom row */}
        <div className={styles.sectionHeader} style={{ marginTop: "0.25rem" }}>
          <p className={styles.sectionTitle}>Management</p>
          <div className={styles.sectionLine} />
        </div>

        <div className={styles.bottomRow}>

          {/* Mgmt cards */}
          <div className={styles.mgmtGrid}>
            {MGMT.map((m, i) => (
              <div
                key={m.label}
                className={`${styles.mgmtCard} ${loaded ? styles.mgmtCardVisible : ""}`}
                style={{ transitionDelay: `${360 + i * 70}ms` }}
                onClick={() => navigate(m.nav)}
              >
                <div className={styles.mgmtIconWrap} style={{ background: m.iconBg, color: m.iconColor }}>
                  {m.icon}
                </div>
                <div className={styles.mgmtCardBody}>
                  <h5>{m.label}</h5>
                  <p>{m.desc}</p>
                </div>
                <div className={styles.mgmtCardFooter}>
                  <a
                    className={styles.mgmtLink}
                    style={{ color: m.linkColor }}
                    onClick={(e) => { e.stopPropagation(); navigate(m.nav); }}
                  >
                    Open <Icon.Arrow />
                  </a>
                </div>
              </div>
            ))}
          </div>

          {/* Quick actions */}
          <div className={`${styles.actionsPanel} ${loaded ? styles.actionsPanelVisible : ""}`}>
            <p className={styles.actionsPanelTitle}>Quick Actions</p>
            <div className={styles.actionsList}>
              {ACTIONS.map((a) => (
                <button
                  key={a.label}
                  className={styles.actionItem}
                  onClick={() => navigate(a.nav)}
                >
                  <div className={styles.actionItemIcon} style={{ background: a.iconBg, color: a.iconColor }}>
                    {a.icon}
                  </div>
                  <span className={styles.actionItemText}>{a.label}</span>
                  <span className={styles.actionItemArrow}><Icon.ChevRight /></span>
                </button>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}