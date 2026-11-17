// services/bookingWhatsApp.service.js
//
// Automatic WhatsApp messages to the customer when a booking
//   - is CREATED / changes STATUS (pending, confirmed, cancelled)
//       pending   -> "booking received, pending confirmation" (NO boarding location)
//       confirmed -> full booking confirmation (boarding location included, if set)
//       cancelled -> short cancellation notice
//       any other change back to pending/confirmed -> short "status updated" notice
//   - has DETAILS changed: yacht, date, time, group size, inclusions/notes
//   - has its AMOUNT edited: booking price / token amount
//
// The status message is decided from the booking's CURRENT status and from what
// the customer was already told (WaMessageLog), so double calls, quick status
// flips and re-activations never produce duplicate or contradictory messages.
//
// Called from the server controllers, so it fires no matter which screen made
// the change. It never throws and never delays the API response: every call is
// fire-and-forget and runs through a slow queue (one message every 2-4 s) so
// bursts of edits don't look like spam to WhatsApp.
//
// ENV (all optional)
//   WA_BOOKING_NOTIFY=false       turn all automatic booking messages off
//   WA_NOTIFY_PENDING=false       do NOT message customers about pending bookings
//   WA_NOTIFY_AMOUNTS=false       do NOT message when price / token amount is edited
//   WA_CONFIRM_DELAY_SECONDS=30   wait before a creation / confirmation message, so
//                                 the advance payment (recorded a moment after the
//                                 booking is created) is included. Default 30.
//   WA_ENABLED=true               send for real in any environment (see otp.service.js).
//                                 Without it, messages only print to the console unless
//                                 NODE_ENV=production.

import { BookingModel } from "../models/booking.model.js";
import { WaMessageLogModel } from "../models/waMessageLog.model.js";
import { sendForBooking } from "./whatsappAccounts.service.js";

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

const parseExtras = (extraDetails) => {
  const extra = sanitizeText(extraDetails || "");
  const lines = extra.split("\n").map((l) => l.trim()).filter(Boolean);
  const bullets = (arr) => arr.map((i) => `* ${i.replace(/^-/, "").trim()}`).join("\n");
  const inclusions = lines.filter((i) => INCLUSION_KEYS.some((k) => i.includes(k)));
  const paidServices = lines.filter((i) => PAID_SERVICE_KEYS.some((k) => i.includes(k)));
  const notes = extra.includes("Notes:") ? extra.split("Notes:").slice(1).join("Notes:").trim() : "";
  return (
    (inclusions.length ? `\n\nExtra Inclusions:\n${bullets(inclusions)}` : "") +
    (paidServices.length ? `\n\nExtra Add On's Services:\n${bullets(paidServices)}` : "") +
    (notes ? `\n\nNotes:\n* ${notes.replace(/\n/g, "\n* ")}` : "")
  );
};

const tokenPaidOf = (b) => (b.quotedAmount ?? 0) - (b.pendingAmount ?? 0);

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
  const tokenPaid = tokenPaidOf(b);

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
    parseExtras(b.extraDetails) +
    `\n\n${terms}`
  );
};

/**
 * Booking is PENDING (not confirmed yet). Same summary as the confirmation, but
 * WITHOUT the boarding location and without "boarding pass" wording: the
 * location is only shared once the booking is confirmed.
 */
export const buildPendingMessage = (b) => {
  const name = b.customerId?.name || "Customer";
  const company = b.company?.name || "GoaYachtWorld";
  const ticket = ticketOf(b);
  return (
    `Hi ${name}!\n\n` +
    `Thank you for choosing ${company}.\n\n` +
    `We have received your booking. It is currently PENDING confirmation, and we will update you once it is confirmed.\n\n` +
    `Booking summary\n` +
    `Ticket Number: ${ticket}\n\n` +
    `Booking Status: PENDING\n\n` +
    `${detailsBlock(b)}\n\n` +
    `Booking Price: Rs.${b.quotedAmount}/-\n\n` +
    `Token Paid: Rs.${tokenPaidOf(b)}/-\n` +
    `Balance Pending: Rs.${b.pendingAmount}/-` +
    parseExtras(b.extraDetails) +
    `\n\nFind your ticket details at ${TICKET_BASE_URL}/ with ticket id :[${ticket}]\n\nThank You`
  );
};

