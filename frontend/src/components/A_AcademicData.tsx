// deno-lint-ignore-file no-explicit-any
import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import {
    FaSearch, FaTrash, FaEdit, FaDownload, FaEye,
    FaPlus, FaFileImport, FaSort, FaChevronDown,
    FaBook, FaLayerGroup, FaCalendarAlt,
} from 'react-icons/fa';
import { ToastContainer, toast } from 'react-toastify';
import * as XLSX from 'xlsx';
import { api } from '../lib/apiClient.ts';
import 'react-toastify/dist/ReactToastify.css';
import '../styles/A_Colleges.css';
import { useEscapeKey } from '../hooks/useEscapeKey.ts';
import Select from 'react-select';

// ── Types ─────────────────────────────────────────────────────────────────────

type ActiveTab = 'courses' | 'sections' | 'terms';

interface Term {
    term_id: number;
    term_name: string;
    academic_year?: string;
}

interface User {
    user_id: number;
    first_name?: string;
    middle_name?: string;
    last_name?: string;
    full_name?: string;
}

interface Course {
    course_id: string;
    course_name: string;
    term_id?: number;
    term_name?: string;
    instructor_names?: string[];
    user_ids?: number[];
    leaders?: number[];
}

interface College {
    college_id: string;
    college_name: string;
}

interface Program {
    program_id: string;
    program_name: string;
}

interface SectionCourse {
    id?: number;
    course_id: string;
    program_id: string;
    term_id: number;
    user_id?: number;
    section_name: string;
    number_of_students: number;
    year_level: string;
    is_night_class?: string | null;
    course?: { course_id: string; course_name: string };
    program?: { program_id: string; program_name: string };
    term?: { term_id: number; term_name: string };
    user?: { user_id: number; full_name: string };
}

