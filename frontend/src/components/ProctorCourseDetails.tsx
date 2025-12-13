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
    const [_loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'upcoming' | 'ongoing' | 'completed'>('upcoming');
    const [expandedCard, setExpandedCard] = useState<number | null>(null);

    useEffect(() => {
      const fetchProctorAssignments = async () => {
        if (!user?.user_id) return;

        try {
          setLoading(true);
                    
          // Step 1: Get ONLY exam details where THIS SPECIFIC user is the proctor
          const examDetailsResponse = await api.get('/tbl_examdetails', {
            params: { 
              proctor_id: user.user_id  // ✅ This filters on backend to only this user's assignments
            }
          });
          
          if (!examDetailsResponse.data || !Array.isArray(examDetailsResponse.data)) {
            setAssignments([]);
            setLoading(false);
            return;
          }

          const proctorExams = examDetailsResponse.data;          
          const userProctorExams = proctorExams.filter(exam => {
            const isMatch = Number(exam.proctor_id) === Number(user.user_id);
            if (!isMatch) {
            }
            return isMatch;
          });
          
          
          if (userProctorExams.length === 0) {
            setAssignments([]);
            setLoading(false);
            return;
          }
          
          // Step 2: Get unique college names from the exams
          const collegeNames = [...new Set(userProctorExams.map(exam => exam.college_name).filter(Boolean))];
          
          if (collegeNames.length === 0) {
            setAssignments([]);
            setLoading(false);
            return;
          }

          // Step 3: Check approval status for each college
          const approvalPromises = collegeNames.map(collegeName =>
            api.get('/tbl_scheduleapproval/', {
              params: { college_name: collegeName }
            }).catch(_err => {
              return { data: [] };
            })
          );

          const approvalResponses = await Promise.all(approvalPromises);
          
          // Step 4: Create a map of approved colleges
          const approvedColleges = new Set<string>();
          approvalResponses.forEach((response, index) => {
            if (response.data && response.data.length > 0) {
              // Get the most recent approval for this college
              const sortedApprovals = response.data.sort((a: any, b: any) =>
                new Date(b.submitted_at || b.created_at).getTime() - 
                new Date(a.submitted_at || a.created_at).getTime()
              );
              const latestApproval = sortedApprovals[0];
              
              // Only include if status is 'approved'
              if (latestApproval.status === 'approved') {
                approvedColleges.add(collegeNames[index]);
              } else {
              }
            } else {
            }
          });

          // Step 5: Filter exams to only include those from approved colleges
          const approvedExams = userProctorExams.filter(exam => 
            approvedColleges.has(exam.college_name)
          );

          // Step 6: Get instructor names for all exams
          const instructorIds = [...new Set(approvedExams.map(exam => exam.instructor_id).filter(Boolean))];
          const instructorMap = new Map<number, string>();
          
          if (instructorIds.length > 0) {
            try {
              // ✅ FIX: Fetch ALL users from /users/ endpoint (same as SchedulerView)
              const usersResponse = await api.get('/users/');
              const allUsers = usersResponse.data;
              
              // Map instructor IDs to their full names
              instructorIds.forEach(instructorId => {
                const instructor = allUsers.find((u: any) => u.user_id === instructorId);
                if (instructor) {
                  const fullName = `${instructor.first_name || ''} ${instructor.last_name || ''}`.trim();
                  instructorMap.set(instructorId, fullName || `Instructor ${instructorId}`);
                } else {
                  instructorMap.set(instructorId, `Instructor ${instructorId}`);
                }
              });
            } catch (err) {
            }
          }

          // Step 7: Transform to match the expected format
          const formattedAssignments: ProctorAssignment[] = approvedExams.map(exam => ({
            assignment_id: exam.examdetails_id,
            course_id: exam.course_id,
            section: exam.section_name || 'N/A',
            exam_date: exam.exam_date,
            exam_start_time: exam.exam_start_time,
            exam_end_time: exam.exam_end_time,
            room_id: exam.room_id,
            building: exam.building_name || 'N/A',
            instructor: exam.instructor_id ? (instructorMap.get(exam.instructor_id) || `Instructor ${exam.instructor_id}`) : 'N/A',
            status: 'approved'
          }));

          // Sort by date
          const sorted = formattedAssignments.sort(
            (a, b) =>
              new Date(a.exam_date).getTime() - new Date(b.exam_date).getTime()
          );
          
          setAssignments(sorted);
        } catch (err: any) {
          setAssignments([]);
        } finally {
          setLoading(false);
        }
      };

      fetchProctorAssignments();
      
      // ✅ CHANGED: Poll for updates every 30 seconds (instead of 10 seconds)
      // Proctors don't need real-time updates like schedulers do
      const interval = setInterval(fetchProctorAssignments, 30000);
      return () => clearInterval(interval);
    }, [user?.user_id]);

    const isExamOngoing = (examDate: string, startTime: string, endTime: string) => {
      try {
        const now = new Date();
        const examDateObj = new Date(examDate);
        
        // Check if it's the same day
        const isSameDay = 
          now.getFullYear() === examDateObj.getFullYear() &&
          now.getMonth() === examDateObj.getMonth() &&
          now.getDate() === examDateObj.getDate();
        
        if (!isSameDay) {
          return false;
        }
        
        // Create Date objects for start and end times
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

    const filteredAssignments = assignments.filter((assign) => {
      const examStartTime = new Date(assign.exam_start_time);
      const isOngoing = isExamOngoing(assign.exam_date, assign.exam_start_time, assign.exam_end_time);
      const isConfirmed = assign.status.toLowerCase() === 'confirmed' || assign.status.toLowerCase() === 'confirm';

      if (filter === 'upcoming') {
        return examStartTime > now;
      } else if (filter === 'ongoing') {
        return isOngoing && !isConfirmed;
      } else if (filter === 'completed') {
        const examEnd = new Date(assign.exam_end_time);
        return isConfirmed || examEnd < now;
      }
      return true; // 'all'
    });

    const upcomingCount = assignments.filter(a => new Date(a.exam_start_time) > now).length;
    const ongoingCount = assignments.filter(a => {
      const isOngoing = isExamOngoing(a.exam_date, a.exam_start_time, a.exam_end_time);
      const isConfirmed = a.status.toLowerCase() === 'confirmed' || a.status.toLowerCase() === 'confirm';
      return isOngoing && !isConfirmed;
    }).length;
    const completedCount = assignments.filter(a => {
      const isConfirmed = a.status.toLowerCase() === 'confirmed' || a.status.toLowerCase() === 'confirm';
      const examEnd = new Date(a.exam_end_time);
      return isConfirmed || examEnd < now;
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
              All ({assignments.length})
            </button>
          </div>
        </div>

        {filteredAssignments.length === 0 ? (
          <div className="empty-message">
            <p>
              {filter === 'all' 
                ? 'No approved proctoring assignments yet' 
                : filter === 'ongoing'
                ? 'No on-going exams'
                : `No ${filter} proctoring assignments`}
            </p>
            {assignments.length === 0 && (
              <p style={{ fontSize: '14px', color: '#666', marginTop: '10px' }}>
                Schedules will appear here once approved by the dean
              </p>
            )}
          </div>
        ) : (
          <div className="courses-list">
            {filteredAssignments.map((assign) => {
              const examStartTime = new Date(assign.exam_start_time);
              const isOngoing = isExamOngoing(assign.exam_date, assign.exam_start_time, assign.exam_end_time);
              const isConfirmed = assign.status.toLowerCase() === 'confirmed' || assign.status.toLowerCase() === 'confirm';
              const isUpcoming = examStartTime > now;
              const examEnd = new Date(assign.exam_end_time);
              const isCompleted = isConfirmed || examEnd < now;
              const isExpanded = expandedCard === assign.assignment_id;
              const duration = getDuration(assign.exam_start_time, assign.exam_end_time);

              let displayStatus = 'upcoming';
              let statusClass = 'upcoming-badge';
              if (isCompleted) {
                displayStatus = 'Completed';
                statusClass = 'completed-badge';
              } else if (isOngoing) {
                displayStatus = 'On-going';
                statusClass = 'ongoing-badge';
              } else if (isUpcoming) {
                displayStatus = 'Upcoming';
                statusClass = 'upcoming-badge';
              }

              return (
                <div
                  key={assign.assignment_id}
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