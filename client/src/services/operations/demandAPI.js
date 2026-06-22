import { apiConnector } from "../apiConnector";
import { demand } from "../apis";

export const getDemandsAPI = async (token, filters = {}) => {
  const params = new URLSearchParams(filters).toString();
  const url = params ? `${demand.GET_DEMANDS_API}?${params}` : demand.GET_DEMANDS_API;

  const response = await apiConnector("GET", url, null, {
    Authorization: `Bearer ${token}`,
  });

  return response;
};

export const updateDemandStatusAPI = async (demandId, status, token) => {
  return apiConnector(
    "PATCH",
    `${demand.GET_DEMANDS_API}/${demandId}/status`,
    { status },
    {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    }
  );
};