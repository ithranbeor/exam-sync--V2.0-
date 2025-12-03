import React, { useState } from 'react';
import '../styles/DeanScheduleViewer.css';
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
  const generateCourseColors = (courses: string[]) => {
    const colors = [
      "#79b4f2", "#f27f79", "#79f2b4", "#f2e279", "#b479f2", "#f279d6",
      "#79d6f2", "#d6f279", "#f29979", "#a3f279", "#f279a3", "#79a3f2",
      "#f2c879", "#79f2e2", "#f2a879", "#b4f279", "#f27979", "#79f279",
      "#79f2d6", "#f279f2", "#79f2f2", "#f2b479", "#c879f2", "#79f2a8",
      "#f2d679", "#a879f2", "#79f2c8", "#f279b4", "#f2f279", "#79b4f2"
    ];

    const courseColorMap: Record<string, string> = {};
    courses.forEach((course, idx) => {
      courseColorMap[course] = colors[idx % colors.length];
    });
    return courseColorMap;
  };

  const uniqueCourses = Array.from(new Set(scheduleData.schedules.map(s => s.course_id)));
  const courseColorMap = generateCourseColors(uniqueCourses);

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
                        color: "black",
                        padding: "4px",
                        borderRadius: "4px",
                        fontSize: "12px",
                      }}
                    >
                      <p><strong>{exam.course_id}</strong></p>
                      {/* ✅ Adjust font size if section_name is long */}
                      <p style={{ 
                        fontSize: sectionDisplay && sectionDisplay.length > 30 ? '10px' : '12px',
                        lineHeight: '1.2'
                      }}>
                        {sectionDisplay}
                      </p>
                      {/* ✅ Adjust font size if instructor is long */}
                      <p style={{ 
                        fontSize: exam.instructor && exam.instructor.length > 30 ? '10px' : '12px',
                        lineHeight: '1.2'
                      }}>
                        Instructor: {exam.instructor}
                      </p>
                      {/* ✅ Adjust font size if proctor is long */}
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
            <FaChevronLeft/>
          </button>
          <span>Page {currentPage + 1} of {totalPages}</span>
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={currentPage >= totalPages - 1}
            className="dean-page-btn"
          >
            <FaChevronRight/>
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