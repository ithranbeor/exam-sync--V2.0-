import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient.ts';
import '../styles/deanrequests.css';
import { FaArchive  } from "react-icons/fa";

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
      const { data, error } = await supabase
        .from('tbl_scheduleapproval')
        .select(`
          request_id,
          remarks,
          submitted_at,
          file_url,
          status,
          tbl_users:submitted_by (
            first_name,
            last_name
          )
        `)
        .eq('status', 'pending');

      if (!error) {
        const mapped = (data ?? []).map((row: any) => ({
          request_id: row.request_id,
          sender_name: `${row.tbl_users.first_name} ${row.tbl_users.last_name}`,
          subject: 'Exam Schedule Request',
          remarks: row.remarks,
          file_url: row.file_url,
          submitted_at: new Date(row.submitted_at).toLocaleDateString(),
          status: row.status,
        }));
        setRequests(mapped);
      }
    };

    fetchRequests();
  }, []);

  // fetch approved/rejected
  useEffect(() => {
    const fetchHistory = async () => {
      const { data, error } = await supabase
        .from('tbl_scheduleapproval')
        .select(`
          request_id,
          remarks,
          submitted_at,
          file_url,
          status,
          tbl_users:submitted_by (
            first_name,
            last_name
          )
        `)
        .in('status', ['approved', 'rejected'])
        .order('submitted_at', { ascending: false })
        .limit(20);

      if (!error) {
        const mapped = (data ?? []).map((row: any) => ({
          request_id: row.request_id,
          sender_name: `${row.tbl_users.first_name} ${row.tbl_users.last_name}`,
          subject: 'Exam Schedule Request',
          remarks: row.remarks,
          file_url: row.file_url,
          submitted_at: new Date(row.submitted_at).toLocaleDateString(),
          status: row.status,
        }));
        setHistory(mapped);
      }
    };

    fetchHistory();
  }, []);

  const updateStatus = async (req: DeanRequest, status: 'approved' | 'rejected') => {
    const { error } = await supabase
      .from('tbl_scheduleapproval')
      .update({ status })
      .eq('request_id', req.request_id);

    if (!error) {
      setRequests((prev) => prev.filter((r) => r.request_id !== req.request_id));
      setHistory((prev) => [{ ...req, status }, ...prev]);
      setSelectedRequest(null);
    } else {
      console.error(error);
      alert('Failed to update status');
    }
  };

  // render list cards
  const renderCards = (arr: DeanRequest[]) =>
    arr.map((req) => (
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
            <span
              style={{
                marginLeft: 6,
                color: req.status === 'approved' ? 'green' : 'red',
              }}
            >
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
        {/* clickable icon in the right corner */}
        <span
          className="deanreq-history-icon"
          onClick={() => setShowHistory((s) => !s)}
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

      {/* Pending list */}
      {renderCards(requests)}

      {/* History list */}
      {showHistory && (
        <>
          {renderCards(history)}
        </>
      )}

      {selectedRequest && (
        <div
          className="deanreq-modal-overlay"
          onClick={() => setSelectedRequest(null)}
        >
          <div
            className="deanreq-modal-pane"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>From: {selectedRequest.sender_name}</h3>
            <h4>Subject: {selectedRequest.subject}</h4>

            <div className="deanreq-body">
              <p>{selectedRequest.remarks}</p>

              {selectedRequest.file_url && (
                <iframe
                  src={
                    supabase
                      .storage
                      .from('schedule-pdfs')
                      .getPublicUrl(selectedRequest.file_url)
                      .data.publicUrl
                  }
                  width="100%"
                  height="400"
                  title="Schedule PDF"
                />
              )}
              {selectedRequest.file_url && (
                <p style={{ marginTop: '8px' }}>
                  <a
                    href={
                      supabase
                        .storage
                        .from('schedule-pdfs')
                        .getPublicUrl(selectedRequest.file_url)
                        .data.publicUrl
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open PDF in new tab
                  </a>
                </p>
              )}
            </div>

            <div className="deanreq-actions">
              <button
                type="button"
                onClick={() => setSelectedRequest(null)}
                className="deanreq-btn cancel"
              >
                Close
              </button>
              {selectedRequest.status === 'pending' && (
                <>
                  <button
                    type="button"
                    onClick={() => updateStatus(selectedRequest, 'approved')}
                    className="deanreq-btn approve"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => updateStatus(selectedRequest, 'rejected')}
                    className="deanreq-btn deny"
                  >
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
