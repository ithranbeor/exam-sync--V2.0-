import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../lib/apiClient.ts';
import '../styles/B_BayanihanModality.css';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Select from 'react-select';
import {FaSearch, FaEdit, FaSave, FaTimes } from 'react-icons/fa';

interface BayanihanLeaderStatus {
  user_id: number;
  full_name: string;
  department_id: string;
  college_id: string;
  submitted_count: number;
  modalities: any[];
}

interface UserProps {
  user: {
    user_id: number;
    email: string;
    first_name?: string;
    last_name?: string;
    avatar_url?: string;
  } | null;
  isScheduler?: boolean;
}

const modalityRoomTypeMap: { [key: string]: string } = {
  'Written (Lecture)': 'Lecture',
  'Written (Laboratory)': 'Laboratory',
  'Hands-on (Laboratory)': 'Laboratory',
};

interface EditingModality {
  modality_id: number;
  modality_type: string;
  room_type: string;
  modality_remarks: string;
  course_id: string;
  program_id: string;
  sections: string[];
  possible_rooms: string[];
  total_students: number;
}

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

  const [bayanihanLeaderStatuses, setBayanihanLeaderStatuses] = useState<BayanihanLeaderStatus[]>([]);
  const [leadersByDepartment, setLeadersByDepartment] = useState<{ [deptId: string]: { dept_name: string; leaders: BayanihanLeaderStatus[] } }>({});
  const [loadingLeaders, setLoadingLeaders] = useState(false);
  const [activeTab, setActiveTab] = useState<'submit' | 'manage'>('submit');
  const [expandedLeaders, setExpandedLeaders] = useState<Set<number>>(new Set());
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);

  // ── Manage modal state ────────────────────────────────────────────────────
  const [manageSearch, setManageSearch] = useState('');
  const [editingModality, setEditingModality] = useState<EditingModality | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const toggleLeader = (userId: number) => {
    setExpandedLeaders(prev => {
      if (prev.has(userId)) {
        return new Set<number>();
      }
      return new Set<number>([userId]);
    });
  };

  const fetchUserModalities = useCallback(async () => {
    if (!user?.user_id) return;
    try {
      const { data } = await api.get('/tbl_modality/', { params: { user_id: user.user_id } });
      setUserModalities(data || []);
    } catch (error) {
      toast.error('Failed to load your modalities');
    }
  }, [user]);

  useEffect(() => {
    fetchUserModalities();
  }, [fetchUserModalities]);

  const fetchBayanihanLeaderStatuses = useCallback(async (
    schedulerCollegeIds: string[],
    allDepartments: any[]
  ) => {
    setLoadingLeaders(true);
    try {
      // Get departments under the scheduler's college(s)
      const deptIdsInCollege = allDepartments
        .filter((d: any) => schedulerCollegeIds.includes(String(d.college_id || d.college || '')))
        .map((d: any) => ({
          department_id: String(d.department_id),
          department_name: String(d.department_name || d.department_id),
          college_id: String(d.college_id || d.college || ''),
        }));

      console.log('[BL] Depts in scheduler college:', deptIdsInCollege);

      // Fetch ALL user roles without filter to see actual structure
      const { data: allUserRoles } = await api.get('/tbl_user_role');
      console.log('[BL] First role entry keys:', allUserRoles?.[0] ? Object.keys(allUserRoles[0]) : 'empty');
      console.log('[BL] First 3 roles:', JSON.stringify(allUserRoles?.slice(0, 3)));

      // Find all unique user_ids that have bayanihan leader role
      // Try multiple field name patterns since we don't know the exact structure
      const blUserRoles = (allUserRoles || []).filter((r: any) => {
        const roleName = String(r.role_name || r.role?.role_name || r.role?.name || '').toLowerCase();
        const roleId = r.role_id || r.role?.role_id || r.role?.id || r.role;
        return roleName.includes('bayanihan') || roleId === 4;
      });

      console.log('[BL] BL role entries found:', blUserRoles.length);
      if (blUserRoles.length > 0) {
        console.log('[BL] Sample BL role entry:', JSON.stringify(blUserRoles[0]));
      }

      // Get unique user IDs from BL roles
      const blUserIds = Array.from(new Set(
        blUserRoles.map((r: any) => r.user_id || r.user?.user_id || r.user).filter(Boolean)
      ));
      console.log('[BL] BL user IDs:', blUserIds);

      if (blUserIds.length === 0) {
        // Fallback: fetch all users and check their roles individually
        // using the /user-roles/{id}/roles/ endpoint which we know works
        console.log('[BL] No BL users found via tbl_user_role, trying users list...');
        const { data: allUsers } = await api.get('/users/');
        console.log('[BL] Total users:', allUsers?.length);

        const blUsersFromRoles: any[] = [];
        // Check first 50 users to find BL ones (limit to avoid too many requests)
        const usersToCheck = (allUsers || []).slice(0, 50);
        await Promise.all(
          usersToCheck.map(async (u: any) => {
            try {
              const { data: userRoles } = await api.get(`/user-roles/${u.user_id}/roles/`);
              const hasBL = userRoles.some((r: any) =>
                r.status?.toLowerCase() === 'active' &&
                String(r.role_name || '').toLowerCase().includes('bayanihan')
              );
              if (hasBL) {
                const blRole = userRoles.find((r: any) =>
                  String(r.role_name || '').toLowerCase().includes('bayanihan')
                );
                blUsersFromRoles.push({ user: u, role: blRole });
              }
            } catch { /* skip */ }
          })
        );
        console.log('[BL] BL users found via roles endpoint:', blUsersFromRoles.length);

        // Filter by college/department match
        const matched = blUsersFromRoles.filter(({ role }) => {
          const roleCollegeId = String(role?.college?.college_id || role?.college_id || '');
          const roleDeptId = String(role?.department?.department_id || role?.department_id || '');
          const collegeMatch = schedulerCollegeIds.includes(roleCollegeId);
          const deptMatch = deptIdsInCollege.some(d => d.department_id === roleDeptId);
          return collegeMatch || deptMatch;
        });

        const leaderStatuses: BayanihanLeaderStatus[] = await Promise.all(
          matched.map(async ({ user: u, role }) => {
            const { data: modalities } = await api.get('/tbl_modality/', { params: { user_id: u.user_id } });
            return {
              user_id: u.user_id,
              full_name: `${u.first_name ?? ''} ${u.middle_name ?? ''} ${u.last_name ?? ''}`.trim(),
              department_id: String(role?.department?.department_id || role?.department_id || ''),
              college_id: String(role?.college?.college_id || role?.college_id || ''),
              submitted_count: Array.isArray(modalities) ? modalities.length : 0,
              modalities: Array.isArray(modalities) ? modalities : [],
            };
          })
        );

        setBayanihanLeaderStatuses(leaderStatuses);

        // Organize by department
        const organized: { [deptId: string]: { dept_name: string; leaders: BayanihanLeaderStatus[] } } = {};
        deptIdsInCollege.forEach(dept => {
          organized[dept.department_id] = { dept_name: dept.department_name, leaders: [] };
        });
        // Add a catch-all for college-level BLs with no specific dept
        leaderStatuses.forEach(l => {
          const deptId = l.department_id || 'college-level';
          if (!organized[deptId]) {
            organized[deptId] = {
              dept_name: deptId === 'college-level' ? 'College Level' : deptId,
              leaders: []
            };
          }
          organized[deptId].leaders.push(l);
        });
        setLeadersByDepartment(organized);
        setLoadingLeaders(false);
        return;
      }

      // Normal path: we found BL users from tbl_user_role
      // Now fetch their details and filter by college/department
      const leaderDetails = await Promise.all(
        blUserIds.map(async (userId: any) => {
          try {
            // Get this user's roles using the known-working endpoint
            const [{ data: userData }, { data: userRoles }, { data: modalities }] = await Promise.all([
              api.get(`/users/${userId}/`),
              api.get(`/user-roles/${userId}/roles/`),
              api.get('/tbl_modality/', { params: { user_id: userId } }),
            ]);

            // Find their BL role to get college/dept
            const blRole = (userRoles || []).find((r: any) =>
              String(r.role_name || '').toLowerCase().includes('bayanihan') &&
              r.status?.toLowerCase() === 'active'
            );

            if (!blRole) return null;

            const roleCollegeId = String(blRole.college?.college_id || blRole.college_id || '');
            const roleDeptId = String(blRole.department?.department_id || blRole.department_id || '');

            console.log(`[BL] User ${userId} - college: ${roleCollegeId}, dept: ${roleDeptId}`);

            // Check if this BL is under the scheduler's college or department
            const collegeMatch = schedulerCollegeIds.includes(roleCollegeId);
            const deptMatch = deptIdsInCollege.some(d => d.department_id === roleDeptId);

            if (!collegeMatch && !deptMatch) {
              console.log(`[BL] User ${userId} not in scheduler's scope, skipping`);
              return null;
            }

            return {
              user_id: userId,
              full_name: `${userData.first_name ?? ''} ${userData.middle_name ?? ''} ${userData.last_name ?? ''}`.trim(),
              department_id: roleDeptId,
              college_id: roleCollegeId,
              submitted_count: Array.isArray(modalities) ? modalities.length : 0,
              modalities: Array.isArray(modalities) ? modalities : [],
            } as BayanihanLeaderStatus;
          } catch (err) {
            console.error(`[BL] Error for user ${userId}:`, err);
            return null;
          }
        })
      );

      const valid = leaderDetails.filter(Boolean) as BayanihanLeaderStatus[];
      console.log('[BL] Final valid leaders:', valid.map(l => `${l.full_name} (dept:${l.department_id})`));

      setBayanihanLeaderStatuses(valid);

      // Organize by department
      const organized: { [deptId: string]: { dept_name: string; leaders: BayanihanLeaderStatus[] } } = {};
      deptIdsInCollege.forEach(dept => {
        organized[dept.department_id] = { dept_name: dept.department_name, leaders: [] };
      });
      valid.forEach(l => {
        const deptId = l.department_id || 'college-level';
        if (!organized[deptId]) {
          organized[deptId] = {
            dept_name: deptId === 'college-level' ? 'College Level' : deptId,
            leaders: []
          };
        }
        organized[deptId].leaders.push(l);
      });
      setLeadersByDepartment(organized);

    } catch (err) {
      console.error('[BL] Top-level error:', err);
      toast.error('Failed to load Bayanihan Leaders');
    } finally {
      setLoadingLeaders(false);
    }
  }, []);

  // ── Delete handlers ───────────────────────────────────────────────────────
  const handleDeleteSelected = () => {
    if (selectedForDelete.length === 0) { toast.warn('Please select modalities to delete'); return; }
    setDeleteMode('selected');
    setShowFinalDeleteConfirm(true);
  };

  const confirmDeleteSelected = async () => {
    if (selectedForDelete.length === 0) return;
    setIsDeleting(true);
    setShowFinalDeleteConfirm(false);
    try {
      await Promise.all(selectedForDelete.map(id => api.delete(`/tbl_modality/${id}/`)));
      toast.success(`Successfully deleted ${selectedForDelete.length} modality/modalities`);
      setSelectedForDelete([]);
      setShowDeleteConfirm(false);
      setEditingModality(null);
      await fetchUserModalities();
    } catch (error) {
      toast.error('Failed to delete some modalities');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleFinalConfirm = async () => {
    if (deleteMode === 'selected') await confirmDeleteSelected();
    else await confirmDeleteAll();
  };

  const handleDeleteAll = () => {
    if (userModalities.length === 0) { toast.warn('No modalities to delete'); return; }
    setDeleteMode('all');
    setShowFinalDeleteConfirm(true);
  };

  const confirmDeleteAll = async () => {
    if (userModalities.length === 0) return;
    setIsDeleting(true);
    setShowFinalDeleteConfirm(false);
    try {
      await Promise.all(userModalities.map(m => api.delete(`/tbl_modality/${m.modality_id}/`)));
      toast.success(`Successfully deleted all ${userModalities.length} modalities`);
      setUserModalities([]);
      setSelectedForDelete([]);
      setEditingModality(null);
      setShowDeleteConfirm(false);
    } catch (error) {
      toast.error('Failed to delete all modalities');
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleSelectModality = (modalityId: number) => {
    if (editingModality?.modality_id === modalityId) return; // don't select while editing
    setSelectedForDelete(prev =>
      prev.includes(modalityId) ? prev.filter(id => id !== modalityId) : [...prev, modalityId]
    );
  };

  const toggleSelectAll = () => {
    const visibleIds = filteredModalities.map(m => m.modality_id);
    const allSelected = visibleIds.every(id => selectedForDelete.includes(id));
    if (allSelected) {
      setSelectedForDelete(prev => prev.filter(id => !visibleIds.includes(id)));
    } else {
      setSelectedForDelete(prev => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  // ── Edit handlers ─────────────────────────────────────────────────────────
  const startEditing = (modality: any) => {
    setSelectedForDelete(prev => prev.filter(id => id !== modality.modality_id));
    setEditingModality({
      modality_id: modality.modality_id,
      modality_type: modality.modality_type || '',
      room_type: modality.room_type || '',
      modality_remarks: modality.modality_remarks || '',
      course_id: modality.course_id || '',
      program_id: modality.program_id || '',
      sections: Array.isArray(modality.sections)
        ? modality.sections
        : typeof modality.sections === 'string'
          ? modality.sections.split(',').map((s: string) => s.trim()).filter(Boolean)
          : [],
      possible_rooms: Array.isArray(modality.possible_rooms)
        ? modality.possible_rooms
        : typeof modality.possible_rooms === 'string'
          ? modality.possible_rooms.split(',').map((s: string) => s.trim()).filter(Boolean)
          : [],
      total_students: modality.total_students || 0,
    });
  };

  const cancelEditing = () => setEditingModality(null);

  const saveEditing = async () => {
    if (!editingModality || isSavingEdit) return;
    setIsSavingEdit(true);
    try {
      await api.patch(`/tbl_modality/${editingModality.modality_id}/`, {
        modality_type: editingModality.modality_type,
        room_type: editingModality.room_type,
        modality_remarks: editingModality.modality_remarks,
        course_id: editingModality.course_id,
        program_id: editingModality.program_id,
        sections: editingModality.sections,
        possible_rooms: editingModality.possible_rooms,
        total_students: editingModality.total_students,
      });
      toast.success('Modality updated successfully');
      setEditingModality(null);
      await fetchUserModalities();
    } catch (error: any) {
      toast.error(`Failed to update: ${error?.message || 'Unknown error'}`);
    } finally {
      setIsSavingEdit(false);
    }
  };

  // ── Search filter ─────────────────────────────────────────────────────────
  const filteredModalities = useMemo(() => {
    const q = manageSearch.trim().toLowerCase();
    if (!q) return userModalities;
    return userModalities.filter(m => {
      const course = courseOptions.find(c => c.course_id === m.course_id);
      const program = programOptions.find(p => p.program_id === m.program_id);
      const sections = Array.isArray(m.sections) ? m.sections.join(' ') : String(m.sections || '');
      return (
        (m.modality_type || '').toLowerCase().includes(q) ||
        (m.room_type || '').toLowerCase().includes(q) ||
        (course?.course_id || '').toLowerCase().includes(q) ||
        (course?.course_name || '').toLowerCase().includes(q) ||
        (program?.program_id || '').toLowerCase().includes(q) ||
        (program?.program_name || '').toLowerCase().includes(q) ||
        sections.toLowerCase().includes(q) ||
        (m.modality_remarks || '').toLowerCase().includes(q)
      );
    });
  }, [userModalities, manageSearch, courseOptions, programOptions]);

  const [roomStatus, setRoomStatus] = useState<{
    [key: string]: { occupiedTimes: { start: string; end: string }[] }
  }>({});

  const fetchRoomOccupancy = useCallback(async (roomId: string) => {
    if (roomStatus[roomId]) return;
    try {
      const { data: exams } = await api.get('/tbl_examdetails', { params: { room_id: roomId } });
      const occupiedTimes = exams.map((e: any) => ({ start: e.exam_start_time, end: e.exam_end_time }));
      setRoomStatus(prev => ({ ...prev, [roomId]: { occupiedTimes } }));
    } catch (error: any) {
      console.error('Error loading room occupancy:', error);
    }
  }, [roomStatus]);

  const filteredCourseOptions = useMemo(() => {
    if (!form.program) return [];
    const filtered = courseOptions.filter(c =>
      sectionOptions.some(s => s.program_id === form.program && s.course_id === c.course_id)
    );
    filtered.sort((a, b) => a.course_id.localeCompare(b.course_id, undefined, { numeric: true, sensitivity: 'base' }));
    return filtered;
  }, [courseOptions, sectionOptions, form.program]);

  const filteredSectionOptions = useMemo(() => {
    if (!form.course) return [];
    return sectionOptions
      .filter(s => s.course_id === form.course)
      .map(s => ({ value: s.section_name, label: s.section_name }));
  }, [sectionOptions, form.course]);

  /** FETCH PROGRAMS, COURSES, SECTIONS, ROOMS, BUILDINGS */
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

        if (!roles || roles.length === 0) { setLoadingRooms(false); return; }

        // Use stored user roles for accurate role name detection
        const storedUser = JSON.parse(
          localStorage.getItem('user') || sessionStorage.getItem('user') || '{}'
        );
        const storedRoles: any[] = storedUser.roles || [];
        const activeRoleNames = storedRoles
          .filter((r: any) => r.status?.toLowerCase() === 'active')
          .map((r: any) => String(r.role_name || '').toLowerCase());

        const isAdmin = activeRoleNames.includes('admin');
        const isScheduler = activeRoleNames.includes('scheduler');

        console.log('[fetchData] activeRoleNames:', activeRoleNames);
        console.log('[fetchData] isAdmin:', isAdmin, '| isScheduler:', isScheduler);

        // ── SCHEDULER PATH (runs even if also admin) ────────────────────────
        if (isScheduler) {
          const collegeIds: string[] = Array.from(new Set(
            storedRoles
              .filter((r: any) => r.role_name?.toLowerCase() === 'scheduler' && r.status?.toLowerCase() === 'active')
              .map((r: any) => r.college?.college_id)
              .filter(Boolean)
              .map(String)
          )) as string[];

          console.log('[Scheduler] collegeIds:', collegeIds);

          if (collegeIds.length === 0) {
            toast.warn('No college assigned to your Scheduler role.');
            setLoadingRooms(false);
            return;
          }

          // Admin-scheduler sees all programs/courses/sections; pure scheduler sees only their college
          const programs = isAdmin
            ? allPrograms
            : allPrograms.filter((p: any) =>
                collegeIds.includes(String(p.college_id || p.college || ''))
              );
          setProgramOptions(programs);

          const programIds = programs.map((p: any) => String(p.program_id));
          const normalizedSections = (Array.isArray(sectionCourses) ? sectionCourses : []).map((sc: any) => ({
            course_id: String(sc.course_id ?? sc.course?.course_id ?? ''),
            program_id: String(sc.program_id ?? sc.program?.program_id ?? ''),
            section_name: String(sc.section_name ?? ''),
            number_of_students: Number(sc.number_of_students ?? 0),
          }));
          const filteredSections = isAdmin
            ? normalizedSections
            : normalizedSections.filter(s => programIds.includes(s.program_id));
          setSectionOptions(filteredSections);

          const courseIdsForScheduler = Array.from(new Set(filteredSections.map(s => s.course_id)));
          const filteredCourses = isAdmin
            ? allCourses
            : allCourses.filter((c: any) => courseIdsForScheduler.includes(String(c.course_id)));
          setCourseOptions(filteredCourses);

          const { data: allRooms } = await api.get('/tbl_rooms');
          if (isAdmin) {
            setRoomOptions(allRooms);
            setAvailableRoomIds(allRooms.map((r: any) => r.room_id));
          } else {
            const availableRoomsResponses = await Promise.all(
              collegeIds.map(cId => api.get('/tbl_available_rooms/', { params: { college_id: cId } }))
            );
            const allAvailableRooms = availableRoomsResponses.flatMap(r => r.data);
            const availableIds = allAvailableRooms
              .map((ar: any) => ar.room?.room_id || ar.room_id || ar.room)
              .filter(Boolean)
              .map(String);
            setAvailableRoomIds(availableIds);
            setRoomOptions(allRooms.filter((r: any) => availableIds.includes(String(r.room_id))));
          }

          setBuildingOptions(buildings?.map((b: any) => ({ id: b.building_id, name: b.building_name })) ?? []);

          // Always fetch BL statuses scoped to scheduler's college
          fetchBayanihanLeaderStatuses(collegeIds, allDepartments);
          setLoadingRooms(false);
          return;
        }

        // ── ADMIN-ONLY PATH (no scheduler role) ──────────────────────────────
        if (isAdmin) {
          setProgramOptions(allPrograms);
          setCourseOptions(allCourses);
          const allSections = (Array.isArray(sectionCourses) ? sectionCourses : []).map((sc: any) => ({
            course_id: String(sc.course_id ?? sc.course?.course_id ?? ''),
            program_id: String(sc.program_id ?? sc.program?.program_id ?? ''),
            section_name: String(sc.section_name ?? ''),
            number_of_students: Number(sc.number_of_students ?? 0)
          }));
          setSectionOptions(allSections);
          const { data: allRooms } = await api.get('/tbl_rooms');
          setRoomOptions(allRooms);
          setAvailableRoomIds(allRooms.map((r: any) => r.room_id));
          setBuildingOptions(buildings?.map((b: any) => ({ id: b.building_id, name: b.building_name })) ?? []);
          setLoadingRooms(false);
          return;
        }

        // ── BAYANIHAN LEADER PATH ────────────────────────────────────────────
        const leaderRoles = roles.filter((r: any) => r.role === 4 || r.role_id === 4);
        if (!leaderRoles || leaderRoles.length === 0) {
          toast.warn('You are not assigned as a Bayanihan Leader.');
          setLoadingRooms(false);
          return;
        }

        const { data: userCourses } = await api.get('/tbl_course_users/', {
          params: { user_id: user.user_id, is_bayanihan_leader: 'true' }
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

        const coursesWithNames = allCourses.filter((c: any) => courseIds.includes(c.course_id));
        setCourseOptions(coursesWithNames);

        const sectionsData = Array.isArray(sectionCourses) ? sectionCourses : [];
        const normalizedSections = sectionsData.map((sc: any) => ({
          course_id: String(sc.course_id ?? sc.course?.course_id ?? ''),
          program_id: String(sc.program_id ?? sc.program?.program_id ?? ''),
          section_name: String(sc.section_name ?? ''),
          number_of_students: Number(sc.number_of_students ?? 0),
        }));
        const filteredSections = normalizedSections.filter((sec: any) =>
          courseIds.map(String).includes(String(sec.course_id))
        );
        setSectionOptions(filteredSections);

        const programIdsFromSections = Array.from(new Set(filteredSections.map((s: any) => s.program_id)));
        const leaderDepartmentIds = leaderRoles.map((r: any) => r.department_id || r.department).filter(Boolean);

        if (leaderDepartmentIds.length === 0) {
          toast.warn('No department assigned to your Bayanihan Leader role.');
          setLoadingRooms(false);
          return;
        }

        const departments = allDepartments.filter((d: any) => leaderDepartmentIds.includes(d.department_id));
        const collegeIds = departments.map((d: any) => d.college_id || d.college).filter(Boolean);

        if (collegeIds.length === 0) {
          toast.warn('No associated college found for your department.');
          setLoadingRooms(false);
          return;
        }

        const collegeIdStrings = collegeIds.map((c: any) => String(c.college_id || c)).filter(Boolean);
        const deptNames = departments.map((d: any) => d.department_name).filter(Boolean);

        const programs = allPrograms.filter((p: any) => {
          if (!programIdsFromSections.includes(p.program_id)) return false;
          const progDeptName = String(p.department || p.department_name || '');
          const progDeptId = String(p.department_id || '');
          const progCollege = String(p.college_id || p.college || '');
          const deptMatch = leaderDepartmentIds.includes(progDeptId) || deptNames.some((name: string) => progDeptName.includes(name));
          const collegeMatch = collegeIdStrings.includes(progCollege);
          return deptMatch || collegeMatch;
        });
        setProgramOptions(programs);

        const availableRoomsPromises = collegeIdStrings.map((collegeId: string) =>
          api.get('/tbl_available_rooms/', { params: { college_id: collegeId } })
        );
        const availableRoomsResponses = await Promise.all(availableRoomsPromises);
        const allAvailableRooms = availableRoomsResponses.flatMap(r => r.data);
        const availableIds = allAvailableRooms.map((ar: any) => ar.room?.room_id || ar.room_id || ar.room).filter(Boolean);
        setAvailableRoomIds(availableIds.map(String));

        if (availableIds.length > 0) {
          const { data: allRooms } = await api.get('/tbl_rooms');
          setRoomOptions(allRooms.filter((r: any) => availableIds.includes(r.room_id)));
        } else {
          setRoomOptions([]);
        }

        setBuildingOptions(buildings?.map((b: any) => ({ id: b.building_id, name: b.building_name })) ?? []);
      } catch (error: any) {
        toast.error('An unexpected error occurred while loading data');
      } finally {
        setLoadingRooms(false);
      }
    };
    fetchData();
  }, [user, fetchBayanihanLeaderStatuses]);

  useEffect(() => {
    const requiredRoomType = modalityRoomTypeMap[form.modality];
    if (!requiredRoomType) return;
    if (requiredRoomType === 'No Room') { setForm(prev => ({ ...prev, rooms: [], roomType: 'No Room' })); return; }
    setForm(prev => ({ ...prev, roomType: requiredRoomType }));
  }, [form.modality]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const calculateRoomAssignments = useMemo(() => {
    if (form.rooms.length === 0 || form.sections.length === 0) return [];
    const sectionStudentCounts = form.sections.map(sectionName => {
      const section = sectionOptions.find(s => s.course_id === form.course && s.section_name === sectionName);
      const isNightClass = sectionName.toLowerCase().includes('night') || sectionName.toLowerCase().includes('n-');
      return { sectionName, studentCount: section?.number_of_students || 0, isNightClass };
    });
    const daySections = sectionStudentCounts.filter(s => !s.isNightClass);
    const nightSections = sectionStudentCounts.filter(s => s.isNightClass);
    const roomCapacities = form.rooms.map(roomId => {
      const room = roomOptions.find(r => r.room_id === roomId);
      return { roomId, capacity: room?.room_capacity || 0 };
    }).sort((a, b) => b.capacity - a.capacity);

    const assignments: { roomId: string; sections: string[]; totalStudents: number; isNightClass: boolean }[] = [];
    const assignedSections = new Set<string>();

    const assignSectionsToRooms = (sections: typeof sectionStudentCounts, isNightClass: boolean) => {
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
          if (room.capacity - assignment.totalStudents >= section.studentCount) {
            assignment.sections.push(section.sectionName);
            assignment.totalStudents += section.studentCount;
            assignedSections.add(section.sectionName);
            assigned = true;
            break;
          }
        }
        if (!assigned) {
          const availableRoom = availableRooms.find(room => !assignments.some(a => a.roomId === room.roomId));
          if (availableRoom && availableRoom.capacity >= section.studentCount) {
            assignments.push({ roomId: availableRoom.roomId, sections: [section.sectionName], totalStudents: section.studentCount, isNightClass });
            assignedSections.add(section.sectionName);
            assigned = true;
          }
        }
        if (!assigned && availableRooms.length > 0) {
          let targetAssignment = assignments.find(a => a.isNightClass === isNightClass);
          if (!targetAssignment) {
            targetAssignment = { roomId: availableRooms[0].roomId, sections: [], totalStudents: 0, isNightClass };
            assignments.push(targetAssignment);
          }
          targetAssignment.sections.push(section.sectionName);
          targetAssignment.totalStudents += section.studentCount;
          assignedSections.add(section.sectionName);
        }
      });
    };

    if (daySections.length > 0) assignSectionsToRooms(daySections, false);
    if (nightSections.length > 0) assignSectionsToRooms(nightSections, true);

    const unassignedSections = form.sections.filter(s => !assignedSections.has(s));
    if (unassignedSections.length > 0) {
      const day = unassignedSections.filter(s => !s.toLowerCase().includes('night') && !s.toLowerCase().includes('n-'));
      const night = unassignedSections.filter(s => s.toLowerCase().includes('night') || s.toLowerCase().includes('n-'));
      if (day.length > 0) assignments.push({ roomId: '⚠️ NOT ASSIGNED', sections: day, totalStudents: day.reduce((sum, sn) => { const sec = sectionOptions.find(s => s.course_id === form.course && s.section_name === sn); return sum + (sec?.number_of_students || 0); }, 0), isNightClass: false });
      if (night.length > 0) assignments.push({ roomId: '⚠️ NOT ASSIGNED', sections: night, totalStudents: night.reduce((sum, sn) => { const sec = sectionOptions.find(s => s.course_id === form.course && s.section_name === sn); return sum + (sec?.number_of_students || 0); }, 0), isNightClass: true });
    }
    return assignments.filter(a => a.sections.length > 0);
  }, [form.rooms, form.sections, form.course, sectionOptions, roomOptions]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!user?.user_id) return;
    if (!form.sections.length) { toast.warn('Please select at least one section.'); return; }
    if (form.rooms.length === 0) { toast.error('Please select at least one room.'); return; }

    const dayStudents = form.sections.reduce((sum, sn) => { const sec = sectionOptions.find(s => s.course_id === form.course && s.section_name === sn); const isNight = sn.toLowerCase().includes('night') || sn.toLowerCase().includes('n-'); return sum + (isNight ? 0 : (sec?.number_of_students || 0)); }, 0);
    const nightStudents = form.sections.reduce((sum, sn) => { const sec = sectionOptions.find(s => s.course_id === form.course && s.section_name === sn); const isNight = sn.toLowerCase().includes('night') || sn.toLowerCase().includes('n-'); return sum + (isNight ? (sec?.number_of_students || 0) : 0); }, 0);
    const totalStudents = dayStudents + nightStudents;
    const totalRoomCapacity = form.rooms.reduce((sum, roomId) => { const room = roomOptions.find(r => r.room_id === roomId); return sum + (room?.room_capacity || 0); }, 0);

    const hasNightSections = nightStudents > 0;
    const hasDaySections = dayStudents > 0;
    if (hasNightSections && hasDaySections) {
      if (totalRoomCapacity < Math.max(dayStudents, nightStudents)) { toast.error(`Insufficient room capacity.`); return; }
    } else if (totalStudents > totalRoomCapacity) {
      toast.error(`Total students (${totalStudents}) exceed total room capacity (${totalRoomCapacity}).`); return;
    }

    if (calculateRoomAssignments.some(a => !a.roomId || a.roomId.includes('NOT ASSIGNED'))) {
      const unassigned = calculateRoomAssignments.filter(a => a.roomId === '⚠️ NOT ASSIGNED').flatMap(a => a.sections).join(', ');
      toast.error(`Cannot submit: sections not assigned: ${unassigned}.`); return;
    }
    if (calculateRoomAssignments.some(a => { if (a.roomId === '⚠️ NOT ASSIGNED') return false; const room = roomOptions.find(r => r.room_id === a.roomId); return a.totalStudents > (room?.room_capacity || 0); })) {
      toast.error('One or more room assignments exceed capacity.'); return;
    }

    setIsSubmitting(true);
    const submissions = calculateRoomAssignments.map(async (assignment) => {
      try {
        const { data: existing } = await api.get('/tbl_modality/', { params: { course_id: form.course, program_id: form.program, sections: assignment.sections.join(','), modality_type: form.modality, room_type: form.roomType } });
        if (existing && existing.length > 0) return { status: 'skipped', sections: assignment.sections };
        await api.post('/tbl_modality/', { modality_type: form.modality, room_type: form.roomType, modality_remarks: form.remarks, course_id: form.course, program_id: form.program, sections: assignment.sections, total_students: assignment.totalStudents, possible_rooms: [assignment.roomId], user_id: user.user_id, created_at: new Date().toISOString() });
        return { status: 'success', sections: assignment.sections };
      } catch (error) {
        return { status: 'error', sections: assignment.sections, error };
      }
    });

    const results = await Promise.allSettled(submissions);
    let successCount = 0, skippedCount = 0, errorCount = 0;
    results.forEach(result => {
      if (result.status === 'fulfilled') {
        const v = result.value as any;
        if (v.status === 'success') successCount++;
        else if (v.status === 'skipped') skippedCount++;
        else errorCount++;
      } else errorCount++;
    });

    if (successCount > 0) toast.success(`Successfully saved ${successCount} modality group(s)`);
    if (successCount > 0) {
      try {
        const storedUser = JSON.parse(
          localStorage.getItem('user') || sessionStorage.getItem('user') || '{}'
        );
        const myRoles: any[] = storedUser.roles || [];
        const blRole = myRoles.find((r: any) =>
          String(r.role_name || '').toLowerCase().includes('bayanihan') &&
          r.status?.toLowerCase() === 'active'
        );
        const myCollegeId = blRole?.college?.college_id
          ? String(blRole.college.college_id)
          : null;

        const senderFullName = [user?.first_name, user?.last_name].filter(Boolean).join(' ') || 'A Bayanihan Leader';

        const { data: allUsers } = await api.get('/users/');
        const schedulerUserIds: number[] = [];

        await Promise.all(
          (allUsers || []).map(async (u: any) => {
            try {
              const { data: uRoles } = await api.get(`/user-roles/${u.user_id}/roles/`);
              const isMatch = (uRoles || []).some((r: any) => {
                const roleName = String(r.role_name || '').toLowerCase();
                const roleCollege = String(r.college?.college_id || r.college_id || '');
                return (
                  roleName === 'scheduler' &&
                  r.status?.toLowerCase() === 'active' &&
                  (!myCollegeId || roleCollege === myCollegeId)
                );
              });
              if (isMatch) schedulerUserIds.push(u.user_id);
            } catch { /* skip */ }
          })
        );

        await Promise.all(
          schedulerUserIds.map((schedulerId: number) =>
            api.post('/notifications/create/', {
              user_id:    schedulerId,
              sender_id:  user?.user_id,
              title:      'New Modality Submitted',
              message:    `${senderFullName} has submitted ${successCount} modality group(s). Please review their submission.`,
              type:       'availability_set',
              is_seen:    false,
              priority:   1,
              created_at: new Date().toISOString(),
            }).catch(() => {})
          )
        );
      } catch (err) {
        console.error('Failed to notify schedulers:', err);
      }
    }
    if (skippedCount > 0) toast.info(`Skipped ${skippedCount} group(s) (already submitted)`);
    if (errorCount > 0) toast.error(`Failed to save ${errorCount} group(s)`);
    setIsSubmitting(false);
    setForm({ modality: '', rooms: [], roomType: '', program: '', sections: [], course: '', remarks: '' });
    await fetchUserModalities();
  };

  const getRoomTimeslots = useCallback((roomId: string) => {
    const dayStart = new Date(); dayStart.setHours(7, 30, 0, 0);
    const dayEnd = new Date(); dayEnd.setHours(21, 0, 0, 0);
    const status = roomStatus[String(roomId)];
    const occupiedTimes = status?.occupiedTimes.map(t => ({ start: new Date(t.start), end: new Date(t.end) })).sort((a, b) => a.start.getTime() - b.start.getTime()) || [];
    const timeslots: { start: Date; end: Date; occupied: boolean }[] = [];
    let cursor = new Date(dayStart);
    for (const slot of occupiedTimes) {
      if (cursor.getTime() < slot.start.getTime()) timeslots.push({ start: new Date(cursor), end: new Date(slot.start), occupied: false });
      timeslots.push({ start: new Date(slot.start), end: new Date(slot.end), occupied: true });
      cursor = new Date(slot.end);
    }
    if (cursor.getTime() < dayEnd.getTime()) timeslots.push({ start: new Date(cursor), end: new Date(dayEnd), occupied: false });
    return timeslots;
  }, [roomStatus]);

  const filteredAndSortedRooms = useMemo(() => {
    return roomOptions
      .filter(r => !selectedBuilding || r.building_id === selectedBuilding)
      .sort((a, b) => {
        if (a.room_type === form.roomType && b.room_type !== form.roomType) return -1;
        if (a.room_type !== form.roomType && b.room_type === form.roomType) return 1;
        return a.room_id.localeCompare(b.room_id, undefined, { numeric: true });
      });
  }, [roomOptions, selectedBuilding, form.roomType]);

  const selectStyles = {
    control: (base: any) => ({ ...base, fontSize: '13px', minHeight: '36px', borderColor: '#DDE3EC', borderRadius: '6px' }),
    placeholder: (base: any) => ({ ...base, color: '#8A9BB0' }),
    menuPortal: (base: any) => ({ ...base, zIndex: 99999 }),
    menu: (base: any) => ({ ...base, fontSize: '13px' }),
    option: (base: any, state: any) => ({
      ...base,
      fontSize: '13px',
      color: state.isDisabled ? '#8A9BB0' : '#0C1B2A',
      backgroundColor: state.isDisabled ? '#F5F7FA' : state.isSelected ? '#83a6d1' : state.isFocused ? '#EBF4FF' : '#ffffff',
      cursor: state.isDisabled ? 'not-allowed' : 'pointer',
    }),
    singleValue: (base: any) => ({ ...base, color: '#0C1B2A' }),
    input: (base: any) => ({ ...base, color: '#0C1B2A' }),
  };

  const RoomTimeslotsInline: React.FC<{ roomId: string }> = ({ roomId }) => {
    useEffect(() => { fetchRoomOccupancy(roomId); }, [roomId]);
    const slots = getRoomTimeslots(roomId);
    if (!roomStatus[roomId]) return <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--bm-text-muted)', fontSize: '13px' }}>Loading occupancy…</div>;
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

  // ── Sections available for editing a modality ─────────────────────────────
  const editSectionOptions = useMemo(() => {
    if (!editingModality?.course_id) return [];
    return sectionOptions
      .filter(s => s.course_id === editingModality.course_id)
      .map(s => ({ value: s.section_name, label: s.section_name }));
  }, [sectionOptions, editingModality?.course_id]);

  const editRoomOptions = useMemo(() => {
    if (!editingModality?.room_type) return roomOptions;
    return roomOptions.filter(r => r.room_type === editingModality.room_type);
  }, [roomOptions, editingModality?.room_type]);

  const visibleSelectedIds = filteredModalities.map(m => m.modality_id);
  const allVisibleSelected = visibleSelectedIds.length > 0 && visibleSelectedIds.every(id => selectedForDelete.includes(id));

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
            <h1>Modality</h1>
            <p>Fill in all fields before submitting</p>
          </div>
        </div>
        <div className="bm-page-actions">
          <button type="button" className="bm-btn primary" onClick={() => { setShowDeleteConfirm(true); setManageSearch(''); setEditingModality(null); setSelectedForDelete([]); }}>
            Manage Modalities
          </button>
          <button type="button" className="bm-btn primary" onClick={() => {
            if (calculateRoomAssignments.length === 0) return;
            setShowSubmitConfirm(true);
          }} disabled={isSubmitting || calculateRoomAssignments.length === 0}>
            {isSubmitting ? 'Submitting…' : 'Submit Modality'}
          </button>
        </div>
      </div>

      {/* ── Main Layout ── */}
      <div className="bm-layout">
        <aside className="bm-sidebar">
          {calculateRoomAssignments.length > 0 && (
            <div className="bm-sidebar-card">
              <div className="bm-sidebar-card-header"><h4>Assignment Preview</h4></div>
              <div className="bm-sidebar-card-body" style={{ padding: '10px 12px', gap: '6px' }}>
                {calculateRoomAssignments.map((assignment, idx) => {
                  const isUnassigned = assignment.roomId === '⚠️ NOT ASSIGNED';
                  const room = roomOptions.find(r => r.room_id === assignment.roomId);
                  const isOverCapacity = !isUnassigned && assignment.totalStudents > (room?.room_capacity || 0);
                  return (
                    <div key={idx} className={`bm-assignment-row ${isUnassigned ? 'unassigned' : isOverCapacity ? 'overcapacity' : 'ok'}`}>
                      <div className="bm-assignment-room">
                        {isUnassigned ? '⚠️ Not Assigned' : `Room ${assignment.roomId}`}
                        {assignment.isNightClass && <span className="bm-night-badge">Night</span>}
                      </div>
                      <div className="bm-assignment-meta">{!isUnassigned && `${assignment.totalStudents}/${room?.room_capacity ?? 'N/A'} students`}</div>
                      <div className="bm-assignment-sections">{assignment.sections.join(', ')}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          <div className="bm-sidebar-card">
            <div className="bm-sidebar-card-header"><h4>Status</h4></div>
            <div className="bm-sidebar-card-body">
              <div className="bm-stats-grid">
                <div className="bm-stat-box"><div className="bm-stat-num">{form.sections.length}</div><div className="bm-stat-label">Sections</div></div>
                <div className="bm-stat-box"><div className="bm-stat-num">{form.rooms.length}</div><div className="bm-stat-label">Rooms</div></div>
                <div className="bm-stat-box"><div className="bm-stat-num">{userModalities.length}</div><div className="bm-stat-label">Submitted</div></div>
                <div className="bm-stat-box"><div className="bm-stat-num">{calculateRoomAssignments.length}</div><div className="bm-stat-label">Groups</div></div>
              </div>
              {loadingRooms && <div className="bm-info-banner info">Loading available rooms…</div>}
              {!loadingRooms && availableRoomIds.length === 0 && <div className="bm-info-banner warn">No rooms available. Contact the administrator.</div>}
            </div>
          </div>
        </aside>

        <div className="bm-content">
          <div className="bm-form-card">
            <div className="bm-form-card-header"><h3>Modality Details</h3></div>
            <div className="bm-form-card-body">
              <form className="bm-form-grid" onSubmit={handleSubmit}>
                <div className="bm-field">
                  <label>Modality Type</label>
                  <Select
                    options={[{ value: 'Hands-on (Laboratory)', label: 'Hands-on (Laboratory)' }, { value: 'Written (Lecture)', label: 'Written (Lecture)' }, { value: 'Written (Laboratory)', label: 'Written (Laboratory)' }]}
                    value={form.modality ? { value: form.modality, label: form.modality } : null}
                    onChange={selected => setForm(prev => ({ ...prev, modality: selected?.value || '', course: '', sections: [], rooms: [] }))}
                    placeholder="Select modality…" isClearable menuPortalTarget={document.body} styles={selectStyles}
                  />
                </div>
                <div className="bm-field">
                  <label>Program</label>
                  <Select
                    options={programOptions.slice().sort((a, b) => a.program_id.localeCompare(b.program_id, undefined, { numeric: true })).map(p => ({ value: p.program_id, label: `${p.program_id} - ${p.program_name}` }))}
                    value={programOptions.filter(p => p.program_id === form.program).map(p => ({ value: p.program_id, label: `${p.program_id} - ${p.program_name}` }))}
                    onChange={selected => setForm(prev => ({ ...prev, program: selected?.value || '', course: '', sections: [] }))}
                    placeholder="Select program…" isClearable menuPortalTarget={document.body} styles={selectStyles}
                  />
                </div>
                <div className="bm-field">
                  <label>Course</label>
                  <Select
                    isDisabled={!form.program}
                    options={filteredCourseOptions.map(c => ({ value: c.course_id, label: `${c.course_id} (${c.course_name})`, isDisabled: userModalities.some(m => m.course_id === c.course_id && m.modality_type === form.modality) && form.modality !== '' }))}
                    value={form.course ? { value: form.course, label: `${filteredCourseOptions.find(c => c.course_id === form.course)?.course_id} (${filteredCourseOptions.find(c => c.course_id === form.course)?.course_name})` } : null}
                    onChange={selected => {
                      const courseId = selected?.value || '';
                      const availableSections = sectionOptions.filter(s => s.course_id === courseId).filter(s => !userModalities.some(m => m.course_id === courseId && ((Array.isArray(m.sections) && m.sections.includes(s.section_name)) || (typeof m.sections === 'string' && m.sections.split(',').map((sec: string) => sec.trim()).includes(s.section_name))))).map(s => s.section_name).sort((a, b) => a.localeCompare(b));
                      setForm(prev => ({ ...prev, course: courseId, sections: availableSections, rooms: [] }));
                    }}
                    placeholder="Select course…" isClearable styles={{ ...selectStyles, option: (base, state) => ({ ...base, backgroundColor: state.isDisabled ? '#F5F7FA' : state.isFocused ? '#EBF4FF' : 'white', color: state.isDisabled ? '#8A9BB0' : '#0C1B2A', cursor: state.isDisabled ? 'not-allowed' : 'pointer' }) }}
                  />
                  {form.modality && <small className="bm-hint">Grayed out courses already have a {form.modality} modality submitted</small>}
                </div>
                <div className="bm-field">
                  <label>Remarks</label>
                  <textarea name="remarks" value={form.remarks} onChange={handleChange} placeholder="Enter any notes or remarks…" className="bm-textarea" />
                </div>
                <div className="bm-field bm-full-width">
                  <label>Sections</label>
                  {form.course ? (
                    <Select
                      isMulti closeMenuOnSelect={false} hideSelectedOptions={false}
                      options={filteredSectionOptions.map(s => { const hasModality = userModalities.some(m => m.course_id === form.course && ((Array.isArray(m.sections) && m.sections.includes(s.value)) || (typeof m.sections === 'string' && m.sections.split(',').map((sec: string) => sec.trim()).includes(s.value)))); return { value: s.value, label: s.label, isDisabled: hasModality }; }).sort((a, b) => a.label.localeCompare(b.label))}
                      value={form.sections.sort((a, b) => a.localeCompare(b)).map(sec => ({ value: sec, label: sec }))}
                      onChange={selectedOptions => setForm(prev => ({ ...prev, sections: selectedOptions ? selectedOptions.map(opt => opt.value) : [], rooms: [] }))}
                      styles={{ ...selectStyles, multiValue: (base) => ({ ...base, backgroundColor: '#0d4993', borderRadius: '6px' }), multiValueLabel: (base) => ({ ...base, color: '#ffffff', fontWeight: 600, fontSize: '11px' }), valueContainer: (base) => ({ ...base, maxHeight: '100px', overflowY: 'auto' }), option: (base, state) => ({ ...base, backgroundColor: state.isDisabled ? '#F5F7FA' : state.isFocused ? '#c8c8c9' : 'white', color: state.isDisabled ? '#8A9BB0' : '#0d4993', cursor: state.isDisabled ? 'not-allowed' : 'pointer' }) }}
                    />
                  ) : <div className="bm-placeholder-text">Select a course first</div>}
                  {form.course && form.sections.length > 0 && <small className="bm-hint">{form.sections.length} section(s) selected</small>}
                </div>
                <div className="bm-field bm-full-width">
                  <label>Room Location</label>
                  <div className="bm-room-selector-row">
                    <button type="button" className="bm-btn primary" disabled={!form.roomType || form.roomType === 'No Room' || availableRoomIds.length === 0 || loadingRooms || form.sections.length === 0} onClick={() => setShowRoomModal(true)} style={{ width: 'fit-content' }}>
                      {loadingRooms ? 'Loading…' : 'Select Rooms'}
                    </button>
                    {form.sections.length === 0 && <small className="bm-hint">Please select sections first</small>}
                  </div>
                  {form.rooms.length > 0 && (
                    <div className="bm-selected-rooms">
                      {form.rooms.slice().sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).map(roomId => (
                        <span key={roomId} className="bm-chip">{roomId}<button type="button" className="bm-chip-remove" onClick={() => setForm(prev => ({ ...prev, rooms: prev.rooms.filter(r => r !== roomId) }))}>✕</button></span>
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
                <Select options={buildingOptions.map(b => ({ value: b.id, label: `${b.name} (${b.id})` }))} value={selectedBuilding ? { value: selectedBuilding, label: `${buildingOptions.find(b => b.id === selectedBuilding)?.name} (${selectedBuilding})` } : null} onChange={selected => setSelectedBuilding(selected?.value || null)} placeholder="Filter by building…" isClearable styles={selectStyles} />
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
                          <div className="bm-assignment-room">{isUnassigned ? '⚠️ Not Assigned' : `Room ${assignment.roomId}`}{!isUnassigned && ` (${assignment.totalStudents}/${room?.room_capacity ?? 'N/A'})`}{assignment.isNightClass && <span className="bm-night-badge">Night</span>}</div>
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
                    <div key={r.room_id} className={`bm-room-box${isSelected ? ' selected' : ''}${isDisabled ? ' disabled' : ''}`} onClick={() => { if (isDisabled) return; setForm(prev => ({ ...prev, rooms: isSelected ? prev.rooms.filter(id => id !== r.room_id) : [...prev.rooms, r.room_id] })); }}>
                      <div className="bm-room-check">{isSelected ? '✓' : ''}</div>
                      <div className="bm-room-id">{r.room_id}</div>
                      <span className="bm-room-type-label">{r.room_type === 'Laboratory' ? 'Lab' : r.room_type}</span>
                      <span className="bm-room-type-label">Cap: {r.room_capacity}</span>
                      {!isDisabled && <button type="button" className="bm-vacancy-btn" onClick={e => { e.stopPropagation(); setOccupancyModal({ visible: true, roomId: r.room_id }); }}>Vacancy</button>}
                    </div>
                  );
                })}
                {filteredAndSortedRooms.length === 0 && <div className="bm-grid-empty">No available rooms for this room type.</div>}
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
            <div className="bm-modal-header"><h3>Room Occupancy</h3><p>{occupancyModal.roomId}</p></div>
            <div className="bm-modal-body">
              <div className="bm-timeslots"><RoomTimeslotsInline roomId={occupancyModal.roomId} /></div>
            </div>
            <div className="bm-modal-footer">
              <button type="button" className="bm-btn" onClick={() => setOccupancyModal({ visible: false, roomId: null })}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ════ MANAGE MODALITIES MODAL ════ */}
      {showDeleteConfirm && (
        <div className="bm-modal-overlay" onClick={() => { setShowDeleteConfirm(false); setEditingModality(null); setSelectedForDelete([]); }}>
          <div className="bm-modal bm-manage-modal" onClick={e => e.stopPropagation()}>
            <div className="bm-modal-header">
              <h3>Manage Modalities</h3>
              <p>
                {bayanihanLeaderStatuses.length > 0
                  ? `${userModalities.length} of your modalities · ${bayanihanLeaderStatuses.length} Bayanihan Leader(s)`
                  : `${userModalities.length} modality/modalities on record`}
              </p>
            </div>

            <div className="bm-modal-body" style={{ paddingTop: '12px' }}>

              {/* Scheduler tabs */}
              {bayanihanLeaderStatuses.length > 0 && (
                <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
                  <button
                    type="button"
                    className={`notif-filter-tab ${activeTab === 'submit' ? 'active' : ''}`}
                    onClick={() => setActiveTab('submit')}
                    style={{ padding: '6px 16px', borderRadius: '6px', border: '1px solid var(--bm-border)', background: activeTab === 'submit' ? '#092c4c' : '#0d4993', color: activeTab === 'submit' ? '#fff' : 'inherit', cursor: 'pointer', fontSize: '13px' }}
                  >
                    My Modalities ({userModalities.length})
                  </button>
                  <button
                    type="button"
                    className={`notif-filter-tab ${activeTab === 'manage' ? 'active' : ''}`}
                    onClick={() => setActiveTab('manage')}
                    style={{ padding: '6px 16px', borderRadius: '6px', border: '1px solid var(--bm-border)', background: activeTab === 'manage' ? '#092c4c' : '#0d4993', color: activeTab === 'manage' ? '#fff' : 'inherit', cursor: 'pointer', fontSize: '13px' }}
                  >
                    All Bayanihan Leaders ({bayanihanLeaderStatuses.length})
                  </button>
                </div>
              )}

              {/* ── TAB: Bayanihan Leaders ── */}
              {activeTab === 'manage' && bayanihanLeaderStatuses.length > 0 ? (
                loadingLeaders ? (
                  <div className="notif-loading"><div className="notif-spinner" /> Loading leaders…</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {Object.entries(leadersByDepartment).map(([deptId, { dept_name, leaders }]) => (
                      <div key={deptId} style={{ borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--bm-border)' }}>
                        {/* Department Header */}
                        <div style={{ padding: '12px 14px', background: 'var(--bm-brand)', borderBottom: '1px solid var(--bm-border)' }}>
                          <div style={{ fontWeight: 700, fontSize: '14px', color: '#ffffff' }}>
                            {dept_name} <span style={{ opacity: 0.7, fontSize: '12px' }}>({deptId})</span>
                          </div>
                          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.65)', marginTop: '2px' }}>
                            {leaders.length} leader(s)
                          </div>
                        </div>

                        {/* Leaders */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0', background: 'var(--bm-surface)' }}>
                          {leaders.length > 0 ? (
                            leaders.map((leader, idx) => {
                              const isExpanded = expandedLeaders.has(leader.user_id);
                              return (
                                <div
                                  key={leader.user_id}
                                  style={{ borderTop: idx > 0 ? '1px solid var(--bm-border)' : 'none' }}
                                >
                                  {/* Leader Row — clickable header */}
                                  <div
                                    onClick={() => toggleLeader(leader.user_id)}
                                    style={{
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'center',
                                      padding: '12px 14px',
                                      cursor: 'pointer',
                                      background: isExpanded ? 'var(--bm-accent-soft)' : 'var(--bm-surface)',
                                      transition: 'background 0.15s',
                                      userSelect: 'none',
                                    }}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                      <div style={{
                                        width: '36px', height: '36px', borderRadius: '50%',
                                        background: 'var(--bm-brand)', display: 'flex',
                                        alignItems: 'center', justifyContent: 'center',
                                        color: '#fff', fontWeight: 700, fontSize: '13px', flexShrink: 0,
                                      }}>
                                        {leader.full_name.split(' ').slice(0, 2).map(n => n[0]?.toUpperCase()).join('')}
                                      </div>
                                      <div>
                                        <div style={{ fontWeight: 600, fontSize: '13.5px', color: 'var(--bm-text-primary)' }}>
                                          {leader.full_name}
                                        </div>
                                        <div style={{ fontSize: '12px', color: 'var(--bm-text-muted)' }}>
                                          ID: {leader.user_id}
                                        </div>
                                      </div>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                      <span style={{
                                        padding: '3px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 600,
                                        background: leader.submitted_count > 0 ? '#d1fae5' : '#fef3c7',
                                        color: leader.submitted_count > 0 ? '#065f46' : '#92400e',
                                        border: `1px solid ${leader.submitted_count > 0 ? '#6ee7b7' : '#fcd34d'}`,
                                        whiteSpace: 'nowrap',
                                      }}>
                                        {leader.submitted_count > 0 ? `${leader.submitted_count} submitted` : 'No submission'}
                                      </span>
                                      {/* Chevron */}
                                      <svg
                                        width="16" height="16" viewBox="0 0 24 24" fill="none"
                                        stroke="var(--bm-text-muted)" strokeWidth="2.5"
                                        strokeLinecap="round" strokeLinejoin="round"
                                        style={{ transition: 'transform 0.2s', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', flexShrink: 0 }}
                                      >
                                        <polyline points="6 9 12 15 18 9" />
                                      </svg>
                                    </div>
                                  </div>

                                  {/* Expanded Modalities */}
                                  {isExpanded && (
                                    <div style={{ padding: '0 14px 14px 14px', background: 'var(--bm-surface-2)', borderTop: '1px solid var(--bm-border)' }}>
                                      {leader.modalities.length === 0 ? (
                                        <div style={{ padding: '16px 0', textAlign: 'center', color: 'var(--bm-text-muted)', fontSize: '13px' }}>
                                          No modalities submitted yet.
                                        </div>
                                      ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '12px' }}>
                                          {leader.modalities.map((modality: any) => {
                                            const course = courseOptions.find(c => c.course_id === modality.course_id);
                                            const program = programOptions.find(p => p.program_id === modality.program_id);
                                            const isEditing = editingModality?.modality_id === modality.modality_id;

                                            if (isEditing && editingModality) {
                                              return (
                                                <div key={modality.modality_id} className="bm-modality-row bm-modality-row--editing">
                                                  <div className="bm-edit-form">
                                                    <div className="bm-edit-form-header">
                                                      <span className="bm-edit-label">Editing Modality #{modality.modality_id}</span>
                                                      <button type="button" className="bm-edit-cancel-x" onClick={cancelEditing} title="Cancel"><FaTimes /></button>
                                                    </div>
                                                    <div className="bm-edit-grid">
                                                      <div className="bm-edit-field">
                                                        <label>Modality Type</label>
                                                        <Select
                                                          options={[
                                                            { value: 'Hands-on (Laboratory)', label: 'Hands-on (Laboratory)' },
                                                            { value: 'Written (Lecture)', label: 'Written (Lecture)' },
                                                            { value: 'Written (Laboratory)', label: 'Written (Laboratory)' },
                                                          ]}
                                                          value={{ value: editingModality.modality_type, label: editingModality.modality_type }}
                                                          onChange={s => {
                                                            const newType = s?.value || '';
                                                            const newRoomType = modalityRoomTypeMap[newType] || '';
                                                            setEditingModality(prev => prev ? { ...prev, modality_type: newType, room_type: newRoomType } : prev);
                                                          }}
                                                          menuPortalTarget={document.body}
                                                          styles={{ ...selectStyles, menuPortal: (base: any) => ({ ...base, zIndex: 999999 }) }}
                                                        />
                                                      </div>
                                                      <div className="bm-edit-field">
                                                        <label>Room Type</label>
                                                        <input type="text" className="bm-edit-input bm-edit-input--readonly" value={editingModality.room_type} readOnly />
                                                      </div>
                                                      <div className="bm-edit-field bm-edit-full-width">
                                                        <label>Sections</label>
                                                        <Select
                                                          isMulti closeMenuOnSelect={false}
                                                          options={editSectionOptions}
                                                          value={editingModality.sections.map(s => ({ value: s, label: s }))}
                                                          onChange={opts => setEditingModality(prev => prev ? { ...prev, sections: opts ? opts.map(o => o.value) : [] } : prev)}
                                                          menuPortalTarget={document.body}
                                                          styles={{ ...selectStyles, menuPortal: (base: any) => ({ ...base, zIndex: 999999 }), multiValue: (base: any) => ({ ...base, backgroundColor: '#0d4993', borderRadius: '6px' }), multiValueLabel: (base: any) => ({ ...base, color: '#fff', fontWeight: 600, fontSize: '11px' }) }}
                                                        />
                                                      </div>
                                                      <div className="bm-edit-field bm-edit-full-width">
                                                        <label>Rooms</label>
                                                        <Select
                                                          isMulti
                                                          options={editRoomOptions.map(r => ({ value: r.room_id, label: `${r.room_id} (Cap: ${r.room_capacity})` }))}
                                                          value={editingModality.possible_rooms.map(r => ({ value: r, label: r }))}
                                                          onChange={opts => setEditingModality(prev => prev ? { ...prev, possible_rooms: opts ? opts.map(o => o.value) : [] } : prev)}
                                                          menuPortalTarget={document.body}
                                                          styles={{ ...selectStyles, menuPortal: (base: any) => ({ ...base, zIndex: 999999 }), multiValue: (base: any) => ({ ...base, backgroundColor: '#0d4993', borderRadius: '6px' }), multiValueLabel: (base: any) => ({ ...base, color: '#fff', fontWeight: 600, fontSize: '11px' }) }}
                                                          placeholder="Select rooms…"
                                                        />
                                                      </div>
                                                      <div className="bm-edit-field bm-edit-full-width">
                                                        <label>Remarks</label>
                                                        <textarea
                                                          className="bm-edit-textarea"
                                                          value={editingModality.modality_remarks}
                                                          onChange={e => setEditingModality(prev => prev ? { ...prev, modality_remarks: e.target.value } : prev)}
                                                          placeholder="Optional remarks…"
                                                          rows={2}
                                                        />
                                                      </div>
                                                    </div>
                                                    <div className="bm-edit-actions">
                                                      <button type="button" className="bm-btn" onClick={cancelEditing} disabled={isSavingEdit}><FaTimes style={{ fontSize: '11px' }} /> Cancel</button>
                                                      <button type="button" className="bm-btn primary" onClick={saveEditing} disabled={isSavingEdit}><FaSave style={{ fontSize: '11px' }} />{isSavingEdit ? 'Saving…' : 'Save Changes'}</button>
                                                    </div>
                                                  </div>
                                                </div>
                                              );
                                            }

                                            return (
                                              <div key={modality.modality_id} className="bm-modality-row" style={{ cursor: 'default', background: 'var(--bm-surface)' }}>
                                                <div className="bm-modality-info">
                                                  <div className="bm-modality-title">
                                                    <span className="bm-type-badge">{modality.modality_type}</span>
                                                    <span className="bm-type-badge lab">{modality.room_type}</span>
                                                  </div>
                                                  <div className="bm-modality-meta">
                                                    <span><strong>Course:</strong> {course?.course_id ?? 'N/A'} – {course?.course_name ?? 'Unknown'}</span>
                                                    <span><strong>Program:</strong> {program?.program_id ?? 'N/A'} – {program?.program_name ?? 'Unknown'}</span>
                                                    <span><strong>Sections:</strong> {Array.isArray(modality.sections) ? modality.sections.join(', ') : modality.sections}</span>
                                                    {modality.possible_rooms?.length > 0 && <span><strong>Rooms:</strong> {modality.possible_rooms.join(', ')}</span>}
                                                    {modality.modality_remarks && <span><strong>Remarks:</strong> {modality.modality_remarks}</span>}
                                                  </div>
                                                </div>
                                                <button
                                                  type="button"
                                                  className="bm-btn bm-edit-btn"
                                                  onClick={e => { e.stopPropagation(); startEditing(modality); }}
                                                  title="Edit this modality"
                                                >
                                                  <FaEdit style={{ fontSize: '12px' }} /> Edit
                                                </button>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })
                          ) : (
                            <div style={{ padding: '12px 14px', textAlign: 'center', color: 'var(--bm-text-muted)', fontSize: '13px' }}>
                              No bayanihan leaders in this department
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                /* ── TAB: My Modalities (original content) ── */
                <>
                  <div className="bm-manage-search">
                    <FaSearch className="bm-manage-search-icon" />
                    <input type="text" className="bm-manage-search-input" placeholder="Search by course, program, modality, section…" value={manageSearch} onChange={e => setManageSearch(e.target.value)} />
                    {manageSearch && (<button className="bm-manage-search-clear" onClick={() => setManageSearch('')} type="button">✕</button>)}
                  </div>

                  {userModalities.length === 0 ? (
                    <div className="bm-grid-empty">You haven't created any modalities yet.</div>
                  ) : filteredModalities.length === 0 ? (
                    <div className="bm-grid-empty">No results for "{manageSearch}"</div>
                  ) : (
                    <>
                      <div className="bm-delete-controls">
                        <label className="bm-select-all-label">
                          <input type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAll} />
                          <strong>Select All ({filteredModalities.length})</strong>
                        </label>
                        <span className="bm-hint">{selectedForDelete.length} selected</span>
                      </div>
                      <div className="bm-modality-list">
                        {filteredModalities.map(modality => {
                          const course = courseOptions.find(c => c.course_id === modality.course_id);
                          const program = programOptions.find(p => p.program_id === modality.program_id);
                          const isSelected = selectedForDelete.includes(modality.modality_id);
                          const isEditing = editingModality?.modality_id === modality.modality_id;

                          if (isEditing && editingModality) {
                            return (
                              <div key={modality.modality_id} className="bm-modality-row bm-modality-row--editing">
                                <div className="bm-edit-form">
                                  <div className="bm-edit-form-header">
                                    <span className="bm-edit-label">Editing Modality #{modality.modality_id}</span>
                                    <button type="button" className="bm-edit-cancel-x" onClick={cancelEditing} title="Cancel"><FaTimes /></button>
                                  </div>
                                  <div className="bm-edit-grid">
                                    <div className="bm-edit-field">
                                      <label>Modality Type</label>
                                      <Select
                                        options={[{ value: 'Hands-on (Laboratory)', label: 'Hands-on (Laboratory)' }, { value: 'Written (Lecture)', label: 'Written (Lecture)' }, { value: 'Written (Laboratory)', label: 'Written (Laboratory)' }]}
                                        value={{ value: editingModality.modality_type, label: editingModality.modality_type }}
                                        onChange={s => {
                                          const newType = s?.value || '';
                                          const newRoomType = modalityRoomTypeMap[newType] || '';
                                          setEditingModality(prev => prev ? { ...prev, modality_type: newType, room_type: newRoomType } : prev);
                                        }}
                                        menuPortalTarget={document.body}
                                        styles={{ ...selectStyles, menuPortal: (base: any) => ({ ...base, zIndex: 999999 }) }}
                                      />
                                    </div>
                                    <div className="bm-edit-field">
                                      <label>Room Type</label>
                                      <input type="text" className="bm-edit-input bm-edit-input--readonly" value={editingModality.room_type} readOnly />
                                    </div>
                                    <div className="bm-edit-field bm-edit-full-width">
                                      <label>Sections</label>
                                      <Select
                                        isMulti closeMenuOnSelect={false}
                                        options={editSectionOptions}
                                        value={editingModality.sections.map(s => ({ value: s, label: s }))}
                                        onChange={opts => setEditingModality(prev => prev ? { ...prev, sections: opts ? opts.map(o => o.value) : [] } : prev)}
                                        menuPortalTarget={document.body}
                                        styles={{ ...selectStyles, menuPortal: (base: any) => ({ ...base, zIndex: 999999 }), multiValue: (base: any) => ({ ...base, backgroundColor: '#0d4993', borderRadius: '6px' }), multiValueLabel: (base: any) => ({ ...base, color: '#fff', fontWeight: 600, fontSize: '11px' }) }}
                                      />
                                    </div>
                                    <div className="bm-edit-field bm-edit-full-width">
                                      <label>Rooms</label>
                                      <Select
                                        isMulti
                                        options={editRoomOptions.map(r => ({ value: r.room_id, label: `${r.room_id} (Cap: ${r.room_capacity})` }))}
                                        value={editingModality.possible_rooms.map(r => ({ value: r, label: r }))}
                                        onChange={opts => setEditingModality(prev => prev ? { ...prev, possible_rooms: opts ? opts.map(o => o.value) : [] } : prev)}
                                        menuPortalTarget={document.body}
                                        styles={{ ...selectStyles, menuPortal: (base: any) => ({ ...base, zIndex: 999999 }), multiValue: (base: any) => ({ ...base, backgroundColor: '#0d4993', borderRadius: '6px' }), multiValueLabel: (base: any) => ({ ...base, color: '#fff', fontWeight: 600, fontSize: '11px' }) }}
                                        placeholder="Select rooms…"
                                      />
                                    </div>
                                    <div className="bm-edit-field bm-edit-full-width">
                                      <label>Remarks</label>
                                      <textarea className="bm-edit-textarea" value={editingModality.modality_remarks} onChange={e => setEditingModality(prev => prev ? { ...prev, modality_remarks: e.target.value } : prev)} placeholder="Optional remarks…" rows={2} />
                                    </div>
                                  </div>
                                  <div className="bm-edit-actions">
                                    <button type="button" className="bm-btn" onClick={cancelEditing} disabled={isSavingEdit}><FaTimes style={{ fontSize: '11px' }} /> Cancel</button>
                                    <button type="button" className="bm-btn primary" onClick={saveEditing} disabled={isSavingEdit}><FaSave style={{ fontSize: '11px' }} />{isSavingEdit ? 'Saving…' : 'Save Changes'}</button>
                                  </div>
                                </div>
                              </div>
                            );
                          }

                          return (
                            <div key={modality.modality_id} className={`bm-modality-row${isSelected ? ' selected' : ''}`} onClick={() => toggleSelectModality(modality.modality_id)}>
                              <input type="checkbox" checked={isSelected} onChange={() => toggleSelectModality(modality.modality_id)} onClick={e => e.stopPropagation()} style={{ flexShrink: 0, marginTop: '2px' }} />
                              <div className="bm-modality-info">
                                <div className="bm-modality-title">
                                  <span className="bm-type-badge">{modality.modality_type}</span>
                                  <span className="bm-type-badge lab">{modality.room_type}</span>
                                </div>
                                <div className="bm-modality-meta">
                                  <span><strong>Course:</strong> {course?.course_id ?? 'N/A'} – {course?.course_name ?? 'Unknown'}</span>
                                  <span><strong>Program:</strong> {program?.program_id ?? 'N/A'} – {program?.program_name ?? 'Unknown'}</span>
                                  <span><strong>Sections:</strong> {Array.isArray(modality.sections) ? modality.sections.join(', ') : modality.sections}</span>
                                  {modality.possible_rooms?.length > 0 && <span><strong>Rooms:</strong> {modality.possible_rooms.join(', ')}</span>}
                                  {modality.modality_remarks && <span><strong>Remarks:</strong> {modality.modality_remarks}</span>}
                                </div>
                              </div>
                              <button type="button" className="bm-btn bm-edit-btn" onClick={e => { e.stopPropagation(); startEditing(modality); }} title="Edit this modality">
                                <FaEdit style={{ fontSize: '12px' }} /> Edit
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </>
              )}
            </div>

            <div className="bm-modal-footer">
              <button type="button" className="bm-btn" onClick={() => { setShowDeleteConfirm(false); setEditingModality(null); setSelectedForDelete([]); }} disabled={isDeleting}>Close</button>
              {activeTab !== 'manage' && (
                <>
                  <button type="button" className="bm-btn danger" onClick={handleDeleteSelected} disabled={isDeleting || selectedForDelete.length === 0}>
                    {isDeleting ? 'Deleting…' : `Delete Selected (${selectedForDelete.length})`}
                  </button>
                  <button type="button" className="bm-btn danger-fill" onClick={handleDeleteAll} disabled={isDeleting || userModalities.length === 0}>
                    {isDeleting ? 'Deleting…' : 'Delete All'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ════ FINAL DELETE CONFIRM ════ */}
      {showFinalDeleteConfirm && (
        <div className="bm-modal-overlay" onClick={() => setShowFinalDeleteConfirm(false)}>
          <div className="bm-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="bm-modal-header"><h3>Confirm Deletion</h3></div>
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

      {/* ════ SUBMIT CONFIRMATION MODAL ════ */}
      {showSubmitConfirm && (
        <div className="bm-modal-overlay" onClick={() => setShowSubmitConfirm(false)}>
          <div className="bm-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '460px' }}>
            <div className="bm-modal-header">
              <h3>Before You Submit</h3>
            </div>
            <div className="bm-modal-body">

              {/* Warning banner */}
              <div style={{
                display: 'flex',
                gap: '12px',
                alignItems: 'flex-start',
                background: '#fffbeb',
                border: '1.5px solid #fcd34d',
                borderRadius: '10px',
                padding: '14px 16px',
                marginBottom: '16px',
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#b45309"
                  strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '1px' }}>
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '13px', color: '#92400e', marginBottom: '4px' }}>
                    Room Assignment Notice
                  </div>
                  <div style={{ fontSize: '12.5px', color: '#78350f', lineHeight: 1.65 }}>
                    The room(s) you selected are <strong>preferred suggestions only</strong> and are <strong>not guaranteed</strong>.
                    Final room assignments will be determined by the scheduler and may change based on availability,
                    capacity constraints, or scheduling conflicts.
                  </div>
                </div>
              </div>

              {/* Assignment summary */}
              <div style={{ marginBottom: '4px' }}>
                <div style={{
                  fontSize: '10.5px', fontWeight: 700, color: 'var(--bm-text-muted)',
                  textTransform: 'uppercase', letterSpacing: '0.8px',
                  fontFamily: 'var(--bm-mono)', marginBottom: '8px',
                }}>
                  Your Submission Summary
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {calculateRoomAssignments.map((assignment, idx) => {
                    const room = roomOptions.find(r => r.room_id === assignment.roomId);
                    return (
                      <div key={idx} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '9px 12px',
                        background: 'var(--bm-surface-2)',
                        border: '1.5px solid var(--bm-border)',
                        borderRadius: '8px',
                        gap: '10px',
                      }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--bm-text-primary)', fontFamily: 'var(--bm-mono)' }}>
                            Room {assignment.roomId}
                            {assignment.isNightClass && (
                              <span style={{
                                marginLeft: '6px', fontSize: '9px', padding: '1px 6px',
                                background: '#1a237e', color: '#fff', borderRadius: '10px',
                                fontWeight: 700, letterSpacing: '0.3px',
                              }}>Night</span>
                            )}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--bm-text-muted)', marginTop: '2px' }}>
                            {assignment.sections.join(', ')}
                          </div>
                        </div>
                        <div style={{
                          fontSize: '11px', fontFamily: 'var(--bm-mono)',
                          color: assignment.totalStudents > (room?.room_capacity || 999) ? 'var(--bm-danger)' : 'var(--bm-success)',
                          fontWeight: 600, flexShrink: 0,
                        }}>
                          {assignment.totalStudents} / {room?.room_capacity ?? '?'} students
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
            <div className="bm-modal-footer">
              <button
                type="button"
                className="bm-btn"
                onClick={() => setShowSubmitConfirm(false)}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="bm-btn primary"
                disabled={isSubmitting}
                onClick={async () => {
                  setShowSubmitConfirm(false);
                  await handleSubmit({ preventDefault: () => {} } as React.FormEvent);
                }}
              >
                {isSubmitting ? 'Submitting…' : 'Confirm & Submit'}
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