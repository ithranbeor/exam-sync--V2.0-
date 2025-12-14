/// <reference types="react" />
import React, { useEffect, useState, useRef, useMemo } from "react";
import Select from "react-select";
import { api } from '../lib/apiClient.ts';
import "../styles/S_ExamViewer.css";
import { FaChevronLeft, FaChevronRight, FaUserEdit, FaEnvelope, FaFileDownload, FaPlus, FaTrash, FaPaperPlane, FaCog } from "react-icons/fa";
import { MdSwapHoriz, MdEmail } from 'react-icons/md';
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

const SchedulerView: React.FC<SchedulerViewProps> = ({ user }) => {
  const [examData, setExamData] = useState<ExamDetail[]>([]);
  const [users, setUsers] = useState<{ user_id: number; first_name: string; last_name: string }[]>([]);
  const [page, setPage] = useState(0);
  const [_activeCards, setActiveCards] = useState<Record<string, boolean>>({});
  const [swapMode, setSwapMode] = useState(false);
  const [showSwapInstructions, setShowSwapInstructions] = useState(false);
  const [selectedSwap, setSelectedSwap] = useState<ExamDetail | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<string>("all");
  const [_proctors, setProctors] = useState<{ user_id: number; first_name: string; last_name: string }[]>([]);
  const [allCollegeUsers, setAllCollegeUsers] = useState<{ user_id: number; first_name: string; last_name: string }[]>([]);
  const [activeProctorEdit, setActiveProctorEdit] = useState<number | null>(null);
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

  const maxRoomColumns = 5;
  const [_sendingToDean, _setSendingToDean] = useState(false);
  const [approvalStatus, setApprovalStatus] = useState<'pending' | 'approved' | 'rejected' | null>(null);
  const [remarks, setRemarks] = useState<string | null>(null);

  const [showExportModal, setShowExportModal] = useState(false);
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

  const [deleteProgress, setDeleteProgress] = useState<{
    isDeleting: boolean;
    progress: number;
    message: string;
  } | null>(null);

  const resetAllModes = () => {
    setIsModalOpen(false);
    setActiveProctorEdit(null);
    setSwapMode(false);
    setShowSwapInstructions(false);
    setShowEnvelopeDropdown(false);
    setShowExportDropdown(false);
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

  // Fetch footer data
  useEffect(() => {
    const fetchFooterData = async () => {
      if (!schedulerCollegeId) return;

      try {
        const response = await api.get('/tbl_schedule_footer/', {
          params: { college_id: schedulerCollegeId }  // ✅ Use college_id
        });

        if (response.data && response.data.length > 0) {
          const data = response.data[0];
          setFooterData({
            ...data,
            prepared_by_name:
              data.prepared_by_name?.trim()
                ? data.prepared_by_name
                : deanName,
          });
        } else {
          setFooterData({
            prepared_by_name: 'Loading...',
            prepared_by_title: `Dean, ${collegeName}`,
            approved_by_name: 'Loading...',
            approved_by_title: 'VCAA, USTP-CDO',
            address_line: 'C.M Recto Avenue, Lapasan, Cagayan de Oro City 9000 Philippines',
            contact_line: 'Tel Nos. +63 (88) 856 1738; Telefax +63 (88) 856 4696 | http://www.ustp.edu.ph',
            logo_url: null
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

  // ✅ NEW: Helper function to get instructor display
  const getInstructorDisplay = (exam: ExamDetail): string => {
    if (exam.instructors && exam.instructors.length > 0) {
      // Multiple instructors - always show as comma-separated list
      const names = exam.instructors.map(id => getUserName(id)).filter(n => n !== '-');
      if (names.length === 0) return '-';
      if (names.length === 1) return names[0];
      return names.join(', ');
    }
    // Fallback to legacy single instructor
    return getUserName(exam.instructor_id);
  };

  // ✅ UPDATED: Better display for multiple proctors
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

  // ✅ UPDATED: Handle both single and multiple proctor selection WITHOUT auto-closing
  const handleProctorChange = async (examId: number, proctorIds: number | number[]) => {
    try {
      // Convert to array if single value
      const proctorArray = Array.isArray(proctorIds) ? proctorIds : [proctorIds];

      // Primary proctor is the first one selected (or undefined if array is empty)
      const primaryProctorId = proctorArray.length > 0 ? proctorArray[0] : undefined;

      await api.put(`/tbl_examdetails/${examId}/`, {
        proctor_id: primaryProctorId,
        proctors: proctorArray
      });

      // ✅ Update local state with new proctor assignments
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

      // ✅ REMOVED: setActiveProctorEdit(null) - don't auto-close

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
        // ✅ Add swapping class for visual feedback
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

          // ✅ Remove animation class after completion
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

  const searchFilteredData = searchTerm.trim() === ""
    ? filteredExamData
    : filteredExamData.filter(exam => {
      const searchLower = searchTerm.toLowerCase();

      // Check sections (both array and legacy)
      const sectionMatch =
        (exam.sections && exam.sections.some(s => s.toLowerCase().includes(searchLower))) ||
        exam.section_name?.toLowerCase().includes(searchLower);

      // Check instructors (both array and legacy)
      const instructorMatch =
        (exam.instructors && exam.instructors.some(id => getUserName(id).toLowerCase().includes(searchLower))) ||
        getUserName(exam.instructor_id).toLowerCase().includes(searchLower);

      // Check proctors (both array and legacy)
      const proctorMatch =
        (exam.proctors && exam.proctors.some(id => getUserName(id).toLowerCase().includes(searchLower))) ||
        getUserName(exam.proctor_id).toLowerCase().includes(searchLower);

      return (
        exam.course_id?.toLowerCase().includes(searchLower) ||
        sectionMatch ||
        exam.room_id?.toLowerCase().includes(searchLower) ||
        instructorMatch ||
        proctorMatch ||
        exam.exam_date?.includes(searchTerm) ||
        exam.exam_start_time?.includes(searchTerm) ||
        exam.exam_end_time?.includes(searchTerm)
      );
    });

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

  const formatTo12Hour = (time: string) => {
    const [hourStr, minute] = time.split(":");
    let hour = Number(hourStr);
    const ampm = hour >= 12 ? "PM" : "AM";
    hour = hour % 12 || 12;
    return `${hour}:${minute} ${ampm}`;
  };

  const timeSlots = rawTimes.slice(0, -1).map((t, i) => ({
    start24: t,
    end24: rawTimes[i + 1],
    label: `${formatTo12Hour(t)} - ${formatTo12Hour(rawTimes[i + 1])}`,
  }));

  const generateCourseColors = (exams: ExamDetail[]) => {
    // Define color schemes for each year level
    const yearColors = {
      1: ['#EF4444', '#F59E0B', '#10B981', '#06B6D4', '#3B82F6', '#8B5CF6', '#EC4899', '#F97316', '#14B8A6', '#84CC16'], // Red, Amber, Green, Cyan, Blue, Purple, Pink, Orange, Teal, Lime
      2: ['#DC2626', '#D97706', '#059669', '#0891B2', '#2563EB', '#7C3AED', '#DB2777', '#EA580C', '#0D9488', '#65A30D'], // Different tones
      3: ['#B91C1C', '#CA8A04', '#047857', '#0E7490', '#1D4ED8', '#6366F1', '#BE123C', '#C2410C', '#0F766E', '#4D7C0F'], // More different tones
      4: ['#991B1B', '#92400E', '#065F46', '#164E63', '#1E3A8A', '#4C1D95', '#9F1239', '#9A3412', '#115E59', '#365314']  // Even more different
    };

    const courseColorMap: Record<string, string> = {};
    const programYearMap: Record<string, number> = {}; // Track color index per program-year

    exams.forEach((exam) => {
      if (!exam.course_id) return;

      // Skip if already assigned
      if (courseColorMap[exam.course_id]) return;

      // Try to extract year level from sections
      let yearLevel: number | null = null;
      let program = '';

      if (exam.sections && exam.sections.length > 0) {
        for (const section of exam.sections) {
          const sectionStr = String(section).trim();

          // Try multiple patterns:
          // Pattern 1: "BSIT1A", "BSCS2B", etc.
          let match = sectionStr.match(/^([A-Za-z]+)(\d)([A-Za-z]*)$/);

          // Pattern 2: "BSIT 1A", "BSCS 2B" (with space)
          if (!match) {
            match = sectionStr.match(/^([A-Za-z]+)\s+(\d)([A-Za-z]*)$/);
          }

          // Pattern 3: "BSIT-1A", "BSCS-2B" (with dash)
          if (!match) {
            match = sectionStr.match(/^([A-Za-z]+)-(\d)([A-Za-z]*)$/);
          }

          // Pattern 4: Just look for any digit in the string
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
            program = match[1]; // e.g., "BSIT", "BSCS"
            yearLevel = parseInt(match[2]); // e.g., 1, 2, 3, 4
            break; // Found valid pattern, stop looking
          }
        }
      }

      // Fallback: Try section_name if sections array didn't work
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

        // Get available colors for this year level
        const availableColors = yearColors[yearLevel as keyof typeof yearColors];

        // Get next color index for this program-year combo
        if (!programYearMap[programYearKey]) {
          programYearMap[programYearKey] = 0;
        }

        const colorIndex = programYearMap[programYearKey] % availableColors.length;
        courseColorMap[exam.course_id] = availableColors[colorIndex];

        // Increment for next course in same program-year
        programYearMap[programYearKey]++;
      } else {
        // Fallback: assign a neutral color if year level couldn't be determined
        courseColorMap[exam.course_id] = '#9CA3AF'; // Gray for unmatched
      }
    });

    return courseColorMap;
  };

  const courseColorMap = useMemo(() => {
    return generateCourseColors(examData);
  }, [examData]); // Only recalculate when examData changes, NOT when filter changes

  const hasData = searchFilteredData.length > 0;

  const toggleCard = (key: string) => {
    setActiveCards(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleDeleteAllSchedules = async () => {
    if (!schedulerCollegeName || schedulerCollegeName === "Add schedule first") {
      toast.warn("No college detected. Cannot delete schedules.");
      return;
    }

    const confirmStep1 = globalThis.confirm(
      `⚠️ WARNING: You are about to delete ALL schedules for ${schedulerCollegeName}.\n\nAre you absolutely sure you want to continue?`
    );
    if (!confirmStep1) return;

    const confirmStep2 = globalThis.confirm(
      `🚨 FINAL CONFIRMATION:\n\nThis will permanently remove ALL exam schedules for ${schedulerCollegeName}.\nThis action cannot be undone.\n\nDo you still want to proceed?`
    );
    if (!confirmStep2) return;

    try {
      const examsToDelete = examData.filter(e => e.college_name === schedulerCollegeName);

      if (examsToDelete.length === 0) {
        toast.warn(`No schedules found for ${schedulerCollegeName}`);
        return;
      }

      // Initialize progress
      setDeleteProgress({
        isDeleting: true,
        progress: 0,
        message: 'Preparing to delete schedules...'
      });

      // Simulate progress steps
      await new Promise(resolve => setTimeout(resolve, 500));
      setDeleteProgress({
        isDeleting: true,
        progress: 25,
        message: `Deleting ${examsToDelete.length} schedule(s)...`
      });

      // Delete schedules
      const response = await api.post('/tbl_examdetails/batch-delete/', {
        college_name: schedulerCollegeName
      });

      setDeleteProgress({
        isDeleting: true,
        progress: 60,
        message: 'Removing approval records...'
      });

      // Delete approval records
      try {
        const approvalResponse = await api.get('/tbl_scheduleapproval/', {
          params: { college_name: schedulerCollegeName }
        });

        if (approvalResponse.data && approvalResponse.data.length > 0) {
          const deletePromises = approvalResponse.data.map((approval: any) =>
            api.delete(`/tbl_scheduleapproval/${approval.request_id || approval.id}/`)
          );
          await Promise.all(deletePromises);
        }
      } catch (approvalError) {
        // Continue even if approval deletion fails
      }

      setDeleteProgress({
        isDeleting: true,
        progress: 85,
        message: 'Cleaning up data...'
      });

      await new Promise(resolve => setTimeout(resolve, 300));

      // Clear states
      setApprovalStatus(null);
      setRemarks(null);
      setExamData([]);
      saveUnscheduledSections([]);

      setDeleteProgress({
        isDeleting: true,
        progress: 100,
        message: 'Delete complete!'
      });

      await new Promise(resolve => setTimeout(resolve, 500));

      // Close progress modal
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
      // ✅ Find all exams where this proctor is assigned on the SAME DATE
      const assignedExamsSameDay = examData.filter(
        (ex) => {
          // Skip the current exam
          if (ex.examdetails_id === exam.examdetails_id) return false;

          // Check if proctor is assigned (in either proctor_id OR proctors array)
          const isAssigned =
            ex.proctor_id === p.user_id ||
            (ex.proctors && ex.proctors.includes(p.user_id));

          return isAssigned && ex.exam_date === exam.exam_date;
        }
      );

      // ✅ Check if ANY assignment conflicts with this exam's time
      return !assignedExamsSameDay.some((ex) => {
        if (!exam.exam_start_time || !exam.exam_end_time ||
          !ex.exam_start_time || !ex.exam_end_time) {
          return false;
        }

        const examStartStr = exam.exam_start_time.slice(11, 16);
        const examEndStr = exam.exam_end_time.slice(11, 16);
        const exStartStr = ex.exam_start_time.slice(11, 16);
        const exEndStr = ex.exam_end_time.slice(11, 16);

        const [examStartHour, examStartMin] = examStartStr.split(':').map(Number);
        const [examEndHour, examEndMin] = examEndStr.split(':').map(Number);
        const [exStartHour, exStartMin] = exStartStr.split(':').map(Number);
        const [exEndHour, exEndMin] = exEndStr.split(':').map(Number);

        const startA = examStartHour * 60 + examStartMin;
        const endA = examEndHour * 60 + examEndMin;
        const startB = exStartHour * 60 + exStartMin;
        const endB = exEndHour * 60 + exEndMin;

        return startA < endB && endA > startB;
      });
    });

    return availableUsers.map((p) => ({
      value: p.user_id,
      label: `${p.first_name} ${p.last_name}`,
    }));
  };

  const dynamicIcons = [
    {
      key: "Add Schedule",
      icon: <FaPlus style={{ fontSize: "25px", color: "gold" }} />,
      action: () => {
        if (approvalStatus === "pending") {
          toast.warn("Waiting for dean approval");
        } else if (approvalStatus === "approved") {
          toast.warn("Schedule already approved. Cannot modify.");
        } else {
          resetAllModes();
          setIsModalOpen(true);
        }
      },
    },
    {
      key: "Change Proctor",
      icon: <FaUserEdit style={{ fontSize: "20px" }} />,
      action: () => {
        if (approvalStatus === "pending") {
          toast.warn("Waiting for dean approval");
        } else if (approvalStatus === "approved") {
          toast.warn("Schedule already approved. Cannot modify.");
        } else {
          const newMode = activeProctorEdit === -1 ? null : -1;
          resetAllModes();
          setActiveProctorEdit(newMode);
        }
      },
    },
    {
      key: "Swap Room",
      icon: <MdSwapHoriz style={{ fontSize: "25px" }} />,
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
          setShowSwapInstructions(newSwapMode);
        }
      },
    },
    {
      key: "Send Messages",
      icon: <FaEnvelope style={{ fontSize: "20px" }} />,
      action: () => {
        resetAllModes();
        setShowEnvelopeDropdown(true);
      },
      ref: envelopeRef,
    },
    {
      key: "Export",
      icon: <FaFileDownload style={{ fontSize: "18px" }} />,
      action: () => {
        resetAllModes();
        setShowExportDropdown(true);
        setShowExportModal(true);
        setShowExportDropdown(false);

      },
      ref: exportRef,
    },
    {
      key: "Delete All",
      icon: <FaTrash style={{ fontSize: "18px" }} />,
      action: handleDeleteAllSchedules,
    },
    {
      key: "Edit Manually",
      icon: (
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <FaEdit style={{ fontSize: "20px" }} />
          {showUnscheduledBadge && (
            <span style={{
              position: 'absolute',
              top: '-4px',
              right: '-4px',
              backgroundColor: '#dc3545',
              color: 'white',
              borderRadius: '50%',
              minWidth: '18px',
              height: '18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '11px',
              fontWeight: 'bold',
              padding: '2px',
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
              zIndex: 1
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

          // ✅ Check for unscheduled sections
          if (persistentUnscheduled.length > 0) {
            const result = window.confirm(
              `Found ${persistentUnscheduled.length} unscheduled section(s) from previous attempt.\n\n` +
              `Would you like to schedule them now?`
            );

            if (result) {
              setManualEditorSections(persistentUnscheduled);
              setShowManualEditor(true);
            }
          } else if (examData.length === 0) {
            toast.info("No schedules found. Please add schedules first.");
          } else {
            // Allow manual editing of existing schedules
            setManualEditorSections([]);
            setShowManualEditor(true);
          }
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
      <div className="scheduler-top-card">
        {approvalStatus && (
          <div
            style={{
              position: "fixed",
              top: "80px",
              left: "50%",
              transform: "translateX(-50%)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              padding: "10px 20px",
              borderRadius: "8px",
              backgroundColor:
                approvalStatus === "approved"
                  ? "#4CAF50"
                  : approvalStatus === "rejected"
                    ? "#f44336"
                    : "#FF9800",
              color: "white",
              fontWeight: "bold",
              zIndex: 1000,
              boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
              maxWidth: "90%",
              textAlign: "center",
            }}
          >
            <span>
              Status: {approvalStatus.toUpperCase()}
              {approvalStatus === "pending" && " - Waiting for Dean"}
              {approvalStatus === "rejected" && " - You can modify and resubmit"}
            </span>

            {approvalStatus === "rejected" && remarks && (
              <span
                style={{
                  marginTop: "5px",
                  fontWeight: "normal",
                  fontSize: "0.9rem",
                  opacity: 0.9,
                }}
              >
                <strong>Remarks:</strong> {remarks}
              </span>
            )}
          </div>
        )}

        {swapMode && (
          <div
            style={{
              position: "fixed",
              top: "90px",
              left: "50%",
              transform: "translateX(-50%)",
              backgroundColor: "#ff9500ff",
              color: "white",
              padding: "12px 25px",
              borderRadius: "10px",
              boxShadow: "0 4px 10px rgba(0,0,0,0.3)",
              zIndex: 1200,
              textAlign: "center",
              fontWeight: "bold",
              opacity: 0.9
            }}
          >
            Swapping Mode
          </div>
        )}

        {showSwapInstructions && (
          <div
            style={{
              position: "fixed",
              top: "250px",
              left: "50%",
              transform: "translateX(-50%)",
              backgroundColor: "white",
              color: "#092C4C",
              borderRadius: "10px",
              padding: "5px 10px",
              width: "400px",
              zIndex: 1201,
              boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
              textAlign: "center",
              animation: "fadeIn 0.3s ease",
            }}
          >
            <h4 style={{ marginBottom: "8px", fontWeight: "bold" }}>Swapping Instructions</h4>
            <p style={{ fontSize: "15px", lineHeight: "1.5", marginBottom: "10px" }}>
              1️. Click the schedule you want to move. <br />
              2️. Click another schedule to swap with. <br />
              ⚠️ Swapping is only possible if both schedules have the <strong>same timeslot and course</strong>.
            </p>
            <button type="button"
              onClick={() => setShowSwapInstructions(false)}
              style={{
                backgroundColor: "transparent",
                color: "red",
                border: "none",
                borderRadius: "10px",
                padding: "6px 12px",
                cursor: "pointer",
                fontWeight: "bold",
              }}
            >
              Close Instructions
            </button>
          </div>
        )}

        {dynamicIcons.map(({ key, icon, action, ref }) => (
          <div
            key={key}
            ref={key === "Send Messages" ? ref : undefined}
            className={`scheduler-icon ${(swapMode && key === "Swap Room") ||
              (activeProctorEdit !== null && key === "Change Proctor") ||
              (isModalOpen && key === "Add Schedule") ||
              (showEnvelopeDropdown && key === "Send Messages")
              ? "active"
              : ""
              }`}
            style={{
              position: key === "Send Messages" ? "relative" : undefined,
              flexDirection: showIconLabels ? 'column' : 'row',
              gap: showIconLabels ? '4px' : '0'
            }}
            onClick={() => {
              if (action) {
                action();
              } else {
                toggleCard(key);
              }
            }}
          >
            {icon}
            {showIconLabels ? (
              <span style={{
                fontSize: '10px',
                color: '#092C4C',
                fontWeight: '500',
                whiteSpace: 'nowrap',
                marginTop: '2px'
              }}>
                {key}
              </span>
            ) : (
              <span className="tooltip-text">
                {key.charAt(0).toUpperCase() + key.slice(1)}
              </span>
            )}

            {key === "Send Messages" && showEnvelopeDropdown && (
              <div className="envelope-dropdown">
                <button
                  type="button"
                  className="dropdown-item"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDeanModal(true);
                    setShowEnvelopeDropdown(false);
                  }}
                  title="Send to Dean"
                >
                  <FaPaperPlane />
                </button>

                <button
                  type="button"
                  className="dropdown-item"
                  onClick={(e) => {
                    e.stopPropagation();

                    if (approvalStatus !== "approved") {
                      toast.warn("You can only send email once the schedule is approved.");
                      return;
                    }

                    setShowEmailModal(true);
                    setShowEnvelopeDropdown(false);
                  }}
                  title="Send Email"
                >
                  <MdEmail />
                </button>
              </div>
            )}
          </div>
        ))}
        <div style={{
          top: "20px",
          right: "-100px",
        }}>
          <select
            value={selectedFilter}
            onChange={(e) => {
              setSelectedFilter(e.target.value);
              setPage(0);
            }}
            style={{
              padding: "8px 1px", fontSize: "14px", borderRadius: "15px", border: "2px solid #092C4C",
              backgroundColor: "white", cursor: "pointer", minWidth: "250px", color: "#092C4C",
            }}
          >
            <option value="all">All Dates</option>
            {getFilterOptions().map((option, index) => (
              <option key={index} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
        <div
          style={{
            padding: "1px",
            fontSize: "10px",
            borderRadius: "15px",
            border: "2px solid #092C4C",
            backgroundColor: "white",
            cursor: "pointer",
            minWidth: "250px",
            color: "#092C4C",
            height: "40%"
          }}
        >
          <span style={{ color: "#092C4C", fontSize: "16px" }}></span>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(0);
            }}
            placeholder="Search schedules..."
            style={{
              border: "none",
              outline: "none",
              fontSize: "14px",
              color: "#092C4C",
              backgroundColor: "transparent",
            }}
          />
          {searchTerm && (
            <button type="button"
              onClick={() => {
                setSearchTerm("");
                setPage(0);
              }}
              style={{
                background: "none",
                border: "none",
                color: "#092C4C",
                cursor: "pointer",
                fontSize: "18px",
                padding: "0",
                marginLeft: "23px",
              }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={() => {
          resetAllModes();
          setShowFooterSettings(true);
        }}
        style={{
          position: 'fixed',
          bottom: '30px',
          right: '30px',
          backgroundColor: '#ffffffff',
          color: '#092C4C',
          border: 'none',
          borderRadius: '50px',
          padding: '12px 24px',
          fontSize: '14px',
          fontWeight: 'bold',
          cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          transition: 'all 0.3s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.05)';
          e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.4)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
        }}
      >
        <FaCog style={{ fontSize: '16px' }} />
        Settings
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
                <img
                  src={footerData?.logo_url || "/logo/USTPlogo.png"}
                  alt="School Logo"
                  style={{ width: '200px', height: '160px', marginBottom: '5px' }}
                />
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
              <div style={{
                textAlign: 'center',
                padding: '100px 20px',
                fontSize: '24px',
                color: '#999',
                fontFamily: 'serif'
              }}>
                {selectedFilter === "all" ? "Add schedule first" : "No schedules found for selected filter"}
              </div>
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
                      <img
                        src={footerData?.logo_url || "/logo/USTPlogo.png"}
                        alt="School Logo"
                        style={{ width: '200px', height: '160px', marginBottom: '5px' }}
                      />
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

                                // ✅ FIX: Extract time directly from ISO string (HH:MM format)
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

                              if (!exam) return <td key={room}></td>;

                              // ✅ FIX: Extract time directly from ISO string
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
                                    onClick={() => handleScheduleClick(exam)}
                                    style={{
                                      backgroundColor: courseColorMap[exam.course_id || ""] || "#ccc",
                                      color: "white",
                                      padding: "8px",
                                      borderRadius: "6px",
                                      fontSize: "12px",
                                      minHeight: "80px",
                                      maxHeight: "200px",
                                      overflowY: "auto",
                                      cursor: swapMode ? "pointer" : "default",
                                      display: "flex",
                                      flexDirection: "column",
                                      justifyContent: "flex-start",
                                      outline: selectedSwap?.examdetails_id === exam.examdetails_id
                                        ? "10px solid blue"
                                        : searchTerm && (
                                          exam.course_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                          getSectionDisplay(exam).toLowerCase().includes(searchTerm.toLowerCase()) ||
                                          exam.room_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                          getInstructorDisplay(exam).toLowerCase().includes(searchTerm.toLowerCase()) ||
                                          getProctorDisplay(exam).toLowerCase().includes(searchTerm.toLowerCase())
                                        )
                                          ? "3px solid yellow"
                                          : "none",
                                      boxShadow: searchTerm && (
                                        exam.course_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                        getSectionDisplay(exam).toLowerCase().includes(searchTerm.toLowerCase()) ||
                                        exam.room_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                        getInstructorDisplay(exam).toLowerCase().includes(searchTerm.toLowerCase()) ||
                                        getProctorDisplay(exam).toLowerCase().includes(searchTerm.toLowerCase())
                                      ) ? "0 0 15px 3px rgba(255, 255, 0, 0.8)"
                                        : "none"
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

                                    {/* ✅ UPDATED: Show all instructors without tooltip, adjust font for many */}
                                    <p style={{
                                      fontSize: exam.instructors && exam.instructors.length > 2 ? '10px' : '12px',
                                      lineHeight: '1.2'
                                    }}>
                                      Instructor: {getInstructorDisplay(exam)}
                                    </p>

                                    {/* ✅ UPDATED: Proctor section - editable for ALL schedules */}
                                    <div style={{
                                      fontSize: exam.proctors && exam.proctors.length > 2 ? '10px' : '12px',
                                      lineHeight: '1.2'
                                    }}>
                                      Proctor:
                                      {activeProctorEdit === exam.examdetails_id || activeProctorEdit === -1 ? (
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
                                            styles={{
                                              menu: (provided) => ({ ...provided, zIndex: 9999 }),
                                              control: (provided) => ({
                                                ...provided,
                                                fontSize: '10px',
                                                minHeight: '25px',
                                                maxHeight: '80px',
                                                overflowY: 'auto'
                                              }),
                                              option: (provided) => ({ ...provided, fontSize: '10px' }),
                                              valueContainer: (provided) => ({
                                                ...provided,
                                                padding: '2px 6px',
                                                maxHeight: '70px',
                                                overflowY: 'auto'
                                              }),
                                              multiValue: (provided) => ({
                                                ...provided,
                                                fontSize: '9px',
                                                margin: '1px'
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
                                              setActiveProctorEdit(null);
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
                                          {exam.proctors && exam.proctors.length > 1 && (
                                            <span style={{
                                              fontSize: '9px',
                                              color: '#666',
                                              display: 'block',
                                              marginTop: '2px'
                                            }}>
                                            </span>
                                          )}
                                        </span>
                                      )}
                                    </div>

                                    <p>{formatTo12Hour(examStartTimeStr)} - {formatTo12Hour(examEndTimeStr)}</p>
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
                      <img
                        src={footerData?.logo_url || "/logo/USTPlogo.png"}
                        alt="School Logo"
                        style={{ width: '200px', height: '160px', marginBottom: '5px' }}
                      />
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

                                // ✅ FIX: Extract time directly from ISO string (HH:MM format)
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

                              if (!exam) return <td key={room}></td>;

                              // ✅ FIX: Extract time directly from ISO string
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
                                    onClick={() => handleScheduleClick(exam)}
                                    style={{
                                      backgroundColor: courseColorMap[exam.course_id || ""] || "#ccc",
                                      color: "white",
                                      padding: "8px",
                                      borderRadius: "6px",
                                      fontSize: "12px",
                                      minHeight: "80px",
                                      maxHeight: "200px",
                                      overflowY: "auto",
                                      cursor: swapMode ? "pointer" : "default",
                                      display: "flex",
                                      flexDirection: "column",
                                      justifyContent: "flex-start",
                                      outline: selectedSwap?.examdetails_id === exam.examdetails_id
                                        ? "10px solid blue"
                                        : searchTerm && (
                                          exam.course_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                          getSectionDisplay(exam).toLowerCase().includes(searchTerm.toLowerCase()) ||
                                          exam.room_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                          getInstructorDisplay(exam).toLowerCase().includes(searchTerm.toLowerCase()) ||
                                          getProctorDisplay(exam).toLowerCase().includes(searchTerm.toLowerCase())
                                        )
                                          ? "3px solid yellow"
                                          : "none",
                                      boxShadow: searchTerm && (
                                        exam.course_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                        getSectionDisplay(exam).toLowerCase().includes(searchTerm.toLowerCase()) ||
                                        exam.room_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                        getInstructorDisplay(exam).toLowerCase().includes(searchTerm.toLowerCase()) ||
                                        getProctorDisplay(exam).toLowerCase().includes(searchTerm.toLowerCase())
                                      ) ? "0 0 15px 3px rgba(255, 255, 0, 0.8)"
                                        : "none"
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

                                    {/* ✅ UPDATED: Show all instructors without tooltip, adjust font for many */}
                                    <p style={{
                                      fontSize: exam.instructors && exam.instructors.length > 2 ? '10px' : '12px',
                                      lineHeight: '1.2'
                                    }}>
                                      Instructor: {getInstructorDisplay(exam)}
                                    </p>

                                    {/* ✅ UPDATED: Proctor section - show all without tooltip */}
                                    <div style={{
                                      fontSize: exam.proctors && exam.proctors.length > 2 ? '10px' : '12px',
                                      lineHeight: '1.2'
                                    }}>
                                      Proctor:
                                      {activeProctorEdit === exam.examdetails_id || activeProctorEdit === -1 ? (
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
                                            styles={{
                                              menu: (provided) => ({ ...provided, zIndex: 9999 }),
                                              control: (provided) => ({
                                                ...provided,
                                                fontSize: '10px',
                                                minHeight: '25px',
                                                maxHeight: '80px',
                                                overflowY: 'auto'
                                              }),
                                              option: (provided) => ({ ...provided, fontSize: '10px' }),
                                              valueContainer: (provided) => ({
                                                ...provided,
                                                padding: '2px 6px',
                                                maxHeight: '70px',
                                                overflowY: 'auto'
                                              }),
                                              multiValue: (provided) => ({
                                                ...provided,
                                                fontSize: '9px',
                                                margin: '1px'
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
                                              setActiveProctorEdit(null);
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
                                          {exam.proctors && exam.proctors.length > 1 && (
                                            <span style={{
                                              fontSize: '9px',
                                              color: '#666',
                                              display: 'block',
                                              marginTop: '2px'
                                            }}>
                                            </span>
                                          )}
                                        </span>
                                      )}
                                    </div>
                                    <p>{formatTo12Hour(examStartTimeStr)} - {formatTo12Hour(examEndTimeStr)}</p>
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
        // Replace around line ~950:
        <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
          <AddScheduleForm
            user={user}
            onScheduleCreated={async (unscheduled?: any[]) => {
              try {
                const params: any = {};
                if (schedulerCollegeName && schedulerCollegeName !== "Add schedule first") {
                  params.college_name = schedulerCollegeName;
                }

                const examsResponse = await api.get('/tbl_examdetails', { params });
                if (examsResponse.data) {
                  setExamData(examsResponse.data);
                }
              } catch (error) {
              }

              setIsModalOpen(false);

              // ✅ Save unscheduled sections for later access
              if (unscheduled && unscheduled.length > 0) {
                saveUnscheduledSections(unscheduled); // ✅ NOW THIS WORKS

                const result = window.confirm(
                  `Schedule generation complete!\n\n` +
                  `${unscheduled.length} section(s) need manual scheduling.\n\n` +
                  `Would you like to schedule them now?`
                );

                if (result) {
                  setManualEditorSections(unscheduled);
                  setShowManualEditor(true);
                } else {
                  toast.info(
                    `${unscheduled.length} section(s) saved for manual scheduling. ` +
                    `Click "Edit Manually" button to schedule them later.`,
                    { autoClose: 8000 }
                  );
                }
              } else {
                saveUnscheduledSections([]); // ✅ Clear storage if all scheduled
              }
            }}
          />
        </Modal>
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
        />
      </Modal>

      <Modal isOpen={showExportModal} onClose={() => setShowExportModal(false)}>
        <ExportSchedule onClose={() => setShowExportModal(false)} collegeName={collegeName} />
      </Modal>

      <Modal isOpen={showFooterSettings} onClose={() => setShowFooterSettings(false)}>
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
      </Modal>

      <Modal isOpen={showManualEditor} onClose={() => setShowManualEditor(false)}>
        <ManualScheduleEditor
          unscheduledSections={manualEditorSections.length > 0 ? manualEditorSections : persistentUnscheduled}
          examDates={uniqueDates.filter((date): date is string => date !== undefined)}
          schedulerCollegeName={schedulerCollegeName}
          onClose={() => {
            setShowManualEditor(false);
            setManualEditorSections([]);
          }}
          onScheduleCreated={async (remainingUnscheduled?: any[]) => {
            try {
              const params: any = {};
              if (schedulerCollegeName && schedulerCollegeName !== "Add schedule first") {
                params.college_name = schedulerCollegeName;
              }

              const examsResponse = await api.get('/tbl_examdetails', { params });
              if (examsResponse.data) {
                setExamData(examsResponse.data);
              }
            } catch (error) {
            }

            // ✅ Update persistent storage with remaining unscheduled
            if (remainingUnscheduled && remainingUnscheduled.length > 0) {
              saveUnscheduledSections(remainingUnscheduled); // ✅ NOW THIS WORKS
              toast.info(
                `${remainingUnscheduled.length} section(s) still need manual scheduling.`,
                { autoClose: 5000 }
              );
            } else {
              saveUnscheduledSections([]); // ✅ Clear if all done
              toast.success("All sections scheduled successfully!");
            }

            setShowManualEditor(false);
            setManualEditorSections([]);
          }}
          academicYear={yearName}
          semester={semesterName}
          examCategory={termName}
          examPeriod={examPeriodName}
          duration={{ hours: 1, minutes: 30 }}
        />
      </Modal>

      {/* Delete Progress Modal */}
      {deleteProgress && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          animation: 'fadeIn 0.3s ease'
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '40px',
            maxWidth: '500px',
            width: '90%',
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)',
            animation: 'slideUp 0.3s ease'
          }}>
            {/* Icon */}
            <div style={{
              textAlign: 'center',
              marginBottom: '20px'
            }}>
              <div style={{
                width: '80px',
                height: '80px',
                margin: '0 auto',
                borderRadius: '50%',
                backgroundColor: deleteProgress.progress === 100 ? '#10b981' : '#ef4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                animation: 'pulse 2s infinite'
              }}>
                {deleteProgress.progress === 100 ? (
                  <span style={{ fontSize: '40px' }}>✓</span>
                ) : (
                  <FaTrash style={{ fontSize: '32px', color: 'white' }} />
                )}
              </div>
            </div>

            {/* Message */}
            <h3 style={{
              textAlign: 'center',
              color: '#092C4C',
              marginBottom: '10px',
              fontSize: '20px',
              fontWeight: 'bold'
            }}>
              {deleteProgress.progress === 100 ? 'Deletion Complete!' : 'Deleting Schedules...'}
            </h3>

            <p style={{
              textAlign: 'center',
              color: '#666',
              marginBottom: '25px',
              fontSize: '14px'
            }}>
              {deleteProgress.message}
            </p>

            {/* Progress Bar */}
            <div style={{
              width: '100%',
              height: '12px',
              backgroundColor: '#e5e7eb',
              borderRadius: '6px',
              overflow: 'hidden',
              marginBottom: '15px'
            }}>
              <div style={{
                width: `${deleteProgress.progress}%`,
                height: '100%',
                backgroundColor: deleteProgress.progress === 100 ? '#10b981' : '#ef4444',
                transition: 'width 0.5s ease',
                borderRadius: '6px'
              }} />
            </div>

            {/* Percentage */}
            <p style={{
              textAlign: 'center',
              color: '#092C4C',
              fontWeight: 'bold',
              fontSize: '16px'
            }}>
              {deleteProgress.progress}%
            </p>

            {/* Warning Text */}
            {deleteProgress.progress < 100 && (
              <p style={{
                textAlign: 'center',
                color: '#ef4444',
                fontSize: '12px',
                marginTop: '20px',
                fontWeight: '500'
              }}>
                ⚠️ Please do not close this window
              </p>
            )}
          </div>
        </div>
      )}

      <ToastContainer position="top-right" autoClose={1500} />
    </div>
  );
};

export default SchedulerView;