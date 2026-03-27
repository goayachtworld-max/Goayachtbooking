import React, { useState, useEffect, useRef } from "react";
import { FiEye, FiEyeOff, FiLock, FiSearch } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { loginAPI } from "../services/operations/authAPI";
import styles from "../styles/Login.module.css";
import toast from "react-hot-toast";
import { getPublicBookingByIdAPI } from "../services/operations/bookingAPI";
import { PDFDownloadLink } from "@react-pdf/renderer";
import BoardingPassPDF from "./BoardingPassPDF";

const LS_IDENTIFIER = "lastLoginIdentifier";
const LS_AUTH_MODE  = "lastAuthMode"; // "password" | "pin"

// Detect if a string looks like a mobile number
const looksLikeMobile = (val) => /^[6-9]\d{0,14}$/.test(val.trim()) && /^\d+$/.test(val.trim());

function Login({ onLogin }) {
  const [identifier, setIdentifier] = useState(() => localStorage.getItem(LS_IDENTIFIER) || "");
  const [authMode, setAuthMode]     = useState(() => localStorage.getItem(LS_AUTH_MODE) || "password");
  const [password, setPassword]     = useState("");
  const [pin, setPin]               = useState("");
  const [showPass, setShowPass]     = useState(false);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState("");
  const navigate                    = useNavigate();

  // Derived: what kind of identifier did the user type?
  const identifierIsMobile = looksLikeMobile(identifier);
  const identifierHint = identifier.trim() === ""
    ? "Username or mobile number"
    : identifierIsMobile
      ? "Mobile number detected"
      : "Username detected";

  // ticket / boarding pass
  const [ticket, setTicket]                   = useState("");
  const [searching, setSearching]             = useState(false);
  const [boardingPassBooking, setBoardingPassBooking] = useState(null);
  const [showModal, setShowModal]             = useState(false);
  const [autoDownload, setAutoDownload]       = useState(false);
  const downloadRef                           = useRef(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ticketParam = params.get("ticket");
    if (!ticketParam) return;
    const cleanTicket = ticketParam.replace("#", "").toUpperCase();
    if (cleanTicket.length !== 5) return;
    (async () => {
      try {
        setSearching(true); setAutoDownload(true);
        const res = await getPublicBookingByIdAPI(cleanTicket);
        setBoardingPassBooking(res.data.booking); setShowModal(true);
      } catch (err) { toast.error(err?.response?.data?.message || "Booking not found"); }
      finally { setSearching(false); }
    })();
  }, []);

  useEffect(() => {
    if (autoDownload && downloadRef.current) {
      const t = setTimeout(() => { downloadRef.current?.click(); setAutoDownload(false); }, 800);
      return () => clearTimeout(t);
    }
  }, [autoDownload, boardingPassBooking]);

  const switchAuthMode = (mode) => {
    setAuthMode(mode); setPassword(""); setPin(""); setError("");
    localStorage.setItem(LS_AUTH_MODE, mode);
  };

  const handleIdentifierChange = (e) => {
    const val = e.target.value;
    setIdentifier(val);
    localStorage.setItem(LS_IDENTIFIER, val);
    setError("");
  };

  const handlePinChange = (e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!identifier.trim()) { setError("Enter your username or mobile number."); return; }
    if (authMode === "pin" && pin.length !== 4) { setError("PIN must be exactly 4 digits."); return; }
    if (authMode === "password" && !password) { setError("Enter your password."); return; }

    setLoading(true);
    try {
      const credential = authMode === "pin" ? { pin } : { password };
      const response   = await loginAPI(identifier.trim(), credential);
      if (response.status === 200 && response.data?.employee && response.data?.token) {
        const { employee, token } = response.data;
        localStorage.setItem("authToken", token);
        localStorage.setItem(LS_IDENTIFIER, identifier.trim());
        onLogin({ ...employee, token });
        navigate(employee.type === "admin" ? "/admin" : "/bookings");
      } else { setError("Login failed. Please try again."); }
    } catch (err) { setError(err.response?.data?.message || "Login failed. Try again."); }
    finally { setLoading(false); }
  };

  const handleTicketChange = (e) => { if (e.target.value.length <= 6) setTicket(e.target.value.toUpperCase()); };
  const handleTicketSearch = async () => {
    const cleanTicket = ticket.replace("#", "");
    if (cleanTicket.length !== 5) { toast.error("Enter a valid ticket number"); return; }
    try {
      setSearching(true);
      const res = await getPublicBookingByIdAPI(cleanTicket);
      setBoardingPassBooking(res.data.booking); setShowModal(true);
    } catch (err) { toast.error(err?.response?.data?.message || "Booking not found"); }
    finally { setSearching(false); }
  };

  // ── boarding pass helpers (unchanged logic) ──────────────────────────────
  const fmtDate = (ds) => new Date(ds).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  const fmtTime = (t) => { let [h,m]=t.split(":").map(Number); const p=h>=12?"PM":"AM"; h=h%12||12; return `${h}.${m.toString().padStart(2,"0")} ${p}`; };

  const generateBoardingPassText = (booking) => {
    const inclusions  = booking.extraDetails ? booking.extraDetails.split("\n").filter(i=>["Soft Drink","Ice Cube","Water Bottles","Bluetooth Speaker","Captain","Snacks"].some(k=>i.includes(k))) : [];
    const paidServices = booking.extraDetails ? booking.extraDetails.split("\n").filter(i=>["Drone - Photography & Videography","DSLR Photography"].some(k=>i.includes(k))) : [];
    const notes = booking.extraDetails ? booking.extraDetails.split("Notes:").slice(1).join("Notes:").trim() : "";
    const tktNum = booking._id.slice(-5).toUpperCase();
    const isPending = booking.status === "pending";
    const hardCodedDisclaimer = `Disclaimer:\n• Reporting time is 30 minutes prior to departure\n• No refund for late arrival or no-show\n• Subject to weather and government regulations\nThank you for booking with ${booking.company?.name}`;
    return `\n# Ticket Number: ${tktNum}\nBooking Status: ${booking.status.toUpperCase()}${isPending?`\n⚠️ NOTE: This is a TENTATIVE booking.`:""}\n\n👤 Guest Name: ${booking.customerId?.name}\n📞 Contact No.: ${booking.customerId?.contact}\n👥 Group Size: ${booking.numPeople} Pax\n⛵ Yacht Name: ${booking.yachtId?.name}\n🗓️ Trip Date: ${fmtDate(booking.date)} | ⏰ Time: ${fmtTime(booking.startTime)} to ${fmtTime(booking.endTime)}\n${!isPending?`\nBalance Pending: ₹${booking.pendingAmount}/-`:""}\n\n📍 Boarding Location\n🔗 ${isPending?"Will be shared upon confirmation":(booking.yachtId?.boardingLocation||"Location not provided")}\n\nInclusions:\n${inclusions.length?inclusions.map(i=>`• ${i.replace("-","").trim()}`).join("\n"):"• As discussed"}\n${paidServices.length?paidServices.map(i=>`Extra Paid Services:\n• ${i.replace("-","").trim()}`).join("\n"):""}\n${notes?`Notes:\n${notes.replace(/\n/g,"\n• ")}`:""}`.trim()+`\n\n${booking?.company?.disclaimer?`${booking.company.disclaimer}[${tktNum}]\n\nThank You`:hardCodedDisclaimer}\n`;
  };

  const copyBoardingPass = (booking) => { navigator.clipboard.writeText(generateBoardingPassText(booking)); toast.success("Boarding Pass copied to clipboard"); };

  const parseBoardingPass = (booking) => {
    const inclusions   = booking.extraDetails ? booking.extraDetails.split("\n").filter(i=>["Soft Drink","Ice Cube","Water Bottles","Bluetooth Speaker","Captain","Snacks"].some(k=>i.includes(k))).map(i=>i.replace("- ","").trim()) : [];
    const paidServices = booking.extraDetails ? booking.extraDetails.split("\n").filter(i=>["Drone","DSLR"].some(k=>i.includes(k))).map(i=>i.replace("- ","").trim()) : [];
    const notes = booking.extraDetails ? booking.extraDetails.split("Notes:").slice(1).join("").trim() : "";
    return {
      ticketId: booking._id.slice(-5).toUpperCase(), status: booking.status,
      isPending: booking.status==="pending", guestName: booking.customerId?.name,
      contact: booking.customerId?.contact, groupSize: booking.numPeople,
      yacht: booking.yachtId?.name, date: fmtDate(booking.date),
      time: `${fmtTime(booking.startTime)} – ${fmtTime(booking.endTime)}`,
      boardingLocation: booking.yachtId?.boardingLocation, pendingAmount: booking.pendingAmount,
      inclusions, paidServices, notes,
      disclaimer: booking.company?.disclaimer || `• Reporting time is 30 minutes prior to departure\n• No refund for late arrival or no-show\n• Subject to weather and government regulations\nThank you for booking with ${booking.company?.name||"us"}`,
    };
  };

  const statusClass = (s) => s==="confirmed"?styles.statusConfirmed:s==="pending"?styles.statusPending:styles.statusCancelled;

  return (
    <>
      {/* Boarding pass modal */}
      {showModal && boardingPassBooking && (() => {
        const pass = parseBoardingPass(boardingPassBooking);
        return (
          <div className={styles.modalOverlay} onClick={() => setShowModal(false)}>
            <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
              <div className={styles.modalHeader}>
                <h3 className={styles.modalTitle}>{pass.isPending ? "⏳ Tentative Pass" : "⚓ Boarding Pass"}</h3>
                <span className={styles.modalTicketId}>#{pass.ticketId}</span>
              </div>
              <div className={styles.tearLine}><hr /></div>
              <div className={styles.boardingPassBody}>
                <div className={styles.passRow}>
                  <span className={styles.passLabel}>Status</span>
                  <span className={`${styles.statusBadge} ${statusClass(pass.status)}`}>{pass.status.toUpperCase()}</span>
                </div>
                {pass.isPending && (
                  <div style={{background:"#fffbeb",border:"1px solid #fde68a",borderRadius:8,padding:"8px 12px",marginBottom:8,fontSize:"0.78rem",color:"#92400e",lineHeight:1.5}}>
                    ⚠️ <strong>Tentative Booking</strong> — Your slot is not yet confirmed.
                  </div>
                )}
                {[["Guest",pass.guestName,"passValue"],["Contact",pass.contact,"passValueMono"],["Group Size",`${pass.groupSize} Pax`,"passValue"],["Vessel",pass.yacht,"passValue"],["Date",pass.date,"passValue"],["Time",pass.time,"passValue"]].map(([label,val,cls])=>(
                  <div className={styles.passRow} key={label}><span className={styles.passLabel}>{label}</span><span className={styles[cls]}>{val}</span></div>
                ))}
                <div className={styles.passRow}>
                  <span className={styles.passLabel}>Location</span>
                  <span className={styles.passValue} style={{fontSize:"0.8rem"}}>{pass.isPending?"Will be shared upon confirmation":(pass.boardingLocation||"Location not provided")}</span>
                </div>
                {!pass.isPending&&pass.pendingAmount>0&&(<div className={styles.passRow}><span className={styles.passLabel}>Balance Due</span><span className={styles.pendingAmount}>₹{pass.pendingAmount}/-</span></div>)}
                {pass.inclusions.length>0&&(<><p className={styles.passSection}>Inclusions</p><div className={styles.inclusionList}>{pass.inclusions.map(i=><span key={i} className={styles.inclusionChip}>{i}</span>)}</div></>)}
                {pass.paidServices.length>0&&(<><p className={styles.passSection}>Paid Services</p><div className={styles.inclusionList}>{pass.paidServices.map(i=><span key={i} className={styles.inclusionChip}>{i}</span>)}</div></>)}
                {pass.notes&&(<><p className={styles.passSection}>Notes</p><div className={styles.notesBox}>{pass.notes}</div></>)}
                <div className={styles.disclaimerBox}>{pass.disclaimer.split("\n").map((line,i)=><div key={i}>{line}</div>)}</div>
              </div>
              <div className={styles.actions}>
                <button className={styles.copyBtn} onClick={() => copyBoardingPass(boardingPassBooking)}>Copy</button>
                {boardingPassBooking&&(
                  <PDFDownloadLink document={<BoardingPassPDF booking={boardingPassBooking}/>} fileName={`${pass.yacht}_${pass.guestName}_${pass.date}.pdf`} ref={downloadRef}>
                    {({loading})=><button type="button" className={styles.downloadBtn}>{loading?"Preparing...":"Download PDF"}</button>}
                  </PDFDownloadLink>
                )}
                <button className={styles.closeBtn} onClick={() => setShowModal(false)}>Close</button>
              </div>
            </div>
          </div>
        );
      })()}

      <div className={styles.loginWrapper}>
        <div className={styles.loginCard}>

          {/* Logo / title */}
          <div className={styles.loginBrand}>
            {/* <div className={styles.loginBrandIcon}>⚓</div> */}
            <h2 className={styles.loginTitle}>Yacht Management</h2>
          </div>

          <form onSubmit={handleSubmit} className={styles.loginForm} autoComplete="on">

            {/* ── Single identifier field — auto-detects mobile vs username ── */}
            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>Username or Mobile</label>
              <div className={styles.inputWrap}>
                <span className={styles.inputIcon}>
                  {identifierIsMobile
                    ? <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M11 1a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h6zm-5 0a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V3a2 2 0 0 0-2-2H6zm2.5 11a.5.5 0 1 1 0 1 .5.5 0 0 1 0-1z"/></svg>
                    : <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm2-3a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm4 8c0 1-1 1-1 1H3s-1 0-1-1 1-4 6-4 6 3 6 4zm-1-.004c-.001-.246-.154-.986-.832-1.664C11.516 10.68 10.289 10 8 10c-2.29 0-3.516.68-4.168 1.332-.678.678-.83 1.418-.832 1.664h10z"/></svg>
                  }
                </span>
                <input
                  type="text"
                  inputMode={identifierIsMobile ? "numeric" : "text"}
                  className={styles.inputField}
                  placeholder="Username or mobile number"
                  value={identifier}
                  onChange={handleIdentifierChange}
                  disabled={loading}
                  autoComplete="username"
                  required
                />
                {identifier.trim() !== "" && (
                  <span className={`${styles.idPill} ${identifierIsMobile ? styles.idPillMobile : styles.idPillUser}`}>
                    {identifierIsMobile ? "Mobile" : "Username"}
                  </span>
                )}
              </div>
            </div>

            {/* ── Single credential input with Password / PIN tab inside ── */}
            <div className={styles.inputGroup}>
              <div className={styles.credHeader}>
                <label className={styles.inputLabel}>
                  {authMode === "pin" ? "4-Digit PIN" : "Password"}
                </label>
                <div className={styles.miniTabRow}>
                  <button
                    type="button"
                    className={`${styles.miniTab} ${authMode === "password" ? styles.miniTabActive : ""}`}
                    onClick={() => switchAuthMode("password")}
                  >
                    <FiLock size={11} /> Password
                  </button>
                  <button
                    type="button"
                    className={`${styles.miniTab} ${authMode === "pin" ? styles.miniTabActive : ""}`}
                    onClick={() => switchAuthMode("pin")}
                  >
                    # PIN
                  </button>
                </div>
              </div>

              <div className={styles.inputWrap}>
                <span className={styles.inputIcon}><FiLock size={15} /></span>
                {authMode === "password" ? (
                  <input
                    type={showPass ? "text" : "password"}
                    className={styles.inputField}
                    placeholder="Enter password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    autoComplete="current-password"
                    required
                  />
                ) : (
                  <input
                    type={showPass ? "text" : "password"}
                    inputMode="numeric"
                    className={`${styles.inputField} ${styles.pinField}`}
                    placeholder="• • • •"
                    value={pin}
                    onChange={handlePinChange}
                    disabled={loading}
                    maxLength={4}
                    autoComplete="one-time-code"
                    required
                  />
                )}
                <button type="button" className={styles.eyeBtn} onClick={() => setShowPass(v => !v)} tabIndex={-1}>
                  {showPass ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                </button>
              </div>

              {authMode === "pin" && pin.length > 0 && pin.length < 4 && (
                <p className={styles.pinHint}>{4 - pin.length} more digit{4-pin.length !== 1 ? "s" : ""}</p>
              )}
            </div>

            {error && <p className={styles.errorMsg}>{error}</p>}

            <button className={styles.loginButton} type="submit" disabled={loading}>
              {loading ? "Logging in…" : "Login"}
            </button>
          </form>
        </div>

        {/* Ticket search */}
        <div className={styles.ticketSearchWrap}>
          <p className={styles.ticketSearchLabel}>Check your booking</p>
          <div className={styles.ticketSearchRow}>
            <input type="text" value={ticket} onChange={handleTicketChange} placeholder="Ticket ID e.g. ABCDE" disabled={searching} />
            <button type="button" onClick={handleTicketSearch} disabled={searching || ticket.length < 5}>
              <FiSearch size={16} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export default Login;