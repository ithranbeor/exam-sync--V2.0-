// Scheduler_PlotSchedule.tsx
import React, { useState, useEffect } from 'react';
import { FaEye, FaSearch, FaChevronLeft, FaChevronRight, FaArrowLeft, FaPlayCircle, FaFileExport, FaPaperPlane, FaUserEdit, FaSave, FaTimes} from 'react-icons/fa';
import { FiRefreshCw } from "react-icons/fi";
import { supabase } from '../lib/supabaseClient.ts';
import '../styles/plotschedule.css';
import 'react-toastify/dist/ReactToastify.css';
import { ToastContainer, toast } from 'react-toastify';
import html2pdf from 'html2pdf.js';
import * as XLSX from 'xlsx';

// Children components
import PlotHeader from './PlotHeader.tsx';
import PlotHeaderTable from './PlotHeaderTable.tsx';
import PlotScheduleForm from './PlotScheduleForm.tsx';
import PlotScheduleDisplay from "./PlotScheduleDisplay.tsx";

// Interface/Types
interface Course {
  course_id: string;
  course_name: string;
}

interface Proctor {
  user_id: number;
  full_name: string;
}

interface Modality {
  modality_id: number;
  modality_type: string;
  room_type: string;
  modality_remarks: string;
  course_id: string;
  program_id: string;
  room_id: string | null;
  possible_rooms?: string[];
  section_name: string;
  user_id: number;
  section?: {
    year_level: string;
    term: {
      term_name: string;
    };
  };
}

interface SectionCourse {
  course_id: string;
  program_id: string;
  year_level: string;
  term: {
    term_name: string;
  };
  user_id: number;
  section_name?: string;
}

interface Program {
  program_id: string;
  program_name: string;
}

interface Room {
  room_id: string;
  room_name: string;
  building?: {
    building_id: string;
    building_name: string;
  };
}

interface ExamPeriod {
  examperiod_id: number;
  start_date: string;
  end_date: string;
  academic_year: string;
  exam_category: string;
  college_id?: string;
  term: {
    term_name: string;
  };
  college: {
    college_name: string;
  };
}

interface ExamDetail {
  examdetails_id: string;
  course_id: string;
  program_id: string;
  room_id: string;
  modality_id: string;
  user_id: string;
  exam_period: string;
  exam_date: string;
  exam_duration: string;
  exam_start_time: string;
  exam_end_time: string;
  time_in: string | null;
  time_out: string | null;
  section_name: string;
  academic_year: string;
  semester: string;
  exam_category: string;
}

const Scheduler_PlotSchedule: React.FC = () => {
  const [showPlot, setShowPlot] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [examDetails, setExamDetails] = useState<ExamDetail[]>([]);
  const [selectedExam, setSelectedExam] = useState<ExamDetail | null>(null);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [sectionCourses, setSectionCourses] = useState<SectionCourse[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [modalities, setModalities] = useState<Modality[]>([]);
  const [examPeriods, setExamPeriods] = useState<ExamPeriod[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [_selectedModality, setSelectedModality] = useState<Modality | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);  
  const [availableProctors, setAvailableProctors] = useState<Proctor[]>([]);
  const [_isExporting, _setIsExporting] = useState(false);
  const [mergedPeriods, setMergedPeriods] = useState<{ 
    label: string; 
    value: string; 
    start_date: string; 
    end_date: string; 
  }[]>([]);
  const [examCategories, setExamCategories] = useState<string[]>([]);
  const [instructors, setInstructors] = useState<{ user_id: number; first_name: string; last_name: string }[]>([]);
  const [isReassigning, setIsReassigning] = useState(false);
  const [selectedProctors, setSelectedProctors] = useState<Record<string, string>>({});
  const [examDate, _setExamDate] = useState<string>('');
  const [examStartTime, _setExamStartTime] = useState<string>('');
  const [examEndTime, _setExamEndTime] = useState<string>('');
  const [selectedRoomId, _setSelectedRoom] = useState<number | null>(null);
  const [canonicalSlots, setCanonicalSlots] = useState<Record<string, { start: string; end: string }>>({});
  const [selectedDay, setSelectedDay] = useState<string>("");
  const [showRemarksMap, setShowRemarksMap] = useState<Record<string, boolean>>({});
  const [showDeanModal, setShowDeanModal] = useState(false);
  const [deanName, setDeanName] = useState("");
  const [_deanRole, setDeanRole] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [deanRemarks, setDeanRemarks] = useState<string>("");
  const [deanUserId, setDeanUserId] = useState<number | null>(null);
  const [deanCollegeId, setDeanCollegeId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    course_id: '',
    program_id: '',
    modality_id: '',
    examperiod_id: '',
    academic_term: '',
    exam_category: '',
    days_period_id: '',
    hours: 1,
    minutes: 30,
    proctor_all: true,
    exam_date: '',
    proctor_filter: 'available_only',
    exam_start_time: '',
    exam_end_time: '', 
  });
  const [daysPeriods, setDaysPeriods] = useState<
    { label: string; value: string; examperiod_id: number }[]
  >([]);
  
// Filters

  const filteredExamDetails = examDetails.filter((ed) =>
    ed.examdetails_id?.toString().toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredCourses = formData.program_id
    ? sectionCourses
        .filter((sc) => sc.program_id === formData.program_id)
        .map((sc) => {
        const course = courses.find((c) => c.course_id === sc.course_id);
        return course
            ? {
                course_id: course.course_id,
                course_name: course.course_name,
                year_level: sc.year_level,
                term_name: sc.term?.term_name || 'Unknown',
            }
            : null;
        })
        .filter(
        (c, index, self) =>
            c !== null &&
            index === self.findIndex((t) => t?.course_id === c?.course_id)
        ) as {
        course_id: string;
        course_name: string;
        year_level: string;
        term_name: string;
        }[]
    : [];

  const scheduledRooms =
  rooms && examDetails && formData.exam_date
    ? rooms.filter((room) =>
      examDetails.some(
        (ed) =>
              ed.room_id === room.room_id &&
              new Date(ed.exam_start_time).toDateString() ===
              new Date(formData.exam_date).toDateString()
            )
        )
        : [];

  const columnsPerPage = 5;
  const totalPages = Math.ceil(scheduledRooms.length / columnsPerPage);
  const roomPages = Array.from({ length: totalPages }, (_, i) =>
    scheduledRooms.slice(i * columnsPerPage, i * columnsPerPage + columnsPerPage)
  );

  const [page, setPage] = useState(0);

  const formatFullDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
    });
    