// Grouped sections by instructor
interface InstructorGroup {
    user_id: number;
    full_name: string;
    sections: SectionCourse[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const selectPortalStyles = {
    control: (b: any) => ({ ...b, fontSize: '13px', minHeight: '36px' }),
    menuPortal: (b: any) => ({ ...b, zIndex: 99999, fontSize: '13px' }),
    menu: (b: any) => ({ ...b, fontSize: '13px' }),
    option: (b: any, s: any) => ({ ...b, color: '#0C1B2A', backgroundColor: s.isFocused ? '#f1f5f9' : '#fff' }),
    singleValue: (b: any) => ({ ...b, color: '#0C1B2A' }),
    multiValueLabel: (b: any) => ({ ...b, color: '#0C1B2A' }),
};

const isNumeric = (s: string) => !isNaN(Number(s)) && !isNaN(parseFloat(s));
const smartSort = (a: string, b: string) => {
    if (isNumeric(a) && isNumeric(b)) return parseFloat(a) - parseFloat(b);
    if (isNumeric(a)) return -1;
    if (isNumeric(b)) return 1;
    return a.localeCompare(b);
};

const formatName = (u: User) => {
    if (u.full_name) return u.full_name;
    const mid = u.middle_name ? ` ${u.middle_name}` : '';
    return `${u.first_name || ''}${mid} ${u.last_name || ''}`.trim();
};

// ── Component ─────────────────────────────────────────────────────────────────

const AcademicData: React.FC = () => {

    // ── Tab ───────────────────────────────────────────────────────────────────
    const [activeTab, setActiveTab] = useState<ActiveTab>('courses');

    // ── Shared data ───────────────────────────────────────────────────────────
    const [terms, setTerms] = useState<Term[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [colleges, setColleges] = useState<College[]>([]);
    const [programs, setPrograms] = useState<Program[]>([]);
    const [userRoles, setUserRoles] = useState<any[]>([]);

    // ── Courses ───────────────────────────────────────────────────────────────
    const [courses, setCourses] = useState<Course[]>([]);

    // ── SectionCourses ────────────────────────────────────────────────────────
    const [sections, setSections] = useState<SectionCourse[]>([]);
    const [courseInstructorsMap, setCourseInstructorsMap] = useState<Record<string, User[]>>({});

    // ── UI state ──────────────────────────────────────────────────────────────
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [isBulkDeleting, setIsBulkDeleting] = useState(false);
    const [sortBy, setSortBy] = useState('none');
    const [showSortDropdown, setShowSortDropdown] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedCollege, setSelectedCollege] = useState('all');
    const itemsPerPage = 20;

    // ── Selection ─────────────────────────────────────────────────────────────
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // ── Drill-down modal (Sections grouped by instructor) ─────────────────────
    const [instructorModal, setInstructorModal] = useState<{
        visible: boolean;
        group: InstructorGroup | null;
    }>({ visible: false, group: null });

    // ── CRUD modals ───────────────────────────────────────────────────────────
    const [showCourseModal, setShowCourseModal] = useState(false);
    const [showSectionModal, setShowSectionModal] = useState(false);
    const [showTermModal, setShowTermModal] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [deleteCount, setDeleteCount] = useState(0);

    // ── Forms ─────────────────────────────────────────────────────────────────
    const [newCourse, setNewCourse] = useState<Course & { leaders: number[] }>({
        course_id: '', course_name: '', term_id: 0, user_ids: [], leaders: [],
    });
    const [originalCourseId, setOriginalCourseId] = useState('');

    const [newSection, setNewSection] = useState<SectionCourse>({
        course_id: '', program_id: '', term_id: 0, section_name: '',
        number_of_students: 0, year_level: '', is_night_class: '',
    });

    const [newTermName, setNewTermName] = useState('');
    const [editingTermId, setEditingTermId] = useState<number | null>(null);

    const sortRef = useRef<HTMLDivElement>(null);

    // ── ESC ───────────────────────────────────────────────────────────────────
    useEscapeKey(() => { setShowCourseModal(false); setEditMode(false); }, showCourseModal);
    useEscapeKey(() => { setShowSectionModal(false); setEditMode(false); }, showSectionModal);
    useEscapeKey(() => { setShowTermModal(false); setEditMode(false); }, showTermModal);
    useEscapeKey(() => setShowImportModal(false), showImportModal);
    useEscapeKey(() => setShowDeleteConfirm(false), showDeleteConfirm);
    useEscapeKey(() => setInstructorModal({ visible: false, group: null }), instructorModal.visible);

    // ── Reset on tab change ───────────────────────────────────────────────────
    useEffect(() => {
        setSearchTerm('');
        setSortBy('none');
        setCurrentPage(1);
        setSelectedIds(new Set());
    }, [activeTab]);

    useEffect(() => { setCurrentPage(1); }, [searchTerm, sortBy]);

    // ── Outside click for sort dropdown ───────────────────────────────────────
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (showSortDropdown && sortRef.current && !sortRef.current.contains(e.target as Node))
                setShowSortDropdown(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [showSortDropdown]);

    // ── Fetch all ─────────────────────────────────────────────────────────────
    const fetchAll = useCallback(async (silent = false) => {
        try {
            if (!silent) setLoading(true);

            const [coursesRes, termsRes, usersRes, collegesRes, userRolesRes] = await Promise.all([
                api.get('/courses/'),
                api.get('/tbl_term'),
                api.get('/users/'),
                api.get('/tbl_college/'),
                api.get('/tbl_user_role'),
            ]);

            setCourses(coursesRes.data || []);
            setTerms(termsRes.data || []);
            setUsers(usersRes.data || []);
            setColleges(collegesRes.data || []);
            setUserRoles(userRolesRes.data || []);

            // Fetch sections + programs separately
            const [sectionsRes, programsRes] = await Promise.all([
                api.get('/tbl_sectioncourse/page-data/').catch(() => api.get('/tbl_sectioncourse/')),
                api.get('/programs/'),
            ]);

            setPrograms(programsRes.data || []);

            const rawSections = sectionsRes.data?.section_courses ?? sectionsRes.data ?? [];
            setSections(rawSections);

            // Build course→instructors map from sections endpoint if available
            if (sectionsRes.data?.course_users) {
                const map: Record<string, User[]> = {};
                sectionsRes.data.course_users.forEach((row: any) => {
                    if (!row.tbl_users) return;
                    const u: User = {
                        user_id: row.tbl_users.user_id,
                        full_name: row.tbl_users.full_name ||
                            `${row.tbl_users.first_name || ''} ${row.tbl_users.last_name || ''}`.trim(),
                    };
                    const cid = row.course?.course_id || row.course_id;
                    if (!cid) return;
                    if (!map[cid]) map[cid] = [];
                    map[cid].push(u);
                });
                setCourseInstructorsMap(map);
            }

        } catch {
            toast.error('Failed to fetch data');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    // ── Derived: instructor groups from sections ───────────────────────────────
    const instructorGroups = useMemo<InstructorGroup[]>(() => {
        const map = new Map<number, InstructorGroup>();
        sections.forEach(sc => {
            const uid = sc.user?.user_id ?? sc.user_id;
            if (uid === undefined) return;
            if (!map.has(uid)) {
                map.set(uid, {
                    user_id: uid,
                    full_name: sc.user?.full_name ?? formatName(users.find(u => u.user_id === uid) ?? { user_id: uid }),
                    sections: [],
                });
            }
            map.get(uid)!.sections.push(sc);
        });
        return Array.from(map.values());
    }, [sections, users]);

    // ── Filtered / sorted / paginated data ───────────────────────────────────

    // COURSES
    const filteredCourses = useMemo(() => {
        const t = searchTerm.toLowerCase();
        let res = courses.filter(c =>
            c.course_id.toLowerCase().includes(t) ||
            c.course_name.toLowerCase().includes(t) ||
            (c.term_name || '').toLowerCase().includes(t) ||
            (c.instructor_names || []).some(n => n.toLowerCase().includes(t))
        );
        if (selectedCollege !== 'all') {
            res = res.filter(c => (c.user_ids || []).some(uid => {
                const role = userRoles.find((r: any) => Number(r.user_id ?? r.user) === uid);
                if (!role) return false;
                const cid = role.college_id ?? role.college?.college_id ?? role.college;
                return String(cid) === selectedCollege;
            }));
        }
        if (sortBy === 'course_id') res = [...res].sort((a, b) => smartSort(a.course_id, b.course_id));
        if (sortBy === 'course_name') res = [...res].sort((a, b) => smartSort(a.course_name.toLowerCase(), b.course_name.toLowerCase()));
        if (sortBy === 'term') res = [...res].sort((a, b) => smartSort(a.term_name || '', b.term_name || ''));
        return res;
    }, [courses, searchTerm, sortBy, selectedCollege, userRoles]);

    // INSTRUCTOR GROUPS (for sections tab)
    const filteredGroups = useMemo(() => {
        const t = searchTerm.toLowerCase();
        let res = instructorGroups.filter(g =>
            g.full_name.toLowerCase().includes(t) ||
            g.sections.some(sc =>
                sc.section_name.toLowerCase().includes(t) ||
                (sc.course?.course_name || sc.course_id).toLowerCase().includes(t) ||
                (sc.program?.program_name || sc.program_id).toLowerCase().includes(t) ||
                (sc.term?.term_name || '').toLowerCase().includes(t)
            )
        );
        if (selectedCollege !== 'all') {
            res = res.filter(g => {
                const role = userRoles.find((r: any) => Number(r.user_id ?? r.user) === g.user_id);
                if (!role) return false;
                const cid = role.college_id ?? role.college?.college_id ?? role.college;
                return String(cid) === selectedCollege;
            });
        }
        if (sortBy === 'instructor') res = [...res].sort((a, b) => smartSort(a.full_name.toLowerCase(), b.full_name.toLowerCase()));
        if (sortBy === 'sections') res = [...res].sort((a, b) => a.sections.length - b.sections.length);
        return res;
    }, [instructorGroups, searchTerm, sortBy, selectedCollege, userRoles]);

    // TERMS
    const filteredTerms = useMemo(() => {
        const t = searchTerm.toLowerCase();
        let res = terms.filter(term => term.term_name.toLowerCase().includes(t));
        if (sortBy === 'term_name') res = [...res].sort((a, b) => smartSort(a.term_name.toLowerCase(), b.term_name.toLowerCase()));
        return res;
    }, [terms, searchTerm, sortBy]);

    const getActiveData = () => {
        if (activeTab === 'courses') return filteredCourses;
        if (activeTab === 'sections') return filteredGroups;
        return filteredTerms;
    };

    const activeData = getActiveData();
    const totalPages = Math.max(1, Math.ceil(activeData.length / itemsPerPage));
    const paginated = activeData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    const idKey = (item: any) =>
        activeTab === 'courses' ? item.course_id :
            activeTab === 'sections' ? String(item.user_id) :
                String(item.term_id);

    const isAllSelected = activeData.length > 0 && activeData.every(item => selectedIds.has(idKey(item)));

    const toggleSelect = (id: string) => {
        setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
    };
    const toggleSelectAll = () => {
        if (isAllSelected) { setSelectedIds(new Set()); return; }
        const all = new Set<string>();
        activeData.forEach(item => all.add(idKey(item)));
        setSelectedIds(all);
    };

    // ── CRUD: Course ──────────────────────────────────────────────────────────

    const handleCourseSubmit = async () => {
        const { course_id, course_name, term_id, user_ids, leaders } = newCourse;
        if (!course_id.trim() || !course_name.trim() || !term_id || !user_ids?.length) {
            toast.error('All fields are required'); return;
        }
        setIsSaving(true);
        try {
            if (editMode) {
                await api.put(`/courses/${originalCourseId}/`, { course_id, course_name, term_id, user_ids, leaders });
                toast.success('Course updated');
            } else {
                await api.post('/courses/', { course_id, course_name, term_id, user_ids, leaders });
                toast.success('Course added');
            }
            setShowCourseModal(false); setEditMode(false);
            setNewCourse({ course_id: '', course_name: '', term_id: 0, user_ids: [], leaders: [] });
            await fetchAll(true);
        } catch (err: any) {
            toast.error(err?.response?.data?.detail || 'Failed to save course');
        } finally { setIsSaving(false); }
    };

    // ── CRUD: Section ─────────────────────────────────────────────────────────

    const handleSectionSubmit = async () => {
        const { course_id, program_id, section_name, number_of_students, year_level, term_id, user_id } = newSection;
        if (!course_id || !program_id || !section_name || !number_of_students || !year_level || !term_id || !user_id) {
            toast.error('All fields including instructor are required'); return;
        }
        setIsSaving(true);
        try {
            const payload = {
                course_id, program_id, term_id, user_id, section_name, number_of_students, year_level,
                is_night_class: newSection.is_night_class === 'YES' ? 'YES' : '',
            };
            if (editMode) {
                await api.put(`/tbl_sectioncourse/${newSection.id}/`, payload);
                toast.success('Section updated');
            } else {
                await api.post('/tbl_sectioncourse/', payload);
                toast.success('Section added');
            }
            setShowSectionModal(false); setEditMode(false);
            setNewSection({ course_id: '', program_id: '', term_id: 0, section_name: '', number_of_students: 0, year_level: '', is_night_class: '' });
            await fetchAll(true);
            // Refresh drill-down modal if open
            if (instructorModal.visible && instructorModal.group) {
                // group will be refreshed from updated sections
                setInstructorModal(prev => {
                    if (!prev.visible || !prev.group) return prev;
                    return prev; // will update via instructorGroups memo
                });
            }
        } catch (err: any) {
            toast.error(err?.response?.data?.error || 'Failed to save section');
        } finally { setIsSaving(false); }
    };

    const deleteSection = async (sc: SectionCourse) => {
        if (!confirm(`Delete section "${sc.section_name}"? This cannot be undone.`)) return;
        try {
            await api.delete(`/tbl_sectioncourse/${sc.id}/`);
            toast.success('Section deleted');
            await fetchAll(true);
        } catch { toast.error('Failed to delete section'); }
    };

    // ── CRUD: Term ────────────────────────────────────────────────────────────

    const handleTermSubmit = async () => {
        if (!newTermName.trim()) { toast.error('Term name is required'); return; }
        setIsSaving(true);
        try {
            if (editMode && editingTermId !== null) {
                await api.put(`/tbl_term/${editingTermId}/`, { term_name: newTermName.trim() });
                toast.success('Term updated');
            } else {
                if (terms.some(t => t.term_name.trim().toLowerCase() === newTermName.trim().toLowerCase())) {
                    toast.warning('Term already exists'); setIsSaving(false); return;
                }
                await api.post('/tbl_term', { term_name: newTermName.trim() });
                toast.success('Term added');
            }
            setShowTermModal(false); setEditMode(false);
            setNewTermName(''); setEditingTermId(null);
            await fetchAll(true);
        } catch { toast.error('Failed to save term'); }
        finally { setIsSaving(false); }
    };

    // ── Bulk Delete ───────────────────────────────────────────────────────────

    const handleBulkDelete = () => {
        if (selectedIds.size === 0) { toast.info('No items selected'); return; }
        setDeleteCount(selectedIds.size);
        setShowDeleteConfirm(true);
    };

    const confirmDelete = async () => {
        setShowDeleteConfirm(false);
        setIsBulkDeleting(true);
        try {
            let endpoint = '';
            if (activeTab === 'courses') endpoint = '/courses/';
            if (activeTab === 'terms') endpoint = '/tbl_term/';
            // For sections tab, selectedIds are user_ids — we delete all their sections
            if (activeTab === 'sections') {
                const toDelete = sections.filter(sc => selectedIds.has(String(sc.user?.user_id ?? sc.user_id)));
                const results = await Promise.allSettled(toDelete.map(sc => api.delete(`/tbl_sectioncourse/${sc.id}/`)));
                const ok = results.filter(r => r.status === 'fulfilled').length;
                if (ok) toast.success(`Deleted ${ok} section(s)`);
                setSelectedIds(new Set());
                await fetchAll(true);
                setIsBulkDeleting(false);
                return;
            }
            const results = await Promise.allSettled(
                Array.from(selectedIds).map(id => api.delete(`${endpoint}${id}/`))
            );
            const ok = results.filter(r => r.status === 'fulfilled').length;
            const fail = results.length - ok;
            if (ok) toast.success(`Deleted ${ok} item(s)`);
            if (fail) toast.error(`Failed to delete ${fail} item(s)`);
            setSelectedIds(new Set());
            await fetchAll(true);
        } catch { toast.error('Delete failed'); }
        finally { setIsBulkDeleting(false); }
    };

    // ── Import: Courses ───────────────────────────────────────────────────────

    const handleCourseImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = async (evt: any) => {
            setIsImporting(true);
            try {
                const wb = XLSX.read(new Uint8Array(evt.target.result), { type: 'array' });
                const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
                let ok = 0;
                for (const row of rows) {
                    const cid = String(row['Course ID'] || '').trim();
                    const cname = String(row['Course Name'] || '').trim();
                    const tname = String(row['Term Name'] || '').trim().toLowerCase();
                    const term = terms.find(t => t.term_name.toLowerCase() === tname);
                    if (!cid || !cname || !term) continue;
                    try { await api.post('/courses/', { course_id: cid, course_name: cname, term_id: term.term_id, user_ids: [], leaders: [] }); ok++; } catch { }
                }
                toast.success(`Imported ${ok} course(s)`);
                await fetchAll(true);
            } catch { toast.error('Import failed'); }
            finally { setIsImporting(false); setShowImportModal(false); }
        };
        reader.readAsArrayBuffer(file);
    };

    // ── Import: Terms ─────────────────────────────────────────────────────────

    const handleTermImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = async (evt: any) => {
            setIsImporting(true);
            try {
                const wb = XLSX.read(new Uint8Array(evt.target.result), { type: 'array' });
                const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
                let ok = 0, dupes = 0;
                const existing = terms.map(t => t.term_name.toLowerCase());
                for (const row of rows) {
                    const name = String(row['Term Name'] || '').trim();
                    if (!name) continue;
                    if (existing.includes(name.toLowerCase())) { dupes++; continue; }
                    try { await api.post('/tbl_term', { term_name: name }); ok++; } catch { }
                }
                toast.success(`Imported ${ok} term(s), ${dupes} skipped`);
                await fetchAll(true);
            } catch { toast.error('Import failed'); }
            finally { setIsImporting(false); setShowImportModal(false); }
        };
        reader.readAsArrayBuffer(file);
    };

    const downloadCourseTemplate = () => {
        const ws = XLSX.utils.aoa_to_sheet([
            ['Course ID', 'Course Name', 'Term Name', 'Instructor Full Names'],
            ['IT112', 'Computer Programming 1', '1st Semester', 'Juan Dela Cruz'],
        ]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Template');
        XLSX.writeFile(wb, 'courses_template.xlsx');
    };

    const downloadTermTemplate = () => {
        const ws = XLSX.utils.aoa_to_sheet([['Term Name'], ['1st Semester'], ['2nd Semester']]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Template');
        XLSX.writeFile(wb, 'terms_template.xlsx');
    };

    // ── Select options ────────────────────────────────────────────────────────

    const userOptions = useMemo(() =>
        users.map(u => ({ value: u.user_id, label: formatName(u) })), [users]);

    const courseOptions = useMemo(() =>
        courses.map(c => ({ value: c.course_id, label: `${c.course_id} (${c.course_name})` })), [courses]);

    const programOptions = useMemo(() =>
        programs.map(p => ({ value: p.program_id, label: `${p.program_id} (${p.program_name})` })), [programs]);

    const instructorOptionsForSection = useMemo(() => {
        const list = courseInstructorsMap[newSection.course_id] || [];
        if (list.length === 0 && newSection.course_id) return userOptions;
        return list.map(u => ({ value: u.user_id, label: u.full_name || formatName(u) }));
    }, [courseInstructorsMap, newSection.course_id, userOptions]);

    // ── Sort options per tab ───────────────────────────────────────────────────

    const sortOptions: Record<ActiveTab, { value: string; label: string }[]> = {
        courses: [
            { value: 'none', label: 'None' },
            { value: 'course_id', label: 'Course Code' },
            { value: 'course_name', label: 'Course Name' },
            { value: 'term', label: 'Term' },
        ],
        sections: [
            { value: 'none', label: 'None' },
            { value: 'instructor', label: 'Instructor Name' },
            { value: 'sections', label: 'Section Count' },
        ],
        terms: [
            { value: 'none', label: 'None' },
            { value: 'term_name', label: 'Term Name' },
        ],
    };

    // ── Tab meta ──────────────────────────────────────────────────────────────

    const tabMeta: Record<ActiveTab, { label: string; icon: React.ReactNode; count: number }> = {
        courses: { label: 'Courses', icon: <FaBook style={{ fontSize: '13px' }} />, count: courses.length },
        sections: { label: 'Section Courses', icon: <FaLayerGroup style={{ fontSize: '13px' }} />, count: instructorGroups.length },
        terms: { label: 'Terms', icon: <FaCalendarAlt style={{ fontSize: '13px' }} />, count: terms.length },
    };

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <div className="cl-page">

            {/* ── Page Header ── */}
            <div className="cl-page-header">
                <div className="cl-page-header-left">
                    <div className="cl-page-icon">
                        <FaBook size={20} />
                    </div>
                    <div className="cl-page-title">
                        <h1>Academic Data</h1>
                        <p>{courses.length} courses · {instructorGroups.length} instructors · {terms.length} terms</p>
                    </div>
                </div>
                <div className="cl-page-actions">
                    <div className="cl-search-bar">
                        <FaSearch className="cl-search-icon" />
                        <input
                            type="text"
                            placeholder={`Search ${activeTab}…`}
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>

                    {/* Add button per tab */}
                    {activeTab === 'courses' && (
                        <button type="button" className="cl-btn primary" onClick={() => {
                            setEditMode(false);
                            setNewCourse({ course_id: '', course_name: '', term_id: 0, user_ids: [], leaders: [] });
                            setShowCourseModal(true);
                        }}>
                            <FaPlus style={{ fontSize: '11px' }} /> Add Course
                        </button>
                    )}
                    {activeTab === 'sections' && (
                        <button type="button" className="cl-btn primary" onClick={() => {
                            setEditMode(false);
                            setNewSection({ course_id: '', program_id: '', term_id: 0, section_name: '', number_of_students: 0, year_level: '', is_night_class: '' });
                            setShowSectionModal(true);
                        }}>
                            <FaPlus style={{ fontSize: '11px' }} /> Add Section
                        </button>
                    )}
                    {activeTab === 'terms' && (
                        <button type="button" className="cl-btn primary" onClick={() => {
                            setEditMode(false);
                            setNewTermName('');
                            setEditingTermId(null);
                            setShowTermModal(true);
                        }}>
                            <FaPlus style={{ fontSize: '11px' }} /> Add Term
                        </button>
                    )}

                    {(activeTab === 'courses' || activeTab === 'terms') && (
                        <button type="button" className="cl-btn" onClick={() => setShowImportModal(true)}>
                            <FaFileImport style={{ fontSize: '11px' }} /> Import
                        </button>
                    )}

                    <button
                        type="button"
                        className="cl-btn danger"
                        onClick={handleBulkDelete}
                        disabled={isBulkDeleting || selectedIds.size === 0}
                        title={selectedIds.size > 0 ? `Delete ${selectedIds.size} selected` : 'Select items to delete'}
                    >
                        <FaTrash style={{ fontSize: '11px' }} />
                        {selectedIds.size > 0 && <span>({selectedIds.size})</span>}
                    </button>
                </div>
            </div>

            {/* ── Tabs ── */}
            <div className="cl-tabs">
                {(Object.keys(tabMeta) as ActiveTab[]).map(tab => (
                    <button
                        key={tab}
                        type="button"
                        className={`cl-tab${activeTab === tab ? ' active' : ''}`}
                        onClick={() => setActiveTab(tab)}
                    >
                        {tabMeta[tab].icon}
                        {tabMeta[tab].label}
                        <span className="cl-tab-badge">{tabMeta[tab].count}</span>
                    </button>
                ))}
            </div>

            {/* ── Toolbar ── */}
            <div className="cl-toolbar">
                <div className="cl-toolbar-left">
                    {/* Sort */}
                    <div ref={sortRef} style={{ position: 'relative' }} data-sort-dropdown>
                        <button type="button" className="cl-toolbar-btn" onClick={() => setShowSortDropdown(v => !v)}>
                            <FaSort style={{ fontSize: '11px' }} />
                            Sort{sortBy !== 'none' ? `: ${sortOptions[activeTab].find(o => o.value === sortBy)?.label}` : ''}
                            <FaChevronDown style={{ fontSize: '9px', marginLeft: '2px' }} />
                        </button>
                        {showSortDropdown && (
                            <div className="cl-dropdown">
                                {sortOptions[activeTab].map(opt => (
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

                    {/* College filter (courses + sections) */}
                    {activeTab !== 'terms' && (
                        <select
                            value={selectedCollege}
                            onChange={e => setSelectedCollege(e.target.value)}
                            className="cl-toolbar-btn"
                            style={{ cursor: 'pointer' }}
                        >
                            <option value="all">All Colleges</option>
                            {colleges.map(c => (
                                <option key={c.college_id} value={c.college_id}>{c.college_name}</option>
                            ))}
                        </select>
                    )}
                </div>

                <div className="cl-pagination">
                    <button type="button" className="cl-page-btn" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage <= 1}>←</button>
                    <span className="cl-page-info">{currentPage} / {totalPages}</span>
                    <button type="button" className="cl-page-btn" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages}>→</button>
                </div>
            </div>

            {/* ════════════ COURSES TABLE ════════════ */}
            {activeTab === 'courses' && (
                <div className="cl-table-card">
                    <div className="cl-table-container">
                        <table className="cl-table">
                            <thead>
                                <tr>
                                    <th style={{ width: '52px' }}>#</th>
                                    <th>Course Code</th>
                                    <th>Course Name</th>
                                    <th>Term</th>
                                    <th>Instructors</th>
                                    <th style={{ width: '150px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <span>Actions</span>
                                            <input type="checkbox" checked={isAllSelected} onChange={toggleSelectAll} disabled={loading || courses.length === 0} style={{ cursor: 'pointer' }} />
                                        </div>
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan={6} className="cl-table-empty"><div className="cl-spinner" /> Loading…</td></tr>
                                ) : filteredCourses.length === 0 ? (
                                    <tr><td colSpan={6} className="cl-table-empty">No courses found.</td></tr>
                                ) : (
                                    (paginated as Course[]).map((c, idx) => {
                                        const isSelected = selectedIds.has(c.course_id);
                                        const instructors = c.user_ids?.map(id => {
                                            const u = users.find(u => u.user_id === id);
                                            return u ? formatName(u) : '';
                                        }).filter(Boolean).join(', ') || '—';
                                        return (
                                            <tr key={c.course_id} className={isSelected ? 'selected' : ''}>
                                                <td className="cl-td-num">{(currentPage - 1) * itemsPerPage + idx + 1}</td>
                                                <td><span className="cl-id-badge">{c.course_id}</span></td>
                                                <td>{c.course_name}</td>
                                                <td><span className="cl-term-badge">{c.term_name || '—'}</span></td>
                                                <td style={{ fontSize: '12px', color: 'var(--cl-text-muted)', maxWidth: '200px' }}>{instructors}</td>
                                                <td>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <button type="button" className="cl-icon-btn edit" onClick={() => {
                                                            setOriginalCourseId(c.course_id);
                                                            setNewCourse({ course_id: c.course_id, course_name: c.course_name, term_id: Number(c.term_id) || 0, user_ids: c.user_ids || [], leaders: c.leaders || [] });
                                                            setEditMode(true); setShowCourseModal(true);
                                                        }}>
                                                            <FaEdit style={{ fontSize: '10px' }} /> Edit
                                                        </button>
                                                        <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(c.course_id)} style={{ marginLeft: 'auto', cursor: 'pointer' }} />
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
            )}

            {/* ════════════ SECTIONS TABLE (by instructor) ════════════ */}
            {activeTab === 'sections' && (
                <div className="cl-table-card">
                    <div className="cl-table-container">
                        <table className="cl-table">
                            <thead>
                                <tr>
                                    <th style={{ width: '52px' }}>#</th>
                                    <th>Instructor</th>
                                    <th style={{ width: '90px', textAlign: 'center' }}>Sections</th>
                                    <th style={{ width: '90px', textAlign: 'center' }}>Students</th>
                                    <th style={{ width: '180px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <span>Actions</span>
                                            <input type="checkbox" checked={isAllSelected} onChange={toggleSelectAll} disabled={loading || instructorGroups.length === 0} style={{ cursor: 'pointer' }} />
                                        </div>
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan={5} className="cl-table-empty"><div className="cl-spinner" /> Loading…</td></tr>
                                ) : filteredGroups.length === 0 ? (
                                    <tr><td colSpan={5} className="cl-table-empty">No sections found.</td></tr>
                                ) : (
                                    (paginated as InstructorGroup[]).map((g, idx) => {
                                        const isSelected = selectedIds.has(String(g.user_id));
                                        const totalStudents = g.sections.reduce((s, sc) => s + (sc.number_of_students || 0), 0);
                                        return (
                                            <tr key={g.user_id} className={isSelected ? 'selected' : ''}>
                                                <td className="cl-td-num">{(currentPage - 1) * itemsPerPage + idx + 1}</td>
                                                <td style={{ fontWeight: 600, color: 'var(--cl-text-primary)' }}>{g.full_name}</td>
                                                <td style={{ textAlign: 'center' }}><span className="cl-room-count-badge">{g.sections.length}</span></td>
                                                <td style={{ textAlign: 'center' }}><span className="cl-room-count-badge">{totalStudents}</span></td>
                                                <td>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <button type="button" className="cl-icon-btn view" onClick={() => setInstructorModal({ visible: true, group: g })}>
                                                            <FaEye style={{ fontSize: '10px' }} /> Sections
                                                        </button>
                                                        <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(String(g.user_id))} style={{ marginLeft: 'auto', cursor: 'pointer' }} />
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
            )}

            {/* ════════════ TERMS TABLE ════════════ */}
            {activeTab === 'terms' && (
                <div className="cl-table-card">
                    <div className="cl-table-container">
                        <table className="cl-table">
                            <thead>
                                <tr>
                                    <th style={{ width: '52px' }}>#</th>
                                    <th>Term Name</th>
                                    <th style={{ width: '150px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <span>Actions</span>
                                            <input type="checkbox" checked={isAllSelected} onChange={toggleSelectAll} disabled={loading || terms.length === 0} style={{ cursor: 'pointer' }} />
                                        </div>
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan={3} className="cl-table-empty"><div className="cl-spinner" /> Loading…</td></tr>
                                ) : filteredTerms.length === 0 ? (
                                    <tr><td colSpan={3} className="cl-table-empty">No terms found.</td></tr>
                                ) : (
                                    (paginated as Term[]).map((t, idx) => {
                                        const isSelected = selectedIds.has(String(t.term_id));
                                        return (
                                            <tr key={t.term_id} className={isSelected ? 'selected' : ''}>
                                                <td className="cl-td-num">{(currentPage - 1) * itemsPerPage + idx + 1}</td>
                                                <td>{t.term_name}</td>
                                                <td>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <button type="button" className="cl-icon-btn edit" onClick={() => {
                                                            setEditMode(true); setEditingTermId(t.term_id);
                                                            setNewTermName(t.term_name); setShowTermModal(true);
                                                        }}>
                                                            <FaEdit style={{ fontSize: '10px' }} /> Edit
                                                        </button>
                                                        <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(String(t.term_id))} style={{ marginLeft: 'auto', cursor: 'pointer' }} />
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
            )}

            {/* ════ INSTRUCTOR SECTIONS DRILL-DOWN MODAL ════ */}
            {instructorModal.visible && instructorModal.group && (() => {
                // Always use fresh group from instructorGroups memo
                const freshGroup = instructorGroups.find(g => g.user_id === instructorModal.group!.user_id) ?? instructorModal.group;
                return (
                    <div className="cl-modal-overlay" onClick={() => setInstructorModal({ visible: false, group: null })}>
                        <div className="cl-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '820px' }}>
                            <div className="cl-modal-header">
                                <h3>Sections — {freshGroup.full_name}</h3>
                                <p>{freshGroup.sections.length} section{freshGroup.sections.length !== 1 ? 's' : ''}</p>
                            </div>
                            <div className="cl-modal-body" style={{ padding: 0, maxHeight: '460px' }}>
                                {freshGroup.sections.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '40px', color: 'var(--cl-text-muted)', fontSize: '13px' }}>
                                        No sections assigned.
                                    </div>
                                ) : (
                                    <div style={{ overflowX: 'auto' }}>
                                        <table className="cl-table" style={{ fontSize: '13px', margin: 0 }}>
                                            <thead>
                                                <tr>
                                                    <th style={{ width: '40px' }}>No.</th>
                                                    <th>Course</th>
                                                    <th>Program</th>
                                                    <th>Section</th>
                                                    <th style={{ width: '70px', textAlign: 'center' }}>Students</th>
                                                    <th>Year</th>
                                                    <th>Term</th>
                                                    <th style={{ width: '70px', textAlign: 'center' }}>Night</th>
                                                    <th style={{ width: '130px' }}>Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {freshGroup.sections.map((sc, idx) => (
                                                    <tr key={sc.id ?? idx}>
                                                        <td className="cl-td-num">{idx + 1}</td>
                                                        <td>
                                                            <span className="cl-id-badge" style={{ fontSize: '11px' }}>{sc.course_id}</span>
                                                            <span style={{ marginLeft: '6px', fontSize: '12px', color: 'var(--cl-text-muted)' }}>
                                                                {sc.course?.course_name}
                                                            </span>
                                                        </td>
                                                        <td style={{ fontSize: '12px' }}>{sc.program?.program_name || sc.program_id}</td>
                                                        <td style={{ fontWeight: 600 }}>{sc.section_name}</td>
                                                        <td style={{ textAlign: 'center' }}>
                                                            <span className="cl-room-count-badge">{sc.number_of_students}</span>
                                                        </td>
                                                        <td style={{ fontSize: '12px' }}>{sc.year_level}</td>
                                                        <td style={{ fontSize: '12px' }}>{sc.term?.term_name || '—'}</td>
                                                        <td style={{ textAlign: 'center' }}>
                                                            {sc.is_night_class === 'YES'
                                                                ? <span className="cl-night-badge">YES</span>
                                                                : <span style={{ color: 'var(--cl-text-muted)', fontSize: '11px' }}>—</span>
                                                            }
                                                        </td>
                                                        <td>
                                                            <div style={{ display: 'flex', gap: '5px' }}>
                                                                <button type="button" className="cl-icon-btn edit" onClick={() => {
                                                                    setEditMode(true);
                                                                    setNewSection({
                                                                        ...sc,
                                                                        course_id: sc.course?.course_id || sc.course_id,
                                                                        program_id: sc.program?.program_id || sc.program_id,
                                                                        term_id: sc.term?.term_id || sc.term_id,
                                                                        user_id: sc.user?.user_id || sc.user_id,
                                                                        is_night_class: sc.is_night_class === 'YES' ? 'YES' : '',
                                                                    });
                                                                    setShowSectionModal(true);
                                                                }}>
                                                                    <FaEdit style={{ fontSize: '10px' }} /> Edit
                                                                </button>
                                                                <button type="button" className="cl-icon-btn" style={{ color: 'var(--cl-danger)', border: '1px solid var(--cl-danger)' }} onClick={() => deleteSection(sc)}>
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
                                <button type="button" className="cl-btn" onClick={() => {
                                    setEditMode(false);
                                    setNewSection({ course_id: '', program_id: '', term_id: 0, section_name: '', number_of_students: 0, year_level: '', is_night_class: '', user_id: freshGroup.user_id });
                                    setShowSectionModal(true);
                                }}>
                                    <FaPlus style={{ fontSize: '10px' }} /> Add Section
                                </button>
                                <button type="button" className="cl-btn primary" onClick={() => setInstructorModal({ visible: false, group: null })}>Close</button>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* ════ ADD / EDIT COURSE MODAL ════ */}
            {showCourseModal && (
                <div className="cl-modal-overlay" style={{ zIndex: 10002 }} onClick={() => { setShowCourseModal(false); setEditMode(false); }}>
                    <div className="cl-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
                        <div className="cl-modal-header">
                            <h3>{editMode ? 'Edit Course' : 'Add Course'}</h3>
                        </div>
                        <div className="cl-modal-body">
                            <div className="cl-field">
                                <label>Course Code</label>
                                <input className="cl-input" disabled={editMode} value={newCourse.course_id}
                                    onChange={e => setNewCourse(f => ({ ...f, course_id: e.target.value }))}
                                    placeholder="e.g. IT112" autoFocus />
                            </div>
                            <div className="cl-field">
                                <label>Course Name</label>
                                <input className="cl-input" value={newCourse.course_name}
                                    onChange={e => setNewCourse(f => ({ ...f, course_name: e.target.value }))}
                                    placeholder="e.g. Computer Programming 1" />
                            </div>
                            <div className="cl-field">
                                <label>Term</label>
                                <select className="cl-input" value={String(newCourse.term_id || '')}
                                    onChange={e => setNewCourse(f => ({ ...f, term_id: Number(e.target.value) }))}>
                                    <option value="">Select Term</option>
                                    {terms.map(t => <option key={t.term_id} value={t.term_id}>{t.term_name}{t.academic_year ? ` (${t.academic_year})` : ''}</option>)}
                                </select>
                            </div>
                            <div className="cl-field">
                                <label>Instructors</label>
                                <Select
                                    isMulti options={userOptions}
                                    value={userOptions.filter(o => (newCourse.user_ids || []).includes(o.value))}
                                    onChange={sel => {
                                        const ids = sel.map(o => o.value);
                                        setNewCourse(f => ({ ...f, user_ids: ids, leaders: (f.leaders || []).filter(l => ids.includes(l)) }));
                                    }}
                                    styles={selectPortalStyles} menuPortalTarget={document.body} menuPosition="fixed"
                                    placeholder="Select instructors…"
                                />
                            </div>
                            {(newCourse.user_ids || []).length > 0 && (
                                <div className="cl-field">
                                    <label>Bayanihan Leaders</label>
                                    <Select
                                        isMulti options={userOptions.filter(o => (newCourse.user_ids || []).includes(o.value))}
                                        value={userOptions.filter(o => (newCourse.leaders || []).includes(o.value))}
                                        onChange={sel => setNewCourse(f => ({ ...f, leaders: sel.map(o => o.value) }))}
                                        styles={selectPortalStyles} menuPortalTarget={document.body} menuPosition="fixed"
                                        placeholder="Select leaders…"
                                    />
                                </div>
                            )}
                        </div>
                        <div className="cl-modal-footer">
                            <button type="button" className="cl-btn" onClick={() => { setShowCourseModal(false); setEditMode(false); }} disabled={isSaving}>Cancel</button>
                            <button type="button" className="cl-btn primary" onClick={handleCourseSubmit} disabled={isSaving}>
                                {isSaving ? 'Saving…' : 'Save'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ════ ADD / EDIT SECTION MODAL ════ */}
            {showSectionModal && (
                <div className="cl-modal-overlay" style={{ zIndex: 10002 }} onClick={() => { setShowSectionModal(false); setEditMode(false); }}>
                    <div className="cl-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
                        <div className="cl-modal-header">
                            <h3>{editMode ? 'Edit Section' : 'Add Section'}</h3>
                        </div>
                        <div className="cl-modal-body">
                            {(() => {
                                // Derive the term locked to the selected course
                                const selectedCourse = courses.find(c => c.course_id === newSection.course_id);
                                const lockedTermId = selectedCourse?.term_id ?? null;
                                const lockedTerm = lockedTermId ? terms.find(t => t.term_id === lockedTermId) : null;
                                return (
                                    <>
                                        <div className="cl-field">
                                            <label>Course</label>
                                            {editMode ? (
                                                <div className="cl-input" style={{ background: 'var(--cl-surface-2)', color: 'var(--cl-text-muted)', cursor: 'not-allowed' }}>
                                                    {newSection.course_id} — {selectedCourse?.course_name || ''}
                                                </div>
                                            ) : (
                                                <Select options={courseOptions}
                                                    value={courseOptions.find(o => o.value === newSection.course_id) || null}
                                                    onChange={sel => {
                                                        const picked = courses.find(c => c.course_id === sel?.value);
                                                        setNewSection(f => ({
                                                            ...f,
                                                            course_id: sel?.value || '',
                                                            user_id: undefined,
                                                            // auto-fill term from the course
                                                            term_id: picked?.term_id ?? f.term_id,
                                                        }));
                                                    }}
                                                    styles={selectPortalStyles} menuPortalTarget={document.body} menuPosition="fixed"
                                                    placeholder="Select Course…" isClearable />
                                            )}
                                        </div>

                                        <div className="cl-field">
                                            <label>Program</label>
                                            {editMode ? (
                                                <div className="cl-input" style={{ background: 'var(--cl-surface-2)', color: 'var(--cl-text-muted)', cursor: 'not-allowed' }}>
                                                    {newSection.program_id} — {programs.find(p => p.program_id === newSection.program_id)?.program_name || ''}
                                                </div>
                                            ) : (
                                                <Select options={programOptions}
                                                    value={programOptions.find(o => o.value === newSection.program_id) || null}
                                                    onChange={sel => setNewSection(f => ({ ...f, program_id: sel?.value || '' }))}
                                                    styles={selectPortalStyles} menuPortalTarget={document.body} menuPosition="fixed"
                                                    placeholder="Select Program…" isClearable />
                                            )}
                                        </div>

                                        <div className="cl-field">
                                            <label>Section Name</label>
                                            <input className="cl-input" value={newSection.section_name}
                                                onChange={e => setNewSection(f => ({ ...f, section_name: e.target.value }))}
                                                placeholder="e.g. IT 1R1" />
                                        </div>

                                        <div className="cl-field">
                                            <label>Number of Students</label>
                                            <input className="cl-input" type="number"
                                                value={newSection.number_of_students || ''}
                                                onChange={e => setNewSection(f => ({ ...f, number_of_students: parseInt(e.target.value) || 0 }))}
                                                placeholder="e.g. 40" />
                                        </div>

                                        <div className="cl-field">
                                            <label>Year Level</label>
                                            <select className="cl-input" value={newSection.year_level}
                                                onChange={e => setNewSection(f => ({ ...f, year_level: e.target.value }))}>
                                                <option value="">Select Year</option>
                                                {['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year'].map(y =>
                                                    <option key={y} value={y}>{y}</option>
                                                )}
                                            </select>
                                        </div>

                                        {/* Term — hidden when course already has a term set */}
                                        <div className="cl-field">
                                            <label>Term</label>
                                            {lockedTerm ? (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <span className="cl-term-badge" style={{ fontSize: '12px', padding: '5px 12px' }}>
                                                        {lockedTerm.term_name}
                                                    </span>
                                                    <span style={{ fontSize: '11.5px', color: 'var(--cl-text-muted)' }}>
                                                        inherited from course
                                                    </span>
                                                </div>
                                            ) : (
                                                <select className="cl-input" value={newSection.term_id || ''}
                                                    onChange={e => setNewSection(f => ({ ...f, term_id: parseInt(e.target.value) || 0 }))}>
                                                    <option value="">Select Term</option>
                                                    {terms.map(t => <option key={t.term_id} value={t.term_id}>{t.term_name}</option>)}
                                                </select>
                                            )}
                                        </div>
                                    </>
                                );
                            })()}
                            <div className="cl-field">
                                <label>Instructor</label>
                                <Select options={instructorOptionsForSection}
                                    value={instructorOptionsForSection.find(o => o.value === newSection.user_id) || null}
                                    onChange={sel => setNewSection(f => ({ ...f, user_id: sel?.value }))}
                                    styles={selectPortalStyles} menuPortalTarget={document.body} menuPosition="fixed"
                                    placeholder="Select Instructor…" isClearable menuPlacement="top" />
                            </div>
                            <div className="cl-field">
                                <label>Night Class</label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: 'var(--cl-text-secondary)' }}>
                                    <input type="checkbox"
                                        checked={newSection.is_night_class === 'YES'}
                                        onChange={e => setNewSection(f => ({ ...f, is_night_class: e.target.checked ? 'YES' : '' }))}
                                    />
                                    Mark as night class
                                </label>
                            </div>
                        </div>
                        <div className="cl-modal-footer">
                            <button type="button" className="cl-btn" onClick={() => { setShowSectionModal(false); setEditMode(false); }} disabled={isSaving}>Cancel</button>
                            <button type="button" className="cl-btn primary" onClick={handleSectionSubmit} disabled={isSaving}>
                                {isSaving ? 'Saving…' : 'Save'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ════ ADD / EDIT TERM MODAL ════ */}
            {showTermModal && (
                <div className="cl-modal-overlay" style={{ zIndex: 10002 }} onClick={() => { setShowTermModal(false); setEditMode(false); }}>
                    <div className="cl-modal" onClick={e => e.stopPropagation()}>
                        <div className="cl-modal-header">
                            <h3>{editMode ? 'Edit Term' : 'Add Term'}</h3>
                        </div>
                        <div className="cl-modal-body">
                            <div className="cl-field">
                                <label>Term Name</label>
                                <input className="cl-input" value={newTermName}
                                    onChange={e => setNewTermName(e.target.value)}
                                    placeholder="e.g. 1st Semester" autoFocus />
                            </div>
                        </div>
                        <div className="cl-modal-footer">
                            <button type="button" className="cl-btn" onClick={() => { setShowTermModal(false); setEditMode(false); }} disabled={isSaving}>Cancel</button>
                            <button type="button" className="cl-btn primary" onClick={handleTermSubmit} disabled={isSaving}>
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
                            <h3>Import {activeTab === 'courses' ? 'Courses' : 'Terms'}</h3>
                            <p>Upload an .xlsx file using the template format.</p>
                        </div>
                        <div className="cl-modal-body">
                            {activeTab === 'courses' && (
                                <p className="cl-import-hint">Columns: <strong>Course ID, Course Name, Term Name, Instructor Full Names</strong></p>
                            )}
                            {activeTab === 'terms' && (
                                <p className="cl-import-hint">Columns: <strong>Term Name</strong></p>
                            )}
                            <input type="file" accept=".xlsx,.xls"
                                onChange={activeTab === 'courses' ? handleCourseImport : handleTermImport}
                                disabled={isImporting} className="cl-file-input" />
                            <button type="button" className="cl-btn"
                                onClick={activeTab === 'courses' ? downloadCourseTemplate : downloadTermTemplate}
                                disabled={isImporting} style={{ width: '100%', justifyContent: 'center', marginTop: '8px' }}>
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
                        <div className="cl-modal-header"><h3>Confirm Deletion</h3></div>
                        <div className="cl-modal-body">
                            <p style={{ fontSize: '13.5px', color: 'var(--cl-text-secondary)', lineHeight: 1.7, margin: 0 }}>
                                You are about to delete <strong>{deleteCount}</strong> item{deleteCount !== 1 ? 's' : ''}.
                                {activeTab === 'sections' && ' All sections belonging to the selected instructor(s) will be deleted.'}
                                {' '}This action cannot be undone.
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

export default AcademicData;