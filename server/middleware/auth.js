import jwt from "jsonwebtoken";
import { EmployeeModel } from "../models/employee.model.js";

export const authMiddleware = async (req, res, next) => {
  try {
    console.log("Inside Auth middleware");

    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authorization token missing"
      });
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const employee = await EmployeeModel.findById(decoded.id)
      .select("_id type company isPrivate status lastSeenAt");

    if (!employee) {
      return res.status(401).json({
        success: false,
        message: "Invalid token"
      });
    }

    if (employee.status !== "active") {
      return res.status(403).json({
        success: false,
        message: "Employee is inactive"
      });
    }
    const THIRTY_MIN = 30 * 60 * 1000;
    const now = Date.now();
    if (
      !employee.lastSeenAt ||
      now - new Date(employee.lastSeenAt).getTime() > THIRTY_MIN
    ) {
      await EmployeeModel.updateOne(
        { _id: decoded.id },
        { lastSeenAt: new Date() }
      );
    }

    req.user = {
      id: employee._id.toString(),
      _id: employee._id.toString(),
      type: employee.type,
      company: employee.company.map(id => id.toString()),
      isPrivate: employee.isPrivate
    };

    console.log("Auth success:", req.user);

    next();
  } catch (error) {
    error.status = 401;
    next(error);
  }
};


export const onlyAdmin = (req, res, next) => {
  console.log("Inside only admin")
  if (!req.user || req.user.type !== "admin") {
    console.log("Not an admin")
    return res.status(403).json({
      success: false,
      message: "Only admin can perform this action"
    });
  }
  console.log("ttl")
  next();
};
