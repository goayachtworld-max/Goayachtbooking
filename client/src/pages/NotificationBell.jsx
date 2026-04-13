import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { socket } from "../socket";
import { getNotificationsAPI } from "../services/operations/notificationAPI";
import "../styles/NavbarNotification.css";

export default function NotificationBell() {
    const [unreadCount, setUnreadCount] = useState(0);
    const navigate = useNavigate();
    const user = JSON.parse(localStorage.getItem("user"));
    const userId = user?._id;

    const fetchCount = async () => {
        try {
            const token = localStorage.getItem("authToken");
            const res = await getNotificationsAPI(token);
            const notifications = res.data.notifications || [];
            const count = notifications.filter(
                (n) => !n.readBy?.some((id) => id.toString() === userId)
            ).length;
            setUnreadCount(count);
        } catch (err) {
            console.error("Failed to fetch notifications", err);
        }
    };

    useEffect(() => {
        fetchCount();

        socket.on("notification:new", () => {
            setUnreadCount((prev) => prev + 1);
        });

        return () => {
            socket.off("notification:new");
        };
    }, []);

    return (
        <button
            className={`nb-bell${unreadCount > 0 ? " nb-bell--unread" : ""}`}
            onClick={() => navigate("/notifications")}
            title="Notifications"
        >
            <svg
                className="nb-icon"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
            >
                <path
                    d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
                <path
                    d="M13.73 21a2 2 0 0 1-3.46 0"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </svg>

            {unreadCount > 0 && (
                <span className="nb-badge">
                    {unreadCount > 99 ? "99+" : unreadCount}
                </span>
            )}
        </button>
    );
}
