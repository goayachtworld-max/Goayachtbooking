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
//   WA_ENABLED=true        ← send for real in ANY environment (otherwise only when NODE_ENV=production)

import pkg   from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode-terminal';
import crypto  from 'crypto';

// ─── LIVE vs DEV mode ──────────────────────────────────────────────────────────
// LIVE  = the WhatsApp client starts and messages are really sent.
// DEV   = nothing is sent; OTPs / booking messages are printed to the console.
//
//   WA_ENABLED=true   -> LIVE in any environment (local, staging, production)
//   WA_ENABLED=false  -> DEV even in production
//   (not set)         -> LIVE only when NODE_ENV=production (the old behaviour)
export const isWhatsAppLive = () => {
  const flag = String(process.env.WA_ENABLED ?? '').trim().toLowerCase();
  if (flag === 'true') return true;
  if (flag === 'false') return false;
  return process.env.NODE_ENV === 'production';
};

// ─── WhatsApp client singleton ─────────────────────────────────────────────────
let waClient   = null;
let waReady    = false;
// ─── Keep a WhatsApp / Chrome hiccup from taking the whole API down ────────────
// whatsapp-web.js sometimes throws "Execution context was destroyed" when the
// WhatsApp page reloads. Uncaught, that crashed the entire server. Now such
// errors are logged, the server keeps running, and the WhatsApp client restarts
// itself (at most once every 30 s).
let guardInstalled = false;
let lastRecovery = 0;

const isWaLibError = (err) => {
  const text = `${err?.message ?? ''}\n${err?.stack ?? ''}`;
  return /whatsapp-web\.js|puppeteer/i.test(text);
};

const recoverWhatsApp = (why) => {
  waReady = false;
  const now = Date.now();
  if (now - lastRecovery < 30_000) return;
  lastRecovery = now;
  console.warn(`WhatsApp: ${why} — restarting the WhatsApp client in 10s`);
  setTimeout(async () => {
    try { await waClient?.destroy(); } catch { /* browser may already be gone */ }
    waClient = null;
    initCalled = false;
    initWhatsApp();
  }, 10_000);
};

const installCrashGuard = () => {
  if (guardInstalled) return;
  guardInstalled = true;
  process.on('unhandledRejection', (reason) => {
    if (isWaLibError(reason)) {
      console.error('WhatsApp library error (server kept running):', reason?.message);
      recoverWhatsApp('library error');
      return;
    }
    throw reason; // anything else behaves exactly as before (crash + PM2 restart)
  });
};

let initCalled = false;

export const initWhatsApp = () => {
  if (initCalled) return waClient;   // guard against double-init
  initCalled = true;

  // Dev: skip WA entirely — OTPs print to console
  if (!isWhatsAppLive()) {
    console.log('INFO [DEV] WhatsApp is OFF — OTPs and booking messages are only printed to the console. Set WA_ENABLED=true in .env to send for real.');
    return null;
  }

  installCrashGuard();
  console.log('WhatsApp: LIVE mode — starting client (a QR code or "READY" line follows within ~1 minute)');

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
    console.log('WhatsApp service READY — OTPs and booking messages will be sent for real');
  });

  // Progress logging: shows exactly where start-up stops if READY never arrives
  waClient.on('loading_screen', (percent, message) =>
    console.log(`WhatsApp: loading ${percent}% — ${message}`)
  );
  waClient.on('authenticated', () =>
    console.log('WhatsApp: authenticated (saved session accepted) — waiting for READY...')
  );
  waClient.on('change_state', (state) => console.log('WhatsApp: state ->', state));

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

  // Watchdog: if neither a QR nor READY shows up, say so once a minute (max 10 min)
  const startedAt = Date.now();
  const watchdog = setInterval(() => {
    const secs = Math.round((Date.now() - startedAt) / 1000);
    if (waReady || secs > 600) return clearInterval(watchdog);
    console.warn(`WhatsApp: still NOT ready ${secs}s after start (no QR / READY received yet)`);
  }, 60_000);
  watchdog.unref?.();

  // Without a catch, a failed start (e.g. Chromium missing) is silent or crashes the server.
  waClient.initialize().catch((err) => {
    waReady = false;
    console.error('WhatsApp FAILED TO START:', err.message);
    console.error(
      'WhatsApp: most common cause is Chromium or its system libraries missing on this server. ' +
      'Messages will keep failing with "WhatsApp client not ready" until this is fixed and the server restarted.'
    );
  });
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
  if (!isWhatsAppLive()) {
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

// ─── Send any text message (used for booking cancellation / update notices) ───
// `waNumber` = full international number, digits only (e.g. "919876543210").
export const sendWhatsAppText = async (waNumber, text) => {
  // Dev: print to console, nothing is sent
  if (!isWhatsAppLive()) {
    console.log('--------------------------------------------');
    console.log(`  [DEV] WhatsApp to +${waNumber}:\n${text}`);
    console.log('--------------------------------------------');
    return { success: true, dev: true };
  }

  if (!waReady || !waClient) {
    return { success: false, reason: 'WhatsApp client not ready' };
  }

  try {
    // Resolve the number first: fails cleanly if it is not on WhatsApp
    const id = await waClient.getNumberId(waNumber);
    if (!id) return { success: false, reason: 'Number is not on WhatsApp' };
    await waClient.sendMessage(id._serialized, text);
    return { success: true };
  } catch (err) {
    if (/Execution context was destroyed|Session closed|Target closed|Protocol error|detached Frame/i.test(err.message)) {
      recoverWhatsApp(`send failed (${err.message})`);
      return { success: false, reason: 'WhatsApp client not ready' };
    }
    return { success: false, reason: err.message };
  }
};