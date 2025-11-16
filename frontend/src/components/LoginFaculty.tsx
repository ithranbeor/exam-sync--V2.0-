// deno-lint-ignore-file no-explicit-any
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/apiClient.ts';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import '../styles/loginFaculty.css';

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
};

const roleToDashboardMap: Record<string, string> = {
  proctor: '/faculty-dashboard',
  faculty: '/faculty-dashboard',
  scheduler: '/faculty-dashboard',
  'bayanihan leader': '/faculty-dashboard',
  dean: '/faculty-dashboard',
  admin: '/faculty-dashboard',
};

const LoginFaculty: React.FC = () => {
  const [greeting, setGreeting] = useState(getGreeting());
  const [id, setID] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const interval = setInterval(() => setGreeting(getGreeting()), 60000);
    return () => clearInterval(interval);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // ✅ Direct authentication with user_id and password
      const { data: authData } = await api.post('/login/', {
        user_id: id,
        password,
      });

      if (!authData?.token) {
        setError('Invalid credentials.');
        return;
      }

      // ✅ Check if user has at least one active role
      const activeRoles = authData.roles
        ?.filter((r: any) => r.status?.toLowerCase() === 'active')
        ?.map((r: any) => r.role_name?.toLowerCase()) || [];

      if (activeRoles.length === 0) {
        setError('You do not have any active roles.');
        return;
      }

      // ✅ Determine dashboard - prioritize admin role if present
      const assignedRole = activeRoles.includes('admin') 
        ? 'admin' 
        : activeRoles[0];

      const dashboard = roleToDashboardMap[assignedRole];
      if (!dashboard) {
        setError(`No dashboard found for role: ${assignedRole}`);
        return;
      }

      // ✅ Store session with complete user data
      const userData = {
        user_id: authData.user_id,
        email_address: authData.email,
        first_name: authData.first_name,
        last_name: authData.last_name,
        token: authData.token,
        roles: authData.roles,
      };

      if (rememberMe) {
        localStorage.setItem('user', JSON.stringify(userData));
      } else {
        sessionStorage.setItem('user', JSON.stringify(userData));
      }

      // ✅ Navigate to dashboard
      navigate(dashboard);
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.response?.data?.message || 'Invalid employee ID or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="main-container">
      <div className="left-panel">
        <div className="e-graphic"></div>
      </div>

      <div className="right-panel">
        <div className="header-section">
          <div className="greeting">
            <p>Hello!</p>
            <p className="good-morning">{greeting}</p>
          </div>
          <div className="logo">
            <img src="../../static/logo/Exam.png" alt="ExamSync Logo" />
          </div>
        </div>

        <div className="login-section">
          <h2>
            Login as <span className="faculty-text">Faculty</span>
          </h2>

          <form className="login-form" onSubmit={handleLogin}>
            <div className="input-group">
              <label htmlFor="ID">Employee ID</label>
              <input
                type="text"
                id="ID"
                placeholder="ID"
                value={id}
                onChange={(e) => setID(e.target.value)}
                className="login-input"
                required
              />
            </div>

            <div className="input-group password-group">
              <label htmlFor="password">Password</label>
              <div className="password-wrapper">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="login-input"
                  required
                />
                <span
                  className="toggle-password"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <FaEyeSlash /> : <FaEye />}
                </span>
              </div>
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

            {error && <p className="error-text">{error}</p>}

            <button type="submit" className="login-button" disabled={loading}>
              {loading ? <span className="spinner"></span> : 'Login'}
            </button>
          </form>
        </div>

        <div className="admin-login-link">
          <button
            type="button"
            className="admin-login-btn"
            onClick={() => navigate('/admin-login')}
          >
            Sign in as Admin
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginFaculty;