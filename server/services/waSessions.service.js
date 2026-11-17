// services/waSessions.service.js
//
// Runs several WhatsApp sessions at once, one per account key:
//   "system"        customer login codes (the original session, folder .wa-session/session)
//   "c-<companyId>" a company's number, linked by its admin
//   "e-<agentId>"   an agent's own number
//
// Each session is its own hidden Chrome (whatsapp-web.js), so the number of
// sessions is capped (WA_MAX_SESSIONS, default 8).
//
// What this file takes care of, per session:
//   - start / stop / log out (unlink) / reconnect
//   - QR code and "link with phone number" pairing code, for the settings screen
//   - automatic recovery with back-off when Chrome or WhatsApp drops
//   - a health check, so a silently dead session is noticed and restarted
//   - one crash guard, so a WhatsApp library error never takes the API down
//
// Nothing here knows about bookings or the database: other code listens through
// setSessionHooks() and sends through sendText().

import pkg from "whatsapp-web.js";
import fs from "fs/promises";
import path from "path";

const { Client, LocalAuth } = pkg;

// ─── LIVE vs DEV mode ──────────────────────────────────────────────────────────
//   WA_ENABLED=true   -> LIVE in any environment
//   WA_ENABLED=false  -> DEV even in production
//   (not set)         -> LIVE only when NODE_ENV=production
export const isWhatsAppLive = () => {
  const flag = String(process.env.WA_ENABLED ?? "").trim().toLowerCase();
  if (flag === "true") return true;
  if (flag === "false") return false;
  return process.env.NODE_ENV === "production";
};

const SESSION_ROOT = "./.wa-session";
const MAX_RECOVERIES = 5;
const ACTIVE_STATES = ["starting", "qr", "pairing", "authenticated", "ready", "disconnected"];
const DEAD_PAGE_RE = /Execution context was destroyed|Session closed|Target closed|Protocol error|detached Frame/i;

const maxSessions = () => Number(process.env.WA_MAX_SESSIONS) || 8;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (key, ...args) => console.log(`[WA ${key}]`, ...args);

// Replaceable in tests so the engine can be exercised without Chrome.
let clientFactory = (options) => new Client(options);
export const __setClientFactory = (factory) => {
  clientFactory = factory;
};

const sessions = new Map(); // key -> session
let hooks = { onUpdate: async () => {} };

/** Other code (the accounts service) hears about every state change here. */
export const setSessionHooks = (h) => {
  hooks = { ...hooks, ...h };
};

const newSession = (key) => ({
  key,
  client: null,
  state: "stopped", // stopped|starting|qr|pairing|authenticated|ready|disconnected|failed
  qr: null,
  qrDataUrl: null,
  pairingCode: null,
  pairingPhone: null,
  phone: null,
  error: null,
  failures: 0,
  userStopped: false,
  recovering: false,
  authFailed: false, // WhatsApp rejected the saved login: the next start must be from scratch
  startedAt: 0,
  watchdog: null,
});

const snapshotOf = (s) => ({
  key: s.key,
  state: s.state,
  qr: s.qr,
  pairingCode: s.pairingCode,
  phone: s.phone,
  error: s.error,
  startedAt: s.startedAt,
});

/** `linked`: true = a phone is linked now, false = it was unlinked, undefined = no change. */
const emitUpdate = (s, linked) => {
  Promise.resolve(
    hooks.onUpdate({ key: s.key, state: s.state, phone: s.phone, error: s.error, linked })
  ).catch((e) => console.error(`[WA ${s.key}] update hook failed:`, e?.message));
};

const dirFor = (key) => path.join(SESSION_ROOT, key === "system" ? "session" : `session-${key}`);

const puppeteerOptions = () => ({
  headless: true,
  // Loading WhatsApp Web can be slow on a small VPS; the default limit is 3 min.
  protocolTimeout: 10 * 60 * 1000,
  timeout: 2 * 60 * 1000,
  args: [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu",
    "--disable-extensions",
    "--disable-background-networking",
    "--disable-default-apps",
    "--no-first-run",
    "--mute-audio",
  ],
});

