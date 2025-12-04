// src/pages/NotFound.jsx
import React from "react";
import { Link } from "react-router-dom";

function NotFound({user}) {
  console.log(user)
  return (
    <div className="container mt-5 text-center">
      <h1>404 - Page Not Found</h1>
      {!user && <Link to="/" className="btn btn-primary mt-3">
        Go to Login.
      </Link>}
    </div>
  );
}

export default NotFound;
