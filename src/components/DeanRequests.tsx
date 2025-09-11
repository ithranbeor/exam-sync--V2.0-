import React, { useState } from 'react';
import '../styles/deanrequests.css';

type DeanRequest = {
  id: number;
  sender: string;
  subject: string;
  message: string;
  date: string;
};

const requests: DeanRequest[] = [
  {
    id: 1,
    sender: "Instructor: Marealle Elnasin",
    subject: "Request for Exam Reschedule",
    message:
      "I would like to request a reschedule for IT 222 exam due to conflict with departmental activity.",
    date: "2025/06/01",
  },
  {
    id: 2,
    sender: "Instructor: Juan Dela Cruz",
    subject: "Additional Proctor Request",
    message:
      "Our exam session for IT 101 has more than 100 students, requesting an additional proctor.",
    date: "2025/06/02",
  },
];

const DeanRequests: React.FC = () => {
  const [selectedRequest, setSelectedRequest] = useState<DeanRequest | null>(
    null
  );

  return (
    <div className="deanreq-container">
      <div className="deanreq-banner">Requests</div>
      <p className="deanreq-message">
        Below are the latest requests submitted by instructors.
      </p>

      {requests.map((req) => (
        <div
          key={req.id}
          className="deanreq-card"
          onClick={() => setSelectedRequest(req)}
        >
          <div className="deanreq-left">
            <span className="deanreq-icon">⏵</span>
            <span className="deanreq-sender">{req.sender}</span>
          </div>
          <div className="deanreq-center">• {req.subject}</div>
          <div className="deanreq-date">{req.date}</div>
        </div>
      ))}

      {selectedRequest && (
        <div
          className="deanreq-modal-overlay"
          onClick={() => setSelectedRequest(null)}
        >
          <div
            className="deanreq-modal-pane"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>From: {selectedRequest.sender}</h3>
            <h4>Subject: {selectedRequest.subject}</h4>

            <div className="deanreq-body">
              <p>{selectedRequest.message}</p>
            </div>

            <div className="deanreq-actions">
              <button
                type="button"
                onClick={() => setSelectedRequest(null)}
                className="deanreq-btn cancel"
              >
                Close
              </button>
              <button type="button" className="deanreq-btn approve">
                Approve
              </button>
              <button type="button" className="deanreq-btn deny">
                Deny
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeanRequests;
