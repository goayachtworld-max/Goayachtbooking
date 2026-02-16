import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { PDFDownloadLink } from "@react-pdf/renderer";
import { Download } from "lucide-react";
import BoardingPassPDF from "./BoardingPassPDF";

/* ------------------ Trip Steps ------------------ */
const TRIP_STEPS = [
  { key: "pending", label: "Pending" },
  { key: "initiated", label: "Confirmed" },
  { key: "success", label: "Completed" },
];

const STATUS_INDEX = {
  pending: 0,
  initiated: 1,
  success: 2,
};

/* ------------------ Trip Progress ------------------ */
const TripProgress = ({ tripStatus }) => {
  if (!tripStatus) return null;

  if (tripStatus === "cancelled") {
    return (
      <div className="alert alert-danger text-center fw-semibold mb-3">
        ❌ Trip Cancelled
      </div>
    );
  }

  const activeIndex = STATUS_INDEX[tripStatus] ?? 0;
  const progressPercent = (activeIndex / (TRIP_STEPS.length - 1)) * 100;

  return (
    <div className="mb-1">
      {/* Progress bar */}
      <div className="progress mb-3" style={{ height: "6px" }}>
        <div
          className="progress-bar bg-success"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Steps */}
      <div className="d-flex justify-content-between">
        {TRIP_STEPS.map((step, index) => {
          const completed = index <= activeIndex;
          return (
            <div key={step.key} className="text-center flex-fill">
              <div
                className={`rounded-circle mx-auto mb-1 d-flex align-items-center justify-content-center fw-bold ${completed ? "bg-success text-white" : "bg-light text-muted"
                  }`}
                style={{ width: 20, height: 20 }}
              >
                {completed ? "✓" : index + 1}
              </div>
              <small
                className={`fw-semibold ${completed ? "text-success" : "text-muted"
                  }`}
              >
                {step.label}
              </small>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ------------------ Main Page ------------------ */
function CustomerDetails() {
  const location = useLocation();
  const navigate = useNavigate();

  const { booking } = location.state || {};
  const customer = booking?.customerId || {};

  if (!booking) {
    return (
      <div className="container text-center mt-5">
        <h5>No booking data found</h5>
        <button className="btn btn-primary mt-3" onClick={() => navigate(-1)}>
          Go Back
        </button>
      </div>
    );
  }

  /* ---------------- Helpers ---------------- */
  const to12HourFormat = (time24) => {
    if (!time24) return "-";
    let [hour, minute] = time24.split(":").map(Number);
    hour = hour % 24;
    const period = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 === 0 ? 12 : hour % 12;
    return `${hour12}:${String(minute).padStart(2, "0")} ${period}`;
  };

  const bookingDate = booking.date
    ? new Date(booking.date).toLocaleDateString()
    : "-";

  const ticketId = booking._id
    ? booking._id.slice(-5).toUpperCase()
    : "-----";

  return (
    <div
      className="container-fluid d-flex justify-content-center align-items-start"
      style={{
        minHeight: "calc(100vh - 70px)", // adjust if navbar height differs
        overflow: "hidden",
        paddingTop: "12px",
      }}
    >
      <div className="col-12 col-md-8 col-lg-6">
        {/* Header */}
        <div className="text-center mb-1">
          <h5 className="fw-bold mb-1">Booking Details</h5>
          <span className="badge bg-dark">
            Ticket #{ticketId}
          </span>
        </div>

        {/* Progress */}
        <TripProgress tripStatus={booking.tripStatus} />

        {/* Card */}
        <div className="card shadow-sm">
          <div className="card-body p-3">
            <div className="d-flex flex-column gap-2 small">
              <p className="m-0">
                <strong>Customer:</strong> {customer.name || "N/A"}
              </p>
              <p className="m-0">
                <strong>Contact:</strong> {customer.contact || "N/A"}
              </p>
              <p className="m-0">
                <strong>Email:</strong> {customer.email || "N/A"}
              </p>

              <hr className="my-2" />

              <p className="m-0">
                <strong>Date:</strong> {bookingDate}
              </p>
              <p className="m-0">
                <strong>Start:</strong>{" "}
                {to12HourFormat(booking.startTime)}
              </p>
              <p className="m-0">
                <strong>End:</strong>{" "}
                {to12HourFormat(booking.endTime)}
              </p>
              <p className="m-0">
                <strong>People:</strong> {booking.numPeople}
              </p>

              <hr className="my-2" />

              <p className="m-0">
                <strong>Booking Status:</strong>{" "}
                <span className="text-capitalize">
                  {booking.status}
                </span>
              </p>
              <p className="m-0">
                <strong>Balance:</strong> ₹{booking.pendingAmount ?? 0}
              </p>

              {/* {booking?.extraDetails && <> 
                <hr className="my-2" />
                <p className="m-0">
                  <strong>Extra Details : </strong>
                  <span>{booking.extraDetails}</span>
                </p>
              </>} */}
              {booking?.extraDetails && (
                <>
                  <hr className="my-2" />
                  <strong>Extra Details : </strong>
                  <ul className="mb-0">
                    {booking.extraDetails
                      .split("\n")
                      .filter(line => line.startsWith("-"))
                      .map((item, index) => (
                        <li key={index}>{item.replace(/^- /, "")}</li>
                      ))}
                  </ul>
                  {booking.extraDetails
                    .split("\n")
                    .filter(line => !line.startsWith("-"))
                    .map((line, idx) => (
                      <div key={idx}>{line}</div>
                    ))}
                </>
              )}


            </div>

            {/* <div className="text-center mt-3">
              <button
                className="btn btn-outline-secondary btn-sm"
                onClick={() => navigate(-1)}
              >
                Back
              </button>
            </div> */}

            <div className="d-flex justify-content-center gap-2 mt-3 flex-wrap">

              {/* Back Button */}
              <button
                className="btn btn-outline-secondary btn-sm"
                onClick={() => navigate(-1)}
              >
                Back
              </button>

              {/* Download Boarding Pass (Only if Confirmed) */}
              {booking.status === "confirmed" && (
                <div className="">
                  <PDFDownloadLink
                    document={<BoardingPassPDF booking={booking} />}
                    fileName={`BoardingPass_${booking._id.slice(-5)}.pdf`}
                    className="w-100 text-decoration-none"
                  >
                    {({ loading }) => (
                      <button
                        type="button"
                        className="btn btn-success w-100 d-flex align-items-center justify-content-center gap-2 py-2"
                        disabled={loading}
                      >
                        <Download size={18} />
                        {loading ? "Generating PDF..." : "Download Boarding Pass"}
                      </button>
                    )}
                  </PDFDownloadLink>
                </div>
              )}


            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

export default CustomerDetails;
