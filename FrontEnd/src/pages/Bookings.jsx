import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { getBookingsAPI } from "../services/operations/bookingAPI";

function Bookings({ user }) {
  const navigate = useNavigate();
  const location = useLocation();

  //  read URL params
  const params = new URLSearchParams(location.search);

  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);

  //  Filters initialized from URL (or defaults)
  const [filterDate, setFilterDate] = useState(
    params.get("date") || new Date().toISOString().split("T")[0]
  );

  const [filterStatus, setFilterStatus] = useState(
    params.get("status") || ""
  );

  //  Sync filters → URL whenever they change
  useEffect(() => {
    const p = new URLSearchParams();
    if (filterDate) p.set("date", filterDate);
    if (filterStatus) p.set("status", filterStatus);

    navigate({ search: p.toString() }, { replace: true });
  }, [filterDate, filterStatus]);

  //  Fetch bookings
  const fetchBookings = async (filters = {}) => {
    try {
      setLoading(true);
      const token = localStorage.getItem("authToken");
      const res = await getBookingsAPI(token, filters);
      setBookings(res.data.bookings || []);
    } catch (err) {
      console.error("❌ Error fetching bookings:", err);
    } finally {
      setLoading(false);
    }
  };

  //  Whenever filters change → fetch bookings
  useEffect(() => {
    const filters = {};
    if (filterDate) filters.date = filterDate;
    if (filterStatus) filters.status = filterStatus;

    fetchBookings(filters);
  }, [filterDate, filterStatus]);

  //  Clear filters
  const handleClear = () => {
    const today = new Date().toISOString().split("T")[0];
    setFilterDate(today);
    setFilterStatus("");
  };

  const handleViewDetails = (booking) =>
    navigate("/customer-details", { state: { booking } });

  const handleCreateBooking = () => navigate("/create-booking");

  const handleUpdateBooking = (booking) =>
    navigate("/update-booking", { state: { booking } });

  return (
    <div className="container mt-5">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2>Bookings</h2>
        {(user?.type === "admin" || user?.type === "backdesk") && (
          <button className="btn btn-success" onClick={handleCreateBooking}>
            + Create Booking
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="d-flex flex-wrap gap-2 mb-3">
        <input
          type="date"
          className="form-control"
          value={filterDate}
          onChange={(e) => setFilterDate(e.target.value)}
          style={{ maxWidth: "200px" }}
          min={new Date().toISOString().split("T")[0]}
        />

        <select
          className="form-select"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          style={{ maxWidth: "200px" }}
        >
          <option value="">All Status</option>
          <option value="Initiated">Initiated</option>
          <option value="Completed">Completed</option>
          <option value="Terminated">Terminated</option>
        </select>

        <button className="btn btn-secondary" onClick={handleClear}>
          Clear
        </button>
      </div>

      {/* Booking Cards */}
      {loading ? (
        <p>Loading bookings...</p>
      ) : (
        <div className="row mt-3">
          {bookings.length > 0 ? (
            bookings.map((booking) => (
              <div key={booking._id} className="col-md-6 mb-3">
                <div className="card p-3">
                  <h5>{booking.customerId?.name}</h5>
                  <p>Yacht: {booking.yachtId?.name}</p>
                  <p>Ticket : {booking._id.toString().slice(-5).toUpperCase()}</p>
                  <p>Date: {new Date(booking.date).toISOString().split("T")[0]}</p>

                  <p>
                    Status:{" "}
                    <span
                      className={`badge ${
                        booking.status === "Initiated"
                          ? "bg-warning"
                          : booking.status === "Terminated"
                          ? "bg-danger"
                          : "bg-success"
                      }`}
                    >
                      {booking.status}
                    </span>
                  </p>

                  <div className="d-flex gap-2">
                    <button
                      className="btn btn-primary flex-fill"
                      onClick={() => handleViewDetails(booking)}
                    >
                      View Details
                    </button>

                    {(user?.type === "admin" ||
                      user?.type === "backdesk" ||
                      user?.type === "onsite") && (
                      <button
                        className="btn btn-info flex-fill"
                        onClick={() => handleUpdateBooking(booking)}
                      >
                        Update Booking
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className="text-center">No bookings found</p>
          )}
        </div>
      )}
    </div>
  );
}

export default Bookings;
