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
const LS_AUTH_MODE  = "lastAuthMode";

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

  /* ── Dot-yacht particle canvas ── */
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    const dpr = window.devicePixelRatio || 1;

    let W = parent.clientWidth  || 460;
    let H = parent.clientHeight || 560;
    let particles = [];
    let rafId;
    const mouse = { x: -9999, y: -9999, radius: 80 };

    const onMouseMove = (e) => {
      const rect = parent.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    };
    const onMouseLeave = () => { mouse.x = -9999; mouse.y = -9999; };
    parent.addEventListener('mousemove', onMouseMove);
    parent.addEventListener('mouseleave', onMouseLeave);

    const resize = () => {
      W = parent.clientWidth  || 460;
      H = parent.clientHeight || 560;
      canvas.width  = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
    };

    /* ── Draw superyacht on offscreen canvas, sample white pixels ── */
    const getYachtTargets = () => {
      const offW = 1000, offH = 500;
      const off = document.createElement('canvas');
      off.width = offW; off.height = offH;
      const o = off.getContext('2d', { willReadFrequently: true });
      o.fillStyle = 'white';

      /* 1. Hull base */
      o.beginPath();
      o.moveTo(60, 420); o.lineTo(820, 420); o.lineTo(950, 310);
      o.lineTo(100, 310); o.lineTo(110, 350);
      o.closePath(); o.fill();

      /* Racing stripe gap */
      o.globalCompositeOperation = 'destination-out';
      o.fillRect(50, 400, 830, 8);
      o.globalCompositeOperation = 'source-over';

      /* 4 Portholes — outer ring cut, inner dot, core cut */
      o.globalCompositeOperation = 'destination-out';
      for (let i = 0; i < 4; i++) { o.beginPath(); o.arc(450 + i * 90, 360, 22, 0, Math.PI * 2); o.fill(); }
      o.globalCompositeOperation = 'source-over';
      for (let i = 0; i < 4; i++) { o.beginPath(); o.arc(450 + i * 90, 360, 14, 0, Math.PI * 2); o.fill(); }
      o.globalCompositeOperation = 'destination-out';
      for (let i = 0; i < 4; i++) { o.beginPath(); o.arc(450 + i * 90, 360, 10, 0, Math.PI * 2); o.fill(); }
      o.globalCompositeOperation = 'source-over';

      /* 2. First upper deck */
      o.beginPath();
      o.moveTo(130, 305);
      o.bezierCurveTo(300, 300, 600, 300, 850, 305);
      o.lineTo(650, 255); o.lineTo(210, 255);
      o.closePath(); o.fill();

      /* Deck 1 windows */
      o.globalCompositeOperation = 'destination-out';
      o.beginPath();
      o.moveTo(240, 300); o.lineTo(620, 300); o.lineTo(580, 260); o.lineTo(260, 260);
      o.fill();
      o.globalCompositeOperation = 'source-over';
      for (let i = 0; i < 5; i++) o.fillRect(320 + i * 65, 260, 10, 40);

      /* 3. Second upper deck */
      o.beginPath();
      o.moveTo(250, 250); o.lineTo(700, 250); o.lineTo(600, 210); o.lineTo(280, 210);
      o.closePath(); o.fill();

      /* Deck 2 windows */
      o.globalCompositeOperation = 'destination-out';
      o.beginPath();
      o.moveTo(310, 245); o.lineTo(580, 245); o.lineTo(550, 215); o.lineTo(330, 215);
      o.fill();
      o.globalCompositeOperation = 'source-over';
      for (let i = 0; i < 4; i++) o.fillRect(370 + i * 55, 215, 8, 30);

      /* 4. Roof / top deck */
      o.beginPath();
      o.moveTo(260, 205); o.lineTo(620, 205); o.lineTo(590, 190); o.lineTo(270, 190);
      o.closePath(); o.fill();

      /* 5. Masts and radar */
      o.fillRect(450, 40, 12, 150);
      o.beginPath(); o.arc(456, 35, 8, 0, Math.PI * 2); o.fill();
      o.fillRect(420, 120, 10, 70);
      o.fillRect(360, 175, 10, 15);
      o.fillRect(390, 175, 10, 15);
      o.fillRect(340, 160, 70, 15);

      const targets = [];
      const px = o.getImageData(0, 0, offW, offH).data;
      const step = 4;
      for (let y = 0; y < offH; y += step) {
        for (let x = 0; x < offW; x += step) {
          if (px[(y * offW + x) * 4 + 3] > 128) targets.push({ x, y });
        }
      }
      return { targets, sizeX: offW, sizeY: offH };
    };

    const initParticles = () => {
      particles = [];
      const { targets, sizeX, sizeY } = getYachtTargets();
      const scale  = Math.min(W / sizeX, H / sizeY) * 0.88;
      const offsetX = (W - sizeX * scale) / 2;
      const offsetY = (H - sizeY * scale) / 2;

      for (const trg of targets) {
        const isWhite = Math.random() > 0.4;
        particles.push({
          x: Math.random() * W,
          y: Math.random() * H,
          baseX: offsetX + trg.x * scale,
          baseY: offsetY + trg.y * scale,
          vx: (Math.random() - 0.5) * 2,
          vy: (Math.random() - 0.5) * 2,
          color: isWhite
            ? `hsla(200,10%,${90 + Math.random() * 10}%,${0.6 + Math.random() * 0.4})`
            : `hsla(${195 + Math.random() * 15},80%,${70 + Math.random() * 20}%,${0.5 + Math.random() * 0.5})`,
          size: Math.random() * 0.8 + 0.4,
          friction: 0.93 + Math.random() * 0.04,
          ease:     0.022 + Math.random() * 0.025,
        });
      }
    };

    const ctx = canvas.getContext('2d');

    const tick = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const time = Date.now() * 0.0006;

      for (const p of particles) {
        /* wave: each column bobs at slightly different phase → rolling wave */
        const animX = p.baseX + Math.sin(time * 0.8) * 4;
        const animY = p.baseY + Math.sin(time + p.baseX * 0.003) * 10;

        /* mouse repulsion */
        const dx = mouse.x - p.x;
        const dy = mouse.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < mouse.radius && dist > 0) {
          const force = (mouse.radius - dist) / mouse.radius;
          p.vx -= (dx / dist) * force * 1.5;
          p.vy -= (dy / dist) * force * 1.5;
        }

        /* spring toward animated target */
        p.vx += (animX - p.x) * p.ease;
        p.vy += (animY - p.y) * p.ease;

        /* subtle shimmer turbulence */
        p.vx += (Math.random() - 0.5) * 0.04;
        p.vy += (Math.random() - 0.5) * 0.04;

        p.vx *= p.friction;
        p.vy *= p.friction;
        p.x  += p.vx;
        p.y  += p.vy;

        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      rafId = requestAnimationFrame(tick);
    };

    resize();
    initParticles();
    rafId = requestAnimationFrame(tick);

    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(rafId);
      resize();
      initParticles();
      rafId = requestAnimationFrame(tick);
    });
    ro.observe(parent);

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      parent.removeEventListener('mousemove', onMouseMove);
      parent.removeEventListener('mouseleave', onMouseLeave);
    };
  }, []);

  const identifierIsMobile = looksLikeMobile(identifier);
  const identifierHint = identifier.trim() === ""
    ? "Username or mobile number"
    : identifierIsMobile ? "Mobile number detected" : "Username detected";

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

        {/* ── Left panel: two vertical strips ── */}
        <div className={styles.loginLeft}>

          {/* Strip 1: Brand + Pricing */}
          <div className={styles.leftStrip}>
            <div className={styles.brandLogo}>
              <div className={styles.brandAnchor}>
                <svg width="24" height="24" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                  {/* Mast */}
                  <line x1="24" y1="4" x2="24" y2="36" stroke="#051829" strokeWidth="2.5" strokeLinecap="round"/>
                  {/* Main sail */}
                  <path d="M24 6 L24 32 L40 28 Z" fill="#051829" opacity="0.9"/>
                  {/* Jib sail */}
                  <path d="M24 10 L10 30 L24 30 Z" fill="#051829" opacity="0.65"/>
                  {/* Boom */}
                  <line x1="14" y1="33" x2="40" y2="33" stroke="#051829" strokeWidth="2" strokeLinecap="round"/>
                  {/* Hull */}
                  <path d="M10 36 L38 36 L34 43 Q24 46 14 43 Z" fill="#051829"/>
                  {/* Gold waterline */}
                  <path d="M12 42 Q24 45 36 42" stroke="#c9a84c" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
                  {/* Flag */}
                  <path d="M24 4 L31 8 L24 12 Z" fill="#c9a84c"/>
                  {/* Water */}
                  <path d="M6 44 Q12 41 18 44 Q24 47 30 44 Q36 41 42 44" stroke="#051829" strokeWidth="1.2" fill="none" strokeLinecap="round" opacity="0.4"/>
                </svg>
              </div>
              <div>
                <p className={styles.brandName}>Yacht Management</p>
              </div>
            </div>

            <div className={styles.pricingCard}>
              <p className={styles.pricingEyebrow}>All-in-One Plan</p>
              <div className={styles.pricingToggle}>
                <div className={styles.pricingPlan}>
                  <span className={styles.pricingAmount}>₹99</span>
                  <span className={styles.pricingPer}>/month</span>
                </div>
                <div className={styles.pricingDivider}>or</div>
                <div className={styles.pricingPlan}>
                  <span className={styles.pricingAmount}>₹999</span>
                  <span className={styles.pricingPer}>/year</span>
                  <span className={styles.pricingSave}>Save 2 months</span>
                </div>
              </div>
              <ul className={styles.featureList}>
                {[
                  "Unlimited Booking Management",
                  "Real-time Yacht Availability Grid",
                  "Customer & Contact Database",
                  "Boarding Pass Generation (PDF)",
                  "Multi-user Access & Roles",
                  "Booking Status Tracking",
                  "Revenue & Stats Dashboard",
                  "Mobile-friendly Interface",
                  "Priority Support 24/7",
                ].map((f) => (
                  <li key={f} className={styles.featureItem}>
                    <span className={styles.featureCheck}>✓</span>
                    {f}
                  </li>
                ))}
              </ul>

              {/* ── WhatsApp CTA ── */}
              <a
                href="https://wa.me/917058455985?text=Looking%20for%20Yacht%20management%20software"
                target="_blank"
                rel="noopener noreferrer"
                className={styles.whatsappBtn}
              >
                <svg width="18" height="18" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="16" cy="16" r="16" fill="#25D366"/>
                  <path d="M23.5 8.5C21.6 6.6 19.1 5.5 16.4 5.5C10.9 5.5 6.4 10 6.4 15.5C6.4 17.3 6.9 19.1 7.8 20.6L6.3 26L11.8 24.5C13.3 25.3 14.8 25.8 16.4 25.8C21.9 25.8 26.4 21.3 26.4 15.8C26.4 13.1 25.3 10.5 23.5 8.5ZM16.4 24C14.9 24 13.5 23.6 12.2 22.8L11.9 22.6L8.7 23.5L9.6 20.4L9.4 20.1C8.5 18.7 8.1 17.1 8.1 15.5C8.1 11 11.8 7.3 16.4 7.3C18.6 7.3 20.6 8.2 22.1 9.7C23.6 11.2 24.5 13.2 24.5 15.5C24.6 20 20.9 24 16.4 24ZM20.9 17.6C20.6 17.5 19.2 16.8 18.9 16.7C18.6 16.6 18.4 16.5 18.2 16.8C18 17.1 17.5 17.7 17.3 17.9C17.1 18.1 17 18.1 16.7 18C16.4 17.9 15.4 17.5 14.3 16.6C13.4 15.8 12.8 14.8 12.7 14.5C12.5 14.2 12.7 14 12.8 13.9L13.2 13.5C13.3 13.4 13.4 13.2 13.5 13C13.6 12.8 13.6 12.7 13.5 12.4C13.4 12.2 12.8 10.8 12.5 10.2C12.3 9.6 12 9.7 11.8 9.7H11.3C11.1 9.7 10.8 9.8 10.5 10.1C10.3 10.4 9.5 11.1 9.5 12.5C9.5 13.9 10.5 15.2 10.7 15.5C10.9 15.7 12.8 18.6 15.6 19.8C16.3 20.1 16.8 20.3 17.3 20.4C18 20.6 18.7 20.5 19.2 20.4C19.8 20.3 21 19.7 21.3 18.9C21.6 18.2 21.6 17.6 21.5 17.5C21.4 17.5 21.2 17.6 20.9 17.6Z" fill="white"/>
                </svg>
                <span>+91-70584 55985</span>
              </a>

            </div>

            {/* ── Platform stats ── */}
            <div className={styles.statsStrip}>
              <div className={styles.statItem}>
                <svg className={styles.statIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/>
                  <line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                  <circle cx="8" cy="15" r="1" fill="currentColor" stroke="none"/>
                  <circle cx="12" cy="15" r="1" fill="currentColor" stroke="none"/>
                  <circle cx="16" cy="15" r="1" fill="currentColor" stroke="none"/>
                </svg>
                <span className={styles.statValue}>1,200<sup>+</sup></span>
              </div>
              <div className={styles.statDivider} />
              <div className={styles.statItem}>
                <svg className={styles.statIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="9" cy="7" r="3"/>
                  <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/>
                  <circle cx="17" cy="7" r="3"/>
                  <path d="M21 21v-2a4 4 0 0 0-2-3.5"/>
                </svg>
                <span className={styles.statValue}>850<sup>+</sup></span>
              </div>
              <div className={styles.statDivider} />
              <div className={styles.statItem}>
                <svg className={styles.statIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="7" width="20" height="14" rx="2"/>
                  <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
                  <circle cx="12" cy="14" r="2"/>
                  <path d="M9 21v-1a3 3 0 0 1 6 0v1"/>
                </svg>
                <span className={styles.statValue}>45<sup>+</sup></span>
              </div>
            </div>

          </div>

          {/* Strip 2: Dot-yacht particle animation */}
          <div className={styles.rightStrip}>
            <canvas ref={canvasRef} style={{ display: "block" }} />
          </div>{/* end rightStrip */}

        </div>

        {/* ── Right panel: form ── */}
        <div className={styles.loginRight}>
          <div className={styles.loginCard}>

            <div className={styles.loginFormHeader}>
              <h2 className={styles.loginTitle}>Sign in to your account</h2>
            </div>

            <form onSubmit={handleSubmit} className={styles.loginForm} autoComplete="on">

              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>Mobile</label>
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
                    placeholder="Enter username or mobile"
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
                {loading ? "Signing in…" : "Sign In"}
              </button>
            </form>

            {/* Ticket search */}
            <div className={styles.ticketDivider}>
              <span className={styles.ticketDividerText}>or check your booking</span>
            </div>

            <div className={styles.ticketSearchWrap}>
              <label className={styles.ticketSearchLabel}>Ticket ID</label>
              <div className={styles.ticketSearchRow}>
                <input type="text" value={ticket} onChange={handleTicketChange} placeholder="e.g. ABCDE" disabled={searching} />
                <button type="button" className={ticket.length > 0 ? styles.ticketSearchBtnActive : ""} onClick={handleTicketSearch} disabled={searching || ticket.length < 5}>
                  <FiSearch size={16} />
                </button>
              </div>
            </div>

          </div>
        </div>

      </div>
    </>
  );
}

export default Login;
