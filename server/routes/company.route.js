import express from "express";
import { createCompany, registerAdminWithCompany } from "../controllers/company.controller.js";
import { authMiddleware } from "../middleware/auth.js";

const companyRouter = express.Router();

companyRouter.post("/CreateCompany", createCompany);
companyRouter.post("/", authMiddleware, registerAdminWithCompany);

export default companyRouter;