const BASE_URL = import.meta.env.VITE_BASE_URL;
// const BASE_URL =  "http://localhost:9000/api";

export const employee = {
  LOGIN_API: `${BASE_URL}/employees/login`,
  CREATE_EMPLOYEE_API: `${BASE_URL}/employees/createEmployee`,
  GET_ALL_EMPLOYEES_API: `${BASE_URL}/employees/`,
  UPDATE_EMPLOYEE_STATUS_API: `${BASE_URL}/employees/update-status`,
  UPDATE_EMPLOYEE_PROFILE_API: `${BASE_URL}/employees/update-profile`,
  UPDATE_EMPLOYEE_BY_ADMIN_API: `${BASE_URL}/employees/update-by-admin`,
  GET_EMPLOYEES_FOR_BOOKING_API: `${BASE_URL}/employees/bookingpage`,
  GET_EMPLOYEES_NOT_IN_COMPANY: `${BASE_URL}/employees/not-in-company`,
  ADD_EMPLOYEE_TO_COMPANY: `${BASE_URL}/employees/add-to-company`,
};

export const customer = {
  CREATE_CUSTOMER_API: `${BASE_URL}/customers`,
  GET_CUSTOMERS_API: `${BASE_URL}/customers`,
  GET_CUSTOMER_BY_CONTACT: `${BASE_URL}/customers/contact`, // append /:contact dynamically
  SEARCH_CUSTOMERS_API: `${BASE_URL}/customers/search`,
  UPDATE_CUSTOMER_API: `${BASE_URL}/customers`,
};

export const booking = {
  GET_BOOKINGS_API: `${BASE_URL}/bookings`,
  CREATE_BOOKING_API: `${BASE_URL}/bookings`,
  UPDATE_BOOKING_API: (id) => `${BASE_URL}/bookings/${id}`,
  RESCHEDULE_BOOKING_API: `${BASE_URL}/bookings/reschedule`,
  UPDATE_EXTRA_DETAILS_BOOKING_API: `${BASE_URL}/bookings`,
  GET_PUBLIC_BOOKING_BY_TKT_API: (id) => `${BASE_URL}/bookings/public/${id}`,
  CREATE_PUBLIC_BOOKING_API: `${BASE_URL}/bookings/public`,
  UPDATE_BOOKING_AMOUNTS_API: (bookingId) => `${BASE_URL}/bookings/${bookingId}/amounts`, // Admin only
};

export const transaction = {
  CREATE_TRANSACTION_API: `${BASE_URL}/transactions`,
  CREATE_WITH_BOOKING_UPDATE: `${BASE_URL}/transactions/create-with-booking-update`,
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
  GET_PUBLIC_YACHTS_API: `${BASE_URL}/yacht/public`,
  DELETE_YACHT_API: (id) => `${BASE_URL}/yacht/${id}`,
  UPDATE_DAY_SLOTS: `${BASE_URL}/slot/`,
};

export const notification = {
  GET_NOTIFICATIONS_API: `${BASE_URL}/notifications`,
  MARK_AS_READ_API: (id) => `${BASE_URL}/notifications/${id}/read`,
  MARK_ALL_AS_READ_API: `${BASE_URL}/notifications/mark-all-read`,
};

export const company = {
  REGISTER_COMPANY_API: `${BASE_URL}/company`,
};

// ── Customer self-service auth (public-facing site) ──────────────────────────
export const customerAuth = {
  SEND_OTP_API: `${BASE_URL}/customer/auth/send-otp`,
  VERIFY_OTP_API: `${BASE_URL}/customer/auth/verify-otp`,
  GET_ME_API: `${BASE_URL}/customer/auth/me`,
  UPDATE_PROFILE_API: `${BASE_URL}/customer/auth/profile`,
  GET_BOOKINGS_API: `${BASE_URL}/customer/auth/bookings`,
};