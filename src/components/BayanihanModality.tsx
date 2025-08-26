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
    const [roomStatus, setRoomStatus] = useState<{
    [key: string]: { occupied: boolean; sections: string[] }
  }>({});

  useEffect(() => {
    const fetchRoomStatus = async () => {
      const { data: modalities, error } = await supabase
        .from("tbl_modality")
        .select("room_id, section_name");

      if (error) {
        console.error("Error fetching modalities:", error.message);
        return;
      }

      const statusMap: {
        [key: string]: { occupied: boolean; sections: string[] };
      } = {};

      modalities?.forEach((m) => {
        if (!statusMap[m.room_id]) {
          statusMap[m.room_id] = { occupied: false, sections: [] };
        }
        statusMap[m.room_id].occupied = true;
        statusMap[m.room_id].sections.push(m.section_name);
      });

      setRoomStatus(statusMap);
    };

    fetchRoomStatus();
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      if (!user?.user_id) return;

      const { data: roles, error: roleError } = await supabase
        .from('tbl_user_role')
        .select('college_id, department_id')
        .eq('user_id', user.user_id);

      if (roleError || !roles || roles.length === 0) {
        toast.error('No role found.');
        return;
      }

      const hasValidAssignment = roles.some(role => role.college_id || role.department_id);
      if (!hasValidAssignment) {
        toast.warn('You are not assigned to any department or college.');
        setCourseOptions([]);
        return;
      }

      const { data: userCourses, error: courseUserError } = await supabase
        .from('tbl_course_users')
        .select('course_id')
        .eq('user_id', user.user_id)
        .eq('is_bayanihan_leader', true); // ✅ only leader courses

      if (courseUserError || !userCourses) {
        toast.error('Failed to load your assigned courses');
        return;
      }

      const courseIds = userCourses.map(c => c.course_id);

      const { data: coursesWithNames, error: courseError } = await supabase
        .from('tbl_course')
        .select('course_id, course_name')
        .in('course_id', courseIds);

      if (courseError || !coursesWithNames) {
        toast.error('Failed to fetch course names');
        return;
      }

      setCourseOptions(coursesWithNames);

      const { data: sectionCourses, error: sectionError } = await supabase
        .from('tbl_sectioncourse')
        .select('course_id, program_id, section_name');

      if (sectionError || !sectionCourses) {
        toast.error('Failed to fetch section data');
        return;
      }

      const filteredSections = sectionCourses.filter(sc => courseIds.includes(sc.course_id));
      setSectionOptions(filteredSections);

      const { data: rooms } = await supabase
        .from('tbl_rooms')
        .select('room_id, room_name, room_type');

      setRoomOptions(rooms ?? []);

      const leaderDepartments = roles
        .map(r => r.department_id)
        .filter(Boolean);

      if (leaderDepartments.length === 0) {
        toast.warn("You are not assigned to any department as Bayanihan Leader.");
        setProgramOptions([]);
        return;
      }

      const { data: programs, error: programError } = await supabase
        .from('tbl_program')
        .select('program_id, program_name, department_id')
        .in('department_id', leaderDepartments);

      if (programError || !programs) {
        toast.error('Failed to load programs');
        return;
      }

      setProgramOptions(programs);
    };

    fetchData();
  }, [user]);

  useEffect(() => {
    const autoSelectRoom = () => {
      const requiredRoomType = modalityRoomTypeMap[form.modality];
      if (!requiredRoomType) {
        setForm(prev => ({ ...prev, room: '', roomType: '' }));
        return;
      }

      const matchingRoom = roomOptions.find(room => room.room_type === requiredRoomType);
      if (matchingRoom) {
        setForm(prev => ({
          ...prev,
          room: matchingRoom.room_id,
          roomType: matchingRoom.room_type,
        }));
      } else {
        setForm(prev => ({ ...prev, room: '', roomType: requiredRoomType }));
        toast.warn(`No rooms available for ${requiredRoomType}.`);
      }
    };

    autoSelectRoom();
  }, [form.modality, roomOptions]);

  const handleChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
      ) => {
        const { name, value } = e.target;
        if (name === 'program') {
          setForm(prev => ({
            ...prev,
            program: value,
            course: '', // reset course
            sections: [] // reset sections
          }));
        } else {
          setForm({ ...form, [name]: value });
        }
      };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user?.user_id) {
      toast.error('User not logged in.');
      return;
    }

    if (form.sections.length === 0) {
      toast.warn('Please select at least one section.');
      return;
    }

    // ✅ Instead of assigning rooms directly, just save them as possible options
    // ✅ Sanitize rooms here before looping
    const rooms: string[] = Array.isArray(form.rooms)
      ? form.rooms.map((r: any) => (typeof r === "string" ? r : r.value))
      : [];

    for (const sectionName of form.sections) {
      const section = sectionOptions.find(
        (s) => s.course_id === form.course && s.section_name === sectionName
      );

      if (!section) continue;

      console.log("Saving:", section.section_name, "Rooms:", rooms);

      const { error: insertError } = await supabase.from("tbl_modality").insert([
        {
          modality_type: form.modality,
          room_type: form.roomType,
          modality_remarks: form.remarks,
          course_id: section.course_id,
          program_id: section.program_id,
          section_name: section.section_name,
          possible_rooms: rooms,
          user_id: user.user_id,
          created_at: new Date().toISOString(),
        },
      ]);

      if (insertError) {
        console.error("Insert error:", insertError.message, insertError.details);
        toast.error(`Failed to save for ${section.section_name}`);
      } else {
        toast.success(`Saved for ${section.section_name}`);
      }
    }

    toast.success('Modality successfully submitted!');
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

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setSectionDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="set-availability-container">
      <div className="availability-sections">
        <div className="availability-card">
          <div className="card-header-set">Modality Submission</div>
          <p className="subtitle">Please fill in all fields before submitting.</p>
          <form className="availability-form" onSubmit={handleSubmit}>
            <div className="availability-grid">
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
                  value={
                    form.modality
                      ? { value: form.modality, label: form.modality }
                      : null
                  }
                  onChange={(selected) => {
                    setForm(prev => ({
                      ...prev,
                      modality: selected?.value || ''
                    }));
                  }}
                  placeholder="Select modality..."
                  isClearable
                />
              </div>

              <div className="form-group">
                <label>Building-Room</label>
                <Select
                  isMulti
                  isDisabled={!form.roomType}
                  options={roomOptions
                    .filter((r) => r.room_type === form.roomType)
                    .map((r) => {
                      const status = roomStatus[r.room_id];
                      const occupied = status?.occupied ?? false;
                      return {
                        value: r.room_id,
                        label: `${r.room_id} - ${r.room_name}`,
                        occupied,
                        tooltip: occupied
                          ? `Occupied by: ${status.sections.join(", ")}`
                          : "Vacant",
                      };
                    })}
                  value={form.rooms.map((roomId) => {
                    const r = roomOptions.find((x) => x.room_id === roomId);
                    const status = r ? roomStatus[r.room_id] : undefined;
                    const occupied = status?.occupied ?? false;
                    return r
                      ? {
                          value: r.room_id,
                          label: `${r.room_id} - ${r.room_name}`,
                          occupied,
                        }
                      : null;
                  }).filter(Boolean)}
                  onChange={(selected) => {
                    setForm((prev) => ({
                      ...prev,
                      rooms: selected ? selected.map((s: any) => s.value) : [],
                    }));
                  }}
                  placeholder="Select room(s)..."
                  isClearable
                  formatOptionLabel={(option: any) => (
                    <div
                      title={option.tooltip}
                      style={{ display: "flex", alignItems: "center", gap: "6px" }}
                    >
                      <span
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: "50%",
                          backgroundColor: option.occupied ? "red" : "green", // 🔴 if occupied, 🟢 if free
                          display: "inline-block",
                        }}
                      />
                      <span>{option.label}</span>
                    </div>
                  )}
                />
              </div>
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

              <div className="form-group">
                <label>Program</label>
                <Select
                  options={programOptions.map(p => ({
                    value: p.program_id,
                    label: `${p.program_id} - ${p.program_name}`
                  }))}
                  value={programOptions
                    .filter(p => p.program_id === form.program)
                    .map(p => ({ value: p.program_id, label: `${p.program_id} - ${p.program_name}` }))}
                  onChange={(selected) => {
                    setForm(prev => ({
                      ...prev,
                      program: selected?.value || '',
                      course: '',
                      sections: []
                    }));
                  }}
                  placeholder="Select program..."
                  isClearable
                />
              </div>

              <div className="form-group">
                <label>Course</label>
                <Select
                  isDisabled={!form.program}
                  options={courseOptions
                    .filter(c =>
                      sectionOptions.some(
                        s => s.program_id === form.program && s.course_id === c.course_id
                      )
                    )
                    .map(c => ({
                      value: c.course_id,
                      label: `${c.course_id} (${c.course_name})`,
                    }))}
                  value={
                    form.course
                      ? {
                          value: form.course,
                          label: `${
                            courseOptions.find(c => c.course_id === form.course)?.course_id
                          } (${
                            courseOptions.find(c => c.course_id === form.course)?.course_name
                          })`,
                        }
                      : null
                  }
                  onChange={(selected) =>
                    setForm(prev => ({
                      ...prev,
                      course: selected?.value || '',
                      sections: [],
                    }))
                  }
                  placeholder="Select course..."
                  isClearable
                />
              </div>
              <div className="form-group full-width">
                <label>Sections</label>
                <Select
                  isMulti
                  isDisabled={!form.course}
                  options={sectionOptions
                    .filter(s => s.course_id === form.course)
                    .map(s => ({
                      value: s.section_name,
                      label: s.section_name
                    }))}
                  value={form.sections.map(sec => ({ value: sec, label: sec }))}
                  onChange={(selected) => {
                    setForm(prev => ({
                      ...prev,
                      sections: selected ? selected.map(s => s.value) : []
                    }));
                  }}
                  placeholder="Select sections..."
                  isClearable
                />
              </div>
            </div>

            <div className="form-group">
              <label>Remarks</label>
              <textarea
                name="remarks"
                value={form.remarks}
                onChange={handleChange}
                placeholder="Enter any notes or remarks here..."
              ></textarea>
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