import { apiConnector } from "../apiConnector";
import { notification } from "../apis";

/* ---------------- GET ALL NOTIFICATIONS ---------------- */
export const getNotificationsAPI = async (token) => {
  return apiConnector(
    "GET",
    notification.GET_NOTIFICATIONS_API,
    null,
    {
      Authorization: `Bearer ${token}`,
    }
  );
};

/* ---------------- MARK AS READ ---------------- */
export const markNotificationReadAPI = async (id, token) => {
  return apiConnector(
    "PATCH",
    notification.MARK_AS_READ_API(id),
    null,
    {
      Authorization: `Bearer ${token}`,
    }
  );
};

/* ---------------- MARK ALL AS READ ---------------- */
export const markAllNotificationsReadAPI = async (token) => {
  return apiConnector(
    "PATCH",
    notification.MARK_ALL_AS_READ_API,
    null,
    {
      Authorization: `Bearer ${token}`,
    }
  );
};