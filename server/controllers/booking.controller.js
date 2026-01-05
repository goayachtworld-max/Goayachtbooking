import { BookingModel } from "../models/booking.model.js";
import { CustomerModel } from "../models/customer.model.js";
import { AvailabilityModel } from "../models/availability.model.js";
import { checkSlotAvailability } from "./availability.controller.js";
import { sendEmail } from "../utils/sendEmail.js";
import { YachtModel } from "../models/yacht.model.js";
import { sendNotification } from "../services/notification.service.js";

export const createBooking = async (req, res, next) => {
  try {
    console.log("In Booking", req.body);

    const { yachtId, date, startTime, endTime, customerId, quotedAmount, numPeople } = req.body;
    const employeeId = req.user.id;
    console.log("User type : ", req.user.type)

    // 1️⃣ Fetch the yacht
    const yacht = await YachtModel.findById(yachtId).select("_id company");
    if (!yacht) {
      return res.status(404).json({ success: false, message: "Yacht not found" });
    }

    // ✅ Assign company from yacht
    const companyId = yacht.company;
    // ✅ 0️⃣ determine booking status by role
    let bookingStatus = "pending";
    let tripS = "pending";

    if (
      req.user.type === "admin" ||
      req.user.type === "staff" ||
      req.user.type === "onsite"
    ) {
      bookingStatus = "confirmed";
      tripS = "initiated";
    }

    // 1️⃣ determine trip end datetime 
    const [year, month, day] = date.split("-");
    const [endHour, endMinute] = endTime.split(":");
    const tripEnd = new Date(year, month - 1, day, endHour, endMinute);

    // 2️⃣ check slot availability 
    const { available, conflictSlot, reason } = await checkSlotAvailability({
      yachtId,
      date,
      startTime,
      endTime,
      employeeId,
    });

    if (!available) {
      return res.status(400).json({ success: false, message: reason });
    }

    // 3️⃣ create booking
    const booking = await BookingModel.create({
      ...req.body,
      employeeId,
      company: companyId,
      pendingAmount: quotedAmount,
      status: bookingStatus,
      tripStatus: tripS,
    });
    console.log(booking)

    // 4️⃣ update customer 
    await CustomerModel.findByIdAndUpdate(
      booking.customerId,
      { bookingId: booking._id },
      { new: true }
    );

    // 5️⃣ update availability slot
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

    if (booking.status === "pending" && req.user.type === "backdesk") {
      await sendNotification({
        company: companyId,
        roles: ["admin", "onsite"],
        title: "New Booking Pending",
        message: "A booking created by backdesk is awaiting approval.",
        type: "booking_created",
        bookingId: booking._id,
        excludeUserId: req.user.id,
      });
      console.log("Notification send - Create booking")
    }

    res.status(201).json({ success: true, booking });
  } catch (error) {
    console.error("Booking creation error:", error);
    next(error);
  }
};

export const updateBooking = async (req, res, next) => {
  try {
    const { transactionId, amount, status } = req.body;
    const bookingId = req.params.id;

    if (!transactionId) {
      return res.status(400).json({ error: "transactionId is required" });
    }

    const booking = await BookingModel.findById(bookingId);
    if (!booking) return res.status(404).json({ error: "Booking not found" });

    // ----------------------------
    // ✅ determine tripStatus
    let tripStatus = booking.tripStatus;

    if (status === "cancelled") {
      tripStatus = "cancelled";
    } else if (status === "confirmed") {
      const bookingEnd = new Date(`${booking.date.toISOString().split("T")[0]}T${booking.endTime}`);
      tripStatus = bookingEnd < new Date() ? "success" : "initiated";
    }


    const updatedBooking = await BookingModel.findByIdAndUpdate(
      bookingId,
      {
        $push: { transactionId },
        pendingAmount: Math.max(booking.pendingAmount - amount, 0),
        ...(status && { status }),
        tripStatus, // ✅ synced
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
      .populate("yachtId", "name")
      .populate("customerId", "name contact email")
      .populate("employeeId", "name type")
      .sort({ date: 1, startTime: 1 });

    // ⏱ AUTO UPDATE tripStatus (response level)
    const now = new Date();
    const updatedBookings = bookings.map((b) => {
      const bookingEnd = new Date(`${b.date.toISOString().split("T")[0]}T${b.endTime}`);

      let tripStatus = b.tripStatus;
      if (b.status === "cancelled") tripStatus = "cancelled";
      else if (b.status === "confirmed" && bookingEnd < now) tripStatus = "success";
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
    const booking = await BookingModel.findById(req.params.id)
      .populate("customerId employeeId transactionId");

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
