import { apiConnector } from "../apiConnector";
import { customer } from "../apis"; // import customer only

export const createCustomerAPI = async (payload, token) => {
  return apiConnector("POST", customer.CREATE_CUSTOMER_API, payload, {
    Authorization: `Bearer ${token}`,
  });
};

export const getCustomerByContactAPI = async (contact, token) => {
  return apiConnector(
    "GET",
    `${customer.GET_CUSTOMER_BY_CONTACT}/${encodeURIComponent(contact)}`,
    null,
    {
      Authorization: `Bearer ${token}`,
    }
  );
};

export const searchCustomersByNameAPI = async (name, token) => {
  try {
    const response = await apiConnector(
      "GET",
      `${customer.SEARCH_CUSTOMERS_API}?name=${name}`,
      null,
      {
        Authorization: `Bearer ${token}`,
      }
    );
    return response;
  } catch (error) {
    console.error(
      "❌ Failed to search customers:",
      error.response?.data || error
    );
    throw error;
  }
};
