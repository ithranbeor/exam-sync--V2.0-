import React, { useState, useEffect } from 'react';
import { api } from '../lib/apiClient.ts';
import '../styles/D_DeanRequests.css';
import { FaArchive, FaCheckCircle, FaTimesCircle, FaChevronLeft } from "react-icons/fa";
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import DeanScheduleViewer from './D_DeanScheduleViewer.tsx';

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

  useEffect(() => {
    const fetchCollege = async () => {
      if (!user?.user_id) {
        console.log("❌ No user_id provided");
        return;
      }

      try {

        const userRoleResponse = await api.get('/tbl_user_role', {
          params: {
            user_id: user.user_id,
            role_id: 1
          }
        });

        if (!userRoleResponse.data || userRoleResponse.data.length === 0) {
          toast.error('No dean role found for user');
          return;
        }

        const deanRole = userRoleResponse.data[0];

        const deanCollegeId = deanRole.college_id;

        if (!deanCollegeId) {
          toast.error('Dean role has no college assigned');
          return;
        }

        const collegeResponse = await api.get(`/tbl_college/${deanCollegeId}/`);

        setCollegeName(collegeResponse.data.college_name);
      } catch (err) {
        toast.error('Failed to load college information');
      }
    };
    fetchCollege();
  }, [user]);

  useEffect(() => {
    if (!collegeName) {
      return;
    }

    const fetchRequests = async () => {
      try {
        const res = await api.get('/tbl_scheduleapproval/', {
          params: {
            status: 'pending',
            college_name: collegeName
          },
        });

        const mapped = res.data.map((row: any) => {
          return {
            request_id: row.request_id,
            sender_name: row.submitted_by_name || `${row.submitted_by?.first_name || ''} ${row.submitted_by?.last_name || ''}`.trim() || 'Unknown',
            subject: 'Exam Schedule Request',
            remarks: row.remarks,
            schedule_data: row.schedule_data,
            submitted_at: new Date(row.submitted_at || row.created_at).toLocaleString(),
            status: row.status,
            college_name: row.college_name,
          };
        });

        setRequests(mapped);
      } catch (err) {
        toast.error('Failed to load pending requests');
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
          params: {
            college_name: collegeName,
            limit: 50
          },
        });

        const mapped = res.data
          .filter((row: any) => row.status !== 'pending')
          .map((row: any) => ({
            request_id: row.request_id,
            sender_name: row.submitted_by_name || `${row.submitted_by?.first_name || ''} ${row.submitted_by?.last_name || ''}`.trim() || 'Unknown',
            subject: 'Exam Schedule Request',
            remarks: row.remarks,
            schedule_data: row.schedule_data,
            submitted_at: new Date(row.submitted_at || row.created_at).toLocaleString(),
            status: row.status,
            college_name: row.college_name,
          }));

        setHistory(mapped);
      } catch (err) {
        console.error('❌ Error fetching history:', err);
      }
    };

    fetchHistory();
  }, [collegeName, requests]);

  const handleDelete = async (req: DeanRequest) => {
    const confirmed = globalThis.confirm(`Delete this request for ${req.college_name}?`);
    if (!confirmed) return;

    try {
      await api.delete(`/tbl_scheduleapproval/${req.request_id}/`);
      setRequests(prev => prev.filter(r => r.request_id !== req.request_id));
      setHistory(prev => prev.filter(r => r.request_id !== req.request_id));
      toast.success('Request deleted');
      setSelectedRequest(null);
    } catch (err) {
      console.error('Delete failed:', err);
      toast.error('Failed to delete request');
    }
  };

  const handleUpdateStatus = async () => {
    if (!selectedRequest) return;

    try {
      await api.put(`/tbl_scheduleapproval/${selectedRequest.request_id}/`, {
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
      toast.error('Failed to update status');
    }
  };

  const handleReject = (req: DeanRequest) => {
    setSelectedRequest(req);
    setShowRejectionModal(true);
  };

  const sendNotificationToScheduler = async (
    schedulerId: number,
    deanUserId: number,
    status: 'approved' | 'rejected',
    collegeName: string,
    remarks?: string
  ) => {
    try {
      const notificationData = {
        user_id: schedulerId,
        sender_id: deanUserId,
        title: `Schedule ${status === 'approved' ? 'Approved' : 'Rejected'}`,
        message: status === 'approved'
          ? `Your schedule submission for ${collegeName} has been approved by the dean.`
          : `Your schedule submission for ${collegeName} has been rejected. Reason: ${remarks || 'No reason provided'}`,
        type: 'schedule_response',
        status: 'unread',
        link_url: '/scheduler',
        is_seen: false,
        priority: status === 'rejected' ? 2 : 1,
      };

      await api.post('/notifications/create/', notificationData);
    } catch (error) {
      console.error('❌ Failed to send notification to scheduler:', error);
    }
  };

  const confirmRejection = async () => {
    if (!selectedRequest) return;
    if (!rejectionReason.trim()) {
      toast.warn('Please provide a reason for rejection');
      return;
    }

    setProcessingRequest(true);
    try {
      await api.put(`/tbl_scheduleapproval/${selectedRequest.request_id}/`, {
        status: 'rejected',
        remarks: rejectionReason,
      });

      const schedulerUserId = selectedRequest.schedule_data?.submitted_by_id ||
        (await api.get(`/tbl_scheduleapproval/${selectedRequest.request_id}/`)).data.submitted_by;

      if (schedulerUserId && user?.user_id) {
        await sendNotificationToScheduler(
          schedulerUserId,
          user.user_id,
          'rejected',
          selectedRequest.schedule_data?.college_name || 'Unknown College',
          rejectionReason
        );
      }

      toast.success(`Schedule for ${selectedRequest.schedule_data?.college_name} rejected`);
      setRequests(prev => prev.filter(r => r.request_id !== selectedRequest.request_id));
      setHistory(prev => [{ ...selectedRequest, status: 'rejected', remarks: rejectionReason }, ...prev]);
      setShowRejectionModal(false);
      setRejectionReason('');
      setSelectedRequest(null);
    } catch (err) {
      console.error('Rejection error:', err);
      toast.error('Failed to reject schedule');
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
      const schedulerUserId = req.schedule_data?.submitted_by_id ||
        (await api.get(`/tbl_scheduleapproval/${req.request_id}/`)).data.submitted_by;

      await api.put(`/tbl_scheduleapproval/${req.request_id}/`, {
        status: 'approved'
      });

      if (schedulerUserId && user?.user_id) {
        await sendNotificationToScheduler(
          schedulerUserId,
          user.user_id,
          'approved',
          req.schedule_data?.college_name || 'Unknown College'
        );
      }

      toast.success(`Schedule for ${req.schedule_data?.college_name} approved successfully!`);
      setRequests(prev => prev.filter(r => r.request_id !== req.request_id));
      setHistory(prev => [{ ...req, status: 'approved' }, ...prev]);
      setSelectedRequest(null);
      setShowScheduleViewer(false);
    } catch (err) {
      console.error('Approval error:', err);
      toast.error('Failed to approve schedule');
    } finally {
      setProcessingRequest(false);
    }
  };

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
        onClick={() => {
          setSelectedRequest(req);
          setShowScheduleViewer(false);
        }}
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
      </div>

      <p className="deanreq-message">
        {showHistory
          ? `Showing approval history (${history.length} records)`
          : `You have ${requests.length} pending request(s) from schedulers`}
      </p>

      {showHistory ? renderCards(history) : renderCards(requests)}

      {selectedRequest && (
        <div
          className="deanreq-modal-overlay"
          onClick={() => {
            setSelectedRequest(null);
            setShowScheduleViewer(false);
          }}
        >
          <div
            className="deanreq-modal-pane"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: showScheduleViewer ? "95vw" : "600px",
              width: showScheduleViewer ? "90%" : "auto",
              maxHeight: "90vh",
              overflow: "auto",
            }}
          >
            {/* HEADER */}
            {!showScheduleViewer ? (
              <h3>From: {selectedRequest.sender_name}</h3>
            ) : (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "20px",
                  borderBottom: "2px solid #092C4C",
                  paddingBottom: "10px",
                }}
              >
                <h3 style={{ margin: 0 }}>Schedule Preview</h3>

                {/* Back Button */}
                <button
                  type="button"
                  onClick={() => setShowScheduleViewer(false)}
                  style={{
                    padding: "5px 10px",
                    background: "#666",
                    color: "white",
                    border: "none",
                    borderRadius: "100px",
                    cursor: "pointer",
                    fontWeight: "bold",
                  }}
                >
                  <FaChevronLeft />
                </button>
              </div>
            )}

            {/* BODY */}
            {!showScheduleViewer ? (
              <>
                <h4>
                  {selectedRequest.schedule_data?.college_name ||
                    selectedRequest.subject}
                </h4>

                {selectedRequest.schedule_data && (
                  <div
                    style={{
                      marginTop: "15px",
                      padding: "15px",
                      background: "#f5f5f5",
                      borderRadius: "8px",
                    }}
                  >
                    <p>
                      <strong>Exam Period:</strong>{" "}
                      {selectedRequest.schedule_data.exam_period}
                    </p>
                    <p>
                      <strong>Term:</strong> {selectedRequest.schedule_data.term}
                    </p>
                    <p>
                      <strong>Semester:</strong>{" "}
                      {selectedRequest.schedule_data.semester}
                    </p>
                    <p>
                      <strong>Academic Year:</strong>{" "}
                      {selectedRequest.schedule_data.academic_year}
                    </p>
                    <p>
                      <strong>Total Schedules:</strong>{" "}
                      {selectedRequest.schedule_data.total_schedules}
                    </p>

                    <button
                      type="button"
                      onClick={() => setShowScheduleViewer(true)}
                      style={{
                        marginTop: "10px",
                        padding: "5px 10px",
                        background: "#092C4C",
                        color: "white",
                        border: "none",
                        borderRadius: "6px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        fontSize: "10px",
                        fontWeight: "bold",
                      }}
                    >
                      View Schedule
                    </button>
                  </div>
                )}
              </>
            ) : (
              selectedRequest.schedule_data && (
                <DeanScheduleViewer scheduleData={selectedRequest.schedule_data} />
              )
            )}

            {/* ACTION BAR (Shown Once Only) */}
            <div
              style={{
                marginTop: "20px",
                display: "flex",
                gap: "10px",
                justifyContent: "flex-end",
                borderTop: showScheduleViewer ? "2px solid #ddd" : "none",
                paddingTop: showScheduleViewer ? "15px" : "0",
              }}
            >
              {/* IF NOT EDITING STATUS */}
              {!editStatus && (
                <>
                  {/* Close button only in main view */}
                  {!showScheduleViewer && (
                    <button
                      type="button"
                      onClick={() => setSelectedRequest(null)}
                      className="deanreq-btn1 cancel"
                    >
                      Close
                    </button>
                  )}

                  {/* Delete only in main view */}
                  {!showScheduleViewer && (
                    <button
                      type="button"
                      className="deanreq-btn1 deny"
                      style={{ backgroundColor: "#d32f2f", color: "white" }}
                      onClick={() => handleDelete(selectedRequest)}
                    >
                      Delete
                    </button>
                  )}

                  {/* Edit Status only if not pending */}
                  {!showScheduleViewer &&
                    selectedRequest.status !== "pending" &&
                    (
                      <button
                        type="button"
                        className="deanreq-btn"
                        style={{
                          backgroundColor: "#FF9800",
                          color: "white",
                          borderRadius: "50px",
                        }}
                        onClick={() => {
                          setEditStatus(true);
                          setNewStatus(selectedRequest.status || "pending");
                        }}
                      >
                        Edit Status
                      </button>
                    )}

                  {/* Approve / Reject (only ONCE) */}
                  {selectedRequest.status === "pending" && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleReject(selectedRequest)}
                        className="deanreq-btn1 deny"
                      >
                        Reject
                      </button>

                      <button
                        type="button"
                        onClick={() => handleApprove(selectedRequest)}
                        className="deanreq-btn1 approve"
                      >
                        Approve
                      </button>
                    </>
                  )}
                </>
              )}

              {/* IF EDITING STATUS — SHOW ONLY EDIT UI */}
              {editStatus && (
                <>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value)}
                    style={{
                      padding: "6px",
                      borderRadius: "4px",
                      border: "1px solid #ccc",
                      background: "white",
                      color: "black",
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
            </div>
          </div>
        </div>
      )}

      {showRejectionModal && (
        <div className="deanreq-modal-overlay" onClick={() => setShowRejectionModal(false)}>
          <div className="deanreq-modal-pane" onClick={e => e.stopPropagation()}>
            <h3>Rejection Reason</h3>
            <textarea
              value={rejectionReason}
              onChange={e => setRejectionReason(e.target.value)}
              placeholder="Enter reason for rejection..."
              rows={5}
              style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }}
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