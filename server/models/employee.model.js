import mongoose from 'mongoose';
import { fa } from 'zod/v4/locales';

const employeeSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['admin', 'backdesk', 'onsite'], // 👈 Only these values allowed
    required: true
  },
  systemAdministrator: {
    type: Boolean,
    default: false
  },
  company: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
    }
  ],
  username: {
    type: String,
    required: true,
    unique: true,      // 👈 Prevent duplicate usernames
    trim: true,
    minlength: 3
  },
  password: {
    type: String,
    required: true,
    minlength: 6       // 👈 Basic password rule
  },
  name: {
    type: String,
    required: true,
    trim: true,
    minlength: 2
  },
  contact: {
    type: String,
    required: true,
    match: [/^\+?[0-9]{10,15}$/, 'Contact number must be 10–15 digits, optionally starting with +']
  },
  email: {
    type: String,
    required: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Invalid email format']
  },
  profilePhoto: {
    type: String,
    default: null,
    required: false
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },
  isPrivate: {
    type: Boolean,
    default: false   // 👈 public by default
  },
  lastLoginAt: {
    type: Date,
    default: null
  },
  lastSeenAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true // 👈 adds createdAt & updatedAt automatically
});

export const EmployeeModel = mongoose.model('Employee', employeeSchema);
