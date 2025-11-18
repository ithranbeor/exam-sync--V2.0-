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
  sectionId: number;
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
  const [selectedStartTime, setSelectedStartTime] = useState<string>("07:00");

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

        let schedulerCollegeName = "";
        if (collegeIds.length > 0) {
          const schedulerCollege = allColleges.find((c: any) => String(c.college_id) === collegeIds[0]);
          schedulerCollegeName = schedulerCollege?.college_name || "";
          setSchedulerCollegeName(schedulerCollegeName);
          console.log('Scheduler College Name:', schedulerCollegeName);
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

        const filteredDepartments = (allDepartments || []).filter((d: any) => {
          return collegeIds.includes(String(d.college_id));
        });
        
        const allowedDeptIds = filteredDepartments.map((d: any) => String(d.department_id));
        
        const filteredPrograms = (allPrograms || []).filter((p: any) => {
          return allowedDeptIds.includes(String(p.department_id));
        });

        const filteredExamPeriods = (allExamPeriods || []).filter((p: any) => 
          collegeIds.includes(String(p.college_id))
        );

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
          
          if (!isAllowedProgram) {
            return false;
          }
          
          return true;
        });

        setModalities(filteredMods);
      } catch (error) {
        console.error("Error lazy loading modalities:", error);
        setModalities([]);
      }
    };

    fetchModalitiesLazy();
  }, [formData.selectedPrograms, formData.selectedCourses, programs, departments, collegesCache, schedulerCollegeName]);

  const checkExistingSchedules = async (modalityIds: number[]): Promise<Set<number>> => {
    try {
      const response = await api.get('/tbl_examdetails', {
        params: {
          modality_id: modalityIds.join(',')
        }
      });

      const existingSchedules = response.data;
      
      const matchingSchedules = existingSchedules.filter((s: any) => 
        modalityIds.includes(s.modality_id)
      );

      return new Set(matchingSchedules.map((s: any) => s.modality_id) || []);
    } catch (error) {
      console.error("Error checking existing schedules:", error);
      return new Set();
    }
  };

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
    return courses;
  }, [formData.selectedPrograms, courses]);

  const filteredModalitiesBySelection = useMemo(() => {
    if (formData.selectedPrograms.length === 0 || formData.selectedCourses.length === 0) return [];
    return modalities.filter((m: any) =>
      formData.selectedPrograms.includes(m.program_id) && formData.selectedCourses.includes(m.course_id)
    );
  }, [formData.selectedPrograms, formData.selectedCourses, modalities]);

  useEffect(() => {
    if (uniqueAcademicYearTermOptions.length > 0 && !formData.academic_year) {
      setFormData(prev => ({ ...prev, academic_year: uniqueAcademicYearTermOptions[0].value }));
    }
    if (uniqueExamCategoryOptions.length > 0 && !formData.exam_category) {
      setFormData(prev => ({ ...prev, exam_category: uniqueExamCategoryOptions[0] }));
    }
  }, [uniqueAcademicYearTermOptions, uniqueExamCategoryOptions]);

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

  // ✅ ULTIMATE GENETIC ALGORITHM - Combines Supabase's superior logic + Fixed Start Time
  const generateRandomChromosome = (
    allSections: any[],
    sortedDates: string[],
    validTimes: string[],
    eveningTimeSlots: string[],
    sectionRoomsMap: Map<number, string[]>,
    totalDurationMinutes: number,
    getAvailableProctors: (date: string, time: string) => number[],
    sectionMap: Map<number, any>,
    courseDateAssignment: Map<string, string>,
    fixedStartTime: string
  ): Chromosome => {
    const chromosome: Chromosome = [];
    const courseTimeSlotAssignments = new Map<string, Map<string, string>>();
    const roomTimeRanges = new Map<string, Array<{ start: number; end: number }>>();
    const proctorTimeRanges = new Map<string, Array<{ start: number; end: number }>>();
    const scheduledSections = new Set<number>();
    
    // ✅ CRITICAL: Global year level tracking with buffer zones (from Supabase version)
    const globalTimeSlotYearLevels = new Map<string, Map<string, Set<string>>>();

    console.log(`🎯 Fixed Start Time for Day Classes: ${fixedStartTime}`);

    allSections.forEach(section => {
      if (scheduledSections.has(section.modality_id)) {
        return;
      }

      if (!sectionMap.has(section.modality_id)) {
        console.warn(`Section ${section.modality_id} not found in sectionMap. Skipping.`);
        return;
      }

      const yearLevel = extractYearLevel(section.section_name);
      const courseId = section.course_id;
      const programId = section.program_id;
      const isNightClass = section.is_night_class === "YES";

      // ✅ Determine valid time slots
      const validTimesForSection = isNightClass 
        ? eveningTimeSlots.filter(t => {
            const [h, m] = t.split(":").map(Number);
            const end = (h * 60 + m) + totalDurationMinutes;
            return end <= 21 * 60;
          })
        : [fixedStartTime]; // ✅ DAY CLASSES USE FIXED START TIME

      if (validTimesForSection.length === 0) {
        console.warn(`No valid time slots for section ${section.modality_id}`);
        return;
      }

      // ✅ Get/assign date for course
      let date = courseDateAssignment.get(courseId);
      if (!date || !sortedDates.includes(date)) {
        date = sortedDates[Math.floor(Math.random() * sortedDates.length)];
        courseDateAssignment.set(courseId, date);
      }

      // ✅ Get college ID
      const program = programs.find(p => p.program_id === programId);
      const departmentId = program ? String(program.department_id) : "unknown";
      const department = departments.find(d => String(d.department_id) === departmentId);
      const collegeId = department ? String(department.college_id) : "unknown";

      const courseKey = isNightClass ? `${courseId}_NIGHT` : courseId;
      
      if (!courseTimeSlotAssignments.has(courseKey)) {
        courseTimeSlotAssignments.set(courseKey, new Map());
      }

      let timeSlot: string;
      
      // ✅ CRITICAL: Check if course already has time slot assigned for this date
      if (courseTimeSlotAssignments.get(courseKey)!.has(date)) {
        timeSlot = courseTimeSlotAssignments.get(courseKey)!.get(date)!;
      } else {
        // ✅ SUPABASE'S SUPERIOR ALGORITHM: 20 attempts to find conflict-free slot
        timeSlot = validTimesForSection[Math.floor(Math.random() * validTimesForSection.length)];
        let attempts = 0;
        
        while (attempts < 20) {
          const startMinutes = timeToMinutes(timeSlot);
          let hasConflict = false;
          
          // ✅ Check all time slots this exam occupies
          const examSlots: string[] = [];
          for (let offset = 0; offset < totalDurationMinutes; offset += 30) {
            const slotMinutes = startMinutes + offset;
            const h = Math.floor(slotMinutes / 60);
            const m = slotMinutes % 60;
            examSlots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
          }
          
          // ✅ Check for year level conflicts in exam slots
          for (const slot of examSlots) {
            const globalKey = `${date}|${slot}`;
            if (!globalTimeSlotYearLevels.has(globalKey)) {
              globalTimeSlotYearLevels.set(globalKey, new Map());
            }
            
            const collegeYearMap = globalTimeSlotYearLevels.get(globalKey)!;
            if (collegeYearMap.has(collegeId)) {
              const yearLevels = collegeYearMap.get(collegeId)!;
              if (yearLevels.has(yearLevel)) {
                hasConflict = true;
                break;
              }
            }
          }
          
          // ✅ SUPABASE BUFFER LOGIC: Check slots BEFORE exam (prevent back-to-back)
          if (!hasConflict) {
            for (let offset = 30; offset <= totalDurationMinutes && !hasConflict; offset += 30) {
              const beforeMinutes = startMinutes - offset;
              if (beforeMinutes >= 0) {
                const h = Math.floor(beforeMinutes / 60);
                const m = beforeMinutes % 60;
                const beforeSlot = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
                const globalKey = `${date}|${beforeSlot}`;
                
                if (globalTimeSlotYearLevels.has(globalKey)) {
                  const collegeYearMap = globalTimeSlotYearLevels.get(globalKey)!;
                  if (collegeYearMap.has(collegeId)) {
                    const yearLevels = collegeYearMap.get(collegeId)!;
                    if (yearLevels.has(yearLevel)) {
                      hasConflict = true;
                      break;
                    }
                  }
                }
              }
            }
            
            // ✅ SUPABASE BUFFER LOGIC: Check slots AFTER exam (prevent back-to-back)
            for (let offset = 30; offset <= totalDurationMinutes && !hasConflict; offset += 30) {
              const afterMinutes = startMinutes + totalDurationMinutes + offset - 30;
              const h = Math.floor(afterMinutes / 60);
              const m = afterMinutes % 60;
              const afterSlot = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
              const globalKey = `${date}|${afterSlot}`;
              
              if (globalTimeSlotYearLevels.has(globalKey)) {
                const collegeYearMap = globalTimeSlotYearLevels.get(globalKey)!;
                if (collegeYearMap.has(collegeId)) {
                  const yearLevels = collegeYearMap.get(collegeId)!;
                  if (yearLevels.has(yearLevel)) {
                    hasConflict = true;
                    break;
                  }
                }
              }
            }
          }

          if (!hasConflict) break;
          
          timeSlot = validTimesForSection[Math.floor(Math.random() * validTimesForSection.length)];
          attempts++;
        }
        
        courseTimeSlotAssignments.get(courseKey)!.set(date, timeSlot);
        
        // ✅ REGISTER YEAR LEVEL WITH BUFFER ZONES (Supabase's superior approach)
        const startMinutes = timeToMinutes(timeSlot);
        
        // Register buffer BEFORE
        for (let offset = totalDurationMinutes; offset > 0; offset -= 30) {
          const slotMinutes = startMinutes - offset;
          if (slotMinutes >= 0) {
            const h = Math.floor(slotMinutes / 60);
            const m = slotMinutes % 60;
            const slot = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
            const globalKey = `${date}|${slot}`;
            
            if (!globalTimeSlotYearLevels.has(globalKey)) {
              globalTimeSlotYearLevels.set(globalKey, new Map());
            }
            const collegeYearMap = globalTimeSlotYearLevels.get(globalKey)!;
            if (!collegeYearMap.has(collegeId)) {
              collegeYearMap.set(collegeId, new Set());
            }
            collegeYearMap.get(collegeId)!.add(yearLevel);
          }
        }
        
        // Register actual exam slots
        for (let offset = 0; offset < totalDurationMinutes; offset += 30) {
          const slotMinutes = startMinutes + offset;
          const h = Math.floor(slotMinutes / 60);
          const m = slotMinutes % 60;
          const slot = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
          const globalKey = `${date}|${slot}`;
          
          if (!globalTimeSlotYearLevels.has(globalKey)) {
            globalTimeSlotYearLevels.set(globalKey, new Map());
          }
          const collegeYearMap = globalTimeSlotYearLevels.get(globalKey)!;
          if (!collegeYearMap.has(collegeId)) {
            collegeYearMap.set(collegeId, new Set());
          }
          collegeYearMap.get(collegeId)!.add(yearLevel);
        }
        
        // Register buffer AFTER
        for (let offset = 0; offset < totalDurationMinutes; offset += 30) {
          const slotMinutes = startMinutes + totalDurationMinutes + offset;
          const h = Math.floor(slotMinutes / 60);
          const m = slotMinutes % 60;
          const slot = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
          const globalKey = `${date}|${slot}`;
          
          if (!globalTimeSlotYearLevels.has(globalKey)) {
            globalTimeSlotYearLevels.set(globalKey, new Map());
          }
          const collegeYearMap = globalTimeSlotYearLevels.get(globalKey)!;
          if (!collegeYearMap.has(collegeId)) {
            collegeYearMap.set(collegeId, new Set());
          }
          collegeYearMap.get(collegeId)!.add(yearLevel);
        }
      }

      // ✅ Room assignment
      const startMinutes = timeToMinutes(timeSlot);
      const endMinutes = startMinutes + totalDurationMinutes;
      const suitableRooms = sectionRoomsMap.get(section.modality_id) || [];
      let roomId = "";

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

      if (!roomId && suitableRooms.length > 0) {
        roomId = suitableRooms[Math.floor(Math.random() * suitableRooms.length)];
      }

      // ✅ Proctor assignment - prioritize instructor for night classes
      let proctorId = -1;

      if (isNightClass && section.instructor_id) {
        const availableProctors = getAvailableProctors(date, timeSlot);
        if (availableProctors.includes(section.instructor_id)) {
          const proctorDateKey = `${date}|${section.instructor_id}`;
          const existingRanges = proctorTimeRanges.get(proctorDateKey) || [];
          if (!existingRanges.some(range => rangesOverlap(startMinutes, endMinutes, range.start, range.end))) {
            proctorId = section.instructor_id;
            if (!proctorTimeRanges.has(proctorDateKey)) proctorTimeRanges.set(proctorDateKey, []);
            proctorTimeRanges.get(proctorDateKey)!.push({ start: startMinutes, end: endMinutes });
          }
        }
      }

      if (proctorId === -1) {
        const availableProctors = getAvailableProctors(date, timeSlot);
        
        if (availableProctors.length === 0) {
          console.warn(`No available proctors for ${date} at ${timeSlot}`);
        } else {
          for (const proctor of availableProctors) {
            const proctorDateKey = `${date}|${proctor}`;
            const existingRanges = proctorTimeRanges.get(proctorDateKey) || [];
            if (!existingRanges.some(range => rangesOverlap(startMinutes, endMinutes, range.start, range.end))) {
              proctorId = proctor;
              if (!proctorTimeRanges.has(proctorDateKey)) proctorTimeRanges.set(proctorDateKey, []);
              proctorTimeRanges.get(proctorDateKey)!.push({ start: startMinutes, end: endMinutes });
              break;
            }
          }
          
          if (proctorId === -1 && availableProctors.length > 0) {
            proctorId = availableProctors[Math.floor(Math.random() * availableProctors.length)];
          }
        }
      }

      scheduledSections.add(section.modality_id);
      chromosome.push({ sectionId: section.modality_id, date, timeSlot, roomId, proctorId });
    });

    return chromosome;
  };

  const calculateFitness = (
    chromosome: Chromosome,
    sectionMap: Map<number, any>,
    totalDurationMinutes: number,
    programs: any[],
    departments: any[]
  ): number => {
    let fitness = 0;

    const roomTimeRanges = new Map<string, Array<{ start: number; end: number; sectionId: number }>>();
    const proctorTimeRanges = new Map<string, Array<{ start: number; end: number; sectionId: number; deptId: string }>>();
    const studentSchedule = new Map<string, Set<string>>();
    const sectionScheduledCount = new Map<number, number>();
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
        existingRanges.push({ start: startMinutes, end: endMinutes, sectionId: gene.sectionId });
      }

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
          sectionId: gene.sectionId,
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
    sectionMap: Map<number, any>,
    sortedDates: string[],
    validTimes: string[],
    eveningTimeSlots: string[],
    sectionRoomsMap: Map<number, string[]>,
    getAvailableProctors: (date: string, time: string) => number[],
    mutationRate: number,
    fixedStartTime: string
  ): Chromosome => {
    const courseDateMap = new Map<string, string>();
    chromosome.forEach(gene => {
      const section = sectionMap.get(gene.sectionId);
      if (section) {
        const courseId = section.course_id;
        if (!courseDateMap.has(courseId)) {
          courseDateMap.set(courseId, gene.date);
        }
      }
    });

    return chromosome.map(gene => {
      if (Math.random() < mutationRate) {
        const section = sectionMap.get(gene.sectionId);
        if (!section) return { ...gene };

        const courseId = section.course_id;
        const isNightClass = section.is_night_class === "YES";
        const mutationType = Math.floor(Math.random() * 4);
        const suitableRooms = sectionRoomsMap.get(gene.sectionId) || [];

        const totalDurationMinutes = duration.hours * 60 + duration.minutes;
        const validTimesForSection = isNightClass 
          ? eveningTimeSlots.filter(t => {
              const [h, m] = t.split(":").map(Number);
              const end = (h * 60 + m) + totalDurationMinutes;
              return end <= 21 * 60;
            })
          : [fixedStartTime]; // ✅ Day classes use fixed start time

        if (mutationType === 0 && Math.random() < 0.3) {
          const newDate = sortedDates[Math.floor(Math.random() * sortedDates.length)];
          courseDateMap.set(courseId, newDate);
          
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
          // ✅ For day classes, don't mutate time (keep fixed)
          if (isNightClass) {
            const newTimeSlot = validTimesForSection[Math.floor(Math.random() * validTimesForSection.length)];
            const availableProctors = getAvailableProctors(gene.date, newTimeSlot);
            
            let newProctorId = -1;
            
            if (section.instructor_id && availableProctors.includes(section.instructor_id)) {
              newProctorId = section.instructor_id;
            } else {
              newProctorId = availableProctors.length > 0
                ? availableProctors[Math.floor(Math.random() * availableProctors.length)]
                : -1;
            }
            
            return { ...gene, timeSlot: newTimeSlot, proctorId: newProctorId };
          }
          return { ...gene };
        } else if (mutationType === 2) {
          const newRoomId = suitableRooms.length > 0
            ? suitableRooms[Math.floor(Math.random() * suitableRooms.length)]
            : "";
          return { ...gene, roomId: newRoomId };
        } else {
          const availableProctors = getAvailableProctors(gene.date, gene.timeSlot);
          let newProctorId = -1;
          
          if (isNightClass && section.instructor_id && availableProctors.includes(section.instructor_id)) {
            newProctorId = section.instructor_id;
          } else {
            newProctorId = availableProctors.length > 0
              ? availableProctors[Math.floor(Math.random() * availableProctors.length)]
              : -1;
          }
          
          return { ...gene, proctorId: newProctorId };
        }
      }
      return { ...gene };
    });
  };

  const assignExamSchedules = async () => {
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

    const allAvailableTimeSlots = [
      ...TIME_SLOT_RANGES["7 AM - 1 PM (Morning)"],
      ...TIME_SLOT_RANGES["1 PM - 6 PM (Afternoon)"],
      ...TIME_SLOT_RANGES["6 PM - 9 PM (Evening)"]
    ];

    console.log('✅ Available time slots:', allAvailableTimeSlots);
    console.log('🎯 FIXED START TIME FOR DAY CLASSES:', selectedStartTime);

    const availabilityMap = new Map<string, Set<number>>();
    allAvailability?.forEach(a => {
      const proctorId = a.user_id;
      const daysArray = a.days || [];
      const timeSlotsArray = a.time_slots || [];

      daysArray.forEach((dateStr: string) => {
        const isoDate = dateStr.split('T')[0];
        
        timeSlotsArray.forEach((timeSlotPeriod: string) => {
          const specificTimes = TIME_SLOT_RANGES[timeSlotPeriod] || [];
          specificTimes.forEach(slot => {
            const key = `${isoDate}|${slot}`;
            if (!availabilityMap.has(key)) {
              availabilityMap.set(key, new Set());
            }
            availabilityMap.get(key)!.add(proctorId);
          });
        });
      });
    });

    const getAvailableProctors = (date: string, startTime: string): number[] => {
      const isoDate = date.split('T')[0];
      
      const examTimeSlots = getTimeSlots(startTime, totalDurationMinutes);
      const proctorSets = examTimeSlots.map(slot => {
        const key = `${isoDate}|${slot}`;
        return availabilityMap.get(key) || new Set<number>();
      });
      
      if (proctorSets.length === 0) return [];
      
      return Array.from(proctorSets[0]).filter(proctorId =>
        proctorSets.every(set => set.has(proctorId))
      );
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

    const existingScheduledIds = await checkExistingSchedules(formData.selectedModalities);

    if (existingScheduledIds.size > 0) {
      const count = existingScheduledIds.size;
      toast.error(
        `${count} section${count > 1 ? 's are' : ' is'} already scheduled. Please deselect them.`,
        { autoClose: 5000 }
      );
      return;
    }

    const allSections: any[] = [];
    const sectionMap = new Map<number, any>();
    formData.selectedModalities.forEach(modalityId => {
      const selectedModality = modalities.find(m => m.modality_id === modalityId);
      if (selectedModality) {
        const sectionCourseData = sectionCourses.find(
          sc => sc.program_id === selectedModality.program_id &&
                sc.course_id === selectedModality.course_id &&
                sc.section_name === selectedModality.section_name
        );
        
        const enrichedSection = {
          ...selectedModality,
          is_night_class: sectionCourseData?.is_night_class ?? null,
          instructor_id: sectionCourseData?.user_id ?? null
        };
        
        allSections.push(enrichedSection);
        sectionMap.set(modalityId, enrichedSection);
      }
    });

    const eveningTimeSlots = TIME_SLOT_RANGES["6 PM - 9 PM (Evening)"];
    const morningTimeSlots = TIME_SLOT_RANGES["7 AM - 1 PM (Morning)"];
    const afternoonTimeSlots = TIME_SLOT_RANGES["1 PM - 6 PM (Afternoon)"];

    console.log('🌅 Morning slots:', morningTimeSlots);
    console.log('🌤️ Afternoon slots:', afternoonTimeSlots);
    console.log('🌙 Evening slots:', eveningTimeSlots);

    // ✅ Validate selected start time
    const [startHour, startMin] = selectedStartTime.split(":").map(Number);
    const examEndMinutes = (startHour * 60 + startMin) + totalDurationMinutes;
    const maxEndTime = 21 * 60;

    if (examEndMinutes > maxEndTime) {
      alert(`Error: Exams starting at ${selectedStartTime} with duration ${totalDurationMinutes} minutes would end after 9:00 PM.\n\nPlease either:\n1. Choose an earlier start time, or\n2. Reduce the exam duration`);
      return;
    }

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
      
      return !eveningTimeSlots.includes(startTime);
    };

    const validTimes = [selectedStartTime].filter(t => isValidTimeSlot(t, false));
    
    if (validTimes.length === 0) {
      alert(`Error: The selected start time ${selectedStartTime} is not valid for the exam duration of ${totalDurationMinutes} minutes.`);
      return;
    }

    console.log(`✅ Valid start time for day classes: ${validTimes[0]}`);
    console.log(`✅ Valid start times for night classes:`, eveningTimeSlots.filter(t => isValidTimeSlot(t, true)));

    const sectionRoomsMap = new Map<number, string[]>();
    allSections.forEach(section => {
      const enrolledCount = section.enrolled_students ?? 0;
      const possibleRooms = section.possible_rooms ?? [];
      
      const allSuitable = Array.from(roomCapacityMap.entries())
        .filter(([_, capacity]) => capacity >= enrolledCount)
        .map(([id, _]) => id)
        .sort((a, b) => {
          const capA = roomCapacityMap.get(a) || 0;
          const capB = roomCapacityMap.get(b) || 0;
          const wasteA = Math.abs(capA - enrolledCount);
          const wasteB = Math.abs(capB - enrolledCount);
          return wasteA - wasteB;
        });
      
      const preferred = possibleRooms.filter((r: string) => allSuitable.includes(r));
      const others = allSuitable.filter(r => !preferred.includes(r));
      const allRoomsForSection = [...preferred, ...others];
      
      sectionRoomsMap.set(section.modality_id, allRoomsForSection);
    });

    const violations: string[] = [];
    const maxRoomCapacity = Math.max(...Array.from(roomCapacityMap.values()));
    
    allSections.forEach(section => {
      const enrolledCount = section.enrolled_students ?? 0;
      if (enrolledCount > maxRoomCapacity) {
        violations.push(
          `Section ${section.course_id} - ${section.section_name} (${enrolledCount} students) exceeds maximum room capacity (${maxRoomCapacity})`
        );
      }
      
      const suitableRooms = sectionRoomsMap.get(section.modality_id) || [];
      if (suitableRooms.length === 0) {
        violations.push(
          `Section ${section.course_id} - ${section.section_name} has no available rooms (needs capacity for ${enrolledCount} students)`
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
      violations.push(`No proctors available for: ${formattedDates}\n\nPlease ensure proctors have set their availability for these dates and time slots.`);
    }

    allSections.forEach(section => {
      if (section.is_night_class === "YES") {
        const validEveningSlots = eveningTimeSlots.filter(slot => {
          const [h, m] = slot.split(":").map(Number);
          const end = (h * 60 + m) + totalDurationMinutes;
          return end <= 21 * 60;
        });
        
        if (validEveningSlots.length === 0) {
          violations.push(
            `Night class ${section.course_id} - ${section.section_name} cannot be scheduled: exam duration too long`
          );
        }
        
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
              `Night class ${section.course_id} - ${section.section_name}: Instructor has no evening availability`
            );
          }
        }
      }
    });

    if (violations.length > 0) {
      alert(`Cannot generate schedule:\n\n${violations.join("\n\n")}`);
      return;
    }

    const courseDateAssignment = new Map<string, string>();
    const sectionsByCourse = new Map<string, any[]>();
    allSections.forEach(section => {
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

    console.log("🧬 Starting genetic algorithm...");
    console.log(`📊 Scheduling ${allSections.length} sections`);
    console.log(`⏰ Fixed start time: ${selectedStartTime}`);
    
    toast.info("Generating schedule...", { autoClose: 2000 });

    let population: Chromosome[] = [];
    for (let i = 0; i < POPULATION_SIZE; i++) {
      population.push(generateRandomChromosome(
        allSections,
        sortedDates,
        validTimes,
        eveningTimeSlots,
        sectionRoomsMap,
        totalDurationMinutes,
        getAvailableProctors,
        sectionMap,
        courseDateAssignment,
        selectedStartTime
      ));
    }

    let bestChromosome: Chromosome | null = null;
    let bestFitness = -Infinity;

    for (let generation = 0; generation < GENERATIONS; generation++) {
      if (generation % YIELD_EVERY_N_GENERATIONS === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }

      const fitnesses = population.map(c => calculateFitness(c, sectionMap, totalDurationMinutes, programs, departments));
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
        nextPopulation.push(mutate(child1, sectionMap, sortedDates, validTimes, eveningTimeSlots, sectionRoomsMap, getAvailableProctors, MUTATION_RATE, selectedStartTime));
        if (nextPopulation.length < POPULATION_SIZE) {
          nextPopulation.push(mutate(child2, sectionMap, sortedDates, validTimes, eveningTimeSlots, sectionRoomsMap, getAvailableProctors, MUTATION_RATE, selectedStartTime));
        }
      }

      population = nextPopulation;
    }

    if (!bestChromosome) {
      alert("Could not find a valid schedule.");
      return;
    }

    console.log(`✅ Evolution complete! Final fitness: ${bestFitness}`);

    const scheduledExams: any[] = [];
    const unscheduledSections: string[] = [];
    const finalRoomTimeRanges = new Map<string, Array<{ start: number; end: number; course: string; section: string }>>();
    const finalProctorTimeRanges = new Map<string, Array<{ start: number; end: number; course: string; section: string }>>();
    const finalCourseDates = new Map<string, Set<string>>();

    for (const gene of bestChromosome) {
      const section = sectionMap.get(gene.sectionId);
      if (!section) continue;

      const { date, timeSlot, roomId, proctorId } = gene;
      const courseId = section.course_id;

      if (!allAvailableTimeSlots.includes(timeSlot)) {
        console.error(`❌ Invalid time slot ${timeSlot}`);
        unscheduledSections.push(`${section.course_id} - ${section.section_name} (invalid time)`);
        continue;
      }

      const [startHour, startMinute] = timeSlot.split(":").map(Number);
      const startMinutes = timeToMinutes(timeSlot);
      const endMinutes = startMinutes + totalDurationMinutes;
      
      if (endMinutes > 21 * 60) {
        console.error(`❌ Exam would end after 21:00`);
        unscheduledSections.push(`${section.course_id} - ${section.section_name} (ends after 9 PM)`);
        continue;
      }

      if (!roomId || proctorId === -1) {
        unscheduledSections.push(`${section.course_id} - ${section.section_name}`);
        continue;
      }

      if (!finalCourseDates.has(courseId)) {
        finalCourseDates.set(courseId, new Set());
      }
      finalCourseDates.get(courseId)!.add(date);

      if (finalCourseDates.get(courseId)!.size > 1) {
        console.warn(`⚠️ Course split: ${courseId}`);
        unscheduledSections.push(`${section.course_id} - ${section.section_name} (split dates)`);
        continue;
      }

      const matchedPeriod = examPeriods.find(p => {
        const start = new Date(p.start_date);
        const end = new Date(p.end_date);
        return new Date(date) >= start && new Date(date) <= end;
      });

      if (!matchedPeriod) {
        unscheduledSections.push(`${section.course_id} - ${section.section_name} (no period)`);
        continue;
      }

      const endHour = startHour + Math.floor((startMinute + totalDurationMinutes) / 60);
      const endMinute = (startMinute + totalDurationMinutes) % 60;
      const endTime = `${String(endHour).padStart(2, "0")}:${String(endMinute).padStart(2, "0")}`;

      let hasOverlap = false;

      const roomDateKey = `${date}|${roomId}`;
      const existingRoomRanges = finalRoomTimeRanges.get(roomDateKey) || [];
      for (const existing of existingRoomRanges) {
        if (rangesOverlap(startMinutes, endMinutes, existing.start, existing.end)) {
          console.warn(`⚠️ Room overlap`);
          hasOverlap = true;
          break;
        }
      }

      const proctorDateKey = `${date}|${proctorId}`;
      const existingProctorRanges = finalProctorTimeRanges.get(proctorDateKey) || [];
      for (const existing of existingProctorRanges) {
        if (rangesOverlap(startMinutes, endMinutes, existing.start, existing.end)) {
          console.warn(`⚠️ Proctor overlap`);
          hasOverlap = true;
          break;
        }
      }

      if (hasOverlap) {
        unscheduledSections.push(`${section.course_id} - ${section.section_name} (overlap)`);
        continue;
      }

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

      const startTimestamp = `${date}T${timeSlot}:00Z`;
      const endTimestamp = `${date}T${endTime}:00Z`;

      const sectionObj = sectionCourses.find(
        sc => sc.program_id === section.program_id &&
          sc.course_id === section.course_id &&
          sc.section_name === section.section_name
      );
      const instructorId = sectionObj?.user_id ?? null;

      const buildingId = roomToBuildingMap.get(roomId);
      const buildingName = buildingId ? buildingMap.get(buildingId) : "Unknown Building";

      if (!roomId || roomId.trim() === "") {
        console.error(`❌ Empty room_id`);
        unscheduledSections.push(`${section.course_id} - ${section.section_name} (no room)`);
        continue;
      }

      scheduledExams.push({
        program_id: section.program_id,
        course_id: section.course_id,
        modality_id: section.modality_id,
        room_id: roomId,
        section_name: section.section_name,
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
        instructor_id: instructorId,
        proctor_timein: null,
        proctor_timeout: null,
      });
    }

    if (unscheduledSections.length > 0) {
      const message = `Could not schedule ${unscheduledSections.length} section(s):\n\n${unscheduledSections.slice(0, 10).join("\n")}${unscheduledSections.length > 10 ? `\n...${unscheduledSections.length - 10} more` : ""}\n\nScheduled: ${scheduledExams.length}/${allSections.length}`;
      if (scheduledExams.length === 0) {
        alert(message + "\n\nNo schedules to save.");
        return;
      }
      const proceed = globalThis.confirm(message + "\n\nSave partial schedule?");
      if (!proceed) return;
    }

    const invalidSchedules = scheduledExams.filter(exam => !exam.room_id || exam.room_id.trim() === "");
    if (invalidSchedules.length > 0) {
      console.error("❌ Empty room_id:", invalidSchedules);
      alert(`Error: ${invalidSchedules.length} schedule(s) have no room.`);
      return;
    }

    if (scheduledExams.length === 0) {
      alert("No valid schedules to save.");
      return;
    }

    console.log(`💾 Saving ${scheduledExams.length} schedules...`);
    console.log(`📊 Time distribution:`, scheduledExams.reduce((acc, exam) => {
      const time = exam.exam_start_time.slice(11, 16);
      acc[time] = (acc[time] || 0) + 1;
      return acc;
    }, {} as Record<string, number>));

    const dayClassSchedules = scheduledExams.filter(exam => {
      const section = sectionMap.get(exam.modality_id);
      return section && section.is_night_class !== "YES";
    });
    
    const incorrectStartTimes = dayClassSchedules.filter(exam => 
      exam.exam_start_time.slice(11, 16) !== selectedStartTime
    );
    
    if (incorrectStartTimes.length > 0) {
      console.error(`❌ ${incorrectStartTimes.length} day classes with wrong start time`);
    } else {
      console.log(`✅ All ${dayClassSchedules.length} day classes start at ${selectedStartTime}`);
    }

    try {
      await api.post('/tbl_examdetails', scheduledExams);
      toast.success(`Successfully scheduled ${scheduledExams.length}/${allSections.length} sections!`);
      console.log(`✅ Saved ${scheduledExams.length} schedules`);
      
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
            <label className="label">
              Exam Start Time 
              <span style={{ fontSize: '12px', color: '#666', marginLeft: '8px' }}>
                (All day classes will start at this time)
              </span>
            </label>
            <CreatableSelect
              value={
                selectedStartTime
                  ? { value: selectedStartTime, label: selectedStartTime }
                  : { value: "07:00", label: "07:00" }
              }
              onChange={(selected) =>
                setSelectedStartTime(selected ? selected.value : "07:00")
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
          <h3 className="preview-header">Selected Modality Preview ({formData.selectedModalities.length})</h3>
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
                  const searchString = [course?.course_id, modality?.section_name, modality?.modality_type].join(' ').toLowerCase();
                  return { modality, course, searchString, modalityId };
                })
                .filter(item => !modalityPreviewSearchTerm || item.searchString.includes(modalityPreviewSearchTerm.toLowerCase()))
                .map(({ modality, course, modalityId }) => (
                  <div key={modalityId} className="modality-item">
                    <p className="modality-detail">Course: {course ? course.course_id : 'N/A'}</p>
                    <p className="modality-detail">Section: {modality?.section_name ?? 'N/A'}</p>
                    <p className="modality-detail">Modality Type: {modality?.modality_type ?? 'N/A'}</p>
                    <p className="modality-detail">Remarks: {modality?.modality_remarks ?? 'N/A'}</p>
                    <hr className="modality-divider" />
                  </div>
                ))}
            </div>
          ) : (
            <p className="helper">Select one or more modalities to see a preview.</p>
          )}
        </div>
      </div>

      <div className="save-button-wrapper">
        <button
          type="button"
          onClick={handleSaveClick}
          className="btn-save"
          disabled={loading}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", fontSize: "20px", width: "45px" }}
        >
          {loading ? <FaSpinner className="spin" /> : <FaPlay />}
        </button>
      </div>
      <ToastContainer position="top-center" autoClose={3000} />
    </div>
  );
};

export default SchedulerPlottingSchedule;