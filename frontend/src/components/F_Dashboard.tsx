// DashboardFaculty.tsx
import { useEffect, useRef, useState } from 'react';
import type { JSX } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/apiClient.ts';
import {
  FaHome, FaCalendar, FaClock, FaClipboardList, FaBell, FaUser,
  FaSignOutAlt, FaBuilding, FaPenAlt, FaCalendarPlus, FaUsers, FaUserShield,
  FaBars, FaTimes, FaEye, FaClipboardCheck
} from 'react-icons/fa';
import { BsFillSendPlusFill } from "react-icons/bs";
import '../styles/F_Dashboard.css';

import Profile from './F_Profile.tsx';
import ProctorExamDate from "./F_ExamDateViewer.tsx";
import ProctorSetAvailability from "./P_ProctorAvailability.tsx";
import ProctorViewExam from "./F_ExamViewer.tsx";
import Notification from "./F_Notification.tsx";
import BayanihanModality from "./B_BayanihanModality.tsx";
import SchedulerPlotSchedule from "./S_ExamViewer.tsx";
import SchedulerAvailability from "./S_ProctorsAvailabilityView.tsx";
import DeanRequests from "./D_DeanRequests.tsx";
import RoomManagement from './S_RoomManagement.tsx';
import ProctorMonitoring from './S_ProctorMonitoring.tsx';
import ProctorAttendance from './P_ProctorAttendance.tsx';
import MiniExamDateCalendar from './F_MiniExamDateCalendar.tsx';
import ProctorCourseDetails from './P_ProctorAssignedExams.tsx';
import MiniPlotSchedule from './MiniPlotSchedule.tsx';

const iconStyle = { className: 'icon', size: 20 };

const roleSidebarMap: Record<string, { key: string; label: string; icon: JSX.Element }[]> = {
  proctor: [
    { key: 'exam-Date',         label: 'Exam Date',          icon: <FaCalendar {...iconStyle} /> },
    { key: 'set-Availability',  label: 'Set Availability',   icon: <FaClock {...iconStyle} /> },
    { key: 'exam-Schedule',     label: 'Exam Schedule',      icon: <FaClipboardList {...iconStyle} /> },
    { key: 'proctor-Attendance',label: 'Proctor Attendance', icon: <FaClipboardCheck {...iconStyle} /> },
  ],
  scheduler: [
    { key: 'exam-Date',             label: 'Exam Date',         icon: <FaCalendar {...iconStyle} /> },
    { key: 'plot-Schedule',         label: 'Plot Schedule',     icon: <FaCalendarPlus {...iconStyle} /> },
    { key: 'exam-Schedule',         label: 'Exam Schedule',     icon: <FaClipboardList {...iconStyle} /> },
    { key: 'proctors-Availability', label: 'Available Proctor', icon: <FaUsers {...iconStyle} /> },
    { key: 'proctor-Monitoring',    label: 'Proctor Monitoring',icon: <FaEye {...iconStyle} /> },
    { key: 'Room-Management',       label: 'Room Management',   icon: <FaBuilding {...iconStyle} /> },
  ],
  dean: [
    { key: 'exam-Date', label: 'Exam Date', icon: <FaCalendar {...iconStyle} /> },
    { key: 'Request',   label: 'Requests',  icon: <BsFillSendPlusFill {...iconStyle} /> },
  ],
  'bayanihan leader': [
    { key: 'exam-Date',    label: 'Exam Date',    icon: <FaCalendar {...iconStyle} /> },
    { key: 'set-Modality', label: 'Set Modality', icon: <FaPenAlt {...iconStyle} /> },
    { key: 'exam-Schedule',label: 'Exam Schedule',icon: <FaClipboardList {...iconStyle} /> },
  ],
  admin: [
    { key: 'exam-Date',             label: 'Exam Date',         icon: <FaCalendar {...iconStyle} /> },
    { key: 'plot-Schedule',         label: 'Plot Schedule',     icon: <FaCalendarPlus {...iconStyle} /> },
    { key: 'exam-Schedule',         label: 'Exam Schedule',     icon: <FaClipboardList {...iconStyle} /> },
    { key: 'proctors-Availability', label: 'Available Proctor', icon: <FaUsers {...iconStyle} /> },
    { key: 'set-Modality',          label: 'Set Modality',      icon: <FaPenAlt {...iconStyle} /> },
    { key: 'Request',               label: 'Requests',          icon: <BsFillSendPlusFill {...iconStyle} /> },
    { key: 'Room-Management',       label: 'Room Management',   icon: <FaBuilding {...iconStyle} /> },
  ],
};

