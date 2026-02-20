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


export const getCustomers = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const skip = (page - 1) * limit;

    const query = {
      company: { $in: req.user.company }
    };

    const totalCustomers = await CustomerModel.countDocuments(query);

    const customers = await CustomerModel.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json({
      customers,
      totalCustomers,
      totalPages: Math.ceil(totalCustomers / limit),
      currentPage: page
    });

  } catch (error) {
    next(error);
  }
};
export const getCustomerById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const customer = await CustomerModel.findOne({
      _id: id,
      company: { $in: req.user.company }
    });

    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    res.json({ customer });

  } catch (error) {
    next(error);
  }
};

export const getCustomerByContact = async (req, res, next) => {
  try {
    const { contact } = req.params; // 👈 Expecting contact in URL
    console.log("Get by contact ", contact)
    const customer = await CustomerModel.findOne({
      contact,
      company: { $in: req.user.company }
    });

    res.json({ "customer": customer });
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
      company: { $in: req.user.company }
    })
      .limit(5)
      .select("name contact email govtIdNo");

    console.log("here is debounce result : ", customers);
    res.json({ customers });
  } catch (error) {
    next(error);
  }
};

export const updateCustomerInfo = async (req, res, next) => {
  try {
    const { customerId } = req.params;
    const { name, contact, email, alternateContact } = req.body;

    const customer = await CustomerModel.findById(customerId);
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found"
      });
    }

    if (name !== undefined) customer.name = name;
    if (contact !== undefined) customer.contact = contact;
    if (email !== undefined) customer.email = email;
    if (alternateContact !== undefined)
      customer.alternateContact = alternateContact;

    await customer.save();

    res.status(200).json({
      success: true,
      message: "Customer updated successfully",
      customer
    });

  } catch (err) {
    console.error("Update customer error:", err);
    next(err);
  }
};
