// DashboardFaculty.tsx — Merged: Dashboard + ExamDateViewer + ProctorAssignedExams
import { useEffect, useRef, useState } from 'react';
import type { JSX } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/apiClient.ts';
import {
  FaHome, FaClock, FaClipboardList, FaBell, FaUser,
  FaSignOutAlt, FaBuilding, FaPenAlt, FaCalendarPlus, FaUsers, FaUserShield,
  FaBars, FaTimes, FaEye, FaClipboardCheck, FaChevronLeft, FaChevronRight,
  FaCalendarAlt, FaListUl, FaChevronDown, FaChevronUp, FaCheckCircle,
} from 'react-icons/fa';
import { BsFillSendPlusFill } from 'react-icons/bs';
import '../styles/F_Dashboard.css';

import Profile from './F_Profile.tsx';
import ProctorSetAvailability from './P_ProctorAvailability.tsx';
import ProctorViewExam from './F_ExamViewer.tsx';
import Notification from './F_Notification.tsx';
import BayanihanModality from './B_BayanihanModality.tsx';
import SchedulerPlotSchedule from './S_ExamViewer.tsx';
import SchedulerAvailability from './S_ProctorsAvailabilityView.tsx';
import DeanRequests from './D_DeanRequests.tsx';
import RoomManagement from './S_RoomManagement.tsx';
import ProctorMonitoring from './S_ProctorMonitoring.tsx';
import ProctorAttendance from './P_ProctorAttendance.tsx';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type ExamPeriod = {
  examperiod_id: number;
  start_date: string;
  end_date: string;
  academic_year: string;
  exam_category: string;
  term: number | null;
  term_id: number | null;
  term_name: string;
  department: string | null;
  department_id: string | null;
  department_name: string;
  college: string | null;
  college_id: string | null;
  college_name: string;
};

type Term = { term_id: number; term_name: string };

