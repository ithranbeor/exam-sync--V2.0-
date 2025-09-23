import React, { useState, useEffect } from 'react';
import '../styles/proctorSetAvailability.css';
import { FaChevronLeft, FaChevronRight, FaEye } from 'react-icons/fa';
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
  user_fullname?: string; // <-- add this line
}


const SchedulerAvailability: React.FC<ProctorSetAvailabilityProps> = ({ user }) => {
  const [entries, setEntries] = useState<Availability[]>([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<AvailabilityTimeSlot>(AvailabilityTimeSlot.Morning);
  const [availabilityStatus, setAvailabilityStatus] = useState<AvailabilityStatus>(AvailabilityStatus.Available);
  const [remarks, setRemarks] = useState('');
  const [showModal, setShowModal] = useState(false);
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
  }, []);

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

    // Map to include full name
    const mapped = data.map((entry: any) => ({
      ...entry,
      user_fullname: `${entry.tbl_users?.first_name || ''} ${entry.tbl_users?.last_name || ''}`
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
    // Fetch college id of Proctor
    const { data: roles } = await supabase
      .from('tbl_user_role')
      .select('college_id, role_id')
      .eq('user_id', user.user_id);

    const proctorRole = roles?.find(r => r.role_id === 5);
    if (!proctorRole) return;

    const { data: periods } = await supabase
      .from('tbl_examperiod')
      .select('start_date, end_date')
      .eq('college_id', proctorRole.college_id);

    const dates: string[] = [];
    periods?.forEach(period => {
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
    const iso = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day).toISOString().split('T')[0];
    if (allowedDates.includes(iso)) {
      setSelectedDate(iso);
      setShowDatePicker(false);
    }
  };

  const goToPreviousMonth = () => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  const goToNextMonth = () => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  const goToToday = () => {
    const isoToday = today.toISOString().split('T')[0];
    setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDate(allowedDates.includes(isoToday) ? isoToday : '');
  };

  const handleSubmitAvailability = async () => {
    if (!selectedDate) {
      toast.error('Select a valid date.');
      return;
    }
    if (hasSubmitted) {
      toast.info('You already submitted availability.');
      return;
    }
    setIsSubmitting(true);
    const { error } = await supabase.from('tbl_availability').insert([{
      day: selectedDate,
      time_slot: selectedTimeSlot,
      status: availabilityStatus,
      remarks,
      user_id: user.user_id
    }]);
    if (error) toast.error(error.message);
    else {
      toast.success('Availability submitted!');
      setHasSubmitted(true);
      fetchAvailability();
      setShowModal(false);
    }
    setIsSubmitting(false);
  };

  return (
    <div className="colleges-container">
      <div className="colleges-header">
        <h2 className="colleges-title">Set Proctors Availability</h2>
      </div>

      <div className="colleges-actions">
        <button type="button" className="action-button add-new" onClick={() => setShowModal(true)}>
          Add / Edit Availability
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
                  <span style={{
                    padding: '4px 8px',
                    borderRadius: '999px',
                    color: 'white',
                    backgroundColor: entry.status === 'available' ? 'green' : 'red',
                    fontSize: '0.8rem',
                    textTransform: 'capitalize'
                  }}>{entry.status}</span>
                </td>
                <td>
                  {entry.remarks ? (
                    <button className="icon-button view-button" onClick={() => { setSelectedRemarks(entry.remarks!); setShowRemarksModal(true); }}>
                      <FaEye />
                    </button>
                  ) : '—'}
                </td>
                <td>
                  <button className="icon-button delete-button" onClick={async () => {
                    await supabase.from('tbl_availability').delete().eq('availability_id', entry.availability_id);
                    toast.success('Deleted');
                    fetchAvailability();
                    setHasSubmitted(false);
                  }}>Delete</button>
                </td>
              </tr>
            ))}
            {entries.length === 0 && <tr><td colSpan={6}>No entries yet.</td></tr>}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3 style={{ textAlign: 'center' }}>Add / Edit Availability</h3>

            <div className="input-group">
              <label>Day</label>
              <input
                type="text"
                readOnly
                value={selectedDate ? new Date(selectedDate).toLocaleDateString() : 'No date schedule available'}
                onClick={() => allowedDates.length > 0 && setShowDatePicker(!showDatePicker)}
              />
              {showDatePicker && (
                <div className="date-picker">
                  <div className="date-picker-header">
                    <button type="button" onClick={goToPreviousMonth}><FaChevronLeft /></button>
                    <span>{currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
                    <button type="button" onClick={goToNextMonth}><FaChevronRight /></button>
                  </div>
                  <div className="date-picker-grid">
                    {['S','M','T','W','T','F','S'].map((d,i)=> <div key={i} className="day-name">{d}</div>)}
                    {getCalendarDays().map((day,index)=>{
                      const isoDate = day ? new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day).toISOString().split('T')[0] : '';
                      const isAllowed = allowedDates.includes(isoDate);
                      const isSelected = isoDate === selectedDate;
                      return (
                        <div
                          key={index}
                          className={`calendar-day ${day?'selectable':''} ${isSelected?'selected':''} ${isAllowed?'allowed':'disabled'}`}
                          onClick={() => isAllowed && handleDateSelect(day)}
                          style={{ pointerEvents: isAllowed?'auto':'none', opacity:isAllowed?1:0.3 }}
                        >
                          {day}
                        </div>
                      )
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
              <select value={selectedTimeSlot} onChange={(e) => setSelectedTimeSlot(e.target.value as AvailabilityTimeSlot)}>
                {Object.values(AvailabilityTimeSlot).map(slot => <option key={slot} value={slot}>{slot}</option>)}
              </select>
            </div>

            <div className="input-group">
              <label>Status</label>
              <select value={availabilityStatus} onChange={e => setAvailabilityStatus(e.target.value as AvailabilityStatus)}>
                {Object.values(AvailabilityStatus).map(status => <option key={status} value={status}>{status}</option>)}
              </select>
            </div>

            <div className="input-group">
              <label>Remarks</label>
              <textarea value={remarks} onChange={e => setRemarks(e.target.value)} />
            </div>

            <div className="modal-actions">
              <button type="button" onClick={handleSubmitAvailability} disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : 'Save'}
              </button>
              <button type="button" onClick={()=>setShowModal(false)}>Cancel</button>
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
              <button onClick={()=>setShowRemarksModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer position="top-right" autoClose={3000} />
    </div>
  );
};

export default SchedulerAvailability;
