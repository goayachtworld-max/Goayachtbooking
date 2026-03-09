// utils/otpState.js
// Persists in-progress OTP flow across component unmounts (navigation away & back).
// Uses sessionStorage — survives re-renders and route changes, clears on tab close.
//
// Shape stored: { phone: "XXXXXXXXXXX", sentAt: <timestamp ms>, step: 2 }

const KEY = 'goaboat_otp_pending';

export const saveOtpState = (phone) => {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({
      phone,
      sentAt: Date.now(),
      step: 2,
    }));
  } catch (_) {}
};

export const loadOtpState = () => {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    // OTP expires in 10 minutes — don't restore stale state
    if (Date.now() - data.sentAt > 10 * 60 * 1000) {
      sessionStorage.removeItem(KEY);
      return null;
    }
    return data; // { phone, sentAt, step }
  } catch (_) { return null; }
};

export const clearOtpState = () => {
  try { sessionStorage.removeItem(KEY); } catch (_) {}
};

// How many seconds of the 60s resend cooldown are still left
export const resendSecondsLeft = (sentAt) => {
  const elapsed = Math.floor((Date.now() - sentAt) / 1000);
  return Math.max(0, 60 - elapsed);
};