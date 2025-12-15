import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { FaSort, FaSearch, FaFilter } from 'react-icons/fa';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import api from '../lib/apiClient';
import '../styles/P_ProctorMonitoring.css';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Extend jsPDF type to include autoTable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

interface UserProps {
  user: {
    user_id: number;
    email: string;
    first_name?: string;
    last_name?: string;
  } | null;
}

// ✅ FIXED: Made status optional since we use examdetails_status as primary
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
  examdetails_status: string;  // ✅ Primary status field from backend
  status?: string;  // ✅ Optional legacy field for compatibility
  code_entry_time: string | null;
  otp_code: string | null;
  approval_status?: string;
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
  const [searchTerm, setSearchTerm] = useState('');
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'present' | 'absent' | 'substitute' | 'pending'>('all');

  useEffect(() => {
    if (approvedSchedules.length === 0) return;

    const now = new Date();

    approvedSchedules.forEach(async (s) => {
      const examEnd = new Date(`${s.exam_date}T${s.exam_end_time}`);
      const hasTimeIn = Boolean(s.code_entry_time);

      // ✅ Use examdetails_status as primary
      const currentStatus = (s.examdetails_status || '').toLowerCase();

      if (now > examEnd && !hasTimeIn && currentStatus === 'pending') {
        try {
          setTimeout(() => fetchMonitoringData(), 500);
          await api.patch(`/update-proctor-status/${s.id}/`, {
            status: 'absent',
          });

          console.log(`Auto-marked absent for schedule ${s.id}`);
        } catch (err) {
          console.error('Failed to auto-mark absent:', err);
        }
      }
    });
  }, [approvedSchedules]);

  // ✅ FIXED: Fetch and filter for multiple proctors
  const fetchMonitoringData = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (collegeFilter) {
        params.college_name = collegeFilter;
      }

      // ✅ Get ALL exam details (not filtered by proctor yet)
      const { data: examData } = await api.get('/proctor-monitoring/', { params });

      // ✅ PERFORMANCE FIX: Fetch ALL approvals in ONE request
      const approvalResponse = await api.get('/tbl_scheduleapproval/', {
        params: { status: 'approved' },
      });

      // Create a Set of approved colleges for O(1) lookup
      const approvedColleges = new Set(
        approvalResponse.data.map((approval: any) => approval.college_name),
      );

      // ✅ FIXED: Map schedules with examdetails_status as primary
      const schedulesWithApproval = examData.map((schedule: any) => {
        const isApproved = approvedColleges.has(schedule.college);

        const mappedSchedule: MonitoringSchedule = {
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
          examdetails_status: schedule.examdetails_status || schedule.status || 'pending',
          status: schedule.status,
          code_entry_time: schedule.code_entry_time || null,
          otp_code: schedule.otp_code || null,
          approval_status: isApproved ? 'approved' : 'pending',
        };

        return mappedSchedule;
      });

      // Filter to show ONLY approved schedules
      const approvedOnly = schedulesWithApproval.filter(
        (schedule: MonitoringSchedule) => schedule.approval_status === 'approved',
      );

      setApprovedSchedules(approvedOnly);
      setHasApprovedSchedules(approvedOnly.length > 0);

      if (approvedOnly.length === 0) {
        toast.info('No approved schedules yet. Waiting for dean approval.');
      }
    } catch (error: any) {
      console.error('Error fetching monitoring data:', error);
      toast.error('Failed to load monitoring data');
      setHasApprovedSchedules(false);
    } finally {
      setLoading(false);
    }
  }, [collegeFilter]);

  useEffect(() => {
    fetchMonitoringData();
  }, [fetchMonitoringData]);

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

  const handleGenerateOtpCodes = async () => {
    setGeneratingOtp(true);
    try {
      const schedulesWithoutOtp = approvedSchedules
        .filter((s) => !s.otp_code)
        .map((s) => s.id);

      if (schedulesWithoutOtp.length === 0) {
        toast.info('All schedules already have OTP codes');
        return;
      }

      const response = await api.post('/generate-exam-otps/', {
        schedule_ids: schedulesWithoutOtp,
      });

      toast.success(`Generated OTP codes for ${response.data.generated_count} schedule(s)`);
      await fetchMonitoringData();
    } catch (error: any) {
      console.error('Error generating OTP codes:', error);
      const errorMessage =
        error.response?.data?.error || error.message || 'Failed to generate OTP codes';
      toast.error(errorMessage);
    } finally {
      setGeneratingOtp(false);
    }
  };

  const handleResetOtpCodes = async () => {
    setResettingOtp(true);
    setShowResetConfirm(false);

    try {
      const schedulesWithOtp = approvedSchedules
        .filter((s) => s.otp_code)
        .map((s) => s.id);

      if (schedulesWithOtp.length === 0) {
        toast.info('No OTP codes to reset');
        setResettingOtp(false);
        return;
      }

      const response = await api.post('/reset-exam-otps/', {
        schedule_ids: schedulesWithOtp,
      });

      toast.success(`Reset ${response.data.deleted_count} OTP code(s)`);
      await fetchMonitoringData();
    } catch (error: any) {
      console.error('Error resetting OTP codes:', error);
      const errorMessage =
        error.response?.data?.error || error.message || 'Failed to reset OTP codes';
      toast.error(errorMessage);
    } finally {
      setResettingOtp(false);
    }
  };

  const formatTo12Hour = (timeString: string | undefined) => {
    if (!timeString) return '-';

    try {
      const date = new Date(timeString);

      const options: Intl.DateTimeFormatOptions = {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: 'Asia/Manila',
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

  const handleExportPDF = () => {
    if (sortedSchedules.length === 0) {
      toast.info('No data to export');
      return;
    }

    // Check if all schedules have OTP codes
    const hasAllCodes = sortedSchedules.every((s) => s.otp_code);
    if (!hasAllCodes) {
      toast.error('Cannot export: Some schedules do not have exam codes yet. Please generate codes first.');
      return;
    }

    const formatTimeIn = (timeString: string | null | undefined) => {
      if (!timeString) return 'Not yet';
      try {
        const date = new Date(timeString);
        let hours = date.getHours();
        const minutes = date.getMinutes().toString().padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours === 0 ? 12 : hours;
        return `${hours}:${minutes} ${ampm}`;
      } catch (e) {
        return 'Invalid';
      }
    };

    // ✅ FIXED: Get display status for PDF
    const getStatusDisplay = (status: string) => {
      const normalized = status.toLowerCase().trim();
      if (normalized.includes('late')) return 'LATE';
      if (normalized.includes('confirm') || normalized.includes('present')) return 'PRESENT';
      if (normalized.includes('absent')) return 'ABSENT';
      if (normalized.includes('sub')) return 'SUBSTITUTE';
      return 'PENDING';
    };

    const doc = new jsPDF('landscape', 'mm', 'a4');

    // Title
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('EXAM MONITORING REPORT', 148, 15, { align: 'center' });

    // Date generated
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `Generated: ${new Date().toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })}`,
      148,
      22,
      { align: 'center' },
    );

    // ✅ FIXED: Prepare table data using examdetails_status
    const tableData = sortedSchedules.map((schedule, index) => [
      (index + 1).toString(),
      schedule.course_id,
      schedule.section_name,
      schedule.exam_date,
      `${formatTo12Hour(schedule.exam_start_time)}\n${formatTo12Hour(schedule.exam_end_time)}`,
      `${schedule.building_name}\nRoom ${schedule.room_id}`,
      schedule.instructor_name,
      schedule.proctor_name,
      schedule.otp_code || 'N/A',
      formatTimeIn(schedule.code_entry_time),
      getStatusDisplay(schedule.examdetails_status),  // ✅ Use examdetails_status
    ]);

    // Add table using autoTable function directly
    autoTable(doc, {
      startY: 28,
      head: [['#', 'Course', 'Section', 'Date', 'Time', 'Location', 'Instructor', 'Proctor', 'Exam Code', 'Time In', 'Status']],
      body: tableData,
      styles: {
        fontSize: 8,
        cellPadding: 2,
        lineColor: [200, 200, 200],
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: [10, 55, 101],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: 'center',
      },
      columnStyles: {
        0: { cellWidth: 8, halign: 'center' },
        1: { cellWidth: 20 },
        2: { cellWidth: 18 },
        3: { cellWidth: 22 },
        4: { cellWidth: 24, fontSize: 7 },
        5: { cellWidth: 28, fontSize: 7 },
        6: { cellWidth: 30 },
        7: { cellWidth: 30 },
        8: { cellWidth: 22, halign: 'center', fontStyle: 'bold' },
        9: { cellWidth: 18, halign: 'center' },
        10: { cellWidth: 20, halign: 'center', fontStyle: 'bold' },
      },
      bodyStyles: {
        valign: 'middle',
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245],
      },
      didDrawCell: (data: any) => {
        // Color code status column
        if (data.column.index === 10 && data.section === 'body') {
          const status = String(data.cell.raw).toLowerCase();
          let color: [number, number, number];
          if (status.includes('confirm') || status.includes('present')) {
            color = [40, 167, 69]; // Green
          } else if (status.includes('late')) {
            color = [255, 193, 7]; // Yellow
          } else if (status.includes('absent')) {
            color = [220, 53, 69]; // Red
          } else if (status.includes('substitute')) {
            color = [23, 162, 184]; // Cyan
          } else {
            color = [108, 117, 125]; // Gray
          }
          doc.setTextColor(color[0], color[1], color[2]);
          doc.setFont('helvetica', 'bold');
        }
      },
    });

    // Footer
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(128, 128, 128);
      doc.text(
        `Page ${i} of ${pageCount}`,
        148,
        doc.internal.pageSize.height - 10,
        { align: 'center' },
      );
    }

    // Save PDF
    doc.save(`exam_monitoring_${new Date().toISOString().split('T')[0]}.pdf`);
    toast.success('PDF exported successfully!');
  };

  const hasOtpCodes = approvedSchedules.some(s => s.otp_code);

  const isNumeric = (str: string): boolean => {
    return !isNaN(Number(str)) && !isNaN(parseFloat(str));
  };

  const smartSort = (a: string, b: string): number => {
    const aIsNumeric = isNumeric(a);
    const bIsNumeric = isNumeric(b);

    if (aIsNumeric && bIsNumeric) {
      return parseFloat(a) - parseFloat(b);
    } else if (aIsNumeric && !bIsNumeric) {
      return -1;
    } else if (!aIsNumeric && bIsNumeric) {
      return 1;
    } else {
      return a.localeCompare(b);
    }
  };

  const sortedSchedules = useMemo(() => {
    let data = approvedSchedules;

    // ✅ FIXED: Search using examdetails_status
    if (searchTerm && searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      data = data.filter((schedule) => {
        const combined = [
          schedule.course_id,
          schedule.subject,
          schedule.section_name,
          schedule.exam_date,
          schedule.exam_start_time,
          schedule.exam_end_time,
          schedule.building_name,
          schedule.room_id,
          schedule.proctor_name,
          schedule.instructor_name,
          schedule.examdetails_status,  // ✅ Use examdetails_status
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        return combined.includes(term);
      });
    }

    // ✅ FIXED: Apply status filter using examdetails_status
    if (statusFilter && statusFilter !== 'all') {
      data = data.filter((schedule) => {
        const status = (schedule.examdetails_status || '').toLowerCase();
        if (statusFilter === 'present') {
          return status.includes('confirm') || status.includes('present');
        }
        if (statusFilter === 'absent') return status.includes('absent');
        if (statusFilter === 'substitute') return status.includes('sub');
        if (statusFilter === 'pending') return status.includes('pending') || status === '';
        return true;
      });
    }

    if (sortBy === 'none') {
      return data;
    }

    // ✅ FIXED: Sort using examdetails_status
    return [...data].sort((a, b) => {
      switch (sortBy) {
        case 'course_id':
          return smartSort(a.course_id.toLowerCase(), b.course_id.toLowerCase());
        case 'subject':
          return smartSort(a.subject.toLowerCase(), b.subject.toLowerCase());
        case 'section_name':
          return smartSort(a.section_name.toLowerCase(), b.section_name.toLowerCase());
        case 'exam_date':
          return a.exam_date.localeCompare(b.exam_date);
        case 'exam_start_time':
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
          return smartSort(a.examdetails_status.toLowerCase(), b.examdetails_status.toLowerCase());  // ✅ Use examdetails_status
        default:
          return 0;
      }
    });
  }, [approvedSchedules, sortBy, searchTerm, statusFilter]);

  return (
    <div className="proctor-monitoring-container">
      <ToastContainer position="top-right" autoClose={3000} />

      <div className="proctor-monitoring-header">
        <div className="proctor-monitoring-header-left">
          <p
            className={`proctor-monitoring-label ${hasApprovedSchedules
              ? 'proctor-monitoring-label-approved'
              : 'proctor-monitoring-label-waiting'
              }`}
          >
            {hasApprovedSchedules
              ? 'EXAM SCHEDULE HAS BEEN APPROVED. CLICK TO GENERATE EXAM CODES'
              : 'WAITING FOR DEAN APPROVAL'}
          </p>
          <div className="pm-button-row" data-sort-dropdown>
            <button type='button' className="pm-control-button pm-sort-button" onClick={() => setShowSortDropdown(!showSortDropdown)} title="Sort by">
              <FaSort />
              <span>Sort by</span>
            </button>
            {/* Status filter button - same design as Sort by button */}
            <div className="pm-status-wrapper" data-status-dropdown>
              <button type='button' className="pm-control-button pm-status-button" onClick={() => setShowStatusDropdown(!showStatusDropdown)} title="Filter by status">
                <FaFilter />
                <span>{statusFilter === 'all' ? 'Status' : statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)}</span>
              </button>

              {showStatusDropdown && (
                <div className="pm-dropdown">
                  {['all', 'present', 'absent', 'substitute', 'pending'].map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => { setStatusFilter(opt as any); setShowStatusDropdown(false); }}
                      className={`pm-dropdown-item ${statusFilter === opt ? 'active' : ''}`}
                    >
                      {opt === 'all' ? 'All' : opt.charAt(0).toUpperCase() + opt.slice(1)}
                    </button>
                  ))}
                </div>
              )}
            </div>
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
                {['none', 'course_id', 'subject', 'section_name', 'exam_date', 'exam_start_time', 'building_name', 'room_id', 'proctor_name', 'instructor_name', 'status'].map((sortOption) => (
                  <button
                    key={sortOption}
                    type="button"
                    onClick={() => {
                      setSortBy(sortOption);
                      setShowSortDropdown(false);
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      textAlign: 'left',
                      border: 'none',
                      backgroundColor: sortBy === sortOption ? '#f0f0f0' : 'white',
                      color: '#000',
                      cursor: 'pointer',
                      fontSize: '14px',
                      borderTop: sortOption !== 'none' ? '1px solid #eee' : 'none'
                    }}
                    onMouseEnter={(e) => {
                      if (sortBy !== sortOption) e.currentTarget.style.backgroundColor = '#f5f5f5';
                    }}
                    onMouseLeave={(e) => {
                      if (sortBy !== sortOption) e.currentTarget.style.backgroundColor = 'white';
                    }}
                  >
                    {sortOption === 'none' ? 'None' :
                      sortOption === 'course_id' ? 'Course Code' :
                        sortOption === 'section_name' ? 'Section' :
                          sortOption === 'exam_date' ? 'Date' :
                            sortOption === 'exam_start_time' ? 'Time' :
                              sortOption === 'building_name' ? 'Building' :
                                sortOption === 'room_id' ? 'Room' :
                                  sortOption === 'proctor_name' ? 'Proctor' :
                                    sortOption === 'instructor_name' ? 'Instructor' :
                                      sortOption === 'status' ? 'Status' :
                                        sortOption.charAt(0).toUpperCase() + sortOption.slice(1)}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="pm-actions-column">
          <div className="search-bar">
            <input
              type="text"
              placeholder="Search by course, proctor, room..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <button type="button" className="search-button">
              <FaSearch />
            </button>
          </div>

          <div className="pm-action-buttons-row">
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

            <button
              onClick={handleExportPDF}
              disabled={loading || sortedSchedules.length === 0 || !sortedSchedules.every(s => s.otp_code)}
              style={{
                opacity: (sortedSchedules.length > 0 && sortedSchedules.every(s => s.otp_code)) ? 1 : 0.6,
                cursor: (sortedSchedules.length > 0 && sortedSchedules.every(s => s.otp_code)) ? 'pointer' : 'not-allowed',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '5px',
                fontWeight: 'bold',
                fontSize: '14px'
              }}
            >
              EXPORT TO PDF
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="no-data-message">Loading monitoring data...</div>
      ) : (
        <>
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
                  <th>Exam Code</th>
                  <th>Time In</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {sortedSchedules.length > 0 ? (
                  sortedSchedules.map((schedule, index) => {
                    // ✅ FIXED: Use examdetails_status directly
                    const backendStatus = schedule.examdetails_status;

                    const getStatusDisplay = (status: string) => {
                      const normalized = status.toLowerCase().trim();

                      // Check "late" BEFORE "confirm"
                      if (normalized.includes('late')) {
                        return { text: 'Late', className: 'status-late' };
                      }

                      if (normalized.includes('confirm') || normalized.includes('present')) {
                        return { text: 'Present', className: 'status-confirmed' };
                      }

                      if (normalized.includes('absent')) {
                        return { text: 'Absent', className: 'status-absent' };
                      }

                      if (normalized.includes('sub')) {
                        return { text: 'Substitute', className: 'status-substitute' };
                      }

                      return { text: 'Pending', className: 'status-pending' };
                    };

                    const statusDisplay = getStatusDisplay(backendStatus);

                    const formatTimeIn = (timeString: string | null | undefined) => {
                      if (!timeString) return '-';
                      try {
                        const date = new Date(timeString);
                        let hours = date.getHours();
                        const minutes = date.getMinutes().toString().padStart(2, '0');

                        const ampm = hours >= 12 ? 'PM' : 'AM';
                        hours = hours % 12;
                        hours = hours === 0 ? 12 : hours;

                        return `${hours}:${minutes} ${ampm}`;
                      } catch (e) {
                        return '-';
                      }
                    };

                    const codeEntryTime = schedule.code_entry_time;

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
                          {/* ✅ FIXED: Display statusDisplay.text from examdetails_status */}
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
                      {hasApprovedSchedules
                        ? 'No approved schedules found'
                        : 'No approved schedules yet. Schedules must be approved by the dean before codes can be generated.'}
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