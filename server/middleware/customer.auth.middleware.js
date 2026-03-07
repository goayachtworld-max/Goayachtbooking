/**
 * Customer Auth Middleware
 * Separate from staff auth — customers use a lightweight JWT
 * containing only customerId + phone.
 *
 * Env: CUSTOMER_JWT_SECRET=<strong_random_secret>
 */
import jwt from "jsonwebtoken";

const SECRET = process.env.CUSTOMER_JWT_SECRET || "customer_secret_CHANGE_IN_PROD";

/** Issue a 7-day customer JWT */
export const signCustomerToken = (customerId, phone) =>
  jwt.sign({ customerId, phone, role: "customer" }, SECRET, { expiresIn: "7d" });

/**
 * Express middleware — attaches req.customer = { customerId, phone }
 */
export const customerAuthMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "Authentication required" });
  }

  try {
    const decoded = jwt.verify(authHeader.split(" ")[1], SECRET);

    if (decoded.role !== "customer") {
      return res.status(403).json({ success: false, message: "Invalid token type" });
    }

    req.customer = { customerId: decoded.customerId, phone: decoded.phone };
    next();
  } catch (err) {
    const message =
      err.name === "TokenExpiredError"
        ? "Session expired — please login again"
        : "Invalid token";
    return res.status(401).json({ success: false, message });
  }
};