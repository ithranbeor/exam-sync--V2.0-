import React, { useState, useEffect } from 'react';
import { api } from '../lib/apiClient.ts';
import '../styles/F_Notification.css';
import { FaCheckDouble, FaTrash, FaEnvelopeOpenText, FaTimes, FaBell } from 'react-icons/fa';

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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractSenderFromMessage(message: string): string | null {
  const match = message.match(
    /^([A-Za-zÀ-ÿ\s\-'.]+?)\s+(has |requested |submitted |updated )/i
  );
  return match ? match[1].trim() : null;
}

function resolveSenderName(notif: Notification): string {
  if (notif.sender_name && notif.sender_name !== 'System' && notif.sender_name.trim() !== '') {
    return notif.sender_name;
  }
  const extracted = extractSenderFromMessage(notif.message);
  if (extracted) return extracted;
  return 'System';
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  const hrs  = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);

  if (mins < 1)  return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  if (hrs  < 24) return `${hrs}h ago`;
  if (days === 1) return 'Yesterday';
  if (days < 7)  return `${days}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getNotifTypeLabel(type: string | null): string {
  switch (type) {
    case 'availability_set': return 'Availability';
    case 'change_request':   return 'Change Request';
    case 'schedule':         return 'Schedule';
    case 'approved':         return 'Approved';
    case 'rejected':         return 'Rejected';
    default:                 return 'Notice';
  }
}

function getNotifTypeColor(type: string | null): string {
  switch (type) {
    case 'availability_set': return '#2563eb';
    case 'change_request':   return '#d97706';
    case 'approved':         return '#059669';
    case 'rejected':         return '#dc2626';
    default:                 return '#6b7280';
  }
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(n => n[0].toUpperCase())
    .join('');
}

/** Truncate a message to a short preview (first sentence or N chars). */
function getMessagePreview(message: string, maxLength = 80): string {
  // Try to cut at the first sentence boundary
  const sentenceEnd = message.search(/[.!?]/);
  if (sentenceEnd > 0 && sentenceEnd <= maxLength) {
    return message.slice(0, sentenceEnd + 1);
  }
  if (message.length <= maxLength) return message;
  return message.slice(0, maxLength).trimEnd() + '…';
}

// ─── Component ───────────────────────────────────────────────────────────────

const Notification: React.FC<UserProps> = ({ user }) => {
  const [notifications, setNotifications]   = useState<Notification[]>([]);
  const [loading, setLoading]               = useState(true);
  const [selectedIds, setSelectedIds]       = useState<Set<number>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [selected, setSelected]             = useState<Notification | null>(null);
  const [filter, setFilter]                 = useState<'all' | 'unread' | 'read'>('all');

  // ── Fetch ─────────────────────────────────────────────────────────────────

  const fetchNotifications = async () => {
    if (!user?.user_id) { setLoading(false); return; }
    try {
      const res = await api.get(`/notifications/${user.user_id}/`);
      const data: Notification[] = res.data.map((n: any) => ({
        notification_id: n.notification_id,
        user_id:         n.user_id,
        sender_id:       n.sender_id,
        title:           n.title,
        message:         n.message,
        type:            n.type,
        status:          n.status,
        link_url:        n.link_url,
        is_seen:         n.is_seen ?? false,
        created_at:      n.created_at,
        read_at:         n.read_at,
        priority:        n.priority ?? 0,
        sender_name:     n.sender_full_name || n.sender_name || '',
      }));

      // Newest first
      data.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setNotifications(data);
    } catch (err) {
      console.error('Fetch notifications error:', err);
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
    setSelectedIds(prev => {
      const next = new Set<number>();
      notifications.forEach(n => { if (prev.has(n.notification_id)) next.add(n.notification_id); });
      return next;
    });
  }, [notifications]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const handleClick = async (notif: Notification) => {
    if (!notif.is_seen) {
      try {
        await api.patch(`/notifications/${notif.notification_id}/update/`, { is_seen: true });
        setNotifications(prev =>
          prev.map(n =>
            n.notification_id === notif.notification_id
              ? { ...n, is_seen: true, read_at: new Date().toISOString() }
              : n
          )
        );
      } catch (err) {
        console.error('Mark read error:', err);
      }
    }
    setSelected(notif);
  };

  const handleMarkAllRead = async () => {
    const unread = notifications.filter(n => !n.is_seen);
    if (!unread.length) return;
    const now = new Date().toISOString();
    await Promise.all(
      unread.map(n => api.patch(`/notifications/${n.notification_id}/update/`, { is_seen: true, read_at: now }))
    );
    setNotifications(prev => prev.map(n => ({ ...n, is_seen: true, read_at: now })));
  };

  const handleMarkAllUnread = async () => {
    const seen = notifications.filter(n => n.is_seen);
    if (!seen.length) return;
    await Promise.all(
      seen.map(n => api.patch(`/notifications/${n.notification_id}/update/`, { is_seen: false, read_at: null }))
    );
    setNotifications(prev => prev.map(n => ({ ...n, is_seen: false, read_at: null })));
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    if (!window.confirm(`Delete ${ids.length} notification${ids.length > 1 ? 's' : ''}?`)) return;
    setIsBulkDeleting(true);
    await Promise.allSettled(ids.map(id => api.delete(`/notifications/${id}/delete/`)));
    setSelectedIds(new Set());
    await fetchNotifications();
    setIsBulkDeleting(false);
  };

  const toggleSelect = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const isAllSelected = notifications.length > 0 && selectedIds.size === notifications.length;
  const toggleSelectAll = () =>
    setSelectedIds(isAllSelected ? new Set() : new Set(notifications.map(n => n.notification_id)));

  // ── Derived ───────────────────────────────────────────────────────────────

  const unreadCount = notifications.filter(n => !n.is_seen).length;

  const filteredNotifications = notifications.filter(n => {
    if (filter === 'unread') return !n.is_seen;
    if (filter === 'read')   return n.is_seen;
    return true;
  });

  const tabCounts = {
    all:    notifications.length,
    unread: notifications.filter(n => !n.is_seen).length,
    read:   notifications.filter(n =>  n.is_seen).length,
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="notif-root">

        {/* Header */}
        <div className="notif-header">
          <div className="notif-header-left">
            <div className="notif-icon-wrap">
              <FaBell />
              {unreadCount > 0 && (
                <span className="notif-icon-badge">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </div>
            <div className="notif-title-block">
              <h1>Notifications</h1>
              <p>
                {unreadCount > 0
                  ? `${unreadCount} unread · ${notifications.length} total`
                  : `All caught up · ${notifications.length} total`}
              </p>
            </div>
          </div>

          <div className="notif-toolbar">
            <button className="notif-action-btn" onClick={handleMarkAllRead}>
              <FaCheckDouble size={13} /> Mark all read
            </button>
            <button className="notif-action-btn" onClick={handleMarkAllUnread}>
              <FaEnvelopeOpenText size={13} /> Mark all unread
            </button>
            <button
              className="notif-action-btn danger"
              onClick={handleBulkDelete}
              disabled={selectedIds.size === 0 || isBulkDeleting}
            >
              <FaTrash size={13} />
              {isBulkDeleting
                ? 'Deleting...'
                : `Delete${selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}`}
            </button>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="notif-filters">
          {(['all', 'unread', 'read'] as const).map(f => (
            <button
              key={f}
              className={`notif-filter-tab ${filter === f ? 'active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
              <span className="tab-count">{tabCounts[f]}</span>
            </button>
          ))}
        </div>

        {/* Select All Row */}
        {filteredNotifications.length > 0 && (
          <div className="notif-select-row">
            <input
              type="checkbox"
              checked={isAllSelected}
              onChange={toggleSelectAll}
              aria-label="Select all notifications"
            />
            <span>
              {selectedIds.size > 0
                ? `${selectedIds.size} of ${notifications.length} selected`
                : 'Select all'}
            </span>
          </div>
        )}

        {/* List */}
        {loading ? (
          <div className="notif-loading">
            <div className="notif-spinner" />
            Loading notifications…
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="notif-empty">
            <div className="notif-empty-icon"><FaBell /></div>
            <h3>No notifications</h3>
            <p>
              {filter === 'unread'
                ? 'You have no unread notifications.'
                : filter === 'read'
                ? 'No read notifications yet.'
                : "You're all caught up!"}
            </p>
          </div>
        ) : (
          filteredNotifications.map(notif => {
            const senderName = resolveSenderName(notif);
            const typeColor  = getNotifTypeColor(notif.type);
            const preview    = getMessagePreview(notif.message);

            return (
              <div
                key={notif.notification_id}
                className={[
                  'notif-card',
                  !notif.is_seen                         ? 'unread'   : '',
                  selectedIds.has(notif.notification_id) ? 'selected' : '',
                ].filter(Boolean).join(' ')}
                onClick={() => handleClick(notif)}
              >
                {/* Avatar */}
                <div className="notif-avatar">{getInitials(senderName)}</div>

                {/* Body */}
                <div className="notif-card-body">

                  {/* Row 1 — sender name + type pill */}
                  <div className="notif-card-row-top">
                    <span className="notif-sender">{senderName}</span>
                    <span
                      className="notif-type-pill"
                      style={{
                        background: `${typeColor}18`,
                        color:      typeColor,
                        border:     `1px solid ${typeColor}30`,
                      }}
                    >
                      {getNotifTypeLabel(notif.type)}
                    </span>
                  </div>

                  {/* Row 2 — truncated message preview */}
                  <div className="notif-card-preview">{preview}</div>

                  {/* Row 3 — relative timestamp */}
                  <div className="notif-card-time">{formatRelativeTime(notif.created_at)}</div>

                </div>

                {/* Unread dot */}
                {!notif.is_seen && <div className="notif-unread-dot" />}

                {/* Checkbox */}
                <div
                  className="notif-checkbox-wrap"
                  onClick={e => toggleSelect(notif.notification_id, e)}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(notif.notification_id)}
                    onChange={() => {}}
                    aria-label={`Select notification from ${senderName}`}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Detail Modal — shows full message */}
      {selected && (
        <div className="notif-modal-overlay" onClick={() => setSelected(null)}>
          <div className="notif-modal" onClick={e => e.stopPropagation()}>

            <div className="notif-modal-header">
              <div className="notif-modal-avatar">
                {getInitials(resolveSenderName(selected))}
              </div>
              <div className="notif-modal-meta">
                <h3>{resolveSenderName(selected)}</h3>
                <div className="notif-modal-sub">
                  <span
                    className="notif-type-pill"
                    style={{
                      background: `${getNotifTypeColor(selected.type)}18`,
                      color:      getNotifTypeColor(selected.type),
                      border:     `1px solid ${getNotifTypeColor(selected.type)}30`,
                    }}
                  >
                    {getNotifTypeLabel(selected.type)}
                  </span>
                  <span>
                    {new Date(selected.created_at).toLocaleString('en-US', {
                      month: 'short', day: 'numeric', year: 'numeric',
                      hour: 'numeric', minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>
              <button
                className="notif-modal-close"
                onClick={() => setSelected(null)}
                aria-label="Close"
              >
                <FaTimes />
              </button>
            </div>

            <div className="notif-modal-body">{selected.message}</div>
          </div>
        </div>
      )}
    </>
  );
};

export default Notification;