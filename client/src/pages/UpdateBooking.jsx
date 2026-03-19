import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { createTransactionAndUpdateBooking } from "../services/operations/transactionAPI";
import { updateBookingAmountsAPI } from "../services/operations/bookingAPI";
import styles from "../styles/UpdateBooking.module.css";

function UpdateBooking() {
  const navigate = useNavigate();
  const location = useLocation();
  const { booking, user } = location.state || {};

  const [detailsOpen, setDetailsOpen] = useState(false);

  const [formData, setFormData] = useState({
    status: booking?.status || "",
    amount: "",
    type: "advance",
    proofFile: null,
  });

  const initialData = {
    status: booking?.status || "",
    amount: "",
    proofFile: null,
  };

  const isFormChanged =
    formData.status !== initialData.status ||
    formData.amount !== initialData.amount ||
    formData.proofFile !== null;

  const [statusChanged, setStatusChanged] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [amountsData, setAmountsData] = useState({
    quotedAmount: booking?.quotedAmount || "",
    tokenAmount: booking?.tokenAmount || "",
  });

  const initialAmountsData = {
    quotedAmount: booking?.quotedAmount || "",
    tokenAmount: booking?.tokenAmount || "",
  };

  const isAmountsChanged =
    Number(amountsData.quotedAmount) !== Number(initialAmountsData.quotedAmount) ||
    Number(amountsData.tokenAmount) !== Number(initialAmountsData.tokenAmount);

  const [amountsLoading, setAmountsLoading] = useState(false);
  const [amountsError, setAmountsError] = useState("");
  const [amountsSuccess, setAmountsSuccess] = useState("");

  if (!booking) {
    navigate("/bookings");
    return null;
  }

  const isAdmin = user?.type === "admin";
  const isConfirmed = booking.status === "confirmed";
  const isCancelled = booking.status === "cancelled";
  const isPending = booking.status === "pending";

  const totalPaid = (booking.transactionIds || []).reduce(
    (sum, txn) => sum + (txn.amount || 0),
    0
  );

  const to12Hour = (time24) => {
    if (!time24) return "";
    const [h, m] = time24.split(":").map(Number);
    const period = h >= 12 ? "PM" : "AM";
    const hour12 = h % 12 === 0 ? 12 : h % 12;
    return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const handleChange = (e) => {
    const { name, value, files } = e.target;
    if (name === "status" && value !== booking.status) setStatusChanged(true);
    setFormData((prev) => ({
      ...prev,
      [name]: name === "proofFile" ? files[0] : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const token = localStorage.getItem("authToken");
      const data = new FormData();
      data.append("bookingId", booking._id);
      data.append("type", formData.type);
      data.append("status", formData.status);
      data.append(
        "amount",
        formData.amount === "" || formData.amount === null ? 0 : formData.amount
      );
      if (formData.proofFile) data.append("paymentProof", formData.proofFile);
      await createTransactionAndUpdateBooking(data, token);
      navigate("/bookings");
    } catch (err) {
      setError(
        err.response?.data?.error ||
          err.response?.data?.message ||
          "Failed to update booking"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleAmountsChange = (e) => {
    const { name, value } = e.target;
    setAmountsData((prev) => ({ ...prev, [name]: value }));
    setAmountsError("");
    setAmountsSuccess("");
  };

  const handleAmountsSubmit = async (e) => {
    e.preventDefault();
    setAmountsLoading(true);
    setAmountsError("");
    setAmountsSuccess("");

    if (
      amountsData.quotedAmount !== "" &&
      Number(amountsData.quotedAmount) < totalPaid
    ) {
      setAmountsError(
        `Quoted amount cannot be less than total already paid (₹${totalPaid})`
      );
      setAmountsLoading(false);
      return;
    }

    try {
      const token = localStorage.getItem("authToken");
      const payload = {};
      if (Number(amountsData.quotedAmount) !== Number(initialAmountsData.quotedAmount))
        payload.quotedAmount = Number(amountsData.quotedAmount);
      if (Number(amountsData.tokenAmount) !== Number(initialAmountsData.tokenAmount))
        payload.tokenAmount = Number(amountsData.tokenAmount);

      await updateBookingAmountsAPI(booking._id, payload, token);
      setAmountsSuccess("Amounts updated successfully!");
      setTimeout(() => navigate("/bookings"), 1200);
    } catch (err) {
      setAmountsError(
        err.response?.data?.message ||
          err.response?.data?.error ||
          "Failed to update amounts"
      );
    } finally {
      setAmountsLoading(false);
    }
  };

  const statusMeta = {
    pending:   { label: "Pending",   cls: styles.badgePending },
    confirmed: { label: "Confirmed", cls: styles.badgeConfirmed },
    cancelled: { label: "Cancelled", cls: styles.badgeCancelled },
  }[booking.status] || { label: booking.status, cls: styles.badgePending };

  /* ── The unified booking info block (used in both mobile + desktop) ── */
  const BookingInfoContent = () => (
    <div className={styles.infoContent}>
      {/* Customer */}
      <div className={styles.customerRow}>
        <div className={styles.avatar}>
          {booking.customerId?.name?.charAt(0).toUpperCase()}
        </div>
        <div>
          <p className={styles.customerName}>{booking.customerId?.name}</p>
          <span className={`${styles.badge} ${statusMeta.cls}`}>
            {statusMeta.label}
          </span>
        </div>
      </div>

      <div className={styles.infoDivider} />

      {/* Trip + Contact details */}
      <div className={styles.detailGrid}>
        <DetailRow icon="⛵" label="Yacht"   value={booking.yachtId?.name} />
        <DetailRow icon="👥" label="Guests"  value={`${booking.numPeople} pax`} />
        <DetailRow icon="📅" label="Date"    value={formatDate(booking.date)} />
        <DetailRow
          icon="⏰"
          label="Time"
          value={`${to12Hour(booking.startTime)} – ${to12Hour(booking.endTime)}`}
        />
        {booking.employeeId?.name && (
          <DetailRow icon="🧑‍💼" label="Agent" value={booking.employeeId.name} />
        )}
        <div className={styles.detailRow}>
          <span className={styles.detailLabel}>📞 Primary</span>
          <a href={`tel:${booking.customerId?.contact}`} className={styles.detailLink}>
            {booking.customerId?.contact}
          </a>
        </div>
        {booking.customerId?.alternateContact && (
          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>📞 Alt.</span>
            <a href={`tel:${booking.customerId?.alternateContact}`} className={styles.detailLink}>
              {booking.customerId?.alternateContact}
            </a>
          </div>
        )}
      </div>

      <div className={styles.infoDivider} />

      {/* Financials */}
      <div className={styles.finGrid}>
        <FinBlock label="Quoted"  value={`₹${booking.quotedAmount}`} />
        <FinBlock label="Paid"    value={`₹${totalPaid}`}            color="green" />
        <FinBlock label="Pending" value={`₹${booking.pendingAmount}`} color="red" />
      </div>

      {isPending && booking.tokenAmount > 0 && totalPaid === 0 && (
        <p className={styles.tokenNote}>
          Token Expected:{" "}
          <strong className={styles.tokenAmount}>₹{booking.tokenAmount}</strong>
        </p>
      )}
    </div>
  );

  return (
    <div className={styles.page}>

      {/* ── Page Header ── */}
      <header className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Update Booking</h1>
          <p className={styles.pageSubtitle}>Ref #{booking._id?.slice(-6).toUpperCase()}</p>
        </div>
        <button className={styles.backBtn} onClick={() => navigate("/bookings")}>
          Back
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </header>

      {/* ══════════════════════════════════════════════
          MOBILE ONLY — collapsible booking details
      ══════════════════════════════════════════════ */}
      <div className={styles.mobileDetailsWrapper}>
        <button
          className={styles.mobileToggle}
          onClick={() => setDetailsOpen((v) => !v)}
          aria-expanded={detailsOpen}
        >
          <div className={styles.mobileToggleLeft}>
            <div className={styles.avatarSm}>
              {booking.customerId?.name?.charAt(0).toUpperCase()}
            </div>
            <div>
              <span className={styles.mobileToggleName}>
                {booking.customerId?.name}
              </span>
              <span className={`${styles.badge} ${statusMeta.cls}`}>
                {statusMeta.label}
              </span>
            </div>
          </div>
          <div className={styles.mobileToggleRight}>
            <span className={styles.mobileToggleHint}>
              {detailsOpen ? "Hide" : "Details"}
            </span>
            <svg
              className={`${styles.chevron} ${detailsOpen ? styles.chevronOpen : ""}`}
              width="16" height="16" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="2.5"
              strokeLinecap="round" strokeLinejoin="round"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        </button>

        {/* Collapsible panel */}
        <div className={`${styles.mobileDetailsPanel} ${detailsOpen ? styles.mobilePanelOpen : ""}`}>
          <div className={styles.mobilePanelInner}>
            <BookingInfoContent />
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          DESKTOP — two-column layout
      ══════════════════════════════════════════════ */}
      <div className={styles.layout}>

        {/* LEFT — single unified info card */}
        <aside className={styles.leftCol}>
          <div className={styles.card}>
            <p className={styles.cardLabel}>Booking Details</p>
            <BookingInfoContent />
          </div>
        </aside>

        {/* RIGHT — forms */}
        <main className={styles.rightCol}>

          {/* Payment & Status */}
          <div className={styles.card}>
            <h2 className={styles.sectionTitle}>
              <span className={styles.sectionIcon}>💳</span>
              Payment & Status
            </h2>

            {error && <div className={styles.alertError}>{error}</div>}

            <form onSubmit={handleSubmit} className={styles.form}>
              <div className={styles.formRow}>
                <div className={styles.fieldGroup}>
                  <label className={styles.label}>Booking Status</label>
                  <select
                    className={styles.select}
                    name="status"
                    value={formData.status}
                    onChange={handleChange}
                    required
                  >
                    <option value="pending" disabled={isConfirmed || isCancelled}>Pending</option>
                    <option value="confirmed" disabled={isCancelled}>Confirmed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                  {statusChanged && isConfirmed && (
                    <p className={styles.warnText}>⚠️ You're changing a confirmed booking.</p>
                  )}
                  {statusChanged && isCancelled && (
                    <p className={styles.dangerText}>⚠️ Modifying a cancelled booking may affect records.</p>
                  )}
                </div>

                <div className={styles.fieldGroup}>
                  <label className={styles.label}>Payment Received</label>
                  <div className={styles.inputPrefix}>
                    <span className={styles.prefix}>₹</span>
                    <input
                      type="number"
                      className={`${styles.input} ${styles.inputWithPrefix}`}
                      name="amount"
                      value={formData.amount}
                      onChange={handleChange}
                      placeholder="0"
                      min={0}
                    />
                  </div>
                </div>
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.label}>Payment Proof</label>
                <label className={styles.fileLabel}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
                  </svg>
                  {formData.proofFile ? formData.proofFile.name : "Attach image or PDF"}
                  <input type="file" name="proofFile" onChange={handleChange} accept="image/*,application/pdf" hidden />
                </label>
              </div>

              <button
                type="submit"
                className={`${styles.btn} ${styles.btnPrimary}`}
                disabled={loading || !isFormChanged}
              >
                {loading ? <span className={styles.spinner} /> : "Update Payment & Status"}
              </button>
            </form>
          </div>

          {/* Admin: Edit Amounts */}
          {isAdmin && !isCancelled && (
            <div className={styles.card}>
              <h2 className={styles.sectionTitle}>
                <span className={styles.sectionIcon}>✏️</span>
                Edit Amounts
                <span className={styles.adminBadge}>Admin Only</span>
              </h2>

              {amountsError  && <div className={styles.alertError}>{amountsError}</div>}
              {amountsSuccess && <div className={styles.alertSuccess}>{amountsSuccess}</div>}

              {totalPaid > 0 && (
                <div className={styles.alertInfo}>
                  ₹{totalPaid} already collected via{" "}
                  {(booking.transactionIds || []).length} transaction(s). Quoted amount cannot go below this.
                </div>
              )}

              <form onSubmit={handleAmountsSubmit} className={styles.form}>
                <div className={styles.formRow}>
                  <div className={styles.fieldGroup}>
                    <label className={styles.label}>Quoted Amount (Total Price)</label>
                    <div className={styles.inputPrefix}>
                      <span className={styles.prefix}>₹</span>
                      <input
                        type="number"
                        className={`${styles.input} ${styles.inputWithPrefix}`}
                        name="quotedAmount"
                        value={amountsData.quotedAmount}
                        onChange={handleAmountsChange}
                        placeholder={booking.quotedAmount}
                        min={totalPaid > 0 ? totalPaid : 1}
                      />
                    </div>
                    <p className={styles.hint}>
                      Current: ₹{booking.quotedAmount}
                      {totalPaid > 0 && ` · Min: ₹${totalPaid}`}
                    </p>
                  </div>

                  {isPending && totalPaid === 0 && (
                    <div className={styles.fieldGroup}>
                      <label className={styles.label}>Token Amount (Expected)</label>
                      <div className={styles.inputPrefix}>
                        <span className={styles.prefix}>₹</span>
                        <input
                          type="number"
                          className={`${styles.input} ${styles.inputWithPrefix}`}
                          name="tokenAmount"
                          value={amountsData.tokenAmount}
                          onChange={handleAmountsChange}
                          placeholder={booking.tokenAmount || 0}
                          min={0}
                        />
                      </div>
                      <p className={styles.hint}>Current: ₹{booking.tokenAmount || 0}</p>
                    </div>
                  )}
                </div>

                {amountsData.quotedAmount !== "" &&
                  Number(amountsData.quotedAmount) !== Number(initialAmountsData.quotedAmount) && (
                    <div className={styles.previewBox}>
                      New pending amount:{" "}
                      <strong>₹{Math.max(Number(amountsData.quotedAmount) - totalPaid, 0)}</strong>
                    </div>
                  )}

                <button
                  type="submit"
                  className={`${styles.btn} ${styles.btnWarning}`}
                  disabled={amountsLoading || !isAmountsChanged}
                >
                  {amountsLoading ? <span className={styles.spinner} /> : "Save Amount Changes"}
                </button>
              </form>
            </div>
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
      <span className={`${styles.finValue} ${color === "green" ? styles.green : color === "red" ? styles.red : ""}`}>
        {value}
      </span>
    </div>
  );
}

export default UpdateBooking;