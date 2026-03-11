import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import http from "http";
import { connectDB } from "./db/connect.js";
import { initSocket } from "./socket.js";
import { initWhatsApp } from "./services/otp.service.js";

// Routes
import employeeRoutes       from "./routes/employee.routes.js";
import customerRoutes       from "./routes/customer.routes.js";
import bookingRoutes        from "./routes/booking.routes.js";
import availabilityRoutes   from "./routes/availability.routes.js";
import yachtRoutes          from "./routes/yacht.routes.js";
import transactionRoutes    from "./routes/transaction.routes.js";
import slotRouter           from "./routes/slot.routes.js";
import { globalErrorHandler } from "./middleware/errorHandler.js";
import notificationRouter   from "./routes/notification.routes.js";
import companyRouter        from "./routes/company.route.js";
import customerAuthRouter   from "./routes/customer.auth.routes.js";
import publicBookingRouter  from "./routes/public.booking.routes.js";

dotenv.config();

const app = express();

/* ────────────────────────── CORS ────────────────────────── */
app.use(
  cors({
    origin: [
      "https://goaboat.com",
      "http://goaboat.com",
      "http://localhost:5173",
      "http://localhost:5174",
    ],
    credentials: true,
  })
);

app.use(express.json());

/* ────────────────────────── ROUTES ─────────────────────── */
app.get("/", (req, res) => res.json({ message: "Hello Buddy!!!" }));

app.use("/api/employees",      employeeRoutes);
app.use("/api/customers",      customerRoutes);
app.use("/api/bookings",       bookingRoutes);
app.use("/api/transactions",   transactionRoutes);
app.use("/api/availability",   availabilityRoutes);
app.use("/api/yacht",          yachtRoutes);
app.use("/api/slot",           slotRouter);
app.use("/api/notifications",  notificationRouter);
app.use("/api/company",        companyRouter);
app.use("/api/customer/auth",  customerAuthRouter);   // OTP login for public site
app.use("/api/public",         publicBookingRouter);

app.use(globalErrorHandler);

/* ────────────────────────── SERVER ─────────────────────── */
const server = http.createServer(app);
initSocket(server);

const PORT = process.env.PORT || 3000;

connectDB().then(() => {
  server.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);

    // ── WhatsApp OTP client ──────────────────────────────────────────────
    // Initialised AFTER server is up so QR prints cleanly in the terminal.
    // In production the session is restored from .wa-session automatically.
    // In development OTPs are just printed to the console (no WA needed).
    initWhatsApp();
  });
});