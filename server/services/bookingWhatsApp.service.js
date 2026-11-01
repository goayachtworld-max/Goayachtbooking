// services/bookingWhatsApp.service.js
//
// Automatic WhatsApp messages to the customer when a booking is
//   - CONFIRMED  (created as confirmed, or a pending booking gets confirmed)
//   - UPDATED    (yacht, date, time, group size, inclusions/notes; price only if enabled)
//   - CANCELLED  (only if it had been confirmed)
//
// Pending bookings / quotations get NO message: the customer hasn't been told
// about them yet, so a "your booking was updated/cancelled" would only confuse.
//
// Called from the server controllers, so it fires no matter which screen made
// the change. It never throws and never delays the API response: every call is
// fire-and-forget and runs through a slow queue (one message every 2-4 s) so
// bursts of edits don't look like spam to WhatsApp.
//
// ENV (all optional)
//   WA_BOOKING_NOTIFY=false       turn all automatic booking messages off
//   WA_NOTIFY_AMOUNTS=true        also message the customer when the booking
//                                 price / token amount is edited (default: off)
//   WA_CONFIRM_DELAY_SECONDS=30   wait before sending the confirmation, so the
//                                 advance payment (recorded a moment after the
//                                 booking is created) is included. Default 30.
//   WA_ENABLED=true               send for real in any environment (see otp.service.js).
//                                 Without it, messages only print to the console unless
//                                 NODE_ENV=production.

import { BookingModel } from "../models/booking.model.js";
import { WaMessageLogModel } from "../models/waMessageLog.model.js";
import { sendWhatsAppText } from "./otp.service.js";

const TICKET_BASE_URL = "https://goaboat.com";

// ───────────────────────── formatting helpers (pure) ─────────────────────────
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const isoDay = (d) => {
  if (typeof d === "string" && /^\d{4}-\d{2}-\d{2}/.test(d)) return d.slice(0, 10);
  return new Date(d).toISOString().slice(0, 10); // bookings store UTC midnight
};

export const fmtDate = (d) => {
  if (!d) return "";
  const [y, m, day] = isoDay(d).split("-");
  return `${Number(day)} ${MONTHS[Number(m) - 1]} ${y}`;
};

