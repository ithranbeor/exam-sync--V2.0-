// deno-lint-ignore-file no-explicit-any
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { FaTrash, FaEdit, FaSearch, FaDownload,  FaPlus, FaFileImport, FaChevronLeft, FaChevronRight, FaSort, FaChevronDown } from 'react-icons/fa';
import { api } from '../lib/apiClient.ts';
import { ToastContainer, toast } from 'react-toastify';
import * as XLSX from 'xlsx';
import 'react-toastify/dist/ReactToastify.css';
import '../styles/colleges.css';
import Select from 'react-select';
import { useEscapeKey } from '../hooks/useEscapeKey';

interface Room {
  room_id: string;
  room_name: string;
  room_type: string;
  room_capacity: number;
  building_id: string;
  building_name?: string;
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
  const [loading, setLoading] = useState(true); // new state
  const [isImporting, setIsImporting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState<number | 'all'>('all');
  const [showItemsPerPageDropdown, setShowItemsPerPageDropdown] = useState(false);
  const [customItemsPerPage, setCustomItemsPerPage] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [sortBy, setSortBy] = useState<string>('none');
  const [showSortDropdown, setShowSortDropdown] = useState(false);

  const [newRoom, setNewRoom] = useState<Room>({
    room_id: '',
    room_name: '',
    room_type: '',
    room_capacity: 0,
    building_id: '',
  });

  // Handle ESC key to close modals
  useEscapeKey(() => {
    if (showModal) {
      setShowModal(false);
      setEditMode(false);
      setNewRoom({
        room_id: '',
        room_name: '',
        room_type: '',
        room_capacity: 0,
        building_id: '',
      });
    }
  }, showModal);

  useEscapeKey(() => {
    if (showImport) {
      setShowImport(false);
    }
  }, showImport);

  // ✅ Fetch all data once on mount
  useEffect(() => {
    fetchAll();
  }, []);

  // Close dropdown when clicking outside
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

  // ✅ Unified fetch for both rooms & buildings
  const fetchAll = async () => {
    try {
      setLoading(true);
      const [roomRes, buildingRes] = await Promise.all([
        api.get('/tbl_rooms'),
        api.get('/tbl_buildings'),
      ]);
      setRooms(roomRes.data ?? []);
      setBuildings(buildingRes.data ?? []);
    } catch (err: any) {
      console.error(err.message);
      toast.error('Failed to fetch rooms or buildings');
    } finally {
      setLoading(false);
    }
  };

  // ✅ Create or update
  const handleSubmit = async () => {
    const { room_id, room_name, room_type, room_capacity, building_id } = newRoom;
    if (!room_id || !room_name || !room_type || !room_capacity || !building_id) {
      toast.error('All fields are required');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        room_name,
        room_type,
        room_capacity,
        building: building_id, // Django expects FK
      };

      if (editMode) {
        await api.put(`/tbl_rooms/${room_id}/`, payload);
        toast.success('Room updated successfully');
      } else {
        await api.post('/tbl_rooms', { room_id, ...payload });
        toast.success('Room added successfully');
      }

      setShowModal(false);
      setTimeout(() => fetchAll(), 300); // small delay for smoother refresh
    } catch (err: any) {
      console.error(err.response?.data || err.message);
      toast.error('Failed to save room');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ✅ Bulk selection and delete
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const isAllSelected = rooms.length > 0 && rooms.every((r) => selectedIds.has(r.room_id));

  const toggleSelectAll = () => {
    setSelectedIds(() => {
      if (isAllSelected) return new Set();
      const all = new Set<string>();
      rooms.forEach((r) => all.add(r.room_id));
      return all;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

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

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) {
      toast.info('No rooms selected');
      return;
    }
    if (!globalThis.confirm(`Delete ${ids.length} selected room(s)?`)) return;
    setIsBulkDeleting(true);
    try {
      const results = await Promise.allSettled(ids.map((id) => api.delete(`/tbl_rooms/${id}/`)));
      const ok = results.filter((r) => r.status === 'fulfilled').length;
      const fail = results.length - ok;
      if (ok) toast.success(`Deleted ${ok} room(s)`);
      if (fail) toast.error(`${fail} failed to delete`);
      clearSelection();
      setTimeout(() => fetchAll(), 300);
    } catch {
      toast.error('Bulk delete failed');
    } finally {
      setIsBulkDeleting(false);
    }
  };

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
  }, [rooms, searchTerm, loading]);

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

  // ✅ Import Excel
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
          const room_id = row['Room ID']?.trim();
          const room_name = row['Room Name']?.trim();
          const room_type = row['Room Type']?.trim();
          const room_capacity = parseInt(row['Room Capacity'] || 0);
          const building_id = row['Building ID']?.trim();

          if (!room_id || !room_name || !room_type || !room_capacity || !building_id) continue;

          try {
            await api.post('/tbl_rooms', {
              room_id,
              room_name,
              room_type,
              room_capacity,
              building: building_id,
            });
            added++;
          } catch {
            continue;
          }
        }

