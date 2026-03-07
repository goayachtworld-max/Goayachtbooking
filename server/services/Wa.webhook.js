// services/wa.webhook.js
// Optional: Auto-reply bot that reads incoming WhatsApp messages
// and replies with the OTP stored in DB — so you don't have to do it manually.
//
// SETUP (one-time):
//   1. Go to Meta Developers → your App → WhatsApp → Webhooks
//   2. Set webhook URL to: https://yourdomain.com/wa/webhook
//   3. Set Verify Token to the value of WA_VERIFY_TOKEN in your .env
//   4. Subscribe to: messages
//
// ENV vars needed:
//   WA_VERIFY_TOKEN=any_random_string_you_choose
//   WA_PHONE_NUMBER_ID=from Meta Dev Portal (your business number's ID)
//   WA_ACCESS_TOKEN=permanent system user token from Meta Business Manager
//   WA_BUSINESS_NUMBER=91

import express  from 'express';
import axios    from 'axios';
import { OtpModel } from '../models/otp.model.js';
import { cleanPhone } from './otp.service.js';

const router = express.Router();
const VERIFY_TOKEN    = process.env.WA_VERIFY_TOKEN    || 'goaboat_webhook_token';
const PHONE_NUMBER_ID = process.env.WA_PHONE_NUMBER_ID || '';
const ACCESS_TOKEN    = process.env.WA_ACCESS_TOKEN    || '';

// ── Webhook verification (Meta calls this once when you save the webhook URL) ─
router.get('/webhook', (req, res) => {
  if (
    req.query['hub.mode']       === 'subscribe' &&
    req.query['hub.verify_token'] === VERIFY_TOKEN
  ) {
    console.log('✅ WA Webhook verified');
    return res.send(req.query['hub.challenge']);
  }
  res.sendStatus(403);
});

// ── Incoming message handler ──────────────────────────────────────────────────
router.post('/webhook', async (req, res) => {
  res.sendStatus(200); // always ack immediately

  try {
    const entry   = req.body?.entry?.[0];
    const changes = entry?.changes?.[0];
    const msg     = changes?.value?.messages?.[0];
    if (!msg || msg.type !== 'text') return;

    const from = msg.from;          // e.g. "919876543210"
    const text = (msg.text?.body || '').trim().toUpperCase();

    // Only respond to our trigger message format
    if (!text.startsWith('GOABOAT OTP ')) return;

    // Extract phone from message body
    const bodyPhone = text.replace('GOABOAT OTP ', '').trim();
    const cleaned   = cleanPhone(bodyPhone || from);

    // Look up pending OTP
    const record = await OtpModel.findOne({ phone: cleaned, verified: false })
      .sort({ createdAt: -1 });

    if (!record || new Date() > record.expiresAt) {
      await sendWaReply(from, '❌ OTP expired or not found. Please request a new one on the GoaBoat website.');
      return;
    }

    await sendWaReply(from,
      `🔐 Your GoaBoat OTP is: *${record.otp}*\n\nValid for 10 minutes. Do not share with anyone.`
    );
  } catch (err) {
    console.error('WA webhook error:', err.message);
  }
});

async function sendWaReply(to, text) {
  if (!PHONE_NUMBER_ID || !ACCESS_TOKEN) {
    console.log(`[WA Reply to ${to}]: ${text}`);
    return;
  }
  await axios.post(
    `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`,
    { messaging_product: 'whatsapp', to, type: 'text', text: { body: text } },
    { headers: { Authorization: `Bearer ${ACCESS_TOKEN}`, 'Content-Type': 'application/json' } }
  );
}

export default router;
// Mount in app.js: app.use('/wa', waWebhookRouter);