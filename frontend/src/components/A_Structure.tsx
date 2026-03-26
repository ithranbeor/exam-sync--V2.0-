// deno-lint-ignore-file no-explicit-any
import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
    FaSearch, FaTrash, FaEdit, FaDownload, FaEye,
    FaPlus, FaFileImport, FaSort, FaChevronDown,
} from 'react-icons/fa';
import { ToastContainer, toast } from 'react-toastify';
import * as XLSX from 'xlsx';
import { api } from '../lib/apiClient.ts';
import 'react-toastify/dist/ReactToastify.css';
import '../styles/A_Colleges.css';
import { useEscapeKey } from '../hooks/useEscapeKey.ts';
import Select from 'react-select';

// ── Interfaces ────────────────────────────────────────────────────────────────

interface College {
    college_id: string;
    college_name: string;
}

interface Department {
    department_id: string;
    department_name: string;
    college_id: string;
}

interface Program {
    program_id: string;
    program_name: string;
    department_id: string;
}

interface ExpandedDepartment extends Department {
    programs: Program[];
}

interface ExpandedCollege extends College {
    departments: ExpandedDepartment[];
}

// ── react-select portal styles ────────────────────────────────────────────────

const selectPortalStyles = {
    control: (b: any) => ({ ...b, fontSize: '13px', minHeight: '36px' }),
    menuPortal: (b: any) => ({ ...b, zIndex: 99999, fontSize: '13px', color: 'darkblue' }),
    menu: (b: any) => ({ ...b, fontSize: '13px' }),
};

// ── Component ─────────────────────────────────────────────────────────────────

