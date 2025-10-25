// import React, { useState, useEffect } from 'react';
// import { FaEye, FaSearch, FaChevronLeft, FaChevronRight, FaArrowLeft, FaPlayCircle, FaFileExport, FaPaperPlane, FaUserEdit, FaSave, FaTimes } from 'react-icons/fa';
// import { FiRefreshCw  } from "react-icons/fi";
// import { api } from '../lib/apiClient.ts';
// import '../styles/plotschedule.css';
// import 'react-toastify/dist/ReactToastify.css';
// import { ToastContainer, toast } from 'react-toastify';
// import html2pdf from 'html2pdf.js';
// import * as XLSX from 'xlsx';

// interface Course {
//   course_id: string;
//   course_name: string;
// }

// interface Proctor {
//   user_id: number;
//   full_name: string;
// }

// interface Modality {
//   modality_id: number;
//   modality_type: string;
//   room_type: string;
//   modality_remarks: string;
//   course_id: string;
//   program_id: string;
//   room_id: string | null;
//   possible_rooms?: string[];
//   section_name: string;
//   user_id: number;
//   section?: {
//     year_level: string;
//     term: {
//       term_name: string;
//     };
//   };
// }

// interface SectionCourse {
//   course_id: string;
//   program_id: string;
//   year_level: string;
//   term: {
//     term_name: string;
//   };
//   user_id: number;
//   section_name?: string;
// }

// interface Program {
//   program_id: string;
//   program_name: string;
// }

// interface Room {
//   room_id: string;
//   room_name: string;
//   building?: {
//     building_id: string;
//     building_name: string;
//   };
// }

// interface ExamPeriod {
//   examperiod_id: number;
//   start_date: string;
//   end_date: string;
//   academic_year: string;
//   exam_category: string;
//   college_id?: string;
//   term: {
//     term_name: string;
//   };
//   college: {
//     college_name: string;
//   };
// }

// interface ExamDetail {
//   examdetails_id: string;
//   course_id: string;
//   program_id: string;
//   room_id: string;
//   modality_id: string;
//   user_id: string;
//   exam_period: string;
//   exam_date: string;
//   exam_duration: string;
//   exam_start_time: string;
//   exam_end_time: string;
//   time_in: string | null;
//   time_out: string | null;
//   section_name: string;
//   academic_year: string;
//   semester: string;
//   exam_category: string;
// }

// const Scheduler_PlotSchedule: React.FC = () => {
//   const [showPlot, setShowPlot] = useState(false);
//   const [courses, setCourses] = useState<Course[]>([]);
//   const [programs, setPrograms] = useState<Program[]>([]);
//   const [modalities, setModalities] = useState<Modality[]>([]);
//   const [rooms, setRooms] = useState<Room[]>([]);
//   const [examPeriods, setExamPeriods] = useState<ExamPeriod[]>([]);
//   const [userId, setUserId] = useState<string | null>(null);
//   const [sectionCourses, setSectionCourses] = useState<SectionCourse[]>([]);
//   const [_selectedModality, setSelectedModality] = useState<Modality | null>(null);
//   const [availableProctors, setAvailableProctors] = useState<Proctor[]>([]);
//   const [examDetails, setExamDetails] = useState<ExamDetail[]>([]);
//   const [searchTerm, setSearchTerm] = useState('');
//   const [selectedExam, setSelectedExam] = useState<ExamDetail | null>(null);
//   const [_isExporting, _setIsExporting] = useState(false);
//   const [mergedPeriods, setMergedPeriods] = useState<{ label: string; value: string }[]>([]);
//   const [examCategories, setExamCategories] = useState<string[]>([]);
//   const [instructors, setInstructors] = useState<{ user_id: number; first_name: string; last_name: string }[]>([]);
//   const [isReassigning, setIsReassigning] = useState(false);
//   const [selectedProctors, setSelectedProctors] = useState<Record<string, string>>({});
//   const [examDate, _setExamDate] = useState<string>('');
//   const [examStartTime, _setExamStartTime] = useState<string>('');
//   const [examEndTime, _setExamEndTime] = useState<string>('');
//   const [selectedRoomId, _setSelectedRoom] = useState<number | null>(null);
//   const [canonicalSlots, setCanonicalSlots] = useState<Record<string, { start: string; end: string }>>({});
//   const [selectedDay, setSelectedDay] = useState<string>("");
//   const [showRemarksMap, setShowRemarksMap] = useState<Record<string, boolean>>({});
//   const [showDeanModal, setShowDeanModal] = useState(false);
//   const [deanName, setDeanName] = useState("");
//   const [_deanRole, setDeanRole] = useState("");
//   const [pdfFile, setPdfFile] = useState<File | null>(null);
//   const [deanRemarks, setDeanRemarks] = useState<string>("");
//   const [deanUserId, setDeanUserId] = useState<number | null>(null);
//   const [deanCollegeId, setDeanCollegeId] = useState<number | null>(null);

//   const handleSubmitToDean = async () => {
//     if (!pdfFile) {
//       toast.error("Please upload a PDF");
//       return;
//     }
//     if (!userId) {
//       toast.error("User not logged in");
//       return;
//     }
//     if (!deanUserId || !deanCollegeId) {
//       toast.error("Dean not selected");
//       return;
//     }

//     try {
//       const fileName = `${Date.now()}_${pdfFile.name}`;
//       const { data: uploadData, error: uploadErr } = await api.storage
//         .from("schedule-pdfs")
//         .upload(fileName, pdfFile);

//       if (uploadErr || !uploadData) {
//         console.error(uploadErr);
//         toast.error("Upload failed");
//         return;
//       }

//       const { error: insertErr } = await api
//         .from("tbl_scheduleapproval")
//         .insert({
//           request_id: crypto.randomUUID(),
//           dean_user_id: deanUserId,
//           dean_college: deanCollegeId,          
//           submitted_by: Number(userId),         
//           submitted_at: new Date().toISOString(),
//           status: "pending",
//           remarks: deanRemarks,
//           created_at: new Date().toISOString(),
//           file_url: uploadData.path,          
//         });

//       if (insertErr) {
//         console.error("api insert error:", insertErr);
//         toast.error(`Failed to save schedule: ${insertErr.message}`);
//         return;
//       }

//       toast.success("Sent to Dean!");
//       setShowDeanModal(false);
//       setPdfFile(null);
//       setDeanRemarks("");
//     } catch (err) {
//       console.error(err);
//       toast.error("Unexpected error");
//     }
//   };

//   const handleSendToDeanClick = async () => {
//     if (!userId) return;

//     const { data: schedulerRole } = await api
//       .from("tbl_user_role")
//       .select("college_id")
//       .eq("user_id", userId)
//       .eq("role_id", 3)
//       .single();

//     if (!schedulerRole) {
//       toast.error("No scheduler role found");
//       return;
//     }

//     const collegeId = schedulerRole.college_id;

//     const { data: deanRoleData } = await api
//       .from('tbl_user_role')
//       .select('user_id, college_id') 
//       .eq('college_id', collegeId)
//       .eq('role_id', 1) 
//       .single();

//     if (!deanRoleData) {
//       toast.error("No dean found for this college");
//       return;
//     }

//     const deanId = deanRoleData.user_id;  // integer
//     setDeanUserId(deanId);
//     setDeanCollegeId(deanRoleData.college_id); 

//     // now get dean name for display
//     const { data: deanUser } = await api
//       .from('tbl_users')
//       .select('first_name,last_name')
//       .eq('user_id', deanId)
//       .single();

//     if (deanUser) {
//       setDeanName(`${deanUser.first_name} ${deanUser.last_name}`);
//       setDeanRole("Dean");
//       setShowDeanModal(true);
//     }
//   };

//   const schedulesToDisplay = examDetails.filter(
//     (ed) => ed.exam_date === selectedDay
//   );

//   <div className="schedule-container">
//     {schedulesToDisplay.length === 0 ? (
//       <p>No schedules for this day.</p>
//     ) : (
//       schedulesToDisplay.map((ed) => (
//         <div
//           key={`${ed.course_id}-${ed.section_name}-${ed.modality_id}`}
//           className="schedule-item"
//         >
//           {ed.course_id} | {ed.section_name} | {ed.room_id} | {ed.exam_start_time} - {ed.exam_end_time}
//         </div>
//       ))
//     )}
//   </div>

//   const inferYearLevelFromExamDetail = (ed: ExamDetail): string => {
//     const byModId = modalities.find(
//       (m) => String(m.modality_id) === String(ed.modality_id)
//     );
//     if (byModId) return getYearLevelForModality(byModId);

//     const byCourseSection = modalities.find(
//       (m) =>
//         m.course_id === ed.course_id &&
//         m.program_id === ed.program_id &&
//         m.section_name === ed.section_name
//     );
//     if (byCourseSection) return getYearLevelForModality(byCourseSection);

//     const sc = sectionCourses.find(
//       (s) => s.course_id === ed.course_id && s.program_id === ed.program_id
//     );
//     return sc?.year_level ?? "Unknown";
//   };

//   useEffect(() => {
//     const map: Record<string, { start: string; end: string }> = {};

//     (examDetails || []).forEach((ed) => {
//       const year = inferYearLevelFromExamDetail(ed);
//       const key = `${ed.course_id}||${year}`;
//       if (!map[key]) {
//         map[key] = {
//           start: ed.exam_start_time,
//           end: ed.exam_end_time,
//         };
//       }
//     });

//     setCanonicalSlots(map);
//   }, [examDetails, modalities, sectionCourses]);
  
//   const isRoomAvailable = async (
//     roomId: number,
//     date: string,
//     startTime: string,
//     endTime: string
//   ): Promise<boolean> => {
//     const { data, error } = await api
//       .from('tbl_examdetails')
//       .select('*')
//       .eq('room_id', roomId)
//       .eq('exam_date', date)
//       .or(`and(start_time,lt.${endTime},end_time,gt.${startTime})`);

