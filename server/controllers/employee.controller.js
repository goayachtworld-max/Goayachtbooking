import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { EmployeeModel } from "../models/employee.model.js";

// ✅ Create Employee
export const createEmployee = async (req, res, next) => {
  try {
    const hashedPassword = await bcrypt.hash(req.body.password, 10);

    const employee = await EmployeeModel.create({
      ...req.body,
      password: hashedPassword,
      company: req.user.company
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
    const employee = await EmployeeModel.findOne({ username });

    if (!employee) {
      const err = new Error("Employee not found");
      err.status = 404;
      throw err;
    }

    const isMatch = await bcrypt.compare(password, employee.password);
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

    employee.password = null;
    res.json({ success: true, token, employee });
  } catch (error) {
    next(error);
  }
};

// ✅ Get All Employees
export const getEmployees = async (req, res, next) => {
  try {
    // Fetch only required fields (hide password & company)
    const employees = await EmployeeModel.find(
      { company: req.user.company },
      "-password -company" // exclude password and company
    );

    res.status(200).json({ success: true, employees });
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
export const updateEmployee = async (req, res, next) => {
  try {
    const updateData = { ...req.body };
    if (updateData.password) {
      updateData.password = await bcrypt.hash(updateData.password, 10);
    }
    const employee = await EmployeeModel.findByIdAndUpdate(req.params.id, updateData, { new: true });
    if (!employee) return res.status(404).json({ success: false, message: "Employee not found" });
    employee.password = null;
    res.json({ success: true, employee });
  } catch (error) {
    next(error);
  }
};

// Activate / Deactivate Employee
export const toggleEmployeeStatus = async (req, res, next) => {
  try {
    const employee = await EmployeeModel.findById(req.params.id);
    if (!employee) return res.status(404).json({ success: false, message: "Employee not found" });
    employee.status = employee.status === "active" ? "inactive" : "active";
    await employee.save();
    employee.password = null;
    res.json({ success: true, message: `Employee is now ${employee.status}`, employee });
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
