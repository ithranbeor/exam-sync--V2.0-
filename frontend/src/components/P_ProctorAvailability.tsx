import React, { useState, useEffect } from 'react';
import '../styles/P_ProctorAvailability.css';
import { FaChevronLeft, FaChevronRight, FaCalendarAlt } from 'react-icons/fa';
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

export type AvailabilityTimeSlot =
  (typeof AvailabilityTimeSlot)[keyof typeof AvailabilityTimeSlot];

const ProctorSetAvailability: React.FC<ProctorSetAvailabilityProps> = ({ user }) => {
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [selectedTimeSlots, setSelectedTimeSlots] = useState<AvailabilityTimeSlot[]>([]);
  const [selectedOriginalDay, setSelectedOriginalDay] = useState<string>('');
  const [selectedOriginalTimeSlot, setSelectedOriginalTimeSlot] = useState<string>('');
  const [_availableDays, setAvailableDays] = useState<string[]>([]);
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
  const [_hasApprovedSchedule, setHasApprovedSchedule] = useState(false);
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

  const isPastDate = (dateStr: string): boolean => {
    const d = new Date(); d.setHours(0, 0, 0, 0);
    return new Date(dateStr) < d;
  };

  async function resolveProctorCollegeId(userId: number): Promise<number | null> {
    try {
      const { data: roles } = await api.get(`/tbl_user_role`, { params: { user_id: userId } });
      if (!Array.isArray(roles) || roles.length === 0) return null;
      const proctorRole = roles.find((r: any) => r.role === 5 || r.role_id === 5);
      let college_id = proctorRole?.college ?? proctorRole?.college_id ?? null;
      if (!college_id) {
        const { data: userData } = await api.get(`/tbl_users/${userId}`);
        college_id = userData?.college_id ?? null;
      }
      return college_id ?? null;
    } catch { return null; }
  }

  async function notifySchedulersInCollege(collegeId: number, message: string, type: string) {
    try {
      const { data: schedulerRoles } = await api.get(`/tbl_user_role`, {
        params: { role_id: 3, college_id: collegeId }
      });
      if (!Array.isArray(schedulerRoles) || schedulerRoles.length === 0) return;
      const ids: number[] = Array.from(
        new Set(schedulerRoles.map((r: any) => r.user_id ?? r.user).filter(Boolean))
      );
      if (ids.length === 0) return;
      await Promise.allSettled(
        ids.map(id =>
          api.post(`/notifications/create/`, { user_id: id, message, type, is_seen: false })
        )
      );
    } catch (err) {
      console.error('Failed to notify schedulers:', err);
    }
  }

  // ── Fetch availability ────────────────────────────────────────────────────
  useEffect(() => {
    const fetchAvailability = async () => {
      if (!user?.user_id) return;
      setLoadingAvailability(true);
      try {
        const { data } = await api.get(`/tbl_availability/`, { params: { user_id: user.user_id } });
        if (Array.isArray(data)) {
          type AvailabilityEntry = { days: string[]; time_slots: string[]; status: string; remarks?: string };
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
                if (!daySlotMap[day].includes(slot)) daySlotMap[day].push(slot);
              });
            });
          });
          setDayToTimeSlots(daySlotMap);
          setAvailableDays(Object.keys(daySlotMap));
        } else {
          setAvailabilityList([]); setAvailableDays([]); setDayToTimeSlots({});
        }
      } catch { /* silent */ } finally {
        setLoadingAvailability(false);
      }
    };
    fetchAvailability();
  }, [user.user_id]);

  useEffect(() => {
    const localToday = new Date();
    localToday.setHours(12, 0, 0, 0);
    setCurrentMonth(new Date(localToday.getFullYear(), localToday.getMonth(), 1));
  }, []);

  // ── Fetch allowed dates ───────────────────────────────────────────────────
  useEffect(() => {
    const fetchUserRoleAndSchedule = async () => {
      setLoadingAllowedDates(true);
      try {
        if (!user?.user_id) return;
        const { data: roles } = await api.get(`/tbl_user_role`, { params: { user_id: user.user_id } });
        if (!Array.isArray(roles) || roles.length === 0) { setCollegeId(null); setAllowedDates([]); return; }
        const proctorRole = roles.find((r: any) => r.role === 5 || r.role_id === 5);
        if (!proctorRole) { setCollegeId(null); setAllowedDates([]); return; }
        let college_id = proctorRole.college ?? proctorRole.college_id ?? null;
        if (!college_id) {
          const { data: userData } = await api.get(`/tbl_users/${user.user_id}`);
          college_id = userData?.college_id ?? null;
        }
        if (!college_id) { setCollegeId(null); setAllowedDates([]); return; }
        setCollegeId(college_id);
        const { data: allPeriods } = await api.get(`/tbl_examperiod`);
        if (!Array.isArray(allPeriods)) { setAllowedDates([]); return; }
        const collegePeriods = allPeriods.filter(
          (period: any) => String(period.college_id) === String(college_id)
        );
        if (collegePeriods.length === 0) { setAllowedDates([]); return; }
        const generatedDates: string[] = [];
        collegePeriods.forEach((period: any) => {
          if (!period.start_date || !period.end_date) return;
          const start = new Date(period.start_date);
          const end = new Date(period.end_date);
          for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            generatedDates.push(new Date(d).toLocaleDateString('en-CA'));
          }
        });
        generatedDates.sort();
        setAllowedDates(generatedDates);
      } catch { setAllowedDates([]); } finally {
        setLoadingAllowedDates(false);
      }
    };
    fetchUserRoleAndSchedule();
  }, [user.user_id]);

  useEffect(() => {
    const checkApprovedSchedule = async () => {
      if (!_collegeId) { setHasApprovedSchedule(false); return; }
      try {
        const { data: collegeData } = await api.get(`/tbl_college/${_collegeId}/`);
        if (!collegeData?.college_name) { setHasApprovedSchedule(false); return; }
        const { data: approvedSchedules } = await api.get(`/tbl_scheduleapproval/`, {
          params: { college_name: collegeData.college_name, status: 'approved' }
        });
        setHasApprovedSchedule(Array.isArray(approvedSchedules) && approvedSchedules.length > 0);
      } catch { setHasApprovedSchedule(false); }
    };
    checkApprovedSchedule();
    const interval = setInterval(checkApprovedSchedule, 5000);
    return () => clearInterval(interval);
  }, [_collegeId]);

  // ── Calendar helpers ──────────────────────────────────────────────────────
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
    const selected = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    const iso = selected.toLocaleDateString('en-CA');
    if (!allowedDates.includes(iso)) return;
    setSelectedDates(prev => prev.includes(iso) ? prev.filter(d => d !== iso) : [...prev, iso]);
  };

  const goToPreviousMonth = () =>
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  const goToNextMonth = () =>
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));

  // ── Submit availability ───────────────────────────────────────────────────
  const handleSubmitAvailability = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (selectedDates.length === 0 || selectedTimeSlots.length === 0) {
      toast.info('Please select at least one date and one time slot.'); return;
    }
    let totalSlots = 0; let isRedundant = false;
    const mapCopy = { ...dayToTimeSlots };
    for (const day of selectedDates) {
      const existing = mapCopy[day] || [];
      for (const slot of selectedTimeSlots) {
        if (existing.includes(slot)) { isRedundant = true; } else { totalSlots++; }
      }
    }
    if (isRedundant) { toast.error('Some selected date and time slot combinations already exist.'); return; }
    if (totalSlots > 6) { toast.error('You can only add a maximum of 6 availability slots.'); return; }
    setConfirmPendingSubmit('availability');
    setShowConfirmAvailability(true);
  };

  const handleConfirmAvailabilitySubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    const userId = user?.user_id;
    if (!userId) { toast.info('User is not logged in.'); setIsSubmitting(false); return; }
    try {
      const postPromises = selectedDates.flatMap(day =>
        selectedTimeSlots.map(slot =>
          api.post('/tbl_availability/', {
            days: [day], time_slots: [slot],
            status: availabilityStatus || 'available',
            remarks: remarks || null, user_id: userId,
          })
        )
      );
      const results = await Promise.allSettled(postPromises);
      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.length - succeeded;
      if (succeeded > 0) {
        toast.success('Availability set successfully!');
        const newEntries = selectedDates.flatMap(day =>
          selectedTimeSlots.map(slot => ({
            days: [day], time_slots: [slot],
            status: availabilityStatus || 'available',
            remarks: remarks || undefined,
          }))
        );
        setAvailabilityList(prev => [...prev, ...newEntries]);
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
        const collegeId = _collegeId ?? await resolveProctorCollegeId(userId);
        if (collegeId) {
          const proctorName =
            (user as any)?.full_name ??
            `${(user as any)?.first_name ?? ''} ${(user as any)?.last_name ?? ''}`.trim() ??
            `Proctor #${userId}`;
          const dateLabels = selectedDates
            .map(d => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }))
            .join(', ');
          await notifySchedulersInCollege(
            collegeId,
            `${proctorName} has set their availability for: ${dateLabels}.`,
            'availability_set'
          );
        }
      }
      if (failed > 0) toast.warn(`${failed} slot(s) failed to save.`);
      setSelectedDates([]); setSelectedTimeSlots([]);
      setAvailabilityStatus('available'); setRemarks('');
      setShowConfirmAvailability(false);
    } catch (err: any) {
      toast.error(`Failed to process availability: ${err?.message || 'Unknown error'}`);
    }
    setIsSubmitting(false);
  };

  // ── Submit change request ─────────────────────────────────────────────────
  const handleSubmitChangeRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    const days = selectedOriginalDay.split(',').filter(Boolean);
    const slots = selectedOriginalTimeSlot.split(',').filter(Boolean);
    if (days.length === 0 || slots.length === 0) {
      toast.info('Please select at least one day and one time slot.'); return;
    }
    if (!user?.user_id) { toast.info('User is not logged in.'); return; }
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
      let collegeId = _collegeId;
      if (!collegeId) {
        collegeId = await resolveProctorCollegeId(userId);
        if (collegeId) setCollegeId(collegeId);
      }
      const response = await api.post('/tbl_availability/', {
        user_id: userId,
        days: selectedDays,
        time_slots: selectedSlots,
        status: 'pending',
        requested_status: changeStatus,
        remarks: reason || null,
        type: 'change_request',
      });
      if (response.status >= 200 && response.status < 300) {
        toast.success('Change request submitted! Awaiting scheduler approval.');
        if (collegeId) {
          const proctorName =
            (user as any)?.full_name ??
            `${(user as any)?.first_name ?? ''} ${(user as any)?.last_name ?? ''}`.trim() ??
            `Proctor #${userId}`;
          const dateLabels = selectedDays
            .map(d => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }))
            .join(', ');
          await notifySchedulersInCollege(
            collegeId,
            `${proctorName} requested a change to "${changeStatus}" on ${dateLabels} (${selectedSlots.join(', ')}). Please review. Just go to "Available proctor" and click the "Change Request" tab.`,
            'change_request'
          );
        }
        setReason(''); setChangeStatus('unavailable');
        setSelectedOriginalDay(''); setSelectedOriginalTimeSlot('');
        setShowConfirmChangeRequest(false);
      } else {
        toast.error(`Failed to submit change request: ${response.data?.message || 'Unknown error'}`);
      }
    } catch (error: any) {
      toast.error(`Failed to submit change request: ${error?.message || 'Unknown error'}`);
    }
    setIsSubmitting(false);
  };

  const availabilityOptions = ['available', 'unavailable'];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="set-availability-container">

      {/* Page header */}
      <div className="availability-page-header">
        <div className="availability-page-icon">
          <FaCalendarAlt />
        </div>
        <div className="availability-page-title">
          <h1>Proctor Availability</h1>
          <p>Set your availability or request a change for the exam schedule</p>
        </div>
      </div>

      <div className="availability-sections">

        {/* ── Card 1: Set Availability ── */}
        <div className="availability-card">
          <div className="card-header-request">Set Availability</div>
          <p className="subtitle">(Choose your availability for the exam schedule)</p>

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
                      ? 'Loading allowed dates…'
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
                    color: loadingAllowedDates ? '#9ca3af' : '#0f1923',
                  }}
                />
                <span
                  className="dropdown-arrow"
                  onClick={() => {
                    if (!loadingAllowedDates && allowedDates.length > 0 && !isSubmitting)
                      setShowDatePicker(!showDatePicker);
                  }}
                >
                  &#9660;
                </span>

                {showDatePicker && !loadingAllowedDates && (
                  <div className="date-picker">
                    <div className="date-picker-header">
                      <button type="button" onClick={goToPreviousMonth}><FaChevronLeft /></button>
                      <span>
                        {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                      </span>
                      <button type="button" onClick={goToNextMonth}><FaChevronRight /></button>
                    </div>
                    <div className="date-picker-grid">
                      {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                        <div key={i} className="day-name">{d}</div>
                      ))}
                      {getCalendarDays().map((day, index) => {
                        const dayDate = day
                          ? new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day, 12)
                          : null;
                        const isoDate = dayDate ? dayDate.toISOString().split('T')[0] : '';
                        const isAllowed = allowedDates.includes(isoDate) && !isSubmitting;
                        const isSelected = selectedDates.includes(isoDate);
                        const isToday = dayDate && dayDate.toDateString() === today.toDateString();
                        return (
                          <div
                            key={index}
                            className={[
                              'calendar-day',
                              day ? 'selectable' : '',
                              isSelected ? 'selected' : '',
                              isToday ? 'today' : '',
                              isAllowed ? 'allowed' : 'disabled',
                            ].filter(Boolean).join(' ')}
                            onClick={() => isAllowed && handleDateSelect(day)}
                            style={{ pointerEvents: isAllowed ? 'auto' : 'none', opacity: isAllowed ? 1 : 0.35 }}
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
                placeholder="Select time slot(s)…"
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
                placeholder="Optional notes…"
                disabled={isSubmitting}
              />
            </div>

            <div style={{ textAlign: 'center' }}>
              <button
                type="button"
                className="view-all-btn"
                onClick={() => setShowModal(true)}
              >
                View all submitted availabilities
              </button>
            </div>

            <div style={{ textAlign: 'center' }}>
              <button
                type="button"
                className="submit-buttons"
                onClick={handleSubmitAvailability}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Submitting…' : 'Submit'}
              </button>
            </div>

          </form>
        </div>

        {/* ── Card 2: Request Change ── */}
        <div className="availability-card">
          <div className="card-header-request">Request Change of Availability</div>
          <p className="subtitle">(Request a change to your existing availability)</p>

          <form onSubmit={handleSubmitChangeRequest} className="availability-form">

            {/* Day selector */}
            <div className="form-group">
              <label htmlFor="originalDays">Schedule Day(s)</label>
              <Select
                id="originalDays"
                value={selectedOriginalDay.split(',').filter(Boolean).map(day => ({
                  value: day,
                  label: new Date(day).toLocaleDateString('en-US', {
                    month: 'long', day: 'numeric', year: 'numeric',
                  }),
                }))}
                onChange={(opts) => {
                  const days = opts?.map(o => o.value) || [];
                  setSelectedOriginalDay(days.join(','));
                  setSelectedOriginalTimeSlot('');
                }}
                options={allowedDates
                  .filter(day => !isPastDate(day))
                  .map(day => ({
                    value: day,
                    label: new Date(day).toLocaleDateString('en-US', {
                      month: 'long', day: 'numeric', year: 'numeric',
                    }),
                  }))}
                isMulti
                placeholder="Select one or more days…"
                isDisabled={isSubmitting || allowedDates.length === 0}
                classNamePrefix="react-select"
                isSearchable
              />
            </div>

            {/* Time slot selector */}
            <div className="form-group">
              <label htmlFor="originalTimeSlots">
                {changeStatus === 'unavailable' ? 'Time Slot(s) to Mark Unavailable' : 'Time Slot(s)'}
              </label>
              <Select
                id="originalTimeSlots"
                value={
                  selectedOriginalTimeSlot
                    ? selectedOriginalTimeSlot.split(',').map(slot => ({ value: slot, label: slot }))
                    : []
                }
                onChange={(opts) => {
                  setSelectedOriginalTimeSlot((opts?.map(o => o.value) || []).join(','));
                }}
                options={
                  selectedOriginalDay
                    ? Array.from(new Set(
                      selectedOriginalDay
                        .split(',')
                        .filter(d => !isPastDate(d))
                        .flatMap(day => dayToTimeSlots[day] || [])
                    )).map(slot => ({ value: slot, label: slot }))
                    : Object.values(AvailabilityTimeSlot).map(slot => ({ value: slot, label: slot }))
                }
                placeholder={selectedOriginalDay ? 'Select time slot(s)…' : 'Select days first'}
                isDisabled={!selectedOriginalDay || isSubmitting}
                isMulti
                classNamePrefix="react-select"
                isSearchable
              />
            </div>

            {/* New status */}
            <div className="form-group">
              <label htmlFor="changeStatus">New Status</label>
              <Select
                id="changeStatus"
                value={{
                  value: changeStatus,
                  label: changeStatus.charAt(0).toUpperCase() + changeStatus.slice(1),
                }}
                onChange={(s) => setChangeStatus(s?.value || 'unavailable')}
                options={availabilityOptions.map(opt => ({
                  value: opt,
                  label: opt.charAt(0).toUpperCase() + opt.slice(1),
                }))}
                isDisabled={isSubmitting}
                classNamePrefix="react-select"
                placeholder="Select status…"
                isSearchable={false}
              />
            </div>

            {/* Alternative slots hint */}
            {changeStatus === 'unavailable' && selectedOriginalDay && selectedOriginalTimeSlot && (
              <div className="form-group alt-slots-box">
                <p className="alt-slots-title">💡 Alternative Available Time Slots</p>
                <p>
                  You marked as unavailable for:{' '}
                  <strong>{selectedOriginalTimeSlot.split(',').join(', ')}</strong>
                </p>
                <p>Consider offering these alternative slots on the same dates:</p>
                <div className="alt-slots-tags">
                  {Object.values(AvailabilityTimeSlot)
                    .filter(slot => !selectedOriginalTimeSlot.split(',').includes(slot))
                    .map(altSlot => (
                      <span key={altSlot} className="alt-slot-tag">{altSlot}</span>
                    ))}
                </div>
                <p className="alt-slots-note">
                  You can submit another change request to offer these slots after this one is processed.
                </p>
              </div>
            )}

            {/* Reason */}
            <div className="form-group">
              <label htmlFor="reason">Reason(s)</label>
              <textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Explain your reason for this change…"
                disabled={isSubmitting}
              />
            </div>

            <div style={{ textAlign: 'center' }}>
              <button
                type="button"
                className="submit-buttons"
                onClick={handleSubmitChangeRequest}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Submitting…' : 'Submit Request'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* ── Modal: View All Availabilities ── */}
      {showModal && (
        <div className="availability-modal-overlay">
          <div className="availability-modal-box">
            <h2 className="availability-modal-title">All Submitted Availabilities</h2>
            {loadingAvailability ? (
              <div className="modal-loading">Loading submitted availabilities…</div>
            ) : availabilityList.length > 0 ? (
              <div className="availability-modal-body">
                {availabilityList.map((entry, idx) => (
                  <div key={idx} className="availability-entry">
                    <p><strong>Days:</strong> {entry.days.join(', ')}</p>
                    <p><strong>Time Slots:</strong> {entry.time_slots.join(', ')}</p>
                    <p><strong>Status:</strong> {entry.status}</p>
                    {entry.remarks && <p><strong>Remarks:</strong> {entry.remarks}</p>}
                  </div>
                ))}
              </div>
            ) : (
              <div className="modal-empty">No availability info found.</div>
            )}
            <div className="modal-footer-actions">
              <button className="modal-btn-primary" onClick={() => setShowModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Confirm Set Availability ── */}
      {showConfirmAvailability && (
        <div className="availability-modal-overlay">
          <div className="availability-modal-box">
            <h2 className="availability-modal-title">Confirm Availability Submission</h2>
            <div className="availability-modal-body">
              <div className="availability-entry">
                <p>
                  <strong>Days:</strong>{' '}
                  {selectedDates.map(d => new Date(d).toLocaleDateString('en-US')).join(', ')}
                </p>
                <p><strong>Time Slots:</strong> {selectedTimeSlots.join(', ')}</p>
                <p><strong>Status:</strong> {availabilityStatus}</p>
                {remarks && <p><strong>Remarks:</strong> {remarks}</p>}
              </div>
            </div>
            <div className="modal-footer-actions">
              <button
                className="modal-btn-secondary"
                onClick={() => setShowConfirmAvailability(false)}
              >
                Back
              </button>
              <button
                className="modal-btn-primary"
                onClick={handleConfirmAvailabilitySubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Submitting…' : 'Confirm & Submit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Confirm Change Request ── */}
      {showConfirmChangeRequest && (
        <div className="availability-modal-overlay">
          <div className="availability-modal-box">
            <h2 className="availability-modal-title">Confirm Change Request</h2>
            <div className="availability-modal-body">
              <div className="availability-entry">
                <p>
                  <strong>Days:</strong>{' '}
                  {selectedOriginalDay
                    .split(',')
                    .filter(Boolean)
                    .map(d => new Date(d).toLocaleDateString('en-US'))
                    .join(', ')}
                </p>
                <p>
                  <strong>Time Slots:</strong>{' '}
                  {selectedOriginalTimeSlot.split(',').filter(Boolean).join(', ')}
                </p>
                <p><strong>New Status:</strong> {changeStatus}</p>
                {reason && <p><strong>Reason:</strong> {reason}</p>}
              </div>
            </div>
            <div className="modal-footer-actions">
              <button
                className="modal-btn-secondary"
                onClick={() => setShowConfirmChangeRequest(false)}
              >
                Back
              </button>
              <button
                className="modal-btn-primary"
                onClick={handleConfirmChangeRequestSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Submitting…' : 'Confirm & Submit'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer position="top-right" autoClose={3000} hideProgressBar />
    </div>
  );
};

export default ProctorSetAvailability;