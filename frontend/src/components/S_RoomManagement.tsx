import React, { useState, useEffect } from 'react';
import { api } from '../lib/apiClient.ts';
import Select from 'react-select';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import '../styles/S_RoomManagement.css';

interface UserProps {
  user: {
    user_id: number;
    email: string;
    first_name?: string;
    last_name?: string;
  } | null;
}

interface Room {
  room_id: string;
  room_name: string;
  room_type: string;
  building_id?: string;
  room_capacity: number;
}

interface Building {
  building_id: string;
  building_name: string;
}

interface ExamDetail {
  room_id: string;
  exam_start_time: string;
  exam_end_time: string;
}

interface Timeslot {
  start: Date;
  end: Date;
  occupied: boolean;
}

function debounce<F extends (...args: any[]) => void>(func: F, wait: number) {
  let timeout: ReturnType<typeof setTimeout>;
  return (...args: Parameters<F>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

const RoomManagement: React.FC<UserProps> = ({ user }) => {
  const [roomOptions, setRoomOptions] = useState<Room[]>([]);
  const [buildingOptions, setBuildingOptions] = useState<Building[]>([]);
  const [selectedBuildingLeft, setSelectedBuildingLeft] = useState<string | null>(null);
  const [selectedBuildingRight, setSelectedBuildingRight] = useState<string | null>(null);
  const [selectedRooms, setSelectedRooms] = useState<string[]>([]);
  const [roomTypeFilter, setRoomTypeFilter] = useState<string>('Lecture');
  const [rightPanelTypeFilter, setRightPanelTypeFilter] = useState<string>('All');
  const [roomSearch, setRoomSearch] = useState<string>('');
  const [rightSearch, setRightSearch] = useState<string>('');
  const [showResetModal, setShowResetModal] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [editingCapacity, setEditingCapacity] = useState<{ [room_id: string]: number }>({});
  const [occupancyModal, setOccupancyModal] = useState<{ visible: boolean; roomId: string | null }>({
    visible: false,
    roomId: null,
  });
  const [roomStatus, setRoomStatus] = useState<{ [key: string]: { occupiedTimes: { start: string; end: string }[] } }>({});

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        // Fetch rooms
        const roomsResponse = await api.get('/tbl_rooms');
        const rooms = roomsResponse.data.map((r: any) => ({
          room_id: r.room_id,
          room_name: r.room_name,
          room_type: r.room_type,
          building_id: r.building_id,
          room_capacity: r.room_capacity,
        }));
        setRoomOptions(rooms);

        // Fetch buildings
        const buildingsResponse = await api.get('/tbl_buildings');
        const buildings = buildingsResponse.data.map((b: any) => ({
          building_id: b.building_id,
          building_name: b.building_name,
        }));
        setBuildingOptions(buildings);

        // Fetch exam details for room occupancy
        const examsResponse = await api.get('/tbl_examdetails');
        const exams: ExamDetail[] = examsResponse.data;

        const statusMap: any = {};
        exams.forEach((e) => {
          if (!statusMap[e.room_id]) {
            statusMap[e.room_id] = { occupiedTimes: [] };
          }
          statusMap[e.room_id].occupiedTimes.push({
            start: e.exam_start_time,
            end: e.exam_end_time,
          });
        });
        setRoomStatus(statusMap);

        // Fetch selected rooms for current user's college
        if (user?.user_id) {
          await fetchSelectedRooms();
        }
      } catch (error) {
        toast.error('Failed to load room data');
      } finally {
        setIsLoading(false);   // <-- STOP LOADING
      }
    };

    fetchData();
  }, [user]);

  const fetchSelectedRooms = async () => {
    try {
      // Get user's college
      const userRolesResponse = await api.get(`/tbl_user_role?user_id=${user?.user_id}&role_id=3`);
      const userCollegeId = userRolesResponse.data[0]?.college_id;

      if (userCollegeId) {
        // Fetch available rooms for this college
        const availableRoomsResponse = await api.get(`/tbl_available_rooms/?college_id=${userCollegeId}`);
        const roomIds = availableRoomsResponse.data.map((ar: any) => ar.room?.room_id || ar.room_id);
        setSelectedRooms(roomIds.filter((id: string) => id));
      }
    } catch (error) {
      console.error('Error fetching selected rooms:', error);
    }
  };

  const getRoomTimeslots = (roomId: string): Timeslot[] => {
    const dayStart = new Date();
    dayStart.setHours(7, 30, 0, 0);
    const dayEnd = new Date();
    dayEnd.setHours(21, 0, 0, 0);

    const status = roomStatus[roomId];
    const occupiedTimes = status?.occupiedTimes
      .map((t: any) => ({ start: new Date(t.start), end: new Date(t.end) }))
      .sort((a: any, b: any) => a.start.getTime() - b.start.getTime()) || [];

    const slots: Timeslot[] = [];
    let cursor = new Date(dayStart);

    for (const slot of occupiedTimes) {
      if (cursor.getTime() < slot.start.getTime()) {
        slots.push({ start: new Date(cursor), end: new Date(slot.start), occupied: false });
      }
      slots.push({ start: new Date(slot.start), end: new Date(slot.end), occupied: true });
      cursor = new Date(slot.end);
    }

    if (cursor.getTime() < dayEnd.getTime()) {
      slots.push({ start: new Date(cursor), end: new Date(dayEnd), occupied: false });
    }

    return slots;
  };

  const RoomTimeslots: React.FC<{ roomId: string }> = ({ roomId }) => {
    const slots = getRoomTimeslots(roomId);
    return (
      <div className="rm-timeslots">
        {slots.map((slot, i) => (
          <div key={i} className={`rm-timeslot ${slot.occupied ? 'occupied' : 'vacant'}`}>
            <span>
              {slot.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} -
              {slot.end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            <span className="status">{slot.occupied ? 'Occupied' : 'Available'}</span>
          </div>
        ))}
      </div>
    );
  };

  const handleSaveCapacity = async (room_id: string, newCapacity: number) => {
    if (isNaN(newCapacity) || newCapacity <= 0) {
      toast.warn('Invalid capacity');
      return;
    }

    try {
      await api.put(`/tbl_rooms/${room_id}/`, { room_capacity: newCapacity });

      setRoomOptions((prev) =>
        prev.map((r) => (r.room_id === room_id ? { ...r, room_capacity: newCapacity } : r))
      );
      toast.success(`Saved capacity for ${room_id}`);
    } catch (error) {
      console.error('Error updating capacity:', error);
      toast.error('Failed to update capacity');
    }
  };

  const handleResetRooms = async () => {
    setIsResetting(true);
    try {
      const userRolesResponse = await api.get(`/tbl_user_role?user_id=${user?.user_id}&role_id=3`);
      const userCollegeId = userRolesResponse.data[0]?.college_id;

      if (!userCollegeId) {
        toast.error('College not found.');
        setIsResetting(false);
        return;
      }

      const availableRoomsResponse = await api.get(`/tbl_available_rooms/?college_id=${userCollegeId}`);

      let deletedCount = 0;
      let errorCount = 0;

      for (const roomData of availableRoomsResponse.data) {
        let roomId = null;

        if (roomData.room && typeof roomData.room === 'object') {
          roomId = roomData.room.room_id;
        } else if (roomData.room_id) {
          roomId = roomData.room_id;
        }

        if (roomId) {
          try {
            await api.delete(`/tbl_available_rooms/${roomId}/${userCollegeId}/`);
            deletedCount++;
          } catch (deleteError: any) {
            errorCount++;
          }
        } else {
          errorCount++;
        }
      }

      setSelectedRooms([]);

      if (deletedCount > 0) {
        toast.success(`Successfully reset ${deletedCount} available room(s).`);
      } else if (errorCount > 0) {
        toast.error(`Failed to reset rooms. Check console for details.`);
      } else {
        toast.info('No rooms to reset.');
      }

      setShowResetModal(false);
    } catch (error: any) {
      console.error('Reset error:', error.response?.data || error);
      toast.error('An error occurred while resetting rooms.');
    } finally {
      setIsResetting(false);
    }
  };

  const debouncedSaveCapacity = debounce(handleSaveCapacity, 300);

  const handleCapacityChange = (room_id: string, newCapacity: number) => {
    setEditingCapacity((prev) => ({ ...prev, [room_id]: newCapacity }));
    debouncedSaveCapacity(room_id, newCapacity);
  };

  const handleSaveRooms = async () => {
    if (selectedRooms.length === 0) {
      toast.warn('Please select at least one room');
      return;
    }

    setIsSaving(true);
    try {
      const userRolesResponse = await api.get(`/tbl_user_role?user_id=${user?.user_id}&role_id=3`);
      const userCollegeId = userRolesResponse.data[0]?.college_id;

      if (!userCollegeId) {
        toast.error('College not found.');
        setIsSaving(false);
        return;
      }

      // Delete existing available rooms
      const existingRoomsResponse = await api.get(`/tbl_available_rooms/?college_id=${userCollegeId}`);
      const deletePromises = existingRoomsResponse.data.map(async (roomData: any) => {
        const roomId = roomData.room?.room_id || roomData.room_id;
        if (roomId) {
          try {
            await api.delete(`/tbl_available_rooms/${roomId}/${userCollegeId}/`);
          } catch (deleteError) {
            console.error(`Failed to delete room ${roomId}:`, deleteError);
          }
        }
      });

      await Promise.all(deletePromises);

      // Add new available rooms
      let successCount = 0;
      let errorCount = 0;

      for (const roomId of selectedRooms) {
        try {
          await api.post('/tbl_available_rooms/', {
            room_id: roomId,
            college_id: userCollegeId,
          });
          successCount++;
        } catch (postError: any) {
          errorCount++;
        }
      }

      if (successCount > 0) {
        toast.success(`Saved ${successCount} available room(s)!`);
      }
      if (errorCount > 0) {
        toast.warn(`Failed to save ${errorCount} room(s).`);
      }
    } catch (error: any) {
      console.error('Error in handleSaveRooms:', error.response?.data || error);
      toast.error(error.response?.data?.error || 'An error occurred while saving');
    } finally {
      setIsSaving(false);
    }
  };

  const filteredLeftRooms = roomOptions
    .filter((r) => !selectedBuildingLeft || r.building_id === selectedBuildingLeft)
    .filter((r) => roomTypeFilter === 'All' || r.room_type === roomTypeFilter)
    .filter((r) => roomSearch === '' || r.room_name.toLowerCase().includes(roomSearch.toLowerCase()));

  const filteredRightRooms = roomOptions
    .filter((r) => !selectedBuildingRight || r.building_id === selectedBuildingRight)
    .filter((r) => rightPanelTypeFilter === 'All' || r.room_type === rightPanelTypeFilter)
    .filter((r) => rightSearch === '' || r.room_name.toLowerCase().includes(rightSearch.toLowerCase()));

  if (isLoading) {
    return (
      <div className="rm-loading-container">
        <div className="rm-spinner"></div>
        <p style={{ color: '#092C4C', marginTop: '10px' }}>
          Loading room data...
        </p>
      </div>
    );
  }
  return (
    <div className="rm-container">
      {/* LEFT PANEL */}
      <div className="rm-card">
        <div className="rm-title-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <h3 className="rm-title" style={{ margin: 0 }}>Select Rooms for Modality</h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="rm-save-btn"
              onClick={handleSaveRooms}
              disabled={isSaving || selectedRooms.length === 0}
              style={{
                padding: '6px 12px',
                backgroundColor: '#0A3765',
                color: 'white',
                border: 'none',
                borderRadius: '20px',
                cursor: isSaving || selectedRooms.length === 0 ? 'not-allowed' : 'pointer',
              }}
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>

            <button
              type="button"
              className="rm-reset-btn"
              onClick={() => setShowResetModal(true)}
              style={{
                padding: '6px 12px',
                backgroundColor: '#B3261E',
                color: 'white',
                border: 'none',
                borderRadius: '20px',
                cursor: 'pointer',
              }}
            >
              Reset
            </button>
          </div>
        </div>

        <div className="rm-field">
          <label>Room Type Filter</label>
          <Select
            options={[
              { value: 'All', label: 'All' },
              { value: 'Lecture', label: 'Lecture' },
              { value: 'Laboratory', label: 'Laboratory' },
            ]}
            value={{ value: roomTypeFilter, label: roomTypeFilter }}
            onChange={(selected) => setRoomTypeFilter(selected?.value || 'All')}
          />
        </div>

        <div className="rm-field">
          <label>Building Filter</label>
          <Select
            options={buildingOptions.map((b) => ({ value: b.building_id, label: `${b.building_name} (${b.building_id})` }))}
            value={
              selectedBuildingLeft
                ? {
                  value: selectedBuildingLeft,
                  label: buildingOptions.find((b) => b.building_id === selectedBuildingLeft)?.building_name,
                }
                : null
            }
            onChange={(selected) => setSelectedBuildingLeft(selected?.value || null)}
            isClearable
            placeholder="-- Select Building --"
          />
        </div>

        <div className="rm-field">
          <label>Search Room</label>
          <Select
            options={filteredLeftRooms.map((r) => ({ value: r.room_name, label: `${r.room_name} (${r.room_id})` }))}
            onChange={(selected) => setRoomSearch(selected?.value || '')}
            isClearable
            isSearchable
            placeholder="Search or select a room..."
          />
        </div>

        <div className="rm-room-grid">
          {filteredLeftRooms.map((r) => {
            const isSelected = selectedRooms.includes(r.room_id);
            return (
              <div key={r.room_id} className={`rm-room-box ${isSelected ? 'selected' : ''}`}>
                <div
                  onClick={() =>
                    setSelectedRooms((prev) =>
                      isSelected ? prev.filter((id) => id !== r.room_id) : [...prev, r.room_id]
                    )
                  }
                >
                  {r.room_id} <span className="rm-room-type">({r.room_type})</span>
                </div>
                <button
                  type="button"
                  className="rm-vacancy-btn"
                  onClick={() => setOccupancyModal({ visible: true, roomId: r.room_id })}
                >
                  View Vacancy
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* RIGHT PANEL - ROOM CAPACITY MANAGEMENT */}
      <div className="rm-card">
        <h3 className="rm-title">Manage Room Capacity</h3>

        <div className="rm-field">
          <label>Building Filter</label>
          <Select
            options={buildingOptions.map((b) => ({ value: b.building_id, label: `${b.building_name} (${b.building_id})` }))}
            value={
              selectedBuildingRight
                ? {
                  value: selectedBuildingRight,
                  label: buildingOptions.find((b) => b.building_id === selectedBuildingRight)?.building_name,
                }
                : null
            }
            onChange={(selected) => setSelectedBuildingRight(selected?.value || null)}
            isClearable
            placeholder="-- Select Building --"
          />
        </div>

        <div className="rm-field">
          <label>Room Type Filter</label>
          <Select
            options={[
              { value: 'All', label: 'All' },
              { value: 'Lecture', label: 'Lecture' },
              { value: 'Laboratory', label: 'Laboratory' },
            ]}
            value={{ value: rightPanelTypeFilter, label: rightPanelTypeFilter }}
            onChange={(selected) => setRightPanelTypeFilter(selected?.value || 'All')}
          />
        </div>

        <div className="rm-field">
          <label>Search Room</label>
          <Select
            options={filteredRightRooms.map((r) => ({ value: r.room_name, label: `${r.room_name} (${r.room_id})` }))}
            onChange={(selected) => setRightSearch(selected?.value || '')}
            isClearable
            isSearchable
            placeholder="Search or select a room..."
          />
        </div>

        <div className="rm-room-table">
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
            <thead>
              <tr style={{ background: '#092c4c', textAlign: 'left' }}>
                <th style={{ padding: '8px' }}>Room #</th>
                <th style={{ padding: '8px' }}>Room Name</th>
                <th style={{ padding: '8px' }}>Type</th>
                <th style={{ padding: '8px' }}>Capacity</th>
              </tr>
            </thead>
            <tbody>
              {filteredRightRooms.map((r) => (
                <tr key={r.room_id} style={{ borderBottom: '1px solid #ddd' }}>
                  <td style={{ color: 'black', padding: '8px' }}>{r.room_id}</td>
                  <td style={{ color: 'black', padding: '8px' }}>{r.room_name}</td>
                  <td style={{ color: 'black', padding: '8px' }}>{r.room_type}</td>
                  <td style={{ color: 'black', padding: '8px' }}>
                    <input
                      type="number"
                      min={1}
                      value={editingCapacity[r.room_id] ?? r.room_capacity}
                      onChange={(e) => handleCapacityChange(r.room_id, Number(e.target.value))}
                      style={{
                        width: '60px',
                        padding: '4px',
                        border: '1px solid #ccc',
                        borderRadius: '4px',
                        backgroundColor: 'white',
                        color: '#092C4C',
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredRightRooms.length === 0 && (
            <p style={{ textAlign: 'center', color: '#888', marginTop: '10px' }}>No rooms found.</p>
          )}
        </div>
      </div>

      {/* OCCUPANCY MODAL */}
      {occupancyModal.visible && occupancyModal.roomId && (
        <div className="rm-modal-overlay" onClick={() => setOccupancyModal({ visible: false, roomId: null })}>
          <div className="rm-modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Room Occupancy: {occupancyModal.roomId}</h3>
            <RoomTimeslots roomId={occupancyModal.roomId} />
            <button
              type="button"
              className="rm-close-btn"
              onClick={() => setOccupancyModal({ visible: false, roomId: null })}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {showResetModal && (
        <div className="rm-modal-overlay" onClick={() => setShowResetModal(false)}>
          <div className="rm-modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Reset Available Rooms</h3>
            <p>
              This will <strong>remove all rooms you have marked as available for modality</strong>. Other users'
              configurations will not be affected. Are you sure you want to continue?
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: '1px solid #ccc',
                  background: 'white',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleResetRooms}
                disabled={isResetting}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  backgroundColor: '#B3261E',
                  color: 'white',
                  border: 'none',
                  cursor: isResetting ? 'not-allowed' : 'pointer',
                }}
              >
                {isResetting ? 'Resetting...' : 'Yes, Reset'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer position="top-right" autoClose={3000} />
    </div>
  );
};

export default RoomManagement;