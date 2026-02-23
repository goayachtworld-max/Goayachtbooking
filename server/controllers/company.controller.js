import { CompanyModel } from "../models/company.model.js";
import { EmployeeModel } from "../models/employee.model.js";
import mongoose from "mongoose";
import bcrypt from "bcrypt";

export const createCompany = async (req, res, next) => {
  try {
    const { name, code, email, contact, address, adminId } = req.body;

    // 1️⃣ Validate input
    if (!name || !code || !adminId) {
      return res.status(400).json({
        success: false,
        message: "name, code and adminId are required"
      });
    }
    // 2️⃣ Verify admin exists & role
    // const admin = await EmployeeModel.findById(adminId).select("_id type status");
    // if (!admin) {
    //   return res.status(404).json({
    //     success: false,
    //     message: "Admin not found"
    //   });
    // }

    // if (admin.type !== "admin") {
    //   return res.status(403).json({
    //     success: false,
    //     message: "Provided user is not an admin"
    //   });
    // }

    // if (admin.status !== "active") {
    //   return res.status(403).json({
    //     success: false,
    //     message: "Admin is inactive"
    //   });
    // }

    // 3️⃣ Check duplicate company
    const existingCompany = await CompanyModel.findOne({
      $or: [{ name }, { code }]
    });

    if (existingCompany) {
      return res.status(409).json({
        success: false,
        message: "Company with same name or code already exists"
      });
    }

    // 4️⃣ Create company
    const company = await CompanyModel.create({
      name,
      code,
      email,
      contact,
      address,
      companyOwner: adminId
    });

    // 5️⃣ Attach company to admin
    await EmployeeModel.findByIdAndUpdate(
      adminId,
      { $addToSet: { company: company._id } }
    );

    return res.status(201).json({
      success: true,
      message: "Company created successfully",
      company
    });

  } catch (error) {
    next(error);
  }
};


export const registerAdminWithCompany = async (req, res, next) => {
  const session = await mongoose.startSession();

  try {
    // 🔐 0️⃣ Check System Administrator Access
    if (!req.user?.systemAdministrator) {
      return res.status(403).json({
        success: false,
        message: "Only System Administrator can create company"
      });
    }

    session.startTransaction();

    const {
      username,
      password,
      name,
      email,
      contact,
      companyName,
      companyCode,
      address
    } = req.body;

    // 1️⃣ Validate required fields
    if (!username || !password || !companyName || !companyCode) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Missing required fields"
      });
    }

    // 2️⃣ Normalize username
    const normalizedUsername = username.toLowerCase();

    // 3️⃣ Check duplicate username
    const existingUser = await EmployeeModel
      .findOne({ username: normalizedUsername })
      .session(session);

    if (existingUser) {
      await session.abortTransaction();
      return res.status(409).json({
        success: false,
        message: "Username already exists"
      });
    }

    // 4️⃣ Check duplicate company
    const existingCompany = await CompanyModel.findOne({
      $or: [
        { name: companyName },
        { code: companyCode }
      ]
    }).session(session);

    if (existingCompany) {
      await session.abortTransaction();
      return res.status(409).json({
        success: false,
        message: "Company with same name or code already exists"
      });
    }

    // 5️⃣ Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 6️⃣ Create Admin (NOT system admin)
    const admin = await EmployeeModel.create([{
      type: "admin",
      username: normalizedUsername,
      password: hashedPassword,
      name,
      email,
      contact,
      systemAdministrator: false // 🔐 force false
    }], { session });

    // 7️⃣ Create Company
    const company = await CompanyModel.create([{
      name: companyName,
      code: companyCode,
      email,
      contact,
      address,
      companyOwner: admin[0]._id
    }], { session });

    // 8️⃣ Bind company to admin
    admin[0].company = [company[0]._id];
    await admin[0].save({ session });

    await session.commitTransaction();
    session.endSession();

    admin[0].password = null;

    return res.status(201).json({
      success: true,
      message: "Admin & Company created successfully",
      admin: admin[0],
      company: company[0]
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    next(error);
  }
};