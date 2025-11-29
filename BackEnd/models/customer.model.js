import mongoose from 'mongoose';

const customerSchema = new mongoose.Schema({
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
  alternateContact: {
    type: String,
    required: false,
    match: [/^\+?[0-9]{10,15}$/, 'Alternate contact must be 10–15 digits if provided']
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Invalid email format']
  },
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
  },
  govtIdImage: {
    type: String,
    // required: true // could be URL or local file path
  },
  govtIdNo: {
    type: String,
    // required: true,
    match: [/^[a-zA-Z0-9]+$/, 'Govt ID must be alphanumeric']
  }
}, {
  timestamps: true
});

export const CustomerModel = mongoose.model('Customer', customerSchema);
