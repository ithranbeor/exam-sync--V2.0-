// deno-lint-ignore-file no-explicit-any
import React, { useState, useEffect } from 'react';
import { FaTrash, FaEdit, FaSearch, FaDownload } from 'react-icons/fa';
import { supabase } from '../lib/supabaseClient.ts';
import { ToastContainer, toast } from 'react-toastify';
import * as XLSX from 'xlsx';
import 'react-toastify/dist/ReactToastify.css';
import '../styles/colleges.css';
import { useRef } from 'react';
import Select from 'react-select';

interface Term {
  term_id: number;
  term_name: string;
  tbl_examperiod?: {
    academic_year: string;
  };
}

interface User {
  user_id: number;
  first_name: string;
  last_name: string;
}

interface Course {
  course_id: string;
  course_name: string;
  term_id: number;
  term_name?: string;
  instructor_names?: string[];
  user_ids?: number[];
}

const Courses: React.FC = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [newCourse, setNewCourse] = useState({
    course_id: '',
    course_name: '',
    term_id: 0,
    user_ids: [] as number[]
  });
  const [editMode, setEditMode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [instructorSearch, setInstructorSearch] = useState('');

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    fetchCourses();
    fetchTerms();
    fetchUsers();
  }, []);

  const fetchCourses = async () => {
    const { data, error } = await supabase
      .from('tbl_course')
      .select(`
        course_id,
        course_name,
        term_id,
        tbl_term ( term_name, tbl_examperiod ( academic_year ) ),
        tbl_course_users ( user_id, tbl_users ( first_name, last_name ) )
      `);

    if (error) {
      toast.error('Failed to fetch courses');
      return;
    }

    const mapped = data.map((course: any) => {
      const term = course.tbl_term;
      const academicYear = Array.isArray(term?.tbl_examperiod) && term.tbl_examperiod.length > 0
        ? term.tbl_examperiod[0].academic_year
        : 'N/A';

      const instructors = course.tbl_course_users?.map((cu: any) =>
        `${cu.tbl_users.first_name} ${cu.tbl_users.last_name}`
      );

      const userIds = course.tbl_course_users?.map((cu: any) => cu.user_id);

      return {
        ...course,
        term_name: `${term?.term_name || 'N/A'} (${academicYear})`,
        instructor_names: instructors,
        user_ids: userIds
      };
    });

    setCourses(mapped);
  };

  const fetchTerms = async () => {
    const { data } = await supabase
      .from('tbl_term')
      .select('term_id, term_name, tbl_examperiod ( academic_year )');
    if (!data) return;

    const mapped = data.map((term: any) => {
      const academicYear = Array.isArray(term.tbl_examperiod) && term.tbl_examperiod.length > 0
        ? term.tbl_examperiod[0].academic_year
        : 'N/A';
      return {
        ...term,
        tbl_examperiod: { academic_year: academicYear },
      };
    });

    setTerms(mapped);
  };

  const fetchUsers = async () => {
    const { data } = await supabase.from('tbl_users').select('user_id, first_name, last_name');
    if (data) setUsers(data);
  };

  const handleSubmit = async () => {
    const { course_id, course_name, term_id, user_ids } = newCourse;
    if (!course_id || !course_name || !term_id || user_ids.length === 0) {
      toast.error('All fields are required.');
      return;
    }

    setIsSubmitting(true);

    if (editMode) {
      await supabase.from('tbl_course').update({ course_name, term_id }).eq('course_id', course_id);
      await supabase.from('tbl_course_users').delete().eq('course_id', course_id);
      for (const uid of user_ids) {
        await supabase.from('tbl_course_users').insert({ course_id, user_id: uid });
      }
      toast.success('Course updated');
    } else {
      await supabase.from('tbl_course').insert({ course_id, course_name, term_id });
      for (const uid of user_ids) {
        await supabase.from('tbl_course_users').insert({ course_id, user_id: uid });
      }
      toast.success('Course added');
    }

    fetchCourses();
    setShowModal(false);
    setIsSubmitting(false);
  };

  const handleDelete = async (id: string) => {
    await supabase.from('tbl_course').delete().eq('course_id', id);
    toast.success('Course deleted');
    fetchCourses();
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws);

      let successCount = 0;

      for (const row of data as any[]) {
        const course_id = row['Course ID']?.trim();
        const course_name = row['Course Name']?.trim();
        const term_full = row['Term Name (Academic Year)']?.trim();
        const instructors_raw = row['Instructor Full Names']?.trim();

        const [termName, year] = term_full?.split(' (') || [];
        const academic_year = year?.replace(')', '');

        const term = terms.find(t => t.term_name === termName && t.tbl_examperiod?.academic_year === academic_year);
        const instructorNames = instructors_raw?.split(',').map((n: string) => n.trim());

        const instructorIds = users.filter(u => instructorNames.includes(`${u.first_name} ${u.last_name}`)).map(u => u.user_id);

        if (!course_id || !course_name || !term || instructorIds.length === 0) continue;

        await supabase.from('tbl_course').insert({ course_id, course_name, term_id: term.term_id });
        for (const uid of instructorIds) {
          await supabase.from('tbl_course_users').insert({ course_id, user_id: uid });
        }

        successCount++;
      }

      toast.success(`Import complete: ${successCount} courses added`);
      fetchCourses();
      setShowImport(false);
    };

    reader.readAsBinaryString(file);
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['Course ID', 'Course Name', 'Term Name (Academic Year)', 'Instructor Full Names'],
      ['IT112', 'Computer Programming 1', '1st Semester (2024-2025)', 'Juan Dela Cruz, Maria Santos']
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, 'courses_template.xlsx');
  };

  const filteredCourses = courses.filter(c =>
    c.course_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.course_id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="colleges-container">
      <div className="colleges-header">
        <h2 className="colleges-title">Manage Courses</h2>
        <div className="search-bar">
          <input type="text" placeholder="Search" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          <button type="button" className="search-button"><FaSearch /></button>
        </div>
      </div>

      <div className="colleges-actions">
        <button type="button" className="action-button add-new" onClick={() => {
          setNewCourse({ course_id: '', course_name: '', term_id: 0, user_ids: [] });
          setEditMode(false);
          setShowModal(true);
        }}>Add Course</button>
        <button type="button" className="action-button import" onClick={() => setShowImport(true)}>Import Courses</button>
        <button type="button" className="action-button download" onClick={downloadTemplate}><FaDownload /> Download Template</button>
      </div>

      <div className="colleges-table-container">
        <table className="colleges-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Course Code</th>
              <th>Course Name</th>
              <th>Term</th>
              <th>Instructors</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredCourses.map((c, i) => (
              <tr key={c.course_id}>
                <td>{i + 1}</td>
                <td>{c.course_id}</td>
                <td>{c.course_name}</td>
                <td>{c.term_name}</td>
                <td>{c.instructor_names?.join(', ')}</td>
                <td className="action-buttons">
                  <button type="button" className="icon-button edit-button" onClick={() => {
                    setNewCourse({
                      course_id: c.course_id,
                      course_name: c.course_name,
                      term_id: c.term_id,
                      user_ids: c.user_ids || []
                    });
                    setEditMode(true);
                    setShowModal(true);
                  }}><FaEdit /></button>
                  <button type="button" className="icon-button delete-button" onClick={() => handleDelete(c.course_id)}><FaTrash /></button>
                </td>
              </tr>
            ))}
            {filteredCourses.length === 0 && <tr><td colSpan={6}>No courses found.</td></tr>}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3 style={{ textAlign: 'center' }}>{editMode ? 'Edit Course' : 'Add Course'}</h3>
            <div className="input-group">
              <label>Course Code</label>
              <input type="text" value={newCourse.course_id} disabled={editMode}
                     onChange={(e) => setNewCourse({ ...newCourse, course_id: e.target.value })} />
            </div>
            <div className="input-group">
              <label>Course Name</label>
              <input type="text" value={newCourse.course_name}
                     onChange={(e) => setNewCourse({ ...newCourse, course_name: e.target.value })} />
            </div>
            <div className="input-group">
              <label>Term</label>
              <select value={newCourse.term_id}
                      onChange={(e) => setNewCourse({ ...newCourse, term_id: parseInt(e.target.value) })}>
                <option value="">Select Term</option>
                {terms.map(t => (
                  <option key={t.term_id} value={t.term_id}>
                    {t.term_name} ({t.tbl_examperiod?.academic_year})
                  </option>
                ))}
              </select>
            </div>
            <div className="input-group">
              <label>Instructors</label>
              <Select
                isMulti
                className="custom-select"
                classNamePrefix="custom"
                options={users
                  .sort((a, b) => a.first_name.localeCompare(b.first_name))
                  .map(user => ({
                    value: user.user_id,
                    label: `${user.first_name} ${user.last_name}`,
                  }))
                }
                value={users
                  .filter(user => newCourse.user_ids.includes(user.user_id))
                  .map(user => ({
                    value: user.user_id,
                    label: `${user.first_name} ${user.last_name}`,
                  }))
                }
                onChange={(selectedOptions) => {
                  const selectedIds = selectedOptions.map(option => option.value);
                  setNewCourse({ ...newCourse, user_ids: selectedIds });
                }}
                placeholder="Select instructors..."
              />
            </div>
            <div className="modal-actions">
              <button type="button" onClick={handleSubmit} disabled={isSubmitting}>{isSubmitting ? 'Saving...' : 'Save'}</button>
              <button type="button" onClick={() => setShowModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showImport && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Import Courses</h3>
            <input type="file" accept=".xlsx,.xls" onChange={handleImport} />
            <div className="modal-actions">
              <button type="button" onClick={() => setShowImport(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer position="top-right" autoClose={3000} />
    </div>
  );
};

export default Courses;