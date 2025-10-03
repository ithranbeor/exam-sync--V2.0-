/// <reference types="react" />
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient.ts";
import "../styles/SchedulerPlottingSchedule.css";
import Select, { components } from "react-select";
import { FaPlay, FaSpinner } from "react-icons/fa";

interface ExamDetail {
  examdetails_id?: number;
  course_id: string;
  program_id: string;
  modality_id: number;
  user_id?: number | null;
  examperiod_id: number;
  exam_duration?: string | null;
  exam_start_time?: string | null;
  exam_end_time?: string | null;
  proctor_timein?: string | null;
  proctor_timeout?: string | null;
  section_name?: string | null;
  academic_year?: string | null;
  semester?: string | null;
  exam_category?: string | null;
  exam_period?: string | null;
  exam_date?: string | null;
  room_id?: string | null;
  selectedStartTime?: string;
  instructor_id?: number | null;
}

const SchedulerPlottingSchedule: React.FC = () => {
  const [formData, setFormData] = useState<ExamDetail & {
    selectedPrograms: string[];
    selectedCourses: string[];
    selectedModalities: number[];
    selectedExamDates: string[];
    exam_duration_hours?: number;
    exam_duration_minutes?: number;
  }>({
    course_id: "",
    program_id: "",
    modality_id: 0,
    examperiod_id: 0,
    exam_date: "",
    room_id: null,
    selectedPrograms: [],
    selectedCourses: [],
    selectedModalities: [],
    selectedExamDates: [],
    exam_duration_hours: 0,
    exam_duration_minutes: 0,
  });

  const [examPeriods, setExamPeriods] = useState<any[]>([]);
  const [modalities, setModalities] = useState<any[]>([]);
  const [_filteredModalities, setFilteredModalities] = useState<any[]>([]);
  const [programs, setPrograms] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [terms, setTerms] = useState<any[]>([]);
  const [_filteredCourses, setFilteredCourses] = useState<any[]>([]);
  const [sectionCourses, setSectionCourses] = useState<any[]>([]);
  const [userCollegeIds, setUserCollegeIds] = useState<string[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [modalityPreviewSearchTerm, setModalityPreviewSearchTerm] = useState(''); 
  const [loading, setLoading] = useState(false);

  // Cache for rooms and buildings data
  const [roomsCache, setRoomsCache] = useState<any[]>([]);
  const [buildingsCache, setBuildingsCache] = useState<any[]>([]);
  const [collegesCache, setCollegesCache] = useState<any[]>([]);

  const handleSaveClick = async () => {
    setLoading(true);
    try {
      await handleSave();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchAll = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { data: userRow } = await supabase
        .from("tbl_users")
        .select("user_id")
        .eq("user_uuid", user?.id)
        .single();

      const realUserId = userRow?.user_id;

      const [
        { data: periods },
        { data: mods },
        { data: progs },
        { data: crs },
        { data: trms },
        { data: sectCourses },
        { data: userRoles },
        { data: depts },
        { data: rooms },
        { data: buildings },
        { data: colleges },
      ] = await Promise.all([
        supabase.from("tbl_examperiod").select("*"),
        supabase.from("tbl_modality").select("*"),
        supabase.from("tbl_program").select("*"),
        supabase.from("tbl_course").select("*"),
        supabase.from("tbl_term").select("*"),
        supabase.from("tbl_sectioncourse").select("*"),
        supabase
          .from("tbl_user_role")
          .select("college_id")
          .eq("user_id", realUserId)
          .eq("role_id", 3),
        supabase.from("tbl_department").select("department_id, college_id"),
        supabase.from("tbl_rooms").select("room_id, building_id, room_capacity"),
        supabase.from("tbl_buildings").select("building_id, building_name"),
        supabase.from("tbl_college").select("college_id, college_name"),
      ]);

      if (periods) setExamPeriods(periods);
      if (mods) setModalities(mods);
      if (progs) setPrograms(progs);
      if (crs) setCourses(crs);
      if (trms) setTerms(trms);
      if (sectCourses) setSectionCourses(sectCourses);
      if (depts) setDepartments(depts);
      if (rooms) setRoomsCache(rooms);
      if (buildings) setBuildingsCache(buildings);
      if (colleges) setCollegesCache(colleges);

      if (userRoles) {
        const colleges = userRoles
          .map((r) => String(r.college_id))
          .filter(Boolean);
        setUserCollegeIds(colleges);
      }
    };

    fetchAll();
  }, []);

  const filteredCoursesByPrograms = useMemo(() => {
    if (formData.selectedPrograms.length === 0) return [];
    const courseIds = Array.from(
      new Set(
        sectionCourses
          .filter(sc => formData.selectedPrograms.includes(sc.program_id))
          .map(sc => sc.course_id)
      )
    );
    return courses.filter(c => courseIds.includes(c.course_id));
  }, [formData.selectedPrograms, sectionCourses, courses]);

  const filteredModalitiesBySelection = useMemo(() => {
    if (formData.selectedPrograms.length === 0 || formData.selectedCourses.length === 0) return [];
    return modalities.filter(
      m =>
        formData.selectedPrograms.includes(m.program_id) &&
        formData.selectedCourses.includes(m.course_id)
    );
  }, [formData.selectedPrograms, formData.selectedCourses, modalities]);

  const CheckboxOption = (props: any) => {
    return (
      <components.Option {...props}>
        <input
          type="checkbox"
          checked={props.isSelected}
          onChange={() => null}
        />{" "}
        <label>{props.label}</label>
      </components.Option>
    );
  };

  const addSelectAllOption = (options: any[], label = "Select All") => [
    { value: "__all__", label },
    ...options,
  ];

  const termNameById = useMemo(() => {
    const map = new Map<number | string, string>();
    terms.forEach((t) => {
      map.set(t.term_id, t.term_name ?? String(t.term_id));
    });
    return map;
  }, [terms]);

  useEffect(() => {
    if (!formData.program_id) {
      setFilteredCourses([]);
      return;
    }

    const courseIds = Array.from(
      new Set(
        sectionCourses
          .filter((sc) => sc.program_id === formData.program_id)
          .map((sc) => sc.course_id)
      )
    );

    const filtered = courses.filter((c) => courseIds.includes(c.course_id));
    setFilteredCourses(filtered);
    setFormData((prev) => ({ ...prev, course_id: "" }));
  }, [formData.program_id, courses, sectionCourses]);

  useEffect(() => {
    if (!formData.course_id || !formData.program_id) {
      setFilteredModalities([]);
      return;
    }
    const filtered = modalities.filter(
      (m) =>
        m.course_id === formData.course_id &&
        m.program_id === formData.program_id
    );
    setFilteredModalities(filtered);
    setFormData((prev) => ({
      ...prev,
      modality_id: 0,
      section_name: "",
      room_id: null,
    }));
  }, [formData.course_id, formData.program_id, modalities]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    if (name === "modality_id" || name === "examperiod_id") {
      setFormData((prev) => ({
        ...prev,
        [name]: value === "" ? 0 : Number(value),
      }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const uniqueAcademicYearTermOptions = useMemo(() => {
    const seen = new Set<string>();
    const options: { key: string; label: string; value: string }[] = [];
    for (const p of examPeriods) {
      const termName = termNameById.get(p.term_id) ?? p.term_id ?? "Term";
      const key = `${p.academic_year}||${termName}`;
      if (!seen.has(key)) {
        seen.add(key);
        const label = `${p.academic_year} | ${termName}`;
        const value = `${p.academic_year} | ${termName}`;
        options.push({ key, label, value });
      }
    }
    return options;
  }, [examPeriods, termNameById]);

  const uniqueExamCategoryOptions = useMemo(() => {
    const seen = new Set<string>();
    const options: string[] = [];
    for (const p of examPeriods) {
      const cat = p.exam_category ?? "";
      if (cat && !seen.has(cat)) {
        seen.add(cat);
        options.push(cat);
      }
    }
    return options;
  }, [examPeriods]);

  useEffect(() => {
    if (uniqueAcademicYearTermOptions.length > 0 && !formData.academic_year) {
      const latestYearTerm = uniqueAcademicYearTermOptions[0].value;
      setFormData(prev => ({ ...prev, academic_year: latestYearTerm }));
    }

    if (uniqueExamCategoryOptions.length > 0 && !formData.exam_category) {
      const latestExamCategory = uniqueExamCategoryOptions[0];
      setFormData(prev => ({ ...prev, exam_category: latestExamCategory }));
    }
  }, [uniqueAcademicYearTermOptions, uniqueExamCategoryOptions]);

  const examDateOptions = useMemo(() => {
    if (!examPeriods.length || !userCollegeIds.length) return [];

    const allowedPeriods = examPeriods.filter((p) =>
      userCollegeIds.includes(String(p.college_id))
    );

    const days: { key: string; iso: string; label: string }[] = [];
    for (const period of allowedPeriods) {
      if (!period.start_date || !period.end_date) continue;
      const start = new Date(period.start_date);
      const end = new Date(period.end_date);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const iso = d.toISOString().slice(0, 10);
        const label = d.toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        });
        days.push({ key: `${period.examperiod_id}-${iso}`, iso, label });
      }
    }

    const seen = new Set<string>();
    return days.filter((d) => {
      if (seen.has(d.iso)) return false;
      seen.add(d.iso);
      return true;
    });
  }, [examPeriods, userCollegeIds]);

  const handleSave = async () => {
    if (
      !formData.selectedPrograms.length ||
      !formData.selectedCourses.length ||
      !formData.selectedModalities.length
    ) {
      alert("Please complete program, course, and modality selection.");
      return;
    }

    if (!formData.selectedExamDates.length) {
      alert("Please select at least one exam date.");
      return;
    }

    await assignExamSchedules();
  };

const assignExamSchedules = async () => {
  const scheduledExams: any[] = [];
  const assignedSlots: Record<string, Set<string>> = {};
  const unscheduledCourses: string[] = [];

  // Track year-level + program schedules: date -> time -> Set<"yearLevel-programId">
  const yearLevelProgramSchedule: Record<string, Record<string, Set<string>>> = {};

  // Track consecutive scheduling: date -> array of { time, yearLevel, programId }
  const consecutiveSchedule: Record<string, Array<{ time: string; yearLevel: string; programId: string }>> = {};

  // Track proctor assignments: date -> time -> Set<proctorId>
  const proctorSchedule: Record<string, Record<string, Set<number>>> = {};

  // Prepare academic year and semester
  let academicYear: string | null = null;
  let semester: string | null = null;
  if (formData.academic_year) {
    const [yearPart, semPart] = formData.academic_year.split("|").map((s) => s.trim());
    academicYear = yearPart ?? null;
    semester = semPart ?? null;
  }

  // Format exam period string
  const sortedDates = [...formData.selectedExamDates].sort();
  const examPeriod =
    sortedDates.length > 1
      ? `${new Date(sortedDates[0]).toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        })} - ${new Date(sortedDates[sortedDates.length - 1]).toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        })}`
      : new Date(sortedDates[0]).toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        });

  // Fetch all availability data at once
  const { data: allAvailability } = await supabase
    .from("tbl_availability")
    .select("user_id, day")
    .eq("status", "available")
    .in("day", sortedDates);

  // Build availability map: date -> array of proctor IDs
  const availabilityMap = new Map<string, number[]>();
  allAvailability?.forEach(a => {
    if (!availabilityMap.has(a.day)) {
      availabilityMap.set(a.day, []);
    }
    availabilityMap.get(a.day)!.push(a.user_id);
  });

  // Build room capacity lookup map
  const roomCapacityMap = new Map<string, number>();
  roomsCache.forEach(r => {
    roomCapacityMap.set(r.room_id, r.room_capacity);
  });

  // Build building lookup map
  const buildingMap = new Map<string, string>();
  buildingsCache.forEach(b => {
    buildingMap.set(b.building_id, b.building_name);
  });

  // Build room to building map
  const roomToBuildingMap = new Map<string, string>();
  roomsCache.forEach(r => {
    roomToBuildingMap.set(r.room_id, r.building_id);
  });

  // Get college name once
  const schedulerCollegeId = userCollegeIds[0];
  const collegeObj = collegesCache?.find((c) => c.college_id === schedulerCollegeId);
  const collegeNameForCourse = collegeObj?.college_name ?? "Unknown College";

  // Group sections by course
  const groupedByCourse: Record<string, any[]> = {};
  for (const modalityId of formData.selectedModalities) {
    const selectedModality = modalities.find((m) => m.modality_id === modalityId);
    if (!selectedModality) continue;

    const courseId = selectedModality.course_id;
    if (!groupedByCourse[courseId]) groupedByCourse[courseId] = [];
    groupedByCourse[courseId].push(selectedModality);
  }

  const totalDurationMinutes = (duration.hours ?? 0) * 60 + (duration.minutes ?? 0);

  // Helper function to extract year level from section name
  const extractYearLevel = (sectionName: string | null | undefined): string => {
    if (!sectionName) return "Unknown";
    // Match patterns like IT4R1, CS3A, BSIT-4A, etc.
    const match = sectionName.match(/(\d)/);
    return match ? match[1] : "Unknown";
  };

  // Helper function to check if year level + program has conflict at this time slot
  const hasYearLevelProgramConflict = (date: string, timeSlots: string[], yearLevel: string, programId: string): boolean => {
    if (!yearLevelProgramSchedule[date]) return false;
    
    const key = `${yearLevel}-${programId}`;
    for (const slot of timeSlots) {
      if (yearLevelProgramSchedule[date][slot]?.has(key)) {
        return true;
      }
    }
    return false;
  };

  // Helper function to check consecutive scheduling for same year level + program
  const hasConsecutiveConflict = (date: string, startTime: string, yearLevel: string, programId: string): boolean => {
    if (!consecutiveSchedule[date] || consecutiveSchedule[date].length === 0) return false;
    
    const lastEntry = consecutiveSchedule[date][consecutiveSchedule[date].length - 1];
    if (!lastEntry) return false;
    
    // Check if this would be consecutive to the last scheduled exam
    const lastEndTime = getNextTimeSlot(lastEntry.time);
    if (lastEndTime === startTime && lastEntry.yearLevel === yearLevel && lastEntry.programId === programId) {
      return true; // Same year level AND same program = conflict
    }
    
    return false;
  };

  // Helper to get next time slot
  const getNextTimeSlot = (currentTime: string): string => {
    const currentIndex = times.indexOf(currentTime);
    if (currentIndex === -1 || currentIndex >= times.length - 1) return "";
    return times[currentIndex + 1];
  };

  // Helper function to mark year level + program as scheduled
  const markYearLevelProgramScheduled = (date: string, timeSlots: string[], yearLevel: string, programId: string, startTime: string) => {
    if (!yearLevelProgramSchedule[date]) yearLevelProgramSchedule[date] = {};
    if (!consecutiveSchedule[date]) consecutiveSchedule[date] = [];
    
    const key = `${yearLevel}-${programId}`;
    for (const slot of timeSlots) {
      if (!yearLevelProgramSchedule[date][slot]) yearLevelProgramSchedule[date][slot] = new Set();
      yearLevelProgramSchedule[date][slot].add(key);
    }
    
    consecutiveSchedule[date].push({ time: startTime, yearLevel, programId });
  };

  // Helper function to check if proctor is already assigned at this time
  const isProctorAvailable = (date: string, timeSlots: string[], proctorId: number): boolean => {
    if (!proctorSchedule[date]) return true;
    
    for (const slot of timeSlots) {
      if (proctorSchedule[date][slot]?.has(proctorId)) {
        return false;
      }
    }
    return true;
  };

  // Helper function to mark proctor as assigned
  const markProctorAssigned = (date: string, timeSlots: string[], proctorId: number) => {
    if (!proctorSchedule[date]) proctorSchedule[date] = {};
    
    for (const slot of timeSlots) {
      if (!proctorSchedule[date][slot]) proctorSchedule[date][slot] = new Set();
      proctorSchedule[date][slot].add(proctorId);
    }
  };

  // Helper function to get available proctors for time slots
  const getAvailableProctorsForSlots = (
    date: string, 
    timeSlots: string[], 
    availableProctorIds: number[], 
    neededCount: number
  ): number[] => {
    const availableProctors: number[] = [];
    
    for (const proctorId of availableProctorIds) {
      if (isProctorAvailable(date, timeSlots, proctorId)) {
        availableProctors.push(proctorId);
        if (availableProctors.length >= neededCount) break;
      }
    }
    
    return availableProctors;
  };

  // Helper function to generate extended dates beyond selected dates
  const generateExtendedDates = (startDate: string, daysToExtend: number = 30): string[] => {
    const extendedDates: string[] = [];
    const start = new Date(startDate);
    
    for (let i = 1; i <= daysToExtend; i++) {
      const nextDate = new Date(start);
      nextDate.setDate(start.getDate() + i);
      extendedDates.push(nextDate.toISOString().slice(0, 10));
    }
    
    return extendedDates;
  };

  // Helper function to shuffle array (Fisher-Yates shuffle)
  const shuffleArray = <T,>(array: T[]): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  // Create extended date pool
  const lastSelectedDate = sortedDates[sortedDates.length - 1];
  const extendedDates = generateExtendedDates(lastSelectedDate, 30);
  
  // MODIFIED: Shuffle the selected dates for random distribution
  const shuffledSelectedDates = shuffleArray(sortedDates);
  const allAvailableDates = [...shuffledSelectedDates, ...extendedDates];

  // Process each course
  for (const [courseId, sections] of Object.entries(groupedByCourse)) {
    let assigned = false;

    // Get year level and program ID for all sections of this course
    const yearLevel = extractYearLevel(sections[0]?.section_name);
    const programId = sections[0]?.program_id;

    for (const date of allAvailableDates) {
      if (assigned) break;

      const examDateISO = new Date(date).toISOString().slice(0, 10);

      // Find matching exam period (or extend if needed)
      let matchedPeriod = examPeriods.find((p) => {
        const start = new Date(p.start_date);
        const end = new Date(p.end_date);
        return new Date(examDateISO) >= start && new Date(examDateISO) <= end;
      });

      // If no matching period and we're in extended dates, use the last valid period
      if (!matchedPeriod && extendedDates.includes(date)) {
        const allowedPeriods = examPeriods.filter((p) =>
          userCollegeIds.includes(String(p.college_id))
        );
        matchedPeriod = allowedPeriods[allowedPeriods.length - 1];
      }

      if (!matchedPeriod) continue;

      // Get proctors from pre-fetched map or fetch for extended dates
      let availableProctors = availabilityMap.get(examDateISO) || [];
      
      // If no proctors for extended date, fetch availability
      if (!availableProctors.length && extendedDates.includes(date)) {
        const { data: extendedAvailability } = await supabase
          .from("tbl_availability")
          .select("user_id")
          .eq("status", "available")
          .eq("day", examDateISO);
        
        availableProctors = extendedAvailability?.map(a => a.user_id) || [];
      }

      if (!availableProctors.length) continue;

      // Try each timeslot
      for (const t of times) {
        if (assigned) break;

        const [startHour, startMinute] = t.split(":").map(Number);

        // Build slot minutes
        const slotMinutes: string[] = [];
        for (let m = 0; m < totalDurationMinutes; m += 30) {
          const h = startHour + Math.floor((startMinute + m) / 60);
          const mi = (startMinute + m) % 60;
          slotMinutes.push(`${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}`);
        }

        // MODIFIED: Check year level + program conflicts
        if (hasYearLevelProgramConflict(examDateISO, slotMinutes, yearLevel, programId)) {
          continue;
        }

        // MODIFIED: Check consecutive conflicts for same year level + program
        if (hasConsecutiveConflict(examDateISO, t, yearLevel, programId)) {
          continue;
        }

        // Get available proctors for this time slot (need one per section)
        const assignedProctors = getAvailableProctorsForSlots(
          examDateISO, 
          slotMinutes, 
          availableProctors, 
          sections.length
        );

        // Check if we have enough proctors for all sections
        if (assignedProctors.length < sections.length) {
          continue;
        }

        // Collect rooms for all sections of this course
        const assignedRooms: string[] = [];
        let roomAssignmentFailed = false;

        for (const section of sections) {
          const possibleRooms = section.possible_rooms ?? [];
          const enrolledCount = section.enrolled_students ?? 0;

          let roomId: string | null = null;

          // First pass: try preferred rooms
          for (const r of possibleRooms) {
            if (!assignedSlots[r]) assignedSlots[r] = new Set();
            if (slotMinutes.some((s) => assignedSlots[r].has(s))) continue;

            const roomCapacity = roomCapacityMap.get(r);
            if (!roomCapacity || roomCapacity < enrolledCount) continue;

            if (!assignedRooms.includes(r)) {
              roomId = r;
              break;
            }
          }

          // Second pass: if no preferred room, try ANY available room with sufficient capacity
          if (!roomId) {
            for (const [r, capacity] of roomCapacityMap.entries()) {
              if (!assignedSlots[r]) assignedSlots[r] = new Set();
              if (slotMinutes.some((s) => assignedSlots[r].has(s))) continue;

              if (capacity >= enrolledCount && !assignedRooms.includes(r)) {
                roomId = r;
                break;
              }
            }
          }

          if (!roomId) {
            roomAssignmentFailed = true;
            break;
          }

          assignedRooms.push(roomId);
        }

        if (roomAssignmentFailed || assignedRooms.length < sections.length) continue;

        // Mark slots for all chosen rooms
        assignedRooms.forEach((roomId) => {
          slotMinutes.forEach((s) => assignedSlots[roomId].add(s));
        });

        // MODIFIED: Mark year level + program as scheduled
        markYearLevelProgramScheduled(examDateISO, slotMinutes, yearLevel, programId, t);

        // Mark all proctors as assigned for these time slots
        assignedProctors.forEach(proctorId => {
          markProctorAssigned(examDateISO, slotMinutes, proctorId);
        });

        // Build exam times
        const endHour = startHour + Math.floor((startMinute + totalDurationMinutes) / 60);
        const endMinute = (startMinute + totalDurationMinutes) % 60;
        const endTime = `${String(endHour).padStart(2, "0")}:${String(endMinute).padStart(2, "0")}`;
        const startTimestamp = `${examDateISO}T${t}:00Z`;
        const endTimestamp = `${examDateISO}T${endTime}:00Z`;

        // Schedule each section with unique proctor
        sections.forEach((section, idx) => {
          const sectionRoomId = assignedRooms[idx];
          const proctorId = assignedProctors[idx];
          
          const sectionObj = sectionCourses.find(
            (sc) =>
              sc.program_id === section.program_id &&
              sc.course_id === section.course_id &&
              sc.section_name === section.section_name
          );
          const instructorId = sectionObj?.user_id ?? null;

          const buildingId = roomToBuildingMap.get(sectionRoomId);
          const buildingName = buildingId ? buildingMap.get(buildingId) : "Unknown Building";

          scheduledExams.push({
            program_id: section.program_id,
            course_id: section.course_id,
            modality_id: section.modality_id,
            room_id: sectionRoomId,
            section_name: section.section_name,
            proctor_id: proctorId,
            examperiod_id: matchedPeriod.examperiod_id,
            exam_date: examDateISO,
            exam_start_time: startTimestamp,
            exam_end_time: endTimestamp,
            exam_duration: `${duration.hours ?? 0}h ${duration.minutes ?? 0}m`,
            proctor_timein: formData.proctor_timein ?? null,
            proctor_timeout: formData.proctor_timeout ?? null,
            academic_year: academicYear,
            semester: semester,
            exam_category: formData.exam_category ?? null,
            exam_period: examPeriod,
            college_name: collegeNameForCourse,
            building_name: `${buildingName} (${buildingId})`,
            instructor_id: instructorId,
          });
        });

        assigned = true;
      }
    }

    if (!assigned) unscheduledCourses.push(courseId);
  }

  // Warnings
  if (unscheduledCourses.length) {
    alert(
      "⚠️ Could not schedule these courses due to conflicts or room capacity:\n" +
        unscheduledCourses.join(", ")
    );
  }

  if (!scheduledExams.length) {
    alert("No valid schedules to save.");
    return;
  }

  // Save to DB
  const { error } = await supabase.from("tbl_examdetails").insert(scheduledExams);
  if (error) alert("❌ Error saving schedule: " + error.message);
  else alert(`✅ ${scheduledExams.length} schedules saved successfully!`);
};

  const times = [
    "07:00","07:30","08:00","08:30","09:00","09:30","10:00","10:30","11:00","11:30",
    "12:00","12:30","13:00","13:30","14:00","14:30","15:00","15:30","16:00","16:30",
    "17:00","17:30","18:00","18:30","19:00","19:30","20:00","20:30"
  ];

  const [duration, setDuration] = useState({ hours: 1, minutes: 0 });
  const [selectedStartTime, setSelectedStartTime] = useState<string>("");

  const filteredPrograms = useMemo(() => {
    if (
      userCollegeIds.length === 0 ||
      departments.length === 0 ||
      programs.length === 0
    ) {
      return programs;
    }

    const allowedDepartments = new Set(
      departments
        .filter((d) => userCollegeIds.includes(String(d.college_id)))
        .map((d) => String(d.department_id).trim())
    );

    return programs.filter((p) =>
      allowedDepartments.has(String(p.department_id).trim())
    );
  }, [programs, userCollegeIds, departments]);

  return (
    <div className="scheduler-container">
      <h2 className="scheduler-header">Generate Schedule</h2>
      <div className="main-content-layout">
        
        <div className="form-column">
          <div className="field">
            <label className="label">Academic Year & Semester</label>
            <select
              name="academic_year"
              value={formData.academic_year ?? ""}
              onChange={handleChange}
              className="select"
            >
              <option value="">Select Academic Year & Semester</option>
              {uniqueAcademicYearTermOptions.map((o) => (
                <option key={o.key} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label className="label">Exam Term</label>
            <select
              name="exam_category"
              value={formData.exam_category ?? ""}
              onChange={handleChange}
              className="select"
            >
              <option value="">Select Exam Category</option>
              {uniqueExamCategoryOptions.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label className="label">Select Exam Dates</label>
            <Select
              options={examDateOptions.map(d => ({ value: d.iso, label: d.label }))}
              isMulti
              closeMenuOnSelect={false}
              hideSelectedOptions={false}
              components={{ Option: CheckboxOption }}
              onChange={(selected) =>
                setFormData(prev => ({
                  ...prev,
                  selectedExamDates: (selected as any[]).map(s => s.value),
                }))
              }
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
                filteredPrograms.map(p => ({
                  value: p.program_id,
                  label: `${p.program_id} | ${p.program_name}`,
                }))
              )}
              isMulti
              closeMenuOnSelect={false}
              hideSelectedOptions={false}
              components={{ Option: CheckboxOption }}
              onChange={(selected) => {
                let selectedValues = (selected as any[]).map(s => s.value);

                if (selectedValues.includes("__all__")) {
                  const allValues = filteredPrograms.map(p => p.program_id);
                  selectedValues = Array.from(new Set([...selectedValues.filter(v => v !== "__all__"), ...allValues]));
                }

                setFormData(prev => ({
                  ...prev,
                  selectedPrograms: selectedValues.filter(v => v !== "__all__"),
                  selectedCourses: [],
                  selectedModalities: [],
                }));
              }}
              value={formData.selectedPrograms.map(p => {
                const prog = filteredPrograms.find(f => f.program_id === p);
                return { value: p, label: prog ? `${prog.program_id}` : p };
              })}
            />
          </div>

          <div className="field">
            <label className="label">Course</label>
            <Select
              options={addSelectAllOption(
                filteredCoursesByPrograms.map(c => ({
                  value: c.course_id,
                  label: `${c.course_id} | ${c.course_name}`,
                }))
              )}
              isMulti
              closeMenuOnSelect={false}
              hideSelectedOptions={false}
              components={{ Option: CheckboxOption }}
              onChange={(selected) => {
                let selectedValues = (selected as any[]).map(s => s.value);

                if (selectedValues.includes("__all__")) {
                  const allValues = filteredCoursesByPrograms.map(c => c.course_id);
                  selectedValues = Array.from(
                    new Set([...selectedValues.filter(v => v !== "__all__"), ...allValues])
                  );
                }

                setFormData(prev => ({
                  ...prev,
                  selectedCourses: selectedValues.filter(v => v !== "__all__"),
                  selectedModalities: [],
                }));
              }}
              value={formData.selectedCourses.map(c => {
                const course = filteredCoursesByPrograms.find(f => f.course_id === c);
                return { value: c, label: course ? `${course.course_id}` : c };
              })}
              styles={{
                valueContainer: (provided) => ({
                  ...provided,
                  maxHeight: "120px",
                  overflowY: "auto",
                }),
              }}
            />
          </div>

          <div className="field">
            <label className="label">Modality</label>
            <Select
              options={addSelectAllOption(
                filteredModalitiesBySelection.map(m => ({
                  value: m.modality_id,
                  label: `${m.modality_type}${m.section_name ? ` – ${m.section_name}` : ""}`,
                }))
              )}
              isMulti
              closeMenuOnSelect={false}
              hideSelectedOptions={false}
              components={{ Option: CheckboxOption }}
              onChange={(selected) => {
                let selectedValues = (selected as any[]).map(s => s.value);

                if (selectedValues.includes("__all__")) {
                  const allValues = filteredModalitiesBySelection.map(m => m.modality_id);
                  selectedValues = Array.from(
                    new Set([...selectedValues.filter(v => v !== "__all__"), ...allValues])
                  );
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
                  label: mod
                    ? `${mod.modality_type}${mod.section_name ? ` – ${mod.section_name}` : ""}`
                    : String(m),
                };
              })}
              styles={{
                valueContainer: (provided) => ({
                  ...provided,
                  maxHeight: "120px",
                  overflowY: "auto",
                }),
              }}
            />
          </div>

          <div className="field">
            <label className="label">Exam Duration</label>
            <div style={{ display: "flex", gap: "10px" }}>
              <input
                type="number"
                min={0}
                value={duration.hours}
                onChange={(e) => setDuration(prev => ({ ...prev, hours: Number(e.target.value) }))}
                placeholder="Hours"
                className="input"
              />
              <input
                type="number"
                min={0}
                max={59}
                value={duration.minutes}
                onChange={(e) => setDuration(prev => ({ ...prev, minutes: Number(e.target.value) }))}
                placeholder="Minutes"
                className="input"
              />
            </div>
          </div>

          <div className="field">
            <label className="label">Exam Start Time</label>
            <select
              value={selectedStartTime}
              onChange={(e) => setSelectedStartTime(e.target.value)}
              className="select"
            >
              <option value="">Select Start Time</option>
              {times.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>
        
        <div className="preview-column">
          <h3 className="preview-header">Selected Modality Preview ({formData.selectedModalities.length})</h3>
          
          <input
            type="text"
            placeholder="Search within selected modalities (Course, Section, Type)"
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

                  const searchString = [
                    course?.course_id,
                    modality?.section_name,
                    modality?.modality_type,
                  ].join(' ').toLowerCase();

                  return { modality, course, searchString, modalityId };
                })
                .filter(item => {
                  if (!modalityPreviewSearchTerm) return true;
                  return item.searchString.includes(modalityPreviewSearchTerm.toLowerCase());
                })
                .map(({ modality, course, modalityId }) => (
                  <div key={modalityId} className="modality-item">
                    <p className="modality-detail">
                      Course: {course ? course.course_id : 'N/A'}
                    </p>
                    <p className="modality-detail">
                      Section: {modality?.section_name ?? 'N/A'}
                    </p>
                    <p className="modality-detail">
                      Modality Type: {modality?.modality_type ?? 'N/A'}
                    </p>
                    <p className="modality-detail">
                      Remarks: {modality?.modality_remarks ?? 'N/A'}
                    </p>
                    <hr className="modality-divider" />
                  </div>
                ))
              }
              {formData.selectedModalities.length > 0 && 
               !formData.selectedModalities
                  .map(id => filteredModalitiesBySelection.find(m => m.modality_id === id))
                  .some(m => [m?.course_id, m?.section_name, m?.modality_type].join(' ').toLowerCase().includes(modalityPreviewSearchTerm.toLowerCase())) &&
                  modalityPreviewSearchTerm && (
                      <p className="helper" style={{marginTop: '10px'}}>No modalities match your search filter.</p>
                  )
              }
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
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
          }}
        >
          {loading ? (
            <FaSpinner className="spin" />
          ) : (
            <FaPlay />
          )}
          {loading ? "Generating" : "Generate Schedule"}
        </button>
      </div>
    </div>
  );
};

export default SchedulerPlottingSchedule;