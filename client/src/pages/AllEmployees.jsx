import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAllEmployeesAPI, updateEmployeeStatusAPI } from "../services/operations/employeeAPI";
import { toast } from "react-hot-toast";

const AllEmployees = () => {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true); // <-- ADDED
  const navigate = useNavigate();
  const token = localStorage.getItem("authToken");

  const fetchEmployees = async () => {
    try {
      const response = await getAllEmployeesAPI(token);
      if (response.data.success) {
        setEmployees(response.data.employees);
      } else {
        toast.error("Failed to load employees");
      }
    } catch (error) {
      toast.error("Error fetching employees");
    } finally {
      setLoading(false); // <-- ADDED
    }
  };

  const toggleStatus = async (id, currentStatus) => {
    const newStatus = currentStatus === "active" ? "inactive" : "active";
    try {
      const response = await updateEmployeeStatusAPI(id, newStatus, token);
      if (response.data.success) {
        toast.success(`Employee set to ${newStatus}`);
        setEmployees((prev) =>
          prev.map((emp) =>
            emp._id === id ? { ...emp, status: newStatus } : emp
          )
        );
      } else {
        toast.error("Failed to update status");
      }
    } catch (error) {
      toast.error("Error updating employee status");
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  return (
    <div className="container my-5">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="fw-bold" style={{ color: "#1f3d63" }}>
          Employees
        </h2>

        <button
          className="btn btn-primary px-4 py-2"
          style={{
            borderRadius: "12px",
            fontWeight: "600",
            background: "#1f6feb",
            border: "none"
          }}
          onClick={() => navigate("/create-employee")}
        >
          + Create Employee
        </button>
      </div>

      {/* --- LOADER ADDED HERE --- */}
      {loading ? (
        <div className="text-center my-5">
          <div
            className="spinner-border text-primary"
            role="status"
            style={{ width: "3rem", height: "3rem" }}
          ></div>
          <p className="mt-3 text-muted">Loading employees...</p>
        </div>
      ) : (
        <div className="row">
          {employees.length > 0 ? (
            employees.map((emp) => (
              <div key={emp._id} className="col-md-4 mb-4">
                <div
                  className="p-4 h-100"
                  style={{
                    borderRadius: "20px",
                    background: "rgba(255,255,255,0.9)",
                    border: "1px solid rgba(0, 0, 0, 0.24)",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                    transition: "0.25s ease",
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.transform = "translateY(-4px)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.transform = "translateY(0)")
                  }
                >
                  <div className="text-center">
                    <img
                      src={
                        emp.photo ||
                        "https://cdn-icons-png.flaticon.com/512/149/149071.png"
                      }
                      alt={emp.name}
                      className="rounded-circle"
                      style={{
                        width: "120px",
                        height: "120px",
                        objectFit: "cover",
                        border: "3px solid #e6e6e6",
                        boxShadow: "0 3px 8px rgba(0,0,0,0.08)",
                      }}
                    />

                    <h5 className="mt-3 mb-1 fw-bold" style={{ color: "#145DA0" }}>
                      {emp.name}
                    </h5>

                    <span
                      className={`badge px-3 py-2 mt-2`}
                      style={{
                        fontSize: "0.85rem",
                        borderRadius: "8px",
                        background: emp.status === "active" ? "#28a745" : "#6c757d",
                        color: "white",
                        fontWeight: 600,
                      }}
                    >
                      {emp.status.toUpperCase()}
                    </span>
                  </div>

                  <div className="mt-3 text-center">
                    <p className="mb-1"><strong>Contact:</strong> {emp.contact}</p>
                    <p className="mb-1"><strong>Email:</strong> {emp.email}</p>
                    <p className="mb-1"><strong>Role:</strong> {emp.type}</p>
                    <p className="mb-3"><strong>Username:</strong> {emp.username}</p>

                    <button
                      className="btn btn-sm px-4"
                      style={{
                        borderRadius: "10px",
                        fontWeight: 600,
                        border:
                          emp.status === "active"
                            ? "1px solid #6c757d"
                            : "1px solid #28a745",
                        color:
                          emp.status === "active" ? "#6c757d" : "#28a745",
                      }}
                      onClick={() => toggleStatus(emp._id, emp.status)}
                    >
                      {emp.status === "active" ? "Set Inactive" : "Set Active"}
                    </button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className="text-center text-muted mt-5">No employees found.</p>
          )}
        </div>
      )}
    </div>
  );
};

export default AllEmployees;
