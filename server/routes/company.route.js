import express from "express";
import { createCompany } from "../controllers/company.controller.js";

const companyRouter = express.Router();

companyRouter.post("/CreateCompany", createCompany);

export default companyRouter;