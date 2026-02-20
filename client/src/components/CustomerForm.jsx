// import React, { useState } from "react";
// import { useNavigate } from "react-router-dom";
// import { createCustomerAPI } from "../services/operations/customerAPI";
// import { toast } from "react-hot-toast";

// function CustomerForm() {
//   const navigate = useNavigate();

//   const [formData, setFormData] = useState({
//     name: "",
//     contact: "",
//     alternateContact: "",
//     email: "",
//     govtIdType: "None",
//     govtIdNo: "",
//     govtIdImage: null,
//   });

//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState("");

//   const handleChange = (e) => {
//     const { name, value, files } = e.target;
//     if (name === "govtIdType" && value === "None") {
//       setFormData({
//         ...formData,
//         govtIdType: value,
//         govtIdNo: "",
//         govtIdImage: null,
//       });
//       return;
//     }

//     if (name === "govtIdImage") {
//       setFormData({ ...formData, govtIdImage: files[0] });
//     } else {
//       setFormData({ ...formData, [name]: value });
//     }
//   };

//   const handleBack = () => {
//     navigate(-1);
//   };

//   const handleSubmit = async (e) => {
//     e.preventDefault();
//     setLoading(true);
//     setError("");

//     const indianPhoneRegex = /^(?:\+91-?|\+91)?[789]\d{9}$/;

//     if (!indianPhoneRegex.test(formData.contact)) {
//       setLoading(false);
//       setError("Please enter a valid Indian mobile number");
//       return;
//     }

//     try {
//       const token = localStorage.getItem("authToken");

//       const payload = new FormData();
//       for (let key in formData) {

//         if (
//           formData.govtIdType === "None" &&
//           (key === "govtIdNo" || key === "govtIdImage")
//         ) {
//           continue;
//         }

//         if (formData[key] !== null) {
//           if (key === "alternateContact" && !formData.alternateContact?.trim()) {
//             payload.append("alternateContact", formData.contact);
//           } else {
//             payload.append(key, formData[key]);
//           }
//         }
//       }

//       await createCustomerAPI(payload, token);
//       toast.success("Customer profile created successfully!");

//       setFormData({
//         name: "",
//         contact: "",
//         alternateContact: "",
//         email: "",
//         govtIdType: "None",
//         govtIdNo: "",
//         govtIdImage: null,
//       });
//     } catch (err) {
//       console.error("❌ Error creating customer:", err);
//       setError(err.response?.data?.message || "Failed to create customer profile");
//     } finally {
//       setLoading(false);
//     }
//   };

//   const isGovtIdDisabled = formData.govtIdType === "None";

//   return (
//     <div className="container my-4">
//       <div className="d-flex align-items-center justify-content-between flex-nowrap mb-4">
//         <h4 className="mb-0 text-truncate">Create Customer</h4>
//         <div className="d-flex gap-2 flex-shrink-0">
//           <button
//             className="btn btn-outline-primary btn-sm"
//             onClick={() => navigate("/customer-management")}
//           >
//             Manage
//           </button>
//           <button
//             className="btn btn-secondary btn-sm"
//             onClick={handleBack}
//           >
//             Back
//           </button>
//         </div>
//       </div>

//       {error && <p className="text-danger">{error}</p>}

//       <form className="row g-3" onSubmit={handleSubmit}>
//         <div className="col-12 col-md-6">
//           <label className="form-label fw-bold">Full Name</label>
//           <input
//             type="text"
//             className="form-control form-control-lg border border-dark text-dark"
//             name="name"
//             value={formData.name}
//             onChange={handleChange}
//             placeholder="Enter full name"
//             required
//           />
//         </div>

//         <div className="col-12 col-md-6">
//           <label className="form-label fw-bold">Contact Number</label>
//           <input
//             type="tel"
//             className="form-control form-control-lg border border-dark text-dark"
//             name="contact"
//             value={formData.contact}
//             onChange={handleChange}
//             placeholder="Enter contact number"
//             required
//           />
//         </div>

