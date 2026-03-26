import { useState, useEffect } from 'react';
import '../styles/F_ExamDateViewer.css';
import React from 'react';
import { api } from '../lib/apiClient.ts';
import { FaChevronLeft, FaChevronRight, FaCalendarAlt } from 'react-icons/fa';

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

type Term = {
  term_id: number;
  term_name: string;
};

const ProctorExamDate = () => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [examPeriods, setExamPeriods]   = useState<ExamPeriod[]>([]);
  const [termMap, setTermMap]           = useState<Record<string, string>>({});
  const [isScheduler, setIsScheduler]   = useState(false);
  const [schedulerCollege, setSchedulerCollege] = useState<string | null>(null);
  const [isEditMode, _setIsEditMode]    = useState(false);

  const [filters, setFilters] = useState({
    academicYear: '',
    examCategory: '',
    collegeName: '',
    termId: '',
  });

  const today            = new Date();
  const currentYear      = currentMonth.getFullYear();
  const currentMonthIndex = currentMonth.getMonth();

  // ── Role / college fetch ────────────────────────────────────────────────
  useEffect(() => {
    const fetchUserRoleAndCollege = async () => {
      try {
        const storedUser = JSON.parse(
          localStorage.getItem('user') || sessionStorage.getItem('user') || '{}'
        );
        if (!storedUser?.user_id) return;

        const realUserId = storedUser.user_id;
        const { data: roles } = await api.get(`/tbl_user_role`, { params: { user_id: realUserId } });

        const schedulerRole = roles.find((r: any) => r.role === 3 || r.role_id === 3);
        if (!schedulerRole) return;

        setIsScheduler(true);

        let college = schedulerRole.college ?? schedulerRole.college_id ?? null;
        if (!college) {
          const { data: userData } = await api.get(`/tbl_users/${realUserId}`);
          college = userData?.college_id ?? null;
        }
        if (college) setSchedulerCollege(college);
      } catch (err) {
        console.error('Error fetching role/college:', err);
      }
    };
    fetchUserRoleAndCollege();
  }, []);

  // ── Exam periods fetch ──────────────────────────────────────────────────
  useEffect(() => {
    const fetchExamPeriods = async () => {
      try {
        const { data: examData } = await api.get<ExamPeriod[]>('/tbl_examperiod');
        if (examData) setExamPeriods(examData);

        const { data: termData } = await api.get<Term[]>('/tbl_term');
        if (termData) {
          const map: Record<string, string> = {};
          termData.forEach((t) => (map[t.term_id] = t.term_name));
          setTermMap(map);
        }
      } catch (err) {
        console.error('Error fetching exam periods or terms:', err);
      }
    };

    fetchExamPeriods();
    const intervalId = setInterval(fetchExamPeriods, 2000);
    return () => clearInterval(intervalId);
  }, []);

  // ── Click handler ───────────────────────────────────────────────────────
  const handleDayClick = async (date: Date) => {
    if (!isScheduler || !isEditMode) return;

    try {
      const formatDate = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

      const existingPeriods = examPeriods.filter(
        (ep) => new Date(ep.start_date).toDateString() === date.toDateString()
      );

      const uniqueCollegeIds = Array.from(
        new Set(existingPeriods.map((ep) => ep.college_id).filter((c) => c != null))
      );

      const isMyCollegeAssigned = uniqueCollegeIds.includes(schedulerCollege!);

      if (isMyCollegeAssigned) {
        await api.put('/tbl_examperiod/bulk_update/', {
          updates: [{ start_date: formatDate(date), college_name: null, college_to_remove: schedulerCollege }],
        });
      } else {
        if (uniqueCollegeIds.length >= 2) { alert('Cannot assign more than 2 colleges on the same day.'); return; }
        await api.put('/tbl_examperiod/bulk_update/', {
          updates: [{ start_date: formatDate(date), college_name: schedulerCollege }],
        });
      }

      const { data: refreshed } = await api.get('/tbl_examperiod');
      if (refreshed) setExamPeriods(refreshed);
    } catch (err) {
      console.error('Error updating exam period:', err);
      alert('An error occurred. Check console for details.');
    }
  };

  // ── Navigation ──────────────────────────────────────────────────────────
  const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const d = new Date(currentMonth);
    d.setMonth(parseInt(e.target.value));
    setCurrentMonth(d);
  };

  const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const d = new Date(currentMonth);
    d.setFullYear(parseInt(e.target.value));
    setCurrentMonth(d);
  };

  const goToPreviousMonth = () => {
    const d = new Date(currentMonth);
    d.setMonth(d.getMonth() - 1);
    setCurrentMonth(d);
  };

  const goToNextMonth = () => {
    const d = new Date(currentMonth);
    d.setMonth(d.getMonth() + 1);
    setCurrentMonth(d);
  };

  const goToToday = () => setCurrentMonth(new Date());

  // ── Calendar helpers ────────────────────────────────────────────────────
  const getDaysInMonth   = (m: number, y: number) => new Date(y, m + 1, 0).getDate();
  const getFirstDayOfMonth = (m: number, y: number) => new Date(y, m, 1).getDay();

  const daysInMonth  = getDaysInMonth(currentMonthIndex, currentYear);
  const firstDayIndex = getFirstDayOfMonth(currentMonthIndex, currentYear);

  const calendarCells: React.ReactNode[] = [];

  for (let i = 0; i < firstDayIndex; i++) {
    calendarCells.push(<div key={`empty-${i}`} className="calendar-cell empty" />);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(currentYear, currentMonthIndex, day);

    const events = examPeriods.filter((ep) => {
      if (filters.academicYear && ep.academic_year !== filters.academicYear) return false;
      if (filters.examCategory && ep.exam_category !== filters.examCategory) return false;
      if (filters.collegeName  && ep.college_name  !== filters.collegeName)  return false;
      if (filters.termId       && String(ep.term_id) !== filters.termId)     return false;
      return date.toDateString() === new Date(ep.start_date).toDateString();
    });

    const isToday =
      date.getFullYear() === today.getFullYear() &&
      date.getMonth()    === today.getMonth() &&
      date.getDate()     === today.getDate();

    const classList = [
      'calendar-cell',
      isToday                             ? 'today'    : '',
      isEditMode && isScheduler           ? 'editable' : '',
    ].filter(Boolean).join(' ');

    calendarCells.push(
      <div
        key={`day-${day}`}
        className={classList}
        onClick={() => handleDayClick(date)}
        style={{ cursor: isEditMode && isScheduler ? 'pointer' : 'default' }}
      >
        <span className="day-number">{day}</span>

        {events.length > 0 && (
          <div className="event-details">
            {Array.from(new Set(events.map((e) => e.college_id || '')))
              .filter(Boolean)
              .map((college, idx) => (
                <div key={idx} className={`college-badge ${college.toLowerCase()}`}>
                  {college}
                </div>
              ))}
            <div className="semester">{termMap[String(events[0].term_id)] || 'Unknown Term'}</div>
            <div className="semester">{events[0].academic_year}</div>
            <div className="exam">{events[0].exam_category}</div>
          </div>
        )}
      </div>
    );
  }

  // ── Static data ──────────────────────────────────────────────────────────
  const colleges   = ['CSM', 'CITC', 'COT', 'CEA', 'CSTE', 'SHS'];
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const yearOptions: number[] = [];
  for (let y = 2020; y <= 2030; y++) yearOptions.push(y);

  // Count how many distinct exam days are in the current month
  const examDaysThisMonth = new Set(
    examPeriods
      .filter((ep) => {
        const d = new Date(ep.start_date);
        return d.getFullYear() === currentYear && d.getMonth() === currentMonthIndex;
      })
      .map((ep) => new Date(ep.start_date).getDate())
  ).size;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="dashboard">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="dashboard-header">

        <div className="dashboard-header-top">
          {/* Left: icon + title */}
          <div className="exam-header-left">
            <div className="exam-icon-wrap">
              <FaCalendarAlt />
            </div>
            <div className="exam-title-block">
              <h2>{monthNames[currentMonthIndex]} {currentYear}</h2>
              <p>
                {examDaysThisMonth > 0
                  ? `${examDaysThisMonth} exam day${examDaysThisMonth !== 1 ? 's' : ''} this month`
                  : 'No exams scheduled this month'}
              </p>
            </div>
          </div>

          {/* Right: prev / next arrows */}
          <div className="top-navigation">
            <button type="button" className="nav-arrow" onClick={goToPreviousMonth} aria-label="Previous month">
              <FaChevronLeft />
            </button>
            <button type="button" className="nav-arrow" onClick={goToNextMonth} aria-label="Next month">
              <FaChevronRight />
            </button>
          </div>
        </div>

        {/* Filter toolbar */}
        <div className="filters">
          <select className="dropdown" value={currentMonthIndex} onChange={handleMonthChange}>
            {monthNames.map((m, idx) => (
              <option key={idx} value={idx}>{m}</option>
            ))}
          </select>

          <select className="dropdown" value={currentYear} onChange={handleYearChange}>
            {yearOptions.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

          <select
            className="dropdown"
            value={filters.termId}
            onChange={(e) => setFilters({ ...filters, termId: e.target.value })}
          >
            <option value="">All Semesters</option>
            {Object.entries(termMap).map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>

          <select
            className="dropdown"
            value={filters.examCategory}
            onChange={(e) => setFilters({ ...filters, examCategory: e.target.value })}
          >
            <option value="">All Categories</option>
            <option value="Preliminary">Preliminary</option>
            <option value="Midterm">Midterm</option>
            <option value="Prefinal">Prefinal</option>
            <option value="Final">Final</option>
          </select>

          {isScheduler ? (
            <span className="scheduler-college-label">{schedulerCollege ?? ''}</span>
          ) : (
            <select
              className="dropdown"
              value={filters.collegeName}
              onChange={(e) => setFilters({ ...filters, collegeName: e.target.value })}
            >
              <option value="">All Colleges</option>
              {colleges.map((col) => (
                <option key={col} value={col}>{col}</option>
              ))}
            </select>
          )}

          <button type="button" className="now-button" onClick={goToToday}>
            Now
          </button>
        </div>
      </div>

      {/* ── Calendar shell ─────────────────────────────────────────────── */}
      <div className="calendar-shell">
        {/* Weekday header */}
        <div className="calendar-weekdays">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, idx) => (
            <div key={idx} className="weekday">{day}</div>
          ))}
        </div>

        {/* Day grid */}
        <div className="calendar-grid">
          {calendarCells}
        </div>
      </div>

      {/* ── Legend ─────────────────────────────────────────────────────── */}
      <div className="legend">
        {colleges.map((college, index) => (
          <div key={index} className={`legend-item ${college.toLowerCase()}`}>
            <div className="legend-colored-box-with-text">{college}</div>
          </div>
        ))}
      </div>

    </div>
  );
};

export default ProctorExamDate;