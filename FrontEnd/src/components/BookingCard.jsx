// src/components/BookingCard.jsx
import React from "react";

function BookingCard({ booking }) {
  return (
    <div className="card mb-3">
      <div className="card-body">
        <h5 className="card-title">{booking.customer}</h5>
        <p className="card-text">Boat: {booking.boat}</p>
        <p className="card-text">
          Status:{" "}
          <span
            className={`badge ${
              booking.status === "Confirmed" ? "bg-success" : "bg-warning"
            }`}
          >
            {booking.status}
          </span>
        </p>
        <button className="btn btn-sm btn-primary">View Details</button>
      </div>
    </div>
  );
}

export default BookingCard;
