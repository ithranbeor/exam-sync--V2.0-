// deno-lint-ignore-file no-explicit-any
import React, { useState, useEffect } from 'react';
import { FaTrash, FaEdit, FaSearch, FaDownload } from 'react-icons/fa';
import { supabase } from '../lib/supabaseClient.ts';
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
  course_id: string;
  program_id: string;
  section_name: string;
  number_of_students: number;
  year_level: string;
  term_id: number;
  user_id?: number;
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
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const [newSection, setNewSection] = useState<SectionCourse>({
    course_id: '',
    program_id: '',
    section_name: '',
    number_of_students: 0,
    year_level: '',
    term_id: 0,
    user_id: undefined,
  });

  useEffect(() => { 
    fetchAll(); 
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, sectionCourses]);

  const fetchAll = async () => {
    const [
      { data: secData, error: secError },
      { data: courseData, error: courseError },
      { data: progData, error: progError },
      { data: termData, error: termError },
      { data: courseUserData, error: courseUserError }
    ] = await Promise.all([
      supabase
        .from('tbl_sectioncourse')
        .select('course_id, program_id, section_name, number_of_students, year_level, term_id, user_id'),
      supabase
        .from('tbl_course')
        .select('course_id, course_name'),
      supabase
        .from('tbl_program')
        .select('program_id, program_name'),
      supabase
        .from('tbl_term')
        .select('term_id, term_name, tbl_examperiod(academic_year)'),
      supabase
        .from('tbl_course_users')
        .select('course_id, user_id, tbl_users(first_name, last_name)'),
    ]);

    if (secError || courseError || progError || termError || courseUserError) {
      console.error('Failed to fetch some data');
      toast.error('Error fetching initial data.');
      return;
    }

    setSectionCourses(secData || []);
    setCourses(courseData || []);
    setPrograms(progData || []);

    if (termData) {
      const mapped = termData.map((t: any) => ({
        ...t,
        tbl_examperiod: {
          academic_year: Array.isArray(t.tbl_examperiod) && t.tbl_examperiod.length > 0
            ? t.tbl_examperiod[0].academic_year
            : 'N/A'
        }
      }));
      setTerms(mapped);
    }

    if (courseUserData) {
      const map: Record<string, User[]> = {};
      courseUserData.forEach((row: any) => {
        const user: User = {
          user_id: row.user_id,
          full_name: `${row.tbl_users.first_name} ${row.tbl_users.last_name}`,
        };
        if (!map[row.course_id]) map[row.course_id] = [];
        map[row.course_id].push(user);
      });
      setCourseInstructorsMap(map);
    }
  };

  const handleSubmit = async () => {
    const { course_id, program_id, section_name, number_of_students, year_level, term_id, user_id } = newSection;

    if (!course_id || !program_id || !section_name || !number_of_students || !year_level || !term_id || !user_id) {
      toast.error('All fields including instructor are required');
      return;
    }

    const validInstructor = courseInstructorsMap[course_id]?.some(u => u.user_id === user_id);
    if (!validInstructor) {
      toast.error('Selected instructor is not assigned to this course');
      return;
    }

    setIsSubmitting(true);

    if (editMode) {
      const { error } = await supabase
        .from('tbl_sectioncourse')
        .update({ number_of_students, year_level, term_id, user_id })
        .match({ course_id, program_id, section_name, term_id });

      if (error) {
        toast.error(`Update failed: ${error.message}`);
      } else {
        toast.success('Section updated');
      }
    } else {
      const { error } = await supabase.from('tbl_sectioncourse').insert([newSection]);
      if (error) {
        toast.error(`Insert failed: ${error.message}`);
      } else {
        toast.success('Section added');
      }
    }

    setShowModal(false);
    setIsSubmitting(false);
    fetchAll();
  };

  const handleDelete = async (sc: SectionCourse) => {
    const { error } = await supabase
      .from('tbl_sectioncourse')
      .delete()
      .match({
        course_id: sc.course_id,
        program_id: sc.program_id,
        section_name: sc.section_name,
        term_id: sc.term_id,
      });

    toast[error ? 'error' : 'success'](error ? 'Failed to delete section' : 'Section deleted');
    fetchAll();
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt: any) => {
      const data = new Uint8Array(evt.target.result);
      const wb = XLSX.read(data, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(sheet);

      let added = 0;

      for (const row of rows) {
        const section_name = row['Section Name']?.trim();
        const number_of_students = parseInt(row['Number of Students'] || 0);
        const year_level = row['Year Level']?.trim();
        const term_name = row['Term Name']?.trim();
        const course_id = row['Course ID']?.trim();
        const program_id = row['Program ID']?.trim();
        const instructor_name = row['Instructor Name']?.trim();

        if (!section_name || !number_of_students || !year_level || !term_name || !course_id || !program_id || !instructor_name) continue;

        const term = terms.find(t => t.term_name === term_name);
        if (!term) continue;

        const user = (courseInstructorsMap[course_id] || []).find(
          u => u.full_name.toLowerCase() === instructor_name.toLowerCase()
        );

        if (!user) continue;

        const { error } = await supabase.from('tbl_sectioncourse').insert([{
          course_id,
          program_id,
          section_name,
          number_of_students,
          year_level,
          term_id: term.term_id,
          user_id: user.user_id,
        }]);

        if (!error) added++;
      }

      toast.success(`Import completed: ${added} section(s) added`);
      fetchAll();
      setShowImport(false);
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

  const filtered = sectionCourses.filter(sc =>
    sc.section_name.toLowerCase().includes(searchTerm.toLowerCase())
    || sc.course_id.toLowerCase().includes(searchTerm.toLowerCase())
    || sc.program_id.toLowerCase().includes(searchTerm.toLowerCase())
    || sc.year_level.toLowerCase().includes(searchTerm.toLowerCase())
    || terms.find(t => t.term_id === sc.term_id)?.term_name.toLowerCase().includes(searchTerm.toLowerCase())
    || (courseInstructorsMap[sc.course_id] || []).some(u => u.full_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).sort((a, b) => a.section_name.localeCompare(b.section_name));


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
            user_id: undefined,
          });
          setShowModal(true);
        }}>
          Add New Section
        </button>
        <button type='button' className="action-button import" onClick={() => setShowImport(true)}>Import Sections</button>
        <button type='button' className="action-button download" onClick={downloadTemplate}>
          <FaDownload style={{ marginRight: 5 }} /> Download Template
        </button>
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
            {paginated.map((sc, i) => (
              <tr key={`${sc.course_id}-${sc.program_id}-${sc.section_name}-${sc.term_id}`}>
                <td>{(currentPage - 1) * itemsPerPage + i + 1}</td>
                <td>{sc.course_id}</td>
                <td>{sc.program_id}</td>
                <td>{sc.section_name}</td>
                <td>{sc.number_of_students}</td>
                <td>{sc.year_level}</td>
                <td>{terms.find(t => t.term_id === sc.term_id)?.term_name || 'N/A'}</td>
                <td>{courseInstructorsMap[sc.course_id]?.find(u => u.user_id === sc.user_id)?.full_name || 'N/A'}</td>
                <td className="action-buttons">
                  <button type='button' className="icon-button edit-button" onClick={() => {
                    setEditMode(true);
                    setNewSection(sc);
                    setShowModal(true);
                  }}>
                    <FaEdit />
                  </button>
                  <button type='button' className="icon-button delete-button" onClick={() => handleDelete(sc)}>
                    <FaTrash />
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={9}>No section courses found.</td></tr>}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3 style={{ textAlign: 'center' }}>
              {editMode ? 'Edit Section' : 'Add New Section'}
            </h3>

            {/* Course Selection */}
            <div className="input-group">
              <label>Course</label>
              {editMode ? (
                <div className="text-value">
                  {newSection.course_id} ({courses.find(c => c.course_id === newSection.course_id)?.course_name || 'N/A'})
                </div>
              ) : (
                <Select
                  className="custom-select"
                  classNamePrefix="custom"
                  options={courses
                    .sort((a, b) => a.course_id.localeCompare(b.course_id))
                    .map(c => ({
                      value: c.course_id,
                      label: `${c.course_id} (${c.course_name})`
                    }))}
                  value={courses.find(c => c.course_id === newSection.course_id)
                    ? {
                        value: newSection.course_id,
                        label: `${newSection.course_id} (${courses.find(c => c.course_id === newSection.course_id)?.course_name})`
                      }
                    : null}
                  onChange={(selected) =>
                    setNewSection({
                      ...newSection,
                      course_id: selected?.value || '',
                      user_id: undefined // Reset instructor on course change
                    })
                  }
                  placeholder="Select Course"
                />
              )}
            </div>

            {/* Program Selection */}
            <div className="input-group">
              <label>Program</label>
              {editMode ? (
                <div className="text-value">
                  {newSection.program_id} ({programs.find(p => p.program_id === newSection.program_id)?.program_name || 'N/A'})
                </div>
              ) : (
                <Select
                  className="custom-select"
                  classNamePrefix="custom"
                  options={programs
                    .sort((a, b) => a.program_name.localeCompare(b.program_name))
                    .map(p => ({
                      value: p.program_id,
                      label: `${p.program_id} (${p.program_name})`
                    }))}
                  value={programs.find(p => p.program_id === newSection.program_id)
                    ? {
                        value: newSection.program_id,
                        label: `${newSection.program_id} (${programs.find(p => p.program_id === newSection.program_id)?.program_name})`
                      }
                    : null}
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

            {/* Section Name */}
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

            {/* Number of Students */}
            <div className="input-group">
              <label>Number of Students</label>
              <input
                type="number"
                value={newSection.number_of_students}
                onChange={(e) =>
                  setNewSection({
                    ...newSection,
                    number_of_students: parseInt(e.target.value) || 0
                  })
                }
                placeholder="e.g., 40"
              />
            </div>

            {/* Year Level */}
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

            {/* Term */}
            <div className="input-group">
              <label>Term</label>
              <select
                value={newSection.term_id}
                onChange={(e) =>
                  setNewSection({
                    ...newSection,
                    term_id: parseInt(e.target.value)
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

            {/* Instructor */}
            <div className="input-group">
              <label>Instructor</label>
              <Select
                className="custom-select"
                classNamePrefix="custom"
                options={(courseInstructorsMap[newSection.course_id] || [])
                  .sort((a, b) => a.full_name.localeCompare(b.full_name))
                  .map(u => ({
                    value: u.user_id,
                    label: u.full_name
                  }))}
                value={
                  (courseInstructorsMap[newSection.course_id] || []).find(
                    u => u.user_id === newSection.user_id
                  )
                    ? {
                        value: newSection.user_id!,
                        label: courseInstructorsMap[newSection.course_id]?.find(
                          u => u.user_id === newSection.user_id
                        )?.full_name || ''
                      }
                    : null
                }
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

            {/* Action Buttons */}
            <div className="modal-actions">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Saving...' : 'Save'}
              </button>
              <button type="button" onClick={() => setShowModal(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showImport && (
        <div className="modal-overlay">
          <div className="modal">
            <h3 style={{ textAlign: 'center' }}>Import Section Courses</h3>
            <input type="file" accept=".xlsx,.xls" onChange={handleImportFile} />
            <div className="modal-actions">
              <button type='button' onClick={() => setShowImport(false)}>Done</button>
              <button type='button' onClick={() => setShowImport(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer position="top-right" autoClose={3000} />
    </div>
  );
};

export default SectionCourses;
