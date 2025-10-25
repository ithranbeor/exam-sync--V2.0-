// deno-lint-ignore-file no-explicit-any
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { FaTrash, FaEdit, FaSearch, FaDownload } from "react-icons/fa";
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

  // Delete
  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await api.delete(`/courses/${id}/`);
        toast.success("Course deleted");
        fetchCourses();
      } catch {
        toast.error("Failed to delete course");
      }
    },
    [fetchCourses]
  );

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

  // Handle import (unchanged)
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: "binary" });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws);

      let successCount = 0;

      for (const row of data as any[]) {
        const course_id = row["Course ID"]?.trim();
        const course_name = row["Course Name"]?.trim();
        const term_full = row["Term Name (Academic Year)"]?.trim();
        const instructors_raw = row["Instructor Full Names"]?.trim();

        if (!course_id || !course_name || !term_full || !instructors_raw) continue;

        const [termName, year] = term_full.split(" (");
        const academic_year = year?.replace(")", "") || "";
        const term = terms.find(
          (t) =>
            t.term_name === termName &&
            (t.academic_year?.trim() || "") === academic_year.trim()
        );
        if (!term) continue;

        const instructorNames = instructors_raw.split(",").map((n: string) => n.trim());
        const instructorIds = users
          .filter((u) => instructorNames.includes(`${u.first_name} ${u.last_name}`))
          .map((u) => u.user_id);

        if (instructorIds.length === 0) continue;

        try {
          await api.post("/courses/", {
            course_id,
            course_name,
            term_id: term.term_id,
            user_ids: instructorIds,
          });
          successCount++;
        } catch {
          console.warn(`Failed to import course: ${course_id}`);
        }
      }

      toast.success(`Import complete: ${successCount} courses added`);
      fetchCourses();
      setShowImport(false);
    };
    reader.readAsBinaryString(file);
  };

  // Download Excel template (unchanged)
  const downloadTemplate = useCallback(() => {
    const ws = XLSX.utils.aoa_to_sheet([
      [
        "Course ID",
        "Course Name",
        "Term Name (Academic Year)",
        "Instructor Full Names",
      ],
      [
        "IT112",
        "Computer Programming 1",
        "1st Semester (2024-2025)",
        "Juan Dela Cruz, Maria Santos",
      ],
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
          Add Course
        </button>

        <button
          type="button"
          className="action-button import"
          onClick={() => setShowImport(true)}
        >
          Import Courses
        </button>

        <button
          type="button"
          className="action-button download"
          onClick={downloadTemplate}
        >
          <FaDownload /> Download Template
        </button>
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
                  <td>{c.instructor_names?.join(", ")}</td>
                  <td className="action-buttons">
                    <button type='button' className="icon-button edit-button" onClick={() => handleEdit(c)}>
                      <FaEdit />
                    </button>
                    <button
                      type="button"
                      className="icon-button delete-button"
                      onClick={() => handleDelete(c.course_id)}
                    >
                      <FaTrash />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
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
                  label: `${u.first_name} ${u.last_name}`,
                }))}
                value={users
                  .filter((u) => newCourse.user_ids.includes(u.user_id))
                  .map((u) => ({
                    value: u.user_id,
                    label: `${u.first_name} ${u.last_name}`,
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
                      label: `${u.first_name} ${u.last_name}`,
                    }))}
                  value={users
                    .filter((u) => newCourse.leaders.includes(u.user_id))
                    .map((u) => ({
                      value: u.user_id,
                      label: `${u.first_name} ${u.last_name}`,
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
            <h3>Import Courses</h3>
            <input type="file" accept=".xlsx,.xls" onChange={handleImport} />
            <div className="modal-actions">
              <button type="button" onClick={() => setShowImport(false)}>
                Close
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
