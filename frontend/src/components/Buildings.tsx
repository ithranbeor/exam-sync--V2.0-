// deno-lint-ignore-file no-explicit-any
import React, { useEffect, useState } from 'react';
import { FaSearch, FaTrash, FaEdit, FaDownload, FaEye } from 'react-icons/fa';
import { ToastContainer, toast } from 'react-toastify';
import * as XLSX from 'xlsx';
import { api } from '../lib/apiClient.ts'; // <-- Axios instance
import 'react-toastify/dist/ReactToastify.css';
import '../styles/colleges.css';

interface Building {
  building_id: string;
  building_name: string;
}

interface Room {
  room_id: string;
  room_name: string;
  room_type: string;
  building_id: string;
}

const Buildings: React.FC = () => {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [roomCounts, setRoomCounts] = useState<{ [key: string]: number }>({});
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedBuildingRooms, setSelectedBuildingRooms] = useState<Room[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [newBuilding, setNewBuilding] = useState<Building>({
    building_id: '',
    building_name: '',
  });
  const [selectedBuildingName, setSelectedBuildingName] = useState('');

  useEffect(() => {
    if (showModal || showImport) return; // pause refresh while editing/importing

    fetchBuildings();
    const interval = setInterval(fetchBuildings, 2000);
    return () => clearInterval(interval);
  }, [showModal, showImport]);

  // ✅ Fetch buildings and rooms using Axios
  const fetchBuildings = async () => {
    try {
      const { data: buildingData } = await api.get('/tbl_buildings');
      const { data: roomData } = await api.get('/tbl_rooms');

      setBuildings(buildingData || []);
      setRooms(roomData || []);

      const counts: { [key: string]: number } = {};
      (roomData || []).forEach((room: Room) => {
        if (room.building_id) {
          counts[room.building_id] = (counts[room.building_id] || 0) + 1;
        }
      });
      setRoomCounts(counts);
    } catch (err) {
      console.error(err);
      toast.error('Failed to fetch data');
    }
  };

  const openRoomModal = (buildingId: string) => {
    const building = buildings.find((b) => b.building_id === buildingId);
    const buildingRooms = rooms.filter((room) => room.building_id === buildingId);

    setSelectedBuildingRooms(buildingRooms);
    setSelectedBuildingName(building ? building.building_name : 'Unknown Building');
    setShowRoomModal(true);
  };

  // ✅ Add or update building
  const handleSubmit = async () => {
    const { building_id, building_name } = newBuilding;
    if (!building_id || !building_name) {
      toast.error('All fields are required');
      return;
    }

    try {
      if (editMode) {
        await api.put(`/tbl_buildings/${building_id}`, { building_name });
        toast.success('Building updated');
      } else {
        await api.post('/tbl_buildings', newBuilding);
        toast.success('Building added');
      }

      setShowModal(false);
      setNewBuilding({ building_id: '', building_name: '' });
      fetchBuildings();
    } catch (err) {
      console.error(err);
      toast.error('Failed to save building');
    }
  };

  // ✅ Delete building
  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/tbl_buildings/${id}`);
      toast.success('Building deleted');
      fetchBuildings();
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete building');
    }
  };

  // ✅ Import Excel file and insert via Axios
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
        const building_id = row['Building ID']?.trim();
        const building_name = row['Building Name']?.trim();
        if (!building_id || !building_name) continue;

        try {
          await api.post('/tbl_buildings', { building_id, building_name });
          added++;
        } catch {
          // Skip failed rows
        }
      }

      toast.success(`Import completed: ${added} building(s) added`);
      fetchBuildings();
      setShowImport(false);
    };

    reader.readAsArrayBuffer(file);
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['Building ID', 'Building Name'],
      ['BLDG. 09', 'ICT Building'],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Buildings Template');
    XLSX.writeFile(wb, 'buildings_template.xlsx');
  };

  const filtered = buildings.filter((b) =>
    b.building_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="colleges-container">
      <div className="colleges-header">
        <h2 className="colleges-title">Manage Buildings</h2>
        <div className="search-bar">
          <input
            type="text"
            placeholder="Search Building Name"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button type="button" className="search-button"><FaSearch /></button>
        </div>
      </div>

      <div className="colleges-actions">
        <button
          type="button"
          className="action-button add-new"
          onClick={() => {
            setEditMode(false);
            setNewBuilding({ building_id: '', building_name: '' });
            setShowModal(true);
          }}
        >
          Add New Building
        </button>
        <button
          type="button"
          className="action-button import"
          onClick={() => setShowImport(true)}
        >
          Import Buildings
        </button>
        <button
          type="button"
          className="action-button download"
          onClick={downloadTemplate}
        >
          <FaDownload style={{ marginRight: 5 }} /> Download Template
        </button>
      </div>

      <div className="colleges-table-container">
        <table className="colleges-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Building #</th>
              <th>Building Name</th>
              <th>Room Count</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((b, index) => (
              <tr key={b.building_id}>
                <td>{index + 1}</td>
                <td>{b.building_id}</td>
                <td>{b.building_name}</td>
                <td>{roomCounts[b.building_id] || 0}</td>
                <td className="action-buttons">
                  <button
                    type="button"
                    className="icon-button view-button"
                    title="View Rooms"
                    onClick={() => openRoomModal(b.building_id)}
                  >
                    <FaEye />
                  </button>
                  <button
                    type="button"
                    className="icon-button edit-button"
                    onClick={() => {
                      setEditMode(true);
                      setNewBuilding(b);
                      setShowModal(true);
                    }}
                  >
                    <FaEdit />
                  </button>
                  <button
                    type="button"
                    className="icon-button delete-button"
                    onClick={() => handleDelete(b.building_id)}
                  >
                    <FaTrash />
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5}>No buildings found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3 style={{ textAlign: 'center' }}>
              {editMode ? 'Edit Building' : 'Add New Building'}
            </h3>
            <div className="input-group">
              <label>Building ID</label>
              <input
                type="text"
                disabled={editMode}
                value={newBuilding.building_id}
                onChange={(e) =>
                  setNewBuilding({ ...newBuilding, building_id: e.target.value })
                }
              />
            </div>
            <div className="input-group">
              <label>Building Name</label>
              <input
                type="text"
                value={newBuilding.building_name}
                onChange={(e) =>
                  setNewBuilding({ ...newBuilding, building_name: e.target.value })
                }
              />
            </div>
            <div className="modal-actions">
              <button type="button" onClick={handleSubmit}>Save</button>
              <button type="button" onClick={() => setShowModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImport && (
        <div className="modal-overlay">
          <div className="modal">
            <h3 style={{ textAlign: 'center' }}>Import Buildings</h3>
            <input type="file" accept=".xlsx,.xls" onChange={handleImportFile} />
            <div className="modal-actions">
              <button type="button" onClick={() => setShowImport(false)}>Done</button>
              <button type="button" onClick={() => setShowImport(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Room List Modal */}
      {showRoomModal && (
        <div className="modal-overlay">
          <div className="modal room-modal" style={{ width: 600 }}>
            <h3>Rooms in {selectedBuildingName}</h3>
            <table className="accounts-table">
              <thead>
                <tr>
                  <th>Room #</th>
                  <th>Room Name</th>
                  <th>Type</th>
                </tr>
              </thead>
              <tbody>
                {selectedBuildingRooms.map((room) => (
                  <tr key={room.room_id}>
                    <td>{room.room_id}</td>
                    <td>{room.room_name}</td>
                    <td>{room.room_type}</td>
                  </tr>
                ))}
                {selectedBuildingRooms.length === 0 && (
                  <tr><td colSpan={3}>No rooms found.</td></tr>
                )}
              </tbody>
            </table>
            <div className="modal-actions">
              <button type="button" onClick={() => setShowRoomModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer position="top-right" autoClose={3000} />
    </div>
  );
};

export default Buildings;