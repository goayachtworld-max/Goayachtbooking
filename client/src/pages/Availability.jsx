import React, { useEffect, useState, useCallback } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import { Carousel } from "react-bootstrap";
import { getAvailabilitySummary } from "../services/operations/availabilityAPI";
import { useNavigate, useLocation } from "react-router-dom";
import { generateTextImage } from "../utils/generateTextImage";
import "./Availability.css";
import { FiSliders, FiX } from "react-icons/fi";

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
  const [showFilters, setShowFilters] = useState(false);

  // Breakpoint: mobile < 700px, desktop >= 700px
  const [isMobile, setIsMobile] = useState(window.innerWidth < 700);

  useEffect(() => {
    const onResize = () => {
      const mobile = window.innerWidth < 700;
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
        })} – ${end.toLocaleString("en-US", {
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
              day: new Date(a.date).toLocaleDateString("en-US", { weekday: "short" }),
              date: new Date(a.date).toISOString().split("T")[0],
              status:
                a.status === "busy" ? "Busy" : a.status === "locked" ? "Locked" : "Free",
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
    setSearchQuery("");
  };

  const hasActiveFilters = filterCapacity || filterBudget || searchQuery;

  const rankedAvailability = availability
    .map((yacht) => {
      let score = 0;
      if (filterCapacity) {
        const [min, max] =
          filterCapacity === "small" ? [1, 5]
          : filterCapacity === "medium" ? [6, 10]
          : filterCapacity === "large" ? [11, 20]
          : [21, Infinity];
        if (yacht.capacity >= min && yacht.capacity <= max) score += 4;
      }
      if (filterBudget) {
        const [min, max] =
          filterBudget === "low" ? [0, 4999]
          : filterBudget === "mid" ? [5000, 10000]
          : filterBudget === "high" ? [10001, 20000]
          : [20001, Infinity];
        if (yacht.sellingPrice >= min && yacht.sellingPrice <= max) score += 4;
      }
      return { ...yacht, score };
    })
    .sort((a, b) => b.score - a.score);

  const filteredAvailability = rankedAvailability.filter((yacht) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      yacht.name?.toLowerCase().includes(q) ||
      yacht.company?.name?.toLowerCase().includes(q) ||
      yacht.company?.toLowerCase().includes(q)
    );
  });

  const getDayLabel = (dateStr) => {
    const d = new Date(dateStr);
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
    if (same(d, tomorrow)) return "Tmrw";
    if (same(d, dayAfter)) return "Other";
    return d.toLocaleDateString("en-US", { day: "numeric", month: "short" });
  };

  const today = new Date().toISOString().split("T")[0];

  const handleCardClick = (yacht) => {
    navigate(`/availability/${encodeURIComponent(yacht.name)}/${today}`, {
      state: { yachtId: yacht.yachtId, yachtName: yacht.name, day: today },
    });
  };

  const handleDayClick = (e, yacht, day) => {
    e.stopPropagation();
    const isOther = getDayLabel(day.date) === "Other";
    if (isOther) {
      navigate(`/availability/${encodeURIComponent(yacht.name)}`, {
        state: { yachtId: yacht.yachtId, yachtName: yacht.name, requireDateSelection: true },
      });
    } else {
      navigate(`/availability/${encodeURIComponent(yacht.name)}/${day.date}`, {
        state: { yachtId: yacht.yachtId, yachtName: yacht.name, day: day.date },
      });
    }
  };

  /* ─────────────────────────────────────
     DESKTOP UI  (>= 700px) — original
  ───────────────────────────────────── */
  const renderDesktop = () => (
    <div className="container mt-2 mb-4">
      <h3 className="text-center mb-2 availability-title">Yacht Availability</h3>

      {/* Desktop Filter Bar */}
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

      {/* Desktop Card Grid */}
      <div className="row g-4">
        {loading ? (
          <div className="text-center mt-5">
            <div className="spinner-border text-primary" role="status" />
          </div>
        ) : filteredAvailability.length === 0 ? (
          <div className="text-center text-muted mt-5">No yachts found</div>
        ) : (
          filteredAvailability.map((yacht, index) => {
            const nextThreeDays = yacht.days.slice(0, 3);
            const images = yacht.yachtPhotos.length
              ? yacht.yachtPhotos
              : [generateTextImage(yacht.name)];

            return (
              <div className="col-md-6 col-lg-4" key={yacht.yachtId || index}>
                <div className="card h-100 card-yacht" onClick={() => handleCardClick(yacht)}>
                  {images.length > 1 ? (
                    <Carousel
                      indicators={false}
                      controls
                      interval={2500}
                      onClick={(e) => {
                        if (
                          e.target.closest(".carousel-control-prev") ||
                          e.target.closest(".carousel-control-next")
                        ) {
                          e.stopPropagation();
                        }
                      }}
                      onTouchStart={(e) => e.stopPropagation()}
                    >
                      {images.map((img, i) => (
                        <Carousel.Item key={i}>
                          <img src={img} alt={yacht.name} className="yacht-img" />
                        </Carousel.Item>
                      ))}
                    </Carousel>
                  ) : (
                    <img src={images[0]} alt={yacht.name} className="yacht-img" />
                  )}

                  <div className="card-body p-3">
                    <h5 className="mb-1 yacht-name">{yacht.name}</h5>
                    <p className="text-muted small mb-2">
                      👥: <strong>{yacht.capacity}</strong> |
                      B2B: <strong>₹{yacht.runningCost}</strong> |
                      Price: <strong>₹{yacht.sellingPrice}</strong>
                    </p>

                    <div className="d-flex justify-content-between mt-3">
                      {nextThreeDays.map((day, i) => {
                        const bg =
                          day.status === "Busy" ? "#ffd659"
                          : day.status === "Locked" ? "#d9d9d9"
                          : "#28a745";
                        return (
                          <div
                            key={i}
                            className="text-center p-2 day-box"
                            style={{ background: bg, cursor: "pointer" }}
                            onClick={(e) => handleDayClick(e, yacht, day)}
                          >
                            <strong style={{ color: "#145DA0" }}>
                              {getDayLabel(day.date)}
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
    </div>
  );

  /* ─────────────────────────────────────
     MOBILE UI  (< 700px) — new compact
  ───────────────────────────────────── */
  const renderMobile = () => (
    <div className="av-container">
      {/* Header */}
      <div className="av-header">
        <h2 className="av-title">Yacht Availability</h2>
        {selectedWeek && <span className="av-week">{selectedWeek}</span>}
      </div>

      {/* Search + Filter toggle */}
      <div className="av-searchbar">
        <input
          type="text"
          className="av-search-input"
          placeholder="Search yacht or company…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <button
          className={`av-filter-btn ${hasActiveFilters ? "av-filter-btn--active" : ""}`}
          onClick={() => setShowFilters(true)}
          aria-label="Filters"
        >
          <FiSliders size={18} />
          {hasActiveFilters && <span className="av-filter-dot" />}
        </button>
      </div>

      {/* Active filter pills */}
      {hasActiveFilters && (
        <div className="av-active-filters">
          {filterCapacity && (
            <span className="av-pill">
              {filterCapacity}
              <button onClick={() => setFilterCapacity("")}><FiX size={11} /></button>
            </span>
          )}
          {filterBudget && (
            <span className="av-pill">
              {filterBudget}
              <button onClick={() => setFilterBudget("")}><FiX size={11} /></button>
            </span>
          )}
          {searchQuery && (
            <span className="av-pill">
              "{searchQuery}"
              <button onClick={() => setSearchQuery("")}><FiX size={11} /></button>
            </span>
          )}
        </div>
      )}

      {/* Compact card list */}
      <div className="av-list">
        {loading ? (
          <div className="av-state">
            <div className="spinner-border spinner-border-sm text-secondary" role="status" />
            <span>Loading…</span>
          </div>
        ) : filteredAvailability.length === 0 ? (
          <div className="av-state">No yachts found.</div>
        ) : (
          filteredAvailability.map((yacht, index) => {
            const nextThreeDays = yacht.days.slice(0, 3);
            const thumb = yacht.yachtPhotos.length
              ? yacht.yachtPhotos[0]
              : generateTextImage(yacht.name);

            return (
              <div className="av-card" key={yacht.yachtId || index}>
                <img
                  className="av-thumb"
                  src={thumb}
                  alt={yacht.name}
                  onClick={() => handleCardClick(yacht)}
                />
                <div className="av-card-body">
                  <div className="av-card-top" onClick={() => handleCardClick(yacht)}>
                    <span className="av-yacht-name">{yacht.name}</span>
                    <div className="av-meta">
                      <span>👥 {yacht.capacity}</span>
                      <span>B2B ₹{yacht.runningCost}</span>
                      <span>₹{yacht.sellingPrice}</span>
                    </div>
                  </div>
                  <div className="av-days">
                    {nextThreeDays.map((day, i) => (
                      <button
                        key={i}
                        className={`av-day av-day--${day.status.toLowerCase()}`}
                        onClick={(e) => handleDayClick(e, yacht, day)}
                      >
                        <span className="av-day-label">{getDayLabel(day.date)}</span>
                        <span className="av-day-sub">
                          {day.bookedSlots.length ? `${day.bookedSlots.length} bkg` : "Free"}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Bottom sheet filter drawer */}
      {showFilters && (
        <div className="av-drawer-backdrop" onClick={() => setShowFilters(false)}>
          <div className="av-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="av-drawer-header">
              <span>Filters</span>
              <button className="av-drawer-close" onClick={() => setShowFilters(false)}>
                <FiX size={20} />
              </button>
            </div>

            <label className="av-drawer-label">Capacity</label>
            <select
              className="av-drawer-select"
              value={filterCapacity}
              onChange={(e) => setFilterCapacity(e.target.value)}
            >
              <option value="">All</option>
              <option value="small">1–5</option>
              <option value="medium">6–10</option>
              <option value="large">11–20</option>
              <option value="xlarge">21+</option>
            </select>

            <label className="av-drawer-label">Budget</label>
            <select
              className="av-drawer-select"
              value={filterBudget}
              onChange={(e) => setFilterBudget(e.target.value)}
            >
              <option value="">All</option>
              <option value="low">Under ₹5,000</option>
              <option value="mid">₹5,000 – ₹10,000</option>
              <option value="high">₹10,000 – ₹20,000</option>
              <option value="premium">Above ₹20,000</option>
            </select>

            <div className="av-drawer-actions">
              <button className="av-drawer-clear" onClick={handleClear}>Clear all</button>
              <button className="av-drawer-apply" onClick={() => setShowFilters(false)}>Apply</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return isMobile ? renderMobile() : renderDesktop();
}

export default Availability;