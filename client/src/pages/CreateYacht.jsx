import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createYacht as createYachtAPI } from "../services/operations/yautAPI";
import { toast } from "react-hot-toast";
import s from "../styles/yachtAdmin.module.css";

const SLOT_OPTIONS = [
  { value: "15:30", label: "3:30 PM – 5:30 PM" },
  { value: "16:00", label: "4:00 PM – 6:00 PM" },
  { value: "17:30", label: "5:30 PM – 7:30 PM" },
  { value: "18:00", label: "6:00 PM – 8:00 PM" },
];

function convertMinutesToHHMM(mins) {
  const h = String(Math.floor(mins / 60)).padStart(2, "0");
  const m = String(mins % 60).padStart(2, "0");
  return `${h}:${m}`;
}

function convertTo24Hour(timeStr) {
  if (!timeStr || timeStr === "none") return "";
  if (/^\d{2}:\d{2}$/.test(timeStr)) return timeStr;
  const parts = timeStr.split(" ");
  if (parts.length !== 2) return "";
  const [time, modifier] = parts;
  let [hours, minutes] = time.split(":").map(Number);
  if (modifier === "PM" && hours < 12) hours += 12;
  if (modifier === "AM" && hours === 12) hours = 0;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function CreateYacht() {
  const navigate = useNavigate();

  const [yacht, setYacht] = useState({
    name: "",
    capacity: "",
    sailingCost: "",
    anchorageCost: "",
    maxSellingPrice: "",
    sellingPrice: "",
    sailStartTime: "06:00",
    sailEndTime: "20:00",
    duration: "120",
    customDuration: "",
    specialSlot1: null,
    specialSlot2: null,
    boardingLocation: "",
    photos: [],
    status: "active",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [photoError, setPhotoError] = useState("");
  const [photoPreviews, setPhotoPreviews] = useState([]);

  // Price validation
  useEffect(() => {
    const errors = {};
    const running = Number(yacht.sailingCost || 0) + Number(yacht.anchorageCost || 0);
    const maxSell = Number(yacht.maxSellingPrice || 0);
    const sell = Number(yacht.sellingPrice || 0);
    if (running && maxSell && maxSell <= running) errors.maxSellingPrice = "Max selling price must be > running cost";
    if (running && sell && sell < running) errors.sellingPrice = "Selling price must be ≥ running cost";
    if (maxSell && sell && sell > maxSell) errors.sellingPrice = "Selling price must be ≤ max selling price";
    setFieldErrors(errors);
  }, [yacht.sailingCost, yacht.anchorageCost, yacht.maxSellingPrice, yacht.sellingPrice]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setYacht((prev) => ({ ...prev, [name]: value }));
  };

  const handlePhotoUpload = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) { setYacht((p) => ({ ...p, photos: [] })); setPhotoPreviews([]); setPhotoError(""); return; }
    for (const file of files) {
      if (file.size > 1 * 1024 * 1024) { setPhotoError("Each photo must be under 1 MB."); return; }
    }
    setPhotoError("");
    setYacht((prev) => ({ ...prev, photos: files }));
    setPhotoPreviews(files.map((f) => URL.createObjectURL(f)));
  };

  const handleRemovePhoto = (index) => {
    setYacht((prev) => { const p = [...prev.photos]; p.splice(index, 1); return { ...prev, photos: p }; });
    setPhotoPreviews((prev) => { const p = [...prev]; p.splice(index, 1); return p; });
  };

  const validateDuration = () => {
    if (yacht.duration !== "custom") return { value: convertMinutesToHHMM(Number(yacht.duration)) };
    if (!yacht.customDuration) return { error: "Please enter a custom duration." };
    if (isNaN(Number(yacht.customDuration))) return { error: "Custom duration must be numeric." };
    return { value: convertMinutesToHHMM(Number(yacht.customDuration)) };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (Object.keys(fieldErrors).length > 0) { setError("Fix all validation errors first."); return; }
    if (photoError) { setError("Please fix the photo upload error first."); return; }
    const { value: durationHHMM, error: durationError } = validateDuration();
    if (durationError) { setError(durationError); return; }

    try {
      setLoading(true);
      const token = localStorage.getItem("authToken");
      const s1 = convertTo24Hour(yacht.specialSlot1);
      const s2 = convertTo24Hour(yacht.specialSlot2);
      const specialSlotArr = [s1, s2].filter((v, i, a) => v && a.indexOf(v) === i);

      const formData = new FormData();
      formData.append("name", yacht.name);
      formData.append("capacity", yacht.capacity);
      formData.append("sailingCost", yacht.sailingCost);
      formData.append("anchorageCost", yacht.anchorageCost);
      formData.append("runningCost", Number(yacht.sailingCost) + Number(yacht.anchorageCost));
      formData.append("maxSellingPrice", yacht.maxSellingPrice);
      formData.append("sellingPrice", yacht.sellingPrice);
      formData.append("sailStartTime", yacht.sailStartTime);
      formData.append("sailEndTime", yacht.sailEndTime);
      formData.append("duration", durationHHMM);
      formData.append("status", yacht.status);
      formData.append("specialSlotTimes", JSON.stringify(specialSlotArr));
      if (yacht.boardingLocation?.trim()) formData.append("boardingLocation", yacht.boardingLocation.trim());
      for (const file of (yacht.photos || [])) formData.append("yachtPhotos", file);

      await createYachtAPI(formData, token);
      toast.success("Yacht created successfully!", { duration: 3000 });
      navigate("/all-yachts");
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Failed to create yacht");
    } finally {
      setLoading(false);
    }
  };

  const runningCost = Number(yacht.sailingCost || 0) + Number(yacht.anchorageCost || 0);

  return (
    <div className={`${s.root} ${s.page}`}>
      {loading && (
        <div className={s.loadingOverlay}>
          <div className={s.spinner} />
        </div>
      )}

      <div className={s.pageHeader}>
        <h1 className={s.pageTitle}>Create <span>Yacht</span></h1>
        <button className={s.btnSecondary} onClick={() => navigate(-1)}>← Back</button>
      </div>

      {error && <div className={s.errorBanner}>{error}</div>}

      <div className={s.formCard}>
        <form onSubmit={handleSubmit}>

          {/* ── Basic Info ── */}
          <div className={s.formSection}>
            <div className={s.formSectionTitle}>Basic Information</div>
            <div className={s.formGrid}>
              <div className={s.field}>
                <label className={s.label}>Yacht Name <span className={s.required}>*</span></label>
                <input className={s.input} type="text" name="name" placeholder="e.g. Sea Breeze" value={yacht.name} onChange={handleChange} required />
              </div>
              <div className={s.field}>
                <label className={s.label}>Capacity <span className={s.required}>*</span></label>
                <input className={s.input} type="number" name="capacity" placeholder="Max guests" value={yacht.capacity} onChange={handleChange} required />
              </div>
              <div className={s.field}>
                <label className={s.label}>Status <span className={s.required}>*</span></label>
                <select className={s.select} name="status" value={yacht.status} onChange={handleChange}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div className={`${s.field} ${s.colSpan3}`}>
                <label className={s.label}>Boarding Location</label>
                <input className={s.input} type="text" name="boardingLocation" placeholder="e.g. West Goa Marina" value={yacht.boardingLocation} onChange={handleChange} />
              </div>
            </div>
          </div>

          {/* ── Pricing ── */}
          <div className={s.formSection}>
            <div className={s.formSectionTitle}>Pricing</div>
            <div className={s.formGrid}>
              <div className={s.field}>
                <label className={s.label}>Sailing Cost <span className={s.required}>*</span></label>
                <input className={s.input} type="number" name="sailingCost" placeholder="₹" value={yacht.sailingCost} onChange={handleChange} required />
              </div>
              <div className={s.field}>
                <label className={s.label}>Anchorage Cost <span className={s.required}>*</span></label>
                <input className={s.input} type="number" name="anchorageCost" placeholder="₹" value={yacht.anchorageCost} onChange={handleChange} required />
              </div>
              <div className={s.field}>
                <label className={s.label}>Running Cost</label>
                <div className={s.costDisplay}><span>₹</span>{runningCost ? runningCost.toLocaleString() : "—"}</div>
              </div>
              <div className={s.field}>
                <label className={s.label}>Selling Price <span className={s.required}>*</span></label>
                <input className={`${s.input}${fieldErrors.sellingPrice ? " " + s.error : ""}`} type="number" name="sellingPrice" placeholder="₹" value={yacht.sellingPrice} onChange={handleChange} required />
                {fieldErrors.sellingPrice && <span className={s.fieldError}>{fieldErrors.sellingPrice}</span>}
              </div>
              <div className={s.field}>
                <label className={s.label}>Max Selling Price <span className={s.required}>*</span></label>
                <input className={`${s.input}${fieldErrors.maxSellingPrice ? " " + s.error : ""}`} type="number" name="maxSellingPrice" placeholder="₹" value={yacht.maxSellingPrice} onChange={handleChange} required />
                {fieldErrors.maxSellingPrice && <span className={s.fieldError}>{fieldErrors.maxSellingPrice}</span>}
              </div>
            </div>
          </div>

          {/* ── Schedule ── */}
          <div className={s.formSection}>
            <div className={s.formSectionTitle}>Schedule & Slots</div>
            <div className={s.formGrid}>
              <div className={s.field}>
                <label className={s.label}>Start Time <span className={s.required}>*</span></label>
                <input className={s.input} type="time" name="sailStartTime" value={yacht.sailStartTime} onChange={handleChange} required />
              </div>
              <div className={s.field}>
                <label className={s.label}>End Time <span className={s.required}>*</span></label>
                <input className={s.input} type="time" name="sailEndTime" value={yacht.sailEndTime} min={yacht.sailStartTime} onChange={(e) => {
                  if (e.target.value < yacht.sailStartTime) { toast.error("End time cannot be before start time"); return; }
                  setYacht((p) => ({ ...p, sailEndTime: e.target.value }));
                }} required />
              </div>
              <div className={s.field}>
                <label className={s.label}>Slot Duration <span className={s.required}>*</span></label>
                <select className={s.select} name="duration" value={yacht.duration} onChange={(e) => {
                  setYacht((prev) => ({ ...prev, duration: e.target.value, customDuration: e.target.value === "custom" ? prev.customDuration : "" }));
                }}>
                  <option value="30">30 min</option>
                  <option value="60">60 min</option>
                  <option value="120">120 min</option>
                  <option value="custom">Custom…</option>
                </select>
                {yacht.duration === "custom" && (
                  <input className={s.input} style={{ marginTop: "4px" }} type="number" name="customDuration" placeholder="Enter minutes" value={yacht.customDuration} onChange={handleChange} />
                )}
              </div>
              <div className={s.field}>
                <label className={s.label}>Special Slot 1</label>
                <select className={s.select} name="specialSlot1" value={yacht.specialSlot1 || "none"} onChange={(e) => {
                  const val = e.target.value;
                  setYacht((p) => ({ ...p, specialSlot1: val === "none" ? null : val, specialSlot2: null }));
                }}>
                  <option value="none">None</option>
                  {SLOT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className={s.field}>
                <label className={s.label}>Special Slot 2</label>
                <select className={s.select} name="specialSlot2" value={yacht.specialSlot2 || "none"} disabled={!yacht.specialSlot1 || yacht.specialSlot1 === "none"} onChange={(e) => {
                  const val = e.target.value;
                  setYacht((p) => ({ ...p, specialSlot2: val === "none" ? null : val }));
                }}>
                  <option value="none">None</option>
                  {SLOT_OPTIONS.map((o) => <option key={o.value} value={o.value} disabled={yacht.specialSlot1 === o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* ── Photos ── */}
          <div className={s.formSection}>
            <div className={s.formSectionTitle}>Photos <span className={s.inputHint}>(optional · max 1 MB each)</span></div>
            <input className={`${s.fileInput}${photoError ? " " + s.error : ""}`} type="file" multiple accept="image/*" onChange={handlePhotoUpload} />
            {photoError && <span className={s.fieldError}>{photoError}</span>}
            {photoPreviews.length > 0 && (
              <div className={s.previewGrid} style={{ marginTop: ".6rem" }}>
                {photoPreviews.map((src, index) => (
                  <div key={index} className={s.previewBox}>
                    <img src={src} alt={`preview-${index}`} />
                    <button type="button" className={s.previewRemove} onClick={() => handleRemovePhoto(index)}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button type="submit" className={s.submitBtn} disabled={loading}>
            {loading ? <><div className={s.spinner} style={{ width: 16, height: 16, borderWidth: 2 }} /> Creating…</> : "Create Yacht"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default CreateYacht;