import nodemailer from "nodemailer";

export const sendEmail = async ({ to, subject, text, html }) => {
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: process.env.SMTP_SECURE === "true", // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: `"Your Company" <${process.env.SMTP_USER}>`,
      to,
      subject,
      text,
      html,
    });

    console.log("📧 Email sent successfully to", to);
  } catch (err) {
    console.error("❌ Failed to send email:", err);
  }
};
