import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../lib/apiClient.ts';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import '../styles/resetPassword.css';
import { FaEye, FaEyeSlash } from 'react-icons/fa';

const ResetPassword: React.FC = () => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Extract UID and token from URL parameters
  const uid = searchParams.get('uid');
  const token = searchParams.get('token');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!uid || !token) {
      toast.error('Invalid or expired reset link.');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters.');
      return;
    }

    setSubmitting(true);

    try {
      const res = await api.post('auth/confirm-password-change/', {
        uid,
        token,
        new_password: newPassword,
      });

      if (res.status === 200) {
        toast.success('Password reset successful!');
        setTimeout(() => navigate('/admin-login'), 2000);
      } else {
        toast.error('Failed to reset password.');
      }
    } catch (err: any) {
      console.error('Password reset error:', err.message);
      toast.error('Invalid or expired link. Please request a new reset email.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="reset-password-page">
      <div className="reset-password-overlay"></div>

      <div className="reset-password-container">
        <h2>Reset Your Password</h2>

        <form className="reset-password-form" onSubmit={handleSubmit}>
          <label>New Password</label>
          <div className="password-input-wrapper">
            <input
              type={showNew ? 'text' : 'password'}
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={submitting}
              placeholder="Enter new password"
            />
            <span
              onClick={() => setShowNew(!showNew)}
              className="toggle-password-visibility"
            >
              {showNew ? <FaEyeSlash /> : <FaEye />}
            </span>
          </div>

          <label>Confirm Password</label>
          <div className="password-input-wrapper">
            <input
              type={showConfirm ? 'text' : 'password'}
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={submitting}
              placeholder="Confirm new password"
            />
            <span
              onClick={() => setShowConfirm(!showConfirm)}
              className="toggle-password-visibility"
            >
              {showConfirm ? <FaEyeSlash /> : <FaEye />}
            </span>
          </div>

          <button type="submit" className="btn" disabled={submitting}>
            {submitting ? 'Resetting...' : 'Reset Password'}
          </button>
        </form>

        <ToastContainer position="top-center" autoClose={3000} />
      </div>
    </div>
  );
};

export default ResetPassword;
