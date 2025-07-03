import React, { useState } from 'react';
import { FaTrash, FaEdit, FaEye, FaSearch } from 'react-icons/fa';
import '../styles/plotschedule.css';


const Scheduler_PlotSchedule: React.FC = () => {
  const [showModal, setShowModal] = useState(false);
  const [showPlot, setShowPlot] = useState(false);


  const [courseCode, setCourseCode] = useState('IT 111');
  const [program, setProgram] = useState('BS-IT');
  const [modality, setModality] = useState('Onsite');


  const handleNext = (e: React.FormEvent) => {
    e.preventDefault();
    setShowModal(false);
    setShowPlot(true);
  };


  const handleBack = () => {
    setShowPlot(false);
    setShowModal(true);
  };


  return (
    <div className="colleges-container">
      {}
      {!showModal && !showPlot && (
        <>
          <div className="colleges-header">
            <h2 className="colleges-title">Manage Schedule</h2>
            <div className="search-bar">
              <input type="text" placeholder="Search for Schedule" />
              <button type="button" className="search-button">
                <FaSearch />
              </button>
            </div>
          </div>


          <div className="colleges-actions">
            <button
              type="button"
              className="action-button add-new"
              onClick={() => setShowModal(true)}
            >
              Add New Schedule
            </button>
          </div>


          <div className="colleges-table-container">
            <table className="colleges-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Start Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>1</td>
                  <td>2025-05-23</td>
                  <td className="action-buttons">
                    <button type="button" className="icon-button view-button">
                      <FaEye />
                    </button>
                    <button type="button" className="icon-button edit-button">
                      <FaEdit />
                    </button>
                    <button type="button" className="icon-button delete-button">
                      <FaTrash />
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>


          <div className="save-changes-footer">
            <button type="button" className="action-button save-changes">Save Changes</button>
          </div>
        </>
      )}


      {}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3 className="modal-title">Add Schedule</h3>
            <form onSubmit={handleNext}>
              <div className="form-group">
                <label>Course Code</label>
                <select value={courseCode} onChange={(e) => setCourseCode(e.target.value)}>
                  <option value="IT 111">IT 111</option>
                  <option value="CS 102">CS 102</option>
                  <option value="IS 103">IS 103</option>
                </select>
              </div>


              <div className="form-group">
                <label>Program</label>
                <select value={program} onChange={(e) => setProgram(e.target.value)}>
                  <option value="BS-IT">BS-IT</option>
                  <option value="BS-CS">BS-CS</option>
                  <option value="BS-IS">BS-IS</option>
                </select>
              </div>


              <div className="form-group">
                <label>Modality</label>
                <select value={modality} onChange={(e) => setModality(e.target.value)}>
                  <option value="Onsite">Onsite</option>
                  <option value="Online">Online</option>
                  <option value="Hybrid">Hybrid</option>
                </select>
              </div>


              <div className="modal-buttons">
                <button type="submit" className="next-button">Next</button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="modal-button cancel"
                >
                  Close
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


      {}
      {showPlot && (
        <div className="plot-schedule">
          {}
          <div className="plot-controls">
            <h3>Plot Schedule</h3>


            <div>
              <label>Exam Period</label>
              <input type="date" defaultValue="2025-05-23" />
            </div>


            <div className="radio-group">
              <label>Assign Proctor</label>
              <label><input type="radio" name="proctor" defaultChecked /> All</label>
              <label><input type="radio" name="proctor" /> Available only</label>
            </div>


            <div>
              <label>Hour/s per exam</label>
              <div className="duration-inputs">
                <input type="number" min="0" max="5" defaultValue={1} /> hrs
                <input type="number" min="0" max="59" defaultValue={30} /> mins
              </div>
            </div>


            <button type="button" className="action-button save-changes" style={{ marginTop: '20px' }}>
              Generate
            </button>
          </div>


          {}
          <div className="plot-grid">
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>9-203</th>
                  <th>9-204</th>
                  <th>9-205</th>
                  <th>9-206</th>
                  <th>9-207</th>
                  <th>9-208</th>
                  <th>9-209</th>
                </tr>
              </thead>
              <tbody>
                {[
                  '7:30AM - 8:00AM', '8:00AM - 8:30AM', '8:30AM - 9:00AM',
                  '9:00AM - 9:30AM', '9:30AM - 10:00AM', '10:00AM - 10:30AM',
                  '10:30AM - 11:00AM', '11:00AM - 11:30AM', '11:30AM - 12:00PM',
                  '12:00PM - 12:30PM', '12:30PM - 1:00PM', '1:00PM - 1:30PM',
                  '1:30PM - 2:00PM', '2:00PM - 2:30PM', '2:30PM - 3:00PM',
                  '3:00PM - 3:30PM', '3:30PM - 4:00PM', '4:00PM - 4:30PM',
                  '4:30PM - 5:00PM', '5:00PM - 5:30PM', '5:30PM - 6:00PM',
                  '6:00PM - 6:30PM', '6:30PM - 7:00PM', '7:00PM - 7:30PM',
                  '7:30PM - 8:00PM', '8:00PM - 8:30PM', '8:30PM - 9:00PM'
                ].map((time, idx) => (
                  <tr key={idx}>
                    <td>{time}</td>
                    <td></td><td></td><td></td><td></td><td></td><td></td><td></td>
                  </tr>
                ))}
              </tbody>
            </table>


            <div className="plot-footer">
              <button type="button" onClick={handleBack} className="action-button save-changes" style={{ backgroundColor: '#ccc', color: '#000' }}>
                Back
              </button>
              <div>
                <button type="button" className="action-button save-changes" style={{ marginRight: '10px' }}>
                  Save and Export
                </button>
                <button type="button" className="action-button save-changes">Save</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


export default Scheduler_PlotSchedule;