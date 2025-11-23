// deno-lint-ignore-file no-explicit-any
import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { FaTrash, FaEdit, FaSearch, FaDownload,  FaPlus, FaFileImport, FaChevronLeft, FaChevronRight } from "react-icons/fa";
import { api } from "../lib/apiClient.ts";
import { ToastContainer, toast } from "react-toastify";
import * as XLSX from "xlsx";
import "react-toastify/dist/ReactToastify.css";
import "../styles/colleges.css";
import Select from "react-select";

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

const Courses: React.FC = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const tableContainerRef = useRef<HTMLDivElement>(null);

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

  // ✅ Optimized useEffect for faster load
  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      setLoading(true);
      try {
        const coursesPromise = api.get("/courses/");
        const othersPromise = Promise.all([
          api.get("/tbl_term"),
          api.get("/users/"),
        ]);

        // Fetch courses first to show them immediately
        const { data: coursesData } = await coursesPromise;
        if (mounted) setCourses(coursesData);

        // Fetch terms and users in background
        const [termsRes, usersRes] = await othersPromise;
        if (mounted) {
          setTerms(termsRes.data);
          setUsers(usersRes.data);
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

  // ✅ Prevent re-fetch race conditions
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

  // 🧠 Memoize filtered results
  const filteredCourses = useMemo(
    () =>
      courses.filter(
        (c) =>
          c.course_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          c.course_id.toLowerCase().includes(searchTerm.toLowerCase())
      ),
    [courses, searchTerm]
  );

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
        await api.put(`/courses/${course_id}/`, {
          course_id, // include this for backend consistency
          course_name,
          term_id,
          user_ids,
          leaders,
        });
        toast.success("successfully updated");
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
  }, [newCourse, editMode, fetchCourses]);

  // ✅ Fix Edit button handler (correctly loads full editable data)
  const handleEdit = (course: Course) => {
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
      .replace(/\u00A0/g, " ")      // remove non-breaking spaces
      .replace(/\t/g, " ")          // remove hidden tabs
      .trim()
      .toLowerCase();


  // --- IMPORT FUNCTION FIX ---
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
          // still clean invisible characters but DO NOT lowercase
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

          // --- TERM MATCHING EXACTLY LIKE MANUAL ADD (no academic year) ---
          const term = terms.find(
            (t) => clean(t.term_name) === term_full
          );

          if (!term) {
            toast.error(`Row skipped (${row["Course ID"]}): Term not found.`);
            errorCount++;
            continue;
          }

          // --- INSTRUCTOR MATCHING ---
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
            // no instructors provided
            instructorIds = [];
          }

          // --- POST EXACTLY THE SAME STRUCTURE AS MANUAL ADD ---
          try {
            await api.post("/courses/", {
              course_id,
              course_name,
              term_id: term.term_id,
              user_ids: instructorIds,
              leaders: [],     // import same behavior as manual add
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

  // Download Excel template (unchanged)
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
        <h2 className="colleges-title">Manage Courses</h2>
        <div className="search-bar">
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
              className="action-button add-new"
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
              <FaPlus/>
            </button>
            <button
              type="button"
              className="action-button import"
              onClick={() => setShowImport(true)}
            >
              <FaFileImport/>
            </button>
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
              filteredCourses.map((c, i) => (
                <tr key={c.course_id}>
                  <td>{i + 1}</td>
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
                      <FaEdit />
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
              ))
            )}
          </tbody>
        </table>
        </div>
      </div>

      {/* ✅ Modals and Toast unchanged */}
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
