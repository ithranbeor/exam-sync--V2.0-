import { useState, useEffect } from 'react';
import '../styles/miniExamCalendar.css';
import { api } from '../lib/apiClient.ts';
import { FaChevronLeft, FaChevronRight } from 'react-icons/fa';

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

interface MiniExamDateCalendarProps {
  user: {
    user_id: number;
    [key: string]: any;
  } | null;
}

const collegeColors: Record<string, string> = {
  'CSM': '#18a209',
  'CITC': '#000000',
  'COT': '#f3510c',
  'CEA': '#a71919',
  'CSTE': '#088ecc',
  'SHS': '#ffaa00',
};

const MiniExamDateCalendar = ({ user }: MiniExamDateCalendarProps) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [examPeriods, setExamPeriods] = useState<ExamPeriod[]>([]);
  const [termMap, setTermMap] = useState<Record<string, string>>({});

  const currentYear = currentMonth.getFullYear();
  const currentMonthIndex = currentMonth.getMonth();
  const today = new Date();

  useEffect(() => {
    const fetchExamPeriods = async () => {
      try {
        const { data: examData } = await api.get<ExamPeriod[]>('/tbl_examperiod');
        if (examData) setExamPeriods(examData);

        const { data: termData } = await api.get<any[]>('/tbl_term');
        if (termData) {
          const map: Record<string, string> = {};
          termData.forEach((t) => (map[t.term_id] = t.term_name));
          setTermMap(map);
        }
      } catch (err) {
        console.error('Error fetching exam periods:', err);
      }
    };

    fetchExamPeriods();
  }, []);

  const getDaysInMonth = (month: number, year: number) =>
    new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (month: number, year: number) =>
    new Date(year, month, 1).getDay();

  const daysInMonth = getDaysInMonth(currentMonthIndex, currentYear);
  const firstDayIndex = getFirstDayOfMonth(currentMonthIndex, currentYear);

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

  const monthNames = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December',
  ];

  const calendarCells = [];
  
  for (let i = 0; i < firstDayIndex; i++) {
    calendarCells.push(
      <div key={`empty-${i}`} className="mini-calendar-cell empty"></div>
    );
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(currentYear, currentMonthIndex, day);

    const events = examPeriods.filter((ep) => {
      const examDate = new Date(ep.start_date);
      return date.toDateString() === examDate.toDateString();
    });

    let cellClass = 'mini-calendar-cell';
    
    const isToday =
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate();

    if (isToday) cellClass += ' today';

    calendarCells.push(
      <div key={`day-${day}`} className={cellClass}>
        <span className="mini-day-number">{day}</span>
        {events.length > 0 && (
          <div className="mini-event-details">
            {Array.from(new Set(events.map((e) => e.college_id || '')))
              .filter((college) => college)
              .map((college, idx) => (
                <div
                  key={idx}
                  className="mini-college-badge"
                  style={{
                    backgroundColor: collegeColors[college] || '#999',
                    color: 'white',
                    fontSize: '9px',
                    padding: '2px 4px',
                    borderRadius: '3px',
                    marginBottom: '2px',
                  }}
                >
                  {college}
                </div>
              ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mini-exam-calendar">
      <div className="mini-calendar-header">
        <h3>
          {monthNames[currentMonthIndex]} {currentYear}
        </h3>
        <div className="mini-nav-controls">
          <button
            type="button"
            className="mini-nav-btn"
            onClick={goToPreviousMonth}
            aria-label="Previous month"
          >
            <FaChevronLeft size={14} />
          </button>
          <button
            type="button"
            className="mini-nav-btn"
            onClick={goToNextMonth}
            aria-label="Next month"
          >
            <FaChevronRight size={14} />
          </button>
        </div>
      </div>

      <div className="mini-calendar-weekdays">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, idx) => (
          <div key={idx} className="mini-weekday">{day}</div>
        ))}
      </div>

      <div className="mini-calendar-grid">{calendarCells}</div>

      <div className="mini-calendar-legend">
        {Object.entries(collegeColors).map(([college, color]) => (
          <div key={college} className="mini-legend-item">
            <div
              className="mini-legend-color"
              style={{ backgroundColor: color }}
            ></div>
            <span>{college}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MiniExamDateCalendar;