// Effects

  useEffect(() => {
    const fetchExamDetails = async () => {
      const { data, error } = await supabase
        .from('tbl_examdetails')
        .select('*');

        if (error) {
          console.error("Failed to fetch exam details:", error.message);
          setExamDetails([]);
        } else {
          setExamDetails(data || []);
        }
      };
        fetchExamDetails();
      }, 
    []);

    useEffect(() => {
        const map: Record<string, { start: string; end: string }> = {};
    
        (examDetails || []).forEach((ed) => {
          const year = inferYearLevelFromExamDetail(ed);
          const key = `${ed.course_id}||${year}`;
          if (!map[key]) {
            map[key] = {
              start: ed.exam_start_time,
              end: ed.exam_end_time,
            };
          }
        });
    
        setCanonicalSlots(map);
      }, [examDetails, modalities, sectionCourses]);
    
    useEffect(() => {
        const fetchInstructors = async () => {
        const { data, error } = await supabase
            .from('tbl_users')
            .select('*');
    
        if (error) {
            console.error('Error fetching instructors:', error);
        } else {
            setInstructors(data || []);
        }
        };
    
        fetchInstructors();
    }, []);

    useEffect(() => {
        const fetchInitialData = async () => {
          const { data: user, error: userErr } = await supabase.auth.getUser();
          if (userErr || !user?.user?.id) return;
    
          if (formData.examperiod_id) {
            const examPeriodId = parseInt(formData.examperiod_id);
            const { data: examDetailsData, error } = await supabase
              .from('tbl_examdetails')
              .select('*')
              .eq('examperiod_id', examPeriodId);
    
            if (error) {
              console.error('Failed to fetch exam details:', error.message);
            } else {
              setExamDetails(examDetailsData || []);
            }
          } else {
            setExamDetails([]);
          }
    
          const { data: availabilityData } = await supabase
            .from('tbl_availability')
            .select(`
              user_id,
              day,
              time_slot,
              status,
              tbl_users ( first_name, last_name )
            `)
            .eq('status', 'available')
    
          const availableProctors = (availabilityData || [])
            .filter((entry: any) => {
              if (entry.status !== 'available') return false;
              if (entry.day !== formData.exam_date) return false;
              const [slotStart, slotEnd] = entry.time_slot.split('-');
              return slotStart <= formData.exam_start_time && slotEnd >= formData.exam_end_time;
            })
            .map((entry: any) => ({
              user_id: entry.user_id,
              full_name: `${entry.tbl_users.first_name} ${entry.tbl_users.last_name}`,
            }));
    
    
          setAvailableProctors(availableProctors);
    
          const { data: sectionCourseData } = await supabase
            .from('tbl_sectioncourse')
            .select(`
              course_id,
              program_id, 
              year_level,
              user_id,
              term:term_id (
                term_name
              )
            `);
    
          if (sectionCourseData) {
            const cleanedSectionCourses: SectionCourse[] = sectionCourseData.map((sc: any) => ({
              course_id: sc.course_id,
              program_id: sc.program_id,
              year_level: sc.year_level,
              term: sc.term && !Array.isArray(sc.term)
                ? sc.term
                : { term_name: 'Unknown' },
              user_id: sc.user_id,
            }));
    
            setSectionCourses(cleanedSectionCourses);
          }
    
          const { data: userMeta } = await supabase
            .from('tbl_users')
            .select('user_id, email_address')
            .eq('email_address', user.user.email)
            .single();
    
          if (!userMeta) return;
          setUserId(userMeta.user_id);
          
          const { data: userRoles } = await supabase
            .from('tbl_user_role')
            .select('college_id')
            .eq('user_id', userMeta.user_id)
            .not('college_id', 'is', null);
    
          const userCollegeId = userRoles?.[0]?.college_id;
          if (!userCollegeId) return;
    
          const { data: departments } = await supabase
            .from('tbl_department')
            .select('department_id')
            .eq('college_id', userCollegeId);
    
          const departmentIds = departments?.map((d) => d.department_id) ?? [];
    
          const [courseRes, progRes, roomRes, modRes, examRes] = await Promise.all([
            supabase.from('tbl_course').select('course_id, course_name'),
            supabase
              .from('tbl_program')
              .select('program_id, program_name, department_id')
              .in('department_id', departmentIds),
            supabase
              .from('tbl_rooms')
              .select(`
                room_id,
                room_name,
                building: building_id (
                  building_id,
                  building_name
                )
              `),
            supabase
            .from('tbl_modality')
            .select(`
              modality_id,
              modality_type,
              room_type,
              modality_remarks,
              course_id,
              program_id,
              room_id,
              possible_rooms,
              section_name,
              user_id
            `),
            supabase
              .from('tbl_examperiod')
              .select(`
                examperiod_id,
                start_date,
                end_date,
                academic_year,
                exam_category,
                college_id,
                term:term_id (
                  term_name
                ),
                college:college_id (
                  college_name
                )
              `)
              .eq('college_id', userCollegeId),
          ]);
    
          if (courseRes.data) setCourses(courseRes.data);
          if (progRes.data) setPrograms(progRes.data);
          if (roomRes.data) {
            const cleanedRooms: Room[] = roomRes.data.map((room: any) => ({
              room_id: room.room_id,
              room_name: room.room_name,
              building: Array.isArray(room.building) ? room.building[0] : room.building,
            }));
            setRooms(cleanedRooms);
          }
          if (modRes.data) setModalities(modRes.data);
    
          if (examRes.data) {
            const fixed: ExamPeriod[] = examRes.data.map((ep: any) => ({
              examperiod_id: ep.examperiod_id,
              start_date: ep.start_date,
              end_date: ep.end_date,
              academic_year: ep.academic_year,
              exam_category: ep.exam_category,
              term: ep.term || { term_name: 'Unknown' },
              college_id: ep.college_id,
              college: ep.college || { college_name: 'N/A' },
            }));

            setExamPeriods(fixed);

            // Fixed mergedPeriods creation
            const mergedMap = new Map<string, { 
              label: string; 
              value: string; 
              start_date: string; 
              end_date: string; 
            }>();

            fixed.forEach((ep) => {
              const key = `${ep.academic_year}-${ep.term.term_name}`;
              const existing = mergedMap.get(key);
              
              if (!existing) {
                mergedMap.set(key, {
                  label: `${ep.academic_year} ${ep.term.term_name}`,
                  value: `${ep.academic_year}||${ep.term.term_name}`,
                  start_date: ep.start_date,
                  end_date: ep.end_date,
                });
              } else {
                // If we already have this academic year + term combination,
                // extend the date range to cover all periods
                mergedMap.set(key, {
                  ...existing,
                  start_date: ep.start_date < existing.start_date ? ep.start_date : existing.start_date,
                  end_date: ep.end_date > existing.end_date ? ep.end_date : existing.end_date,
                });
              }
            });

            const merged = Array.from(mergedMap.values());
            setMergedPeriods(merged);

            const categories = Array.from(new Set(fixed.map((ep) => ep.exam_category)));
            setExamCategories(categories);
          }
        };
    
        fetchInitialData();
      }, []);

    useEffect(() => {
        if (!formData.academic_term || !formData.exam_category) {
          setDaysPeriods([]);
          return;
        }
    
        const [year, term] = formData.academic_term.split('||');
    
        const matchingPeriods = examPeriods.filter(
          (ep) =>
            ep.academic_year === year &&
            ep.term.term_name === term &&
            ep.exam_category === formData.exam_category
        );
    
        const allDates: { label: string; value: string; examperiod_id: number }[] = [];
    
        matchingPeriods.forEach((ep) => {
          const start = new Date(ep.start_date);
          const end = new Date(ep.end_date);
          for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const formatted = formatFullDate(d.toISOString());
            allDates.push({
              label: formatted,
              value: d.toISOString().split('T')[0], 
              examperiod_id: ep.examperiod_id,
            });
          }
        });
    
        setDaysPeriods(allDates);
      }, [formData.academic_term, formData.exam_category, examPeriods]);
    
    useEffect(() => {
    if (!formData.academic_term || !formData.exam_category) return;

    const [year, term] = formData.academic_term.split('||');

    const match = examPeriods.find(
        (ep) =>
        ep.academic_year === year &&
        ep.term.term_name === term &&
        ep.exam_category === formData.exam_category
    );

    if (match) {
        setFormData((prev) => ({
        ...prev,
        examperiod_id: match.examperiod_id.toString(),
        exam_date: match.start_date,
        }));
    }
    }, [formData.academic_term, formData.exam_category, examPeriods]);

    useEffect(() => {
        setFormData((prev) => ({
          ...prev,
          academic_term: prev.academic_term || mergedPeriods?.[0]?.value || '',
          exam_category: prev.exam_category || examCategories?.[0] || '',
        }));
      }, [mergedPeriods, examCategories]);

    

