// pages/ResetPassword.jsx
// Opened from the e-mail link:  /reset-password?token=...
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiEye, FiEyeOff } from "react-icons/fi";
import toast from "react-hot-toast";
import { checkResetTokenAPI, resetPasswordAPI } from "../services/operations/authAPI";
import styles from "../styles/AuthCard.module.css";

const MIN_LEN = 8;
const MAX_LEN = 72;

export default function ResetPassword() {
  const navigate = useNavigate();

  // Read the token once, then remove it from the address bar (history / screenshots)
  const [token] = useState(() => new URLSearchParams(window.location.search).get("token") || "");

  const [phase, setPhase] = useState(token ? "checking" : "invalid"); // checking | form | invalid | done
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    window.history.replaceState({}, "", "/reset-password");
    let cancelled = false;
    checkResetTokenAPI(token)
      .then((res) => {
        if (!cancelled) setPhase(res.data?.valid ? "form" : "invalid");
      })
      .catch(() => {
        if (!cancelled) setPhase("invalid");
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const longEnough = password.length >= MIN_LEN;
  const matches = confirm.length > 0 && password === confirm;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (password.length < MIN_LEN) return setError(`Password must be at least ${MIN_LEN} characters.`);
    if (password.length > MAX_LEN) return setError(`Password must be at most ${MAX_LEN} characters.`);
    if (password !== confirm) return setError("The two passwords do not match.");

    setLoading(true);
    try {
      await resetPasswordAPI(token, password);
      setPhase("done");
      toast.success("Password updated");
    } catch (err) {
      const msg = err.response?.data?.message || "Could not reset the password. Please try again.";
      if (err.response?.status === 400 && /invalid or has expired/i.test(msg)) {
        setPhase("invalid");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.brand}>Staff sign in</div>

        {phase === "checking" && (
          <>
            <h1 className={styles.title}>Checking your link…</h1>
            <div className={styles.spinner} />
          </>
        )}

        {phase === "invalid" && (
          <>
            <h1 className={styles.title}>Link not valid</h1>
            <p className={styles.subtitle}>
              This reset link is invalid, has expired, or was already used. Reset links work once
              and last 30 minutes.
            </p>
            <button type="button" className={styles.button} onClick={() => navigate("/forgot-password")}>
              Request a new link
            </button>
            <button type="button" className={styles.linkBtn} onClick={() => navigate("/")}>
              Back to sign in
            </button>
          </>
        )}

        {phase === "form" && (
          <form onSubmit={handleSubmit} noValidate>
            <h1 className={styles.title}>Choose a new password</h1>
            <p className={styles.subtitle}>
              Use at least {MIN_LEN} characters. You'll be signed out on all other devices.
            </p>

            <div className={styles.group}>
              <label className={styles.label} htmlFor="rp-new">New password</label>
              <div className={styles.inputWrap}>
                <input
                  id="rp-new"
                  type={showPass ? "text" : "password"}
                  className={styles.input}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  autoComplete="new-password"
                  autoFocus
                />
                <button type="button" className={styles.eye} onClick={() => setShowPass((v) => !v)} tabIndex={-1}>
                  {showPass ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                </button>
              </div>
              <p className={`${styles.hint} ${password ? (longEnough ? styles.hintOk : styles.hintBad) : ""}`}>
                {longEnough ? "✓ " : ""}At least {MIN_LEN} characters
              </p>
            </div>

            <div className={styles.group}>
              <label className={styles.label} htmlFor="rp-confirm">Confirm password</label>
              <div className={styles.inputWrap}>
                <input
                  id="rp-confirm"
                  type={showPass ? "text" : "password"}
                  className={styles.input}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  disabled={loading}
                  autoComplete="new-password"
                />
              </div>
              {confirm.length > 0 && (
                <p className={`${styles.hint} ${matches ? styles.hintOk : styles.hintBad}`}>
                  {matches ? "✓ Passwords match" : "Passwords do not match yet"}
                </p>
              )}
            </div>

            {error && <p className={styles.error}>{error}</p>}

            <button className={styles.button} type="submit" disabled={loading}>
              {loading ? "Saving…" : "Save new password"}
            </button>
          </form>
        )}

        {phase === "done" && (
          <>
            <h1 className={styles.title}>Password updated</h1>
            <p className={styles.notice}>
              Your password has been changed. Use it the next time you sign in. Your PIN (if you
              have one) is unchanged.
            </p>
            <button type="button" className={styles.button} onClick={() => navigate("/")}>
              Go to sign in
            </button>
          </>
        )}
      </div>
    </div>
  );
}
