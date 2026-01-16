import React, { useEffect, useState, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { createBookingAPI } from "../services/operations/bookingAPI";
import {
  createCustomerAPI,
  getCustomerByContactAPI,
  searchCustomersByNameAPI,
} from "../services/operations/customerAPI";
import { getAllYachtsAPI } from "../services/operations/yautAPI";
import { toast } from "react-hot-toast";
import { createTransactionAndUpdateBooking } from "../services/operations/transactionAPI";

function CreateBooking() {
  const navigate = useNavigate();
  const location = useLocation();
  const prefill = location.state || {};

  const [formData, setFormData] = useState({
    name: "",
    contact: "",
    govtId: "",
    email: "",
    yachtId: prefill.yachtId || "",
    totalAmount: "",
    date: prefill.date || "",
    startTime: prefill.startTime || "",
    endTime: prefill.endTime || "",
    numPeople: "",
    advanceAmount: "",
  });

  const [yachts, setYachts] = useState([]);
  const [startTimeOptions, setStartTimeOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [runningCost, setRunningCost] = useState(0);

  const [customerSuggestions, setCustomerSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const typingTimeoutRef = useRef(null);

  const hhmmToMinutes = (time = "00:00") => {
    const [h, m] = time.split(":").map(Number);
    return h * 60 + m;
  };

  const to12Hour = (time24) => {
    if (!time24) return "";
    let [hour, minute] = time24.split(":").map(Number);
    hour = hour % 24;
    const period = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 === 0 ? 12 : hour % 12;
    return `${hour12}:${String(minute).padStart(2, "0")} ${period}`;
  };

  // Fetch yachts
  useEffect(() => {
    const fetchYachts = async () => {
      try {
        const token = localStorage.getItem("authToken");
        const date = formData.date;
        const res = await getAllYachtsAPI(token, date);
        const yachtList = Array.isArray(res?.data?.yachts)
          ? res.data.yachts
          : [];
        setYachts(yachtList);
      } catch (err) {
        console.error("Failed to fetch yachts:", err);
      }
    };
    if (formData.date) fetchYachts();
  }, [formData.date]);

  const buildSlotsForYacht = (yacht, selectedDate) => {
    if (!yacht) return [];

    const sailStart = yacht.sailStartTime;
    const sailEnd = yacht.sailEndTime;
    const durationRaw = yacht.slotDurationMinutes || yacht.duration;
    const specialSlots = yacht.specialSlots || [];

    const timeToMin = (t) => {
      if (!t) return 0;
      const [h, m] = t.split(":").map(Number);
      return h * 60 + m;
    };

    const minToTime = (m) => {
      const h = Math.floor(m / 60);
      const mm = m % 60;
      return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
    };

    const slotsForDate = yacht.slots?.find(
      (slotGroup) =>
        new Date(slotGroup.date).toDateString() ===
        new Date(selectedDate).toDateString()
    );

    if (slotsForDate && slotsForDate.slots?.length > 0) {
      return slotsForDate.slots
        .map((s) => ({ start: s.start, end: s.end }))
        .sort((a, b) => timeToMin(a.start) - timeToMin(b.start));
    }

    let duration = 0;
    if (typeof durationRaw === "string" && durationRaw.includes(":")) {
      const [h, m] = durationRaw.split(":").map(Number);
      duration = h * 60 + (m || 0);
    } else {
      duration = Number(durationRaw);
    }

    const startMin = timeToMin(sailStart);
    let endMin = timeToMin(sailEnd);
    const specialMins = specialSlots.map(timeToMin).sort((a, b) => a - b);

    if (endMin <= startMin) endMin += 24 * 60;
    if (sailEnd === "00:00") endMin = 24 * 60 - 1;

    const slots = [];
    let cursor = startMin;

    while (cursor < endMin) {
      const next = cursor + duration;
      const hit = specialMins.find((sp) => sp > cursor && sp < next);

      if (hit) {
        slots.push({ start: cursor, end: hit });
        cursor = hit;
      } else {
        slots.push({ start: cursor, end: next });
        cursor = next;
      }
    }

    return slots.map((s) => ({
      start: minToTime(s.start),
      end: minToTime(s.end),
    }));
  };

  useEffect(() => {
    const selectedYacht = yachts.find((y) => y.id === formData.yachtId);
    if (!selectedYacht) {
      setStartTimeOptions([]);
      return;
    }

    setRunningCost(selectedYacht.runningCost || 0);

    const slots = buildSlotsForYacht(selectedYacht, formData.date);
    setStartTimeOptions(slots);

    if (formData.startTime) {
      const match = slots.find((s) => s.start === formData.startTime);
      if (match) setFormData((p) => ({ ...p, endTime: match.end }));
    }
  }, [formData.yachtId, yachts, formData.date]);

  useEffect(() => {
    const close = () => setShowSuggestions(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === "yachtId") {
      setFormData((p) => ({
        ...p,
        yachtId: value,
        startTime: "",
        endTime: "",
      }));
    } else {
      setFormData((p) => ({ ...p, [name]: value }));
    }
  };

  const handleStartSelect = (e) => {
    const start = e.target.value;
    const slot = startTimeOptions.find((s) => s.start === start);
    setFormData((p) => ({
      ...p,
      startTime: start,
      endTime: slot ? slot.end : "",
    }));
  };

  const isAmountInvalid =
    formData.totalAmount &&
    runningCost &&
    Number(formData.totalAmount) < runningCost;

  const isCapacityExceeded =
    formData.numPeople &&
    yachts.find((y) => y.id === formData.yachtId)?.capacity &&
    Number(formData.numPeople) >
    yachts.find((y) => y.id === formData.yachtId).capacity;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const token = localStorage.getItem("authToken");

      const selectedYacht = yachts.find((y) => y.id === formData.yachtId);
      if (!selectedYacht) {
        alert("Please select a yacht first.");
        setLoading(false);
        return;
      }

      const { data } = await getCustomerByContactAPI(formData.contact, token);
      let customerId = data.customer?._id;

      if (!data.customer) {
        const payload = new FormData();
        for (let key in formData) payload.append(key, formData[key]);
        const res = await createCustomerAPI(payload, token);
        if (res?.data?.success) toast.success("New Customer Created!");
        customerId = res?.data?._id;
      }

      const bookingPayload = {
        customerId,
        employeeId: "replace_with_employee_id",
        yachtId: formData.yachtId,
        date: formData.date,
        startTime: formData.startTime,
        endTime: formData.endTime,
        quotedAmount: Number(formData.totalAmount),
        numPeople: Number(formData.numPeople),
      };

      const response = await createBookingAPI(bookingPayload, token);
      const booking = response.data.booking;

      toast.success("Booking created successfully!");

      if (response.data.success && formData.advanceAmount > 0) {
        await createTransactionAndUpdateBooking(
          {
            bookingId: booking._id,
            type: "advance",
            amount: formData.advanceAmount,
          },
          token
        );
      }

      navigate("/bookings");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create booking");
    } finally {
      setLoading(false);
    }
  };

  const handleNameTyping = (e) => {
    const token = localStorage.getItem("authToken");
    const value = e.target.value;

    setFormData((p) => ({ ...p, name: value }));
    clearTimeout(typingTimeoutRef.current);

    if (value.length < 2) {
      setCustomerSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    typingTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await searchCustomersByNameAPI(value, token);
        const customers = res?.data?.customers || [];
        setCustomerSuggestions(customers);
        setShowSuggestions(customers.length > 0);
      } catch {
        setCustomerSuggestions([]);
        setShowSuggestions(false);
      }
    }, 500);
  };

  const handleCustomerSelect = (customer) => {
    setFormData((p) => ({
      ...p,
      name: customer.name,
      contact: customer.contact || "",
      email: customer.email || "",
      govtId: customer.govtIdNo || "",
    }));
    setShowSuggestions(false);
  };

  return (
    <>
      {loading && (
        <div className="blur-loader-overlay">
          <div className="custom-spinner"></div>
        </div>
      )}

      <style>
        {`
        .blur-loader-overlay {
          position: fixed;
          top: 0; left: 0;
          width: 100%; height: 100%;
          backdrop-filter: blur(6px);
          background: rgba(0,0,0,0.45);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 99999;
        }
        .custom-spinner {
          width: 70px;
          height: 70px;
          border: 6px solid #ffffff90;
          border-top-color: #00c2ff;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin {
          100% { transform: rotate(360deg); }
        }
      `}
      </style>

      <div className={`container my-4 px-3 ${loading ? "blur" : ""}`}>
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h4>Create Booking</h4>
          <button className="btn btn-secondary" onClick={() => navigate(-1)}>
            ← Back
          </button>
        </div>

        {error && <div className="alert alert-danger">{error}</div>}

        <form className="row g-2" onSubmit={handleSubmit}>
          {/* Full Name */}
          <div className="col-md-6 position-relative">
            <label className="form-label fw-bold">Full Name</label>
            <input
              type="text"
              className="form-control border border-dark text-dark"
              name="name"
              value={formData.name}
              onChange={handleNameTyping}
              autoComplete="off"
              required
              placeholder="Customer Name"
            />

            {showSuggestions && customerSuggestions.length > 0 && (
              <ul className="list-group position-absolute w-100 shadow">
                {customerSuggestions.map((c) => (
                  <li
                    key={c._id}
                    className="list-group-item list-group-item-action"
                    onClick={() => handleCustomerSelect(c)}
                  >
                    <strong>{c.name}</strong>
                    <br />
                    <small>{c.contact} | {c.email}</small>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Contact */}
          <div className="col-md-6">
            <label className="form-label fw-bold">Contact Number</label>
            <input
              type="tel"
              className="form-control border border-dark text-dark"
              name="contact"
              value={formData.contact}
              onChange={handleChange}
              required
            />
          </div>

          {/* Date */}
          <div className="col-md-6">
            <label className="form-label fw-bold">Date of Ride</label>
            <input
              type="date"
              min={new Date().toISOString().split("T")[0]}
              className="form-control border border-dark text-dark"
              name="date"
              value={formData.date}
              onChange={handleChange}
              required
            />
          </div>

          {/* Number of People */}
          <div className="col-md-6">
            <label className="form-label fw-bold">Number of People</label>
            <input
              type="number"
              className={`form-control border text-dark ${isCapacityExceeded ? "border-warning" : "border-dark"
                }`}
              name="numPeople"
              value={formData.numPeople}
              onChange={handleChange}
              required
            />
            {isCapacityExceeded && (
              <div className="text-warning mt-1">
                ⚠ Exceeds yacht capacity (
                {yachts.find((y) => y.id === formData.yachtId)?.capacity})
              </div>
            )}
          </div>

          {/* Yacht */}
          <div className="col-12">
            <label className="form-label fw-bold">Select Yacht</label>
            <select
              className="form-select border border-dark text-dark"
              name="yachtId"
              value={formData.yachtId}
              onChange={handleChange}
              required
            >
              <option value="">-- Select Yacht --</option>
              {yachts.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.name}
                </option>
              ))}
            </select>
          </div>

          {/* Start Time */}
          <div className="col-md-6">
            <label className="form-label fw-bold">Start Time</label>
            <select
              className="form-select border border-dark text-dark"
              name="startTime"
              value={formData.startTime}
              onChange={handleStartSelect}
              required
            >
              <option value="">-- Select Start Time --</option>
              {startTimeOptions.map((opt, i) => (
                <option key={i} value={opt.start}>
                  {to12Hour(opt.start)}
                </option>
              ))}
            </select>
          </div>

          {/* End Time */}
          <div className="col-md-6">
            <label className="form-label fw-bold">End Time</label>
            <input
              type="text"
              className="form-control border border-dark text-dark"
              value={to12Hour(formData.endTime)}
              readOnly
            />
          </div>

          {/* Quoted Amount */}
          <div className="col-md-6">
            <label className="form-label fw-bold">Quoted Amount</label>
            <input
              type="number"
              // className={`form-control border text-dark ${isAmountInvalid ? "border-danger is-invalid" : "border-dark"
              //   }`}
              className={`form-control border text-dark ${isAmountInvalid ? "border-warning" : "border-dark"
                }`}
              name="totalAmount"
              value={formData.totalAmount}
              onChange={handleChange}
              required
            />
            {isAmountInvalid && (
              <div className="text-danger mt-1">
                ⚠ Total amount is below running cost (₹{runningCost})
              </div>
            )}
          </div>

          {/* Advance */}
          <div className="col-md-6">
            <label className="form-label fw-bold">Advance Amount</label>
            <input
              type="number"
              className="form-control border border-dark text-dark"
              name="advanceAmount"
              value={formData.advanceAmount}
              onChange={handleChange}
            />
          </div>

          <div className="col-12 text-center">
            <button type="submit" className="btn btn-primary w-100" disabled={loading}>
              {loading ? "Creating..." : "Create Booking"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

export default CreateBooking;