/** Digits-only international number; a bare 10-digit number is treated as Indian. */
const normalizePhone = (value) => {
  let d = String(value ?? "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 10) d = "91" + d;
  return d.length >= 11 && d.length <= 15 ? d : null;
};

// ─── tear down one browser ─────────────────────────────────────────────────────
const teardown = async (s) => {
  const client = s.client;
  s.client = null; // events from the old client are ignored from here on
  if (s.watchdog) {
    clearInterval(s.watchdog);
    s.watchdog = null;
  }
  if (!client) return;
  try {
    await Promise.race([client.destroy(), sleep(15_000)]); // never wait on a stuck browser
  } catch {
    /* browser may already be gone */
  }
  try {
    client.pupBrowser?.process?.()?.kill("SIGKILL");
  } catch {
    /* already gone */
  }
};

// ─── recovery ──────────────────────────────────────────────────────────────────
const recover = (key, why, delayMs = 10_000) => {
  const s = sessions.get(key);
  if (!s || s.userStopped || s.recovering) return;
  if (s.state === "stopped" || s.state === "failed") return;

  s.recovering = true;
  s.failures += 1;

  if (s.failures > MAX_RECOVERIES) {
    s.recovering = false;
    teardown(s).finally(() => {
      s.state = "failed";
      s.error = `Could not stay connected (${why}). Click Reconnect.`;
      log(key, `giving up after ${MAX_RECOVERIES} attempts: ${why}`);
      emitUpdate(s);
    });
    return;
  }

  const delay = Math.min(delayMs * 2 ** (s.failures - 1), 5 * 60_000);
  s.state = "disconnected";
  s.error = why;
  emitUpdate(s);
  console.warn(`[WA ${key}] ${why} — restarting in ${Math.round(delay / 1000)}s (attempt ${s.failures}/${MAX_RECOVERIES})`);

  setTimeout(async () => {
    await teardown(s);
    s.recovering = false;
    if (s.userStopped) return;
    launch(s);
  }, delay);
};

// ─── the Chrome / WhatsApp session itself ──────────────────────────────────────
const launch = (s) => {
  const options = {
    authStrategy: new LocalAuth({
      clientId: s.key === "system" ? undefined : s.key,
      dataPath: SESSION_ROOT,
    }),
    puppeteer: puppeteerOptions(),
    qrMaxRetries: 10, // an unattended QR stops after a few minutes instead of running forever
    ...(s.pairingPhone
      ? { pairWithPhoneNumber: { phoneNumber: s.pairingPhone, showNotification: true } }
      : {}),
  };

  const client = clientFactory(options);
  s.client = client;
  s.state = "starting";
  s.startedAt = Date.now();
  emitUpdate(s);
  log(s.key, "starting client");

  // ignore anything an old (replaced) client may still emit
  const mine = (fn) => (...args) => {
    if (s.client === client) fn(...args);
  };

  client.on("qr", mine((qr) => {
    s.state = "qr";
    s.qr = qr;
    s.qrDataUrl = null;
    s.pairingCode = null;
    s.error = null;
    emitUpdate(s);
    if (s.key === "system") {
      // The system account has no settings screen: its QR code is scanned from the server log
      import("qrcode-terminal")
        .then((m) => {
          console.log("\n====== SCAN THIS QR WITH THE SYSTEM WHATSAPP NUMBER (customer login codes) ======");
          (m.default || m).generate(qr, { small: true });
        })
        .catch(() => console.log("[WA system] QR code ready but qrcode-terminal is missing"));
    }
  }));

  client.on("code", mine((code) => {
    s.state = "pairing";
    s.pairingCode = code;
    s.qr = null;
    s.error = null;
    emitUpdate(s);
  }));

  client.on("authenticated", mine(() => {
    s.state = "authenticated";
    s.qr = null;
    s.qrDataUrl = null;
    s.pairingCode = null;
    emitUpdate(s, true);
    log(s.key, "authenticated, waiting for READY");
  }));

  client.on("ready", mine(() => {
    s.state = "ready";
    s.failures = 0;
    s.error = null;
    s.phone = client.info?.wid?.user || s.phone;
    emitUpdate(s, true);
    log(s.key, `READY${s.phone ? ` (+${s.phone})` : ""}`);
  }));

  client.on("auth_failure", mine((msg) => {
    s.state = "failed";
    s.authFailed = true;
    s.error = "WhatsApp rejected the saved login. Click Connect to link the number again.";
    log(s.key, "auth failure:", msg);
    emitUpdate(s, false);
  }));

  client.on("disconnected", mine(async (reason) => {
    const why = String(reason);
    if (/LOGOUT/i.test(why)) {
      // Unlinked from the phone: the saved login is useless, don't keep retrying
      await teardown(s);
      await fs.rm(dirFor(s.key), { recursive: true, force: true }).catch(() => {});
      s.state = "stopped";
      s.phone = null;
      s.error = "WhatsApp was unlinked from the phone. Connect again to link it.";
      log(s.key, "logged out from the phone");
      emitUpdate(s, false);
    } else if (/qrcode retries/i.test(why)) {
      await teardown(s);
      s.state = "stopped";
      s.qr = null;
      s.error = "The QR code expired before it was scanned. Click Connect to try again.";
      emitUpdate(s);
    } else {
      recover(s.key, `disconnected (${why})`);
    }
  }));

  // watchdog: say so if neither QR nor READY arrives (max 10 min)
  s.watchdog = setInterval(() => {
    const secs = Math.round((Date.now() - s.startedAt) / 1000);
    if (s.state === "ready" || s.state === "qr" || s.state === "pairing" || secs > 600) {
      clearInterval(s.watchdog);
      s.watchdog = null;
      return;
    }
    console.warn(`[WA ${s.key}] still not ready ${secs}s after start (state: ${s.state})`);
  }, 60_000);
  s.watchdog.unref?.();

  client.initialize().catch((err) => {
    if (s.client !== client) return;
    const msg = err?.message || String(err);
    console.error(`[WA ${s.key}] FAILED TO START: ${msg}`);
    if (/timed out|timeout/i.test(msg)) {
      console.error(`[WA ${s.key}] Chrome is responding too slowly (low CPU / RAM?).`);
    }
    recover(s.key, `start-up failed (${msg})`);
  });
};

// ─── public API ────────────────────────────────────────────────────────────────

export const getSnapshot = (key) => {
  const s = sessions.get(key);
  return s ? snapshotOf(s) : null;
};

export const activeSessionCount = () => [...sessions.values()].filter((s) => s.client).length;

/**
 * Start a session (no-op if it is already running).
 *   pairingPhone  link with an 8-character code for this phone number instead of a QR code
 *   fresh         throw away any saved login first, then start from scratch
 */
export const startSession = async (key, { pairingPhone = null, fresh = false } = {}) => {
  if (!isWhatsAppLive()) {
    return { ok: false, dev: true, reason: "WhatsApp is switched off on this server (dev mode)." };
  }

  let s = sessions.get(key);
  if (s?.authFailed) fresh = true; // a rejected login can't be reused
  if (s && !fresh && ACTIVE_STATES.includes(s.state) && (s.client || s.recovering)) {
    return { ok: true, snapshot: snapshotOf(s) };
  }

  if (!(s && s.client) && activeSessionCount() >= maxSessions()) {
    return {
      ok: false,
      reason: `This server can run at most ${maxSessions()} WhatsApp accounts at the same time.`,
    };
  }

  if (!s) {
    s = newSession(key);
    sessions.set(key, s);
  }
  if (fresh || s.client) {
    await teardown(s);
  }
  if (fresh) {
    await fs.rm(dirFor(key), { recursive: true, force: true }).catch(() => {});
  }

  let phone = null;
  if (pairingPhone) {
    phone = normalizePhone(pairingPhone);
    if (!phone) return { ok: false, reason: "Enter the phone number with country code, e.g. 919876543210." };
  }

  s.userStopped = false;
  s.recovering = false;
  s.authFailed = false;
  s.failures = 0;
  s.error = null;
  s.qr = null;
  s.qrDataUrl = null;
  s.pairingCode = null;
  s.pairingPhone = phone;

  installGuards();
  launch(s);
  return { ok: true, snapshot: snapshotOf(s) };
};

/** Stop the browser but keep the saved login (used by Reconnect and shutdown). */
export const stopSession = async (key) => {
  const s = sessions.get(key);
  if (!s) return;
  s.userStopped = true;
  await teardown(s);
  s.state = "stopped";
  emitUpdate(s);
};

/** Unlink the number: log out of WhatsApp and delete the saved login. */
export const logoutSession = async (key) => {
  const s = sessions.get(key);
  if (s) {
    s.userStopped = true;
    const client = s.client;
    if (client) {
      try {
        await Promise.race([client.logout(), sleep(20_000)]);
      } catch {
        /* fall through to teardown */
      }
    }
    await teardown(s);
    sessions.delete(key);
  }
  await fs.rm(dirFor(key), { recursive: true, force: true }).catch(() => {});
  hooks.onUpdate({ key, state: "stopped", phone: null, error: null, linked: false });
  log(key, "unlinked");
};

/** PNG data URL of the current QR code (null if there is none or `qrcode` is missing). */
export const getQrDataUrl = async (key) => {
  const s = sessions.get(key);
  if (!s || !s.qr) return null;
  if (s.qrDataUrl) return s.qrDataUrl;
  try {
    const mod = await import("qrcode");
    const QR = mod.default || mod;
    s.qrDataUrl = await QR.toDataURL(s.qr, { margin: 1, width: 300 });
    return s.qrDataUrl;
  } catch (e) {
    console.error(`[WA ${key}] could not draw the QR code (is the "qrcode" package installed?):`, e?.message);
    return null;
  }
};

/**
 * Send a text. `reason: "WhatsApp client not ready"` means "try again shortly".
 * Any other failure reason is final.
 */
export const sendText = async (key, waNumber, text) => {
  if (!isWhatsAppLive()) {
    console.log("--------------------------------------------");
    console.log(`  [DEV] WhatsApp from "${key}" to +${waNumber}:\n${text}`);
    console.log("--------------------------------------------");
    return { success: true, dev: true };
  }

  const s = sessions.get(key);
  if (!s || s.state !== "ready" || !s.client) {
    return { success: false, reason: "WhatsApp client not ready" };
  }

  try {
    const id = await s.client.getNumberId(waNumber); // fails cleanly if not on WhatsApp
    if (!id) return { success: false, reason: "Number is not on WhatsApp" };
    await s.client.sendMessage(id._serialized, text);
    return { success: true };
  } catch (err) {
    if (DEAD_PAGE_RE.test(err.message)) {
      recover(key, `send failed (${err.message})`);
      return { success: false, reason: "WhatsApp client not ready" };
    }
    return { success: false, reason: err.message };
  }
};

// ─── health check + guards ─────────────────────────────────────────────────────
export const probeSessions = async () => {
  for (const s of sessions.values()) {
    if (s.state !== "ready" || !s.client) continue;
    try {
      await Promise.race([
        s.client.getState(),
        sleep(15_000).then(() => {
          throw new Error("no answer in 15s");
        }),
      ]);
    } catch (e) {
      recover(s.key, `health check failed (${e.message})`);
    }
  }
};

let guardsInstalled = false;
let lastProbe = 0;

const isWaLibError = (err) => /whatsapp-web\.js|puppeteer/i.test(`${err?.message ?? ""}\n${err?.stack ?? ""}`);

const installGuards = () => {
  if (guardsInstalled) return;
  guardsInstalled = true;

  // A WhatsApp / Chrome error nobody caught used to crash the whole API.
  process.on("unhandledRejection", (reason) => {
    if (isWaLibError(reason)) {
      console.error("WhatsApp library error (server kept running):", reason?.message);
      if (Date.now() - lastProbe > 30_000) {
        lastProbe = Date.now();
        setTimeout(() => probeSessions().catch(() => {}), 2_000);
      }
      return;
    }
    throw reason; // anything else behaves exactly as before (crash + PM2 restart)
  });

  const timer = setInterval(() => probeSessions().catch(() => {}), 5 * 60_000);
  timer.unref?.();

  // Stop leftover Chrome processes when PM2 restarts the server, so the next
  // start does not find the session folders locked.
  const shutdown = () => {
    for (const s of sessions.values()) {
      try {
        s.client?.pupBrowser?.process?.()?.kill("SIGKILL");
      } catch {
        /* ignore */
      }
    }
    setTimeout(() => process.exit(0), 300);
  };
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
};
