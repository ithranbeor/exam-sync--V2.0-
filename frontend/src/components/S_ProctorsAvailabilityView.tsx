import React, { useState, useEffect, useRef, useMemo } from 'react';
import '../styles/P_ProctorAvailability.css';
import '../styles/colleges.css';
import { FaExchangeAlt, FaCheckCircle, FaTimesCircle, FaUsers, FaClock, FaChevronLeft, FaChevronRight, FaEye, FaTrash, FaPenAlt, FaPlus, FaSearch, FaSort, FaChevronDown } from 'react-icons/fa';
import { api } from '../lib/apiClient.ts';
import { ToastContainer, toast } from 'react-toastify';
import Select, { components } from 'react-select';
import 'react-toastify/dist/ReactToastify.css';
import { useEscapeKey } from '../hooks/useEscapeKey.ts';

type ProctorSetAvailabilityProps = {
  user: {
    user_id: number;
    [key: string]: unknown;
  };
};

export const AvailabilityTimeSlot = {
  Morning: '7 AM - 1 PM (Morning)',
  Afternoon: '1 PM - 6 PM (Afternoon)',
  Evening: '6 PM - 9 PM (Evening)',
} as const;
export type AvailabilityTimeSlot = (typeof AvailabilityTimeSlot)[keyof typeof AvailabilityTimeSlot];

export const AvailabilityStatus = {
  Available: 'available',
  Unavailable: 'unavailable',
} as const;
export type AvailabilityStatus = (typeof AvailabilityStatus)[keyof typeof AvailabilityStatus];

interface Availability {
  availability_id: number;
  days: string[];
  time_slots: AvailabilityTimeSlot[];
  status: AvailabilityStatus;
  remarks: string | null;
  user_id: number;
  user_fullname?: string;
}

interface ChangeRequest {
  id: number;
  user_id: number;
  proctor_name?: string;
  days: string[];
  time_slots: string[];
  status: string;
  requested_status?: string;
  remarks?: string | null;
  created_at?: string;
  type?: string;
}

