import React, { useState, useEffect } from 'react';
import { api } from '../lib/apiClient.ts';
import '../styles/D_DeanRequests.css';
import {
  FaArchive, FaCheckCircle, FaTimesCircle, FaChevronLeft,
  FaClock, FaSearch, FaCalendarAlt, FaTimes,
} from 'react-icons/fa';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import DeanScheduleViewer from './D_DeanScheduleViewer.tsx';

// ── Types ─────────────────────────────────────────────────────────────────────

type DeanRequest = {
  request_id: string;
  sender_name: string;
  subject: string;
  remarks: string;
  submitted_at: string;
  schedule_data?: {
    college_name: string;
    exam_period: string;
    term: string;
    semester: string;
    academic_year: string;
    building: string;
    total_schedules: number;
    submitted_by_id?: number;
    schedules: Array<{
      course_id: string;
      section_name: string;
      exam_date: string;
      exam_start_time: string;
      exam_end_time: string;
      room_id: string;
      building_name: string;
      instructor: string;
      proctor: string;
    }>;
  };
  status?: string;
  college_name?: string;
};

interface SchedulerViewProps {
  user: {
    user_id: number;
    email_address: string;
    first_name?: string;
    last_name?: string;
  } | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name.split(' ').filter(Boolean).slice(0, 2).map(n => n[0].toUpperCase()).join('');
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  if (hrs < 24) return `${hrs}h ago`;
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function statusBadge(status = 'pending') {
  const icons: Record<string, React.ReactNode> = {
    pending: <FaClock style={{ fontSize: '9px' }} />,
    approved: <FaCheckCircle style={{ fontSize: '9px' }} />,
    rejected: <FaTimesCircle style={{ fontSize: '9px' }} />,
  };
  return (
    <span className={`dr-badge ${status.toLowerCase()}`}>
      {icons[status.toLowerCase()] ?? icons.pending}
      {status}
    </span>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

const DeanRequests: React.FC<SchedulerViewProps> = ({ user }) => {
  const [requests, setRequests] = useState<DeanRequest[]>([]);
  const [history, setHistory] = useState<DeanRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<DeanRequest | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [processingRequest, setProcessingRequest] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectionModal, setShowRejectionModal] = useState(false);
  const [collegeName, setCollegeName] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState(false);
  const [newStatus, setNewStatus] = useState<string>('pending');
  const [showScheduleViewer, setShowScheduleViewer] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // ── College fetch ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (!user?.user_id) return;
    (async () => {
      try {
        const { data } = await api.get('/tbl_user_role', { params: { user_id: user.user_id, role_id: 1 } });
        if (!data?.length) { toast.error('No dean role found'); return; }
        const collegeId = data[0].college_id;
        if (!collegeId) { toast.error('Dean role has no college assigned'); return; }
        const res = await api.get(`/tbl_college/${collegeId}/`);
        setCollegeName(res.data.college_name);
      } catch { toast.error('Failed to load college information'); }
    })();
  }, [user]);

