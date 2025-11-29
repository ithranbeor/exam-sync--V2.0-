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
  // Mock data - Approved Exam Schedules (Static UI for demonstration)
  // This will be replaced with actual API data from approved schedules
  const approvedSchedules = [
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
      proctor_name: "Mr. Cruz",
      instructor_name: "Ms. Dela Peña",
      department: "Information Technology",
      college: "CITC"
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
      proctor_name: "Dr. Santos",
      instructor_name: "Prof. Garcia",
      department: "Computer Science",
      college: "CITC"
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
      proctor_name: "Ms. Reyes",
      instructor_name: "Dr. Martinez",
      department: "Information Technology",
      college: "CITC"
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
      proctor_name: "Mr. Torres",
      instructor_name: "Ms. Fernandez",
      department: "Computer Science",
      college: "CITC"
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
          {approvedSchedules.map((schedule) => (
            <div key={schedule.id} className="proctor-monitoring-schedule-card">
              <div className="proctor-monitoring-schedule-header">
                <h3 className="proctor-monitoring-schedule-subject">
                  {schedule.course_id} - {schedule.subject}
                </h3>
                <span className="proctor-monitoring-schedule-code">{schedule.course_id}</span>
              </div>
              
              <div className="proctor-monitoring-schedule-details">
                <div className="proctor-monitoring-detail-row">
                  <span className="proctor-monitoring-detail-label">Section:</span>
                  <span className="proctor-monitoring-detail-value">{schedule.section_name}</span>
                </div>
                <div className="proctor-monitoring-detail-row">
                  <span className="proctor-monitoring-detail-label">Date:</span>
                  <span className="proctor-monitoring-detail-value">{schedule.exam_date}</span>
                </div>
                <div className="proctor-monitoring-detail-row">
                  <span className="proctor-monitoring-detail-label">Time:</span>
                  <span className="proctor-monitoring-detail-value">{schedule.exam_start_time} - {schedule.exam_end_time}</span>
                </div>
                <div className="proctor-monitoring-detail-row">
                  <span className="proctor-monitoring-detail-label">Building:</span>
                  <span className="proctor-monitoring-detail-value">{schedule.building_name}</span>
                </div>
                <div className="proctor-monitoring-detail-row">
                  <span className="proctor-monitoring-detail-label">Room:</span>
                  <span className="proctor-monitoring-detail-value">{schedule.room_id}</span>
                </div>
                <div className="proctor-monitoring-detail-row">
                  <span className="proctor-monitoring-detail-label">Proctor:</span>
                  <span className="proctor-monitoring-detail-value">{schedule.proctor_name}</span>
                </div>
                <div className="proctor-monitoring-detail-row">
                  <span className="proctor-monitoring-detail-label">Instructor:</span>
                  <span className="proctor-monitoring-detail-value">{schedule.instructor_name}</span>
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

