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
  onScheduleCreated?: () => void; // NEW: Callback after schedule creation
}

interface Gene {
  sectionId: string | number;
  date: string;
  timeSlot: string;
  roomId: string;
  proctorId: number;
}

type Chromosome = Gene[];

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
        // Fetch colleges
        const collegesResponse = await api.get('/tbl_college/');
        const allColleges = collegesResponse.data;
        setCollegesCache(allColleges || []);

        // Fetch user roles
        const userRolesResponse = await api.get('/tbl_user_role', {
          params: {
            user_id: user.user_id,
            role_id: 3
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

        // Get scheduler's college name
        let schedulerCollegeName = "";
        if (collegeIds.length > 0) {
          const schedulerCollege = allColleges.find((c: any) => String(c.college_id) === collegeIds[0]);
          schedulerCollegeName = schedulerCollege?.college_name || "";
          setSchedulerCollegeName(schedulerCollegeName);
          console.log('Scheduler College Name:', schedulerCollegeName);
          console.log('Scheduler College ID:', collegeIds[0]);
        }

        // Fetch all data in parallel
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

        console.log('All departments:', allDepartments);
        console.log('All programs:', allPrograms);

        // Filter departments by college ID
        const filteredDepartments = (allDepartments || []).filter((d: any) => {
          const match = collegeIds.includes(String(d.college_id));
          console.log(`Dept ${d.department_id} - College: ${d.college_id} - Match: ${match}`);
          return match;
        });
        
        console.log('Filtered departments:', filteredDepartments);
        
        // Get department IDs
        const allowedDeptIds = filteredDepartments.map((d: any) => String(d.department_id));
        console.log('Allowed department IDs:', allowedDeptIds);
        
        // Filter programs by department ID
        const filteredPrograms = (allPrograms || []).filter((p: any) => {
          const match = allowedDeptIds.includes(String(p.department_id));
          console.log(`Program ${p.program_id} - Dept: ${p.department_id} - Match: ${match}`);
          return match;
        });

        console.log('Filtered Programs for dropdown:', filteredPrograms);

        // Filter exam periods
        const filteredExamPeriods = (allExamPeriods || []).filter((p: any) => 
          collegeIds.includes(String(p.college_id))
        );

        // Filter section courses by college
        const filteredSectCourses = (sectCourses || []).filter((sc: any) => {
          const program = filteredPrograms.find((p: any) => p.program_id === sc.program_id);
          return program !== undefined;
        });

        setExamPeriods(filteredExamPeriods);
        setDepartments(filteredDepartments);
        setPrograms(filteredPrograms);
        setTerms(trms || []);
        setSectionCourses(filteredSectCourses);
        setRoomsCache(rooms || []);
        setBuildingsCache(buildings || []);
        
        console.log('Programs state set with:', filteredPrograms.length, 'programs');
      } catch (err: any) {
        console.error("Failed to fetch data:", err);
        alert("Failed to fetch data");
      }
    };

    fetchAll();
  }, [user]);

  // Lazy load courses based on selected programs
  useEffect(() => {
    const fetchCoursesLazy = async () => {
      if (formData.selectedPrograms.length === 0) {
        setCourses([]);
        return;
      }

      try {
        // Get all section courses for selected programs
        const relevantSections = sectionCourses.filter(sc => 
          formData.selectedPrograms.includes(sc.program_id)
        );

        // Get unique course IDs
        const courseIds = Array.from(new Set(relevantSections.map(sc => sc.course_id)));

        if (courseIds.length === 0) {
          setCourses([]);
          return;
        }

        // Fetch only the needed courses
        const coursesResponse = await api.get('/courses/');
        const allCourses = coursesResponse.data || [];
        
        // Filter to only courses that are in the selected programs
        const filteredCourses = allCourses.filter((c: any) => courseIds.includes(c.course_id));

        setCourses(filteredCourses);
        console.log(`Lazy loaded ${filteredCourses.length} courses for selected programs`);
      } catch (error) {
        console.error("Error lazy loading courses:", error);
        setCourses([]);
      }
    };

    fetchCoursesLazy();
  }, [formData.selectedPrograms, sectionCourses]);

  // Debug: Log when programs state updates
  useEffect(() => {
    console.log('Programs state updated. Count:', programs.length);
    console.log('Programs:', programs);
  }, [programs]);

  // Update the modality fetching to handle multiple sections per modality
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
        
        console.log('Raw modalities from API:', mods.length);
        
        // Filter by scheduler's college
        const filteredMods = mods.filter((m: any) => {
          const isAllowedProgram = formData.selectedPrograms.includes(m.program_id);
          return isAllowedProgram;
        });

        setModalities(filteredMods);
        console.log(`Lazy loaded ${filteredMods.length} modalities for college: ${schedulerCollegeName}`);
      } catch (error) {
        console.error("Error lazy loading modalities:", error);
        setModalities([]);
      }
    };

    fetchModalitiesLazy();
  }, [formData.selectedPrograms, formData.selectedCourses, programs, departments, collegesCache, schedulerCollegeName]);
  // ============================================================================
  // COMPUTED DATA
  // ============================================================================

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

  const examDateOptions = useMemo(() => {
    if (!examPeriods.length || !userCollegeIds.length) return [];
    const allowedPeriods = examPeriods.filter((p: any) => userCollegeIds.includes(String(p.college_id)));
    const days: { key: string; iso: string; label: string }[] = [];

    allowedPeriods.forEach((period: any) => {
      if (!period.start_date || !period.end_date) return;
      const start = new Date(period.start_date);
      const end = new Date(period.end_date);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const iso = d.toISOString().slice(0, 10);
        const label = d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
        days.push({ key: `${period.examperiod_id}-${iso}`, iso, label });
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
    
    // Courses are already filtered by lazy loading
    return courses;
  }, [formData.selectedPrograms, courses]);

  const filteredModalitiesBySelection = useMemo(() => {
    if (formData.selectedPrograms.length === 0 || formData.selectedCourses.length === 0) return [];
    return modalities.filter((m: any) =>
      formData.selectedPrograms.includes(m.program_id) && formData.selectedCourses.includes(m.course_id)
    );
  }, [formData.selectedPrograms, formData.selectedCourses, modalities]);

  // Auto-select first options
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

  // ============================================================================
  // GENERATE RANDOM CHROMOSOME - EXACT MATCH TO WORKING SUPABASE VERSION
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
    const roomTimeRanges = new Map<string, Array<{ start: number; end: number }>>();
    // stable mapping: key = `${date}|${proctorId}` -> array of ranges assigned to that proctor that date
    const proctorGlobalTimeRanges = new Map<string, Array<{ start: number; end: number }>>();
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

    // Assign one time slot per course type
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

      let foundTimeSlot = false;
      const maxAttempts = Math.max(1, validTimesForCourse.length * 3);
      for (let attempt = 0; attempt < maxAttempts && !foundTimeSlot; attempt++) {
        const candidateTime = validTimesForCourse[Math.floor(Math.random() * validTimesForCourse.length)];
        const startMinutes = timeToMinutes(candidateTime);
        const endMinutes = startMinutes + totalDurationMinutes;

        let availableRoomCount = 0;
        for (const section of sections) {
          const suitableRooms = modalityRoomsMap.get(section.modality_id) || [];
          for (const room of suitableRooms) {
            const roomDateKey = `${date}|${room}`;
            const existingRanges = roomTimeRanges.get(roomDateKey) || [];
            if (!existingRanges.some(range => rangesOverlap(startMinutes, endMinutes, range.start, range.end))) {
              availableRoomCount++;
              break;
            }
          }
        }

        if (availableRoomCount >= sections.length) {
          courseTypeTimeSlots.set(courseKey, { date, timeSlot: candidateTime });
          foundTimeSlot = true;
        }
      }

      if (!foundTimeSlot && validTimesForCourse.length > 0) {
        const timeSlot = validTimesForCourse[Math.floor(Math.random() * validTimesForCourse.length)];
        courseTypeTimeSlots.set(courseKey, { date, timeSlot });
      }
    });

    // Helper utilities for proctor assignment
    const proctorKey = (date: string, pid: number) => `${date}|${pid}`;
    const markProctor = (dateKey: string, start: number, end: number) => {
      if (!proctorGlobalTimeRanges.has(dateKey)) proctorGlobalTimeRanges.set(dateKey, []);
      proctorGlobalTimeRanges.get(dateKey)!.push({ start, end });
    };
    const isProctorFree = (dateKey: string, start: number, end: number) => {
      const ranges = proctorGlobalTimeRanges.get(dateKey) || [];
      return !ranges.some(r => rangesOverlap(start, end, r.start, r.end));
    };

    // Main scheduling loop (use pre-assigned course times)
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

      // Find room
      let roomId = "";
      const suitableRooms = modalityRoomsMap.get(section.modality_id) || [];
      for (const room of suitableRooms) {
        const roomDateKey = `${date}|${room}`;
        const existingRanges = roomTimeRanges.get(roomDateKey) || [];
        if (!existingRanges.some(range => rangesOverlap(startMinutes, endMinutes, range.start, range.end))) {
          roomId = room;
          if (!roomTimeRanges.has(roomDateKey)) roomTimeRanges.set(roomDateKey, []);
          roomTimeRanges.get(roomDateKey)!.push({ start: startMinutes, end: endMinutes });
          break;
        }
      }
      if (!roomId && suitableRooms.length > 0) roomId = suitableRooms[Math.floor(Math.random() * suitableRooms.length)];

      // Year-level tracking (unchanged)
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

      // ===== PROCTOR ASSIGNMENT (robust)
      let proctorId = -1;
      const availableProctors = getAvailableProctors(date, timeSlot) || [];
      const shuffledProctors = [...availableProctors].sort(() => Math.random() - 0.5);

      // Priority 1: Night class instructor (must be used when possible)
      if (isNightClass && section.instructor_id) {
        const instr = section.instructor_id;
        const key = proctorKey(date, instr);
        if (availableProctors.includes(instr) && isProctorFree(key, startMinutes, endMinutes)) {
          proctorId = instr;
          markProctor(key, startMinutes, endMinutes);
        }
      }

      // Priority 2: Find a free proctor from available list
      if (proctorId === -1) {
        for (const pid of shuffledProctors) {
          const key = proctorKey(date, pid);
          if (isProctorFree(key, startMinutes, endMinutes)) {
            proctorId = pid;
            markProctor(key, startMinutes, endMinutes);
            break;
          }
        }
      }

      // Priority 3: Use section instructor as fallback (if not already assigned)
      if (proctorId === -1 && section.instructor_id) {
        const instrKey = proctorKey(date, section.instructor_id);
        if (isProctorFree(instrKey, startMinutes, endMinutes)) {
          proctorId = section.instructor_id;
          markProctor(instrKey, startMinutes, endMinutes);
        }
      }

      // Priority 4: Use any instructor from sections array as fallback
      if (proctorId === -1 && section.instructors && section.instructors.length > 0) {
        for (const instrId of section.instructors) {
          if (!instrId) continue;
          const instrKey = proctorKey(date, instrId);
          if (isProctorFree(instrKey, startMinutes, endMinutes)) {
            proctorId = instrId;
            markProctor(instrKey, startMinutes, endMinutes);
            break;
          }
        }
      }

      // Priority 5: Attempt a non-destructive swap
      if (proctorId === -1 && shuffledProctors.length > 0) {
        const blocking = shuffledProctors.filter(pid => {
          const key = proctorKey(date, pid);
          const ranges = proctorGlobalTimeRanges.get(key) || [];
          return ranges.some(r => rangesOverlap(startMinutes, endMinutes, r.start, r.end));
        });

        outerSwap:
        for (const blockedPid of blocking) {
          const blockedKey = proctorKey(date, blockedPid);
          const blockedRanges = proctorGlobalTimeRanges.get(blockedKey) || [];

          for (let i = 0; i < blockedRanges.length; i++) {
            const blockedRange = blockedRanges[i];
            const candidateReceivers = shuffledProctors.filter(p => p !== blockedPid);
            for (const receiver of candidateReceivers) {
              const recvKey = proctorKey(date, receiver);
              if (isProctorFree(recvKey, blockedRange.start, blockedRange.end)) {
                const newBlockedRanges = (proctorGlobalTimeRanges.get(blockedKey) || []).filter((_, idx) => idx !== i);
                proctorGlobalTimeRanges.set(blockedKey, newBlockedRanges);
                markProctor(recvKey, blockedRange.start, blockedRange.end);
                if (isProctorFree(blockedKey, startMinutes, endMinutes)) {
                  proctorId = blockedPid;
                  markProctor(blockedKey, startMinutes, endMinutes);
                  break outerSwap;
                } else {
                  const recRanges = proctorGlobalTimeRanges.get(recvKey) || [];
                  proctorGlobalTimeRanges.set(recvKey, recRanges.filter(r => !(r.start === blockedRange.start && r.end === blockedRange.end)));
                  proctorGlobalTimeRanges.set(blockedKey, [...(proctorGlobalTimeRanges.get(blockedKey) || []), blockedRange]);
                }
              }
            }
          }
        }
      }

      // LAST RESORT: Use placeholder only if instructor also unavailable
      if (proctorId === -1) {
        const FALLBACK_PROCTOR = -9999;
        proctorId = FALLBACK_PROCTOR;
        const key = proctorKey(date, FALLBACK_PROCTOR);
        markProctor(key, startMinutes, endMinutes);
      }

      // add to chromosome & mark scheduled
      scheduledModalities.add(section.modality_id);
      chromosome.push({ sectionId: section.modality_id, date, timeSlot, roomId, proctorId });
    });

    return chromosome;
  };

  // ============================================================================
  // CALCULATE FITNESS - EXACT MATCH TO WORKING ORIGINAL
  // ============================================================================

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

      const { date, timeSlot, roomId, proctorId } = gene;
      const startMinutes = timeToMinutes(timeSlot);
      const endMinutes = startMinutes + totalDurationMinutes;
      const yearLevel = extractYearLevel(section.section_name);
      const courseId = section.course_id;
      const programId = section.program_id;

      const program = programs.find(p => p.program_id === programId);
      const departmentId = program ? String(program.department_id) : "unknown";
      const department = departments.find(d => String(d.department_id) === departmentId);
      const collegeId = department ? String(department.college_id) : "unknown";

      // Section uniqueness
      sectionScheduledCount.set(gene.sectionId, (sectionScheduledCount.get(gene.sectionId) || 0) + 1);
      if (sectionScheduledCount.get(gene.sectionId)! > 1) {
        fitness -= 10000;
      }

      // Course date consistency
      if (!courseDateAssignments.has(courseId)) {
        courseDateAssignments.set(courseId, new Set());
      }
      courseDateAssignments.get(courseId)!.add(date);
      if (courseDateAssignments.get(courseId)!.size > 1) {
        fitness -= 25000;
      }

      // Course time consistency
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

      // Student conflicts
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

      // Year level consistency
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

      // Room overlaps
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

      // Proctor assignment
      if (proctorId === -1) {
        fitness -= 6000;
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
          else {
            if (existing.end === startMinutes) {
              if (existing.deptId === departmentId) {
                fitness -= 12000;
              }
            }
            else if (startMinutes > existing.end && startMinutes < existing.end + totalDurationMinutes) {
              if (existing.deptId === departmentId) {
                const gapDuration = startMinutes - existing.end;
                const requiredGap = totalDurationMinutes;
                const gapDeficit = requiredGap - gapDuration;
                fitness -= gapDeficit * 100;
              }
            }
          }
        });
        
        existingProctorRanges.push({ 
          start: startMinutes, 
          end: endMinutes, 
          sectionId: Number(gene.sectionId),
          deptId: departmentId
        });
      }

      // Reward
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
    // ✅ NEW: Build course-to-timeslot map to preserve course consistency
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

    return chromosome.map(gene => {
      if (Math.random() < mutationRate) {
        const section = sectionMap.get(gene.sectionId);
        if (!section) return { ...gene };

        const isNightClass = section.is_night_class === "YES";
        const courseKey = isNightClass ? `${section.course_id}_NIGHT` : section.course_id;
        const mutationType = Math.floor(Math.random() * 4);
        const suitableRooms = modalityRoomsMap.get(gene.sectionId) || [];

        const validTimesForSection = isNightClass 
          ? eveningTimeSlots.filter(t => {
              const [h, m] = t.split(":").map(Number);
              const totalDurationMinutes = duration.hours * 60 + duration.minutes;
              const end = (h * 60 + m) + totalDurationMinutes;
              return end <= 21 * 60;
            })
          : validTimes;

        if (mutationType === 0 && Math.random() < 0.3) {
          // ✅ Mutate date - update for entire course
          const newDate = sortedDates[Math.floor(Math.random() * sortedDates.length)];
          courseTypeTimeSlots.set(courseKey, { date: newDate, timeSlot: gene.timeSlot });
          
          const availableProctors = getAvailableProctors(newDate, gene.timeSlot);
          let newProctorId = -1;
          
          if (isNightClass && section.instructor_id && availableProctors.includes(section.instructor_id)) {
            newProctorId = section.instructor_id;
          } else {
            newProctorId = availableProctors.length > 0
              ? availableProctors[Math.floor(Math.random() * availableProctors.length)]
              : -1;
          }
          
          return { ...gene, date: newDate, proctorId: newProctorId };
        } else if (mutationType === 1) {
          // ✅ Mutate time slot - update for entire course
          const newTimeSlot = validTimesForSection[Math.floor(Math.random() * validTimesForSection.length)];
          courseTypeTimeSlots.set(courseKey, { date: gene.date, timeSlot: newTimeSlot });
          
          const availableProctors = getAvailableProctors(gene.date, newTimeSlot);
          let newProctorId = -1;
          
          if (isNightClass && section.instructor_id && availableProctors.includes(section.instructor_id)) {
            newProctorId = section.instructor_id;
          } else {
            newProctorId = availableProctors.length > 0
              ? availableProctors[Math.floor(Math.random() * availableProctors.length)]
              : -1;
          }
          
          return { ...gene, timeSlot: newTimeSlot, proctorId: newProctorId };
        } else if (mutationType === 2) {
          // Mutate room only (doesn't affect other sections)
          const newRoomId = suitableRooms.length > 0
            ? suitableRooms[Math.floor(Math.random() * suitableRooms.length)]
            : "";
          return { ...gene, roomId: newRoomId };
        } else {
          // Mutate proctor only (doesn't affect other sections)
          const availableProctors = getAvailableProctors(gene.date, gene.timeSlot);
          let newProctorId = -1;
          
          if (isNightClass && section.instructor_id && availableProctors.includes(section.instructor_id)) {
            newProctorId = section.instructor_id;
          } else {
            // Randomize proctor selection
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
    const POPULATION_SIZE = 50;
    const GENERATIONS = 100;
    const MUTATION_RATE = 0.25;
    const ELITE_SIZE = 5;
    const YIELD_EVERY_N_GENERATIONS = 10;

    const totalDurationMinutes = duration.hours * 60 + duration.minutes;

    // Parse academic year and semester
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

    // Fetch proctor availability
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

    // ✅ CRITICAL FIX: Define time slot ranges that match proctor availability
    const TIME_SLOT_RANGES: Record<string, string[]> = {
      "7 AM - 1 PM (Morning)": ["07:00", "07:30", "08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "12:30"],
      "1 PM - 6 PM (Afternoon)": ["13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30"],
      "6 PM - 9 PM (Evening)": ["18:00", "18:30", "19:00", "19:30", "20:00", "20:30"]
    };

    const getPeriodFromTime = (time: string): string | null => {
      const hour = parseInt(time.split(":")[0], 10);

      if (hour >= 7 && hour < 13) return "7 AM - 1 PM (Morning)";
      if (hour >= 13 && hour < 18) return "1 PM - 6 PM (Afternoon)";
      if (hour >= 18 && hour < 21) return "6 PM - 9 PM (Evening)";

      return null;
    };

    // ✅ CRITICAL: Get all available time slots from TIME_SLOT_RANGES
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
        const isoDate = dateStr.split('T')[0];

        timeSlotsArray.forEach((timeSlotPeriod: string) => {
          const key = `${isoDate}|${timeSlotPeriod}`;
          if (!availabilityMap.has(key)) {
            availabilityMap.set(key, new Set());
          }
          availabilityMap.get(key)!.add(proctorId);
        });
      });
    });

    const getAvailableProctors = (date: string, startTime: string): number[] => {
      const isoDate = date.split('T')[0];
      const period = getPeriodFromTime(startTime);
      
      if (!period) return [];

      const key = `${isoDate}|${period}`;

      return Array.from(availabilityMap.get(key) || new Set());
    };

    // Build lookup structures
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
        // ✅ Keep sections as array - don't split them
        const sections = Array.isArray(selectedModality.sections) 
          ? selectedModality.sections 
          : [selectedModality.section_name];
        
        // Get instructor IDs for all sections
        const instructorIds = Array.from(new Set(
          sections.map((sectionName: string) => {
            const sectionCourseData = sectionCourses.find(
              sc => sc.program_id === selectedModality.program_id &&
                    sc.course_id === selectedModality.course_id &&
                    sc.section_name === sectionName
            );
            return sectionCourseData?.user_id ?? null;
          }).filter(Boolean)
        ));

        
        // Check if ANY section is night class
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
          sections: sections, // ✅ Keep as array
          instructors: instructorIds, // ✅ Array of instructors
          is_night_class: isNightClass ? "YES" : "NO",
          enrolled_students: selectedModality.total_students ?? 0
        };
        
        allModalities.push(enrichedModality);
        modalityMap.set(modalityId, enrichedModality);
      }
    });

    console.log(`📊 Processing ${allModalities.length} modality groups`);

    const eveningTimeSlots = TIME_SLOT_RANGES["6 PM - 9 PM (Evening)"];
    const morningTimeSlots = TIME_SLOT_RANGES["7 AM - 1 PM (Morning)"];
    const afternoonTimeSlots = TIME_SLOT_RANGES["1 PM - 6 PM (Afternoon)"];

    console.log('Morning slots:', morningTimeSlots);
    console.log('Afternoon slots:', afternoonTimeSlots);
    console.log('Evening slots:', eveningTimeSlots);

    const isValidTimeSlot = (startTime: string, isNightClass: boolean): boolean => {
      if (!allAvailableTimeSlots.includes(startTime)) {
        return false;
      }

      const [startHour, startMinute] = startTime.split(":").map(Number);
      const endMinutes = (startHour * 60 + startMinute) + totalDurationMinutes;
      const maxEndTime = 21 * 60;
      
      // Exam must end by 21:00
      if (endMinutes > maxEndTime) {
        return false;
      }
      
      // Night classes can only use evening slots
      if (isNightClass) {
        return eveningTimeSlots.includes(startTime);
      }

      return true;
    };

    const validTimes = allAvailableTimeSlots.filter(t => isValidTimeSlot(t, false));
    
    console.log(`✅ Valid start times for day classes (${validTimes.length} slots):`, validTimes);
    console.log(`✅ Valid start times for night classes (${eveningTimeSlots.filter(t => isValidTimeSlot(t, true)).length} slots):`, 
      eveningTimeSlots.filter(t => isValidTimeSlot(t, true)));

    // ✅ Build section rooms map with ALL suitable rooms
    const modalityRoomsMap = new Map<string | number, string[]>();
    allModalities.forEach(modality => {
      const possibleRooms = modality.possible_rooms ?? [];
      modalityRoomsMap.set(modality.modality_id, possibleRooms);
      
      console.log(`📍 Modality ${modality.modality_id}: ${modality.sections.length} sections, ${possibleRooms.length} possible rooms`);
    });

    // Pre-validation
    const violations: string[] = [];

    allModalities.forEach(section => {
      const enrolledCount = section.enrolled_students ?? 0;
      const suitableRooms = modalityRoomsMap.get(section.modality_id) || [];
      
      if (suitableRooms.length === 0) {
        violations.push(
          `Section ${section.course_id} - ${section.section_name} has no suitable rooms.\n` +
          `Required capacity: ${enrolledCount} students\n` +
          `Possible rooms from modality: ${section.possible_rooms?.join(', ') || 'None'}`
        );
      }
    });

    const datesWithoutProctors: string[] = [];
    sortedDates.forEach(date => {
      const isoDate = date.split('T')[0];
      
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
      violations.push(`No proctors available for: ${formattedDates}\n\nPlease ensure proctors have set their availability for these specific dates and time slots.`);
    }

    // Check night class constraints
    allModalities.forEach(section => {
      if (section.is_night_class === "YES") {
        const validEveningSlots = eveningTimeSlots.filter(slot => {
          const [h, m] = slot.split(":").map(Number);
          const end = (h * 60 + m) + totalDurationMinutes;
          return end <= 21 * 60; // Must end by 9 PM
        });
        
        if (validEveningSlots.length === 0) {
          violations.push(
            `Night class ${section.course_id} - ${section.section_name} cannot be scheduled: exam duration (${totalDurationMinutes} min) too long for evening slots (must end by 9 PM)`
          );
        }
        
        // Check if instructor is available in evening slots
        if (section.instructor_id) {
          let instructorHasEveningAvailability = false;
          for (const date of sortedDates) {
            const isoDate = date.split('T')[0];
            for (const slot of validEveningSlots) {
              const available = getAvailableProctors(isoDate, slot);
              if (available.includes(section.instructor_id)) {
                instructorHasEveningAvailability = true;
                break;
              }
            }
            if (instructorHasEveningAvailability) break;
          }
          
          if (!instructorHasEveningAvailability) {
            violations.push(
              `Night class ${section.course_id} - ${section.section_name}: Instructor (ID: ${section.instructor_id}) has no evening availability`
            );
          }
        }
      }
    });

    if (violations.length > 0) {
      alert(`Cannot generate schedule:\n\n${violations.join("\n\n")}`);
      return;
    }

    console.log('🔍 Checking for existing schedules...');
    
    try {
      const modalityIds = formData.selectedModalities;
      const existingSchedulesResponse = await api.get('/tbl_examdetails', {
        params: {
          modality_id: modalityIds.join(',')
        }
      });
      
      const existingSchedules = existingSchedulesResponse.data || [];
      
      if (existingSchedules.length > 0) {
        // Group by modality to show which ones are already scheduled
        const scheduledModalities = new Map<number, any>();
        existingSchedules.forEach((schedule: any) => {
          if (!scheduledModalities.has(schedule.modality_id)) {
            scheduledModalities.set(schedule.modality_id, []);
          }
          scheduledModalities.get(schedule.modality_id)!.push(schedule);
        });
        
        // Build detailed error message
        const duplicateDetails: string[] = [];
        scheduledModalities.forEach((schedules, modalityId) => {
          const modality = modalities.find(m => m.modality_id === modalityId);
          if (modality) {
            const schedule = schedules[0]; // Get first schedule for details
            duplicateDetails.push(
              `• ${modality.course_id} - ${modality.section_name}\n` +
              `  Already scheduled on: ${new Date(schedule.exam_date).toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}\n` +
              `  Time: ${new Date(schedule.exam_start_time).toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit' 
              })} - ${new Date(schedule.exam_end_time).toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit' 
              })}\n` +
              `  Room: ${schedule.room?.room_name || 'N/A'}\n` +
              `  Exam Period: ${schedule.exam_period || 'N/A'}`
            );
          }
        });
        
        const errorMessage = 
          `❌ Cannot generate schedule - ${scheduledModalities.size} section(s) already have scheduled exams:\n\n` +
          duplicateDetails.slice(0, 5).join('\n\n') +
          (duplicateDetails.length > 5 ? `\n\n... and ${duplicateDetails.length - 5} more` : '') +
          `\n\n📋 Options:\n` +
          `1. Deselect these sections from your modality selection\n` +
          `2. Delete the existing schedules first if you want to reschedule\n` +
          `3. Use the "Edit Schedule" feature to modify existing schedules`;
        
        alert(errorMessage);
        return; // Exit the function
      }
      
      console.log('✅ No existing schedules found - safe to proceed');
      
    } catch (error) {
      console.error('Error checking for existing schedules:', error);
      toast.error('Failed to check for existing schedules');
      return;
    }

    // Assign each course to a specific date
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
    
    toast.info("Generating schedule... This may take a moment.", { autoClose: 2000 });

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

    console.log(`✅ Evolution complete! Final best fitness: ${bestFitness}`);

    // Convert to schedule with validation
    const scheduledExams: any[] = [];
    const unscheduledSections: string[] = [];
    const finalRoomTimeRanges = new Map<string, Array<{ start: number; end: number; course: string; section: string }>>();
    const finalProctorTimeRanges = new Map<string, Array<{ start: number; end: number; course: string; section: string }>>();
    const finalCourseDates = new Map<string, Set<string>>();

    for (const gene of bestChromosome) {
      const section = modalityMap.get(gene.sectionId);
      if (!section) continue;

      const { date, timeSlot, roomId, proctorId } = gene;
      const courseId = section.course_id;

      // ✅ CRITICAL: Validate that the time slot is valid
      if (!allAvailableTimeSlots.includes(timeSlot)) {
        console.error(`❌ Invalid time slot ${timeSlot} for section ${section.modality_id}`);
        unscheduledSections.push(`${section.course_id} - ${section.section_name} (invalid time slot: ${timeSlot})`);
        continue;
      }

      // ✅ Validate that exam ends by 21:00
      const [startHour, startMinute] = timeSlot.split(":").map(Number);
      const startMinutes = timeToMinutes(timeSlot);
      const endMinutes = startMinutes + totalDurationMinutes;
      
      if (endMinutes > 21 * 60) {
        console.error(`❌ Exam would end after 21:00 for section ${section.modality_id}`);
        unscheduledSections.push(`${section.course_id} - ${section.section_name} (would end after 9 PM)`);
        continue;
      }

      if (!roomId || proctorId === -1) {
        unscheduledSections.push(`${section.course_id} - ${section.section_name} (missing room or proctor)`);
        continue;
      }

      if (!finalCourseDates.has(courseId)) {
        finalCourseDates.set(courseId, new Set());
      }
      finalCourseDates.get(courseId)!.add(date);

      if (finalCourseDates.get(courseId)!.size > 1) {
        console.warn(`⚠️ Course split across dates: ${courseId}`);
        unscheduledSections.push(`${section.course_id} - ${section.section_name} (course split across multiple dates)`);
        continue;
      }

      const matchedPeriod = examPeriods.find(p => {
        const start = new Date(p.start_date);
        const end = new Date(p.end_date);
        return new Date(date) >= start && new Date(date) <= end;
      });

      if (!matchedPeriod) {
        unscheduledSections.push(`${section.course_id} - ${section.section_name} (no matching exam period)`);
        continue;
      }

      const endHour = startHour + Math.floor((startMinute + totalDurationMinutes) / 60);
      const endMinute = (startMinute + totalDurationMinutes) % 60;
      const endTime = `${String(endHour).padStart(2, "0")}:${String(endMinute).padStart(2, "0")}`;

      let hasOverlap = false;

      // ✅ Check room conflicts
      const roomDateKey = `${date}|${roomId}`;
      const existingRoomRanges = finalRoomTimeRanges.get(roomDateKey) || [];
      for (const existing of existingRoomRanges) {
        if (rangesOverlap(startMinutes, endMinutes, existing.start, existing.end)) {
          console.warn(`⚠️ Room overlap detected for ${roomId}`);
          hasOverlap = true;
          break;
        }
      }

      // ✅ CRITICAL FIX: Check proctor conflicts BEFORE adding to schedule
      const proctorDateKey = `${date}|${proctorId}`;
      const existingProctorRanges = finalProctorTimeRanges.get(proctorDateKey) || [];
      for (const existing of existingProctorRanges) {
        if (rangesOverlap(startMinutes, endMinutes, existing.start, existing.end)) {
          console.error(`❌ PROCTOR CONFLICT: Proctor ${proctorId} already assigned ${existing.course} at ${date} ${timeSlot}`);
          hasOverlap = true;
          break;
        }
      }

      if (hasOverlap) {
        unscheduledSections.push(`${section.course_id} - ${section.section_name} (room or proctor conflict)`);
        continue; // ✅ Skip this exam entirely
      }

      // ✅ Only NOW do we mark room and proctor as occupied
      if (!finalRoomTimeRanges.has(roomDateKey)) {
        finalRoomTimeRanges.set(roomDateKey, []);
      }
      finalRoomTimeRanges.get(roomDateKey)!.push({
        start: startMinutes,
        end: endMinutes,
        course: section.course_id,
        section: section.section_name
      });

      if (!finalProctorTimeRanges.has(proctorDateKey)) {
        finalProctorTimeRanges.set(proctorDateKey, []);
      }
      finalProctorTimeRanges.get(proctorDateKey)!.push({
        start: startMinutes,
        end: endMinutes,
        course: section.course_id,
        section: section.section_name
      });

      const startTimestamp = `${date}T${timeSlot}:00`;
      const endTimestamp = `${date}T${endTime}:00`;

      const buildingId = roomToBuildingMap.get(roomId);
      const buildingName = buildingId ? buildingMap.get(buildingId) : "Unknown Building";

      if (!roomId || roomId.trim() === "") {
        console.error(`❌ Empty room_id for section ${section.modality_id}`);
        unscheduledSections.push(
          `${section.course_id} - ${section.section_name} (no available room)`
        );
        continue;
      }

      const availableProctorsForAssignment = getAvailableProctors(date, timeSlot);
      const proctorsArray: number[] = [];

      // ✅ FIX: Check each proctor for conflicts before adding
      for (let i = 0; i < section.sections.length; i++) {
        if (availableProctorsForAssignment.length > 0) {
          // Try to find an available proctor that's not already booked
          let assignedProctor = -1;
          
          for (const candidateProctor of availableProctorsForAssignment) {
            const proctorKey = `${date}|${candidateProctor}`;
            const existingRanges = finalProctorTimeRanges.get(proctorKey) || [];
            
            // Check if this proctor is free at this time
            const isFree = !existingRanges.some(range => 
              rangesOverlap(startMinutes, endMinutes, range.start, range.end)
            );
            
            if (isFree) {
              assignedProctor = candidateProctor;
              
              // Mark this proctor as occupied
              if (!finalProctorTimeRanges.has(proctorKey)) {
                finalProctorTimeRanges.set(proctorKey, []);
              }
              finalProctorTimeRanges.get(proctorKey)!.push({
                start: startMinutes,
                end: endMinutes,
                course: section.course_id,
                section: section.section_name
              });
              
              break; // Found a free proctor
            }
          }
          
          if (assignedProctor !== -1) {
            proctorsArray.push(assignedProctor);
          } else {
            // No available proctor for this section
            console.warn(`⚠️ No available proctor for section ${i} of ${section.course_id}`);
            proctorsArray.push(proctorId); // Fallback to main proctor (will create conflict)
          }
        } else {
          proctorsArray.push(proctorId);
        }
      }

      // ✅ Only add to scheduledExams if no conflicts
      scheduledExams.push({
        program_id: section.program_id,
        course_id: section.course_id,
        modality_id: section.modality_id,
        room_id: roomId,
        
        sections: section.sections,
        instructors: section.instructors,
        proctors: proctorsArray,
        
        section_name: section.sections[0],
        instructor_id: section.instructors[0] ?? null,
        proctor_id: proctorId,
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

    // ✅ REMOVE the finalProctorValidation code you added earlier - it's not needed now

    if (unscheduledSections.length > 0) {
      const message = `Could not schedule ${unscheduledSections.length} section(s):\n\n${unscheduledSections.slice(0, 10).join("\n")}${unscheduledSections.length > 10 ? `\n... and ${unscheduledSections.length - 10} more` : ""}\n\nScheduled: ${scheduledExams.length}/${allModalities.length} sections`;
      if (scheduledExams.length === 0) {
        alert(message + "\n\nNo schedules to save. Please adjust constraints or add more resources.");
        return;
      }
      const proceed = globalThis.confirm(message + "\n\nDo you want to save the partial schedule?");
      if (!proceed) return;
    }

    const invalidSchedules = scheduledExams.filter(exam => !exam.room_id || exam.room_id.trim() === "");
    if (invalidSchedules.length > 0) {
      console.error("❌ Found schedules with empty room_id:", invalidSchedules);
      alert(`Error: ${invalidSchedules.length} schedule(s) have no room assigned. Cannot save.`);
      return;
    }

    if (scheduledExams.length === 0) {
      alert("No valid schedules to save. Please adjust constraints.");
      return;
    }

    try {
      await api.post('/tbl_examdetails', scheduledExams);
      toast.success(`Successfully scheduled ${scheduledExams.length}/${allModalities.length} sections!`);
      console.log(`✅ Successfully saved ${scheduledExams.length} exam schedules`);
      
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
              options={addSelectAllOption(programs.map(p => ({ 
                value: p.program_id, 
                label: `${p.program_id} | ${p.program_name}` 
              })))}
              isMulti
              closeMenuOnSelect={false}
              hideSelectedOptions={false}
              components={{ Option: CheckboxOption }}
              onChange={(selected) => {
                let selectedValues = (selected as any[]).map(s => s.value);
                if (selectedValues.includes("__all__")) {
                  selectedValues = [...programs.map(p => p.program_id)];
                }

                setFormData(prev => ({
                  ...prev,
                  selectedPrograms: selectedValues.filter(v => v !== "__all__"),
                  selectedCourses: [],
                  selectedModalities: [],
                }));
              }}
              value={formData.selectedPrograms.map(p => {
                const prog = programs.find(f => f.program_id === p);
                return { value: p, label: prog ? `${prog.program_id} | ${prog.program_name}` : p };
              })}
            />
          </div>

          <div className="field">
            <label className="label">Course</label>
            <Select
              options={addSelectAllOption(filteredCoursesByPrograms.map(c => ({ value: c.course_id, label: `${c.course_id} | ${c.course_name}` })))}
              isMulti
              closeMenuOnSelect={false}
              hideSelectedOptions={false}
              components={{ Option: CheckboxOption }}
              onChange={(selected) => {
                let selectedValues = (selected as any[]).map(s => s.value);
                if (selectedValues.includes("__all__")) {
                  selectedValues = [...filteredCoursesByPrograms.map(c => c.course_id)];
                }
                setFormData(prev => ({ ...prev, selectedCourses: selectedValues.filter(v => v !== "__all__"), selectedModalities: [] }));
              }}
              value={formData.selectedCourses.map(c => {
                const course = filteredCoursesByPrograms.find(f => f.course_id === c);
                return { value: c, label: course ? course.course_id : c };
              })}
              styles={{ valueContainer: (provided) => ({ ...provided, maxHeight: "120px", overflowY: "auto" }) }}
            />
          </div>

          <div className="field">
            <label className="label">Modality</label>
            <Select
              options={addSelectAllOption(filteredModalitiesBySelection.map(m => ({
                value: m.modality_id,
                label: `${m.modality_type}${m.section_name ? ` – ${m.section_name}` : ""}`,
              })))}
              isMulti
              closeMenuOnSelect={false}
              hideSelectedOptions={false}
              components={{ Option: CheckboxOption }}
              onChange={(selected) => {
                let selectedValues = (selected as any[]).map(s => s.value);
                if (selectedValues.includes("__all__")) {
                  selectedValues = [...filteredModalitiesBySelection.map(m => m.modality_id)];
                } else {
                  // Auto-select all modalities once any are clicked
                  selectedValues = [...filteredModalitiesBySelection.map(m => m.modality_id)];
                }
                setFormData(prev => ({
                  ...prev,
                  selectedModalities: selectedValues.filter(v => v !== "__all__"),
                }));
              }}
              value={formData.selectedModalities.map(m => {
                const mod = filteredModalitiesBySelection.find(f => f.modality_id === m);
                return {
                  value: m,
                  label: mod ? `${mod.modality_type}${mod.section_name ? ` – ${mod.section_name}` : ""}` : String(m),
                };
              })}
              styles={{ valueContainer: (provided) => ({ ...provided, maxHeight: "120px", overflowY: "auto" }) }}
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