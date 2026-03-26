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

// ─── Icon helpers (inline SVG, no extra dep) ──────────────────────────────────
const IconBuilding = () => (
  <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M3 7l9-4 9 4M4 7v14M20 7v14M9 21V11h6v10" />
  </svg>
);

const RoomManagement: React.FC<UserProps> = ({ user }) => {
  const [roomOptions, setRoomOptions]       = useState<Room[]>([]);
  const [buildingOptions, setBuildingOptions] = useState<Building[]>([]);
  const [selectedRooms, setSelectedRooms]   = useState<string[]>([]);

  // shared filters (sidebar)
  const [typeFilter, setTypeFilter]         = useState<string>('All');
  const [buildingFilter, setBuildingFilter] = useState<string | null>(null);
  const [searchFilter, setSearchFilter]     = useState<string>('');

  // tab: 'select' | 'capacity'
  const [activeTab, setActiveTab]           = useState<'select' | 'capacity'>('select');

  const [editingCapacity, setEditingCapacity] = useState<{ [id: string]: number }>({});
  const [roomStatus, setRoomStatus]         = useState<{ [key: string]: { occupiedTimes: { start: string; end: string }[] } }>({});

  const [isSaving, setIsSaving]             = useState(false);
  const [isResetting, setIsResetting]       = useState(false);
  const [isLoading, setIsLoading]           = useState(true);

  const [showResetModal, setShowResetModal] = useState(false);
  const [occupancyModal, setOccupancyModal] = useState<{ visible: boolean; roomId: string | null }>({ visible: false, roomId: null });

  // ── Fetch ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);

        const [roomsRes, buildingsRes, examsRes] = await Promise.all([
          api.get('/tbl_rooms'),
          api.get('/tbl_buildings'),
          api.get('/tbl_examdetails'),
        ]);

        setRoomOptions(roomsRes.data.map((r: any) => ({
          room_id: r.room_id, room_name: r.room_name,
          room_type: r.room_type, building_id: r.building_id,
          room_capacity: r.room_capacity,
        })));

        setBuildingOptions(buildingsRes.data.map((b: any) => ({
          building_id: b.building_id, building_name: b.building_name,
        })));

        const statusMap: any = {};
        (examsRes.data as ExamDetail[]).forEach(e => {
          if (!statusMap[e.room_id]) statusMap[e.room_id] = { occupiedTimes: [] };
          statusMap[e.room_id].occupiedTimes.push({ start: e.exam_start_time, end: e.exam_end_time });
        });
        setRoomStatus(statusMap);

        if (user?.user_id) await fetchSelectedRooms();
      } catch {
        toast.error('Failed to load room data');
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [user]);

  const fetchSelectedRooms = async () => {
    try {
      const rolesRes = await api.get(`/tbl_user_role?user_id=${user?.user_id}&role_id=3`);
      const collegeId = rolesRes.data[0]?.college_id;
      if (collegeId) {
        const availRes = await api.get(`/tbl_available_rooms/?college_id=${collegeId}`);
        const ids = availRes.data.map((ar: any) => ar.room?.room_id || ar.room_id).filter(Boolean);
        setSelectedRooms(ids);
      }
    } catch (e) { console.error(e); }
  };

  // ── Derived ───────────────────────────────────────────────────────────────

  const filteredRooms = roomOptions
    .filter(r => !buildingFilter || r.building_id === buildingFilter)
    .filter(r => typeFilter === 'All' || r.room_type === typeFilter)
    .filter(r => !searchFilter || r.room_name.toLowerCase().includes(searchFilter.toLowerCase()) || r.room_id.toLowerCase().includes(searchFilter.toLowerCase()));

  const lectureCount = filteredRooms.filter(r => r.room_type === 'Lecture').length;
  const labCount     = filteredRooms.filter(r => r.room_type === 'Laboratory').length;
  const selectedInView = filteredRooms.filter(r => selectedRooms.includes(r.room_id)).length;

  const pendingCapacityCount = Object.entries(editingCapacity).filter(([id, val]) => {
    const orig = roomOptions.find(r => r.room_id === id);
    return orig && orig.room_capacity !== val;
  }).length;

  // ── Toggle room ───────────────────────────────────────────────────────────

  const toggleRoom = (roomId: string) => {
    setSelectedRooms(prev =>
      prev.includes(roomId) ? prev.filter(id => id !== roomId) : [...prev, roomId]
    );
  };

  const selectAllVisible = () => {
    const visibleIds = filteredRooms.map(r => r.room_id);
    const allSelected = visibleIds.every(id => selectedRooms.includes(id));
    if (allSelected) {
      setSelectedRooms(prev => prev.filter(id => !visibleIds.includes(id)));
    } else {
      setSelectedRooms(prev => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  const allVisibleSelected = filteredRooms.length > 0 && filteredRooms.every(r => selectedRooms.includes(r.room_id));

  // ── Save rooms ────────────────────────────────────────────────────────────

  const handleSaveRooms = async () => {
    if (!selectedRooms.length) { toast.warn('Please select at least one room'); return; }
    setIsSaving(true);
    try {
      const rolesRes = await api.get(`/tbl_user_role?user_id=${user?.user_id}&role_id=3`);
      const collegeId = rolesRes.data[0]?.college_id;
      if (!collegeId) { toast.error('College not found.'); return; }

      const existingRes = await api.get(`/tbl_available_rooms/?college_id=${collegeId}`);
      await Promise.all(existingRes.data.map(async (rd: any) => {
        const id = rd.room?.room_id || rd.room_id;
        if (id) { try { await api.delete(`/tbl_available_rooms/${id}/${collegeId}/`); } catch {} }
      }));

      let ok = 0, fail = 0;
      for (const roomId of selectedRooms) {
        try { await api.post('/tbl_available_rooms/', { room_id: roomId, college_id: collegeId }); ok++; }
        catch { fail++; }
      }
      if (ok)   toast.success(`Saved ${ok} room(s)!`);
      if (fail) toast.warn(`Failed to save ${fail} room(s).`);
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Error saving rooms');
    } finally {
      setIsSaving(false);
    }
  };

  // ── Reset rooms ───────────────────────────────────────────────────────────

  const handleResetRooms = async () => {
    setIsResetting(true);
    try {
      const rolesRes = await api.get(`/tbl_user_role?user_id=${user?.user_id}&role_id=3`);
      const collegeId = rolesRes.data[0]?.college_id;
      if (!collegeId) { toast.error('College not found.'); return; }

      const availRes = await api.get(`/tbl_available_rooms/?college_id=${collegeId}`);
      let deleted = 0, errors = 0;
      for (const rd of availRes.data) {
        const id = rd.room?.room_id || rd.room_id;
        if (id) {
          try { await api.delete(`/tbl_available_rooms/${id}/${collegeId}/`); deleted++; }
          catch { errors++; }
        }
      }
      setSelectedRooms([]);
      if (deleted) toast.success(`Reset ${deleted} room(s).`);
      else if (errors) toast.error('Failed to reset some rooms.');
      else toast.info('No rooms to reset.');
      setShowResetModal(false);
    } catch {
      toast.error('Error resetting rooms.');
    } finally {
      setIsResetting(false);
    }
  };

  // ── Save capacities ───────────────────────────────────────────────────────

  const handleSaveCapacities = async () => {
    const toSave = Object.entries(editingCapacity).filter(([id, val]) => {
      const orig = roomOptions.find(r => r.room_id === id);
      return orig && orig.room_capacity !== val;
    });
    if (!toSave.length) { toast.info('No changes to save'); return; }

    setIsSaving(true);

    // Optimistic update first
    setRoomOptions(prev =>
      prev.map(r => {
        const updated = toSave.find(([id]) => id === r.room_id);
        return updated ? { ...r, room_capacity: updated[1] } : r;
      })
    );
    setEditingCapacity({});

    let ok = 0, fail = 0;
    for (const [id, cap] of toSave) {
      if (isNaN(cap) || cap <= 0) { fail++; continue; }
      try {
        await api.put(`/tbl_rooms/${id}/`, { room_capacity: cap });
        ok++;
      } catch {
        fail++;
        // Rollback just the failed room
        setRoomOptions(prev =>
          prev.map(r => r.room_id === id ? { ...r, room_capacity: roomOptions.find(o => o.room_id === id)?.room_capacity ?? r.room_capacity } : r)
        );
      }
    }

    if (ok)   toast.success(`Updated ${ok} room(s)`);
    if (fail) toast.error(`Failed to update ${fail} room(s)`);
    setIsSaving(false);
  };

  // ── Timeslots ─────────────────────────────────────────────────────────────

  const getRoomTimeslots = (roomId: string): Timeslot[] => {
    const dayStart = new Date(); dayStart.setHours(7, 30, 0, 0);
    const dayEnd   = new Date(); dayEnd.setHours(21, 0, 0, 0);
    const occupied = (roomStatus[roomId]?.occupiedTimes || [])
      .map((t: any) => ({ start: new Date(t.start), end: new Date(t.end) }))
      .sort((a: any, b: any) => a.start - b.start);

    const slots: Timeslot[] = [];
    let cursor = new Date(dayStart);
    for (const s of occupied) {
      if (cursor < s.start) slots.push({ start: new Date(cursor), end: new Date(s.start), occupied: false });
      slots.push({ start: new Date(s.start), end: new Date(s.end), occupied: true });
      cursor = new Date(s.end);
    }
    if (cursor < dayEnd) slots.push({ start: new Date(cursor), end: new Date(dayEnd), occupied: false });
    return slots;
  };

  const fmt = (d: Date) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // ── Loading ───────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="rm-loading">
        <div className="rm-spinner" />
        <p>Loading room data…</p>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="rm-page">

      {/* ── Page Header ── */}
      <div className="rm-page-header">
        <div className="rm-page-header-left">
          <div className="rm-page-icon"><IconBuilding /></div>
          <div className="rm-page-title">
            <h1>Room Management</h1>
            <p>{roomOptions.length} rooms · {buildingOptions.length} buildings</p>
          </div>
        </div>

        <div className="rm-page-actions">
          {activeTab === 'select' && (
            <>
              <button
                type="button"
                className="rm-btn danger"
                onClick={() => setShowResetModal(true)}
              >
                Reset
              </button>
              <button
                type="button"
                className="rm-btn primary"
                onClick={handleSaveRooms}
                disabled={isSaving || selectedRooms.length === 0}
              >
                {isSaving ? 'Saving…' : `Save Selection (${selectedRooms.length})`}
              </button>
            </>
          )}
          {activeTab === 'capacity' && (
            <button
              type="button"
              className="rm-btn primary"
              onClick={handleSaveCapacities}
              disabled={isSaving || pendingCapacityCount === 0}
            >
              {isSaving ? 'Saving…' : `Save Capacities${pendingCapacityCount > 0 ? ` (${pendingCapacityCount})` : ''}`}
            </button>
          )}
        </div>
      </div>

      {/* ── Tab Nav ── */}
      <div className="rm-tabs">
        <button
          className={`rm-tab ${activeTab === 'select' ? 'active' : ''}`}
          onClick={() => setActiveTab('select')}
        >
          Room Selection
          <span className="rm-tab-count">{selectedRooms.length}</span>
        </button>
        <button
          className={`rm-tab ${activeTab === 'capacity' ? 'active' : ''}`}
          onClick={() => setActiveTab('capacity')}
        >
          Change Room Capacity
          {pendingCapacityCount > 0 && (
            <span className="rm-tab-count">{pendingCapacityCount} unsaved</span>
          )}
        </button>
      </div>

      {/* ── Main Layout ── */}
      <div className="rm-layout">

        {/* ── Sidebar ── */}
        <aside className="rm-sidebar">

          {/* Stats */}
          <div className="rm-sidebar-card">
            <div className="rm-sidebar-card-header"><h4>Overview</h4></div>
            <div className="rm-sidebar-card-body">
              <div className="rm-stats-grid">
                <div className="rm-stat-box">
                  <div className="rm-stat-num">{selectedRooms.length}</div>
                  <div className="rm-stat-label">Selected</div>
                </div>
                <div className="rm-stat-box">
                  <div className="rm-stat-num">{filteredRooms.length}</div>
                  <div className="rm-stat-label">Showing</div>
                </div>
                <div className="rm-stat-box">
                  <div className="rm-stat-num">{lectureCount}</div>
                  <div className="rm-stat-label">Lecture</div>
                </div>
                <div className="rm-stat-box">
                  <div className="rm-stat-num">{labCount}</div>
                  <div className="rm-stat-label">Lab</div>
                </div>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="rm-sidebar-card">
            <div className="rm-sidebar-card-header"><h4>Filters</h4></div>
            <div className="rm-sidebar-card-body">

              <div className="rm-field">
                <label>Room Type</label>
                <div className="rm-type-pills">
                  {['All', 'Lecture', 'Laboratory'].map(t => (
                    <button
                      key={t}
                      type="button"
                      className={`rm-type-pill-btn ${typeFilter === t ? 'active' : ''}`}
                      onClick={() => setTypeFilter(t)}
                    >
                      {t === 'Laboratory' ? 'Lab' : t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rm-field">
                <label>Building</label>
                <Select
                  options={buildingOptions.map(b => ({ value: b.building_id, label: b.building_name }))}
                  value={buildingFilter
                    ? { value: buildingFilter, label: buildingOptions.find(b => b.building_id === buildingFilter)?.building_name || buildingFilter }
                    : null}
                  onChange={s => setBuildingFilter(s?.value || null)}
                  isClearable
                  placeholder="All buildings"
                  menuPortalTarget={document.body}
                  menuPosition="fixed"
                  styles={{
                    control: (b) => ({ ...b, fontSize: '13px', minHeight: '36px'}),
                    menuPortal: (b) => ({ ...b, zIndex: 9999, fontSize: '13px', color: 'darkblue' }),
                  }}
                />
              </div>

              <div className="rm-field">
                <label>Search</label>
                <Select
                  options={roomOptions.map(r => ({ value: r.room_id, label: `${r.room_id} — ${r.room_name}` }))}
                  onChange={s => setSearchFilter(s?.value || '')}
                  isClearable
                  isSearchable
                  placeholder="Room ID or name…"
                  menuPortalTarget={document.body}
                  menuPosition="fixed"
                  styles={{
                    control: (b) => ({ ...b, fontSize: '13px', minHeight: '36px' }),
                    menuPortal: (b) => ({ ...b, zIndex: 9999, fontSize: '13px', color: 'darkblue' }),
                  }}
                />
              </div>

            </div>
          </div>

        </aside>

        {/* ── Content ── */}
        <div className="rm-content">

          {/* ════ TAB: ROOM SELECTION ════ */}
          {activeTab === 'select' && (
            <>
              {/* Selection summary */}
              <div className="rm-summary-bar">
                <div className="rm-summary-bar-left">
                  <span className="rm-summary-label">
                    {selectedRooms.length === 0 ? 'No rooms selected' : 'Selected:'}
                  </span>
                  {selectedRooms.length === 0 ? (
                    <span className="rm-summary-empty">Click rooms below to add them</span>
                  ) : (
                    <div className="rm-summary-chips">
                      {selectedRooms.map(id => (
                        <span key={id} className="rm-chip">
                          {id}
                          <button
                            type="button"
                            className="rm-chip-remove"
                            onClick={() => setSelectedRooms(prev => prev.filter(r => r !== id))}
                          >✕</button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                {selectedRooms.length > 0 && (
                  <button
                    type="button"
                    className="rm-btn danger"
                    style={{ fontSize: '12px', padding: '5px 12px' }}
                    onClick={() => setSelectedRooms([])}
                  >
                    Clear all
                  </button>
                )}
              </div>

              {/* Room grid */}
              <div className="rm-grid-card">
                <div className="rm-grid-card-header">
                  <div className="rm-grid-card-header-left">
                    <h3>Available Rooms</h3>
                    <span className="rm-result-count">{filteredRooms.length} rooms</span>
                    {selectedInView > 0 && (
                      <span className="rm-result-count" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
                        {selectedInView} selected in view
                      </span>
                    )}
                  </div>
                  <button type="button" className="rm-select-all-btn" onClick={selectAllVisible}>
                    {allVisibleSelected ? 'Deselect all' : 'Select all'}
                  </button>
                </div>

                <div className="rm-grid-card-body">
                  {filteredRooms.length === 0 ? (
                    <div className="rm-grid-empty">No rooms match your filters.</div>
                  ) : (
                    <div className="rm-room-grid">
                      {filteredRooms.map(r => {
                        const sel = selectedRooms.includes(r.room_id);
                        return (
                          <div
                            key={r.room_id}
                            className={`rm-room-box ${sel ? 'selected' : ''}`}
                          >
                            <div
                              style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
                              onClick={() => toggleRoom(r.room_id)}
                            >
                              <div className="rm-room-check">{sel ? '✓' : ''}</div>
                              <div className="rm-room-id">{r.room_id}</div>
                              <span className="rm-room-type-label">{r.room_type === 'Laboratory' ? 'Lab' : r.room_type}</span>
                            </div>
                            <button
                              type="button"
                              className="rm-vacancy-btn"
                              onClick={e => { e.stopPropagation(); setOccupancyModal({ visible: true, roomId: r.room_id }); }}
                            >
                              Vacancy
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* ════ TAB: CAPACITY ════ */}
          {activeTab === 'capacity' && (
            <div className="rm-table-card">
              <div className="rm-table-card-header">
                <div className="rm-table-card-header-left">
                  <h3>Room Capacities</h3>
                  <span className="rm-result-count">{filteredRooms.length} rooms</span>
                  {pendingCapacityCount > 0 && (
                    <span className="rm-pending-badge">{pendingCapacityCount} unsaved</span>
                  )}
                </div>
              </div>

              <div className="rm-table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Room ID</th>
                      <th>Room Name</th>
                      <th>Type</th>
                      <th>Capacity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRooms.map(r => (
                      <tr key={r.room_id}>
                        <td>{r.room_id}</td>
                        <td>{r.room_name}</td>
                        <td>
                          <span className={`rm-type-badge ${r.room_type === 'Lecture' ? 'lecture' : 'lab'}`}>
                            {r.room_type}
                          </span>
                        </td>
                        <td>
                          <input
                            type="number"
                            min={1}
                            value={editingCapacity[r.room_id] ?? r.room_capacity}
                            onChange={e => setEditingCapacity(prev => ({ ...prev, [r.room_id]: Number(e.target.value) }))}
                            className={`rm-capacity-input${editingCapacity[r.room_id] !== undefined && editingCapacity[r.room_id] !== r.room_capacity ? ' edited' : ''}`}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {filteredRooms.length === 0 && (
                  <div className="rm-table-empty">No rooms match your filters.</div>
                )}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* ════ VACANCY MODAL ════ */}
      {occupancyModal.visible && occupancyModal.roomId && (
        <div className="rm-modal-overlay" onClick={() => setOccupancyModal({ visible: false, roomId: null })}>
          <div className="rm-modal" onClick={e => e.stopPropagation()}>
            <div className="rm-modal-header">
              <h3>Room Occupancy</h3>
              <p>{occupancyModal.roomId}</p>
            </div>
            <div className="rm-modal-body">
              <div className="rm-timeslots">
                {getRoomTimeslots(occupancyModal.roomId).map((slot, i) => (
                  <div key={i} className={`rm-timeslot ${slot.occupied ? 'occupied' : 'vacant'}`}>
                    <span>{fmt(slot.start)} – {fmt(slot.end)}</span>
                    <span className="status">{slot.occupied ? 'Occupied' : 'Available'}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rm-modal-footer">
              <button type="button" className="rm-btn" onClick={() => setOccupancyModal({ visible: false, roomId: null })}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════ RESET MODAL ════ */}
      {showResetModal && (
        <div className="rm-modal-overlay" onClick={() => setShowResetModal(false)}>
          <div className="rm-modal" onClick={e => e.stopPropagation()}>
            <div className="rm-modal-header">
              <h3>Reset Available Rooms</h3>
            </div>
            <div className="rm-modal-body">
              <p>
                This will <strong>remove all rooms</strong> you have marked as available.
                Other users' configurations will not be affected. Are you sure?
              </p>
            </div>
            <div className="rm-modal-footer">
              <button type="button" className="rm-btn" onClick={() => setShowResetModal(false)}>Cancel</button>
              <button
                type="button"
                className="rm-btn danger-fill"
                onClick={handleResetRooms}
                disabled={isResetting}
              >
                {isResetting ? 'Resetting…' : 'Yes, Reset'}
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