//     if (error) {
//       console.error('Error checking room availability:', error);
//       return false;
//     }

//   useEffect(() => {
//     if (!selectedRoomId || !examDate || !examStartTime || !examEndTime) return;

//     const checkRoom = async () => {
//       const available = await isRoomAvailable(selectedRoomId, examDate, examStartTime, examEndTime);
//       if (!available) {
//         alert('⚠ This room is already booked for that time. Please adjust date/time.');
//       }
//     };

//     checkRoom();
//   }, [selectedRoomId, examDate, examStartTime, examEndTime]);

//     return data.length === 0;
//   };

//   const getInstructorName = (courseId: string, programId: string): string => {
//     const section = sectionCourses.find(
//       (s) => s.course_id === courseId && s.program_id === programId
//     );
//     const instructor = instructors.find(
//       (i) => String(i.user_id) === String(section?.user_id)
//     );
//     return instructor ? `${instructor.first_name} ${instructor.last_name}` : '—';
//   };

//   const filteredExamDetails = examDetails.filter((ed) =>
//     ed.examdetails_id?.toString().toLowerCase().includes(searchTerm.toLowerCase())
//   );

//   const handleExportPDF = () => {
//     const orientation = globalThis.confirm("Click OK for Landscape, Cancel for Portrait")
//       ? "landscape"
//       : "portrait";

//     const element = document.createElement("div");

//     for (let i = 0; i < totalPages; i++) {
//       // create the page container first
//       const pageDiv = document.createElement("div");
//       pageDiv.classList.add("pdf-page");
//       if (orientation === "landscape") {
//         pageDiv.classList.add("landscape");
//       }

//       // prevent breaking inside page container
//       (pageDiv.style as any).breakInside = "avoid";

//       // find the schedule content
//       const tableWrapper = document.getElementById(`schedule-page-${i}`);
//       if (tableWrapper) {
//         // clone it
//         const clone = tableWrapper.cloneNode(true) as HTMLElement;
//         // prevent breaking inside clone
//         (clone.style as any).breakInside = "avoid";
//         pageDiv.appendChild(clone);
//       }

//       // append the page to element
//       element.appendChild(pageDiv);

//       // add a page break after every page except the last
//       if (i < totalPages - 1) {
//         const pageBreak = document.createElement("div");
//         pageBreak.classList.add("page-break");
//         element.appendChild(pageBreak);
//       }
//     }

//     html2pdf()
//       .set({
//         margin: 10,
//         filename: "Exam_Schedule.pdf",
//         image: { type: "jpeg", quality: 0.98 },
//         html2canvas: { scale: 2, useCORS: true },
//         jsPDF: { unit: "mm", format: "a4", orientation },
//       })
//       .from(element)
//       .save();
//   };

//   const exportAsWord = () => {
//     const element = document.querySelector('.export-section');
//     if (!element) return;

//     const html = element.outerHTML;
//     const blob = new Blob(['\ufeff' + html], {
//       type: 'application/msword',
//     });

//     const link = document.createElement('a');
//     link.href = URL.createObjectURL(blob);
//     link.download = 'ExamSchedule.doc';
//     document.body.appendChild(link);
//     link.click();
//     document.body.removeChild(link);
//   };

//   const exportAsExcel = () => {
//     const table = document.querySelector('.export-section table');
//     if (!table) return;

//     const workbook = XLSX.utils.table_to_book(table as HTMLTableElement);
//     XLSX.writeFile(workbook, 'ExamSchedule.xlsx');
//   };
  
//   const [formData, setFormData] = useState({
//     course_id: '',
//     program_id: '',
//     modality_id: '',
//     examperiod_id: '',
//     academic_term: '',
//     exam_category: '',
//     days_period_id: '',
//     hours: 1,
//     minutes: 30,
//     proctor_all: true,
//     exam_date: '',
//     proctor_filter: 'available_only',
//     exam_start_time: '', // NEW
//     exam_end_time: '', 
//   });

//   useEffect(() => {
//     const fetchInstructors = async () => {
//       const { data, error } = await api
//         .from('tbl_users')
//         .select('*');

//       if (error) {
//         console.error('Error fetching instructors:', error);
//       } else {
//         setInstructors(data || []);
//       }
//     };

//     fetchInstructors();
//   }, []);

//   useEffect(() => {
//     const fetchExamDetails = async () => {
//       const { data, error } = await api
//         .from('tbl_examdetails')
//         .select('*');

//       if (error) {
//         console.error("Failed to fetch exam details:", error.message);
//         setExamDetails([]);
//       } else {
//         setExamDetails(data || []);
//       }
//     };

//     fetchExamDetails();
//   }, []);

//   useEffect(() => {
//     const fetchInitialData = async () => {
//       const { data: user, error: userErr } = await api.auth.getUser();
//       if (userErr || !user?.user?.id) return;

//       if (formData.examperiod_id) {
//         const examPeriodId = parseInt(formData.examperiod_id);
//         const { data: examDetailsData, error } = await api
//           .from('tbl_examdetails')
//           .select('*')
//           .eq('examperiod_id', examPeriodId);

//         if (error) {
//           console.error('Failed to fetch exam details:', error.message);
//         } else {
//           setExamDetails(examDetailsData || []);
//         }
//       } else {
//         setExamDetails([]);
//       }

//       const { data: availabilityData } = await api
//         .from('tbl_availability')
//         .select(`
//           user_id,
//           day,
//           time_slot,
//           status,
//           tbl_users ( first_name, last_name )
//         `)
//         .eq('status', 'available')

//       const availableProctors = (availabilityData || [])
//         .filter((entry: any) => {
//           // Must be available
//           if (entry.status !== 'available') return false;

//           // Must be available on this exam date
//           if (entry.day !== formData.exam_date) return false;

//           // Check time slot
//           const [slotStart, slotEnd] = entry.time_slot.split('-'); // assuming "HH:mm-HH:mm"
//           return slotStart <= formData.exam_start_time && slotEnd >= formData.exam_end_time;
//         })
//         .map((entry: any) => ({
//           user_id: entry.user_id,
//           full_name: `${entry.tbl_users.first_name} ${entry.tbl_users.last_name}`,
//         }));


//       setAvailableProctors(availableProctors);

//       const { data: sectionCourseData } = await api
//         .from('tbl_sectioncourse')
//         .select(`
//           course_id,
//           program_id, 
//           year_level,
//           user_id,
//           term:term_id (
//             term_name
//           )
//         `);

//       if (sectionCourseData) {
//         const cleanedSectionCourses: SectionCourse[] = sectionCourseData.map((sc: any) => ({
//           course_id: sc.course_id,
//           program_id: sc.program_id,
//           year_level: sc.year_level,
//           term: sc.term && !Array.isArray(sc.term)
//             ? sc.term
//             : { term_name: 'Unknown' },
//           user_id: sc.user_id,
//         }));

//         setSectionCourses(cleanedSectionCourses);
//       }

//       const { data: userMeta } = await api
//         .from('tbl_users')
//         .select('user_id, email_address')
//         .eq('email_address', user.user.email)
//         .single();

//       if (!userMeta) return;
//       setUserId(userMeta.user_id);
      
//       const { data: userRoles } = await api
//         .from('tbl_user_role')
//         .select('college_id')
//         .eq('user_id', userMeta.user_id)
//         .not('college_id', 'is', null);

//       const userCollegeId = userRoles?.[0]?.college_id;
//       if (!userCollegeId) return;

//       const { data: departments } = await api
//         .from('tbl_department')
//         .select('department_id')
//         .eq('college_id', userCollegeId);

//       const departmentIds = departments?.map((d: any) => d.department_id) ?? [];

//       const [courseRes, progRes, roomRes, modRes, examRes] = await Promise.all([
//         api.from('tbl_course').select('course_id, course_name'),
//         api
//           .from('tbl_program')
//           .select('program_id, program_name, department_id')
//           .in('department_id', departmentIds),
//         api
//           .from('tbl_rooms')
//           .select(`
//             room_id,
//             room_name,
//             building: building_id (
//               building_id,
//               building_name
//             )
//           `),
//         api
//         .from('tbl_modality')
//         .select(`
//           modality_id,
//           modality_type,
//           room_type,
//           modality_remarks,
//           course_id,
//           program_id,
//           room_id,
//           possible_rooms,
//           section_name,
//           user_id
//         `),
//         api
//           .from('tbl_examperiod')
//           .select(`
//             examperiod_id,
//             start_date,
//             end_date,
//             academic_year,
//             exam_category,
//             college_id,
//             term:term_id (
//               term_name
//             ),
//             college:college_id (
//               college_name
//             )
//           `)
//           .eq('college_id', userCollegeId),
//       ]);

//       if (courseRes.data) setCourses(courseRes.data);
//       if (progRes.data) setPrograms(progRes.data);
//       if (roomRes.data) {
//         const cleanedRooms: Room[] = roomRes.data.map((room: any) => ({
//           room_id: room.room_id,
//           room_name: room.room_name,
//           building: Array.isArray(room.building) ? room.building[0] : room.building,
//         }));
//         setRooms(cleanedRooms);
//       }
//       if (modRes.data) setModalities(modRes.data);

//       if (examRes.data) {
//         const fixed: ExamPeriod[] = examRes.data.map((ep: any) => ({
//           examperiod_id: ep.examperiod_id,
//           start_date: ep.start_date,
//           end_date: ep.end_date,
//           academic_year: ep.academic_year,
//           exam_category: ep.exam_category,
//           term: ep.term || { term_name: 'Unknown' },
//           college_id: ep.college_id,
//           college: ep.college || { college_name: 'N/A' },
//         }));

//         setExamPeriods(fixed);

//         const merged = Array.from(
//           new Map(
//             fixed.map((ep) => [
//               `${ep.academic_year}-${ep.term.term_name}`,
//               {
//                 label: `${ep.academic_year} ${ep.term.term_name}`,
//                 value: `${ep.academic_year}||${ep.term.term_name}`,
//               },
//             ])
//           ).values()
//         );
//         setMergedPeriods(merged);

