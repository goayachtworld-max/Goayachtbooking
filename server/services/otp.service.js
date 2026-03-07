// services/otp.service.js
// WhatsApp OTP via whatsapp-web.js — free, no API key, no per-message cost.
//
// HOW IT WORKS:
//   - Uses your WhatsApp Business number (+91 9921710376)
//   - Scans QR ONCE on first run; session saved to .wa-session/ (survives restarts)
//   - Sends OTP messages directly as a normal WhatsApp user
//   - No Meta approval, no BSP, no DLT registration needed
//
// SETUP (one-time):
//   npm install whatsapp-web.js qrcode-terminal
//   node index.js          ← scan the QR that prints in your terminal
//
// IMPORTANT:
//   • Use your WhatsApp Business number, NOT your personal one
//   • Add .wa-session/ to .gitignore — it contains your auth credentials
//   • The phone cleaning below handles Indian numbers correctly (91XXXXXXXX too)
//
// ENV (optional):
//   NODE_ENV=production    ← dev mode just logs OTPs to console, no WA needed

import pkg   from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode-terminal';
import crypto  from 'crypto';

// ─── WhatsApp client singleton ─────────────────────────────────────────────────
let waClient   = null;
let waReady    = false;
let initCalled = false;

export const initWhatsApp = () => {
  if (initCalled) return waClient;   // guard against double-init
  initCalled = true;

  // Dev: skip WA entirely — OTPs print to console
  if (process.env.NODE_ENV !== 'production') {
    console.log('INFO [DEV] WhatsApp OTP disabled — OTPs will be logged to console.');
    return null;
  }

  waClient = new Client({
    authStrategy: new LocalAuth({ dataPath: './.wa-session' }),
    puppeteer: {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    },
  });

  waClient.on('qr', (qr) => {
    console.log('\n======================================================');
    console.log('   SCAN THIS QR WITH YOUR WHATSAPP BUSINESS NUMBER');
    console.log('   (One-time only — session saved to .wa-session/)');
    console.log('======================================================\n');
    qrcode.generate(qr, { small: true });
  });

  waClient.on('ready', () => {
    waReady = true;
    console.log('WhatsApp OTP service ready');
  });

  waClient.on('auth_failure', (msg) => {
    // Session invalid — delete .wa-session/ and restart to get a fresh QR
    waReady = false;
    console.error('WhatsApp auth failed — delete .wa-session/ and restart:', msg);
  });

  waClient.on('disconnected', (reason) => {
    waReady = false;
    console.warn('WhatsApp disconnected:', reason, '— reconnecting in 5s');
    setTimeout(() => {
      if (waClient) {
        waClient.initialize().catch(err =>
          console.error('WhatsApp re-init failed:', err.message)
        );
      }
    }, 5_000);
  });

  waClient.initialize();
  return waClient;
};

export const isWhatsAppReady = () => waReady;

// ─── Helpers ───────────────────────────────────────────────────────────────────
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

const toWaId = (phone) => `91${phone}@c.us`;

// ─── Send OTP ──────────────────────────────────────────────────────────────────
export const sendOtpWhatsApp = async (phone, otp) => {
  // Dev: print to console so you can test without a real WhatsApp session
  if (process.env.NODE_ENV !== 'production') {
    console.log('--------------------------------------------');
    console.log(`  [DEV] OTP for +91${phone}: ${otp}`);
    console.log('--------------------------------------------');
    return { success: true };
  }

  if (!waReady || !waClient) {
    console.error('sendOtpWhatsApp: client not ready');
    return {
      success: false,
      message: 'WhatsApp service is starting up. Please try again in a moment.',
    };
  }

  try {
    const text =
      `*GoaBoat OTP*\n\n` +
      `Your one-time password is: *${otp}*\n\n` +
      `Valid for 10 minutes. Do not share this with anyone.\n` +
      `– GoaBoat Team`;

    await waClient.sendMessage(toWaId(phone), text);
    console.log(`OTP sent to +91${phone}`);
    return { success: true };
  } catch (err) {
    console.error(`WhatsApp send failed for +91${phone}:`, err.message);
    return {
      success: false,
      message: 'Could not send OTP via WhatsApp. Please try again.',
    };
  }
};