import { BookingModel } from "../models/booking.model.js";
import { CustomerModel } from "../models/customer.model.js";
import { AvailabilityModel } from "../models/availability.model.js";
import { checkSlotAvailability } from "./availability.controller.js";
import { sendEmail } from "../utils/sendEmail.js";
import { YachtModel } from "../models/yacht.model.js";
import { sendNotification } from "../services/notification.service.js";
import { EmployeeModel } from "../models/employee.model.js";

export const createBooking = async (req, res, next) => {
  try {
    const {
      yachtId,
      date,
      startTime,
      endTime,
      customerId,
      quotedAmount,
      numPeople,
      onBehalfEmployeeId,
      extraDetails,
      tokenAmount,
      bookingStatus: incomingBookingStatus,
      sailingHours,
      anchoringHours,
      calculatedAmount,
    } = req.body;

    console.log("inc booking body : ", req.body);
    console.log("incomingBookingStatus:", incomingBookingStatus);
    const loggedInEmployeeId = req.user.id;
    let employeeId = loggedInEmployeeId;
    let createdBy = null;
    let isOnBehalf = false;

    // 1️⃣ Fetch yacht
    const yacht = await YachtModel.findById(yachtId).select("_id company name");
    if (!yacht) {
      return res.status(404).json({ success: false, message: "Yacht not found" });
    }

    console.log("Yacht", yacht);
    const companyId = yacht.company;

    // 2️⃣ Handle on-behalf logic (ADMIN ONLY)
    if (
      req.user.type === "admin" &&
      onBehalfEmployeeId &&
      onBehalfEmployeeId !== loggedInEmployeeId
    ) {
      const targetEmployee = await EmployeeModel.findOne({
        _id: onBehalfEmployeeId,
        company: companyId,
      });

      if (!targetEmployee) {
        return res.status(403).json({
          success: false,
          message: "Invalid employee selected",
        });
      }

      createdBy = loggedInEmployeeId;
      employeeId = onBehalfEmployeeId;
      isOnBehalf = true;

      console.log("On behalf of", isOnBehalf);
    }

    // 3️⃣ Booking & trip status
    let bookingStatus = "pending";
    let tripStatus = "pending";

    if (req.user.type === "admin") {
      bookingStatus =
        incomingBookingStatus === "confirmed" ? "confirmed" : "pending";
      tripStatus = bookingStatus === "confirmed" ? "initiated" : "pending";
    } else if (["staff", "onsite"].includes(req.user.type)) {
      bookingStatus = "confirmed";
      tripStatus = "initiated";
    }

    // 4️⃣ Trip end datetime
    const [year, month, day] = date.split("-");
    const [endHour, endMinute] = endTime.split(":");
    const tripEnd = new Date(year, month - 1, day, endHour, endMinute);

    console.log("Before avail");
    // 5️⃣ Slot availability (NOW correct employeeId)
    const { available, conflictSlot, reason } = await checkSlotAvailability({
      yachtId,
      date,
      startTime,
      endTime,
      employeeId,
      userType: req.user.type,
    });

    if (!available) {
      return res.status(400).json({ success: false, message: reason });
    }
    console.log("avail ", available);

    // 6️⃣ Create booking
    const booking = await BookingModel.create({
      customerId,
      employeeId,
      createdBy,
      isOnBehalf,
      yachtId,
      company: companyId,
      date,
      startTime,
      endTime,
      quotedAmount,
      pendingAmount: quotedAmount,
      status: bookingStatus,
      tripStatus,
      numPeople,
      extraDetails,
      ...(tokenAmount && { tokenAmount: Number(tokenAmount) }),
      ...(sailingHours != null && { sailingHours: Number(sailingHours) }),
      ...(anchoringHours != null && { anchoringHours: Number(anchoringHours) }),
      ...(calculatedAmount != null && { calculatedAmount: Number(calculatedAmount) }),
    });
    console.log("booking", booking);

    // 7️⃣ Update availability
    if (conflictSlot) {
      conflictSlot.status = "booked";
      conflictSlot.appliedBy = employeeId;
      conflictSlot.bookingId = booking._id;
      conflictSlot.deleteAfter = tripEnd;
      await conflictSlot.save();
    } else {
      await AvailabilityModel.create({
        yachtId,
        date,
        startTime,
        endTime,
        status: "booked",
        appliedBy: employeeId,
        bookingId: booking._id,
        deleteAfter: tripEnd,
      });
    }

    let roles;
    let title;
    if (bookingStatus === "confirmed") {
      roles = ["onsite"];
      title = "Booking CONFIRMED";
    } else {
      roles = ["admin", "onsite"];
      title = "Booking PENDING";
    }

    await sendNotification({
      company: companyId,
      roles: roles,
      title: title,
      message: `${yacht.name}\n${date} ${startTime} – ${endTime}`,
      type: "booking_created",
      bookingId: booking._id,
      excludeUserId: req.user.id,
    });

    console.log("booking : ", booking);
    res.status(201).json({ success: true, booking });
  } catch (err) {
    console.error("Create booking error:", err);
    next(err);
  }
};

