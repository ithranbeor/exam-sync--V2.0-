// deno-lint-ignore-file no-explicit-any
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { FaSearch, FaTrash, FaEdit, FaDownload, FaEye, FaPlus, FaFileImport, FaChevronLeft, FaChevronRight } from 'react-icons/fa';
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
  const [loading, setLoading] = useState(true); // new state
  const [isImporting, setIsImporting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [newBuilding, setNewBuilding] = useState<Building>({
    building_id: '',
    building_name: '',
  });
  const [selectedBuildingName, setSelectedBuildingName] = useState('');
  const [selectedBuildingIds, setSelectedBuildingIds] = useState<Set<string>>(new Set());
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const tableContainerRef = useRef<HTMLDivElement>(null);

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
    } finally {
      if (loading) setLoading(false); // only hide first load
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedBuildingIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const isAllSelected = (() => {
    if (buildings.length === 0) return false;
    return buildings.every((b) => selectedBuildingIds.has(b.building_id));
  })();

  const toggleSelectAll = () => {
    setSelectedBuildingIds(() => {
      if (isAllSelected) {
        return new Set();
      }
      const all = new Set<string>();
      buildings.forEach((b) => all.add(b.building_id));
      return all;
    });
  };

  const clearSelection = () => setSelectedBuildingIds(new Set());

  // Handle scroll position and update button states
  useEffect(() => {
    const checkScroll = () => {
      const container = tableContainerRef.current;
      if (!container) return;

      const { scrollLeft, scrollWidth, clientWidth } = container;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1);
      
      // Update scroll indicator classes
      container.classList.toggle('scrollable-left', scrollLeft > 0);
      container.classList.toggle('scrollable-right', scrollLeft < scrollWidth - clientWidth - 1);
    };

    const container = tableContainerRef.current;
    if (container) {
      checkScroll();
      container.addEventListener('scroll', checkScroll);
      window.addEventListener('resize', checkScroll);
    }

    return () => {
      if (container) {
        container.removeEventListener('scroll', checkScroll);
        window.removeEventListener('resize', checkScroll);
      }
    };
  }, [buildings, searchTerm, loading]);

  const scrollTable = (direction: 'left' | 'right') => {
    const container = tableContainerRef.current;
    if (!container) return;

    const scrollAmount = container.clientWidth * 0.8;
    const scrollTo = direction === 'left' 
      ? container.scrollLeft - scrollAmount 
      : container.scrollLeft + scrollAmount;
    
    container.scrollTo({
      left: scrollTo,
      behavior: 'smooth'
    });
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

  // (Single-item delete removed; using bulk selection + delete instead)

  // ✅ Import Excel file and insert via Axios
  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt: any) => {
      setIsImporting(true);
      try {
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
      } catch {
        toast.error('Error reading or importing file');
      } finally {
        setIsImporting(false);
        setShowImport(false);
      }
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

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const filtered = useMemo(() => {
    return buildings.filter((b) =>
      b.building_name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [buildings, searchTerm]);

  const paginatedBuildings = useMemo(() => {
    return filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  }, [filtered, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage);

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedBuildingIds);
    if (ids.length === 0) {
      toast.info('No buildings selected');
      return;
    }
    const confirmDelete = window.confirm(`Delete ${ids.length} selected building(s)? This cannot be undone.`);
    if (!confirmDelete) return;
    setIsBulkDeleting(true);
    try {
      const results = await Promise.allSettled(
        ids.map((id) => api.delete(`/tbl_buildings/${id}`))
      );
      const succeeded = results.filter((r) => r.status === 'fulfilled').length;
      const failed = results.length - succeeded;
      if (succeeded > 0) toast.success(`Deleted ${succeeded} building(s)`);
      if (failed > 0) toast.error(`${failed} building(s) failed to delete`);
      clearSelection();
      fetchBuildings();
    } catch (err) {
      console.error(err);
      toast.error('Bulk delete failed');
    } finally {
      setIsBulkDeleting(false);
    }
  };

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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              className="action-button add-new"
              onClick={() => {
                setEditMode(false);
                setNewBuilding({ building_id: '', building_name: '' });
                setShowModal(true);
              }}
            >
              <FaPlus/>
            </button>
            <button
              type="button"
              className="action-button import"
              onClick={() => setShowImport(true)}
            >
              <FaFileImport/>
            </button>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              className="action-button delete"
              onClick={handleBulkDelete}
              disabled={isBulkDeleting || selectedBuildingIds.size === 0}
              title={selectedBuildingIds.size > 0 ? `Delete ${selectedBuildingIds.size} selected` : 'Delete selected'}
            >
              <FaTrash/>
            </button>
          </div>
        </div>
      </div>

      <div className="pagination-controls">
        <button type='button'
          onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
          disabled={currentPage === 1}
          className="pagination-arrow-btn"
        >
          &lt;
        </button>
        <span className="pagination-page-number">{currentPage} of {totalPages}</span>
        <button type='button'
          onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
          disabled={currentPage === totalPages}
          className="pagination-arrow-btn"
        >
          &gt;
        </button>
      </div>

      <div className="table-scroll-wrapper">
        <div className="table-scroll-hint">
          <FaChevronLeft /> Swipe or use buttons to scroll <FaChevronRight />
        </div>
        <button
          type="button"
          className="table-scroll-buttons scroll-left"
          onClick={() => scrollTable('left')}
          disabled={!canScrollLeft}
          aria-label="Scroll left"
        >
          <FaChevronLeft />
        </button>
        <button
          type="button"
          className="table-scroll-buttons scroll-right"
          onClick={() => scrollTable('right')}
          disabled={!canScrollRight}
          aria-label="Scroll right"
        >
          <FaChevronRight />
        </button>
        <div className="colleges-table-container" ref={tableContainerRef}>
          <table className="colleges-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Building #</th>
              <th>Building Name</th>
              <th>Room Count</th>
              <th>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>Actions</span>
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={toggleSelectAll}
                    disabled={loading || buildings.length === 0}
                    aria-label="Select all"
                    title="Select all"
                    style={{ marginLeft: 'auto' }}
                  />
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '20px' }}>
                  Loading buidlings...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '20px' }}>
                  No buildings found.
                </td>
              </tr>
            ) : (
              paginatedBuildings.map((b, index) => (
                <tr key={b.building_id}>
                  <td>{(currentPage - 1) * itemsPerPage + index + 1}</td>
                  <td>{b.building_id}</td>
                  <td>{b.building_name}</td>
                  <td>{roomCounts[b.building_id] || 0}</td>
                  <td className="action-buttons" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
                    <input
                      type="checkbox"
                      checked={selectedBuildingIds.has(b.building_id)}
                      onChange={() => toggleSelect(b.building_id)}
                      aria-label={`Select ${b.building_name}`}
                      style={{ marginLeft: 'auto' }}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
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
            <p style={{ fontSize: '12px', color: '#666', marginBottom: '10px' }}>
              Each building must have a unique Building ID and Name.
            </p>
            <input type="file" accept=".xlsx,.xls" onChange={handleImportFile} disabled={isImporting} />
            <div className="modal-actions">
              <button
                type="button"
                className="modal-button download"
                onClick={downloadTemplate}
                disabled={isImporting}
              >
                <FaDownload style={{ marginRight: 5 }} /> Download Template
              </button>
              <button type="button" onClick={() => setShowImport(false)} disabled={isImporting}>
                {isImporting ? "Importing…" : "Close"}
              </button>
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