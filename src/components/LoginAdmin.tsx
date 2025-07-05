// deno-lint-ignore-file no-explicit-any
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.ts';
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
        .select('status, role_id, roles:tbl_roles(role_name)')
        .eq('user_id', id);

      if (userRolesError || !userRoles || userRoles.length === 0) {
        setError('No roles found. Unauthorized access.');
        return;
      }

      const allSuspended = userRoles.every((r: any) => r.status?.toLowerCase() === 'suspended');
      if (allSuspended) {
        setError('Your account has been suspended.');
        await supabase.auth.signOut();
        return;
      }

      const isAdmin = userRoles.some((r: any) => r.roles?.role_name?.toLowerCase() === 'admin');
      if (!isAdmin) {
        setError('Access denied. Admins only.');
        return;
      }

      if (rememberMe) {
        localStorage.setItem('user', JSON.stringify(fullUser));
      } else {
        sessionStorage.setItem('user', JSON.stringify(fullUser));
      }

      navigate('/admin-dashboard');
    } catch (err) {
      console.error('Unexpected error:', err);
      setError('An unexpected error occurred.');
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
            <img src="../src/assets/Exam.png" alt="ExamSync Logo" />
          </div>
        </div>

        <div className="login-section">
          <h2>
            Login as <span className="faculty-text">Admin</span>
          </h2>

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
        </div>

        <div className="admin-login-link">
          <button 
          type='button' 
          className="faculty-login-btn" 
          onClick={() => navigate('/')}>
            Sign in as Faculty</button>
        </div>
      </div>
    </div>
  );
};

export default LoginAdmin;
