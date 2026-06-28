// src/models/demand.model.js
import mongoose from 'mongoose';

const demandSchema = new mongoose.Schema({
    customerName: {
        type: String,
        trim: true,
        default: null
    },
    customerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Customer',
        default: null
    },
    agentName: {
        type: String,
        trim: true,
        default: null
    },
    agentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        default: null
    },
    yachtName: {
        type: String,
        trim: true,
        default: null
    },
    yachtId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Yacht',
        default: null
    },
    date: {
        type: Date,
        required: true
    },
    time: {
        type: String,
        required: true,
        match: [/^(?:[01]\d|2[0-3]):[0-5]\d$/, 'Time must be in HH:MM format']
    },
    notes: {
        type: String,
        trim: true,
        default: null
    },
    company: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company',
        required: true
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'confirmed', 'completed', 'cancelled'],
        default: 'pending'
    }
}, {
    timestamps: true,
    strictPopulate: false
});

export const DemandModel = mongoose.model('Demand', demandSchema);