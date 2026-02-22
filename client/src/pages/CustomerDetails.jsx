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
const formatDate = (d) =>
  new Date(d).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });





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

  const isBookingCompleted = (booking) => {
    if (!booking.date || !booking.endTime) return false;

    const bookingEnd = new Date(booking.date);
    const [h, m] = booking.endTime.split(":").map(Number);

    bookingEnd.setHours(h, m, 0, 0);

    return bookingEnd < new Date();
  };
  let finalTripStatus = "pending";

  if (booking.status === "cancelled") {
    finalTripStatus = "cancelled";
  } else if (
    booking.status === "confirmed" &&
    isBookingCompleted(booking)
  ) {
    finalTripStatus = "success";
  } else if (booking.status === "confirmed") {
    finalTripStatus = "initiated";
  }

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
        {/* <TripProgress tripStatus={booking.tripStatus} /> */}
        <TripProgress tripStatus={finalTripStatus} />

        {/* Card */}
        <div className="card shadow-sm">
          <div className="card-body p-3">

            {/* ================= TOP TWO COLUMN SECTION ================= */}
            <div className="row small g-2">

              {/* LEFT COLUMN */}
              <div className="col-6">
                <p className="m-0"><strong>Customer:</strong><br />{customer.name || "N/A"}</p>
                <p className="m-0 mt-2"><strong>Contact:</strong><br />{customer.contact || "N/A"}</p>
                <p className="m-0 mt-2"><strong>Email:</strong><br />{customer.email || "N/A"}</p>
              </div>

              {/* RIGHT COLUMN */}
              <div className="col-6">
                <p className="m-0"><strong>Date:</strong><br />{bookingDate}</p>
                <p className="m-0 mt-2">
                  <strong>Time:</strong><br />
                  {to12HourFormat(booking.startTime)} – {to12HourFormat(booking.endTime)}
                </p>
                <p className="m-0 mt-2"><strong>People:</strong><br />{booking.numPeople}</p>
              </div>

            </div>

            <hr className="my-3" />

            {/* ================= BALANCE ================= */}
            <div className="small">
              <strong>Balance:</strong> ₹{booking.pendingAmount ?? 0}
            </div>

            <hr className="my-3" />

            {/* ================= EXTRA DETAILS TWO COLUMN ================= */}
            {booking?.extraDetails && (() => {

              const sanitizeText = (text = "") =>
                text
                  .replace(/\u2022|\u2023|\u25E6/g, "-")
                  .replace(/\u200B|\u200C|\u200D|\uFEFF/g, "")
                  .replace(/\r\n/g, "\n")
                  .replace(/\n{2,}/g, "\n")
                  .trim();

              const extraDetails = sanitizeText(booking.extraDetails);
              const lines = extraDetails.split("\n").map(l => l.trim()).filter(Boolean);

              const inclusions = lines.filter(i =>
                ["Soft Drink", "Ice Cube", "Water Bottles", "Bluetooth Speaker", "Captain", "Snacks"]
                  .some(k => i.includes(k))
              );

              const paidServices = lines.filter(i =>
                ["Drone", "DSLR"].some(k => i.includes(k))
              );

              const notes = extraDetails.includes("Notes:")
                ? extraDetails.split("Notes:").slice(1).join("Notes:").trim()
                : "";

              return (
                <>
                  <div className="row small">

                    <div className="col-6">
                      <strong>Extra Inclusions</strong>
                      <ul className="mb-0 mt-1">
                        {inclusions.length > 0
                          ? inclusions.map((item, i) => (
                            <li key={i}>{item.replace("-", "").trim()}</li>
                          ))
                          : <li className="text-muted">None</li>
                        }
                      </ul>
                    </div>

                    <div className="col-6">
                      <strong>Extra Paid Services</strong>
                      <ul className="mb-0 mt-1">
                        {paidServices.length > 0
                          ? paidServices.map((item, i) => (
                            <li key={i}>{item.replace("-", "").trim()}</li>
                          ))
                          : <li className="text-muted">None</li>
                        }
                      </ul>
                    </div>

                  </div>

                  {notes && (
                    <>
                      <hr className="my-3" />
                      <div className="small">
                        <strong>Note</strong>
                        <div className="mt-1">{notes}</div>
                      </div>
                    </>
                  )}
                </>
              );
            })()}

            <hr className="my-3" />

            {/* ================= ACTION BUTTONS ================= */}
            <div className="d-flex justify-content-center gap-2 flex-wrap">

              <button
                className="btn btn-outline-secondary btn-sm"
                onClick={() => navigate(-1)}
              >
                Back
              </button>

              {booking.status === "confirmed" && (
                <PDFDownloadLink
                  document={<BoardingPassPDF booking={booking} />}
                  fileName={`${booking.yachtId?.name}_${customer.name}_${formatDate(booking.date)}.pdf`}
                  className="text-decoration-none"
                >
                  {({ loading }) => (
                    <button
                      type="button"
                      className="btn btn-success btn-sm"
                      disabled={loading}
                    >
                      {loading ? "Generating..." : "Download Boarding Pass"}
                    </button>
                  )}
                </PDFDownloadLink>
              )}

            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

export default CustomerDetails;
