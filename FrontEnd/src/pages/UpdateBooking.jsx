import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { createTransactionAndUpdateBooking } from "../services/operations/transactionAPI";

function UpdateBooking() {
  const navigate = useNavigate();
  const location = useLocation();
  const { booking } = location.state || {};

  const [formData, setFormData] = useState({
    status: "inprogress",
    amount: "",
    type: "advance",
    proofFile: null,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!booking) {
    navigate("/bookings");
    return null;
  }

  const handleChange = (e) => {
    const { name, value, files } = e.target;
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
      data.append("amount", formData.amount);
      if (formData.proofFile) data.append("paymentProof", formData.proofFile);

      const response = await createTransactionAndUpdateBooking(data, token);

      // alert("Booking updated successfully!");
      navigate("/customer-details", { state: { booking: response.data.booking } });
    } catch (err) {
      console.error("Error updating booking:", err);
      setError(err.response?.data?.error || err.response?.data?.message  || "Failed to update booking");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container my-4 px-3">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h4>Update Booking</h4>
        <button className="btn btn-secondary" onClick={() => navigate(-1)}>
          &larr; Back
        </button>
      </div>

      {/* Error message */}
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
            <option value="inprogress">In Progress</option>
            <option value="success">Success</option>
            <option value="terminated">Terminated</option>
          </select>
        </div>

        {/* Payment Type */}
        <div className="col-12 col-md-6">
          <label className="form-label fw-bold">Payment Type</label>
          <select
            className="form-select border border-dark text-dark"
            name="type"
            value={formData.type}
            onChange={handleChange}
            required
          >
            <option value="advance">Advance</option>
            <option value="settlement">Settlement</option>
          </select>
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
            required
          />
        </div>

        {/* Proof */}
        <div className="col-12">
          <label className="form-label fw-bold">Upload Proof of Payment</label>
          <input
            type="file"
            className="form-control border border-dark text-dark"
            name="proofFile"
            onChange={handleChange}
            accept="image/*,application/pdf"
            required
          />
        </div>

        <div className="col-12 text-center mt-3">
          <button type="submit" className="btn btn-primary w-100 w-md-auto" disabled={loading}>
            {loading ? "Updating..." : "Update Booking"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default UpdateBooking;
