// src/components/BoatAllotment.jsx
import React, { useState } from "react";

function BoatAllotment() {
  const [assignedBoat, setAssignedBoat] = useState(null);

  const boats = ["SpeedBoat A", "Yacht B", "Canoe C"];

  return (
    <div className="card mt-4">
      <div className="card-body">
        <h5 className="card-title">Boat Allotment</h5>
        <select
          className="form-select mb-3"
          onChange={(e) => setAssignedBoat(e.target.value)}
        >
          <option value="">Select a Boat</option>
          {boats.map((boat, idx) => (
            <option key={idx} value={boat}>
              {boat}
            </option>
          ))}
        </select>
        {assignedBoat && (
          <p className="alert alert-info">
            Assigned Boat: <strong>{assignedBoat}</strong>
          </p>
        )}
      </div>
    </div>
  );
}

export default BoatAllotment;
