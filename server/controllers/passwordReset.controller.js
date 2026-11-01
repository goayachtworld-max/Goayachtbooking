// controllers/passwordReset.controller.js
//
// "Forgot password" for STAFF (employees: admin / backdesk / onsite) only.
// Customers log in with a WhatsApp OTP and have no password, so they are not
// handled here: only the Employee collection is ever searched.
//
//   POST /api/employees/forgot-password        { identifier }
//   POST /api/employees/reset-password/check   { token }
//   POST /api/employees/reset-password         { token, newPassword }
//
// Security rules:
//   - The answer to "forgot password" is ALWAYS the same, so nobody can use it
//     to find out which usernames / mobile numbers exist.
//   - The link token is 256 random bits, valid 30 minutes, usable once. Only its
//     SHA-256 hash is stored.
//   - Max 3 reset e-mails per account per hour.
//   - After a reset every other logged-in device is signed out
//     (see passwordChangedAt in middleware/auth.js).
//   - The token / link is never written to the logs.

import crypto from "crypto";
import bcrypt from "bcrypt";
import { EmployeeModel } from "../models/employee.model.js";
import { PasswordResetModel } from "../models/passwordReset.model.js";
import { sendEmail } from "../utils/sendEmail.js";
import { clientIp } from "../utils/rateLimit.js";

const TOKEN_TTL_MINUTES = 30;
const MAX_REQUESTS_PER_ACCOUNT_PER_HOUR = 3;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 72; // bcrypt ignores everything after 72 bytes

const GENERIC_FORGOT_MESSAGE =
  "If a staff account exists for that username or mobile number, we've emailed a password reset link to the address on file.";
const INVALID_LINK_MESSAGE =
  "This reset link is invalid or has expired. Please request a new one.";

const appName = () => process.env.APP_NAME || "Goa Luxury Yachts";
const frontendUrl = () =>
  (process.env.FRONTEND_URL || "https://goaboat.com").replace(/\/+$/, "");
const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");
const isTokenShape = (t) => typeof t === "string" && /^[a-f0-9]{64}$/.test(t);

const escapeHtml = (s = "") =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Same lookup rules as the login screen: mobile number or username.
const findEmployeeByIdentifier = async (identifier) => {
  const id = identifier.trim();
  const isMobile = /^[0-9]{10,15}$/.test(id);
  if (isMobile) {
    return EmployeeModel.findOne({
      $or: [
        { contact: id },
        { contact: `+91${id}` },
        { contact: id.replace(/^\+91/, "") },
      ],
    });
  }
  return EmployeeModel.findOne({ username: id.toLowerCase() });
};

// ───────────────────────── e-mail templates ─────────────────────────────────
export const buildResetEmail = ({ name, link }) => {
  const app = appName();
  const subject = `Reset your password - ${app}`;
  const text =
    `Hi ${name},\n\n` +
    `We received a request to reset your ${app} password.\n\n` +
    `Open this link to choose a new password (valid for ${TOKEN_TTL_MINUTES} minutes, works once):\n${link}\n\n` +
    `If you did not ask for this, you can ignore this email: your password will not change.\n` +
    `Never share this link with anyone.\n\n` +
    `${app}`;
  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;color:#1e293b">
    <h2 style="margin:0 0 12px">Reset your password</h2>
    <p>Hi ${escapeHtml(name)},</p>
    <p>We received a request to reset your <b>${escapeHtml(app)}</b> password.</p>
    <p style="margin:24px 0">
      <a href="${link}" style="background:#1d6fa4;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;display:inline-block;font-weight:bold">Choose a new password</a>
    </p>
    <p style="font-size:13px;color:#475569">This link is valid for ${TOKEN_TTL_MINUTES} minutes and can be used once.<br>
    If the button doesn't work, copy this address into your browser:<br>
    <span style="word-break:break-all">${link}</span></p>
    <p style="font-size:13px;color:#475569">If you did not ask for this, ignore this email. Your password will not change. Never share this link with anyone.</p>
  </div>`;
  return { subject, text, html };
};

export const buildPasswordChangedEmail = ({ name, when }) => {
  const app = appName();
  const subject = `Your password was changed - ${app}`;
  const text =
    `Hi ${name},\n\n` +
    `Your ${app} password was changed on ${when} (IST).\n\n` +
    `If this was you, no action is needed.\n` +
    `If it was NOT you, contact your admin immediately.\n\n${app}`;
  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;color:#1e293b">
    <h2 style="margin:0 0 12px">Your password was changed</h2>
    <p>Hi ${escapeHtml(name)},</p>
    <p>Your <b>${escapeHtml(app)}</b> password was changed on ${escapeHtml(when)} (IST).</p>
    <p>If this was you, no action is needed.<br>If it was <b>not</b> you, contact your admin immediately.</p>
  </div>`;
  return { subject, text, html };
};

