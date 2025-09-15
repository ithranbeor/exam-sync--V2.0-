import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom'; // for navigation
import { supabase } from "../lib/supabaseClient.ts";
import '../styles/notification.css';

type Notification = {
  id: number;
  sender: string;
  instructor: string;
  message: string;
  date: string;
};

const Scheduler_Notification: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const navigate = useNavigate(); // React Router hook

  // Fetch notifications from database
    useEffect(() => {
    const fetchNotifications = async () => {
      const { data, error } = await supabase
        .from<'tbl_notifications', Notification>('tbl_notifications')
        .select('*')
        .order('date', { ascending: false });

      if (error) {
        console.error('Error fetching notifications:', error.message);
      } else if (data) {
        setNotifications(data);
      }
    };

    fetchNotifications();
  }, []);

  // Navigate to inbox with the message ID
  const openInbox = (notifId: number) => {
    navigate(`/inbox/${notifId}`); // pass the notification ID as a param
  };

  return (
    <div className="notification-container">
      <div className="notification-banner">Notification</div>
      <p className="notification-message">You have messages from the inbox!</p>

      {notifications.map((notif) => (
        <div
          key={notif.id}
          className="notification-card"
          onClick={() => openInbox(notif.id)} // redirect to inbox
        >
          <div className="notif-left">
            <span className="notif-icon">⏵</span>
            <span className="notif-sender">{notif.sender}</span>
          </div>
          <div className="notif-center">• {notif.message}</div>
          <div className="notif-date">{notif.date}</div>
        </div>
      ))}
    </div>
  );
};

export default Scheduler_Notification;
