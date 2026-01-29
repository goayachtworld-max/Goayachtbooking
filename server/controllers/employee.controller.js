import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { EmployeeModel } from "../models/employee.model.js";
import { CompanyModel } from "../models/company.model.js";
import mongoose from "mongoose";


// ✅ Create Employee
export const createEmployee = async (req, res, next) => {
  try {
    const { username, password } = req.body;
    console.log(req.body);
    const uname = username.toLowerCase();
    const pass = password;
    const hashedPassword = await bcrypt.hash(pass, 10);
    console.log("Hashed Password ", hashedPassword)

    const employee = await EmployeeModel.create({
      ...req.body,
      password: hashedPassword,
      company: [req.user.company[0]],
      username: uname
    });

    employee.password = null;
    res.status(201).json({ success: true, employee });
  } catch (error) {
    next(error); // Pass everything to global error handler
  }
};

// ✅ Login Employee
export const loginEmployee = async (req, res, next) => {
  try {
    const { username, password } = req.body;
    const uname = username.toLowerCase();
    const pass = password;
    const employee = await EmployeeModel.findOne({ username: uname });

    if (!employee) {
      const err = new Error("Employee not found");
      err.status = 404;
      throw err;
    }
    if (employee.status === "inactive") {
      const err = new Error("User is Deactivated, contact with Admin");
      err.status = 403;
      throw err;
    }

    const isMatch = await bcrypt.compare(pass, employee.password);
    if (!isMatch) {
      const err = new Error("Invalid credentials");
      err.status = 401;
      throw err;
    }

    const token = jwt.sign(
      { id: employee._id, type: employee.type, company: employee.company },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );
    employee.lastLoginAt = new Date();
    await employee.save();
    employee.password = null;
    res.json({ success: true, token, employee });
  } catch (error) {
    next(error);
  }
};

// ✅ Get All Employees
export const getEmployees = async (req, res, next) => {
  try {
    const employees = await EmployeeModel.find(
      { company: { $in: req.user.company } },
      "-password -company"
    );
    res.status(200).json({ success: true, employees });
  } catch (error) {
    next(error);
  }
};

export const getEmployeesForBooking = async (req, res, next) => {
  try {
    const { type, id } = req.user;

    let filter = {
      company: { $in: req.user.company },
      status: "active",
      type: { $in: ["admin", "backdesk"] }
    };


    // 🔒 Backdesk → only himself
    if (type === "backdesk") {
      filter._id = id;
    }

    // 🟢 Admin & Onsite → all employees
    const employees = await EmployeeModel.find(
      filter,
      "_id name type"
    ).sort({ name: 1 });
    console.log("Emp : ", employees)

    res.json({ success: true, employees });
  } catch (error) {
    next(error);
  }
};

// Get Single Employee by ID
export const getEmployeeById = async (req, res, next) => {
  try {
    const employee = await EmployeeModel.findById(req.params.id);
    if (!employee) return res.status(404).json({ success: false, message: "Employee not found" });
    employee.password = null;
    res.json({ success: true, employee });
  } catch (error) {
    next(error);
  }
};

// Update Employee
// export const updateEmployeeProfile = async (req, res, next) => {
//   try {
//     const { currentPassword, newPassword, ...otherUpdates } = req.body;

//     // Find employee first
//     const employee = await EmployeeModel.findById(req.params.id);
//     if (!employee) {
//       return res
//         .status(404)
//         .json({ success: false, message: "Employee not found" });
//     }

//     // 🟡 If password change is requested
//     if (newPassword) {
//       // Both must be present
//       if (!currentPassword || !newPassword) {
//         return res.status(400).json({
//           success: false,
//           message: "Both current and new password are required",
//         });
//       }

//       // Verify current password
//       const isMatch = await bcrypt.compare(
//         currentPassword,
//         employee.password
//       );

//       if (!isMatch) {
//         return res.status(401).json({
//           success: false,
//           message: "Current password is incorrect",
//         });
//       }

//       // Hash new password
//       const hashedPassword = await bcrypt.hash(newPassword, 10);
//       employee.password = hashedPassword;
//     }

//     // 🟢 Update other profile fields
//     Object.keys(otherUpdates).forEach((key) => {
//       employee[key] = otherUpdates[key];
//     });