//         const categories = Array.from(new Set(fixed.map((ep) => ep.exam_category)));
//         setExamCategories(categories);
//       }
//     };

//     fetchInitialData();
//   }, []);

//   const [daysPeriods, setDaysPeriods] = useState<
//     { label: string; value: string; examperiod_id: number }[]
//   >([]);

//   const formatFullDate = (dateStr: string) =>
//   new Date(dateStr).toLocaleDateString('en-US', {
//     month: 'long',
//     day: 'numeric',
//     year: 'numeric',
//   });

//   useEffect(() => {
//     if (!formData.academic_term || !formData.exam_category) {
//       setDaysPeriods([]);
//       return;
//     }

//     const [year, term] = formData.academic_term.split('||');

//     const matchingPeriods = examPeriods.filter(
//       (ep) =>
//         ep.academic_year === year &&
//         ep.term.term_name === term &&
//         ep.exam_category === formData.exam_category
//     );

//     const allDates: { label: string; value: string; examperiod_id: number }[] = [];

//     matchingPeriods.forEach((ep) => {
//       const start = new Date(ep.start_date);
//       const end = new Date(ep.end_date);
//       for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
//         const formatted = formatFullDate(d.toISOString());
//         allDates.push({
//           label: formatted,
//           value: d.toISOString().split('T')[0], 
//           examperiod_id: ep.examperiod_id,
//         });
//       }
//     });

//     setDaysPeriods(allDates);
//   }, [formData.academic_term, formData.exam_category, examPeriods]);

//   useEffect(() => {
//     if (!formData.academic_term || !formData.exam_category) return;

//     const [year, term] = formData.academic_term.split('||');

//     const match = examPeriods.find(
//       (ep) =>
//         ep.academic_year === year &&
//         ep.term.term_name === term &&
//         ep.exam_category === formData.exam_category
//     );

//     if (match) {
//       setFormData((prev) => ({
//         ...prev,
//         examperiod_id: match.examperiod_id.toString(),
//         exam_date: match.start_date,
//       }));
//     }
//   }, [formData.academic_term, formData.exam_category, examPeriods]);

//   const filteredCourses = formData.program_id
//     ? sectionCourses
//         .filter((sc) => sc.program_id === formData.program_id)
//         .map((sc) => {
//           const course = courses.find((c) => c.course_id === sc.course_id);
//           return course
//             ? {
//                 course_id: course.course_id,
//                 course_name: course.course_name,
//                 year_level: sc.year_level,
//                 term_name: sc.term?.term_name || 'Unknown',
//               }
//             : null;
//         })
//         .filter(
//           (c, index, self) =>
//             c !== null &&
//             index === self.findIndex((t) => t?.course_id === c?.course_id)
//         ) as {
//           course_id: string;
//           course_name: string;
//           year_level: string;
//           term_name: string;
//         }[]
//     : [];

//   const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
//     const { name, value } = e.target;

//     if (name === 'examperiod_id') {
//       const selected = examPeriods.find(ep => ep.examperiod_id === parseInt(value));
//       setFormData((prev) => ({
//         ...prev,
//         examperiod_id: value,
//         exam_date: selected?.start_date ?? ''
//       }));
//    } else {
//       setFormData((prev) => ({
//         ...prev,
//         [name]: e.target.type === 'number' ? parseInt(value) : value,
//       }));

//       if (name === 'course_id') {
//         setSelectedModality(null);
//         setFormData((prev) => ({ ...prev, modality_id: '' }));
//       }
//     }
//     if (name === 'modality_id') {
//       const selected = modalities.find(m => m.modality_id === parseInt(value));
//       setSelectedModality(selected || null);
//     }
//   };

//   const shuffleArray = <T,>(arr: T[]): T[] => {
//     const a = [...arr];
//     for (let i = a.length - 1; i > 0; i--) {
//       const j = Math.floor(Math.random() * (i + 1));
//       [a[i], a[j]] = [a[j], a[i]];
//     }
//     return a;
//   };

//   const getYearLevelForModality = (m: Modality): string => {
//     if (m.section?.year_level) return m.section.year_level as string;

//     const hit = sectionCourses.find(
//       sc =>
//         sc.course_id === m.course_id &&
//         sc.program_id === m.program_id &&
//         String(sc.user_id) === String(m.user_id)
//     );
//     return hit?.year_level ?? "Unknown";
//   };

//   const handleGenerateSave = async () => {
//     if (!userId) return;

//     if (
//       !formData.course_id ||
//       !formData.program_id ||
//       !formData.examperiod_id ||
//       !formData.exam_date
//     ) {
//       alert("Please complete all required fields before saving.");
//       return;
//     }

//     const courseModalities = modalities.filter(
//       (m) => m.course_id === formData.course_id
//     );

//     if (courseModalities.length === 0) {
//       alert("No modalities found for this course.");
//       return;
//     }

//     const selectedExamPeriod = examPeriods.find(
//       (ep) => ep.examperiod_id === parseInt(formData.examperiod_id)
//     );
//     if (!selectedExamPeriod) {
//       alert("❌ Exam period not found.");
//       return;
//     }

//     const durationMinutes = formData.hours * 60 + formData.minutes;
//     const pad = (n: number) => String(n).padStart(2, "0");
//     const intervalString = `${pad(formData.hours)}:${pad(formData.minutes)}:00`;
//     const examPeriodRange = `${selectedExamPeriod.start_date} – ${selectedExamPeriod.end_date}`;

//     // fetch existing schedules for this date
//     const { data: existing } = await api
//       .from("tbl_examdetails")
//       .select("*")

//     // Build scheduleGrid from existing (room -> occupied intervals)
//     const scheduleGrid: Record<string, { start: Date; end: Date }[]> = {};
//     (existing || []).forEach((ed: any) => {
//       const roomKey = String(ed.room_id);
//       if (!scheduleGrid[roomKey]) scheduleGrid[roomKey] = [];
//       scheduleGrid[roomKey].push({
//         start: new Date(ed.exam_start_time),
//         end: new Date(ed.exam_end_time),
//       });
//     });

//     const isSlotFree = (roomId: string | number, start: Date, end: Date) => {
//       const key = String(roomId);
//       const roomSchedule = scheduleGrid[key] || [];
//       return !roomSchedule.some((slot) => slot.start < end && slot.end > start);
//     };

//     // All possible slots for the day
//     const startOfDay = new Date(`${formData.exam_date}T07:30:00`);
//     const endOfDay = new Date(`${formData.exam_date}T21:00:00`);
//     const allSlots: { start: Date; end: Date }[] = [];
//     for (
//       let slotStart = new Date(startOfDay);
//       slotStart < endOfDay;
//       slotStart = new Date(slotStart.getTime() + durationMinutes * 60000)
//     ) {
//       allSlots.push({
//         start: new Date(slotStart),
//         end: new Date(slotStart.getTime() + durationMinutes * 60000),
//       });
//     }
//     const randomizedSlots = shuffleArray(allSlots);

//     // proctor & inserts
//     let proctorIndex = 0;
//     const totalAvailable = availableProctors.length;
//     const inserts: any[] = [];

//     // Candidate modalities for the selected course + modality_type
//     const candidateModalities = modalities.filter(
//       (m) => m.course_id === formData.course_id
//     );

//     const orderedModalities = sequenceAlternating(candidateModalities);

//     // Build local canonical map from EXISTING examDetails (key -> Date)
//     const localCanonical = new Map<string, { start: Date; end: Date }>();
//     (existing || []).forEach((ed: any) => {
//       const year = inferYearLevelFromExamDetail(ed);
//       const key = `${ed.course_id}||${year}`;
//       if (!localCanonical.has(key)) {
//         localCanonical.set(key, {
//           start: new Date(ed.exam_start_time),
//           end: new Date(ed.exam_end_time),
//         });
//       }
//     });

//     // Group by course + year_level (cohorts)
//     const groupedByCohort = new Map<string, Modality[]>();
//     for (const m of orderedModalities) {
//       const key = `${m.course_id}||${getYearLevelForModality(m)}`;
//       if (!groupedByCohort.has(key)) groupedByCohort.set(key, []);
//       groupedByCohort.get(key)!.push(m);
//     }

//     // For each cohort try to schedule (prefer canonical slot)
//     function getProgramKey(modality: any): string {
//       return modality.program_id?.toString() || "unknown";
//     }

//     function getSectionInstructorId(
//       modality: Modality,
//       sectionCourses: SectionCourse[]
//     ): number | null {
//       const normalizedModalitySection = modality.section_name.trim().toLowerCase();

//       const match = sectionCourses.find((s: SectionCourse) => {
//         const normalizedCourseSection = s.section_name?.trim().toLowerCase();
//         return (
//           s.course_id === modality.course_id &&
//           s.program_id === modality.program_id &&
//           normalizedCourseSection === normalizedModalitySection
//         );
//       });

//       if (!match) {
//         console.warn(`⚠️ No match found for section ${modality.section_name}`);
//       }

//       return match?.user_id ?? null;
//     }

//     function mapTimeSlotToRange(slot: string) {
//       switch (slot.trim()) {
//         case "7 AM - 12 NN":
//           return { start: "07:00", end: "12:00" };
//         case "1 PM - 5 PM":
//           return { start: "13:00", end: "17:00" };
//         case "5 PM - 9 PM":
//           return { start: "17:00", end: "21:00" };
//         default:
//           return null;
//       }
//     }

//     function sequenceAlternating(modalities: any[]): any[] {
//       const result: any[] = [];
//       const pool = [...modalities];

//       while (pool.length > 0) {
//         if (result.length === 0) {
//           result.push(pool.shift()!);
//           continue;
//         }

//         const last = result[result.length - 1];
//         const lastYear = getYearLevelForModality(last);
//         const lastProgram = getProgramKey(last);

//         // pick the next modality that is NOT same year+program
//         let idx = pool.findIndex(m => {
//           const year = getYearLevelForModality(m);
//           const prog = getProgramKey(m);
//           return !(year === lastYear && prog === lastProgram);
//         });

