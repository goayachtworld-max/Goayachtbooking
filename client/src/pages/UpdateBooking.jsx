import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

import { createTransactionAndUpdateBooking, updateTransactionAPI } from "../services/operations/transactionAPI";
import { updateBookingAmountsAPI, rescheduleBookingAPI, updateBookingExtrasAPI } from "../services/operations/bookingAPI";
import { updateCustomerAPI } from "../services/operations/customerAPI";
import { getAllYachtsAPI } from "../services/operations/yautAPI";

import styles from "../styles/UpdateBooking.module.css";

/* ─────────────────────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────────────────────── */
function UpdateBooking() {
  const navigate = useNavigate();
  const location = useLocation();
  const { booking: initialBooking, user } = location.state || {};

  const isAdmin    = user?.type === "admin";
  const isBackdesk = user?.type === "backdesk";

  // Only 2 tabs now
  const [activeTab, setActiveTab] = useState("edit"); // "edit" | "payment"
  const [detailsOpen, setDetailsOpen] = useState(false);

  // ── Live booking state — updated locally after every save ──
  const [liveBooking, setLiveBooking] = useState(initialBooking || null);
  const booking = liveBooking; // alias so all existing code works unchanged

  if (!booking) { navigate("/bookings"); return null; }

  const isConfirmed = booking.status === "confirmed";
  const isCancelled = booking.status === "cancelled";
  const isPending   = booking.status === "pending";

  const totalPaid = (booking.transactionIds || []).reduce(
    (sum, txn) => sum + (txn.amount || 0), 0
  );

  /* ══════════════════════════════════════════════════════════
     TAB 1 — EDIT DETAILS
  ══════════════════════════════════════════════════════════ */
  const [yachts, setYachts] = useState([]);
  const [startTimeOptions, setStartTimeOptions] = useState([]);
  const [runningCost, setRunningCost] = useState(0);
  const [bookingData, setBookingData] = useState({
    yachtId:   booking?.yachtId?._id || "",
    date:      booking?.date?.split("T")[0] || "",
    startTime: booking?.startTime || "",
    endTime:   booking?.endTime || "",
  });
  const [customerData, setCustomerData] = useState({
    name:             booking?.customerId?.name || "",
    contact:          booking?.customerId?.contact || "",
    alternateContact: booking?.customerId?.alternateContact || "",
    email:            booking?.customerId?.email || "",
    govtIdNo:         booking?.customerId?.govtIdNo || "",
  });

  const parseExtrasFromNotes = (notes = "") =>
    notes.split("\n").filter((l) => l.startsWith("- ")).map((l) => l.replace("- ", "").trim());
  const extractNotesOnly = (text = "") => {
    const idx = text.indexOf("Notes:");
    return idx === -1 ? "" : text.slice(idx + 6).trim();
  };

  const [selectedExtras, setSelectedExtras] = useState(parseExtrasFromNotes(booking?.extraDetails));
  const [manualNotes, setManualNotes]       = useState(extractNotesOnly(booking?.extraDetails));
  const [showExtraNotes, setShowExtraNotes] = useState(false);
  const [editLoading, setEditLoading]       = useState(false);

  const extraOptions = {
    inclusions:   ["Soft Drink", "Ice Cube", "Water Bottles", "Bluetooth Speaker", "Captain & Crew", "Snacks"],
    paidServices: ["DSLR Photography", "Drone - Photography & Videography"],
  };

  const handleExtraToggle = (label) =>
    setSelectedExtras((prev) => prev.includes(label) ? prev.filter((i) => i !== label) : [...prev, label]);

  const isCustomerChanged = () => {
    const c = booking.customerId;
    return customerData.name !== (c.name || "") || customerData.contact !== (c.contact || "") ||
      customerData.alternateContact !== (c.alternateContact || "") || customerData.email !== (c.email || "");
  };
  const isBookingChanged = () =>
    bookingData.yachtId !== booking.yachtId._id || bookingData.date !== booking.date.split("T")[0] ||
    bookingData.startTime !== booking.startTime  || bookingData.endTime !== booking.endTime;
  const isExtrasChanged = () => {
    const orig = parseExtrasFromNotes(booking?.extraDetails || "");
    const origNotes = extractNotesOnly(booking?.extraDetails || "");
    if (origNotes !== manualNotes) return true;
    if (orig.length !== selectedExtras.length) return true;
    return !selectedExtras.every((e) => orig.includes(e));
  };

  const isEditSubmitDisabled = () => {
    if (!customerData.name || !customerData.contact) return true;
    if (isAdmin) {
      if (!bookingData.yachtId || !bookingData.date || !bookingData.startTime || !bookingData.endTime)
        return true;
    }
    if (!isCustomerChanged() && !isBookingChanged() && !isExtrasChanged()) return true;
    return false;
  };

  const isSlotBooked = (slot, bookings, currentBooking) => {
    if (!bookings) return false;
    const toMin = (t) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
    return bookings.some((b) => {
      if (b.startTime === currentBooking.startTime && b.endTime === currentBooking.endTime) return false;
      return toMin(slot.start) < toMin(b.endTime) && toMin(slot.end) > toMin(b.startTime);
    });
  };

  const buildSlotsForYacht = (yacht, selectedDate) => {
    if (!yacht) return [];

    const sailStart    = yacht.sailStartTime;
    const sailEnd      = yacht.sailEndTime;
    const durationRaw  = yacht.slotDurationMinutes || yacht.duration; // ✅ matches EditBookingDetails
    const specialSlots = yacht.specialSlots || [];

    const timeToMin = (t) => {
      if (!t) return 0;
      const [h, m] = t.split(":").map(Number);
      return h * 60 + m;
    };
    const minToTime = (mins) => {
      const h  = Math.floor(mins / 60);
      const mm = mins % 60;
      return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
    };

    const slotsForDate = yacht.slots?.find(
      (sg) => new Date(sg.date).toDateString() === new Date(selectedDate).toDateString()
    );
    if (slotsForDate?.slots?.length > 0) {
      return slotsForDate.slots
        .map((s) => ({ start: s.start, end: s.end }))
        .sort((a, b) => timeToMin(a.start) - timeToMin(b.start));
    }

    // Parse duration — supports "HH:MM" string or plain number (minutes)
    let duration = 0;
    if (typeof durationRaw === "string" && durationRaw.includes(":")) {
      const [h, m] = durationRaw.split(":").map(Number);
      duration = h * 60 + (m || 0);
    } else {
      duration = Number(durationRaw);
    }

    const startMin    = timeToMin(sailStart);
    let   endMin      = timeToMin(sailEnd);
    const specialMins = specialSlots.map(timeToMin).sort((a, b) => a - b);

    if (endMin <= startMin) endMin += 24 * 60;
    if (sailEnd === "00:00") endMin = 24 * 60 - 1;

    const slots = [];
    let cursor = startMin;
    while (cursor < endMin) {
      const next = cursor + duration;
      const hit  = specialMins.find((sp) => sp > cursor && sp < next);
      if (hit) { slots.push({ start: cursor, end: hit }); cursor = hit; }
      else     { slots.push({ start: cursor, end: next }); cursor = next; }
    }

    return slots.map((s) => ({ start: minToTime(s.start), end: minToTime(s.end) }));
  };

  useEffect(() => {
    if (!isAdmin || !bookingData.date) return;
    const fetchYachts = async () => {
      try {
        const token = localStorage.getItem("authToken");
        const res = await getAllYachtsAPI(token, bookingData.date);
        setYachts(Array.isArray(res?.data?.yachts) ? res.data.yachts : []);
      } catch { setYachts([]); }
    };
    fetchYachts();
  }, [bookingData.date, isAdmin]);

  useEffect(() => {
    if (!isAdmin || !yachts.length || !bookingData.yachtId) return;
    const yacht = yachts.find((y) => y._id === bookingData.yachtId);
    if (!yacht) return;

    setRunningCost(yacht.runningCost || 0);

    const slots = buildSlotsForYacht(yacht, bookingData.date);
    const slotsWithStatus = slots.map((slot) => ({
      ...slot,
      isBooked: isSlotBooked(slot, yacht.bookings, bookingData),
    }));
    setStartTimeOptions(slotsWithStatus);

    // auto-fix end time if current startTime still matches a slot
    const match = slots.find((s) => s.start === bookingData.startTime);
    if (match) setBookingData((p) => ({ ...p, endTime: match.end }));
  }, [bookingData.yachtId, bookingData.date, yachts, isAdmin]);

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setEditLoading(true);
    const token = localStorage.getItem("authToken");
    const extraDetails = `Inclusions / Services:\n${selectedExtras.map((i) => `- ${i}`).join("\n")}\n${manualNotes ? `Notes:\n${manualNotes}` : ""}`.trim();
    try {
      if (isCustomerChanged())
        await updateCustomerAPI(booking.customerId._id, {
          name:             customerData.name,
          contact:          customerData.contact,
          alternateContact: customerData.alternateContact,
          email:            customerData.email,
          govtIdNo:         customerData.govtIdNo,
        }, token);
      if (isExtrasChanged())
        await updateBookingExtrasAPI(booking._id, { extraDetails }, token);
      if (isAdmin && isBookingChanged())
        await rescheduleBookingAPI(booking._id, { yachtId: bookingData.yachtId, date: bookingData.date, startTime: bookingData.startTime, endTime: bookingData.endTime, extraDetails }, token);
      toast.success("Booking updated successfully");
      navigate("/bookings");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to update booking");
    } finally {
      setEditLoading(false);
    }
  };

  /* ══════════════════════════════════════════════════════════
     TAB 2 — PAYMENT (merged Payment + Status + Amounts)
  ══════════════════════════════════════════════════════════ */

  // ── Status + new payment ──
  const [formData, setFormData] = useState({
    status:    booking?.status || "",
    amount:    "",
    type:      "advance",
    proofFile: null,
  });
  const initialFormData  = { status: booking?.status || "", amount: "", proofFile: null };
  const isPaymentChanged =
    formData.status !== initialFormData.status ||
    (formData.amount !== "" && Number(formData.amount) > 0) ||
    formData.proofFile !== null;

  const [statusChanged, setStatusChanged] = useState(false);

  const handleFormChange = (e) => {
    const { name, value, files } = e.target;
    if (name === "status" && value !== booking.status) setStatusChanged(true);
    if (name === "amount") {
      // Block negative sign input
      if (value !== "" && Number(value) < 0) return;
      setFieldErrors((prev) => ({ ...prev, amount: validatePaymentField("amount", value) }));
    }
    setFormData((prev) => ({ ...prev, [name]: name === "proofFile" ? files[0] : value }));
  };

  // ── Amounts (admin only) ──
  const [amountsData, setAmountsData] = useState({
    quotedAmount: booking?.quotedAmount || "",
    tokenAmount:  booking?.tokenAmount  || "",
  });
  const initialAmountsData = { quotedAmount: booking?.quotedAmount || "", tokenAmount: booking?.tokenAmount || "" };
  const isAmountsChanged   =
    Number(amountsData.quotedAmount) !== Number(initialAmountsData.quotedAmount) ||
    Number(amountsData.tokenAmount)  !== Number(initialAmountsData.tokenAmount);

  const handleAmountsChange = (e) => {
    const { name, value } = e.target;
    // Block negative sign input
    if (value !== "" && Number(value) < 0) return;
    const context = {
      totalPaid,
      quotedAmount: name === "tokenAmount" ? (amountsData.quotedAmount || booking.quotedAmount) : undefined,
    };
    setFieldErrors((prev) => ({ ...prev, [name]: validatePaymentField(name, value, context) }));
    setAmountsData((prev) => ({ ...prev, [name]: value }));
  };

  // ── Transaction history edit ──
  // Each txn gets an editable amount in local state
  const [txnEdits, setTxnEdits] = useState(
    () => Object.fromEntries((booking.transactionIds || []).map((t) => [t._id, String(t.amount)]))
  );
  const [txnSaving, setTxnSaving] = useState({}); // { [id]: true/false }

  const isTxnChanged = (txn) => Number(txnEdits[txn._id]) !== txn.amount;

  const handleTxnAmountChange = (id, val) => {
    // Block negative sign input
    if (val !== "" && Number(val) < 0) return;
    setFieldErrors((prev) => ({
      ...prev,
      txnAmounts: { ...prev.txnAmounts, [id]: validateTxnField(val) },
    }));
    setTxnEdits((prev) => ({ ...prev, [id]: val }));
  };

  const handleTxnSave = async (txn) => {
    const newAmount = Number(txnEdits[txn._id]);
    if (isNaN(newAmount) || newAmount < 0) { toast.error("Invalid amount"); return; }
    setTxnSaving((prev) => ({ ...prev, [txn._id]: true }));
    try {
      const token = localStorage.getItem("authToken");
      const res = await updateTransactionAPI(txn._id, { amount: newAmount }, token);
      toast.success("Transaction updated");
      // Update liveBooking: patch the transaction amount + pendingAmount
      setLiveBooking((prev) => ({
        ...prev,
        pendingAmount: res.data.newPendingAmount,
        transactionIds: prev.transactionIds.map((t) =>
          t._id === txn._id ? { ...t, amount: newAmount } : t
        ),
      }));
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to update transaction");
      // revert local edit
      setTxnEdits((prev) => ({ ...prev, [txn._id]: String(txn.amount) }));
    } finally {
      setTxnSaving((prev) => ({ ...prev, [txn._id]: false }));
    }
  };

  // ── Field-level validation errors ──
  const [fieldErrors, setFieldErrors] = useState({
    amount: "",
    quotedAmount: "",
    tokenAmount: "",
    txnAmounts: {}, // { [txnId]: errorMsg }
  });

  const validatePaymentField = (name, value, context = {}) => {
    const num = Number(value);
    if (value === "" || value === null) return "";
    if (isNaN(num) || num < 0) return "Amount cannot be negative";
    if (name === "quotedAmount") {
      const min = context.totalPaid > 0 ? context.totalPaid : 1;
      if (num < min) return `Cannot be less than ₹${min} (total already paid)`;
    }
    if (name === "tokenAmount") {
      if (context.quotedAmount && num > Number(context.quotedAmount))
        return `Cannot be greater than quoted amount ₹${context.quotedAmount}`;
    }
    return "";
  };

  const validateTxnField = (value) => {
    const num = Number(value);
    if (isNaN(num) || num < 0) return "Amount cannot be negative";
    return "";
  };

  // ── Single unified submit ──
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError,   setPaymentError]   = useState("");
  const [amountsSuccess, setAmountsSuccess] = useState("");

  const anythingChanged = isPaymentChanged || (isAdmin && !isCancelled && isAmountsChanged);

  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    setPaymentLoading(true);
    setPaymentError("");
    setAmountsSuccess("");

    // Validate amounts
    if (isAdmin && !isCancelled && amountsData.quotedAmount !== "" && Number(amountsData.quotedAmount) < totalPaid) {
      setPaymentError(`Quoted amount cannot be less than total already paid (₹${totalPaid})`);
      setPaymentLoading(false);
      return;
    }

    try {
      const token = localStorage.getItem("authToken");

      // 1. New payment / status update
      if (isPaymentChanged) {
        const data = new FormData();
        data.append("bookingId", booking._id);
        data.append("type",      formData.type);
        data.append("status",    formData.status);
        data.append("amount",    formData.amount === "" || formData.amount === null ? 0 : formData.amount);
        if (formData.proofFile) data.append("paymentProof", formData.proofFile);
        const payRes = await createTransactionAndUpdateBooking(data, token);
        // Reflect updated booking returned by server
        if (payRes?.data?.booking) {
          setLiveBooking(payRes.data.booking);
          // Sync txnEdits with any new transactions
          setTxnEdits((prev) => {
            const next = { ...prev };
            (payRes.data.booking.transactionIds || []).forEach((t) => {
              if (!next[t._id]) next[t._id] = String(t.amount);
            });
            return next;
          });
        }
      }

      // 2. Quoted / token amounts (admin only)
      if (isAdmin && !isCancelled && isAmountsChanged) {
        const payload = {};
        if (Number(amountsData.quotedAmount) !== Number(initialAmountsData.quotedAmount))
          payload.quotedAmount = Number(amountsData.quotedAmount);
        if (Number(amountsData.tokenAmount) !== Number(initialAmountsData.tokenAmount))
          payload.tokenAmount = Number(amountsData.tokenAmount);
        await updateBookingAmountsAPI(booking._id, payload, token);
        // Patch quoted/token locally
        setLiveBooking((prev) => ({
          ...prev,
          quotedAmount: amountsData.quotedAmount !== "" ? Number(amountsData.quotedAmount) : prev.quotedAmount,
          tokenAmount:  amountsData.tokenAmount  !== "" ? Number(amountsData.tokenAmount)  : prev.tokenAmount,
        }));
      }

      // Reset form fields
      setFormData({ status: booking.status, amount: "", type: "advance", proofFile: null });
      setStatusChanged(false);
      toast.success("Updated successfully");
    } catch (err) {
      setPaymentError(err.response?.data?.error || err.response?.data?.message || "Failed to update");
    } finally {
      setPaymentLoading(false);
    }
  };

  /* ══════════════════════════════════════════════════════════
     HELPERS
  ══════════════════════════════════════════════════════════ */
  const to12Hour = (t) => {
    if (!t) return "";
    let [hour, minute] = t.split(":").map(Number);
    hour = hour % 24; // normalise — matches EditBookingDetails
    const period = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 === 0 ? 12 : hour % 12;
    return `${hour12}:${String(minute).padStart(2, "0")} ${period}`;
  };
  const formatDate = (d) =>
    d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "";
  const formatDateTime = (d) =>
    d ? new Date(d).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";

  const statusMeta = {
    pending:   { label: "Pending",   cls: styles.badgePending },
    confirmed: { label: "Confirmed", cls: styles.badgeConfirmed },
    cancelled: { label: "Cancelled", cls: styles.badgeCancelled },
  }[booking.status] || { label: booking.status, cls: styles.badgePending };

  const tabs = [
    { id: "edit",    label: "Edit Details" },
    { id: "payment", label: "Payment" },
  ];

  /* ── Shared booking info panel ── */
  const BookingInfoContent = () => (
    <div className={styles.infoContent}>
      <div className={styles.customerRow}>
        <div className={styles.avatar}>{booking.customerId?.name?.charAt(0).toUpperCase()}</div>
        <div>
          <p className={styles.customerName}>{booking.customerId?.name}</p>
          <span className={`${styles.badge} ${statusMeta.cls}`}>{statusMeta.label}</span>
        </div>
      </div>
      <div className={styles.infoDivider} />
      <div className={styles.detailGrid}>
        <DetailRow icon="⛵" label="Yacht"  value={booking.yachtId?.name} />
        <DetailRow icon="👥" label="Guests" value={`${booking.numPeople} pax`} />
        <DetailRow icon="📅" label="Date"   value={formatDate(booking.date)} />
        <DetailRow icon="⏰" label="Time"   value={`${to12Hour(booking.startTime)} – ${to12Hour(booking.endTime)}`} />
        {booking.employeeId?.name && <DetailRow icon="🧑‍💼" label="Agent" value={booking.employeeId.name} />}
        <div className={styles.detailRow}>
          <span className={styles.detailLabel}>📞 Primary</span>
          <a href={`tel:${booking.customerId?.contact}`} className={styles.detailLink}>{booking.customerId?.contact}</a>
        </div>
        {booking.customerId?.alternateContact && (
          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>📞 Alt.</span>
            <a href={`tel:${booking.customerId?.alternateContact}`} className={styles.detailLink}>{booking.customerId?.alternateContact}</a>
          </div>
        )}
      </div>
      <div className={styles.infoDivider} />
      <div className={styles.finGrid}>
        <FinBlock label="Quoted"  value={`₹${booking.quotedAmount}`} />
        <FinBlock label="Paid"    value={`₹${totalPaid}`} color="green" />
        <FinBlock label="Pending" value={`₹${booking.pendingAmount}`} color="red" />
      </div>
      {isPending && booking.tokenAmount > 0 && totalPaid === 0 && (
        <p className={styles.tokenNote}>
          Token Expected: <strong className={styles.tokenAmount}>₹{booking.tokenAmount}</strong>
        </p>
      )}
    </div>
  );

  /* ══════════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════════ */
  return (
    <div className={styles.page}>

      {/* Page header */}
      <header className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Update Booking</h1>
          <p className={styles.pageSubtitle}>Ref #{booking._id?.slice(-6).toUpperCase()}</p>
        </div>
        <button className={styles.backBtn} onClick={() => navigate("/bookings")}>
          Back
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </header>

      {/* Mobile collapsible details */}
      <div className={styles.mobileDetailsWrapper}>
        <button className={styles.mobileToggle} onClick={() => setDetailsOpen((v) => !v)} aria-expanded={detailsOpen}>
          <div className={styles.mobileToggleLeft}>
            <div className={styles.avatarSm}>{booking.customerId?.name?.charAt(0).toUpperCase()}</div>
            <div>
              <span className={styles.mobileToggleName}>{booking.customerId?.name}</span>
              <span className={`${styles.badge} ${statusMeta.cls}`}>{statusMeta.label}</span>
            </div>
          </div>
          <div className={styles.mobileToggleRight}>
            <span className={styles.mobileToggleHint}>{detailsOpen ? "Hide" : "Details"}</span>
            <svg className={`${styles.chevron} ${detailsOpen ? styles.chevronOpen : ""}`} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        </button>
        <div className={`${styles.mobileDetailsPanel} ${detailsOpen ? styles.mobilePanelOpen : ""}`}>
          <div className={styles.mobilePanelInner}><BookingInfoContent /></div>
        </div>
      </div>

      {/* Two-column layout */}
      <div className={styles.layout}>

        {/* LEFT — booking info (desktop) */}
        <aside className={styles.leftCol}>
          <div className={styles.card}>
            <p className={styles.cardLabel}>Booking Details</p>
            <BookingInfoContent />
          </div>
        </aside>

        {/* RIGHT — tabs */}
        <main className={styles.rightCol}>

          {/* Tab bar */}
          <div className={styles.tabBar}>
            {tabs.map((tab) => (
              <button key={tab.id}
                className={`${styles.tabBtn} ${activeTab === tab.id ? styles.tabBtnActive : ""}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* ════ TAB: Edit Details ════ */}
          {activeTab === "edit" && (
            <div className={styles.card}>
              <h2 className={styles.sectionTitle}><span className={styles.sectionIcon}>✏️</span> Edit Details</h2>
              <form onSubmit={handleEditSubmit} className={styles.form}>

                <p className={styles.formSectionLabel}>Customer Information</p>
                <div className={styles.formRow}>
                  <div className={styles.fieldGroup}>
                    <label className={styles.label}>Name</label>
                    <input className={styles.input} name="name" value={customerData.name} onChange={(e) => setCustomerData(p => ({ ...p, name: e.target.value }))} />
                  </div>
                  <div className={styles.fieldGroup}>
                    <label className={styles.label}>Email</label>
                    <input className={styles.input} name="email" value={customerData.email} onChange={(e) => setCustomerData(p => ({ ...p, email: e.target.value }))} />
                  </div>
                </div>
                <div className={styles.formRow}>
                  <div className={styles.fieldGroup}>
                    <label className={styles.label}>Contact</label>
                    <input className={styles.input} name="contact" value={customerData.contact} onChange={(e) => setCustomerData(p => ({ ...p, contact: e.target.value }))} />
                  </div>
                  <div className={styles.fieldGroup}>
                    <label className={styles.label}>Alternate Contact</label>
                    <input className={styles.input} name="alternateContact" value={customerData.alternateContact} onChange={(e) => setCustomerData(p => ({ ...p, alternateContact: e.target.value }))} />
                  </div>
                </div>
                {/* <div className={styles.formRow}>
                  <div className={styles.fieldGroup}>
                    <label className={styles.label}>Govt. ID No.</label>
                    <input className={styles.input} name="govtIdNo" value={customerData.govtIdNo} onChange={(e) => setCustomerData(p => ({ ...p, govtIdNo: e.target.value }))} placeholder="e.g. Aadhaar / PAN" />
                  </div>
                </div> */}

                <p className={styles.formSectionLabel}>Booking Information</p>
                <div className={styles.fieldGroup}>
                  <label className={styles.label}>Yacht</label>
                  {isAdmin ? (
                    <select className={styles.select} name="yachtId" value={bookingData.yachtId}
                      onChange={(e) => setBookingData((p) => ({ ...p, yachtId: e.target.value, startTime: "", endTime: "" }))}>
                      <option value="" disabled>-- Select Yacht --</option>
                      {yachts.map((y) => <option key={y._id} value={y._id}>{y.name}</option>)}
                    </select>
                  ) : (
                    <input className={styles.input} value={booking?.yachtId?.name} disabled />
                  )}
                </div>
                <div className={styles.formRow}>
                  <div className={styles.fieldGroup}>
                    <label className={styles.label}>Date</label>
                    <input type="date" className={styles.input} name="date" value={bookingData.date}
                      min={new Date().toISOString().split("T")[0]}
                      onChange={isAdmin ? (e) => setBookingData(p => ({ ...p, date: e.target.value })) : undefined}
                      disabled={!isAdmin} />
                  </div>
                  <div className={styles.fieldGroup}>
                    <label className={styles.label}>Time Slot</label>
                    {isAdmin ? (
                      <select className={styles.select} value={bookingData.startTime}
                        onChange={(e) => {
                          const slot = startTimeOptions.find((s) => s.start === e.target.value);
                          setBookingData((p) => ({ ...p, startTime: slot?.start || "", endTime: slot?.end || "" }));
                        }}>
                        <option value="">-- Select Slot --</option>
                        {startTimeOptions.map((s) => (
                          <option key={`${s.start}-${s.end}`} value={s.start} disabled={s.isBooked}>
                            {to12Hour(s.start)} – {to12Hour(s.end)}{s.isBooked ? " (Booked)" : ""}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input className={styles.input} value={`${to12Hour(bookingData.startTime)} – ${to12Hour(bookingData.endTime)}`} disabled />
                    )}
                  </div>
                </div>

                {/* Extras */}
                <div className={styles.extrasHeader}>
                  <p className={styles.formSectionLabel} style={{ margin: 0 }}>Extra Details</p>
                  <button type="button" className={styles.extrasToggle} onClick={() => setShowExtraNotes((p) => !p)}>
                    {showExtraNotes ? "Collapse" : "Expand"}
                    <svg className={`${styles.chevron} ${showExtraNotes ? styles.chevronOpen : ""}`} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>
                </div>
                {showExtraNotes && (
                  <div className={styles.extrasPanel}>
                    <p className={styles.extrasGroupLabel}>Inclusions</p>
                    <div className={styles.checkGrid}>
                      {extraOptions.inclusions.map((item) => (
                        <label key={item} className={styles.checkItem}>
                          <input type="checkbox" className={styles.checkbox} checked={selectedExtras.includes(item)} onChange={() => handleExtraToggle(item)} />
                          {item}
                        </label>
                      ))}
                    </div>
                    <p className={styles.extrasGroupLabel}>Paid Services</p>
                    <div className={styles.checkGrid}>
                      {extraOptions.paidServices.map((item) => (
                        <label key={item} className={styles.checkItem}>
                          <input type="checkbox" className={styles.checkbox} checked={selectedExtras.includes(item)} onChange={() => handleExtraToggle(item)} />
                          {item}
                        </label>
                      ))}
                    </div>
                    <textarea className={styles.textarea} rows={3} placeholder="Additional notes..." value={manualNotes} onChange={(e) => setManualNotes(e.target.value)} />
                  </div>
                )}

                <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`} disabled={editLoading || isEditSubmitDisabled()}>
                  {editLoading ? <span className={styles.spinner} /> : "Save Changes"}
                </button>
              </form>
            </div>
          )}

          {/* ════ TAB: Payment (merged) ════ */}
          {activeTab === "payment" && (
            <>
              {/* Transaction history */}
              {(booking.transactionIds || []).length > 0 && (
                <div className={styles.card}>
                  <h2 className={styles.sectionTitle}>
                    <span className={styles.sectionIcon}>🧾</span>
                    Transaction History
                    <span className={styles.txnCount}>{booking.transactionIds.length}</span>
                  </h2>
                  <div className={styles.txnList}>
                    {booking.transactionIds.map((txn, idx) => (
                      <div key={txn._id} className={styles.txnRow}>
                        <div className={styles.txnMeta}>
                          <span className={styles.txnIndex}>#{idx + 1}</span>
                          <div>
                            <span className={styles.txnType}>{txn.type === "advance" ? "Advance" : "Settlement"}</span>
                            <span className={styles.txnDate}>{formatDateTime(txn.date || txn.createdAt)}</span>
                          </div>
                        </div>
                        {/* Editable amount — admin only */}
                        {isAdmin ? (
                          <div className={styles.txnAmountEdit}>
                            <div className={styles.txnAmountField}>
                              <div className={styles.inputPrefix}>
                                <span className={styles.prefix}>₹</span>
                                <input
                                  type="number"
                                  className={`${styles.input} ${styles.inputWithPrefix} ${styles.txnInput} ${fieldErrors.txnAmounts?.[txn._id] ? styles.inputError : ""}`}
                                  value={txnEdits[txn._id] ?? txn.amount}
                                  min={0}
                                  onChange={(e) => handleTxnAmountChange(txn._id, e.target.value)}
                                />
                              </div>
                              {fieldErrors.txnAmounts?.[txn._id] && (
                                <p className={styles.fieldError}>{fieldErrors.txnAmounts[txn._id]}</p>
                              )}
                            </div>
                            {isTxnChanged(txn) && !fieldErrors.txnAmounts?.[txn._id] && (
                              <button
                                type="button"
                                className={`${styles.btn} ${styles.btnSaveTxn}`}
                                disabled={txnSaving[txn._id]}
                                onClick={() => handleTxnSave(txn)}
                              >
                                {txnSaving[txn._id] ? <span className={styles.spinner} /> : "Save"}
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className={styles.txnAmount}>₹{txn.amount}</span>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className={styles.txnTotalRow}>
                    <span className={styles.txnTotalLabel}>Total Paid</span>
                    <span className={styles.txnTotalValue}>₹{totalPaid}</span>
                  </div>
                </div>
              )}

              {/* New payment + status + amounts — single form, single button */}
              <div className={styles.card}>
                <h2 className={styles.sectionTitle}>
                  <span className={styles.sectionIcon}>💳</span> Payment & Status
                </h2>

                {paymentError   && <div className={styles.alertError}>{paymentError}</div>}
                {amountsSuccess && <div className={styles.alertSuccess}>{amountsSuccess}</div>}

                <form onSubmit={handlePaymentSubmit} className={styles.form}>

                  {/* Status + new amount */}
                  <p className={styles.formSectionLabel}>Update Status & Payment</p>
                  <div className={styles.formRow}>
                    <div className={styles.fieldGroup}>
                      <label className={styles.label}>Booking Status</label>
                      <select className={styles.select} name="status" value={formData.status} onChange={handleFormChange} required>
                        <option value="pending"   disabled={isConfirmed || isCancelled}>Pending</option>
                        <option value="confirmed" disabled={isCancelled}>Confirmed</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                      {statusChanged && isConfirmed && <p className={styles.warnText}>⚠️ You're changing a confirmed booking.</p>}
                      {statusChanged && isCancelled && <p className={styles.dangerText}>⚠️ Modifying a cancelled booking may affect records.</p>}
                    </div>
                    <div className={styles.fieldGroup}>
                      <label className={styles.label}>New Payment Received</label>
                      <div className={styles.inputPrefix}>
                        <span className={styles.prefix}>₹</span>
                        <input type="number" className={`${styles.input} ${styles.inputWithPrefix} ${fieldErrors.amount ? styles.inputError : ""}`}
                          name="amount" value={formData.amount} onChange={handleFormChange} placeholder="0" min={0} />
                      </div>
                      {fieldErrors.amount && <p className={styles.fieldError}>{fieldErrors.amount}</p>}
                    </div>
                  </div>

                  <div className={styles.fieldGroup}>
                    <label className={styles.label}>Payment Proof</label>
                    <label className={styles.fileLabel}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
                      </svg>
                      {formData.proofFile ? formData.proofFile.name : "Attach image or PDF"}
                      <input type="file" name="proofFile" onChange={handleFormChange} accept="image/*,application/pdf" hidden />
                    </label>
                  </div>

                  {/* Amounts — admin only, same form */}
                  {isAdmin && !isCancelled && (
                    <>
                      <div className={styles.sectionDivider} />
                      <p className={styles.formSectionLabel}>
                        Quoted & Token Amounts
                        {/* <span className={styles.adminBadgeInline}>Admin</span> */}
                      </p>

                      {totalPaid > 0 && (
                        <div className={styles.alertInfo}>
                          ₹{totalPaid} already collected — quoted amount cannot go below this.
                        </div>
                      )}

                      <div className={styles.formRow}>
                        <div className={styles.fieldGroup}>
                          <label className={styles.label}>Quoted Amount (Total Price)</label>
                          <div className={styles.inputPrefix}>
                            <span className={styles.prefix}>₹</span>
                            <input type="number" className={`${styles.input} ${styles.inputWithPrefix} ${fieldErrors.quotedAmount ? styles.inputError : ""}`}
                              name="quotedAmount" value={amountsData.quotedAmount} onChange={handleAmountsChange}
                              placeholder={booking.quotedAmount} min={totalPaid > 0 ? totalPaid : 1} />
                          </div>
                          {fieldErrors.quotedAmount
                            ? <p className={styles.fieldError}>{fieldErrors.quotedAmount}</p>
                            : <p className={styles.hint}>Current: ₹{booking.quotedAmount}{totalPaid > 0 && ` · Min: ₹${totalPaid}`}</p>
                          }
                        </div>

                        {isPending && totalPaid === 0 && (
                          <div className={styles.fieldGroup}>
                            <label className={styles.label}>Token Amount (Expected)</label>
                            <div className={styles.inputPrefix}>
                              <span className={styles.prefix}>₹</span>
                              <input type="number" className={`${styles.input} ${styles.inputWithPrefix} ${fieldErrors.tokenAmount ? styles.inputError : ""}`}
                                name="tokenAmount" value={amountsData.tokenAmount} onChange={handleAmountsChange}
                                placeholder={booking.tokenAmount || 0} min={0} />
                            </div>
                            {fieldErrors.tokenAmount
                              ? <p className={styles.fieldError}>{fieldErrors.tokenAmount}</p>
                              : <p className={styles.hint}>Current: ₹{booking.tokenAmount || 0}</p>
                            }
                          </div>
                        )}
                      </div>

                      {amountsData.quotedAmount !== "" && Number(amountsData.quotedAmount) !== Number(initialAmountsData.quotedAmount) && (
                        <div className={styles.previewBox}>
                          New pending amount: <strong>₹{Math.max(Number(amountsData.quotedAmount) - totalPaid, 0)}</strong>
                        </div>
                      )}
                    </>
                  )}

                  {/* Single update button */}
                  <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`} disabled={paymentLoading || !anythingChanged}>
                    {paymentLoading ? <span className={styles.spinner} /> : "Update"}
                  </button>
                </form>
              </div>
            </>
          )}

        </main>
      </div>
    </div>
  );
}

/* ── Helpers ── */
function DetailRow({ icon, label, value }) {
  return (
    <div className={styles.detailRow}>
      <span className={styles.detailLabel}>{icon} {label}</span>
      <span className={styles.detailValue}>{value}</span>
    </div>
  );
}

function FinBlock({ label, value, color }) {
  return (
    <div className={styles.finBlock}>
      <span className={styles.finLabel}>{label}</span>
      <span className={`${styles.finValue} ${color === "green" ? styles.green : color === "red" ? styles.red : ""}`}>{value}</span>
    </div>
  );
}

export default UpdateBooking;