        toast.success(`Import completed: ${added} room(s) added`);
        setTimeout(() => fetchAll(), 300);
      } catch {
        toast.error('Error reading or importing file');
      } finally {
        setIsImporting(false);
        setShowImport(false);
      }
    };

    reader.readAsArrayBuffer(file);
  };

  // ✅ Download Template
  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['Room ID', 'Room Name', 'Room Type', 'Room Capacity', 'Building ID'],
      ['9-301', 'Cisco Lab', 'Laboratory', 15, 'BLDG.09'],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Rooms Template');
    XLSX.writeFile(wb, 'rooms_template.xlsx');
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, sortBy]);

  // Helper function to determine if a string is numeric
  const isNumeric = (str: string): boolean => {
    return !isNaN(Number(str)) && !isNaN(parseFloat(str));
  };

  // Smart sort function that handles both text and numbers
  const smartSort = (a: string, b: string): number => {
    const aIsNumeric = isNumeric(a);
    const bIsNumeric = isNumeric(b);

    if (aIsNumeric && bIsNumeric) {
      // Both are numbers - sort numerically
      return parseFloat(a) - parseFloat(b);
    } else if (aIsNumeric && !bIsNumeric) {
      // a is number, b is text - numbers come first
      return -1;
    } else if (!aIsNumeric && bIsNumeric) {
      // a is text, b is number - numbers come first
      return 1;
    } else {
      // Both are text - sort alphabetically
      return a.localeCompare(b);
    }
  };

  const filtered = useMemo(() => {
    let filtered = rooms.filter(
      (r) =>
        r.room_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.room_id.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Apply sorting
    if (sortBy !== 'none') {
      filtered = [...filtered].sort((a, b) => {
        if (sortBy === 'room_id') {
          return smartSort(a.room_id.toLowerCase(), b.room_id.toLowerCase());
        } else if (sortBy === 'room_name') {
          return smartSort(a.room_name.toLowerCase(), b.room_name.toLowerCase());
        } else if (sortBy === 'room_type') {
          return smartSort(a.room_type.toLowerCase(), b.room_type.toLowerCase());
        } else if (sortBy === 'room_capacity') {
          return a.room_capacity - b.room_capacity;
        } else if (sortBy === 'building') {
          const aBuilding = a.building_name || buildings.find(bld => bld.building_id === a.building_id)?.building_name || '';
          const bBuilding = b.building_name || buildings.find(bld => bld.building_id === b.building_id)?.building_name || '';
          return smartSort(aBuilding.toLowerCase(), bBuilding.toLowerCase());
        }
        return 0;
      });
    }

    return filtered;
  }, [rooms, searchTerm, sortBy, buildings]);

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

  const paginatedRooms = useMemo(() => {
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

  return (
    <div className="colleges-container">
      <div className="colleges-header">
        <div className="search-bar" style={{ marginLeft: 'auto' }}>
          <input
            type="text"
            placeholder="Search Room Name"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button type="button" className="search-button">
            <FaSearch />
          </button>
        </div>
      </div>

      <div className="colleges-actions">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              className="action-button add-new with-label"
              onClick={() => {
                setEditMode(false);
                setNewRoom({
                  room_id: '',
                  room_name: '',
                  room_type: '',
                  room_capacity: 0,
                  building_id: '',
                });
                setShowModal(true);
              }}
            >
              <FaPlus/><span className="btn-label">Add</span>
            </button>

            <button type="button" className="action-button import with-label" onClick={() => setShowImport(true)}>
              <FaFileImport/><span className="btn-label">Import</span>
            </button>
            <div style={{ position: 'relative' }} data-sort-dropdown>
              <button
                type='button'
                className="action-button with-label sort-by-button"
                onClick={() => setShowSortDropdown(!showSortDropdown)}
                title="Sort by"
              >
                <FaSort />
                <span className="btn-label">Sort by</span>
              </button>
              {showSortDropdown && (
                <div 
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    marginTop: '4px',
                    backgroundColor: 'white',
                    border: '1px solid #ddd',
                    borderRadius: '8px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                    zIndex: 1000,
                    minWidth: '150px'
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setSortBy('none');
                      setShowSortDropdown(false);
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      textAlign: 'left',
                      border: 'none',
                      backgroundColor: sortBy === 'none' ? '#f0f0f0' : 'white',
                      color: '#000',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                    onMouseEnter={(e) => {
                      if (sortBy !== 'none') e.currentTarget.style.backgroundColor = '#f5f5f5';
                    }}
                    onMouseLeave={(e) => {
                      if (sortBy !== 'none') e.currentTarget.style.backgroundColor = 'white';
                    }}
                  >
                    None
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSortBy('room_id');
                      setShowSortDropdown(false);
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      textAlign: 'left',
                      border: 'none',
                      backgroundColor: sortBy === 'room_id' ? '#f0f0f0' : 'white',
                      color: '#000',
                      cursor: 'pointer',
                      fontSize: '14px',
                      borderTop: '1px solid #eee'
                    }}
                    onMouseEnter={(e) => {
                      if (sortBy !== 'room_id') e.currentTarget.style.backgroundColor = '#f5f5f5';
                    }}
                    onMouseLeave={(e) => {
                      if (sortBy !== 'room_id') e.currentTarget.style.backgroundColor = 'white';
                    }}
                  >
                    Room #
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSortBy('room_name');
                      setShowSortDropdown(false);
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      textAlign: 'left',
                      border: 'none',
                      backgroundColor: sortBy === 'room_name' ? '#f0f0f0' : 'white',
                      color: '#000',
                      cursor: 'pointer',
                      fontSize: '14px',
                      borderTop: '1px solid #eee'
                    }}
                    onMouseEnter={(e) => {
                      if (sortBy !== 'room_name') e.currentTarget.style.backgroundColor = '#f5f5f5';
                    }}
                    onMouseLeave={(e) => {
                      if (sortBy !== 'room_name') e.currentTarget.style.backgroundColor = 'white';
                    }}
                  >
                    Room Name
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSortBy('room_type');
                      setShowSortDropdown(false);
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      textAlign: 'left',
                      border: 'none',
                      backgroundColor: sortBy === 'room_type' ? '#f0f0f0' : 'white',
                      color: '#000',
                      cursor: 'pointer',
                      fontSize: '14px',
                      borderTop: '1px solid #eee'
                    }}
                    onMouseEnter={(e) => {
                      if (sortBy !== 'room_type') e.currentTarget.style.backgroundColor = '#f5f5f5';
                    }}
                    onMouseLeave={(e) => {
                      if (sortBy !== 'room_type') e.currentTarget.style.backgroundColor = 'white';
                    }}
                  >
                    Type
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSortBy('room_capacity');
                      setShowSortDropdown(false);
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      textAlign: 'left',
                      border: 'none',
                      backgroundColor: sortBy === 'room_capacity' ? '#f0f0f0' : 'white',
                      color: '#000',
                      cursor: 'pointer',
                      fontSize: '14px',
                      borderTop: '1px solid #eee'
                    }}
                    onMouseEnter={(e) => {
                      if (sortBy !== 'room_capacity') e.currentTarget.style.backgroundColor = '#f5f5f5';
                    }}
                    onMouseLeave={(e) => {
                      if (sortBy !== 'room_capacity') e.currentTarget.style.backgroundColor = 'white';
                    }}
                  >
                    Capacity
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSortBy('building');
                      setShowSortDropdown(false);
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      textAlign: 'left',
                      border: 'none',
                      backgroundColor: sortBy === 'building' ? '#f0f0f0' : 'white',
                      color: '#000',
                      cursor: 'pointer',
                      fontSize: '14px',
                      borderTop: '1px solid #eee'
                    }}
                    onMouseEnter={(e) => {
                      if (sortBy !== 'building') e.currentTarget.style.backgroundColor = '#f5f5f5';
                    }}
                    onMouseLeave={(e) => {
                      if (sortBy !== 'building') e.currentTarget.style.backgroundColor = 'white';
                    }}
                  >
                    Building
                  </button>
                </div>
              )}
            </div>
            <div style={{ position: 'relative' }} data-items-per-page-dropdown>
              <button
                type="button"
                className="action-button with-label show-rows-button"
                onClick={() => setShowItemsPerPageDropdown(!showItemsPerPageDropdown)}
              >
                <FaChevronDown size={12} />
                <span className="btn-label">Show rows: {itemsPerPage === 'all' ? 'All' : itemsPerPage}</span>
              </button>
              {showItemsPerPageDropdown && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    marginTop: '4px',
                    backgroundColor: 'white',
                    border: '1px solid #ddd',
                    borderRadius: '8px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                    zIndex: 1000,
                    minWidth: '240px',
                    padding: '8px'
                  }}
                >
                  <button
                    type="button"
                    onClick={() => handleItemsPerPageChange(10)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      textAlign: 'left',
                      border: 'none',
                      backgroundColor: itemsPerPage === 10 ? '#f0f0f0' : 'white',
                      color: '#000',
                      cursor: 'pointer',
                      fontSize: '14px',
                      borderRadius: '4px'
                    }}
                    onMouseEnter={(e) => {
                      if (itemsPerPage !== 10) e.currentTarget.style.backgroundColor = '#f5f5f5';
                    }}
                    onMouseLeave={(e) => {
                      if (itemsPerPage !== 10) e.currentTarget.style.backgroundColor = 'white';
                    }}
                  >
                    10
                  </button>
                  <button
                    type="button"
                    onClick={() => handleItemsPerPageChange(20)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      textAlign: 'left',
                      border: 'none',
                      backgroundColor: itemsPerPage === 20 ? '#f0f0f0' : 'white',
                      color: '#000',
                      cursor: 'pointer',
                      fontSize: '14px',
                      borderRadius: '4px',
                      borderTop: '1px solid #eee'
                    }}
                    onMouseEnter={(e) => {
                      if (itemsPerPage !== 20) e.currentTarget.style.backgroundColor = '#f5f5f5';
                    }}
                    onMouseLeave={(e) => {
                      if (itemsPerPage !== 20) e.currentTarget.style.backgroundColor = 'white';
                    }}
                  >
                    20
                  </button>
                  <button
                    type="button"
                    onClick={() => handleItemsPerPageChange(30)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      textAlign: 'left',
                      border: 'none',
                      backgroundColor: itemsPerPage === 30 ? '#f0f0f0' : 'white',
                      color: '#000',
                      cursor: 'pointer',
                      fontSize: '14px',
                      borderRadius: '4px',
                      borderTop: '1px solid #eee'
                    }}
                    onMouseEnter={(e) => {
                      if (itemsPerPage !== 30) e.currentTarget.style.backgroundColor = '#f5f5f5';
                    }}
                    onMouseLeave={(e) => {
                      if (itemsPerPage !== 30) e.currentTarget.style.backgroundColor = 'white';
                    }}
                  >
                    30
                  </button>
                  <div style={{ borderTop: '1px solid #eee', marginTop: '4px', paddingTop: '8px' }}>
                    <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
                      <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
                        <input
                          type="number"
                          data-custom-input
                          className="custom-number-input"
                          value={customItemsPerPage}
                          onChange={(e) => setCustomItemsPerPage(e.target.value)}
                          placeholder="Custom Number"
                          min="1"
                          style={{
                            width: '100%',
                            padding: '6px 32px 6px 8px',
                            border: '1px solid #0A3765',
                            borderRadius: '4px',
                            fontSize: '14px',
                            backgroundColor: '#ffffff',
                            color: '#333',
                            outline: 'none'
                          }}
                          onFocus={(e) => {
                            e.target.style.borderColor = '#0d4a7a';
                            e.target.style.boxShadow = '0 0 0 2px rgba(10, 55, 101, 0.1)';
                          }}
                          onBlur={(e) => {
                            e.target.style.borderColor = '#0A3765';
                            e.target.style.boxShadow = 'none';
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleCustomItemsPerPage();
                            }
                          }}
                        />
                        <div style={{ position: 'absolute', right: '2px', display: 'flex', flexDirection: 'column', height: 'calc(100% - 4px)', gap: '0px', justifyContent: 'center', alignItems: 'center' }}>
                          <button
                            type="button"
                            onClick={() => {
                              const current = parseInt(customItemsPerPage) || 1;
                              setCustomItemsPerPage(String(current + 1));
                            }}
                            style={{
                              height: 'auto',
                              background: 'transparent',
                              border: 'none',
                              color: '#0A3765',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '10px',
                              fontWeight: 'bold',
                              padding: '0',
                              width: '16px',
                              lineHeight: '1',
                              transition: 'color 0.2s',
                              borderRadius: '0',
                              boxSizing: 'border-box'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.color = '#0d4a7a';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.color = '#0A3765';
                            }}
                          >
                            ^
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const current = parseInt(customItemsPerPage) || 1;
                              if (current > 1) {
                                setCustomItemsPerPage(String(current - 1));
                              }
                            }}
                            style={{
                              height: 'auto',
                              background: 'transparent',
                              border: 'none',
                              color: '#0A3765',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '10px',
                              fontWeight: 'bold',
                              padding: '0',
                              width: '16px',
                              lineHeight: '1',
                              transition: 'color 0.2s',
                              borderRadius: '0',
                              boxSizing: 'border-box'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.color = '#0d4a7a';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.color = '#0A3765';
                            }}
                          >
                            v
                          </button>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleCustomItemsPerPage}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: '#0A3765',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}
                      >
                        Apply
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleItemsPerPageChange('all')}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        textAlign: 'left',
                        border: 'none',
                        backgroundColor: itemsPerPage === 'all' ? '#f0f0f0' : 'white',
                        color: '#000',
                        cursor: 'pointer',
                        fontSize: '14px',
                        borderRadius: '4px',
                        marginTop: '4px'
                      }}
                      onMouseEnter={(e) => {
                        if (itemsPerPage !== 'all') e.currentTarget.style.backgroundColor = '#f5f5f5';
                      }}
                      onMouseLeave={(e) => {
                        if (itemsPerPage !== 'all') e.currentTarget.style.backgroundColor = 'white';
                      }}
                    >
                      Show All
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              className="action-button delete"
              onClick={handleBulkDelete}
              disabled={isBulkDeleting || selectedIds.size === 0}
              title={selectedIds.size ? `Delete ${selectedIds.size} selected` : 'Delete selected'}
            >
              <FaTrash/>
            </button>
          </div>
        </div>
      </div>

      <div className="pagination-controls">
        <button
          type="button"
          className="pagination-arrow-btn"
          onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
          disabled={currentPage <= 1 || totalItems === 0}
        >
          {"<"}
        </button>
        <span className="pagination-page-number">
          {totalItems === 0 ? '0/0' : `${currentPage}/${totalPages}`}
        </span>
        <button
          type="button"
          className="pagination-arrow-btn"
          onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
          disabled={currentPage >= totalPages || totalItems === 0}
        >
          {">"}
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
              <th>Room #</th>
              <th>Room Name</th>
              <th>Type</th>
              <th>Capacity</th>
              <th>Building</th>
              <th>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>Actions</span>
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={toggleSelectAll}
                    disabled={loading || rooms.length === 0}
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
                <td colSpan={7} style={{ textAlign: 'center', padding: '20px' }}>
                  Loading rooms...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '20px' }}>
                  No rooms found.
                </td>
              </tr>
            ) : (
              paginatedRooms.map((r, i) => {
                const isSelected = selectedIds.has(r.room_id);
                return (
                <tr 
                  key={r.room_id}
                  style={{
                    backgroundColor: isSelected ? '#f8d7da' : 'transparent',
                  }}
                >
                  <td>{(currentPage - 1) * effectiveItemsPerPage + i + 1}</td>
                  <td>{r.room_id}</td>
                  <td>{r.room_name}</td>
                  <td>{r.room_type}</td>
                  <td>{r.room_capacity}</td>
                  <td>{r.building_name || r.building_id}</td>
                  <td className="action-buttons" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      type="button"
                      className="icon-button edit-button"
                      onClick={() => {
                        setEditMode(true);
                        setNewRoom({
                          room_id: r.room_id,
                          room_name: r.room_name,
                          room_type: r.room_type,
                          room_capacity: r.room_capacity,
                          building_id: r.building_id,
                        });
                        setShowModal(true);
                      }}
                    >
                      <FaEdit />
                    </button>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(r.room_id)}
                      onChange={() => toggleSelect(r.room_id)}
                      aria-label={`Select ${r.room_name}`}
                      style={{ marginLeft: 'auto' }}
                    />
                  </td>
                </tr>
                );
              })
            )}
          </tbody>
        </table>
        </div>
      </div>

      {/* ✅ Add/Edit Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3 style={{ textAlign: 'center' }}>{editMode ? 'Edit Room' : 'Add New Room'}</h3>
            <div className="input-group">
              <label>Room ID</label>
              <input
                type="text"
                value={newRoom.room_id}
                disabled={editMode}
                onChange={(e) => setNewRoom({ ...newRoom, room_id: e.target.value })}
              />
            </div>
            <div className="input-group">
              <label>Room Name</label>
              <input
                type="text"
                value={newRoom.room_name}
                onChange={(e) => setNewRoom({ ...newRoom, room_name: e.target.value })}
              />
            </div>
            <div className="input-group">
              <label>Room Type</label>
              <select
                value={newRoom.room_type}
                onChange={(e) => setNewRoom({ ...newRoom, room_type: e.target.value })}
              >
                <option value="">Select Type</option>
                <option value="Lecture">Lecture</option>
                <option value="Laboratory">Laboratory</option>
              </select>
            </div>
            <div className="input-group">
              <label>Room Capacity</label>
              <input
                type="number"
                value={newRoom.room_capacity}
                onChange={(e) =>
                  setNewRoom({ ...newRoom, room_capacity: parseInt(e.target.value) || 0 })
                }
              />
            </div>
            <div className="input-group">
              <label>Building</label>
              <Select
                className="react-select"
                classNamePrefix="select"
                options={buildings
                  .sort((a, b) => a.building_name.localeCompare(b.building_name))
                  .map((b) => ({
                    value: b.building_id,
                    label: `${b.building_name} (${b.building_id})`,
                  }))}
                value={buildings
                  .map((b) => ({
                    value: b.building_id,
                    label: `${b.building_name} (${b.building_id})`,
                  }))
                  .find((option) => option.value === newRoom.building_id)}
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
              <button type="button" onClick={() => setShowModal(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ✅ Import Modal */}
      {showImport && (
        <div className="modal-overlay">
          <div className="modal">
            <h3 style={{ textAlign: 'center' }}>Import Rooms</h3>
            <p style={{ fontSize: '12px', color: '#666', marginBottom: '10px' }}>
              Each room must have a unique Room ID and valid Building ID.
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

      <ToastContainer position="top-right" autoClose={3000} />
    </div>
  );
};

export default Rooms;
