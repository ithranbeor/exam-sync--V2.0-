import React, { useState, useEffect, useCallback } from 'react';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import api from '../lib/apiClient';
import '../styles/ProctorMonitoring.css';

interface UserProps {
  user: {
    user_id: number;
    email: string;
    first_name?: string;
    last_name?: string;
  } | null;
}

interface MonitoringSchedule {
  id: number;
  course_id: string;
  subject: string;
  section_name: string;
  exam_date: string;
  exam_start_time: string;
  exam_end_time: string;
  building_name: string;
  room_id: string;
  proctor_name: string;
  instructor_name: string;
  department: string;
  college: string;
  status: string;
  code_entry_time: string | null;
  otp_code: string | null;
}

const ProctorMonitoring: React.FC<UserProps> = ({ }) => {
  const [approvedSchedules, setApprovedSchedules] = useState<MonitoringSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingOtp, setGeneratingOtp] = useState(false);
  const [collegeFilter, _setCollegeFilter] = useState<string>('');
  const [hasApprovedSchedules, setHasApprovedSchedules] = useState(false);

  // Fetch monitoring data
  const fetchMonitoringData = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (collegeFilter) {
        params.college_name = collegeFilter;
      }
      
      const { data } = await api.get('/proctor-monitoring/', { params });
      
      const formattedSchedules: MonitoringSchedule[] = data.map((schedule: any) => ({
        id: schedule.id,
        course_id: schedule.course_id,
        subject: schedule.subject || schedule.course_id,
        section_name: schedule.section_name || '',
        exam_date: schedule.exam_date || '',
        exam_start_time: schedule.exam_start_time || '',
        exam_end_time: schedule.exam_end_time || '',
        building_name: schedule.building_name || '',
        room_id: schedule.room_id || '',
        proctor_name: schedule.proctor_name || '',
        instructor_name: schedule.instructor_name || '',
        department: schedule.department || '',
        college: schedule.college || '',
        status: schedule.status || 'pending',
        code_entry_time: schedule.code_entry_time || null,
        otp_code: schedule.otp_code || null
      }));
      
      setApprovedSchedules(formattedSchedules);
      setHasApprovedSchedules(formattedSchedules.length > 0);
    } catch (error: any) {
      console.error('Error fetching monitoring data:', error);
      toast.error('Failed to load monitoring data');
      setHasApprovedSchedules(false);
    } finally {
      setLoading(false);
    }
  }, [collegeFilter]);

  // Load data on mount and when filter changes
  useEffect(() => {
    fetchMonitoringData();
  }, [fetchMonitoringData]);

  // Handle generate OTP codes
  const handleGenerateOtpCodes = async () => {
    setGeneratingOtp(true);
    try {
      // Get all schedule IDs that don't have OTP codes yet
      const schedulesWithoutOtp = approvedSchedules
        .filter(s => !s.otp_code)
        .map(s => s.id);

      if (schedulesWithoutOtp.length === 0) {
        toast.info('All schedules already have OTP codes');
        return;
      }

      const response = await api.post('/generate-exam-otps/', {
        schedule_ids: schedulesWithoutOtp
      });

          toast.success(`Generated OTP codes for ${response.data.generated_count} schedule(s)`);
      
      // Refresh data
      await fetchMonitoringData();
    } catch (error: any) {
      console.error('Error generating OTP codes:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Failed to generate OTP codes';
      toast.error(errorMessage);
    } finally {
      setGeneratingOtp(false);
    }
  };


  return (
    <div className="proctor-monitoring-container">
      <ToastContainer position="top-right" autoClose={3000} />
      
      <div className="proctor-monitoring-header">
        <div className="proctor-monitoring-header-left">
          <p 
            className="proctor-monitoring-label"
            style={{
              color: hasApprovedSchedules ? '#28a745' : '#666',
              fontWeight: hasApprovedSchedules ? 'bold' : 'normal',
              fontSize: hasApprovedSchedules ? '1.1em' : '1em'
            }}
          >
            {hasApprovedSchedules 
              ? '✅ EXAM SCHEDULE HAS BEEN APPROVED. CLICK TO GENERATE EXAM CODES'
              : 'EXAM SCHEDULE HAS BEEN APPROVED. CLICK TO GENERATE EXAM CODES'}
          </p>
        </div>
        <button 
          className="proctor-monitoring-create-button"
          onClick={handleGenerateOtpCodes}
          disabled={generatingOtp || loading || !hasApprovedSchedules}
          style={{
            opacity: hasApprovedSchedules ? 1 : 0.6,
            cursor: hasApprovedSchedules ? 'pointer' : 'not-allowed'
          }}
        >
          {generatingOtp ? 'GENERATING...' : 'GENERATE EXAM CODES'}
        </button>
      </div>
      
      {loading ? (
        <div className="no-data-message">Loading monitoring data...</div>
      ) : (
        <>
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
                  <th>Status</th>
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
                        {schedule.otp_code ? (
                          <span style={{ 
                            fontFamily: 'monospace', 
                            fontWeight: 'bold',
                            color: '#2c3e50',
                            fontSize: '0.9em'
                          }}>
                            {schedule.otp_code}
                          </span>
                        ) : (
                          <span style={{ color: '#999', fontStyle: 'italic' }}>
                            Not generated
                          </span>
                        )}
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
        </>
      )}
    </div>
  );
};

export default ProctorMonitoring;