const DashboardFaculty = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeMenu, setActiveMenu] = useState('dashboard');
  const [currentDateTime, setCurrentDateTime] = useState(new Date());
  const [user, setUser] = useState<any>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 1024);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pendingRequestCount, setPendingRequestCount] = useState(0);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const isAlsoAdmin = roles.includes('admin');

  useEffect(() => {
    const loadUser = async () => {
      const stored = JSON.parse(localStorage.getItem('user') || 'null') || JSON.parse(sessionStorage.getItem('user') || 'null');
      if (!stored) return navigate('/');
      try {
        const res = await api.get(`/users/${stored.user_id}/`);
        const d = res.data;
        setUser({ ...d, full_name: `${d.first_name} ${d.middle_name ?? ''} ${d.last_name}`.trim(), avatar_url: d.avatar_url || '/images/default-pp.jpg' });
      } catch {
        setUser({ ...stored, full_name: `${stored.first_name} ${stored.middle_name ?? ''} ${stored.last_name}`.trim(), avatar_url: stored.avatar_url || '/images/default-pp.jpg' });
      }
    };
    loadUser();
  }, [navigate]);

  useEffect(() => {
    const id = setInterval(() => setCurrentDateTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!user?.user_id) return;
    api.get(`/user-roles/${user.user_id}/roles/`).then(res => {
      setRoles(res.data.filter((r: any) => r.status?.toLowerCase() === 'active').map((r: any) => r.role_name.toLowerCase()));
    }).catch(console.error);
  }, [user]);

  useEffect(() => {
    if (!user?.user_id) return;
    const fetch = () => api.get(`/notifications/${user.user_id}/`).then(res => setUnreadCount(res.data.filter((n: any) => !n.is_seen).length)).catch(console.error);
    fetch(); const id = setInterval(fetch, 10000); return () => clearInterval(id);
  }, [user]);

  useEffect(() => {
    if (!user?.user_id) return;
    const fetch = () => api.get('/tbl_scheduleapproval/', { params: { status: 'pending', reviewer_id: user.user_id } })
      .then(res => setPendingRequestCount(Array.isArray(res.data) ? res.data.length : 0)).catch(console.error);
    fetch(); const id = setInterval(fetch, 10000); return () => clearInterval(id);
  }, [user]);

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const onResize = () => {
      clearTimeout(t);
      t = setTimeout(() => {
        const m = window.innerWidth <= 1024;
        setIsMobile(prev => { if (prev !== m) setIsSidebarOpen(false); return m; });
      }, 150);
    };
    window.addEventListener('resize', onResize);
    return () => { clearTimeout(t); window.removeEventListener('resize', onResize); };
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setDropdownOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const mergedSidebarItems = Array.from(
    new Map(roles.flatMap(role => roleSidebarMap[role] || []).map(item => [item.key, item])).values()
  );

  const handleMenuClick = (key: string) => { setActiveMenu(key); if (isMobile) setIsSidebarOpen(false); setDropdownOpen(false); };
  const handleSidebarHover = (e: boolean) => { if (!isMobile) setIsSidebarOpen(e); };
  const handleLogoutConfirm = () => { localStorage.removeItem('user'); sessionStorage.removeItem('user'); navigate('/'); };

  const formattedDate = currentDateTime.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const formattedTime = currentDateTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  const greeting = currentDateTime.getHours() < 12 ? 'Good morning' : currentDateTime.getHours() < 18 ? 'Good afternoon' : 'Good evening';
  const displayRoles = roles.filter(r => r !== 'admin');

  if (!user) return <div className="dash-loading">Loading...</div>;

  return (
    <div className="app-container">
      <div className="main-content-wrapper">

        {roles.length > 0 && isMobile && (
          <button type="button" className="menu-toggle-btn" onClick={() => setIsSidebarOpen(o => !o)} aria-label="Toggle menu">
            {isSidebarOpen ? <FaTimes /> : <FaBars />}
          </button>
        )}
        {roles.length > 0 && isMobile && <div className={`sidebar-backdrop ${isSidebarOpen ? 'active' : ''}`} onClick={() => setIsSidebarOpen(false)} />}

        {roles.length > 0 && (
          <aside className={`sidebar ${isSidebarOpen ? 'open' : 'closed'}`} onMouseEnter={() => handleSidebarHover(true)} onMouseLeave={() => handleSidebarHover(false)}>
            <div className="sidebar-header">
              <button type="button" className="sidebar-logo-button" onClick={() => setActiveMenu('dashboard')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', padding: 0, width: '100%' }}>
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
                    <FaHome {...iconStyle} />{isSidebarOpen && <span>Dashboard</span>}
                  </button>
                </li>

                {mergedSidebarItems.map(({ key, label, icon }) => (
                  <li key={key} className={activeMenu === key ? 'active' : ''}>
                    <button type="button" onClick={() => handleMenuClick(key)}>
                      {key === 'Request'
                        ? <div className="sidebar-icon-wrapper">{icon}{pendingRequestCount > 0 && <span className="notification-badge-icon">{pendingRequestCount}</span>}</div>
                        : icon}
                      {isSidebarOpen && <span>{label}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            </nav>
          </aside>
        )}

        <main className={`main-content ${roles.length > 0 && isSidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>

          {/* ── Top bar: centered welcome + right cluster ── */}
          <div className="floating-topbar">
            {activeMenu === 'dashboard' ? (
              <div className="topbar-welcome">
                {greeting}, <span className="highlight">{user.first_name}!</span>
              </div>
            ) : (
              <div className="topbar-pagetitle">
                {mergedSidebarItems.find(i => i.key === activeMenu)?.label
                  ?? activeMenu.charAt(0).toUpperCase() + activeMenu.slice(1).replace(/-/g, ' ')}
              </div>
            )}

            <div className="topbar-right-cluster">
              <div className="topbar-datetime-pill">
                <span className="topbar-date">{formattedDate}</span>
                <span className="topbar-time">{formattedTime}</span>
              </div>

              <div className="topbar-avatar-notification-pill" ref={dropdownRef}>
                <button type="button" className="topbar-bell-btn" onClick={() => handleMenuClick('notification')} aria-label="Notifications">
                  <FaBell />
                  {unreadCount > 0 && <span className="topbar-badge">{unreadCount}</span>}
                </button>
                <img src={user.avatar_url} alt="avatar" className="topbar-avatar" onClick={() => setDropdownOpen(p => !p)} />
                {dropdownOpen && (
                  <div className="topbar-dropdown">
                    <div className="dropdown-header">
                      <div className="dropdown-name">{user.full_name}</div>
                      <div className="dropdown-role">
                        {displayRoles.length ? displayRoles.map(r => r.charAt(0).toUpperCase() + r.slice(1)).join(', ') : 'Loading...'}
                      </div>
                    </div>
                    <ul className="dropdown-menu-list">
                      <li><button type="button" onClick={() => handleMenuClick('profile')}><FaUser size={13} /> Profile</button></li>
                      {isAlsoAdmin && <li><button type="button" onClick={() => navigate('/admin-dashboard')}><FaUserShield size={13} /> Switch to Admin Dashboard</button></li>}
                      <li className="dropdown-divider" />
                      <li><button type="button" className="dropdown-signout" onClick={() => { setDropdownOpen(false); setShowLogoutModal(true); }}><FaSignOutAlt size={13} /> Sign out</button></li>
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Dashboard shortcuts grid ── */}
          {activeMenu === 'dashboard' && (
            <div className="dashboard-shortcuts-wrapper">
              <div className="shortcuts-grid">

                {/* TOP LEFT — Proctor assignments or role-appropriate card */}
                <div className="shortcut-card">
                  {roles.includes('proctor')
                    ? <ProctorCourseDetails user={user} />
                    : <div className="placeholder-content"><span className="placeholder-icon">🗂️</span><p>Assigned Proctoring</p><small>No proctor role assigned</small></div>
                  }
                </div>

                {/* TOP RIGHT — Mini exam calendar */}
                <div className="shortcut-card">
                  <MiniExamDateCalendar user={user} />
                </div>

                {/* BOTTOM FULL WIDTH — Plot schedule (schedulers) or exam schedule preview */}
                <div className="shortcut-card full-width">
                  {(roles.includes('scheduler') || roles.includes('admin'))
                    ? <MiniPlotSchedule user={user} onOpenPlotter={() => handleMenuClick('plot-Schedule')} />
                    : <div className="placeholder-content"><span className="placeholder-icon">📅</span><p>Exam Schedule Preview</p><small>Coming soon</small></div>
                  }
                </div>

              </div>
            </div>
          )}

          {activeMenu === 'exam-Date'           && <ProctorExamDate />}
          {activeMenu === 'profile'             && <Profile user={user} />}
          {activeMenu === 'set-Availability'    && <ProctorSetAvailability user={user} />}
          {activeMenu === 'exam-Schedule'        && <ProctorViewExam user={user} />}
          {activeMenu === 'proctor-Attendance'  && <ProctorAttendance user={user} />}
          {activeMenu === 'notification'        && <Notification user={user} />}
          {activeMenu === 'set-Modality'        && <BayanihanModality user={user} />}
          {activeMenu === 'plot-Schedule'        && <SchedulerPlotSchedule user={user} />}
          {activeMenu === 'proctors-Availability'&& <SchedulerAvailability user={user} />}
          {activeMenu === 'proctor-Monitoring'  && <ProctorMonitoring user={user} />}
          {activeMenu === 'Request'             && <DeanRequests user={user} />}
          {activeMenu === 'Room-Management'     && <RoomManagement user={user} />}
        </main>
      </div>

      {showLogoutModal && (
        <div className="myModal-overlay" onClick={() => setShowLogoutModal(false)}>
          <div className="myModal-box" onClick={e => e.stopPropagation()}>
            <h3 className="myModal-title">Are you sure you want to logout?</h3>
            <div className="myModal-actions">
              <button type="button" onClick={handleLogoutConfirm} className="myModal-btn myModal-btn-confirm">Logout</button>
              <button type="button" onClick={() => setShowLogoutModal(false)} className="myModal-btn myModal-btn-cancel">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardFaculty;