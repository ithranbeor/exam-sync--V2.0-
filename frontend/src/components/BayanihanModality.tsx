import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../lib/apiClient.ts';
import '../styles/bayanihanModality.css';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Select, { components } from 'react-select';
import { FaTrash, FaLightbulb, FaPlus } from "react-icons/fa";

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
  const [sectionOptions, setSectionOptions] = useState<{ course_id: string; program_id: string; section_name: string; number_of_students?: number }[]>([]);
  const [roomOptions, setRoomOptions] = useState<{ room_id: string; room_name: string; room_type: string; building_id?: string; room_capacity?: number }[]>([]);
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
            section_name: sc.section_name,
            number_of_students: sc.number_of_students || 0
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
            section_name: sc.section_name,
            number_of_students: sc.number_of_students || 0
          })) ?? [];
        setSectionOptions(filteredSections);
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
  const calculateRoomAssignments = useMemo(() => {
    if (form.rooms.length === 0 || form.sections.length === 0) return [];

    // Get student counts for each section and identify night classes
    const sectionStudentCounts = form.sections.map(sectionName => {
      const section = sectionOptions.find(
        s => s.course_id === form.course && s.section_name === sectionName
      );
      const isNightClass = sectionName.toLowerCase().includes('night') || 
                          sectionName.toLowerCase().includes('n-');
      
      return {
        sectionName,
        studentCount: section?.number_of_students || 0,
        isNightClass
      };
    });

    // Separate day and night sections
    const daySections = sectionStudentCounts.filter(s => !s.isNightClass);
    const nightSections = sectionStudentCounts.filter(s => s.isNightClass);

    // Get room capacities
    const roomCapacities = form.rooms.map(roomId => {
      const room = roomOptions.find(r => r.room_id === roomId);
      return {
        roomId,
        capacity: room?.room_capacity || 0
      };
    }).sort((a, b) => b.capacity - a.capacity);

    // Initialize assignments
    const assignments: { roomId: string; sections: string[]; totalStudents: number; isNightClass: boolean }[] = [];

    // Helper function to assign sections to rooms (bin packing)
    const assignSectionsToRooms = (
      sections: typeof sectionStudentCounts,
      isNightClass: boolean
    ) => {
      // Sort sections by student count descending (largest first)
      const sortedSections = [...sections].sort((a, b) => b.studentCount - a.studentCount);

      // Get available rooms (not yet assigned to opposite type)
      const availableRooms = roomCapacities.filter(room => {
        const existing = assignments.find(a => a.roomId === room.roomId);
        return !existing || existing.isNightClass === isNightClass;
      });

      sortedSections.forEach(section => {
        let assigned = false;

        // Try to find best fit room with existing sections of same type
        for (const assignment of assignments.filter(a => a.isNightClass === isNightClass)) {
          const room = roomCapacities.find(r => r.roomId === assignment.roomId);
          if (!room) continue;

          const remainingCapacity = room.capacity - assignment.totalStudents;

          if (remainingCapacity >= section.studentCount) {
            assignment.sections.push(section.sectionName);
            assignment.totalStudents += section.studentCount;
            assigned = true;
            break;
          }
        }

        // If not assigned, create new assignment in an available room
        if (!assigned) {
          const availableRoom = availableRooms.find(room => {
            return !assignments.some(a => a.roomId === room.roomId);
          });

          if (availableRoom && availableRoom.capacity >= section.studentCount) {
            assignments.push({
              roomId: availableRoom.roomId,
              sections: [section.sectionName],
              totalStudents: section.studentCount,
              isNightClass
            });
            assigned = true;
          }
        }

        // Last resort: force into room with most space (even if over capacity)
        if (!assigned && availableRooms.length > 0) {
          let targetAssignment = assignments.find(a => a.isNightClass === isNightClass);
          
          if (!targetAssignment) {
            // Create new assignment
            const roomToUse = availableRooms[0];
            targetAssignment = {
              roomId: roomToUse.roomId,
              sections: [],
              totalStudents: 0,
              isNightClass
            };
            assignments.push(targetAssignment);
          }

          targetAssignment.sections.push(section.sectionName);
          targetAssignment.totalStudents += section.studentCount;
        }
      });
    };

    // Assign day sections first
    if (daySections.length > 0) {
      assignSectionsToRooms(daySections, false);
    }
    
    // Then assign night sections
    if (nightSections.length > 0) {
      assignSectionsToRooms(nightSections, true);
    }

    // Filter out empty assignments and return
    return assignments.filter(a => a.sections.length > 0);
  }, [form.rooms, form.sections, form.course, sectionOptions, roomOptions]);

  /** HANDLE FORM SUBMIT */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!user?.user_id) return;

    if (!form.sections.length) {
      toast.warn('Please select at least one section.');
      return;
    }

    if (form.rooms.length === 0) {
      toast.error('Please select at least one room.');
      return;
    }

    // ✅ Validate room capacity
    const dayStudents = form.sections.reduce((sum, sectionName) => {
      const section = sectionOptions.find(
        s => s.course_id === form.course && s.section_name === sectionName
      );
      const isNight = sectionName.toLowerCase().includes('night') || 
                      sectionName.toLowerCase().includes('n-');
      return sum + (isNight ? 0 : (section?.number_of_students || 0));
    }, 0);

    const nightStudents = form.sections.reduce((sum, sectionName) => {
      const section = sectionOptions.find(
        s => s.course_id === form.course && s.section_name === sectionName
      );
      const isNight = sectionName.toLowerCase().includes('night') || 
                      sectionName.toLowerCase().includes('n-');
      return sum + (isNight ? (section?.number_of_students || 0) : 0);
    }, 0);

    const totalStudents = dayStudents + nightStudents;

    const totalRoomCapacity = form.rooms.reduce((sum, roomId) => {
      const room = roomOptions.find(r => r.room_id === roomId);
      return sum + (room?.room_capacity || 0);
    }, 0);

    // Night and day sections need separate room capacity
    const hasNightSections = nightStudents > 0;
    const hasDaySections = dayStudents > 0;

    if (hasNightSections && hasDaySections) {
      // Need capacity for both (they can't share rooms at the same time)
      const minRequiredCapacity = Math.max(dayStudents, nightStudents);
      if (totalRoomCapacity < minRequiredCapacity) {
        toast.error(`Insufficient room capacity. Day sections need ${dayStudents} seats, night sections need ${nightStudents} seats. You need at least ${minRequiredCapacity} total capacity.`);
        return;
      }
    } else if (totalStudents > totalRoomCapacity) {
      toast.error(`Total students (${totalStudents}) exceed total room capacity (${totalRoomCapacity}). Please select more or larger rooms.`);
      return;
    }

    // Check if any room assignment exceeds capacity
    const hasOverCapacity = calculateRoomAssignments.some(assignment => {
      const room = roomOptions.find(r => r.room_id === assignment.roomId);
      return assignment.totalStudents > (room?.room_capacity || 0);
    });

    if (hasOverCapacity) {
      toast.error('One or more room assignments exceed capacity. Please review the assignment preview.');
      return;
    }

    setIsSubmitting(true);

    // ✅ NEW: Create one modality per room assignment
    const submissions = calculateRoomAssignments.map(async (assignment) => {
      try {
        // Check for existing record
        const { data: existing } = await api.get('/tbl_modality/', {
          params: {
            course_id: form.course,
            program_id: form.program,
            sections: assignment.sections.join(','),
            modality_type: form.modality,
            room_type: form.roomType
          }
        });

        if (existing && existing.length > 0) {
          return { status: 'skipped', sections: assignment.sections };
        }

        // Insert new record with multiple sections
        await api.post('/tbl_modality/', {
          modality_type: form.modality,
          room_type: form.roomType,
          modality_remarks: form.remarks,
          course_id: form.course,
          program_id: form.program,
          sections: assignment.sections,
          total_students: assignment.totalStudents,
          possible_rooms: [assignment.roomId],
          user_id: user.user_id,
          created_at: new Date().toISOString(),
        });

        return { status: 'success', sections: assignment.sections };
      } catch (error) {
        return { status: 'error', sections: assignment.sections, error };
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

    if (successCount > 0) toast.success(`Successfully saved ${successCount} modality group(s)`);
    if (skippedCount > 0) toast.info(`Skipped ${skippedCount} group(s) (already submitted)`);
    if (errorCount > 0) toast.error(`Failed to save ${errorCount} group(s)`);

    setIsSubmitting(false);

    // Reset form
    setForm({
      modality: '',
      rooms: [],
      roomType: '',
      program: '',
      sections: [],
      course: '',
      remarks: '',
    });

    // Refresh modalities list
    await fetchUserModalities();
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
                        setForm(prev => ({ ...prev, sections: [], rooms: [] }));
                        return;
                      }

                      const allSections = filteredSectionOptions.map(s => s.value);
                      const isSelectAll = selected.some(s => s.value === 'select_all');

                      if (isSelectAll) {
                        setForm(prev => ({ ...prev, sections: allSections, rooms: [] }));
                        toast.info('All sections selected. Now select rooms with sufficient capacity.');
                        return;
                      }

                      const selectedValues = selected.map(s => s.value);

                      // Clear rooms when sections change
                      setForm(prev => ({ ...prev, sections: selectedValues, rooms: [] }));
                    }}
                    placeholder="Select sections..."
                  />
                ) : (
                  <p style={{ color: "#888" }}>Select a course first</p>
                )}

                {form.course && (
                  <small style={{ marginTop: "4px", display: "block", color: "#666" }}>
                    <FaLightbulb style={{ color: 'gold' }} /> Select sections first, then choose rooms with sufficient capacity
                  </small>
                )}
              </div>

              <div className="form-group">
                <label>Building-Room</label>
                <button
                  type="button"
                  className="open-modal-btn"
                  disabled={!form.roomType || form.roomType === "No Room" || availableRoomIds.length === 0 || loadingRooms || form.sections.length === 0}
                  onClick={() => setShowRoomModal(true)}
                >
                  {loadingRooms ? 'Loading...' : 'Select Room'}
                </button>

                {form.sections.length === 0 && (
                  <small style={{ marginTop: "4px", display: "block", color: "#666" }}>
                    Please select sections first
                  </small>
                )}

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
            {calculateRoomAssignments.length > 0 && (
              <div style={{
                marginTop: '20px',
                padding: '15px',
                backgroundColor: '#e3f2fd',
                borderRadius: '8px',
                border: '2px solid #0a2841ff'
              }}>
                <h4 style={{ marginBottom: '10px', color: '#092C4C' }}>
                  Room Assignment Preview
                </h4>
                <div style={{
                  maxHeight: '240px', // Roughly 3 items (each ~80px)
                  overflowY: 'auto',
                  paddingRight: '5px'
                }}>
                  {calculateRoomAssignments.map((assignment, idx) => {
                    const room = roomOptions.find(r => r.room_id === assignment.roomId);
                    const isOverCapacity = assignment.totalStudents > (room?.room_capacity || 0);

                    return (
                      <div key={idx} style={{
                        marginBottom: '10px',
                        padding: '10px',
                        backgroundColor: isOverCapacity ? '#fff3cd' : 'white',
                        borderRadius: '4px',
                        border: isOverCapacity ? '2px solid #ffc107' : '1px solid #ddd',
                        color: '#333'
                      }}>
                        <strong>Room {assignment.roomId}</strong> (Capacity: {room?.room_capacity || 'N/A'})
                        {assignment.isNightClass && (
                          <span style={{
                            marginLeft: '8px',
                            padding: '2px 8px',
                            backgroundColor: '#1a237e',
                            color: 'white',
                            borderRadius: '12px',
                            fontSize: '12px',
                            fontWeight: 'bold'
                          }}>
                            NIGHT CLASS
                          </span>
                        )}
                        <br />
                        <span style={{ fontSize: '14px' }}>
                          Sections: {assignment.sections.join(', ')}
                        </span>
                        <br />
                        <span style={{
                          fontSize: '14px',
                          color: isOverCapacity ? '#d32f2f' : '#4caf50',
                          fontWeight: 'bold'
                        }}>
                          Total Students: {assignment.totalStudents}
                          {isOverCapacity && ' ⚠️ OVER CAPACITY'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            <div style={{ textAlign: "center", marginTop: "10px" }}>
              <button type="submit" disabled={isSubmitting || calculateRoomAssignments.length === 0} style={{ backgroundColor: '#144f1fff', color: 'white', padding: '10px', border: 'none', borderRadius: '50px', cursor: isSubmitting || calculateRoomAssignments.length === 0 ? 'not-allowed' : 'pointer' }}>
                <FaPlus style={{ color: 'white', fontSize: '20px' }} />
              </button>
            </div>

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
            <div className="modal-actions">
              <button type="button" className="close-modal" onClick={() => setShowRoomModal(false)}>
                Done
              </button>
            </div>
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
            <h3>Modalities</h3>

            {userModalities.length === 0 ? (
              <>
                <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
                  You haven't created any modalities yet.
                </div>

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
                              <div>
                                <strong>Section/s:</strong> {Array.isArray(modality.sections)
                                  ? modality.sections.join(", ")
                                  : modality.sections}
                              </div>
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