//         if (idx === -1) {
//           // fallback: no choice, allow same-year+program
//           idx = 0;
//         }

//         result.push(pool.splice(idx, 1)[0]);
//       }

//       return result;
//     }

//     // Track which ones we actually insert
//     let insertedCount = 0;

//     for (const [key, cohortModalities] of groupedByCohort) {
//       const allScheduled = cohortModalities.every((modality) =>
//         (existing || []).some(
//           (ed: any) =>
//             ed.course_id === modality.course_id &&
//             ed.section_name === modality.section_name &&
//             ed.modality_id === modality.modality_id && // ensure it's the same modality
//             ed.exam_date === formData.exam_date
//         )
//       );

//       if (allScheduled) {
//         continue; // but don't conclude ALL are scheduled yet
//       }

//       let chosenSlot: { start: Date; end: Date } | null = null;
//       let assignmentForSlot: Record<string, string | number> | null = null;

//       // 1) If we already have a canonical slot for this cohort, try to use it
//       if (localCanonical.has(key)) {
//         const cs = localCanonical.get(key)!;

//         // For this canonical slot, build available room lists per modality
//         const possibleRoomsPerMod: Map<string, (string | number)[]> = new Map();
//         const allCandidateRooms = new Set<string | number>();
//         let ok = true;

//         for (const mod of cohortModalities) {
//           const roomsList = (mod.possible_rooms || []).filter((r: any) =>
//             isSlotFree(r, cs.start, cs.end)
//           );
//           if (!roomsList.length) {
//             ok = false; // at least one section has no free possible room at canonical slot
//             break;
//           }
//           possibleRoomsPerMod.set(mod.section_name, roomsList);
//           roomsList.forEach((r) => allCandidateRooms.add(r));
//         }

//         if (ok && allCandidateRooms.size >= cohortModalities.length) {
//           // attempt greedy distinct assignment (fewest options first)
//           const usedRooms = new Set<string | number>();
//           const tempAssign: Record<string, string | number> = {};
//           const byLeastOptions = [...cohortModalities].sort(
//             (a, b) =>
//               (possibleRoomsPerMod.get(a.section_name)!.length || 0) -
//               (possibleRoomsPerMod.get(b.section_name)!.length || 0)
//           );
//           let failed = false;
//           for (const mod of byLeastOptions) {
//             const options = possibleRoomsPerMod.get(mod.section_name)!;
//             const pick = options.find((r) => !usedRooms.has(String(r)));
//             if (!pick) {
//               failed = true;
//               break;
//             }
//             usedRooms.add(String(pick));
//             tempAssign[mod.section_name] = pick;
//           }
//           if (!failed) {
//             chosenSlot = { start: cs.start, end: cs.end };
//             assignmentForSlot = tempAssign;
//           }
//         }
//         // if canonical exists but can't assign distinct rooms, we will try to find another slot below
//       }

//       if (!chosenSlot) {
//         slotLoop: for (const slot of randomizedSlots) {
//           const possibleRoomsPerMod: Map<string, (string | number)[]> = new Map();
//           const allCandidateRooms = new Set<string | number>();

//           for (const mod of cohortModalities) {
//             const roomsList = (mod.possible_rooms || []).filter((r: any) =>
//               isSlotFree(r, slot.start, slot.end)
//             );
//             if (!roomsList.length) {
//               continue slotLoop; // this slot fails for the cohort
//             }
//             possibleRoomsPerMod.set(mod.section_name, roomsList);
//             roomsList.forEach((r) => allCandidateRooms.add(r));
//           }

//           if (allCandidateRooms.size < cohortModalities.length) continue slotLoop;

//           // greedy assignment (fewest options first)
//           const usedRooms = new Set<string | number>();
//           const tempAssign: Record<string, string | number> = {};
//           const byLeastOptions = [...cohortModalities].sort(
//             (a, b) =>
//               (possibleRoomsPerMod.get(a.section_name)!.length || 0) -
//               (possibleRoomsPerMod.get(b.section_name)!.length || 0)
//           );
//           let failed = false;
//           for (const mod of byLeastOptions) {
//             const options = possibleRoomsPerMod.get(mod.section_name)!;
//             const pick = options.find((r) => !usedRooms.has(String(r)));
//             if (!pick) {
//               failed = true;
//               break;
//             }
//             usedRooms.add(String(pick));
//             tempAssign[mod.section_name] = pick;
//           }
//           if (!failed) {
//             chosenSlot = slot;
//             assignmentForSlot = tempAssign;
//             // set local canonical for this cohort so future modality clicks align
//             localCanonical.set(key, { start: slot.start, end: slot.end });
//             break slotLoop;
//           }
//         } // end slotLoop
//       }

//       if (!chosenSlot || !assignmentForSlot) {
//         toast.error(`⚠ Unable to find a time with distinct rooms for cohort ${key}. Skipping cohort.`);
//         continue;
//       }

//       // commit the inserts for this cohort using assignmentForSlot
//       for (const modality of cohortModalities) {
//         const alreadyScheduled =
//           (existing || []).some(
//             (ed: any) =>
//               ed.course_id === modality.course_id &&
//               ed.section_name === modality.section_name &&
//               ed.modality_id === modality.modality_id && // add this check
//               ed.exam_date === formData.exam_date
//           ) ||
//           inserts.some(
//             (ed: any) =>
//               ed.course_id === modality.course_id &&
//               ed.section_name === modality.section_name &&
//               ed.modality_id === modality.modality_id && // add this too
//               ed.exam_date === formData.exam_date
//           );

//         if (alreadyScheduled) {
//           console.log(`Skipping ${modality.section_name}, schedule already exists at this exact slot.`);
//           continue;
//         }

//         const roomId = assignmentForSlot[modality.section_name];
//         if (!roomId) {
//           toast.error(`Unexpected: no room assigned for ${modality.section_name}`);
//           continue;
//         }

//         let assignedProctorId: number | null = null;

//         // 🔹 Step 1: Get all instructors for the same course & program
//         const candidateInstructors = instructors.filter((instr) =>
//           sectionCourses.some(
//             (s) =>
//               s.course_id === modality.course_id &&
//               s.program_id === modality.program_id &&
//               s.user_id === instr.user_id
//           )
//         );

//         const sectionInstructorId = getSectionInstructorId(modality, sectionCourses);

//         // 🔹 Step 2: Exclude the instructor of THIS section
//         const alternativeInstructors = candidateInstructors.filter(
//           (instr) => Number(instr.user_id) !== Number(sectionInstructorId)
//         );
//         // 🔍 Debug logs
//         console.log(`Modality: ${modality.section_name}`);
//         console.log("Resolved Section Instructor:", sectionInstructorId);
//         console.log("Candidate Instructors:", candidateInstructors.map(i => i.user_id));
//         console.log("Alternative Instructors:", alternativeInstructors.map(i => i.user_id));

//         if (alternativeInstructors.length > 0) {
//           // ✅ Always pick alternatives first (round-robin between them)
//           assignedProctorId =
//             alternativeInstructors[proctorIndex % alternativeInstructors.length].user_id;
//           proctorIndex++;
//         } else if (candidateInstructors.length === 1 && sectionInstructorId) {
//           // ⚠️ Only fallback to instructor if they’re the ONLY one
//           assignedProctorId = sectionInstructorId;
//         } else {
//           // 🚫 No eligible proctor found
//           assignedProctorId = null;
//         }

//         // Final sanity check
//         if (assignedProctorId === sectionInstructorId && alternativeInstructors.length > 0) {
//           console.error("❌ Incorrect fallback — section instructor assigned despite alternatives");
//         }

//         inserts.push({
//           course_id: modality.course_id,
//           program_id: modality.program_id,
//           room_id: roomId,
//           modality_id: modality.modality_id,
//           user_id: assignedProctorId, // leave as null if no eligible proctor
//           examperiod_id: parseInt(formData.examperiod_id),
//           exam_duration: intervalString,
//           exam_start_time: chosenSlot.start.toISOString(),
//           exam_end_time: chosenSlot.end.toISOString(),
//           proctor_timein: null,
//           proctor_timeout: null,
//           section_name: modality.section_name,
//           academic_year: selectedExamPeriod.academic_year,
//           semester: selectedExamPeriod.term?.term_name || "N/A",
//           exam_category: selectedExamPeriod.exam_category,
//           exam_period: examPeriodRange,
//           exam_date: formData.exam_date,
//         });

//         insertedCount++;
//         const rk = String(roomId);
//         if (!scheduleGrid[rk]) scheduleGrid[rk] = [];
//         scheduleGrid[rk].push({ start: chosenSlot.start, end: chosenSlot.end });
//       }
//     }

//     // persist canonical to component state so UI uses it immediately
//     const canonicalToSet: Record<string, { start: string; end: string }> = { ...canonicalSlots };
//     localCanonical.forEach((v, k) => {
//       canonicalToSet[k] = { start: v.start.toISOString(), end: v.end.toISOString() };
//     });
//     setCanonicalSlots(canonicalToSet);

//     // Persist inserts to DB
//     if (insertedCount > 0) {
//       const { data: insertedData, error } = await api
//         .from("tbl_examdetails")
//         .insert(inserts)
//         .select("*"); // get the inserted rows back

//       if (error) {
//         toast.error(`Failed to save schedule. ${error.message}`);
//       } else {
//         toast.success("Schedule saved successfully!");

//         // Merge inserted schedules with existing ones
//         setExamDetails((prev) => {
//           const merged = [...prev, ...(insertedData || [])];

//           // Optionally remove duplicates if somehow they exist
//           const seen = new Set();
//           return merged.filter((ed) => {
//             const key = `${ed.course_id}||${ed.section_name}||${ed.modality_id}||${ed.exam_date}`;
//             if (seen.has(key)) return false;
//             seen.add(key);
//             return true;
//           });
//         });
//       }
//     } else {
//       toast.info("No new schedules were created — all selected sections already have schedules for this date.");
//     }
//   };

