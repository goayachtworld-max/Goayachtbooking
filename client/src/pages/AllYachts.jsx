import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  deleteYacht,
  getAllYachtsDetailsAPI,
  updateYacht,
} from "../services/operations/yautAPI";
import { FaEye, FaEdit, FaTrash, FaSortUp, FaSortDown } from "react-icons/fa";
import { toast } from "react-hot-toast";
import s from "../styles/yachtAdmin.module.css";

// ── helpers ────────────────────────────────────────────────────────
const SLOT_OPTIONS = [
  { value: "15:30", label: "3:30 PM – 5:30 PM" },
  { value: "16:00", label: "4:00 PM – 6:00 PM" },
  { value: "17:30", label: "5:30 PM – 7:30 PM" },
  { value: "18:00", label: "6:00 PM – 8:00 PM" },
];

function to12Hour(time) {
  if (!time) return "—";
  const [h, m] = time.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour = ((h + 11) % 12) + 1;
  return `${hour}:${m.toString().padStart(2, "0")} ${suffix}`;
}

function addTwoHoursTo12Hour(time12) {
  const date = new Date(`2024-01-01 ${time12}`);
  date.setHours(date.getHours() + 2);
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function calculateDuration(start, end) {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let s = sh * 60 + sm, e = eh * 60 + em;
  if (e < s) e += 24 * 60;
  const diff = e - s;
  const hrs = Math.floor(diff / 60), mins = diff % 60;
  return mins === 0 ? `${hrs} hrs` : `${hrs} hrs ${mins} mins`;
}

function toMinutes(value) {
  if (value === undefined || value === null || value === "") return 0;
  if (!isNaN(value)) return Number(value);
  const str = value.toString().trim();
  if (str.includes(":")) {
    const [h, m] = str.split(":").map(Number);
    return h * 60 + (m || 0);
  }
  return Number(str);
}

function minutesToHHMM(minutes) {
  const mins = Number(minutes) || 0;
  const h = Math.floor(mins / 60), m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// ── sub-components ─────────────────────────────────────────────────
function Carousel({ images }) {
  const [idx, setIdx] = useState(0);
  if (!images?.length) return <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>No images available.</p>;
  return (
    <div className={s.carousel}>
      <img src={images[idx]} alt={`yacht-${idx}`} />
      {images.length > 1 && (
        <>
          <button className={`${s.carouselBtn} ${s.prev}`} onClick={() => setIdx((i) => (i - 1 + images.length) % images.length)}>‹</button>
          <button className={`${s.carouselBtn} ${s.next}`} onClick={() => setIdx((i) => (i + 1) % images.length)}>›</button>
          <div className={s.carouselDots}>
            {images.map((_, i) => (
              <button key={i} className={`${s.carouselDot}${i === idx ? " " + s.active : ""}`} onClick={() => setIdx(i)} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── main component ─────────────────────────────────────────────────
const AllYachts = () => {
  const [yachts, setYachts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedYacht, setSelectedYacht] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editFieldErrors, setEditFieldErrors] = useState({});
  const [newImages, setNewImages] = useState([]);
  const [removedImages, setRemovedImages] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  // fetch
  useEffect(() => {
    (async () => {
      try {
        const token = localStorage.getItem("authToken");
        if (!token) { setError("Unauthorized. Please log in again."); setLoading(false); return; }
        const res = await getAllYachtsDetailsAPI(token);
        const yachtList = res?.data?.yachts || [];
        setYachts(yachtList.map((y) => ({
          ...y,
          images: y.yachtPhotos?.length ? y.yachtPhotos : y.photos?.length ? y.photos : ["/default-yacht.jpg"],
        })));
      } catch (err) {
        setError(err?.response?.data?.message || "Failed to fetch yachts");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // price validation
  useEffect(() => {
    if (!selectedYacht) return;
    const errors = {};
    const sHrs = Number(selectedYacht.defaultSailingHours || 0);
    const aHrs = Number(selectedYacht.defaultAnchoringHours || 0);
    const slotDurHrs = Number(toMinutes(selectedYacht.duration) || 0) / 60;

    // Default hrs must not exceed slot duration
    if (slotDurHrs > 0 && (sHrs + aHrs) > slotDurHrs + 0.001) {
      errors.defaultHours = `Default sailing + anchoring (${sHrs + aHrs} hrs) exceeds slot duration (${slotDurHrs} hrs)`;
    }

    const running = (Number(selectedYacht.sailingCost || 0) * sHrs) + (Number(selectedYacht.anchorageCost || 0) * aHrs);
    const maxSell = Number(selectedYacht.maxSellingPrice || 0);
    const sell = Number(selectedYacht.sellingPrice || 0);
    if (running && maxSell && maxSell <= running) errors.maxSellingPrice = "Max selling price must be > running cost";
    if (running && sell && sell < running) errors.sellingPrice = "Selling price must be ≥ running cost";
    if (maxSell && sell && sell > maxSell) errors.sellingPrice = "Selling price must be ≤ max selling price";
    setEditFieldErrors(errors);
  }, [selectedYacht?.sailingCost, selectedYacht?.anchorageCost, selectedYacht?.defaultSailingHours, selectedYacht?.defaultAnchoringHours, selectedYacht?.duration, selectedYacht?.maxSellingPrice, selectedYacht?.sellingPrice]);

  // preload special slots
  useEffect(() => {
    if (showEditModal && selectedYacht && !selectedYacht.specialSlot1 && !selectedYacht.specialSlot2) {
      const slots = selectedYacht.specialSlotTimes || [];
      setSelectedYacht((prev) => ({ ...prev, specialSlot1: slots[0] || null, specialSlot2: slots[1] || null }));
    }
  }, [showEditModal, selectedYacht?._id]);

  const handleSort = (key) =>
    setSortConfig((prev) => ({ key, direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc" }));

  const closeAllModals = () => {
    setShowViewModal(false); setShowEditModal(false); setShowDeleteModal(false);
  };

  const handleDelete = async () => {
    if (!selectedYacht) return;
    try {
      setLoading(true);
      await deleteYacht(selectedYacht._id, localStorage.getItem("authToken"));
      setYachts((prev) => prev.filter((y) => y._id !== selectedYacht._id));
      toast.success("Yacht deleted.", { icon: "🛥️" });
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to delete yacht");
    } finally {
      setLoading(false); setShowDeleteModal(false);
    }
  };

  const handleNewImages = (e) => {
    const files = Array.from(e.target.files || []);
    for (const file of files) {
      if (file.size > 1 * 1024 * 1024) { toast.error("Each image must be under 1 MB"); return; }
    }
    setNewImages((prev) => [...prev, ...files]);
    setImagePreviews((prev) => [...prev, ...files.map((f) => URL.createObjectURL(f))]);
  };

  const removeExistingImage = (img) => {
    setRemovedImages((prev) => [...prev, img]);
    setImagePreviews((prev) => prev.filter((i) => i !== img));
  };
  const removeNewImage = (index) => {
    setNewImages((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleEditSave = async () => {
    if (!selectedYacht) return;
    if (!selectedYacht.name || !selectedYacht.sellingPrice || !selectedYacht.maxSellingPrice) {
      toast.error("Please fill all required fields."); return;
    }
    if (Object.keys(editFieldErrors).length > 0) {
      toast.error("Fix validation errors first."); return;
    }
    try {
      setLoading(true);
      const token = localStorage.getItem("authToken");
      const specialSlotTimes = [selectedYacht.specialSlot1, selectedYacht.specialSlot2].filter(Boolean);
      const durationHHMM = minutesToHHMM(Number(selectedYacht.duration) || 0);

      const formData = new FormData();
      formData.append("name", selectedYacht.name);
      formData.append("capacity", selectedYacht.capacity);
      formData.append("sailingCost", selectedYacht.sailingCost);
      formData.append("anchorageCost", selectedYacht.anchorageCost);
      const runningCostCalc = (Number(selectedYacht.sailingCost) * Number(selectedYacht.defaultSailingHours || 0)) + (Number(selectedYacht.anchorageCost) * Number(selectedYacht.defaultAnchoringHours || 0));
      formData.append("runningCost", runningCostCalc);
      if (selectedYacht.defaultSailingHours != null) formData.append("defaultSailingHours", selectedYacht.defaultSailingHours);
      if (selectedYacht.defaultAnchoringHours != null) formData.append("defaultAnchoringHours", selectedYacht.defaultAnchoringHours);
      formData.append("sellingPrice", selectedYacht.sellingPrice);
      formData.append("maxSellingPrice", selectedYacht.maxSellingPrice);
      formData.append("sailStartTime", selectedYacht.sailStartTime);
      formData.append("sailEndTime", selectedYacht.sailEndTime);
      formData.append("duration", durationHHMM);
      formData.append("status", selectedYacht.status);
      formData.append("specialSlotTimes", JSON.stringify(specialSlotTimes));
      formData.append("boardingLocation", selectedYacht.boardingLocation || "");
      newImages.forEach((file) => formData.append("yachtPhotos", file));
      if (removedImages.length > 0) formData.append("removedPhotos", JSON.stringify(removedImages));

      const res = await updateYacht(selectedYacht._id, formData, token);
      const updated = res?.data?.yacht;
      setYachts((prev) => prev.map((y) =>
        y._id === updated._id ? { ...updated, images: updated.yachtPhotos?.length ? updated.yachtPhotos : ["/default-yacht.jpg"] } : y
      ));
      toast.success("Yacht updated successfully!");
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to update yacht");
    } finally {
      setLoading(false); setShowEditModal(false);
    }
  };

  const filteredYachts = search.trim()
    ? yachts.filter((y) => y.name?.toLowerCase().includes(search.toLowerCase()))
    : yachts;

  const sortedYachts = [...filteredYachts].sort((a, b) => {
    if (!sortConfig.key) return 0;
    const aVal = a[sortConfig.key], bVal = b[sortConfig.key];
    if (typeof aVal === "string") return sortConfig.direction === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    return sortConfig.direction === "asc" ? Number(aVal) - Number(bVal) : Number(bVal) - Number(aVal);
  });

  const SortIcon = ({ col }) => {
    const active = sortConfig.key === col;
    return (
      <span className={`${s.sortIcon}${active ? " " + s.active : ""}`}>
        {active && sortConfig.direction === "desc" ? <FaSortDown size={11} /> : <FaSortUp size={11} />}
      </span>
    );
  };

  // ── render ──────────────────────────────────────────────────────
  if (loading) return (
    <div className={`${s.root} ${s.page}`}>
      <div className={s.stateCenter}><div className={s.spinner} /><span>Loading yachts…</span></div>
    </div>
  );

  if (error) return (
    <div className={`${s.root} ${s.page}`}>
      <div className={s.stateCenter}><div className={s.alertDanger}>{error}</div></div>
    </div>
  );

  return (
    <div className={`${s.root} ${s.page}`}>

      {/* fixed top bar */}
      <div className={s.fixedTopBar}>
        <div className={s.fixedTopBarInner}>
          <button className="btn-back-icon" onClick={() => navigate(-1)} aria-label="Go back">
            <svg viewBox="0 0 20 20" fill="none"><path d="M12.5 5L7.5 10L12.5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <input
            className={s.searchInput}
            type="text"
            placeholder="Search yacht…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button className={s.fabAdd} onClick={() => navigate("/create-yacht")} title="Create Yacht">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M9 3V15M3 9H15" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      </div>

      {/* table */}
      {sortedYachts.length > 0 ? (
        <div className={s.tableCard}>
          <div className={s.tableWrap}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th className={s.hideXs}>#</th>
                  <th className={s.sortable} role="button" onClick={() => handleSort("name")}>
                    Yacht Name <SortIcon col="name" />
                  </th>
                  <th className={`${s.sortable} ${s.hideSm}`} role="button" onClick={() => handleSort("capacity")}>
                    Capacity <SortIcon col="capacity" />
                  </th>
                  <th className={`${s.sortable} ${s.hideSm}`} role="button" onClick={() => handleSort("runningCost")}>
                    Running Cost <SortIcon col="runningCost" />
                  </th>
                  <th className={s.hideXs}>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedYachts.map((yacht, index) => (
                  <tr key={yacht._id}>
                    <td className={s.hideXs}>{index + 1}</td>
                    <td className={s.yachtName}>{yacht.name}</td>
                    <td className={s.hideSm}>{yacht.capacity}</td>
                    <td className={s.hideSm}>₹{yacht.runningCost?.toLocaleString() || "—"}</td>
                    <td className={s.hideXs}>
                      <span className={`${s.badge} ${yacht.status === "active" ? s.badgeActive : s.badgeInactive}`}>
                        {yacht.status?.charAt(0).toUpperCase() + yacht.status?.slice(1)}
                      </span>
                    </td>
                    <td>
                      <div className={s.actionBtns}>
                        <button className={`${s.btnIcon} ${s.view}`} title="View" onClick={() => { setSelectedYacht(yacht); setShowViewModal(true); }}>
                          <FaEye size={13} />
                        </button>
                        <button className={`${s.btnIcon} ${s.edit}`} title="Edit" onClick={() => {
                          setSelectedYacht({ ...yacht, duration: toMinutes(yacht.duration) });
                          setImagePreviews(yacht.yachtPhotos || []);
                          setNewImages([]); setRemovedImages([]);
                          setShowEditModal(true);
                        }}>
                          <FaEdit size={13} />
                        </button>
                        <button className={`${s.btnIcon} ${s.trash}`} title="Delete" onClick={() => { setSelectedYacht(yacht); setShowDeleteModal(true); }}>
                          <FaTrash size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className={s.tableCard}><div className={s.emptyState}>No yachts found.</div></div>
      )}

      {/* ── VIEW PAGE ── */}
      {showViewModal && selectedYacht && (
        <div className={s.viewPage}>
          {/* Header */}
          <div className={s.editPageHeader}>
            <button className="btn-back-icon" onClick={closeAllModals} aria-label="Go back">
              <svg viewBox="0 0 20 20" fill="none"><path d="M12.5 5L7.5 10L12.5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
            <h2 className={s.editPageTitle} style={{ flex: 1, textAlign: "center" }}>{selectedYacht.name}</h2>
            <span className={`${s.viewStatus} ${selectedYacht.status === "active" ? s.viewStatusActive : s.viewStatusInactive}`}>
              {selectedYacht.status}
            </span>
          </div>

          {/* Body */}
          <div className={s.viewPageBody}>

            {/* Carousel hero */}
            {selectedYacht.images?.length > 0 && (
              <div className={s.viewCarouselWrap}>
                <Carousel images={selectedYacht.images} />
              </div>
            )}

            {/* Info cards */}
            <div className={s.viewCardGrid}>

              {/* Overview */}
              <div className={s.viewCard}>
                <div className={s.viewCardHead}>
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.5"/><path d="M2.5 14c0-3.038 2.462-5.5 5.5-5.5s5.5 2.462 5.5 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                  Overview
                </div>
                <div className={s.viewRows}>
                  <div className={s.viewRow}><span className={s.viewRowLabel}>Capacity</span><span className={s.viewRowValue}>{selectedYacht.capacity} guests</span></div>
                  <div className={s.viewRow}><span className={s.viewRowLabel}>Boarding</span><span className={s.viewRowValue}>{selectedYacht.boardingLocation || "—"}</span></div>
                </div>
              </div>

              {/* Schedule */}
              <div className={s.viewCard}>
                <div className={s.viewCardHead}>
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.5"/><path d="M8 5v3l2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                  Schedule
                </div>
                <div className={s.viewRows}>
                  <div className={s.viewRow}><span className={s.viewRowLabel}>Sail Time</span><span className={s.viewRowValue}>{to12Hour(selectedYacht.sailStartTime)} – {to12Hour(selectedYacht.sailEndTime)}</span></div>
                  <div className={s.viewRow}><span className={s.viewRowLabel}>Duration</span><span className={s.viewRowValue}>{calculateDuration(selectedYacht.sailStartTime, selectedYacht.sailEndTime)}</span></div>
                </div>
              </div>

              {/* Pricing */}
              <div className={`${s.viewCard} ${s.viewCardWide}`}>
                <div className={s.viewCardHead}>
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="1.5" y="3.5" width="13" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><path d="M1.5 6.5h13" stroke="currentColor" strokeWidth="1.5"/><path d="M5 10h2m3 0h1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                  Pricing
                </div>
                <div className={s.viewRows}>
                  <div className={s.viewRow}>
                    <span className={s.viewRowLabel}>Sailing Cost</span>
                    <span className={s.viewRowValue}>₹{Number(selectedYacht.sailingCost || 0).toLocaleString()}/hr{selectedYacht.defaultSailingHours ? <span className={s.viewRowMuted}> × {selectedYacht.defaultSailingHours} hr</span> : ""}</span>
                  </div>
                  <div className={s.viewRow}>
                    <span className={s.viewRowLabel}>Anchoring Cost</span>
                    <span className={s.viewRowValue}>₹{Number(selectedYacht.anchorageCost || 0).toLocaleString()}/hr{selectedYacht.defaultAnchoringHours ? <span className={s.viewRowMuted}> × {selectedYacht.defaultAnchoringHours} hr</span> : ""}</span>
                  </div>
                  <div className={s.viewRow}><span className={s.viewRowLabel}>Running Cost</span><span className={s.viewRowValue}>₹{Number(selectedYacht.runningCost || 0).toLocaleString()}</span></div>
                  <div className={`${s.viewRow} ${s.viewRowHighlight}`}><span className={s.viewRowLabel}>Selling Price</span><span className={s.viewRowValue}>₹{Number(selectedYacht.sellingPrice || 0).toLocaleString()}</span></div>
                  <div className={s.viewRow}><span className={s.viewRowLabel}>Max Selling</span><span className={s.viewRowValue}>₹{Number(selectedYacht.maxSellingPrice || 0).toLocaleString()}</span></div>
                </div>
              </div>

              {/* Special Slots */}
              <div className={s.viewCard}>
                <div className={s.viewCardHead}>
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="1.5" y="2.5" width="13" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><path d="M5 1v3m6-3v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M1.5 7.5h13" stroke="currentColor" strokeWidth="1.5"/></svg>
                  Special Slots
                </div>
                <div className={s.viewRows}>
                  {selectedYacht.specialSlotTimes?.length > 0 ? (
                    selectedYacht.specialSlotTimes.map((slot, i) => (
                      <div className={s.viewRow} key={i}>
                        <span className={s.viewRowLabel}>Slot {i + 1}</span>
                        <span className={s.viewRowValue}>{to12Hour(slot)} – {addTwoHoursTo12Hour(to12Hour(slot))}</span>
                      </div>
                    ))
                  ) : (
                    <span className={s.viewEmpty}>No special slots configured</span>
                  )}
                </div>
              </div>

            </div>
          </div>

          {/* Footer */}
          <div className={s.editPageFooter}>
            <button
              className={s.btnSave}
              onClick={() => { setShowViewModal(false); setShowEditModal(true); }}
            >
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M2 11.5V14h2.5L11.5 7 9 4.5 2 11.5ZM13.7 4.8c.3-.3.3-.8 0-1.1l-1.4-1.4c-.3-.3-.8-.3-1.1 0L10 3.5 12.5 6l1.2-1.2Z" fill="currentColor"/></svg>
              Edit Yacht
            </button>
          </div>
        </div>
      )}

      {/* ── EDIT PAGE ── */}
      {showEditModal && selectedYacht && (
        <div className={s.editPage}>
          <div className={s.editPageHeader}>
            <button className="btn-back-icon" onClick={closeAllModals} aria-label="Go back">
              <svg viewBox="0 0 20 20" fill="none"><path d="M12.5 5L7.5 10L12.5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
            <h2 className={s.editPageTitle}>Edit Yacht</h2>
            <div style={{ width: 38 }} />
          </div>
          <div className={s.editPageBody}>

                {/* ── Basic Information ── */}
                <div className={s.formSectionTitle}>Basic Information</div>
                <div className={s.formGrid}>
                  <div className={s.field}>
                    <label className={s.label}>Yacht Name <span className={s.required}>*</span></label>
                    <input className={s.input} value={selectedYacht.name || ""} onChange={(e) => setSelectedYacht((p) => ({ ...p, name: e.target.value }))} />
                  </div>
                  <div className={s.field}>
                    <label className={s.label}>Capacity <span className={s.required}>*</span></label>
                    <input className={s.input} type="number" value={selectedYacht.capacity || ""} onChange={(e) => setSelectedYacht((p) => ({ ...p, capacity: Number(e.target.value) }))} />
                  </div>
                  <div className={s.field}>
                    <label className={s.label}>Status</label>
                    <select className={s.select} value={selectedYacht.status || "active"} onChange={(e) => setSelectedYacht((p) => ({ ...p, status: e.target.value }))}>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                  <div className={`${s.field} ${s.colSpan3}`}>
                    <label className={s.label}>Boarding Location</label>
                    <input className={s.input} type="text" placeholder="e.g. West Goa Marina" value={selectedYacht.boardingLocation || ""} onChange={(e) => setSelectedYacht((p) => ({ ...p, boardingLocation: e.target.value }))} />
                  </div>
                </div>

                {/* ── Schedule & Slots ── */}
                <div className={s.formSectionTitle} style={{ marginTop: "1.25rem" }}>Schedule & Slots</div>
                <div className={s.formGrid}>
                  <div className={s.field}>
                    <label className={s.label}>Start Time</label>
                    <input className={s.input} type="time" value={selectedYacht.sailStartTime || ""} onChange={(e) => setSelectedYacht((p) => ({ ...p, sailStartTime: e.target.value }))} />
                  </div>
                  <div className={s.field}>
                    <label className={s.label}>End Time</label>
                    <input className={s.input} type="time" value={selectedYacht.sailEndTime || ""} min={selectedYacht.sailStartTime} onChange={(e) => {
                      if (e.target.value < selectedYacht.sailStartTime) { toast.error("End time cannot be before start time"); return; }
                      setSelectedYacht((p) => ({ ...p, sailEndTime: e.target.value }));
                    }} />
                  </div>
                  <div className={s.field}>
                    <label className={s.label}>Slot Duration (mins)</label>
                    <input className={s.input} type="number" value={toMinutes(selectedYacht.duration)}
                      onChange={(e) => {
                        const newMins = Number(e.target.value);
                        const newHrs = newMins / 60;
                        setSelectedYacht((p) => {
                          const prevSail = parseFloat(p.defaultSailingHours);
                          const prevAnch = parseFloat(p.defaultAnchoringHours);
                          const prevTotal = (isNaN(prevSail) ? 0 : prevSail) + (isNaN(prevAnch) ? 0 : prevAnch);
                          // Re-apply the same ratio to the new duration
                          if (newHrs > 0 && prevTotal > 0) {
                            const sailRatio = (isNaN(prevSail) ? 0 : prevSail) / prevTotal;
                            const newSail = parseFloat((newHrs * sailRatio).toFixed(2));
                            const newAnch = parseFloat((newHrs - newSail).toFixed(2));
                            const fmt = (v) => v % 1 === 0 ? String(v) : String(v);
                            return { ...p, duration: newMins, defaultSailingHours: fmt(newSail), defaultAnchoringHours: fmt(newAnch) };
                          }
                          return { ...p, duration: newMins };
                        });
                      }} />
                  </div>
                  <div className={s.field}>
                    <label className={s.label}>Special Slot 1</label>
                    <select className={s.select} value={selectedYacht.specialSlot1 || "none"} onChange={(e) => {
                      const val = e.target.value;
                      setSelectedYacht((p) => ({ ...p, specialSlot1: val === "none" ? null : val, specialSlot2: null }));
                    }}>
                      <option value="none">None</option>
                      {SLOT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  <div className={s.field}>
                    <label className={s.label}>Special Slot 2</label>
                    <select className={s.select} value={selectedYacht.specialSlot2 || "none"} disabled={!selectedYacht.specialSlot1 || selectedYacht.specialSlot1 === "none"} onChange={(e) => {
                      const val = e.target.value;
                      setSelectedYacht((p) => ({ ...p, specialSlot2: val === "none" ? null : val }));
                    }}>
                      <option value="none">None</option>
                      {SLOT_OPTIONS.map((o) => <option key={o.value} value={o.value} disabled={selectedYacht.specialSlot1 === o.value}>{o.label}</option>)}
                    </select>
                  </div>
                </div>

                {/* ── Pricing ── */}
                <div className={s.formSectionTitle} style={{ marginTop: "1.25rem" }}>Pricing</div>
                <div className={s.formGrid}>
                  <div className={s.field}>
                    <label className={s.label}>Sailing Cost / hr</label>
                    <input className={s.input} type="number" value={selectedYacht.sailingCost || ""} onChange={(e) => setSelectedYacht((p) => ({ ...p, sailingCost: e.target.value }))} />
                  </div>
                  <div className={s.field}>
                    <label className={s.label}>Anchorage Cost / hr</label>
                    <input className={s.input} type="number" value={selectedYacht.anchorageCost || ""} onChange={(e) => setSelectedYacht((p) => ({ ...p, anchorageCost: e.target.value }))} />
                  </div>
                  {/* Running Cost — live */}
                  {(() => {
                    const sHrs = Number(selectedYacht.defaultSailingHours || 0);
                    const aHrs = Number(selectedYacht.defaultAnchoringHours || 0);
                    const rc = (Number(selectedYacht.sailingCost || 0) * sHrs) + (Number(selectedYacht.anchorageCost || 0) * aHrs);
                    if (!rc) return null;
                    return (
                      <div className={s.field}>
                        <label className={s.label}>Running Cost</label>
                        <div className={s.costDisplay}><span>₹</span>{rc.toLocaleString()}</div>
                      </div>
                    );
                  })()}
                  <div className={s.field}>
                    <label className={s.label}>
                      Default Sailing Hrs
                      <span style={{ fontSize: 11, fontWeight: 400, color: "#64748b", marginLeft: 6 }}>per slot</span>
                    </label>
                    <input className={s.input} type="number" step="0.5" min="0" placeholder="e.g. 1"
                      value={selectedYacht.defaultSailingHours ?? ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        const slotHrs = Number(toMinutes(selectedYacht.duration) || 0) / 60;
                        const clamped = slotHrs > 0 ? Math.min(parseFloat(val), slotHrs) : parseFloat(val);
                        const sail = isNaN(clamped) ? "" : (clamped % 1 === 0 ? String(clamped) : clamped.toFixed(1));
                        const remaining = slotHrs > 0 && sail !== "" ? Math.max(0, slotHrs - parseFloat(sail)) : null;
                        const anch = remaining !== null ? (remaining % 1 === 0 ? String(remaining) : remaining.toFixed(1)) : undefined;
                        setSelectedYacht((p) => ({ ...p, defaultSailingHours: sail, ...(anch !== undefined && { defaultAnchoringHours: anch }) }));
                      }} />
                  </div>
                  <div className={s.field}>
                    <label className={s.label}>
                      Default Anchoring Hrs
                      <span style={{ fontSize: 11, fontWeight: 400, color: "#64748b", marginLeft: 6 }}>per slot</span>
                    </label>
                    <input className={s.input} type="number" step="0.5" min="0" placeholder="e.g. 1"
                      value={selectedYacht.defaultAnchoringHours ?? ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        const slotHrs = Number(toMinutes(selectedYacht.duration) || 0) / 60;
                        const clamped = slotHrs > 0 ? Math.min(parseFloat(val), slotHrs) : parseFloat(val);
                        const anch = isNaN(clamped) ? "" : (clamped % 1 === 0 ? String(clamped) : clamped.toFixed(1));
                        const remaining = slotHrs > 0 && anch !== "" ? Math.max(0, slotHrs - parseFloat(anch)) : null;
                        const sail = remaining !== null ? (remaining % 1 === 0 ? String(remaining) : remaining.toFixed(1)) : undefined;
                        setSelectedYacht((p) => ({ ...p, defaultAnchoringHours: anch, ...(sail !== undefined && { defaultSailingHours: sail }) }));
                      }} />
                  </div>
                  {/* Ratio preview */}
                  {(() => {
                    const sv = parseFloat(selectedYacht.defaultSailingHours);
                    const av = parseFloat(selectedYacht.defaultAnchoringHours);
                    if (!sv && !av) return null;
                    const total = (sv || 0) + (av || 0);
                    const sPct = total > 0 ? Math.round((sv || 0) / total * 100) : 0;
                    const aPct = 100 - sPct;
                    const slotDurHrs = Number(toMinutes(selectedYacht.duration) || 0) / 60;
                    const isOver = slotDurHrs > 0 && total > slotDurHrs + 0.001;
                    const matchesSlot = slotDurHrs > 0 && Math.abs(total - slotDurHrs) <= 0.001;
                    return (
                      <div className={s.colSpan3} style={{ fontSize: 12, color: isOver ? "#dc2626" : "#0f172a", background: isOver ? "#fef2f2" : "#f0fdf4", border: `1px solid ${isOver ? "#fca5a5" : "#86efac"}`, borderRadius: 8, padding: "8px 12px", display: "flex", gap: 16, flexWrap: "wrap" }}>
                        <span>⛵ Sailing: <b>{sv || 0} hr{sv !== 1 ? "s" : ""}</b> ({sPct}%)</span>
                        <span>⚓ Anchoring: <b>{av || 0} hr{av !== 1 ? "s" : ""}</b> ({aPct}%)</span>
                        {isOver
                          ? <span style={{ fontWeight: 700 }}>⛔ Total {total} hrs exceeds {slotDurHrs} hr slot</span>
                          : matchesSlot
                            ? <span style={{ color: "#15803d" }}>✓ Matches slot duration exactly</span>
                            : <span style={{ color: "#64748b" }}>→ ratio applied proportionally to any slot length</span>
                        }
                      </div>
                    );
                  })()}
                  {editFieldErrors.defaultHours && (
                    <div className={s.colSpan3} style={{ fontSize: 12, fontWeight: 700, color: "#dc2626", background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, padding: "7px 12px" }}>
                      ⛔ {editFieldErrors.defaultHours}
                    </div>
                  )}
                  <div className={s.field}>
                    <label className={s.label}>Selling Price <span className={s.required}>*</span></label>
                    <input className={`${s.input}${editFieldErrors.sellingPrice ? " " + s.error : ""}`} type="number" value={selectedYacht.sellingPrice || ""} onChange={(e) => setSelectedYacht((p) => ({ ...p, sellingPrice: e.target.value }))} />
                    {editFieldErrors.sellingPrice && <span className={s.fieldError}>{editFieldErrors.sellingPrice}</span>}
                  </div>
                  <div className={s.field}>
                    <label className={s.label}>Max Selling Price <span className={s.required}>*</span></label>
                    <input className={`${s.input}${editFieldErrors.maxSellingPrice ? " " + s.error : ""}`} type="number" value={selectedYacht.maxSellingPrice || ""} onChange={(e) => setSelectedYacht((p) => ({ ...p, maxSellingPrice: e.target.value }))} />
                    {editFieldErrors.maxSellingPrice && <span className={s.fieldError}>{editFieldErrors.maxSellingPrice}</span>}
                  </div>
                </div>

                {/* ── Photos ── */}
                <div className={s.formSectionTitle} style={{ marginTop: "1.25rem" }}>
                  Yacht Images
                  <span className={s.inputHint} style={{ marginLeft: 8 }}>(optional · max 1 MB each)</span>
                </div>
                <div className={s.previewGrid}>
                  {imagePreviews.map((img, idx) => (
                    <div className={s.previewBox} key={idx}>
                      <img src={img} alt="preview" />
                      <button className={s.previewRemove} onClick={() =>
                        selectedYacht.yachtPhotos?.includes(img) ? removeExistingImage(img) : removeNewImage(idx)
                      }>✕</button>
                    </div>
                  ))}
                </div>
                <input type="file" className={s.fileInput} style={{ marginTop: "0.75rem" }} multiple accept="image/*" onChange={handleNewImages} />

          </div>
          <div className={s.editPageFooter}>
            <button
              className={s.btnSave}
              onClick={handleEditSave}
              disabled={Object.keys(editFieldErrors).length > 0 || !!editFieldErrors.defaultHours}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M13.5 4.5L6.5 11.5L2.5 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Save Changes
            </button>
          </div>
        </div>
      )}

      {/* ── DELETE MODAL ── */}
      {showDeleteModal && selectedYacht && (
        <>
          <div className={s.backdrop} onClick={closeAllModals} />
          <div className={s.modal}>
            <div className={`${s.modalDialog} ${s.sm}`}>
              <div className={s.deleteBody}>
                <div className={s.deleteIcon}>🛥️</div>
                <h3 className={s.deleteTitle}>Delete Yacht?</h3>
                <p className={s.deleteSubtitle}>Are you sure you want to delete <strong>{selectedYacht.name}</strong>? This cannot be undone.</p>
              </div>
              <div className={s.modalFooter}>
                <button className={s.btnSecondary} onClick={closeAllModals}>Cancel</button>
                <button className={s.btnDanger} onClick={handleDelete}>Delete</button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AllYachts;