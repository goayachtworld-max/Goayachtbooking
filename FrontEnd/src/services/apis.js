const BASE_URL = import.meta.env.VITE_BASE_URL;
// const BASE_URL =  "http://localhost:9000/api";

export const employee = {
  LOGIN_API: `${BASE_URL}/employees/login`,
  CREATE_EMPLOYEE_API: `${BASE_URL}/employees/createEmployee`,
  GET_ALL_EMPLOYEES_API: `${BASE_URL}/employees/`,
  UPDATE_EMPLOYEE_STATUS_API: `${BASE_URL}/employees/updateStatus`,
};

export const customer = {
  CREATE_CUSTOMER_API: `${BASE_URL}/customers`,
  GET_CUSTOMER_BY_EMAIL: `${BASE_URL}/customers`, // we'll append /:email dynamically
}

export const booking = {
  GET_BOOKINGS_API: `${BASE_URL}/bookings`,
  CREATE_BOOKING_API: `${BASE_URL}/bookings`,
  UPDATE_BOOKING_API: (id) => `${BASE_URL}/bookings/${id}`,
};

export const transaction = {
  CREATE_TRANSACTION_API: `${BASE_URL}/transactions`,
  CREATE_WITH_BOOKING_UPDATE : `${BASE_URL}/transactions/create-with-booking-update`
};

export const availability = {
  GET_AVAILABILITY_SUMMARY: `${BASE_URL}/availability/summary/get`,
  GET_DAY_AVAILABILITY: (yachtId, date) =>
    `${BASE_URL}/availability/${yachtId}?date=${date}`,
  LOCK_SLOT: `${BASE_URL}/availability/lock`,
  RELEASE_SLOT: `${BASE_URL}/availability/release`,
};

export const yaut = {
  CREATE_YACHT_API: `${BASE_URL}/yacht`,
  GET_ALL_YACHTS_API: `${BASE_URL}/yacht`,
  GET_ALL_YACHTS_DETAILS_API: `${BASE_URL}/yacht/details`,
  GET_YACHT_BY_ID_API: (id) => `${BASE_URL}/yacht/${id}`,
  UPDATE_YACHT_API: (id) => `${BASE_URL}/yacht/${id}`,
  DELETE_YACHT_API: (id) => `${BASE_URL}/yacht/${id}`,
};