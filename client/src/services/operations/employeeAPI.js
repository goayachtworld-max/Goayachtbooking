// employeeAPI.js
import { apiConnector } from "../apiConnector";
import { employee } from "../apis";

//  Fetch all employees
export const getAllEmployeesAPI = async (token) => {
  try {
    const response = await apiConnector("GET", employee.GET_ALL_EMPLOYEES_API, null, {
      Authorization: `Bearer ${token}`,
    });
    return response;
  } catch (error) {
    console.error("❌ Failed to fetch employees:", error.response?.data || error);
    throw error;
  }
};

export const getEmployeesForBookingAPI = async (token) => {
  try {
    const response = await apiConnector("GET", employee.GET_EMPLOYEES_FOR_BOOKING_API, null, {
      Authorization: `Bearer ${token}`,
    });
    return response;
  } catch (error) {
    console.error("❌ Failed to fetch employees:", error.response?.data || error);
    throw error;
  }
};

//  Update employee status
export const updateEmployeeStatusAPI = async (id, status, token) => {
  try {
    const response = await apiConnector(
      "PATCH",
      `${employee.UPDATE_EMPLOYEE_STATUS_API}/${id}`,
      { status },
      {
        Authorization: `Bearer ${token}`,
      }
    );
    return response;
  } catch (error) {
    console.error("❌ Failed to update employee status:", error.response?.data || error);
    throw error;
  }
};


export const updateEmployeeProfileAPI = async (employeeId, payload, token) => {
  console.log("Inside update profile");
  // ✅ Proper payload logging
  if (payload instanceof FormData) {
    console.log("Payload (FormData):");
    for (let [key, value] of payload.entries()) {
      console.log(`${key}:`, value);
    }
  } else {
    console.log("Payload (JSON):", payload);
  }

  try {
    const response = await apiConnector(
      "PUT",
      `${employee.UPDATE_EMPLOYEE_PROFILE_API}/${employeeId}`,
      payload,
      {
        Authorization: `Bearer ${token}`,
      }
    );
    return response;
  } catch (error) {
    console.error(
      "❌ Failed to update employee Profile:",
      error.response?.data || error
    );
    throw error;
  }
};

export const updateEmployeeProfileByAdminAPI = async (employeeId, payload, token) => {
  try {
    const response = await apiConnector(
      "PUT",
      `${employee.UPDATE_EMPLOYEE_BY_ADMIN_API}/${employeeId}`,
      payload,
      {
        Authorization: `Bearer ${token}`,
      }
    );
    return response;
  } catch (error) {
    console.error(
      "❌ Failed to update employee profile by admin:",
      error.response?.data || error
    );
    throw error;
  }
};


// Get employees not in admin company
export const getEmployeesNotInCompanyAPI = async (token) => {
  try {
    return await apiConnector(
      "GET",
      employee.GET_EMPLOYEES_NOT_IN_COMPANY,
      null,
      {
        Authorization: `Bearer ${token}`,
      }
    );
  } catch (error) {
    console.error("❌ Failed to fetch not-in-company employees:", error);
    throw error;
  }
};

// Add employee to admin company
export const addEmployeeToCompanyAPI = async (employeeId, companyId, token) => {
  try {
    return await apiConnector(
      "POST",
      employee.ADD_EMPLOYEE_TO_COMPANY,
      { employeeId , companyId},
      {
        Authorization: `Bearer ${token}`,
      }
    );
  } catch (error) {
    console.error("❌ Failed to add employee to company:", error);
    throw error;
  }
};
