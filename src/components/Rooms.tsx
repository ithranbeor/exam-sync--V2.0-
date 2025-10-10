// deno-lint-ignore-file no-explicit-any
import React, { useState, useEffect } from 'react';
import { FaTrash, FaEdit, FaSearch, FaDownload } from 'react-icons/fa';
import { supabase } from '../lib/supabaseClient.ts';
import { ToastContainer, toast } from 'react-toastify';
import * as XLSX from 'xlsx';
import 'react-toastify/dist/ReactToastify.css';
import '../styles/colleges.css';
import Select from 'react-select';

interface Room {
  room_id: string;
  room_name: string;
  room_type: string;
  room_capacity: number;
  building_id: string;
}

interface Building {
  building_id: string;
  building_name: string;
}

const Rooms: React.FC = () => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const [newRoom, setNewRoom] = useState<Room>({
    room_id: '',
    room_name: '',
    room_type: '',
    room_capacity: 0,
    building_id: '',
  });

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    const [roomData, buildingData] = await Promise.all([
      supabase.from('tbl_rooms').select('*'),
      supabase.from('tbl_buildings').select('*'),
    ]);
    if (roomData.data) setRooms(roomData.data);
    if (buildingData.data) setBuildings(buildingData.data);
  };

  const handleSubmit = async () => {
    const { room_id, room_name, room_type, room_capacity, building_id } = newRoom;
    if (!room_id || !room_name || !room_type || !room_capacity || !building_id) {
      toast.error('All fields are required');
      return;
    }

    setIsSubmitting(true);
    const { error } = editMode
      ? await supabase
          .from('tbl_rooms')
          .update({ room_name, room_type, room_capacity, building_id })
          .eq('room_id', room_id)
      : await supabase.from('tbl_rooms').insert([newRoom]);

    toast[error ? 'error' : 'success'](editMode ? 'Update failed' : 'Room added');
    fetchAll();
    setIsSubmitting(false);
    setShowModal(false);
  };

  const handleDelete = async (room_id: string) => {
    const { error } = await supabase.from('tbl_rooms').delete().eq('room_id', room_id);
    toast[error ? 'error' : 'success'](error ? 'Failed to delete room' : 'Room deleted');
    fetchAll();
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt: any) => {
      const data = new Uint8Array(evt.target.result);
      const wb = XLSX.read(data, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(sheet);

      let added = 0;
      for (const row of rows) {
        const room_id = row['Room ID']?.trim();
        const room_name = row['Room Name']?.trim();
        const room_type = row['Room Type']?.trim();
        const room_capacity = parseInt(row['Room Capacity'] || 0);
        const building_id = row['Building ID']?.trim();

        if (!room_id || !room_name || !room_type || !room_capacity || !building_id) continue;

        const { error } = await supabase.from('tbl_rooms').insert([{
          room_id, room_name, room_type, room_capacity, building_id
        }]);
        if (!error) added++;
      }

      toast.success(`Import completed: ${added} room(s) added`);
      fetchAll();
      setShowImport(false);
    };
    reader.readAsArrayBuffer(file);
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['Room ID', 'Room Name', 'Room Type', 'Room Capacity', 'Building ID'],
      ['9-301', 'Cisco Lab', 'Laboratory', 15, 'BLDG. 09']
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Rooms Template');
    XLSX.writeFile(wb, 'rooms_template.xlsx');
  };

  const filtered = rooms.filter(r =>
    r.room_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.room_id.toString().toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="colleges-container">
      <div className="colleges-header">
        <h2 className="colleges-title">Manage Rooms</h2>
        <div className="search-bar">
          <input
            type="text"
            placeholder="Search Room Name"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button type="button" className="search-button"><FaSearch /></button>
        </div>
      </div>

      <div className="colleges-actions">
        <button type='button' className="action-button add-new" onClick={() => {
          setEditMode(false);
          setNewRoom({ room_id: '', room_name: '', room_type: '', room_capacity: 0, building_id: '' });
          setShowModal(true);
        }}>Add New Room</button>
        <button type='button' className="action-button import" onClick={() => setShowImport(true)}>Import Rooms</button>
        <button type='button' className="action-button download" onClick={downloadTemplate}>
          <FaDownload style={{ marginRight: 5 }} /> Download Template
        </button>
      </div>

      <div className="colleges-table-container">
        <table className="colleges-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Room #</th>
              <th>Room Name</th>
              <th>Type</th>
              <th>Capacity</th>
              <th>Building</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => (
              <tr key={r.room_id}>
                <td>{i + 1}</td>
                <td>{r.room_id}</td>
                <td>{r.room_name}</td>
                <td>{r.room_type}</td>
                <td>{r.room_capacity}</td>
                <td>{r.building_id}</td>
                <td className="action-buttons">
                  <button type='button' className="icon-button edit-button" onClick={() => {
                    setEditMode(true);
                    setNewRoom(r);
                    setShowModal(true);
                  }}><FaEdit /></button>
                  <button type='button' className="icon-button delete-button" onClick={() => handleDelete(r.room_id)}><FaTrash /></button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={7}>No rooms found.</td></tr>}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3 style={{ textAlign: 'center' }}>{editMode ? 'Edit Room' : 'Add New Room'}</h3>
            <div className="input-group">
              <label>Room ID</label>
              <input type="text" value={newRoom.room_id} disabled={editMode}
                onChange={(e) => setNewRoom({ ...newRoom, room_id: e.target.value })} />
            </div>
            <div className="input-group">
              <label>Room Name</label>
              <input type="text" value={newRoom.room_name}
                onChange={(e) => setNewRoom({ ...newRoom, room_name: e.target.value })} />
            </div>
            <div className="input-group">
              <label>Room Type</label>
              <select value={newRoom.room_type}
                onChange={(e) => setNewRoom({ ...newRoom, room_type: e.target.value })}>
                <option value="">Select Type</option>
                <option value="Lecture">Lecture</option>
                <option value="Laboratory">Laboratory</option>
              </select>
            </div>
            <div className="input-group">
              <label>Room Capacity</label>
              <input type="number" value={newRoom.room_capacity}
                onChange={(e) => setNewRoom({ ...newRoom, room_capacity: parseInt(e.target.value) || 0 })} />
            </div>
            <div className="input-group">
              <label>Building</label>
              <Select
                className="react-select"
                classNamePrefix="select"
                options={buildings
                  .sort((a, b) => a.building_name.localeCompare(b.building_name))
                  .map(b => ({
                    value: b.building_id,
                    label: `${b.building_name} (${b.building_id})`
                  }))
                }
                value={buildings
                  .map(b => ({ value: b.building_id, label: `${b.building_name} (${b.building_id})` }))
                  .find(option => option.value === newRoom.building_id)
                }
                onChange={(selected) =>
                  setNewRoom({ ...newRoom, building_id: selected?.value || '' })
                }
                placeholder="Select Building"
                isClearable
              />
            </div>
            <div className="modal-actions">
              <button type="button" onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : 'Save'}
              </button>
              <button type="button" onClick={() => setShowModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showImport && (
        <div className="modal-overlay">
          <div className="modal">
            <h3 style={{ textAlign: 'center' }}>Import Rooms</h3>
            <input type="file" accept=".xlsx,.xls" onChange={handleImportFile} />
            <div className="modal-actions">
              <button type="button" onClick={() => setShowImport(false)}>Done</button>
              <button type="button" onClick={() => setShowImport(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer position="top-right" autoClose={3000} />
    </div>
  );
};

export default Rooms;
