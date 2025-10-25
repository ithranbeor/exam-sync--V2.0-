import React, { useState, useEffect } from 'react'; 
import '../styles/proctorSetAvailability.css';
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

enum AvailabilityTimeSlot {
  Morning = '7 AM - 1 PM (Morning)',
  Afternoon = '1 PM - 6 PM (Afternoon)',
  Evening = '6 PM - 9 PM (Evening)',
}

interface AvailabilityEntry {
  availability_id: number;
  date: string;
  timeSlot: string;
  status: string;
  remarks?: string;
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const today = new Date();
  const [availabilityList, setAvailabilityList] = useState<AvailabilityEntry[]>([]);
  const [showModal, setShowModal] = useState(false);
  
  // New states for editing
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    const fetchAvailability = async () => {
      if (!user?.user_id) return;

      try {
        const { data } = await api.get(`/tbl_availability/?user_id=${user.user_id}&_sort=day&_order=asc`);

        if (Array.isArray(data)) {
          const formatted = data.map((entry: any) => ({
            availability_id: entry.availability_id,
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
        } else {
          console.error('Unexpected API response format:', data);
        }
      } catch (err) {
        console.error('Error fetching availability:', err);
      }
    };

    fetchAvailability();
    const interval = setInterval(fetchAvailability, 5000);
    return () => clearInterval(interval);
  }, [user.user_id]);

  useEffect(() => {
    const localToday = new Date();
    localToday.setHours(12, 0, 0, 0);
    setCurrentMonth(new Date(localToday.getFullYear(), localToday.getMonth(), 1));
  }, []);

  useEffect(() => {
    const fetchUserRoleAndSchedule = async () => {
      try {
        if (!user?.user_id) return;

        // 1️⃣ Fetch user roles from tbl_user_role
        const { data: roles } = await api.get(`/tbl_user_role`, {
          params: { user_id: user.user_id }
        });
        
        console.log('User roles fetched:', roles);

        if (!Array.isArray(roles) || roles.length === 0) {
          console.error('No roles found for user');
          setCollegeName('');
          setCollegeId(null);
          setAllowedDates([]);
          return;
        }

        // 2️⃣ Check if user is a proctor (role_id = 5)
        const proctorRole = roles.find((r: any) => r.role === 5 || r.role_id === 5);
        if (!proctorRole) {
          console.warn('User is not a proctor');
          setCollegeName('');
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
          setCollegeName('');
          setCollegeId(null);
          setAllowedDates([]);
          return;
        }

        setCollegeId(college_id);
        console.log('Proctor college ID:', college_id);

        // 4️⃣ Fetch college name
        try {
          const { data: college } = await api.get(`/tbl_college/${college_id}/`);
          if (college?.college_name) setCollegeName(college.college_name);
        } catch (err) {
          console.warn('Could not fetch college name:', err);
        }

        // 5️⃣ Fetch exam periods
        const { data: allPeriods } = await api.get(`/tbl_examperiod`);
        if (!Array.isArray(allPeriods)) {
          console.error('Unexpected examperiod response:', allPeriods);
          setAllowedDates([]);
          return;
        }

        console.log('All exam periods:', allPeriods);

        // ✅ Filter by the correct college_id (match the proctor's college)
        const collegePeriods = allPeriods.filter(
          (period: any) => String(period.college_id) === String(college_id)
        );

        console.log('Filtered exam periods for college:', collegePeriods);

        if (collegePeriods.length === 0) {
          console.warn(`No exam periods found for college_id=${college_id}`);
          setAllowedDates([]);
          return;
        }

        // 6️⃣ Generate all valid exam dates for this college
        const generatedDates: string[] = [];
        collegePeriods.forEach((period: any) => {
          if (!period.start_date || !period.end_date) return;
          const start = new Date(period.start_date);
          const end = new Date(period.end_date);
          for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            generatedDates.push(new Date(d).toISOString().split('T')[0]);
          }
        });

        generatedDates.sort();
        setAllowedDates(generatedDates);
        console.log('Allowed dates for proctor:', generatedDates);

        // 7️⃣ Default select today if it's within the allowed dates
        const todayStr = new Date().toISOString().split('T')[0];
        setSelectedDate(generatedDates.includes(todayStr) ? todayStr : '');
        setCurrentMonth(new Date());
      } catch (err) {
        console.error('Error fetching user role or exam schedule:', err);
        setAllowedDates([]);
      }
    };

    fetchUserRoleAndSchedule();

    // Refresh data every 5 seconds
    const interval = setInterval(fetchUserRoleAndSchedule, 5000);
    return () => clearInterval(interval);
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
    const iso = selected.toLocaleDateString("en-CA");

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

    try {
      if (isEditing && editingId) {
        // UPDATE existing entry
        const response = await api.put(`/tbl_availability/${editingId}/`, data);
        if (response.status >= 200 && response.status < 300) {
          toast.success('Availability updated successfully!');
          setRemarks('');
          setIsEditing(false);
          setEditingId(null);
        } else {
          toast.error(`Failed to update availability: ${response.data?.message || 'Unknown error'}`);
        }
      } else {
        // CREATE new entry
        const response = await api.post('/tbl_availability/', data);
        if (response.status >= 200 && response.status < 300) {
          toast.success('Availability set successfully!');
          setRemarks('');
        } else {
          toast.error(`Failed to submit availability: ${response.data?.message || 'Unknown error'}`);
        }
      }
    } catch (err: any) {
      console.error('API error:', err);
      toast.error(`Failed to process availability: ${err?.message || 'Unknown error'}`);
    }

    setIsSubmitting(false);
  };

  const _handleEdit = (entry: AvailabilityEntry) => {
    // Parse the date back to ISO format
    const dateObj = new Date(entry.date);
    const isoDate = dateObj.toISOString().split('T')[0];
    
    setSelectedDate(isoDate);
    setSelectedTimeSlot(entry.timeSlot as AvailabilityTimeSlot);
    setAvailabilityStatus(entry.status);
    setRemarks(entry.remarks || '');
    setEditingId(entry.availability_id);
    setIsEditing(true);
    setShowModal(false);
    
    toast.info('Edit mode activated. Update the form and submit.');
  };

  const _handleDelete = async (availabilityId: number) => {
    if (!globalThis.confirm('Are you sure you want to delete this availability entry?')) {
      return;
    }

    try {
      const response = await api.delete(`/tbl_availability/${availabilityId}/`);
      if (response.status === 204) {
        toast.success('Availability deleted successfully!');
        setAvailabilityList(prev => prev.filter(entry => entry.availability_id !== availabilityId));
      } else {
        toast.error('Failed to delete availability.');
      }
    } catch (err: any) {
      console.error('Delete error:', err);
      toast.error(`Failed to delete: ${err?.message || 'Unknown error'}`);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditingId(null);
    setRemarks('');
    toast.info('Edit cancelled.');
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
          <div className="card-header-set">{isEditing ? 'Edit Availability' : 'Set Availability'}</div>
          <div className="subtitle">(Choose your availability for the exam schedule. Scroll down to request changes.)</div>
          <form onSubmit={handleSubmitAvailability} className="availability-form">
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

            <div style={{ textAlign: 'center', marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                type="submit"
                className="submit-button"
                disabled={isSubmitting}
                style={{ minWidth: '150px' }}
              >
                {isSubmitting ? 'Processing...' : isEditing ? 'Update' : 'Submit'}
              </button>
              {isEditing && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="submit-button"
                  style={{ minWidth: '150px', backgroundColor: '#6c757d' }}
                >
                  Cancel Edit
                </button>
              )}
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

        {showModal && (
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
        )}

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