import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { getBookingsAPI } from "../services/operations/bookingAPI";
import "./Bookings.css"

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

  const to12HourFormat = (time24) => {
    if (!time24) return "";
    let [hour, minute] = time24.split(":").map(Number);
    // ✅ normalize hour (24 → 0, 25 → 1, etc.)
    hour = hour % 24;
    const period = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 === 0 ? 12 : hour % 12;
    return `${hour12}:${String(minute).padStart(2, "0")} ${period}`;
  };

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
      console.log("Here are bookins ", bookings)
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
          style={{ maxWidth: "100px" }}
          min={new Date().toISOString().split("T")[0]}
        />

        <select
          className="form-select"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          style={{ maxWidth: "100px" }}
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

      {loading ? (
        <p className="text-center text-muted">Loading bookings...</p>
      ) : (
        <div className="row mt-2">
          {bookings.length > 0 ? (
            bookings.map((booking) => {
              const statusColor =
                booking.status === "Initiated"
                  ? "warning"
                  : booking.status === "Terminated"
                    ? "danger"
                    : "success";

              return (
                <div key={booking._id} className="col-lg-4 col-md-6 mb-3">
                  <div
                    className={`card border-0 shadow-sm h-100 border-start border-4 border-${statusColor} booking-card`}
                  >
                    <div className="card-body p-3">
                      {/* Header */}
                      <div className="d-flex justify-content-between align-items-start mb-2">
                        <div>
                          <h6 className="mb-0 fw-semibold text-dark">
                            {booking.customerId?.name}
                          </h6>
                          <small className="text-muted">
                            Ticket #{booking._id.slice(-5).toUpperCase()}
                          </small>
                        </div>

                        <span className={`badge bg-${statusColor} bg-opacity-10 text-${statusColor}`}>
                          {booking.status}
                        </span>
                      </div>

                      <hr className="my-2" />

                      {/* Info Grid */}
                      <div className="small text-muted booking-info">
                        <div>🚤 <b>Yacht:</b> {booking.yachtId?.name}</div>
                        <div>📅 <b>Date:</b> {new Date(booking.date).toISOString().split("T")[0]}</div>
                        <div>⏰ <b>Time:</b> {to12HourFormat(booking.startTime)} – {to12HourFormat(booking.endTime)}</div>
                        <div className="fw-semibold text-dark">
                          💰 Pending: {booking.pendingAmount}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="d-flex gap-2 mt-3">
                        <button
                          className="btn btn-sm btn-outline-primary flex-fill rounded-pill"
                          onClick={() => handleViewDetails(booking)}
                        >
                          View
                        </button>

                        {(user?.type === "admin" ||
                          user?.type === "backdesk" ||
                          user?.type === "onsite") && (
                            <button
                              className="btn btn-sm btn-outline-info flex-fill rounded-pill"
                              onClick={() => handleUpdateBooking(booking)}
                            >
                              Update
                            </button>
                          )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-center text-muted">No bookings found</p>
          )}
        </div>
      )}

    </div>
  );
}

export default Bookings;
