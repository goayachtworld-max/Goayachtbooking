import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
    getNotificationsAPI,
    markAllNotificationsReadAPI,
    markNotificationReadAPI,
} from "../services/operations/notificationAPI";
import "../styles/NotificationsPage.css";

/* ── SVG icon set ────────────────────────────────────────────── */
const Icons = {
    confirmed: (
        <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="1.6"/>
            <path d="M6 10.5l2.5 2.5 5.5-5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
    ),
    cancelled: (
        <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="1.6"/>
            <path d="M7 7l6 6M13 7l-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
        </svg>
    ),
    slotBlocked: (
        <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="2" y="4" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.6"/>
            <path d="M2 8h16" stroke="currentColor" strokeWidth="1.4"/>
            <path d="M6 2v3M14 2v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            <path d="M7 12h6M10 10v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
    ),
    pending: (
        <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="1.6"/>
            <path d="M10 5v5l3 3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
    ),
    info: (
        <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="1.6"/>
            <path d="M10 9v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            <circle cx="10" cy="6.5" r="0.9" fill="currentColor"/>
        </svg>
    ),
    clock: (
        <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3"/>
            <path d="M8 4.5v3.5l2 2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
    ),
    calendar: (
        <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="1.5" y="3" width="13" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
            <path d="M1.5 6.5h13" stroke="currentColor" strokeWidth="1.2"/>
            <path d="M5 1.5v2M11 1.5v2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
        </svg>
    ),
};

/* ── message detail parser ───────────────────────────────────── */
const yachtSVG = (
    <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M8 2v8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
        <path d="M8 2l5 5H3L8 2z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
        <path d="M2 13s1.5-1.5 3-1.5S7.5 13 9 13s2-1.5 3.5-1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
);

const slotSVG = (
    <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3"/>
        <path d="M8 4.5v3.5l2 2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
);

function parseMessageDetails(message) {
    if (!message) return null;
    const lines = message.split(/\n|,/).map((l) => l.trim()).filter(Boolean);
    let yacht = null;
    let date = null;
    let time = null;

    lines.forEach((line) => {
        // yacht line
        if (!yacht && /^(MV|SV|YV|RV|SS)\s/i.test(line)) yacht = line;
        if (!yacht && /yacht[:\s]+(.+)/i.test(line)) {
            const m = line.match(/yacht[:\s]+(.+)/i);
            if (m) yacht = m[1].trim();
        }
        // date+time line e.g. "2026-04-05 16:00 – 18:00"
        if (!date && /\d{4}-\d{2}-\d{2}/.test(line)) {
            const dm = line.match(/(\d{4}-\d{2}-\d{2})/);
            if (dm) date = dm[1];
            const tm = line.match(/(\d{1,2}:\d{2}\s*[–\-]\s*\d{1,2}:\d{2})/);
            if (tm) time = tm[1].trim();
        }
        // time-only line e.g. "16:00 – 18:00"
        if (!time && /\d{1,2}:\d{2}\s*(–|-|to)\s*\d{1,2}:\d{2}/i.test(line)) {
            const tm = line.match(/(\d{1,2}:\d{2}\s*[–\-]\s*\d{1,2}:\d{2})/);
            if (tm) time = tm[1].trim();
        }
    });

    if (!yacht && !date && !time) return null;
    return { yacht, date, time };
}

/* ── helpers ─────────────────────────────────────────────────── */
function dateLabel(dateStr) {
    const d = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    const sameDay = (a, b) =>
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate();
    if (sameDay(d, today)) return "Today";
    if (sameDay(d, yesterday)) return "Yesterday";
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function groupByDate(notifications) {
    const map = {};
    notifications.forEach((n) => {
        const label = dateLabel(n.createdAt);
        if (!map[label]) map[label] = [];
        map[label].push(n);
    });
    return map;
}

function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString("en-IN", {
        day: "2-digit", month: "short", year: "numeric",
    });
}

