import { apiConnector } from "../apiConnector";
import { yaut } from "../apis";

/**
 * Create a new yacht
 * @param {Object} yachtData - Yacht details including File objects in `photos`
 * @param {string} token - Auth token
 */
export const createYacht = async (formData, token) => {
  try {
    console.log("===== FormData contents =====");
    for (let pair of formData.entries()) {
      console.log(pair[0], pair[1]);
    }
    console.log("=============================");

    const response = await apiConnector(
      "POST",
      yaut.CREATE_YACHT_API,
      formData,
      {
        Authorization: `Bearer ${token}`,
      }
    );

    return response?.data;
  } catch (error) {
    console.error("❌ Error creating yacht:", error.response?.data || error);
    throw error;
  }
};


/**
 * Get all yachts for the logged-in user's company
 * @param {string} token - Auth token
 * @returns {Promise} - Axios response
 */
export const getAllYachtsAPI = async (token) => {
  try {
    const response = await apiConnector("GET", yaut.GET_ALL_YACHTS_API, null, {
      Authorization: `Bearer ${token}`,
    });
    return response;
  } catch (error) {
    console.error("❌ Failed to fetch yachts:", error.response?.data || error);
    throw error;
  }
};

export const getAllYachtsDetailsAPI = async (token) => {
  try {
    const response = await apiConnector("GET", yaut.GET_ALL_YACHTS_DETAILS_API, null, {
      Authorization: `Bearer ${token}`,
    });
    return response;
  } catch (error) {
    console.error("❌ Failed to fetch yachts:", error.response?.data || error);
    throw error;
  }
};

export const getYachtById = async (id, token) => {
  try {
    const response = await apiConnector("GET", yaut.GET_YACHT_BY_ID_API(id), null, {
      Authorization: `Bearer ${token}`,
    });
    return response;
  } catch (error) {
    console.error("❌ Failed to fetch yacht:", error.response?.data || error);
    throw error;
  }
};

export const deleteYacht = async (id, token) => {
  try {
    const response = await apiConnector(
      "DELETE",
      yaut.DELETE_YACHT_API(id),
      null,
      {
        Authorization: `Bearer ${token}`,
      }
    );

    return response;
  } catch (error) {
    console.error("❌ Failed to delete yacht:", error.response?.data || error);
    throw error;
  }
};


export const updateYacht = async (id, data, token) => {
  console.log("Here is edit yacht data - ", data);
  try {
    const response = await apiConnector(
      "PUT",
      yaut.UPDATE_YACHT_API(id),
      data,
      {
        Authorization: `Bearer ${token}`,
      }
    );

    return response;
  } catch (error) {
    console.error("❌ Failed to update yacht:", error.response?.data || error);
    throw error;
  }
};
