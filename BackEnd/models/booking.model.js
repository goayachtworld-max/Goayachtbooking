// src/models/booking.model.js
import mongoose from 'mongoose';

const bookingSchema = new mongoose.Schema({
    customerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Customer',
        required: true
    },
    company: {
        type: String,
        required: true
    },
    employeeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee', // 👈 Points to Employee model
        required: true
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
        enum: ['initiated', 'inprogress', 'success', 'terminated'],
        default: 'initiated'
    },
    numPeople: {
        type: Number,
        min: 0,
        required : true
    }
}, {
    timestamps: true,
    strictPopulate: false 
});

export const BookingModel = mongoose.model('Booking', bookingSchema);
