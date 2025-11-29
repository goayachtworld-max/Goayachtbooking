import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import { connectDB } from "./db/connect.js";

// Routes
import employeeRoutes from "./routes/employee.routes.js";
import customerRoutes from "./routes/customer.routes.js";
import bookingRoutes from "./routes/booking.routes.js";
import availabilityRoutes from "./routes/availability.routes.js";
import yachtRoutes from "./routes/yacht.routes.js";
import transactionRoutes from "./routes/transaction.routes.js";
import { globalErrorHandler } from "./middleware/errorHandler.js";

dotenv.config();

// "https://yaut-frontend-20.vercel.app"
const app = express();
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://yaut-2-o.vercel.app"], 
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true, // 👈 allow cookies / authorization headers
  })
);
app.use(express.json());

// Test route
app.get("/", (req, res) => {
  res.json({ message: "Hello Buddy!!!" });
});

// Routes
app.use("/api/employees", employeeRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/availability", availabilityRoutes);
app.use("/api/yacht", yachtRoutes);

// Global Error Handler (must be after all routes)
app.use(globalErrorHandler);

const PORT = process.env.PORT || 3000;

connectDB().then(() => {
  app.listen(PORT, () =>
    console.log(`🚀 Server running on http://localhost:${PORT}`)
  );
});
