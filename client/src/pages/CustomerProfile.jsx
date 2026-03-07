// components/CustomerProfile.jsx
// Clean 2-step OTP flow: enter phone → OTP arrives on WhatsApp → enter it here.
// No redirect, no manual tap. Exactly like normal SMS OTP but via WhatsApp.

import React, { useState, useEffect, useCallback } from 'react';
import styles from '../styles/CustomerProfile.module.css';
import toast from 'react-hot-toast';
import {
  sendCustomerOtpAPI, verifyCustomerOtpAPI, getCustomerMeAPI,
  updateCustomerProfileAPI, getCustomerBookingsAPI,
  saveCustomerSession, clearCustomerSession,
  getCachedCustomer, isCustomerLoggedIn,
} from '../services/operations/customerAuthAPI';

const cx = (...c) => c.filter(Boolean).join(' ');
const fmt = n => Number(n || 0).toLocaleString('en-IN');
import { WA_NUMBER as WA, WA_NUMBER_DISPLAY } from '../constants';
const RESEND_CD = 60;
const fmtDate = d => {
  if (!d) return '—';
  const s = String(d).slice(0, 10);
  return new Date(s + 'T00:00:00Z').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

function useCountdown() {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft(l => l - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);
  return { left, start: (s = RESEND_CD) => setLeft(s) };
}

// ─── OTP Login ─────────────────────────────────────────────────────────────
function OtpLogin({ onSuccess }) {
  const [phone, setPhone] = useState('');
  const [otp, setOtp]     = useState('');
  const [step, setStep]   = useState(1);   // 1 = enter phone, 2 = enter OTP
  const [busy, setBusy]   = useState(false);
  const { left, start }   = useCountdown();

  const digits = phone.replace(/\D/g, '');

  const handleSend = async () => {
    if (digits.length < 10) return toast.error('Enter a valid 10-digit number');
    setBusy(true);
    try {
      await sendCustomerOtpAPI(digits);
      setStep(2);
      start();
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
      toast.success(d.isNewCustomer ? 'Welcome! 🎉' : 'Welcome back!');
      onSuccess(d.customer, d.isNewCustomer);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Invalid OTP');
    } finally { setBusy(false); }
  };

  const handleResend = async () => {
    if (left > 0) return;
    setBusy(true);
    try {
      await sendCustomerOtpAPI(digits);
      setOtp(''); start();
      toast.success('New OTP sent to your WhatsApp!');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to resend');
    } finally { setBusy(false); }
  };

  return (
    <div className={styles.login}>
      <div className={styles.login__icon}>🛥️</div>
      <h2 className={styles.login__title}>Profile &amp; Settings</h2>

      {step === 1 ? (
        <>
          <p className={styles.login__sub}>
            Enter your WhatsApp number. We'll send a <b>free OTP</b> to your WhatsApp in seconds.
          </p>
          <div className={styles.field}>
            <label>WhatsApp Number</label>
            <div className={styles.prefix_row}>
              <span className={styles.prefix}>+91</span>
              <input type="tel" maxLength={10} placeholder="10-digit number"
                value={phone}
                onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
                onFocus={e => setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300)}
                autoFocus />
            </div>
          </div>
          <button className={styles.cta} onClick={handleSend}
            disabled={busy || digits.length < 10}>
            {busy ? 'Sending…' : '📲 Send OTP'}
          </button>
        </>
      ) : (
        <>
          <p className={styles.login__sub}>
            OTP sent to <b>+91 {digits}</b>.
            <br/>
            <span style={{ color: '#25d366', fontWeight: 700 }}>
              📲 Check your WhatsApp messages
            </span>
          </p>
          <div className={styles.field}>
            <label>Enter OTP</label>
            <input className={styles.otp_input}
              type="text" inputMode="numeric" maxLength={6}
              placeholder="· · · · · ·" value={otp}
              onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              onKeyDown={e => e.key === 'Enter' && handleVerify()}
              onFocus={e => setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300)}
              autoFocus />
          </div>
          <button className={styles.cta} onClick={handleVerify}
            disabled={busy || otp.length < 4}>
            {busy ? 'Verifying…' : 'Verify & Login'}
          </button>
          <div className={styles.resend_row}>
            {left > 0
              ? <span className={styles.timer}>Resend in {left}s</span>
              : <button className={styles.link_btn} onClick={handleResend} disabled={busy}>Resend OTP</button>
            }
            <button className={styles.link_btn} onClick={() => { setStep(1); setOtp(''); }}>
              Change number
            </button>
          </div>
        </>
      )}

      <div className={styles.divider}><span>or</span></div>
      <a href={`https://wa.me/${WA}?text=${encodeURIComponent('Hi! I need help with my GoaBoat booking.')}`}
        target="_blank" rel="noreferrer" className={styles.wa_btn}>
        💬 Chat with Support
      </a>
    </div>
  );
}