// ───────────────────────── 1. forgot password ───────────────────────────────
const processForgotRequest = async (identifier, req) => {
  const employee = await findEmployeeByIdentifier(identifier);
  if (!employee || employee.status !== "active" || !employee.email) return;

  // At most 3 reset e-mails per account per hour (stops e-mail bombing)
  const since = new Date(Date.now() - 60 * 60 * 1000);
  const recent = await PasswordResetModel.countDocuments({
    employeeId: employee._id,
    createdAt: { $gte: since },
  });
  if (recent >= MAX_REQUESTS_PER_ACCOUNT_PER_HOUR) {
    console.warn(`[password reset] hourly limit reached for employee ${employee._id}`);
    return;
  }

  // A new request cancels any earlier link that is still unused
  await PasswordResetModel.updateMany(
    { employeeId: employee._id, consumedAt: null },
    { consumedAt: new Date() }
  );

  const token = crypto.randomBytes(32).toString("hex");
  await PasswordResetModel.create({
    employeeId: employee._id,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000),
    requestIp: clientIp(req),
  });

  const link = `${frontendUrl()}/reset-password?token=${token}`;
  const mail = buildResetEmail({ name: employee.name, link });
  await sendEmail({ to: employee.email, ...mail });
};

export const forgotPassword = async (req, res) => {
  const identifier = typeof req.body?.identifier === "string" ? req.body.identifier.trim() : "";
  if (!identifier || identifier.length > 100) {
    return res
      .status(400)
      .json({ success: false, message: "Enter your username or mobile number." });
  }

  // Answer first, work afterwards: same reply and same speed whether or not the
  // account exists, and a slow mail server never makes the page hang.
  res.status(200).json({ success: true, message: GENERIC_FORGOT_MESSAGE });

  processForgotRequest(identifier, req).catch((err) =>
    console.error("[password reset] request failed:", err.message)
  );
};

// ───────────────────────── 2. is this link still valid? ─────────────────────
export const checkResetToken = async (req, res, next) => {
  try {
    const { token } = req.body || {};
    if (!isTokenShape(token)) {
      return res.status(200).json({ success: true, valid: false });
    }
    const row = await PasswordResetModel.findOne({
      tokenHash: hashToken(token),
      consumedAt: null,
      expiresAt: { $gt: new Date() },
    });
    return res.status(200).json({ success: true, valid: !!row });
  } catch (err) {
    next(err);
  }
};

// ───────────────────────── 3. set the new password ──────────────────────────
export const resetPassword = async (req, res, next) => {
  try {
    const { token, newPassword } = req.body || {};

    if (!isTokenShape(token)) {
      return res.status(400).json({ success: false, message: INVALID_LINK_MESSAGE });
    }
    if (typeof newPassword !== "string" || newPassword.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({
        success: false,
        message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
      });
    }
    if (newPassword.length > MAX_PASSWORD_LENGTH) {
      return res.status(400).json({
        success: false,
        message: `Password must be at most ${MAX_PASSWORD_LENGTH} characters.`,
      });
    }

    // Claim the link atomically: if two requests race, only one gets it.
    const claim = await PasswordResetModel.findOneAndUpdate(
      { tokenHash: hashToken(token), consumedAt: null, expiresAt: { $gt: new Date() } },
      { consumedAt: new Date() }
    );
    if (!claim) {
      return res.status(400).json({ success: false, message: INVALID_LINK_MESSAGE });
    }

    const employee = await EmployeeModel.findById(claim.employeeId);
    if (!employee || employee.status !== "active") {
      return res.status(400).json({ success: false, message: INVALID_LINK_MESSAGE });
    }

    try {
      const hashed = await bcrypt.hash(newPassword, 10);
      await EmployeeModel.updateOne(
        { _id: employee._id },
        { $set: { password: hashed, passwordChangedAt: new Date() } }
      );
    } catch (err) {
      // Give the link back so the user can try again
      await PasswordResetModel.updateOne({ _id: claim._id }, { consumedAt: null });
      throw err;
    }

    // Any other unused links for this account are now worthless
    await PasswordResetModel.updateMany(
      { employeeId: employee._id, consumedAt: null },
      { consumedAt: new Date() }
    );

    // "Your password was changed" notice: background, never blocks the reply
    if (employee.email) {
      const when = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
      sendEmail({
        to: employee.email,
        ...buildPasswordChangedEmail({ name: employee.name, when }),
      }).catch((err) => console.error("[password reset] confirmation mail failed:", err.message));
    }

    return res
      .status(200)
      .json({ success: true, message: "Password updated. You can now sign in." });
  } catch (err) {
    next(err);
  }
};
