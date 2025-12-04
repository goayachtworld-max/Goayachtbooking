


// src/services/apiConnector.js
import axios from "axios";

// Create a single axios instance with global settings
export const axiosInstance = axios.create({
  withCredentials: true, // send cookies / auth headers
});

export const apiConnector = (method, url, bodyData = null, headers = {}, params = null) => {
  console.log("➡️ apiConnector called:", method, url, bodyData, headers, params);

  const isFormData = bodyData instanceof FormData;
  const finalHeaders = { ...headers };

  // Let Axios automatically set Content-Type for FormData
  if (isFormData && finalHeaders["Content-Type"]) {
    delete finalHeaders["Content-Type"];
  }

  return axiosInstance({
    method,
    url,
    data: bodyData,
    headers: finalHeaders,
    params,
  });
};
