import express from "express";
import { authMiddleware, onlyAdmin } from "../middleware/auth.js";
import { createOrUpdateSlot } from "../controllers/slot.controller.js";

const slotRouter = express.Router();

slotRouter.put(
  "/",
  authMiddleware,
  onlyAdmin,
  createOrUpdateSlot
);

export default slotRouter;
