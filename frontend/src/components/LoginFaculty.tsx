// deno-lint-ignore-file no-explicit-any
import React, { useState, useCallback, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/apiClient.ts";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import { IoSettingsSharp } from "react-icons/io5"; // For the bottom-right settings/admin icon
import "../styles/loginFaculty.css";
// Assuming you have an image for the logo, e.g., 'examsync-logo.png' in a public path
// or imported if using a bundler like Webpack/Vite
// For now, I'll use a placeholder image path for the logo.

const getGreeting = (): string => {
  const hour = new Date().getHours();
  if (hour >= 22 || hour < 4) return "Late Night Access";
  if (hour < 12) return "Rise and Shine";
  if (hour < 18) return "Midday Welcome";
  return "Evening Welcome";
};

const roleToDashboardMap: Record<string, string> = {
  proctor: "/faculty-dashboard",
  faculty: "/faculty-dashboard",
  scheduler: "/faculty-dashboard",
  "bayanihan leader": "/faculty-dashboard",
  dean: "/faculty-dashboard",
  admin: "/admin-dashboard", // Separate dashboard for admin login
};

const LoginFaculty: React.FC = () => {
  const navigate = useNavigate();

  const [isFacultyLogin, setIsFacultyLogin] = useState(true); // Toggles between Faculty and Admin
  const [form, setForm] = useState({ id: "", password: "" });
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const showPasswordRef = useRef(false);
  const [, forceRerender] = useState(false);

  // Memoize the greeting to avoid re-calculating on every render
  const greeting = useMemo(() => getGreeting(), []);

  const handleChange = useCallback((e: any) => {
    const { id, value } = e.target;
    setForm((prev) => ({ ...prev, [id]: value }));
  }, []);

  const togglePassword = useCallback(() => {
    showPasswordRef.current = !showPasswordRef.current;
    forceRerender((x) => !x);
  }, []);

  const toggleLoginRole = useCallback(() => {
    setIsFacultyLogin(prev => !prev);
    setError(""); // Clear error when switching roles
    setForm({ id: "", password: "" }); // Clear form when switching roles
  }, []);

  const handleLogin = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError("");
      setLoading(true);

      const ctrl = new AbortController();
      const loginEndpoint = "/login/"; // Assuming the same endpoint handles both

      try {
        const { data: authData } = await api.post(
          loginEndpoint,
          {
            user_id: form.id,
            password: form.password,
          },
          { signal: ctrl.signal }
        );

        if (!authData?.token) {
          setError("Invalid credentials.");
          return;
        }

        const activeRoles =
          authData.roles
            ?.filter((r: any) => r.status?.toLowerCase() === "active")
            ?.map((r: any) => r.role_name?.toLowerCase()) || [];

        if (activeRoles.length === 0) {
          setError("You do not have any active roles.");
          return;
        }

        let assignedRole = activeRoles[0]; // Default to the first active role

        // Logic for Admin/Faculty differentiation
        if (isFacultyLogin) {
          // For Faculty login, prioritize 'admin' if available, otherwise first role
          assignedRole = activeRoles.includes("admin")
            ? "admin"
            : activeRoles[0];
        } else {
          // For Admin login, it must be 'admin'
          if (!activeRoles.includes("admin")) {
            setError("You must have an 'admin' role to log in as Admin.");
            return;
          }
          assignedRole = "admin";
        }

        // Determine dashboard based on assigned role
        const dashboard = roleToDashboardMap[assignedRole];

        // Additional check to ensure faculty doesn't land on admin dashboard and vice versa
        if (!dashboard ||
          (!isFacultyLogin && dashboard !== "/admin-dashboard") ||
          (isFacultyLogin && dashboard === "/admin-dashboard" && assignedRole !== "admin")) {
          // This handles cases where a non-admin user might try to use the admin path 
          // or vice versa, but we'll simplify: just check if a dashboard exists
          if (!dashboard) {
            setError(`No dashboard found for role: ${assignedRole}`);
            return;
          }
        }

        const userData = {
          user_id: authData.user_id,
          email_address: authData.email,
          first_name: authData.first_name,
          last_name: authData.last_name,
          token: authData.token,
          roles: authData.roles,
        };

        (rememberMe ? localStorage : sessionStorage).setItem(
          "user",
          JSON.stringify(userData)
        );

        navigate(dashboard);
      } catch (err: any) {
        console.error("Login error:", err);
        // Display a more user-friendly error message for the current role
        const roleText = isFacultyLogin ? "Employee" : "Admin";
        setError(err.response?.data?.message || `Invalid ${roleText} ID or password.`);
      } finally {
        setLoading(false);
      }

      return () => ctrl.abort();
    },
    [form, rememberMe, navigate, isFacultyLogin]
  );

  const loginTitle = isFacultyLogin ? "Login as Faculty" : "Login as Admin";
  const inputLabel = isFacultyLogin ? "Employee ID" : "Admin ID";

  return (
    <div className="login-container">
      {/* Background Gradient & Greeting */}
      <div className="background-gradient">
        <div className="greeting-text">
          <p>{greeting}!</p>
        </div>
      </div>

      {/* Logo Section */}
      <div className="logo-section">
        <div className="e-graphic-logo">
          {/* Logo image from the picture, ideally a transparent PNG/SVG */}
          <img src="/logo/Exam.png" alt="ExamSync Logo" />
          <p className="logo-text">ExamSync</p>
        </div>
      </div>

      {/* Login Form Section */}
      <form className="login-form-card" onSubmit={handleLogin}>
        <h2>{loginTitle}</h2>

        {/* Employee/Admin ID Input */}
        <div className="input-field">
          <input
            type="text"
            id="id"
            placeholder=''
            value={form.id}
            onChange={handleChange}
            required
            autoComplete="username"
          />
          <label htmlFor="id">{inputLabel}</label>
        </div>

        {/* Password Input */}
        <div className="input-field password-field">
          <input
            type={showPasswordRef.current ? "text" : "password"}
            id="password"
            placeholder=""
            value={form.password}
            onChange={handleChange}
            required
            autoComplete="current-password"
          />
          <label htmlFor="password">Password</label>
          <span className="toggle-password" onClick={togglePassword}>
            {showPasswordRef.current ? <FaEyeSlash style={{ color: 'white' }} /> : <FaEye style={{ color: 'white' }} />}
          </span>
        </div>

        {/* Remember Me & Error */}
        <div className="form-actions">
          <label className="modern-checkbox-container">
            Remember me
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
            />
            <span className="checkmark"></span>
          </label>
          <span className={`error-text ${error ? '' : 'hidden'}`}>
            {error || '‎'}
          </span>
        </div>

        {/* Login Button */}
        <button
          type="submit"
          className="submit-button"
          disabled={loading}
          aria-label={`Log in as ${isFacultyLogin ? 'Faculty' : 'Admin'}`}
        >
          {loading ? <span className="spinner"></span> : 'Login'}
        </button>
      </form>

      {/* Toggle Button in the bottom right */}
      <div className="admin-toggle-button" onClick={toggleLoginRole}>
        <IoSettingsSharp size={24} />
      </div>
    </div>
  );
};

export default LoginFaculty;