// src/pages/Collections.jsx
import React, { useState, useEffect } from "react";

// Mock data (replace with API call if needed)
const mockRecords = [
  { id: 1, amount: 500, mode: "Cash", employee: "John Doe", date: new Date() },
  { id: 2, amount: 1200, mode: "Online", employee: "Jane Smith", date: new Date() },
  { id: 3, amount: 700, mode: "Cash", employee: "John Doe", date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) }, // 2 days ago
  { id: 4, amount: 1500, mode: "Online", employee: "Jane Smith", date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) }, // 10 days ago
];

const employees = ["John Doe", "Jane Smith"];

function Collections() {
  const [records, setRecords] = useState(mockRecords);
  const [filter, setFilter] = useState("today");
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [filteredRecords, setFilteredRecords] = useState([]);
  const [totalCollected, setTotalCollected] = useState(0);

  useEffect(() => {
    filterRecords();
  }, [filter, employeeFilter, records]);

  const filterRecords = () => {
    let now = new Date();
    let filtered = records;

    // Filter by date
    if (filter === "today") {
      filtered = filtered.filter(
        (r) => r.date.toDateString() === now.toDateString()
      );
    } else if (filter === "week") {
      const weekAgo = new Date();
      weekAgo.setDate(now.getDate() - 7);
      filtered = filtered.filter((r) => r.date >= weekAgo && r.date <= now);
    } else if (filter === "month") {
      const monthAgo = new Date();
      monthAgo.setMonth(now.getMonth() - 1);
      filtered = filtered.filter((r) => r.date >= monthAgo && r.date <= now);
    }

    // Filter by employee
    if (employeeFilter) {
      filtered = filtered.filter((r) => r.employee === employeeFilter);
    }

    setFilteredRecords(filtered);

    // Calculate total collected
    const total = filtered.reduce((acc, r) => acc + r.amount, 0);
    setTotalCollected(total);
  };

  const handleAddCollection = () => {
    const newRecord = {
      id: records.length + 1,
      amount: Math.floor(Math.random() * 1000) + 100,
      mode: Math.random() > 0.5 ? "Cash" : "Online",
      employee: employees[Math.floor(Math.random() * employees.length)],
      date: new Date(),
    };
    setRecords([newRecord, ...records]);
  };

  return (
    <div className="container my-3 px-2">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4>Collections</h4>
        <button className="btn btn-success btn-sm" onClick={handleAddCollection}>
          + Add Collection
        </button>
      </div>

      {/* Filters */}
      <div className="d-flex flex-column flex-md-row gap-2 mb-3">
        <select
          className="form-select form-select-sm"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="today">Today</option>
          <option value="week">This Week</option>
          <option value="month">This Month</option>
        </select>

        <select
          className="form-select form-select-sm"
          value={employeeFilter}
          onChange={(e) => setEmployeeFilter(e.target.value)}
        >
          <option value="">All Employees</option>
          {employees.map((emp, idx) => (
            <option key={idx} value={emp}>
              {emp}
            </option>
          ))}
        </select>
      </div>

      {/* Summary */}
      <div className="mb-3 d-flex justify-content-between flex-wrap gap-2">
        <span className="badge bg-primary">Total Collected: ₹{totalCollected}</span>
        <span className="badge bg-warning text-dark">
          Total Records: {filteredRecords.length}
        </span>
      </div>

      {/* Collection List */}
      <ul className="list-group">
        {filteredRecords.length > 0 ? (
          filteredRecords.map((r) => (
            <li key={r.id} className="list-group-item d-flex justify-content-between align-items-center flex-column flex-md-row">
              <div>
                <strong>₹{r.amount}</strong> — {r.mode} — <em>{r.employee}</em>
              </div>
              <small>{r.date.toLocaleString()}</small>
            </li>
          ))
        ) : (
          <li className="list-group-item text-center text-muted">No records found</li>
        )}
      </ul>
    </div>
  );
}

export default Collections;
