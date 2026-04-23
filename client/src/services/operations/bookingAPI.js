import { apiConnector } from "../apiConnector";
import { booking } from "../apis";

export const createBookingAPI = async (payload, token) => {
  return apiConnector(
    "POST",
    booking.CREATE_BOOKING_API,
    payload,
    {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    }
  );
};

export const getPublicBookingByIdAPI = async (bookingId) => {
  return apiConnector("GET", booking.GET_PUBLIC_BOOKING_BY_TKT_API(bookingId));
};

export const getBookingsAPI = async (token, filters = {}) => {
  const params = new URLSearchParams(filters).toString();
  const url = params
    ? `${booking.GET_BOOKINGS_API}?${params}`
    : booking.GET_BOOKINGS_API;

  const response = await apiConnector("GET", url, null, {
    Authorization: `Bearer ${token}`,
  });

  console.log("Booking res - ", response);
  return response;
};

// As of now not used directly — integrated with createTransaction
export const updateBookingAPI = async (id, payload, token) => {
  const response = await apiConnector(
    "PUT",
    booking.UPDATE_BOOKING_API(id),
    payload,
    {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    }
  );
  return response.data;
};

export const rescheduleBookingAPI = async (bookingId, payload, token) => {
  return apiConnector(
    "PUT",
    `${booking.RESCHEDULE_BOOKING_API}/${bookingId}`,
    payload,
    {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    }
  );
};

export const updateBookingExtrasAPI = async (bookingId, payload, token) => {
  return apiConnector(
    "PATCH",
    `${booking.UPDATE_EXTRA_DETAILS_BOOKING_API}/extra-details/${bookingId}`,
    payload,
    {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    }
  );
};

// Admin only: update quotedAmount and/or tokenAmount
export const updateBookingAmountsAPI = async (bookingId, payload, token) => {
  return apiConnector(
    "PATCH",
    booking.UPDATE_BOOKING_AMOUNTS_API(bookingId),
    payload,
    {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    }
  );
};

export const createPublicBookingAPI = async (data) => {
  try {
    const response = await apiConnector(
      "POST",
      booking.CREATE_PUBLIC_BOOKING_API,
      data,
      {},
      null
    );
    return response;
  } catch (error) {
    console.error("❌ Failed to create public booking:", error.response?.data || error);
    throw error;
  }
};
export const getPastBookingsAPI = async (token, filters = {}) => {
  const params = new URLSearchParams(filters).toString();
  const url = params
    ? `${booking.GET_PAST_BOOKINGS_API}?${params}`
    : booking.GET_PAST_BOOKINGS_API;

  const response = await apiConnector("GET", url, null, {
    Authorization: `Bearer ${token}`,
  });
  return response;
};