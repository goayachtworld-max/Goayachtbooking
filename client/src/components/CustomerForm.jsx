import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createCustomerAPI } from "../services/operations/customerAPI";
import { toast } from "react-hot-toast";
import { GLOBAL_CSS } from "../styles/customerStyles";

function CustomerForm() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: "", contact: "", alternateContact: "",
    email: "", govtIdType: "None", govtIdNo: "", govtIdImage: null,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  const handleChange = (e) => {
    const { name, value, files } = e.target;
    if (name === "govtIdType" && value === "None") {
      setFormData({ ...formData, govtIdType:"None", govtIdNo:"", govtIdImage:null });
    } else if (name === "govtIdImage") {
      setFormData({ ...formData, govtIdImage: files[0] });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    const phone = /^(?:\+91-?|\+91)?[789]\d{9}$/;
    if (!phone.test(formData.contact)) {
      setError("Please enter a valid Indian mobile number"); return;
    }
    try {
      setLoading(true);
      const token   = localStorage.getItem("authToken");
      const payload = new FormData();
      for (let key in formData) {
        if (formData.govtIdType === "None" && (key === "govtIdNo" || key === "govtIdImage")) continue;
        if (formData[key] !== null) {
          if (key === "alternateContact" && !formData.alternateContact?.trim()) {
            payload.append("alternateContact", formData.contact);
          } else {
            payload.append(key, formData[key]);
          }
        }
      }
      await createCustomerAPI(payload, token);
      toast.success("Customer created!");
      setFormData({ name:"", contact:"", alternateContact:"", email:"", govtIdType:"None", govtIdNo:"", govtIdImage:null });
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create customer");
    } finally {
      setLoading(false);
    }
  };

  const noId = formData.govtIdType === "None";

  return (
    <div className="cm-wrap">
      <style>{GLOBAL_CSS}</style>
      <div className="cm-page" style={{ maxWidth:680 }}>

        {/* Header */}
        <div className="cm-header">
          <div>
            {/* <div className="cm-subtitle">New Entry</div> */}
            <div className="cm-title">Create Customer</div>
          </div>
          <div className="cm-hdr-btns">
            <button className="cm-btn cm-btn-outline" onClick={() => navigate("/customer-management")}>
              📋 Manage
            </button>
            <button className="cm-btn cm-btn-outline" onClick={() => navigate(-1)}>← Back</button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{ background:"#fef2f2", border:"2px solid #fca5a5", color:"#dc2626", fontSize:13, fontWeight:700, padding:"11px 14px", borderRadius:10, marginBottom:16 }}>
            ⚠ {error}
          </div>
        )}

        {/* Form card */}
        <div className="cm-card" style={{ padding:24 }}>

          {/* Section: Basic Info */}
          <div className="cm-section-head">
            <span className="cm-dot" style={{ background:"#3b82f6" }} />
            Basic Information
          </div>
          <div className="cm-grid2">
            <div className="cm-field">
              <label className="cm-lbl">Full Name</label>
              <input className="cm-inp" type="text" name="name" value={formData.name} onChange={handleChange} placeholder="Enter full name" required />
            </div>
            <div className="cm-field">
              <label className="cm-lbl">Contact Number</label>
              <input className="cm-inp" type="tel" name="contact" value={formData.contact} onChange={handleChange} placeholder="+91 00000 00000" required />
            </div>
            <div className="cm-field">
              <label className="cm-lbl">WhatsApp Number <span className="cm-lbl-opt">optional</span></label>
              <input className="cm-inp" type="tel" name="alternateContact" value={formData.alternateContact} onChange={handleChange} placeholder="Same as contact if blank" />
            </div>
            <div className="cm-field">
              <label className="cm-lbl">Email Address <span className="cm-lbl-opt">optional</span></label>
              <input className="cm-inp" type="email" name="email" value={formData.email} onChange={handleChange} placeholder="customer@email.com" />
            </div>
          </div>

          <hr style={{ border:"none", borderTop:"2px solid #f1f5f9", margin:"8px 0 20px" }} />

          {/* Section: Govt ID */}
          <div className="cm-section-head">
            <span className="cm-dot" style={{ background:"#8b5cf6" }} />
            Government ID <span style={{ fontSize:11, fontWeight:500, color:"#94a3b8", marginLeft:4 }}>optional</span>
          </div>
          <div className="cm-grid2">
            <div className="cm-field">
              <label className="cm-lbl">ID Type</label>
              <select className="cm-inp" name="govtIdType" value={formData.govtIdType} onChange={handleChange}>
                <option value="None">None</option>
                <option value="Aadhar">Aadhar</option>
                <option value="PAN">PAN</option>
                <option value="Driving License">Driving License</option>
                <option value="Passport">Passport</option>
              </select>
            </div>
            <div className="cm-field">
              <label className="cm-lbl">ID Number</label>
              <input className="cm-inp" type="text" name="govtIdNo" value={formData.govtIdNo} onChange={handleChange}
                placeholder={noId ? "Select ID type first" : "Enter ID number"} disabled={noId} required={!noId} />
            </div>
            <div className="cm-field" style={{ gridColumn:"span 2" }}>
              <label className="cm-lbl">Upload ID Image</label>
              <input className="cm-inp" type="file" name="govtIdImage" accept="image/*" onChange={handleChange} disabled={noId}
                style={{ padding:"9px 13px", fontSize:13, cursor: noId ? "not-allowed" : "pointer" }} />
            </div>
          </div>

          {/* Submit */}
          <button
            type="button"
            className="cm-btn cm-btn-primary cm-btn-full"
            style={{ marginTop:8, padding:"14px", fontSize:16 }}
            disabled={loading}
            onClick={handleSubmit}
          >
            {loading ? "Creating…" : "✓ Create Customer Profile"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default CustomerForm;