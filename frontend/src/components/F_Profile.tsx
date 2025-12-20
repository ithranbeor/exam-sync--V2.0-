// deno-lint-ignore-file no-explicit-any
import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/apiClient.ts';
import '../styles/F_Profile.css';
import { MdEdit } from 'react-icons/md';
import { FaTrash } from 'react-icons/fa';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

interface UserProfile {
  user_id: number;
  first_name: string;
  last_name: string;
  middle_name: string;
  email_address: string;
  contact_number: string;
  avatar_url: string | null;
  employment_type?: 'full-time' | 'part-time' | null;
}

interface UserRoleInfo {
  user_role_id: number;
  role_name: string;
  college?: { college_id: number; college_name: string } | null;
  department?: { department_id: number; department_name: string } | null;
  status?: string | null;
}

interface ProfileProps {
  user: {
    user_id: number;
    email_address: string;
    first_name?: string;
    last_name?: string;
    middle_name?: string;
  } | null;
}

const Profile: React.FC<ProfileProps> = ({ user }) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [originalProfile, setOriginalProfile] = useState<UserProfile | null>(null);
  const [editing, setEditing] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [userRoles, setUserRoles] = useState<UserRoleInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const fetchProfile = useCallback(async () => {
    if (!user?.user_id) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/users/${user.user_id}/`);
      const mapped: UserProfile = {
        user_id: data.user_id,
        first_name: data.first_name || '',
        middle_name: data.middle_name || '',
        last_name: data.last_name || '',
        email_address: data.email_address || user.email_address,
        contact_number: data.contact_number || '',
        avatar_url: data.avatar_url || null,
        employment_type: data.employment_type || null,
      };
      setProfile(mapped);
      setOriginalProfile(mapped);
      setPreview(mapped.avatar_url);
    } catch (err) {
      console.error('Error fetching profile:', err);
      toast.error('Failed to load profile.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  const fetchRoles = useCallback(async () => {
    if (!user?.user_id) return;
    try {
      const { data } = await api.get(`/user-roles/${user.user_id}/roles/`);
      const roles: UserRoleInfo[] = data.map((r: any) => ({
        user_role_id: r.user_role_id,
        role_name: r.role_name,
        college: r.college ?? null,
        department: r.department ?? null,
        status: r.status ?? null,
      }));
      setUserRoles(roles);
    } catch (err) {
      console.error('Error fetching roles:', err);
      toast.error('Failed to load roles.');
    }
  }, [user]);

  useEffect(() => {
    fetchProfile();
    fetchRoles();
  }, [fetchProfile, fetchRoles]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!profile) return;
    setProfile({ ...profile, [e.target.name]: e.target.value });
  };

  const handleAvatarPreview = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const previewUrl = URL.createObjectURL(file);
    setPreview(previewUrl);

    setProfile(prev => prev && { ...prev, avatarFile: file } as any);
  };

  const uploadAvatar = async (file: File) => {
    if (!user?.user_id) return null;

    try {
      const formData = new FormData();
      formData.append('avatar', file);
      const res = await api.post(`/users/${user.user_id}/avatar/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data.avatar_url;
    } catch (err) {
      console.error('Avatar upload failed:', err);
      throw err;
    }
  };

  const handleSave = async () => {
    if (!profile) return;
    setLoading(true);
    try {
      let finalAvatarUrl = profile.avatar_url;
      if ((profile as any).avatarFile) {
        finalAvatarUrl = await uploadAvatar((profile as any).avatarFile);
      }

      const payload = {
        first_name: profile.first_name,
        middle_name: profile.middle_name,
        last_name: profile.last_name,
        contact_number: profile.contact_number,
        email_address: profile.email_address,
      };

      const { data } = await api.patch(`/users/${profile.user_id}/`, payload);

      const updatedData = { ...data, avatar_url: finalAvatarUrl };
      setProfile(updatedData);
      setOriginalProfile(updatedData);
      setPreview(finalAvatarUrl);

      toast.success('Profile updated successfully!');
      setEditing(false);
    } catch (err) {
      console.error('Error updating profile:', err);
      toast.error('Failed to update profile.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setEditing(false);
    setProfile(originalProfile);
    setPreview(originalProfile?.avatar_url || null);
  };

  /** Delete avatar */
  const handleDeleteAvatar = async () => {
    if (!user?.user_id) return;

    if (editing && (profile as any)?.avatarFile) {
      setPreview(originalProfile?.avatar_url || null);
      setProfile(prev => {
        const { avatarFile, ...rest } = prev as any;
        return rest;
      });
      return;
    }

    try {
      await api.delete(`/users/${user.user_id}/avatar/delete/`);
      setProfile(prev => prev && { ...prev, avatar_url: null });
      setOriginalProfile(prev => prev && { ...prev, avatar_url: null });
      setPreview(null);
      toast.success('Avatar deleted.');
    } catch (err) {
      console.error('Error deleting avatar:', err);
      toast.error('Failed to delete avatar.');
    }
  };

  const handlePasswordChange = async () => {
    if (!profile?.email_address) {
      toast.error('Missing email address.');
      return;
    }
    setIsChangingPassword(true);
    try {
      await api.post('/auth/request-password-change/', {
        email: profile.email_address,
      });
      toast.success('Password reset email sent! Please check your inbox.');
    } catch (err: any) {
      console.error('Password change request error:', err);
      toast.error('Failed to send password reset email.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  if (loading || !profile) {
    return <div className="profile-container"><p style={{ color: '#333' }}>Loading profile...</p></div>;
  }

  return (
    <div className="profile-container">
      <div className="profile-header-title">Profile Details</div>

      <div className="profile-section profile-info-card">
        <div className="profile-avatar-wrapper">
          <img
            src={preview || '/images/default-pp.jpg'}
            alt="Profile Avatar"
            className="profile-avatar"
          />
          {editing && (
            <>
              <label htmlFor="avatar-upload" className="profile-avatar-edit-icon">
                <MdEdit size={24} />
                <input
                  id="avatar-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarPreview}
                  hidden
                />
              </label>
              {preview && (
                <button type="button" className="delete-avatar-btn" onClick={handleDeleteAvatar}>
                  <FaTrash />
                </button>
              )}
            </>
          )}
        </div>

        <div className="profile-name-details">
          <div className="profile-full-name">
            {profile.first_name} {profile.middle_name} {profile.last_name}
            {profile.employment_type && (
              <span style={{
                marginLeft: '12px',
                padding: '4px 10px',
                borderRadius: '10px',
                fontSize: '15px',
                fontWeight: 500,
                backgroundColor: profile.employment_type === 'full-time' ? '#07426cff' : '#fff3e0',
                color: profile.employment_type === 'full-time' ? 'white' : '#f57c00'
              }}>
                {profile.employment_type === 'full-time' ? 'Full-time' : 'Part-time'}
              </span>
            )}
          </div>
          <div className="profile-user-type">
            {userRoles.length ? (
              userRoles.map((r) => (
                <div key={r.user_role_id} className="role-info-line">
                  <strong>{r.role_name}: </strong>

                  {r.college && (
                    <span className="info-badge college-badges">
                      {typeof r.college === 'object' ? r.college.college_name : r.college}
                    </span>
                  )}

                  {r.department && (
                    <span className="info-badge dept-badge">
                      {typeof r.department === 'object' ? r.department.department_name : r.department}
                    </span>
                  )}
                </div>
              ))
            ) : (
              <span>No roles assigned</span>
            )}
          </div>
        </div>
      </div>

      <div className="profile-section personal-details-card">
        <div className="personal-details-header">
          <h3>Personal Details</h3>
          {!editing && (
            <button type="button" className="edit-details-btn" onClick={() => setEditing(true)} disabled={loading}>
              <MdEdit /> Edit
            </button>
          )}
        </div>

        <div className="personal-details-grid">
          <div className="profile-field-group">
            <label>User ID</label>
            <input name="user_id" value={profile.user_id} disabled />
          </div>
          <div className="profile-field-group">
            <label>First Name</label>
            <input name="first_name" value={profile.first_name} onChange={handleChange} disabled={!editing} />
          </div>
          <div className="profile-field-group">
            <label>Middle Name</label>
            <input name="middle_name" value={profile.middle_name} onChange={handleChange} disabled={!editing} />
          </div>
          <div className="profile-field-group">
            <label>Last Name</label>
            <input name="last_name" value={profile.last_name} onChange={handleChange} disabled={!editing} />
          </div>
          <div className="profile-field-group">
            <label>Contact No.</label>
            <input name="contact_number" value={profile.contact_number} onChange={handleChange} disabled={!editing} />
          </div>
          <div className="profile-field-group span-2-columns">
            <label>Email Address</label>
            <input name="email_address" value={profile.email_address} onChange={handleChange} disabled={!editing} />
          </div>
        </div>

        {editing && (
          <div className="personal-details-actions">
            <button
              type="button"
              className="btn cancel-personal-details"
              onClick={handleCancel} 
            >
              Cancel
            </button>
            <button type="button" className="btn save-changes-global" onClick={handleSave}>Save</button>
          </div>
        )}
      </div>

      <div className="profile-section password-change-card">
        <button
          type="button"
          className="btn change-password-btn"
          onClick={handlePasswordChange}
          disabled={isChangingPassword}
        >
          {isChangingPassword ? 'Sending...' : 'Change Password'}
        </button>
      </div>

      <ToastContainer position="top-center" autoClose={3000} />
    </div>
  );
};

export default Profile;
