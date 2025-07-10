// deno-lint-ignore-file no-explicit-any
import React, { useState, useEffect } from 'react';
import { FaTrash, FaEdit, FaSearch, FaDownload } from 'react-icons/fa';
import { supabase } from '../lib/supabaseClient.ts';
import { ToastContainer, toast } from 'react-toastify';
import * as XLSX from 'xlsx';
import 'react-toastify/dist/ReactToastify.css';
import '../styles/colleges.css';

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

  const [newSection, setNewSection] = useState<SectionCourse>({
    course_id: '',
    program_id: '',
    section_name: '',
    number_of_students: 0,
    year_level: '',
    term_id: 0,
    user_id: undefined,
  });

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    const [secData, courseData, progData, termData, courseUserData] = await Promise.all([
      supabase.from('tbl_sectioncourse').select('*'),
      supabase.from('tbl_course').select('course_id, course_name'),
      supabase.from('tbl_program').select('program_id, program_name'),
      supabase.from('tbl_term').select(`term_id, term_name, tbl_examperiod ( academic_year )`),
      supabase.from('tbl_course_users').select('course_id, user_id, tbl_users ( first_name, last_name )'),
    ]);

    if (secData.data) setSectionCourses(secData.data);
    if (courseData.data) setCourses(courseData.data);
    if (progData.data) setPrograms(progData.data);

    if (termData.data) {
      const mapped = termData.data.map((t: any) => {
        const academicYear = Array.isArray(t.tbl_examperiod) && t.tbl_examperiod.length > 0
          ? t.tbl_examperiod[0].academic_year
          : 'N/A';
        return { ...t, tbl_examperiod: { academic_year: academicYear } };
      });
      setTerms(mapped);
    }

    if (courseUserData.data) {
      const map: Record<string, User[]> = {};
      courseUserData.data.forEach((row: any) => {
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
        const num_students = parseInt(row['Number of Students'] || 0);
        const year_level = row['Year Level']?.trim();
        const term_name = row['Term Name']?.trim();
        const course_id = row['Course ID']?.trim();
        const program_id = row['Program ID']?.trim();
        const user_id = parseInt(row['User ID']);

        if (!section_name || !num_students || !year_level || !term_name || !course_id || !program_id || !user_id) continue;

        const term = terms.find(t => t.term_name === term_name);
        const validInstructor = courseInstructorsMap[course_id]?.some(u => u.user_id === user_id);

        if (!term || !validInstructor) continue;

        const { error } = await supabase.from('tbl_sectioncourse').insert([{
          course_id,
          program_id,
          section_name,
          number_of_students: num_students,
          year_level,
          term_id: term.term_id,
          user_id,
        }]);

        if (!error) added++;
      }

      toast.success(`Import completed: ${added} section(s) added`);
      fetchAll(); setShowImport(false);
    };
    reader.readAsArrayBuffer(file);
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['Course ID','Program ID','Section Name','Number of Students','Year Level','Term Name','User ID'],
      ['IT 112','BSIT','IT 1R1','30','1st Year','1st Semester','123']
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'SectionCourses Template');
    XLSX.writeFile(wb, 'sectioncourses_template.xlsx');
  };

  const filtered = sectionCourses.filter(sc =>
    sc.section_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
            {filtered.map((sc, i) => (
              <tr key={`${sc.course_id}-${sc.program_id}-${sc.section_name}-${sc.term_id}`}>
                <td>{i + 1}</td>
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
                  }}><FaEdit /></button>
                  <button type='button' className="icon-button delete-button" onClick={() => handleDelete(sc)}><FaTrash /></button>
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
            <h3 style={{ textAlign: 'center' }}>{editMode ? 'Edit Section' : 'Add New Section'}</h3>
            <div className="input-group">
              <label>Course</label>
              <select value={newSection.course_id} disabled={editMode}
                onChange={(e) => setNewSection({ ...newSection, course_id: e.target.value, user_id: undefined })}
              >
                <option value="">Select Course</option>
                {courses.map(c => (
                  <option key={c.course_id} value={c.course_id}>
                    {c.course_id} ({c.course_name})
                  </option>
                ))}
              </select>
            </div>
            <div className="input-group">
              <label>Program</label>
              <select value={newSection.program_id} disabled={editMode}
                onChange={(e) => setNewSection({ ...newSection, program_id: e.target.value })}
              >
                <option value="">Select Program</option>
                {programs.map(p => (
                  <option key={p.program_id} value={p.program_id}>
                    {p.program_id} ({p.program_name})
                  </option>
                ))}
              </select>
            </div>
            <div className="input-group">
              <label>Section Name</label>
              <input type="text" value={newSection.section_name}
                onChange={(e) => setNewSection({ ...newSection, section_name: e.target.value })}
              />
            </div>
            <div className="input-group">
              <label>Number of Students</label>
              <input type="number" value={newSection.number_of_students}
                onChange={(e) => setNewSection({ ...newSection, number_of_students: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div className="input-group">
              <label>Year Level</label>
              <select value={newSection.year_level}
                onChange={(e) => setNewSection({ ...newSection, year_level: e.target.value })}
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
              <select value={newSection.term_id}
                onChange={(e) => setNewSection({ ...newSection, term_id: parseInt(e.target.value) })}
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
              <select value={newSection.user_id || ''}
                onChange={(e) => setNewSection({ ...newSection, user_id: parseInt(e.target.value) })}
              >
                <option value="">Select Instructor</option>
                {(courseInstructorsMap[newSection.course_id] || []).map(u => (
                  <option key={u.user_id} value={u.user_id}>{u.full_name}</option>
                ))}
              </select>
            </div>
            <div className="modal-actions">
              <button type='button' onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : 'Save'}
              </button>
              <button type='button' onClick={() => setShowModal(false)}>Cancel</button>
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
