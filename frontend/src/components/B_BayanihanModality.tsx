import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../lib/apiClient.ts';
import '../styles/B_BayanihanModality.css';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Select from 'react-select';
import { FaPlus, FaPenAlt } from 'react-icons/fa';

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
  'Hands-on (Laboratory)': 'Laboratory',
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

  const [showRoomModal, setShowRoomModal] = useState(false);
  const [selectedBuilding, setSelectedBuilding] = useState<string | null>(null);
  const [buildingOptions, setBuildingOptions] = useState<{ id: string; name: string }[]>([]);
  const [occupancyModal, setOccupancyModal] = useState<{ visible: boolean; roomId: string | null }>({
    visible: false,
    roomId: null,
  });

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showFinalDeleteConfirm, setShowFinalDeleteConfirm] = useState(false);
  const [deleteMode, setDeleteMode] = useState<'selected' | 'all'>('selected');
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
    } catch (error) {
      toast.error('Failed to load your modalities');
    }
  }, [user]);

  useEffect(() => {
    fetchUserModalities();
  }, [fetchUserModalities]);


  // Add delete handlers
  const handleDeleteSelected = () => {
    if (selectedForDelete.length === 0) {
      toast.warn('Please select modalities to delete');
      return;
    }
    // Show confirmation dialog
    setDeleteMode('selected');
    setShowFinalDeleteConfirm(true);
  };

  const confirmDeleteSelected = async () => {
    if (selectedForDelete.length === 0) {
      return;
    }

    setIsDeleting(true);
    setShowFinalDeleteConfirm(false);

    try {
      await Promise.all(
        selectedForDelete.map(modalityId =>
          api.delete(`/tbl_modality/${modalityId}/`)
        )
      );

      toast.success(`Successfully deleted ${selectedForDelete.length} modality/modalities`);
      setSelectedForDelete([]);
      setShowDeleteConfirm(false);

      await fetchUserModalities();
    } catch (error) {
      console.error('Error deleting modalities:', error);
      toast.error('Failed to delete some modalities');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleFinalConfirm = async () => {
    if (deleteMode === 'selected') {
      await confirmDeleteSelected();
    } else {
      await confirmDeleteAll();
    }
  };

  const handleDeleteAll = () => {
    if (userModalities.length === 0) {
      toast.warn('No modalities to delete');
      return;
    }
    // Show confirmation dialog
    setDeleteMode('all');
    setShowFinalDeleteConfirm(true);
  };

  const confirmDeleteAll = async () => {
    if (userModalities.length === 0) {
      return;
    }

    setIsDeleting(true);
    setShowFinalDeleteConfirm(false);

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

  const [roomStatus, setRoomStatus] = useState<{
    [key: string]: { occupiedTimes: { start: string; end: string }[] }
  }>({});

  const fetchRoomOccupancy = useCallback(async (roomId: string) => {
    if (roomStatus[roomId]) return;

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

  const filteredCourseOptions = useMemo(() => {
    if (!form.program) return [];

    const filtered = courseOptions.filter(c =>
      sectionOptions.some(s => s.program_id === form.program && s.course_id === c.course_id)
    );

    filtered.sort((a, b) =>
      a.course_id.localeCompare(b.course_id, undefined, {
        numeric: true,
        sensitivity: 'base'
      })
    );

    return filtered;
  }, [courseOptions, sectionOptions, form.program]);

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

        const isAdmin = roles.some((r: any) => r.role === 2 || r.role_id === 2);

        if (isAdmin) {
          setProgramOptions(allPrograms);
          setCourseOptions(allCourses);

          const allSections = sectionCourses.map((sc: any) => ({
            course_id: String(sc.course_id ?? sc.course?.course_id ?? ''),
            program_id: String(sc.program_id ?? sc.program?.program_id ?? ''),
            section_name: String(sc.section_name ?? ''),
            number_of_students: Number(sc.number_of_students ?? 0)
          }));
          setSectionOptions(allSections);

          const { data: allRooms } = await api.get('/tbl_rooms');
          setRoomOptions(allRooms);
          setAvailableRoomIds(allRooms.map((r: any) => r.room_id));

          setBuildingOptions(
            buildings?.map((b: any) => ({
              id: b.building_id,
              name: b.building_name
            })) ?? []
          );

          setLoadingRooms(false);
          return;
        }

        const leaderRoles = roles.filter((r: any) =>
          r.role === 4 || r.role_id === 4
        );

        if (!leaderRoles || leaderRoles.length === 0) {
          toast.warn('You are not assigned as a Bayanihan Leader.');
          setLoadingRooms(false);
          return;
        }

        const { data: userCourses } = await api.get('/tbl_course_users/', {
          params: {
            user_id: user.user_id,
            is_bayanihan_leader: 'true' 
          }
        });

        const courseIds = userCourses
          .filter((c: any) => c.is_bayanihan_leader === true)
          .map((c: any) => c.course?.course_id || c.course_id)
          .filter((id: any) => id !== null && id !== undefined);

        if (courseIds.length === 0) {
          toast.warn('No courses assigned to you as Bayanihan Leader.');
          setLoadingRooms(false);
          return;
        }

        const coursesWithNames = allCourses.filter((c: any) =>
          courseIds.includes(c.course_id)
        );
        setCourseOptions(coursesWithNames);

        // Filter sections
        const sectionsData = Array.isArray(sectionCourses) ? sectionCourses : [];

        const normalizedSections = sectionsData.map((sc: any) => {
          const courseId = sc.course_id ?? sc.course?.course_id;
          const programId = sc.program_id ?? sc.program?.program_id;

          return {
            course_id: String(courseId ?? ''),
            program_id: String(programId ?? ''),
            section_name: String(sc.section_name ?? ''),
            number_of_students: Number(sc.number_of_students ?? 0),
          };
        });

        const filteredSections = normalizedSections.filter((sec: any) =>
          courseIds.map(String).includes(String(sec.course_id))
        );

        setSectionOptions(filteredSections);

        const programIdsFromSections = Array.from(
          new Set(filteredSections.map((s: any) => s.program_id))
        );

        // Handle departments and colleges for room fetching
        const leaderDepartmentIds = leaderRoles
          .map((r: any) => r.department_id || r.department)
          .filter(Boolean);

        if (leaderDepartmentIds.length === 0) {
          toast.warn('No department assigned to your Bayanihan Leader role.');
          setLoadingRooms(false);
          return;
        }

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

        const collegeIdStrings = collegeIds
          .map((c: any) => String(c.college_id || c))
          .filter(Boolean);

        const deptNames = departments.map((d: any) => d.department_name).filter(Boolean);

        // Filter programs
        const programs = allPrograms.filter((p: any) => {
          if (!programIdsFromSections.includes(p.program_id)) {
            return false;
          }

          const progDeptName = String(p.department || p.department_name || '');
          const progDeptId = String(p.department_id || '');
          const progCollege = String(p.college_id || p.college || '');

          const deptMatch =
            leaderDepartmentIds.includes(progDeptId) ||
            deptNames.some((name: string) => progDeptName.includes(name));

          const collegeMatch = collegeIdStrings.includes(progCollege);

          return deptMatch || collegeMatch;
        });

        setProgramOptions(programs);

        // Fetch available rooms
        const availableRoomsPromises = collegeIdStrings.map((collegeId: string) =>
          api.get('/tbl_available_rooms/', { params: { college_id: collegeId } })
        );

        const availableRoomsResponses = await Promise.all(availableRoomsPromises);
        const allAvailableRooms = availableRoomsResponses.flatMap(response => response.data);

        const availableIds = allAvailableRooms
          .map((ar: any) => ar.room?.room_id || ar.room_id || ar.room)
          .filter((id: string) => id);

        setAvailableRoomIds(availableIds.map(String));

        if (availableIds.length > 0) {
          const { data: allRooms } = await api.get('/tbl_rooms');
          const filteredRooms = allRooms.filter((r: any) =>
            availableIds.includes(r.room_id)
          );
          setRoomOptions(filteredRooms);
        } else {
          setRoomOptions([]);
        }

        setBuildingOptions(
          buildings?.map((b: any) => ({
            id: b.building_id,
            name: b.building_name
          })) ?? []
        );

      } catch (error: any) {
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

    const daySections = sectionStudentCounts.filter(s => !s.isNightClass);
    const nightSections = sectionStudentCounts.filter(s => s.isNightClass);

    const roomCapacities = form.rooms.map(roomId => {
      const room = roomOptions.find(r => r.room_id === roomId);
      return {
        roomId,
        capacity: room?.room_capacity || 0
      };
    }).sort((a, b) => b.capacity - a.capacity);

    const assignments: { roomId: string; sections: string[]; totalStudents: number; isNightClass: boolean }[] = [];

    const assignedSections = new Set<string>();

    const assignSectionsToRooms = (
      sections: typeof sectionStudentCounts,
      isNightClass: boolean
    ) => {
      const sortedSections = [...sections].sort((a, b) => b.studentCount - a.studentCount);

      const availableRooms = roomCapacities.filter(room => {
        const existing = assignments.find(a => a.roomId === room.roomId);
        return !existing || existing.isNightClass === isNightClass;
      });

      sortedSections.forEach(section => {
        let assigned = false;

        for (const assignment of assignments.filter(a => a.isNightClass === isNightClass)) {
          const room = roomCapacities.find(r => r.roomId === assignment.roomId);
          if (!room) continue;

          const remainingCapacity = room.capacity - assignment.totalStudents;

          if (remainingCapacity >= section.studentCount) {
            assignment.sections.push(section.sectionName);
            assignment.totalStudents += section.studentCount;
            assignedSections.add(section.sectionName); 
            assigned = true;
            break;
          }
        }

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
            assignedSections.add(section.sectionName); 
            assigned = true;
          }
        }

        if (!assigned && availableRooms.length > 0) {
          let targetAssignment = assignments.find(a => a.isNightClass === isNightClass);

          if (!targetAssignment) {
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
          assignedSections.add(section.sectionName);
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

    const unassignedSections = form.sections.filter(s => !assignedSections.has(s));

    if (unassignedSections.length > 0) {
      const unassignedDaySections = unassignedSections.filter(s =>
        !s.toLowerCase().includes('night') && !s.toLowerCase().includes('n-')
      );

      const unassignedNightSections = unassignedSections.filter(s =>
        s.toLowerCase().includes('night') || s.toLowerCase().includes('n-')
      );

      // Add unassigned day sections
      if (unassignedDaySections.length > 0) {
        assignments.push({
          roomId: '⚠️ NOT ASSIGNED',
          sections: unassignedDaySections,
          totalStudents: unassignedDaySections.reduce((sum, sectionName) => {
            const section = sectionOptions.find(
              s => s.course_id === form.course && s.section_name === sectionName
            );
            return sum + (section?.number_of_students || 0);
          }, 0),
          isNightClass: false
        });
      }

      // Add unassigned night sections
      if (unassignedNightSections.length > 0) {
        assignments.push({
          roomId: '⚠️ NOT ASSIGNED',
          sections: unassignedNightSections,
          totalStudents: unassignedNightSections.reduce((sum, sectionName) => {
            const section = sectionOptions.find(
              s => s.course_id === form.course && s.section_name === sectionName
            );
            return sum + (section?.number_of_students || 0);
          }, 0),
          isNightClass: true
        });
      }
    }

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
      const minRequiredCapacity = Math.max(dayStudents, nightStudents);
      if (totalRoomCapacity < minRequiredCapacity) {
        toast.error(`Insufficient room capacity. Day sections need ${dayStudents} seats, night sections need ${nightStudents} seats. You need at least ${minRequiredCapacity} total capacity.`);
        return;
      }
    } else if (totalStudents > totalRoomCapacity) {
      toast.error(`Total students (${totalStudents}) exceed total room capacity (${totalRoomCapacity}). Please select more or larger rooms.`);
      return;
    }

    const hasUnassigned = calculateRoomAssignments.some(
      a => !a.roomId || a.roomId.includes("NOT ASSIGNED")
    );

    if (hasUnassigned) {
      const unassignedSections = calculateRoomAssignments
        .filter(a => a.roomId === '⚠️ NOT ASSIGNED')
        .flatMap(a => a.sections)
        .join(', ');

      toast.error(`Cannot submit: These sections are not assigned to any room: ${unassignedSections}. Please select more rooms.`);
      setIsSubmitting(false);
      return;
    }

    const hasOverCapacity = calculateRoomAssignments.some(assignment => {
      if (assignment.roomId === '⚠️ NOT ASSIGNED') return false; 
      const room = roomOptions.find(r => r.room_id === assignment.roomId);
      return assignment.totalStudents > (room?.room_capacity || 0);
    });

    if (hasOverCapacity) {
      toast.error('One or more room assignments exceed capacity. Please review the assignment preview.');
      return;
    }

    setIsSubmitting(true);

    // Create one modality per room assignment
    const submissions = calculateRoomAssignments.map(async (assignment) => {
      try {
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

    setForm({
      modality: '',
      rooms: [],
      roomType: '',
      program: '',
      sections: [],
      course: '',
      remarks: '',
    });

    await fetchUserModalities();
  };

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

  const filteredRoomOptions = roomOptions;

  const filteredAndSortedRooms = useMemo(() => {
    return filteredRoomOptions
      .filter(r => !selectedBuilding || r.building_id === selectedBuilding)
      .sort((a, b) => {
        if (a.room_type === form.roomType && b.room_type !== form.roomType) return -1;
        if (a.room_type !== form.roomType && b.room_type === form.roomType) return 1;

        return a.room_id.localeCompare(b.room_id, undefined, { numeric: true });
      });
  }, [filteredRoomOptions, selectedBuilding, form.roomType]);

  const selectStyles = {
    control: (base: any) => ({ ...base, fontSize: '13px', minHeight: '36px', borderColor: '#DDE3EC', borderRadius: '6px' }),
    placeholder: (base: any) => ({ ...base, color: '#8A9BB0' }),
    menuPortal: (base: any) => ({ ...base, zIndex: 99999, fontSize: '13px', color: '#4b5e72' }),
  };

  // Inline occupancy display (replaces internal RoomTimeslots)
  const RoomTimeslotsInline: React.FC<{ roomId: string }> = ({ roomId }) => {
    useEffect(() => {
      fetchRoomOccupancy(roomId);
    }, [roomId]);

    const slots = getRoomTimeslots(roomId);

    if (!roomStatus[roomId]) {
      return <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--bm-text-muted)', fontSize: '13px' }}>Loading occupancy…</div>;
    }

    return (
      <>
        {slots.map((slot, i) => (
          <div key={i} className={`bm-timeslot ${slot.occupied ? 'occupied' : 'vacant'}`}>
            <span>{slot.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – {slot.end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            <span className="status">{slot.occupied ? 'Occupied' : 'Available'}</span>
          </div>
        ))}
      </>
    );
  };

  return (
    <div className="bm-page">

      {/* ── Page Header ── */}
      <div className="bm-page-header">
        <div className="bm-page-header-left">
          <div className="bm-page-icon">
            <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <div className="bm-page-title">
            <h1>Modality Submission</h1>
            <p>Fill in all fields before submitting</p>
          </div>
        </div>

        <div className="bm-page-actions">
          <button
            type="button"
            className="bm-btn danger"
            onClick={() => setShowDeleteConfirm(true)}
          >
            <FaPenAlt style={{ fontSize: '12px' }} />
            Manage Modalities
          </button>
          <button
            type="button"
            className="bm-btn primary"
            onClick={handleSubmit as any}
            disabled={isSubmitting || calculateRoomAssignments.length === 0}
          >
            <FaPlus style={{ fontSize: '12px' }} />
            {isSubmitting ? 'Submitting…' : 'Submit Modality'}
          </button>
        </div>
      </div>

      {/* ── Main Layout ── */}
      <div className="bm-layout">

        {/* ── Sidebar ── */}
        <aside className="bm-sidebar">

          {/* Room Assignment Preview */}
          {calculateRoomAssignments.length > 0 && (
            <div className="bm-sidebar-card">
              <div className="bm-sidebar-card-header"><h4>Assignment Preview</h4></div>
              <div className="bm-sidebar-card-body" style={{ padding: '10px 12px', gap: '6px' }}>
                {calculateRoomAssignments.map((assignment, idx) => {
                  const isUnassigned = assignment.roomId === '⚠️ NOT ASSIGNED';
                  const room = roomOptions.find(r => r.room_id === assignment.roomId);
                  const isOverCapacity = !isUnassigned && assignment.totalStudents > (room?.room_capacity || 0);
                  return (
                    <div
                      key={idx}
                      className={`bm-assignment-row ${isUnassigned ? 'unassigned' : isOverCapacity ? 'overcapacity' : 'ok'}`}
                    >
                      <div className="bm-assignment-room">
                        {isUnassigned ? '⚠️ Not Assigned' : `Room ${assignment.roomId}`}
                        {assignment.isNightClass && <span className="bm-night-badge">Night</span>}
                      </div>
                      <div className="bm-assignment-meta">
                        {!isUnassigned && `${assignment.totalStudents}/${room?.room_capacity ?? 'N/A'} students`}
                      </div>
                      <div className="bm-assignment-sections">
                        {assignment.sections.join(', ')}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Info card */}
          <div className="bm-sidebar-card">
            <div className="bm-sidebar-card-header"><h4>Status</h4></div>
            <div className="bm-sidebar-card-body">
              <div className="bm-stats-grid">
                <div className="bm-stat-box">
                  <div className="bm-stat-num">{form.sections.length}</div>
                  <div className="bm-stat-label">Sections</div>
                </div>
                <div className="bm-stat-box">
                  <div className="bm-stat-num">{form.rooms.length}</div>
                  <div className="bm-stat-label">Rooms</div>
                </div>
                <div className="bm-stat-box">
                  <div className="bm-stat-num">{userModalities.length}</div>
                  <div className="bm-stat-label">Submitted</div>
                </div>
                <div className="bm-stat-box">
                  <div className="bm-stat-num">{calculateRoomAssignments.length}</div>
                  <div className="bm-stat-label">Groups</div>
                </div>
              </div>

              {loadingRooms && (
                <div className="bm-info-banner info">Loading available rooms…</div>
              )}
              {!loadingRooms && availableRoomIds.length === 0 && (
                <div className="bm-info-banner warn">
                  No rooms available. Contact the administrator to set up rooms.
                </div>
              )}
            </div>
          </div>

        </aside>

        {/* ── Form Content ── */}
        <div className="bm-content">
          <div className="bm-form-card">
            <div className="bm-form-card-header">
              <h3>Modality Details</h3>
            </div>
            <div className="bm-form-card-body">
              <form className="bm-form-grid" onSubmit={handleSubmit}>

                {/* Modality Type */}
                <div className="bm-field">
                  <label>Modality Type</label>
                  <Select
                    options={[
                      { value: 'Hands-on (Laboratory)', label: 'Hands-on (Laboratory)' },
                      { value: 'Written (Lecture)', label: 'Written (Lecture)' },
                      { value: 'Written (Laboratory)', label: 'Written (Laboratory)' },
                    ]}
                    value={form.modality ? { value: form.modality, label: form.modality } : null}
                    onChange={selected => setForm(prev => ({
                      ...prev,
                      modality: selected?.value || '',
                      course: '',
                      sections: [],
                      rooms: []
                    }))}
                    placeholder="Select modality…"
                    isClearable
                    menuPortalTarget={document.body}
                    styles={selectStyles}
                  />
                </div>

                {/* Program */}
                <div className="bm-field">
                  <label>Program</label>
                  <Select
                    options={programOptions
                      .slice()
                      .sort((a, b) => a.program_id.localeCompare(b.program_id, undefined, { numeric: true }))
                      .map(p => ({ value: p.program_id, label: `${p.program_id} - ${p.program_name}` }))}
                    value={programOptions
                      .filter(p => p.program_id === form.program)
                      .map(p => ({ value: p.program_id, label: `${p.program_id} - ${p.program_name}` }))}
                    onChange={selected => setForm(prev => ({ ...prev, program: selected?.value || '', course: '', sections: [] }))}
                    placeholder="Select program…"
                    isClearable
                    menuPortalTarget={document.body}
                    styles={selectStyles}
                  />
                </div>

                {/* Course */}
                <div className="bm-field">
                  <label>Course</label>
                  <Select
                    isDisabled={!form.program}
                    options={filteredCourseOptions.map(c => {
                      const hasModalityForType = userModalities.some(m =>
                        m.course_id === c.course_id && m.modality_type === form.modality
                      );
                      return {
                        value: c.course_id,
                        label: `${c.course_id} (${c.course_name})`,
                        isDisabled: hasModalityForType && form.modality !== ''
                      };
                    })}
                    value={form.course ? {
                      value: form.course,
                      label: `${filteredCourseOptions.find(c => c.course_id === form.course)?.course_id} (${filteredCourseOptions.find(c => c.course_id === form.course)?.course_name})`
                    } : null}
                    onChange={selected => {
                      const courseId = selected?.value || '';
                      const availableSections = sectionOptions
                        .filter(s => s.course_id === courseId)
                        .filter(s => {
                          const hasModalityForThisCourse = userModalities.some(m =>
                            m.course_id === courseId &&
                            (
                              (Array.isArray(m.sections) && m.sections.includes(s.section_name)) ||
                              (typeof m.sections === 'string' && m.sections.split(',').map((sec: string) => sec.trim()).includes(s.section_name))
                            )
                          );
                          return !hasModalityForThisCourse;
                        })
                        .map(s => s.section_name)
                        .sort((a, b) => a.localeCompare(b));
                      setForm(prev => ({ ...prev, course: courseId, sections: availableSections, rooms: [] }));
                    }}
                    placeholder="Select course…"
                    isClearable
                    styles={{
                      ...selectStyles,
                      option: (base, state) => ({
                        ...base,
                        backgroundColor: state.isDisabled ? '#F5F7FA' : state.isFocused ? '#EBF4FF' : 'white',
                        color: state.isDisabled ? '#8A9BB0' : '#0C1B2A',
                        cursor: state.isDisabled ? 'not-allowed' : 'pointer',
                      })
                    }}
                  />
                  {form.modality && (
                    <small className="bm-hint">Grayed out courses already have a {form.modality} modality submitted</small>
                  )}
                </div>

                {/* Remarks */}
                <div className="bm-field">
                  <label>Remarks</label>
                  <textarea
                    name="remarks"
                    value={form.remarks}
                    onChange={handleChange}
                    placeholder="Enter any notes or remarks…"
                    className="bm-textarea"
                  />
                </div>

                {/* Sections — full width */}
                <div className="bm-field bm-full-width">
                  <label>Sections</label>
                  {form.course ? (
                    <Select
                      isMulti
                      closeMenuOnSelect={false}
                      hideSelectedOptions={false}
                      options={filteredSectionOptions
                        .map(s => {
                          const hasModality = userModalities.some(m =>
                            m.course_id === form.course &&
                            (
                              (Array.isArray(m.sections) && m.sections.includes(s.value)) ||
                              (typeof m.sections === 'string' && m.sections.split(',').map((sec: string) => sec.trim()).includes(s.value))
                            )
                          );
                          return { value: s.value, label: s.label, isDisabled: hasModality };
                        })
                        .sort((a, b) => a.label.localeCompare(b.label))}
                      value={form.sections.sort((a, b) => a.localeCompare(b)).map(sec => ({ value: sec, label: sec }))}
                      onChange={selectedOptions => {
                        setForm(prev => ({
                          ...prev,
                          sections: selectedOptions ? selectedOptions.map(opt => opt.value) : [],
                          rooms: []
                        }));
                      }}
                      styles={{
                        ...selectStyles,
                        multiValue: (base) => ({ ...base, backgroundColor: '#0d4993', borderRadius: '6px' }),
                        multiValueLabel: (base) => ({ ...base, color: '#ffffff', fontWeight: 600, fontSize: '11px' }),
                        valueContainer: (base) => ({ ...base, maxHeight: '100px', overflowY: 'auto' }),
                        option: (base, state) => ({
                          ...base,
                          backgroundColor: state.isDisabled ? '#F5F7FA' : state.isFocused ? '#c8c8c9' : 'white',
                          color: state.isDisabled ? '#8A9BB0' : '#0d4993',
                          cursor: state.isDisabled ? 'not-allowed' : 'pointer',
                        })
                      }}
                    />
                  ) : (
                    <div className="bm-placeholder-text">Select a course first</div>
                  )}
                  {form.course && form.sections.length > 0 && (
                    <small className="bm-hint">{form.sections.length} section(s) selected</small>
                  )}
                </div>

                {/* Room Location — full width */}
                <div className="bm-field bm-full-width">
                  <label>Room Location</label>
                  <div className="bm-room-selector-row">
                    <button
                      type="button"
                      className="bm-btn primary"
                      disabled={!form.roomType || form.roomType === 'No Room' || availableRoomIds.length === 0 || loadingRooms || form.sections.length === 0}
                      onClick={() => setShowRoomModal(true)}
                      style={{ width: 'fit-content' }}
                    >
                      {loadingRooms ? 'Loading…' : 'Select Rooms'}
                    </button>
                    {form.sections.length === 0 && (
                      <small className="bm-hint">Please select sections first</small>
                    )}
                  </div>
                  {form.rooms.length > 0 && (
                    <div className="bm-selected-rooms">
                      {form.rooms
                        .slice()
                        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
                        .map(roomId => (
                          <span key={roomId} className="bm-chip">
                            {roomId}
                            <button
                              type="button"
                              className="bm-chip-remove"
                              onClick={() => setForm(prev => ({ ...prev, rooms: prev.rooms.filter(r => r !== roomId) }))}
                            >✕</button>
                          </span>
                        ))}
                    </div>
                  )}
                </div>

              </form>
            </div>
          </div>
        </div>
      </div>

      {/* ════ ROOM MODAL ════ */}
      {showRoomModal && (
        <div className="bm-modal-overlay" onClick={() => setShowRoomModal(false)}>
          <div className="bm-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '680px' }}>
            <div className="bm-modal-header">
              <h3>Select Rooms</h3>
              <p>Showing {form.roomType} rooms · {form.rooms.length} selected</p>
            </div>
            <div className="bm-modal-body">
              <div style={{ marginBottom: '12px' }}>
                <Select
                  options={buildingOptions.map(b => ({ value: b.id, label: `${b.name} (${b.id})` }))}
                  value={selectedBuilding ? { value: selectedBuilding, label: `${buildingOptions.find(b => b.id === selectedBuilding)?.name} (${selectedBuilding})` } : null}
                  onChange={selected => setSelectedBuilding(selected?.value || null)}
                  placeholder="Filter by building…"
                  isClearable
                  styles={selectStyles}
                />
              </div>

              {calculateRoomAssignments.length > 0 && (
                <div className="bm-modal-preview">
                  <div className="bm-modal-preview-title">Assignment Preview</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '120px', overflowY: 'auto' }}>
                    {calculateRoomAssignments.map((assignment, idx) => {
                      const isUnassigned = assignment.roomId === '⚠️ NOT ASSIGNED';
                      const room = roomOptions.find(r => r.room_id === assignment.roomId);
                      const isOverCapacity = !isUnassigned && assignment.totalStudents > (room?.room_capacity || 0);
                      return (
                        <div key={idx} className={`bm-assignment-row ${isUnassigned ? 'unassigned' : isOverCapacity ? 'overcapacity' : 'ok'}`}>
                          <div className="bm-assignment-room">
                            {isUnassigned ? '⚠️ Not Assigned' : `Room ${assignment.roomId}`}
                            {!isUnassigned && ` (${assignment.totalStudents}/${room?.room_capacity ?? 'N/A'})`}
                            {assignment.isNightClass && <span className="bm-night-badge">Night</span>}
                          </div>
                          <div className="bm-assignment-sections">{assignment.sections.join(', ')}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="bm-room-grid">
                {filteredAndSortedRooms.map(r => {
                  const isDisabled = r.room_type !== form.roomType;
                  const isSelected = form.rooms.includes(r.room_id);
                  return (
                    <div
                      key={r.room_id}
                      className={`bm-room-box${isSelected ? ' selected' : ''}${isDisabled ? ' disabled' : ''}`}
                      onClick={() => {
                        if (isDisabled) return;
                        setForm(prev => ({
                          ...prev,
                          rooms: isSelected ? prev.rooms.filter(id => id !== r.room_id) : [...prev.rooms, r.room_id]
                        }));
                      }}
                    >
                      <div className="bm-room-check">{isSelected ? '✓' : ''}</div>
                      <div className="bm-room-id">{r.room_id}</div>
                      <span className="bm-room-type-label">{r.room_type === 'Laboratory' ? 'Lab' : r.room_type}</span>
                      <span className="bm-room-type-label">Cap: {r.room_capacity}</span>
                      {!isDisabled && (
                        <button
                          type="button"
                          className="bm-vacancy-btn"
                          onClick={e => {
                            e.stopPropagation();
                            setOccupancyModal({ visible: true, roomId: r.room_id });
                          }}
                        >
                          Vacancy
                        </button>
                      )}
                    </div>
                  );
                })}
                {filteredAndSortedRooms.length === 0 && (
                  <div className="bm-grid-empty">No available rooms for this room type.</div>
                )}
              </div>
            </div>
            <div className="bm-modal-footer">
              <button type="button" className="bm-btn primary" onClick={() => setShowRoomModal(false)}>Done</button>
            </div>
          </div>
        </div>
      )}

      {/* ════ OCCUPANCY MODAL ════ */}
      {occupancyModal.visible && occupancyModal.roomId && (
        <div className="bm-modal-overlay" onClick={() => setOccupancyModal({ visible: false, roomId: null })}>
          <div className="bm-modal" onClick={e => e.stopPropagation()}>
            <div className="bm-modal-header">
              <h3>Room Occupancy</h3>
              <p>{occupancyModal.roomId}</p>
            </div>
            <div className="bm-modal-body">
              <div className="bm-timeslots">
                {/* RoomTimeslots component rendered inline */}
                <RoomTimeslotsInline roomId={occupancyModal.roomId} />
              </div>
            </div>
            <div className="bm-modal-footer">
              <button type="button" className="bm-btn" onClick={() => setOccupancyModal({ visible: false, roomId: null })}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ════ DELETE MODALITIES MODAL ════ */}
      {showDeleteConfirm && (
        <div className="bm-modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="bm-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '760px' }}>
            <div className="bm-modal-header">
              <h3>Manage Modalities</h3>
              <p>{userModalities.length} modality/modalities on record</p>
            </div>
            <div className="bm-modal-body">
              {userModalities.length === 0 ? (
                <div className="bm-grid-empty">You haven't created any modalities yet.</div>
              ) : (
                <>
                  <div className="bm-delete-controls">
                    <label className="bm-select-all-label">
                      <input
                        type="checkbox"
                        checked={selectedForDelete.length === userModalities.length}
                        onChange={toggleSelectAll}
                      />
                      <strong>Select All ({userModalities.length})</strong>
                    </label>
                    <span className="bm-hint">{selectedForDelete.length} selected</span>
                  </div>

                  <div className="bm-modality-list">
                    {userModalities.map(modality => {
                      const course = courseOptions.find(c => c.course_id === modality.course_id);
                      const program = programOptions.find(p => p.program_id === modality.program_id);
                      const isSelected = selectedForDelete.includes(modality.modality_id);
                      return (
                        <div
                          key={modality.modality_id}
                          className={`bm-modality-row${isSelected ? ' selected' : ''}`}
                          onClick={() => toggleSelectModality(modality.modality_id)}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectModality(modality.modality_id)}
                            onClick={e => e.stopPropagation()}
                            style={{ flexShrink: 0 }}
                          />
                          <div className="bm-modality-info">
                            <div className="bm-modality-title">
                              <span className="bm-type-badge">{modality.modality_type}</span>
                              <span className="bm-type-badge lab">{modality.room_type}</span>
                            </div>
                            <div className="bm-modality-meta">
                              <span><strong>Course:</strong> {course?.course_id ?? 'N/A'} – {course?.course_name ?? 'Unknown'}</span>
                              <span><strong>Program:</strong> {program?.program_id ?? 'N/A'} – {program?.program_name ?? 'Unknown'}</span>
                              <span><strong>Sections:</strong> {Array.isArray(modality.sections) ? modality.sections.join(', ') : modality.sections}</span>
                              {modality.possible_rooms?.length > 0 && (
                                <span><strong>Rooms:</strong> {modality.possible_rooms.join(', ')}</span>
                              )}
                              {modality.modality_remarks && (
                                <span><strong>Remarks:</strong> {modality.modality_remarks}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
            <div className="bm-modal-footer">
              <button type="button" className="bm-btn" onClick={() => { setShowDeleteConfirm(false); setSelectedForDelete([]); }} disabled={isDeleting}>Cancel</button>
              <button type="button" className="bm-btn danger" onClick={handleDeleteSelected} disabled={isDeleting || selectedForDelete.length === 0}>
                {isDeleting ? 'Deleting…' : `Delete Selected (${selectedForDelete.length})`}
              </button>
              <button type="button" className="bm-btn danger-fill" onClick={handleDeleteAll} disabled={isDeleting || userModalities.length === 0}>
                {isDeleting ? 'Deleting…' : 'Delete All'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════ FINAL DELETE CONFIRM ════ */}
      {showFinalDeleteConfirm && (
        <div className="bm-modal-overlay" onClick={() => setShowFinalDeleteConfirm(false)}>
          <div className="bm-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="bm-modal-header">
              <h3>Confirm Deletion</h3>
            </div>
            <div className="bm-modal-body">
              <p style={{ fontSize: '13.5px', color: 'var(--bm-text-secondary)', lineHeight: 1.7, margin: 0 }}>
                {deleteMode === 'all'
                  ? `You are about to delete ALL ${userModalities.length} modality/modalities. This action cannot be undone.`
                  : `You are about to delete ${selectedForDelete.length} selected modality/modalities. This action cannot be undone.`}
              </p>
            </div>
            <div className="bm-modal-footer">
              <button type="button" className="bm-btn" onClick={() => setShowFinalDeleteConfirm(false)} disabled={isDeleting}>Cancel</button>
              <button type="button" className="bm-btn danger-fill" onClick={handleFinalConfirm} disabled={isDeleting}>
                {isDeleting ? 'Deleting…' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer position="top-right" autoClose={3000} />
    </div>
  );
};

export default BayanihanModality;