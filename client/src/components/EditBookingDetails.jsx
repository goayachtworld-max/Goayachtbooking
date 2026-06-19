import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getAllYachtsAPI } from "../services/operations/yautAPI";
import toast from "react-hot-toast";
import { rescheduleBookingAPI, updateBookingExtrasAPI } from "../services/operations/bookingAPI";
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
    const [yachtSearch, setYachtSearch]     = useState(booking?.yachtId?.name || "");
    const [yachtSugg,   setYachtSugg]       = useState([]);
    const [showYachtSugg, setShowYachtSugg] = useState(false);



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
    const parseExtrasFromNotes = (notes = "") => {
        return notes
            .split("\n")
            .filter((l) => l.startsWith("- "))
            .map((l) => l.replace("- ", "").trim());
    };


    const [selectedExtras, setSelectedExtras] = useState(
        parseExtrasFromNotes(booking?.extraDetails)
    );

    const extractNotesOnly = (text = "") => {
        const idx = text.indexOf("Notes:");
        if (idx === -1) return "";
        return text.slice(idx + 6).trim();
    };


    const [manualNotes, setManualNotes] = useState(
        extractNotesOnly(booking?.extraDetails)
    );


    const [extraDetails, setExtraDetails] = useState(
        booking?.extraDetails || ""
    );

    const [showExtraNotes, setShowExtraNotes] = useState(false);

    const extraOptions = {
        inclusions: [
            "Soft Drink",
            "Ice Cube",
            "Water Bottles",
            "Bluetooth Speaker",
            "Captain & Crew",
            "Snacks"
        ],
        paidServices: [
            "DSLR Photography",
            "Drone - Photography & Videography",
        ],
    };

    const handleExtraToggle = (label) => {
        setSelectedExtras((prev) =>
            prev.includes(label)
                ? prev.filter((i) => i !== label)
                : [...prev, label]
        );
    };

    /* ===== HANDLERS ===== */
    const handleBookingChange = (e) => {
        const { name, value } = e.target;
        setBookingData((p) => ({ ...p, [name]: value }));
    };

    const handleCustomerChange = (e) => {
        const { name, value } = e.target;
        const cleaned = (name === "contact" || name === "alternateContact")
            ? value.replace(/\s/g, "")
            : value;
        setCustomerData((p) => ({ ...p, [name]: cleaned }));
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

    const isExtrasChanged = () => {
        const originalExtras = parseExtrasFromNotes(booking?.extraDetails || "");
        const originalNotes = extractNotesOnly(booking?.extraDetails || "");

        if (originalNotes !== manualNotes) return true;
        if (originalExtras.length !== selectedExtras.length) return true;

        return !selectedExtras.every((e) => originalExtras.includes(e));
    };

    const isSlotBooked = (slot, bookings, currentBooking) => {
    if (!bookings) return false;

    const toMin = (t) => {
        const [h, m] = t.split(":").map(Number);
        return h * 60 + m;
    };

    const slotStart = toMin(slot.start);
    const slotEnd = toMin(slot.end);

    return bookings.some((b) => {

        // ignore current booking
        if (
            b.startTime === currentBooking.startTime &&
            b.endTime === currentBooking.endTime
        ) {
            return false;
        }

        const bookStart = toMin(b.startTime);
        const bookEnd = toMin(b.endTime);

        return slotStart < bookEnd && slotEnd > bookStart;
    });
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
        if (!isCustomerChanged() && !isBookingChanged() && !isExtrasChanged()) return true;

        return false;
    };


    /* ===== SUBMIT ===== */
    const handleSubmit = async (e) => {
        e.preventDefault();

        const token = localStorage.getItem("authToken");

        try {
            const extraDetails = `
Inclusions / Services:
${selectedExtras.map((i) => `- ${i}`).join("\n")}

${manualNotes ? `Notes:\n${manualNotes}` : ""}
`.trim();

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
            if (isExtrasChanged()) {
                console.log("extra api is called")

                await updateBookingExtrasAPI(
                    booking._id,
                    { extraDetails },
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
                        extraDetails
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
        const slotsWithStatus = slots.map((slot) => ({
            ...slot,
            isBooked: isSlotBooked(slot, yacht.bookings, bookingData)
        }));

        setStartTimeOptions(slotsWithStatus);


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

    /* Sync yachtSearch text when yachts list loads */
    useEffect(() => {
        if (bookingData.yachtId && yachts.length > 0 && !yachtSearch) {
            const found = yachts.find((y) => y._id === bookingData.yachtId);
            if (found) setYachtSearch(found.name);
        }
    }, [yachts]);

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

                        {/* ===== EXTRA INCLUSIONS ===== */}
                        <div className="d-flex justify-content-between align-items-center mt-3">
                            <h6 className="fw-bold mb-0">Extra Details</h6>

                            <button
                                type="button"
                                className="btn btn-sm btn-outline-secondary"
                                onClick={() => setShowExtraNotes((p) => !p)}
                            >
                                {showExtraNotes ? "−" : "+"}
                            </button>
                        </div>

                        {showExtraNotes && (
                            <div className="border rounded p-1">
                                <h6 className="fw-bold mt-3">Extra Inclusions</h6>
                                <div className="row">
                                    {extraOptions.inclusions.map((item) => (
                                        <div className="col-md-6" key={item}>
                                            <div className="form-check">
                                                <input
                                                    className="form-check-input"
                                                    type="checkbox"
                                                    checked={selectedExtras.includes(item)}
                                                    onChange={() => handleExtraToggle(item)}
                                                />
                                                <label className="form-check-label">{item}</label>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <hr />

                                <h6 className="fw-bold">Paid Services</h6>
                                <div className="row">
                                    {extraOptions.paidServices.map((item) => (
                                        <div className="col-md-6" key={item}>
                                            <div className="form-check">
                                                <input
                                                    className="form-check-input"
                                                    type="checkbox"
                                                    checked={selectedExtras.includes(item)}
                                                    onChange={() => handleExtraToggle(item)}
                                                />
                                                <label className="form-check-label">{item}</label>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <textarea
                                    className="form-control mt-2"
                                    rows={4}
                                    placeholder="Extra notes..."
                                    value={manualNotes}
                                    onChange={(e) => setManualNotes(e.target.value)}
                                />

                            </div>)}


                        {/* ===== BOOKING DETAILS ===== */}
                        <h6 className="fw-bold">Booking Information</h6>
                        <div className="col-12">
                            <label className="form-label fw-bold">Yacht</label>
                            {isAdmin ? (
                                <div style={{ position: "relative" }}>
                                    <input
                                        className="form-control"
                                        type="text"
                                        autoComplete="off"
                                        placeholder="Search yacht…"
                                        value={yachtSearch}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setYachtSearch(val);
                                            setBookingData((p) => ({ ...p, yachtId: "", startTime: "", endTime: "" }));
                                            const q = val.toLowerCase();
                                            const filtered = q
                                                ? yachts.filter((y) => y.name?.toLowerCase().includes(q))
                                                : yachts;
                                            setYachtSugg(filtered.slice(0, 12));
                                            setShowYachtSugg(true);
                                        }}
                                        onFocus={() => {
                                            const q = yachtSearch.toLowerCase();
                                            const filtered = q
                                                ? yachts.filter((y) => y.name?.toLowerCase().includes(q))
                                                : yachts;
                                            setYachtSugg(filtered.slice(0, 12));
                                            setShowYachtSugg(true);
                                        }}
                                        onBlur={() => setTimeout(() => setShowYachtSugg(false), 150)}
                                        style={{ paddingRight: yachtSearch ? 30 : undefined }}
                                    />
                                    {yachtSearch && (
                                        <span
                                            onClick={() => {
                                                setYachtSearch("");
                                                setYachtSugg([]);
                                                setShowYachtSugg(false);
                                                setBookingData((p) => ({ ...p, yachtId: "", startTime: "", endTime: "" }));
                                            }}
                                            style={{
                                                position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                                                cursor: "pointer", color: "#94a3b8", fontSize: "1.1rem", lineHeight: 1,
                                                padding: "0 2px", zIndex: 1,
                                            }}
                                        >×</span>
                                    )}
                                    {showYachtSugg && yachtSugg.length > 0 && (
                                        <div style={{
                                            position: "absolute", top: "100%", left: 0, right: 0, zIndex: 9999,
                                            background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 10,
                                            boxShadow: "0 8px 24px rgba(5,24,41,0.13)", marginTop: 3,
                                            maxHeight: 220, overflowY: "auto",
                                        }}>
                                            {yachtSugg.map((y) => {
                                                const isSelected = bookingData.yachtId === y._id;
                                                return (
                                                    <div
                                                        key={y._id}
                                                        onMouseDown={() => {
                                                            setYachtSearch(y.name);
                                                            setYachtSugg([]);
                                                            setShowYachtSugg(false);
                                                            setBookingData((p) => ({ ...p, yachtId: y._id, startTime: "", endTime: "" }));
                                                        }}
                                                        style={{
                                                            padding: "9px 14px", cursor: "pointer", fontSize: "0.88rem",
                                                            background: isSelected ? "#eff6ff" : "#fff",
                                                            borderBottom: "1px solid #f1f5f9",
                                                        }}
                                                        onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = "#f8fafc"; }}
                                                        onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = "#fff"; }}
                                                    >
                                                        <div style={{ fontWeight: 600, color: "#1e293b" }}>{y.name}</div>
                                                        {y.capacity && (
                                                            <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: 1 }}>Cap: {y.capacity}</div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <input
                                    className="form-control"
                                    value={booking?.yachtId?.name}
                                    disabled
                                />
                            )}
                            {/* <div className="col-12">
                                <label className="form-label fw-bold">Yacht</label>
                                <input
                                    className="form-control"
                                    value={booking?.yachtId?.name || ""}
                                    readOnly
                                />
                            </div> */}

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
                                        <option key={`${s.start}-${s.end}`} value={s.start} disabled={s.isBooked}>
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
