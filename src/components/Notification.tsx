import React, { useState } from 'react';
import '../styles/notification.css';


type Notification = {
  id: number;
  sender: string;
  instructor: string;
  message: string;
  date: string;
};


const notifications: Notification[] = [
  {
    id: 1,
    sender: 'Scheduler',
    instructor: 'Arnel Omadam',
    message: 'Proctor 1 | Midterm Examination',
    date: '2025/05/23',
  },
  {
    id: 2,
    sender: 'Scheduler',
    instructor: 'Raniah Taurac',
    message: 'Proctor 2 | Midterm Examination',
    date: '2025/05/23',
  },
];


const Scheduler_Notification: React.FC = () => {
  const [selectedNotif, setSelectedNotif] = useState<Notification | null>(null);


  return (
    <div className="notification-container">
      <div className="notification-header">
      </div>


      <div className="notification-banner">Notification</div>
      <p className="notification-message">You have sent a message to the proctors!</p>


      {notifications.map((notif) => (
        <div
          key={notif.id}
          className="notification-card"
          onClick={() => setSelectedNotif(notif)}
        >
          <div className="notif-left">
            <span className="notif-icon">⏵</span>
            <span className="notif-sender">{notif.sender}</span>
          </div>
          <div className="notif-center">• {notif.message}</div>
          <div className="notif-date">{notif.date}</div>
        </div>
      ))}


      {selectedNotif && (
        <div className="modal-overlay" onClick={() => setSelectedNotif(null)}>
          <div className="modal-message-pane" onClick={(e) => e.stopPropagation()}>
            <h3>To: {selectedNotif.instructor}</h3>
            <h4>Subject: Midterm Examination</h4>


            <div className="message-body">
              <p>
                Dear {selectedNotif.instructor},
              </p>
              <p>
                We are pleased to inform you that you have been assigned as a proctor for the
                upcoming <strong>Midterm Examination</strong>. Your availability and department
                schedule have been considered in the plotting of this schedule.
              </p>
              <p>
                Attached herewith is the official exam schedule file containing the list of subjects,
                time slots, and rooms you are scheduled to oversee.
              </p>
              <div className="attachment">
                📎 <a href="#">Midterm_Exam_Schedule.pdf</a>
              </div>
              <p>
                Please confirm your receipt of this message and review the attached file for any concerns or conflicts. Should you require any changes, kindly reach out to the Scheduling Office as soon as possible.
              </p>
              <p>Thank you for your support and cooperation.</p>
              <p>Best regards,<br />Scheduler Team</p>
            </div>


            <div className="disclaimer">
              <small>
                Disclaimer: <br />
                The information in this electronic message is privileged and confidential,
                intended only for use of the individual or entity named as addressee and recipient.
                If you are not the addressee indicated in this message (or responsible for delivery
                of the message to such person), you may not copy, use, disseminate or deliver this
                message. In such case, you should immediately delete this e-mail and notify the sender
                by reply e-mail. Please advise immediately if you or your employer do not consent to
                Internet e-mail for messages of this kind. Opinions, conclusions and other information
                expressed in this message are not given, nor endorsed by and are not the responsibility
                of USTP unless otherwise indicated by an authorized representative of USTP independent
                of this message.
              </small>
            </div>


            <div className="modal-actions">
              <button type="button" onClick={() => setSelectedNotif(null)} className="modal-button cancel">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


export default Scheduler_Notification;
