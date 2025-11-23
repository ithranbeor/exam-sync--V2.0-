// deno-lint-ignore-file no-explicit-any
import React, { useEffect, useState, useRef } from 'react';
import { FaTrash, FaEdit, FaSearch,  FaPlus, FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import { api } from '../lib/apiClient.ts';
import * as XLSX from 'xlsx';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import '../styles/colleges.css';
import Select from 'react-select';
import Calendar from 'react-calendar';

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

const ExamPeriodComponent: React.FC = () => {
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
  const [loading, setLoading] = useState(true); // new state
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [selectedExamIds, setSelectedExamIds] = useState<Set<number>>(new Set());
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  const [newExam, setNewExam] = useState<ExamPeriod>({
    start_date: '',
    end_date: '',
    academic_year: '',
    exam_category: '',
    term_id: 0,
    department_id: '',
    college_id: null,
  });

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [examRes, termRes, deptRes, collegeRes] = await Promise.all([
        api.get('/tbl_examperiod'),
        api.get('/tbl_term'),
        api.get('/departments/'),
        api.get('/tbl_college/'),
      ]);
      setExamPeriods(examRes.data);
      setTerms(termRes.data);
      setDepartments(deptRes.data);
      setColleges(collegeRes.data);
    } catch (err) {
      console.error(err);
      toast.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  // keep newExam start/end in sync with selectedDates
  useEffect(() => {
    if (selectedDates.length === 1) {
      setNewExam(prev => ({
        ...prev,
        start_date: toLocalDateString(selectedDates[0]),
        end_date: toLocalDateString(selectedDates[0]),
      }));
    } else if (selectedDates.length > 1) {
      const sorted = [...selectedDates].sort((a, b) => a.getTime() - b.getTime());
      setNewExam(prev => ({
        ...prev,
        start_date: toLocalDateString(sorted[0]),
        end_date: toLocalDateString(sorted[sorted.length - 1]),
      }));
    } else {
      setNewExam(prev => ({ ...prev, start_date: '', end_date: '' }));
    }
  }, [selectedDates]);

  const handleSubmit = async () => {
    const { academic_year, exam_category, term_id, department_id, college_id, examperiod_id } = newExam;

    if (!academic_year || !exam_category || !term_id || selectedDates.length === 0) {
      toast.error('Please fill in all required fields and select at least one date');
      return;
    }

    setIsSubmitting(true);

    const toLocalDateString = (d: Date) => {
      const pad = (n: number) => n.toString().padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    };

    try {
      if (editMode && examperiod_id) {
        // Update mode (single record)
        const payload = {
          start_date: newExam.start_date,
          end_date: newExam.end_date,
          academic_year,
          exam_category,
          term: term_id,
          department: department_id || null,
          college: college_id || null,
        };
        const res = await api.put(`/tbl_examperiod/${examperiod_id}/`, payload);
        toast.success('Exam period updated');
        setExamPeriods(prev =>
          prev.map(ep => (ep.examperiod_id === examperiod_id ? res.data : ep))
        );
      } else {
        // Create multiple — 2 copies per selected day
        const sortedDates = [...selectedDates].sort((a, b) => a.getTime() - b.getTime());
        const newRecords: any[] = [];

        for (const date of sortedDates) {
          const formatted = toLocalDateString(date);
          const payload = {
            start_date: `${formatted}T00:00:00`,
            end_date: `${formatted}T00:00:00`,
            academic_year,
            exam_category,
            term: term_id,
            department: department_id || null,
            college: college_id || null,
          };

          // Create 2 copies for each date
          for (let copy = 0; copy < 2; copy++) {
            try {
              const res = await api.post('/tbl_examperiod', payload);
              newRecords.push(res.data);
            } catch (innerErr: any) {
              console.error('❌ Failed payload:', payload);
              console.error('📩 Error response:', innerErr.response?.data);
            }
          }
        }

        // Update state once with all new records
        if (newRecords.length > 0) {
          setExamPeriods(prev => [...newRecords, ...prev]);
        }

        toast.success(`Successfully added ${newRecords.length} exam period${newRecords.length > 1 ? 's' : ''}`);
      }

      setShowModal(false);
      setSelectedDates([]);
      setSelectedExamIds(new Set());
    } catch (err) {
      console.error(err);
      toast.error('Failed to save exam period');
    } finally {
      setIsSubmitting(false);
    }
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

  useEffect(() => {
    setSelectedExamIds(prev => {
      const validIds = new Set<number>();
      examPeriods.forEach(ep => {
        if (ep.examperiod_id && prev.has(ep.examperiod_id)) {
          validIds.add(ep.examperiod_id);
        }
      });
      return validIds;
    });
  }, [examPeriods]);

  const toggleSelect = (id?: number) => {
    if (!id) return;
    setSelectedExamIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const isAllSelected = (() => {
    const selectable = filtered.filter(ep => typeof ep.examperiod_id === 'number');
    if (selectable.length === 0) return false;
    return selectable.every(ep => ep.examperiod_id && selectedExamIds.has(ep.examperiod_id));
  })();

  const toggleSelectAll = () => {
    const selectable = filtered.filter(ep => typeof ep.examperiod_id === 'number');
    if (selectable.length === 0) return;
    setSelectedExamIds(() => {
      if (isAllSelected) {
        return new Set();
      }
      const next = new Set<number>();
      selectable.forEach(ep => {
        if (ep.examperiod_id) {
          next.add(ep.examperiod_id);
        }
      });
      return next;
    });
  };

  // Handle scroll position and update button states
  useEffect(() => {
    const checkScroll = () => {
      const container = tableContainerRef.current;
      if (!container) return;

      const { scrollLeft, scrollWidth, clientWidth } = container;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1);
      
      // Update scroll indicator classes
      container.classList.toggle('scrollable-left', scrollLeft > 0);
      container.classList.toggle('scrollable-right', scrollLeft < scrollWidth - clientWidth - 1);
    };

    const container = tableContainerRef.current;
    if (container) {
      checkScroll();
      container.addEventListener('scroll', checkScroll);
      window.addEventListener('resize', checkScroll);
    }

    return () => {
      if (container) {
        container.removeEventListener('scroll', checkScroll);
        window.removeEventListener('resize', checkScroll);
      }
    };
  }, [examPeriods, search, filterYear, filterCategory, filterTerm, filterDept, filterCollege, loading]);

  const scrollTable = (direction: 'left' | 'right') => {
    const container = tableContainerRef.current;
    if (!container) return;

    const scrollAmount = container.clientWidth * 0.8;
    const scrollTo = direction === 'left' 
      ? container.scrollLeft - scrollAmount 
      : container.scrollLeft + scrollAmount;
    
    container.scrollTo({
      left: scrollTo,
      behavior: 'smooth'
    });
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
        if (!term) continue;

        const payload = {
          start_date: new Date(row['Start Date']).toISOString(),
          end_date: new Date(row['End Date']).toISOString(),
          academic_year: row['Academic Year'],
          exam_category: row['Exam Category'],
          term_id: term.term_id,
          department_id: dept?.department_id || null,
          college_id: college?.college_id || null,
        };

        try {
          await api.post('/tbl_examperiod', payload);
          added++;
        } catch (err) {
          console.error(err);
        }
      }
      toast.success(`Import successful: ${added} record(s) added`);
      setShowImport(false);
      fetchAll();
    };
    reader.readAsBinaryString(file);
  };

  function toLocalDateString(d: Date): string {
    // Pad month/day
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  return (
    <div className="colleges-container">
      <div className="colleges-header">
        <h2 className="colleges-title">Exam Periods</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="search-bar">
            <input
              type="text"
              placeholder="Search exam periods..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button type="button" className="search-button">
              <FaSearch />
            </button>
          </div>
          <button
            type="button"
            className="action-button"
            style={{ minWidth: 90 }}
            onClick={() => setShowFilters(prev => !prev)}
          >
            {showFilters ? 'Hide Filters' : 'Show Filters'}
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="advanced-filters" style={{ marginBottom: 16 }}>
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

      <div className="colleges-actions" style={{ display: 'flex', width: '100%', alignItems: 'center' }}>
        <div>
          <button type='button' className="action-button add-new" onClick={() => {
            setEditMode(false);
            setNewExam({
              start_date: '',
              end_date: '',
              academic_year: '',
              exam_category: '',
              term_id: 0,
              department_id: '',
              college_id: null,
            });
            setSelectedDates([]);
            setShowModal(true);
          }}><FaPlus/></button>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <button
            type='button'
            className="action-button delete"
            onClick={async () => {
              if (!globalThis.confirm('Are you sure you want to delete all exam periods?')) return;
              try {
                await api.delete('/tbl_examperiod');
                toast.success('All exam periods deleted');
                fetchAll();
              } catch (err) {
                console.error(err);
                toast.error('Failed to delete all exam periods');
              }
            }}
          >
            <FaTrash/>
          </button>
        </div>
      </div>

      <div className="table-scroll-wrapper">
        <div className="table-scroll-hint">
          <FaChevronLeft /> Swipe or use buttons to scroll <FaChevronRight />
        </div>
        <button
          type="button"
          className="table-scroll-buttons scroll-left"
          onClick={() => scrollTable('left')}
          disabled={!canScrollLeft}
          aria-label="Scroll left"
        >
          <FaChevronLeft />
        </button>
        <button
          type="button"
          className="table-scroll-buttons scroll-right"
          onClick={() => scrollTable('right')}
          disabled={!canScrollRight}
          aria-label="Scroll right"
        >
          <FaChevronRight />
        </button>
        <div className="colleges-table-container" ref={tableContainerRef}>
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
              <th>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>Actions</span>
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={toggleSelectAll}
                    disabled={loading || filtered.length === 0}
                    aria-label="Select all exam periods"
                    title="Select all"
                    style={{ marginLeft: 'auto' }}
                  />
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: '20px' }}>
                  Loading exam periods...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: '20px' }}>
                  No exam periods found.
                </td>
              </tr>
            ) : (
              filtered.map((e, i) => (
                <tr key={e.examperiod_id}>
                  <td>{i + 1}</td>
                  <td>{new Date(e.start_date).toLocaleDateString()}</td>
                  <td>{new Date(e.end_date).toLocaleDateString()}</td>
                  <td>{e.academic_year}</td>
                  <td>{e.exam_category}</td>
                  <td>{terms.find(t => t.term_id === e.term_id)?.term_name}</td>
                  <td>{e.department_id}</td>
                  <td>{e.college_id}</td>
                  <td className="action-buttons" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button type='button' className="icon-button edit-button" onClick={() => {
                      setEditMode(true);
                      setNewExam(e);
                      setSelectedDates([
                        new Date(e.start_date)
                      ]);
                      setShowModal(true);
                    }}><FaEdit /></button>
                    <input
                      type="checkbox"
                      checked={!!e.examperiod_id && selectedExamIds.has(e.examperiod_id)}
                      onChange={() => toggleSelect(e.examperiod_id)}
                      aria-label="Select exam period"
                      style={{ marginLeft: 'auto' }}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
      </div>

      {showModal && (
        <div className="examperiod-overlay">
          <div className="examperiod-modal">
            <h3 className="examperiod-title">
              {editMode ? 'Edit Exam Period' : 'Set Exam Period'}
            </h3>

            <div className="examperiod-body">
              {/* Left side - Calendar */}
              <div className="examperiod-calendar-section">
                <label className="examperiod-label">Select Exam Duration</label>
                <Calendar
                  calendarType="gregory"    // 👈 forces Sunday as first day
                  value={undefined}
                  onClickDay={(date) => {
                    const exists = selectedDates.some(d =>
                      toLocalDateString(d) === toLocalDateString(date)
                    );
                    if (exists) {
                      setSelectedDates(prev =>
                        prev.filter(d => toLocalDateString(d) !== toLocalDateString(date))
                      );
                    } else {
                      setSelectedDates(prev => [...prev, date]);
                    }
                  }}
                  tileClassName={({ date }) =>
                    selectedDates.some(d => toLocalDateString(d) === toLocalDateString(date))
                      ? 'examperiod-selected-day'
                      : undefined
                  }
                />
              </div>

              {/* Right side - Inputs */}
              <div className="examperiod-inputs-section">
                <div className="examperiod-input-group">
                  <label className="examperiod-label">Academic Year</label>
                  <Select
                    className="examperiod-select"
                    classNamePrefix="examperiod"
                    // build options array from academicYears
                    options={academicYears.map(y => ({ value: y, label: y }))}
                    // current value must be an object {value,label} or null
                    value={newExam.academic_year 
                      ? { value: newExam.academic_year, label: newExam.academic_year }
                      : null}
                    onChange={opt =>
                      setNewExam({ ...newExam, academic_year: opt?.value ?? '' })
                    }
                    placeholder="Select Year"
                    isClearable
                  />
                </div>

                {/* Exam Category */}
                <div className="examperiod-input-group">
                  <label className="examperiod-label">Exam Term</label>
                  <Select
                    className="examperiod-select"
                    classNamePrefix="examperiod"
                    options={examCategories.map(c => ({ value: c, label: c }))}
                    value={newExam.exam_category
                      ? { value: newExam.exam_category, label: newExam.exam_category }
                      : null}
                    onChange={opt =>
                      setNewExam({ ...newExam, exam_category: opt?.value ?? '' })
                    }
                    placeholder="Select Exam Term"
                    isClearable
                  />
                </div>

                <div className="examperiod-input-group">
                  <label className="examperiod-label">Semester</label>
                  <Select
                    className="examperiod-select"
                    classNamePrefix="examperiod"
                    options={terms
                      .sort((a, b) => a.term_name.localeCompare(b.term_name))
                      .map(t => ({ value: t.term_id, label: t.term_name }))}
                    value={newExam.term_id
                      ? { value: newExam.term_id, label: terms.find(t => t.term_id === newExam.term_id)?.term_name || '' }
                      : null}
                    onChange={opt =>
                      setNewExam({ ...newExam, term_id: opt?.value ?? 0 })
                    }
                    placeholder="Select Semester"
                    isClearable
                  />
                </div>

                <div className="examperiod-input-group">
                  <label className="examperiod-label">Department</label>
                  <Select
                    className="examperiod-select"
                    classNamePrefix="examperiod"
                    options={departments
                      .sort((a, b) => a.department_name.localeCompare(b.department_name))
                      .map(d => ({ value: d.department_id, label: d.department_name }))}
                    value={newExam.department_id
                      ? { value: newExam.department_id, label: departments.find(d => d.department_id === newExam.department_id)?.department_name || '' }
                      : null}
                    onChange={opt =>
                      setNewExam({ ...newExam, department_id: opt?.value || null })
                    }
                    placeholder="Optional"
                    isClearable
                  />
                </div>

                <div className="examperiod-input-group">
                  <label className="examperiod-label">College</label>
                  <Select
                    className="examperiod-select"
                    classNamePrefix="examperiod"
                    options={colleges
                      .sort((a, b) => a.college_name.localeCompare(b.college_name))
                      .map(c => ({ value: c.college_id, label: c.college_name }))}
                    value={newExam.college_id
                      ? { value: newExam.college_id, label: colleges.find(c => c.college_id === newExam.college_id)?.college_name || '' }
                      : null}
                    onChange={opt =>
                      setNewExam({ ...newExam, college_id: opt?.value || null })
                    }
                    placeholder="Optional"
                    isClearable
                    menuPlacement="top"
                  />
                </div>
              </div>
            </div>

            <div className="examperiod-actions">
              <button type="button" onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : 'Save'}
              </button>
              <button type="button" onClick={() => setShowModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showImport && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Import Exam Periods</h3>
            <input type="file" accept=".xlsx, .xls" onChange={handleImport} />
            <button type='button' onClick={() => setShowImport(false)}>Close</button>
          </div>
        </div>
      )}

      <ToastContainer />
    </div>
  );
};

export default ExamPeriodComponent;
