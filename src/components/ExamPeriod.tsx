// deno-lint-ignore-file no-explicit-any
import React, { useEffect, useState } from 'react';
import { FaTrash, FaEdit, FaDownload, FaSearch, FaCalendarAlt } from 'react-icons/fa';
import { supabase } from '../lib/supabaseClient.ts';
import * as XLSX from 'xlsx';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import '../styles/colleges.css';

interface ExamPeriod {
  examperiod_id?: number;
  start_date: string;
  end_date: string;
  academic_year: string;
  exam_category: string;
  term_id: number;
  department_id?: string | null;
  college_id?: string | null;
}


interface Term { term_id: number; term_name: string; }
interface Department { department_id: string; department_name: string; }
interface College { college_id: string; college_name: string; }

const academicYears = ['2024-2025', '2025-2026', '2026-2027', '2027-2028', '2028-2029'];
const examCategories = ['Preliminary', 'Midterm', 'Pre-Final', 'Final'];

const ExamPeriod: React.FC = () => {
  const [examPeriods, setExamPeriods] = useState<ExamPeriod[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [colleges, setColleges] = useState<College[]>([]);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filterYear, setFilterYear] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterTerm, setFilterTerm] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterCollege, setFilterCollege] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const [newExam, setNewExam] = useState<ExamPeriod>({
    start_date: '',
    end_date: '',
    academic_year: '',
    exam_category: '',
    term_id: 0,
    department_id: '',
    college_id: '',
  });

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    const [examRes, termRes, deptRes, collegeRes] = await Promise.all([
      supabase.from('tbl_examperiod').select('*'),
      supabase.from('tbl_term').select('*'),
      supabase.from('tbl_department').select('*'),
      supabase.from('tbl_college').select('*'),
    ]);
    if (examRes.data) setExamPeriods(examRes.data);
    if (termRes.data) setTerms(termRes.data);
    if (deptRes.data) setDepartments(deptRes.data);
    if (collegeRes.data) setColleges(collegeRes.data);
  };

  const handleSubmit = async () => {
    const { start_date, end_date, academic_year, exam_category, term_id, department_id, college_id } = newExam;

    if (!start_date || !end_date || !academic_year || !exam_category || !term_id) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);

    const start = new Date(start_date);
    const end = new Date(end_date);
    const dates: string[] = [];

    // Generate all dates from start_date to end_date
    while (start <= end) {
      dates.push(new Date(start).toISOString());
      start.setDate(start.getDate() + 1);
    }

    // Build and insert payloads for each date
    const payloads = dates.map((date) => ({
      start_date: date,
      end_date: date,
      academic_year,
      exam_category,
      term_id,
      department_id: department_id || null,
      college_id: college_id || null,
    }));

    let error = null;

    if (editMode && newExam.examperiod_id) {
      // Only support editing one record in edit mode
      const { error: updateError } = await supabase
        .from('tbl_examperiod')
        .update(payloads[0])
        .eq('examperiod_id', newExam.examperiod_id);
      error = updateError;
    } else {
      const { error: insertError } = await supabase
        .from('tbl_examperiod')
        .insert(payloads);
      error = insertError;
    }

    if (error) {
      toast.error('Failed to save exam period');
    } else {
      toast.success(editMode ? 'Exam period updated' : `Added ${payloads.length} exam date(s)`);
      fetchAll();
    }

    setShowModal(false);
    setIsSubmitting(false);
  };

  const handleDelete = async (id: number) => {
    const { error } = await supabase.from('tbl_examperiod').delete().eq('examperiod_id', id);
    toast[error ? 'error' : 'success'](error ? 'Delete failed' : 'Exam period deleted');
    fetchAll();
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt: any) => {
      const bstr = evt.target.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data: any[] = XLSX.utils.sheet_to_json(ws);

      let added = 0;
      for (const row of data) {
        const term = terms.find(t => t.term_name === row['Term Name']);
        const dept = departments.find(d => d.department_id === row['Department ID']);
        const college = colleges.find(c => c.college_id === row['College ID']);  
        if (!term || !dept || !college) continue;

        const payload = {
          start_date: new Date(row['Start Date']).toISOString(),
          end_date: new Date(row['End Date']).toISOString(),
          academic_year: row['Academic Year'],
          exam_category: row['Exam Category'],
          term_id: term.term_id,
          department_id: dept?.department_id || null,
          college_id: college?.college_id || null,
        };

        const { error } = await supabase.from('tbl_examperiod').insert([payload]);
        if (!error) added++;
      }
      toast.success(`Import successful: ${added} record(s) added`);
      setShowImport(false);
      fetchAll();
    };
    reader.readAsBinaryString(file);
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['Start Date', 'End Date', 'Academic Year', 'Exam Category', 'Term Name', 'Department ID', 'College ID'],
      ['2025-06-01', '2025-06-05', '2025-2026', 'Midterm', '1st Semester', 'DIT', 'CITC']
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'ExamPeriod Template');
    XLSX.writeFile(wb, 'examperiod_template.xlsx');
  };

  const filtered = examPeriods.filter(e =>
    (!search || e.academic_year.toLowerCase().includes(search.toLowerCase())) &&
    (!filterYear || e.academic_year === filterYear) &&
    (!filterCategory || e.exam_category === filterCategory) &&
    (!filterTerm || e.term_id.toString() === filterTerm) &&
    (!filterDept || e.department_id === filterDept) &&
    (!filterCollege || e.college_id === filterCollege) &&
    (e.start_date)
  );

  return (
    <div className="colleges-container">
      <div className="colleges-header">
        <h2 className="colleges-title">Exam Periods</h2>
        <div className="search-bar-container">
          <div className="search-bar" onClick={() => setShowFilters(!showFilters)}>
            <FaSearch className="search-icon" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search exam periods..."
              onFocus={() => setShowFilters(true)}
            />
          </div>

          {showFilters && (
            <div className="advanced-filters">
              <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)}>
                <option value="">All Years</option>
                {academicYears.map(y => <option key={y} value={y}>{y}</option>)}
              </select>

              <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
                <option value="">All Categories</option>
                {examCategories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>

              <select value={filterTerm} onChange={(e) => setFilterTerm(e.target.value)}>
                <option value="">All Terms</option>
                {terms.map(t => <option key={t.term_id} value={t.term_id.toString()}>{t.term_name}</option>)}
              </select>

              <select value={filterDept} onChange={(e) => setFilterDept(e.target.value)}>
                <option value="">All Departments</option>
                {departments.map(d => <option key={d.department_id} value={d.department_id}>{d.department_name}</option>)}
              </select>

              <select value={filterCollege} onChange={(e) => setFilterCollege(e.target.value)}>
                <option value="">All Colleges</option>
                {colleges.map(c => <option key={c.college_id} value={c.college_id}>{c.college_name}</option>)}
              </select>
            </div>
          )}
        </div>
      </div>

      <div className="colleges-actions">
        <button type='button' className="action-button add-new" onClick={() => {
          setEditMode(false);
          setNewExam({
            start_date: '',
            end_date: '',
            academic_year: '',
            exam_category: '',
            term_id: 0,
            department_id: '',
            college_id: '',
          });
          setShowModal(true);
        }}>Add New Period</button>

        <button type='button' className="action-button import" onClick={() => setShowImport(true)}>Import</button>
        <button type='button' className="action-button download" onClick={downloadTemplate}>
          <FaDownload style={{ marginRight: 5 }} />Download Template
        </button>
      </div>

      <div className="colleges-table-container">
        <table className="colleges-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Start</th>
              <th>End</th>
              <th>Academic Year</th>
              <th>Exam Category</th>
              <th>Term</th>
              <th>Department</th>
              <th>College</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((e, i) => (
              <tr key={e.examperiod_id}>
                <td>{i + 1}</td>
                <td>{new Date(e.start_date).toLocaleDateString()}</td>
                <td>{new Date(e.end_date).toLocaleDateString()}</td>
                <td>{e.academic_year}</td>
                <td>{e.exam_category}</td>
                <td>{terms.find(t => t.term_id === e.term_id)?.term_name}</td>
                <td>{e.department_id}</td>
                <td>{e.college_id}</td>
                <td className="action-buttons">
                  <button type='button' className="icon-button edit-button" onClick={() => {
                    setEditMode(true);
                    setNewExam(e);
                    setShowModal(true);
                  }}><FaEdit /></button>
                  <button type='button' className="icon-button delete-button" onClick={() => handleDelete(e.examperiod_id!)}><FaTrash /></button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={9}>No exam periods found</td></tr>}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3 style={{ textAlign: 'center' }}>{editMode ? 'Edit Exam Period' : 'Add Exam Period'}</h3>
            <div className="input-group">
            <label>Start Date</label>
            <div className="date-input-wrapper">
              <input
                type="date"
                value={newExam.start_date}
                onChange={(e) => setNewExam({ ...newExam, start_date: e.target.value })}
              />
              <FaCalendarAlt className="calendar-icon-right" />
            </div>
          </div>

          <div className="input-group">
            <label>End Date</label>
            <div className="date-input-wrapper">
              <input
                type="date"
                value={newExam.end_date}
                onChange={(e) => setNewExam({ ...newExam, end_date: e.target.value })}
              />
              <FaCalendarAlt className="calendar-icon-right" />
            </div>
          </div>
            <div className="input-group">
              <label>Academic Year</label>
              <select value={newExam.academic_year} onChange={(e) => setNewExam({ ...newExam, academic_year: e.target.value })}>
                <option value="">Select Year</option>
                {academicYears.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div className="input-group">
              <label>Exam Category</label>
              <select value={newExam.exam_category} onChange={(e) => setNewExam({ ...newExam, exam_category: e.target.value })}>
                <option value="">Select Category</option>
                {examCategories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="input-group">
              <label>Term</label>
              <select value={newExam.term_id} onChange={(e) => setNewExam({ ...newExam, term_id: parseInt(e.target.value) })}>
                <option value="">Select Term</option>
                {terms.map(t => <option key={t.term_id} value={t.term_id}>{t.term_name}</option>)}
              </select>
            </div>
            <div className="input-group">
              <label>Department</label>
              <select value={newExam.department_id ?? ''} onChange={(e) => setNewExam({ ...newExam, department_id: e.target.value })}>
                <option value="">Select Department</option>
                {departments.map(d => <option key={d.department_id} value={d.department_id}>{d.department_name}</option>)}
              </select>
            </div>
            <div className="input-group">
              <label>College</label>
              <select value={newExam.college_id ?? ''} onChange={(e) => setNewExam({ ...newExam, college_id: e.target.value })}>
                <option value="">Select College</option>
                {colleges.map(c => <option key={c.college_id} value={c.college_id}>{c.college_name}</option>)}
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
            <h3 style={{ textAlign: 'center' }}>Import Exam Periods</h3>
            <input type="file" accept=".xlsx,.xls" onChange={handleImport} />
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

export default ExamPeriod;
