// deno-lint-ignore-file jsx-button-has-type no-explicit-any
import React, { JSX, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.ts';
import {
  FaHome, FaCalendar, FaClock, FaClipboardList, FaBell, FaUser, FaSignOutAlt, FaPenAlt, FaCalendarPlus, FaUsers, FaInbox
} from 'react-icons/fa';
import { BsFillSendPlusFill } from "react-icons/bs";
import '../styles/dashboardFaculty.css';

import Profile from '../components/Profile.tsx';
import ProctorExamDate from "./ProctorExamDate.tsx";
import ProctorSetAvailability from "./ProctorSetAvailability.tsx";
import ProctorViewExam from "./ProctorViewExam.tsx";
import Notification from "./Notification.tsx";
import BayanihanModality from "./BayanihanModality.tsx";
import SchedulerPlotSchedule from "./SchedulerPlotSchedule.tsx";
import SchedulerAvailability from "./SchedulerAvailability.tsx";
import DeanRequests from "./DeanRequests.tsx";    
import Inbox from "./facultyInbox.tsx";

const iconStyle = { className: 'icon', size: 20 };

const roleSidebarMap: Record<string, { key: string, label: string, icon: JSX.Element }[]> = {
  proctor: [
    { key: 'exam-Date', label: 'Exam Date', icon: <FaCalendar {...iconStyle} /> },
    { key: 'set-Availability', label: 'Set Availability', icon: <FaClock {...iconStyle} /> },
    { key: 'exam-Schedule', label: 'View Exam Schedule', icon: <FaClipboardList {...iconStyle} /> },
    { key: 'notification', label: 'Notification', icon: <FaBell {...iconStyle} /> },
    { key: 'inbox', label: 'Inbox', icon: <FaInbox {...iconStyle} /> },
  ],
  scheduler: [
    { key: 'exam-Date', label: 'Exam Date', icon: <FaCalendar {...iconStyle} /> },
    { key: 'plot-Schedule', label: 'Plot Schedule', icon: <FaCalendarPlus {...iconStyle} /> },
    { key: 'exam-Schedule', label: 'View Exam Schedule', icon: <FaClipboardList {...iconStyle} /> },
    { key: 'proctor-Availability', label: 'Available Proctor', icon: <FaUsers {...iconStyle} /> },
    { key: 'notification', label: 'Notification', icon: <FaBell {...iconStyle} /> },
    { key: 'inbox', label: 'Inbox', icon: <FaInbox {...iconStyle} /> },
  ],
  dean: [
    { key: 'exam-Date', label: 'Exam Date', icon: <FaCalendar {...iconStyle} /> },
    { key: 'notification', label: 'Notification', icon: <FaBell {...iconStyle} /> },
    { key: 'Request', label: 'Requests', icon: <BsFillSendPlusFill {...iconStyle} /> },
    { key: 'inbox', label: 'Inbox', icon: <FaInbox {...iconStyle} /> },
  ],
  'bayanihan leader': [
    { key: 'exam-Date', label: 'Exam Date', icon: <FaCalendar {...iconStyle} /> },
    { key: 'set-Modality', label: 'Set Modality', icon: <FaPenAlt {...iconStyle} /> },
    { key: 'exam-Schedule', label: 'View Exam Schedule', icon: <FaClipboardList {...iconStyle} /> },
    { key: 'notification', label: 'Notification', icon: <FaBell {...iconStyle} /> },
    { key: 'inbox', label: 'Inbox', icon: <FaInbox {...iconStyle} /> },
  ]
};

interface MessagePayload {
  message_id: number;
  receiver_id: number;
  is_read: boolean;
  is_deleted: boolean;
}

const DashboardFaculty = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeMenu, setActiveMenu] = useState('dashboard');
  const [currentDateTime, setCurrentDateTime] = useState(new Date());
  const [user, setUser] = useState<any>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const navigate = useNavigate();
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // Load user
  useEffect(() => {
    const loadUser = async () => {
      const stored = JSON.parse(localStorage.getItem('user') || 'null') ||
        JSON.parse(sessionStorage.getItem('user') || 'null');
      if (!stored) return navigate('/');

      const { data, error } = await supabase
        .from('tbl_users')
        .select('user_id, first_name, middle_name, last_name, avatar_url')
        .eq('user_id', stored.user_id)
        .single();

      if (!error && data) {
        setUser({ ...stored, avatar_url: data.avatar_url });
      } else {
        setUser(stored);
      }
    };
    loadUser();
  }, [navigate]);

  // Clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentDateTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch roles
  useEffect(() => {
    const fetchUserRoles = async () => {
      if (!user?.first_name) return;
      const { data, error } = await supabase.rpc('get_user_roles_by_first_name', {
        input_first_name: user.first_name
      });

      if (!error && data) {
        const activeRoles = data
          .filter((r: any) => !r.is_suspended)
          .map((r: any) => r.role_name.toLowerCase())
          .filter((r: string) => r !== 'admin');

        setRoles(activeRoles);
      }
    };
    fetchUserRoles();
  }, [user]);

  // Fetch unread messages count
  useEffect(() => {
    if (!user) return;

    const fetchUnreadCount = async () => {
      const { data, error } = await supabase
        .from('tbl_inbox')
        .select('message_id')
        .eq('receiver_id', user.user_id)
        .eq('is_read', false)
        .eq('is_deleted', false);

      if (!error && data) setUnreadCount(data.length);
    };

    fetchUnreadCount();

    // Polling every 10 seconds
    const interval = setInterval(fetchUnreadCount, 10000);

    // Realtime subscription
    const channel = supabase
      .channel(`inbox-${user.user_id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tbl_inbox' }, (payload: any) => {
        if (payload.new.receiver_id === user.user_id) {
          fetchUnreadCount();
        }
      })
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [user]);

  const mergedSidebarItems = Array.from(
    new Map(
      roles
        .flatMap(role => roleSidebarMap[role] || [])
        .map(item => {
          if (item.key === 'inbox') {
            return {
              ...item,
              label: unreadCount > 0 ? <span style={{ color: '##F2994' }}>{`${item.label} (${unreadCount})`}</span> : item.label
            };
          }
          return item;
        })
        .map(item => [item.key, item])
    ).values()
  );

  const handleLogout = () => {
    localStorage.removeItem('user');
    sessionStorage.removeItem('user');
    navigate('/');
  };

  const handleLogoutConfirm = () => {
    localStorage.removeItem('user');
    sessionStorage.removeItem('user');
    navigate('/');
  };

  const timeString = currentDateTime.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
  const [hour, minute, ampm] = timeString.split(/:| /);
  const dateStr = currentDateTime.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric'
  });

  if (!user) return <div>Loading...</div>;

  return (
    <div className="app-container">
      <div className="main-content-wrapper">
        {roles.length > 0 && (
        <aside
          className={`sidebar ${isSidebarOpen ? 'open' : 'closed'}`}
          onMouseEnter={() => setIsSidebarOpen(true)}
          onMouseLeave={() => setIsSidebarOpen(false)}
        >
          <div className="sidebar-header">
            <div className="sidebar-logo">
              <img src="./src/assets/Exam.png" alt="Logo" className="logo-img" />
              {isSidebarOpen && <span className="logo-text">ExamSync</span>}
            </div>
          </div>
          <nav className="sidebar-nav">
            <ul>
              <li className={activeMenu === 'dashboard' ? 'active' : ''}>
                <button onClick={() => setActiveMenu('dashboard')}>
                  <FaHome {...iconStyle} />
                  {isSidebarOpen && <span>Dashboard</span>}
                </button>
              </li>

              {mergedSidebarItems.map(({ key, label, icon }) => (
                <li key={key} className={activeMenu === key ? 'active' : ''}>
                  <button onClick={() => setActiveMenu(key)}>
                    {icon}
                    {isSidebarOpen && <span>{label}</span>}
                  </button>
                </li>
              ))}

              <div className="sidebar-divider"></div>

              <li className={activeMenu === 'profile' ? 'active' : ''}>
                <button onClick={() => setActiveMenu('profile')}>
                  <FaUser {...iconStyle} />
                  {isSidebarOpen && <span>Profile</span>}
                </button>
              </li>

              <li>
                <button onClick={() => setShowLogoutModal(true)}>
                  <FaSignOutAlt />
                  {isSidebarOpen && <span>Logout</span>}
                </button>
              </li>
            </ul>
          </nav>

          {/* Modal overlay, rendered at end of aside so not inside .sidebar-nav */}
          {showLogoutModal && (
            <div className="myModal-overlay">
              <div className="myModal-box">
                <h3 className="myModal-title">Are you sure you want to logout?</h3>
                <div className="myModal-actions">
                  <button
                    onClick={handleLogoutConfirm}
                    className="myModal-btn myModal-btn-confirm"
                  >
                    Logout
                  </button>
                  <button
                    onClick={() => setShowLogoutModal(false)}
                    className="myModal-btn myModal-btn-cancel"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </aside>
        )}

        <main className={`main-content ${roles.length > 0 && isSidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
          <div className="content-header">
            <h1>{activeMenu.charAt(0).toUpperCase() + activeMenu.slice(1).replace(/-/g, ' ')}</h1>
          </div>

          {activeMenu === 'dashboard' && (
            <div className="dashboard-grid">
              <div className="card welcome-card">
                <h3>
                  Welcome, <span className="robert-name">{user.first_name}!</span>
                </h3>
                <p>Organize your work and improve your performance here</p>
              </div>
              <div className="card datetime-card">
                <div className="date-display-simple">{dateStr}</div>
                <div className="time-display">
                  <span>{hour}:</span><span>{minute}</span><span className="ampm">{ampm}</span>
                </div>
              </div>
              <div className="card faculty-info-card">
                <img
                  src={user.avatar_url ?? './src/assets/default-pp.jpg'}
                  alt="Avatar"
                  className="faculty-avatar"
                />
                <h4>{user.first_name} {user.middle_name} {user.last_name}</h4>
                <p>
                  {roles.length
                    ? roles.map(role => role.charAt(0).toUpperCase() + role.slice(1)).join(', ')
                    : 'Loading role(s)...'}
                </p>
              </div>
              <div className="full-width-section">
                <h2>Shortcut</h2>
                <div className="try-things-grid">
                  <div className="try-thing-card"><ProctorExamDate /></div>
                  <div className="try-thing-card"><ProctorViewExam /></div>
                </div>
              </div>
            </div>
          )}

          {activeMenu === 'exam-Date' && <ProctorExamDate />}
          {activeMenu === 'profile' && <Profile user={user} />}
          {activeMenu === 'set-Availability' && <ProctorSetAvailability user={user} />}
          {activeMenu === 'exam-Schedule' && <ProctorViewExam />}
          {activeMenu === 'notification' && <Notification />}
          {activeMenu === 'set-Modality' && <BayanihanModality user={user} />}
          {activeMenu === 'plot-Schedule' && <SchedulerPlotSchedule/>}
          {activeMenu === 'proctor-Availability' && <SchedulerAvailability/>}
          {activeMenu === 'inbox' && <Inbox user={user}/>}
          {activeMenu === 'Request' && <DeanRequests/>}
        </main>
      </div>
    </div>
  );
};

export default DashboardFaculty;
