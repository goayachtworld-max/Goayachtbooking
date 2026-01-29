import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getAllYachtsAPI } from "../services/operations/yautAPI";
import toast from "react-hot-toast";
import { rescheduleBookingAPI } from "../services/operations/bookingAPI";
import { updateCustomerAPI } from "../services/operations/customerAPI";

function EditBookingDetails() {
    const navigate = useNavigate();
    const { state } = useLocation();
    const booking = state?.booking;

    console.log("Here is booking : ", booking);
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
    const isBackdesk = user?.type === "backdesk";


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

    const isCustomerChanged = () => {
        const c = booking.customerId;

        return (
            customerData.name !== (c.name || "") ||
            customerData.contact !== (c.contact || "") ||
            customerData.alternateContact !== (c.alternateContact || "") ||
            customerData.email !== (c.email || "")
        );
    };

    const isBookingChanged = () => {
        return (
            bookingData.yachtId !== booking.yachtId._id ||
            bookingData.date !== booking.date.split("T")[0] ||
            bookingData.startTime !== booking.startTime ||
            bookingData.endTime !== booking.endTime
        );
    };

    const isSubmitDisabled = () => {
        // Customer required fields
        if (!customerData.name || !customerData.contact) return true;

        // Admin booking required fields
        if (isAdmin) {
            if (
                !bookingData.yachtId ||
                !bookingData.date ||
                !bookingData.startTime ||
                !bookingData.endTime
            ) {
                return true;
            }
        }

        // Nothing changed
        if (!isCustomerChanged() && !isBookingChanged()) return true;

        return false;
    };


    /* ===== SUBMIT ===== */
    const handleSubmit = async (e) => {
        e.preventDefault();

        const token = localStorage.getItem("authToken");

        try {
            // 🔹 Update customer only if changed
            if (isCustomerChanged()) {
                await updateCustomerAPI(
                    booking.customerId._id,
                    {
                        name: customerData.name,
                        contact: customerData.contact,
                        alternateContact: customerData.alternateContact,
                        email: customerData.email,
                    },
                    token
                );
            }

            // 🔹 Reschedule booking only if changed (ADMIN ONLY)
            if (isAdmin && isBookingChanged()) {
                await rescheduleBookingAPI(
                    booking._id,
                    {
                        yachtId: bookingData.yachtId,
                        date: bookingData.date,
                        startTime: bookingData.startTime,
                        endTime: bookingData.endTime,
                    },
                    token
                );
            }

            toast.success("Booking updated successfully");
            navigate(-1);

        } catch (err) {
            console.error("Update failed:", err);
            toast.error(
                err?.response?.data?.message || "Failed to update booking"
            );
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
        if (!isAdmin || !yachts.length || !bookingData.yachtId) return;

        const yacht = yachts.find((y) => y._id === bookingData.yachtId);
        console.log("yachts : ", yacht)
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

        const fetchYachts = async () => {
            try {
                const token = localStorage.getItem("authToken");
                const date = bookingData.date;

                const res = await getAllYachtsAPI(token, date);

                const yachtList = Array.isArray(res?.data?.yachts)
                    ? res.data.yachts
                    : [];

                setYachts(yachtList);
            } catch (err) {
                console.error("Failed to fetch yachts:", err);
                setYachts([]); // safe fallback
            }
        };

        fetchYachts();
    }, [bookingData.date, isAdmin]);

    useEffect(() => {
        if (!isAdmin) return;

        // If yachts are empty, KEEP current yacht
        if (!yachts.length) {
            setBookingData((p) => ({
                ...p,
                yachtId: booking.yachtId._id,
            }));
            return;
        }

        const bookedYachtId = booking.yachtId._id;
        console.log("yachts are : ", yachts)
        const exists = yachts.some((y) => y.id === bookedYachtId);

        if (exists && bookingData.yachtId !== bookedYachtId) {
            setBookingData((p) => ({
                ...p,
                yachtId: bookedYachtId,
            }));
        }
    }, [yachts, isAdmin]);



    const ticketId = booking._id
        ? booking._id.slice(-5).toUpperCase()
        : "-----";

    return (
        <div className="container mt-3">
            <div className="card shadow-sm mx-auto" style={{ maxWidth: 680 }}>
                <div className="card-body">

                    {/* ===== HEADER ===== */}
                    <div className="text-center mb-2">
                        <h5 className="fw-bold mb-1">Booking Details</h5>
                        <span className="badge bg-dark">
                            Ticket #{ticketId}
                        </span>
                    </div>

                    <form onSubmit={handleSubmit} className="row g-2">

                        {/* ===== CUSTOMER DETAILS ===== */}
                        <h6 className="fw-bold mt-2">Customer Information</h6>

                        <div className="col-md-6">
                            <label className="form-label">Name</label>
                            <input className="form-control" name="name"
                                value={customerData.name}
                                onChange={handleCustomerChange} />
                        </div>

                        <div className="col-md-6">
                            <label className="form-label">Email</label>
                            <input className="form-control" name="email"
                                value={customerData.email}
                                onChange={handleCustomerChange} />
                        </div>

                        <div className="col-md-6">
                            <label className="form-label">Contact</label>
                            <input className="form-control" name="contact"
                                value={customerData.contact}
                                onChange={handleCustomerChange} />
                        </div>

                        <div className="col-md-6">
                            <label className="form-label">Alternate Contact</label>
                            <input className="form-control" name="alternateContact"
                                value={customerData.alternateContact}
                                onChange={handleCustomerChange} />
                        </div>

                        {/* ===== BOOKING DETAILS ===== */}
                        <h6 className="fw-bold">Booking Information</h6>

                        <div className="col-12">
                            <label className="form-label fw-bold">Yacht</label>

                            {isAdmin ? (
                                <select
                                    className="form-select"
                                    name="yachtId"
                                    value={bookingData.yachtId || ""}
                                    onChange={(e) =>
                                        setBookingData((p) => ({
                                            ...p,
                                            yachtId: e.target.value,
                                            startTime: "",
                                            endTime: "",
                                        }))
                                    }
                                >
                                    <option value="" disabled>
                                        -- Select Yacht --
                                    </option>

                                    {yachts.map((y) => (
                                        <option key={y._id} value={y._id}>
                                            {y.name}
                                        </option>
                                    ))}
                                </select>

                            ) : (
                                <input
                                    className="form-control"
                                    value={booking?.yachtId?.name}
                                    disabled
                                />
                            )}
                        </div>


                        <div className="col-md-6">
                            <label className="form-label">Date</label>
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

                        <div className="col-md-6">
                            <label className="form-label fw-bold">Time Slot</label>

                            {isAdmin ? (
                                <select
                                    className="form-select"
                                    value={bookingData.startTime}
                                    onChange={(e) => {
                                        const slot = startTimeOptions.find(
                                            (s) => s.start === e.target.value
                                        );
                                        setBookingData((p) => ({
                                            ...p,
                                            startTime: slot?.start || "",
                                            endTime: slot?.end || "",
                                        }));
                                    }}
                                >
                                    <option value="">-- Select Time Slot --</option>
                                    {startTimeOptions.map((s, i) => (
                                        <option key={`${s.start}-${s.end}`} value={s.start}>
                                            {to12Hour(s.start)} – {to12Hour(s.end)}
                                        </option>
                                    ))}
                                </select>
                            ) : (
                                <input
                                    className="form-control"
                                    value={`${to12Hour(bookingData.startTime)} - ${to12Hour(
                                        bookingData.endTime
                                    )}`}
                                    disabled
                                />
                            )}
                        </div>

                        {/* ===== ACTIONS ===== */}
                        <div className="col-12 d-flex gap-2 mt-4">
                            <button
                                type="button"
                                className="btn btn-outline-secondary flex-fill"
                                onClick={() => navigate(-1)}
                            >
                                Cancel
                            </button>

                            <button
                                type="submit"
                                className="btn btn-primary flex-fill"
                                disabled={isSubmitDisabled()}
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
