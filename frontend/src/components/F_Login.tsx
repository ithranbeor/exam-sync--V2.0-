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
  proctor:            "/faculty-dashboard",
  faculty:            "/faculty-dashboard",
  scheduler:          "/faculty-dashboard",
  "bayanihan leader": "/faculty-dashboard",
  dean:               "/faculty-dashboard",
  admin:              "/admin-dashboard",
};

const UnifiedLogin: React.FC = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({ id: "", password: "" });
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
          setError("No active roles are assigned to this account.");
          return;
        }

        const userData = {
          user_id:       authData.user_id,
          email_address: authData.email,
          first_name:    authData.first_name,
          last_name:     authData.last_name,
          token:         authData.token,
          roles:         authData.roles,
        };

        const storage = rememberMe ? localStorage : sessionStorage;
        storage.setItem("user", JSON.stringify(userData));

        // Route by first active role (admin takes priority)
        const primaryRole = activeRoles.includes("admin")
          ? "admin"
          : activeRoles[0];

        const dashboard = roleToDashboardMap[primaryRole] ?? "/faculty-dashboard";
        navigate(dashboard);

      } catch (err: any) {
        setError(
          err.response?.data?.message ?? "Invalid ID or password. Please try again."
        );
      } finally {
        setLoading(false);
      }

      return () => ctrl.abort();
    },
    [form, rememberMe, navigate]
  );

  return (
    <div className="ul-root">
      {/* Split background */}
      <div className="ul-bg">
        <div
          className="ul-bg__left"
          style={{ backgroundImage: `url('/logo/CITC.jpg')` }}
        >
          <div className="ul-bg__pattern" />
          <div className="ul-bg__arc" />
          <div className="ul-bg__arc ul-bg__arc--2" />
        </div>
        <div className="ul-bg__right" />
      </div>

      {/* Brand panel — left side */}
      <div className="ul-brand">
        <div className="ul-brand__lockup">
          <img src="/logo/Exam.png" alt="ExamSync" className="ul-brand__img" />
          <span className="ul-brand__name">ExamSync V2</span>
        </div>

        <h1 className="ul-brand__tagline">
          Smart exams,<br />
          <em>seamless</em> results.
        </h1>
        <p className="ul-brand__sub">
          Streamline your institution's examination process — from scheduling and proctoring to results management — all in one secure platform.
        </p>

        <div className="ul-brand__dots">
          <div className="ul-brand__dot ul-brand__dot--gold" />
          <div className="ul-brand__dot" />
          <div className="ul-brand__dot" />
        </div>
      </div>

      {/* Greeting pill */}
      <div className="ul-greeting">
        <span className="ul-greeting__wave">👋</span>
        <span>{greeting}!</span>
      </div>

      {/* Login card */}
      <div className="ul-card ul-card--enter">
        {/* Logo */}
        <div className="ul-card-logo">
          <img src="/logo/Exam.png" alt="ExamSync" className="ul-card-logo__img" />
          <span className="ul-card-logo__name">ExamSync V2</span>
        </div>

        <div className="ul-divider" />

        <h2 className="ul-title">Sign In</h2>
        <p className="ul-subtitle">Enter your credentials.</p>

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
              Employee / Admin ID
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
              aria-label={showPasswordRef.current ? "Hide password" : "Show password"}
            >
              {showPasswordRef.current ? <FaEyeSlash /> : <FaEye />}
            </button>
          </div>

          {/* Error */}
          <div className={`ul-error ${error ? "ul-error--visible" : ""}`} role="alert">
            <span className="ul-error__icon" aria-hidden="true">!</span>
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
              <svg viewBox="0 0 12 10" fill="none" aria-hidden="true">
                <polyline
                  points="1,5 4,8 11,1"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            <span className="ul-remember__label">Keep me signed in</span>
          </label>

          {/* Submit */}
          <button
            type="submit"
            className="ul-submit"
            disabled={loading}
          >
            {loading ? (
              <span className="ul-submit__spinner" aria-label="Signing in…" />
            ) : (
              <>
                <span>Sign In</span>
              </>
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="ul-footer">
          <span className="ul-footer__text">© 2025 ExamSync V2</span>
          <span className="ul-footer__dev">Developed by Ithran Beor Turno</span>
        </div>
      </div>

      {/* Version tag */}
      <div className="ul-version">v2.0</div>
    </div>
  );
};

export default UnifiedLogin;