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
  updateEmployeeProfileByAdmin,
  addCompanyToEmployee,
  getAvailableAgentsAndBackdesk
} from "../controllers/employee.controller.js";
import { upload, uploadFileToCloudinaryV2, uploadToCloudinary } from "../middleware/upload.js";
import { employeeSchema } from "../validators/employee.validator.js";
import { validate } from "../middleware/validate.js";
import { authMiddleware, onlyAdmin } from "../middleware/auth.js";

const router = express.Router();

router.get("/", authMiddleware, onlyAdmin, getEmployees);
router.post("/login", loginEmployee);
router.post("/createEmployee", authMiddleware, onlyAdmin, validate(employeeSchema), createEmployee);
router.get("/bookingpage",authMiddleware, getEmployeesForBooking);
router.get("/not-in-company", authMiddleware, onlyAdmin, getAvailableAgentsAndBackdesk);
router.get("/:id", authMiddleware, onlyAdmin, getEmployeeById);
// router.put("/update-profile/:id", authMiddleware, updateEmployeeProfile);
router.put(
  "/update-profile/:id",
  authMiddleware,
  upload.single("profilePhoto"),
  async (req, res, next) => {
    try {
      if (req.file) {
        const imageUrl = await uploadFileToCloudinaryV2(
          req.file,
          "yaut/employees"
        );

        req.body.profilePhoto = imageUrl;
      }
      next();
    } catch (err) {
      next(err);
    }
  },
  updateEmployeeProfile
);
router.patch("/update-status/:id", authMiddleware, onlyAdmin, toggleEmployeeStatus);
router.put("/update-by-admin/:id", authMiddleware, onlyAdmin, updateEmployeeProfileByAdmin);
router.post("/add-to-company", authMiddleware, onlyAdmin,addCompanyToEmployee);
router.delete("/:id", authMiddleware, onlyAdmin, deleteEmployee);

export default router;
