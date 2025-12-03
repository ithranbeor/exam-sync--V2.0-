import { useState, useEffect } from 'react';
import '../styles/ProctorViewExam.css';
import { api } from '../lib/apiClient.ts';
import { FaChevronLeft, FaChevronRight, FaHistory, FaCalendarAlt, FaFilter } from 'react-icons/fa';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

interface ExamSchedule {
  examdetails_id: number;
  course_id: string;
  sections?: string[];
  section_name?: string;
  exam_date: string;
  exam_start_time: string;
  exam_end_time: string;
  room_id: string;
  building_name: string;
  instructors?: number[];
  instructor_id?: number;
  proctors?: number[];
  proctor_id?: number;
  status: string;
  college_name: string;
  academic_year?: string;
  semester?: string;
  exam_period?: string;
  exam_category?: string;
}

interface ProctorViewExamProps {
  user: {
    user_id: number;
    email_address: string;
    first_name?: string;
    last_name?: string;
  } | null;
}

const ProctorViewExam: React.FC<ProctorViewExamProps> = ({ user }) => {
  const [schedules, setSchedules] = useState<ExamSchedule[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [scheduleFilter, setScheduleFilter] = useState<'my-schedule' | 'all-college'>('my-schedule');
  const [showHistory, setShowHistory] = useState(false);
  const [proctorCollege, setProctorCollege] = useState<string>('');
  const [approvalStatus, setApprovalStatus] = useState<'approved' | 'pending' | 'rejected' | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");

  const maxRoomColumns = 5;

  useEffect(() => {
    const fetchProctorCollege = async () => {
      if (!user?.user_id) return;

      try {
        const rolesResponse = await api.get('/tbl_user_role', {
          params: {
            user_id: user.user_id,
            role_id: 5
          }
        });

        if (rolesResponse.data && rolesResponse.data.length > 0) {
          const proctorRole = rolesResponse.data[0];
          if (proctorRole.college_id) {
            const collegeResponse = await api.get(`/tbl_college/${proctorRole.college_id}/`);
            setProctorCollege(collegeResponse.data?.college_name || '');
          }
        }
      } catch (err) {
        console.error('Error fetching proctor college:', err);
      }
    };

    fetchProctorCollege();
  }, [user]);

  useEffect(() => {
    const checkApprovalStatus = async () => {
      if (!proctorCollege) return;

      try {
        const response = await api.get('/tbl_scheduleapproval/', {
          params: {
            college_name: proctorCollege,
            status: 'approved'
          }
        });

        if (response.data && response.data.length > 0) {
          setApprovalStatus('approved');
        } else {
          setApprovalStatus(null);
        }
      } catch (error) {
        console.error('Error checking approval status:', error);
        setApprovalStatus(null);
      }
    };

    checkApprovalStatus();
    const interval = setInterval(checkApprovalStatus, 10000);
    return () => clearInterval(interval);
  }, [proctorCollege]);

  useEffect(() => {
    const fetchSchedules = async () => {
      if (!user?.user_id) return;

      try {
        setLoading(true);

        const usersResponse = await api.get('/users/');
        setAllUsers(usersResponse.data || []);

        let schedulesData: ExamSchedule[] = [];

        if (scheduleFilter === 'my-schedule') {
          const { data } = await api.get('/tbl_examdetails', {
            params: {
              proctor_id: user.user_id
            }
          });
          schedulesData = data || [];
        } else if (scheduleFilter === 'all-college' && approvalStatus === 'approved') {
          const { data } = await api.get('/tbl_examdetails', {
            params: {
              college_name: proctorCollege
            }
          });
          schedulesData = data || [];
        }

        if (!showHistory) {
          const today = new Date().toISOString().split('T')[0];
          schedulesData = schedulesData.filter(s => s.exam_date >= today);
        }

        setSchedules(schedulesData);
      } catch (err) {
        console.error('Error fetching schedules:', err);
        setSchedules([]);
        toast.error('Failed to load schedules');
      } finally {
        setLoading(false);
      }
    };

    fetchSchedules();
  }, [user?.user_id, scheduleFilter, showHistory, proctorCollege, approvalStatus]);

  const getUserName = (id: number | null | undefined): string => {
    if (!id) return '-';
    const user = allUsers.find(u => u.user_id === id);
    return user ? `${user.first_name} ${user.last_name}` : '-';
  };

  const getSectionDisplay = (exam: ExamSchedule): string => {
    if (exam.sections && exam.sections.length > 0) {
      return exam.sections.join(', ');
    }
    return exam.section_name || 'N/A';
  };

  const getInstructorDisplay = (exam: ExamSchedule): string => {
    if (exam.instructors && exam.instructors.length > 0) {
      const names = exam.instructors.map(id => getUserName(id)).filter(n => n !== '-');
      return names.length > 0 ? names.join(', ') : '-';
    }
    return getUserName(exam.instructor_id);
  };

  const getProctorDisplay = (exam: ExamSchedule): string => {
    if (exam.proctors && exam.proctors.length > 1) {
      const names = exam.proctors.map(id => getUserName(id)).filter(n => n !== '-');
      return names.length > 0 ? names.join(', ') : 'Not Assigned';
    }
    if (exam.proctor_id) {
      return getUserName(exam.proctor_id);
    }
    if (exam.proctors && exam.proctors.length === 1) {
      return getUserName(exam.proctors[0]);
    }
    return 'Not Assigned';
  };

  const formatTo12Hour = (timeStr: string) => {
    const timeOnly = timeStr.slice(11, 16);
    const [hours, minutes] = timeOnly.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const generateCourseColors = (courses: string[]) => {
    const colors = [
      "#79b4f2", "#f27f79", "#79f2b4", "#f2e279", "#b479f2", "#f279d6",
      "#79d6f2", "#d6f279", "#f29979", "#a3f279", "#f279a3", "#79a3f2",
      "#f2c879", "#79f2e2", "#f2a879", "#b4f279", "#f27979", "#79f279",
    ];

    const courseColorMap: Record<string, string> = {};
    courses.forEach((course, idx) => {
      courseColorMap[course] = colors[idx % colors.length];
    });
    return courseColorMap;
  };

  const searchFilteredData = searchTerm.trim() === ""
    ? schedules
    : schedules.filter(exam => {
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
          exam.exam_date?.includes(searchTerm)
        );
      });

  const uniqueDates = Array.from(new Set(searchFilteredData.map((e) => e.exam_date))).filter(Boolean).sort();

  const rawTimes = [
    "07:00", "07:30", "08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
    "12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30",
    "17:00", "17:30", "18:00", "18:30", "19:00", "19:30", "20:00", "20:30", "21:00"
  ];

  const timeSlots = rawTimes.slice(0, -1).map((t, i) => ({
    start24: t,
    end24: rawTimes[i + 1],
    label: `${formatTo12Hour(`2000-01-01T${t}:00`)} - ${formatTo12Hour(`2000-01-01T${rawTimes[i + 1]}:00`)}`,
  }));

  const courseColorMap = generateCourseColors(
    Array.from(new Set(searchFilteredData.map(e => e.course_id).filter(Boolean)))
  );

  const hasData = searchFilteredData.length > 0;

  const collegeName = proctorCollege || "Loading...";
  const examPeriodName = schedules.find(e => e.exam_period)?.exam_period ?? "-";
  const termName = schedules.find(e => e.exam_category)?.exam_category ?? "-";
  const semesterName = schedules.find(e => e.semester)?.semester ?? "-";
  const yearName = schedules.find(e => e.academic_year)?.academic_year ?? "-";

  let totalPages = 1;
  if (hasData) {
    totalPages = uniqueDates.reduce((total, date) => {
      const dateExams = searchFilteredData.filter(e => e.exam_date === date);
      const dateRooms = Array.from(new Set(dateExams.map(e => e.room_id).filter(Boolean)));
      return total + Math.max(1, Math.ceil(dateRooms.length / maxRoomColumns));
    }, 0);
  }

  return (
    <div className="brandnew-proctor-container">
      <ToastContainer position="top-right" autoClose={3000} />
      
      <div className="brandnew-header-card">
        <div className="brandnew-title-section">
          <FaCalendarAlt className="brandnew-title-icon" />
          <h2 className="brandnew-main-title">Examination Schedule Viewer</h2>
        </div>
        {proctorCollege && (
          <p className="brandnew-college-name">{proctorCollege}</p>
        )}
        {approvalStatus === 'approved' && (
          <div className="brandnew-approval-badge">
            ✓ Approved Schedule Available
          </div>
        )}
      </div>

      <div className="brandnew-controls-bar">
        <div className="brandnew-filter-group">
          <FaFilter className="brandnew-filter-icon" />
          <select
            value={scheduleFilter}
            onChange={(e) => {
              setScheduleFilter(e.target.value as 'my-schedule' | 'all-college');
              setCurrentPage(0);
            }}
            className="brandnew-filter-select"
            disabled={!approvalStatus || approvalStatus !== 'approved'}
          >
            <option value="my-schedule">My Assigned Schedules</option>
            <option value="all-college">All College Schedules</option>
          </select>
        </div>

        <button
          type="button"
          className={`brandnew-history-btn ${showHistory ? 'active' : ''}`}
          onClick={() => {
            setShowHistory(!showHistory);
            setCurrentPage(0);
          }}
          title={showHistory ? 'Hide Past Schedules' : 'Show Past Schedules'}
        >
          {showHistory ? <FaCalendarAlt /> : <FaHistory />}
          {showHistory ? 'Current Only' : 'Show History'}
        </button>

        <div className="brandnew-search-box">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(0);
            }}
            placeholder="Search schedules..."
            className="brandnew-search-input"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm("");
                setCurrentPage(0);
              }}
              className="brandnew-clear-btn"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {hasData && currentPage > 0 && (
        <button
          type="button"
          className="brandnew-nav-button brandnew-nav-left"
          onClick={() => setCurrentPage(currentPage - 1)}
        >
          <FaChevronLeft />
        </button>
      )}

      {hasData && currentPage < totalPages - 1 && (
        <button
          type="button"
          className="brandnew-nav-button brandnew-nav-right"
          onClick={() => setCurrentPage(currentPage + 1)}
        >
          <FaChevronRight />
        </button>
      )}

      <div
        className="brandnew-schedule-wrapper"
        style={{
          display: "flex",
          transition: "transform 0.5s ease",
          transform: hasData ? `translateX(-${currentPage * 100}%)` : "none",
        }}
      >
        {loading ? (
          <div className="brandnew-loading-state">
            <div className="brandnew-spinner"></div>
            <p>Loading schedules...</p>
          </div>
        ) : !hasData ? (
          <div className="brandnew-empty-card">
            <div className="brandnew-schedule-container">
              <div className="brandnew-header-info">
                <img src="/logo/USTPlogo.png" alt="USTP Logo" className="brandnew-logo" />
                <div className="brandnew-school-name">University of Science and Technology of Southern Philippines</div>
                <div className="brandnew-school-campuses">Alubijid | Balubal | Cagayan de Oro City | Claveria | Jasaan | Oroquieta | Panaon | Villanueva</div>
                <div className="brandnew-college-title">{collegeName}</div>
                <div className="brandnew-exam-title">{termName} Examination Schedule | {semesterName} Semester | A.Y. {yearName}</div>
                <div className="brandnew-exam-period">{examPeriodName}</div>
              </div>
              <hr className="brandnew-divider" />
              <div className="brandnew-no-data-message">
                {scheduleFilter === 'all-college' && approvalStatus !== 'approved'
                  ? 'College schedules will be available once approved by the dean'
                  : showHistory
                  ? 'No schedule history found'
                  : 'No upcoming schedules found'}
              </div>
            </div>
          </div>
        ) : (
          uniqueDates.flatMap((date) => {
            const dateExams = searchFilteredData.filter(e => e.exam_date === date);
            const dateRooms = Array.from(new Set(dateExams.map(e => e.room_id).filter(Boolean))).sort();
            const dateTotalPages = Math.max(1, Math.ceil(dateRooms.length / maxRoomColumns));

            return Array.from({ length: dateTotalPages }).map((_, p) => {
              const pageRooms = dateRooms.slice(p * maxRoomColumns, (p + 1) * maxRoomColumns);
              const occupiedCells: Record<string, boolean> = {};
              const groupedData: Record<string, ExamSchedule[]> = {};
              
              dateExams.forEach((exam) => {
                if (!exam.room_id) return;
                const key = `${date}-${exam.room_id}`;
                if (!groupedData[key]) groupedData[key] = [];
                groupedData[key].push(exam);
              });

              return (
                <div key={`${date}-${p}`} className="brandnew-schedule-card">
                  <div className="brandnew-schedule-container">
                    <div className="brandnew-header-info">
                      <img src="/logo/USTPlogo.png" alt="USTP Logo" className="brandnew-logo" />
                      <div className="brandnew-school-name">University of Science and Technology of Southern Philippines</div>
                      <div className="brandnew-school-campuses">Alubijid | Balubal | Cagayan de Oro City | Claveria | Jasaan | Oroquieta | Panaon | Villanueva</div>
                      <div className="brandnew-college-title">{collegeName}</div>
                      <div className="brandnew-exam-title">{termName} Examination Schedule | {semesterName} Semester | A.Y. {yearName}</div>
                      <div className="brandnew-exam-period">{examPeriodName}</div>
                    </div>
                    <hr className="brandnew-divider" />
                    
                    <table className="brandnew-exam-table">
                      <thead>
                        <tr>
                          <th colSpan={pageRooms.length + 1} className="brandnew-date-header">
                            {date && new Date(date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                          </th>
                        </tr>
                        <tr>
                          <th></th>
                          {(() => {
                            const buildingGroups: Record<string, string[]> = {};
                            pageRooms.forEach((room) => {
                              const building = dateExams.find(e => e.room_id === room)?.building_name || "Unknown Building";
                              if (!buildingGroups[building]) buildingGroups[building] = [];
                              buildingGroups[building].push(String(room));
                            });
                            return Object.entries(buildingGroups).map(([building, rooms]) => (
                              <th key={building} colSpan={rooms.length} className="brandnew-building-header">{building}</th>
                            ));
                          })()}
                        </tr>
                        <tr>
                          <th className="brandnew-time-header">Time</th>
                          {pageRooms.map((room, idx) => (
                            <th key={idx} className="brandnew-room-header">{room}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {timeSlots.map((slot, rowIndex) => (
                          <tr key={slot.start24}>
                            <td className="brandnew-time-cell">{slot.label}</td>
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

                              if (!exam) return <td key={room} className="brandnew-empty-cell"></td>;

                              const examStartTimeStr = exam.exam_start_time!.slice(11, 16);
                              const examEndTimeStr = exam.exam_end_time!.slice(11, 16);
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

                              const isMySchedule = exam.proctor_id === user?.user_id || 
                                (exam.proctors && exam.proctors.includes(user?.user_id || 0));

                              return (
                                <td key={room} rowSpan={rowSpan} className="brandnew-schedule-cell">
                                  <div
                                    className={`brandnew-exam-content ${isMySchedule ? 'my-schedule' : ''}`}
                                    style={{
                                      backgroundColor: courseColorMap[exam.course_id || ""] || "#ccc",
                                      outline: searchTerm && (
                                        exam.course_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                        getSectionDisplay(exam).toLowerCase().includes(searchTerm.toLowerCase()) ||
                                        exam.room_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                        getInstructorDisplay(exam).toLowerCase().includes(searchTerm.toLowerCase()) ||
                                        getProctorDisplay(exam).toLowerCase().includes(searchTerm.toLowerCase())
                                      ) ? "3px solid yellow" : "none",
                                      boxShadow: searchTerm && (
                                        exam.course_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                        getSectionDisplay(exam).toLowerCase().includes(searchTerm.toLowerCase()) ||
                                        exam.room_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                        getInstructorDisplay(exam).toLowerCase().includes(searchTerm.toLowerCase()) ||
                                        getProctorDisplay(exam).toLowerCase().includes(searchTerm.toLowerCase())
                                      ) ? "0 0 15px 3px rgba(255, 255, 0, 0.8)" : "none"
                                    }}
                                  >
                                    <p className="brandnew-course-id"><strong>{exam.course_id}</strong></p>
                                    <p className="brandnew-section-info">{getSectionDisplay(exam)}</p>
                                    <p className="brandnew-instructor-info">Instructor: {getInstructorDisplay(exam)}</p>
                                    <p className="brandnew-proctor-info">Proctor: {getProctorDisplay(exam)}</p>
                                    <p className="brandnew-time-info">{formatTo12Hour(`2000-01-01T${examStartTimeStr}:00`)} - {formatTo12Hour(`2000-01-01T${examEndTimeStr}:00`)}</p>
                                    {isMySchedule && (
                                      <div className="brandnew-my-badge">★ My Schedule</div>
                                    )}
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
    </div>
  );
};

export default ProctorViewExam;