import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { getBookingsAPI } from "../services/operations/bookingAPI";
import { getAllEmployeesAPI, getEmployeesForBookingAPI } from "../services/operations/employeeAPI";
import "bootstrap/dist/css/bootstrap.min.css";
import "./Bookings.css";

function Bookings({ user }) {
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);

  // ---------------- STATE ----------------
  const [bookings, setBookings] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);

  // --------------- COLORS ----------------
  const statusColorMap = {
    pending: "info",
    confirmed: "success",
    cancelled: "danger",
  };

  // ---------------- FILTERS ----------------
  const [filterDate, setFilterDate] = useState(params.get("date") || "");
  const [filterStatus, setFilterStatus] = useState(params.get("status") || "");
  const [filterEmployee, setFilterEmployee] = useState(
    params.get("employeeId") || ""
  );

  // ---------------- HELPERS ----------------
  const to12HourFormat = (time24) => {
    if (!time24) return "";
    let [hour, minute] = time24.split(":").map(Number);
    hour = hour % 24;
    const period = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 === 0 ? 12 : hour % 12;
    return `${hour12}:${String(minute).padStart(2, "0")} ${period}`;
  };

  // ---------------- FETCH EMPLOYEES ----------------
  const fetchEmployees = async () => {
    try {
      const token = localStorage.getItem("authToken");
      const res = await getEmployeesForBookingAPI(token);

      // keep it minimal – no UI logic change
      setEmployees(res?.data?.employees || []);
    } catch (error) {
      console.error("❌ Failed to load employees", error);
    }
  };

  // ---------------- FETCH BOOKINGS ----------------
  const fetchBookings = async (filters = {}) => {
    try {
      setLoading(true);
      const token = localStorage.getItem("authToken");
      const res = await getBookingsAPI(token, filters);
      setBookings(res?.data?.bookings || []);
    } catch (error) {
      console.error("❌ Error fetching bookings:", error);
    } finally {
      setLoading(false);
    }
  };

  // ---------------- URL SYNC ----------------
  useEffect(() => {
    const p = new URLSearchParams();
    if (filterDate) p.set("date", filterDate);
    if (filterStatus) p.set("status", filterStatus);
    if (filterEmployee) p.set("employeeId", filterEmployee);

    navigate({ search: p.toString() }, { replace: true });
  }, [filterDate, filterStatus, filterEmployee]);

  // ---------------- FILTER CHANGE → FETCH ----------------
  useEffect(() => {
    const filters = {};
    if (filterDate) filters.date = filterDate;
    if (filterStatus) filters.status = filterStatus;
    if (filterEmployee) filters.employeeId = filterEmployee;

    fetchBookings(filters);
  }, [filterDate, filterStatus, filterEmployee]);

  // ---------------- INITIAL LOAD ----------------
  useEffect(() => {
    fetchEmployees();
    fetchBookings(); // backend handles today onwards
  }, []);

  // ---------------- ACTIONS ----------------
  const handleClear = () => {
    setFilterDate("");
    setFilterStatus("");
    setFilterEmployee("");
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

      {/* Filters (DESIGN UNCHANGED) */}
      <div className="d-flex flex-wrap gap-2 mb-3">
        <input
          type="date"
          className="form-control"
          value={filterDate}
          onChange={(e) => setFilterDate(e.target.value)}
          style={{ maxWidth: "100px" }}
        />

        {/* Agent filter – added without styling change */}
        <select
          className="form-select"
          value={filterEmployee}
          onChange={(e) => setFilterEmployee(e.target.value)}
          style={{ maxWidth: "120px" }}
        >
          <option value="">All Agents</option>
          {employees.map((emp) => (
            <option key={emp._id} value={emp._id}>
              {emp.name}
            </option>
          ))}
        </select>

        <select
          className="form-select"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          style={{ maxWidth: "100px" }}
        >
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="confirmed">Confirmed</option>
          <option value="cancelled">Cancelled</option>
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
              const statusColor = statusColorMap[booking.status] || "secondary";

              return (
                <div key={booking._id} className="col-lg-4 col-md-6 mb-3">
                  <div
                    className={`card border-0 shadow-sm h-100 border-start border-4 border-${statusColor} booking-card`}
                  >
                    <div className="card-body p-3">
                      <div className="d-flex justify-content-between align-items-start mb-2">
                        <div>
                          <h6 className="mb-0 fw-semibold text-dark">
                            {booking.customerId?.name}
                          </h6>
                          <small className="text-muted">
                            Ticket #{booking._id.slice(-5).toUpperCase()}
                          </small>
                        </div>

                        <span
                          className={`badge bg-${statusColor} bg-opacity-10 text-${statusColor}`}
                        >
                          {booking.status}
                        </span>
                      </div>

                      <hr className="my-2" />

                      <div className="small text-muted booking-info">
                        <div>🚤 <b>Yacht:</b> {booking.yachtId?.name}</div>
                        <div>
                          📅 <b>Date:</b>{" "}
                          {booking.date?.split("T")[0]}
                        </div>
                        <div>
                          ⏰ <b>Time:</b>{" "}
                          {to12HourFormat(booking.startTime)} –{" "}
                          {to12HourFormat(booking.endTime)}
                        </div>
                        <div className="fw-semibold text-dark">
                          💰 Balance: {booking.pendingAmount}
                        </div>
                      </div>

                      <div className="d-flex gap-2 mt-3">
                        <button
                          className="btn btn-sm btn-outline-primary flex-fill rounded-pill"
                          onClick={() => handleViewDetails(booking)}
                        >
                          View
                        </button>

                        {(user?.type === "admin" || user?.type === "onsite") && (
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
