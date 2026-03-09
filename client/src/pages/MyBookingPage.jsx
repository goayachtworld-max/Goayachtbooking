// components/MyBookingsPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import styles from "../styles/MyBookingPage.module.css";
import toast from 'react-hot-toast';
import {
  getCustomerBookingsAPI,
  isCustomerLoggedIn,
  getCachedCustomer,
  sendCustomerOtpAPI,
  verifyCustomerOtpAPI,
  saveCustomerSession,
} from '../services/operations/customerAuthAPI';
import { WA_NUMBER as WA } from '../constants';
import { saveOtpState, loadOtpState, clearOtpState, resendSecondsLeft } from '../utils/otpState';

const cx = (...c) => c.filter(Boolean).join(' ');
const fmt = n => Number(n || 0).toLocaleString('en-IN');

const fmtDate = d => {
  if (!d) return '—';
  const s = String(d).slice(0, 10);
  return new Date(s + 'T00:00:00').toLocaleDateString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'long', year: 'numeric',
  });
};

const to12h = t => {
  if (!t) return '';
  const [h, m] = String(t).split(':').map(Number);
  const p = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${p}`;
};

// ─── Derive effective status — if date+endTime is in the past, show Completed ─
function effectiveStatus(b) {
  // Cancelled always stays cancelled
  if (b.status === 'cancelled') return 'cancelled';

  // Check if the booking time has passed
  if (b.date) {
    const dateStr = String(b.date).slice(0, 10); // "YYYY-MM-DD"
    // Use endTime if available, otherwise midnight of that date
    const timeStr = b.endTime ? b.endTime : '23:59';
    const bookingEnd = new Date(`${dateStr}T${timeStr}:00`);
    if (bookingEnd < new Date()) {
      // Past booking — show as completed regardless of DB status
      return 'completed';
    }
  }
  return b.status || 'pending';
}

const STATUS_CONFIG = {
  confirmed:  { label: 'Confirmed',  color: '#0d9488', bg: 'rgba(13,148,136,0.12)', dot: '#0d9488' },
  pending:    { label: 'Pending',    color: '#d97706', bg: 'rgba(217,119,6,0.12)',   dot: '#d97706' },
  initiated:  { label: 'Processing', color: '#2563eb', bg: 'rgba(37,99,235,0.12)',   dot: '#2563eb' },
  cancelled:  { label: 'Cancelled',  color: '#dc2626', bg: 'rgba(220,38,38,0.12)',   dot: '#dc2626' },
  completed:  { label: 'Completed',  color: '#7c3aed', bg: 'rgba(124,58,237,0.12)', dot: '#7c3aed' },
};

// ─── Countdown timer countdown ────────────────────────────────────────────────
function useCountdown(init = 0) {
  const [left, setLeft] = useState(init);
  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft(l => l - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);
  return { left, start: (s = 60) => setLeft(s) };
}

// ─── Inline OTP Login (shown when not logged in) ──────────────────────────────
// Persists OTP step in sessionStorage so navigating away and back restores
// the "Enter OTP" screen instead of forcing a fresh number entry.
function InlineLogin({ onSuccess }) {
  // Restore any in-progress OTP session from sessionStorage
  const saved = loadOtpState();
  const [phone, setPhone] = useState(saved?.phone || '');
  const [otp,   setOtp]   = useState('');
  const [step,  setStep]  = useState(saved ? 2 : 1);
  const [busy,  setBusy]  = useState(false);
  // Initialise countdown from remaining seconds if restoring mid-session
  const initLeft = saved ? resendSecondsLeft(saved.sentAt) : 0;
  const { left, start } = useCountdown(initLeft);
  const digits = phone.replace(/\D/g, '');

  const handleSend = async () => {
    if (digits.length < 10) return toast.error('Enter a valid 10-digit number');
    setBusy(true);
    try {
      await sendCustomerOtpAPI(digits);
      saveOtpState(digits);   // persist phone + timestamp
      setStep(2); start();
      toast.success('OTP sent to your WhatsApp!');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to send OTP');
    } finally { setBusy(false); }
  };

  const handleVerify = async () => {
    if (otp.length < 4) return toast.error('Enter the OTP from WhatsApp');
    setBusy(true);
    try {
      const res = await verifyCustomerOtpAPI(digits, otp);
      const d   = res.data;
      saveCustomerSession(d.token, d.customer);
      clearOtpState();        // clean up now that we're done
      toast.success(d.isNewCustomer ? 'Welcome! 🎉' : 'Welcome back!');
      onSuccess(d.customer);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Invalid OTP');
    } finally { setBusy(false); }
  };

  const handleResend = async () => {
    if (left > 0 || busy) return;
    setBusy(true);
    try {
      await sendCustomerOtpAPI(digits);
      saveOtpState(digits);
      setOtp(''); start();
      toast.success('New OTP sent!');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to resend');
    } finally { setBusy(false); }
  };

  const handleChangeNumber = () => {
    clearOtpState();
    setStep(1); setOtp(''); setPhone('');
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '2.5rem 1.5rem', maxWidth: 380, margin: '0 auto',
    }}>
      <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>🔐</div>
      <h3 style={{ fontFamily: 'Sora,sans-serif', fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.4rem', textAlign: 'center' }}>
        Login to view your bookings
      </h3>
      <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '0 0 1.75rem', textAlign: 'center', lineHeight: 1.5 }}>
        We'll send a free OTP to your WhatsApp to verify your identity.
      </p>

      {step === 1 ? (
        <>
          <div style={{ width: '100%', marginBottom: '0.875rem' }}>
            <div style={{
              display: 'flex', border: '1.5px solid #e2e8f0', borderRadius: 12,
              overflow: 'hidden', background: '#fff',
            }}>
              <span style={{
                padding: '0 12px', height: 48, display: 'flex', alignItems: 'center',
                fontSize: '0.9rem', fontWeight: 700, color: '#64748b',
                background: '#f8fafc', borderRight: '1.5px solid #e2e8f0', flexShrink: 0,
              }}>+91</span>
              <input
                type="tel" maxLength={10} placeholder="10-digit WhatsApp number"
                value={phone}
                onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
                autoFocus
                style={{ flex: 1, border: 'none', outline: 'none', padding: '0 14px', fontSize: '0.95rem', height: 48, background: 'transparent' }}
              />
            </div>
          </div>
          <button onClick={handleSend} disabled={busy || digits.length < 10} style={{
            width: '100%', height: 48, borderRadius: 12, border: 'none',
            background: digits.length < 10 ? '#e2e8f0' : '#0f172a',
            color: digits.length < 10 ? '#94a3b8' : '#fff',
            fontSize: '0.9rem', fontWeight: 700,
            cursor: digits.length < 10 ? 'not-allowed' : 'pointer', transition: 'all .15s',
          }}>
            {busy ? 'Sending…' : '📲 Send OTP via WhatsApp'}
          </button>
        </>
      ) : (
        <>
          {/* Restored-state hint — shown when user navigated away and came back */}
          {saved && (
            <div style={{
              width: '100%', marginBottom: '0.75rem', padding: '8px 12px',
              background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10,
              fontSize: '0.75rem', color: '#15803d', fontWeight: 600, textAlign: 'center',
            }}>
              ✓ OTP already sent to +91 {digits} — enter it below
            </div>
          )}
          <p style={{ fontSize: '0.82rem', color: '#475569', marginBottom: '0.875rem', textAlign: 'center' }}>
            OTP sent to <b>+91 {digits}</b>.<br/>
            <span style={{ color: '#25d366', fontWeight: 700 }}>📲 Check your WhatsApp</span>
          </p>
          <input
            type="text" inputMode="numeric" maxLength={6}
            placeholder="· · · · · ·" value={otp}
            onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
            onKeyDown={e => e.key === 'Enter' && handleVerify()}
            autoFocus
            style={{
              width: '100%', height: 52, border: '1.5px solid #e2e8f0',
              borderRadius: 12, fontSize: '1.5rem', fontWeight: 700,
              letterSpacing: '0.4em', textAlign: 'center', outline: 'none',
              marginBottom: '0.875rem', boxSizing: 'border-box', transition: 'border-color .15s',
            }}
          />
          <button onClick={handleVerify} disabled={busy || otp.length < 4} style={{
            width: '100%', height: 48, borderRadius: 12, border: 'none',
            background: otp.length < 4 ? '#e2e8f0' : '#0f172a',
            color: otp.length < 4 ? '#94a3b8' : '#fff',
            fontSize: '0.9rem', fontWeight: 700,
            cursor: otp.length < 4 ? 'not-allowed' : 'pointer', marginBottom: '0.75rem',
          }}>
            {busy ? 'Verifying…' : 'Verify & View Bookings'}
          </button>
          <div style={{ display: 'flex', gap: '1.25rem', fontSize: '0.78rem', color: '#64748b' }}>
            {left > 0
              ? <span>Resend in {left}s</span>
              : <button onClick={handleResend} disabled={busy}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2563eb', fontWeight: 600, fontSize: '0.78rem' }}>
                  Resend OTP
                </button>
            }
            <button onClick={handleChangeNumber}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2563eb', fontWeight: 600, fontSize: '0.78rem' }}>
              Change number
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Skeleton loader ──────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className={styles.skeleton_card}>
      <div className={styles.sk_hero} />
      <div className={styles.sk_body}>
        <div className={cx(styles.sk_line, styles['sk_line--lg'])} />
        <div className={cx(styles.sk_line, styles['sk_line--md'])} />
        <div className={cx(styles.sk_line, styles['sk_line--sm'])} />
      </div>
    </div>
  );
}

// ─── Single booking card ──────────────────────────────────────────────────────
function BookingCard({ b, idx }) {
  const [expanded, setExpanded] = useState(false);

  const status    = effectiveStatus(b);
  const sc        = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  const yacht     = b.yachtId || {};
  const yachtName = yacht.name || 'Yacht Charter';
  const photo     = yacht.photos?.[0] || null;
  const location  = yacht.boardingLocation || null;
  const amount    = b.quotedAmount || b.totalAmount || yacht.sellingPrice || 0;
  const pax       = b.numPax ?? b.numAdults ?? b.numPeople ?? null;
  const kids      = b.numKids ?? null;
  const extras    = b.extraDetails || '';
  const ticket = b.ticketNo || (b._id ? String(b._id).slice(-5).toUpperCase() : null);
  const slot      = b.startTime && b.endTime
    ? `${to12h(b.startTime)} – ${to12h(b.endTime)}` : null;
  const isCompleted = status === 'completed';
  const isCancelled = status === 'cancelled';

  const waText = encodeURIComponent(
    `Hi GoaBoat! I need help with my booking.\nTicket: ${ticket || b._id}\nYacht: ${yachtName}\nDate: ${fmtDate(b.date)}`
  );

  return (
    <div className={styles.card} style={{ animationDelay: `${idx * 60}ms` }}>

      {/* ── Hero image ── */}
      <div className={styles.card__hero} style={isCompleted || isCancelled ? { filter: 'grayscale(0.45)' } : {}}>
        {photo
          ? <img src={photo} alt={yachtName} className={styles.card__hero_img}
              onError={e => { e.currentTarget.style.display = 'none'; }} />
          : null}
        <div className={styles.card__hero_ph} style={photo ? { display: 'none' } : {}}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
            <path d="M3 17l9-11 9 11M3 17h18M8 17v3m8-3v3"/>
          </svg>
        </div>

        {/* Status badge */}
        <span className={styles.card__status} style={{ color: sc.color, background: sc.bg }}>
          <span className={styles.card__status_dot} style={{ background: sc.dot }} />
          {sc.label}
        </span>

        {/* Ticket pill — top-left, clear of the bottom ribbon */}
        {ticket && <span className={styles.card__ticket}>#{ticket}</span>}

        {/* Completed overlay ribbon */}
        {isCompleted && (
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            background: 'linear-gradient(to top, rgba(124,58,237,0.55), transparent)',
            padding: '0.5rem 0.75rem 0.4rem',
            display: 'flex', alignItems: 'center', gap: '0.4rem',
          }}>
            <span style={{ fontSize: '0.7rem', color: '#fff', fontWeight: 700, letterSpacing: '0.05em' }}>
              ✓ VOYAGE COMPLETE
            </span>
          </div>
        )}
      </div>

      {/* ── Body ── */}
      <div className={styles.card__body}>
        {/* Yacht name + price row */}
        <div className={styles.card__row_top}>
          <h3 className={styles.card__name}>{yachtName}</h3>
          <span className={styles.card__price} style={isCancelled ? { textDecoration: 'line-through', color: '#94a3b8' } : {}}>
            {amount > 0 ? `₹${fmt(amount)}` : <span style={{ color: '#94a3b8' }}>TBD</span>}
          </span>
        </div>

        {/* Meta chips row */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.75rem' }}>
          {/* Date chip */}
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '3px 9px', borderRadius: 999,
            background: '#f1f5f9', fontSize: '0.72rem', fontWeight: 600, color: '#475569',
          }}>
            📅 {fmtDate(b.date)}
          </span>
          {/* Slot chip */}
          {slot && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '3px 9px', borderRadius: 999,
              background: '#f1f5f9', fontSize: '0.72rem', fontWeight: 600, color: '#475569',
            }}>
              🕐 {slot}
            </span>
          )}
          {/* Guests chip */}
          {pax !== null && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '3px 9px', borderRadius: 999,
              background: '#f1f5f9', fontSize: '0.72rem', fontWeight: 600, color: '#475569',
            }}>
              👥 {pax} pax{kids ? ` + ${kids} kids` : ''}
            </span>
          )}
        </div>

        {/* ── Expanded details ── */}
        {expanded && (
          <div className={styles.card__details}>
            <div className={styles.details_grid}>
              {ticket && (
                <div className={styles.detail_row}>
                  <span className={styles.detail_lbl}>Booking ID</span>
                  <span className={styles.detail_val} style={{ fontFamily: 'monospace', letterSpacing: '0.05em' }}>#{ticket}</span>
                </div>
              )}
              <div className={styles.detail_row}>
                <span className={styles.detail_lbl}>Status</span>
                <span className={styles.detail_val} style={{ color: sc.color, fontWeight: 700 }}>{sc.label}</span>
              </div>
              {amount > 0 && (
                <div className={styles.detail_row}>
                  <span className={styles.detail_lbl}>Charter Price</span>
                  <span className={styles.detail_val} style={{ fontWeight: 800 }}>₹{fmt(amount)}</span>
                </div>
              )}
              {pax !== null && (
                <div className={styles.detail_row}>
                  <span className={styles.detail_lbl}>Guests</span>
                  <span className={styles.detail_val}>
                    {pax} pax{kids ? ` + ${kids} kids` : ''}
                  </span>
                </div>
              )}
              {location && (
                <div className={cx(styles.detail_row, styles['detail_row--full'])}>
                  <span className={styles.detail_lbl}>Boarding Point</span>
                  {location.startsWith('http') ? (
                    <a href={location} target="_blank" rel="noreferrer" className={styles.location_link}>
                      📍 View on Google Maps →
                    </a>
                  ) : (
                    <span className={styles.detail_val}>{location}</span>
                  )}
                </div>
              )}
              {extras && extras.trim() && (
                <div className={cx(styles.detail_row, styles['detail_row--full'])}>
                  <span className={styles.detail_lbl}>Add-ons / Notes</span>
                  <span className={styles.detail_val}>{extras}</span>
                </div>
              )}
            </div>

            {/* Ready-to-sail note: only for upcoming confirmed */}
            {status === 'confirmed' && (
              <div className={styles.boarding_note}>
                <span className={styles.bn_icon}>⚓</span>
                <div>
                  <strong>Ready to sail!</strong>
                  <p>Please arrive 15 minutes before your slot. Carry a valid ID.</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Footer ── */}
        <div className={styles.card__foot}>
          <button className={styles.expand_btn} onClick={() => setExpanded(v => !v)}>
            {expanded ? '▲ Less' : '▼ Details'}
          </button>
          <a href={`https://wa.me/${WA}?text=${waText}`}
            target="_blank" rel="noreferrer"
            className={styles.help_btn}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            Help
          </a>
        </div>
      </div>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────
function EmptyState({ onBack }) {
  return (
    <div className={styles.empty}>
      <div className={styles.empty__waves}>
        <svg viewBox="0 0 200 80" fill="none">
          <path d="M0 40 Q25 20 50 40 Q75 60 100 40 Q125 20 150 40 Q175 60 200 40" stroke="#bfdbfe" strokeWidth="2.5" fill="none"/>
          <path d="M0 55 Q25 35 50 55 Q75 75 100 55 Q125 35 150 55 Q175 75 200 55" stroke="#dbeafe" strokeWidth="2" fill="none"/>
        </svg>
      </div>
      <div className={styles.empty__anchor}>⚓</div>
      <h3>No voyages yet</h3>
      <p>Your charter history will appear here once you make your first booking.</p>
      <button className={styles.empty__cta} onClick={onBack}>Explore Yachts →</button>
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function MyBookingsPage({ onBack, customer, onUserLogin }) {
  const [bookings,   setBookings]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [page,       setPage]       = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total,      setTotal]      = useState(0);
  // Local user state — updated after inline login
  const [user, setUser] = useState(customer || getCachedCustomer());

  const load = useCallback(async (p = 1) => {
    if (!isCustomerLoggedIn()) { setLoading(false); return; }
    setLoading(true);
    try {
      const res = await getCustomerBookingsAPI(p, 8);
      const d   = res.data;
      setBookings(d.bookings || []);
      setTotalPages(d.totalPages || 1);
      setTotal(d.total || 0);
      setPage(p);
    } catch {
      toast.error('Could not load your bookings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(1); }, [load]);

  const handleLoginSuccess = (u) => {
    setUser(u);
    onUserLogin?.(u);
    load(1); // reload bookings now that we're logged in
  };

  const loggedIn = isCustomerLoggedIn();

  return (
    <div className={styles.page}>
      {/* ── Header ── */}
      <div className={styles.header}>
        <button className={styles.back_btn} onClick={onBack}>
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
          </svg>
        </button>
        <div className={styles.header__text}>
          <h1 className={styles.header__title}>My Voyages</h1>
          {!loading && loggedIn && total > 0 && (
            <span className={styles.header__count}>{total} booking{total !== 1 ? 's' : ''}</span>
          )}
        </div>
        {user && (
          <div className={styles.header__avatar}>
            {(user.name || 'G')[0].toUpperCase()}
          </div>
        )}
      </div>

      {/* ── Content ── */}
      <div className={styles.content}>
        {loading ? (
          <div className={styles.grid}>
            {[0, 1, 2].map(i => <SkeletonCard key={i} />)}
          </div>
        ) : !loggedIn ? (
          /* ── Inline login instead of dead-end "Go Back" ── */
          <InlineLogin onSuccess={handleLoginSuccess} />
        ) : bookings.length === 0 ? (
          <EmptyState onBack={onBack} />
        ) : (
          <>
            <div className={styles.grid}>
              {bookings.map((b, i) => <BookingCard key={b._id} b={b} idx={i} />)}
            </div>

            {totalPages > 1 && (
              <div className={styles.pagination}>
                <button className={styles.pg_btn} disabled={page <= 1} onClick={() => load(page - 1)}>
                  ← Prev
                </button>
                <div className={styles.pg_dots}>
                  {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                    let pageIdx = i;
                    if (totalPages > 7) {
                      const half  = 3;
                      let   start = Math.max(0, page - 1 - half);
                      let   end   = start + 7;
                      if (end > totalPages) { end = totalPages; start = end - 7; }
                      pageIdx = start + i;
                    }
                    return (
                      <button key={pageIdx}
                        className={cx(styles.pg_dot, page === pageIdx + 1 && styles['pg_dot--on'])}
                        onClick={() => load(pageIdx + 1)}
                      />
                    );
                  })}
                  <span className={styles.pg_count}>{page} / {totalPages}</span>
                </div>
                <button className={styles.pg_btn} disabled={page >= totalPages} onClick={() => load(page + 1)}>
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Footer ── */}
      <div className={styles.footer_help}>
        <span>Need help?</span>
        <a href={`https://wa.me/${WA}?text=${encodeURIComponent('Hi GoaBoat! I need help with my booking.')}`}
          target="_blank" rel="noreferrer" className={styles.footer_wa}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
          Chat on WhatsApp
        </a>
      </div>
    </div>
  );
}