interface ProctorAssignment {
  assignment_id: number;
  course_id: string;
  section: string;
  exam_date: string;
  exam_start_time: string;
  exam_end_time: string;
  room_id: string;
  building: string;
  instructor: string;
  examdetails_status: string;
  is_history?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sidebar config
// ─────────────────────────────────────────────────────────────────────────────

const iconStyle = { className: 'icon', size: 20 };

const roleSidebarMap: Record<string, { key: string; label: string; icon: JSX.Element }[]> = {
  proctor: [
    { key: 'set-Availability',   label: 'Set Availability',   icon: <FaClock {...iconStyle} /> },
    { key: 'exam-Schedule',      label: 'Exam Schedule',      icon: <FaClipboardList {...iconStyle} /> },
    { key: 'proctor-Attendance', label: 'Proctor Attendance', icon: <FaClipboardCheck {...iconStyle} /> },
  ],
  scheduler: [
    { key: 'plot-Schedule',          label: 'Plot Schedule',      icon: <FaCalendarPlus {...iconStyle} /> },
    { key: 'exam-Schedule',          label: 'Exam Schedule',      icon: <FaClipboardList {...iconStyle} /> },
    { key: 'proctors-Availability',  label: 'Available Proctor',  icon: <FaUsers {...iconStyle} /> },
    { key: 'proctor-Monitoring',     label: 'Proctor Monitoring', icon: <FaEye {...iconStyle} /> },
    { key: 'set-Modality',           label: 'Modality',      icon: <FaPenAlt {...iconStyle} /> },
    { key: 'Room-Management',        label: 'Room Management',    icon: <FaBuilding {...iconStyle} /> },
  ],
  dean: [
    { key: 'Request',   label: 'Requests',  icon: <BsFillSendPlusFill {...iconStyle} /> },
  ],
  'bayanihan leader': [
    { key: 'set-Modality',  label: 'Modality', icon: <FaPenAlt {...iconStyle} /> },
    { key: 'exam-Schedule', label: 'Exam Schedule', icon: <FaClipboardList {...iconStyle} /> },
  ],
  admin: [
    { key: 'plot-Schedule',         label: 'Plot Schedule',     icon: <FaCalendarPlus {...iconStyle} /> },
    { key: 'exam-Schedule',         label: 'Exam Schedule',     icon: <FaClipboardList {...iconStyle} /> },
    { key: 'proctors-Availability', label: 'Available Proctor', icon: <FaUsers {...iconStyle} /> },
    { key: 'Room-Management',       label: 'Room Management',   icon: <FaBuilding {...iconStyle} /> },
  ],
};

const pagesWithNoTitle = ['plot-Schedule'];

const COLLEGES   = ['CSM', 'CITC', 'COT', 'CEA', 'CSTE', 'SHS'];
const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const YEAR_OPTIONS: number[] = [];
for (let y = 2020; y <= 2030; y++) YEAR_OPTIONS.push(y);

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const formatTimeFull = (timeStr: string) => {
  const slice = timeStr.slice(11, 16);
  const [h, m] = slice.split(':');
  const hour = parseInt(h, 10);
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`;
};

const formatDateFull = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });

const getDuration = (startTime: string, endTime: string) => {
  const minutes = Math.round(
    (new Date(`2000-01-01T${endTime.slice(11)}`).getTime() -
     new Date(`2000-01-01T${startTime.slice(11)}`).getTime()) / 60000
  );
  const h = Math.floor(minutes / 60), m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

const isExamOngoing = (examDate: string, startTime: string, endTime: string) => {
  try {
    const now = new Date();
    const examDateObj = new Date(examDate);
    const isSameDay =
      now.getFullYear() === examDateObj.getFullYear() &&
      now.getMonth()    === examDateObj.getMonth() &&
      now.getDate()     === examDateObj.getDate();
    if (!isSameDay) return false;
    return now.getTime() >= new Date(startTime).getTime() && now.getTime() <= new Date(endTime).getTime();
  } catch { return false; }
};

// ─────────────────────────────────────────────────────────────────────────────
// Sub-component: Integrated Dashboard Home
// ─────────────────────────────────────────────────────────────────────────────

const DashboardHome = ({
  user,
  roles,
  onNavigate,
}: {
  user: any;
  roles: string[];
  onNavigate: (key: string) => void;
}) => {
  // ── Calendar state ────────────────────────────────────────────────────
  const [currentMonth, setCurrentMonth]   = useState(new Date());
  const [examPeriods, setExamPeriods]     = useState<ExamPeriod[]>([]);
  const [termMap, setTermMap]             = useState<Record<string, string>>({});
  const [openDropdown, setOpenDropdown]   = useState<string | null>(null);
  const [showSidebar, setShowSidebar]     = useState(true);
  const [calFilters, setCalFilters]       = useState({ academicYear: '', examCategory: '', collegeName: '', termId: '' });
  const dropdownRef = useRef<HTMLDivElement>(null);

  // ── Proctor assignment state ──────────────────────────────────────────
  const [assignments, setAssignments]     = useState<ProctorAssignment[]>([]);
  const [assignFilter, setAssignFilter]   = useState<'upcoming' | 'ongoing' | 'completed' | 'all'>('upcoming');
  const [expandedCard, setExpandedCard]   = useState<number | null>(null);
  const [userCollege, setUserCollege]     = useState<string | null>(null);

  const today         = new Date();
  const currentYear   = currentMonth.getFullYear();
  const currentMonthI = currentMonth.getMonth();
  const isProctor     = roles.includes('proctor');
  const isScheduler   = roles.includes('scheduler') || roles.includes('admin');

  // ── Click outside ─────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node))
        setOpenDropdown(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Fetch exam periods ────────────────────────────────────────────────
  useEffect(() => {
    const fetch = async () => {
      try {
        const [{ data: examData }, { data: termData }] = await Promise.all([
          api.get<ExamPeriod[]>('/tbl_examperiod'),
          api.get<Term[]>('/tbl_term'),
        ]);
        if (examData) setExamPeriods(examData);
        if (termData) {
          const map: Record<string, string> = {};
          termData.forEach((t) => (map[t.term_id] = t.term_name));
          setTermMap(map);
        }
      } catch (err) { console.error('Exam periods fetch error:', err); }
    };
    fetch();
    const id = setInterval(fetch, 30000);
    return () => clearInterval(id);
  }, []);

  // ── Fetch user college ────────────────────────────────────────────────
  useEffect(() => {
    const resolve = async () => {
      if (!user?.user_id) return;
      if (user.college_id) { setUserCollege(user.college_id); return; }
      try {
        const { data: rolesData } = await api.get(`/tbl_user_role`, { params: { user_id: user.user_id } });
        const r = rolesData?.find((r: any) => r.college_id || r.college);
        if (r) { setUserCollege(r.college_id || r.college); return; }
        const { data: ud } = await api.get(`/tbl_users/${user.user_id}`);
        if (ud?.college_id) setUserCollege(ud.college_id);
      } catch (err) { console.error('College resolve error:', err); }
    };
    resolve();
  }, [user?.user_id]);

  // ── Fetch proctor assignments ─────────────────────────────────────────
  useEffect(() => {
    if (!user?.user_id || !isProctor) return;
    const fetch = async () => {
      try {
        const res = await api.get(`/proctor-assigned-exams/${user.user_id}/`);
        const upcoming  = Array.isArray(res.data?.upcoming)  ? res.data.upcoming  : [];
        const ongoing   = Array.isArray(res.data?.ongoing)   ? res.data.ongoing   : [];
        const completed = Array.isArray(res.data?.completed) ? res.data.completed : [];
        const map = (exam: any, isHistory = false): ProctorAssignment => ({
          assignment_id:      exam.id,
          course_id:          exam.course_id,
          section:            exam.section_name || 'N/A',
          exam_date:          exam.exam_date,
          exam_start_time:    exam.exam_start_time,
          exam_end_time:      exam.exam_end_time,
          room_id:            exam.room_id,
          building:           exam.building_name || 'N/A',
          instructor:         exam.instructor_name || 'N/A',
          examdetails_status: exam.status || 'pending',
          is_history:         isHistory,
        });
        const combined: ProctorAssignment[] = [
          ...upcoming.map((e: any)  => map(e, false)),
          ...ongoing.map((e: any)   => map(e, false)),
          ...completed.map((e: any) => map(e, true)),
        ].sort((a, b) =>
          new Date(`${a.exam_date} ${a.exam_start_time}`).getTime() -
          new Date(`${b.exam_date} ${b.exam_start_time}`).getTime()
        );
        setAssignments(combined);
      } catch (err) { console.error('Proctor assignments fetch error:', err); }
    };
    fetch();
    const id = setInterval(fetch, 30000);
    return () => clearInterval(id);
  }, [user?.user_id, isProctor]);

  // ── Calendar helpers ──────────────────────────────────────────────────
  const daysInMonth   = new Date(currentYear, currentMonthI + 1, 0).getDate();
  const firstDayIndex = new Date(currentYear, currentMonthI, 1).getDay();

  const examDaysThisMonth = new Set(
    examPeriods
      .filter(ep => {
        const d = new Date(ep.start_date);
        return d.getFullYear() === currentYear && d.getMonth() === currentMonthI;
      })
      .map(ep => new Date(ep.start_date).getDate())
  ).size;

  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const upcomingExams = examPeriods
    .filter(ep => {
      const d = new Date(ep.start_date);
      if (d < todayMidnight) return false;
      if (calFilters.academicYear && ep.academic_year !== calFilters.academicYear) return false;
      if (calFilters.examCategory && ep.exam_category !== calFilters.examCategory) return false;
      if (calFilters.collegeName  && ep.college_name  !== calFilters.collegeName)  return false;
      if (calFilters.termId       && String(ep.term_id) !== calFilters.termId)     return false;
      return true;
    })
    .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());

  const upcomingByDate = upcomingExams.reduce<Record<string, ExamPeriod[]>>((acc, ep) => {
    const key = new Date(ep.start_date).toDateString();
    if (!acc[key]) acc[key] = [];
    acc[key].push(ep);
    return acc;
  }, {});

  const collegeCountThisMonth = COLLEGES.reduce<Record<string, number>>((acc, col) => {
    acc[col] = examPeriods.filter(ep => {
      const d = new Date(ep.start_date);
      return d.getFullYear() === currentYear && d.getMonth() === currentMonthI &&
        (ep.college_id === col || ep.college_name === col);
    }).length;
    return acc;
  }, {});

  // ── Proctor filtering ─────────────────────────────────────────────────
  const now = new Date();

  const filteredAssignments = assignments.filter(a => {
    const start     = new Date(a.exam_start_time);
    const end       = new Date(a.exam_end_time);
    const ongoing   = isExamOngoing(a.exam_date, a.exam_start_time, a.exam_end_time);
    const status    = (a.examdetails_status || '').toLowerCase().trim();
    const checkedIn = ['present','late','substitute','confirmed','absent'].some(s => status.includes(s));
    if (assignFilter === 'upcoming')  return start > now && !a.is_history;
    if (assignFilter === 'ongoing')   return ongoing && !checkedIn && !a.is_history;
    if (assignFilter === 'completed') return checkedIn || end < now || a.is_history;
    return true;
  });

  const upcomingCount  = assignments.filter(a => !a.is_history && new Date(a.exam_start_time) > now).length;
  const ongoingCount   = assignments.filter(a => {
    const status    = (a.examdetails_status || '').toLowerCase();
    const checkedIn = ['present','late','substitute'].some(s => status.includes(s));
    return isExamOngoing(a.exam_date, a.exam_start_time, a.exam_end_time) && !checkedIn && !a.is_history;
  }).length;
  const completedCount = assignments.filter(a => {
    const status    = (a.examdetails_status || '').toLowerCase();
    const checkedIn = ['present','late','substitute','confirmed','absent'].some(s => status.includes(s));
    return checkedIn || new Date(a.exam_end_time) < now || a.is_history;
  }).length;

  // ── College exam dates for sidebar ────────────────────────────────────
  const collegeExamDates = examPeriods
    .filter(ep => {
      const d = new Date(ep.start_date);
      if (d < todayMidnight) return false;
      if (!userCollege) return true;
      return (
        (ep.college_id   && ep.college_id.toLowerCase()   === userCollege.toLowerCase()) ||
        (ep.college_name && ep.college_name.toLowerCase() === userCollege.toLowerCase())
      );
    })
    .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());

  const collegeExamsByDate = collegeExamDates.reduce<Record<string, ExamPeriod[]>>((acc, ep) => {
    const key = new Date(ep.start_date).toDateString();
    if (!acc[key]) acc[key] = [];
    acc[key].push(ep);
    return acc;
  }, {});

  // ── Calendar cells ────────────────────────────────────────────────────
  const calendarCells: React.ReactNode[] = [];
  for (let i = 0; i < firstDayIndex; i++) {
    calendarCells.push(<div key={`empty-${i}`} className="dh-cal-cell dh-cal-empty" />);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(currentYear, currentMonthI, day);
    const events = examPeriods.filter(ep => {
      if (calFilters.academicYear && ep.academic_year !== calFilters.academicYear) return false;
      if (calFilters.examCategory && ep.exam_category !== calFilters.examCategory) return false;
      if (calFilters.collegeName  && ep.college_name  !== calFilters.collegeName)  return false;
      if (calFilters.termId       && String(ep.term_id) !== calFilters.termId)     return false;
      return date.toDateString() === new Date(ep.start_date).toDateString();
    });
    const isToday =
      date.getFullYear() === today.getFullYear() &&
      date.getMonth()    === today.getMonth() &&
      date.getDate()     === today.getDate();

    calendarCells.push(
      <div key={`day-${day}`} className={`dh-cal-cell${isToday ? ' dh-cal-today' : ''}`}>
        <span className="dh-cal-daynumber">{day}</span>
        {events.length > 0 && (
          <div className="dh-cal-events">
            {Array.from(new Set(events.map(e => e.college_id || ''))).filter(Boolean).map((col, idx) => (
              <div key={idx} className={`dh-college-badge dh-col-${col.toLowerCase()}`}>{col}</div>
            ))}
            <div className="dh-cal-term">{termMap[String(events[0].term_id)] || ''}</div>
            <div className="dh-cal-cat">{events[0].exam_category}</div>
          </div>
        )}
      </div>
    );
  }

  // ── Quick shortcut cards ──────────────────────────────────────────────
  const shortcuts = [
    ...(isScheduler ? [{ key: 'plot-Schedule', label: 'Plot Schedule', icon: <FaCalendarPlus size={18} />, desc: 'Create & manage schedules' }] : []),
    ...(isProctor   ? [{ key: 'set-Availability', label: 'Set Availability', icon: <FaClock size={18} />, desc: 'Manage your availability' }] : []),
    { key: 'exam-Schedule', label: 'Exam Schedule', icon: <FaClipboardList size={18} />, desc: 'View all exam schedules' },
    ...(isScheduler ? [{ key: 'proctors-Availability', label: 'Available Proctors', icon: <FaUsers size={18} />, desc: 'Check proctor availability' }] : []),
    ...(roles.includes('dean') ? [{ key: 'Request', label: 'Requests', icon: <BsFillSendPlusFill size={18} />, desc: 'Manage approval requests' }] : []),
    ...(isProctor   ? [{ key: 'proctor-Attendance', label: 'My Attendance', icon: <FaClipboardCheck size={18} />, desc: 'View proctor attendance' }] : []),
    ...(isScheduler ? [{ key: 'Room-Management', label: 'Room Management', icon: <FaBuilding size={18} />, desc: 'Manage exam rooms' }] : []),
  ];

  return (
    <div className="dh-root">

      {/* ── Quick Shortcuts ───────────────────────────────────────────── */}
      {shortcuts.length > 0 && (
        <div className="dh-shortcuts-bar">
          {shortcuts.slice(0, 6).map(sc => (
            <button
              key={sc.key}
              type="button"
              className="dh-shortcut-btn"
              onClick={() => onNavigate(sc.key)}
            >
              <span className="dh-shortcut-icon">{sc.icon}</span>
              <span className="dh-shortcut-label">{sc.label}</span>
              <span className="dh-shortcut-desc">{sc.desc}</span>
            </button>
          ))}
        </div>
      )}

      {/* ── Calendar Section ─────────────────────────────────────────── */}
      <div className="dh-section-card">

        {/* Calendar header */}
        <div className="dh-cal-header">
          <div className="dh-cal-header-left">
            <div className="dh-cal-icon-wrap"><FaCalendarAlt size={16} /></div>
            <div>
              <h2 className="dh-cal-title">{MONTH_NAMES[currentMonthI]} {currentYear}</h2>
              <p className="dh-cal-subtitle">
                {examDaysThisMonth > 0
                  ? `${examDaysThisMonth} exam day${examDaysThisMonth !== 1 ? 's' : ''} this month`
                  : 'No exams scheduled this month'}
              </p>
            </div>
          </div>

          <div className="dh-cal-controls">
            {/* Filter badges */}
            <div className="dh-filter-badges">
              {calFilters.examCategory && <span className="dh-filter-badge">{calFilters.examCategory}</span>}
              {calFilters.termId       && <span className="dh-filter-badge">{termMap[calFilters.termId]}</span>}
              {calFilters.collegeName  && <span className="dh-filter-badge">{calFilters.collegeName}</span>}
            </div>

            <div className="dh-cal-nav">
              <button type="button" className="dh-nav-arrow" onClick={() => { const d = new Date(currentMonth); d.setMonth(d.getMonth() - 1); setCurrentMonth(d); }}>
                <FaChevronLeft size={12} />
              </button>
              <button type="button" className="dh-nav-arrow" onClick={() => setCurrentMonth(new Date())}>Today</button>
              <button type="button" className="dh-nav-arrow" onClick={() => { const d = new Date(currentMonth); d.setMonth(d.getMonth() + 1); setCurrentMonth(d); }}>
                <FaChevronRight size={12} />
              </button>
            </div>

            {/* Filter dropdown */}
            <div className="dh-filter-wrapper" ref={dropdownRef}>
              <button
                type="button"
                className="dh-filter-btn"
                onClick={() => setOpenDropdown(openDropdown === 'cal' ? null : 'cal')}
              >
                Filters
              </button>
              <button
                type="button"
                className={`dh-filter-btn${showSidebar ? ' dh-filter-btn--active' : ''}`}
                onClick={() => setShowSidebar(v => !v)}
              >
                <FaListUl size={10} style={{ marginRight: 4 }} />
                {showSidebar ? 'Hide Panel' : 'Show Panel'}
              </button>

              {openDropdown === 'cal' && (
                <div className="dh-filter-dropdown">
                  <div className="dh-filter-group">
                    <label>Month</label>
                    <select value={currentMonthI} onChange={e => { const d = new Date(currentMonth); d.setMonth(+e.target.value); setCurrentMonth(d); }}>
                      {MONTH_NAMES.map((m, i) => <option key={i} value={i}>{m}</option>)}
                    </select>
                  </div>
                  <div className="dh-filter-group">
                    <label>Year</label>
                    <select value={currentYear} onChange={e => { const d = new Date(currentMonth); d.setFullYear(+e.target.value); setCurrentMonth(d); }}>
                      {YEAR_OPTIONS.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>
                  <div className="dh-filter-group">
                    <label>Semester</label>
                    <select value={calFilters.termId} onChange={e => setCalFilters(f => ({ ...f, termId: e.target.value }))}>
                      <option value="">All</option>
                      {Object.entries(termMap).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                    </select>
                  </div>
                  <div className="dh-filter-group">
                    <label>Category</label>
                    <select value={calFilters.examCategory} onChange={e => setCalFilters(f => ({ ...f, examCategory: e.target.value }))}>
                      <option value="">All</option>
                      {['Preliminary','Midterm','Prefinal','Final'].map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="dh-filter-group">
                    <label>College</label>
                    <select value={calFilters.collegeName} onChange={e => setCalFilters(f => ({ ...f, collegeName: e.target.value }))}>
                      <option value="">All</option>
                      {COLLEGES.map(col => <option key={col} value={col}>{col}</option>)}
                    </select>
                  </div>
                  <button type="button" className="dh-filter-clear" onClick={() => setCalFilters({ academicYear: '', examCategory: '', collegeName: '', termId: '' })}>
                    Clear Filters
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Two-column: calendar + sidebar */}
        <div className={`dh-cal-layout${showSidebar ? ' dh-cal-layout--sidebar' : ''}`}>

          {/* Calendar */}
          <div className="dh-cal-main">
            <div className="dh-cal-weekdays">
              {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
                <div key={d} className="dh-cal-weekday">{d}</div>
              ))}
            </div>
            <div className="dh-cal-grid">{calendarCells}</div>

            {/* Legend */}
            <div className="dh-legend">
              {COLLEGES.map(col => (
                <div key={col} className={`dh-legend-item dh-col-${col.toLowerCase()}`}>{col}</div>
              ))}
            </div>
          </div>

          {/* Right sidebar */}
          {showSidebar && (
            <aside className="dh-right-sidebar">

              {/* Upcoming exam dates */}
              <div className="dh-sidebar-card">
                <div className="dh-sidebar-card-title">
                  Upcoming Exams
                  <span className="dh-sidebar-count">{Object.keys(upcomingByDate).length}</span>
                </div>
                {Object.keys(upcomingByDate).length === 0 ? (
                  <p className="dh-sidebar-empty">No upcoming exams</p>
                ) : (
                  Object.entries(upcomingByDate).slice(0, 6).map(([dateStr, eps]) => {
                    const d     = new Date(dateStr);
                    const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    const uniqueColleges = Array.from(new Set(eps.map(ep => ep.college_id).filter(Boolean))) as string[];
                    return (
                      <div key={dateStr} className="dh-sidebar-exam-row">
                        <div className="dh-sidebar-exam-date">
                          {label} · {termMap[String(eps[0].term_id)] || 'Unknown Term'}
                        </div>
                        <div className="dh-sidebar-exam-name">{eps[0].exam_category} Exam</div>
                        <div className="dh-sidebar-badges">
                          {uniqueColleges.map((col, i) => (
                            <span key={i} className={`dh-college-badge dh-col-${col.toLowerCase()}`}>{col}</span>
                          ))}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Month overview */}
              <div className="dh-sidebar-card">
                <div className="dh-sidebar-card-title">{MONTH_NAMES[currentMonthI]} Overview</div>
                {COLLEGES.map(col => {
                  const count = collegeCountThisMonth[col] || 0;
                  return (
                    <div key={col} className="dh-sidebar-college-row">
                      <span className={`dh-college-badge dh-col-${col.toLowerCase()}`}>{col}</span>
                      <span className="dh-sidebar-college-count">{count} exam{count !== 1 ? 's' : ''}</span>
                    </div>
                  );
                })}
              </div>

              {/* College exam dates (proctor's college) */}
              {isProctor && (
                <div className="dh-sidebar-card">
                  <div className="dh-sidebar-card-title">
                    Exam Dates
                    {userCollege && <span className="dh-college-pill">{userCollege}</span>}
                  </div>
                  {Object.keys(collegeExamsByDate).length === 0 ? (
                    <p className="dh-sidebar-empty">No upcoming exam dates</p>
                  ) : (
                    Object.entries(collegeExamsByDate).slice(0, 5).map(([dateStr, eps]) => {
                      const d         = new Date(dateStr);
                      const label     = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                      const dayName   = d.toLocaleDateString('en-US', { weekday: 'short' });
                      const isThisWeek = (d.getTime() - now.getTime()) < 7 * 24 * 60 * 60 * 1000;
                      return (
                        <div key={dateStr} className={`dh-college-date-row${isThisWeek ? ' dh-college-date-row--soon' : ''}`}>
                          <div className="dh-college-date-top">
                            <span className="dh-college-date-label">{dayName}, {label}</span>
                            {isThisWeek && <span className="dh-soon-pill">SOON</span>}
                          </div>
                          <div className="dh-college-date-name">{eps[0].exam_category} Exam</div>
                          <div className="dh-college-date-meta">
                            {termMap[String(eps[0].term_id)] || eps[0].term_name || 'Unknown Term'}
                            {eps[0].academic_year ? ` · ${eps[0].academic_year}` : ''}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

            </aside>
          )}
        </div>
      </div>

      {/* ── Proctor Assignments (only for proctors) ────────────────────── */}
      {isProctor && (
        <div className="dh-section-card dh-assignments-card">
          <div className="dh-assignments-header">
            <div>
              <h3 className="dh-assignments-title">Assigned Proctoring</h3>
              <p className="dh-assignments-sub">{assignments.length} total sections</p>
            </div>
            <div className="dh-assign-filters">
              {([
                { key: 'upcoming',  label: `Upcoming (${upcomingCount})`,   icon: <FaClock size={11} /> },
                { key: 'ongoing',   label: `On-going (${ongoingCount})`,    icon: <FaClock size={11} /> },
                { key: 'completed', label: `Completed (${completedCount})`, icon: <FaCheckCircle size={11} /> },
                { key: 'all',       label: `All (${assignments.length})`,   icon: null },
              ] as const).map(f => (
                <button
                  key={f.key}
                  type="button"
                  className={`dh-assign-filter-btn${assignFilter === f.key ? ' active' : ''}`}
                  onClick={() => setAssignFilter(f.key)}
                >
                  {f.icon} {f.label}
                </button>
              ))}
              <button
                type="button"
                className="dh-assign-filter-btn"
                onClick={() => onNavigate('exam-Schedule')}
              >
                View All →
              </button>
            </div>
          </div>

          {filteredAssignments.length === 0 ? (
            <div className="dh-assign-empty">
              <p>
                {assignFilter === 'all' ? 'No proctoring assignments yet'
                  : assignFilter === 'ongoing' ? 'No on-going exams'
                  : `No ${assignFilter} proctoring assignments`}
              </p>
            </div>
          ) : (
            <div className="dh-assign-list">
              {filteredAssignments.slice(0, 5).map(assign => {
                const examStart  = new Date(assign.exam_start_time);
                const examEnd    = new Date(assign.exam_end_time);
                const ongoing    = isExamOngoing(assign.exam_date, assign.exam_start_time, assign.exam_end_time);
                const status     = (assign.examdetails_status || 'pending').toLowerCase().trim();
                const checkedIn  = ['present','late','substitute','confirmed','absent'].some(s => status.includes(s));
                const isUpcoming = examStart > now;
                const isCompleted = checkedIn || examEnd < now || assign.is_history === true;
                const isExpanded  = expandedCard === assign.assignment_id;
                const duration    = getDuration(assign.exam_start_time, assign.exam_end_time);

                let displayStatus = 'Upcoming', statusClass = 'dh-badge-upcoming';
                if (isCompleted) {
                  if (status.includes('confirmed') || status.includes('present')) { displayStatus = 'Present';    statusClass = 'dh-badge-completed'; }
                  else if (status.includes('late'))       { displayStatus = 'Late';       statusClass = 'dh-badge-late'; }
                  else if (status.includes('substitute')) { displayStatus = 'Substitute'; statusClass = 'dh-badge-substitute'; }
                  else if (status.includes('absent'))     { displayStatus = 'Absent';     statusClass = 'dh-badge-absent'; }
                  else                                    { displayStatus = 'Completed';  statusClass = 'dh-badge-completed'; }
                } else if (ongoing)   { displayStatus = 'On-going'; statusClass = 'dh-badge-ongoing'; }
                else if (isUpcoming)  { displayStatus = 'Upcoming'; statusClass = 'dh-badge-upcoming'; }

                return (
                  <div
                    key={`${assign.assignment_id}-${assign.is_history ? 'h' : 'c'}`}
                    className={`dh-assign-item${isCompleted ? ' dh-assign-completed' : ongoing ? ' dh-assign-ongoing' : ''}`}
                  >
                    <div
                      className="dh-assign-item-header"
                      onClick={() => setExpandedCard(isExpanded ? null : assign.assignment_id)}
                    >
                      <div className="dh-assign-item-left">
                        <div className="dh-course-code">{assign.course_id}</div>
                        <div className="dh-assign-item-info">
                          <p className="dh-assign-section">{assign.section}</p>
                          <p className="dh-assign-instructor">{assign.instructor}</p>
                          <div className="dh-assign-preview">
                            <span>{new Date(assign.exam_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                            <span className="dh-sep">·</span>
                            <span>{formatTimeFull(assign.exam_start_time)} – {formatTimeFull(assign.exam_end_time)}</span>
                            <span className="dh-duration">({duration})</span>
                            <span className="dh-sep">·</span>
                            <span>{assign.building} Rm {assign.room_id}</span>
                          </div>
                        </div>
                      </div>
                      <div className="dh-assign-item-right">
                        <span className={`dh-status-badge ${statusClass}`}>{displayStatus}</span>
                        <button type="button" className="dh-expand-btn" aria-label="Toggle">
                          {isExpanded ? <FaChevronUp size={13} /> : <FaChevronDown size={13} />}
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="dh-assign-detail">
                        <div className="dh-detail-group">
                          <span className="dh-detail-label">Date</span>
                          <span className="dh-detail-val">{formatDateFull(assign.exam_date)}</span>
                        </div>
                        <div className="dh-detail-group">
                          <span className="dh-detail-label">Time</span>
                          <span className="dh-detail-val">{formatTimeFull(assign.exam_start_time)} – {formatTimeFull(assign.exam_end_time)} ({duration})</span>
                        </div>
                        <div className="dh-detail-group">
                          <span className="dh-detail-label">Building</span>
                          <span className="dh-detail-val">{assign.building}</span>
                        </div>
                        <div className="dh-detail-group">
                          <span className="dh-detail-label">Room</span>
                          <span className="dh-detail-val">{assign.room_id}</span>
                        </div>
                        <div className="dh-detail-group">
                          <span className="dh-detail-label">Section</span>
                          <span className="dh-detail-val">{assign.section}</span>
                        </div>
                        <div className="dh-detail-group">
                          <span className="dh-detail-label">Instructor</span>
                          <span className="dh-detail-val">{assign.instructor}</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {filteredAssignments.length > 5 && (
                <button
                  type="button"
                  className="dh-viewall-btn"
                  onClick={() => onNavigate('exam-Schedule')}
                >
                  View all {filteredAssignments.length} assignments →
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Scheduler quick plot (non-proctor scheduler) ───────────────── */}
      {isScheduler && !isProctor && (
        <div className="dh-section-card dh-plot-teaser">
          <div className="dh-plot-teaser-inner">
            <div className="dh-plot-teaser-icon"><FaCalendarPlus size={28} /></div>
            <div>
              <h3 className="dh-plot-teaser-title">Plot Exam Schedule</h3>
              <p className="dh-plot-teaser-sub">Assign rooms and proctors for upcoming exams</p>
            </div>
            <button type="button" className="dh-plot-teaser-btn" onClick={() => onNavigate('plot-Schedule')}>
              Open Plotter →
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main DashboardFaculty
// ─────────────────────────────────────────────────────────────────────────────

const DashboardFaculty = () => {
  const [isSidebarOpen, setIsSidebarOpen]     = useState(false);
  const [activeMenu, setActiveMenu]           = useState('dashboard');
  const [currentDateTime, setCurrentDateTime] = useState(new Date());
  const [user, setUser]                       = useState<any>(null);
  const [roles, setRoles]                     = useState<string[]>([]);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isMobile, setIsMobile]               = useState(window.innerWidth <= 1024);
  const [unreadCount, setUnreadCount]         = useState(0);
  const [pendingRequestCount, setPendingRequestCount] = useState(0);
  const [dropdownOpen, setDropdownOpen]       = useState(false);
  const [notifDropdownOpen, setNotifDropdownOpen] = useState(false);
  const [notifications, setNotifications]     = useState<any[]>([]);
  const dropdownRef     = useRef<HTMLDivElement>(null);
  const notifDropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const isAlsoAdmin = roles.includes('admin');

  useEffect(() => {
    const loadUser = async () => {
      const stored = JSON.parse(localStorage.getItem('user') || 'null')
        || JSON.parse(sessionStorage.getItem('user') || 'null');
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
    api.get(`/user-roles/${user.user_id}/roles/`)
      .then(res => setRoles(
        res.data.filter((r: any) => r.status?.toLowerCase() === 'active').map((r: any) => r.role_name.toLowerCase())
      ))
      .catch(console.error);
  }, [user]);

  useEffect(() => {
    if (!user?.user_id) return;
    const fetch = () => api.get(`/notifications/${user.user_id}/`).then(res => {
      setNotifications(res.data);
      setUnreadCount(res.data.filter((n: any) => !n.is_seen).length);
    }).catch(console.error);
    fetch();
    const id = setInterval(fetch, 10000);
    return () => clearInterval(id);
  }, [user]);

  useEffect(() => {
    if (!user?.user_id) return;
    const fetch = () => api.get('/tbl_scheduleapproval/', { params: { status: 'pending', reviewer_id: user.user_id } })
      .then(res => setPendingRequestCount(Array.isArray(res.data) ? res.data.length : 0))
      .catch(console.error);
    fetch();
    const id = setInterval(fetch, 10000);
    return () => clearInterval(id);
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

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (notifDropdownRef.current && !notifDropdownRef.current.contains(e.target as Node)) setNotifDropdownOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const mergedSidebarItems = Array.from(
    new Map(roles.flatMap(role => roleSidebarMap[role] || []).map(item => [item.key, item])).values()
  );

  const handleMenuClick = (key: string) => {
    setActiveMenu(key);
    if (isMobile) setIsSidebarOpen(false);
    setDropdownOpen(false);
    setNotifDropdownOpen(false);
  };

  const handleSidebarHover = (open: boolean) => { if (!isMobile) setIsSidebarOpen(open); };
  const handleLogoutConfirm = () => { localStorage.removeItem('user'); sessionStorage.removeItem('user'); navigate('/'); };

  const formattedDate = currentDateTime.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const formattedTime = currentDateTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  const greeting = currentDateTime.getHours() < 12 ? 'Good morning' : currentDateTime.getHours() < 18 ? 'Good afternoon' : 'Good evening';

  if (!user) return <div className="dash-loading">Loading...</div>;

  const topbarCenter = activeMenu === 'dashboard'
    ? <div className="topbar-welcome">{greeting}, <span className="highlight">{user.first_name}!</span></div>
    : !pagesWithNoTitle.includes(activeMenu)
      ? <div className="topbar-pagetitle">
          {mergedSidebarItems.find(i => i.key === activeMenu)?.label
            ?? activeMenu.charAt(0).toUpperCase() + activeMenu.slice(1).replace(/-/g, ' ')}
        </div>
      : null;

  return (
    <div className="app-container">
      <div className="main-content-wrapper">

        {roles.length > 0 && isMobile && (
          <button type="button" className="menu-toggle-btn" onClick={() => setIsSidebarOpen(o => !o)} aria-label="Toggle menu">
            {isSidebarOpen ? <FaTimes /> : <FaBars />}
          </button>
        )}
        {roles.length > 0 && isMobile && (
          <div className={`sidebar-backdrop ${isSidebarOpen ? 'active' : ''}`} onClick={() => setIsSidebarOpen(false)} />
        )}

        {roles.length > 0 && (
          <aside
            className={`sidebar ${isSidebarOpen ? 'open' : 'closed'}`}
            onMouseEnter={() => handleSidebarHover(true)}
            onMouseLeave={() => handleSidebarHover(false)}
          >
            <div className="sidebar-header">
              <button type="button" className="sidebar-logo-button" onClick={() => handleMenuClick('dashboard')}
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
                    <FaHome {...iconStyle} />
                    {isSidebarOpen && <span>Dashboard</span>}
                  </button>
                </li>
                {mergedSidebarItems.map(({ key, label, icon }) => (
                  <li key={key} className={activeMenu === key ? 'active' : ''}>
                    <button type="button" onClick={() => handleMenuClick(key)}>
                      {key === 'Request'
                        ? <div className="sidebar-icon-wrapper">
                            {icon}
                            {pendingRequestCount > 0 && <span className="notification-badge-icon">{pendingRequestCount}</span>}
                          </div>
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

          {/* Topbar */}
          <div className="floating-topbar">
            {topbarCenter}
            <div className="topbar-right-cluster">
              <div className="topbar-datetime-pill">
                <span className="topbar-date">{formattedDate}</span>
                <span className="topbar-time">{formattedTime}</span>
              </div>
              <div className="topbar-avatar-notification-pill">
                <div className="notif-dropdown-wrapper" ref={notifDropdownRef}>
                  <button type="button" className="topbar-bell-btn"
                    onClick={() => { setNotifDropdownOpen(p => !p); setDropdownOpen(false); }} aria-label="Notifications">
                    <FaBell />
                    {unreadCount > 0 && <span className="topbar-badge">{unreadCount}</span>}
                  </button>
                  {notifDropdownOpen && (
                    <div className="notif-dropdown">
                      <div className="notif-dropdown-header">
                        <span className="notif-dropdown-title">Notifications</span>
                        {unreadCount > 0 && <span className="notif-dropdown-count">{unreadCount} new</span>}
                      </div>
                      <ul className="notif-dropdown-list">
                        {notifications.length === 0 ? (
                          <li className="notif-empty">No notifications</li>
                        ) : notifications.slice(0, 6).map((n: any) => (
                          <li key={n.id ?? n.notification_id}
                            className={`notif-item ${!n.is_seen ? 'notif-unread' : ''}`}
                            onClick={() => handleMenuClick('notification')}>
                            <div className="notif-item-message">{n.message ?? n.content ?? 'New notification'}</div>
                            <div className="notif-item-time">
                              {n.created_at ? new Date(n.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                            </div>
                          </li>
                        ))}
                      </ul>
                      <button type="button" className="notif-dropdown-viewall" onClick={() => handleMenuClick('notification')}>
                        View all notifications
                      </button>
                    </div>
                  )}
                </div>
                <div className="profile-dropdown-wrapper" ref={dropdownRef}>
                  <img src={user.avatar_url} alt="avatar" className="topbar-avatar"
                    onClick={() => { setDropdownOpen(p => !p); setNotifDropdownOpen(false); }} />
                  {dropdownOpen && (
                    <div className="topbar-dropdown">
                      <div className="dropdown-header">
                        <div className="dropdown-name">{user.full_name}</div>
                      </div>
                      <ul className="dropdown-menu-list">
                        <li><button type="button" onClick={() => handleMenuClick('profile')}><FaUser size={13} /> Profile</button></li>
                        {isAlsoAdmin && (
                          <li><button type="button" onClick={() => navigate('/admin-dashboard')}><FaUserShield size={13} /> Switch to Admin</button></li>
                        )}
                        <li className="dropdown-divider" />
                        <li>
                          <button type="button" className="dropdown-signout" onClick={() => { setDropdownOpen(false); setShowLogoutModal(true); }}>
                            <FaSignOutAlt size={13} /> Sign out
                          </button>
                        </li>
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Page content */}
          {activeMenu === 'dashboard'             && <DashboardHome user={user} roles={roles} onNavigate={handleMenuClick} />}
          {activeMenu === 'profile'               && <Profile user={user} />}
          {activeMenu === 'set-Availability'      && <ProctorSetAvailability user={user} />}
          {activeMenu === 'exam-Schedule'         && <ProctorViewExam user={user} />}
          {activeMenu === 'proctor-Attendance'    && <ProctorAttendance user={user} />}
          {activeMenu === 'notification'          && <Notification user={user} />}
          {activeMenu === 'set-Modality'          && <BayanihanModality user={user} />}
          {activeMenu === 'plot-Schedule'         && <SchedulerPlotSchedule user={user} />}
          {activeMenu === 'proctors-Availability' && <SchedulerAvailability user={user} />}
          {activeMenu === 'proctor-Monitoring'    && <ProctorMonitoring user={user} />}
          {activeMenu === 'Request'               && <DeanRequests user={user} />}
          {activeMenu === 'Room-Management'       && <RoomManagement user={user} />}
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