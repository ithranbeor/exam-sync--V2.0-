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
  admin: '/admin-login',
};

const LoginFaculty: React.FC = () => {
  const [greeting, setGreeting] = useState(getGreeting());
  const [id, setID] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [availableRoles, setAvailableRoles] = useState<string[]>([]);
  const [selectedRole, setSelectedRole] = useState('');
  const [userProfile, setUserProfile] = useState<any>(null);
  const [awaitingRoleSelection, setAwaitingRoleSelection] = useState(false);
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
      // 1️⃣ Lookup user by ID
      const { data: userRecord } = await api.get(`/users/${id}/`);
      if (!userRecord?.email_address || !userRecord?.status) {
        setError('Invalid user ID or password.');
        return;
      }

      // 2️⃣ Authenticate
      const { data: authData } = await api.post('/login/', {
        email: userRecord.email_address,
        password,
      });

      if (!authData?.token) {
        setError('Invalid user ID or password.');
        return;
      }

      // 3️⃣ Fetch user roles
      const { data: userRoles } = await api.get(`/user-roles/${id}/roles/`, {
        headers: { Authorization: `Bearer ${authData.token}` },
      });

      if (!userRoles || userRoles.length === 0) {
        setError('No roles found. Unauthorized access.');
        return;
      }

      const activeRoles = userRoles
        .filter((r: any) => r.status?.toLowerCase() === 'active')
        .map((r: any) => r.role_name?.toLowerCase());

      if (activeRoles.length === 0) {
        setError('You do not have any active roles.');
        return;
      }

      const rolesExcludingAdmin = activeRoles.filter((role: any) => role !== 'admin');

      const profileWithToken = { ...userRecord, token: authData.token };

      // Handle login based on roles
      if (rolesExcludingAdmin.length === 0 && activeRoles.includes('admin')) {
        completeLogin('admin', profileWithToken);
        return;
      }

      if (rolesExcludingAdmin.length === 1) {
        completeLogin(rolesExcludingAdmin[0], profileWithToken);
        return;
      }

      if (rolesExcludingAdmin.length >= 2) {
        completeLogin('faculty', profileWithToken);
        return;
      }

      // Multiple roles, let user select
      setAvailableRoles(rolesExcludingAdmin);
      setUserProfile(profileWithToken);
      setAwaitingRoleSelection(true);

    } catch (err: any) {
      console.error('Unexpected error:', err);
      setError(err.response?.data?.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const completeLogin = (role: string, profile: any) => {
    const payload = { ...profile, roles: [{ role_name: role }] };
    if (rememberMe) {
      localStorage.setItem('user', JSON.stringify(payload));
    } else {
      sessionStorage.setItem('user', JSON.stringify(payload));
    }

    const dashboard = roleToDashboardMap[role];
    if (!dashboard) {
      setError(`No dashboard assigned for role: ${role}`);
      return;
    }

    navigate(dashboard);
  };

  const handleRoleSelection = () => {
    if (!selectedRole) {
      setError('Please select a role.');
      return;
    }
    completeLogin(selectedRole, userProfile);
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
            <img src="../../../backend/static/logo/Exam.png" alt="ExamSync Logo" />
          </div>
        </div>

        <div className="login-section">
          <h2>
            Login as <span className="faculty-text">Faculty</span>
          </h2>

          {!awaitingRoleSelection ? (
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
          ) : (
            <div className="role-selection">
              <label htmlFor="role">Select Role</label>
              <select
                id="role"
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="login-input"
              >
                <option value="">-- Choose Role --</option>
                {availableRoles.map((role) => (
                  <option key={role} value={role}>
                    {role.charAt(0).toUpperCase() + role.slice(1)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="login-button"
                onClick={handleRoleSelection}
                disabled={loading}
              >
                {loading ? <span className="spinner"></span> : 'Login'}
              </button>
              {error && <p className="error-text">{error}</p>}
            </div>
          )}
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
