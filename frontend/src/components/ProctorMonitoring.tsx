import React from 'react';
import '../styles/ProctorMonitoring.css';

interface UserProps {
  user: {
    user_id: number;
    email: string;
    first_name?: string;
    last_name?: string;
  } | null;
}

const ProctorMonitoring: React.FC<UserProps> = ({ }) => {
  // user will be used for future functionality
  // Mock data structure - will be replaced with actual API data later
  const mockSchedules = [
    {
      id: 1,
      subject: "IT114 - Computer Programming",
      course_code: "IT114",
      time_slot: "8:00 AM - 9:30 AM",
      proctor: "Mr. Cruz",
      instructor: "Ms. Dela Peña",
      building: "Building 09",
      room: "306",
      department: "Information Technology",
      college: "CITC",
      exam_date: "2024-01-15"
    },
    {
      id: 2,
      subject: "CS101 - Introduction to Computer Science",
      course_code: "CS101",
      time_slot: "10:00 AM - 11:30 AM",
      proctor: "Dr. Santos",
      instructor: "Prof. Garcia",
      building: "Building 09",
      room: "205",
      department: "Computer Science",
      college: "CITC",
      exam_date: "2024-01-15"
    }
  ];

  return (
    <div className="proctor-monitoring-container">
      <div className="proctor-monitoring-header">
        <div className="proctor-monitoring-header-left">
          <p className="proctor-monitoring-label">
            EXAM SCHEDULE IS APPROVE WOULD YOU LIKE TO CREATE EXAM CODES?
          </p>
        </div>
        <button className="proctor-monitoring-create-button">
          CREATE BUTTON
        </button>
      </div>
      
      {/* Canvas Area - Similar to Plot Schedule UI */}
      <div className="proctor-monitoring-canvas">
        <div className="proctor-monitoring-schedules-grid">
          {mockSchedules.map((schedule) => (
            <div key={schedule.id} className="proctor-monitoring-schedule-card">
              <div className="proctor-monitoring-schedule-header">
                <h3 className="proctor-monitoring-schedule-subject">{schedule.subject}</h3>
                <span className="proctor-monitoring-schedule-code">{schedule.course_code}</span>
              </div>
              
              <div className="proctor-monitoring-schedule-details">
                <div className="proctor-monitoring-detail-row">
                  <span className="proctor-monitoring-detail-label">Time Slot:</span>
                  <span className="proctor-monitoring-detail-value">{schedule.time_slot}</span>
                </div>
                <div className="proctor-monitoring-detail-row">
                  <span className="proctor-monitoring-detail-label">Date:</span>
                  <span className="proctor-monitoring-detail-value">{schedule.exam_date}</span>
                </div>
                <div className="proctor-monitoring-detail-row">
                  <span className="proctor-monitoring-detail-label">Building:</span>
                  <span className="proctor-monitoring-detail-value">{schedule.building}</span>
                </div>
                <div className="proctor-monitoring-detail-row">
                  <span className="proctor-monitoring-detail-label">Room:</span>
                  <span className="proctor-monitoring-detail-value">{schedule.room}</span>
                </div>
                <div className="proctor-monitoring-detail-row">
                  <span className="proctor-monitoring-detail-label">Proctor:</span>
                  <span className="proctor-monitoring-detail-value">{schedule.proctor}</span>
                </div>
                <div className="proctor-monitoring-detail-row">
                  <span className="proctor-monitoring-detail-label">Instructor:</span>
                  <span className="proctor-monitoring-detail-value">{schedule.instructor}</span>
                </div>
                <div className="proctor-monitoring-detail-row">
                  <span className="proctor-monitoring-detail-label">Department:</span>
                  <span className="proctor-monitoring-detail-value">{schedule.department}</span>
                </div>
                <div className="proctor-monitoring-detail-row">
                  <span className="proctor-monitoring-detail-label">College:</span>
                  <span className="proctor-monitoring-detail-value">{schedule.college}</span>
                </div>
              </div>

              {/* OTP Field - Blank for now */}
              <div className="proctor-monitoring-otp-section">
                <label className="proctor-monitoring-otp-label">Exam Code (OTP):</label>
                <div className="proctor-monitoring-otp-field">
                  {/* OTP will be generated here */}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ProctorMonitoring;

