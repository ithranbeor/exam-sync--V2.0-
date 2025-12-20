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

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) {
      toast.info("No courses selected");
      return;
    }
    if (!globalThis.confirm(`Delete ${ids.length} selected course(s)?`)) return;
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
    <div className="colleges-container">
      <div className="colleges-header">
        <div className="search-bar" style={{ marginLeft: 'auto' }}>
          <input
            type="text"
            placeholder="Search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button type="button" className="search-button">
            <FaSearch />
          </button>
        </div>
      </div>

      <div className="colleges-actions">
        <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              type="button"
              className="action-button add-new with-label"
              onClick={() => {
                setNewCourse({
                  course_id: "",
                  course_name: "",
                  term_id: 0,
                  user_ids: [],
                  leaders: [],
                });
                setEditMode(false);
                setShowModal(true);
              }}
            >
              <FaPlus /><span className="btn-label">Add</span>
            </button>
            <button
              type="button"
              className="action-button import with-label"
              onClick={() => setShowImport(true)}
            >
              <FaFileImport /><span className="btn-label">Import</span>
            </button>
            <div style={{ position: 'relative' }} data-sort-dropdown>
              <button
                type='button'
                className="action-button with-label sort-by-button"
                onClick={() => setShowSortDropdown(!showSortDropdown)}
                title="Sort by"
              >
                <FaSort />
                <span className="btn-label">Sort by</span>
              </button>
              {showSortDropdown && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    marginTop: '4px',
                    backgroundColor: 'white',
                    border: '1px solid #ddd',
                    borderRadius: '8px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                    zIndex: 1000,
                    minWidth: '150px'
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setSortBy('none');
                      setShowSortDropdown(false);
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      textAlign: 'left',
                      border: 'none',
                      backgroundColor: sortBy === 'none' ? '#f0f0f0' : 'white',
                      color: '#000',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                    onMouseEnter={(e) => {
                      if (sortBy !== 'none') e.currentTarget.style.backgroundColor = '#f5f5f5';
                    }}
                    onMouseLeave={(e) => {
                      if (sortBy !== 'none') e.currentTarget.style.backgroundColor = 'white';
                    }}
                  >
                    None
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSortBy('course_id');
                      setShowSortDropdown(false);
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      textAlign: 'left',
                      border: 'none',
                      backgroundColor: sortBy === 'course_id' ? '#f0f0f0' : 'white',
                      color: '#000',
                      cursor: 'pointer',
                      fontSize: '14px',
                      borderTop: '1px solid #eee'
                    }}
                    onMouseEnter={(e) => {
                      if (sortBy !== 'course_id') e.currentTarget.style.backgroundColor = '#f5f5f5';
                    }}
                    onMouseLeave={(e) => {
                      if (sortBy !== 'course_id') e.currentTarget.style.backgroundColor = 'white';
                    }}
                  >
                    Course Code
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSortBy('course_name');
                      setShowSortDropdown(false);
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      textAlign: 'left',
                      border: 'none',
                      backgroundColor: sortBy === 'course_name' ? '#f0f0f0' : 'white',
                      color: '#000',
                      cursor: 'pointer',
                      fontSize: '14px',
                      borderTop: '1px solid #eee'
                    }}
                    onMouseEnter={(e) => {
                      if (sortBy !== 'course_name') e.currentTarget.style.backgroundColor = '#f5f5f5';
                    }}
                    onMouseLeave={(e) => {
                      if (sortBy !== 'course_name') e.currentTarget.style.backgroundColor = 'white';
                    }}
                  >
                    Course Name
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSortBy('term');
                      setShowSortDropdown(false);
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      textAlign: 'left',
                      border: 'none',
                      backgroundColor: sortBy === 'term' ? '#f0f0f0' : 'white',
                      color: '#000',
                      cursor: 'pointer',
                      fontSize: '14px',
                      borderTop: '1px solid #eee'
                    }}
                    onMouseEnter={(e) => {
                      if (sortBy !== 'term') e.currentTarget.style.backgroundColor = '#f5f5f5';
                    }}
                    onMouseLeave={(e) => {
                      if (sortBy !== 'term') e.currentTarget.style.backgroundColor = 'white';
                    }}
                  >
                    Term
                  </button>
                </div>
              )}
            </div>
            {/* removed left-side college popover - using right-side select like UserManagement */}
            <div style={{ position: 'relative' }} data-items-per-page-dropdown>
              <button
                type="button"
                className="action-button with-label show-rows-button"
                onClick={() => setShowItemsPerPageDropdown(!showItemsPerPageDropdown)}
              >
                <FaChevronDown size={12} />
                <span className="btn-label">Show rows: {itemsPerPage === 'all' ? 'All' : itemsPerPage}</span>
              </button>
              {showItemsPerPageDropdown && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    marginTop: '4px',
                    backgroundColor: 'white',
                    border: '1px solid #ddd',
                    borderRadius: '8px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                    zIndex: 1000,
                    minWidth: '240px',
                    padding: '8px'
                  }}
                >
                  <button
                    type="button"
                    onClick={() => handleItemsPerPageChange(10)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      textAlign: 'left',
                      border: 'none',
                      backgroundColor: itemsPerPage === 10 ? '#f0f0f0' : 'white',
                      color: '#000',
                      cursor: 'pointer',
                      fontSize: '14px',
                      borderRadius: '4px'
                    }}
                    onMouseEnter={(e) => {
                      if (itemsPerPage !== 10) e.currentTarget.style.backgroundColor = '#f5f5f5';
                    }}
                    onMouseLeave={(e) => {
                      if (itemsPerPage !== 10) e.currentTarget.style.backgroundColor = 'white';
                    }}
                  >
                    10
                  </button>
                  <button
                    type="button"
                    onClick={() => handleItemsPerPageChange(20)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      textAlign: 'left',
                      border: 'none',
                      backgroundColor: itemsPerPage === 20 ? '#f0f0f0' : 'white',
                      color: '#000',
                      cursor: 'pointer',
                      fontSize: '14px',
                      borderRadius: '4px',
                      borderTop: '1px solid #eee'
                    }}
                    onMouseEnter={(e) => {
                      if (itemsPerPage !== 20) e.currentTarget.style.backgroundColor = '#f5f5f5';
                    }}
                    onMouseLeave={(e) => {
                      if (itemsPerPage !== 20) e.currentTarget.style.backgroundColor = 'white';
                    }}
                  >
                    20
                  </button>
                  <button
                    type="button"
                    onClick={() => handleItemsPerPageChange(30)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      textAlign: 'left',
                      border: 'none',
                      backgroundColor: itemsPerPage === 30 ? '#f0f0f0' : 'white',
                      color: '#000',
                      cursor: 'pointer',
                      fontSize: '14px',
                      borderRadius: '4px',
                      borderTop: '1px solid #eee'
                    }}
                    onMouseEnter={(e) => {
                      if (itemsPerPage !== 30) e.currentTarget.style.backgroundColor = '#f5f5f5';
                    }}
                    onMouseLeave={(e) => {
                      if (itemsPerPage !== 30) e.currentTarget.style.backgroundColor = 'white';
                    }}
                  >
                    30
                  </button>
                  <div style={{ borderTop: '1px solid #eee', marginTop: '4px', paddingTop: '8px' }}>
                    <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
                      <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
                        <input
                          type="number"
                          data-custom-input
                          className="custom-number-input"
                          value={customItemsPerPage}
                          onChange={(e) => setCustomItemsPerPage(e.target.value)}
                          placeholder="Custom Number"
                          min="1"
                          style={{
                            width: '100%',
                            padding: '6px 32px 6px 8px',
                            border: '1px solid #0A3765',
                            borderRadius: '4px',
                            fontSize: '14px',
                            backgroundColor: '#ffffff',
                            color: '#333',
                            outline: 'none'
                          }}
                          onFocus={(e) => {
                            e.target.style.borderColor = '#0d4a7a';
                            e.target.style.boxShadow = '0 0 0 2px rgba(10, 55, 101, 0.1)';
                          }}
                          onBlur={(e) => {
                            e.target.style.borderColor = '#0A3765';
                            e.target.style.boxShadow = 'none';
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleCustomItemsPerPage();
                            }
                          }}
                        />
                        <div style={{ position: 'absolute', right: '2px', display: 'flex', flexDirection: 'column', height: 'calc(100% - 4px)', gap: '0px', justifyContent: 'center', alignItems: 'center' }}>
                          <button
                            type="button"
                            onClick={() => {
                              const current = parseInt(customItemsPerPage) || 1;
                              setCustomItemsPerPage(String(current + 1));
                            }}
                            style={{
                              height: 'auto',
                              background: 'transparent',
                              border: 'none',
                              color: '#0A3765',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '10px',
                              fontWeight: 'bold',
                              padding: '0',
                              width: '16px',
                              lineHeight: '1',
                              transition: 'color 0.2s',
                              borderRadius: '0',
                              boxSizing: 'border-box'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.color = '#0d4a7a';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.color = '#0A3765';
                            }}
                          >
                            ^
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const current = parseInt(customItemsPerPage) || 1;
                              if (current > 1) {
                                setCustomItemsPerPage(String(current - 1));
                              }
                            }}
                            style={{
                              height: 'auto',
                              background: 'transparent',
                              border: 'none',
                              color: '#0A3765',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '10px',
                              fontWeight: 'bold',
                              padding: '0',
                              width: '16px',
                              lineHeight: '1',
                              transition: 'color 0.2s',
                              borderRadius: '0',
                              boxSizing: 'border-box'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.color = '#0d4a7a';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.color = '#0A3765';
                            }}
                          >
                            v
                          </button>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleCustomItemsPerPage}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: '#0A3765',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}
                      >
                        Apply
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleItemsPerPageChange('all')}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        textAlign: 'left',
                        border: 'none',
                        backgroundColor: itemsPerPage === 'all' ? '#f0f0f0' : 'white',
                        color: '#000',
                        cursor: 'pointer',
                        fontSize: '14px',
                        borderRadius: '4px',
                        marginTop: '4px'
                      }}
                      onMouseEnter={(e) => {
                        if (itemsPerPage !== 'all') e.currentTarget.style.backgroundColor = '#f5f5f5';
                      }}
                      onMouseLeave={(e) => {
                        if (itemsPerPage !== 'all') e.currentTarget.style.backgroundColor = 'white';
                      }}
                    >
                      Show All
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div className="input-group" style={{ marginBottom: 0, marginLeft: '8px' }}>
              <select
                value={selectedCollege}
                onChange={(e) => setSelectedCollege(e.target.value)}
                className="college-filter-select"
              >
                <option value="all">All Colleges</option>
                {colleges.map((college) => (
                  <option key={college.college_id} value={college.college_id}>
                    {college.college_name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
            <button
              type="button"
              className="action-button delete"
              onClick={handleBulkDelete}
              disabled={isBulkDeleting || selectedIds.size === 0}
              title={selectedIds.size > 0 ? `Delete ${selectedIds.size} selected` : "Delete selected"}
            >
              <FaTrash />
            </button>
          </div>
        </div>
      </div>

      <div className="pagination-controls">
        <button
          type="button"
          className="pagination-arrow-btn"
          onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
          disabled={currentPage <= 1 || totalItems === 0}
        >
          {"<"}
        </button>
        <span className="pagination-page-number">
          {totalItems === 0 ? '0/0' : `${currentPage}/${totalPages}`}
        </span>
        <button
          type="button"
          className="pagination-arrow-btn"
          onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
          disabled={currentPage >= totalPages || totalItems === 0}
        >
          {">"}
        </button>
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
                <th>Course Code</th>
                <th>Course Name</th>
                <th>Term</th>
                <th>Instructors</th>
                <th>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span>Actions</span>
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      onChange={toggleSelectAll}
                      disabled={loading || courses.length === 0}
                      aria-label="Select all"
                      title="Select all"
                      style={{ marginLeft: "auto" }}
                    />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: "20px" }}>
                    Loading courses...
                  </td>
                </tr>
              ) : filteredCourses.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: "20px" }}>
                    No courses found.
                  </td>
                </tr>
              ) : (
                paginatedCourses.map((c, i) => {
                  const isSelected = selectedIds.has(c.course_id);
                  return (
                    <tr
                      key={c.course_id}
                      style={{
                        backgroundColor: isSelected ? '#f8d7da' : 'transparent',
                      }}
                    >
                      <td>{(currentPage - 1) * effectiveItemsPerPage + i + 1}</td>
                      <td>{c.course_id}</td>
                      <td>{c.course_name}</td>
                      <td>{c.term_name}</td>
                      <td>
                        {c.user_ids
                          ?.map((id) => {
                            const u = users.find((usr) => usr.user_id === id);
                            return u ? formatName(u) : "";
                          })
                          .join(", ")}
                      </td>
                      <td className="action-buttons" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <button type='button' className="icon-button edit-button" onClick={() => handleEdit(c)}>
                          <FaEdit />Edit
                        </button>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(c.course_id)}
                          onChange={() => toggleSelect(c.course_id)}
                          aria-label={`Select ${c.course_id}`}
                          style={{ marginLeft: "auto" }}
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3 style={{ textAlign: "center" }}>
              {editMode ? "Edit Course" : "Add Course"}
            </h3>

            <div className="input-group">
              <label>Course Code</label>
              <input
                type="text"
                value={newCourse.course_id}
                disabled={false}  
                onChange={(e) =>
                  setNewCourse({ ...newCourse, course_id: e.target.value })
                }
              />
            </div>

            <div className="input-group">
              <label>Course Code</label>
              <input
                type="text"
                value={newCourse.course_id}
                disabled={editMode}
                onChange={(e) =>
                  setNewCourse({ ...newCourse, course_id: e.target.value })
                }
              />
            </div>

            <div className="input-group">
              <label>Course Name</label>
              <input
                type="text"
                value={newCourse.course_name}
                onChange={(e) =>
                  setNewCourse({ ...newCourse, course_name: e.target.value })
                }
              />
            </div>

            <div className="input-group">
              <label>Term</label>
              <select
                value={String(newCourse.term_id || "")}
                onChange={(e) =>
                  setNewCourse({
                    ...newCourse,
                    term_id: Number(e.target.value),
                  })
                }
              >
                <option value="">Select Term</option>
                {terms.map((t) => (
                  <option key={t.term_id} value={t.term_id}>
                    {t.term_name} ({t.academic_year})
                  </option>
                ))}
              </select>
            </div>

            <div className="input-group">
              <label>Instructors</label>
              <Select
                isMulti
                options={users.map((u) => ({
                  value: u.user_id,
                  label: formatName(u),
                }))}
                value={users
                  .filter((u) => newCourse.user_ids.includes(u.user_id))
                  .map((u) => ({
                    value: u.user_id,
                    label: formatName(u),
                  }))}
                onChange={(selected) => {
                  const ids = selected.map((opt) => opt.value);
                  setNewCourse({
                    ...newCourse,
                    user_ids: ids,
                    leaders: newCourse.leaders.filter((l) => ids.includes(l)),
                  });
                }}
              />
            </div>

            {newCourse.user_ids.length > 0 && (
              <div className="input-group">
                <label>Bayanihan Leaders</label>
                <Select
                  isMulti
                  options={users
                    .filter((u) => newCourse.user_ids.includes(u.user_id))
                    .map((u) => ({
                      value: u.user_id,
                      label: formatName(u),
                    }))}
                  value={users
                    .filter((u) => newCourse.leaders.includes(u.user_id))
                    .map((u) => ({
                      value: u.user_id,
                      label: formatName(u),
                    }))}
                  onChange={(selected) =>
                    setNewCourse({
                      ...newCourse,
                      leaders: selected.map((opt) => opt.value),
                    })
                  }
                />
              </div>
            )}

            <div className="modal-actions">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Saving..." : "Save"}
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
            <h3 style={{ textAlign: "center" }}>Import Courses</h3>
            <p style={{ fontSize: '12px', color: '#666', marginBottom: '10px' }}>
              Each course must belong to an existing term and have at least one instructor.
            </p>

            <input type="file" accept=".xlsx,.xls" onChange={handleImport} disabled={isImporting} />

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

export default Courses;
