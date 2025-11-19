// deno-lint-ignore-file no-explicit-any
import React, { useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/apiClient.ts";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import "../styles/loginAdmin.css";

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
};

const LoginAdmin: React.FC = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({ id: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");

  const showPasswordRef = useRef(false);
  const [, forceRerender] = useState(false); // for toggling eye icon

  const handleChange = useCallback((e: any) => {
    const { id, value } = e.target;
    setForm((prev) => ({ ...prev, [id]: value }));
  }, []);

  const togglePassword = useCallback(() => {
    showPasswordRef.current = !showPasswordRef.current;
    forceRerender((x) => !x); 
  }, []);

  const handleLogin = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError("");
      setLoading(true);

      const ctrl = new AbortController();

      try {
        const { data: authData } = await api.post(
          "/login/",
          {
            user_id: form.id,
            password: form.password,
          },
          { signal: ctrl.signal }
        );

        if (!authData?.token) {
          setError("Invalid user ID or password.");
          return;
        }

        const activeRoles = authData.roles
          .filter((r: any) => r.status?.toLowerCase() === "active")
          .map((r: any) => r.role_name?.toLowerCase());

        if (!activeRoles.includes("admin")) {
          setError("Access denied. Only admins can log in.");
          return;
        }

        const profileData = {
          user_id: authData.user_id,
          email_address: authData.email,
          first_name: authData.first_name,
          last_name: authData.last_name,
          token: authData.token,
          roles: authData.roles,
        };

        (rememberMe ? localStorage : sessionStorage).setItem(
          "user",
          JSON.stringify(profileData)
        );

        navigate("/admin-dashboard");
      } catch (err: any) {
        console.error("Unexpected error:", err);
        setError(
          err.response?.data?.message || "Invalid user ID or password."
        );
      } finally {
        setLoading(false);
      }

      return () => ctrl.abort();
    },
    [form, rememberMe, navigate]
  );

  return (
    <div className="main-container">
      <div className="left-panel">
        <div className="e-graphic"></div>
      </div>

      <div className="right-panel">
        <div className="header-section">
          <div className="greeting">
            <p>Hello Admin!</p>
            <p className="good-morning">{getGreeting()}</p>
          </div>
          <div className="logo">
            <img src="../../static/logo/Exam.png" alt="ExamSync Logo" />
          </div>
        </div>

        <div className="login-section">
          <h2>
            Login as <span className="faculty-text">Admin</span>
          </h2>

          <form className="login-form" onSubmit={handleLogin}>
            <div className="input-group">
              <label htmlFor="id">Admin ID</label>
              <input
                type="text"
                id="id"
                placeholder="Admin ID"
                value={form.id}
                onChange={handleChange}
                className="login-input"
                required
              />
            </div>

            <div className="input-group password-group">
              <label htmlFor="password">Password</label>
              <div className="password-wrapper">
                <input
                  type={showPasswordRef.current ? "text" : "password"}
                  id="password"
                  placeholder="Password"
                  value={form.password}
                  onChange={handleChange}
                  className="login-input"
                  required
                />
                <span className="toggle-password" onClick={togglePassword}>
                  {showPasswordRef.current ? <FaEyeSlash /> : <FaEye />}
                </span>
              </div>
            </div>

            <div className="form-error-row">
              <span className={`error-text ${error ? '' : 'hidden'}`}>
                {error || '‎'}
              </span>
            </div>

            <div className="remember-me-container">
              <input
                type="checkbox"
                id="rememberMe"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              <label htmlFor="rememberMe">Remember me</label>
            </div>

            <button type="submit" className="login-button" disabled={loading}>
              {loading ? <span className="spinner"></span> : "Login"}
            </button>
          </form>
        </div>

        <div className="admin-login-link">
          <button
            type="button"
            className="admin-login-btn"
            onClick={() => navigate("/")}
          >
            Sign in as Faculty
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginAdmin;
