// deno-lint-ignore-file no-explicit-any
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/apiClient.ts';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import '../styles/loginAdmin.css';

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
};

const LoginAdmin: React.FC = () => {
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
      // 1️⃣ Authenticate with user_id and password
      const { data: authData } = await api.post('/login/', {
        user_id: id,  // Changed from email to user_id
        password,
      });

      if (!authData?.token) {
        setError('Invalid user ID or password.');
        return;
      }

      // 2️⃣ Check if user has admin role
      const activeRoles = authData.roles
        .filter((r: any) => r.status?.toLowerCase() === 'active')
        .map((r: any) => r.role_name?.toLowerCase());

      if (!activeRoles.includes('admin')) {
        setError('Access denied. Only admins can log in.');
        return;
      }

      // 3️⃣ Store user session
      const profileWithToken = { 
        user_id: authData.user_id,
        email_address: authData.email,
        first_name: authData.first_name,
        last_name: authData.last_name,
        token: authData.token, 
        roles: authData.roles 
      };
      
      if (rememberMe) {
        localStorage.setItem('user', JSON.stringify(profileWithToken));
      } else {
        sessionStorage.setItem('user', JSON.stringify(profileWithToken));
      }

      // 4️⃣ Navigate to admin dashboard
      navigate('/admin-dashboard');
    } catch (err: any) {
      console.error('Unexpected error:', err);
      setError(err.response?.data?.message || 'Invalid user ID or password.');
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
            <p>Hello Admin!</p>
            <p className="good-morning">{greeting}</p>
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
              <label htmlFor="ID">Admin ID</label>
              <input
                type="text"
                id="ID"
                placeholder="Admin ID"
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
            onClick={() => navigate('/')}
          >
            Sign in as Faculty
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginAdmin;
