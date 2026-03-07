// controllers/customer.bookings.controller.js
import { CustomerModel } from '../models/customer.model.js';
import { BookingModel }  from '../models/booking.model.js';

export const getMyBookings = async (req, res, next) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(20, parseInt(req.query.limit) || 10);
    const skip  = (page - 1) * limit;

    const customer = await CustomerModel.findById(req.customer.customerId);
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found.' });

    // Match by customerId OR customerContact (covers bookings made before account creation)
    const query = { $or: [{ customerId: customer._id }, { customerContact: customer.contact }] };

    const [bookings, total] = await Promise.all([
      BookingModel.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        // NOTE: the booking model stores the yacht ref as 'yachtId' (not 'yacht')
        .populate('yachtId', 'name photos sellingPrice boardingLocation')
        .select(
          'yachtId date startTime endTime status quotedAmount totalAmount ' +
          'numPeople extraDetails ticketNo source createdAt customerContact'
        )
        .lean(),
      BookingModel.countDocuments(query),
    ]);

    return res.json({
      success:     true,
      bookings,
      total,
      totalPages:  Math.ceil(total / limit),
      currentPage: page,
    });
  } catch (err) { next(err); }
};