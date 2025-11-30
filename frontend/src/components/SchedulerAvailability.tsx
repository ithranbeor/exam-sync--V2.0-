import React, { useState, useEffect, useRef, useMemo } from 'react';
import '../styles/proctorSetAvailability.css';
import '../styles/colleges.css';
import { FaChevronLeft, FaChevronRight, FaEye, FaTrash, FaPenAlt, FaPlus, FaSearch, FaSort } from 'react-icons/fa';
import { api } from '../lib/apiClient.ts';
import { ToastContainer, toast } from 'react-toastify';
import Select, { components } from 'react-select';
import 'react-toastify/dist/ReactToastify.css';

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
  const itemsPerPage = 20;

  const [userCache, setUserCache] = useState<Map<number, any>>(new Map());
  const [selectedAvailabilityIds, setSelectedAvailabilityIds] = useState<Set<number>>(new Set());
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [sortBy, setSortBy] = useState<string>('none');
  const [showSortDropdown, setShowSortDropdown] = useState(false);

  const MultiValue = (props: any) => {
    if (props.data.value === 'all') return null;
    return <components.MultiValue {...props} />;
  };

  useEffect(() => {
    // ✅ Load all data in parallel on mount
    Promise.all([
      fetchInstructorsAndAvailability(),
      fetchAllowedDates(),
      checkExistingSubmission()
    ]);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showSortDropdown && !target.closest('[data-sort-dropdown]')) {
        setShowSortDropdown(false);
      }
    };

    if (showSortDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSortDropdown]);

  // ✅ Combined function to fetch both instructors and availability in one go
  const fetchInstructorsAndAvailability = async () => {
    if (!user?.user_id) return;
    
    setLoading(true);
    try {
      // Fetch scheduler's college and all proctors in parallel
      const [schedulerRolesRes, proctorRolesRes] = await Promise.all([
        api.get(`/tbl_user_role`, { params: { user_id: user.user_id, role_id: 3 } }),
        api.get(`/tbl_user_role`, { params: { role_id: 5 } })
      ]);

      const schedulerRole = Array.isArray(schedulerRolesRes.data)
        ? schedulerRolesRes.data.find((r: any) => r.role_id === 3 || r.role === 3)
        : schedulerRolesRes.data;

      if (!schedulerRole?.college_id && !schedulerRole?.college) {
        toast.error('Failed to fetch scheduler info');
        return;
      }

      const schedulerCollegeId = schedulerRole.college_id || schedulerRole.college;
      const proctorRoles = proctorRolesRes.data;

      if (!proctorRoles || !Array.isArray(proctorRoles)) {
        toast.error('Failed to fetch proctors');
        return;
      }

      // Filter valid proctors matching the college
      const validProctorRoles = proctorRoles.filter(
        (p: any) => p.user_id != null && p.college_id === schedulerCollegeId
      );

      if (validProctorRoles.length === 0) {
        setInstructors([]);
        setEntries([]);
        return;
      }

      // Get unique user IDs
      const uniqueUserIds = [...new Set(validProctorRoles.map((p: any) => p.user_id))];

      // ✅ Fetch user data and availability for all proctors in parallel
      const [userDataResults, availabilityResults] = await Promise.all([
        // Fetch all user data
        Promise.all(
          uniqueUserIds.map(async (userId) => {
            try {
              const { data } = await api.get(`/users/${userId}/`);
              return { userId, data };
            } catch (err) {
              console.warn(`Failed to fetch user ${userId}`);
              return { userId, data: null };
            }
          })
        ),
        // Fetch all availability data
        Promise.all(
          uniqueUserIds.map(async (userId) => {
            try {
              const { data } = await api.get(`/tbl_availability/`, {
                params: { user_id: userId }
              });
              return Array.isArray(data) ? data : [];
            } catch (err) {
              console.warn(`Failed to fetch availability for user ${userId}`);
              return [];
            }
          })
        )
      ]);

      // ✅ Build user cache
      const newUserCache = new Map();
      userDataResults.forEach(({ userId, data }) => {
        if (data) {
          newUserCache.set(userId, data);
        }
      });
      setUserCache(newUserCache);

      // Build instructors list
      const instructorsList = validProctorRoles
        .reduce((acc: any[], current: any) => {
          const exists = acc.find(item => item.user_id === current.user_id);
          if (!exists) {
            acc.push(current);
          }
          return acc;
        }, [])
        .map((p: any) => {
          const userData = newUserCache.get(p.user_id);
          return {
            value: p.user_id,
            label: userData 
              ? `${userData.first_name || ''} ${userData.last_name || ''}`.trim()
              : `User ${p.user_id}`,
          };
        })
        .filter(i => i.label !== `User ${i.value}`); // Remove entries without valid user data

      setInstructors(instructorsList);

      // Process availability data
      const allAvailability = availabilityResults.flat();
      const validAvailability = allAvailability.filter((entry: any) => entry.user_id != null);

      // Map availability with cached user data (no additional API calls!)
      const mappedAvailability = validAvailability.map((entry: any) => {
        const userData = newUserCache.get(entry.user_id);
        return {
          availability_id: entry.availability_id,
          days: Array.isArray(entry.days) ? entry.days : [],
          time_slots: Array.isArray(entry.time_slots) ? entry.time_slots : [],
          status: entry.status,
          remarks: entry.remarks,
          user_id: entry.user_id,
          user_fullname: userData
            ? `${userData.first_name || ''} ${userData.last_name || ''}`.trim()
            : 'Unknown User',
        };
      });

      setEntries(mappedAvailability);

    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('An error occurred while fetching data');
    } finally {
      setLoading(false); // ✅ stop loading
    }
  };

  // ✅ Simplified refresh function
  const fetchAvailability = async () => {
    if (!user?.user_id) return;
    setLoading(true);
    try {
      const { data: schedulerRoles } = await api.get(`/tbl_user_role`, {
        params: { user_id: user.user_id, role_id: 3 }
      });

      const schedulerRole = Array.isArray(schedulerRoles)
        ? schedulerRoles.find((r: any) => r.role_id === 3 || r.role === 3)
        : schedulerRoles;

      if (!schedulerRole?.college_id) return;

      const schedulerCollegeId = schedulerRole.college_id;

      const { data: proctorRoles } = await api.get(`/tbl_user_role`, {
        params: { role_id: 5, college_id: schedulerCollegeId }
      });

      if (!proctorRoles || !Array.isArray(proctorRoles)) return;

      const validProctorRoles = proctorRoles.filter((p: any) => p.user_id != null);
      const uniqueUserIds = [...new Set(validProctorRoles.map((p: any) => p.user_id))];

      if (uniqueUserIds.length === 0) {
        setEntries([]);
        return;
      }

      const availabilityResults = await Promise.all(
        uniqueUserIds.map(async (userId) => {
          try {
            const { data } = await api.get(`/tbl_availability/`, {
              params: { user_id: userId }
            });
            return Array.isArray(data) ? data : [];
          } catch (err) {
            return [];
          }
        })
      );

      const allAvailability = availabilityResults.flat();
      const validAvailability = allAvailability.filter((entry: any) => entry.user_id != null);

      const mappedAvailability = validAvailability.map((entry: any) => {
        const userData = userCache.get(entry.user_id);
        return {
          availability_id: entry.availability_id,
          days: Array.isArray(entry.days) ? entry.days : [],
          time_slots: Array.isArray(entry.time_slots) ? entry.time_slots : [],
          status: entry.status,
          remarks: entry.remarks,
          user_id: entry.user_id,
          user_fullname: userData
            ? `${userData.first_name || ''} ${userData.last_name || ''}`.trim()
            : 'Unknown User',
        };
      });

      setEntries(mappedAvailability);
    } catch (error) {
      console.error('Error fetching availability:', error);
    } finally {
      setLoading(false); // ✅ stop loading
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
      periods?.forEach((period: any) => {
        if (!period.start_date || !period.end_date) return;
        const start = new Date(period.start_date);
        const end = new Date(period.end_date);
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          dates.push(new Date(d).toISOString().split('T')[0]);
        }
      });

      dates.sort();
      setAllowedDates(dates);
      const todayStr = today.toISOString().split('T')[0];
      setSelectedDate(dates.includes(todayStr) ? [todayStr] : []);
    } catch (error) {
      console.error('Error fetching allowed dates:', error);
      setAllowedDates([]);
    }
  };

  // Calendar helpers
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
      fetchAvailability(); // Async, doesn't block
    } catch (error: any) {
      console.error('API error:', error);
      toast.error(`Failed to process: ${error?.message || 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedAvailabilityIds);
    if (ids.length === 0) {
      toast.info('No availability entries selected');
      return;
    }
    const confirmDelete = window.confirm(`Delete ${ids.length} selected availability entr${ids.length === 1 ? 'y' : 'ies'}? This cannot be undone.`);
    if (!confirmDelete) return;
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
      fetchAvailability();
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

  // Bulk selection functions
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

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, sortBy]);

  // Helper function to determine if a string is numeric
  const isNumeric = (str: string): boolean => {
    return !isNaN(Number(str)) && !isNaN(parseFloat(str));
  };

  // Smart sort function that handles both text and numbers
  const smartSort = (a: string, b: string): number => {
    const aIsNumeric = isNumeric(a);
    const bIsNumeric = isNumeric(b);

    if (aIsNumeric && bIsNumeric) {
      // Both are numbers - sort numerically
      return parseFloat(a) - parseFloat(b);
    } else if (aIsNumeric && !bIsNumeric) {
      // a is number, b is text - numbers come first
      return -1;
    } else if (!aIsNumeric && bIsNumeric) {
      // a is text, b is number - numbers come first
      return 1;
    } else {
      // Both are text - sort alphabetically
      return a.localeCompare(b);
    }
  };

  const filteredEntries = useMemo(() => {
    let filtered = entries.filter((entry) =>
      (entry.user_fullname || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Apply sorting
    if (sortBy !== 'none') {
      filtered = [...filtered].sort((a, b) => {
        if (sortBy === 'proctor_name') {
          const aName = (a.user_fullname || '').toLowerCase();
          const bName = (b.user_fullname || '').toLowerCase();
          return smartSort(aName, bName);
        } else if (sortBy === 'day') {
          // Sort by first day in the days array
          const aDay = a.days && a.days.length > 0 ? new Date(a.days[0]).getTime() : 0;
          const bDay = b.days && b.days.length > 0 ? new Date(b.days[0]).getTime() : 0;
          return aDay - bDay;
        } else if (sortBy === 'time_slot') {
          // Sort by first time slot
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

  const paginatedEntries = useMemo(() => {
    return filteredEntries.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  }, [filteredEntries, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredEntries.length / itemsPerPage);

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

  // Handle scroll position and update button states
  useEffect(() => {
    const checkScroll = () => {
      const container = tableContainerRef.current;
      if (!container) return;

      const { scrollLeft, scrollWidth, clientWidth } = container;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1);
      
      // Update scroll indicator classes
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
            <button type="button" className="action-button add-new" onClick={openAddModal}>
              <FaPlus />
            </button>
            <div style={{ position: 'relative' }} data-sort-dropdown>
              <button 
                type='button' 
                className="action-button" 
                onClick={() => setShowSortDropdown(!showSortDropdown)}
                style={{ 
                  backgroundColor: sortBy !== 'none' ? '#0A3765' : '#0A3765',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  minWidth: '100px',
                  transition: 'background-color 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#0d4a7a';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#0A3765';
                }}
                title="Sort by"
              >
                <FaSort/>
                <span>Sort by</span>
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
        <button type='button'
          onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
          disabled={currentPage === 1}
          className="pagination-arrow-btn"
        >
          &lt;
        </button>
        <span className="pagination-page-number">{currentPage} of {totalPages}</span>
        <button type='button'
          onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
          disabled={currentPage === totalPages}
          className="pagination-arrow-btn"
        >
          &gt;
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
                paginatedEntries.map((entry, idx) => (
                    <tr key={entry.availability_id}>
                      <td>{(currentPage - 1) * itemsPerPage + idx + 1}</td>
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
                  ))
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
                          className={`calendar-day ${day ? 'selectable' : ''} ${isSelected ? 'selected' : ''} ${
                            isAllowed ? 'allowed' : 'disabled'
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
              <label>Status</label>
              <select
                value={availabilityStatus}
                onChange={(e) => setAvailabilityStatus(e.target.value as AvailabilityStatus)}
              >
                {Object.values(AvailabilityStatus).map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>

            <div className="input-group">
              <label>Remarks</label>
              <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} />
            </div>

            {editingId ? (
              <div className="input-group">
                <label>Instructor</label>
                <Select
                  options={instructors}
                  value={selectedInstructorSingle}
                  onChange={(v) => setSelectedInstructorSingle(v)}
                />
              </div>
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
            <div>{selectedRemarks}</div>
            <div className="modal-actions">
              <button type="button" onClick={() => setShowRemarksModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer position="top-right" autoClose={3000} />
    </div>
  );
};

export default SchedulerAvailability;