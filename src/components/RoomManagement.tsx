import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient.ts';
import Select from 'react-select';
import '../styles/RoomManagement.css';

interface UserProps {
  user: {
    user_id: number;
    email: string;
    first_name?: string;
    last_name?: string;
  } | null;
}

interface Timeslot {
  start: Date;
  end: Date;
  occupied: boolean;
}

const RoomManagement: React.FC<UserProps> = ({ user }) => {
  const [roomOptions, setRoomOptions] = useState<{ room_id: string; room_name: string; room_type: string; building_id?: string }[]>([]);
  const [buildingOptions, setBuildingOptions] = useState<{ id: string; name: string }[]>([]);
  const [selectedBuilding, setSelectedBuilding] = useState<string | null>(null);
  const [selectedRooms, setSelectedRooms] = useState<string[]>([]);
  const [roomTypeFilter, setRoomTypeFilter] = useState<string>('Lecture');

  // Occupancy modal
  const [occupancyModal, setOccupancyModal] = useState<{ visible: boolean; roomId: string | null }>({
    visible: false,
    roomId: null,
  });

  const [roomStatus, setRoomStatus] = useState<{ [key: string]: { occupiedTimes: { start: string; end: string }[] } }>({});

  // Fetch rooms, buildings, and occupancy
  useEffect(() => {
    const fetchData = async () => {
      const { data: rooms } = await supabase.from('tbl_rooms').select('room_id, room_name, room_type, building_id');
      setRoomOptions(rooms ?? []);

      const { data: buildings } = await supabase.from('tbl_buildings').select('building_id, building_name');
      setBuildingOptions(buildings?.map(b => ({ id: b.building_id, name: b.building_name })) ?? []);

      // Fetch exam occupancy
      const { data: exams } = await supabase.from('tbl_examdetails').select('room_id, exam_start_time, exam_end_time');
      const statusMap: { [key: string]: { occupiedTimes: { start: string; end: string }[] } } = {};
      exams?.forEach(e => {
        if (!statusMap[e.room_id]) statusMap[e.room_id] = { occupiedTimes: [] };
        statusMap[e.room_id].occupiedTimes.push({ start: e.exam_start_time, end: e.exam_end_time });
      });
      setRoomStatus(statusMap);
    };
    fetchData();
  }, []);

  /** Get room timeslots (30-min intervals) */
  const getRoomTimeslots = (roomId: string) => {
    const dayStart = new Date(); dayStart.setHours(7, 30, 0, 0);
    const dayEnd = new Date(); dayEnd.setHours(21, 0, 0, 0);
    const status = roomStatus[roomId];
    const occupiedTimes = status?.occupiedTimes
      .map(t => ({ start: new Date(t.start), end: new Date(t.end) }))
      .sort((a, b) => a.start.getTime() - b.start.getTime()) || [];

    const slots: Timeslot[] = [];
    let cursor = new Date(dayStart);

    for (const slot of occupiedTimes) {
      if (cursor.getTime() < slot.start.getTime()) {
        slots.push({ start: new Date(cursor), end: new Date(slot.start), occupied: false });
      }
      slots.push({ start: new Date(slot.start), end: new Date(slot.end), occupied: true });
      cursor = new Date(slot.end);
    }
    if (cursor.getTime() < dayEnd.getTime()) slots.push({ start: new Date(cursor), end: new Date(dayEnd), occupied: false });
    return slots;
  };

  /** Room timeslot component */
  const RoomTimeslots: React.FC<{ roomId: string }> = ({ roomId }) => {
    const slots = getRoomTimeslots(roomId);
    return (
      <div className="rm-timeslots">
        {slots.map((slot, i) => (
          <div key={i} className={`rm-timeslot ${slot.occupied ? 'occupied' : 'vacant'}`}>
            <span>{slot.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {slot.end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            <span className="status">{slot.occupied ? 'Occupied' : 'Available'}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="rm-container">
      {/* LEFT CARD */}
      <div className="rm-card">
        <h3 className="rm-title">Select Possible Rooms</h3>

        <div className="rm-field">
          <label>Building</label>
          <Select
            options={buildingOptions.map(b => ({ value: b.id, label: `${b.name} (${b.id})` }))}
            value={selectedBuilding ? { value: selectedBuilding, label: buildingOptions.find(b => b.id === selectedBuilding)?.name } : null}
            onChange={selected => setSelectedBuilding(selected?.value || null)}
            placeholder="-- Select Building --"
            isClearable
          />
        </div>

        <div className="rm-room-grid">
          {roomOptions
            .filter(r => !selectedBuilding || r.building_id === selectedBuilding)
            .filter(r => r.room_type === roomTypeFilter)
            .map(r => {
              const isSelected = selectedRooms.includes(r.room_id);
              return (
                <div key={r.room_id} className={`rm-room-box ${isSelected ? "selected" : ""}`}>
                  <div onClick={() => {
                    setSelectedRooms(prev =>
                      isSelected ? prev.filter(id => id !== r.room_id) : [...prev, r.room_id]
                    );
                  }}>
                    {r.room_id} <span className="rm-room-type">({r.room_type})</span>
                  </div>
                  <button className="rm-vacancy-btn" onClick={() => setOccupancyModal({ visible: true, roomId: r.room_id })}>
                    View Vacancy
                  </button>
                </div>
              );
            })}
        </div>

        {selectedRooms.length > 0 && (
          <div className="rm-selected">
            <strong>Selected Rooms:</strong> {selectedRooms.join(', ')}
          </div>
        )}
      </div>

      {/* RIGHT CARD */}
      <div className="rm-card">
        <h3 className="rm-title">Right Side Content</h3>
        <p>Additional features or analytics can be added here.</p>
      </div>

      {/* OCCUPANCY MODAL */}
      {occupancyModal.visible && occupancyModal.roomId && (
        <div className="rm-modal-overlay" onClick={() => setOccupancyModal({ visible: false, roomId: null })}>
          <div className="rm-modal-content" onClick={e => e.stopPropagation()}>
            <h3>Room Occupancy: {occupancyModal.roomId}</h3>
            <RoomTimeslots roomId={occupancyModal.roomId} />
            <button className="rm-close-btn" onClick={() => setOccupancyModal({ visible: false, roomId: null })}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoomManagement;