//   useEffect(() => {
//     setFormData((prev) => ({
//       ...prev,
//       academic_term: prev.academic_term || mergedPeriods?.[0]?.value || '',
//       exam_category: prev.exam_category || examCategories?.[0] || '',
//     }));
//   }, [mergedPeriods, examCategories]);

//   const scheduledRooms =
//   rooms && examDetails && formData.exam_date
//     ? rooms.filter((room) =>
//         examDetails.some(
//           (ed) =>
//             ed.room_id === room.room_id &&
//             new Date(ed.exam_start_time).toDateString() ===
//               new Date(formData.exam_date).toDateString()
//         )
//       )
//     : [];

//   // how many room columns per page
//   const columnsPerPage = 5;

//   // how many total pages (based on room count)
//   const totalPages = Math.ceil(scheduledRooms.length / columnsPerPage);

//   // group rooms into "pages"
//   const roomPages = Array.from({ length: totalPages }, (_, i) =>
//     scheduledRooms.slice(i * columnsPerPage, i * columnsPerPage + columnsPerPage)
//   );

//   // track current page
//   const [page, setPage] = useState(0);

//   return (
//     <div className="colleges-container">
//       {!showPlot ? (
//         <>
//           <div className="colleges-header">
//             <h2 className="colleges-title">Manage Schedule</h2>
//             <div className="search-bar">
//               <input 
//                 type="text" 
//                 placeholder="Search for Schedule" 
//                 value={searchTerm}
//                 onChange={(e) => setSearchTerm(e.target.value)}
//               />
//               <button type="button" className="search-button">
//                 <FaSearch />
//               </button>
//             </div>
//           </div>

//           <div className="colleges-actions">
//             <button
//               type="button"
//               className="action-button add-new"
//               onClick={() => setShowPlot(true)}
//             >
//               Add New Schedule
//             </button>
//           </div>

//           <div className="colleges-table-container">
//             <table className="colleges-table">
//               <thead>
//                 <tr>
//                   <th>#</th>
//                   <th>Course ID</th>
//                   <th>Program ID</th>
//                   <th>Room ID</th>
//                   <th>Time Slot</th>
//                   <th>Actions</th>
//                 </tr>
//               </thead>
//               <tbody>
//                 {filteredExamDetails.length === 0 ? (
//                   <tr>
//                     <td colSpan={7}>No schedule found.</td>
//                   </tr>
//                 ) : (
//                   filteredExamDetails.map((ed, index) => (
//                     <tr key={ed.examdetails_id}>
//                       <td>{index + 1}</td>
//                       <td>{ed.course_id}</td>
//                       <td>{ed.program_id}</td>
//                       <td>{ed.room_id}</td>
//                       <td>{new Date(ed.exam_start_time).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})} 
//                           – {new Date(ed.exam_end_time).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}
//                       </td>
//                       <td>
//                         <button type="button"
//                           className="icon-button view-button"
//                           onClick={() => setSelectedExam(ed)}
//                         >
//                           <FaEye />
//                         </button>
//                       </td>
//                     </tr>
//                   ))
//                 )}
//               </tbody>
//             </table>

//             {/* Modal */}
//             {selectedExam && (
//               <div className="modal-overlay">
//                 <div className="modal-content">
//                   <div className="profile-header">Exam Details</div>
//                   <div className="details-grid">
//                     <div className="details-item"><span className="details-label">Exam ID</span><span className="details-value">{selectedExam.examdetails_id}</span></div>
//                     <div className="details-item"><span className="details-label">Course ID</span><span className="details-value">{selectedExam.course_id}</span></div>
//                     <div className="details-item"><span className="details-label">Program ID</span><span className="details-value">{selectedExam.program_id}</span></div>
//                     <div className="details-item"><span className="details-label">Room ID</span><span className="details-value">{selectedExam.room_id}</span></div>
//                     <div className="details-item"><span className="details-label">Modality ID</span><span className="details-value">{selectedExam.modality_id}</span></div>
//                     <div className="details-item"><span className="details-label">User ID</span><span className="details-value">{selectedExam.user_id}</span></div>
//                     <div className="details-item"><span className="details-label">Exam Period</span><span className="details-value">{selectedExam.exam_period}</span></div>
//                     <div className="details-item"><span className="details-label">Exam Date</span><span className="details-value">{selectedExam.exam_date}</span></div>
//                     <div className="details-item"><span className="details-label">Duration</span><span className="details-value">{selectedExam.exam_duration}</span></div>
//                     <div className="details-item"><span className="details-label">Start Time</span><span className="details-value">{selectedExam.exam_start_time}</span></div>
//                     <div className="details-item"><span className="details-label">End Time</span><span className="details-value">{selectedExam.exam_end_time}</span></div>
//                     <div className="details-item"><span className="details-label">Time In</span><span className="details-value">{selectedExam.time_in || 'N/A'}</span></div>
//                     <div className="details-item"><span className="details-label">Time Out</span><span className="details-value">{selectedExam.time_out || 'N/A'}</span></div>
//                     <div className="details-item"><span className="details-label">Section</span><span className="details-value">{selectedExam.section_name}</span></div>
//                     <div className="details-item"><span className="details-label">Academic Year</span><span className="details-value">{selectedExam.academic_year}</span></div>
//                     <div className="details-item"><span className="details-label">Semester</span><span className="details-value">{selectedExam.semester}</span></div>
//                     <div className="details-item"><span className="details-label">Exam Category</span><span className="details-value">{selectedExam.exam_category}</span></div>
//                   </div>
//                   <button type='button' className="close-button" onClick={() => setSelectedExam(null)}>Close</button>
//                 </div>
//               </div>
//             )}
//           </div>
//         </>
//       ) : (
//         <div className="plot-schedule" style={{ display: 'flex', gap: '20px' }}>
//           <div className="plot-controls">
//             <button
//               type="button"
//               onClick={() => setShowPlot(false)}
//               className="back-button"
//             >
//               <FaArrowLeft style={{ marginLeft: "-18px" }} />
//               Back
//             </button>

//             <h3>Add Schedule</h3>
//             <div className="form-group">
//               <label>School Year & Semester</label>
//               <select
//                 name="academic_term"
//                 value={formData.academic_term}
//                 onChange={handleChange}
//               >
//                 {mergedPeriods.map((p, i) => (
//                   <option key={i} value={p.value}>
//                     {p.label}
//                   </option>
//                 ))}
//               </select>
//             </div>

//             <div className="form-group">
//               <label>Exam Term</label>
//               <select
//                 name="exam_category"
//                 value={formData.exam_category}
//                 onChange={handleChange}
//               >
//                 {examCategories.map((cat, i) => (
//                   <option key={i} value={cat}>
//                     {cat}
//                   </option>
//                 ))}
//               </select>
//             </div>

//             <div className="form-group">
//               <label>Days Period</label>
//               <select
//                 name="days_period_id"
//                 value={selectedDay}
//                 onChange={(e) => {
//                   const selected = daysPeriods.find((p) => p.value === e.target.value);
//                   setSelectedDay(e.target.value);
//                   setFormData((prev) => ({
//                     ...prev,
//                     days_period_id: e.target.value,
//                     examperiod_id: selected?.examperiod_id.toString() || "",
//                     exam_date: selected?.value || "",
//                   }));
//                 }}
//                 disabled={daysPeriods.length === 0}
//               >
//                 {daysPeriods.length === 0 && <option>-- No days periods available --</option>}
//                 {daysPeriods.map((p, i) => (
//                   <option key={i} value={p.value}>
//                     {p.label}
//                   </option>
//                 ))}
//               </select>
//             </div>

//             {/* Program Select */}
//             <div className="form-group">
//               <label>Program</label>
//               <select
//                 name="program_id"
//                 value={formData.program_id}
//                 onChange={handleChange}
//               >
//                 <option value="">-- Select Program --</option>
//                 {programs
//                   .slice()
//                   .sort((a, b) => a.program_name.localeCompare(b.program_name))
//                   .map((p) => {
//                     // Count number of courses in this program
//                     const courseCount = sectionCourses.filter(
//                       (sc) => sc.program_id === p.program_id
//                     ).length;

//                     return (
//                       <option
//                         key={p.program_id}
//                         value={p.program_id}
//                         disabled={courseCount === 0} // Disable programs with no courses
//                       >
//                         ({p.program_id}) | {p.program_name} ({courseCount} course
//                         {courseCount !== 1 ? "s" : ""})
//                       </option>
//                     );
//                   })}
//               </select>
//             </div>

//             <div className="form-group">
//               <label>Course</label>
//               <select
//                 name="course_id"
//                 value={formData.course_id} // stays empty initially
//                 onChange={handleChange}
//                 disabled={!formData.program_id || filteredCourses.length === 0}
//               >
//                 <option value="">-- Select Course --</option>
//                 {filteredCourses.length === 0 ? (
//                   <option value="" disabled>
//                     -- No courses available --
//                   </option>
//                 ) : (
//                   Object.entries(
//                     filteredCourses.reduce(
//                       (acc: Record<string, typeof filteredCourses>, course) => {
//                         const year = course.year_level;
//                         if (!acc[year]) acc[year] = [];
//                         acc[year].push(course);
//                         return acc;
//                       },
//                       {}
//                     )
//                   )
//                     // Sort years numerically
//                     .sort(([yearA], [yearB]) => Number(yearA) - Number(yearB))
//                     .map(([year, courses]) => (
//                       <optgroup key={year} label={`Year ${year}`}>
//                         {courses
//                           .slice()
//                           // Sort courses numerically by ID
//                           .sort((a, b) => Number(a.course_id) - Number(b.course_id))
//                           .map((c) => {
//                             const modalityCount = modalities.filter(
//                               (m) => m.course_id === c.course_id
//                             ).length;

