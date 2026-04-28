/// <reference types="react" />
import React, { useEffect, useState, useRef } from "react";
import Select from "react-select";
import { api } from '../lib/apiClient.ts';
import "../styles/S_ExamViewer.css";
import { FaChevronLeft, FaChevronRight, FaUserEdit, FaEnvelope, FaFileDownload, FaPlus, FaTrash, FaCog } from "react-icons/fa";
import { MdSwapHoriz } from 'react-icons/md';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Modal from "./S_Modal.tsx";
import AddScheduleForm from "./S_ExamGenerator.tsx";
import EmailSender from "./S_Sender_Email.tsx";
import DeanSend from "./S_ScheduleSendToDean.tsx";
import ExportSchedule from "./S_ExportSchedule.tsx";
import FooterSettingsModal from "./S_SettingsModal.tsx";
import ManualScheduleEditor from './S_ManualScheduleEditor.tsx';
import { FaEdit } from 'react-icons/fa';

interface ExamDetail {
  examdetails_id?: number; course_id: string; section_name?: string; sections?: string[]; room_id?: string; exam_date?: string; exam_start_time?: string; semester?: string;
  exam_end_time?: string; instructor_id?: number; instructors?: number[]; proctor_id?: number; proctors?: number[]; academic_year?: string; building_name?: string;
  examdetails_status?: string; program_id?: string; college_name?: string; modality_id?: number; exam_period?: string; exam_category?: string;
}

interface SchedulerViewProps {
  user: {
    user_id: number;
    email_address: string;
    first_name?: string;
    last_name?: string;
    middle_name?: string;
    contact_number: string;
  } | null;
}

interface Step2ModalProps {
  schedulerCollegeName: string;
  loading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}
 
