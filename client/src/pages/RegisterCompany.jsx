import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { registerCompanyAPI } from "../services/operations/companyAPI";

function RegisterCompany() {
    const navigate = useNavigate();

    const [form, setForm] = useState({
        username: "",
        password: "",
        name: "",
        email: "",
        contact: "",
        companyName: "",
        companyCode: "",
        address: ""
    });

    const handleChange = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        try {
            const token = localStorage.getItem("authToken");
            const payload = form;

            console.log("Payload : ", payload);
            const response = await registerCompanyAPI(token, payload);

            console.log("✅ Success:", response);
            // alert("Company created successfully");
            navigate(-1);

        } catch (err) {
            alert(err.response?.data?.message || "Error occurred");
        }
    };

    return (
        <div className="container py-5">
            <div
                className="card shadow-lg border-0 p-4 mx-auto"
                style={{ maxWidth: "900px", borderRadius: "15px" }}
            >
                {/* Back Button */}
                <div className="d-flex justify-content-between align-items-center mb-3">
                    <button
                        type="button"
                        className="btn btn-outline-secondary btn-sm"
                        onClick={() => navigate(-1)}
                    >
                        ← Back
                    </button>

                    <h5 className="mb-0 fw-bold text-center w-100">
                        🚀 Create Company & Admin
                    </h5>

                    {/* Empty div to balance flex */}
                    <div style={{ width: "70px" }}></div>
                </div>

                <form onSubmit={handleSubmit}>
                    {/* Admin Section */}
                    <div className="mb-4">
                        <h5 className="mb-3 text-secondary border-bottom pb-2">
                            Admin Details
                        </h5>

                        <div className="row">
                            <div className="col-md-6 mb-3">
                                <label className="form-label">Username *</label>
                                <input
                                    className="form-control"
                                    name="username"
                                    placeholder="Enter username"
                                    required
                                    onChange={handleChange}
                                />
                            </div>

                            <div className="col-md-6 mb-3">
                                <label className="form-label">Password *</label>
                                <input
                                    className="form-control"
                                    name="password"
                                    type="password"
                                    placeholder="Enter password"
                                    required
                                    onChange={handleChange}
                                />
                            </div>

                            <div className="col-md-6 mb-3">
                                <label className="form-label">Full Name *</label>
                                <input
                                    className="form-control"
                                    name="name"
                                    placeholder="Enter full name"
                                    required
                                    onChange={handleChange}
                                />
                            </div>

                            <div className="col-md-6 mb-3">
                                <label className="form-label">Email *</label>
                                <input
                                    className="form-control"
                                    name="email"
                                    type="email"
                                    placeholder="Enter email"
                                    required
                                    onChange={handleChange}
                                />
                            </div>

                            <div className="col-md-6 mb-3">
                                <label className="form-label">Contact *</label>
                                <input
                                    className="form-control"
                                    name="contact"
                                    placeholder="Enter contact number"
                                    required
                                    onChange={handleChange}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Company Section */}
                    <div>
                        <h5 className="mb-3 text-secondary border-bottom pb-2">
                            Company Details
                        </h5>

                        <div className="row">
                            <div className="col-md-6 mb-3">
                                <label className="form-label">Company Name *</label>
                                <input
                                    className="form-control"
                                    name="companyName"
                                    placeholder="Enter company name"
                                    required
                                    onChange={handleChange}
                                />
                            </div>

                            <div className="col-md-6 mb-3">
                                <label className="form-label">Company Code *</label>
                                <input
                                    className="form-control"
                                    name="companyCode"
                                    placeholder="Enter company code"
                                    required
                                    onChange={handleChange}
                                />
                            </div>

                            <div className="col-12 mb-3">
                                <label className="form-label">Address *</label>
                                <textarea
                                    className="form-control"
                                    name="address"
                                    rows="3"
                                    placeholder="Enter company address"
                                    required
                                    onChange={handleChange}
                                />
                            </div>
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="btn btn-dark w-100 mt-3 py-2"
                        style={{ borderRadius: "8px", fontWeight: "500" }}
                    >
                        Create Company
                    </button>
                </form>
            </div>
        </div>
    );
}

export default RegisterCompany;