// src/pages/CustomerDetails.jsx
import React from "react";
import { useLocation, useNavigate } from "react-router-dom";

function CustomerDetails() {
  const location = useLocation();
  const navigate = useNavigate();

  // Expecting a booking object from navigation state
  const { booking } = location.state || {};
  const customer = booking?.customerId || {};

  if (!booking) {
    return (
      <div className="container my-5 text-center">
        <h5>No booking data found!</h5>
        <button className="btn btn-primary mt-3" onClick={() => navigate(-1)}>
          Go Back
        </button>
      </div>
    );
  }

  const bookingDate = booking.date ? new Date(booking.date).toLocaleDateString() : "-";
  const startTime = booking.startTime || "-";

  return (
    <div className="container my-4">
      <h4 className="mb-3 text-center">Customer Booking Details</h4>

      <div className="card shadow-sm p-3 p-md-4">
        <div className="d-flex flex-column gap-2">
          <p className="m-0"><strong>Name:</strong> {customer.name || "N/A"}</p>
          <p className="m-0"><strong>Contact No:</strong> {customer.contact || "N/A"}</p>
          <p className="m-0"><strong>Email:</strong> {customer.email || "N/A"}</p>
          <p className="m-0">
            <strong>Govt ID:</strong> {customer.govtIdType || "-"} - {customer.govtIdNo || "-"}
          </p>
          <p className="m-0">
            <strong>Date of Booking:</strong> {bookingDate}
          </p>
          <p className="m-0">
            <strong>Start Time:</strong> {startTime}
          </p>
          <p className="m-0"><strong>Number of People:</strong> {booking.numPeople || "N/A"}</p>
          <p className="m-0"><strong>Status:</strong> {booking.status || "N/A"}</p>
          <p className="m-0"><strong>Total Amount:</strong> ₹{booking.quotedAmount || 0}</p>
          <p className="m-0"><strong>Pending Amount:</strong> ₹{booking.pendingAmount || 0}</p>
          <p className="m-0">
            <strong>Paid Amount:</strong> ₹{(booking.quotedAmount || 0) - (booking.pendingAmount || 0)}
          </p>
        </div>

        <div className="text-center mt-3">
          <button className="btn btn-secondary btn-sm" onClick={() => navigate(-1)}>
            Back
          </button>
        </div>
      </div>
    </div>
  );
}

export default CustomerDetails;
