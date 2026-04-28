/// <reference types="react" />
import React, { useEffect, useState, useRef } from "react";
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
  academic_year?: string;
  building_name?: string;
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
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const maxRoomColumns = 5;

  const collegeName = (proctorCollegeName || examData.find(e => e.college_name)?.college_name) ?? "No schedules available";
  const examPeriodName = examData.find(e => e.exam_period)?.exam_period ?? "-";
  const termName = examData.find(e => e.exam_category)?.exam_category ?? "-";
  const semesterName = examData.find(e => e.semester)?.semester ?? "-";
  const yearName = examData.find(e => e.academic_year)?.academic_year ?? "-";

  // Close filter menu on outside click
  useEffect(() => {
    const handleFilterOutside = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setFilterMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleFilterOutside);
    return () => document.removeEventListener('mousedown', handleFilterOutside);
  }, []);

  useEffect(() => {
    const fetchProctorData = async () => {
      if (!user?.user_id) { setIsLoadingData(false); return; }
      try {
        const proctorRolesResponse = await api.get('/tbl_user_role', {
          params: { user_id: user.user_id, role_id: 5 }
        });
        const proctorRoles = proctorRolesResponse.data;
        if (!proctorRoles || proctorRoles.length === 0) { setIsLoadingData(false); return; }

        const proctorCollegeId = proctorRoles[0].college_id;
        const collegeResponse = await api.get(`/tbl_college/${proctorCollegeId}/`);
        setProctorCollegeName(collegeResponse.data?.college_name || "");

        const usersResponse = await api.get('/users/');
        setUsers(usersResponse.data || []);
        setIsLoadingData(false);
      } catch {
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
        if (proctorCollegeName !== "No schedules available") {
          examParams.college_name = proctorCollegeName;
        }
        const examsResponse = await api.get('/tbl_examdetails', { params: examParams });
        if (examsResponse.data) setExamData(examsResponse.data);
      } catch { /* silent */ }
    };
    fetchScheduleData();
    const interval = setInterval(fetchScheduleData, 5000);
    return () => clearInterval(interval);
  }, [proctorCollegeName]);

  useEffect(() => {
    const checkApprovalStatus = async () => {
      if (!user?.user_id || !collegeName || collegeName === "No schedules available") {
        setApprovalStatus(null); return;
      }
      if (examData.length === 0) { setApprovalStatus(null); return; }
      try {
        const response = await api.get('/tbl_scheduleapproval/', { params: { college_name: collegeName } });
        if (response.data?.length > 0) {
          const sorted = response.data.sort((a: any, b: any) =>
            new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime()
          );
          setApprovalStatus(sorted[0].status as 'pending' | 'approved' | 'rejected');
        } else {
          setApprovalStatus(null);
        }
      } catch { setApprovalStatus(null); }
    };
    checkApprovalStatus();
    const interval = setInterval(checkApprovalStatus, 5000);
    return () => clearInterval(interval);
  }, [user, collegeName, examData.length]);

  const getSectionDisplay = (exam: ExamDetail): string => {
    if (!exam.sections || exam.sections.length === 0) return exam.section_name || "N/A";
    const rawSections = Array.from(new Set(exam.sections.map(s => (s ?? "").toString().trim()).filter(Boolean)));
    const validSections = rawSections.filter(s => /^(.+?)(\d+)(_[A-Za-z0-9]+)?$/.test(s) && !/[\s,]/.test(s));
    if (validSections.length === 0) return exam.section_name || "N/A";
    if (validSections.length === 1) return validSections[0];
    validSections.sort((a, b) => {
      const ma = a.match(/^(.+?)(\d+)(_[A-Za-z0-9]+)?$/)!;
      const mb = b.match(/^(.+?)(\d+)(_[A-Za-z0-9]+)?$/)!;
      if (ma[1] !== mb[1]) return ma[1].localeCompare(mb[1]);
      return parseInt(ma[2], 10) - parseInt(mb[2], 10);
    });
    const groups: Record<string, { num: number; original: string }[]> = {};
    validSections.forEach(s => {
      const m = s.match(/^(.+?)(\d+)(_[A-Za-z0-9]+)?$/)!;
      const key = m[1] + (m[3] || "");
      groups[key] = groups[key] || [];
      groups[key].push({ num: parseInt(m[2], 10), original: s });
    });
    const parts: string[] = [];
    Object.keys(groups).forEach(key => {
      const items = groups[key].sort((a, b) => a.num - b.num);
      let startIdx = 0;
      for (let i = 0; i < items.length; i++) {
        if (i === items.length - 1 || items[i + 1].num !== items[i].num + 1) {
          parts.push(i - startIdx + 1 >= 2
            ? `${items[startIdx].original} - ${items[i].original}`
            : items[i].original);
          startIdx = i + 1;
        }
      }
    });
    return parts.join(", ");
  };

  const getUserName = (id: number | null | undefined) => {
    if (!id) return "-";
    const numericId = typeof id === 'string' ? parseInt(id, 10) : id;
    const found = users.find(u => Number(u.user_id) === Number(numericId));
    return found ? `${found.first_name} ${found.last_name}` : "-";
  };

  const getInstructorDisplay = (exam: ExamDetail): string => {
    if (exam.instructors && exam.instructors.length > 0) {
      const names = exam.instructors.map(id => getUserName(id)).filter(n => n !== '-');
      return names.length === 0 ? '-' : names.join(', ');
    }
    return getUserName(exam.instructor_id);
  };

  const getProctorDisplay = (exam: ExamDetail): string => {
    if (exam.proctors && exam.proctors.length > 0) {
      const names = exam.proctors.map(id => getUserName(id)).filter(n => n !== '-');
      return names.length === 0 ? 'Not Assigned' : names.join(', ');
    }
    return exam.proctor_id ? getUserName(exam.proctor_id) : 'Not Assigned';
  };

  const filteredExamData = selectedFilter === "all"
    ? examData
    : examData.filter(exam => `${exam.semester} | ${exam.academic_year} | ${exam.exam_date}` === selectedFilter);

  const viewFilteredData = viewMode === "my-schedule"
    ? filteredExamData.filter(exam =>
        exam.proctor_id === user?.user_id ||
        (exam.proctors && exam.proctors.includes(user?.user_id || 0))
      )
    : filteredExamData;

  const searchFilteredData = searchTerm.trim() === ""
    ? viewFilteredData
    : viewFilteredData.filter(exam => {
        const sl = searchTerm.toLowerCase();
        return (
          exam.course_id?.toLowerCase().includes(sl) ||
          getSectionDisplay(exam).toLowerCase().includes(sl) ||
          exam.room_id?.toLowerCase().includes(sl) ||
          getInstructorDisplay(exam).toLowerCase().includes(sl) ||
          getProctorDisplay(exam).toLowerCase().includes(sl) ||
          exam.exam_date?.includes(searchTerm)
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

  const uniqueDates = Array.from(new Set(searchFilteredData.map(e => e.exam_date))).filter(Boolean).sort();

  const rawTimes = [
    "07:00","07:30","08:00","08:30","09:00","09:30","10:00","10:30","11:00","11:30",
    "12:00","12:30","13:00","13:30","14:00","14:30","15:00","15:30","16:00","16:30",
    "17:00","17:30","18:00","18:30","19:00","19:30","20:00","20:30","21:00"
  ];

  const formatTo12Hour = (time: string): string => {
    const [hourStr, minuteStr] = time.split(":");
    const hour = Number(hourStr);
    if (hour === 0) return `12:${minuteStr}AM`;
    if (hour === 12) return `12:${minuteStr}NN`;
    if (hour > 12) return `${hour - 12}:${minuteStr}PM`;
    return `${hour}:${minuteStr}AM`;
  };

  const timeSlots = rawTimes.slice(0, -1).map((t, i) => ({
    start24: t,
    end24: rawTimes[i + 1],
    label: `${formatTo12Hour(t)} - ${formatTo12Hour(rawTimes[i + 1])}`,
  }));

  const generateCourseColors = (exams: ExamDetail[]) => {
    const yearColors = {
      1: ['#DC2626','#D97706','#059669','#0891B2','#2563EB','#7C3AED','#DB2777','#EA580C','#0D9488','#65A30D'],
      2: ['#991B1B','#92400E','#065F46','#0E7490','#1E40AF','#5B21B6','#9D174D','#C2410C','#115E59','#3F6212'],
      3: ['#7F1D1D','#78350F','#064E3B','#155E75','#1E3A8A','#4C1D95','#831843','#9A3412','#134E4A','#365314'],
      4: ['#450A0A','#451A03','#022C22','#083344','#172554','#2E1065','#500724','#7C2D12','#042F2E','#1A2E05'],
    };
    const courseColorMap: Record<string, string> = {};
    const programYearMap: Record<string, number> = {};
    exams.forEach(exam => {
      if (!exam.course_id || courseColorMap[exam.course_id]) return;
      let yearLevel: number | null = null;
      let program = '';
      const sections = exam.sections?.length ? exam.sections : exam.section_name ? [exam.section_name] : [];
      for (const section of sections) {
        const s = String(section).trim();
        let m = s.match(/^([A-Za-z]+)(\d)([A-Za-z]*)$/) ||
                s.match(/^([A-Za-z]+)\s+(\d)([A-Za-z]*)$/) ||
                s.match(/^([A-Za-z]+)-(\d)([A-Za-z]*)$/);
        if (m) { program = m[1]; yearLevel = parseInt(m[2]); break; }
        const dm = s.match(/(\d)/); const lm = s.match(/^([A-Za-z]+)/);
        if (dm && lm) { program = lm[1]; yearLevel = parseInt(dm[1]); break; }
      }
      if (yearLevel && yearLevel >= 1 && yearLevel <= 4) {
        const key = `${program}-${yearLevel}`;
        const colors = yearColors[yearLevel as keyof typeof yearColors];
        if (!programYearMap[key]) programYearMap[key] = 0;
        courseColorMap[exam.course_id] = colors[programYearMap[key]++ % colors.length];
      } else {
        courseColorMap[exam.course_id] = '#9CA3AF';
      }
    });
    return courseColorMap;
  };

  const courseColorMap = generateCourseColors(searchFilteredData);
  const hasData = searchFilteredData.length > 0;

  let totalPages = 1;
  if (selectedFilter === "all" && hasData) {
    totalPages = uniqueDates.reduce((total, date) => {
      const dateRooms = Array.from(new Set(searchFilteredData.filter(e => e.exam_date === date).map(e => e.room_id).filter(Boolean)));
      return total + Math.max(1, Math.ceil(dateRooms.length / maxRoomColumns));
    }, 0);
  } else if (hasData) {
    const rooms = Array.from(new Set(searchFilteredData.map(e => e.room_id).filter(Boolean)));
    totalPages = Math.max(1, Math.ceil(rooms.length / maxRoomColumns));
  }

  // ── Shared schedule card header ───────────────────────────────────────────
  const ScheduleHeader = () => (
    <div className="header" style={{ textAlign: "center", marginBottom: "20px" }}>
      <img src="/logo/USTPlogo.png" alt="School Logo"
        style={{ width: '160px', height: '130px', objectFit: 'contain', marginBottom: 5 }} />
      <div style={{ fontSize: 30, color: '#333', marginBottom: -10, fontFamily: 'serif' }}>
        University of Science and Technology of Southern Philippines
      </div>
      <div style={{ fontSize: 15, color: '#555', marginBottom: -10, fontFamily: 'serif' }}>
        Alubijid | Balubal | Cagayan de Oro City | Claveria | Jasaan | Oroquieta | Panaon | Villanueva
      </div>
      <div style={{ fontSize: 30, color: '#333', marginBottom: -10, fontFamily: 'serif' }}>{collegeName}, USTP-CDO</div>
      <div style={{ fontSize: 20, color: '#333', marginBottom: -10, fontFamily: 'serif', fontWeight: 'bold' }}>
        {termName} Examination Schedule | {semesterName} Semester | A.Y. {yearName}
      </div>
      <div style={{ fontSize: 20, color: '#333', marginTop: -10, fontFamily: 'serif' }}>{examPeriodName}</div>
    </div>
  );

  // ── Exam card renderer ────────────────────────────────────────────────────
  const renderExamCard = (exam: ExamDetail) => {
    const isMySchedule = exam.proctor_id === user?.user_id ||
      (exam.proctors && exam.proctors.includes(user?.user_id || 0));
    return (
      <div style={{
        backgroundColor: courseColorMap[exam.course_id || ""] || "#ccc",
        color: "white",
        padding: "6px 8px",
        borderRadius: 5,
        fontSize: 11,
        height: '100%',
        minHeight: 52,
        boxSizing: 'border-box',
        overflowY: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-start',
        gap: 2,
        outline: isMySchedule ? '3px solid #4ade80' : 'none',
        boxShadow: isMySchedule ? '0 0 0 1px #4ade80, 0 0 12px rgba(74,222,128,0.5)' : 'none',
      }}>
        {isMySchedule && (
          <span style={{
            fontSize: 9, fontWeight: 700, background: '#4ade80', color: '#052e16',
            borderRadius: 3, padding: '1px 5px', alignSelf: 'flex-start',
            fontFamily: 'var(--mono)', letterSpacing: '0.04em',
          }}>
            MY EXAM
          </span>
        )}
        <p style={{ margin: 0, fontWeight: 700, fontSize: 12 }}>{exam.course_id}</p>
        <p style={{ margin: 0, fontSize: exam.sections && exam.sections.length > 3 ? 10 : 11, lineHeight: 1.2 }}>
          {getSectionDisplay(exam)}
        </p>
        <p style={{ margin: 0, fontSize: 10, lineHeight: 1.2, opacity: 0.9 }}>
          {getInstructorDisplay(exam)}
        </p>
        <p style={{ margin: 0, fontSize: 10, lineHeight: 1.2, opacity: 0.85 }}>
          Proctor: {getProctorDisplay(exam)}
        </p>
      </div>
    );
  };

  // ── Table renderer (shared between both flatMap branches) ─────────────────
  const renderTable = (date: string | undefined, pageRooms: (string | undefined)[], dateExams: ExamDetail[]) => {
    const occupiedCells: Record<string, boolean> = {};
    const groupedData: Record<string, ExamDetail[]> = {};
    dateExams.forEach(exam => {
      if (!exam.room_id) return;
      const k = `${date}-${exam.room_id}`;
      if (!groupedData[k]) groupedData[k] = [];
      groupedData[k].push(exam);
    });

    return (
      <table className="exam-table">
        <thead>
          <tr>
            <th colSpan={pageRooms.length + 1}>
              {date && new Date(date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
            </th>
          </tr>
          <tr>
            <th></th>
            {(() => {
              const bg: Record<string, string[]> = {};
              pageRooms.forEach(room => {
                const b = dateExams.find(e => e.room_id === (room ?? ""))?.building_name || "Unknown Building";
                if (!bg[b]) bg[b] = [];
                bg[b].push(String(room));
              });
              return Object.entries(bg).map(([b, rooms]) => <th key={b} colSpan={rooms.length}>{b}</th>);
            })()}
          </tr>
          <tr>
            <th>Time</th>
            {pageRooms.map((room, idx) => <th key={idx}>{room}</th>)}
          </tr>
        </thead>
        <tbody>
          {timeSlots.map((slot, rowIndex) => (
            <tr key={slot.start24}>
              <td>{slot.label}</td>
              {pageRooms.map(room => {
                const key = `${date}-${room}-${rowIndex}`;
                if (occupiedCells[key]) return null;

                const examsInRoom = groupedData[`${date}-${room}`] || [];
                const exam = examsInRoom.find(e => {
                  if (!e.exam_start_time || !e.exam_end_time) return false;
                  const [sh, sm] = e.exam_start_time.slice(11, 16).split(':').map(Number);
                  const [eh, em] = e.exam_end_time.slice(11, 16).split(':').map(Number);
                  const eS = sh * 60 + sm, eE = eh * 60 + em;
                  const [sH, sM] = slot.start24.split(':').map(Number);
                  const [eH, eM] = slot.end24.split(':').map(Number);
                  return eS < eH * 60 + eM && eE > sH * 60 + sM;
                });

                if (!exam) return (
                  <td key={room} style={{ background: '#f5f5f5', minHeight: 52 }}></td>
                );

                const [sh, sm] = exam.exam_start_time!.slice(11, 16).split(':').map(Number);
                const [eh, em] = exam.exam_end_time!.slice(11, 16).split(':').map(Number);
                const startMinutes = sh * 60 + sm, endMinutes = eh * 60 + em;

                const startSlotIndex = timeSlots.findIndex(s => {
                  const [h, m] = s.start24.split(':').map(Number);
                  const [h2, m2] = s.end24.split(':').map(Number);
                  return startMinutes >= h * 60 + m && startMinutes < h2 * 60 + m2;
                });

                const rowSpan = Math.ceil((endMinutes - startMinutes) / 30);
                for (let i = 0; i < rowSpan; i++) {
                  if (startSlotIndex + i < timeSlots.length) {
                    occupiedCells[`${date}-${room}-${startSlotIndex + i}`] = true;
                  }
                }

                return (
                  <td key={room} rowSpan={rowSpan}>
                    {renderExamCard(exam)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────
  // LOADING
  // ─────────────────────────────────────────────────────────────────────────
  if (isLoadingData) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontSize: 24, color: '#092C4C' }}>
        Please wait...
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // NOT APPROVED SCREEN
  // ─────────────────────────────────────────────────────────────────────────
  if (approvalStatus !== 'approved') {
    const isPending = approvalStatus === 'pending';
    const isRejected = approvalStatus === 'rejected';

    return (
      <div style={{ position: "relative", width: "100%", overflow: "visible" }}>
        <div className="scheduler-view-card" style={{
          minWidth: "100%", maxWidth: 1400,
          boxShadow: "0 8px 20px rgba(0,0,0,0.3)", borderRadius: 12,
          background: "#f9f9f9", margin: "16px auto", padding: 15,
          transform: "scale(0.9)", transformOrigin: "top center",
        }}>
          <div className="scheduler-view-container">
            <ScheduleHeader />
            <hr />
            {/* Status card */}
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', padding: '80px 20px', gap: 24,
            }}>
              {/* Icon ring */}
              <div style={{
                width: 80, height: 80, borderRadius: '50%',
                background: isPending ? '#fff3e0' : isRejected ? '#ffebee' : '#f5f5f5',
                border: `3px solid ${isPending ? '#fb923c' : isRejected ? '#ef4444' : '#d1d5db'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {isPending ? (
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#fb923c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <polyline points="12 6 12 12 16 14"/>
                  </svg>
                ) : isRejected ? (
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
                  </svg>
                ) : (
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                )}
              </div>

              <div style={{ textAlign: 'center', maxWidth: 480 }}>
                <h3 style={{
                  margin: '0 0 10px',
                  fontSize: 20, fontWeight: 700,
                  color: isPending ? '#c2410c' : isRejected ? '#b91c1c' : '#6b7280',
                  fontFamily: 'var(--font)',
                }}>
                  {isPending ? 'Schedule Pending Approval' : isRejected ? 'Schedule Rejected' : 'No Schedule Available'}
                </h3>
                <p style={{
                  margin: 0, fontSize: 14, lineHeight: 1.6,
                  color: '#6b7280', fontFamily: 'var(--font)',
                }}>
                  {isPending
                    ? 'Your exam schedule is currently awaiting approval from the dean. You will be notified once it is approved.'
                    : isRejected
                      ? 'The exam schedule was rejected. Please contact your scheduler for further instructions.'
                      : 'No approved exam schedule has been published yet. Check back later.'}
                </p>
              </div>

              {/* Status pill */}
              <div style={{
                padding: '6px 20px', borderRadius: 999, fontSize: 12, fontWeight: 700,
                fontFamily: 'var(--mono)', letterSpacing: '0.06em',
                background: isPending ? '#fff3e0' : isRejected ? '#ffebee' : '#f3f4f6',
                color: isPending ? '#c2410c' : isRejected ? '#b91c1c' : '#6b7280',
                border: `1.5px solid ${isPending ? '#fb923c' : isRejected ? '#ef4444' : '#d1d5db'}`,
              }}>
                {isPending ? ' PENDING' : isRejected ? ' REJECTED' : 'NOT PUBLISHED'}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MAIN VIEW
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ position: "relative", width: "100%", overflow: "visible" }}>

      {/* ── TOP NAV BAR (matches S_ExamViewer pill style) ── */}
      <div className="scheduler-top-card">

        {/* View mode toggle */}
        <div style={{ display: 'flex', gap: 2, background: 'rgba(255,255,255,0.1)', borderRadius: 999, padding: 3 }}>
          {(['my-schedule', 'all-schedule'] as const).map(mode => (
            <button
              key={mode}
              type="button"
              onClick={() => { setViewMode(mode); setPage(0); }}
              style={{
                padding: '6px 14px',
                borderRadius: 999,
                border: 'none',
                background: viewMode === mode ? '#fff' : 'transparent',
                color: viewMode === mode ? 'var(--brand)' : 'rgba(255,255,255,0.75)',
                fontFamily: 'var(--font)',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                whiteSpace: 'nowrap',
              }}
            >
              {mode === 'my-schedule' ? 'My Schedule' : 'All College'}
            </button>
          ))}
        </div>

        <div className="nav-divider" />

        {/* Filter dropdown — matches scheduler style */}
        <div className={`nav-filter-wrap ${filterMenuOpen ? "open" : ""}`} ref={filterRef}>
          <button
            type="button"
            className={`nav-filter-btn ${filterMenuOpen ? "open" : ""}`}
            onClick={() => setFilterMenuOpen(v => !v)}
          >
            {selectedFilter === "all"
              ? "All Dates"
              : (() => {
                  const parts = selectedFilter.split("|");
                  return parts[parts.length - 1]?.trim() || selectedFilter;
                })()
            }
            <svg className="chevron" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

          <div className="nav-filter-menu">
            <div
              className={`nav-filter-option ${selectedFilter === "all" ? "selected" : ""}`}
              onClick={() => { setSelectedFilter("all"); setPage(0); setFilterMenuOpen(false); }}
            >
              <span className="opt-dot" /> All Dates
            </div>
            {getFilterOptions().length > 0 && <div className="nav-filter-divider" />}
            {getFilterOptions().map((option, idx) => {
              const parts = option.split("|").map(s => s.trim());
              const label = parts.length >= 3 ? `${parts[0]} · ${parts[2]}` : option;
              return (
                <div
                  key={idx}
                  className={`nav-filter-option ${selectedFilter === option ? "selected" : ""}`}
                  onClick={() => { setSelectedFilter(option); setPage(0); setFilterMenuOpen(false); }}
                >
                  <span className="opt-dot" /> {label}
                </div>
              );
            })}
          </div>
        </div>

        <div className="nav-divider" />

        {/* Search bar — matches scheduler style */}
        <div className="nav-search-wrap">
          <svg className="nav-search-icon" viewBox="0 0 16 16" fill="currentColor"
            style={{ width: 13, height: 13, flexShrink: 0, color: 'rgba(255,255,255,0.4)', marginRight: 2 }}>
            <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.099zm-5.242 1.156a5.5 5.5 0 1 1 0-11 5.5 5.5 0 0 1 0 11z"/>
          </svg>
          <input
            ref={searchInputRef}
            type="text"
            value={searchTerm}
            onChange={e => { setSearchTerm(e.target.value); setPage(0); }}
            placeholder="Search…"
          />
          {searchTerm && (
            <button type="button" className="nav-search-btn"
              onClick={() => { setSearchTerm(""); setPage(0); }} title="Clear">
              ✕
            </button>
          )}
        </div>

        {/* My-schedule legend pill */}
        {viewMode === 'all-schedule' && (
          <>
            <div className="nav-divider" />
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '4px 12px', borderRadius: 999,
              background: 'rgba(74,222,128,0.15)',
              border: '1px solid rgba(74,222,128,0.4)',
            }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ade80', flexShrink: 0 }} />
              <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.85)', fontFamily: 'var(--mono)', whiteSpace: 'nowrap' }}>
                My exams
              </span>
            </div>
          </>
        )}
      </div>

      {/* Nav arrows */}
      {hasData && page > 0 && (
        <button type="button" className="scheduler-nav-button scheduler-nav-button-left" onClick={() => setPage(page - 1)}>
          <FaChevronLeft style={{ fontSize: "3rem" }} />
        </button>
      )}
      {hasData && page < totalPages - 1 && (
        <button type="button" className="scheduler-nav-button scheduler-nav-button-right" onClick={() => setPage(page + 1)}>
          <FaChevronRight style={{ fontSize: "3rem" }} />
        </button>
      )}

      {/* Card slider */}
      <div className="scheduler-view-card-wrapper" style={{
        display: "flex",
        transition: "transform 0.5s ease",
        transform: hasData ? `translateX(-${page * 100}%)` : "none",
      }}>
        {!hasData ? (
          <div className="scheduler-view-card" style={{
            minWidth: "100%", maxWidth: 1400, boxShadow: "0 8px 20px rgba(0,0,0,0.3)",
            borderRadius: 12, background: "#f9f9f9", margin: "16px auto", padding: 15,
            transform: "scale(0.9)", transformOrigin: "top center",
          }}>
            <div className="scheduler-view-container">
              <ScheduleHeader />
              <hr />
              <div style={{ textAlign: 'center', padding: '100px 20px', fontSize: 22, color: '#999', fontFamily: 'serif' }}>
                {viewMode === "my-schedule"
                  ? "No exams assigned to you yet"
                  : selectedFilter === "all" ? "No schedules available" : "No schedules found for selected filter"}
              </div>
            </div>
          </div>
        ) : (
          uniqueDates.flatMap(date => {
            const dateExams = searchFilteredData.filter(e => e.exam_date === date);
            const dateRooms = Array.from(new Set(dateExams.map(e => e.room_id).filter(Boolean)))
              .sort((a, b) => {
                const nA = Number(a), nB = Number(b);
                return !isNaN(nA) && !isNaN(nB) ? nA - nB : String(a).localeCompare(String(b), undefined, { numeric: true });
              });
            const dateTotalPages = Math.max(1, Math.ceil(dateRooms.length / maxRoomColumns));

            return Array.from({ length: dateTotalPages }).map((_, p) => {
              const pageRooms = dateRooms.slice(p * maxRoomColumns, (p + 1) * maxRoomColumns);
              return (
                <div key={`${date}-${p}`} className="scheduler-view-card" style={{
                  minWidth: "100%", maxWidth: 1400, boxShadow: "0 8px 20px rgba(0,0,0,0.3)",
                  borderRadius: 12, background: "#f9f9f9", margin: "16px auto", padding: 15,
                  transform: "scale(0.8)", transformOrigin: "top center",
                }}>
                  <div className="scheduler-view-container">
                    <ScheduleHeader />
                    <hr />
                    {renderTable(date, pageRooms, dateExams)}
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