/// <reference types="react" />
import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient.ts";
import "../styles/SchedulerView.css";
import { FaChevronLeft , FaChevronRight, FaUserEdit, FaEnvelope, FaFileDownload, FaPlus, FaTrash  } from "react-icons/fa";
import { MdSwapHoriz } from 'react-icons/md';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Modal from "../components/Modal.tsx";
import AddScheduleForm from "../components/SchedulerPlottingSchedule.tsx"; 

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
  const [_activeCards, setActiveCards] = useState<Record<string, boolean>>({});
  const [swapMode, setSwapMode] = useState(false);
  const [selectedSwap, setSelectedSwap] = useState<ExamDetail | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      // fetch exams
      const { data: exams, error: examError } = await supabase
        .from("tbl_examdetails")
        .select("*");

      if (!examError && exams) {
        setExamData(exams);
      }

      // fetch users (if you also want this updated)
      const { data: userData, error: userError } = await supabase
        .from("tbl_users")
        .select("user_id, first_name, last_name");

      if (!userError && userData) {
        setUsers(userData);
      }
    };

    // call once immediately
    fetchData();

    // auto refresh every 2 seconds
    const interval = setInterval(fetchData, 2000);

    return () => clearInterval(interval);
  }, []);

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

  const handleScheduleClick = async (exam: ExamDetail) => {
    if (!swapMode) return;

    if (!selectedSwap) {
      setSelectedSwap(exam);
    } else {
      if (
        selectedSwap.course_id === exam.course_id &&
        selectedSwap.exam_date === exam.exam_date &&
        selectedSwap.exam_start_time === exam.exam_start_time &&
        selectedSwap.exam_end_time === exam.exam_end_time
      ) {
        const updatedA = { ...selectedSwap, room_id: exam.room_id };
        const updatedB = { ...exam, room_id: selectedSwap.room_id };

        setExamData(prev =>
          prev.map(e =>
            e.examdetails_id === updatedA.examdetails_id ? updatedA :
            e.examdetails_id === updatedB.examdetails_id ? updatedB : e
          )
        );

        await supabase.from("tbl_examdetails")
          .update({ room_id: updatedA.room_id })
          .eq("examdetails_id", updatedA.examdetails_id);

        await supabase.from("tbl_examdetails")
          .update({ room_id: updatedB.room_id })
          .eq("examdetails_id", updatedB.examdetails_id);

        toast.success("Schedules swapped!");
      } else {
        toast.warn("Schedules must have the same course and timeslot!");
      }
      setSelectedSwap(null);
    }
  };

  const groupedData: Record<string, ExamDetail[]> = {};
  examData.forEach((exam) => {
    if (!exam.exam_date || !exam.room_id) return;
    const key = `${exam.exam_date}-${exam.room_id}`;
    if (!groupedData[key]) groupedData[key] = [];
    groupedData[key].push(exam);
  });

  const rawTimes = [
    "07:00","07:30","08:00","08:30","09:00","09:30","10:00","10:30","11:00","11:30",
    "12:00","12:30","13:00","13:30","14:00","14:30","15:00","15:30","16:00","16:30",
    "17:00","17:30","18:00","18:30","19:00","19:30","20:00","20:30"
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

  const rooms = Array.from(
    new Set(examData.map((e) => e.room_id).filter(Boolean))
  ).sort((a, b) => {
    const numA = Number(a);
    const numB = Number(b);
    if (!isNaN(numA) && !isNaN(numB)) {
      return numA - numB;
    }
    return String(a).localeCompare(String(b), undefined, { numeric: true });
  });

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

  const collegeName = examData.find(e => e.college_name)?.college_name ?? "Add schedule first";
  const examPeriodName = examData.find(e => e.exam_period)?.exam_period ?? "-";
  const termName = examData.find(e => e.exam_category)?.exam_category ?? "-";
  const semesterName = examData.find(e => e.semester)?.semester ?? "-";
  const yearName = examData.find(e => e.academic_year)?.academic_year ?? "-";
  const buildingName = examData.find(e => e.building_name)?.building_name ?? "-";

  const maxRoomColumns = 5;
  const totalPages = Math.max(1, Math.ceil(rooms.length / maxRoomColumns));
  const hasData = examData.length > 0;

  const occupiedCells: Record<string, boolean> = {};

  const toggleCard = (key: string) => {
    setActiveCards(prev => ({ ...prev, [key]: !prev[key] }));
  };
  
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleDeleteAllSchedules = async () => {
    const confirmDelete = window.confirm("Are you sure you want to delete ALL schedules? This action cannot be undone.");
    if (!confirmDelete) return;

    const { error } = await supabase.from("tbl_examdetails").delete().neq("examdetails_id", 0);

    if (error) {
      console.error("Error deleting schedules:", error);
      toast.error("Failed to delete all schedules!");
    } else {
      setExamData([]); // clear locally
      toast.success("All schedules deleted successfully!");
    }
  };

  const dynamicIcons = [
    { key: "Add Schedule", icon: <FaPlus style={{ color: "gold" }} />, action: () => setIsModalOpen(true) },
    { key: "Change Proctor", icon: <FaUserEdit /> },
    { key: "Swap Room", icon: <MdSwapHoriz />},
    { key: "Send to Dean", icon: <FaEnvelope />},
    { key: "Export", icon: <FaFileDownload />},
    { key: "Delete All", icon: <FaTrash style={{ color: "red" }} />, action: handleDeleteAllSchedules }
  ];

  return (
    <div style={{ position: "relative", width: "100%", overflow: "visible" }}>
      <div className="scheduler-top-card">
        {dynamicIcons.map(({ key, icon, action }) => (
        <div
          key={key}
          className={`scheduler-icon ${key === "user" && swapMode ? "active" : ""}`}
          onClick={() => {
            if (key === "Swap Room") {
              const newSwapMode = !swapMode;
              setSwapMode(newSwapMode);
              setSelectedSwap(null);
              if (newSwapMode) {
                toast.success(
                  "You are now in swapping mode. Click two exams to swap their rooms. Click the icon again to exit."
                );
              } else {
                toast.warn("Swapping mode disabled.");
              }
            } else if (action) {
              action();
            } else {
              toggleCard(key);
            }
          }}
        >
          {icon}
          <span className="tooltip-text">
            {key.charAt(0).toUpperCase() + key.slice(1)}
          </span>
        </div>
      ))}
      </div>
      {hasData && page > 0 && (
        <button
          type="button"
          style={{
            position: "fixed",
            left: "45%",
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

      {hasData && page < totalPages - 1 && (
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
          transform: hasData ? `translateX(-${page * 100}%)` : "none",
        }}
      >
        {!hasData ? (
          <div
            className="scheduler-view-card"
            style={{
              minWidth: "1400px",
              boxShadow: "0 8px 20px rgba(0,0,0,0.3)",
              borderRadius: 12,
              background: "#f9f9f9",
              margin: "0 10px",
              padding: 20,
            }}
          >
            <div className="scheduler-view-container">
              <div className="header" style={{ textAlign: "center" }}>
                <img
                  src="/USTPlogo.png"
                  alt="School Logo"
                  style={{ width: '130px', height: '95px', marginBottom: '-8px', fontFamily: 'serif' }}
                />
                <div style={{ fontSize: '25px', color: '#333', marginBottom: '-8px', fontFamily: 'serif' }}>
                  University of Science and Technology of Southern Philippines
                </div>
                <div style={{ fontSize: '12px', color: '#555', marginBottom: '-8px', fontFamily: 'serif' }}>
                  Alubijid | Balubal | Cagayan de Oro City | Claveria | Jasaan | Oroquieta | Panaon | Villanueva
                </div>
                <div style={{ fontSize: '25px', color: '#333', marginBottom: '-8px' , fontFamily: 'serif' }}>{collegeName}</div>
                <div style={{ fontSize: '15px', color: '#333', marginBottom: '-10px' , fontFamily: 'serif', fontWeight: 'bold' }}>
                  {termName} Examination Schedule | {semesterName} Semester | A.Y. {yearName}
                </div>
                <div style={{ fontSize: '18px', color: '#333', marginTop: '5px', marginBottom: '-15px',  fontFamily: 'serif' }}>{examPeriodName}</div>
              </div>
              <hr />
              <div style={{ 
                textAlign: 'center', 
                padding: '100px 20px', 
                fontSize: '24px', 
                color: '#999',
                fontFamily: 'serif'
              }}>
                Add schedule first
              </div>
            </div>
          </div>
        ) : (
          Array.from({ length: totalPages }).map((_, p) => {
            const pageRooms = rooms.slice(p * maxRoomColumns, (p + 1) * maxRoomColumns);
            return (
              <div
                key={p}
                className="scheduler-view-card"
                style={{
                  minWidth: "1400px",
                  boxShadow: "0 8px 20px rgba(0,0,0,0.3)",
                  borderRadius: 12,
                  background: "#f9f9f9",
                  margin: "0 10px",
                  padding: 20,
                }}
              >
                <div className="scheduler-view-container">
                  <div className="header" style={{ textAlign: "center" }}>
                    <img
                      src="/USTPlogo.png"
                      alt="School Logo"
                      style={{ width: '130px', height: '95px', marginBottom: '-8px', fontFamily: 'serif' }}
                    />
                    <div style={{ fontSize: '25px', color: '#333', marginBottom: '-8px', fontFamily: 'serif' }}>
                      University of Science and Technology of Southern Philippines
                    </div>
                    <div style={{ fontSize: '12px', color: '#555', marginBottom: '-8px', fontFamily: 'serif' }}>
                      Alubijid | Balubal | Cagayan de Oro City | Claveria | Jasaan | Oroquieta | Panaon | Villanueva
                    </div>
                    <div style={{ fontSize: '25px', color: '#333', marginBottom: '-8px' , fontFamily: 'serif' }}>{collegeName}</div>
                    <div style={{ fontSize: '15px', color: '#333', marginBottom: '-10px' , fontFamily: 'serif', fontWeight: 'bold' }}>
                      {termName} Examination Schedule | {semesterName} Semester | A.Y. {yearName}
                    </div>
                    <div style={{ fontSize: '18px', color: '#333', marginTop: '5px', marginBottom: '-15px',  fontFamily: 'serif' }}>{examPeriodName}</div>
                  </div>
                  <hr />
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

                              const exam = examsInRoom.find((e) => {
                                if (!e.exam_start_time || !e.exam_end_time) return false;
                                const examStart = Number(e.exam_start_time!.slice(11,13)) * 60 + Number(e.exam_start_time!.slice(14,16));
                                const examEnd   = Number(e.exam_end_time!.slice(11,13)) * 60 + Number(e.exam_end_time!.slice(14,16));
                                const slotStart  = Number(slot.start24.split(":")[0]) * 60 + Number(slot.start24.split(":")[1]);
                                const slotEnd    = Number(slot.end24.split(":")[0]) * 60 + Number(slot.end24.split(":")[1]);
                                return (examStart < slotEnd) && (examEnd > slotStart);
                              });

                              if (!exam) return <td key={room}></td>;

                              const startMinutes = Number(exam.exam_start_time!.slice(11, 13)) * 60 + Number(exam.exam_start_time!.slice(14, 16));
                              const endMinutes   = Number(exam.exam_end_time!.slice(11, 13)) * 60 + Number(exam.exam_end_time!.slice(14, 16));

                              const examStartHour = Number(exam.exam_start_time!.slice(11, 13));
                              const examStartMin  = Number(exam.exam_start_time!.slice(14, 16));
                              const examStartTotalMin = examStartHour * 60 + examStartMin;

                              const startSlotIndex = timeSlots.findIndex(slot => {
                                const slotStart = Number(slot.start24.split(":")[0]) * 60 + Number(slot.start24.split(":")[1]);
                                const slotEnd   = Number(slot.end24.split(":")[0]) * 60 + Number(slot.end24.split(":")[1]);
                                return examStartTotalMin >= slotStart && examStartTotalMin < slotEnd;
                              });

                              const rowSpan = Math.ceil((endMinutes - startMinutes) / 30);

                              for (let i = 0; i < rowSpan; i++) {
                                if (startSlotIndex + i < timeSlots.length) {
                                  occupiedCells[`${date}-${room}-${startSlotIndex + i}`] = true;
                                }
                              }

                              return (
                                <td key={room} rowSpan={rowSpan}>
                                  <div
                                    onClick={() => handleScheduleClick(exam)}
                                    style={{
                                      backgroundColor: courseColorMap[exam.course_id || ""] || "#ccc",
                                      color: "#fff",
                                      padding: 4,
                                      borderRadius: 4,
                                      fontSize: 12,
                                      cursor: swapMode ? "pointer" : "default",
                                      outline: selectedSwap?.examdetails_id === exam.examdetails_id ? "10px solid blue" : "none"
                                    }}
                                  >
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
          })
        )}
        <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
          <AddScheduleForm />
        </Modal>
      </div>
      <ToastContainer position="top-right" autoClose={3000} />
    </div>
  );
};

export default SchedulerView;