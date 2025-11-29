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

interface RoomTimeRange {
  start: number;
  end: number;
  sectionId: number;
  studentCount: number;
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
  const [selectedStartTime, setSelectedStartTime] = useState<string>("07:00");

  const [alreadyScheduledIds, setAlreadyScheduledIds] = useState<Set<number>>(new Set());
  const [roomOptions, _setRoomOptions] = useState<{ room_id: string; room_name: string; room_type: string; room_capacity: number; building_id?: string }[]>([]);

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
        
        const allowedDeptIds = filteredDepartments.map((d: any) => String(d.department_id));
        
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
          return formData.selectedPrograms.includes(m.program_id);
        });

        setModalities(filteredMods);
      } catch (error) {
        console.error("Error lazy loading modalities:", error);
        setModalities([]);
      }
    };

    fetchModalitiesLazy();
  }, [formData.selectedPrograms, formData.selectedCourses]);

  useEffect(() => {
    const checkExistingSchedules = async () => {
      if (formData.selectedModalities.length === 0) {
        setAlreadyScheduledIds(new Set());
        return;
      }

      try {
        // Check each modality individually to avoid backend parsing issues
        const scheduledIds = new Set<number>();
        
        // Process in batches to avoid overwhelming the backend
        for (const modalityId of formData.selectedModalities) {
          try {
            const response = await api.get('/tbl_examdetails', {
              params: { modality_id: modalityId }
            });

            // If we get data back, this modality is already scheduled
            if (response.data && response.data.length > 0) {
              scheduledIds.add(Number(modalityId));
            }
          } catch (error: any) {
            // 404 means not scheduled yet (which is fine)
            // Other errors we log but don't block
            if (error.response?.status !== 404) {
              console.warn(`Error checking modality ${modalityId}:`, error.message);
            }
          }
        }
        
        setAlreadyScheduledIds(scheduledIds);
        
        if (scheduledIds.size > 0) {
          console.log(`⚠️ ${scheduledIds.size} section(s) already scheduled`);
        }
      } catch (error: any) {
        console.error('Error checking schedules:', error);
        // Don't block the UI, just log the error
        setAlreadyScheduledIds(new Set());
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

  // ✅ IMPROVED: Room assignment logic with proper capacity sharing
  const assignRoomsToSections = (
    sections: any[],
    possibleRooms: string[],
    roomCapacityMap: Map<string, number>
  ): Map<number, string> => {
    const sectionRoomMap = new Map<number, string>();
    
    // Sort sections by student count (descending) to place larger sections first
    const sortedSections = [...sections].sort((a, b) => 
      (b.enrolled_students || 0) - (a.enrolled_students || 0)
    );

    // Sort rooms by capacity (descending)
    const sortedRooms = [...possibleRooms].sort((a, b) => 
      (roomCapacityMap.get(b) || 0) - (roomCapacityMap.get(a) || 0)
    );

    // Track current occupancy per room
    const roomOccupancy = new Map<string, number>();
    sortedRooms.forEach(roomId => roomOccupancy.set(roomId, 0));

    for (const section of sortedSections) {
      const neededCapacity = section.enrolled_students || 0;
      let assigned = false;

      // Try to find a room that can accommodate this section
      for (const roomId of sortedRooms) {
        const roomCapacity = roomCapacityMap.get(roomId) || 0;
        const currentOccupancy = roomOccupancy.get(roomId) || 0;

        if (currentOccupancy + neededCapacity <= roomCapacity) {
          sectionRoomMap.set(section.modality_id, roomId);
          roomOccupancy.set(roomId, currentOccupancy + neededCapacity);
          assigned = true;
          break;
        }
      }

      if (!assigned) {
        console.warn(`⚠️ Could not assign room for section ${section.modality_id} (${neededCapacity} students)`);
      }
    }

    return sectionRoomMap;
  };

  const generateRandomChromosome = (
    allSections: any[],
    sortedDates: string[],
    validTimes: string[],
    eveningTimeSlots: string[],
    sectionRoomsMap: Map<number, string[]>,
    totalDurationMinutes: number,
    getAvailableProctors: (date: string, time: string) => number[],
    sectionMap: Map<number, any>,
    courseDateAssignment: Map<string, string>
  ): Chromosome => {
    const chromosome: Chromosome = [];
    const roomTimeRanges = new Map<string, Array<{ start: number; end: number; sectionId: number; studentCount: number }>>();
    const proctorTimeRanges = new Map<string, Array<{
      start: number;
      end: number;
      sectionId: number;
      deptId: string;
    }>>();
    const scheduledSections = new Set<number>();
    const globalTimeSlotYearLevels = new Map<string, Map<string, Set<string>>>();

    const getRoomCurrentOccupancy = (roomId: string, date: string, startMin: number, endMin: number): number => {
      const roomDateKey = `${date}|${roomId}`;
      const existingRanges = roomTimeRanges.get(roomDateKey) || [];
      
      return existingRanges
        .filter(range => rangesOverlap(startMin, endMin, range.start, range.end))
        .reduce((sum, range) => sum + (range.studentCount || 0), 0);
    };

    // Group sections by course and night class status
    const sectionsByCourseType = new Map<string, any[]>();
    allSections.forEach(section => {
      const isNightClass = section.is_night_class === "YES";
      const courseKey = isNightClass ? `${section.course_id}_NIGHT` : section.course_id;
      
      if (!sectionsByCourseType.has(courseKey)) {
        sectionsByCourseType.set(courseKey, []);
      }
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

      // ✅ NEW: Assign rooms based on capacity
      const roomCapacityMap = new Map<string, number>();
      const allPossibleRooms = new Set<string>();
      
      sections.forEach((section: any) => {
        const possibleRooms = sectionRoomsMap.get(section.modality_id) || [];
        possibleRooms.forEach(roomId => {
          allPossibleRooms.add(roomId);
          if (!roomCapacityMap.has(roomId)) {
            const room = roomOptions.find(r => r.room_id === roomId);
            if (room) {
              roomCapacityMap.set(roomId, room.room_capacity);
            }
          }
        });
      });

      // Assign rooms to sections based on capacity
      const sectionRoomAssignments = assignRoomsToSections(
        sections,
        Array.from(allPossibleRooms),
        roomCapacityMap
      );

      // Find a valid time slot
      let foundTimeSlot = false;
      const maxAttempts = validTimesForCourse.length * 3;
      
      for (let attempt = 0; attempt < maxAttempts && !foundTimeSlot; attempt++) {
        const candidateTime = validTimesForCourse[Math.floor(Math.random() * validTimesForCourse.length)];
        const startMinutes = timeToMinutes(candidateTime);
        const endMinutes = startMinutes + totalDurationMinutes;
        
        let canFitAllSections = true;

        // Validate each section can fit in its assigned room
        for (const section of sections) {
          const assignedRoom = sectionRoomAssignments.get(section.modality_id);
          if (!assignedRoom) {
            canFitAllSections = false;
            break;
          }

          const roomCapacity = roomCapacityMap.get(assignedRoom) || 0;
          const currentOccupancy = getRoomCurrentOccupancy(assignedRoom, date, startMinutes, endMinutes);
          const neededCapacity = section.enrolled_students || 0;

          if (currentOccupancy + neededCapacity > roomCapacity) {
            canFitAllSections = false;
            break;
          }
        }
        
        if (canFitAllSections) {
          // Mark rooms as occupied
          sections.forEach((section: any) => {
            const assignedRoom = sectionRoomAssignments.get(section.modality_id);
            if (assignedRoom) {
              const roomDateKey = `${date}|${assignedRoom}`;
              if (!roomTimeRanges.has(roomDateKey)) {
                roomTimeRanges.set(roomDateKey, []);
              }
              roomTimeRanges.get(roomDateKey)!.push({
                start: startMinutes,
                end: endMinutes,
                sectionId: section.modality_id,
                studentCount: section.enrolled_students || 0
              });
            }
          });

          courseTypeTimeSlots.set(courseKey, { date, timeSlot: candidateTime });
          foundTimeSlot = true;
        }
      }
      
      if (!foundTimeSlot && validTimesForCourse.length > 0) {
        const timeSlot = validTimesForCourse[Math.floor(Math.random() * validTimesForCourse.length)];
        courseTypeTimeSlots.set(courseKey, { date, timeSlot });
      }
    });

    // Schedule all sections using their assigned course time slot
    allSections.forEach(section => {
      if (scheduledSections.has(section.modality_id)) {
        return;
      }

      if (!sectionMap.has(section.modality_id)) {
        console.warn(`Section ${section.modality_id} not found in sectionMap. Skipping.`);
        return;
      }

      const isNightClass = section.is_night_class === "YES";
      const courseKey = isNightClass ? `${section.course_id}_NIGHT` : section.course_id;
      
      const assignment = courseTypeTimeSlots.get(courseKey);
      if (!assignment) {
        console.warn(`No time slot assigned for course ${courseKey}`);
        return;
      }

      const { date, timeSlot } = assignment;
      const startMinutes = timeToMinutes(timeSlot);
      const endMinutes = startMinutes + totalDurationMinutes;

      // Get assigned room
      const possibleRooms = sectionRoomsMap.get(section.modality_id) || [];
      const roomCapacityMap = new Map<string, number>();
      possibleRooms.forEach(roomId => {
        const room = roomOptions.find(r => r.room_id === roomId);
        if (room) {
          roomCapacityMap.set(roomId, room.room_capacity);
        }
      });

      const sectionRoomAssignments = assignRoomsToSections(
        [section],
        possibleRooms,
        roomCapacityMap
      );

      let roomId = sectionRoomAssignments.get(section.modality_id) || "";

      // Fallback
      if (!roomId && possibleRooms.length > 0) {
        roomId = possibleRooms[0];
      }

      // Year level tracking
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
        if (!globalTimeSlotYearLevels.has(globalKey)) {
          globalTimeSlotYearLevels.set(globalKey, new Map());
        }
        const collegeYearMap = globalTimeSlotYearLevels.get(globalKey)!;
        if (!collegeYearMap.has(collegeId)) {
          collegeYearMap.set(collegeId, new Set());
        }
        collegeYearMap.get(collegeId)!.add(yearLevel);
      }

      // Proctor assignment
      let proctorId = -1;
      
      if (isNightClass && section.instructor_id) {
        const availableProctors = getAvailableProctors(date, timeSlot);
        if (availableProctors.includes(section.instructor_id)) {
          const proctorDateKey = `${date}|${section.instructor_id}`;
          const existingRanges = proctorTimeRanges.get(proctorDateKey) || [];
          if (!existingRanges.some(range => rangesOverlap(startMinutes, endMinutes, range.start, range.end))) {
            proctorId = section.instructor_id;
            if (!proctorTimeRanges.has(proctorDateKey)) proctorTimeRanges.set(proctorDateKey, []);
            proctorTimeRanges.get(proctorDateKey)!.push({ start: startMinutes, end: endMinutes, sectionId: section.modality_id, deptId: departmentId });
          }
        }
      }

      if (proctorId === -1) {
        const availableProctors = getAvailableProctors(date, timeSlot);
        
        if (availableProctors.length > 0) {
          for (const proctor of availableProctors) {
            const proctorDateKey = `${date}|${proctor}`;
            const existingRanges = proctorTimeRanges.get(proctorDateKey) || [];
            if (!existingRanges.some(range => rangesOverlap(startMinutes, endMinutes, range.start, range.end))) {
              proctorId = proctor;
              if (!proctorTimeRanges.has(proctorDateKey)) proctorTimeRanges.set(proctorDateKey, []);
              proctorTimeRanges.get(proctorDateKey)!.push({ start: startMinutes, end: endMinutes, sectionId: section.modality_id, deptId: departmentId });
              break;
            }
          }
          
          if (proctorId === -1) {
            proctorId = availableProctors[Math.floor(Math.random() * availableProctors.length)];
          }
        }
      }

      // Add to chromosome
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

    const roomTimeRanges = new Map<string, RoomTimeRange[]>();
    const proctorTimeRanges = new Map<string, Array<{
      start: number;
      end: number;
      sectionId: number;
      deptId: string;
    }>>();
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

      // Room capacity validation
      if (!roomId) {
        fitness -= 8000;
      } else {
        const roomDateKey = `${date}|${roomId}`;
        if (!roomTimeRanges.has(roomDateKey)) {
          roomTimeRanges.set(roomDateKey, []);
        }
        const existingRanges = roomTimeRanges.get(roomDateKey)!;
        
        const room = roomOptions.find(r => r.room_id === roomId);
        const roomCapacity = room?.room_capacity || 0;
        
        let currentOccupancy = 0;
        
        existingRanges.forEach(existing => {
          if (rangesOverlap(startMinutes, endMinutes, existing.start, existing.end)) {
            currentOccupancy += existing.studentCount;
          }
        });
        
        const sectionStudents = section.enrolled_students || 0;
        if (currentOccupancy + sectionStudents > roomCapacity) {
          fitness -= 20000;
        } else {
          if (currentOccupancy > 0) {
            fitness += 1000; // Reward efficient room sharing
          }
        }
        
        existingRanges.push({ 
          start: startMinutes, 
          end: endMinutes, 
          sectionId: gene.sectionId,
          studentCount: sectionStudents
        });
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
          sectionId: gene.sectionId,
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
    sectionMap: Map<number, any>,
    sortedDates: string[],
    validTimes: string[],
    eveningTimeSlots: string[],
    sectionRoomsMap: Map<number, string[]>,
    getAvailableProctors: (date: string, time: string) => number[],
    mutationRate: number,
    totalDurationMinutes: number
  ): Chromosome => {
    const roomTimeRanges = new Map<string, Array<{ start: number; end: number; sectionId: number; studentCount: number }>>();
    
    chromosome.forEach(gene => {
      const section = sectionMap.get(gene.sectionId);
      if (!section) return;
      
      const startMinutes = timeToMinutes(gene.timeSlot);
      const endMinutes = startMinutes + totalDurationMinutes;
      const roomDateKey = `${gene.date}|${gene.roomId}`;
      
      if (!roomTimeRanges.has(roomDateKey)) {
        roomTimeRanges.set(roomDateKey, []);
      }
      
      roomTimeRanges.get(roomDateKey)!.push({
        start: startMinutes,
        end: endMinutes,
        sectionId: gene.sectionId,
        studentCount: section.enrolled_students || 0
      });
    });

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
        const suitableRooms = sectionRoomsMap.get(gene.sectionId) || [];

        const validTimesForSection = isNightClass 
          ? eveningTimeSlots.filter(t => {
              const [h, m] = t.split(":").map(Number);
              const end = (h * 60 + m) + totalDurationMinutes;
              return end <= 21 * 60;
            })
          : validTimes;

        if (mutationType === 0 && Math.random() < 0.3) {
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
          let newRoomId = "";
          const sectionStudents = section.enrolled_students || 0;
          const startMinutes = timeToMinutes(gene.timeSlot);
          const endMinutes = startMinutes + totalDurationMinutes;
          
          for (const roomId of suitableRooms) {
            const roomObj = roomOptions.find(r => r.room_id === roomId);
            if (!roomObj) continue;
            
            if (roomObj.room_capacity < sectionStudents) {
              continue;
            }
            
            const roomDateKey = `${gene.date}|${roomId}`;
            const existingRanges = roomTimeRanges.get(roomDateKey) || [];
            
            let currentOccupancy = 0;
            for (const range of existingRanges) {
              if (range.sectionId === gene.sectionId) continue;
              
              if (rangesOverlap(startMinutes, endMinutes, range.start, range.end)) {
                currentOccupancy += range.studentCount || 0;
              }
            }
            
            if (currentOccupancy + sectionStudents <= roomObj.room_capacity) {
              newRoomId = roomId;
              break;
            }
          }
          
          if (newRoomId) {
            return { ...gene, roomId: newRoomId };
          }
          
          return { ...gene };
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
          instructor_id: sectionCourseData?.user_id ?? null,
          enrolled_students: sectionCourseData?.number_of_students ?? 0
        };
        
        allSections.push(enrichedSection);
        sectionMap.set(modalityId, enrichedSection);
      }
    });

    const eveningTimeSlots = TIME_SLOT_RANGES["6 PM - 9 PM (Evening)"];
    const morningTimeSlots = TIME_SLOT_RANGES["7 AM - 1 PM (Morning)"];
    const afternoonTimeSlots = TIME_SLOT_RANGES["1 PM - 6 PM (Afternoon)"];

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

    // ✅ Build section rooms map using possible_rooms from modalities
    const sectionRoomsMap = new Map<number, string[]>();
    allSections.forEach(section => {
      const possibleRooms = section.possible_rooms ?? [];
      
      if (possibleRooms.length === 0) {
        console.warn(`⚠️ Section ${section.modality_id} has NO possible_rooms assigned!`);
        sectionRoomsMap.set(section.modality_id, []);
        return;
      }
      
      const enrolledCount = section.enrolled_students ?? 0;
      
      const validRooms = possibleRooms.filter((roomId: string) => {
        const capacity = roomCapacityMap.get(roomId);
        
        if (!capacity) {
          console.warn(`⚠️ Room ${roomId} not found in roomCapacityMap`);
          return false;
        }
        
        if (capacity < enrolledCount) {
          console.warn(`⚠️ Room ${roomId} (capacity: ${capacity}) too small for ${enrolledCount} students`);
          return false;
        }
        
        return true;
      });
      
      const sortedRooms = validRooms.sort((a: string, b: string) => {
        const capA = roomCapacityMap.get(a) || 0;
        const capB = roomCapacityMap.get(b) || 0;
        return capA - capB;
      });
      
      sectionRoomsMap.set(section.modality_id, sortedRooms);
      
      console.log(`✅ Section ${section.modality_id} assigned ${sortedRooms.length} valid rooms:`, sortedRooms);
    });

    // Pre-validation
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
      violations.push(`No proctors available for: ${formattedDates}\n\nPlease ensure proctors have set their availability for these specific dates and time slots.`);
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
            `Night class ${section.course_id} - ${section.section_name} cannot be scheduled: exam duration (${totalDurationMinutes} min) too long for evening slots (must end by 9 PM)`
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
      
      // Check each modality individually to work with existing backend
      const scheduledIds: number[] = [];
      const scheduledDetails = new Map<number, any[]>();
      
      for (const modalityId of modalityIds) {
        try {
          const response = await api.get('/tbl_examdetails', {
            params: { modality_id: modalityId }
          });
          
          if (response.data && response.data.length > 0) {
            scheduledIds.push(modalityId);
            scheduledDetails.set(modalityId, response.data);
          }
        } catch (error: any) {
          // 404 means not scheduled yet (which is fine)
          if (error.response?.status !== 404) {
            console.warn(`Error checking modality ${modalityId}:`, error.message);
          }
        }
      }
      
      if (scheduledIds.length > 0) {
        const duplicateDetails: string[] = [];
        scheduledDetails.forEach((schedules, modalityId) => {
          const modality = modalities.find(m => m.modality_id === modalityId);
          if (modality) {
            const schedule = schedules[0];
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
          `❌ Cannot generate schedule - ${scheduledIds.length} section(s) already have scheduled exams:\n\n` +
          duplicateDetails.slice(0, 5).join('\n\n') +
          (duplicateDetails.length > 5 ? `\n\n... and ${duplicateDetails.length - 5} more` : '') +
          `\n\n📋 Options:\n` +
          `1. Deselect these sections from your modality selection\n` +
          `2. Delete the existing schedules first if you want to reschedule\n` +
          `3. Use the "Edit Schedule" feature to modify existing schedules`;
        
        alert(errorMessage);
        return;
      }
      
      console.log('✅ No existing schedules found - safe to proceed');
      
    } catch (error) {
      console.error('Error checking for existing schedules:', error);
      toast.error('Failed to check for existing schedules');
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
    
    toast.info("Generating schedule... This may take a moment.", { autoClose: 2000 });

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
        courseDateAssignment
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
        nextPopulation.push(mutate(child1, sectionMap, sortedDates, validTimes, eveningTimeSlots, sectionRoomsMap, getAvailableProctors, MUTATION_RATE, totalDurationMinutes));
        if (nextPopulation.length < POPULATION_SIZE) {
          nextPopulation.push(mutate(child2, sectionMap, sortedDates, validTimes, eveningTimeSlots, sectionRoomsMap, getAvailableProctors, MUTATION_RATE, totalDurationMinutes));
        }
      }

      population = nextPopulation;
    }

    if (!bestChromosome) {
      alert("Could not find a valid schedule.");
      return;
    }

    console.log(`✅ Evolution complete! Final best fitness: ${bestFitness}`);

    const scheduledExams: any[] = [];
    const unscheduledSections: string[] = [];
    const finalRoomTimeRanges = new Map<string, any[]>();
    const finalCourseDates = new Map<string, Set<string>>();

    for (const gene of bestChromosome) {
      const section = sectionMap.get(gene.sectionId);
      if (!section) continue;

      const { date, timeSlot, roomId, proctorId } = gene;
      const courseId = section.course_id;

      if (!allAvailableTimeSlots.includes(timeSlot)) {
        console.error(`❌ Invalid time slot ${timeSlot} for section ${section.modality_id}`);
        unscheduledSections.push(`${section.course_id} - ${section.section_name} (invalid time slot: ${timeSlot})`);
        continue;
      }

      const [startHour, startMinute] = timeSlot.split(":").map(Number);
      const startMinutes = timeToMinutes(timeSlot);
      const endMinutes = startMinutes + totalDurationMinutes;
      
      if (endMinutes > 21 * 60) {
        console.error(`❌ Exam would end after 21:00 for section ${section.modality_id}`);
        unscheduledSections.push(`${section.course_id} - ${section.section_name} (would end after 9 PM)`);
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

      const roomDateKey = `${date}|${roomId}`;
      const existingRoomRanges = finalRoomTimeRanges.get(roomDateKey) || [];

      const room = roomsCache.find(r => r.room_id === roomId);
      const roomCapacity = room?.room_capacity || 0;

      let currentOccupancy = 0;
      for (const existing of existingRoomRanges) {
        if (rangesOverlap(startMinutes, endMinutes, existing.start, existing.end)) {
          currentOccupancy += existing.studentCount || 0;
        }
      }

      const sectionStudents = section.enrolled_students || 0;

      if (currentOccupancy + sectionStudents > roomCapacity) {
        console.warn(
          `⚠️ Room ${roomId} capacity exceeded: ` +
          `Current: ${currentOccupancy}, Adding: ${sectionStudents}, Capacity: ${roomCapacity}`
        );
        hasOverlap = true;
      }

      if (hasOverlap) {
        unscheduledSections.push(`${section.course_id} - ${section.section_name} (room capacity exceeded)`);
        continue;
      }

      if (!finalRoomTimeRanges.has(roomDateKey)) {
        finalRoomTimeRanges.set(roomDateKey, []);
      }
      finalRoomTimeRanges.get(roomDateKey)!.push({
        start: startMinutes,
        end: endMinutes,
        course: section.course_id,
        section: section.section_name,
        studentCount: sectionStudents
      });

      const startTimestamp = `${date}T${timeSlot}:00`;
      const endTimestamp = `${date}T${endTime}:00`;

      const sectionObj = sectionCourses.find(
        sc => sc.program_id === section.program_id &&
          sc.course_id === section.course_id &&
          sc.section_name === section.section_name
      );
      const instructorId = sectionObj?.user_id ?? null;

      const buildingId = roomToBuildingMap.get(roomId);
      const buildingName = buildingId ? buildingMap.get(buildingId) : "Unknown Building";

      if (!roomId || roomId.trim() === "") {
        console.error(`❌ Empty room_id for section ${section.modality_id}`);
        unscheduledSections.push(
          `${section.course_id} - ${section.section_name} (no available room)`
        );
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
      const message = `Could not schedule ${unscheduledSections.length} section(s):\n\n${unscheduledSections.slice(0, 10).join("\n")}${unscheduledSections.length > 10 ? `\n... and ${unscheduledSections.length - 10} more` : ""}\n\nScheduled: ${scheduledExams.length}/${allSections.length} sections`;
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
      toast.success(`Successfully scheduled ${scheduledExams.length}/${allSections.length} sections!`);
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
            <label className="label">Exam Start Time</label>
            <CreatableSelect
              value={
                selectedStartTime
                  ? { value: selectedStartTime, label: selectedStartTime }
                  : { value: "07:00", label: "07:00" }
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
                  const searchString = [course?.course_id, modality?.section_name, modality?.modality_type].join(' ').toLowerCase();
                  return { modality, course, searchString, modalityId, isScheduled };
                })
                .filter(item => !modalityPreviewSearchTerm || item.searchString.includes(modalityPreviewSearchTerm.toLowerCase()))
                .map(({ modality, course, modalityId, isScheduled }) => (
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
                    <p className="modality-detail">Section: {modality?.section_name ?? 'N/A'}</p>
                    <p className="modality-detail">Modality Type: {modality?.modality_type ?? 'N/A'}</p>
                    <p className="modality-detail">Remarks: {modality?.modality_remarks ?? 'N/A'}</p>
                    {isScheduled && (
                      <p style={{ 
                        color: '#f59e0b', 
                        fontSize: '13px', 
                        marginTop: '8px',
                        fontWeight: '500' 
                      }}>
                        ⚠️ This section already has an exam schedule
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