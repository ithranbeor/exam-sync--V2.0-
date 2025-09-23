import React, { useState, useEffect } from 'react';
import '../styles/proctorSetAvailability.css';
import { FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import { supabase } from '../lib/supabaseClient.ts';
import { ToastContainer, toast } from 'react-toastify';
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


const ProctorSetAvailability: React.FC<ProctorSetAvailabilityProps> = ({ user }) => {
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<AvailabilityTimeSlot>(AvailabilityTimeSlot.Morning);
  const [availabilityStatus, setAvailabilityStatus] = useState('available');
  const [remarks, setRemarks] = useState('');
  const [changeStatus, setChangeStatus] = useState('unavailable');
  const [reason, setReason] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [allowedDates, setAllowedDates] = useState<string[]>([]);
  const [_collegeName, setCollegeName] = useState('');
  const [collegeId, setCollegeId] = useState<number | null>(null);
  const [hasSubmitted, setHasSubmitted] = useState(false); // new
  const [isSubmitting, setIsSubmitting] = useState(false); // prevent duplicate submits
  const today = new Date();
  
  useEffect(() => {
    const checkExistingSubmission = async () => {
      if (!user?.user_id) return;

      const { data, error } = await supabase
        .from('tbl_availability')
        .select('*')
        .eq('user_id', user.user_id)
        .limit(1)
        .single();

      if (!error && data) {
        setHasSubmitted(true); // user already submitted
      } else {
        setHasSubmitted(false);
      }
    };

    checkExistingSubmission();
  }, [user.user_id]);

  // set month to current
  useEffect(() => {
    const localToday = new Date();
    localToday.setHours(12, 0, 0, 0);
    setCurrentMonth(new Date(localToday.getFullYear(), localToday.getMonth(), 1));
  }, []);

  useEffect(() => {
    const fetchUserRoleAndSchedule = async () => {
      // fetch roles of user
      const { data: roles, error: rolesError } = await supabase
        .from('tbl_user_role')
        .select('role_id, college_id')
        .eq('user_id', user.user_id);

      if (rolesError || !roles) {
        console.error('Error fetching user roles:', rolesError?.message);
        return;
      }

      // find Proctor role
      const proctorRole = roles.find(r => r.role_id === 5);
      if (!proctorRole) {
        console.log('User is not a Proctor');
        setCollegeName('');
        setCollegeId(null);
        setAllowedDates([]);
        return;
      }

      const college_id = proctorRole.college_id;
      setCollegeId(college_id); // store college_id

      // fetch college name
      const { data: college, error: collegeError } = await supabase
        .from('tbl_college')
        .select('name')
        .eq('college_id', college_id)
        .single();

      if (!collegeError && college?.name) {
        setCollegeName(college.name);
      }

      // fetch exam periods for this college
      const { data: periods, error: examError } = await supabase
        .from('tbl_examperiod')
        .select('start_date, end_date')
        .eq('college_id', college_id);

      if (examError || !periods) {
        console.error('Error fetching exam periods:', examError?.message);
        setAllowedDates([]);
        return;
      }

      // build allowed date list
      const generatedDates: string[] = [];
      periods.forEach(period => {
        if (!period.start_date || !period.end_date) return;
        const start = new Date(period.start_date);
        const end = new Date(period.end_date);
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          generatedDates.push(new Date(d).toISOString().split('T')[0]);
        }
      });

      generatedDates.sort();
      setAllowedDates(generatedDates);

      // select today if allowed
      const todayStr = new Date().toISOString().split('T')[0];
      setSelectedDate(generatedDates.includes(todayStr) ? todayStr : '');
      setCurrentMonth(new Date());
    };

    // call immediately
    fetchUserRoleAndSchedule();

    // set interval to refresh every 2 seconds
    const interval = setInterval(fetchUserRoleAndSchedule, 2000);

    return () => clearInterval(interval); // cleanup on unmount
  }, [user.user_id]);

  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

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

    const selected = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day, 12);
    const iso = selected.toISOString().split('T')[0];

    if (allowedDates.includes(iso)) {
      setSelectedDate(iso);
      setShowDatePicker(false);
    }
  };

  const goToPreviousMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  // jump to today but only select if allowed
  const goToToday = () => {
    const now = new Date();
    now.setHours(12, 0, 0, 0);
    setCurrentMonth(new Date(now.getFullYear(), now.getMonth(), 1));
    const todayStr = now.toISOString().split('T')[0];
    if (allowedDates.includes(todayStr)) {
      setSelectedDate(todayStr);
    } else {
      setSelectedDate('');
    }
  };

  const availabilityOptions = ['available', 'unavailable'];

  const handleSubmitAvailability = async (e: React.FormEvent) => {
    e.preventDefault();

    if (hasSubmitted) {
      toast.info('You have already submitted your availability. Delete previous entry to submit again.');
      return;
    }

    if (isSubmitting) return;
    setIsSubmitting(true);

    const userId = user?.user_id;
    if (!userId) {
      toast.info('User is not logged in.');
      setIsSubmitting(false);
      return;
    }

    // Default date to first allowed date if none selected
    let submitDate = selectedDate;
    if (!submitDate) {
      if (allowedDates.length === 0) {
        toast.info('No available dates to submit.');
        setIsSubmitting(false);
        return;
      }
      submitDate = allowedDates[0];
      setSelectedDate(submitDate);
    }

    // Default time slot and status
    const submitTimeSlot = selectedTimeSlot || AvailabilityTimeSlot.Morning;
    const submitStatus = availabilityStatus || 'available';

    // Check if the user already has a record
    const { data: existing, error: checkError } = await supabase
      .from('tbl_availability')
      .select('availability_id')
      .eq('user_id', userId)
      .maybeSingle(); // <- important fix

    if (checkError) {
      console.error('Error checking existing availability:', checkError);
      toast.info('Failed to check existing availability.');
      setIsSubmitting(false);
      return;
    }

    if (existing) {
      alert('You have already submitted your availability. Delete previous entry to submit again.');
      setHasSubmitted(true);
      setIsSubmitting(false);
      return;
    }

    const data = {
      day: submitDate,
      time_slot: submitTimeSlot,
      status: submitStatus,
      remarks: remarks || null,
      user_id: userId,
    };

    const { error: insertError } = await supabase
      .from('tbl_availability')
      .insert([data]);

    if (insertError) {
      console.error('Supabase insert error:', insertError);
      toast.error(`Failed to submit availability: ${insertError.message}`);
    } else {
      toast.success('Availability set successfully!');
      setHasSubmitted(true);
      setRemarks('');
    }

    setIsSubmitting(false);
  };

  const handleSubmitChangeRequest = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Change request:', { changeStatus, reason });
    toast.success('Change request submitted!');
  };

  return (
    <div className="set-availability-container">
      <div className="availability-sections">
        <div className="availability-card">
          <div className="card-header-set">Set Availability</div>
          <div className="subtitle">(Choose your availability for the exam schedule. Scroll down to request changes.)</div>
          <form onSubmit={handleSubmitAvailability} className="availability-form">
            {/* Day Picker */}
            <div className="form-group">
              <label htmlFor="day">Day</label>
              <div className="custom-select-wrapper">
                <input
                  type="text"
                  id="day"
                  value={
                    allowedDates.length > 0
                      ? selectedDate
                        ? new Date(selectedDate).toLocaleDateString('en-US', {
                            month: 'long',
                            day: 'numeric',
                            year: 'numeric',
                          })
                        : new Date(allowedDates[allowedDates.length - 1]).toLocaleDateString('en-US', {
                            month: 'long',
                            day: 'numeric',
                            year: 'numeric',
                          })
                      : `No date schedule available for ${collegeId ?? 'N/A'}`
                  }
                  readOnly
                  onClick={() => (allowedDates.length > 0 && !(hasSubmitted || isSubmitting)) && setShowDatePicker(!showDatePicker)}
                  className="date-input-field"
                  style={{ cursor: hasSubmitted || isSubmitting ? 'not-allowed' : 'pointer' }}
                />
                <span
                  className="dropdown-arrow"
                  onClick={() => (allowedDates.length > 0 && !(hasSubmitted || isSubmitting)) && setShowDatePicker(!showDatePicker)}
                >
                  &#9660;
                </span>

                {showDatePicker && (
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
                        const isAllowed = allowedDates.includes(isoDate) && !(hasSubmitted || isSubmitting);
                        const isSelected = isoDate === selectedDate;
                        const isToday = dayDate && dayDate.toDateString() === today.toDateString();

                        return (
                          <div
                            key={index}
                            className={`calendar-day 
                              ${day ? 'selectable' : ''} 
                              ${isSelected ? 'selected' : ''} 
                              ${isToday && !isSelected ? 'today' : ''} 
                              ${isAllowed ? 'allowed' : 'disabled'}`}
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
            </div>

            {/* Time Slot */}
            <div className="form-group">
              <label htmlFor="timeSlot">Time Slot</label>
              <div className="custom-select-wrapper">
                <select
                  id="timeSlot"
                  value={selectedTimeSlot}
                  onChange={(e) => setSelectedTimeSlot(e.target.value as AvailabilityTimeSlot)}
                  disabled={hasSubmitted || isSubmitting}
                >
                  {Object.values(AvailabilityTimeSlot).map(slot => (
                    <option key={slot} value={slot}>{slot}</option>
                  ))}
                </select>
                <span className="dropdown-arrow">&#9660;</span>
              </div>
            </div>

            {/* Status */}
            <div className="form-group">
              <label htmlFor="status">Status</label>
              <div className="custom-select-wrapper">
                <select
                  id="status"
                  value={availabilityStatus}
                  onChange={(e) => setAvailabilityStatus(e.target.value)}
                  disabled={hasSubmitted || isSubmitting}
                  className="custom-select"
                >
                  {availabilityOptions.map(option => (
                    <option key={option} value={option}>{option.charAt(0).toUpperCase() + option.slice(1)}</option>
                  ))}
                </select>
                <span className="dropdown-arrow">&#9660;</span>
              </div>
            </div>

            {/* Remarks */}
            <div className="form-group">
              <label htmlFor="remarks">Remarks</label>
              <textarea
                id="remarks"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Type here..."
                disabled={hasSubmitted || isSubmitting}
              ></textarea>
            </div>

            {/* Centered Submit Button */}
            <div style={{ textAlign: 'center', marginTop: '20px' }}>
              <button
                type="submit"
                className="submit-button"
                disabled={hasSubmitted || isSubmitting}
                style={{ minWidth: '150px' }}
              >
                {isSubmitting ? 'Submitting...' : 'Submit'}
              </button>
            </div>

            {/* Info message if already submitted */}
            {hasSubmitted && (
              <p className="info-text" style={{ textAlign: 'center', marginTop: '10px' }}>
                You have already submitted your availability. You can only submit again if your previous entry is deleted.
              </p>
            )}
          </form>
        </div>

        <div className="availability-card">
          <div className="card-header-request">Request Change of Availability</div>
          <div className="subtitle">(only available after the release of exam schedule)</div>
          <form onSubmit={handleSubmitChangeRequest} className="availability-form">
            <div className="form-group">
              <label htmlFor="changeStatus">Status</label>
              <div className="custom-select-wrapper">
                <select
                  id="changeStatus"
                  value={changeStatus}
                  onChange={(e) => setChangeStatus(e.target.value)}
                  className="custom-select"
                >
                  {availabilityOptions.map(option => (
                    <option key={option} value={option}>{option.charAt(0).toUpperCase() + option.slice(1)}</option>
                  ))}
                </select>
                <span className="dropdown-arrow">&#9660;</span>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="reason">Reason/s</label>
              <textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Type here..."
              ></textarea>
            </div>

            <button type="submit" className="submit-button">Submit</button>
          </form>
        </div>
      </div>
        <ToastContainer position="top-right" autoClose={3000} hideProgressBar />
    </div>
  );
};

export default ProctorSetAvailability;
