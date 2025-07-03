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

const BayanihanModality: React.FC<UserProps> = ({ user }) => {
  const [sectionForms, setSectionForms] = useState<{
    section_name: string;
    modality: string;
    room: string;
    roomType: string;
    remarks: string;
  }[]>([]);

  const [courseOptions, setCourseOptions] = useState<{ course_id: string }[]>([]);
  const [sectionOptions, setSectionOptions] = useState<{
    course_id: string;
    program_id: string;
    section_name: string;
  }[]>([]);
  const [roomOptions, setRoomOptions] = useState<{ room_id: string; room_name: string }[]>([]);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [sectionDropdownOpen, setSectionDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!user?.user_id) return;

      const { data: _roles } = await supabase
        .from('tbl_user_role')
        .select('department_id, college_id')
        .eq('user_id', user.user_id);

      const { data: userCourses } = await supabase
        .from('tbl_course')
        .select('course_id')
        .eq('user_id', user.user_id);

      const userCourseIds = userCourses?.map(c => c.course_id) || [];
      setCourseOptions(userCourses || []);

      const { data: sectionCourses } = await supabase
        .from('tbl_sectioncourse')
        .select('course_id, program_id, section_name');

      const filteredSections = (sectionCourses || []).filter(sc =>
        userCourseIds.includes(sc.course_id)
      );

      // Flatten section names split by comma
      const expandedSections = filteredSections.flatMap(sc => {
        return sc.section_name
          .split(',')
          .map((name: string) => ({
            ...sc,
            section_name: name.trim()
          }));
      });

      setSectionOptions(expandedSections);


      const { data: rooms } = await supabase.from('tbl_rooms').select('room_id');
      if (rooms) setRoomOptions(rooms.map(r => ({ room_id: r.room_id, room_name: r.room_id })));
    };

    fetchData();
  }, [user]);

  const handleSectionToggle = (sectionName: string) => {
    setSectionForms(prev => {
      const exists = prev.find(s => s.section_name === sectionName);
      return exists
        ? prev.filter(s => s.section_name !== sectionName)
        : [...prev, { section_name: sectionName, modality: '', room: '', roomType: '', remarks: '' }];
    });
  };

  const updateSectionField = (
    index: number,
    field: keyof (typeof sectionForms)[0],
    value: string
  ) => {
    setSectionForms(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.user_id) return toast.error('User not logged in.');

    const selectedSections = sectionOptions.filter(s =>
      sectionForms.some(sf => sf.section_name === s.section_name)
    );

    let success = 0;
    for (const section of sectionForms) {
      const info = selectedSections.find(s => s.section_name === section.section_name);
      if (!info) continue;

      const { error } = await supabase.from('tbl_modality').insert([
        {
          modality_type: section.modality,
          room_type: section.roomType,
          modality_remarks: section.remarks,
          course_id: info.course_id,
          program_id: info.program_id,
          room_id: section.room,
          user_id: user.user_id,
          created_at: new Date().toISOString(),
        },
      ]);

      if (!error) success++;
    }

    toast.success(`${success} modality record(s) submitted`);
    setSectionForms([]);
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
          <p className="subtitle">Each section can have different modality settings.</p>
          <form className="availability-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Course</label>
              <select
                value={selectedCourse}
                onChange={(e) => setSelectedCourse(e.target.value)}
                className="custom-select"
              >
                <option value="">Select</option>
                {courseOptions.map((c) => (
                  <option key={c.course_id} value={c.course_id}>{c.course_id}</option>
                ))}
              </select>
            </div>

            <div className="form-group full-width">
              <label>Sections</label>
              <div className="dropdown-multiselect" ref={dropdownRef}>
                <div className="dropdown-input" onClick={() => setSectionDropdownOpen(prev => !prev)}>
                  {sectionForms.length === 0 ? 'Select sections' : sectionForms.map(s => s.section_name).join(', ')}
                </div>
                {sectionDropdownOpen && (
                  <div className="dropdown-menu">
                    {sectionOptions.filter(s => s.course_id === selectedCourse).length === 0 ? (
                      <div className="dropdown-item">No sections available for this course.</div>
                    ) : (
                      sectionOptions
                        .filter(s => s.course_id === selectedCourse)
                        .map(s => (
                          <label key={`${s.course_id}-${s.program_id}-${s.section_name}`} className="dropdown-item">
                            <input
                              type="checkbox"
                              checked={sectionForms.some(f => f.section_name === s.section_name)}
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

            {sectionForms.map((section, index) => (
              <div key={section.section_name} className="section-form-group">
                <h4>Section: {section.section_name}</h4>
                <div className="availability-grid">
                  <div className="form-group">
                    <label>Modality Type</label>
                    <select
                      value={section.modality}
                      onChange={(e) => updateSectionField(index, 'modality', e.target.value)}
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
                      value={section.room}
                      onChange={(e) => updateSectionField(index, 'room', e.target.value)}
                      className="custom-select"
                    >
                      <option value="">Select</option>
                      {roomOptions.map((r) => (
                        <option key={r.room_id} value={r.room_id}>{r.room_name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Room Type</label>
                    <select
                      value={section.roomType}
                      onChange={(e) => updateSectionField(index, 'roomType', e.target.value)}
                      className="custom-select"
                    >
                      <option value="">Select</option>
                      <option value="Laboratory">Laboratory</option>
                      <option value="Lecture">Lecture</option>
                    </select>
                  </div>
                  <div className="form-group full-width">
                    <label>Remarks</label>
                    <textarea
                      value={section.remarks}
                      onChange={(e) => updateSectionField(index, 'remarks', e.target.value)}
                      placeholder="Enter any notes or remarks here..."
                    ></textarea>
                  </div>
                </div>
              </div>
            ))}

            <button type="submit" className="submit-button">Submit</button>
          </form>
        </div>
      </div>
      <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} />
    </div>
  );
};

export default BayanihanModality;
