import { useState, useEffect } from 'react';
import '../styles/P_ProctorAssignedExams.css';
import { api } from '../lib/apiClient.ts';
import { FaCheckCircle, FaClock, FaChevronDown, FaChevronUp, FaCalendarAlt, FaListUl } from 'react-icons/fa';

interface ProctorAssignment {
  assignment_id: number;
  course_id: string;
  section: string;
  exam_date: string;
  exam_start_time: string;
  exam_end_time: string;
  room_id: string;
  building: string;
  instructor: string;
  examdetails_status: string;
  is_history?: boolean;
}

interface ExamPeriod {
  examperiod_id: number;
  start_date: string;
  end_date: string;
  academic_year: string;
  exam_category: string;
  term_id: number | null;
  term_name: string;
  college_id: string | null;
  college_name: string;
}

interface Term {
  term_id: number;
  term_name: string;
}

interface ProctorCourseDetailsProps {
  user: {
    user_id: number;
    first_name?: string;
    last_name?: string;
    college_id?: string;
    [key: string]: any;
  } | null;
}

const ProctorCourseDetails = ({ user }: ProctorCourseDetailsProps) => {
  const [assignments, setAssignments]         = useState<ProctorAssignment[]>([]);
  const [historyRecords, setHistoryRecords]   = useState<ProctorAssignment[]>([]);
  const [_loading, setLoading]                = useState(true);
  const [filter, setFilter]                   = useState<'all' | 'upcoming' | 'ongoing' | 'completed'>('upcoming');
  const [expandedCard, setExpandedCard]       = useState<number | null>(null);
  const [showSidebar, setShowSidebar]         = useState(true);

  // Sidebar: exam dates for user's college
  const [examPeriods, setExamPeriods]         = useState<ExamPeriod[]>([]);
  const [termMap, setTermMap]                 = useState<Record<string, string>>({});
  const [userCollege, setUserCollege]         = useState<string | null>(null);

  // ── Fetch user's college ─────────────────────────────────────────────
  useEffect(() => {
    const resolveCollege = async () => {
      if (!user?.user_id) return;

      // Try from user object first
      if (user.college_id) { setUserCollege(user.college_id); return; }

      try {
        const { data: roles } = await api.get(`/tbl_user_role`, { params: { user_id: user.user_id } });
        const roleWithCollege = roles?.find((r: any) => r.college_id || r.college);
        if (roleWithCollege) {
          setUserCollege(roleWithCollege.college_id || roleWithCollege.college);
          return;
        }
        // Fallback: fetch user profile
        const { data: userData } = await api.get(`/tbl_users/${user.user_id}`);
        if (userData?.college_id) setUserCollege(userData.college_id);
      } catch (err) {
        console.error('Error resolving college:', err);
      }
    };
    resolveCollege();
  }, [user?.user_id]);

  // ── Fetch exam periods & terms ───────────────────────────────────────
  useEffect(() => {
    const fetchExamData = async () => {
      try {
        const [{ data: examData }, { data: termData }] = await Promise.all([
          api.get<ExamPeriod[]>('/tbl_examperiod'),
          api.get<Term[]>('/tbl_term'),
        ]);
        if (examData) setExamPeriods(examData);
        if (termData) {
          const map: Record<string, string> = {};
          termData.forEach((t) => (map[t.term_id] = t.term_name));
          setTermMap(map);
        }
      } catch (err) {
        console.error('Error fetching exam periods:', err);
      }
    };
    fetchExamData();
    const id = setInterval(fetchExamData, 30000);
    return () => clearInterval(id);
  }, []);

  // ── Fetch proctor assignments ────────────────────────────────────────
  useEffect(() => {
    const fetchProctorAssignments = async () => {
      if (!user?.user_id) return;
      try {
        setLoading(true);
        const response = await api.get(`/proctor-assigned-exams/${user.user_id}/`);

        const upcoming  = Array.isArray(response.data?.upcoming)  ? response.data.upcoming  : [];
        const ongoing   = Array.isArray(response.data?.ongoing)   ? response.data.ongoing   : [];
        const completed = Array.isArray(response.data?.completed) ? response.data.completed : [];

        const mapExam = (exam: any, isHistory = false): ProctorAssignment => ({
          assignment_id:      exam.id,
          course_id:          exam.course_id,
          section:            exam.section_name || 'N/A',
          exam_date:          exam.exam_date,
          exam_start_time:    exam.exam_start_time,
          exam_end_time:      exam.exam_end_time,
          room_id:            exam.room_id,
          building:           exam.building_name || 'N/A',
          instructor:         exam.instructor_name || 'N/A',
          examdetails_status: exam.status || 'pending',
          is_history:         isHistory,
        });

        const combined: ProctorAssignment[] = [
          ...upcoming.map((e: any)  => mapExam(e, false)),
          ...ongoing.map((e: any)   => mapExam(e, false)),
          ...completed.map((e: any) => mapExam(e, true)),
        ].sort((a, b) =>
          new Date(`${a.exam_date} ${a.exam_start_time}`).getTime() -
          new Date(`${b.exam_date} ${b.exam_start_time}`).getTime()
        );

        setAssignments(combined);
        setHistoryRecords([]);
      } catch (err) {
        console.error('❌ Error fetching proctor assignments:', err);
        setAssignments([]);
        setHistoryRecords([]);
      } finally {
        setLoading(false);
      }
    };

    fetchProctorAssignments();
    const interval = setInterval(fetchProctorAssignments, 30000);
    return () => clearInterval(interval);
  }, [user?.user_id]);

  // ── Helpers ──────────────────────────────────────────────────────────
  const isExamOngoing = (examDate: string, startTime: string, endTime: string) => {
    try {
      const now = new Date();
      const examDateObj = new Date(examDate);
      const isSameDay =
        now.getFullYear() === examDateObj.getFullYear() &&
        now.getMonth()    === examDateObj.getMonth() &&
        now.getDate()     === examDateObj.getDate();
      if (!isSameDay) return false;
      const currentTime = now.getTime();
      return currentTime >= new Date(startTime).getTime() && currentTime <= new Date(endTime).getTime();
    } catch { return false; }
  };

  const now = new Date();
  const allRecords = [...assignments, ...historyRecords];

  const filteredAssignments = allRecords.filter((assign) => {
    const examStartTime = new Date(assign.exam_start_time);
    const examEndTime   = new Date(assign.exam_end_time);
    const isOngoing     = isExamOngoing(assign.exam_date, assign.exam_start_time, assign.exam_end_time);
    const backendStatus = (assign.examdetails_status || 'pending').toLowerCase().trim();
    const hasCheckedIn  = ['present','late','substitute','confirmed','absent'].some(s => backendStatus.includes(s));
    const isHistoryRecord = assign.is_history === true;

    if (filter === 'upcoming')  return examStartTime > now && !isHistoryRecord;
    if (filter === 'ongoing')   return isOngoing && !hasCheckedIn && !isHistoryRecord;
    if (filter === 'completed') return hasCheckedIn || examEndTime < now || isHistoryRecord;
    return true;
  });

  const upcomingCount  = allRecords.filter(a => !a.is_history && new Date(a.exam_start_time) > now).length;
  const ongoingCount   = allRecords.filter(a => {
    const isOngoing = isExamOngoing(a.exam_date, a.exam_start_time, a.exam_end_time);
    const status    = (a.examdetails_status || '').toLowerCase();
    const checkedIn = ['present','late','substitute'].some(s => status.includes(s));
    return isOngoing && !checkedIn && !a.is_history;
  }).length;
  const completedCount = allRecords.filter(a => {
    const status    = (a.examdetails_status || '').toLowerCase();
    const checkedIn = ['present','late','substitute','confirmed','absent'].some(s => status.includes(s));
    return checkedIn || new Date(a.exam_end_time) < now || a.is_history;
  }).length;

  const formatDateFull = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  const formatTime = (timeStr: string) => {
    const [hours, minutes] = timeStr.slice(11, 16).split(':');
    const hour = parseInt(hours, 10);
    return `${hour % 12 || 12}:${minutes} ${hour >= 12 ? 'PM' : 'AM'}`;
  };

  const getDuration = (startTime: string, endTime: string) => {
    const minutes = Math.round(
      (new Date(`2000-01-01T${endTime.slice(11)}`).getTime() -
       new Date(`2000-01-01T${startTime.slice(11)}`).getTime()) / 60000
    );
    const h = Math.floor(minutes / 60), m = minutes % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  // ── Sidebar: upcoming exam dates for user's college ─────────────────
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const collegeExamDates = examPeriods
    .filter((ep) => {
      const d = new Date(ep.start_date);
      if (d < todayMidnight) return false;
      // Match by college_id or college_name (case-insensitive)
      if (!userCollege) return true; // show all if college unknown
      return (
        (ep.college_id   && ep.college_id.toLowerCase()   === userCollege.toLowerCase()) ||
        (ep.college_name && ep.college_name.toLowerCase() === userCollege.toLowerCase())
      );
    })
    .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());

  // Group by date
  const collegeExamsByDate = collegeExamDates.reduce<Record<string, ExamPeriod[]>>((acc, ep) => {
    const key = new Date(ep.start_date).toDateString();
    if (!acc[key]) acc[key] = [];
    acc[key].push(ep);
    return acc;
  }, {});

  // Upcoming assigned proctoring (next 5)
  const upcomingAssigned = allRecords
    .filter(a => !a.is_history && new Date(a.exam_start_time) > now)
    .slice(0, 5);

  // ── Render ───────────────────────────────────────────────────────────
  return (
    <div className="proctor-course-container" style={{ flexDirection: 'row', gap: 0, padding: 0, overflow: 'hidden' }}>

      {/* ── Main panel ────────────────────────────────────────────────── */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', padding: '24px', overflow: 'hidden' }}>

        <div className="proctor-course-header">
          <div className="header-title">
            <h3>Assigned Proctoring</h3>
            <p className="total-assignments">{allRecords.length} total sections</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div className="filter-buttons">
              <button type="button" className={`filter-btn ${filter === 'upcoming'  ? 'active' : ''}`} onClick={() => setFilter('upcoming')}>
                <FaClock size={12} /> Upcoming ({upcomingCount})
              </button>
              <button type="button" className={`filter-btn ${filter === 'ongoing'   ? 'active' : ''}`} onClick={() => setFilter('ongoing')}>
                <FaClock size={12} /> On-going ({ongoingCount})
              </button>
              <button type="button" className={`filter-btn ${filter === 'completed' ? 'active' : ''}`} onClick={() => setFilter('completed')}>
                <FaCheckCircle size={12} /> Completed ({completedCount})
              </button>
              <button type="button" className={`filter-btn ${filter === 'all'       ? 'active' : ''}`} onClick={() => setFilter('all')}>
                All ({allRecords.length})
              </button>
            </div>
            {/* Sidebar toggle */}
            <button
              type="button"
              className={`filter-btn ${showSidebar ? 'active' : ''}`}
              onClick={() => setShowSidebar(v => !v)}
              title="Toggle upcoming panel"
              style={{ whiteSpace: 'nowrap' }}
            >
              <FaListUl size={11} />
              {showSidebar ? 'Hide' : 'Upcoming'}
            </button>
          </div>
        </div>

        {filteredAssignments.length === 0 ? (
          <div className="empty-message">
            <p>
              {filter === 'all'
                ? 'No proctoring assignments yet'
                : filter === 'ongoing'
                  ? 'No on-going exams'
                  : `No ${filter} proctoring assignments`}
            </p>
          </div>
        ) : (
          <div className="courses-list" style={{ maxHeight: '320px', overflowY: 'auto', paddingRight: '4px' }}>
            {filteredAssignments.map((assign) => {
              const examStartTime = new Date(assign.exam_start_time);
              const examEndTime   = new Date(assign.exam_end_time);
              const isOngoing     = isExamOngoing(assign.exam_date, assign.exam_start_time, assign.exam_end_time);
              const backendStatus = (assign.examdetails_status || 'pending').toLowerCase().trim();
              const hasCheckedIn  = ['present','late','substitute','confirmed','absent'].some(s => backendStatus.includes(s));
              const isUpcoming    = examStartTime > now;
              const isCompleted   = hasCheckedIn || examEndTime < now || assign.is_history === true;
              const isExpanded    = expandedCard === assign.assignment_id;
              const duration      = getDuration(assign.exam_start_time, assign.exam_end_time);

              let displayStatus = 'Upcoming', statusClass = 'upcoming-badge';
              if (isCompleted) {
                if (backendStatus.includes('confirmed') || backendStatus.includes('present')) { displayStatus = 'Present';    statusClass = 'completed-badge'; }
                else if (backendStatus.includes('late'))       { displayStatus = 'Late';       statusClass = 'late-badge'; }
                else if (backendStatus.includes('substitute')) { displayStatus = 'Substitute'; statusClass = 'substitute-badge'; }
                else if (backendStatus.includes('absent'))     { displayStatus = 'Absent';     statusClass = 'absent-badge'; }
                else                                           { displayStatus = 'Completed';  statusClass = 'completed-badge'; }
              } else if (isOngoing)  { displayStatus = 'On-going'; statusClass = 'ongoing-badge'; }
              else if (isUpcoming)   { displayStatus = 'Upcoming'; statusClass = 'upcoming-badge'; }

              return (
                <div
                  key={`${assign.assignment_id}-${assign.is_history ? 'history' : 'current'}`}
                  className={`course-card ${isCompleted ? 'completed' : isOngoing ? 'ongoing' : 'upcoming'} ${isExpanded ? 'expanded' : ''}`}
                >
                  <div
                    className="course-card-header"
                    onClick={() => setExpandedCard(isExpanded ? null : assign.assignment_id)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="course-card-left">
                      <div className="course-code-badge">{assign.course_id}</div>
                      <div className="course-card-main">
                        <p className="course-title">{assign.section}</p>
                        <p className="course-instructor">{assign.instructor}</p>
                        <div className="course-preview-info">
                          <div className="preview-row">
                            <span className="preview-label">Date:</span>
                            <span className="preview-value">{formatDateFull(assign.exam_date)}</span>
                          </div>
                          <div className="preview-row">
                            <span className="preview-label">Time:</span>
                            <span className="preview-value">
                              {formatTime(assign.exam_start_time)} – {formatTime(assign.exam_end_time)}
                              <span className="duration">({duration})</span>
                            </span>
                          </div>
                          <div className="preview-row">
                            <span className="preview-label">Location:</span>
                            <span className="preview-value">{assign.building} – Room {assign.room_id}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="course-card-right">
                      <span className={`status-badge ${statusClass}`}>{displayStatus}</span>
                      <button type="button" className="expand-btn" aria-label="Toggle details">
                        {isExpanded ? <FaChevronUp size={16} /> : <FaChevronDown size={16} />}
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="course-card-details">
                      <div className="detail-section">
                        <h4>Exam Information</h4>
                        <div className="detail-row">
                          <span className="detail-label">Date:</span>
                          <span className="detail-value">{formatDateFull(assign.exam_date)}</span>
                        </div>
                        <div className="detail-row">
                          <span className="detail-label">Time:</span>
                          <span className="detail-value">
                            {formatTime(assign.exam_start_time)} – {formatTime(assign.exam_end_time)}
                            <span className="duration">({duration})</span>
                          </span>
                        </div>
                      </div>
                      <div className="detail-section">
                        <h4>Location</h4>
                        <div className="detail-row">
                          <span className="detail-label">Building:</span>
                          <span className="detail-value">{assign.building}</span>
                        </div>
                        <div className="detail-row">
                          <span className="detail-label">Room:</span>
                          <span className="detail-value">{assign.room_id}</span>
                        </div>
                      </div>
                      <div className="detail-section">
                        <h4>Class Details</h4>
                        <div className="detail-row">
                          <span className="detail-label">Section:</span>
                          <span className="detail-value">{assign.section}</span>
                        </div>
                        <div className="detail-row">
                          <span className="detail-label">Instructor:</span>
                          <span className="detail-value">{assign.instructor}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Right Sidebar ─────────────────────────────────────────────── */}
      {showSidebar && (
        <aside style={{
          width: 220,
          flexShrink: 0,
          borderLeft: '1.5px solid #f0f0f0',
          background: '#fafbfc',
          display: 'flex',
          flexDirection: 'column',
          gap: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
        }}>

          {/* ── Upcoming exam dates for user's college ── */}
          <div style={{ padding: '16px 14px 10px', borderBottom: '1.5px solid #f0f0f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <FaCalendarAlt style={{ color: '#092C4C', fontSize: 12, flexShrink: 0 }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#092C4C' }}>
                Exam Dates
              </span>
              {userCollege && (
                <span style={{
                  background: '#092C4C', color: '#fff',
                  borderRadius: 20, padding: '1px 7px',
                  fontSize: 10, fontWeight: 700, fontFamily: 'monospace',
                }}>
                  {userCollege}
                </span>
              )}
            </div>

            {Object.keys(collegeExamsByDate).length === 0 ? (
              <p style={{ fontSize: 11, color: '#9ca3af', textAlign: 'center', padding: '12px 0', fontStyle: 'italic', margin: 0 }}>
                No upcoming exam dates
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {Object.entries(collegeExamsByDate).slice(0, 6).map(([dateStr, eps]) => {
                  const d = new Date(dateStr);
                  const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                  const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
                  const isThisWeek = (d.getTime() - now.getTime()) < 7 * 24 * 60 * 60 * 1000;

                  return (
                    <div key={dateStr} style={{
                      background: '#fff',
                      border: `1.5px solid ${isThisWeek ? '#F2994A' : '#e5e7eb'}`,
                      borderRadius: 8,
                      padding: '8px 10px',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: isThisWeek ? '#F2994A' : '#374151', fontFamily: 'monospace' }}>
                          {dayName}, {label}
                        </span>
                        {isThisWeek && (
                          <span style={{
                            fontSize: 9, fontWeight: 700, background: '#FEF3C7', color: '#D97706',
                            borderRadius: 20, padding: '1px 6px', fontFamily: 'monospace',
                          }}>
                            SOON
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: '#111', fontWeight: 600 }}>
                        {eps[0].exam_category} Exam
                      </div>
                      <div style={{ fontSize: 10, color: '#6b7280', marginTop: 2, fontFamily: 'monospace' }}>
                        {termMap[String(eps[0].term_id)] || eps[0].term_name || 'Unknown Term'}
                        {eps[0].academic_year ? ` · ${eps[0].academic_year}` : ''}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Upcoming assigned proctoring ── */}
          <div style={{ padding: '14px 14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <FaClock style={{ color: '#092C4C', fontSize: 12, flexShrink: 0 }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#092C4C' }}>My Schedule</span>
              <span style={{
                background: '#f4f6f9', color: '#6b7280',
                borderRadius: 20, padding: '1px 7px',
                fontSize: 10, fontFamily: 'monospace',
              }}>
                {upcomingCount}
              </span>
            </div>

            {upcomingAssigned.length === 0 ? (
              <p style={{ fontSize: 11, color: '#9ca3af', textAlign: 'center', padding: '12px 0', fontStyle: 'italic', margin: 0 }}>
                No upcoming assignments
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {upcomingAssigned.map((assign) => {
                  const d = new Date(assign.exam_date);
                  const label   = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                  const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
                  const isThisWeek = (new Date(assign.exam_start_time).getTime() - now.getTime()) < 7 * 24 * 60 * 60 * 1000;

                  return (
                    <div key={assign.assignment_id} style={{
                      background: '#fff',
                      border: `1.5px solid ${isThisWeek ? '#F59E0B' : '#e5e7eb'}`,
                      borderLeft: `3px solid ${isThisWeek ? '#F59E0B' : '#092C4C'}`,
                      borderRadius: 8,
                      padding: '8px 10px',
                    }}>
                      <div style={{ fontSize: 10, color: '#6b7280', fontFamily: 'monospace', marginBottom: 2 }}>
                        {dayName}, {label}
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>
                        {assign.course_id}
                      </div>
                      <div style={{ fontSize: 11, color: '#6b7280', marginTop: 1 }}>
                        {assign.section}
                      </div>
                      <div style={{ fontSize: 10, color: '#9ca3af', fontFamily: 'monospace', marginTop: 3 }}>
                        {formatTime(assign.exam_start_time)} · {assign.building}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </aside>
      )}
    </div>
  );
};

export default ProctorCourseDetails;