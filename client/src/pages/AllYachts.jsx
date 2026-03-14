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
    const running = Number(selectedYacht.sailingCost || 0) + Number(selectedYacht.anchorageCost || 0);
    const maxSell = Number(selectedYacht.maxSellingPrice || 0);
    const sell = Number(selectedYacht.sellingPrice || 0);
    if (running && maxSell && maxSell <= running) errors.maxSellingPrice = "Max selling price must be > running cost";
    if (running && sell && sell < running) errors.sellingPrice = "Selling price must be ≥ running cost";
    if (maxSell && sell && sell > maxSell) errors.sellingPrice = "Selling price must be ≤ max selling price";
    setEditFieldErrors(errors);
  }, [selectedYacht?.sailingCost, selectedYacht?.anchorageCost, selectedYacht?.maxSellingPrice, selectedYacht?.sellingPrice]);

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
      formData.append("runningCost", Number(selectedYacht.sailingCost) + Number(selectedYacht.anchorageCost));
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

  const sortedYachts = [...yachts].sort((a, b) => {
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

      {/* header */}
      <div className={s.pageHeader}>
        <h1 className={s.pageTitle}>Yacht <span>Master</span></h1>
        <button className={s.btnPrimary} onClick={() => navigate("/create-yacht")}>+ Create Yacht</button>
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

      {/* ── VIEW MODAL ── */}
      {showViewModal && selectedYacht && (
        <>
          <div className={s.backdrop} onClick={closeAllModals} />
          <div className={s.modal}>
            <div className={s.modalDialog}>
              <div className={s.modalHeader}>
                <h2 className={s.modalTitle}>{selectedYacht.name}</h2>
                <button className={s.modalClose} onClick={closeAllModals}>✕</button>
              </div>
              <div className={s.modalBody}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
                  <div>
                    <div className={s.detailGrid}>
                      {[
                        ["Capacity", selectedYacht.capacity + " guests"],
                        ["Sail Time", `${to12Hour(selectedYacht.sailStartTime)} – ${to12Hour(selectedYacht.sailEndTime)}`],
                        ["Duration", calculateDuration(selectedYacht.sailStartTime, selectedYacht.sailEndTime)],
                        ["Running Cost", `₹${selectedYacht.runningCost?.toLocaleString()}`],
                        ["Selling Price", `₹${selectedYacht.sellingPrice?.toLocaleString()}`],
                        ["Max Selling", `₹${selectedYacht.maxSellingPrice?.toLocaleString()}`],
                        ["Status", selectedYacht.status],
                        ["Boarding", selectedYacht.boardingLocation || "—"],
                      ].map(([label, value]) => (
                        <div className={s.detailItem} key={label}>
                          <span className={s.detailLabel}>{label}</span>
                          <span className={s.detailValue}>{value}</span>
                        </div>
                      ))}
                      <div className={s.detailDivider} />
                      <div className={s.detailItem} style={{ gridColumn: "1/-1" }}>
                        <span className={s.detailLabel}>Special Slots</span>
                        {selectedYacht.specialSlotTimes?.length > 0 ? (
                          selectedYacht.specialSlotTimes.map((slot, i) => (
                            <span key={i} className={s.detailValue}>
                              {to12Hour(slot)} – {addTwoHoursTo12Hour(to12Hour(slot))}
                            </span>
                          ))
                        ) : (
                          <span className={s.detailValue} style={{ color: "var(--muted)", fontStyle: "italic" }}>None</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div>
                    <Carousel images={selectedYacht.images} />
                  </div>
                </div>
              </div>
              <div className={s.modalFooter}>
                <button className={s.btnSecondary} onClick={closeAllModals}>Close</button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── EDIT MODAL ── */}
      {showEditModal && selectedYacht && (
        <>
          <div className={s.backdrop} onClick={closeAllModals} />
          <div className={s.modal}>
            <div className={`${s.modalDialog} ${s.lg}`}>
              <div className={s.modalHeader}>
                <h2 className={s.modalTitle}>Edit Yacht</h2>
                <button className={s.modalClose} onClick={closeAllModals}>✕</button>
              </div>
              <div className={s.modalBody}>
                <div className={s.formGrid}>
                  {/* Name */}
                  <div className={s.field}>
                    <label className={s.label}>Yacht Name <span className={s.required}>*</span></label>
                    <input className={s.input} value={selectedYacht.name || ""} onChange={(e) => setSelectedYacht((p) => ({ ...p, name: e.target.value }))} />
                  </div>
                  {/* Capacity */}
                  <div className={s.field}>
                    <label className={s.label}>Capacity <span className={s.required}>*</span></label>
                    <input className={s.input} type="number" value={selectedYacht.capacity || ""} onChange={(e) => setSelectedYacht((p) => ({ ...p, capacity: Number(e.target.value) }))} />
                  </div>
                  {/* Sailing Cost */}
                  <div className={s.field}>
                    <label className={s.label}>Sailing Cost</label>
                    <input className={s.input} type="number" value={selectedYacht.sailingCost || ""} onChange={(e) => setSelectedYacht((p) => ({ ...p, sailingCost: e.target.value }))} />
                  </div>
                  {/* Anchorage Cost */}
                  <div className={s.field}>
                    <label className={s.label}>Anchorage Cost</label>
                    <input className={s.input} type="number" value={selectedYacht.anchorageCost || ""} onChange={(e) => setSelectedYacht((p) => ({ ...p, anchorageCost: e.target.value }))} />
                  </div>
                  {/* Selling Price */}
                  <div className={s.field}>
                    <label className={s.label}>Selling Price <span className={s.required}>*</span></label>
                    <input className={`${s.input}${editFieldErrors.sellingPrice ? " " + s.error : ""}`} type="number" value={selectedYacht.sellingPrice || ""} onChange={(e) => setSelectedYacht((p) => ({ ...p, sellingPrice: e.target.value }))} />
                    {editFieldErrors.sellingPrice && <span className={s.fieldError}>{editFieldErrors.sellingPrice}</span>}
                  </div>
                  {/* Max Selling Price */}
                  <div className={s.field}>
                    <label className={s.label}>Max Selling Price <span className={s.required}>*</span></label>
                    <input className={`${s.input}${editFieldErrors.maxSellingPrice ? " " + s.error : ""}`} type="number" value={selectedYacht.maxSellingPrice || ""} onChange={(e) => setSelectedYacht((p) => ({ ...p, maxSellingPrice: e.target.value }))} />
                    {editFieldErrors.maxSellingPrice && <span className={s.fieldError}>{editFieldErrors.maxSellingPrice}</span>}
                  </div>
                  {/* Sail Start */}
                  <div className={s.field}>
                    <label className={s.label}>Sail Start</label>
                    <input className={s.input} type="time" value={selectedYacht.sailStartTime || ""} onChange={(e) => setSelectedYacht((p) => ({ ...p, sailStartTime: e.target.value }))} />
                  </div>
                  {/* Sail End */}
                  <div className={s.field}>
                    <label className={s.label}>Sail End</label>
                    <input className={s.input} type="time" value={selectedYacht.sailEndTime || ""} min={selectedYacht.sailStartTime} onChange={(e) => {
                      if (e.target.value < selectedYacht.sailStartTime) { toast.error("End time cannot be before start time"); return; }
                      setSelectedYacht((p) => ({ ...p, sailEndTime: e.target.value }));
                    }} />
                  </div>
                  {/* Duration */}
                  <div className={s.field}>
                    <label className={s.label}>Duration (minutes)</label>
                    <input className={s.input} type="number" value={toMinutes(selectedYacht.duration)} onChange={(e) => setSelectedYacht((p) => ({ ...p, duration: Number(e.target.value) }))} />
                  </div>
                  {/* Status */}
                  <div className={s.field}>
                    <label className={s.label}>Status</label>
                    <select className={s.select} value={selectedYacht.status || "active"} onChange={(e) => setSelectedYacht((p) => ({ ...p, status: e.target.value }))}>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                  {/* Special Slot 1 */}
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
                  {/* Special Slot 2 */}
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
                  {/* Boarding Location */}
                  <div className={`${s.field} ${s.colSpan2}`}>
                    <label className={s.label}>Boarding Location</label>
                    <input className={s.input} type="text" placeholder="e.g. West Goa" value={selectedYacht.boardingLocation || ""} onChange={(e) => setSelectedYacht((p) => ({ ...p, boardingLocation: e.target.value }))} />
                  </div>
                </div>

                {/* Image management */}
                <div style={{ marginTop: "1.5rem" }}>
                  <div className={s.formSectionTitle}>Yacht Images</div>
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
              </div>
              <div className={s.modalFooter}>
                <button className={s.btnSecondary} onClick={closeAllModals}>Cancel</button>
                <button className={s.btnPrimary} onClick={handleEditSave} disabled={Object.keys(editFieldErrors).length > 0}>Save Changes</button>
              </div>
            </div>
          </div>
        </>
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