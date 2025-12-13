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
      // ✅ Get scheduler's college
      const userRolesResponse = await api.get('/tbl_user_role', {
        params: {
          role_id: 3 // Scheduler role
        }
      });

      const schedulerRoles = userRolesResponse.data || [];
      const schedulerRole = schedulerRoles.find((r: any) =>
        r.college_name === schedulerCollegeName ||
        r.college?.college_name === schedulerCollegeName
      );

      if (!schedulerRole) {
        console.error('❌ Scheduler college not found');
        setAvailableProctors([]);
        return;
      }

      const schedulerCollegeId = schedulerRole.college_id || schedulerRole.college?.college_id;
      console.log(`📍 Scheduler college ID: ${schedulerCollegeId}`);

      // ✅ Get all users
      const usersResponse = await api.get('/users/');
      const allUsers = usersResponse.data;

      // ✅ Get proctor roles for the scheduler's college
      const proctorRolesResponse = await api.get('/tbl_user_role', {
        params: {
          role_id: 5 // Proctor role
        }
      });

      const allProctorRoles = proctorRolesResponse.data || [];

      // ✅ Get departments under scheduler's college
      const departmentsResponse = await api.get('/departments/', {
        params: {
          college_id: schedulerCollegeId
        }
      });
      const departmentIds = departmentsResponse.data?.map((d: any) => d.department_id) || [];

      // ✅ Filter proctor roles by college or department
      const collegeProctorIds = new Set<number>();
      allProctorRoles.forEach((p: any) => {
        if (p.college_id && String(p.college_id) === String(schedulerCollegeId)) {
          collegeProctorIds.add(p.user_id);
        } else if (p.department_id && departmentIds.includes(p.department_id)) {
          collegeProctorIds.add(p.user_id);
        }
      });

      console.log(`🔍 Found ${collegeProctorIds.size} proctors in college/departments`);

      // ✅ Calculate time range for conflict checking
      const startMinutes = timeToMinutes(selectedTime);
      const endMinutes = startMinutes + totalDurationMinutes;

      const schedulesOnDate = existingSchedules.filter(s => s.exam_date === selectedDate);

      // ✅ Filter out proctors with conflicts
      const freeProctors = Array.from(collegeProctorIds).filter(proctorId => {
        const proctorSchedules = schedulesOnDate.filter(s =>
          s.proctor_id === proctorId || (s.proctors && s.proctors.includes(proctorId))
        );

        return !proctorSchedules.some(s => {
          const schedStartMinutes = timeToMinutes(s.exam_start_time?.slice(11, 16) || '00:00');
          const schedEndMinutes = timeToMinutes(s.exam_end_time?.slice(11, 16) || '00:00');
          return rangesOverlap(startMinutes, endMinutes, schedStartMinutes, schedEndMinutes);
        });
      });

      // ✅ Get user details and filter by employment type
      const proctorDetails = freeProctors
        .map(id => allUsers.find((u: any) => u.user_id === id))
        .filter(user => user) // Remove undefined
        .map(user => ({
          user_id: user.user_id,
          first_name: user.first_name,
          last_name: user.last_name,
          employment_type: user.employment_type || 'not-specified'
        }));

      console.log(`✅ Found ${proctorDetails.length} available proctors (conflict-free)`);
      setAvailableProctors(proctorDetails);

    } catch (error) {
      console.error("Error fetching available proctors:", error);
      toast.error("Failed to fetch available proctors");
      setAvailableProctors([]);
    }
  };

  const handleSave = async () => {
    if (!selectedSection) return;

    const needs = analyzeConflicts(selectedSection);

    // Use selected values or fall back to attempted values
    const finalDate = selectedDate || selectedSection.attempted_assignment?.date || '';
    const finalTime = selectedTime || selectedSection.attempted_assignment?.time || '';
    const finalRoom = selectedRoom || selectedSection.attempted_assignment?.room || '';

    // Validate required fields
    if (!finalDate) {
      toast.error("Date is required");
      return;
    }

    if (needs.time && !finalTime) {
      toast.error("Time is required to resolve conflict");
      return;
    }

    if (needs.room && !finalRoom) {
      toast.error("Room is required to resolve conflict");
      return;
    }

    setLoading(true);

    try {
      const [startHour, startMinute] = finalTime.split(":").map(Number);
      const endHour = startHour + Math.floor((startMinute + totalDurationMinutes) / 60);
      const endMinute = (startMinute + totalDurationMinutes) % 60;
      const endTime = `${String(endHour).padStart(2, "0")}:${String(endMinute).padStart(2, "0")}`;

      const startTimestamp = `${finalDate}T${finalTime}:00`;
      const endTimestamp = `${finalDate}T${endTime}:00`;

      const room = roomsCache.find(r => r.room_id === finalRoom);
      const building = room ? buildingsCache.find(b => b.building_id === room.building_id) : null;
      const buildingName = building ? `${building.building_name} (${building.building_id})` : "Unknown Building";

      const examPeriods = await api.get('/tbl_examperiod');
      const examDate = new Date(finalDate);
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
        room_id: finalRoom,
        sections: selectedSection.sections,
        instructors: selectedSection.instructors || [],
        proctors: selectedProctor ? [selectedProctor] : [],
        section_name: selectedSection.sections[0],
        instructor_id: selectedSection.instructors?.[0] || null,
        proctor_id: selectedProctor,
        examperiod_id: matchedPeriod.examperiod_id,
        exam_date: finalDate,
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

  // Add this helper function after the imports
  const analyzeConflicts = (section: UnscheduledSection) => {
    const conflicts = section.conflicts || [];
    const needs = {
      date: false,
      time: false,
      room: false,
      proctor: false
    };

    conflicts.forEach(conflict => {
      const lower = conflict.toLowerCase();

      // Date conflicts
      if (lower.includes('split across multiple dates') ||
        lower.includes('no matching exam period')) {
        needs.date = true;
      }

      // Time conflicts - including proctor conflicts which need time change
      if (lower.includes('invalid time') ||
        lower.includes('after 9 pm') ||
        lower.includes('would end after') ||
        lower.includes('proctor conflict at this time') || // ✅ This means we need new time
        lower.includes('time conflict')) {
        needs.time = true;
      }

      // Room conflicts
      if (lower.includes('room conflict') ||
        lower.includes('no suitable room') ||
        lower.includes('capacity')) {
        needs.room = true;
      }

      // Pure proctor unavailability (not time-related)
      if (lower.includes('no available proctor') &&
        !lower.includes('at this time')) {
        needs.proctor = true;
      }
    });

    return needs;
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

              {/* Show conflict summary */}
              <div style={{
                background: '#fef3c7',
                padding: '12px',
                borderRadius: '8px',
                marginBottom: '16px',
                border: '1px solid #f59e0b'
              }}>
                <strong>Conflicts to resolve:</strong>
                <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px' }}>
                  {selectedSection.conflicts.map((conflict, idx) => (
                    <li key={idx} style={{ fontSize: '13px', marginBottom: '4px' }}>
                      {conflict}
                    </li>
                  ))}
                </ul>
              </div>

              {(() => {
                const needs = analyzeConflicts(selectedSection);
                const needsMultiple = Object.values(needs).filter(Boolean).length > 1;

                // Pre-fill attempted values if available
                if (selectedSection.attempted_assignment && !selectedDate && !selectedTime && !selectedRoom) {
                  const attempted = selectedSection.attempted_assignment;
                  if (!needs.date && attempted.date) setSelectedDate(attempted.date);
                  if (!needs.time && attempted.time) setSelectedTime(attempted.time);
                  if (!needs.room && attempted.room) setSelectedRoom(attempted.room);
                }

                // ✅ Separate proctors by employment type
                const fullTimeProctors = availableProctors.filter(p => p.employment_type === 'full-time');
                const otherProctors = availableProctors.filter(p => p.employment_type !== 'full-time');

                return (
                  <>
                    {needs.date && (
                      <div className="form-group">
                        <label>
                          {needsMultiple ? '✅ ' : ''}Select Date *
                          {!needsMultiple && (
                            <span style={{ color: '#f59e0b', fontSize: '12px', marginLeft: '8px' }}>
                              (This is the only conflict)
                            </span>
                          )}
                        </label>
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
                            if (!needs.time && !needs.room && !needs.proctor) {
                              // Auto-fill others if this is the only conflict
                              if (selectedSection.attempted_assignment) {
                                setSelectedTime(selectedSection.attempted_assignment.time);
                                setSelectedRoom(selectedSection.attempted_assignment.room);
                              }
                            }
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
                    )}

                    {needs.time && selectedDate && (
                      <div className="form-group">
                        <label>
                          {needsMultiple ? '✅ ' : ''}Select Time * ({availableTimes.length} available)
                          {!needsMultiple && (
                            <span style={{ color: '#f59e0b', fontSize: '12px', marginLeft: '8px' }}>
                              (Need different time to find available proctor)
                            </span>
                          )}
                        </label>

                        {/* ✅ Add helpful message */}
                        {selectedSection.conflicts.some(c => c.toLowerCase().includes('proctor conflict at this time')) && (
                          <div style={{
                            background: '#e0f2fe',
                            padding: '8px',
                            borderRadius: '4px',
                            fontSize: '12px',
                            color: '#0369a1',
                            marginBottom: '8px'
                          }}>
                            💡 The assigned proctor is busy at {selectedSection.attempted_assignment?.time
                              ? formatTo12Hour(selectedSection.attempted_assignment.time)
                              : 'the original time'}. Select a different time to find an available proctor.
                          </div>
                        )}

                        <Select
                          options={availableTimes.map(time => ({
                            value: time,
                            label: formatTo12Hour(time)
                          }))}
                          onChange={(selected) => {
                            setSelectedTime(selected?.value || '');
                          }}
                          value={selectedTime ? {
                            value: selectedTime,
                            label: formatTo12Hour(selectedTime)
                          } : null}
                          placeholder="Select start time"
                        />
                      </div>
                    )}

                    {needs.room && selectedDate && (
                      <div className="form-group">
                        <label>
                          {needsMultiple ? '✅ ' : ''}Select Room * ({availableRooms.length} available)
                          {!needsMultiple && (
                            <span style={{ color: '#f59e0b', fontSize: '12px', marginLeft: '8px' }}>
                              (This is the only conflict)
                            </span>
                          )}
                        </label>
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
                    )}

                    {/* ✅ UPDATED: Show proctors if date and time are selected (regardless of needs.proctor) */}
                    {selectedDate && selectedTime && (
                      <>
                        {/* Full-time Proctors Dropdown */}
                        <div className="form-group">
                          <label>
                            Select Full-Time Proctor ({fullTimeProctors.length} available)
                            <span style={{ color: '#10b981', fontSize: '12px', marginLeft: '8px', fontWeight: 'bold' }}>
                              ⭐ Recommended
                            </span>
                          </label>
                          <Select
                            options={fullTimeProctors.map(p => ({
                              value: p.user_id,
                              label: `${p.first_name} ${p.last_name}`
                            }))}
                            onChange={(selected) => setSelectedProctor(selected?.value || null)}
                            value={selectedProctor && fullTimeProctors.some(p => p.user_id === selectedProctor) ? {
                              value: selectedProctor,
                              label: fullTimeProctors.find(p => p.user_id === selectedProctor)
                                ? `${fullTimeProctors.find(p => p.user_id === selectedProctor)?.first_name} ${fullTimeProctors.find(p => p.user_id === selectedProctor)?.last_name}`
                                : ''
                            } : null}
                            placeholder="Select full-time proctor"
                            isClearable
                            styles={{
                              control: (base) => ({
                                ...base,
                                borderColor: '#10b981',
                                borderWidth: '2px',
                                '&:hover': { borderColor: '#059669' }
                              })
                            }}
                          />
                        </div>

                        {/* Part-time/Other Proctors Dropdown */}
                        <div className="form-group">
                          <label>
                            Select Part-Time/Other Proctor ({otherProctors.length} available)
                            <span style={{ color: '#f59e0b', fontSize: '12px', marginLeft: '8px' }}>
                              (Use only if no full-time available)
                            </span>
                          </label>
                          <Select
                            options={otherProctors.map(p => ({
                              value: p.user_id,
                              label: `${p.first_name} ${p.last_name} ${p.employment_type === 'part-time' ? '(Part-time)' : '(Type not specified)'}`
                            }))}
                            onChange={(selected) => setSelectedProctor(selected?.value || null)}
                            value={selectedProctor && otherProctors.some(p => p.user_id === selectedProctor) ? {
                              value: selectedProctor,
                              label: otherProctors.find(p => p.user_id === selectedProctor)
                                ? `${otherProctors.find(p => p.user_id === selectedProctor)?.first_name} ${otherProctors.find(p => p.user_id === selectedProctor)?.last_name} ${otherProctors.find(p => p.user_id === selectedProctor)?.employment_type === 'part-time' ? '(Part-time)' : '(Type not specified)'}`
                                : ''
                            } : null}
                            placeholder="Select part-time/other proctor"
                            isClearable
                            styles={{
                              control: (base) => ({
                                ...base,
                                borderColor: '#f59e0b',
                                borderWidth: '2px',
                                '&:hover': { borderColor: '#d97706' }
                              })
                            }}
                          />
                        </div>

                        {/* Info messages */}
                        {availableProctors.length === 0 && (
                          <div style={{
                            background: '#fee2e2',
                            padding: '10px',
                            borderRadius: '6px',
                            fontSize: '13px',
                            color: '#dc2626',
                            marginTop: '8px',
                            border: '1px solid #fca5a5'
                          }}>
                            ⚠️ <strong>No proctors available</strong> at this time slot. All proctors from your college/departments are already assigned to other exams at this time.
                          </div>
                        )}

                        {availableProctors.length > 0 && fullTimeProctors.length === 0 && (
                          <div style={{
                            background: '#fef3c7',
                            padding: '10px',
                            borderRadius: '6px',
                            fontSize: '13px',
                            color: '#92400e',
                            marginTop: '8px',
                            border: '1px solid #fde68a'
                          }}>
                            ℹ️ No full-time proctors available at this time. Consider selecting a part-time proctor or changing the time slot to find full-time staff.
                          </div>
                        )}

                        {fullTimeProctors.length > 0 && (
                          <div style={{
                            background: '#d1fae5',
                            padding: '10px',
                            borderRadius: '6px',
                            fontSize: '13px',
                            color: '#065f46',
                            marginTop: '8px',
                            border: '1px solid #6ee7b7'
                          }}>
                            ✅ <strong>{fullTimeProctors.length} full-time proctor(s)</strong> available - prioritize these for better reliability.
                          </div>
                        )}
                      </>
                    )}

                    {/* Auto-filled fields message */}
                    {!needsMultiple && selectedDate && !selectedTime && (
                      <div style={{
                        background: '#e0f2fe',
                        padding: '10px',
                        borderRadius: '6px',
                        fontSize: '13px',
                        color: '#0369a1',
                        marginTop: '12px'
                      }}>
                        ℹ️ Other fields will use previous values since they don't have conflicts
                      </div>
                    )}
                  </>
                );
              })()}

              <div className="form-actions">
                <button
                  className="btn-save"
                  onClick={handleSave}
                  disabled={loading || !selectedDate ||
                    (analyzeConflicts(selectedSection).time && !selectedTime) ||
                    (analyzeConflicts(selectedSection).room && !selectedRoom)}
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