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
      college: "CITC",
      status: "confirmed", // 'confirmed', 'late', 'absent', 'substitute'
      code_entry_time: "2024-01-15T08:05:23" // When proctor entered the code
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
      college: "CITC",
      status: "late",
      code_entry_time: "2024-01-15T10:15:42" // Entered late
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
      college: "CITC",
      status: "substitute",
      code_entry_time: "2024-01-16T00:58:15" // Substitute entered code
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
      college: "CITC",
      status: "absent",
      code_entry_time: null // No code entered - absent
    }
  ];

  return (
    <div className="proctor-monitoring-container">
      <div className="proctor-monitoring-header">
        <div className="proctor-monitoring-header-left">
          <p className="proctor-monitoring-label">
            EXAM SCHEDULE HAS BEEN APPROVED. CLICK TO GENERATE EXAM CODES
          </p>
        </div>
        <button className="proctor-monitoring-create-button">
          CLICK TO GENERATE EXAM CODES
        </button>
      </div>
      
      {/* Table Area */}
      <div className="proctor-monitoring-table-container">
        <table className="proctor-monitoring-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Course Code</th>
              <th>Subject</th>
              <th>Section</th>
              <th>Date</th>
              <th>Time</th>
              <th>Building</th>
              <th>Room</th>
              <th>Proctor</th>
              <th>Instructor</th>
              <th>Exam Code (OTP)</th>
              <th>Time In</th>
              <th>Status of Proctorship</th>
            </tr>
          </thead>
          <tbody>
            {approvedSchedules.length > 0 ? (
              approvedSchedules.map((schedule, index) => {
                // Determine status based on schedule data (can be updated to use actual status from backend)
                const status = schedule.status || 'pending'; // 'confirmed', 'late', 'absent', 'substitute'
                
                const getStatusDisplay = (status: string) => {
                  switch(status.toLowerCase()) {
                    case 'confirmed':
                    case 'confirm':
                      return { text: 'Confirmed', className: 'status-confirmed' };
                    case 'late':
                    case 'absent':
                      return { text: status === 'late' ? 'Late' : 'Absent', className: 'status-late-absent' };
                    case 'substitute':
                    case 'sub':
                      return { text: 'Substitute', className: 'status-substitute' };
                    default:
                      return { text: 'Pending', className: 'status-pending' };
                  }
                };

                const statusDisplay = getStatusDisplay(status);

                // Format time entry
                const formatTimeIn = (timeString: string | null | undefined) => {
                  if (!timeString) return '-';
                  try {
                    const date = new Date(timeString);
                    // Format as HH:MM (hours and minutes only)
                    const hours = date.getHours().toString().padStart(2, '0');
                    const minutes = date.getMinutes().toString().padStart(2, '0');
                    return `${hours}:${minutes}`;
                  } catch (e) {
                    return '-';
                  }
                };

                const codeEntryTime = schedule.code_entry_time || (schedule as any).proctor_timein;

                return (
                  <tr key={schedule.id}>
                    <td>{index + 1}</td>
                    <td>{schedule.course_id}</td>
                    <td>{schedule.subject}</td>
                    <td>{schedule.section_name}</td>
                    <td>{schedule.exam_date}</td>
                    <td>{schedule.exam_start_time} - {schedule.exam_end_time}</td>
                    <td>{schedule.building_name}</td>
                    <td>{schedule.room_id}</td>
                    <td>{schedule.proctor_name}</td>
                    <td>{schedule.instructor_name}</td>
                    <td>
                      <div className="proctor-monitoring-otp-field">
                        {/* OTP will be generated here */}
                      </div>
                    </td>
                    <td className="proctor-monitoring-time-in">
                      {formatTimeIn(codeEntryTime)}
                    </td>
                    <td>
                      <span className={`status-badge ${statusDisplay.className}`}>
                        {statusDisplay.text}
                      </span>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={13} className="no-data-message">
                  No approved schedules found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ProctorMonitoring;

