/// <reference types="react" />
import React, { useEffect, useState, useRef } from "react";
import Select from "react-select";
import { api } from '../lib/apiClient.ts';
import "../styles/SchedulerView.css";
import { FaChevronLeft, FaChevronRight, FaUserEdit, FaEnvelope, FaFileDownload, FaPlus, FaTrash, FaSms, FaPaperPlane } from "react-icons/fa";
import { MdSwapHoriz, MdEmail } from 'react-icons/md';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Modal from "../components/Modal.tsx";
import AddScheduleForm from "../components/SchedulerPlottingSchedule.tsx";
import SmsSender from "../components/SmsSender.tsx";
import EmailSender from "../components/EmailSender.tsx";
import DeanSend from "../components/DeanSend.tsx";
import ExportSchedule from "../components/ExportSchedule.tsx";

interface ExamDetail {
  examdetails_id?: number; course_id: string; section_name?: string; room_id?: string; exam_date?: string; exam_start_time?: string; semester?: string;
  exam_end_time?: string; instructor_id?: number; proctor_id?: number; proctor_timein?: string; academic_year?: string; building_name?: string;
  proctor_timeout?: string; program_id?: string; college_name?: string; modality_id?: number; exam_period?: string; exam_category?: string;
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
  const [showSmsModal, setShowSmsModal] = useState(false);
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

