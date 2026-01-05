import mongoose from 'mongoose';

const companySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 2
    },
    code: {
      type: String,
      unique: true,
      uppercase: true,
      trim: true
    },
    companyOwner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',      // 👈 Company owner is an Employee
      required: true
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Invalid email format']
    },

    contact: {
      type: String,
      match: [/^\+?[0-9]{10,15}$/, 'Contact number must be 10–15 digits']
    },

    address: {
      type: String,
      trim: true
    },

    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active'
    }
  },
  {
    timestamps: true
  }
);

export const CompanyModel = mongoose.model('Company', companySchema);