// ─── Profile Tab ───────────────────────────────────────────────────────────
function ProfileTab({ customer, onUpdate, onLogout }) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy]       = useState(false);
  const [form, setForm]       = useState({
    name: customer.name || '',
    email: customer.email || '',
    alternateContact: customer.alternateContact || '',
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    if (!customer.name || customer.name === 'Guest') setEditing(true);
  }, [customer.name]);

  const handleSave = async () => {
    if (!form.name.trim() || form.name.trim().length < 2)
      return toast.error('Name must be at least 2 characters');
    setBusy(true);
    try {
      const res = await updateCustomerProfileAPI({
        name: form.name.trim(),
        email: form.email.trim() || undefined,
        alternateContact: form.alternateContact.replace(/\D/g, '').slice(0, 10) || undefined,
      });
      onUpdate(res.data.customer);
      setEditing(false);
      toast.success('Profile updated!');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Update failed');
    } finally { setBusy(false); }
  };

  return (
    <div className={styles.tab_body}>
      <div className={styles.avatar_card}>
        <div className={styles.avatar}>{(customer.name || 'G')[0].toUpperCase()}</div>
        <div>
          <div className={styles.avatar_name}>{customer.name || 'Guest'}</div>
          <div className={styles.avatar_phone}>{customer.contact}</div>
        </div>
        {!editing && (
          <button className={styles.edit_btn} onClick={() => setEditing(true)}>✏️ Edit</button>
        )}
      </div>

      {editing ? (
        <div className={styles.edit_form}>
          <div className={styles.field}>
            <label>Full Name <span className={styles.req}>*</span></label>
            <input value={form.name} onChange={e => set('name', e.target.value)}
              placeholder="Your full name" autoFocus />
          </div>
          <div className={styles.field}>
            <label>Email <span className={styles.opt}>(optional)</span></label>
            <input type="email" value={form.email}
              onChange={e => set('email', e.target.value)} placeholder="your@email.com" />
          </div>
          <div className={styles.field}>
            <label>Alternate Mobile <span className={styles.opt}>(optional)</span></label>
            <input type="tel" maxLength={10} value={form.alternateContact}
              onChange={e => set('alternateContact', e.target.value.replace(/\D/g, '').slice(0, 10))}
              placeholder="Second contact" />
          </div>
          <div className={styles.form_actions}>
            <button className={styles.save_btn} onClick={handleSave} disabled={busy}>
              {busy ? 'Saving…' : 'Save Changes'}
            </button>
            <button className={styles.cancel_btn} onClick={() => {
              setEditing(false);
              setForm({ name: customer.name||'', email: customer.email||'', alternateContact: customer.alternateContact||'' });
            }}>Cancel</button>
          </div>
        </div>
      ) : (
        <div className={styles.detail_list}>
          {[
            ['WhatsApp', customer.contact],
            ['Email',    customer.email            || '—'],
            ['Alternate', customer.alternateContact || '—'],
          ].map(([l, v]) => (
            <div key={l} className={styles.detail_row}>
              <span className={styles.detail_lbl}>{l}</span>
              <span className={styles.detail_val}>{v}</span>
            </div>
          ))}
        </div>
      )}

      <button className={styles.logout_btn} onClick={onLogout}>↩ Log Out</button>
    </div>
  );
}

