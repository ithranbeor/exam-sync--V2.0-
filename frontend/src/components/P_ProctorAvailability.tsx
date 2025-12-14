import React, { useState, useEffect } from 'react';
import '../styles/P_ProctorAvailability.css';
import { FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import { api } from '../lib/apiClient.ts';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Select from 'react-select';

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

const ProctorSetAvailability: React.FC<ProctorSetAvailabilityProps> = ({ user }) => {
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [selectedTimeSlots, setSelectedTimeSlots] = useState<AvailabilityTimeSlot[]>([]);
  const [selectedOriginalDay, setSelectedOriginalDay] = useState<string>('');
  const [selectedOriginalTimeSlot, setSelectedOriginalTimeSlot] = useState<string>('');
  const [availableDays, setAvailableDays] = useState<string[]>([]);
  const [dayToTimeSlots, setDayToTimeSlots] = useState<Record<string, string[]>>({});
  const [availabilityStatus, setAvailabilityStatus] = useState('available');
  const [remarks, setRemarks] = useState('');
  const [changeStatus, setChangeStatus] = useState('unavailable');
  const [reason, setReason] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [allowedDates, setAllowedDates] = useState<string[]>([]);
  const [_collegeId, setCollegeId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasApprovedSchedule, setHasApprovedSchedule] = useState(false);
  const [availabilityList, setAvailabilityList] = useState<
    { days: string[]; time_slots: string[]; status: string; remarks?: string }[]
  >([]);
  const [showModal, setShowModal] = useState(false);

  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [loadingAllowedDates, setLoadingAllowedDates] = useState(false);

  const [showConfirmAvailability, setShowConfirmAvailability] = useState(false);
  const [showConfirmChangeRequest, setShowConfirmChangeRequest] = useState(false);
  const [_confirmPendingSubmit, setConfirmPendingSubmit] = useState<'availability' | 'change' | null>(null);

  const today = new Date();

  // Fetch availability list for current user
  useEffect(() => {
    const fetchAvailability = async () => {
      if (!user?.user_id) return;
      setLoadingAvailability(true);
      try {
        const { data } = await api.get(`/tbl_availability/`, {
          params: { user_id: user.user_id }
        });

        if (Array.isArray(data)) {
          type AvailabilityEntry = {
            days: string[];
            time_slots: string[];
            status: string;
            remarks?: string;
          };

          const formatted: AvailabilityEntry[] = data.map((entry: any) => ({
            days: Array.isArray(entry.days) ? entry.days : [],
            time_slots: Array.isArray(entry.time_slots) ? entry.time_slots : [],
            status: entry.status,
            remarks: entry.remarks ?? undefined,
          }));

          setAvailabilityList(formatted);

          const daySlotMap: Record<string, string[]> = {};
          formatted.forEach((entry: AvailabilityEntry) => {
            entry.days.forEach((day: string) => {
              if (!daySlotMap[day]) daySlotMap[day] = [];
              entry.time_slots.forEach((slot: string) => {
                if (!daySlotMap[day].includes(slot)) {
                  daySlotMap[day].push(slot);
                }
              });
            });
          });

          setDayToTimeSlots(daySlotMap);
          setAvailableDays(Object.keys(daySlotMap));
        } else {
          console.error('Unexpected API response format:', data);
          setAvailabilityList([]);
          setAvailableDays([]);
          setDayToTimeSlots({});
        }
      } catch (err) {
        console.error('Error fetching availability:', err);
      } finally {
        setLoadingAvailability(false);
      }
    };

    fetchAvailability();
  }, [user.user_id]);

  // Initialize current month
  useEffect(() => {
    const localToday = new Date();
    localToday.setHours(12, 0, 0, 0);
    setCurrentMonth(new Date(localToday.getFullYear(), localToday.getMonth(), 1));
  }, []);

  // Fetch allowed dates (based on exam period)
  useEffect(() => {
    const fetchUserRoleAndSchedule = async () => {
      setLoadingAllowedDates(true);
      try {
        if (!user?.user_id) return;

        // 1️⃣ Fetch user roles from tbl_user_role
        const { data: roles } = await api.get(`/tbl_user_role`, {
          params: { user_id: user.user_id }
        });

        console.log('User roles fetched:', roles);

        if (!Array.isArray(roles) || roles.length === 0) {
          console.error('No roles found for user');
          setCollegeId(null);
          setAllowedDates([]);
          return;
        }

        // 2️⃣ Check if user is a proctor (role_id = 5)
        const proctorRole = roles.find((r: any) => r.role === 5 || r.role_id === 5);
        if (!proctorRole) {
          console.warn('User is not a proctor');
          setCollegeId(null);
          setAllowedDates([]);
          return;
        }

        console.log('Proctor role found:', proctorRole);

        // 3️⃣ Get college from role or user record
        let college_id = proctorRole.college ?? proctorRole.college_id ?? null;

        // If college not in role, fetch from tbl_users
        if (!college_id) {
          const { data: userData } = await api.get(`/tbl_users/${user.user_id}`);
          college_id = userData?.college_id ?? null;
        }

        if (!college_id) {
          console.warn('College not found for proctor');
          setCollegeId(null);
          setAllowedDates([]);
          return;
        }

        setCollegeId(college_id);
        console.log('Proctor college ID:', college_id);

        // 4️⃣ Fetch exam periods
        const { data: allPeriods } = await api.get(`/tbl_examperiod`);
        if (!Array.isArray(allPeriods)) {
          console.error('Unexpected examperiod response:', allPeriods);
          setAllowedDates([]);
          return;
        }

        console.log('All exam periods:', allPeriods);

        // ✅ Filter by the correct college_id
        const collegePeriods = allPeriods.filter(
          (period: any) => String(period.college_id) === String(college_id)
        );

        console.log('Filtered exam periods for college:', collegePeriods);

        if (collegePeriods.length === 0) {
          console.warn(`No exam periods found for college_id=${college_id}`);
          setAllowedDates([]);
          return;
        }

        // 5️⃣ Generate all valid exam dates
        const generatedDates: string[] = [];
        collegePeriods.forEach((period: any) => {
          if (!period.start_date || !period.end_date) return;
          const start = new Date(period.start_date);
          const end = new Date(period.end_date);
          for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            generatedDates.push(new Date(d).toLocaleDateString("en-CA"));
          }
        });

        generatedDates.sort();
        setAllowedDates(generatedDates);
        console.log('Allowed dates for proctor:', generatedDates);
      } catch (err) {
        console.error('Error fetching user role or exam schedule:', err);
        setAllowedDates([]);
      } finally {
        setLoadingAllowedDates(false);
      }
    };

    fetchUserRoleAndSchedule();
  }, [user.user_id]);

  // Check if there's an approved schedule for the proctor's college
  useEffect(() => {
    const checkApprovedSchedule = async () => {
      if (!_collegeId) {
        setHasApprovedSchedule(false);
        return;
      }

      try {
        // Get the college name from college_id
        const { data: collegeData } = await api.get(`/tbl_college/${_collegeId}/`);

        if (!collegeData?.college_name) {
          console.error('Could not fetch college name');
          setHasApprovedSchedule(false);
          return;
        }

        // Check if there's an approved schedule for this college
        const { data: approvedSchedules } = await api.get(`/tbl_scheduleapproval/`, {
          params: {
            college_name: collegeData.college_name,
            status: 'approved'
          }
        });

        setHasApprovedSchedule(Array.isArray(approvedSchedules) && approvedSchedules.length > 0);
      } catch (err) {
        console.error('Error checking approved schedule:', err);
        setHasApprovedSchedule(false);
      }
    };

    checkApprovedSchedule();
    const interval = setInterval(checkApprovedSchedule, 5000);
    return () => clearInterval(interval);
  }, [_collegeId]);

  const daysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
  const firstDayOfMonth = (y: number, m: number) => new Date(y, m, 1).getDay();

  const getCalendarDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const numDays = daysInMonth(year, month);
    const startDay = firstDayOfMonth(year, month);

    const daysArray: (number | null)[] = [];
    for (let i = 0; i < startDay; i++) daysArray.push(null);
    for (let i = 1; i <= numDays; i++) daysArray.push(i);
    return daysArray;
  };

  const handleDateSelect = (day: number | null) => {
    if (!day) return;
    const selected = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    const iso = selected.toLocaleDateString("en-CA");
    if (!allowedDates.includes(iso)) return;

    setSelectedDates(prev =>
      prev.includes(iso) ? prev.filter(d => d !== iso) : [...prev, iso]
    );
  };

  const goToPreviousMonth = () => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  const goToNextMonth = () => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));

  const handleSubmitAvailability = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSubmitting) return;

    if (selectedDates.length === 0 || selectedTimeSlots.length === 0) {
      toast.info('Please select at least one date and one time slot.');
      return;
    }

    // Check for redundancy and total slots
    let totalSlots = 0;
    let isRedundant = false;

    const daySlotMapCopy = { ...dayToTimeSlots }; // existing map of day -> time slots

    for (const day of selectedDates) {
      const existingSlots = daySlotMapCopy[day] || [];
      for (const slot of selectedTimeSlots) {
        if (existingSlots.includes(slot)) {
          isRedundant = true; // This slot already exists for this day
        } else {
          totalSlots++;
        }
      }
    }

    if (isRedundant) {
      toast.error('Some selected date and time slot combinations already exist.');
      return;
    }

    if (totalSlots > 6) {
      toast.error('You can only add a maximum of 6 availability slots.');
      return;
    }

    // Show confirmation modal instead of submitting directly
    setConfirmPendingSubmit('availability');
    setShowConfirmAvailability(true);
  };

  const handleConfirmAvailabilitySubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    const userId = user?.user_id;
    if (!userId) {
      toast.info('User is not logged in.');
      setIsSubmitting(false);
      return;
    }

    const data = {
      days: selectedDates,
      time_slots: selectedTimeSlots,
      status: availabilityStatus || 'available',
      remarks: remarks || null,
      user_id: userId,
    };

    try {
      const response = await api.post('/tbl_availability/', data);
      if (response.status >= 200 && response.status < 300) {
        toast.success('Availability set successfully!');

        const formattedData = {
          days: data.days,
          time_slots: data.time_slots,
          status: data.status,
          remarks: data.remarks ?? undefined,
        };

        // Update state
        setAvailabilityList(prev => [...prev, formattedData]);
        setDayToTimeSlots(prev => {
          const updated = { ...prev };
          selectedDates.forEach(day => {
            if (!updated[day]) updated[day] = [];
            selectedTimeSlots.forEach(slot => {
              if (!updated[day].includes(slot)) updated[day].push(slot);
            });
          });
          return updated;
        });
        setAvailableDays(prev => Array.from(new Set([...prev, ...selectedDates])));

        // Clear selections
        setSelectedDates([]);
        setSelectedTimeSlots([]);
        setAvailabilityStatus('available');
        setRemarks('');
        setShowConfirmAvailability(false);
      } else {
        toast.error(`Failed to submit availability: ${response.data?.message || 'Unknown error'}`);
      }
    } catch (err: any) {
      console.error('API error:', err);
      toast.error(`Failed to process availability: ${err?.message || 'Unknown error'}`);
    }

    setIsSubmitting(false);
  };

  const handleSubmitChangeRequest = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSubmitting) return;

    const selectedDays = selectedOriginalDay.split(',').filter(Boolean);
    const selectedSlots = selectedOriginalTimeSlot.split(',').filter(Boolean);

    if (selectedDays.length === 0 || selectedSlots.length === 0) {
      toast.info('Please select at least one day and one time slot.');
      return;
    }

    const userId = user?.user_id;
    if (!userId) {
      toast.info('User is not logged in.');
      return;
    }

    // Show confirmation modal
    setConfirmPendingSubmit('change');
    setShowConfirmChangeRequest(true);
  };

  const handleConfirmChangeRequestSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    const selectedDays = selectedOriginalDay.split(',').filter(Boolean);
    const selectedSlots = selectedOriginalTimeSlot.split(',').filter(Boolean);
    const userId = user?.user_id;

    try {
      const data = {
        user_id: userId,
        days: selectedDays,
        time_slots: selectedSlots,
        status: changeStatus,
        remarks: reason || null,
      };

      const response = await api.post('/tbl_availability/', data);

      if (response.status >= 200 && response.status < 300) {
        toast.success('Change request submitted successfully!');
        setReason('');
        setChangeStatus('unavailable');
        setSelectedOriginalDay('');
        setSelectedOriginalTimeSlot('');
        setShowConfirmChangeRequest(false);
      } else {
        toast.error(`Failed to submit change request: ${response.data?.message || 'Unknown error'}`);
      }
    } catch (error: any) {
      console.error('Error submitting change request:', error);
      toast.error(`Failed to submit change request: ${error?.message || 'Unknown error'}`);
    }

    setIsSubmitting(false);
  };

  const availabilityOptions = ['available', 'unavailable'];

  return (
    <div className="set-availability-container">
      <div className="availability-sections">
        <div className="availability-card">
          <div className="card-header-request">Set Availability</div>
          <div className="subtitle">
            (Choose your availability for the exam schedule)
          </div>
          <form onSubmit={handleSubmitAvailability} className="availability-form">

            {/* Day Picker */}
            <div className="form-group">
              <label htmlFor="day">Day(s)</label>
              <div className="custom-select-wrapper">
                <input
                  type="text"
                  id="day"
                  value={
                    loadingAllowedDates
                      ? 'Loading...'
                      : selectedDates.length > 0
                        ? selectedDates.map(d => new Date(d).toLocaleDateString('en-US')).join(', ')
                        : 'Click to select dates'
                  }
                  readOnly
                  onClick={() => {
                    if (!loadingAllowedDates && allowedDates.length > 0 && !isSubmitting) {
                      setShowDatePicker(!showDatePicker);
                    }
                  }}
                  className="date-input-field"
                  style={{
                    cursor: loadingAllowedDates || isSubmitting ? 'not-allowed' : 'pointer',
                    color: loadingAllowedDates ? '#6c757d' : 'black',
                  }}
                />
                <span
                  className="dropdown-arrow"
                  onClick={() => {
                    if (!loadingAllowedDates && allowedDates.length > 0 && !isSubmitting) {
                      setShowDatePicker(!showDatePicker);
                    }
                  }}
                >
                  &#9660;
                </span>

                {showDatePicker && !loadingAllowedDates && (
                  <div className="date-picker">
                    <div className="date-picker-header">
                      <button type="button" onClick={goToPreviousMonth}><FaChevronLeft /></button>
                      <span>{currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
                      <button type="button" onClick={goToNextMonth}><FaChevronRight /></button>
                    </div>
                    <div className="date-picker-grid">
                      {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                        <div key={i} className="day-name">{d}</div>
                      ))}
                      {getCalendarDays().map((day, index) => {
                        const dayDate = day ? new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day, 12) : null;
                        const isoDate = dayDate ? dayDate.toISOString().split('T')[0] : '';
                        const isAllowed = allowedDates.includes(isoDate) && !isSubmitting;
                        const isSelected = selectedDates.includes(isoDate);
                        const isToday = dayDate && dayDate.toDateString() === today.toDateString();

                        return (
                          <div
                            key={index}
                            className={`calendar-day ${day ? 'selectable' : ''} ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''} ${isAllowed ? 'allowed' : 'disabled'}`}
                            onClick={() => isAllowed && handleDateSelect(day)}
                            style={{ pointerEvents: isAllowed ? 'auto' : 'none', opacity: isAllowed ? 1 : 0.3 }}
                          >
                            {day}
                          </div>
                        );
                      })}
                    </div>
                    <div className="date-picker-footer">
                      <button type="button" onClick={() => setShowDatePicker(false)}>Done</button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Time Slot */}
            <div className="form-group">
              <label htmlFor="timeSlot">Time Slot(s)</label>
              <Select
                id="timeSlot"
                value={selectedTimeSlots.map(slot => ({ value: slot, label: slot }))}
                onChange={(options) =>
                  setSelectedTimeSlots(options ? options.map(o => o.value as AvailabilityTimeSlot) : [])
                }
                options={Object.values(AvailabilityTimeSlot).map(slot => ({ value: slot, label: slot }))}
                isMulti
                isDisabled={isSubmitting}
                classNamePrefix="react-select"
                placeholder="Select Time Slot(s)"
                isSearchable
              />
            </div>

            {/* Remarks */}
            <div className="form-group">
              <label htmlFor="remarks">Remarks</label>
              <textarea
                id="remarks"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Type here..."
                disabled={isSubmitting}
              />
            </div>

            <div style={{ textAlign: 'center', marginTop: '20px' }}>
              <button type="button" className="submit-button" onClick={handleSubmitAvailability} disabled={isSubmitting}>
                {isSubmitting ? 'Submitting...' : 'Submit'}
              </button>
            </div>

            <div style={{ textAlign: 'center', marginTop: '10px' }}>
              <span
                style={{
                  display: 'inline-block',
                  color: '#092C4C',
                  cursor: 'pointer',
                  textDecoration: 'none',
                  border: '2px solid #092C4C',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  fontSize: '0.95em',
                  fontWeight: '500',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#092C4C';
                  e.currentTarget.style.color = 'white';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = '#092C4C';
                }}
                onClick={() => setShowModal(true)}
              >
                Click here to view all submitted availabilities
              </span>
            </div>
          </form>
        </div>

        {/* Modal for viewing submissions */}
        {showModal && (
          <div className="availability-modal-overlay">
            <div className="availability-modal-box">
              <h2 className="availability-modal-title">All Submitted Availabilities</h2>

              {/* Loading state */}
              {loadingAvailability ? (
                <div className="modal-loading">
                  <p>Loading submitted availabilities...</p>
                </div>
              ) : (
                <>
                  {/* If there are availabilities */}
                  {availabilityList.length > 0 ? (
                    <div className="availability-modal-body">
                      {availabilityList.map((entry, idx) => (
                        <div key={idx} className="availability-entry">
                          <p><strong>Days:</strong> {entry.days.join(', ')}</p>
                          <p><strong>Time Slots:</strong> {entry.time_slots.join(', ')}</p>
                          <p><strong>Status:</strong> {entry.status}</p>
                          {entry.remarks && <p><strong>Remarks:</strong> {entry.remarks}</p>}
                          <hr />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="modal-empty">
                      <p style={{ color: 'black' }}>No availability info found.</p>
                    </div>
                  )}
                </>
              )}

              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="availability-modal-close-btn"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* Confirmation Modal for Set Availability */}
        {showConfirmAvailability && (
          <div className="availability-modal-overlay">
            <div className="availability-modal-box">
              <h2 className="availability-modal-title">Confirm Availability Submission</h2>
              <div className="availability-modal-body">
                <div className="availability-entry">
                  <p><strong>Days:</strong> {selectedDates.map(d => new Date(d).toLocaleDateString('en-US')).join(', ')}</p>
                  <p><strong>Time Slots:</strong> {selectedTimeSlots.join(', ')}</p>
                  <p><strong>Status:</strong> {availabilityStatus}</p>
                  {remarks && <p><strong>Remarks:</strong> {remarks}</p>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '20px' }}>
                <button
                  type="button"
                  onClick={() => setShowConfirmAvailability(false)}
                  className="availability-modal-close-btn"
                  style={{ backgroundColor: '#6c757d', width: 'auto', margin: '0' }}
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleConfirmAvailabilitySubmit}
                  disabled={isSubmitting}
                  className="availability-modal-close-btn"
                  style={{ backgroundColor: '#092C4C', width: 'auto', margin: '0' }}
                >
                  {isSubmitting ? 'Submitting...' : 'Submit'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Confirmation Modal for Request Change */}
        {showConfirmChangeRequest && (
          <div className="availability-modal-overlay">
            <div className="availability-modal-box">
              <h2 className="availability-modal-title">Confirm Change Request Submission</h2>
              <div className="availability-modal-body">
                <div className="availability-entry">
                  <p><strong>Days:</strong> {selectedOriginalDay.split(',').filter(Boolean).map(d => new Date(d).toLocaleDateString('en-US')).join(', ')}</p>
                  <p><strong>Time Slots:</strong> {selectedOriginalTimeSlot.split(',').filter(Boolean).join(', ')}</p>
                  <p><strong>New Status:</strong> {changeStatus}</p>
                  {reason && <p><strong>Reason:</strong> {reason}</p>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '20px' }}>
                <button
                  type="button"
                  onClick={() => setShowConfirmChangeRequest(false)}
                  className="availability-modal-close-btn"
                  style={{ backgroundColor: '#6c757d', width: 'auto', margin: '0' }}
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleConfirmChangeRequestSubmit}
                  disabled={isSubmitting}
                  className="availability-modal-close-btn"
                  style={{ backgroundColor: '#092C4C', width: 'auto', margin: '0' }}
                >
                  {isSubmitting ? 'Submitting...' : 'Submit'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Change Request */}
        <div className="availability-card">
          <div className="card-header-request">Request Change of Availability</div>
          <div className="subtitle">
            {hasApprovedSchedule
              ? '(only available after the release of exam schedule)'
              : '(waiting for schedule approval from your dean)'}
          </div>

          {!hasApprovedSchedule ? (
            <div style={{
              textAlign: 'center',
              padding: '40px 20px',
              color: '#666',
              fontSize: '14px',
              border: '1px dashed #ccc',
              borderRadius: '8px',
              margin: '20px 0',
              backgroundColor: '#f9f9f9'
            }}>
              <p style={{ marginBottom: '10px', fontWeight: 'bold', color: '#092C4C' }}>
                Change requests are currently unavailable
              </p>
              <p>
                This feature will be enabled once your college's exam schedule has been approved by the dean.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmitChangeRequest} className="availability-form">
              {/* Select Original Schedule (Days) */}
              <div className="form-group">
                <label htmlFor="originalDays">Select Schedule Day(s)</label>
                <Select
                  id="originalDays"
                  value={selectedOriginalDay
                    .split(',')
                    .filter(Boolean)
                    .map(day => ({
                      value: day,
                      label: new Date(day).toLocaleDateString('en-US', {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                      }),
                    }))}
                  onChange={(selectedOptions) => {
                    const days = selectedOptions?.map(o => o.value) || [];
                    setSelectedOriginalDay(days.join(','));
                    setSelectedOriginalTimeSlot('');
                  }}
                  options={availableDays.map(day => ({
                    value: day,
                    label: new Date(day).toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    }),
                  }))}
                  isMulti
                  placeholder="Select one or more days"
                  isDisabled={isSubmitting || availableDays.length === 0}
                  classNamePrefix="react-select"
                  isSearchable
                />
              </div>

              {/* Select Original Time Slots */}
              <div className="form-group">
                <label htmlFor="originalTimeSlots">Select Time Slot(s)</label>
                <Select
                  id="originalTimeSlots"
                  value={
                    selectedOriginalTimeSlot
                      ? selectedOriginalTimeSlot.split(',').map(slot => ({ value: slot, label: slot }))
                      : []
                  }
                  onChange={(selectedOptions) => {
                    const slots = selectedOptions?.map(o => o.value) || [];
                    setSelectedOriginalTimeSlot(slots.join(','));
                  }}
                  options={
                    selectedOriginalDay
                      ? Array.from(
                        new Set(
                          selectedOriginalDay
                            .split(',')
                            .flatMap(day => dayToTimeSlots[day] || [])
                        )
                      ).map(slot => ({ value: slot, label: slot }))
                      : []
                  }
                  placeholder={
                    selectedOriginalDay ? 'Select one or more time slots' : 'Select days first'
                  }
                  isDisabled={!selectedOriginalDay || isSubmitting}
                  isMulti
                  classNamePrefix="react-select"
                  isSearchable
                />
              </div>

              {/* Change Status */}
              <div className="form-group">
                <label htmlFor="changeStatus">New Status</label>
                <Select
                  id="changeStatus"
                  value={{
                    value: changeStatus,
                    label: changeStatus.charAt(0).toUpperCase() + changeStatus.slice(1),
                  }}
                  onChange={(selected) => setChangeStatus(selected?.value || 'unavailable')}
                  options={availabilityOptions.map(opt => ({
                    value: opt,
                    label: opt.charAt(0).toUpperCase() + opt.slice(1),
                  }))}
                  isDisabled={isSubmitting}
                  classNamePrefix="react-select"
                  placeholder="Select Status"
                  isSearchable={false}
                />
              </div>

              {/* Reason */}
              <div className="form-group">
                <label htmlFor="reason">Reason/s</label>
                <textarea
                  id="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Type here..."
                  disabled={isSubmitting}
                />
              </div>

              {/* Submit */}
              <button type="button" className="submit-button" onClick={handleSubmitChangeRequest} disabled={isSubmitting}>
                {isSubmitting ? 'Submitting...' : 'Submit'}
              </button>
            </form>
          )}
        </div>
      </div>
      <ToastContainer position="top-right" autoClose={3000} hideProgressBar />
    </div>
  );
};

export default ProctorSetAvailability;
