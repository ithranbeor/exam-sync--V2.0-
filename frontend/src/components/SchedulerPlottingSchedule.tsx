import React, { useEffect, useMemo, useState } from "react";
import { api } from '../lib/apiClient.ts';
import "../styles/SchedulerPlottingSchedule.css";
import Select, { components } from "react-select";
import { FaPlay, FaSpinner } from "react-icons/fa";
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import CreatableSelect from "react-select/creatable"

interface SchedulerProps {
  user: {
    user_id: number;
    email_address: string;
    contact_number: string;
  } | null;
  onScheduleCreated?: () => void;
}

interface Gene {
  sectionId: string | number;
  date: string;
  timeSlot: string;
  roomId: string;
  proctorId: number;
}

type Chromosome = Gene[];

interface GlobalTracker {
  roomOccupancy: Map<string, Array<{ start: number; end: number; sectionId: number }>>;
  proctorOccupancy: Map<string, Array<{ start: number; end: number; sectionId: number }>>;
  courseAssignments: Map<string, { date: string; timeSlot: string }>;
}

const SchedulerPlottingSchedule: React.FC<SchedulerProps> = ({ user, onScheduleCreated }) => {
  const [formData, setFormData] = useState({
    academic_year: "",
    exam_category: "",
    selectedPrograms: [] as string[],
    selectedCourses: [] as string[],
    selectedModalities: [] as number[],
    selectedExamDates: [] as string[],
  });

  const [examPeriods, setExamPeriods] = useState<any[]>([]);
  const [modalities, setModalities] = useState<any[]>([]);
  const [programs, setPrograms] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [terms, setTerms] = useState<any[]>([]);
  const [sectionCourses, setSectionCourses] = useState<any[]>([]);
  const [userCollegeIds, setUserCollegeIds] = useState<string[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [modalityPreviewSearchTerm, setModalityPreviewSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [schedulerCollegeName, setSchedulerCollegeName] = useState<string>("");

  const [roomsCache, setRoomsCache] = useState<any[]>([]);
  const [buildingsCache, setBuildingsCache] = useState<any[]>([]);
  const [collegesCache, setCollegesCache] = useState<any[]>([]);

  const [duration, setDuration] = useState({ hours: 1, minutes: 0 });
  const [selectedStartTime, setSelectedStartTime] = useState<string>("");

  const [alreadyScheduledIds, setAlreadyScheduledIds] = useState<Set<number>>(new Set());
  const [_checkingSchedules, setCheckingSchedules] = useState(false);
  const [allCollegeUsers, setAllCollegeUsers] = useState<any[]>([]);
  const [_proctors, setProctors] = useState<any[]>([]);

  const times = [
    "07:00", "07:30", "08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
    "12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30",
    "17:00", "17:30", "18:00", "18:30", "19:00", "19:30", "20:00", "20:30", "21:00"
  ];

  const hours = String(duration.hours).padStart(2, '0');
  const minutes = String(duration.minutes).padStart(2, '0');
  const formattedDuration = `${hours}:${minutes}:00`;

  useEffect(() => {
    const fetchAll = async () => {
      if (!user?.user_id) {
        console.warn("No user found — cannot fetch data.");
        return;
      }

      try {
        const collegesResponse = await api.get('/tbl_college/');
        const allColleges = collegesResponse.data;
        setCollegesCache(allColleges || []);

        // ---------------------------------------
        // 🔹 UPDATED ROLE FETCHING + PROCTOR FILTERING
        // ---------------------------------------
        const userRolesResponse = await api.get('/tbl_user_role', {
          params: {
            user_id: user.user_id,
            role_id: 3 // Scheduler role
          }
        });

        const userRoles: any[] = userRolesResponse.data || [];

        if (!userRoles || userRoles.length === 0) {
          alert("No scheduler role found. Contact administrator.");
          return;
        }

        const collegeIds = Array.from(new Set(
          userRoles.map((r: any) => String(r.college_id)).filter(Boolean)
        ));
        setUserCollegeIds(collegeIds);

        if (collegeIds.length === 0) {
          alert("No college assigned to your role.");
          return;
        }

        let schedulerCollegeName = "";
        if (collegeIds.length > 0) {
          const schedulerCollege = allColleges.find(
            (c: any) => String(c.college_id) === collegeIds[0]
          );
          schedulerCollegeName = schedulerCollege?.college_name || "";
          setSchedulerCollegeName(schedulerCollegeName);
        }

        const [
          examPeriodsResponse,
          departmentsResponse,
          programsResponse,
          termsResponse,
          sectionCoursesResponse,
          roomsResponse,
          buildingsResponse,
        ] = await Promise.all([
          api.get('/tbl_examperiod'),
          api.get('/departments/'),
          api.get('/programs/'),
          api.get('/tbl_term'),
          api.get('/tbl_sectioncourse/'),
          api.get('/tbl_rooms'),
          api.get('/tbl_buildings'),
        ]);

        const allExamPeriods = examPeriodsResponse.data;
        const allDepartments = departmentsResponse.data;
        const allPrograms = programsResponse.data;
        const trms = termsResponse.data;
        const sectCourses = sectionCoursesResponse.data;
        const rooms = roomsResponse.data;
        const buildings = buildingsResponse.data;

        const filteredDepartments = (allDepartments || []).filter((d: any) =>
          collegeIds.includes(String(d.college_id))
        );

        const allowedDeptIds = filteredDepartments.map((d: any) =>
          String(d.department_id)
        );

        const filteredPrograms = (allPrograms || []).filter((p: any) =>
          allowedDeptIds.includes(String(p.department_id))
        );

        const filteredExamPeriods = (allExamPeriods || []).filter((p: any) =>
          collegeIds.includes(String(p.college_id))
        );

        const filteredSectCourses = (sectCourses || []).filter((sc: any) => {
          const program = filteredPrograms.find((p: any) => p.program_id === sc.program_id);
          return program !== undefined;
        });

        // 🔹 Store filtered academic data
        setExamPeriods(filteredExamPeriods);
        setDepartments(filteredDepartments);
        setPrograms(filteredPrograms);
        setTerms(trms || []);
        setSectionCourses(filteredSectCourses);
        setRoomsCache(rooms || []);
        setBuildingsCache(buildings || []);

        // ----------------------------------------------------
        // 🔹 FIXED LOGIC: FILTER PROCTORS BY COLLEGE OR COLLEGE-THROUGH-DEPARTMENT
        // ----------------------------------------------------
        const proctorRolesResponse = await api.get('/tbl_user_role', {
          params: {
            role_id: 5, // Proctor Role
          },
        });

        const allProctorRoles = proctorRolesResponse.data || [];

        const filteredProctorRoles = allProctorRoles.filter((p: any) => {
          if (p.college_id && collegeIds.includes(String(p.college_id))) {
            return true;
          }
          if (p.department_id) {
            const dept = allDepartments?.find(
              (d: any) =>
                String(d.department_id) === String(p.department_id)
            );
            if (dept && collegeIds.includes(String(dept.college_id))) {
              return true;
            }
          }
          return false;
        });

        const proctorUserIds = Array.from(
          new Set(filteredProctorRoles.map((p: any) => p.user_id).filter(Boolean))
        );

        const usersResponse = await api.get('/users/');
        const allUsers = usersResponse.data;

        const userDetails = allUsers.filter((u: any) =>
          proctorUserIds.includes(u.user_id)
        );

        setAllCollegeUsers(userDetails || []);
        setProctors(userDetails || []);

        // ----------------------------------------------------

      } catch (err: any) {
        console.error("Failed to fetch data:", err);
        alert("Failed to fetch data");
      }
    };

    fetchAll();
  }, [user]);

  useEffect(() => {
    const fetchCoursesLazy = async () => {
      if (formData.selectedPrograms.length === 0) {
        setCourses([]);
        return;
      }

      try {
        const relevantSections = sectionCourses.filter(sc => 
          formData.selectedPrograms.includes(sc.program_id)
        );

        const courseIds = Array.from(new Set(relevantSections.map(sc => sc.course_id)));

        if (courseIds.length === 0) {
          setCourses([]);
          return;
        }

        const coursesResponse = await api.get('/courses/');
        const allCourses = coursesResponse.data || [];
        
        const filteredCourses = allCourses.filter((c: any) => courseIds.includes(c.course_id));

        setCourses(filteredCourses);
      } catch (error) {
        console.error("Error lazy loading courses:", error);
        setCourses([]);
      }
    };

    fetchCoursesLazy();
  }, [formData.selectedPrograms, sectionCourses]);

  useEffect(() => {
    const fetchModalitiesLazy = async () => {
      if (formData.selectedPrograms.length === 0 || formData.selectedCourses.length === 0) {
        setModalities([]);
        return;
      }

      try {
        const params = {
          program_id: formData.selectedPrograms.join(','),
          course_id: formData.selectedCourses.join(',')
        };

        const modalitiesResponse = await api.get('/tbl_modality/', { params });
        const mods = modalitiesResponse.data || [];
        
        const filteredMods = mods.filter((m: any) => {
          const isAllowedProgram = formData.selectedPrograms.includes(m.program_id);
          return isAllowedProgram;
        });

        setModalities(filteredMods);
      } catch (error) {
        console.error("Error lazy loading modalities:", error);
        setModalities([]);
      }
    };

    fetchModalitiesLazy();
  }, [formData.selectedPrograms, formData.selectedCourses, programs, departments, collegesCache, schedulerCollegeName]);

  useEffect(() => {
    const checkExistingSchedules = async () => {
      if (formData.selectedModalities.length === 0) {
        setAlreadyScheduledIds(new Set());
        return;
      }

      setCheckingSchedules(true);
      try {
        const response = await api.get('/tbl_examdetails', {
          params: {
            modality_id: formData.selectedModalities.join(',')
          }
        });

        const scheduled = new Set<number>(
          response.data.map((s: any) => Number(s.modality_id))
        );
        
        setAlreadyScheduledIds(scheduled);
        
        if (scheduled.size > 0) {
          console.log(`⚠️ ${scheduled.size} section(s) already scheduled`);
        }
      } catch (error) {
        console.error('Error checking schedules:', error);
      } finally {
        setCheckingSchedules(false);
      }
    };

    checkExistingSchedules();
  }, [formData.selectedModalities]);

  const termNameById = useMemo(() => {
    const map = new Map<number | string, string>();
    terms.forEach(t => map.set(t.term_id, t.term_name ?? String(t.term_id)));
    return map;
  }, [terms]);

  const uniqueAcademicYearTermOptions = useMemo(() => {
    const seen = new Set<string>();
    const options: { key: string; label: string; value: string }[] = [];
    examPeriods.forEach(p => {
      const termName = termNameById.get(p.term_id) ?? "Term";
      const key = `${p.academic_year}||${termName}`;
      if (!seen.has(key)) {
        seen.add(key);
        options.push({ key, label: `${p.academic_year} | ${termName}`, value: `${p.academic_year} | ${termName}` });
      }
    });
    return options;
  }, [examPeriods, termNameById]);

  const uniqueExamCategoryOptions = useMemo(() => {
    return Array.from(new Set(examPeriods.map(p => p.exam_category).filter(Boolean)));
  }, [examPeriods]);

  const formatLocal = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const examDateOptions = useMemo(() => {
    if (!examPeriods.length || !userCollegeIds.length) return [];
    const allowedPeriods = examPeriods.filter((p: any) => 
      userCollegeIds.includes(String(p.college_id))
    );
    const days: { key: string; iso: string; label: string }[] = [];

    allowedPeriods.forEach((period: any) => {
      if (!period.start_date || !period.end_date) return;
      const start = new Date(period.start_date);
      const end = new Date(period.end_date);
      
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const iso = formatLocal(new Date(d));
        const label = d.toLocaleDateString("en-US", { 
          year: "numeric", 
          month: "long", 
          day: "numeric" 
        });
        days.push({ 
          key: `${period.examperiod_id}-${iso}`, 
          iso, 
          label 
        });
      }
    });

    const seen = new Set<string>();
    return days.filter((d: any) => {
      if (seen.has(d.iso)) return false;
      seen.add(d.iso);
      return true;
    });
  }, [examPeriods, userCollegeIds]);

  const filteredCoursesByPrograms = useMemo(() => {
    if (formData.selectedPrograms.length === 0) return [];
    return courses;
  }, [formData.selectedPrograms, courses]);

  const filteredModalitiesBySelection = useMemo(() => {
    if (formData.selectedPrograms.length === 0 || formData.selectedCourses.length === 0) return [];
    return modalities.filter((m: any) =>
      formData.selectedPrograms.includes(m.program_id) && formData.selectedCourses.includes(m.course_id)
    );
  }, [formData.selectedPrograms, formData.selectedCourses, modalities]);

  useEffect(() => {
    if (filteredModalitiesBySelection.length > 0) {
      setFormData(prev => ({
        ...prev,
        selectedModalities: filteredModalitiesBySelection.map(m => m.modality_id)
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        selectedModalities: []
      }));
    }
  }, [filteredModalitiesBySelection]);

  useEffect(() => {
    if (uniqueAcademicYearTermOptions.length > 0 && !formData.academic_year) {
      setFormData(prev => ({ ...prev, academic_year: uniqueAcademicYearTermOptions[0].value }));
    }
    if (uniqueExamCategoryOptions.length > 0 && !formData.exam_category) {
      setFormData(prev => ({ ...prev, exam_category: uniqueExamCategoryOptions[0] }));
    }
  }, [uniqueAcademicYearTermOptions, uniqueExamCategoryOptions]);

  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================

  const timeToMinutes = (time: string): number => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  };

  const rangesOverlap = (start1: number, end1: number, start2: number, end2: number): boolean => {
    return start1 < end2 && start2 < end1;
  };

  const extractYearLevel = (sectionName: string | null | undefined): string => {
    if (!sectionName) return "Unknown";
    const match = sectionName.match(/(\d)/);
    return match ? match[1] : "Unknown";
  };

  const getTimeSlots = (startTime: string, durationMinutes: number): string[] => {
    const [startHour, startMinute] = startTime.split(":").map(Number);
    const slots: string[] = [];
    for (let m = 0; m < durationMinutes; m += 30) {
      const h = startHour + Math.floor((startMinute + m) / 60);
      const mi = (startMinute + m) % 60;
      slots.push(`${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}`);
    }
    return slots;
  };

  // ✅ NEW: Helper to check if resource is available
  const isResourceFree = (
    tracker: Map<string, Array<{ start: number; end: number; sectionId: number }>>,
    key: string,
    start: number,
    end: number
  ): boolean => {
    const ranges = tracker.get(key) || [];
    return !ranges.some(r => rangesOverlap(start, end, r.start, r.end));
  };

  // ✅ NEW: Helper to mark resource as occupied
  const markResourceOccupied = (
    tracker: Map<string, Array<{ start: number; end: number; sectionId: number }>>,
    key: string,
    start: number,
    end: number,
    sectionId: number
  ): void => {
    if (!tracker.has(key)) {
      tracker.set(key, []);
    }
    tracker.get(key)!.push({ start, end, sectionId });
  };

  // ============================================================================
  // GENERATE RANDOM CHROMOSOME - IMPROVED WITH CONFLICT TRACKING
  // ============================================================================

  const generateRandomChromosome = (
    allModalities: any[],
    sortedDates: string[],
    validTimes: string[],
    eveningTimeSlots: string[],
    modalityRoomsMap: Map<string | number, string[]>,
    totalDurationMinutes: number,
    getAvailableProctors: (date: string, time: string) => number[],
    modalityMap: Map<string | number, any>,
    courseDateAssignment: Map<string, string>
  ): Chromosome => {
    const chromosome: Chromosome = [];
    
    // ✅ NEW: Create global trackers for this chromosome
    const globalTracker: GlobalTracker = {
      roomOccupancy: new Map(),
      proctorOccupancy: new Map(),
      courseAssignments: new Map()
    };

    const scheduledModalities = new Set<string | number>();
    const globalTimeSlotYearLevels = new Map<string, Map<string, Set<string>>>();

    // Group sections by course+night status
    const sectionsByCourseType = new Map<string, any[]>();
    allModalities.forEach(section => {
      const isNightClass = section.is_night_class === "YES";
      const courseKey = isNightClass ? `${section.course_id}_NIGHT` : section.course_id;
      if (!sectionsByCourseType.has(courseKey)) sectionsByCourseType.set(courseKey, []);
      sectionsByCourseType.get(courseKey)!.push(section);
    });

    // ✅ IMPROVED: Assign one time slot per course type with GUARANTEED non-conflict
    const courseTypeTimeSlots = new Map<string, { date: string; timeSlot: string }>();
    
    sectionsByCourseType.forEach((sections, courseKey) => {
      const firstSection = sections[0];
      const isNightClass = firstSection.is_night_class === "YES";

      const validTimesForCourse = isNightClass
        ? eveningTimeSlots.filter(t => {
            const [h, m] = t.split(":").map(Number);
            const end = (h * 60 + m) + totalDurationMinutes;
            return end <= 21 * 60;
          })
        : validTimes.filter(t => !eveningTimeSlots.includes(t));

      const courseId = firstSection.course_id;
      let date = courseDateAssignment.get(courseId);
      if (!date || !sortedDates.includes(date)) {
        date = sortedDates[Math.floor(Math.random() * sortedDates.length)];
        courseDateAssignment.set(courseId, date);
      }

      // ✅ Try to find a time slot where ALL sections can fit without conflicts
      let foundTimeSlot = false;
      const shuffledTimeList = [...validTimesForCourse].sort(() => Math.random() - 0.5);
      
      for (const candidateTime of shuffledTimeList) {
        const startMinutes = timeToMinutes(candidateTime);
        const endMinutes = startMinutes + totalDurationMinutes;

        // Check if ALL sections can be scheduled at this time
        let canScheduleAll = true;
        
        for (const section of sections) {
          const suitableRooms = modalityRoomsMap.get(section.modality_id) || [];
          let foundRoom = false;
          
          for (const room of suitableRooms) {
            const roomDateKey = `${date}|${room}`;
            if (isResourceFree(globalTracker.roomOccupancy, roomDateKey, startMinutes, endMinutes)) {
              foundRoom = true;
              break;
            }
          }
          
          if (!foundRoom) {
            canScheduleAll = false;
            break;
          }
        }

        if (canScheduleAll) {
          courseTypeTimeSlots.set(courseKey, { date, timeSlot: candidateTime });
          globalTracker.courseAssignments.set(courseKey, { date, timeSlot: candidateTime });
          foundTimeSlot = true;
          break;
        }
      }

      // Fallback if no perfect match found
      if (!foundTimeSlot && validTimesForCourse.length > 0) {
        const timeSlot = shuffledTimeList[0];
        courseTypeTimeSlots.set(courseKey, { date, timeSlot });
        globalTracker.courseAssignments.set(courseKey, { date, timeSlot });
      }
    });

    // ✅ IMPROVED: Main scheduling loop with strict conflict checking
    allModalities.forEach(section => {
      if (scheduledModalities.has(section.modality_id)) return;
      if (!modalityMap.has(section.modality_id)) return;

      const isNightClass = section.is_night_class === "YES";
      const courseKey = isNightClass ? `${section.course_id}_NIGHT` : section.course_id;
      const assignment = courseTypeTimeSlots.get(courseKey);
      if (!assignment) return;

      const { date, timeSlot } = assignment;
      const startMinutes = timeToMinutes(timeSlot);
      const endMinutes = startMinutes + totalDurationMinutes;

      // ✅ IMPROVED: Find room with strict conflict checking
      let roomId = "";
      const suitableRooms = modalityRoomsMap.get(section.modality_id) || [];
      
      for (const room of [...suitableRooms].sort(() => Math.random() - 0.5)) {
        const roomDateKey = `${date}|${room}`;
        
        if (isResourceFree(globalTracker.roomOccupancy, roomDateKey, startMinutes, endMinutes)) {
          roomId = room;
          markResourceOccupied(globalTracker.roomOccupancy, roomDateKey, startMinutes, endMinutes, Number(section.modality_id));
          break;
        }
      }
      
      if (!roomId && suitableRooms.length > 0) {
        roomId = suitableRooms[Math.floor(Math.random() * suitableRooms.length)];
        const roomDateKey = `${date}|${roomId}`;
        markResourceOccupied(globalTracker.roomOccupancy, roomDateKey, startMinutes, endMinutes, Number(section.modality_id));
      }

      // Year-level tracking
      const yearLevel = extractYearLevel(section.section_name);
      const programId = section.program_id;
      const program = programs.find(p => p.program_id === programId);
      const departmentId = program ? String(program.department_id) : "unknown";
      const department = departments.find(d => String(d.department_id) === departmentId);
      const collegeId = department ? String(department.college_id) : "unknown";

      const examSlots: string[] = [];
      for (let offset = 0; offset < totalDurationMinutes; offset += 30) {
        const slotMinutes = startMinutes + offset;
        const h = Math.floor(slotMinutes / 60);
        const m = slotMinutes % 60;
        examSlots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
      }
      
      for (const slot of examSlots) {
        const globalKey = `${date}|${slot}`;
        if (!globalTimeSlotYearLevels.has(globalKey)) globalTimeSlotYearLevels.set(globalKey, new Map());
        const collegeYearMap = globalTimeSlotYearLevels.get(globalKey)!;
        if (!collegeYearMap.has(collegeId)) collegeYearMap.set(collegeId, new Set());
        collegeYearMap.get(collegeId)!.add(yearLevel);
      }

      // ✅ IMPROVED: Proctor assignment with strict conflict checking
      let proctorId = -1;
      const availableProctors = getAvailableProctors(date, timeSlot) || [];
      const shuffledProctors = [...availableProctors].sort(() => Math.random() - 0.5);

      // Priority 1: Night class instructor
      if (isNightClass && section.instructor_id) {
        const instrKey = `${date}|${section.instructor_id}`;
        if (availableProctors.includes(section.instructor_id) && 
            isResourceFree(globalTracker.proctorOccupancy, instrKey, startMinutes, endMinutes)) {
          proctorId = section.instructor_id;
          markResourceOccupied(globalTracker.proctorOccupancy, instrKey, startMinutes, endMinutes, Number(section.modality_id));
        }
      }

      // Priority 2: Find a free proctor
      if (proctorId === -1) {
        for (const pid of shuffledProctors) {
          const key = `${date}|${pid}`;
          if (isResourceFree(globalTracker.proctorOccupancy, key, startMinutes, endMinutes)) {
            proctorId = pid;
            markResourceOccupied(globalTracker.proctorOccupancy, key, startMinutes, endMinutes, Number(section.modality_id));
            break;
          }
        }
      }

      // Priority 3: Use section instructor
      if (proctorId === -1 && section.instructor_id) {
        const instrKey = `${date}|${section.instructor_id}`;
        if (isResourceFree(globalTracker.proctorOccupancy, instrKey, startMinutes, endMinutes)) {
          proctorId = section.instructor_id;
          markResourceOccupied(globalTracker.proctorOccupancy, instrKey, startMinutes, endMinutes, Number(section.modality_id));
        }
      }

      // Priority 4: Try instructors array
      if (proctorId === -1 && section.instructors && section.instructors.length > 0) {
        for (const instrId of section.instructors) {
          if (!instrId) continue;
          const instrKey = `${date}|${instrId}`;
          if (isResourceFree(globalTracker.proctorOccupancy, instrKey, startMinutes, endMinutes)) {
            proctorId = instrId;
            markResourceOccupied(globalTracker.proctorOccupancy, instrKey, startMinutes, endMinutes, Number(section.modality_id));
            break;
          }
        }
      }

      // Last resort placeholder
      if (proctorId === -1) {
        const FALLBACK_PROCTOR = -9999;
        proctorId = FALLBACK_PROCTOR;
        const key = `${date}|${FALLBACK_PROCTOR}`;
        markResourceOccupied(globalTracker.proctorOccupancy, key, startMinutes, endMinutes, Number(section.modality_id));
      }

      scheduledModalities.add(section.modality_id);
      chromosome.push({ sectionId: section.modality_id, date, timeSlot, roomId, proctorId });
    });

    return chromosome;
  };

  // Calculate fitness (keep existing implementation)
  const calculateFitness = (
    chromosome: Chromosome,
    sectionMap: Map<string | number, any>,
    totalDurationMinutes: number,
    programs: any[],
    departments: any[]
  ): number => {
    let fitness = 0;

    const roomTimeRanges = new Map<string, Array<{ start: number; end: number; sectionId: number }>>();
    const proctorTimeRanges = new Map<string, Array<{ start: number; end: number; sectionId: number; deptId: string }>>();
    const studentSchedule = new Map<string, Set<string>>();
    const sectionScheduledCount = new Map<string | number, number>();
    const yearLevelByTimeSlotAndCollege = new Map<string, Map<string, Set<string>>>();
    const courseDateAssignments = new Map<string, Set<string>>();
    const courseTimeSlots = new Map<string, Map<string, Set<string>>>();

    chromosome.forEach(gene => {
      const section = sectionMap.get(gene.sectionId);
      if (!section) return;

      const { date, timeSlot, roomId } = gene;
      let proctorId = gene.proctorId;
      const startMinutes = timeToMinutes(timeSlot);
      const endMinutes = startMinutes + totalDurationMinutes;
      const yearLevel = extractYearLevel(section.section_name);
      const courseId = section.course_id;
      const programId = section.program_id;

      const program = programs.find(p => p.program_id === programId);
      const departmentId = program ? String(program.department_id) : "unknown";
      const department = departments.find(d => String(d.department_id) === departmentId);
      const collegeId = department ? String(department.college_id) : "unknown";

      sectionScheduledCount.set(gene.sectionId, (sectionScheduledCount.get(gene.sectionId) || 0) + 1);
      if (sectionScheduledCount.get(gene.sectionId)! > 1) {
        fitness -= 10000;
      }

      if (!courseDateAssignments.has(courseId)) {
        courseDateAssignments.set(courseId, new Set());
      }
      courseDateAssignments.get(courseId)!.add(date);
      if (courseDateAssignments.get(courseId)!.size > 1) {
        fitness -= 25000;
      }

      if (!courseTimeSlots.has(courseId)) {
        courseTimeSlots.set(courseId, new Map());
      }
      if (!courseTimeSlots.get(courseId)!.has(date)) {
        courseTimeSlots.get(courseId)!.set(date, new Set());
      }
      const courseTimesForDate = courseTimeSlots.get(courseId)!.get(date)!;
      if (courseTimesForDate.size > 0) {
        const existingTimeSlot = Array.from(courseTimesForDate)[0];
        if (existingTimeSlot !== timeSlot) {
          fitness -= 15000;
        }
      }
      courseTimesForDate.add(timeSlot);

      const studentKey = `${yearLevel}-${programId}`;
      const timeSlots = getTimeSlots(timeSlot, totalDurationMinutes);
      timeSlots.forEach(slot => {
        const key = `${date}|${slot}`;
        if (!studentSchedule.has(key)) studentSchedule.set(key, new Set());
        if (studentSchedule.get(key)!.has(studentKey)) {
          fitness -= 5000;
        }
        studentSchedule.get(key)!.add(studentKey);
      });

      const timeSlotKey = `${date}|${timeSlot}`;
      if (!yearLevelByTimeSlotAndCollege.has(timeSlotKey)) {
        yearLevelByTimeSlotAndCollege.set(timeSlotKey, new Map());
      }
      const collegeMap = yearLevelByTimeSlotAndCollege.get(timeSlotKey)!;
      if (!collegeMap.has(collegeId)) {
        collegeMap.set(collegeId, new Set());
      }
      collegeMap.get(collegeId)!.add(yearLevel);
      
      if (collegeMap.get(collegeId)!.size > 1) {
        fitness -= 8000;
      }

      if (!roomId) {
        fitness -= 8000;
      } else {
        const roomDateKey = `${date}|${roomId}`;
        if (!roomTimeRanges.has(roomDateKey)) {
          roomTimeRanges.set(roomDateKey, []);
        }
        const existingRanges = roomTimeRanges.get(roomDateKey)!;
        existingRanges.forEach(existing => {
          if (rangesOverlap(startMinutes, endMinutes, existing.start, existing.end)) {
            fitness -= 20000;
          }
        });
        existingRanges.push({ start: startMinutes, end: endMinutes, sectionId: Number(gene.sectionId) });
      }

      if (proctorId === -1) {
        proctorId = -9999;
        const proctorDateKey = `${date}|${proctorId}`;
        if (!proctorTimeRanges.has(proctorDateKey)) {
          proctorTimeRanges.set(proctorDateKey, []);
        }
        proctorTimeRanges.get(proctorDateKey)!.push({ 
          start: startMinutes, 
          end: endMinutes, 
          sectionId: Number(gene.sectionId),
          deptId: departmentId
        });
      } else {
        const proctorDateKey = `${date}|${proctorId}`;
        if (!proctorTimeRanges.has(proctorDateKey)) {
          proctorTimeRanges.set(proctorDateKey, []);
        }
        const existingProctorRanges = proctorTimeRanges.get(proctorDateKey)!;
        
        existingProctorRanges.forEach(existing => {
          if (rangesOverlap(startMinutes, endMinutes, existing.start, existing.end)) {
            fitness -= 30000;
          }
        });
        
        existingProctorRanges.push({ 
          start: startMinutes, 
          end: endMinutes, 
          sectionId: Number(gene.sectionId),
          deptId: departmentId
        });
      }

      if (roomId && proctorId !== -1) {
        fitness += 1000;
      }
    });

    return fitness;
  };

  const tournamentSelection = (population: Chromosome[], fitnesses: number[], size: number = 3): Chromosome => {
    let best = Math.floor(Math.random() * population.length);
    for (let i = 1; i < size; i++) {
      const contestant = Math.floor(Math.random() * population.length);
      if (fitnesses[contestant] > fitnesses[best]) best = contestant;
    }
    return population[best].map(gene => ({ ...gene }));
  };

  const crossover = (parent1: Chromosome, parent2: Chromosome): [Chromosome, Chromosome] => {
    const child1: Chromosome = [];
    const child2: Chromosome = [];
    parent1.forEach((_, i) => {
      if (Math.random() < 0.5) {
        child1.push({ ...parent1[i] });
        child2.push({ ...parent2[i] });
      } else {
        child1.push({ ...parent2[i] });
        child2.push({ ...parent1[i] });
      }
    });
    return [child1, child2];
  };

  const mutate = (
    chromosome: Chromosome,
    sectionMap: Map<string | number, any>,
    sortedDates: string[],
    validTimes: string[],
    eveningTimeSlots: string[],
    modalityRoomsMap: Map<string | number, string[]>,
    getAvailableProctors: (date: string, time: string) => number[],
    mutationRate: number
  ): Chromosome => {
    
    const courseTypeTimeSlots = new Map<string, { date: string; timeSlot: string }>();
    
    chromosome.forEach(gene => {
      const section = sectionMap.get(gene.sectionId);
      if (section) {
        const isNightClass = section.is_night_class === "YES";
        const courseKey = isNightClass ? `${section.course_id}_NIGHT` : section.course_id;
        
        if (!courseTypeTimeSlots.has(courseKey)) {
          courseTypeTimeSlots.set(courseKey, { date: gene.date, timeSlot: gene.timeSlot });
        }
      }
    });

    const mutatedCourses = new Map<string, { date?: string; timeSlot?: string }>();

    chromosome.forEach(gene => {
      if (Math.random() >= mutationRate) return;
      
      const section = sectionMap.get(gene.sectionId);
      if (!section) return;

      const isNightClass = section.is_night_class === "YES";
      const courseKey = isNightClass ? `${section.course_id}_NIGHT` : section.course_id;
      
      if (mutatedCourses.has(courseKey)) return;

      const mutationType = Math.floor(Math.random() * 4);
      const validTimesForSection = isNightClass 
        ? eveningTimeSlots.filter(t => {
            const [h, m] = t.split(":").map(Number);
            const totalDurationMinutes = duration.hours * 60 + duration.minutes;
            const end = (h * 60 + m) + totalDurationMinutes;
            return end <= 21 * 60;
          })
        : validTimes;

      if (mutationType === 0 && Math.random() < 0.3) {
        const newDate = sortedDates[Math.floor(Math.random() * sortedDates.length)];
        mutatedCourses.set(courseKey, { date: newDate });
        courseTypeTimeSlots.set(courseKey, { date: newDate, timeSlot: gene.timeSlot });
        
      } else if (mutationType === 1) {
        const newTimeSlot = validTimesForSection[Math.floor(Math.random() * validTimesForSection.length)];
        mutatedCourses.set(courseKey, { timeSlot: newTimeSlot });
        courseTypeTimeSlots.set(courseKey, { date: gene.date, timeSlot: newTimeSlot });
      }
    });

    return chromosome.map(gene => {
      const section = sectionMap.get(gene.sectionId);
      if (!section) return { ...gene };

      const isNightClass = section.is_night_class === "YES";
      const courseKey = isNightClass ? `${section.course_id}_NIGHT` : section.course_id;
      const suitableRooms = modalityRoomsMap.get(gene.sectionId) || [];

      const courseMutation = mutatedCourses.get(courseKey);
      if (courseMutation) {
        let newGene = { ...gene };
        
        if (courseMutation.date) {
          newGene.date = courseMutation.date;
        }
        
        if (courseMutation.timeSlot) {
          newGene.timeSlot = courseMutation.timeSlot;
        }
        
        const availableProctors = getAvailableProctors(newGene.date, newGene.timeSlot);
        let newProctorId = -1;
        
        if (isNightClass && section.instructor_id && availableProctors.includes(section.instructor_id)) {
          newProctorId = section.instructor_id;
        } else {
          const shuffled = [...availableProctors].sort(() => Math.random() - 0.5);
          newProctorId = shuffled.length > 0 ? shuffled[0] : -1;
        }
        
        newGene.proctorId = newProctorId;
        return newGene;
      }

      if (Math.random() < mutationRate) {
        const mutationType = Math.floor(Math.random() * 4);
        
        if (mutationType === 2) {
          const newRoomId = suitableRooms.length > 0
            ? suitableRooms[Math.floor(Math.random() * suitableRooms.length)]
            : "";
          return { ...gene, roomId: newRoomId };
          
        } else if (mutationType === 3) {
          const availableProctors = getAvailableProctors(gene.date, gene.timeSlot);
          let newProctorId = -1;
          
          if (isNightClass && section.instructor_id && availableProctors.includes(section.instructor_id)) {
            newProctorId = section.instructor_id;
          } else {
            const shuffled = [...availableProctors].sort(() => Math.random() - 0.5);
            newProctorId = shuffled.length > 0 ? shuffled[0] : -1;
          }
          
          return { ...gene, proctorId: newProctorId };
        }
      }

      return { ...gene };
    });
  };

  // ============================================================================
  // MAIN SCHEDULING FUNCTION
  // ============================================================================

  const assignExamSchedules = async () => {

    if (allCollegeUsers.length === 0) {
      alert("No proctors found for your college. Please ensure proctors are assigned.");
      return;
    }

    console.log(`📋 Using ${allCollegeUsers.length} proctors from college: ${schedulerCollegeName}`);

    const POPULATION_SIZE = 50;
    const GENERATIONS = 100;
    const MUTATION_RATE = 0.25;
    const ELITE_SIZE = 5;
    const YIELD_EVERY_N_GENERATIONS = 10;

    const totalDurationMinutes = duration.hours * 60 + duration.minutes;

    let academicYear: string | null = null;
    let semester: string | null = null;
    if (formData.academic_year) {
      const [yearPart, semPart] = formData.academic_year.split("|").map(s => s.trim());
      academicYear = yearPart ?? null;
      semester = semPart ?? null;
    }

    const sortedDates = [...formData.selectedExamDates].sort();
    const examPeriod = sortedDates.length > 1
      ? `${new Date(sortedDates[0]).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} - ${new Date(sortedDates[sortedDates.length - 1]).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`
      : new Date(sortedDates[0]).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

    let allAvailability: any[] = [];
    try {
      const availResponse = await api.get('/tbl_availability/', {
        params: {
          status: 'available'
        }
      });
      allAvailability = availResponse.data;
    } catch (error) {
      console.error("Error fetching availability:", error);
      toast.error("Failed to fetch proctor availability");
      return;
    }

    const TIME_SLOT_RANGES: Record<string, string[]> = {
      "7 AM - 1 PM (Morning)": ["07:00", "07:30", "08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "12:30"],
      "1 PM - 6 PM (Afternoon)": ["13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30"],
      "6 PM - 9 PM (Evening)": ["18:00", "18:30", "19:00", "19:30", "20:00", "20:30"]
    };

    const getPeriodFromTime = (time: string | null | undefined): string | null => {
      if (!time) return null;
      const hour = parseInt(time.split(":")[0], 10);
      if (Number.isNaN(hour)) return null;
      if (hour >= 7 && hour < 13) return "7 AM - 1 PM (Morning)";
      if (hour >= 13 && hour < 18) return "1 PM - 6 PM (Afternoon)";
      if (hour >= 18 && hour < 21) return "6 PM - 9 PM (Evening)";
      return null;
    };

    const allAvailableTimeSlots = [
      ...TIME_SLOT_RANGES["7 AM - 1 PM (Morning)"],
      ...TIME_SLOT_RANGES["1 PM - 6 PM (Afternoon)"],
      ...TIME_SLOT_RANGES["6 PM - 9 PM (Evening)"]
    ];

    const availabilityMap = new Map<string, Set<number>>();

    allAvailability?.forEach(a => {
      const proctorId = a.user_id;
      const daysArray = a.days || [];
      const timeSlotsArray = a.time_slots || [];

      daysArray.forEach((dateStr: string) => {
        const isoDate = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
        timeSlotsArray.forEach((timeSlotEntry: string) => {
          // Normalize both raw time-slot (e.g., "07:00" or "07:00-12:00") and period name
          const rawKey = `${isoDate}|${timeSlotEntry}`;
          if (!availabilityMap.has(rawKey)) availabilityMap.set(rawKey, new Set());
          availabilityMap.get(rawKey)!.add(proctorId);

          // If timeSlotEntry looks like a single time (hh:mm), convert to period key too
          const periodName = getPeriodFromTime(timeSlotEntry);
          if (periodName) {
            const periodKey = `${isoDate}|${periodName}`;
            if (!availabilityMap.has(periodKey)) availabilityMap.set(periodKey, new Set());
            availabilityMap.get(periodKey)!.add(proctorId);
          }
        });
      });
    });

    const getAvailableProctors = (date: string, startTime: string): number[] => {
      const isoDate = date.includes('T') ? date.split('T')[0] : date;

      // 1) direct lookup by exact startTime
      const directKey = `${isoDate}|${startTime}`;
      if (availabilityMap.has(directKey)) {
        const proctors = Array.from(availabilityMap.get(directKey)!.values());
        // ✅ FIXED: Filter to only include proctors from scheduler's college
        return proctors.filter(pid => allCollegeUsers.some(u => u.user_id === pid));
      }

      // 2) lookup by period name
      const period = getPeriodFromTime(startTime);
      if (period) {
        const periodKey = `${isoDate}|${period}`;
        if (availabilityMap.has(periodKey)) {
          const proctors = Array.from(availabilityMap.get(periodKey)!.values());
          // ✅ FIXED: Filter to only include proctors from scheduler's college
          return proctors.filter(pid => allCollegeUsers.some(u => u.user_id === pid));
        }
      }

      // 3) last resort: gather any proctors on the date
      const anyDatePrefix = `${isoDate}|`;
      const proctors = new Set<number>();
      for (const [k, s] of availabilityMap.entries()) {
        if (k.startsWith(anyDatePrefix)) {
          s.forEach(p => proctors.add(p));
        }
      }
      
      // ✅ FIXED: Filter to only include proctors from scheduler's college
      return Array.from(proctors).filter(pid => allCollegeUsers.some(u => u.user_id === pid));
    };

    const roomCapacityMap = new Map<string, number>();
    roomsCache.forEach(r => roomCapacityMap.set(r.room_id, r.room_capacity));

    const buildingMap = new Map<string, string>();
    buildingsCache.forEach(b => buildingMap.set(b.building_id, b.building_name));

    const roomToBuildingMap = new Map<string, string>();
    roomsCache.forEach(r => roomToBuildingMap.set(r.room_id, r.building_id));

    const schedulerCollegeId = userCollegeIds[0];
    const collegeObj = collegesCache?.find(c => c.college_id === schedulerCollegeId);
    const collegeNameForCourse = collegeObj?.college_name ?? "Unknown College";

    const allModalities: any[] = [];
    const modalityMap = new Map<string | number, any>();

    formData.selectedModalities.forEach(modalityId => {
      const selectedModality = modalities.find(m => m.modality_id === modalityId);
      if (selectedModality) {
        const sections = Array.isArray(selectedModality.sections) 
          ? selectedModality.sections 
          : [selectedModality.section_name];
        
        const instructorIds = sections.map((sectionName: string) => {
          const sectionCourseData = sectionCourses.find(
            sc => sc.program_id === selectedModality.program_id &&
                  sc.course_id === selectedModality.course_id &&
                  sc.section_name === sectionName
          );
          return sectionCourseData?.user_id ?? null;
        }).filter(Boolean);

        const uniqueInstructorIds: number[] = instructorIds.filter((id: number, index: number) => 
          instructorIds.indexOf(id) === index
        );
        
        const isNightClass = sections.some((sectionName: string) => {
          const sectionCourseData = sectionCourses.find(
            sc => sc.program_id === selectedModality.program_id &&
                  sc.course_id === selectedModality.course_id &&
                  sc.section_name === sectionName
          );
          return sectionCourseData?.is_night_class === "YES";
        });
        
        const enrichedModality = {
          ...selectedModality,
          sections: sections,
          instructors: uniqueInstructorIds,
          is_night_class: isNightClass ? "YES" : "NO",
          enrolled_students: selectedModality.total_students ?? 0
        };
        
        allModalities.push(enrichedModality);
        modalityMap.set(modalityId, enrichedModality);
      }
    });

    const eveningTimeSlots = TIME_SLOT_RANGES["6 PM - 9 PM (Evening)"];

    const isValidTimeSlot = (startTime: string, isNightClass: boolean): boolean => {
      if (!allAvailableTimeSlots.includes(startTime)) {
        return false;
      }

      const [startHour, startMinute] = startTime.split(":").map(Number);
      const endMinutes = (startHour * 60 + startMinute) + totalDurationMinutes;
      const maxEndTime = 21 * 60;
      
      if (endMinutes > maxEndTime) {
        return false;
      }
      
      if (isNightClass) {
        return eveningTimeSlots.includes(startTime);
      }

      return true;
    };

    const validTimes = allAvailableTimeSlots.filter(t => isValidTimeSlot(t, false));

    const modalityRoomsMap = new Map<string | number, string[]>();
    allModalities.forEach(modality => {
      const possibleRooms = modality.possible_rooms ?? [];
      modalityRoomsMap.set(modality.modality_id, possibleRooms);
    });

    // Pre-validation
    const violations: string[] = [];

    allModalities.forEach(section => {
      const enrolledCount = section.enrolled_students ?? 0;
      const suitableRooms = modalityRoomsMap.get(section.modality_id) || [];
      
      if (suitableRooms.length === 0) {
        violations.push(
          `Section ${section.course_id} - ${section.section_name} has no suitable rooms.\n` +
          `Required capacity: ${enrolledCount} students`
        );
      }
      
      if (Array.isArray(section.sections) && section.sections.length > 1) {
        const totalStudents = section.total_students || enrolledCount;
        
        for (const roomId of suitableRooms) {
          const room = roomsCache.find(r => r.room_id === roomId);
          const roomCapacity = room?.room_capacity || 0;
          
          if (totalStudents > roomCapacity) {
            violations.push(
              `Grouped sections for ${section.course_id} exceed room capacity:\n` +
              `Sections: ${section.sections.join(', ')}\n` +
              `Total Students: ${totalStudents}\n` +
              `Room ${roomId} Capacity: ${roomCapacity}`
            );
          }
        }
      }
    });

    const datesWithoutProctors: string[] = [];
    sortedDates.forEach(date => {
      const isoDate = date.includes('T') ? date.split('T')[0] : date;
      
      let hasAnyProctors = false;
      for (const timeSlot of validTimes) {
        const proctors = getAvailableProctors(isoDate, timeSlot);
        if (proctors.length > 0) {
          hasAnyProctors = true;
          break;
        }
      }
      if (!hasAnyProctors) {
        const formattedDate = new Date(date).toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        });
        datesWithoutProctors.push(formattedDate);
      }
    });

    if (datesWithoutProctors.length > 0) {
      const formattedDates = datesWithoutProctors.join(", ");
      violations.push(`No proctors available for: ${formattedDates}`);
    }

    allModalities.forEach(section => {
      if (section.is_night_class === "YES") {
        const validEveningSlots = eveningTimeSlots.filter(slot => {
          const [h, m] = slot.split(":").map(Number);
          const end = (h * 60 + m) + totalDurationMinutes;
          return end <= 21 * 60;
        });
        
        if (validEveningSlots.length === 0) {
          violations.push(
            `Night class ${section.course_id} - ${section.section_name} cannot be scheduled`
          );
        }
      }
    });

    if (violations.length > 0) {
      alert(`Cannot generate schedule:\n\n${violations.join("\n\n")}`);
      return;
    }

    try {
      const modalityIds = formData.selectedModalities;
      const existingSchedulesResponse = await api.get('/tbl_examdetails', {
        params: {
          modality_id: modalityIds.join(',')
        }
      });
      
      const existingSchedules = existingSchedulesResponse.data || [];
      
      if (existingSchedules.length > 0) {
        alert(`Cannot generate schedule - sections already scheduled`);
        return;
      }
    } catch (error) {
      console.error('Error checking for existing schedules:', error);
      toast.error('Failed to check for existing schedules');
      return;
    }

    const courseDateAssignment = new Map<string, string>();
    const sectionsByCourse = new Map<string, any[]>();
    allModalities.forEach(section => {
      const courseId = section.course_id;
      if (!sectionsByCourse.has(courseId)) {
        sectionsByCourse.set(courseId, []);
      }
      sectionsByCourse.get(courseId)!.push(section);
    });

    Array.from(sectionsByCourse.keys()).forEach(courseId => {
      const randomDate = sortedDates[Math.floor(Math.random() * sortedDates.length)];
      courseDateAssignment.set(courseId, randomDate);
    });
    
    let population: Chromosome[] = [];
    for (let i = 0; i < POPULATION_SIZE; i++) {
      population.push(generateRandomChromosome(
        allModalities,
        sortedDates,
        validTimes,
        eveningTimeSlots,
        modalityRoomsMap,
        totalDurationMinutes,
        getAvailableProctors,
        modalityMap,
        courseDateAssignment
      ));
    }

    let bestChromosome: Chromosome | null = null;
    let bestFitness = -Infinity;

    for (let generation = 0; generation < GENERATIONS; generation++) {
      if (generation % YIELD_EVERY_N_GENERATIONS === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }

      const fitnesses = population.map(c => calculateFitness(c, modalityMap, totalDurationMinutes, programs, departments));
      const currentBestIdx = fitnesses.indexOf(Math.max(...fitnesses));
      
      if (fitnesses[currentBestIdx] > bestFitness) {
        bestFitness = fitnesses[currentBestIdx];
        bestChromosome = population[currentBestIdx];
        if (generation % 20 === 0) {
          console.log(`Generation ${generation}: Best fitness = ${bestFitness}`);
        }
      }

      const nextPopulation: Chromosome[] = [];
      const sortedIndices = fitnesses
        .map((fit, idx) => ({ fit, idx }))
        .sort((a, b) => b.fit - a.fit)
        .map(x => x.idx);

      for (let i = 0; i < ELITE_SIZE; i++) {
        nextPopulation.push(population[sortedIndices[i]].map(gene => ({ ...gene })));
      }

      while (nextPopulation.length < POPULATION_SIZE) {
        const parent1 = tournamentSelection(population, fitnesses);
        const parent2 = tournamentSelection(population, fitnesses);
        const [child1, child2] = crossover(parent1, parent2);
        nextPopulation.push(mutate(child1, modalityMap, sortedDates, validTimes, eveningTimeSlots, modalityRoomsMap, getAvailableProctors, MUTATION_RATE));
        if (nextPopulation.length < POPULATION_SIZE) {
          nextPopulation.push(mutate(child2, modalityMap, sortedDates, validTimes, eveningTimeSlots, modalityRoomsMap, getAvailableProctors, MUTATION_RATE));
        }
      }

      population = nextPopulation;
    }

    if (!bestChromosome) {
      alert("Could not find a valid schedule.");
      return;
    }

    // ✅ IMPROVED: Convert to schedule with STRICT validation
    const scheduledExams: any[] = [];
    const unscheduledSections: string[] = [];
    
    // ✅ NEW: Use global tracker for final validation
    const finalTracker: GlobalTracker = {
      roomOccupancy: new Map(),
      proctorOccupancy: new Map(),
      courseAssignments: new Map()
    };

    const finalCourseDates = new Map<string, Set<string>>();

    for (const gene of bestChromosome) {
      const section = modalityMap.get(gene.sectionId);
      if (!section) continue;

      const { date, timeSlot, roomId, proctorId } = gene;
      const courseId = section.course_id;

      if (!allAvailableTimeSlots.includes(timeSlot)) {
        unscheduledSections.push(`${section.course_id} - ${section.section_name} (invalid time slot)`);
        continue;
      }

      const startMinutes = timeToMinutes(timeSlot);
      const endMinutes = startMinutes + totalDurationMinutes;
      
      if (endMinutes > 21 * 60) {
        unscheduledSections.push(`${section.course_id} - ${section.section_name} (would end after 9 PM)`);
        continue;
      }

      // ✅ IMPROVED: Strict validation
      if (!roomId || roomId.trim() === "" || proctorId === -1) {
        unscheduledSections.push(`${section.course_id} - ${section.section_name} (missing room or proctor)`);
        continue;
      }

      // ✅ Check course date consistency
      if (!finalCourseDates.has(courseId)) {
        finalCourseDates.set(courseId, new Set());
      }
      finalCourseDates.get(courseId)!.add(date);

      if (finalCourseDates.get(courseId)!.size > 1) {
        unscheduledSections.push(`${section.course_id} - ${section.section_name} (course split across dates)`);
        continue;
      }

      // ✅ STRICT: Check room conflicts
      const roomDateKey = `${date}|${roomId}`;
      if (!isResourceFree(finalTracker.roomOccupancy, roomDateKey, startMinutes, endMinutes)) {
        console.error(`❌ ROOM CONFLICT: Room ${roomId} already occupied at ${date} ${timeSlot}`);
        unscheduledSections.push(`${section.course_id} - ${section.section_name} (room conflict)`);
        continue;
      }

      // ✅ STRICT: Check proctor conflicts
      const proctorDateKey = `${date}|${proctorId}`;
      if (!isResourceFree(finalTracker.proctorOccupancy, proctorDateKey, startMinutes, endMinutes)) {
        console.error(`❌ PROCTOR CONFLICT: Proctor ${proctorId} already assigned at ${date} ${timeSlot}`);
        unscheduledSections.push(`${section.course_id} - ${section.section_name} (proctor conflict)`);
        continue;
      }

      // ✅ Mark resources as occupied
      markResourceOccupied(finalTracker.roomOccupancy, roomDateKey, startMinutes, endMinutes, Number(section.modality_id));
      markResourceOccupied(finalTracker.proctorOccupancy, proctorDateKey, startMinutes, endMinutes, Number(section.modality_id));

      const examDate = new Date(date);
      const matchedPeriod = examPeriods.find(p => {
        const periodStart = new Date(p.start_date);
        const periodEnd = new Date(p.end_date);
        periodStart.setHours(0, 0, 0, 0);
        periodEnd.setHours(23, 59, 59, 999);
        examDate.setHours(12, 0, 0, 0);
        return examDate >= periodStart && examDate <= periodEnd;
      });

      if (!matchedPeriod) {
        unscheduledSections.push(`${section.course_id} - ${section.section_name} (no matching exam period)`);
        continue;
      }

      const [startHour, startMinute] = timeSlot.split(":").map(Number);
      const endHour = startHour + Math.floor((startMinute + totalDurationMinutes) / 60);
      const endMinute = (startMinute + totalDurationMinutes) % 60;
      const endTime = `${String(endHour).padStart(2, "0")}:${String(endMinute).padStart(2, "0")}`;

      const startTimestamp = `${date}T${timeSlot}:00`;
      const endTimestamp = `${date}T${endTime}:00`;

      const buildingId = roomToBuildingMap.get(roomId);
      const buildingName = buildingId ? buildingMap.get(buildingId) : "Unknown Building";

      // ✅ Build proctors array for grouped sections
      const proctorsArray: number[] = [];
      const availableForAssignment = getAvailableProctors(date, timeSlot);

      for (let i = 0; i < section.sections.length; i++) {
        let sectionProctor = -1;
        
        const availableForSection = availableForAssignment.filter(pid => 
          !proctorsArray.includes(pid) &&
          isResourceFree(finalTracker.proctorOccupancy, `${date}|${pid}`, startMinutes, endMinutes)
        );
        
        if (availableForSection.length > 0) {
          sectionProctor = availableForSection[Math.floor(Math.random() * availableForSection.length)];
          markResourceOccupied(finalTracker.proctorOccupancy, `${date}|${sectionProctor}`, startMinutes, endMinutes, Number(section.modality_id));
        } else {
          const sectionInstructor = section.instructors[i];
          if (sectionInstructor && isResourceFree(finalTracker.proctorOccupancy, `${date}|${sectionInstructor}`, startMinutes, endMinutes)) {
            sectionProctor = sectionInstructor;
            markResourceOccupied(finalTracker.proctorOccupancy, `${date}|${sectionProctor}`, startMinutes, endMinutes, Number(section.modality_id));
          } else {
            sectionProctor = -9999;
          }
        }
        
        proctorsArray.push(sectionProctor);
      }

      const canonicalProctorId =
        Array.isArray(proctorsArray) && proctorsArray.length > 0
          ? (proctorsArray[0] === -9999 ? null : proctorsArray[0])
          : (proctorId === -1 || proctorId === -9999 ? null : proctorId);

      scheduledExams.push({
        program_id: section.program_id,
        course_id: section.course_id,
        modality_id: section.modality_id,
        room_id: roomId,

        sections: section.sections,
        instructors: section.instructors,
        proctors: proctorsArray,

        instructors_display: (() => {
          const uniqueInstructors: number[] = [];
          section.instructors.forEach((instrId: number) => {
            if (instrId && !uniqueInstructors.includes(instrId)) {
              uniqueInstructors.push(instrId);
            }
          });
          return uniqueInstructors;
        })(),

        section_name: section.sections[0],
        instructor_id: section.instructors[0] ?? null,

        // 🔥 Replace proctor_id here
        proctor_id: canonicalProctorId,

        examperiod_id: matchedPeriod.examperiod_id,
        exam_date: date,
        exam_start_time: startTimestamp,
        exam_end_time: endTimestamp,
        exam_duration: formattedDuration,
        academic_year: academicYear,
        semester: semester,
        exam_category: formData.exam_category ?? null,
        exam_period: examPeriod,
        college_name: collegeNameForCourse,
        building_name: `${buildingName} (${buildingId})`,
        proctor_timein: null,
        proctor_timeout: null,
      });
    }

    console.log(`✅ Successfully scheduled ${scheduledExams.length}/${allModalities.length} sections`);
    console.log(`❌ Failed to schedule ${unscheduledSections.length} sections`);

    // ---------- GREEDY FALLBACK: attempt to schedule unscheduled sections ----------
    if (unscheduledSections.length > 0) {
      const sectionKey = (s: any) => `${s.course_id}|${s.section_name}|${s.modality_id}`;

      const modalityKeyMap = new Map<string, any>();
      allModalities.forEach(m => modalityKeyMap.set(sectionKey(m), m));

      const pendingSections = unscheduledSections.map(itemStr => {
        const match = itemStr.match(/^(.+?) - (.+?) \(/);
        if (!match) return null;
        const [_, courseId, sectionName] = match;
        return allModalities.find(m => m.course_id === courseId && m.sections?.[0] === sectionName) ?? null;
      }).filter(Boolean);

      for (const section of pendingSections) {
        let placed = false;
        const suitableRooms = modalityRoomsMap.get(section.modality_id) ?? [];
        const neededProctors = Array.isArray(section.sections) ? section.sections.length : 1;

        // iterate dates and valid times (try to assign earliest possible)
        for (const date of sortedDates) {
          if (placed) break;
          for (const timeSlot of validTimes) {
            if (!isValidTimeSlot(timeSlot, section.is_night_class === "YES")) continue;

            const startMinutes = timeToMinutes(timeSlot);
            const endMinutes = startMinutes + totalDurationMinutes;
            if (endMinutes > 21 * 60) continue;

            // iterate rooms
            for (const roomId of suitableRooms) {
              const roomDateKey = `${date}|${roomId}`;
              if (!isResourceFree(finalTracker.roomOccupancy, roomDateKey, startMinutes, endMinutes)) continue;

              // get available proctors for this date/time
              const availableProctors = getAvailableProctors(date, timeSlot)
                  .filter(pid => isResourceFree(finalTracker.proctorOccupancy, `${date}|${pid}`, startMinutes, endMinutes));

              // try to pick distinct proctors or fall back to instructors
              const selectedProctors: number[] = [];
              for (const pid of availableProctors) {
                if (selectedProctors.length >= neededProctors) break;
                selectedProctors.push(pid);
              }

              // If not enough proctors, try to use instructors (if allowed)
              if (selectedProctors.length < neededProctors) {
                for (let idx = 0; idx < section.sections.length && selectedProctors.length < neededProctors; idx++) {
                  const instr = section.instructors?.[idx];
                  if (instr && isResourceFree(finalTracker.proctorOccupancy, `${date}|${instr}`, startMinutes, endMinutes)) {
                    selectedProctors.push(instr);
                  }
                }
              }

              if (selectedProctors.length < neededProctors) {
                // cannot fill required proctors for this room/time
                continue;
              }

              // all good — mark occupied and push a new scheduled entry
              markResourceOccupied(finalTracker.roomOccupancy, roomDateKey, startMinutes, endMinutes, Number(section.modality_id));
              selectedProctors.forEach(pid => markResourceOccupied(finalTracker.proctorOccupancy, `${date}|${pid}`, startMinutes, endMinutes, Number(section.modality_id)));

              // build timestamps
              const [startHour, startMinute] = timeSlot.split(":").map(Number);
              const endHour = startHour + Math.floor((startMinute + totalDurationMinutes) / 60);
              const endMinute = (startMinute + totalDurationMinutes) % 60;
              const endTime = `${String(endHour).padStart(2, "0")}:${String(endMinute).padStart(2, "0")}`;
              const startTimestamp = `${date}T${timeSlot}:00`;
              const endTimestamp = `${date}T${endTime}:00`;

              const buildingId = roomToBuildingMap.get(roomId);
              const buildingName = buildingId ? buildingMap.get(buildingId) : "Unknown Building";
              const matchedPeriod = examPeriods.find(p => {
                const periodStart = new Date(p.start_date);
                const periodEnd = new Date(p.end_date);
                periodStart.setHours(0, 0, 0, 0);
                periodEnd.setHours(23, 59, 59, 999);
                const examDate = new Date(date);
                examDate.setHours(12, 0, 0, 0);
                return examDate >= periodStart && examDate <= periodEnd;
              });

              if (!matchedPeriod) continue;

              scheduledExams.push({
                program_id: section.program_id,
                course_id: section.course_id,
                modality_id: section.modality_id,
                room_id: roomId,
                sections: section.sections,
                instructors: section.instructors,
                proctors: selectedProctors,
                instructors_display: (() => {
                  const uniqueInstructors: number[] = [];
                  section.instructors.forEach((instrId: number) => {
                    if (instrId && !uniqueInstructors.includes(instrId)) uniqueInstructors.push(instrId);
                  });
                  return uniqueInstructors;
                })(),
                section_name: section.sections[0],
                instructor_id: section.instructors[0] ?? null,
                proctor_id: selectedProctors[0] ?? null,
                examperiod_id: matchedPeriod.examperiod_id,
                exam_date: date,
                exam_start_time: startTimestamp,
                exam_end_time: endTimestamp,
                exam_duration: formattedDuration,
                academic_year: academicYear,
                semester: semester,
                exam_category: formData.exam_category ?? null,
                exam_period: examPeriod,
                college_name: collegeNameForCourse,
                building_name: `${buildingName} (${buildingId})`,
                proctor_timein: null,
                proctor_timeout: null,
              });

              placed = true;
              break;
            }

            if (placed) break;
          }
        } 

        if (placed) {
          const msgIndex = unscheduledSections.findIndex(s => s.includes(`${section.course_id} - ${section.sections[0]}`));
          if (msgIndex !== -1) unscheduledSections.splice(msgIndex, 1);
        }
      }
    }

    if (scheduledExams.length === 0) {
      alert("No valid schedules to save.");
      return;
    }

    try {
      await api.post('/tbl_examdetails', scheduledExams);
      toast.success(`Successfully scheduled ${scheduledExams.length} section(s)!`);
      
      if (onScheduleCreated) {
        setTimeout(() => {
          onScheduleCreated();
        }, 1000);
      }
    } catch (error: any) {
      console.error("Database error:", error);
      const errorMessage = error.response?.data?.error || error.message || "Unknown error";
      alert("Error saving schedule: " + errorMessage);
    }
  };

  const handleSaveClick = async () => {
    if (!formData.selectedPrograms.length || !formData.selectedCourses.length || !formData.selectedModalities.length) {
      alert("Please complete program, course, and modality selection.");
      return;
    }
    if (!formData.selectedExamDates.length) {
      alert("Please select at least one exam date.");
      return;
    }

    setLoading(true);
    try {
      await assignExamSchedules();
    } finally {
      setLoading(false);
    }
  };

  type NamedValueEvent = { target: { name: string; value: any } };

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement> | NamedValueEvent) => {
    const { name, value } = (e as any).target;
    if (typeof name === "undefined") return;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const CheckboxOption = (props: any) => (
    <components.Option {...props}>
      <input type="checkbox" checked={props.isSelected} onChange={() => null} />{" "}
      <label>{props.label}</label>
    </components.Option>
  );

  const addSelectAllOption = (options: any[], label = "Select All") => [
    { value: "__all__", label },
    ...options,
  ];

  const sortedPrograms = [...programs].sort((a, b) =>
    a.program_id.toString().localeCompare(b.program_id.toString(), undefined, { numeric: true })
  );

  const sortedCourses = [...filteredCoursesByPrograms].sort((a, b) =>
    a.course_id.toString().localeCompare(b.course_id.toString(), undefined, { numeric: true })
  );

  return (
    <div className="scheduler-container">
      <h2 className="scheduler-header">Generate Schedule</h2>
      <div className="main-content-layout">
        <div className="form-column">
          <div className="field">
            <label className="label">Academic Year & Semester</label>
            <CreatableSelect
              name="academic_year"
              value={
                formData.academic_year
                  ? { value: formData.academic_year, label: formData.academic_year }
                  : null
              }
              onChange={(selected) =>
                handleChange({
                  target: { name: "academic_year", value: selected ? selected.value : "" },
                })
              }
              options={uniqueAcademicYearTermOptions.map((o) => ({
                value: o.value,
                label: o.label,
              }))}
              placeholder="Select or type Academic Year & Semester"
              classNamePrefix="select"
              isClearable
              formatCreateLabel={(inputValue) =>
                `Use custom value: "${inputValue}"`
              }
            />
          </div>

          {/* Exam Term */}
          <div className="field">
            <label className="label">Exam Term</label>
            <CreatableSelect
              name="exam_category"
              value={
                formData.exam_category
                  ? { value: formData.exam_category, label: formData.exam_category }
                  : null
              }
              onChange={(selected) =>
                handleChange({
                  target: { name: "exam_category", value: selected ? selected.value : "" },
                })
              }
              options={uniqueExamCategoryOptions.map((cat) => ({
                value: cat,
                label: cat,
              }))}
              placeholder="Select or type Exam Term"
              classNamePrefix="select"
              isClearable
              formatCreateLabel={(inputValue) =>
                `Use custom value: "${inputValue}"`
              }
            />
          </div>

          <div className="field">
            <label className="label">Select Exam Dates</label>
            <Select
              options={addSelectAllOption(examDateOptions.map(d => ({ value: d.iso, label: d.label })))}
              isMulti
              closeMenuOnSelect={false}
              hideSelectedOptions={false}
              components={{ Option: CheckboxOption }}
              onChange={(selected) => {
                let selectedValues = (selected as any[]).map(s => s.value);
                if (selectedValues.includes("__all__")) {
                  selectedValues = [...examDateOptions.map(d => d.iso)];
                }
                setFormData(prev => ({
                  ...prev,
                  selectedExamDates: selectedValues.filter(v => v !== "__all__"),
                }));
              }}
              value={formData.selectedExamDates.map(d => {
                const opt = examDateOptions.find(o => o.iso === d);
                return { value: d, label: opt?.label ?? d };
              })}
            />
          </div>

          <div className="field">
            <label className="label">Program</label>
            <Select
              options={addSelectAllOption(
                sortedPrograms.map(p => ({
                  value: p.program_id,
                  label: `${p.program_id} | ${p.program_name}`
                }))
              )}
              isMulti
              closeMenuOnSelect={false}
              hideSelectedOptions={false}
              components={{ Option: CheckboxOption }}
              onChange={(selected) => {
                let selectedValues = (selected as any[]).map(s => s.value);
                if (selectedValues.includes("__all__")) {
                  selectedValues = [...sortedPrograms.map(p => p.program_id)];
                }
                setFormData(prev => ({
                  ...prev,
                  selectedPrograms: selectedValues.filter(v => v !== "__all__"),
                  selectedCourses: [],
                  selectedModalities: [],
                }));
              }}
              value={formData.selectedPrograms.map(p => {
                const prog = sortedPrograms.find(f => f.program_id === p);
                return { value: p, label: prog ? `${prog.program_id} | ${prog.program_name}` : p };
              })}
            />
          </div>

          <div className="field">
            <label className="label">Course</label>
            <Select
              options={addSelectAllOption(
                sortedCourses.map(c => ({
                  value: c.course_id,
                  label: `${c.course_id} | ${c.course_name}`
                }))
              )}
              isMulti
              closeMenuOnSelect={false}
              hideSelectedOptions={false}
              components={{ Option: CheckboxOption }}
              onChange={(selected) => {
                let selectedValues = (selected as any[]).map(s => s.value);
                if (selectedValues.includes("__all__")) {
                  selectedValues = [...sortedCourses.map(c => c.course_id)];
                }
                setFormData(prev => ({
                  ...prev,
                  selectedCourses: selectedValues.filter(v => v !== "__all__"),
                  selectedModalities: [],
                }));
              }}
              value={formData.selectedCourses.map(c => {
                const course = sortedCourses.find(f => f.course_id === c);
                return { value: c, label: course ? `${course.course_id} | ${course.course_name}` : c };
              })}
              styles={{
                valueContainer: (provided) => ({
                  ...provided,
                  maxHeight: "120px",
                  overflowY: "auto"
                })
              }}
            />
          </div>

          <div className="field">
            <label className="label">Modality (Auto-selects all available)</label>

            <Select
              isMulti
              isDisabled={true}
              closeMenuOnSelect={false}
              hideSelectedOptions={true}

              options={(() => {
                const labelMap = new Map<string, number[]>();

                filteredModalitiesBySelection.forEach((m) => {
                  const baseLabel = `${m.modality_type}${m.section_name ? ` – ${m.section_name}` : ""}`;
                  if (!labelMap.has(baseLabel)) labelMap.set(baseLabel, []);
                  labelMap.get(baseLabel)!.push(m.modality_id);
                });

                return Array.from(labelMap.entries()).map(([baseLabel, ids]) => ({
                  value: ids,
                  label: `${baseLabel} (${ids.length})`, 
                }));
              })()}

              value={(() => {
                const labelMap = new Map<string, number[]>();

                formData.selectedModalities.forEach((id) => {
                  const m = filteredModalitiesBySelection.find(f => f.modality_id === id);
                  if (!m) return;

                  const baseLabel = `${m.modality_type}${m.section_name ? ` – ${m.section_name}` : ""}`;
                  if (!labelMap.has(baseLabel)) labelMap.set(baseLabel, []);
                  labelMap.get(baseLabel)!.push(id);
                });

                return Array.from(labelMap.entries()).map(([baseLabel, ids]) => ({
                  value: ids,
                  label: `${baseLabel} (${ids.length})`,   
                }));
              })()}

              styles={{
                multiValue: (base) => ({
                  ...base,
                  backgroundColor: "#e0f2fe",
                  borderRadius: "6px",
                  padding: "2px 4px"
                }),
                multiValueRemove: () => ({
                  display: "none"
                }),
                control: (base) => ({
                  ...base,
                  cursor: "not-allowed",
                  backgroundColor: "#f8fafc"
                }),
                valueContainer: (base) => ({
                  ...base,
                  maxHeight: "120px",
                  overflowY: "auto"
                })
              }}
            />
          </div>

          <div className="field">
            <label className="label">Exam Duration</label>
            <div style={{ display: "flex", gap: "10px" }}>
              {/* Hours Dropdown + Typing */}
              <CreatableSelect
                value={duration.hours ? { value: duration.hours, label: `${duration.hours} hr` } : null}
                onChange={(selected) =>
                  setDuration((prev) => ({ ...prev, hours: Number(selected?.value || 0) }))
                }
                options={[...Array(6)].map((_, i) => ({
                  value: i,
                  label: `${i} hour${i !== 1 ? "s" : ""}`,
                }))}
                placeholder="Hours"
                classNamePrefix="select"
                isClearable
              />

              {/* Minutes Dropdown + Typing */}
              <CreatableSelect
                value={duration.minutes ? { value: duration.minutes, label: `${duration.minutes} min` } : null}
                onChange={(selected) =>
                  setDuration((prev) => ({ ...prev, minutes: Number(selected?.value || 0) }))
                }
                options={[0, 15, 30, 45].map((m) => ({
                  value: m,
                  label: `${m} min`,
                }))}
                placeholder="Minutes"
                classNamePrefix="select"
                isClearable
              />
            </div>
          </div>

          <div className="field">
            <label className="label">Exam Start Time</label>
            <CreatableSelect
              value={
                selectedStartTime
                  ? { value: selectedStartTime, label: selectedStartTime }
                  : { value: "07:00", label: "07:00" } // default
              }
              onChange={(selected) =>
                setSelectedStartTime(selected ? selected.value : "")
              }
              options={times.map((t) => ({
                value: t,
                label: t,
              }))}
              placeholder="Select or type time"
              classNamePrefix="select"
              isClearable
              formatCreateLabel={(inputValue) => `Use custom time: "${inputValue}"`}
            />
          </div>
        </div>

        <div className="preview-column">
          <h3 className="preview-header">
            Selected Modality Preview ({formData.selectedModalities.length})
            {alreadyScheduledIds.size > 0 && (
              <span style={{ 
                color: '#f59e0b', 
                fontSize: '14px', 
                marginLeft: '10px',
                fontWeight: 'normal' 
              }}>
                ⚠️ {alreadyScheduledIds.size} already scheduled
              </span>
            )}
          </h3>
          <input
            type="text"
            placeholder="Search within selected modalities"
            value={modalityPreviewSearchTerm}
            onChange={(e) => setModalityPreviewSearchTerm(e.target.value)}
            className="input preview-search-input"
          />
          {formData.selectedModalities.length > 0 ? (
            <div className="modality-list">
              {formData.selectedModalities
                .map(modalityId => {
                  const modality = filteredModalitiesBySelection.find(m => m.modality_id === modalityId);
                  const course = filteredCoursesByPrograms.find(c => c.course_id === modality?.course_id);
                  const isScheduled = alreadyScheduledIds.has(modalityId);
                  
                  // ✅ Handle sections as array
                  const sectionsDisplay = Array.isArray(modality?.sections) 
                    ? modality.sections.join(', ') 
                    : modality?.section_name || 'N/A';
                  
                  const searchString = [
                    course?.course_id, 
                    sectionsDisplay, 
                    modality?.modality_type
                  ].join(' ').toLowerCase();
                  
                  return { modality, course, searchString, modalityId, isScheduled, sectionsDisplay };
                })
                .filter(item => !modalityPreviewSearchTerm || item.searchString.includes(modalityPreviewSearchTerm.toLowerCase()))
                .map(({ modality, course, modalityId, isScheduled, sectionsDisplay }) => (
                  <div 
                    key={modalityId} 
                    className="modality-item"
                    style={{
                      backgroundColor: isScheduled ? '#fef3c7' : 'transparent',
                      border: isScheduled ? '2px solid #f59e0b' : '1px solid #e5e7eb',
                      position: 'relative'
                    }}
                  >
                    {isScheduled && (
                      <div style={{
                        position: 'absolute',
                        top: '8px',
                        right: '8px',
                        background: '#f59e0b',
                        color: 'white',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: 'bold'
                      }}>
                        ⚠️ ALREADY SCHEDULED
                      </div>
                    )}
                    <p className="modality-detail">Course: {course ? course.course_id : 'N/A'}</p>
                    <p className="modality-detail">
                      Section(s): {sectionsDisplay}
                      {modality?.total_students && (
                        <span style={{ color: '#666', fontSize: '13px', marginLeft: '8px' }}>
                          ({modality.total_students} students)
                        </span>
                      )}
                    </p>
                    <p className="modality-detail">Modality Type: {modality?.modality_type ?? 'N/A'}</p>
                    <p className="modality-detail">
                      Room(s): {modality?.possible_rooms?.join(', ') ?? 'N/A'}
                    </p>
                    <p className="modality-detail">Remarks: {modality?.modality_remarks ?? 'N/A'}</p>
                    {isScheduled && (
                      <p style={{ 
                        color: '#f59e0b', 
                        fontSize: '13px', 
                        marginTop: '8px',
                        fontWeight: '500' 
                      }}>
                        ⚠️ This modality group already has an exam schedule
                      </p>
                    )}
                    <hr className="modality-divider" />
                  </div>
                ))}
            </div>
          ) : (
            <p className="helper">Select one or more modalities to see a preview.</p>
          )}
        </div>
      </div>

      {alreadyScheduledIds.size > 0 && (
        <button
          onClick={() => {
            setFormData(prev => ({
              ...prev,
              selectedModalities: prev.selectedModalities.filter(
                id => !alreadyScheduledIds.has(id)
              )
            }));
            toast.success(`Removed ${alreadyScheduledIds.size} already scheduled section(s)`);
          }}
          style={{
            marginLeft: '10px',
            padding: '6px 12px',
            background: '#f59e0b',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: '500'
          }}
        >
          Remove Already Scheduled ({alreadyScheduledIds.size})
        </button>
      )}

      <div className="save-button-wrapper">
        <button
          type="button"
          onClick={handleSaveClick}
          className="btn-save"
          disabled={loading || alreadyScheduledIds.size > 0}
          style={{ 
            display: "flex", 
            alignItems: "center", 
            justifyContent: "center", 
            gap: "8px", 
            fontSize: "20px", 
            width: "45px",
            opacity: alreadyScheduledIds.size > 0 ? 0.5 : 1,
            cursor: alreadyScheduledIds.size > 0 ? 'not-allowed' : 'pointer'
          }}
          title={alreadyScheduledIds.size > 0 
            ? 'Cannot generate - some sections are already scheduled' 
            : 'Generate schedule'}
        >
          {loading ? <FaSpinner className="spin" /> : <FaPlay />}
        </button>
        {alreadyScheduledIds.size > 0 && (
          <p style={{ 
            color: '#f59e0b', 
            fontSize: '14px', 
            marginTop: '8px',
            textAlign: 'center' 
          }}>
            Remove already scheduled sections to proceed
          </p>
        )}
      </div>
      <ToastContainer position="top-center" autoClose={3000} />
    </div>
  );
};

export default SchedulerPlottingSchedule;