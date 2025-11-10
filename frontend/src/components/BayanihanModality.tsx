import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
  const [availableRoomIds, setAvailableRoomIds] = useState<string[]>([]);
  const [_sectionDropdownOpen, _setSectionDropdownOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingRooms, setLoadingRooms] = useState(true);

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

  const CheckboxOption = (props: any) => (
    <components.Option {...props}>
      <input
        type="checkbox"
        checked={props.isSelected}
        readOnly
        style={{ marginRight: 8 }}
      />
      <label>{props.label}</label>
    </components.Option>
  );

  /** FETCH ROOM STATUS BASED ON EXAMDETAILS (lazy loaded when viewing occupancy) */
  const fetchRoomOccupancy = useCallback(async (roomId: string) => {
    if (roomStatus[roomId]) return; // Already loaded

    try {
      const { data: exams } = await api.get('/tbl_examdetails', {
        params: { room_id: roomId }
      });

      const occupiedTimes = exams.map((e: any) => ({
        start: e.exam_start_time,
        end: e.exam_end_time,
      }));

      setRoomStatus(prev => ({
        ...prev,
        [roomId]: { occupiedTimes }
      }));
    } catch (error: any) {
      console.error('Error loading room occupancy:', error);
    }
  }, [roomStatus]);

  // Memoize filtered courses based on program
  const filteredCourseOptions = useMemo(() => {
    if (!form.program) return [];
    return courseOptions.filter(c => 
      sectionOptions.some(s => s.program_id === form.program && s.course_id === c.course_id)
    );
  }, [courseOptions, sectionOptions, form.program]);

  // Memoize filtered sections based on course
  const filteredSectionOptions = useMemo(() => {
    if (!form.course) return [];
    return sectionOptions
      .filter(s => s.course_id === form.course)
      .map(s => ({ value: s.section_name, label: s.section_name }));
  }, [sectionOptions, form.course]);

  /** FETCH PROGRAMS, COURSES, SECTIONS, ROOMS, BUILDINGS, AND AVAILABLE ROOMS */
  useEffect(() => {
    const fetchData = async () => {
      if (!user?.user_id) return;

      setLoadingRooms(true);

      try {
        // PARALLEL API CALLS - Fetch everything at once
        const [
          { data: roles },
          { data: allPrograms },
          { data: allCourses },
          { data: sectionCourses },
          { data: allDepartments },
          { data: buildings },
          { data: availableRooms }
        ] = await Promise.all([
          api.get('/tbl_user_role', { params: { user_id: user.user_id } }),
          api.get('/programs/'),
          api.get('/courses/'),
          api.get('/tbl_sectioncourse/'),
          api.get('/departments/'),
          api.get('/tbl_buildings'),
          api.get('/tbl_available_rooms/')
        ]);

        if (!roles || roles.length === 0) {
          setLoadingRooms(false);
          return;
        }

        // Get leader roles
        const leaderRoles = roles.filter((r: any) => 
          r.role === 4 || r.role_id === 4
        );

        if (!leaderRoles || leaderRoles.length === 0) {
          toast.warn('You are not assigned as a Bayanihan Leader.');
          setLoadingRooms(false);
          return;
        }

        const leaderDepartmentIds = leaderRoles
          .map((r: any) => r.department_id || r.department)
          .filter(Boolean);

        if (leaderDepartmentIds.length === 0) {
          toast.warn('No department assigned to your Bayanihan Leader role.');
          setLoadingRooms(false);
          return;
        }

        // Get colleges from departments
        const departments = allDepartments.filter((d: any) =>
          leaderDepartmentIds.includes(d.department_id)
        );

        const collegeIds = departments
          .map((d: any) => d.college_id || d.college)
          .filter(Boolean);

        if (collegeIds.length === 0) {
          toast.warn('No associated college found for your department.');
          setLoadingRooms(false);
          return;
        }

        // Filter programs by department
        const programs = allPrograms.filter((p: any) => {
          const progDept = p.department_id || p.department || p.dept_id || p.dept;
          return leaderDepartmentIds.includes(progDept);
        });
        setProgramOptions(programs);

        // Fetch user courses - this still needs to be separate
        const { data: userCourses } = await api.get('/tbl_course_users/', {
          params: { user_id: user.user_id, is_bayanihan_leader: true }
        });

        const courseIds = userCourses?.map((c: any) => c.course_id) ?? [];

        // Filter courses
        const coursesWithNames = allCourses.filter((c: any) => 
          courseIds.includes(c.course_id)
        );
        setCourseOptions(coursesWithNames);

        // Filter sections
        const filteredSections = sectionCourses
          ?.filter((sc: any) => courseIds.includes(sc.course_id || sc.course?.course_id))
          .map((sc: any) => ({
            course_id: sc.course_id || sc.course?.course_id,
            program_id: sc.program_id || sc.program?.program_id,
            section_name: sc.section_name
          })) ?? [];
        setSectionOptions(filteredSections);

        // Filter available rooms by college
        const filteredAvailableRooms = availableRooms.filter((r: any) =>
          collegeIds.includes(r.college_id || r.college)
        );

        const availableIds = filteredAvailableRooms?.map((r: any) => r.room_id || r.room) ?? [];
        setAvailableRoomIds(availableIds);

        // Fetch rooms if available
        if (availableIds.length > 0) {
          const { data: allRooms } = await api.get('/tbl_rooms');
          const filteredRooms = allRooms.filter((r: any) => 
            availableIds.includes(r.room_id)
          );
          setRoomOptions(filteredRooms);
        } else {
          setRoomOptions([]);
        }

        // Set buildings
        setBuildingOptions(
          buildings?.map((b: any) => ({ 
            id: b.building_id, 
            name: b.building_name 
          })) ?? []
        );

        console.log('Available Room IDs:', availableIds);
      } catch (error: any) {
        console.error('Unexpected error fetching data:', error);
        toast.error('An unexpected error occurred while loading data');
      } finally {
        setLoadingRooms(false);
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

    if (form.sections.length !== form.rooms.length) {
      toast.error(`Number of sections must be equal to the number of rooms! (${form.sections.length} of ${form.rooms.length} selected)`);
      return;
    }

    setIsSubmitting(true);

    const submissions = form.sections.map(async (sectionName) => {
      const section = sectionOptions.find(
        s => s.course_id === form.course && s.section_name === sectionName
      );
      if (!section) {
        return { status: 'rejected', reason: `Section ${sectionName} not found` };
      }

      try {
        // Check for existing record
        const { data: existing } = await api.get('/tbl_modality/', {
          params: {
            course_id: section.course_id,
            program_id: section.program_id,
            section_name: section.section_name,
            modality_type: form.modality,
            room_type: form.roomType
          }
        });

        if (existing && existing.length > 0) {
          return { status: 'skipped', section: sectionName };
        }

        // Insert new record
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

        return { status: 'success', section: sectionName };
      } catch (error) {
        return { status: 'error', section: sectionName, error };
      }
    });

    const results = await Promise.allSettled(submissions);

    let successCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    results.forEach((result) => {
      if (result.status === 'fulfilled') {
        const value = result.value as any;
        if (value.status === 'success') successCount++;
        else if (value.status === 'skipped') skippedCount++;
        else errorCount++;
      } else {
        errorCount++;
      }
    });

    if (successCount > 0) toast.success(`Successfully saved ${successCount} section(s)`);
    if (skippedCount > 0) toast.info(`Skipped ${skippedCount} section(s) (already submitted)`);
    if (errorCount > 0) toast.error(`Failed to save ${errorCount} section(s)`);

    setIsSubmitting(false);

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
  const getRoomTimeslots = useCallback((roomId: string) => {
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
  }, [roomStatus]);

  /** RENDER TIMESLOT LIST */
  const RoomTimeslots: React.FC<{ roomId: string }> = ({ roomId }) => {
    useEffect(() => {
      fetchRoomOccupancy(roomId);
    }, [roomId]);

    const slots = getRoomTimeslots(roomId);

    if (!roomStatus[roomId]) {
      return <div style={{ textAlign: 'center', padding: '1rem' }}>Loading occupancy...</div>;
    }

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

  // Filter rooms to only show available ones
  const filteredRoomOptions = useMemo(() => 
    roomOptions.filter(r => availableRoomIds.includes(r.room_id)),
    [roomOptions, availableRoomIds]
  );

  // Memoized sorted and filtered rooms for modal
  const filteredAndSortedRooms = useMemo(() => {
    return filteredRoomOptions
      .filter(r => !selectedBuilding || r.building_id === selectedBuilding)
      .sort((a, b) => {
        if (a.room_type === form.roomType && b.room_type !== form.roomType) return -1;
        if (a.room_type !== form.roomType && b.room_type === form.roomType) return 1;
        return a.room_name.localeCompare(b.room_name);
      });
  }, [filteredRoomOptions, selectedBuilding, form.roomType]);

  return (
    <div className="set-availability-container">
      <div className="availability-sections">
        <div className="availability-card">
          <div className="card-header-set">Modality Submission</div>
          <p className="subtitle">Please fill in all fields before submitting.</p>
          
          {loadingRooms ? (
            <div style={{ 
              backgroundColor: '#e3f2fd', 
              border: '1px solid #2196F3', 
              padding: '12px', 
              borderRadius: '4px', 
              marginBottom: '20px',
              color: '#1565C0',
              textAlign: 'center'
            }}>
              Loading available rooms...
            </div>
          ) : availableRoomIds.length === 0 ? (
            <div style={{ 
              backgroundColor: '#fff3cd', 
              border: '1px solid #ffc107', 
              padding: '12px', 
              borderRadius: '4px', 
              marginBottom: '20px',
              color: '#856404'
            }}>
              ⚠️ No rooms are currently available for selection. Please contact the administrator to set up available rooms in the Room Management page.
            </div>
          ) : null}

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
                  disabled={!form.roomType || form.roomType === "No Room" || availableRoomIds.length === 0 || loadingRooms}
                  onClick={() => setShowRoomModal(true)}
                >
                  {loadingRooms ? 'Loading...' : 'Select Room'}
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
                  options={filteredCourseOptions.map(c => ({ 
                    value: c.course_id, 
                    label: `${c.course_id} (${c.course_name})` 
                  }))}
                  value={form.course ? { 
                    value: form.course, 
                    label: `${filteredCourseOptions.find(c => c.course_id === form.course)?.course_id} (${filteredCourseOptions.find(c => c.course_id === form.course)?.course_name})` 
                  } : null}
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
                      ...filteredSectionOptions
                    ]}
                    value={form.sections.map(sec => ({ value: sec, label: sec }))}
                    onChange={(selected) => {
                      if (!selected) {
                        setForm(prev => ({ ...prev, sections: [] }));
                        return;
                      }

                      const allSections = filteredSectionOptions.map(s => s.value);
                      const isSelectAll = selected.some(s => s.value === 'select_all');

                      if (isSelectAll) {
                        if (form.rooms.length === 0) {
                          toast.warn('Please select rooms first before using "Select All".');
                          return;
                        }

                        const limitedSections = allSections.slice(0, form.rooms.length);
                        setForm(prev => ({ ...prev, sections: limitedSections }));
                        toast.info(`Only ${form.rooms.length} section(s) selected.`);
                        return;
                      }

                      const selectedValues = selected.map(s => s.value);
                      if (selectedValues.length > form.rooms.length) {
                        toast.error(`You can only select ${form.rooms.length} section(s) because ${form.rooms.length} room(s) are selected.`);
                        return;
                      }

                      setForm(prev => ({ ...prev, sections: selectedValues }));
                    }}
                    placeholder="Select sections..."
                  />
                ) : (
                  <p style={{ color: "#888" }}>Select a course first</p>
                )}

                {form.rooms.length > 0 && (
                  <small style={{ marginTop: "4px", display: "block", color: form.sections.length !== form.rooms.length ? "red" : "#666" }}>
                    ⚠️ Number of sections must be equal to the number of rooms! {form.sections.length} of {form.rooms.length} section(s) selected.
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
              {filteredAndSortedRooms.map(r => {
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

              {filteredAndSortedRooms.length === 0 && (
                <div className="no-rooms">No available rooms for this room type</div>
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