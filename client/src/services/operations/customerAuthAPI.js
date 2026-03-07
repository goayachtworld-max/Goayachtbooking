// services/operations/customerAuthAPI.js
// Follows the same apiConnector pattern as customerAPI.js / bookingAPI.js.
// Uses axios under the hood via apiConnector.
//
// Session helpers store customer JWT in localStorage as 'customerToken'
// (separate from staff token 'token').

import { apiConnector } from '../apiConnector';
import { customerAuth } from '../apis';

// ── Session helpers ────────────────────────────────────────────────────────

export const saveCustomerSession = (token, customer) => {
  localStorage.setItem('customerToken', token);
  localStorage.setItem('customerProfile', JSON.stringify(customer));
};

export const getCachedCustomer = () => {
  try {
    const raw = localStorage.getItem('customerProfile');
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
};

export const clearCustomerSession = () => {
  localStorage.removeItem('customerToken');
  localStorage.removeItem('customerProfile');
};

export const getCustomerToken = () => localStorage.getItem('customerToken');

export const isCustomerLoggedIn = () => Boolean(getCustomerToken());

// ── Auth ───────────────────────────────────────────────────────────────────

/**
 * Send OTP to customer phone.
 * Returns { success, maskedPhone, message }
 */
export const sendCustomerOtpAPI = async (phone) => {
  return apiConnector(
    'POST',
    customerAuth.SEND_OTP_API,
    { phone }
  );
};

/**
 * Verify OTP.
 * Returns { success, token, customer, isNewCustomer }
 */
export const verifyCustomerOtpAPI = async (phone, otp) => {
  return apiConnector(
    'POST',
    customerAuth.VERIFY_OTP_API,
    { phone, otp }
  );
};

// ── Profile ────────────────────────────────────────────────────────────────

/**
 * Get logged-in customer profile.
 * Returns { success, customer }
 */
export const getCustomerMeAPI = async () => {
  const token = getCustomerToken();
  return apiConnector(
    'GET',
    customerAuth.GET_ME_API,
    null,
    { Authorization: `Bearer ${token}` }
  );
};

/**
 * Update customer profile (name, email, alternateContact).
 * Returns { success, customer }
 */
export const updateCustomerProfileAPI = async (payload) => {
  const token = getCustomerToken();
  return apiConnector(
    'PUT',
    customerAuth.UPDATE_PROFILE_API,
    payload,
    {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    }
  );
};

// ── Bookings ───────────────────────────────────────────────────────────────

/**
 * Get customer booking history (paginated).
 * Returns { success, bookings, total, totalPages, currentPage }
 */
export const getCustomerBookingsAPI = async (page = 1, limit = 10) => {
  const token = getCustomerToken();
  return apiConnector(
    'GET',
    `${customerAuth.GET_BOOKINGS_API}?page=${page}&limit=${limit}`,
    null,
    { Authorization: `Bearer ${token}` }
  );
};