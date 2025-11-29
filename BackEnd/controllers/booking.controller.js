import { BookingModel } from "../models/booking.model.js";
import { CustomerModel } from "../models/customer.model.js";
import { AvailabilityModel } from "../models/availability.model.js";
import { checkSlotAvailability } from "./availability.controller.js";
import { sendEmail } from "../utils/sendEmail.js";
import { YachtModel } from "../models/yacht.model.js";

export const createBooking = async (req, res, next) => {
  try {
    console.log("In Booking", req.body);

    const { yachtId, date, startTime, endTime, customerId, quotedAmount, numPeople } = req.body;
    const employeeId = req.user.id;

    // ----------------------------
    // 0️⃣ Determine trip end datetime for TTL
    const [year, month, day] = date.split("-");
    const [endHour, endMinute] = endTime.split(":");
    const tripEnd = new Date(year, month - 1, day, endHour, endMinute);

    // ----------------------------
    // 1️⃣ Check slot availability using helper
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

    // ----------------------------
    // 2️⃣ Create Booking (original logic)
    const booking = await BookingModel.create({
      ...req.body,
      employeeId,
      company: req.user.company,
      pendingAmount: quotedAmount,
    });

    // ----------------------------
    // 3️⃣ Update customer (original logic)
    await CustomerModel.findByIdAndUpdate(
      booking.customerId,
      { bookingId: booking._id },
      { new: true }
    );

    console.log("Booking created:", booking);

    // ----------------------------
    // 4️⃣ Update or create availability slot
    if (conflictSlot) {
      // Convert lock → booked
      conflictSlot.status = "booked";
      conflictSlot.appliedBy = employeeId;
      conflictSlot.bookingId = booking._id;
      conflictSlot.deleteAfter = tripEnd;
      await conflictSlot.save();
    } else {
      // Create booked slot
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

    // Send email to customer
    const customer = await CustomerModel.findById(customerId);
    const yacht = await YachtModel.findById(yachtId).select("name");
    const yachtName = yacht?.name || "N/A";

    if (customer?.email) {
      const emailContent = `
        Hi ${customer.name},

        Your booking has been confirmed ✅

        Details:
        - Ticket : ${booking._id.toString().slice(-5).toUpperCase()}
        - Yacht Name : ${yachtName}
        - Date: ${date}
        - Start Time: ${startTime}
        - End Time: ${endTime}
        - Number of People: ${numPeople}
        - Total Amount: ${quotedAmount}

        Thank you for choosing our service!

        Regards,
        Your Company
      `;

      await sendEmail({
        to: customer.email,
        subject: "Booking Confirmation",
        text: emailContent,
        html: `<pre>${emailContent}</pre>`,
      });
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

    const updatedBooking = await BookingModel.findByIdAndUpdate(
      bookingId,
      {
        $push: { transactionId },
        pendingAmount: Math.max(booking.pendingAmount - amount, 0),
        ...(status && { status }),
      },
      { new: true }
    ).populate("customerId employeeId transactionId");

    res.status(200).json(updatedBooking);
  } catch (error) {
    next(error);
  }
};


// controllers/bookingController.js
export const getBookings = async (req, res) => {
  try {
    const { startDate, endDate, date, status } = req.query;
    const company = req.user.company;

    const filter = { company };

    // Filter by date
    if (date) {
      const start = new Date(date);
      const end = new Date(date);
      end.setDate(end.getDate() + 1);
      filter.date = { $gte: start, $lt: end };
    } else if (startDate && endDate) {
      filter.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    // Filter by status (if provided)
    if (status && status !== "all") {
      filter.status = status.toLowerCase();
    }

    const bookings = await BookingModel.find(filter)
      .populate({
        path: "yachtId",
        select: "name",
      })
      .populate({
        path: "customerId",
        select: "name contact email",
      })
      .populate({
        path: "employeeId",
        select: "name type", // avoid sending password, company, etc.
      })
      .sort({ date: -1 });

    res.json({ success: true, bookings });
  } catch (error) {
    console.error("❌ Error fetching bookings:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};


export const getBookingById = async (req, res) => {
  try {
    const booking = await BookingModel.findById(req.params.id)
      .populate("customerId empId transactionId");
    if (!booking) return res.status(404).json({ error: "Booking not found" });
    res.json(booking);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
