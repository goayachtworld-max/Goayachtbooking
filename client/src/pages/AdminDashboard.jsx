import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import styles from "../styles/AdminDashboard.module.css";
import { getBookingsAPI } from "../services/operations/bookingAPI";

/* ── Cache helpers ── */
const DB_CACHE_TTL = 90 * 1000;
const dbCacheKey  = (uid) => `db_stats_${uid || "anon"}`;
const dbGetCached = (uid) => {
  try {
    const raw = localStorage.getItem(dbCacheKey(uid));
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    if (Date.now() - ts > DB_CACHE_TTL) { localStorage.removeItem(dbCacheKey(uid)); return null; }
    return data;
  } catch { return null; }
};
const dbSetCache = (uid, data) => {
  try { localStorage.setItem(dbCacheKey(uid), JSON.stringify({ ts: Date.now(), data })); } catch {}
};

/* ── Inline SVG icons ── */
const Ico = {
  Calendar: () => (
    <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
      <path d="M3.5 0a.5.5 0 0 1 .5.5V1h8V.5a.5.5 0 0 1 1 0V1h1a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2h1V.5a.5.5 0 0 1 .5-.5zM1 4v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V4H1z"/>
    </svg>
  ),
  Clock7: () => (
    <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
      <path d="M8 3.5a.5.5 0 0 0-1 0V9a.5.5 0 0 0 .252.434l3.5 2a.5.5 0 0 0 .496-.868L8 8.71V3.5z"/>
      <path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm7-8A7 7 0 1 1 1 8a7 7 0 0 1 14 0z"/>
    </svg>
  ),
  Month: () => (
    <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
      <path d="M11 6.5a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5v-1zm-3 0a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5v-1zm-5 3a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5v-1zm3 0a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5v-1z"/>
      <path d="M3.5 0a.5.5 0 0 1 .5.5V1h8V.5a.5.5 0 0 1 1 0V1h1a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2h1V.5a.5.5 0 0 1 .5-.5zM1 4v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V4H1z"/>
    </svg>
  ),
  Star: () => (
    <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
      <path d="M3.612 15.443c-.386.198-.824-.149-.746-.592l.83-4.73L.173 6.765c-.329-.314-.158-.888.283-.950l4.898-.696L7.538.792c.197-.39.73-.39.927 0l2.184 4.327 4.898.696c.441.062.612.636.282.950l-3.522 3.356.83 4.73c.078.443-.36.790-.746.592L8 13.187l-4.389 2.256z"/>
    </svg>
  ),
  Pending: () => (
    <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
      <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
      <path d="M7.002 11a1 1 0 1 1 2 0 1 1 0 0 1-2 0zM7.1 4.995a.905.905 0 1 1 1.8 0l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 4.995z"/>
    </svg>
  ),
  Check: () => (
    <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
      <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zm-3.97-3.03a.75.75 0 0 0-1.08.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-.01-1.05z"/>
    </svg>
  ),
  Done: () => (
    <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
      <path d="M2.5 8a5.5 5.5 0 0 1 8.25-4.764.5.5 0 0 0 .5-.866A6.5 6.5 0 1 0 14.5 8a.5.5 0 0 0-1 0 5.5 5.5 0 1 1-11 0z"/>
      <path d="M15.354 3.354a.5.5 0 0 0-.708-.708L8 9.293 5.354 6.646a.5.5 0 1 0-.708.708l3 3a.5.5 0 0 0 .708 0l7-7z"/>
    </svg>
  ),
  X: () => (
    <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
      <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zM5.354 4.646a.5.5 0 1 0-.708.708L7.293 8l-2.647 2.646a.5.5 0 0 0 .708.708L8 8.707l2.646 2.647a.5.5 0 0 0 .708-.708L8.707 8l2.647-2.646a.5.5 0 0 0-.708-.708L8 7.293 5.354 4.646z"/>
    </svg>
  ),
  Clipboard: () => (
    <svg width="18" height="18" fill="currentColor" viewBox="0 0 16 16">
      <path d="M10 1.5a.5.5 0 0 0-.5-.5h-3a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 .5.5h3a.5.5 0 0 0 .5-.5v-1zm-5 0A1.5 1.5 0 0 1 6.5 0h3A1.5 1.5 0 0 1 11 1.5v1A1.5 1.5 0 0 1 9.5 4h-3A1.5 1.5 0 0 1 5 2.5v-1zm-2 0h1v1A2.5 2.5 0 0 0 6.5 5h3A2.5 2.5 0 0 0 12 2.5v-1h1a2 2 0 0 1 2 2V14a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V3.5a2 2 0 0 1 2-2z"/>
    </svg>
  ),
  Grid: () => (
    <svg width="18" height="18" fill="currentColor" viewBox="0 0 16 16">
      <path d="M1 2.5A1.5 1.5 0 0 1 2.5 1h3A1.5 1.5 0 0 1 7 2.5v3A1.5 1.5 0 0 1 5.5 7h-3A1.5 1.5 0 0 1 1 5.5v-3zM2.5 2a.5.5 0 0 0-.5.5v3a.5.5 0 0 0 .5.5h3a.5.5 0 0 0 .5-.5v-3a.5.5 0 0 0-.5-.5h-3zm6.5.5A1.5 1.5 0 0 1 10.5 1h3A1.5 1.5 0 0 1 15 2.5v3A1.5 1.5 0 0 1 13.5 7h-3A1.5 1.5 0 0 1 9 5.5v-3zm1.5-.5a.5.5 0 0 0-.5.5v3a.5.5 0 0 0 .5.5h3a.5.5 0 0 0 .5-.5v-3a.5.5 0 0 0-.5-.5h-3zM1 10.5A1.5 1.5 0 0 1 2.5 9h3A1.5 1.5 0 0 1 7 10.5v3A1.5 1.5 0 0 1 5.5 15h-3A1.5 1.5 0 0 1 1 13.5v-3zm1.5-.5a.5.5 0 0 0-.5.5v3a.5.5 0 0 0 .5.5h3a.5.5 0 0 0 .5-.5v-3a.5.5 0 0 0-.5-.5h-3zm6.5.5A1.5 1.5 0 0 1 10.5 9h3a1.5 1.5 0 0 1 1.5 1.5v3a1.5 1.5 0 0 1-1.5 1.5h-3A1.5 1.5 0 0 1 9 13.5v-3zm1.5-.5a.5.5 0 0 0-.5.5v3a.5.5 0 0 0 .5.5h3a.5.5 0 0 0 .5-.5v-3a.5.5 0 0 0-.5-.5h-3z"/>
    </svg>
  ),
  Yacht: () => (
    <svg width="18" height="18" fill="currentColor" viewBox="0 0 16 16">
      <path d="M2.52 3.515A2.5 2.5 0 0 1 4.82 2h6.362c1 0 1.904.596 2.298 1.515l.792 1.848c.075.175.21.319.38.404.5.25.855.715.965 1.262l.335 1.679c.033.161.049.325.049.49v.413c0 1.164-.47 2.215-1.23 2.977h.7a.5.5 0 0 1 0 1H3a.5.5 0 0 1 0-1h.73c-.488-.573-.805-1.273-.88-2.044l-.054-.592a.301.301 0 0 1-.048-.17V8.198c0-.165.016-.33.049-.49l.335-1.68a1.5 1.5 0 0 1 .965-1.261.5.5 0 0 0 .38-.404l.792-1.848z"/>
    </svg>
  ),
  Arrow: () => (
    <svg width="12" height="12" fill="currentColor" viewBox="0 0 16 16">
      <path fillRule="evenodd" d="M1 8a.5.5 0 0 1 .5-.5h11.793l-3.147-3.146a.5.5 0 0 1 .708-.708l4 4a.5.5 0 0 1 0 .708l-4 4a.5.5 0 0 1-.708-.708L13.293 8.5H1.5A.5.5 0 0 1 1 8z"/>
    </svg>
  ),
};

