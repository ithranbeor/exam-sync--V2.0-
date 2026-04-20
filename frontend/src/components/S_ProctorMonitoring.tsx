// deno-lint-ignore-file no-explicit-any
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  FaSort, FaSearch, FaFilter, FaShieldAlt, FaTimes,
  FaCalendarAlt, FaBuilding, FaDoorOpen, FaUserTie,
  FaClock, FaCheckCircle, FaFilePdf,
  FaQrcode, FaSync, FaHistory, FaChevronDown, FaChevronLeft,
  FaChevronRight,
} from 'react-icons/fa';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import api from '../lib/apiClient';
import '../styles/S_ProctorMonitoring.css';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

declare module 'jspdf' {
  interface jsPDF { autoTable: (options: any) => jsPDF; }
}

/* ─── Types ──────────────────────────────────────── */
interface MonitoringStats {
  totalExams: number; activeExams: number;
  upcomingExams: number; completedExams: number;
  totalProctors: number; presentProctors: number;
  absentProctors: number; lateProctors: number;
}

interface UserProps {
  user: { user_id: number; email: string; first_name?: string; last_name?: string } | null;
}

interface ProctorDetail {
  proctor_id: number; proctor_name: string; status: string;
  time_in: string | null; is_assigned?: boolean; is_substitute?: boolean;
  substituted_for?: string; substitution_remarks?: string;
}

interface MonitoringSchedule {
  id: number; course_id: string; subject: string; section_name: string;
  exam_date: string; exam_start_time: string; exam_end_time: string;
  building_name: string; room_id: string; proctor_details: ProctorDetail[];
  instructor_name: string; department: string; college: string;
  examdetails_status: string; otp_code: string | null; approval_status?: string;
  sections?: string[];
}

/* ─── Helpers ────────────────────────────────────── */
const fmt12 = (ts?: string) => {
  if (!ts) return '—';
  try {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Manila' });
  } catch { return '—'; }
};

const formatTimeInLocal = (ts: string | null | undefined) => {
  if (!ts) return 'Not yet';
  try {
    const d = new Date(ts);
    let h = d.getHours(); const m = String(d.getMinutes()).padStart(2, '0');
    const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12;
    return `${h}:${m} ${ap}`;
  } catch { return 'Invalid'; }
};

const getStatusDisplay = (status: string) => {
  const n = status.toLowerCase().trim();
  if (n.includes('late'))    return { text: 'Late',       cls: 'pm-badge--late' };
  if (n.includes('confirm') || n.includes('present')) return { text: 'Present', cls: 'pm-badge--confirmed' };
  if (n.includes('absent'))  return { text: 'Absent',     cls: 'pm-badge--absent' };
  if (n.includes('sub'))     return { text: 'Substitute', cls: 'pm-badge--sub' };
  return { text: 'Pending', cls: 'pm-badge--pending' };
};

const isNumeric = (s: string) => !isNaN(Number(s)) && !isNaN(parseFloat(s));
const smartSort = (a: string, b: string) => {
  const an = isNumeric(a), bn = isNumeric(b);
  if (an && bn) return parseFloat(a) - parseFloat(b);
  if (an) return -1; if (bn) return 1;
  return a.localeCompare(b);
};

const formatSectionRanges = (sections: string[]): string => {
  if (!sections.length) return '';
  if (sections.length === 1) return sections[0];
  const sorted = [...sections].sort((a, b) => {
    const ma = a.match(/^([A-Z]+\d+[A-Z]*)(\d+)$/);
    const mb = b.match(/^([A-Z]+\d+[A-Z]*)(\d+)$/);
    if (!ma || !mb) return a.localeCompare(b);
    if (ma[1] !== mb[1]) return ma[1].localeCompare(mb[1]);
    return parseInt(ma[2]) - parseInt(mb[2]);
  });
  const ranges: string[] = [];
  let start = sorted[0], end = sorted[0], last = -1, prefix = '';
  sorted.forEach((s, i) => {
    const m = s.match(/^([A-Z]+\d+[A-Z]*)(\d+)$/);
    if (!m) { ranges.push(s); return; }
    const [, p, nStr] = m; const n = parseInt(nStr);
    if (i === 0) { prefix = p; last = n; return; }
    if (p === prefix && n === last + 1) { end = s; last = n; }
    else {
      ranges.push(start === end ? start : `${start}–${end}`);
      start = s; end = s; prefix = p; last = n;
    }
    if (i === sorted.length - 1) ranges.push(start === end ? start : `${start}–${end}`);
  });
  return ranges.join(', ');
};