//         <div className="col-12 col-md-6">
//           <label className="form-label fw-bold">WhatsApp Number</label>
//           <input
//             type="tel"
//             className="form-control form-control-lg border border-dark text-dark"
//             name="alternateContact"
//             value={formData.alternateContact}
//             onChange={handleChange}
//             placeholder="Enter WhatsApp contact"
//           />
//         </div>

//         <div className="col-12 col-md-6">
//           <label className="form-label fw-bold">Email Address</label>
//           <input
//             type="email"
//             className="form-control form-control-lg border border-dark text-dark"
//             name="email"
//             value={formData.email}
//             onChange={handleChange}
//             placeholder="Enter email address"
//           />
//         </div>

//         <div className="col-12 col-md-6">
//           <label className="form-label fw-bold">Govt ID Type</label>
//           <select
//             className="form-select form-select-lg border border-dark text-dark"
//             name="govtIdType"
//             value={formData.govtIdType}
//             onChange={handleChange}
//           >
//             <option value="None">None</option>
//             <option value="Aadhar">Aadhar</option>
//             <option value="PAN">PAN</option>
//             <option value="Driving License">Driving License</option>
//             <option value="Passport">Passport</option>
//           </select>
//         </div>

//         <div className="col-12 col-md-6">
//           <label className="form-label fw-bold">Govt ID Number</label>
//           <input
//             type="text"
//             className={`form-control form-control-lg border border-dark text-dark ${isGovtIdDisabled ? "bg-light" : ""
//               }`}
//             name="govtIdNo"
//             value={formData.govtIdNo}
//             onChange={handleChange}
//             placeholder="Enter govt ID number"
//             disabled={isGovtIdDisabled}
//             required={!isGovtIdDisabled}
//           />
//         </div>

//         <div className="col-12">
//           <label className="form-label fw-bold">Upload Govt ID Image</label>
//           <input
//             type="file"
//             className={`form-control form-control-lg border border-dark ${isGovtIdDisabled ? "bg-light" : ""
//               }`}
//             name="govtIdImage"
//             accept="image/*"
//             onChange={handleChange}
//             disabled={isGovtIdDisabled}
//           />
//         </div>

//         <div className="col-12 text-center">
//           <button
//             type="submit"
//             className="btn btn-primary btn-lg w-100 w-md-auto"
//             disabled={loading}
//           >
//             {loading ? "Creating..." : "Create Profile"}
//           </button>
//         </div>
//       </form>
//     </div>
//   );
// }

// export default CustomerForm;


import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createCustomerAPI } from "../services/operations/customerAPI";
import { toast } from "react-hot-toast";

