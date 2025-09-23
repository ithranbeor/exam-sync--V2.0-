import React, { useState, useEffect } from 'react';
import '../styles/proctorSetAvailability.css';
import { FaChevronLeft, FaChevronRight, FaEye, FaTrash, FaPenAlt } from 'react-icons/fa';
import { supabase } from '../lib/supabaseClient.ts';
import { ToastContainer, toast } from 'react-toastify';
import Select from 'react-select';
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
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<AvailabilityTimeSlot>(AvailabilityTimeSlot.Morning);
  const [availabilityStatus, setAvailabilityStatus] = useState<AvailabilityStatus>(AvailabilityStatus.Available);
  const [remarks, setRemarks] = useState('');

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
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedRemarks, setSelectedRemarks] = useState('');
  const [showRemarksModal, setShowRemarksModal] = useState(false);
  const today = new Date();

  useEffect(() => {
    fetchAvailability();
    fetchAllowedDates();
    checkExistingSubmission();
    fetchInstructors();
  }, []);

  const fetchInstructors = async () => {
    const { data, error } = await supabase
      .from('tbl_users')
      .select('user_id, first_name, last_name');
    if (!error && data) {
      setInstructors(
        data.map((u) => ({
          value: u.user_id,
          label: `${u.first_name} ${u.last_name}`,
        }))
      );
    }
  };

  const fetchAvailability = async () => {
    const { data, error } = await supabase
      .from('tbl_availability')
      .select(`
        availability_id,
        day,
        time_slot,
        status,
        remarks,
        user_id,
        tbl_users (first_name, last_name)
      `);

    if (error) {
      console.error(error);
      toast.error('Failed to fetch availability');
      return;
    }

    const mapped = data.map((entry: any) => ({
      ...entry,
      user_fullname: `${entry.tbl_users?.first_name || ''} ${entry.tbl_users?.last_name || ''}`,
    }));
    setEntries(mapped);
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
    const proctorRole = roles?.find((r) => r.role_id === 5);
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
    setSelectedDate(dates.includes(todayStr) ? todayStr : '');
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
  const handleDateSelect = (day: number | null) => {
    if (!day) return;
    const iso = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day).toISOString().split('T')[0];
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
    setSelectedInstructors([]);
    setSelectedInstructorSingle(null);
    setRemarks('');
    setShowModal(true);
  };
  // open edit modal
  const openEditModal = (entry: Availability) => {
    setEditingId(entry.availability_id);
    setSelectedDate(entry.day);
    setSelectedTimeSlot(entry.time_slot);
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
          day: selectedDate,
          time_slot: selectedTimeSlot,
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
        day: selectedDate,
        time_slot: selectedTimeSlot,
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
            {entries.map((entry, idx) => (
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
                    <FaPenAlt/>
                  </button>
                </td>
              </tr>
            ))}
            {entries.length === 0 && (
              <tr>
                <td colSpan={7}>No entries yet.</td>
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
                    : 'No date schedule available'
                }
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
                        ? new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day)
                            .toISOString()
                            .split('T')[0]
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