// Functions / Helpers

    const shuffleArray = <T,>(arr: T[]): T[] => {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    };

    const inferYearLevelFromExamDetail = (ed: ExamDetail): string => {
        const byModId = modalities.find(
        (m) => String(m.modality_id) === String(ed.modality_id)
        );
        if (byModId) return getYearLevelForModality(byModId);

        const byCourseSection = modalities.find(
        (m) =>
            m.course_id === ed.course_id &&
            m.program_id === ed.program_id &&
            m.section_name === ed.section_name
        );
        if (byCourseSection) return getYearLevelForModality(byCourseSection);

        const sc = sectionCourses.find(
        (s) => s.course_id === ed.course_id && s.program_id === ed.program_id
        );
        return sc?.year_level ?? "Unknown";
    };

    const getYearLevelForModality = (m: Modality): string => {
        if (m.section?.year_level) return m.section.year_level as string;

        const hit = sectionCourses.find(
        sc =>
            sc.course_id === m.course_id &&
            sc.program_id === m.program_id &&
            String(sc.user_id) === String(m.user_id)
        );
        return hit?.year_level ?? "Unknown";
    };

    function mapTimeSlotToRange(slot: string) {
        switch (slot.trim()) {
        case "7 AM - 12 NN":
            return { start: "07:00", end: "12:00" };
        case "1 PM - 5 PM":
            return { start: "13:00", end: "17:00" };
        case "5 PM - 9 PM":
            return { start: "17:00", end: "21:00" };
        default:
            return null;
        }
    }

    function sequenceAlternating(modalities: any[]): any[] {
        const result: any[] = [];
        const pool = [...modalities];

        while (pool.length > 0) {
        if (result.length === 0) {
            result.push(pool.shift()!);
            continue;
        }

        const last = result[result.length - 1];
        const lastYear = getYearLevelForModality(last);
        const lastProgram = getProgramKey(last);

        let idx = pool.findIndex(m => {
            const year = getYearLevelForModality(m);
            const prog = getProgramKey(m);
            return !(year === lastYear && prog === lastProgram);
        });

        if (idx === -1) {
            idx = 0;
        }

        result.push(pool.splice(idx, 1)[0]);
        }

        return result;
    }

    function getProgramKey(modality: any): string {
        return modality.program_id?.toString() || "unknown";
    }

    function getSectionInstructorId(
        modality: Modality,
        sectionCourses: SectionCourse[]
    ): number | null {
        const normalizedModalitySection = modality.section_name.trim().toLowerCase();

        const match = sectionCourses.find((s: SectionCourse) => {
        const normalizedCourseSection = s.section_name?.trim().toLowerCase();
        return (
            s.course_id === modality.course_id &&
            s.program_id === modality.program_id &&
            normalizedCourseSection === normalizedModalitySection
        );
        });

        if (!match) {
        console.warn(`⚠️ No match found for section ${modality.section_name}`);
        }

        return match?.user_id ?? null;
    }

    const schedulesToDisplay = examDetails.filter(
        (ed) => ed.exam_date === selectedDay
    );

    const isRoomAvailable = async (
        roomId: number,
        date: string,
        startTime: string,
        endTime: string
      ): Promise<boolean> => {
        const { data, error } = await supabase
          .from('tbl_examdetails')
          .select('*')
          .eq('room_id', roomId)
          .eq('exam_date', date)
          .or(`and(start_time,lt.${endTime},end_time,gt.${startTime})`);
    
        if (error) {
          console.error('Error checking room availability:', error);
          return false;
        }
    
        return data.length === 0;
      };

      const getInstructorName = (courseId: string, programId: string): string => {
        const section = sectionCourses.find(
        (s) => s.course_id === courseId && s.program_id === programId
        );
        const instructor = instructors.find(
        (i) => String(i.user_id) === String(section?.user_id)
        );
        return instructor ? `${instructor.first_name} ${instructor.last_name}` : '—';
    };