/* ─── Component ──────────────────────────────────── */
const ProctorMonitoring: React.FC<UserProps> = () => {
  const [approvedSchedules, setApprovedSchedules] = useState<MonitoringSchedule[]>([]);
  const [loading, setLoading]             = useState(true);
  const [generatingOtp, setGeneratingOtp] = useState(false);
  const [resettingOtp, setResettingOtp]   = useState(false);
  const [hasApprovedSchedules, setHasApprovedSchedules] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [sortBy, setSortBy]               = useState('none');
  const [showSortDropdown, setShowSortDropdown]   = useState(false);
  const [searchTerm, setSearchTerm]       = useState('');
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [statusFilter, setStatusFilter]   = useState<'all'|'present'|'absent'|'substitute'|'pending'>('all');
  const [selectedSchedule, setSelectedSchedule] = useState<MonitoringSchedule | null>(null);
  const [showProctorModal, setShowProctorModal]   = useState(false);
  const [selectedYear, setSelectedYear]   = useState('all');
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [showHistoryFilters, setShowHistoryFilters] = useState(false);
  const [historySortOrder, setHistorySortOrder] = useState<'newest'|'oldest'>('newest');
  const [currentPage, setCurrentPage]     = useState(1);
  const [itemsPerPage, setItemsPerPage]   = useState<number>(20);
  const [showItemsPerPageDropdown, setShowItemsPerPageDropdown] = useState(false);

  const currentYear  = new Date().getFullYear();
  const yearOptions  = Array.from({ length: 5 }, (_, i) => currentYear - i);
  const monthOptions = [
    { value: '01', label: 'January'   }, { value: '02', label: 'February'  },
    { value: '03', label: 'March'     }, { value: '04', label: 'April'     },
    { value: '05', label: 'May'       }, { value: '06', label: 'June'      },
    { value: '07', label: 'July'      }, { value: '08', label: 'August'    },
    { value: '09', label: 'September' }, { value: '10', label: 'October'   },
    { value: '11', label: 'November'  }, { value: '12', label: 'December'  },
  ];

  const isViewingHistory = selectedYear !== 'all' || selectedMonth !== 'all';

  /* ─ Outside click dismiss ─ */
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (showSortDropdown          && !t.closest('[data-sort-dropdown]'))         setShowSortDropdown(false);
      if (showHistoryFilters        && !t.closest('[data-history-dropdown]'))       setShowHistoryFilters(false);
      if (showStatusDropdown        && !t.closest('[data-status-dropdown]'))        setShowStatusDropdown(false);
      if (showItemsPerPageDropdown  && !t.closest('[data-items-per-page-dropdown]')) setShowItemsPerPageDropdown(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [showSortDropdown, showHistoryFilters, showStatusDropdown, showItemsPerPageDropdown]);

  /* ─ Fetch ─ */
  const fetchMonitoringData = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (selectedYear  !== 'all') params.year  = selectedYear;
      if (selectedMonth !== 'all') params.month = selectedMonth;

      const { data: examData } = await api.get('/proctor-monitoring/', { params });
      const approvalRes = await api.get('/tbl_scheduleapproval/', { params: { status: 'approved' } });
      const approvedColleges = new Set(approvalRes.data.map((a: any) => a.college_name));

      const mapped: MonitoringSchedule[] = examData.map((s: any) => ({
        id: s.id, course_id: s.course_id, subject: s.subject || s.course_id,
        section_name: s.section_name || '', exam_date: s.exam_date || '',
        exam_start_time: s.exam_start_time || '', exam_end_time: s.exam_end_time || '',
        building_name: s.building_name || '', room_id: s.room_id || '',
        proctor_details: s.proctor_details || [], instructor_name: s.instructor_name || '',
        department: s.department || '', college: s.college || '',
        examdetails_status: s.examdetails_status || 'pending',
        otp_code: s.otp_code || null,
        approval_status: approvedColleges.has(s.college) ? 'approved' : 'pending',
      }));

      const approved = mapped.filter(s => s.approval_status === 'approved');
      setApprovedSchedules(approved);
      setHasApprovedSchedules(approved.length > 0);
      if (!approved.length) toast.info('No approved schedules yet. Waiting for dean approval.');
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to load monitoring data');
      setHasApprovedSchedules(false);
    } finally { setLoading(false); }
  }, [selectedYear, selectedMonth]);

  useEffect(() => { fetchMonitoringData(); }, [fetchMonitoringData]);

  /* ─ Reset page on filter change ─ */
  useEffect(() => { setCurrentPage(1); }, [searchTerm, sortBy, statusFilter, itemsPerPage]);

  /* ─ Sorted / filtered / grouped list ─ */
  const sortedSchedules = useMemo(() => {
    let data = approvedSchedules;

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      data = data.filter(s => {
        const proctorNames = s.proctor_details.map(p => p.proctor_name).join(' ');
        return [s.course_id, s.subject, s.section_name, s.exam_date,
          s.building_name, s.room_id, proctorNames, s.instructor_name, s.examdetails_status]
          .filter(Boolean).join(' ').toLowerCase().includes(term);
      });
    }

    if (statusFilter !== 'all') {
      data = data.filter(s => {
        const st = (s.examdetails_status || '').toLowerCase();
        if (statusFilter === 'present')    return st.includes('confirm') || st.includes('present');
        if (statusFilter === 'absent')     return st.includes('absent');
        if (statusFilter === 'substitute') return st.includes('sub');
        if (statusFilter === 'pending')    return st.includes('pending') || st === '';
        return true;
      });
    }

    /* group by key */
    const map = new Map<string, MonitoringSchedule & { sections: string[] }>();
    data.forEach(s => {
      const key = `${s.course_id}|${s.subject}|${s.exam_date}|${s.exam_start_time}|${s.exam_end_time}|${s.building_name}|${s.room_id}|${s.instructor_name}|${s.otp_code}`;
      if (map.has(key)) {
        const ex = map.get(key)!;
        ex.sections.push(s.section_name);
        const ids = new Set(ex.proctor_details.map(p => p.proctor_id));
        s.proctor_details.forEach(p => { if (!ids.has(p.proctor_id)) ex.proctor_details.push(p); });
      } else { map.set(key, { ...s, sections: [s.section_name] }); }
    });
    let grouped = Array.from(map.values());

    if (sortBy === 'none') {
      if (isViewingHistory) {
        return [...grouped].sort((a, b) => {
          const da = new Date(a.exam_date).getTime(), db = new Date(b.exam_date).getTime();
          if (da === db) return historySortOrder === 'newest'
            ? (b.exam_start_time || '').localeCompare(a.exam_start_time || '')
            : (a.exam_start_time || '').localeCompare(b.exam_start_time || '');
          return historySortOrder === 'newest' ? db - da : da - db;
        });
      }
      return grouped;
    }

    return [...grouped].sort((a, b) => {
      switch (sortBy) {
        case 'course_id':        return smartSort(a.course_id.toLowerCase(), b.course_id.toLowerCase());
        case 'subject':          return smartSort(a.subject.toLowerCase(), b.subject.toLowerCase());
        case 'section_name':     return smartSort(a.section_name.toLowerCase(), b.section_name.toLowerCase());
        case 'exam_date': {
          const da = new Date(a.exam_date).getTime(), db = new Date(b.exam_date).getTime();
          if (da === db) return (a.exam_start_time||'').localeCompare(b.exam_start_time||'');
          return da - db;
        }
        case 'exam_start_time':  return (a.exam_start_time||'').localeCompare(b.exam_start_time||'');
        case 'building_name':    return smartSort(a.building_name.toLowerCase(), b.building_name.toLowerCase());
        case 'room_id':          return smartSort(a.room_id.toLowerCase(), b.room_id.toLowerCase());
        case 'instructor_name':  return smartSort(a.instructor_name.toLowerCase(), b.instructor_name.toLowerCase());
        case 'status':           return smartSort(a.examdetails_status.toLowerCase(), b.examdetails_status.toLowerCase());
        default: return 0;
      }
    });
  }, [approvedSchedules, sortBy, searchTerm, statusFilter, isViewingHistory, historySortOrder]);

  /* ─ Pagination ─ */
  const totalItems  = sortedSchedules.length;
  const totalPages  = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  const paginated   = useMemo(() =>
    sortedSchedules.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage),
    [sortedSchedules, currentPage, itemsPerPage]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  /* ─ Stats ─ */
  const stats = useMemo((): MonitoringStats => {
    const now = new Date();
    let active = 0, upcoming = 0, completed = 0, total = 0, present = 0, absent = 0, late = 0;
    sortedSchedules.forEach(s => {
      const start = new Date(`${s.exam_date}T${s.exam_start_time}`);
      const end   = new Date(`${s.exam_date}T${s.exam_end_time}`);
      if (now >= start && now <= end) active++;
      else if (now < start) upcoming++;
      else completed++;
      total += s.proctor_details.length;
      s.proctor_details.forEach(p => {
        const st = p.status.toLowerCase();
        if (st.includes('confirm') || st.includes('present')) present++;
        else if (st.includes('absent')) absent++;
        else if (st.includes('late'))   late++;
      });
    });
    return { totalExams: sortedSchedules.length, activeExams: active, upcomingExams: upcoming,
      completedExams: completed, totalProctors: total, presentProctors: present,
      absentProctors: absent, lateProctors: late };
  }, [sortedSchedules]);

  const getExamStatus = (s: MonitoringSchedule): 'upcoming' | 'completed' => {
    const now   = new Date();
    const start = new Date(`${s.exam_date}T${s.exam_start_time}`);
    if (now < start) return 'upcoming';
    return 'completed';
  };

  const hasOtpCodes = approvedSchedules.some(s => s.otp_code);

  /* ─ OTP handlers ─ */
  const handleGenerateOtpCodes = async () => {
    setGeneratingOtp(true);
    try {
      const ids = approvedSchedules.filter(s => !s.otp_code).map(s => s.id);
      if (!ids.length) { toast.info('All schedules already have OTP codes'); return; }
      const res = await api.post('/generate-exam-otps/', { schedule_ids: ids });
      toast.success(`Generated OTP codes for ${res.data.generated_count} schedule(s)`);
      await fetchMonitoringData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to generate OTP codes');
    } finally { setGeneratingOtp(false); }
  };

  const handleResetOtpCodes = async () => {
    setResettingOtp(true); setShowResetConfirm(false);
    try {
      const ids = approvedSchedules.filter(s => s.otp_code).map(s => s.id);
      if (!ids.length) { toast.info('No OTP codes to reset'); setResettingOtp(false); return; }
      const res = await api.post('/reset-exam-otps/', { schedule_ids: ids });
      toast.success(`Reset ${res.data.deleted_count} OTP code(s)`);
      await fetchMonitoringData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to reset OTP codes');
    } finally { setResettingOtp(false); }
  };

  /* ─ Export PDF ─ */
  const handleExportPDF = () => {
    if (!sortedSchedules.length) { toast.info('No data to export'); return; }
    if (!sortedSchedules.every(s => s.otp_code)) {
      toast.error('Cannot export: Some schedules do not have exam codes yet.'); return;
    }
    const doc = new jsPDF('landscape', 'mm', 'a4');
    doc.setFontSize(16); doc.setFont('helvetica', 'bold');
    doc.text('EXAM MONITORING REPORT', 148, 15, { align: 'center' });
    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    doc.text(`Generated: ${new Date().toLocaleString('en-US', { year:'numeric', month:'long', day:'numeric', hour:'2-digit', minute:'2-digit' })}`, 148, 22, { align: 'center' });
    const rows = sortedSchedules.map((s, i) => {
      const proctorInfo = s.proctor_details.map((p, j) =>
        `${j+1}. ${p.proctor_name} (${getStatusDisplay(p.status).text}) – ${formatTimeInLocal(p.time_in)}`
      ).join('\n');
      return [(i+1).toString(), s.course_id, s.section_name, s.exam_date,
        `${fmt12(s.exam_start_time)}\n${fmt12(s.exam_end_time)}`,
        `${s.building_name}\nRoom ${s.room_id}`, s.instructor_name,
        proctorInfo || 'No proctors', s.otp_code || 'N/A'];
    });
    autoTable(doc, {
      startY: 28,
      head: [['#','Course','Section','Date','Time','Location','Instructor','Proctors','Exam Code']],
      body: rows,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [9,44,76], textColor: [255,255,255], fontStyle: 'bold', halign: 'center' },
      columnStyles: {
        0:{cellWidth:8,halign:'center'}, 1:{cellWidth:25}, 2:{cellWidth:22},
        3:{cellWidth:25}, 4:{cellWidth:30,fontSize:7}, 5:{cellWidth:35,fontSize:7},
        6:{cellWidth:35}, 7:{cellWidth:60,fontSize:7}, 8:{cellWidth:22,halign:'center',fontStyle:'bold'},
      },
      alternateRowStyles: { fillColor: [245,247,250] },
    });
    const pages = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i); doc.setFontSize(8); doc.setTextColor(128,128,128);
      doc.text(`Page ${i} of ${pages}`, 148, doc.internal.pageSize.height - 10, { align: 'center' });
    }
    doc.save(`exam_monitoring_${new Date().toISOString().split('T')[0]}.pdf`);
    toast.success('PDF exported successfully!');
  };

  const clearHistoryFilters = () => {
    setSelectedYear('all'); setSelectedMonth('all');
    setHistorySortOrder('newest'); setShowHistoryFilters(false);
  };

  /* ─ Attendance bar widths ─ */
  const attendancePct = (val: number) =>
    stats.totalProctors > 0 ? Math.round((val / stats.totalProctors) * 100) : 0;

  /* ─ Render ─────────────────────────────────────── */
  return (
    <div className="pm-page">
      <ToastContainer position="top-right" autoClose={3000} />

      {/* ══ PAGE HEADER ══ */}
      <div className="pm-page-header">
        <div className="pm-page-header-left">
          <div className="pm-page-icon">
            <FaShieldAlt style={{ fontSize: 20 }} />
          </div>
          <div className="pm-page-title">
            <h1>Proctor Monitoring</h1>
            <p>
              {approvedSchedules.length} schedule{approvedSchedules.length !== 1 ? 's' : ''} ·{' '}
              {sortedSchedules.length} showing
            </p>
          </div>
        </div>

        <div className="pm-page-actions">
          {/* Search */}
          <div className="pm-search-bar">
            <FaSearch className="pm-search-icon" />
            <input
              type="text"
              placeholder="Search course, proctor, room…"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>

          <button
            type="button"
            className="pm-btn primary"
            onClick={handleGenerateOtpCodes}
            disabled={generatingOtp || loading || !hasApprovedSchedules}
          >
            <FaQrcode style={{ fontSize: 11 }} />
            {generatingOtp ? 'Generating…' : 'Generate Codes'}
          </button>

          <button
            type="button"
            className="pm-btn"
            onClick={() => setShowResetConfirm(true)}
            disabled={resettingOtp || loading || !hasOtpCodes}
          >
            <FaSync style={{ fontSize: 11 }} />
            {resettingOtp ? 'Resetting…' : 'Reset'}
          </button>

          <button
            type="button"
            className="pm-btn"
            onClick={handleExportPDF}
            disabled={loading || !sortedSchedules.length || !sortedSchedules.every(s => s.otp_code)}
          >
            <FaFilePdf style={{ fontSize: 11 }} /> Export PDF
          </button>
        </div>
      </div>

      {/* ══ STAT CARDS ══ */}
      <div className="pm-stats-grid">
        {/* Exam breakdown */}
        <div className="pm-stat-card">
          <div className="pm-stat-card-header">
            <span className="pm-stat-label">Exam Schedule</span>
            <span className="pm-stat-icon pm-stat-icon-blue">
              <FaCalendarAlt />
            </span>
          </div>
          <div className="pm-stat-value">{stats.totalExams}</div>
          <div className="pm-stat-sub-row">
            <span className="pm-stat-pill pm-stat-pill-yellow">
              {stats.upcomingExams} upcoming
            </span>
            <span className="pm-stat-pill pm-stat-pill-green">
              {stats.completedExams} done
            </span>
          </div>
        </div>

        {/* Proctor attendance visual */}
        <div className="pm-stat-card pm-stat-card-wide">
          <div className="pm-stat-card-header">
            <span className="pm-stat-label">Proctor Attendance</span>
            <span className="pm-stat-icon pm-stat-icon-brand">
              <FaUserTie />
            </span>
          </div>
          <div className="pm-stat-value">{stats.totalProctors} <span className="pm-stat-unit">proctors</span></div>
          <div className="pm-attendance-bars">
            {[
              { label: 'Present', value: stats.presentProctors, cls: 'bar-green' },
              { label: 'Late',    value: stats.lateProctors,    cls: 'bar-yellow' },
              { label: 'Absent',  value: stats.absentProctors,  cls: 'bar-red' },
            ].map(b => (
              <div key={b.label} className="pm-bar-row">
                <span className="pm-bar-label">{b.label}</span>
                <div className="pm-bar-track">
                  <div
                    className={`pm-bar-fill ${b.cls}`}
                    style={{ width: `${attendancePct(b.value)}%` }}
                  />
                </div>
                <span className="pm-bar-count">{b.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* OTP status */}
        <div className="pm-stat-card">
          <div className="pm-stat-card-header">
            <span className="pm-stat-label">Exam Codes</span>
            <span className="pm-stat-icon pm-stat-icon-green">
              <FaQrcode />
            </span>
          </div>
          <div className="pm-stat-value">
            {approvedSchedules.filter(s => s.otp_code).length}
            <span className="pm-stat-unit"> / {approvedSchedules.length}</span>
          </div>
          {/* Donut-like progress ring using SVG */}
          {approvedSchedules.length > 0 ? (() => {
            const pct = approvedSchedules.filter(s => s.otp_code).length / approvedSchedules.length;
            const r = 20, circ = 2 * Math.PI * r;
            return (
              <div className="pm-ring-wrap">
                <svg width="56" height="56" viewBox="0 0 56 56">
                  <circle cx="28" cy="28" r={r} fill="none" stroke="var(--cl-border)" strokeWidth="5" />
                  <circle cx="28" cy="28" r={r} fill="none" stroke="var(--cl-success)" strokeWidth="5"
                    strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)}
                    strokeLinecap="round" transform="rotate(-90 28 28)" />
                </svg>
                <span className="pm-ring-label">{Math.round(pct * 100)}%</span>
              </div>
            );
          })() : (
            <div className="pm-stat-sub-row">
              <span className="pm-stat-pill pm-stat-pill-muted">No schedules</span>
            </div>
          )}
        </div>

        {/* Approval status */}
        <div className="pm-stat-card">
          <div className="pm-stat-card-header">
            <span className="pm-stat-label">Approval Status</span>
            <span className="pm-stat-icon pm-stat-icon-yellow">
              <FaCheckCircle />
            </span>
          </div>
          <div className={`pm-approval-badge ${hasApprovedSchedules ? 'approved' : 'waiting'}`}>
            {isViewingHistory
              ? 'Historical'
              : hasApprovedSchedules
              ? 'Approved'
              : 'Pending'}
          </div>
          <p className="pm-stat-caption">
            {isViewingHistory
              ? 'Viewing past records'
              : hasApprovedSchedules
              ? 'Schedules approved by dean'
              : 'Awaiting dean approval'}
          </p>
        </div>
      </div>

      {/* ══ TOOLBAR ══ */}
      <div className="pm-toolbar">
        <div className="pm-toolbar-left">

          {/* Sort */}
          <div style={{ position: 'relative' }} data-sort-dropdown>
            <button type="button" className="pm-toolbar-btn"
              onClick={() => setShowSortDropdown(v => !v)}>
              <FaSort style={{ fontSize: 11 }} />
              Sort{sortBy !== 'none' ? `: ${sortBy.replace('_', ' ')}` : ''}
              <FaChevronDown style={{ fontSize: 9, marginLeft: 2 }} />
            </button>
            {showSortDropdown && (
              <div className="pm-dropdown">
                {[
                  { value: 'none',            label: 'None' },
                  { value: 'exam_date',       label: 'Exam Date' },
                  { value: 'course_id',       label: 'Course Code' },
                  { value: 'subject',         label: 'Subject' },
                  { value: 'section_name',    label: 'Section' },
                  { value: 'exam_start_time', label: 'Time' },
                  { value: 'building_name',   label: 'Building' },
                  { value: 'room_id',         label: 'Room' },
                  { value: 'instructor_name', label: 'Instructor' },
                  { value: 'status',          label: 'Status' },
                ].map(o => (
                  <button key={o.value} type="button"
                    className={`pm-dropdown-item${sortBy === o.value ? ' active' : ''}`}
                    onClick={() => { setSortBy(o.value); setShowSortDropdown(false); }}>
                    {o.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Status filter */}
          <div style={{ position: 'relative' }} data-status-dropdown>
            <button type="button" className="pm-toolbar-btn"
              onClick={() => setShowStatusDropdown(v => !v)}>
              <FaFilter style={{ fontSize: 11 }} />
              {statusFilter === 'all' ? 'Status' : statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)}
              <FaChevronDown style={{ fontSize: 9, marginLeft: 2 }} />
            </button>
            {showStatusDropdown && (
              <div className="pm-dropdown">
                {(['all','present','absent','substitute','pending'] as const).map(opt => (
                  <button key={opt} type="button"
                    className={`pm-dropdown-item${statusFilter === opt ? ' active' : ''}`}
                    onClick={() => { setStatusFilter(opt); setShowStatusDropdown(false); }}>
                    {opt === 'all' ? 'All Statuses' : opt.charAt(0).toUpperCase() + opt.slice(1)}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* History */}
          <div style={{ position: 'relative' }} data-history-dropdown>
            <button type="button"
              className={`pm-toolbar-btn${isViewingHistory ? ' pm-toolbar-btn-active' : ''}`}
              onClick={() => setShowHistoryFilters(v => !v)}>
              <FaHistory style={{ fontSize: 11 }} />
              History{isViewingHistory ? ' ●' : ''}
              <FaChevronDown style={{ fontSize: 9, marginLeft: 2 }} />
            </button>
            {showHistoryFilters && (
              <div className="pm-dropdown pm-dropdown-history">
                <div className="pm-dropdown-history-header">
                  <span>Historical Records</span>
                  {isViewingHistory && (
                    <button type="button" className="pm-dropdown-clear" onClick={clearHistoryFilters}>
                      Clear
                    </button>
                  )}
                </div>
                <div className="pm-dropdown-history-body">
                  <div className="pm-filter-field">
                    <label>Year</label>
                    <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)} className="pm-select">
                      <option value="all">All Years</option>
                      {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>
                  <div className="pm-filter-field">
                    <label>Month</label>
                    <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="pm-select">
                      <option value="all">All Months</option>
                      {monthOptions.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                  </div>
                  <div className="pm-filter-field">
                    <label>Sort Order</label>
                    <select value={historySortOrder} onChange={e => setHistorySortOrder(e.target.value as any)} className="pm-select">
                      <option value="newest">Newest First</option>
                      <option value="oldest">Oldest First</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Rows per page */}
          <div style={{ position: 'relative' }} data-items-per-page-dropdown>
            <button type="button" className="pm-toolbar-btn"
              onClick={() => setShowItemsPerPageDropdown(v => !v)}>
              <FaChevronDown style={{ fontSize: 9 }} />
              Rows: {itemsPerPage}
            </button>
            {showItemsPerPageDropdown && (
              <div className="pm-dropdown">
                {[10, 20, 30, 50].map(n => (
                  <button key={n} type="button"
                    className={`pm-dropdown-item${itemsPerPage === n ? ' active' : ''}`}
                    onClick={() => { setItemsPerPage(n); setShowItemsPerPageDropdown(false); setCurrentPage(1); }}>
                    {n}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Pagination */}
        <div className="pm-pagination">
          <button type="button" className="pm-page-btn"
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage <= 1 || totalItems === 0}>
            <FaChevronLeft style={{ fontSize: 10 }} />
          </button>
          <span className="pm-page-info">
            {totalItems === 0 ? '0 / 0' : `${currentPage} / ${totalPages}`}
          </span>
          <button type="button" className="pm-page-btn"
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage >= totalPages || totalItems === 0}>
            <FaChevronRight style={{ fontSize: 10 }} />
          </button>
        </div>
      </div>

      {/* ══ TABLE CARD ══ */}
      <div className="pm-table-card">
        {loading ? (
          <div className="pm-table-empty">
            <div className="pm-spinner" />
            Loading monitoring data…
          </div>
        ) : (
          <div className="pm-table-container">
            <table className="pm-table">
              <thead>
                <tr>
                  <th style={{ width: 52 }}>#</th>
                  <th>Status</th>
                  <th>Course</th>
                  <th>Subject</th>
                  <th>Section/s</th>
                  <th><FaCalendarAlt style={{ marginRight: 4, fontSize: 10 }} />Date</th>
                  <th><FaClock style={{ marginRight: 4, fontSize: 10 }} />Time</th>
                  <th><FaBuilding style={{ marginRight: 4, fontSize: 10 }} />Building</th>
                  <th><FaDoorOpen style={{ marginRight: 4, fontSize: 10 }} />Room</th>
                  <th>Instructor</th>
                  <th><FaQrcode style={{ marginRight: 4, fontSize: 10 }} />Exam Code</th>
                  <th><FaUserTie style={{ marginRight: 4, fontSize: 10 }} />Proctors</th>
                </tr>
              </thead>
              <tbody>
                {paginated.length > 0 ? paginated.map((s, i) => {
                  const examStatus = getExamStatus(s);
                  return (
                    <tr key={s.id}
                      onClick={() => { setSelectedSchedule(s); setShowProctorModal(true); }}
                      className={`pm-exam-row pm-exam-row-${examStatus}`}
                      style={{ cursor: 'pointer' }}>
                      <td className="pm-td-num">
                        {(currentPage - 1) * itemsPerPage + i + 1}
                      </td>
                      <td>
                        <span className={`pm-status-badge pm-status-${examStatus}`}>
                          {examStatus === 'upcoming' ? 'Upcoming' : 'Done'}
                        </span>
                      </td>
                      <td>
                        <span className="pm-course-badge">{s.course_id}</span>
                      </td>
                      <td className="pm-subject-cell">{s.subject}</td>
                      <td className="pm-section-cell">
                        {formatSectionRanges(s.sections || [s.section_name])}
                      </td>
                      <td className="pm-mono-cell">{s.exam_date}</td>
                      <td className="pm-time-cell">
                        {fmt12(s.exam_start_time)} – {fmt12(s.exam_end_time)}
                      </td>
                      <td>{s.building_name}</td>
                      <td className="pm-mono-cell">{s.room_id}</td>
                      <td>{s.instructor_name}</td>
                      <td>
                        <div className="pm-otp-field">
                          {s.otp_code
                            ? s.otp_code
                            : <span className="pm-otp-empty">Not generated</span>}
                        </div>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className="pm-proctor-chip">
                          {s.proctor_details.length} {s.proctor_details.length === 1 ? 'proctor' : 'proctors'}
                        </span>
                      </td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan={12} className="pm-table-empty">
                      {hasApprovedSchedules
                        ? 'No schedules match your filters.'
                        : 'No approved schedules yet. Schedules must be approved by the dean before codes can be generated.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ══ PROCTOR DETAILS MODAL ══ */}
      {showProctorModal && selectedSchedule && (
        <div className="pm-modal-overlay" onClick={() => setShowProctorModal(false)}>
          <div className="pm-modal" onClick={e => e.stopPropagation()}>
            <div className="pm-modal-header">
              <div>
                <h3>Proctor Details</h3>
                <p>{selectedSchedule.course_id} — {selectedSchedule.subject}</p>
              </div>
              <button className="pm-modal-close-btn" onClick={() => setShowProctorModal(false)}>
                <FaTimes />
              </button>
            </div>

            <div className="pm-modal-body">
              {/* Exam info grid */}
              <div className="pm-modal-info-grid">
                {[
                  ['Course',      `${selectedSchedule.course_id} — ${selectedSchedule.subject}`],
                  ['Section',     selectedSchedule.section_name],
                  ['Date',        selectedSchedule.exam_date],
                  ['Time',        `${fmt12(selectedSchedule.exam_start_time)} – ${fmt12(selectedSchedule.exam_end_time)}`],
                  ['Building',    selectedSchedule.building_name],
                  ['Room',        selectedSchedule.room_id],
                  ...(selectedSchedule.instructor_name ? [['Instructor', selectedSchedule.instructor_name]] : []),
                  ...(selectedSchedule.otp_code ? [['Exam Code', selectedSchedule.otp_code]] : []),
                ].map(([k, v]) => (
                  <div key={k} className="pm-info-item">
                    <span className="pm-info-key">{k}</span>
                    <span className={`pm-info-val${k === 'Exam Code' ? ' pm-info-val-mono' : ''}`}>{v}</span>
                  </div>
                ))}
              </div>

              {/* Proctor list */}
              <div className="pm-proctor-section">
                <p className="pm-proctor-section-title">
                  Proctors ({selectedSchedule.proctor_details.length})
                </p>
                {selectedSchedule.proctor_details.length > 0 ? (
                  <div className="pm-proctor-list">
                    {selectedSchedule.proctor_details.map(p => {
                      const st = getStatusDisplay(p.status);
                      return (
                        <div key={p.proctor_id}
                          className={`pm-proctor-card${p.is_substitute ? ' pm-proctor-card-sub' : ''}`}>
                          <div className="pm-proctor-info">
                            <p className="pm-proctor-name">
                              {p.is_substitute ? '🔄 ' : ''}{p.proctor_name}
                              <span className="pm-proctor-role">
                                {p.is_assigned ? 'Assigned' : 'Substitute'}
                              </span>
                            </p>
                            <div className="pm-proctor-meta">
                              <FaClock style={{ fontSize: 10 }} />
                              Time In: {formatTimeInLocal(p.time_in)}
                            </div>
                            {p.is_substitute && p.substituted_for && (
                              <p className="pm-proctor-reason">
                                Replacing: <strong>{p.substituted_for}</strong>
                                {p.substitution_remarks && ` — ${p.substitution_remarks}`}
                              </p>
                            )}
                          </div>
                          <span className={`pm-badge ${st.cls}`}>{st.text}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="pm-proctor-empty">No proctors assigned</p>
                )}
              </div>
            </div>

            <div className="pm-modal-footer">
              <button className="pm-btn" onClick={() => setShowProctorModal(false)}>Cancel</button>
              <button className="pm-btn primary" onClick={() => setShowProctorModal(false)}>
                <FaCheckCircle style={{ fontSize: 11 }} /> Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ RESET CONFIRM MODAL ══ */}
      {showResetConfirm && (
        <div className="pm-modal-overlay" onClick={() => setShowResetConfirm(false)}>
          <div className="pm-modal pm-modal-sm" onClick={e => e.stopPropagation()}>
            <div className="pm-modal-header">
              <h3>Reset Exam Codes</h3>
            </div>
            <div className="pm-modal-body">
              <p style={{ fontSize: '13.5px', color: 'var(--cl-text-secondary)', lineHeight: 1.7, margin: 0 }}>
                Are you sure? This will delete all existing OTP codes and cannot be undone.
              </p>
            </div>
            <div className="pm-modal-footer">
              <button className="pm-btn" onClick={() => setShowResetConfirm(false)}>Cancel</button>
              <button className="pm-btn danger-fill" onClick={handleResetOtpCodes} disabled={resettingOtp}>
                <FaSync style={{ fontSize: 11 }} />
                {resettingOtp ? 'Resetting…' : 'Yes, Reset'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProctorMonitoring;