import mongoose from "mongoose";
import { TransactionModel } from "../models/transaction.model.js";
import { BookingModel } from "../models/booking.model.js";
import { deleteAvailabilityForBooking } from "./availability.controller.js";
import { EmployeeModel } from "../models/employee.model.js";
import { sendNotification } from "../services/notification.service.js";


// export const createTransactionAndUpdateBooking = async (req, res, next) => {
//   const session = await mongoose.startSession();
//   session.startTransaction();

//   try {
//     const employeeId = req.user.id; // from token
//     const { bookingId, type, amount, paymentProof, status } = req.body;
//     // if(req.user.type === "backdesk"){
//     //   throw new Error("Not allowed to Update Booking")
//     // }

//     // Step 1: Create Transaction
//     let transaction = null;
//     if (amount > 0) {
//       transaction = await TransactionModel.create(
//         [{
//           bookingId,
//           type,
//           employeeId,
//           amount,
//           paymentProof: req.cloudinaryUrl || paymentProof,
//           date: new Date().toISOString()
//         }],
//         { session }
//       );
//     }

//     // Step 2: Update Booking
//     const booking = await BookingModel.findById(bookingId).session(session);

//     if (!booking) {
//       throw new Error("Booking not found");
//     }

//     const updatedPendingAmount = booking.pendingAmount - amount;
//     if (updatedPendingAmount < 0) {
//       throw new Error("Amount cannot exceed pending amount");
//     }

//     if (status) {
//       booking.status = status;
//     }
//     booking.pendingAmount = updatedPendingAmount;
//     if (transaction != null)
//       booking.transactionIds.push(transaction[0]._id);

//     await booking.save({ session });

//     if (booking.status === "cancelled") {
//       await deleteAvailabilityForBooking(booking, session);
//     }



//     // Step 3: Populate customer, employee, and transactions
//     const populatedBooking = await BookingModel.findById(booking._id)
//       .populate("customerId")   // get full customer details
//       .populate("employeeId")   // get employee details
//       .populate("transactionIds") // get all transactions
//       .session(session);

//     // Step 4: Commit Transaction
//     await session.commitTransaction();
//     session.endSession();

//     // ✅ Notify ONLY if booking was created by backdesk (agent)
//     const bookingCreator = await EmployeeModel.findById(
//       booking.employeeId
//     ).select("type");

//     if (
//       status &&
//       bookingCreator?.type === "backdesk" &&
//       (req.user.type === "admin" || req.user.type === "onsite")
//     ) {
//       await sendNotification({
//         company: req.user.company,
//         roles: ["backdesk"], // 👈 only agent needs this info
//         title: `Booking ${status.toUpperCase()}`,
//         message: `Your booking has been ${status} by ${req.user.type}.`,
//         type: "booking_status_updated",
//         bookingId: booking._id,
//         excludeUserId: req.user.id,
//       });
//     }


//     console.log("Booking after update Tras : ", populatedBooking)
//     // Step 5: Send populated booking to frontend
//     res.status(201).json({
//       success: true,
//       message: "Transaction created & booking updated successfully",
//       transaction: transaction ? transaction[0] : null,
//       booking: populatedBooking,
//     });

//   } catch (error) {
//     await session.abortTransaction();
//     session.endSession();
//     next(error);
//   }
// };

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
      ).select("type");

      if (
        bookingCreator?.type === "backdesk" &&
        (req.user.type === "admin" || req.user.type === "onsite")
      ) {
        await sendNotification({
          company: req.user.company,
          roles: ["backdesk"],
          title: `Booking ${incStatus.toUpperCase()}`,
          message: `Your booking has been ${incStatus} by ${req.user.type}.`,
          type: "booking_status_updated",
          bookingId: populatedBooking._id,
          excludeUserId: req.user.id,
        });
      }
    }
  } catch (notifyError) {
    console.error("⚠️ Notification error:", notifyError.message);
    // Notification failure should NOT break API success
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
