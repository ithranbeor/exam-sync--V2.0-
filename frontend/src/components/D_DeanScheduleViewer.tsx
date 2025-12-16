import React, { useState } from 'react';
import '../styles/D_DeanScheduleViewer.css';
import { FaChevronLeft, FaChevronRight } from "react-icons/fa";

interface Schedule {
  course_id: string;
  section_name: string;
  exam_date: string;
  exam_start_time: string;
  exam_end_time: string;
  room_id: string;
  building_name: string;
  instructor: string;
  proctor: string;
}

interface ScheduleData {
  college_name: string;
  exam_period: string;
  term: string;
  semester: string;
  academic_year: string;
  building: string;
  total_schedules: number;
  schedules: Schedule[];
}

interface DeanScheduleViewerProps {
  scheduleData: ScheduleData;
}

const DeanScheduleViewer: React.FC<DeanScheduleViewerProps> = ({ scheduleData }) => {
  const [currentPage, setCurrentPage] = useState(0);
  const maxRoomColumns = 5;

  // Generate time slots
  const rawTimes = [
    "07:00", "07:30", "08:00", "08:30", "09:00", "09:30", "10:00", "10:30",
    "11:00", "11:30", "12:00", "12:30", "13:00", "13:30", "14:00", "14:30",
    "15:00", "15:30", "16:00", "16:30", "17:00", "17:30", "18:00", "18:30",
    "19:00", "19:30", "20:00", "20:30", "21:00"
  ];

  const formatTo12Hour = (time: string) => {
    const [hourStr, minute] = time.split(":");
    let hour = Number(hourStr);
    const ampm = hour >= 12 ? "PM" : "AM";
    hour = hour % 12 || 12;
    return `${hour}:${minute} ${ampm}`;
  };

  const timeSlots = rawTimes.slice(0, -1).map((t, i) => ({
    start24: t,
    end24: rawTimes[i + 1],
    label: `${formatTo12Hour(t)} - ${formatTo12Hour(rawTimes[i + 1])}`,
  }));

  // Generate course colors
  const generateCourseColors = (schedules: Schedule[]) => {
    const yearColors = {
      1: [
        '#DC2626', '#D97706', '#059669', '#0891B2', '#2563EB',
        '#7C3AED', '#DB2777', '#EA580C', '#0D9488', '#65A30D'],
      2: [
        '#991B1B', '#92400E', '#065F46', '#0E7490', '#1E40AF',
        '#5B21B6', '#9D174D', '#C2410C', '#115E59', '#3F6212'],
      3: [
        '#7F1D1D', '#78350F', '#064E3B', '#155E75', '#1E3A8A',
        '#4C1D95', '#831843', '#9A3412', '#134E4A', '#365314'],
      4: [
        '#450A0A', '#451A03', '#022C22', '#083344', '#172554',
        '#2E1065', '#500724', '#7C2D12', '#042F2E', '#1A2E05']
    };

    const courseColorMap: Record<string, string> = {};
    const programYearMap: Record<string, number> = {};

    schedules.forEach((schedule) => {
      if (!schedule.course_id) return;
      if (courseColorMap[schedule.course_id]) return;

      let yearLevel: number | null = null;
      let program = '';

      // Extract from section_name
      if (schedule.section_name) {
        const sectionStr = String(schedule.section_name).trim();
        let match = sectionStr.match(/^([A-Za-z]+)(\d)([A-Za-z]*)$/);
        if (!match) match = sectionStr.match(/^([A-Za-z]+)\s+(\d)([A-Za-z]*)$/);
        if (!match) match = sectionStr.match(/^([A-Za-z]+)-(\d)([A-Za-z]*)$/);

        if (!match) {
          const digitMatch = sectionStr.match(/(\d)/);
          const letterMatch = sectionStr.match(/^([A-Za-z]+)/);
          if (digitMatch && letterMatch) {
            program = letterMatch[1];
            yearLevel = parseInt(digitMatch[1]);
          }
        } else {
          program = match[1];
          yearLevel = parseInt(match[2]);
        }
      }

      // Assign color based on year level
      if (yearLevel && yearLevel >= 1 && yearLevel <= 4) {
        const programYearKey = `${program}-${yearLevel}`;
        const availableColors = yearColors[yearLevel as keyof typeof yearColors];

        if (!programYearMap[programYearKey]) {
          programYearMap[programYearKey] = 0;
        }

        const colorIndex = programYearMap[programYearKey] % availableColors.length;
        courseColorMap[schedule.course_id] = availableColors[colorIndex];
        programYearMap[programYearKey]++;
      } else {
        courseColorMap[schedule.course_id] = '#9CA3AF'; // Gray for unmatched
      }
    });

    return courseColorMap;
  };

  const courseColorMap = generateCourseColors(scheduleData.schedules);

  // Group schedules by date
  const uniqueDates = Array.from(
    new Set(scheduleData.schedules.map(s => s.exam_date))
  ).sort();

  // Get unique rooms for pagination
  const allRooms = Array.from(
    new Set(scheduleData.schedules.map(s => s.room_id))
  ).sort((a, b) => {
    const numA = Number(a);
    const numB = Number(b);
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    return a.localeCompare(b, undefined, { numeric: true });
  });

  const totalPages = Math.max(1, Math.ceil(allRooms.length / maxRoomColumns));
  const pageRooms = allRooms.slice(
    currentPage * maxRoomColumns,
    (currentPage + 1) * maxRoomColumns
  );

  const renderScheduleGrid = (date: string) => {
    const dateSchedules = scheduleData.schedules.filter(s => s.exam_date === date);
    const occupiedCells: Record<string, boolean> = {};

    // Group by room
    const groupedData: Record<string, Schedule[]> = {};
    dateSchedules.forEach((schedule) => {
      const key = `${date}-${schedule.room_id}`;
      if (!groupedData[key]) groupedData[key] = [];
      groupedData[key].push(schedule);
    });

    // Group rooms by building
    const buildingGroups: Record<string, string[]> = {};
    pageRooms.forEach((room) => {
      // Search in all schedules, not just dateSchedules
      const building = scheduleData.schedules.find(s => s.room_id === room)?.building_name || scheduleData.building;
      if (!buildingGroups[building]) buildingGroups[building] = [];
      buildingGroups[building].push(room);
    });

    // Check if we have multiple buildings
    const buildingCount = Object.keys(buildingGroups).length;

    return (
      <table className="dean-exam-table">
        <thead>
          <tr>
            <th colSpan={pageRooms.length + 1}>
              {new Date(date).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric"
              })}
            </th>
          </tr>
          {buildingCount > 1 ? (
            <tr>
              <th></th>
              {Object.entries(buildingGroups).map(([building, rooms]) => (
                <th key={building} colSpan={rooms.length}>{building}</th>
              ))}
            </tr>
          ) : (
            <tr>
              <th colSpan={pageRooms.length + 1}>
                {Object.keys(buildingGroups)[0]}
              </th>
            </tr>
          )}
          <tr>
            <th>Time</th>
            {pageRooms.map((room) => (
              <th key={room}>{room}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {timeSlots.map((slot, rowIndex) => (
            <tr key={slot.start24}>
              <td>{slot.label}</td>
              {pageRooms.map((room) => {
                const key = `${date}-${room}-${rowIndex}`;
                if (occupiedCells[key]) return null;

                const examsInRoom = groupedData[`${date}-${room}`] || [];

                const exam = examsInRoom.find((e) => {
                  const examStartTimeStr = e.exam_start_time.slice(11, 16);
                  const examEndTimeStr = e.exam_end_time.slice(11, 16);

                  const [examStartHour, examStartMin] = examStartTimeStr.split(':').map(Number);
                  const [examEndHour, examEndMin] = examEndTimeStr.split(':').map(Number);

                  const examStart = examStartHour * 60 + examStartMin;
                  const examEnd = examEndHour * 60 + examEndMin;

                  const slotStart = Number(slot.start24.split(":")[0]) * 60 + Number(slot.start24.split(":")[1]);
                  const slotEnd = Number(slot.end24.split(":")[0]) * 60 + Number(slot.end24.split(":")[1]);

                  return (examStart < slotEnd) && (examEnd > slotStart);
                });

                if (!exam) return <td key={room}></td>;
                const sectionDisplay = exam.section_name;

                const examStartTimeStr = exam.exam_start_time.slice(11, 16);
                const examEndTimeStr = exam.exam_end_time.slice(11, 16);

                const [examStartHour, examStartMin] = examStartTimeStr.split(':').map(Number);
                const [examEndHour, examEndMin] = examEndTimeStr.split(':').map(Number);

                const startMinutes = examStartHour * 60 + examStartMin;
                const endMinutes = examEndHour * 60 + examEndMin;

                const rowSpan = Math.ceil((endMinutes - startMinutes) / 30);

                for (let i = 0; i < rowSpan; i++) {
                  const startSlotIndex = timeSlots.findIndex(s => {
                    const slotStart = Number(s.start24.split(":")[0]) * 60 + Number(s.start24.split(":")[1]);
                    const slotEnd = Number(s.end24.split(":")[0]) * 60 + Number(s.end24.split(":")[1]);
                    return startMinutes >= slotStart && startMinutes < slotEnd;
                  });

                  if (startSlotIndex + i < timeSlots.length) {
                    occupiedCells[`${date}-${room}-${startSlotIndex + i}`] = true;
                  }
                }

                return (
                  <td key={room} rowSpan={rowSpan}>
                    <div
                      className="dean-schedule-cell"
                      style={{
                        backgroundColor: courseColorMap[exam.course_id] || "#ccc",
                        color: "white",
                        padding: "4px",
                        borderRadius: "4px",
                        fontSize: "12px",
                      }}
                    >
                      <p><strong>{exam.course_id}</strong></p>
                      <p style={{
                        fontSize: sectionDisplay && sectionDisplay.length > 30 ? '10px' : '12px',
                        lineHeight: '1.2'
                      }}>
                        {sectionDisplay}
                      </p>
                      <p style={{
                        fontSize: exam.instructor && exam.instructor.length > 30 ? '10px' : '12px',
                        lineHeight: '1.2'
                      }}>
                        Instructor: {exam.instructor}
                      </p>
                      <p style={{
                        fontSize: exam.proctor && exam.proctor.length > 30 ? '10px' : '12px',
                        lineHeight: '1.2'
                      }}>
                        Proctor: {exam.proctor}
                      </p>
                      <p>{formatTo12Hour(examStartTimeStr)} - {formatTo12Hour(examEndTimeStr)}</p>
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  return (
    <div className="dean-schedule-viewer">
      <div className="dean-schedule-header">
        <img
          src="/logo/USTPlogo.png"
          alt="School Logo"
          className="dean-schedule-logo"
        />
        <div className="dean-schedule-title">
          University of Science and Technology of Southern Philippines
        </div>
        <div className="dean-schedule-subtitle">
          Alubijid | Balubal | Cagayan de Oro City | Claveria | Jasaan | Oroquieta | Panaon | Villanueva
        </div>
        <div className="dean-schedule-college">{scheduleData.college_name}</div>
        <div className="dean-schedule-info">
          <strong>{scheduleData.term} Examination Schedule</strong> | {scheduleData.semester} Semester | A.Y. {scheduleData.academic_year}
        </div>
        <div className="dean-schedule-period">{scheduleData.exam_period}</div>
      </div>

      <hr />

      {totalPages > 1 && (
        <div className="dean-schedule-pagination">
          <button
            onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
            disabled={currentPage === 0}
            className="dean-page-btn"
          >
            <FaChevronLeft />
          </button>
          <span>Page {currentPage + 1} of {totalPages}</span>
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={currentPage >= totalPages - 1}
            className="dean-page-btn"
          >
            <FaChevronRight />
          </button>
        </div>
      )}

      <div className="dean-schedule-container">
        {uniqueDates.map(date => (
          <div key={date} className="dean-schedule-date-section">
            {renderScheduleGrid(date)}
          </div>
        ))}
      </div>
    </div>
  );
};

export default DeanScheduleViewer;