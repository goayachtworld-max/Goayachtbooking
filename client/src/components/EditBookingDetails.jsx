import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getAllYachtsAPI } from "../services/operations/yautAPI";
import toast from "react-hot-toast";

function EditBookingDetails() {
    const navigate = useNavigate();
    const { state } = useLocation();
    const booking = state?.booking;

    if (!booking) {
        navigate("/bookings");
        return null;
    }

    const [yachts, setYachts] = useState([]);
    const [startTimeOptions, setStartTimeOptions] = useState([]);
    const [runningCost, setRunningCost] = useState(0);


    /* ===== USER ROLE ===== */
    const user = JSON.parse(localStorage.getItem("user"));
    const isAdmin = user?.type === "admin";

    /* ===== BOOKING STATE (ADMIN ONLY) ===== */
    const [bookingData, setBookingData] = useState({
        yachtId: booking?.yachtId?._id || "",
        date: booking?.date?.split("T")[0] || "",
        startTime: booking?.startTime || "",
        endTime: booking?.endTime || "",
    });


    /* ===== CUSTOMER STATE (ADMIN + BACKDESK) ===== */
    const [customerData, setCustomerData] = useState({
        name: booking?.customerId?.name || "",
        contact: booking?.customerId?.contact || "",
        alternateContact: booking?.customerId?.alternateContact || "",
        email: booking?.customerId?.email || "",
        govtIdNo: booking?.customerId?.govtIdNo || "",
    });

    /* ===== HANDLERS ===== */
    const handleBookingChange = (e) => {
        const { name, value } = e.target;
        setBookingData((p) => ({ ...p, [name]: value }));
    };

    const handleCustomerChange = (e) => {
        const { name, value } = e.target;
        setCustomerData((p) => ({ ...p, [name]: value }));
    };

    /* ===== SUBMIT ===== */
    const handleSubmit = async (e) => {
        e.preventDefault();

        try {
            // 1️⃣ Update existing customer
            //   await updateCustomerAPI(
            //     booking.customerId._id,
            //     customerData
            //   );

            //   // 2️⃣ Update booking date/time (ADMIN ONLY)
            //   if (isAdmin) {
            //     await updateBookingAPI(
            //       booking._id,
            //       bookingData
            //     );
            //   }

            navigate(-1);
        } catch (err) {
            console.error("Update failed:", err);
        }
    };
    const hhmmToMinutes = (t) => {
        const [h, m] = t.split(":").map(Number);
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

    const buildSlotsForYacht = (yacht, selectedDate) => {
        if (!yacht) return [];

        const sailStart = yacht.sailStartTime;
        const sailEnd = yacht.sailEndTime;
        const durationRaw = yacht.slotDurationMinutes || yacht.duration;
        const specialSlots = yacht.specialSlots || [];

        const timeToMin = (t) => {
            const [h, m] = t.split(":").map(Number);
            return h * 60 + m;
        };

        const minToTime = (m) => {
            const h = Math.floor(m / 60);
            const mm = m % 60;
            return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
        };

        const slotsForDate = yacht.slots?.find(
            (s) =>
                new Date(s.date).toDateString() ===
                new Date(selectedDate).toDateString()
        );

        if (slotsForDate?.slots?.length) {
            return slotsForDate.slots
                .map((s) => ({ start: s.start, end: s.end }))
                .sort((a, b) => timeToMin(a.start) - timeToMin(b.start));
        }

        let duration =
            typeof durationRaw === "string"
                ? hhmmToMinutes(durationRaw)
                : Number(durationRaw);

        let startMin = timeToMin(sailStart);
        let endMin = timeToMin(sailEnd);
        if (endMin <= startMin) endMin += 1440;

        const slots = [];
        let cursor = startMin;

        while (cursor < endMin) {
            const next = cursor + duration;
            slots.push({ start: minToTime(cursor), end: minToTime(next) });
            cursor = next;
        }

        return slots;
    };

    useEffect(() => {
        if (!isAdmin) return;

        const yacht = yachts.find((y) => y.id === bookingData.yachtId);
        if (!yacht) return;

        setRunningCost(yacht.runningCost || 0);

        const slots = buildSlotsForYacht(yacht, bookingData.date);
        console.log("slots in edit : ", slots)
        setStartTimeOptions(slots);

        // auto-fix end time
        const match = slots.find((s) => s.start === bookingData.startTime);
        if (match) {
            setBookingData((p) => ({ ...p, endTime: match.end }));
        }
    }, [bookingData.yachtId, bookingData.date, yachts, isAdmin]);


    useEffect(() => {
        if (!isAdmin || !bookingData.date) return;

        const token = localStorage.getItem("authToken");
        getAllYachtsAPI(token, bookingData.date).then(res =>
            setYachts(res?.data?.yachts || [])
        );
    }, [bookingData.date]);



    return (
        <div className="container mt-4">
            <div className="card shadow-sm mx-auto" style={{ maxWidth: 650 }}>
                <div className="card-body">
                    <h5 className="mb-3">Edit Booking Details</h5>

                    <form onSubmit={handleSubmit} className="row g-3">
                        <div className="col-12 col-md-6">
                            <label className="form-label fw-bold">Customer Name</label>
                            <input
                                className="form-control"
                                name="name"
                                value={customerData.name}
                                onChange={handleCustomerChange}
                            />
                        </div>

                        <div className="col-12 col-md-6">
                            <label className="form-label fw-bold">Email</label>
                            <input
                                className="form-control"
                                name="email"
                                value={customerData.email}
                                placeholder="example@gmail.com"
                                onChange={handleCustomerChange}
                            />
                        </div>

                        <div className="col-12 col-md-6">
                            <label className="form-label fw-bold">Contact</label>
                            <input
                                className="form-control"
                                name="contact"
                                value={customerData.contact}
                                onChange={handleCustomerChange}
                            />
                        </div>

                        <div className="col-12 col-md-6">
                            <label className="form-label fw-bold">
                                Alternate Contact
                            </label>
                            <input
                                className="form-control"
                                name="alternateContact"
                                value={customerData.alternateContact}
                                onChange={handleCustomerChange}
                            />
                        </div>

                        {/* <div className="col-12">
              <label className="form-label fw-bold">
                Govt ID Number
              </label>
              <input
                className="form-control"
                name="govtIdNo"
                value={customerData.govtIdNo}
                onChange={handleCustomerChange}
              />
            </div> */}

                        <hr className="my-3" />
                        {/* ===== DATE & TIME ===== */}
                        <div className="col-12 ">
                            <label className="form-label fw-bold">Yacht</label>
                            <select
                                className="form-select"
                                name="yachtId"
                                value={bookingData.yachtId}
                                onChange={(e) =>
                                    setBookingData((p) => ({
                                        ...p,
                                        yachtId: e.target.value,
                                        startTime: "",
                                        endTime: "",
                                    }))
                                }
                                disabled={!isAdmin}
                            >
                                {yachts.map((y, index) => (
                                    <option key={y.name} value={y._id}>
                                        {y.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="col-12 col-md-6">
                            <label className="form-label fw-bold">Date</label>
                            <input
                                type="date"
                                className="form-control"
                                name="date"
                                value={bookingData.date}
                                min={new Date().toISOString().split("T")[0]}
                                onChange={isAdmin ? handleBookingChange : undefined}
                                disabled={!isAdmin}
                            />
                        </div>

                        {/* <div className="col-12 col-md-6">
                            <label className="form-label fw-bold">Start Time</label>
                            <select
                                className="form-select"
                                value={bookingData.startTime}
                                onChange={(e) => {
                                    const slot = startTimeOptions.find(
                                        (s) => s.start === e.target.value
                                    );
                                    setBookingData((p) => ({
                                        ...p,
                                        startTime: e.target.value,
                                        endTime: slot?.end || "",
                                    }));
                                }}
                                disabled={!isAdmin}
                            >
                                <option value="">-- Select --</option>
                                {startTimeOptions.map((s, i) => (
                                    <option key={i} value={s.start}>
                                        {to12Hour(s.start)}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="col-12 col-md-6">
                            <label className="form-label fw-bold">End Time</label>
                            <input
                                type="text"
                                className="form-control"
                                value={to12Hour(bookingData.endTime)}
                                readOnly
                            />

                        </div> */}

                        <div className="col-12 col-md-6">
                            <label className="form-label fw-bold">Time Slot</label>
                            <select
                                className="form-select"
                                value={bookingData.startTime}
                                onChange={(e) => {
                                    // Find the slot by start time
                                    const slot = startTimeOptions.find((s) => s.start === e.target.value);
                                    setBookingData((p) => ({
                                        ...p,
                                        startTime: slot?.start || "",
                                        endTime: slot?.end || "",
                                    }));
                                }}
                                disabled={!isAdmin}
                            >
                                <option value="">-- Select Time Slot --</option>
                                {startTimeOptions.map((s, i) => (
                                    <option key={i} value={s.start}>
                                        {to12Hour(s.start)} - {to12Hour(s.end)}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* ===== ACTIONS ===== */}
                        <div className="col-12 d-flex gap-2 mt-3">
                            <button
                                type="button"
                                className="btn btn-secondary flex-fill"
                                onClick={() => navigate(-1)}
                            >
                                Cancel
                            </button>

                            <button
                                type="submit"
                                className="btn btn-primary flex-fill"
                            >
                                Save Changes
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}

export default EditBookingDetails;
