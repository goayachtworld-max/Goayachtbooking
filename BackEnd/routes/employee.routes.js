import express from "express";
import {
  createEmployee,
  loginEmployee,
  getEmployees,
  getEmployeeById,
  updateEmployee,
  toggleEmployeeStatus,
  deleteEmployee
} from "../controllers/employee.controller.js";import { employeeSchema } from "../validators/employee.validator.js";
import { validate } from "../middleware/validate.js";
import { authMiddleware, onlyAdmin } from "../middleware/auth.js";

const router = express.Router();

router.post("/login", loginEmployee);
router.post("/createEmployee", authMiddleware, onlyAdmin, validate(employeeSchema), createEmployee);
router.get("/", authMiddleware, onlyAdmin, getEmployees);
router.get("/:id", authMiddleware, onlyAdmin, getEmployeeById);
router.put("/:id", authMiddleware, onlyAdmin, updateEmployee);
router.patch("/:id/status", authMiddleware, onlyAdmin, toggleEmployeeStatus);
router.delete("/:id", authMiddleware, onlyAdmin, deleteEmployee);


export default router;
