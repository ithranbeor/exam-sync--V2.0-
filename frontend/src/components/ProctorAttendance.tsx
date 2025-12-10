import React, { useState, useEffect, useCallback } from 'react';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import api from '../lib/apiClient';
import '../styles/ProctorAttendance.css';
import { FaCheckCircle } from 'react-icons/fa';

interface UserProps {
  user: {
    user_id: number;
    email: string;
    first_name?: string;
    last_name?: string;
  } | null;
}

interface ExamDetails {
  id: number;
  course_id: string;
  subject: string;
  section_name: string;
  exam_date: string;
  exam_start_time: string;
  exam_end_time: string;
  building_name: string;
  room_id: string;
  instructor_name?: string;
  assigned_proctor?: string;
  status?: string;
}

const ProctorAttendance: React.FC<UserProps> = ({ user }) => {
  const [selectedExam, setSelectedExam] = useState<ExamDetails | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [isSubstitutionMode, setIsSubstitutionMode] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [remarks, setRemarks] = useState('');
  const [otpValidationStatus, setOtpValidationStatus] = useState<'idle' | 'valid-assigned' | 'valid-not-assigned' | 'invalid'>('idle');
  const [proctorAssignedExams, setProctorAssignedExams] = useState<ExamDetails[]>([]);
  const [allExams, setAllExams] = useState<ExamDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [submittingAttendance, setSubmittingAttendance] = useState(false);
  const [_verificationData, setVerificationData] = useState<any>(null);
  const [showVerificationSuccess, setShowVerificationSuccess] = useState(false);

  const isTimeConflict = (
    startA: string,
    endA: string,
    startB: string,
    endB: string
  ) => {
    const aStart = new Date(startA).getTime();
    const aEnd = new Date(endA).getTime();
    const bStart = new Date(startB).getTime();
    const bEnd = new Date(endB).getTime();

    return aStart < bEnd && bStart < aEnd;
  };

  const isExamOngoing = (examDate: string, startTime: string, endTime: string) => {
    try {
      const now = new Date();
      
      const examDateObj = new Date(examDate);
      
      const isSameDay = 
        now.getFullYear() === examDateObj.getFullYear() &&
        now.getMonth() === examDateObj.getMonth() &&
        now.getDate() === examDateObj.getDate();
      
      if (!isSameDay) {
        console.log('Not same day');
        return false;
      }
      
      // Create Date objects for start and end times on the exam date
      const examStart = new Date(startTime);
      const examEnd = new Date(endTime);
      
      // Get current time in Philippines timezone
      const currentTime = now.getTime();
      const startTimeMs = examStart.getTime();
      const endTimeMs = examEnd.getTime();
      
      const isWithinTimeRange = currentTime >= startTimeMs && currentTime <= endTimeMs;
      
      // Debug logging
      console.log('=== Exam Ongoing Check ===');
      console.log('Current Time:', now.toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
      console.log('Exam Date:', examDate);
      console.log('Start Time:', examStart.toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
      console.log('End Time:', examEnd.toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
      console.log('Is Same Day:', isSameDay);
      console.log('Is Within Time Range:', isWithinTimeRange);
      console.log('========================');
      
      return isWithinTimeRange;
    } catch (e) {
      console.error('Error checking if exam is ongoing:', e);
      return false;
    }
  };

  // Fetch proctor's assigned exams
  const fetchAssignedExams = useCallback(async () => {
    if (!user?.user_id) return;

    try {
      const { data } = await api.get(`/proctor-assigned-exams/${user.user_id}/`);
      
      console.log('=== ALL FETCHED EXAMS (Before Filter) ===');
      console.log('Total exams:', data.length);
      data.forEach((exam: any) => {
        console.log({
          course: exam.course_id,
          date: exam.exam_date,
          start: exam.exam_start_time,
          end: exam.exam_end_time,
          status: exam.status
        });
      });
      
      const formattedExams: ExamDetails[] = data.map((exam: any) => ({
        id: exam.id,
        course_id: exam.course_id,
        subject: exam.subject || exam.course_id,
        section_name: exam.section_name || '',
        exam_date: exam.exam_date,
        exam_start_time: exam.exam_start_time || '',
        exam_end_time: exam.exam_end_time || '',
        building_name: exam.building_name || '',
        room_id: exam.room_id || '',
        instructor_name: exam.instructor_name || '',
        assigned_proctor: exam.assigned_proctor || '',
        status: exam.status || 'pending'
      }));
      
      console.log('=== CHECKING EACH EXAM ===');
      formattedExams.forEach(exam => {
        const ongoing = isExamOngoing(exam.exam_date, exam.exam_start_time, exam.exam_end_time);
        const notConfirmed = exam.status !== 'confirmed' && exam.status !== 'confirm';
        console.log(`${exam.course_id}: ongoing=${ongoing}, notConfirmed=${notConfirmed}`);
      });
      
      // ✅ TEMPORARY FIX: Comment out the ongoing check to see ALL your schedules
      const ongoing = formattedExams.filter((exam: ExamDetails) => {
        // const isOngoing = isExamOngoing(exam.exam_date, exam.exam_start_time, exam.exam_end_time);
        const notConfirmed = exam.status !== 'confirmed' && exam.status !== 'confirm';
        return notConfirmed; // ✅ Show all non-confirmed exams (ignore time for now)
      });
      
      const recent = formattedExams.filter((exam: ExamDetails) => {
        return exam.status === 'confirmed' || exam.status === 'confirm';
      });
      
      console.log('=== FILTERED EXAMS ===');
      console.log('Ongoing exams count:', ongoing.length);
      console.log('Recent submissions:', recent.length);
      
      setProctorAssignedExams(ongoing);
    } catch (error: any) {
      console.error('Error fetching assigned exams:', error);
      toast.error('Failed to load assigned exams');
    }
  }, [user]);

  // ✅ FIXED: Fetch all exams for substitution with proper filtering
  const fetchAllExams = useCallback(async () => {
    if (!user?.user_id || !user?.first_name || !user?.last_name) return;

    try {
      const { data } = await api.get('/all-exams-for-substitution/');
      const formattedExams: ExamDetails[] = data
        .map((exam: any) => ({
          id: exam.id,
          course_id: exam.course_id,
          subject: exam.subject || exam.course_id,
          section_name: exam.section_name || '',
          exam_date: exam.exam_date || '',
          exam_start_time: exam.exam_start_time || '',
          exam_end_time: exam.exam_end_time || '',
          building_name: exam.building_name || '',
          room_id: exam.room_id || '',
          instructor_name: exam.instructor_name || '',
          assigned_proctor: exam.assigned_proctor || '',
          status: exam.status || 'pending'
        }));

        const loggedInUserFullName = `${user.first_name} ${user.last_name}`.toLowerCase().trim();

        const filteredForSubstitution = formattedExams.filter((exam) => {
          // 1. ✅ FIXED: Remove user's own assigned schedules (exact name match)
          const examProctorName = String(exam.assigned_proctor).toLowerCase().trim();
          if (examProctorName === loggedInUserFullName) {
            console.log(`❌ Excluded own schedule: ${exam.course_id} (assigned to user)`);
            return false;
          }

          // 2. ✅ FIXED: Remove ALL schedules where user is in the exam (not just assigned_proctor)
          // This handles cases where user might be listed in other fields
          const examString = JSON.stringify(exam).toLowerCase();
          if (
            user.first_name &&
            user.last_name &&
            examString.includes(user.first_name.toLowerCase()) &&
            examString.includes(user.last_name.toLowerCase())
          ) {
            console.log(`❌ Excluded user's schedule: ${exam.course_id}`);
            return false;
          }

          // 3. ✅ FIXED: Remove time conflicts with user's assigned exams
          const hasTimeConflict = proctorAssignedExams.some((assigned) => {
            // Check if same date first
            if (assigned.exam_date !== exam.exam_date) {
              return false;
            }

            console.log(`🔍 Checking conflict between:`);
            console.log(`   Your schedule: ${assigned.course_id} ${assigned.section_name} on ${assigned.exam_date}`);
            console.log(`   Other exam: ${exam.course_id} ${exam.section_name} on ${exam.exam_date}`);
            console.log(`   Your time: ${assigned.exam_start_time} - ${assigned.exam_end_time}`);
            console.log(`   Other time: ${exam.exam_start_time} - ${exam.exam_end_time}`);

            // Check for time overlap
            const conflict = isTimeConflict(
              assigned.exam_start_time,
              assigned.exam_end_time,
              exam.exam_start_time,
              exam.exam_end_time
            );

            if (conflict) {
              console.log(`❌ TIME CONFLICT DETECTED - EXCLUDING THIS EXAM`);
            } else {
              console.log(`✅ No conflict - times don't overlap`);
            }

            return conflict;
          });

          if (hasTimeConflict) {
            console.log(`⛔ Filtered out: ${exam.course_id} ${exam.section_name} (time conflict)`);
            return false;
          }

          // 4. ✅ Keep only ongoing exams for substitution
          // TEMPORARILY DISABLED FOR TESTING - Shows all available substitution exams
          // const ongoing = isExamOngoing(exam.exam_date, exam.exam_start_time, exam.exam_end_time);
          // if (!ongoing) {
          //   return false;
          // }

          return true;
        });

      console.log(`✅ Filtered substitution exams: ${filteredForSubstitution.length} available`);
      setAllExams(filteredForSubstitution);
    } catch (error: any) {
      console.error('Error fetching all exams:', error);
      toast.error('Failed to load exams');
    }
  }, [user, proctorAssignedExams]); // ✅ Add dependencies

  // ✅ FIXED: Load data properly with dependencies
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await fetchAssignedExams();
      setLoading(false);
    };
    loadData();
  }, [fetchAssignedExams]);

  // ✅ FIXED: Fetch all exams AFTER assigned exams are loaded
  useEffect(() => {
    if (proctorAssignedExams.length >= 0) {
      fetchAllExams();
    }
  }, [proctorAssignedExams, fetchAllExams]);

  // ✅ Refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchAssignedExams();
    }, 30000);

    return () => clearInterval(interval);
  }, [fetchAssignedExams]);

  const handleCardClick = (exam: ExamDetails, isSubstitution: boolean = false) => {
    setSelectedExam(exam);
    setIsSubstitutionMode(isSubstitution);
    setShowModal(true);
    setOtpCode('');
    setRemarks('');
    setOtpValidationStatus('idle');
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedExam(null);
    setIsSubstitutionMode(false);
    setOtpCode('');
    setRemarks('');
    setOtpValidationStatus('idle');
  };

  const handleOtpChange = (value: string) => {
    setOtpCode(value);
    // Reset validation status when OTP changes
    if (otpValidationStatus !== 'idle') {
      setOtpValidationStatus('idle');
    }
  };

  // Update handleVerifyOtp to show success modal instead of just status
  const handleVerifyOtp = async () => {
    if (!otpCode.trim() || !user?.user_id) {
      return;
    }

    setVerifyingOtp(true);
    try {
      const response = await api.post('/verify-otp/', {
        otp_code: otpCode.trim(),
        user_id: user.user_id
      });

      const { valid, verification_status, message, exam_schedule_id, ...examData } = response.data;

      if (valid) {
        setOtpValidationStatus(verification_status as 'valid-assigned' | 'valid-not-assigned');
        setVerificationData({ exam_schedule_id, ...examData });
        
        // Show success modal instead of toast
        setShowVerificationSuccess(true);
      } else {
        setOtpValidationStatus('invalid');
        toast.error(message || 'Invalid OTP code');
      }
    } catch (error: any) {
      console.error('Error verifying OTP:', error);
      setOtpValidationStatus('invalid');
      const errorMessage = error.response?.data?.error || error.message || 'Failed to verify OTP';
      toast.error(errorMessage);
    } finally {
      setVerifyingOtp(false);
    }
  };

  // Place this revised function in your component:
  const formatTo12Hour = (timeString: string | undefined) => {
    if (!timeString) return '-';

    try {
      const date = new Date(timeString);

      const options: Intl.DateTimeFormatOptions = {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: 'Asia/Manila'
      };

      if (isNaN(date.getTime())) {
        console.error('Invalid Date input:', timeString);
        return '-';
      }

      return date.toLocaleTimeString('en-US', options);

    } catch (e) {
      console.error('Error formatting time:', timeString, e);
      return '-';
    }
  };

  const handleSubmit = async () => {
    if (!user?.user_id || !otpCode.trim()) {
      toast.error('Missing required information');
      return;
    }

    const role = otpValidationStatus === 'valid-assigned' ? 'assigned' : 'sub';
    // Validate remarks for substitute
    if (role === 'sub' && !remarks.trim()) {
      toast.error('Remarks are required for substitute proctors');
      return;
    }

    setSubmittingAttendance(true);
    try {
      const response = await api.post('/submit-proctor-attendance/', {
        otp_code: otpCode.trim(),
        user_id: user.user_id,
        remarks: remarks.trim() || undefined,
        role: role
        // ✅ REMOVED is_late - backend will determine this
      });

      toast.success(response.data.message || 'Attendance recorded successfully');
      
      // ✅ Check status from response
      if (response.data.status === 'late') {
        toast.warning('Marked as LATE - You arrived more than 7 minutes after start time', {
          autoClose: 5000
        });
      }

      // Refresh data
      await fetchAssignedExams();

      // Close modals
      setShowVerificationSuccess(false);
      handleCloseModal();
    } catch (error: any) {
      console.error('Error submitting attendance:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Failed to submit attendance';
      toast.error(errorMessage);
    } finally {
      setSubmittingAttendance(false);
    }
  };

  return (
    <div className="proctor-attendance-container">
      <ToastContainer position="top-right" autoClose={3000} />

      <div className="proctor-attendance-instruction">
        <p className="proctor-attendance-instruction-text">
          Click assigned schedule to confirm your proctorship
        </p>
      </div>

      {loading ? (
        <div className="no-data-message">Loading exams...</div>
      ) : (
        <>
          {/* First Section: Proctor's Assigned Exams */}
          <div className="proctor-attendance-section">
            <h3 className="proctor-attendance-section-title">My Assigned Exams</h3>
            <div className="proctor-attendance-canvas">
              <div className="proctor-attendance-schedules-grid">
                {proctorAssignedExams.length > 0 ? (
                  proctorAssignedExams.map((exam) => (
                    <div
                      key={exam.id}
                      className="proctor-attendance-schedule-card proctor-attendance-schedule-card-clickable proctor-attendance-schedule-card-assigned"
                      onClick={() => handleCardClick(exam, false)}
                    >
                      <div className="proctor-attendance-schedule-header">
                        <h3 className="proctor-attendance-schedule-subject">
                          {exam.course_id} - {exam.subject}
                        </h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span className="proctor-attendance-schedule-code">{exam.course_id}</span>
                          <span className="ongoing-badge">ONGOING</span>
                        </div>
                      </div>

                      <div className="proctor-attendance-schedule-details">
                        <div className="proctor-attendance-detail-row">
                          <span className="proctor-attendance-detail-label">Section:</span>
                          <span className="proctor-attendance-detail-value">{exam.section_name}</span>
                        </div>
                        <div className="proctor-attendance-detail-row">
                          <span className="proctor-attendance-detail-label">Date:</span>
                          <span className="proctor-attendance-detail-value">{exam.exam_date}</span>
                        </div>
                        <div className="proctor-attendance-detail-row">
                          <span className="proctor-attendance-detail-label">Time:</span>
                          <span className="proctor-attendance-detail-value">
                            {formatTo12Hour(exam.exam_start_time)} - {formatTo12Hour(exam.exam_end_time)}
                          </span>
                        </div>
                        <div className="proctor-attendance-detail-row">
                          <span className="proctor-attendance-detail-label">Building:</span>
                          <span className="proctor-attendance-detail-value">{exam.building_name}</span>
                        </div>
                        <div className="proctor-attendance-detail-row">
                          <span className="proctor-attendance-detail-label">Room:</span>
                          <span className="proctor-attendance-detail-value">{exam.room_id}</span>
                        </div>
                        <div className="proctor-attendance-detail-row">
                          <span className="proctor-attendance-detail-label">Instructor:</span>
                          <span className="proctor-attendance-detail-value">{exam.instructor_name}</span>
                        </div>
                      </div>
                      <div className="proctor-attendance-click-hint">
                        Click to confirm proctorship
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="no-data-message">No assigned exams found</div>
                )}
              </div>
            </div>
          </div>

          {/* Second Section: All Exams (for substitution) */}
          <div className="proctor-attendance-section">
            <h3 className="proctor-attendance-section-title">All Exams (Available for Substitution)</h3>
            <div className="proctor-attendance-canvas">
              <div className="proctor-attendance-schedules-grid">
                {allExams.length > 0 ? (
                  allExams.map((exam) => (
                    <div
                      key={exam.id}
                      className="proctor-attendance-schedule-card proctor-attendance-schedule-card-clickable proctor-attendance-schedule-card-substitution"
                      onClick={() => handleCardClick(exam, true)}
                      >
                        <div className="proctor-attendance-schedule-header">
                          <h3 className="proctor-attendance-schedule-subject">
                            {exam.course_id} - {exam.subject}
                          </h3>
                          <span className="proctor-attendance-schedule-code">{exam.course_id}</span>
                        </div>

                        <div className="proctor-attendance-schedule-details">
                          <div className="proctor-attendance-detail-row">
                            <span className="proctor-attendance-detail-label">Section:</span>
                            <span className="proctor-attendance-detail-value">{exam.section_name}</span>
                          </div>
                          <div className="proctor-attendance-detail-row">
                            <span className="proctor-attendance-detail-label">Date:</span>
                            <span className="proctor-attendance-detail-value">{exam.exam_date}</span>
                          </div>
                          <div className="proctor-attendance-detail-row">
                            <span className="modal-detail-label">Time:</span>
                            <span className="modal-detail-value">
                              {formatTo12Hour(exam.exam_start_time)} - {formatTo12Hour(exam.exam_end_time)}
                            </span>
                          </div>
                          <div className="proctor-attendance-detail-row">
                            <span className="proctor-attendance-detail-label">Building:</span>
                            <span className="proctor-attendance-detail-value">{exam.building_name}</span>
                          </div>
                          <div className="proctor-attendance-detail-row">
                            <span className="proctor-attendance-detail-label">Room:</span>
                            <span className="proctor-attendance-detail-value">{exam.room_id}</span>
                          </div>
                          <div className="proctor-attendance-detail-row">
                            <span className="proctor-attendance-detail-label">Assigned Proctor:</span>
                            <span className="proctor-attendance-detail-value">{exam.assigned_proctor}</span>
                          </div>
                          <div className="proctor-attendance-detail-row">
                            <span className="proctor-attendance-detail-label">Instructor:</span>
                            <span className="proctor-attendance-detail-value">{exam.instructor_name}</span>
                          </div>
                          <div className="proctor-attendance-detail-row">
                            <span className="proctor-attendance-detail-label">Status:</span>
                            <span className={`status-badge status-${exam.status}`}>
                              {exam.status}
                            </span>
                          </div>
                        </div>

                        <div className="proctor-attendance-click-hint proctor-attendance-substitution-hint">
                          Click to substitute as proctor
                        </div>
                      </div>
                    ))
                ) : (
                  <div className="no-data-message">No exams available for substitution</div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Modal for Confirmation */}
      {showModal && selectedExam && (
        <div className="proctor-attendance-modal-overlay" onClick={handleCloseModal}>
          <div className="proctor-attendance-modal" onClick={(e) => e.stopPropagation()}>
            <div className="proctor-attendance-modal-header">
              <h3 className="proctor-attendance-modal-title">
                {isSubstitutionMode ? 'Substitute Proctorship' : 'Confirm Proctorship'}
              </h3>
              <button className="proctor-attendance-modal-close" onClick={handleCloseModal}>
                ×
              </button>
            </div>

            <div className="proctor-attendance-modal-content">
              {/* Substitution Mode Indicator */}
              {isSubstitutionMode && (
                <div className="proctor-attendance-substitution-banner">
                  <span className="substitution-icon">⚠️</span>
                  <span className="substitution-text">
                    You are substituting for: <strong>{selectedExam.assigned_proctor}</strong>
                  </span>
                </div>
              )}

              <div className="proctor-attendance-modal-exam-details">
                <h4>Exam Details</h4>
                <div className="proctor-attendance-modal-details-grid">
                  <div className="proctor-attendance-modal-detail-item">
                    <span className="modal-detail-label">Course:</span>
                    <span className="modal-detail-value">{selectedExam.course_id} - {selectedExam.subject}</span>
                  </div>
                  <div className="proctor-attendance-modal-detail-item">
                    <span className="modal-detail-label">Section:</span>
                    <span className="modal-detail-value">{selectedExam.section_name}</span>
                  </div>
                  <div className="proctor-attendance-modal-detail-item">
                    <span className="modal-detail-label">Date:</span>
                    <span className="modal-detail-value">{selectedExam.exam_date}</span>
                  </div>
                  <div className="proctor-attendance-modal-detail-item">
                    <span className="modal-detail-label">Time:</span>
                    <span className="modal-detail-value">
                      {formatTo12Hour(selectedExam.exam_start_time)} - {formatTo12Hour(selectedExam.exam_end_time)}
                    </span>
                  </div>
                  <div className="proctor-attendance-modal-detail-item">
                    <span className="modal-detail-label">Building:</span>
                    <span className="modal-detail-value">{selectedExam.building_name}</span>
                  </div>
                  <div className="proctor-attendance-modal-detail-item">
                    <span className="modal-detail-label">Room:</span>
                    <span className="modal-detail-value">{selectedExam.room_id}</span>
                  </div>
                  {selectedExam.assigned_proctor && (
                    <div className="proctor-attendance-modal-detail-item">
                      <span className="modal-detail-label">Assigned Proctor:</span>
                      <span className="modal-detail-value">{selectedExam.assigned_proctor}</span>
                    </div>
                  )}
                  {selectedExam.instructor_name && (
                    <div className="proctor-attendance-modal-detail-item">
                      <span className="modal-detail-label">Instructor:</span>
                      <span className="modal-detail-value">{selectedExam.instructor_name}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="proctor-attendance-modal-form">
                <div className="proctor-attendance-modal-input-group">
                  <label htmlFor="otp-input" className="proctor-attendance-modal-label">
                    Exam Code (OTP):
                  </label>
                  <div className="proctor-attendance-otp-input-wrapper">
                    <input
                      id="otp-input"
                      type="text"
                      className="proctor-attendance-modal-input"
                      placeholder="Enter the exam code shown in the venue"
                      value={otpCode}
                      onChange={(e) => handleOtpChange(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && otpCode.trim()) {
                          handleVerifyOtp();
                        }
                      }}
                    />
                    <button
                      className="proctor-attendance-verify-button"
                      onClick={handleVerifyOtp}
                      disabled={!otpCode.trim() || verifyingOtp}
                    >
                      {verifyingOtp ? 'Verifying...' : 'Verify'}
                    </button>
                  </div>
                </div>

                {/* Only show remarks field AFTER verification */}
                {otpValidationStatus === 'valid-not-assigned' && (
                  <div className="proctor-attendance-modal-input-group">
                    <label htmlFor="remarks-input" className="proctor-attendance-modal-label">
                      Remarks (Required for substitution):
                    </label>
                    <textarea
                      id="remarks-input"
                      className={`proctor-attendance-modal-textarea ${!remarks.trim() ? 'proctor-attendance-required-field' : ''}`}
                      placeholder="Please provide a reason for substitution (e.g., emergency leave, illness, etc.)"
                      rows={3}
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                    />
                    {!remarks.trim() && (
                      <span className="proctor-attendance-field-error">Remarks are required for substitution</span>
                    )}
                  </div>
                )}

                {/* Optional remarks for assigned proctors */}
                {otpValidationStatus === 'valid-assigned' && (
                  <div className="proctor-attendance-modal-input-group">
                    <label htmlFor="remarks-input" className="proctor-attendance-modal-label">
                      Remarks (Optional):
                    </label>
                    <textarea
                      id="remarks-input"
                      className="proctor-attendance-modal-textarea"
                      placeholder="Enter any remarks or notes..."
                      rows={3}
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="proctor-attendance-modal-footer">
              <button
                className="proctor-attendance-modal-cancel"
                onClick={handleCloseModal}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Verification Success Modal - MOVED OUTSIDE main modal */}
      {showVerificationSuccess && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 10000
          }}
          onClick={() => setShowVerificationSuccess(false)}
        >
          <div
            style={{
              backgroundColor: 'white',
              padding: '30px',
              borderRadius: '15px',
              maxWidth: '500px',
              width: '90%',
              boxShadow: '0 8px 16px rgba(0, 0, 0, 0.3)',
              textAlign: 'center'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: '60px', marginBottom: '15px', color: '#28a745' }}>
              <FaCheckCircle/>
            </div>
            <h2 style={{ color: '#28a745', marginBottom: '10px' }}>Code Verified!</h2>
            <p style={{ color: '#666', marginBottom: '25px', fontSize: '16px' }}>
              {otpValidationStatus === 'valid-assigned' 
                ? 'You are assigned to this exam. Click submit to confirm your attendance.'
                : 'Valid code, but you are not assigned. You will be marked as a substitute proctor.'}
            </p>

            {/* Show remarks input INSIDE success modal if substitute */}
            {otpValidationStatus === 'valid-not-assigned' && (
              <div style={{ marginBottom: '20px', textAlign: 'left' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#333' }}>
                  Remarks (Required for substitution):
                </label>
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Please provide a reason for substitution (e.g., emergency leave, illness, etc.)"
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '8px',
                    border: '1px solid #ddd',
                    fontSize: '14px',
                    resize: 'vertical'
                  }}
                />
                {!remarks.trim() && (
                  <span style={{ color: '#dc3545', fontSize: '12px', marginTop: '5px', display: 'block' }}>
                    Remarks are required for substitution
                  </span>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                onClick={() => setShowVerificationSuccess(false)}
                style={{
                  padding: '12px 24px',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '14px'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={
                  (otpValidationStatus === 'valid-not-assigned' && !remarks.trim()) ||
                  submittingAttendance
                }
                style={{
                  padding: '12px 24px',
                  backgroundColor: submittingAttendance ? '#ccc' : '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: submittingAttendance || (otpValidationStatus === 'valid-not-assigned' && !remarks.trim()) ? 'not-allowed' : 'pointer',
                  fontWeight: 'bold',
                  fontSize: '14px'
                }}
              >
                {submittingAttendance ? 'Submitting...' : 'Submit Attendance'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProctorAttendance;