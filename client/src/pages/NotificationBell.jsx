import React, { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { socket } from "../socket";
import {
    getNotificationsAPI,
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
            const searchValue = bookingId.slice(-5);
            // navigate(`/bookings?search=${searchValue}`, {
            //     replace: false,
            //     state: {
            //         refresh: Date.now(),
            //     },
            // });

            navigate("/bookings", {
                state: {
                    refresh: Date.now(),   // 🔥 FORCE refresh every click
                    bookingId,             // optional (if you want auto-select later)
                },
            });
        }

        // mark as read
        if (!notification.readBy?.includes(userId)) {
            await markAsRead(notification._id);
        }

        setOpen(false); // optional: close dropdown
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
                onClick={() => setOpen((prev) => !prev)}
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
                    {notifications.length === 0 && (
                        <p className="text-muted text-center m-2">
                            No notifications
                        </p>
                    )}

                    {notifications.map((n) => (
                        <div
                            key={n._id}
                            className={`notification-item ${n.readBy?.includes(userId) ? "read" : "unread"
                                }`}
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
