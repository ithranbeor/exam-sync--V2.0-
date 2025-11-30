import { useEffect, useState } from 'react';
import type { JSX } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/apiClient.ts';
import {
  FaHome, FaCalendar, FaClock, FaClipboardList, FaBell, FaUser,
  FaSignOutAlt, FaBuilding, FaPenAlt, FaCalendarPlus, FaUsers, FaUserShield,
  FaBars, FaTimes, FaEye, FaClipboardCheck
} from 'react-icons/fa';
import { BsFillSendPlusFill } from "react-icons/bs";
import '../styles/dashboardFaculty.css';

import Profile from '../components/Profile.tsx';
import ProctorExamDate from "./ProctorExamDate.tsx";
import ProctorSetAvailability from "./ProctorSetAvailability.tsx";
import ProctorViewExam from "./ProctorViewExam.tsx";
import Notification from "./Notification.tsx";
import BayanihanModality from "./BayanihanModality.tsx";
import SchedulerPlotSchedule from "./ScheduleViewer.tsx";
import SchedulerAvailability from "./SchedulerAvailability.tsx";
import DeanRequests from "./DeanRequests.tsx";
import RoomManagement from './RoomManagement.tsx';
import ProctorMonitoring from './ProctorMonitoring.tsx';
import ProctorAttendance from './ProctorAttendance.tsx';
import MiniExamDateCalendar from './MiniExamDateCalendar.tsx';
import ProctorCourseDetails from './ProctorCourseDetails.tsx';

const iconStyle = { className: 'icon', size: 20 };

const roleSidebarMap: Record<string, { key: string, label: string, icon: JSX.Element }[]> = {
  proctor: [
    { key: 'exam-Date', label: 'Exam Date', icon: <FaCalendar {...iconStyle} /> },
    { key: 'set-Availability', label: 'Set Availability', icon: <FaClock {...iconStyle} /> },
    { key: 'exam-Schedule', label: 'View Exam Schedule', icon: <FaClipboardList {...iconStyle} /> },
    { key: 'proctor-Attendance', label: 'Proctor Attendance', icon: <FaClipboardCheck {...iconStyle} /> },
    { key: 'notification', label: 'Notification', icon: <FaBell {...iconStyle} /> },
  ],
  scheduler: [
    { key: 'exam-Date', label: 'Exam Date', icon: <FaCalendar {...iconStyle} /> },
    { key: 'plot-Schedule', label: 'Plot Schedule', icon: <FaCalendarPlus {...iconStyle} /> },
    { key: 'exam-Schedule', label: 'View Exam Schedule', icon: <FaClipboardList {...iconStyle} /> },
    { key: 'proctors-Availability', label: 'Available Proctor', icon: <FaUsers {...iconStyle} /> },
    { key: 'proctor-Monitoring', label: 'Proctor Monitoring', icon: <FaEye {...iconStyle} /> },
    { key: 'notification', label: 'Notification', icon: <FaBell {...iconStyle} /> },
    { key: 'Room-Management', label: 'Room Management', icon: <FaBuilding {...iconStyle} /> },
  ],
  dean: [
    { key: 'exam-Date', label: 'Exam Date', icon: <FaCalendar {...iconStyle} /> },
    { key: 'notification', label: 'Notification', icon: <FaBell {...iconStyle} /> },
    { key: 'Request', label: 'Requests', icon: <BsFillSendPlusFill {...iconStyle} /> },
  ],
  'bayanihan leader': [
    { key: 'exam-Date', label: 'Exam Date', icon: <FaCalendar {...iconStyle} /> },
    { key: 'set-Modality', label: 'Set Modality', icon: <FaPenAlt {...iconStyle} /> },
    { key: 'exam-Schedule', label: 'View Exam Schedule', icon: <FaClipboardList {...iconStyle} /> },
    { key: 'notification', label: 'Notification', icon: <FaBell {...iconStyle} /> },
  ],
  admin: [
    { key: 'exam-Date', label: 'Exam Date', icon: <FaCalendar {...iconStyle} /> },
    { key: 'plot-Schedule', label: 'Plot Schedule', icon: <FaCalendarPlus {...iconStyle} /> },
    { key: 'exam-Schedule', label: 'View Exam Schedule', icon: <FaClipboardList {...iconStyle} /> },
    { key: 'proctors-Availability', label: 'Available Proctor', icon: <FaUsers {...iconStyle} /> },
    { key: 'set-Modality', label: 'Set Modality', icon: <FaPenAlt {...iconStyle} /> },
    { key: 'Request', label: 'Requests', icon: <BsFillSendPlusFill {...iconStyle} /> },
    { key: 'Room-Management', label: 'Room Management', icon: <FaBuilding {...iconStyle} /> },
    { key: 'notification', label: 'Notification', icon: <FaBell {...iconStyle} /> },
  ]
};

