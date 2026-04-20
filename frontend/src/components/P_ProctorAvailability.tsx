import React, { useState, useEffect } from 'react';
import '../styles/P_ProctorAvailability.css';
import { FaChevronLeft, FaChevronRight, FaCalendarAlt, FaCheckCircle } from 'react-icons/fa';
import { api } from '../lib/apiClient.ts';
import { ToastContainer, toast } from 'react-toastify';
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

export type AvailabilityTimeSlot =
  (typeof AvailabilityTimeSlot)[keyof typeof AvailabilityTimeSlot];

const TIME_SLOTS = [
  {
    key: 'Morning',
    value: AvailabilityTimeSlot.Morning,
    label: 'Morning',
    sub: '7 AM – 1 PM',
    emoji: '🌅',
  },
  {
    key: 'Afternoon',
    value: AvailabilityTimeSlot.Afternoon,
    label: 'Afternoon',
    sub: '1 PM – 6 PM',
    emoji: '☀️',
  },
  {
    key: 'Evening',
    value: AvailabilityTimeSlot.Evening,
    label: 'Evening',
    sub: '6 PM – 9 PM',
    emoji: '🌙',
  },
];

const ProctorSetAvailability: React.FC<ProctorSetAvailabilityProps> = ({ user }) => {
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [selectedTimeSlots, setSelectedTimeSlots] = useState<AvailabilityTimeSlot[]>([]);
  const [_availableDays, setAvailableDays] = useState<string[]>([]);
  const [dayToTimeSlots, setDayToTimeSlots] = useState<Record<string, string[]>>({});
  const [availabilityStatus] = useState('available');
  const [remarks, setRemarks] = useState('');
  // ── Change Request state (hidden but preserved) ──
  const [selectedOriginalDay, setSelectedOriginalDay] = useState<string>('');
  const [selectedOriginalTimeSlot, setSelectedOriginalTimeSlot] = useState<string>('');
  const [changeStatus, setChangeStatus] = useState('unavailable');
  const [reason, setReason] = useState('');
  const [showConfirmChangeRequest, setShowConfirmChangeRequest] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [allowedDates, setAllowedDates] = useState<string[]>([]);
  const [_collegeId, setCollegeId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [availabilityList, setAvailabilityList] = useState<
    { days: string[]; time_slots: string[]; status: string; remarks?: string }[]
  >([]);
  const [showModal, setShowModal] = useState(false);
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [loadingAllowedDates, setLoadingAllowedDates] = useState(false);
  const [showConfirmAvailability, setShowConfirmAvailability] = useState(false);

  const today = new Date();

  // Format date as "May 18, 2026"
  const formatDate = (iso: string) =>
    new Date(iso + 'T12:00:00').toLocaleDateString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric',
    });

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

  // Jump calendar to the month containing the earliest allowed exam date
  useEffect(() => {
    if (allowedDates.length > 0) {
      const earliest = new Date(allowedDates[0] + 'T12:00:00');
      setCurrentMonth(new Date(earliest.getFullYear(), earliest.getMonth(), 1));
    } else {
      const localToday = new Date();
      localToday.setHours(12, 0, 0, 0);
      setCurrentMonth(new Date(localToday.getFullYear(), localToday.getMonth(), 1));
    }
  }, [allowedDates]);

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

  const toggleTimeSlot = (slot: AvailabilityTimeSlot) => {
    setSelectedTimeSlots(prev =>
      prev.includes(slot) ? prev.filter(s => s !== slot) : [...prev, slot]
    );
  };

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
      setRemarks('');
      setShowConfirmAvailability(false);
    } catch (err: any) {
      toast.error(`Failed to process availability: ${err?.message || 'Unknown error'}`);
    }
    setIsSubmitting(false);
  };

  const isPastDate = (dateStr: string): boolean => {
    const d = new Date(); d.setHours(0, 0, 0, 0);
    return new Date(dateStr) < d;
  };

  const availabilityOptions = ['available', 'unavailable'];

  // ── Submit change request (hidden, preserved for future use) ──────────────
  const handleSubmitChangeRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    const days = selectedOriginalDay.split(',').filter(Boolean);
    const slots = selectedOriginalTimeSlot.split(',').filter(Boolean);
    if (days.length === 0 || slots.length === 0) {
      toast.info('Please select at least one day and one time slot.'); return;
    }
    if (!user?.user_id) { toast.info('User is not logged in.'); return; }
    setShowConfirmChangeRequest(true);
  };

  const handleConfirmChangeRequestSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    const selectedDaysChange = selectedOriginalDay.split(',').filter(Boolean);
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
        days: selectedDaysChange,
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
          const dateLabels = selectedDaysChange
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
          <p>Set your availability for the exam schedule</p>
        </div>
      </div>

      {/* ── Single Card: Set Availability ── */}
      <div className="availability-card availability-card--single">
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
                      ? selectedDates.map(d => formatDate(d)).join(', ')
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

          {/* ── Time Slot Pills ── */}
          <div className="form-group">
            <label>Time Slot(s)</label>
            <div className="timeslot-track">
              {TIME_SLOTS.map((slot) => {
                const isActive = selectedTimeSlots.includes(slot.value);
                return (
                  <button
                    key={slot.key}
                    type="button"
                    className={`timeslot-pill ${isActive ? 'timeslot-pill--active' : ''}`}
                    onClick={() => !isSubmitting && toggleTimeSlot(slot.value)}
                    disabled={isSubmitting}
                  >
                    <span className="timeslot-pill__label">{slot.label}</span>
                    <span className="timeslot-pill__sub">{slot.sub}</span>
                    {isActive && <FaCheckCircle className="timeslot-pill__check" />}
                  </button>
                );
              })}
            </div>
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

          {/* Action Buttons */}
          <div className="form-actions">
            <button
              type="button"
              className="btn-outline"
              onClick={() => setShowModal(true)}
            >
              View Submitted
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Submitting…' : 'Submit Availability'}
            </button>
          </div>

        </form>
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
                {(() => {
                  // Merge entries by day → collect all slots per day
                  const merged: Record<string, { slots: string[]; statuses: string[]; remarks: string[] }> = {};
                  availabilityList.forEach(entry => {
                    entry.days.forEach(day => {
                      if (!merged[day]) merged[day] = { slots: [], statuses: [], remarks: [] };
                      entry.time_slots.forEach(slot => {
                        if (!merged[day].slots.includes(slot)) merged[day].slots.push(slot);
                      });
                      if (!merged[day].statuses.includes(entry.status)) merged[day].statuses.push(entry.status);
                      if (entry.remarks && !merged[day].remarks.includes(entry.remarks)) merged[day].remarks.push(entry.remarks);
                    });
                  });
                  // Sort slots in time order
                  const slotOrder = Object.values(AvailabilityTimeSlot);
                  const sortedDays = Object.keys(merged).sort();
                  return sortedDays.map(day => (
                    <div key={day} className="availability-entry">
                      <p><strong>Date:</strong> {formatDate(day)}</p>
                      <p><strong>Time Slots:</strong> {
                        merged[day].slots
                          .sort((a, b) => slotOrder.indexOf(a as any) - slotOrder.indexOf(b as any))
                          .join(', ')
                      }</p>
                      <p><strong>Status:</strong> {merged[day].statuses.join(', ')}</p>
                      {merged[day].remarks.length > 0 && (
                        <p><strong>Remarks:</strong> {merged[day].remarks.join('; ')}</p>
                      )}
                    </div>
                  ));
                })()}
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
                  {selectedDates.map(d => formatDate(d)).join(', ')}
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

      {/* ── Card 2: Request Change — hidden but preserved ── */}
      {false && (
        <div className="availability-card">
          <div className="card-header-request">Request Change of Availability</div>
          <p className="subtitle">(Request a change to your existing availability)</p>

          <form onSubmit={handleSubmitChangeRequest} className="availability-form">

            <div className="form-group">
              <label htmlFor="originalDays">Schedule Day(s)</label>
              <select
                id="originalDays"
                multiple
                value={selectedOriginalDay.split(',').filter(Boolean)}
                onChange={(e) => {
                  const selected = Array.from(e.target.selectedOptions).map(o => o.value);
                  setSelectedOriginalDay(selected.join(','));
                  setSelectedOriginalTimeSlot('');
                }}
                disabled={isSubmitting || allowedDates.length === 0}
              >
                {allowedDates.filter(day => !isPastDate(day)).map(day => (
                  <option key={day} value={day}>
                    {formatDate(day)}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="originalTimeSlots">
                {changeStatus === 'unavailable' ? 'Time Slot(s) to Mark Unavailable' : 'Time Slot(s)'}
              </label>
              <select
                id="originalTimeSlots"
                multiple
                value={selectedOriginalTimeSlot.split(',').filter(Boolean)}
                onChange={(e) => {
                  const selected = Array.from(e.target.selectedOptions).map(o => o.value);
                  setSelectedOriginalTimeSlot(selected.join(','));
                }}
                disabled={!selectedOriginalDay || isSubmitting}
              >
                {(selectedOriginalDay
                  ? Array.from(new Set(
                      selectedOriginalDay.split(',').filter(d => !isPastDate(d))
                        .flatMap(day => dayToTimeSlots[day] || [])
                    ))
                  : Object.values(AvailabilityTimeSlot)
                ).map(slot => (
                  <option key={slot} value={slot}>{slot}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="changeStatus">New Status</label>
              <select
                id="changeStatus"
                value={changeStatus}
                onChange={(e) => setChangeStatus(e.target.value)}
                disabled={isSubmitting}
              >
                {availabilityOptions.map(opt => (
                  <option key={opt} value={opt}>{opt.charAt(0).toUpperCase() + opt.slice(1)}</option>
                ))}
              </select>
            </div>

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

            <div className="form-actions">
              <button type="submit" className="btn-primary" disabled={isSubmitting}>
                {isSubmitting ? 'Submitting…' : 'Submit Request'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Modal: Confirm Change Request — hidden but preserved ── */}
      {false && showConfirmChangeRequest && (
        <div className="availability-modal-overlay">
          <div className="availability-modal-box">
            <h2 className="availability-modal-title">Confirm Change Request</h2>
            <div className="availability-modal-body">
              <div className="availability-entry">
                <p>
                  <strong>Days:</strong>{' '}
                  {selectedOriginalDay.split(',').filter(Boolean)
                    .map(d => formatDate(d)).join(', ')}
                </p>
                <p><strong>Time Slots:</strong> {selectedOriginalTimeSlot.split(',').filter(Boolean).join(', ')}</p>
                <p><strong>New Status:</strong> {changeStatus}</p>
                {reason && <p><strong>Reason:</strong> {reason}</p>}
              </div>
            </div>
            <div className="modal-footer-actions">
              <button className="modal-btn-secondary" onClick={() => setShowConfirmChangeRequest(false)}>Back</button>
              <button className="modal-btn-primary" onClick={handleConfirmChangeRequestSubmit} disabled={isSubmitting}>
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