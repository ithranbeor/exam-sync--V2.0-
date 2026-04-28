// DashboardAdmin.tsx
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/apiClient.ts';
import {
  FaHome, FaUsers, FaBuilding,
  FaSignOutAlt, FaPenAlt, FaBars, FaTimes, FaUserShield, FaBell, FaUser
} from 'react-icons/fa';
import { PiBuildingsFill } from "react-icons/pi";
import { FaBookAtlas } from "react-icons/fa6";
import '../styles/F_Dashboard.css';
import { IoCalendarSharp } from "react-icons/io5";

import Colleges from './A_Colleges.tsx';
import Structure from './A_Structure.tsx';
import Courses from './A_AcademicData.tsx';
import SectionCourses from './A_SectionCourses.tsx';
import Terms from './A_Terms.tsx';
import BuildingsAndRooms from './A_BuildingsAndRooms.tsx';
import ExamPeriod from './A_ExamPeriod.tsx';
import UserManagement from './A_UserManagement.tsx';
import Profile from './F_Profile.tsx';
import ProctorCourseDetails from './P_ProctorAssignedExams.tsx';
import BayanihanModality from "./B_BayanihanModality.tsx";
import MiniExamDateCalendar from "./F_MiniExamDateCalendar.tsx";
import Notification from "./F_Notification.tsx";

const iconStyle = { className: 'icon', size: 25 };

const adminSidebarItems = [
  { key: 'dashboard',          label: 'Dashboard',        icon: <FaHome {...iconStyle} /> },
  { key: 'structure',          label: 'College Structure', icon: <FaBuilding {...iconStyle} /> },
  { key: 'courses',            label: 'Courses & Sections',icon: <FaBookAtlas {...iconStyle} /> },
  { key: 'buildings-and-rooms',label: 'Buildings & Rooms', icon: <PiBuildingsFill {...iconStyle} /> },
  { key: 'exam-period',        label: 'Exam Period',       icon: <IoCalendarSharp {...iconStyle} /> },
  { key: 'set-Modality',       label: 'Set Modality',      icon: <FaPenAlt {...iconStyle} /> },
  { key: 'User Management',    label: 'User Management',   icon: <FaUsers {...iconStyle} /> },
];

