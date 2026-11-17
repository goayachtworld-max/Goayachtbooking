import { apiConnector } from "../apiConnector";
import { whatsapp } from "../apis";

const auth = (token) => ({
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
});

export const getWhatsAppOverviewAPI = (token) =>
  apiConnector("GET", whatsapp.OVERVIEW_API, null, auth(token));

// scope: "company" (admin, with companyId) or "me" (agent)
export const getWhatsAppStatusAPI = (token, scope, companyId) => {
  const q = new URLSearchParams({ scope, ...(companyId ? { companyId } : {}) }).toString();
  return apiConnector("GET", `${whatsapp.STATUS_API}?${q}`, null, auth(token));
};

export const connectWhatsAppAPI = (token, body) =>
  apiConnector("POST", whatsapp.CONNECT_API, body, auth(token));

export const reconnectWhatsAppAPI = (token, body) =>
  apiConnector("POST", whatsapp.RECONNECT_API, body, auth(token));

export const disconnectWhatsAppAPI = (token, body) =>
  apiConnector("POST", whatsapp.DISCONNECT_API, body, auth(token));

export const testWhatsAppAPI = (token, body) =>
  apiConnector("POST", whatsapp.TEST_API, body, auth(token));