// Event handlers / actions
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
    
        if (name === 'examperiod_id') {
          const selected = examPeriods.find(ep => ep.examperiod_id === parseInt(value));
          setFormData((prev) => ({
            ...prev,
            examperiod_id: value,
            exam_date: selected?.start_date ?? ''
          }));
       } else {
          setFormData((prev) => ({
            ...prev,
            [name]: e.target.type === 'number' ? parseInt(value) : value,
          }));
    
          if (name === 'course_id') {
            setSelectedModality(null);
            setFormData((prev) => ({ ...prev, modality_id: '' }));
          }
        }
        if (name === 'modality_id') {
          const selected = modalities.find(m => m.modality_id === parseInt(value));
          setSelectedModality(selected || null);
        }
      };
    
    const handleGenerateSave = async () => {
        if (!userId) return;

        if (
            !formData.course_id ||
            !formData.program_id ||
            !formData.examperiod_id ||
            !formData.exam_date
        ) {
            alert("Please complete all required fields before saving.");
            return;
        }

        const courseModalities = modalities.filter(
            (m) => m.course_id === formData.course_id
        );

        if (courseModalities.length === 0) {
            alert("No modalities found for this course.");
            return;
        }

        const selectedExamPeriod = examPeriods.find(
            (ep) => ep.examperiod_id === parseInt(formData.examperiod_id)
        );
        if (!selectedExamPeriod) {
            alert("❌ Exam period not found.");
            return;
        }

        const durationMinutes = formData.hours * 60 + formData.minutes;
        const pad = (n: number) => String(n).padStart(2, "0");
        const intervalString = `${pad(formData.hours)}:${pad(formData.minutes)}:00`;
        const examPeriodRange = `${selectedExamPeriod.start_date} – ${selectedExamPeriod.end_date}`;

        const { data: existing } = await supabase
            .from("tbl_examdetails")
            .select("*")

        const scheduleGrid: Record<string, { start: Date; end: Date }[]> = {};
        (existing || []).forEach((ed) => {
            const roomKey = String(ed.room_id);
            if (!scheduleGrid[roomKey]) scheduleGrid[roomKey] = [];
            scheduleGrid[roomKey].push({
            start: new Date(ed.exam_start_time),
            end: new Date(ed.exam_end_time),
            });
        });

        const isSlotFree = (roomId: string | number, start: Date, end: Date) => {
            const key = String(roomId);
            const roomSchedule = scheduleGrid[key] || [];
            return !roomSchedule.some((slot) => slot.start < end && slot.end > start);
        };

        const startOfDay = new Date(`${formData.exam_date}T07:30:00`);
        const endOfDay = new Date(`${formData.exam_date}T21:00:00`);
        const allSlots: { start: Date; end: Date }[] = [];
        for (
            let slotStart = new Date(startOfDay);
            slotStart < endOfDay;
            slotStart = new Date(slotStart.getTime() + durationMinutes * 60000)
        ) {
            allSlots.push({
            start: new Date(slotStart),
            end: new Date(slotStart.getTime() + durationMinutes * 60000),
            });
        }
        const randomizedSlots = shuffleArray(allSlots);

        let proctorIndex = 0;
        const inserts: any[] = [];

        const candidateModalities = modalities.filter(
            (m) => m.course_id === formData.course_id
        );

        const orderedModalities = sequenceAlternating(candidateModalities);

        const localCanonical = new Map<string, { start: Date; end: Date }>();
        (existing || []).forEach((ed: any) => {
            const year = inferYearLevelFromExamDetail(ed);
            const key = `${ed.course_id}||${year}`;
            if (!localCanonical.has(key)) {
            localCanonical.set(key, {
                start: new Date(ed.exam_start_time),
                end: new Date(ed.exam_end_time),
            });
            }
        });

        const groupedByCohort = new Map<string, Modality[]>();
        for (const m of orderedModalities) {
            const key = `${m.course_id}||${getYearLevelForModality(m)}`;
            if (!groupedByCohort.has(key)) groupedByCohort.set(key, []);
            groupedByCohort.get(key)!.push(m);
        }

        let insertedCount = 0;

        for (const [key, cohortModalities] of groupedByCohort) {
            const allScheduled = cohortModalities.every((modality) =>
            (existing || []).some(
                (ed) =>
                ed.course_id === modality.course_id &&
                ed.section_name === modality.section_name &&
                ed.modality_id === modality.modality_id &&
                ed.exam_date === formData.exam_date
            )
            );

            if (allScheduled) {
            continue;
            }

            let chosenSlot: { start: Date; end: Date } | null = null;
            let assignmentForSlot: Record<string, string | number> | null = null;

            if (localCanonical.has(key)) {
            const cs = localCanonical.get(key)!;

            const possibleRoomsPerMod: Map<string, (string | number)[]> = new Map();
            const allCandidateRooms = new Set<string | number>();
            let ok = true;

            for (const mod of cohortModalities) {
                const roomsList = (mod.possible_rooms || []).filter((r: any) =>
                isSlotFree(r, cs.start, cs.end)
                );
                if (!roomsList.length) {
                ok = false;
                break;
                }
                possibleRoomsPerMod.set(mod.section_name, roomsList);
                roomsList.forEach((r) => allCandidateRooms.add(r));
            }

            if (ok && allCandidateRooms.size >= cohortModalities.length) {
                const usedRooms = new Set<string | number>();
                const tempAssign: Record<string, string | number> = {};
                const byLeastOptions = [...cohortModalities].sort(
                (a, b) =>
                    (possibleRoomsPerMod.get(a.section_name)!.length || 0) -
                    (possibleRoomsPerMod.get(b.section_name)!.length || 0)
                );
                let failed = false;
                for (const mod of byLeastOptions) {
                const options = possibleRoomsPerMod.get(mod.section_name)!;
                const pick = options.find((r) => !usedRooms.has(String(r)));
                if (!pick) {
                    failed = true;
                    break;
                }
                usedRooms.add(String(pick));
                tempAssign[mod.section_name] = pick;
                }
                if (!failed) {
                chosenSlot = { start: cs.start, end: cs.end };
                assignmentForSlot = tempAssign;
                }
            }
            }

            if (!chosenSlot) {
            slotLoop: for (const slot of randomizedSlots) {
                const possibleRoomsPerMod: Map<string, (string | number)[]> = new Map();
                const allCandidateRooms = new Set<string | number>();

                for (const mod of cohortModalities) {
                const roomsList = (mod.possible_rooms || []).filter((r: any) =>
                    isSlotFree(r, slot.start, slot.end)
                );
                if (!roomsList.length) {
                    continue slotLoop;
                }
                possibleRoomsPerMod.set(mod.section_name, roomsList);
                roomsList.forEach((r) => allCandidateRooms.add(r));
                }

                if (allCandidateRooms.size < cohortModalities.length) continue slotLoop;

                const usedRooms = new Set<string | number>();
                const tempAssign: Record<string, string | number> = {};
                const byLeastOptions = [...cohortModalities].sort(
                (a, b) =>
                    (possibleRoomsPerMod.get(a.section_name)!.length || 0) -
                    (possibleRoomsPerMod.get(b.section_name)!.length || 0)
                );
                let failed = false;
                for (const mod of byLeastOptions) {
                const options = possibleRoomsPerMod.get(mod.section_name)!;
                const pick = options.find((r) => !usedRooms.has(String(r)));
                if (!pick) {
                    failed = true;
                    break;
                }
                usedRooms.add(String(pick));
                tempAssign[mod.section_name] = pick;
                }
                if (!failed) {
                chosenSlot = slot;
                assignmentForSlot = tempAssign;
                localCanonical.set(key, { start: slot.start, end: slot.end });
                break slotLoop;
                }
            }
            }

            if (!chosenSlot || !assignmentForSlot) {
            toast.error(`⚠ Unable to find a time with distinct rooms for cohort ${key}. Skipping cohort.`);
            continue;
            }

            for (const modality of cohortModalities) {
            const alreadyScheduled =
                (existing || []).some(
                (ed) =>
                    ed.course_id === modality.course_id &&
                    ed.section_name === modality.section_name &&
                    ed.modality_id === modality.modality_id &&
                    ed.exam_date === formData.exam_date
                ) ||
                inserts.some(
                (ed) =>
                    ed.course_id === modality.course_id &&
                    ed.section_name === modality.section_name &&
                    ed.modality_id === modality.modality_id &&
                    ed.exam_date === formData.exam_date
                );

            if (alreadyScheduled) {
                console.log(`Skipping ${modality.section_name}, schedule already exists at this exact slot.`);
                continue;
            }

            const roomId = assignmentForSlot[modality.section_name];
            if (!roomId) {
                toast.error(`Unexpected: no room assigned for ${modality.section_name}`);
                continue;
            }

            let assignedProctorId: number | null = null;

            const candidateInstructors = instructors.filter((instr) =>
                sectionCourses.some(
                (s) =>
                    s.course_id === modality.course_id &&
                    s.program_id === modality.program_id &&
                    s.user_id === instr.user_id
                )
            );

            const sectionInstructorId = getSectionInstructorId(modality, sectionCourses);

            const alternativeInstructors = candidateInstructors.filter(
                (instr) => Number(instr.user_id) !== Number(sectionInstructorId)
            );

            console.log(`Modality: ${modality.section_name}`);
            console.log("Resolved Section Instructor:", sectionInstructorId);
            console.log("Candidate Instructors:", candidateInstructors.map(i => i.user_id));
            console.log("Alternative Instructors:", alternativeInstructors.map(i => i.user_id));

            if (alternativeInstructors.length > 0) {
                assignedProctorId =
                alternativeInstructors[proctorIndex % alternativeInstructors.length].user_id;
                proctorIndex++;
            } else if (candidateInstructors.length === 1 && sectionInstructorId) {
                assignedProctorId = sectionInstructorId;
            } else {
                assignedProctorId = null;
            }

            if (assignedProctorId === sectionInstructorId && alternativeInstructors.length > 0) {
                console.error("❌ Incorrect fallback — section instructor assigned despite alternatives");
            }

            inserts.push({
                course_id: modality.course_id,
                program_id: modality.program_id,
                room_id: roomId,
                modality_id: modality.modality_id,
                user_id: assignedProctorId,
                examperiod_id: parseInt(formData.examperiod_id),
                exam_duration: intervalString,
                exam_start_time: chosenSlot.start.toISOString(),
                exam_end_time: chosenSlot.end.toISOString(),
                proctor_timein: null,
                proctor_timeout: null,
                section_name: modality.section_name,
                academic_year: selectedExamPeriod.academic_year,
                semester: selectedExamPeriod.term?.term_name || "N/A",
                exam_category: selectedExamPeriod.exam_category,
                exam_period: examPeriodRange,
                exam_date: formData.exam_date,
            });

            insertedCount++;
            const rk = String(roomId);
            if (!scheduleGrid[rk]) scheduleGrid[rk] = [];
            scheduleGrid[rk].push({ start: chosenSlot.start, end: chosenSlot.end });
            }
        }

        const canonicalToSet: Record<string, { start: string; end: string }> = { ...canonicalSlots };
        localCanonical.forEach((v, k) => {
            canonicalToSet[k] = { start: v.start.toISOString(), end: v.end.toISOString() };
        });
        setCanonicalSlots(canonicalToSet);

        if (insertedCount > 0) {
            const { data: insertedData, error } = await supabase
            .from("tbl_examdetails")
            .insert(inserts)
            .select("*");

            if (error) {
            toast.error(`Failed to save schedule. ${error.message}`);
            } else {
            toast.success("Schedule saved successfully!");

            setExamDetails((prev) => {
                const merged = [...prev, ...(insertedData || [])];

                const seen = new Set();
                return merged.filter((ed) => {
                const key = `${ed.course_id}||${ed.section_name}||${ed.modality_id}||${ed.exam_date}`;
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
                });
            });
            }
        } else {
            toast.info("No new schedules were created — all selected sections already have schedules for this date.");
        }
        }; 
    
    const handleSubmitToDean = async () => {
        if (!pdfFile) {
          toast.error("Please upload a PDF");
          return;
        }
        if (!userId) {
          toast.error("User not logged in");
          return;
        }
        if (!deanUserId || !deanCollegeId) {
          toast.error("Dean not selected");
          return;
        }
    
        try {
          const fileName = `${Date.now()}_${pdfFile.name}`;
          const { data: uploadData, error: uploadErr } = await supabase.storage
            .from("schedule-pdfs")
            .upload(fileName, pdfFile);
    
          if (uploadErr || !uploadData) {
            console.error(uploadErr);
            toast.error("Upload failed");
            return;
          }
    
          const { error: insertErr } = await supabase
            .from("tbl_scheduleapproval")
            .insert({
              request_id: crypto.randomUUID(),
              dean_user_id: deanUserId,
              dean_college: deanCollegeId,          
              submitted_by: Number(userId),         
              submitted_at: new Date().toISOString(),
              status: "pending",
              remarks: deanRemarks,
              created_at: new Date().toISOString(),
              file_url: uploadData.path,          
            });
    
          if (insertErr) {
            console.error("Supabase insert error:", insertErr);
            toast.error(`Failed to save schedule: ${insertErr.message}`);
            return;
          }
    
          toast.success("Sent to Dean!");
          setShowDeanModal(false);
          setPdfFile(null);
          setDeanRemarks("");
        } catch (err) {
          console.error(err);
          toast.error("Unexpected error");
        }
      };
    
    const handleSendToDeanClick = async () => {
        if (!userId) return;
    
        const { data: schedulerRole } = await supabase
        .from("tbl_user_role")
        .select("college_id")
        .eq("user_id", userId)
        .eq("role_id", 3)
        .single();
    
        if (!schedulerRole) {
        toast.error("No scheduler role found");
        return;
        }
    
        const collegeId = schedulerRole.college_id;
    
        const { data: deanRoleData } = await supabase
        .from('tbl_user_role')
        .select('user_id, college_id') 
        .eq('college_id', collegeId)
        .eq('role_id', 1) 
        .single();
    
        if (!deanRoleData) {
        toast.error("No dean found for this college");
        return;
        }
    
        const deanId = deanRoleData.user_id;
        setDeanUserId(deanId);
        setDeanCollegeId(deanRoleData.college_id); 
    
        const { data: deanUser } = await supabase
        .from('tbl_users')
        .select('first_name,last_name')
        .eq('user_id', deanId)
        .single();
    
        if (deanUser) {
        setDeanName(`${deanUser.first_name} ${deanUser.last_name}`);
        setDeanRole("Dean");
        setShowDeanModal(true);
        }
    };

    const handleExportPDF = () => {
        const orientation = globalThis.confirm("Click OK for Landscape, Cancel for Portrait")
          ? "landscape"
          : "portrait";
    
        const element = document.createElement("div");
    
        for (let i = 0; i < totalPages; i++) {
          const pageDiv = document.createElement("div");
          pageDiv.classList.add("pdf-page");
          if (orientation === "landscape") {
            pageDiv.classList.add("landscape");
          }
    
          (pageDiv.style as any).breakInside = "avoid";
    
          const tableWrapper = document.getElementById(`schedule-page-${i}`);
          if (tableWrapper) {
            const clone = tableWrapper.cloneNode(true) as HTMLElement;
            (clone.style as any).breakInside = "avoid";
            pageDiv.appendChild(clone);
          }
    
          element.appendChild(pageDiv);
    
          if (i < totalPages - 1) {
            const pageBreak = document.createElement("div");
            pageBreak.classList.add("page-break");
            element.appendChild(pageBreak);
          }
        }
    
        html2pdf()
          .set({
            margin: 10,
            filename: "Exam_Schedule.pdf",
            image: { type: "jpeg", quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: "mm", format: "a4", orientation },
          })
          .from(element)
          .save();
      };
    
      const exportAsWord = () => {
        const element = document.querySelector('.export-section');
        if (!element) return;
    
        const html = element.outerHTML;
        const blob = new Blob(['\ufeff' + html], {
          type: 'application/msword',
        });
    
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'ExamSchedule.doc';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      };
    
      const exportAsExcel = () => {
        const table = document.querySelector('.export-section table');
        if (!table) return;
    
        const workbook = XLSX.utils.table_to_book(table as HTMLTableElement);
        XLSX.writeFile(workbook, 'ExamSchedule.xlsx');
      };

  return (
    <div className="colleges-container">
        <ToastContainer />

        <PlotHeader
        showPlot={showPlot}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        onAddNew={() => setShowPlot(true)}
        />

        {!showPlot && (
        <PlotHeaderTable
            filteredExamDetails={filteredExamDetails}
            selectedExam={selectedExam}
            setSelectedExam={setSelectedExam}
        />
        )}

        {showPlot && (
          <div className="schedule-wrapper">
            <div className="plot-control">
              <PlotScheduleForm
                formData={formData}
                setFormData={setFormData}
                mergedPeriods={mergedPeriods}
                examCategories={examCategories}
                selectedDay={selectedDay}
                setSelectedDay={setSelectedDay}
                daysPeriods={daysPeriods}
                programs={programs}
                sectionCourses={sectionCourses}
                filteredCourses={filteredCourses}
                modalities={modalities}
                showRemarksMap={showRemarksMap}
                setShowRemarksMap={setShowRemarksMap}
                handleChange={handleChange}
                handleGenerateSave={handleGenerateSave}
                showDeanModal={showDeanModal}
                setShowDeanModal={setShowDeanModal}
                deanName={deanName}
                pdfFile={pdfFile}
                setPdfFile={setPdfFile}
                deanRemarks={deanRemarks}
                setDeanRemarks={setDeanRemarks}
                handleSubmitToDean={handleSubmitToDean}
                isReassigning={isReassigning}
                setIsReassigning={setIsReassigning}
                selectedProctors={selectedProctors}
                examDetails={examDetails}
                setExamDetails={setExamDetails}
                supabase={supabase}
                toast={toast}
                handleSendToDeanClick={handleSendToDeanClick}
                handleExportPDF={handleExportPDF}
                exportAsWord={exportAsWord}
                exportAsExcel={exportAsExcel}
                setShowPlot={setShowPlot}
              />
            </div>

            <div className="plot-bondpapers">
              <PlotScheduleDisplay
                page={page}
                totalPages={totalPages}
                setPage={setPage}
                formData={formData}
                supabase={supabase}
                toast={toast}
                examPeriods={examPeriods}
                roomPages={roomPages as Room[][]}
                examDetails={examDetails as ExamDetail[]}
                setExamDetails={setExamDetails as React.Dispatch<React.SetStateAction<ExamDetail[]>>}
                isReassigning={isReassigning}
                sectionCourses={sectionCourses}
                instructors={instructors}
                selectedProctors={selectedProctors}
                setSelectedProctors={setSelectedProctors}
                getInstructorName={getInstructorName}
                getYearLevelForModality={getYearLevelForModality}
              />
            </div>
          </div>
        )}
        
    </div>
  );
};

export default Scheduler_PlotSchedule;