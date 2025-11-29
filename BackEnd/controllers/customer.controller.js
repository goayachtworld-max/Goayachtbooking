import { CustomerModel } from "../models/customer.model.js";

export const createCustomer = async (req, res, next) => {
  console.log("Create Customer")
  try {
    console.log("Cloudinary img ", req.cloudinaryUrl)
    const customer = await CustomerModel.create({
      ...req.body,
      govtIdImage: req.cloudinaryUrl // Attach uploaded image URL
    });
    console.log("Customer - ", customer);
    res.status(201).json(customer);
  } catch (error) {
    next(error);
  }
};

export const getCustomers = async (req, res, next) => {
  console.log("Get all Customers")
  try {
    const customers = await CustomerModel.find();
    res.json(customers);
  } catch (error) {
    next(error);
  }
};

// export const getCustomerByEmail = async (req, res, next) => {
//   try {
//     const { email } = req.params; // 👈 Expecting email in URL
//     console.log("Get by email ", email)
//     const customer = await CustomerModel.findOne({ email });

//     if (!customer) {
//       return res.status(404).json({ error: "Customer not found" });
//     }

//     res.json(customer);
//   } catch (error) {
//     next(error);
//   }
// };

export const getCustomerByEmail = async (req, res, next) => {
  try {
    const { email } = req.params;
    console.log("Get by email ", email);

    const customer = await CustomerModel.findOne({ email });

    // ✅ Always respond with 200
    // ✅ Frontend will check if customer === null
    return res.status(200).json({
      customer: customer || null
    });

  } catch (error) {
    next(error);
  }
};
