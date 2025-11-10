import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/apiClient.ts';
import '../styles/notification.css';
import { FaCheckCircle, FaTimesCircle, FaTrash, FaTrashAlt, FaEnvelopeOpenText } from "react-icons/fa";

interface UserProps {
  user: {
    user_id: number;
    email_address: string;
    first_name?: string;
    last_name?: string;
    middle_name?: string;
  } | null;
}

type Notification = {
  notification_id: number;
  user_id: number;
  sender_id: number | null;
  title: string | null;
  message: string;
  type: string | null;
  status: string | null;
  link_url: string | null;
  is_seen: boolean;
  created_at: string;
  read_at: string | null;
  priority: number;
  sender_name?: string;
};

const Notification: React.FC<UserProps> = ({ user }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Fetch notifications
  const fetchNotifications = async () => {
    if (!user?.user_id) {
      setLoading(false);
      return;
    }

    try {
      const res = await api.get(`/notifications/${user.user_id}/`);
      const data: Notification[] = res.data.map((n: any) => ({
        notification_id: n.notification_id,
        user_id: n.user_id,
        sender_id: n.sender_id,
        title: n.title,
        message: n.message,
        type: n.type,
        status: n.status,
        link_url: n.link_url,
        is_seen: n.is_seen ?? false,
        created_at: n.created_at,
        read_at: n.read_at,
        priority: n.priority ?? 0,
        sender_name: n.sender_full_name || 'System'
      }));
      setNotifications(data);
    } catch (err) {
      console.error("Fetch notifications error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 10000);
    return () => clearInterval(interval);
  }, [user]);

  // Handle click on notification
  const handleNotificationClick = async (notif: Notification) => {
    try {
      await api.patch(`/notifications/${notif.notification_id}/update/`, {
        is_seen: true
      });

      setNotifications(prev =>
        prev.map(n =>
          n.notification_id === notif.notification_id
            ? { ...n, is_seen: true, read_at: new Date().toISOString() }
            : n
        )
      );

      if (notif.link_url) {
        navigate(notif.link_url);
      }
    } catch (err) {
      console.error("Error marking notification as read:", err);
    }
  };

  // Delete one notification
  const handleDelete = async (notification_id: number) => {
    if (!user?.user_id) return;
    try {
      await api.delete(`/notifications/${notification_id}/delete/`);
      setNotifications(prev => prev.filter(n => n.notification_id !== notification_id));
    } catch (err) {
      console.error("Error deleting notification:", err);
    }
  };

  // Delete all notifications for current user
  const handleDeleteAll = async () => {
    if (!user?.user_id) return;
    if (!window.confirm('Delete all your notifications?')) return;

    try {
      await api.delete(`/notifications/${user.user_id}/delete-all/`); // Optional: create a delete-all endpoint
      setNotifications([]);
    } catch (err) {
      console.error("Error deleting all notifications:", err);
    }
  };

  // Mark all as unread
  const handleMarkAllUnread = async () => {
    if (!user?.user_id) return;
    try {
      await api.patch(`/notifications/${user.user_id}/mark-all-unread/`); // Optional: create this endpoint
      setNotifications(prev =>
        prev.map(n => ({ ...n, is_seen: false, read_at: null }))
      );
    } catch (err) {
      console.error("Error marking all unread:", err);
    }
  };

  const unreadCount = notifications.filter(n => !n.is_seen).length;

  if (loading) {
    return (
      <div className="notification-container">
        <div className="notification-banner">Notifications</div>
        <p className="notification-message">Loading notifications...</p>
      </div>
    );
  }

  return (
    <div className="notification-container">
      <div className="notification-banner">
        <span>Notifications</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
          <button className="notif-btn" title="Mark all as unread" onClick={handleMarkAllUnread}>
            <FaEnvelopeOpenText />
          </button>
          <button className="notif-btn" title="Delete all" onClick={handleDeleteAll}>
            <FaTrashAlt />
          </button>
        </div>
      </div>

      <p className="notification-message">
        You have {unreadCount} unread notification(s)
        {notifications.length > 0 && ` (Total: ${notifications.length})`}
      </p>

      {notifications.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#666', fontSize: '14px' }}>
          No notifications yet
        </div>
      ) : (
        notifications.map(notif => (
          <div
            key={notif.notification_id}
            className="notification-card"
            onClick={() => handleNotificationClick(notif)}
            style={{
              backgroundColor: notif.is_seen ? '#f9f9f9' : '#fff',
              fontWeight: notif.is_seen ? 'normal' : 'bold',
              borderLeft: notif.is_seen ? '3px solid #ccc' : '3px solid #092C4C',
              cursor: 'pointer',
              position: 'relative'
            }}
          >
            <div className="notif-left">
              <span className="notif-icon">
                {notif.priority === 2 ? (
                  <FaTimesCircle style={{ color: '#f44336' }} />
                ) : notif.priority === 1 ? (
                  <FaCheckCircle style={{ color: '#4CAF50' }} />
                ) : (
                  '⏵'
                )}
              </span>
              <span className="notif-sender">{notif.sender_name || 'System'}</span>
            </div>

            <div className="notif-center">
              {notif.title && (
                <>
                  <strong>{notif.title}</strong>
                  <br />
                </>
              )}
              {notif.message}
            </div>

            <div className="notif-date">{new Date(notif.created_at).toLocaleString()}</div>

            <button
              className="notif-delete-btn"
              title="Delete notification"
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(notif.notification_id);
              }}
            >
              <FaTrash />
            </button>
          </div>
        ))
      )}
    </div>
  );
};

export default Notification;