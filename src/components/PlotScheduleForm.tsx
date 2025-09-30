import React from 'react';
import {
  FaArrowLeft, FaEye, FaPlayCircle, FaPaperPlane, FaUserEdit, FaSave, FaTimes, FaFileExport
} from 'react-icons/fa';
import DatePicker from "react-multi-date-picker";

interface Props {
  formData: any;
  setFormData: (fn: (prev: any) => any) => void;
  mergedPeriods: {
    label: string;
    value: string;
    start_date: string;
    end_date: string;
  }[];
  examCategories: string[];
  selectedDay: string;
  setSelectedDay: (v: string) => void;
  daysPeriods: any[];
  programs: any[];
  sectionCourses: any[];
  filteredCourses: any[];
  modalities: any[];
  showRemarksMap: Record<string, boolean>;
  setShowRemarksMap: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  handleGenerateSave: () => void;
  setShowPlot: (v: boolean) => void;

  // For footer actions:
  showDeanModal: boolean;
  setShowDeanModal: (v: boolean) => void;
  deanName: string;
  pdfFile: File | null;
  setPdfFile: (f: File | null) => void;
  deanRemarks: string;
  setDeanRemarks: (v: string) => void;
  handleSubmitToDean: () => void;

  isReassigning: boolean;
  setIsReassigning: (v: boolean) => void;
  selectedProctors: Record<string, string>;
  examDetails: any[];
  supabase: any;
  toast: any;
  setExamDetails: (d: any[]) => void;

  handleSendToDeanClick: () => void;
  handleExportPDF: () => void;
  exportAsWord: () => void;
  exportAsExcel: () => void;
}