//                             return (
//                               <option
//                                 key={c.course_id}
//                                 value={c.course_id}
//                                 disabled={modalityCount === 0} // disable if no modalities
//                               >
//                                 {c.course_id} | {c.course_name} ({modalityCount} modality
//                                 {modalityCount !== 1 ? "ies" : ""})
//                               </option>
//                             );
//                           })}
//                       </optgroup>
//                     ))
//                 )}
//               </select>
//             </div>

//             <div className="form-group">
//               <label>Modalities (Auto-generated)</label>

//               {formData.course_id ? (
//                 <div className="modality-details">
//                   <h3>Modality Details</h3>
//                   <div className="modality-list">
//                     {modalities
//                       .filter((m) => m.course_id === formData.course_id)
//                       .map((m, idx) => {
//                         const isShown = !!showRemarksMap[m.modality_id];

//                         return (
//                           <div key={idx} className="modality-item">
//                             {/* Modality type label */}
//                             <div
//                               style={{
//                                 fontWeight: "bold",
//                                 fontSize: "16px",
//                                 marginBottom: "4px",
//                                 color: "#092C4C",
//                               }}
//                             >
//                               {m.modality_type || "Unknown Modality"}
//                             </div>

//                             {/* Other details */}
//                             <div className="modality-info">
//                               <p>
//                                 <span className="label">Room Type:</span> {m.room_type}
//                               </p>
//                               <p>
//                                 <span className="label">Course:</span> {m.course_id}
//                               </p>
//                               <p>
//                                 <span className="label">Section:</span> {m.section_name}
//                               </p>
//                               <p>
//                                 <span className="label">Program:</span> {m.program_id}
//                               </p>
//                               <p style={{ display: "flex", alignItems: "center", gap: "6px" }}>
//                                 <span className="label">Remarks:</span>
//                                 {m.modality_remarks ? (
//                                   <FaEye
//                                     onClick={() =>
//                                       setShowRemarksMap((prev) => ({
//                                         ...prev,
//                                         [m.modality_id]: !prev[m.modality_id],
//                                       }))
//                                     }
//                                     style={{ cursor: "pointer", color: "#092C4C", fontWeight: "bold" }}
//                                   />
//                                 ) : (
//                                   "None"
//                                 )}
//                               </p>

//                               {/* Remarks box toggled by eye icon */}
//                               {isShown && m.modality_remarks && (
//                                 <div
//                                   style={{
//                                     border: "1px solid #092C4C",
//                                     padding: "6px 8px",
//                                     borderRadius: "6px",
//                                     backgroundColor: "#f5f5f5",
//                                     color: "#092C4C",
//                                     marginTop: "4px",
//                                     maxWidth: "400px",
//                                     wordWrap: "break-word",
//                                     fontSize: "13px",
//                                     fontWeight: "semibold",
//                                   }}
//                                 >
//                                   {m.modality_remarks}
//                                 </div>
//                               )}
//                             </div>
//                           </div>
//                         );
//                       })}
//                   </div>
//                 </div>
//               ) : (
//                 <p>Please select a course to load modalities.</p>
//               )}
//             </div>

//             <div className="form-group"> 
//               <label>Proctors</label>
//               <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '14px' }}>
//                 <label>
//                   <input
//                     type="radio"
//                     name="proctor_filter"
//                     value="available_only"
//                     checked={formData.proctor_filter === 'available_only'}
//                     onChange={(e) =>
//                       setFormData((prev) => ({ ...prev, proctor_filter: e.target.value }))
//                     }
//                   />
//                   Available Proctors only
//                 </label>
//                 <label>
//                   <input
//                     type="radio"
//                     name="proctor_filter"
//                     value="all"
//                     checked={formData.proctor_filter === 'all'}
//                     onChange={(e) =>
//                       setFormData((prev) => ({ ...prev, proctor_filter: e.target.value }))
//                     }
//                   />
//                   All Proctors (Available or Unavailable)
//                 </label>
//               </div>
//             </div>

//             <div className="form-group">
//               <label>Exam Duration</label>
//               <div className="duration-inputs">
//                 <input
//                   type="number"
//                   name="hours"
//                   value={formData.hours}
//                   onChange={handleChange}
//                   min="0"
//                   max="5"
//                 />
//                 hr/s
//                 <input
//                   type="number"
//                   name="minutes"
//                   value={formData.minutes}
//                   onChange={handleChange}
//                   min="0"
//                   max="59"
//                 />
//                 min/s
//               </div>

//               {formData.exam_date && (
//                 <div style={{ marginTop: '8px', fontSize: '14px', fontStyle: 'italic', color: '#333' }}>
//                   {(() => {
//                     const startTime = new Date(`${formData.exam_date}T07:30:00`);
//                     const duration = formData.hours * 60 + formData.minutes;
//                     const endTime = new Date(startTime.getTime() + duration * 60000);

//                     const format = (d: Date) =>
//                       d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

//                     return (
//                       <>
//                         Start Time: {format(startTime)}<br />
//                         End Time: {format(endTime)}
//                       </>
//                     );
//                   })()}
//                 </div>
//               )}
//             </div>

//             <div className="footer-actions">
//               {/* Generate Button */}
//               <button type= 'button' className="btn-generate tooltip" data-tooltip="Generate Schedule" onClick={handleGenerateSave}>
//                 <FaPlayCircle />
//                 <span className="tooltip-text">Generate/Save</span>
//               </button>

//               {/* Other icons in a row */}
//               <div className="footer-icon-buttons">
//                 {/* Send to Dean */}
//                 <button
//                   type='button'
//                   className="btn-icon-only tooltip"
//                   data-tooltip="Send to Dean"
//                   onClick={handleSendToDeanClick}
//                 >
//                   <FaPaperPlane />
//                   <span className="tooltip-text">Send to Dean</span>
//                 </button>

//                 {showDeanModal && (
//                   <div className="modal-overlay">
//                     <div className="modal-content">
//                       <h3>Send Schedule to Dean</h3>
//                       <p>Dean: <strong>{deanName}</strong></p>

//                       <input
//                         type="file"
//                         accept="application/pdf"
//                         onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
//                       />

//                       <textarea
//                         placeholder="Remarks (optional)"
//                         value={deanRemarks}
//                         onChange={(e) => setDeanRemarks(e.target.value)}
//                       />

//                       <div className="modal-actions">
//                         <button type='button' onClick={() => setShowDeanModal(false)} className="btn-cancel">
//                           <FaTimes /> Cancel
//                         </button>
//                         <button type='button' onClick={handleSubmitToDean} className="btn-send">
//                           <FaPaperPlane /> Send
//                         </button>
//                       </div>
//                     </div>
//                   </div>
//                 )}
//                 {/* Reassign Proctor */}
//                 <div style={{ position: "relative", display: "inline-block" }}>
//                   {/* Reassign Proctor Button */}
//                   <button
//                     type="button"
//                     className="btn-icon-only tooltip"
//                     onClick={() => setIsReassigning(!isReassigning)}
//                   >
//                     <FaUserEdit className="btn-icon-small" />
//                     <span className="tooltip-text">Reassign Proctor or Room</span>
//                   </button>

//                   {/* Dropdown for Save / Cancel */}
//                   {isReassigning && (
//                     <div className="dropdown-menu-reassign">
//                       <button
//                         type="button"
//                         className="btn-icon-only tooltip"
//                         disabled={Object.entries(selectedProctors).every(
//                           ([id, user]) =>
//                             examDetails.find(ed => ed.examdetails_id === id)?.user_id === user
//                         )}
//                         onClick={async () => {
//                           const updates = Object.entries(selectedProctors);
//                           let hasError = false;

//                           for (const [examdetails_id, user_id] of updates) {
//                             const { error } = await api
//                               .from("tbl_examdetails")
//                               .update({ user_id })
//                               .eq("examdetails_id", examdetails_id);

//                             if (error) {
//                               toast.error(`Failed to update examdetails_id ${examdetails_id}`);
//                               hasError = true;
//                             }
//                           }

//                           if (!hasError) {
//                             toast.success("All proctors updated!");
//                             setIsReassigning(false);

//                             const { data, error } = await api.from("tbl_examdetails").select("*");
//                             if (!error && data) setExamDetails(data);
//                           }
//                         }}
//                       >
//                         <FaSave className="btn-icon-small" />
//                         <span className="tooltip-text">Save</span>
//                       </button>

//                       <button
//                         type="button"
//                         className="btn-icon-only tooltip"
//                         onClick={() => setIsReassigning(false)}
//                       >
//                         <FaTimes className="btn-icon-small" />
//                         <span className="tooltip-text">Cancel</span>
//                       </button>
//                     </div>
//                   )}
//                 </div>
//                  {/* Export */}
//                 <div className="dropdown tooltip" data-tooltip="Export Schedule">
//                   <button type= 'button' className="btn-icon-only dropdown-toggle">
//                     <FaFileExport />
//                     <span className="tooltip-text">Export</span>
//                   </button>
//                   <div className="dropdown-menu">
//                     <button type= 'button' className="dropdown-item" onClick={handleExportPDF}>PDF</button>
//                     <button type= 'button' className="dropdown-item" onClick={exportAsWord}>Word</button>
//                     <button type= 'button' className="dropdown-item" onClick={exportAsExcel}>Excel</button>
//                   </div>
//                 </div>
//               </div>
//             </div>
//           </div>

//           <div className="plot-bondpaper">
//             <div 
//               id={`schedule-page-${page}`} 
//               className="plot-grid export-section"
//               style={{ flex: 2 }}
//             >
//               {/* Refresh Button - not included in PDF */}
//               <div className="refresh-container no-export" style={{ textAlign: "right", marginBottom: "10px" }}>
//                 <button
//                   type="button"
//                   onClick={async () => {
//                     if (!formData.days_period_id) return;

//                     try {
//                       // Fetch schedules for the selected day
//                       const { data: updatedSchedules, error } = await api
//                         .from("tbl_examdetails")
//                         .select("*")
//                         .eq("exam_date", formData.days_period_id);

//                       if (error) throw error;

