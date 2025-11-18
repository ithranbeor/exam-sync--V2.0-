/// <reference types="react" />
import React, { useEffect, useState, useRef } from "react";
import Select from "react-select";
import { api } from '../lib/apiClient.ts';
import "../styles/SchedulerView.css";
import { FaChevronLeft , FaChevronRight, FaUserEdit, FaEnvelope, FaFileDownload, FaPlus, FaTrash, FaSms, FaPaperPlane  } from "react-icons/fa";
import { MdSwapHoriz, MdEmail } from 'react-icons/md';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Modal from "../components/Modal.tsx";
import AddScheduleForm from "../components/SchedulerPlottingSchedule.tsx";
import SmsSender from "../components/SmsSender.tsx";
import EmailSender from "../components/EmailSender.tsx";
import DeanSend from "../components/DeanSend.tsx";
import ExportSchedule from "../components/ExportSchedule.tsx";

interface ExamDetail {examdetails_id?: number;  course_id: string;      section_name?: string; room_id?: string;        exam_date?: string;     exam_start_time?: string; semester?: string; 
                      exam_end_time?: string;   instructor_id?: number; proctor_id?: number;   proctor_timein?: string; academic_year?: string; building_name?: string;
                      proctor_timeout?: string; program_id?: string;    college_name?: string; modality_id?: number;    exam_period?: string;   exam_category?: string; 
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
  const [collegeDataReady, setCollegeDataReady] = useState(false); // NEW
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

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (envelopeRef.current && !envelopeRef.current.contains(event.target as Node)) {
        setShowEnvelopeDropdown(false);
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

      console.log('========================================');
      console.log('Scheduler User ID:', realUserId);

      try {
        // Get scheduler's college - role_id = 3
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
        console.log('Scheduler College ID:', schedulerCollegeId);

        // ✅ GET THE COLLEGE NAME
        const collegeResponse = await api.get(`/tbl_college/${schedulerCollegeId}/`);
        const collegeName = collegeResponse.data?.college_name;
        console.log('Scheduler College Name:', collegeName);
        setSchedulerCollegeName(collegeName || "");

        // Get ALL departments under this college
        const departmentsResponse = await api.get('/departments/', {
          params: {
            college_id: schedulerCollegeId
          }
        });

        const departments = departmentsResponse.data;
        const departmentIds = departments?.map((d: any) => d.department_id) || [];
        console.log('Department IDs under college:', departmentIds);

        // Get all proctors (role_id = 5)
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

        console.log('Total proctors fetched:', proctorRoles.length);

        // Filter proctors: college_id matches OR department_id matches
        const matchingUserIds = new Set<number>();

        proctorRoles.forEach((p: any) => {
          let matches = false;

          // Case 1: college_id matches directly
          if (p.college_id && String(p.college_id) === String(schedulerCollegeId)) {
            matches = true;
            console.log(`✓ Match (Direct College): User ${p.user_id} - College: ${p.college_id}`);
          }
          // Case 2: department_id belongs to scheduler's college
          else if (p.department_id && departmentIds.includes(p.department_id)) {
            matches = true;
            console.log(`✓ Match (Department): User ${p.user_id} - Dept: ${p.department_id}`);
          }

          if (!matches) {
            console.log(`✗ No Match: User ${p.user_id} - College: ${p.college_id || 'null'}, Dept: ${p.department_id || 'null'}`);
          }

          if (matches) {
            matchingUserIds.add(p.user_id);
          }
        });

        console.log('Matching User IDs:', Array.from(matchingUserIds));

        // Fetch user details for matching proctors ONLY
        if (matchingUserIds.size === 0) {
          console.log('No matching proctors found');
          setAllCollegeUsers([]);
          setProctors([]);
          setIsLoadingData(false);
          return;
        }

        const usersResponse = await api.get('/users/');
        const allUsers = usersResponse.data;
        const userDetails = allUsers.filter((u: any) => matchingUserIds.has(u.user_id));

        console.log('Final filtered users:', userDetails?.length || 0);
        console.log('========================================');

        // Set all college users and proctors
        setAllCollegeUsers(userDetails || []);
        setProctors(userDetails || []);

        setUsers((prevUsers) => {
          // Merge existing users with newly fetched proctor details
          const existingUserIds = new Set(prevUsers.map(u => u.user_id));
          const newUsers = (userDetails || []).filter((u: { user_id: number; }) => !existingUserIds.has(u.user_id));
          return [...prevUsers, ...newUsers];
        });

        // Fetch dean info
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
        console.error("Error fetching scheduler data:", error);
        setIsLoadingData(false);
      }
    };

