// PlotHeaderTable.tsx
import React from 'react';
import { FaEye } from 'react-icons/fa';

interface ExamDetail {
  examdetails_id: string;
  course_id: string;
  program_id: string;
  room_id: string;
  modality_id: string;
  user_id: string;
  exam_period: string;
  exam_date: string;
  exam_duration: string;
  exam_start_time: string;
  exam_end_time: string;
  time_in: string | null;
  time_out: string | null;
  section_name: string;
  academic_year: string;
  semester: string;
  exam_category: string;
}

interface Props {
  filteredExamDetails: ExamDetail[];
  selectedExam: ExamDetail | null;
  setSelectedExam: (exam: ExamDetail | null) => void;
}

const PlotHeaderTable: React.FC<Props> = ({
  filteredExamDetails,
  selectedExam,
  setSelectedExam,
}) => (
  <div className="colleges-table-container">
    <table className="colleges-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Course ID</th>
          <th>Program ID</th>
          <th>Room ID</th>
          <th>Time Slot</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {filteredExamDetails.length === 0 ? (
          <tr>
            <td colSpan={7}>No schedule found.</td>
          </tr>
        ) : (
          filteredExamDetails.map((ed, index) => (
            <tr key={ed.examdetails_id}>
              <td>{index + 1}</td>
              <td>{ed.course_id}</td>
              <td>{ed.program_id}</td>
              <td>{ed.room_id}</td>
              <td>
                {new Date(ed.exam_start_time).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
                –
                {new Date(ed.exam_end_time).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </td>
              <td>
                <button
                  type="button"
                  className="icon-button view-button"
                  onClick={() => setSelectedExam(ed)}
                >
                  <FaEye />
                </button>
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>

    {selectedExam && (
      <div className="modal-overlay">
        <div className="modal-content">
          <div className="profile-header">Exam Details</div>
          <div className="details-grid">
              <div className="details-item">
                <span className="details-label">Exam ID</span>
                <span className="details-value">{selectedExam.examdetails_id}</span>
              </div>
              <div className="details-item">
                <span className="details-label">Course ID</span>
                <span className="details-value">{selectedExam.course_id}</span>
              </div>
              <div className="details-item">
                <span className="details-label">Program ID</span>
                <span className="details-value">{selectedExam.program_id}</span>
              </div>
              <div className="details-item">
                <span className="details-label">Room ID</span>
                <span className="details-value">{selectedExam.room_id}</span>
              </div>
              <div className="details-item">
                <span className="details-label">Modality ID</span>
                <span className="details-value">{selectedExam.modality_id}</span>
              </div>
              <div className="details-item">
                <span className="details-label">User ID</span>
                <span className="details-value">{selectedExam.user_id}</span>
              </div>
              <div className="details-item">
                <span className="details-label">Exam Period</span>
                <span className="details-value">{selectedExam.exam_period}</span>
              </div>
              <div className="details-item">
                <span className="details-label">Exam Date</span>
                <span className="details-value">{selectedExam.exam_date}</span>
              </div>
              <div className="details-item">
                <span className="details-label">Duration</span>
                <span className="details-value">{selectedExam.exam_duration}</span>
              </div>
              <div className="details-item">
                <span className="details-label">Start Time</span>
                <span className="details-value">{selectedExam.exam_start_time}</span>
              </div>
              <div className="details-item">
                <span className="details-label">End Time</span>
                <span className="details-value">{selectedExam.exam_end_time}</span>
              </div>
              <div className="details-item">
                <span className="details-label">Time In</span>
                <span className="details-value">{selectedExam.time_in || 'N/A'}</span>
              </div>
              <div className="details-item">
                <span className="details-label">Time Out</span>
                <span className="details-value">{selectedExam.time_out || 'N/A'}</span>
              </div>
              <div className="details-item">
                <span className="details-label">Section</span>
                <span className="details-value">{selectedExam.section_name}</span>
              </div>
              <div className="details-item">
                <span className="details-label">Academic Year</span>
                <span className="details-value">{selectedExam.academic_year}</span>
              </div>
              <div className="details-item">
                <span className="details-label">Semester</span>
                <span className="details-value">{selectedExam.semester}</span>
              </div>
              <div className="details-item">
                <span className="details-label">Exam Category</span>
                <span className="details-value">{selectedExam.exam_category}</span>
              </div>
            </div>
          <button
            type="button"
            className="close-button"
            onClick={() => setSelectedExam(null)}
          >
            Close
          </button>
        </div>
      </div>
    )}
  </div>
);

export default PlotHeaderTable;
