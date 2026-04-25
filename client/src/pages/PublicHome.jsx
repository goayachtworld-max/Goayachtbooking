import React, { useEffect, useState, useRef } from "react";
import { getPublicYachtsAPI } from "../services/operations/yautAPI";
import {
  getCachedCustomer,
  saveCustomerSession,
  sendCustomerOtpAPI,
  verifyCustomerOtpAPI,
} from "../services/operations/customerAuthAPI";
import { getPublicBookingByIdAPI } from "../services/operations/bookingAPI";
import { PDFDownloadLink } from "@react-pdf/renderer";
import BoardingPassPDF from "./BoardingPassPDF";
import CustomerProfile from "./CustomerProfile";
import MyBookingsPage from "./MyBookingPage";
import toast from "react-hot-toast";
import styles from "../styles/PublicHome.module.css";
import {
  WA_NUMBER, WA_NUMBER_DISPLAY,
  APP_ADDRESS, APP_EMAIL, APP_INSTAGRAM, APP_MAPS,
} from "../constants";

const cx = (...c) => c.filter(Boolean).join(" ");
const fmt = (n) => Number(n || 0).toLocaleString("en-IN");

const FALLBACK = [
  "https://images.unsplash.com/photo-1567899378494-47b22a2ae96a?w=900&q=80",
  "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=900&q=80",
  "https://images.unsplash.com/photo-1605281317010-fe5ffe798166?w=900&q=80",
  "https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=900&q=80",
];
const HERO_IMG = "https://images.unsplash.com/photo-1567899378494-47b22a2ae96a?w=1400&q=80";

/* ─── Slot-building logic (exact mirror of CreateBooking.jsx) ──────────────
   Priority 1: date-specific slots stored on yacht.slots[]
   Priority 2: compute from sailStartTime / sailEndTime / slotDurationMinutes / specialSlots
   Returns [{ start:"HH:MM", end:"HH:MM" }]
─────────────────────────────────────────────────────────────────────────── */
const timeToMin = (t) => {
  if (!t) return 0;
  const [h, m] = String(t).split(":").map(Number);
  return h * 60 + m;
};
const minToTime = (m) => {
  const h = Math.floor(m / 60) % 24;
  const mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
};

function buildSlotsForYacht(yacht, selectedDate) {
  if (!yacht) return [];

  const sailStart = yacht.sailStartTime;
  const sailEnd = yacht.sailEndTime;
  const durationRaw = yacht.slotDurationMinutes || yacht.duration;
  const specialSlots = yacht.specialSlots || yacht.specialSlotTimes || [];

  // Priority 1 — date-specific override slots on the yacht document
  const slotsForDate = yacht.slots?.find(
    (sg) => new Date(sg.date).toDateString() === new Date(selectedDate).toDateString()
  );
  if (slotsForDate?.slots?.length > 0) {
    return slotsForDate.slots
      .map((s) => ({ start: s.start, end: s.end }))
      .sort((a, b) => timeToMin(a.start) - timeToMin(b.start));
  }

  // Priority 2 — compute from config
  if (!sailStart || !sailEnd || !durationRaw) return [];

  let duration = 0;
  if (typeof durationRaw === "string" && durationRaw.includes(":")) {
    const [h, m] = durationRaw.split(":").map(Number);
    duration = h * 60 + (m || 0);
  } else {
    duration = Number(durationRaw);
  }
  if (!duration) return [];

  const startMin = timeToMin(sailStart);
  let endMin = timeToMin(sailEnd);
  const specialMins = specialSlots.map(timeToMin).sort((a, b) => a - b);

  if (endMin <= startMin) endMin += 24 * 60;
  if (sailEnd === "00:00") endMin = 24 * 60 - 1;

  const slots = [];
  let cursor = startMin;
  while (cursor < endMin) {
    const next = cursor + duration;
    const hit = specialMins.find((sp) => sp > cursor && sp < next);
    if (hit) {
      slots.push({ start: cursor, end: hit });
      cursor = hit;
    } else {
      slots.push({ start: cursor, end: Math.min(next, endMin) });
      cursor = next;
    }
  }
  return slots.map((s) => ({ start: minToTime(s.start), end: minToTime(s.end) }));
}

/* Check overlap: handles both {startTime,endTime} and {start,end} shapes */
function overlapsAny(slot, takenList) {
  const sS = timeToMin(slot.start), sE = timeToMin(slot.end);
  return takenList.some((b) => {
    const bS = timeToMin(b.startTime || b.start);
    const bE = timeToMin(b.endTime || b.end);
    return sS < bE && sE > bS;
  });
}

