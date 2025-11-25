import { useState, useEffect } from 'react';
import '../styles/proctorCourseDetails.css';
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
  status: string;
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
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'completed'>('upcoming');
  const [expandedCard, setExpandedCard] = useState<number | null>(null);

  useEffect(() => {
    const fetchProctorAssignments = async () => {
      if (!user?.user_id) return;

      try {
        setLoading(true);
        const { data } = await api.get('/tbl_proctorschedule/', {
          params: { proctor_id: user.user_id, status: 'approved' },
        });

        if (data && Array.isArray(data)) {
          const sorted = data.sort(
            (a, b) =>
              new Date(a.exam_date).getTime() - new Date(b.exam_date).getTime()
          );
          setAssignments(sorted);
        }
      } catch (err) {
        console.error('Error fetching proctor assignments:', err);
        setAssignments([]);
      } finally {
        setLoading(false);
      }
    };

    fetchProctorAssignments();
  }, [user?.user_id]);

  const now = new Date();

  const filteredAssignments = assignments.filter((assign) => {
    const examDate = new Date(assign.exam_date);
    if (filter === 'upcoming') {
      return examDate >= now;
    } else if (filter === 'completed') {
      return examDate < now;
    }
    return true;
  });

  const upcomingCount = assignments.filter(a => new Date(a.exam_date) >= now).length;
  const completedCount = assignments.filter(a => new Date(a.exam_date) < now).length;

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
          <p className="total-assignments">{assignments.length} total sections</p>
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
            All ({assignments.length})
          </button>
        </div>
      </div>

      {loading ? (
        <div className="loading-message">
          <div className="spinner"></div>
          Loading assignments...
        </div>
      ) : filteredAssignments.length === 0 ? (
        <div className="empty-message">
          <p>No {filter === 'all' ? '' : filter} proctoring assignments</p>
        </div>
      ) : (
        <div className="courses-list">
          {filteredAssignments.map((assign, _idx) => {
            const examDate = new Date(assign.exam_date);
            const isUpcoming = examDate >= now;
            const isExpanded = expandedCard === assign.assignment_id;
            const duration = getDuration(assign.exam_start_time, assign.exam_end_time);

            return (
              <div
                key={assign.assignment_id}
                className={`course-card ${isUpcoming ? 'upcoming' : 'completed'} ${isExpanded ? 'expanded' : ''
                  }`}
              >
                <div
                  className="course-card-header"
                  onClick={() =>
                    setExpandedCard(
                      isExpanded ? null : assign.assignment_id
                    )
                  }
                  style={{ cursor: 'pointer' }}
                >
                  <div className="course-card-left">
                    <div className="course-code-badge">{assign.course_id}</div>
                    <div className="course-card-main">
                      <p className="course-title">
                        {assign.course_id} - {assign.section}
                      </p>
                      <p className="course-instructor">{assign.instructor}</p>
                    </div>
                  </div>
                  <div className="course-card-right">
                    <span
                      className={`status-badge ${isUpcoming ? 'upcoming-badge' : 'completed-badge'
                        }`}
                    >
                      {isUpcoming ? 'Upcoming' : 'Completed'}
                    </span>
                    <button
                      type="button"
                      className="expand-btn"
                      aria-label="Toggle details"
                    >
                      {isExpanded ? (
                        <FaChevronUp size={16} />
                      ) : (
                        <FaChevronDown size={16} />
                      )}
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="course-card-details">
                    <div className="detail-section">
                      <h4>Exam Information</h4>
                      <div className="detail-row">
                        <span className="detail-label">Date:</span>
                        <span className="detail-value">
                          {formatDateFull(assign.exam_date)}
                        </span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">Time:</span>
                        <span className="detail-value">
                          {formatTime(assign.exam_start_time)} -{' '}
                          {formatTime(assign.exam_end_time)}
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
                        <span className="detail-value">
                          {assign.instructor}
                        </span>
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