const DashboardAdmin: React.FC = () => {
  const [user, setUser] = useState<any>(null);
  const [activeMenu, setActiveMenu] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [currentDateTime, setCurrentDateTime] = useState(new Date());
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 1024);
  const [roles, setRoles] = useState<string[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const hasFacultyRole = roles.some(r => r !== 'admin');

  useEffect(() => {
    const loadUser = async () => {
      const stored = JSON.parse(localStorage.getItem('user') || 'null') ||
        JSON.parse(sessionStorage.getItem('user') || 'null');
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
    if (!user?.user_id) return;
    api.get(`/user-roles/${user.user_id}/roles/`).then(res => {
      setRoles(res.data.filter((r: any) => r.status?.toLowerCase() === 'active').map((r: any) => r.role_name.toLowerCase()));
    }).catch(console.error);
  }, [user]);

  useEffect(() => {
    if (!user?.user_id) return;
    const fetch = () => api.get(`/notifications/${user.user_id}/`).then(res => setUnreadCount(res.data.filter((n: any) => !n.is_seen).length)).catch(console.error);
    fetch();
    const id = setInterval(fetch, 10000);
    return () => clearInterval(id);
  }, [user]);

  useEffect(() => {
    const id = setInterval(() => setCurrentDateTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

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

  const handleMenuClick = (key: string) => { setActiveMenu(key); if (isMobile) setIsSidebarOpen(false); setDropdownOpen(false); };
  const handleSidebarHover = (e: boolean) => { if (!isMobile) setIsSidebarOpen(e); };
  const handleLogout = () => { localStorage.removeItem('user'); sessionStorage.removeItem('user'); navigate('/'); };

  const formattedDate = currentDateTime.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const formattedTime = currentDateTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  const greeting = currentDateTime.getHours() < 12 ? 'Good morning' : currentDateTime.getHours() < 18 ? 'Good afternoon' : 'Good evening';

  if (!user) return <div style={{ color: 'black' }}>Please Wait...</div>;

  const renderContent = () => {
    switch (activeMenu) {
      case 'colleges':          return <Colleges />;
      case 'structure':         return <Structure />;
      case 'courses':           return <Courses />;
      case 'section-courses':   return <SectionCourses />;
      case 'terms':             return <Terms />;
      case 'buildings-and-rooms': return <BuildingsAndRooms />;
      case 'exam-period':       return <ExamPeriod />;
      case 'User Management':   return <UserManagement user={user} />;
      case 'set-Modality':      return <BayanihanModality user={user} />;
      case 'profile':           return <Profile user={user} />;
      case 'notification':      return <Notification user={user} />;
      default: return (
        <div className="dashboard-shortcuts-wrapper">
          <div className="shortcuts-grid">

            {/* TOP LEFT — Proctor assignments */}
            <div className="shortcut-card">
              {roles.includes('proctor')
                ? <ProctorCourseDetails user={user} />
                : <div className="placeholder-content"><span className="placeholder-icon">🗂️</span><p>Assigned Proctoring</p><small>No proctor role assigned</small></div>
              }
            </div>

            {/* TOP RIGHT — Mini calendar */}
            <div className="shortcut-card">
              <MiniExamDateCalendar user={user} />
            </div>

            {/* BOTTOM FULL WIDTH — future shortcut */}
            <div className="shortcut-card full-width">
              <div className="placeholder-content">
                <span className="placeholder-icon"></span>
                <p>More features coming soon...</p>
              </div>
            </div>

          </div>
        </div>
      );
    }
  };

  return (
    <div className="app-container">
      <div className="main-content-wrapper">

        {isMobile && (
          <button type="button" className="menu-toggle-btn" onClick={() => setIsSidebarOpen(o => !o)} aria-label="Toggle menu">
            {isSidebarOpen ? <FaTimes /> : <FaBars />}
          </button>
        )}
        {isMobile && <div className={`sidebar-backdrop ${isSidebarOpen ? 'active' : ''}`} onClick={() => setIsSidebarOpen(false)} />}

        <aside className={`sidebar ${isSidebarOpen ? 'open' : 'closed'}`} onMouseEnter={() => handleSidebarHover(true)} onMouseLeave={() => handleSidebarHover(false)}>
          <div className="sidebar-header">
            <button type="button" className="sidebar-logo-button" onClick={() => setActiveMenu('dashboard')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', padding: 0, width: '100%' }}>
              <img src="/logo/Exam.png" alt="Logo" className="logo-img" />
              {isSidebarOpen && <span className="logo-text">ExamSync</span>}
            </button>
          </div>
          <nav className="sidebar-nav">
            <ul>
              {adminSidebarItems.map(({ key, label, icon }) => (
                <li key={key} className={activeMenu === key ? 'active' : ''}>
                  <button type="button" onClick={() => handleMenuClick(key)}>{icon} {isSidebarOpen && <span>{label}</span>}</button>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        <main className={`main-content ${isSidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>

          {/* ── Top bar: welcome pill (center) + right cluster ── */}
          <div className="floating-topbar">
            {activeMenu === 'dashboard' ? (
              <div className="topbar-welcome">
                {greeting}, <span className="highlight">{user.first_name}!</span>
              </div>
            ) : (
              <div className="topbar-pagetitle">
                {adminSidebarItems.find(i => i.key === activeMenu)?.label
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
                      <div className="dropdown-role">Admin</div>
                    </div>
                    <ul className="dropdown-menu-list">
                      <li><button type="button" onClick={() => handleMenuClick('profile')}><FaUser size={13} /> Profile</button></li>
                      {hasFacultyRole && <li><button type="button" onClick={() => navigate('/faculty-dashboard')}><FaUserShield size={13} /> Switch to Faculty Dashboard</button></li>}
                      <li className="dropdown-divider" />
                      <li><button type="button" className="dropdown-signout" onClick={() => { setDropdownOpen(false); setShowLogoutModal(true); }}><FaSignOutAlt size={13} /> Sign out</button></li>
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
          {renderContent()}
        </main>
      </div>

      {showLogoutModal && (
        <div className="myModal-overlay" onClick={() => setShowLogoutModal(false)}>
          <div className="myModal-box" onClick={e => e.stopPropagation()}>
            <h3 className="myModal-title">Are you sure you want to logout?</h3>
            <div className="myModal-actions">
              <button type="button" className="myModal-btn myModal-btn-confirm" onClick={handleLogout}>Logout</button>
              <button type="button" className="myModal-btn myModal-btn-cancel" onClick={() => setShowLogoutModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardAdmin;