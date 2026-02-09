import React, { useState } from "react";
import { FiEye, FiEyeOff, FiUser, FiLock } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { loginAPI } from "../services/operations/authAPI";
import styles from "../styles/Login.module.css";
import { FiSearch } from "react-icons/fi";
import toast from "react-hot-toast";
import { getPublicBookingByIdAPI } from "../services/operations/bookingAPI";
import { PDFDownloadLink } from "@react-pdf/renderer";
import BoardingPassPDF from "./BoardingPassPDF";

function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const [ticket, setTicket] = useState("");
  const [searching, setSearching] = useState(false);
  const [boardingPassBooking, setBoardingPassBooking] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const handleTicketChange = (e) => {
    let value = e.target.value.toUpperCase();
    // if (!value.startsWith("#")) value = "#";
    if (value.length > 6) return;
    setTicket(value);
  };
  const handleTicketSearch = async () => {
    const cleanTicket = ticket.replace("#", "");
    if (cleanTicket.length !== 5) {
      toast.error("Enter a valid ticket number");
      return;
    }

    try {
      setSearching(true);

      const res = await getPublicBookingByIdAPI(cleanTicket);
      const booking = res.data.booking;

      // Open modal instead of navigating
      setBoardingPassBooking(booking);
      setShowModal(true);

    } catch (err) {
      toast.error(err?.response?.data?.message || "Booking not found");
    } finally {
      setSearching(false);
    }
  };



  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await loginAPI(username, password);

      if (
        response.status === 200 &&
        response.data &&
        response.data.employee &&
        response.data.token
      ) {
        const { employee, token } = response.data;

        localStorage.setItem("authToken", token);
        onLogin({ ...employee, token });

        if (employee.type === "admin") navigate("/admin");
        else navigate("/bookings");
      } else {
        setError("Login failed. Please try again.");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Login failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const generateBoardingPassText = (booking) => {
    const formatDate = (dateStr) => {
      const d = new Date(dateStr);
      return d.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    };

    const formatTime = (time24) => {
      let [h, m] = time24.split(":").map(Number);
      const period = h >= 12 ? "PM" : "AM";
      h = h % 12 || 12;
      return `${h}.${m.toString().padStart(2, "0")} ${period}`;
    };

    const tokenPaid = booking.quotedAmount - booking.pendingAmount;

    const inclusions = booking.extraDetails
      ? booking.extraDetails
        .split("\n")
        .filter((i) =>
          ["Soft Drink", "Ice Cube", "Water Bottles", "Bluetooth Speaker", "Captain", "Snacks"]
            .some((k) => i.includes(k))
        )
      : [];

    const paidServices = booking.extraDetails
      ? booking.extraDetails
        .split("\n")
        .filter((i) =>
          ["Drone", "DSLR"].some((k) => i.includes(k))
        )
      : [];
    const notes = booking.extraDetails
      ? booking.extraDetails.split("Notes:").slice(1).join("Notes:").trim()
      : "";
    const tktNum = `${booking._id.slice(-5).toUpperCase()}`
    const guestName = `${booking.customerId?.name}`
    const contactNum = `${booking.customerId?.contact}`
    const hardCodedDisclaimer = `Disclaimer:
• Reporting time is 30 minutes prior to departure
• No refund for late arrival or no-show
• Subject to weather and government regulations
Thank you for booking with ${booking.company?.name}`

    return `
# Ticket Number: ${tktNum}
Booking Status: ${booking.status.toUpperCase()}

👤 Guest Name: ${guestName}
📞 Contact No.: ${contactNum}
👥 Group Size: ${booking.numPeople} Pax
⛵ Yacht Name: ${booking.yachtId?.name}
🗓️ Trip Date: ${formatDate(booking.date)} | ⏰ Time: ${formatTime(
      booking.startTime
    )} to ${formatTime(booking.endTime)}
(1 Hour Sailing + 1 Hour Anchor)

Balance Pending: ₹${booking.pendingAmount}/- (to be collected before boarding)

📍 Boarding Location
🔗 ${booking.yachtId?.boardingLocation || "Location not provided"}

Inclusions:
${inclusions.length
        ? inclusions.map((i) => `• ${i.replace("-", "").trim()}`).join("\n")
        : "• As discussed"
      }

${paidServices.length ? paidServices.map((i) => `Extra Paid Services:\n• ${i.replace("-", "").trim()}`).join("\n") : ""}

${notes ? `Notes:\n${notes.replace(/\n/g, "\n• ")}` : ""}
`.trim() +
      `\n\n${booking?.company?.disclaimer
        ? `${booking.company.disclaimer}[${tktNum}]

Thank You`
        : hardCodedDisclaimer
      }
`;
  };

  const copyBoardingPass = (booking) => {
    const text = generateBoardingPassText(booking);
    navigator.clipboard.writeText(text);
    toast.success("Boarding Pass copied to clipboard");
  };

  return (
    <>
      {showModal && (
        <div className={styles.modalOverlay} onClick={() => setShowModal(false)}>
          <div
            className={styles.modalContent}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className={styles.modalTitle}>Boarding Pass</h3>

            <pre className={styles.boardingPassText}>
              {generateBoardingPassText(boardingPassBooking)}
            </pre>

            <div className={styles.actions}>
              <button
                className={styles.copyBtn}
                onClick={() => copyBoardingPass(boardingPassBooking)}
              >
                Copy
              </button>


              {boardingPassBooking && (
                <PDFDownloadLink
                  document={<BoardingPassPDF booking={boardingPassBooking} />}
                  fileName={`BoardingPass_${boardingPassBooking._id.slice(-5)}.pdf`}
                >
                  {({ loading }) => (
                    <button type="button" className={styles.downloadBtn}>
                      {loading ? "Preparing PDF..." : "Download PDF"}
                    </button>
                  )}
                </PDFDownloadLink>
              )}


              <button
                className={styles.closeBtn}
                onClick={() => setShowModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <div
        style={{
          position: "absolute",
          top: 20,
          right: 20,
        }}
      >
        <div style={{ position: "relative" }}>
          <input
            type="text"
            value={ticket}
            onChange={handleTicketChange}
            placeholder="#ABCDE"
            className={styles.inputField}
            style={{ width: 180, paddingRight: 40 }}
            disabled={searching}
          />

          <button
            type="button"
            onClick={handleTicketSearch}
            disabled={searching || ticket.length < 5}
            style={{
              position: "absolute",
              right: 10,
              top: "50%",
              transform: "translateY(-50%)",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "#555",
            }}
          >
            <FiSearch size={18} />
          </button>
        </div>
      </div>


      <div className={styles.loginWrapper}>
        <div className={styles.loginCard}>
          <h2 className={styles.loginTitle}>Yacht Management</h2>

          <form onSubmit={handleSubmit} className={styles.loginForm}>

            {/* USERNAME */}
            <div className={styles.inputGroup}>
              <label>Username</label>

              <span className={styles.leftIcon}>
                <FiUser size={18} />
              </span>

              <input
                type="text"
                className={styles.inputField}
                placeholder="Enter username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading}
                required
              />
            </div>

            {/* PASSWORD */}
            <div className={styles.inputGroup}>
              <label>Password</label>

              <span className={styles.leftIcon}>
                <FiLock size={18} />
              </span>

              <input
                type={showPass ? "text" : "password"}
                className={styles.inputField}
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                required
              />

              {/* Toggle Eye Icon */}
              <span
                className={styles.passwordToggle}
                onClick={() => setShowPass(!showPass)}
              >
                {showPass ? <FiEyeOff size={20} /> : <FiEye size={20} />}
              </span>
            </div>

            {error && <p className={styles.errorMsg}>{error}</p>}

            <button className={styles.loginButton} disabled={loading}>
              {loading ? "Logging in..." : "Login"}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}

export default Login;
