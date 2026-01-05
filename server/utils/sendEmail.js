import nodemailer from "nodemailer";

export const sendEmail = async ({ to, subject, text, html }) => {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    connectionTimeout: 20_000, // 20 sec
    greetingTimeout: 20_000,
    socketTimeout: 20_000,
  });

  const mailOptions = {
    from: `"Your Company" <${process.env.SMTP_USER}>`,
    to,
    subject,
    text,
    html,
  };

  // ⏱️ Timeout promise
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error("Email send timeout (20s)")), 20_000)
  );

  try {
    await Promise.race([
      transporter.sendMail(mailOptions),
      timeoutPromise,
    ]);

    console.log("📧 Email sent successfully to", to);
    return { success: true };
  } catch (err) {
    console.error("❌ Failed to send email:", err.message);
    throw err;
  }
};
