// deno-lint-ignore-file no-explicit-any
import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/apiClient.ts';
import '../styles/F_Profile.css';
import { MdEdit } from 'react-icons/md';
import {
  FaTrash, FaKey, FaUser, FaShieldAlt, FaIdBadge,
  FaEnvelope, FaClock, FaExclamationTriangle,
  FaCheckCircle, FaTimesCircle, FaLock, FaCamera,
} from 'react-icons/fa';
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
  status?: string;
  created_at?: string;
  last_login?: string | null;
}

interface UserRoleInfo {
  user_role_id: number;
  role_name: string;
  college?: { college_id: number; college_name: string } | null;
  department?: { department_id: number; department_name: string } | null;
  status?: string | null;
  date_start?: string | null;
  date_ended?: string | null;
  created_at?: string | null;
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

const formatDate = (iso: string | null | undefined) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatDateTime = (iso: string | null | undefined) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
};

const StatCard: React.FC<{ icon: React.ReactNode; label: string; value: string; accent?: string }> = ({ icon, label, value, accent }) => (
  <div className="pf-stat-card">
    <div className="pf-stat-icon" style={accent ? { background: accent + '18', color: accent } : {}}>
      {icon}
    </div>
    <div>
      <div className="pf-stat-value">{value}</div>
      <div className="pf-stat-label">{label}</div>
    </div>
  </div>
);

