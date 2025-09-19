import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from "../lib/supabaseClient.ts";
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
  request_id: string | null;   // uuid
  created_at: string;
};

const Scheduler_Notification: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchNotifications = async () => {
      // get current logged-in user id
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        console.error("No logged in user");
        return;
      }

      // your tbl_users.user_id may be stored in user.user_metadata
      // adjust accordingly; for example:
      const currentUserId =
        (user.user_metadata && user.user_metadata.user_id) || user.id;

      // now fetch only notifications for this receiver_id
      const { data, error } = await supabase
        .from('tbl_notifications')
        .select(
          'id, sender_id, sender_name, receiver_id, receiver_name, message, status, file_url, request_id, created_at'
        )
        .eq('receiver_id', currentUserId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching notifications:', error.message);
      } else if (data) {
        setNotifications(data);
      }
    };

    fetchNotifications();
  }, []);

  const openInbox = (notif: Notification) => {
    // Navigate to your detailed inbox page
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

          {/* Optional file link */}
          {notif.file_url && (
            <a
              href={
                supabase.storage
                  .from('schedule-pdfs')
                  .getPublicUrl(notif.file_url).data.publicUrl
              }
              target="_blank"
              rel="noopener noreferrer"
              style={{ marginLeft: 'auto', fontSize: '0.9rem' }}
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
