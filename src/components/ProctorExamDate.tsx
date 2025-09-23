import { useState, useEffect } from 'react';
import '../styles/proctorExamDate.css';
import React from 'react';
import { supabase } from '../lib/supabaseClient.ts';
import { FaChevronLeft, FaChevronRight } from 'react-icons/fa';

type ExamPeriod = {
  examperiod_id: number;
  start_date: string;
  end_date: string;
  college_id: string | null;        // <-- allow null
  department_id: string | null;     // <-- allow null
  academic_year: string;
  exam_category: string;
  term_id: number;
};


type Term = {
  term_id: number;
  term_name: string;
};

const ProctorExamDate = () => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [examPeriods, setExamPeriods] = useState<ExamPeriod[]>([]);
  const [termMap, setTermMap] = useState<Record<string, string>>({});

  const [filters, setFilters] = useState({
    academicYear: '',
    examCategory: '',
    collegeId: '',
    termId: '',
  });

  const today = new Date();
  const currentYear = currentMonth.getFullYear();
  const currentMonthIndex = currentMonth.getMonth();

  useEffect(() => {
    const fetchExamPeriods = async () => {
      const { data, error } = await supabase
        .from('tbl_examperiod')
        .select('*');
      if (!error) setExamPeriods(data);

      const { data: terms, error: termError } = await supabase
        .from('tbl_term')
        .select('*');
      if (!termError) {
        const map: Record<string, string> = {};
        terms.forEach((t: Term) => (map[t.term_id] = t.term_name));
        setTermMap(map);
      }
    };

    // initial fetch
    fetchExamPeriods();

    // set up polling every 2s
    const intervalId = setInterval(fetchExamPeriods, 2000);

    // cleanup
    return () => clearInterval(intervalId);
  }, []);

  const isBetween = (target: Date, start: Date, end: Date) => {
    const t = new Date(target.getFullYear(), target.getMonth(), target.getDate());
    const s = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const e = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    return t >= s && t <= e;
  };

  const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newMonth = parseInt(e.target.value);
    const updatedDate = new Date(currentMonth);
    updatedDate.setMonth(newMonth);
    setCurrentMonth(updatedDate);
  };

  const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newYear = parseInt(e.target.value);
    const updatedDate = new Date(currentMonth);
    updatedDate.setFullYear(newYear);
    setCurrentMonth(updatedDate);
  };

  const goToPreviousMonth = () => {
    const newMonth = new Date(currentMonth);
    newMonth.setMonth(newMonth.getMonth() - 1);
    setCurrentMonth(newMonth);
  };

  const goToNextMonth = () => {
    const newMonth = new Date(currentMonth);
    newMonth.setMonth(newMonth.getMonth() + 1);
    setCurrentMonth(newMonth);
  };

  const goToToday = () => {
    setCurrentMonth(new Date());
  };

  const getDaysInMonth = (month: number, year: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (month: number, year: number) => new Date(year, month, 1).getDay();

  const daysInMonth = getDaysInMonth(currentMonthIndex, currentYear);
  const firstDayIndex = getFirstDayOfMonth(currentMonthIndex, currentYear);

  const calendarCells = [];
  for (let i = 0; i < firstDayIndex; i++) {
    calendarCells.push(<div key={`empty-${i}`} className="calendar-cell empty"></div>);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(currentYear, currentMonthIndex, day);

    const events = examPeriods.filter(ep => {
      if (filters.academicYear && ep.academic_year !== filters.academicYear) return false;
      if (filters.examCategory && ep.exam_category !== filters.examCategory) return false;
      if (filters.collegeId && ep.college_id !== filters.collegeId) return false;
      if (filters.termId && String(ep.term_id) !== filters.termId) return false;

      const start = new Date(ep.start_date);
      const end = new Date(ep.end_date);
      return isBetween(date, start, end);
    });

    let cellClass = 'calendar-cell';
    const isToday =
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate();

    if (isToday) {
      cellClass += ' today';
    }

    let content = null;

    if (events.length > 0) {
      const uniqueColleges = Array.from(new Set(events.map(e => e.college_id || '')));

      content = (
        <div className="event-details">
          {uniqueColleges
            .filter(college => college) // skip null/empty
            .map((college, idx) => (
              <div key={idx} className={`college-badge ${college.toLowerCase()}`}>
                {college}
              </div>
            ))}
          <div className="semester">{termMap[String(events[0].term_id)] || 'Unknown Term'}</div>
          <div className="semester">{events[0].academic_year}</div>
          <div className="exam">{events[0].exam_category}</div>
        </div>
      );
    }

    calendarCells.push(
      <div key={`day-${day}`} className={cellClass}>
        <span className="day-number">{day}</span>
        {content}
      </div>
    );
  }

  const colleges = ['CSM', 'CITC', 'COT', 'CEA', 'CSTE', 'SHS'];
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const yearOptions = [];
  for (let y = 2020; y <= 2030; y++) yearOptions.push(y);

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div className="left-date-label">
          <h2>{monthNames[currentMonthIndex]} {currentYear}</h2>
        </div>
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
          <select className="dropdown" value={filters.examCategory} onChange={(e) => setFilters({ ...filters, examCategory: e.target.value })}>
            <option value="">All Categories</option>
            <option value="Preliminary">Preliminary</option>
            <option value="Midterm">Midterm</option>
            <option value="Prefinal">Prefinal</option>
            <option value="Final">Final</option>
          </select>
          <select className="dropdown" value={filters.collegeId} onChange={(e) => setFilters({ ...filters, collegeId: e.target.value })}>
            <option value="">All Colleges</option>
            {colleges.map((col) => (
              <option key={col} value={col}>{col}</option>
            ))}
          </select>
          <button type="button" className="now-button" onClick={goToToday}>Now</button>
        </div>
      </div>

      <div className="calendar-weekdays">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, idx) => (
          <div key={idx} className="weekday">{day}</div>
        ))}
      </div>

      <div className="calendar-grid">
        {calendarCells}
      </div>

      <div className="bottom-navigation">
        <button type="button" className="nav-arrow" onClick={goToPreviousMonth}><FaChevronLeft /></button>
        <button type="button" className="nav-arrow" onClick={goToNextMonth}><FaChevronRight /></button>
      </div>

      <div className="legend">
        {colleges.map((college, index) => (
          <div key={index} className={`legend-item ${college.toLowerCase()}`}>
            <div className="legend-colored-box-with-text">
              {college}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProctorExamDate;
