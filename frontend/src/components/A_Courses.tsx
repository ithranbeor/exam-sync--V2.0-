// deno-lint-ignore-file no-explicit-any
import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { FaTrash, FaEdit, FaSearch, FaDownload, FaPlus, FaFileImport, FaChevronLeft, FaChevronRight, FaSort, FaChevronDown } from "react-icons/fa";
import { api } from "../lib/apiClient.ts";
import { ToastContainer, toast } from "react-toastify";
import * as XLSX from "xlsx";
import "react-toastify/dist/ReactToastify.css";
import "../styles/A_Colleges.css";
import Select from "react-select";
import { useEscapeKey } from "../hooks/useEscapeKey.ts";

interface Term {
  term_id: number;
  term_name: string;
  academic_year?: string;
}

interface User {
  user_id: number;
  first_name: string;
  middle_name?: string;
  last_name: string;
}

interface Course {
  course_id: string;
  course_name: string;
  term_id: number;
  term_name?: string;
  instructor_names?: string[];
  user_ids?: number[];
  leaders?: number[];
}

interface College {
  college_id: string;
  college_name: string;
}

const Courses: React.FC = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [colleges, setColleges] = useState<College[]>([]);
  const [userRoles, setUserRoles] = useState<any[]>([]);
  const [selectedCollege, setSelectedCollege] = useState<string>('all');
  const [users, setUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [newCourse, setNewCourse] = useState({
    course_id: "",
    course_name: "",
    term_id: 0,
    user_ids: [] as number[],
    leaders: [] as number[],
  });
  const [editMode, setEditMode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState<number | 'all'>('all');
  const [showItemsPerPageDropdown, setShowItemsPerPageDropdown] = useState(false);
  const [customItemsPerPage, setCustomItemsPerPage] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [sortBy, setSortBy] = useState<string>('none');
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteCount, setDeleteCount] = useState(0);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [originalCourseId, setOriginalCourseId] = useState<string>("");

  // Handle ESC key to close modals
  useEscapeKey(() => {
    if (showModal) {
      setShowModal(false);
      setEditMode(false);
      setNewCourse({
        course_id: "",
        course_name: "",
        term_id: 0,
        user_ids: [],
        leaders: [],
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
  }, [courses, searchTerm, loading]);

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

  // Close dropdown when clicking outside
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

  // ptimized useEffect for faster load
  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      setLoading(true);
      try {
        const coursesPromise = api.get("/courses/");
        const othersPromise = Promise.all([
          api.get("/tbl_term"),
          api.get("/users/"),
          api.get("/tbl_college/"),
          api.get("/tbl_user_role"),
        ]);

        const { data: coursesData } = await coursesPromise;
        if (mounted) setCourses(coursesData);

        // Fetch terms, users, colleges, and user roles in background
        const [termsRes, usersRes, collegesRes, userRolesRes] = await othersPromise;
        if (mounted) {
          setTerms(termsRes.data);
          setUsers(usersRes.data);
          setColleges(collegesRes.data || []);
          setUserRoles(userRolesRes.data || []);
        }
      } catch {
        toast.error("Failed to fetch some data");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadData();
    return () => {
      mounted = false;
    };
  }, []);

  const formatName = (u: User) => {
    const mid = u.middle_name ? ` ${u.middle_name}` : "";
    return `${u.first_name}${mid} ${u.last_name}`.trim();
  };

  // Prevent re-fetch race conditions
  const fetchCourses = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/courses/");
      setCourses(data);
    } catch {
      toast.error("Failed to fetch courses");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, sortBy]);

  // Helper function to determine if a string is numeric
  const isNumeric = (str: string): boolean => {
    return !isNaN(Number(str)) && !isNaN(parseFloat(str));
  };

  // Smart sort function that handles both text and numbers
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

  const filteredCourses = useMemo(() => {
    const search = searchTerm.toLowerCase();
    let filtered = courses.filter((c) => {
      const matchesCourseId = c.course_id.toLowerCase().includes(search);
      const matchesCourseName = c.course_name.toLowerCase().includes(search);
      const matchesTerm = (c.term_name || '').toLowerCase().includes(search);
      const matchesInstructors = c.instructor_names?.some(name =>
        name.toLowerCase().includes(search)
      ) || false;

      return matchesCourseId || matchesCourseName || matchesTerm || matchesInstructors;
    });

    if (selectedCollege && selectedCollege !== 'all') {
      filtered = filtered.filter((c) => {
        const ids = c.user_ids || [];
        if (ids.length === 0) return false;

        for (const uid of ids) {
          const role = userRoles.find((r: any) => {
            return Number(r.user_id || r.user) === Number(uid);
          });
          if (role) {
            const collegeId = role.college_id || (role.college && role.college.college_id) || role.college;
            if (String(collegeId) === String(selectedCollege)) return true;
          }
        }

        return false;
      });
    }

    // Apply sorting
    if (sortBy !== 'none') {
      filtered = [...filtered].sort((a, b) => {
        if (sortBy === 'course_id') {
          return smartSort(a.course_id, b.course_id);
        } else if (sortBy === 'course_name') {
          return smartSort(a.course_name.toLowerCase(), b.course_name.toLowerCase());
        } else if (sortBy === 'term') {
          const aTerm = a.term_name || '';
          const bTerm = b.term_name || '';
          return smartSort(aTerm.toLowerCase(), bTerm.toLowerCase());
        }
        return 0;
      });
    }

    return filtered;
  }, [courses, searchTerm, sortBy, selectedCollege, userRoles]);

  const totalItems = filteredCourses.length;

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

  const paginatedCourses = useMemo(() => {
    if (totalItems === 0) return [];
    return filteredCourses.slice(
      (currentPage - 1) * effectiveItemsPerPage,
      currentPage * effectiveItemsPerPage,
    );
  }, [filteredCourses, currentPage, effectiveItemsPerPage, totalItems]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const isAllSelected = courses.length > 0 && courses.every((c) => selectedIds.has(c.course_id));

  const toggleSelectAll = () => {
    setSelectedIds(() => {
      if (isAllSelected) return new Set();
      const all = new Set<string>();
      courses.forEach((c) => all.add(c.course_id));
      return all;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

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
    const ids = Array.from(selectedIds);
    if (ids.length === 0) {
      toast.info("No courses selected");
      return;
    }
    setDeleteCount(ids.length);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    const ids = Array.from(selectedIds);
    setShowDeleteConfirm(false);
    setIsBulkDeleting(true);
    try {
      const results = await Promise.allSettled(ids.map((id) => api.delete(`/courses/${id}/`)));
      const ok = results.filter((r) => r.status === "fulfilled").length;
      const fail = results.length - ok;
      if (ok) toast.success(`Deleted ${ok} course(s)`);
      if (fail) toast.error(`${fail} failed to delete`);
      clearSelection();
      await fetchCourses();
    } catch {
      toast.error("Bulk delete failed");
    } finally {
      setIsBulkDeleting(false);
    }
  };
  // Add or update course
  const handleSubmit = useCallback(async () => {
    const { course_id, course_name, term_id, user_ids, leaders } = newCourse;
    if (!course_id || !course_name || !term_id || user_ids.length === 0) {
      toast.error("All fields are required.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (editMode) {
        await api.put(`/courses/${originalCourseId}/`, {
          course_id,
          course_name,
          term_id,
          user_ids,
          leaders,
        });
        toast.success("Successfully updated");
      } else {
        await api.post("/courses/", {
          course_id,
          course_name,
          term_id,
          user_ids,
          leaders,
        });
        toast.success("Course added successfully");
      }
      await fetchCourses();
      setShowModal(false);
    } catch {
      toast.error("Failed to save course");
    } finally {
      setIsSubmitting(false);
    }
  }, [newCourse, editMode, fetchCourses, originalCourseId]);

  const handleEdit = (course: Course) => {
    setOriginalCourseId(course.course_id); 
    setNewCourse({
      course_id: course.course_id,
      course_name: course.course_name,
      term_id: Number(course.term_id) || 0,
      user_ids: Array.isArray(course.user_ids) ? course.user_ids : [],
      leaders: Array.isArray(course.leaders) ? course.leaders : [],
    });
    setEditMode(true);
    setShowModal(true);
  };

  const clean = (str: string) =>
    String(str)
      .replace(/\u00A0/g, " ")     
      .replace(/\t/g, " ")         
      .trim()
      .toLowerCase();


  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      toast.error("No file selected.");
      return;
    }

    const reader = new FileReader();
    reader.onload = async (evt) => {
      setIsImporting(true);

      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws);

        if (!data.length) {
          toast.error("The Excel file is empty.");
          setIsImporting(false);
          return;
        }

        let successCount = 0;
        let errorCount = 0;

        for (const row of data as any[]) {
          const rawCourseId = String(row["Course ID"] || "").trim();
          const course_id = rawCourseId
            .replace(/\u00A0/g, " ")
            .replace(/\t/g, " ")
            .trim();
          const course_name = row["Course Name"]?.trim();
          const term_full = clean(row["Term Name"]);
          const instructors_raw = row["Instructor Full Names"]?.trim();

          if (!course_id || !course_name || !term_full) {
            toast.error(`Row skipped (${row["Course ID"]}): Missing required fields.`);
            errorCount++;
            continue;
          }

          const term = terms.find(
            (t) => clean(t.term_name) === term_full
          );

          if (!term) {
            toast.error(`Row skipped (${row["Course ID"]}): Term not found.`);
            errorCount++;
            continue;
          }

          let instructorIds: number[] = [];

          if (instructors_raw && instructors_raw.trim() !== "") {
            const instructorNames = instructors_raw
              .split(",")
              .map((n: string) => clean(n));

            instructorIds = users
              .filter((u) =>
                instructorNames.includes(
                  clean(formatName(u))
                )
              )
              .map((u) => u.user_id);

            if (instructorIds.length === 0) {
              toast.warn(
                `No matching instructors for ${row["Course ID"]}. Importing with none.`
              );
            }
          } else {
            instructorIds = [];
          }

          try {
            await api.post("/courses/", {
              course_id,
              course_name,
              term_id: term.term_id,
              user_ids: instructorIds,
              leaders: [],    
            });

            successCount++;
          } catch (err) {
            errorCount++;
            toast.error(`API error importing ${row["Course ID"]}.`);
          }
        }

        toast.success(`Import complete: ${successCount} added, ${errorCount} errors.`);
        await fetchCourses();
        setShowImport(false);

      } catch (error) {
        toast.error("Error reading file.");
      } finally {
        setIsImporting(false);
      }
    };

    reader.readAsBinaryString(file);
  };

  const downloadTemplate = useCallback(() => {
    const ws = XLSX.utils.aoa_to_sheet([
      ["Course ID", "Course Name", "Term Name", "Instructor Full Names"],
      ["IT112", "Computer Programming 1", "1st Semester", "Juan Dela Cruz, Maria Santos"],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "courses_template.xlsx");
  }, []);

  return (
    <div className="cl-page">

      {/* ── Page Header ── */}
      <div className="cl-page-header">
        <div className="cl-page-header-left">
          <div className="cl-page-icon">
            <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <div className="cl-page-title">
            <h1>Courses</h1>
            <p>{courses.length} course{courses.length !== 1 ? 's' : ''} · {filteredCourses.length} showing</p>
          </div>
        </div>

        <div className="cl-page-actions">
          <div className="cl-search-bar">
            <FaSearch className="cl-search-icon" />
            <input
              type="text"
              placeholder="Search courses…"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>

          <button
            type="button"
            className="cl-btn primary"
            onClick={() => {
              setNewCourse({ course_id: '', course_name: '', term_id: 0, user_ids: [], leaders: [] });
              setEditMode(false);
              setShowModal(true);
            }}
          >
            <FaPlus style={{ fontSize: '11px' }} /> Add
          </button>
          <button type="button" className="cl-btn" onClick={() => setShowImport(true)}>
            <FaFileImport style={{ fontSize: '11px' }} /> Import
          </button>
          <button
            type="button"
            className="cl-btn danger"
            onClick={handleBulkDelete}
            disabled={isBulkDeleting || selectedIds.size === 0}
            title={selectedIds.size > 0 ? `Delete ${selectedIds.size} selected` : 'Select rows to delete'}
          >
            <FaTrash style={{ fontSize: '11px' }} />
            {selectedIds.size > 0 && <span>({selectedIds.size})</span>}
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
              Sort{sortBy !== 'none' ? `: ${sortBy === 'course_id' ? 'Code' : sortBy === 'course_name' ? 'Name' : 'Term'}` : ''}
              <FaChevronDown style={{ fontSize: '9px', marginLeft: '2px' }} />
            </button>
            {showSortDropdown && (
              <div className="cl-dropdown">
                {[
                  { value: 'none', label: 'None' },
                  { value: 'course_id', label: 'Course Code' },
                  { value: 'course_name', label: 'Course Name' },
                  { value: 'term', label: 'Term' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`cl-dropdown-item${sortBy === opt.value ? ' active' : ''}`}
                    onClick={() => { setSortBy(opt.value); setShowSortDropdown(false); }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Rows per page dropdown */}
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

          {/* College filter */}
          <select
            value={selectedCollege}
            onChange={e => setSelectedCollege(e.target.value)}
            className="cl-toolbar-btn"
            style={{ cursor: 'pointer', paddingRight: '8px' }}
          >
            <option value="all">All Colleges</option>
            {colleges.map(c => (
              <option key={c.college_id} value={c.college_id}>{c.college_name}</option>
            ))}
          </select>

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
                  <th>Course Code</th>
                  <th>Course Name</th>
                  <th>Term</th>
                  <th>Instructors</th>
                  <th style={{ width: '120px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span>Actions</span>
                      <input type="checkbox" checked={isAllSelected} onChange={toggleSelectAll} disabled={loading || courses.length === 0} title="Select all" style={{ cursor: 'pointer' }} />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="cl-table-empty"><div className="cl-spinner" />Loading courses…</td></tr>
                ) : filteredCourses.length === 0 ? (
                  <tr><td colSpan={6} className="cl-table-empty">No courses found.</td></tr>
                ) : (
                  paginatedCourses.map((c, i) => {
                    const isSelected = selectedIds.has(c.course_id);
                    return (
                      <tr key={c.course_id} className={isSelected ? 'selected' : ''}>
                        <td className="cl-td-num">{(currentPage - 1) * effectiveItemsPerPage + i + 1}</td>
                        <td><span className="cl-id-badge">{c.course_id}</span></td>
                        <td>{c.course_name}</td>
                        <td>{c.term_name}</td>
                        <td style={{ fontSize: '12px', color: 'var(--cl-text-muted)' }}>
                          {c.user_ids?.map(id => {
                            const u = users.find(usr => usr.user_id === id);
                            return u ? formatName(u) : '';
                          }).filter(Boolean).join(', ') || '—'}
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <button type="button" className="cl-icon-btn edit" onClick={() => handleEdit(c)}>
                              <FaEdit style={{ fontSize: '11px' }} /> Edit
                            </button>
                            <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(c.course_id)} aria-label={`Select ${c.course_id}`} style={{ marginLeft: 'auto', cursor: 'pointer' }} />
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

      {/* ════ ADD / EDIT MODAL ════ */}
      {showModal && (
        <div className="cl-modal-overlay" onClick={() => { setShowModal(false); setEditMode(false); }}>
          <div className="cl-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="cl-modal-header">
              <h3>{editMode ? 'Edit Course' : 'Add Course'}</h3>
            </div>
            <div className="cl-modal-body">
              <div className="cl-field">
                <label>Course Code</label>
                <input
                  type="text"
                  className="cl-input"
                  value={newCourse.course_id}
                  disabled={editMode}
                  onChange={e => setNewCourse({ ...newCourse, course_id: e.target.value })}
                  placeholder="e.g. IT112"
                />
              </div>
              <div className="cl-field">
                <label>Course Name</label>
                <input
                  type="text"
                  className="cl-input"
                  value={newCourse.course_name}
                  onChange={e => setNewCourse({ ...newCourse, course_name: e.target.value })}
                  placeholder="e.g. Computer Programming 1"
                />
              </div>
              <div className="cl-field">
                <label>Term</label>
                <select
                  className="cl-input"
                  value={String(newCourse.term_id || '')}
                  onChange={e => setNewCourse({ ...newCourse, term_id: Number(e.target.value) })}
                >
                  <option value="">Select Term</option>
                  {terms.map(t => (
                    <option key={t.term_id} value={t.term_id}>{t.term_name} ({t.academic_year})</option>
                  ))}
                </select>
              </div>
              <div className="cl-field">
                <label>Instructors</label>
                <Select
                  isMulti
                  options={users.map(u => ({ value: u.user_id, label: formatName(u) }))}
                  value={users.filter(u => newCourse.user_ids.includes(u.user_id)).map(u => ({ value: u.user_id, label: formatName(u) }))}
                  onChange={selected => {
                    const ids = selected.map(opt => opt.value);
                    setNewCourse({ ...newCourse, user_ids: ids, leaders: newCourse.leaders.filter(l => ids.includes(l)) });
                  }}
                  styles={selectStyles}
                />
              </div>
              {newCourse.user_ids.length > 0 && (
                <div className="cl-field">
                  <label>Bayanihan Leaders</label>
                  <Select
                    isMulti
                    options={users.filter(u => newCourse.user_ids.includes(u.user_id)).map(u => ({ value: u.user_id, label: formatName(u) }))}
                    value={users.filter(u => newCourse.leaders.includes(u.user_id)).map(u => ({ value: u.user_id, label: formatName(u) }))}
                    onChange={selected => setNewCourse({ ...newCourse, leaders: selected.map(opt => opt.value) })}
                    styles={selectStyles}
                  />
                </div>
              )}
            </div>
            <div className="cl-modal-footer">
              <button type="button" className="cl-btn" onClick={() => { setShowModal(false); setEditMode(false); }}>Cancel</button>
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
              <h3>Import Courses</h3>
              <p>Must belong to an existing term with at least one instructor.</p>
            </div>
            <div className="cl-modal-body">
              <p className="cl-import-hint">Each course must have a unique Course ID.</p>
              <input type="file" accept=".xlsx,.xls" onChange={handleImport} disabled={isImporting} className="cl-file-input" />
              <button type="button" className="cl-btn" onClick={downloadTemplate} disabled={isImporting} style={{ width: '100%', justifyContent: 'center', marginTop: '8px' }}>
                <FaDownload style={{ fontSize: '11px' }} /> Download Template
              </button>
            </div>
            <div className="cl-modal-footer">
              <button type="button" className="cl-btn primary" onClick={() => setShowImport(false)} disabled={isImporting}>
                {isImporting ? 'Importing…' : 'Done'}
              </button>
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
                {deleteCount === 1 ? 'You are about to delete 1 course. This cannot be undone.' : `You are about to delete ${deleteCount} courses. This cannot be undone.`}
              </p>
            </div>
            <div className="cl-modal-footer">
              <button type="button" className="cl-btn" onClick={() => setShowDeleteConfirm(false)} disabled={isBulkDeleting}>Cancel</button>
              <button type="button" className="cl-btn danger-fill" onClick={confirmDelete} disabled={isBulkDeleting}>
                {isBulkDeleting ? 'Deleting…' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer position="top-right" autoClose={3000} />
    </div>
  );
};

export default Courses;
