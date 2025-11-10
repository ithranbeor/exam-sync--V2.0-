import React, { useEffect, useMemo, useState } from "react";
import { api } from '../lib/apiClient.ts';
import "../styles/SchedulerPlottingSchedule.css";
import Select, { components } from "react-select";
import { FaPlay, FaSpinner } from "react-icons/fa";
<<<<<<< HEAD
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import CreatableSelect from "react-select/creatable"
=======
import { toast } from 'react-toastify';
import qs from 'qs';
>>>>>>> 08b30fc42e1ae70801a91de9d4a9b16c1b281979

interface ExamDetail {
  course_id: string;
  program_id: string;
  modality_id: number;
  examperiod_id: number;
  section_name?: string | null;
  academic_year?: string | null;
  semester?: string | null;
  exam_category?: string | null;
  exam_period?: string | null;
  exam_date?: string | null;
  room_id?: string | null;
}

interface SchedulerProps {
  user: {
    user_id: number;
    email_address: string;
    contact_number: string;
  } | null;
}

interface Gene {
  sectionId: number;
  date: string;
  timeSlot: string;
  roomId: string;
  proctorId: number;
}

type Chromosome = Gene[];

const SchedulerPlottingSchedule: React.FC<SchedulerProps> = ({ user }) => {
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
<<<<<<< HEAD
  const [sectionCourses, setSectionCourses] = useState<any[]>([]);
  const [userCollegeIds, setUserCollegeIds] = useState<string[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [modalityPreviewSearchTerm, setModalityPreviewSearchTerm] = useState('');
=======
  const [userCollegeIds, setUserCollegeIds] = useState<string[]>([]);
  const [_departments, setDepartments] = useState<any[]>([]);
  const [modalityPreviewSearchTerm, setModalityPreviewSearchTerm] = useState(''); 
>>>>>>> 08b30fc42e1ae70801a91de9d4a9b16c1b281979
  const [loading, setLoading] = useState(false);

  const [roomsCache, setRoomsCache] = useState<any[]>([]);
  const [buildingsCache, setBuildingsCache] = useState<any[]>([]);
  const [collegesCache, setCollegesCache] = useState<any[]>([]);

  const [duration, setDuration] = useState({ hours: 1, minutes: 0 });
  const [selectedStartTime, setSelectedStartTime] = useState<string>("");

  const times = [
    "07:00", "07:30", "08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
    "12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30",
    "17:00", "17:30", "18:00", "18:30", "19:00", "19:30", "20:00", "20:30"
  ];

  // ============================================
  // OPTIMIZED: Initial Data Load
  // ============================================
  useEffect(() => {
<<<<<<< HEAD
    const fetchAll = async () => {
      if (!user?.user_id) {
        console.warn("No user found — cannot fetch data.");
        return;
      }

=======
    const fetchInitialData = async () => {
>>>>>>> 08b30fc42e1ae70801a91de9d4a9b16c1b281979
      try {
        const [
          { data: allColleges },
          { data: userRoles },
        ] = await Promise.all([
          supabase.from("tbl_college").select("college_id, college_name"),
          supabase.from("tbl_user_role").select("college_id, role_id").eq("user_id", user.user_id).eq("role_id", 3),
        ]);

        setCollegesCache(allColleges || []);

        if (!userRoles || userRoles.length === 0) {
          alert("No scheduler role found. Contact administrator.");
          return;
        }

        const collegeIds = Array.from(new Set(
          userRoles.map(r => String(r.college_id)).filter(Boolean)
        ));
        setUserCollegeIds(collegeIds);

        if (collegeIds.length === 0) {
          alert("No college assigned to your role.");
          return;
        }

<<<<<<< HEAD
        const [
          { data: allExamPeriods },
          { data: allDepartments },
          { data: allPrograms },
          { data: mods },
          { data: crs },
          { data: trms },
          { data: sectCourses },
          { data: rooms },
          { data: buildings },
        ] = await Promise.all([
          supabase.from("tbl_examperiod").select("*"),
          supabase.from("tbl_department").select("department_id, college_id"),
          supabase.from("tbl_program").select("*"),
          supabase.from("tbl_modality").select("*"),
          supabase.from("tbl_course").select("*"),
          supabase.from("tbl_term").select("*"),
          supabase.from("tbl_sectioncourse").select("*"),
          supabase.from("tbl_rooms").select("room_id, building_id, room_capacity"),
          supabase.from("tbl_buildings").select("building_id, building_name"),
        ]);

        const filteredExamPeriods = (allExamPeriods || []).filter(p => 
          collegeIds.includes(String(p.college_id))
        );
        const filteredDepartments = (allDepartments || []).filter(d => 
          collegeIds.includes(String(d.college_id))
        );
        const allowedDeptIds = filteredDepartments.map(d => String(d.department_id));
        const filteredPrograms = (allPrograms || []).filter(p => 
          allowedDeptIds.includes(String(p.department_id))
        );
=======
        // ✅ STEP 1: Fetch colleges first
        const collegesRes = await api.get("/tbl_college/").catch(err => { 
          console.error("Error fetching colleges:", err); 
          return { data: [] }; 
        });
        const allColleges = Array.isArray(collegesRes.data) ? collegesRes.data : [];
        setCollegesCache(allColleges);

        // ✅ STEP 2: Get user roles
        const userRolesRes = await api.get(`/user-roles/${realUserId}/roles/`);
        const roles = Array.isArray(userRolesRes.data) ? userRolesRes.data : [];
        console.log("User roles raw response:", userRolesRes.data);
        
        const collegeIdentifiers = roles
          .map((r: any) => {
            if (typeof r.college === "string" && r.college.trim() !== "") {
              return r.college; // e.g., "CITC"
            }
            if (r.college_id) {
              return String(r.college_id);
            }
            return null;
          })
          .filter((id): id is string => Boolean(id));

        if (collegeIdentifiers.length === 0) {
          console.warn("No colleges found for this user.");
          setUserCollegeIds([]);
          toast.warn("No user roles found or invalid endpoint.");
          return;
        }

        // Remove duplicates
        const uniqueCollegeIdentifiers = Array.from(new Set(collegeIdentifiers));
        console.log("User college identifiers:", uniqueCollegeIdentifiers);
        
        setUserCollegeIds(uniqueCollegeIdentifiers);

        // ✅ STEP 3: Fetch data
        const [
          periodsRes,
          deptsRes,
          progsRes,
          termsRes,
        ] = await Promise.all([
          api.get("/tbl_examperiod").catch(err => { console.error("Error fetching exam periods:", err); return { data: [] }; }),
          api.get("/departments/").catch(err => { console.error("Error fetching departments:", err); return { data: [] }; }),
          api.get("/programs/").catch(err => { console.error("Error fetching programs:", err); return { data: [] }; }),
          api.get("/tbl_term").catch(err => { console.error("Error fetching terms:", err); return { data: [] }; }),
        ]);

        const safeArray = (res: any) => (Array.isArray(res.data) ? res.data : []);
        
        const allExamPeriods = safeArray(periodsRes);
        const allDepartments = safeArray(deptsRes);
        const allPrograms = safeArray(progsRes);
        
        console.log("Raw data counts:", {
          examPeriods: allExamPeriods.length,
          departments: allDepartments.length,
          programs: allPrograms.length,
        });

        // ✅ STEP 4: Filter exam periods (check both flat and nested structure)
        const filteredExamPeriods = allExamPeriods.filter((p: any) => {
          const collegeId = p.college_id || p.college?.college_id;
          return uniqueCollegeIdentifiers.includes(String(collegeId));
        });
        
        // ✅ STEP 5: Filter departments (nested college object!)
        const filteredDepartments = allDepartments.filter((d: any) => {
          // Handle nested college object: d.college.college_id
          const collegeId = d.college_id || d.college?.college_id;
          const match = uniqueCollegeIdentifiers.includes(String(collegeId));
          return match;
        });
        
        console.log("Filtered departments:", filteredDepartments.length);
        if (filteredDepartments.length > 0) {
          console.log("Sample filtered departments:", filteredDepartments.slice(0, 2));
        }
        
        // Get department IDs
        const allowedDeptIds = filteredDepartments.map((d: any) => String(d.department_id));
        console.log("Allowed department IDs:", allowedDeptIds);
        
        // ✅ STEP 6: Filter programs (might also have nested department object)
        const filteredPrograms = allPrograms.filter((p: any) => {
          let deptId = null;
          
          // Option 1: Direct department_id field
          if (p.department_id) {
            deptId = String(p.department_id);
          }
          // Option 2: Nested department object with department_id
          else if (p.department && typeof p.department === 'object' && p.department.department_id) {
            deptId = String(p.department.department_id);
          }
          // Option 3: department field is a string like "TblDepartment object (DIT)"
          else if (p.department && typeof p.department === 'string') {
            // Extract department ID from "TblDepartment object (DIT)" format
            const match = p.department.match(/\(([^)]+)\)/);
            if (match && match[1]) {
              deptId = match[1];
            } else {
              // If no parentheses, assume the whole string is the ID
              deptId = p.department;
            }
          }
          
          const matched = deptId && allowedDeptIds.includes(deptId);
          
          return matched;
        });

        console.log("Filtered programs:", filteredPrograms.length);
        if (filteredPrograms.length > 0) {
          console.log("Sample filtered programs:", filteredPrograms.slice(0, 2));
        }
>>>>>>> 08b30fc42e1ae70801a91de9d4a9b16c1b281979

        setExamPeriods(filteredExamPeriods);
        setDepartments(filteredDepartments);
        setPrograms(filteredPrograms);
<<<<<<< HEAD
        setModalities(mods || []);
        setCourses(crs || []);
        setTerms(trms || []);
        setSectionCourses(sectCourses || []);
        setRoomsCache(rooms || []);
        setBuildingsCache(buildings || []);
=======
        setTerms(safeArray(termsRes));

        console.log("=== INITIAL DATA LOADED (CLIENT-SIDE FILTERED) ===", {
          examPeriods: filteredExamPeriods.length,
          departments: filteredDepartments.length,
          programs: filteredPrograms.length,
          terms: safeArray(termsRes).length,
          userCollegeIds: uniqueCollegeIdentifiers,
        });

        // ✅ STEP 7: Fetch static data
        fetchStaticData();

>>>>>>> 08b30fc42e1ae70801a91de9d4a9b16c1b281979
      } catch (err: any) {
        console.error("Failed to fetch data:", err);
        alert("Failed to fetch data");
      }
    };

    fetchInitialData();
  }, [user]);

<<<<<<< HEAD
  // ============================================================================
  // COMPUTED DATA
  // ============================================================================

  const checkExistingSchedules = async (modalityIds: number[]): Promise<Set<number>> => {
    const { data: existingSchedules, error } = await supabase
      .from("tbl_examdetails")
      .select("modality_id")
      .in("modality_id", modalityIds);

    if (error) {
      console.error("Error checking existing schedules:", error);
      return new Set();
    }

    return new Set(existingSchedules?.map(s => s.modality_id) || []);
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
    const allowedPeriods = examPeriods.filter(p => userCollegeIds.includes(String(p.college_id)));
    const days: { key: string; iso: string; label: string }[] = [];
    
    allowedPeriods.forEach(period => {
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
    return days.filter(d => {
      if (seen.has(d.iso)) return false;
      seen.add(d.iso);
      return true;
    });
  }, [examPeriods, userCollegeIds]);

  const filteredCoursesByPrograms = useMemo(() => {
    if (formData.selectedPrograms.length === 0) return [];
    const courseIds = Array.from(new Set(
      sectionCourses.filter(sc => formData.selectedPrograms.includes(sc.program_id)).map(sc => sc.course_id)
    ));
    return courses.filter(c => courseIds.includes(c.course_id));
  }, [formData.selectedPrograms, sectionCourses, courses]);

  const filteredModalitiesBySelection = useMemo(() => {
    if (formData.selectedPrograms.length === 0 || formData.selectedCourses.length === 0) return [];
    return modalities.filter(m =>
      formData.selectedPrograms.includes(m.program_id) && formData.selectedCourses.includes(m.course_id)
    );
  }, [formData.selectedPrograms, formData.selectedCourses, modalities]);

  // Auto-select first options
=======
  // ============================================
  // STATIC DATA FETCHING (Can be cached)
  // ============================================
  const fetchStaticData = async () => {
    try {
      const [roomsRes, buildingsRes] = await Promise.all([
        api.get("/tbl_rooms").catch(err => { console.error("Error fetching rooms:", err); return { data: [] }; }),
        api.get("/tbl_buildings").catch(err => { console.error("Error fetching buildings:", err); return { data: [] }; }),
      ]);

      const safeArray = (res: any) => (Array.isArray(res.data) ? res.data : []);
      setRoomsCache(safeArray(roomsRes));
      setBuildingsCache(safeArray(buildingsRes));

      console.log("=== STATIC DATA LOADED ===", {
        rooms: safeArray(roomsRes).length,
        buildings: safeArray(buildingsRes).length,
      });
    } catch (err: any) {
      console.error("Failed to fetch static data:", err);
    }
  };

  // ============================================
  // LAZY LOAD COURSES (when programs selected)
  // ============================================
  useEffect(() => {
    const fetchCourses = async () => {
      if (formData.selectedPrograms.length === 0) {
        setCourses([]);
        setFormData(prev => ({ ...prev, selectedCourses: [], selectedModalities: [] }));
        return;
      }

      try {
        // Fetch all courses and section courses in parallel
        const [coursesRes, sectionCoursesRes] = await Promise.all([
          api.get("/courses/"),
          api.get("/tbl_sectioncourse/")
        ]);
        
        const allCourses = Array.isArray(coursesRes.data) ? coursesRes.data : [];
        const allSectionCourses = Array.isArray(sectionCoursesRes.data) ? sectionCoursesRes.data : [];
        
        console.log("All courses:", allCourses.length);
        console.log("All section courses:", allSectionCourses.length);
        console.log("Selected programs:", formData.selectedPrograms);
        
        // DEBUG: Check what program_id looks like in section courses
        if (allSectionCourses.length > 0) {
          console.log("Sample section course:", allSectionCourses[0]);
          console.log("Sample section course program_id type:", typeof allSectionCourses[0]?.program_id);
          
          // Check if there's a program object instead of program_id
          if (allSectionCourses[0]?.program) {
            console.log("Section course has nested program object:", allSectionCourses[0].program);
          }
          
          // Show unique program IDs in section courses
          const uniquePrograms = Array.from(new Set(allSectionCourses.map((sc: any) => 
            sc.program_id || sc.program?.program_id || sc.program
          )));
          console.log("Unique program IDs in section courses:", uniquePrograms.slice(0, 20));
        }
        
        // Get unique course IDs that belong to ANY of the selected programs
        // Handle both direct program_id and nested program.program_id
        const courseIds = Array.from(
          new Set(
            allSectionCourses
              .filter((sc: any) => {
                const programId = sc.program_id || sc.program?.program_id || sc.program;
                const matches = formData.selectedPrograms.includes(programId);
                if (matches) {
                  console.log("Matched section course:", programId, sc.course_id);
                }
                return matches;
              })
              .map((sc: any) => sc.course_id || sc.course?.course_id || sc.course)
          )
        );
        
        console.log("Filtered course IDs:", courseIds);
        
        // Filter courses to only those in the courseIds list
        const filteredCourses = allCourses.filter((c: any) => courseIds.includes(c.course_id));
        
        setCourses(filteredCourses);
        console.log("Courses loaded for selected programs:", filteredCourses.length);
        
        // Clear selected courses that are no longer valid
        setFormData(prev => ({
          ...prev,
          selectedCourses: prev.selectedCourses.filter(courseId => courseIds.includes(courseId)),
          selectedModalities: []
        }));
      } catch (err: any) {
        console.error("Error fetching courses:", err);
        setCourses([]);
      }
    };

    fetchCourses();
  }, [formData.selectedPrograms]);

  // ============================================
  // LAZY LOAD MODALITIES (when courses selected)
  // ============================================
  useEffect(() => {
    const fetchModalities = async () => {
      if (formData.selectedCourses.length === 0) {
        setModalities([]);
        setFormData(prev => ({ ...prev, selectedModalities: [] }));
        return;
      }

      try {
        // Always fetch all modalities (most Django APIs ignore params)
        const response = await api.get("/tbl_modality/");
        const allModalities = Array.isArray(response.data) ? response.data : [];

        // ✅ Filter strictly by selectedCourses
        const filtered = allModalities.filter((m: any) => {
          const courseId =
            m.course_id ||
            m.course?.course_id ||
            (typeof m.course === "string" ? m.course : null);

          return courseId && formData.selectedCourses.includes(courseId);
        });

        console.log("Filtered modalities:", filtered.length, "of", allModalities.length);
        setModalities(filtered);
      } catch (err: any) {
        console.error("Error fetching modalities:", err);
        setModalities([]);
      }
    };

    fetchModalities();
  }, [formData.selectedCourses]);

  // ============================================
  // LAZY LOAD SECTION COURSES (when needed for save)
  // ============================================
  const fetchSectionCourses = async () => {
    try {
      // Try with params first, fallback to client-side filtering
      try {
        const { data } = await api.get("/tbl_sectioncourse/", {
          params: {
            program_ids: formData.selectedPrograms.join(','),
            course_ids: formData.selectedCourses.join(',')
          }
        });
        return Array.isArray(data) ? data : [];
      } catch (err) {
        // If backend doesn't support filtering, fetch all and filter client-side
        console.warn("Backend doesn't support filtering, using client-side filter");
        const { data } = await api.get("/tbl_sectioncourse/");
        const allSectionCourses = Array.isArray(data) ? data : [];
        
        return allSectionCourses.filter((sc: any) =>
          formData.selectedPrograms.includes(sc.program_id) &&
          formData.selectedCourses.includes(sc.course_id)
        );
      }
    } catch (err: any) {
      console.error("Error fetching section courses:", err);
      return [];
    }
  };

  const filteredCoursesByPrograms = useMemo(() => {
    // Courses are already filtered by selected programs from API
    return courses;
  }, [courses]);

  const filteredModalitiesBySelection = useMemo(() => {
    // Modalities are already filtered by selected programs/courses from API
    return modalities;
  }, [modalities]);

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

>>>>>>> 08b30fc42e1ae70801a91de9d4a9b16c1b281979
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

<<<<<<< HEAD
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
  // GENETIC ALGORITHM FUNCTIONS
  // ============================================================================

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
    const courseTimeSlotAssignments = new Map<string, Map<string, string>>();
    const roomTimeRanges = new Map<string, Array<{ start: number; end: number }>>();
    const proctorTimeRanges = new Map<string, Array<{ start: number; end: number }>>();
    const scheduledSections = new Set<number>(); 
    
    const globalTimeSlotYearLevels = new Map<string, Map<string, Set<string>>>();

    allSections.forEach(section => {
      if (scheduledSections.has(section.modality_id)) {
        return; // Skip if already scheduled
      }

      if (!sectionMap.has(section.modality_id)) {
        console.warn(`Section ${section.modality_id} not found in sectionMap. Skipping.`);
        return;
      }

      const yearLevel = extractYearLevel(section.section_name);
      const courseId = section.course_id;
      const programId = section.program_id;
      const isNightClass = section.is_night_class === "YES";

      // Determine valid time slots for this section
      const validTimesForSection = isNightClass 
        ? eveningTimeSlots.filter(t => {
            const [h, m] = t.split(":").map(Number);
            const end = (h * 60 + m) + totalDurationMinutes;
            return end <= 21 * 60; // Must end by 9 PM
          })
        : validTimes.filter(t => !eveningTimeSlots.includes(t)); // Day classes exclude evening slots

      // Use sortedDates
      let date = courseDateAssignment.get(courseId);
      if (!date || !sortedDates.includes(date)) {
        date = sortedDates[Math.floor(Math.random() * sortedDates.length)];
        courseDateAssignment.set(courseId, date);
      }

      // Get college ID for this section
      const program = programs.find(p => p.program_id === programId);
      const departmentId = program ? String(program.department_id) : "unknown";
      const department = departments.find(d => String(d.department_id) === departmentId);
      const collegeId = department ? String(department.college_id) : "unknown";

      // Create unique key for course time slot assignments based on night class status
      const courseKey = isNightClass ? `${courseId}_NIGHT` : courseId;
      
      if (!courseTimeSlotAssignments.has(courseKey)) {
        courseTimeSlotAssignments.set(courseKey, new Map());
      }

      let timeSlot: string;
      if (courseTimeSlotAssignments.get(courseKey)!.has(date)) {
        timeSlot = courseTimeSlotAssignments.get(courseKey)!.get(date)!;
      } else {
        timeSlot = validTimesForSection[Math.floor(Math.random() * validTimesForSection.length)];
        let attempts = 0;
        
        while (attempts < 20) {
          const startMinutes = timeToMinutes(timeSlot);
          
          // Check if this time slot would violate year level sequencing
          let hasConflict = false;
          
          // Check all time slots that this exam would occupy
          const examSlots: string[] = [];
          for (let offset = 0; offset < totalDurationMinutes; offset += 30) {
            const slotMinutes = startMinutes + offset;
            const h = Math.floor(slotMinutes / 60);
            const m = slotMinutes % 60;
            examSlots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
          }
          
          // For each slot this exam occupies, check if same year+college already scheduled
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
          
          // Also check the time slots immediately before and after (within exam duration gap)
          if (!hasConflict) {
            // Check slots before
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
            
            // Check slots after
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
        
        // Register this year level + college for:
        // 1. All slots the exam occupies
        // 2. Buffer slots BEFORE (to prevent scheduling same year+college right before)
        // 3. Buffer slots AFTER (to prevent scheduling same year+college right after)
        const startMinutes = timeToMinutes(timeSlot);
        
        // Register buffer BEFORE the exam (exam duration worth of slots)
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
        
        // Register the actual exam slots
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
        
        // Register buffer AFTER the exam (exam duration worth of slots)
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

    // Proctor assignment - prioritize instructor for night classes
    let proctorId = -1;

    if (isNightClass && section.instructor_id) {
      const availableProctors = getAvailableProctors(date, timeSlot);
      if (availableProctors.includes(section.instructor_id)) {
        // Check if instructor has no time conflict
        const proctorDateKey = `${date}|${section.instructor_id}`;
        const existingRanges = proctorTimeRanges.get(proctorDateKey) || [];
        if (!existingRanges.some(range => rangesOverlap(startMinutes, endMinutes, range.start, range.end))) {
          proctorId = section.instructor_id;
          if (!proctorTimeRanges.has(proctorDateKey)) proctorTimeRanges.set(proctorDateKey, []);
          proctorTimeRanges.get(proctorDateKey)!.push({ start: startMinutes, end: endMinutes });
        }
      }
    }

    // If not assigned yet (not night class or instructor unavailable/conflict), use normal logic
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
        
        // Only fallback to random if no conflict-free proctor found
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

      // Get department and college for this section
      const program = programs.find(p => p.program_id === programId);
      const departmentId = program ? String(program.department_id) : "unknown";
      const department = departments.find(d => String(d.department_id) === departmentId);
      const collegeId = department ? String(department.college_id) : "unknown";

      // Section uniqueness
      sectionScheduledCount.set(gene.sectionId, (sectionScheduledCount.get(gene.sectionId) || 0) + 1);
      if (sectionScheduledCount.get(gene.sectionId)! > 1) {
        fitness -= 10000;
      }

      // Course must be on same date
      if (!courseDateAssignments.has(courseId)) {
        courseDateAssignments.set(courseId, new Set());
      }
      courseDateAssignments.get(courseId)!.add(date);
      if (courseDateAssignments.get(courseId)!.size > 1) {
        fitness -= 25000;
      }

      // Same course must be at same time
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

      // Year level consistency (per college)
      const timeSlotKey = `${date}|${timeSlot}`;
      if (!yearLevelByTimeSlotAndCollege.has(timeSlotKey)) {
        yearLevelByTimeSlotAndCollege.set(timeSlotKey, new Map());
      }
      const collegeMap = yearLevelByTimeSlotAndCollege.get(timeSlotKey)!;
      if (!collegeMap.has(collegeId)) {
        collegeMap.set(collegeId, new Set());
      }
      collegeMap.get(collegeId)!.add(yearLevel);
      
      // Penalty if same college has multiple year levels at same time
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
        existingRanges.push({ start: startMinutes, end: endMinutes, sectionId: gene.sectionId });
      }

      // Proctor assignment and alternating department policy
      if (proctorId === -1) {
        fitness -= 6000;
      } else {
        const proctorDateKey = `${date}|${proctorId}`;
        if (!proctorTimeRanges.has(proctorDateKey)) {
          proctorTimeRanges.set(proctorDateKey, []);
        }
        const existingProctorRanges = proctorTimeRanges.get(proctorDateKey)!;
        
        existingProctorRanges.forEach(existing => {
          // Check for time overlap (proctor in multiple places)
          if (rangesOverlap(startMinutes, endMinutes, existing.start, existing.end)) {
            fitness -= 30000; // MASSIVE PENALTY: Physical impossibility
          } 
          // Check alternating department policy
          else {
            // If this exam immediately follows a previous exam (no gap)
            if (existing.end === startMinutes) {
              // Both exams are from the same department
              if (existing.deptId === departmentId) {
                fitness -= 12000; // CRITICAL: Violates alternating policy
              }
            }
            // If there's a gap but it's less than the duration of the previous exam
            else if (startMinutes > existing.end && startMinutes < existing.end + totalDurationMinutes) {
              // Same department without adequate rest
              if (existing.deptId === departmentId) {
                const gapDuration = startMinutes - existing.end;
                const requiredGap = totalDurationMinutes;
                const gapDeficit = requiredGap - gapDuration;
                fitness -= gapDeficit * 100; // Penalty proportional to missing rest time
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

      // Reward scheduled sections
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
    mutationRate: number
  ): Chromosome => {
    const courseDateMap = new Map<string, string>();
    chromosome.forEach(gene => {
      const section = sectionMap.get(gene.sectionId);
      if (section) {
        const courseId = section.course_id;
        if (!courseDateMap.has(courseId)) {
          courseDateMap.set(courseId, gene.date);
=======
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

    // ✅ Only unique days for this college's exam periods
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

    // ✅ Fetch section courses ONLY when saving
    console.log("Fetching section courses...");
    const fetchedSectionCourses = (await fetchSectionCourses()).map((sc: any) => ({
      ...sc,
      course_id: sc.course?.course_id ?? null,
      course_name: sc.course?.course_name ?? null,
    }));

    // ✅ Fetch availability ONLY for selected dates
    console.log("Fetching availability for selected dates...");
    const { data: allAvailability } = await api.get('/tbl_availability/', {   // ✅ add slash here
      params: {
        status: 'available',
        day: sortedDates,
      },
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
>>>>>>> 08b30fc42e1ae70801a91de9d4a9b16c1b281979
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
<<<<<<< HEAD
    });

    return chromosome.map(gene => {
      if (Math.random() < mutationRate) {
        const section = sectionMap.get(gene.sectionId);
        if (!section) return { ...gene };

        const courseId = section.course_id;
        const isNightClass = section.is_night_class === "YES";
        const mutationType = Math.floor(Math.random() * 4);
        const suitableRooms = sectionRoomsMap.get(gene.sectionId) || [];

        // Determine valid time slots for this section
        const validTimesForSection = isNightClass 
          ? eveningTimeSlots.filter(t => {
              const [h, m] = t.split(":").map(Number);
              const totalDurationMinutes = duration.hours * 60 + duration.minutes;
              const end = (h * 60 + m) + totalDurationMinutes;
              return end <= 21 * 60;
            })
          : validTimes;

        if (mutationType === 0 && Math.random() < 0.3) {
          // Mutate date
          const newDate = sortedDates[Math.floor(Math.random() * sortedDates.length)];
          courseDateMap.set(courseId, newDate);
          
          const availableProctors = getAvailableProctors(newDate, gene.timeSlot);
          let newProctorId = -1;
          
          // Prioritize instructor for night classes
          if (isNightClass && section.instructor_id && availableProctors.includes(section.instructor_id)) {
            newProctorId = section.instructor_id;
          } else {
            newProctorId = availableProctors.length > 0
              ? availableProctors[Math.floor(Math.random() * availableProctors.length)]
              : -1;
          }
          
          return { ...gene, date: newDate, proctorId: newProctorId };
        } else if (mutationType === 1) {
          // Mutate time slot
          const newTimeSlot = validTimesForSection[Math.floor(Math.random() * validTimesForSection.length)];
          const availableProctors = getAvailableProctors(gene.date, newTimeSlot);
          
          let newProctorId = -1;
          
          // Prioritize instructor for night classes
          if (isNightClass && section.instructor_id && availableProctors.includes(section.instructor_id)) {
            newProctorId = section.instructor_id;
          } else {
            newProctorId = availableProctors.length > 0
              ? availableProctors[Math.floor(Math.random() * availableProctors.length)]
              : -1;
          }
          
          return { ...gene, timeSlot: newTimeSlot, proctorId: newProctorId };
        } else if (mutationType === 2) {
          // Mutate room
          const newRoomId = suitableRooms.length > 0
            ? suitableRooms[Math.floor(Math.random() * suitableRooms.length)]
            : "";
          return { ...gene, roomId: newRoomId };
        } else {
          // Mutate proctor
          const availableProctors = getAvailableProctors(gene.date, gene.timeSlot);
          let newProctorId = -1;
          
          // Prioritize instructor for night classes
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
    const { data: allAvailability, error: availError } = await supabase
      .from("tbl_availability")
      .select("user_id, days, time_slots")
      .eq("status", "available");

    if (availError) {
      console.error("Error fetching availability:", availError);
      toast.error("Failed to fetch proctor availability");
      return;
    }

    const TIME_SLOT_RANGES: Record<string, string[]> = {
      "7 AM - 1 PM (Morning)": ["07:00", "07:30", "08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "12:30"],
      "1 PM - 6 PM (Afternoon)": ["13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30"],
      "6 PM - 9 PM (Evening)": ["18:00", "18:30", "19:00", "19:30", "20:00", "20:30"]
    };

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
        // Find the corresponding section course data
        const sectionCourseData = sectionCourses.find(
          sc => sc.program_id === selectedModality.program_id &&
                sc.course_id === selectedModality.course_id &&
                sc.section_name === selectedModality.section_name
        );
        
        // Add night class info and instructor to modality
        const enrichedSection = {
          ...selectedModality,
          is_night_class: sectionCourseData?.is_night_class ?? null,
          instructor_id: sectionCourseData?.user_id ?? null
        };
        
        allSections.push(enrichedSection);
        sectionMap.set(modalityId, enrichedSection);
      }
    });

    // Define evening time slots
    const eveningTimeSlots = ["18:00", "18:30", "19:00", "19:30", "20:00", "20:30"];

    // Pre-compute valid times and rooms
    const isValidTimeSlot = (startTime: string, isNightClass: boolean): boolean => {
      const [startHour, startMinute] = startTime.split(":").map(Number);
      const endMinutes = (startHour * 60 + startMinute) + totalDurationMinutes;
      const maxEndTime = 20 * 60 + 60; // 21:00
      
      if (endMinutes > maxEndTime) return false;
      
      // Night classes can only use evening slots
      if (isNightClass) {
        return eveningTimeSlots.includes(startTime);
      }
      
      return true;
    };

    const validTimes = times.filter(t => isValidTimeSlot(t, false));

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
      sectionRoomsMap.set(section.modality_id, [...preferred, ...others]);
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
    allSections.forEach(section => {
      if (section.is_night_class === "YES") {
        const hasEveningSlots = eveningTimeSlots.some(slot => {
          const [h, m] = slot.split(":").map(Number);
          const end = (h * 60 + m) + totalDurationMinutes;
          return end <= 21 * 60;
        });
        
        if (!hasEveningSlots) {
          violations.push(
            `Night class ${section.course_id} - ${section.section_name} cannot be scheduled: exam duration too long for evening slots`
          );
        }
        
        // Check if instructor is available in evening slots
        if (section.instructor_id) {
          let instructorHasEveningAvailability = false;
          for (const date of sortedDates) {
            const isoDate = date.split('T')[0];
            for (const slot of eveningTimeSlots) {
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

    // Assign each course to a specific date (all sections of same course on same date)
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

    // Evolution
    console.log("🧬 Starting genetic algorithm...");
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
        nextPopulation.push(mutate(child1, sectionMap, sortedDates, validTimes, eveningTimeSlots, sectionRoomsMap, getAvailableProctors, MUTATION_RATE));
        if (nextPopulation.length < POPULATION_SIZE) {
          nextPopulation.push(mutate(child2, sectionMap, sortedDates, validTimes, eveningTimeSlots, sectionRoomsMap, getAvailableProctors, MUTATION_RATE));
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
      const section = sectionMap.get(gene.sectionId);
      if (!section) continue;

      const { date, timeSlot, roomId, proctorId } = gene;
      const courseId = section.course_id;

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

      const [startHour, startMinute] = timeSlot.split(":").map(Number);
      const startMinutes = timeToMinutes(timeSlot);
      const endMinutes = startMinutes + totalDurationMinutes;
      const endHour = startHour + Math.floor((startMinute + totalDurationMinutes) / 60);
      const endMinute = (startMinute + totalDurationMinutes) % 60;
      const endTime = `${String(endHour).padStart(2, "0")}:${String(endMinute).padStart(2, "0")}`;

      let hasOverlap = false;

      const roomDateKey = `${date}|${roomId}`;
      const existingRoomRanges = finalRoomTimeRanges.get(roomDateKey) || [];
      for (const existing of existingRoomRanges) {
        if (rangesOverlap(startMinutes, endMinutes, existing.start, existing.end)) {
          console.warn(`⚠️ Room overlap detected`);
          hasOverlap = true;
          break;
        }
      }

      const proctorDateKey = `${date}|${proctorId}`;
      const existingProctorRanges = finalProctorTimeRanges.get(proctorDateKey) || [];
      for (const existing of existingProctorRanges) {
        if (rangesOverlap(startMinutes, endMinutes, existing.start, existing.end)) {
          console.warn(`⚠️ Proctor overlap detected`);
          hasOverlap = true;
          break;
        }
      }

      if (hasOverlap) {
        unscheduledSections.push(`${section.course_id} - ${section.section_name} (time overlap conflict)`);
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
        exam_duration: `${duration.hours}h ${duration.minutes}m`,
        academic_year: academicYear,
        semester: semester,
        exam_category: formData.exam_category ?? null,
        exam_period: examPeriod,
        college_name: collegeNameForCourse,
        building_name: `${buildingName} (${buildingId})`,
        instructor_id: instructorId,
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

    if (scheduledExams.length === 0) {
      alert("No valid schedules to save. Please adjust constraints.");
      return;
    }

    console.log(`💾 Saving ${scheduledExams.length} exam schedules...`);

    const { error } = await supabase.from("tbl_examdetails").insert(scheduledExams);
    if (error) {
      console.error("Database error:", error);
      alert("Error saving schedule: " + error.message);
    } else {
      toast.success(`Successfully scheduled ${scheduledExams.length}/${allSections.length} sections!`);
      console.log(`✅ Successfully saved ${scheduledExams.length} exam schedules`);
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
=======

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

      if (roomAssignments.some(r => !r || r === "") || proctorAssignments.some(p => p === -1)) {
        unscheduledCourses.push(courseId);
        continue;
      }

      const matchedPeriod = examPeriods.find((p) => {
        const start = new Date(p.start_date);
        const end = new Date(p.end_date);
        return new Date(date) >= start && new Date(date) <= end;
      });

      if (!matchedPeriod) {
        unscheduledCourses.push(courseId);
        continue;
      }

      const [startHour, startMinute] = timeSlot.split(":").map(Number);
      const endHour = startHour + Math.floor((startMinute + totalDurationMinutes) / 60);
      const endMinute = (startMinute + totalDurationMinutes) % 60;
      const endTime = `${String(endHour).padStart(2, "0")}:${String(endMinute).padStart(2, "0")}`;
      const startTimestamp = `${date}T${timeSlot}:00Z`;
      const endTimestamp = `${date}T${endTime}:00Z`;

      sections.forEach((section: any, idx: number) => {
        if (!section.course_id) {
          console.warn("Skipping section with missing course_id:", section);
          return;
        }

        const sectionRoomId = roomAssignments[idx];
        const proctorId = proctorAssignments[idx];
        const sectionObj = fetchedSectionCourses.find(
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
          exam_duration: `${String(duration.hours ?? 0).padStart(2, "0")}:${String(duration.minutes ?? 0).padStart(2, "0")}:00`, // ✅ FIXED FORMAT
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
    // Programs are already filtered in the useEffect by college/department
    return programs;
  }, [programs]);
>>>>>>> 08b30fc42e1ae70801a91de9d4a9b16c1b281979

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
              options={addSelectAllOption(programs.map(p => ({ value: p.program_id, label: `${p.program_id} | ${p.program_name}` })))}
              isMulti
              closeMenuOnSelect={false}
              hideSelectedOptions={false}
              components={{ Option: CheckboxOption }}
              onChange={(selected) => {
                let selectedValues = (selected as any[]).map(s => s.value);
                if (selectedValues.includes("__all__")) {
                  selectedValues = [...programs.map(p => p.program_id)];
                }

                // Auto-select all courses under selected programs
                const relatedCourses = filteredCoursesByPrograms.filter(c =>
                  selectedValues.includes(c.program_id)
                );

                setFormData(prev => ({
                  ...prev,
                  selectedPrograms: selectedValues.filter(v => v !== "__all__"),
                  selectedCourses: relatedCourses.map(c => c.course_id),
                  selectedModalities: [],
                }));
              }}
              value={formData.selectedPrograms.map(p => {
                const prog = programs.find(f => f.program_id === p);
                return { value: p, label: prog ? prog.program_id : p };
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
<<<<<<< HEAD
                  const course = filteredCoursesByPrograms.find(c => c.course_id === modality?.course_id);
                  const searchString = [course?.course_id, modality?.section_name, modality?.modality_type].join(' ').toLowerCase();
=======
                  // Access the nested course object from modality
                  const course = modality?.course || filteredCoursesByPrograms.find(c => c.course_id === modality?.course_id);

                  const searchString = [
                    course?.course_id,
                    modality?.section_name,
                    modality?.modality_type,
                  ].join(' ').toLowerCase();

>>>>>>> 08b30fc42e1ae70801a91de9d4a9b16c1b281979
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