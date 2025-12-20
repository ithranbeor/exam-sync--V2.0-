import React, { useState, useEffect } from 'react';
import { api } from '../lib/apiClient.ts';
import '../styles/F_Notification.css';
import { FaCheckCircle, FaTimesCircle, FaTrash, FaEnvelopeOpenText, FaTimes } from "react-icons/fa";

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
  const [selectedNotificationIds, setSelectedNotificationIds] = useState<Set<number>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);

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

  useEffect(() => {
    setSelectedNotificationIds(prev => {
      const next = new Set<number>();
      notifications.forEach(n => {
        if (prev.has(n.notification_id)) {
          next.add(n.notification_id);
        }
      });
      return next;
    });
  }, [notifications]);

  const handleNotificationClick = async (notif: Notification) => {
    if (!notif.is_seen) {
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
      } catch (err) {
        console.error("Error marking notification as read:", err);
      }
    }

    setSelectedNotification(notif);
  };

  const handleCloseModal = () => {
    setSelectedNotification(null);
  };

  const handleMarkAllUnread = async () => {
    if (!user?.user_id) return;
    try {
      await api.patch(`/notifications/${user.user_id}/mark-all-unread/`); 
      setNotifications(prev =>
        prev.map(n => ({ ...n, is_seen: false, read_at: null }))
      );
    } catch (err) {
      console.error("Error marking all unread:", err);
    }
  };

  const unreadCount = notifications.filter(n => !n.is_seen).length;
  const isAllSelected = notifications.length > 0 && selectedNotificationIds.size === notifications.length;

  const toggleSelect = (notificationId: number) => {
    setSelectedNotificationIds(prev => {
      const next = new Set(prev);
      if (next.has(notificationId)) {
        next.delete(notificationId);
      } else {
        next.add(notificationId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedNotificationIds(new Set());
      return;
    }
    setSelectedNotificationIds(new Set(notifications.map(n => n.notification_id)));
  };

  const handleBulkDeleteSelected = async () => {
    const ids = Array.from(selectedNotificationIds);
    if (ids.length === 0) {
      window.alert('No notifications selected.');
      return;
    }
    if (!window.confirm(`Delete ${ids.length} selected notification${ids.length === 1 ? '' : 's'}? This action cannot be undone.`)) {
      return;
    }
    setIsBulkDeleting(true);
    try {
      await Promise.allSettled(ids.map(id => api.delete(`/notifications/${id}/delete/`)));
      setSelectedNotificationIds(new Set());
      fetchNotifications();
    } catch (err) {
      console.error('Bulk delete notifications error:', err);
    } finally {
      setIsBulkDeleting(false);
    }
  };

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
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '1px' }}>
          <button className="notif-btn" title="Mark all as unread" onClick={handleMarkAllUnread}>
            <FaEnvelopeOpenText />
          </button>
          <button
            className="notif-btn"
            title="Delete selected"
            onClick={handleBulkDeleteSelected}
            disabled={selectedNotificationIds.size === 0 || isBulkDeleting}
          >
            <FaTrash />
          </button>

          <input
            type="checkbox"
            className="notif-btn"
            checked={isAllSelected}
            onChange={toggleSelectAll}
            disabled={notifications.length === 0}
            aria-label="Select all notifications"
          />
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
              cursor: 'pointer'
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
            </div>

            <div className="notif-center">
              <div className="notif-sender-name">{notif.sender_name || 'System'}</div>
              {notif.title && (
                <div className="notif-title">{notif.title}</div>
              )}
            </div>

            <div className="notif-right" onClick={(e) => e.stopPropagation()}>
              <div className="notif-date">{new Date(notif.created_at).toLocaleString()}</div>
              <input
                type="checkbox"
                checked={selectedNotificationIds.has(notif.notification_id)}
                onChange={() => toggleSelect(notif.notification_id)}
                aria-label={`Select notification from ${notif.sender_name || 'System'}`}
              />
            </div>
          </div>
        ))
      )}

      {selectedNotification && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal-message-pane" onClick={(e) => e.stopPropagation()}>
            <button
              className="modal-close-btn"
              onClick={handleCloseModal}
              aria-label="Close modal"
            >
              <FaTimes />
            </button>
            <h3>{selectedNotification.sender_name || 'System'}</h3>
            {selectedNotification.title && (
              <h4>{selectedNotification.title}</h4>
            )}
            <div className="message-body">
              <div style={{ whiteSpace: 'pre-wrap', wordWrap: 'break-word' }}>
                {selectedNotification.message}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Notification;