/* ── IST helpers ── */
const toISTDateStr = (utcStr) => {
  const d = new Date(new Date(utcStr).toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
};

const getGreeting = () => {
  const h = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })).getHours();
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Afternoon";
  return "Good Evening";
};

const formatDate = () =>
  new Date().toLocaleDateString("en-IN", { weekday:"long", day:"numeric", month:"long", year:"numeric", timeZone:"Asia/Kolkata" });

export default function AdminDashboard({ user }) {
  const navigate = useNavigate();
  const [stats, setStats]         = useState({ today:0, upcoming7Days:0, month:0, createdToday:0, confirmed:0, pending:0, cancelled:0, completed:0 });
  const [loaded, setLoaded]       = useState(false);
  const [cardsReady, setCardsReady] = useState(false);

  const getNowIST   = () => new Date(new Date().toLocaleString("en-US", { timeZone:"Asia/Kolkata" }));
  const getTodayIST = () => { const n=getNowIST(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}-${String(n.getDate()).padStart(2,"0")}`; };
  const isBookingCompleted = (b) => {
    if (!b.date || !b.endTime) return false;
    return new Date(`${b.date.split("T")[0]}T${b.endTime}:00+05:30`) < getNowIST();
  };

  const computeStats = (bookings) => {
    const todayIST=getTodayIST(), nowIST=getNowIST();
    const todayMid = new Date(`${todayIST}T00:00:00+05:30`);
    const next7    = new Date(todayMid); next7.setDate(next7.getDate()+7);
    const cm=nowIST.getMonth(), cy=nowIST.getFullYear();
    let today=0, upcoming7Days=0, month=0, createdToday=0, confirmed=0, pending=0, cancelled=0, completed=0;
    bookings.forEach((b) => {
      const bd=b.date.split("T")[0], bdo=new Date(`${bd}T00:00:00+05:30`), ca=toISTDateStr(b.createdAt);
      if (b.status==="cancelled") { cancelled++; return; }
      const done=isBookingCompleted(b);
      if (done) completed++;
      if (bd===todayIST) today++;
      if (!done && bdo>todayMid && bdo<=next7) upcoming7Days++;
      if (!done && bdo.getMonth()===cm && bdo.getFullYear()===cy) month++;
      if (ca===todayIST) createdToday++;
      if (!done && b.status==="confirmed") confirmed++;
      if (!done && b.status==="pending")   pending++;
    });
    return { today, upcoming7Days, month, createdToday, confirmed, pending, cancelled, completed };
  };

  useEffect(() => {
    const uid=user?._id, cached=dbGetCached(uid);
    if (cached) { setStats(cached); setLoaded(true); setCardsReady(true); }
    else setCardsReady(true);
    (async () => {
      try {
        const token=localStorage.getItem("authToken");
        const res=await getBookingsAPI(token,{});
        const computed=computeStats(res?.data?.bookings||[]);
        setStats(computed); dbSetCache(uid,computed);
      } catch(e) { console.error(e); }
      finally { setLoaded(true); }
    })();
  }, []);

  const todayStr = getTodayIST();
  const monthStr = getTodayIST().slice(0,7);

  const STATS = [
    { label:"Today",       value:stats.today,        accent:"#3b82f6", icon:<Ico.Calendar />,  nav:`/bookings?date=${todayStr}` },
    { label:"Next 7 Days", value:stats.upcoming7Days, accent:"#f59e0b", icon:<Ico.Clock7 />,   nav:"/bookings?range=7days" },
    { label:"This Month",  value:stats.month,         accent:"#8b5cf6", icon:<Ico.Month />,     nav:`/bookings?month=${monthStr}` },
    { label:"New Today",   value:stats.createdToday,  accent:"#06b6d4", icon:<Ico.Star />,      nav:"/bookings?created=today" },
    { label:"Pending",     value:stats.pending,       accent:"#f97316", icon:<Ico.Pending />,   nav:"/bookings?status=pending" },
    { label:"Confirmed",   value:stats.confirmed,     accent:"#10b981", icon:<Ico.Check />,     nav:"/bookings?status=confirmed" },
    { label:"Completed",   value:stats.completed,     accent:"#6366f1", icon:<Ico.Done />,      nav:"/bookings?status=completed" },
    { label:"Cancelled",   value:stats.cancelled,     accent:"#ef4444", icon:<Ico.X />,         nav:"/bookings?status=cancelled" },
  ];

  const MGMT = [
    { label:"Create Booking", desc:"Add a new yacht reservation",    iconBg:"#dbeafe", iconColor:"#1d4ed8", icon:<Ico.Clipboard />, linkColor:"#1d4ed8", nav:"/create-booking" },
    { label:"All Bookings",   desc:"Browse and manage reservations", iconBg:"#dcfce7", iconColor:"#15803d", icon:<Ico.Grid />,      linkColor:"#15803d", nav:`/bookings?month=${monthStr}` },
    { label:"Availability",   desc:"Yacht overview",                 iconBg:"#fef3c7", iconColor:"#b45309", icon:<Ico.Yacht />,     linkColor:"#b45309", nav:"/availability" },
  ];

  const firstName = user?.name?.split(" ")[0] || "Welcome";

  return (
    <div className={styles.dashboardWrapper}>

      {/* ── Content ── */}
      <div className={styles.contentArea}>

        {/* Overview stats */}
        <div className={styles.sectionLabel}>
          <span className={styles.sectionLabelText}>Overview</span>
          <div className={styles.sectionLabelLine} />
        </div>

        <div className={styles.statsGrid}>
          {STATS.map((s, i) => (
            <div
              key={s.label}
              className={`${styles.statCard} ${cardsReady ? styles.statCardVisible : ""}`}
              style={{ "--card-accent": s.accent, transitionDelay:`${i*45}ms` }}
              onClick={() => loaded ? navigate(s.nav) : undefined}
            >
              <div className={styles.statCardLeft}>
                {loaded
                  ? <span className={styles.statValue}>{s.value}</span>
                  : <span className={styles.skelNum} />}
                <span className={styles.statLabel}>{s.label}</span>
              </div>
              <div className={styles.statIcon}>{s.icon}</div>
            </div>
          ))}
        </div>

        {/* Management */}
        <div className={styles.sectionLabel}>
          <span className={styles.sectionLabelText}>Management</span>
          <div className={styles.sectionLabelLine} />
        </div>

        <div className={styles.mgmtGrid}>
          {MGMT.map((m, i) => (
            <div
              key={m.label}
              className={`${styles.mgmtCard} ${cardsReady ? styles.mgmtCardVisible : ""}`}
              style={{ transitionDelay:`${360 + i*70}ms` }}
              onClick={() => navigate(m.nav)}
            >
              <div className={styles.mgmtCardTop}>
                <div className={styles.mgmtIconWrap} style={{ background:m.iconBg, color:m.iconColor }}>
                  {m.icon}
                </div>
                <div className={styles.mgmtCardBody}>
                  <h5>{m.label}</h5>
                  <p>{m.desc}</p>
                </div>
              </div>
              <div className={styles.mgmtCardFooter}>
                <a
                  className={styles.mgmtLink}
                  style={{ color:m.linkColor }}
                  onClick={(e) => { e.stopPropagation(); navigate(m.nav); }}
                >
                  Open <Ico.Arrow />
                </a>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
