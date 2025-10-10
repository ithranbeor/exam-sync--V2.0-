/// <reference types="react" />
import React, { useEffect, useState } from "react";
import Select from "react-select";
import { supabase } from "../lib/supabaseClient.ts";
import "../styles/SchedulerView.css";
import { FaChevronLeft , FaChevronRight, FaUserEdit, FaEnvelope, FaFileDownload, FaPlus, FaTrash  } from "react-icons/fa";
import { MdSwapHoriz } from 'react-icons/md';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Modal from "../components/Modal.tsx";
import AddScheduleForm from "../components/SchedulerPlottingSchedule.tsx"; 

interface ExamDetail {examdetails_id?: number;  course_id: string;      section_name?: string; room_id?: string;        exam_date?: string;     exam_start_time?: string; semester?: string; 
                      exam_end_time?: string;   instructor_id?: number; proctor_id?: number;   proctor_timein?: string; academic_year?: string; building_name?: string;
                      proctor_timeout?: string; program_id?: string;    college_name?: string; modality_id?: number;    exam_period?: string;   exam_category?: string; 
                     }

const SchedulerView: React.FC = () => {
  const [examData, setExamData] = useState<ExamDetail[]>([]);
  const [users, setUsers] = useState<{ user_id: number; first_name: string; last_name: string }[]>([]);
  const [page, setPage] = useState(0);
  const [_activeCards, setActiveCards] = useState<Record<string, boolean>>({});
  const [swapMode, setSwapMode] = useState(false);
  const [selectedSwap, setSelectedSwap] = useState<ExamDetail | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<string>("all");
  const [proctors, setProctors] = useState<{ user_id: number; first_name: string; last_name: string }[]>([]);
  const [activeProctorEdit, setActiveProctorEdit] = useState<number | null>(null); // examdetails_id

  useEffect(() => {
    const fetchSchedulerData = async () => {
      // 1. Get logged-in user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 2. Get user's user_id
      const { data: userRow, error: userRowError } = await supabase
        .from("tbl_users")
        .select("user_id")
        .eq("user_uuid", user.id)
        .single();
      
      if (userRowError || !userRow) {
        console.error("Error fetching user row:", userRowError);
        return;
      }
      const realUserId = userRow.user_id;

      // 3. Get scheduler's college(s)
      const { data: schedulerRoles, error: schedulerError } = await supabase
        .from("tbl_user_role")
        .select("college_id")
        .eq("user_id", realUserId)
        .eq("role_id", 3); // scheduler role

      if (schedulerError || !schedulerRoles?.length) {
        console.error("Error fetching scheduler roles:", schedulerError);
        return;
      }

      const schedulerColleges = schedulerRoles.map(r => r.college_id).filter(Boolean);

      // 4. Get proctor user_ids in the same college(s)
      const { data: proctorRoles, error: proctorRoleError } = await supabase
        .from("tbl_user_role")
        .select("user_id")
        .in("college_id", schedulerColleges)
        .eq("role_id", 5); // proctor role

      if (proctorRoleError || !proctorRoles?.length) {
        console.error("Error fetching proctor roles:", proctorRoleError);
        setProctors([]);
        return;
      }

      const proctorIds = proctorRoles.map(r => r.user_id);

      // 5. Fetch proctor details from tbl_users
      const { data: proctorUsers, error: proctorUserError } = await supabase
        .from("tbl_users")
        .select("user_id, first_name, last_name")
        .in("user_id", proctorIds);

      if (proctorUserError) {
        console.error("Error fetching proctor users:", proctorUserError);
        setProctors([]);
        return;
      }

      // 6. Set proctors
      setProctors(proctorUsers || []);
    };

    fetchSchedulerData();
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      const { data: exams, error: examError } = await supabase
        .from("tbl_examdetails")
        .select("*");

      if (!examError && exams) {
        setExamData(exams);
      }

      const { data: userData, error: userError } = await supabase
        .from("tbl_users")
        .select("user_id, first_name, last_name");

      if (!userError && userData) {
        setUsers(userData);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleProctorChange = async (examId: number, proctorId: number) => {
    const { error } = await supabase
      .from("tbl_examdetails")
      .update({ proctor_id: proctorId })
      .eq("examdetails_id", examId);

    if (!error) {
      setExamData(prev =>
        prev.map(e => e.examdetails_id === examId ? { ...e, proctor_id: proctorId } : e)
      );
      setActiveProctorEdit(null);
      toast.success("Proctor updated successfully!");
    } else {
      toast.error("Failed to update proctor.");
    }
  };

  const getUserName = (id: number | null | undefined) => {
    if (!id) return "-";
    const user = users.find(u => u.user_id === id);
    return user ? `${user.first_name} ${user.last_name}` : "-";
  };

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

  // Filter exam data based on selected filter
  const filteredExamData = selectedFilter === "all" 
    ? examData 
    : examData.filter(exam => {
        const filterKey = `${exam.semester} | ${exam.academic_year} | ${exam.exam_date}`;
        return filterKey === selectedFilter;
      });

  // Generate unique filter options
  const getFilterOptions = () => {
    const uniqueOptions = new Set<string>();
    examData.forEach(exam => {
      if (exam.semester && exam.academic_year && exam.exam_date) {
        uniqueOptions.add(`${exam.semester} | ${exam.academic_year} | ${exam.exam_date}`);
      }
    });
    return Array.from(uniqueOptions).sort();
  };

  // Get unique dates from filtered data
  const uniqueDates = Array.from(new Set(filteredExamData.map((e) => e.exam_date))).filter(Boolean).sort();

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
    Array.from(new Set(filteredExamData.map(e => e.course_id).filter(Boolean)))
  );

  const collegeName = examData.find(e => e.college_name)?.college_name ?? "Add schedule first";
  const examPeriodName = examData.find(e => e.exam_period)?.exam_period ?? "-";
  const termName = examData.find(e => e.exam_category)?.exam_category ?? "-";
  const semesterName = examData.find(e => e.semester)?.semester ?? "-";
  const yearName = examData.find(e => e.academic_year)?.academic_year ?? "-";
  const buildingName = examData.find(e => e.building_name)?.building_name ?? "-";

  const maxRoomColumns = 5;
  const hasData = filteredExamData.length > 0;

  const toggleCard = (key: string) => {
    setActiveCards(prev => ({ ...prev, [key]: !prev[key] }));
  };
  
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleDeleteAllSchedules = async () => {
    if (!collegeName || collegeName === "Add schedule first") {
      toast.warn("No college detected. Cannot delete schedules.");
      return;
    }

    // First confirmation
    const confirmStep1 = window.confirm(
      `⚠️ WARNING: You are about to delete ALL schedules for ${collegeName}.\n\nAre you absolutely sure you want to continue?`
    );
    if (!confirmStep1) return;

    // Second confirmation
    const confirmStep2 = window.confirm(
      `🚨 FINAL CONFIRMATION:\n\nThis will permanently remove ALL exam schedules for ${collegeName}.\nThis action cannot be undone.\n\nDo you still want to proceed?`
    );
    if (!confirmStep2) return;

    const { error } = await supabase
      .from("tbl_examdetails")
      .delete()
      .eq("college_name", collegeName);

    if (error) {
      console.error("Error deleting schedules:", error);
      toast.error("Failed to delete schedules!");
    } else {
      setExamData(prev => prev.filter(e => e.college_name !== collegeName));
      toast.success(`All schedules for ${collegeName} deleted successfully!`);
    }
  };

  const dynamicIcons = [
    { key: "Add Schedule", icon: <FaPlus style={{ color: "gold" }} />, action: () => setIsModalOpen(true) },
    { key: "Change Proctor", icon: <FaUserEdit style={{ fontSize: "20px" }} />, action: () => {
      setActiveProctorEdit(prev => prev === -1 ? null : -1);
    }},
    { key: "Swap Room", icon: <MdSwapHoriz style={{fontSize: "25px" }} />},
    { key: "Send to Dean", icon: <FaEnvelope style={{fontSize: "20px" }} />},
    { key: "Export", icon: <FaFileDownload style={{ fontSize: "18px" }} />},
    { key: "Delete All", icon: <FaTrash style={{fontSize: "18px" }} />, action: handleDeleteAllSchedules }
  ];

  let totalPages = 1;
  if (selectedFilter === "all" && hasData) {
    totalPages = uniqueDates.reduce((total, date) => {
      const dateExams = filteredExamData.filter(e => e.exam_date === date);
      const dateRooms = Array.from(new Set(dateExams.map(e => e.room_id).filter(Boolean)));
      return total + Math.max(1, Math.ceil(dateRooms.length / maxRoomColumns));
    }, 0);
  } else if (hasData) {
    // Single date view - paginate by rooms only
    const rooms = Array.from(new Set(filteredExamData.map(e => e.room_id).filter(Boolean)));
    totalPages = Math.max(1, Math.ceil(rooms.length / maxRoomColumns));
  }

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
      <div style={{
          top: "20px",
          right: "-100px",
        }}>
          <select
            value={selectedFilter}
            onChange={(e) => {
              setSelectedFilter(e.target.value);
              setPage(0);
            }}
            style={{
              padding: "8px 1px", fontSize: "14px",borderRadius: "15px", border: "2px solid #092C4C",
              backgroundColor: "white", cursor: "pointer", minWidth: "250px", color: "#092C4C",
            }}
          >
            <option value="all">All Dates</option>
            {getFilterOptions().map((option, index) => (
              <option key={index} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
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
              minWidth: "1300px",
              boxShadow: "0 8px 20px rgba(0,0,0,0.3)",
              borderRadius: 12,
              background: "#f9f9f9",
              margin: "0 10px",
              padding: 15,
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
                {selectedFilter === "all" ? "Add schedule first" : "No schedules found for selected filter"}
              </div>
            </div>
          </div>
        ) : selectedFilter === "all" ? (
          // When "All Dates" is selected, create separate cards for each date
          uniqueDates.flatMap((date) => {
            const dateExams = filteredExamData.filter(e => e.exam_date === date);
            const dateRooms = Array.from(
              new Set(dateExams.map(e => e.room_id).filter(Boolean))
            ).sort((a, b) => {
              const numA = Number(a);
              const numB = Number(b);
              if (!isNaN(numA) && !isNaN(numB)) {
                return numA - numB;
              }
              return String(a).localeCompare(String(b), undefined, { numeric: true });
            });

            const dateTotalPages = Math.max(1, Math.ceil(dateRooms.length / maxRoomColumns));

            return Array.from({ length: dateTotalPages }).map((_, p) => {
              const pageRooms = dateRooms.slice(p * maxRoomColumns, (p + 1) * maxRoomColumns);
              const occupiedCells: Record<string, boolean> = {};
              
              const groupedData: Record<string, ExamDetail[]> = {};
              dateExams.forEach((exam) => {
                if (!exam.room_id) return;
                const key = `${date}-${exam.room_id}`;
                if (!groupedData[key]) groupedData[key] = [];
                groupedData[key].push(exam);
              });

              return (
                <div
                  key={`${date}-${p}`}
                  className="scheduler-view-card"
                  style={{
                    minWidth: "1300px",
                    boxShadow: "0 8px 20px rgba(0,0,0,0.3)",
                    borderRadius: 12,
                    background: "#f9f9f9",
                    margin: "0 10px",
                    padding: 15,
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
                    <table className="exam-table">
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
                                    <p>
                                      Proctor: 
                                      {activeProctorEdit === exam.examdetails_id || activeProctorEdit === -1 ? (
                                        <Select
                                          value={
                                            exam.proctor_id
                                              ? {
                                                  value: exam.proctor_id,
                                                  label: `${getUserName(exam.proctor_id)}`
                                                }
                                              : null
                                          }
                                          onChange={(selectedOption) => {
                                            if (selectedOption) {
                                              handleProctorChange(exam.examdetails_id!, selectedOption.value);
                                            }
                                          }}
                                          options={proctors
                                            // Filter proctors who are not assigned to overlapping exams
                                            .filter((p) => {
                                              const assignedExams = examData.filter(
                                                (ex) =>
                                                  ex.proctor_id === p.user_id &&
                                                  ex.examdetails_id !== exam.examdetails_id &&
                                                  ex.exam_date === exam.exam_date
                                              );

                                              return !assignedExams.some((ex) => {
                                                const startA = new Date(exam.exam_start_time!).getTime();
                                                const endA = new Date(exam.exam_end_time!).getTime();
                                                const startB = new Date(ex.exam_start_time!).getTime();
                                                const endB = new Date(ex.exam_end_time!).getTime();

                                                return startA < endB && endA > startB;
                                              });
                                            })
                                            .map((p) => ({
                                              value: p.user_id,
                                              label: `${p.first_name} ${p.last_name}`
                                            }))}
                                          placeholder="--Select Proctor--"
                                          isSearchable
                                          styles={{ menu: (provided) => ({ ...provided, zIndex: 9999 }) }}
                                        />
                                      ) : (
                                        <span onClick={() => setActiveProctorEdit(exam.examdetails_id!)}>
                                          {getUserName(exam.proctor_id)}
                                        </span>
                                      )}
                                    </p>
                                    <p>{formatTo12Hour(exam.exam_start_time!.slice(11,16))} - {formatTo12Hour(exam.exam_end_time!.slice(11,16))}</p>
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            });
          })
        ) : (
          // Single date filter selected - original behavior
          (() => {
            const rooms = Array.from(
              new Set(filteredExamData.map(e => e.room_id).filter(Boolean))
            ).sort((a, b) => {
              const numA = Number(a);
              const numB = Number(b);
              if (!isNaN(numA) && !isNaN(numB)) {
                return numA - numB;
              }
              return String(a).localeCompare(String(b), undefined, { numeric: true });
            });

            const singleDatePages = Math.max(1, Math.ceil(rooms.length / maxRoomColumns));

            return Array.from({ length: singleDatePages }).map((_, p) => {
              const pageRooms = rooms.slice(p * maxRoomColumns, (p + 1) * maxRoomColumns);
              const occupiedCells: Record<string, boolean> = {};
              
              const groupedData: Record<string, ExamDetail[]> = {};
              filteredExamData.forEach((exam) => {
                if (!exam.exam_date || !exam.room_id) return;
                const key = `${exam.exam_date}-${exam.room_id}`;
                if (!groupedData[key]) groupedData[key] = [];
                groupedData[key].push(exam);
              });

              return (
                <div
                  key={p}
                  className="scheduler-view-card"
                  style={{
                    minWidth: "1300px",
                    boxShadow: "0 8px 20px rgba(0,0,0,0.3)",
                    borderRadius: 12,
                    background: "#f9f9f9",
                    margin: "0 10px",
                    padding: 15,
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
                    {uniqueDates.map((date) => (
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
                                      <p>
                                        Proctor: 
                                        {activeProctorEdit === exam.examdetails_id || activeProctorEdit === -1 ? (
                                          <Select
                                            value={
                                              exam.proctor_id
                                                ? {
                                                    value: exam.proctor_id,
                                                    label: `${getUserName(exam.proctor_id)}`
                                                  }
                                                : null
                                            }
                                            onChange={(selectedOption) => {
                                              if (selectedOption) {
                                                handleProctorChange(exam.examdetails_id!, selectedOption.value);
                                              }
                                            }}
                                            options={proctors
                                              // Filter proctors who are not assigned to overlapping exams
                                              .filter((p) => {
                                                const assignedExams = examData.filter(
                                                  (ex) =>
                                                    ex.proctor_id === p.user_id &&
                                                    ex.examdetails_id !== exam.examdetails_id &&
                                                    ex.exam_date === exam.exam_date
                                                );

                                                return !assignedExams.some((ex) => {
                                                  const startA = new Date(exam.exam_start_time!).getTime();
                                                  const endA = new Date(exam.exam_end_time!).getTime();
                                                  const startB = new Date(ex.exam_start_time!).getTime();
                                                  const endB = new Date(ex.exam_end_time!).getTime();

                                                  return startA < endB && endA > startB;
                                                });
                                              })
                                              .map((p) => ({
                                                value: p.user_id,
                                                label: `${p.first_name} ${p.last_name}`
                                              }))}
                                            placeholder="--Select Proctor--"
                                            isSearchable
                                            styles={{ menu: (provided) => ({ ...provided, zIndex: 9999 }) }}
                                          />
                                        ) : (
                                          <span onClick={() => setActiveProctorEdit(exam.examdetails_id!)}>
                                            {getUserName(exam.proctor_id)}
                                          </span>
                                        )}
                                      </p>
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
            });
          })()
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