export const fmtTime = (t) => {
  if (!t) return "";
  let [h, m] = String(t).split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}.${String(m).padStart(2, "0")} ${period}`;
};

const fmtRange = (start, end) => `${fmtTime(start)} to ${fmtTime(end)}`;

/**
 * Digits-only international number for WhatsApp, or null if we can't be sure.
 * (Unlike cleanPhone(), this does NOT chop foreign numbers down to 10 digits —
 * that would send a message to a stranger's Indian number.)
 */
export const normalizeWaNumber = (contact) => {
  let d = String(contact ?? "").replace(/\D/g, "");
  if (!d) return null;
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 10) return "91" + d;
  if (d.length === 11 && d.startsWith("0")) return "91" + d.slice(1);
  if (d.length === 12 && d.startsWith("91")) return d;
  if (d.length >= 11 && d.length <= 15) return d; // already has a country code
  return null;
};

// ───────────────────────── change detection (pure) ───────────────────────────
/** The fields we compare. Controllers pass a snapshot taken before and after. */
export const snapshot = (booking, yachtName) => ({
  yachtName,
  date: booking.date ? isoDay(booking.date) : undefined,
  startTime: booking.startTime,
  endTime: booking.endTime,
  numPeople: booking.numPeople,
  extraDetails: booking.extraDetails,
  quotedAmount: booking.quotedAmount,
  tokenAmount: booking.tokenAmount,
});

const differs = (a, b) => a !== undefined && b !== undefined && String(a ?? "") !== String(b ?? "");

/**
 * Compares two snapshots and returns human lines, e.g.
 *   ["Trip Date: 10 Nov 2026 → 12 Nov 2026", "Group Size: 5 Pax → 6 Pax"]
 * Only keys present in BOTH snapshots are compared.
 */
export const buildChanges = (before = {}, after = {}, { includeAmounts = false } = {}) => {
  const lines = [];

  if (differs(before.yachtName, after.yachtName)) {
    lines.push(`Yacht: ${before.yachtName} → ${after.yachtName}`);
  }
  if (differs(before.date, after.date)) {
    lines.push(`Trip Date: ${fmtDate(before.date)} → ${fmtDate(after.date)}`);
  }
  if (differs(before.startTime, after.startTime) || differs(before.endTime, after.endTime)) {
    lines.push(
      `Time: ${fmtRange(before.startTime, before.endTime)} → ${fmtRange(after.startTime, after.endTime)}`
    );
  }
  if (differs(before.numPeople, after.numPeople)) {
    lines.push(`Group Size: ${before.numPeople} Pax → ${after.numPeople} Pax`);
  }
  if (differs(before.extraDetails, after.extraDetails)) {
    lines.push("Inclusions / notes have been updated");
  }
  if (includeAmounts) {
    if (differs(before.quotedAmount, after.quotedAmount)) {
      lines.push(`Booking Price: Rs.${before.quotedAmount}/- → Rs.${after.quotedAmount}/-`);
    }
    if (differs(before.tokenAmount, after.tokenAmount)) {
      lines.push(`Token Amount: Rs.${before.tokenAmount ?? 0}/- → Rs.${after.tokenAmount ?? 0}/-`);
    }
  }
  return lines;
};

// ───────────────────────── message builders (pure) ───────────────────────────
const detailsBlock = (b) => {
  const guest = b.customerId?.name || "Customer";
  const yacht = b.yachtId?.name || "your yacht";
  return (
    `Guest Name: ${guest}\n` +
    `Contact No.: ${b.customerId?.contact}\n` +
    `Group Size: ${b.numPeople} Pax\n` +
    `Yacht Name: ${yacht}\n\n` +
    `Trip Date: ${fmtDate(b.date)} | Time: ${fmtRange(b.startTime, b.endTime)}\n` +
    `(${b.sailingHours ?? 1} Hour Sailing + ${b.anchoringHours ?? 1} Hour Anchor)`
  );
};

const ticketOf = (b) => String(b._id).slice(-5).toUpperCase();

const sanitizeText = (text = "") =>
  text
    .replace(/\u2022|\u2023|\u25E6/g, "-")
    .replace(/\u200B|\u200C|\u200D|\uFEFF/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();

const INCLUSION_KEYS = ["Soft Drink", "Ice Cube", "Water Bottles", "Bluetooth Speaker", "Captain", "Snacks"];
const PAID_SERVICE_KEYS = ["Drone - Photography & Videography", "DSLR Photography"];

/**
 * Booking confirmation. Same content as the "Share on WhatsApp" message staff
 * send by hand today (boarding pass link, summary, payment, inclusions, terms),
 * built on the server from the saved booking.
 */
export const buildConfirmedMessage = (b) => {
  const name = b.customerId?.name || "Customer";
  const company = b.company?.name || "GoaYachtWorld";
  const yacht = b.yachtId?.name || "your yacht";
  const ticket = ticketOf(b);
  const tokenPaid = (b.quotedAmount ?? 0) - (b.pendingAmount ?? 0);

  const extra = sanitizeText(b.extraDetails || "");
  const lines = extra.split("\n").map((l) => l.trim()).filter(Boolean);
  const inclusions = lines.filter((i) => INCLUSION_KEYS.some((k) => i.includes(k)));
  const paidServices = lines.filter((i) => PAID_SERVICE_KEYS.some((k) => i.includes(k)));
  const notes = extra.includes("Notes:") ? extra.split("Notes:").slice(1).join("Notes:").trim() : "";
  const bullets = (arr) => arr.map((i) => `* ${i.replace(/^-/, "").trim()}`).join("\n");

  const terms = b.company?.disclaimer
    ? `${b.company.disclaimer}[${ticket}]\n\nThank You`
    : `Terms & Conditions: \n- Please reach 10mins before boarding time at the boarding point.\n- Token amount is not refundable in case of no show or cancellation from guest side. \n- Full refundable if cancelled from yacht owners side due to change in weather conditions or technical issues.\n- You will have to do full payment before boarding to authorised person and can read more about terms & conditions https://goayachtworld.com/condtions .\nFind your ticket details at https://goaboat.com/ with ticket id :[${ticket}]\n\nThank You`;

  return (
    `Hi ${name}!\n\n` +
    `Thank you for booking with ${company}\n\n` +
    `Your boarding pass for ${yacht} on ${fmtDate(b.date)} is ready.\n` +
    `${TICKET_BASE_URL}/?ticket=${ticket}\n\n\n` +
    `Booking summary\n` +
    `Ticket Number: ${ticket}\n\n` +
    `Booking Status: ${String(b.status).toUpperCase()}\n\n` +
    `${detailsBlock(b)}\n\n` +
    `Booking Price: Rs.${b.quotedAmount}/-\n\n` +
    `Token Paid: Rs.${tokenPaid}/-\n` +
    `Balance Pending: Rs.${b.pendingAmount}/- (to be collected before boarding)` +
    (b.yachtId?.boardingLocation ? `\n\nBoarding Location\n${b.yachtId.boardingLocation}` : "") +
    (inclusions.length ? `\n\nExtra Inclusions:\n${bullets(inclusions)}` : "") +
    (paidServices.length ? `\n\nExtra Add On's Services:\n${bullets(paidServices)}` : "") +
    (notes ? `\n\nNotes:\n* ${notes.replace(/\n/g, "\n* ")}` : "") +
    `\n\n${terms}`
  );
};

