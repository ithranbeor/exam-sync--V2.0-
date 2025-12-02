import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { FaSort } from 'react-icons/fa';
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
  const [resettingOtp, setResettingOtp] = useState(false);
  const [collegeFilter, _setCollegeFilter] = useState<string>('');
  const [hasApprovedSchedules, setHasApprovedSchedules] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [sortBy, setSortBy] = useState<string>('none');
  const [showSortDropdown, setShowSortDropdown] = useState(false);

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

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showSortDropdown && !target.closest('[data-sort-dropdown]')) {
        setShowSortDropdown(false);
      }
    };

    if (showSortDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSortDropdown]);

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

  // Handle reset OTP codes
  const handleResetOtpCodes = async () => {
    setResettingOtp(true);
    setShowResetConfirm(false);

    try {
      // Get all schedule IDs that have OTP codes
      const schedulesWithOtp = approvedSchedules
        .filter(s => s.otp_code)
        .map(s => s.id);

      if (schedulesWithOtp.length === 0) {
        toast.info('No OTP codes to reset');
        setResettingOtp(false);
        return;
      }

      const response = await api.post('/reset-exam-otps/', {
        schedule_ids: schedulesWithOtp
      });

      toast.success(`Reset ${response.data.deleted_count} OTP code(s)`);

      // Refresh data
      await fetchMonitoringData();
    } catch (error: any) {
      console.error('Error resetting OTP codes:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Failed to reset OTP codes';
      toast.error(errorMessage);
    } finally {
      setResettingOtp(false);
    }
  };

  // Check if any schedules have OTP codes
  const hasOtpCodes = approvedSchedules.some(s => s.otp_code);

  // Helper function to determine if a string is numeric
  const isNumeric = (str: string): boolean => {
    return !isNaN(Number(str)) && !isNaN(parseFloat(str));
  };

  // Smart sort function that handles both text and numbers
  const smartSort = (a: string, b: string): number => {
    const aIsNumeric = isNumeric(a);
    const bIsNumeric = isNumeric(b);

    if (aIsNumeric && bIsNumeric) {
      // Both are numbers - sort numerically
      return parseFloat(a) - parseFloat(b);
    } else if (aIsNumeric && !bIsNumeric) {
      // a is number, b is text - numbers come first
      return -1;
    } else if (!aIsNumeric && bIsNumeric) {
      // a is text, b is number - numbers come first
      return 1;
    } else {
      // Both are text - sort alphabetically
      return a.localeCompare(b);
    }
  };

  // Sort schedules based on selected sort option
  const sortedSchedules = useMemo(() => {
    if (sortBy === 'none') {
      return approvedSchedules;
    }

    return [...approvedSchedules].sort((a, b) => {
      switch (sortBy) {
        case 'course_id':
          return smartSort(a.course_id.toLowerCase(), b.course_id.toLowerCase());
        case 'subject':
          return smartSort(a.subject.toLowerCase(), b.subject.toLowerCase());
        case 'section_name':
          return smartSort(a.section_name.toLowerCase(), b.section_name.toLowerCase());
        case 'exam_date':
          // Sort dates as strings (YYYY-MM-DD format)
          return a.exam_date.localeCompare(b.exam_date);
        case 'exam_start_time':
          // Sort by start time
          return (a.exam_start_time || '').localeCompare(b.exam_start_time || '');
        case 'building_name':
          return smartSort(a.building_name.toLowerCase(), b.building_name.toLowerCase());
        case 'room_id':
          return smartSort(a.room_id.toLowerCase(), b.room_id.toLowerCase());
        case 'proctor_name':
          return smartSort(a.proctor_name.toLowerCase(), b.proctor_name.toLowerCase());
        case 'instructor_name':
          return smartSort(a.instructor_name.toLowerCase(), b.instructor_name.toLowerCase());
        case 'status':
          return smartSort(a.status.toLowerCase(), b.status.toLowerCase());
        default:
          return 0;
      }
    });
  }, [approvedSchedules, sortBy]);

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

  return (
    <div className="proctor-monitoring-container">
      <ToastContainer position="top-right" autoClose={3000} />

      <div className="proctor-monitoring-header">
        <div className="proctor-monitoring-header-left">
          <p
            className={`proctor-monitoring-label ${hasApprovedSchedules ? 'proctor-monitoring-label-approved' : 'proctor-monitoring-label-waiting'}`}
          >
            {hasApprovedSchedules
              ? '✔ EXAM SCHEDULE HAS BEEN APPROVED. CLICK TO GENERATE EXAM CODES'
              : '✗ EXAM SCHEDULER WAITING FOR APPROVAL'}
          </p>
          <div style={{ marginTop: '10px', position: 'relative' }} data-sort-dropdown>
            <button
              type='button'
              onClick={() => setShowSortDropdown(!showSortDropdown)}
              style={{
                backgroundColor: sortBy !== 'none' ? '#0A3765' : '#0A3765',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                padding: '8px 16px',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                minWidth: '100px',
                transition: 'background-color 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#0d4a7a';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#0A3765';
              }}
              title="Sort by"
            >
              <FaSort />
              <span>Sort by</span>
            </button>
            {showSortDropdown && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  marginTop: '4px',
                  backgroundColor: 'white',
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                  zIndex: 1000,
                  minWidth: '150px'
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setSortBy('none');
                    setShowSortDropdown(false);
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    textAlign: 'left',
                    border: 'none',
                    backgroundColor: sortBy === 'none' ? '#f0f0f0' : 'white',
                    color: '#000',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                  onMouseEnter={(e) => {
                    if (sortBy !== 'none') e.currentTarget.style.backgroundColor = '#f5f5f5';
                  }}
                  onMouseLeave={(e) => {
                    if (sortBy !== 'none') e.currentTarget.style.backgroundColor = 'white';
                  }}
                >
                  None
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSortBy('course_id');
                    setShowSortDropdown(false);
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    textAlign: 'left',
                    border: 'none',
                    backgroundColor: sortBy === 'course_id' ? '#f0f0f0' : 'white',
                    color: '#000',
                    cursor: 'pointer',
                    fontSize: '14px',
                    borderTop: '1px solid #eee'
                  }}
                  onMouseEnter={(e) => {
                    if (sortBy !== 'course_id') e.currentTarget.style.backgroundColor = '#f5f5f5';
                  }}
                  onMouseLeave={(e) => {
                    if (sortBy !== 'course_id') e.currentTarget.style.backgroundColor = 'white';
                  }}
                >
                  Course Code
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSortBy('subject');
                    setShowSortDropdown(false);
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    textAlign: 'left',
                    border: 'none',
                    backgroundColor: sortBy === 'subject' ? '#f0f0f0' : 'white',
                    color: '#000',
                    cursor: 'pointer',
                    fontSize: '14px',
                    borderTop: '1px solid #eee'
                  }}
                  onMouseEnter={(e) => {
                    if (sortBy !== 'subject') e.currentTarget.style.backgroundColor = '#f5f5f5';
                  }}
                  onMouseLeave={(e) => {
                    if (sortBy !== 'subject') e.currentTarget.style.backgroundColor = 'white';
                  }}
                >
                  Subject
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSortBy('section_name');
                    setShowSortDropdown(false);
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    textAlign: 'left',
                    border: 'none',
                    backgroundColor: sortBy === 'section_name' ? '#f0f0f0' : 'white',
                    color: '#000',
                    cursor: 'pointer',
                    fontSize: '14px',
                    borderTop: '1px solid #eee'
                  }}
                  onMouseEnter={(e) => {
                    if (sortBy !== 'section_name') e.currentTarget.style.backgroundColor = '#f5f5f5';
                  }}
                  onMouseLeave={(e) => {
                    if (sortBy !== 'section_name') e.currentTarget.style.backgroundColor = 'white';
                  }}
                >
                  Section
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSortBy('exam_date');
                    setShowSortDropdown(false);
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    textAlign: 'left',
                    border: 'none',
                    backgroundColor: sortBy === 'exam_date' ? '#f0f0f0' : 'white',
                    color: '#000',
                    cursor: 'pointer',
                    fontSize: '14px',
                    borderTop: '1px solid #eee'
                  }}
                  onMouseEnter={(e) => {
                    if (sortBy !== 'exam_date') e.currentTarget.style.backgroundColor = '#f5f5f5';
                  }}
                  onMouseLeave={(e) => {
                    if (sortBy !== 'exam_date') e.currentTarget.style.backgroundColor = 'white';
                  }}
                >
                  Date
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSortBy('exam_start_time');
                    setShowSortDropdown(false);
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    textAlign: 'left',
                    border: 'none',
                    backgroundColor: sortBy === 'exam_start_time' ? '#f0f0f0' : 'white',
                    color: '#000',
                    cursor: 'pointer',
                    fontSize: '14px',
                    borderTop: '1px solid #eee'
                  }}
                  onMouseEnter={(e) => {
                    if (sortBy !== 'exam_start_time') e.currentTarget.style.backgroundColor = '#f5f5f5';
                  }}
                  onMouseLeave={(e) => {
                    if (sortBy !== 'exam_start_time') e.currentTarget.style.backgroundColor = 'white';
                  }}
                >
                  Time
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSortBy('building_name');
                    setShowSortDropdown(false);
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    textAlign: 'left',
                    border: 'none',
                    backgroundColor: sortBy === 'building_name' ? '#f0f0f0' : 'white',
                    color: '#000',
                    cursor: 'pointer',
                    fontSize: '14px',
                    borderTop: '1px solid #eee'
                  }}
                  onMouseEnter={(e) => {
                    if (sortBy !== 'building_name') e.currentTarget.style.backgroundColor = '#f5f5f5';
                  }}
                  onMouseLeave={(e) => {
                    if (sortBy !== 'building_name') e.currentTarget.style.backgroundColor = 'white';
                  }}
                >
                  Building
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSortBy('room_id');
                    setShowSortDropdown(false);
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    textAlign: 'left',
                    border: 'none',
                    backgroundColor: sortBy === 'room_id' ? '#f0f0f0' : 'white',
                    color: '#000',
                    cursor: 'pointer',
                    fontSize: '14px',
                    borderTop: '1px solid #eee'
                  }}
                  onMouseEnter={(e) => {
                    if (sortBy !== 'room_id') e.currentTarget.style.backgroundColor = '#f5f5f5';
                  }}
                  onMouseLeave={(e) => {
                    if (sortBy !== 'room_id') e.currentTarget.style.backgroundColor = 'white';
                  }}
                >
                  Room
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSortBy('proctor_name');
                    setShowSortDropdown(false);
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    textAlign: 'left',
                    border: 'none',
                    backgroundColor: sortBy === 'proctor_name' ? '#f0f0f0' : 'white',
                    color: '#000',
                    cursor: 'pointer',
                    fontSize: '14px',
                    borderTop: '1px solid #eee'
                  }}
                  onMouseEnter={(e) => {
                    if (sortBy !== 'proctor_name') e.currentTarget.style.backgroundColor = '#f5f5f5';
                  }}
                  onMouseLeave={(e) => {
                    if (sortBy !== 'proctor_name') e.currentTarget.style.backgroundColor = 'white';
                  }}
                >
                  Proctor
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSortBy('instructor_name');
                    setShowSortDropdown(false);
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    textAlign: 'left',
                    border: 'none',
                    backgroundColor: sortBy === 'instructor_name' ? '#f0f0f0' : 'white',
                    color: '#000',
                    cursor: 'pointer',
                    fontSize: '14px',
                    borderTop: '1px solid #eee'
                  }}
                  onMouseEnter={(e) => {
                    if (sortBy !== 'instructor_name') e.currentTarget.style.backgroundColor = '#f5f5f5';
                  }}
                  onMouseLeave={(e) => {
                    if (sortBy !== 'instructor_name') e.currentTarget.style.backgroundColor = 'white';
                  }}
                >
                  Instructor
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSortBy('status');
                    setShowSortDropdown(false);
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    textAlign: 'left',
                    border: 'none',
                    backgroundColor: sortBy === 'status' ? '#f0f0f0' : 'white',
                    color: '#000',
                    cursor: 'pointer',
                    fontSize: '14px',
                    borderTop: '1px solid #eee'
                  }}
                  onMouseEnter={(e) => {
                    if (sortBy !== 'status') e.currentTarget.style.backgroundColor = '#f5f5f5';
                  }}
                  onMouseLeave={(e) => {
                    if (sortBy !== 'status') e.currentTarget.style.backgroundColor = 'white';
                  }}
                >
                  Status
                </button>
              </div>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
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

          <button
            className="proctor-monitoring-reset-button"
            onClick={() => setShowResetConfirm(true)}
            disabled={resettingOtp || loading || !hasOtpCodes}
            style={{
              opacity: hasOtpCodes ? 1 : 0.6,
              cursor: hasOtpCodes ? 'pointer' : 'not-allowed',
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '5px',
              fontWeight: 'bold',
              fontSize: '14px'
            }}
          >
            {resettingOtp ? 'RESETTING...' : 'RESET EXAM CODES'}
          </button>
        </div>
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
                {sortedSchedules.length > 0 ? (
                  sortedSchedules.map((schedule, index) => {
                    // Determine status based on schedule data (can be updated to use actual status from backend)
                    const status = schedule.status || 'pending'; // 'confirmed', 'late', 'absent', 'substitute'

                    const getStatusDisplay = (status: string) => {
                      switch (status.toLowerCase()) {
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
                        <td>{formatTo12Hour(schedule.exam_start_time)} - {formatTo12Hour(schedule.exam_end_time)}</td>
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

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 9999
          }}
          onClick={() => setShowResetConfirm(false)}
        >
          <div
            style={{
              backgroundColor: 'white',
              padding: '30px',
              borderRadius: '10px',
              maxWidth: '500px',
              width: '90%',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0, color: '#dc3545' }}>⚠️ Reset Exam Codes</h3>
            <p style={{ marginBottom: '20px', color: '#666' }}>
              Are you sure you want to reset all exam codes? This action will:
            </p>
            <ul style={{ textAlign: 'left', color: '#666', marginBottom: '20px' }}>
              <li>Delete all existing OTP codes</li>
              <li>Require generating new codes</li>
              <li>Cannot be undone</li>
            </ul>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowResetConfirm(false)}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleResetOtpCodes}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                Yes, Reset All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProctorMonitoring;