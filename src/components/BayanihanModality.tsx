import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient.ts';
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
  const [_sectionDropdownOpen, _setSectionDropdownOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false); // add this at the top with other state

  const _dropdownRef = useRef<HTMLDivElement>(null);

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
      const { data: exams, error } = await supabase
        .from('tbl_examdetails')
        .select('room_id, exam_start_time, exam_end_time');

      if (error) {
        console.error("Error fetching exams:", error.message);
        return;
      }

      const statusMap: { [key: string]: { occupiedTimes: { start: string; end: string }[] } } = {};

      exams?.forEach(e => {
        if (!statusMap[e.room_id]) {
          statusMap[e.room_id] = { occupiedTimes: [] };
        }
        statusMap[e.room_id].occupiedTimes.push({ start: e.exam_start_time, end: e.exam_end_time });
      });

      setRoomStatus(statusMap);
    };

    fetchRoomStatus();
  }, []);

  /** FETCH PROGRAMS, COURSES, SECTIONS, ROOMS, BUILDINGS BASED ON USER */
  useEffect(() => {
    const fetchData = async () => {
      if (!user?.user_id) return;

      // USER ROLES
      const { data: roles } = await supabase
        .from('tbl_user_role')
        .select('college_id, department_id')
        .eq('user_id', user.user_id);

      if (!roles || roles.length === 0) return;

      const leaderDepartments = roles.map(r => r.department_id).filter(Boolean);
      if (!leaderDepartments.length) return;

      // PROGRAMS
      const { data: programs } = await supabase
        .from('tbl_program')
        .select('program_id, program_name, department_id')
        .in('department_id', leaderDepartments);

      setProgramOptions(programs ?? []);

      // USER COURSES
      const { data: userCourses } = await supabase
        .from('tbl_course_users')
        .select('course_id')
        .eq('user_id', user.user_id)
        .eq('is_bayanihan_leader', true);

      const courseIds = userCourses?.map(c => c.course_id) ?? [];

      const { data: coursesWithNames } = await supabase
        .from('tbl_course')
        .select('course_id, course_name')
        .in('course_id', courseIds);

      setCourseOptions(coursesWithNames ?? []);

      // SECTIONS
      const { data: sectionCourses } = await supabase
        .from('tbl_sectioncourse')
        .select('course_id, program_id, section_name');

      const filteredSections = sectionCourses?.filter(sc => courseIds.includes(sc.course_id)) ?? [];
      setSectionOptions(filteredSections);

      // ROOMS
      const { data: rooms } = await supabase
        .from('tbl_rooms')
        .select('room_id, room_name, room_type, building_id');

      setRoomOptions(rooms ?? []);

      // BUILDINGS
      const { data: buildings } = await supabase
        .from('tbl_buildings')
        .select('building_id, building_name');

      setBuildingOptions(buildings?.map(b => ({ id: b.building_id, name: b.building_name })) ?? []);
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
    if (isSubmitting) return; // prevent double submit
    if (!user?.user_id) return;
    if (!form.sections.length) {
      toast.warn('Please select at least one section.');
      return;
    }

    setIsSubmitting(true); // start loading

    for (const sectionName of form.sections) {
      const section = sectionOptions.find(
        s => s.course_id === form.course && s.section_name === sectionName
      );
      if (!section) continue;

      const { data: existing, error: checkError } = await supabase
        .from('tbl_modality')
        .select('modality_id')
        .eq('course_id', section.course_id)
        .eq('program_id', section.program_id)
        .eq('section_name', section.section_name)
        .eq('modality_type', form.modality)
        .eq('room_type', form.roomType)
        .maybeSingle();

      if (checkError) {
        console.error('Error checking existing record:', checkError.message);
        toast.error(`Error checking duplicates for ${section.section_name}`);
        continue;
      }

      if (existing) {
        toast.warn(`Already submitted for ${section.section_name}`);
        continue;
      }

      const { error: insertError } = await supabase.from('tbl_modality').insert([
        {
          modality_type: form.modality,
          room_type: form.roomType,
          modality_remarks: form.remarks,
          course_id: section.course_id,
          program_id: section.program_id,
          section_name: section.section_name,
          possible_rooms: form.rooms,
          user_id: user.user_id,
          created_at: new Date().toISOString(),
        },
      ]);

      if (insertError) toast.error(`Failed to save for ${section.section_name}`);
      else toast.success(`Saved for ${section.section_name}`);
    }

    setIsSubmitting(false); // end loading

    // Reset form after submit
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
    dayStart.setHours(7, 30, 0, 0); // 07:30 AM
    const dayEnd = new Date();
    dayEnd.setHours(21, 0, 0, 0); // 09:00 PM

    const status = roomStatus[String(roomId)];
    const occupiedTimes =
      status?.occupiedTimes
        .map((t) => ({ start: new Date(t.start), end: new Date(t.end) }))
        .sort((a, b) => a.start.getTime() - b.start.getTime()) || [];

    const timeslots: { start: Date; end: Date; occupied: boolean }[] = [];
    let cursor = new Date(dayStart);

    for (const slot of occupiedTimes) {
      // Add one vacant block from cursor → slot.start
      if (cursor.getTime() < slot.start.getTime()) {
        timeslots.push({
          start: new Date(cursor),
          end: new Date(slot.start),
          occupied: false,
        });
      }

      // Add the occupied slot itself
      timeslots.push({
        start: new Date(slot.start),
        end: new Date(slot.end),
        occupied: true,
      });

      // Move cursor forward
      cursor = new Date(slot.end);
    }

    // Add final vacant block from last occupied slot → end of day
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
                  disabled={!form.roomType || form.roomType === "No Room"} // 🚫 disabled until modality is chosen
                  onClick={() => setShowRoomModal(true)}
                >
                  Select Room
                </button>

                {/* Show selected rooms */}
                {form.rooms.length > 0 && (
                  <div className="selected-rooms">
                    {form.rooms.map((roomId) => {
                      const r = roomOptions.find(r => r.room_id === roomId);
                      return <span key={roomId} className="room-chip">{r?.room_name}</span>;
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
                  value={programOptions.filter(p => p.program_id === form.program).map(p => ({ value: p.program_id, label: `${p.program_id} - ${p.program_name}` }))}
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
                  value={form.course ? { value: form.course, label: `${courseOptions.find(c => c.course_id === form.course)?.course_id} (${courseOptions.find(c => c.course_id === form.course)?.course_name})` } : null}
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
                        .filter(s => s.course_id === form.course)
                        .map(s => ({ value: s.section_name, label: s.section_name }))
                    ]}
                    value={form.sections.map(sec => ({ value: sec, label: sec }))}
                    onChange={(selected) => {
                      if (!selected) {
                        setForm(prev => ({ ...prev, sections: [] }));
                        return;
                      }

                      const allSectionNames = sectionOptions
                        .filter(s => s.course_id === form.course)
                        .map(s => s.section_name);

                      const selectAllClicked = selected.find(s => s.value === 'select_all');

                      if (selectAllClicked) {
                        // If select all clicked, select all sections
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

                {/* Counter */}
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
                <span className="spinner"></span> // you can style this with CSS
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
              value={
                selectedBuilding
                  ? { value: selectedBuilding, label: `${buildingOptions.find(b => b.id === selectedBuilding)?.name} (${selectedBuilding})` }
                  : null
              }
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

              {/* ✅ Show message if no rooms match */}
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