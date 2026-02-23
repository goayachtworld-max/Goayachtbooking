import { apiConnector } from "../apiConnector";
import { company } from "../apis";

export const registerCompanyAPI = async (token, formData) => {
  try {
    const response = await apiConnector(
      "POST",
      company.REGISTER_COMPANY_API,
      formData,
      {
        Authorization: `Bearer ${token}`,
      }
    );

    return response.data;

  } catch (error) {
    console.error("❌ Failed to register company:", error.response?.data || error);
    throw error.response?.data || error;
  }
};