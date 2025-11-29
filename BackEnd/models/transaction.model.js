// src/models/transaction.model.js
import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema({
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking', // 👈 Points to Booking model
    required: true
  },
  type: {
    type: String,
    enum: ['advance', 'settlement'],
    required: true
  },
  paymentProof: {
    type: String,
    required: true // can store file path or URL to the uploaded image
  },
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee', // 👈 Points to Employee model
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  date: {
    type: Date,
    default: Date.now // capture transaction time automatically
  }
}, {
  timestamps: true
});

export const TransactionModel = mongoose.model('Transaction', transactionSchema);
