import React, { useState, useEffect } from 'react';
import '../styles/proctorSetAvailability.css';
import { FaChevronLeft, FaChevronRight, FaEye, FaTrash, FaPenAlt } from 'react-icons/fa';
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

enum AvailabilityTimeSlot {
  Morning = '7 AM - 1 PM (Morning)',
  Afternoon = '1 PM - 6 PM (Afternoon)',
  Evening = '6 PM - 9 PM (Evening)',
}

enum AvailabilityStatus {
  Available = 'available',
  Unavailable = 'unavailable',
}

interface Availability {
  availability_id: number;
  days: string[];                  // use 'days' instead of 'day'
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

  // instructor selection
  const [instructors, setInstructors] = useState<any[]>([]);
  const [selectedInstructors, setSelectedInstructors] = useState<any[]>([]); // for add
  const [selectedInstructorSingle, setSelectedInstructorSingle] = useState<any>(null); // for edit

  // calendar stuff (same as before)
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [allowedDates, setAllowedDates] = useState<string[]>([]);
  const [_hasSubmitted, setHasSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedRemarks, setSelectedRemarks] = useState('');
  const [showRemarksModal, setShowRemarksModal] = useState(false);
  const today = new Date();

  const MultiValue = (props: any) => {
    if (props.data.value === 'all') return null; // hide "Select All" pill
    return <components.MultiValue {...props} />;
  };

  useEffect(() => {
    fetchAvailability();
    fetchAllowedDates();
    checkExistingSubmission();
    fetchInstructors();
  }, []);

  const fetchInstructors = async () => {
    if (!user?.user_id) return;

    try {
      // 1. Get logged-in scheduler's college_id (role_id = 3)
      const { data: schedulerRoles, error: schedulerError } = await supabase
        .from('tbl_user_role')
        .select('college_id')
        .eq('user_id', user.user_id)
        .eq('role_id', 3)
        .single();

      if (schedulerError || !schedulerRoles?.college_id) {
        console.error('Failed to fetch scheduler role info', schedulerError);
        toast.error('Failed to fetch scheduler info');
        return;
      }

      const schedulerCollegeId = schedulerRoles.college_id;

      console.log('========================================');
      console.log('Scheduler College ID:', schedulerCollegeId);
      console.log('========================================');

      // 2. Get all proctors (role_id = 5) with their department info
      const { data: proctorRoles, error: proctorError } = await supabase
        .from('tbl_user_role')
        .select(`
          user_id,
          college_id,
          department_id,
          tbl_users(first_name, last_name),
          tbl_department(college_id)
        `)
        .eq('role_id', 5);

      if (proctorError || !proctorRoles) {
        console.error('Failed to fetch proctors', proctorError);
        toast.error('Failed to fetch proctors');
        return;
      }

      // 3. Filter proctors based on college match
      // A proctor matches if ANY of their role_id=5 entries match the scheduler's college
      const matchingUserIds = new Set<number>();

      proctorRoles.forEach((p: any) => {
        let matches = false;

        // Case 1: Both college_id and department_id are filled
        if (p.college_id && p.department_id) {
          // Check if college matches directly OR if department belongs to scheduler's college
          if (p.college_id === schedulerCollegeId || p.tbl_department?.college_id === schedulerCollegeId) {
            matches = true;
            console.log(`✓ Match (College & Dept): ${p.tbl_users?.first_name} ${p.tbl_users?.last_name} - College: ${p.college_id}, Dept College: ${p.tbl_department?.college_id}`);
          }
        }
        // Case 2: Only college_id is filled (department_id is null)
        else if (p.college_id && !p.department_id) {
          if (p.college_id === schedulerCollegeId) {
            matches = true;
            console.log(`✓ Match (College Only): ${p.tbl_users?.first_name} ${p.tbl_users?.last_name} - College: ${p.college_id}`);
          }
        }
        // Case 3: Only department_id is filled (college_id is null)
        else if (!p.college_id && p.department_id) {
          if (p.tbl_department?.college_id === schedulerCollegeId) {
            matches = true;
            console.log(`✓ Match (Dept Only): ${p.tbl_users?.first_name} ${p.tbl_users?.last_name} - Dept: ${p.department_id}, Dept College: ${p.tbl_department?.college_id}`);
          }
        }

        if (!matches) {
          console.log(`✗ No Match: ${p.tbl_users?.first_name} ${p.tbl_users?.last_name} - College: ${p.college_id || 'null'}, Dept: ${p.department_id || 'null'}, Dept College: ${p.tbl_department?.college_id || 'null'}`);
        }

        if (matches) {
          matchingUserIds.add(p.user_id);
        }
      });

      // 4. Get unique proctors with their user info
      const uniqueProctors = proctorRoles
        .filter((p: any) => matchingUserIds.has(p.user_id))
        .reduce((acc: any[], current: any) => {
          const exists = acc.find(item => item.user_id === current.user_id);
          if (!exists) {
            acc.push(current);
          }
          return acc;
        }, []);

      setInstructors(
        uniqueProctors.map((p: any) => ({
          value: p.user_id,
          label: `${p.tbl_users?.first_name || ''} ${p.tbl_users?.last_name || ''}`.trim(),
        }))
      );

      console.log('Total Matching Proctors:', uniqueProctors.length);
      console.log('========================================');
    } catch (error) {
      console.error('Error fetching instructors:', error);
      toast.error('An error occurred while fetching proctors');
    }
  };

