// authAPI.js
import { apiConnector } from "../apiConnector";
import { employee } from "../apis";

/**
 * identifier = username OR mobile number
 * credential = { password } OR { pin }
 */
export const loginAPI = async (identifier, credential) => {
  return apiConnector("POST", employee.LOGIN_API, { identifier, ...credential });
};

export const setPinAPI = async (pin, token) => {
  return apiConnector("POST", employee.SET_PIN_API, { pin }, {
    Authorization: `Bearer ${token}`,
  });
};

export const createEmployeeAPI = async (data, token) => {
  return apiConnector("POST", employee.CREATE_EMPLOYEE_API, data, {
    Authorization: `Bearer ${token}`,
  });
};

// ── Forgot / reset password (staff only, no login needed) ──
export const forgotPasswordAPI = async (identifier) => {
  return apiConnector("POST", employee.FORGOT_PASSWORD_API, { identifier });
};

export const checkResetTokenAPI = async (token) => {
  return apiConnector("POST", employee.CHECK_RESET_TOKEN_API, { token });
};

export const resetPasswordAPI = async (token, newPassword) => {
  return apiConnector("POST", employee.RESET_PASSWORD_API, { token, newPassword });
};
