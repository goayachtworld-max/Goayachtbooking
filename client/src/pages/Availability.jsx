import React, { useEffect, useState, useCallback } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import { Carousel } from "react-bootstrap";
import { getAvailabilitySummary } from "../services/operations/availabilityAPI";
import { useNavigate, useLocation } from "react-router-dom";
import { generateTextImage } from "../utils/generateTextImage";
import "./Availability.css";
import { FiSliders, FiX, FiCalendar } from "react-icons/fi";

const CAPACITY_OPTS = [
  { value: "", label: "Any" },
  { value: "small", label: "1–5" },
  { value: "medium", label: "6–10" },
  { value: "large", label: "11–20" },
  { value: "xlarge", label: "21+" },
];

const BUDGET_OPTS = [
  { value: "", label: "Any" },
  { value: "low", label: "< ₹5k" },
  { value: "mid", label: "₹5k–10k" },
  { value: "high", label: "₹10k–20k" },
  { value: "premium", label: "₹20k+" },
];

/* ── Cache helpers ── */
const CACHE_TTL = 2 * 60 * 1000; // 2 minutes

// Returns user-specific prefix so cached data never leaks across accounts
const getAvUserPrefix = () => {
  try { return JSON.parse(localStorage.getItem("user") || "{}")?._id || "anon"; } catch { return "anon"; }
};

const getCached = (key) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) { localStorage.removeItem(key); return null; }
    return data;
  } catch { return null; }
};

const setCache = (key, data) => {
  try { localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data })); } catch {}
};

const cacheKey = (startDate, endDate) => `av_${getAvUserPrefix()}_${startDate}_${endDate}`;

