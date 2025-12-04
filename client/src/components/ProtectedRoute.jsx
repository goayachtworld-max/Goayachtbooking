// src/components/ProtectedRoute.jsx
import React from "react";
import { Navigate } from "react-router-dom";

function ProtectedRoute({ user, children }) {
  // console.log("Protected " + user.type)
  if (!user) {
    return <Navigate to="/" replace />;
  }
  return children;
}

export default ProtectedRoute;
