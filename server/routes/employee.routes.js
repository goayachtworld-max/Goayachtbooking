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
  getAvailableAgentsAndBackdesk,
  setPin
} from "../controllers/employee.controller.js";
import { upload, uploadFileToCloudinaryV2, uploadToCloudinary } from "../middleware/upload.js";
import { employeeSchema } from "../validators/employee.validator.js";
import { validate } from "../middleware/validate.js";
import { authMiddleware, onlyAdmin } from "../middleware/auth.js";
import {
  forgotPassword,
  checkResetToken,
  resetPassword,
} from "../controllers/passwordReset.controller.js";
import { rateLimit } from "../utils/rateLimit.js";

const router = express.Router();

router.get("/", authMiddleware, onlyAdmin, getEmployees);
router.post("/login", loginEmployee);

// Forgot password (staff only, public routes: the user is not logged in)
const forgotLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Too many requests. Please try again in a few minutes.",
});
const resetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: "Too many attempts. Please try again in a few minutes.",
});
router.post("/forgot-password", forgotLimiter, forgotPassword);
router.post("/reset-password/check", resetLimiter, checkResetToken);
router.post("/reset-password", resetLimiter, resetPassword);
router.post("/set-pin", authMiddleware, setPin);
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