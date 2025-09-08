import React, { useState, useEffect } from 'react';
import { FaEye, FaSearch, FaChevronLeft, FaChevronRight, FaArrowLeft, FaPlayCircle, FaFileExport, FaPaperPlane, FaUserEdit, FaSave, FaTimes } from 'react-icons/fa';
import { supabase } from '../lib/supabaseClient.ts';
import '../styles/plotschedule.css';
import 'react-toastify/dist/ReactToastify.css';
import { ToastContainer, toast } from 'react-toastify';
import html2pdf from 'html2pdf.js';
import * as XLSX from 'xlsx';

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
  const [courses, setCourses] = useState<Course[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [modalities, setModalities] = useState<Modality[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [examPeriods, setExamPeriods] = useState<ExamPeriod[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [sectionCourses, setSectionCourses] = useState<SectionCourse[]>([]);
  const [selectedModality, setSelectedModality] = useState<Modality | null>(null);
  const [availableProctors, setAvailableProctors] = useState<Proctor[]>([]);
  const [examDetails, setExamDetails] = useState<ExamDetail[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedExam, setSelectedExam] = useState<ExamDetail | null>(null);
  const [_isExporting, _setIsExporting] = useState(false);
  const [mergedPeriods, setMergedPeriods] = useState<{ label: string; value: string }[]>([]);
  const [examCategories, setExamCategories] = useState<string[]>([]);
  const [instructors, setInstructors] = useState<{ user_id: number; first_name: string; last_name: string }[]>([]);
  const [isReassigning, setIsReassigning] = useState(false);
  const [selectedProctors, setSelectedProctors] = useState<Record<string, string>>({});
  const [examDate, _setExamDate] = useState<string>('');
  const [examStartTime, _setExamStartTime] = useState<string>('');
  const [examEndTime, _setExamEndTime] = useState<string>('');
  const [selectedRoomId, _setSelectedRoom] = useState<number | null>(null);
  const [canonicalSlots, setCanonicalSlots] = useState<Record<string, { start: string; end: string }>>({});

  // Helper: infer year level for an exam record (tries modalities first, then sectionCourses)
  const inferYearLevelFromExamDetail = (ed: any): string => {
    // try to find a modality that matches this exam detail (modality_id or course+section_name)
    const byModId = modalities.find((m) => String(m.modality_id) === String(ed.modality_id));
    if (byModId) return getYearLevelForModality(byModId);

    const byCourseSection = modalities.find(
      (m) =>
        m.course_id === ed.course_id &&
        m.program_id === ed.program_id &&
        m.section_name === ed.section_name
    );
    if (byCourseSection) return getYearLevelForModality(byCourseSection);

    // fallback to sectionCourses (best-effort)
    const sc = sectionCourses.find(
      (s) => s.course_id === ed.course_id && s.program_id === ed.program_id
    );
    return sc?.year_level ?? "Unknown";
  };

  useEffect(() => {
    const map: Record<string, { start: string; end: string }> = {};

    (examDetails || []).forEach((ed) => {
      const year = inferYearLevelFromExamDetail(ed);
      const key = `${ed.course_id}||${year}`;
      if (!map[key]) {
        // take first encountered exam start/end for that cohort as canonical
        map[key] = {
          start: ed.exam_start_time,
          end: ed.exam_end_time,
        };
      }
    });

    setCanonicalSlots(map);
  }, [examDetails, modalities, sectionCourses]);
  
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

  useEffect(() => {
    if (!selectedRoomId || !examDate || !examStartTime || !examEndTime) return;

    const checkRoom = async () => {
      const available = await isRoomAvailable(selectedRoomId, examDate, examStartTime, examEndTime);
      if (!available) {
        alert('⚠ This room is already booked for that time. Please adjust date/time.');
      }
    };

    checkRoom();
  }, [selectedRoomId, examDate, examStartTime, examEndTime]);

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

  const filteredExamDetails = examDetails.filter((ed) =>
    ed.examdetails_id?.toString().toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleExportPDF = () => {
    const element = document.createElement("div");

    // Loop through all pages
    for (let i = 0; i < totalPages; i++) {
      const pageDiv = document.createElement("div");
      pageDiv.classList.add("pdf-page");

      // Clone the same content but with page = i
      const tableWrapper = document.getElementById(`schedule-page-${i}`);
      if (tableWrapper) {
        pageDiv.appendChild(tableWrapper.cloneNode(true));
      }

      if (i < totalPages - 1) {
        const pageBreak = document.createElement("div");
        pageBreak.classList.add("page-break");
        pageDiv.appendChild(pageBreak);
      }

      element.appendChild(pageDiv);
    }

    // Export using html2pdf
    html2pdf()
      .set({
        margin: 10,
        filename: "Exam_Schedule.pdf",
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: "mm", format: "a4", orientation: "landscape" },
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
  });

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

      const availableProctors: Proctor[] = (availabilityData || []).map((entry: any) => ({
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

        const merged = Array.from(
          new Map(
            fixed.map((ep) => [
              `${ep.academic_year}-${ep.term.term_name}`,
              {
                label: `${ep.academic_year} ${ep.term.term_name}`,
                value: `${ep.academic_year}||${ep.term.term_name}`,
              },
            ])
          ).values()
        );
        setMergedPeriods(merged);

        const categories = Array.from(new Set(fixed.map((ep) => ep.exam_category)));
        setExamCategories(categories);
      }
    };

    fetchInitialData();
  }, []);

  const [daysPeriods, setDaysPeriods] = useState<
    { label: string; value: string; examperiod_id: number }[]
  >([]);

  const formatFullDate = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

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

  // Utility: Fisher-Yates shuffle
  const shuffleArray = <T,>(arr: T[]): T[] => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  // Try to resolve year_level for a modality using your sectionCourses list
  const getYearLevelForModality = (m: Modality): string => {
    if (m.section?.year_level) return m.section.year_level as string;

    // Fallback: infer from tbl_sectioncourse via (course_id, program_id, user_id)
    const hit = sectionCourses.find(
      sc =>
        sc.course_id === m.course_id &&
        sc.program_id === m.program_id &&
        String(sc.user_id) === String(m.user_id)
    );
    return hit?.year_level ?? "Unknown";
  };

  // Unique key for alternation rule: Program–Year–Course
  const cohortKey = (m: Modality) =>
    `${m.program_id}||${getYearLevelForModality(m)}||${m.course_id}`;

  /**
   * Round-robin sequence so that consecutive items never share the same cohortKey.
   * If it becomes impossible (e.g., only one cohort exists), it still emits the rest,
   * but avoids repeats whenever there is a choice.
   */
  const sequenceAlternating = (mods: Modality[]): Modality[] => {
    // Group by key
    const buckets = new Map<string, Modality[]>();
    for (const m of mods) {
      const k = cohortKey(m);
      if (!buckets.has(k)) buckets.set(k, []);
      buckets.get(k)!.push(m);
    }

    const keys = Array.from(buckets.keys());
    // Sort keys by bucket size descending (helps spread heavy cohorts)
    keys.sort((a, b) => (buckets.get(b)!.length - buckets.get(a)!.length));

    const total = mods.length;
    const out: Modality[] = [];
    let lastKey = "";

    while (out.length < total) {
      // Find first non-empty bucket whose key != lastKey
      let pickedKey = "";
      for (const k of keys) {
        if (buckets.get(k)!.length && k !== lastKey) {
          pickedKey = k;
          break;
        }
      }
      // If all remaining are the same as lastKey, we must take from it
      if (!pickedKey) {
        for (const k of keys) {
          if (buckets.get(k)!.length) {
            pickedKey = k;
            break;
          }
        }
        if (!pickedKey) break; // nothing left
      }

      const item = buckets.get(pickedKey)!.shift()!;
      out.push(item);
      lastKey = pickedKey;
    }

    return out;
  };

  const handleGenerateSave = async () => {
    if (!userId) return;

    if (
      !formData.course_id ||
      !formData.program_id ||
      !formData.modality_id ||
      !formData.examperiod_id ||
      !formData.exam_date
    ) {
      alert("Please complete all required fields before saving.");
      return;
    }

    const selectedMod = modalities.find(
      (m) => m.modality_id === parseInt(formData.modality_id)
    );
    if (!selectedMod) {
      alert("Selected modality is invalid.");
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

    // fetch existing schedules for this date
    const { data: existing } = await supabase
      .from("tbl_examdetails")
      .select("*")

    // Build scheduleGrid from existing (room -> occupied intervals)
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

    // All possible slots for the day
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

    // proctor & inserts
    let proctorIndex = 0;
    const totalAvailable = availableProctors.length;
    const inserts: any[] = [];

    // Candidate modalities for the selected course + modality_type
    const candidateModalities = modalities.filter(
      (m) =>
        m.modality_type === selectedMod.modality_type &&
        m.course_id === selectedMod.course_id
    );
    const orderedModalities = sequenceAlternating(candidateModalities);

    // Build local canonical map from EXISTING examDetails (key -> Date)
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

    // Group by course + year_level (cohorts)
    const groupedByCohort = new Map<string, Modality[]>();
    for (const m of orderedModalities) {
      const key = `${m.course_id}||${getYearLevelForModality(m)}`;
      if (!groupedByCohort.has(key)) groupedByCohort.set(key, []);
      groupedByCohort.get(key)!.push(m);
    }

    // For each cohort try to schedule (prefer canonical slot)
    const targetSectionNames = orderedModalities.map(m => m.section_name);

    // Track which ones we actually insert
    let insertedCount = 0;

    for (const [key, cohortModalities] of groupedByCohort) {
      const allScheduled = cohortModalities.every((modality) =>
        (existing || []).some(
          (ed) =>
            ed.course_id === modality.course_id &&
            ed.section_name === modality.section_name &&
            ed.modality_id === modality.modality_id && // ensure it's the same modality
            ed.exam_date === formData.exam_date
        )
      );

      if (allScheduled) {
        continue; // but don't conclude ALL are scheduled yet
      }

      let chosenSlot: { start: Date; end: Date } | null = null;
      let assignmentForSlot: Record<string, string | number> | null = null;

      // 1) If we already have a canonical slot for this cohort, try to use it
      if (localCanonical.has(key)) {
        const cs = localCanonical.get(key)!;

        // For this canonical slot, build available room lists per modality
        const possibleRoomsPerMod: Map<string, (string | number)[]> = new Map();
        const allCandidateRooms = new Set<string | number>();
        let ok = true;

        for (const mod of cohortModalities) {
          const roomsList = (mod.possible_rooms || []).filter((r: any) =>
            isSlotFree(r, cs.start, cs.end)
          );
          if (!roomsList.length) {
            ok = false; // at least one section has no free possible room at canonical slot
            break;
          }
          possibleRoomsPerMod.set(mod.section_name, roomsList);
          roomsList.forEach((r) => allCandidateRooms.add(r));
        }

        if (ok && allCandidateRooms.size >= cohortModalities.length) {
          // attempt greedy distinct assignment (fewest options first)
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
        // if canonical exists but can't assign distinct rooms, we will try to find another slot below
      }

      // 2) If we don't yet have chosenSlot, search the randomizedSlots for one that supports distinct rooms
      if (!chosenSlot) {
        slotLoop: for (const slot of randomizedSlots) {
          const possibleRoomsPerMod: Map<string, (string | number)[]> = new Map();
          const allCandidateRooms = new Set<string | number>();

          for (const mod of cohortModalities) {
            const roomsList = (mod.possible_rooms || []).filter((r: any) =>
              isSlotFree(r, slot.start, slot.end)
            );
            if (!roomsList.length) {
              continue slotLoop; // this slot fails for the cohort
            }
            possibleRoomsPerMod.set(mod.section_name, roomsList);
            roomsList.forEach((r) => allCandidateRooms.add(r));
          }

          if (allCandidateRooms.size < cohortModalities.length) continue slotLoop;

          // greedy assignment (fewest options first)
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
            // set local canonical for this cohort so future modality clicks align
            localCanonical.set(key, { start: slot.start, end: slot.end });
            break slotLoop;
          }
        } // end slotLoop
      }

      if (!chosenSlot || !assignmentForSlot) {
        toast.error(`⚠ Unable to find a time with distinct rooms for cohort ${key}. Skipping cohort.`);
        continue;
      }

      // commit the inserts for this cohort using assignmentForSlot
      for (const modality of cohortModalities) {
        const alreadyScheduled =
          (existing || []).some(
            (ed) =>
              ed.course_id === modality.course_id &&
              ed.section_name === modality.section_name &&
              ed.modality_id === modality.modality_id && // add this check
              ed.exam_date === formData.exam_date
          ) ||
          inserts.some(
            (ed) =>
              ed.course_id === modality.course_id &&
              ed.section_name === modality.section_name &&
              ed.modality_id === modality.modality_id && // add this too
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
        if (formData.proctor_filter === "available_only" && totalAvailable > 0) {
          assignedProctorId = availableProctors[proctorIndex % totalAvailable].user_id;
          proctorIndex++;
        }

        inserts.push({
          course_id: modality.course_id,
          program_id: modality.program_id,
          room_id: roomId,
          modality_id: modality.modality_id,
          user_id: assignedProctorId ?? parseInt(userId),
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

    // persist canonical to component state so UI uses it immediately
    const canonicalToSet: Record<string, { start: string; end: string }> = { ...canonicalSlots };
    localCanonical.forEach((v, k) => {
      canonicalToSet[k] = { start: v.start.toISOString(), end: v.end.toISOString() };
    });
    setCanonicalSlots(canonicalToSet);

    // Persist inserts to DB
    if (insertedCount > 0) {
      const { error } = await supabase.from("tbl_examdetails").insert(inserts);
      if (error) {
        toast.error(`Failed to save schedule. ${error.message}`);
      } else {
        toast.success("Schedule saved successfully!");
        const { data: updatedExamDetails } = await supabase
          .from("tbl_examdetails")
          .select("*")
          .eq("exam_date", formData.exam_date);
        setExamDetails(updatedExamDetails || []);
      }
    } else {
      toast.info("No new schedules were created all selected sections already have schedules for this date.");
    }
  };

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

  // how many room columns per page
  const columnsPerPage = 5;

  // how many total pages (based on room count)
  const totalPages = Math.ceil(scheduledRooms.length / columnsPerPage);

  // group rooms into "pages"
  const roomPages = Array.from({ length: totalPages }, (_, i) =>
    scheduledRooms.slice(i * columnsPerPage, i * columnsPerPage + columnsPerPage)
  );

  // track current page
  const [page, setPage] = useState(0);

  return (
    <div className="colleges-container">
      {!showPlot ? (
        <>
          <div className="colleges-header">
            <h2 className="colleges-title">Manage Schedule</h2>
            <div className="search-bar">
              <input 
                type="text" 
                placeholder="Search for Schedule" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <button type="button" className="search-button">
                <FaSearch />
              </button>
            </div>
          </div>

          <div className="colleges-actions">
            <button
              type="button"
              className="action-button add-new"
              onClick={() => setShowPlot(true)}
            >
              Add New Schedule
            </button>
          </div>

          <div className="colleges-table-container">
            <table className="colleges-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Course ID</th>
                  <th>Program ID</th>
                  <th>Room ID</th>
                  <th>Time Slot</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredExamDetails.length === 0 ? (
                  <tr>
                    <td colSpan={7}>No schedule found.</td>
                  </tr>
                ) : (
                  filteredExamDetails.map((ed, index) => (
                    <tr key={ed.examdetails_id}>
                      <td>{index + 1}</td>
                      <td>{ed.course_id}</td>
                      <td>{ed.program_id}</td>
                      <td>{ed.room_id}</td>
                      <td>{new Date(ed.exam_start_time).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})} 
                          – {new Date(ed.exam_end_time).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}
                      </td>
                      <td>
                        <button type="button"
                          className="icon-button view-button"
                          onClick={() => setSelectedExam(ed)}
                        >
                          <FaEye />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {/* Modal */}
            {selectedExam && (
              <div className="modal-overlay">
                <div className="modal-content">
                  <div className="profile-header">Exam Details</div>
                  <div className="details-grid">
                    <div className="details-item"><span className="details-label">Exam ID</span><span className="details-value">{selectedExam.examdetails_id}</span></div>
                    <div className="details-item"><span className="details-label">Course ID</span><span className="details-value">{selectedExam.course_id}</span></div>
                    <div className="details-item"><span className="details-label">Program ID</span><span className="details-value">{selectedExam.program_id}</span></div>
                    <div className="details-item"><span className="details-label">Room ID</span><span className="details-value">{selectedExam.room_id}</span></div>
                    <div className="details-item"><span className="details-label">Modality ID</span><span className="details-value">{selectedExam.modality_id}</span></div>
                    <div className="details-item"><span className="details-label">User ID</span><span className="details-value">{selectedExam.user_id}</span></div>
                    <div className="details-item"><span className="details-label">Exam Period</span><span className="details-value">{selectedExam.exam_period}</span></div>
                    <div className="details-item"><span className="details-label">Exam Date</span><span className="details-value">{selectedExam.exam_date}</span></div>
                    <div className="details-item"><span className="details-label">Duration</span><span className="details-value">{selectedExam.exam_duration}</span></div>
                    <div className="details-item"><span className="details-label">Start Time</span><span className="details-value">{selectedExam.exam_start_time}</span></div>
                    <div className="details-item"><span className="details-label">End Time</span><span className="details-value">{selectedExam.exam_end_time}</span></div>
                    <div className="details-item"><span className="details-label">Time In</span><span className="details-value">{selectedExam.time_in || 'N/A'}</span></div>
                    <div className="details-item"><span className="details-label">Time Out</span><span className="details-value">{selectedExam.time_out || 'N/A'}</span></div>
                    <div className="details-item"><span className="details-label">Section</span><span className="details-value">{selectedExam.section_name}</span></div>
                    <div className="details-item"><span className="details-label">Academic Year</span><span className="details-value">{selectedExam.academic_year}</span></div>
                    <div className="details-item"><span className="details-label">Semester</span><span className="details-value">{selectedExam.semester}</span></div>
                    <div className="details-item"><span className="details-label">Exam Category</span><span className="details-value">{selectedExam.exam_category}</span></div>
                  </div>
                  <button type='button' className="close-button" onClick={() => setSelectedExam(null)}>Close</button>
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="plot-schedule" style={{ display: 'flex', gap: '20px' }}>
          <div className="plot-controls">
            <button
              type="button"
              onClick={() => setShowPlot(false)}
              className="back-button"
            >
              <FaArrowLeft style={{ marginLeft: "-18px" }} />
              Back
            </button>

            <h3>Add Schedule</h3>

            <div className="form-group">
              <label>School Year & Semester</label>
              <select
                name="academic_term"
                value={formData.academic_term}
                onChange={handleChange}
              >
                <option value="">-- Select --</option>
                {mergedPeriods.map((p, i) => (
                  <option key={i} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Exam Category</label>
              <select
                name="exam_category"
                value={formData.exam_category}
                onChange={handleChange}
              >
                <option value="">-- Select --</option>
                {examCategories.map((cat, i) => (
                  <option key={i} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Days Period</label>
              <select
                name="days_period_id"
                value={formData.days_period_id}
                onChange={(e) => {
                const selected = daysPeriods.find((p) => p.value === e.target.value);
                const _match = examPeriods.find(
                  (ep) => ep.examperiod_id === Number(selected?.examperiod_id)
                );

                setFormData((prev) => ({
                  ...prev,
                  days_period_id: e.target.value,
                  examperiod_id: selected?.examperiod_id.toString() || '',
                  exam_date: selected?.value || '',
                }));
              }}
                disabled={daysPeriods.length === 0}
              >
                <option value="">-- Select Days Period --</option>
                {daysPeriods.map((p, i) => (
                  <option key={i} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Program</label>
              <select name="program_id" value={formData.program_id} onChange={handleChange}>
                <option value="">-- Select Program --</option>
                {programs.map((p) => (
                  <option key={p.program_id} value={p.program_id}>
                    {p.program_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Course</label>
              <select name="course_id" value={formData.course_id} onChange={handleChange}>
                <option value="">-- Select Course --</option>
                {filteredCourses.map((c) => (
                  <option key={c.course_id} value={c.course_id}>
                    {c.course_id} | {c.course_name} | {c.year_level}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Modality Type</label>
              <select
                name="modality_id"
                value={formData.modality_id}
                onChange={(e) => {
                  const selectedId = parseInt(e.target.value);
                  const selected = modalities.find((m) => m.modality_id === selectedId);
                  setFormData({ ...formData, modality_id: String(selectedId) });
                  setSelectedModality(selected || null);
                }}
                disabled={!formData.course_id}
              >
                <option value="">-- Select Modality Type --</option>
                {Array.from(
                  new Map(
                    modalities
                      .filter((m) => m.course_id === formData.course_id)
                      .map((m) => [m.modality_type, m])
                  ).values()
                ).map((mod) => (
                  <option key={mod.modality_id} value={mod.modality_id}>
                    {mod.modality_type}
                  </option>
                ))}
              </select>
              {selectedModality && (
                <div className="modality-details">
                  <h3>Modality Details</h3>
                  <div className="modality-list">
                    {modalities
                      .filter(
                        (m) =>
                          m.modality_type === selectedModality.modality_type &&
                          m.course_id === selectedModality.course_id &&
                          m.program_id === selectedModality.program_id
                      )
                      .map((m, idx) => {
                        const roomName = rooms.find(r => r.room_id === m.room_id)?.room_name || m.room_id;
                        return (
                          <div key={idx} className="modality-item">
                            <div className="modality-section">{m.section_name}</div>
                            <div className="modality-info">
                              <p><span className="label">Room:</span>{m.room_id} {roomName}</p>
                              <p><span className="label">Room Type:</span> {m.room_type}</p>
                              <p><span className="label">Course:</span> {m.course_id}</p>
                              <p><span className="label">Program:</span> {m.program_id}</p>
                              <p><span className="label">Remarks:</span> {m.modality_remarks || 'None'}</p>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>

            <div className="form-group"> 
              <label>Proctors</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '14px' }}>
                <label>
                  <input
                    type="radio"
                    name="proctor_filter"
                    value="available_only"
                    checked={formData.proctor_filter === 'available_only'}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, proctor_filter: e.target.value }))
                    }
                  />
                  Available Proctors only
                </label>
                <label>
                  <input
                    type="radio"
                    name="proctor_filter"
                    value="all"
                    checked={formData.proctor_filter === 'all'}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, proctor_filter: e.target.value }))
                    }
                  />
                  All Proctors (Available or Unavailable)
                </label>
              </div>
            </div>

            <div className="form-group">
              <label>Exam Duration</label>
              <div className="duration-inputs">
                <input
                  type="number"
                  name="hours"
                  value={formData.hours}
                  onChange={handleChange}
                  min="0"
                  max="5"
                />
                hr/s
                <input
                  type="number"
                  name="minutes"
                  value={formData.minutes}
                  onChange={handleChange}
                  min="0"
                  max="59"
                />
                min/s
              </div>

              {formData.exam_date && (
                <div style={{ marginTop: '8px', fontSize: '14px', fontStyle: 'italic', color: '#333' }}>
                  {(() => {
                    const startTime = new Date(`${formData.exam_date}T07:30:00`);
                    const duration = formData.hours * 60 + formData.minutes;
                    const endTime = new Date(startTime.getTime() + duration * 60000);

                    const format = (d: Date) =>
                      d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                    return (
                      <>
                        Start Time: {format(startTime)}<br />
                        End Time: {format(endTime)}
                      </>
                    );
                  })()}
                </div>
              )}
            </div>

            <div className="footer-actions">
              {/* Generate Button */}
              <button type= 'button' className="btn-generate tooltip" data-tooltip="Generate Schedule" onClick={handleGenerateSave}>
                <FaPlayCircle />
                <span className="tooltip-text">Generate/Save</span>
              </button>

              {/* Other icons in a row */}
              <div className="footer-icon-buttons">
                {/* Send to Dean */}
                <button type= 'button' className="btn-icon-only tooltip" data-tooltip="Send to Dean">
                  <FaPaperPlane />
                  <span className="tooltip-text">Send to Dean</span>
                </button>
                {/* Reassign Proctor */}
                <div style={{ position: "relative", display: "inline-block" }}>
                  {/* Reassign Proctor Button */}
                  <button
                    type="button"
                    className="btn-icon-only tooltip"
                    onClick={() => setIsReassigning(!isReassigning)}
                  >
                    <FaUserEdit className="btn-icon-small" />
                    <span className="tooltip-text">Reassign Proctor</span>
                  </button>

                  {/* Dropdown for Save / Cancel */}
                  {isReassigning && (
                    <div className="dropdown-menu-reassign">
                      <button
                        type="button"
                        className="btn-icon-only tooltip"
                        disabled={Object.entries(selectedProctors).every(
                          ([id, user]) =>
                            examDetails.find(ed => ed.examdetails_id === id)?.user_id === user
                        )}
                        onClick={async () => {
                          const updates = Object.entries(selectedProctors);
                          let hasError = false;

                          for (const [examdetails_id, user_id] of updates) {
                            const { error } = await supabase
                              .from("tbl_examdetails")
                              .update({ user_id })
                              .eq("examdetails_id", examdetails_id);

                            if (error) {
                              toast.error(`Failed to update examdetails_id ${examdetails_id}`);
                              hasError = true;
                            }
                          }

                          if (!hasError) {
                            toast.success("All proctors updated!");
                            setIsReassigning(false);

                            const { data, error } = await supabase.from("tbl_examdetails").select("*");
                            if (!error && data) setExamDetails(data);
                          }
                        }}
                      >
                        <FaSave className="btn-icon-small" />
                        <span className="tooltip-text">Save</span>
                      </button>

                      <button
                        type="button"
                        className="btn-icon-only tooltip"
                        onClick={() => setIsReassigning(false)}
                      >
                        <FaTimes className="btn-icon-small" />
                        <span className="tooltip-text">Cancel</span>
                      </button>
                    </div>
                  )}
                </div>
                 {/* Export */}
                <div className="dropdown tooltip" data-tooltip="Export Schedule">
                  <button type= 'button' className="btn-icon-only dropdown-toggle">
                    <FaFileExport />
                    <span className="tooltip-text">Export</span>
                  </button>
                  <div className="dropdown-menu">
                    <button type= 'button' className="dropdown-item" onClick={handleExportPDF}>PDF</button>
                    <button type= 'button' className="dropdown-item" onClick={exportAsWord}>Word</button>
                    <button type= 'button' className="dropdown-item" onClick={exportAsExcel}>Excel</button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="plot-bondpaper">
            <div 
              id={`schedule-page-${page}`} 
              className="plot-grid export-section"
              style={{ flex: 2 }}
            >
              <div style={{ textAlign: 'center', marginBottom: '15px' }}>
                <img
                  src="/USTPlogo.png"
                  alt="School Logo"
                  style={{ width: '130px', height: '95px', marginBottom: '-8px', fontFamily: 'serif' }}
                />
                <div style={{ fontSize: '20px', color: '#333', marginBottom: '-8px', fontFamily: 'serif' }}>
                  University of Science and Technology of Southern Philippines
                </div>
                <div style={{ fontSize: '10px', color: '#555', marginBottom: '-8px', fontFamily: 'serif' }}>
                  Alubijid | Balubal |Cagayan de Oro City | Claveria | Jasaan | Oroquieta | Panaon | Villanueva
                </div>
                <div style={{ fontSize: '14px', color: '#333', marginBottom: '-8px', fontFamily: 'serif' }}>
                  {(() => {
                    const selected = examPeriods.find(
                      (ep) => ep.examperiod_id === parseInt(formData.examperiod_id)
                    );
                    if (!selected) return null;

                    const matchingGroup = examPeriods.filter(
                      (ep) =>
                        ep.academic_year === selected.academic_year &&
                        ep.exam_category === selected.exam_category &&
                        ep.term.term_name === selected.term.term_name &&
                        ep.college_id === selected.college_id
                    );

                    const sortedDates = matchingGroup
                      .map((ep) => ({
                        start: new Date(ep.start_date),
                        end: new Date(ep.end_date),
                      }))
                      .sort((a, b) => a.start.getTime() - b.start.getTime());

                    const formatShortDate = (date: Date) =>
                      date.toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      });

                    const earliest = sortedDates[0];
                    const latest = sortedDates[sortedDates.length - 1];

                    return (
                      <>
                        <div style={{ fontSize: '20px', color: '#333', marginBottom: '-8px' , fontFamily: 'serif' }}>{selected.college?.college_name || 'College Name'}</div>
                        <div><strong>{selected.exam_category} Examination Schedule | {selected.term?.term_name} S.Y. {selected.academic_year}</strong></div>
                        <div>{formatShortDate(earliest.start)} – {formatShortDate(latest.end)}</div>
                      </>
                    );
                  })()}
                </div>
              </div>

              {roomPages.length > 0 && roomPages[page] ? (
                <>
                  <table>
                    <thead>
                      {/* Exam Date Row */}
                      <tr>
                        <th></th>
                        <th colSpan={roomPages[page].length} style={{ textAlign: 'center' }}>
                          {formData.exam_date
                            ? new Date(formData.exam_date).toLocaleDateString('en-US', {
                                weekday: 'long',
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                              })
                            : 'Date: N/A'}
                        </th>
                      </tr>

                      {/* Building Groups Row */}
                      <tr>
                        <th></th>
                        {(() => {
                          const buildingGroups: Record<string, typeof scheduledRooms> = {};

                          // Group rooms by building
                          roomPages[page].forEach((room) => {
                            const buildingId = room.building?.building_id || "unknown";
                            if (!buildingGroups[buildingId]) buildingGroups[buildingId] = [];
                            buildingGroups[buildingId].push(room);
                          });

                          // Helper: parse room_id into numeric building + room
                          const parseRoom = (id: string) => {
                            const [building, room] = id.split("-").map(Number);
                            return { building, room };
                          };

                          // Sort buildings by building name (optional)
                          return Object.entries(buildingGroups)
                            .sort((a, b) => {
                              const nameA = a[1][0]?.building?.building_name || "";
                              const nameB = b[1][0]?.building?.building_name || "";
                              return nameA.localeCompare(nameB);
                            })
                            .map(([buildingId, roomsInBuilding]) => {
                              // Sort rooms numerically
                              roomsInBuilding.sort((a, b) => {
                                const A = parseRoom(a.room_id || "0-0");
                                const B = parseRoom(b.room_id || "0-0");
                                if (A.building !== B.building) return A.building - B.building;
                                return A.room - B.room;
                              });

                              return (
                                <th
                                  key={buildingId}
                                  colSpan={roomsInBuilding.length}
                                  style={{ textAlign: "center" }}
                                >
                                  {roomsInBuilding[0].building?.building_name || "Unknown"} (
                                  {buildingId})
                                </th>
                              );
                            });
                        })()}
                      </tr>

                      {/* Room IDs Row */}
                      <tr>
                        <th>Time</th>
                        {(() => {
                          // Flatten + sort all rooms on this page
                          const sortedRooms = [...roomPages[page]].sort((a, b) => {
                            const parseRoom = (id: string) => {
                              const [building, room] = id.split("-").map(Number);
                              return { building, room };
                            };
                            const A = parseRoom(a.room_id || "0-0");
                            const B = parseRoom(b.room_id || "0-0");
                            if (A.building !== B.building) return A.building - B.building;
                            return A.room - B.room;
                          });

                          return sortedRooms.map((room) => (
                            <th key={room.room_id}>{room.room_id}</th>
                          ));
                        })()}
                      </tr>
                    </thead>

                    <tbody>
                      {(() => {
                        const cellOccupied: Record<string, boolean> = {};
                        const formatTime12Hour = (date: Date) =>
                          date.toLocaleTimeString("en-US", {
                            hour: "numeric",
                            minute: "2-digit",
                            hour12: true,
                          });

                        const times = [
                          "07:30","08:00","08:30","09:00","09:30","10:00","10:30","11:00","11:30",
                          "12:00","12:30","13:00","13:30","14:00","14:30","15:00","15:30","16:00",
                          "16:30","17:00","17:30","18:00","18:30","19:00","19:30","20:00","20:30"
                        ];

                        // Helper to parse room_id for sorting
                        const parseRoom = (id: string) => {
                          const [building, room] = id.split("-").map(Number);
                          return { building, room };
                        };

                        // Sort rooms once for this page
                        const sortedRooms = [...roomPages[page]].sort((a, b) => {
                          const A = parseRoom(a.room_id || "0-0");
                          const B = parseRoom(b.room_id || "0-0");
                          if (A.building !== B.building) return A.building - B.building;
                          return A.room - B.room;
                        });

                        return times.map((start, rowIdx) => {
                          const currentSlot = new Date(`2023-01-01T${start}:00`);
                          const end = new Date(currentSlot.getTime() + 30 * 60000);

                          return (
                            <tr key={rowIdx}>
                              <td>{`${formatTime12Hour(currentSlot)} - ${formatTime12Hour(end)}`}</td>
                              {sortedRooms.map((room) => {
                                const cellKey = `${room.room_id}-${rowIdx}`;
                                if (cellOccupied[cellKey]) return null;

                                const matchingDetails = examDetails.filter((ed) => {
                                  const edStart = new Date(ed.exam_start_time);
                                  return (
                                    ed.room_id === room.room_id &&
                                    edStart.toTimeString().slice(0, 5) === currentSlot.toTimeString().slice(0, 5) &&
                                    edStart.toDateString() === new Date(formData.exam_date).toDateString()
                                  );
                                });

                                if (matchingDetails.length === 0) {
                                  return (
                                    <td
                                      key={cellKey}
                                      style={{
                                        minHeight: "28px",
                                        border: "1px solid #ccc",
                                        backgroundColor: "#fff",
                                      }}
                                    />
                                  );
                                }

                                const edStart = new Date(matchingDetails[0].exam_start_time);
                                const edEnd = new Date(matchingDetails[0].exam_end_time);
                                const durationMinutes = (edEnd.getTime() - edStart.getTime()) / (1000 * 60);
                                const rowSpan = Math.ceil(durationMinutes / 30);

                                for (let i = 1; i < rowSpan; i++) {
                                  cellOccupied[`${room.room_id}-${rowIdx + i}`] = true;
                                }

                                const courseColor = (courseId: string) => {
                                  const colors = [
                                    "#ffcccc","#ccffcc","#ccccff","#fff0b3","#d9b3ff",
                                    "#ffb3b3","#b3e0ff","#ffd9b3","#c2f0c2","#f0b3ff"
                                  ];
                                  const hash = [...courseId].reduce((acc, char) => acc + char.charCodeAt(0), 0);
                                  return colors[hash % colors.length];
                                };

                                return (
                                  <td
                                    key={cellKey}
                                    rowSpan={rowSpan}
                                    style={{
                                      verticalAlign: "top",
                                      padding: "5px",
                                      minHeight: `${rowSpan * 28}px`,
                                      backgroundColor: "#f9f9f9",
                                      border: "1px solid #ccc",
                                    }}
                                  >
                                    {matchingDetails.map((detail, idx) => (
                                      <div
                                        key={idx}
                                        style={{
                                          height: "100%",
                                          display: "flex",
                                          flexDirection: "column",
                                          justifyContent: "space-between",
                                          backgroundColor: courseColor(detail.course_id),
                                          border: "1px solid #888",
                                          padding: "6px",
                                          fontSize: "12px",
                                          borderRadius: "6px",
                                          lineHeight: "1.6",
                                          color: "#333",
                                          boxSizing: "border-box",
                                        }}
                                      >
                                        <div><strong>{detail.course_id}</strong></div>
                                        <div><strong>{detail.section_name ?? "—"}</strong></div>
                                        <div><strong>
                                          Instructor: {getInstructorName(detail.course_id, detail.program_id)}
                                        </strong></div>
                                        <div>
                                          <strong>Proctor:</strong>{" "}
                                          {isReassigning ? (
                                            <select
                                              className="custom-select"
                                              value={selectedProctors[detail.examdetails_id] || ""}
                                              onChange={(e) =>
                                                setSelectedProctors((prev) => ({
                                                  ...prev,
                                                  [detail.examdetails_id]: e.target.value,
                                                }))
                                              }
                                            >
                                              {availableProctors.map((proctor) => (
                                                <option key={proctor.user_id} value={proctor.user_id}>
                                                  {proctor.full_name}
                                                </option>
                                              ))}
                                            </select>
                                          ) : (
                                            availableProctors.find(
                                              (p) => p.user_id.toString() === detail.user_id.toString()
                                            )?.full_name || "No proctor"
                                          )}
                                        </div>
                                        <div style={{ fontSize: "11px", marginTop: "4px", fontStyle: "italic" }}>
                                          {formatTime12Hour(new Date(detail.exam_start_time))} -{" "}
                                          {formatTime12Hour(new Date(detail.exam_end_time))}
                                        </div>
                                      </div>
                                    ))}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                  <div className="pagination-container">
                    {/* Previous Button */}
                    <button
                      type="button"
                      onClick={() => setPage((p) => Math.max(p - 1, 0))}
                      disabled={page === 0}
                      className={`pagination-btn ${page === 0 ? "disabled" : ""}`}
                    >
                      <FaChevronLeft className="icon" />
                    </button>

                    {/* Page Info */}
                    <span className="pagination-info">
                      Page {page + 1} of {totalPages}
                    </span>

                    {/* Next Button */}
                    <button
                      type="button"
                      onClick={() => setPage((p) => Math.min(p + 1, totalPages - 1))}
                      disabled={page === totalPages - 1}
                      className={`pagination-btn ${page === totalPages - 1 ? "disabled" : ""}`}
                    >
                      <FaChevronRight className="icon" />
                    </button>
                  </div>
                </>
              ) : (
                <div style={{ textAlign: "center", marginTop: "20px", color: '#000000ff' }}>
                  No schedules yet or click days period to load schedules.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      <ToastContainer position="top-right" autoClose={3000} />
    </div>
  );
};

export default Scheduler_PlotSchedule;