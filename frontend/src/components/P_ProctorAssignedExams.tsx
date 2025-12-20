import { useState, useEffect } from 'react';
import '../styles/P_ProctorAssignedExams.css';
import { api } from '../lib/apiClient.ts';
import { FaCheckCircle, FaClock, FaChevronDown, FaChevronUp } from 'react-icons/fa';

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

interface ProctorCourseDetailsProps {
  user: {
    user_id: number;
    first_name?: string;
    last_name?: string;
    [key: string]: any;
  } | null;
}

const ProctorCourseDetails = ({ user }: ProctorCourseDetailsProps) => {
  const [assignments, setAssignments] = useState<ProctorAssignment[]>([]);
  const [historyRecords, setHistoryRecords] = useState<ProctorAssignment[]>([]);
  const [_loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'ongoing' | 'completed'>('upcoming');
  const [expandedCard, setExpandedCard] = useState<number | null>(null);

  useEffect(() => {
    const fetchProctorAssignments = async () => {
      if (!user?.user_id) return;

      try {
        setLoading(true);

        const response = await api.get(`/proctor-assigned-exams/${user.user_id}/`);

        const upcoming = Array.isArray(response.data?.upcoming)
          ? response.data.upcoming
          : [];
        const ongoing = Array.isArray(response.data?.ongoing)
          ? response.data.ongoing
          : [];
        const completed = Array.isArray(response.data?.completed)
          ? response.data.completed
          : [];

        const mapExam = (exam: any, isHistory = false): ProctorAssignment => ({
          assignment_id: exam.id,
          course_id: exam.course_id,
          section: exam.section_name || 'N/A',
          exam_date: exam.exam_date,
          exam_start_time: exam.exam_start_time,
          exam_end_time: exam.exam_end_time,
          room_id: exam.room_id,
          building: exam.building_name || 'N/A',
          instructor: exam.instructor_name || 'N/A',
          examdetails_status: exam.status || 'pending',
          is_history: isHistory,
        });

        const combinedAssignments: ProctorAssignment[] = [
          ...upcoming.map((e: any) => mapExam(e, false)),
          ...ongoing.map((e: any) => mapExam(e, false)),
          ...completed.map((e: any) => mapExam(e, true)),
        ];

        combinedAssignments.sort((a, b) => {
          const dateA = new Date(`${a.exam_date} ${a.exam_start_time}`).getTime();
          const dateB = new Date(`${b.exam_date} ${b.exam_start_time}`).getTime();
          return dateA - dateB;
        });

        setAssignments(combinedAssignments);
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

  const isExamOngoing = (examDate: string, startTime: string, endTime: string) => {
    try {
      const now = new Date();
      const examDateObj = new Date(examDate);

      const isSameDay =
        now.getFullYear() === examDateObj.getFullYear() &&
        now.getMonth() === examDateObj.getMonth() &&
        now.getDate() === examDateObj.getDate();

      if (!isSameDay) {
        return false;
      }

      const examStart = new Date(startTime);
      const examEnd = new Date(endTime);

      const currentTime = now.getTime();
      const startTimeMs = examStart.getTime();
      const endTimeMs = examEnd.getTime();

      return currentTime >= startTimeMs && currentTime <= endTimeMs;
    } catch (e) {
      return false;
    }
  };

  const now = new Date();

  const allRecords = [...assignments, ...historyRecords];

  const filteredAssignments = allRecords.filter((assign) => {
    const examStartTime = new Date(assign.exam_start_time);
    const examEndTime = new Date(assign.exam_end_time);
    const isOngoing = isExamOngoing(assign.exam_date, assign.exam_start_time, assign.exam_end_time);

    const backendStatus = (assign.examdetails_status || 'pending').toLowerCase().trim();
    const hasCheckedIn = backendStatus.includes('present') ||
      backendStatus.includes('late') ||
      backendStatus.includes('substitute') ||
      backendStatus.includes('confirmed') ||
      backendStatus.includes('absent');

    const isHistoryRecord = assign.is_history === true;

    if (filter === 'upcoming') {
      return examStartTime > now && !isHistoryRecord;
    } else if (filter === 'ongoing') {
      return isOngoing && !hasCheckedIn && !isHistoryRecord;
    } else if (filter === 'completed') {
      return hasCheckedIn || examEndTime < now || isHistoryRecord;
    }
    return true;
  });

  const upcomingCount = allRecords.filter(a => {
    const isHistoryRecord = a.is_history === true;
    return new Date(a.exam_start_time) > now && !isHistoryRecord;
  }).length;

  const ongoingCount = allRecords.filter(a => {
    const isHistoryRecord = a.is_history === true;
    const isOngoing = isExamOngoing(a.exam_date, a.exam_start_time, a.exam_end_time);
    const backendStatus = (a.examdetails_status || 'pending').toLowerCase().trim();
    const hasCheckedIn = backendStatus.includes('present') ||
      backendStatus.includes('late') ||
      backendStatus.includes('substitute');
    return isOngoing && !hasCheckedIn && !isHistoryRecord;
  }).length;

  const completedCount = allRecords.filter(a => {
    const backendStatus = (a.examdetails_status || 'pending').toLowerCase().trim();
    const hasCheckedIn = backendStatus.includes('present') ||
      backendStatus.includes('late') ||
      backendStatus.includes('substitute') ||
      backendStatus.includes('confirmed') ||
      backendStatus.includes('absent');
    const examEndTime = new Date(a.exam_end_time);
    const isHistoryRecord = a.is_history === true;
    return hasCheckedIn || examEndTime < now || isHistoryRecord;
  }).length;

  const formatDateFull = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (timeStr: string) => {
    const [hours, minutes] = timeStr.slice(11, 16).split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const getDuration = (startTime: string, endTime: string) => {
    const start = new Date(`2000-01-01T${startTime.slice(11)}`);
    const end = new Date(`2000-01-01T${endTime.slice(11)}`);
    const minutes = Math.round((end.getTime() - start.getTime()) / 60000);
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  return (
    <div className="proctor-course-container">
      <div className="proctor-course-header">
        <div className="header-title">
          <h3>Assigned Proctoring</h3>
          <p className="total-assignments">{allRecords.length} total sections</p>
        </div>
        <div className="filter-buttons">
          <button
            type="button"
            className={`filter-btn ${filter === 'upcoming' ? 'active' : ''}`}
            onClick={() => setFilter('upcoming')}
            title={`${upcomingCount} upcoming`}
          >
            <FaClock size={12} />
            Upcoming ({upcomingCount})
          </button>
          <button
            type="button"
            className={`filter-btn ${filter === 'ongoing' ? 'active' : ''}`}
            onClick={() => setFilter('ongoing')}
            title={`${ongoingCount} ongoing`}
          >
            <FaClock size={12} />
            On-going ({ongoingCount})
          </button>
          <button
            type="button"
            className={`filter-btn ${filter === 'completed' ? 'active' : ''}`}
            onClick={() => setFilter('completed')}
            title={`${completedCount} completed`}
          >
            <FaCheckCircle size={12} />
            Completed ({completedCount})
          </button>
          <button
            type="button"
            className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All ({allRecords.length})
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
        <div className="courses-list">
          {filteredAssignments.map((assign) => {
            const examStartTime = new Date(assign.exam_start_time);
            const examEndTime = new Date(assign.exam_end_time);
            const isOngoing = isExamOngoing(assign.exam_date, assign.exam_start_time, assign.exam_end_time);

            const backendStatus = (assign.examdetails_status || 'pending').toLowerCase().trim();
            const hasCheckedIn = backendStatus.includes('present') ||
              backendStatus.includes('late') ||
              backendStatus.includes('substitute') ||
              backendStatus.includes('confirmed') ||
              backendStatus.includes('absent');

            const isUpcoming = examStartTime > now;
            const isCompleted = hasCheckedIn || examEndTime < now || assign.is_history === true;
            const isExpanded = expandedCard === assign.assignment_id;
            const duration = getDuration(assign.exam_start_time, assign.exam_end_time);

            let displayStatus = 'Upcoming';
            let statusClass = 'upcoming-badge';

            if (isCompleted) {
              if (backendStatus.includes('confirmed') || backendStatus.includes('present')) {
                displayStatus = 'Present';
                statusClass = 'completed-badge';
              } else if (backendStatus.includes('late')) {
                displayStatus = 'Late';
                statusClass = 'late-badge';
              } else if (backendStatus.includes('substitute')) {
                displayStatus = 'Substitute';
                statusClass = 'substitute-badge';
              } else if (backendStatus.includes('absent')) {
                displayStatus = 'Absent';
                statusClass = 'absent-badge';
              } else {
                displayStatus = 'Completed';
                statusClass = 'completed-badge';
              }
            } else if (isOngoing) {
              displayStatus = 'On-going';
              statusClass = 'ongoing-badge';
            } else if (isUpcoming) {
              displayStatus = 'Upcoming';
              statusClass = 'upcoming-badge';
            }

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
                            {formatTime(assign.exam_start_time)} - {formatTime(assign.exam_end_time)}
                            <span className="duration">({duration})</span>
                          </span>
                        </div>
                        <div className="preview-row">
                          <span className="preview-label">Location:</span>
                          <span className="preview-value">{assign.building} - Room {assign.room_id}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="course-card-right">
                    <span className={`status-badge ${statusClass}`}>
                      {displayStatus}
                    </span>
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
                          {formatTime(assign.exam_start_time)} - {formatTime(assign.exam_end_time)}
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
  );
};

export default ProctorCourseDetails;