//     await employee.save();

//     // Remove password before sending response
//     const employeeObj = employee.toObject();
//     delete employeeObj.password;

//     res.status(200).json({
//       success: true,
//       message: "Profile updated successfully",
//       employee: employeeObj,
//     });
//   } catch (error) {
//     next(error);
//   }
// };

export const updateEmployeeProfile = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    console.log("Req body update emp profile : ", req.body)
    const employee = await EmployeeModel.findById(req.params.id);
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    /* 🔐 PASSWORD CHANGE */
    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({
          success: false,
          message: "Current password is required",
        });
      }

      const isMatch = await bcrypt.compare(
        currentPassword,
        employee.password
      );

      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: "Current password is incorrect",
        });
      }

      employee.password = await bcrypt.hash(newPassword, 10);
    }

    /* 🟢 ALLOWED PROFILE FIELDS ONLY */
    const allowedUpdates = [
      "name",
      "contact",
      "alternateContact",
      "email",
      "profilePhoto"
    ];

    allowedUpdates.forEach((field) => {
      if (req.body[field] !== undefined) {
        employee[field] = req.body[field];
      }
    });

    await employee.save();

    const employeeObj = employee.toObject();
    delete employeeObj.password;

    console.log("After update : ", employeeObj)
    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      employee: employeeObj,
    });
  } catch (error) {
    next(error);
  }
};


// Activate / Deactivate Employee
// export const toggleEmployeeStatus = async (req, res, next) => {
//   try {
//     const employee = await EmployeeModel.findById(req.params.id);
//     if (!employee) return res.status(404).json({ success: false, message: "Employee not found" });
//     employee.status = employee.status === "active" ? "inactive" : "active";
//     await employee.save();
//     employee.password = null;
//     res.json({ success: true, message: `Employee is now ${employee.status}`, employee });
//   } catch (error) {
//     next(error);
//   }
// };

export const toggleEmployeeStatus = async (req, res, next) => {
  try {
    const adminCompanyId = req.user.company[0];

    if (!adminCompanyId) {
      return res.status(400).json({
        success: false,
        message: "Admin company not found",
      });
    }

    const employee = await EmployeeModel.findByIdAndUpdate(
      req.params.id,
      {
        $pull: { company: adminCompanyId }, // ❌ remove only this company
      },
      { new: true }
    ).select("-password");

    if (!employee) {
      return res
        .status(404)
        .json({ success: false, message: "Employee not found" });
    }

    res.json({
      success: true,
      message: "Employee removed from company successfully",
      employee,
    });
  } catch (error) {
    next(error);
  }
};

// Delete Employee
export const deleteEmployee = async (req, res, next) => {
  try {
    const employee = await EmployeeModel.findByIdAndDelete(req.params.id);
    if (!employee) return res.status(404).json({ success: false, message: "Employee not found" });
    res.json({ success: true, message: "Employee deleted successfully." });
  } catch (error) {
    next(error);
  }
};

// export const updateEmployeeProfileByAdmin = async (req, res) => {
//   try {
//     const { adminPassword, name, email, contact, newPassword, isPrivate } = req.body;

//     // 1. Validate input
//     if (!adminPassword) {
//       return res.status(400).json({ success: false, message: "Admin password is required" });
//     }
//     // 2. Verify admin password
//     const adminId = req.user.id; // Assuming admin is authenticated via middleware
//     console.log("I'm admin : ", adminId)
//     console.log("req.user : ", req.user);
//     const admin = await EmployeeModel.findById(adminId);
//     if (!admin) {
//       return res.status(401).json({ success: false, message: "Admin not found" });
//     }

//     const isMatch = await bcrypt.compare(adminPassword, admin.password);
//     if (!isMatch) {
//       return res.status(401).json({ success: false, message: "Invalid admin password" });
//     }

//     // 3. Find employee
//     const employee = await EmployeeModel.findById(req.params.id);
//     if (!employee) {
//       return res.status(404).json({ success: false, message: "Employee not found" });
//     }

//     // 4. Update fields
//     if (name) employee.name = name;
//     if (email) employee.email = email;
//     if (contact) employee.contact = contact;

