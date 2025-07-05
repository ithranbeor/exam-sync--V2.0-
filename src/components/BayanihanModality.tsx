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
interface Course {
  course_id: string;
  course_name: string;
}

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
  const [roomOptions, setRoomOptions] = useState<{ room_id: string; room_name: string }[]>([]);
  const [sectionDropdownOpen, setSectionDropdownOpen] = useState(false);
  const [_userCollege, setUserCollege] = useState<string | null>(null);
  const [_userDepartment, setUserDepartment] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!user?.user_id) return;

      const { data: roles, error: roleError } = await supabase
        .from('tbl_user_role')
        .select('department_id, college_id')
        .eq('user_id', user.user_id);

      if (roleError || !roles?.length) {
        toast.error('No role data found.');
        return;
      }

      const firstRole = roles[0];
      setUserDepartment(firstRole.department_id);
      setUserCollege(firstRole.college_id);

     const { data: userCourses, error: courseError } = await supabase
      .from('tbl_course_users')
      .select('course_id')
      .eq('user_id', user.user_id);

    if (courseError || !userCourses) {
      toast.error('Failed to load your courses');
      return;
    }

    const courseIds = userCourses.map(c => c.course_id);

    const { data: coursesWithNames, error: courseNameError } = await supabase
      .from('tbl_course')
      .select('course_id, course_name')
      .in('course_id', courseIds);

    if (courseNameError || !coursesWithNames) {
      toast.error('Failed to get course names');
      return;
    }

    setCourseOptions(coursesWithNames);

    const uniqueCourses = Array.from(
      new Map(
        coursesWithNames.map((c: { course_id: string; course_name: string }) => [c.course_id, c])
      ).values()
    );
    setCourseOptions(uniqueCourses);

      const userCourseIds = userCourses.map(c => c.course_id);

      const { data: sectionCourses, error: sectionError } = await supabase
        .from('tbl_sectioncourse')
        .select('course_id, program_id, section_name');

      if (sectionError || !sectionCourses) {
        toast.error('Failed to load sections');
        return;
      }

      const filteredSections = sectionCourses.filter(sc =>
        userCourseIds.includes(sc.course_id)
      );

      setSectionOptions(filteredSections);

      const { data: rooms } = await supabase.from('tbl_rooms').select('room_id');
      if (rooms) setRoomOptions(rooms.map(r => ({ room_id: r.room_id, room_name: r.room_id })));
    };

    fetchData();
  }, [user]);

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

    try {
      const selectedSections = sectionOptions.filter(s =>
        form.sections.includes(s.section_name)
      );

      if (selectedSections.length === 0) {
        toast.warn('Please select at least one section.');
        return;
      }

      for (const section of selectedSections) {
        const { error } = await supabase.from('tbl_modality').insert([
          {
            modality_type: form.modality,
            room_type: form.roomType,
            modality_remarks: form.remarks,
            course_id: section.course_id,
            program_id: section.program_id,
            room_id: form.room,
            user_id: user.user_id,
            created_at: new Date().toISOString(),
          },
        ]);

        if (error) {
          console.error('Insert error:', error.message);
          toast.error(`Failed to save modality: ${error.message}`);
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
    } catch (err) {
      console.error('Unexpected error:', err);
      toast.error('An unexpected error occurred.');
    }
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
                  <option value="Online">Online</option>
                  <option value="Written">Written</option>
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
                >
                  <option value="">Select</option>
                  {roomOptions.map((r) => (
                    <option key={r.room_id} value={r.room_id}>
                      {r.room_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Room Type</label>
                <select
                  name="roomType"
                  value={form.roomType}
                  onChange={handleChange}
                  className="custom-select"
                >
                  <option value="">Select</option>
                  <option value="Laboratory">Laboratory</option>
                  <option value="Lecture">Lecture</option>
                </select>
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
                      : `${form.sections.length} section${form.sections.length > 1 ? 's' : ''} selected`}
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