//                       // Replace schedules for this day only
//                       setExamDetails((prev) => {
//                         const otherDays = prev.filter(
//                           (ed) => ed.exam_date !== formData.days_period_id
//                         );
//                         return [...otherDays, ...(updatedSchedules || [])];
//                       });

//                       toast.success("Schedules refreshed!");
//                     } catch (err: any) {
//                       console.error(err);
//                       toast.error(`Failed to refresh schedules. ${err.message}`);
//                     }
//                   }}
//                   style={{
//                     background: "transparent",
//                     border: "none",
//                     cursor: "pointer",
//                     fontSize: "20px",
//                     fontWeight: "bold",   // bold
//                     color: "#092C4C",    // color
//                   }}
//                   title="Refresh"
//                 >
//                 <FiRefreshCw />
//                 </button>
//               </div>
              
//               <div style={{ textAlign: 'center', marginBottom: '15px' }}>
//                 <img
//                   src="/USTPlogo.png"
//                   alt="School Logo"
//                   style={{ width: '130px', height: '95px', marginBottom: '-8px', fontFamily: 'serif' }}
//                 />
//                 <div style={{ fontSize: '20px', color: '#333', marginBottom: '-8px', fontFamily: 'serif' }}>
//                   University of Science and Technology of Southern Philippines
//                 </div>
//                 <div style={{ fontSize: '10px', color: '#555', marginBottom: '-8px', fontFamily: 'serif' }}>
//                   Alubijid | Balubal |Cagayan de Oro City | Claveria | Jasaan | Oroquieta | Panaon | Villanueva
//                 </div>
//                 <div style={{ fontSize: '14px', color: '#333', marginBottom: '-8px', fontFamily: 'serif' }}>
//                   {(() => {
//                     const selected = examPeriods.find(
//                       (ep) => ep.examperiod_id === parseInt(formData.examperiod_id)
//                     );
//                     if (!selected) return null;

//                     const matchingGroup = examPeriods.filter(
//                       (ep) =>
//                         ep.academic_year === selected.academic_year &&
//                         ep.exam_category === selected.exam_category &&
//                         ep.term.term_name === selected.term.term_name &&
//                         ep.college_id === selected.college_id
//                     );

//                     const sortedDates = matchingGroup
//                       .map((ep) => ({
//                         start: new Date(ep.start_date),
//                         end: new Date(ep.end_date),
//                       }))
//                       .sort((a, b) => a.start.getTime() - b.start.getTime());

//                     const formatShortDate = (date: Date) =>
//                       date.toLocaleDateString('en-US', {
//                         month: 'short',
//                         day: 'numeric',
//                         year: 'numeric',
//                       });

//                     const earliest = sortedDates[0];
//                     const latest = sortedDates[sortedDates.length - 1];

//                     return (
//                       <>
//                         <div style={{ fontSize: '20px', color: '#333', marginBottom: '-8px' , fontFamily: 'serif' }}>{selected.college?.college_name || 'College Name'}</div>
//                         <div><strong>{selected.exam_category} Examination Schedule | {selected.term?.term_name} S.Y. {selected.academic_year}</strong></div>
//                         <div>{formatShortDate(earliest.start)} – {formatShortDate(latest.end)}</div>
//                       </>
//                     );
//                   })()}
//                 </div>
//               </div>

//               {roomPages.length > 0 && roomPages[page] ? (
//                 <>
//                   <table>
//                     <thead>
//                       {/* Exam Date Row */}
//                       <tr>
//                         <th></th>
//                         <th colSpan={roomPages[page].length} style={{ textAlign: 'center' }}>
//                           {formData.exam_date
//                             ? new Date(formData.exam_date).toLocaleDateString('en-US', {
//                                 weekday: 'long',
//                                 year: 'numeric',
//                                 month: 'long',
//                                 day: 'numeric',
//                               })
//                             : 'Date: N/A'}
//                         </th>
//                       </tr>

//                       {/* Building Groups Row */}
//                       <tr>
//                         <th></th>
//                         {(() => {
//                           const buildingGroups: Record<string, typeof scheduledRooms> = {};

//                           // Group rooms by building
//                           roomPages[page].forEach((room) => {
//                             const buildingId = room.building?.building_id || "unknown";
//                             if (!buildingGroups[buildingId]) buildingGroups[buildingId] = [];
//                             buildingGroups[buildingId].push(room);
//                           });

//                           // Helper: parse room_id into numeric building + room
//                           const parseRoom = (id: string) => {
//                             const [building, room] = id.split("-").map(Number);
//                             return { building, room };
//                           };

//                           // Sort buildings by building name (optional)
//                           return Object.entries(buildingGroups)
//                             .sort((a, b) => {
//                               const nameA = a[1][0]?.building?.building_name || "";
//                               const nameB = b[1][0]?.building?.building_name || "";
//                               return nameA.localeCompare(nameB);
//                             })
//                             .map(([buildingId, roomsInBuilding]) => {
//                               // Sort rooms numerically
//                               roomsInBuilding.sort((a, b) => {
//                                 const A = parseRoom(a.room_id || "0-0");
//                                 const B = parseRoom(b.room_id || "0-0");
//                                 if (A.building !== B.building) return A.building - B.building;
//                                 return A.room - B.room;
//                               });

//                               return (
//                                 <th
//                                   key={buildingId}
//                                   colSpan={roomsInBuilding.length}
//                                   style={{ textAlign: "center" }}
//                                 >
//                                   {roomsInBuilding[0].building?.building_name || "Unknown"} (
//                                   {buildingId})
//                                 </th>
//                               );
//                             });
//                         })()}
//                       </tr>

//                       {/* Room IDs Row */}
//                       <tr>
//                         <th>Time</th>
//                         {(() => {
//                           // Flatten + sort all rooms on this page
//                           const sortedRooms = [...roomPages[page]].sort((a, b) => {
//                             const parseRoom = (id: string) => {
//                               const [building, room] = id.split("-").map(Number);
//                               return { building, room };
//                             };
//                             const A = parseRoom(a.room_id || "0-0");
//                             const B = parseRoom(b.room_id || "0-0");
//                             if (A.building !== B.building) return A.building - B.building;
//                             return A.room - B.room;
//                           });

//                           return sortedRooms.map((room) => (
//                             <th key={room.room_id}>{room.room_id}</th>
//                           ));
//                         })()}
//                       </tr>
//                     </thead>

//                     <tbody>
//                       {(() => {
//                         const cellOccupied: Record<string, boolean> = {};
//                         const formatTime12Hour = (date: Date) =>
//                           date.toLocaleTimeString("en-US", {
//                             hour: "numeric",
//                             minute: "2-digit",
//                             hour12: true,
//                           });

//                         const times = [
//                           "07:30","08:00","08:30","09:00","09:30","10:00","10:30","11:00","11:30",
//                           "12:00","12:30","13:00","13:30","14:00","14:30","15:00","15:30","16:00",
//                           "16:30","17:00","17:30","18:00","18:30","19:00","19:30","20:00","20:30"
//                         ];

//                         // Helper to parse room_id for sorting
//                         const parseRoom = (id: string) => {
//                           const [building, room] = id.split("-").map(Number);
//                           return { building, room };
//                         };

//                         // Sort rooms once for this page
//                         const sortedRooms = [...roomPages[page]].sort((a, b) => {
//                           const A = parseRoom(a.room_id || "0-0");
//                           const B = parseRoom(b.room_id || "0-0");
//                           if (A.building !== B.building) return A.building - B.building;
//                           return A.room - B.room;
//                         });

//                         return times.map((start, rowIdx) => {
//                           const currentSlot = new Date(`2023-01-01T${start}:00`);
//                           const end = new Date(currentSlot.getTime() + 30 * 60000);

//                           return (
//                             <tr key={rowIdx}>
//                               <td>{`${formatTime12Hour(currentSlot)} - ${formatTime12Hour(end)}`}</td>
//                               {sortedRooms.map((room) => {
//                                 const cellKey = `${room.room_id}-${rowIdx}`;
//                                 if (cellOccupied[cellKey]) return null;

//                                 const matchingDetails = examDetails.filter((ed) => {
//                                   const edStart = new Date(ed.exam_start_time);
//                                   return (
//                                     ed.room_id === room.room_id &&
//                                     edStart.toTimeString().slice(0, 5) === currentSlot.toTimeString().slice(0, 5) &&
//                                     edStart.toDateString() === new Date(formData.exam_date).toDateString()
//                                   );
//                                 });

//                                 if (matchingDetails.length === 0) {
//                                   return (
//                                     <td
//                                       key={cellKey}
//                                       style={{
//                                         minHeight: "28px",
//                                         border: "1px solid #ccc",
//                                         backgroundColor: "#fff",
//                                       }}
//                                     />
//                                   );
//                                 }

//                                 const edStart = new Date(matchingDetails[0].exam_start_time);
//                                 const edEnd = new Date(matchingDetails[0].exam_end_time);
//                                 const durationMinutes = (edEnd.getTime() - edStart.getTime()) / (1000 * 60);
//                                 const rowSpan = Math.ceil(durationMinutes / 30);

//                                 for (let i = 1; i < rowSpan; i++) {
//                                   cellOccupied[`${room.room_id}-${rowIdx + i}`] = true;
//                                 }

//                                 return (
//                                   <td
//                                     key={cellKey}
//                                     rowSpan={rowSpan}
//                                     style={{
//                                       verticalAlign: "top",
//                                       padding: "3px",
//                                       minHeight: `${rowSpan * 28}px`,
//                                       backgroundColor: "#f9f9f9",
//                                       border: "1px solid #ccc",
//                                     }}
//                                   >
//                                     {matchingDetails.map((detail, idx) => {
//                                       const edStart = new Date(detail.exam_start_time);

