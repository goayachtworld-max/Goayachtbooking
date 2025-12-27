import mongoose from "mongoose";
import { TransactionModel } from "../models/transaction.model.js";
import { BookingModel } from "../models/booking.model.js";
import { deleteAvailabilityForBooking } from "./availability.controller.js";

export const createTransactionAndUpdateBooking = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const employeeId = req.user.id; // from token
    const { bookingId, type, amount, paymentProof, status } = req.body;
    // if(req.user.type === "backdesk"){
    //   throw new Error("Not allowed to Update Booking")
    // }

    // Step 1: Create Transaction
    let transaction = null;
    if (amount > 0) {
      transaction = await TransactionModel.create(
        [{
          bookingId,
          type,
          employeeId,
          amount,
          paymentProof: req.cloudinaryUrl || paymentProof,
          date: new Date().toISOString()
        }],
        { session }
      );
    }

    // Step 2: Update Booking
    const booking = await BookingModel.findById(bookingId).session(session);

    if (!booking) {
      throw new Error("Booking not found");
    }

    const updatedPendingAmount = booking.pendingAmount - amount;
    if (updatedPendingAmount < 0) {
      throw new Error("Amount cannot exceed pending amount");
    }

    if (status) {
      booking.status = status;
    }
    booking.pendingAmount = updatedPendingAmount;
    if (transaction != null)
      booking.transactionIds.push(transaction[0]._id);

    await booking.save({ session });

    if (booking.status === "cancelled") {
      await deleteAvailabilityForBooking(booking, session);
    }

    // Step 3: Populate customer, employee, and transactions
    const populatedBooking = await BookingModel.findById(booking._id)
      .populate("customerId")   // get full customer details
      .populate("employeeId")   // get employee details
      .populate("transactionIds") // get all transactions
      .session(session);

    // Step 4: Commit Transaction
    await session.commitTransaction();
    session.endSession();

    console.log("Booking after update Tras : ", populatedBooking)
    // Step 5: Send populated booking to frontend
    res.status(201).json({
      success: true,
      message: "Transaction created & booking updated successfully",
      transaction: transaction ? transaction[0] : null,
      booking: populatedBooking,
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    next(error);
  }
};


export const createTransaction = async (req, res, next) => {
  try {
    const employeeId = req.user.id; // ✅ take employeeId from authMiddleware token
    const { bookingId, amount, type, paymentProof } = req.body;

    // ✅ Create Transaction
    const transaction = await TransactionModel.create({
      bookingId,
      type,
      amount,
      paymentProof: req.cloudinaryUrl || paymentProof,
      employeeId,
      date: new Date(),
    });

    // ✅ Update Booking pending amount + add transaction reference
    const updatedBooking = await BookingModel.findByIdAndUpdate(
      bookingId,
      {
        $push: { transactionIds: transaction._id },
        $inc: { pendingAmount: -amount },
      },
      { new: true }
    ).populate("customerId employeeId transactionIds");

    res.status(201).json({
      success: true,
      transaction,
      updatedBooking,
    });
  } catch (error) {
    next(error);
  }
};

export const getTransactions = async (req, res) => {
  try {
    const transactions = await TransactionModel.find().populate("employeeId");
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getTransactionById = async (req, res) => {
  try {
    const transaction = await TransactionModel.findById(req.params.id).populate("employeeId");
    if (!transaction) return res.status(404).json({ error: "Transaction not found" });
    res.json(transaction);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
