import React, { useState, useEffect, useRef } from "react";
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

  const [autoDownload, setAutoDownload] = useState(false);
  const downloadRef = useRef(null);

  // Auto-trigger from URL: ?ticket=ABCDE
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ticketParam = params.get("ticket");
    if (!ticketParam) return;

    const cleanTicket = ticketParam.replace("#", "").toUpperCase();
    if (cleanTicket.length !== 5) return;

    const autoSearch = async () => {
      try {
        setSearching(true);
        setAutoDownload(true);
        const res = await getPublicBookingByIdAPI(cleanTicket);
        setBoardingPassBooking(res.data.booking);
        setShowModal(true);
      } catch (err) {
        toast.error(err?.response?.data?.message || "Booking not found");
      } finally {
        setSearching(false);
      }
    };

    autoSearch();
  }, []);

  // Auto-click the download link once PDF is ready
  useEffect(() => {
    if (autoDownload && downloadRef.current) {
      const timer = setTimeout(() => {
        downloadRef.current?.click();
        setAutoDownload(false);
      }, 800); // small delay so @react-pdf finishes rendering
      return () => clearTimeout(timer);
    }
  }, [autoDownload, boardingPassBooking]);

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
  const formatDate = (d) =>
    new Date(d).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

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
          ["Drone - Photography & Videography", "DSLR Photography"].some((k) => i.includes(k))
        )
      : [];
    const notes = booking.extraDetails
      ? booking.extraDetails.split("Notes:").slice(1).join("Notes:").trim()
      : "";
    const tktNum = `${booking._id.slice(-5).toUpperCase()}`
    const guestName = `${booking.customerId?.name}`
    const contactNum = `${booking.customerId?.contact}`
    const isPending = booking.status === "pending";
    const hardCodedDisclaimer = `Disclaimer:
• Reporting time is 30 minutes prior to departure
• No refund for late arrival or no-show
• Subject to weather and government regulations
Thank you for booking with ${booking.company?.name}`

    return `
# Ticket Number: ${tktNum}
Booking Status: ${booking.status.toUpperCase()}${isPending ? `
⚠️ NOTE: This is a TENTATIVE booking. Your slot is NOT yet confirmed. Please confirm by paying Token Amount` : ""}

👤 Guest Name: ${guestName}
📞 Contact No.: ${contactNum}
👥 Group Size: ${booking.numPeople} Pax
⛵ Yacht Name: ${booking.yachtId?.name}
🗓️ Trip Date: ${formatDate(booking.date)} | ⏰ Time: ${formatTime(
      booking.startTime
    )} to ${formatTime(booking.endTime)}
(1 Hour Sailing + 1 Hour Anchor)
${!isPending ? `
Balance Pending: ₹${booking.pendingAmount}/- (to be collected before boarding)` : ""}

📍 Boarding Location
🔗 ${isPending ? "Will be shared upon confirmation" : (booking.yachtId?.boardingLocation || "Location not provided")}

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

  // Parse boarding pass data into structured fields
  const parseBoardingPass = (booking) => {
    const formatDate = (dateStr) =>
      new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

    const formatTime = (time24) => {
      let [h, m] = time24.split(":").map(Number);
      const period = h >= 12 ? "PM" : "AM";
      h = h % 12 || 12;
      return `${h}:${m.toString().padStart(2, "0")} ${period}`;
    };

    const inclusions = booking.extraDetails
      ? booking.extraDetails.split("\n").filter((i) =>
        ["Soft Drink", "Ice Cube", "Water Bottles", "Bluetooth Speaker", "Captain", "Snacks"].some((k) => i.includes(k))
      ).map((i) => i.replace("- ", "").trim())
      : [];

    const paidServices = booking.extraDetails
      ? booking.extraDetails.split("\n").filter((i) =>
        ["Drone", "DSLR"].some((k) => i.includes(k))
      ).map((i) => i.replace("- ", "").trim())
      : [];

    const notes = booking.extraDetails
      ? booking.extraDetails.split("Notes:").slice(1).join("").trim()
      : "";

    return {
      ticketId: booking._id.slice(-5).toUpperCase(),
      status: booking.status,
      isPending: booking.status === "pending",
      guestName: booking.customerId?.name,
      contact: booking.customerId?.contact,
      groupSize: booking.numPeople,
      yacht: booking.yachtId?.name,
      date: formatDate(booking.date),
      time: `${formatTime(booking.startTime)} – ${formatTime(booking.endTime)}`,
      boardingLocation: booking.yachtId?.boardingLocation,
      pendingAmount: booking.pendingAmount,
      inclusions,
      paidServices,
      notes,
      disclaimer: booking.company?.disclaimer || `• Reporting time is 30 minutes prior to departure\n• No refund for late arrival or no-show\n• Subject to weather and government regulations\nThank you for booking with ${booking.company?.name || "us"}`,
    };
  };

  const statusClass = (status) => {
    if (status === "confirmed") return styles.statusConfirmed;
    if (status === "pending") return styles.statusPending;
    return styles.statusCancelled;
  };

  return (
    <>
      {showModal && boardingPassBooking && (() => {
        const pass = parseBoardingPass(boardingPassBooking);
        return (
          <div className={styles.modalOverlay} onClick={() => setShowModal(false)}>
            <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>

              {/* Header */}
              <div className={styles.modalHeader}>
                <h3 className={styles.modalTitle}>{pass.isPending ? "⏳ Tentative Pass" : "⚓ Boarding Pass"}</h3>
                <span className={styles.modalTicketId}>#{pass.ticketId}</span>
              </div>

              {/* Tear line */}
              <div className={styles.tearLine}>
                <hr />
              </div>

              {/* Pass body */}
              <div className={styles.boardingPassBody}>

                {/* Status */}
                <div className={styles.passRow}>
                  <span className={styles.passLabel}>Status</span>
                  <span className={`${styles.statusBadge} ${statusClass(pass.status)}`}>
                    {pass.status.toUpperCase()}
                  </span>
                </div>

                {/* Pending warning banner */}
                {pass.isPending && (
                  <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "8px 12px", marginBottom: 8, fontSize: "0.78rem", color: "#92400e", lineHeight: 1.5 }}>
                    ⚠️ <strong>Tentative Booking</strong> — Your slot is not yet confirmed. Please confirm by paying Token Amount.
                  </div>
                )}

                <div className={styles.passRow}>
                  <span className={styles.passLabel}>Guest</span>
                  <span className={styles.passValue}>{pass.guestName}</span>
                </div>

                <div className={styles.passRow}>
                  <span className={styles.passLabel}>Contact</span>
                  <span className={styles.passValueMono}>{pass.contact}</span>
                </div>

                <div className={styles.passRow}>
                  <span className={styles.passLabel}>Group Size</span>
                  <span className={styles.passValue}>{pass.groupSize} Pax</span>
                </div>

                <div className={styles.passRow}>
                  <span className={styles.passLabel}>Vessel</span>
                  <span className={styles.passValue}>{pass.yacht}</span>
                </div>

                <div className={styles.passRow}>
                  <span className={styles.passLabel}>Date</span>
                  <span className={styles.passValue}>{pass.date}</span>
                </div>

                <div className={styles.passRow}>
                  <span className={styles.passLabel}>Time</span>
                  <span className={styles.passValue}>{pass.time}</span>
                </div>

                <div className={styles.passRow}>
                  <span className={styles.passLabel}>Location</span>
                  <span className={styles.passValue} style={{ fontSize: "0.8rem" }}>
                    {pass.isPending ? "Will be shared upon confirmation" : (pass.boardingLocation || "Location not provided")}
                  </span>
                </div>

                {!pass.isPending && pass.pendingAmount > 0 && (
                  <div className={styles.passRow}>
                    <span className={styles.passLabel}>Balance Due</span>
                    <span className={styles.pendingAmount}>₹{pass.pendingAmount}/-</span>
                  </div>
                )}

                {/* Inclusions */}
                {pass.inclusions.length > 0 && (
                  <>
                    <p className={styles.passSection}>Inclusions</p>
                    <div className={styles.inclusionList}>
                      {pass.inclusions.map((item) => (
                        <span key={item} className={styles.inclusionChip}>{item}</span>
                      ))}
                    </div>
                  </>
                )}

                {/* Paid services */}
                {pass.paidServices.length > 0 && (
                  <>
                    <p className={styles.passSection}>Paid Services</p>
                    <div className={styles.inclusionList}>
                      {pass.paidServices.map((item) => (
                        <span key={item} className={styles.inclusionChip}>{item}</span>
                      ))}
                    </div>
                  </>
                )}

                {/* Notes */}
                {pass.notes && (
                  <>
                    <p className={styles.passSection}>Notes</p>
                    <div className={styles.notesBox}>{pass.notes}</div>
                  </>
                )}

                {/* Disclaimer */}
                <div className={styles.disclaimerBox}>
                  {pass.disclaimer.split("\n").map((line, i) => (
                    <div key={i}>{line}</div>
                  ))}
                </div>

              </div>

              {/* Actions */}
              <div className={styles.actions}>
                <button className={styles.copyBtn} onClick={() => copyBoardingPass(boardingPassBooking)}>
                  Copy
                </button>
                {boardingPassBooking && (
                  <PDFDownloadLink
                    document={<BoardingPassPDF booking={boardingPassBooking} />}
                    fileName={`${pass.yacht}_${pass.guestName}_${pass.date}.pdf`}
                    ref={downloadRef}
                  >
                    {({ loading }) => (
                      <button type="button" className={styles.downloadBtn}>
                        {loading ? "Preparing..." : "Download PDF"}
                      </button>
                    )}
                  </PDFDownloadLink>
                )}
                <button className={styles.closeBtn} onClick={() => setShowModal(false)}>
                  Close
                </button>
              </div>

            </div>
          </div>
        );
      })()}

      <div className={styles.loginWrapper}>

        <div className={styles.loginCard}>
          <h2 className={styles.loginTitle}>Yacht Management</h2>

          <form onSubmit={handleSubmit} className={styles.loginForm}>
            <div className={styles.inputGroup}>
              <label>Username</label>
              <span className={styles.leftIcon}><FiUser size={16} /></span>
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

            <div className={styles.inputGroup}>
              <label>Password</label>
              <span className={styles.leftIcon}><FiLock size={16} /></span>
              <input
                type={showPass ? "text" : "password"}
                className={styles.inputField}
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                required
              />
              <span className={styles.passwordToggle} onClick={() => setShowPass(!showPass)}>
                {showPass ? <FiEyeOff size={18} /> : <FiEye size={18} />}
              </span>
            </div>

            {error && <p className={styles.errorMsg}>{error}</p>}

            <button className={styles.loginButton} disabled={loading}>
              {loading ? "Logging in..." : "Login"}
            </button>
          </form>
        </div>

        {/* Ticket search — below login card */}
        <div className={styles.ticketSearchWrap}>
          <p className={styles.ticketSearchLabel}>Check your booking</p>
          <div className={styles.ticketSearchRow}>
            <input
              type="text"
              value={ticket}
              onChange={handleTicketChange}
              placeholder="Ticket ID e.g. ABCDE"
              disabled={searching}
            />
            <button
              type="button"
              onClick={handleTicketSearch}
              disabled={searching || ticket.length < 5}
            >
              <FiSearch size={16} />
            </button>
          </div>
        </div>

      </div>
    </>
  );
}
export default Login;