export const buildCancelledMessage = (b) => {
  const name = b.customerId?.name || "Customer";
  const company = b.company?.name || "GoaYachtWorld";
  return (
    `Hi ${name},\n\n` +
    `Your booking with ${company} has been cancelled.\n\n` +
    `Booking Status: CANCELLED\n\n` +
    `${detailsBlock(b)}\n\n` +
    `If you have any questions or would like to book another date, please message us here.\n\n` +
    `Thank you,\n${company}`
  );
};

export const buildUpdatedMessage = (b, changeLines) => {
  const name = b.customerId?.name || "Customer";
  const company = b.company?.name || "GoaYachtWorld";
  return (
    `Hi ${name},\n\n` +
    `Your booking with ${company} has been updated.\n\n` +
    `What changed:\n${changeLines.map((l) => `- ${l}`).join("\n")}\n\n` +
    `Booking Status: ${String(b.status).toUpperCase()}\n\n` +
    `${detailsBlock(b)}\n\n` +
    `View your ticket: ${TICKET_BASE_URL}/?ticket=${ticketOf(b)}\n\n` +
    `Thank you,\n${company}`
  );
};

// ───────────────────────── sending (queue + log) ─────────────────────────────
const enabled = () => String(process.env.WA_BOOKING_NOTIFY ?? "true").toLowerCase() !== "false";
const amountsEnabled = () => String(process.env.WA_NOTIFY_AMOUNTS ?? "false").toLowerCase() === "true";
const confirmDelayMs = () => {
  const s = Number(process.env.WA_CONFIRM_DELAY_SECONDS ?? 30);
  return (Number.isFinite(s) && s >= 0 ? s : 30) * 1000;
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let chain = Promise.resolve();
const enqueue = (job) => {
  chain = chain
    .then(job)
    .catch((e) => console.error("[WA booking notify] job error:", e?.message))
    .then(() => sleep(2000 + Math.random() * 2000));
};

// If WhatsApp is still starting up (or briefly disconnected) the send is retried
// instead of being dropped: up to 5 more tries, one minute apart.
const RETRY = Symbol("retry");
const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 60 * 1000;

const run = (job, attempt = 0) => {
  enqueue(async () => {
    const outcome = await job(attempt >= MAX_RETRIES);
    if (outcome === RETRY) {
      console.warn(
        `[WA booking notify] WhatsApp not ready — retry ${attempt + 1}/${MAX_RETRIES} in ${RETRY_DELAY_MS / 1000}s`
      );
      const t = setTimeout(() => run(job, attempt + 1), RETRY_DELAY_MS);
      t.unref?.();
    }
  });
};

const loadBooking = (bookingId) =>
  BookingModel.findById(bookingId)
    .populate("customerId", "name contact")
    .populate("yachtId", "name boardingLocation")
    .populate("company", "name disclaimer");

const log = (booking, event, status, { to = null, reason = null, text = null } = {}) =>
  WaMessageLogModel.create({ bookingId: booking._id, event, status, to, reason, text }).catch((e) =>
    console.error("[WA booking notify] could not write log:", e?.message)
  );

const deliver = async (booking, event, text, final = true) => {
  const to = normalizeWaNumber(booking.customerId?.contact);
  if (!to) {
    await log(booking, event, "skipped", { reason: "No valid customer phone number", text });
    return;
  }
  const result = await sendWhatsAppText(to, text);
  if (!result.success && result.reason === "WhatsApp client not ready" && !final) {
    return RETRY; // try again shortly; nothing is logged until the last attempt
  }
  if (result.success) {
    await log(booking, event, "sent", { to, text, reason: result.dev ? "dev: printed to console" : null });
  } else {
    console.error(`[WA booking notify] ${event} failed for booking ${booking._id}: ${result.reason}`);
    await log(booking, event, "failed", { to, text, reason: result.reason });
  }
};

const alreadySent = (bookingId, event) =>
  WaMessageLogModel.exists({ bookingId, event, status: "sent" });

/**
 * Booking is (now) confirmed: send the booking confirmation once.
 * Waits WA_CONFIRM_DELAY_SECONDS, then rebuilds from the saved booking, so the
 * advance payment recorded right after creation is included, and nothing is
 * sent if the booking was cancelled / reverted in the meantime.
 */
export const notifyBookingConfirmed = (bookingId) => {
  if (!enabled()) return;
  const timer = setTimeout(() => {
    run(async (final) => {
      const booking = await loadBooking(bookingId);
      if (!booking) return;
      if (booking.status !== "confirmed") return; // cancelled / not confirmed any more
      if (await alreadySent(booking._id, "confirmed")) return;
      return deliver(booking, "confirmed", buildConfirmedMessage(booking), final);
    });
  }, confirmDelayMs());
  timer.unref?.();
};

/**
 * Booking just became cancelled. Sends once, and only if the booking had been
 * confirmed (pass wasConfirmed) — a quotation the customer never got a booking
 * message for is cancelled silently.
 */
export const notifyBookingCancelled = (bookingId, { wasConfirmed = false } = {}) => {
  if (!enabled() || !wasConfirmed) return;
  run(async (final) => {
    const booking = await loadBooking(bookingId);
    if (!booking) return;
    if (await alreadySent(booking._id, "cancelled")) return;
    return deliver(booking, "cancelled", buildCancelledMessage(booking), final);
  });
};

/**
 * Booking details changed. `before` / `after` are snapshot() objects.
 * Nothing is sent if no tracked field changed, or the booking isn't confirmed.
 */
export const notifyBookingUpdated = (bookingId, before, after) => {
  if (!enabled()) return;
  const changes = buildChanges(before, after, { includeAmounts: amountsEnabled() });
  if (!changes.length) return;
  run(async (final) => {
    const booking = await loadBooking(bookingId);
    if (!booking) return;
    if (booking.status !== "confirmed") return; // pending/cancelled: customer wasn't told, so don't update
    return deliver(booking, "updated", buildUpdatedMessage(booking, changes), final);
  });
};