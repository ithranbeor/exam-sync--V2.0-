// LoginPage.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/apiClient.ts';

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please fill in all fields.');
      return;
    }
    setError('');
    setIsLoading(true);

    try {
      const res = await api.post('/login/', { email, password });
      const userData = res.data;

      // Persist user session
      localStorage.setItem('user', JSON.stringify(userData));

      // Route by role
      const roles: string[] = (userData.roles || []).map((r: any) =>
        (r.role_name || r).toLowerCase()
      );

      if (roles.includes('admin')) {
        navigate('/admin-dashboard');
      } else {
        navigate('/dashboard');
      }
    } catch (err: any) {
      setError(
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        'Invalid email or password. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .lp-root {
          min-height: 100vh;
          display: flex;
          font-family: 'Sora', sans-serif;
          background: #f0f4f8;
        }

        /* ── Left panel ── */
        .lp-left {
          flex: 1;
          background: #092C4C;
          position: relative;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 48px 52px;
          overflow: hidden;
          min-height: 100vh;
        }

        /* Geometric accent shapes */
        .lp-shape {
          position: absolute;
          border-radius: 50%;
          pointer-events: none;
        }
        .lp-shape-1 {
          width: 480px; height: 480px;
          background: radial-gradient(circle, rgba(242,153,74,0.18) 0%, transparent 70%);
          top: -120px; right: -140px;
        }
        .lp-shape-2 {
          width: 320px; height: 320px;
          background: radial-gradient(circle, rgba(255,255,255,0.05) 0%, transparent 70%);
          bottom: 60px; left: -80px;
        }
        .lp-shape-3 {
          width: 140px; height: 140px;
          background: rgba(242,153,74,0.12);
          bottom: 180px; right: 60px;
          border-radius: 28px;
          transform: rotate(22deg);
        }

        /* Grid overlay */
        .lp-grid {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
          background-size: 48px 48px;
          pointer-events: none;
        }

        /* Brand */
        .lp-brand {
          display: flex;
          align-items: center;
          gap: 14px;
          position: relative;
          z-index: 1;
        }
        .lp-brand-logo {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          object-fit: cover;
          border: 2px solid rgba(242,153,74,0.4);
        }
        .lp-brand-name {
          font-size: 22px;
          font-weight: 800;
          color: #fff;
          letter-spacing: -0.5px;
        }
        .lp-brand-name span {
          color: #F2994A;
        }

        /* Hero copy */
        .lp-hero {
          position: relative;
          z-index: 1;
        }
        .lp-hero-tag {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: rgba(242,153,74,0.15);
          border: 1px solid rgba(242,153,74,0.3);
          border-radius: 20px;
          padding: 5px 14px;
          font-size: 11px;
          font-weight: 600;
          color: #F2994A;
          letter-spacing: 1px;
          text-transform: uppercase;
          margin-bottom: 24px;
          font-family: 'JetBrains Mono', monospace;
        }
        .lp-hero-tag::before {
          content: '';
          width: 6px; height: 6px;
          border-radius: 50%;
          background: #F2994A;
        }
        .lp-hero h1 {
          font-size: clamp(32px, 3.5vw, 48px);
          font-weight: 800;
          color: #fff;
          line-height: 1.1;
          letter-spacing: -1.5px;
          margin-bottom: 18px;
        }
        .lp-hero h1 span {
          color: #F2994A;
        }
        .lp-hero p {
          font-size: 15px;
          color: rgba(255,255,255,0.55);
          line-height: 1.7;
          max-width: 380px;
        }

        /* Stats row */
        .lp-stats {
          display: flex;
          gap: 32px;
          position: relative;
          z-index: 1;
          padding-top: 40px;
          border-top: 1px solid rgba(255,255,255,0.1);
        }
        .lp-stat-item {}
        .lp-stat-num {
          font-size: 26px;
          font-weight: 800;
          color: #F2994A;
          font-family: 'JetBrains Mono', monospace;
          line-height: 1;
        }
        .lp-stat-label {
          font-size: 11px;
          color: rgba(255,255,255,0.4);
          margin-top: 4px;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        /* ── Right panel ── */
        .lp-right {
          width: 480px;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 48px 52px;
          background: #fff;
          position: relative;
        }

        .lp-form-wrap {
          width: 100%;
          max-width: 360px;
          animation: lp-fadein 0.5s ease both;
        }

        @keyframes lp-fadein {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .lp-form-header {
          margin-bottom: 36px;
        }
        .lp-form-header h2 {
          font-size: 28px;
          font-weight: 800;
          color: #092C4C;
          letter-spacing: -0.8px;
          margin-bottom: 6px;
        }
        .lp-form-header p {
          font-size: 13.5px;
          color: #8A9BB0;
        }

        /* Form fields */
        .lp-field {
          margin-bottom: 18px;
        }
        .lp-field label {
          display: block;
          font-size: 12px;
          font-weight: 700;
          color: #4B5E72;
          margin-bottom: 7px;
          letter-spacing: 0.3px;
          text-transform: uppercase;
        }
        .lp-input-wrap {
          position: relative;
        }
        .lp-input-icon {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          color: #B0BFCC;
          pointer-events: none;
          display: flex;
          align-items: center;
        }
        .lp-input {
          width: 100%;
          padding: 13px 14px 13px 42px;
          border: 1.5px solid #DDE3EC;
          border-radius: 10px;
          font-size: 14px;
          font-family: 'Sora', sans-serif;
          color: #0C1B2A;
          background: #F8FAFB;
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
        }
        .lp-input:focus {
          border-color: #092C4C;
          background: #fff;
          box-shadow: 0 0 0 3px rgba(9,44,76,0.08);
        }
        .lp-input::placeholder { color: #B0BFCC; }
        .lp-toggle-pw {
          position: absolute;
          right: 14px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          cursor: pointer;
          color: #B0BFCC;
          display: flex;
          align-items: center;
          padding: 2px;
          transition: color 0.15s;
        }
        .lp-toggle-pw:hover { color: #092C4C; }

        /* Error */
        .lp-error {
          display: flex;
          align-items: center;
          gap: 8px;
          background: #FEF2F2;
          border: 1px solid rgba(192,57,43,0.2);
          border-radius: 8px;
          padding: 10px 14px;
          font-size: 12.5px;
          color: #C0392B;
          margin-bottom: 18px;
          animation: lp-fadein 0.25s ease both;
        }

        /* Submit */
        .lp-submit {
          width: 100%;
          padding: 14px;
          background: #092C4C;
          color: #fff;
          border: none;
          border-radius: 10px;
          font-size: 14.5px;
          font-weight: 700;
          font-family: 'Sora', sans-serif;
          cursor: pointer;
          transition: background 0.18s, transform 0.12s, box-shadow 0.18s;
          margin-top: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          box-shadow: 0 4px 16px rgba(9,44,76,0.22);
          letter-spacing: -0.2px;
        }
        .lp-submit:hover:not(:disabled) {
          background: #0A3765;
          transform: translateY(-1px);
          box-shadow: 0 8px 24px rgba(9,44,76,0.28);
        }
        .lp-submit:active:not(:disabled) { transform: translateY(0); }
        .lp-submit:disabled { opacity: 0.55; cursor: not-allowed; }

        /* Spinner */
        .lp-spinner {
          width: 16px; height: 16px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: lp-spin 0.7s linear infinite;
        }
        @keyframes lp-spin { to { transform: rotate(360deg); } }

        /* Divider */
        .lp-divider {
          display: flex;
          align-items: center;
          gap: 12px;
          margin: 22px 0;
          color: #D1D9E2;
          font-size: 11px;
          font-family: 'JetBrains Mono', monospace;
        }
        .lp-divider::before, .lp-divider::after {
          content: '';
          flex: 1;
          height: 1px;
          background: #EEF1F6;
        }

        /* Footer note */
        .lp-footer-note {
          margin-top: 28px;
          text-align: center;
          font-size: 11.5px;
          color: #B0BFCC;
          line-height: 1.6;
        }
        .lp-footer-note strong {
          color: #4B5E72;
          font-weight: 600;
        }

        /* ── Responsive ── */
        @media (max-width: 900px) {
          .lp-root { flex-direction: column; }
          .lp-left {
            min-height: auto;
            padding: 36px 32px 40px;
          }
          .lp-hero h1 { font-size: 28px; }
          .lp-stats { display: none; }
          .lp-right {
            width: 100%;
            padding: 40px 24px 48px;
          }
        }

        @media (max-width: 480px) {
          .lp-left { padding: 28px 22px 32px; }
          .lp-hero h1 { font-size: 24px; }
          .lp-right { padding: 32px 20px 40px; }
          .lp-form-header h2 { font-size: 22px; }
        }
      `}</style>

      <div className="lp-root">
        {/* ── Left panel ── */}
        <div className="lp-left">
          <div className="lp-grid" />
          <div className="lp-shape lp-shape-1" />
          <div className="lp-shape lp-shape-2" />
          <div className="lp-shape lp-shape-3" />

          <div className="lp-brand">
            <img src="/logo/Exam.png" alt="ExamSync Logo" className="lp-brand-logo" />
            <span className="lp-brand-name">Exam<span>Sync</span></span>
          </div>

          <div className="lp-hero">
            <div className="lp-hero-tag">Exam Management System</div>
            <h1>
              Coordinate exams<br />
              with <span>precision.</span>
            </h1>
            <p>
              Streamline scheduling, modality assignments, room management,
              and proctor coordination — all in one unified platform.
            </p>
          </div>

          <div className="lp-stats">
            <div className="lp-stat-item">
              <div className="lp-stat-num">100%</div>
              <div className="lp-stat-label">Automated</div>
            </div>
            <div className="lp-stat-item">
              <div className="lp-stat-num">4+</div>
              <div className="lp-stat-label">Role Types</div>
            </div>
            <div className="lp-stat-item">
              <div className="lp-stat-num">Real-time</div>
              <div className="lp-stat-label">Scheduling</div>
            </div>
          </div>
        </div>

        {/* ── Right panel ── */}
        <div className="lp-right">
          <div className="lp-form-wrap">
            <div className="lp-form-header">
              <h2>Welcome back</h2>
              <p>Sign in to your ExamSync account to continue</p>
            </div>

            <form onSubmit={handleLogin} noValidate>
              <div className="lp-field">
                <label htmlFor="lp-email">Email address</label>
                <div className="lp-input-wrap">
                  <span className="lp-input-icon">
                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </span>
                  <input
                    id="lp-email"
                    type="email"
                    className="lp-input"
                    placeholder="you@university.edu"
                    value={email}
                    onChange={e => { setEmail(e.target.value); setError(''); }}
                    autoComplete="email"
                    autoFocus
                  />
                </div>
              </div>

              <div className="lp-field">
                <label htmlFor="lp-password">Password</label>
                <div className="lp-input-wrap">
                  <span className="lp-input-icon">
                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </span>
                  <input
                    id="lp-password"
                    type={showPassword ? 'text' : 'password'}
                    className="lp-input"
                    placeholder="Enter your password"
                    value={password}
                    onChange={e => { setPassword(e.target.value); setError(''); }}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="lp-toggle-pw"
                    onClick={() => setShowPassword(v => !v)}
                    tabIndex={-1}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {error && (
                <div className="lp-error">
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2} style={{ flexShrink: 0 }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  {error}
                </div>
              )}

              <button type="submit" className="lp-submit" disabled={isLoading}>
                {isLoading ? (
                  <><div className="lp-spinner" /> Signing in…</>
                ) : (
                  <>
                    Sign in
                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </>
                )}
              </button>
            </form>

            <div className="lp-divider">secure access</div>

            <div className="lp-footer-note">
              Access is restricted to authorized university personnel only.<br />
              Contact your <strong>system administrator</strong> if you need an account.
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default LoginPage;