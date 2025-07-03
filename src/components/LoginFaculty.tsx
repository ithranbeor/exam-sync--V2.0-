// deno-lint-ignore-file no-explicit-any
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.ts';
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
  const navigate = useNavigate();

  useEffect(() => {
    const interval = setInterval(() => {
      setGreeting(getGreeting());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const { data: userRecord, error: userLookupError } = await supabase
        .from('tbl_users')
        .select('email_address, status')
        .eq('user_id', id)
        .single();

      if (userLookupError || !userRecord?.email_address) {
        setError('Invalid user ID or password.');
        return;
      }

      const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
        email: userRecord.email_address,
        password,
      });

      if (signInError || !authData.session) {
        setError('Invalid user ID or password.');
        return;
      }

      const { data: fullUser, error: profileError } = await supabase
        .from('tbl_users')
        .select('*')
        .eq('user_id', id)
        .single();

      if (profileError || !fullUser) {
        setError('Login succeeded, but failed to load user profile.');
        return;
      }

      const { data: userRoles, error: userRolesError } = await supabase
        .from('tbl_user_role')
        .select('status, roles:tbl_roles(role_name)')
        .eq('user_id', id);

      if (userRolesError || !userRoles || userRoles.length === 0) {
        setError('No roles found. Unauthorized access.');
        return;
      }

      const activeRoles = userRoles
        .filter((r: any) => r.status?.toLowerCase() === 'active')
        .map((r: any) => r.roles?.role_name?.toLowerCase());

      if (activeRoles.length === 0) {
        setError('You do not have any active roles.');
        return;
      }

      const rolesExcludingAdmin = activeRoles.filter((role) => role !== 'admin');

      // If only admin
      if (rolesExcludingAdmin.length === 0 && activeRoles.includes('admin')) {
        completeLogin('admin', fullUser);
        return;
      }

      // If only one role (excluding admin), go directly
      if (rolesExcludingAdmin.length === 1) {
        completeLogin(rolesExcludingAdmin[0], fullUser);
        return;
      }

      // If multiple non-admin roles → use merged dashboard
      if (rolesExcludingAdmin.length >= 2) {
        completeLogin('faculty', fullUser); // faculty-dashboard handles merged roles
        return;
      }

      // Fallback to role selection
      setAvailableRoles(rolesExcludingAdmin);
      setUserProfile(fullUser);
      setAwaitingRoleSelection(true);
    } catch (err) {
      console.error('Unexpected error:', err);
      setError('An unexpected error occurred.');
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
            <img src="../src/assets/Exam.png" alt="ExamSync Logo" />
          </div>
        </div>

        <div className="login-section">
          <h2>
            Login as <span className="faculty-text">Faculty</span>
          </h2>

          {!awaitingRoleSelection ? (
            <form className="login-form" onSubmit={handleLogin}>
              <div className="input-group">
                <label htmlFor="ID">User ID</label>
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

              <button type="submit" className="login-button">Login</button>
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
              <button type="button" onClick={handleRoleSelection} className="login-button">
                Continue
              </button>
              {error && <p className="error-text">{error}</p>}
            </div>
          )}
        </div>

        <div className="admin-login-link">
          <Link to="/admin-login">Sign in as Admin</Link>
        </div>
      </div>
    </div>
  );
};

export default LoginFaculty;