const Structure: React.FC = () => {

    // ── Data ──────────────────────────────────────────────────────────────────
    const [colleges, setColleges]       = useState<ExpandedCollege[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [_programs, setPrograms]       = useState<Program[]>([]);

    // ── UI state ──────────────────────────────────────────────────────────────
    const [searchTerm, setSearchTerm]   = useState('');
    const [loading, setLoading]         = useState(true);
    const [isSaving, setIsSaving]       = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [isBulkDeleting, setIsBulkDeleting] = useState(false);
    const [sortBy, setSortBy]           = useState<string>('none');
    const [showSortDropdown, setShowSortDropdown] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage                  = 20;

    // ── Selection ─────────────────────────────────────────────────────────────
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // ── Drill-down modals ─────────────────────────────────────────────────────
    const [deptModal, setDeptModal] = useState<{ visible: boolean; college: ExpandedCollege | null }>({ visible: false, college: null });
    const [progModal, setProgModal] = useState<{ visible: boolean; department: ExpandedDepartment | null }>({ visible: false, department: null });

    // ── CRUD modals ───────────────────────────────────────────────────────────
    const [showCollegeModal, setShowCollegeModal]     = useState(false);
    const [showDepartmentModal, setShowDepartmentModal] = useState(false);
    const [showProgramModal, setShowProgramModal]     = useState(false);
    const [showImportModal, setShowImportModal]       = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm]   = useState(false);
    const [editMode, setEditMode]                     = useState(false);
    const [deleteCount, setDeleteCount]               = useState(0);

    // ── Forms ─────────────────────────────────────────────────────────────────
    const [newCollege, setNewCollege]       = useState<College>({ college_id: '', college_name: '' });
    const [newDepartment, setNewDepartment] = useState<Department>({ department_id: '', department_name: '', college_id: '' });
    const [newProgram, setNewProgram]       = useState<Program>({ program_id: '', program_name: '', department_id: '' });

    const sortRef = useRef<HTMLDivElement>(null);

    // ── ESC handlers ──────────────────────────────────────────────────────────

    useEscapeKey(() => { setShowCollegeModal(false);    setEditMode(false); }, showCollegeModal);
    useEscapeKey(() => { setShowDepartmentModal(false); setEditMode(false); }, showDepartmentModal);
    useEscapeKey(() => { setShowProgramModal(false);    setEditMode(false); }, showProgramModal);
    useEscapeKey(() => { setShowImportModal(false); },  showImportModal);
    useEscapeKey(() => { setShowDeleteConfirm(false); }, showDeleteConfirm);
    useEscapeKey(() => { setProgModal({ visible: false, department: null }); }, progModal.visible);
    useEscapeKey(() => { setDeptModal({ visible: false, college: null }); },   deptModal.visible);

    // ── Fetch ─────────────────────────────────────────────────────────────────

    const fetchAllData = async (silent = false) => {
        try {
            if (!silent) setLoading(true);
            const [collRes, deptRes, progRes] = await Promise.all([
                api.get('/tbl_college/'),
                api.get('/departments/'),
                api.get('/programs/'),
            ]);

            const collegeData: College[]     = collRes.data || [];
            const deptData: Department[]     = deptRes.data || [];
            const progData: Program[]        = progRes.data || [];

            setDepartments(deptData);
            setPrograms(progData);

            const expanded: ExpandedCollege[] = collegeData.map(c => ({
                ...c,
                departments: deptData
                    .filter(d => d.college_id === c.college_id)
                    .map(d => ({
                        ...d,
                        programs: progData.filter(p => p.department_id === d.department_id),
                    })),
            }));
            setColleges(expanded);
            return { expanded, deptData, progData };
        } catch {
            toast.error('Failed to fetch data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchAllData(); }, []);

    // close sort on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (showSortDropdown && sortRef.current && !sortRef.current.contains(e.target as Node))
                setShowSortDropdown(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [showSortDropdown]);

    // ── Helpers to refresh drill-down modals after mutations ──────────────────

    const refreshDeptModal = (expanded: ExpandedCollege[]) => {
        if (deptModal.visible && deptModal.college) {
            const fresh = expanded.find(c => c.college_id === deptModal.college!.college_id);
            if (fresh) setDeptModal({ visible: true, college: fresh });
            else setDeptModal({ visible: false, college: null });
        }
    };

    const refreshProgModal = (expanded: ExpandedCollege[]) => {
        if (progModal.visible && progModal.department) {
            const fresh = expanded
                .flatMap(c => c.departments)
                .find(d => d.department_id === progModal.department!.department_id);
            if (fresh) setProgModal({ visible: true, department: fresh });
            else setProgModal({ visible: false, department: null });
        }
    };

    const refetchAndRefresh = async () => {
        const result = await fetchAllData(true);
        if (!result) return;
        refreshDeptModal(result.expanded);
        refreshProgModal(result.expanded);
    };

    // ── CRUD: College ─────────────────────────────────────────────────────────

    const handleCollegeSubmit = async () => {
        if (!newCollege.college_id.trim() || !newCollege.college_name.trim()) {
            toast.error('All fields are required'); return;
        }
        setIsSaving(true);
        try {
            if (editMode) {
                await api.put(`/tbl_college/${newCollege.college_id}/`, { college_name: newCollege.college_name });
                toast.success('College updated');
            } else {
                await api.post('/tbl_college/', newCollege);
                toast.success('College added');
            }
            setShowCollegeModal(false);
            setEditMode(false);
            setNewCollege({ college_id: '', college_name: '' });
            await refetchAndRefresh();
        } catch (err: any) {
            toast.error(err?.response?.data?.detail || 'Failed to save college');
        } finally {
            setIsSaving(false);
        }
    };

    // ── CRUD: Department ──────────────────────────────────────────────────────

    const handleDepartmentSubmit = async () => {
        if (!newDepartment.department_id.trim() || !newDepartment.department_name.trim() || !newDepartment.college_id) {
            toast.error('All fields are required'); return;
        }
        setIsSaving(true);
        try {
            if (editMode) {
                await api.patch(`/departments/${newDepartment.department_id}/`, {
                    department_name: newDepartment.department_name,
                    college_id: newDepartment.college_id,
                });
                // Reflect changes immediately in local state
                setColleges(prev => prev.map(c => ({
                    ...c,
                    departments: c.departments.map(d =>
                        d.department_id === newDepartment.department_id
                            ? { ...d, department_name: newDepartment.department_name, college_id: newDepartment.college_id }
                            : d
                    ),
                })));
                toast.success('Department updated');
            } else {
                await api.post('/departments/', newDepartment);
                toast.success('Department added');
                await fetchAllData(true);
            }
            setShowDepartmentModal(false);
            setEditMode(false);
            setNewDepartment({ department_id: '', department_name: '', college_id: '' });
            // Refresh drill-down modal if open
            setColleges(prev => {
                const updated = prev;
                if (deptModal.visible && deptModal.college) {
                    const fresh = updated.find(c => c.college_id === deptModal.college!.college_id);
                    if (fresh) setDeptModal({ visible: true, college: fresh });
                }
                return updated;
            });
        } catch (err: any) {
            toast.error(err?.response?.data?.detail || 'Failed to save department');
        } finally {
            setIsSaving(false);
        }
    };

    // ── CRUD: Program ─────────────────────────────────────────────────────────

    const handleProgramSubmit = async () => {
        if (!newProgram.program_id.trim() || !newProgram.program_name.trim() || !newProgram.department_id) {
            toast.error('All fields are required'); return;
        }
        setIsSaving(true);
        try {
            if (editMode) {
                await api.patch(`/programs/${newProgram.program_id}/`, {
                    program_name: newProgram.program_name,
                    department_id: newProgram.department_id,
                });
                // Reflect changes immediately in local state
                setColleges(prev => prev.map(c => ({
                    ...c,
                    departments: c.departments.map(d => ({
                        ...d,
                        programs: d.programs.map(p =>
                            p.program_id === newProgram.program_id
                                ? { ...p, program_name: newProgram.program_name, department_id: newProgram.department_id }
                                : p
                        ),
                    })),
                })));
                toast.success('Program updated');
            } else {
                await api.post('/programs/', newProgram);
                toast.success('Program added');
                await fetchAllData(true);
            }
            setShowProgramModal(false);
            setEditMode(false);
            setNewProgram({ program_id: '', program_name: '', department_id: '' });
            // Refresh drill-down modal if open
            setColleges(prev => {
                const updated = prev;
                if (progModal.visible && progModal.department) {
                    const fresh = updated
                        .flatMap(c => c.departments)
                        .find(d => d.department_id === progModal.department!.department_id);
                    if (fresh) setProgModal({ visible: true, department: fresh });
                }
                return updated;
            });
        } catch (err: any) {
            toast.error(err?.response?.data?.detail || 'Failed to save program');
        } finally {
            setIsSaving(false);
        }
    };

    // ── Delete (inline inside modals) ─────────────────────────────────────────

    const deleteDepartment = async (dept: Department) => {
        if (!confirm(`Delete department "${dept.department_name}"? This cannot be undone.`)) return;
        try {
            await api.delete(`/departments/${dept.department_id}/`);
            toast.success('Department deleted');
            await refetchAndRefresh();
        } catch { toast.error('Failed to delete department'); }
    };

    const deleteProgram = async (prog: Program) => {
        if (!confirm(`Delete program "${prog.program_name}"? This cannot be undone.`)) return;
        try {
            await api.delete(`/programs/${prog.program_id}/`);
            toast.success('Program deleted');
            await refetchAndRefresh();
        } catch { toast.error('Failed to delete program'); }
    };

    // ── Bulk delete (main table — colleges only) ──────────────────────────────

    const handleBulkDelete = () => {
        if (selectedIds.size === 0) { toast.info('No items selected'); return; }
        setDeleteCount(selectedIds.size);
        setShowDeleteConfirm(true);
    };

    const confirmDelete = async () => {
        setShowDeleteConfirm(false);
        setIsBulkDeleting(true);
        try {
            const results = await Promise.allSettled(
                Array.from(selectedIds).map(id => api.delete(`/tbl_college/${id}/`))
            );
            const ok   = results.filter(r => r.status === 'fulfilled').length;
            const fail = results.length - ok;
            if (ok)   toast.success(`Deleted ${ok} college(s)`);
            if (fail) toast.error(`Failed to delete ${fail} college(s)`);
            setSelectedIds(new Set());
            await refetchAndRefresh();
        } catch { toast.error('Delete failed'); }
        finally { setIsBulkDeleting(false); }
    };

    // ── Import ────────────────────────────────────────────────────────────────

    const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (evt: any) => {
            setIsImporting(true);
            try {
                const wb   = XLSX.read(new Uint8Array(evt.target.result), { type: 'array' });
                const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
                let ca = 0, da = 0, pa = 0;
                for (const row of rows) {
                    if (row['College ID'] && row['College Name']) {
                        try { await api.post('/tbl_college/', { college_id: row['College ID'], college_name: row['College Name'] }); ca++; } catch {}
                    }
                    if (row['Department ID'] && row['Department Name'] && row['College ID']) {
                        try { await api.post('/departments/', { department_id: row['Department ID'], department_name: row['Department Name'], college_id: row['College ID'] }); da++; } catch {}
                    }
                    if (row['Program ID'] && row['Program Name'] && row['Department ID']) {
                        try { await api.post('/programs/', { program_id: row['Program ID'], program_name: row['Program Name'], department_id: row['Department ID'] }); pa++; } catch {}
                    }
                }
                const msg = [ca && `${ca} college(s)`, da && `${da} dept(s)`, pa && `${pa} program(s)`].filter(Boolean).join(', ');
                toast.success(msg ? `Imported: ${msg}` : 'No new items imported');
                await refetchAndRefresh();
            } catch { toast.error('Import failed'); }
            finally { setIsImporting(false); setShowImportModal(false); }
        };
        reader.readAsArrayBuffer(file);
    };

    const downloadTemplate = () => {
        const ws = XLSX.utils.aoa_to_sheet([
            ['College ID', 'College Name', 'Department ID', 'Department Name', 'Program ID', 'Program Name'],
            ['CITC', 'College of IT', 'DIT', 'Dept of IT', 'BSIT', 'BS Information Technology'],
            ['CITC', 'College of IT', 'DIT', 'Dept of IT', 'MSIT', 'MS Information Technology'],
        ]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Template');
        XLSX.writeFile(wb, 'structure_template.xlsx');
    };

    // ── Filtering / Sorting / Pagination ──────────────────────────────────────

    useEffect(() => { setCurrentPage(1); }, [searchTerm, sortBy]);

    const collegeOptions = useMemo(() =>
        colleges.map(c => ({ value: c.college_id, label: `${c.college_name} (${c.college_id})` })),
        [colleges]
    );

    const departmentOptions = useMemo(() =>
        departments.map(d => ({ value: d.department_id, label: `${d.department_name} (${d.department_id})` })),
        [departments]
    );

    const isNumeric = (s: string) => !isNaN(Number(s)) && !isNaN(parseFloat(s));
    const smartSort = (a: string, b: string) => {
        if (isNumeric(a) && isNumeric(b)) return parseFloat(a) - parseFloat(b);
        if (isNumeric(a)) return -1;
        if (isNumeric(b)) return 1;
        return a.localeCompare(b);
    };

    const filtered = useMemo(() => {
        const term = searchTerm.toLowerCase();
        let result = colleges.filter(c =>
            c.college_id.toLowerCase().includes(term) ||
            c.college_name.toLowerCase().includes(term)
        );
        if (sortBy === 'id')   result = [...result].sort((a, b) => smartSort(a.college_id, b.college_id));
        if (sortBy === 'name') result = [...result].sort((a, b) => smartSort(a.college_name.toLowerCase(), b.college_name.toLowerCase()));
        if (sortBy === 'depts') result = [...result].sort((a, b) => a.departments.length - b.departments.length);
        return result;
    }, [colleges, searchTerm, sortBy]);

    const totalPages      = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
    const paginated       = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
    const isAllSelected   = filtered.length > 0 && filtered.every(c => selectedIds.has(c.college_id));

    const toggleSelect = (id: string) => {
        setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
    };

    const toggleSelectAll = () => {
        if (isAllSelected) { setSelectedIds(new Set()); return; }
        const all = new Set<string>(); filtered.forEach(c => all.add(c.college_id)); setSelectedIds(all);
    };

    const totalDepts = colleges.reduce((s, c) => s + c.departments.length, 0);
    const totalProgs = colleges.reduce((s, c) => s + c.departments.reduce((ss, d) => ss + d.programs.length, 0), 0);

    // ── Render ────────────────────────────────────────────────────────────────

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
                        <h1>Organization Structure</h1>
                        <p>{colleges.length} colleges · {totalDepts} departments · {totalProgs} programs</p>
                    </div>
                </div>

                <div className="cl-page-actions">
                    <div className="cl-search-bar">
                        <FaSearch className="cl-search-icon" />
                        <input
                            type="text"
                            placeholder="Search colleges…"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <button
                        type="button"
                        className="cl-btn primary"
                        onClick={() => { setEditMode(false); setNewCollege({ college_id: '', college_name: '' }); setShowCollegeModal(true); }}
                    >
                        <FaPlus style={{ fontSize: '11px' }} /> Add College
                    </button>

                    <button
                        type="button"
                        className="cl-btn"
                        onClick={() => { setEditMode(false); setNewDepartment({ department_id: '', department_name: '', college_id: '' }); setShowDepartmentModal(true); }}
                    >
                        <FaPlus style={{ fontSize: '11px' }} /> Add Dept
                    </button>

                    <button
                        type="button"
                        className="cl-btn"
                        onClick={() => { setEditMode(false); setNewProgram({ program_id: '', program_name: '', department_id: '' }); setShowProgramModal(true); }}
                    >
                        <FaPlus style={{ fontSize: '11px' }} /> Add Program
                    </button>

                    <button type="button" className="cl-btn" onClick={() => setShowImportModal(true)}>
                        <FaFileImport style={{ fontSize: '11px' }} /> Import
                    </button>

                    <button
                        type="button"
                        className="cl-btn danger"
                        onClick={handleBulkDelete}
                        disabled={isBulkDeleting || selectedIds.size === 0}
                        title={selectedIds.size > 0 ? `Delete ${selectedIds.size} selected` : 'Select colleges to delete'}
                    >
                        <FaTrash style={{ fontSize: '11px' }} />
                        {selectedIds.size > 0 && <span>({selectedIds.size})</span>}
                    </button>
                </div>
            </div>

            {/* ── Toolbar ── */}
            <div className="cl-toolbar">
                <div className="cl-toolbar-left">
                    <div ref={sortRef} style={{ position: 'relative' }} data-sort-dropdown>
                        <button
                            type="button"
                            className="cl-toolbar-btn"
                            onClick={() => setShowSortDropdown(v => !v)}
                        >
                            <FaSort style={{ fontSize: '11px' }} />
                            Sort{sortBy !== 'none' ? `: ${sortBy === 'id' ? 'ID' : sortBy === 'name' ? 'Name' : 'Depts'}` : ''}
                            <FaChevronDown style={{ fontSize: '9px', marginLeft: '2px' }} />
                        </button>
                        {showSortDropdown && (
                            <div className="cl-dropdown">
                                {[
                                    { value: 'none',  label: 'None' },
                                    { value: 'id',    label: 'College ID' },
                                    { value: 'name',  label: 'College Name' },
                                    { value: 'depts', label: 'Dept Count' },
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
                </div>

                <div className="cl-pagination">
                    <button
                        type="button"
                        className="cl-page-btn"
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage <= 1}
                    >
                        ←
                    </button>
                    <span className="cl-page-info">{currentPage} / {totalPages}</span>
                    <button
                        type="button"
                        className="cl-page-btn"
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage >= totalPages}
                    >
                        →
                    </button>
                </div>
            </div>

            {/* ── Colleges Table ── */}
            <div className="cl-table-card">
                <div className="cl-table-scroll-wrapper">
                    <div className="cl-table-container">
                        <table className="cl-table">
                            <thead>
                                <tr>
                                    <th style={{ width: '52px' }}>#</th>
                                    <th>College ID</th>
                                    <th>College Name</th>
                                    <th style={{ width: '80px', textAlign: 'center' }}>Depts</th>
                                    <th style={{ width: '80px', textAlign: 'center' }}>Programs</th>
                                    <th style={{ width: '200px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <span>Actions</span>
                                            <input
                                                type="checkbox"
                                                checked={isAllSelected}
                                                onChange={toggleSelectAll}
                                                disabled={loading || colleges.length === 0}
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
                                        <td colSpan={6} className="cl-table-empty">
                                            <div className="cl-spinner" /> Loading…
                                        </td>
                                    </tr>
                                ) : filtered.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="cl-table-empty">No colleges found.</td>
                                    </tr>
                                ) : (
                                    paginated.map((college, idx) => {
                                        const isSelected = selectedIds.has(college.college_id);
                                        const progCount  = college.departments.reduce((s, d) => s + d.programs.length, 0);
                                        return (
                                            <tr key={college.college_id} className={isSelected ? 'selected' : ''}>
                                                <td className="cl-td-num">{(currentPage - 1) * itemsPerPage + idx + 1}</td>
                                                <td><span className="cl-id-badge">{college.college_id}</span></td>
                                                <td>{college.college_name}</td>
                                                <td style={{ textAlign: 'center' }}>
                                                    <span className="cl-room-count-badge">{college.departments.length}</span>
                                                </td>
                                                <td style={{ textAlign: 'center' }}>
                                                    <span className="cl-room-count-badge">{progCount}</span>
                                                </td>
                                                <td>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <button
                                                            type="button"
                                                            className="cl-icon-btn view"
                                                            onClick={() => setDeptModal({ visible: true, college })}
                                                        >
                                                            <FaEye style={{ fontSize: '10px' }} /> Depts
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="cl-icon-btn edit"
                                                            onClick={() => {
                                                                setEditMode(true);
                                                                setNewCollege({ college_id: college.college_id, college_name: college.college_name });
                                                                setShowCollegeModal(true);
                                                            }}
                                                        >
                                                            <FaEdit style={{ fontSize: '10px' }} /> Edit
                                                        </button>
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            onChange={() => toggleSelect(college.college_id)}
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

            {/* ════ DEPARTMENTS DRILL-DOWN MODAL ════ */}
            {deptModal.visible && deptModal.college && (
                <div className="cl-modal-overlay" onClick={() => setDeptModal({ visible: false, college: null })}>
                    <div className="cl-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '760px' }}>
                        <div className="cl-modal-header">
                            <h3>Departments — {deptModal.college.college_name}</h3>
                            <p>{deptModal.college.departments.length} department{deptModal.college.departments.length !== 1 ? 's' : ''}</p>
                        </div>
                        <div className="cl-modal-body" style={{ padding: '0' }}>
                            {deptModal.college.departments.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--cl-text-muted)', fontSize: '13px' }}>
                                    No departments yet. Add one below.
                                </div>
                            ) : (
                                <div style={{ overflowX: 'auto' }}>
                                    <table className="cl-table" style={{ fontSize: '13px', margin: 0 }}>
                                        <thead>
                                            <tr>
                                                <th style={{ width: '40px' }}>No.</th>
                                                <th>Department ID</th>
                                                <th>Department Name</th>
                                                <th style={{ width: '80px', textAlign: 'center' }}>Programs</th>
                                                <th style={{ width: '210px' }}>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {deptModal.college.departments.map((dept, idx) => (
                                                <tr key={dept.department_id}>
                                                    <td className="cl-td-num">{idx + 1}</td>
                                                    <td><span className="cl-id-badge" style={{ fontSize: '11px' }}>{dept.department_id}</span></td>
                                                    <td>{dept.department_name}</td>
                                                    <td style={{ textAlign: 'center' }}>
                                                        <span className="cl-room-count-badge">{dept.programs.length}</span>
                                                    </td>
                                                    <td>
                                                        <div style={{ display: 'flex', gap: '5px' }}>
                                                            <button
                                                                type="button"
                                                                className="cl-icon-btn view"
                                                                onClick={() => setProgModal({ visible: true, department: dept })}
                                                            >
                                                                <FaEye style={{ fontSize: '10px' }} /> Programs
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="cl-icon-btn edit"
                                                                onClick={() => {
                                                                    setEditMode(true);
                                                                    setNewDepartment({ ...dept });
                                                                    setShowDepartmentModal(true);
                                                                }}
                                                            >
                                                                <FaEdit style={{ fontSize: '10px' }} /> Edit
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="cl-icon-btn"
                                                                style={{ color: 'var(--cl-danger, #ef4444)', border: '1px solid var(--cl-danger, #ef4444)' }}
                                                                onClick={() => deleteDepartment(dept)}
                                                            >
                                                                <FaTrash style={{ fontSize: '10px' }} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                        <div className="cl-modal-footer">
                            <button
                                type="button"
                                className="cl-btn"
                                onClick={() => {
                                    setEditMode(false);
                                    setNewDepartment({ department_id: '', department_name: '', college_id: deptModal.college!.college_id });
                                    setShowDepartmentModal(true);
                                }}
                            >
                                <FaPlus style={{ fontSize: '10px' }} /> Add Department
                            </button>
                            <button type="button" className="cl-btn primary" onClick={() => setDeptModal({ visible: false, college: null })}>
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ════ PROGRAMS DRILL-DOWN MODAL ════ */}
            {progModal.visible && progModal.department && (
                <div className="cl-modal-overlay" style={{ zIndex: 10001 }} onClick={() => setProgModal({ visible: false, department: null })}>
                    <div className="cl-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '680px' }}>
                        <div className="cl-modal-header">
                            <h3>Programs — {progModal.department.department_name}</h3>
                            <p>{progModal.department.programs.length} program{progModal.department.programs.length !== 1 ? 's' : ''}</p>
                        </div>
                        <div className="cl-modal-body" style={{ padding: '0' }}>
                            {progModal.department.programs.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--cl-text-muted)', fontSize: '13px' }}>
                                    No programs yet. Add one below.
                                </div>
                            ) : (
                                <div style={{ overflowX: 'auto' }}>
                                    <table className="cl-table" style={{ fontSize: '13px', margin: 0 }}>
                                        <thead>
                                            <tr>
                                                <th style={{ width: '40px' }}>No.</th>
                                                <th>Program ID</th>
                                                <th>Program Name</th>
                                                <th style={{ width: '130px' }}>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {progModal.department.programs.map((prog, idx) => (
                                                <tr key={prog.program_id}>
                                                    <td className="cl-td-num">{idx + 1}</td>
                                                    <td><span className="cl-id-badge" style={{ fontSize: '11px' }}>{prog.program_id}</span></td>
                                                    <td>{prog.program_name}</td>
                                                    <td>
                                                        <div style={{ display: 'flex', gap: '5px' }}>
                                                            <button
                                                                type="button"
                                                                className="cl-icon-btn edit"
                                                                onClick={() => {
                                                                    setEditMode(true);
                                                                    setNewProgram({ ...prog });
                                                                    setShowProgramModal(true);
                                                                }}
                                                            >
                                                                <FaEdit style={{ fontSize: '10px' }} /> Edit
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="cl-icon-btn"
                                                                style={{ color: 'var(--cl-danger, #ef4444)', border: '1px solid var(--cl-danger, #ef4444)' }}
                                                                onClick={() => deleteProgram(prog)}
                                                            >
                                                                <FaTrash style={{ fontSize: '10px' }} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                        <div className="cl-modal-footer">
                            <button
                                type="button"
                                className="cl-btn"
                                onClick={() => {
                                    setEditMode(false);
                                    setNewProgram({ program_id: '', program_name: '', department_id: progModal.department!.department_id });
                                    setShowProgramModal(true);
                                }}
                            >
                                <FaPlus style={{ fontSize: '10px' }} /> Add Program
                            </button>
                            <button type="button" className="cl-btn primary" onClick={() => setProgModal({ visible: false, department: null })}>
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ════ ADD / EDIT COLLEGE MODAL ════ */}
            {showCollegeModal && (
                <div className="cl-modal-overlay" style={{ zIndex: 10002 }} onClick={() => { setShowCollegeModal(false); setEditMode(false); }}>
                    <div className="cl-modal" onClick={e => e.stopPropagation()}>
                        <div className="cl-modal-header">
                            <h3>{editMode ? 'Edit College' : 'Add College'}</h3>
                        </div>
                        <div className="cl-modal-body">
                            <div className="cl-field">
                                <label>College ID</label>
                                <input
                                    className="cl-input"
                                    disabled={editMode}
                                    value={newCollege.college_id}
                                    onChange={e => setNewCollege(f => ({ ...f, college_id: e.target.value }))}
                                    placeholder="e.g. CITC"
                                    autoFocus
                                />
                            </div>
                            <div className="cl-field">
                                <label>College Name</label>
                                <input
                                    className="cl-input"
                                    value={newCollege.college_name}
                                    onChange={e => setNewCollege(f => ({ ...f, college_name: e.target.value }))}
                                    placeholder="e.g. College of IT and Computing"
                                />
                            </div>
                        </div>
                        <div className="cl-modal-footer">
                            <button type="button" className="cl-btn" onClick={() => { setShowCollegeModal(false); setEditMode(false); }} disabled={isSaving}>Cancel</button>
                            <button type="button" className="cl-btn primary" onClick={handleCollegeSubmit} disabled={isSaving}>
                                {isSaving ? 'Saving…' : 'Save'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ════ ADD / EDIT DEPARTMENT MODAL ════ */}
            {showDepartmentModal && (
                <div className="cl-modal-overlay" style={{ zIndex: 10002 }} onClick={() => { setShowDepartmentModal(false); setEditMode(false); }}>
                    <div className="cl-modal" onClick={e => e.stopPropagation()}>
                        <div className="cl-modal-header">
                            <h3>{editMode ? 'Edit Department' : 'Add Department'}</h3>
                        </div>
                        <div className="cl-modal-body">
                            <div className="cl-field">
                                <label>Department ID</label>
                                <input
                                    className="cl-input"
                                    disabled={editMode}
                                    value={newDepartment.department_id}
                                    onChange={e => setNewDepartment(f => ({ ...f, department_id: e.target.value }))}
                                    placeholder="e.g. DIT"
                                    autoFocus
                                />
                            </div>
                            <div className="cl-field">
                                <label>Department Name</label>
                                <input
                                    className="cl-input"
                                    value={newDepartment.department_name}
                                    onChange={e => setNewDepartment(f => ({ ...f, department_name: e.target.value }))}
                                    placeholder="e.g. Department of IT"
                                />
                            </div>
                            <div className="cl-field">
                                <label>College</label>
                                <Select
                                    options={collegeOptions}
                                    value={collegeOptions.find(o => o.value === newDepartment.college_id) || null}
                                    onChange={s => setNewDepartment(f => ({ ...f, college_id: s?.value || '' }))}
                                    placeholder="Select College…"
                                    isClearable
                                    menuPortalTarget={document.body}
                                    menuPosition="fixed"
                                    styles={selectPortalStyles}
                                />
                            </div>
                        </div>
                        <div className="cl-modal-footer">
                            <button type="button" className="cl-btn" onClick={() => { setShowDepartmentModal(false); setEditMode(false); }} disabled={isSaving}>Cancel</button>
                            <button type="button" className="cl-btn primary" onClick={handleDepartmentSubmit} disabled={isSaving}>
                                {isSaving ? 'Saving…' : 'Save'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ════ ADD / EDIT PROGRAM MODAL ════ */}
            {showProgramModal && (
                <div className="cl-modal-overlay" style={{ zIndex: 10002 }} onClick={() => { setShowProgramModal(false); setEditMode(false); }}>
                    <div className="cl-modal" onClick={e => e.stopPropagation()}>
                        <div className="cl-modal-header">
                            <h3>{editMode ? 'Edit Program' : 'Add Program'}</h3>
                        </div>
                        <div className="cl-modal-body">
                            <div className="cl-field">
                                <label>Program ID</label>
                                <input
                                    className="cl-input"
                                    disabled={editMode}
                                    value={newProgram.program_id}
                                    onChange={e => setNewProgram(f => ({ ...f, program_id: e.target.value }))}
                                    placeholder="e.g. BSIT"
                                    autoFocus
                                />
                            </div>
                            <div className="cl-field">
                                <label>Program Name</label>
                                <input
                                    className="cl-input"
                                    value={newProgram.program_name}
                                    onChange={e => setNewProgram(f => ({ ...f, program_name: e.target.value }))}
                                    placeholder="e.g. BS Information Technology"
                                />
                            </div>
                            <div className="cl-field">
                                <label>Department</label>
                                <Select
                                    options={departmentOptions}
                                    value={departmentOptions.find(o => o.value === newProgram.department_id) || null}
                                    onChange={s => setNewProgram(f => ({ ...f, department_id: s?.value || '' }))}
                                    placeholder="Select Department…"
                                    isClearable
                                    menuPortalTarget={document.body}
                                    menuPosition="fixed"
                                    styles={selectPortalStyles}
                                />
                            </div>
                        </div>
                        <div className="cl-modal-footer">
                            <button type="button" className="cl-btn" onClick={() => { setShowProgramModal(false); setEditMode(false); }} disabled={isSaving}>Cancel</button>
                            <button type="button" className="cl-btn primary" onClick={handleProgramSubmit} disabled={isSaving}>
                                {isSaving ? 'Saving…' : 'Save'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ════ IMPORT MODAL ════ */}
            {showImportModal && (
                <div className="cl-modal-overlay" onClick={() => !isImporting && setShowImportModal(false)}>
                    <div className="cl-modal" onClick={e => e.stopPropagation()}>
                        <div className="cl-modal-header">
                            <h3>Import Structure</h3>
                            <p>Upload an .xlsx file using the template format.</p>
                        </div>
                        <div className="cl-modal-body">
                            <p className="cl-import-hint">
                                Columns: <strong>College ID, College Name, Department ID, Department Name, Program ID, Program Name</strong>.
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
                            <button type="button" className="cl-btn primary" onClick={() => setShowImportModal(false)} disabled={isImporting}>
                                {isImporting ? 'Importing…' : 'Done'}
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
                                You are about to delete <strong>{deleteCount}</strong> college{deleteCount !== 1 ? 's' : ''}.
                                This action cannot be undone.
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

export default Structure;