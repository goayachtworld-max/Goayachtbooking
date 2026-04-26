import React, { useState, useEffect, Suspense, lazy } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import axios from "axios";
import "./App.css";
import Navbar from "./components/Navbar";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import { Toaster, toast } from "react-hot-toast";
import { socket } from "./socket";
import "./styles/NavbarNotification.css";
import NotificationBell from "./pages/NotificationBell";

const AdminDashboard    = lazy(() => import("./pages/AdminDashboard"));
const Bookings          = lazy(() => import("./pages/Bookings"));
const Collections       = lazy(() => import("./pages/Collections"));
const Availability      = lazy(() => import("./pages/Availability"));
const DayAvailability   = lazy(() => import("./pages/DayAvailability"));
const GridAvailability  = lazy(() => import("./pages/GridAvailability"));
const CreateCustomer    = lazy(() => import("./pages/CreateCustomer"));
const CustomerDetails   = lazy(() => import("./pages/CustomerDetails"));
const CustomerManagement= lazy(() => import("./pages/CustomerManagement"));
const CreateEmployee    = lazy(() => import("./pages/CreateEmployee"));
const CreateBooking     = lazy(() => import("./pages/CreateBooking"));
const UpdateBooking     = lazy(() => import("./pages/UpdateBooking"));
const CreateYacht       = lazy(() => import("./pages/CreateYacht"));
const AllYachts         = lazy(() => import("./pages/AllYachts"));
const AllEmployees      = lazy(() => import("./pages/AllEmployees"));
const EditBookingDetails= lazy(() => import("./components/EditBookingDetails"));
const RegisterCompany   = lazy(() => import("./pages/RegisterCompany"));
const NotificationsPage = lazy(() => import("./pages/NotificationsPage"));
const Reports           = lazy(() => import("./pages/Reports"));

