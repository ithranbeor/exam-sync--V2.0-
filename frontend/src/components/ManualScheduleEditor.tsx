import React, { useState, useEffect } from 'react';
import { api } from '../lib/apiClient';
import Select from 'react-select';
import { toast } from 'react-toastify';
import '../styles/ManualScheduleEditor.css';

// ✅ CORRECTED: Added attempted_assignment property
interface UnscheduledSection {
  modality_id: number;
  course_id: string;
  section_name: string;
  sections: string[];
  program_id: string;
  instructor_id?: number;
  instructors?: number[];
  total_students: number;
  possible_rooms: string[];
  conflicts: string[]; // Array of conflict reasons
  is_night_class?: string;
  attempted_assignment?: {
    date: string;
    time: string;
    room: string;
    proctor: number;
  };
}

interface ManualScheduleEditorProps {
  unscheduledSections: UnscheduledSection[];
  examDates: string[];
  schedulerCollegeName: string;
  onClose: () => void;
  onScheduleCreated: (remainingUnscheduled?: any[]) => void;
  academicYear: string;
  semester: string;
  examCategory: string;
  examPeriod: string;
  duration: { hours: number; minutes: number };
}

const ManualScheduleEditor: React.FC<ManualScheduleEditorProps> = ({
  unscheduledSections,
  examDates,
  schedulerCollegeName,
  onClose,
  onScheduleCreated,
  academicYear,
  semester,
  examCategory,
  examPeriod,
  duration
}) => {
  const [selectedSection, setSelectedSection] = useState<UnscheduledSection | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [selectedRoom, setSelectedRoom] = useState<string>('');
  const [selectedProctor, setSelectedProctor] = useState<number | null>(null);
  const [availableProctors, setAvailableProctors] = useState<any[]>([]);
  const [availableRooms, setAvailableRooms] = useState<string[]>([]);
  const [availableTimes, setAvailableTimes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [existingSchedules, setExistingSchedules] = useState<any[]>([]);
  const [roomsCache, setRoomsCache] = useState<any[]>([]);
  const [buildingsCache, setBuildingsCache] = useState<any[]>([]);
  const [remainingSections, setRemainingSections] = useState<UnscheduledSection[]>([]);

  const totalDurationMinutes = duration.hours * 60 + duration.minutes;

  // Time slots (7 AM - 9 PM)
  const allTimeSlots = [
    "07:00", "07:30", "08:00", "08:30", "09:00", "09:30", "10:00", "10:30", 
    "11:00", "11:30", "12:00", "12:30", "13:00", "13:30", "14:00", "14:30", 
    "15:00", "15:30", "16:00", "16:30", "17:00", "17:30", "18:00", "18:30", 
    "19:00", "19:30", "20:00", "20:30"
  ];

  // Convert 24h to 12h format
  const formatTo12Hour = (time: string) => {
    const [hourStr, minute] = time.split(":");
    let hour = Number(hourStr);
    const ampm = hour >= 12 ? "PM" : "AM";
    hour = hour % 12 || 12;
    return `${hour}:${minute} ${ampm}`;
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    setRemainingSections([...unscheduledSections]);
  }, [unscheduledSections]);

  const fetchInitialData = async () => {
    try {
      const [roomsResponse, buildingsResponse, schedulesResponse] = await Promise.all([
        api.get('/tbl_rooms'),
        api.get('/tbl_buildings'),
        api.get('/tbl_examdetails', { params: { college_name: schedulerCollegeName } })
      ]);

      setRoomsCache(roomsResponse.data || []);
      setBuildingsCache(buildingsResponse.data || []);
      setExistingSchedules(schedulesResponse.data || []);
    } catch (error) {
      console.error("Error fetching initial data:", error);
      toast.error("Failed to load data");
    }
  };

  useEffect(() => {
    if (selectedSection && selectedDate && selectedTime) {
      fetchAvailableProctors();
    }
  }, [selectedSection, selectedDate, selectedTime]);

  useEffect(() => {
    if (selectedSection && selectedDate) {
      calculateAvailableRooms();
      calculateAvailableTimes();
    }
  }, [selectedSection, selectedDate, existingSchedules]);

  const timeToMinutes = (time: string): number => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  };

  const rangesOverlap = (start1: number, end1: number, start2: number, end2: number): boolean => {
    return start1 < end2 && start2 < end1;
  };

  const calculateAvailableRooms = () => {
    if (!selectedSection || !selectedDate) {
      setAvailableRooms([]);
      return;
    }

    const schedulesOnDate = existingSchedules.filter(s => s.exam_date === selectedDate);
    const possibleRooms = selectedSection.possible_rooms || [];

    const available = possibleRooms.filter(roomId => {
      // Check if room has conflicts on this date
      const roomSchedules = schedulesOnDate.filter(s => s.room_id === roomId);
      
      if (roomSchedules.length === 0) return true;

      // If we have a selected time, check for time conflicts
      if (selectedTime) {
        const startMinutes = timeToMinutes(selectedTime);
        const endMinutes = startMinutes + totalDurationMinutes;

        return !roomSchedules.some(s => {
          const schedStartMinutes = timeToMinutes(s.exam_start_time?.slice(11, 16) || '00:00');
          const schedEndMinutes = timeToMinutes(s.exam_end_time?.slice(11, 16) || '00:00');
          return rangesOverlap(startMinutes, endMinutes, schedStartMinutes, schedEndMinutes);
        });
      }

      return true;
    });

    setAvailableRooms(available);
  };

  const calculateAvailableTimes = () => {
    if (!selectedSection || !selectedDate) {
      setAvailableTimes([]);
      return;
    }

    const isNightClass = selectedSection.is_night_class === "YES";
    const eveningSlots = ["18:00", "18:30", "19:00", "19:30", "20:00", "20:30"];

    let validTimes = isNightClass 
      ? eveningSlots.filter(t => {
          const [h, m] = t.split(":").map(Number);
          const end = (h * 60 + m) + totalDurationMinutes;
          return end <= 21 * 60;
        })
      : allTimeSlots.filter(t => !eveningSlots.includes(t));

    const schedulesOnDate = existingSchedules.filter(s => s.exam_date === selectedDate);

    const available = validTimes.filter(time => {
      const startMinutes = timeToMinutes(time);
      const endMinutes = startMinutes + totalDurationMinutes;

      if (endMinutes > 21 * 60) return false;

      // Check room conflicts if room is selected
      if (selectedRoom) {
        const roomSchedules = schedulesOnDate.filter(s => s.room_id === selectedRoom);
        const hasRoomConflict = roomSchedules.some(s => {
          const schedStartMinutes = timeToMinutes(s.exam_start_time?.slice(11, 16) || '00:00');
          const schedEndMinutes = timeToMinutes(s.exam_end_time?.slice(11, 16) || '00:00');
          return rangesOverlap(startMinutes, endMinutes, schedStartMinutes, schedEndMinutes);
        });

        if (hasRoomConflict) return false;
      }

      return true;
    });

    setAvailableTimes(available);
  };

  const fetchAvailableProctors = async () => {
    if (!selectedDate || !selectedTime) return;

    try {
      const response = await api.get('/tbl_availability/', {
        params: { status: 'available' }
      });

      const allAvailability = response.data || [];
      const isoDate = selectedDate.includes('T') ? selectedDate.split('T')[0] : selectedDate;
      
      const startMinutes = timeToMinutes(selectedTime);
      const endMinutes = startMinutes + totalDurationMinutes;

      const schedulesOnDate = existingSchedules.filter(s => s.exam_date === selectedDate);

      const availableProctorIds = new Set<number>();

      allAvailability.forEach((avail: any) => {
        const days = avail.days || [];
        const timeSlots = avail.time_slots || [];

        days.forEach((dateStr: string) => {
          const availDate = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
          
          if (availDate === isoDate) {
            timeSlots.forEach((slot: string) => {
              // Check if time slot overlaps with selected time
              const slotStart = timeToMinutes(slot);
              const slotEnd = slotStart + 30; // Assume 30-min slots

              if (rangesOverlap(startMinutes, endMinutes, slotStart, slotEnd)) {
                availableProctorIds.add(avail.user_id);
              }
            });
          }
        });
      });

      // Filter out proctors who already have assignments at this time
      const freeProctors = Array.from(availableProctorIds).filter(proctorId => {
        const proctorSchedules = schedulesOnDate.filter(s => 
          s.proctor_id === proctorId || (s.proctors && s.proctors.includes(proctorId))
        );

        return !proctorSchedules.some(s => {
          const schedStartMinutes = timeToMinutes(s.exam_start_time?.slice(11, 16) || '00:00');
          const schedEndMinutes = timeToMinutes(s.exam_end_time?.slice(11, 16) || '00:00');
          return rangesOverlap(startMinutes, endMinutes, schedStartMinutes, schedEndMinutes);
        });
      });

      const usersResponse = await api.get('/users/');
      const allUsers = usersResponse.data;

      const proctorDetails = freeProctors.map(id => {
        const user = allUsers.find((u: any) => u.user_id === id);
        return user ? {
          user_id: user.user_id,
          first_name: user.first_name,
          last_name: user.last_name
        } : null;
      }).filter(Boolean);

      setAvailableProctors(proctorDetails);

    } catch (error) {
      console.error("Error fetching available proctors:", error);
      toast.error("Failed to fetch available proctors");
    }
  };

  const handleSave = async () => {
    if (!selectedSection || !selectedDate || !selectedTime || !selectedRoom) {
      toast.error("Please fill all required fields");
      return;
    }

    setLoading(true);

    try {
      const [startHour, startMinute] = selectedTime.split(":").map(Number);
      const endHour = startHour + Math.floor((startMinute + totalDurationMinutes) / 60);
      const endMinute = (startMinute + totalDurationMinutes) % 60;
      const endTime = `${String(endHour).padStart(2, "0")}:${String(endMinute).padStart(2, "0")}`;

      const startTimestamp = `${selectedDate}T${selectedTime}:00`;
      const endTimestamp = `${selectedDate}T${endTime}:00`;

      const room = roomsCache.find(r => r.room_id === selectedRoom);
      const building = room ? buildingsCache.find(b => b.building_id === room.building_id) : null;
      const buildingName = building ? `${building.building_name} (${building.building_id})` : "Unknown Building";

      const examPeriods = await api.get('/tbl_examperiod');
      const examDate = new Date(selectedDate);
      const matchedPeriod = examPeriods.data.find((p: any) => {
        const periodStart = new Date(p.start_date);
        const periodEnd = new Date(p.end_date);
        periodStart.setHours(0, 0, 0, 0);
        periodEnd.setHours(23, 59, 59, 999);
        examDate.setHours(12, 0, 0, 0);
        return examDate >= periodStart && examDate <= periodEnd;
      });

      if (!matchedPeriod) {
        toast.error("No matching exam period found for this date");
        setLoading(false);
        return;
      }

      const scheduleData = {
        program_id: selectedSection.program_id,
        course_id: selectedSection.course_id,
        modality_id: selectedSection.modality_id,
        room_id: selectedRoom,
        sections: selectedSection.sections,
        instructors: selectedSection.instructors || [],
        proctors: selectedProctor ? [selectedProctor] : [],
        section_name: selectedSection.sections[0],
        instructor_id: selectedSection.instructors?.[0] || null,
        proctor_id: selectedProctor,
        examperiod_id: matchedPeriod.examperiod_id,
        exam_date: selectedDate,
        exam_start_time: startTimestamp,
        exam_end_time: endTimestamp,
        exam_duration: `${String(duration.hours).padStart(2, '0')}:${String(duration.minutes).padStart(2, '0')}:00`,
        academic_year: academicYear,
        semester: semester,
        exam_category: examCategory,
        exam_period: examPeriod,
        college_name: schedulerCollegeName,
        building_name: buildingName,
        proctor_timein: null,
        proctor_timeout: null,
      };

      await api.post('/tbl_examdetails', scheduleData);

      toast.success(`✅ Scheduled ${selectedSection.course_id} (${selectedSection.sections.join(', ')})`);
      
      // ✅ Remove from remaining sections
      const updatedRemaining = remainingSections.filter(
        s => s.modality_id !== selectedSection.modality_id
      );
      setRemainingSections(updatedRemaining);

      if (updatedRemaining.length === 0) {
        toast.success("🎉 All sections scheduled successfully!");
        onScheduleCreated([]); // Pass empty array to indicate all done
        onClose();
      } else {
        // ✅ Show progress
        const scheduled = unscheduledSections.length - updatedRemaining.length;
        toast.info(
          `Progress: ${scheduled}/${unscheduledSections.length} scheduled (${updatedRemaining.length} remaining)`,
          { autoClose: 3000 }
        );
        
        // Refresh data and reset form for next section
        fetchInitialData();
        setSelectedSection(null);
        setSelectedDate('');
        setSelectedTime('');
        setSelectedRoom('');
        setSelectedProctor(null);
      }

    } catch (error: any) {
      console.error("Error saving schedule:", error);
      toast.error("Failed to save schedule: " + (error?.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    if (!selectedSection) return;
    
    const result = window.confirm(
      `Skip scheduling ${selectedSection.course_id}?\n\n` +
      `You can schedule it later by reopening the manual editor.`
    );
    
    if (result) {
      setSelectedSection(null);
      setSelectedDate('');
      setSelectedTime('');
      setSelectedRoom('');
      setSelectedProctor(null);
      
      toast.info("Section skipped. Select another section to continue.");
    }
  };

  // ✅ Add save and close functionality
  const handleSaveAndClose = () => {
    const result = window.confirm(
      `Close manual scheduling editor?\n\n` +
      `${remainingSections.length} section(s) will remain unscheduled and can be accessed later via "Edit Manually" button.`
    );
    
    if (result) {
      onScheduleCreated(remainingSections);
      onClose();
    }
  };

  return (
    <div className="manual-editor-overlay">
      <div className="manual-editor-container">
        <div className="manual-editor-header">
          <div>
            <h2>Manual Schedule Editor</h2>
            <div style={{ fontSize: '14px', color: '#666', marginTop: '4px' }}>
              {unscheduledSections.length - remainingSections.length} of {unscheduledSections.length} scheduled
            </div>
          </div>
          <button className="close-button" onClick={handleSaveAndClose}>✕</button>
        </div>

        <div className="manual-editor-content">
          {/* Unscheduled Sections List */}
          <div className="unscheduled-list">
            <h3>
              Remaining Sections ({remainingSections.length})
              {remainingSections.length < unscheduledSections.length && (
                <span style={{ color: '#10b981', marginLeft: '8px', fontSize: '14px' }}>
                  ✓ {unscheduledSections.length - remainingSections.length} scheduled
                </span>
              )}
            </h3>
            <div className="sections-list">
              {remainingSections.map(section => (
                <div
                  key={section.modality_id}
                  className={`section-item ${selectedSection?.modality_id === section.modality_id ? 'selected' : ''}`}
                  onClick={() => {
                    setSelectedSection(section);
                    setSelectedDate('');
                    setSelectedTime('');
                    setSelectedRoom('');
                    setSelectedProctor(null);
                  }}
                >
                  <div className="section-header">
                    <strong>{section.course_id}</strong>
                    <span className="section-badge">{section.sections.join(', ')}</span>
                  </div>
                  <div className="section-info">
                    <span>Students: {section.total_students}</span>
                    {section.is_night_class === "YES" && (
                      <span className="night-badge" style={{ 
                        background: '#fbbf24', 
                        padding: '2px 6px', 
                        borderRadius: '4px',
                        fontSize: '11px',
                        marginLeft: '8px'
                      }}>
                        Night Class
                      </span>
                    )}
                  </div>
                  <div className="section-conflicts">
                    {section.conflicts.map((conflict, idx) => (
                      <span key={idx} className="conflict-badge">⚠️ {conflict}</span>
                    ))}
                  </div>
                  {/* ✅ Show attempted assignment if available */}
                  {section.attempted_assignment && (
                    <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>
                      Attempted: {section.attempted_assignment.date} @ {formatTo12Hour(section.attempted_assignment.time)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Scheduling Form */}
          {selectedSection && (
            <div className="scheduling-form">
              <h3>Schedule: {selectedSection.course_id}</h3>
              
              <div className="form-group">
                <label>Select Date *</label>
                <Select
                  options={examDates.map(date => ({
                    value: date,
                    label: new Date(date).toLocaleDateString("en-US", { 
                      year: "numeric", 
                      month: "long", 
                      day: "numeric" 
                    })
                  }))}
                  onChange={(selected) => {
                    setSelectedDate(selected?.value || '');
                    setSelectedTime('');
                    setSelectedRoom('');
                    setSelectedProctor(null);
                  }}
                  value={selectedDate ? {
                    value: selectedDate,
                    label: new Date(selectedDate).toLocaleDateString("en-US", { 
                      year: "numeric", 
                      month: "long", 
                      day: "numeric" 
                    })
                  } : null}
                  placeholder="Select exam date"
                />
              </div>

              {selectedDate && (
                <>
                  <div className="form-group">
                    <label>Select Time * ({availableTimes.length} available)</label>
                    <Select
                      options={availableTimes.map(time => ({
                        value: time,
                        label: formatTo12Hour(time)
                      }))}
                      onChange={(selected) => {
                        setSelectedTime(selected?.value || '');
                        setSelectedProctor(null);
                      }}
                      value={selectedTime ? {
                        value: selectedTime,
                        label: formatTo12Hour(selectedTime)
                      } : null}
                      placeholder="Select start time"
                    />
                  </div>

                  <div className="form-group">
                    <label>Select Room * ({availableRooms.length} available)</label>
                    <Select
                      options={availableRooms.map(roomId => {
                        const room = roomsCache.find(r => r.room_id === roomId);
                        return {
                          value: roomId,
                          label: `${roomId} (Capacity: ${room?.room_capacity || 'N/A'})`
                        };
                      })}
                      onChange={(selected) => setSelectedRoom(selected?.value || '')}
                      value={selectedRoom ? {
                        value: selectedRoom,
                        label: selectedRoom
                      } : null}
                      placeholder="Select room"
                    />
                  </div>

                  {selectedTime && (
                    <div className="form-group">
                      <label>Select Proctor ({availableProctors.length} available)</label>
                      <Select
                        options={availableProctors.map(p => ({
                          value: p.user_id,
                          label: `${p.first_name} ${p.last_name}`
                        }))}
                        onChange={(selected) => setSelectedProctor(selected?.value || null)}
                        value={selectedProctor ? {
                          value: selectedProctor,
                          label: availableProctors.find(p => p.user_id === selectedProctor)
                            ? `${availableProctors.find(p => p.user_id === selectedProctor)?.first_name} ${availableProctors.find(p => p.user_id === selectedProctor)?.last_name}`
                            : ''
                        } : null}
                        placeholder="Select proctor (optional)"
                        isClearable
                      />
                    </div>
                  )}
                </>
              )}

              <div className="form-actions">
                <button
                  className="btn-save"
                  onClick={handleSave}
                  disabled={loading || !selectedDate || !selectedTime || !selectedRoom}
                >
                  {loading ? 'Saving...' : 'Save Schedule'}
                </button>
                <button
                  className="btn-skip"
                  onClick={handleSkip}
                  style={{
                    background: '#f59e0b',
                    color: 'white',
                    padding: '10px 20px',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}
                >
                  Skip for Now
                </button>
                <button
                  className="btn-cancel"
                  onClick={handleSaveAndClose}
                >
                  Save & Close ({remainingSections.length} remaining)
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ManualScheduleEditor;