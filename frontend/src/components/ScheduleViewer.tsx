/// <reference types="react" />
import React, { useEffect, useState } from "react";
import Select from "react-select";
import { api } from '../lib/apiClient.ts';
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
  program_id?: string;
  section_name?: string;

  // Foreign keys (IDs for POST/PUT)
  room_id?: string | number;
  modality_id?: number;
  proctor_id?: number | null;
  examperiod_id?: number;

  // Expanded foreign keys (for GET responses)
  room?: {
    room_id: number;
    room_name: string;
    building_name?: string;
  };
  modality?: {
    modality_id: number;
    modality_name: string;
  };
  proctor?: {
    user_id: number;
    first_name: string;
    last_name: string;
  };
  examperiod?: string | {
    examperiod_id: number;
    exam_date: string;
  };

  // Optional flat read-only fields for convenience
  room_name?: string;
  building_name?: string;
  college_name?: string;
  modality_name?: string;
  proctor_name?: string;

  // Exam details
  exam_date?: string;
  exam_start_time?: string;
  exam_end_time?: string;
  exam_duration?: string;
  exam_period?: string;
  exam_category?: string;

  // Metadata
  instructor_id?: number;
  academic_year?: string;
  semester?: string;
  proctor_timein?: string;
  proctor_timeout?: string;
}

interface SchedulerViewProps {
  user: {
    user_id: number;
    email_address: string;
    first_name?: string;
    last_name?: string;
    middle_name?: string;
  } | null;
}