const PageLoader = () => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
    <div style={{ width: 36, height: 36, border: "3px solid #e2e8f0", borderTop: "3px solid #1d6fa4", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
  </div>
);

function App() {
  const storedUser = localStorage.getItem("user");
  const [user, setUser] = useState(storedUser ? JSON.parse(storedUser) : null);
  const navigate = useNavigate();
  const role = user?.type?.toLowerCase();

  const logoutUser = () => {
    socket.disconnect();
    setUser(null);
    try {
      Object.keys(localStorage)
        .filter(k => k.startsWith("av_") || k.startsWith("av2_") || k.startsWith("bk_") || k.startsWith("db_stats_"))
        .forEach(k => localStorage.removeItem(k));
    } catch {}
    localStorage.removeItem("user");
    localStorage.removeItem("authToken");
    navigate("/");
  };

  const handleLogin = (data) => {
    const token = data?.token;
    if (!token) return;
    localStorage.setItem("authToken", token);
    localStorage.setItem("user", JSON.stringify(data));
    setUser(data);
    socket.auth = { token };
    socket.connect();
    scheduleAutoLogout(token);
  };

  const scheduleAutoLogout = (token) => {
    try {
      const decoded = jwtDecode(token);
      const timeout = decoded.exp * 1000 - Date.now();
      if (timeout > 0) setTimeout(logoutUser, timeout);
      else logoutUser();
    } catch { logoutUser(); }
  };

  useEffect(() => {
    const token = localStorage.getItem("authToken");
    if (user && token && !socket.connected) {
      socket.auth = { token };
      socket.connect();
    }
  }, [user]);

  useEffect(() => {
    document.addEventListener("wheel", (e) => {
      if (document.activeElement?.type === "number") document.activeElement.blur();
    }, { passive: true });
  }, []);

  useEffect(() => {
    socket.on("connect_error", (err) => {
      if (process.env.NODE_ENV === "development") console.warn("Socket:", err.message);
    });
    return () => { socket.off("connect_error"); };
  }, []);

  useEffect(() => {
    if (!user) return;
    socket.on("notification:new", (notification) => {
      toast.success(notification.message || "New notification");
    });
    return () => { socket.off("notification:new"); };
  }, [user]);

  useEffect(() => {
    const token = localStorage.getItem("authToken");
    if (token) {
      try {
        const decoded = jwtDecode(token);
        if (Date.now() >= decoded.exp * 1000) logoutUser();
        else scheduleAutoLogout(token);
      } catch { logoutUser(); }
    }
  }, []);

  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (res) => res,
      (err) => {
        if (err.response?.status === 401) {
          const token = localStorage.getItem("authToken");
          if (!token) { logoutUser(); return Promise.reject(err); }
          try {
            const decoded = jwtDecode(token);
            if (Date.now() >= decoded.exp * 1000) logoutUser();
          } catch { logoutUser(); }
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
      {user && <NotificationBell className="nav-notification" />}
      <div className={user ? `app-content role-${role}` : ""}>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route
              path="/"
              element={
                user
                  ? role === "admin" ? <Navigate to="/admin" /> : <Navigate to="/bookings" />
                  : <Login onLogin={handleLogin} />
              }
            />

            <Route path="/admin" element={
              <ProtectedRoute user={user}>
                {role === "admin" ? <AdminDashboard user={user} /> : <NotFound />}
              </ProtectedRoute>
            } />

            <Route path="/register-company" element={
              <ProtectedRoute user={user}>
                {user?.systemAdministrator ? <RegisterCompany /> : <NotFound />}
              </ProtectedRoute>
            } />

            <Route path="/bookings" element={
              <ProtectedRoute user={user}>
                <Bookings user={user} />
              </ProtectedRoute>
            } />

            <Route path="/collections" element={
              <ProtectedRoute user={user}>
                {role === "admin" ? <Collections /> : <NotFound />}
              </ProtectedRoute>
            } />

            <Route path="/availability" element={
              <ProtectedRoute user={user}>
                {["admin", "backdesk"].includes(role) ? <Availability /> : <NotFound />}
              </ProtectedRoute>
            } />

            <Route path="/grid-availability" element={
              <ProtectedRoute user={user}>
                {["admin", "backdesk", "onsite"].includes(role) ? <GridAvailability /> : <NotFound />}
              </ProtectedRoute>
            } />

            <Route path="/availability/:yachtName/:date?" element={
              <ProtectedRoute user={user}>
                {["admin", "backdesk"].includes(role) ? <DayAvailability /> : <NotFound />}
              </ProtectedRoute>
            } />

            <Route path="/create-customer" element={
              <ProtectedRoute user={user}>
                {["admin", "backdesk"].includes(role) ? <CreateCustomer /> : <NotFound />}
              </ProtectedRoute>
            } />

            <Route path="/customer-management" element={
              <ProtectedRoute user={user}>
                {["admin", "backdesk", "onsite"].includes(role) ? <CustomerManagement /> : <NotFound />}
              </ProtectedRoute>
            } />

            <Route path="/customer-details" element={
              <ProtectedRoute user={user}>
                {["admin", "backdesk", "onsite"].includes(role) ? <CustomerDetails /> : <NotFound />}
              </ProtectedRoute>
            } />

            <Route path="/create-employee" element={
              <ProtectedRoute user={user}>
                {role === "admin" ? <CreateEmployee /> : <NotFound />}
              </ProtectedRoute>
            } />

            <Route path="/create-yacht" element={
              <ProtectedRoute user={user}>
                {role === "admin" ? <CreateYacht /> : <NotFound />}
              </ProtectedRoute>
            } />

            <Route path="/all-yachts" element={
              <ProtectedRoute user={user}>
                {["admin", "backdesk"].includes(role) ? <AllYachts /> : <NotFound />}
              </ProtectedRoute>
            } />

            <Route path="/all-employees" element={
              <ProtectedRoute user={user}>
                {["admin", "backdesk"].includes(role) ? <AllEmployees /> : <NotFound />}
              </ProtectedRoute>
            } />

            <Route path="/create-booking" element={
              <ProtectedRoute user={user}>
                {["admin", "backdesk"].includes(role) ? <CreateBooking /> : <NotFound />}
              </ProtectedRoute>
            } />

            <Route path="/update-booking" element={
              <ProtectedRoute user={user}>
                {["admin", "onsite"].includes(role) ? <UpdateBooking /> : <NotFound />}
              </ProtectedRoute>
            } />

            <Route path="/edit-booking" element={
              <ProtectedRoute user={user}>
                {["admin", "backdesk", "onsite"].includes(role) ? <EditBookingDetails /> : <NotFound />}
              </ProtectedRoute>
            } />

            <Route path="/reports" element={
              <ProtectedRoute user={user}>
                {["admin", "backdesk"].includes(role) ? <Reports user={user} /> : <NotFound />}
              </ProtectedRoute>
            } />

            <Route path="/notifications" element={
              <ProtectedRoute user={user}>
                <NotificationsPage />
              </ProtectedRoute>
            } />

            <Route path="*" element={<NotFound user={user} />} />
          </Routes>
        </Suspense>
      </div>
    </>
  );
}

export default App;
