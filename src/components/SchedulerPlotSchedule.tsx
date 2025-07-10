import React, { useState, useEffect } from 'react';
import { FaTrash, FaEdit, FaEye, FaSearch } from 'react-icons/fa';
import { supabase } from '../lib/supabaseClient.ts';
import '../styles/plotschedule.css';

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
  room_id: string;
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
}

interface Program {
  program_id: string;
  program_name: string;
}

interface Room {
  room_id: string;
  room_name: string;
}

interface Modality {
  modality_id: number;
  modality_type: string;
}

interface ExamPeriod {
  examperiod_id: number;
  start_date: string;
  end_date: string;
  academic_year: string;
  exam_category: string;
  term: {
    term_name: string;
  };
  college_id?: string;
  college_name?: string;
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
  const [examDetails, setExamDetails] = useState<any[]>([]);
  
  const [formData, setFormData] = useState({
    course_id: '',
    program_id: '',
    modality_id: '',
    examperiod_id: '',
    hours: 1,
    minutes: 30,
    proctor_all: true,
    exam_date: '',
    proctor_filter: 'available_only',
  });

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
        .eq('status', 'available');

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
        supabase.from('tbl_rooms').select('room_id, room_name'),
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
          section_name,
          user_id
        `)
        .eq('user_id', userMeta.user_id),
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
      if (roomRes.data) setRooms(roomRes.data);
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
          college_name: ep.college?.college_name || 'N/A'
        }));

        setExamPeriods(fixed);
      }
    };

    fetchInitialData();
  }, []);

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
        .filter((c) => c !== null) as {
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

  const handleGenerateSave = async () => {
    if (!userId) return;

    if (
      !formData.course_id ||
      !formData.program_id ||
      !formData.modality_id ||
      !formData.examperiod_id ||
      !formData.exam_date
    ) {
      alert('Please complete all required fields before saving.');
      return;
    }

    const selectedMod = modalities.find(
      (m) => m.modality_id === parseInt(formData.modality_id)
    );

    if (!selectedMod) {
      alert('Selected modality is invalid.');
      return;
    }

    const selectedExamPeriod = examPeriods.find(
      (ep) => ep.examperiod_id === parseInt(formData.examperiod_id)
    );

    if (!selectedExamPeriod) {
      alert('❌ Exam period not found.');
      return;
    }

    const examStartBase = new Date(selectedExamPeriod.start_date);
    examStartBase.setHours(7, 30, 0, 0);

    const durationMinutes = formData.hours * 60 + formData.minutes;
    const examEndTime = new Date(examStartBase.getTime() + durationMinutes * 60000);

    const pad = (n: number) => String(n).padStart(2, '0');
    const intervalString = `${pad(formData.hours)}:${pad(formData.minutes)}:00`;

    const formatDate = (dateStr: string) =>
      new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });

    const examPeriodRange = `${formatDate(selectedExamPeriod.start_date)} – ${formatDate(
      selectedExamPeriod.end_date
    )}`;

    const matchingModalities = modalities.filter(
      (m) =>
        m.modality_type === selectedMod.modality_type &&
        m.course_id === selectedMod.course_id &&
        m.program_id === selectedMod.program_id
    );

    const inserts = matchingModalities.map((modality) => ({
      course_id: modality.course_id,
      program_id: modality.program_id,
      room_id: modality.room_id,
      modality_id: modality.modality_id,
      user_id: parseInt(userId),
      examperiod_id: parseInt(formData.examperiod_id),
      exam_duration: intervalString,
      exam_start_time: examStartBase.toISOString(),
      exam_end_time: examEndTime.toISOString(),
      proctor_timein: null,
      proctor_timeout: null,
      section_name: modality.section_name,

      academic_year: selectedExamPeriod.academic_year,
      semester: selectedExamPeriod.term?.term_name || 'N/A',
      exam_category: selectedExamPeriod.exam_category,
      exam_period: examPeriodRange,
      exam_date: formData.exam_date,
    }));

    const { error } = await supabase.from('tbl_examdetails').insert(inserts);

    if (error) {
      console.error('Insert error:', error.message);
      alert('Failed to save schedule. Please check console for details.');
    } else {
      alert('Schedule saved successfully!');
      setShowPlot(false);

      const { data: updatedExamDetails } = await supabase
        .from('tbl_examdetails')
        .select('*')
        .eq('examperiod_id', formData.examperiod_id);

      setExamDetails(updatedExamDetails || []);
    }
  };

  return (
    <div className="colleges-container">
      {!showPlot ? (
        <>
          <div className="colleges-header">
            <h2 className="colleges-title">Manage Schedule</h2>
            <div className="search-bar">
              <input type="text" placeholder="Search for Schedule" />
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
                  <th>Start Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>1</td>
                  <td>2025-05-23</td>
                  <td className="action-buttons">
                    <button type="button" className="icon-button view-button">
                      <FaEye />
                    </button>
                    <button type="button" className="icon-button edit-button">
                      <FaEdit />
                    </button>
                    <button type="button" className="icon-button delete-button">
                      <FaTrash />
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="save-changes-footer">
            <button type="button" className="action-button save-changes">
              Save Changes
            </button>
          </div>
        </>
      ) : (
        <div className="plot-schedule" style={{ display: 'flex', gap: '20px' }}>
          <div className="plot-controls" style={{ flex: 1 }}>
            <h3>Add Schedule</h3>

            <div className="form-group">
              <label>Exam Period</label>
              <select name="examperiod_id" value={formData.examperiod_id} onChange={handleChange}>
                <option value="">-- Select Period --</option>
                {examPeriods.map((e) => (
                  <option key={e.examperiod_id + e.start_date} value={e.examperiod_id}>
                    SY {e.academic_year} | {e.term.term_name} | {e.exam_category} | {e.college_id} | {new Date(e.start_date).toLocaleDateString('en-US', {
                      month: 'short', day: '2-digit', year: 'numeric'
                    })}
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
                  <ul>
                    {modalities
                      .filter(
                        (m) =>
                          m.modality_type === selectedModality.modality_type &&
                          m.course_id === selectedModality.course_id &&
                          m.program_id === selectedModality.program_id
                      )
                      .map((m, idx) => (
                        <li key={idx}>
                          <strong>{m.section_name}</strong> — 
                          Room: <strong>{rooms.find(r => r.room_id === m.room_id)?.room_name || m.room_id}</strong>, 
                          Room Type: <strong>{m.room_type}</strong>, 
                          Course: <strong>{m.course_id}</strong>, 
                          Program: <strong>{m.program_id}</strong>, 
                          Remarks: <strong>{m.modality_remarks || 'None'}</strong>
                        </li>
                      ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="form-group">
              <label>Proctors</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
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
                hrs
                <input
                  type="number"
                  name="minutes"
                  value={formData.minutes}
                  onChange={handleChange}
                  min="0"
                  max="59"
                />
                mins
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

            <div style={{ marginTop: '20px' }}>
              <button
                type="button"
                onClick={() => setShowPlot(false)}
                className="action-button"
                style={{ backgroundColor: '#ccc', color: '#000', marginRight: '10px' }}
              >
                Back
              </button>
              <button type="button" className="action-button" onClick={handleGenerateSave}>
                Generate / Save
              </button>
            </div>
          </div>

          <div className="plot-grid" style={{ flex: 2 }}>
            {formData.examperiod_id && (
              <div style={{ marginBottom: '10px', fontWeight: 'bold', lineHeight: '1.8', color: '#333' }}>
                {(() => {
                  const selected = examPeriods.find(
                    (ep) => ep.examperiod_id === parseInt(formData.examperiod_id)
                  );
                  if (!selected) return null;

                  const matchingGroup = examPeriods.filter((ep) =>
                    ep.academic_year === selected.academic_year &&
                    ep.exam_category === selected.exam_category &&
                    ep.term.term_name === selected.term.term_name &&
                    ep.college_id === selected.college_id
                  );

                  const sortedDates = matchingGroup
                    .map(ep => ({
                      start: new Date(ep.start_date),
                      end: new Date(ep.end_date)
                    }))
                    .sort((a, b) => a.start.getTime() - b.start.getTime());

                  const formatDate = (date: Date) =>
                    date.toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    });

                  const earliest = sortedDates[0];
                  const latest = sortedDates[sortedDates.length - 1];

                  return (
                    <>
                      School Year: {selected.academic_year} {selected.term?.term_name}
                      <br />
                      Exam: {selected.exam_category}
                      <br />
                      Exam Period: {formatDate(earliest.start)} – {formatDate(latest.end)}
                      <br />
                      Date: {formData.exam_date ? formatDate(new Date(formData.exam_date)) : 'N/A'}
                    </>
                  );
                })()}
              </div>
            )}

            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  {rooms.map((room) => (
                    <th key={room.room_id}>
                      {room.room_id} {room.room_name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const cellOccupied: Record<string, boolean> = {};

                  const formatTime12Hour = (date: Date) =>
                    date.toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit',
                      hour12: true,
                    });

                  return [
                    '07:30', '08:00', '08:30', '09:00', '09:30', '10:00',
                    '10:30', '11:00', '11:30', '12:00', '12:30', '13:00',
                    '13:30', '14:00', '14:30', '15:00', '15:30', '16:00',
                    '16:30', '17:00', '17:30', '18:00', '18:30', '19:00',
                    '19:30', '20:00', '20:30'
                  ].map((start, rowIdx) => {
                    const currentSlot = new Date(`2023-01-01T${start}:00`);
                    const end = new Date(currentSlot);
                    end.setMinutes(end.getMinutes() + 30);

                    return (
                      <tr key={rowIdx}>
                        <td>
                          {formatTime12Hour(currentSlot)} - {formatTime12Hour(end)}
                        </td>
                        {rooms.map((room) => {
                          const cellKey = `${room.room_id}-${rowIdx}`;
                          if (cellOccupied[cellKey]) return null;

                          const matchingDetails = examDetails.filter((ed) => {
                            const edStart = new Date(ed.exam_start_time);
                            return (
                              ed.room_id === room.room_id &&
                              edStart.toTimeString().slice(0, 5) === currentSlot.toTimeString().slice(0, 5) &&
                              new Date(edStart).toDateString() === new Date(formData.exam_date).toDateString()
                            );
                          });

                          if (matchingDetails.length > 0) {
                            const edStart = new Date(matchingDetails[0].exam_start_time);
                            const edEnd = new Date(matchingDetails[0].exam_end_time);
                            const durationMinutes = (edEnd.getTime() - edStart.getTime()) / (1000 * 60);
                            const rowSpan = Math.ceil(durationMinutes / 30);

                            for (let i = 1; i < rowSpan; i++) {
                              cellOccupied[`${room.room_id}-${rowIdx + i}`] = true;
                            }

                            const courseColor = (courseId: string): string => {
                              const colors = [
                                '#ffcccc', '#ccffcc', '#ccccff', '#fff0b3', '#d9b3ff',
                                '#ffb3b3', '#b3e0ff', '#ffd9b3', '#c2f0c2', '#f0b3ff'
                              ];
                              const hash = [...courseId].reduce((acc, char) => acc + char.charCodeAt(0), 0);
                              return colors[hash % colors.length];
                            };

                            return (
                              <td
                                key={cellKey}
                                rowSpan={rowSpan}
                                style={{
                                  verticalAlign: 'top',
                                  padding: '5px',
                                  minHeight: `${rowSpan * 28}px`,
                                  backgroundColor: '#f9f9f9',
                                  border: '1px solid #ccc',
                                }}
                              >
                                {matchingDetails.map((detail, idx) => (
                                  <div
                                    key={idx}
                                    style={{
                                      backgroundColor: courseColor(detail.course_id),
                                      border: '1px solid #888',
                                      padding: '5px',
                                      fontSize: '12px',
                                      borderRadius: '4px',
                                      marginBottom: '6px',
                                      lineHeight: '1.4',
                                    }}
                                  >
                                    <div><strong>Course:</strong> {detail.course_id}</div>
                                    <div><strong>Section:</strong> {detail.section_name ?? '—'}</div>
                                    <div><strong>Proctor/s:</strong> {detail.user_id}</div>
                                    <div style={{ fontSize: '11px', marginTop: '4px', fontStyle: 'italic' }}>
                                      {formatTime12Hour(new Date(detail.exam_start_time))} - {formatTime12Hour(new Date(detail.exam_end_time))}
                                    </div>
                                  </div>
                                ))}
                              </td>
                            );
                          }

                          return <td key={cellKey} />;
                        })}
                      </tr>
                    );
                  });
                })()}
              </tbody>

            </table>

            <div className="plot-footer" style={{ marginTop: '20px', textAlign: 'right' }}>
              <button type="button" className="action-button save-changes" style={{ marginRight: '10px' }}>
                Save and Export
              </button>
              <button type="button" className="action-button save-changes">
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Scheduler_PlotSchedule;