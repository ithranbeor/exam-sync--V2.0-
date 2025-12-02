// deno-lint-ignore-file no-explicit-any
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { FaTrash, FaEdit, FaSearch, FaDownload,  FaPlus, FaFileImport, FaChevronLeft, FaChevronRight, FaSort, FaChevronDown } from 'react-icons/fa';
import { api } from '../lib/apiClient.ts';
import { ToastContainer, toast } from 'react-toastify';
import * as XLSX from 'xlsx';
import 'react-toastify/dist/ReactToastify.css';
import '../styles/colleges.css';
import Select from 'react-select';
import { useEscapeKey } from '../hooks/useEscapeKey';

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
  course?: Course;
  program?: Program;
  term?: Term;
  user?: User;
  course_id: string;
  program_id: string;
  term_id: number;
  user_id?: number;
  section_name: string;
  number_of_students: number;
  year_level: string;
  is_night_class?: string | null;
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

  const [newSection, setNewSection] = useState<SectionCourse>({
    course_id: '',
    program_id: '',
    term_id: 0,
    section_name: '',
    number_of_students: 0,
    year_level: '',
    is_night_class: "", // Changed from null
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

      // ✅ FIX: Extract data from the new response structure
      const secData = secRes.data?.data || secRes.data || [];  // Handle both formats
      const courseData = courseRes.data || [];
      const progData = progRes.data || [];
      const termData = termRes.data || [];
      const courseUserData = courseUserRes.data || [];

      setSectionCourses(secData);  // ✅ Use extracted array
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

  // Handle ESC key to close modals
  useEscapeKey(() => {
    if (showModal) {
      setShowModal(false);
      setEditMode(false);
      setNewSection({
        course_id: '',
        program_id: '',
        term_id: 0,
        section_name: '',
        number_of_students: 0,
        year_level: '',
        is_night_class: "",
      } as SectionCourse);
    }
  }, showModal);

  useEscapeKey(() => {
    if (showImport) {
      setShowImport(false);
    }
  }, showImport);

  useEffect(() => { 
    fetchAll(); 
  }, [fetchAll]);

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

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, sortBy]);

  const handleSubmit = async () => {
    const { course_id, program_id, section_name, number_of_students, year_level, term_id, user_id } = newSection;

    if (!course_id || !program_id || !section_name || !number_of_students || !year_level || !term_id || !user_id) {
      toast.error('All fields including instructor are required');
      return;
    }

    // Prevent double-click submission
    if (isSubmitting) {
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
      is_night_class: newSection.is_night_class === "YES" ? "YES" : "",
    };

    // ✅ IMPROVED: Better duplicate checking
    if (!editMode) {
      // Check for exact duplicate (all fields match)
      const exactDuplicate = sectionCourses.find(sc => 
        sc.course_id === course_id &&
        sc.program_id === program_id &&
        sc.section_name === section_name &&
        sc.term_id === term_id &&
        sc.user_id === user_id &&
        sc.number_of_students === number_of_students &&
        sc.year_level === year_level &&
        (sc.is_night_class === "YES" ? "YES" : "") === (newSection.is_night_class === "YES" ? "YES" : "")
      );

      if (exactDuplicate) {
        toast.error('❌ This exact section course already exists!');
        return;
      }

      // ✅ NEW: Check for section name conflict (same course, program, section name, term)
      const sectionConflict = sectionCourses.find(sc => 
        sc.course_id === course_id &&
        sc.program_id === program_id &&
        sc.section_name === section_name &&
        sc.term_id === term_id
      );

      if (sectionConflict) {
        const conflictDetails = 
          `Section "${section_name}" already exists for:\n` +
          `Course: ${course_id}\n` +
          `Program: ${program_id}\n` +
          `Term: ${terms.find(t => t.term_id === term_id)?.term_name || 'N/A'}\n` +
          `Instructor: ${sectionConflict.user?.full_name || 'N/A'}\n\n` +
          `Please use a different section name or edit the existing section.`;
        
        toast.error(conflictDetails, { autoClose: 7000 });
        return;
      }
    } else {
      // ✅ EDIT MODE: Check for conflicts with OTHER records (exclude current)
      const conflict = sectionCourses.find(sc => 
        sc.id !== newSection.id && // Exclude current record
        sc.course_id === course_id &&
        sc.program_id === program_id &&
        sc.section_name === section_name &&
        sc.term_id === term_id
      );

      if (conflict) {
        toast.error('❌ A section with this name already exists for this course, program, and term!');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      if (editMode) {
        const { status } = await api.put(`/tbl_sectioncourse/${newSection.id}/`, payload);
        if (status === 200) {
          toast.success('✅ Section updated successfully');
        } else {
          toast.error('❌ Failed to update section');
        }
      } else {
        const { status } = await api.post(`/tbl_sectioncourse/`, payload);
        if (status === 201) {
          toast.success('✅ Section added successfully');
        } else {
          toast.error('❌ Failed to add section');
        }
      }
      setShowModal(false);
      fetchAll();
    } catch (error: any) {
      console.error('Submit error:', error);
      const errorMsg = error.response?.data?.error || error.message || 'Request failed';
      toast.error(`❌ Error: ${errorMsg}`);
    } finally {
      setIsSubmitting(false);
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
        const errors: string[] = [];
        const warnings: string[] = [];
        
        // ✅ NEW: Track what we're about to import to detect duplicates within the import file itself
        const importMap = new Map<string, number>();
        
        for (let idx = 0; idx < rows.length; idx++) {
          const row = rows[idx];
          const rowNum = idx + 2; // +2 because Excel is 1-indexed and we have a header row
          
          const section_name = String(row['Section Name'] || '').trim();
          const number_of_students = parseInt(String(row['Number of Students'] || '0'));
          const year_level = String(row['Year Level'] || '').trim();
          const is_night_class = String(row['Night Class'] || '').trim().toUpperCase() === "YES" ? "YES" : "";
          const term_name = String(row['Term Name'] || '').trim();
          const course_id = String(row['Course ID'] || '').trim();
          const program_id = String(row['Program ID'] || '').trim();
          const instructor_names_raw = String(row['Instructor Name'] || '').trim();

          // Check for missing fields
          if (!section_name) {
            errors.push(`Row ${rowNum}: Missing Section Name`);
            continue;
          }
          if (!number_of_students || isNaN(number_of_students)) {
            errors.push(`Row ${rowNum}: Missing or invalid Number of Students`);
            continue;
          }
          if (!year_level) {
            errors.push(`Row ${rowNum}: Missing Year Level`);
            continue;
          }
          if (!term_name) {
            errors.push(`Row ${rowNum}: Missing Term Name`);
            continue;
          }
          if (!course_id) {
            errors.push(`Row ${rowNum}: Missing Course ID`);
            continue;
          }
          if (!program_id) {
            errors.push(`Row ${rowNum}: Missing Program ID`);
            continue;
          }

          // Validate course exists
          const courseExists = courses.find(c => c.course_id === course_id);
          if (!courseExists) {
            errors.push(`Row ${rowNum}: Course ID "${course_id}" not found`);
            continue;
          }

          // Validate program exists
          const programExists = programs.find(p => p.program_id === program_id);
          if (!programExists) {
            errors.push(`Row ${rowNum}: Program ID "${program_id}" not found`);
            continue;
          }

          // Validate term exists
          const term = terms.find(t => t.term_name === term_name);
          if (!term) {
            errors.push(`Row ${rowNum}: Term "${term_name}" not found`);
            continue;
          }

          // Handle instructor names (can be empty, single, or multiple comma-separated)
          if (!instructor_names_raw) {
            errors.push(`Row ${rowNum}: Instructor Name is required`);
            continue;
          }

          const availableInstructors = courseInstructorsMap[course_id] || [];
          
          // Split instructor names by comma and process each
          const instructorNames = instructor_names_raw.split(',').map(name => name.trim()).filter(name => name);
          
          if (instructorNames.length === 0) {
            errors.push(`Row ${rowNum}: Instructor Name is required`);
            continue;
          }

          let foundAtLeastOne = false;
          for (const instructor_name of instructorNames) {
            const user = availableInstructors.find(u => 
              u.full_name.toLowerCase() === instructor_name.toLowerCase()
            );
            
            if (!user) {
              if (availableInstructors.length > 0) {
                const availableNames = availableInstructors.map(i => i.full_name).join(', ');
                errors.push(`Row ${rowNum}: Instructor "${instructor_name}" not found for course "${course_id}". Available: ${availableNames}`);
              } else {
                errors.push(`Row ${rowNum}: Instructor "${instructor_name}" not found - no instructors assigned to course "${course_id}"`);
              }
              continue;
            }

            // ✅ NEW: Create unique key for duplicate detection
            const uniqueKey = `${course_id}|${program_id}|${section_name}|${term.term_id}|${user.user_id}`;
            
            // ✅ Check for duplicates in existing data
            const existingDuplicate = sectionCourses.find(sc => 
              sc.course_id === course_id &&
              sc.program_id === program_id &&
              sc.section_name === section_name &&
              sc.term_id === term.term_id &&
              sc.user_id === user.user_id
            );

            if (existingDuplicate) {
              warnings.push(`Row ${rowNum}: Section "${section_name}" already exists in database - skipping`);
              continue;
            }

            // ✅ Check for duplicates within the import file itself
            if (importMap.has(uniqueKey)) {
              const firstRow = importMap.get(uniqueKey);
              warnings.push(`Row ${rowNum}: Duplicate of row ${firstRow} - skipping`);
              continue;
            }

            // ✅ Check for section name conflicts (same section name for same course/program/term but different instructor)
            const existingSection = sectionCourses.find(sc =>
              sc.course_id === course_id &&
              sc.program_id === program_id &&
              sc.section_name === section_name &&
              sc.term_id === term.term_id
            );

            if (existingSection) {
              warnings.push(`Row ${rowNum}: Section "${section_name}" already exists with instructor "${existingSection.user?.full_name}" - skipping`);
              continue;
            }

            foundAtLeastOne = true;
            importMap.set(uniqueKey, rowNum);
            
            validRows.push({
              course_id, 
              program_id, 
              section_name, 
              number_of_students, 
              year_level,
              term_id: term.term_id, 
              user_id: user.user_id, 
              is_night_class
            } as SectionCourse);
          }

          if (!foundAtLeastOne && instructorNames.length > 0) {
            errors.push(`Row ${rowNum}: None of the specified instructors were found or all entries were duplicates`);
          }
        }

        // Show errors and warnings
        if (errors.length > 0) {
          console.error('Import errors:', errors);
          toast.error(`❌ ${errors.length} error(s) found. Check console for details.`, { autoClose: 5000 });
        }

        if (warnings.length > 0) {
          console.warn('Import warnings:', warnings);
          toast.warning(`⚠️ ${warnings.length} duplicate(s) skipped. Check console for details.`, { autoClose: 5000 });
        }

        if (validRows.length === 0) {
          if (errors.length === 0 && warnings.length > 0) {
            toast.info('ℹ️ All rows were duplicates - nothing to import');
          } else {
            toast.warning('⚠️ No valid rows to import');
          }
          setShowImport(false);
          setIsImporting(false);
          return;
        }

        // ✅ Import valid rows in batches
        let added = 0;
        let failed = 0;
        const batchSize = 10;

        for (let i = 0; i < validRows.length; i += batchSize) {
          const batch = validRows.slice(i, i + batchSize);
          
          const results = await Promise.allSettled(
            batch.map(payload => api.post('/tbl_sectioncourse/', payload))
          );
          
          results.forEach((result, index) => {
            if (result.status === 'fulfilled' && (result.value.status === 200 || result.value.status === 201)) {
              added++;
            } else {
              failed++;
              if (result.status === 'rejected') {
                console.error(`Failed to import row:`, batch[index], result.reason);
              }
            }
          });
        }

        // Show final summary
        const messages = [];
        if (added > 0) messages.push(`✅ ${added} section(s) added`);
        if (failed > 0) messages.push(`❌ ${failed} failed`);
        if (warnings.length > 0) messages.push(`⚠️ ${warnings.length} skipped`);

        if (added > 0) {
          toast.success(`Import completed: ${messages.join(', ')}`, { autoClose: 5000 });
        } else if (failed > 0 || warnings.length > 0) {
          toast.info(`Import completed: ${messages.join(', ')}`, { autoClose: 5000 });
        }

        fetchAll();
      } catch (error) {
        console.error('Import error:', error);
        toast.error('❌ Import failed. Check console for details.');
      } finally {
        setShowImport(false);
        setIsImporting(false);
      }
    };

    reader.readAsArrayBuffer(file);
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['Course ID','Program ID','Section Name','Number of Students','Year Level','Term Name','Instructor Name','Night Class'],
      ['IT 112','BSIT','IT 1R1','30','1st Year','1st Semester','Ithran Beor Turno','YES or Leave it blank']
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'SectionCourses Template');
    XLSX.writeFile(wb, 'sectioncourses_template.xlsx');
  };

  // Helper function to determine if a string is numeric
  const isNumeric = (str: string): boolean => {
    return !isNaN(Number(str)) && !isNaN(parseFloat(str));
  };

  // Smart sort function that handles both text and numbers
  const smartSort = (a: string, b: string): number => {
    const aIsNumeric = isNumeric(a);
    const bIsNumeric = isNumeric(b);

    if (aIsNumeric && bIsNumeric) {
      // Both are numbers - sort numerically
      return parseFloat(a) - parseFloat(b);
    } else if (aIsNumeric && !bIsNumeric) {
      // a is number, b is text - numbers come first
      return -1;
    } else if (!aIsNumeric && bIsNumeric) {
      // a is text, b is number - numbers come first
      return 1;
    } else {
      // Both are text - sort alphabetically
      return a.localeCompare(b);
    }
  };

  const filtered = useMemo(() => {
    let filtered = sectionCourses;
    
    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      filtered = sectionCourses.filter(sc => {
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
    }

    // Apply sorting
    if (sortBy !== 'none') {
      filtered = [...filtered].sort((a, b) => {
        if (sortBy === 'section_name') {
          return smartSort(a.section_name.toLowerCase(), b.section_name.toLowerCase());
        } else if (sortBy === 'course') {
          const aCourse = a.course?.course_name || a.course_id || '';
          const bCourse = b.course?.course_name || b.course_id || '';
          return smartSort(aCourse.toLowerCase(), bCourse.toLowerCase());
        } else if (sortBy === 'program') {
          const aProgram = a.program?.program_name || a.program_id || '';
          const bProgram = b.program?.program_name || b.program_id || '';
          return smartSort(aProgram.toLowerCase(), bProgram.toLowerCase());
        } else if (sortBy === 'students') {
          return a.number_of_students - b.number_of_students;
        } else if (sortBy === 'year') {
          return smartSort(a.year_level.toLowerCase(), b.year_level.toLowerCase());
        } else if (sortBy === 'term') {
          const aTerm = a.term?.term_name || '';
          const bTerm = b.term?.term_name || '';
          return smartSort(aTerm.toLowerCase(), bTerm.toLowerCase());
        } else if (sortBy === 'instructor') {
          const aInstructor = a.user?.full_name || '';
          const bInstructor = b.user?.full_name || '';
          return smartSort(aInstructor.toLowerCase(), bInstructor.toLowerCase());
        }
        return 0;
      });
    }
    // Note: Removed default sort to improve performance - only sort when explicitly requested

    return filtered;
  }, [searchTerm, sectionCourses, sortBy]);

  const paginated = useMemo(() => {
    if (itemsPerPage === 'all') {
      return filtered;
    }
    return filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  }, [filtered, currentPage, itemsPerPage]);

  const totalPages = useMemo(() => {
    if (itemsPerPage === 'all') {
      return 1;
    }
    return Math.ceil(filtered.length / itemsPerPage);
  }, [filtered.length, itemsPerPage]);

  const toggleSelect = (id: string | number | undefined) => {
    if (id === undefined) return;
    const key = String(id);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const isAllSelected = sectionCourses.length > 0 && sectionCourses.every((sc) => selectedIds.has(String(sc.id || '')));

  const toggleSelectAll = () => {
    setSelectedIds(() => {
      if (isAllSelected) return new Set();
      const all = new Set<string>();
      sectionCourses.forEach((sc) => {
        if (sc.id !== undefined) all.add(String(sc.id));
      });
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
  }, [sectionCourses, searchTerm, loading, currentPage]);

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

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) {
      toast.info('No sections selected');
      return;
    }
    if (!globalThis.confirm(`Delete ${ids.length} selected section course(s)?`)) return;
    setIsBulkDeleting(true);
    try {
      const results = await Promise.allSettled(ids.map((id) => api.delete(`/tbl_sectioncourse/${id}/`)));
      const ok = results.filter((r) => r.status === 'fulfilled').length;
      const fail = results.length - ok;
      if (ok) toast.success(`Deleted ${ok} section(s)`);
      if (fail) toast.error(`${fail} failed to delete`);
      clearSelection();
      await fetchAll();
      setCurrentPage(1);
    } catch {
      toast.error('Bulk delete failed');
    } finally {
      setIsBulkDeleting(false);
    }
  };

  return (
    <div className="colleges-container">
      <div className="colleges-header">
        <div className="search-bar" style={{ marginLeft: 'auto' }}>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
          <FaPlus/>
        </button>
            <button type='button' className="action-button import" onClick={() => setShowImport(true)}><FaFileImport/></button>
            <div style={{ position: 'relative' }} data-sort-dropdown>
              <button 
                type='button' 
                className="action-button" 
                onClick={() => setShowSortDropdown(!showSortDropdown)}
                style={{ 
                  backgroundColor: sortBy !== 'none' ? '#0A3765' : '#0A3765',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  minWidth: '100px',
                  transition: 'background-color 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#0d4a7a';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#0A3765';
                }}
                title="Sort by"
              >
                <FaSort/>
                <span>Sort by</span>
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
                      setSortBy('section_name');
                      setShowSortDropdown(false);
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      textAlign: 'left',
                      border: 'none',
                      backgroundColor: sortBy === 'section_name' ? '#f0f0f0' : 'white',
                      color: '#000',
                      cursor: 'pointer',
                      fontSize: '14px',
                      borderTop: '1px solid #eee'
                    }}
                    onMouseEnter={(e) => {
                      if (sortBy !== 'section_name') e.currentTarget.style.backgroundColor = '#f5f5f5';
                    }}
                    onMouseLeave={(e) => {
                      if (sortBy !== 'section_name') e.currentTarget.style.backgroundColor = 'white';
                    }}
                  >
                    Section
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSortBy('course');
                      setShowSortDropdown(false);
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      textAlign: 'left',
                      border: 'none',
                      backgroundColor: sortBy === 'course' ? '#f0f0f0' : 'white',
                      color: '#000',
                      cursor: 'pointer',
                      fontSize: '14px',
                      borderTop: '1px solid #eee'
                    }}
                    onMouseEnter={(e) => {
                      if (sortBy !== 'course') e.currentTarget.style.backgroundColor = '#f5f5f5';
                    }}
                    onMouseLeave={(e) => {
                      if (sortBy !== 'course') e.currentTarget.style.backgroundColor = 'white';
                    }}
                  >
                    Course
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSortBy('program');
                      setShowSortDropdown(false);
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      textAlign: 'left',
                      border: 'none',
                      backgroundColor: sortBy === 'program' ? '#f0f0f0' : 'white',
                      color: '#000',
                      cursor: 'pointer',
                      fontSize: '14px',
                      borderTop: '1px solid #eee'
                    }}
                    onMouseEnter={(e) => {
                      if (sortBy !== 'program') e.currentTarget.style.backgroundColor = '#f5f5f5';
                    }}
                    onMouseLeave={(e) => {
                      if (sortBy !== 'program') e.currentTarget.style.backgroundColor = 'white';
                    }}
                  >
                    Program
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSortBy('students');
                      setShowSortDropdown(false);
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      textAlign: 'left',
                      border: 'none',
                      backgroundColor: sortBy === 'students' ? '#f0f0f0' : 'white',
                      color: '#000',
                      cursor: 'pointer',
                      fontSize: '14px',
                      borderTop: '1px solid #eee'
                    }}
                    onMouseEnter={(e) => {
                      if (sortBy !== 'students') e.currentTarget.style.backgroundColor = '#f5f5f5';
                    }}
                    onMouseLeave={(e) => {
                      if (sortBy !== 'students') e.currentTarget.style.backgroundColor = 'white';
                    }}
                  >
                    Students
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSortBy('year');
                      setShowSortDropdown(false);
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      textAlign: 'left',
                      border: 'none',
                      backgroundColor: sortBy === 'year' ? '#f0f0f0' : 'white',
                      color: '#000',
                      cursor: 'pointer',
                      fontSize: '14px',
                      borderTop: '1px solid #eee'
                    }}
                    onMouseEnter={(e) => {
                      if (sortBy !== 'year') e.currentTarget.style.backgroundColor = '#f5f5f5';
                    }}
                    onMouseLeave={(e) => {
                      if (sortBy !== 'year') e.currentTarget.style.backgroundColor = 'white';
                    }}
                  >
                    Year
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
                  <button
                    type="button"
                    onClick={() => {
                      setSortBy('instructor');
                      setShowSortDropdown(false);
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      textAlign: 'left',
                      border: 'none',
                      backgroundColor: sortBy === 'instructor' ? '#f0f0f0' : 'white',
                      color: '#000',
                      cursor: 'pointer',
                      fontSize: '14px',
                      borderTop: '1px solid #eee'
                    }}
                    onMouseEnter={(e) => {
                      if (sortBy !== 'instructor') e.currentTarget.style.backgroundColor = '#f5f5f5';
                    }}
                    onMouseLeave={(e) => {
                      if (sortBy !== 'instructor') e.currentTarget.style.backgroundColor = 'white';
                    }}
                  >
                    Instructor
                  </button>
                </div>
              )}
            </div>
            <div style={{ position: 'relative' }} data-items-per-page-dropdown>
              <button
                type="button"
                className="action-button"
                onClick={() => setShowItemsPerPageDropdown(!showItemsPerPageDropdown)}
                style={{
                  backgroundColor: '#0A3765',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  width: 'auto',
                  minWidth: 'fit-content',
                  whiteSpace: 'nowrap',
                  transition: 'background-color 0.2s ease',
                  height: '38px',
                  boxSizing: 'border-box'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#0d4a7a';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#0A3765';
                }}
              >
                <span>Show rows: {itemsPerPage === 'all' ? 'All' : itemsPerPage}</span>
                <FaChevronDown size={12} />
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
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              className="action-button delete"
              onClick={handleBulkDelete}
              disabled={isBulkDeleting || selectedIds.size === 0}
              title={selectedIds.size ? `Delete ${selectedIds.size} selected` : 'Delete selected'}
            >
              <FaTrash/>
            </button>
          </div>
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
              <th>Course</th>
              <th>Program</th>
              <th>Section</th>
              <th>Students</th>
              <th>Year</th>
              <th>Term</th>
              <th>Instructor</th>
              <th>Night Class</th>
              <th>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>Actions</span>
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={toggleSelectAll}
                    disabled={loading || sectionCourses.length === 0}
                    aria-label="Select all"
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
                <td colSpan={10} style={{ textAlign: 'center', padding: '20px' }}>
                  Loading sections with courses...
                </td>
              </tr>
            ) : paginated.length === 0 ? (
              <tr>
                <td colSpan={10} style={{ textAlign: 'center', padding: '20px' }}>
                  No sections with courses.
                </td>
              </tr>
            ) : (
              paginated.map((sc, i) => {
                const isSelected = selectedIds.has(String(sc.id));
                return (
                <tr 
                  key={sc.id || i}
                  style={{
                    backgroundColor: isSelected ? '#f8d7da' : 'transparent',
                  }}
                >
                  <td>{itemsPerPage === 'all' ? i + 1 : (currentPage - 1) * itemsPerPage + i + 1}</td>
                  <td>{sc.course?.course_name || sc.course_id}</td>
                  <td>{sc.program?.program_name || sc.program_id}</td>
                  <td>{sc.section_name}</td>
                  <td>{sc.number_of_students}</td>
                  <td>{sc.year_level}</td>
                  <td>{sc.term?.term_name || 'N/A'}</td>
                  <td>{sc.user?.full_name || 'N/A'}</td>
                  <td>{sc.is_night_class === "YES" ? "YES" : ""}</td>
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
                          is_night_class: sc.is_night_class === "YES" ? "YES" : "" // Changed from null
                        });
                        setShowModal(true);
                      }}
                    >
                      <FaEdit />
                    </button>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(String(sc.id))}
                      onChange={() => toggleSelect(sc.id)}
                      aria-label={`Select ${sc.section_name}`}
                      style={{ marginLeft: 'auto' }}
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
                <option value="5th Year">5th Year</option>
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
                    {t.term_name}
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
            <div className="input-group">
              <label>Night Class?</label>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <input
                  type="checkbox"
                  checked={newSection.is_night_class === "YES"}
                  onChange={(e) =>
                    setNewSection({
                      ...newSection,
                      is_night_class: e.target.checked ? "YES" : "",
                    })
                  }
                />
                <span style={{color: 'black'}}>YES</span>
              </div>
            </div>

            <div className="modal-actions">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                style={isSubmitting ? { opacity: 0.6, cursor: 'not-allowed' } : {}}
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