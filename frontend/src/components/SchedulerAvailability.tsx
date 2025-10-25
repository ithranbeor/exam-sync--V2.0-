import React, { useState, useEffect } from 'react';
import '../styles/proctorSetAvailability.css';
import { FaChevronLeft, FaChevronRight, FaEye, FaTrash, FaPenAlt, FaSearch } from 'react-icons/fa';
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
  day: string;
  time_slot: AvailabilityTimeSlot;
  status: AvailabilityStatus;
  remarks: string | null;
  user_id: number;
  user_fullname?: string;
}

const SchedulerAvailability: React.FC<ProctorSetAvailabilityProps> = ({ user }) => {
  const [entries, setEntries] = useState<Availability[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<AvailabilityTimeSlot>(AvailabilityTimeSlot.Morning);
  const [availabilityStatus, setAvailabilityStatus] = useState<AvailabilityStatus>(AvailabilityStatus.Available);
  const [remarks, setRemarks] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [collegeId, setCollegeId] = useState<number | null>(null);

  // instructor selection
  const [instructors, setInstructors] = useState<any[]>([]);
  const [selectedInstructors, setSelectedInstructors] = useState<any[]>([]); // for add
  const [selectedInstructorSingle, setSelectedInstructorSingle] = useState<any>(null); // for edit

  // calendar stuff
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [allowedDates, setAllowedDates] = useState<string[]>([]);
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
    fetchInstructors();
  }, []);

  const fetchInstructors = async () => {
    try {
      const res = await api.get('/users/');
      const data = res.data;
      setInstructors(
        data.map((u: any) => ({
          value: u.user_id,
          label: `${u.first_name} ${u.last_name}`,
        }))
      );
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to fetch instructors');
    }
  };

  // Fetch availability entries
  const fetchAvailability = async () => {
    try {
      const res = await api.get('/tbl_availability/');
      const data = res.data;
      const mapped = data.map((entry: any) => ({
        ...entry,
        user_fullname: `${entry.user?.first_name || ''} ${entry.user?.last_name || ''}`,
      }));
      setEntries(mapped);
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to fetch availability');
    }
  };

  // Fetch allowed dates for proctors
  const fetchAllowedDates = async () => {
    if (!user?.user_id) return;
    try {
      const rolesRes = await api.get(`/tbl_user_role`, {
        params: { user_id: user.user_id }
      });
      const roles = rolesRes.data;
      const proctorRole = roles?.find((r: any) => r.role === 5 || r.role_id === 5);
      
      if (!proctorRole) {
        console.warn('User is not a proctor');
        return;
      }

      let college_id = proctorRole.college ?? proctorRole.college_id ?? null;

      if (!college_id) {
        const { data: userData } = await api.get(`/users/${user.user_id}`);
        college_id = userData?.college_id ?? null;
      }

      if (!college_id) {
        console.warn('College not found for proctor');
        return;
      }

      const periodsRes = await api.get(`/tbl_examperiod`);
      const allPeriods = periodsRes.data;

      const collegePeriods = allPeriods.filter(
        (period: any) => String(period.college_id) === String(college_id)
      );

      const dates: string[] = [];
      collegePeriods?.forEach((period: any) => {
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
      setSelectedDate(dates.includes(todayStr) ? todayStr : '');
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to fetch allowed dates');
    }
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

  const handleDateSelect = (day: number | null) => {
    if (!day) return;
    const localDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    const iso = formatDateLocal(localDate);
    if (allowedDates.includes(iso)) {
      setSelectedDate(iso);
      setShowDatePicker(false);
    }
  };

  const goToPreviousMonth = () =>
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  const goToNextMonth = () =>
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  const goToToday = () => {
    const isoToday = today.toISOString().split('T')[0];
    setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDate(allowedDates.includes(isoToday) ? isoToday : '');
  };

  // open add modal
  const openAddModal = () => {
    setEditingId(null);
    setSelectedDate('');
    setSelectedTimeSlot(AvailabilityTimeSlot.Morning);
    setAvailabilityStatus(AvailabilityStatus.Available);
    setSelectedInstructors([]);
    setSelectedInstructorSingle(null);
    setRemarks('');
    setShowModal(true);
  };

  // open edit modal
  const openEditModal = async (entry: Availability) => {
    // ensure instructors loaded first
    if (instructors.length === 0) {
      await fetchInstructors();
    }

    const matchingInstructor =
      instructors.find((i) => Number(i.value) === Number(entry.user_id)) || null;

    setEditingId(entry.availability_id);
    setSelectedDate(entry.day);
    setSelectedTimeSlot(entry.time_slot);
    setAvailabilityStatus(entry.status);
    setRemarks(entry.remarks || '');
    setSelectedInstructorSingle(matchingInstructor);
    setShowModal(true);
  };

  const handleSubmitAvailability = async () => {
    if (!selectedDate) {
      toast.error('Select a valid date.');
      return;
    }
    setIsSubmitting(true);

    try {
      if (editingId) {
        // Update one record
        if (!selectedInstructorSingle) {
          toast.error('Please select an instructor.');
          setIsSubmitting(false);
          return;
        }

        await api.put(`/tbl_availability/${editingId}/`, {
          day: selectedDate,
          time_slot: selectedTimeSlot,
          status: availabilityStatus,
          remarks: remarks || null,
          user_id: selectedInstructorSingle.value,
        });
        toast.success('Availability updated successfully!');
      } else {
        // Add for multiple instructors
        if (selectedInstructors.length === 0) {
          toast.error('Select at least one instructor.');
          setIsSubmitting(false);
          return;
        }
        const payload = selectedInstructors.map((inst) => ({
          day: selectedDate,
          time_slot: selectedTimeSlot,
          status: availabilityStatus,
          remarks: remarks || null,
          user_id: inst.value,
        }));
        await api.post('/tbl_availability/', payload);
        toast.success('Availability submitted successfully!');
      }
      fetchAvailability();
      setShowModal(false);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to submit availability');
    } finally {
      setIsSubmitting(false);
    }
  };

  // handle delete
  const handleDelete = async (availabilityId: number) => {
    if (!confirm('Are you sure you want to delete this availability entry?')) {
      return;
    }

    try {
      const response = await api.delete(`/tbl_availability/${availabilityId}/`);
      if (response.status === 204 || response.status === 200) {
        toast.success('Availability deleted successfully!');
        fetchAvailability();
      } else {
        toast.error('Failed to delete availability.');
      }
    } catch (err: any) {
      console.error('Delete error:', err);
      toast.error(`Failed to delete: ${err?.message || 'Unknown error'}`);
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

  // Search handler
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  // Filter entries based on search term
  const filteredEntries = entries.filter((entry) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      entry.user_fullname?.toLowerCase().includes(searchLower) ||
      entry.day.toLowerCase().includes(searchLower) ||
      entry.time_slot.toLowerCase().includes(searchLower) ||
      entry.status.toLowerCase().includes(searchLower) ||
      entry.remarks?.toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="colleges-container">
      <div className="colleges-header"></div>
      <h2 className="colleges-title">Available Proctors</h2>
      <div className="colleges-actions">
        <div className="search-bar">
          <input
            type="text"
            placeholder="Search for Availability"
            value={searchTerm}
            onChange={handleSearchChange}
          />
          <button type="button" className="search-button">
            <FaSearch />
          </button>
        </div>
      </div>

      <div className="colleges-actions">
        <button type="button" className="action-button add-new" onClick={openAddModal}>
          Add Proctor Availability
        </button>
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
            {filteredEntries.map((entry, idx) => (
              <tr key={entry.availability_id}>
                <td>{idx + 1}</td>
                <td>{entry.user_fullname}</td>
                <td>{new Date(entry.day).toLocaleDateString()}</td>
                <td>{entry.time_slot}</td>
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
                    onClick={() => handleDelete(entry.availability_id)}
                  >
                    <FaTrash />
                  </button>
                  <button type="button" className="icon-button" onClick={() => openEditModal(entry)}>
                    <FaPenAlt style={{ color: "#092C4C" }} />
                  </button>
                </td>
              </tr>
            ))}
            {filteredEntries.length === 0 && (
              <tr>
                <td colSpan={7}>
                  {searchTerm ? 'No matching entries found.' : 'No entries yet.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3 style={{ textAlign: 'center' }}>{editingId ? 'Edit Availability' : 'Add Availability'}</h3>

            {/* date */}
            <div className="input-group">
              <label>Day</label>
              <input
                type="text"
                readOnly
                value={
                  selectedDate
                    ? new Date(selectedDate).toLocaleDateString()
                    : 'Click to select a date'
                }
                onClick={() => allowedDates.length > 0 && setShowDatePicker(!showDatePicker)}
                style={{ cursor: allowedDates.length > 0 ? 'pointer' : 'not-allowed' }}
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
                      const isSelected = isoDate === selectedDate;
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
              <select
                value={selectedTimeSlot}
                onChange={(e) => setSelectedTimeSlot(e.target.value as AvailabilityTimeSlot)}
              >
                {Object.values(AvailabilityTimeSlot).map((slot) => (
                  <option key={slot} value={slot}>
                    {slot}
                  </option>
                ))}
              </select>
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
            <div style={{color: 'black'}}>{selectedRemarks}</div>
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