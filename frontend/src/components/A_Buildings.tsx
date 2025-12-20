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
    <div className="colleges-container">
      <div className="colleges-header">
        <div className="search-bar" style={{ marginLeft: 'auto' }}>
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
              className="action-button add-new with-label"
              onClick={() => {
                setEditMode(false);
                setNewBuilding({ building_id: '', building_name: '' });
                setShowModal(true);
              }}
            >
              <FaPlus /><span className="btn-label">Add</span>
            </button>
            <button
              type="button"
              className="action-button import with-label"
              onClick={() => setShowImport(true)}
            >
              <FaFileImport /><span className="btn-label">Import</span>
            </button>
            <div style={{ position: 'relative' }} data-sort-dropdown>
              <button
                type="button"
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
                      setSortBy('building_id');
                      setShowSortDropdown(false);
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      textAlign: 'left',
                      border: 'none',
                      backgroundColor: sortBy === 'building_id' ? '#f0f0f0' : 'white',
                      color: '#000',
                      cursor: 'pointer',
                      fontSize: '14px',
                      borderTop: '1px solid #eee'
                    }}
                    onMouseEnter={(e) => {
                      if (sortBy !== 'building_id') e.currentTarget.style.backgroundColor = '#f5f5f5';
                    }}
                    onMouseLeave={(e) => {
                      if (sortBy !== 'building_id') e.currentTarget.style.backgroundColor = 'white';
                    }}
                  >
                    Building ID
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSortBy('building_name');
                      setShowSortDropdown(false);
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      textAlign: 'left',
                      border: 'none',
                      backgroundColor: sortBy === 'building_name' ? '#f0f0f0' : 'white',
                      color: '#000',
                      cursor: 'pointer',
                      fontSize: '14px',
                      borderTop: '1px solid #eee'
                    }}
                    onMouseEnter={(e) => {
                      if (sortBy !== 'building_name') e.currentTarget.style.backgroundColor = '#f5f5f5';
                    }}
                    onMouseLeave={(e) => {
                      if (sortBy !== 'building_name') e.currentTarget.style.backgroundColor = 'white';
                    }}
                  >
                    Building Name
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSortBy('room_count');
                      setShowSortDropdown(false);
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      textAlign: 'left',
                      border: 'none',
                      backgroundColor: sortBy === 'room_count' ? '#f0f0f0' : 'white',
                      color: '#000',
                      cursor: 'pointer',
                      fontSize: '14px',
                      borderTop: '1px solid #eee'
                    }}
                    onMouseEnter={(e) => {
                      if (sortBy !== 'room_count') e.currentTarget.style.backgroundColor = '#f5f5f5';
                    }}
                    onMouseLeave={(e) => {
                      if (sortBy !== 'room_count') e.currentTarget.style.backgroundColor = 'white';
                    }}
                  >
                    Room Count
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
              disabled={isBulkDeleting || selectedBuildingIds.size === 0}
              title={selectedBuildingIds.size > 0 ? `Delete ${selectedBuildingIds.size} selected` : 'Delete selected'}
            >
              <FaTrash />
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
                paginatedBuildings.map((b, index) => {
                  const isSelected = selectedBuildingIds.has(b.building_id);
                  return (
                    <tr
                      key={b.building_id}
                      style={{
                        backgroundColor: isSelected ? '#f8d7da' : 'transparent',
                      }}
                    >
                      <td>{(currentPage - 1) * effectiveItemsPerPage + index + 1}</td>
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
                          <FaEye /> View
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
                          <FaEdit /> Edit
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
                  );
                })
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
          <div className="modal room-modal">
            <h3>Rooms in {selectedBuildingName}</h3>
            <div className="room-modal-table-container">
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
            </div>
            <div className="modal-actions">
              <button type="button" onClick={() => setShowRoomModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="modal delete-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Are you sure to delete this Building?</h3>
            <p className="delete-confirm-message">
              {deleteCount === 1 
                ? 'Delete this one building' 
                : `Delete these ${deleteCount} buildings`}
            </p>
            <div className="modal-actions">
              <button 
                type="button" 
                className="modal-button confirm-delete"
                onClick={confirmDelete}
                disabled={isBulkDeleting}
              >
                {isBulkDeleting ? 'Deleting...' : 'Delete'}
              </button>
              <button 
                type="button" 
                className="modal-button cancel-delete"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isBulkDeleting}
              >
                Cancel
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