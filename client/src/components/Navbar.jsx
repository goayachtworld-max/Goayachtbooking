import React, { useRef, useState, useEffect } from "react";
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
  const [showSettingsDrawer, setShowSettingsDrawer] = useState(false);

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

  const handleProfileUpdate = async () => {
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
      toast.success("Profile updated successfully 🎉");
      setShowEditProfile(false);
      setShowProfile(false);
    } catch (err) {
      toast.error("Profile update failed ❌");
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

  const currentMonth = new Date().toISOString().slice(0, 7);
  const isActive = (path) => location.pathname === path;

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
      label: "Yacht Master",
      to: "/all-yachts",
      path: "/all-yachts",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="currentColor" viewBox="0 0 16 16">
          <path d="M8.354 1.146a.5.5 0 0 0-.708 0l-6 6A.5.5 0 0 0 1.5 7.5v7a.5.5 0 0 0 .5.5h4.5v-4h3v4H14a.5.5 0 0 0 .5-.5v-7a.5.5 0 0 0-.146-.354L8.354 1.146z"/>
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

  const bottomBarPaths = ["/bookings", "/availability", "/grid-availability"];
  const bottomBarCoreItems = allNavItems.filter((item) => bottomBarPaths.includes(item.path));
  const bottomBarItems = user?.type === "admin"
    ? [homeItem, ...bottomBarCoreItems]
    : bottomBarCoreItems;

  const drawerItems = allNavItems.filter((item) => !bottomBarPaths.includes(item.path));

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
        <span style={{ color: "#fff", fontWeight: 700, fontSize: size * 0.36 }}>{getInitials(user?.name)}</span>
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
      {/* ─── DESKTOP TOP NAVBAR (hidden on mobile) ─── */}
      <nav
        className="navbar navbar-expand-lg position-fixed w-100 d-none d-lg-flex"
        style={{
          top: 0, left: 0, zIndex: 1030,
          background: "linear-gradient(90deg, #0d6efd 0%, #0b5ed7 100%)",
          boxShadow: "0 2px 12px rgba(13,110,253,0.25)",
          height: "60px",
        }}
      >
        <div className="container-fluid px-4">
          <Link
            className="navbar-brand fw-bold text-white me-4"
            style={{ letterSpacing: "0.5px", fontSize: "1.15rem", flexShrink: 0 }}
            to="/"
          >
            {user.type === "admin" ? "Dashboard" : "Boating Assistance"}
          </Link>

          <div className="collapse navbar-collapse" id="navbarNav" ref={collapseRef}>
            <ul className="navbar-nav me-auto mb-0">
              {allNavItems.map((item) => (
                <li className="nav-item" key={item.path}>
                  <Link
                    className={`nav-link text-white px-3 py-2 ${styles.navHover || ""}`}
                    style={{
                      borderRadius: "8px",
                      fontWeight: isActive(item.path) ? 600 : 400,
                      background: isActive(item.path) ? "rgba(255,255,255,0.18)" : "transparent",
                      transition: "background 0.15s",
                      fontSize: "0.92rem",
                    }}
                    to={item.to}
                    onClick={handleNavLinkClick}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>

            <div className="d-flex align-items-center gap-2">
              <ProfileAvatar size={38} />
              <button
                className="btn d-flex align-items-center justify-content-center"
                style={{
                  width: 38, height: 38,
                  borderRadius: "50%",
                  background: "rgba(255,255,255,0.12)",
                  border: "1.5px solid rgba(255,255,255,0.35)",
                  color: "#fff",
                }}
                onClick={onLogout}
                title="Logout"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M6 2a1 1 0 0 1 1-1h3a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H7a1 1 0 0 1-1-1v-1h1v1h3a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1H7v1H6V2z"/>
                  <path d="M.146 8.354a.5.5 0 0 1 0-.708l3-3a.5.5 0 1 1 .708.708L1.707 7.5H10.5a.5.5 0 0 1 0 1H1.707l2.147 2.146a.5.5 0 0 1-.708.708l-3-3z"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* ─── MOBILE TOP BAR ─── */}
      <nav
        className="d-flex d-lg-none align-items-center justify-content-between position-fixed w-100 px-3"
        style={{
          top: 0, left: 0, zIndex: 1030,
          background: "linear-gradient(90deg, #0d6efd 0%, #0b5ed7 100%)",
          boxShadow: "0 2px 10px rgba(13,110,253,0.3)",
          height: "56px",
        }}
      >
        <Link className="fw-bold text-white" style={{ fontSize: "1.05rem", textDecoration: "none", letterSpacing: "0.4px" }} to="/">
          {user.type === "admin" ? "Dashboard" : "Boating Assistance"}
        </Link>

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
          className="d-flex d-lg-none position-fixed w-100"
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
        className="d-lg-none"
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
        className="d-lg-none"
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
              background: user?.profilePhoto ? "transparent" : "linear-gradient(135deg,#0d6efd,#0b5ed7)",
              display: "flex", alignItems: "center", justifyContent: "center",
              overflow: "hidden", border: "2px solid #e8f0fe", flexShrink: 0,
            }}>
              {user?.profilePhoto ? (
                <img src={user.profilePhoto} alt="profile" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <span style={{ color: "#fff", fontWeight: 700, fontSize: "1rem" }}>{getInitials(user?.name)}</span>
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
              border: "none", background: "#f0f4ff", borderRadius: "50%",
              width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center",
              color: "#0d6efd", cursor: "pointer", flexShrink: 0,
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
          {drawerItems.length > 0 && (
            <>
              <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "#aab4cc", textTransform: "uppercase", letterSpacing: "0.8px", padding: "4px 8px 10px" }}>
                Navigation
              </div>
              {drawerItems.map((item) => {
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
        <div className="modal fade show" style={{ display: "block", backgroundColor: "rgba(0,0,0,0.55)" }} onClick={() => setShowProfile(false)}>
          <div className="modal-dialog modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content shadow-lg" style={{ borderRadius: "16px", overflow: "hidden", border: "none" }}>
              <div className="modal-header text-white" style={{ background: "linear-gradient(90deg,#0d6efd,#0b5ed7)", border: "none" }}>
                <h5 className="modal-title">My Profile</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowProfile(false)}></button>
              </div>
              <div className="modal-body text-center py-4">
                <img
                  src={user.profilePhoto ? user.profilePhoto : `https://ui-avatars.com/api/?name=${user.name}&background=random`}
                  alt="profile"
                  className="rounded-circle mb-3 shadow-sm"
                  width="90" height="90"
                  style={{ objectFit: "cover", border: "3px solid #e8f0fe" }}
                />
                <h5 className="mb-0">{user.name}</h5>
                <p className="text-muted mb-3" style={{ fontSize: "0.88rem" }}>
                  {user.type === "backdesk" ? "Agent" : user.type === "onsite" ? "Staff" : user.type.charAt(0).toUpperCase() + user.type.slice(1)}
                </p>
                <hr />
                <div className="text-start px-2" style={{ fontSize: "0.9rem" }}>
                  <p><strong>Username:</strong> {user.username}</p>
                  <p><strong>Email:</strong> {user.email}</p>
                  <p><strong>Contact:</strong> {user.contact}</p>
                  <p className="mb-0"><strong>Status:</strong> {user.status}</p>
                </div>
              </div>
              <div className="modal-footer" style={{ border: "none" }}>
                <button className="btn btn-outline-primary" onClick={() => { setShowProfile(false); setShowEditProfile(true); }}>Edit Profile</button>
                <button className="btn btn-danger btn-sm ms-auto" onClick={() => { setShowProfile(false); onLogout(); }} title="Logout">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16" className="me-1">
                    <path d="M6 2a1 1 0 0 1 1-1h3a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H7a1 1 0 0 1-1-1v-1h1v1h3a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1H7v1H6V2z"/>
                    <path d="M.146 8.354a.5.5 0 0 1 0-.708l3-3a.5.5 0 1 1 .708.708L1.707 7.5H10.5a.5.5 0 0 1 0 1H1.707l2.147 2.146a.5.5 0 0 1-.708.708l-3-3z"/>
                  </svg>
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── EDIT PROFILE MODAL ─── */}
      {showEditProfile && (
        <div className="modal fade show" style={{ display: "block", backgroundColor: "rgba(0,0,0,0.55)" }} onClick={() => setShowEditProfile(false)}>
          <div className="modal-dialog modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content shadow-lg" style={{ borderRadius: "16px", overflow: "hidden", border: "none" }}>
              <div className="modal-header bg-warning">
                <h5 className="modal-title">Edit Profile</h5>
                <button type="button" className="btn-close" onClick={() => setShowEditProfile(false)}></button>
              </div>
              <div className="modal-body">
                <input className={`form-control mb-2 ${errors.name ? "is-invalid" : ""}`} placeholder="Name" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                {errors.name && <div className="text-danger small mb-2">{errors.name}</div>}

                <input className={`form-control mb-2 ${errors.email ? "is-invalid" : ""}`} placeholder="Email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
                {errors.email && <div className="text-danger small mb-2">{errors.email}</div>}

                <input className={`form-control mb-3 ${errors.contact ? "is-invalid" : ""}`} placeholder="Contact" value={editForm.contact} onChange={(e) => setEditForm({ ...editForm, contact: e.target.value })} />
                {errors.contact && <div className="text-danger small mb-3">{errors.contact}</div>}

                <div className="mb-3 text-start">
                  <label className="form-label fw-semibold">Profile Photo</label>
                  <input type="file" className="form-control" accept="image/*" onChange={(e) => setEditForm({ ...editForm, profilePhoto: e.target.files[0] })} />
                </div>

                <hr />

                <div className="input-group mb-2">
                  <input type={showCurrentPassword ? "text" : "password"} className={`form-control ${errors.currentPassword ? "is-invalid" : ""}`} placeholder="Current Password" value={editForm.currentPassword} onChange={(e) => setEditForm({ ...editForm, currentPassword: e.target.value })} />
                  <button className="btn btn-outline-secondary" type="button" onClick={() => setShowCurrentPassword(!showCurrentPassword)}>{showCurrentPassword ? "Hide" : "Show"}</button>
                </div>
                {errors.currentPassword && <div className="text-danger small mb-2">{errors.currentPassword}</div>}

                <div className="input-group">
                  <input type={showNewPassword ? "text" : "password"} className={`form-control ${errors.newPassword ? "is-invalid" : ""}`} placeholder="New Password" value={editForm.newPassword} disabled={!editForm.currentPassword} onChange={(e) => setEditForm({ ...editForm, newPassword: e.target.value })} />
                  <button className="btn btn-outline-secondary" type="button" disabled={!editForm.currentPassword} onClick={() => setShowNewPassword(!showNewPassword)}>{showNewPassword ? "Hide" : "Show"}</button>
                </div>
                {errors.newPassword && <div className="text-danger small mt-1">{errors.newPassword}</div>}
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setShowEditProfile(false)}>Cancel</button>
                <button className="btn btn-success" onClick={handleProfileUpdate}>Update</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default Navbar;