const SchedulerAvailability: React.FC<ProctorSetAvailabilityProps> = ({ user }) => {
  const [entries, setEntries] = useState<Availability[]>([]);
  const [selectedDate, setSelectedDate] = useState<string[]>([]);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<AvailabilityTimeSlot[]>([AvailabilityTimeSlot.Morning]);
  const [availabilityStatus, setAvailabilityStatus] = useState<AvailabilityStatus>(AvailabilityStatus.Available);
  const [remarks, setRemarks] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [instructors, setInstructors] = useState<any[]>([]);
  const [selectedInstructors, setSelectedInstructors] = useState<any[]>([]);
  const [selectedInstructorSingle, setSelectedInstructorSingle] = useState<any>(null);

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [allowedDates, setAllowedDates] = useState<string[]>([]);
  const [_hasSubmitted, setHasSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedRemarks, setSelectedRemarks] = useState('');
  const [showRemarksModal, setShowRemarksModal] = useState(false);
  const today = new Date();

  const [loading, setLoading] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState<number | 'all'>('all');
  const [showItemsPerPageDropdown, setShowItemsPerPageDropdown] = useState(false);
  const [customItemsPerPage, setCustomItemsPerPage] = useState<string>('');

  const [userCache, setUserCache] = useState<Map<number, any>>(new Map());
  const [selectedAvailabilityIds, setSelectedAvailabilityIds] = useState<Set<number>>(new Set());
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteCount, setDeleteCount] = useState(0);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [sortBy, setSortBy] = useState<string>('none');
  const [showSortDropdown, setShowSortDropdown] = useState(false);

  const [activeTab, setActiveTab] = useState<'availability' | 'change-requests'>('availability');
  const [changeRequests, setChangeRequests] = useState<ChangeRequest[]>([]);
  const [crLoading, setCrLoading] = useState(false);
  const [crFilter, setCrFilter] = useState<string>('all');
  const [crSearchTerm, setCrSearchTerm] = useState('');
  const [processingCrId, setProcessingCrId] = useState<number | null>(null);
  const [selectedCr, setSelectedCr] = useState<ChangeRequest | null>(null);
  const [showCrDetailModal, setShowCrDetailModal] = useState(false);
  const [schedulerCollegeId, setSchedulerCollegeId] = useState<number | null>(null);
  const [pendingCrCount, setPendingCrCount] = useState(0);

  const MultiValue = (props: any) => {
    if (props.data.value === 'all') return null;
    return <components.MultiValue {...props} />;
  };

  useEscapeKey(() => {
    if (showModal) {
      setShowModal(false);
      setEditingId(null);
    }
  }, showModal);

  useEscapeKey(() => {
    if (showRemarksModal) {
      setShowRemarksModal(false);
      setSelectedRemarks('');
    }
  }, showRemarksModal);

  useEscapeKey(() => {
    if (showDeleteConfirm) {
      setShowDeleteConfirm(false);
    }
  }, showDeleteConfirm);

  useEffect(() => {
    Promise.all([
      fetchAllData(),
      fetchAllowedDates(),
      checkExistingSubmission()
    ]);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showSortDropdown && !target.closest('[data-sort-dropdown]')) {
        setShowSortDropdown(false);
      }
      if (showItemsPerPageDropdown && !target.closest('[data-items-per-page-dropdown]')) {
        setShowItemsPerPageDropdown(false);
      }
    };

    if (showSortDropdown || showItemsPerPageDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSortDropdown, showItemsPerPageDropdown]);

  const fetchAllData = async () => {
    if (!user?.user_id) return;
    setLoading(true);

    try {
      // 1. Get scheduler's college (1 request)
      const { data: schedulerRoles } = await api.get(`/tbl_user_role`, {
        params: { user_id: user.user_id, role_id: 3 }
      });

      const schedulerRole = Array.isArray(schedulerRoles)
        ? schedulerRoles.find((r: any) => r.role_id === 3 || r.role === 3)
        : schedulerRoles;

      const collegeId = schedulerRole?.college_id ?? schedulerRole?.college;
      if (!collegeId) {
        toast.error('Scheduler college not found');
        return;
      }

      // 2. Fetch availability + proctor roles in parallel (2 requests)
      const [availabilityRes, proctorRolesRes] = await Promise.all([
        api.get(`/tbl_availability/`, { params: { college_id: collegeId } }),
        api.get(`/tbl_user_role`, { params: { role_id: 5, college_id: collegeId } })  // ← add college filter to backend
      ]);

      const allAvailability: any[] = Array.isArray(availabilityRes.data) ? availabilityRes.data : [];
      const proctorRoles: any[] = Array.isArray(proctorRolesRes.data) ? proctorRolesRes.data : [];

      // 3. Collect all unique user IDs
      const proctorUserIds = [...new Set(proctorRoles.map((p: any) => p.user_id).filter(Boolean))];
      const availabilityUserIds = [...new Set(allAvailability.map((a: any) => a.user_id).filter(Boolean))];
      const allUserIds = [...new Set([...proctorUserIds, ...availabilityUserIds])];

      // 4. Bulk fetch all users in ONE request instead of N requests
      let userData: any[] = [];
      if (allUserIds.length > 0) {
        const { data } = await api.get(`/users/bulk/`, {
          params: { ids: allUserIds.join(',') }
        });
        userData = Array.isArray(data) ? data : [];
      }

      // 5. Build cache
      const newCache = new Map<number, any>();
      userData.forEach(u => newCache.set(u.user_id, u));
      setUserCache(newCache);

      // 6. Build instructor options
      const uniqueProctors = proctorRoles.reduce((acc: any[], cur: any) => {
        if (!acc.find(p => p.user_id === cur.user_id)) acc.push(cur);
        return acc;
      }, []);

      const instructorsList = uniqueProctors
        .map((p: any) => {
          const ud = newCache.get(p.user_id);
          if (!ud) return null;
          return {
            value: p.user_id,
            label: `${ud.first_name ?? ''} ${ud.last_name ?? ''}`.trim(),
          };
        })
        .filter(Boolean);

      setInstructors(instructorsList);

      // 7. Map availability entries
      const regularAvailability = allAvailability.filter(
        (e: any) => !e.type || e.type !== 'change_request'
      );

      const mapped = regularAvailability.map((entry: any) => {
        const ud = newCache.get(entry.user_id);
        return {
          availability_id: entry.availability_id,
          days: Array.isArray(entry.days) ? entry.days : [],
          time_slots: Array.isArray(entry.time_slots) ? entry.time_slots : [],
          status: entry.status,
          remarks: entry.remarks,
          user_id: entry.user_id,
          user_fullname: ud
            ? `${ud.first_name ?? ''} ${ud.last_name ?? ''}`.trim()
            : 'Unknown User',
        };
      });

      setEntries(mapped);
      setSchedulerCollegeId(collegeId);

    } catch (err) {
      console.error('Error fetching data:', err);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const checkExistingSubmission = async () => {
    if (!user.user_id) return;
    try {
      const { data } = await api.get(`/tbl_availability/`, {
        params: { user_id: user.user_id }
      });
      if (data && Array.isArray(data) && data.length > 0) {
        setHasSubmitted(true);
      }
    } catch (error) {
      console.error('Error checking existing submission:', error);
    }
  };

  const formatLocal = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const fetchAllowedDates = async () => {
    try {
      const { data: roles } = await api.get(`/tbl_user_role`, {
        params: { user_id: user.user_id }
      });

      const schedulerRole = Array.isArray(roles)
        ? roles.find((r: any) => r.role_id === 3 || r.role === 3)
        : roles;

      if (!schedulerRole) return;

      const collegeId = schedulerRole.college_id || schedulerRole.college;
      const { data: allPeriods } = await api.get(`/tbl_examperiod`);

      if (!Array.isArray(allPeriods)) {
        setAllowedDates([]);
        return;
      }

      const periods = allPeriods.filter(
        (period: any) => String(period.college_id) === String(collegeId)
      );

      const dates: string[] = [];
      periods.forEach((period: any) => {
        if (!period.start_date || !period.end_date) return;

        const start = new Date(period.start_date);
        const end = new Date(period.end_date);

        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          dates.push(formatLocal(new Date(d)));
        }
      });

      dates.sort();
      setAllowedDates(dates);

      const todayStr = formatLocal(new Date());
      setSelectedDate(dates.includes(todayStr) ? [todayStr] : []);

    } catch (error) {
      console.error('Error fetching allowed dates:', error);
      setAllowedDates([]);
    }
  };

  const daysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
  const firstDayOfMonth = (y: number, m: number) => new Date(y, m, 1).getDay();
  const getCalendarDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const numDays = daysInMonth(year, month);
    const startDay = firstDayOfMonth(year, month);
    const arr: (number | null)[] = [];
    for (let i = 0; i < startDay; i++) arr.push(null);
    for (let i = 1; i <= numDays; i++) arr.push(i);
    return arr;
  };

  const formatDateLocal = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const handleDateSelect = (day: number | null) => {
    if (!day) return;
    const localDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    const iso = formatDateLocal(localDate);
    if (allowedDates.length > 0 && !allowedDates.includes(iso)) return;

    setSelectedDate(prev => {
      if (prev.includes(iso)) return prev.filter(d => d !== iso);
      return [...prev, iso];
    });
  };

  const goToPreviousMonth = () =>
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  const goToNextMonth = () =>
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  const goToToday = () => {
    const isoToday = today.toISOString().split('T')[0];
    setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDate(allowedDates.includes(isoToday) ? [isoToday] : []);
  };

  const openAddModal = () => {
    setEditingId(null);
    setSelectedInstructors([]);
    setSelectedInstructorSingle(null);
    setRemarks('');
    setShowModal(true);
  };

  const openEditModal = (entry: Availability) => {
    setEditingId(entry.availability_id);
    setSelectedDate(entry.days);
    setSelectedTimeSlot(entry.time_slots);
    setAvailabilityStatus(entry.status);
    setRemarks(entry.remarks || '');
    setSelectedInstructorSingle(instructors.find((i) => i.value === entry.user_id) || null);
    setShowModal(true);
  };

  const handleSubmitAvailability = async () => {
    if (!selectedDate || selectedDate.length === 0) {
      toast.error('Select a valid date.');
      return;
    }
    setIsSubmitting(true);

    try {
      if (editingId) {
        await api.put(`/tbl_availability/${editingId}/`, {
          days: selectedDate,
          time_slots: selectedTimeSlot,
          status: availabilityStatus,
          remarks: remarks || null,
          user_id: selectedInstructorSingle?.value,
        });
        toast.success('Updated!');
      } else {
        if (selectedInstructors.length === 0) {
          toast.error('Select at least one instructor.');
          setIsSubmitting(false);
          return;
        }

        await Promise.all(
          selectedInstructors.map((inst) =>
            api.post('/tbl_availability/', {
              days: selectedDate,
              time_slots: selectedTimeSlot,
              status: availabilityStatus,
              remarks: remarks || null,
              user_id: inst.value,
            })
          )
        );
        toast.success('Availability submitted!');
      }

      setShowModal(false);
      fetchAllData();
    } catch (error: any) {
      toast.error(`Failed to process: ${error?.message || 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBulkDelete = () => {
    const ids = Array.from(selectedAvailabilityIds);
    if (ids.length === 0) {
      toast.info('No availability entries selected');
      return;
    }
    setDeleteCount(ids.length);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    const ids = Array.from(selectedAvailabilityIds);
    setShowDeleteConfirm(false);
    setIsBulkDeleting(true);
    try {
      const results = await Promise.allSettled(
        ids.map((id) => api.delete(`/tbl_availability/${id}/`))
      );
      const succeeded = results.filter((r) => r.status === 'fulfilled').length;
      const failed = results.length - succeeded;
      if (succeeded > 0) toast.success(`Deleted ${succeeded} availability entr${succeeded === 1 ? 'y' : 'ies'}`);
      if (failed > 0) toast.error(`${failed} entr${failed === 1 ? 'y' : 'ies'} failed to delete`);
      clearSelection();
      fetchAllData();
    } catch (err) {
      console.error(err);
      toast.error('Bulk delete failed');
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const instructorOptions = [{ label: 'Select All', value: 'all' }, ...instructors];
  const handleMultiChange = (selected: any) => {
    const allOption = selected?.find((s: any) => s.value === 'all');
    if (allOption) {
      setSelectedInstructors(instructors);
    } else {
      setSelectedInstructors(selected || []);
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedAvailabilityIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Resolve scheduler college
  useEffect(() => {
    const resolveCollege = async () => {
      if (!user?.user_id) return;
      try {
        const { data: roles } = await api.get(`/tbl_user_role`, { params: { user_id: user.user_id } });
        const schedulerRole = Array.isArray(roles)
          ? roles.find((r: any) => r.role_id === 3 || r.role === 3)
          : roles;
        const cid = schedulerRole?.college_id ?? schedulerRole?.college ?? null;
        setSchedulerCollegeId(cid);
      } catch (err) {
        console.error('Error resolving scheduler college:', err);
      }
    };
    resolveCollege();
  }, [user?.user_id]);

  // Fetch change requests when tab/filter changes
  useEffect(() => {
    if (schedulerCollegeId) fetchChangeRequests();
  }, [schedulerCollegeId, crFilter]);

  // Poll pending badge count every 10s
  useEffect(() => {
    if (!schedulerCollegeId) return;

    const poll = async () => {
      // Don't poll if tab is in background
      if (document.hidden) return;
      try {
        const { data } = await api.get(`/tbl_availability/`, {
          params: { college_id: schedulerCollegeId, status: 'pending', type: 'change_request' }
        });
        setPendingCrCount(Array.isArray(data) ? data.length : 0);
      } catch { /* silent */ }
    };

    poll();
    const interval = setInterval(poll, 60000); // ← 60s instead of 10s
    return () => clearInterval(interval);
  }, [schedulerCollegeId]);

  // Escape key for CR detail modal
  useEscapeKey(() => { if (showCrDetailModal) setShowCrDetailModal(false); }, showCrDetailModal);

  const fetchChangeRequests = async () => {
    if (!schedulerCollegeId) return;
    setCrLoading(true);
    try {
      const params: Record<string, any> = { college_id: schedulerCollegeId, type: 'change_request' };
      if (crFilter !== 'all') params.status = crFilter;
      const { data } = await api.get(`/tbl_availability/`, { params });
      if (!Array.isArray(data)) { setChangeRequests([]); return; }

      // Collect any user IDs NOT yet in cache
      const missingIds = [...new Set(
        data.map((item: any) => item.user_id).filter(
          (id: number) => id && !userCache.has(id)
        )
      )];

      // Bulk fetch missing users in ONE request
      if (missingIds.length > 0) {
        try {
          const { data: bulkUsers } = await api.get(`/users/bulk/`, {
            params: { ids: missingIds.join(',') }
          });
          if (Array.isArray(bulkUsers)) {
            setUserCache(prev => {
              const updated = new Map(prev);
              bulkUsers.forEach((u: any) => updated.set(u.user_id, u));
              return updated;
            });
            // Also update local reference for use below
            bulkUsers.forEach((u: any) => userCache.set(u.user_id, u));
          }
        } catch { /* silent */ }
      }

      const enriched: ChangeRequest[] = data.map((item: any) => {
        const cached = userCache.get(item.user_id);
        const proctor_name = cached
          ? `${cached.first_name ?? ''} ${cached.last_name ?? ''}`.trim()
          : `Proctor #${item.user_id}`;

        return {
          id: item.id ?? item.availability_id,
          user_id: item.user_id,
          proctor_name,
          days: Array.isArray(item.days) ? item.days : [],
          time_slots: Array.isArray(item.time_slots) ? item.time_slots : [],
          status: item.status ?? 'pending',
          requested_status: item.requested_status ?? null,
          remarks: item.remarks ?? null,
          created_at: item.created_at,
          type: item.type,
        };
      });

      setChangeRequests(enriched);
      if (crFilter === 'all') setPendingCrCount(enriched.filter(r => r.status === 'pending').length);
    } catch (err) {
      console.error('Error fetching change requests:', err);
      setChangeRequests([]);
    } finally {
      setCrLoading(false);
    }
  };

  const handleCrAction = async (crId: number, newStatus: 'approved' | 'rejected') => {
    setProcessingCrId(crId);
    try {
      const cr = changeRequests.find(r => r.id === crId);
      if (!cr) {
        toast.error('Change request not found.');
        return;
      }

      // Update the change request status itself
      await api.patch(`/tbl_availability/${crId}/`, { status: newStatus });

      // If approved, apply the requested_status to the proctor's actual availability entries
      if (newStatus === 'approved') {
        const targetStatus = cr.requested_status;
        if (!targetStatus) {
          toast.error('No requested status found on this change request.');
        } else {
          try {
            const { data: existingAvailability } = await api.get(`/tbl_availability/`, {
              params: { user_id: cr.user_id }
            });

            if (Array.isArray(existingAvailability) && existingAvailability.length > 0) {
              const matchingEntries = existingAvailability.filter((entry: any) => {
                const entryDays: string[] = Array.isArray(entry.days) ? entry.days : [];
                const entrySlots: string[] = Array.isArray(entry.time_slots) ? entry.time_slots : [];
                const daysMatch = cr.days.some(d => entryDays.includes(d));
                const slotsMatch = cr.time_slots.some(s => entrySlots.includes(s));
                return daysMatch && slotsMatch;
              });

              if (matchingEntries.length === 0) {
                toast.warn('No matching availability entries found to update.');
              } else {
                const updateResults = await Promise.allSettled(
                  matchingEntries.map((entry: any) =>
                    api.patch(`/tbl_availability/${entry.availability_id}/`, {
                      status: targetStatus,
                    })
                  )
                );
                const failed = updateResults.filter(r => r.status === 'rejected').length;
                if (failed > 0) {
                  toast.warn(`${failed} availability entr${failed === 1 ? 'y' : 'ies'} failed to update.`);
                }
              }
            } else {
              toast.warn('No availability entries found for this proctor.');
            }
          } catch (err) {
            console.error('Failed to apply availability change:', err);
            toast.error('Approved, but failed to update proctor availability.');
          }
        }
      }

      // Notify the proctor about the decision regardless of approve/reject
      if (cr.user_id) {
        try {
          const schedulerName = (user as any)?.full_name
            ?? `${(user as any)?.first_name ?? ''} ${(user as any)?.last_name ?? ''}`.trim()
            ?? 'Your scheduler';
          const dateLabels = cr.days
            .map(d => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }))
            .join(', ');
          const message = newStatus === 'approved'
            ? `Your availability change request for ${dateLabels} (${cr.time_slots.join(', ')}) has been approved by ${schedulerName}.`
            : `Your availability change request for ${dateLabels} (${cr.time_slots.join(', ')}) has been rejected by ${schedulerName}.`;

          await api.post(`/notifications/create/`, {
            user_id: cr.user_id,
            message,
            type: newStatus === 'approved' ? 'change_request_approved' : 'change_request_rejected',
            is_seen: false,
          });
        } catch (err) {
          console.error('Failed to notify proctor:', err);
        }
      }

      toast.success(`Request ${newStatus} successfully.`);

      setChangeRequests(prev =>
        prev.map(r => r.id === crId ? { ...r, status: newStatus } : r)
      );
      if (showCrDetailModal && selectedCr?.id === crId) {
        setSelectedCr(prev => prev ? { ...prev, status: newStatus } : null);
      }
      setPendingCrCount(prev => Math.max(0, prev - 1));

      // Refresh availability table to reflect applied changes
      fetchAllData();
    } catch (err: any) {
      toast.error(`Failed: ${err?.message ?? 'Unknown error'}`);
    } finally {
      setProcessingCrId(null);
    }
  };

  const filteredCr = useMemo(() => {
    return changeRequests.filter(r =>
      (r.proctor_name ?? '').toLowerCase().includes(crSearchTerm.toLowerCase())
    );
  }, [changeRequests, crSearchTerm]);

  const formatDate = (iso: string) => {
    try { return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
    catch { return iso; }
  };

  const crStatusStyle = (status: string): React.CSSProperties => {
    const colors: Record<string, string> = { pending: '#f59e0b', approved: '#10b981', rejected: '#ef4444' };
    return {
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600,
      color: '#fff', backgroundColor: colors[status.toLowerCase()] ?? '#6b7280',
      textTransform: 'capitalize',
    };
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, sortBy]);

  const isNumeric = (str: string): boolean => {
    return !isNaN(Number(str)) && !isNaN(parseFloat(str));
  };

  const smartSort = (a: string, b: string): number => {
    const aIsNumeric = isNumeric(a);
    const bIsNumeric = isNumeric(b);

    if (aIsNumeric && bIsNumeric) {
      return parseFloat(a) - parseFloat(b);
    } else if (aIsNumeric && !bIsNumeric) {
      return -1;
    } else if (!aIsNumeric && bIsNumeric) {
      return 1;
    } else {
      return a.localeCompare(b);
    }
  };

  const filteredEntries = useMemo(() => {
    let filtered = entries.filter((entry) =>
      (entry.user_fullname || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (sortBy !== 'none') {
      filtered = [...filtered].sort((a, b) => {
        if (sortBy === 'proctor_name') {
          const aName = (a.user_fullname || '').toLowerCase();
          const bName = (b.user_fullname || '').toLowerCase();
          return smartSort(aName, bName);
        } else if (sortBy === 'day') {
          const aDay = a.days && a.days.length > 0 ? new Date(a.days[0]).getTime() : 0;
          const bDay = b.days && b.days.length > 0 ? new Date(b.days[0]).getTime() : 0;
          return aDay - bDay;
        } else if (sortBy === 'time_slot') {
          const aSlot = a.time_slots && a.time_slots.length > 0 ? a.time_slots[0] : '';
          const bSlot = b.time_slots && b.time_slots.length > 0 ? b.time_slots[0] : '';
          return smartSort(aSlot.toLowerCase(), bSlot.toLowerCase());
        } else if (sortBy === 'status') {
          return smartSort(a.status.toLowerCase(), b.status.toLowerCase());
        } else if (sortBy === 'remarks') {
          const aRemarks = (a.remarks || '').toLowerCase();
          const bRemarks = (b.remarks || '').toLowerCase();
          return smartSort(aRemarks, bRemarks);
        }
        return 0;
      });
    }

    return filtered;
  }, [entries, searchTerm, sortBy]);

  const totalItems = filteredEntries.length;

  const effectiveItemsPerPage = useMemo(() => {
    if (totalItems === 0) return 1;

    if (itemsPerPage === 'all') {
      return 20;
    }

    return itemsPerPage;
  }, [itemsPerPage, totalItems]);

  const totalPages = useMemo(() => {
    if (totalItems === 0) return 1;
    return Math.max(1, Math.ceil(totalItems / effectiveItemsPerPage));
  }, [totalItems, effectiveItemsPerPage]);

  const paginatedEntries = useMemo(() => {
    if (totalItems === 0) return [];
    return filteredEntries.slice(
      (currentPage - 1) * effectiveItemsPerPage,
      currentPage * effectiveItemsPerPage,
    );
  }, [filteredEntries, currentPage, effectiveItemsPerPage, totalItems]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const isAllSelected = filteredEntries.length > 0 && filteredEntries.every((entry) => selectedAvailabilityIds.has(entry.availability_id));

  const toggleSelectAll = () => {
    setSelectedAvailabilityIds(() => {
      if (isAllSelected) {
        return new Set();
      }
      const all = new Set<number>();
      filteredEntries.forEach((entry) => all.add(entry.availability_id));
      return all;
    });
  };

  const clearSelection = () => setSelectedAvailabilityIds(new Set());

  const handleItemsPerPageChange = (value: number | 'all') => {
    setItemsPerPage(value);
    setShowItemsPerPageDropdown(false);
    setCurrentPage(1);
  };

  const handleCustomItemsPerPage = () => {
    const numValue = parseInt(customItemsPerPage, 10);
    if (!isNaN(numValue) && numValue > 0) {
      setItemsPerPage(numValue);
      setCustomItemsPerPage('');
      setShowItemsPerPageDropdown(false);
      setCurrentPage(1);
    } else {
      toast.error('Please enter a valid positive number.');
    }
  };

  useEffect(() => {
    const checkScroll = () => {
      const container = tableContainerRef.current;
      if (!container) return;

      const { scrollLeft, scrollWidth, clientWidth } = container;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1);

      container.classList.toggle('scrollable-left', scrollLeft > 0);
      container.classList.toggle('scrollable-right', scrollLeft < scrollWidth - clientWidth - 1);
    };

    const container = tableContainerRef.current;
    if (container) {
      checkScroll();
      container.addEventListener('scroll', checkScroll);
      window.addEventListener('resize', checkScroll);
    }

    return () => {
      if (container) {
        container.removeEventListener('scroll', checkScroll);
        window.removeEventListener('resize', checkScroll);
      }
    };
  }, [filteredEntries, loading]);

  const scrollTable = (direction: 'left' | 'right') => {
    const container = tableContainerRef.current;
    if (!container) return;

    const scrollAmount = container.clientWidth * 0.8;
    const scrollTo = direction === 'left'
      ? container.scrollLeft - scrollAmount
      : container.scrollLeft + scrollAmount;

    container.scrollTo({
      left: scrollTo,
      behavior: 'smooth'
    });
  };

  return (
    <div className="colleges-container">

      {/* ── Tab bar ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '2px solid #e5e7eb' }}>
        <button type="button" onClick={() => setActiveTab('availability')}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '10px 24px',
            fontWeight: 600, fontSize: 14, border: 'none',
            borderBottom: activeTab === 'availability' ? '3px solid #092C4C' : '3px solid transparent',
            background: 'none', color: activeTab === 'availability' ? '#092C4C' : '#6b7280',
            cursor: 'pointer', marginBottom: -2, transition: 'color 0.2s, border-color 0.2s',
          }}>
          <FaUsers size={13} /> Proctor Availability
        </button>

        <button type="button" onClick={() => { setActiveTab('change-requests'); fetchChangeRequests(); }}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '10px 24px',
            fontWeight: 700, fontSize: 14, border: 'none',
            borderBottom: activeTab === 'change-requests' ? '3px solid #092C4C' : '3px solid transparent',
            background: pendingCrCount > 0 && activeTab !== 'change-requests' ? 'linear-gradient(135deg,#fff7ed,#ffedd5)' : 'none',
            color: activeTab === 'change-requests' ? '#092C4C' : pendingCrCount > 0 ? '#c2410c' : '#6b7280',
            cursor: 'pointer', marginBottom: -2,
            borderRadius: pendingCrCount > 0 ? '8px 8px 0 0' : undefined,
            transition: 'all 0.2s',
          }}>
          <FaExchangeAlt size={13} />
          Change Requests
          {pendingCrCount > 0 && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              minWidth: 20, height: 20, padding: '0 6px', borderRadius: 10,
              backgroundColor: '#ef4444', color: '#fff', fontSize: 11, fontWeight: 700,
              animation: 'pulse 2s infinite',
            }}>
              {pendingCrCount}
            </span>
          )}
        </button>
        <style>{`@keyframes pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.12)} }`}</style>
      </div>

      {activeTab === 'availability' && (
        <>
          <div className="colleges-header">
            <div className="search-bar" style={{ marginLeft: 'auto' }}>
              <input
                type="text"
                placeholder="Search Proctor"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <button type="button" className="search-button"><FaSearch /></button>
            </div>
          </div>

          <div className="colleges-actions">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button type="button" className="action-button add-new with-label" onClick={openAddModal}>
                  <FaPlus /><span className="btn-label">Add</span>
                </button>
                <div style={{ position: 'relative' }} data-sort-dropdown>
                  <button
                    type='button'
                    className="action-button with-label sort-by-button"
                    onClick={() => setShowSortDropdown(!showSortDropdown)}
                    title="Sort by"
                  >
                    <FaSort />
                    <span className="btn-label">Sort by</span>
                  </button>
                  {showSortDropdown && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        marginTop: '4px',
                        backgroundColor: 'white',
                        border: '1px solid #ddd',
                        borderRadius: '8px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                        zIndex: 1000,
                        minWidth: '150px'
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setSortBy('none');
                          setShowSortDropdown(false);
                        }}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          textAlign: 'left',
                          border: 'none',
                          backgroundColor: sortBy === 'none' ? '#f0f0f0' : 'white',
                          color: '#000',
                          cursor: 'pointer',
                          fontSize: '14px'
                        }}
                        onMouseEnter={(e) => {
                          if (sortBy !== 'none') e.currentTarget.style.backgroundColor = '#f5f5f5';
                        }}
                        onMouseLeave={(e) => {
                          if (sortBy !== 'none') e.currentTarget.style.backgroundColor = 'white';
                        }}
                      >
                        None
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSortBy('proctor_name');
                          setShowSortDropdown(false);
                        }}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          textAlign: 'left',
                          border: 'none',
                          backgroundColor: sortBy === 'proctor_name' ? '#f0f0f0' : 'white',
                          color: '#000',
                          cursor: 'pointer',
                          fontSize: '14px',
                          borderTop: '1px solid #eee'
                        }}
                        onMouseEnter={(e) => {
                          if (sortBy !== 'proctor_name') e.currentTarget.style.backgroundColor = '#f5f5f5';
                        }}
                        onMouseLeave={(e) => {
                          if (sortBy !== 'proctor_name') e.currentTarget.style.backgroundColor = 'white';
                        }}
                      >
                        Proctor Name
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSortBy('day');
                          setShowSortDropdown(false);
                        }}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          textAlign: 'left',
                          border: 'none',
                          backgroundColor: sortBy === 'day' ? '#f0f0f0' : 'white',
                          color: '#000',
                          cursor: 'pointer',
                          fontSize: '14px',
                          borderTop: '1px solid #eee'
                        }}
                        onMouseEnter={(e) => {
                          if (sortBy !== 'day') e.currentTarget.style.backgroundColor = '#f5f5f5';
                        }}
                        onMouseLeave={(e) => {
                          if (sortBy !== 'day') e.currentTarget.style.backgroundColor = 'white';
                        }}
                      >
                        Day
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSortBy('time_slot');
                          setShowSortDropdown(false);
                        }}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          textAlign: 'left',
                          border: 'none',
                          backgroundColor: sortBy === 'time_slot' ? '#f0f0f0' : 'white',
                          color: '#000',
                          cursor: 'pointer',
                          fontSize: '14px',
                          borderTop: '1px solid #eee'
                        }}
                        onMouseEnter={(e) => {
                          if (sortBy !== 'time_slot') e.currentTarget.style.backgroundColor = '#f5f5f5';
                        }}
                        onMouseLeave={(e) => {
                          if (sortBy !== 'time_slot') e.currentTarget.style.backgroundColor = 'white';
                        }}
                      >
                        Time Slot
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSortBy('status');
                          setShowSortDropdown(false);
                        }}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          textAlign: 'left',
                          border: 'none',
                          backgroundColor: sortBy === 'status' ? '#f0f0f0' : 'white',
                          color: '#000',
                          cursor: 'pointer',
                          fontSize: '14px',
                          borderTop: '1px solid #eee'
                        }}
                        onMouseEnter={(e) => {
                          if (sortBy !== 'status') e.currentTarget.style.backgroundColor = '#f5f5f5';
                        }}
                        onMouseLeave={(e) => {
                          if (sortBy !== 'status') e.currentTarget.style.backgroundColor = 'white';
                        }}
                      >
                        Status
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSortBy('remarks');
                          setShowSortDropdown(false);
                        }}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          textAlign: 'left',
                          border: 'none',
                          backgroundColor: sortBy === 'remarks' ? '#f0f0f0' : 'white',
                          color: '#000',
                          cursor: 'pointer',
                          fontSize: '14px',
                          borderTop: '1px solid #eee'
                        }}
                        onMouseEnter={(e) => {
                          if (sortBy !== 'remarks') e.currentTarget.style.backgroundColor = '#f5f5f5';
                        }}
                        onMouseLeave={(e) => {
                          if (sortBy !== 'remarks') e.currentTarget.style.backgroundColor = 'white';
                        }}
                      >
                        Remarks
                      </button>
                    </div>
                  )}
                </div>
                <div style={{ position: 'relative' }} data-items-per-page-dropdown>
                  <button
                    type="button"
                    className="action-button with-label show-rows-button"
                    onClick={() => setShowItemsPerPageDropdown(!showItemsPerPageDropdown)}
                  >
                    <FaChevronDown size={12} />
                    <span className="btn-label">Show rows: {itemsPerPage === 'all' ? 'All' : itemsPerPage}</span>
                  </button>
                  {showItemsPerPageDropdown && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        marginTop: '4px',
                        backgroundColor: 'white',
                        border: '1px solid #ddd',
                        borderRadius: '8px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                        zIndex: 1000,
                        minWidth: '240px',
                        padding: '8px'
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => handleItemsPerPageChange(10)}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          textAlign: 'left',
                          border: 'none',
                          backgroundColor: itemsPerPage === 10 ? '#f0f0f0' : 'white',
                          color: '#000',
                          cursor: 'pointer',
                          fontSize: '14px',
                          borderRadius: '4px'
                        }}
                        onMouseEnter={(e) => {
                          if (itemsPerPage !== 10) e.currentTarget.style.backgroundColor = '#f5f5f5';
                        }}
                        onMouseLeave={(e) => {
                          if (itemsPerPage !== 10) e.currentTarget.style.backgroundColor = 'white';
                        }}
                      >
                        10
                      </button>
                      <button
                        type="button"
                        onClick={() => handleItemsPerPageChange(20)}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          textAlign: 'left',
                          border: 'none',
                          backgroundColor: itemsPerPage === 20 ? '#f0f0f0' : 'white',
                          color: '#000',
                          cursor: 'pointer',
                          fontSize: '14px',
                          borderRadius: '4px',
                          borderTop: '1px solid #eee'
                        }}
                        onMouseEnter={(e) => {
                          if (itemsPerPage !== 20) e.currentTarget.style.backgroundColor = '#f5f5f5';
                        }}
                        onMouseLeave={(e) => {
                          if (itemsPerPage !== 20) e.currentTarget.style.backgroundColor = 'white';
                        }}
                      >
                        20
                      </button>
                      <button
                        type="button"
                        onClick={() => handleItemsPerPageChange(30)}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          textAlign: 'left',
                          border: 'none',
                          backgroundColor: itemsPerPage === 30 ? '#f0f0f0' : 'white',
                          color: '#000',
                          cursor: 'pointer',
                          fontSize: '14px',
                          borderRadius: '4px',
                          borderTop: '1px solid #eee'
                        }}
                        onMouseEnter={(e) => {
                          if (itemsPerPage !== 30) e.currentTarget.style.backgroundColor = '#f5f5f5';
                        }}
                        onMouseLeave={(e) => {
                          if (itemsPerPage !== 30) e.currentTarget.style.backgroundColor = 'white';
                        }}
                      >
                        30
                      </button>
                      <div style={{ borderTop: '1px solid #eee', marginTop: '4px', paddingTop: '8px' }}>
                        <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
                          <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
                            <input
                              type="number"
                              data-custom-input
                              className="custom-number-input"
                              value={customItemsPerPage}
                              onChange={(e) => setCustomItemsPerPage(e.target.value)}
                              placeholder="Custom Number"
                              min="1"
                              style={{
                                width: '100%',
                                padding: '6px 32px 6px 8px',
                                border: '1px solid #0A3765',
                                borderRadius: '4px',
                                fontSize: '14px',
                                backgroundColor: '#ffffff',
                                color: '#333',
                                outline: 'none'
                              }}
                              onFocus={(e) => {
                                e.target.style.borderColor = '#0d4a7a';
                                e.target.style.boxShadow = '0 0 0 2px rgba(10, 55, 101, 0.1)';
                              }}
                              onBlur={(e) => {
                                e.target.style.borderColor = '#0A3765';
                                e.target.style.boxShadow = 'none';
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleCustomItemsPerPage();
                                }
                              }}
                            />
                            <div style={{ position: 'absolute', right: '2px', display: 'flex', flexDirection: 'column', height: 'calc(100% - 4px)', gap: '0px', justifyContent: 'center', alignItems: 'center' }}>
                              <button
                                type="button"
                                onClick={() => {
                                  const current = parseInt(customItemsPerPage) || 1;
                                  setCustomItemsPerPage(String(current + 1));
                                }}
                                style={{
                                  height: 'auto',
                                  background: 'transparent',
                                  border: 'none',
                                  color: '#0A3765',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '10px',
                                  fontWeight: 'bold',
                                  padding: '0',
                                  width: '16px',
                                  lineHeight: '1',
                                  transition: 'color 0.2s',
                                  borderRadius: '0',
                                  boxSizing: 'border-box'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.color = '#0d4a7a';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.color = '#0A3765';
                                }}
                              >
                                ^
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const current = parseInt(customItemsPerPage) || 1;
                                  if (current > 1) {
                                    setCustomItemsPerPage(String(current - 1));
                                  }
                                }}
                                style={{
                                  height: 'auto',
                                  background: 'transparent',
                                  border: 'none',
                                  color: '#0A3765',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '10px',
                                  fontWeight: 'bold',
                                  padding: '0',
                                  width: '16px',
                                  lineHeight: '1',
                                  transition: 'color 0.2s',
                                  borderRadius: '0',
                                  boxSizing: 'border-box'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.color = '#0d4a7a';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.color = '#0A3765';
                                }}
                              >
                                v
                              </button>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={handleCustomItemsPerPage}
                            style={{
                              padding: '6px 12px',
                              backgroundColor: '#0A3765',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '12px'
                            }}
                          >
                            Apply
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleItemsPerPageChange('all')}
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            textAlign: 'left',
                            border: 'none',
                            backgroundColor: itemsPerPage === 'all' ? '#f0f0f0' : 'white',
                            color: '#000',
                            cursor: 'pointer',
                            fontSize: '14px',
                            borderRadius: '4px',
                            marginTop: '4px'
                          }}
                          onMouseEnter={(e) => {
                            if (itemsPerPage !== 'all') e.currentTarget.style.backgroundColor = '#f5f5f5';
                          }}
                          onMouseLeave={(e) => {
                            if (itemsPerPage !== 'all') e.currentTarget.style.backgroundColor = 'white';
                          }}
                        >
                          Show All
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  type="button"
                  className="action-button delete"
                  onClick={handleBulkDelete}
                  disabled={isBulkDeleting || selectedAvailabilityIds.size === 0}
                  title={selectedAvailabilityIds.size > 0 ? `Delete ${selectedAvailabilityIds.size} selected` : 'Delete selected'}
                >
                  <FaTrash />
                </button>
              </div>
            </div>
          </div>

          <div className="pagination-controls">
            <button
              type="button"
              className="pagination-arrow-btn"
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage <= 1 || totalItems === 0}
            >
              {"<"}
            </button>
            <span className="pagination-page-number">
              {totalItems === 0 ? '0/0' : `${currentPage}/${totalPages}`}
            </span>
            <button
              type="button"
              className="pagination-arrow-btn"
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={currentPage >= totalPages || totalItems === 0}
            >
              {">"}
            </button>
          </div>

          <div className="table-scroll-wrapper">
            <div className="table-scroll-hint">
              <FaChevronLeft /> Swipe or use buttons to scroll <FaChevronRight />
            </div>
            <button
              type="button"
              className="table-scroll-buttons scroll-left"
              onClick={() => scrollTable('left')}
              disabled={!canScrollLeft}
              aria-label="Scroll left"
            >
              <FaChevronLeft />
            </button>
            <button
              type="button"
              className="table-scroll-buttons scroll-right"
              onClick={() => scrollTable('right')}
              disabled={!canScrollRight}
              aria-label="Scroll right"
            >
              <FaChevronRight />
            </button>
            <div className="colleges-table-container" ref={tableContainerRef}>
              <table className="colleges-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Proctor Name</th>
                    <th>Day</th>
                    <th>Time Slot</th>
                    <th>Status</th>
                    <th>Remarks</th>
                    <th>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span>Actions</span>
                        <input
                          type="checkbox"
                          checked={isAllSelected}
                          onChange={toggleSelectAll}
                          disabled={loading || filteredEntries.length === 0}
                          aria-label="Select all"
                          title="Select all"
                          style={{ marginLeft: 'auto' }}
                        />
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEntries.length === 0 && !isSubmitting ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '20px' }}>
                        {loading ? 'Loading availability...' : 'No availability found.'}
                      </td>
                    </tr>
                  ) : (
                    paginatedEntries.map((entry, idx) => {
                      const isSelected = selectedAvailabilityIds.has(entry.availability_id);
                      return (
                        <tr
                          key={entry.availability_id}
                          style={{
                            backgroundColor: isSelected ? '#ffcccc' : 'transparent',
                          }}
                        >
                          <td>{(currentPage - 1) * effectiveItemsPerPage + idx + 1}</td>
                          <td>{entry.user_fullname}</td>
                          <td>{entry.days?.map(d => new Date(d).toLocaleDateString()).join(', ')}</td>
                          <td>{entry.time_slots?.join(', ')}</td>
                          <td>
                            <span
                              style={{
                                padding: '4px 8px',
                                borderRadius: '999px',
                                color: 'white',
                                backgroundColor: entry.status === 'available' ? 'green' : 'red',
                                fontSize: '0.8rem',
                                textTransform: 'capitalize',
                              }}
                            >
                              {entry.status}
                            </span>
                          </td>
                          <td>
                            {entry.remarks ? (
                              <button
                                type="button"
                                className="icon-button view-button"
                                onClick={() => {
                                  setSelectedRemarks(entry.remarks!);
                                  setShowRemarksModal(true);
                                }}
                              >
                                <FaEye />
                              </button>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="action-buttons" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <button type="button" className="icon-button" onClick={() => openEditModal(entry)}>
                              <FaPenAlt style={{ color: "#092C4C" }} />
                            </button>
                            <input
                              type="checkbox"
                              checked={selectedAvailabilityIds.has(entry.availability_id)}
                              onChange={() => toggleSelect(entry.availability_id)}
                              aria-label={`Select ${entry.user_fullname}`}
                              style={{ marginLeft: 'auto' }}
                            />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {showModal && (
            <div className="modal-overlay">
              <div className="modal">
                <h3 style={{ textAlign: 'center' }}>{editingId ? 'Edit Availability' : 'Add Availability'}</h3>

                <div className="input-group">
                  <label>Days</label>
                  <input
                    type="text"
                    readOnly
                    value={selectedDate.length > 0 ? selectedDate.map(d => new Date(d).toLocaleDateString()).join(', ') : 'Select Date(s)'}
                    onClick={() => allowedDates.length > 0 && setShowDatePicker(!showDatePicker)}
                  />
                  {showDatePicker && (
                    <div className="date-picker">
                      <div className="date-picker-header">
                        <button type="button" onClick={goToPreviousMonth}>
                          <FaChevronLeft />
                        </button>
                        <span>{currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
                        <button type="button" onClick={goToNextMonth}>
                          <FaChevronRight />
                        </button>
                      </div>
                      <div className="date-picker-grid">
                        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                          <div key={i} className="day-name">{d}</div>
                        ))}
                        {getCalendarDays().map((day, index) => {
                          const isoDate = day
                            ? formatDateLocal(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day))
                            : '';
                          const isAllowed = allowedDates.includes(isoDate);
                          const isSelected = selectedDate.includes(isoDate);
                          return (
                            <div
                              key={index}
                              className={`calendar-day ${day ? 'selectable' : ''} ${isSelected ? 'selected' : ''} ${isAllowed ? 'allowed' : 'disabled'
                                }`}
                              onClick={() => isAllowed && handleDateSelect(day)}
                              style={{ pointerEvents: isAllowed ? 'auto' : 'none', opacity: isAllowed ? 1 : 0.3 }}
                            >
                              {day}
                            </div>
                          );
                        })}
                      </div>
                      <div className="date-picker-footer">
                        <button type="button" onClick={goToToday}>Now</button>
                        <button type="button" onClick={() => setShowDatePicker(false)}>Close</button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="input-group">
                  <label>Time Slot</label>
                  <Select
                    options={Object.values(AvailabilityTimeSlot).map(ts => ({ label: ts, value: ts }))}
                    value={selectedTimeSlot.map(ts => ({ label: ts, value: ts }))}
                    onChange={(selected: any) => setSelectedTimeSlot(selected.map((s: any) => s.value))}
                    isMulti
                    closeMenuOnSelect={false}
                    components={{ MultiValue }}
                    styles={{
                      valueContainer: (provided) => ({
                        ...provided,
                        maxHeight: "120px",
                        overflowY: "auto",
                      }),
                    }}
                  />
                </div>

                <div className="input-group">
                  <label>Remarks</label>
                  <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} />
                </div>

                {editingId ? (
                  <>
                    <div className="input-group">
                      <label>Status</label>
                      <Select
                        options={Object.values(AvailabilityStatus).map(s => ({
                          value: s,
                          label: s.charAt(0).toUpperCase() + s.slice(1),
                        }))}
                        value={{
                          value: availabilityStatus,
                          label: availabilityStatus.charAt(0).toUpperCase() + availabilityStatus.slice(1),
                        }}
                        onChange={(selected: any) => setAvailabilityStatus(selected?.value as AvailabilityStatus)}
                        isSearchable={false}
                      />
                    </div>
                    <div className="input-group">
                      <label>Instructor</label>
                      <Select
                        options={instructors}
                        value={selectedInstructorSingle}
                        onChange={(v) => setSelectedInstructorSingle(v)}
                      />
                    </div>
                  </>
                ) : (
                  <div className="input-group">
                    <label>Instructors (multi-select)</label>
                    <Select
                      options={instructorOptions}
                      value={selectedInstructors}
                      onChange={handleMultiChange}
                      isMulti
                      closeMenuOnSelect={false}
                      components={{ MultiValue }}
                      styles={{
                        valueContainer: (provided) => ({
                          ...provided,
                          maxHeight: "120px",
                          overflowY: "auto",
                        }),
                      }}
                    />
                  </div>
                )}

                <div className="modal-actions">
                  <button type="button" onClick={handleSubmitAvailability} disabled={isSubmitting}>
                    {isSubmitting ? 'Saving...' : 'Save'}
                  </button>
                  <button type="button" onClick={() => setShowModal(false)}>Cancel</button>
                </div>
              </div>
            </div>
          )}

          {showRemarksModal && (
            <div className="modal-overlay">
              <div className="modal">
                <h3>Remarks</h3>
                <div style={{ color: "#092C4C" }}>{selectedRemarks}</div>
                <div className="modal-actions">
                  <button type="button" onClick={() => setShowRemarksModal(false)}>Close</button>
                </div>
              </div>
            </div>
          )}

          {/* Delete Confirmation Modal */}
          {showDeleteConfirm && (
            <div className="modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
              <div className="modal delete-confirm-modal" onClick={(e) => e.stopPropagation()}>
                <h3>Are you sure to delete this Availability Entry?</h3>
                <p className="delete-confirm-message">
                  {deleteCount === 1
                    ? 'Delete this one availability entry'
                    : `Delete these ${deleteCount} availability entries`}
                </p>
                <div className="modal-actions">
                  <button
                    type="button"
                    className="modal-button confirm-delete"
                    onClick={confirmDelete}
                    disabled={isBulkDeleting}
                  >
                    {isBulkDeleting ? 'Deleting...' : 'Delete'}
                  </button>
                  <button
                    type="button"
                    className="modal-button cancel-delete"
                    onClick={() => setShowDeleteConfirm(false)}
                    disabled={isBulkDeleting}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === 'change-requests' && (
        <div>
          {/* Sub-toolbar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
            <div className="search-bar">
              <input type="text" placeholder="Search proctor name..." value={crSearchTerm} onChange={e => setCrSearchTerm(e.target.value)} />
              <button type="button" className="search-button"><FaSearch /></button>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {(['all', 'pending', 'approved', 'rejected'] as const).map(f => (
                <button key={f} type="button" onClick={() => setCrFilter(f)}
                  style={{
                    padding: '6px 14px', borderRadius: 20, border: '1.5px solid',
                    borderColor: crFilter === f ? '#092C4C' : '#d1d5db',
                    backgroundColor: crFilter === f ? '#092C4C' : 'white',
                    color: crFilter === f ? 'white' : '#374151',
                    fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                  }}>
                  {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
                  {f === 'pending' && pendingCrCount > 0 && (
                    <span style={{ marginLeft: 6, backgroundColor: '#ef4444', color: 'white', borderRadius: 10, padding: '1px 6px', fontSize: 11, fontWeight: 700 }}>
                      {pendingCrCount}
                    </span>
                  )}
                </button>
              ))}
              <button type="button" onClick={fetchChangeRequests}
                style={{ padding: '6px 14px', borderRadius: 20, border: '1.5px solid #d1d5db', backgroundColor: 'white', color: '#374151', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                ↻ Refresh
              </button>
            </div>
          </div>

          {/* Pending banner */}
          {pendingCrCount > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
              marginBottom: 16, borderRadius: 8, backgroundColor: '#fff7ed',
              border: '1.5px solid #fed7aa', color: '#c2410c', fontWeight: 600, fontSize: 14,
            }}>
              <FaClock size={16} />
              {pendingCrCount} proctor change request{pendingCrCount > 1 ? 's' : ''} awaiting your review
            </div>
          )}

          {crLoading && <div style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>Loading change requests...</div>}

          {!crLoading && filteredCr.length === 0 && (
            <div style={{ textAlign: 'center', padding: '50px 20px', color: '#9ca3af', border: '1px dashed #d1d5db', borderRadius: 10, fontSize: 14 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
              <p style={{ fontWeight: 600, color: '#092C4C', marginBottom: 6 }}>No change requests found</p>
              <p>Proctor change requests for your college will appear here.</p>
            </div>
          )}

          {!crLoading && filteredCr.map(req => (
            <div key={req.id}
              onClick={() => { setSelectedCr(req); setShowCrDetailModal(true); }}
              style={{
                background: '#fff',
                border: req.status === 'pending' ? '1.5px solid #fbbf24' : '1px solid #e5e7eb',
                borderLeft: req.status === 'pending' ? '4px solid #f59e0b' : req.status === 'approved' ? '4px solid #10b981' : '4px solid #ef4444',
                borderRadius: 10, padding: '14px 18px', marginBottom: 10, cursor: 'pointer',
                boxShadow: req.status === 'pending' ? '0 2px 8px rgba(245,158,11,0.10)' : '0 1px 4px rgba(0,0,0,0.06)',
                transition: 'box-shadow 0.2s',
              }}
              onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.10)')}
              onMouseLeave={e => (e.currentTarget.style.boxShadow = req.status === 'pending' ? '0 2px 8px rgba(245,158,11,0.10)' : '0 1px 4px rgba(0,0,0,0.06)')}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontWeight: 700, color: '#092C4C', fontSize: 15 }}>
                      {req.proctor_name || `Proctor #${req.user_id}`}
                    </span>
                    <span style={crStatusStyle(req.status)}>
                      {req.status === 'pending' && <FaClock size={10} />}
                      {req.status === 'approved' && <FaCheckCircle size={10} />}
                      {req.status === 'rejected' && <FaTimesCircle size={10} />}
                      {req.status}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: '#4b5563', display: 'flex', flexWrap: 'wrap', gap: '4px 16px' }}>
                    <span><strong>Days:</strong> {req.days.map(formatDate).join(', ')}</span>
                    <span><strong>Slots:</strong> {req.time_slots.join(', ')}</span>
                  </div>
                  {req.remarks && <div style={{ marginTop: 6, fontSize: 13, color: '#6b7280', fontStyle: 'italic' }}>"{req.remarks}"</div>}
                  {req.created_at && <div style={{ marginTop: 4, fontSize: 11, color: '#9ca3af' }}>Submitted: {new Date(req.created_at).toLocaleString('en-US')}</div>}
                </div>
                {req.status === 'pending' && (
                  <div style={{ display: 'flex', gap: 6 }} onClick={e => e.stopPropagation()}>
                    <button onClick={() => handleCrAction(req.id, 'approved')} disabled={processingCrId === req.id}
                      style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '7px 14px', borderRadius: 7, border: 'none', backgroundColor: '#10b981', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer', opacity: processingCrId === req.id ? 0.6 : 1 }}>
                      <FaCheckCircle size={12} /> Approve
                    </button>
                    <button onClick={() => handleCrAction(req.id, 'rejected')} disabled={processingCrId === req.id}
                      style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '7px 14px', borderRadius: 7, border: 'none', backgroundColor: '#ef4444', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer', opacity: processingCrId === req.id ? 0.6 : 1 }}>
                      <FaTimesCircle size={12} /> Reject
                    </button>
                  </div>
                )}
                {req.status !== 'pending' && <span style={crStatusStyle(req.status)}>{req.status}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CR Detail Modal — add before ToastContainer */}
      {showCrDetailModal && selectedCr && (
        <div className="modal-overlay" onClick={() => setShowCrDetailModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <h3 style={{ textAlign: 'center', color: '#092C4C', marginBottom: 16 }}>Change Request Details</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <tbody>
                {([
                  ['Proctor', selectedCr.proctor_name || `#${selectedCr.user_id}`],
                  ['Days', selectedCr.days.map(formatDate).join(', ')],
                  ['Time Slots', selectedCr.time_slots.join(', ')],
                  ['Requested Status', selectedCr.status],
                  ['Remarks', selectedCr.remarks || '—'],
                  ['Submitted', selectedCr.created_at ? new Date(selectedCr.created_at).toLocaleString('en-US') : '—'],
                ] as [string, string][]).map(([label, value]) => (
                  <tr key={label} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '8px 4px', fontWeight: 600, color: '#374151', width: '40%' }}>{label}</td>
                    <td style={{ padding: '8px 4px', color: '#4b5563' }}>
                      {label === 'Requested Status' ? <span style={crStatusStyle(value)}>{value}</span> : value}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {selectedCr.status === 'pending' && (
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 20 }}>
                <button onClick={() => handleCrAction(selectedCr.id, 'approved')} disabled={processingCrId === selectedCr.id}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '9px 24px', borderRadius: 8, border: 'none', backgroundColor: '#10b981', color: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer', opacity: processingCrId === selectedCr.id ? 0.6 : 1 }}>
                  <FaCheckCircle size={13} /> Approve
                </button>
                <button onClick={() => handleCrAction(selectedCr.id, 'rejected')} disabled={processingCrId === selectedCr.id}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '9px 24px', borderRadius: 8, border: 'none', backgroundColor: '#ef4444', color: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer', opacity: processingCrId === selectedCr.id ? 0.6 : 1 }}>
                  <FaTimesCircle size={13} /> Reject
                </button>
              </div>
            )}
            <div style={{ textAlign: 'center', marginTop: 14 }}>
              <button onClick={() => setShowCrDetailModal(false)}
                style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid #d1d5db', background: 'transparent', color: '#374151', cursor: 'pointer', fontSize: 13 }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer position="top-right" autoClose={3000} />
    </div>
  );
};

export default SchedulerAvailability;