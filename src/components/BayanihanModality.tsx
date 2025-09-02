import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient.ts';
import '../styles/bayanihanModality.css';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Select from 'react-select';

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
  const [sectionOptions, setSectionOptions] = useState<{
    course_id: string;
    program_id: string;
    section_name: string;
  }[]>([]);
  const [roomOptions, setRoomOptions] = useState<{ room_id: string; room_name: string; room_type: string }[]>([]);
  const [_sectionDropdownOpen, setSectionDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Room status with occupied times
  const [roomStatus, setRoomStatus] = useState<{
    [key: string]: { occupiedTimes: { start: string; end: string }[] }
  }>({});

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

  /** FETCH PROGRAMS, COURSES, SECTIONS, ROOMS BASED ON USER */
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
        .select('room_id, room_name, room_type');

      setRoomOptions(rooms ?? []);
    };

    fetchData();
  }, [user]);

  /** AUTO-SELECT ROOM BASED ON MODALITY TYPE */
  useEffect(() => {
    const requiredRoomType = modalityRoomTypeMap[form.modality];
    if (!requiredRoomType) return;

    const matchingRoom = roomOptions.find(room => room.room_type === requiredRoomType);
    if (matchingRoom) {
      setForm(prev => ({ ...prev, rooms: [matchingRoom.room_id], roomType: requiredRoomType }));
    } else {
      setForm(prev => ({ ...prev, rooms: [], roomType: requiredRoomType }));
      toast.warn(`No rooms available for ${requiredRoomType}.`);
    }
  }, [form.modality, roomOptions]);

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

    if (!user?.user_id) return;
    if (!form.sections.length) {
      toast.warn('Please select at least one section.');
      return;
    }

    for (const sectionName of form.sections) {
      const section = sectionOptions.find(s => s.course_id === form.course && s.section_name === sectionName);
      if (!section) continue;

      const { error: insertError } = await supabase.from('tbl_modality').insert([{
        modality_type: form.modality,
        room_type: form.roomType,
        modality_remarks: form.remarks,
        course_id: section.course_id,
        program_id: section.program_id,
        section_name: section.section_name,
        possible_rooms: form.rooms,
        user_id: user.user_id,
        created_at: new Date().toISOString(),
      }]);

      if (insertError) toast.error(`Failed to save for ${section.section_name}`);
      else toast.success(`Saved for ${section.section_name}`);
    }

    setForm({ modality: '', rooms: [], roomType: '', program: '', sections: [], course: '', remarks: '' });
  };

  /** CLICK OUTSIDE DROPDOWN */
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setSectionDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  /** GET ROOM TIMESLOTS */
  const getRoomTimeslots = (roomId: string) => {
    const dayStart = "07:30";
    const dayEnd = "18:00";
    const today = new Date();
    let current = new Date(today.toDateString() + " " + dayStart);
    const dayEndDate = new Date(today.toDateString() + " " + dayEnd);

    const status = roomStatus[roomId];
    if (!status || !status.occupiedTimes.length) return [{ start: current, end: dayEndDate, occupied: false }];

    const occupiedSorted = status.occupiedTimes
      .map(t => ({ start: new Date(t.start), end: new Date(t.end) }))
      .sort((a, b) => a.start.getTime() - b.start.getTime());

    const timeslots: { start: Date; end: Date; occupied: boolean }[] = [];
    for (const t of occupiedSorted) {
      if (current < t.start) timeslots.push({ start: current, end: t.start, occupied: false });
      timeslots.push({ start: t.start, end: t.end, occupied: true });
      current = t.end > current ? t.end : current;
    }
    if (current < dayEndDate) timeslots.push({ start: current, end: dayEndDate, occupied: false });
    return timeslots;
  };

  /** RENDER TIMESLOT VISUALS */
  const RoomTimeslots: React.FC<{ roomId: string }> = ({ roomId }) => {
    const slots = getRoomTimeslots(roomId);
    return (
      <div className="timeslot-container">
        {slots.map((slot, i) => (
          <div
            key={i}
            className="timeslot-block"
            style={{
              backgroundColor: slot.occupied ? "red" : "green",
              width: `${((slot.end.getTime() - slot.start.getTime()) / (10.5 * 60 * 60 * 1000)) * 100}%`,
              height: "16px",
              marginBottom: "2px",
              borderRadius: "4px",
            }}
            title={`${slot.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${slot.end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ${slot.occupied ? '(Occupied)' : '(Free)'}`}
          />
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
                <Select
                  isMulti
                  isDisabled={!form.roomType}
                  options={roomOptions
                    .filter(r => r.room_type === form.roomType)
                    .map(r => {
                      const status = roomStatus[r.room_id];
                      const occupied = status?.occupiedTimes.length > 0;
                      return {
                        value: r.room_id,
                        label: `${r.room_id} - ${r.room_name}`,
                        occupied
                      };
                    })}
                  value={form.rooms.map(roomId => {
                    const r = roomOptions.find(x => x.room_id === roomId);
                    const status = r ? roomStatus[r.room_id] : undefined;
                    return r ? { value: r.room_id, label: `${r.room_id} - ${r.room_name}`, occupied: status?.occupiedTimes && status.occupiedTimes.length > 0 } : null;
                  }).filter(Boolean)}
                  onChange={selected => setForm(prev => ({ ...prev, rooms: selected ? selected.map((s: any) => s.value) : [] }))}
                  placeholder="Select room(s)..."
                  formatOptionLabel={(option: any) => (
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span style={{
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        backgroundColor: option.occupied ? "red" : "green",
                        display: "inline-block"
                      }} />
                      <span>{option.label}</span>
                    </div>
                  )}
                />

                {/* VISUAL TIMESLOTS */}
                {form.rooms.map(roomId => {
                  const r = roomOptions.find(r => r.room_id === roomId);
                  if (!r) return null;
                  return (
                    <div key={r.room_id} className="room-timeslot-visual">
                      <label>{r.room_name}</label>
                      <RoomTimeslots roomId={r.room_id} />
                    </div>
                  );
                })}
              </div>

              {/* ROOM TYPE */}
              <div className="form-group">
                <label>Room Type</label>
                <input type="text" name="roomType" value={form.roomType} readOnly className="custom-select" placeholder="Auto-filled" />
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
                <Select
                  isMulti
                  isDisabled={!form.course}
                  options={sectionOptions.filter(s => s.course_id === form.course).map(s => ({ value: s.section_name, label: s.section_name }))}
                  value={form.sections.map(sec => ({ value: sec, label: sec }))}
                  onChange={selected => setForm(prev => ({ ...prev, sections: selected ? selected.map(s => s.value) : [] }))}
                  placeholder="Select sections..."
                  isClearable
                />
              </div>

              {/* REMARKS */}
              <div className="form-group">
                <label>Remarks</label>
                <textarea name="remarks" value={form.remarks} onChange={handleChange} placeholder="Enter any notes or remarks here..."></textarea>
              </div>

            </div>

            <button type="submit" className="submit-button">Submit</button>
          </form>
        </div>
      </div>
      <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} />
    </div>
  );
};

export default BayanihanModality;