/** Short notice for a status change that is not a first message (e.g. back to pending). */
export const buildStatusMessage = (b) => {
  const name = b.customerId?.name || "Customer";
  const company = b.company?.name || "GoaYachtWorld";
  const status = String(b.status).toUpperCase();
  return (
    `Hi ${name},\n\n` +
    `The status of your booking with ${company} has been updated to ${status}.\n\n` +
    `Booking Status: ${status}\n\n` +
    `${detailsBlock(b)}\n\n` +
    `View your ticket: ${TICKET_BASE_URL}/?ticket=${ticketOf(b)}\n\n` +
    `Thank you,\n${company}`
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

export const buildUpdatedMessage = (b, changeLines, { showAmounts = false } = {}) => {
  const name = b.customerId?.name || "Customer";
  const company = b.company?.name || "GoaYachtWorld";
  return (
    `Hi ${name},\n\n` +
    `Your booking with ${company} has been updated.\n\n` +
    `What changed:\n${changeLines.map((l) => `- ${l}`).join("\n")}\n\n` +
    `Booking Status: ${String(b.status).toUpperCase()}\n\n` +
    `${detailsBlock(b)}\n\n` +
    (showAmounts
      ? `Booking Price: Rs.${b.quotedAmount}/-\nToken Paid: Rs.${tokenPaidOf(b)}/-\nBalance Pending: Rs.${b.pendingAmount}/-\n\n`
      : "") +
    `View your ticket: ${TICKET_BASE_URL}/?ticket=${ticketOf(b)}\n\n` +
    `Thank you,\n${company}`
  );
};

// ───────────────────────── sending (queue + log) ─────────────────────────────
const enabled = () => String(process.env.WA_BOOKING_NOTIFY ?? "true").toLowerCase() !== "false";
const amountsEnabled = () => String(process.env.WA_NOTIFY_AMOUNTS ?? "true").toLowerCase() !== "false";
const pendingEnabled = () => String(process.env.WA_NOTIFY_PENDING ?? "true").toLowerCase() !== "false";
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
    .populate("employeeId", "type name")
    .populate("yachtId", "name boardingLocation")
    .populate("company", "name disclaimer");

const log = (booking, event, status, { to = null, reason = null, text = null, statusTo = null, accountKey = null } = {}) =>
  WaMessageLogModel.create({ bookingId: booking._id, event, status, to, reason, text, statusTo, accountKey }).catch((e) =>
    console.error("[WA booking notify] could not write log:", e?.message)
  );

const deliver = async (booking, event, text, final = true, statusTo = null) => {
  const to = normalizeWaNumber(booking.customerId?.contact);
  if (!to) {
    await log(booking, event, "skipped", { reason: "No valid customer phone number", text, statusTo });
    return;
  }
  // The booking's owner decides which WhatsApp account sends (agent's own, or the company's)
  const result = await sendForBooking(booking, to, text);
  const accountKey = result.accountKey || null;
  if (result.noAccount) {
    // No WhatsApp linked for the owner: no message, no fallback to another number
    await log(booking, event, "skipped", { to, text, statusTo, accountKey, reason: result.reason });
    return;
  }
  if (!result.success && result.reason === "WhatsApp client not ready" && !final) {
    return RETRY; // try again shortly; nothing is logged until the last attempt
  }
  if (result.success) {
    await log(booking, event, "sent", { to, text, statusTo, accountKey, reason: result.dev ? "dev: printed to console" : null });
  } else {
    console.error(`[WA booking notify] ${event} failed for booking ${booking._id} (${accountKey}): ${result.reason}`);
    await log(booking, event, "failed", { to, text, statusTo, accountKey, reason: result.reason });
  }
};

const alreadySent = (bookingId, event) =>
  WaMessageLogModel.exists({ bookingId, event, status: "sent" });

const createdAtOf = (b) => b.createdAt || b._id?.getTimestamp?.() || null;

/**
 * Tell the customer about the booking's CURRENT status.
 *   initial        true when called because the booking was just created
 *   waitForPayment true when the status just became confirmed: wait a little so
 *                  the advance payment (recorded a moment later) is included
 *
 * What is sent depends on the status and on what the customer already knows:
 *   cancelled                          -> cancellation notice
 *   confirmed, never confirmed before  -> full confirmation (with location)
 *   pending,   never told anything     -> "pending" message (no location)
 *   anything else                      -> short "status updated" notice
 * Nothing is sent if the customer was already told this exact status.
 */
export const notifyBookingStatus = (bookingId, { initial = false, waitForPayment = false } = {}) => {
  if (!enabled()) return;

  const start = () =>
    run(async (final) => {
      const booking = await loadBooking(bookingId);
      if (!booking) return;
      const status = booking.status;

      if (status === "cancelled" && initial) return; // cancelled before the customer was ever told
      if (status === "pending" && !pendingEnabled()) return;
      if (!["pending", "confirmed", "cancelled"].includes(status)) return;

      const last = await WaMessageLogModel.findOne({
        bookingId: booking._id,
        status: "sent",
        statusTo: { $ne: null },
      }).sort({ createdAt: -1 });
      if (last?.statusTo === status) return; // customer already knows this status

      // Created and cancelled within moments: the customer was never told about this
      // booking, so a "cancelled" notice would only confuse. (Older bookings with no
      // message history still get it.)
      if (status === "cancelled" && !last) {
        const created = createdAtOf(booking);
        if (created && Date.now() - new Date(created).getTime() < confirmDelayMs() + 60 * 1000) return;
      }

      if (status === "cancelled") {
        return deliver(booking, "cancelled", buildCancelledMessage(booking), final, status);
      }
      if (status === "confirmed") {
        const confirmedBefore = await alreadySent(booking._id, "confirmed");
        return confirmedBefore
          ? deliver(booking, "status", buildStatusMessage(booking), final, status)
          : deliver(booking, "confirmed", buildConfirmedMessage(booking), final, status);
      }
      // pending
      return last
        ? deliver(booking, "status", buildStatusMessage(booking), final, status)
        : deliver(booking, "pending", buildPendingMessage(booking), final, status);
    });

  if (initial || waitForPayment) {
    const timer = setTimeout(start, confirmDelayMs());
    timer.unref?.();
  } else {
    start();
  }
};

/**
 * Booking details or amount changed. `before` / `after` are snapshot() objects.
 * Nothing is sent if no tracked field changed. Pending and confirmed bookings
 * are covered; cancelled ones are not.
 */
export const notifyBookingUpdated = (bookingId, before, after) => {
  if (!enabled()) return;
  const changes = buildChanges(before, after, { includeAmounts: amountsEnabled() });
  if (!changes.length) return;
  const amountChanged = changes.some((l) => /^(Booking Price|Token Amount)/.test(l));

  run(async (final) => {
    const booking = await loadBooking(bookingId);
    if (!booking) return;
    if (booking.status === "cancelled") return;
    if (booking.status === "pending" && !pendingEnabled()) return;

    // Brand-new booking whose first message is still waiting to go out: that
    // message will already show the latest details, so don't send an "update" first.
    const told = await WaMessageLogModel.exists({ bookingId: booking._id, status: "sent", statusTo: { $ne: null } });
    const created = createdAtOf(booking);
    if (!told && created && Date.now() - new Date(created).getTime() < confirmDelayMs() + 60 * 1000) return;

    return deliver(
      booking,
      "updated",
      buildUpdatedMessage(booking, changes, { showAmounts: amountChanged }),
      final
    );
  });
};