  const fetchAvailability = async () => {
  console.log('🔵 fetchAvailability() called');
  if (!user?.user_id) return;

  try {
    // 1. Get scheduler's college_id
    const { data: schedulerRoles, error: schedulerError } = await supabase
      .from('tbl_user_role')
      .select('college_id')
      .eq('user_id', user.user_id)
      .eq('role_id', 3)
      .single();

    if (schedulerError || !schedulerRoles?.college_id) {
      console.error('Failed to fetch scheduler college', schedulerError);
      toast.error('Failed to fetch scheduler info');
      return;
    }

    const schedulerCollegeId = schedulerRoles.college_id;
    console.log('🔵 Scheduler College for Availability:', schedulerCollegeId);

    // 2. Get all proctors (role_id = 5) with their college/department info
    const { data: proctorRoles, error: proctorError } = await supabase
      .from('tbl_user_role')
      .select(`
        user_id,
        college_id,
        department_id,
        tbl_department(college_id)
      `)
      .eq('role_id', 5);

    if (proctorError || !proctorRoles) {
      console.error('Failed to fetch proctors', proctorError);
      return;
    }

    console.log('🔵 Total proctors fetched:', proctorRoles.length);

    // 3. Filter proctors that match the scheduler's college
    const matchingUserIds = new Set<number>();

    proctorRoles.forEach((p: any) => {
      let matches = false;

      // Case 1: Both college_id and department_id are filled
      if (p.college_id && p.department_id) {
        if (p.college_id === schedulerCollegeId || p.tbl_department?.college_id === schedulerCollegeId) {
          matches = true;
        }
      }
      // Case 2: Only college_id is filled
      else if (p.college_id && !p.department_id) {
        if (p.college_id === schedulerCollegeId) {
          matches = true;
        }
      }
      // Case 3: Only department_id is filled
      else if (!p.college_id && p.department_id) {
        if (p.tbl_department?.college_id === schedulerCollegeId) {
          matches = true;
        }
      }

      if (matches) {
        matchingUserIds.add(p.user_id);
      }
    });

    if (matchingUserIds.size === 0) {
      console.log('🔵 No matching proctors found for college:', schedulerCollegeId);
      setEntries([]);
      return;
    }

    console.log('🔵 Fetching availability for user IDs:', Array.from(matchingUserIds));

    // 4. Fetch availability ONLY for matching proctors
    const { data, error } = await supabase
      .from('tbl_availability')
      .select(`
        availability_id,
        days,
        time_slots,
        status,
        remarks,
        user_id,
        tbl_users (first_name, last_name)
      `)
      .in('user_id', Array.from(matchingUserIds));

    if (error) {
      console.error('🔴 Error fetching availability:', error);
      toast.error('Failed to fetch availability');
      return;
    }

    console.log('🔵 Fetched availability records:', data?.length || 0);
    console.log('🔵 Availability data:', data);

    const mapped = data.map((entry: any) => ({
      availability_id: entry.availability_id,
      days: entry.days,
      time_slots: entry.time_slots,
      status: entry.status,
      remarks: entry.remarks,
      user_id: entry.user_id,
      user_fullname: `${entry.tbl_users?.first_name || ''} ${entry.tbl_users?.last_name || ''}`,
    }));
    
    console.log('🔵 Setting entries with', mapped.length, 'records');
    console.log('🔵 Mapped entries:', mapped);
    setEntries(mapped);
  } catch (error) {
    console.error('🔴 Error fetching availability:', error);
    toast.error('An error occurred while fetching availability');
  }
};

