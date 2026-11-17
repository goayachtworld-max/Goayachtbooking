// services/otp.service.js
// Customer login codes (OTP) over WhatsApp, sent from the "system" WhatsApp
// account: the original session (.wa-session/session).
//
// The WhatsApp engine itself (sessions, QR codes, recovery) now lives in
// waSessions.service.js, because several accounts run side by side:
//   system        -> this file: customer OTP
//   company       -> booking messages for admin / staff / public bookings
//   agent         -> booking messages for that agent's bookings
// (see whatsappAccounts.service.js)
//
// SETUP: the first time the system session starts, a QR code prints in the
// server log. Scan it with the system WhatsApp number; the login is saved in
// .wa-session/ (keep that folder out of git).
//
//   WA_ENABLED=true   send for real in ANY environment (otherwise only when NODE_ENV=production)

import crypto from 'crypto';
import {
  isWhatsAppLive,
  startSession,
  getSnapshot,
  sendText,
} from './waSessions.service.js';

export { isWhatsAppLive };

const SYSTEM = 'system';
let initCalled = false;

// ─── Start WhatsApp (called once from index.js) ────────────────────────────────
export const initWhatsApp = () => {
  if (initCalled) return null;
  initCalled = true;

  if (!isWhatsAppLive()) {
    console.log('INFO [DEV] WhatsApp is OFF — OTPs and booking messages are only printed to the console. Set WA_ENABLED=true in .env to send for real.');
    return null;
  }

  console.log('WhatsApp: LIVE mode — starting the system account (a QR code or "READY" line follows within ~1 minute)');
  startSession(SYSTEM).catch((e) => console.error('WhatsApp system start failed:', e?.message));

  // Company and agent accounts that were linked before come back online one by one
  import('./whatsappAccounts.service.js')
    .then((m) => m.bootLinkedAccounts())
    .catch((e) => console.error('WhatsApp account boot failed:', e?.message));

  return null;
};

export const isWhatsAppReady = () => getSnapshot(SYSTEM)?.state === 'ready';

// ─── OTP helpers ───────────────────────────────────────────────────────────────

/** Generate a cryptographically secure 6-digit OTP */
export const generateOtp = () =>
  String(crypto.randomInt(100_000, 999_999));

/**
 * cleanPhone — strips everything except digits, then normalises to 10-digit
 * Indian mobile number.
 *
 * Handles:
 *   9876543210     → 9876543210
 *   +919876543210  → 9876543210
 *   919876543210   → 9876543210
 *   09876543210    → 9876543210
 *   9100000000     → 9100000000  ← correctly preserved (old regex broke this)
 */
export const cleanPhone = (phone) => {
  const digits = String(phone).replace(/\D/g, '');

  // 12+ digits starting with 91 → strip country code
  if (digits.length >= 12 && digits.startsWith('91')) {
    return digits.slice(2).slice(-10);
  }
  // 11 digits starting with 0 → strip trunk prefix
  if (digits.length === 11 && digits.startsWith('0')) {
    return digits.slice(1);
  }
  // Already a 10-digit number (91XXXXXXXX preserved correctly)
  return digits.slice(-10);
};

export const sendOtpWhatsApp = async (phone, otp) => {
  // Dev: print to console so you can test without a real WhatsApp session
  if (!isWhatsAppLive()) {
    console.log('--------------------------------------------');
    console.log(`  [DEV] OTP for +91${phone}: ${otp}`);
    console.log('--------------------------------------------');
    return { success: true };
  }

  const text =
    `*GoaBoat OTP*\n\n` +
    `Your one-time password is: *${otp}*\n\n` +
    `Valid for 10 minutes. Do not share this with anyone.\n` +
    `– GoaBoat Team`;

  const result = await sendText(SYSTEM, `91${phone}`, text);
  if (result.success) {
    console.log(`OTP sent to +91${phone}`);
    return { success: true };
  }

  console.error(`WhatsApp send failed for +91${phone}: ${result.reason}`);
  if (result.reason === 'WhatsApp client not ready') {
    return {
      success: false,
      message: 'WhatsApp service is starting up. Please try again in a moment.',
    };
  }
  return {
    success: false,
    message: 'Could not send OTP via WhatsApp. Please try again.',
  };
};

/** Send any text from the system account (kept for compatibility). */
export const sendWhatsAppText = (waNumber, text) => sendText(SYSTEM, waNumber, text);