/* 12-hour display */
const to12h = (t) => {
  if (!t) return "";
  const [h, m] = String(t).split(":").map(Number);
  const p = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${p}`;
};

/* ─── SVG Icons ─── */
const IcoHome = () => <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>;
const IcoBookmark = () => <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>;
const IcoBell = () => <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>;
const IcoUser = () => <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>;
const IcoClock = () => <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><path strokeLinecap="round" d="M12 6v6l4 2" /></svg>;
const IcoPeople = () => <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
const IcoArrow = () => <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>;
const IcoCalendar = () => <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" /><path strokeLinecap="round" d="M16 2v4M8 2v4M3 10h18" /></svg>;
const IcoWa = () => <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" /><path d="M12 0C5.373 0 0 5.373 0 12c0 2.125.554 4.122 1.522 5.853L.057 23.547a.5.5 0 0 0 .609.61l5.79-1.519A11.95 11.95 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.882a9.87 9.87 0 0 1-5.031-1.376l-.36-.214-3.733.979.998-3.645-.234-.374A9.869 9.869 0 0 1 2.118 12C2.118 6.534 6.534 2.118 12 2.118S21.882 6.534 21.882 12 17.466 21.882 12 21.882z" /></svg>;


/* ─── Ticket / Booking Search ─── */
function TicketSearch() {
  const [ticket, setTicket] = useState("");
  const [searching, setSearching] = useState(false);
  const [boardingPassBooking, setBoardingPassBooking] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const handleTicketChange = (e) => {
    let value = e.target.value.toUpperCase();
    if (value.length > 6) return;
    setTicket(value);
  };

  const handleTicketSearch = async () => {
    const cleanTicket = ticket.replace("#", "");
    if (cleanTicket.length !== 5) { toast.error("Enter a valid 5-character ticket ID"); return; }
    try {
      setSearching(true);
      const res = await getPublicBookingByIdAPI(cleanTicket);
      const booking = res.data.booking;
      setBoardingPassBooking(booking);
      setShowModal(true);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Booking not found");
    } finally { setSearching(false); }
  };

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
        ["Drone", "DSLR","Ballon"].some((k) => i.includes(k))
      ).map((i) => i.replace("- ", "").trim())
      : [];
    const notes = booking.extraDetails
      ? booking.extraDetails.split("Notes:").slice(1).join("").trim()
      : "";
    return {
      ticketId: booking._id.slice(-5).toUpperCase(),
      status: booking.status,
      guestName: booking.customerId?.name,
      contact: booking.customerId?.contact,
      groupSize: booking.numPeople,
      yacht: booking.yachtId?.name,
      date: formatDate(booking.date),
      time: `${formatTime(booking.startTime)} \u2013 ${formatTime(booking.endTime)}`,
      boardingLocation: booking.yachtId?.boardingLocation,
      pendingAmount: booking.pendingAmount,
      inclusions, paidServices, notes,
      disclaimer: booking.company?.disclaimer ||
        `\u2022 Reporting time is 30 minutes prior to departure\n\u2022 No refund for late arrival or no-show\n\u2022 Subject to weather and government regulations\nThank you for booking with ${booking.company?.name || "us"}`,
    };
  };

  const generateBoardingPassText = (booking) => {
    const p = parseBoardingPass(booking);
    const lines = [
      `⚓ Boarding Pass`,
      `━━━━━━━━━━━━━━━━━━━━━━━`,
      `Ticket #${p.ticketId}`,
      `Status: ${p.status.toUpperCase()}`,
      ``,
      `👤 Guest: ${p.guestName}`,
      `📞 Contact: ${p.contact}`,
      `👥 Group Size: ${p.groupSize} Pax`,
      `⛵ Vessel: ${p.yacht}`,
      `📅 Date: ${p.date}`,
      `🕐 Time: ${p.time}`,
      p.boardingLocation ? `📍 Location: ${p.boardingLocation}` : null,
      p.pendingAmount > 0 ? `💰 Balance Due: ₹${p.pendingAmount}/-` : null,
      p.inclusions.length > 0 ? `\n✅ Inclusions:\n${p.inclusions.map(i => `  • ${i}`).join('\n')}` : null,
      p.paidServices.length > 0 ? `\n💳 Paid Services:\n${p.paidServices.map(i => `  • ${i}`).join('\n')}` : null,
      p.notes ? `\n📝 Notes:\n${p.notes}` : null,
      `\n━━━━━━━━━━━━━━━━━━━━━━━`,
      ...p.disclaimer.split('\n').map(line => line),
    ].filter(l => l !== null);
    return lines.join('\n');
  };

  const copyBoardingPass = (booking) => {
    const text = generateBoardingPassText(booking);
    navigator.clipboard.writeText(text);
    toast.success("Boarding Pass copied to clipboard");
  };

  const statusClass = (status) => {
    if (status === "confirmed") return styles.ts_statusConfirmed;
    if (status === "pending") return styles.ts_statusPending;
    return styles.ts_statusCancelled;
  };

  return (
    <>
      {/* Boarding pass modal */}
      {showModal && boardingPassBooking && (() => {
        const pass = parseBoardingPass(boardingPassBooking);
        return (
          <div className={styles.ts_modalOverlay} onClick={() => setShowModal(false)}>
            <div className={styles.ts_modalContent} onClick={(e) => e.stopPropagation()}>
              <div className={styles.ts_modalHeader}>
                <h3 className={styles.ts_modalTitle}>⚓ Boarding Pass</h3>
                <span className={styles.ts_modalTicketId}>#{pass.ticketId}</span>
              </div>
              <div className={styles.ts_tearLine}><hr /></div>
              <div className={styles.ts_boardingPassBody}>
                <div className={styles.ts_passRow}>
                  <span className={styles.ts_passLabel}>Status</span>
                  <span className={`${styles.ts_statusBadge} ${statusClass(pass.status)}`}>{pass.status.toUpperCase()}</span>
                </div>
                <div className={styles.ts_passRow}><span className={styles.ts_passLabel}>Guest</span><span className={styles.ts_passValue}>{pass.guestName}</span></div>
                <div className={styles.ts_passRow}><span className={styles.ts_passLabel}>Contact</span><span className={styles.ts_passValueMono}>{pass.contact}</span></div>
                <div className={styles.ts_passRow}><span className={styles.ts_passLabel}>Group Size</span><span className={styles.ts_passValue}>{pass.groupSize} Pax</span></div>
                <div className={styles.ts_passRow}><span className={styles.ts_passLabel}>Vessel</span><span className={styles.ts_passValue}>{pass.yacht}</span></div>
                <div className={styles.ts_passRow}><span className={styles.ts_passLabel}>Date</span><span className={styles.ts_passValue}>{pass.date}</span></div>
                <div className={styles.ts_passRow}><span className={styles.ts_passLabel}>Time</span><span className={styles.ts_passValue}>{pass.time}</span></div>
                {pass.boardingLocation && (
                  <div className={styles.ts_passRow}>
                    <span className={styles.ts_passLabel}>Location</span>
                    <span className={styles.ts_passValue} style={{ fontSize: "0.8rem" }}>{pass.boardingLocation}</span>
                  </div>
                )}
                {pass.pendingAmount > 0 && (
                  <div className={styles.ts_passRow}>
                    <span className={styles.ts_passLabel}>Balance Due</span>
                    <span className={styles.ts_pendingAmount}>₹{pass.pendingAmount}/-</span>
                  </div>
                )}
                {pass.inclusions.length > 0 && (
                  <><p className={styles.ts_passSection}>Inclusions</p>
                    <div className={styles.ts_inclusionList}>
                      {pass.inclusions.map((item) => <span key={item} className={styles.ts_inclusionChip}>{item}</span>)}
                    </div></>
                )}
                {pass.paidServices.length > 0 && (
                  <><p className={styles.ts_passSection}>Paid Services</p>
                    <div className={styles.ts_inclusionList}>
                      {pass.paidServices.map((item) => <span key={item} className={styles.ts_inclusionChip}>{item}</span>)}
                    </div></>
                )}
                {pass.notes && (
                  <><p className={styles.ts_passSection}>Notes</p>
                    <div className={styles.ts_notesBox}>{pass.notes}</div></>
                )}
                <div className={styles.ts_disclaimerBox}>
                  {pass.disclaimer.split("\n").map((line, i) => <div key={i}>{line}</div>)}
                </div>
              </div>
              <div className={styles.ts_actions}>
                <button className={styles.ts_copyBtn} onClick={() => copyBoardingPass(boardingPassBooking)}>Copy</button>
                {boardingPassBooking && (
                  <PDFDownloadLink document={<BoardingPassPDF booking={boardingPassBooking} />} fileName={`${pass.yacht}_${pass.guestName}_${pass.date}.pdf`}>
                    {({ loading }) => <button type="button" className={styles.ts_downloadBtn}>{loading ? "Preparing..." : "Download PDF"}</button>}
                  </PDFDownloadLink>
                )}
                <button className={styles.ts_closeBtn} onClick={() => setShowModal(false)}>Close</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Search bar */}
      <div className={styles.ticketSearchSection}>
        <p className={styles.ticketSearchLabel}>Already booked? Check your booking</p>
        <div className={styles.ticketSearchRow}>
          <input
            type="text"
            value={ticket}
            onChange={handleTicketChange}
            placeholder="Ticket ID e.g. ABCDE"
            disabled={searching}
            onKeyDown={(e) => e.key === "Enter" && handleTicketSearch()}
          />
          <button type="button" onClick={handleTicketSearch} disabled={searching || ticket.replace("#", "").length < 5}>
            {searching
              ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
              : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path strokeLinecap="round" d="m21 21-4.35-4.35" /></svg>
            }
          </button>
        </div>
      </div>
    </>
  );
}

/* ─── Logo ─── */
function Logo() {
  return (
    <div className={styles.logo}>
      <div className={styles.logo__icon}>
        <svg width="22" height="22" fill="none" stroke="white" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 17l9-13 9 13M3 17h18M12 4v13" />
        </svg>
      </div>
      <div className={styles.logo__text}>
        <span className={styles.logo__top}>GoaBoat</span>
        <span className={styles.logo__sub}>Yacht Charters</span>
      </div>
    </div>
  );
}

/* ─── Sidebar ─── */
function Sidebar({ active, setActive, onMyBookings, onProfile, onGoHome }) {
  const items = [
    { id: "home", label: "Home", Icon: IcoHome },
    { id: "bookings", label: "My Bookings", Icon: IcoBookmark },
    { id: "contact", label: "Contact", Icon: IcoBell },
    { id: "profile", label: "Profile & Settings", Icon: IcoUser },
  ];
  return (
    <aside className={styles.sidebar}>
      <Logo />
      <nav className={styles.sidebar__nav}>
        {items.map(({ id, label, Icon }) => (
          <button key={id}
            className={cx(styles.sidebar__item, active === id && styles["sidebar__item--on"])}
            onClick={() => {
              if (id === "bookings") { onMyBookings(); return; }
              if (id === "profile") { onProfile(); return; }
              onGoHome(id);
            }}>
            <Icon /><span>{label}</span>
          </button>
        ))}
      </nav>
      <a href={`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent("Hi! I'd like to book a yacht in Goa.")}`}
        target="_blank" rel="noreferrer" className={styles.sidebar__wa}>
        <IcoWa /> WhatsApp Us
      </a>
      <a href="/login" className={styles.sidebar__staff}>Staff Portal ↗</a>
    </aside>
  );
}

/* ─── Mobile Header ─── */
function MobileHeader() {
  return (
    <header className={styles.mob_hd}>
      <Logo />
      <a href={`https://wa.me/${WA_NUMBER}`} target="_blank" rel="noreferrer" className={styles.mob_hd__wa}>
        <IcoWa />
      </a>
    </header>
  );
}

/* ─── Mobile Tab Bar ─── */
function MobileTabBar({ active, setActive, onMyBookings, onProfile, onGoHome }) {
  const tabs = [
    { id: "home", label: "Home", Icon: IcoHome },
    { id: "bookings", label: "Bookings", Icon: IcoBookmark },
    { id: "contact", label: "Contact", Icon: IcoBell },
    { id: "profile", label: "Profile", Icon: IcoUser },
  ];
  return (
    <nav className={styles.tabbar}>
      {tabs.map(({ id, label, Icon }) => (
        <button key={id}
          className={cx(styles.tabbar__btn, active === id && styles["tabbar__btn--on"])}
          onClick={() => {
            if (id === "bookings") { onMyBookings(); return; }
            if (id === "profile") { onProfile(); return; }
            onGoHome(id);
          }}>
          <Icon /><span>{label}</span>
        </button>
      ))}
      <a href="/login" className={styles.tabbar__staff}>
        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
        <span>Staff</span>
      </a>
    </nav>
  );
}

/* ─── Hero Banner ─── */
function HeroBanner() {
  return (
    <div className={styles.hero}>
      <img src={HERO_IMG} alt="GoaBoat" className={styles.hero__img} onError={e => e.target.src = FALLBACK[0]} />
      <div className={styles.hero__overlay}>
        <p className={styles.hero__ghost}>Yacht Charters in Goa</p>
        <h1 className={styles.hero__title}>Yacht Charters in Goa</h1>
        <div className={styles.hero__line} />
      </div>
    </div>
  );
}

/* ─── Yacht Card ─── */
function YachtCard({ yacht, onBook }) {
  const imgs = yacht.photos?.length ? yacht.photos : FALLBACK;
  const [idx, setIdx] = useState(0);
  const timer = useRef(null);

  useEffect(() => {
    if (imgs.length <= 1) return;
    timer.current = setInterval(() => setIdx(i => (i + 1) % imgs.length), 3500);
    return () => clearInterval(timer.current);
  }, [imgs.length]);

  const disc = yacht.maxSellingPrice && yacht.sellingPrice < yacht.maxSellingPrice
    ? Math.round(((yacht.maxSellingPrice - yacht.sellingPrice) / yacht.maxSellingPrice) * 100) : 0;

  return (
    <div className={styles.card}>
      <div className={styles.card__img_wrap} onClick={() => onBook(yacht)} style={{ cursor: "pointer" }}>
        {imgs.map((src, i) => (
          <img key={i} src={src} alt={yacht.name}
            className={cx(styles.card__img, i === idx && styles["card__img--on"])}
            onError={e => e.target.src = FALLBACK[0]} />
        ))}
        <div className={styles.card__img_hover}><span>Book Now</span></div>
        <span className={styles.card__price_badge}>₹{fmt(yacht.sellingPrice)} / slot</span>
        {disc > 0 && <span className={styles.card__disc_badge}>{disc}% OFF</span>}
        {imgs.length > 1 && (
          <div className={styles.card__dots}>
            {imgs.slice(0, 8).map((_, i) => (
              <span key={i} className={cx(styles.card__dot, i === idx && styles["card__dot--on"])}
                onClick={e => { e.stopPropagation(); setIdx(i); clearInterval(timer.current); }} />
            ))}
          </div>
        )}
      </div>
      <div className={styles.card__body}>
        <h3 className={styles.card__name}>{yacht.name}</h3>
        {yacht.description && <p className={styles.card__desc}>{yacht.description}</p>}
        {disc > 0 && (
          <p className={styles.card__orig}>
            <s>₹{fmt(yacht.maxSellingPrice)}</s>
            <span className={styles.card__save}> Save ₹{fmt(yacht.maxSellingPrice - yacht.sellingPrice)}</span>
          </p>
        )}
        <div className={styles.card__meta}>
          {yacht.capacity && <span className={styles.card__meta_item}><IcoPeople /> Max {yacht.capacity} pax</span>}
          {yacht.sailStartTime && <span className={styles.card__meta_item}><IcoClock /> {to12h(yacht.sailStartTime)}</span>}
          {yacht.size && <span className={styles.card__meta_item}>📐 {yacht.size} ft</span>}
          <button className={styles.card__arrow_btn} onClick={() => onBook(yacht)}><IcoArrow /></button>
        </div>
      </div>
    </div>
  );
}

/* ─── Login Gate ─── */
/* Shown when a user clicks Book without being logged in.
   Uses OTP via WhatsApp so they're properly identified
   before the WhatsApp booking message is sent.
*/

function useCountdown() {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft(l => l - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);
  return { left, start: (s = 60) => setLeft(s) };
}

function LoginGate({ onSuccess, onClose }) {
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const { left, start } = useCountdown();
  const digits = phone.replace(/\D/g, "");

  const handleSend = async () => {
    if (digits.length < 10) return toast.error("Enter a valid 10-digit number");
    setBusy(true);
    try {
      await sendCustomerOtpAPI(digits);
      setStep(2); start();
      toast.success("OTP sent to your WhatsApp!");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to send OTP");
    } finally { setBusy(false); }
  };

  const handleVerify = async () => {
    if (otp.length < 4) return toast.error("Enter the OTP from WhatsApp");
    setBusy(true);
    try {
      const res = await verifyCustomerOtpAPI(digits, otp);
      const d = res.data;
      saveCustomerSession(d.token, d.customer);
      toast.success(d.isNewCustomer ? "Welcome! 🎉" : "Welcome back!");
      onSuccess(d.customer);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Invalid OTP");
    } finally { setBusy(false); }
  };

  const handleResend = async () => {
    if (left > 0) return;
    setBusy(true);
    try {
      await sendCustomerOtpAPI(digits);
      setOtp(""); start();
      toast.success("New OTP sent!");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to resend");
    } finally { setBusy(false); }
  };

  return (
    <div className={styles.gate_wrap} onClick={onClose}>
      <div className={styles.gate} onClick={e => e.stopPropagation()}>
        <div className={styles.gate__logo_wrap}>
          <div className={styles.gate__logo_icon}>
            <svg width="28" height="28" fill="none" stroke="white" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 17l9-13 9 13M3 17h18M12 4v13" />
            </svg>
          </div>
        </div>

        <h2 className={styles.gate__title}>Quick Login to Book</h2>

        {step === 1 ? (
          <>
            <p className={styles.gate__sub}>
              We'll send a free OTP to your WhatsApp to verify your number.
            </p>
            <div className={styles.gate__field}>
              <div className={styles.gate__prefix_row}>
                <span className={styles.gate__prefix}>+91</span>
                <input
                  type="tel" maxLength={10} placeholder="10-digit number"
                  value={phone}
                  onChange={e => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  onKeyDown={e => e.key === "Enter" && handleSend()}
                  autoFocus
                />
              </div>
            </div>
            <button className={styles.gate__btn}
              onClick={handleSend}
              disabled={busy || digits.length < 10}>
              {busy ? "Sending…" : "📲 Send OTP via WhatsApp"}
            </button>
          </>
        ) : (
          <>
            <p className={styles.gate__sub}>
              OTP sent to <b>+91 {digits}</b>.<br />
              <span style={{ color: "#25d366", fontWeight: 700 }}>📲 Check your WhatsApp</span>
            </p>
            <div className={styles.gate__field}>
              <input
                className={styles.gate__otp}
                type="text" inputMode="numeric" maxLength={6}
                placeholder="· · · · · ·" value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                onKeyDown={e => e.key === "Enter" && handleVerify()}
                autoFocus
              />
            </div>
            <button className={styles.gate__btn}
              onClick={handleVerify}
              disabled={busy || otp.length < 4}>
              {busy ? "Verifying…" : "Verify & Continue"}
            </button>
            <div className={styles.gate__resend}>
              {left > 0
                ? <span>Resend in {left}s</span>
                : <button onClick={handleResend} disabled={busy}>Resend OTP</button>
              }
              <button onClick={() => { setStep(1); setOtp(""); }}>Change number</button>
            </div>
          </>
        )}

        <p className={styles.gate__stars}>⭐⭐⭐⭐⭐ <strong>5.0</strong> · Rated on Google</p>
      </div>
    </div>
  );
}

/* ─── Date Strip ─── */
/* 30-day scrollable strip. Auto-scrolls selected date into view. */
function DateStrip({ selDate, setSelDate }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return d;
  });
  const stripRef = useRef(null);

  // Scroll selected date into view on desktop; no-op on mobile (handled naturally)
  useEffect(() => {
    if (!selDate || !stripRef.current) return;
    const idx = days.findIndex(d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` === selDate);
    if (idx >= 0) {
      const el = stripRef.current.children[idx];
      el?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
    }
  }, [selDate]); // eslint-disable-line

  return (
    <div className={styles.date_strip_wrap}>
      <div ref={stripRef} className={styles.date_strip} aria-label="Select a date">
        {days.map(d => {
          const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
          const active = ds === selDate;
          const isTod = d.toDateString() === today.toDateString();
          return (
            <button key={ds} onClick={() => setSelDate(ds)}
              className={cx(styles.date_btn, active && styles["date_btn--on"])}>
              <span className={styles.date_btn__dow}>
                {isTod ? "TODAY" : d.toLocaleDateString("en-IN", { weekday: "short" }).toUpperCase()}
              </span>
              <span className={styles.date_btn__day}>{d.getDate()}</span>
              <span className={styles.date_btn__mon}>
                {d.toLocaleDateString("en-IN", { month: "short" }).toUpperCase()}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Slot Grid ─────────────────────────────────────────────────────────────
   Builds slots on the FRONTEND using the same logic as CreateBooking.jsx.
   Then cross-checks against yacht.bookings[] that already comes from
   getPublicYachtsAPI (the /yacht/public endpoint returns bookings per yacht).

   When we have the new /public/slots endpoint available (ENV ready),
   it will replace the fetch call here — but the slot-building fallback
   keeps working even without it.
─────────────────────────────────────────────────────────────────────────── */
/* SlotGrid
   - Builds slots from yacht config (same algorithm as CreateBooking.jsx)
   - yacht.bookings[] comes from getPublicYachtsAPI(?date=) — populated live
     when the user picks a date inside BookingFlow via liveYacht state.
   - loading=true shows skeleton while the date-specific fetch is in-flight.
*/
function SlotGrid({ yacht, selDate, selSlot, setSelSlot, loading }) {
  const [slots, setSlots] = useState([]);

  useEffect(() => {
    if (!selDate || !yacht) { setSlots([]); setSelSlot(null); return; }

    // Build all slots for this yacht + date
    const rawSlots = buildSlotsForYacht(yacht, selDate);

    // yacht.bookings is populated by BookingFlow via liveYacht (fetched with ?date=selDate)
    // Each entry: { startTime: "HH:MM", endTime: "HH:MM" }
    const taken = yacht.bookings || [];

    const withStatus = rawSlots.map(s => ({
      ...s,
      available: !overlapsAny(s, taken),
    }));

    setSlots(withStatus);
    // Do NOT reset selSlot here — we rebuild slots when yacht updates after fetch;
    // we only reset when selDate changes (handled by DateStrip parent).
  }, [yacht]); // eslint-disable-line

  // Reset slot when date changes
  useEffect(() => {
    setSelSlot(null);
    setSlots([]);
  }, [selDate]); // eslint-disable-line

  if (!selDate) return (
    <p className={styles.slot_hint}>Select a date above to see available slots</p>
  );

  // Show shimmer skeleton while fetching availability for selected date
  if (loading) return (
    <div>
      <div className={styles.slot_loading_row}>
        {[0, 1].map(i => <div key={i} className={styles.slot_skeleton} />)}
      </div>
      <div className={styles.slot_loading_row}>
        {[0, 1].map(i => <div key={i} className={styles.slot_skeleton} />)}
      </div>
    </div>
  );

  if (!slots.length) return (
    <p className={styles.slot_hint}>No slots configured for this yacht</p>
  );

  const availCount = slots.filter(s => s.available).length;

  return (
    <div>
      {/* Availability pill */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "1rem" }}>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: "6px",
          padding: "5px 12px", borderRadius: "999px", fontSize: "0.72rem",
          fontWeight: 700, letterSpacing: "0.04em",
          background: availCount === 0 ? "#fee2e2" : availCount <= 2 ? "#fef9c3" : "#dcfce7",
          color: availCount === 0 ? "#dc2626" : availCount <= 2 ? "#ca8a04" : "#16a34a",
        }}>
          <span style={{
            width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
            background: availCount === 0 ? "#dc2626" : availCount <= 2 ? "#ca8a04" : "#16a34a",
          }} />
          {availCount === 0 ? "Fully booked"
            : availCount <= 2 ? `Only ${availCount} left!`
              : `${availCount} slots available`}
        </span>
        <div style={{ flex: 1, height: 4, borderRadius: 99, background: "#f1f5f9", overflow: "hidden" }}>
          <div style={{
            height: "100%", borderRadius: 99,
            background: availCount === 0 ? "#fca5a5" : availCount <= 2 ? "#fde047" : "#4ade80",
            width: `${Math.round((availCount / slots.length) * 100)}%`,
            transition: "width 0.4s ease",
          }} />
        </div>
      </div>

      {/* Flat slot grid — no session groupings */}
      <div className={styles.slot_grid}>
        {slots.map(s => {
          const picked = selSlot?.start === s.start;
          return (
            <button
              key={s.start}
              disabled={!s.available}
              onClick={() => s.available && setSelSlot(s)}
              className={cx(
                styles.slot_btn,
                picked && styles["slot_btn--on"],
                !s.available && styles["slot_btn--full"],
              )}
              style={{
                position: "relative",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                padding: "14px 10px",
                borderRadius: "12px",
                border: picked ? "2px solid #0f172a" : "1.5px solid #e2e8f0",
                background: picked ? "#0f172a" : !s.available ? "#f8fafc" : "#fff",
                color: picked ? "#fff" : !s.available ? "#cbd5e1" : "#0f172a",
                fontWeight: 600,
                fontSize: "0.82rem",
                letterSpacing: "0.01em",
                cursor: s.available ? "pointer" : "not-allowed",
                transition: "all 0.15s ease",
                boxShadow: picked ? "0 4px 14px rgba(15,23,42,0.18)" : s.available ? "0 1px 4px rgba(0,0,0,0.06)" : "none",
              }}
            >
              <span>{to12h(s.start)}</span>
              <span style={{ opacity: 0.4, fontSize: "0.7rem" }}>→</span>
              <span>{to12h(s.end)}</span>
              {!s.available && (
                <span style={{
                  position: "absolute", top: 5, right: 6,
                  fontSize: "0.55rem", fontWeight: 800, letterSpacing: "0.08em",
                  color: "#f87171", textTransform: "uppercase",
                }}>FULL</span>
              )}
              {picked && (
                <span style={{
                  position: "absolute", top: 5, right: 7,
                  fontSize: "0.65rem", color: "#a3e635",
                }}>✓</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Booking Flow ──────────────────────────────────────────────────────────
   Steps:
     1 — Date & Slot
     2 — Your Details + Add-ons → sends pre-filled WhatsApp message
─────────────────────────────────────────────────────────────────────────── */
const ADDONS_LIST = [
  { id: "deco", label: "🎨 Decoration", price: "upto ₹4,000" },
  { id: "dslr", label: "📷 DSLR Photographer", price: "upto ₹5,000" },
  { id: "drone", label: "🚁 Drone Videographer", price: "upto ₹5,000" },
  { id: "snacks", label: "🍿 Snacks & Beverages", price: "on request" },
];

const STEP_LABELS = ["Date & Slot", "Your Details"];

function BookingFlow({ yacht, user: initialUser, onDone, onBack, onUserLogin }) {
  const [step, setStep] = useState(1);
  const [selDate, setSelDate] = useState("");
  const [selSlot, setSelSlot] = useState(null);
  const [addons, setAddons] = useState([]);
  const [liveYacht, setLiveYacht] = useState(yacht);
  const [slotLoading, setSlotLoading] = useState(false);
  const [showLoginGate, setShowLoginGate] = useState(false);
  const [currentUser, setCurrentUser] = useState(initialUser);
  const [form, setForm] = useState({
    name: (initialUser && !initialUser.guest) ? (initialUser.name || "") : "",
    phone: (initialUser && !initialUser.guest) ? (initialUser.contact || initialUser.phone || "") : "",
    email: (initialUser && !initialUser.guest) ? (initialUser.email || "") : "",
    pax: 2,
  });

  const bodyRef = useRef(null);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const price = yacht.sellingPrice || 0;

  // Re-fetch yacht with live bookings when date changes
  useEffect(() => {
    if (!selDate) return;
    setSlotLoading(true);
    getPublicYachtsAPI(selDate)
      .then(res => {
        const list = res?.data?.yachts || res?.yachts || [];
        const fresh = list.find(y => y._id === yacht._id || y.id === yacht._id);
        if (fresh) setLiveYacht(fresh);
      })
      .catch(() => { })
      .finally(() => setSlotLoading(false));
  }, [selDate]); // eslint-disable-line

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    bodyRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [step]);

  const toggleAddon = id => setAddons(a => a.includes(id) ? a.filter(x => x !== id) : [...a, id]);

  // Called after successful OTP login inside the booking flow
  const handleLoginSuccess = (u) => {
    setCurrentUser(u);
    setShowLoginGate(false);
    onUserLogin?.(u);
    // Pre-fill form with verified details
    setForm(f => ({
      ...f,
      name: f.name || u.name || "",
      phone: f.phone || u.contact || u.phone || "",
      email: f.email || u.email || "",
    }));
    // Immediately send WA after login
    sendWhatsAppMsg(u);
  };

  const sendWhatsApp = () => {
    const cleanPhone = form.phone.replace(/\D/g, "").slice(-10);
    if (!form.name.trim()) return toast.error("Please enter your name");
    if (cleanPhone.length < 10) return toast.error("Enter a valid 10-digit phone number");
    // If not logged in, show login gate first — will call sendWhatsAppMsg after
    if (!currentUser) { setShowLoginGate(true); return; }
    sendWhatsAppMsg(currentUser);
  };

  const sendWhatsAppMsg = (u) => {
    const cleanPhone = form.phone.replace(/\D/g, "").slice(-10);
    const dateStr = new Date(selDate + "T00:00:00").toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    const slotStr = `${to12h(selSlot.start)} – ${to12h(selSlot.end)}`;
    const addonStr = addons.length
      ? addons.map(id => ADDONS_LIST.find(a => a.id === id)?.label).filter(Boolean).join(", ")
      : "None";
    const phone = cleanPhone || u?.contact?.replace(/\D/g, "").slice(-10) || "";

    const msg = [
      `🛥️ *New Booking Request — ${yacht.name}*`,
      ``,
      `📅 Date: ${dateStr}`,
      `🕐 Slot: ${slotStr}`,
      `👥 Guests: ${form.pax} pax`,
      ``,
      `👤 Name: ${form.name.trim() || u?.name || ""}`,
      `📱 Phone: +91 ${phone}`,
      form.email.trim() ? `📧 Email: ${form.email.trim()}` : null,
      ``,
      `🎁 Add-ons: ${addonStr}`,
      `💰 Charter Price: ₹${fmt(price)}`,
      ``,
      `Please confirm my booking. Thank you!`,
    ].filter(l => l !== null).join("\n");

    window.open(`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`, "_blank", "noreferrer");
  };

  return (
    <div className={styles.bflow} ref={bodyRef}>

      {/* ── Login gate — shown only when user taps Book without being logged in ── */}
      {showLoginGate && (
        <LoginGate
          onSuccess={handleLoginSuccess}
          onClose={() => setShowLoginGate(false)}
        />
      )}

      {/* ── Hero ── */}
      <div className={styles.bflow__hero}>
        <img src={yacht.photos?.[0] || FALLBACK[0]} alt={yacht.name}
          className={styles.bflow__himg} onError={e => e.target.src = FALLBACK[0]} />
        <div className={styles.bflow__hovl} />
        <div className={styles.bflow__hcontent}>
          <button className={styles.bflow__hback} onClick={onBack}>
            <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <div className={styles.bflow__hinfo}>
            <h2 className={styles.bflow__hname}>{yacht.name}</h2>
            {yacht.description && (
              <p className={styles.bflow__hdesc}>{yacht.description.slice(0, 120)}{yacht.description.length > 120 ? "…" : ""}</p>
            )}
            <div className={styles.bflow__htags}>
              {yacht.capacity && (
                <span className={styles.bflow__htag}><IcoPeople /> Max {yacht.capacity} pax</span>
              )}
              {yacht.slotDurationMinutes && (
                <span className={styles.bflow__htag}><IcoClock /> {Math.floor(yacht.slotDurationMinutes / 60)}h {yacht.slotDurationMinutes % 60 ? yacht.slotDurationMinutes % 60 + "m" : ""} slot</span>
              )}
              <span className={styles.bflow__htag_gold}>₹{fmt(price)} / slot</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── White card ── */}
      <div className={styles.bflow__card}>

        {/* Step indicator */}
        <div className={styles.bflow__steps}>
          <div className={styles.bflow__step_row}>
            {STEP_LABELS.map((label, i) => {
              const n = i + 1;
              return (
                <React.Fragment key={n}>
                  <div className={cx(
                    styles.bflow__step_dot,
                    step === n && styles["bflow__step_dot--active"],
                    step > n && styles["bflow__step_dot--done"],
                  )}>
                    {step > n ? "✓" : n}
                  </div>
                  {n < STEP_LABELS.length && (
                    <div className={cx(styles.bflow__step_line, step > n && styles["bflow__step_line--done"])} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
          <div className={styles.bflow__step_lblrow}>
            {STEP_LABELS.map((label, i) => (
              <span key={i} className={cx(styles.bflow__step_lbl, step >= i + 1 && styles["bflow__step_lbl--on"])}>
                {label}
              </span>
            ))}
          </div>
        </div>

        <div className={styles.bflow__body}>

          {/* ══ STEP 1 — Date & Slot ══ */}
          {step === 1 && (
            <div>
              <h3 className={styles.bflow__section_title}><IcoCalendar /> Pick a Date</h3>
              <DateStrip selDate={selDate} setSelDate={setSelDate} />

              {selDate && (
                <div style={{ marginTop: "1.5rem" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
                    <span style={{ fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#64748b" }}>
                      Available Slots
                    </span>
                    <span style={{ fontSize: "0.78rem", color: "#94a3b8" }}>
                      {new Date(selDate + "T00:00:00").toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
                    </span>
                  </div>
                  <SlotGrid yacht={liveYacht} selDate={selDate} selSlot={selSlot} setSelSlot={setSelSlot} loading={slotLoading} />
                </div>
              )}

              <div className={styles.bflow__actions}>
                <button
                  className={cx(styles.bflow__cta, (!selDate || !selSlot) && styles["bflow__cta--dis"])}
                  disabled={!selDate || !selSlot}
                  onClick={() => setStep(2)}>
                  {selSlot ? `Continue — ${to12h(selSlot.start)} → ${to12h(selSlot.end)}` : "Select a slot to continue"}
                </button>
              </div>
            </div>
          )}

          {/* ══ STEP 2 — Your Details ══ */}
          {step === 2 && (
            <div>
              {/* Recap pill */}
              <div className={styles.bflow__recap}>
                <div className={styles.bflow__recap_info}>
                  <span>{new Date(selDate + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}</span>
                  <span className={styles.bflow__recap_sep}>·</span>
                  <span>{to12h(selSlot?.start)} – {to12h(selSlot?.end)}</span>
                </div>
                <button onClick={() => setStep(1)} className={styles.bflow__recap_edit}>Edit</button>
              </div>

              <h3 className={styles.bflow__section_title}><IcoUser /> Your Details</h3>
              <div className={styles.bflow__form}>
                <div className={styles.bflow__field}>
                  <label>Full Name <span className={styles.req}>*</span></label>
                  <input value={form.name} onChange={e => set("name", e.target.value)}
                    placeholder="Your full name" autoFocus />
                </div>
                <div className={styles.bflow__field}>
                  <label>WhatsApp / Phone <span className={styles.req}>*</span></label>
                  <input type="tel" value={form.phone}
                    onChange={e => set("phone", e.target.value.replace(/[^\d+]/g, "").slice(0, 13))}
                    placeholder="+91 or 10-digit" />
                </div>
                <div className={styles.bflow__field}>
                  <label>Email <span className={styles.opt}>(optional)</span></label>
                  <input type="email" value={form.email}
                    onChange={e => set("email", e.target.value)}
                    placeholder="you@example.com" />
                </div>

                {/* Single PAX counter */}
                <div className={styles.bflow__field}>
                  <label>Number of Guests</label>
                  <div style={{ display: "flex", alignItems: "center", gap: "0" }}>
                    <button type="button"
                      onClick={() => set("pax", Math.max(1, form.pax - 1))}
                      style={{
                        width: 40, height: 40, borderRadius: "10px 0 0 10px",
                        border: "1.5px solid #e2e8f0", borderRight: "none",
                        background: "#f8fafc", fontSize: "1.2rem", cursor: "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        color: "#475569", fontWeight: 700,
                      }}>−</button>
                    <span style={{
                      minWidth: 52, height: 40, display: "flex", alignItems: "center",
                      justifyContent: "center", border: "1.5px solid #e2e8f0",
                      fontSize: "1rem", fontWeight: 700, color: "#0f172a", background: "#fff",
                    }}>{form.pax}</span>
                    <button type="button"
                      onClick={() => set("pax", form.pax + 1)}
                      style={{
                        width: 40, height: 40, borderRadius: "0 10px 10px 0",
                        border: "1.5px solid #e2e8f0", borderLeft: "none",
                        background: "#f8fafc", fontSize: "1.2rem", cursor: "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        color: "#475569", fontWeight: 700,
                      }}>+</button>
                    {yacht.capacity && (
                      <span style={{ marginLeft: 10, fontSize: "0.75rem", color: "#94a3b8" }}>
                        Max {yacht.capacity} pax
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {yacht.capacity && form.pax > yacht.capacity && (
                <div className={styles.bflow__warn}>
                  ⚠️ Exceeds max capacity of {yacht.capacity} guests
                </div>
              )}

              <h3 className={styles.bflow__section_title} style={{ marginTop: "1.5rem" }}>
                Optional Add-ons
              </h3>
              <div className={styles.bflow__addons}>
                {ADDONS_LIST.map(a => (
                  <label key={a.id}
                    className={cx(styles.bflow__addon, addons.includes(a.id) && styles["bflow__addon--on"])}>
                    <input type="checkbox" checked={addons.includes(a.id)} onChange={() => toggleAddon(a.id)} />
                    <span className={styles.bflow__addon_label}>{a.label}</span>
                    <span className={styles.bflow__addon_price}>{a.price}</span>
                  </label>
                ))}
              </div>

              {/* Price summary */}
              <div style={{
                margin: "1.25rem 0 0", padding: "1rem 1.125rem",
                background: "#f8fafc", borderRadius: 12, border: "1.5px solid #e2e8f0",
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                <span style={{ fontSize: "0.82rem", color: "#64748b", fontWeight: 600 }}>Charter Price</span>
                <span style={{ fontSize: "1.1rem", fontWeight: 800, color: "#0f172a" }}>₹{fmt(price)}</span>
              </div>

              {/* WhatsApp Book CTA */}
              <button
                className={cx(styles.bflow__cta,
                  (!form.name || !form.phone || !!(yacht.capacity && form.pax > yacht.capacity)) && styles["bflow__cta--dis"])}
                disabled={!form.name || !form.phone || !!(yacht.capacity && form.pax > yacht.capacity)}
                onClick={sendWhatsApp}
                style={{ marginTop: "1rem", background: "#25d366", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
              >
                <IcoWa /> Book via WhatsApp
              </button>
              <p style={{ textAlign: "center", fontSize: "0.72rem", color: "#94a3b8", marginTop: "0.5rem" }}>
                This will open WhatsApp with your booking details pre-filled
              </p>
              <button className={styles.bflow__back} onClick={() => setStep(1)}>← Back</button>
            </div>
          )}

        </div>{/* /bflow__body */}
      </div>{/* /bflow__card */}
    </div>
  );
}

/* ─── Contact Section ─── */
function ContactSection() {
  const links = [
    {
      lbl: "WhatsApp", val: WA_NUMBER_DISPLAY, href: `https://wa.me/${WA_NUMBER}`, clr: "#25d366",
      ico: <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
    },
    {
      lbl: "Email", val: APP_EMAIL, href: `mailto:${APP_EMAIL}`, clr: "#60a5fa",
      ico: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></svg>
    },
    {
      lbl: "Location", val: APP_ADDRESS, href: APP_MAPS, clr: "#fb923c",
      ico: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>
    },
    {
      lbl: "Instagram", val: "@goaboat", href: APP_INSTAGRAM, clr: "#f472b6",
      ico: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="20" height="20" rx="5" /><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" /><line x1="17.5" y1="6.5" x2="17.51" y2="6.5" strokeLinecap="round" /></svg>
    },
  ];
  return (
    <footer id="contact" className={styles.footer}>
      <div className={styles.footer__inner}>
        {/* <div className={styles.footer__brand}>
          <div className={styles.footer__logo}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M3 17l9-11 9 11M3 17h18M8 17v3m8-3v3"/>
            </svg>
          </div>
          <div>
            <div className={styles.footer__name}>GoaBoat</div>
            <div className={styles.footer__tagline}>Yacht Charters · Goa</div>
          </div>
        </div> */}
        {/* <p className={styles.footer__desc}>Private yacht charters on the sun-drenched waters of Goa.<br/>Available 7 days a week, 7 AM – 8 PM.</p> */}
        {/* <div className={styles.footer__divider} /> */}
        <div className={styles.footer__grid}>
          {links.map(({ lbl, val, href, ico, clr }) => (
            <a key={lbl} href={href} target="_blank" rel="noreferrer" className={styles.footer__link}>
              <div className={styles.footer__link_ico} style={{ color: clr, background: clr + "1a" }}>{ico}</div>
              <div>
                <div className={styles.footer__link_lbl}>{lbl}</div>
                <div className={styles.footer__link_val}>{val}</div>
              </div>
            </a>
          ))}
        </div>
        <div className={styles.footer__bottom}>
          <span>© {new Date().getFullYear()} GoaBoat. All rights reserved.</span>
          <span>Made with ⚓ in Goa</span>
        </div>
      </div>
    </footer>
  );
}

/* ─── Root ─── */
export default function PublicHome({ singleYachtId }) {
  const [yachts, setYachts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeNav, setActiveNav] = useState("home");
  const [view, setView] = useState("home"); // "home" | "booking" | "bookings"
  const [pendingYacht, setPendingYacht] = useState(null);
  const [user, setUser] = useState(() => getCachedCustomer());
  const [showProfile, setShowProfile] = useState(false);
  const [profileTab, setProfileTab] = useState("profile");
  const [fleetFilter, setFleetFilter] = useState({ capacity: "all", price: "all" });

  useEffect(() => {
    (async () => {
      try {
        const res = await getPublicYachtsAPI();
        let list = res?.data?.yachts || res?.yachts || [];
        if (!Array.isArray(list)) list = [];
        if (singleYachtId) list = list.filter(y => y._id === singleYachtId || y.id === singleYachtId);
        setYachts(list);
      } catch { toast.error("Failed to load fleet"); }
      finally { setLoading(false); }
    })();
  }, [singleYachtId]);

  const handleBookClick = (yacht) => {
    setPendingYacht(yacht);
    setView("booking");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleGoHome = (id) => {
    setView("home");
    setActiveNav(id);
    if (id === "home") window.scrollTo({ top: 0, behavior: "smooth" });
    if (id === "contact") setTimeout(() =>
      document.getElementById("contact")?.scrollIntoView({ behavior: "smooth" }), 60);
  };

  const openPanel = (tab) => {
    if (tab === "bookings") {
      // Open full bookings page instead of small panel
      setView("bookings");
      setActiveNav("bookings");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setProfileTab(tab);
    setShowProfile(true);
    setActiveNav("profile");
  };

  return (
    <div className={styles.root}>
      <Sidebar
        active={activeNav} setActive={setActiveNav}
        onMyBookings={() => openPanel("bookings")}
        onProfile={() => openPanel("profile")}
        onGoHome={handleGoHome}
      />

      <MobileHeader />

      <main className={styles.main}>
        {view === "home" && (<>
          {!singleYachtId && <HeroBanner />}
          {!singleYachtId && <TicketSearch />}
          <div className={styles.fleet}>
            <h2 className={styles.fleet__title}>{singleYachtId ? "Your Yacht" : "Our Fleet"}</h2>
            <p className={styles.fleet__sub}>
              {singleYachtId
                ? "Complete your booking below"
                : "Experience Goa's finest private yacht charters"}
            </p>
            {!singleYachtId && !loading && yachts.length > 0 && (
              <div className={styles.fleet__filters}>
                {/* Capacity chips */}
                <div className={styles.fleet__filter_row}>
                  <span className={styles.fleet__filter_icon}>
                    <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  </span>
                  {[["all", "All"], ["1-6", "≤6"], ["7-12", "7–12"], ["13+", "13+"]].map(([val, lbl]) => (
                    <button key={val}
                      className={cx(styles.fleet__chip, fleetFilter.capacity === val && styles["fleet__chip--on"])}
                      onClick={() => setFleetFilter(f => ({ ...f, capacity: val }))}>
                      {lbl}
                    </button>
                  ))}
                  <span className={styles.fleet__filter_divider} />
                  <span className={styles.fleet__filter_icon}>
                    <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </span>
                  {[["all", "All"], ["0-15000", "<₹15k"], ["15000-25000", "₹15–25k"], ["25000+", ">₹25k"]].map(([val, lbl]) => (
                    <button key={val}
                      className={cx(styles.fleet__chip, fleetFilter.price === val && styles["fleet__chip--on"])}
                      onClick={() => setFleetFilter(f => ({ ...f, price: val }))}>
                      {lbl}
                    </button>
                  ))}
                  {(fleetFilter.capacity !== "all" || fleetFilter.price !== "all") && (
                    <button className={styles.fleet__chip_clear}
                      onClick={() => setFleetFilter({ capacity: "all", price: "all" })}>
                      × Clear
                    </button>
                  )}
                </div>
              </div>
            )}
            {loading ? (
              <div className={styles.loading}><div className={styles.spinner} /><p>Loading fleet…</p></div>
            ) : yachts.length === 0 ? (
              <p className={styles.empty}>No yachts available right now.</p>
            ) : (() => {
              // Filter
              const filtered = yachts.filter(y => {
                const cap = y.capacity || 0;
                const pr = y.sellingPrice || 0;
                const capOk = fleetFilter.capacity === "all" ? true
                  : fleetFilter.capacity === "1-6" ? cap <= 6
                    : fleetFilter.capacity === "7-12" ? cap >= 7 && cap <= 12
                      : cap >= 13;
                const prOk = fleetFilter.price === "all" ? true
                  : fleetFilter.price === "0-15000" ? pr < 15000
                    : fleetFilter.price === "15000-25000" ? pr >= 15000 && pr <= 25000
                      : pr > 25000;
                return capOk && prOk;
              });
              // Sort: discount % desc → capacity desc → price asc
              const sorted = [...filtered].sort((a, b) => {
                const discA = a.maxSellingPrice && a.sellingPrice < a.maxSellingPrice
                  ? ((a.maxSellingPrice - a.sellingPrice) / a.maxSellingPrice) : 0;
                const discB = b.maxSellingPrice && b.sellingPrice < b.maxSellingPrice
                  ? ((b.maxSellingPrice - b.sellingPrice) / b.maxSellingPrice) : 0;
                if (discB !== discA) return discB - discA;
                if ((b.capacity || 0) !== (a.capacity || 0)) return (b.capacity || 0) - (a.capacity || 0);
                return (a.sellingPrice || 0) - (b.sellingPrice || 0);
              });
              if (sorted.length === 0) return (
                <div className={styles.fleet__empty}>
                  <span className={styles.fleet__empty_icon}>⛵</span>
                  <p>No yachts match those filters.</p>
                  <button className={styles.fleet__empty_reset}
                    onClick={() => setFleetFilter({ capacity: "all", price: "all" })}>
                    Clear filters
                  </button>
                </div>
              );
              return (
                <div className={styles.fleet__grid}>
                  {sorted.map(y => <YachtCard key={y._id} yacht={y} onBook={handleBookClick} />)}
                </div>
              );
            })()}
          </div>
          {!singleYachtId && <ContactSection />}
        </>)}

        {view === "booking" && pendingYacht && (
          <BookingFlow
            yacht={pendingYacht}
            user={user}
            onBack={() => { setView("home"); setActiveNav("home"); }}
            onDone={() => { setView("home"); setActiveNav("home"); }}
            onUserLogin={(u) => setUser(u)}
          />
        )}

        {view === "bookings" && (
          <MyBookingsPage
            customer={user?.guest ? null : user}
            onBack={() => { setView("home"); setActiveNav("home"); }}
            onUserLogin={(u) => setUser(u)}
          />
        )}
      </main>

      <MobileTabBar
        active={activeNav} setActive={setActiveNav}
        onMyBookings={() => openPanel("bookings")}
        onProfile={() => openPanel("profile")}
        onGoHome={handleGoHome}
      />

      {/* Floating WhatsApp button */}
      <a href={`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent("Hi! I'd like to book a yacht in Goa.")}`}
        target="_blank" rel="noreferrer" className={styles.wa_float}>
        <IcoWa />
      </a>

      {/* Profile panel (profile tab only — bookings now full-page) */}
      {showProfile && (
        <CustomerProfile
          initialTab={profileTab}
          onClose={() => { setShowProfile(false); setActiveNav("home"); }}
          initialCustomer={user?.guest ? null : user}
          onLogout={() => { setUser(null); setShowProfile(false); setActiveNav("home"); }}
        />
      )}
    </div>
  );
}