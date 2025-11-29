// authAPI.js
import { apiConnector } from "../apiConnector";
import { employee } from "../apis";

export const loginAPI = async (username, password) => {
  return apiConnector("POST", employee.LOGIN_API, { username, password });
};

export const createEmployeeAPI = async (data, token) => {
  return apiConnector("POST", employee.CREATE_EMPLOYEE_API, data, {
    Authorization: `Bearer ${token}`,
  });
};