  const checkExistingSubmission = async () => {
    if (!user.user_id) return;
    const { data, error } = await supabase
      .from('tbl_availability')
      .select('*')
      .eq('user_id', user.user_id)
      .limit(1)
      .single();
    if (!error && data) setHasSubmitted(true);
  };

  const fetchAllowedDates = async () => {
    const { data: roles } = await supabase
      .from('tbl_user_role')
      .select('college_id, role_id')
      .eq('user_id', user.user_id);
    const proctorRole = roles?.find((r) => r.role_id === 3);
    if (!proctorRole) return;

    const { data: periods } = await supabase
      .from('tbl_examperiod')
      .select('start_date, end_date')
      .eq('college_id', proctorRole.college_id);

    const dates: string[] = [];
    periods?.forEach((period) => {
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
  };

  // calendar helpers
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
  // helper to format YYYY-MM-DD in local time
  const formatDateLocal = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // handle multi-select for days
  const handleDateSelect = (day: number | null) => {
    if (!day) return;
    const localDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    const iso = formatDateLocal(localDate);
    if (allowedDates.length > 0 && !allowedDates.includes(iso)) return;

    setSelectedDate(prev => {
      // toggle date selection
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

  // open add modal
  const openAddModal = () => {
    setEditingId(null);
    setSelectedInstructors([]);
    setSelectedInstructorSingle(null);
    setRemarks('');
    setShowModal(true);
  };
  // open edit modal
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
    if (!selectedDate) {
      toast.error('Select a valid date.');
      return;
    }
    setIsSubmitting(true);

    if (editingId) {
      // update one record
      const { error } = await supabase
        .from('tbl_availability')
        .update({
          days: selectedDate,           // <- match DB
          time_slots: selectedTimeSlot,
          status: availabilityStatus,
          remarks,
          user_id: selectedInstructorSingle?.value,
        })
        .eq('availability_id', editingId);

      if (error) toast.error(error.message);
      else {
        toast.success('Updated!');
        fetchAvailability();
        setShowModal(false);
      }
    } else {
      // add for multiple instructors
      if (selectedInstructors.length === 0) {
        toast.error('Select at least one instructor.');
        setIsSubmitting(false);
        return;
      }
      const payload = selectedInstructors.map((inst) => ({
        days: selectedDate,             // <- match DB
        time_slots: selectedTimeSlot,
        status: availabilityStatus,
        remarks,
        user_id: inst.value,
      }));

      const { error } = await supabase.from('tbl_availability').insert(payload);
      if (error) toast.error(error.message);
      else {
        toast.success('Availability submitted!');
        fetchAvailability();
        setShowModal(false);
      }
    }
    setIsSubmitting(false);
  };

  // Add this function inside SchedulerAvailability component
  const handleDeleteAll = async () => {
    if (!user?.user_id) return;

    if (!window.confirm('Are you sure you want to delete all availability for your college?')) return;

    try {
      // 1. Get scheduler's college_id
      const { data: schedulerRoles, error: schedulerError } = await supabase
        .from('tbl_user_role')
        .select('college_id')
        .eq('user_id', user.user_id)
        .eq('role_id', 3)
        .single();

      if (schedulerError || !schedulerRoles?.college_id) {
        toast.error('Failed to get scheduler college.');
        return;
      }

      const schedulerCollegeId = schedulerRoles.college_id;

      // 2. Get user_ids of all users in that college
      const { data: collegeUsers, error: collegeUsersError } = await supabase
        .from('tbl_user_role')
        .select('user_id')
        .eq('college_id', schedulerCollegeId);

      if (collegeUsersError || !collegeUsers?.length) {
        toast.error('No users found for your college.');
        return;
      }

      const userIdsToDelete = collegeUsers.map(u => u.user_id);

      // 3. Delete availability for those users only
      const { error: deleteError } = await supabase
        .from('tbl_availability')
        .delete()
        .in('user_id', userIdsToDelete);

      if (deleteError) {
        toast.error(deleteError.message);
      } else {
        toast.success('All availability for your college has been deleted.');
        fetchAvailability();
      }

    } catch (err) {
      console.error(err);
      toast.error('An unexpected error occurred.');
    }
  };

  // handle multi select with "Select All"
  const instructorOptions = [{ label: 'Select All', value: 'all' }, ...instructors];
  const handleMultiChange = (selected: any) => {
    const allOption = selected?.find((s: any) => s.value === 'all');
    if (allOption) {
      setSelectedInstructors(instructors);
    } else {
      setSelectedInstructors(selected || []);
    }
  };

  return (
    <div className="colleges-container">
      <div className="colleges-header">
      </div>

      <div className="colleges-actions">
        <button type="button" className="action-button add-new" onClick={openAddModal}>
          Add Proctor Availability
        </button>

        <button
          type="button"
          className="action-button delete-all"
          onClick={handleDeleteAll}
          style={{ marginLeft: '10px', backgroundColor: '#e74c3c', color: 'white' }}
        >
          Delete All
        </button>

        <div className="search-bar" style={{ marginLeft: 'auto' }}>
          <input
            type="text"
            placeholder="Search Proctor"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #ccc' }}
          />
        </div>
      </div>

      <div className="colleges-table-container">
        <table className="colleges-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Proctor Name</th>
              <th>Day</th>
              <th>Time Slot</th>
              <th>Status</th>
              <th>Remarks</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {entries
              .filter((entry) =>
                (entry.user_fullname || '').toLowerCase().includes(searchTerm.toLowerCase())
              )
              .map((entry, idx) => (
                <tr key={entry.availability_id}>
                  <td>{idx + 1}</td>
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
                  <td>
                    <button
                      type="button"
                      className="icon-button delete-button"
                      onClick={async () => {
                        await supabase.from('tbl_availability').delete().eq('availability_id', entry.availability_id);
                        toast.success('Deleted');
                        fetchAvailability();
                        setHasSubmitted(false);
                      }}
                    >
                      <FaTrash />
                    </button>
                    <button type="button" className="icon-button" onClick={() => openEditModal(entry)}>
                      <FaPenAlt style={{color: "#092C4C"}}/>
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3 style={{ textAlign: 'center' }}>{editingId ? 'Edit Availability' : 'Add Availability'}</h3>

            {/* date */}
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
                      <div key={i} className="day-name">
                        {d}
                      </div>
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
                    <button type="button" onClick={goToToday}>
                      Now
                    </button>
                    <button type="button" onClick={() => setShowDatePicker(false)}>
                      Close
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* time slot */}
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

            {/* status */}
            <div className="input-group">
              <label>Status</label>
              <select
                value={availabilityStatus}
                onChange={(e) => setAvailabilityStatus(e.target.value as AvailabilityStatus)}
              >
                {Object.values(AvailabilityStatus).map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>

            {/* remarks */}
            <div className="input-group">
              <label>Remarks</label>
              <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} />
            </div>

            {/* instructor dropdowns */}
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
              <button type="button" onClick={() => setShowModal(false)}>
                Cancel
              </button>
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
              <button type="button" onClick={() => setShowRemarksModal(false)}>
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
