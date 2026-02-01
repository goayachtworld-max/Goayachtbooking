import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { createTransactionAndUpdateBooking } from "../services/operations/transactionAPI";

function UpdateBooking() {
  const navigate = useNavigate();
  const location = useLocation();
  const { booking } = location.state || {};

  const [formData, setFormData] = useState({
    status: booking.status || "",
    amount: "",
    type: "advance",
    proofFile: null,
  });

  const initialData = {
    status: booking.status || "",
    amount: "",
    proofFile: null,
  };
  const isFormChanged =
  formData.status !== initialData.status ||
  formData.amount !== initialData.amount ||
  formData.proofFile !== null;


  // 👇 track if user changed status
  const [statusChanged, setStatusChanged] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!booking) {
    navigate("/bookings");
    return null;
  }

  // UI-only helpers
  const isConfirmed = booking.status === "confirmed";
  const isCancelled = booking.status === "cancelled";

  const handleChange = (e) => {
    const { name, value, files } = e.target;

    if (name === "status" && value !== booking.status) {
      setStatusChanged(true);
    }

    setFormData((prev) => ({
      ...prev,
      [name]: name === "proofFile" ? files[0] : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const token = localStorage.getItem("authToken");
      const data = new FormData();
      data.append("bookingId", booking._id);
      data.append("type", formData.type);
      data.append("status", formData.status);
      if (formData.amount == "" || formData.amount == null) {
        data.append("amount", Number(0));
      } else {
        data.append("amount", formData.amount);
      }
      if (formData.proofFile) data.append("paymentProof", formData.proofFile);

      const response = await createTransactionAndUpdateBooking(data, token);
      navigate("/bookings");
    } catch (err) {
      console.error("Error updating booking:", err);
      setError(
        err.response?.data?.error ||
        err.response?.data?.message ||
        "Failed to update booking"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container my-4 px-3">
      <div className="mx-auto" style={{ maxWidth: "85%" }}>
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h4>Update Booking</h4>
          <button className="btn btn-secondary" onClick={() => navigate("/bookings")}>
            &larr; Back
          </button>
        </div>

        {error && (
          <div className="alert alert-danger text-center">
            {error}
          </div>
        )}

        <form className="row g-3" onSubmit={handleSubmit}>
          {/* Booking Info */}
          <div className="col-12">
            <p><strong>Customer:</strong> {booking.customerId?.name}</p>
            <p><strong>Total Amount:</strong> ₹{booking.quotedAmount}</p>
            <p><strong>Pending Amount:</strong> ₹{booking.pendingAmount}</p>
          </div>

          {/* Status */}
          <div className="col-12 col-md-6">
            <label className="form-label fw-bold">Booking Status</label>
            <select
              className="form-select border border-dark text-dark"
              name="status"
              value={formData.status}
              onChange={handleChange}
              required
            >
              <option value="pending" disabled={isConfirmed || isCancelled}>
                Pending
              </option>
              <option value="confirmed" disabled={isCancelled}>
                Confirmed
              </option>
              <option value="cancelled">Cancelled</option>
            </select>

            {/* ⚠️ Warning ONLY when status changes */}
            {statusChanged && isConfirmed && (
              <div className="form-text text-warning mt-1">
                ⚠️ You are changing a confirmed booking. Please ensure this is intended.
              </div>
            )}

            {statusChanged && isCancelled && (
              <div className="form-text text-danger mt-1">
                ⚠️ You are modifying a cancelled booking. Changes may affect records.
              </div>
            )}
          </div>

          {/* Amount */}
          <div className="col-12 col-md-6">
            <label className="form-label fw-bold">Amount</label>
            <input
              type="number"
              className="form-control border border-dark text-dark"
              name="amount"
              value={formData.amount}
              onChange={handleChange}
              placeholder="Enter current amount"
            />
          </div>

          {/* Proof */}
          {/* <div className="col-12">
          <label className="form-label fw-bold">Upload Proof of Payment</label>
          <input
            type="file"
            className="form-control border border-dark text-dark"
            name="proofFile"
            onChange={handleChange}
            accept="image/*,application/pdf"
          />
        </div> */}

          <div className="col-12">
            <label className="form-label fw-bold">Upload Proof of Payment</label>

            <div className="d-flex align-items-center gap-3">
              <label className="btn btn-outline-secondary btn-sm">
                📎 Attach File
                <input
                  type="file"
                  name="proofFile"
                  onChange={handleChange}
                  accept="image/*,application/pdf"
                  hidden
                />
              </label>

              {formData.proofFile && (
                <span className="text-muted small">
                  {formData.proofFile.name}
                </span>
              )}
            </div>
          </div>


          <div className="col-12 text-center mt-3">
            <button
              type="submit"
              className="btn btn-primary w-100 w-md-auto"
              disabled={loading || !isFormChanged}
            >
              {loading ? "Updating..." : "Update Booking"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default UpdateBooking;