/* ── Format availability response ── */
const formatResponse = (res) => {
  if (!res?.success || !res?.yachts) return null;
  return res.yachts.map((y) => ({
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
};

/* ── Skeleton card components ── */
const MobileSkeletonCard = () => (
  <div className="av-card av-skel-card">
    <div className="av-skel-thumb" />
    <div className="av-card-body">
      <div className="av-skel-line av-skel-name" />
      <div className="av-skel-line av-skel-meta" />
      <div className="av-skel-days">
        <div className="av-skel-day" />
        <div className="av-skel-day" />
        <div className="av-skel-day" />
      </div>
    </div>
  </div>
);

const DesktopSkeletonCard = () => (
  <div className="col-md-6 col-lg-4">
    <div className="card h-100 av-skel-card" style={{ borderRadius: 20, overflow: "hidden" }}>
      <div className="av-skel-img" />
      <div className="card-body p-3">
        <div className="av-skel-line av-skel-name" />
        <div className="av-skel-line av-skel-meta" />
        <div className="av-skel-days mt-3">
          <div className="av-skel-day" />
          <div className="av-skel-day" />
          <div className="av-skel-day" />
        </div>
      </div>
    </div>
  </div>
);

function Availability() {
  const navigate = useNavigate();
  const token = localStorage.getItem("authToken");

  const [availability, setAvailability] = useState([]);
  const [selectedWeek, setSelectedWeek] = useState("");
  const [loading, setLoading] = useState(false); // true only when NO cached data

  const location = useLocation();
  const params = new URLSearchParams(location.search);

  const [filterCapacity, setFilterCapacity] = useState(params.get("capacity") || "");
  const [filterBudget, setFilterBudget] = useState(params.get("budget") || "");
  const [filterDate, setFilterDate] = useState(
    params.get("date") || new Date().toISOString().split("T")[0]
  );
  const [searchQuery, setSearchQuery] = useState(params.get("search") || "");
  const [showFilters, setShowFilters] = useState(false);

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
    if (filterDate) p.set("date", filterDate);
    navigate({ search: p.toString() }, { replace: true });
  }, [filterCapacity, filterBudget, searchQuery, filterDate, navigate]);

  const fetchAvailability = useCallback(
    async (customDate) => {
      if (!token) return;

      const start = customDate ? new Date(customDate) : new Date();
      const end = new Date(start);
      end.setDate(start.getDate() + 3);
      const startDate = start.toISOString().split("T")[0];
      const endDate = end.toISOString().split("T")[0];

      const weekLabel = `${start.toLocaleString("en-US", {
        month: "short", day: "numeric",
      })} – ${end.toLocaleString("en-US", {
        month: "short", day: "numeric", year: "numeric",
      })}`;
      setSelectedWeek(weekLabel);

      const key = cacheKey(startDate, endDate);
      const cached = getCached(key);

      if (cached) {
        // Show cached data instantly — no spinner
        setAvailability(cached);
        setLoading(false);
      } else {
        // No cache — show skeleton
        setLoading(true);
      }

      // Always revalidate in background (silently if cache hit)
      try {
        const res = await getAvailabilitySummary(startDate, endDate, token);
        const formatted = formatResponse(res);
        if (formatted) {
          setAvailability(formatted);
          setCache(key, formatted);
        } else if (!cached) {
          setAvailability([]);
        }
      } catch (err) {
        console.error("Failed to fetch availability:", err);
        if (!cached) setAvailability([]);
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
  const capacityLabel = CAPACITY_OPTS.find((o) => o.value === filterCapacity)?.label;
  const budgetLabel = BUDGET_OPTS.find((o) => o.value === filterBudget)?.label;

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
     DESKTOP UI  (>= 700px)
  ───────────────────────────────────── */
  const renderDesktop = () => (
    <div className="container mt-2 mb-4">
      <div className="filter-box">
        <div className="filter-section">
          <label className="filter-label">
            <FiCalendar size={13} style={{ marginRight: 4 }} />
            Start Date
          </label>
          <input
            type="date"
            className="av-desktop-date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
          />
        </div>

        <div className="filter-section">
          <label className="filter-label">Guests</label>
          <div className="av-chip-group">
            {CAPACITY_OPTS.map((o) => (
              <button
                key={o.value}
                className={`av-chip${filterCapacity === o.value ? " av-chip--active" : ""}`}
                onClick={() => setFilterCapacity(o.value)}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <div className="filter-section">
          <label className="filter-label">Price Range</label>
          <div className="av-chip-group">
            {BUDGET_OPTS.map((o) => (
              <button
                key={o.value}
                className={`av-chip${filterBudget === o.value ? " av-chip--active" : ""}`}
                onClick={() => setFilterBudget(o.value)}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <div className="filter-section filter-section--search">
          <label className="filter-label">Search</label>
          <div className="av-search-wrap">
            <input
              type="text"
              className="av-desktop-search"
              placeholder="Yacht or company…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button className="av-search-clear" onClick={() => setSearchQuery("")}>
                <FiX size={13} />
              </button>
            )}
          </div>
        </div>

        {hasActiveFilters && (
          <button className="btn-av-clear" onClick={handleClear}>
            <FiX size={14} /> Clear
          </button>
        )}
      </div>

      <div className="row g-4">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => <DesktopSkeletonCard key={i} />)
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
     MOBILE UI  (< 700px)
  ───────────────────────────────────── */
  const renderMobile = () => (
    <div className="av-container">
      <div className="av-searchbar">
        <button className="btn-back-icon" onClick={() => navigate(-1)} aria-label="Go back">
          <svg viewBox="0 0 20 20" fill="none"><path d="M12.5 5L7.5 10L12.5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <div className="av-search-wrap">
          <input
            type="text"
            className="av-search-input"
            placeholder="Search yacht or company…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="av-search-clear" onClick={() => setSearchQuery("")}>
              <FiX size={14} />
            </button>
          )}
        </div>
        <button
          className={`av-filter-btn ${hasActiveFilters ? "av-filter-btn--active" : ""}`}
          onClick={() => setShowFilters(true)}
          aria-label="Filters"
        >
          <FiSliders size={18} />
          {hasActiveFilters && <span className="av-filter-dot" />}
        </button>
      </div>

      {hasActiveFilters && (
        <div className="av-active-filters">
          {filterCapacity && (
            <span className="av-pill">
              👥 {capacityLabel}
              <button onClick={() => setFilterCapacity("")}><FiX size={11} /></button>
            </span>
          )}
          {filterBudget && (
            <span className="av-pill">
              {budgetLabel}
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

      <div className="av-list">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => <MobileSkeletonCard key={i} />)
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

      {showFilters && (
        <div className="av-drawer-backdrop" onClick={() => setShowFilters(false)}>
          <div className="av-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="av-drawer-drag" />
            <div className="av-drawer-header">
              <span>Filters</span>
              <button className="av-drawer-close" onClick={() => setShowFilters(false)}>
                <FiX size={20} />
              </button>
            </div>

            <label className="av-drawer-label">Start Date</label>
            <input
              type="date"
              className="av-drawer-date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
            />

            <label className="av-drawer-label">Guests</label>
            <div className="av-chip-group">
              {CAPACITY_OPTS.map((o) => (
                <button
                  key={o.value}
                  className={`av-chip${filterCapacity === o.value ? " av-chip--active" : ""}`}
                  onClick={() => setFilterCapacity(o.value)}
                >
                  {o.label}
                </button>
              ))}
            </div>

            <label className="av-drawer-label">Price Range</label>
            <div className="av-chip-group">
              {BUDGET_OPTS.map((o) => (
                <button
                  key={o.value}
                  className={`av-chip${filterBudget === o.value ? " av-chip--active" : ""}`}
                  onClick={() => setFilterBudget(o.value)}
                >
                  {o.label}
                </button>
              ))}
            </div>

            <div className="av-drawer-actions">
              <button className="av-drawer-clear" onClick={handleClear}>Clear filters</button>
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
