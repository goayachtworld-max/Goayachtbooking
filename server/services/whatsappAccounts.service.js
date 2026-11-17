// services/whatsappAccounts.service.js
//
// Which WhatsApp account sends a booking message?  The OWNER of the booking decides:
//
//   booking owned by an AGENT (backdesk)        -> that agent's own WhatsApp   ("e-<agentId>")
//   booking owned by admin / staff / the public -> the company's WhatsApp       ("c-<companyId>")
//
// There is deliberately NO fallback from an agent to the company number: agents
// may keep their customers private, and the customer must not suddenly hear from
// a different business. If the owner has no WhatsApp linked, no message is sent.

import { WhatsAppAccountModel } from "../models/whatsappAccount.model.js";
import * as wa from "./waSessions.service.js";

export const companyKey = (companyId) => `c-${companyId}`;
export const agentKey = (employeeId) => `e-${employeeId}`;

/** Pure: which account owns this (populated) booking? */
export const resolveOwnerKey = (booking) => {
  const emp = booking.employeeId;
  if (emp && emp.type === "backdesk") {
    const id = emp._id ?? emp;
    return { key: agentKey(id), ownerLabel: `agent ${emp.name || ""}`.trim() };
  }
  const company = booking.company;
  const companyId = company?._id ?? company;
  return { key: companyKey(companyId), ownerLabel: `company ${company?.name || ""}`.trim() };
};

// Keep the database row in step with what the session is doing
wa.setSessionHooks({
  onUpdate: async ({ key, state, phone, error, linked }) => {
    if (key === "system") return; // the system account is not stored
    const set = { status: state, lastError: error || null };
    if (linked === true) {
      set.linked = true;
      set.lastConnectedAt = new Date();
      if (phone) set.phone = phone;
    } else if (linked === false) {
      set.linked = false;
      set.phone = null;
    } else if (phone) {
      set.phone = phone;
    }
    await WhatsAppAccountModel.updateOne({ key }, { $set: set });
  },
});

/** After a server restart, bring every linked account back online, one at a time. */
export const bootLinkedAccounts = async () => {
  if (!wa.isWhatsAppLive()) return;
  const accounts = await WhatsAppAccountModel.find({ linked: true, enabled: true }).select("key").lean();
  accounts.forEach((acct, i) => {
    const timer = setTimeout(
      () => wa.startSession(acct.key).catch((e) => console.error(`[WA ${acct.key}] boot failed:`, e?.message)),
      i * 15_000 // staggered: several Chromes starting together choke a small server
    );
    timer.unref?.();
  });
  if (accounts.length) console.log(`WhatsApp: bringing ${accounts.length} linked account(s) back online`);
};

/**
 * Send a booking message from the booking owner's account.
 * Result: { success, reason?, noAccount?, accountKey }
 *   noAccount  true -> nothing is linked (or it must be linked again): final, do not retry
 *   reason "WhatsApp client not ready" -> the account is starting up: retry shortly
 */
export const sendForBooking = async (booking, waNumber, text) => {
  const { key, ownerLabel } = resolveOwnerKey(booking);

  if (!wa.isWhatsAppLive()) {
    const r = await wa.sendText(key, waNumber, text); // dev: prints to the console
    return { ...r, accountKey: key };
  }

  const account = await WhatsAppAccountModel.findOne({ key }).select("linked enabled").lean();
  if (!account || !account.linked || account.enabled === false) {
    return { success: false, noAccount: true, accountKey: key, reason: `No WhatsApp linked for ${ownerLabel}` };
  }

  const snap = wa.getSnapshot(key);
  if (!snap) {
    // linked, but its turn at start-up has not come yet: start it now, retry shortly
    wa.startSession(key).catch((e) => console.error(`[WA ${key}] start failed:`, e?.message));
    return { success: false, accountKey: key, reason: "WhatsApp client not ready" };
  }
  if (snap.state === "failed" || snap.state === "stopped") {
    return {
      success: false,
      noAccount: true,
      accountKey: key,
      reason: `WhatsApp for ${ownerLabel} is disconnected and must be linked again`,
    };
  }

  const result = await wa.sendText(key, waNumber, text);
  return { ...result, accountKey: key };
};
