// controllers/customer.auth.controller.js
import { OtpModel }      from '../models/otp.model.js';
import { CustomerModel } from '../models/customer.model.js';
import { generateOtp, sendOtpWhatsApp, cleanPhone } from '../services/otp.service.js';
import { signCustomerToken } from '../middleware/customer.auth.middleware.js';

const OTP_EXPIRY_MINUTES  = 10;
const MAX_ATTEMPTS        = 5;
const RESEND_COOLDOWN_SEC = 30;

// POST /customer/auth/send-otp
export const sendOtp = async (req, res, next) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ success: false, message: 'Phone number is required' });

    const cleaned = cleanPhone(phone);
    if (cleaned.length !== 10)
      return res.status(400).json({ success: false, message: 'Enter a valid 10-digit Indian mobile number' });

    // Resend cooldown
    const recent = await OtpModel.findOne({ phone: cleaned, verified: false }).sort({ createdAt: -1 });
    if (recent) {
      const elapsed = (Date.now() - new Date(recent.createdAt).getTime()) / 1000;
      if (elapsed < RESEND_COOLDOWN_SEC) {
        const wait = Math.ceil(RESEND_COOLDOWN_SEC - elapsed);
        return res.status(429).json({ success: false, message: `Please wait ${wait}s before requesting another OTP` });
      }
    }

    await OtpModel.deleteMany({ phone: cleaned, verified: false });

    const otp       = generateOtp();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
    await OtpModel.create({ phone: cleaned, otp, expiresAt });

    // Send via WhatsApp — free, automatic, direct
    const result = await sendOtpWhatsApp(cleaned, otp);
    if (!result.success)
      return res.status(503).json({ success: false, message: result.message });

    res.json({
      success: true,
      message: `OTP sent to WhatsApp +91${cleaned}`,
      expiresInMinutes: OTP_EXPIRY_MINUTES,
    });
  } catch (err) { next(err); }
};

// POST /customer/auth/verify-otp
export const verifyOtp = async (req, res, next) => {
  try {
    const { phone, otp } = req.body;
    if (!phone || !otp) return res.status(400).json({ success: false, message: 'Phone and OTP are required' });

    const cleaned   = cleanPhone(phone);
    const otpRecord = await OtpModel.findOne({ phone: cleaned, verified: false }).sort({ createdAt: -1 });

    if (!otpRecord)
      return res.status(400).json({ success: false, message: 'No active OTP found. Request a new one.' });
    if (new Date() > otpRecord.expiresAt) {
      await OtpModel.deleteOne({ _id: otpRecord._id });
      return res.status(400).json({ success: false, message: 'OTP expired. Request a new one.' });
    }
    if (otpRecord.attempts >= MAX_ATTEMPTS) {
      await OtpModel.deleteOne({ _id: otpRecord._id });
      return res.status(429).json({ success: false, message: 'Too many attempts. Request a new OTP.' });
    }
    if (otpRecord.otp !== String(otp).trim()) {
      await OtpModel.updateOne({ _id: otpRecord._id }, { $inc: { attempts: 1 } });
      const r = MAX_ATTEMPTS - otpRecord.attempts - 1;
      return res.status(400).json({ success: false, message: `Incorrect OTP. ${r} attempt${r !== 1 ? 's' : ''} remaining.` });
    }

    await OtpModel.updateOne({ _id: otpRecord._id }, { verified: true });

    let customer = await CustomerModel.findOne({ contact: cleaned });
    const isNew  = !customer;
    if (!customer) customer = await CustomerModel.create({ contact: cleaned, name: 'Guest' });

    const token = signCustomerToken(customer._id, cleaned);
    res.json({
      success: true,
      isNewCustomer: isNew,
      message: isNew ? 'Welcome! Account created.' : 'Welcome back!',
      token,
      customer: { _id: customer._id, name: customer.name, contact: cleaned, email: customer.email || null },
    });
  } catch (err) { next(err); }
};

// GET /customer/auth/me  [protected]
export const getMe = async (req, res, next) => {
  try {
    const customer = await CustomerModel.findById(req.customer.customerId)
      .select('-govtIdImage -govtIdNo -company -__v');
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' });
    res.json({ success: true, customer });
  } catch (err) { next(err); }
};

// PUT /customer/auth/profile  [protected]
export const updateProfile = async (req, res, next) => {
  try {
    const { name, email } = req.body;
    const updates = {};
    if (name?.trim())  updates.name  = name.trim();
    if (email?.trim()) updates.email = email.trim().toLowerCase();
    if (!Object.keys(updates).length)
      return res.status(400).json({ success: false, message: 'Nothing to update' });
    const customer = await CustomerModel.findByIdAndUpdate(
      req.customer.customerId,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('-govtIdImage -govtIdNo -company -__v');
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' });
    res.json({ success: true, message: 'Profile updated', customer });
  } catch (err) { next(err); }
};