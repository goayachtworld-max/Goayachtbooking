import express from "express";
import {
  getMyNotifications,
  markAllNotificationsRead,
  markAsRead,
  unreadCount,
} from "../controllers/notification.controller.js";
import { authMiddleware } from "../middleware/auth.js";

const notificationRouter = express.Router();

notificationRouter.get("/", authMiddleware, getMyNotifications);
notificationRouter.get("/unread-count", authMiddleware, unreadCount);
notificationRouter.patch("/:id/read",authMiddleware, markAsRead);
notificationRouter.patch("/mark-all-read", authMiddleware, markAllNotificationsRead);

export default notificationRouter;
