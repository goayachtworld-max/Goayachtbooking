import express from "express";
import {
    createDemand,
    getDemands,
    getDemandById,
    updateDemandStatus,
    deleteDemand,
} from "../controllers/demand.controller.js";
import { demandSchema } from "../validators/demand.validator.js";
import { validate }     from "../middleware/validate.js";
import { authMiddleware, onlyAdmin } from "../middleware/auth.js";

const router = express.Router();

router.post(  "/",     authMiddleware, validate(demandSchema), createDemand);
router.get(   "/",     authMiddleware, getDemands);
router.get(   "/:id",  authMiddleware, getDemandById);
router.patch( "/:id/status", authMiddleware, updateDemandStatus);   // Update open → converted / closed
router.delete("/:id",  authMiddleware, onlyAdmin, deleteDemand);    // Admin only

export default router;