const Step2Modal: React.FC<Step2ModalProps> = ({
  schedulerCollegeName,
  loading,
  onCancel,
  onConfirm,
}) => {
  const [countdown, setCountdown] = useState(5);
 
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);
 
  const canDelete = countdown === 0 && !loading;
  const progress = ((5 - countdown) / 5) * 100;
 
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10000,
      background: 'rgba(9,44,76,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      animation: 'fadeIn 0.2s ease',
    }}>
      <div style={{
        background: 'var(--surface)',
        borderRadius: 'var(--radius-xl)',
        padding: '36px 32px 28px',
        width: 'min(90vw, 420px)',
        boxShadow: 'var(--shadow-lg)',
        fontFamily: 'var(--font)',
        animation: 'slideUp 0.25s ease',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
      }}>
        {/* Danger icon ring */}
        <div style={{
          width: 64, height: 64, borderRadius: '50%',
          background: 'var(--danger-soft)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 18,
        }}>
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#C0392B" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
            <path d="M10 11v6"/><path d="M14 11v6"/>
            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
          </svg>
        </div>
 
        <h3 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 700, color: 'var(--danger)', textAlign: 'center' }}>
          Final Confirmation
        </h3>
        <p style={{ margin: '0 0 6px', fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center', lineHeight: 1.6 }}>
          This will <strong style={{ color: 'var(--danger)' }}>permanently remove</strong> all exam schedules for{' '}
          <strong style={{ color: 'var(--text-primary)' }}>{schedulerCollegeName}</strong>.
        </p>
        <p style={{ margin: '0 0 20px', fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
          There is no way to recover deleted schedules.
        </p>
 
        {/* Countdown progress track */}
        <div style={{ width: '100%', marginBottom: 16 }}>
          <div style={{
            width: '100%', height: 6, borderRadius: 99,
            background: 'var(--surface-3)', overflow: 'hidden',
            marginBottom: 6,
          }}>
            <div style={{
              width: `${progress}%`,
              height: '100%',
              borderRadius: 99,
              background: countdown === 0 ? 'var(--danger)' : 'var(--border-2)',
              transition: 'width 1s linear, background 0.4s',
            }} />
          </div>
          {countdown > 0 && (
            <p style={{
              margin: 0, fontSize: 11.5, textAlign: 'center',
              color: 'var(--text-muted)', fontFamily: 'var(--mono)',
              letterSpacing: '0.03em',
            }}>
            </p>
          )}
        </div>
 
        <div style={{ display: 'flex', gap: 10, width: '100%' }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            style={{
              flex: 1, height: 40,
              border: '1.5px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--surface)',
              color: 'var(--text-secondary)',
              fontFamily: 'var(--font)',
              fontSize: 13, fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.5 : 1,
            }}
          >
            Cancel
          </button>
 
          <button
            type="button"
            onClick={canDelete ? onConfirm : undefined}
            disabled={!canDelete}
            style={{
              flex: 1, height: 40, border: 'none',
              borderRadius: 'var(--radius-md)',
              background: canDelete
                ? (loading ? '#e57373' : 'var(--danger)')
                : 'var(--surface-3)',
              color: canDelete ? '#fff' : 'var(--text-muted)',
              fontFamily: 'var(--font)',
              fontSize: 13, fontWeight: 700,
              cursor: canDelete ? 'pointer' : 'not-allowed',
              transition: 'background 0.3s, color 0.3s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            {loading ? (
              <>
                <span style={{
                  width: 15, height: 15,
                  border: '2.5px solid rgba(255,255,255,0.35)',
                  borderTopColor: '#fff',
                  borderRadius: '50%',
                  display: 'inline-block',
                  animation: 'sv-spin 0.7s linear infinite',
                }} />
                Deleting…
              </>
            ) : countdown > 0 ? (
              <>
                <span style={{
                  width: 20, height: 20, borderRadius: '50%',
                  border: '2px solid var(--border-2)',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 700, color: 'var(--text-muted)',
                  fontFamily: 'var(--mono)',
                }}>
                  {countdown}
                </span>
                Delete Permanently
              </>
            ) : (
              'Delete Permanently'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

const SchedulerView: React.FC<SchedulerViewProps> = ({ user }) => {
  const [examData, setExamData] = useState<ExamDetail[]>([]);
  const [users, setUsers] = useState<{ user_id: number; first_name: string; last_name: string }[]>([]);
  const [page, setPage] = useState(0);
  const [_activeCards, _setActiveCards] = useState<Record<string, boolean>>({});
  const [swapMode, setSwapMode] = useState(false);
  const [showSwapInstructions, setShowSwapInstructions] = useState(false);
  const [selectedSwap, setSelectedSwap] = useState<ExamDetail | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<string>("all");
  const [_proctors, setProctors] = useState<{ user_id: number; first_name: string; last_name: string }[]>([]);
  const [allCollegeUsers, setAllCollegeUsers] = useState<{ user_id: number; first_name: string; last_name: string }[]>([]);
  const [activeProctorEdit, setActiveProctorEdit] = useState<number | null>(null);
  const [showProctorInstructions, setShowProctorInstructions] = useState(false);
  const [showEnvelopeDropdown, setShowEnvelopeDropdown] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showDeanModal, setShowDeanModal] = useState(false);
  const [_deanInfo, setDeanInfo] = useState<{ name: string; user_id: number } | null>(null);
  const envelopeRef = useRef<HTMLDivElement>(null);
  const [schedulerCollegeName, setSchedulerCollegeName] = useState<string>("");
  const [isLoadingData, setIsLoadingData] = useState(true);

  const collegeName = (schedulerCollegeName || examData.find(e => e.college_name)?.college_name) ?? "Add schedule first";
  const examPeriodName = examData.find(e => e.exam_period)?.exam_period ?? "-";
  const termName = examData.find(e => e.exam_category)?.exam_category ?? "-";
  const semesterName = examData.find(e => e.semester)?.semester ?? "-";
  const yearName = examData.find(e => e.academic_year)?.academic_year ?? "-";
  const buildingName = examData.find(e => e.building_name)?.building_name ?? "-";

  const [searchTerm, setSearchTerm] = useState<string>("");
  const [searchMatches, setSearchMatches] = useState<ExamDetail[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState<number>(-1);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [activePanel, setActivePanel] = useState<string | null>(null);

  const maxRoomColumns = 5;
  const [_sendingToDean, _setSendingToDean] = useState(false);
  const [approvalStatus, setApprovalStatus] = useState<'pending' | 'approved' | 'rejected' | null>(null);
  const [remarks, setRemarks] = useState<string | null>(null);

  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const [isScheduleLoading, setIsScheduleLoading] = useState(true);

  const [_showExportDropdown, setShowExportDropdown] = useState(false);
  const [collegeDataReady, setCollegeDataReady] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);
  const [schedulerCollegeId, setSchedulerCollegeId] = useState<string>("");
  const [showFooterSettings, setShowFooterSettings] = useState(false);
  const [showManualEditor, setShowManualEditor] = useState(false);
  const [manualEditorSections, setManualEditorSections] = useState<any[]>([]);
  const [persistentUnscheduled, setPersistentUnscheduled] = useState<any[]>([]);
  const [showUnscheduledBadge, setShowUnscheduledBadge] = useState(false);
  const [deanName, _setDeanName] = useState<string>('');
  const [showIconLabels, setShowIconLabels] = useState<boolean>(() => {
    const stored = localStorage.getItem('showIconLabels');
    return stored ? JSON.parse(stored) : false;
  });

  const [_deleteProgress, setDeleteProgress] = useState<{
    isDeleting: boolean;
    progress: number;
    message: string;
  } | null>(null);
  
  const [deleteModal, setDeleteModal] = useState<{
    step: 'confirm1' | 'confirm2';
    loading: boolean;
  } | null>(null);

  // ✅ Drag-and-drop state for reordering exams
  const [draggedExamId, setDraggedExamId] = useState<number | null>(null);
  const [draggedOverExamId, setDraggedOverExamId] = useState<number | null>(null);
  const [_isDragDropMode, setIsDragDropMode] = useState(false);
  const [hoveredCellId, setHoveredCellId] = useState<string | null>(null);

  const handleDragStart = (examId: number) => {
    if (!swapMode) return;
    setDraggedExamId(examId);
    setIsDragDropMode(true);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragEnter = (examId: number) => {
    setDraggedOverExamId(examId);
  };

  const handleDrop = async (targetExamId: number) => {
    if (!draggedExamId || draggedExamId === targetExamId) {
      setDraggedExamId(null);
      setDraggedOverExamId(null);
      setIsDragDropMode(false);
      return;
    }

    const draggedIdx = examData.findIndex(e => e.examdetails_id === draggedExamId);
    const targetIdx = examData.findIndex(e => e.examdetails_id === targetExamId);

    if (draggedIdx === -1 || targetIdx === -1) {
      setDraggedExamId(null);
      setDraggedOverExamId(null);
      setIsDragDropMode(false);
      return;
    }

    // ✅ Save originals BEFORE touching the array
    const originalDragged = examData[draggedIdx];
    const originalTarget = examData[targetIdx];

    try {
      const updates = [
        {
          examdetails_id: originalDragged.examdetails_id,
          exam_date: originalTarget.exam_date,
          exam_start_time: originalTarget.exam_start_time,
          exam_end_time: originalTarget.exam_end_time,
          room_id: originalTarget.room_id
        },
        {
          examdetails_id: originalTarget.examdetails_id,
          exam_date: originalDragged.exam_date,
          exam_start_time: originalDragged.exam_start_time,
          exam_end_time: originalDragged.exam_end_time,
          room_id: originalDragged.room_id
        }
      ];

      await Promise.all(updates.map(update =>
        api.patch(`/tbl_examdetails/${update.examdetails_id}/`, {
          exam_date: update.exam_date,
          exam_start_time: update.exam_start_time,
          exam_end_time: update.exam_end_time,
          room_id: update.room_id
        })
      ));

      // ✅ Now update local state to reflect the swap
      const newExamData = [...examData];
      newExamData[draggedIdx] = { ...originalDragged, ...updates[0] };
      newExamData[targetIdx] = { ...originalTarget, ...updates[1] };

      setExamData(newExamData);
      toast.success('Exams reordered successfully!');
    } catch (error: any) {
      toast.error('Failed to reorder exams: ' + (error.response?.data?.detail || error.message));
    }

    setDraggedExamId(null);
    setDraggedOverExamId(null);
    setIsDragDropMode(false);
  };

  const handleDropToCell = async (cellDate: string | undefined, cellRoomId: string, cellStartTime: string, _cellEndTime: string) => {
    if (!draggedExamId || !cellDate) {
      setDraggedExamId(null);
      setDraggedOverExamId(null);
      setIsDragDropMode(false);
      return;
    }

    try {
      const draggedExam = examData.find(e => e.examdetails_id === draggedExamId);
      if (!draggedExam) {
        toast.error('Exam not found');
        return;
      }

      // ✅ Calculate original duration from the exam itself
      const origStartStr = draggedExam.exam_start_time!.slice(11, 16); // "HH:MM"
      const origEndStr = draggedExam.exam_end_time!.slice(11, 16);

      const [origStartH, origStartM] = origStartStr.split(':').map(Number);
      const [origEndH, origEndM] = origEndStr.split(':').map(Number);
      const durationMinutes = (origEndH * 60 + origEndM) - (origStartH * 60 + origStartM);

      // ✅ New start = cell slot time, new end = start + original duration
      const cellSlotTime = cellStartTime.slice(11, 16); // extract "HH:MM" from the cell
      const [newStartH, newStartM] = cellSlotTime.split(':').map(Number);
      const newEndTotalMinutes = newStartH * 60 + newStartM + durationMinutes;
      const newEndH = Math.floor(newEndTotalMinutes / 60);
      const newEndM = newEndTotalMinutes % 60;

      const newStartTimeStr = `${String(newStartH).padStart(2, '0')}:${String(newStartM).padStart(2, '0')}`;
      const newEndTimeStr = `${String(newEndH).padStart(2, '0')}:${String(newEndM).padStart(2, '0')}`;

      // ✅ Build timestamps without Z suffix (match your DB format)
      const newExamStartTime = `${cellDate}T${newStartTimeStr}:00`;
      const newExamEndTime = `${cellDate}T${newEndTimeStr}:00`;

      // Validate: must end by 9 PM
      if (newEndTotalMinutes > 21 * 60) {
        toast.error(`Exam would end after 9:00 PM. Cannot move here.`);
        setDraggedExamId(null);
        setDraggedOverExamId(null);
        setIsDragDropMode(false);
        return;
      }

      // Validate proctor conflicts (use new time range)
      const realProctorIds = [
        ...(draggedExam.proctors ?? []),
        ...(draggedExam.proctor_id ? [draggedExam.proctor_id] : [])
      ].filter(id => id && id > 0); // ✅ filter out -1, -9999, 0, null, undefined

      if (realProctorIds.length > 0) {
        for (const proctorId of realProctorIds) {
          const conflict = examData.find(e => {
            if (e.examdetails_id === draggedExamId) return false;
            if (e.exam_date !== cellDate) return false;
            const hasProctor = e.proctor_id === proctorId || (e.proctors && e.proctors.includes(proctorId));
            if (!hasProctor) return false;
            if (!e.exam_start_time || !e.exam_end_time) return false;
            const eStart = Number(e.exam_start_time.slice(11, 16).replace(':', ''));
            const eEnd = Number(e.exam_end_time.slice(11, 16).replace(':', ''));
            const nStart = Number(newStartTimeStr.replace(':', ''));
            const nEnd = Number(newEndTimeStr.replace(':', ''));
            return nStart < eEnd && nEnd > eStart;
          });

          if (conflict) {
            const proctorName = getUserName(proctorId);
            toast.error(`Proctor ${proctorName} has a conflict at this time.`);
            setDraggedExamId(null);
            setDraggedOverExamId(null);
            setIsDragDropMode(false);
            return;
          }
        }
      }

      // Validate room conflicts (use new time range)
      const roomConflict = examData.find(e => {
        if (e.examdetails_id === draggedExamId) return false;
        if (e.exam_date !== cellDate || e.room_id !== cellRoomId) return false;
        if (!e.exam_start_time || !e.exam_end_time) return false;
        const eStart = Number(e.exam_start_time.slice(11, 16).replace(':', ''));
        const eEnd = Number(e.exam_end_time.slice(11, 16).replace(':', ''));
        const nStart = Number(newStartTimeStr.replace(':', ''));
        const nEnd = Number(newEndTimeStr.replace(':', ''));
        return nStart < eEnd && nEnd > eStart;
      });

      if (roomConflict) {
        toast.error(`Room ${cellRoomId} is already occupied at this time.`);
        setDraggedExamId(null);
        setDraggedOverExamId(null);
        setIsDragDropMode(false);
        return;
      }

      // All clear — update DB and local state
      await api.put(`/tbl_examdetails/${draggedExamId}/`, {
        exam_date: cellDate,
        exam_start_time: newExamStartTime,
        exam_end_time: newExamEndTime,
        room_id: cellRoomId
      });

      setExamData(prev => prev.map(e =>
        e.examdetails_id === draggedExamId
          ? { ...e, exam_date: cellDate, exam_start_time: newExamStartTime, exam_end_time: newExamEndTime, room_id: cellRoomId }
          : e
      ));

      toast.success('Exam moved successfully!');
    } catch (error: any) {
      toast.error('Failed to move exam: ' + (error.response?.data?.detail || error.message));
    }

    setDraggedExamId(null);
    setDraggedOverExamId(null);
    setIsDragDropMode(false);
  };

  const resetAllModes = () => {
    setActiveProctorEdit(null);
    setSwapMode(false);
    setShowSwapInstructions(false);
    setShowProctorInstructions(false);
    setShowEnvelopeDropdown(false);
    setShowExportDropdown(false);
    setIsDragDropMode(false);
    setActivePanel(null); // ← NEW
  };

  const saveUnscheduledSections = (sections: any[]) => {
    if (schedulerCollegeName && schedulerCollegeName !== "Add schedule first") {
      if (sections.length > 0) {
        localStorage.setItem(`unscheduled_${schedulerCollegeName}`, JSON.stringify(sections));
        setPersistentUnscheduled(sections);
        setShowUnscheduledBadge(true);
      } else {
        localStorage.removeItem(`unscheduled_${schedulerCollegeName}`);
        setPersistentUnscheduled([]);
        setShowUnscheduledBadge(false);
      }
    }
  };

  const [footerData, setFooterData] = useState<{
    prepared_by_name: string;
    prepared_by_title: string;
    approved_by_name: string;
    approved_by_title: string;
    address_line: string;
    contact_line: string;
    logo_url: string | null;
    logo_urls?: string[];       // ← add this
  } | null>(null);

  useEffect(() => {
    const loadUnscheduledSections = () => {
      const stored = localStorage.getItem(`unscheduled_${schedulerCollegeName}`);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setPersistentUnscheduled(parsed);
            setShowUnscheduledBadge(true);
          }
        } catch (e) {
        }
      }
    };

    if (schedulerCollegeName && schedulerCollegeName !== "Add schedule first") {
      loadUnscheduledSections();
    }
  }, [schedulerCollegeName]);

  useEffect(() => {
    const handleFilterOutside = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setFilterMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleFilterOutside);
    return () => document.removeEventListener('mousedown', handleFilterOutside);
  }, []);

  useEffect(() => {
    const preventZoom = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
      }
    };

    document.addEventListener('wheel', preventZoom, { passive: false });
    return () => document.removeEventListener('wheel', preventZoom);
  }, []);

  // Fetch footer data
  useEffect(() => {
    const fetchFooterData = async () => {
      if (!schedulerCollegeId) return;

      try {
        const response = await api.get('/tbl_schedule_footer/', {
          params: { college_id: schedulerCollegeId }
        });

        if (response.data && response.data.length > 0) {
          const data = response.data[0];
          setFooterData({
            ...data,
            prepared_by_name:
              data.prepared_by_name?.trim()
                ? data.prepared_by_name
                : deanName,
            logo_urls: data.logo_urls && data.logo_urls.length > 0
              ? data.logo_urls
              : data.logo_url
                ? [data.logo_url]
                : [],
          });
        } else {
          setFooterData({
            prepared_by_name: 'Loading...',
            prepared_by_title: `Dean, ${collegeName}`,
            approved_by_name: 'Loading...',
            approved_by_title: 'VCAA, USTP-CDO',
            address_line: 'C.M Recto Avenue, Lapasan, Cagayan de Oro City 9000 Philippines',
            contact_line: 'Tel Nos. +63 (88) 856 1738; Telefax +63 (88) 856 4696 | http://www.ustp.edu.ph',
            logo_url: null,
            logo_urls: []
          });
        }
      } catch (error) {
      }
    };

    fetchFooterData();
  }, [schedulerCollegeId, collegeName]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (envelopeRef.current && !envelopeRef.current.contains(event.target as Node)) {
        setShowEnvelopeDropdown(false);
      }
      if (exportRef.current && !exportRef.current.contains(event.target as Node)) {
        setShowExportDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchSchedulerData = async () => {
      if (!user?.user_id) {
        setIsLoadingData(false);
        return;
      }

      const realUserId = user.user_id;

      try {
        const schedulerRolesResponse = await api.get('/tbl_user_role', {
          params: {
            user_id: realUserId,
            role_id: 3
          }
        });

        const schedulerRoles = schedulerRolesResponse.data;
        if (!schedulerRoles || schedulerRoles.length === 0) {
          setIsLoadingData(false);
          return;
        }

        const schedulerCollegeId = schedulerRoles[0].college_id;

        setSchedulerCollegeId(schedulerCollegeId);

        const collegeResponse = await api.get(`/tbl_college/${schedulerCollegeId}/`);
        const collegeName = collegeResponse.data?.college_name;
        setSchedulerCollegeName(collegeName || "");

        const departmentsResponse = await api.get('/departments/', {
          params: {
            college_id: schedulerCollegeId
          }
        });

        const departments = departmentsResponse.data;
        const departmentIds = departments?.map((d: any) => d.department_id) || [];

        const proctorRolesResponse = await api.get('/tbl_user_role', {
          params: {
            role_id: 5
          }
        });

        const proctorRoles = proctorRolesResponse.data;
        if (!proctorRoles || proctorRoles.length === 0) {
          setAllCollegeUsers([]);
          setIsLoadingData(false);
          return;
        }

        const matchingUserIds = new Set<number>();

        proctorRoles.forEach((p: any) => {
          let matches = false;

          if (p.college_id && String(p.college_id) === String(schedulerCollegeId)) {
            matches = true;
          }
          else if (p.department_id && departmentIds.includes(p.department_id)) {
            matches = true;
          }

          if (!matches) {
          }

          if (matches) {
            matchingUserIds.add(p.user_id);
          }
        });

        const usersResponse = await api.get('/users/');
        const allUsers = usersResponse.data;
        const userDetails = allUsers.filter((u: any) => matchingUserIds.has(u.user_id));

        setAllCollegeUsers(userDetails || []);
        setProctors(userDetails || []);

        setUsers((prevUsers) => {
          const existingUserIds = new Set(prevUsers.map(u => u.user_id));
          const newUsers = (userDetails || []).filter((u: { user_id: number; }) => !existingUserIds.has(u.user_id));
          return [...prevUsers, ...newUsers];
        });

        const deanRoleResponse = await api.get('/tbl_user_role', {
          params: {
            college_id: schedulerCollegeId,
            role_id: 1
          }
        });

        const deanRoles = deanRoleResponse.data;
        if (deanRoles && deanRoles.length > 0) {
          const deanRole = deanRoles[0];
          const deanUserResponse = await api.get(`/users/`);
          const deanUser = deanUserResponse.data.find((u: any) => u.user_id === deanRole.user_id);

          if (deanUser) {
            setDeanInfo({
              name: `${deanUser.first_name} ${deanUser.last_name}`,
              user_id: deanUser.user_id
            });
          }
        }

        setIsLoadingData(false);
        setCollegeDataReady(true);
      } catch (error) {
        setIsLoadingData(false);
      }
    };

    fetchSchedulerData();
  }, [user]);

  useEffect(() => {
    if (!collegeDataReady) return;

    const fetchData = async () => {
      try {
        const examParams: any = {};
        if (schedulerCollegeName && schedulerCollegeName !== "Add schedule first") {
          examParams.college_name = schedulerCollegeName;
        }

        const [examsResponse, usersResponse] = await Promise.all([
          api.get('/tbl_examdetails', { params: examParams }),
          api.get('/users/')
        ]);

        if (examsResponse.data) {

          const invalidSchedules = examsResponse.data.filter((e: ExamDetail) =>
            !e.room_id || !e.exam_start_time || !e.exam_end_time
          );

          if (invalidSchedules.length > 0) {
          }

          setExamData(examsResponse.data);
        }

        if (usersResponse.data) {
          setUsers(usersResponse.data);
        }
        setIsScheduleLoading(false);
      } catch (error) {
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 2000);
    return () => clearInterval(interval);
  }, [user, schedulerCollegeName, collegeDataReady]);

  useEffect(() => {
    const checkApprovalStatus = async () => {
      if (!user?.user_id || !collegeName || collegeName === "Add schedule first") {
        if (approvalStatus !== null || remarks !== null) {
          setApprovalStatus(null);
          setRemarks(null);
        }
        return;
      }

      if (examData.length === 0) {
        if (approvalStatus !== null || remarks !== null) {
          setApprovalStatus(null);
          setRemarks(null);
        }
        return;
      }

      try {
        const response = await api.get('/tbl_scheduleapproval/', {
          params: {
            college_name: collegeName
          }
        });

        if (response.data && response.data.length > 0) {
          const sortedData = response.data.sort((a: any, b: any) =>
            new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime()
          );
          const latestApproval = sortedData[0];

          const previousStatus = approvalStatus;
          const newStatus = latestApproval.status as 'pending' | 'approved' | 'rejected';

          if (previousStatus && previousStatus !== newStatus) {
            if (newStatus === 'approved') {
              toast.success('Your schedule has been approved by the dean!', {
                autoClose: 5000,
                position: 'top-center'
              });
            } else if (newStatus === 'rejected') {
              toast.error(`Your schedule was rejected. Reason: ${latestApproval.remarks || 'No reason provided'}`, {
                autoClose: 7000,
                position: 'top-center'
              });
            }
          }

          setApprovalStatus(newStatus);
          setRemarks(latestApproval.remarks ?? null);
        } else {
          setApprovalStatus(null);
          setRemarks(null);
        }
      } catch (error) {
        setApprovalStatus(null);
        setRemarks(null);
      }
    };

    checkApprovalStatus();
    const interval = setInterval(checkApprovalStatus, 5000);
    return () => clearInterval(interval);
  }, [user, collegeName, approvalStatus, examData.length]);

  const getSectionDisplay = (exam: ExamDetail): string => {
    if (!exam.sections || exam.sections.length === 0) {
      return exam.section_name || "N/A";
    }

    const rawSections = Array.from(new Set(
      exam.sections
        .map(s => (s ?? "").toString().trim())
        .filter(Boolean)
    ));

    const validSections = rawSections.filter(s =>
      /^(.+?)(\d+)(_[A-Za-z0-9]+)?$/.test(s) && !/[\s,]/.test(s)
    );

    if (validSections.length === 0) {
      return exam.section_name || "N/A";
    }

    if (validSections.length === 1) return validSections[0];

    validSections.sort((a, b) => {
      const ma = a.match(/^(.+?)(\d+)(_[A-Za-z0-9]+)?$/)!;
      const mb = b.match(/^(.+?)(\d+)(_[A-Za-z0-9]+)?$/)!;
      const prefixA = ma[1], prefixB = mb[1];
      if (prefixA !== prefixB) return prefixA.localeCompare(prefixB);
      const na = parseInt(ma[2], 10), nb = parseInt(mb[2], 10);
      return na - nb;
    });

    const groups: Record<string, { num: number; original: string }[]> = {};
    validSections.forEach(s => {
      const m = s.match(/^(.+?)(\d+)(_[A-Za-z0-9]+)?$/)!;
      const prefix = m[1];
      const num = parseInt(m[2], 10);
      const suffix = m[3] || "";
      const key = prefix + suffix;
      groups[key] = groups[key] || [];
      groups[key].push({ num, original: s });
    });

    const parts: string[] = [];
    Object.keys(groups).forEach(key => {
      const items = groups[key].sort((a, b) => a.num - b.num);
      let startIdx = 0;
      for (let i = 0; i < items.length; i++) {
        const isEnd = i === items.length - 1 || items[i + 1].num !== items[i].num + 1;
        if (isEnd) {
          const size = i - startIdx + 1;
          if (size >= 2) {
            parts.push(`${items[startIdx].original} - ${items[i].original}`);
          } else {
            parts.push(items[i].original);
          }
          startIdx = i + 1;
        }
      }
    });

    return parts.join(", ");
  };

  const getInstructorDisplay = (exam: ExamDetail): string => {
    if (exam.instructors && exam.instructors.length > 0) {
      const names = exam.instructors.map(id => getUserName(id)).filter(n => n !== '-');
      if (names.length === 0) return '-';
      if (names.length === 1) return names[0];
      return names.join(', ');
    }
    return getUserName(exam.instructor_id);
  };

  const getProctorDisplay = (exam: ExamDetail): string => {
    // Priority 1: Use proctors array if available
    if (exam.proctors && exam.proctors.length > 0) {
      const names = exam.proctors
        .map(id => getUserName(id))
        .filter(n => n !== '-');

      if (names.length === 0) return 'Not Assigned';

      return names.join(', ');
    }

    if (exam.proctor_id) {
      return getUserName(exam.proctor_id);
    }

    return 'Not Assigned';
  };

  const handleProctorChange = async (examId: number, proctorIds: number | number[]) => {
    try {
      const proctorArray = Array.isArray(proctorIds) ? proctorIds : [proctorIds];

      const primaryProctorId = proctorArray.length > 0 ? proctorArray[0] : undefined;

      await api.put(`/tbl_examdetails/${examId}/`, {
        proctor_id: primaryProctorId,
        proctors: proctorArray
      });

      setExamData(prev =>
        prev.map(e => e.examdetails_id === examId
          ? {
            ...e,
            proctor_id: primaryProctorId,
            proctors: proctorArray
          }
          : e
        )
      );

      if (proctorArray.length === 0) {
        toast.success("Proctors cleared!");
      } else {
        toast.success(`${proctorArray.length} proctor(s) updated!`);
      }
    } catch (error) {
      toast.error("Failed to update proctor.");
    }
  };

  const getUserName = (id: number | null | undefined) => {
    if (!id) {
      return "-";
    }

    const numericId = typeof id === 'string' ? parseInt(id, 10) : id;

    const collegeUser = allCollegeUsers.find(u => Number(u.user_id) === Number(numericId));
    if (collegeUser) {
      const name = `${collegeUser.first_name} ${collegeUser.last_name}`;
      return name;
    }

    const user = users.find(u => Number(u.user_id) === Number(numericId));
    if (user) {
      const name = `${user.first_name} ${user.last_name}`;
      return name;
    }

    return "-";
  };

  const handleScheduleClick = async (exam: ExamDetail) => {
    if (!swapMode) return;

    if (!selectedSwap) {
      setSelectedSwap(exam);
    } else {
      if (
        selectedSwap.course_id === exam.course_id &&
        selectedSwap.exam_date === exam.exam_date &&
        selectedSwap.exam_start_time === exam.exam_start_time &&
        selectedSwap.exam_end_time === exam.exam_end_time
      ) {
        const swapElements = document.querySelectorAll(`[data-exam-id="${selectedSwap.examdetails_id}"], [data-exam-id="${exam.examdetails_id}"]`);
        swapElements.forEach(el => el.classList.add('swapping-animation'));

        const updatedA = { ...selectedSwap, room_id: exam.room_id };
        const updatedB = { ...exam, room_id: selectedSwap.room_id };

        setExamData(prev =>
          prev.map(e =>
            e.examdetails_id === updatedA.examdetails_id ? updatedA :
              e.examdetails_id === updatedB.examdetails_id ? updatedB : e
          )
        );

        try {
          await api.put(`/tbl_examdetails/${updatedA.examdetails_id}/`, {
            room_id: updatedA.room_id
          });

          await api.put(`/tbl_examdetails/${updatedB.examdetails_id}/`, {
            room_id: updatedB.room_id
          });

          toast.success("Schedules swapped successfully!", { autoClose: 2000 });

          setTimeout(() => {
            swapElements.forEach(el => el.classList.remove('swapping-animation'));
          }, 600);
        } catch (error) {
          toast.error("Failed to swap schedules!");
          swapElements.forEach(el => el.classList.remove('swapping-animation'));
        }
      } else {
        toast.warn("Schedules must have the same course and timeslot!");
      }
      setSelectedSwap(null);
    }
  };

  const filteredExamData = selectedFilter === "all"
    ? examData
    : examData.filter(exam => {
      const filterKey = `${exam.semester} | ${exam.academic_year} | ${exam.exam_date}`;
      return filterKey === selectedFilter;
    });

  const examMatchesSearch = (exam: ExamDetail, searchLower: string): boolean => {
    const sectionMatch =
      (exam.sections && exam.sections.some(s => s.toLowerCase().includes(searchLower))) ||
      (exam.section_name?.toLowerCase().includes(searchLower) ?? false);

    const instructorMatch =
      (exam.instructors && exam.instructors.some(id => getUserName(id).toLowerCase().includes(searchLower))) ||
      getUserName(exam.instructor_id).toLowerCase().includes(searchLower);

    const proctorMatch =
      (exam.proctors && exam.proctors.some(id => getUserName(id).toLowerCase().includes(searchLower))) ||
      getUserName(exam.proctor_id).toLowerCase().includes(searchLower);

    let timeMatch = false;
    if (exam.exam_start_time && exam.exam_end_time) {
      const start24 = exam.exam_start_time.slice(11, 16);
      const end24 = exam.exam_end_time.slice(11, 16);

      const formatTo12Hour = (time24: string) => {
        const [hourStr, minute] = time24.split(":");
        let hour = Number(hourStr);
        const ampm = hour >= 12 ? "PM" : "AM";
        hour = hour % 12 || 12;
        return `${hour}:${minute} ${ampm}`;
      };

      const start12 = formatTo12Hour(start24);
      const end12 = formatTo12Hour(end24);

      timeMatch =
        start24.includes(searchTerm) ||
        end24.includes(searchTerm) ||
        start12.toLowerCase().includes(searchLower) ||
        end12.toLowerCase().includes(searchLower) ||
        `${start12} - ${end12}`.toLowerCase().includes(searchLower) ||
        (searchLower.includes('am') && (start12.toLowerCase().includes('am') || end12.toLowerCase().includes('am'))) ||
        (searchLower.includes('pm') && (start12.toLowerCase().includes('pm') || end12.toLowerCase().includes('pm')));
    }

    const dateMatch = exam.exam_date?.toLowerCase().includes(searchLower) ?? false;

    const headerFieldsMatch =
      (exam.semester?.toLowerCase().includes(searchLower) ?? false) ||
      (exam.academic_year?.toLowerCase().includes(searchLower) ?? false) ||
      (exam.exam_period?.toLowerCase().includes(searchLower) ?? false) ||
      (exam.exam_category?.toLowerCase().includes(searchLower) ?? false) ||
      (exam.building_name?.toLowerCase().includes(searchLower) ?? false) ||
      (exam.college_name?.toLowerCase().includes(searchLower) ?? false);

    return (
      (exam.course_id?.toLowerCase().includes(searchLower) ?? false) ||
      sectionMatch ||
      (exam.room_id?.toLowerCase().includes(searchLower) ?? false) ||
      instructorMatch ||
      proctorMatch ||
      dateMatch ||
      timeMatch ||
      headerFieldsMatch
    );
  };

  const searchFilteredData = filteredExamData;

  const handleNextMatch = () => {
    if (searchMatches.length === 0) return;
    const nextIndex = (currentMatchIndex + 1) % searchMatches.length;
    setCurrentMatchIndex(nextIndex);

    const currentMatch = searchMatches[nextIndex];
    if (currentMatch?.examdetails_id) {
      const examElement = document.querySelector(`[data-exam-id="${currentMatch.examdetails_id}"]`);
      if (examElement) {
        examElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  };

  const handlePreviousMatch = () => {
    if (searchMatches.length === 0) return;
    const prevIndex = (currentMatchIndex - 1 + searchMatches.length) % searchMatches.length;
    setCurrentMatchIndex(prevIndex);

    const currentMatch = searchMatches[prevIndex];
    if (currentMatch?.examdetails_id) {
      const examElement = document.querySelector(`[data-exam-id="${currentMatch.examdetails_id}"]`);
      if (examElement) {
        examElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  };

  useEffect(() => {
    if (searchTerm.trim() === "") {
      setSearchMatches([]);
      setCurrentMatchIndex(-1);
      return;
    }
    const searchLower = searchTerm.toLowerCase();
    const matches = filteredExamData.filter(exam => examMatchesSearch(exam, searchLower));
    setSearchMatches(matches);
    if (matches.length > 0) {
      setCurrentMatchIndex(0);
      // auto-scroll to first match immediately
      setTimeout(() => {
        const first = matches[0];
        if (first?.examdetails_id) {
          const el = document.querySelector(`[data-exam-id="${first.examdetails_id}"]`);
          el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 80);
    } else {
      setCurrentMatchIndex(-1);
    }
  }, [searchTerm, filteredExamData, users, allCollegeUsers]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === 'Enter' && !e.shiftKey && document.activeElement === searchInputRef.current) {
        e.preventDefault();
        if (searchMatches.length > 0) {
          const nextIndex = (currentMatchIndex + 1) % searchMatches.length;
          setCurrentMatchIndex(nextIndex);
          const currentMatch = searchMatches[nextIndex];
          if (currentMatch?.examdetails_id) {
            const examElement = document.querySelector(`[data-exam-id="${currentMatch.examdetails_id}"]`);
            if (examElement) {
              examElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
          }
        }
      }
      if (e.key === 'Enter' && e.shiftKey && document.activeElement === searchInputRef.current) {
        e.preventDefault();
        if (searchMatches.length > 0) {
          const prevIndex = (currentMatchIndex - 1 + searchMatches.length) % searchMatches.length;
          setCurrentMatchIndex(prevIndex);
          const currentMatch = searchMatches[prevIndex];
          if (currentMatch?.examdetails_id) {
            const examElement = document.querySelector(`[data-exam-id="${currentMatch.examdetails_id}"]`);
            if (examElement) {
              examElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
          }
        }
      }
      if (e.key === 'Escape' && document.activeElement === searchInputRef.current) {
        setSearchTerm("");
        setCurrentMatchIndex(-1);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [searchMatches, currentMatchIndex]);

  const getFilterOptions = () => {
    const uniqueOptions = new Set<string>();
    examData.forEach(exam => {
      if (exam.semester && exam.academic_year && exam.exam_date) {
        uniqueOptions.add(`${exam.semester} | ${exam.academic_year} | ${exam.exam_date}`);
      }
    });
    return Array.from(uniqueOptions).sort();
  };

  const uniqueDates = Array.from(new Set(searchFilteredData.map((e) => e.exam_date))).filter(Boolean).sort();

  useEffect(() => {
    if (searchFilteredData.length > 0) {
      const invalidSchedules = searchFilteredData.filter(e =>
        !e.room_id || !e.exam_start_time || !e.exam_end_time || !e.exam_date
      );

      if (invalidSchedules.length > 0) {
      }
    }
  }, [searchFilteredData, uniqueDates]);

  const rawTimes = [
    "07:00", "07:30", "08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
    "12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30",
    "17:00", "17:30", "18:00", "18:30", "19:00", "19:30", "20:00", "20:30", "21:00"
  ];

  const formatTo12Hour = (time: string): string => {
    const [hourStr, minuteStr] = time.split(":");
    const hour = Number(hourStr);
    const minute = minuteStr;

    if (hour === 0) return `12:${minute}AM`;
    if (hour === 12) return `12:${minute}NN`;   // ✅ noon = NN
    if (hour > 12) return `${hour - 12}:${minute}PM`;
    return `${hour}:${minute}AM`;
  };

  // ✅ Consistent time slot labels — always "X:XXAM - X:XXAM" format
  const timeSlots = rawTimes.slice(0, -1).map((t, i) => {
    const start = formatTo12Hour(t);
    const end = formatTo12Hour(rawTimes[i + 1]);
    return {
      start24: t,
      end24: rawTimes[i + 1],
      label: `${start} - ${end}`,
    };
  });

  const generateCourseColors = (exams: ExamDetail[]) => {
    const yearColors = {
      1: [
        '#DC2626', '#D97706', '#059669', '#0891B2', '#2563EB',
        '#7C3AED', '#DB2777', '#EA580C', '#0D9488', '#65A30D'],
      2: [
        '#991B1B', '#92400E', '#065F46', '#0E7490', '#1E40AF',
        '#5B21B6', '#9D174D', '#C2410C', '#115E59', '#3F6212'],
      3: [
        '#7F1D1D', '#78350F', '#064E3B', '#155E75', '#1E3A8A',
        '#4C1D95', '#831843', '#9A3412', '#134E4A', '#365314'],
      4: [
        '#450A0A', '#451A03', '#022C22', '#083344', '#172554',
        '#2E1065', '#500724', '#7C2D12', '#042F2E', '#1A2E05']
    };

    const courseColorMap: Record<string, string> = {};
    const programYearMap: Record<string, number> = {};

    exams.forEach((exam) => {
      if (!exam.course_id) return;

      if (courseColorMap[exam.course_id]) return;

      let yearLevel: number | null = null;
      let program = '';

      if (exam.sections && exam.sections.length > 0) {
        for (const section of exam.sections) {
          const sectionStr = String(section).trim();

          let match = sectionStr.match(/^([A-Za-z]+)(\d)([A-Za-z]*)$/);

          if (!match) {
            match = sectionStr.match(/^([A-Za-z]+)\s+(\d)([A-Za-z]*)$/);
          }
          if (!match) {
            match = sectionStr.match(/^([A-Za-z]+)-(\d)([A-Za-z]*)$/);
          }

          if (!match) {
            const digitMatch = sectionStr.match(/(\d)/);
            const letterMatch = sectionStr.match(/^([A-Za-z]+)/);
            if (digitMatch && letterMatch) {
              program = letterMatch[1];
              yearLevel = parseInt(digitMatch[1]);
              break;
            }
          }

          if (match) {
            program = match[1];
            yearLevel = parseInt(match[2]);
            break;
          }
        }
      }

      if (!yearLevel && exam.section_name) {
        const sectionStr = String(exam.section_name).trim();

        let match = sectionStr.match(/^([A-Za-z]+)(\d)([A-Za-z]*)$/);
        if (!match) match = sectionStr.match(/^([A-Za-z]+)\s+(\d)([A-Za-z]*)$/);
        if (!match) match = sectionStr.match(/^([A-Za-z]+)-(\d)([A-Za-z]*)$/);

        if (!match) {
          const digitMatch = sectionStr.match(/(\d)/);
          const letterMatch = sectionStr.match(/^([A-Za-z]+)/);
          if (digitMatch && letterMatch) {
            program = letterMatch[1];
            yearLevel = parseInt(digitMatch[1]);
          }
        } else {
          program = match[1];
          yearLevel = parseInt(match[2]);
        }
      }

      // Assign color based on year level
      if (yearLevel && yearLevel >= 1 && yearLevel <= 4) {
        const programYearKey = `${program}-${yearLevel}`;

        const availableColors = yearColors[yearLevel as keyof typeof yearColors];
        if (!programYearMap[programYearKey]) {
          programYearMap[programYearKey] = 0;
        }

        const colorIndex = programYearMap[programYearKey] % availableColors.length;
        courseColorMap[exam.course_id] = availableColors[colorIndex];
        programYearMap[programYearKey]++;
      } else {
        courseColorMap[exam.course_id] = '#9CA3AF';
      }
    });

    return courseColorMap;
  };

  const courseColorMapRef = useRef<Record<string, string>>({});

  useEffect(() => {
    const currentCourses = new Set(examData.map(e => e.course_id).filter(Boolean));
    const existingCourses = new Set(Object.keys(courseColorMapRef.current));

    const newCourses = Array.from(currentCourses).filter(c => !existingCourses.has(c));

    if (newCourses.length > 0) {
      const newExams = examData.filter(e => e.course_id && newCourses.includes(e.course_id));
      const newColors = generateCourseColors(newExams);

      courseColorMapRef.current = {
        ...courseColorMapRef.current,
        ...newColors
      };
    }
  }, [examData.length]);

  const courseColorMap = courseColorMapRef.current;

  const hasData = searchFilteredData.length > 0;

  const handleDeleteAllSchedules = () => {
    if (!schedulerCollegeName || schedulerCollegeName === "Add schedule first") {
      toast.warn("No college detected. Cannot delete schedules.");
      return;
    }
    setDeleteModal({ step: 'confirm1', loading: false });
  };
  
  const handleDeleteConfirm1 = () => {
    setDeleteModal({ step: 'confirm2', loading: false });
  };
  
  const handleDeleteConfirm2 = async () => {
    setDeleteModal({ step: 'confirm2', loading: true });
  
    // small delay so user sees the button spinner
    await new Promise(resolve => setTimeout(resolve, 400));
    setDeleteModal(null);
  
    try {
      const examsToDelete = examData.filter(e => e.college_name === schedulerCollegeName);
  
      if (examsToDelete.length === 0) {
        toast.warn(`No schedules found for ${schedulerCollegeName}`);
        return;
      }
  
      setDeleteProgress({ isDeleting: true, progress: 0, message: 'Preparing to delete schedules...' });
      await new Promise(resolve => setTimeout(resolve, 500));
  
      setDeleteProgress({ isDeleting: true, progress: 25, message: `Deleting ${examsToDelete.length} schedule(s)...` });
  
      const response = await api.post('/tbl_examdetails/batch-delete/', {
        college_name: schedulerCollegeName
      });
  
      setDeleteProgress({ isDeleting: true, progress: 60, message: 'Removing approval records...' });
  
      try {
        const approvalResponse = await api.get('/tbl_scheduleapproval/', {
          params: { college_name: schedulerCollegeName }
        });
        if (approvalResponse.data?.length > 0) {
          const deletePromises = approvalResponse.data.map((approval: any) =>
            api.delete(`/tbl_scheduleapproval/${approval.request_id || approval.id}/`)
          );
          await Promise.all(deletePromises);
        }
      } catch (_) {}
  
      setDeleteProgress({ isDeleting: true, progress: 85, message: 'Cleaning up data...' });
      await new Promise(resolve => setTimeout(resolve, 300));
  
      setApprovalStatus(null);
      setRemarks(null);
      setExamData([]);
      saveUnscheduledSections([]);
  
      setDeleteProgress({ isDeleting: true, progress: 100, message: 'Delete complete!' });
      await new Promise(resolve => setTimeout(resolve, 600));
      setDeleteProgress(null);
  
      toast.success(`Successfully deleted ${response.data.deleted_count} schedules for ${schedulerCollegeName}!`);
    } catch (error: any) {
      setDeleteProgress(null);
      toast.error(`Failed to delete schedules: ${error?.response?.data?.error || error?.message || 'Unknown error'}`);
    }
  };

  const getAvailableProctorsForExam = (
    exam: ExamDetail,
    examData: ExamDetail[],
    allCollegeUsers: { user_id: number; first_name: string; last_name: string }[],
    users: { user_id: number; first_name: string; last_name: string }[]
  ) => {
    const availableUserPool = allCollegeUsers.length > 0 ? allCollegeUsers : users;

    const availableUsers = availableUserPool.filter((p) => {
      const assignedExamsSameDay = examData.filter((ex) => {
        if (ex.examdetails_id === exam.examdetails_id) return false;

        const isAssigned =
          ex.proctor_id === p.user_id ||
          (ex.proctors && ex.proctors.includes(p.user_id));

        // ✅ Check SAME DATE regardless of room — a proctor can't be in two rooms at once
        return isAssigned && ex.exam_date === exam.exam_date;
      });

      return !assignedExamsSameDay.some((ex) => {
        if (
          !exam.exam_start_time || !exam.exam_end_time ||
          !ex.exam_start_time || !ex.exam_end_time
        ) return false;

        const startA = timeToMinutesFromISO(exam.exam_start_time);
        const endA = timeToMinutesFromISO(exam.exam_end_time);
        const startB = timeToMinutesFromISO(ex.exam_start_time);
        const endB = timeToMinutesFromISO(ex.exam_end_time);

        // ✅ True overlap check — any overlap means conflict
        return startA < endB && endA > startB;
      });
    });

    return availableUsers.map((p) => ({
      value: p.user_id,
      label: `${p.first_name} ${p.last_name}`,
    }));
  };

  // ✅ Add this helper near the top of SchedulerView (outside the component or inside):
  const timeToMinutesFromISO = (isoTime: string): number => {
    const timePart = isoTime.slice(11, 16); // "HH:MM"
    const [h, m] = timePart.split(':').map(Number);
    return h * 60 + m;
  };

  /**
   * ════════════════════════════════════════════════════════════════
   * PATCH: Replace the `dynamicIcons` array in S_ExamViewer.tsx
   * ════════════════════════════════════════════════════════════════
   *
   * Find: `const dynamicIcons = [`
   * Replace the whole array with the one below.
   *
   * Key changes:
   *  - "Add Schedule" → opens activePanel="Add Schedule" (no Modal)
   *  - "Export"       → opens activePanel="Export"       (no Modal)
   *  - "Edit Manually"→ opens activePanel="Edit Manually"(no Modal)
   *  - All other icons are identical to before
   * ════════════════════════════════════════════════════════════════
   */

  const dynamicIcons = [
    {
      key: "Add Schedule",
      icon: <FaPlus style={{ fontSize: "20px", color: "gold" }} />,
      action: () => {
        if (approvalStatus === "pending") {
          toast.warn("Waiting for dean approval");
        } else if (approvalStatus === "approved") {
          toast.warn("Schedule already approved. Cannot modify.");
        } else {
          resetAllModes();
          setActivePanel("Add Schedule");
        }
      },
    },
    {
      key: "Change Proctor",
      icon: <FaUserEdit style={{ fontSize: "18px" }} />,
      action: () => {
        if (approvalStatus === "pending") {
          toast.warn("Waiting for dean approval");
        } else if (approvalStatus === "approved") {
          toast.warn("Schedule already approved. Cannot modify.");
        } else {
          const newMode = activeProctorEdit === -1 ? null : -1;
          resetAllModes();
          setActiveProctorEdit(newMode);
          setShowProctorInstructions(newMode === -1);
        }
      },
    },
    {
      key: "Swap Room",
      icon: <MdSwapHoriz style={{ fontSize: "22px" }} />,
      action: () => {
        if (approvalStatus === "pending") {
          toast.warn("Waiting for dean approval");
        } else if (approvalStatus === "approved") {
          toast.warn("Schedule already approved. Cannot modify.");
        } else {
          const newSwapMode = !swapMode;
          resetAllModes();
          setSwapMode(newSwapMode);
          setSelectedSwap(null);
          setDraggedExamId(null);
          setDraggedOverExamId(null);
          setIsDragDropMode(false);
          setShowSwapInstructions(newSwapMode);
        }
      },
    },
    {
      key: "Send Messages",
      icon: <FaEnvelope style={{ fontSize: "17px" }} />,
      action: () => {
        resetAllModes();
        setShowEnvelopeDropdown(true);
      },
      ref: envelopeRef,
    },
    {
      key: "Export",
      icon: <FaFileDownload style={{ fontSize: "17px" }} />,
      action: () => {
        resetAllModes();
        setActivePanel("Export");
      },
      ref: exportRef,
    },
    {
      key: "Delete All",
      icon: <FaTrash style={{ fontSize: "16px" }} />,
      action: handleDeleteAllSchedules,
    },
    {
      key: "Edit Manually",
      icon: (
        <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          <FaEdit style={{ fontSize: "18px" }} />
          {showUnscheduledBadge && (
            <span style={{
              position: 'absolute', top: '-5px', right: '-6px',
              backgroundColor: '#dc3545', color: 'white',
              borderRadius: '50%', minWidth: '16px', height: '16px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '10px', fontWeight: 'bold', padding: '1px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.3)', zIndex: 1
            }}>
              {persistentUnscheduled.length > 99 ? '99+' : persistentUnscheduled.length}
            </span>
          )}
        </div>
      ),
      action: () => {
        if (approvalStatus === "pending") {
          toast.warn("Waiting for dean approval");
        } else if (approvalStatus === "approved") {
          toast.warn("Schedule already approved. Cannot modify.");
        } else {
          resetAllModes();
          if (persistentUnscheduled.length > 0) {
            setManualEditorSections(persistentUnscheduled);
          }
          setActivePanel("Edit Manually");
        }
      },
    },
  ];

  let totalPages = 1;
  if (selectedFilter === "all" && hasData) {
    totalPages = uniqueDates.reduce((total, date) => {
      const dateExams = searchFilteredData.filter(e => e.exam_date === date);
      const dateRooms = Array.from(new Set(dateExams.map(e => e.room_id).filter(Boolean)));
      return total + Math.max(1, Math.ceil(dateRooms.length / maxRoomColumns));
    }, 0);
  } else if (hasData) {
    const rooms = Array.from(new Set(searchFilteredData.map(e => e.room_id).filter(Boolean)));
    totalPages = Math.max(1, Math.ceil(rooms.length / maxRoomColumns));
  }

  if (isLoadingData) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontSize: '24px',
        color: '#092C4C'
      }}>
        Please wait...
      </div>
    );
  }

  return (
    <div style={{ position: "relative", width: "100%", overflow: "visible" }}>

      {/* ══════════════════════════════════════════
          TOP NAV BAR
      ══════════════════════════════════════════ */}
      <div className="scheduler-top-card">
        {/* ── Action icons ── */}
        {dynamicIcons.map(({ key, icon, action, ref: iconRef }) => {
          const isActive =
            (swapMode && key === "Swap Room") ||
            (activeProctorEdit !== null && key === "Change Proctor") ||
            (showEnvelopeDropdown && key === "Send Messages") ||
            (activePanel === key);
      
          return (
            <div
              key={key}
              ref={key === "Send Messages" ? iconRef : undefined}
              className={`scheduler-icon ${isActive ? "active" : ""} ${showIconLabels ? "label-mode" : ""}`}
              onClick={() => { if (action) action(); }}
            >
              <span className="nav-icon-inner" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {icon}
              </span>
              {showIconLabels && <span className="nav-label">{key}</span>}
              {!showIconLabels && <span className="tooltip-text">{key}</span>}
      
              {key === "Send Messages" && showEnvelopeDropdown && (
                <div className="envelope-dropdown" onClick={e => e.stopPropagation()}>
                  <button type="button" className="dropdown-item"
                    onClick={(e) => { e.stopPropagation(); setShowDeanModal(true); setShowEnvelopeDropdown(false); }}>
                    Send to Dean
                  </button>
                  <button type="button" className="dropdown-item"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (approvalStatus !== "approved") {
                        toast.warn("You can only send email once the schedule is approved.");
                        return;
                      }
                      setShowEmailModal(true);
                      setShowEnvelopeDropdown(false);
                    }}>
                    Send Email
                  </button>
                </div>
              )}
            </div>
          );
        })}
      
        <div className="nav-divider" />
      
        {/* ── Custom filter dropdown ── */}
        <div className={`nav-filter-wrap ${filterMenuOpen ? "open" : ""}`} ref={filterRef}>
          <button
            type="button"
            className={`nav-filter-btn ${filterMenuOpen ? "open" : ""}`}
            onClick={() => setFilterMenuOpen(v => !v)}
          >
            {selectedFilter === "all"
              ? "All Dates"
              : (() => {
                  const parts = selectedFilter.split("|");
                  // show just the date part (last segment after trimming)
                  return parts[parts.length - 1]?.trim() || selectedFilter;
                })()
            }
            {/* chevron SVG */}
            <svg className="chevron" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
      
          <div className="nav-filter-menu">
            {/* All Dates option */}
            <div
              className={`nav-filter-option ${selectedFilter === "all" ? "selected" : ""}`}
              onClick={() => { setSelectedFilter("all"); setPage(0); setFilterMenuOpen(false); }}
            >
              <span className="opt-dot" />
              All Dates
            </div>
      
            {getFilterOptions().length > 0 && <div className="nav-filter-divider" />}
      
            {getFilterOptions().map((option, idx) => {
              const parts = option.split("|").map(s => s.trim());
              // Display: "Semester | AY · Date"
              const label = parts.length >= 3
                ? `${parts[0]} · ${parts[2]}`
                : option;
              return (
                <div
                  key={idx}
                  className={`nav-filter-option ${selectedFilter === option ? "selected" : ""}`}
                  onClick={() => { setSelectedFilter(option); setPage(0); setFilterMenuOpen(false); }}
                >
                  <span className="opt-dot" />
                  {label}
                </div>
              );
            })}
          </div>
        </div>
      
        <div className="nav-divider" />
      
        {/* ── Search ── */}
        <div className="nav-search-wrap">
          {/* small search icon */}
          <svg className="nav-search-icon" viewBox="0 0 16 16" fill="currentColor" style={{ width: 13, height: 13, flexShrink: 0, color: 'rgba(255,255,255,0.4)', marginRight: 2 }}>
            <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.099zm-5.242 1.156a5.5 5.5 0 1 1 0-11 5.5 5.5 0 0 1 0 11z"/>
          </svg>
          <input
            ref={searchInputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setPage(0); }}
            placeholder="Search…  Ctrl+F"
          />
          {searchTerm && searchMatches.length > 0 && (
            <span className="nav-search-count">{currentMatchIndex + 1}/{searchMatches.length}</span>
          )}
          {searchTerm && searchMatches.length > 0 && (
            <>
              <button type="button" className="nav-search-btn" onClick={handlePreviousMatch} title="Previous (Shift+Enter)">
                <FaChevronLeft />
              </button>
              <button type="button" className="nav-search-btn" onClick={handleNextMatch} title="Next (Enter)">
                <FaChevronRight />
              </button>
            </>
          )}
          {searchTerm && (
            <button type="button" className="nav-search-btn"
              onClick={() => { setSearchTerm(""); setPage(0); setCurrentMatchIndex(-1); }}
              title="Clear (Esc)"
            >
              ✕
            </button>
          )}
        </div>
      
      </div>

      {/* ══════════════════════════════════════════
          DROPDOWN PANELS
      ══════════════════════════════════════════ */}

      {/* ── "Add Schedule" panel ── */}
      <div className={`nav-dropdown-overlay ${activePanel === "Add Schedule" ? "open" : ""}`}>
        <div className="nav-dropdown-backdrop" onClick={() => setActivePanel(null)} />
        <div className="nav-dropdown-panel">
          <div className="nav-panel-header">
            <span className="nav-panel-title">
              <FaPlus style={{ color: 'gold' }} /> Plot Exam Schedule
            </span>
            <button type="button" className="nav-panel-close" onClick={() => setActivePanel(null)}>✕</button>
          </div>
          <div className="nav-panel-body">
            <AddScheduleForm
              user={user}
              onScheduleCreated={async (unscheduled?: any[]) => {
                try {
                  const params: any = {};
                  if (schedulerCollegeName && schedulerCollegeName !== "Add schedule first") {
                    params.college_name = schedulerCollegeName;
                  }
                  const examsResponse = await api.get('/tbl_examdetails', { params });
                  if (examsResponse.data) setExamData(examsResponse.data);
                } catch (_) { }

                setActivePanel(null);

                if (unscheduled && unscheduled.length > 0) {
                  saveUnscheduledSections(unscheduled);
                  const result = window.confirm(
                    `Schedule generation complete!\n\n${unscheduled.length} section(s) need manual scheduling.\n\n⚠️ Click 'OK' to save and view later`
                  );
                  if (result) {
                    setManualEditorSections(unscheduled);
                    setShowManualEditor(true);
                  } else {
                    toast.info(`${unscheduled.length} section(s) saved. Click "Edit Manually" later.`, { autoClose: 8000 });
                  }
                } else {
                  saveUnscheduledSections([]);
                }
              }}
            />
          </div>
        </div>
      </div>

      {/* ── "Export" panel ── */}
      <div className={`nav-dropdown-overlay ${activePanel === "Export" ? "open" : ""}`}>
        <div className="nav-dropdown-backdrop" onClick={() => setActivePanel(null)} />
        <div className="nav-dropdown-panel">
          <div className="nav-panel-header">
            <span className="nav-panel-title">
              <FaFileDownload /> Export Schedule
            </span>
            <button type="button" className="nav-panel-close" onClick={() => setActivePanel(null)}>✕</button>
          </div>
          <div className="nav-panel-body">
            <ExportSchedule onClose={() => setActivePanel(null)} collegeName={collegeName} />
          </div>
        </div>
      </div>

      {/* ── "Edit Manually" panel ── */}
      <div className={`nav-dropdown-overlay ${activePanel === "Edit Manually" || showManualEditor ? "open" : ""}`}>
        <div className="nav-dropdown-backdrop" onClick={() => { setActivePanel(null); setShowManualEditor(false); }} />
        <div className="nav-dropdown-panel" style={{ width: 'min(96vw, 1000px)' }}>
          <div className="nav-panel-header">
            <span className="nav-panel-title">
              <FaEdit /> Manual Schedule Editor
            </span>
            <button type="button" className="nav-panel-close" onClick={() => { setActivePanel(null); setShowManualEditor(false); setManualEditorSections([]); }}>✕</button>
          </div>
          <div className="nav-panel-body" style={{ padding: 0 }}>
            <ManualScheduleEditor
              unscheduledSections={manualEditorSections.length > 0 ? manualEditorSections : persistentUnscheduled}
              examDates={uniqueDates.filter((date): date is string => date !== undefined)}
              schedulerCollegeName={schedulerCollegeName}
              onClose={() => { setActivePanel(null); setShowManualEditor(false); setManualEditorSections([]); }}
              onScheduleCreated={async (remainingUnscheduled?: any[]) => {
                try {
                  const params: any = {};
                  if (schedulerCollegeName && schedulerCollegeName !== "Add schedule first") {
                    params.college_name = schedulerCollegeName;
                  }
                  const examsResponse = await api.get('/tbl_examdetails', { params });
                  if (examsResponse.data) setExamData(examsResponse.data);
                } catch (_) { }

                if (remainingUnscheduled && remainingUnscheduled.length > 0) {
                  saveUnscheduledSections(remainingUnscheduled);
                  toast.info(`${remainingUnscheduled.length} section(s) still need scheduling.`, { autoClose: 5000 });
                } else {
                  saveUnscheduledSections([]);
                  toast.success("All sections scheduled successfully!");
                }

                setActivePanel(null);
                setShowManualEditor(false);
                setManualEditorSections([]);
              }}
              academicYear={yearName}
              semester={semesterName}
              examCategory={termName}
              examPeriod={examPeriodName}
              duration={{ hours: 1, minutes: 30 }}
            />
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════
          STATUS / MODE BANNERS
      ══════════════════════════════════════════ */}
      {approvalStatus && (
        <div className={`status-banner ${approvalStatus}`}>
          <span>
            Status: {approvalStatus.toUpperCase()}
            {approvalStatus === "pending" && " — Waiting for Dean"}
            {approvalStatus === "rejected" && " — You can modify and resubmit"}
          </span>
          {approvalStatus === "rejected" && remarks && (
            <span className="remarks"><strong>Remarks:</strong> {remarks}</span>
          )}
        </div>
      )}

      {swapMode && <div className="mode-banner">Swapping Mode — drag cards or click to swap rooms</div>}
      {activeProctorEdit === -1 && <div className="mode-banner">Proctor Edit Mode — click any Proctor field</div>}

      {showSwapInstructions && (
        <div className="instruction-card" style={{ top: swapMode ? 'calc(var(--nav-top) + var(--nav-height) + 58px)' : undefined }}>
          <h4>Swapping Instructions</h4>
          <p>
            <strong>Option 1 — Swap rooms:</strong><br />
            Click a schedule to select it, then click another with the same course &amp; timeslot.<br /><br />
            <strong>Option 2 — Drag &amp; drop:</strong><br />
            Drag any schedule card to an empty cell to move it there.
          </p>
          <button type="button" className="instruction-close" onClick={() => setShowSwapInstructions(false)}>
            Close
          </button>
        </div>
      )}

      {showProctorInstructions && (
        <div className="instruction-card">
          <h4>Proctor Edit Instructions</h4>
          <p>
            Click on any schedule's <strong>Proctor</strong> field to open the selector.<br />
            Search and select proctors, then click <strong>✕</strong> to confirm.
          </p>
          <button type="button" className="instruction-close" onClick={() => setShowProctorInstructions(false)}>
            Close
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={() => { resetAllModes(); setShowFooterSettings(true); }}
        style={{
          position: 'fixed', bottom: 28, right: 28,
          background: 'var(--surface, white)', color: 'var(--brand, #092C4C)',
          border: '1.5px solid var(--border, #d0d0d0)',
          borderRadius: '999px',
          padding: '10px 20px',
          fontSize: '13px', fontWeight: '600',
          cursor: 'pointer',
          boxShadow: 'var(--shadow-md, 0 4px 12px rgba(0,0,0,0.15))',
          zIndex: 1000,
          display: 'flex', alignItems: 'center', gap: 7,
          fontFamily: 'var(--font, inherit)',
          transition: 'all 0.2s ease',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = 'var(--brand, #092C4C)';
          e.currentTarget.style.color = '#fff';
          e.currentTarget.style.borderColor = 'var(--brand, #092C4C)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = 'var(--surface, white)';
          e.currentTarget.style.color = 'var(--brand, #092C4C)';
          e.currentTarget.style.borderColor = 'var(--border, #d0d0d0)';
        }}
      >
        <FaCog style={{ fontSize: 14 }} /> Settings
      </button>

      {hasData && page > 0 && (
        <button
          type="button"
          className="scheduler-nav-button scheduler-nav-button-left"
          onClick={() => setPage(page - 1)}
        >
          <FaChevronLeft style={{ fontSize: "3rem" }} />
        </button>
      )}

      {hasData && page < totalPages - 1 && (
        <button
          type="button"
          className="scheduler-nav-button scheduler-nav-button-right"
          onClick={() => setPage(page + 1)}
        >
          <FaChevronRight style={{ fontSize: "3rem" }} />
        </button>
      )}

      <div
        className="scheduler-view-card-wrapper"
        style={{
          display: "flex",
          transition: "transform 0.5s ease",
          transform: hasData ? `translateX(-${page * 100}%)` : "none",
        }}
      >
        {!hasData ? (
          <div
            className="scheduler-view-card"
            style={{
              minWidth: "100%",
              maxWidth: "1400px",
              boxShadow: "0 8px 20px rgba(0,0,0,0.3)",
              borderRadius: 12,
              background: "#f9f9f9",
              margin: "16px auto",
              padding: 15,
              transform: "scale(0.9)",
              transformOrigin: "top center",
              transition: "transform 0.3s ease"
            }}
          >
            <div className="scheduler-view-container">
              <div className="header" style={{ textAlign: "center", marginBottom: "20px" }}>
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', marginBottom: '5px' }}>
                  {(footerData?.logo_urls && footerData.logo_urls.length > 0
                    ? footerData.logo_urls
                    : footerData?.logo_url
                      ? [footerData.logo_url]
                      : ["/logo/USTPlogo.png"]
                  ).map((url, idx) => (
                    <img
                      key={idx}
                      src={url}
                      alt={`School Logo ${idx + 1}`}
                      style={{ width: '160px', height: '130px', objectFit: 'contain' }}
                    />
                  ))}
                </div>
                <div style={{ fontSize: '30px', color: '#333', marginBottom: '-10px', fontFamily: 'serif' }}>
                  University of Science and Technology of Southern Philippines
                </div>
                <div style={{ fontSize: '15px', color: '#555', marginBottom: '-10px', fontFamily: 'serif' }}>
                  Alubijid | Balubal | Cagayan de Oro City | Claveria | Jasaan | Oroquieta | Panaon | Villanueva
                </div>
                <div style={{ fontSize: '30px', color: '#333', marginBottom: '-10px', fontFamily: 'serif' }}>{collegeName}, USTP-CDO</div>
                <div style={{ fontSize: '20px', color: '#333', marginBottom: '-10px', fontFamily: 'serif', fontWeight: 'bold' }}>
                  {termName} Examination Schedule | {semesterName} Semester | A.Y. {yearName}
                </div>
                <div style={{ fontSize: '20px', color: '#333', marginTop: '-10px', fontFamily: 'serif' }}>{examPeriodName}</div>
              </div>
              <hr />
              {isScheduleLoading ? (
                // ── Loading skeleton ──────────────────────────────────────
                <div style={{
                  padding: '60px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '20px',
                }}>
                  {/* Spinner */}
                  <div style={{
                    width: '48px',
                    height: '48px',
                    border: '4px solid #e5e7eb',
                    borderTopColor: '#092C4C',
                    borderRadius: '50%',
                    animation: 'sv-spin 0.8s linear infinite',
                  }} />
              
                  {/* Shimmer rows */}
                  {[90, 75, 82, 68, 78].map((w, i) => (
                    <div
                      key={i}
                      style={{
                        width: `${w}%`,
                        height: '14px',
                        borderRadius: '6px',
                        background: 'linear-gradient(90deg, #e5e7eb 25%, #f3f4f6 50%, #e5e7eb 75%)',
                        backgroundSize: '200% 100%',
                        animation: `sv-shimmer 1.4s ease infinite`,
                        animationDelay: `${i * 0.1}s`,
                      }}
                    />
                  ))}
              
                  <p style={{
                    fontSize: '15px',
                    color: '#9ca3af',
                    fontFamily: 'serif',
                    marginTop: '8px',
                  }}>
                  </p>
              
                  {/* Keyframes injected inline */}
                  <style>{`
                    @keyframes sv-spin {
                      to { transform: rotate(360deg); }
                    }
                    @keyframes sv-shimmer {
                      0%   { background-position: 200% 0; }
                      100% { background-position: -200% 0; }
                    }
                  `}</style>
                </div>
              ) : (
                // ── Original empty-state text ────────────────────────────
                <div style={{
                  textAlign: 'center',
                  padding: '100px 20px',
                  fontSize: '24px',
                  color: '#999',
                  fontFamily: 'serif',
                }}>
                  {selectedFilter === 'all'
                    ? 'Add schedule first'
                    : 'No schedules found for selected filter'}
                </div>
              )}
            </div>
          </div>
        ) : selectedFilter === "all" ? (
          uniqueDates.flatMap((date) => {
            const dateExams = filteredExamData.filter(e => e.exam_date === date);
            const dateRooms = Array.from(
              new Set(dateExams.map(e => e.room_id).filter(Boolean))
            ).sort((a, b) => {
              const numA = Number(a);
              const numB = Number(b);
              if (!isNaN(numA) && !isNaN(numB)) {
                return numA - numB;
              }
              return String(a).localeCompare(String(b), undefined, { numeric: true });
            });

            const dateTotalPages = Math.max(1, Math.ceil(dateRooms.length / maxRoomColumns));

            return Array.from({ length: dateTotalPages }).map((_, p) => {
              const pageRooms = dateRooms.slice(p * maxRoomColumns, (p + 1) * maxRoomColumns);
              const occupiedCells: Record<string, boolean> = {};

              const groupedData: Record<string, ExamDetail[]> = {};
              dateExams.forEach((exam) => {
                if (!exam.room_id) {
                  return;
                }
                const key = `${date}-${exam.room_id}`;
                if (!groupedData[key]) groupedData[key] = [];
                groupedData[key].push(exam);
              });

              return (
                <div
                  key={`${date}-${p}`}
                  className="scheduler-view-card"
                  style={{
                    minWidth: "100%",
                    maxWidth: "1400px",
                    boxShadow: "0 8px 20px rgba(0,0,0,0.3)",
                    borderRadius: 12,
                    background: "#f9f9f9",
                    margin: "16px auto",
                    padding: 15,
                    transform: "scale(0.8)",
                    transformOrigin: "top center",
                    transition: "transform 0.3s ease"
                  }}
                >
                  <div className="scheduler-view-container">
                    <div className="header" style={{ textAlign: "center", marginBottom: "20px" }}>
                      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', marginBottom: '5px' }}>
                        {(footerData?.logo_urls && footerData.logo_urls.length > 0
                          ? footerData.logo_urls
                          : footerData?.logo_url
                            ? [footerData.logo_url]
                            : ["/logo/USTPlogo.png"]
                        ).map((url, idx) => (
                          <img
                            key={idx}
                            src={url}
                            alt={`School Logo ${idx + 1}`}
                            style={{ width: '160px', height: '130px', objectFit: 'contain' }}
                          />
                        ))}
                      </div>
                      <div style={{ fontSize: '30px', color: '#333', marginBottom: '-10px', fontFamily: 'serif' }}>
                        University of Science and Technology of Southern Philippines
                      </div>
                      <div style={{ fontSize: '15px', color: '#555', marginBottom: '-10px', fontFamily: 'serif' }}>
                        Alubijid | Balubal | Cagayan de Oro City | Claveria | Jasaan | Oroquieta | Panaon | Villanueva
                      </div>
                      <div style={{ fontSize: '30px', color: '#333', marginBottom: '-10px', fontFamily: 'serif' }}>{collegeName}, USTP-CDO</div>
                      <div style={{ fontSize: '20px', color: '#333', marginBottom: '-10px', fontFamily: 'serif', fontWeight: 'bold' }}>
                        {termName} Examination Schedule | {semesterName} Semester | A.Y. {yearName}
                      </div>
                      <div style={{ fontSize: '20px', color: '#333', marginTop: '-10px', fontFamily: 'serif' }}>{examPeriodName}</div>
                    </div>
                    <hr />
                    <table className="exam-table">
                      <thead>
                        <tr>
                          <th colSpan={pageRooms.length + 1}>{date && new Date(date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</th>
                        </tr>
                        <tr>
                          <th></th>
                          {(() => {
                            const buildingGroups: Record<string, string[]> = {};
                            pageRooms.forEach((room) => {
                              const building = filteredExamData.find(e => e.room_id === (room ?? ""))?.building_name || "Unknown Building";
                              if (!buildingGroups[building]) buildingGroups[building] = [];
                              buildingGroups[building].push(String(room));
                            });

                            return Object.entries(buildingGroups).map(([building, rooms]) => (
                              <th key={building} colSpan={rooms.length}>{building}</th>
                            ));
                          })()}
                        </tr>
                        <tr>
                          <th>Time</th>
                          {(() => {
                            const buildingGroups: Record<string, string[]> = {};
                            pageRooms.forEach((room) => {
                              const building = dateExams.find(e => e.room_id === (room ?? ""))?.building_name || "Unknown Building";
                              if (!buildingGroups[building]) buildingGroups[building] = [];
                              buildingGroups[building].push(String(room));
                            });

                            return Object.values(buildingGroups)
                              .flat()
                              .map((room, idx) => <th key={idx}>{room}</th>);
                          })()}
                        </tr>
                      </thead>
                      <tbody>
                        {timeSlots.map((slot, rowIndex) => (
                          <tr key={slot.start24}>
                            <td>{slot.label}</td>
                            {pageRooms.map((room) => {
                              const key = `${date}-${room}-${rowIndex}`;
                              if (occupiedCells[key]) return null;

                              const examsInRoom = groupedData[`${date}-${room}`] || [];

                              const exam = examsInRoom.find((e) => {
                                if (!e.exam_start_time || !e.exam_end_time) {
                                  return false;
                                }

                                // Extract time directly from ISO string (HH:MM format)
                                const examStartTimeStr = e.exam_start_time.slice(11, 16);
                                const examEndTimeStr = e.exam_end_time.slice(11, 16);

                                const [examStartHour, examStartMin] = examStartTimeStr.split(':').map(Number);
                                const [examEndHour, examEndMin] = examEndTimeStr.split(':').map(Number);

                                const examStart = examStartHour * 60 + examStartMin;
                                const examEnd = examEndHour * 60 + examEndMin;

                                const slotStart = Number(slot.start24.split(":")[0]) * 60 + Number(slot.start24.split(":")[1]);
                                const slotEnd = Number(slot.end24.split(":")[0]) * 60 + Number(slot.end24.split(":")[1]);

                                const matches = (examStart < slotEnd) && (examEnd > slotStart);

                                return matches;
                              });

                              if (!exam) return (
                                <td
                                  key={room}
                                  onDragOver={handleDragOver}
                                  onDragEnter={() => setHoveredCellId(key)}
                                  onDragLeave={() => setHoveredCellId(null)}
                                  onDrop={() => {
                                    const cellStartTime = `${date}T${slot.start24}:00`;
                                    const cellEndTime = `${date}T${slot.end24}:00`;
                                    handleDropToCell(date, String(room), cellStartTime, cellEndTime);
                                    setHoveredCellId(null);
                                  }}
                                  style={{
                                    backgroundColor: hoveredCellId === key && draggedExamId && swapMode ? '#e0f7fa' : '#f5f5f5',
                                    border: hoveredCellId === key && draggedExamId && swapMode ? '3px dashed #0288d1' : '1px solid #ddd',
                                    cursor: draggedExamId && swapMode ? 'pointer' : 'default',
                                    transition: 'all 0.2s ease',
                                    minHeight: '80px',
                                    padding: '8px',
                                    boxSizing: 'border-box'
                                  }}
                                ></td>
                              );

                              // Extract time directly from ISO string
                              const examStartTimeStr = exam.exam_start_time!.slice(11, 16);
                              const examEndTimeStr = exam.exam_end_time!.slice(11, 16);

                              const [examStartHour, examStartMin] = examStartTimeStr.split(':').map(Number);
                              const [examEndHour, examEndMin] = examEndTimeStr.split(':').map(Number);

                              const startMinutes = examStartHour * 60 + examStartMin;
                              const endMinutes = examEndHour * 60 + examEndMin;

                              const startSlotIndex = timeSlots.findIndex(slot => {
                                const slotStart = Number(slot.start24.split(":")[0]) * 60 + Number(slot.start24.split(":")[1]);
                                const slotEnd = Number(slot.end24.split(":")[0]) * 60 + Number(slot.end24.split(":")[1]);
                                return startMinutes >= slotStart && startMinutes < slotEnd;
                              });

                              const rowSpan = Math.ceil((endMinutes - startMinutes) / 30);

                              for (let i = 0; i < rowSpan; i++) {
                                if (startSlotIndex + i < timeSlots.length) {
                                  occupiedCells[`${date}-${room}-${startSlotIndex + i}`] = true;
                                }
                              }

                              return (
                                <td key={room} rowSpan={rowSpan}>
                                  <div
                                    data-exam-id={exam.examdetails_id}
                                    draggable={swapMode}
                                    onDragStart={() => handleDragStart(exam.examdetails_id!)}
                                    onDragOver={handleDragOver}
                                    onDragEnter={() => handleDragEnter(exam.examdetails_id!)}
                                    onDrop={() => handleDrop(exam.examdetails_id!)}
                                    onDragLeave={() => setDraggedOverExamId(null)}
                                    onClick={() => handleScheduleClick(exam)}
                                    className={
                                      searchTerm && examMatchesSearch(exam, searchTerm.toLowerCase())
                                        ? currentMatchIndex >= 0 && searchMatches[currentMatchIndex]?.examdetails_id === exam.examdetails_id
                                          ? "exam-card-match-active"
                                          : "exam-card-match"
                                        : draggedExamId === exam.examdetails_id
                                          ? "exam-card-dragging"
                                          : draggedOverExamId === exam.examdetails_id
                                            ? "exam-card-drop-target"
                                            : selectedSwap?.examdetails_id === exam.examdetails_id
                                              ? "exam-card-swap-selected"
                                              : ""
                                    }
                                    style={{
                                      backgroundColor: courseColorMap[exam.course_id || ""] || "#ccc",
                                      color: "white",
                                      padding: "6px 8px",
                                      borderRadius: "5px",
                                      fontSize: "11px",
                                      height: "100%",
                                      minHeight: "52px",
                                      boxSizing: "border-box",
                                      overflowY: "hidden",
                                      cursor: swapMode ? "grab" : "default",
                                      display: "flex",
                                      flexDirection: "column",
                                      justifyContent: "flex-start",
                                      gap: "2px",
                                      opacity: draggedExamId === exam.examdetails_id ? 0.55 : 1,
                                    }}
                                  >
                                    <p><strong>{exam.course_id}</strong></p>

                                    {/* ✅ UPDATED: Show all sections without tooltip limit */}
                                    <p style={{
                                      fontSize: exam.sections && exam.sections.length > 3 ? '10px' : '12px',
                                      lineHeight: '1.2'
                                    }}>
                                      {getSectionDisplay(exam)}
                                    </p>

                                    <p style={{
                                      fontSize: exam.instructors && exam.instructors.length > 2 ? '10px' : '12px',
                                      lineHeight: '1.2'
                                    }}>
                                      Instructor: {getInstructorDisplay(exam)}
                                    </p>

                                    <div
                                      style={{
                                        fontSize: exam.proctors && exam.proctors.length > 2 ? '10px' : '12px',
                                        lineHeight: '1.2',
                                        cursor: activeProctorEdit === -1 ? 'pointer' : 'default',
                                        padding: '4px',
                                        borderRadius: '4px',
                                        backgroundColor: activeProctorEdit === exam.examdetails_id ? 'rgba(255,255,255,0.2)' : 'transparent'
                                      }}
                                      onClick={(e) => {
                                        if (activeProctorEdit === -1) {
                                          e.stopPropagation();
                                          setActiveProctorEdit(exam.examdetails_id!);
                                        }
                                      }}
                                    >
                                      Proctor:
                                      {activeProctorEdit === exam.examdetails_id ? (
                                        <div style={{ position: 'relative' }}>
                                          <Select
                                            isMulti
                                            value={
                                              exam.proctors && exam.proctors.length > 0
                                                ? exam.proctors.map(pid => ({
                                                  value: pid,
                                                  label: getUserName(pid)
                                                })).filter(opt => opt.label !== '-')
                                                : exam.proctor_id
                                                  ? [{
                                                    value: exam.proctor_id,
                                                    label: getUserName(exam.proctor_id)
                                                  }]
                                                  : []
                                            }
                                            onChange={(selectedOptions) => {
                                              if (selectedOptions && selectedOptions.length > 0) {
                                                const proctorIds = selectedOptions.map(opt => opt.value);
                                                handleProctorChange(exam.examdetails_id!, proctorIds);
                                              } else {
                                                handleProctorChange(exam.examdetails_id!, []);
                                              }
                                            }}
                                            options={getAvailableProctorsForExam(exam, examData, allCollegeUsers, users)}
                                            placeholder="Select proctor(s)..."
                                            isSearchable
                                            closeMenuOnSelect={false}
                                            blurInputOnSelect={false}
                                            captureMenuScroll={false}
                                            menuShouldScrollIntoView={false}
                                            menuPortalTarget={document.body}
                                            styles={{
                                              menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                                              menu: (provided) => ({ ...provided, zIndex: 9999 }),
                                              control: (provided) => ({
                                                ...provided,
                                                fontSize: '10px',
                                                minHeight: '25px',
                                                maxHeight: '80px',
                                                overflowY: 'auto',
                                                color: '#092C4C',
                                              }),
                                              option: (provided, state) => ({
                                                ...provided,
                                                fontSize: '10px',
                                                color: state.isSelected ? 'white' : '#092C4C', // Dropdown option text color
                                                backgroundColor: state.isSelected
                                                  ? '#092C4C'
                                                  : state.isFocused
                                                    ? '#e5e7eb'
                                                    : 'white'
                                              }),
                                              valueContainer: (provided) => ({
                                                ...provided,
                                                padding: '2px 6px',
                                                maxHeight: '70px',
                                                overflowY: 'auto'
                                              }),
                                              multiValue: (provided) => ({
                                                ...provided,
                                                fontSize: '9px',
                                                margin: '1px',
                                              }),
                                              multiValueLabel: (provided) => ({
                                                ...provided,
                                                padding: '1px 3px',
                                                fontSize: '9px'
                                              })
                                            }}
                                          />
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setActiveProctorEdit(-1);
                                            }}
                                            style={{
                                              position: 'absolute',
                                              top: '2px',
                                              right: '2px',
                                              background: '#ef4444',
                                              color: 'white',
                                              border: 'none',
                                              borderRadius: '3px',
                                              padding: '2px 6px',
                                              fontSize: '10px',
                                              cursor: 'pointer',
                                              zIndex: 10000
                                            }}
                                          >
                                            ✕
                                          </button>
                                        </div>
                                      ) : (
                                        <span style={{ marginLeft: '5px', display: 'block', marginTop: '2px' }}>
                                          {getProctorDisplay(exam)}
                                        </span>
                                      )}
                                    </div>

                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {/* Footer Section */}
                    <div style={{
                      marginTop: '40px',
                      paddingTop: '20px',
                      borderTop: '2px solid #092C4C',
                      fontFamily: 'serif'
                    }}>
                      {/* Signature Section */}
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginBottom: '30px'
                      }}>
                        {/* Left - Prepared by */}
                        <div style={{ textAlign: 'left', width: '45%', color: 'black' }}>
                          <p style={{ margin: '5px 0', fontWeight: 'bold' }}>Prepared by:</p>
                          <p style={{ margin: '3px 0 5px 0', fontStyle: 'italic' }}>(sgd.)</p>
                          <p style={{ margin: '5px 0', fontWeight: 'bold' }}>
                            {footerData?.prepared_by_name || 'Type name'}
                          </p>
                          <p style={{ margin: '5px 0' }}>
                            {footerData?.prepared_by_title || `Dean, ${collegeName}`}
                          </p>
                        </div>

                        {/* Right - Approved by */}
                        <div style={{ textAlign: 'left', width: '15%', color: 'black' }}>
                          <p style={{ margin: '5px 0', fontWeight: 'bold' }}>Approved:</p>
                          <p style={{ margin: '3px 0 5px 0', fontStyle: 'italic' }}>(sgd.)</p>
                          <p style={{ margin: '5px 0', fontWeight: 'bold' }}>
                            {footerData?.approved_by_name || 'Type name'}
                          </p>
                          <p style={{ margin: '5px 0' }}>
                            {footerData?.approved_by_title || 'VCAA, USTP-CDO'}
                          </p>
                        </div>
                      </div>

                      {/* Center - Address */}
                      <div style={{ textAlign: 'center', fontSize: '15px', color: 'black' }}>
                        <p style={{ margin: '5px 0' }}>
                          {footerData?.address_line || 'C.M Recto Avenue, Lapasan, Cagayan de Oro City 9000 Philippines'}
                        </p>
                        <p style={{ margin: '5px 0' }}>
                          {footerData?.contact_line || 'Tel Nos. +63 (88) 856 1738; Telefax +63 (88) 856 4696 | http://www.ustp.edu.ph'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            });
          })
        ) : (
          uniqueDates.flatMap((date) => {
            const dateExams = filteredExamData.filter(e => e.exam_date === date);
            const dateRooms = Array.from(
              new Set(dateExams.map(e => e.room_id).filter(Boolean))
            ).sort((a, b) => {
              const numA = Number(a);
              const numB = Number(b);
              if (!isNaN(numA) && !isNaN(numB)) {
                return numA - numB;
              }
              return String(a).localeCompare(String(b), undefined, { numeric: true });
            });

            const dateTotalPages = Math.max(1, Math.ceil(dateRooms.length / maxRoomColumns));

            return Array.from({ length: dateTotalPages }).map((_, p) => {
              const pageRooms = dateRooms.slice(p * maxRoomColumns, (p + 1) * maxRoomColumns);
              const occupiedCells: Record<string, boolean> = {};

              const groupedData: Record<string, ExamDetail[]> = {};
              dateExams.forEach((exam) => {
                if (!exam.room_id) {
                  return;
                }
                const key = `${date}-${exam.room_id}`;
                if (!groupedData[key]) groupedData[key] = [];
                groupedData[key].push(exam);
              });

              return (
                <div
                  key={`${date}-${p}`}
                  className="scheduler-view-card"
                  style={{
                    minWidth: "100%",
                    maxWidth: "1400px",
                    boxShadow: "0 8px 20px rgba(0,0,0,0.3)",
                    borderRadius: 12,
                    background: "#f9f9f9",
                    margin: "16px auto",
                    padding: 15,
                    transform: "scale(0.8)",
                    transformOrigin: "top center",
                    transition: "transform 0.3s ease"
                  }}
                >
                  <div className="scheduler-view-container">
                    <div className="header" style={{ textAlign: "center", marginBottom: "20px" }}>
                      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', marginBottom: '5px' }}>
                        {(footerData?.logo_urls && footerData.logo_urls.length > 0
                          ? footerData.logo_urls
                          : footerData?.logo_url
                            ? [footerData.logo_url]
                            : ["/logo/USTPlogo.png"]
                        ).map((url, idx) => (
                          <img
                            key={idx}
                            src={url}
                            alt={`School Logo ${idx + 1}`}
                            style={{ width: '160px', height: '130px', objectFit: 'contain' }}
                          />
                        ))}
                      </div>
                      <div style={{ fontSize: '30px', color: '#333', marginBottom: '-10px', fontFamily: 'serif' }}>
                        University of Science and Technology of Southern Philippines
                      </div>
                      <div style={{ fontSize: '15px', color: '#555', marginBottom: '-10px', fontFamily: 'serif' }}>
                        Alubijid | Balubal | Cagayan de Oro City | Claveria | Jasaan | Oroquieta | Panaon | Villanueva
                      </div>
                      <div style={{ fontSize: '30px', color: '#333', marginBottom: '-10px', fontFamily: 'serif' }}>{collegeName}, USTP-CDO</div>
                      <div style={{ fontSize: '20px', color: '#333', marginBottom: '-10px', fontFamily: 'serif', fontWeight: 'bold' }}>
                        {termName} Examination Schedule | {semesterName} Semester | A.Y. {yearName}
                      </div>
                      <div style={{ fontSize: '20px', color: '#333', marginTop: '-10px', fontFamily: 'serif' }}>{examPeriodName}</div>
                    </div>
                    <hr />
                    <table className="exam-table">
                      <thead>
                        <tr>
                          <th colSpan={pageRooms.length + 1}>{date && new Date(date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</th>
                        </tr>
                        <tr>
                          <th></th>
                          {(() => {
                            const buildingGroups: Record<string, string[]> = {};
                            pageRooms.forEach((room) => {
                              const building = filteredExamData.find(e => e.room_id === (room ?? ""))?.building_name || "Unknown Building";
                              if (!buildingGroups[building]) buildingGroups[building] = [];
                              buildingGroups[building].push(String(room));
                            });

                            return Object.entries(buildingGroups).map(([building, rooms]) => (
                              <th key={building} colSpan={rooms.length}>{building}</th>
                            ));
                          })()}
                        </tr>
                        <tr>
                          <th>Time</th>
                          {(() => {
                            const buildingGroups: Record<string, string[]> = {};
                            pageRooms.forEach((room) => {
                              const building = dateExams.find(e => e.room_id === (room ?? ""))?.building_name || "Unknown Building";
                              if (!buildingGroups[building]) buildingGroups[building] = [];
                              buildingGroups[building].push(String(room));
                            });

                            return Object.values(buildingGroups)
                              .flat()
                              .map((room, idx) => <th key={idx}>{room}</th>);
                          })()}
                        </tr>
                      </thead>
                      <tbody>
                        {timeSlots.map((slot, rowIndex) => (
                          <tr key={slot.start24}>
                            <td>{slot.label}</td>
                            {pageRooms.map((room) => {
                              const key = `${date}-${room}-${rowIndex}`;
                              if (occupiedCells[key]) return null;

                              const examsInRoom = groupedData[`${date}-${room}`] || [];

                              const exam = examsInRoom.find((e) => {
                                if (!e.exam_start_time || !e.exam_end_time) {
                                  return false;
                                }

                                // Extract time directly from ISO string (HH:MM format)
                                const examStartTimeStr = e.exam_start_time.slice(11, 16);
                                const examEndTimeStr = e.exam_end_time.slice(11, 16);

                                const [examStartHour, examStartMin] = examStartTimeStr.split(':').map(Number);
                                const [examEndHour, examEndMin] = examEndTimeStr.split(':').map(Number);

                                const examStart = examStartHour * 60 + examStartMin;
                                const examEnd = examEndHour * 60 + examEndMin;

                                const slotStart = Number(slot.start24.split(":")[0]) * 60 + Number(slot.start24.split(":")[1]);
                                const slotEnd = Number(slot.end24.split(":")[0]) * 60 + Number(slot.end24.split(":")[1]);

                                const matches = (examStart < slotEnd) && (examEnd > slotStart);

                                return matches;
                              });

                              if (!exam) return (
                                <td
                                  key={room}
                                  onDragOver={handleDragOver}
                                  onDragEnter={() => setHoveredCellId(key)}
                                  onDragLeave={() => setHoveredCellId(null)}
                                  onDrop={() => {
                                    const cellStartTime = `${date}T${slot.start24}:00`;
                                    const cellEndTime = `${date}T${slot.end24}:00`;
                                    handleDropToCell(date, String(room), cellStartTime, cellEndTime);
                                    setHoveredCellId(null);
                                  }}
                                  style={{
                                    backgroundColor: hoveredCellId === key && draggedExamId && swapMode ? '#e0f7fa' : '#f5f5f5',
                                    border: hoveredCellId === key && draggedExamId && swapMode ? '3px dashed #0288d1' : '1px solid #ddd',
                                    cursor: draggedExamId && swapMode ? 'pointer' : 'default',
                                    transition: 'all 0.2s ease',
                                    minHeight: '80px',
                                    padding: '8px',
                                    boxSizing: 'border-box'
                                  }}
                                ></td>
                              );

                              // Extract time directly from ISO string
                              const examStartTimeStr = exam.exam_start_time!.slice(11, 16);
                              const examEndTimeStr = exam.exam_end_time!.slice(11, 16);

                              const [examStartHour, examStartMin] = examStartTimeStr.split(':').map(Number);
                              const [examEndHour, examEndMin] = examEndTimeStr.split(':').map(Number);

                              const startMinutes = examStartHour * 60 + examStartMin;
                              const endMinutes = examEndHour * 60 + examEndMin;

                              const startSlotIndex = timeSlots.findIndex(slot => {
                                const slotStart = Number(slot.start24.split(":")[0]) * 60 + Number(slot.start24.split(":")[1]);
                                const slotEnd = Number(slot.end24.split(":")[0]) * 60 + Number(slot.end24.split(":")[1]);
                                return startMinutes >= slotStart && startMinutes < slotEnd;
                              });

                              const rowSpan = Math.ceil((endMinutes - startMinutes) / 30);

                              for (let i = 0; i < rowSpan; i++) {
                                if (startSlotIndex + i < timeSlots.length) {
                                  occupiedCells[`${date}-${room}-${startSlotIndex + i}`] = true;
                                }
                              }

                              return (
                                <td key={room} rowSpan={rowSpan}>
                                  <div
                                    data-exam-id={exam.examdetails_id}
                                    draggable={swapMode}
                                    onDragStart={() => handleDragStart(exam.examdetails_id!)}
                                    onDragOver={handleDragOver}
                                    onDragEnter={() => handleDragEnter(exam.examdetails_id!)}
                                    onDrop={() => handleDrop(exam.examdetails_id!)}
                                    onDragLeave={() => setDraggedOverExamId(null)}
                                    onClick={() => handleScheduleClick(exam)}
                                    className={
                                      searchTerm && examMatchesSearch(exam, searchTerm.toLowerCase())
                                        ? currentMatchIndex >= 0 && searchMatches[currentMatchIndex]?.examdetails_id === exam.examdetails_id
                                          ? "exam-card-match-active"
                                          : "exam-card-match"
                                        : draggedExamId === exam.examdetails_id
                                          ? "exam-card-dragging"
                                          : draggedOverExamId === exam.examdetails_id
                                            ? "exam-card-drop-target"
                                            : selectedSwap?.examdetails_id === exam.examdetails_id
                                              ? "exam-card-swap-selected"
                                              : ""
                                    }
                                    style={{
                                      backgroundColor: courseColorMap[exam.course_id || ""] || "#ccc",
                                      color: "white",
                                      padding: "6px 8px",
                                      borderRadius: "5px",
                                      fontSize: "11px",
                                      height: "100%",
                                      minHeight: "52px",
                                      boxSizing: "border-box",
                                      overflowY: "hidden",
                                      cursor: swapMode ? "grab" : "default",
                                      display: "flex",
                                      flexDirection: "column",
                                      justifyContent: "flex-start",
                                      gap: "2px",
                                      opacity: draggedExamId === exam.examdetails_id ? 0.55 : 1,
                                    }}
                                  >
                                    <p><strong>{exam.course_id}</strong></p>

                                    <p style={{
                                      fontSize: exam.sections && exam.sections.length > 3 ? '10px' : '12px',
                                      lineHeight: '1.2'
                                    }}>
                                      {getSectionDisplay(exam)}
                                    </p>

                                    <p style={{
                                      fontSize: exam.instructors && exam.instructors.length > 2 ? '10px' : '12px',
                                      lineHeight: '1.2'
                                    }}>
                                      Instructor: {getInstructorDisplay(exam)}
                                    </p>

                                    <div
                                      style={{
                                        fontSize: exam.proctors && exam.proctors.length > 2 ? '10px' : '12px',
                                        lineHeight: '1.2',
                                        cursor: activeProctorEdit === -1 ? 'pointer' : 'default',
                                        padding: '4px',
                                        borderRadius: '4px',
                                        backgroundColor: activeProctorEdit === exam.examdetails_id ? 'rgba(255,255,255,0.2)' : 'transparent'
                                      }}
                                      onClick={(e) => {
                                        if (activeProctorEdit === -1) {
                                          e.stopPropagation();
                                          setActiveProctorEdit(exam.examdetails_id!);
                                        }
                                      }}
                                    >
                                      Proctor:
                                      {activeProctorEdit === exam.examdetails_id ? (
                                        <div style={{ position: 'relative' }}>
                                          <Select
                                            isMulti
                                            value={
                                              exam.proctors && exam.proctors.length > 0
                                                ? exam.proctors.map(pid => ({
                                                  value: pid,
                                                  label: getUserName(pid)
                                                })).filter(opt => opt.label !== '-')
                                                : exam.proctor_id
                                                  ? [{
                                                    value: exam.proctor_id,
                                                    label: getUserName(exam.proctor_id)
                                                  }]
                                                  : []
                                            }
                                            onChange={(selectedOptions) => {
                                              if (selectedOptions && selectedOptions.length > 0) {
                                                const proctorIds = selectedOptions.map(opt => opt.value);
                                                handleProctorChange(exam.examdetails_id!, proctorIds);
                                              } else {
                                                handleProctorChange(exam.examdetails_id!, []);
                                              }
                                            }}
                                            options={getAvailableProctorsForExam(exam, examData, allCollegeUsers, users)}
                                            placeholder="Select proctor(s)..."
                                            isSearchable
                                            closeMenuOnSelect={false}
                                            blurInputOnSelect={false}
                                            captureMenuScroll={false}
                                            menuShouldScrollIntoView={false}
                                            menuPortalTarget={document.body}
                                            styles={{
                                              menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                                              menu: (provided) => ({ ...provided, zIndex: 9999 }),
                                              control: (provided) => ({
                                                ...provided,
                                                fontSize: '10px',
                                                minHeight: '25px',
                                                maxHeight: '80px',
                                                overflowY: 'auto',
                                                color: '#092C4C'
                                              }),
                                              option: (provided, state) => ({
                                                ...provided,
                                                fontSize: '10px',
                                                color: state.isSelected ? 'white' : '#092C4C',
                                                backgroundColor: state.isSelected
                                                  ? '#092C4C'
                                                  : state.isFocused
                                                    ? '#e5e7eb'
                                                    : 'white'
                                              }),
                                              multiValue: (provided) => ({
                                                ...provided,
                                                fontSize: '9px',
                                                margin: '1px',
                                                color: 'white'
                                              }),
                                              multiValueLabel: (provided) => ({
                                                ...provided,
                                                padding: '1px 3px',
                                                fontSize: '9px'
                                              })
                                            }}
                                          />
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setActiveProctorEdit(-1);
                                            }}
                                            style={{
                                              position: 'absolute',
                                              top: '2px',
                                              right: '2px',
                                              background: '#ef4444',
                                              color: 'white',
                                              border: 'none',
                                              borderRadius: '3px',
                                              padding: '2px 6px',
                                              fontSize: '10px',
                                              cursor: 'pointer',
                                              zIndex: 10000
                                            }}
                                          >
                                            ✕
                                          </button>
                                        </div>
                                      ) : (
                                        <span style={{ marginLeft: '5px', display: 'block', marginTop: '2px' }}>
                                          {getProctorDisplay(exam)}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {/* Footer Section */}
                    <div style={{
                      marginTop: '40px',
                      paddingTop: '20px',
                      borderTop: '2px solid #092C4C',
                      fontFamily: 'serif'
                    }}>
                      {/* Signature Section */}
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginBottom: '30px'
                      }}>
                        {/* Left - Prepared by */}
                        <div style={{ textAlign: 'left', width: '45%', color: 'black' }}>
                          <p style={{ margin: '5px 0', fontWeight: 'bold' }}>Prepared by:</p>
                          <p style={{ margin: '3px 0 5px 0', fontStyle: 'italic' }}>(sgd.)</p>
                          <p style={{ margin: '5px 0', fontWeight: 'bold' }}>
                            {footerData?.prepared_by_name || 'Type name'}
                          </p>
                          <p style={{ margin: '5px 0' }}>
                            {footerData?.prepared_by_title || `Dean, ${collegeName}`}
                          </p>
                        </div>

                        {/* Right - Approved by */}
                        <div style={{ textAlign: 'left', width: '15%', color: 'black' }}>
                          <p style={{ margin: '5px 0', fontWeight: 'bold' }}>Approved:</p>
                          <p style={{ margin: '3px 0 5px 0', fontStyle: 'italic' }}>(sgd.)</p>
                          <p style={{ margin: '5px 0', fontWeight: 'bold' }}>
                            {footerData?.approved_by_name || 'Type name'}
                          </p>
                          <p style={{ margin: '5px 0' }}>
                            {footerData?.approved_by_title || 'VCAA, USTP-CDO'}
                          </p>
                        </div>
                      </div>

                      {/* Center - Address */}
                      <div style={{ textAlign: 'center', fontSize: '15px', color: 'black' }}>
                        <p style={{ margin: '5px 0' }}>
                          {footerData?.address_line || 'C.M Recto Avenue, Lapasan, Cagayan de Oro City 9000 Philippines'}
                        </p>
                        <p style={{ margin: '5px 0' }}>
                          {footerData?.contact_line || 'Tel Nos. +63 (88) 856 1738; Telefax +63 (88) 856 4696 | http://www.ustp.edu.ph'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            });
          })
        )}
      </div>

      <Modal isOpen={showEmailModal} onClose={() => setShowEmailModal(false)}>
        <EmailSender
          user={user}
          onClose={() => setShowEmailModal(false)}
          collegeName={collegeName}
          approvalStatus={approvalStatus}
          examData={examData}
        />
      </Modal>

      <Modal isOpen={showDeanModal} onClose={() => setShowDeanModal(false)}>
        <DeanSend
          onClose={() => setShowDeanModal(false)}
          collegeName={collegeName}
          user={user}
          filteredExamData={filteredExamData}
          getUserName={getUserName}
          examPeriodName={examPeriodName}
          termName={termName}
          semesterName={semesterName}
          yearName={yearName}
          buildingName={buildingName}
          persistentUnscheduled={persistentUnscheduled}
        />
      </Modal>

      <FooterSettingsModal
        isOpen={showFooterSettings}
        onClose={() => setShowFooterSettings(false)}
        collegeName={collegeName}
        collegeId={schedulerCollegeId}
        showIconLabels={showIconLabels}
        onIconLabelsChange={(show) => {
          setShowIconLabels(show);
          localStorage.setItem('showIconLabels', JSON.stringify(show));
        }}
        onSave={async () => {
          try {
            const response = await api.get('/tbl_schedule_footer/', {
              params: { college_id: schedulerCollegeId }
            });

            if (response.data && response.data.length > 0) {
              setFooterData(response.data[0]);
            }
          } catch (error) {
          }
        }}
      />

      {/* Delete Progress Modal */}
        {deleteModal?.step === 'confirm1' && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 10000,
            background: 'rgba(9,44,76,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'fadeIn 0.2s ease',
          }}>
            <div style={{
              background: 'var(--surface)',
              borderRadius: 'var(--radius-xl)',
              padding: '36px 32px 28px',
              width: 'min(90vw, 420px)',
              boxShadow: 'var(--shadow-lg)',
              fontFamily: 'var(--font)',
              animation: 'slideUp 0.25s ease',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0,
            }}>
              {/* Warning icon ring */}
              <div style={{
                width: 64, height: 64, borderRadius: '50%',
                background: 'var(--warn-soft)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 18,
              }}>
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#B45309" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
        
              <h3 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', textAlign: 'center' }}>
                Delete All Schedules?
              </h3>
              <p style={{ margin: '0 0 24px', fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center', lineHeight: 1.6 }}>
                You are about to delete <strong>all schedules</strong> for{' '}
                <strong style={{ color: 'var(--text-primary)' }}>{schedulerCollegeName}</strong>.
                This action cannot be undone.
              </p>
        
              <div style={{ display: 'flex', gap: 10, width: '100%' }}>
                <button
                  type="button"
                  onClick={() => setDeleteModal(null)}
                  style={{
                    flex: 1, height: 40, border: '1.5px solid var(--border)',
                    borderRadius: 'var(--radius-md)', background: 'var(--surface)',
                    color: 'var(--text-secondary)', fontFamily: 'var(--font)',
                    fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'var(--surface)'}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteConfirm1}
                  style={{
                    flex: 1, height: 40, border: 'none',
                    borderRadius: 'var(--radius-md)', background: '#b45309',
                    color: '#fff', fontFamily: 'var(--font)',
                    fontSize: 13, fontWeight: 700, cursor: 'pointer',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#92400e'}
                  onMouseLeave={e => e.currentTarget.style.background = '#b45309'}
                >
                  Yes, Continue
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* ── Step-2 Final Confirmation Modal ── */}
        {deleteModal?.step === 'confirm2' && (
          <Step2Modal
            schedulerCollegeName={schedulerCollegeName}
            loading={deleteModal.loading}
            onCancel={() => setDeleteModal(null)}
            onConfirm={handleDeleteConfirm2}
          />
        )}

      <ToastContainer position="top-right" autoClose={1500} />
    </div>
  );
};

export default SchedulerView;