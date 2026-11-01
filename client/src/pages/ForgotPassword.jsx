// pages/ForgotPassword.jsx
// Staff only (admin / backdesk / onsite). Customers have no password.
import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { forgotPasswordAPI } from "../services/operations/authAPI";
import styles from "../styles/AuthCard.module.css";

const LS_IDENTIFIER = "lastLoginIdentifier";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const location = useLocation();

  const [identifier, setIdentifier] = useState(
    () => location.state?.identifier || localStorage.getItem(LS_IDENTIFIER) || ""
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sentMessage, setSentMessage] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!identifier.trim()) {
      setError("Enter your username or mobile number.");
      return;
    }
    setLoading(true);
    try {
      const res = await forgotPasswordAPI(identifier.trim());
      setSentMessage(
        res.data?.message ||
          "If a staff account exists for that username or mobile number, we've emailed a password reset link."
      );
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.brand}>Staff sign in</div>
        <h1 className={styles.title}>Forgot your password?</h1>

        {sentMessage ? (
          <>
            <p className={styles.notice}>{sentMessage}</p>
            <p className={styles.subtitle}>
              The link is valid for 30 minutes and works once. Check your spam folder if you
              don't see it. If you don't have access to that email, ask your admin to set a new
              password for you.
            </p>
            <button type="button" className={styles.button} onClick={() => navigate("/")}>
              Back to sign in
            </button>
            <button
              type="button"
              className={styles.linkBtn}
              onClick={() => setSentMessage("")}
            >
              Send it again
            </button>
          </>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            <p className={styles.subtitle}>
              Enter the username or mobile number you sign in with. We'll email a reset link to
              the address saved on your account.
            </p>

            <div className={styles.group}>
              <label className={styles.label} htmlFor="fp-identifier">
                Username or mobile
              </label>
              <div className={styles.inputWrap}>
                <input
                  id="fp-identifier"
                  type="text"
                  className={styles.input}
                  placeholder="Enter username or mobile"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  disabled={loading}
                  autoComplete="username"
                  autoFocus
                />
              </div>
            </div>

            {error && <p className={styles.error}>{error}</p>}

            <button className={styles.button} type="submit" disabled={loading}>
              {loading ? "Sending…" : "Email me a reset link"}
            </button>
            <button type="button" className={styles.linkBtn} onClick={() => navigate("/")}>
              Back to sign in
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
