import { useState, useEffect } from 'react';
import '../styles/ProctorViewExam.css';
import { api } from '../lib/apiClient.ts';

interface ProctorSchedule {
  assignment_id: number;
  course_id: string;
  section: string;
  exam_date: string;
  exam_start_time: string;
  exam_end_time: string;
  room_id: string;
  building: string;
  instructor: string;
  status: string;
}

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

const generateCourseColors = (courses: string[]) => {
  const colors = [
    '#79b4f2', '#f27f79', '#79f2b4', '#f2e279', '#b479f2', '#f279d6',
    '#79d6f2', '#d6f279', '#f29979', '#a3f279', '#f279a3', '#79a3f2',
    '#f2c879', '#79f2e2', '#f2a879', '#b4f279', '#f27979', '#79f279',
    '#79f2d6', '#f279f2', '#79f2f2', '#f2b479', '#c879f2', '#79f2a8',
    '#f2d679', '#a879f2', '#79f2c8', '#f279b4', '#f2f279', '#79b4f2'
  ];

  const courseColorMap: Record<string, string> = {};
  courses.forEach((course, idx) => {
    courseColorMap[course] = colors[idx % colors.length];
  });
  return courseColorMap;
};

const ProctorViewExam = () => {
  const [schedules, setSchedules] = useState<ProctorSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'week' | 'day'>('day');
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const storedUser =
      JSON.parse(localStorage.getItem('user') || 'null') ||
      JSON.parse(sessionStorage.getItem('user') || 'null');
    setUser(storedUser);
  }, []);

  useEffect(() => {
    const fetchSchedules = async () => {
      if (!user?.user_id) return;

      try {
        setLoading(true);
        const { data } = await api.get('/tbl_proctorschedule/', {
          params: {
            proctor_id: user.user_id,
            status: 'approved',
          },
        });

        if (data && Array.isArray(data)) {
          setSchedules(data);
        }
      } catch (err) {
        console.error('Error fetching schedules:', err);
        setSchedules([]);
      } finally {
        setLoading(false);
      }
    };

    fetchSchedules();
  }, [user?.user_id]);

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

  const formatTime12Hour = (timeStr: string) => {
    const [hours, minutes] = timeStr.slice(11, 16).split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const getSchedulesForCell = (
    date: Date,
    room: string | null,
    startHour: number,
    startMin: number,
    endHour: number,
    endMin: number
  ): ProctorSchedule[] => {
    const cellDateStr = date.toISOString().split('T')[0];
    return schedules.filter((schedule) => {
      const examStart = new Date(`${schedule.exam_date}T${schedule.exam_start_time.slice(11)}`);
      const examEnd = new Date(`${schedule.exam_date}T${schedule.exam_end_time.slice(11)}`);
      const slotStart = new Date(date);
      const slotEnd = new Date(date);
      slotStart.setHours(startHour, startMin, 0, 0);
      slotEnd.setHours(endHour, endMin, 0, 0);

      return (
        schedule.exam_date === cellDateStr &&
        (!room || schedule.building === room) &&
        examStart < slotEnd &&
        examEnd > slotStart
      );
    });
  };

  const uniqueCourses = Array.from(new Set(schedules.map(s => s.course_id)));
  const courseColorMap = generateCourseColors(uniqueCourses);

  const buildings = Array.from(new Set(schedules.map(s => s.building))).sort();
  const timeSlots = generateTimeSlots();

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
        : `100px repeat(${buildings.length || 1}, 1fr)`,
  };

  const now = new Date();

  return (
    <div className="set-availability-container">
      <div className="availability-sections" style={{ flexDirection: 'column', gap: 25 }}>
        <div className="availability-card" style={{ width: '100%' }}>
          <div
            className="form-group"
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <label style={{ fontSize: '1.1em' }}>{formatDate(currentDate, true)}</label>
            </div>
          </div>

          <div
            className="form-group"
            style={{
              flexDirection: 'row',
              gap: 10,
              justifyContent: 'space-between',
            }}
          >
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
              <button type="button" className="submit-button" onClick={handlePrev}>
                {'<'}
              </button>
              <button type="button" className="submit-button" onClick={handleNext}>
                {'>'}
              </button>
            </div>
          </div>

          {loading ? (
            <p>Loading schedules...</p>
          ) : schedules.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#999' }}>
              No approved proctoring schedules found
            </p>
          ) : (
            <div className="grid-container">
              <div className="grid-header" style={gridCols}>
                <div className="cell time-header">Time</div>
                {viewMode === 'week' ? (
                  (headers as Date[]).map((d, i) => (
                    <div key={i} className="cell day-header">
                      {formatHeaderDate(d)}
                    </div>
                  ))
                ) : (
                  <>
                    <div
                      className="building-group-header"
                      style={{
                        gridColumn: `span ${buildings.length || 1}`,
                      }}
                    >
                      Buildings
                    </div>
                    {buildings.map((b, i) => (
                      <div key={i} className="cell building-header">
                        {b}
                      </div>
                    ))}
                  </>
                )}
              </div>

              <div className="grid-body" style={gridCols}>
                {timeSlots.map((slot, rowIdx) => (
                  <div key={rowIdx} className="row">
                    <div className="cell time-cell">{slot.display}</div>
                    {headers.map((header: string | Date, colIdx) => {
                      const cellDate =
                        viewMode === 'week' ? (header as Date) : currentDate;
                      const cellRoom =
                        viewMode === 'day' ? (header as string) : null;

                      const cellSchedules = getSchedulesForCell(
                        cellDate,
                        cellRoom,
                        slot.startHour,
                        slot.startMinute,
                        slot.endHour,
                        slot.endMinute
                      );

                      const isCurrent =
                        cellDate.toDateString() === now.toDateString() &&
                        now.getHours() === slot.startHour &&
                        now.getMinutes() >= slot.startMinute &&
                        now.getMinutes() < slot.endMinute;

                      return (
                        <div
                          key={colIdx}
                          className={`cell schedule-cell ${
                            cellSchedules.length > 0
                              ? 'occupied-cell'
                              : 'empty-cell'
                          } ${isCurrent ? 'current-time-slot' : ''}`}
                          style={{
                            backgroundColor:
                              cellSchedules.length > 0
                                ? courseColorMap[cellSchedules[0].course_id]
                                : undefined,
                            position: 'relative',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexDirection: 'column',
                            padding: '4px',
                            overflow: 'hidden',
                          }}
                        >
                          {cellSchedules.length > 0 && (
                            <div
                              style={{
                                fontSize: '11px',
                                fontWeight: 'bold',
                                color: 'black',
                                textAlign: 'center',
                                lineHeight: '1.2',
                              }}
                            >
                              <div>{cellSchedules[0].course_id}</div>
                              <div style={{ fontSize: '9px' }}>
                                {cellSchedules[0].room_id}
                              </div>
                              <div style={{ fontSize: '9px' }}>
                                {formatTime12Hour(
                                  cellSchedules[0].exam_start_time
                                )}
                              </div>
                            </div>
                          )}
                        </div>
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