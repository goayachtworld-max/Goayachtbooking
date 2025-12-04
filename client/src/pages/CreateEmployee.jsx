import React, { useState } from "react";
import { createEmployeeAPI } from "../services/operations/authAPI";
import { toast } from "react-hot-toast";

function CreateEmployee() {
  const [formData, setFormData] = useState({
    role: "",
    name: "",
    contact: "",
    email: "",
    username: "",
    password: "",
    confirmPassword: "",
    status: "active",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match!");
      setLoading(false)
      return;
    }

    // Normalize contact number
    let contact = formData.contact.trim();
    if (contact.startsWith("0")) contact = contact.slice(1);


    try {
      const token = localStorage.getItem("authToken");
      const payload = {
        type: formData.role,
        name: formData.name,
        contact,
        email: formData.email,
        username: formData.username,
        password: formData.password,
        status: formData.status, //  Now matches Zod enum
      };

      const res = await createEmployeeAPI(payload, token);
      console.log(" Employee created:", res.data);
      toast.success(" Employee created successfully!", {
  duration: 3000, // disappears after 3 seconds
  style: {
    borderRadius: "10px",
    background: "#333",
    color: "#fff",
  },
});

      // Reset form
      setFormData({
        role: "",
        name: "",
        contact: "",
        email: "",
        username: "",
        password: "",
        confirmPassword: "",
        status: "active",
      });
    } catch (err) {
      console.error("❌ Error creating employee:", err);

      // Extract a readable message from backend or fallback
      let message = "Failed to create employee.";

      if (err.response?.data) {
        if (typeof err.response.data === "string") {
          // If backend returned plain string
          message = err.response.data;
        } else if (err.response.data.message) {
          // If backend returned { message: "..." }
          message = err.response.data.message;
        } else if (Array.isArray(err.response.data.errors)) {
          // If backend returned Zod errors array
          message = err.response.data.errors
            .map((e) => `${e.path || e.field}: ${e.message}`)
            .join(", ");
        }
      }
      setError(message);
    }
    finally {
      setLoading(false);
    }
  };


  return (
    <div className="container my-4 px-3">
      <h4 className="mb-4 text-center">Create Employee</h4>
      <form className="row g-3" onSubmit={handleSubmit}>
        {/* Role */}
        <div className="col-12">
          <label className="form-label fw-bold">Role</label>
          <select
            className="form-select border border-dark text-dark"
            name="role"
            value={formData.role}
            onChange={handleChange}
            required
          >
            <option value="">-- Select Role --</option>
            <option value="backdesk">Backdesk</option>
            <option value="onsite">Onsite</option>
          </select>
        </div>

        {/* Name */}
        <div className="col-12">
          <label className="form-label fw-bold">Full Name</label>
          <input
            type="text"
            className="form-control border border-dark text-dark"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="Enter full name"
            required
          />
        </div>

        {/* Contact */}
        <div className="col-12">
          <label className="form-label fw-bold">Contact Number</label>
          <input
            type="tel"
            className="form-control border border-dark text-dark"
            name="contact"
            value={formData.contact}
            onChange={handleChange}
            placeholder="Enter contact number"
            required
          />
        </div>

        {/* Email */}
        <div className="col-12">
          <label className="form-label fw-bold">Email Address</label>
          <input
            type="email"
            className="form-control border border-dark text-dark"
            name="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="Enter email address"
            required
          />
        </div>

        {/* Username */}
        <div className="col-12 col-md-6">
          <label className="form-label fw-bold">Username</label>
          <input
            type="text"
            className="form-control border border-dark text-dark"
            name="username"
            value={formData.username}
            onChange={handleChange}
            placeholder="Enter username"
            required
          />
        </div>

        {/* Password */}
        <div className="col-12 col-md-6">
          <label className="form-label fw-bold">Password</label>
          <input
            type="password"
            className="form-control border border-dark text-dark"
            name="password"
            value={formData.password}
            onChange={handleChange}
            placeholder="Enter password"
            required
          />
        </div>

        {/* Confirm Password */}
        <div className="col-12 col-md-6">
          <label className="form-label fw-bold">Confirm Password</label>
          <input
            type="password"
            className="form-control border border-dark text-dark"
            name="confirmPassword"
            value={formData.confirmPassword}
            onChange={handleChange}
            placeholder="Re-enter password"
            required
          />
        </div>

        {/* Status */}
        <div className="col-12 col-md-6">
          <label className="form-label fw-bold">Status</label>
          <select
            className="form-select border border-dark text-dark"
            name="status"
            value={formData.status}
            onChange={handleChange}
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        {/* Error */}
        {error && <p className="text-danger text-center">{error}</p>}

        {/* Submit */}
        <div className="col-12 text-center">
          <button type="submit" className="btn btn-primary w-100 w-md-auto" disabled={loading}>
            {loading ? "Creating..." : "Create Employee"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default CreateEmployee;
