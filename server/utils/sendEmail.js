import nodemailer from "nodemailer";

const SEND_TIMEOUT_MS = 20_000;

// j***@gmail.com : enough to recognise the address in logs without exposing it
export const maskEmail = (e = "") => String(e).replace(/^(.).*(@.*)$/, "$1***$2");

export const sendEmail = async ({ to, subject, text, html }) => {
  const started = Date.now();
  const fromName = process.env.MAIL_FROM_NAME || "Account Support";

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    connectionTimeout: SEND_TIMEOUT_MS,
    greetingTimeout: SEND_TIMEOUT_MS,
    socketTimeout: SEND_TIMEOUT_MS,
  });

  const mailOptions = {
    from: `"${fromName}" <${process.env.SMTP_USER}>`,
    to,
    subject,
    text,
    html,
  };

  console.log(
    `📧 [mail] sending "${subject}" to ${maskEmail(to)} ` +
      `via ${process.env.SMTP_HOST}:${process.env.SMTP_PORT} (secure=${process.env.SMTP_SECURE === "true"})`
  );

  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`Email send timeout (${SEND_TIMEOUT_MS / 1000}s)`)),
      SEND_TIMEOUT_MS
    );
  });

  try {
    const info = await Promise.race([transporter.sendMail(mailOptions), timeoutPromise]);
    const ms = Date.now() - started;
    const accepted = info.accepted || [];
    const rejected = info.rejected || [];

    // The server answered, but refused every recipient: that is a failure
    if (accepted.length === 0 && rejected.length > 0) {
      throw new Error(`Recipient rejected by mail server: ${rejected.join(", ")} (${info.response || "no response text"})`);
    }

    console.log(
      `✅ [mail] SENT "${subject}" to ${maskEmail(to)} in ${ms}ms | ` +
        `accepted=${accepted.length} rejected=${rejected.length} | ` +
        `id=${info.messageId || "-"} | server: ${info.response || "-"}`
    );
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error(
      `❌ [mail] FAILED "${subject}" to ${maskEmail(to)} after ${Date.now() - started}ms | ` +
        `${err.message}` +
        (err.code ? ` | code=${err.code}` : "") +
        (err.command ? ` | command=${err.command}` : "") +
        (err.responseCode ? ` | smtpStatus=${err.responseCode}` : "")
    );
    throw err;
  } finally {
    clearTimeout(timer);
  }
};