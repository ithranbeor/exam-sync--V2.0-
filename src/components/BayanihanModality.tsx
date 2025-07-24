import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient.ts';
import '../styles/bayanihanModality.css';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

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
    room: '',
    roomType: '',
    sections: [] as string[],
    course: '',
    remarks: '',
  });

  const [courseOptions, setCourseOptions] = useState<{ course_id: string; course_name: string }[]>([]);
  const [sectionOptions, setSectionOptions] = useState<{
    course_id: string;
    program_id: string;
    section_name: string;
  }[]>([]);
  const [roomOptions, setRoomOptions] = useState<{ room_id: string; room_name: string; room_type: string }[]>([]);
  const [sectionDropdownOpen, setSectionDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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
        .eq('user_id', user.user_id);

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
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSectionToggle = (value: string) => {
    setForm(prev => {
      const updatedSections = prev.sections.includes(value)
        ? prev.sections.filter(s => s !== value)
        : [...prev.sections, value];
      return { ...prev, sections: updatedSections };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user?.user_id) {
      toast.error('User not logged in.');
      return;
    }

    const selectedSections = sectionOptions.filter(
      s => s.course_id === form.course && form.sections.includes(s.section_name)
    );

    if (selectedSections.length === 0) {
      toast.warn('Please select at least one section.');
      return;
    }

    const conflictWarnings: string[] = [];

    for (const section of selectedSections) {
      const { data: existing, error: fetchError } = await supabase
        .from('tbl_modality')
        .select('modality_id')
        .eq('room_id', form.room)
        .eq('course_id', section.course_id)
        .eq('program_id', section.program_id);

      if (fetchError) {
        console.error('Error checking existing modality:', fetchError.message);
        toast.error('Failed to check for existing modality conflicts.');
        return;
      }

      if (existing && existing.length > 0) {
        conflictWarnings.push(section.section_name);
      }
    }

    if (conflictWarnings.length > 0) {
      toast.warn(`⚠️ Room already assigned for: ${conflictWarnings.join(', ')}. Proceeding anyway.`);
    }

    for (const section of selectedSections) {
      const { error: insertError } = await supabase.from('tbl_modality').insert([{
        modality_type: form.modality,
        room_type: form.roomType,
        modality_remarks: form.remarks,
        course_id: section.course_id,
        program_id: section.program_id,
        section_name: section.section_name,
        room_id: form.room,
        user_id: user.user_id,
        created_at: new Date().toISOString(),
      }]);

      if (insertError) {
        console.error('Insert error:', insertError.message);
        toast.error(`Failed to save modality for ${section.section_name}`);
        return;
      }
    }

    toast.success('Modality successfully submitted!');
    setForm({
      modality: '',
      room: '',
      roomType: '',
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
                <select
                  name="modality"
                  value={form.modality}
                  onChange={handleChange}
                  className="custom-select"
                >
                  <option value="">Select</option>
                  <option value="Hands-on">Hands-on</option>
                  <option value="Written (Lecture)">Written (Lecture)</option>
                  <option value="Written (Laboratory)">Written (Laboratory)</option>
                  <option value="PIT or Projects">PIT or Projects</option>
                  <option value="Pitching">Pitching</option>
                </select>
              </div>

              <div className="form-group">
                <label>Building-Room</label>
                <select
                  name="room"
                  value={form.room}
                  onChange={handleChange}
                  className="custom-select"
                  disabled={!form.roomType}
                >
                  <option value="">Select</option>
                  {roomOptions
                    .filter(r => r.room_type === form.roomType)
                    .map((r) => (
                      <option key={r.room_id} value={r.room_id}>
                        {r.room_id} - {r.room_name}
                      </option>
                    ))}
                </select>
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
                <label>Course</label>
                <select
                  name="course"
                  value={form.course}
                  onChange={handleChange}
                  className="custom-select"
                >
                  <option value="">Select</option>
                  {courseOptions.map((c) => (
                    <option key={c.course_id} value={c.course_id}>
                      {c.course_id} ({c.course_name})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group full-width">
                <label>Sections</label>
                <div className="dropdown-multiselect" ref={dropdownRef}>
                  <div
                    className="dropdown-input"
                    onClick={() => setSectionDropdownOpen((prev) => !prev)}
                  >
                    {form.sections.length === 0
                      ? 'Select sections'
                      : `${form.sections.length} section${form.sections.length > 1 ? 's' : ''} are selected`}
                  </div>

                  {sectionDropdownOpen && (
                    <div className="dropdown-menu">
                      {sectionOptions.filter((s) => s.course_id === form.course).length === 0 ? (
                        <div className="dropdown-item">No sections available for this course.</div>
                      ) : (
                        sectionOptions
                          .filter((s) => s.course_id === form.course)
                          .map((s) => (
                            <label
                              key={`${s.course_id}-${s.program_id}-${s.section_name}`}
                              className="dropdown-item"
                            >
                              <input
                                type="checkbox"
                                checked={form.sections.includes(s.section_name)}
                                onChange={() => handleSectionToggle(s.section_name)}
                              />
                              {s.section_name}
                            </label>
                          ))
                      )}
                    </div>
                  )}
                </div>
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