function formatTime(dateStr) {
    return new Date(dateStr).toLocaleTimeString("en-IN", {
        hour: "2-digit", minute: "2-digit", hour12: true,
    });
}

function typeInfo(n) {
    const title = (n.title || "").toUpperCase();
    if (
        title.includes("CANCELLED") ||
        (n.type === "booking_status_updated" && title.includes("CANCEL"))
    )
        return { color: "#e74c3c", bg: "#fff0f0", label: "Cancelled", icon: Icons.cancelled };
    if (
        title.includes("CONFIRMED") ||
        (n.type === "booking_created" && title.includes("CONFIRM"))
    )
        return { color: "#16a34a", bg: "#f0fdf4", label: "Confirmed", icon: Icons.confirmed };
    if (n.type === "slot_locked")
        return { color: "#d97706", bg: "#fffbeb", label: "Slot Blocked", icon: Icons.slotBlocked };
    if (n.type === "booking_created" || title.includes("PENDING"))
        return { color: "#0984e3", bg: "#eff6ff", label: "Pending", icon: Icons.pending };
    return { color: "#64748b", bg: "#f8fafc", label: "Info", icon: Icons.info };
}

/* ── component ───────────────────────────────────────────────── */
export default function NotificationsPage() {
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showUnreadOnly, setShowUnreadOnly] = useState(false);
    const navigate = useNavigate();

    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const userId = user?._id;

    const unreadCount = notifications.filter(
        (n) => !n.readBy?.some((id) => id.toString() === userId)
    ).length;

    const fetch = useCallback(async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem("authToken");
            const res = await getNotificationsAPI(token);
            setNotifications(res.data.notifications || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetch(); }, [fetch]);

    const markAsRead = async (n) => {
        if (n.readBy?.some((id) => id.toString() === userId)) return;
        try {
            const token = localStorage.getItem("authToken");
            await markNotificationReadAPI(n._id, token);
            setNotifications((prev) =>
                prev.map((x) =>
                    x._id === n._id
                        ? { ...x, readBy: [...(x.readBy || []), userId] }
                        : x
                )
            );
        } catch (err) { console.error(err); }
    };

    const markAllRead = async () => {
        try {
            const token = localStorage.getItem("authToken");
            await markAllNotificationsReadAPI(token);
            setNotifications((prev) =>
                prev.map((n) =>
                    n.readBy?.some((id) => id.toString() === userId)
                        ? n
                        : { ...n, readBy: [...(n.readBy || []), userId] }
                )
            );
        } catch (err) { console.error(err); }
    };

    const handleClick = async (n) => {
        await markAsRead(n);
        if (n.bookingId) {
            navigate("/bookings", {
                state: {
                    refresh: Date.now(),
                    bookingId: n.bookingId,
                    status: (n.title || "").toUpperCase().includes("CANCELLED")
                        ? "cancelled"
                        : (n.title || "").toUpperCase().includes("CONFIRMED")
                            ? "confirmed"
                            : "",
                },
            });
        }
    };

    const displayedNotifications = showUnreadOnly
        ? notifications.filter((n) => !n.readBy?.some((id) => id.toString() === userId))
        : notifications;

    const grouped = groupByDate(displayedNotifications);
    const dateKeys = Object.keys(grouped);

    return (
        <div className="npage-root">
            {/* ── sticky top bar ── */}
            <div className="npage-topbar">
                <div className="npage-topbar-left">
                    <button
                        className={`npage-unread-toggle${showUnreadOnly ? " active" : ""}`}
                        onClick={() => setShowUnreadOnly((v) => !v)}
                    >
                        <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" width="12" height="12">
                            <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.4"/>
                            {showUnreadOnly
                                ? <circle cx="8" cy="8" r="3" fill="currentColor"/>
                                : <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.3"/>
                            }
                        </svg>
                        Unread{unreadCount > 0 && <span className="npage-toggle-count">{unreadCount}</span>}
                    </button>
                </div>
                {unreadCount > 0 && (
                    <button className="npage-markall" onClick={markAllRead}>
                        Mark all read
                    </button>
                )}
            </div>

            {/* ── body ── */}
            {loading ? (
                <div className="npage-empty">
                    <div className="npage-spinner" />
                    <span>Loading…</span>
                </div>
            ) : displayedNotifications.length === 0 ? (
                <div className="npage-empty">
                    <svg width="56" height="56" viewBox="0 0 24 24" fill="none" className="npage-empty-icon">
                        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" stroke="#c0cad5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="#c0cad5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <p className="npage-empty-text">{showUnreadOnly ? "All caught up!" : "You're all caught up!"}</p>
                    <span className="npage-empty-sub">{showUnreadOnly ? "No unread notifications" : "No notifications yet"}</span>
                </div>
            ) : (
                <div className="npage-list">
                    {dateKeys.map((dateKey) => (
                        <div key={dateKey} className="npage-group">
                            <div className="npage-date-label">
                                <span className="npage-date-label-icon">{Icons.calendar}</span>
                                {dateKey}
                            </div>

                            {grouped[dateKey].map((n) => {
                                const isRead = n.readBy?.some((id) => id.toString() === userId);
                                const info = typeInfo(n);
                                return (
                                    <div
                                        key={n._id}
                                        className={`npage-item${isRead ? "" : " npage-item--unread"}`}
                                        style={{ "--accent": info.color }}
                                        onClick={() => handleClick(n)}
                                    >
                                        {/* accent bar */}
                                        <div className="npage-accent" />

                                        {/* type icon */}
                                        <div
                                            className="npage-type-icon"
                                            style={{ background: info.color + "1a", color: info.color }}
                                        >
                                            {info.icon}
                                        </div>

                                        {/* content */}
                                        <div className="npage-content">
                                            <div className="npage-item-top">
                                                <span className="npage-item-title">{n.title}</span>
                                                <span
                                                    className="npage-type-chip"
                                                    style={{ background: info.color + "1a", color: info.color }}
                                                >
                                                    {info.label}
                                                </span>
                                            </div>

                                            {(() => {
                                                const details = parseMessageDetails(n.message);
                                                if (!details) return null;
                                                return (
                                                    <div className="npage-detail-card" style={{ borderColor: info.color + "40" }}>
                                                        {details.yacht && (
                                                            <div className="npage-detail-row">
                                                                <span className="npage-detail-icon" style={{ color: info.color }}>{yachtSVG}</span>
                                                                <span className="npage-detail-text">{details.yacht}</span>
                                                            </div>
                                                        )}
                                                        {(details.date || details.time) && (
                                                            <div className="npage-detail-row npage-detail-row--inline">
                                                                {details.date && (
                                                                    <span className="npage-detail-inline-item">
                                                                        <span className="npage-detail-icon" style={{ color: info.color }}>{Icons.calendar}</span>
                                                                        <span className="npage-detail-text">{details.date}</span>
                                                                    </span>
                                                                )}
                                                                {details.time && (
                                                                    <span className="npage-detail-inline-item">
                                                                        <span className="npage-detail-icon" style={{ color: info.color }}>{slotSVG}</span>
                                                                        <span className="npage-detail-text">{details.time}</span>
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })()}

                                            <div className="npage-item-meta">
                                                <span className="npage-meta-item">
                                                    <span className="npage-meta-icon">{Icons.calendar}</span>
                                                    {formatDate(n.createdAt)}
                                                </span>
                                                <span className="npage-meta-sep">·</span>
                                                <span className="npage-meta-item">
                                                    <span className="npage-meta-icon">{Icons.clock}</span>
                                                    {formatTime(n.createdAt)}
                                                </span>
                                            </div>
                                        </div>

                                        {/* unread dot */}
                                        {!isRead && <div className="npage-unread-dot" />}
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
