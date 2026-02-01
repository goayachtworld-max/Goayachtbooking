import React, { useState } from "react";
import { FiEye, FiEyeOff, FiUser, FiLock } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { loginAPI } from "../services/operations/authAPI";
import styles from "../styles/Login.module.css";
import { FiSearch } from "react-icons/fi";
import toast from "react-hot-toast";
import { getPublicBookingByIdAPI } from "../services/operations/bookingAPI";


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
  const formatTime12Hour = (time) => {
    if (!time) return "";

    const [hours, minutes] = time.split(":");
    const date = new Date();
    date.setHours(hours, minutes);

    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
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

  return (
    <>
      {/* {showModal && (
        <div className={styles.modalOverlay} onClick={() => setShowModal(false)}>
          <div className={styles.modalContent}  onClick={(e) => e.stopPropagation()}>
            <h3>Boarding Pass</h3>
            <pre style={{ whiteSpace: "pre-wrap" }}>
              {`
Ticket #: ${boardingPassBooking._id.slice(-5).toUpperCase()}
Guest: ${boardingPassBooking.customerId?.name}
Contact: ${boardingPassBooking.customerId?.contact}
Yacht: ${boardingPassBooking.yachtId?.name}
Date: ${new Date(boardingPassBooking.date).toLocaleDateString("en-GB")}
Time: ${boardingPassBooking.startTime} - ${boardingPassBooking.endTime}
Group Size: ${boardingPassBooking.numPeople} Pax
Balance Pending: ₹${boardingPassBooking.pendingAmount || 0}
Boarding Location: ${boardingPassBooking.yachtId?.boardingLocation || "N/A"}
Extra Details: ${boardingPassBooking.extraDetails || "None"}
        `}
            </pre>
            <div style={{ marginTop: 10, display: "flex", gap: 10 }}>
              <button onClick={() => {
                const text = generateBoardingPassText(boardingPassBooking);
                navigator.clipboard.writeText(text);
                toast.success("Boarding Pass copied!");
              }}>Copy Boarding Pass</button>

              <button onClick={() => setShowModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )} */}
      {showModal && (
        <div
          className={styles.modalOverlay}
          onClick={() => setShowModal(false)}
        >
          <div
            className={styles.modalContent}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className={styles.modalTitle}>Boarding Pass</h3>

            <div className={styles.passCard}>
              <div className={styles.row}>
                <span>Ticket</span>
                <strong>#{boardingPassBooking._id.slice(-5).toUpperCase()}</strong>
              </div>

              <div className={styles.row}>
                <span>Guest</span>
                <strong>{boardingPassBooking.customerId?.name}</strong>
              </div>

              <div className={styles.row}>
                <span>Contact</span>
                <strong>{boardingPassBooking.customerId?.contact}</strong>
              </div>

              <div className={styles.divider} />

              <div className={styles.row}>
                <span>Yacht</span>
                <strong>{boardingPassBooking.yachtId?.name}</strong>
              </div>

              <div className={styles.row}>
                <span>Date</span>
                <strong>
                  {new Date(boardingPassBooking.date).toLocaleDateString("en-GB")}
                </strong>
              </div>

              <div className={styles.row}>
                <span>Time</span>
                <strong>
                  {formatTime12Hour(boardingPassBooking.startTime)} –{" "}
                  {formatTime12Hour(boardingPassBooking.endTime)}
                </strong>
              </div>

              <div className={styles.row}>
                <span>Guests</span>
                <strong>{boardingPassBooking.numPeople} Pax</strong>
              </div>

              <div className={styles.row}>
                <span>Balance</span>
                <strong className={styles.amount}>
                  ₹{boardingPassBooking.pendingAmount || 0}
                </strong>
              </div>

              {boardingPassBooking.extraDetails && (
                <>
                  <div className={styles.divider} />
                  <div className={styles.extra}>
                    <span>Notes</span>
                    <p>{boardingPassBooking.extraDetails}</p>
                  </div>
                </>
              )}

              <div className={styles.row}>
                <span>Boarding Location</span>
                <strong>
                  {boardingPassBooking.yachtId?.boardingLocation || "N/A"}
                </strong>
              </div>
            </div>

            <div className={styles.actions}> <button className={styles.closeBtn} onClick={() => setShowModal(false)} > Close </button> </div>

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
