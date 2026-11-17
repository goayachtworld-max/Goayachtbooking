import express from "express";
import {
  getOverview,
  getStatus,
  connect,
  reconnect,
  disconnect,
  sendTest,
} from "../controllers/whatsapp.controller.js";
import { authMiddleware } from "../middleware/auth.js";
import { rateLimit } from "../utils/rateLimit.js";

const router = express.Router();

// Linking is heavy (it starts a browser), so limit how often it can be triggered
const heavyLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  message: "Too many attempts. Please wait a few minutes.",
});

router.get("/overview", authMiddleware, getOverview);
router.get("/status", authMiddleware, getStatus);
router.post("/connect", authMiddleware, heavyLimiter, connect);
router.post("/reconnect", authMiddleware, heavyLimiter, reconnect);
router.post("/disconnect", authMiddleware, heavyLimiter, disconnect);
router.post("/test", authMiddleware, heavyLimiter, sendTest);

export default router;
