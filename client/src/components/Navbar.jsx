import React, { useRef, useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import styles from "../styles/Navbar.module.css";
import toast from "react-hot-toast";
import { updateEmployeeProfileAPI } from "../services/operations/employeeAPI";
import { setPinAPI } from "../services/operations/authAPI";
import { socket } from "../socket";
import { getNotificationsAPI } from "../services/operations/notificationAPI";

function Navbar({ user, onLogout }) {
  const collapseRef = useRef(null);
  const [showProfile, setShowProfile] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const token = localStorage.getItem("authToken");
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showSettingsDrawer, setShowSettingsDrawer] = useState(false);
  const [showMastersMenu, setShowMastersMenu] = useState(false);
  const mastersMenuRef = useRef(null);

  const [editForm, setEditForm] = useState({
    name: user?.name || "",
    email: user?.email || "",
    contact: user?.contact || "",
    currentPassword: "",
    newPassword: "",
    isPrivate: user?.isPrivate || false,
    profilePhoto: user?.profilePhoto || null,
  });

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [errors, setErrors] = useState({});

  // ── PIN state ──────────────────────────────────────────────────────────────
  const [pinForm, setPinForm] = useState({ newPin: "", confirmPin: "" });
  const [showPin, setShowPin] = useState(false);
  const [pinLoading, setPinLoading] = useState(false);

  // ── Notification bell state ────────────────────────────────────────────────
  const [unreadCount, setUnreadCount] = useState(0);
  useEffect(() => {
    const fetchCount = async () => {
      try {
        const res = await getNotificationsAPI(token);
        const notifications = res.data.notifications || [];
        const count = notifications.filter(
          (n) => !n.readBy?.some((id) => id.toString() === user?._id)
        ).length;
        setUnreadCount(count);
      } catch (_) {}
    };
    fetchCount();
    socket.on("notification:new", () => setUnreadCount((p) => p + 1));
    return () => socket.off("notification:new");
  }, []);

  const handleNavLinkClick = () => {
    const collapseEl = collapseRef.current;
    if (collapseEl && collapseEl.classList.contains("show")) {
      const bsCollapse = new window.bootstrap.Collapse(collapseEl, { toggle: true });
      bsCollapse.hide();
    }
    setShowSettingsDrawer(false);
  };

  const getInitials = (name) => {
    if (!name) return "";
    const parts = name.trim().split(" ");
    return parts.length > 1
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : parts[0][0].toUpperCase();
  };

  const handleCombinedUpdate = async () => {
    try {
      const newErrors = {};
      if (!editForm.name.trim()) newErrors.name = "Name is required";
      if (!editForm.email.trim()) newErrors.email = "Email is required";
      if (!editForm.contact.trim()) newErrors.contact = "Contact is required";
      if (editForm.currentPassword && !editForm.newPassword) newErrors.newPassword = "New password is required";
      if (!editForm.currentPassword && editForm.newPassword) newErrors.currentPassword = "Current password is required";
      if (editForm.newPassword && editForm.newPassword.length < 6) newErrors.newPassword = "Password must be at least 6 characters";
      if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }

      setErrors({});
      let payload;
      if (editForm.profilePhoto) {
        payload = new FormData();
        payload.append("name", editForm.name);
        payload.append("email", editForm.email);
        payload.append("contact", editForm.contact);
        payload.append("isPrivate", editForm.isPrivate);
        payload.append("profilePhoto", editForm.profilePhoto);
        if (editForm.currentPassword && editForm.newPassword) {
          payload.append("currentPassword", editForm.currentPassword);
          payload.append("newPassword", editForm.newPassword);
        }
      } else {
        payload = { name: editForm.name, email: editForm.email, contact: editForm.contact, isPrivate: editForm.isPrivate };
        if (editForm.currentPassword && editForm.newPassword) {
          payload.currentPassword = editForm.currentPassword;
          payload.newPassword = editForm.newPassword;
        }
      }

      const response = await updateEmployeeProfileAPI(user._id, payload, token);
      const updatedEmployee = response.data.employee;
      const storedUser = JSON.parse(localStorage.getItem("user"));
      localStorage.setItem("user", JSON.stringify({
        ...storedUser,
        name: updatedEmployee.name,
        email: updatedEmployee.email,
        contact: updatedEmployee.contact,
        isPrivate: updatedEmployee.isPrivate,
        profilePhoto: updatedEmployee.profilePhoto,
      }));
      setEditForm((prev) => ({ ...prev, currentPassword: "", newPassword: "" }));

      // Handle PIN update if provided
      if (pinForm.newPin.length === 4) {
        if (pinForm.newPin !== pinForm.confirmPin) {
          toast.error("PINs do not match.");
          return;
        }
        await setPinAPI(pinForm.newPin, token);
        setPinForm({ newPin: "", confirmPin: "" });
      }

      toast.success("Profile updated successfully 🎉");
      setShowEditProfile(false);
      setShowProfile(false);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Profile update failed ❌");
    }
  };

  useEffect(() => {
    const handleOutsideClick = (event) => {
      const collapseEl = collapseRef.current;
      if (collapseEl && collapseEl.classList.contains("show") && !collapseEl.contains(event.target) && !event.target.classList.contains("navbar-toggler")) {
        const bsCollapse = new window.bootstrap.Collapse(collapseEl, { toggle: true });
        bsCollapse.hide();
      }
    };
    document.addEventListener("click", handleOutsideClick);
    return () => document.removeEventListener("click", handleOutsideClick);
  }, []);

  useEffect(() => {
    if (showSettingsDrawer) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [showSettingsDrawer]);

  useEffect(() => {
    if (!showMastersMenu) return;
    const handler = (e) => {
      if (mastersMenuRef.current && !mastersMenuRef.current.contains(e.target)) {
        setShowMastersMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showMastersMenu]);

  const currentMonth = new Date().toISOString().slice(0, 7);
  const isActive = (path) => location.pathname === path;

  // Dynamic header title based on current route (prefix match for dynamic segments)
  const PAGE_TITLE_PREFIXES = [
    ["/admin",               "Dashboard"],
    ["/availability",        "Availability"],
    ["/grid-availability",   "Calendar"],
    ["/bookings",            "Bookings"],
    ["/all-yachts",          "Yacht Master"],
    ["/create-customer",     "Customers"],
    ["/customer-management", "Customers"],
    ["/customer-details",    "Customer Details"],
    ["/all-employees",       "User Master"],
    ["/create-booking",      "Create Booking"],
    ["/update-booking",      "Bookings"],
    ["/edit-booking",        "Edit Booking"],
    ["/create-employee",     "Create Employee"],
    ["/create-yacht",        "Create Yacht"],
    ["/collections",         "Collections"],
    ["/register-company",    "Register Company"],
    ["/notifications",       "Notifications"],
    ["/reports",             "Reports"],
  ];
  const pageTitle = (() => {
    const path = location.pathname;
    for (const [prefix, title] of PAGE_TITLE_PREFIXES) {
      if (path === prefix || path.startsWith(prefix + "/")) return title;
    }
    return user.type === "admin" ? "Dashboard" : "Boating Assistance";
  })();

  const allNavItems = [
    {
      label: "Bookings",
      to: `/bookings?month=${currentMonth}`,
      path: "/bookings",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="currentColor" viewBox="0 0 16 16">
          <path d="M3.5 0a.5.5 0 0 1 .5.5V1h8V.5a.5.5 0 0 1 1 0V1h1a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2h1V.5a.5.5 0 0 1 .5-.5zM1 4v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V4H1z"/>
        </svg>
      ),
      show: true,
    },
    {
      label: "Availability",
      to: "/availability",
      path: "/availability",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="currentColor" viewBox="0 0 16 16">
          <path d="M8 3.5a.5.5 0 0 0-1 0V9a.5.5 0 0 0 .252.434l3.5 2a.5.5 0 0 0 .496-.868L8 8.71V3.5z"/>
          <path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm7-8A7 7 0 1 1 1 8a7 7 0 0 1 14 0z"/>
        </svg>
      ),
      show: user?.type === "admin" || user?.type === "backdesk",
    },
    {
      label: "Calendar",
      to: "/grid-availability",
      path: "/grid-availability",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="currentColor" viewBox="0 0 16 16">
          <path d="M11 6.5a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5v-1zm-3 0a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5v-1zm-5 3a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5v-1zm3 0a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5v-1z"/>
          <path d="M3.5 0a.5.5 0 0 1 .5.5V1h8V.5a.5.5 0 0 1 1 0V1h1a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2h1V.5a.5.5 0 0 1 .5-.5zM1 4v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V4H1z"/>
        </svg>
      ),
      show: user?.type === "admin" || user?.type === "backdesk",
    },
    {
      label: "Reports",
      to: "/reports",
      path: "/reports",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="currentColor" viewBox="0 0 16 16">
          <path d="M0 0h1v15h15v1H0V0zm14.817 3.113a.5.5 0 0 1 .07.704l-4.5 5.5a.5.5 0 0 1-.74.037L7.06 6.767l-3.656 5.027a.5.5 0 0 1-.808-.588l4-5.5a.5.5 0 0 1 .758-.06l2.609 2.61 4.15-5.073a.5.5 0 0 1 .704-.07z"/>
        </svg>
      ),
      show: user?.type === "admin" || user?.type === "backdesk",
    },
    {
      label: "Yacht Master",
      to: "/all-yachts",
      path: "/all-yachts",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="currentColor" viewBox="0 0 24 24">
          <rect x="11.25" y="2" width="1.5" height="10.5" rx="0.5"/>
          <path d="M11 3.5 L3.5 13 L11 13 Z"/>
          <path d="M13 3.5 L20.5 13 L13 13 Z"/>
          <path d="M3 14 L21 14 L18.5 19.5 C17.5 21 6.5 21 5.5 19.5 Z"/>
        </svg>
      ),
      show: user?.type === "admin",
    },
    {
      label: "Create Company",
      to: "/register-company",
      path: "/register-company",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="currentColor" viewBox="0 0 16 16">
          <path d="M1 2.5A1.5 1.5 0 0 1 2.5 1h3A1.5 1.5 0 0 1 7 2.5v3A1.5 1.5 0 0 1 5.5 7h-3A1.5 1.5 0 0 1 1 5.5v-3zm8 0A1.5 1.5 0 0 1 10.5 1h3A1.5 1.5 0 0 1 15 2.5v3A1.5 1.5 0 0 1 13.5 7h-3A1.5 1.5 0 0 1 9 5.5v-3zm-8 8A1.5 1.5 0 0 1 2.5 9h3A1.5 1.5 0 0 1 7 10.5v3A1.5 1.5 0 0 1 5.5 15h-3A1.5 1.5 0 0 1 1 13.5v-3zm8 0A1.5 1.5 0 0 1 10.5 9h3a1.5 1.5 0 0 1 1.5 1.5v3a1.5 1.5 0 0 1-1.5 1.5h-3A1.5 1.5 0 0 1 9 13.5v-3z"/>
        </svg>
      ),
      show: user?.type === "admin",
    },
    {
      label: "Customers",
      to: "/create-customer",
      path: "/create-customer",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="currentColor" viewBox="0 0 16 16">
          <path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm2-3a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm4 8c0 1-1 1-1 1H3s-1 0-1-1 1-4 6-4 6 3 6 4zm-1-.004c-.001-.246-.154-.986-.832-1.664C11.516 10.68 10.289 10 8 10c-2.29 0-3.516.68-4.168 1.332-.678.678-.83 1.418-.832 1.664h10z"/>
        </svg>
      ),
      show: user?.type === "admin" || user?.type === "backdesk",
    },
    {
      label: "User Master",
      to: "/all-employees",
      path: "/all-employees",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="currentColor" viewBox="0 0 16 16">
          <path d="M7 14s-1 0-1-1 1-4 5-4 5 3 5 4-1 1-1 1H7zm4-6a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/>
          <path fillRule="evenodd" d="M5.216 14A2.238 2.238 0 0 1 5 13c0-1.355.68-2.75 1.936-3.72A6.325 6.325 0 0 0 5 9c-4 0-5 3-5 4s1 1 1 1h4.216z"/>
          <path d="M4.5 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z"/>
        </svg>
      ),
      show: user?.type === "admin",
    },
  ].filter((item) => item.show);

  const homeItem = {
    label: "Home",
    to: user?.type === "admin" ? "/admin" : "/bookings",
    path: user?.type === "admin" ? "/admin" : "/bookings",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="currentColor" viewBox="0 0 16 16">
        <path d="M8.354 1.146a.5.5 0 0 0-.708 0l-6 6A.5.5 0 0 0 1.5 7.5v7a.5.5 0 0 0 .5.5h4.5v-4h3v4H14a.5.5 0 0 0 .5-.5v-7a.5.5 0 0 0-.146-.354L8.354 1.146z"/>
      </svg>
    ),
  };

  const MASTERS_PATHS = ["/all-yachts", "/register-company", "/create-customer", "/all-employees"];

  const bottomBarPaths = ["/bookings", "/availability", "/grid-availability"];
  const bottomBarCoreItems = allNavItems.filter((item) => bottomBarPaths.includes(item.path));
  const bottomBarItems = user?.type === "admin"
    ? [homeItem, ...bottomBarCoreItems]
    : bottomBarCoreItems;

  const coreNavItems = allNavItems.filter((item) => !MASTERS_PATHS.includes(item.path));
  const mastersNavItems = allNavItems.filter((item) => MASTERS_PATHS.includes(item.path));
  const mastersActive = MASTERS_PATHS.includes(location.pathname);

  const drawerCoreItems = allNavItems.filter((item) => !bottomBarPaths.includes(item.path) && !MASTERS_PATHS.includes(item.path));
  const drawerMastersItems = allNavItems.filter((item) => !bottomBarPaths.includes(item.path) && MASTERS_PATHS.includes(item.path));

  const ProfileAvatar = ({ size = 38 }) => (
    <button
      className="btn p-0 d-flex align-items-center justify-content-center rounded-circle shadow-sm"
      style={{
        width: size, height: size,
        background: user?.profilePhoto ? "transparent" : "rgba(255,255,255,0.2)",
        border: "2px solid rgba(255,255,255,0.6)",
        overflow: "hidden",
        flexShrink: 0,
      }}
      onClick={() => setShowProfile(true)}
    >
      {user?.profilePhoto ? (
        <img src={user.profilePhoto} alt="profile" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        <span style={{ color: "#fff", fontWeight: 700, fontSize: size * 0.32 }}>{user?.username?.toUpperCase()}</span>
      )}
    </button>
  );

  const HamburgerIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
      <path fillRule="evenodd" d="M2.5 12a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5zm0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5zm0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5z"/>
    </svg>
  );

  return (
    <>
      {/* ─── DESKTOP / TABLET TOP NAVBAR (≥ 768 px) ─── */}
      <nav
        className="d-none d-md-flex position-fixed w-100 align-items-center"
        style={{
          top: 0, left: 0, zIndex: 1030,
          background: "linear-gradient(90deg, #051829 0%, #0a2d4a 55%, #0d4a6e 100%)",
          boxShadow: "0 2px 20px rgba(5,24,41,0.45)",
          height: "62px",
          padding: "0 20px",
          gap: 16,
          borderBottom: "1px solid rgba(201,168,76,0.18)",
        }}
      >
        {/* ── Dashboard link ── */}
        <button
          onClick={() => navigate(user?.type === "admin" ? "/admin" : "/bookings")}
          style={{
            background: "none", border: "none", cursor: "pointer",
            flexShrink: 0, padding: "4px 14px 4px 4px",
            borderRight: "1px solid rgba(255,255,255,0.1)",
            marginRight: 4,
            color: "#e8d5a0", fontWeight: 800, fontSize: "1rem",
            letterSpacing: "0.02em", whiteSpace: "nowrap",
          }}
        >
          Dashboard
        </button>

        {/* ── Nav items ── */}
        <div style={{ display: "flex", alignItems: "center", gap: 2, flex: 1, overflowX: "auto", scrollbarWidth: "none" }}>
          {/* Core nav items: Bookings, Availability, Calendar */}
          {coreNavItems.map((item) => {
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.to}
                onClick={handleNavLinkClick}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "6px 12px",
                  borderRadius: 10,
                  textDecoration: "none",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                  color: active ? "#c9a84c" : "rgba(255,255,255,0.72)",
                  background: active ? "rgba(201,168,76,0.14)" : "transparent",
                  border: active ? "1px solid rgba(201,168,76,0.3)" : "1px solid transparent",
                  fontWeight: active ? 700 : 500,
                  fontSize: "0.83rem",
                  transition: "all 0.15s",
                  letterSpacing: "0.01em",
                }}
                onMouseEnter={e => { if (!active) { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "#fff"; } }}
                onMouseLeave={e => { if (!active) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(255,255,255,0.72)"; } }}
              >
                <span style={{ display: "flex", opacity: active ? 1 : 0.75, flexShrink: 0 }}>
                  {React.cloneElement(item.icon, { width: 15, height: 15 })}
                </span>
                <span className="d-none d-lg-inline">{item.label}</span>
              </Link>
            );
          })}

          {/* Masters — inline expand on desktop/tablet */}
          {mastersNavItems.length > 0 && (
            <div ref={mastersMenuRef} style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
              {/* When collapsed: show "Masters ▸" toggle button */}
              {!showMastersMenu ? (
                <button
                  onClick={() => setShowMastersMenu(true)}
                  style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "6px 12px", borderRadius: 10,
                    border: mastersActive ? "1px solid rgba(201,168,76,0.3)" : "1px solid transparent",
                    background: mastersActive ? "rgba(201,168,76,0.14)" : "transparent",
                    color: mastersActive ? "#c9a84c" : "rgba(255,255,255,0.72)",
                    fontWeight: mastersActive ? 700 : 500,
                    fontSize: "0.83rem", cursor: "pointer",
                    whiteSpace: "nowrap", letterSpacing: "0.01em", transition: "all 0.15s",
                  }}
                  onMouseEnter={e => { if (!mastersActive) { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "#fff"; } }}
                  onMouseLeave={e => { if (!mastersActive) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(255,255,255,0.72)"; } }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16" style={{ opacity: 0.85 }}>
                    <path d="M1 2.5A1.5 1.5 0 0 1 2.5 1h3A1.5 1.5 0 0 1 7 2.5v3A1.5 1.5 0 0 1 5.5 7h-3A1.5 1.5 0 0 1 1 5.5v-3zm8 0A1.5 1.5 0 0 1 10.5 1h3A1.5 1.5 0 0 1 15 2.5v3A1.5 1.5 0 0 1 13.5 7h-3A1.5 1.5 0 0 1 9 5.5v-3zm-8 8A1.5 1.5 0 0 1 2.5 9h3A1.5 1.5 0 0 1 7 10.5v3A1.5 1.5 0 0 1 5.5 15h-3A1.5 1.5 0 0 1 1 13.5v-3zm8 0A1.5 1.5 0 0 1 10.5 9h3a1.5 1.5 0 0 1 1.5 1.5v3a1.5 1.5 0 0 1-1.5 1.5h-3A1.5 1.5 0 0 1 9 13.5v-3z"/>
                  </svg>
                  <svg width="10" height="10" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="1 1 5 5 9 1"/>
                  </svg>
                </button>
              ) : (
                /* When expanded: close button + individual items inline */
                <>
                  {/* Subtle separator */}
                  <div style={{ width: 1, height: 22, background: "rgba(255,255,255,0.15)", marginRight: 4 }} />

                  {/* Close / collapse button */}
                  <button
                    onClick={() => setShowMastersMenu(false)}
                    title="Close Masters"
                    style={{
                      display: "flex", alignItems: "center", gap: 5,
                      padding: "5px 9px", borderRadius: 8,
                      border: "1px solid rgba(201,168,76,0.35)",
                      background: "rgba(201,168,76,0.12)",
                      color: "#c9a84c", fontSize: "0.72rem", fontWeight: 700,
                      cursor: "pointer", whiteSpace: "nowrap",
                      letterSpacing: "0.06em", textTransform: "uppercase",
                      transition: "all 0.15s",
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <line x1="10" y1="2" x2="2" y2="10"/><line x1="2" y1="2" x2="10" y2="10"/>
                    </svg>
                  </button>

                  {/* Individual master items inline */}
                  {mastersNavItems.map((item) => {
                    const active = isActive(item.path);
                    return (
                      <Link
                        key={item.path}
                        to={item.to}
                        onClick={() => { setShowMastersMenu(false); handleNavLinkClick(); }}
                        style={{
                          display: "flex", alignItems: "center", gap: 6,
                          padding: "6px 11px", borderRadius: 10,
                          textDecoration: "none", whiteSpace: "nowrap",
                          color: active ? "#c9a84c" : "rgba(255,255,255,0.72)",
                          background: active ? "rgba(201,168,76,0.14)" : "transparent",
                          border: active ? "1px solid rgba(201,168,76,0.3)" : "1px solid transparent",
                          fontWeight: active ? 700 : 500,
                          fontSize: "0.83rem", letterSpacing: "0.01em",
                          transition: "all 0.15s",
                          animation: "mastersDropIn 0.18s ease-out",
                        }}
                        onMouseEnter={e => { if (!active) { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "#fff"; } }}
                        onMouseLeave={e => { if (!active) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(255,255,255,0.72)"; } }}
                      >
                        <span style={{ display: "flex", opacity: active ? 1 : 0.75, flexShrink: 0 }}>
                          {React.cloneElement(item.icon, { width: 14, height: 14 })}
                        </span>
                        <span className="d-none d-lg-inline">{item.label}</span>
                      </Link>
                    );
                  })}

                  {/* Closing separator */}
                  <div style={{ width: 1, height: 22, background: "rgba(255,255,255,0.15)", marginLeft: 4 }} />
                </>
              )}
            </div>
          )}
        </div>

        {/* ── Right: user info + logout ── */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>

          {/* Bell */}
          <button
            onClick={() => navigate("/notifications")}
            title="Notifications"
            style={{
              position: "relative",
              width: 36, height: 36, borderRadius: 10,
              background: unreadCount > 0 ? "rgba(201,168,76,0.15)" : "rgba(255,255,255,0.08)",
              border: unreadCount > 0 ? "1px solid rgba(201,168,76,0.4)" : "1px solid rgba(255,255,255,0.14)",
              color: unreadCount > 0 ? "#c9a84c" : "rgba(255,255,255,0.8)",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", flexShrink: 0,
              transition: "all 0.15s",
            }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            {unreadCount > 0 && (
              <span style={{
                position: "absolute", top: 4, right: 4,
                minWidth: 14, height: 14, padding: "0 3px",
                borderRadius: 999, background: "#e74c3c",
                color: "#fff", fontSize: 8, fontWeight: 800,
                lineHeight: "14px", textAlign: "center",
                border: "1.5px solid #051829", boxSizing: "border-box",
              }}>
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>

          {/* User chip */}
          <button
            onClick={() => setShowProfile(true)}
            style={{
              display: "flex", alignItems: "center", gap: 9,
              background: "rgba(255,255,255,0.07)",
              border: "1px solid rgba(255,255,255,0.14)",
              borderRadius: 12, padding: "5px 12px 5px 6px",
              cursor: "pointer",
            }}
          >
            {/* Avatar */}
            <div style={{
              width: 32, height: 32, borderRadius: "50%",
              background: user?.profilePhoto ? "transparent" : "rgba(201,168,76,0.2)",
              border: "2px solid rgba(201,168,76,0.45)",
              overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}>
              {user?.profilePhoto
                ? <img src={user.profilePhoto} alt="profile" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : <span style={{ color: "#c9a84c", fontWeight: 800, fontSize: "0.65rem" }}>{user?.username?.toUpperCase()}</span>
              }
            </div>
            <div style={{ textAlign: "left" }}>
              <div style={{ color: "#fff", fontWeight: 700, fontSize: "0.8rem", lineHeight: 1.1, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {user?.name}
              </div>
              <div style={{ color: "rgba(201,168,76,0.8)", fontSize: "0.62rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {user?.type === "backdesk" ? "Agent" : user?.type === "onsite" ? "Staff" : user?.type}
              </div>
            </div>
          </button>

          {/* Logout */}
          <button
            onClick={onLogout}
            title="Logout"
            style={{
              width: 36, height: 36, borderRadius: 10,
              background: "rgba(220,53,69,0.12)",
              border: "1px solid rgba(220,53,69,0.3)",
              color: "#f87171",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", flexShrink: 0,
              transition: "all 0.15s",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(220,53,69,0.22)"; e.currentTarget.style.borderColor = "rgba(220,53,69,0.5)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(220,53,69,0.12)"; e.currentTarget.style.borderColor = "rgba(220,53,69,0.3)"; }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
              <path fillRule="evenodd" d="M10 12.5a.5.5 0 0 1-.5.5h-8a.5.5 0 0 1-.5-.5v-9a.5.5 0 0 1 .5-.5h8a.5.5 0 0 1 .5.5v2a.5.5 0 0 0 1 0v-2A1.5 1.5 0 0 0 9.5 2h-8A1.5 1.5 0 0 0 0 3.5v9A1.5 1.5 0 0 0 1.5 14h8a1.5 1.5 0 0 0 1.5-1.5v-2a.5.5 0 0 0-1 0v2z"/>
              <path fillRule="evenodd" d="M15.854 8.354a.5.5 0 0 0 0-.708l-3-3a.5.5 0 0 0-.708.708L14.293 7.5H5.5a.5.5 0 0 0 0 1h8.793l-2.147 2.146a.5.5 0 0 0 .708.708l3-3z"/>
            </svg>
          </button>
        </div>
      </nav>

      {/* ─── MOBILE TOP BAR ─── */}
      <nav
        className="d-flex d-md-none align-items-center justify-content-between position-fixed w-100 px-3"
        style={{
          top: 0, left: 0, zIndex: 1030,
          background: "rgb(2, 80, 130)",
          boxShadow: "0 2px 10px rgba(2,80,130,0.35)",
          height: "56px",
        }}
      >
        <span
          className="fw-bold text-white"
          style={{ fontSize: "1.05rem", textDecoration: "none", letterSpacing: "0.4px", cursor: "pointer" }}
          onClick={() => navigate(location.pathname + location.search, { state: { refresh: Date.now() } })}
        >
          {pageTitle}
        </span>

        <button
          className="d-flex align-items-center justify-content-center"
          style={{
            width: 38, height: 38,
            borderRadius: "10px",
            background: showSettingsDrawer ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.12)",
            border: "1.5px solid rgba(255,255,255,0.35)",
            color: "#fff",
            cursor: "pointer",
            flexShrink: 0,
          }}
          onClick={() => setShowSettingsDrawer((v) => !v)}
        >
          <HamburgerIcon />
        </button>
      </nav>

      {/* ─── MOBILE BOTTOM APP NAV ─── */}
      {user?.type !== "onsite" && (
        <nav
          className="d-flex d-md-none position-fixed w-100"
          style={{
            bottom: 0, left: 0, zIndex: 1030,
            background: "#fff",
            boxShadow: "0 -2px 16px rgba(13,110,253,0.13)",
            borderTop: "1px solid #e8f0fe",
            height: "64px",
          }}
        >
          {bottomBarItems.map((item) => {
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.to}
                className="d-flex flex-column align-items-center justify-content-center text-decoration-none flex-fill"
                style={{
                  color: active ? "#0d6efd" : "#7a8a9a",
                  transition: "color 0.15s",
                  position: "relative",
                  paddingTop: "4px",
                }}
                onClick={handleNavLinkClick}
              >
                {active && (
                  <span style={{
                    position: "absolute", top: 0, left: "50%",
                    transform: "translateX(-50%)", width: 28, height: 3,
                    borderRadius: "0 0 4px 4px", background: "#0d6efd",
                  }} />
                )}
                <span style={{ opacity: active ? 1 : 0.65, transform: active ? "scale(1.1)" : "scale(1)", transition: "transform 0.15s" }}>
                  {item.icon}
                </span>
                <span style={{ fontSize: "10px", fontWeight: active ? 700 : 500, marginTop: "2px", letterSpacing: "0.2px" }}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>
      )}

      {/* ─── SETTINGS DRAWER BACKDROP ─── */}
      <div
        className="d-md-none"
        style={{
          position: "fixed", inset: 0, zIndex: 1025,
          background: "rgba(0,0,0,0.45)",
          opacity: showSettingsDrawer ? 1 : 0,
          pointerEvents: showSettingsDrawer ? "auto" : "none",
          transition: "opacity 0.25s ease",
        }}
        onClick={() => setShowSettingsDrawer(false)}
      />

      {/* ─── SETTINGS DRAWER ─── */}
      <div
        className="d-md-none"
        style={{
          position: "fixed", left: 0, right: 0,
          bottom: showSettingsDrawer ? "64px" : "-100%",
          zIndex: 1026, background: "#fff",
          borderRadius: "20px 20px 0 0",
          boxShadow: "0 -8px 40px rgba(13,110,253,0.18)",
          transition: "bottom 0.32s cubic-bezier(0.4,0,0.2,1)",
          maxHeight: "calc(100dvh - 120px)",
          overflowY: "auto", paddingBottom: "12px",
        }}
      >
        {/* Drawer handle */}
        <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 4px" }}>
          <div style={{ width: 36, height: 4, borderRadius: 99, background: "#dde3f0" }} />
        </div>

        {/* ── Drawer header — click avatar/name to open profile ── */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "8px 20px 16px", borderBottom: "1px solid #f0f4ff",
        }}>
          <button
            onClick={() => { setShowSettingsDrawer(false); setShowProfile(true); }}
            style={{
              display: "flex", alignItems: "center", gap: 12,
              background: "none", border: "none", cursor: "pointer",
              padding: 0, textAlign: "left", flex: 1,
            }}
          >
            <div style={{
              width: 44, height: 44, borderRadius: "50%",
              background: user?.profilePhoto ? "transparent" : "linear-gradient(135deg,#0a2d4a,#1d6fa4)",
              display: "flex", alignItems: "center", justifyContent: "center",
              overflow: "hidden", border: "2px solid rgba(201,168,76,0.4)", flexShrink: 0,
              boxShadow: "0 2px 8px rgba(29,111,164,0.25)",
            }}>
              {user?.profilePhoto ? (
                <img src={user.profilePhoto} alt="profile" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <span style={{ color: "#e8d5a0", fontWeight: 700, fontSize: "0.82rem" }}>{user?.username?.toUpperCase()}</span>
              )}
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "#1a1a2e" }}>{user?.name}</div>
              <div style={{ fontSize: "0.78rem", color: "#7a8a9a", textTransform: "capitalize" }}>
                {user?.type === "backdesk" ? "Agent" : user?.type === "onsite" ? "Staff" : user?.type}
              </div>
            </div>
          </button>

          <button
            style={{
              border: "none", background: "#eef4fb", borderRadius: "50%",
              width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center",
              color: "#1d6fa4", cursor: "pointer", flexShrink: 0,
            }}
            onClick={() => setShowSettingsDrawer(false)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
              <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
            </svg>
          </button>
        </div>

        {/* Drawer nav items */}
        <div style={{ padding: "12px 16px" }}>
          {/* ── Other nav items (none currently in the drawer besides masters for admin) ── */}
          {drawerCoreItems.length > 0 && (
            <>
              <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "#aab4cc", textTransform: "uppercase", letterSpacing: "0.8px", padding: "4px 8px 10px" }}>
                Navigation
              </div>
              {drawerCoreItems.map((item) => {
                const active = isActive(item.path);
                return (
                  <Link
                    key={item.path}
                    to={item.to}
                    onClick={handleNavLinkClick}
                    style={{
                      display: "flex", alignItems: "center", gap: 14,
                      padding: "13px 14px", borderRadius: 12, marginBottom: 4,
                      textDecoration: "none",
                      background: active ? "#eef3ff" : "transparent",
                      color: active ? "#0d6efd" : "#2d3a4a",
                      fontWeight: active ? 700 : 500,
                      fontSize: "0.95rem", transition: "background 0.15s",
                    }}
                  >
                    <span style={{ color: active ? "#0d6efd" : "#7a8a9a", flexShrink: 0 }}>{item.icon}</span>
                    {item.label}
                    {active && (
                      <span style={{ marginLeft: "auto", width: 8, height: 8, borderRadius: "50%", background: "#0d6efd" }} />
                    )}
                  </Link>
                );
              })}
              <div style={{ height: 1, background: "#f0f4ff", margin: "12px 0" }} />
            </>
          )}

          {/* ── Masters section ── */}
          {drawerMastersItems.length > 0 && (
            <>
              <div style={{
                display: "flex", alignItems: "center", gap: 7,
                fontSize: "0.7rem", fontWeight: 700, color: "#7a8a9a",
                textTransform: "uppercase", letterSpacing: "0.8px",
                padding: "4px 8px 10px",
              }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" fill="#7a8a9a" viewBox="0 0 16 16">
                  <path d="M1 2.5A1.5 1.5 0 0 1 2.5 1h3A1.5 1.5 0 0 1 7 2.5v3A1.5 1.5 0 0 1 5.5 7h-3A1.5 1.5 0 0 1 1 5.5v-3zm8 0A1.5 1.5 0 0 1 10.5 1h3A1.5 1.5 0 0 1 15 2.5v3A1.5 1.5 0 0 1 13.5 7h-3A1.5 1.5 0 0 1 9 5.5v-3zm-8 8A1.5 1.5 0 0 1 2.5 9h3A1.5 1.5 0 0 1 7 10.5v3A1.5 1.5 0 0 1 5.5 15h-3A1.5 1.5 0 0 1 1 13.5v-3zm8 0A1.5 1.5 0 0 1 10.5 9h3a1.5 1.5 0 0 1 1.5 1.5v3a1.5 1.5 0 0 1-1.5 1.5h-3A1.5 1.5 0 0 1 9 13.5v-3z"/>
                </svg>
                Masters
              </div>
              {drawerMastersItems.map((item) => {
                const active = isActive(item.path);
                return (
                  <Link
                    key={item.path}
                    to={item.to}
                    onClick={handleNavLinkClick}
                    style={{
                      display: "flex", alignItems: "center", gap: 14,
                      padding: "13px 14px", borderRadius: 12, marginBottom: 4,
                      textDecoration: "none",
                      background: active ? "#eff6ff" : "transparent",
                      color: active ? "#1d6fa4" : "#2d3a4a",
                      fontWeight: active ? 700 : 500,
                      fontSize: "0.95rem", transition: "background 0.15s",
                      borderLeft: active ? "3px solid #1d6fa4" : "3px solid transparent",
                    }}
                  >
                    <span style={{ color: active ? "#1d6fa4" : "#7a8a9a", flexShrink: 0 }}>{item.icon}</span>
                    {item.label}
                    {active && (
                      <span style={{ marginLeft: "auto", width: 8, height: 8, borderRadius: "50%", background: "#1d6fa4" }} />
                    )}
                  </Link>
                );
              })}
              <div style={{ height: 1, background: "#f0f4ff", margin: "12px 0" }} />
            </>
          )}

          {/* Account — Logout only, View Profile removed (tap avatar above instead) */}
          <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "#aab4cc", textTransform: "uppercase", letterSpacing: "0.8px", padding: "4px 8px 10px" }}>
            Account
          </div>

          <button
            onClick={() => { setShowSettingsDrawer(false); onLogout(); }}
            style={{
              display: "flex", alignItems: "center", gap: 14,
              padding: "13px 14px", borderRadius: 12,
              background: "#fff1f1", border: "none", width: "100%",
              color: "#dc3545", fontWeight: 600, fontSize: "0.95rem",
              cursor: "pointer", textAlign: "left",
            }}
          >
            <span style={{ color: "#dc3545" }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="currentColor" viewBox="0 0 16 16">
                <path d="M6 2a1 1 0 0 1 1-1h3a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H7a1 1 0 0 1-1-1v-1h1v1h3a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1H7v1H6V2z"/>
                <path d="M.146 8.354a.5.5 0 0 1 0-.708l3-3a.5.5 0 1 1 .708.708L1.707 7.5H10.5a.5.5 0 0 1 0 1H1.707l2.147 2.146a.5.5 0 0 1-.708.708l-3-3z"/>
              </svg>
            </span>
            Logout
          </button>
        </div>
      </div>

      {/* ─── PROFILE MODAL ─── */}
      {showProfile && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 1050, backgroundColor: "rgba(5,24,41,0.72)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}
          onClick={() => setShowProfile(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: "#fff", borderRadius: 20, width: "100%", maxWidth: 360, overflow: "hidden", boxShadow: "0 20px 60px rgba(5,24,41,0.35)" }}
          >
            {/* ── Navy gradient header with avatar ── */}
            <div style={{ background: "linear-gradient(135deg,#051829 0%,#0a2d4a 60%,#0d4a6e 100%)", padding: "28px 24px 20px", position: "relative" }}>
              {/* Close */}
              <button
                onClick={() => setShowProfile(false)}
                style={{ position: "absolute", top: 14, right: 14, width: 30, height: 30, borderRadius: "50%", border: "none", background: "rgba(255,255,255,0.12)", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
              {/* Avatar */}
              <div style={{ width: 72, height: 72, borderRadius: "50%", overflow: "hidden", border: "3px solid rgba(201,168,76,0.6)", background: "linear-gradient(135deg,#0a2d4a,#1d6fa4)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12, boxShadow: "0 4px 16px rgba(0,0,0,0.3)" }}>
                {user.profilePhoto
                  ? <img src={user.profilePhoto} alt="profile" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : <span style={{ color: "#e8d5a0", fontWeight: 800, fontSize: "1.1rem", letterSpacing: "0.05em" }}>{user?.username?.toUpperCase()}</span>
                }
              </div>
              {/* Name + company + role */}
              <div style={{ color: "#fff", fontWeight: 700, fontSize: "1.05rem", lineHeight: 1.2 }}>{user.name}</div>
              <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "#c9a84c", marginTop: 3, letterSpacing: "0.03em" }}>trip2explore</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "#e8d5a0", background: "rgba(201,168,76,0.18)", border: "1px solid rgba(201,168,76,0.35)", borderRadius: 99, padding: "2px 10px", textTransform: "capitalize", letterSpacing: "0.04em" }}>
                  {user.type === "backdesk" ? "Agent" : user.type === "onsite" ? "Staff" : user.type?.charAt(0).toUpperCase() + user.type?.slice(1)}
                </span>
                <span style={{ fontSize: "0.68rem", fontWeight: 600, color: user.status === "active" ? "#4ade80" : "#f87171", background: "rgba(255,255,255,0.08)", borderRadius: 99, padding: "2px 10px", textTransform: "capitalize" }}>
                  ● {user.status}
                </span>
              </div>
            </div>

            {/* ── Info rows ── */}
            <div style={{ padding: "18px 20px 8px" }}>
              {[
                { icon: "👤", label: "Username", value: user.username },
              ].map(({ icon, label, value }) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid #f1f5f9" }}>
                  <div style={{ width: 32, height: 32, borderRadius: 9, background: "#eef4fb", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: "0.95rem" }}>{icon}</div>
                  <div>
                    <div style={{ fontSize: "0.62rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
                    <div style={{ fontSize: "0.84rem", fontWeight: 600, color: "#0a2d4a", marginTop: 1 }}>{value}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* ── Action buttons ── */}
            <div style={{ padding: "14px 20px 20px" }}>
              <button
                onClick={() => { setShowProfile(false); setShowEditProfile(true); }}
                style={{ width: "100%", padding: "10px", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#0a2d4a,#1d6fa4)", color: "#fff", fontWeight: 700, fontSize: "0.84rem", cursor: "pointer", boxShadow: "0 4px 14px rgba(29,111,164,0.35)" }}
              >
                Edit Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── EDIT PROFILE SHEET ─── */}
      {showEditProfile && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 1055, backgroundColor: "rgba(5,24,41,0.72)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}
          onClick={() => setShowEditProfile(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="edit-profile-sheet"
            style={{ background: "#fff", width: "100%", maxWidth: 480, borderRadius: "20px 20px 0 0", maxHeight: "92dvh", display: "flex", flexDirection: "column", overflow: "hidden" }}
          >
            {/* ── Navy gradient header ── */}
            <div style={{ background: "linear-gradient(135deg,#051829 0%,#0a2d4a 60%,#0d4a6e 100%)", padding: "20px 20px 24px", position: "relative", flexShrink: 0 }}>
              {/* drag handle */}
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
                <div style={{ width: 36, height: 4, borderRadius: 4, background: "rgba(255,255,255,0.25)" }} />
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ color: "#e8d5a0", fontSize: "0.62rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 2 }}>Account</div>
                  <h6 style={{ margin: 0, fontWeight: 700, fontSize: "1.05rem", color: "#fff" }}>Edit Profile</h6>
                </div>
                {/* Avatar */}
                <div style={{ position: "relative" }}>
                  <div style={{ width: 56, height: 56, borderRadius: "50%", overflow: "hidden", border: "2.5px solid rgba(201,168,76,0.6)", background: "linear-gradient(135deg,#0a2d4a,#1d6fa4)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 3px 12px rgba(0,0,0,0.3)" }}>
                    {editForm.profilePhoto && typeof editForm.profilePhoto !== "string" ? (
                      <img src={URL.createObjectURL(editForm.profilePhoto)} alt="preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : user?.profilePhoto ? (
                      <img src={user.profilePhoto} alt="profile" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <span style={{ fontSize: "0.9rem", fontWeight: 800, color: "#e8d5a0" }}>{user?.username?.toUpperCase()}</span>
                    )}
                  </div>
                  {/* Camera button */}
                  <label htmlFor="profilePhotoInput" style={{ position: "absolute", bottom: -2, right: -2, width: 24, height: 24, borderRadius: "50%", background: "linear-gradient(135deg,#0a2d4a,#1d6fa4)", border: "2px solid rgba(201,168,76,0.5)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" fill="#e8d5a0" viewBox="0 0 16 16">
                      <path d="M15 12a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h1.172a3 3 0 0 0 2.12-.879l.83-.828A1 1 0 0 1 6.828 3h2.344a1 1 0 0 1 .707.293l.828.828A3 3 0 0 0 12.828 5H14a1 1 0 0 1 1 1v6zM2 4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-1.172a2 2 0 0 1-1.414-.586l-.828-.828A2 2 0 0 0 9.172 2H6.828a2 2 0 0 0-1.414.586l-.828.828A2 2 0 0 1 3.172 4H2z"/>
                      <path d="M8 11a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5zm0 1a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z"/>
                    </svg>
                    <input id="profilePhotoInput" type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => setEditForm({ ...editForm, profilePhoto: e.target.files[0] })} />
                  </label>
                </div>
              </div>
              {/* close */}
              <button onClick={() => setShowEditProfile(false)} style={{ position: "absolute", top: 14, right: 16, width: 28, height: 28, borderRadius: "50%", border: "none", background: "rgba(255,255,255,0.12)", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            {/* ── Scrollable body ── */}
            <div style={{ overflowY: "auto", flex: 1, padding: "18px 20px 8px" }}>

              {/* ── Section: Basic Info ── */}
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#c9a84c", flexShrink: 0 }} />
                <span style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.09em", color: "#94a3b8" }}>Basic Info</span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
                {[
                  { placeholder: "Full name", key: "name", type: "text" },
                  { placeholder: "Email address", key: "email", type: "email" },
                  { placeholder: "Mobile number", key: "contact", type: "tel" },
                ].map(({ placeholder, key, type }) => (
                  <div key={key}>
                    <input
                      type={type}
                      placeholder={placeholder}
                      value={editForm[key]}
                      onChange={(e) => setEditForm({ ...editForm, [key]: e.target.value })}
                      style={{ width: "100%", padding: "0.62rem 0.9rem", fontSize: "0.88rem", color: "#0a2d4a", background: "#f8fafc", border: `1.5px solid ${errors[key] ? "#dc2626" : "#e2e8f0"}`, borderRadius: 10, outline: "none", boxSizing: "border-box" }}
                      onFocus={(e) => { if (!errors[key]) e.target.style.borderColor = "#1d6fa4"; e.target.style.boxShadow = "0 0 0 3px rgba(29,111,164,0.1)"; }}
                      onBlur={(e) => { e.target.style.borderColor = errors[key] ? "#dc2626" : "#e2e8f0"; e.target.style.boxShadow = "none"; }}
                    />
                    {errors[key] && <p style={{ fontSize: "0.68rem", color: "#dc2626", margin: "3px 0 0 2px", fontWeight: 500 }}>⚠ {errors[key]}</p>}
                  </div>
                ))}
              </div>

              {/* ── Section: Change Password ── */}
              <div style={{ height: 1, background: "#e8eef5", marginBottom: 14 }} />
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#c9a84c", flexShrink: 0 }} />
                <span style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.09em", color: "#94a3b8" }}>Change Password</span>
                <span style={{ fontSize: "0.65rem", color: "#b0bec5" }}>(optional)</span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
                {[
                  { placeholder: "Current password", key: "currentPassword", show: showCurrentPassword, toggle: () => setShowCurrentPassword(!showCurrentPassword), disabled: false },
                  { placeholder: "New password",      key: "newPassword",     show: showNewPassword,     toggle: () => setShowNewPassword(!showNewPassword),     disabled: !editForm.currentPassword },
                ].map(({ placeholder, key, show, toggle, disabled }) => (
                  <div key={key} style={{ position: "relative" }}>
                    <input
                      type={show ? "text" : "password"}
                      placeholder={placeholder}
                      value={editForm[key]}
                      disabled={disabled}
                      onChange={(e) => setEditForm({ ...editForm, [key]: e.target.value })}
                      style={{ width: "100%", padding: "0.62rem 3rem 0.62rem 0.9rem", fontSize: "0.88rem", color: "#0a2d4a", background: disabled ? "#f1f5f9" : "#f8fafc", border: `1.5px solid ${errors[key] ? "#dc2626" : "#e2e8f0"}`, borderRadius: 10, outline: "none", boxSizing: "border-box", opacity: disabled ? 0.55 : 1 }}
                      onFocus={(e) => { if (!disabled && !errors[key]) { e.target.style.borderColor = "#1d6fa4"; e.target.style.boxShadow = "0 0 0 3px rgba(29,111,164,0.1)"; } }}
                      onBlur={(e) => { e.target.style.borderColor = errors[key] ? "#dc2626" : "#e2e8f0"; e.target.style.boxShadow = "none"; }}
                    />
                    <button type="button" disabled={disabled} onClick={toggle} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", border: "none", background: "none", fontSize: "0.72rem", color: "#1d6fa4", cursor: disabled ? "default" : "pointer", fontWeight: 700, padding: "2px 6px", opacity: disabled ? 0.4 : 1 }}>
                      {show ? "Hide" : "Show"}
                    </button>
                    {errors[key] && <p style={{ fontSize: "0.68rem", color: "#dc2626", margin: "3px 0 0 2px", fontWeight: 500 }}>⚠ {errors[key]}</p>}
                  </div>
                ))}
              </div>

              {/* ── Section: Quick Login PIN ── */}
              <div style={{ height: 1, background: "#e8eef5", marginBottom: 14 }} />
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#c9a84c", flexShrink: 0 }} />
                <span style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.09em", color: "#94a3b8" }}>Quick Login PIN</span>
                <span style={{ fontSize: "0.65rem", color: "#b0bec5" }}>(optional)</span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 8 }}>
                <div style={{ position: "relative" }}>
                  <input
                    type={showPin ? "text" : "password"}
                    inputMode="numeric"
                    placeholder="New 4-digit PIN"
                    maxLength={4}
                    value={pinForm.newPin}
                    onChange={(e) => setPinForm((p) => ({ ...p, newPin: e.target.value.replace(/\D/g, "").slice(0, 4) }))}
                    style={{ width: "100%", padding: "0.62rem 3rem 0.62rem 0.9rem", fontSize: "0.88rem", color: "#0a2d4a", background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: 10, outline: "none", boxSizing: "border-box" }}
                    onFocus={(e) => { e.target.style.borderColor = "#1d6fa4"; e.target.style.boxShadow = "0 0 0 3px rgba(29,111,164,0.1)"; }}
                    onBlur={(e) => { e.target.style.borderColor = "#e2e8f0"; e.target.style.boxShadow = "none"; }}
                  />
                  <button type="button" onClick={() => setShowPin((v) => !v)} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", border: "none", background: "none", fontSize: "0.72rem", color: "#1d6fa4", cursor: "pointer", fontWeight: 700, padding: "2px 6px" }}>
                    {showPin ? "Hide" : "Show"}
                  </button>
                </div>
                <input
                  type={showPin ? "text" : "password"}
                  inputMode="numeric"
                  placeholder="Confirm PIN"
                  maxLength={4}
                  value={pinForm.confirmPin}
                  onChange={(e) => setPinForm((p) => ({ ...p, confirmPin: e.target.value.replace(/\D/g, "").slice(0, 4) }))}
                  style={{ width: "100%", padding: "0.62rem 0.9rem", fontSize: "0.88rem", color: "#0a2d4a", background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: 10, outline: "none", boxSizing: "border-box" }}
                  onFocus={(e) => { e.target.style.borderColor = "#1d6fa4"; e.target.style.boxShadow = "0 0 0 3px rgba(29,111,164,0.1)"; }}
                  onBlur={(e) => { e.target.style.borderColor = "#e2e8f0"; e.target.style.boxShadow = "none"; }}
                />
                {pinForm.newPin.length > 0 && pinForm.confirmPin.length > 0 && pinForm.newPin !== pinForm.confirmPin && (
                  <p style={{ fontSize: "0.72rem", color: "#dc2626", margin: "0 0 0 2px", fontWeight: 500 }}>⚠ PINs do not match</p>
                )}
              </div>

            </div>

            {/* ── Footer ── */}
            <div style={{ padding: "12px 20px 20px", borderTop: "1px solid #e8eef5", display: "flex", gap: 10, background: "#fff", flexShrink: 0 }}>
              <button
                onClick={() => setShowEditProfile(false)}
                style={{ flex: 1, borderRadius: 10, fontWeight: 600, fontSize: "0.88rem", border: "1.5px solid #e2e8f0", background: "#f8fafc", color: "#64748b", padding: "11px 0", cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                onClick={handleCombinedUpdate}
                disabled={pinLoading}
                style={{ flex: 2, borderRadius: 10, fontWeight: 700, fontSize: "0.88rem", border: "none", background: "linear-gradient(135deg,#0a2d4a,#1d6fa4)", color: "#fff", padding: "11px 0", cursor: pinLoading ? "not-allowed" : "pointer", opacity: pinLoading ? 0.7 : 1, boxShadow: "0 4px 14px rgba(29,111,164,0.35)", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
              >
                {pinLoading ? (
                  <><span style={{ width: 15, height: 15, border: "2px solid rgba(255,255,255,0.35)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "spin 0.6s linear infinite" }} /> Saving…</>
                ) : "Save Changes"}
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  );
}

export default Navbar;