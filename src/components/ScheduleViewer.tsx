/// <reference types="react" />
import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient.ts";
import "../styles/SchedulerView.css";
import { FaChevronLeft , FaChevronRight  } from "react-icons/fa";

interface ExamDetail {
  examdetails_id?: number;
  course_id: string;
  section_name?: string;
  room_id?: string;
  exam_date?: string;
  exam_start_time?: string;
  exam_end_time?: string;
  instructor_id?: number;
  proctor_id?: number;
  proctor_timein?: string;
  proctor_timeout?: string;
  program_id?: string;
  college_name?: string;
  modality_id?: number;
  exam_period?: string;
  exam_category?: string;
  semester?: string;
  academic_year?: string;
  building_name?: string;
}

const SchedulerView: React.FC = () => {
  const [examData, setExamData] = useState<ExamDetail[]>([]);
  const [users, setUsers] = useState<{ user_id: number; first_name: string; last_name: string }[]>([]);
  const [page, setPage] = useState(0);

  useEffect(() => {
    const fetchUsers = async () => {
      const { data, error } = await supabase.from("tbl_users").select("user_id, first_name, last_name");
      if (data) setUsers(data);
      if (error) console.error("Error fetching users:", error);
    };
    fetchUsers();
  }, []);

  const getUserName = (id: number | null | undefined) => {
    if (!id) return "-";
    const user = users.find(u => u.user_id === id);
    return user ? `${user.first_name} ${user.last_name}` : "-";
  };

  useEffect(() => {
    const fetchExamDetails = async () => {
      const { data, error } = await supabase.from("tbl_examdetails").select("*");
      if (error) console.error("Error fetching exam details:", error);
      else setExamData(data || []);
    };
    fetchExamDetails();
  }, []);

  // Group exams by date and room
  const groupedData: Record<string, ExamDetail[]> = {};
  examData.forEach((exam) => {
    if (!exam.exam_date || !exam.room_id) return;
    const key = `${exam.exam_date}-${exam.room_id}`;
    if (!groupedData[key]) groupedData[key] = [];
    groupedData[key].push(exam);
  });

  const rawTimes = [
    "07:30","08:00","08:30","09:00","09:30","10:00","10:30","11:00","11:30",
    "12:00","12:30","13:00","13:30","14:00","14:30","15:00","15:30","16:00",
    "16:30","17:00","17:30","18:00","18:30","19:00","19:30","20:00","20:30","21:00"
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
    label: `${formatTo12Hour(t)} - ${formatTo12Hour(rawTimes[i+1])}`,
  }));

  const rooms = Array.from(new Set(examData.map((e) => e.room_id).filter(Boolean)));

  const generateCourseColors = (courses: string[]) => {
    const colors = [
      "#79b4f2", "#f27f79", "#79f2b4", "#f2e279", "#b479f2", "#f279d6",
      "#79d6f2", "#d6f279", "#f29979", "#a3f279", "#f279a3", "#79a3f2"
    ];
    const courseColorMap: Record<string, string> = {};
    courses.forEach((course, idx) => {
      courseColorMap[course] = colors[idx % colors.length];
    });
    return courseColorMap;
  };

  const courseColorMap = generateCourseColors(
    Array.from(new Set(examData.map(e => e.course_id).filter(Boolean)))
  );

  // Header info
  const collegeName = examData.find(e => e.college_name)?.college_name ?? "Please Wait";
  const examPeriodName = examData.find(e => e.exam_period)?.exam_period ?? "Please Wait";
  const termName = examData.find(e => e.exam_category)?.exam_category ?? "Please Wait";
  const semesterName = examData.find(e => e.semester)?.semester ?? "Please Wait";
  const yearName = examData.find(e => e.academic_year)?.academic_year ?? "Please Wait";
  const buildingName = examData.find(e => e.building_name)?.building_name ?? "Please Wait";

  // Paging
  const maxRoomColumns = 5;
  const totalPages = Math.ceil(rooms.length / maxRoomColumns);
  const displayedRooms = rooms.slice(page * maxRoomColumns, (page + 1) * maxRoomColumns);

  const occupiedCells: Record<string, boolean> = {};

  return (
    <div style={{ position: "relative", width: "100%", overflow: "visible" }}>
      {/* Left Arrow */}
      {/* Left Arrow */}
      {/* Left Arrow */}
      {page > 0 && (
        <button
          type="button"
          style={{
            position: "fixed",
            left: "40%",
            top: "90%",
            transform: "translateY(-50%)",
            zIndex: 1000,
            background: "rgba(255,255,255,0.3)",
            border: "none",
            borderRadius: "50%",
            cursor: "pointer",
            padding: "0.5rem",
          }}
          onClick={() => setPage(page - 1)}
        >
          <FaChevronLeft style={{ color: "#092C4C", fontSize: "3rem", opacity: 0.7 }} />
        </button>
      )}

      {/* Right Arrow */}
      {page < totalPages - 1 && (
        <button
          type="button"
          style={{
            position: "fixed",
            right: "40%",
            top: "90%",
            transform: "translateY(-50%)",
            zIndex: 1000,
            background: "rgba(255,255,255,0.3)",
            border: "none",
            borderRadius: "50%",
            cursor: "pointer",
            padding: "0.5rem",
          }}
          onClick={() => setPage(page + 1)}
        >
          <FaChevronRight style={{ color: "#092C4C", fontSize: "3rem", opacity: 0.7 }} />
        </button>
      )}

      <div
        className="scheduler-view-card-wrapper"
        style={{
          display: "flex",
          transition: "transform 0.5s ease",
          transform: `translateX(-${page * 100}%)`,
        }}
      >
        {Array.from({ length: totalPages }).map((_, p) => {
          const pageRooms = rooms.slice(p * maxRoomColumns, (p + 1) * maxRoomColumns);
          return (
            <div
              key={p}
              className="scheduler-view-card"
              style={{
                minWidth: "100%",
                boxShadow: "0 8px 20px rgba(0,0,0,0.3)",
                borderRadius: 12,
                background: "#f9f9f9",
                margin: "0 10px", // ensures shadow is visible
                padding: 20,
              }}
            >
              <div className="scheduler-view-container">
                {/* Header */}
                <div className="header" style={{ textAlign: "center" }}>
                  <img
                    src="/USTPlogo.png"
                    alt="School Logo"
                    style={{ width: '130px', height: '95px', marginBottom: '-8px', fontFamily: 'serif' }}
                  />
                  <div style={{ fontSize: '20px', color: '#333', marginBottom: '-8px', fontFamily: 'serif' }}>
                    University of Science and Technology of Southern Philippines
                  </div>
                  <div style={{ fontSize: '10px', color: '#555', marginBottom: '-8px', fontFamily: 'serif' }}>
                    Alubijid | Balubal | Cagayan de Oro City | Claveria | Jasaan | Oroquieta | Panaon | Villanueva
                  </div>
                  <div style={{ fontSize: '20px', color: '#333', marginBottom: '-8px' , fontFamily: 'serif' }}>{collegeName}</div>
                  <div style={{ fontSize: '17px', color: '#333', marginBottom: '-10px' , fontFamily: 'serif', fontWeight: 'bold' }}>
                    {termName} Examination Schedule | {semesterName} Semester | A.Y. {yearName}
                  </div>
                  <div style={{ fontSize: '18px', color: '#333', marginTop: '5px', marginBottom: '-15px',  fontFamily: 'serif' }}>{examPeriodName}</div>
                </div>
                <hr />
                {/* Table for each date */}
                {Array.from(new Set(examData.map((e) => e.exam_date))).map((date) => (
                  <table key={date} className="exam-table">
                    <thead>
                      <tr>
                        <th colSpan={pageRooms.length + 1}>{date && new Date(date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</th>
                      </tr>
                      <tr>
                        <th colSpan={pageRooms.length + 1}>{buildingName}</th>
                      </tr>
                      <tr>
                        <th>Time</th>
                        {pageRooms.map((room, idx) => (
                          <th key={idx}>{room}</th>
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

                            // Find exams that overlap this slot
                            const exam = examsInRoom.find((e) => {
                              if (!e.exam_start_time || !e.exam_end_time) return false;
                              const examStart = Number(e.exam_start_time!.slice(11,13)) * 60 + Number(e.exam_start_time!.slice(14,16));
                              const examEnd   = Number(e.exam_end_time!.slice(11,13)) * 60 + Number(e.exam_end_time!.slice(14,16));
                              const slotStart  = Number(slot.start24.split(":")[0]) * 60 + Number(slot.start24.split(":")[1]);
                              const slotEnd    = Number(slot.end24.split(":")[0]) * 60 + Number(slot.end24.split(":")[1]);
                              // Check if this exam overlaps with the current slot
                              return (examStart < slotEnd) && (examEnd > slotStart);
                            });

                            if (!exam) return <td key={room}></td>;

                            const startMinutes = Number(exam.exam_start_time!.slice(11, 13)) * 60 + Number(exam.exam_start_time!.slice(14, 16));
                            const endMinutes   = Number(exam.exam_end_time!.slice(11, 13)) * 60 + Number(exam.exam_end_time!.slice(14, 16));

                            // Mark all covered cells as occupied
                            // Calculate which slot the exam actually starts in
                            const examStartHour = Number(exam.exam_start_time!.slice(11, 13));
                            const examStartMin  = Number(exam.exam_start_time!.slice(14, 16));
                            const examStartTotalMin = examStartHour * 60 + examStartMin;

                            // Find the slot index in timeSlots that contains examStartTotalMin
                            const startSlotIndex = timeSlots.findIndex(slot => {
                              const slotStart = Number(slot.start24.split(":")[0]) * 60 + Number(slot.start24.split(":")[1]);
                              const slotEnd   = Number(slot.end24.split(":")[0]) * 60 + Number(slot.end24.split(":")[1]);
                              return examStartTotalMin >= slotStart && examStartTotalMin < slotEnd;
                            });

                            const rowSpan = Math.ceil((endMinutes - startMinutes) / 30);

                            // Mark all covered cells as occupied starting from actual slot
                            for (let i = 0; i < rowSpan; i++) {
                              if (startSlotIndex + i < timeSlots.length) {
                                occupiedCells[`${date}-${room}-${startSlotIndex + i}`] = true;
                              }
                            }

                            return (
                              <td key={room} rowSpan={rowSpan}>
                                <div style={{
                                  backgroundColor: courseColorMap[exam.course_id || ""] || "#ccc",
                                  color: "#fff",
                                  padding: 4,
                                  borderRadius: 4,
                                  fontSize: 12
                                }}>
                                  <p>{exam.course_id}</p>
                                  <p>{exam.section_name}</p>
                                  <p>Instructor: {getUserName(exam.instructor_id)}</p>
                                  <p>Proctor: {getUserName(exam.proctor_id)}</p>
                                  <p>{formatTo12Hour(exam.exam_start_time!.slice(11,16))} - {formatTo12Hour(exam.exam_end_time!.slice(11,16))}</p>
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SchedulerView;