// Used for updating status
export const updateBooking = async (req, res, next) => {
  try {
    const { transactionId, amount, status } = req.body;
    const bookingId = req.params.id;

    if (!transactionId) {
      return res.status(400).json({ error: "transactionId is required" });
    }

    const booking = await BookingModel.findById(bookingId);
    if (!booking) return res.status(404).json({ error: "Booking not found" });

    // ✅ determine tripStatus
    let tripStatus = booking.tripStatus;

    if (status === "cancelled") {
      tripStatus = "cancelled";
    } else if (status === "confirmed") {
      const bookingEnd = new Date(
        `${booking.date.toISOString().split("T")[0]}T${booking.endTime}`
      );
      tripStatus = bookingEnd < new Date() ? "success" : "initiated";
    }

    const updatedBooking = await BookingModel.findByIdAndUpdate(
      bookingId,
      {
        $push: { transactionId },
        pendingAmount: Math.max(booking.pendingAmount - amount, 0),
        ...(status && { status }),
        tripStatus,
      },
      { new: true }
    ).populate("customerId employeeId transactionId");

    return res.status(200).json(updatedBooking);
  } catch (error) {
    next(error);
  }
};

export const getBookings = async (req, res) => {
  try {
    const { date, status, employeeId: filterEmployee } = req.query;

    const { company, id: loggedInEmployeeId, type } = req.user;

    const filter = { company };

    // 📅 DATE FILTER
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (date) {
      const start = new Date(date);
      const end = new Date(date);
      end.setDate(end.getDate() + 1);
      filter.date = { $gte: start, $lt: end };
    } else {
      filter.date = { $gte: today };
    }

    // 📌 STATUS FILTER
    if (status) {
      filter.status = status;
    }

    // EMPLOYEE FILTER
    if (filterEmployee) filter.employeeId = filterEmployee;

    // 🔐 ROLE-BASED ACCESS CONTROL
    if (type === "backdesk") {
      filter.employeeId = loggedInEmployeeId;
    }

    const bookings = await BookingModel.find(filter)
      .populate("yachtId", "name boardingLocation")
      .populate("customerId", "name contact email alternateContact")
      .populate("employeeId", "name type")
      .populate("company", "name disclaimer")
      .populate("transactionIds")
      .sort({ date: 1, startTime: 1 });

    // ⏱ AUTO UPDATE tripStatus (response level)
    const now = new Date();
    const updatedBookings = bookings.map((b) => {
      const bookingEnd = new Date(
        `${b.date.toISOString().split("T")[0]}T${b.endTime}`
      );

      let tripStatus = b.tripStatus;
      if (b.status === "cancelled") tripStatus = "cancelled";
      else if (b.status === "confirmed" && bookingEnd < now)
        tripStatus = "success";
      else if (b.status === "confirmed") tripStatus = "initiated";
      else tripStatus = "pending";

      return {
        ...b.toObject(),
        tripStatus,
      };
    });

    res.json({ success: true, bookings: updatedBookings });
  } catch (error) {
    console.error("❌ Error fetching bookings:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getBookingById = async (req, res) => {
  try {
    const booking = await BookingModel.findById(req.params.id).populate(
      "customerId employeeId transactionId"
    );

    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }

    // 🔐 Backdesk access restriction
    if (
      req.user.type === "backdesk" &&
      booking.employeeId._id.toString() !== req.user.id
    ) {
      return res.status(403).json({
        error: "You are not allowed to view this booking",
      });
    }

    res.json(booking);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getPublicBookingByTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const ticketNo = id;
    console.log("tkt : ", ticketNo);
    if (!ticketNo || ticketNo.length !== 5) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid ticket number" });
    }

    const ticket = ticketNo.toUpperCase();
    console.log("Searching ticket:", ticket);

    // 1️⃣ Try new system (FAST)
    let booking = await BookingModel.findOne({ ticketNo: ticket })
      .populate("yachtId", "name boardingLocation")
      .populate("company : ", "name disclaimer")
      .populate("customerId", "name contact email alternateContact")
      .populate("employeeId", "name type");

    if (booking) {
      return res.json({ success: true, booking });
    }

    // 2️⃣ Fallback for old bookings
    const fallback = await BookingModel.aggregate([
      { $addFields: { idStr: { $toString: "$_id" } } },
      { $match: { idStr: { $regex: `${ticket}$`, $options: "i" } } },
      { $limit: 1 },
    ]);

    if (!fallback.length) {
      return res
        .status(404)
        .json({ success: false, message: "Booking not found" });
    }

    booking = await BookingModel.findById(fallback[0]._id)
      .populate("yachtId", "name boardingLocation")
      .populate("company : ", "name disclaimer")
      .populate("customerId", "name contact email alternateContact")
      .populate("employeeId", "name type");

    if (!booking) {
      return res
        .status(404)
        .json({ success: false, message: "Booking not found" });
    }

    console.log("Fallback booking found:", booking._id);

    res.json({ success: true, booking });
  } catch (err) {
    console.error("Error in getPublicBookingByTicket:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Used to update YachtRelatedInfo
export const updateBookingYachtInfo = async (req, res, next) => {
  try {
    const { bookingId } = req.params;
    const { yachtId, date, startTime, endTime } = req.body;

    // 1️⃣ Fetch booking
    const booking = await BookingModel.findById(bookingId);
    if (!booking) {
      return res
        .status(404)
        .json({ success: false, message: "Booking not found" });
    }

    // 2️⃣ Fetch yacht
    const yacht = await YachtModel.findById(yachtId).select("_id company name");
    if (!yacht) {
      return res
        .status(404)
        .json({ success: false, message: "Yacht not found" });
    }

    // 3️⃣ Permission check (basic)
    if (
      req.user.type !== "admin" &&
      booking.employeeId.toString() !== req.user.id
    ) {
      return res
        .status(403)
        .json({ success: false, message: "Unauthorized" });
    }

    // 4️⃣ Trip end datetime
    const [year, month, day] = date.split("-");
    const [endHour, endMinute] = endTime.split(":");
    const tripEnd = new Date(year, month - 1, day, endHour, endMinute);

    // 5️⃣ Check slot availability (ignore current booking)
    const { available, conflictSlot, reason } = await checkSlotAvailability({
      yachtId,
      date,
      startTime,
      endTime,
      employeeId: booking.employeeId,
      ignoreBookingId: booking._id,
    });

    if (!available) {
      return res.status(400).json({ success: false, message: reason });
    }

    // 6️⃣ Remove old availability slot
    await AvailabilityModel.findOneAndDelete({
      bookingId: booking._id,
    });

    // 7️⃣ Update booking
    booking.yachtId = yachtId;
    booking.company = yacht.company;
    booking.date = date;
    booking.startTime = startTime;
    booking.endTime = endTime;

    await booking.save();

    // 8️⃣ Create or update new availability slot
    if (conflictSlot) {
      conflictSlot.status = "booked";
      conflictSlot.appliedBy = booking.employeeId;
      conflictSlot.bookingId = booking._id;
      conflictSlot.deleteAfter = tripEnd;
      await conflictSlot.save();
    } else {
      await AvailabilityModel.create({
        yachtId,
        date,
        startTime,
        endTime,
        status: "booked",
        appliedBy: booking.employeeId,
        bookingId: booking._id,
        deleteAfter: tripEnd,
      });
    }

    res.status(200).json({
      success: true,
      message: "Booking updated successfully",
      booking,
    });
  } catch (err) {
    console.error("Update booking error:", err);
    next(err);
  }
};

export const updateBookingExtraDetails = async (req, res, next) => {
  try {
    const { bookingId } = req.params;
    const { extraDetails, numPeople } = req.body;

    console.log("Extra update is called");

    if (extraDetails === undefined && numPeople === undefined) {
      return res
        .status(400)
        .json({ success: false, message: "Extra details or PAX required" });
    }

    // 1️⃣ Fetch booking
    const booking = await BookingModel.findById(bookingId);
    if (!booking) {
      return res
        .status(404)
        .json({ success: false, message: "Booking not found" });
    }

    if (extraDetails !== undefined) booking.extraDetails = extraDetails;
    if (numPeople !== undefined) booking.numPeople = Number(numPeople);
    await booking.save();

    res.status(200).json({
      success: true,
      message: "Extra details updated successfully",
      booking,
    });
  } catch (err) {
    console.error("Update extra details error:", err);
    next(err);
  }
};

// -------------------------
// Admin-only: Update Booking Amounts
// PATCH /bookings/:bookingId/amounts
// -------------------------
export const updateBookingAmounts = async (req, res, next) => {
  try {
    const { bookingId } = req.params;

    // 1️⃣ Admin only guard
    if (req.user.type !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admin can update booking amounts",
      });
    }

    const { quotedAmount, tokenAmount } = req.body;

    // 2️⃣ At least one field must be provided
    if (quotedAmount === undefined && tokenAmount === undefined) {
      return res.status(400).json({
        success: false,
        message: "Provide at least quotedAmount or tokenAmount to update",
      });
    }

    // 3️⃣ Validate values if provided
    if (quotedAmount !== undefined && Number(quotedAmount) <= 0) {
      return res.status(400).json({
        success: false,
        message: "quotedAmount must be greater than 0",
      });
    }

    if (tokenAmount !== undefined && Number(tokenAmount) < 0) {
      return res.status(400).json({
        success: false,
        message: "tokenAmount cannot be negative",
      });
    }

    // 4️⃣ Fetch booking with transactions
    const booking = await BookingModel.findById(bookingId).populate(
      "transactionIds"
    );

    if (!booking) {
      return res
        .status(404)
        .json({ success: false, message: "Booking not found" });
    }

    // 5️⃣ Block edit if cancelled
    if (booking.status === "cancelled") {
      return res.status(400).json({
        success: false,
        message: "Cannot update amounts for a cancelled booking",
      });
    }

    // 6️⃣ Calculate totalPaid from existing transactions
    const totalPaid = booking.transactionIds.reduce((sum, txn) => {
      return sum + (txn.amount || 0);
    }, 0);

    // 7️⃣ If quotedAmount is being changed, recalculate pendingAmount
    if (quotedAmount !== undefined) {
      const newQuotedAmount = Number(quotedAmount);

      // Cannot set quotedAmount less than what's already paid
      if (newQuotedAmount < totalPaid) {
        return res.status(400).json({
          success: false,
          message: `quotedAmount cannot be less than total already paid (₹${totalPaid})`,
        });
      }

      booking.quotedAmount = newQuotedAmount;
      booking.pendingAmount = newQuotedAmount - totalPaid;
    }

    // 8️⃣ Update tokenAmount independently (just a reference target, no recalculation)
    if (tokenAmount !== undefined) {
      booking.tokenAmount = Number(tokenAmount);
    }

    await booking.save();

    // 9️⃣ Return fully populated booking
    const updatedBooking = await BookingModel.findById(bookingId)
      .populate("customerId", "name contact email")
      .populate("employeeId", "name type")
      .populate("transactionIds")
      .populate("yachtId", "name")
      .populate("company", "name");

    return res.status(200).json({
      success: true,
      message: "Booking amounts updated successfully",
      totalPaid,
      booking: updatedBooking,
    });
  } catch (err) {
    console.error("updateBookingAmounts error:", err);
    next(err);
  }
};
// ─────────────────────────────────────────────────────────────────────────────
// GET /bookings/past  — past bookings for the Reports page
//   Query params:
//     startDate  YYYY-MM-DD  (default: 30 days ago)
//     endDate    YYYY-MM-DD  (default: yesterday)
//     status     pending | confirmed | cancelled
//     yachtId    ObjectId
// ─────────────────────────────────────────────────────────────────────────────
export const getPastBookings = async (req, res) => {
  try {
    const { startDate, endDate, status, yachtId } = req.query;
    const { company, id: loggedInEmployeeId, type } = req.user;

    // Build date range — default last 30 days, no upper cap (future dates allowed)
    const defaultStart = new Date();
    defaultStart.setDate(defaultStart.getDate() - 30);
    defaultStart.setHours(0, 0, 0, 0);

    const from = startDate ? new Date(startDate) : defaultStart;

    const dateFilter = { $gte: from };
    if (endDate) {
      const to = new Date(endDate);
      to.setDate(to.getDate() + 1); // inclusive
      dateFilter.$lt = to;
    }

    const filter = {
      company,
      date: dateFilter,
    };

    if (status) filter.status = status;
    if (yachtId) filter.yachtId = yachtId;

    // Backdesk only sees their own bookings
    if (type === "backdesk") {
      filter.employeeId = loggedInEmployeeId;
    }

    const bookings = await BookingModel.find(filter)
      .populate("yachtId", "name boardingLocation runningCost")
      .populate("customerId", "name contact email alternateContact")
      .populate("employeeId", "name type")
      .populate("company", "name disclaimer")
      .populate("transactionIds")
      .sort({ date: -1, startTime: -1 }); // newest first for reports

    // Derive tripStatus at response time (same logic as getBookings)
    const nowMs = Date.now();
    const result = bookings.map((b) => {
      const bookingEnd = new Date(`${b.date.toISOString().split("T")[0]}T${b.endTime}+05:30`);
      let tripStatus;
      if (b.status === "cancelled")                            tripStatus = "cancelled";
      else if (b.status === "confirmed" && bookingEnd < nowMs) tripStatus = "success";
      else if (b.status === "confirmed")                       tripStatus = "initiated";
      else                                                     tripStatus = "pending";

      return { ...b.toObject(), tripStatus };
    });

    res.json({ success: true, bookings: result, total: result.length });
  } catch (error) {
    console.error("❌ Error fetching past bookings:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
// -------------------------
// Settle / Un-settle a booking (Reports page)
// PATCH /bookings/:bookingId/settle
// Body: { settledAmount: number } to settle, or { settledAmount: null } to unsettle
// -------------------------
export const settleBooking = async (req, res, next) => {
  try {
    const { bookingId } = req.params;
    const { settledAmount } = req.body;

    const booking = await BookingModel.findById(bookingId);
    if (!booking) return res.status(404).json({ success: false, message: "Booking not found" });

    if (settledAmount === null || settledAmount === undefined) {
      // Un-settle
      booking.settledAmount = null;
    } else {
      const amt = Number(settledAmount);
      if (isNaN(amt) || amt < 0) return res.status(400).json({ success: false, message: "Invalid amount" });
      booking.settledAmount = amt;
    }

    await booking.save();
    res.json({ success: true, booking });
  } catch (err) {
    next(err);
  }
};