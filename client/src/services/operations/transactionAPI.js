import { apiConnector } from "../apiConnector";
import {transaction  } from "../apis";

export const createTransactionAPI = async (payload, token) => {
    const formData = new FormData();
    formData.append("bookingId", payload.bookingId);
    formData.append("type", payload.type);
    formData.append("amount", payload.amount);
    if (payload.proofFile) formData.append("paymentProof", payload.proofFile);

    return apiConnector("POST", transaction.TRANSACTIONS.CREATE, formData, {
        "Authorization": `Bearer ${token}`,
    });
};

export const createTransactionAndUpdateBooking = async (payload, token) => {
    console.log("FormData values:");
      for (let [key, value] of payload.entries()) {
        console.log(key, value);
      }
    console.log("Request " , payload)
    return apiConnector(
        "POST",
        transaction.CREATE_WITH_BOOKING_UPDATE,
        payload,
        {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
        }
    );
}