    fetchSchedulerData();
  }, [user]);

  // ✅ FIXED: Filter exam data by scheduler's college
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
          console.log(`✅ Fetched ${examsResponse.data.length} schedules`);
          
          // ✅ Check for data integrity issues
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
      if (!user?.user_id || !collegeName || collegeName === "Add schedule first") return;

      try {
        const response = await api.get('/tbl_scheduleapproval/', {
          params: {
            college_name: collegeName
          }
        });

        if (response.data && response.data.length > 0) {
          // Sort by submitted_at descending and get the first one
          const sortedData = response.data.sort((a: any, b: any) => 
            new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime()
          );
          const latestApproval = sortedData[0];
          
          setApprovalStatus(latestApproval.status as 'pending' | 'approved' | 'rejected');
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
  }, [user, collegeName]);

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
        
    // Convert to number if it's a string
    const numericId = typeof id === 'string' ? parseInt(id, 10) : id;
    
    // Try allCollegeUsers first (filtered proctors)
    const collegeUser = allCollegeUsers.find(u => Number(u.user_id) === Number(numericId));
    if (collegeUser) {
      const name = `${collegeUser.first_name} ${collegeUser.last_name}`;
      return name;
    }
    
    // Fallback to all users
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

  // Filter exam data based on selected filter
  const filteredExamData = selectedFilter === "all" 
    ? examData 
    : examData.filter(exam => {
        const filterKey = `${exam.semester} | ${exam.academic_year} | ${exam.exam_date}`;
        return filterKey === selectedFilter;
      });

  // Further filter by search term
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

  // Generate unique filter options
  const getFilterOptions = () => {
    const uniqueOptions = new Set<string>();
    examData.forEach(exam => {
      if (exam.semester && exam.academic_year && exam.exam_date) {
        uniqueOptions.add(`${exam.semester} | ${exam.academic_year} | ${exam.exam_date}`);
      }
    });
    return Array.from(uniqueOptions).sort();
  };

  // Get unique dates from filtered data
  const uniqueDates = Array.from(new Set(searchFilteredData.map((e) => e.exam_date))).filter(Boolean).sort();

  useEffect(() => {
    if (searchFilteredData.length > 0) {
      console.log('📊 Total schedules in searchFilteredData:', searchFilteredData.length);
      console.log('📅 Unique dates:', uniqueDates);
      console.log('🏫 Total rooms:', Array.from(new Set(searchFilteredData.map(e => e.room_id))).length);
      
      // ✅ ADD THIS: Check for incomplete schedules
      const invalidSchedules = searchFilteredData.filter(e => 
        !e.room_id || !e.exam_start_time || !e.exam_end_time || !e.exam_date
      );
      
      if (invalidSchedules.length > 0) {
        console.error('❌ Incomplete schedules:', invalidSchedules);
      }
      
      // ✅ ADD THIS: Log schedule distribution by date and room
      uniqueDates.forEach(date => {
        const dateSchedules = searchFilteredData.filter(e => e.exam_date === date);
        console.log(`📅 ${date}: ${dateSchedules.length} schedules`);
        
        const roomsForDate = Array.from(new Set(dateSchedules.map(e => e.room_id)));
        console.log(`   🏫 Rooms: ${roomsForDate.join(', ')}`);
      });
    }
  }, [searchFilteredData, uniqueDates]);
  
  const rawTimes = [
    "07:00","07:30","08:00","08:30","09:00","09:30","10:00","10:30","11:00","11:30",
    "12:00","12:30","13:00","13:30","14:00","14:30","15:00","15:30","16:00","16:30",
    "17:00","17:30","18:00","18:30","19:00","19:30","20:00","20:30", "21:00"
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
    label: `${formatTo12Hour(t)} - ${formatTo12Hour(rawTimes[i+1])}`,
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

      console.log(`🗑️ Batch deleting ${examsToDelete.length} schedules for "${schedulerCollegeName}"`);

      // ✅ Use batch delete endpoint
      const response = await api.post('/tbl_examdetails/batch-delete/', {
        college_name: schedulerCollegeName
      });

      toast.dismiss(loadingToast);
      
      // Update state immediately
      setExamData(prev => prev.filter(e => e.college_name !== schedulerCollegeName));
      
      toast.success(`Successfully deleted ${response.data.deleted_count} schedules for ${schedulerCollegeName}!`);

    } catch (error: any) {
      console.error("Error deleting schedules:", error);
      toast.dismiss(loadingToast);
      toast.error(`Failed to delete schedules: ${error?.response?.data?.error || error?.message || 'Unknown error'}`);
    }
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
          resetAllModes(); // close all other features
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
          resetAllModes(); // close everything before toggling
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
        resetAllModes(); // ensure only this dropdown is open
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

  // ✅ Show loading state
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
        Loading scheduler data...
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
            className={`scheduler-icon ${
              (swapMode && key === "Swap Room") ||
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

            {/* Envelope Dropdown */}
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
              padding: "8px 1px", fontSize: "14px",borderRadius: "15px", border: "2px solid #092C4C",
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
          style={{
            position: "fixed",
            left: "45%",
            top: "90%",
            transform: "translateY(-50%)",
            zIndex: 1000,
            background: "rgba(255,255,255,0.3)",
            border: "none",
            borderRadius: "50%",
            cursor: "pointer",
            padding: "0.5rem",
          }}
          onClick={() => setPage(page - 1)}
        >
          <FaChevronLeft style={{ color: "#092C4C", fontSize: "3rem", opacity: 0.7 }} />
        </button>
      )}

      {hasData && page < totalPages - 1 && (
        <button
          type="button"
          style={{
            position: "fixed",
            right: "40%",
            top: "90%",
            transform: "translateY(-50%)",
            zIndex: 1000,
            background: "rgba(255,255,255,0.3)",
            border: "none",
            borderRadius: "50%",
            cursor: "pointer",
            padding: "0.5rem",
          }}
          onClick={() => setPage(page + 1)}
        >
          <FaChevronRight style={{ color: "#092C4C", fontSize: "3rem", opacity: 0.7 }} />
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
                  src="../../static/logo/USTPlogo.png"
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

              // ✅ ADD THIS: Log grouped data
              console.log(`📦 Grouped data for ${date}:`, Object.keys(groupedData).length, 'room groups');
              Object.entries(groupedData).forEach(([key, exams]) => {
                console.log(`   ${key}: ${exams.length} exam(s)`);
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
                        src="../../static/logo/USTPlogo.png"
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
                                
                                // ✅ FIX: Parse the FULL ISO timestamp, not just time portion
                                const examStartTime = new Date(e.exam_start_time);
                                const examEndTime = new Date(e.exam_end_time);
                                
                                // Extract minutes from midnight of the exam date
                                const examStart = examStartTime.getUTCHours() * 60 + examStartTime.getUTCMinutes();
                                const examEnd = examEndTime.getUTCHours() * 60 + examEndTime.getUTCMinutes();
                                
                                const slotStart = Number(slot.start24.split(":")[0]) * 60 + Number(slot.start24.split(":")[1]);
                                const slotEnd = Number(slot.end24.split(":")[0]) * 60 + Number(slot.end24.split(":")[1]);
                                
                                const matches = (examStart < slotEnd) && (examEnd > slotStart);
                                
                                // ✅ Debug log for first room only
                                if (rowIndex < 3 && room === pageRooms[0]) {
                                  console.log(`🔍 Slot ${slot.start24}-${slot.end24} (${slotStart}-${slotEnd}min) vs Exam ${examStart}-${examEnd}min (${e.exam_start_time.slice(11, 16)}-${e.exam_end_time.slice(11, 16)}): ${matches ? '✅' : '❌'}`);
                                }
                                
                                return matches;
                              });

                              if (!exam) return <td key={room}></td>;

                              const examStartTime = new Date(exam.exam_start_time!);
                              const examEndTime = new Date(exam.exam_end_time!);

                              const startMinutes = examStartTime.getUTCHours() * 60 + examStartTime.getUTCMinutes();
                              const endMinutes = examEndTime.getUTCHours() * 60 + examEndTime.getUTCMinutes();

                              const examStartHour = examStartTime.getUTCHours();
                              const examStartMin = examStartTime.getUTCMinutes();
                              const examStartTotalMin = examStartHour * 60 + examStartMin;

                              const startSlotIndex = timeSlots.findIndex(slot => {
                                const slotStart = Number(slot.start24.split(":")[0]) * 60 + Number(slot.start24.split(":")[1]);
                                const slotEnd = Number(slot.end24.split(":")[0]) * 60 + Number(slot.end24.split(":")[1]);
                                return examStartTotalMin >= slotStart && examStartTotalMin < slotEnd;
                              });

                              const rowSpan = Math.ceil((endMinutes - startMinutes) / 30);

                              console.log(`📏 Exam ${exam.examdetails_id}: ${examStartTime.toISOString().slice(11,16)}-${examEndTime.toISOString().slice(11,16)} → start=${startMinutes}min, end=${endMinutes}min, rowSpan=${rowSpan}, startSlotIndex=${startSlotIndex}`);

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
                                          options={(() => {
                                            const sectionInstructorId = exam.instructor_id;
                                            const availableUserPool = allCollegeUsers.length > 0 ? allCollegeUsers : users;

                                            // Get all instructors for the same course & program
                                            const candidateInstructors = availableUserPool.filter((instr) =>
                                              examData.some(
                                                (ex) =>
                                                  ex.course_id === exam.course_id &&
                                                  ex.program_id === exam.program_id &&
                                                  ex.instructor_id === instr.user_id
                                              )
                                            );

                                            const alternativeInstructors = candidateInstructors.filter(
                                              (instr) => Number(instr.user_id) !== Number(sectionInstructorId)
                                            );

                                            const eligibleUsers = alternativeInstructors.length > 0 
                                              ? alternativeInstructors 
                                              : availableUserPool.filter(u => u.user_id !== sectionInstructorId);

                                            // Filter out users with conflicting schedules
                                            const availableUsers = eligibleUsers.filter((p) => {
                                              const assignedExams = examData.filter(
                                                (ex) =>
                                                  ex.proctor_id === p.user_id &&
                                                  ex.examdetails_id !== exam.examdetails_id &&
                                                  ex.exam_date === exam.exam_date
                                              );

                                              return !assignedExams.some((ex) => {
                                                const startA = new Date(exam.exam_start_time!).getTime();
                                                const endA = new Date(exam.exam_end_time!).getTime();
                                                const startB = new Date(ex.exam_start_time!).getTime();
                                                const endB = new Date(ex.exam_end_time!).getTime();

                                                return startA < endB && endA > startB;
                                              });
                                            });

                                            return availableUsers.map((p) => ({
                                              value: p.user_id,
                                              label: `${p.first_name} ${p.last_name}${
                                                p.user_id === sectionInstructorId ? ' (Own Section)' : ''
                                              }`
                                            }));
                                          })()}
                                          placeholder="--Select Proctor--"
                                          isSearchable
                                          styles={{ menu: (provided) => ({ ...provided, zIndex: 9999 }) }}
                                        />
                                      ) : (
                                        // ✅ FIX: Always show proctor name, even in non-edit mode
                                        <span style={{ marginLeft: '5px' }}>
                                          {exam.proctor_id ? getUserName(exam.proctor_id) : "Not Assigned"}
                                        </span>
                                      )}
                                    </p>
                                    <p>{formatTo12Hour(exam.exam_start_time!.slice(11,16))} - {formatTo12Hour(exam.exam_end_time!.slice(11,16))}</p>
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
              );
            });
          })
        ) : (
          (() => {
            const rooms = Array.from(
              new Set(filteredExamData.map(e => e.room_id).filter(Boolean))
            ).sort((a, b) => {
              const numA = Number(a);
              const numB = Number(b);
              if (!isNaN(numA) && !isNaN(numB)) {
                return numA - numB;
              }
              return String(a).localeCompare(String(b), undefined, { numeric: true });
            });

            const singleDatePages = Math.max(1, Math.ceil(rooms.length / maxRoomColumns));

            return Array.from({ length: singleDatePages }).map((_, p) => {
              const pageRooms = rooms.slice(p * maxRoomColumns, (p + 1) * maxRoomColumns);
              const occupiedCells: Record<string, boolean> = {};
              
              const groupedData: Record<string, ExamDetail[]> = {};
              filteredExamData.forEach((exam) => {
                if (!exam.exam_date || !exam.room_id) return;
                const key = `${exam.exam_date}-${exam.room_id}`;
                if (!groupedData[key]) groupedData[key] = [];
                groupedData[key].push(exam);
              });

              return (
                <div
                  key={p}
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
                        src="../../static/logo/USTPlogo.png"
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
                    {uniqueDates.map((date) => (
                      <table key={date} className="exam-table">
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
                              const building = filteredExamData.find(e => e.room_id === (room ?? ""))?.building_name || "Unknown Building";
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
                                  
                                  // ✅ FIX: Parse the FULL ISO timestamp, not just time portion
                                  const examStartTime = new Date(e.exam_start_time);
                                  const examEndTime = new Date(e.exam_end_time);
                                  
                                  // Extract minutes from midnight of the exam date
                                  const examStart = examStartTime.getUTCHours() * 60 + examStartTime.getUTCMinutes();
                                  const examEnd = examEndTime.getUTCHours() * 60 + examEndTime.getUTCMinutes();
                                  
                                  const slotStart = Number(slot.start24.split(":")[0]) * 60 + Number(slot.start24.split(":")[1]);
                                  const slotEnd = Number(slot.end24.split(":")[0]) * 60 + Number(slot.end24.split(":")[1]);
                                  
                                  const matches = (examStart < slotEnd) && (examEnd > slotStart);
                                  
                                  // ✅ Debug log for first room only
                                  if (rowIndex < 3 && room === pageRooms[0]) {
                                    console.log(`🔍 Slot ${slot.start24}-${slot.end24} (${slotStart}-${slotEnd}min) vs Exam ${examStart}-${examEnd}min (${e.exam_start_time.slice(11, 16)}-${e.exam_end_time.slice(11, 16)}): ${matches ? '✅' : '❌'}`);
                                  }
                                  
                                  return matches;
                                });

                                if (!exam) return <td key={room}></td>;

                                const examStartTime = new Date(exam.exam_start_time!);
                                const examEndTime = new Date(exam.exam_end_time!);

                                const startMinutes = examStartTime.getUTCHours() * 60 + examStartTime.getUTCMinutes();
                                const endMinutes = examEndTime.getUTCHours() * 60 + examEndTime.getUTCMinutes();

                                const examStartHour = examStartTime.getUTCHours();
                                const examStartMin = examStartTime.getUTCMinutes();
                                const examStartTotalMin = examStartHour * 60 + examStartMin;

                                const startSlotIndex = timeSlots.findIndex(slot => {
                                  const slotStart = Number(slot.start24.split(":")[0]) * 60 + Number(slot.start24.split(":")[1]);
                                  const slotEnd = Number(slot.end24.split(":")[0]) * 60 + Number(slot.end24.split(":")[1]);
                                  return examStartTotalMin >= slotStart && examStartTotalMin < slotEnd;
                                });

                                const rowSpan = Math.ceil((endMinutes - startMinutes) / 30);

                                console.log(`📏 Exam ${exam.examdetails_id}: ${examStartTime.toISOString().slice(11,16)}-${examEndTime.toISOString().slice(11,16)} → start=${startMinutes}min, end=${endMinutes}min, rowSpan=${rowSpan}, startSlotIndex=${startSlotIndex}`);

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
                                        color: "#fff",
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
                                            options={(() => {
                                              const sectionInstructorId = exam.instructor_id;
                                              const availableUserPool = allCollegeUsers.length > 0 ? allCollegeUsers : users;

                                              // Get all instructors for the same course & program
                                              const candidateInstructors = availableUserPool.filter((instr) =>
                                                examData.some(
                                                  (ex) =>
                                                    ex.course_id === exam.course_id &&
                                                    ex.program_id === exam.program_id &&
                                                    ex.instructor_id === instr.user_id
                                                )
                                              );

                                              const alternativeInstructors = candidateInstructors.filter(
                                                (instr) => Number(instr.user_id) !== Number(sectionInstructorId)
                                              );

                                              const eligibleUsers = alternativeInstructors.length > 0 
                                                ? alternativeInstructors 
                                                : availableUserPool.filter(u => u.user_id !== sectionInstructorId);

                                              // Filter out users with conflicting schedules
                                              const availableUsers = eligibleUsers.filter((p) => {
                                                const assignedExams = examData.filter(
                                                  (ex) =>
                                                    ex.proctor_id === p.user_id &&
                                                    ex.examdetails_id !== exam.examdetails_id &&
                                                    ex.exam_date === exam.exam_date
                                                );

                                                return !assignedExams.some((ex) => {
                                                  const startA = new Date(exam.exam_start_time!).getTime();
                                                  const endA = new Date(exam.exam_end_time!).getTime();
                                                  const startB = new Date(ex.exam_start_time!).getTime();
                                                  const endB = new Date(ex.exam_end_time!).getTime();

                                                  return startA < endB && endA > startB;
                                                });
                                              });

                                              return availableUsers.map((p) => ({
                                                value: p.user_id,
                                                label: `${p.first_name} ${p.last_name}${
                                                  p.user_id === sectionInstructorId ? ' (Own Section)' : ''
                                                }`
                                              }));
                                            })()}
                                            placeholder="--Select Proctor--"
                                            isSearchable
                                            styles={{ menu: (provided) => ({ ...provided, zIndex: 9999 }) }}
                                          />
                                        ) : (
                                          // ✅ FIX: Always show proctor name, even in non-edit mode
                                          <span style={{ marginLeft: '5px' }}>
                                            {exam.proctor_id ? getUserName(exam.proctor_id) : "Not Assigned"}
                                          </span>
                                        )}
                                      </p>
                                      <p>{formatTo12Hour(exam.exam_start_time!.slice(11,16))} - {formatTo12Hour(exam.exam_end_time!.slice(11,16))}</p>
                                    </div>
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ))}
                  </div>
                </div>
              );
            });
          })()
        )}
        <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
          <AddScheduleForm 
            user={user} 
            onScheduleCreated={async () => {
              // Force immediate refresh with proper filtering
              try {
                // ✅ FIX: Add college_name filter
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

      {/* SMS Modal */}
      <Modal isOpen={showSmsModal} onClose={() => setShowSmsModal(false)}>
        <SmsSender user={user} onClose={() => setShowSmsModal(false)} collegeName={collegeName} />
      </Modal>

      {/* Email Modal */}
      <Modal isOpen={showEmailModal} onClose={() => setShowEmailModal(false)}>
        <EmailSender user={user} onClose={() => setShowEmailModal(false)} collegeName={collegeName} />
      </Modal>

      {/* Dean Modal */}
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

      {/* Export Modal */}
      <Modal isOpen={showExportModal} onClose={() => setShowExportModal(false)}>
        <ExportSchedule onClose={() => setShowExportModal(false)} collegeName={collegeName} />
      </Modal>

      <ToastContainer position="top-right" autoClose={1500} />
    </div>
  );
};

export default SchedulerView;