/// <reference types="react" />
import React, { useEffect, useState } from "react";
import { api } from '../lib/apiClient.ts';
import "../styles/S_ExamViewer.css";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa";
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

interface ExamDetail {
  examdetails_id?: number;
  course_id: string;
  section_name?: string;
  sections?: string[];
  room_id?: string;
  exam_date?: string;
  exam_start_time?: string;
  semester?: string;
  exam_end_time?: string;
  instructor_id?: number;
  instructors?: number[];
  proctor_id?: number;
  proctors?: number[];
  proctor_timein?: string;
  academic_year?: string;
  building_name?: string;
  proctor_timeout?: string;
  program_id?: string;
  college_name?: string;
  modality_id?: number;
  exam_period?: string;
  exam_category?: string;
}

interface ProctorViewExamProps {
  user: {
    user_id: number;
    email_address: string;
    first_name?: string;
    last_name?: string;
    middle_name?: string;
    contact_number: string;
  } | null;
}

const ProctorViewExam: React.FC<ProctorViewExamProps> = ({ user }) => {
  const [examData, setExamData] = useState<ExamDetail[]>([]);
  const [users, setUsers] = useState<{ user_id: number; first_name: string; last_name: string }[]>([]);
  const [page, setPage] = useState(0);
  const [selectedFilter, setSelectedFilter] = useState<string>("all");
  const [proctorCollegeName, setProctorCollegeName] = useState<string>("");
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [viewMode, setViewMode] = useState<"my-schedule" | "all-schedule">("my-schedule");
  const [approvalStatus, setApprovalStatus] = useState<'pending' | 'approved' | 'rejected' | null>(null);

  const maxRoomColumns = 5;

  const collegeName = (proctorCollegeName || examData.find(e => e.college_name)?.college_name) ?? "No schedules available";
  const examPeriodName = examData.find(e => e.exam_period)?.exam_period ?? "-";
  const termName = examData.find(e => e.exam_category)?.exam_category ?? "-";
  const semesterName = examData.find(e => e.semester)?.semester ?? "-";
  const yearName = examData.find(e => e.academic_year)?.academic_year ?? "-";

  useEffect(() => {
    const fetchProctorData = async () => {
      if (!user?.user_id) {
        setIsLoadingData(false);
        return;
      }

      try {
        // Fetch proctor role information
        const proctorRolesResponse = await api.get('/tbl_user_role', {
          params: {
            user_id: user.user_id,
            role_id: 5 // Proctor role
          }
        });

        const proctorRoles = proctorRolesResponse.data;
        if (!proctorRoles || proctorRoles.length === 0) {
          console.error("No proctor role found for user");
          setIsLoadingData(false);
          return;
        }

        const proctorCollegeId = proctorRoles[0].college_id;

        // Fetch college information
        const collegeResponse = await api.get(`/tbl_college/${proctorCollegeId}/`);
        const collegeName = collegeResponse.data?.college_name;
        setProctorCollegeName(collegeName || "");

        // Fetch all users for name resolution
        const usersResponse = await api.get('/users/');
        setUsers(usersResponse.data || []);

        setIsLoadingData(false);
      } catch (error) {
        console.error("Error fetching proctor data:", error);
        setIsLoadingData(false);
      }
    };

    fetchProctorData();
  }, [user]);

  useEffect(() => {
    if (!proctorCollegeName) return;

    const fetchScheduleData = async () => {
      try {
        const examParams: any = {};
        if (proctorCollegeName && proctorCollegeName !== "No schedules available") {
          examParams.college_name = proctorCollegeName;
        }

        const examsResponse = await api.get('/tbl_examdetails', { params: examParams });

        if (examsResponse.data) {
          setExamData(examsResponse.data);
        }
      } catch (error) {
        console.error("Error fetching schedule data:", error);
      }
    };

    fetchScheduleData();
    const interval = setInterval(fetchScheduleData, 5000);
    return () => clearInterval(interval);
  }, [proctorCollegeName]);

  useEffect(() => {
    const checkApprovalStatus = async () => {
      if (!user?.user_id || !collegeName || collegeName === "No schedules available") {
        setApprovalStatus(null);
        return;
      }

      if (examData.length === 0) {
        setApprovalStatus(null);
        return;
      }

      try {
        const response = await api.get('/tbl_scheduleapproval/', {
          params: {
            college_name: collegeName
          }
        });

        if (response.data && response.data.length > 0) {
          const sortedData = response.data.sort((a: any, b: any) =>
            new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime()
          );
          const latestApproval = sortedData[0];
          setApprovalStatus(latestApproval.status as 'pending' | 'approved' | 'rejected');
        } else {
          setApprovalStatus(null);
        }
      } catch (error) {
        console.error("Error checking approval status:", error);
        setApprovalStatus(null);
      }
    };

    checkApprovalStatus();
    const interval = setInterval(checkApprovalStatus, 5000);
    return () => clearInterval(interval);
  }, [user, collegeName, examData.length]);

  const getSectionDisplay = (exam: ExamDetail): string => {
    if (!exam.sections || exam.sections.length === 0) {
      return exam.section_name || "N/A";
    }

    const rawSections = Array.from(new Set(
      exam.sections
        .map(s => (s ?? "").toString().trim())
        .filter(Boolean)
    ));

    const validSections = rawSections.filter(s =>
      /^(.+?)(\d+)(_[A-Za-z0-9]+)?$/.test(s) && !/[\s,]/.test(s)
    );

    if (validSections.length === 0) {
      return exam.section_name || "N/A";
    }

    if (validSections.length === 1) return validSections[0];

    validSections.sort((a, b) => {
      const ma = a.match(/^(.+?)(\d+)(_[A-Za-z0-9]+)?$/)!;
      const mb = b.match(/^(.+?)(\d+)(_[A-Za-z0-9]+)?$/)!;
      const prefixA = ma[1], prefixB = mb[1];
      if (prefixA !== prefixB) return prefixA.localeCompare(prefixB);
      const na = parseInt(ma[2], 10), nb = parseInt(mb[2], 10);
      return na - nb;
    });

    const groups: Record<string, { num: number; original: string }[]> = {};
    validSections.forEach(s => {
      const m = s.match(/^(.+?)(\d+)(_[A-Za-z0-9]+)?$/)!;
      const prefix = m[1];
      const num = parseInt(m[2], 10);
      const suffix = m[3] || "";
      const key = prefix + suffix;
      groups[key] = groups[key] || [];
      groups[key].push({ num, original: s });
    });

    const parts: string[] = [];
    Object.keys(groups).forEach(key => {
      const items = groups[key].sort((a, b) => a.num - b.num);
      let startIdx = 0;
      for (let i = 0; i < items.length; i++) {
        const isEnd = i === items.length - 1 || items[i + 1].num !== items[i].num + 1;
        if (isEnd) {
          const size = i - startIdx + 1;
          if (size >= 2) {
            parts.push(`${items[startIdx].original} - ${items[i].original}`);
          } else {
            parts.push(items[i].original);
          }
          startIdx = i + 1;
        }
      }
    });

    return parts.join(", ");
  };

  const getInstructorDisplay = (exam: ExamDetail): string => {
    if (exam.instructors && exam.instructors.length > 0) {
      const names = exam.instructors.map(id => getUserName(id)).filter(n => n !== '-');
      if (names.length === 0) return '-';
      if (names.length === 1) return names[0];
      return names.join(', ');
    }
    return getUserName(exam.instructor_id);
  };

  const getProctorDisplay = (exam: ExamDetail): string => {
    if (exam.proctors && exam.proctors.length > 1) {
      const names = exam.proctors.map(id => getUserName(id)).filter(n => n !== '-');
      if (names.length === 0) return 'Not Assigned';
      return names.join(', ');
    }
    
    if (exam.proctor_id) {
      return getUserName(exam.proctor_id);
    }
    
    if (exam.proctors && exam.proctors.length === 1) {
      return getUserName(exam.proctors[0]);
    }
    
    return 'Not Assigned';
  };

  const getUserName = (id: number | null | undefined) => {
    if (!id) return "-";
    const numericId = typeof id === 'string' ? parseInt(id, 10) : id;
    const foundUser = users.find(u => Number(u.user_id) === Number(numericId));
    if (foundUser) {
      return `${foundUser.first_name} ${foundUser.last_name}`;
    }
    return "-";
  };

  const filteredExamData = selectedFilter === "all"
    ? examData
    : examData.filter(exam => {
        const filterKey = `${exam.semester} | ${exam.academic_year} | ${exam.exam_date}`;
        return filterKey === selectedFilter;
      });

  // Filter based on view mode
  const viewFilteredData = viewMode === "my-schedule"
    ? filteredExamData.filter(exam => 
        exam.proctor_id === user?.user_id || 
        (exam.proctors && exam.proctors.includes(user?.user_id || 0))
      )
    : filteredExamData;

  const searchFilteredData = searchTerm.trim() === ""
    ? viewFilteredData
    : viewFilteredData.filter(exam => {
        const searchLower = searchTerm.toLowerCase();
        
        const sectionMatch = 
          (exam.sections && exam.sections.some(s => s.toLowerCase().includes(searchLower))) ||
          exam.section_name?.toLowerCase().includes(searchLower);
        
        const instructorMatch = 
          (exam.instructors && exam.instructors.some(id => getUserName(id).toLowerCase().includes(searchLower))) ||
          getUserName(exam.instructor_id).toLowerCase().includes(searchLower);
        
        const proctorMatch = 
          (exam.proctors && exam.proctors.some(id => getUserName(id).toLowerCase().includes(searchLower))) ||
          getUserName(exam.proctor_id).toLowerCase().includes(searchLower);
        
        return (
          exam.course_id?.toLowerCase().includes(searchLower) ||
          sectionMatch ||
          exam.room_id?.toLowerCase().includes(searchLower) ||
          instructorMatch ||
          proctorMatch ||
          exam.exam_date?.includes(searchTerm) ||
          exam.exam_start_time?.includes(searchTerm) ||
          exam.exam_end_time?.includes(searchTerm)
        );
      });

  const getFilterOptions = () => {
    const uniqueOptions = new Set<string>();
    examData.forEach(exam => {
      if (exam.semester && exam.academic_year && exam.exam_date) {
        uniqueOptions.add(`${exam.semester} | ${exam.academic_year} | ${exam.exam_date}`);
      }
    });
    return Array.from(uniqueOptions).sort();
  };

  const uniqueDates = Array.from(new Set(searchFilteredData.map((e) => e.exam_date))).filter(Boolean).sort();

  const rawTimes = [
    "07:00", "07:30", "08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
    "12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30",
    "17:00", "17:30", "18:00", "18:30", "19:00", "19:30", "20:00", "20:30", "21:00"
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

  const courseColorMap = generateCourseColors(
    Array.from(new Set(searchFilteredData.map(e => e.course_id).filter(Boolean)))
  );

  const hasData = searchFilteredData.length > 0;

  let totalPages = 1;
  if (selectedFilter === "all" && hasData) {
    totalPages = uniqueDates.reduce((total, date) => {
      const dateExams = searchFilteredData.filter(e => e.exam_date === date);
      const dateRooms = Array.from(new Set(dateExams.map(e => e.room_id).filter(Boolean)));
      return total + Math.max(1, Math.ceil(dateRooms.length / maxRoomColumns));
    }, 0);
  } else if (hasData) {
    const rooms = Array.from(new Set(searchFilteredData.map(e => e.room_id).filter(Boolean)));
    totalPages = Math.max(1, Math.ceil(rooms.length / maxRoomColumns));
  }

  if (isLoadingData) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontSize: '24px',
        color: '#092C4C'
      }}>
        Please wait...
      </div>
    );
  }

  // Only show schedules if approved
  if (approvalStatus !== 'approved') {
    return (
      <div style={{ position: "relative", width: "100%", overflow: "visible" }}>
        <div
          className="scheduler-view-card"
          style={{
            minWidth: "100%",
            maxWidth: "1400px",
            boxShadow: "0 8px 20px rgba(0,0,0,0.3)",
            borderRadius: 12,
            background: "#f9f9f9",
            margin: "16px auto",
            padding: 15,
            transform: "scale(0.9)",
            transformOrigin: "top center",
            transition: "transform 0.3s ease"
          }}
        >
          <div className="scheduler-view-container">
            <div className="header" style={{ textAlign: "center", marginBottom: "20px" }}>
              <img
                src="/logo/USTPlogo.png"
                alt="School Logo"
                style={{ width: '200px', height: '160px', marginBottom: '5px' }}
              />
              <div style={{ fontSize: '30px', color: '#333', marginBottom: '-10px', fontFamily: 'serif' }}>
                University of Science and Technology of Southern Philippines
              </div>
              <div style={{ fontSize: '15px', color: '#555', marginBottom: '-10px', fontFamily: 'serif' }}>
                Alubijid | Balubal | Cagayan de Oro City | Claveria | Jasaan | Oroquieta | Panaon | Villanueva
              </div>
              <div style={{ fontSize: '30px', color: '#333', marginBottom: '-10px', fontFamily: 'serif' }}>{collegeName}</div>
              <div style={{ fontSize: '20px', color: '#333', marginBottom: '-10px', fontFamily: 'serif', fontWeight: 'bold' }}>
                Examination Schedule
              </div>
            </div>
            <hr />
            <div style={{
              textAlign: 'center',
              padding: '100px 20px',
              fontSize: '24px',
              color: approvalStatus === 'rejected' ? '#d32f2f' : '#666',
              fontFamily: 'serif'
            }}>
              <div style={{
                backgroundColor: approvalStatus === 'rejected' ? '#ffebee' : approvalStatus === 'pending' ? '#fff3e0' : '#f5f5f5',
                padding: '40px',
                borderRadius: '12px',
                border: `2px solid ${approvalStatus === 'rejected' ? '#d32f2f' : approvalStatus === 'pending' ? '#ff9800' : '#999'}`,
                maxWidth: '600px',
                margin: '0 auto'
              }}>
                <p style={{ margin: 0, fontWeight: 'bold' }}>
                  {approvalStatus === 'pending' 
                    ? 'Schedule is pending approval from the dean.' 
                    : approvalStatus === 'rejected'
                    ? 'Schedule was rejected. Please contact your scheduler.'
                    : 'No approved schedule available yet.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: "relative", width: "100%", overflow: "visible" }}>
      <div className="scheduler-top-card">
        {/* View Mode Toggle */}
        <div style={{
          display: 'flex',
          gap: '10px',
          alignItems: 'center'
        }}>
          <button
            type="button"
            onClick={() => {
              setViewMode("my-schedule");
              setPage(0);
            }}
            style={{
              padding: "8px 16px",
              fontSize: "14px",
              borderRadius: "15px",
              border: "2px solid #092C4C",
              backgroundColor: viewMode === "my-schedule" ? "#092C4C" : "white",
              color: viewMode === "my-schedule" ? "white" : "#092C4C",
              cursor: "pointer",
              fontWeight: "bold",
              transition: "all 0.3s ease",
              width: "200px",
            }}
          >
            My Schedule
          </button>
          <button
            type="button"
            onClick={() => {
              setViewMode("all-schedule");
              setPage(0);
            }}
            style={{
              padding: "8px 16px",
              fontSize: "14px",
              borderRadius: "15px",
              border: "2px solid #092C4C",
              backgroundColor: viewMode === "all-schedule" ? "#092C4C" : "white",
              color: viewMode === "all-schedule" ? "white" : "#092C4C",
              cursor: "pointer",
              fontWeight: "bold",
              transition: "all 0.3s ease",
              width: "200px",
            }}
          >
            All College Schedule
          </button>
        </div>

        {/* Date Filter */}
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
              padding: "8px 1px",
              fontSize: "14px",
              borderRadius: "15px",
              border: "2px solid #092C4C",
              backgroundColor: "white",
              cursor: "pointer",
              minWidth: "250px",
              color: "#092C4C",
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

        {/* Search */}
        <div
          style={{
            padding: "1px",
            fontSize: "10px",
            borderRadius: "15px",
            border: "2px solid #092C4C",
            backgroundColor: "white",
            cursor: "pointer",
            minWidth: "250px",
            color: "#092C4C",
          }}
        >
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(0);
            }}
            placeholder="Search schedules..."
            style={{
              border: "none",
              outline: "none",
              fontSize: "14px",
              color: "#092C4C",
              backgroundColor: "transparent",
            }}
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm("");
                setPage(0);
              }}
              style={{
                background: "none",
                border: "none",
                color: "#092C4C",
                cursor: "pointer",
                fontSize: "18px",
                padding: "0",
                marginLeft: "23px",
              }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Navigation Buttons */}
      {hasData && page > 0 && (
        <button
          type="button"
          className="scheduler-nav-button scheduler-nav-button-left"
          onClick={() => setPage(page - 1)}
        >
          <FaChevronLeft style={{ fontSize: "3rem" }} />
        </button>
      )}

      {hasData && page < totalPages - 1 && (
        <button
          type="button"
          className="scheduler-nav-button scheduler-nav-button-right"
          onClick={() => setPage(page + 1)}
        >
          <FaChevronRight style={{ fontSize: "3rem" }} />
        </button>
      )}

      {/* Schedule Cards */}
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
              minWidth: "100%",
              maxWidth: "1400px",
              boxShadow: "0 8px 20px rgba(0,0,0,0.3)",
              borderRadius: 12,
              background: "#f9f9f9",
              margin: "16px auto",
              padding: 15,
              transform: "scale(0.9)",
              transformOrigin: "top center",
              transition: "transform 0.3s ease"
            }}
          >
            <div className="scheduler-view-container">
              <div className="header" style={{ textAlign: "center", marginBottom: "20px" }}>
                <img
                  src="/logo/USTPlogo.png"
                  alt="School Logo"
                  style={{ width: '200px', height: '160px', marginBottom: '5px' }}
                />
                <div style={{ fontSize: '30px', color: '#333', marginBottom: '-10px', fontFamily: 'serif' }}>
                  University of Science and Technology of Southern Philippines
                </div>
                <div style={{ fontSize: '15px', color: '#555', marginBottom: '-10px', fontFamily: 'serif' }}>
                  Alubijid | Balubal | Cagayan de Oro City | Claveria | Jasaan | Oroquieta | Panaon | Villanueva
                </div>
                <div style={{ fontSize: '30px', color: '#333', marginBottom: '-10px', fontFamily: 'serif' }}>{collegeName}</div>
                <div style={{ fontSize: '20px', color: '#333', marginBottom: '-10px', fontFamily: 'serif', fontWeight: 'bold' }}>
                  {termName} Examination Schedule | {semesterName} Semester | A.Y. {yearName}
                </div>
                <div style={{ fontSize: '20px', color: '#333', marginTop: '-10px', fontFamily: 'serif' }}>{examPeriodName}</div>
              </div>
              <hr />
              <div style={{
                textAlign: 'center',
                padding: '100px 20px',
                fontSize: '24px',
                color: '#999',
                fontFamily: 'serif'
              }}>
                {viewMode === "my-schedule" 
                  ? "No schedules assigned to you yet" 
                  : selectedFilter === "all" 
                    ? "No schedules available" 
                    : "No schedules found for selected filter"}
              </div>
            </div>
          </div>
        ) : selectedFilter === "all" ? (
          uniqueDates.flatMap((date) => {
            const dateExams = searchFilteredData.filter(e => e.exam_date === date);
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
                    minWidth: "100%",
                    maxWidth: "1400px",
                    boxShadow: "0 8px 20px rgba(0,0,0,0.3)",
                    borderRadius: 12,
                    background: "#f9f9f9",
                    margin: "16px auto",
                    padding: 15,
                    transform: "scale(0.8)",
                    transformOrigin: "top center",
                    transition: "transform 0.3s ease"
                  }}
                >
                  <div className="scheduler-view-container">
                    <div className="header" style={{ textAlign: "center", marginBottom: "20px" }}>
                      <img
                        src="/logo/USTPlogo.png"
                        alt="School Logo"
                        style={{ width: '200px', height: '160px', marginBottom: '5px' }}
                      />
                      <div style={{ fontSize: '30px', color: '#333', marginBottom: '-10px', fontFamily: 'serif' }}>
                        University of Science and Technology of Southern Philippines
                      </div>
                      <div style={{ fontSize: '15px', color: '#555', marginBottom: '-10px', fontFamily: 'serif' }}>
                        Alubijid | Balubal | Cagayan de Oro City | Claveria | Jasaan | Oroquieta | Panaon | Villanueva
                      </div>
                      <div style={{ fontSize: '30px', color: '#333', marginBottom: '-10px', fontFamily: 'serif' }}>{collegeName}</div>
                      <div style={{ fontSize: '20px', color: '#333', marginBottom: '-10px', fontFamily: 'serif', fontWeight: 'bold' }}>
                        {termName} Examination Schedule | {semesterName} Semester | A.Y. {yearName}
                      </div>
                      <div style={{ fontSize: '20px', color: '#333', marginTop: '-10px', fontFamily: 'serif' }}>{examPeriodName}</div>
                    </div>
                    <hr />
                    <table className="exam-table">
                      <thead>
                        <tr>
                          <th colSpan={pageRooms.length + 1}>{date && new Date(date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</th>
                        </tr>
                        <tr>
                          <th></th>
                          {(() => {
                            const buildingGroups: Record<string, string[]> = {};
                            pageRooms.forEach((room) => {
                              const building = dateExams.find(e => e.room_id === (room ?? ""))?.building_name || "Unknown Building";
                              if (!buildingGroups[building]) buildingGroups[building] = [];
                              buildingGroups[building].push(String(room));
                            });

                            return Object.entries(buildingGroups).map(([building, rooms]) => (
                              <th key={building} colSpan={rooms.length}>{building}</th>
                            ));
                          })()}
                        </tr>
                        <tr>
                          <th>Time</th>
                          {(() => {
                            const buildingGroups: Record<string, string[]> = {};
                            pageRooms.forEach((room) => {
                              const building = dateExams.find(e => e.room_id === (room ?? ""))?.building_name || "Unknown Building";
                              if (!buildingGroups[building]) buildingGroups[building] = [];
                              buildingGroups[building].push(String(room));
                            });

                            return Object.values(buildingGroups)
                              .flat()
                              .map((room, idx) => <th key={idx}>{room}</th>);
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

                              const examStartTimeStr = exam.exam_start_time!.slice(11, 16);
                              const examEndTimeStr = exam.exam_end_time!.slice(11, 16);

                              const [examStartHour, examStartMin] = examStartTimeStr.split(':').map(Number);
                              const [examEndHour, examEndMin] = examEndTimeStr.split(':').map(Number);

                              const startMinutes = examStartHour * 60 + examStartMin;
                              const endMinutes = examEndHour * 60 + examEndMin;

                              const startSlotIndex = timeSlots.findIndex(slot => {
                                const slotStart = Number(slot.start24.split(":")[0]) * 60 + Number(slot.start24.split(":")[1]);
                                const slotEnd = Number(slot.end24.split(":")[0]) * 60 + Number(slot.end24.split(":")[1]);
                                return startMinutes >= slotStart && startMinutes < slotEnd;
                              });

                              const rowSpan = Math.ceil((endMinutes - startMinutes) / 30);

                              for (let i = 0; i < rowSpan; i++) {
                                if (startSlotIndex + i < timeSlots.length) {
                                  occupiedCells[`${date}-${room}-${startSlotIndex + i}`] = true;
                                }
                              }

                              // Highlight if this is the proctor's schedule
                              const isMySchedule = exam.proctor_id === user?.user_id || 
                                (exam.proctors && exam.proctors.includes(user?.user_id || 0));

                              return (
                                <td key={room} rowSpan={rowSpan}>
                                  <div
                                    style={{
                                      backgroundColor: courseColorMap[exam.course_id || ""] || "#ccc",
                                      color: "black",
                                      padding: 4,
                                      borderRadius: 4,
                                      fontSize: 12,
                                      cursor: "default",
                                      outline: isMySchedule ? "3px solid #4CAF50" : searchTerm && (
                                        exam.course_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                        getSectionDisplay(exam).toLowerCase().includes(searchTerm.toLowerCase()) ||
                                        exam.room_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                        getInstructorDisplay(exam).toLowerCase().includes(searchTerm.toLowerCase()) ||
                                        getProctorDisplay(exam).toLowerCase().includes(searchTerm.toLowerCase())
                                      )
                                        ? "3px solid yellow"
                                        : "none",
                                      boxShadow: isMySchedule 
                                        ? "0 0 15px 3px rgba(76, 175, 80, 0.8)"
                                        : searchTerm && (
                                          exam.course_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                          getSectionDisplay(exam).toLowerCase().includes(searchTerm.toLowerCase()) ||
                                          exam.room_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                          getInstructorDisplay(exam).toLowerCase().includes(searchTerm.toLowerCase()) ||
                                          getProctorDisplay(exam).toLowerCase().includes(searchTerm.toLowerCase())
                                        ) ? "0 0 15px 3px rgba(255, 255, 0, 0.8)" : "none"
                                    }}
                                  >
                                    <p><strong>{exam.course_id}</strong></p>
                                    <p style={{ 
                                      fontSize: exam.sections && exam.sections.length > 3 ? '10px' : '12px',
                                      lineHeight: '1.2'
                                    }}>
                                      {getSectionDisplay(exam)}
                                    </p>
                                    <p style={{ 
                                      fontSize: exam.instructors && exam.instructors.length > 2 ? '10px' : '12px',
                                      lineHeight: '1.2'
                                    }}>
                                      Instructor: {getInstructorDisplay(exam)}
                                    </p>
                                    <p style={{ 
                                      fontSize: exam.proctors && exam.proctors.length > 2 ? '10px' : '12px',
                                      lineHeight: '1.2'
                                    }}>
                                      Proctor: {getProctorDisplay(exam)}
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
                  </div>
                </div>
              );
            });
          })
        ) : (
          // Filtered by specific date
          uniqueDates.flatMap((date) => {
            const dateExams = searchFilteredData.filter(e => e.exam_date === date);
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
                    minWidth: "100%",
                    maxWidth: "1400px",
                    boxShadow: "0 8px 20px rgba(0,0,0,0.3)",
                    borderRadius: 12,
                    background: "#f9f9f9",
                    margin: "16px auto",
                    padding: 15,
                    transform: "scale(0.8)",
                    transformOrigin: "top center",
                    transition: "transform 0.3s ease"
                  }}
                >
                  <div className="scheduler-view-container">
                    <div className="header" style={{ textAlign: "center", marginBottom: "20px" }}>
                      <img
                        src="/logo/USTPlogo.png"
                        alt="School Logo"
                        style={{ width: '200px', height: '160px', marginBottom: '5px' }}
                      />
                      <div style={{ fontSize: '30px', color: '#333', marginBottom: '-10px', fontFamily: 'serif' }}>
                        University of Science and Technology of Southern Philippines
                      </div>
                      <div style={{ fontSize: '15px', color: '#555', marginBottom: '-10px', fontFamily: 'serif' }}>
                        Alubijid | Balubal | Cagayan de Oro City | Claveria | Jasaan | Oroquieta | Panaon | Villanueva
                      </div>
                      <div style={{ fontSize: '30px', color: '#333', marginBottom: '-10px', fontFamily: 'serif' }}>{collegeName}</div>
                      <div style={{ fontSize: '20px', color: '#333', marginBottom: '-10px', fontFamily: 'serif', fontWeight: 'bold' }}>
                        {termName} Examination Schedule | {semesterName} Semester | A.Y. {yearName}
                      </div>
                      <div style={{ fontSize: '20px', color: '#333', marginTop: '-10px', fontFamily: 'serif' }}>{examPeriodName}</div>
                    </div>
                    <hr />
                    <table className="exam-table">
                      <thead>
                        <tr>
                          <th colSpan={pageRooms.length + 1}>{date && new Date(date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</th>
                        </tr>
                        <tr>
                          <th></th>
                          {(() => {
                            const buildingGroups: Record<string, string[]> = {};
                            pageRooms.forEach((room) => {
                              const building = dateExams.find(e => e.room_id === (room ?? ""))?.building_name || "Unknown Building";
                              if (!buildingGroups[building]) buildingGroups[building] = [];
                              buildingGroups[building].push(String(room));
                            });

                            return Object.entries(buildingGroups).map(([building, rooms]) => (
                              <th key={building} colSpan={rooms.length}>{building}</th>
                            ));
                          })()}
                        </tr>
                        <tr>
                          <th>Time</th>
                          {(() => {
                            const buildingGroups: Record<string, string[]> = {};
                            pageRooms.forEach((room) => {
                              const building = dateExams.find(e => e.room_id === (room ?? ""))?.building_name || "Unknown Building";
                              if (!buildingGroups[building]) buildingGroups[building] = [];
                              buildingGroups[building].push(String(room));
                            });

                            return Object.values(buildingGroups)
                              .flat()
                              .map((room, idx) => <th key={idx}>{room}</th>);
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

                              const examStartTimeStr = exam.exam_start_time!.slice(11, 16);
                              const examEndTimeStr = exam.exam_end_time!.slice(11, 16);

                              const [examStartHour, examStartMin] = examStartTimeStr.split(':').map(Number);
                              const [examEndHour, examEndMin] = examEndTimeStr.split(':').map(Number);

                              const startMinutes = examStartHour * 60 + examStartMin;
                              const endMinutes = examEndHour * 60 + examEndMin;

                              const startSlotIndex = timeSlots.findIndex(slot => {
                                const slotStart = Number(slot.start24.split(":")[0]) * 60 + Number(slot.start24.split(":")[1]);
                                const slotEnd = Number(slot.end24.split(":")[0]) * 60 + Number(slot.end24.split(":")[1]);
                                return startMinutes >= slotStart && startMinutes < slotEnd;
                              });

                              const rowSpan = Math.ceil((endMinutes - startMinutes) / 30);

                              for (let i = 0; i < rowSpan; i++) {
                                if (startSlotIndex + i < timeSlots.length) {
                                  occupiedCells[`${date}-${room}-${startSlotIndex + i}`] = true;
                                }
                              }

                              const isMySchedule = exam.proctor_id === user?.user_id || 
                                (exam.proctors && exam.proctors.includes(user?.user_id || 0));

                              return (
                                <td key={room} rowSpan={rowSpan}>
                                  <div
                                    style={{
                                      backgroundColor: courseColorMap[exam.course_id || ""] || "#ccc",
                                      color: "black",
                                      padding: 4,
                                      borderRadius: 4,
                                      fontSize: 12,
                                      cursor: "default",
                                      outline: isMySchedule ? "3px solid #4CAF50" : searchTerm && (
                                        exam.course_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                        getSectionDisplay(exam).toLowerCase().includes(searchTerm.toLowerCase()) ||
                                        exam.room_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                        getInstructorDisplay(exam).toLowerCase().includes(searchTerm.toLowerCase()) ||
                                        getProctorDisplay(exam).toLowerCase().includes(searchTerm.toLowerCase())
                                      )
                                        ? "3px solid yellow"
                                        : "none",
                                      boxShadow: isMySchedule 
                                        ? "0 0 15px 3px rgba(76, 175, 80, 0.8)"
                                        : searchTerm && (
                                          exam.course_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                          getSectionDisplay(exam).toLowerCase().includes(searchTerm.toLowerCase()) ||
                                          exam.room_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                          getInstructorDisplay(exam).toLowerCase().includes(searchTerm.toLowerCase()) ||
                                          getProctorDisplay(exam).toLowerCase().includes(searchTerm.toLowerCase())
                                        ) ? "0 0 15px 3px rgba(255, 255, 0, 0.8)" : "none"
                                    }}
                                  >
                                    <p><strong>{exam.course_id}</strong></p>
                                    <p style={{ 
                                      fontSize: exam.sections && exam.sections.length > 3 ? '10px' : '12px',
                                      lineHeight: '1.2'
                                    }}>
                                      {getSectionDisplay(exam)}
                                    </p>
                                    <p style={{ 
                                      fontSize: exam.instructors && exam.instructors.length > 2 ? '10px' : '12px',
                                      lineHeight: '1.2'
                                    }}>
                                      Instructor: {getInstructorDisplay(exam)}
                                    </p>
                                    <p style={{ 
                                      fontSize: exam.proctors && exam.proctors.length > 2 ? '10px' : '12px',
                                      lineHeight: '1.2'
                                    }}>
                                      Proctor: {getProctorDisplay(exam)}
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
                  </div>
                </div>
              );
            });
          })
        )}
      </div>

      <ToastContainer position="top-right" autoClose={1500} />
    </div>
  );
};

export default ProctorViewExam;