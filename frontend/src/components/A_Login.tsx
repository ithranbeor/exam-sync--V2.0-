// deno-lint-ignore-file no-explicit-any
import React, { useState, useCallback, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/apiClient.ts";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import "../styles/F_login.css";

const getGreeting = (): string => {
  const hour = new Date().getHours();
  if (hour >= 22 || hour < 4) return "Late Night";
  if (hour < 12) return "Good Morning";
  if (hour < 18) return "Good Afternoon";
  return "Good Evening";
};

const roleToDashboardMap: Record<string, string> = {
  proctor: "/faculty-dashboard",
  faculty: "/faculty-dashboard",
  scheduler: "/faculty-dashboard",
  "bayanihan leader": "/faculty-dashboard",
  dean: "/faculty-dashboard",
  admin: "/admin-dashboard",
};

type LoginMode = "faculty" | "admin";

const UnifiedLogin: React.FC = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<LoginMode>("faculty");
  const [form, setForm] = useState({ id: "", password: "" });
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [animating, setAnimating] = useState(false);

  const showPasswordRef = useRef(false);
  const [, forceRerender] = useState(false);
  const greeting = useMemo(() => getGreeting(), []);

  const handleChange = useCallback((e: any) => {
    const { id, value } = e.target;
    setForm((prev) => ({ ...prev, [id]: value }));
  }, []);

  const togglePassword = useCallback(() => {
    showPasswordRef.current = !showPasswordRef.current;
    forceRerender((x) => !x);
  }, []);

  const switchMode = useCallback(
    (newMode: LoginMode) => {
      if (newMode === mode || animating) return;
      setAnimating(true);
      setTimeout(() => {
        setMode(newMode);
        setError("");
        setForm({ id: "", password: "" });
        setAnimating(false);
      }, 300);
    },
    [mode, animating]
  );

  const handleLogin = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError("");
      setLoading(true);
      const ctrl = new AbortController();

      try {
        const { data: authData } = await api.post(
          "/login/",
          { user_id: form.id, password: form.password },
          { signal: ctrl.signal }
        );

        if (!authData?.token) {
          setError("Invalid credentials. Please try again.");
          return;
        }

        const activeRoles: string[] =
          authData.roles
            ?.filter((r: any) => r.status?.toLowerCase() === "active")
            ?.map((r: any) => r.role_name?.toLowerCase()) ?? [];

        if (activeRoles.length === 0) {
          setError("No active roles assigned to this account.");
          return;
        }

        const userData = {
          user_id: authData.user_id,
          email_address: authData.email,
          first_name: authData.first_name,
          last_name: authData.last_name,
          token: authData.token,
          roles: authData.roles,
        };

        const storage = rememberMe ? localStorage : sessionStorage;

        if (mode === "admin") {
          // Admin tab: must have admin role
          if (!activeRoles.includes("admin")) {
            setError("Admin access denied. Your account has no admin role.");
            return;
          }
          storage.setItem("user", JSON.stringify(userData));
          navigate("/admin-dashboard");
        } else {
          // Faculty tab: accepts any role.
          // If the user ONLY has admin and no other role, still let them in
          // but land them on the admin dashboard (they chose wrong tab).
          const nonAdminRoles = activeRoles.filter((r) => r !== "admin");

          if (nonAdminRoles.length === 0) {
            // Pure admin account logged in via Faculty tab → redirect to admin
            storage.setItem("user", JSON.stringify(userData));
            navigate("/admin-dashboard");
            return;
          }

          // Pick the first non-admin role for dashboard routing
          const primaryRole = nonAdminRoles[0];
          const dashboard = roleToDashboardMap[primaryRole] ?? "/faculty-dashboard";
          storage.setItem("user", JSON.stringify(userData));
          navigate(dashboard);
        }
      } catch (err: any) {
        const roleLabel = mode === "admin" ? "Admin" : "Employee";
        setError(
          err.response?.data?.message ?? `Invalid ${roleLabel} ID or password.`
        );
      } finally {
        setLoading(false);
      }

      return () => ctrl.abort();
    },
    [form, rememberMe, navigate, mode]
  );

  return (
    <div className="ul-root">
      {/* Animated background */}
      <div className={`ul-bg ul-bg--${mode}`}>
        <div className="ul-bg__orb ul-bg__orb--1" />
        <div className="ul-bg__orb ul-bg__orb--2" />
        <div className="ul-bg__orb ul-bg__orb--3" />
        <div className="ul-grid-overlay" />
      </div>

      {/* Greeting pill top-left */}
      <div className="ul-greeting">
        <span className="ul-greeting__wave">👋</span>
        <span>{greeting}!</span>
      </div>

      {/* Center card */}
      <div className={`ul-card ${animating ? "ul-card--exit" : "ul-card--enter"}`}>
        {/* Logo */}
        <div className="ul-logo">
          <img src="/logo/Exam.png" alt="ExamSync" className="ul-logo__img" />
          <span className="ul-logo__name">ExamSync</span>
        </div>

        {/* Mode toggle tabs */}
        <div className="ul-tabs">
          <button
            type="button"
            className={`ul-tab ${mode === "faculty" ? "ul-tab--active" : ""}`}
            onClick={() => switchMode("faculty")}
          >
            <span className="ul-tab__dot" />
            Faculty
          </button>
          <button
            type="button"
            className={`ul-tab ${mode === "admin" ? "ul-tab--active" : ""}`}
            onClick={() => switchMode("admin")}
          >
            <span className="ul-tab__dot" />
            Admin
          </button>
          <div className={`ul-tabs__slider ul-tabs__slider--${mode}`} />
        </div>

        {/* Title */}
        <h2 className="ul-title">
          {mode === "faculty" ? "Faculty Login" : "Admin Login"}
        </h2>
        <p className="ul-subtitle">
          {mode === "faculty"
            ? "Sign in with your employee credentials"
            : "Sign in with your administrator credentials"}
        </p>

        {/* Form */}
        <form className="ul-form" onSubmit={handleLogin}>
          <div className="ul-field">
            <input
              type="text"
              id="id"
              value={form.id}
              onChange={handleChange}
              placeholder=" "
              required
              autoComplete="username"
              className="ul-field__input"
            />
            <label htmlFor="id" className="ul-field__label">
              {mode === "faculty" ? "Employee ID" : "Admin ID"}
            </label>
            <div className="ul-field__bar" />
          </div>

          <div className="ul-field ul-field--password">
            <input
              type={showPasswordRef.current ? "text" : "password"}
              id="password"
              value={form.password}
              onChange={handleChange}
              placeholder=" "
              required
              autoComplete="current-password"
              className="ul-field__input"
            />
            <label htmlFor="password" className="ul-field__label">
              Password
            </label>
            <div className="ul-field__bar" />
            <button
              type="button"
              className="ul-field__eye"
              onClick={togglePassword}
              tabIndex={-1}
            >
              {showPasswordRef.current ? <FaEyeSlash /> : <FaEye />}
            </button>
          </div>

          {/* Error */}
          <div className={`ul-error ${error ? "ul-error--visible" : ""}`}>
            <span className="ul-error__icon">!</span>
            {error}
          </div>

          {/* Remember me */}
          <label className="ul-remember">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="ul-remember__input"
            />
            <span className="ul-remember__box">
              <svg viewBox="0 0 12 10" fill="none">
                <polyline
                  points="1,5 4,8 11,1"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            <span className="ul-remember__label">Remember me</span>
          </label>

          {/* Submit */}
          <button
            type="submit"
            className={`ul-submit ul-submit--${mode}`}
            disabled={loading}
          >
            {loading ? (
              <span className="ul-submit__spinner" />
            ) : (
              <span>Sign In</span>
            )}
          </button>
        </form>
      </div>

      {/* Version tag */}
      <div className="ul-version">ExamSync v2.0</div>
    </div>
  );
};

export default UnifiedLogin;