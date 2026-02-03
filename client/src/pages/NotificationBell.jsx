import React, { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { Bell } from "lucide-react";
import { socket } from "../socket";
import {
    getNotificationsAPI,
    markAllNotificationsReadAPI,
    markNotificationReadAPI,
} from "../services/operations/notificationAPI";
import "../styles/NavbarNotification.css";
import { useNavigate } from "react-router-dom";

export default function NotificationBell() {
    const [open, setOpen] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const bellRef = useRef(null);
    const navigate = useNavigate();
    const user = JSON.parse(localStorage.getItem("user"));
    const userId = user?._id;

    const unreadCount = notifications.filter(
        (n) => !n.readBy?.includes(userId)
    ).length;

    const location = useLocation();

    const handleBellClick = () => {
        setOpen((prev) => !prev);

        // 🔥 If already on /bookings (or /bookings/anything)
        if (location.pathname.startsWith("/bookings")) {
            navigate(".", {
                replace: true,
                state: {
                    refresh: Date.now(), // force refresh
                },
            });
        }
    };


    /* ---------------- FETCH EXISTING ---------------- */
    const fetchNotifications = async () => {
        try {
            const token = localStorage.getItem("authToken");
            const res = await getNotificationsAPI(token);
            console.log("fetch : ", res)
            setNotifications(res.data.notifications || []);
        } catch (err) {
            console.error("Failed to fetch notifications", err);
        }
    };

    /* ---------------- SOCKET ---------------- */
    useEffect(() => {
        fetchNotifications();

        socket.on("notification:new", (data) => {
            setNotifications((prev) => [data, ...prev]);
        });

        return () => {
            socket.off("notification:new");
        };
    }, []);

    /* ---------------- CLICK OUTSIDE ---------------- */
    useEffect(() => {
        const handler = (e) => {
            if (bellRef.current && !bellRef.current.contains(e.target)) {
                setOpen(false);
            }
        };

        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    const handleNotificationClick = async (notification) => {
        const bookingId = notification.bookingId;


        if (bookingId) {
            navigate("/bookings", {
                state: {
                    refresh: Date.now(),
                    bookingId,
                    status: notification.title.toUpperCase().includes("CANCELLED")
                        ? "cancelled"
                        : notification.title.toUpperCase().includes("CONFIRMED")
                            ? "confirmed"
                            : "",
                },
            });

        }

        // mark as read
        if (!notification.readBy?.includes(userId)) {
            await markAsRead(notification._id);
        }

        setOpen(false); // optional: close dropdown
    };

    const handleMarkAllRead = async () => {
        try {
            const token = localStorage.getItem("authToken");
            await markAllNotificationsReadAPI(token);

            // 🔥 Update UI instantly
            setNotifications((prev) =>
                prev.map((n) =>
                    n.readBy?.includes(userId)
                        ? n
                        : { ...n, readBy: [...(n.readBy || []), userId] }
                )
            );
        } catch (err) {
            console.error("Failed to mark all as read", err);
        }
    };

    /* ---------------- MARK AS READ ---------------- */
    const markAsRead = async (id) => {
        try {
            const token = localStorage.getItem("authToken");
            await markNotificationReadAPI(id, token);


            setNotifications((prev) =>
                prev.map((n) =>
                    n._id === id
                        ? { ...n, readBy: [...(n.readBy || []), userId] }
                        : n
                )
            );
        } catch (err) {
            console.error("Failed to mark notification as read", err);
        }
    };

    return (
        <div className="nav-notification" ref={bellRef}>
            <button
                className="btn btn-link position-relative"
                onClick={handleBellClick}
            >
                <Bell size={30} fill="rgb(245, 245, 142)" />

                {unreadCount > 0 && (
                    <span className="badge bg-danger notification-badge">
                        {unreadCount}
                    </span>
                )}
            </button>

            {open && (
                <div className="notification-dropdown shadow">

                    {/* ---------- HEADER ---------- */}
                    <div className="notification-header">
                        <span className="notification-title">Notifications</span>

                        {unreadCount > 0 && (
                            <button
                                className="mark-all-btn"
                                onClick={handleMarkAllRead}
                            >
                                Mark all read
                            </button>
                        )}
                    </div>

                    {/* ---------- EMPTY STATE ---------- */}
                    {notifications.length === 0 && (
                        <p className="text-muted text-center m-2">
                            No notifications
                        </p>
                    )}

                    {/* ---------- NOTIFICATION LIST ---------- */}
                    {notifications.map((n) => (
                        <div
                            key={n._id}
                            className={`notification-item
    ${n.readBy?.some(id => id.toString() === userId) ? "read" : "unread"}
    ${n.title.toUpperCase().includes("CONFIRMED") &&
                                    (n.type === "booking_created" || n.type === "booking_status_updated")
                                    ? "booked"
                                    : ""
                                }
    ${n.type === "booking_created" &&
                                    !n.title.toUpperCase().includes("CONFIRMED")
                                    ? "pending"
                                    : ""
                                }
    ${n.type === "slot_locked" ? "locked" : ""}
    ${n.type === "booking_status_updated" &&
                                    n.title.toUpperCase().includes("CANCELLED")
                                    ? "cancelled"
                                    : ""
                                }
  `}
                            onClick={() => handleNotificationClick(n)}
                        >

                            <strong>{n.title}</strong>
                            <p className="mb-0">{n.message}</p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );

}
