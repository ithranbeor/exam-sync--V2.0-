import _React, { useState, useEffect } from 'react';
import '../styles/ProctorViewExam.css';

interface Exam {
  id: string;
  courseCode: string;
  section: string;
  type: string;
  instructor: string;
  building: string;
  date: string;
  startTime: string;
  endTime: string;
  semester: string;
}

const MOCK_EXAMS: Exam[] = [];

const buildings = ['9-203', '9-204', '9-205', '9-206', '9-207', '9-208', '9-209'];

const semesters = [
  '2023-2024 2nd Semester',
  '2023-2024 1st Semester',
  '2022-2023 2nd Semester',
  '2022-2023 1st Semester',
  '2021-2022 2nd Semester',
  '2021-2022 1st Semester',
];

const generateTimeSlots = () => {
  const slots: {
    display: string;
    startHour: number;
    startMinute: number;
    endHour: number;
    endMinute: number;
  }[] = [];

  for (let hour = 7; hour <= 21; hour++) {
    slots.push({
      display: `${hour.toString().padStart(2, '0')}:00 - ${hour.toString().padStart(2, '0')}:30`,
      startHour: hour,
      startMinute: 0,
      endHour: hour,
      endMinute: 30,
    });
    if (hour < 21) {
      slots.push({
        display: `${hour.toString().padStart(2, '0')}:30 - ${(hour + 1).toString().padStart(2, '0')}:00`,
        startHour: hour,
        startMinute: 30,
        endHour: hour + 1,
        endMinute: 0,
      });
    } else {
      slots.push({
        display: `21:30 - 22:00`,
        startHour: 21,
        startMinute: 30,
        endHour: 22,
        endMinute: 0,
      });
    }
  }
  return slots;
};

const ProctorViewExam = () => {
  const [viewMode, setViewMode] = useState<'week' | 'day'>('day');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [exams, setExams] = useState<Exam[]>([]);
  const [loadingExams, setLoadingExams] = useState(true);
  const [selectedSemester, setSelectedSemester] = useState(semesters[0]);

  useEffect(() => {
    const fetchExams = async () => {
      setLoadingExams(true);
      await new Promise((res) => setTimeout(res, 300));
      const filtered = MOCK_EXAMS.filter((e) => e.semester === selectedSemester);
      setExams(filtered);
      setLoadingExams(false);
    };

    fetchExams();
  }, [currentDate, selectedSemester]);

  const getStartOfWeek = (date: Date) => {
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(date);
    monday.setDate(diff);
    monday.setHours(0, 0, 0, 0);
    return monday;
  };

  const getWeekDays = (start: Date) => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      days.push(date);
    }
    return days;
  };

  const formatDate = (date: Date, withYear = false) => {
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    };
    if (withYear) options.year = 'numeric';
    return date.toLocaleDateString('en-US', options);
  };

  const formatHeaderDate = (date: Date) =>
    date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });

  const getExamsForCell = (
    date: Date,
    room: string | null,
    startHour: number,
    startMin: number,
    endHour: number,
    endMin: number
  ): Exam[] => {
    const cellDateStr = date.toISOString().split('T')[0];
    return exams.filter((exam) => {
      const examStart = new Date(`${exam.date}T${exam.startTime}`);
      const examEnd = new Date(`${exam.date}T${exam.endTime}`);
      const slotStart = new Date(date);
      const slotEnd = new Date(date);
      slotStart.setHours(startHour, startMin, 0, 0);
      slotEnd.setHours(endHour, endMin, 0, 0);
      return (
        exam.date === cellDateStr &&
        (!room || exam.building === room) &&
        examStart < slotEnd &&
        examEnd > slotStart
      );
    });
  };

  const handlePrev = () => {
    const updated = new Date(currentDate);
    updated.setDate(currentDate.getDate() - (viewMode === 'week' ? 7 : 1));
    setCurrentDate(updated);
  };

  const handleNext = () => {
    const updated = new Date(currentDate);
    updated.setDate(currentDate.getDate() + (viewMode === 'week' ? 7 : 1));
    setCurrentDate(updated);
  };

  const headers = viewMode === 'week' ? getWeekDays(getStartOfWeek(currentDate)) : buildings;
  const gridCols = {
    gridTemplateColumns:
      viewMode === 'week'
        ? `100px repeat(7, 1fr)`
        : `100px repeat(${buildings.length}, 1fr)`,
  };

  const now = new Date();

  return (
    <div className="set-availability-container">
      <div className="availability-sections" style={{ flexDirection: 'column', gap: 25 }}>
        <div className="availability-card" style={{ width: '100%' }}>
          <div className="form-group" style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <label style={{ fontSize: '1.1em' }}>{formatDate(currentDate, true)}</label>
            </div>
            <div>
              <select
                className="custom-select"
                value={selectedSemester}
                onChange={(e) => setSelectedSemester(e.target.value)}
              >
                {semesters.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group" style={{ flexDirection: 'row', gap: 10, justifyContent: 'space-between' }}>
            <div className="view-mode-controls">
              <button
                type="button"
                className={`submit-button ${viewMode === 'week' ? '' : 'inactive'}`}
                onClick={() => setViewMode('week')}
              >
                Week View
              </button>
              <button
                type="button"
                className={`submit-button ${viewMode === 'day' ? '' : 'inactive'}`}
                onClick={() => setViewMode('day')}
              >
                Day View
              </button>
            </div>
            <div>
              <button type="button" className="submit-button" onClick={handlePrev}>{'<'}</button>
              <button type="button" className="submit-button" onClick={handleNext}>{'>'}</button>
            </div>
          </div>

          {loadingExams ? (
            <p>Loading exams...</p>
          ) : (
            <div className="grid-container">
              <div className="grid-header" style={gridCols}>
                <div className="cell time-header">Time</div>
                {viewMode === 'week' ? (
                  (headers as Date[]).map((d, i) => (
                    <div key={i} className="cell day-header">{formatHeaderDate(d)}</div>
                  ))
                ) : (
                  <>
                    <div className="building-group-header" style={{ gridColumn: `span ${buildings.length}` }}>
                      ICT - BUILDING (BLDG 9)
                    </div>
                    {buildings.map((b, i) => (
                      <div key={i} className="cell building-header">{b}</div>
                    ))}
                  </>
                )}
              </div>

              <div className="grid-body" style={gridCols}>
                {generateTimeSlots().map((slot, rowIdx) => (
                  <div key={rowIdx} className="row">
                    <div className="cell time-cell">{slot.display}</div>
                    {headers.map((header: string | Date, colIdx) => {
                      const cellDate = viewMode === 'week' ? (header as Date) : currentDate;
                      const cellRoom = viewMode === 'day' ? (header as string) : null;

                      const isCurrent = (
                        cellDate.toDateString() === now.toDateString() &&
                        now.getHours() === slot.startHour &&
                        now.getMinutes() >= slot.startMinute &&
                        now.getMinutes() < slot.endMinute
                      );

                      const hasExam = getExamsForCell(cellDate, cellRoom, slot.startHour, slot.startMinute, slot.endHour, slot.endMinute).length > 0;

                      return (
                        <div key={colIdx} className={`cell schedule-cell ${hasExam ? 'occupied-cell' : 'empty-cell'} ${isCurrent ? 'current-time-slot' : ''}`} />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProctorViewExam;
