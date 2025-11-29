import React, { useState } from 'react';
import '../styles/ProctorAttendance.css';

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

const ProctorAttendance: React.FC<UserProps> = ({ }) => {
  const [selectedExam, setSelectedExam] = useState<ExamDetails | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [isSubstitutionMode, setIsSubstitutionMode] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [remarks, setRemarks] = useState('');
  const [otpValidationStatus, setOtpValidationStatus] = useState<'idle' | 'valid-assigned' | 'valid-not-assigned' | 'invalid'>('idle');
  // user will be used for future functionality
  // Mock data - Proctor's assigned exams (sorted by schedule)
  const proctorAssignedExams = [
    {
      id: 1,
      course_id: "IT114",
      subject: "Computer Programming",
      section_name: "BSIT-3A",
      exam_date: "2024-01-15",
      exam_start_time: "08:00",
      exam_end_time: "09:30",
      building_name: "Building 09",
      room_id: "306",
      instructor_name: "Ms. Dela Peña"
    },
    {
      id: 2,
      course_id: "IT201",
      subject: "Data Structures",
      section_name: "BSIT-2C",
      exam_date: "2024-01-16",
      exam_start_time: "01:00",
      exam_end_time: "02:30",
      building_name: "Building 10",
      room_id: "401",
      instructor_name: "Dr. Martinez"
    }
  ];

  // Mock data - All exams (for substitution purposes)
  const allExams = [
    {
      id: 1,
      course_id: "IT114",
      subject: "Computer Programming",
      section_name: "BSIT-3A",
      exam_date: "2024-01-15",
      exam_start_time: "08:00",
      exam_end_time: "09:30",
      building_name: "Building 09",
      room_id: "306",
      assigned_proctor: "Mr. Cruz",
      instructor_name: "Ms. Dela Peña",
      status: "assigned"
    },
    {
      id: 2,
      course_id: "CS101",
      subject: "Introduction to Computer Science",
      section_name: "BSCS-1B",
      exam_date: "2024-01-15",
      exam_start_time: "10:00",
      exam_end_time: "11:30",
      building_name: "Building 09",
      room_id: "205",
      assigned_proctor: "Dr. Santos",
      instructor_name: "Prof. Garcia",
      status: "assigned"
    },
    {
      id: 3,
      course_id: "IT201",
      subject: "Data Structures",
      section_name: "BSIT-2C",
      exam_date: "2024-01-16",
      exam_start_time: "01:00",
      exam_end_time: "02:30",
      building_name: "Building 10",
      room_id: "401",
      assigned_proctor: "Ms. Reyes",
      instructor_name: "Dr. Martinez",
      status: "assigned"
    },
    {
      id: 4,
      course_id: "CS202",
      subject: "Database Systems",
      section_name: "BSCS-2A",
      exam_date: "2024-01-16",
      exam_start_time: "03:00",
      exam_end_time: "04:30",
      building_name: "Building 10",
      room_id: "402",
      assigned_proctor: "Mr. Torres",
      instructor_name: "Ms. Fernandez",
      status: "assigned"
    }
  ];

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

  const handleVerifyOtp = async () => {
    // TODO: Replace with actual API call
    // For now, simulate validation
    if (!otpCode.trim()) {
      return;
    }

    // Simulate API call
    // const response = await api.post('/api/verify-otp/', { otp_code: otpCode, schedule_id: selectedExam?.id });
    
    // Mock validation logic (replace with actual API response)
    // For demonstration: if OTP contains "SUB" or it's substitution mode, show not-assigned
    if (isSubstitutionMode || otpCode.includes('SUB')) {
      setOtpValidationStatus('valid-not-assigned');
    } else {
      setOtpValidationStatus('valid-assigned');
    }
  };

  const handleSubmit = () => {
    // TODO: Add API call to submit attendance
    const role = (isSubstitutionMode || otpValidationStatus === 'valid-not-assigned') ? 'sub' : 'assigned';
    
    console.log('Submitting attendance:', {
      exam: selectedExam,
      otpCode,
      remarks,
      role,
      isSubstitution: isSubstitutionMode || otpValidationStatus === 'valid-not-assigned'
    });
    
    // Close modal after submission
    handleCloseModal();
  };

  return (
    <div className="proctor-attendance-container">
         
      <div className="proctor-attendance-instruction">
        <p className="proctor-attendance-instruction-text">
          Click assigned schedule to confirm your proctorship
        </p>
      </div>
      
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
                      <span className="proctor-attendance-detail-label">Time:</span>
                      <span className="proctor-attendance-detail-value">{exam.exam_start_time} - {exam.exam_end_time}</span>
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
                      <span className="proctor-attendance-detail-label">Time:</span>
                      <span className="proctor-attendance-detail-value">{exam.exam_start_time} - {exam.exam_end_time}</span>
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
              <div className="no-data-message">No exams found</div>
            )}
          </div>
        </div>
      </div>

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
                    <span className="modal-detail-value">{selectedExam.exam_start_time} - {selectedExam.exam_end_time}</span>
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
                      disabled={!otpCode.trim()}
                    >
                      Verify
                    </button>
                  </div>
                  
                  {/* OTP Validation Status */}
                  {otpValidationStatus === 'valid-assigned' && (
                    <div className="proctor-attendance-validation-message proctor-attendance-validation-success">
                      ✅ Valid code. You are assigned to this exam.
                    </div>
                  )}
                  {otpValidationStatus === 'valid-not-assigned' && (
                    <div className="proctor-attendance-validation-message proctor-attendance-validation-warning">
                      ⚠️ Valid code, but you are not assigned. Act as a substitute?
                    </div>
                  )}
                  {otpValidationStatus === 'invalid' && (
                    <div className="proctor-attendance-validation-message proctor-attendance-validation-error">
                      ❌ Invalid or expired exam code.
                    </div>
                  )}
                </div>

                <div className="proctor-attendance-modal-input-group">
                  <label htmlFor="remarks-input" className="proctor-attendance-modal-label">
                    Remarks {isSubstitutionMode || otpValidationStatus === 'valid-not-assigned' ? '(Required for substitution)' : '(Optional)'}:
                  </label>
                  <textarea
                    id="remarks-input"
                    className={`proctor-attendance-modal-textarea ${(isSubstitutionMode || otpValidationStatus === 'valid-not-assigned') && !remarks.trim() ? 'proctor-attendance-required-field' : ''}`}
                    placeholder={isSubstitutionMode || otpValidationStatus === 'valid-not-assigned' 
                      ? "Please provide a reason for substitution (e.g., emergency leave, illness, etc.)" 
                      : "Enter any remarks or notes..."}
                    rows={3}
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                  />
                  {(isSubstitutionMode || otpValidationStatus === 'valid-not-assigned') && !remarks.trim() && (
                    <span className="proctor-attendance-field-error">Remarks are required for substitution</span>
                  )}
                </div>
              </div>
            </div>

            <div className="proctor-attendance-modal-footer">
              <button 
                className="proctor-attendance-modal-cancel" 
                onClick={handleCloseModal}
              >
                Cancel
              </button>
              <button 
                className="proctor-attendance-modal-submit" 
                onClick={handleSubmit}
                disabled={
                  !otpCode.trim() || 
                  otpValidationStatus === 'idle' ||
                  otpValidationStatus === 'invalid' ||
                  ((isSubstitutionMode || otpValidationStatus === 'valid-not-assigned') && !remarks.trim())
                }
              >
                {isSubstitutionMode || otpValidationStatus === 'valid-not-assigned' 
                  ? 'Confirm as Substitute' 
                  : 'Confirm Proctorship'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProctorAttendance;