import React, { useEffect, useState, useCallback } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import { Carousel } from "react-bootstrap";
import { getAvailabilitySummary } from "../services/operations/availabilityAPI";
import { useNavigate, useLocation } from "react-router-dom";
import { generateTextImage } from "../utils/generateTextImage";
import "./Availability.css";
import { FiSliders } from "react-icons/fi";

function Availability() {
  const navigate = useNavigate();
  const token = localStorage.getItem("authToken");

  const [availability, setAvailability] = useState([]);
  const [selectedWeek, setSelectedWeek] = useState("");
  const [loading, setLoading] = useState(false);

  const location = useLocation();
  const params = new URLSearchParams(location.search);

  const [filterCapacity, setFilterCapacity] = useState(params.get("capacity") || "");
  const [filterBudget, setFilterBudget] = useState(params.get("budget") || "");
  const [filterDate] = useState(new Date().toISOString().split("T")[0]);

  const [searchQuery, setSearchQuery] = useState(params.get("search") || "");

  const [isMobile, setIsMobile] = useState(window.innerWidth < 550);
  const [showFilters, setShowFilters] = useState(false);

  // Screen resize effect
  useEffect(() => {
    const onResize = () => {
      const mobile = window.innerWidth < 550;
      setIsMobile(mobile);
      if (!mobile) setShowFilters(false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);


  useEffect(() => {
    const p = new URLSearchParams();
    if (filterCapacity) p.set("capacity", filterCapacity);
    if (filterBudget) p.set("budget", filterBudget);
    if (searchQuery) p.set("search", searchQuery);
    navigate({ search: p.toString() }, { replace: true });
  }, [filterCapacity, filterBudget, searchQuery, navigate]);


  const fetchAvailability = useCallback(
    async (customDate) => {
      if (!token) return;
      try {
        setLoading(true);

        const start = customDate ? new Date(customDate) : new Date();
        const end = new Date(start);
        end.setDate(start.getDate() + 3);

        const startDate = start.toISOString().split("T")[0];
        const endDate = end.toISOString().split("T")[0];

        const weekLabel = `${start.toLocaleString("en-US", {
          month: "short",
          day: "numeric",
        })} - ${end.toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })}`;

        setSelectedWeek(weekLabel);

        const res = await getAvailabilitySummary(startDate, endDate, token);
        console.log("res : ", res);
        if (res?.success && res?.yachts) {
          const formatted = res.yachts.map((y) => ({
            yachtId: y.yachtId || y._id,
            name: y.name || y.yachtName,
            company: y.company,
            capacity: y.capacity,
            status: y.status,
            sellingPrice: y.sellingPrice || y.maxSellingPrice || 0,
            runningCost: y.runningCost,
            yachtPhotos:
              y.yachtPhotos?.length > 0
                ? y.yachtPhotos
                : y.photos?.length > 0
                  ? y.photos
                  : [],

            days: (y.availability || []).map((a) => ({
              day: new Date(a.date).toLocaleDateString("en-US", {
                weekday: "short",
              }),
              date: new Date(a.date).toISOString().split("T")[0],
              status:
                a.status === "busy"
                  ? "Busy"
                  : a.status === "locked"
                    ? "Locked"
                    : "Free",
              bookedSlots: a.bookingsCount ? Array(a.bookingsCount).fill({}) : [],
            })),
          }));
          setAvailability(formatted);
        } else {
          setAvailability([]);
        }
      } catch (err) {
        console.error("Failed to fetch availability:", err);
        setAvailability([]);
      } finally {
        setLoading(false);
      }
    },
    [token]
  );

  useEffect(() => {
    if (token) fetchAvailability(filterDate);
  }, [token, filterDate, fetchAvailability]);

  const handleClear = () => {
    setFilterCapacity("");
    setFilterBudget("");
  };

  const rankedAvailability = availability
    .map((yacht) => {
      let score = 0;

      if (filterCapacity) {
        const [min, max] =
          filterCapacity === "small"
            ? [1, 5]
            : filterCapacity === "medium"
              ? [6, 10]
              : filterCapacity === "large"
                ? [11, 20]
                : [21, Infinity];

        if (yacht.capacity >= min && yacht.capacity <= max) score += 4;
      }

      if (filterBudget) {
        const [min, max] =
          filterBudget === "low"
            ? [0, 4999]
            : filterBudget === "mid"
              ? [5000, 10000]
              : filterBudget === "high"
                ? [10001, 20000]
                : [20001, Infinity];

        if (yacht.sellingPrice >= min && yacht.sellingPrice <= max) score += 4;
      }

      return { ...yacht, score };
    })
    .sort((a, b) => b.score - a.score);

  // ---------------- SMART SEARCH (FRONTEND) ----------------
  const filteredAvailability = rankedAvailability.filter((yacht) => {
    if (!searchQuery) return true;

    const q = searchQuery.toLowerCase();

    return (
      yacht.name?.toLowerCase().includes(q) ||          // Yacht name
      yacht.company?.name?.toLowerCase().includes(q) || // Company name
      yacht.company?.toLowerCase().includes(q)          // If company is string
    );
  });

  return (
    <div className="container mt-2 mb-4">
      <h3 className="text-center mb-2 availability-title">
        Yacht Availability
      </h3>

      {/* FILTER BAR */}
      {!isMobile && (
        <div className="d-flex flex-wrap justify-content-between align-items-end mb-4 py-2 px-1 rounded-4 filter-box">
          <div className="d-flex flex-wrap gap-1">
            <div>
              <label className="form-label mb-1 fw-semibold">Capacity</label>
              <select
                className="form-select shadow-sm capacity-select"
                value={filterCapacity}
                onChange={(e) => setFilterCapacity(e.target.value)}
              >
                <option value="">All</option>
                <option value="small">1–5</option>
                <option value="medium">6–10</option>
                <option value="large">11–20</option>
                <option value="xlarge">21+</option>
              </select>
            </div>

            <div>
              <label className="form-label mb-1 fw-semibold">Budget</label>
              <select
                className="form-select shadow-sm budget-select"
                value={filterBudget}
                onChange={(e) => setFilterBudget(e.target.value)}
              >
                <option value="">All</option>
                <option value="low">Under ₹5,000</option>
                <option value="mid">₹5,000 – ₹10,000</option>
                <option value="high">₹10,000 – ₹20,000</option>
                <option value="premium">Above ₹20,000</option>
              </select>
            </div>

            <div>
              <label className="form-label mb-1 fw-semibold">Search</label>
              <input
                type="text"
                className="form-control shadow-sm"
                placeholder="Search Yacht / Company"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

          </div>

          <button className="btn btn-secondary px-3 py-2 clear-btn" onClick={handleClear}>
            Clear
          </button>
        </div>
      )}
      {isMobile && (
        <div className="d-flex align-items-center gap-2 mb-3">
          <input
            type="text"
            className="form-control"
            placeholder="Search Yacht / Company"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ flex: 1 }}
          />
          <button
            className="btn p-0 d-flex align-items-center justify-content-center"
            style={{ width: "40px", height: "40px" }}
            onClick={() => setShowFilters(true)}
          >
            <FiSliders size={22} />
          </button>
        </div>
      )}

      {/* MAIN GRID */}
      <div className="row g-4">
        {loading ? (
          <div className="text-center mt-5">
            <div className="spinner-border text-primary" role="status"></div>
          </div>
        ) : availability.length === 0 ? (
          <div className="text-center text-muted mt-5">No yachts found</div>
        ) : (
          filteredAvailability.map((yacht, index) => {
            const nextThreeDays = yacht.days.slice(0, 3);
            const today = new Date().toISOString().split("T")[0];

            // If no images, generate placeholder
            const images = yacht.yachtPhotos.length
              ? yacht.yachtPhotos
              : [generateTextImage(yacht.name)];

            return (
              <div className="col-md-6 col-lg-4" key={yacht.yachtId || index}>
                <div
                  className="card h-100 card-yacht"
                  onClick={() =>
                    navigate(`/availability/${encodeURIComponent(yacht.name)}/${today}`, {
                      state: { yachtId: yacht.yachtId, yachtName: yacht.name, day: today },
                    })
                  }
                >
                  {images.length > 1 ? (
                    <Carousel
                      indicators={false}
                      controls
                      interval={2500}
                      onClick={(e) => {
                        // If click is NOT on arrows → allow navigation
                        if (
                          e.target.closest(".carousel-control-prev") ||
                          e.target.closest(".carousel-control-next")
                        ) {
                          e.stopPropagation();
                        }
                      }}
                      onTouchStart={(e) => e.stopPropagation()} // prevent swipe navigation
                    >
                      {images.map((img, i) => (
                        <Carousel.Item key={i}>
                          <img
                            src={img}
                            alt={yacht.name}
                            className="yacht-img"
                          />
                        </Carousel.Item>
                      ))}
                    </Carousel>
                  ) : (
                    <img
                      src={images[0]}
                      alt={yacht.name}
                      className="yacht-img"
                    />
                  )}


                  <div className="card-body p-3">
                    <h5 className="mb-1 yacht-name">{yacht.name}</h5>

                    <p className="text-muted small mb-2">
                      👥: <strong>{yacht.capacity}</strong> |
                      B2B: <strong>₹{yacht?.runningCost}</strong> |
                      B2C: <strong>₹{yacht?.sellingPrice}</strong>
                    </p>

                    <div className="d-flex justify-content-between mt-3">
                      {nextThreeDays.map((day, i) => {
                        const bg =
                          day.status === "Busy"
                            ? "#ffd659"
                            : day.status === "Locked"
                              ? "#d9d9d9"
                              : "#28a745";

                        return (
                          <div
                            key={i}
                            className="text-center p-2 day-box"
                            style={{ background: bg, cursor: "pointer" }}
                            onClick={(e) => {
                              e.stopPropagation();

                              // Check if this is the "Other" day (3rd day)
                              const d = new Date(day.date);
                              const dayAfter = new Date();
                              dayAfter.setDate(new Date().getDate() + 2);

                              const same = (a, b) =>
                                a.getFullYear() === b.getFullYear() &&
                                a.getMonth() === b.getMonth() &&
                                a.getDate() === b.getDate();

                              const isOtherDay = same(d, dayAfter);

                              if (isOtherDay) {
                                // For "Other", navigate WITHOUT date
                                navigate(`/availability/${encodeURIComponent(yacht.name)}`, {
                                  state: {
                                    yachtId: yacht.yachtId,
                                    yachtName: yacht.name,
                                    requireDateSelection: true
                                  },
                                });
                              } else {
                                // For Today/Tomorrow, navigate WITH date
                                navigate(`/availability/${encodeURIComponent(yacht.name)}/${day.date}`, {
                                  state: {
                                    yachtId: yacht.yachtId,
                                    yachtName: yacht.name,
                                    day: day.date
                                  },
                                });
                              }
                            }}
                          >
                            <strong style={{ color: "#145DA0" }}>
                              {(() => {
                                const d = new Date(day.date);
                                const today = new Date();
                                const tomorrow = new Date();
                                const dayAfter = new Date();

                                tomorrow.setDate(today.getDate() + 1);
                                dayAfter.setDate(today.getDate() + 2);

                                const same = (a, b) =>
                                  a.getFullYear() === b.getFullYear() &&
                                  a.getMonth() === b.getMonth() &&
                                  a.getDate() === b.getDate();

                                if (same(d, today)) return "Today";
                                if (same(d, tomorrow)) return "Tomorrow";
                                if (same(d, dayAfter)) return "Other";

                                return d.toLocaleDateString("en-US", { day: "numeric", month: "short" });
                              })()}
                            </strong>

                            <br />
                            <small>
                              {day.bookedSlots.length
                                ? `${day.bookedSlots.length} bookings`
                                : "Free"}
                            </small>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

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
              placeholder="Search Yacht / Company"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />

            <select
              className="form-select mb-2"
              value={filterCapacity}
              onChange={(e) => setFilterCapacity(e.target.value)}
            >
              <option value="">All Capacities</option>
              <option value="small">1–5</option>
              <option value="medium">6–10</option>
              <option value="large">11–20</option>
              <option value="xlarge">21+</option>
            </select>

            <select
              className="form-select mb-2"
              value={filterBudget}
              onChange={(e) => setFilterBudget(e.target.value)}
            >
              <option value="">All Budgets</option>
              <option value="low">Under ₹5,000</option>
              <option value="mid">₹5,000 – ₹10,000</option>
              <option value="high">₹10,000 – ₹20,000</option>
              <option value="premium">Above ₹20,000</option>
            </select>

            <div className="d-flex gap-2 mt-2">
              <button
                className="btn btn-secondary flex-fill"
                onClick={handleClear}
              >
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

    </div>
  );
}

export default Availability;
