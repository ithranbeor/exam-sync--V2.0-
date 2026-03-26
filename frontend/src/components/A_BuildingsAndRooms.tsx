// deno-lint-ignore-file no-explicit-any
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { FaSearch, FaTrash, FaEdit, FaDownload, FaEye, FaPlus, FaFileImport, FaChevronLeft, FaChevronRight, FaSort, FaChevronDown } from 'react-icons/fa';
import { ToastContainer, toast } from 'react-toastify';
import * as XLSX from 'xlsx';
import { api } from '../lib/apiClient.ts';
import 'react-toastify/dist/ReactToastify.css';
import '../styles/A_Colleges.css';
import { useEscapeKey } from '../hooks/useEscapeKey.ts';
import Select from 'react-select';

interface Building {
    building_id: string;
    building_name: string;
}

interface Room {
    room_id: string;
    room_name: string;
    room_type: string;
    room_capacity: number;
    building_id: string;
}

interface ExpandedBuilding extends Building {
    rooms: Room[];
}

const BuildingsAndRooms: React.FC = () => {
    const [expandedBuildings, setExpandedBuildings] = useState<ExpandedBuilding[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [showBuildingModal, setShowBuildingModal] = useState(false);
    const [showRoomModal, setShowRoomModal] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [loading, setLoading] = useState(true);
    const [isImporting, setIsImporting] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState<number | 'all'>('all');
    const [showItemsPerPageDropdown, setShowItemsPerPageDropdown] = useState(false);
    const [customItemsPerPage, setCustomItemsPerPage] = useState<string>('');
    const [selectedBuildingIds, setSelectedBuildingIds] = useState<Set<string>>(new Set());
    const [selectedRoomIds, setSelectedRoomIds] = useState<Set<string>>(new Set());
    const [isBulkDeleting, setIsBulkDeleting] = useState(false);
    const [sortBy, setSortBy] = useState<string>('none');
    const [showSortDropdown, setShowSortDropdown] = useState(false);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleteCount, setDeleteCount] = useState(0);
    const [deleteType, setDeleteType] = useState<'building' | 'room'>('building');
    const [showBuildingRoomsModal, setShowBuildingRoomsModal] = useState(false);
    const [selectedBuildingForRooms, setSelectedBuildingForRooms] = useState<ExpandedBuilding | null>(null);
    const tableContainerRef = useRef<HTMLDivElement>(null);

    const [newBuilding, setNewBuilding] = useState<Building>({ building_id: '', building_name: '' });
    const [newRoom, setNewRoom] = useState<Room>({
        room_id: '',
        room_name: '',
        room_type: '',
        room_capacity: 0,
        building_id: '',
    });

    // Handle ESC key to close modals
    useEscapeKey(() => {
        if (showBuildingModal) {
            setShowBuildingModal(false);
            setEditMode(false);
            setNewBuilding({ building_id: '', building_name: '' });
        }
    }, showBuildingModal);

    useEscapeKey(() => {
        if (showRoomModal) {
            setShowRoomModal(false);
            setEditMode(false);
            setNewRoom({ room_id: '', room_name: '', room_type: '', room_capacity: 0, building_id: '' });
        }
    }, showRoomModal);

    useEscapeKey(() => {
        if (showImportModal) {
            setShowImportModal(false);
        }
    }, showImportModal);

    useEscapeKey(() => {
        if (showDeleteConfirm) {
            setShowDeleteConfirm(false);
        }
    }, showDeleteConfirm);

    useEscapeKey(() => {
        if (showBuildingRoomsModal) {
            setShowBuildingRoomsModal(false);
            setSelectedBuildingForRooms(null);
        }
    }, showBuildingRoomsModal);

    useEffect(() => {
        fetchData();
    }, []);

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

    const fetchData = async () => {
        try {
            setLoading(true);
            const [buildingsRes, roomsRes] = await Promise.all([
                api.get('/tbl_buildings'),
                api.get('/tbl_rooms'),
            ]);

            const buildings = buildingsRes.data || [];
            const rooms = roomsRes.data || [];

            const expandedData: ExpandedBuilding[] = buildings.map((b: Building) => ({
                ...b,
                rooms: rooms.filter((r: Room) => r.building_id === b.building_id),
            }));

            setExpandedBuildings(expandedData);
        } catch (err) {
            console.error(err);
            toast.error('Failed to fetch data');
        } finally {
            setLoading(false);
        }
    };

    const openBuildingRoomsModal = (building: ExpandedBuilding) => {
        setSelectedBuildingForRooms(building);
        setShowBuildingRoomsModal(true);
    };

    const handleBuildingSubmit = async () => {
        const { building_id, building_name } = newBuilding;
        if (!building_id || !building_name) { toast.error('All fields are required'); return; }

        // Optimistic update
        if (editMode) {
            setExpandedBuildings(prev =>
            prev.map(b => b.building_id === building_id ? { ...b, building_name } : b)
            );
        } else {
            setExpandedBuildings(prev => [...prev, { building_id, building_name, rooms: [] }]);
        }

        setShowBuildingModal(false);
        setNewBuilding({ building_id: '', building_name: '' });

        try {
            if (editMode) {
            await api.put(`/tbl_buildings/${building_id}`, { building_name });
            } else {
            await api.post('/tbl_buildings', newBuilding);
            }
            toast.success(editMode ? 'Building updated' : 'Building added');
        } catch (err) {
            console.error(err);
            toast.error('Failed to save building');
            fetchData(); // rollback by re-fetching on error
        }
        };

    const handleRoomSubmit = async () => {
        const { room_id, room_name, room_type, room_capacity, building_id } = newRoom;
        if (!room_id || !room_name || !room_type || !room_capacity || !building_id) {
            toast.error('All fields are required');
            return;
        }

        // Optimistic update
        setExpandedBuildings(prev =>
            prev.map(b => {
            if (b.building_id !== building_id) return b;
            if (editMode) {
                return { ...b, rooms: b.rooms.map(r => r.room_id === room_id ? { ...newRoom } : r) };
            } else {
                return { ...b, rooms: [...b.rooms, { ...newRoom }] };
            }
            })
        );

        setShowRoomModal(false);
        setNewRoom({ room_id: '', room_name: '', room_type: '', room_capacity: 0, building_id: '' });

        try {
            if (editMode) {
            await api.put(`/tbl_rooms/${room_id}/`, { room_name, room_type, room_capacity, building: building_id });
            } else {
            await api.post('/tbl_rooms', { room_id, room_name, room_type, room_capacity, building: building_id });
            }
            toast.success(editMode ? 'Room updated' : 'Room added');
            setEditMode(false);
        } catch (err: any) {
            console.error(err.response?.data || err.message);
            toast.error('Failed to save room');
            fetchData(); // rollback on error
        }
        };

    const toggleBuildingSelect = (id: string) => {
        setSelectedBuildingIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleSelectAllBuildings = () => {
        setSelectedBuildingIds(() => {
            const isAllSelected = expandedBuildings.length > 0 && expandedBuildings.every((b) => selectedBuildingIds.has(b.building_id));
            if (isAllSelected) return new Set();
            const all = new Set<string>();
            expandedBuildings.forEach((b) => all.add(b.building_id));
            return all;
        });
    };

    const handleBulkDelete = () => {
        const buildingIds = Array.from(selectedBuildingIds);
        const roomIds = Array.from(selectedRoomIds);

        if (buildingIds.length === 0 && roomIds.length === 0) {
            toast.info('No items selected');
            return;
        }

        const totalCount = buildingIds.length + roomIds.length;
        setDeleteCount(totalCount);
        setDeleteType(buildingIds.length > 0 ? 'building' : 'room');
        setShowDeleteConfirm(true);
    };

    const confirmDelete = async () => {
        const buildingIds = Array.from(selectedBuildingIds);
        const roomIds = Array.from(selectedRoomIds);

        setShowDeleteConfirm(false);
        setIsBulkDeleting(true);

        try {
            const results = await Promise.allSettled([
                ...buildingIds.map((id) => api.delete(`/tbl_buildings/${id}`)),
                ...roomIds.map((id) => api.delete(`/tbl_rooms/${id}/`)),
            ]);

            const succeeded = results.filter((r) => r.status === 'fulfilled').length;
            const failed = results.length - succeeded;

            if (succeeded > 0) toast.success(`Deleted ${succeeded} item(s)`);
            if (failed > 0) toast.error(`${failed} item(s) failed to delete`);

            setSelectedBuildingIds(new Set());
            setSelectedRoomIds(new Set());
            fetchData();
        } catch (err) {
            console.error(err);
            toast.error('Bulk delete failed');
        } finally {
            setIsBulkDeleting(false);
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

                let buildingsAdded = 0;
                let roomsAdded = 0;

                for (const row of rows) {
                    // Try as building first
                    const building_id = row['Building ID']?.trim();
                    const building_name = row['Building Name']?.trim();
                    const is_building = building_id && building_name && !row['Room ID'];

                    if (is_building) {
                        try {
                            await api.post('/tbl_buildings', { building_id, building_name });
                            buildingsAdded++;
                        } catch {
                            continue;
                        }
                    } else {
                        // Try as room
                        const room_id = row['Room ID']?.trim();
                        const room_name = row['Room Name']?.trim();
                        const room_type = row['Room Type']?.trim();
                        const room_capacity = parseInt(row['Room Capacity'] || 0);
                        const room_building_id = row['Building ID']?.trim();

                        if (room_id && room_name && room_type && room_capacity && room_building_id) {
                            try {
                                await api.post('/tbl_rooms', {
                                    room_id,
                                    room_name,
                                    room_type,
                                    room_capacity,
                                    building: room_building_id,
                                });
                                roomsAdded++;
                            } catch {
                                continue;
                            }
                        }
                    }
                }

                let message = '';
                if (buildingsAdded > 0) message += `${buildingsAdded} building(s) added. `;
                if (roomsAdded > 0) message += `${roomsAdded} room(s) added.`;
                if (buildingsAdded > 0 || roomsAdded > 0) {
                    toast.success(message.trim());
                } else {
                    toast.info('No valid rows found in file');
                }

                fetchData();
            } catch {
                toast.error('Error reading or importing file');
            } finally {
                setIsImporting(false);
                setShowImportModal(false);
            }
        };

        reader.readAsArrayBuffer(file);
    };

    const downloadTemplate = () => {
        const ws = XLSX.utils.aoa_to_sheet([
            ['Building ID', 'Building Name', 'Room ID', 'Room Name', 'Room Type', 'Room Capacity'],
            ['BLDG. 09', 'ICT Building', '', '', '', ''],
            ['', '', '9-301', 'Cisco Lab', 'Laboratory', 15],
            ['', '', '9-302', 'Lecture Hall A', 'Lecture', 50],
        ]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Buildings & Rooms');
        XLSX.writeFile(wb, 'buildings_and_rooms_template.xlsx');
    };

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, sortBy]);

    const isNumeric = (str: string): boolean => {
        return !isNaN(Number(str)) && !isNaN(parseFloat(str));
    };

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
        let filtered = expandedBuildings
            .map((b) => ({
                ...b,
                rooms: b.rooms.filter(
                    (r) =>
                        r.room_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        r.room_id.toLowerCase().includes(searchTerm.toLowerCase())
                ),
            }))
            .filter((b) => {
                // Show building if:
                // 1. Building name matches search, OR
                // 2. Has rooms that match search
                const buildingMatches = b.building_name.toLowerCase().includes(searchTerm.toLowerCase());
                const hasMatchingRooms = b.rooms.length > 0;
                return buildingMatches || hasMatchingRooms;
            });

        if (sortBy !== 'none') {
            filtered = [...filtered].sort((a, b) => {
                if (sortBy === 'building_id') {
                    return smartSort(a.building_id, b.building_id);
                } else if (sortBy === 'building_name') {
                    return smartSort(a.building_name.toLowerCase(), b.building_name.toLowerCase());
                } else if (sortBy === 'room_count') {
                    return a.rooms.length - b.rooms.length;
                }
                return 0;
            });
        }

        return filtered;
    }, [expandedBuildings, searchTerm, sortBy]);

    const totalItems = filtered.length;

    const effectiveItemsPerPage = useMemo(() => {
        if (totalItems === 0) return 1;
        if (itemsPerPage === 'all') return 20;
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
            currentPage * effectiveItemsPerPage
        );
    }, [filtered, currentPage, effectiveItemsPerPage, totalItems]);

    useEffect(() => {
        if (currentPage > totalPages) {
            setCurrentPage(totalPages);
        }
    }, [currentPage, totalPages]);

    useEffect(() => {
        const checkScroll = () => {
            const container = tableContainerRef.current;
            if (!container) return;

            const { scrollLeft, scrollWidth, clientWidth } = container;
            setCanScrollLeft(scrollLeft > 0);
            setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1);
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
    }, [expandedBuildings, searchTerm, loading]);

    const scrollTable = (direction: 'left' | 'right') => {
        const container = tableContainerRef.current;
        if (!container) return;

        const scrollAmount = container.clientWidth * 0.8;
        const scrollTo =
            direction === 'left'
                ? container.scrollLeft - scrollAmount
                : container.scrollLeft + scrollAmount;

        container.scrollTo({ left: scrollTo, behavior: 'smooth' });
    };

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

    const isAllSelected =
        expandedBuildings.length > 0 && expandedBuildings.every((b) => selectedBuildingIds.has(b.building_id));

    return (
        <div className="cl-page">
            {/* ── Page Header ── */}
            <div className="cl-page-header">
                <div className="cl-page-header-left">
                    <div className="cl-page-icon">
                        <svg
                            width="22"
                            height="22"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={1.8}
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                            />
                        </svg>
                    </div>
                    <div className="cl-page-title">
                        <h1>Buildings & Rooms</h1>
                        <p>
                            {expandedBuildings.length} building{expandedBuildings.length !== 1 ? 's' : ''} ·{' '}
                            {filtered.length} showing
                        </p>
                    </div>
                </div>

                <div className="cl-page-actions">
                    {/* Search */}
                    <div className="cl-search-bar">
                        <FaSearch className="cl-search-icon" />
                        <input
                            type="text"
                            placeholder="Search buildings or rooms…"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <button
                        type="button"
                        className="cl-btn primary"
                        onClick={() => {
                            setEditMode(false);
                            setNewBuilding({ building_id: '', building_name: '' });
                            setShowBuildingModal(true);
                        }}
                    >
                        <FaPlus style={{ fontSize: '11px' }} /> Add Building
                    </button>

                    <button
                        type="button"
                        className="cl-btn"
                        onClick={() => {
                            if (expandedBuildings.length === 0) {
                                toast.info('Create a building first');
                                return;
                            }
                            setEditMode(false);
                            setNewRoom({
                                room_id: '',
                                room_name: '',
                                room_type: '',
                                room_capacity: 0,
                                building_id: expandedBuildings[0].building_id,
                            });
                            setShowRoomModal(true);
                        }}
                    >
                        <FaPlus style={{ fontSize: '11px' }} /> Add Room
                    </button>

                    <button type="button" className="cl-btn" onClick={() => setShowImportModal(true)}>
                        <FaFileImport style={{ fontSize: '11px' }} /> Import
                    </button>

                    <button
                        type="button"
                        className="cl-btn danger"
                        onClick={handleBulkDelete}
                        disabled={isBulkDeleting || (selectedBuildingIds.size === 0 && selectedRoomIds.size === 0)}
                        title={
                            selectedBuildingIds.size + selectedRoomIds.size > 0
                                ? `Delete ${selectedBuildingIds.size + selectedRoomIds.size} selected`
                                : 'Select items to delete'
                        }
                    >
                        <FaTrash style={{ fontSize: '11px' }} />
                        {selectedBuildingIds.size + selectedRoomIds.size > 0 && (
                            <span>({selectedBuildingIds.size + selectedRoomIds.size})</span>
                        )}
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
                                ].map((opt) => (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        className={`cl-dropdown-item${sortBy === opt.value ? ' active' : ''}`}
                                        onClick={() => {
                                            setSortBy(opt.value);
                                            setShowSortDropdown(false);
                                        }}
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
                                {[10, 20, 30].map((n) => (
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
                                        onChange={(e) => setCustomItemsPerPage(e.target.value)}
                                        placeholder="Custom…"
                                        min="1"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleCustomItemsPerPage();
                                        }}
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
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
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
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
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
                                    <th style={{ width: '80px' }}>Rooms</th>
                                    <th style={{ width: '240px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <span>Actions</span>
                                            <input
                                                type="checkbox"
                                                checked={isAllSelected}
                                                onChange={toggleSelectAllBuildings}
                                                disabled={loading || expandedBuildings.length === 0}
                                                title="Select all buildings"
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
                                            Loading…
                                        </td>
                                    </tr>
                                ) : filtered.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="cl-table-empty">
                                            No buildings found.
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedBuildings.map((building, index) => {
                                        const isSelected = selectedBuildingIds.has(building.building_id);
                                        const itemIndex = (currentPage - 1) * effectiveItemsPerPage + index + 1;

                                        return (
                                            <tr key={building.building_id} className={isSelected ? 'selected' : ''}>
                                                <td className="cl-td-num">{itemIndex}</td>
                                                <td>
                                                    <span className="cl-id-badge">{building.building_id}</span>
                                                </td>
                                                <td>{building.building_name}</td>
                                                <td>
                                                    <span className="cl-room-count-badge">{building.rooms.length}</span>
                                                </td>
                                                <td>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <button
                                                            type="button"
                                                            className="cl-icon-btn view"
                                                            onClick={() => openBuildingRoomsModal(building)}
                                                        >
                                                            <FaEye style={{ fontSize: '10px' }} /> Rooms
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="cl-icon-btn edit"
                                                            onClick={() => {
                                                                setEditMode(true);
                                                                setNewBuilding(building);
                                                                setShowBuildingModal(true);
                                                            }}
                                                        >
                                                            <FaEdit style={{ fontSize: '10px' }} /> Edit
                                                        </button>
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            onChange={() => toggleBuildingSelect(building.building_id)}
                                                            aria-label={`Select ${building.building_name}`}
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

            {/* ════ ADD / EDIT BUILDING MODAL ════ */}
            {showBuildingModal && (
                <div className="cl-modal-overlay" onClick={() => { setShowBuildingModal(false); setEditMode(false); }}>
                    <div className="cl-modal" onClick={(e) => e.stopPropagation()}>
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
                                    onChange={(e) => setNewBuilding({ ...newBuilding, building_id: e.target.value })}
                                    placeholder="e.g. BLDG. 09"
                                />
                            </div>
                            <div className="cl-field">
                                <label>Building Name</label>
                                <input
                                    type="text"
                                    className="cl-input"
                                    value={newBuilding.building_name}
                                    onChange={(e) => setNewBuilding({ ...newBuilding, building_name: e.target.value })}
                                    placeholder="e.g. ICT Building"
                                />
                            </div>
                        </div>
                        <div className="cl-modal-footer">
                            <button type="button" className="cl-btn" onClick={() => { setShowBuildingModal(false); setEditMode(false); }}>
                                Cancel
                            </button>
                            <button type="button" className="cl-btn primary" onClick={handleBuildingSubmit}>
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ════ ADD / EDIT ROOM MODAL ════ */}
            {showRoomModal && (
                <div className="cl-modal-overlay" style={{ zIndex: 10000 }} onClick={() => { setShowRoomModal(false); setEditMode(false); }}>
                    <div className="cl-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="cl-modal-header">
                            <h3>{editMode ? 'Edit Room' : 'Add New Room'}</h3>
                        </div>
                        <div className="cl-modal-body">
                            <div className="cl-field">
                                <label>Room ID</label>
                                <input
                                    type="text"
                                    className="cl-input"
                                    disabled={editMode}
                                    value={newRoom.room_id}
                                    onChange={(e) => setNewRoom({ ...newRoom, room_id: e.target.value })}
                                    placeholder="e.g. 9-301"
                                />
                            </div>
                            <div className="cl-field">
                                <label>Room Name</label>
                                <input
                                    type="text"
                                    className="cl-input"
                                    value={newRoom.room_name}
                                    onChange={(e) => setNewRoom({ ...newRoom, room_name: e.target.value })}
                                    placeholder="e.g. Cisco Lab"
                                />
                            </div>
                            <div className="cl-field">
                                <label>Room Type</label>
                                <select
                                    className="cl-input"
                                    value={newRoom.room_type}
                                    onChange={(e) => setNewRoom({ ...newRoom, room_type: e.target.value })}
                                >
                                    <option value="">Select Type</option>
                                    <option value="Lecture">Lecture</option>
                                    <option value="Laboratory">Laboratory</option>
                                </select>
                            </div>
                            <div className="cl-field">
                                <label>Room Capacity</label>
                                <input
                                    type="number"
                                    className="cl-input"
                                    value={newRoom.room_capacity}
                                    onChange={(e) => setNewRoom({ ...newRoom, room_capacity: parseInt(e.target.value) || 0 })}
                                    placeholder="e.g. 30"
                                    min="1"
                                />
                            </div>
                            <div className="cl-field">
                                <label>Building</label>
                                <Select
                                    className="react-select"
                                    classNamePrefix="select"
                                    options={expandedBuildings
                                        .sort((a, b) => a.building_name.localeCompare(b.building_name))
                                        .map((b) => ({
                                            value: b.building_id,
                                            label: `${b.building_name} (${b.building_id})`,
                                        }))}
                                    value={expandedBuildings
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
                                    styles={{
                                    option: (base) => ({
                                        ...base,
                                        color: '#020508',
                                        fontSize: '14px'
                                    })
                                    }}
                                />
                            </div>
                        </div>
                        <div className="cl-modal-footer">
                            <button type="button" className="cl-btn" onClick={() => { setShowRoomModal(false); setEditMode(false); }}>
                                Cancel
                            </button>
                            <button type="button" className="cl-btn primary" onClick={handleRoomSubmit}>
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ════ IMPORT MODAL ════ */}
            {showImportModal && (
                <div className="cl-modal-overlay" onClick={() => setShowImportModal(false)}>
                    <div className="cl-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="cl-modal-header">
                            <h3>Import Buildings & Rooms</h3>
                            <p>Upload an .xlsx file using the template below.</p>
                        </div>
                        <div className="cl-modal-body">
                            <p className="cl-import-hint">
                                Each building must have a unique Building ID. Each room must have a valid Building ID reference.
                            </p>
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
                            <button
                                type="button"
                                className="cl-btn primary"
                                onClick={() => setShowImportModal(false)}
                                disabled={isImporting}
                            >
                                {isImporting ? 'Importing…' : 'Done'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ════ BUILDING ROOMS MODAL ════ */}
            {showBuildingRoomsModal && selectedBuildingForRooms && (
                <div className="cl-modal-overlay" onClick={() => { setShowBuildingRoomsModal(false); setSelectedBuildingForRooms(null); }}>
                    <div className="cl-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '680px' }}>
                        <div className="cl-modal-header">
                            <h3>Rooms in {selectedBuildingForRooms.building_name}</h3>
                            <p>{selectedBuildingForRooms.rooms.length} room{selectedBuildingForRooms.rooms.length !== 1 ? 's' : ''}</p>
                        </div>
                        <div className="cl-modal-body" style={{ padding: '0' }}>
                            {selectedBuildingForRooms.rooms.length === 0 ? (
                                <div style={{ textAlign: 'center', color: 'var(--cl-text-muted)', padding: '40px 24px', fontSize: '13px' }}>
                                    No rooms found in this building.
                                </div>
                            ) : (
                                <div style={{ overflowX: 'auto' }}>
                                    <table className="cl-table" style={{ fontSize: '13px', margin: 0 }}>
                                        <thead>
                                            <tr>
                                                <th style={{ width: '40px' }}>No.</th>
                                                <th>Room ID</th>
                                                <th>Room Name</th>
                                                <th>Type</th>
                                                <th style={{ width: '90px' }}>Capacity</th>
                                                <th style={{ width: '140px' }}>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {selectedBuildingForRooms.rooms.map((room, idx) => (
                                                <tr key={room.room_id}>
                                                    <td className="cl-td-num">{idx + 1}</td>
                                                    <td><span className="cl-id-badge" style={{ fontSize: '11px' }}>{room.room_id}</span></td>
                                                    <td>{room.room_name}</td>
                                                    <td>
                                                        <span className={`cl-room-type-badge ${room.room_type === 'Lecture' ? 'lecture' : 'lab'}`}>
                                                            {room.room_type}
                                                        </span>
                                                    </td>
                                                    <td>{room.room_capacity}</td>
                                                    <td>
                                                        <button
                                                            type="button"
                                                            className="cl-icon-btn edit"
                                                            onClick={() => {
                                                                setEditMode(true);
                                                                setNewRoom(room);
                                                                setShowRoomModal(true);
                                                            }}
                                                        >
                                                            <FaEdit style={{ fontSize: '10px' }} /> Edit
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                        <div className="cl-modal-footer">
                            <button type="button" className="cl-btn primary" onClick={() => { setShowBuildingRoomsModal(false); setSelectedBuildingForRooms(null); }}>
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ════ DELETE CONFIRM MODAL ════ */}
            {showDeleteConfirm && (
                <div className="cl-modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
                    <div className="cl-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '380px' }}>
                        <div className="cl-modal-header">
                            <h3>Confirm Deletion</h3>
                        </div>
                        <div className="cl-modal-body">
                            <p style={{ fontSize: '13.5px', color: 'var(--cl-text-secondary)', lineHeight: 1.7, margin: 0 }}>
                                {deleteCount === 1
                                    ? `You are about to delete 1 ${deleteType}. This action cannot be undone.`
                                    : `You are about to delete ${deleteCount} items. This action cannot be undone.`}
                            </p>
                        </div>
                        <div className="cl-modal-footer">
                            <button
                                type="button"
                                className="cl-btn"
                                onClick={() => setShowDeleteConfirm(false)}
                                disabled={isBulkDeleting}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="cl-btn danger-fill"
                                onClick={confirmDelete}
                                disabled={isBulkDeleting}
                            >
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

export default BuildingsAndRooms;
