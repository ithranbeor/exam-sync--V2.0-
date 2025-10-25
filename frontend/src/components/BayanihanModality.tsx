import React, { useState, useEffect, useRef } from 'react';
import { api } from '../lib/apiClient.ts';
import '../styles/bayanihanModality.css';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Select, { components } from 'react-select';

interface UserProps {
  user: {
    user_id: number;
    email: string;
    first_name?: string;
    last_name?: string;
    avatar_url?: string;
  } | null;
}

const modalityRoomTypeMap: { [key: string]: string } = {
  'Written (Lecture)': 'Lecture',
  'Written (Laboratory)': 'Laboratory',
  'PIT or Projects': 'No Room',
  'Pitching': 'No Room',
  'Hands-on': 'Laboratory',
};

const BayanihanModality: React.FC<UserProps> = ({ user }) => {
  const [form, setForm] = useState({
    modality: '',
    rooms: [] as string[],
    roomType: '',
    program: '',
    sections: [] as string[],
    course: '',
    remarks: '',
  });

  const [programOptions, setProgramOptions] = useState<{ program_id: string; program_name: string }[]>([]);
  const [courseOptions, setCourseOptions] = useState<{ course_id: string; course_name: string }[]>([]);
  const [sectionOptions, setSectionOptions] = useState<{ course_id: string; program_id: string; section_name: string }[]>([]);
  const [roomOptions, setRoomOptions] = useState<{ room_id: string; room_name: string; room_type: string; building_id?: string }[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal states
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [selectedBuilding, setSelectedBuilding] = useState<string | null>(null);
  const [buildingOptions, setBuildingOptions] = useState<{ id: string; name: string }[]>([]);
  const [occupancyModal, setOccupancyModal] = useState<{ visible: boolean; roomId: string | null }>({
    visible: false,
    roomId: null,
  });

  // Room status with occupied times
  const [roomStatus, setRoomStatus] = useState<{
    [key: string]: { occupiedTimes: { start: string; end: string }[] }
  }>({});

  const CheckboxOption = (props: any) => {
    return (
      <components.Option {...props}>
        <input
          type="checkbox"
          checked={props.isSelected}
          readOnly
          style={{ marginRight: 8 }}
        />
        {props.label}
      </components.Option>
    );
  };

  /** FETCH ROOM STATUS BASED ON EXAMDETAILS */
  useEffect(() => {
    const fetchRoomStatus = async () => {
      try {
        const response = await api.get('/tbl_examdetails');
        const exams = response.data;

        const statusMap: { [key: string]: { occupiedTimes: { start: string; end: string }[] } } = {};
        exams.forEach((e: any) => {
          if (!statusMap[e.room_id]) statusMap[e.room_id] = { occupiedTimes: [] };
          statusMap[e.room_id].occupiedTimes.push({
            start: e.exam_start_time,
            end: e.exam_end_time,
          });
        });
        setRoomStatus(statusMap);
      } catch (error: any) {
        console.error('Error fetching exams:', error.message);
      }
    };

    fetchRoomStatus();
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      if (!user?.user_id) return;

      try {
        // 1️⃣ Fetch all user roles
        const { data: roles } = await api.get(`/tbl_user_role`, {
          params: { user_id: user.user_id }
        });
        console.log("User roles fetched:", roles);

        // 2️⃣ Find Bayanihan Leader role (role_id = 4)
        const bayanihanLeaderRole = roles.find((r: any) => r.role === 4 || r.role_id === 4);
        if (!bayanihanLeaderRole) {
          console.warn("User is not a Bayanihan Leader (role_id = 4)");
          return;
        }

        console.log("Bayanihan Leader role found:", bayanihanLeaderRole);

        // 3️⃣ Get department from the role
        const department = bayanihanLeaderRole.department ?? bayanihanLeaderRole.department_id;
        console.log("Department:", department, "Type:", typeof department);

        // 4️⃣ PROGRAMS - Filter by department
        const programsRes = await api.get('/programs/');
        console.log("All programs from API:", programsRes.data);
        console.log("First program structure:", programsRes.data[0]);
        
        const programs = department
          ? programsRes.data.filter((p: any) => {
              // Extract department ID from the string format "TblDepartment object (DIT)"
              let progDept = p.department_id || p.department || p.dept_id || p.dept;
              
              // If department is in format "TblDepartment object (XXX)", extract XXX
              if (typeof progDept === 'string' && progDept.includes('(') && progDept.includes(')')) {
                const match = progDept.match(/\(([^)]+)\)/);
                if (match) {
                  progDept = match[1];
                }
              }
              
              console.log(`Comparing program ${p.program_id}: ${progDept} === ${department}`);
              return String(progDept).toLowerCase() === String(department).toLowerCase();
            })
          : programsRes.data;
        console.log("Programs loaded after filtering:", programs);
        setProgramOptions(programs);

        // Get program IDs from filtered programs
        const programIds = programs.map((p: any) => String(p.program_id));
        console.log("Program IDs from department:", programIds);

        // 5️⃣ SECTIONS - Get all sections for the department's programs
        const sectionRes = await api.get('/tbl_sectioncourse/');
        const allSections = sectionRes.data;
        console.log("All sections from API:", allSections.length);
        console.log("First section structure:", allSections[0]);
        
        const filteredSections = allSections.filter((sc: any) => {
          // Extract program_id from nested program object
          const programId = sc.program?.program_id || sc.program_id;
          return programIds.includes(String(programId));
        });
        console.log("Sections filtered by program:", filteredSections.length);
        
        // Normalize section data to include direct course_id and program_id
        const normalizedSections = filteredSections.map((sc: any) => ({
          ...sc,
          course_id: sc.course?.course_id || sc.course_id,
          program_id: sc.program?.program_id || sc.program_id,
          section_name: sc.section_name
        }));
        setSectionOptions(normalizedSections);

        // 6️⃣ COURSES - Get unique course IDs from filtered sections
        const courseIdsFromSections = [...new Set(
          normalizedSections.map((s: any) => String(s.course_id))
        )];
        console.log("Course IDs from sections:", courseIdsFromSections);

        // 7️⃣ Fetch course details for those course IDs
        const coursesRes = await api.get('/courses/');
        const coursesWithNames = coursesRes.data.filter((c: any) =>
          courseIdsFromSections.includes(String(c.course_id))
        );
        console.log("Courses loaded:", coursesWithNames.length);
        setCourseOptions(coursesWithNames);

        // 8️⃣ ROOMS
        const roomsRes = await api.get('/tbl_rooms');
        console.log("Rooms loaded:", roomsRes.data.length);
        setRoomOptions(roomsRes.data);

        // 9️⃣ BUILDINGS
        const buildingsRes = await api.get('/tbl_buildings');
        const buildings = buildingsRes.data.map((b: any) => ({
          id: b.building_id,
          name: b.building_name
        }));
        console.log("Buildings loaded:", buildings.length);
        setBuildingOptions(buildings);

      } catch (error: any) {
        console.error('Error loading data:', error.message);
        toast.error('Failed to load data. Please refresh the page.');
      }
    };

    fetchData();
  }, [user]);

  /** AUTO-SELECT ROOM TYPE BASED ON MODALITY */
  useEffect(() => {
    const requiredRoomType = modalityRoomTypeMap[form.modality];
    if (!requiredRoomType) return;

    if (requiredRoomType === "No Room") {
      setForm(prev => ({ ...prev, rooms: [], roomType: "No Room" }));
      return;
    }

    setForm(prev => ({ ...prev, roomType: requiredRoomType }));
  }, [form.modality]);

  /** HANDLE FORM CHANGE */
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name === 'program') {
      setForm(prev => ({ ...prev, program: value, course: '', sections: [] }));
    } else {
      setForm(prev => ({ ...prev, [name]: value }));
    }
  };

  /** HANDLE FORM SUBMIT */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!user?.user_id) return;

    if (!form.sections.length) {
      toast.warn('Please select at least one section.');
      return;
    }

    setIsSubmitting(true);

    for (const sectionName of form.sections) {
      const section = sectionOptions.find(
        s => String(s.course_id) === String(form.course) && s.section_name === sectionName
      );
      if (!section) {
        console.warn(`Section not found: ${sectionName}`);
        continue;
      }

      try {
        const checkRes = await api.get(
          `/tbl_modality/?course_id=${section.course_id}&program_id=${section.program_id}&section_name=${section.section_name}&modality_type=${form.modality}&room_type=${form.roomType}`
        );

        if (checkRes.data.length > 0) {
          toast.warn(`Already submitted for ${section.section_name}`);
          continue;
        }

        await api.post('/tbl_modality/', {
          modality_type: form.modality,
          room_type: form.roomType,
          modality_remarks: form.remarks,
          course_id: section.course_id,
          program_id: section.program_id,
          section_name: section.section_name,
          possible_rooms: form.rooms,
          user_id: user.user_id,
          created_at: new Date().toISOString(),
        });

        toast.success(`Saved for ${section.section_name}`);
      } catch (error: any) {
        console.error(error);
        toast.error(`Error saving for ${sectionName}`);
      }
    }

    setIsSubmitting(false);
    setForm({
      modality: '',
      rooms: [],
      roomType: '',
      program: '',
      sections: [],
      course: '',
      remarks: '',
    });
  };

  /** GET ROOM TIMESLOTS WITH 30-MINUTE VACANT INTERVALS */
  const getRoomTimeslots = (roomId: string) => {
    const dayStart = new Date();
    dayStart.setHours(7, 30, 0, 0);
    const dayEnd = new Date();
    dayEnd.setHours(21, 0, 0, 0);

    const status = roomStatus[String(roomId)];
    const occupiedTimes =
      status?.occupiedTimes
        .map((t) => ({ start: new Date(t.start), end: new Date(t.end) }))
        .sort((a, b) => a.start.getTime() - b.start.getTime()) || [];

    const timeslots: { start: Date; end: Date; occupied: boolean }[] = [];
    let cursor = new Date(dayStart);

    for (const slot of occupiedTimes) {
      if (cursor.getTime() < slot.start.getTime()) {
        timeslots.push({
          start: new Date(cursor),
          end: new Date(slot.start),
          occupied: false,
        });
      }

      timeslots.push({
        start: new Date(slot.start),
        end: new Date(slot.end),
        occupied: true,
      });

      cursor = new Date(slot.end);
    }

    if (cursor.getTime() < dayEnd.getTime()) {
      timeslots.push({
        start: new Date(cursor),
        end: new Date(dayEnd),
        occupied: false,
      });
    }

    return timeslots;
  };

  /** RENDER TIMESLOT LIST */
  const RoomTimeslots: React.FC<{ roomId: string }> = ({ roomId }) => {
    const slots = getRoomTimeslots(roomId);

    return (
      <div className="occupancy-timeslots">
        {slots.map((slot, i) => (
          <div
            key={i}
            className={`timeslot-entry ${slot.occupied ? "occupied" : "vacant"}`}
          >
            <div className="timeslot-status">
              {slot.occupied ? "Occupied" : "Available"}
            </div>
            <div className="timeslot-time">
              {slot.start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} -{" "}
              {slot.end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="set-availability-container">
      <div className="availability-sections">
        <div className="availability-card">
          <div className="card-header-set">Modality Submission</div>
          <p className="subtitle">Please fill in all fields before submitting.</p>
          <form className="availability-form" onSubmit={handleSubmit}>
            <div className="availability-grid">

              {/* MODALITY */}
              <div className="form-group">
                <label>Modality Type</label>
                <Select
                  options={[
                    { value: 'Hands-on', label: 'Hands-on' },
                    { value: 'Written (Lecture)', label: 'Written (Lecture)' },
                    { value: 'Written (Laboratory)', label: 'Written (Laboratory)' },
                    { value: 'PIT or Projects', label: 'PIT or Projects' },
                    { value: 'Pitching', label: 'Pitching' }
                  ]}
                  value={form.modality ? { value: form.modality, label: form.modality } : null}
                  onChange={selected => setForm(prev => ({ ...prev, modality: selected?.value || '' }))}
                  placeholder="Select modality..."
                  isClearable
                />
              </div>

              {/* BUILDING-ROOM */}
              <div className="form-group">
                <label>Building-Room</label>
                <button
                  type="button"
                  className="open-modal-btn"
                  disabled={!form.roomType || form.roomType === "No Room"}
                  onClick={() => setShowRoomModal(true)}
                >
                  Select Room
                </button>

                {form.rooms.length > 0 && (
                  <div className="selected-rooms">
                    {form.rooms.map((roomId) => {
                      const r = roomOptions.find(r => r.room_id === roomId);
                      return (
                        <div key={roomId} className="room-card">
                          {r?.room_id}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ROOM TYPE */}
              <div className="form-group">
                <label>Room Type</label>
                <input
                  type="text"
                  name="roomType"
                  value={form.roomType}
                  readOnly
                  className="custom-select"
                  placeholder="Auto-filled"
                />
              </div>

              {/* PROGRAM */}
              <div className="form-group">
                <label>Program</label>
                <Select
                  options={programOptions.map(p => ({ value: p.program_id, label: `${p.program_id} - ${p.program_name}` }))}
                  value={form.program ? (() => {
                    const prog = programOptions.find(p => p.program_id === form.program);
                    return prog ? { value: prog.program_id, label: `${prog.program_id} - ${prog.program_name}` } : null;
                  })() : null}
                  onChange={selected => setForm(prev => ({ ...prev, program: selected?.value || '', course: '', sections: [] }))}
                  placeholder="Select program..."
                  isClearable
                />
              </div>

              {/* COURSE */}
              <div className="form-group">
                <label>Course</label>
                <Select
                  isDisabled={!form.program}
                  options={courseOptions
                    .filter(c => sectionOptions.some(s => s.program_id === form.program && s.course_id === c.course_id))
                    .map(c => ({ value: c.course_id, label: `${c.course_id} (${c.course_name})` }))}
                  value={form.course ? (() => {
                    const course = courseOptions.find(c => c.course_id === form.course);
                    return course ? { value: course.course_id, label: `${course.course_id} (${course.course_name})` } : null;
                  })() : null}
                  onChange={selected => setForm(prev => ({ ...prev, course: selected?.value || '', sections: [] }))}
                  placeholder="Select course..."
                  isClearable
                />
              </div>

              {/* SECTIONS */}
              <div className="form-group full-width">
                <label>Sections</label>

                {form.course ? (
                  <Select
                    isMulti
                    closeMenuOnSelect={false}
                    hideSelectedOptions={false}
                    components={{ Option: CheckboxOption }}
                    options={[
                      { value: 'select_all', label: 'Select All Sections' },
                      ...sectionOptions
                        .filter(s => String(s.course_id) === String(form.course))
                        .map(s => ({ value: s.section_name, label: s.section_name }))
                    ]}
                    value={form.sections.map(sec => ({ value: sec, label: sec }))}
                    onChange={(selected) => {
                      if (!selected) {
                        setForm(prev => ({ ...prev, sections: [] }));
                        return;
                      }

                      const allSectionNames = sectionOptions
                        .filter(s => String(s.course_id) === String(form.course))
                        .map(s => s.section_name);

                      const selectAllClicked = selected.find(s => s.value === 'select_all');

                      if (selectAllClicked) {
                        setForm(prev => ({ ...prev, sections: allSectionNames }));
                      } else {
                        const selectedSections = selected.map(s => s.value);
                        setForm(prev => ({ ...prev, sections: selectedSections }));
                      }
                    }}
                    placeholder="Select sections..."
                  />
                ) : (
                  <p style={{ color: "#888" }}>Select a course first</p>
                )}

                {form.rooms.length > 0 && (
                  <small style={{ marginTop: "4px", display: "block", color: "#666" }}>
                    ⚠️ Number of sections must equal number of rooms! {form.sections.length} of {form.rooms.length} section(s) selected.
                  </small>
                )}
              </div>

              {/* REMARKS */}
              <div className="form-group">
                <label>Remarks</label>
                <textarea
                  name="remarks"
                  value={form.remarks}
                  onChange={handleChange}
                  placeholder="Enter any notes or remarks here..."
                />
              </div>

            </div>

            <button type="submit" className="submit-button" disabled={isSubmitting}>
              {isSubmitting ? (
                <span className="spinner"></span>
              ) : (
                'Submit'
              )}
            </button>
          </form>
        </div>
      </div>

      {/* ROOM MODAL */}
      {showRoomModal && (
        <div className="modal-overlay">
          <div className="modal-contents-modality">
            <h3>Select Room</h3>

            <Select
              options={buildingOptions.map(b => ({
                value: b.id,
                label: `${b.name} (${b.id})`,
              }))}
              value={selectedBuilding ? (() => {
                const building = buildingOptions.find(b => b.id === selectedBuilding);
                return building ? { value: building.id, label: `${building.name} (${building.id})` } : null;
              })() : null}
              onChange={(selected) => setSelectedBuilding(selected?.value || null)}
              placeholder="-- Select Building --"
              isClearable
            />

            <div className="room-grid">
              {roomOptions
                .filter(r => !selectedBuilding || r.building_id === selectedBuilding)
                .sort((a, b) => {
                  if (a.room_type === form.roomType && b.room_type !== form.roomType) return -1;
                  if (a.room_type !== form.roomType && b.room_type === form.roomType) return 1;
                  return a.room_name.localeCompare(b.room_name);
                })
                .map(r => {
                  const isDisabled = r.room_type !== form.roomType;
                  const isSelected = form.rooms.includes(r.room_id);

                  return (
                    <div
                      key={r.room_id}
                      className={`room-box ${isSelected ? "selected" : ""} ${isDisabled ? "disabled" : ""}`}
                      onClick={() => {
                        if (isDisabled) return;
                        setForm(prev => ({
                          ...prev,
                          rooms: isSelected
                            ? prev.rooms.filter(id => id !== r.room_id)
                            : [...prev.rooms, r.room_id],
                        }));
                      }}
                    >
                      <div className="room-label">
                        {r.room_id} <small>({r.room_type})</small>
                      </div>

                      {!isDisabled && (
                        <button
                          type="button"
                          className="view-occupancy"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOccupancyModal({ visible: true, roomId: r.room_id });
                          }}
                        >
                          <small>View Vacancy</small>
                        </button>
                      )}
                    </div>
                  );
                })}

              {roomOptions.filter(r => !selectedBuilding || r.building_id === selectedBuilding).length === 0 && (
                <div className="no-rooms">No rooms available</div>
              )}
            </div>

            <div className="modal-actions">
              <button type="button" className="close-modal" onClick={() => setShowRoomModal(false)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OCCUPANCY MODAL */}
      {occupancyModal.visible && occupancyModal.roomId && (
        <div className="modal-overlay">
          <div className="modal-contents-modality">
            <h3>Room Occupancy</h3>
            <RoomTimeslots roomId={occupancyModal.roomId} />
            <div className="modal-actions">
              <button
                type="button"
                className="close-modal"
                onClick={() => setOccupancyModal({ visible: false, roomId: null })}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer position="top-right" autoClose={2000} />
    </div>
  );
};

export default BayanihanModality;