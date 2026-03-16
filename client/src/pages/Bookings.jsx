import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { getBookingsAPI } from "../services/operations/bookingAPI";
import { getEmployeesForBookingAPI } from "../services/operations/employeeAPI";
import { FiSliders } from "react-icons/fi";
import { Eye, Pencil } from "lucide-react";
import toast from "react-hot-toast";

import "bootstrap/dist/css/bootstrap.min.css";
import "./Bookings.css";

function Bookings({ user }) {
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const rangeParam = params.get("range");
  const createdParam = params.get("created");
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

  const today = new Date();
  const todayMonth = today.toISOString().slice(0, 7);

  const monthParam = params.get("month");
  const [selectedMonth, setSelectedMonth] = useState(
    monthParam || ""
  );


  // employee=John Doe~65ab123
  const employeeParam = params.get("employee");
  const parsedEmployeeId = employeeParam?.split("~")[1] || "";
  const [filterEmployee, setFilterEmployee] = useState(parsedEmployeeId);
  const [boardingPassBooking, setBoardingPassBooking] = useState();
  // ---------------- COLORS ----------------
  const statusColorMap = {
    pending: "info",
    confirmed: "success",
    cancelled: "danger",
    completed: "primary"
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
  // const fetchBookings = async (filters = {}) => {
  //   try {
  //     setLoading(true);
  //     const token = localStorage.getItem("authToken");
  //     const res = await getBookingsAPI(token, filters);
  //     setBookings(res?.data?.bookings || []);
  //   } catch (e) {
  //     console.error("❌ Error fetching bookings", e);
  //   } finally {
  //     setLoading(false);
  //   }
  // };
  const fetchBookings = async (filters = {}) => {
    try {
      setLoading(true);
      const token = localStorage.getItem("authToken");
      const res = await getBookingsAPI(token, filters);

      const updatedBookings = (res?.data?.bookings || []).map((booking) => {
        if (
          booking.status === "confirmed" &&
          isBookingCompleted(booking)
        ) {
          return { ...booking, status: "completed" };
        }
        return booking;
      });

      setBookings(updatedBookings);
    } catch (e) {
      console.error("❌ Error fetching bookings", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const p = new URLSearchParams(location.search);

    // 🔥 PRESERVE DASHBOARD PARAMS
    if (rangeParam) p.set("range", rangeParam);
    else p.delete("range");

    if (createdParam) p.set("created", createdParam);
    else p.delete("created");

    if (searchQuery) p.set("search", searchQuery);
    else p.delete("search");

    if (filterDate) p.set("date", filterDate);
    else p.delete("date");

    if (filterStatus) p.set("status", filterStatus);
    else p.delete("status");

    if (selectedMonth) p.set("month", selectedMonth);
    else p.delete("month");

    const employeeValue = getEmployeeParamValue();
    if (employeeValue) p.set("employee", employeeValue);
    else p.delete("employee");

    navigate({ search: p.toString() }, { replace: true });
  }, [
    searchQuery,
    filterDate,
    filterStatus,
    filterEmployee,
    selectedMonth,
    employees,
    rangeParam,
    createdParam,
  ]);

  // ---------------- FILTER / REFRESH → FETCH ----------------
  useEffect(() => {
    const filters = {};
    if (filterDate) filters.date = filterDate;
    // if (filterStatus) filters.status = filterStatus;
    if (filterStatus && filterStatus !== "completed") {
      filters.status = filterStatus;
    }

    if (filterEmployee) filters.employeeId = filterEmployee;

    fetchBookings(filters);
  }, [
    filterDate,
    filterStatus,
    filterEmployee,
    location.state?.refresh,
    rangeParam,
    createdParam,
  ]);

  useEffect(() => {
    if (rangeParam === "7days") {
      setSelectedMonth("");
      setFilterDate("");
    }
  }, [rangeParam]);
  // ---------------- AUTO SEARCH FROM NOTIFICATION ----------------
  useEffect(() => {
    if (location.state?.bookingId || location.state?.status) {
      setSearchQuery(location.state.bookingId?.slice(-5) || "");
      setFilterStatus(location.state.status || "");

      navigate(".", { replace: true, state: {} });
    }
  }, [location.state?.refresh]);


  // ---------------- ACTIONS ----------------
  const handleClear = () => {
    setSearchQuery("");
    setFilterDate("");
    setFilterStatus("");
    setFilterEmployee("");
    setSelectedMonth("");

      navigate("/bookings", { replace: true });
  };

  const isBookingCompleted = (booking) => {
    if (!booking.date || !booking.endTime) return false;

    const bookingEnd = new Date(booking.date);
    const [h, m] = booking.endTime.split(":").map(Number);

    bookingEnd.setHours(h, m, 0, 0);

    return bookingEnd < new Date();
  };

  const generateBoardingPass = (booking) => {
    const formatDate = (dateStr) => {
      const d = new Date(dateStr);
      return d.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    };

    const formatTime = (time24) => {
      let [h, m] = time24.split(":").map(Number);
      const period = h >= 12 ? "PM" : "AM";
      h = h % 12 || 12;
      return `${h}.${m.toString().padStart(2, "0")} ${period}`;
    };

    const tokenPaid = booking.quotedAmount - booking.pendingAmount;
    const tokenAmount = booking?.tokenAmount
    const sanitizeText = (text = "") =>
      text
        .replace(/\u2022|\u2023|\u25E6/g, "-")
        .replace(/\u200B|\u200C|\u200D|\uFEFF/g, "")
        .replace(/\r\n/g, "\n")
        .replace(/\n{2,}/g, "\n")
        .trim();

    const extraDetails = sanitizeText(booking.extraDetails || "");

    const lines = extraDetails.split("\n").map(l => l.trim()).filter(Boolean);

    const inclusions = lines.filter((i) =>
      ["Soft Drink", "Ice Cube", "Water Bottles", "Bluetooth Speaker", "Captain", "Snacks"]
        .some((k) => i.includes(k))
    );

    const paidServices = lines.filter((i) =>
      ["Drone - Photography & Videography", "DSLR Photography"].some((k) => i.includes(k))
    );

    const notes = extraDetails.includes("Notes:")
      ? extraDetails.split("Notes:").slice(1).join("Notes:").trim()
      : "";

    const isPending = booking.status === "pending";

    const hardCodedDisclaimer = `Disclaimer:
• Reporting time is 30 minutes prior to departure
• No refund for late arrival or no-show
• Subject to weather and government regulations
Thank you for booking with ${booking.company?.name}`

    const boardingPassText = `
# Ticket Number: ${booking._id.slice(-5).toUpperCase()}

Booking Status: ${booking.status.toUpperCase()}${isPending ? `
⚠️ NOTE: This is a TENTATIVE booking. Your slot is NOT yet confirmed. Please confirm by paying Token Amount.` : ""}

👤 Guest Name: ${booking.customerId?.name}
📞 Contact No.: ${booking.customerId?.contact}
👥 Group Size: ${booking.numPeople} Pax
⛵ Yacht Name: ${booking.yachtId?.name}

🗓️ Trip Date: ${formatDate(booking.date)} | ⏰ Time: ${formatTime(
      booking.startTime
    )} to ${formatTime(booking.endTime)}
(1 Hour Sailing + 1 Hour Anchor)

Booking Price: ₹${booking.quotedAmount}/-
${isPending && tokenAmount ? `
Token to be Paid: ₹${tokenAmount}/- (Please share screenshot Over WhatsApp)`:""}
${!isPending ? `
Token Paid: ₹${tokenPaid}/-
Balance Pending: ₹${booking.pendingAmount}/- (to be collected before boarding)` : ""}

📍 Boarding Location
🔗 ${isPending ? "Will be shared upon confirmation" : (booking.yachtId?.boardingLocation || "Location not provided")}

${inclusions.length
        ? `Extra Inclusions:\n${inclusions
          .map((i) => `• ${i.replace("-", "").trim()}`)
          .join("\n")}`
        : ""}

${paidServices.length
        ? `\nExtra Add On's Services:\n${paidServices
          .map((i) => `• ${i.replace("-", "").trim()}`)
          .join("\n")}`
        : ""}

${notes
        ? `\nNotes:\n• ${notes.replace(/\n/g, "\n• ")}`
        : ""}
`.trim() +
      `\n\n${booking?.company?.disclaimer
        ? `${booking.company.disclaimer}[${booking._id.slice(-5).toUpperCase()}]

Thank You`
        : hardCodedDisclaimer
      }
`;

    navigator.clipboard.writeText(boardingPassText);
    toast.success("Boarding Pass copied to clipboard");
  };


  const handleViewDetails = (booking) =>
    navigate("/customer-details", { state: { booking } });

  const handleCreateBooking = () => navigate("/create-booking", { state: { source: "bookings" } });

  const handleUpdateBooking = (booking) =>
    navigate("/update-booking", { state: { booking } });

  const filteredBookings = bookings
    // 🔥 0️⃣ Month / Date Filter (UI only)
    .filter((booking) => {
      const bookingDateObj = new Date(booking.date);
      const bookingDate = booking.date?.split("T")[0];

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      // ✅ CREATED TODAY FILTER (highest priority from dashboard)
      if (createdParam === "today") {
        const createdAt = new Date(booking.createdAt);

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        return (
          createdAt.getFullYear() === today.getFullYear() &&
          createdAt.getMonth() === today.getMonth() &&
          createdAt.getDate() === today.getDate() &&
          booking.status !== "cancelled"
        );
      }

      // ✅ 1️⃣ RANGE = 7 DAYS (highest priority from dashboard)
      if (rangeParam === "7days") {
        const next7Days = new Date(today);
        next7Days.setDate(today.getDate() + 7);

        return (
          bookingDateObj > today &&
          bookingDateObj <= next7Days
        );
      }

      // ✅ 2️⃣ Specific Date
      if (filterDate) {
        return bookingDate === filterDate;
      }

      // ✅ 3️⃣ If no month selected → show all
      if (!selectedMonth) {
        return true;
      }

      // ✅ 4️⃣ Month filter
      const year = bookingDateObj.getFullYear();
      const month = String(
        bookingDateObj.getMonth() + 1
      ).padStart(2, "0");

      return `${year}-${month}` === selectedMonth;
    })
    // 1️⃣ Status logic
    .filter((booking) => {
      if (filterStatus === "completed") {
        return (
          booking.status !== "cancelled" &&
          isBookingCompleted(booking)
        );
      }

      if (filterStatus) {
        return booking.status === filterStatus;
      }

      return (
        booking.status !== "cancelled" &&
        !isBookingCompleted(booking)
      );
    })

    // 2️⃣ Search filter
    .filter((booking) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();

      return (
        booking.customerId?.name?.toLowerCase().includes(q) ||
        booking.customerId?.contact?.includes(q) ||
        booking._id.toLowerCase().includes(q) ||
        booking._id.slice(-5).toLowerCase().includes(q) ||
        booking.yachtId?.name?.toLowerCase().includes(q)
      );
    })

    // 3️⃣ Sort
    .sort((a, b) => {
      const dateDiff = new Date(a.date) - new Date(b.date);
      if (dateDiff !== 0) return dateDiff;

      const timeDiff = a.startTime.localeCompare(b.startTime);
      if (timeDiff !== 0) return timeDiff;

      return a.yachtId?.name.localeCompare(b.yachtId?.name);
    });


  return (
    <div className="container mt-1">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div className="d-flex align-items-center gap-2">
          <h2 className="mb-0">Bookings</h2>
          <span className="booking-count-badge">{filteredBookings.length}</span>
        </div>
        {(user?.type === "admin" || user?.type === "backdesk") && (
          <button className="btn btn-success rounded-pill px-3" onClick={handleCreateBooking}>
            + Quotaion
          </button>
        )}
      </div>

      {/* Filters */}
      {!isMobile && (
        <div className="filter-bar d-flex flex-wrap gap-2 mb-3 align-items-center">
          {/* Search */}
          <div className="filter-input-wrapper">
            <span className="filter-icon">🔍</span>
            <input
              type="text"
              className="form-control filter-input"
              placeholder="Name / Ticket / Phone"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ maxWidth: "220px", paddingLeft: "2rem" }}
            />
          </div>

          {/* Month */}
          <select
            className={`form-select filter-select ${selectedMonth ? "filter-active" : ""}`}
            value={selectedMonth || ""}
            onChange={(e) => {
              setSelectedMonth(e.target.value);
              setFilterDate("");
            }}
            style={{ maxWidth: "110px" }}
          >
            <option value="">📅 Month</option>
            {Array.from({ length: 6 }).map((_, i) => {
              const date = new Date();
              date.setMonth(date.getMonth() + i);
              const value = date.toISOString().slice(0, 7);
              const label = date.toLocaleString("en-GB", { month: "short", year: "2-digit" });
              return (
                <option key={value} value={value}>{label}</option>
              );
            })}
          </select>

          {/* Specific Date Picker */}
          <input
            type="date"
            className={`form-control filter-select ${filterDate ? "filter-active" : ""}`}
            value={filterDate}
            min={new Date().toISOString().split("T")[0]}
            onChange={(e) => setFilterDate(e.target.value)}
            style={{ maxWidth: "150px" }}
            title="Filter by specific date"
          />

          {/* Agent */}
          <select
            className={`form-select filter-select ${filterEmployee ? "filter-active" : ""}`}
            value={filterEmployee}
            onChange={(e) => setFilterEmployee(e.target.value)}
            style={{ maxWidth: "150px" }}
          >
            <option value="">👤 All Agents</option>
            {employees.map((emp) => (
              <option key={emp._id} value={emp._id}>{emp.name}</option>
            ))}
          </select>

          {/* Status */}
          <select
            className={`form-select filter-select ${filterStatus ? "filter-active" : ""}`}
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            style={{ maxWidth: "140px" }}
          >
            <option value="">🔖 All Status</option>
            <option value="pending">🟡 Pending</option>
            <option value="confirmed">🟢 Confirmed</option>
            <option value="completed">🔵 Completed</option>
            <option value="cancelled">🔴 Cancelled</option>
          </select>

          {/* Clear — only visible when any filter is active */}
          {(searchQuery || filterDate || filterStatus || filterEmployee || selectedMonth) && (
            <button className="btn btn-clear-filter" onClick={handleClear} title="Clear all filters">
              ✕ Clear
            </button>
          )}
        </div>
      )}

      {isMobile && (
        <div className="d-flex align-items-center gap-2 mb-3">
          {/* Search Bar */}
          <div className="filter-input-wrapper" style={{ flex: 1 }}>
            <span className="filter-icon">🔍</span>
            <input
              type="text"
              className="form-control filter-input"
              placeholder="Name / Ticket / Phone"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: "2rem" }}
            />
            {searchQuery && (
              <button
                className="filter-clear-x"
                onClick={() => setSearchQuery("")}
                title="Clear search"
              >✕</button>
            )}
          </div>

          {/* Filter Icon with active badge */}
          <button
            className={`btn mobile-filter-btn ${[filterDate, filterStatus, filterEmployee, selectedMonth].filter(Boolean).length > 0 ? "has-active" : ""}`}
            onClick={() => setShowFilters(true)}
            title="Open filters"
          >
            <FiSliders size={20} />
            {[filterDate, filterStatus, filterEmployee, selectedMonth].filter(Boolean).length > 0 && (
              <span className="filter-badge">
                {[filterDate, filterStatus, filterEmployee, selectedMonth].filter(Boolean).length}
              </span>
            )}
          </button>
        </div>
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
            {/* Drawer handle + header */}
            <div className="drawer-handle" />
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h6 className="mb-0 fw-semibold">Filters</h6>
              {[filterDate, filterStatus, filterEmployee, selectedMonth].filter(Boolean).length > 0 && (
                <button className="btn btn-link btn-sm p-0 text-danger text-decoration-none" onClick={handleClear}>
                  Clear all
                </button>
              )}
            </div>

            <label className="form-label small text-muted mb-1">Month</label>
            <select
              className={`form-select mb-3 ${selectedMonth ? "filter-active" : ""}`}
              value={selectedMonth}
              onChange={(e) => {
                setSelectedMonth(e.target.value);
                setFilterDate("");
              }}
            >
              <option value="">All Months</option>
              {Array.from({ length: 6 }).map((_, i) => {
                const date = new Date();
                date.setMonth(date.getMonth() + i);
                const value = date.toISOString().slice(0, 7);
                const label = date.toLocaleString("en-GB", { month: "long", year: "numeric" });
                return <option key={value} value={value}>{label}</option>;
              })}
            </select>

            <label className="form-label small text-muted mb-1">Specific Date</label>
            <input
              type="date"
              className={`form-control mb-3 ${filterDate ? "filter-active" : ""}`}
              value={filterDate}
              min={new Date().toISOString().split("T")[0]}
              onChange={(e) => setFilterDate(e.target.value)}
            />

            <label className="form-label small text-muted mb-1">Agent</label>
            <select
              className={`form-select mb-3 ${filterEmployee ? "filter-active" : ""}`}
              value={filterEmployee}
              onChange={(e) => setFilterEmployee(e.target.value)}
            >
              <option value="">All Agents</option>
              {employees.map((emp) => (
                <option key={emp._id} value={emp._id}>{emp.name}</option>
              ))}
            </select>

            <label className="form-label small text-muted mb-1">Status</label>
            <div className="status-pill-group mb-4">
              {[
                { value: "", label: "All", color: "#6c757d" },
                { value: "pending", label: "Pending", color: "#0dcaf0" },
                { value: "confirmed", label: "Confirmed", color: "#198754" },
                { value: "completed", label: "Completed", color: "#0d6efd" },
                { value: "cancelled", label: "Cancelled", color: "#dc3545" },
              ].map(({ value, label, color }) => (
                <button
                  key={value}
                  className={`status-pill ${filterStatus === value ? "active" : ""}`}
                  style={{ "--pill-color": color }}
                  onClick={() => setFilterStatus(value)}
                >
                  {label}
                </button>
              ))}
            </div>

            <button
              className="btn btn-primary w-100 rounded-pill"
              onClick={() => setShowFilters(false)}
            >
              Show {filteredBookings.length} Bookings
            </button>
          </div>
        </div>
      )}

      {/* BOOKINGS – ORIGINAL CARD UI */}
      {loading ? (
        <div className="text-center py-5 text-muted">
          <div className="spinner-border spinner-border-sm me-2" role="status" />
          Loading bookings...
        </div>
      ) : (
        <div className="row">
          {filteredBookings.length > 0 ? (
            filteredBookings.map((booking) => {
              const statusColor =
                statusColorMap[booking.status] || "info";

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

                          {/* Ticket + Call on same line */}
                          <small className="d-flex align-items-center gap-3">
                            <small className="text-muted">
                              Ticket #{booking._id.slice(-5).toUpperCase()}
                            </small>

                            <a
                              href={`tel:${booking?.customerId?.contact}`}
                              className="text-decoration-none text-dark d-inline-flex align-items-center gap-1"
                            >
                              📞 {booking?.customerId?.contact}
                            </a>
                          </small>
                        </div>

                        <span
                          className={`badge bg-${statusColor} bg-opacity-10 text-${statusColor}`}
                        >
                          {booking.status?.charAt(0).toUpperCase() + booking.status?.slice(1)}
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
                        {/* {booking.employeeId?.type == "backdesk" && user.type != "backdesk" && */}
                        <div className="fw-semibold text-dark">
                          🧑‍💼 Agent: {booking.employeeId?.name}
                        </div>
                        {/* } */}
                      </div>
                      <div className="d-flex gap-2 mt-1 align-items-center">
                        {/* VIEW (icon only) */}
                        <button
                          className="btn btn-sm btn-outline-secondary rounded-circle d-flex align-items-center justify-content-center"
                          title="View Booking"
                          style={{ width: 34, height: 34 }}
                          onClick={() => handleViewDetails(booking)}
                        >
                          <Eye size={16} />
                        </button>

                        {/* EDIT (icon only) */}
                        {(user?.type === "admin" || user?.type === "backdesk") && !isBookingCompleted(booking) && (
                          <button
                            className="btn btn-sm btn-outline-primary rounded-circle d-flex align-items-center justify-content-center"
                            title="Edit Booking Details"
                            style={{ width: 34, height: 34 }}
                            onClick={() =>
                              navigate("/edit-booking", { state: { booking } })
                            }
                          >
                            <Pencil size={16} />
                          </button>
                        )}
                        {(booking.status === "confirmed" || booking.status === "pending") && (
                          <>
                            {/* 📋 Copy Boarding Pass / Tentative Pass */}
                            <button
                              className={`btn btn-sm flex-grow-1 rounded-pill ${booking.status === "confirmed" ? "btn-outline-success" : "btn-outline-warning"}`}
                              title={booking.status === "pending" ? "Copy Tentative Pass" : "Copy Boarding Pass"}
                              onClick={() => generateBoardingPass(booking)}
                            >
                              {booking.status === "pending" ? "Pass" : "Pass"}
                            </button>
                          </>
                        )}


                        {/* UPDATE (take remaining space) */}
                        {(user?.type === "admin" || user?.type === "onsite") && (
                          <button
                            className="btn btn-sm btn-outline-info flex-grow-1 rounded-pill"
                            title="Update Payment / Status"
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
            <div className="text-center py-5 text-muted">
              <div style={{ fontSize: "2.5rem" }}>🔍</div>
              <p className="mt-2 mb-1 fw-semibold">No bookings found</p>
              <small>Try adjusting your filters</small>
              {(searchQuery || filterDate || filterStatus || filterEmployee || selectedMonth) && (
                <div className="mt-2">
                  <button className="btn btn-sm btn-outline-secondary rounded-pill" onClick={handleClear}>Clear filters</button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default Bookings;