  // ── Pending requests ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!collegeName) return;
    const fetch = async () => {
      try {
        const res = await api.get('/tbl_scheduleapproval/', { params: { status: 'pending', college_name: collegeName } });
        setRequests(res.data.map(mapRow));
      } catch { toast.error('Failed to load pending requests'); }
    };
    fetch();
    const iv = setInterval(fetch, 10000);
    return () => clearInterval(iv);
  }, [collegeName]);

  // ── History ───────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!collegeName) return;
    (async () => {
      try {
        const res = await api.get('/tbl_scheduleapproval/', { params: { college_name: collegeName, limit: 50 } });
        setHistory(res.data.filter((r: any) => r.status !== 'pending').map(mapRow));
      } catch { /* silent */ }
    })();
  }, [collegeName, requests]);

  const mapRow = (row: any): DeanRequest => ({
    request_id: row.request_id,
    sender_name: row.submitted_by_name || `${row.submitted_by?.first_name || ''} ${row.submitted_by?.last_name || ''}`.trim() || 'Unknown',
    subject: 'Exam Schedule Request',
    remarks: row.remarks,
    schedule_data: row.schedule_data,
    submitted_at: row.submitted_at || row.created_at,
    status: row.status,
    college_name: row.college_name,
  });

  // ── Actions ───────────────────────────────────────────────────────────────

  const handleDelete = async (req: DeanRequest) => {
    if (!globalThis.confirm(`Delete this request for ${req.college_name}?`)) return;
    try {
      await api.delete(`/tbl_scheduleapproval/${req.request_id}/`);
      setRequests(p => p.filter(r => r.request_id !== req.request_id));
      setHistory(p => p.filter(r => r.request_id !== req.request_id));
      toast.success('Request deleted');
      setSelectedRequest(null);
    } catch { toast.error('Failed to delete request'); }
  };

  const handleUpdateStatus = async () => {
    if (!selectedRequest) return;
    try {
      await api.put(`/tbl_scheduleapproval/${selectedRequest.request_id}/`, { status: newStatus });
      toast.success(`Status updated to ${newStatus.toUpperCase()}`);
      const update = (arr: DeanRequest[]) =>
        arr.map(r => r.request_id === selectedRequest.request_id ? { ...r, status: newStatus } : r);
      setHistory(update); setRequests(update);
      setEditStatus(false);
    } catch { toast.error('Failed to update status'); }
  };

  const sendNotification = async (schedulerId: number, status: 'approved' | 'rejected', college: string, remarks?: string) => {
    if (!user?.user_id) return;
    try {
      await api.post('/notifications/create/', {
        user_id: schedulerId, sender_id: user.user_id,
        title: `Schedule ${status === 'approved' ? 'Approved' : 'Rejected'}`,
        message: status === 'approved'
          ? `Your schedule submission for ${college} has been approved by the dean.`
          : `Your schedule submission for ${college} has been rejected. Reason: ${remarks || 'No reason provided'}`,
        type: 'schedule_response', status: 'unread',
        link_url: '/scheduler', is_seen: false, priority: status === 'rejected' ? 2 : 1,
      });
    } catch { /* silent */ }
  };

  const confirmRejection = async () => {
    if (!selectedRequest) return;
    if (!rejectionReason.trim()) { toast.warn('Please provide a reason for rejection'); return; }
    setProcessingRequest(true);
    try {
      await api.put(`/tbl_scheduleapproval/${selectedRequest.request_id}/`, { status: 'rejected', remarks: rejectionReason });
      const schedulerId = selectedRequest.schedule_data?.submitted_by_id ||
        (await api.get(`/tbl_scheduleapproval/${selectedRequest.request_id}/`)).data.submitted_by;
      if (schedulerId) await sendNotification(schedulerId, 'rejected', selectedRequest.schedule_data?.college_name || 'Unknown College', rejectionReason);
      toast.success('Schedule rejected');
      setRequests(p => p.filter(r => r.request_id !== selectedRequest.request_id));
      setHistory(p => [{ ...selectedRequest, status: 'rejected', remarks: rejectionReason }, ...p]);
      setShowRejectionModal(false); setRejectionReason(''); setSelectedRequest(null);
    } catch { toast.error('Failed to reject schedule'); }
    finally { setProcessingRequest(false); }
  };

  const handleApprove = async (req: DeanRequest) => {
    if (processingRequest) return;
    if (!globalThis.confirm(`Approve the schedule for ${req.schedule_data?.college_name}?`)) return;
    setProcessingRequest(true);
    try {
      const schedulerId = req.schedule_data?.submitted_by_id ||
        (await api.get(`/tbl_scheduleapproval/${req.request_id}/`)).data.submitted_by;
      await api.put(`/tbl_scheduleapproval/${req.request_id}/`, { status: 'approved' });
      if (schedulerId) await sendNotification(schedulerId, 'approved', req.schedule_data?.college_name || 'Unknown College');
      toast.success('Schedule approved!');
      setRequests(p => p.filter(r => r.request_id !== req.request_id));
      setHistory(p => [{ ...req, status: 'approved' }, ...p]);
      setSelectedRequest(null); setShowScheduleViewer(false);
    } catch { toast.error('Failed to approve schedule'); }
    finally { setProcessingRequest(false); }
  };

  // ── Derived ───────────────────────────────────────────────────────────────

  const displayList = showHistory ? history : requests;
  const pendingCount = requests.length;
  const historyCount = history.length;

  const filtered = displayList.filter(r =>
    r.sender_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (r.schedule_data?.college_name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="dr-root">

        {/* ── Header ── */}
        <div className="dr-header">
          <div className="dr-header-left">
            <div className="dr-icon-wrap">
              <FaCalendarAlt />
            </div>
            <div className="dr-title-block">
              <h1>Schedule Approvals</h1>
              <p>
                {showHistory
                  ? `${historyCount} historical record${historyCount !== 1 ? 's' : ''}`
                  : `${pendingCount} pending request${pendingCount !== 1 ? 's' : ''}`}
                {collegeName && ` · ${collegeName}`}
              </p>
            </div>
          </div>

          <div className="dr-toolbar">
            <div style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              background: 'white', border: '1.5px solid #e0e4ea',
              borderRadius: '8px', padding: '0 12px', height: '38px', minWidth: '200px',
            }}>
              <FaSearch style={{ color: '#9ca3af', fontSize: '12px', flexShrink: 0 }} />
              <input
                type="text"
                placeholder="Search sender or college…"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{
                  border: 'none', outline: 'none', background: 'transparent',
                  fontSize: '13px', color: '#0f1923', width: '100%',
                  fontFamily: 'DM Sans, sans-serif',
                }}
              />
            </div>
          </div>
        </div>

        {/* ── Filter Tabs ── */}
        <div className="dr-filters">
          <button
            type="button"
            className={`dr-filter-tab${!showHistory ? ' active' : ''}`}
            onClick={() => setShowHistory(false)}
          >
            <FaClock style={{ fontSize: '11px' }} />
            Pending
            <span className="tab-count">{pendingCount}</span>
          </button>
          <button
            type="button"
            className={`dr-filter-tab${showHistory ? ' active' : ''}`}
            onClick={() => setShowHistory(true)}
          >
            <FaArchive style={{ fontSize: '11px' }} />
            History
            <span className="tab-count">{historyCount}</span>
          </button>
        </div>

        {/* ── Pending banner ── */}
        {!showHistory && pendingCount > 0 && (
          <div className="dr-pending-banner">
            <FaClock style={{ fontSize: '14px' }} />
            {pendingCount} schedule submission{pendingCount > 1 ? 's' : ''} awaiting your review
          </div>
        )}

        {/* ── Cards ── */}
        {filtered.length === 0 ? (
          <div className="dr-empty">
            <div className="dr-empty-icon"><FaCalendarAlt /></div>
            <h3>{showHistory ? 'No approval history yet' : 'No pending requests'}</h3>
            <p>
              {showHistory
                ? 'Approved and rejected schedules will appear here.'
                : 'Incoming scheduler submissions will appear here.'}
            </p>
          </div>
        ) : (
          filtered.map(req => {
            const status = (req.status || 'pending').toLowerCase();
            const college = req.schedule_data?.college_name || req.subject;
            const count = req.schedule_data?.total_schedules;
            const preview = count ? `${college} · ${count} schedule${count !== 1 ? 's' : ''}` : college;

            return (
              <div
                key={req.request_id}
                className={`dr-card ${status}`}
                onClick={() => { setSelectedRequest(req); setShowScheduleViewer(false); setEditStatus(false); }}
              >
                {/* Avatar */}
                <div className={`dr-avatar ${status}`}>{getInitials(req.sender_name)}</div>

                {/* Body */}
                <div className="dr-card-body">
                  <div className="dr-card-row-top">
                    <span className="dr-card-sender">{req.sender_name}</span>
                    {statusBadge(status)}
                  </div>
                  <div className="dr-card-preview">{preview}</div>
                  <div className="dr-card-time">{formatRelativeTime(req.submitted_at)}</div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ════ REQUEST DETAIL MODAL ════ */}
      {selectedRequest && (
        <div
          className="dr-modal-overlay"
          onClick={() => { setSelectedRequest(null); setShowScheduleViewer(false); }}
        >
          <div
            className={`dr-modal${showScheduleViewer ? ' wide' : ''}`}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="dr-modal-header">
              <div className={`dr-modal-avatar ${(selectedRequest.status || 'pending').toLowerCase()}`}>
                {getInitials(selectedRequest.sender_name)}
              </div>
              <div className="dr-modal-meta">
                <h3>{selectedRequest.sender_name}</h3>
                <div className="dr-modal-sub">
                  {statusBadge(selectedRequest.status)}
                  <span>{formatRelativeTime(selectedRequest.submitted_at)}</span>
                  {showScheduleViewer && (
                    <button type="button" className="dr-back-btn" onClick={() => setShowScheduleViewer(false)}>
                      <FaChevronLeft style={{ fontSize: '10px' }} /> Back
                    </button>
                  )}
                </div>
              </div>
              <button
                type="button"
                className="dr-modal-close"
                onClick={() => { setSelectedRequest(null); setShowScheduleViewer(false); }}
              >
                <FaTimes />
              </button>
            </div>

            {/* Modal Body */}
            <div className="dr-modal-body">
              {!showScheduleViewer ? (
                <>
                  {/* Info grid */}
                  <div className="dr-info-grid">
                    {([
                      ['College', selectedRequest.schedule_data?.college_name || selectedRequest.subject],
                      ['Submitted by', selectedRequest.sender_name],
                      ['Submitted', new Date(selectedRequest.submitted_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })],
                    ] as [string, string][]).map(([label, val]) => (
                      <React.Fragment key={label}>
                        <div className="dr-info-label">{label}</div>
                        <div className="dr-info-value">{val}</div>
                      </React.Fragment>
                    ))}
                  </div>

                  {/* Schedule summary */}
                  {selectedRequest.schedule_data && (
                    <div className="dr-info-card">
                      {([
                        ['Exam Period', selectedRequest.schedule_data.exam_period],
                        ['Term', selectedRequest.schedule_data.term],
                        ['Semester', selectedRequest.schedule_data.semester],
                        ['Academic Year', selectedRequest.schedule_data.academic_year],
                        ['Total Schedules', String(selectedRequest.schedule_data.total_schedules)],
                      ] as [string, string][]).map(([k, v]) => (
                        <div className="dr-info-card-row" key={k}>
                          <strong>{k}</strong><span>{v}</span>
                        </div>
                      ))}
                      <button
                        type="button"
                        className="dr-action-btn"
                        style={{ marginTop: '4px', alignSelf: 'flex-start' }}
                        onClick={() => setShowScheduleViewer(true)}
                      >
                        View Full Schedule
                      </button>
                    </div>
                  )}

                  {/* Edit status row */}
                  {editStatus && (
                    <div className="dr-edit-status-row">
                      <span className="dr-edit-status-label">Change Status</span>
                      <select className="dr-select" value={newStatus} onChange={e => setNewStatus(e.target.value)}>
                        <option value="pending">Pending</option>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                      </select>
                      <button type="button" className="dr-action-btn success" onClick={handleUpdateStatus}>Save</button>
                      <button type="button" className="dr-action-btn" onClick={() => setEditStatus(false)}>Cancel</button>
                    </div>
                  )}
                </>
              ) : (
                selectedRequest.schedule_data && (
                  <DeanScheduleViewer scheduleData={selectedRequest.schedule_data} />
                )
              )}
            </div>

            {/* Modal Footer */}
            {!showScheduleViewer && !editStatus && (
              <div className="dr-modal-footer">
                <button
                  type="button"
                  className="dr-action-btn"
                  onClick={() => { setSelectedRequest(null); setShowScheduleViewer(false); }}
                >
                  Close
                </button>

                <button type="button" className="dr-action-btn" style={{ color: '#dc2626', borderColor: '#fecaca' }}
                  onClick={() => handleDelete(selectedRequest)}>
                  Delete
                </button>

                {selectedRequest.status !== 'pending' && (
                  <button type="button" className="dr-action-btn warning"
                    onClick={() => { setEditStatus(true); setNewStatus(selectedRequest.status || 'pending'); }}>
                    Edit Status
                  </button>
                )}

                {selectedRequest.status === 'pending' && (
                  <>
                    <button type="button" className="dr-action-btn reject"
                      onClick={() => setShowRejectionModal(true)} disabled={processingRequest}>
                      <FaTimesCircle style={{ fontSize: '11px' }} />
                      Reject
                    </button>
                    <button type="button" className="dr-action-btn success"
                      onClick={() => handleApprove(selectedRequest)} disabled={processingRequest}>
                      {processingRequest
                        ? <><span className="dr-spinner-sm" /> Approving…</>
                        : <><FaCheckCircle style={{ fontSize: '11px' }} /> Approve</>}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ════ REJECTION MODAL ════ */}
      {showRejectionModal && (
        <div className="dr-modal-overlay" onClick={() => setShowRejectionModal(false)}>
          <div className="dr-modal" style={{ maxWidth: '460px' }} onClick={e => e.stopPropagation()}>
            <div className="dr-modal-header" style={{ paddingRight: '60px' }}>
              <div className="dr-modal-avatar rejected">
                <FaTimesCircle style={{ fontSize: '18px' }} />
              </div>
              <div className="dr-modal-meta">
                <h3>Rejection Reason</h3>
                <div className="dr-modal-sub">
                  <span>{selectedRequest?.schedule_data?.college_name}</span>
                </div>
              </div>
              <button type="button" className="dr-modal-close" onClick={() => setShowRejectionModal(false)}>
                <FaTimes />
              </button>
            </div>
            <div className="dr-modal-body">
              <div className="dr-field">
                <label>Reason <span style={{ color: '#dc2626' }}>*</span></label>
                <textarea
                  className="dr-textarea"
                  value={rejectionReason}
                  onChange={e => setRejectionReason(e.target.value)}
                  placeholder="Enter reason for rejection…"
                  rows={4}
                />
              </div>
            </div>
            <div className="dr-modal-footer">
              <button type="button" className="dr-action-btn" onClick={() => setShowRejectionModal(false)} disabled={processingRequest}>
                Cancel
              </button>
              <button type="button" className="dr-action-btn reject" onClick={confirmRejection} disabled={processingRequest}>
                {processingRequest
                  ? <><span className="dr-spinner-sm" /> Rejecting…</>
                  : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer position="top-right" autoClose={3000} />
    </>
  );
};

export default DeanRequests;