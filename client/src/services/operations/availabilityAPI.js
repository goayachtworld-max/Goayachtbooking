import { apiConnector } from "../apiConnector";
import { availability } from "../apis";

export const getAvailabilitySummary = async (startDate, endDate, token) => {
  try {
    if (!token) {
      throw new Error("Authorization token is missing");
    }
    const url = `${availability.GET_AVAILABILITY_SUMMARY}?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`;

    const response = await apiConnector(
      "GET",
      url,
      null,
      { Authorization: `Bearer ${token}` }
    );

    return response?.data;
  } catch (error) {
    console.error("Error fetching availability summary:", error);
    throw error;
  }
};

// -------------------------
// Get day availability for a specific yacht
// -------------------------
export const getDayAvailability = async (yachtId, date, token) => {
  try {
    if (!token) throw new Error("Authorization token is missing");

    const url = `${availability.GET_DAY_AVAILABILITY(yachtId, date)}`;
    console.log( "Before url - " , url)
    const response = await apiConnector("GET", url, null, {
      Authorization: `Bearer ${token}`,
    });
    console.log("Get Day Avail - ", response.data);
    return response?.data;
  } catch (error) {
    console.error("Error fetching day availability:", error);
    throw error;
  }
};

// -------------------------
// Lock a slot
// -------------------------
export const lockSlot = async (yachtId, date, startTime, endTime, token) => {
  try {
    if (!token) throw new Error("Authorization token is missing");

    const body = { yachtId, date, startTime, endTime };

    const response = await apiConnector("POST", availability.LOCK_SLOT, body, {
      Authorization: `Bearer ${token}`,
    });

    return response?.data;
  } catch (error) {
    console.error("Error locking slot:", error);
    throw error;
  }
};

// -------------------------
// Release a locked slot
// -------------------------
export const releaseSlot = async (yachtId, date, startTime, endTime, token) => {
  try {
    if (!token) throw new Error("Authorization token is missing");

    const body = { yachtId, date, startTime, endTime };

    const response = await apiConnector("PUT", availability.RELEASE_SLOT, body, {
      Authorization: `Bearer ${token}`,
    });

    return response?.data;
  } catch (error) {
    console.error("Error releasing slot:", error);
    throw error;
  }
};