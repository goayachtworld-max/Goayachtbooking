// controllers/whatsapp.controller.js
// WhatsApp settings for the app:
//   admin  -> links / unlinks the COMPANY number (admin + staff + public bookings send from it)
//   agent  -> links / unlinks their OWN number (their bookings send from it)
//   staff  -> nothing to set up: staff use the company number
//
//   GET  /api/whatsapp/overview
//   GET  /api/whatsapp/status      ?scope=company|me [&companyId=]   (polled while linking)
//   POST /api/whatsapp/connect     { scope, companyId?, phoneNumber? }
//   POST /api/whatsapp/reconnect   { scope, companyId? }
//   POST /api/whatsapp/disconnect  { scope, companyId? }
//   POST /api/whatsapp/test        { scope, companyId?, to }

import { WhatsAppAccountModel } from "../models/whatsappAccount.model.js";
import { CompanyModel } from "../models/company.model.js";
import { EmployeeModel } from "../models/employee.model.js";
import * as wa from "../services/waSessions.service.js";
import { companyKey, agentKey } from "../services/whatsappAccounts.service.js";
import { normalizeWaNumber } from "../services/bookingWhatsApp.service.js";

const httpError = (status, message) => Object.assign(new Error(message), { status });

/** Who is this request allowed to manage? Throws 400/403 otherwise. */
export const resolveTarget = async (req, src = {}) => {
  const user = req.user;
  const scope = src.scope;

  if (scope === "company") {
    if (user.type !== "admin") throw httpError(403, "Only the admin can manage the company WhatsApp.");
    const mine = (user.company || []).map(String);
    const companyId = String(src.companyId || mine[0] || "");
    if (!companyId || !mine.includes(companyId)) throw httpError(403, "That company is not yours.");
    const company = await CompanyModel.findById(companyId).select("name").lean();
    return {
      key: companyKey(companyId),
      ownerType: "company",
      companyId,
      employeeId: null,
      label: company?.name || "Company",
    };
  }

  if (scope === "me") {
    if (user.type !== "backdesk") {
      throw httpError(403, "Only agents have their own WhatsApp. Staff use the company WhatsApp.");
    }
    const me = await EmployeeModel.findById(user.id).select("name").lean();
    return {
      key: agentKey(user.id),
      ownerType: "employee",
      companyId: null,
      employeeId: user.id,
      label: me?.name ? `Agent ${me.name}` : "Agent",
    };
  }

  throw httpError(400, "scope must be 'company' or 'me'.");
};

/** What the screen needs to show for one account (includes the QR code while linking). */
const statusFor = async (target) => {
  const [account, snap] = await Promise.all([
    WhatsAppAccountModel.findOne({ key: target.key }).lean(),
    Promise.resolve(wa.getSnapshot(target.key)),
  ]);
  const linked = !!account?.linked;
  const state = snap?.state ?? (linked ? "offline" : "not_linked");
  return {
    key: target.key,
    label: target.label,
    live: wa.isWhatsAppLive(),
    linked,
    state, // not_linked | offline | starting | qr | pairing | authenticated | ready | disconnected | failed | stopped
    phone: snap?.phone || account?.phone || null,
    error: snap?.error || account?.lastError || null,
    qr: state === "qr" ? await wa.getQrDataUrl(target.key) : null,
    pairingCode: state === "pairing" ? snap?.pairingCode : null,
  };
};

const handle = (fn) => async (req, res, next) => {
  try {
    await fn(req, res);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, message: err.message });
    next(err);
  }
};

export const getOverview = handle(async (req, res) => {
  const user = req.user;
  const out = { success: true, live: wa.isWhatsAppLive(), role: user.type };

  if (user.type === "admin") {
    out.companies = [];
    for (const companyId of (user.company || []).map(String)) {
      const target = await resolveTarget(req, { scope: "company", companyId });
      out.companies.push({ companyId, ...(await statusFor(target)) });
    }
    // read-only: how the company's agents are doing
    const agents = await EmployeeModel.find({ type: "backdesk", company: { $in: user.company || [] } })
      .select("name status")
      .lean();
    const accounts = await WhatsAppAccountModel.find({ key: { $in: agents.map((a) => agentKey(a._id)) } })
      .select("key linked phone status")
      .lean();
    const byKey = Object.fromEntries(accounts.map((a) => [a.key, a]));
    out.agents = agents.map((a) => {
      const acct = byKey[agentKey(a._id)];
      const snap = wa.getSnapshot(agentKey(a._id));
      return {
        employeeId: String(a._id),
        name: a.name,
        linked: !!acct?.linked,
        state: snap?.state ?? (acct?.linked ? "offline" : "not_linked"),
        phone: snap?.phone || acct?.phone || null,
      };
    });
  } else if (user.type === "backdesk") {
    out.me = await statusFor(await resolveTarget(req, { scope: "me" }));
  } else {
    out.note = "Staff don't need to set up WhatsApp. Booking messages go out from the company number set by the admin.";
  }
  return res.json(out);
});

export const getStatus = handle(async (req, res) => {
  const target = await resolveTarget(req, req.query);
  return res.json({ success: true, ...(await statusFor(target)) });
});

export const connect = handle(async (req, res) => {
  const target = await resolveTarget(req, req.body);

  await WhatsAppAccountModel.findOneAndUpdate(
    { key: target.key },
    {
      $setOnInsert: {
        key: target.key,
        ownerType: target.ownerType,
        companyId: target.companyId,
        employeeId: target.employeeId,
      },
      $set: { label: target.label, enabled: true },
    },
    { upsert: true }
  );

  const pairingPhone = req.body.phoneNumber ? String(req.body.phoneNumber) : null;
  const result = await wa.startSession(target.key, { pairingPhone });
  if (!result.ok) return res.status(400).json({ success: false, message: result.reason });
  return res.json({ success: true, ...(await statusFor(target)) });
});

export const reconnect = handle(async (req, res) => {
  const target = await resolveTarget(req, req.body);
  await wa.stopSession(target.key);
  const result = await wa.startSession(target.key);
  if (!result.ok) return res.status(400).json({ success: false, message: result.reason });
  return res.json({ success: true, ...(await statusFor(target)) });
});

export const disconnect = handle(async (req, res) => {
  const target = await resolveTarget(req, req.body);
  await wa.logoutSession(target.key);
  return res.json({ success: true, ...(await statusFor(target)) });
});

export const sendTest = handle(async (req, res) => {
  const target = await resolveTarget(req, req.body);
  const to = normalizeWaNumber(req.body.to);
  if (!to) throw httpError(400, "Enter a valid mobile number, with country code if it is not Indian.");

  const status = await statusFor(target);
  if (wa.isWhatsAppLive() && status.state !== "ready") {
    throw httpError(400, "This WhatsApp is not connected yet. Link it first, then send a test.");
  }
  const result = await wa.sendText(
    target.key,
    to,
    `✅ Test message from ${target.label}.\nYour WhatsApp is linked and ready to send booking messages.`
  );
  if (!result.success) throw httpError(400, `Could not send: ${result.reason}`);
  return res.json({ success: true, message: "Test message sent." });
});
