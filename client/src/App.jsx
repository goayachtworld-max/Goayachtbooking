import React, { useState, useEffect } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import {jwtDecode} from "jwt-decode";
import axios from "axios";
import "./App.css"; 
import Navbar from "./components/Navbar";
import ProtectedRoute from "./components/ProtectedRoute";

// Pages
import Login from "./pages/Login";
import AdminDashboard from "./pages/AdminDashboard";
import Bookings from "./pages/Bookings";
import Collections from "./pages/Collections";
import Availability from "./pages/Availability";
import NotFound from "./pages/NotFound";
import CreateCustomer from "./pages/CreateCustomer";
import CustomerDetails from "./pages/CustomerDetails";
import CreateEmployee from "./pages/CreateEmployee";
import CreateBooking from "./pages/CreateBooking";
import UpdateBooking from "./pages/UpdateBooking";
import DayAvailability from "./pages/DayAvailability";
import CreateYacht from "./pages/CreateYacht";
import AllYachts from "./pages/AllYachts";
import AllEmployees from "./pages/AllEmployees";
import { Toaster } from "react-hot-toast";

function App() {
  const storedUser = localStorage.getItem("user");
  const [user, setUser] = useState(storedUser ? JSON.parse(storedUser) : null);
  const navigate = useNavigate();
  const role = user?.type?.toLowerCase();

  //  LOGOUT FUNCTION
  const logoutUser = () => {
    setUser(null);
    localStorage.removeItem("user");
    localStorage.removeItem("authToken");
    navigate("/");
  };

  //  LOGIN FUNCTION
  const handleLogin = (data) => {
    setUser(data);
    localStorage.setItem("user", JSON.stringify(data));

    const token = data?.token || localStorage.getItem("authToken");
    if (token) scheduleAutoLogout(token);
  };

  //  AUTO LOGOUT BASED ON TOKEN EXPIRY
  const scheduleAutoLogout = (token) => {
    try {
      const decoded = jwtDecode(token);
      const expiryTime = decoded.exp * 1000;
      const timeout = expiryTime - Date.now();

      if (timeout > 0) {
        setTimeout(logoutUser, timeout);
      } else {
        logoutUser();
      }
    } catch (e) {
      logoutUser();
    }
  };

  //  RUN ON PAGE LOAD / REFRESH
  useEffect(() => {
    const token = localStorage.getItem("authToken");
    if (token) {
      try {
        const decoded = jwtDecode(token);
        if (Date.now() >= decoded.exp * 1000) {
          logoutUser();
        } else {
          scheduleAutoLogout(token);
        }
      } catch {
        logoutUser();
      }
    }
  }, []);

  //  AXIOS INTERCEPTOR → Auto logout on 401
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (res) => res,
      (err) => {
        if (err.response?.status === 401) {
          logoutUser();
        }
        return Promise.reject(err);
      }
    );

    return () => axios.interceptors.response.eject(interceptor);
  }, []);

  return (
    <>
      <Toaster position="top-right" reverseOrder={false} />
      {user && <Navbar user={user} onLogout={logoutUser} />}

      <Routes>
        {/* Root Route → Redirect based on user role */}
        <Route
          path="/"
          element={
            user ? (
              role === "admin" ? (
                <Navigate to="/admin" />
              ) : (
                <Navigate to="/bookings" />
              )
            ) : (
              <Login onLogin={handleLogin} />
            )
          }
        />

        {/* Protected Routes */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute user={user}>
              {role === "admin" ? <AdminDashboard /> : <NotFound />}
            </ProtectedRoute>
          }
        />

        <Route
          path="/bookings"
          element={
            <ProtectedRoute user={user}>
              <Bookings user={user} />
            </ProtectedRoute>
          }
        />

        <Route
          path="/collections"
          element={
            <ProtectedRoute user={user}>
              {role === "admin" ? <Collections /> : <NotFound />}
            </ProtectedRoute>
          }
        />

        <Route
          path="/availability"
          element={
            <ProtectedRoute user={user}>
              {["admin", "backdesk"].includes(role) ? <Availability /> : <NotFound />}
            </ProtectedRoute>
          }
        />

        <Route
          path="/availability/:yachtName/:date?"
          element={
            <ProtectedRoute user={user}>
              {["admin", "backdesk"].includes(role) ? <DayAvailability /> : <NotFound />}
            </ProtectedRoute>
          }
        />

        <Route
          path="/create-customer"
          element={
            <ProtectedRoute user={user}>
              {["admin", "backdesk"].includes(role) ? <CreateCustomer /> : <NotFound />}
            </ProtectedRoute>
          }
        />

        <Route
          path="/customer-details"
          element={
            <ProtectedRoute user={user}>
              {["admin", "backdesk", "onsite"].includes(role) ? <CustomerDetails /> : <NotFound />}
            </ProtectedRoute>
          }
        />

        <Route
          path="/create-employee"
          element={
            <ProtectedRoute user={user}>
              {role === "admin" ? <CreateEmployee /> : <NotFound />}
            </ProtectedRoute>
          }
        />

        <Route
          path="/create-yacht"
          element={
            <ProtectedRoute user={user}>
              {role === "admin" ? <CreateYacht /> : <NotFound />}
            </ProtectedRoute>
          }
        />

        <Route
          path="/all-yachts"
          element={
            <ProtectedRoute user={user}>
              {["admin", "backdesk"].includes(role) ? <AllYachts /> : <NotFound />}
            </ProtectedRoute>
          }
        />

        <Route
          path="/all-employees"
          element={
            <ProtectedRoute user={user}>
              {["admin", "backdesk"].includes(role) ? <AllEmployees /> : <NotFound />}
            </ProtectedRoute>
          }
        />

        <Route
          path="/create-booking"
          element={
            <ProtectedRoute user={user}>
              {["admin", "backdesk"].includes(role) ? <CreateBooking /> : <NotFound />}
            </ProtectedRoute>
          }
        />

        <Route
          path="/update-booking"
          element={
            <ProtectedRoute user={user}>
              {["admin", "backdesk", "onsite"].includes(role) ? <UpdateBooking /> : <NotFound />}
            </ProtectedRoute>
          }
        />

        {/* Fallback Route */}
        <Route path="*" element={<NotFound user={user} />} />
      </Routes>
    </>
  );
}

export default App;
