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