//                                       // Compute available rooms dynamically for swapping
//                                       const availableRooms: string[] = examDetails
//                                         .filter((ed) => {
//                                           const sameTime = new Date(ed.exam_start_time).getTime() === edStart.getTime();
//                                           const sameCourse = ed.course_id === detail.course_id;
//                                           const sameProgram = ed.program_id === detail.program_id;
//                                           const sameYear = getYearLevelForModality(ed as any) === getYearLevelForModality(detail as any);
//                                           return sameTime && sameCourse && sameProgram && sameYear && ed.room_id !== detail.room_id;
//                                         })
//                                         .map((ed) => ed.room_id);

//                                      const courseColor = (courseId: string) => {
//                                         const colors = [
//                                           "#ffcccc","#ccffcc","#ccccff","#fff0b3","#d9b3ff",
//                                           "#ffb3b3","#b3e0ff","#ffd9b3","#c2f0c2","#f0b3ff",
//                                           "#ffe0cc","#e0ffcc","#cce0ff","#f0fff0","#ffe6f0",
//                                           "#ffd9b3","#b3ffd9","#d9b3ff","#ffb3d9","#b3d9ff",
//                                           "#e6ffe6","#ffe6e6","#e6e6ff","#fff0e6","#f0e6ff",
//                                           "#ccffeb","#ffccf2","#ccf2ff","#f2ffcc","#f2ccff",
//                                           "#e6ffcc","#cce6ff","#ffe6cc","#ccffe6","#e6ccff",
//                                           "#ffd1b3","#b3ffd1","#d1b3ff","#ffb3d1","#b3d1ff",
//                                           "#ffe0b3","#b3ffe0","#e0b3ff","#ffb3e0","#b3e0ff",
//                                           "#f0ffe6","#e6f0ff","#fff0cc","#ccfff0","#f0ccff",
//                                           "#ffe6f0","#f0ffe6","#e6f0ff","#ccffe6","#e6ccff",
//                                           "#ffccb3","#b3ffcc","#ccb3ff","#ffb3cc","#b3ccff",
//                                           "#ffd1cc","#ccd1ff","#ffccd1","#d1ffcc","#ccffd1",
//                                           "#e6ffd9","#d9e6ff","#ffe6d9","#d9ffe6","#e6d9ff",
//                                           "#f0d9ff","#d9fff0","#ffd9f0","#d9f0ff","#f0ffd9",
//                                           "#ccf2d9","#d9ccf2","#f2d9cc","#ccf2f0","#f0ccf2"
//                                         ];
//                                         const hash = [...courseId].reduce((acc, char) => acc + char.charCodeAt(0), 0);
//                                         return colors[hash % colors.length];
//                                       };

//                                       return (
//                                         <div
//                                           key={idx}
//                                           style={{
//                                             height: "150px",
//                                             display: "flex",
//                                             flexDirection: "column",
//                                             justifyContent: "space-between",
//                                             backgroundColor: courseColor(detail.course_id),
//                                             border: "1px solid #888",
//                                             padding: "3px",
//                                             fontSize: "12px",
//                                             borderRadius: "6px",
//                                             lineHeight: "1.4",
//                                             color: "#333",
//                                             boxSizing: "border-box",
//                                             marginBottom: "0px",
//                                           }}
//                                         >
//                                           <div>
//                                             <strong></strong>
//                                           </div>

//                                           <div>
//                                             {" "}
//                                             {isReassigning ? ( // <-- show dropdown only when reassigning
//                                               <select
//                                                 className="custom-select"
//                                                 value={detail.room_id}
//                                                 onChange={async (e) => {
//                                                   const newRoomId = e.target.value;
//                                                   if (!availableRooms.includes(newRoomId)) return;

//                                                   const swapDetail = examDetails.find(
//                                                     (ed) =>
//                                                       ed.room_id === newRoomId &&
//                                                       new Date(ed.exam_start_time).getTime() === new Date(detail.exam_start_time).getTime() &&
//                                                       ed.course_id === detail.course_id &&
//                                                       ed.program_id === detail.program_id &&
//                                                       getYearLevelForModality(ed as any) === getYearLevelForModality(detail as any)
//                                                   );
//                                                   if (!swapDetail) return;

//                                                   // Update the local state first
//                                                   setExamDetails((prev) =>
//                                                     prev.map((ed) => {
//                                                       if (ed.examdetails_id === detail.examdetails_id) return { ...ed, room_id: newRoomId };
//                                                       if (ed.examdetails_id === swapDetail.examdetails_id) return { ...ed, room_id: detail.room_id };
//                                                       return ed;
//                                                     })
//                                                   );

//                                                   // ✅ Update in api using .update() instead of .upsert()
//                                                   const { error: error1 } = await api
//                                                     .from("tbl_examdetails")
//                                                     .update({ room_id: newRoomId })
//                                                     .eq("examdetails_id", detail.examdetails_id);

//                                                   const { error: error2 } = await api
//                                                     .from("tbl_examdetails")
//                                                     .update({ room_id: detail.room_id })
//                                                     .eq("examdetails_id", swapDetail.examdetails_id);

//                                                   if (error1 || error2) toast.error("Failed to swap rooms: " + (error1?.message || error2?.message));
//                                                   else toast.success("Rooms swapped successfully!");
//                                                 }}
//                                               >
//                                                 <option value={detail.room_id}>{detail.room_id}</option>
//                                                 {availableRooms.map((rId: string) => (
//                                                   <option key={rId} value={rId}>{rId}</option>
//                                                 ))}
//                                               </select>
//                                             ) : (
//                                               <strong></strong> // show room as text when not reassigning
//                                             )}
//                                           </div>

//                                           <div><strong>{detail.course_id}</strong></div>
//                                           <div><strong>{detail.section_name ?? "—"}</strong></div>
//                                           <div><strong>Instructor: {getInstructorName(detail.course_id, detail.program_id)}</strong></div>

//                                           <div>
//                                             <strong>Proctor:</strong>{" "}
//                                             {isReassigning ? (
//                                               <select
//                                                 className="custom-select"
//                                                 value={selectedProctors[detail.examdetails_id] || detail.user_id || ""}
//                                                 onChange={(e) =>
//                                                   setSelectedProctors((prev) => ({
//                                                     ...prev,
//                                                     [detail.examdetails_id]: e.target.value,
//                                                   }))
//                                                 }
//                                               >
//                                                 <option value="">Select Proctor</option>
//                                                 {(() => {
//                                                   const sectionInstructorId = sectionCourses.find(
//                                                     (s) =>
//                                                       s.course_id === detail.course_id &&
//                                                       s.program_id === detail.program_id &&
//                                                       s.section_name?.trim().toLowerCase() === detail.section_name?.trim().toLowerCase()
//                                                   )?.user_id;

//                                                   const candidates = instructors.filter(
//                                                     (instr) =>
//                                                       sectionCourses.some(
//                                                         (s) =>
//                                                           s.course_id === detail.course_id &&
//                                                           s.program_id === detail.program_id &&
//                                                           s.user_id === instr.user_id
//                                                       ) &&
//                                                       instr.user_id !== sectionInstructorId
//                                                   );

//                                                   return (
//                                                     <>
//                                                       {candidates.map((instr) => (
//                                                         <option key={instr.user_id} value={instr.user_id}>
//                                                           {instr.first_name} {instr.last_name}
//                                                         </option>
//                                                       ))}
//                                                       {candidates.length === 0 && sectionInstructorId && (
//                                                         <option value={sectionInstructorId}>
//                                                           {instructors.find((i) => i.user_id === sectionInstructorId)?.first_name}{" "}
//                                                           {instructors.find((i) => i.user_id === sectionInstructorId)?.last_name} (Own Section)
//                                                         </option>
//                                                       )}
//                                                     </>
//                                                   );
//                                                 })()}
//                                               </select>
//                                             ) : (
//                                               (() => {
//                                                 const proctor =
//                                                   instructors.find((p) => String(p.user_id) === String(detail.user_id)) ||
//                                                   instructors.find((instr) =>
//                                                     sectionCourses.some(
//                                                       (s) =>
//                                                         s.course_id === detail.course_id &&
//                                                         s.program_id === detail.program_id &&
//                                                         s.user_id === instr.user_id
//                                                     )
//                                                   );
//                                                 return proctor ? `${proctor.first_name} ${proctor.last_name}` : "No proctor";
//                                               })()
//                                             )}
//                                           </div>

//                                           <div style={{ fontSize: "11px", marginTop: "4px", fontStyle: "italic" }}>
//                                             {formatTime12Hour(new Date(detail.exam_start_time))} -{" "}
//                                             {formatTime12Hour(new Date(detail.exam_end_time))}
//                                           </div>
//                                         </div>
//                                       );
//                                     })}
//                                   </td>
//                                 );
//                               })}
//                             </tr>
//                           );
//                         });
//                       })()}
//                     </tbody>
//                   </table>
//                   <div className="pagination-container">
//                     {/* Previous Button */}
//                     <button
//                       type="button"
//                       onClick={() => setPage((p) => Math.max(p - 1, 0))}
//                       disabled={page === 0}
//                       className={`pagination-btn ${page === 0 ? "disabled" : ""}`}
//                     >
//                       <FaChevronLeft className="icon" />
//                     </button>

//                     {/* Page Info */}
//                     <span className="pagination-info">
//                       Page {page + 1} of {totalPages}
//                     </span>

//                     {/* Next Button */}
//                     <button
//                       type="button"
//                       onClick={() => setPage((p) => Math.min(p + 1, totalPages - 1))}
//                       disabled={page === totalPages - 1}
//                       className={`pagination-btn ${page === totalPages - 1 ? "disabled" : ""}`}
//                     >
//                       <FaChevronRight className="icon" />
//                     </button>
//                   </div>
//                 </>
//               ) : (
//                 <div style={{ textAlign: "center", marginTop: "20px", color: '#000000ff'}}>
//                   No schedules available or select a day period to view or generate schedules.
//                 </div>
//               )}
//             </div>
//           </div>
//         </div>
//       )}
//       <ToastContainer position="top-right" autoClose={3000} />
//     </div>
//   );
// };

// export default Scheduler_PlotSchedule;