const Profile: React.FC<ProfileProps> = ({ user }) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [originalProfile, setOriginalProfile] = useState<UserProfile | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [userRoles, setUserRoles] = useState<UserRoleInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // ── Edit Modal State ──
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState<UserProfile | null>(null);
  const [editPreview, setEditPreview] = useState<string | null>(null);
  const [editAvatarFile, setEditAvatarFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);

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
        status: data.status || 'Active',
        created_at: data.created_at || data.date_joined || null,
        last_login: data.last_login || null,
      };
      setProfile(mapped);
      setOriginalProfile(mapped);
      setPreview(mapped.avatar_url);
    } catch {
      toast.error('Failed to load profile.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  const fetchRoles = useCallback(async () => {
    if (!user?.user_id) return;
    try {
      const { data } = await api.get(`/user-roles/${user.user_id}/roles/`);
      setUserRoles(data.map((r: any) => ({
        user_role_id: r.user_role_id,
        role_name: r.role_name,
        college: r.college ?? null,
        department: r.department ?? null,
        status: r.status ?? 'Active',
        date_start: r.date_start ?? null,
        date_ended: r.date_ended ?? null,
        created_at: r.created_at ?? null,
      })));
    } catch {
      toast.error('Failed to load roles.');
    }
  }, [user]);

  useEffect(() => { fetchProfile(); fetchRoles(); }, [fetchProfile, fetchRoles]);

  // ── Open modal: seed form with current profile ──
  const openEditModal = () => {
    if (!profile) return;
    setEditForm({ ...profile });
    setEditPreview(profile.avatar_url);
    setEditAvatarFile(null);
    setShowEditModal(true);
  };

  const closeEditModal = () => {
    setShowEditModal(false);
    setEditForm(null);
    setEditPreview(null);
    setEditAvatarFile(null);
  };

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!editForm) return;
    setEditForm({ ...editForm, [e.target.name]: e.target.value });
  };

  const handleEditAvatarPreview = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setEditPreview(URL.createObjectURL(file));
    setEditAvatarFile(file);
  };

  const handleRemoveEditAvatar = () => {
    setEditPreview(null);
    setEditAvatarFile(null);
  };

  const uploadAvatar = async (file: File) => {
    if (!user?.user_id) return null;
    const formData = new FormData();
    formData.append('avatar', file);
    const res = await api.post(`/users/${user.user_id}/avatar/`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
    return res.data.avatar_url;
  };

  const handleSave = async () => {
    if (!editForm) return;
    setIsSaving(true);
    try {
      let finalAvatarUrl = editForm.avatar_url;

      // If avatar was removed (preview null, no new file, but had one before)
      if (!editPreview && !editAvatarFile && originalProfile?.avatar_url) {
        await api.delete(`/users/${user!.user_id}/avatar/delete/`);
        finalAvatarUrl = null;
      }

      // If new avatar file selected
      if (editAvatarFile) {
        finalAvatarUrl = await uploadAvatar(editAvatarFile);
      }

      const { data } = await api.patch(`/users/${editForm.user_id}/`, {
        first_name: editForm.first_name,
        middle_name: editForm.middle_name,
        last_name: editForm.last_name,
        contact_number: editForm.contact_number,
        email_address: editForm.email_address,
      });

      const updated = { ...data, avatar_url: finalAvatarUrl };
      setProfile(updated);
      setOriginalProfile(updated);
      setPreview(finalAvatarUrl);
      toast.success('Profile updated successfully!');
      closeEditModal();
    } catch {
      toast.error('Failed to update profile.');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    if (!profile?.email_address) { toast.error('Missing email address.'); return; }
    setIsChangingPassword(true);
    try {
      await api.post('/auth/request-password-change/', { email: profile.email_address });
      toast.success('Password reset email sent!');
    } catch {
      toast.error('Failed to send password reset email.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  if (loading || !profile) {
    return (
      <div className="pf-page">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '40px 0', color: 'var(--cl-text-muted)' }}>
          <div className="cl-spinner" />
          <span style={{ fontSize: '13px', fontFamily: 'var(--cl-font)' }}>Loading profile…</span>
        </div>
      </div>
    );
  }

  const activeRoles = userRoles.filter(r => r.status !== 'Suspended');
  const allRoles    = userRoles;
  const isSuspended = profile.status === 'Suspended';

  return (
    <div className="pf-page">

      {/* ── Page Header ── */}
      <div className="cl-page-header" style={{ marginBottom: '4px' }}>
        <div className="cl-page-header-left">
          <div className="cl-page-icon"><FaUser size={18} /></div>
          <div className="cl-page-title">
            <h1>Profile</h1>
            <p>
              {profile.email_address} · ID {profile.user_id}
              {isSuspended && <span style={{ marginLeft: '8px', color: 'var(--cl-danger)', fontWeight: 700 }}>· SUSPENDED</span>}
            </p>
          </div>
        </div>
      </div>

      {/* ── Suspended Banner ── */}
      {isSuspended && (
        <div className="pf-banner pf-banner-warn">
          <FaExclamationTriangle size={12} />
          This account is currently suspended. Contact an administrator to restore access.
        </div>
      )}

      {/* ── Identity Card ── */}
      <div className="pf-card pf-identity-card">
        <div className="pf-avatar-zone">
          <div className="pf-avatar-wrap">
            <img src={preview || '/images/default-pp.jpg'} alt="Profile Avatar" className="pf-avatar-img" />
            {isSuspended && (
              <div className="pf-avatar-suspended-overlay"><FaLock size={16} /></div>
            )}
          </div>
        </div>

        <div className="pf-identity-info">
          <div className="pf-full-name">
            {profile.first_name} {profile.middle_name} {profile.last_name}
            {profile.employment_type && (
              <span className="cl-room-type-badge" style={{ marginLeft: '10px', verticalAlign: 'middle', background: profile.employment_type === 'full-time' ? '#EBF4FF' : '#FFF3E0', color: profile.employment_type === 'full-time' ? '#1a5a8a' : '#F57C00', fontSize: '12px' }}>
                {profile.employment_type === 'full-time' ? 'Full-time' : 'Part-time'}
              </span>
            )}
            <span className="cl-room-count-badge" style={{ marginLeft: '6px', verticalAlign: 'middle', fontSize: '11px', background: isSuspended ? 'var(--cl-danger-soft)' : 'var(--cl-success-soft)', color: isSuspended ? 'var(--cl-danger)' : 'var(--cl-success)', borderColor: isSuspended ? 'rgba(192,57,43,0.25)' : 'rgba(4,120,87,0.25)' }}>
              {profile.status || 'Active'}
            </span>
          </div>

          <div className="pf-roles-list">
            {activeRoles.length > 0 ? activeRoles.map(r => (
              <div key={r.user_role_id} className="pf-role-row">
                <span className="pf-role-name">{r.role_name}</span>
                {r.college && (
                  <span className="cl-id-badge" style={{ fontSize: '11px', background: '#EBF4FF', color: '#1a5a8a' }}>
                    {typeof r.college === 'object' ? r.college.college_name : r.college}
                  </span>
                )}
                {r.department && (
                  <span className="cl-id-badge" style={{ fontSize: '11px', background: '#F3E8FF', color: '#6D28D9' }}>
                    {typeof r.department === 'object' ? r.department.department_name : r.department}
                  </span>
                )}
              </div>
            )) : (
              <span style={{ fontSize: '12.5px', color: 'var(--cl-text-muted)', fontStyle: 'italic' }}>No active roles assigned</span>
            )}
          </div>

          <div className="pf-meta-row">
            {profile.created_at && (
              <span className="pf-meta-item"><FaClock size={9} /> Member since {formatDate(profile.created_at)}</span>
            )}
            {profile.last_login && (
              <span className="pf-meta-item"><FaCheckCircle size={9} /> Last login {formatDateTime(profile.last_login)}</span>
            )}
          </div>
        </div>
      </div>

      {/* ── Stats Row ── */}
      <div className="pf-stats-row">
        <StatCard icon={<FaIdBadge size={14} />}      label="Total Roles"       value={String(allRoles.length)}                       accent="var(--cl-accent)" />
        <StatCard icon={<FaCheckCircle size={14} />}  label="Active Roles"      value={String(activeRoles.length)}                    accent="var(--cl-success)" />
        <StatCard icon={<FaTimesCircle size={14} />}  label="Suspended Roles"   value={String(allRoles.length - activeRoles.length)}  accent="var(--cl-danger)" />
        <StatCard icon={<FaClock size={14} />}        label="Account Created"   value={formatDate(profile.created_at)}                accent="var(--cl-warn)" />
      </div>

      {/* ── Personal Details Card ── */}
      <div className="pf-card">
        <div className="pf-card-header">
          <span className="pf-section-title"><FaUser size={10} /> Personal Details</span>
          <button
            type="button"
            className="cl-btn"
            style={{ height: '30px', fontSize: '12px', padding: '0 12px' }}
            onClick={openEditModal}
            disabled={loading || isSuspended}
          >
            <MdEdit size={12} /> Edit
          </button>
        </div>

        <div className="pf-fields-grid">
          {[
            { label: 'User ID',      name: 'user_id'        },
            { label: 'First Name',   name: 'first_name'     },
            { label: 'Middle Name',  name: 'middle_name'    },
            { label: 'Last Name',    name: 'last_name'      },
            { label: 'Contact No.',  name: 'contact_number' },
          ].map(f => (
            <div key={f.name} className="cl-field">
              <label>{f.label}</label>
              <input className="cl-input" name={f.name} value={(profile as any)[f.name] ?? ''} disabled readOnly />
            </div>
          ))}
          <div className="cl-field pf-span-2">
            <label>Email Address</label>
            <div style={{ position: 'relative' }}>
              <FaEnvelope size={11} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--cl-text-muted)', pointerEvents: 'none' }} />
              <input className="cl-input" name="email_address" value={profile.email_address} disabled readOnly style={{ paddingLeft: '32px' }} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Role Assignments Table Card ── */}
      <div className="pf-card">
        <div className="pf-card-header">
          <span className="pf-section-title"><FaIdBadge size={10} /> Role Assignments</span>
          <span style={{ fontSize: '11.5px', color: 'var(--cl-text-muted)', fontFamily: 'var(--cl-mono)' }}>
            {allRoles.length} total · {activeRoles.length} active
          </span>
        </div>

        {allRoles.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px', color: 'var(--cl-text-muted)', fontSize: '13px', fontStyle: 'italic' }}>
            No roles have been assigned to this account.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="cl-table" style={{ margin: 0 }}>
              <thead>
                <tr>
                  <th style={{ width: '40px' }}>#</th>
                  <th>Role</th>
                  <th>College</th>
                  <th>Department</th>
                  <th>Start</th>
                  <th>End</th>
                  <th>Assigned</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {allRoles.map((role, idx) => (
                  <tr key={role.user_role_id}>
                    <td className="cl-td-num">{idx + 1}</td>
                    <td><span className="cl-id-badge" style={{ fontSize: '11px' }}>{role.role_name}</span></td>
                    <td style={{ fontSize: '12.5px' }}>
                      {role.college ? (typeof role.college === 'object' ? role.college.college_name : role.college) : <span style={{ color: 'var(--cl-text-muted)' }}>—</span>}
                    </td>
                    <td style={{ fontSize: '12.5px' }}>
                      {role.department ? (typeof role.department === 'object' ? role.department.department_name : role.department) : <span style={{ color: 'var(--cl-text-muted)' }}>—</span>}
                    </td>
                    <td style={{ fontFamily: 'var(--cl-mono)', fontSize: '11.5px' }}>{role.date_start?.split('T')[0] || '—'}</td>
                    <td style={{ fontFamily: 'var(--cl-mono)', fontSize: '11.5px' }}>{role.date_ended?.split('T')[0] || '—'}</td>
                    <td style={{ fontFamily: 'var(--cl-mono)', fontSize: '11.5px' }}>{role.created_at ? formatDate(role.created_at) : '—'}</td>
                    <td>
                      <span className="cl-room-count-badge" style={{ fontSize: '11px', background: role.status === 'Suspended' ? 'var(--cl-danger-soft)' : 'var(--cl-success-soft)', color: role.status === 'Suspended' ? 'var(--cl-danger)' : 'var(--cl-success)', borderColor: role.status === 'Suspended' ? 'rgba(192,57,43,0.25)' : 'rgba(4,120,87,0.25)' }}>
                        {role.status || 'Active'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Security Card ── */}
      <div className="pf-card pf-security-card">
        <div className="pf-card-header">
          <span className="pf-section-title"><FaShieldAlt size={10} /> Security</span>
        </div>

        <div className="pf-security-grid">
          <div className="pf-security-item">
            <div className="pf-security-item-title">Password</div>
            <div className="pf-security-item-desc">Send a reset link to your registered email address to change your password.</div>
            <button type="button" className="cl-btn" style={{ marginTop: '10px', height: '32px', fontSize: '12px' }} onClick={handlePasswordChange} disabled={isChangingPassword}>
              <FaKey size={10} />
              {isChangingPassword ? 'Sending…' : 'Change Password'}
            </button>
          </div>

          <div className="pf-security-divider" />

          <div className="pf-security-item">
            <div className="pf-security-item-title">Last Login</div>
            <div className="pf-security-item-desc">
              {profile.last_login
                ? <>Last successful sign-in on <strong>{formatDateTime(profile.last_login)}</strong>.</>
                : 'No login activity recorded yet.'}
            </div>
          </div>

          <div className="pf-security-divider" />

          <div className="pf-security-item">
            <div className="pf-security-item-title">Account Status</div>
            <div className="pf-security-item-desc">
              Your account is currently{' '}
              <span style={{ fontWeight: 700, color: isSuspended ? 'var(--cl-danger)' : 'var(--cl-success)' }}>
                {isSuspended ? 'suspended' : 'active'}
              </span>.
              {isSuspended && ' Contact an administrator to restore access.'}
            </div>
          </div>

          <div className="pf-security-divider" />

          <div className="pf-security-item">
            <div className="pf-security-item-title">Account Created</div>
            <div className="pf-security-item-desc">
              {profile.created_at
                ? <>This account was created on <strong>{formatDateTime(profile.created_at)}</strong>.</>
                : 'Creation date not available.'}
            </div>
          </div>
        </div>
      </div>

      {/* ════ EDIT PROFILE MODAL ════ */}
      {showEditModal && editForm && (
        <div className="pf-modal-overlay" onClick={closeEditModal}>
          <div className="pf-modal" onClick={e => e.stopPropagation()}>

            {/* Modal Header */}
            <div className="pf-modal-header">
              <div className="pf-modal-title">
                <MdEdit size={15} />
                Edit Profile
              </div>
              <button type="button" className="pf-modal-close" onClick={closeEditModal}>✕</button>
            </div>

            {/* Modal Body */}
            <div className="pf-modal-body">

              {/* Avatar Upload Section */}
              <div className="pf-modal-avatar-section">
                <div className="pf-modal-avatar-wrap">
                  <img
                    src={editPreview || '/images/default-pp.jpg'}
                    alt="Avatar Preview"
                    className="pf-modal-avatar-img"
                  />
                  <label htmlFor="modal-avatar-upload" className="pf-modal-avatar-overlay" title="Change photo">
                    <FaCamera size={18} />
                    <span>Change Photo</span>
                    <input
                      id="modal-avatar-upload"
                      type="file"
                      accept="image/*"
                      onChange={handleEditAvatarPreview}
                      hidden
                    />
                  </label>
                </div>
                <div className="pf-modal-avatar-actions">
                  <label htmlFor="modal-avatar-upload" className="cl-btn" style={{ height: '30px', fontSize: '12px', padding: '0 12px', cursor: 'pointer' }}>
                    <FaCamera size={10} /> Upload Photo
                  </label>
                  {editPreview && (
                    <button
                      type="button"
                      className="cl-btn"
                      style={{ height: '30px', fontSize: '12px', padding: '0 12px', color: 'var(--cl-danger)', borderColor: 'var(--cl-danger)' }}
                      onClick={handleRemoveEditAvatar}
                    >
                      <FaTrash size={10} /> Remove
                    </button>
                  )}
                </div>
                {(editAvatarFile || (!editPreview && originalProfile?.avatar_url)) && (
                  <div className="pf-modal-avatar-hint">
                    {editAvatarFile
                      ? <><FaCheckCircle size={10} style={{ color: 'var(--cl-success)' }} /> New photo ready to save</>
                      : <><FaExclamationTriangle size={10} style={{ color: 'var(--cl-warn)' }} /> Photo will be removed on save</>
                    }
                  </div>
                )}
              </div>

              {/* Fields */}
              <div className="pf-modal-fields">
                <div className="pf-modal-fields-grid">
                  <div className="cl-field">
                    <label>First Name</label>
                    <input className="cl-input" name="first_name" value={editForm.first_name} onChange={handleEditChange} placeholder="First name" />
                  </div>
                  <div className="cl-field">
                    <label>Middle Name</label>
                    <input className="cl-input" name="middle_name" value={editForm.middle_name} onChange={handleEditChange} placeholder="Middle name" />
                  </div>
                  <div className="cl-field">
                    <label>Last Name</label>
                    <input className="cl-input" name="last_name" value={editForm.last_name} onChange={handleEditChange} placeholder="Last name" />
                  </div>
                  <div className="cl-field">
                    <label>Contact No.</label>
                    <input className="cl-input" name="contact_number" value={editForm.contact_number} onChange={handleEditChange} placeholder="Contact number" />
                  </div>
                  <div className="cl-field pf-modal-span-2">
                    <label>Email Address</label>
                    <div style={{ position: 'relative' }}>
                      <FaEnvelope size={11} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--cl-text-muted)', pointerEvents: 'none' }} />
                      <input className="cl-input" name="email_address" value={editForm.email_address} onChange={handleEditChange} placeholder="Email address" style={{ paddingLeft: '32px' }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="pf-modal-footer">
              <button type="button" className="cl-btn" onClick={closeEditModal} disabled={isSaving}>
                Cancel
              </button>
              <button type="button" className="cl-btn primary" onClick={handleSave} disabled={isSaving}>
                {isSaving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer position="top-center" autoClose={3000} />
    </div>
  );
};

export default Profile;