const DashboardFaculty = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeMenu, setActiveMenu] = useState('dashboard');
  const [currentDateTime, setCurrentDateTime] = useState(new Date());
  const [user, setUser] = useState<any>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 1024);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    const loadUser = async () => {
      const stored =
        JSON.parse(localStorage.getItem('user') || 'null') ||
        JSON.parse(sessionStorage.getItem('user') || 'null');

      if (!stored) return navigate('/');

      try {
        const res = await api.get(`/users/${stored.user_id}/`);
        const data = res.data;

        setUser({
          ...data,
          full_name: `${data.first_name} ${data.middle_name ?? ''} ${data.last_name}`.trim(),
          avatar_url: data.avatar_url || '/images/default-pp.jpg',
        });
      } catch (err) {
        console.error('Error loading user info:', err);
        setUser({
          ...stored,
          full_name: `${stored.first_name} ${stored.middle_name ?? ''} ${stored.last_name}`.trim(),
          avatar_url: stored.avatar_url || '/images/default-pp.jpg',
        });
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
      if (!user?.user_id) return;
      try {
        const res = await api.get(`/user-roles/${user.user_id}/roles/`);
        const roleData = res.data
          .filter((r: any) => r.status?.toLowerCase() === 'active')
          .map((r: any) => r.role_name.toLowerCase());
        setRoles(roleData);
      } catch (err) {
        console.error('Error fetching roles:', err);
      }
    };
    fetchUserRoles();
  }, [user]);

  useEffect(() => {
    const fetchUnreadCount = async () => {
      if (!user?.user_id) return;
      try {
        const res = await api.get(`/notifications/${user.user_id}/`);
        const unreadCount = res.data.filter((n: any) => !n.is_seen).length;
        setUnreadNotificationCount(unreadCount);
      } catch (err) {
        console.error('Error fetching notification count:', err);
      }
    };

    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 10000);
    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    let resizeTimer: NodeJS.Timeout;
    
    const handleResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        const nowMobile = window.innerWidth <= 1024;
        const wasMobile = isMobile;
        
        setIsMobile(nowMobile);
        
        if (wasMobile !== nowMobile) {
          setIsSidebarOpen(false);
        }
      }, 150);
    };

    const initialMobile = window.innerWidth <= 1024;
    setIsMobile(initialMobile);
    
    window.addEventListener('resize', handleResize);
    return () => {
      clearTimeout(resizeTimer);
      window.removeEventListener('resize', handleResize);
    };
  }, [isMobile]);

  const mergedSidebarItems = Array.from(
    new Map(
      roles
        .flatMap(role => roleSidebarMap[role] || [])
        .map(item => [item.key, item])
    ).values()
  );

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const handleMenuClick = (menuKey: string) => {
    setActiveMenu(menuKey);
    if (isMobile) {
      setIsSidebarOpen(false);
    }
  };

  const handleSidebarHover = (isEntering: boolean) => {
    if (!isMobile) {
      setIsSidebarOpen(isEntering);
    }
  };

  const handleLogoutConfirm = () => {
    localStorage.removeItem('user');
    sessionStorage.removeItem('user');
    navigate('/');
  };

  const timeString = currentDateTime.toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
  const [hour, minute, ampm] = timeString.split(/:| /);
  const dateStr = currentDateTime.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });

  if (!user) return <div style={{ color: 'black' }}>Loading...</div>;

  return (
    <div className="app-container">
      <div className="main-content-wrapper">
        {roles.length > 0 && isMobile && (
          <button
            type="button"
            className="menu-toggle-btn"
            onClick={toggleSidebar}
            aria-label="Toggle menu"
          >
            {isSidebarOpen ? <FaTimes /> : <FaBars />}
          </button>
        )}

        {roles.length > 0 && isMobile && (
          <div
            className={`sidebar-backdrop ${isSidebarOpen ? 'active' : ''}`}
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {roles.length > 0 && (
          <aside
            className={`sidebar ${isSidebarOpen ? 'open' : 'closed'}`}
            onMouseEnter={() => handleSidebarHover(true)}
            onMouseLeave={() => handleSidebarHover(false)}
          >
            <div className="sidebar-header">
              <button 
                type="button" 
                className="sidebar-logo-button"
                onClick={() => setActiveMenu('dashboard')}
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  cursor: 'pointer', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '10px',
                  padding: 0,
                  width: '100%'
                }}
              >
                <div className="sidebar-logo">
                  <img src="/logo/Exam.png" alt="Logo" className="logo-img" />
                  {isSidebarOpen && <span className="logo-text">ExamSync</span>}
                </div>
              </button>
            </div>

            <nav className="sidebar-nav">
              <ul>
                <li className={activeMenu === 'dashboard' ? 'active' : ''}>
                  <button type="button" onClick={() => handleMenuClick('dashboard')}>
                    <FaHome {...iconStyle} />
                    {isSidebarOpen && <span>Dashboard</span>}
                  </button>
                </li>

                {mergedSidebarItems.map(({ key, label, icon }) => (
                  <li key={key} className={activeMenu === key ? 'active' : ''}>
                    <button type="button" onClick={() => handleMenuClick(key)}>
                      <div className="sidebar-icon-wrapper">
                        {icon}
                        {key === 'notification' && unreadNotificationCount > 0 && (
                          <span className="notification-badge-icon">{unreadNotificationCount}</span>
                        )}
                      </div>
                      {isSidebarOpen && <span>{label}</span>}
                    </button>
                  </li>
                ))}

                <div className="sidebar-divider"></div>

                <li className={activeMenu === 'profile' ? 'active' : ''}>
                  <button type='button' onClick={() => handleMenuClick('profile')}>
                    <FaUser {...iconStyle} />
                    {isSidebarOpen && <span>Profile</span>}
                  </button>
                </li>

                <li>
                  <button type='button' onClick={() => {
                    setShowLogoutModal(true);
                    if (isMobile) setIsSidebarOpen(false);
                  }}>
                    <FaSignOutAlt />
                    {isSidebarOpen && <span>Logout</span>}
                  </button>
                </li>
              </ul>
            </nav>
          </aside>
        )}

        <main className={`main-content ${roles.length > 0 && isSidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
          <div className="content-header">
            <h1>{activeMenu.charAt(0).toUpperCase() + activeMenu.slice(1).replace(/-/g, ' ')}</h1>
          </div>

          {activeMenu === 'dashboard' && (
            <div className="dashboard-grid">
              <div className="card welcome-card">
                <h3>Welcome, <span className="robert-name">{user.first_name}!</span></h3>
                <p>Organize your work and improve your performance here</p>
                {roles.includes('admin') && (
                  <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '8px', color: '#4CAF50' }}>
                    <FaUserShield size={16} />
                    <span style={{ fontSize: '14px', fontWeight: '500' }}>Admin Access Enabled</span>
                  </div>
                )}
              </div>

              <div className="card datetime-card">
                <div className="date-display-simple">{dateStr}</div>
                <div className="time-display">
                  <span>{hour}:</span><span>{minute}</span><span className="ampm">{ampm}</span>
                </div>
              </div>

              <div className="card faculty-info-card">
                <img src={user.avatar_url} alt="Avatar" className="faculty-avatar" />
                <h4>{user.full_name}</h4>
                <p>{roles.length ? roles.map(r => r.charAt(0).toUpperCase() + r.slice(1)).join(', ') : 'Loading roles...'}</p>
              </div>

              <div className="full-width-section">
                <h2>Shortcut</h2>
                <div className="try-things-grid">
                  <div className="try-thing-card"><MiniExamDateCalendar user={user} /></div>
                  {roles.includes('proctor') && <div className="try-thing-card"><ProctorCourseDetails user={user} /></div>}
                </div>
              </div>
            </div>
          )}

          {activeMenu === 'exam-Date' && <ProctorExamDate />}
          {activeMenu === 'profile' && <Profile user={user} />}
          {activeMenu === 'set-Availability' && <ProctorSetAvailability user={user} />}
          {activeMenu === 'exam-Schedule' && <ProctorViewExam />}
          {activeMenu === 'proctor-Attendance' && <ProctorAttendance user={user} />}
          {activeMenu === 'notification' && <Notification user={user} />}
          {activeMenu === 'set-Modality' && <BayanihanModality user={user} />}
          {activeMenu === 'plot-Schedule' && <SchedulerPlotSchedule user={user} />}
          {activeMenu === 'proctors-Availability' && <SchedulerAvailability user={user} />}
          {activeMenu === 'proctor-Monitoring' && <ProctorMonitoring user={user} />}
          {activeMenu === 'Request' && <DeanRequests user={user} />}
          {activeMenu === 'Room-Management' && <RoomManagement user={user} />}
        </main>
      </div>

      {showLogoutModal && (
        <div className="myModal-overlay" onClick={() => setShowLogoutModal(false)}>
          <div className="myModal-box" onClick={(e) => e.stopPropagation()}>
            <h3 className="myModal-title">Are you sure you want to logout?</h3>
            <div className="myModal-actions">
              <button type='button' onClick={handleLogoutConfirm} className="myModal-btn myModal-btn-confirm">Logout</button>
              <button type='button' onClick={() => setShowLogoutModal(false)} className="myModal-btn myModal-btn-cancel">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardFaculty;