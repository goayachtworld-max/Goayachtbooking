import mongoose from "mongoose";
import { TransactionModel } from "../models/transaction.model.js";
import { BookingModel } from "../models/booking.model.js";
import { deleteAvailabilityForBooking } from "./availability.controller.js";
import { EmployeeModel } from "../models/employee.model.js";
import { sendNotification } from "../services/notification.service.js";


export const createTransactionAndUpdateBooking = async (req, res, next) => {
  const session = await mongoose.startSession();

  let transaction = null;
  let populatedBooking = null;

  const { bookingId, type, amount, paymentProof, status } = req.body;
  const incStatus = req.body.status;
  try {
    session.startTransaction();

    const employeeId = req.user.id;
    // -----------------------------
    // 1️⃣ CREATE TRANSACTION
    // -----------------------------
    if (amount > 0) {
      const created = await TransactionModel.create(
        [
          {
            bookingId,
            type,
            employeeId,
            amount,
            paymentProof: req.cloudinaryUrl || paymentProof,
            date: new Date().toISOString(),
          },
        ],
        { session }
      );

      transaction = created[0];
    }

    // -----------------------------
    // 2️⃣ UPDATE BOOKING
    // -----------------------------
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

    if (transaction) {
      booking.transactionIds.push(transaction._id);
    }

    await booking.save({ session });

    // -----------------------------
    // 3️⃣ DELETE AVAILABILITY IF CANCELLED
    // -----------------------------
    if (booking.status === "cancelled") {
      await deleteAvailabilityForBooking(booking, session);
    }

    // -----------------------------
    // 4️⃣ POPULATE BOOKING
    // -----------------------------
    populatedBooking = await BookingModel.findById(booking._id)
      .populate("customerId")
      .populate("employeeId")
      .populate("transactionIds")
      .populate("company")
      .populate("yachtId")
      .session(session);

    // -----------------------------
    // 5️⃣ COMMIT TRANSACTION
    // -----------------------------
    await session.commitTransaction();
    session.endSession();

  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    session.endSession();
    return next(error);
  }

  // ====================================================
  // 🚫 OUTSIDE TRANSACTION (SIDE EFFECTS ONLY)
  // ====================================================
  try {
    if (incStatus) {
      const bookingCreator = await EmployeeModel.findById(
        populatedBooking.employeeId
      ).select("type name");

      if (
        bookingCreator?.type === "backdesk" &&
        (req.user.type === "admin" || req.user.type === "onsite")
      ) {
        let formattedUserType = "Admin"
        if(req.user.type === "onsite"){
          formattedUserType = "Staff"
        }
        const date = new Date(populatedBooking.date);
        const formattedDate = date.toISOString().split('T')[0];
        await sendNotification({
          company: populatedBooking.company,
          roles: ["onsite"],
          recipientUserId: bookingCreator._id,
          title: `Booking ${incStatus.toUpperCase()}`,
          message: `${populatedBooking.yachtId.name}
${formattedDate} ${populatedBooking.startTime} – ${populatedBooking.endTime}`,
          type: "booking_status_updated",
          bookingId: populatedBooking._id,
          excludeUserId: req.user.id,
        });

      }
    }
  } catch (notifyError) {
    console.error("⚠️ Notification error:", notifyError.message);
  }

  // -----------------------------
  // 6️⃣ SEND RESPONSE
  // -----------------------------
  return res.status(201).json({
    success: true,
    message: "Transaction created & booking updated successfully",
    transaction,
    booking: populatedBooking,
  });
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

export const updateTransaction = async (req, res, next) => {
  console.log("🔵 [updateTransaction] HIT — params:", req.params, "body:", req.body);
  try {
    const { id } = req.params;
    const { amount: newAmount } = req.body;

    console.log("🔵 [updateTransaction] id:", id, "newAmount:", newAmount, "type:", typeof newAmount);

    if (newAmount === undefined || newAmount === null || Number(newAmount) < 0) {
      console.log("🔴 [updateTransaction] Invalid amount — rejected");
      return res.status(400).json({ error: "Invalid amount" });
    }

    // 1️⃣ Fetch transaction
    const transaction = await TransactionModel.findById(id);
    console.log("🔵 [updateTransaction] transaction found:", transaction ? `id=${transaction._id} amount=${transaction.amount}` : "NULL");
    if (!transaction) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    const oldAmount = transaction.amount;
    const diff = Number(newAmount) - oldAmount;
    console.log("🔵 [updateTransaction] oldAmount:", oldAmount, "diff:", diff);

    // 2️⃣ Fetch booking
    const booking = await BookingModel.findById(transaction.bookingId);
    console.log("🔵 [updateTransaction] booking found:", booking ? `id=${booking._id} pendingAmount=${booking.pendingAmount}` : "NULL");
    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }

    const newPending = booking.pendingAmount - diff;
    console.log("🔵 [updateTransaction] newPending will be:", newPending);
    if (newPending < 0) {
      console.log("🔴 [updateTransaction] Would exceed quoted — rejected");
      return res.status(400).json({ error: "Edited amount would exceed the quoted amount" });
    }

    // 3️⃣ Save transaction
    transaction.amount = Number(newAmount);
    const savedTxn = await transaction.save();
    console.log("✅ [updateTransaction] transaction saved — new amount:", savedTxn.amount);

    // 4️⃣ Update booking
    const updatedBooking = await BookingModel.findByIdAndUpdate(
      transaction.bookingId,
      { $inc: { pendingAmount: -diff } },
      { new: true }
    );
    console.log("✅ [updateTransaction] booking updated — new pendingAmount:", updatedBooking?.pendingAmount);

    return res.status(200).json({
      success: true,
      message: "Transaction updated successfully",
      transaction: savedTxn,
      newPendingAmount: updatedBooking?.pendingAmount,
    });

  } catch (error) {
    console.log("🔴 [updateTransaction] CAUGHT ERROR:", error.message, error.stack);
    return next(error);
  }
};