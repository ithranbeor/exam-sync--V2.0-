// deno-lint-ignore-file no-explicit-any
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { FaSearch, FaTrash, FaEdit, FaDownload, FaEye, FaPlus, FaFileImport, FaChevronLeft, FaChevronRight, FaSort, FaChevronDown } from 'react-icons/fa';
import { ToastContainer, toast } from 'react-toastify';
import * as XLSX from 'xlsx';
import { api } from '../lib/apiClient.ts';
import 'react-toastify/dist/ReactToastify.css';
import '../styles/A_Colleges.css';
import { useEscapeKey } from '../hooks/useEscapeKey.ts';

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
  const [loading, setLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState<number | 'all'>('all');
  const [showItemsPerPageDropdown, setShowItemsPerPageDropdown] = useState(false);
  const [customItemsPerPage, setCustomItemsPerPage] = useState<string>('');
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [sortBy, setSortBy] = useState<string>('none');
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [newBuilding, setNewBuilding] = useState<Building>({
    building_id: '',
    building_name: '',
  });
  const [selectedBuildingName, setSelectedBuildingName] = useState('');
  const [selectedBuildingIds, setSelectedBuildingIds] = useState<Set<string>>(new Set());
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteCount, setDeleteCount] = useState(0);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  // Handle ESC key to close modals
  useEscapeKey(() => {
    if (showModal) {
      setShowModal(false);
      setEditMode(false);
      setNewBuilding({ building_id: '', building_name: '' });
    }
  }, showModal);

  useEscapeKey(() => {
    if (showImport) {
      setShowImport(false);
    }
  }, showImport);

  useEscapeKey(() => {
    if (showRoomModal) {
      setShowRoomModal(false);
      setSelectedBuildingName('');
      setSelectedBuildingRooms([]);
    }
  }, showRoomModal);

  useEscapeKey(() => {
    if (showDeleteConfirm) {
      setShowDeleteConfirm(false);
    }
  }, showDeleteConfirm);

  useEffect(() => {
    if (showModal || showImport) return; 

    fetchBuildings();
    const interval = setInterval(fetchBuildings, 2000);
    return () => clearInterval(interval);
  }, [showModal, showImport]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showSortDropdown && !target.closest('[data-sort-dropdown]')) {
        setShowSortDropdown(false);
      }
      if (showItemsPerPageDropdown && !target.closest('[data-items-per-page-dropdown]')) {
        setShowItemsPerPageDropdown(false);
      }
    };

    if (showSortDropdown || showItemsPerPageDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSortDropdown, showItemsPerPageDropdown]);

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
      if (loading) setLoading(false); 
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

  const handleItemsPerPageChange = (value: number | 'all') => {
    setItemsPerPage(value);
    setShowItemsPerPageDropdown(false);
    setCurrentPage(1);
  };

  const handleCustomItemsPerPage = () => {
    const numValue = parseInt(customItemsPerPage, 10);
    if (!isNaN(numValue) && numValue > 0) {
      setItemsPerPage(numValue);
      setCustomItemsPerPage('');
      setShowItemsPerPageDropdown(false);
      setCurrentPage(1);
    } else {
      toast.error('Please enter a valid positive number.');
    }
  };

  useEffect(() => {
    const checkScroll = () => {
      const container = tableContainerRef.current;
      if (!container) return;

      const { scrollLeft, scrollWidth, clientWidth } = container;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1);

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
  }, [searchTerm, sortBy]);

  const isNumeric = (str: string): boolean => {
    return !isNaN(Number(str)) && !isNaN(parseFloat(str));
  };

  // Smart sort function that handles both text and numbers
  const smartSort = (a: string, b: string): number => {
    const aIsNumeric = isNumeric(a);
    const bIsNumeric = isNumeric(b);

    if (aIsNumeric && bIsNumeric) {
      return parseFloat(a) - parseFloat(b);
    } else if (aIsNumeric && !bIsNumeric) {
      return -1;
    } else if (!aIsNumeric && bIsNumeric) {
      return 1;
    } else {
      return a.localeCompare(b);
    }
  };

  const filtered = useMemo(() => {
    let filtered = buildings.filter((b) =>
      b.building_name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Apply sorting
    if (sortBy !== 'none') {
      filtered = [...filtered].sort((a, b) => {
        if (sortBy === 'building_id') {
          return smartSort(a.building_id, b.building_id);
        } else if (sortBy === 'building_name') {
          return smartSort(a.building_name.toLowerCase(), b.building_name.toLowerCase());
        } else if (sortBy === 'room_count') {
          const aCount = roomCounts[a.building_id] || 0;
          const bCount = roomCounts[b.building_id] || 0;
          return aCount - bCount;
        }
        return 0;
      });
    }

    return filtered;
  }, [buildings, searchTerm, sortBy, roomCounts]);

  const totalItems = filtered.length;

  const effectiveItemsPerPage = useMemo(() => {
    if (totalItems === 0) return 1;

    if (itemsPerPage === 'all') {
      // "Show All" should display 20 rows per page
      return 20;
    }

    return itemsPerPage;
  }, [itemsPerPage, totalItems]);

  const totalPages = useMemo(() => {
    if (totalItems === 0) return 1;
    return Math.max(1, Math.ceil(totalItems / effectiveItemsPerPage));
  }, [totalItems, effectiveItemsPerPage]);

  const paginatedBuildings = useMemo(() => {
    if (totalItems === 0) return [];
    return filtered.slice(
      (currentPage - 1) * effectiveItemsPerPage,
      currentPage * effectiveItemsPerPage,
    );
  }, [filtered, currentPage, effectiveItemsPerPage, totalItems]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const handleBulkDelete = () => {
    const ids = Array.from(selectedBuildingIds);
    if (ids.length === 0) {
      toast.info('No buildings selected');
      return;
    }
    setDeleteCount(ids.length);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    const ids = Array.from(selectedBuildingIds);
    setShowDeleteConfirm(false);
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
    <div className="cl-page">

      {/* ── Page Header ── */}
      <div className="cl-page-header">
        <div className="cl-page-header-left">
          <div className="cl-page-icon">
            <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <div className="cl-page-title">
            <h1>Buildings</h1>
            <p>{buildings.length} building{buildings.length !== 1 ? 's' : ''} · {filtered.length} showing</p>
          </div>
        </div>

        <div className="cl-page-actions">
          {/* Search */}
          <div className="cl-search-bar">
            <FaSearch className="cl-search-icon" />
            <input
              type="text"
              placeholder="Search buildings…"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>

          <button
            type="button"
            className="cl-btn primary"
            onClick={() => { setEditMode(false); setNewBuilding({ building_id: '', building_name: '' }); setShowModal(true); }}
          >
            <FaPlus style={{ fontSize: '11px' }} /> Add
          </button>
          <button type="button" className="cl-btn" onClick={() => setShowImport(true)}>
            <FaFileImport style={{ fontSize: '11px' }} /> Import
          </button>
          <button
            type="button"
            className="cl-btn danger"
            onClick={handleBulkDelete}
            disabled={isBulkDeleting || selectedBuildingIds.size === 0}
            title={selectedBuildingIds.size > 0 ? `Delete ${selectedBuildingIds.size} selected` : 'Select rows to delete'}
          >
            <FaTrash style={{ fontSize: '11px' }} />
            {selectedBuildingIds.size > 0 && <span>({selectedBuildingIds.size})</span>}
          </button>
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div className="cl-toolbar">
        <div className="cl-toolbar-left">

          {/* Sort dropdown */}
          <div style={{ position: 'relative' }} data-sort-dropdown>
            <button
              type="button"
              className="cl-toolbar-btn"
              onClick={() => setShowSortDropdown(!showSortDropdown)}
            >
              <FaSort style={{ fontSize: '11px' }} />
              Sort{sortBy !== 'none' ? `: ${sortBy === 'building_id' ? 'ID' : sortBy === 'building_name' ? 'Name' : 'Rooms'}` : ''}
              <FaChevronDown style={{ fontSize: '9px', marginLeft: '2px' }} />
            </button>
            {showSortDropdown && (
              <div className="cl-dropdown">
                {[
                  { value: 'none', label: 'None' },
                  { value: 'building_id', label: 'Building ID' },
                  { value: 'building_name', label: 'Building Name' },
                  { value: 'room_count', label: 'Room Count' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`cl-dropdown-item${sortBy === opt.value ? ' active' : ''}`}
                    onClick={() => { setSortBy(opt.value); setShowSortDropdown(false); }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Rows per page dropdown */}
          <div style={{ position: 'relative' }} data-items-per-page-dropdown>
            <button
              type="button"
              className="cl-toolbar-btn"
              onClick={() => setShowItemsPerPageDropdown(!showItemsPerPageDropdown)}
            >
              <FaChevronDown style={{ fontSize: '9px' }} />
              Rows: {itemsPerPage === 'all' ? 'All' : itemsPerPage}
            </button>
            {showItemsPerPageDropdown && (
              <div className="cl-dropdown" style={{ minWidth: '200px' }}>
                {[10, 20, 30].map(n => (
                  <button
                    key={n}
                    type="button"
                    className={`cl-dropdown-item${itemsPerPage === n ? ' active' : ''}`}
                    onClick={() => handleItemsPerPageChange(n)}
                  >
                    {n}
                  </button>
                ))}
                <div className="cl-dropdown-divider" />
                <div className="cl-dropdown-custom">
                  <input
                    type="number"
                    className="cl-custom-input"
                    value={customItemsPerPage}
                    onChange={e => setCustomItemsPerPage(e.target.value)}
                    placeholder="Custom…"
                    min="1"
                    onKeyDown={e => { if (e.key === 'Enter') handleCustomItemsPerPage(); }}
                  />
                  <button
                    type="button"
                    className="cl-btn primary"
                    style={{ padding: '5px 10px', fontSize: '11px', height: 'auto' }}
                    onClick={handleCustomItemsPerPage}
                  >
                    Apply
                  </button>
                </div>
                <button
                  type="button"
                  className={`cl-dropdown-item${itemsPerPage === 'all' ? ' active' : ''}`}
                  onClick={() => handleItemsPerPageChange('all')}
                >
                  Show All
                </button>
              </div>
            )}
          </div>

        </div>

        {/* Pagination */}
        <div className="cl-pagination">
          <button
            type="button"
            className="cl-page-btn"
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage <= 1 || totalItems === 0}
          >
            <FaChevronLeft style={{ fontSize: '10px' }} />
          </button>
          <span className="cl-page-info">
            {totalItems === 0 ? '0 / 0' : `${currentPage} / ${totalPages}`}
          </span>
          <button
            type="button"
            className="cl-page-btn"
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage >= totalPages || totalItems === 0}
          >
            <FaChevronRight style={{ fontSize: '10px' }} />
          </button>
        </div>
      </div>

      {/* ── Table Card ── */}
      <div className="cl-table-card">
        <div className="cl-table-scroll-wrapper">
          <button
            type="button"
            className="cl-scroll-btn left"
            onClick={() => scrollTable('left')}
            disabled={!canScrollLeft}
          >
            <FaChevronLeft />
          </button>
          <button
            type="button"
            className="cl-scroll-btn right"
            onClick={() => scrollTable('right')}
            disabled={!canScrollRight}
          >
            <FaChevronRight />
          </button>

          <div className="cl-table-container" ref={tableContainerRef}>
            <table className="cl-table">
              <thead>
                <tr>
                  <th style={{ width: '52px' }}>#</th>
                  <th>Building ID</th>
                  <th>Building Name</th>
                  <th style={{ width: '110px' }}>Rooms</th>
                  <th style={{ width: '160px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span>Actions</span>
                      <input
                        type="checkbox"
                        checked={isAllSelected}
                        onChange={toggleSelectAll}
                        disabled={loading || buildings.length === 0}
                        title="Select all"
                        style={{ cursor: 'pointer' }}
                      />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="cl-table-empty">
                      <div className="cl-spinner" />
                      Loading buildings…
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="cl-table-empty">No buildings found.</td>
                  </tr>
                ) : (
                  paginatedBuildings.map((b, index) => {
                    const isSelected = selectedBuildingIds.has(b.building_id);
                    return (
                      <tr key={b.building_id} className={isSelected ? 'selected' : ''}>
                        <td className="cl-td-num">{(currentPage - 1) * effectiveItemsPerPage + index + 1}</td>
                        <td><span className="cl-id-badge">{b.building_id}</span></td>
                        <td>{b.building_name}</td>
                        <td>
                          <span className="cl-room-count-badge">{roomCounts[b.building_id] || 0}</span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <button
                              type="button"
                              className="cl-icon-btn view"
                              onClick={() => openRoomModal(b.building_id)}
                            >
                              <FaEye style={{ fontSize: '10px' }} /> View
                            </button>
                            <button
                              type="button"
                              className="cl-icon-btn edit"
                              onClick={() => { setEditMode(true); setNewBuilding(b); setShowModal(true); }}
                            >
                              <FaEdit style={{ fontSize: '10px' }} /> Edit
                            </button>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelect(b.building_id)}
                              aria-label={`Select ${b.building_name}`}
                              style={{ marginLeft: 'auto', cursor: 'pointer' }}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ════ ADD / EDIT MODAL ════ */}
      {showModal && (
        <div className="cl-modal-overlay" onClick={() => { setShowModal(false); setEditMode(false); }}>
          <div className="cl-modal" onClick={e => e.stopPropagation()}>
            <div className="cl-modal-header">
              <h3>{editMode ? 'Edit Building' : 'Add New Building'}</h3>
            </div>
            <div className="cl-modal-body">
              <div className="cl-field">
                <label>Building ID</label>
                <input
                  type="text"
                  className="cl-input"
                  disabled={editMode}
                  value={newBuilding.building_id}
                  onChange={e => setNewBuilding({ ...newBuilding, building_id: e.target.value })}
                  placeholder="e.g. BLDG. 09"
                />
              </div>
              <div className="cl-field">
                <label>Building Name</label>
                <input
                  type="text"
                  className="cl-input"
                  value={newBuilding.building_name}
                  onChange={e => setNewBuilding({ ...newBuilding, building_name: e.target.value })}
                  placeholder="e.g. ICT Building"
                />
              </div>
            </div>
            <div className="cl-modal-footer">
              <button type="button" className="cl-btn" onClick={() => { setShowModal(false); setEditMode(false); }}>Cancel</button>
              <button type="button" className="cl-btn primary" onClick={handleSubmit}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* ════ IMPORT MODAL ════ */}
      {showImport && (
        <div className="cl-modal-overlay" onClick={() => setShowImport(false)}>
          <div className="cl-modal" onClick={e => e.stopPropagation()}>
            <div className="cl-modal-header">
              <h3>Import Buildings</h3>
              <p>Upload an .xlsx file using the template below.</p>
            </div>
            <div className="cl-modal-body">
              <p className="cl-import-hint">Each building must have a unique Building ID and Name.</p>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleImportFile}
                disabled={isImporting}
                className="cl-file-input"
              />
              <button
                type="button"
                className="cl-btn"
                onClick={downloadTemplate}
                disabled={isImporting}
                style={{ width: '100%', justifyContent: 'center', marginTop: '8px' }}
              >
                <FaDownload style={{ fontSize: '11px' }} /> Download Template
              </button>
            </div>
            <div className="cl-modal-footer">
              <button type="button" className="cl-btn primary" onClick={() => setShowImport(false)} disabled={isImporting}>
                {isImporting ? 'Importing…' : 'Done'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════ ROOM LIST MODAL ════ */}
      {showRoomModal && (
        <div className="cl-modal-overlay" onClick={() => { setShowRoomModal(false); setSelectedBuildingName(''); setSelectedBuildingRooms([]); }}>
          <div className="cl-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '560px' }}>
            <div className="cl-modal-header">
              <h3>Rooms in {selectedBuildingName}</h3>
              <p>{selectedBuildingRooms.length} room{selectedBuildingRooms.length !== 1 ? 's' : ''}</p>
            </div>
            <div className="cl-modal-body" style={{ padding: '16px 24px' }}>
              {selectedBuildingRooms.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--cl-text-muted)', padding: '24px 0', fontSize: '13px' }}>
                  No rooms found in this building.
                </div>
              ) : (
                <table className="cl-table" style={{ fontSize: '12.5px' }}>
                  <thead>
                    <tr>
                      <th>Room ID</th>
                      <th>Room Name</th>
                      <th>Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedBuildingRooms.map(room => (
                      <tr key={room.room_id}>
                        <td><span className="cl-id-badge">{room.room_id}</span></td>
                        <td>{room.room_name}</td>
                        <td>
                          <span className={`cl-room-type-badge ${room.room_type === 'Lecture' ? 'lecture' : 'lab'}`}>
                            {room.room_type}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="cl-modal-footer">
              <button type="button" className="cl-btn primary" onClick={() => { setShowRoomModal(false); setSelectedBuildingName(''); setSelectedBuildingRooms([]); }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════ DELETE CONFIRM MODAL ════ */}
      {showDeleteConfirm && (
        <div className="cl-modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="cl-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '380px' }}>
            <div className="cl-modal-header">
              <h3>Confirm Deletion</h3>
            </div>
            <div className="cl-modal-body">
              <p style={{ fontSize: '13.5px', color: 'var(--cl-text-secondary)', lineHeight: 1.7, margin: 0 }}>
                {deleteCount === 1
                  ? 'You are about to delete 1 building. This action cannot be undone.'
                  : `You are about to delete ${deleteCount} buildings. This action cannot be undone.`}
              </p>
            </div>
            <div className="cl-modal-footer">
              <button type="button" className="cl-btn" onClick={() => setShowDeleteConfirm(false)} disabled={isBulkDeleting}>Cancel</button>
              <button type="button" className="cl-btn danger-fill" onClick={confirmDelete} disabled={isBulkDeleting}>
                {isBulkDeleting ? 'Deleting…' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer position="top-right" autoClose={3000} />
    </div>
  );
};

export default Buildings;