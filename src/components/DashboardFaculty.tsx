// deno-lint-ignore-file jsx-button-has-type no-explicit-any
import React, { JSX, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.ts';
import {
  FaHome, FaCalendar, FaClock, FaClipboardList, FaBell, FaUser, FaSignOutAlt, FaPenAlt, FaCalendarPlus, FaUsers
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

const iconStyle = { className: 'icon', size: 20 };

const roleSidebarMap: Record<string, { key: string, label: string, icon: JSX.Element }[]> = {
  proctor: [
    { key: 'exam-Date', label: 'Exam Date', icon: <FaCalendar {...iconStyle} /> },
    { key: 'set-Availability', label: 'Set Availability', icon: <FaClock {...iconStyle} /> },
    { key: 'exam-Schedule', label: 'View Exam Schedule', icon: <FaClipboardList {...iconStyle} /> },
    { key: 'notification', label: 'Notification', icon: <FaBell {...iconStyle} /> },
  ],
  scheduler: [
    { key: 'plot-Schedule', label: 'Plot Schedule', icon: <FaCalendarPlus {...iconStyle} /> },
    { key: 'exam-Schedule', label: 'View Exam Schedule', icon: <FaClipboardList {...iconStyle} /> },
    { key: 'proctor-Availability', label: 'Available Proctor', icon: <FaUsers {...iconStyle} /> },
    { key: 'notification', label: 'Notification', icon: <FaBell {...iconStyle} /> },
  ],
  dean: [
    { key: 'exam-Date', label: 'Exam Date', icon: <FaCalendar {...iconStyle} /> },
    { key: 'notification', label: 'Notification', icon: <FaBell {...iconStyle} /> },
    { key: 'requests', label: 'Requests', icon: <BsFillSendPlusFill {...iconStyle} /> },
  ],
  'bayanihan leader': [
    { key: 'set-Modality', label: 'Set Modality', icon: <FaPenAlt {...iconStyle} /> },
    { key: 'exam-Schedule', label: 'View Exam Schedule', icon: <FaClipboardList {...iconStyle} /> },
    { key: 'notification', label: 'Notification', icon: <FaBell {...iconStyle} /> },
  ]
};

const DashboardFaculty = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeMenu, setActiveMenu] = useState('dashboard');
  const [currentDateTime, setCurrentDateTime] = useState(new Date());
  const [user, setUser] = useState<any>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const navigate = useNavigate();

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

  useEffect(() => {
    const timer = setInterval(() => setCurrentDateTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const fetchUserRoles = async () => {
      if (!user?.first_name) return;
      const { data, error } = await supabase.rpc('get_user_roles_by_first_name', {
        input_first_name: user.first_name
      });
      if (!error && data) {
        setRoles(data.map((r: any) => r.role_name.toLowerCase()).filter((r: string) => r !== 'admin'));
      }
    };
    fetchUserRoles();
  }, [user]);

  const mergedSidebarItems = Array.from(
    new Map(
      roles
        .flatMap(role => roleSidebarMap[role] || [])
        .map(item => [item.key, item])
    ).values()
  );

  const handleLogout = () => {
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
                <button onClick={handleLogout}>
                  <FaSignOutAlt {...iconStyle} />
                  {isSidebarOpen && <span>Logout</span>}
                </button>
              </li>
            </ul>
          </nav>
        </aside>

        <main className={`main-content ${isSidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
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
                  <div className="card try-thing-card"><ProctorExamDate /></div>
                  <div className="card try-thing-card"><ProctorViewExam /></div>
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
          {activeMenu === 'plot-Schedule' && <SchedulerPlotSchedule user={user} />}
          {activeMenu === 'proctor-Availability' && <SchedulerAvailability/>}
        </main>
      </div>
    </div>
  );
};

export default DashboardFaculty;