//     // 5. Update password if provided
//     if (newPassword) {
//       if (newPassword.length < 6) {
//         return res.status(400).json({ success: false, message: "Password must be at least 6 characters" });
//       }
//       const hashedPassword = await bcrypt.hash(newPassword, 10);
//       employee.password = hashedPassword
//     }

//     await employee.save();
//     employee.password=null;

//     res.json({ success: true, employee });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// };

export const updateEmployeeProfileByAdmin = async (req, res) => {
  try {
    const {
      adminPassword,
      name,
      email,
      contact,
      newPassword,
      isPrivate, // ✅ added
    } = req.body;

    // 1. Validate admin password
    if (!adminPassword) {
      return res
        .status(400)
        .json({ success: false, message: "Admin password is required" });
    }

    // 2. Verify admin
    const adminId = req.user.id;
    const admin = await EmployeeModel.findById(adminId);
    if (!admin) {
      return res
        .status(401)
        .json({ success: false, message: "Admin not found" });
    }

    const isMatch = await bcrypt.compare(adminPassword, admin.password);
    if (!isMatch) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid admin password" });
    }

    // 3. Find employee
    const employee = await EmployeeModel.findById(req.params.id);
    if (!employee) {
      return res
        .status(404)
        .json({ success: false, message: "Employee not found" });
    }

    // 4. Update allowed fields
    if (name !== undefined) employee.name = name;
    if (email !== undefined) employee.email = email;
    if (contact !== undefined) employee.contact = contact;

    // ✅ PRIVATE / PUBLIC PROFILE
    if (isPrivate !== undefined) {
      employee.isPrivate =
        isPrivate === true || isPrivate === "true";
    }

    // 5. Password update (optional)
    if (newPassword) {
      if (newPassword.length < 6) {
        return res.status(400).json({
          success: false,
          message: "Password must be at least 6 characters",
        });
      }
      employee.password = await bcrypt.hash(newPassword, 10);
    }

    await employee.save();

    const employeeObj = employee.toObject();
    delete employeeObj.password;

    res.json({
      success: true,
      message: "Employee updated successfully",
      employee: employeeObj,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};


export const addCompanyToEmployee = async (req, res, next) => {
  try {
    const adminId = req.user.id;
    const { employeeId, companyId } = req.body;

    // 1️⃣ Only admin / superAdmin allowed
    if (!["admin", "superAdmin"].includes(req.user.type)) {
      return res.status(403).json({
        success: false,
        message: "Only admin can add company to employee",
      });
    }

    // 2️⃣ Validate ObjectIds
    if (
      !mongoose.Types.ObjectId.isValid(employeeId) ||
      !mongoose.Types.ObjectId.isValid(companyId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid employeeId or companyId",
      });
    }

    // 4️⃣ Verify company exists
    const company = await CompanyModel.findById(companyId);
    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Company not found",
      });
    }

    // 5️⃣ Verify employee exists
    const employeeExists = await EmployeeModel.findById(employeeId);
    if (!employeeExists) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    // 6️⃣ Add company using $addToSet (NO duplicates)
    const updatedEmployee = await EmployeeModel.findByIdAndUpdate(
      employeeId,
      { $addToSet: { company: companyId } },
      { new: true }
    ).select("-password");

    res.status(200).json({
      success: true,
      message: "Company added to employee successfully",
      employee: updatedEmployee,
    });
  } catch (error) {
    next(error);
  }
};

export const getAvailableAgentsAndBackdesk = async (req, res, next) => {
  try {
    const adminCompanyId = req.user.company?.[0];

    // 1️⃣ Ensure admin company exists
    if (!adminCompanyId || !mongoose.Types.ObjectId.isValid(adminCompanyId)) {
      return res.status(400).json({
        success: false,
        message: "Admin company not found",
      });
    }

    // 2️⃣ Fetch employees
    const employees = await EmployeeModel.find({
      type: { $in: ["agent", "backdesk"] },
      isPrivate: false,
      company: { $ne: adminCompanyId }, // ❌ NOT employee of admin company
    }).select("-password");

    res.status(200).json({
      success: true,
      count: employees.length,
      employees,
    });
  } catch (error) {
    next(error);
  }
};