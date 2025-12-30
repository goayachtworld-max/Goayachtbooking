import express from "express";
import {
  createEmployee,
  loginEmployee,
  getEmployees,
  getEmployeeById,
  // updateEmployee,
  toggleEmployeeStatus,
  deleteEmployee,
  getEmployeesForBooking,
  updateEmployeeProfile,
  updateEmployeeProfileByAdmin
} from "../controllers/employee.controller.js";import { employeeSchema } from "../validators/employee.validator.js";
import { validate } from "../middleware/validate.js";
import { authMiddleware, onlyAdmin } from "../middleware/auth.js";

const router = express.Router();

router.post("/login", loginEmployee);
router.post("/createEmployee", authMiddleware, onlyAdmin, validate(employeeSchema), createEmployee);
router.get("/", authMiddleware, onlyAdmin, getEmployees);
router.get("/bookingpage",authMiddleware, getEmployeesForBooking);
router.get("/:id", authMiddleware, onlyAdmin, getEmployeeById);
router.put("/update-profile/:id", authMiddleware, updateEmployeeProfile);
router.patch("/update-status/:id", authMiddleware, onlyAdmin, toggleEmployeeStatus);
router.put("/update-by-admin/:id", authMiddleware, onlyAdmin, updateEmployeeProfileByAdmin);
router.delete("/:id", authMiddleware, onlyAdmin, deleteEmployee);


export default router;