// ─── Bookings Tab ──────────────────────────────────────────────────────────
const S_CLS = { confirmed: styles.s_confirmed, pending: styles.s_pending, cancelled: styles.s_cancelled };

function BookingsTab() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [page, setPage]         = useState(1);
  const [totalPages, setTotal]  = useState(1);

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const res = await getCustomerBookingsAPI(p);
      const d   = res.data;
      setBookings(d.bookings || []);
      setTotal(d.totalPages  || 1);
      setPage(p);
    } catch { toast.error('Could not load bookings'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(1); }, [load]);

  if (loading) return (
    <div className={styles.centered}><div className={styles.spinner} /><p>Loading…</p></div>
  );
  if (!bookings.length) return (
    <div className={styles.empty}>
      <div className={styles.empty_icon}>⚓</div>
      <p>No bookings yet</p>
      <span>Your charter history will appear here</span>
    </div>
  );

  return (
    <div className={styles.tab_body}>
      {bookings.map(b => (
        <div key={b._id} className={styles.booking_card}>
          <div className={styles.bc_top}>
            {b.yacht?.photos?.[0]
              ? <img src={b.yacht.photos[0]} alt="" className={styles.bc_img} />
              : <div className={styles.bc_img_ph}>⚓</div>
            }
            <div className={styles.bc_info}>
              <div className={styles.bc_name}>{b.yacht?.name || 'Yacht Charter'}</div>
              <div className={styles.bc_date}>📅 {fmtDate(b.date)}{b.slot ? ' · ' + b.slot : ''}</div>
              <div className={styles.bc_guests}>
                👥 {b.numAdults || 0} adult{b.numAdults !== 1 ? 's' : ''}
                {b.numKids ? ', ' + b.numKids + ' kid' + (b.numKids !== 1 ? 's' : '') : ''}
              </div>
            </div>
            <span className={cx(styles.bc_status, S_CLS[b.status] || styles.s_pending)}>
              {b.status || 'pending'}
            </span>
          </div>
          <div className={styles.bc_foot}>
            <span className={styles.bc_price}>₹{fmt(b.yacht?.sellingPrice || b.totalAmount)}</span>
            <a href={`https://wa.me/${WA}?text=${encodeURIComponent('Hi, help needed for booking: ' + b._id)}`}
              target="_blank" rel="noreferrer" className={styles.bc_wa}>💬 Help</a>
          </div>
        </div>
      ))}
      {totalPages > 1 && (
        <div className={styles.pagination}>
          <button disabled={page <= 1} onClick={() => load(page - 1)}>← Prev</button>
          <span>{page} / {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => load(page + 1)}>Next →</button>
        </div>
      )}
    </div>
  );
}

// ─── Root ──────────────────────────────────────────────────────────────────
export default function CustomerProfile({ onClose, initialCustomer, initialTab = "profile", onLogout }) {
  const [customer, setCustomer] = useState(initialCustomer || getCachedCustomer());

  useEffect(() => {
    if (isCustomerLoggedIn() && !customer) {
      getCustomerMeAPI().then(res => setCustomer(res.data.customer)).catch(() => {});
    }
  }, []);

  const handleLoginSuccess = (c) => {
    setCustomer(c);
  };

  const handleUpdate = c => {
    setCustomer(c);
    localStorage.setItem('customerProfile', JSON.stringify(c));
  };

  const handleLogout = () => {
    clearCustomerSession();
    setCustomer(null);
    toast('Logged out', { icon: '👋' });
    // Notify parent (PublicHome) to clear its user state too
    onLogout?.();
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.panel} onClick={e => e.stopPropagation()}>
        <div className={styles.panel_hd}>
          <span className={styles.panel_title}>Profile &amp; Settings</span>
          <button className={styles.close_btn} onClick={onClose}>✕</button>
        </div>
        {!customer ? (
          <OtpLogin onSuccess={handleLoginSuccess} />
        ) : (
          <>
            {/* No bookings tab — bookings are a full dedicated page, not a panel tab */}
            <ProfileTab customer={customer} onUpdate={handleUpdate} onLogout={handleLogout} />
          </>
        )}
      </div>
    </div>
  );
}