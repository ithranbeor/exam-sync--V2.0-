import React, { useState, useEffect } from 'react';
import { api } from '../lib/apiClient.ts'; // Axios instance
import '../styles/deanrequests.css';
import { FaArchive } from "react-icons/fa";

type DeanRequest = {
  request_id: string;
  sender_name: string;
  subject: string;
  remarks: string;
  submitted_at: string;
  file_url: string;
  status?: string;
};

const DeanRequests: React.FC = () => {
  const [requests, setRequests] = useState<DeanRequest[]>([]);
  const [history, setHistory] = useState<DeanRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<DeanRequest | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  // fetch pending
  useEffect(() => {
    const fetchRequests = async () => {
      try {
        const res = await api.get('/schedule-requests', { params: { status: 'pending' } });
        const mapped = res.data.map((row: any) => ({
          request_id: row.request_id,
          sender_name: `${row.submitted_by.first_name} ${row.submitted_by.last_name}`,
          subject: 'Exam Schedule Request',
          remarks: row.remarks,
          file_url: row.file_url,
          submitted_at: new Date(row.submitted_at).toLocaleDateString(),
          status: row.status,
        }));
        setRequests(mapped);
      } catch (err) {
        console.error('Error fetching pending requests:', err);
      }
    };
    fetchRequests();
  }, []);

  // fetch approved/rejected
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await api.get('/schedule-requests', { 
          params: { status: ['approved','rejected'], limit: 20, order: 'desc' } 
        });
        const mapped = res.data.map((row: any) => ({
          request_id: row.request_id,
          sender_name: `${row.submitted_by.first_name} ${row.submitted_by.last_name}`,
          subject: 'Exam Schedule Request',
          remarks: row.remarks,
          file_url: row.file_url,
          submitted_at: new Date(row.submitted_at).toLocaleDateString(),
          status: row.status,
        }));
        setHistory(mapped);
      } catch (err) {
        console.error('Error fetching request history:', err);
      }
    };
    fetchHistory();
  }, []);

  const updateStatus = async (req: DeanRequest, status: 'approved' | 'rejected') => {
    try {
      await api.patch(`/schedule-requests/${req.request_id}`, { status });
      setRequests(prev => prev.filter(r => r.request_id !== req.request_id));
      setHistory(prev => [{ ...req, status }, ...prev]);
      setSelectedRequest(null);
    } catch (err) {
      console.error('Failed to update status:', err);
      alert('Failed to update status');
    }
  };

  const renderCards = (arr: DeanRequest[]) =>
    arr.map(req => (
      <div
        key={req.request_id}
        className="deanreq-card"
        onClick={() => setSelectedRequest(req)}
      >
        <div className="deanreq-left">
          <span className="deanreq-icon">⏵</span>
          <span className="deanreq-sender">{req.sender_name}</span>
        </div>
        <div className="deanreq-center">• {req.subject}</div>
        <div className="deanreq-date">
          {req.submitted_at}
          {req.status && req.status !== 'pending' && (
            <span style={{ marginLeft: 6, color: req.status === 'approved' ? 'green' : 'red' }}>
              ({req.status})
            </span>
          )}
        </div>
      </div>
    ));

  return (
    <div className="deanreq-container">
      <div className="deanreq-banner">
        Requests
        <span
          className="deanreq-history-icon"
          onClick={() => setShowHistory(s => !s)}
          title="View recently approved/denied"
          style={{ float: 'right', cursor: 'pointer', fontSize: '1.2rem' }}
        >
          <FaArchive />
        </span>
      </div>

      <p className="deanreq-message">
        {showHistory
          ? 'Recently Approved / Denied'
          : 'Below are the latest requests submitted by the Scheduler.'}
      </p>

      {renderCards(requests)}
      {showHistory && renderCards(history)}

      {selectedRequest && (
        <div className="deanreq-modal-overlay" onClick={() => setSelectedRequest(null)}>
          <div className="deanreq-modal-pane" onClick={e => e.stopPropagation()}>
            <h3>From: {selectedRequest.sender_name}</h3>
            <h4>Subject: {selectedRequest.subject}</h4>
            <div className="deanreq-body">
              <p>{selectedRequest.remarks}</p>
              {selectedRequest.file_url && (
                <>
                  <iframe
                    src={`/files/${selectedRequest.file_url}`}
                    width="100%"
                    height="400"
                    title="Schedule PDF"
                  />
                  <p style={{ marginTop: '8px' }}>
                    <a href={`/files/${selectedRequest.file_url}`} target="_blank" rel="noopener noreferrer">
                      Open PDF in new tab
                    </a>
                  </p>
                </>
              )}
            </div>

            <div className="deanreq-actions">
              <button type="button" onClick={() => setSelectedRequest(null)} className="deanreq-btn cancel">
                Close
              </button>
              {selectedRequest.status === 'pending' && (
                <>
                  <button type="button" onClick={() => updateStatus(selectedRequest, 'approved')} className="deanreq-btn approve">
                    Approve
                  </button>
                  <button type="button" onClick={() => updateStatus(selectedRequest, 'rejected')} className="deanreq-btn deny">
                    Deny
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeanRequests;
