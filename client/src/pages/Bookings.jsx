import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { getBookingsAPI } from "../services/operations/bookingAPI";
import { getEmployeesForBookingAPI } from "../services/operations/employeeAPI";
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

  // Screen
  const [isMobile, setIsMobile] = useState(window.innerWidth < 550);
  const [showFilters, setShowFilters] = useState(false);

  // ---------------- FILTER STATES (FROM URL) ----------------
  const [searchQuery, setSearchQuery] = useState(params.get("search") || "");
  const [filterDate, setFilterDate] = useState(params.get("date") || "");
  const [filterStatus, setFilterStatus] = useState(params.get("status") || "");

  // employee=John Doe~65ab123
  const employeeParam = params.get("employee");
  const parsedEmployeeId = employeeParam?.split("~")[1] || "";
  const [filterEmployee, setFilterEmployee] = useState(parsedEmployeeId);

  // ---------------- COLORS ----------------
  const statusColorMap = {
    pending: "info",
    confirmed: "success",
    cancelled: "danger",
  };

  // ---------------- SCREEN RESIZE ----------------
  useEffect(() => {
    const onResize = () => {
      const mobile = window.innerWidth < 550;
      setIsMobile(mobile);
      if (!mobile) setShowFilters(false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // ---------------- HELPERS ----------------
  const to12HourFormat = (time24) => {
    if (!time24) return "";
    let [hour, minute] = time24.split(":").map(Number);
    const period = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 === 0 ? 12 : hour % 12;
    return `${hour12}:${String(minute).padStart(2, "0")} ${period}`;
  };

  const getEmployeeParamValue = () => {
    if (!filterEmployee) return "";
    const emp = employees.find((e) => e._id === filterEmployee);
    return emp ? `${encodeURIComponent(emp.name)}~${emp._id}` : "";
  };

  // ---------------- FETCH EMPLOYEES ----------------
  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const token = localStorage.getItem("authToken");
        const res = await getEmployeesForBookingAPI(token);
        setEmployees(res?.data?.employees || []);
      } catch (e) {
        console.error("❌ Failed to load employees", e);
      }
    };

    fetchEmployees();
  }, []);

  // ---------------- FETCH BOOKINGS ----------------
  const fetchBookings = async (filters = {}) => {
    try {
      setLoading(true);
      const token = localStorage.getItem("authToken");
      const res = await getBookingsAPI(token, filters);
      setBookings(res?.data?.bookings || []);
    } catch (e) {
      console.error("❌ Error fetching bookings", e);
    } finally {
      setLoading(false);
    }
  };

  // ---------------- URL SYNC ----------------
  useEffect(() => {
    const p = new URLSearchParams();

    if (searchQuery) p.set("search", searchQuery);
    if (filterDate) p.set("date", filterDate);
    if (filterStatus) p.set("status", filterStatus);

    const employeeValue = getEmployeeParamValue();
    if (employeeValue) p.set("employee", employeeValue);

    navigate({ search: p.toString() }, { replace: true });
  }, [searchQuery, filterDate, filterStatus, filterEmployee, employees]);

  // ---------------- FILTER / REFRESH → FETCH ----------------
  useEffect(() => {
    const filters = {};
    if (filterDate) filters.date = filterDate;
    if (filterStatus) filters.status = filterStatus;
    if (filterEmployee) filters.employeeId = filterEmployee;

    fetchBookings(filters);
  }, [
    filterDate,
    filterStatus,
    filterEmployee,
    location.state?.refresh, // 🔥 notification refresh
  ]);

  // ---------------- AUTO SEARCH FROM NOTIFICATION ----------------
  useEffect(() => {
    if (location.state?.bookingId) {
      setSearchQuery(location.state.bookingId.slice(-5));
    }
  }, [location.state?.refresh]);

  // ---------------- ACTIONS ----------------
  const handleClear = () => {
    setSearchQuery("");
    setFilterDate("");
    setFilterStatus("");
    setFilterEmployee("");
  };

  const handleViewDetails = (booking) =>
    navigate("/customer-details", { state: { booking } });

  const handleCreateBooking = () => navigate("/create-booking");

  const handleUpdateBooking = (booking) =>
    navigate("/update-booking", { state: { booking } });

  // ---------------- SMART SEARCH (FRONTEND) ----------------
  const filteredBookings = bookings.filter((booking) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();

    return (
      booking.customerId?.name?.toLowerCase().includes(q) ||
      booking.customerId?.contact?.includes(q) ||
      booking._id.toLowerCase().includes(q) ||
       booking.company?.name?.toLowerCase().includes(q) ||  
      booking._id.slice(-5).toLowerCase().includes(q)
    );
  });
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
      {!isMobile && (
        <div className="d-flex flex-wrap gap-2 mb-3">
          <input
            type="text"
            className="form-control"
            placeholder="Search Name / Ticket / Phone"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ maxWidth: "260px" }}
          />

          <input
            type="date"
            className="form-control"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            style={{ maxWidth: "140px" }}
          />

          <select
            className="form-select"
            value={filterEmployee}
            onChange={(e) => setFilterEmployee(e.target.value)}
            style={{ maxWidth: "160px" }}
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
            style={{ maxWidth: "140px" }}
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
      )}

      {/* Mobile */}
      {isMobile && (
        <button
          className="btn btn-outline-primary w-100 mb-3"
          onClick={() => setShowFilters(true)}
        >
          🔍 Filters & Search
        </button>
      )}

      {isMobile && showFilters && (
        <div
          className="mobile-filter-backdrop"
          onClick={() => setShowFilters(false)}
        >
          <div
            className="mobile-filter-drawer"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              type="text"
              className="form-control mb-2"
              placeholder="Search Name / Ticket / Phone"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />

            <input
              type="date"
              className="form-control mb-2"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
            />

            <select
              className="form-select mb-2"
              value={filterEmployee}
              onChange={(e) => setFilterEmployee(e.target.value)}
            >
              <option value="">All Agents</option>
              {employees.map((emp) => (
                <option key={emp._id} value={emp._id}>
                  {emp.name}
                </option>
              ))}
            </select>

            <select
              className="form-select mb-3"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="cancelled">Cancelled</option>
            </select>

            <div className="d-flex gap-2">
              <button className="btn btn-secondary flex-fill" onClick={handleClear}>
                Clear
              </button>
              <button
                className="btn btn-primary flex-fill"
                onClick={() => setShowFilters(false)}
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BOOKINGS – ORIGINAL CARD UI */}
      {loading ? (
        <p className="text-center text-muted">Loading bookings...</p>
      ) : (
        <div className="row mt-2">
          {filteredBookings.length > 0 ? (
            filteredBookings.map((booking) => {
              const statusColor =
                statusColorMap[booking.status] || "secondary";

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
                          📅 <b>Date:</b> {booking.date?.split("T")[0]}
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

                        {(user?.type === "admin" ||
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
