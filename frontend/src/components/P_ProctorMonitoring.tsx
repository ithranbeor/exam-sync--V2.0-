import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { FaSort, FaSearch, FaFilter } from 'react-icons/fa';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import api from '../lib/apiClient';
import '../styles/P_ProctorMonitoring.css';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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

interface ProctorDetail {
  proctor_id: number;
  proctor_name: string;
  status: string;
  time_in: string | null;
  is_assigned?: boolean;
  is_substitute?: boolean;
  substituted_for?: string;
  substitution_remarks?: string;
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
  proctor_details: ProctorDetail[];
  instructor_name: string;
  department: string;
  college: string;
  examdetails_status: string;
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
  const [selectedSchedule, setSelectedSchedule] = useState<MonitoringSchedule | null>(null);
  const [showProctorModal, setShowProctorModal] = useState(false);
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [showHistoryFilters, setShowHistoryFilters] = useState(false);
  const [historySortOrder, setHistorySortOrder] = useState<'newest' | 'oldest'>('newest');

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i);

  const monthOptions = [
    { value: '01', label: 'January' },
    { value: '02', label: 'February' },
    { value: '03', label: 'March' },
    { value: '04', label: 'April' },
    { value: '05', label: 'May' },
    { value: '06', label: 'June' },
    { value: '07', label: 'July' },
    { value: '08', label: 'August' },
    { value: '09', label: 'September' },
    { value: '10', label: 'October' },
    { value: '11', label: 'November' },
    { value: '12', label: 'December' },
  ];

  useEffect(() => {
    if (approvedSchedules.length === 0) return;

    const now = new Date();

    approvedSchedules.forEach(async (s) => {
      const examEnd = new Date(`${s.exam_date}T${s.exam_end_time}`);

      const hasAnyTimeIn = s.proctor_details.some(p => p.time_in);
      const currentStatus = (s.examdetails_status || '').toLowerCase();

      if (now > examEnd && !hasAnyTimeIn && currentStatus === 'pending') {
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

  const handleRowClick = (schedule: MonitoringSchedule) => {
    setSelectedSchedule(schedule);
    setShowProctorModal(true);
  };

  const fetchMonitoringData = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (collegeFilter) {
        params.college_name = collegeFilter;
      }
      if (selectedYear !== 'all') {
        params.year = selectedYear;
      }
      if (selectedMonth !== 'all') {
        params.month = selectedMonth;
      }

      const { data: examData } = await api.get('/proctor-monitoring/', { params });

      const approvalResponse = await api.get('/tbl_scheduleapproval/', {
        params: { status: 'approved' },
      });

      const approvedColleges = new Set(
        approvalResponse.data.map((approval: any) => approval.college_name),
      );

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
          proctor_details: schedule.proctor_details || [], 
          instructor_name: schedule.instructor_name || '',
          department: schedule.department || '',
          college: schedule.college || '',
          examdetails_status: schedule.examdetails_status || 'pending',
          otp_code: schedule.otp_code || null,
          approval_status: isApproved ? 'approved' : 'pending',
        };

        return mappedSchedule;
      });

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
  }, [collegeFilter, selectedYear, selectedMonth]);

  useEffect(() => {
    fetchMonitoringData();
  }, [fetchMonitoringData]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showSortDropdown && !target.closest('[data-sort-dropdown]')) {
        setShowSortDropdown(false);
      }
      if (showHistoryFilters && !target.closest('[data-history-dropdown]')) {
        setShowHistoryFilters(false);
      }
      if (showStatusDropdown && !target.closest('[data-status-dropdown]')) {
        setShowStatusDropdown(false);
      }
    };

    if (showSortDropdown || showHistoryFilters || showStatusDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSortDropdown, showHistoryFilters, showStatusDropdown]);

  const clearHistoryFilters = () => {
    setSelectedYear('all');
    setSelectedMonth('all');
    setHistorySortOrder('newest');
    setShowHistoryFilters(false);
  };

  const isViewingHistory = selectedYear !== 'all' || selectedMonth !== 'all';

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

  const formatSectionRanges = (sections: string[]): string => {
    if (sections.length === 0) return '';
    if (sections.length === 1) return sections[0];

    const sorted = [...sections].sort((a, b) => {
      const matchA = a.match(/^([A-Z]+\d+[A-Z]*)(\d+)$/);
      const matchB = b.match(/^([A-Z]+\d+[A-Z]*)(\d+)$/);

      if (!matchA || !matchB) return a.localeCompare(b);

      const [, prefixA, numA] = matchA;
      const [, prefixB, numB] = matchB;

      if (prefixA !== prefixB) return prefixA.localeCompare(prefixB);
      return parseInt(numA) - parseInt(numB);
    });

    const ranges: string[] = [];
    let rangeStart = sorted[0];
    let rangeEnd = sorted[0];
    let lastNum = -1;
    let currentPrefix = '';

    sorted.forEach((section, index) => {
      const match = section.match(/^([A-Z]+\d+[A-Z]*)(\d+)$/);
      if (!match) {
        ranges.push(section);
        return;
      }

      const [, prefix, numStr] = match;
      const num = parseInt(numStr);

      if (index === 0) {
        currentPrefix = prefix;
        lastNum = num;
        return;
      }

      if (prefix === currentPrefix && num === lastNum + 1) {
        rangeEnd = section;
        lastNum = num;
      } else {
        if (rangeStart === rangeEnd) {
          ranges.push(rangeStart);
        } else {
          ranges.push(`${rangeStart} - ${rangeEnd}`);
        }
        rangeStart = section;
        rangeEnd = section;
        currentPrefix = prefix;
        lastNum = num;
      }

      if (index === sorted.length - 1) {
        if (rangeStart === rangeEnd) {
          ranges.push(rangeStart);
        } else {
          ranges.push(`${rangeStart} - ${rangeEnd}`);
        }
      }
    });

    return ranges.join(', ');
  };

  const handleExportPDF = () => {
    if (sortedSchedules.length === 0) {
      toast.info('No data to export');
      return;
    }

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

    const getStatusDisplay = (status: string) => {
      const normalized = status.toLowerCase().trim();
      if (normalized.includes('late')) return 'LATE';
      if (normalized.includes('confirm') || normalized.includes('present')) return 'PRESENT';
      if (normalized.includes('absent')) return 'ABSENT';
      if (normalized.includes('sub')) return 'SUBSTITUTE';
      return 'PENDING';
    };

    const doc = new jsPDF('landscape', 'mm', 'a4');

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('EXAM MONITORING REPORT', 148, 15, { align: 'center' });

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

    const tableData = sortedSchedules.map((schedule, index) => {
      const proctorInfo = schedule.proctor_details
        .map((p, i) => `${i + 1}. ${p.proctor_name} (${getStatusDisplay(p.status)}) - ${formatTimeIn(p.time_in)}`)
        .join('\n');

      return [
        (index + 1).toString(),
        schedule.course_id,
        schedule.section_name,
        schedule.exam_date,
        `${formatTo12Hour(schedule.exam_start_time)}\n${formatTo12Hour(schedule.exam_end_time)}`,
        `${schedule.building_name}\nRoom ${schedule.room_id}`,
        schedule.instructor_name,
        proctorInfo || 'No proctors',
        schedule.otp_code || 'N/A',
      ];
    });

    autoTable(doc, {
      startY: 28,
      head: [['#', 'Course', 'Section', 'Date', 'Time', 'Location', 'Instructor', 'Proctors (Status - Time In)', 'Exam Code']],
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
        1: { cellWidth: 25 },
        2: { cellWidth: 22 },
        3: { cellWidth: 25 },
        4: { cellWidth: 30, fontSize: 7 },
        5: { cellWidth: 35, fontSize: 7 },
        6: { cellWidth: 35 },
        7: { cellWidth: 60, fontSize: 7 }, 
        8: { cellWidth: 22, halign: 'center', fontStyle: 'bold' },
      },
      bodyStyles: {
        valign: 'middle',
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245],
      },
    });

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

    if (searchTerm && searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      data = data.filter((schedule) => {
        const proctorNames = schedule.proctor_details
          .map(p => p.proctor_name)
          .join(' ');

        const combined = [
          schedule.course_id,
          schedule.subject,
          schedule.section_name,
          schedule.exam_date,
          schedule.exam_start_time,
          schedule.exam_end_time,
          schedule.building_name,
          schedule.room_id,
          proctorNames,
          schedule.instructor_name,
          schedule.examdetails_status,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        return combined.includes(term);
      });
    }

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

    const groupedMap = new Map<string, MonitoringSchedule & { sections: string[] }>();

    data.forEach((schedule) => {
      const key = `${schedule.course_id}|${schedule.subject}|${schedule.exam_date}|${schedule.exam_start_time}|${schedule.exam_end_time}|${schedule.building_name}|${schedule.room_id}|${schedule.instructor_name}|${schedule.otp_code}`;

      if (groupedMap.has(key)) {
        const existing = groupedMap.get(key)!;
        existing.sections.push(schedule.section_name);

        const existingProctorIds = new Set(existing.proctor_details.map(p => p.proctor_id));
        schedule.proctor_details.forEach(p => {
          if (!existingProctorIds.has(p.proctor_id)) {
            existing.proctor_details.push(p);
          }
        });
      } else {
        groupedMap.set(key, {
          ...schedule,
          sections: [schedule.section_name]
        });
      }
    });

    let groupedData = Array.from(groupedMap.values());
    if (sortBy === 'none') {
      if (isViewingHistory) {
        return [...groupedData].sort((a, b) => {
          const dateA = new Date(a.exam_date).getTime();
          const dateB = new Date(b.exam_date).getTime();
          if (dateA === dateB) {
            const timeA = a.exam_start_time || '';
            const timeB = b.exam_start_time || '';
            return historySortOrder === 'newest' 
              ? timeB.localeCompare(timeA)
              : timeA.localeCompare(timeB);
          }
          return historySortOrder === 'newest' 
            ? dateB - dateA 
            : dateA - dateB;
        });
      }
      return groupedData;
    }

    const sorted = [...groupedData].sort((a, b) => {
      switch (sortBy) {
        case 'course_id':
          return smartSort(a.course_id.toLowerCase(), b.course_id.toLowerCase());
        case 'subject':
          return smartSort(a.subject.toLowerCase(), b.subject.toLowerCase());
        case 'section_name':
          return smartSort(a.section_name.toLowerCase(), b.section_name.toLowerCase());
        case 'exam_date':
          const dateA = new Date(a.exam_date).getTime();
          const dateB = new Date(b.exam_date).getTime();
          if (dateA === dateB) {
            const timeA = a.exam_start_time || '';
            const timeB = b.exam_start_time || '';
            return isViewingHistory && historySortOrder === 'newest'
              ? timeB.localeCompare(timeA)
              : timeA.localeCompare(timeB);
          }
          return isViewingHistory && historySortOrder === 'newest'
            ? dateB - dateA
            : dateA - dateB;
        case 'exam_start_time':
          return (a.exam_start_time || '').localeCompare(b.exam_start_time || '');
        case 'building_name':
          return smartSort(a.building_name.toLowerCase(), b.building_name.toLowerCase());
        case 'room_id':
          return smartSort(a.room_id.toLowerCase(), b.room_id.toLowerCase());
        case 'instructor_name':
          return smartSort(a.instructor_name.toLowerCase(), b.instructor_name.toLowerCase());
        case 'status':
          return smartSort(a.examdetails_status.toLowerCase(), b.examdetails_status.toLowerCase());
        default:
          return 0;
      }
    });

    return sorted;
  }, [approvedSchedules, sortBy, searchTerm, statusFilter, selectedYear, selectedMonth, historySortOrder]);

  return (
    <div className="proctor-monitoring-container">
      <ToastContainer position="top-right" autoClose={3000} />

      <div className="proctor-monitoring-header">
        <div className="proctor-monitoring-header-left">
          <p
            className={`proctor-monitoring-label ${
              (selectedYear !== 'all' || selectedMonth !== 'all')
                ? 'proctor-monitoring-label-approved' 
                : hasApprovedSchedules
                ? 'proctor-monitoring-label-approved'
                : 'proctor-monitoring-label-waiting'
            }`}
          >
            {(selectedYear !== 'all' || selectedMonth !== 'all')
              ? 'VIEWING HISTORICAL RECORDS'
              : hasApprovedSchedules
              ? 'EXAM SCHEDULE HAS BEEN APPROVED. CLICK TO GENERATE EXAM CODES'
              : 'WAITING FOR DEAN APPROVAL'}
          </p>
          <div className="pm-button-row" data-sort-dropdown>
            <button type='button' className="pm-control-button pm-sort-button" onClick={() => setShowSortDropdown(!showSortDropdown)} title="Sort by">
              <FaSort />
              <span>Sort by</span>
            </button>

            <div className="pm-status-wrapper" data-history-dropdown>
              <button
                type='button'
                className={`pm-control-button pm-history-button ${showHistoryFilters ? 'active' : ''} ${isViewingHistory ? 'history-active' : ''}`}
                onClick={() => setShowHistoryFilters(!showHistoryFilters)}
                title="View Historical Records"
              >
                <FaFilter />
                <span>History</span>
                {isViewingHistory && <span className="history-indicator">●</span>}
              </button>

              {showHistoryFilters && (
                <div className="pm-history-dropdown">
                  <div className="pm-history-header">
                    <h4>Filter Historical Records</h4>
                    {isViewingHistory && (
                      <button
                        type="button"
                        className="pm-clear-history-btn"
                        onClick={clearHistoryFilters}
                        title="Clear filters and view current records"
                      >
                        Clear Filters
                      </button>
                    )}
                  </div>
                  
                  <div className="pm-history-filters">
                    <div className="pm-filter-group">
                      <label>YEAR:</label>
                      <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(e.target.value)}
                      >
                        <option value="all">All Years</option>
                        {yearOptions.map(year => (
                          <option key={year} value={year}>{year}</option>
                        ))}
                      </select>
                    </div>

                    <div className="pm-filter-group">
                      <label>MONTH:</label>
                      <select
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                      >
                        <option value="all">All Months</option>
                        {monthOptions.map(month => (
                          <option key={month.value} value={month.value}>{month.label}</option>
                        ))}
                      </select>
                    </div>

                    <div className="pm-filter-group">
                      <label>SORT BY DATE:</label>
                      <select
                        value={historySortOrder}
                        onChange={(e) => setHistorySortOrder(e.target.value as 'newest' | 'oldest')}
                      >
                        <option value="newest">Newest First</option>
                        <option value="oldest">Oldest First</option>
                      </select>
                    </div>
                  </div>

                  {isViewingHistory && (
                    <div className="pm-history-info">
                      <p>Viewing: {selectedYear !== 'all' ? selectedYear : 'All Years'} - {selectedMonth !== 'all' ? monthOptions.find(m => m.value === selectedMonth)?.label : 'All Months'}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
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
              <div className="pm-dropdown">
                {[
                  { value: 'none', label: 'No Sorting' },
                  { value: 'exam_date', label: '📅 Exam Date' },
                  { value: 'course_id', label: '📚 Course Code' },
                  { value: 'subject', label: '📖 Subject' },
                  { value: 'section_name', label: '👥 Section' },
                  { value: 'exam_start_time', label: '⏰ Time' },
                  { value: 'building_name', label: '🏢 Building' },
                  { value: 'room_id', label: '🚪 Room' },
                  { value: 'instructor_name', label: '👨‍🏫 Instructor' },
                  { value: 'status', label: '✅ Status' },
                ].map((sortOption) => (
                  <button
                    key={sortOption.value}
                    type="button"
                    onClick={() => {
                      setSortBy(sortOption.value);
                      setShowSortDropdown(false);
                    }}
                    className={`pm-dropdown-item ${sortBy === sortOption.value ? 'active' : ''}`}
                  >
                    {sortOption.label}
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
                  <th>Section/s</th>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Building</th>
                  <th>Room</th>
                  <th>Instructor</th>
                  <th>Exam Code</th>
                  <th>Proctors</th>
                </tr>
              </thead>
              <tbody>
                {sortedSchedules.length > 0 ? (
                  sortedSchedules.map((schedule, index) => {
                    return (
                      <tr
                        key={schedule.id}
                        onClick={() => handleRowClick(schedule)}
                        style={{ cursor: 'pointer' }}
                      >
                        <td>{index + 1}</td>
                        <td>{schedule.course_id}</td>
                        <td>{schedule.subject}</td>
                        <td>{formatSectionRanges(schedule.sections || [schedule.section_name])}</td>
                        <td>{schedule.exam_date}</td>
                        <td>{formatTo12Hour(schedule.exam_start_time)} - {formatTo12Hour(schedule.exam_end_time)}</td>
                        <td>{schedule.building_name}</td>
                        <td>{schedule.room_id}</td>
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
                        <td style={{ textAlign: 'center' }}>
                          <span style={{
                            color: '#0A3765',
                            fontWeight: 'bold',
                            fontSize: '0.9em'
                          }}>
                            {schedule.proctor_details.length} Proctor{schedule.proctor_details.length !== 1 ? 's' : ''}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={11} className="no-data-message">
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

      {/* Proctor Details Modal */}
      {showProctorModal && selectedSchedule && (
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
          onClick={() => setShowProctorModal(false)}
        >
          <div
            style={{
              backgroundColor: 'white',
              padding: '30px',
              borderRadius: '10px',
              maxWidth: '700px',
              width: '90%',
              maxHeight: '80vh',
              overflowY: 'auto',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0, color: '#0A3765', borderBottom: '2px solid #0A3765', paddingBottom: '10px' }}>
              Proctor Details
            </h3>

            <div style={{ marginBottom: '20px' }}>
              <p style={{ margin: '5px 0', color: '#666' }}>
                <strong>Course:</strong> {selectedSchedule.course_id} - {selectedSchedule.subject}
              </p>
              <p style={{ margin: '5px 0', color: '#666' }}>
                <strong>Section:</strong> {selectedSchedule.section_name}
              </p>
              <p style={{ margin: '5px 0', color: '#666' }}>
                <strong>Date:</strong> {selectedSchedule.exam_date}
              </p>
              <p style={{ margin: '5px 0', color: '#666' }}>
                <strong>Time:</strong> {formatTo12Hour(selectedSchedule.exam_start_time)} - {formatTo12Hour(selectedSchedule.exam_end_time)}
              </p>
              <p style={{ margin: '5px 0', color: '#666' }}>
                <strong>Location:</strong> {selectedSchedule.building_name}, Room {selectedSchedule.room_id}
              </p>
            </div>

            <h4 style={{ color: '#333', marginBottom: '15px' }}>
              Proctors ({selectedSchedule.proctor_details.length})
            </h4>

            {selectedSchedule.proctor_details.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                {selectedSchedule.proctor_details.map((proctor) => {
                  const getStatusDisplay = (status: string) => {
                    const normalized = status.toLowerCase().trim();
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

                  const formatTimeIn = (timeString: string | null | undefined) => {
                    if (!timeString) return 'Not yet checked in';
                    try {
                      const date = new Date(timeString);
                      let hours = date.getHours();
                      const minutes = date.getMinutes().toString().padStart(2, '0');
                      const ampm = hours >= 12 ? 'PM' : 'AM';
                      hours = hours % 12;
                      hours = hours === 0 ? 12 : hours;
                      return `${hours}:${minutes} ${ampm}`;
                    } catch (e) {
                      return 'Invalid time';
                    }
                  };

                  const statusDisplay = getStatusDisplay(proctor.status);

                  return (
                    <div
                      key={proctor.proctor_id}
                      style={{
                        padding: '15px',
                        border: '1px solid #ddd',
                        borderRadius: '8px',
                        backgroundColor: proctor.is_substitute ? '#fff3cd' : '#f9f9f9'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <h5 style={{ margin: 0, color: '#333', fontSize: '16px' }}>
                          {proctor.is_substitute ? ' ' : ''}
                          {proctor.proctor_name}
                          {proctor.is_assigned ? ' (Assigned)' : ' (Substitute)'}
                        </h5>
                        <span className={`status-badge ${statusDisplay.className}`}>
                          {statusDisplay.text}
                        </span>
                      </div>

                      <p style={{ margin: '5px 0', color: '#666', fontSize: '14px' }}>
                        <strong>Time In:</strong> {formatTimeIn(proctor.time_in)}
                      </p>

                      {/* Show substitution info */}
                      {proctor.is_substitute && (
                        <>
                          <p style={{ margin: '5px 0', color: '#856404', fontSize: '14px', fontWeight: 'bold' }}>
                            <strong>Substituted for:</strong> {proctor.substituted_for || 'N/A'}
                          </p>
                          {proctor.substitution_remarks && (
                            <p style={{ margin: '5px 0', color: '#666', fontSize: '13px', fontStyle: 'italic' }}>
                              <strong>Reason:</strong> {proctor.substitution_remarks}
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p style={{ color: '#999', fontStyle: 'italic' }}>No proctors assigned</p>
            )}

            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowProctorModal(false)}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#0A3765',
                  color: 'white',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
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