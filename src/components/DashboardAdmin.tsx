// deno-lint-ignore-file jsx-button-has-type no-explicit-any
// DashboardAdmin.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.ts';
import {
  FaHome, FaBuilding, FaClipboardList, FaBook, FaUserGraduate,
  FaChalkboardTeacher, FaCalendarAlt, FaDoorOpen, FaUser,
  FaUsers, FaSignOutAlt, FaBookOpen, FaCalendarDay, FaUserCog
} from 'react-icons/fa';
import '../styles/dashboardFaculty.css';

import Colleges from '../components/Colleges.tsx';
import Departments from '../components/Departments.tsx';
import Programs from '../components/Programs.tsx';
import Courses from '../components/Courses.tsx';
import SectionCourses from '../components/SectionCourses.tsx';
import Terms from '../components/Terms.tsx';
import Buildings from '../components/Buildings.tsx';
import Rooms from '../components/Rooms.tsx';
import ExamPeriod from '../components/ExamPeriod.tsx';
import Accounts from '../components/Accounts.tsx';
import Roles from './UserRoles.tsx';
import Profile from '../components/Profile.tsx';

const iconStyle = { className: 'icon', size: 20 };

const DashboardAdmin = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [currentDateTime, setCurrentDateTime] = useState(new Date());
  const [activeMenu, setActiveMenu] = useState('dashboard');
  const [user, setUser] = useState<any>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const navigate = useNavigate();
  const [showLogoutModal, setShowLogoutModal] = useState(false);

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
    const fetchUserRoles = async () => {
      if (!user?.first_name) return;

      const { data, error } = await supabase.rpc('get_user_roles_by_first_name', {
        input_first_name: user.first_name
      });

      if (error) {
        console.error('Error fetching roles:', error.message);
      } else {
        const roleNames = data.map((row: { role_name: string }) => row.role_name);
        setRoles(roleNames);
      }
    };

    fetchUserRoles();
  }, [user]);

  const handleLogout = () => {
    localStorage.removeItem('user');
    sessionStorage.removeItem('user');
    navigate('/');
  };

  useEffect(() => {
    const timer = setInterval(() => setCurrentDateTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const getMonthName = (date: Date) =>
    date.toLocaleString('en-US', { month: 'long' });

  const getDayOfWeekName = (date: Date) =>
    date.toLocaleString('en-US', { weekday: 'long' });

  const formattedTime = currentDateTime.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  const [hour, minute, ampm] = formattedTime.split(/:| /);
  const currentMonthName = getMonthName(currentDateTime);
  const currentDay = currentDateTime.getDate();
  const currentDayOfWeek = getDayOfWeekName(currentDateTime);

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

              <div className="sidebar-divider"></div>

              <li className={activeMenu === 'colleges' ? 'active' : ''}>
                <button onClick={() => setActiveMenu('colleges')}>
                  <FaUserGraduate {...iconStyle} />
                  {isSidebarOpen && <span>Colleges</span>}
                </button>
              </li>
              <li className={activeMenu === 'departments' ? 'active' : ''}>
                <button onClick={() => setActiveMenu('departments')}>
                  <FaChalkboardTeacher {...iconStyle} />
                  {isSidebarOpen && <span>Departments</span>}
                </button>
              </li>
              <li className={activeMenu === 'programs' ? 'active' : ''}>
                <button onClick={() => setActiveMenu('programs')}>
                  <FaBookOpen {...iconStyle} />
                  {isSidebarOpen && <span>Programs</span>}
                </button>
              </li>
              <li className={activeMenu === 'courses' ? 'active' : ''}>
                <button onClick={() => setActiveMenu('courses')}>
                  <FaBook {...iconStyle} />
                  {isSidebarOpen && <span>Courses</span>}
                </button>
              </li>
              <li className={activeMenu === 'section-courses' ? 'active' : ''}>
                <button onClick={() => setActiveMenu('section-courses')}>
                  <FaClipboardList {...iconStyle} />
                  {isSidebarOpen && <span>Section Courses</span>}
                </button>
              </li>
              <li className={activeMenu === 'terms' ? 'active' : ''}>
                <button onClick={() => setActiveMenu('terms')}>
                  <FaCalendarDay {...iconStyle} />
                  {isSidebarOpen && <span>Terms</span>}
                </button>
              </li>

              <div className="sidebar-divider"></div>

              <li className={activeMenu === 'buildings' ? 'active' : ''}>
                <button onClick={() => setActiveMenu('buildings')}>
                  <FaBuilding {...iconStyle} />
                  {isSidebarOpen && <span>Buildings</span>}
                </button>
              </li>
              <li className={activeMenu === 'rooms' ? 'active' : ''}>
                <button onClick={() => setActiveMenu('rooms')}>
                  <FaDoorOpen {...iconStyle} />
                  {isSidebarOpen && <span>Rooms</span>}
                </button>
              </li>
              <li className={activeMenu === 'exam-period' ? 'active' : ''}>
                <button onClick={() => setActiveMenu('exam-period')}>
                  <FaCalendarAlt {...iconStyle} />
                  {isSidebarOpen && <span>Exam Period</span>}
                </button>
              </li>

              <div className="sidebar-divider"></div>

              <li className={activeMenu === 'accounts' ? 'active' : ''}>
                <button onClick={() => setActiveMenu('accounts')}>
                  <FaUsers {...iconStyle} />
                  {isSidebarOpen && <span>Accounts</span>}
                </button>
              </li>
              <li className={activeMenu === 'role' ? 'active' : ''}>
                <button onClick={() => setActiveMenu('role')}>
                  <FaUserCog {...iconStyle} />
                  {isSidebarOpen && <span>Roles and Permissions</span>}
                </button>
              </li>

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
      </aside>

      {/* Modal outside sidebar */}
      {showLogoutModal && (
        <div className="myModal-overlay">
          <div className="myModal-box">
            <h3 className="myModal-title">Are you sure you want to logout?</h3>
            <div className="myModal-actions">
              <button
                onClick={() => {
                  setShowLogoutModal(false);
                  handleLogout();
                }}
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

        <main className={`main-content ${isSidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
          <div className="content-header">
            <h1>{activeMenu.charAt(0).toUpperCase() + activeMenu.slice(1)}</h1>
          </div>

          {activeMenu === 'dashboard' && (
            <div className="dashboard-grid">
              <div className="card welcome-card">
                <h3>
                  Welcome, <span className="robert-name">{user.first_name || 'User'}!</span>
                </h3>
                <p>Organize your work and improve your performance here</p>
              </div>

              <div className="card datetime-card">
                <div className="date-display-simple">
                  <span>{currentMonthName} {currentDay}, {currentDayOfWeek}</span>
                </div>
                <div className="time-display">
                  <span>{hour}:</span>
                  <span>{minute}</span>
                  <span className="ampm">{ampm}</span>
                </div>
              </div>

              <div className="card faculty-info-card">
                <img
                  src={user.avatar_url ?? './src/assets/default-pp.jpg'}
                  alt="User avatar"
                  className="faculty-avatar"
                />
                <h4>{user.first_name} {user.middle_name} {user.last_name}</h4>
                <p>{roles.length ? roles.join(', ') : 'Loading role(s)...'}</p>
              </div>

              <div className="full-width-section">
                <h2>Shortcut</h2>
                <div className="try-things-grid">
                  <div className="card try-thing-card" ><ExamPeriod />
                  </div>

                  <div className="card try-thing-card"> <SectionCourses />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeMenu === 'colleges' && <Colleges user={user} />}
          {activeMenu === 'departments' && <Departments user={user} />}
          {activeMenu === 'programs' && <Programs user={user} />}
          {activeMenu === 'courses' && <Courses />}
          {activeMenu === 'section-courses' && <SectionCourses />}
          {activeMenu === 'terms' && <Terms />}
          {activeMenu === 'buildings' && <Buildings />}
          {activeMenu === 'rooms' && <Rooms />}
          {activeMenu === 'exam-period' && <ExamPeriod />}
          {activeMenu === 'accounts' && <Accounts user={user} />}
          {activeMenu === 'role' && <Roles />}
          {activeMenu === 'profile' && <Profile user={user}/>}
        </main>
      </div>
    </div>
  );
};

export default DashboardAdmin;
