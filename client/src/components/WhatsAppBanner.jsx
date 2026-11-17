// A small warning at the top of Bookings when this user's WhatsApp is not set up,
// because customers then get no automatic booking messages.
// Shown to admins (company number) and agents (own number) only.
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getWhatsAppOverviewAPI } from "../services/operations/whatsappAPI";

const NEEDS_ACTION = ["not_linked", "failed", "stopped"];
const DISMISS_KEY = "waBannerDismissed";

export default function WhatsAppBanner({ user }) {
  const navigate = useNavigate();
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!user || (user.type !== "admin" && user.type !== "backdesk")) return;
    if (sessionStorage.getItem(DISMISS_KEY)) return;

    let cancelled = false;
    getWhatsAppOverviewAPI(localStorage.getItem("authToken"))
      .then((res) => {
        const data = res.data;
        if (cancelled || !data?.live) return; // dev mode: nothing to warn about
        if (data.role === "admin") {
          const bad = (data.companies || []).filter((c) => NEEDS_ACTION.includes(c.state));
          if (bad.length) {
            setMessage(
              `WhatsApp is not connected for ${bad.map((c) => c.label).join(", ")}. Customers will not get automatic booking messages.`
            );
          }
        } else if (data.me && NEEDS_ACTION.includes(data.me.state)) {
          setMessage(
            "Your WhatsApp is not connected. Your customers will not get automatic booking messages until you link it."
          );
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!message) return null;

  return (
    <div
      role="alert"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        flexWrap: "wrap",
        background: "#fffbeb",
        border: "1px solid #fcd34d",
        borderLeft: "4px solid #f59e0b",
        color: "#78350f",
        borderRadius: 8,
        padding: "10px 14px",
        margin: "8px 0 12px",
        fontSize: "0.85rem",
      }}
    >
      <span style={{ flex: 1, minWidth: 220 }}>⚠️ {message}</span>
      <button
        type="button"
        onClick={() => navigate("/whatsapp")}
        style={{ background: "#0a2d4a", color: "#fff", border: "none", borderRadius: 6, padding: "6px 12px", fontWeight: 600, cursor: "pointer" }}
      >
        Set up WhatsApp
      </button>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => {
          sessionStorage.setItem(DISMISS_KEY, "1");
          setMessage("");
        }}
        style={{ background: "none", border: "none", color: "#78350f", cursor: "pointer", fontSize: "1.1rem", lineHeight: 1 }}
      >
        ×
      </button>
    </div>
  );
}
