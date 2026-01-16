import React, { useState } from "react";
import { createEmployeeAPI } from "../services/operations/authAPI";
import { toast } from "react-hot-toast";
import { FaEye, FaEyeSlash } from "react-icons/fa";


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
    isPrivate: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);


  // const handleChange = (e) => {
  //   const { name, value } = e.target;
  //   setFormData({ ...formData, [name]: value });
  // };

  const handleChange = (e) => {
    const { name, value } = e.target;
    // 👇 If role is onsite, force isPrivate = true
    if (name === "role") {
      setFormData({
        ...formData,
        role: value,
        isPrivate: value === "onsite" ? true : formData.isPrivate,
      });
      return;
    }

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
    const indianPhoneRegex = /^(?:\+91-?|\+91)?[789]\d{9}$/;

    if (!indianPhoneRegex.test(contact)) {
      setLoading(false);
      setError("Please enter a valid Indian mobile number");
      return;
    }


    try {
      const token = localStorage.getItem("authToken");
      const payload = {
        type: formData.role,
        name: formData.name,
        contact,
        email: formData.email,
        username: formData.username,
        password: formData.password.toLowerCase(),
        status: formData.status,
        isPrivate: formData.isPrivate
      };

      console.log("Create emp : ", payload)
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
        isPrivate: false,
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
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h4>Create User</h4>
        <button className="btn btn-secondary" onClick={() => navigate(-1)}>
          ← Back
        </button>
      </div>
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
            <option value="backdesk">Agent</option>
            <option value="onsite">Staff</option>
          </select>
        </div>

        {/* Name */}
        <div className="col-md-6">
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
        <div className="col-md-6">
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
        <div className="col-md-6">
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
        {/* <div className="col-12 col-md-6">
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
        </div> */}
        <div className="col-12 col-md-6">
          <label className="form-label fw-bold">Password</label>

          <div className="input-group">
            <input
              type={showPassword ? "text" : "password"}
              className="form-control border border-dark text-dark"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Enter password"
              required
            />

            <span
              className="input-group-text bg-white border border-dark"
              style={{ cursor: "pointer" }}
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <FaEyeSlash /> : <FaEye />}
            </span>
          </div>
        </div>


        {/* Confirm Password */}
        {/* <div className="col-12 col-md-6">
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
        </div> */}
        <div className="col-12 col-md-6">
          <label className="form-label fw-bold">Confirm Password</label>

          <div className="input-group">
            <input
              type={showConfirmPassword ? "text" : "password"}
              className="form-control border border-dark text-dark"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder="Re-enter password"
              required
            />

            <span
              className="input-group-text bg-white border border-dark"
              style={{ cursor: "pointer" }}
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            >
              {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
            </span>
          </div>
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

        {/* Private User */}
        <div className="col-12 col-md-6">
          <label className="form-label fw-bold">User Visiblity</label>

          <select
            className="form-select border border-dark text-dark"
            value={String(formData.isPrivate)}   // 👈 BOOLEAN → STRING
            disabled={formData.role === "onsite"}
            onChange={(e) =>
              setFormData({
                ...formData,
                isPrivate: e.target.value === "true", // 👈 STRING → BOOLEAN
              })
            }
          >
            <option value="false">Global</option>
            <option value="true">Local</option>
          </select>

        </div>


        {/* Error */}
        {error && <p className="text-danger text-center">{error}</p>}

        {/* Submit */}
        <div className="col-12 text-center">
          <button type="submit" className="btn btn-primary w-100 w-md-auto" disabled={loading}>
            {loading ? "Creating..." : "Create User"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default CreateEmployee;
