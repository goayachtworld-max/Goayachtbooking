import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { getBookingsAPI } from "../services/operations/bookingAPI";
import { getEmployeesForBookingAPI } from "../services/operations/employeeAPI";
import { FiSliders } from "react-icons/fi";
import { Eye, Pencil } from "lucide-react";
import jsPDF from "jspdf";
import toast from "react-hot-toast";

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
    location.state?.refresh, // 🔥 notification refresh
  ]);

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

    // Split inclusions & paid services if you store them together
    const inclusions = booking.extraDetails
      ? booking.extraDetails
        .split("\n")
        .filter((i) =>
          ["Soft Drink", "Ice Cube", "Water Bottles", "Bluetooth Speaker", "Captain", "Snacks"]
            .some((k) => i.includes(k))
        )
      : [];

    const paidServices = booking.extraDetails
      ? booking.extraDetails
        .split("\n")
        .filter((i) =>
          ["Drone", "DSLR"].some((k) => i.includes(k))
        )
      : [];

    const notes = booking.extraDetails
      ? booking.extraDetails.split("Notes:").slice(1).join("Notes:").trim()
      : "";

    const hardCodedDisclaimer = `Disclaimer:
• Reporting time is 30 minutes prior to departure
• No refund for late arrival or no-show
• Subject to weather and government regulations
Thank you for booking with ${booking.company?.name}`

    const boardingPassText = `
# Ticket Number: ${booking._id.slice(-5).toUpperCase()}

Booking Status: ${booking.status.toUpperCase()}

👤 Guest Name: ${booking.customerId?.name}
📞 Contact No.: ${booking.customerId?.contact}
👥 Group Size: ${booking.numPeople} Pax
⛵ Yacht Name: ${booking.yachtId?.name}

🗓️ Trip Date: ${formatDate(booking.date)} | ⏰ Time: ${formatTime(
      booking.startTime
    )} to ${formatTime(booking.endTime)}
(1 Hour Sailing + 1 Hour Anchor)

Booking Price: ₹${booking.quotedAmount}/-

Token Paid: ₹${tokenPaid}/-
Balance Pending: ₹${booking.pendingAmount}/- (to be collected before boarding)

📍 Boarding Location
🔗 ${booking.yachtId?.boardingLocation || "Location not provided"}

Inclusions:
${inclusions.length ? inclusions.map((i) => `• ${i.replace("-", "").trim()}`).join("\n") : "• As discussed"}

${paidServices.length ? paidServices.map((i) => `Extra Paid Services:\n• ${i.replace("-", "").trim()}`).join("\n") : ""}

${notes ? `Notes:\n${notes.replace(/\n/g, "\n• ")}` : ""}
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

  const handleCreateBooking = () => navigate("/create-booking");

  const handleUpdateBooking = (booking) =>
    navigate("/update-booking", { state: { booking } });

  // const filteredBookings = bookings
  //   .filter((booking) => {
  //     // If user selected a status → respect it
  //     if (filterStatus) {
  //       return booking.status === filterStatus;
  //     }

  //     // No status selected → hide cancelled by default
  //     return booking.status !== "cancelled";
  //   })
  //   // 2️⃣ Search filter
  //   .filter((booking) => {
  //     if (!searchQuery) return true;
  //     const q = searchQuery.toLowerCase();

  //     return (
  //       booking.customerId?.name?.toLowerCase().includes(q) ||
  //       booking.customerId?.contact?.includes(q) ||
  //       booking._id.toLowerCase().includes(q) ||
  //       booking.company?.name?.toLowerCase().includes(q) ||
  //       booking._id.slice(-5).toLowerCase().includes(q) ||
  //       booking.yachtId?.name?.toLowerCase().includes(q)
  //     );
  //   })
  //   // 3️⃣ Sort: Date → Time → Yacht
  //   .sort((a, b) => {
  //     const dateDiff = new Date(a.date) - new Date(b.date);
  //     if (dateDiff !== 0) return dateDiff;

  //     const timeDiff = a.startTime.localeCompare(b.startTime);
  //     if (timeDiff !== 0) return timeDiff;

  //     return a.yachtId?.name.localeCompare(b.yachtId?.name);
  //   });

  const filteredBookings = bookings
    // 1️⃣ Status logic (including virtual "completed")
    .filter((booking) => {
      // COMPLETED (virtual)
      if (filterStatus === "completed") {
        return (
          booking.status !== "cancelled" &&
          isBookingCompleted(booking)
        );
      }

      // REAL STATUS selected
      if (filterStatus) {
        return booking.status === filterStatus;
      }

      // DEFAULT → hide cancelled & completed
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
      <div className="d-flex justify-content-between align-items-center mb-1">
        <div className="d-flex justify-content-between gap-2 align-items-center">
          <h2>Bookings</h2>
          <span
            className={`badge bg-success bg-opacity-10 text-success`}
          >{filteredBookings.length}</span>
        </div>
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
            placeholder="Search Name/Ticket/Phone/Company"
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

          {/* <select
            className="form-select"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            style={{ maxWidth: "140px" }}
          >
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="cancelled">Cancelled</option>
          </select> */}
          <select
            className="form-select"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            style={{ maxWidth: "140px" }}
          >
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>


          <button className="btn btn-secondary" onClick={handleClear}>
            Clear
          </button>
        </div>
      )}

      {isMobile && (
        <div className="d-flex align-items-center gap-2 mb-3">
          {/* Search Bar (≈90%) */}
          <input
            type="text"
            className="form-control"
            placeholder="Search name / ticket / phone"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ flex: 1 }}
          />

          {/* Filter Icon (no border) */}
          <button
            className="btn p-0 d-flex align-items-center justify-content-center"
            style={{ width: "40px", height: "40px" }}
            onClick={() => setShowFilters(true)}
          >
            <FiSliders size={22} />
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
            {/* <input
              type="text"
              className="form-control mb-2"
              placeholder="Search Name / Ticket / Phone"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            /> */}

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

            {/* <select
              className="form-select mb-3"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="cancelled">Cancelled</option>
            </select> */}
            <select
              className="form-select mb-3"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="completed">Completed</option>
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
        <div className="row">
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

                        {booking.status == "confirmed" && <button
                          className="btn btn-sm btn-outline-success flex-grow-1 rounded-pill"
                          title="Boarding Pass"
                          onClick={() => generateBoardingPass(booking)}
                        >
                          Boarding Pass
                        </button>
                        }

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
            <p className="text-center text-muted">No bookings found</p>
          )}
        </div>
      )}
    </div>
  );
}

export default Bookings;
