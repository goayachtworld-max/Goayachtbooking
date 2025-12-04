// src/components/Footer.jsx
import React from "react";
import { FaInstagram, FaFacebookF } from "react-icons/fa";

function Footer() {
  return (
    <footer className="bg-dark text-light py-1" style={{ fontSize: "0.75rem" }}>
      <div className="container text-center d-flex justify-content-center align-items-center gap-2">
        <span>My Website Name | 123 Street, City | &copy; {new Date().getFullYear()}</span>
        <a href="https://www.instagram.com/your_instagram_id" target="_blank" rel="noopener noreferrer" className="text-light">
          <FaInstagram size={14} />
        </a>
        <a href="https://www.facebook.com/your_facebook_id" target="_blank" rel="noopener noreferrer" className="text-light">
          <FaFacebookF size={14} />
        </a>
      </div>
    </footer>
  );
}

export default Footer;