function CustomerForm() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: "",
    contact: "",
    alternateContact: "",
    email: "",
    govtIdType: "None",
    govtIdNo: "",
    govtIdImage: null,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) => {
    const { name, value, files } = e.target;

    if (name === "govtIdType" && value === "None") {
      setFormData({
        ...formData,
        govtIdType: value,
        govtIdNo: "",
        govtIdImage: null,
      });
      return;
    }

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

    const indianPhoneRegex = /^(?:\+91-?|\+91)?[789]\d{9}$/;

    if (!indianPhoneRegex.test(formData.contact)) {
      setLoading(false);
      setError("Please enter a valid Indian mobile number");
      return;
    }

    try {
      const token = localStorage.getItem("authToken");

      const payload = new FormData();
      for (let key in formData) {
        if (
          formData.govtIdType === "None" &&
          (key === "govtIdNo" || key === "govtIdImage")
        ) {
          continue;
        }

        if (formData[key] !== null) {
          if (key === "alternateContact" && !formData.alternateContact?.trim()) {
            payload.append("alternateContact", formData.contact);
          } else {
            payload.append(key, formData[key]);
          }
        }
      }

      await createCustomerAPI(payload, token);
      toast.success("Customer profile created successfully!");

      setFormData({
        name: "",
        contact: "",
        alternateContact: "",
        email: "",
        govtIdType: "None",
        govtIdNo: "",
        govtIdImage: null,
      });
    } catch (err) {
      console.error("❌ Error creating customer:", err);
      setError(
        err.response?.data?.message || "Failed to create customer profile"
      );
    } finally {
      setLoading(false);
    }
  };

  const isGovtIdDisabled = formData.govtIdType === "None";

  return (
    <div className="container my-4">

      {/* Header */}
      <div className="d-flex align-items-center justify-content-between mb-4 pb-3 border-bottom border-2">
        <h4 className="fw-bold mb-0 text-dark">
          Create Customer
        </h4>

        <div className="d-flex gap-2">
          <button
            className="btn btn-outline-primary btn-sm px-3 fw-semibold"
            onClick={() => navigate("/customer-management")}
          >
            Manage
          </button>

          <button
            className="btn btn-outline-dark btn-sm px-3 fw-semibold"
            onClick={handleBack}
          >
            Back
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger fw-semibold py-2 px-3 mb-3 rounded-2 border border-danger">
          {error}
        </div>
      )}

      <form className="row g-3" onSubmit={handleSubmit}>

        <div className="col-12 col-md-6">
          <label className="form-label fw-bold text-dark mb-1">
            Full Name
          </label>
          <input
            type="text"
            className="form-control border-2 rounded-2 fw-semibold"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="Enter full name"
            required
          />
        </div>

        <div className="col-12 col-md-6">
          <label className="form-label fw-bold text-dark mb-1">
            Contact Number
          </label>
          <input
            type="tel"
            className="form-control border-2 rounded-2 fw-semibold"
            name="contact"
            value={formData.contact}
            onChange={handleChange}
            placeholder="Enter contact number"
            required
          />
        </div>

        <div className="col-12 col-md-6">
          <label className="form-label fw-bold text-dark mb-1">
            WhatsApp Number
          </label>
          <input
            type="tel"
            className="form-control border-2 rounded-2 fw-semibold"
            name="alternateContact"
            value={formData.alternateContact}
            onChange={handleChange}
            placeholder="Enter WhatsApp contact"
          />
        </div>

        <div className="col-12 col-md-6">
          <label className="form-label fw-bold text-dark mb-1">
            Email Address
          </label>
          <input
            type="email"
            className="form-control border-2 rounded-2 fw-semibold"
            name="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="Enter email address"
          />
        </div>

        <div className="col-12 col-md-6">
          <label className="form-label fw-bold text-dark mb-1">
            Govt ID Type
          </label>
          <select
            className="form-select border-2 rounded-2 fw-semibold"
            name="govtIdType"
            value={formData.govtIdType}
            onChange={handleChange}
          >
            <option value="None">None</option>
            <option value="Aadhar">Aadhar</option>
            <option value="PAN">PAN</option>
            <option value="Driving License">Driving License</option>
            <option value="Passport">Passport</option>
          </select>
        </div>

        <div className="col-12 col-md-6">
          <label className="form-label fw-bold text-dark mb-1">
            Govt ID Number
          </label>
          <input
            type="text"
            className={`form-control border-2 rounded-2 fw-semibold ${
              isGovtIdDisabled ? "bg-light" : ""
            }`}
            name="govtIdNo"
            value={formData.govtIdNo}
            onChange={handleChange}
            placeholder="Enter govt ID number"
            disabled={isGovtIdDisabled}
            required={!isGovtIdDisabled}
          />
        </div>

        <div className="col-12">
          <label className="form-label fw-bold text-dark mb-1">
            Upload Govt ID Image
          </label>
          <input
            type="file"
            className={`form-control border-2 rounded-2 ${
              isGovtIdDisabled ? "bg-light" : ""
            }`}
            name="govtIdImage"
            accept="image/*"
            onChange={handleChange}
            disabled={isGovtIdDisabled}
          />
        </div>

        <div className="col-12 mt-3">
          <button
            type="submit"
            className="btn btn-primary w-100 fw-bold py-2 rounded-2 shadow-sm"
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