const SchedulerView: React.FC<SchedulerViewProps> = ({ user }) => {
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
      try {
        // 1. Get the logged-in user
        const { data: userResponse } = await api.get("/users/");
        const user = userResponse?.user;
        if (!user) return;
        console.log("userResponse:", userResponse);


        // 2. Get user's database row
        const { data: userRow } = await api.get(`/users?uuid=${user.id}`);
        if (!userRow) return;
        const realUserId = userRow.user_id;

        // 3. Get scheduler's college(s)
        const { data: schedulerRoles } = await api.get(`/tbl_user_role?user_id=${realUserId}&role=3`);
        if (!schedulerRoles?.length) return;
        const schedulerColleges = schedulerRoles.map((r: any) => r.college_id).filter(Boolean);

        // 4. Fetch all proctor roles within the same colleges
        const { data: proctorRoles } = await api.get(`/tbl_user_role?role=5`);
        if (!proctorRoles?.length) {
          setProctors([]);
          return;
        }

        // 5. Filter only those proctors whose college_id matches scheduler's colleges
        const validProctors = proctorRoles.filter((r: any) =>
          schedulerColleges.includes(r.college_id)
        );

        if (!validProctors.length) {
          setProctors([]);
          return;
        }

        const proctorIds = validProctors.map((r: any) => r.user_id);

        // 6. Get user details for those proctor IDs
        const { data: proctorUsers } = await api.get(`/users?ids=${proctorIds.join(",")}`);
        setProctors(proctorUsers || []);

      } catch (err) {
        console.error("Error fetching scheduler data:", err);
        setProctors([]);
      }
    };

    fetchSchedulerData();
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: exams } = await api.get("/tbl_examdetails");
        setExamData(exams || []);

        const { data: users } = await api.get("/users/");
        setUsers(users || []);
      } catch (err) {
        console.error("Error fetching exams/users:", err);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 2000);
    return () => clearInterval(interval);
  }, []);

  const getProctorName = (id: number | null | undefined) => {
    if (!id) return "-";
    const p = proctors.find(pr => pr.user_id === id);
    return p ? `${p.first_name} ${p.last_name}` : "-";
  };

  const handleProctorChange = async (examId: number, proctorId: number) => {
    try {
      await api.put(`/tbl_examdetails/${examId}`, { proctor_id: proctorId });

      setExamData(prev =>
        prev.map(e => e.examdetails_id === examId ? { ...e, proctor_id: proctorId } : e)
      );
      setActiveProctorEdit(null);
      toast.success("Proctor updated successfully!");
    } catch (err) {
      console.error("Error updating proctor:", err);
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

        try {
          // Swap rooms via backend
          await api.put(`/tbl_examdetails/${updatedA.examdetails_id}`, { room_id: updatedA.room_id });
          await api.put(`/tbl_examdetails/${updatedB.examdetails_id}`, { room_id: updatedB.room_id });

          toast.success("Schedules swapped!");
        } catch (err) {
          console.error("Error swapping schedules:", err);
          toast.error("Failed to swap schedules!");
        }

      } else {
        toast.warn("Schedules must have the same course and timeslot!");
      }
      setSelectedSwap(null);
    }
  };

  // Filter exam data based on selected filter
  const filteredExamData =
    selectedFilter === "all"
      ? examData
      : examData.filter(exam => {
          const sem = exam.semester ?? "";
          const ay = exam.academic_year ?? "";
          const date = exam.exam_date ? new Date(exam.exam_date).toISOString().split("T")[0] : "";
          const filterKey = `${sem} | ${ay} | ${date}`;
          return filterKey === selectedFilter;
        });

  useEffect(() => {
    if (examData.length === 0) return;
    
    console.log('Total exam records:', examData.length);
    console.log('Filtered exam data:', filteredExamData.length);
    
    // Check if records are being lost in the grouping logic
    const uniqueKeys = new Set<string>();
    filteredExamData.forEach(exam => {
      if (exam.exam_date && (exam.room?.room_id || exam.room_id)) {
        const roomId = exam.room?.room_id || exam.room_id;
        uniqueKeys.add(`${exam.exam_date}-${roomId}`);
      }
    });
    console.log('Unique date-room combinations:', uniqueKeys.size);
    
    // Check for duplicate examdetails_id
    const ids = filteredExamData.map(e => e.examdetails_id);
    const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
    console.log('Duplicate IDs:', duplicates);
    
    // Check if any exams don't have room data
    const noRoom = filteredExamData.filter(e => !e.room?.room_id && !e.room_id);
    console.log('Records without room:', noRoom.length, noRoom);
    
    // Check rendering logic - count cells that should be rendered
    let shouldRender = 0;
    filteredExamData.forEach(exam => {
      if (!exam.exam_start_time || !exam.exam_end_time) return;
      
      const startMinutes = Number(exam.exam_start_time.slice(11, 13)) * 60 + Number(exam.exam_start_time.slice(14, 16));
      const endMinutes = Number(exam.exam_end_time.slice(11, 13)) * 60 + Number(exam.exam_end_time.slice(14, 16));
      
      // Check if exam overlaps with any time slot
      const overlapsSlot = timeSlots.some(slot => {
        const slotStart = Number(slot.start24.split(":")[0]) * 60 + Number(slot.start24.split(":")[1]);
        const slotEnd = Number(slot.end24.split(":")[0]) * 60 + Number(slot.end24.split(":")[1]);
        return (startMinutes < slotEnd) && (endMinutes > slotStart);
      });
      
      if (overlapsSlot) shouldRender++;
    });
    console.log('Exams that should render:', shouldRender);
    
  }, [examData, filteredExamData, selectedFilter]);

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

  const maxRoomColumns = 6;
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
    const confirmStep1 = globalThis.confirm(
      `⚠️ WARNING: You are about to delete ALL schedules for ${collegeName}.\n\nAre you absolutely sure you want to continue?`
    );
    if (!confirmStep1) return;

    // Second confirmation
    const confirmStep2 = globalThis.confirm(
      `🚨 FINAL CONFIRMATION:\n\nThis will permanently remove ALL exam schedules for ${collegeName}.\nThis action cannot be undone.\n\nDo you still want to proceed?`
    );
    if (!confirmStep2) return;

    try {
      await api.delete("/tbl_examdetails", { params: { college_name: collegeName } });

      setExamData(prev => prev.filter(e => e.college_name !== collegeName));
      toast.success(`All schedules for ${collegeName} deleted successfully!`);
    } catch (err) {
      console.error("Error deleting schedules:", err);
      toast.error("Failed to delete schedules!");
    }
  };

  const getRoomName = (roomId: string | number | undefined): string => {
    if (!roomId) return "-";
    return String(roomId);
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
      const dateRooms = Array.from(new Set(dateExams.map(e => e.room?.room_id).filter(Boolean))
      ).sort((a, b) => {
        const numA = Number(a);
        const numB = Number(b);
        if (!isNaN(numA) && !isNaN(numB)) {
          return numA - numB;
        }
        return String(a).localeCompare(String(b), undefined, { numeric: true });
      });
      return total + Math.max(1, Math.ceil(dateRooms.length / maxRoomColumns));
    }, 0);
  } else if (hasData) {
    // Single date view - paginate by rooms only
    const rooms = Array.from(new Set(filteredExamData.map(e => e.room?.room_id).filter(Boolean)));
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
              margin: "16px 10px",
              padding: 15,
              paddingTop: 15,
            }}
          >
            <div className="scheduler-view-container">
              <div className="header" style={{ textAlign: "center" }}>
                <img
                  src="../../../backend/static/logo/USTPlogo.png"
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
          uniqueDates.flatMap((date) => {
            const dateExams = filteredExamData.filter(e => e.exam_date === date);
            const dateRooms = Array.from(
              new Set(dateExams.map(e => e.room?.room_id).filter(Boolean)) 
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
                if (!exam.room?.room_id) return;  // Changed from exam.room_id
                const key = `${date}-${exam.room?.room_id || exam.room_id}`; // Changed
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
                    margin: "16px 10px",
                    padding: 15,
                  }}
                >
                  <div className="scheduler-view-container">
                    <div className="header" style={{ textAlign: "center" }}>
                      <img
                        src="../../../backend/static/logo/USTPlogo.png"
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
                    <table className="exam-table">
                      <thead>
                        <tr>
                          <th colSpan={pageRooms.length + 1}>
                            {date && new Date(date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                          </th>
                        </tr>
                        <tr>
                          <th>Time</th>
                          {(() => {
                            // Group rooms by building name
                            const buildingGroups: Record<string, string[]> = {};
                            pageRooms.forEach(roomId => {
                              const exam = dateExams.find(e => e.room?.room_id === roomId);
                              const building = exam?.building_name || "Unknown Building";
                              if (!buildingGroups[building]) buildingGroups[building] = [];
                              buildingGroups[building].push(String(roomId));
                            });

                            // Render each building header with correct colSpan
                            return Object.entries(buildingGroups).map(([building, rooms]) => (
                              <th key={building} colSpan={rooms.length} style={{ background: "#092C4C" }}>
                                {building}
                              </th>
                            ));
                          })()}
                        </tr>
                        <tr>
                          <th></th>
                          {(() => {
                            // Render room headers under their building headers
                            const buildingGroups: Record<string, string[]> = {};
                            pageRooms.forEach(roomId => {
                              const exam = dateExams.find(e => e.room?.room_id === roomId);
                              const building = exam?.building_name || "Unknown Building";
                              if (!buildingGroups[building]) buildingGroups[building] = [];
                              buildingGroups[building].push(String(roomId));
                            });

                            return Object.entries(buildingGroups).flatMap(([_, rooms]) =>
                              rooms.map(roomId => (
                                <th key={roomId}>{roomId}</th>
                              ))
                            );
                          })()}
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
                                          {getProctorName(exam.proctor_id)}
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
          (() => {
            const rooms = Array.from(
              new Set(filteredExamData.map(e => e.room?.room_id).filter(Boolean))  // Changed
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
              
              // Around line 565:
              const groupedData: Record<string, ExamDetail[]> = {};
              filteredExamData.forEach((exam) => {
                if (!exam.exam_date || !exam.room?.room_id) return;  // Changed
                const key = `${exam.exam_date}-${exam.room.room_id}`;  // Changed
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
                    margin: "16px 10px",
                    padding: 15,
                  }}
                >
                  <div className="scheduler-view-container">
                    <div className="header" style={{ textAlign: "center" }}>
                      <img
                        src="../../../backend/static/logo/USTPlogo.png"
                        alt="School Logo"
                        style={{ width: '130px', height: '100px', marginBottom: '-8px', fontFamily: 'serif' }}
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
                    {uniqueDates.map((date) => (
                      <table key={date} className="exam-table">
                        <thead>
                          {/* Date row */}
                          <tr>
                            <th colSpan={pageRooms.length + 1}>
                              {date &&
                                new Date(date).toLocaleDateString("en-US", {
                                  year: "numeric",
                                  month: "long",
                                  day: "numeric",
                                })}
                            </th>
                          </tr>

                          {/* Building header row */}
                          <tr>
                            <th>Time</th>
                            {(() => {
                              // Group the rooms by building name for this page and date
                              const buildingGroups: Record<string, string[]> = {};

                              pageRooms.forEach((roomId) => {
                                const exam = filteredExamData.find(
                                  (e) => e.exam_date === date && e.room?.room_id === roomId
                                );
                                const building = exam?.building_name || "Unknown Building";

                                if (!buildingGroups[building]) buildingGroups[building] = [];
                                buildingGroups[building].push(String(roomId));
                              });

                              // Render each building header cell with its own colspan
                              return Object.entries(buildingGroups).map(([building, rooms]) => (
                                <th
                                  key={building}
                                  colSpan={rooms.length}
                                  style={{
                                    backgroundColor: "#092C4C",
                                    borderBottom: "2px solid #ddd",
                                  }}
                                >
                                  {building}
                                </th>
                              ));
                            })()}
                          </tr>

                          {/* Room headers row */}
                          <tr>
                            <th></th>
                            {(() => {
                              // Repeat the grouping so we can list each room under its building
                              const buildingGroups: Record<string, string[]> = {};

                              pageRooms.forEach((roomId) => {
                                const exam = filteredExamData.find(
                                  (e) => e.exam_date === date && e.room?.room_id === roomId
                                );
                                const building = exam?.building_name || "Unknown Building";

                                if (!buildingGroups[building]) buildingGroups[building] = [];
                                buildingGroups[building].push(String(roomId));
                              });

                              // Render each room header under its building
                              return Object.entries(buildingGroups).flatMap(([_, rooms]) =>
                                rooms.map((roomId) => (
                                  <th key={roomId}>{getRoomName(roomId)}</th>
                                ))
                              );
                            })()}
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
                                            {getProctorName(exam.proctor_id)}
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
          <AddScheduleForm user={user} />
        </Modal>
      </div>
      <ToastContainer position="top-right" autoClose={3000} />
    </div>
  );
};

export default SchedulerView;