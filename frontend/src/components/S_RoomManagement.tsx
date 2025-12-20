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

const RoomManagement: React.FC<UserProps> = ({ user }) => {
  const [roomOptions, setRoomOptions] = useState<Room[]>([]);
  const [buildingOptions, setBuildingOptions] = useState<Building[]>([]);
  const [selectedBuildingLeft, setSelectedBuildingLeft] = useState<string | null>(null);
  const [selectedBuildingRight, _setSelectedBuildingRight] = useState<string | null>(null);
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
  const [showAddedRooms, setShowAddedRooms] = useState(false);

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


  const handleCapacityChange = (room_id: string, newCapacity: number) => {
    setEditingCapacity((prev) => ({ ...prev, [room_id]: newCapacity }));
  };

  const handleSaveAllCapacities = async () => {
    const capacitiesToSave = Object.entries(editingCapacity).filter(
      ([room_id, newCapacity]) => {
        const originalRoom = roomOptions.find(r => r.room_id === room_id);
        return originalRoom && originalRoom.room_capacity !== newCapacity;
      }
    );

    if (capacitiesToSave.length === 0) {
      toast.info('No changes to save');
      return;
    }

    setIsSaving(true);
    let successCount = 0;
    let errorCount = 0;

    for (const [room_id, newCapacity] of capacitiesToSave) {
      if (isNaN(newCapacity) || newCapacity <= 0) {
        errorCount++;
        continue;
      }

      try {
        await api.put(`/tbl_rooms/${room_id}/`, { room_capacity: newCapacity });
        setRoomOptions((prev) =>
          prev.map((r) => (r.room_id === room_id ? { ...r, room_capacity: newCapacity } : r))
        );
        successCount++;
      } catch (error) {
        console.error(`Error updating capacity for ${room_id}:`, error);
        errorCount++;
      }
    }

    if (successCount > 0) {
      toast.success(`Successfully updated ${successCount} room capacity(ies)`);
    }
    if (errorCount > 0) {
      toast.error(`Failed to update ${errorCount} room(s)`);
    }

    setEditingCapacity({});
    setIsSaving(false);
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
        <div className="rm-title-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 className="rm-title" style={{ margin: 0, fontSize: '1.4rem', color: '#092C4C' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              Room Selection
            </span>
          </h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="rm-save-btn"
              onClick={handleSaveRooms}
              disabled={isSaving || selectedRooms.length === 0}
              style={{
                padding: '8px 16px',
                backgroundColor: selectedRooms.length === 0 ? '#ccc' : '#0A3765',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: isSaving || selectedRooms.length === 0 ? 'not-allowed' : 'pointer',
                fontWeight: '600',
                transition: 'all 0.2s',
              }}
            >
              {isSaving ? 'Saving...' : 'Save Selection'}
            </button>

            <button
              type="button"
              className="rm-reset-btn"
              onClick={() => setShowResetModal(true)}
              style={{
                padding: '8px 16px',
                backgroundColor: '#B3261E',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '600',
                transition: 'all 0.2s',
              }}
            >
              Reset
            </button>
          </div>
        </div>

        {/* Added Rooms Section */}
        <div style={{ 
          marginBottom: '20px', 
          padding: '16px', 
          backgroundColor: '#e8f4f8', 
          borderRadius: '10px',
          border: '2px solid #0A3765'
        }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '12px'
          }}>
            <h4 style={{ 
              margin: 0, 
              color: '#092C4C', 
              fontSize: '1.1rem',
              fontWeight: '600'
            }}>
              Added Rooms ({selectedRooms.length})
            </h4>
            <button
              type="button"
              onClick={() => setShowAddedRooms(!showAddedRooms)}
              style={{
                padding: '4px 12px',
                backgroundColor: '#092C4C',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: '500',
              }}
            >
              {showAddedRooms ? 'Hide' : 'Show'}
            </button>
          </div>
          
          {showAddedRooms && (
            <div style={{ 
              maxHeight: '200px', 
              overflowY: 'auto',
              backgroundColor: 'white',
              padding: '12px',
              borderRadius: '8px',
              border: '1px solid #d0e8f2'
            }}>
              {selectedRooms.length === 0 ? (
                <p style={{ 
                  textAlign: 'center', 
                  color: '#666', 
                  margin: 0,
                  fontSize: '0.9rem'
                }}>
                  No rooms added yet. Select rooms below to add them.
                </p>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {selectedRooms.map((roomId) => {
                    const room = roomOptions.find(r => r.room_id === roomId);
                    return (
                      <div
                        key={roomId}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '6px 10px',
                          backgroundColor: '#0A3765',
                          color: 'white',
                          borderRadius: '6px',
                          fontSize: '0.85rem',
                          fontWeight: '500',
                        }}
                      >
                        <span>{roomId}</span>
                        {room && (
                          <span style={{ fontSize: '0.75rem', opacity: 0.9 }}>
                            ({room.room_type})
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => setSelectedRooms(prev => prev.filter(id => id !== roomId))}
                          style={{
                            background: 'rgba(255,255,255,0.2)',
                            border: 'none',
                            color: 'white',
                            cursor: 'pointer',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '0.8rem',
                            fontWeight: 'bold',
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Filters Section */}
        <div style={{ 
          backgroundColor: '#f8f9fa', 
          padding: '16px', 
          borderRadius: '10px',
          marginBottom: '20px'
        }}>
          <h4 style={{ 
            margin: '0 0 12px 0', 
            color: '#092C4C', 
            fontSize: '1rem',
            fontWeight: '600'
          }}>
            Filters
          </h4>
          
          <div className="rm-field">
            <label style={{ fontSize: '0.9rem', fontWeight: '500' }}>Room Type</label>
            <Select
              options={[
                { value: 'All', label: ' All Types' },
                { value: 'Lecture', label: 'Lecture' },
                { value: 'Laboratory', label: 'Laboratory' },
              ]}
              value={{ value: roomTypeFilter, label: roomTypeFilter === 'All' ? 'All Types' : roomTypeFilter === 'Lecture' ? 'Lecture' : 'Laboratory' }}
              onChange={(selected) => setRoomTypeFilter(selected?.value || 'All')}
            />
          </div>

          <div className="rm-field">
            <label style={{ fontSize: '0.9rem', fontWeight: '500' }}>Building</label>
            <Select
              options={buildingOptions.map((b) => ({ value: b.building_id, label: `${b.building_name} (${b.building_id})` }))}
              value={
                selectedBuildingLeft
                  ? {
                    value: selectedBuildingLeft,
                    label: `${buildingOptions.find((b) => b.building_id === selectedBuildingLeft)?.building_name}`,
                  }
                  : null
              }
              onChange={(selected) => setSelectedBuildingLeft(selected?.value || null)}
              isClearable
              placeholder="-- All Buildings --"
            />
          </div>

          <div className="rm-field" style={{ marginBottom: 0 }}>
            <label style={{ fontSize: '0.9rem', fontWeight: '500' }}>Search Room</label>
            <Select
              options={filteredLeftRooms.map((r) => ({ value: r.room_name, label: ` ${r.room_name} (${r.room_id})` }))}
              onChange={(selected) => setRoomSearch(selected?.value || '')}
              isClearable
              isSearchable
              placeholder="Search or select a room..."
            />
          </div>
        </div>

        {/* Available Rooms Grid */}
        <div>
          <h4 style={{ 
            margin: '0 0 12px 0', 
            color: '#092C4C', 
            fontSize: '1rem',
            fontWeight: '600'
          }}>
            Available Rooms ({filteredLeftRooms.length})
          </h4>
          
          <div className="rm-room-grid">
            {filteredLeftRooms.map((r) => {
              const isSelected = selectedRooms.includes(r.room_id);
              return (
                <div 
                  key={r.room_id} 
                  className={`rm-room-box ${isSelected ? 'selected' : ''}`}
                  style={{
                    position: 'relative',
                    border: isSelected ? '2px solid #0A3765' : '2px solid #e0e0e0',
                  }}
                >
                  <div
                    onClick={() =>
                      setSelectedRooms((prev) =>
                        isSelected ? prev.filter((id) => id !== r.room_id) : [...prev, r.room_id]
                      )
                    }
                    style={{ cursor: 'pointer' }}
                  >
                    <div style={{ fontWeight: '600', fontSize: '0.95rem' }}>
                      {isSelected && <span style={{ marginRight: '4px' }}>✓</span>}
                      {r.room_id}
                    </div>
                    <span className="rm-room-type" style={{ 
                      color: isSelected ? '#fff' : '#666',
                      fontSize: '0.75rem'
                    }}>
                      {r.room_type === 'Lecture' ? '' : ''} {r.room_type}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="rm-vacancy-btn"
                    onClick={() => setOccupancyModal({ visible: true, roomId: r.room_id })}
                  >
                    Vacancy
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* RIGHT PANEL - ROOM CAPACITY MANAGEMENT */}
      <div className="rm-card">
        <div className="rm-title-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 className="rm-title" style={{ margin: 0, fontSize: '1.4rem', color: '#092C4C' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              Room Capacity Management
            </span>
          </h3>
          <button
            type="button"
            className="rm-save-btn"
            onClick={handleSaveAllCapacities}
            disabled={isSaving || Object.keys(editingCapacity).length === 0}
            style={{
              padding: '8px 16px',
              backgroundColor: Object.keys(editingCapacity).length === 0 ? '#ccc' : '#0A3765',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: isSaving || Object.keys(editingCapacity).length === 0 ? 'not-allowed' : 'pointer',
              fontWeight: '600',
              transition: 'all 0.2s',
            }}
          >
            {isSaving ? 'Saving...' : 'Save Capacities'}
          </button>
        </div>

        {/* Filters Section */}
        <div style={{ 
          backgroundColor: '#f8f9fa', 
          padding: '16px', 
          borderRadius: '10px',
          marginBottom: '20px'
        }}>
          <h4 style={{ 
            margin: '0 0 12px 0', 
            color: '#092C4C', 
            fontSize: '1rem',
            fontWeight: '600'
          }}>
            Filters
          </h4>

          <div className="rm-field">
            <label style={{ fontSize: '0.9rem', fontWeight: '500' }}>Room Type</label>
            <Select
              options={[
                { value: 'All', label: 'All Types' },
                { value: 'Lecture', label: 'Lecture' },
                { value: 'Laboratory', label: 'Laboratory' },
              ]}
              value={{ value: rightPanelTypeFilter, label: rightPanelTypeFilter === 'All' ? 'All Types' : rightPanelTypeFilter === 'Lecture' ? ' Lecture' : ' Laboratory' }}
              onChange={(selected) => setRightPanelTypeFilter(selected?.value || 'All')}
            />
          </div>

          <div className="rm-field" style={{ marginBottom: 0 }}>
            <label style={{ fontSize: '0.9rem', fontWeight: '500' }}>Search Room</label>
            <Select
              options={filteredRightRooms.map((r) => ({ value: r.room_name, label: `${r.room_name} (${r.room_id})` }))}
              onChange={(selected) => setRightSearch(selected?.value || '')}
              isClearable
              isSearchable
              placeholder="Search or select a room..."
            />
          </div>
        </div>

        {/* Room Table */}
        <div className="rm-room-table">
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', borderRadius: '8px', overflow: 'hidden' }}>
            <thead>
              <tr style={{ background: 'linear-gradient(135deg, #092c4c 0%, #0A3765 100%)', textAlign: 'left', color: 'white' }}>
                <th style={{ padding: '12px', fontWeight: '600' }}>Room #</th>
                <th style={{ padding: '12px', fontWeight: '600' }}>Room Name</th>
                <th style={{ padding: '12px', fontWeight: '600' }}>Type</th>
                <th style={{ padding: '12px', fontWeight: '600' }}>Capacity</th>
              </tr>
            </thead>
            <tbody>
              {filteredRightRooms.map((r, index) => (
                <tr 
                  key={r.room_id} 
                  style={{ 
                    borderBottom: '1px solid #e0e0e0',
                    backgroundColor: index % 2 === 0 ? '#ffffff' : '#f9f9f9',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f0f8ff'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = index % 2 === 0 ? '#ffffff' : '#f9f9f9'}
                >
                  <td style={{ color: '#092C4C', padding: '12px', fontWeight: '600' }}>{r.room_id}</td>
                  <td style={{ color: '#333', padding: '12px' }}>{r.room_name}</td>
                  <td style={{ color: '#555', padding: '12px' }}>
                    <span style={{ 
                      padding: '4px 8px', 
                      backgroundColor: r.room_type === 'Lecture' ? '#e3f2fd' : '#f3e5f5',
                      color: r.room_type === 'Lecture' ? '#1976d2' : '#7b1fa2',
                      borderRadius: '6px',
                      fontSize: '0.85rem',
                      fontWeight: '500'
                    }}>
                      {r.room_type === 'Lecture' ? '' : ''} {r.room_type}
                    </span>
                  </td>
                  <td style={{ color: 'black', padding: '12px' }}>
                    <input
                      type="number"
                      min={1}
                      value={editingCapacity[r.room_id] ?? r.room_capacity}
                      onChange={(e) => handleCapacityChange(r.room_id, Number(e.target.value))}
                      style={{
                        width: '70px',
                        padding: '6px 8px',
                        border: '2px solid #d0d0d0',
                        borderRadius: '6px',
                        backgroundColor: editingCapacity[r.room_id] !== undefined ? '#fffbea' : 'white',
                        color: '#092C4C',
                        fontWeight: '600',
                        fontSize: '0.9rem',
                        transition: 'all 0.2s'
                      }}
                      onFocus={(e) => e.target.style.borderColor = '#0A3765'}
                      onBlur={(e) => e.target.style.borderColor = '#d0d0d0'}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredRightRooms.length === 0 && (
            <div style={{ 
              textAlign: 'center', 
              padding: '40px 20px',
              backgroundColor: '#f5f5f5',
              borderRadius: '8px',
              marginTop: '10px'
            }}>
              <p style={{ color: '#888', margin: 0, fontSize: '1rem' }}>
                 No rooms found matching your filters.
              </p>
            </div>
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