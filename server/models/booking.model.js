// src/models/booking.model.js
import mongoose from 'mongoose';

const bookingSchema = new mongoose.Schema({
    customerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Customer',
        required: true
    },
    company: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company',
        required: true
    },
    employeeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee', // 👈 Points to Employee model
        required: true
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Employee",
        default: null
    },
    isOnBehalf: {
        type: Boolean,
        default: false
    },
    transactionIds: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Transaction'
    }],
    yachtId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Yacht', // 👈 Points to Yacht model
        required: true
    },
    date: {
        type: Date,
        required: true
    },
    duration: {
        type: String,
        // required: true,
        match: [/^(?:[01]\d|2[0-3]):[0-5]\d$/, 'Time must be in HH:MM format']
        // Example: "14:30" (24-hour format)
    },
    startTime: {
        type: String,
        required: true,
        match: [/^(?:[01]\d|2[0-3]):[0-5]\d$/, 'Start Time must be in HH:MM format']
    },
    endTime: {
        type: String,
        required: true,
        match: [/^(?:[01]\d|2[0-3]):[0-5]\d$/, 'End Time must be in HH:MM format']
    },
    quotedAmount: {
        type: Number,
        required: true,
        min: 0
    },
    pendingAmount: {
        type: Number,
        min: 0
    },
    status: {
        type: String,
        enum: ['pending', 'confirmed', 'cancelled'],
    },
    tripStatus: {
        type: String,
        enum: ['pending', 'initiated', 'success', 'cancelled'],
    },
    numPeople: {
        type: Number,
        min: 0,
        required: true
    },
    extraDetails: {
        type: String,
    },
    ticketNo: {
        type: String,
        unique: true,
        sparse: true,
        length: 5,
        uppercase: true,
        index: true
    }

}, {
    timestamps: true,
    strictPopulate: false
});

export const BookingModel = mongoose.model('Booking', bookingSchema);