const PlotScheduleForm: React.FC<Props> = ({
  formData, setFormData,
  mergedPeriods, examCategories,
  selectedDay, setSelectedDay, daysPeriods,
  programs, sectionCourses, filteredCourses,
  modalities, showRemarksMap, setShowRemarksMap,
  handleChange, handleGenerateSave,
  showDeanModal, setShowDeanModal,
  deanName, pdfFile, setPdfFile,
  deanRemarks, setDeanRemarks,
  handleSubmitToDean,
  isReassigning, setIsReassigning,
  selectedProctors, examDetails, supabase, toast, setExamDetails,
  handleSendToDeanClick, handleExportPDF, exportAsWord, exportAsExcel,setShowPlot
}) => {
    const allowedDates = daysPeriods.map(d => d.exam_date); 
  return (
    <div className="plot-controls">
      {/* back button */}
      <button
        type="button"
        onClick={() => setShowPlot(false)}
        className="back-button"
      >
        <FaArrowLeft style={{ marginLeft: "-18px" }} />
        Back
      </button>
      <h3>Add Schedule</h3>

      {/* All the form groups */}
      {/* School year */}
      <div className="form-group">
        <label>School Year & Semester</label>
        <select
          name="academic_term"
          value={formData.academic_term}
          onChange={(e) => {
            const val = e.target.value;
            const period = mergedPeriods.find(p => p.value === val);

            setFormData(prev => ({
              ...prev,
              academic_term: val,
              examPeriodStart: period?.start_date,
              examPeriodEnd: period?.end_date,
              exam_dates: [] // reset selected dates when period changes
            }));
          }}
        >
          {mergedPeriods.map((p, i) => (
            <option key={i} value={p.value}>{p.label}</option>
          ))}
        </select>
      </div>

      {/* Exam category */}
      <div className="form-group">
        <label>Exam Term</label>
        <select name="exam_category" value={formData.exam_category} onChange={handleChange}>
          {examCategories.map((cat, i) => (
            <option key={i} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label>Select Exam Dates</label>
        <DatePicker
            multiple
            value={formData.exam_dates || []}
            onChange={(dates) => {
                const selectedDates = dates.map((d) => d.format("YYYY-MM-DD"));
                setFormData((prev) => ({
                ...prev,
                exam_dates: selectedDates,
                }));
            }}
            mapDays={({ date }) => {
                // convert date to string for comparison
                const formatted = date.format("YYYY-MM-DD");
                if (!allowedDates.includes(formatted)) {
                // disable day if not allowed
                return {
                    disabled: true,
                    style: { color: "#ccc" }, // grey it out
                };
                }
            }}
            />
        </div>

        {/* Program Select */}
        <div className="form-group">
        <label>Program</label>
        <select
          name="program_id"
          value={formData.program_id}
          onChange={handleChange}
        >
          <option value="">-- Select Program --</option>
          {programs
          .slice()
          .sort((a, b) => a.program_name.localeCompare(b.program_name))
          .map((p) => {
            const courseCount = sectionCourses.filter(
            (sc) => sc.program_id === p.program_id
            ).length;

            return (
            <option
              key={p.program_id}
              value={p.program_id}
              disabled={courseCount === 0}
            >
              ({p.program_id}) | {p.program_name} ({courseCount} course
              {courseCount !== 1 ? "s" : ""})
            </option>
            );
          })}
        </select>
        </div>

        <div className="form-group">
        <label>Course</label>
        <select
          name="course_id"
          value={formData.course_id}
          onChange={handleChange}
          disabled={!formData.program_id || filteredCourses.length === 0}
        >
          <option value="">-- Select Course --</option>
          {filteredCourses.length === 0 ? (
          <option value="" disabled>
            -- No courses available --
          </option>
          ) : (
          Object.entries(
            filteredCourses.reduce(
            (acc: Record<string, typeof filteredCourses>, course) => {
              const year = course.year_level;
              if (!acc[year]) acc[year] = [];
              acc[year].push(course);
              return acc;
            },
            {}
            )
          )
            .sort(([yearA], [yearB]) => Number(yearA) - Number(yearB))
            .map(([year, courses]) => (
            <optgroup key={year} label={`Year ${year}`}>
              {courses
              .slice()
              .sort((a, b) => Number(a.course_id) - Number(b.course_id))
              .map((c) => {
                const modalityCount = modalities.filter(
                (m) => m.course_id === c.course_id
                ).length;

                return (
                <option
                  key={c.course_id}
                  value={c.course_id}
                  disabled={modalityCount === 0}
                >
                  {c.course_id} | {c.course_name} ({modalityCount} modality
                  {modalityCount !== 1 ? "ies" : ""})
                </option>
                );
              })}
            </optgroup>
            ))
          )}
        </select>
        </div>

        <div className="form-group">
        <label>Modalities (Auto-generated)</label>

        {formData.course_id ? (
          <div className="modality-details">
          <h3>Modality Details</h3>
          <div className="modality-list">
            {modalities
            .filter((m) => m.course_id === formData.course_id)
            .map((m, idx) => {
              const isShown = !!showRemarksMap[m.modality_id];

              return (
              <div key={idx} className="modality-item">
                <div
                style={{
                  fontWeight: "bold",
                  fontSize: "16px",
                  marginBottom: "4px",
                  color: "#092C4C",
                }}
                >
                {m.modality_type || "Unknown Modality"}
                </div>

                <div className="modality-info">
                <p>
                  <span className="label">Room Type:</span> {m.room_type}
                </p>
                <p>
                  <span className="label">Course:</span> {m.course_id}
                </p>
                <p>
                  <span className="label">Section:</span> {m.section_name}
                </p>
                <p>
                  <span className="label">Program:</span> {m.program_id}
                </p>
                <p style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span className="label">Remarks:</span>
                  {m.modality_remarks ? (
                  <FaEye
                    onClick={() =>
                    setShowRemarksMap((prev) => ({
                      ...prev,
                      [m.modality_id]: !prev[m.modality_id],
                    }))
                    }
                    style={{ cursor: "pointer", color: "#092C4C", fontWeight: "bold" }}
                  />
                  ) : (
                  "None"
                  )}
                </p>

                {isShown && m.modality_remarks && (
                  <div
                  style={{
                    border: "1px solid #092C4C",
                    padding: "6px 8px",
                    borderRadius: "6px",
                    backgroundColor: "#f5f5f5",
                    color: "#092C4C",
                    marginTop: "4px",
                    maxWidth: "400px",
                    wordWrap: "break-word",
                    fontSize: "13px",
                    fontWeight: "semibold",
                  }}
                  >
                  {m.modality_remarks}
                  </div>
                )}
                </div>
              </div>
              );
            })}
          </div>
          </div>
        ) : (
          <p>Please select a course to load modalities.</p>
        )}
        </div>

        <div className="form-group">
        <label>Proctors</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '14px' }}>
          <label>
          <input
            type="radio"
            name="proctor_filter"
            value="available_only"
            checked={formData.proctor_filter === 'available_only'}
            onChange={(e) =>
            setFormData((prev) => ({ ...prev, proctor_filter: e.target.value }))
            }
          />
          Available Proctors only
          </label>
          <label>
          <input
            type="radio"
            name="proctor_filter"
            value="all"
            checked={formData.proctor_filter === 'all'}
            onChange={(e) =>
            setFormData((prev) => ({ ...prev, proctor_filter: e.target.value }))
            }
          />
          All Proctors (Available or Unavailable)
          </label>
        </div>
        </div>

        <div className="form-group">
        <label>Exam Duration</label>
        <div className="duration-inputs">
          <input
          type="number"
          name="hours"
          value={formData.hours}
          onChange={handleChange}
          min="0"
          max="5"
          />
          hr/s
          <input
          type="number"
          name="minutes"
          value={formData.minutes}
          onChange={handleChange}
          min="0"
          max="59"
          />
          min/s
        </div>

        {formData.exam_date && (
          <div style={{ marginTop: '8px', fontSize: '14px', fontStyle: 'italic', color: '#333' }}>
          {(() => {
            const startTime = new Date(`${formData.exam_date}T07:30:00`);
            const duration = formData.hours * 60 + formData.minutes;
            const endTime = new Date(startTime.getTime() + duration * 60000);

            const format = (d: Date) =>
            d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            return (
            <>
              Start Time: {format(startTime)}<br />
              End Time: {format(endTime)}
            </>
            );
          })()}
          </div>
        )}
        </div>

        <div className="footer-actions">
        {/* Generate Button */}
        <button type= 'button' className="btn-generate tooltip" data-tooltip="Generate Schedule" onClick={handleGenerateSave}>
          <FaPlayCircle />
          <span className="tooltip-text">Generate/Save</span>
        </button>

        {/* Other icons in a row */}
        <div className="footer-icon-buttons">
          {/* Send to Dean */}
          <button
          type='button'
          className="btn-icon-only tooltip"
          data-tooltip="Send to Dean"
          onClick={handleSendToDeanClick}
          >
          <FaPaperPlane />
          <span className="tooltip-text">Send to Dean</span>
          </button>

          {showDeanModal && (
          <div className="modal-overlay">
            <div className="modal-content">
            <h3>Send Schedule to Dean</h3>
            <p>Dean: <strong>{deanName}</strong></p>

            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
            />

            <textarea
              placeholder="Remarks (optional)"
              value={deanRemarks}
              onChange={(e) => setDeanRemarks(e.target.value)}
            />

            <div className="modal-actions">
              <button type='button' onClick={() => setShowDeanModal(false)} className="btn-cancel">
              <FaTimes /> Cancel
              </button>
              <button type='button' onClick={handleSubmitToDean} className="btn-send">
              <FaPaperPlane /> Send
              </button>
            </div>
            </div>
          </div>
          )}
          {/* Reassign Proctor */}
          <div style={{ position: "relative", display: "inline-block" }}>
          {/* Reassign Proctor Button */}
          <button
            type="button"
            className="btn-icon-only tooltip"
            onClick={() => setIsReassigning(!isReassigning)}
          >
            <FaUserEdit className="btn-icon-small" />
            <span className="tooltip-text">Reassign Proctor or Room</span>
          </button>

          {/* Dropdown for Save / Cancel */}
          {isReassigning && (
            <div className="dropdown-menu-reassign">
            <button
              type="button"
              className="btn-icon-only tooltip"
              disabled={Object.entries(selectedProctors).every(
              ([id, user]) =>
                examDetails.find(ed => ed.examdetails_id === id)?.user_id === user
              )}
              onClick={async () => {
              const updates = Object.entries(selectedProctors);
              let hasError = false;

              for (const [examdetails_id, user_id] of updates) {
                const { error } = await supabase
                .from("tbl_examdetails")
                .update({ user_id })
                .eq("examdetails_id", examdetails_id);

                if (error) {
                toast.error(`Failed to update examdetails_id ${examdetails_id}`);
                hasError = true;
                }
              }

              if (!hasError) {
                toast.success("All proctors updated!");
                setIsReassigning(false);

                const { data, error } = await supabase.from("tbl_examdetails").select("*");
                if (!error && data) setExamDetails(data);
              }
              }}
            >
              <FaSave className="btn-icon-small" />
              <span className="tooltip-text">Save</span>
            </button>

            <button
              type="button"
              className="btn-icon-only tooltip"
              onClick={() => setIsReassigning(false)}
            >
              <FaTimes className="btn-icon-small" />
              <span className="tooltip-text">Cancel</span>
            </button>
            </div>
          )}
          </div>
          {/* Export */}
          <div className="dropdown tooltip" data-tooltip="Export Schedule">
          <button type= 'button' className="btn-icon-only dropdown-toggle">
            <FaFileExport />
            <span className="tooltip-text">Export</span>
          </button>
          <div className="dropdown-menu">
            <button type= 'button' className="dropdown-item" onClick={handleExportPDF}>PDF</button>
            <button type= 'button' className="dropdown-item" onClick={exportAsWord}>Word</button>
            <button type= 'button' className="dropdown-item" onClick={exportAsExcel}>Excel</button>
          </div>
          </div>
        </div>
        </div>
    </div>
  );
};

export default PlotScheduleForm;