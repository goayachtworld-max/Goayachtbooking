import { apiConnector } from "../apiConnector";
import { customer } from "../apis"; // import customer only

export const createCustomerAPI = async (payload, token) => {
  return apiConnector("POST", customer.CREATE_CUSTOMER_API, payload, {
    Authorization: `Bearer ${token}`,
  });
};

export const getCustomerByEmailAPI = async (email, token) => {
  return apiConnector(
    "GET",
    `${customer.GET_CUSTOMER_BY_EMAIL}/${encodeURIComponent(email)}`,
    null,
    {
      Authorization: `Bearer ${token}`,
    }
  );
};
