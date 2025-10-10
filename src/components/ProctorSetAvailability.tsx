import React, { useState, useEffect } from 'react';
import '../styles/proctorSetAvailability.css';
import { FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import { supabase } from '../lib/supabaseClient.ts';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Select from 'react-select';

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
  const [isSubmitting, setIsSubmitting] = useState(false); // prevent duplicate submits
  const today = new Date();
  const [availabilityList, setAvailabilityList] = useState<
    { date: string; timeSlot: string; status: string; remarks?: string }[]
  >([]);
  const [showModal, setShowModal] = useState(false);
  
  useEffect(() => {
    const fetchAvailability = async () => {
      if (!user?.user_id) return;

      const { data, error } = await supabase
        .from('tbl_availability')
        .select('day, time_slot, status, remarks')
        .eq('user_id', user.user_id)
        .order('day', { ascending: true });

      if (!error && data) {
        const formatted = data.map((entry: any) => ({
          date: new Date(entry.day).toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          }),
          timeSlot: entry.time_slot,
          status: entry.status,
          remarks: entry.remarks,
        }));

        setAvailabilityList(formatted);
      }
    };

    fetchAvailability();

    // optional: refresh every few seconds
    const interval = setInterval(fetchAvailability, 5000);
    return () => clearInterval(interval);
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
          generatedDates.push(new Date(d).toLocaleDateString("en-CA")); // <-- FIXED
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

    const selected = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    const iso = selected.toLocaleDateString("en-CA"); // <-- FIXED

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

    if (isSubmitting) return;
    setIsSubmitting(true);

    const userId = user?.user_id;
    if (!userId) {
      toast.info('User is not logged in.');
      setIsSubmitting(false);
      return;
    }

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

    const submitTimeSlot = selectedTimeSlot || AvailabilityTimeSlot.Morning;
    const submitStatus = availabilityStatus || 'available';

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
      setRemarks('');
      // Optionally refresh availability info here
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
                  onClick={() => (allowedDates.length > 0 && !(isSubmitting)) && setShowDatePicker(!showDatePicker)}
                  className="date-input-field"
                  style={{ cursor: isSubmitting ? 'not-allowed' : 'pointer', color: "black" }}
                />
                <span
                  className="dropdown-arrow"
                  onClick={() => (allowedDates.length > 0 && !(isSubmitting)) && setShowDatePicker(!showDatePicker)}
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
                        const isAllowed = allowedDates.includes(isoDate) && !(isSubmitting);
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
              <Select
                id="timeSlot"
                value={{ value: selectedTimeSlot, label: selectedTimeSlot }}
                onChange={(option) => setSelectedTimeSlot(option?.value as AvailabilityTimeSlot)}
                options={Object.values(AvailabilityTimeSlot).map(slot => ({ value: slot, label: slot }))}
                isDisabled={isSubmitting}
                classNamePrefix="react-select"
                placeholder="Select Time Slot"
                isSearchable
              />
            </div>
            {/* Status */}
            <div className="form-group">
              <label htmlFor="status">Status</label>
              <div className="custom-select-wrapper">
                <select
                  id="status"
                  value={availabilityStatus}
                  onChange={(e) => setAvailabilityStatus(e.target.value)}
                  disabled={isSubmitting}
                  style={{color: "black"}}
                  className="custom-select"
                >
                  {availabilityOptions.map(option => (
                    <option key={option} value={option}>{option.charAt(0).toUpperCase() + option.slice(1)}</option>
                  ))}
                </select>
                <span className="dropdown-arrow"></span>
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
                disabled={isSubmitting}
              ></textarea>
            </div>

            {/* Centered Submit Button */}
            <div style={{ textAlign: 'center', marginTop: '20px' }}>
              <button
                type="submit"
                className="submit-button"
                disabled={isSubmitting}
                style={{ minWidth: '150px' }}
              >
                {isSubmitting ? 'Submitting...' : 'Submit'}
              </button>
            </div>
            <div style={{ textAlign: 'center', marginTop: '10px' }}>
              <span
                style={{ color: '#092C4C', cursor: 'pointer', textDecoration: 'underline' }}
                onClick={() => setShowModal(true)}
              >
                Click here to "view" all submitted availabilities
              </span>
            </div>

          </form>
        </div>
        {showModal &&
        <div className="availability-modal-overlay">
          <div className="availability-modal-box">
            <h2 className="availability-modal-title">All Submitted Availabilities</h2>
            {availabilityList.length > 0 ? (
              <div className="availability-modal-body">
                {availabilityList.map((entry, idx) => (
                  <div key={idx} className="availability-entry">
                    <p><strong>Date:</strong> {entry.date}</p>
                    <p><strong>Time Slot:</strong> {entry.timeSlot}</p>
                    <p><strong>Status:</strong> {entry.status}</p>
                    {entry.remarks && <p><strong>Remarks:</strong> {entry.remarks}</p>}
                    <hr />
                  </div>
                ))}
              </div>
            ) : (
              <p className="availability-modal-body">No availability info found.</p>
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
      }

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
                  style={{color: "black"}}
                  onChange={(e) => setChangeStatus(e.target.value)}
                  className="custom-select"
                >
                  {availabilityOptions.map(option => (
                    <option key={option} value={option}>{option.charAt(0).toUpperCase() + option.slice(1)}</option>
                  ))}
                </select>
                <span className="dropdown-arrow"></span>
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
