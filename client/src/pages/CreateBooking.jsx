import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { createBookingAPI } from "../services/operations/bookingAPI";
import {
  createCustomerAPI,
  getCustomerByEmailAPI,
} from "../services/operations/customerAPI";
import { getAllYachtsAPI } from "../services/operations/yautAPI";
import { toast } from "react-hot-toast";

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
  });

  const [yachts, setYachts] = useState([]);
  const [startTimeOptions, setStartTimeOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [runningCost, setRunningCost] = useState(0);

  // Time helpers
  const hhmmToMinutes = (time = "00:00") => {
    const [h, m] = time.split(":").map(Number);
    return h * 60 + m;
  };

  const minutesToHHMM = (mins) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  };

  function to12Hour(time) {
    if (!time) return "";
    const [h, m] = time.split(":").map(Number);
    const suffix = h >= 12 ? "PM" : "AM";
    const hour = ((h + 11) % 12) + 1;
    return `${hour}:${m.toString().padStart(2, "0")} ${suffix}`;
  }

  //  Fetch yachts
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
        console.log("Here is yaut list - ", yachtList)
      } catch (err) {
        console.error("Failed to fetch yachts:", err);
      }
    };
    if (formData.date) {
      fetchYachts();
    }
  }, [formData.date]);

  //  Slot generator with special slot logic

  // const buildSlotsForYacht = (yacht) => {
  //   if (!yacht) {
  //     console.log("⛔ No yacht found");
  //     return [];
  //   }

  //   const sailStart = yacht.sailStartTime;
  //   const sailEnd = yacht.sailEndTime;
  //   const durationRaw = yacht.slotDurationMinutes || yacht.duration;

  //   const specialSlots = yacht.specialSlots || [];

  //   console.log("\n============================");
  //   console.log("🛥 Generating Slots For Yacht:", yacht.name);
  //   console.log("⏳ Sail Start:", sailStart);
  //   console.log("⏳ Sail End:", sailEnd);
  //   console.log("🕒 Duration:", durationRaw);
  //   console.log("⭐ Special Slot Times:", specialSlots);
  //   console.log("============================\n");

  //   const timeToMin = (t) => {
  //     if (!t) return 0;
  //     const [h, m] = t.split(":").map(Number);
  //     return h * 60 + m;
  //   };

  //   const minToTime = (m) => {
  //     const h = Math.floor(m / 60);
  //     const mm = m % 60;
  //     return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
  //   };

  //   let duration = 0;
  //   if (typeof durationRaw === "string" && durationRaw.includes(":")) {
  //     const [h, m] = durationRaw.split(":").map(Number);
  //     duration = h * 60 + (m || 0);
  //   } else {
  //     duration = Number(durationRaw);
  //   }

  //   const startMin = timeToMin(sailStart);
  //   const endMin = timeToMin(sailEnd);
  //   const specialMins = specialSlots.map(timeToMin).sort((a, b) => a - b);

  //   const slots = [];
  //   let cursor = startMin;

  //   while (cursor < endMin) {
  //     let next = cursor + duration;

  //     const hit = specialMins.find((sp) => sp > cursor && sp < next);

  //     if (hit) {
  //       slots.push({ start: cursor, end: hit });

  //       const specialEnd = Math.min(hit + duration, endMin);
  //       slots.push({ start: hit, end: specialEnd });

  //       cursor = specialEnd;
  //     } else {
  //       const endSlot = Math.min(next, endMin);
  //       slots.push({ start: cursor, end: endSlot });
  //       cursor = endSlot;
  //     }
  //   }

  //   const seen = new Set();
  //   const cleaned = slots.filter((s) => {
  //     const key = `${s.start}-${s.end}`;
  //     if (seen.has(key)) return false;
  //     seen.add(key);
  //     return true;
  //   });

  //   const finalSlots = cleaned.map((s) => ({
  //     start: minToTime(s.start),
  //     end: minToTime(s.end),
  //   }));

  //   // console.log("📌 FINAL GENERATED SLOTS:");
  //   finalSlots.forEach((s) => console.log(`➡ ${s.start} - ${s.end}`));
  //   // console.log("======================================");

  //   return finalSlots;
  // };

  // const buildSlotsForYacht = (yacht) => {
  //   if (!yacht) return [];

  //   const sailStart = yacht.sailStartTime;
  //   const sailEnd = yacht.sailEndTime;
  //   const durationRaw = yacht.slotDurationMinutes || yacht.duration;

  //   const slotsFromSchema = yacht.slots || []; // if schema-defined slots exist
  //   const specialSlots = yacht.specialSlots || [];

  //   const timeToMin = (t) => {
  //     if (!t) return 0;
  //     const [h, m] = t.split(":").map(Number);
  //     return h * 60 + m;
  //   };

  //   const minToTime = (m) => {
  //     const h = Math.floor(m / 60);
  //     const mm = m % 60;
  //     return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
  //   };

  //   let duration = 0;
  //   if (typeof durationRaw === "string" && durationRaw.includes(":")) {
  //     const [h, m] = durationRaw.split(":").map(Number);
  //     duration = h * 60 + (m || 0);
  //   } else {
  //     duration = Number(durationRaw);
  //   }

  //   // If slots already exist, just return them (sorted & formatted)
  //   if (slotsFromSchema.length > 0) {
  //     return slotsFromSchema
  //       .map((s) => ({ start: s.start, end: s.end }))
  //       .sort((a, b) => timeToMin(a.start) - timeToMin(b.start));
  //   }

  //   // Else, generate default slots
  //   const startMin = timeToMin(sailStart);
  //   const endMin = timeToMin(sailEnd);
  //   const specialMins = specialSlots.map(timeToMin).sort((a, b) => a - b);

  //   const slots = [];
  //   let cursor = startMin;

  //   // Generate normal slots respecting special slots
  //   while (cursor < endMin) {
  //     const next = cursor + duration;
  //     const hit = specialMins.find((sp) => sp > cursor && sp < next);

  //     if (hit) {
  //       slots.push({ start: cursor, end: hit });
  //       cursor = hit;
  //     } else {
  //       slots.push({ start: cursor, end: Math.min(next, endMin) });
  //       cursor = next;
  //     }
  //   }

  //   // Add special blocks outside sail window
  //   specialMins.forEach((sp) => slots.push({ start: sp, end: sp + duration }));

  //   // Remove duplicates & sort
  //   const seen = new Set();
  //   const cleaned = slots.filter((s) => {
  //     const key = `${s.start}-${s.end}`;
  //     if (seen.has(key)) return false;
  //     seen.add(key);
  //     return true;
  //   }).sort((a, b) => a.start - b.start);

  //   return cleaned.map((s) => ({
  //     start: minToTime(s.start),
  //     end: minToTime(s.end),
  //   }));
  // };

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

    // Check if schema-defined slots exist for selected date
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

    // Else, generate slots dynamically
    let duration = 0;
    if (typeof durationRaw === "string" && durationRaw.includes(":")) {
      const [h, m] = durationRaw.split(":").map(Number);
      duration = h * 60 + (m || 0);
    } else {
      duration = Number(durationRaw);
    }

    const startMin = timeToMin(sailStart);
    const endMin = timeToMin(sailEnd);
    const specialMins = specialSlots.map(timeToMin).sort((a, b) => a - b);

    const slots = [];
    let cursor = startMin;

    while (cursor < endMin) {
      const next = cursor + duration;
      const hit = specialMins.find((sp) => sp > cursor && sp < next);

      if (hit) {
        slots.push({ start: cursor, end: hit });
        cursor = hit;
      } else {
        slots.push({ start: cursor, end: Math.min(next, endMin) });
        cursor = next;
      }
    }

    // Remove duplicates & sort
    const seen = new Set();
    const cleaned = slots.filter((s) => {
      const key = `${s.start}-${s.end}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).sort((a, b) => a.start - b.start);

    return cleaned.map((s) => ({
      start: minToTime(s.start),
      end: minToTime(s.end),
    }));
  };




  //  Update startTimeOptions whenever yacht changes
  // useEffect(() => {
  //   const selectedYacht = yachts.find((y) => y.id === formData.yachtId);
  //   if (!selectedYacht) {
  //     setStartTimeOptions([]);
  //     return;
  //   }

  //   setRunningCost(selectedYacht.runningCost || 0);
  //   const slots = buildSlotsForYacht(selectedYacht);
  //   setStartTimeOptions(slots);

  //   // auto-set endTime if startTime exists
  //   if (formData.startTime) {
  //     const match = slots.find((s) => s.start === formData.startTime);
  //     if (match) {
  //       setFormData((p) => ({ ...p, endTime: match.end }));
  //     }
  //   }
  // }, [formData.yachtId, yachts]);
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
      if (match) {
        setFormData((p) => ({ ...p, endTime: match.end }));
      }
    }
  }, [formData.yachtId, yachts, formData.date]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === "yachtId") {
      setFormData((prev) => ({
        ...prev,
        yachtId: value,
        startTime: "",
        endTime: "",
      }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleStartSelect = (e) => {
    const start = e.target.value;
    const slot = startTimeOptions.find((s) => s.start === start);
    setFormData((prev) => ({
      ...prev,
      startTime: start,
      endTime: slot ? slot.end : "",
    }));
  };

  const isAmountInvalid =
    formData.totalAmount &&
    runningCost &&
    parseFloat(formData.totalAmount) < runningCost;

  //  Handle Submit
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

      if (parseFloat(formData.totalAmount) < selectedYacht.runningCost) {
        alert(
          `Total Amount must be ≥ yacht running cost (₹${selectedYacht.runningCost}).`
        );
        setLoading(false);
        return;
      }

      const { data } = await getCustomerByEmailAPI(formData.email, token);
      let customerId = data.customer?._id;

      if (!data.customer) {
        const payload = new FormData();
        for (let key in formData) payload.append(key, formData[key]);

        const res = await createCustomerAPI(payload, token);
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

      await createBookingAPI(bookingPayload, token);

      toast.success(" Booking created successfully!", {
        duration: 3000,
        style: { borderRadius: "10px", background: "#333", color: "#fff" },
      });
      navigate("/bookings");
    } catch (err) {
      console.error("Booking failed:", err);
      setError(err.response?.data?.message || "Failed to create booking");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Loader */}
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

        <form className="row g-3" onSubmit={handleSubmit}>
          {/* Full Name */}
          <div className="col-md-6">
            <label className="form-label fw-bold">Full Name</label>
            <input
              type="text"
              className="form-control border border-dark text-dark"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Customer Name"
              required
            />
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
              placeholder="Contact No"
              required
            />
          </div>

          {/* Email */}
          <div className="col-md-6">
            <label className="form-label fw-bold">Customer Email</label>
            <input
              type="email"
              className="form-control border border-dark text-dark"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="Gmail Id"
              required
            />
          </div>

          {/* Govt ID */}
          <div className="col-md-6">
            <label className="form-label fw-bold">Govt ID Number</label>
            <input
              type="text"
              className="form-control border border-dark text-dark"
              name="govtId"
              value={formData.govtId}
              onChange={handleChange}
              placeholder="Govt. Id"
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
              className="form-control border border-dark text-dark"
              name="numPeople"
              value={formData.numPeople}
              onChange={handleChange}
              placeholder="Number of peoples"
              required
            />
          </div>
          {/* Yacht */}
          <div className="col-6">
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
              name="endTime"
              value={to12Hour(formData.endTime)}
              readOnly
            />
          </div>

          {/* Total Amount */}
          <div className="col-md-6">
            <label className="form-label fw-bold">Total Amount</label>
            <input
              type="number"
              className={`form-control border text-dark ${isAmountInvalid
                ? "border-danger is-invalid"
                : "border-dark"
                }`}
              name="totalAmount"
              value={formData.totalAmount}
              onChange={handleChange}
              placeholder="Amount"
              required
            />
            {isAmountInvalid && (
              <div className="text-danger mt-1">
                ⚠ Total amount must be at least ₹{runningCost}.
              </div>
            )}
          </div>

          <div className="col-12 text-center">
            <button
              type="submit"
              className="btn btn-primary w-100"
              disabled={loading || isAmountInvalid}
            >
              {loading ? "Creating..." : "Create Booking"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

export default CreateBooking;
