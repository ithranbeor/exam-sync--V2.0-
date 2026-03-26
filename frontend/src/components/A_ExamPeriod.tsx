// deno-lint-ignore-file no-explicit-any
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { FaTrash, FaEdit, FaSearch, FaPlus, FaChevronLeft, FaChevronRight, FaSort, FaChevronDown } from 'react-icons/fa';
import { api } from '../lib/apiClient.ts';
import * as XLSX from 'xlsx';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import '../styles/A_Colleges.css';
import Select from 'react-select';
import Calendar from 'react-calendar';
import { useEscapeKey } from '../hooks/useEscapeKey.ts';

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
const examCategories = ['Midterm', 'Final'];

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
  const [loading, setLoading] = useState(true); 
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState<number | 'all'>('all');
  const [showItemsPerPageDropdown, setShowItemsPerPageDropdown] = useState(false);
  const [customItemsPerPage, setCustomItemsPerPage] = useState<string>('');
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [selectedExamIds, setSelectedExamIds] = useState<Set<number>>(new Set());
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteCount, setDeleteCount] = useState(0);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [sortBy, setSortBy] = useState<string>('none');
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [activeDate, setActiveDate] = useState<Date>(new Date());

  const [newExam, setNewExam] = useState<ExamPeriod>({
    start_date: '',
    end_date: '',
    academic_year: '',
    exam_category: '',
    term_id: 0,
    department_id: '',
    college_id: null,
  });

  useEscapeKey(() => {
    if (showModal) {
      setShowModal(false);
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
    }
  }, showModal);

  useEscapeKey(() => {
    if (showImport) {
      setShowImport(false);
    }
  }, showImport);

  useEscapeKey(() => {
    if (showDeleteConfirm) {
      setShowDeleteConfirm(false);
    }
  }, showDeleteConfirm);

  useEffect(() => {
    fetchAll();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showSortDropdown && !target.closest('[data-sort-dropdown]')) {
        setShowSortDropdown(false);
      }
      if (showItemsPerPageDropdown && !target.closest('[data-items-per-page-dropdown]')) {
        setShowItemsPerPageDropdown(false);
      }
    };

    if (showSortDropdown || showItemsPerPageDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSortDropdown, showItemsPerPageDropdown]);

  const selectStyles = {
    control: (b: any) => ({
      ...b,
      fontSize: '13px',
      minHeight: '36px',
      borderColor: 'var(--cl-border)',
      borderRadius: '6px',
      backgroundColor: '#fff',
    }),

    menu: (b: any) => ({
      ...b,
      backgroundColor: '#fff',
    }),

    menuList: (b: any) => ({
      ...b,
      backgroundColor: '#fff',
    }),

    option: (b: any, state: any) => ({
      ...b,
      color: '#0C1B2A',
      backgroundColor: state.isFocused ? '#f1f5f9' : '#fff',
    }),

    input: (b: any) => ({
      ...b,
      color: '#0C1B2A',
    }),

    singleValue: (b: any) => ({
      ...b,
      color: '#0C1B2A',
    }),

    placeholder: (b: any) => ({
      ...b,
      color: '#6b7280',
    }),

    multiValueLabel: (b: any) => ({
      ...b,
      color: '#0C1B2A',
    }),

    multiValueRemove: (b: any) => ({
      ...b,
      color: '#0C1B2A',
      ':hover': {
        backgroundColor: '#e2e8f0',
        color: '#000',
      },
    }),

    clearIndicator: (b: any) => ({
      ...b,
      color: '#0C1B2A',
      ':hover': {
        color: '#000',
      },
    }),
  };

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
      const year = d.getFullYear();
      const month = pad(d.getMonth() + 1);
      const day = pad(d.getDate());
      return `${year}-${month}-${day}T12:00:00`;
    };

    try {
      if (editMode && examperiod_id) {
        const payload = {
          start_date: newExam.start_date + 'T12:00:00', 
          end_date: newExam.end_date + 'T12:00:00',    
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
        const sortedDates = [...selectedDates].sort((a, b) => a.getTime() - b.getTime());
        const newRecords: any[] = [];

        for (const date of sortedDates) {
          const formatted = toLocalDateString(date);

          const payload = {
            start_date: formatted,  
            end_date: formatted,  
            academic_year,
            exam_category,
            term: term_id,
            department: department_id || null,
            college: college_id || null,
          };

          const res = await api.post('/tbl_examperiod', payload);
          newRecords.push(res.data);
        }

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

  useEffect(() => {
    setCurrentPage(1);
  }, [search, filterYear, filterCategory, filterTerm, filterDept, filterCollege, sortBy]);

  const isNumeric = (str: string): boolean => {
    return !isNaN(Number(str)) && !isNaN(parseFloat(str));
  };

  const smartSort = (a: string, b: string): number => {
    const aIsNumeric = isNumeric(a);
    const bIsNumeric = isNumeric(b);

    if (aIsNumeric && bIsNumeric) {
      return parseFloat(a) - parseFloat(b);
    } else if (aIsNumeric && !bIsNumeric) {
      return -1;
    } else if (!aIsNumeric && bIsNumeric) {
      return 1;
    } else {
      return a.localeCompare(b);
    }
  };

  const handleItemsPerPageChange = (value: number | 'all') => {
    setItemsPerPage(value);
    setShowItemsPerPageDropdown(false);
    setCurrentPage(1);
  };

  const handleCustomItemsPerPage = () => {
    const numValue = parseInt(customItemsPerPage, 10);
    if (!isNaN(numValue) && numValue > 0) {
      setItemsPerPage(numValue);
      setCustomItemsPerPage('');
      setShowItemsPerPageDropdown(false);
      setCurrentPage(1);
    } else {
      toast.error('Please enter a valid positive number.');
    }
  };

  const handleBulkDelete = () => {
    const idsToDelete = Array.from(selectedExamIds);
    if (idsToDelete.length === 0) {
      toast.error('No items selected');
      return;
    }
    setDeleteCount(idsToDelete.length);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    const idsToDelete = Array.from(selectedExamIds);
    setShowDeleteConfirm(false);
    try {
      // Delete each individually
      await Promise.all(
        idsToDelete.map(id => api.delete(`/tbl_examperiod/${id}/`))
      );

      toast.success(`Deleted ${idsToDelete.length} exam period(s)`);
      setSelectedExamIds(new Set());
      fetchAll();
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete selected items');
    }
  };

  const filtered = useMemo(() => {
    let filtered = examPeriods.filter(e =>
      (!search || e.academic_year.toLowerCase().includes(search.toLowerCase())) &&
      (!filterYear || e.academic_year === filterYear) &&
      (!filterCategory || e.exam_category === filterCategory) &&
      (!filterTerm || e.term_id.toString() === filterTerm) &&
      (!filterDept || e.department_id === filterDept) &&
      (!filterCollege || e.college_id === filterCollege) &&
      (e.start_date)
    );

    if (sortBy !== 'none') {
      filtered = [...filtered].sort((a, b) => {
        if (sortBy === 'start_date') {
          return new Date(a.start_date).getTime() - new Date(b.start_date).getTime();
        } else if (sortBy === 'end_date') {
          return new Date(a.end_date).getTime() - new Date(b.end_date).getTime();
        } else if (sortBy === 'academic_year') {
          return smartSort(a.academic_year.toLowerCase(), b.academic_year.toLowerCase());
        } else if (sortBy === 'exam_category') {
          return smartSort(a.exam_category.toLowerCase(), b.exam_category.toLowerCase());
        } else if (sortBy === 'term') {
          const aTerm = terms.find(t => t.term_id === a.term_id)?.term_name || '';
          const bTerm = terms.find(t => t.term_id === b.term_id)?.term_name || '';
          return smartSort(aTerm.toLowerCase(), bTerm.toLowerCase());
        } else if (sortBy === 'department') {
          const aDept = departments.find(d => d.department_id === a.department_id)?.department_name || '';
          const bDept = departments.find(d => d.department_id === b.department_id)?.department_name || '';
          return smartSort(aDept.toLowerCase(), bDept.toLowerCase());
        } else if (sortBy === 'college') {
          const aCollege = colleges.find(c => c.college_id === a.college_id)?.college_name || '';
          const bCollege = colleges.find(c => c.college_id === b.college_id)?.college_name || '';
          return smartSort(aCollege.toLowerCase(), bCollege.toLowerCase());
        }
        return 0;
      });
    }

    return filtered;
  }, [examPeriods, search, filterYear, filterCategory, filterTerm, filterDept, filterCollege, sortBy, terms, departments, colleges]);

  const totalItems = filtered.length;

  const effectiveItemsPerPage = useMemo(() => {
    if (totalItems === 0) return 1;

    if (itemsPerPage === 'all') {
      // "Show All" should display 20 rows per page
      return 20;
    }

    return itemsPerPage;
  }, [itemsPerPage, totalItems]);

  const totalPages = useMemo(() => {
    if (totalItems === 0) return 1;
    return Math.max(1, Math.ceil(totalItems / effectiveItemsPerPage));
  }, [totalItems, effectiveItemsPerPage]);

  const paginatedExamPeriods = useMemo(() => {
    if (totalItems === 0) return [];
    return filtered.slice(
      (currentPage - 1) * effectiveItemsPerPage,
      currentPage * effectiveItemsPerPage,
    );
  }, [filtered, currentPage, effectiveItemsPerPage, totalItems]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

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
    <div className="cl-page">

      {/* ── Page Header ── */}
      <div className="cl-page-header">
        <div className="cl-page-header-left">
          <div className="cl-page-icon">
            <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div className="cl-page-title">
            <h1>Exam Periods</h1>
            <p>{examPeriods.length} record{examPeriods.length !== 1 ? 's' : ''} · {filtered.length} showing</p>
          </div>
        </div>

        <div className="cl-page-actions">
          <div className="cl-search-bar">
            <FaSearch className="cl-search-icon" />
            <input
              type="text"
              placeholder="Search exam periods…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <button
            type="button"
            className="cl-btn primary"
            onClick={() => {
              setEditMode(false);
              setNewExam({ start_date: '', end_date: '', academic_year: '', exam_category: '', term_id: 0, department_id: '', college_id: null });
              setSelectedDates([]);
              setActiveDate(new Date());
              setShowModal(true);
            }}
          >
            <FaPlus style={{ fontSize: '11px' }} /> Add
          </button>
          <button
            type="button"
            className="cl-btn danger"
            onClick={handleBulkDelete}
            disabled={selectedExamIds.size === 0}
            title={selectedExamIds.size > 0 ? `Delete ${selectedExamIds.size} selected` : 'Select rows to delete'}
          >
            <FaTrash style={{ fontSize: '11px' }} />
            {selectedExamIds.size > 0 && <span>({selectedExamIds.size})</span>}
          </button>
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div className="cl-toolbar">
        <div className="cl-toolbar-left">

          {/* Sort dropdown */}
          <div style={{ position: 'relative' }} data-sort-dropdown>
            <button type="button" className="cl-toolbar-btn" onClick={() => setShowSortDropdown(!showSortDropdown)}>
              <FaSort style={{ fontSize: '11px' }} />
              Sort{sortBy !== 'none' ? `: ${sortBy.replace('_', ' ')}` : ''}
              <FaChevronDown style={{ fontSize: '9px', marginLeft: '2px' }} />
            </button>
            {showSortDropdown && (
              <div className="cl-dropdown">
                {[
                  { value: 'none', label: 'None' },
                  { value: 'start_date', label: 'Start Date' },
                  { value: 'end_date', label: 'End Date' },
                  { value: 'academic_year', label: 'Academic Year' },
                  { value: 'exam_category', label: 'Exam Category' },
                  { value: 'term', label: 'Term' },
                  { value: 'department', label: 'Department' },
                  { value: 'college', label: 'College' },
                ].map(opt => (
                  <button key={opt.value} type="button" className={`cl-dropdown-item${sortBy === opt.value ? ' active' : ''}`} onClick={() => { setSortBy(opt.value); setShowSortDropdown(false); }}>
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Rows per page */}
          <div style={{ position: 'relative' }} data-items-per-page-dropdown>
            <button type="button" className="cl-toolbar-btn" onClick={() => setShowItemsPerPageDropdown(!showItemsPerPageDropdown)}>
              <FaChevronDown style={{ fontSize: '9px' }} />
              Rows: {itemsPerPage === 'all' ? 'All' : itemsPerPage}
            </button>
            {showItemsPerPageDropdown && (
              <div className="cl-dropdown" style={{ minWidth: '200px' }}>
                {[10, 20, 30].map(n => (
                  <button key={n} type="button" className={`cl-dropdown-item${itemsPerPage === n ? ' active' : ''}`} onClick={() => handleItemsPerPageChange(n)}>{n}</button>
                ))}
                <div className="cl-dropdown-divider" />
                <div className="cl-dropdown-custom">
                  <input type="number" className="cl-custom-input" value={customItemsPerPage} onChange={e => setCustomItemsPerPage(e.target.value)} placeholder="Custom…" min="1" onKeyDown={e => { if (e.key === 'Enter') handleCustomItemsPerPage(); }} />
                  <button type="button" className="cl-btn primary" style={{ padding: '5px 10px', fontSize: '11px', height: 'auto' }} onClick={handleCustomItemsPerPage}>Apply</button>
                </div>
                <button type="button" className={`cl-dropdown-item${itemsPerPage === 'all' ? ' active' : ''}`} onClick={() => handleItemsPerPageChange('all')}>Show All</button>
              </div>
            )}
          </div>

          {/* Filters toggle */}
          <button type="button" className="cl-toolbar-btn" onClick={() => setShowFilters(p => !p)}>
            {showFilters ? 'Hide Filters' : 'Show Filters'}
          </button>

        </div>

        {/* Pagination */}
        <div className="cl-pagination">
          <button type="button" className="cl-page-btn" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage <= 1 || totalItems === 0}>
            <FaChevronLeft style={{ fontSize: '10px' }} />
          </button>
          <span className="cl-page-info">{totalItems === 0 ? '0 / 0' : `${currentPage} / ${totalPages}`}</span>
          <button type="button" className="cl-page-btn" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages || totalItems === 0}>
            <FaChevronRight style={{ fontSize: '10px' }} />
          </button>
        </div>
      </div>

      {/* ── Filters Row ── */}
      {showFilters && (
        <div className="cl-filters-row">
          <select className="cl-toolbar-btn" value={filterYear} onChange={e => setFilterYear(e.target.value)}>
            <option value="">All Years</option>
            {academicYears.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <select className="cl-toolbar-btn" value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
            <option value="">All Categories</option>
            {examCategories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select className="cl-toolbar-btn" value={filterTerm} onChange={e => setFilterTerm(e.target.value)}>
            <option value="">All Terms</option>
            {terms.map(t => <option key={t.term_id} value={t.term_id.toString()}>{t.term_name}</option>)}
          </select>
          <select className="cl-toolbar-btn" value={filterDept} onChange={e => setFilterDept(e.target.value)}>
            <option value="">All Departments</option>
            {departments.map(d => <option key={d.department_id} value={d.department_id}>{d.department_name}</option>)}
          </select>
          <select className="cl-toolbar-btn" value={filterCollege} onChange={e => setFilterCollege(e.target.value)}>
            <option value="">All Colleges</option>
            {colleges.map(c => <option key={c.college_id} value={c.college_id}>{c.college_name}</option>)}
          </select>
        </div>
      )}

      {/* ── Table Card ── */}
      <div className="cl-table-card">
        <div className="cl-table-scroll-wrapper">
          <button type="button" className="cl-scroll-btn left" onClick={() => scrollTable('left')} disabled={!canScrollLeft}><FaChevronLeft /></button>
          <button type="button" className="cl-scroll-btn right" onClick={() => scrollTable('right')} disabled={!canScrollRight}><FaChevronRight /></button>

          <div className="cl-table-container" ref={tableContainerRef}>
            <table className="cl-table">
              <thead>
                <tr>
                  <th style={{ width: '52px' }}>#</th>
                  <th>Start</th>
                  <th>End</th>
                  <th>Academic Year</th>
                  <th>Category</th>
                  <th>Term</th>
                  <th>Department</th>
                  <th>College</th>
                  <th style={{ width: '120px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span>Actions</span>
                      <input type="checkbox" checked={isAllSelected} onChange={toggleSelectAll} disabled={loading || filtered.length === 0} title="Select all" style={{ cursor: 'pointer' }} />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={9} className="cl-table-empty"><div className="cl-spinner" />Loading exam periods…</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={9} className="cl-table-empty">No exam periods found.</td></tr>
                ) : (
                  paginatedExamPeriods.map((e, i) => {
                    const isSelected = !!e.examperiod_id && selectedExamIds.has(e.examperiod_id);
                    return (
                      <tr key={e.examperiod_id} className={isSelected ? 'selected' : ''}>
                        <td className="cl-td-num">{(currentPage - 1) * effectiveItemsPerPage + i + 1}</td>
                        <td>{new Date(e.start_date).toLocaleDateString()}</td>
                        <td>{new Date(e.end_date).toLocaleDateString()}</td>
                        <td><span className="cl-id-badge">{e.academic_year}</span></td>
                        <td>
                          <span className={`cl-room-type-badge ${e.exam_category === 'Midterm' ? 'lecture' : 'lab'}`}>
                            {e.exam_category}
                          </span>
                        </td>
                        <td>{terms.find(t => t.term_id === e.term_id)?.term_name ?? '—'}</td>
                        <td style={{ fontSize: '12px', color: 'var(--cl-text-muted)' }}>{e.department_id || '—'}</td>
                        <td style={{ fontSize: '12px', color: 'var(--cl-text-muted)' }}>{e.college_id || '—'}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <button
                              type="button"
                              className="cl-icon-btn edit"
                              onClick={() => {
                                setEditMode(true);
                                setNewExam(e);
                                const startDate = new Date(e.start_date);
                                setSelectedDates([startDate]);
                                setActiveDate(startDate);
                                setShowModal(true);
                              }}
                            >
                              <FaEdit style={{ fontSize: '11px' }} /> Edit
                            </button>
                            <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(e.examperiod_id)} aria-label="Select exam period" style={{ marginLeft: 'auto', cursor: 'pointer' }} />
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ════ ADD / EDIT MODAL (Calendar layout kept exactly as-is) ════ */}
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
                <div className="examperiod-date-selectors">
                  <div className="examperiod-date-selector-group">
                    <label className="examperiod-date-selector-label">Month</label>
                    <select
                      className="examperiod-date-selector"
                      value={activeDate.getMonth()}
                      onChange={e => { const d = new Date(activeDate); d.setMonth(parseInt(e.target.value)); setActiveDate(d); }}
                    >
                      {['January','February','March','April','May','June','July','August','September','October','November','December'].map((month, index) => (
                        <option key={month} value={index}>{month}</option>
                      ))}
                    </select>
                  </div>
                  <div className="examperiod-date-selector-group">
                    <label className="examperiod-date-selector-label">Year</label>
                    <select
                      className="examperiod-date-selector"
                      value={activeDate.getFullYear()}
                      onChange={e => { const d = new Date(activeDate); d.setFullYear(parseInt(e.target.value)); setActiveDate(d); }}
                    >
                      {(() => {
                        const currentYear = new Date().getFullYear();
                        const baseYears = Array.from({ length: 10 }, (_, i) => currentYear - 2 + i);
                        const selectedYears = new Set<number>();
                        selectedDates.forEach(date => selectedYears.add(date.getFullYear()));
                        const allYears = new Set([...baseYears, ...selectedYears]);
                        return Array.from(allYears).sort((a, b) => a - b).map(year => (
                          <option key={year} value={year}>{year}</option>
                        ));
                      })()}
                    </select>
                  </div>
                </div>

                <Calendar
                  calendarType="gregory"
                  value={undefined}
                  activeStartDate={activeDate}
                  onActiveStartDateChange={({ activeStartDate }) => { if (activeStartDate) setActiveDate(activeStartDate); }}
                  onClickDay={date => {
                    const normalizedDate = new Date(date);
                    normalizedDate.setHours(0, 0, 0, 0);
                    const dateString = toLocalDateString(normalizedDate);
                    const exists = selectedDates.some(d => { const nd = new Date(d); nd.setHours(0,0,0,0); return toLocalDateString(nd) === dateString; });
                    if (exists) {
                      setSelectedDates(prev => prev.filter(d => { const nd = new Date(d); nd.setHours(0,0,0,0); return toLocalDateString(nd) !== dateString; }));
                    } else {
                      setSelectedDates(prev => { const updated = [...prev, normalizedDate]; setActiveDate(normalizedDate); return updated; });
                    }
                  }}
                  tileClassName={({ date }) => {
                    const dateString = toLocalDateString(date);
                    const isSelected = selectedDates.some(d => { const nd = new Date(d); nd.setHours(0,0,0,0); return toLocalDateString(nd) === dateString; });
                    return isSelected ? 'examperiod-selected-day' : undefined;
                  }}
                />
              </div>

              {/* Right side - Inputs */}
              <div className="examperiod-inputs-section">
                <div className="examperiod-input-group">
                  <label className="examperiod-label">Academic Year</label>
                  <Select
                    className="examperiod-select"
                    classNamePrefix="examperiod"
                    options={academicYears.map(y => ({ value: y, label: y }))}
                    value={newExam.academic_year ? { value: newExam.academic_year, label: newExam.academic_year } : null}
                    onChange={opt => setNewExam({ ...newExam, academic_year: opt?.value ?? '' })}
                    placeholder="Select Year"
                    isClearable
                    styles={selectStyles}
                  />
                </div>
                <div className="examperiod-input-group">
                  <label className="examperiod-label">Exam Term</label>
                  <Select
                    className="examperiod-select"
                    classNamePrefix="examperiod"
                    options={examCategories.map(c => ({ value: c, label: c }))}
                    value={newExam.exam_category ? { value: newExam.exam_category, label: newExam.exam_category } : null}
                    onChange={opt => setNewExam({ ...newExam, exam_category: opt?.value ?? '' })}
                    placeholder="Select Exam Term"
                    isClearable
                    styles={selectStyles}
                  />
                </div>
                <div className="examperiod-input-group">
                  <label className="examperiod-label">Semester</label>
                  <Select
                    className="examperiod-select"
                    classNamePrefix="examperiod"
                    options={terms.sort((a, b) => a.term_name.localeCompare(b.term_name)).map(t => ({ value: t.term_id, label: t.term_name }))}
                    value={newExam.term_id ? { value: newExam.term_id, label: terms.find(t => t.term_id === newExam.term_id)?.term_name || '' } : null}
                    onChange={opt => setNewExam({ ...newExam, term_id: opt?.value ?? 0 })}
                    placeholder="Select Semester"
                    isClearable
                    styles={selectStyles}
                  />
                </div>
                <div className="examperiod-input-group">
                  <label className="examperiod-label">College</label>
                  <Select
                    className="examperiod-select"
                    classNamePrefix="examperiod"
                    options={colleges.sort((a, b) => a.college_name.localeCompare(b.college_name)).map(c => ({ value: c.college_id, label: c.college_name }))}
                    value={newExam.college_id ? { value: newExam.college_id, label: colleges.find(c => c.college_id === newExam.college_id)?.college_name || '' } : null}
                    onChange={opt => setNewExam({ ...newExam, college_id: opt?.value || null })}
                    placeholder="Optional"
                    isClearable
                    menuPlacement="top"
                    styles={selectStyles}
                  />
                </div>
              </div>
            </div>

            <div className="examperiod-actions">
              <button type="button" className="cl-btn" onClick={() => setShowModal(false)}>Cancel</button>
              <button type="button" className="cl-btn primary" onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════ IMPORT MODAL ════ */}
      {showImport && (
        <div className="cl-modal-overlay" onClick={() => setShowImport(false)}>
          <div className="cl-modal" onClick={e => e.stopPropagation()}>
            <div className="cl-modal-header">
              <h3>Import Exam Periods</h3>
            </div>
            <div className="cl-modal-body">
              <input type="file" accept=".xlsx,.xls" onChange={handleImport} className="cl-file-input" />
            </div>
            <div className="cl-modal-footer">
              <button type="button" className="cl-btn primary" onClick={() => setShowImport(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ════ DELETE CONFIRM MODAL ════ */}
      {showDeleteConfirm && (
        <div className="cl-modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="cl-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '380px' }}>
            <div className="cl-modal-header">
              <h3>Confirm Deletion</h3>
            </div>
            <div className="cl-modal-body">
              <p style={{ fontSize: '13.5px', color: 'var(--cl-text-secondary)', lineHeight: 1.7, margin: 0 }}>
                {deleteCount === 1 ? 'You are about to delete 1 exam period. This cannot be undone.' : `You are about to delete ${deleteCount} exam periods. This cannot be undone.`}
              </p>
            </div>
            <div className="cl-modal-footer">
              <button type="button" className="cl-btn" onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
              <button type="button" className="cl-btn danger-fill" onClick={confirmDelete}>Yes, Delete</button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer position="top-right" autoClose={3000} />
    </div>
  );
};

export default ExamPeriodComponent;
