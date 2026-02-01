import { apiConnector } from "../apiConnector";
import { booking } from "../apis"; // import booking here

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
  return apiConnector(
    "GET",
    booking.GET_PUBLIC_BOOKING_BY_TKT_API(bookingId)
  );
};

// export const getBookingsAPI = async (token) => {
//   return apiConnector(
//     "GET",
//     booking.GET_BOOKINGS_API,
//     null,
//     { Authorization: `Bearer ${token}` }
//   );
// };

// bookingAPI.js
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



// As of not used, made changes in backend and integrated with create Transaction
export const updateBookingAPI = async (id, payload, token) => {
  const response = await apiConnector("PUT", booking.UPDATE_BOOKING_API(id), payload, {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  });
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

// services/operations/bookingAPI.js

export const updateBookingExtrasAPI = async (bookingId, payload, token) => {
  return apiConnector(
    "PATCH", // Using PATCH since we are updating only a part of the booking
    `${booking.UPDATE_EXTRA_DETAILS_BOOKING_API}/extra-details/${bookingId}`,
    payload,
    {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    }
  );
};

