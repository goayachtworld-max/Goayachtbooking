import React, { useEffect, useState } from "react";
import {
    getCustomersAPI,
    updateCustomerAPI,
    searchCustomersByNameAPI,
} from "../services/operations/customerAPI";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";

function CustomerManagement() {
    const token = localStorage.getItem("authToken");

    const [customers, setCustomers] = useState([]);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [loading, setLoading] = useState(false);

    const [searchTerm, setSearchTerm] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");

    const [showModal, setShowModal] = useState(false);
    const [modalLoading, setModalLoading] = useState(false);
    const [selectedCustomerId, setSelectedCustomerId] = useState(null);

    const [formData, setFormData] = useState({
        name: "",
        contact: "",
        email: "",
        alternateContact: "",
    });

    const navigate = useNavigate();

    /* ---------------- Debounce Search ---------------- */
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchTerm);
            setPage(1);
        }, 500);

        return () => clearTimeout(timer);
    }, [searchTerm]);

    /* ---------------- Fetch Customers ---------------- */
    const fetchCustomers = async () => {
        try {
            setLoading(true);

            let response;

            if (debouncedSearch.trim()) {
                response = await searchCustomersByNameAPI(debouncedSearch, token);
                setCustomers(response.customers);
                setTotalPages(1);
            } else {
                response = await getCustomersAPI(page, 10, token);
                setCustomers(response.customers);
                setTotalPages(response.totalPages);
            }
        } catch (err) {
            toast.error("Failed to fetch customers");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCustomers();
    }, [page, debouncedSearch]);

    /* ---------------- Modal Logic ---------------- */
    const handleEditClick = (customer) => {
        setSelectedCustomerId(customer._id);
        setFormData({
            name: customer.name || "",
            contact: customer.contact || "",
            email: customer.email || "",
            alternateContact: customer.alternateContact || "",
        });
        setShowModal(true);
    };

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleUpdate = async (e) => {
        e.preventDefault();
        try {
            setModalLoading(true);
            await updateCustomerAPI(selectedCustomerId, formData, token);
            toast.success("Customer updated successfully");
            setShowModal(false);
            fetchCustomers();
        } catch (err) {
            toast.error("Update failed");
        } finally {
            setModalLoading(false);
        }
    };

    /* ---------------- Page Numbers ---------------- */
    const renderPageNumbers = () => {
        let pages = [];
        for (let i = 1; i <= totalPages; i++) {
            pages.push(
                <button
                    key={i}
                    className={`btn btn-sm mx-1 ${page === i ? "btn-primary" : "btn-outline-primary"
                        }`}
                    onClick={() => setPage(i)}
                >
                    {i}
                </button>
            );
        }
        return pages;
    };

    const handleBack = () => {
        navigate(-1);
    };
    return (
        <div className="container my-4">
            <div className="d-flex align-items-center justify-content-between flex-nowrap mb-4">
                <h4 className="mb-0 text-truncate">Create Management</h4>
                <div className="d-flex gap-2 flex-shrink-0">
                    <button
                        className="btn btn-secondary btn-sm"
                        onClick={handleBack}
                    >
                        Back
                    </button>
                </div>
            </div>

            {/* 🔍 Search */}
            <div className="mb-3">
                <input
                    type="text"
                    className="form-control"
                    placeholder="Search customer by name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {/* Table */}
            {loading ? (
                <div className="text-center py-4">
                    <div className="spinner-border text-primary" />
                </div>
            ) : (
                <>
                    <table className="table table-hover table-bordered align-middle">
                        <thead className="table-light">
                            <tr>
                                <th>Name</th>
                                <th>Contact</th>
                                <th>Email</th>
                                <th width="120">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {customers.length === 0 ? (
                                <tr>
                                    <td colSpan="4" className="text-center">
                                        No customers found
                                    </td>
                                </tr>
                            ) : (
                                customers.map((cust) => (
                                    <tr key={cust._id}>
                                        <td>{cust.name}</td>
                                        <td>{cust.contact}</td>
                                        <td>{cust.email}</td>
                                        <td>
                                            <button
                                                className="btn btn-sm btn-primary"
                                                onClick={() => handleEditClick(cust)}
                                            >
                                                Edit
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>

                    {/* Pagination Numbers */}
                    {!debouncedSearch && (
                        <div className="d-flex justify-content-center mt-3">
                            {renderPageNumbers()}
                        </div>
                    )}
                </>
            )}

            {/* 🔥 MODAL WITH BACKDROP BLUR */}
            {showModal && (
                <>
                    <div
                        className="position-fixed top-0 start-0 w-100 h-100"
                        style={{
                            background: "rgba(0,0,0,0.4)",
                            backdropFilter: "blur(4px)",
                            zIndex: 1040,
                        }}
                        onClick={() => setShowModal(false)} // close on outside click
                    />

                    <div
                        className="modal d-block"
                        style={{ zIndex: 1050 }}
                        tabIndex="-1"
                    >
                        <div
                            className="modal-dialog"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="modal-content shadow-lg">
                                <div className="modal-header">
                                    <h5 className="modal-title">Edit Customer</h5>
                                    <button
                                        type="button"
                                        className="btn-close"
                                        onClick={() => setShowModal(false)}
                                    />
                                </div>

                                <form onSubmit={handleUpdate}>
                                    <div className="modal-body">
                                        <div className="mb-3">
                                            <label>Name</label>
                                            <input
                                                className="form-control"
                                                name="name"
                                                value={formData.name}
                                                onChange={handleChange}
                                                required
                                            />
                                        </div>

                                        <div className="mb-3">
                                            <label>Contact</label>
                                            <input
                                                className="form-control"
                                                name="contact"
                                                value={formData.contact}
                                                onChange={handleChange}
                                                required
                                            />
                                        </div>

                                        <div className="mb-3">
                                            <label>Email</label>
                                            <input
                                                className="form-control"
                                                name="email"
                                                value={formData.email}
                                                onChange={handleChange}
                                            />
                                        </div>

                                        <div className="mb-3">
                                            <label>Alternate Contact</label>
                                            <input
                                                className="form-control"
                                                name="alternateContact"
                                                value={formData.alternateContact}
                                                onChange={handleChange}
                                            />
                                        </div>
                                    </div>

                                    <div className="modal-footer">
                                        <button
                                            type="button"
                                            className="btn btn-secondary"
                                            onClick={() => setShowModal(false)}
                                            disabled={modalLoading}
                                        >
                                            Cancel
                                        </button>

                                        <button
                                            type="submit"
                                            className="btn btn-primary"
                                            disabled={modalLoading}
                                        >
                                            {modalLoading ? (
                                                <>
                                                    <span className="spinner-border spinner-border-sm me-2" />
                                                    Updating...
                                                </>
                                            ) : (
                                                "Update"
                                            )}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

export default CustomerManagement;