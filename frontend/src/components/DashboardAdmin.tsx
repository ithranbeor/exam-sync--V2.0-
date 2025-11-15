// DashboardAdmin.tsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/apiClient.ts';
import { 
  FaHome, FaUsers, FaBuilding, FaBook, FaCalendarAlt, 
  FaUser, FaSignOutAlt 
} from 'react-icons/fa';
import { PiBuildingApartmentFill, PiBuildingsFill  } from "react-icons/pi";
import { FaBookAtlas, FaBookJournalWhills } from "react-icons/fa6";
import '../styles/dashboardFaculty.css';
import { BiSolidBuildings } from "react-icons/bi";
import { IoCalendarSharp } from "react-icons/io5";


import Colleges from '../components/Colleges.tsx';
import Departments from '../components/Departments.tsx';
import Programs from '../components/Programs.tsx';
import Courses from '../components/Courses.tsx';
import SectionCourses from '../components/SectionCourses.tsx';
import Terms from '../components/Terms.tsx';
import Buildings from '../components/Buildings.tsx';
import Rooms from '../components/Rooms.tsx';
import ExamPeriod from '../components/ExamPeriod.tsx';
import UserManagement from '../components/UserManagement.tsx';
import Profile from '../components/Profile.tsx';
import ProctorExamDate from "./ProctorExamDate.tsx";
import ProctorViewExam from "./ProctorViewExam.tsx";


const iconStyle = { className: 'icon', size: 25 };

// Sidebar menu
const adminSidebarItems = [
  { key: 'dashboard', label: 'Dashboard', icon: <FaHome {...iconStyle} /> },
  { key: 'colleges', label: 'Colleges', icon: <PiBuildingApartmentFill  {...iconStyle} /> },
  { key: 'departments', label: 'Departments', icon: <FaBuilding {...iconStyle} /> },
  { key: 'programs', label: 'Programs', icon: <FaBook {...iconStyle} /> },
  { key: 'courses', label: 'Courses', icon: <FaBookAtlas {...iconStyle} /> },
  { key: 'section-courses', label: 'Section Courses', icon: <FaBookJournalWhills {...iconStyle} /> },
  { key: 'terms', label: 'Terms', icon: <FaCalendarAlt {...iconStyle} /> },
  { key: 'buildings', label: 'Buildings', icon: <PiBuildingsFill {...iconStyle} /> },
  { key: 'rooms', label: 'Rooms', icon: <BiSolidBuildings {...iconStyle} /> },
  { key: 'exam-period', label: 'Exam Period', icon: <IoCalendarSharp {...iconStyle} /> },
  { key: 'User Management', label: 'User Management', icon: <FaUsers {...iconStyle} /> },
  { key: 'profile', label: 'Profile', icon: <FaUser {...iconStyle} /> },
];

const DashboardAdmin: React.FC = () => {
  const [user, setUser] = useState<any>(null);
  const [activeMenu, setActiveMenu] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [currentDateTime, setCurrentDateTime] = useState(new Date());
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const navigate = useNavigate();

  // Load logged-in user
  useEffect(() => {
    const loadUser = async () => {
      const stored = JSON.parse(localStorage.getItem('user') || 'null') || 
                     JSON.parse(sessionStorage.getItem('user') || 'null');
      if (!stored) return navigate('/admin-login');

      try {
        const res = await api.get(`/users/${stored.user_id}/`);
        const data = res.data;
        setUser({
          ...data,
          full_name: `${data.first_name} ${data.middle_name ?? ''} ${data.last_name}`.trim(),
          avatar_url: data.avatar_url || '../../static/Images/default-pp.jpg',
        });
      } catch (err) {
        console.error(err);
        setUser({
          ...stored,
          full_name: `${stored.first_name} ${stored.middle_name ?? ''} ${stored.last_name}`.trim(),
          avatar_url: stored.avatar_url || '../../static/Images/default-pp.jpg',
        });
      }
    };
    loadUser();
  }, [navigate]);

  // Clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentDateTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('user');
    sessionStorage.removeItem('user');
    navigate('/admin-login');
  };

  const formattedTime = currentDateTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  const [hour, minute, ampm] = formattedTime.split(/:| /);
  const dateStr = currentDateTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  if (!user) return <div style={{ color: "black" }}>Please Wait...</div>;

  const renderContent = () => {
    switch (activeMenu) {
      case 'colleges': return <Colleges/>;
      case 'departments': return <Departments/>;
      case 'programs': return <Programs user={user} />;
      case 'courses': return <Courses />;
      case 'section-courses': return <SectionCourses />;
      case 'terms': return <Terms />;
      case 'buildings': return <Buildings />;
      case 'rooms': return <Rooms />;
      case 'exam-period': return <ExamPeriod />;
      case 'User Management': return <UserManagement user={user} />
      case 'profile': return <Profile user={user} />;
      case 'dashboard':
      default:
        return (
          <div className="dashboard-grid">
            {activeMenu === 'dashboard' && (
            <div className="dashboard-grid">
              <div className="card welcome-card">
                <h3>Welcome, <span className="robert-name">{user.first_name}!</span></h3>
                <p>Organize your work and improve your performance here</p>
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
                <p>Admin</p>
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
          </div>
        );
    }
  };

  return (
    <div className="app-container">
      <div className="main-content-wrapper">
        <aside
          className={`sidebar ${isSidebarOpen ? 'open' : 'closed'}`}
          onMouseEnter={() => setIsSidebarOpen(true)}
          onMouseLeave={() => setIsSidebarOpen(false)}
        >
          <div className="sidebar-header">
            <img src="../../static/logo/Exam.png" alt="Logo" className="logo-img" />
            {isSidebarOpen && <span className="logo-text">ExamSync</span>}
          </div>
          <nav className="sidebar-nav">
            <ul>
              {adminSidebarItems.map(({ key, label, icon }) => (
                <li key={key} className={activeMenu === key ? 'active' : ''}>
                  <button type="button" onClick={() => setActiveMenu(key)}>
                    {icon} {isSidebarOpen && <span>{label}</span>}
                  </button>
                </li>
              ))}
              <li>
                <button type="button" onClick={() => setShowLogoutModal(true)}>
                  <FaSignOutAlt /> {isSidebarOpen && <span>Logout</span>}
                </button>
              </li>
            </ul>
          </nav>

          {showLogoutModal && (
            <div className="myModal-overlay">
              <div className="myModal-box">
                <h3>Are you sure you want to logout?</h3>
                <div className="myModal-actions">
                  <button type='button' className="myModal-btn myModal-btn-confirm" onClick={handleLogout}>Logout</button>
                  <button type='button' className="myModal-btn myModal-btn-cancel" onClick={() => setShowLogoutModal(false)}>Cancel</button>
                </div>
              </div>
            </div>
          )}
        </aside>

        <main className={`main-content ${isSidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
          <div className="content-header">
            <h1>{activeMenu.charAt(0).toUpperCase() + activeMenu.slice(1).replace(/-/g, ' ')}</h1>
          </div>
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default DashboardAdmin;
