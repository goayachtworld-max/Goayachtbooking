import { CustomerModel } from "../models/customer.model.js";

const cleanEmptyFields = (obj) => {
  Object.keys(obj).forEach((key) => {
    if (
      obj[key] === "" ||
      obj[key] === null ||
      obj[key] === undefined
    ) {
      delete obj[key];
    }
  });
};


export const createCustomer = async (req, res, next) => {
  try {
    let data = { ...req.body };
    cleanEmptyFields(data);

    const customer = await CustomerModel.create({
      ...data,
      company: req.user.company,
      govtIdImage: req.cloudinaryUrl
    });

    res.status(201).json(customer);
  } catch (error) {
    next(error);
  }
};

// export const createCustomer = async (req, res, next) => {
//   console.log("Create Customer")
//   try {
//     console.log("Cloudinary img ", req.cloudinaryUrl)
//     const customer = await CustomerModel.create({
//       ...req.body,
//       company: req.user.company,
//       govtIdImage: req.cloudinaryUrl // Attach uploaded image URL
//     });
//     console.log("Customer - ", customer);
//     res.status(201).json(customer);
//   } catch (error) {
//     next(error);
//   }
// };

export const getCustomers = async (req, res, next) => {
  console.log("Get all Customers")
  try {
    const customers = await CustomerModel.find();
    res.json(customers);
  } catch (error) {
    next(error);
  }
};

export const getCustomerByContact = async (req, res, next) => {
  try {
    const { contact } = req.params; // 👈 Expecting contact in URL
    console.log("Get by contact ", contact)
    const customer = await CustomerModel.findOne({ contact });

    // if (!customer) {
    //   return res.status(404).json({ error: "Customer not found" });
    // }

    res.json({"customer":customer});
  } catch (error) {
    next(error);
  }
};


// controllers/customer.controller.js
export const searchCustomersByName = async (req, res, next) => {
  try {
    const { name } = req.query;

    console.log("Here is name in query : ", name)
    if (!name || name.trim().length < 2) {
      return res.json({ customers: [] });
    }

    const customers = await CustomerModel.find({
      name: { $regex: name, $options: "i" },
      company: req.user.company
    })
      .limit(5)
      .select("name contact email govtIdNo");

    console.log("here is debounce result : ", customers);
    res.json({ customers });
  } catch (error) {
    next(error);
  }
};

