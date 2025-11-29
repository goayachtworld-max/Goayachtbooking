import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createCustomerAPI } from "../services/operations/customerAPI"; // import the API call
import { toast } from "react-hot-toast";

function CustomerForm() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: "",
    contact: "",
    alternateContact: "",
    email: "",
    govtIdType: "Aadhar",
    govtIdNo: "",
    govtIdImage: null,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) => {
    const { name, value, files } = e.target;
    if (name === "govtIdImage") {
      setFormData({ ...formData, govtIdImage: files[0] });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleBack = () => {
    navigate(-1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const token = localStorage.getItem("authToken");

      // Prepare FormData for file upload
      const payload = new FormData();
      for (let key in formData) {
        if (formData[key] !== null) {
          payload.append(key, formData[key]);
        }
      }

      const res = await createCustomerAPI(payload, token);
      // console.log(" Customer created:", res.data);
      // alert(" Customer profile created successfully!");
      toast.success("Customer profile created successfully!");
      // Reset form
      setFormData({
        name: "",
        contact: "",
        alternateContact: "",
        email: "",
        govtIdType: "Aadhar",
        govtIdNo: "",
        govtIdImage: null,
      });
    } catch (err) {
      console.error("❌ Error creating customer:", err);
      setError(err.response?.data?.message || "Failed to create customer profile");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container my-4">
      {/* Header with Back Button */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h4>Create Customer Profile</h4>
        <button className="btn btn-secondary" onClick={handleBack}>
          &larr; Back
        </button>
      </div>

      {error && <p className="text-danger">{error}</p>}

      <form className="row g-3" onSubmit={handleSubmit}>
        {/* Full Name */}
        <div className="col-12 col-md-6">
          <label className="form-label fw-bold">Full Name</label>
          <input
            type="text"
            className="form-control form-control-lg border border-dark text-dark"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="Enter full name"
            required
          />
        </div>

        {/* Contact Number */}
        <div className="col-12 col-md-6">
          <label className="form-label fw-bold">Contact Number</label>
          <input
            type="tel"
            className="form-control form-control-lg border border-dark text-dark"
            name="contact"
            value={formData.contact}
            onChange={handleChange}
            placeholder="Enter contact number"
            required
          />
        </div>

        {/* Alternate Contact */}
        <div className="col-12 col-md-6">
          <label className="form-label fw-bold">Alternate Contact Number</label>
          <input
            type="tel"
            className="form-control form-control-lg border border-dark text-dark"
            name="alternateContact"
            value={formData.alternateContact}
            onChange={handleChange}
            placeholder="Enter alternate contact"
          />
        </div>

        {/* Email */}
        <div className="col-12 col-md-6">
          <label className="form-label fw-bold">Email Address</label>
          <input
            type="email"
            className="form-control form-control-lg border border-dark text-dark"
            name="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="Enter email address"
            required
          />
        </div>

        {/* Govt ID Type */}
        <div className="col-12 col-md-6">
          <label className="form-label fw-bold">Govt ID Type</label>
          <select
            className="form-select form-select-lg border border-dark text-dark"
            name="govtIdType"
            value={formData.govtIdType}
            onChange={handleChange}
          >
            <option value="Aadhar">Aadhar</option>
            <option value="PAN">PAN</option>
            <option value="Driving License">Driving License</option>
            <option value="Passport">Passport</option>
          </select>
        </div>

        {/* Govt ID Number */}
        <div className="col-12 col-md-6">
          <label className="form-label fw-bold">Govt ID Number</label>
          <input
            type="text"
            className="form-control form-control-lg border border-dark text-dark"
            name="govtIdNo"
            value={formData.govtIdNo}
            onChange={handleChange}
            placeholder="Enter govt ID number"
            required
          />
        </div>

        {/* Upload ID Image */}
        <div className="col-12">
          <label className="form-label fw-bold">Upload Govt ID Image</label>
          <input
            type="file"
            className="form-control form-control-lg border border-dark"
            name="govtIdImage"
            accept="image/*"
            onChange={handleChange}
            required
          />
        </div>

        {/* Submit Button */}
        <div className="col-12 text-center">
          <button
            type="submit"
            className="btn btn-primary btn-lg w-100 w-md-auto"
            disabled={loading}
          >
            {loading ? "Creating..." : "Create Profile"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default CustomerForm;
