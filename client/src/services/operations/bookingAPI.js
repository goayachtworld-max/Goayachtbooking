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