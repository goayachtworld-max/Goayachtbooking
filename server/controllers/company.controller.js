import { CompanyModel } from "../models/company.model.js";
import { EmployeeModel } from "../models/employee.model.js";

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
