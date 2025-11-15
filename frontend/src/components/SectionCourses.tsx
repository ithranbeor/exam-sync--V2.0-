// deno-lint-ignore-file no-explicit-any
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { FaTrash, FaEdit, FaSearch, FaDownload } from 'react-icons/fa';
import { api } from '../lib/apiClient.ts';
import { ToastContainer, toast } from 'react-toastify';
import * as XLSX from 'xlsx';
import 'react-toastify/dist/ReactToastify.css';
import '../styles/colleges.css';
import Select from 'react-select';

interface Course {
  course_id: string;
  course_name: string;
}

interface Program {
  program_id: string;
  program_name: string;
}

interface Term {
  term_id: number;
  term_name: string;
  tbl_examperiod?: {
    academic_year: string;
  };
}

interface User {
  user_id: number;
  full_name: string;
}

interface SectionCourse {
  id?: number;
  course: Course;
  program: Program;
  term: Term;
  user?: User;
  course_id: string;
  program_id: string;
  term_id: number;
  user_id?: number;
  section_name: string;
  number_of_students: number;
  year_level: string;
}

const SectionCourses: React.FC = () => {
  const [sectionCourses, setSectionCourses] = useState<SectionCourse[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [courseInstructorsMap, setCourseInstructorsMap] = useState<Record<string, User[]>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [isImporting, setIsImporting] = useState(false);
  const itemsPerPage = 20;

  const [newSection, setNewSection] = useState<SectionCourse>({
    course_id: '',
    program_id: '',
    term_id: 0,
    section_name: '',
    number_of_students: 0,
    year_level: '',
  } as SectionCourse);

  // Memoized sorted options for selects
  const sortedCourses = useMemo(() => 
    [...courses].sort((a, b) => a.course_id.localeCompare(b.course_id)),
    [courses]
  );

  const sortedPrograms = useMemo(() => 
    [...programs].sort((a, b) => a.program_name.localeCompare(b.program_name)),
    [programs]
  );

  const courseOptions = useMemo(() => 
    sortedCourses.map(c => ({
      value: c.course_id,
      label: `${c.course_id} (${c.course_name})`
    })),
    [sortedCourses]
  );

  const programOptions = useMemo(() => 
    sortedPrograms.map(p => ({
      value: p.program_id,
      label: `${p.program_id} (${p.program_name})`
    })),
    [sortedPrograms]
  );

  const instructorOptions = useMemo(() => {
    const instructors = courseInstructorsMap[newSection.course_id] || [];
    return instructors
      .sort((a, b) => a.full_name.localeCompare(b.full_name))
      .map(u => ({
        value: u.user_id,
        label: u.full_name
      }));
  }, [courseInstructorsMap, newSection.course_id]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [secRes, courseRes, progRes, termRes, courseUserRes] = await Promise.all([
        api.get('/tbl_sectioncourse/'),
        api.get('/courses/'),
        api.get('/programs/'),
        api.get('/tbl_term'),
        api.get('/tbl_course_users/')
      ]);

      const secData = secRes.data || [];
      const courseData = courseRes.data || [];
      const progData = progRes.data || [];
      const termData = termRes.data || [];
      const courseUserData = courseUserRes.data || [];

      setSectionCourses(secData);
      setCourses(courseData);
      setPrograms(progData);

      const mappedTerms = termData.map((t: any) => ({
        ...t,
        tbl_examperiod: {
          academic_year: Array.isArray(t.tbl_examperiod) && t.tbl_examperiod.length > 0
            ? t.tbl_examperiod[0].academic_year
            : 'N/A'
        }
      }));
      setTerms(mappedTerms);

      const instructorMap: Record<string, User[]> = {};
      courseUserData.forEach((row: any) => {
        if (!row.tbl_users) return;
        const user: User = {
          user_id: row.tbl_users.user_id,
          full_name: row.tbl_users.full_name || `${row.tbl_users.first_name} ${row.tbl_users.last_name}`
        };
        const courseId = row.course?.course_id || row.course_id;
        if (!courseId) return;
        if (!instructorMap[courseId]) instructorMap[courseId] = [];
        instructorMap[courseId].push(user);
      });
      setCourseInstructorsMap(instructorMap);

    } catch (_error) {
      toast.error('Error fetching data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { 
    fetchAll(); 
  }, [fetchAll]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const handleSubmit = async () => {
    const { course_id, program_id, section_name, number_of_students, year_level, term_id, user_id } = newSection;

    if (!course_id || !program_id || !section_name || !number_of_students || !year_level || !term_id || !user_id) {
      toast.error('All fields including instructor are required');
      return;
    }

    const payload = {
      course_id,
      program_id,
      term_id,
      user_id,
      section_name,
      number_of_students,
      year_level,
    };

    setIsSubmitting(true);
    try {
      if (editMode) {
        const { status } = await api.put(`/tbl_sectioncourse/${newSection.id}/`, payload);
        if (status === 200) toast.success('Section updated');
        else toast.error('Failed to update section');
      } else {
        const { status } = await api.post(`/tbl_sectioncourse/`, payload);
        if (status === 201) toast.success('Section added');
        else toast.error('Failed to add section');
      }
    } catch (_error) {
      toast.error('Request failed.');
    } finally {
      setShowModal(false);
      setIsSubmitting(false);
      fetchAll();
    }
  };

  const handleDelete = async (sc: SectionCourse) => {
    try {
      const { status } = await api.delete(`/tbl_sectioncourse/${sc.id}/`);
      if (status === 200) toast.success('Section deleted');
      else toast.error('Failed to delete section');
    } catch (_error) {
      toast.error('Error deleting section');
    } finally {
      fetchAll();
    }
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt: ProgressEvent<FileReader>) => {
      setIsImporting(true);
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows: Record<string, string | number>[] = XLSX.utils.sheet_to_json(sheet);

        const validRows: SectionCourse[] = [];
        for (const row of rows) {
          const section_name = String(row['Section Name'] || '').trim();
          const number_of_students = parseInt(String(row['Number of Students'] || '0'));
          const year_level = String(row['Year Level'] || '').trim();
          const term_name = String(row['Term Name'] || '').trim();
          const course_id = String(row['Course ID'] || '').trim();
          const program_id = String(row['Program ID'] || '').trim();
          const instructor_name = String(row['Instructor Name'] || '').trim();

          if (!section_name || !number_of_students || !year_level || !term_name || !course_id || !program_id || !instructor_name)
            continue;

          const term = terms.find(t => t.term_name === term_name);
          const user = (courseInstructorsMap[course_id] || []).find(u => u.full_name.toLowerCase() === instructor_name.toLowerCase());
          if (!term || !user) continue;

          validRows.push({
            course_id, program_id, section_name, number_of_students, year_level,
            term_id: term.term_id, user_id: user.user_id
          } as SectionCourse);
        }

        let added = 0;
        const batchSize = 10;
        for (let i = 0; i < validRows.length; i += batchSize) {
          const batch = validRows.slice(i, i + batchSize);
          const results = await Promise.allSettled(batch.map(payload => api.post('/tbl_sectioncourse/', payload)));
          added += results.filter(r => r.status === 'fulfilled' && (r.value.status === 200 || r.value.status === 201)).length;
        }

        toast.success(`Import completed: ${added} section(s) added`);
        fetchAll();
      } catch {
        toast.error('Error reading or importing file');
      } finally {
        setShowImport(false);
        setIsImporting(false);
      }
    };

    reader.readAsArrayBuffer(file);
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['Course ID','Program ID','Section Name','Number of Students','Year Level','Term Name','Instructor Name'],
      ['IT 112','BSIT','IT 1R1','30','1st Year','1st Semester','Ithran Beor Turno']
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'SectionCourses Template');
    XLSX.writeFile(wb, 'sectioncourses_template.xlsx');
  };

  const filtered = useMemo(() => {
    if (!searchTerm) return sectionCourses;
    
    const lowerSearch = searchTerm.toLowerCase();
    return sectionCourses.filter(sc => {
      const termName = sc.term?.term_name || '';
      const courseName = sc.course?.course_name || '';
      const programName = sc.program?.program_name || '';
      const instructor = sc.user?.full_name || '';
      return (
        sc.section_name.toLowerCase().includes(lowerSearch) ||
        courseName.toLowerCase().includes(lowerSearch) ||
        programName.toLowerCase().includes(lowerSearch) ||
        instructor.toLowerCase().includes(lowerSearch) ||
        termName.toLowerCase().includes(lowerSearch)
      );
    });
  }, [searchTerm, sectionCourses]);

  const paginated = useMemo(() => {
    const sorted = [...filtered].sort((a, b) => a.section_name.localeCompare(b.section_name));
    return sorted.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  }, [filtered, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage);

  return (
    <div className="colleges-container">
      <div className="colleges-header">
        <h2 className="colleges-title">Section Courses</h2>
        <div className="search-bar">
          <input
            type="text"
            placeholder="Search Section Name"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button type='button' className="search-button"><FaSearch /></button>
        </div>
      </div>

      <div className="colleges-actions">
        <button type='button' className="action-button add-new" onClick={() => {
          setEditMode(false);
          setNewSection({
            course_id: '',
            program_id: '',
            section_name: '',
            number_of_students: 0,
            year_level: '',
            term_id: 0,
          } as SectionCourse);
          setShowModal(true);
        }}>
          Add New Section
        </button>
        <button type='button' className="action-button import" onClick={() => setShowImport(true)}>Import Sections</button>
      </div>

      <div className="pagination-controls">
        <button type='button'
          onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
          disabled={currentPage === 1}
        >
          ←
        </button>
        <span>Page {currentPage} of {totalPages}</span>
        <button type='button'
          onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
          disabled={currentPage === totalPages}
        >
           →
        </button>
      </div>

      <div className="colleges-table-container">
        <table className="colleges-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Course</th>
              <th>Program</th>
              <th>Section</th>
              <th>Students</th>
              <th>Year</th>
              <th>Term</th>
              <th>Instructor</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: '20px' }}>
                  Loading sections with courses...
                </td>
              </tr>
            ) : paginated.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: '20px' }}>
                  No sections with courses.
                </td>
              </tr>
            ) : (
              paginated.map((sc, i) => (
                <tr key={sc.id || i}>
                  <td>{(currentPage - 1) * itemsPerPage + i + 1}</td>
                  <td>{sc.course?.course_name || sc.course_id}</td>
                  <td>{sc.program?.program_name || sc.program_id}</td>
                  <td>{sc.section_name}</td>
                  <td>{sc.number_of_students}</td>
                  <td>{sc.year_level}</td>
                  <td>{sc.term?.term_name || 'N/A'}</td>
                  <td>{sc.user?.full_name || 'N/A'}</td>
                  <td className="action-buttons">
                    <button
                      type="button"
                      className="icon-button edit-button"
                      onClick={() => {
                        setEditMode(true);
                        setNewSection({
                          ...sc,
                          course_id: sc.course?.course_id || sc.course_id,
                          program_id: sc.program?.program_id || sc.program_id,
                          term_id: sc.term?.term_id || sc.term_id,
                          user_id: sc.user?.user_id || sc.user_id,
                        });
                        setShowModal(true);
                      }}
                    >
                      <FaEdit />
                    </button>
                    <button
                      type="button"
                      className="icon-button delete-button"
                      onClick={() => handleDelete(sc)}
                    >
                      <FaTrash />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3 style={{ textAlign: 'center' }}>
              {editMode ? 'Edit Section' : 'Add New Section'}
            </h3>

            <div className="input-group">
              <label>Course</label>
              {editMode ? (
                <div className="text-value">
                  {newSection.course_id} (
                  {courses.find(c => c.course_id === newSection.course_id)?.course_name || 'N/A'}
                  )
                </div>
              ) : (
                <Select
                  className="custom-select"
                  classNamePrefix="custom"
                  options={courseOptions}
                  value={courseOptions.find(opt => opt.value === newSection.course_id) || null}
                  onChange={(selected) =>
                    setNewSection({
                      ...newSection,
                      course_id: selected?.value || '',
                      user_id: undefined
                    })
                  }
                  placeholder="Select Course"
                />
              )}
            </div>

            <div className="input-group">
              <label>Program</label>
              {editMode ? (
                <div className="text-value">
                  {newSection.program_id} (
                  {programs.find(p => p.program_id === newSection.program_id)?.program_name || 'N/A'}
                  )
                </div>
              ) : (
                <Select
                  className="custom-select"
                  classNamePrefix="custom"
                  options={programOptions}
                  value={programOptions.find(opt => opt.value === newSection.program_id) || null}
                  onChange={(selected) =>
                    setNewSection({
                      ...newSection,
                      program_id: selected?.value || ''
                    })
                  }
                  placeholder="Select Program"
                />
              )}
            </div>

            <div className="input-group">
              <label>Section Name</label>
              <input
                type="text"
                value={newSection.section_name}
                onChange={(e) =>
                  setNewSection({ ...newSection, section_name: e.target.value })
                }
                placeholder="Enter section name"
              />
            </div>

            <div className="input-group">
              <label>Number of Students</label>
              <input
                type="number"
                value={newSection.number_of_students || ''}
                onChange={(e) =>
                  setNewSection({
                    ...newSection,
                    number_of_students: parseInt(e.target.value) || 0
                  })
                }
                placeholder="e.g., 40"
              />
            </div>

            <div className="input-group">
              <label>Year Level</label>
              <select
                value={newSection.year_level}
                onChange={(e) =>
                  setNewSection({ ...newSection, year_level: e.target.value })
                }
              >
                <option value="">Select Year</option>
                <option value="1st Year">1st Year</option>
                <option value="2nd Year">2nd Year</option>
                <option value="3rd Year">3rd Year</option>
                <option value="4th Year">4th Year</option>
              </select>
            </div>

            <div className="input-group">
              <label>Term</label>
              <select
                value={newSection.term_id || ''}
                onChange={(e) =>
                  setNewSection({
                    ...newSection,
                    term_id: parseInt(e.target.value) || 0
                  })
                }
              >
                <option value="">Select Term</option>
                {terms.map(t => (
                  <option key={t.term_id} value={t.term_id}>
                    {t.term_name} ({t.tbl_examperiod?.academic_year || 'N/A'})
                  </option>
                ))}
              </select>
            </div>

            <div className="input-group">
              <label>Instructor</label>
              <Select
                className="custom-select"
                classNamePrefix="custom"
                options={instructorOptions}
                value={instructorOptions.find(opt => opt.value === newSection.user_id) || null}
                onChange={(selected) =>
                  setNewSection({
                    ...newSection,
                    user_id: selected?.value
                  })
                }
                placeholder="Select Instructor"
                menuPlacement="top"
              />
            </div>

            <div className="modal-actions">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Saving...' : 'Save'}
              </button>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                disabled={isSubmitting}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showImport && (
        <div className="modal-overlay">
          <div className="modal">
            <h3 style={{ textAlign: "center" }}>Import Section Courses</h3>
            <p style={{ fontSize: '12px', color: '#666', marginBottom: '10px' }}>
              Each section must belong to an existing course, program, term, and have an assigned instructor.
            </p>

            <input type="file" accept=".xlsx,.xls" onChange={handleImportFile} disabled={isImporting} />

            <button
              type="button"
              className="modal-button download"
              onClick={downloadTemplate}
              disabled={isImporting}
            >
              <FaDownload style={{ marginRight: 5 }} /> Download Template
            </button>

            <div className="modal-actions">
              <button type="button" onClick={() => setShowImport(false)} disabled={isImporting}>
                {isImporting ? "Importing…" : "Close"}
              </button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer position="top-right" autoClose={3000} />
    </div>
  );
};

export default SectionCourses;