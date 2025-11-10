import React, { useState, useEffect } from 'react';
import { api } from '../lib/apiClient.ts';
import '../styles/deanrequests.css';
import { FaArchive, FaCheckCircle, FaTimesCircle, FaTrash } from "react-icons/fa";
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

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
    schedules: Array<{
      course_id: string;
      section_name: string;
      exam_date: string;
      exam_start_time: string;
      exam_end_time: string;
      room_id: string;
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

const DeanRequests: React.FC<SchedulerViewProps> = ({ user }) => {
  const [requests, setRequests] = useState<DeanRequest[]>([]);
  const [history, setHistory] = useState<DeanRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<DeanRequest | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [processingRequest, setProcessingRequest] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectionModal, setShowRejectionModal] = useState(false);
  const [collegeName, setCollegeName] = useState<string | null>(null);

  // Added states for editing status
  const [editStatus, setEditStatus] = useState(false);
  const [newStatus, setNewStatus] = useState<string>('pending');

  useEffect(() => {
    const fetchCollege = async () => {
      if (!user?.user_id) return;
      try {
        const res = await api.get(`/user/${user.user_id}/college/`);
        setCollegeName(res.data.college_name);
      } catch (err) {
        console.error('Error fetching dean college:', err);
        toast.error('Failed to load dean college info.');
      }
    };
    fetchCollege();
  }, [user]);

  useEffect(() => {
    if (!collegeName) return;
    const fetchRequests = async () => {
      try {
        const res = await api.get('/tbl_scheduleapproval/', {
          params: { status: 'pending', college_name: collegeName },
        });
        const mapped = res.data.map((row: any) => ({
          request_id: row.request_id,
          sender_name: `${row.submitted_by.first_name} ${row.submitted_by.last_name}`,
          subject: 'Exam Schedule Request',
          remarks: row.remarks,
          schedule_data: row.schedule_data,
          submitted_at: new Date(row.submitted_at).toLocaleString(),
          status: row.status,
          college_name: row.college_name,
        }));
        setRequests(mapped);
      } catch (err) {
        console.error('Error fetching pending requests:', err);
        toast.error('Failed to load pending requests.');
      }
    };
    fetchRequests();
    const interval = setInterval(fetchRequests, 10000);
    return () => clearInterval(interval);
  }, [collegeName]);

  useEffect(() => {
    if (!collegeName) return;
    const fetchHistory = async () => {
      try {
        const res = await api.get('/tbl_scheduleapproval/', {
          params: { status: ['approved', 'rejected'], college_name: collegeName, limit: 50 },
        });
        const mapped = res.data.map((row: any) => ({
          request_id: row.request_id,
          sender_name: `${row.submitted_by.first_name} ${row.submitted_by.last_name}`,
          subject: 'Exam Schedule Request',
          remarks: row.remarks,
          schedule_data: row.schedule_data,
          submitted_at: new Date(row.submitted_at).toLocaleString(),
          status: row.status,
          college_name: row.college_name,
        }));
        setHistory(mapped);
      } catch (err) {
        console.error('Error fetching history:', err);
      }
    };
    fetchHistory();
  }, [collegeName, requests]);

  // ✅ Delete one request
  const handleDelete = async (req: DeanRequest) => {
    const confirmed = globalThis.confirm(`Delete this request for ${req.college_name}?`);
    if (!confirmed) return;
    try {
      await api.delete(`/tbl_scheduleapproval/${req.request_id}/`);
      setRequests(prev => prev.filter(r => r.request_id !== req.request_id));
      setHistory(prev => prev.filter(r => r.request_id !== req.request_id));
      toast.success('Request deleted.');
      setSelectedRequest(null);
    } catch (err) {
      console.error('Delete failed:', err);
      toast.error('Failed to delete request.');
    }
  };

  // ✅ Update request status manually
  const handleUpdateStatus = async () => {
    if (!selectedRequest) return;
    try {
      await api.patch(`/tbl_scheduleapproval/${selectedRequest.request_id}/`, {
        status: newStatus,
      });
      toast.success(`Status updated to ${newStatus.toUpperCase()}`);
      setHistory(prev =>
        prev.map(r =>
          r.request_id === selectedRequest.request_id ? { ...r, status: newStatus } : r
        )
      );
      setRequests(prev =>
        prev.map(r =>
          r.request_id === selectedRequest.request_id ? { ...r, status: newStatus } : r
        )
      );
      setEditStatus(false);
    } catch (err) {
      console.error('Update status failed:', err);
      toast.error('Failed to update status.');
    }
  };

  // Approve & Reject (same as before)
  const handleReject = (req: DeanRequest) => {
    setSelectedRequest(req);
    setShowRejectionModal(true);
  };

  const confirmRejection = async () => {
    if (!selectedRequest) return;
    if (!rejectionReason.trim()) {
      toast.warn('Please provide a reason for rejection');
      return;
    }
    setProcessingRequest(true);
    try {
      await api.patch(`/tbl_scheduleapproval/${selectedRequest.request_id}/`, {
        status: 'rejected',
        remarks: rejectionReason,
      });
      toast.success(`Schedule for ${selectedRequest.schedule_data?.college_name} rejected`);
      setRequests(prev => prev.filter(r => r.request_id !== selectedRequest.request_id));
      setHistory(prev => [{ ...selectedRequest, status: 'rejected', remarks: rejectionReason }, ...prev]);
      setShowRejectionModal(false);
      setRejectionReason('');
      setSelectedRequest(null);
    } catch (err) {
      console.error('Rejection error:', err);
      toast.error('Failed to reject schedule.');
    } finally {
      setProcessingRequest(false);
    }
  };

  const handleApprove = async (req: DeanRequest) => {
    if (processingRequest) return;
    const confirmed = globalThis.confirm(`Approve the schedule for ${req.schedule_data?.college_name}?`);
    if (!confirmed) return;
    setProcessingRequest(true);
    try {
      await api.patch(`/tbl_scheduleapproval/${req.request_id}/`, { status: 'approved' });
      toast.success(`Schedule for ${req.schedule_data?.college_name} approved successfully!`);
      setRequests(prev => prev.filter(r => r.request_id !== req.request_id));
      setHistory(prev => [{ ...req, status: 'approved' }, ...prev]);
      setSelectedRequest(null);
    } catch (err) {
      console.error('Approval error:', err);
      toast.error('Failed to approve schedule.');
    } finally {
      setProcessingRequest(false);
    }
  };

  const handleDeleteAll = async () => {
    const confirmed = globalThis.confirm('Delete ALL requests from your college?');
    if (!confirmed || !collegeName) return;
    try {
      await api.delete(`/tbl_scheduleapproval/`, { params: { college_name: collegeName } });
      setRequests([]);
      setHistory([]);
      toast.success('All requests deleted.');
    } catch (err) {
      console.error('Delete all failed:', err);
      toast.error('Failed to delete all requests.');
    }
  };

  // Render cards
  const renderCards = (arr: DeanRequest[]) => {
    if (arr.length === 0)
      return (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#666' }}>
          {showHistory ? 'No approval history yet' : 'No pending requests'}
        </div>
      );

    return arr.map(req => (
      <div
        key={req.request_id}
        className="deanreq-card"
        onClick={() => setSelectedRequest(req)}
        style={{
          borderLeft: req.status === 'approved'
            ? '4px solid #4CAF50'
            : req.status === 'rejected'
            ? '4px solid #f44336'
            : '4px solid #FF9800',
        }}
      >
        <div className="deanreq-left">
          <span className="deanreq-icon">
            {req.status === 'approved' ? <FaCheckCircle style={{ color: '#4CAF50' }} /> :
             req.status === 'rejected' ? <FaTimesCircle style={{ color: '#f44336' }} /> : '⏵'}
          </span>
          <span className="deanreq-sender">{req.sender_name}</span>
        </div>
        <div className="deanreq-center">
          {req.schedule_data?.college_name || req.subject}
          {req.schedule_data && (
            <span style={{ fontSize: '11px', marginLeft: '8px', color: '#666' }}>
              ({req.schedule_data.total_schedules} schedules)
            </span>
          )}
        </div>
        <div className="deanreq-date">
          {req.submitted_at}
          {req.status && req.status !== 'pending' && (
            <span
              style={{
                marginLeft: 8,
                padding: '2px 8px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: 'bold',
                backgroundColor: req.status === 'approved' ? '#4CAF50' : '#f44336',
                color: 'white',
              }}
            >
              {req.status.toUpperCase()}
            </span>
          )}
        </div>
      </div>
    ));
  };

  return (
    <div className="deanreq-container">
      <div className="deanreq-banner">
        Schedule Approval Requests
        <span
          className="deanreq-history-icon"
          onClick={() => setShowHistory(s => !s)}
          title={showHistory ? "View pending requests" : "View history"}
          style={{ float: 'right', cursor: 'pointer', fontSize: '1.2rem', color: showHistory ? '#4CAF50' : 'inherit' }}
        >
          <FaArchive />
        </span>
        <button
          type="button"
          className="deanreq-btn deny"
          style={{ float: 'right', background: 'none', border: 'none', color: '#7b0909ff' }}
          onClick={handleDeleteAll}
        >
          <FaTrash />
        </button>
      </div>

      <p className="deanreq-message">
        {showHistory
          ? `Showing approval history (${history.length} records)`
          : `You have ${requests.length} pending request(s) from schedulers`}
      </p>

      {showHistory ? renderCards(history) : renderCards(requests)}

      {/* Selected Request Modal */}
      {selectedRequest && (
        <div className="deanreq-modal-overlay" onClick={() => setSelectedRequest(null)}>
          <div className="deanreq-modal-pane" onClick={e => e.stopPropagation()}>
            <h3>From: {selectedRequest.sender_name}</h3>
            <h4>{selectedRequest.schedule_data?.college_name || selectedRequest.subject}</h4>

            {/* 🔽 ACTIONS SECTION */}
            <div className="deanreq-actions" style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              {selectedRequest && (
                <>
                  <button
                    type="button"
                    className="deanreq-btn deny"
                    style={{ backgroundColor: '#d32f2f', color: 'white' }}
                    onClick={() => handleDelete(selectedRequest)}
                  >
                    Delete
                  </button>
                </>
              )}

              {selectedRequest.status !== "pending" && !editStatus && (
                <button
                  type="button"
                  className="deanreq-btn"
                  style={{ backgroundColor: "#FF9800", color: "white" }}
                  onClick={() => {
                    setEditStatus(true);
                    setNewStatus(selectedRequest.status || "pending");
                  }}
                >
                  Edit Status
                </button>
              )}

              {editStatus && (
                <>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value)}
                    style={{
                      padding: "6px",
                      borderRadius: "4px",
                      border: "1px solid #ccc"
                    }}
                  >
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                  </select>

                  <button
                    type="button"
                    className="deanreq-btn approve"
                    onClick={handleUpdateStatus}
                  >
                    Save
                  </button>

                  <button
                    type="button"
                    className="deanreq-btn cancel"
                    onClick={() => setEditStatus(false)}
                  >
                    Cancel
                  </button>
                </>
              )}

              {/* Existing Close + Approve/Reject buttons */}
              <button type="button" onClick={() => setSelectedRequest(null)} className="deanreq-btn cancel">
                Close
              </button>

              {selectedRequest.status === 'pending' && (
                <>
                  <button type="button" onClick={() => handleReject(selectedRequest)} className="deanreq-btn deny">
                    Reject
                  </button>
                  <button type="button" onClick={() => handleApprove(selectedRequest)} className="deanreq-btn approve">
                    Approve
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Rejection Modal */}
      {showRejectionModal && (
        <div className="deanreq-modal-overlay" onClick={() => setShowRejectionModal(false)}>
          <div className="deanreq-modal-pane" onClick={e => e.stopPropagation()}>
            <h3>Rejection Reason</h3>
            <textarea
              value={rejectionReason}
              onChange={e => setRejectionReason(e.target.value)}
              placeholder="Enter reason for rejection..."
              rows={5}
            />
            <div style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button type='button' onClick={() => setShowRejectionModal(false)} className="deanreq-btn cancel">
                Cancel
              </button>
              <button type='button' onClick={confirmRejection} className="deanreq-btn deny" disabled={processingRequest}>
                {processingRequest ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer position="top-right" autoClose={3000} />
    </div>
  );
};

export default DeanRequests;
