// utils/rateLimit.js
// Tiny in-memory rate limiter (no extra package needed). Fine for a single
// server process, which is how the API runs under PM2.

/**
 * Best-effort client IP. If a reverse proxy (nginx) appends to X-Forwarded-For,
 * the LAST entry is the address the proxy actually saw, so we use that one.
 */
export const clientIp = (req) => {
  const xff = req.headers?.["x-forwarded-for"];
  if (typeof xff === "string" && xff.trim()) {
    const parts = xff.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length) return parts[parts.length - 1];
  }
  return req.ip || req.socket?.remoteAddress || "unknown";
};

export const rateLimit = ({ windowMs, max, message }) => {
  const hits = new Map(); // ip -> { count, reset }

  const sweeper = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) if (entry.reset <= now) hits.delete(key);
  }, windowMs);
  sweeper.unref?.();

  return (req, res, next) => {
    const key = clientIp(req);
    const now = Date.now();
    let entry = hits.get(key);
    if (!entry || entry.reset <= now) {
      entry = { count: 0, reset: now + windowMs };
      hits.set(key, entry);
    }
    entry.count += 1;
    if (entry.count > max) {
      res.set("Retry-After", String(Math.ceil((entry.reset - now) / 1000)));
      return res.status(429).json({ success: false, message });
    }
    next();
  };
};
