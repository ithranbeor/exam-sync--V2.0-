// deno-lint-ignore-file no-explicit-any
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/apiClient.ts';
import '../styles/notification.css';

type Notification = {
  id: number;
  sender_id: number;
  sender_name: string;
  receiver_id: number;
  receiver_name: string;
  message: string;
  status: 'pending' | 'approved' | 'rejected' | null;
  file_url: string | null;
  request_id: string | null;
  created_at: string;
};

const Scheduler_Notification: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        // 1️⃣ Get logged-in user from local/session storage
        const storedUser = JSON.parse(
          localStorage.getItem('user') || sessionStorage.getItem('user') || '{}'
        );
        if (!storedUser?.user_id) {
          console.error('No logged-in user found');
          return;
        }
        const currentUserId = storedUser.user_id;

        // 2️⃣ Fetch notifications via REST API
        const { data } = await api.get<Notification[]>(`/notifications?receiver_id=${currentUserId}`);

        if (data) {
          // Optional: sort descending by created_at
          const sorted = data.sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
          setNotifications(sorted);
        }
      } catch (err: any) {
        console.error('Error fetching notifications:', err.response?.data || err.message);
      }
    };

    fetchNotifications();
  }, []);

  const openInbox = (notif: Notification) => {
    navigate(`/inbox/${notif.request_id || notif.id}`);
  };

  return (
    <div className="notification-container">
      <div className="notification-banner">Notifications</div>
      <p className="notification-message">
        You have {notifications.length} notification(s)
      </p>

      {notifications.map((notif) => (
        <div
          key={notif.id}
          className="notification-card"
          onClick={() => openInbox(notif)}
        >
          <div className="notif-left">
            <span className="notif-icon">⏵</span>
            <span className="notif-sender">{notif.sender_name}</span>
          </div>

          <div className="notif-center">
            • {notif.message}{' '}
            {notif.status && (
              <span
                style={{
                  marginLeft: 6,
                  color:
                    notif.status === 'approved'
                      ? 'green'
                      : notif.status === 'rejected'
                      ? 'red'
                      : 'gray',
                }}
              >
                ({notif.status})
              </span>
            )}
          </div>

          <div className="notif-date">
            {new Date(notif.created_at).toLocaleString()}
          </div>

          {notif.file_url && (
            <a
              href={notif.file_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ marginLeft: 'auto', fontSize: '0.9rem' }}
              onClick={(e) => e.stopPropagation()} // prevent triggering openInbox
            >
              View File
            </a>
          )}
        </div>
      ))}
    </div>
  );
};

export default Scheduler_Notification;
