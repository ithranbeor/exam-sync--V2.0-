import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../lib/apiClient.ts';
import '../styles/bayanihanModality.css';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Select, { components } from 'react-select';
import { FaTrash  } from "react-icons/fa";

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

  // Modal states
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [selectedBuilding, setSelectedBuilding] = useState<string | null>(null);
  const [buildingOptions, setBuildingOptions] = useState<{ id: string; name: string }[]>([]);
  const [occupancyModal, setOccupancyModal] = useState<{ visible: boolean; roomId: string | null }>({
    visible: false,
    roomId: null,
  });

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [userModalities, setUserModalities] = useState<any[]>([]);
  const [selectedForDelete, setSelectedForDelete] = useState<number[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchUserModalities = useCallback(async () => {
    if (!user?.user_id) return;

    try {
      const { data } = await api.get('/tbl_modality/', {
        params: { user_id: user.user_id }
      });

      setUserModalities(data || []);
      console.log('User modalities loaded:', data?.length || 0);
    } catch (error) {
      console.error('Error fetching user modalities:', error);
      toast.error('Failed to load your modalities');
    }
  }, [user]);

  // Add this useEffect to load user's modalities on component mount
  useEffect(() => {
    fetchUserModalities();
  }, [fetchUserModalities]);

  // Add delete handlers
  const handleDeleteSelected = async () => {
    if (selectedForDelete.length === 0) {
      toast.warn('Please select modalities to delete');
      return;
    }

    setIsDeleting(true);

    try {
      await Promise.all(
        selectedForDelete.map(modalityId =>
          api.delete(`/tbl_modality/${modalityId}/`)
        )
      );

      toast.success(`Successfully deleted ${selectedForDelete.length} modality/modalities`);
      setSelectedForDelete([]);
      setShowDeleteConfirm(false);
      
      // Refresh the list
      await fetchUserModalities();
    } catch (error) {
      console.error('Error deleting modalities:', error);
      toast.error('Failed to delete some modalities');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteAll = async () => {
    if (userModalities.length === 0) {
      toast.warn('No modalities to delete');
      return;
    }

    const confirmed = window.confirm(
      `⚠️ WARNING: You are about to delete ALL ${userModalities.length} modalities you created.\n\nThis action cannot be undone. Continue?`
    );

    if (!confirmed) return;

    setIsDeleting(true);

    try {
      await Promise.all(
        userModalities.map(modality =>
          api.delete(`/tbl_modality/${modality.modality_id}/`)
        )
      );

      toast.success(`Successfully deleted all ${userModalities.length} modalities`);
      setUserModalities([]);
      setSelectedForDelete([]);
      setShowDeleteConfirm(false);
    } catch (error) {
      console.error('Error deleting all modalities:', error);
      toast.error('Failed to delete all modalities');
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleSelectModality = (modalityId: number) => {
    setSelectedForDelete(prev =>
      prev.includes(modalityId)
        ? prev.filter(id => id !== modalityId)
        : [...prev, modalityId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedForDelete.length === userModalities.length) {
      setSelectedForDelete([]);
    } else {
      setSelectedForDelete(userModalities.map(m => m.modality_id));
    }
  };

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
          { data: buildings }
        ] = await Promise.all([
          api.get('/tbl_user_role', { params: { user_id: user.user_id } }),
          api.get('/programs/'),
          api.get('/courses/'),
          api.get('/tbl_sectioncourse/'),
          api.get('/departments/'),
          api.get('/tbl_buildings')
        ]);

        if (!roles || roles.length === 0) {
          setLoadingRooms(false);
          return;
        }

        // Check if user is admin (role 2 or role_id 2)
        const isAdmin = roles.some((r: any) => r.role === 2 || r.role_id === 2);

        if (isAdmin) {
          // ADMIN: Show all programs, courses, sections, and ALL rooms (not filtered by scheduler)
          setProgramOptions(allPrograms);
          setCourseOptions(allCourses);

          const allSections = sectionCourses.map((sc: any) => ({
            course_id: sc.course_id || sc.course?.course_id,
            program_id: sc.program_id || sc.program?.program_id,
            section_name: sc.section_name
          }));
          setSectionOptions(allSections);

          // Fetch ALL rooms for admin (not filtered by available_rooms)
          const { data: allRooms } = await api.get('/tbl_rooms');
          setRoomOptions(allRooms);
          setAvailableRoomIds(allRooms.map((r: any) => r.room_id));

          // Set buildings
          setBuildingOptions(
            buildings?.map((b: any) => ({ 
              id: b.building_id, 
              name: b.building_name 
            })) ?? []
          );

          console.log('Admin access: All rooms available (not filtered by scheduler)');
          setLoadingRooms(false);
          return;
        }

        // Get leader roles (Bayanihan Leader = role 4)
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

        // FIX: Extract college IDs properly (they might be objects)
        const collegeIdStrings = collegeIds
          .map((c: any) => String(c.college_id || c))
          .filter(Boolean);

        // FIX: Get department names to match against program.department field
        const deptNames = departments.map((d: any) => d.department_name).filter(Boolean);

        console.log('=== BAYANIHAN LEADER DEBUG ===');
        console.log('Leader Department IDs:', leaderDepartmentIds);
        console.log('Department Names:', deptNames);
        console.log('College IDs (objects):', collegeIds);
        console.log('College ID Strings:', collegeIdStrings);

        // Filter programs by matching department name OR college ID
        const programs = allPrograms.filter((p: any) => {
          const progDeptName = String(p.department || p.department_name || '');
          const progDeptId = String(p.department_id || '');
          const progCollege = String(p.college_id || p.college || '');

          // Match by department ID or name
          const deptMatch = 
            leaderDepartmentIds.includes(progDeptId) ||
            deptNames.some((name: string) => progDeptName.includes(name));
          
          // Match by college ID
          const collegeMatch = collegeIdStrings.includes(progCollege);

          return deptMatch || collegeMatch;
        });

        console.log('Total Programs:', allPrograms.length);
        console.log('Filtered Programs:', programs.length);
        console.log('Sample Program:', allPrograms[0]);
        console.log('==============================');

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

        // BAYANIHAN LEADER: Fetch available rooms for their college(s)
        console.log('Fetching available rooms for colleges:', collegeIdStrings);
        
        // Fetch available rooms for each college using the string IDs
        const availableRoomsPromises = collegeIdStrings.map((collegeId: string) => 
          api.get('/tbl_available_rooms/', { params: { college_id: collegeId } })
        );
        
        const availableRoomsResponses = await Promise.all(availableRoomsPromises);
        
        // Combine all available rooms from all colleges
        const allAvailableRooms = availableRoomsResponses.flatMap(response => response.data);
        
        console.log('Available rooms data:', allAvailableRooms);
        
        // Extract room IDs - handle both nested room object and direct room_id
        const availableIds = allAvailableRooms
          .map((ar: any) => {
            // Try to get room_id from nested room object first, then from direct room_id property
            return ar.room?.room_id || ar.room_id || ar.room;
          })
          .filter((id: string) => id); // Filter out undefined/null values
        
        console.log('Extracted room IDs:', availableIds);
        
        setAvailableRoomIds(availableIds.map(String));

        // Fetch all rooms and filter by available IDs
        if (availableIds.length > 0) {
          const { data: allRooms } = await api.get('/tbl_rooms');
          const filteredRooms = allRooms.filter((r: any) => 
            availableIds.includes(r.room_id)
          );
          setRoomOptions(filteredRooms);
          console.log('Filtered rooms for Bayanihan Leader:', filteredRooms);
        } else {
          setRoomOptions([]);
          console.log('No available rooms found for Bayanihan Leader');
        }

        // Set buildings
        setBuildingOptions(
          buildings?.map((b: any) => ({ 
            id: b.building_id, 
            name: b.building_name 
          })) ?? []
        );

        console.log('Bayanihan Leader - Available Room IDs (set by scheduler):', availableIds);
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
      setForm(prev => ({ ...prev, program: value }));
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
  const filteredRoomOptions = roomOptions;

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

            <button type="submit" disabled={isSubmitting}>Submit</button>

            {/* Add this after the submit button or create a new section */}
            <div style={{ marginTop: '20px', textAlign: 'center' }}>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="delete-button"
                title="Delete all modalities"
                style={{
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  padding: '10px',
                  borderRadius: '50px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  display: 'inline-flex',
                  alignItems: 'center',
                }}
              >
                <FaTrash />
              </button>
            </div>
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
      {/* DELETE MODALITIES MODAL */}
      {showDeleteConfirm && (
        <div className="modal-overlay">
          <div className="modal-contents-modality" style={{ maxWidth: '800px', maxHeight: '80vh', overflow: 'auto' }}>
            <h3>Delete Your Modalities</h3>
            
            {userModalities.length === 0 ? (
              <>
                <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
                  You haven't created any modalities yet.
                </div>
                
                {/* ✅ ADD: Close button for empty state */}
                <div style={{ 
                  marginTop: '1rem', 
                  display: 'flex', 
                  justifyContent: 'center'
                }}>
                  <button
                    type="button"
                    className="close-modal"
                    onClick={() => setShowDeleteConfirm(false)}
                    style={{ 
                      backgroundColor: '#6c757d',
                      color: 'white',
                      padding: '10px 20px',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    Close
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={selectedForDelete.length === userModalities.length}
                      onChange={toggleSelectAll}
                      style={{ marginRight: '8px' }}
                    />
                    <strong>Select All ({userModalities.length})</strong>
                  </label>
                  
                  <span style={{ color: '#666', fontSize: '14px' }}>
                    {selectedForDelete.length} selected
                  </span>
                </div>

                {/* ✅ REMOVED: Duplicate cancel button that was here */}

                <div style={{ 
                  maxHeight: '400px', 
                  overflowY: 'auto', 
                  border: '1px solid #ddd', 
                  borderRadius: '4px',
                  padding: '10px'
                }}>
                  {userModalities.map((modality) => {
                    const course = courseOptions.find(c => c.course_id === modality.course_id);
                    const program = programOptions.find(p => p.program_id === modality.program_id);
                    
                    return (
                      <div
                        key={modality.modality_id}
                        style={{
                          padding: '12px',
                          marginBottom: '8px',
                          border: '1px solid #e0e0e0',
                          borderRadius: '4px',
                          backgroundColor: selectedForDelete.includes(modality.modality_id) ? '#fff3cd' : 'white',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                        onClick={() => toggleSelectModality(modality.modality_id)}
                      >
                        <label style={{ display: 'flex', alignItems: 'start', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={selectedForDelete.includes(modality.modality_id)}
                            onChange={() => toggleSelectModality(modality.modality_id)}
                            style={{ marginRight: '12px', marginTop: '4px' }}
                            onClick={(e) => e.stopPropagation()}
                          />
                          
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                              {modality.section_name || 'No Section'}
                            </div>
                            
                            <div style={{ fontSize: '14px', color: '#666' }}>
                              <div><strong>Course:</strong> {course?.course_id || 'N/A'} - {course?.course_name || 'Unknown'}</div>
                              <div><strong>Program:</strong> {program?.program_id || 'N/A'} - {program?.program_name || 'Unknown'}</div>
                              <div><strong>Modality:</strong> {modality.modality_type}</div>
                              <div><strong>Room Type:</strong> {modality.room_type}</div>
                              {modality.possible_rooms && modality.possible_rooms.length > 0 && (
                                <div>
                                  <strong>Possible Rooms:</strong> {modality.possible_rooms.join(', ')}
                                </div>
                              )}
                              {modality.modality_remarks && (
                                <div><strong>Remarks:</strong> {modality.modality_remarks}</div>
                              )}
                            </div>
                          </div>
                        </label>
                      </div>
                    );
                  })}
                </div>

                <div style={{ 
                  marginTop: '1rem', 
                  display: 'flex', 
                  gap: '10px', 
                  justifyContent: 'flex-end',
                  flexWrap: 'wrap'
                }}>
                  <button
                    type="button"
                    className="close-modal"
                    onClick={() => {
                      setShowDeleteConfirm(false);
                      setSelectedForDelete([]);
                    }}
                    disabled={isDeleting}
                    style={{ 
                      backgroundColor: '#6c757d',
                      color: 'white',
                      padding: '10px 20px',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: isDeleting ? 'not-allowed' : 'pointer',
                      opacity: isDeleting ? 0.6 : 1
                    }}
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={handleDeleteAll}
                    disabled={isDeleting || userModalities.length === 0}
                    style={{
                      backgroundColor: '#dc3545',
                      color: 'white',
                      padding: '10px 20px',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: isDeleting || userModalities.length === 0 ? 'not-allowed' : 'pointer',
                      opacity: isDeleting || userModalities.length === 0 ? 0.6 : 1
                    }}
                  >
                    {isDeleting ? 'Deleting...' : 'Delete All'}
                  </button>

                  <button
                    type="button"
                    onClick={handleDeleteSelected}
                    disabled={isDeleting || selectedForDelete.length === 0}
                    style={{
                      backgroundColor: '#ffc107',
                      color: '#000',
                      padding: '10px 20px',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: isDeleting || selectedForDelete.length === 0 ? 'not-allowed' : 'pointer',
                      opacity: isDeleting || selectedForDelete.length === 0 ? 0.6 : 1,
                      fontWeight: 'bold'
                    }}
                  >
                    {isDeleting ? (
                      <span className="spinner"></span>
                    ) : (
                      `Delete Selected (${selectedForDelete.length})`
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default BayanihanModality;