/// <reference types="react" />
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient.ts";
import "../styles/SchedulerPlottingSchedule.css";
import Select, { components } from "react-select";

interface ExamDetail {
  examdetails_id?: number;
  course_id: string;
  program_id: string;
  modality_id: number;
  user_id?: number | null;
  examperiod_id: number;
  exam_duration?: string | null;
  exam_start_time?: string | null;
  exam_end_time?: string | null;
  proctor_timein?: string | null;
  proctor_timeout?: string | null;
  section_name?: string | null;
  academic_year?: string | null;
  semester?: string | null;
  exam_category?: string | null;
  exam_period?: string | null;
  exam_date?: string | null; // CSV of dates
  room_id?: string | null;
  selectedStartTime?: string;
  instructor_id?: number | null;
}

const SchedulerPlottingSchedule: React.FC = () => {
  const [formData, setFormData] = useState<ExamDetail & {
    selectedPrograms: string[];
    selectedCourses: string[];
    selectedModalities: number[];
    selectedExamDates: string[];
    exam_duration_hours?: number;
    exam_duration_minutes?: number;
  }>({
    course_id: "",
    program_id: "",
    modality_id: 0,
    examperiod_id: 0,
    exam_date: "",
    room_id: null,
    selectedPrograms: [],
    selectedCourses: [],
    selectedModalities: [],
    selectedExamDates: [],
    exam_duration_hours: 0,
    exam_duration_minutes: 0,
  });

  const [examPeriods, setExamPeriods] = useState<any[]>([]);
  const [modalities, setModalities] = useState<any[]>([]);
  const [_filteredModalities, setFilteredModalities] = useState<any[]>([]);
  const [programs, setPrograms] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [terms, setTerms] = useState<any[]>([]);
  const [_filteredCourses, setFilteredCourses] = useState<any[]>([]);
  const [sectionCourses, setSectionCourses] = useState<any[]>([]);
  const [userCollegeIds, setUserCollegeIds] = useState<string[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);

  useEffect(() => {
    const fetchAll = async () => {
        const {
        data: { user },
        } = await supabase.auth.getUser();

        const { data: userRow } = await supabase
        .from("tbl_users")
        .select("user_id")
        .eq("user_uuid", user?.id)
        .single();

        const realUserId = userRow?.user_id;

        const [
        { data: periods },
        { data: mods },
        { data: progs },
        { data: crs },
        { data: trms },
        { data: sectCourses },
        { data: userRoles },
        { data: depts },
        ] = await Promise.all([
        supabase.from("tbl_examperiod").select("*"),
        supabase.from("tbl_modality").select("*"),
        supabase.from("tbl_program").select("*"),
        supabase.from("tbl_course").select("*"),
        supabase.from("tbl_term").select("*"),
        supabase.from("tbl_sectioncourse").select("*"),
        supabase
            .from("tbl_user_role")
            .select("college_id")
            .eq("user_id", realUserId)
            .eq("role_id", 3),
        supabase.from("tbl_department").select("department_id, college_id"),
        ]);

        if (periods) setExamPeriods(periods);
        if (mods) setModalities(mods);
        if (progs) setPrograms(progs);
        if (crs) setCourses(crs);
        if (trms) setTerms(trms);
        if (sectCourses) setSectionCourses(sectCourses);
        if (depts) setDepartments(depts);

        if (userRoles) {
        const colleges = userRoles
            .map((r) => String(r.college_id))
            .filter(Boolean);
        setUserCollegeIds(colleges);
        }
    };

    fetchAll();
    }, []);

  const filteredCoursesByPrograms = useMemo(() => {
    if (formData.selectedPrograms.length === 0) return [];
    const courseIds = Array.from(
      new Set(
        sectionCourses
          .filter(sc => formData.selectedPrograms.includes(sc.program_id))
          .map(sc => sc.course_id)
      )
    );
    return courses.filter(c => courseIds.includes(c.course_id));
  }, [formData.selectedPrograms, sectionCourses, courses]);

  const filteredModalitiesBySelection = useMemo(() => {
    if (formData.selectedPrograms.length === 0 || formData.selectedCourses.length === 0) return [];
    return modalities.filter(
      m =>
        formData.selectedPrograms.includes(m.program_id) &&
        formData.selectedCourses.includes(m.course_id)
    );
  }, [formData.selectedPrograms, formData.selectedCourses, modalities]);

  const CheckboxOption = (props: any) => {
    return (
      <components.Option {...props}>
        <input
          type="checkbox"
          checked={props.isSelected}
          onChange={() => null} // handled by react-select
        />{" "}
        <label>{props.label}</label>
      </components.Option>
    );
  };

  const addSelectAllOption = (options: any[], label = "Select All") => [
    { value: "__all__", label },
    ...options,
  ];

  const termNameById = useMemo(() => {
    const map = new Map<number | string, string>();
    terms.forEach((t) => {
      map.set(t.term_id, t.term_name ?? String(t.term_id));
    });
    return map;
  }, [terms]);

  useEffect(() => {
    if (!formData.program_id) {
      setFilteredCourses([]);
      return;
    }

    const courseIds = Array.from(
      new Set(
        sectionCourses
          .filter((sc) => sc.program_id === formData.program_id)
          .map((sc) => sc.course_id)
      )
    );

    const filtered = courses.filter((c) => courseIds.includes(c.course_id));
      setFilteredCourses(filtered);
      setFormData((prev) => ({ ...prev, course_id: "" }));
    }, [formData.program_id, courses, sectionCourses]);

    // Filter modalities whenever program or course changes
    useEffect(() => {
      if (!formData.course_id || !formData.program_id) {
        setFilteredModalities([]);
        return;
      }
      const filtered = modalities.filter(
        (m) =>
          m.course_id === formData.course_id &&
          m.program_id === formData.program_id
      );
      setFilteredModalities(filtered);
      setFormData((prev) => ({
        ...prev,
        modality_id: 0,
        section_name: "",
        room_id: null,
      }));
    }, [formData.course_id, formData.program_id, modalities]);

    const handleChange = (
      e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
    ) => {
      const { name, value } = e.target;
      if (name === "modality_id" || name === "examperiod_id") {
        setFormData((prev) => ({
          ...prev,
          [name]: value === "" ? 0 : Number(value),
        }));
      } else {
        setFormData((prev) => ({ ...prev, [name]: value }));
      }
    };

    // dedupe exam period academic year/term
    const uniqueAcademicYearTermOptions = useMemo(() => {
      const seen = new Set<string>();
      const options: { key: string; label: string; value: string }[] = [];
      for (const p of examPeriods) {
        const termName = termNameById.get(p.term_id) ?? p.term_id ?? "Term";
        const key = `${p.academic_year}||${termName}`;
        if (!seen.has(key)) {
          seen.add(key);
          const label = `${p.academic_year} | ${termName}`;
          const value = `${p.academic_year} | ${termName}`;
          options.push({ key, label, value });
        }
      }
      return options;
    }, [examPeriods, termNameById]);

    const uniqueExamCategoryOptions = useMemo(() => {
      const seen = new Set<string>();
      const options: string[] = [];
      for (const p of examPeriods) {
        const cat = p.exam_category ?? "";
        if (cat && !seen.has(cat)) {
          seen.add(cat);
          options.push(cat);
        }
      }
      return options;
    }, [examPeriods]);

    // compute distinct dates from exam periods belonging to the scheduler's college
    const examDateOptions = useMemo(() => {
      if (!examPeriods.length || !userCollegeIds.length) return [];

      const allowedPeriods = examPeriods.filter((p) =>
        userCollegeIds.includes(String(p.college_id))
      );

      const days: { key: string; iso: string; label: string }[] = [];
      for (const period of allowedPeriods) {
        if (!period.start_date || !period.end_date) continue;
        const start = new Date(period.start_date);
        const end = new Date(period.end_date);
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          const iso = d.toISOString().slice(0, 10); // ✅ YYYY-MM-DD
          const label = d.toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          }); // "September 22, 2025"
          days.push({ key: `${period.examperiod_id}-${iso}`, iso, label });
        }
      }

      const seen = new Set<string>();
      return days.filter((d) => {
        if (seen.has(d.iso)) return false;
        seen.add(d.iso);
        return true;
      });
    }, [examPeriods, userCollegeIds]);

    const handleSave = async () => {
      if (
        !formData.selectedPrograms.length ||
        !formData.selectedCourses.length ||
        !formData.selectedModalities.length
      ) {
        alert("Please complete program, course, and modality selection.");
        return;
      }

      if (!formData.selectedExamDates.length) {
        alert("Please select at least one exam date.");
        return;
      }

      await assignExamSchedules();
    };

    const assignExamSchedules = async () => {
  const scheduledExams: any[] = [];
  const assignedSlots: Record<string, Set<string>> = {}; // roomId -> set of timeslot strings
  const unscheduledCourses: string[] = [];

  // Prepare academic year and semester
  let academicYear: string | null = null;
  let semester: string | null = null;
  if (formData.academic_year) {
    const [yearPart, semPart] = formData.academic_year.split("|").map((s) => s.trim());
    academicYear = yearPart ?? null;
    semester = semPart ?? null;
  }

  // Format exam period string
  const sortedDates = [...formData.selectedExamDates].sort();
  const examPeriod =
    sortedDates.length > 1
      ? `${new Date(sortedDates[0]).toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        })} - ${new Date(sortedDates[sortedDates.length - 1]).toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        })}`
      : new Date(sortedDates[0]).toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        });

  // Group sections by course
  const groupedByCourse: Record<string, any[]> = {};
  for (const modalityId of formData.selectedModalities) {
    const selectedModality = modalities.find((m) => m.modality_id === modalityId);
    if (!selectedModality) continue;

    const courseId = selectedModality.course_id;
    if (!groupedByCourse[courseId]) groupedByCourse[courseId] = [];
    groupedByCourse[courseId].push(selectedModality);
  }

  // Process each course
  for (const [courseId, sections] of Object.entries(groupedByCourse)) {
    let assigned = false;

    for (const date of sortedDates) {
      if (assigned) break;

      const examDateISO = new Date(date).toISOString().slice(0, 10);

      // Find matching exam period
      const matchedPeriod = examPeriods.find((p) => {
        const start = new Date(p.start_date);
        const end = new Date(p.end_date);
        return new Date(examDateISO) >= start && new Date(examDateISO) <= end;
      });
      if (!matchedPeriod) continue;

      // Find available proctor
      const { data: availableProctors } = await supabase
        .from("tbl_availability")
        .select("user_id")
        .eq("day", examDateISO)
        .eq("status", "available");
      if (!availableProctors?.length) continue;

      const proctorId =
        availableProctors[Math.floor(Math.random() * availableProctors.length)].user_id;

      // Try each timeslot (pick one slot for the WHOLE course)
      for (const t of times) {
        if (assigned) break;

        const totalDurationMinutes = (duration.hours ?? 0) * 60 + (duration.minutes ?? 0);
        const [startHour, startMinute] = t.split(":").map(Number);

        // Build slot minutes
        const slotMinutes: string[] = [];
        for (let m = 0; m < totalDurationMinutes; m += 30) {
          const h = startHour + Math.floor((startMinute + m) / 60);
          const mi = (startMinute + m) % 60;
          slotMinutes.push(`${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}`);
        }

        // Collect rooms for all sections of this course
        const assignedRooms: string[] = [];
        for (const section of sections) {
          const possibleRooms = section.possible_rooms ?? [];
          const enrolledCount = section.enrolled_students ?? 0;

          let roomId: string | null = null;
          for (const r of possibleRooms) {
            if (!assignedSlots[r]) assignedSlots[r] = new Set();
            if (slotMinutes.some((s) => assignedSlots[r].has(s))) continue;

            const { data: roomData } = await supabase
              .from("tbl_rooms")
              .select("room_capacity")
              .eq("room_id", r)
              .single();

            if (!roomData || roomData.room_capacity < enrolledCount) continue;

            if (!assignedRooms.includes(r)) {
              roomId = r;
              break;
            }
          }

          if (!roomId) break; // cannot find room for this section
          assignedRooms.push(roomId);
        }

        // If not enough rooms for all sections, try next timeslot
        if (assignedRooms.length < sections.length) continue;

        // Mark slots for all chosen rooms
        assignedRooms.forEach((roomId) => {
          slotMinutes.forEach((s) => assignedSlots[roomId].add(s));
        });

        // Build exam times
        const endHour = startHour + Math.floor((startMinute + totalDurationMinutes) / 60);
        const endMinute = (startMinute + totalDurationMinutes) % 60;
        const endTime = `${String(endHour).padStart(2, "0")}:${String(endMinute).padStart(2, "0")}`;
        const startTimestamp = `${examDateISO}T${t}:00Z`;
        const endTimestamp = `${examDateISO}T${endTime}:00Z`;

        // Get room + building + college info
        const { data: roomsData } = await supabase
          .from("tbl_rooms")
          .select("room_id, building_id");
        const { data: buildings } = await supabase
          .from("tbl_buildings")
          .select("building_id, building_name");
        const { data: colleges } = await supabase
          .from("tbl_college")
          .select("college_id, college_name");

        const schedulerCollegeId = userCollegeIds[0];
        const collegeObj = colleges?.find((c) => c.college_id === schedulerCollegeId);
        const collegeNameForCourse = collegeObj?.college_name ?? "Unknown College";

        // Schedule each section of the course in its room (same timeslot)
        sections.forEach((section, idx) => {
          const sectionRoomId = assignedRooms[idx];
          const sectionObj = sectionCourses.find(
            (sc) =>
              sc.program_id === section.program_id &&
              sc.course_id === section.course_id &&
              sc.section_name === section.section_name
          );
          const instructorId = sectionObj?.user_id ?? null;

          const buildingId = roomsData?.find((r) => r.room_id === sectionRoomId)?.building_id;
          const buildingName =
            buildingId && buildings
              ? buildings.find((b) => b.building_id === buildingId)?.building_name
              : "Unknown Building";

          scheduledExams.push({
            program_id: section.program_id,
            course_id: section.course_id,
            modality_id: section.modality_id,
            room_id: sectionRoomId,
            section_name: section.section_name,
            proctor_id: proctorId,
            examperiod_id: matchedPeriod.examperiod_id,
            exam_date: examDateISO,
            exam_start_time: startTimestamp,
            exam_end_time: endTimestamp,
            exam_duration: `${duration.hours ?? 0}h ${duration.minutes ?? 0}m`,
            proctor_timein: formData.proctor_timein ?? null,
            proctor_timeout: formData.proctor_timeout ?? null,
            academic_year: academicYear,
            semester: semester,
            exam_category: formData.exam_category ?? null,
            exam_period: examPeriod,
            college_name: collegeNameForCourse,
            building_name: `${buildingName} (${sectionRoomId})`,
            instructor_id: instructorId,
          });
        });

        assigned = true; // ✅ done for this course
      }
    }

    if (!assigned) unscheduledCourses.push(courseId);
  }

  // Warnings
  if (unscheduledCourses.length) {
    alert(
      "⚠️ Could not schedule these courses due to conflicts or room capacity:\n" +
        unscheduledCourses.join(", ")
    );
  }

  if (!scheduledExams.length) {
    alert("No valid schedules to save.");
    return;
  }

  // Save to DB
  const { error } = await supabase.from("tbl_examdetails").insert(scheduledExams);
  if (error) alert("❌ Error saving schedule: " + error.message);
  else alert("✅ Schedules saved successfully!");
};


  // Only include start times that allow exams to end by 9:00 PM
  const times = [
    "07:00","07:30","08:00","08:30","09:00","09:30","10:00","10:30","11:00","11:30",
    "12:00","12:30","13:00","13:30","14:00","14:30","15:00","15:30","16:00","16:30",
    "17:00","17:30","18:00","18:30","19:00","19:30","20:00","20:30"
  ];

  const [duration, setDuration] = useState({ hours: 1, minutes: 0 });
  const [selectedStartTime, setSelectedStartTime] = useState<string>("");

  // filter programs by college for schedulers
  const filteredPrograms = useMemo(() => {
    if (
        userCollegeIds.length === 0 ||
        departments.length === 0 ||
        programs.length === 0
    ) {
        // nothing to filter yet, return all
        return programs;
    }

    const allowedDepartments = new Set(
        departments
        .filter((d) => userCollegeIds.includes(String(d.college_id)))
        .map((d) => String(d.department_id).trim())
    );

    return programs.filter((p) =>
        allowedDepartments.has(String(p.department_id).trim())
    );
    }, [programs, userCollegeIds, departments]);

  return (
    <div className="scheduler-container">
      <h2 className="scheduler-header">Scheduler Plotting</h2>

      <div className="field">
        <label className="label">Academic Year & Semester</label>
        <select
          name="academic_year"
          value={formData.academic_year ?? ""}
          onChange={handleChange}
          className="select"
        >
          <option value="">Select Academic Year & Semester</option>
          {uniqueAcademicYearTermOptions.map((o) => (
            <option key={o.key} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label className="label">Exam Term</label>
        <select
          name="exam_category"
          value={formData.exam_category ?? ""}
          onChange={handleChange}
          className="select"
        >
          <option value="">Select Exam Category</option>
          {uniqueExamCategoryOptions.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label className="label">Select Exam Dates</label>
        <Select
          options={examDateOptions.map(d => ({ value: d.iso, label: d.label }))} // ✅ use iso for value
          isMulti
          closeMenuOnSelect={false}
          hideSelectedOptions={false}
          components={{ Option: CheckboxOption }}
          onChange={(selected) =>
            setFormData(prev => ({
              ...prev,
              selectedExamDates: (selected as any[]).map(s => s.value), // ✅ store ISO
            }))
          }
          value={formData.selectedExamDates.map(d => {
            const opt = examDateOptions.find(o => o.iso === d);
            return { value: d, label: opt?.label ?? d }; // ✅ show pretty label
          })}
        />
      </div>

      <div className="field">
        <label className="label">Program</label>
        <Select
          options={addSelectAllOption(
            filteredPrograms.map(p => ({
              value: p.program_id,
              label: `${p.program_id} | ${p.program_name}`,
            }))
          )}
          isMulti
          closeMenuOnSelect={false}
          hideSelectedOptions={false}
          components={{ Option: CheckboxOption }}
          onChange={(selected) => {
            let selectedValues = (selected as any[]).map(s => s.value);

            // if Select All was clicked
            if (selectedValues.includes("__all__")) {
              // add all actual options if not already selected
              const allValues = filteredPrograms.map(p => p.program_id);
              selectedValues = Array.from(new Set([...selectedValues.filter(v => v !== "__all__"), ...allValues]));
            }

            setFormData(prev => ({
              ...prev,
              selectedPrograms: selectedValues.filter(v => v !== "__all__"), // remove the __all__ placeholder
              selectedCourses: [],
              selectedModalities: [],
            }));
          }}
          value={formData.selectedPrograms.map(p => {
            const prog = filteredPrograms.find(f => f.program_id === p);
            return { value: p, label: prog ? `${prog.program_id}` : p };
          })}
        />
      </div>

      <div className="field">
        <label className="label">Course</label>
        <Select
          options={addSelectAllOption(
            filteredCoursesByPrograms.map(c => ({
              value: c.course_id,
              label: `${c.course_id} | ${c.course_name}`,
            }))
          )}
          isMulti
          closeMenuOnSelect={false}
          hideSelectedOptions={false}
          components={{ Option: CheckboxOption }}
          onChange={(selected) => {
            let selectedValues = (selected as any[]).map(s => s.value);

            if (selectedValues.includes("__all__")) {
              const allValues = filteredCoursesByPrograms.map(c => c.course_id);
              selectedValues = Array.from(new Set([...selectedValues.filter(v => v !== "__all__"), ...allValues]));
            }

            setFormData(prev => ({
              ...prev,
              selectedCourses: selectedValues.filter(v => v !== "__all__"),
              selectedModalities: [],
            }));
          }}
          value={formData.selectedCourses.map(c => {
            const course = filteredCoursesByPrograms.find(f => f.course_id === c);
            return { value: c, label: course ? `${course.course_id}` : c };
          })}
        />
      </div>

      <div className="form-row">
        {/* Modality */}
        <div className="form-field">
          <label className="form-label">Modality</label>
          <Select
            options={addSelectAllOption(
              filteredModalitiesBySelection.map(m => ({
                value: m.modality_id,
                label: `${m.modality_type}${m.section_name ? ` – ${m.section_name}` : ""}`,
              }))
            )}
            isMulti
            closeMenuOnSelect={false}
            hideSelectedOptions={false}
            components={{ Option: CheckboxOption }}
            onChange={(selected) => {
              let selectedValues = (selected as any[]).map(s => s.value);

              if (selectedValues.includes("__all__")) {
                const allValues = filteredModalitiesBySelection.map(m => m.modality_id);
                selectedValues = Array.from(
                  new Set([...selectedValues.filter(v => v !== "__all__"), ...allValues])
                );
              }

              setFormData(prev => ({
                ...prev,
                selectedModalities: selectedValues.filter(v => v !== "__all__"),
              }));
            }}
            value={formData.selectedModalities.map(m => {
              const mod = filteredModalitiesBySelection.find(f => f.modality_id === m);
              return { 
                value: m, 
                label: mod 
                  ? `${mod.modality_type}${mod.section_name ? ` – ${mod.section_name}` : ""}` 
                  : String(m) 
              };
            })}
            className="select-input"
          />
        </div>

        {/* Exam Duration */}
        <div className="form-field">
          <label className="form-label">Duration</label>
          <div className="duration-inputs">
            <input
              type="number"
              min={0}
              value={duration.hours}
              onChange={(e) =>
                setDuration(prev => ({ ...prev, hours: Number(e.target.value) }))
              }
              placeholder="Hours"
              className="input"
            />
            <input
              type="number"
              min={0}
              max={59}
              value={duration.minutes}
              onChange={(e) =>
                setDuration(prev => ({ ...prev, minutes: Number(e.target.value) }))
              }
              placeholder="Minutes"
              className="input"
            />
          </div>
        </div>

        {/* Start Time */}
        <div className="form-field">
          <label className="form-label">Start Time</label>
          <select
            value={selectedStartTime}
            onChange={(e) => setSelectedStartTime(e.target.value)}
            className="select-input"
          >
            <option value="">Select</option>
            {times.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        {/* Save Button */}
        <div className="form-actions">
          <button type="button" onClick={handleSave} className="btn-save">
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

export default SchedulerPlottingSchedule;