  const resetAllModes = () => {
    setIsModalOpen(false);
    setActiveProctorEdit(null);
    setSwapMode(false);
    setShowSwapInstructions(false);
    setShowEnvelopeDropdown(false);
    setShowExportDropdown(false);
  };

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
        console.log('No user_id found in props');
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
          console.error("No scheduler role found for user");
          setIsLoadingData(false);
          return;
        }

        const schedulerCollegeId = schedulerRoles[0].college_id;

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
          console.log("No proctors found");
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
            console.error(`❌ ${invalidSchedules.length} schedules have missing data:`, invalidSchedules);
          }

          setExamData(examsResponse.data);
        }

        if (usersResponse.data) {
          setUsers(usersResponse.data);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
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
        console.error("Error checking approval status:", error);
        setApprovalStatus(null);
        setRemarks(null);
      }
    };

    checkApprovalStatus();
    const interval = setInterval(checkApprovalStatus, 5000);
    return () => clearInterval(interval);
  }, [user, collegeName, approvalStatus, examData.length]);

  const handleProctorChange = async (examId: number, proctorId: number) => {
    try {
      await api.put(`/tbl_examdetails/${examId}/`, {
        proctor_id: proctorId
      });

      setExamData(prev =>
        prev.map(e => e.examdetails_id === examId ? { ...e, proctor_id: proctorId } : e)
      );
      setActiveProctorEdit(null);
      toast.success("Proctor updated successfully!");
    } catch (error) {
      console.error("Error updating proctor:", error);
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

          toast.success("Schedules swapped!");
        } catch (error) {
          console.error("Error swapping schedules:", error);
          toast.error("Failed to swap schedules!");
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
      return (
        exam.course_id?.toLowerCase().includes(searchLower) ||
        exam.section_name?.toLowerCase().includes(searchLower) ||
        exam.room_id?.toLowerCase().includes(searchLower) ||
        getUserName(exam.instructor_id).toLowerCase().includes(searchLower) ||
        getUserName(exam.proctor_id).toLowerCase().includes(searchLower) ||
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

  const generateCourseColors = (courses: string[]) => {
    const colors = [
      "#79b4f2", "#f27f79", "#79f2b4", "#f2e279", "#b479f2", "#f279d6",
      "#79d6f2", "#d6f279", "#f29979", "#a3f279", "#f279a3", "#79a3f2",
      "#f2c879", "#79f2e2", "#f2a879", "#b4f279", "#f27979", "#79f279",
      "#79f2d6", "#f279f2", "#79f2f2", "#f2b479", "#c879f2", "#79f2a8",
      "#f2d679", "#a879f2", "#79f2c8", "#f279b4", "#f2f279", "#79b4f2"
    ];

    const courseColorMap: Record<string, string> = {};
    courses.forEach((course, idx) => {
      courseColorMap[course] = colors[idx % colors.length];
    });
    return courseColorMap;
  };

  const courseColorMap = generateCourseColors(
    Array.from(new Set(searchFilteredData.map(e => e.course_id).filter(Boolean)))
  );

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

    const loadingToast = toast.info("Deleting schedules...", { autoClose: false });

    try {
      const examsToDelete = examData.filter(e => e.college_name === schedulerCollegeName);

      if (examsToDelete.length === 0) {
        toast.dismiss(loadingToast);
        toast.warn(`No schedules found for ${schedulerCollegeName}`);
        return;
      }

      // Delete the schedules
      const response = await api.post('/tbl_examdetails/batch-delete/', {
        college_name: schedulerCollegeName
      });

      // Delete the approval status for this college
      toast.dismiss(loadingToast);

      // Delete the approval status for this college
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
        console.error("Error deleting approval status:", approvalError);
      }

      // Reset local state immediately
      setApprovalStatus(null);
      setRemarks(null);

      // Clear exam data completely
      setExamData([]);

      toast.success(`Successfully deleted ${response.data.deleted_count} schedules for ${schedulerCollegeName}!`);

    } catch (error: any) {
      console.error("Error deleting schedules:", error);
      toast.dismiss(loadingToast);
      toast.error(`Failed to delete schedules: ${error?.response?.data?.error || error?.message || 'Unknown error'}`);
    }
    setApprovalStatus(null);
    setRemarks(null);
  };

  const getAvailableProctorsForExam = (
    exam: ExamDetail,
    examData: ExamDetail[],
    allCollegeUsers: { user_id: number; first_name: string; last_name: string }[],
    users: { user_id: number; first_name: string; last_name: string }[]
  ) => {

    // Rule: Show proctors only from scheduler’s college if available
    const availableUserPool = allCollegeUsers.length > 0 ? allCollegeUsers : users;

    // Step 1: Filter users by schedule conflict ONLY
    const availableUsers = availableUserPool.filter((p) => {
      const assignedExamsSameDay = examData.filter(
        (ex) =>
          ex.proctor_id === p.user_id &&
          ex.examdetails_id !== exam.examdetails_id &&
          ex.exam_date === exam.exam_date
      );

      return !assignedExamsSameDay.some((ex) => {
        if (
          !exam.exam_start_time ||
          !exam.exam_end_time ||
          !ex.exam_start_time ||
          !ex.exam_end_time
        ) {
          return false;
        }

        const startA = new Date(exam.exam_start_time).getTime();
        const endA = new Date(exam.exam_end_time).getTime();
        const startB = new Date(ex.exam_start_time).getTime();
        const endB = new Date(ex.exam_end_time).getTime();

        // Prevent time overlap (1–2pm can't also do 1:30–2:30pm)
        return startA < endB && endA > startB;
      });
    });

    // Step 2: Format output
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
            style={{ position: key === "Send Messages" ? "relative" : undefined }}
            onClick={() => {
              if (action) {
                action();
              } else {
                toggleCard(key);
              }
            }}
          >
            {icon}
            <span className="tooltip-text">
              {key.charAt(0).toUpperCase() + key.slice(1)}
            </span>

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
                    setShowSmsModal(true);
                    setShowEnvelopeDropdown(false);
                  }}
                  title="Send SMS"
                >
                  <FaSms />
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
                  src="/logo/USTPlogo.png"
                  alt="School Logo"
                  style={{ width: '200px', height: '160px', marginBottom: '5px' }}
                />
                <div style={{ fontSize: '30px', color: '#333', marginBottom: '-10px', fontFamily: 'serif' }}>
                  University of Science and Technology of Southern Philippines
                </div>
                <div style={{ fontSize: '15px', color: '#555', marginBottom: '-10px', fontFamily: 'serif' }}>
                  Alubijid | Balubal | Cagayan de Oro City | Claveria | Jasaan | Oroquieta | Panaon | Villanueva
                </div>
                <div style={{ fontSize: '30px', color: '#333', marginBottom: '-10px', fontFamily: 'serif' }}>{collegeName}</div>
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
                  console.warn('⚠️ Exam without room_id:', exam.examdetails_id);
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
                        src="/logo/USTPlogo.png"
                        alt="School Logo"
                        style={{ width: '200px', height: '160px', marginBottom: '5px' }}
                      />
                      <div style={{ fontSize: '30px', color: '#333', marginBottom: '-10px', fontFamily: 'serif' }}>
                        University of Science and Technology of Southern Philippines
                      </div>
                      <div style={{ fontSize: '15px', color: '#555', marginBottom: '-10px', fontFamily: 'serif' }}>
                        Alubijid | Balubal | Cagayan de Oro City | Claveria | Jasaan | Oroquieta | Panaon | Villanueva
                      </div>
                      <div style={{ fontSize: '30px', color: '#333', marginBottom: '-10px', fontFamily: 'serif' }}>{collegeName}</div>
                      <div style={{ fontSize: '20px', color: '#333', marginBottom: '-10px', fontFamily: 'serif', fontWeight: 'bold' }}>
                        {termName} Examination Schedule | {semesterName} Semester | A.Y. {yearName}
                      </div>
                      <div style={{ fontSize: '20px', color: '#333', marginTop: '-10px', fontFamily: 'serif' }}>{examPeriodName}</div>
                    </div>
                    <hr />
                    <div className="table-wrapper">
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
                                    console.warn('⚠️ Missing time data:', e.examdetails_id);
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
                                      onClick={() => handleScheduleClick(exam)}
                                      style={{
                                        backgroundColor: courseColorMap[exam.course_id || ""] || "#ccc",
                                        color: "black",
                                        padding: 4,
                                        borderRadius: 4,
                                        fontSize: 12,
                                        cursor: swapMode ? "pointer" : "default",
                                        outline: selectedSwap?.examdetails_id === exam.examdetails_id
                                          ? "10px solid blue"
                                          : searchTerm && (
                                            exam.course_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                            exam.section_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                            exam.room_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                            getUserName(exam.instructor_id).toLowerCase().includes(searchTerm.toLowerCase()) ||
                                            getUserName(exam.proctor_id).toLowerCase().includes(searchTerm.toLowerCase())
                                          )
                                            ? "3px solid yellow"
                                            : "none",
                                        boxShadow: searchTerm && (
                                          exam.course_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                          exam.section_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                          exam.room_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                          getUserName(exam.instructor_id).toLowerCase().includes(searchTerm.toLowerCase()) ||
                                          getUserName(exam.proctor_id).toLowerCase().includes(searchTerm.toLowerCase())
                                        ) ? "0 0 15px 3px rgba(255, 255, 0, 0.8)" : "none"
                                      }}
                                    >
                                      <p>{exam.course_id}</p>
                                      <p>{exam.section_name}</p>
                                      <p>Instructor: {getUserName(exam.instructor_id)}</p>
                                      <p>
                                        Proctor:
                                        {activeProctorEdit === exam.examdetails_id || activeProctorEdit === -1 ? (
                                          <Select
                                            value={
                                              exam.proctor_id
                                                ? {
                                                  value: exam.proctor_id,
                                                  label: getUserName(exam.proctor_id)
                                                }
                                                : null
                                            }
                                            onChange={(selectedOption) => {
                                              if (selectedOption) {
                                                handleProctorChange(exam.examdetails_id!, selectedOption.value);
                                              }
                                            }}
                                            options={getAvailableProctorsForExam(exam, examData, allCollegeUsers, users)}
                                            placeholder="--Select Proctor--"
                                            isSearchable
                                            styles={{ menu: (provided) => ({ ...provided, zIndex: 9999 }) }}
                                          />
                                        ) : (
                                          <span style={{ marginLeft: '5px' }}>
                                            {exam.proctor_id ? getUserName(exam.proctor_id) : "Not Assigned"}
                                          </span>
                                        )}
                                      </p>
                                      <p>{formatTo12Hour(examStartTimeStr)} - {formatTo12Hour(examEndTimeStr)}</p>
                                    </div>
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
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
                  console.warn('⚠️ Exam without room_id:', exam.examdetails_id);
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
                        src="/logo/USTPlogo.png"
                        alt="School Logo"
                        style={{ width: '200px', height: '160px', marginBottom: '5px' }}
                      />
                      <div style={{ fontSize: '30px', color: '#333', marginBottom: '-10px', fontFamily: 'serif' }}>
                        University of Science and Technology of Southern Philippines
                      </div>
                      <div style={{ fontSize: '15px', color: '#555', marginBottom: '-10px', fontFamily: 'serif' }}>
                        Alubijid | Balubal | Cagayan de Oro City | Claveria | Jasaan | Oroquieta | Panaon | Villanueva
                      </div>
                      <div style={{ fontSize: '30px', color: '#333', marginBottom: '-10px', fontFamily: 'serif' }}>{collegeName}</div>
                      <div style={{ fontSize: '20px', color: '#333', marginBottom: '-10px', fontFamily: 'serif', fontWeight: 'bold' }}>
                        {termName} Examination Schedule | {semesterName} Semester | A.Y. {yearName}
                      </div>
                      <div style={{ fontSize: '20px', color: '#333', marginTop: '-10px', fontFamily: 'serif' }}>{examPeriodName}</div>
                    </div>
                    <hr />
                    <div className="table-wrapper">
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
                                    console.warn('⚠️ Missing time data:', e.examdetails_id);
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
                                      onClick={() => handleScheduleClick(exam)}
                                      style={{
                                        backgroundColor: courseColorMap[exam.course_id || ""] || "#ccc",
                                        color: "black",
                                        padding: 4,
                                        borderRadius: 4,
                                        fontSize: 12,
                                        cursor: swapMode ? "pointer" : "default",
                                        outline: selectedSwap?.examdetails_id === exam.examdetails_id
                                          ? "10px solid blue"
                                          : searchTerm && (
                                            exam.course_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                            exam.section_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                            exam.room_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                            getUserName(exam.instructor_id).toLowerCase().includes(searchTerm.toLowerCase()) ||
                                            getUserName(exam.proctor_id).toLowerCase().includes(searchTerm.toLowerCase())
                                          )
                                            ? "3px solid yellow"
                                            : "none",
                                        boxShadow: searchTerm && (
                                          exam.course_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                          exam.section_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                          exam.room_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                          getUserName(exam.instructor_id).toLowerCase().includes(searchTerm.toLowerCase()) ||
                                          getUserName(exam.proctor_id).toLowerCase().includes(searchTerm.toLowerCase())
                                        ) ? "0 0 15px 3px rgba(255, 255, 0, 0.8)" : "none"
                                      }}
                                    >
                                      <p>{exam.course_id}</p>
                                      <p>{exam.section_name}</p>
                                      <p>Instructor: {getUserName(exam.instructor_id)}</p>
                                      <p>
                                        Proctor:
                                        {activeProctorEdit === exam.examdetails_id || activeProctorEdit === -1 ? (
                                          <Select
                                            value={
                                              exam.proctor_id
                                                ? {
                                                  value: exam.proctor_id,
                                                  label: getUserName(exam.proctor_id)
                                                }
                                                : null
                                            }
                                            onChange={(selectedOption) => {
                                              if (selectedOption) {
                                                handleProctorChange(exam.examdetails_id!, selectedOption.value);
                                              }
                                            }}
                                            options={getAvailableProctorsForExam(exam, examData, allCollegeUsers, users)}
                                            placeholder="--Select Proctor--"
                                            isSearchable
                                            styles={{ menu: (provided) => ({ ...provided, zIndex: 9999 }) }}
                                          />
                                        ) : (
                                          <span style={{ marginLeft: '5px' }}>
                                            {exam.proctor_id ? getUserName(exam.proctor_id) : "Not Assigned"}
                                          </span>
                                        )}
                                      </p>
                                      <p>{formatTo12Hour(examStartTimeStr)} - {formatTo12Hour(examEndTimeStr)}</p>
                                    </div>
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              );
            });
          })
        )}
        <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
          <AddScheduleForm
            user={user}
            onScheduleCreated={async () => {
              try {
                const params: any = {};
                if (schedulerCollegeName && schedulerCollegeName !== "Add schedule first") {
                  params.college_name = schedulerCollegeName;
                }

                const examsResponse = await api.get('/tbl_examdetails', { params });
                if (examsResponse.data) {
                  console.log(`✅ Immediate refresh: ${examsResponse.data.length} schedules loaded`);
                  setExamData(examsResponse.data);
                }
              } catch (error) {
                console.error("Error fetching data:", error);
              }
              setIsModalOpen(false);
            }}
          />
        </Modal>
      </div>

      <Modal isOpen={showSmsModal} onClose={() => setShowSmsModal(false)}>
        <SmsSender user={user} onClose={() => setShowSmsModal(false)} collegeName={collegeName} />
      </Modal>

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

      <ToastContainer position="top-right" autoClose={1500} />
    </div>
  );
};

export default SchedulerView;