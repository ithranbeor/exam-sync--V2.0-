/// <reference types="react" />
import React, { useEffect, useMemo, useState } from "react";
import { api } from '../lib/apiClient.ts';
import "../styles/SchedulerPlottingSchedule.css";
import Select, { components } from "react-select";
import { FaPlay, FaSpinner } from "react-icons/fa";
import { toast } from 'react-toastify';

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

interface SchedulerProps {
  user: {
    user_id: number;
    email_address: string;
  } | null;
}

const SchedulerPlottingSchedule: React.FC<SchedulerProps> = ({ user }) => {
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
      try {
        const realUserId = user?.user_id;
        if (!realUserId) {
          console.warn("No user prop found — cannot fetch user-specific data.");
          return;
        }

        console.log("Using user_id from props:", realUserId);

        // ✅ Fetch all tables in parallel
        const [
          periodsRes,
          modsRes,
          progsRes,
          crsRes,
          trmsRes,
          sectCoursesRes,
          deptsRes,
          roomsRes,
          buildingsRes,
          collegesRes,
        ] = await Promise.all([
          api.get("/tbl_examperiod").catch(err => { console.error("Error fetching exam periods:", err); return { data: [] }; }),
          api.get("/tbl_modality/").catch(err => { console.error("Error fetching modalities:", err); return { data: [] }; }),
          api.get("/programs/").catch(err => { console.error("Error fetching programs:", err); return { data: [] }; }),
          api.get("/courses/").catch(err => { console.error("Error fetching courses:", err); return { data: [] }; }),
          api.get("/tbl_term").catch(err => { console.error("Error fetching terms:", err); return { data: [] }; }),
          api.get("/tbl_sectioncourse/").catch(err => { console.error("Error fetching section courses:", err); return { data: [] }; }),
          api.get("/departments/").catch(err => { console.error("Error fetching departments:", err); return { data: [] }; }),
          api.get("/tbl_rooms").catch(err => { console.error("Error fetching rooms:", err); return { data: [] }; }),
          api.get("/tbl_buildings").catch(err => { console.error("Error fetching buildings:", err); return { data: [] }; }),
          api.get("/tbl_college/").catch(err => { console.error("Error fetching colleges:", err); return { data: [] }; }),
        ]);

        // ✅ Normalize and store data
        const safeArray = (res: any) => (Array.isArray(res.data) ? res.data : []);
        setExamPeriods(safeArray(periodsRes));
        setModalities(safeArray(modsRes));
        setPrograms(safeArray(progsRes));
        setCourses(safeArray(crsRes));
        setTerms(safeArray(trmsRes));
        setSectionCourses(safeArray(sectCoursesRes));
        setDepartments(safeArray(deptsRes));
        setRoomsCache(safeArray(roomsRes));
        setBuildingsCache(safeArray(buildingsRes));
        setCollegesCache(safeArray(collegesRes));

        console.log("=== DATA LOADED ===", {
          examPeriods: safeArray(periodsRes).length,
          modalities: safeArray(modsRes).length,
          programs: safeArray(progsRes).length,
          courses: safeArray(crsRes).length,
          terms: safeArray(trmsRes).length,
          sectionCourses: safeArray(sectCoursesRes).length,
          departments: safeArray(deptsRes).length,
          rooms: safeArray(roomsRes).length,
          buildings: safeArray(buildingsRes).length,
          colleges: safeArray(collegesRes).length,
        });

        // ✅ Fetch user's colleges (correct backend route)
        try {
          const userRolesRes = await api.get(`/user-roles/${realUserId}/roles/`);
          const roles = Array.isArray(userRolesRes.data) ? userRolesRes.data : [];
          console.log("User roles raw response:", userRolesRes.data);

          const colleges = roles
            .map((r: any) => {
              if (typeof r.college === "string" && r.college.trim() !== "") {
                return r.college; // it's already a name like "CITC"
              }
              if (r.college_id) {
                return String(r.college_id);
              }
              return null;
            })
            .filter((id): id is string => Boolean(id));

          if (colleges.length > 0) {
            console.log("User colleges:", colleges);
            setUserCollegeIds(colleges);
          } else {
            console.warn("No colleges found for this user.");
            setUserCollegeIds([]);
          }
        } catch (err: any) {
          console.error("Failed to fetch user roles:", err);
          toast.warn("No user roles found or invalid endpoint.");
          setUserCollegeIds([]);
        }
      } catch (err: any) {
        console.error("Failed to fetch data:", err);
        toast.error(err.message || "Failed to fetch data");
      }
    };

    fetchAll();
  }, [user]);

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

    // ✅ Filter only exam periods belonging to the user's college(s)
    const allowedPeriods = examPeriods.filter(
      (p) =>
        p.college_id &&
        userCollegeIds.includes(String(p.college_id)) &&
        p.start_date &&
        p.end_date
    );

    const days: { key: string; iso: string; label: string }[] = [];

    for (const period of allowedPeriods) {
      const start = new Date(period.start_date);
      const end = new Date(period.end_date);

      // ✅ Ensure valid date range
      if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) continue;

      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const iso = d.toISOString().slice(0, 10);
        const label = d.toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        });

        days.push({
          key: `${period.examperiod_id}-${iso}`,
          iso,
          label,
        });
      }
    }

    // ✅ Only unique days for this college’s exam periods
    const seen = new Set<string>();
    const uniqueDays = days.filter((d) => {
      if (seen.has(d.iso)) return false;
      seen.add(d.iso);
      return true;
    });

    // ✅ Sort dates chronologically
    return uniqueDays.sort((a, b) => a.iso.localeCompare(b.iso));
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
  // Genetic Algorithm Parameters
  const POPULATION_SIZE = 60;
  const GENERATIONS = 150;
  const MUTATION_RATE = 0.2;
  const ELITE_SIZE = 8;
  const TOURNAMENT_SIZE = 5;

  const unscheduledCourses: string[] = [];

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
  const { data: allAvailability } = await api.get('/tbl_availability', {
    params: {
      status: 'available',
      day: sortedDates, 
    }
  });

  // Build availability map: date -> array of proctor IDs
  const availabilityMap = new Map<string, number[]>();
  allAvailability?.forEach((a: any) => {
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
    const match = sectionName.match(/(\d)/);
    return match ? match[1] : "Unknown";
  };

  // Helper to get time slots for duration
  const getTimeSlots = (startTime: string): string[] => {
    const [startHour, startMinute] = startTime.split(":").map(Number);
    const slotMinutes: string[] = [];
    for (let m = 0; m < totalDurationMinutes; m += 30) {
      const h = startHour + Math.floor((startMinute + m) / 60);
      const mi = (startMinute + m) % 60;
      slotMinutes.push(`${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}`);
    }
    return slotMinutes;
  };

  // ONLY use selected dates - no extended dates
  const allAvailableDates = [...sortedDates];

  // Pre-calculate suitable rooms per section to speed up generation
  const suitableRoomsBySection = new Map<number, string[]>();
  for (const [_, sections] of Object.entries(groupedByCourse)) {
    for (const section of sections) {
      const enrolledCount = section.enrolled_students ?? 0;
      const possibleRooms = section.possible_rooms ?? [];
      
      // Preferred rooms first
      const preferred = possibleRooms.filter((r: string) => {
        const capacity = roomCapacityMap.get(r);
        return capacity && capacity >= enrolledCount;
      });
      
      // All suitable rooms
      const allSuitable = Array.from(roomCapacityMap.entries())
        .filter(([_, capacity]) => capacity >= enrolledCount)
        .map(([id, _]) => id);
      
      // Combine: preferred first, then others
      const combined = [...new Set([...preferred, ...allSuitable])];
      suitableRoomsBySection.set(section.modality_id, combined);
    }
  }

  // Gene: represents a course assignment
  interface Gene {
    courseId: string;
    date: string;
    timeSlot: string;
    roomAssignments: string[]; // One room per section
    proctorAssignments: number[]; // One proctor per section
  }

  // Chromosome: a complete schedule (array of genes)
  type Chromosome = Gene[];

  // Generate random chromosome with better logic
  const generateRandomChromosome = (): Chromosome => {
    const chromosome: Chromosome = [];

    for (const [courseId, sections] of Object.entries(groupedByCourse)) {
      // Random date from SELECTED dates only
      const date = allAvailableDates[Math.floor(Math.random() * allAvailableDates.length)];

      // Random time
      const timeSlot = times[Math.floor(Math.random() * times.length)];

      // Get available proctors for this date
      const availableProctors = availabilityMap.get(date) || [];
      
      // Assign rooms and proctors for each section
      const roomAssignments: string[] = [];
      const proctorAssignments: number[] = [];

      for (const section of sections) {
        // Get suitable rooms for this section
        const suitableRooms = suitableRoomsBySection.get(section.modality_id) || [];
        
        const roomId = suitableRooms.length > 0
          ? suitableRooms[Math.floor(Math.random() * suitableRooms.length)]
          : "";

        // Assign proctor
        const proctorId = availableProctors.length > 0
          ? availableProctors[Math.floor(Math.random() * availableProctors.length)]
          : -1;

        roomAssignments.push(roomId);
        proctorAssignments.push(proctorId);
      }

      chromosome.push({
        courseId,
        date,
        timeSlot,
        roomAssignments,
        proctorAssignments
      });
    }

    return chromosome;
  };

  // Fitness function (lower is better)
  const calculateFitness = (chromosome: Chromosome): number => {
    let penalties = 0;

    // Track conflicts
    const roomSchedule: Record<string, Record<string, Set<string>>> = {};
    const proctorSchedule: Record<string, Record<string, Set<number>>> = {};
    const yearLevelProgramSchedule: Record<string, Record<string, Set<string>>> = {};
    const consecutiveTracker: Record<string, Map<string, string>> = {}; // date -> "yearLevel-programId" -> lastTimeSlot
    const dateUsageCount: Record<string, number> = {}; // Track how many courses per date

    for (const gene of chromosome) {
      const { courseId, date, timeSlot, roomAssignments, proctorAssignments } = gene;
      const sections = groupedByCourse[courseId];
      const timeSlots = getTimeSlots(timeSlot);

      const yearLevel = extractYearLevel(sections[0]?.section_name);
      const programId = sections[0]?.program_id;
      const key = `${yearLevel}-${programId}`;

      // Track date usage
      dateUsageCount[date] = (dateUsageCount[date] || 0) + 1;

      // Initialize tracking structures
      if (!roomSchedule[date]) roomSchedule[date] = {};
      if (!proctorSchedule[date]) proctorSchedule[date] = {};
      if (!yearLevelProgramSchedule[date]) yearLevelProgramSchedule[date] = {};
      if (!consecutiveTracker[date]) consecutiveTracker[date] = new Map();

      // Check year level + program conflicts (students can't have 2 exams at same time)
      for (const slot of timeSlots) {
        if (!yearLevelProgramSchedule[date][slot]) {
          yearLevelProgramSchedule[date][slot] = new Set();
        }
        if (yearLevelProgramSchedule[date][slot].has(key)) {
          penalties += 200; // CRITICAL: Student conflict
        }
        yearLevelProgramSchedule[date][slot].add(key);
      }

      // Check consecutive conflicts (no back-to-back exams for same year+program)
      const lastTimeSlot = consecutiveTracker[date].get(key);
      if (lastTimeSlot) {
        const lastIndex = times.indexOf(lastTimeSlot);
        const currentIndex = times.indexOf(timeSlot);
        const slotsNeeded = Math.ceil(totalDurationMinutes / 30);
        
        // Check if current exam starts right after previous exam ends
        if (currentIndex !== -1 && lastIndex !== -1 && currentIndex === lastIndex + slotsNeeded) {
          penalties += 80; // Back-to-back penalty
        }
      }
      consecutiveTracker[date].set(key, timeSlot);

      // Check room and proctor conflicts
      sections.forEach((section: any, idx: number) => {
        const roomId = roomAssignments[idx];
        const proctorId = proctorAssignments[idx];
        const enrolledCount = section.enrolled_students ?? 0;

        // Room penalties
        if (!roomId || roomId === "") {
          penalties += 1500; // CRITICAL: No room assigned
        } else {
          const roomCapacity = roomCapacityMap.get(roomId);
          
          if (!roomCapacity || roomCapacity < enrolledCount) {
            penalties += 300; // Insufficient capacity
          }

          // Check room time conflicts
          for (const slot of timeSlots) {
            if (!roomSchedule[date][slot]) roomSchedule[date][slot] = new Set();
            if (roomSchedule[date][slot].has(roomId)) {
              penalties += 200; // Room double-booked
            }
            roomSchedule[date][slot].add(roomId);
          }
        }

        // Proctor penalties
        if (proctorId === -1) {
          penalties += 800; // CRITICAL: No proctor assigned
        } else {
          // Check proctor time conflicts
          for (const slot of timeSlots) {
            if (!proctorSchedule[date][slot]) proctorSchedule[date][slot] = new Set();
            if (proctorSchedule[date][slot].has(proctorId)) {
              penalties += 150; // Proctor double-booked
            }
            proctorSchedule[date][slot].add(proctorId);
          }
        }
      });
    }

    // NEW: Penalize uneven date distribution
    const totalCourses = chromosome.length;
    const numDates = allAvailableDates.length;
    const idealCoursesPerDate = totalCourses / numDates;
    
    // Calculate variance in date usage
    let distributionPenalty = 0;
    for (const date of allAvailableDates) {
      const count = dateUsageCount[date] || 0;
      const deviation = Math.abs(count - idealCoursesPerDate);
      distributionPenalty += deviation * 30; // Penalize uneven distribution
    }
    
    penalties += distributionPenalty;

    return penalties;
  };

  // Tournament selection
  const tournamentSelection = (population: Chromosome[], fitnesses: number[]): Chromosome => {
    let best = Math.floor(Math.random() * population.length);
    
    for (let i = 1; i < TOURNAMENT_SIZE; i++) {
      const contestant = Math.floor(Math.random() * population.length);
      if (fitnesses[contestant] < fitnesses[best]) {
        best = contestant;
      }
    }
    
    return [...population[best].map(gene => ({ ...gene, roomAssignments: [...gene.roomAssignments], proctorAssignments: [...gene.proctorAssignments] }))];
  };

  // Crossover (uniform crossover for better mixing)
  const crossover = (parent1: Chromosome, parent2: Chromosome): [Chromosome, Chromosome] => {
    const child1: Chromosome = [];
    const child2: Chromosome = [];
    
    for (let i = 0; i < parent1.length; i++) {
      if (Math.random() < 0.5) {
        child1.push({ ...parent1[i], roomAssignments: [...parent1[i].roomAssignments], proctorAssignments: [...parent1[i].proctorAssignments] });
        child2.push({ ...parent2[i], roomAssignments: [...parent2[i].roomAssignments], proctorAssignments: [...parent2[i].proctorAssignments] });
      } else {
        child1.push({ ...parent2[i], roomAssignments: [...parent2[i].roomAssignments], proctorAssignments: [...parent2[i].proctorAssignments] });
        child2.push({ ...parent1[i], roomAssignments: [...parent1[i].roomAssignments], proctorAssignments: [...parent1[i].proctorAssignments] });
      }
    }
    
    return [child1, child2];
  };

  // Mutation (improved)
  const mutate = (chromosome: Chromosome): Chromosome => {
    return chromosome.map(gene => {
      if (Math.random() < MUTATION_RATE) {
        const mutationType = Math.floor(Math.random() * 4);
        const sections = groupedByCourse[gene.courseId];
        
        if (mutationType === 0) {
          // Mutate date (only from selected dates)
          const newDate = allAvailableDates[Math.floor(Math.random() * allAvailableDates.length)];
          
          // Also reassign proctors for the new date
          const availableProctors = availabilityMap.get(newDate) || [];
          const newProctorAssignments = gene.proctorAssignments.map(() => 
            availableProctors.length > 0 
              ? availableProctors[Math.floor(Math.random() * availableProctors.length)]
              : -1
          );
          
          return { ...gene, date: newDate, proctorAssignments: newProctorAssignments };
        } else if (mutationType === 1) {
          // Mutate time
          return { ...gene, timeSlot: times[Math.floor(Math.random() * times.length)] };
        } else if (mutationType === 2) {
          // Mutate room for a random section
          const sectionIdx = Math.floor(Math.random() * sections.length);
          const section = sections[sectionIdx];
          const suitableRooms = suitableRoomsBySection.get(section.modality_id) || [];
          
          if (suitableRooms.length > 0) {
            const newRoomAssignments = [...gene.roomAssignments];
            newRoomAssignments[sectionIdx] = suitableRooms[Math.floor(Math.random() * suitableRooms.length)];
            return { ...gene, roomAssignments: newRoomAssignments };
          }
        } else {
          // Mutate proctor for a random section
          const sectionIdx = Math.floor(Math.random() * sections.length);
          const availableProctors = availabilityMap.get(gene.date) || [];
          
          if (availableProctors.length > 0) {
            const newProctorAssignments = [...gene.proctorAssignments];
            newProctorAssignments[sectionIdx] = availableProctors[Math.floor(Math.random() * availableProctors.length)];
            return { ...gene, proctorAssignments: newProctorAssignments };
          }
        }
      }
      return { ...gene, roomAssignments: [...gene.roomAssignments], proctorAssignments: [...gene.proctorAssignments] };
    });
  };

  // Initialize population
  console.log("Initializing population...");
  let population: Chromosome[] = [];
  for (let i = 0; i < POPULATION_SIZE; i++) {
    population.push(generateRandomChromosome());
  }

  let bestChromosome: Chromosome | null = null;
  let bestFitness = Infinity;

  // Evolution loop
  console.log("Starting evolution...");
  for (let generation = 0; generation < GENERATIONS; generation++) {
    // Calculate fitness for all chromosomes
    const fitnesses = population.map(calculateFitness);
    
    // Track best solution
    const currentBestIdx = fitnesses.indexOf(Math.min(...fitnesses));
    if (fitnesses[currentBestIdx] < bestFitness) {
      bestFitness = fitnesses[currentBestIdx];
      bestChromosome = population[currentBestIdx];
      console.log(`Generation ${generation + 1}/${GENERATIONS}: Best fitness = ${bestFitness}`);
    }

    // Stop early if perfect solution found
    if (bestFitness === 0) {
      console.log("Perfect solution found!");
      break;
    }

    // Create next generation
    const nextPopulation: Chromosome[] = [];

    // Elitism: keep best solutions
    const sortedIndices = fitnesses
      .map((fit, idx) => ({ fit, idx }))
      .sort((a, b) => a.fit - b.fit)
      .map(x => x.idx);
    
    for (let i = 0; i < ELITE_SIZE; i++) {
      nextPopulation.push(population[sortedIndices[i]].map(gene => ({ 
        ...gene, 
        roomAssignments: [...gene.roomAssignments], 
        proctorAssignments: [...gene.proctorAssignments] 
      })));
    }

    // Generate rest through selection, crossover, and mutation
    while (nextPopulation.length < POPULATION_SIZE) {
      const parent1 = tournamentSelection(population, fitnesses);
      const parent2 = tournamentSelection(population, fitnesses);
      
      const [child1, child2] = crossover(parent1, parent2);
      
      nextPopulation.push(mutate(child1));
      if (nextPopulation.length < POPULATION_SIZE) {
        nextPopulation.push(mutate(child2));
      }
    }

    population = nextPopulation;
  }

  console.log(`Evolution complete! Best fitness: ${bestFitness}`);

  // Convert best chromosome to schedule
  if (!bestChromosome) {
    alert("Could not find a valid schedule. Please select more exam dates or adjust constraints.");
    return;
  }

  const scheduledExams: any[] = [];

  for (const gene of bestChromosome) {
    const { courseId, date, timeSlot, roomAssignments, proctorAssignments } = gene;
    const sections = groupedByCourse[courseId];

    // Skip if any assignment is invalid
    if (roomAssignments.some(r => !r || r === "") || proctorAssignments.some(p => p === -1)) {
      unscheduledCourses.push(courseId);
      continue;
    }

    // Find matching exam period
    const matchedPeriod = examPeriods.find((p) => {
      const start = new Date(p.start_date);
      const end = new Date(p.end_date);
      return new Date(date) >= start && new Date(date) <= end;
    });

    if (!matchedPeriod) {
      unscheduledCourses.push(courseId);
      continue;
    }

    // Build exam times
    const [startHour, startMinute] = timeSlot.split(":").map(Number);
    const endHour = startHour + Math.floor((startMinute + totalDurationMinutes) / 60);
    const endMinute = (startMinute + totalDurationMinutes) % 60;
    const endTime = `${String(endHour).padStart(2, "0")}:${String(endMinute).padStart(2, "0")}`;
    const startTimestamp = `${date}T${timeSlot}:00Z`;
    const endTimestamp = `${date}T${endTime}:00Z`;

    // Schedule each section
    sections.forEach((section: any, idx: number) => {
      const sectionRoomId = roomAssignments[idx];
      const proctorId = proctorAssignments[idx];
      
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
        exam_date: date,
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
  }

  // Warnings
  if (unscheduledCourses.length) {
    const courseNames = unscheduledCourses.map(cId => {
      const course = courses.find(c => c.course_id === cId);
      return course ? `${cId} (${course.course_name})` : cId;
    }).join("\n");
    
    alert(
      `Could not schedule ${unscheduledCourses.length} course(s):\n\n${courseNames}\n\nTry: \n- Selecting more exam dates\n- Ensuring enough proctors are available\n- Checking room capacity`
    );
  }

  if (!scheduledExams.length) {
    alert("No valid schedules to save. Please adjust your selection.");
    return;
  }

  // Save to DB
  try {
    await api.post('/tbl_examdetails', scheduledExams);
    alert(`${scheduledExams.length} schedules saved successfully!`);
  } catch (err: any) {
    alert("Error saving schedule: " + (err.response?.data?.message || err.message));
  }
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