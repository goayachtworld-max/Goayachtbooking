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


export const updateCustomerAPI = async (customerId, payload, token) => {
  return apiConnector(
    "PUT",
    `${customer.UPDATE_CUSTOMER_API}/${customerId}`,
    payload,
    {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    }
  );
};

export const getCustomersAPI = async (page, limit, token) => {
  const response = await apiConnector(
    "GET",
    `${customer.GET_CUSTOMERS_API}?page=${page}&limit=${limit}`,
    null,
    {
      Authorization: `Bearer ${token}`,
    }
  );

  return response.data;
};
