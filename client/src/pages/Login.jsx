import React, { useState } from "react";
import { FiEye, FiEyeOff, FiUser, FiLock } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { loginAPI } from "../services/operations/authAPI";
import styles from "../styles/Login.module.css";

function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await loginAPI(username, password);

      if (
        response.status === 200 &&
        response.data &&
        response.data.employee &&
        response.data.token
      ) {
        const { employee, token } = response.data;

        localStorage.setItem("authToken", token);
        onLogin({ ...employee, token });

        if (employee.type === "admin") navigate("/admin");
        else navigate("/bookings");
      } else {
        setError("Login failed. Please try again.");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Login failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.loginWrapper}>
      <div className={styles.loginCard}>
        <h2 className={styles.loginTitle}>Yacht Management</h2>

        <form onSubmit={handleSubmit} className={styles.loginForm}>

          {/* USERNAME */}
          <div className={styles.inputGroup}>
            <label>Username</label>

            <span className={styles.leftIcon}>
              <FiUser size={18} />
            </span>

            <input
              type="text"
              className={styles.inputField}
              placeholder="Enter username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          {/* PASSWORD */}
          <div className={styles.inputGroup}>
            <label>Password</label>

            <span className={styles.leftIcon}>
              <FiLock size={18} />
            </span>

            <input
              type={showPass ? "text" : "password"}
              className={styles.inputField}
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              required
            />

            {/* Toggle Eye Icon */}
            <span
              className={styles.passwordToggle}
              onClick={() => setShowPass(!showPass)}
            >
              {showPass ? <FiEyeOff size={20} /> : <FiEye size={20} />}
            </span>
          </div>

          {error && <p className={styles.errorMsg}>{error}</p>}

          <button className={styles.loginButton} disabled={loading}>
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Login;
