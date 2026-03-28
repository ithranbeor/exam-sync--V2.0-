// deno-lint-ignore-file no-explicit-any
import React, { useState, useEffect, useRef, useMemo } from 'react';
import '../styles/A_Colleges.css';
import {
    FaExchangeAlt, FaCheckCircle, FaTimesCircle, FaUsers, FaClock,
    FaChevronLeft, FaChevronRight, FaEye, FaTrash, FaPenAlt,
    FaPlus, FaSearch, FaSort, FaChevronDown,
} from 'react-icons/fa';
import { api } from '../lib/apiClient.ts';
import { ToastContainer, toast } from 'react-toastify';
import Select, { components } from 'react-select';
import 'react-toastify/dist/ReactToastify.css';
import { useEscapeKey } from '../hooks/useEscapeKey.ts';

// ── Types ─────────────────────────────────────────────────────────────────────

type ProctorSetAvailabilityProps = {
    user: { user_id: number; [key: string]: unknown };
};

export const AvailabilityTimeSlot = {
    Morning:   '7 AM - 1 PM (Morning)',
    Afternoon: '1 PM - 6 PM (Afternoon)',
    Evening:   '6 PM - 9 PM (Evening)',
} as const;
export type AvailabilityTimeSlot = (typeof AvailabilityTimeSlot)[keyof typeof AvailabilityTimeSlot];

export const AvailabilityStatus = {
    Available:   'available',
    Unavailable: 'unavailable',
} as const;
export type AvailabilityStatus = (typeof AvailabilityStatus)[keyof typeof AvailabilityStatus];

interface Availability {
    availability_id: number;
    days: string[];
    time_slots: AvailabilityTimeSlot[];
    status: AvailabilityStatus;
    remarks: string | null;
    user_id: number;
    user_fullname?: string;
    _ids?: number[];
}

interface ChangeRequest {
    id: number;
    user_id: number;
    proctor_name?: string;
    days: string[];
    time_slots: string[];
    status: string;
    requested_status?: string;
    remarks?: string | null;
    created_at?: string;
    type?: string;
}

// ── select portal styles (matches A_Colleges design) ─────────────────────────

const selectStyles = {
    control: (b: any) => ({ ...b, fontSize: '13px', minHeight: '36px', borderColor: 'var(--cl-border)', borderRadius: '6px' }),
    menuPortal: (b: any) => ({ ...b, zIndex: 99999, fontSize: '13px' }),
    menu: (b: any) => ({ ...b, fontSize: '13px' }),
    option: (b: any, s: any) => ({ ...b, color: '#0C1B2A', backgroundColor: s.isFocused ? '#f1f5f9' : '#fff' }),
    singleValue: (b: any) => ({ ...b, color: '#0C1B2A' }),
    multiValueLabel: (b: any) => ({ ...b, color: '#0C1B2A' }),
};

// ── Component ─────────────────────────────────────────────────────────────────

const SchedulerAvailability: React.FC<ProctorSetAvailabilityProps> = ({ user }) => {

    // ── Tab ───────────────────────────────────────────────────────────────────
    const [activeTab, setActiveTab] = useState<'availability' | 'change-requests'>('availability');

    // ── Availability data ─────────────────────────────────────────────────────
    const [entries, setEntries]         = useState<Availability[]>([]);
    const [instructors, setInstructors] = useState<any[]>([]);
    const [userCache, setUserCache]     = useState<Map<number, any>>(new Map());

    // ── Form state ────────────────────────────────────────────────────────────
    const [selectedDate, setSelectedDate]           = useState<string[]>([]);
    const [selectedTimeSlot, setSelectedTimeSlot]   = useState<AvailabilityTimeSlot[]>([AvailabilityTimeSlot.Morning]);
    const [availabilityStatus, setAvailabilityStatus] = useState<AvailabilityStatus>(AvailabilityStatus.Available);
    const [remarks, setRemarks]                     = useState('');
    const [selectedInstructors, setSelectedInstructors]     = useState<any[]>([]);
    const [selectedInstructorSingle, setSelectedInstructorSingle] = useState<any>(null);

    // ── Calendar ──────────────────────────────────────────────────────────────
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [currentMonth, setCurrentMonth]     = useState(new Date());
    const [allowedDates, setAllowedDates]     = useState<string[]>([]);
    const today = new Date();

    // ── UI state ──────────────────────────────────────────────────────────────
    const [searchTerm, setSearchTerm]   = useState('');
    const [showModal, setShowModal]     = useState(false);
    const [editingId, setEditingId]     = useState<number | null>(null);
    const [loading, setLoading]         = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isBulkDeleting, setIsBulkDeleting] = useState(false);
    const [sortBy, setSortBy]           = useState('none');
    const [showSortDropdown, setShowSortDropdown] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage                  = 20;

    const [selectedRemarks, setSelectedRemarks]   = useState('');
    const [showRemarksModal, setShowRemarksModal] = useState(false);
    const [selectedAvailabilityIds, setSelectedAvailabilityIds] = useState<Set<number>>(new Set());
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleteCount, setDeleteCount]           = useState(0);

    // ── Change Requests ───────────────────────────────────────────────────────
    const [changeRequests, setChangeRequests]   = useState<ChangeRequest[]>([]);
    const [crLoading, setCrLoading]             = useState(false);
    const [crFilter, setCrFilter]               = useState<string>('all');
    const [crSearchTerm, setCrSearchTerm]       = useState('');
    const [processingCrId, setProcessingCrId]   = useState<number | null>(null);
    const [selectedCr, setSelectedCr]           = useState<ChangeRequest | null>(null);
    const [showCrDetailModal, setShowCrDetailModal] = useState(false);
    const [schedulerCollegeId, setSchedulerCollegeId] = useState<number | null>(null);
    const [pendingCrCount, setPendingCrCount]   = useState(0);
    const [editingCrId, setEditingCrId]         = useState<number | null>(null);
    const [editingCrStatus, setEditingCrStatus] = useState<string>('pending');
    const [showCrDeleteConfirm, setShowCrDeleteConfirm] = useState(false);
    const [deletingCrId, setDeletingCrId]       = useState<number | null>(null);

    const sortRef = useRef<HTMLDivElement>(null);

    // ── MultiValue: hide "all" chip ────────────────────────────────────────────
    const MultiValue = (props: any) => {
        if (props.data.value === 'all') return null;
        return <components.MultiValue {...props} />;
    };

    // ── ESC keys ─────────────────────────────────────────────────────────────
    useEscapeKey(() => { setShowModal(false); setEditingId(null); }, showModal);
    useEscapeKey(() => { setShowRemarksModal(false); setSelectedRemarks(''); }, showRemarksModal);
    useEscapeKey(() => setShowDeleteConfirm(false), showDeleteConfirm);
    useEscapeKey(() => setShowCrDetailModal(false), showCrDetailModal);
    useEscapeKey(() => setShowCrDeleteConfirm(false), showCrDeleteConfirm);

    // ── Outside click for sort dropdown ───────────────────────────────────────
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (showSortDropdown && sortRef.current && !sortRef.current.contains(e.target as Node))
                setShowSortDropdown(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [showSortDropdown]);

    // ── Initial load ──────────────────────────────────────────────────────────
    useEffect(() => {
        Promise.all([fetchAllData(), fetchAllowedDates()]);
    }, []);

    // ── Resolve college ───────────────────────────────────────────────────────
    useEffect(() => {
        const resolveCollege = async () => {
            if (!user?.user_id) return;
            try {
                const { data: roles } = await api.get('/tbl_user_role', { params: { user_id: user.user_id } });
                const schedulerRole = Array.isArray(roles)
                    ? roles.find((r: any) => r.role_id === 3 || r.role === 3) : roles;
                setSchedulerCollegeId(schedulerRole?.college_id ?? schedulerRole?.college ?? null);
            } catch { /* silent */ }
        };
        resolveCollege();
    }, [user?.user_id]);

    useEffect(() => { if (schedulerCollegeId) fetchChangeRequests(); }, [schedulerCollegeId, crFilter]);

    useEffect(() => {
        if (!schedulerCollegeId) return;
        const poll = async () => {
            if (document.hidden) return;
            try {
                const { data } = await api.get('/tbl_availability/', { params: { college_id: schedulerCollegeId, status: 'pending', type: 'change_request' } });
                setPendingCrCount(Array.isArray(data) ? data.length : 0);
            } catch { /* silent */ }
        };
        poll();
        const iv = setInterval(poll, 60000);
        return () => clearInterval(iv);
    }, [schedulerCollegeId]);

    useEffect(() => { setCurrentPage(1); }, [searchTerm, sortBy]);

    // ── Fetch ─────────────────────────────────────────────────────────────────

    const fetchAllData = async () => {
        if (!user?.user_id) return;
        setLoading(true);
        try {
            const { data: schedulerRoles } = await api.get('/tbl_user_role', { params: { user_id: user.user_id, role_id: 3 } });
            const schedulerRole = Array.isArray(schedulerRoles)
                ? schedulerRoles.find((r: any) => r.role_id === 3 || r.role === 3) : schedulerRoles;
            const collegeId = schedulerRole?.college_id ?? schedulerRole?.college;
            if (!collegeId) { toast.error('Scheduler college not found'); return; }

            const [availabilityRes, proctorRolesRes] = await Promise.all([
                api.get('/tbl_availability/', { params: { college_id: collegeId } }),
                api.get('/tbl_user_role', { params: { role_id: 5, college_id: collegeId } }),
            ]);

            const allAvailability: any[] = Array.isArray(availabilityRes.data) ? availabilityRes.data : [];
            const proctorRoles: any[]    = Array.isArray(proctorRolesRes.data) ? proctorRolesRes.data : [];

            const proctorUserIds     = [...new Set(proctorRoles.map((p: any) => p.user_id).filter(Boolean))];
            const availabilityUserIds = [...new Set(allAvailability.map((a: any) => a.user_id).filter(Boolean))];
            const allUserIds          = [...new Set([...proctorUserIds, ...availabilityUserIds])];

            let userData: any[] = [];
            if (allUserIds.length > 0) {
                const { data } = await api.get('/users/bulk/', { params: { ids: allUserIds.join(',') } });
                userData = Array.isArray(data) ? data : [];
            }

            const newCache = new Map<number, any>();
            userData.forEach(u => newCache.set(u.user_id, u));
            setUserCache(newCache);

            const uniqueProctors = proctorRoles.reduce((acc: any[], cur: any) => {
                if (!acc.find(p => p.user_id === cur.user_id)) acc.push(cur);
                return acc;
            }, []);

            setInstructors(uniqueProctors.map((p: any) => {
                const ud = newCache.get(p.user_id);
                if (!ud) return null;
                return { value: p.user_id, label: `${ud.first_name ?? ''} ${ud.last_name ?? ''}`.trim() };
            }).filter(Boolean));

            const regularAvailability = allAvailability.filter((e: any) => !e.type || e.type !== 'change_request');
            setEntries(regularAvailability.map((entry: any) => {
                const ud = newCache.get(entry.user_id);
                return {
                    availability_id: entry.availability_id,
                    days:       Array.isArray(entry.days) ? entry.days : [],
                    time_slots: Array.isArray(entry.time_slots) ? entry.time_slots : [],
                    status:     entry.status,
                    remarks:    entry.remarks,
                    user_id:    entry.user_id,
                    user_fullname: ud ? `${ud.first_name ?? ''} ${ud.last_name ?? ''}`.trim() : 'Unknown User',
                };
            }));
            setSchedulerCollegeId(collegeId);
        } catch {
            toast.error('Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    const fetchAllowedDates = async () => {
        try {
            const { data: roles } = await api.get('/tbl_user_role', { params: { user_id: user.user_id } });
            const schedulerRole = Array.isArray(roles)
                ? roles.find((r: any) => r.role_id === 3 || r.role === 3) : roles;
            if (!schedulerRole) return;
            const collegeId = schedulerRole.college_id || schedulerRole.college;
            const { data: allPeriods } = await api.get('/tbl_examperiod');
            if (!Array.isArray(allPeriods)) { setAllowedDates([]); return; }
            const periods = allPeriods.filter((p: any) => String(p.college_id) === String(collegeId));
            const dates: string[] = [];
            periods.forEach((period: any) => {
                if (!period.start_date || !period.end_date) return;
                const start = new Date(period.start_date);
                const end   = new Date(period.end_date);
                for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1))
                    dates.push(formatLocal(new Date(d)));
            });
            dates.sort();
            setAllowedDates(dates);
            const todayStr = formatLocal(new Date());
            setSelectedDate(dates.includes(todayStr) ? [todayStr] : []);
        } catch {
            setAllowedDates([]);
        }
    };

    const fetchChangeRequests = async () => {
        if (!schedulerCollegeId) return;
        setCrLoading(true);
        try {
            const params: Record<string, any> = { college_id: schedulerCollegeId, type: 'change_request' };
            if (crFilter !== 'all') params.status = crFilter;
            const { data } = await api.get('/tbl_availability/', { params });
            if (!Array.isArray(data)) { setChangeRequests([]); return; }

            const missingIds = [...new Set(data.map((item: any) => item.user_id).filter((id: number) => id && !userCache.has(id)))];
            if (missingIds.length > 0) {
                try {
                    const { data: bulkUsers } = await api.get('/users/bulk/', { params: { ids: missingIds.join(',') } });
                    if (Array.isArray(bulkUsers)) {
                        setUserCache(prev => { const m = new Map(prev); bulkUsers.forEach((u: any) => m.set(u.user_id, u)); return m; });
                        bulkUsers.forEach((u: any) => userCache.set(u.user_id, u));
                    }
                } catch { /* silent */ }
            }

            const enriched: ChangeRequest[] = data.map((item: any) => {
                const cached = userCache.get(item.user_id);
                return {
                    id: item.id ?? item.availability_id,
                    user_id: item.user_id,
                    proctor_name: cached ? `${cached.first_name ?? ''} ${cached.last_name ?? ''}`.trim() : `Proctor #${item.user_id}`,
                    days:       Array.isArray(item.days) ? item.days : [],
                    time_slots: Array.isArray(item.time_slots) ? item.time_slots : [],
                    status:     item.status ?? 'pending',
                    requested_status: item.requested_status ?? null,
                    remarks:    item.remarks ?? null,
                    created_at: item.created_at,
                    type:       item.type,
                };
            });
            setChangeRequests(enriched);
            if (crFilter === 'all') setPendingCrCount(enriched.filter(r => r.status === 'pending').length);
        } catch {
            setChangeRequests([]);
        } finally {
            setCrLoading(false);
        }
    };

    // ── Calendar helpers ──────────────────────────────────────────────────────

    const formatLocal = (date: Date) => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    const daysInMonth    = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
    const firstDayOfMonth = (y: number, m: number) => new Date(y, m, 1).getDay();
    const getCalendarDays = () => {
        const y = currentMonth.getFullYear(), m = currentMonth.getMonth();
        const arr: (number | null)[] = [];
        for (let i = 0; i < firstDayOfMonth(y, m); i++) arr.push(null);
        for (let i = 1; i <= daysInMonth(y, m); i++) arr.push(i);
        return arr;
    };

    const handleDateSelect = (day: number | null) => {
        if (!day) return;
        const iso = formatLocal(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day));
        if (allowedDates.length > 0 && !allowedDates.includes(iso)) return;
        setSelectedDate(prev => prev.includes(iso) ? prev.filter(d => d !== iso) : [...prev, iso]);
    };

    const goToPreviousMonth = () => setCurrentMonth(p => new Date(p.getFullYear(), p.getMonth() - 1, 1));
    const goToNextMonth     = () => setCurrentMonth(p => new Date(p.getFullYear(), p.getMonth() + 1, 1));
    const goToToday = () => {
        const isoToday = formatLocal(new Date());
        setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1));
        setSelectedDate(allowedDates.includes(isoToday) ? [isoToday] : []);
    };

    // ── CRUD ──────────────────────────────────────────────────────────────────

    const openAddModal = () => {
        setEditingId(null);
        setSelectedInstructors([]);
        setSelectedInstructorSingle(null);
        setRemarks('');
        setShowModal(true);
    };

    const openEditModal = (entry: Availability) => {
        setEditingId(entry.availability_id);
        setSelectedDate(entry.days);
        setSelectedTimeSlot(entry.time_slots);
        setAvailabilityStatus(entry.status);
        setRemarks(entry.remarks || '');
        setSelectedInstructorSingle(instructors.find(i => i.value === entry.user_id) || null);
        setShowModal(true);
    };

    const handleSubmitAvailability = async () => {
        if (!selectedDate.length) { toast.error('Select a valid date.'); return; }
        setIsSubmitting(true);
        try {
            if (editingId) {
                await api.put(`/tbl_availability/${editingId}/`, {
                    days: selectedDate, time_slots: selectedTimeSlot,
                    status: availabilityStatus, remarks: remarks || null,
                    user_id: selectedInstructorSingle?.value,
                });
                toast.success('Updated!');
            } else {
                if (!selectedInstructors.length) { toast.error('Select at least one instructor.'); setIsSubmitting(false); return; }
                await Promise.all(selectedInstructors.map(inst =>
                    api.post('/tbl_availability/', { days: selectedDate, time_slots: selectedTimeSlot, status: availabilityStatus, remarks: remarks || null, user_id: inst.value })
                ));
                toast.success('Availability submitted!');
            }
            setShowModal(false);
            fetchAllData();
        } catch (err: any) {
            toast.error(`Failed: ${err?.message || 'Unknown error'}`);
        } finally { setIsSubmitting(false); }
    };

    const handleBulkDelete = () => {
        if (!selectedAvailabilityIds.size) { toast.info('No entries selected'); return; }
        setDeleteCount(selectedAvailabilityIds.size);
        setShowDeleteConfirm(true);
    };

    const confirmDelete = async () => {
        const ids = Array.from(selectedAvailabilityIds);
        setShowDeleteConfirm(false);
        setIsBulkDeleting(true);
        try {
            const results = await Promise.allSettled(ids.map(id => api.delete(`/tbl_availability/${id}/`)));
            const ok   = results.filter(r => r.status === 'fulfilled').length;
            const fail = results.length - ok;
            if (ok)   toast.success(`Deleted ${ok} entr${ok === 1 ? 'y' : 'ies'}`);
            if (fail) toast.error(`${fail} failed to delete`);
            setSelectedAvailabilityIds(new Set());
            fetchAllData();
        } catch { toast.error('Bulk delete failed'); }
        finally { setIsBulkDeleting(false); }
    };

    // ── Change request actions ────────────────────────────────────────────────

    const handleCrDelete = (crId: number) => { setDeletingCrId(crId); setShowCrDeleteConfirm(true); };

    const confirmCrDelete = async () => {
        if (!deletingCrId) return;
        setProcessingCrId(deletingCrId);
        setShowCrDeleteConfirm(false);
        try {
            await api.delete(`/tbl_availability/${deletingCrId}/`);
            toast.success('Change request deleted.');
            setChangeRequests(prev => prev.filter(r => r.id !== deletingCrId));
            if (showCrDetailModal && selectedCr?.id === deletingCrId) { setShowCrDetailModal(false); setSelectedCr(null); }
            setPendingCrCount(prev => {
                const deleted = changeRequests.find(r => r.id === deletingCrId);
                return deleted?.status === 'pending' ? Math.max(0, prev - 1) : prev;
            });
        } catch (err: any) { toast.error(`Failed: ${err?.message ?? 'Unknown error'}`); }
        finally { setProcessingCrId(null); setDeletingCrId(null); }
    };

    const handleCrEditSave = async () => {
        if (!editingCrId) return;
        setProcessingCrId(editingCrId);
        try {
            await api.patch(`/tbl_availability/${editingCrId}/`, { status: editingCrStatus });
            toast.success('Updated.');
            setChangeRequests(prev => prev.map(r => r.id === editingCrId ? { ...r, status: editingCrStatus } : r));
            if (showCrDetailModal && selectedCr?.id === editingCrId)
                setSelectedCr(prev => prev ? { ...prev, status: editingCrStatus } : null);
            const oldCr = changeRequests.find(r => r.id === editingCrId);
            if (oldCr?.status === 'pending' && editingCrStatus !== 'pending') setPendingCrCount(p => Math.max(0, p - 1));
            else if (oldCr?.status !== 'pending' && editingCrStatus === 'pending') setPendingCrCount(p => p + 1);
            setEditingCrId(null);
        } catch (err: any) { toast.error(`Failed: ${err?.message ?? 'Unknown error'}`); }
        finally { setProcessingCrId(null); }
    };

    const handleCrAction = async (crId: number, newStatus: 'approved' | 'rejected') => {
        setProcessingCrId(crId);
        try {
            const cr = changeRequests.find(r => r.id === crId);
            if (!cr) { toast.error('Change request not found.'); return; }

            await api.patch(`/tbl_availability/${crId}/`, { status: newStatus });

            if (newStatus === 'approved') {
                const targetStatus = cr.requested_status;
                if (!targetStatus) { toast.error('No requested status found.'); }
                else {
                    try {
                        const { data: existingAvailability } = await api.get('/tbl_availability/', { params: { user_id: cr.user_id } });
                        if (Array.isArray(existingAvailability) && existingAvailability.length > 0) {
                            const realAvailability = existingAvailability.filter((e: any) => !e.type || e.type !== 'change_request');
                            const matchingEntries  = realAvailability.filter((e: any) => {
                                const eDays  = Array.isArray(e.days) ? e.days : [];
                                const eSlots = Array.isArray(e.time_slots) ? e.time_slots : [];
                                return cr.days.some(d => eDays.includes(d)) && cr.time_slots.some(s => eSlots.includes(s));
                            });
                            if (matchingEntries.length > 0) {
                                const updatePromises: Promise<any>[] = [];
                                for (const entry of matchingEntries) {
                                    const eDays  = Array.isArray(entry.days) ? entry.days : [];
                                    const eSlots = Array.isArray(entry.time_slots) ? entry.time_slots : [];
                                    const affectedDays   = eDays.filter((d: string) => cr.days.includes(d));
                                    const unaffectedDays = eDays.filter((d: string) => !cr.days.includes(d));
                                    const affectedSlots   = eSlots.filter((s: string) => cr.time_slots.includes(s));
                                    const unaffectedSlots = eSlots.filter((s: string) => !cr.time_slots.includes(s));
                                    const isFullMatch = unaffectedDays.length === 0 && unaffectedSlots.length === 0;
                                    if (isFullMatch) {
                                        updatePromises.push(api.patch(`/tbl_availability/${entry.availability_id}/`, { status: targetStatus }));
                                    } else {
                                        updatePromises.push((async () => {
                                            await api.delete(`/tbl_availability/${entry.availability_id}/`);
                                            const creates: Promise<any>[] = [];
                                            for (const day of affectedDays) for (const slot of affectedSlots)
                                                creates.push(api.post('/tbl_availability/', { user_id: cr.user_id, days: [day], time_slots: [slot], status: targetStatus, remarks: entry.remarks || null }));
                                            for (const day of unaffectedDays) for (const slot of eSlots)
                                                creates.push(api.post('/tbl_availability/', { user_id: cr.user_id, days: [day], time_slots: [slot], status: entry.status, remarks: entry.remarks || null }));
                                            for (const day of affectedDays) for (const slot of unaffectedSlots)
                                                creates.push(api.post('/tbl_availability/', { user_id: cr.user_id, days: [day], time_slots: [slot], status: entry.status, remarks: entry.remarks || null }));
                                            await Promise.allSettled(creates);
                                        })());
                                    }
                                }
                                await Promise.allSettled(updatePromises);
                            }
                        }
                    } catch { toast.error('Approved, but failed to update availability.'); }
                }
            }

            if (cr.user_id) {
                try {
                    const schedulerName = (user as any)?.full_name ?? `${(user as any)?.first_name ?? ''} ${(user as any)?.last_name ?? ''}`.trim() ?? 'Your scheduler';
                    const dateLabels = cr.days.map(d => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })).join(', ');
                    const message = newStatus === 'approved'
                        ? `Your availability change request for ${dateLabels} (${cr.time_slots.join(', ')}) has been approved by ${schedulerName}.`
                        : `Your availability change request for ${dateLabels} (${cr.time_slots.join(', ')}) has been rejected by ${schedulerName}.`;
                    await api.post('/notifications/create/', { user_id: cr.user_id, message, type: `change_request_${newStatus}`, is_seen: false });
                } catch { /* silent */ }
            }

            toast.success(`Request ${newStatus} successfully.`);
            setChangeRequests(prev => prev.map(r => r.id === crId ? { ...r, status: newStatus } : r));
            if (showCrDetailModal && selectedCr?.id === crId)
                setSelectedCr(prev => prev ? { ...prev, status: newStatus } : null);
            setPendingCrCount(p => Math.max(0, p - 1));
            fetchAllData();
        } catch (err: any) { toast.error(`Failed: ${err?.message ?? 'Unknown error'}`); }
        finally { setProcessingCrId(null); }
    };

    // ── Instructor multi-select "select all" ──────────────────────────────────
    const instructorOptions = [{ label: 'Select All', value: 'all' }, ...instructors];
    const handleMultiChange = (selected: any) => {
        if (selected?.find((s: any) => s.value === 'all')) setSelectedInstructors(instructors);
        else setSelectedInstructors(selected || []);
    };

    // ── Filtered / sorted / merged entries ───────────────────────────────────

    const isNumeric = (s: string) => !isNaN(Number(s)) && !isNaN(parseFloat(s));
    const smartSort = (a: string, b: string) => {
        if (isNumeric(a) && isNumeric(b)) return parseFloat(a) - parseFloat(b);
        if (isNumeric(a)) return -1; if (isNumeric(b)) return 1;
        return a.localeCompare(b);
    };

    const filteredEntries = useMemo(() => {
        let res = entries.filter(e => (e.user_fullname || '').toLowerCase().includes(searchTerm.toLowerCase()));
        if (sortBy === 'proctor_name') res = [...res].sort((a, b) => smartSort((a.user_fullname || '').toLowerCase(), (b.user_fullname || '').toLowerCase()));
        if (sortBy === 'day')        res = [...res].sort((a, b) => (a.days[0] ? new Date(a.days[0]).getTime() : 0) - (b.days[0] ? new Date(b.days[0]).getTime() : 0));
        if (sortBy === 'time_slot')  res = [...res].sort((a, b) => smartSort(a.time_slots[0] || '', b.time_slots[0] || ''));
        if (sortBy === 'status')     res = [...res].sort((a, b) => smartSort(a.status, b.status));
        if (sortBy === 'remarks')    res = [...res].sort((a, b) => smartSort(a.remarks || '', b.remarks || ''));
        return res;
    }, [entries, searchTerm, sortBy]);

    const mergedEntries = useMemo(() => {
      const slotOrder = Object.values(AvailabilityTimeSlot);

      // Step 1: Explode every entry into atomic (user_id, day, slot, status, remarks, id) units
      type Atom = {
          user_id: number; user_fullname: string; day: string;
          slot: AvailabilityTimeSlot; status: AvailabilityStatus;
          remarks: string | null; id: number;
      };
      const atoms: Atom[] = [];
      filteredEntries.forEach(entry => {
          entry.days.forEach(day => {
              entry.time_slots.forEach(slot => {
                  atoms.push({
                      user_id: entry.user_id,
                      user_fullname: entry.user_fullname || 'Unknown',
                      day, slot,
                      status: entry.status,
                      remarks: entry.remarks ?? null,
                      id: entry.availability_id,
                  });
              });
          });
      });

      // Step 2: Per (user + day), group atoms by status → collect slots + ids
      type DayGroup = { status: AvailabilityStatus; slots: Set<AvailabilityTimeSlot>; ids: Set<number>; remarks: string | null };
      const byUserDay = new Map<string, Map<AvailabilityStatus, DayGroup>>();

      atoms.forEach(a => {
          const key = `${a.user_id}__${a.day}`;
          if (!byUserDay.has(key)) byUserDay.set(key, new Map());
          const sm = byUserDay.get(key)!;
          if (!sm.has(a.status)) sm.set(a.status, { status: a.status, slots: new Set(), ids: new Set(), remarks: a.remarks });
          const g = sm.get(a.status)!;
          g.slots.add(a.slot);
          g.ids.add(a.id);
      });

      // Step 3: Build per-user (day, status, sorted-slots) tuples
      type DayTuple = { day: string; status: AvailabilityStatus; slots: AvailabilityTimeSlot[]; ids: number[]; remarks: string | null };
      const byUser = new Map<number, { fullname: string; tuples: DayTuple[] }>();

      byUserDay.forEach((sm, key) => {
          const [userIdStr, day] = key.split('__');
          const userId = Number(userIdStr);
          const fullname = atoms.find(a => a.user_id === userId)?.user_fullname ?? 'Unknown';
          if (!byUser.has(userId)) byUser.set(userId, { fullname, tuples: [] });
          sm.forEach(g => {
              const sortedSlots = [...g.slots].sort((a, b) => slotOrder.indexOf(a) - slotOrder.indexOf(b));
              byUser.get(userId)!.tuples.push({ day, status: g.status, slots: sortedSlots, ids: [...g.ids], remarks: g.remarks });
          });
      });

      // Step 4: Within each user, merge days that have IDENTICAL (status + slot fingerprint)
      type MergedRow = Availability & { _ids: number[] };
      const result: MergedRow[] = [];

      byUser.forEach(({ fullname, tuples }, userId) => {
          const fingerGroups = new Map<string, { days: Set<string>; status: AvailabilityStatus; slots: AvailabilityTimeSlot[]; ids: Set<number>; remarks: string | null }>();
          tuples.forEach(t => {
              const finger = `${t.status}__${t.slots.join('|')}`;
              if (!fingerGroups.has(finger)) fingerGroups.set(finger, { days: new Set(), status: t.status, slots: t.slots, ids: new Set(), remarks: t.remarks });
              const fg = fingerGroups.get(finger)!;
              fg.days.add(t.day);
              t.ids.forEach(id => fg.ids.add(id));
          });

          fingerGroups.forEach(fg => {
              const idsArr = [...fg.ids];
              result.push({
                  user_id: userId,
                  user_fullname: fullname,
                  days: [...fg.days].sort(),
                  time_slots: fg.slots,
                  status: fg.status,
                  remarks: fg.remarks,
                  _ids: idsArr,
                  availability_id: idsArr[0],
              });
          });
      });

      // Step 5: Sort by name → first day → available-first
      result.sort((a, b) => {
        const nc = (a.user_fullname ?? '').localeCompare(b.user_fullname ?? '');
        if (nc !== 0) return nc;
        const dc = (a.days[0] || '').localeCompare(b.days[0] || '');
        if (dc !== 0) return dc;
        if (a.status === 'available' && b.status !== 'available') return -1;
        if (a.status !== 'available' && b.status === 'available') return 1;
        return slotOrder.indexOf(a.time_slots[0]) - slotOrder.indexOf(b.time_slots[0]);
    });

      return result;
  }, [filteredEntries]);

    const totalPages = Math.max(1, Math.ceil(mergedEntries.length / itemsPerPage));
    const paginated  = mergedEntries.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    const isAllSelected = mergedEntries.length > 0 && mergedEntries.every(e => (e._ids ?? [e.availability_id]).every(id => selectedAvailabilityIds.has(id)));
    const toggleSelectAll = () => {
        if (isAllSelected) { setSelectedAvailabilityIds(new Set()); return; }
        const all = new Set<number>();
        mergedEntries.forEach(e => (e._ids ?? [e.availability_id]).forEach(id => all.add(id)));
        setSelectedAvailabilityIds(all);
    };

    const filteredCr = useMemo(() =>
        changeRequests.filter(r => (r.proctor_name ?? '').toLowerCase().includes(crSearchTerm.toLowerCase())),
        [changeRequests, crSearchTerm]
    );

    const formatDate = (iso: string) => {
        try { return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
        catch { return iso; }
    };

    const crStatusBadge = (status: string) => {
        const map: Record<string, string> = { pending: 'cl-status-pending', approved: 'cl-status-available', rejected: 'cl-status-unavailable' };
        return map[status.toLowerCase()] ?? 'cl-status-pending';
    };

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <div className="cl-page">

            {/* ── Page Header ── */}
            <div className="cl-page-header">
                <div className="cl-page-header-left">
                    <div className="cl-page-icon">
                        <FaUsers size={20} />
                    </div>
                    <div className="cl-page-title">
                        <h1>Proctor Availability</h1>
                        <p>{entries.length} entr{entries.length !== 1 ? 'ies' : 'y'} · {pendingCrCount > 0 ? `${pendingCrCount} pending request${pendingCrCount > 1 ? 's' : ''}` : 'no pending requests'}</p>
                    </div>
                </div>

                <div className="cl-page-actions">
                    {activeTab === 'availability' && (
                        <>
                            <div className="cl-search-bar">
                                <FaSearch className="cl-search-icon" />
                                <input type="text" placeholder="Search proctor…" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                            </div>
                            <button type="button" className="cl-btn primary" onClick={openAddModal}>
                                <FaPlus style={{ fontSize: '11px' }} /> Add
                            </button>
                            <button type="button" className="cl-btn danger"
                                onClick={handleBulkDelete}
                                disabled={isBulkDeleting || selectedAvailabilityIds.size === 0}
                                title={selectedAvailabilityIds.size > 0 ? `Delete ${selectedAvailabilityIds.size} selected` : 'Select entries to delete'}>
                                <FaTrash style={{ fontSize: '11px' }} />
                                {selectedAvailabilityIds.size > 0 && <span>({selectedAvailabilityIds.size})</span>}
                            </button>
                        </>
                    )}
                    {activeTab === 'change-requests' && (
                        <div className="cl-search-bar">
                            <FaSearch className="cl-search-icon" />
                            <input type="text" placeholder="Search proctor…" value={crSearchTerm} onChange={e => setCrSearchTerm(e.target.value)} />
                        </div>
                    )}
                </div>
            </div>

            {/* ── Tabs ── */}
            <div className="cl-tabs">
                <button type="button" className={`cl-tab${activeTab === 'availability' ? ' active' : ''}`} onClick={() => setActiveTab('availability')}>
                    <FaUsers style={{ fontSize: '12px' }} />
                    Proctor Availability
                    <span className="cl-tab-badge">{entries.length}</span>
                </button>
                <button type="button"
                    className={`cl-tab${activeTab === 'change-requests' ? ' active' : ''}${pendingCrCount > 0 && activeTab !== 'change-requests' ? ' cl-tab-alert' : ''}`}
                    onClick={() => { setActiveTab('change-requests'); fetchChangeRequests(); }}>
                    <FaExchangeAlt style={{ fontSize: '12px' }} />
                    Change Requests
                    {pendingCrCount > 0 && (
                        <span className="cl-tab-badge cl-tab-badge-alert">{pendingCrCount}</span>
                    )}
                </button>
            </div>

            {/* ══════════════ AVAILABILITY TAB ══════════════ */}
            {activeTab === 'availability' && (
                <>
                    {/* Toolbar */}
                    <div className="cl-toolbar">
                        <div className="cl-toolbar-left">
                            {/* Sort */}
                            <div ref={sortRef} style={{ position: 'relative' }} data-sort-dropdown>
                                <button type="button" className="cl-toolbar-btn" onClick={() => setShowSortDropdown(v => !v)}>
                                    <FaSort style={{ fontSize: '11px' }} />
                                    Sort{sortBy !== 'none' ? `: ${sortBy === 'proctor_name' ? 'Name' : sortBy === 'day' ? 'Day' : sortBy === 'time_slot' ? 'Slot' : sortBy === 'status' ? 'Status' : 'Remarks'}` : ''}
                                    <FaChevronDown style={{ fontSize: '9px', marginLeft: '2px' }} />
                                </button>
                                {showSortDropdown && (
                                    <div className="cl-dropdown">
                                        {[
                                            { value: 'none',         label: 'None' },
                                            { value: 'proctor_name', label: 'Proctor Name' },
                                            { value: 'day',          label: 'Day' },
                                            { value: 'time_slot',    label: 'Time Slot' },
                                            { value: 'status',       label: 'Status' },
                                            { value: 'remarks',      label: 'Remarks' },
                                        ].map(opt => (
                                            <button key={opt.value} type="button"
                                                className={`cl-dropdown-item${sortBy === opt.value ? ' active' : ''}`}
                                                onClick={() => { setSortBy(opt.value); setShowSortDropdown(false); }}>
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="cl-pagination">
                            <button type="button" className="cl-page-btn" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage <= 1}>←</button>
                            <span className="cl-page-info">{currentPage} / {totalPages}</span>
                            <button type="button" className="cl-page-btn" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages}>→</button>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="cl-table-card">
                        <div className="cl-table-container">
                            <table className="cl-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: '52px' }}>#</th>
                                        <th>Proctor Name</th>
                                        <th>Day</th>
                                        <th>Time Slot</th>
                                        <th style={{ width: '110px' }}>Status</th>
                                        <th style={{ width: '90px', textAlign: 'center' }}>Remarks</th>
                                        <th style={{ width: '120px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                <span>Actions</span>
                                                <input type="checkbox" checked={isAllSelected} onChange={toggleSelectAll}
                                                    disabled={loading || mergedEntries.length === 0} style={{ cursor: 'pointer' }} />
                                            </div>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr><td colSpan={7} className="cl-table-empty"><div className="cl-spinner" /> Loading…</td></tr>
                                    ) : mergedEntries.length === 0 ? (
                                        <tr><td colSpan={7} className="cl-table-empty">No availability entries found.</td></tr>
                                    ) : (
                                        paginated.map((entry, idx) => {
                                            const me = entry as Availability & { _ids: number[] };
                                            const isSelected = (me._ids ?? [me.availability_id]).every(id => selectedAvailabilityIds.has(id));
                                            return (
                                                <tr key={`${entry.user_id}_${entry.days[0]}_${entry.status}_${entry.time_slots[0]}`}
                                                    className={isSelected ? 'selected' : ''}>
                                                    <td className="cl-td-num">{(currentPage - 1) * itemsPerPage + idx + 1}</td>
                                                    <td style={{ fontWeight: 600, color: 'var(--cl-text-primary)' }}>{entry.user_fullname}</td>
                                                    <td style={{ fontFamily: 'var(--cl-mono)', fontSize: '12px' }}>
                                                        {entry.days?.map(d => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })).join(', ')}
                                                    </td>
                                                    <td style={{ fontSize: '12px' }}>{entry.time_slots?.join(', ')}</td>
                                                    <td>
                                                        <span className={`cl-avail-badge ${entry.status === 'available' ? 'available' : 'unavailable'}`}>
                                                            {entry.status === 'available' ? <FaCheckCircle style={{ fontSize: '10px' }} /> : <FaTimesCircle style={{ fontSize: '10px' }} />}
                                                            {entry.status}
                                                        </span>
                                                    </td>
                                                    <td style={{ textAlign: 'center' }}>
                                                        {entry.remarks ? (
                                                            <button type="button" className="cl-icon-btn view"
                                                                onClick={() => { setSelectedRemarks(entry.remarks!); setShowRemarksModal(true); }}>
                                                                <FaEye style={{ fontSize: '10px' }} /> View
                                                            </button>
                                                        ) : <span style={{ color: 'var(--cl-text-muted)', fontSize: '12px' }}>—</span>}
                                                    </td>
                                                    <td>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                            <button type="button" className="cl-icon-btn edit" onClick={() => openEditModal(entry)}>
                                                                <FaPenAlt style={{ fontSize: '10px' }} /> Edit
                                                            </button>
                                                            <input type="checkbox" checked={isSelected}
                                                                onChange={() => {
                                                                    setSelectedAvailabilityIds(prev => {
                                                                        const n = new Set(prev);
                                                                        const ids = me._ids ?? [me.availability_id];
                                                                        if (isSelected) ids.forEach(id => n.delete(id));
                                                                        else ids.forEach(id => n.add(id));
                                                                        return n;
                                                                    });
                                                                }}
                                                                style={{ marginLeft: 'auto', cursor: 'pointer' }} />
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
                </>
            )}

            {/* ══════════════ CHANGE REQUESTS TAB ══════════════ */}
            {activeTab === 'change-requests' && (
                <>
                    {/* Filter pills toolbar */}
                    <div className="cl-toolbar">
                        <div className="cl-toolbar-left" style={{ gap: '6px' }}>
                            {(['all', 'pending', 'approved', 'rejected'] as const).map(f => (
                                <button key={f} type="button"
                                    className={`cl-toolbar-btn${crFilter === f ? ' cl-toolbar-btn-active' : ''}`}
                                    onClick={() => setCrFilter(f)}>
                                    {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
                                    {f === 'pending' && pendingCrCount > 0 && (
                                        <span className="cl-tab-badge cl-tab-badge-alert" style={{ marginLeft: '4px' }}>{pendingCrCount}</span>
                                    )}
                                </button>
                            ))}
                            <button type="button" className="cl-toolbar-btn" onClick={fetchChangeRequests}>↻ Refresh</button>
                        </div>
                    </div>

                    {/* Pending banner */}
                    {pendingCrCount > 0 && (
                        <div className="cl-pending-banner">
                            <FaClock style={{ fontSize: '14px' }} />
                            {pendingCrCount} proctor change request{pendingCrCount > 1 ? 's' : ''} awaiting your review
                        </div>
                    )}

                    {/* Cards */}
                    {crLoading && (
                        <div className="cl-table-card" style={{ padding: '48px', textAlign: 'center' }}>
                            <div className="cl-spinner" style={{ margin: '0 auto' }} />
                        </div>
                    )}

                    {!crLoading && filteredCr.length === 0 && (
                        <div className="cl-table-card" style={{ padding: '56px 24px', textAlign: 'center', color: 'var(--cl-text-muted)' }}>
                            <div style={{ fontSize: '32px', marginBottom: '8px' }}>📋</div>
                            <p style={{ fontWeight: 700, color: 'var(--cl-text-primary)', marginBottom: '4px' }}>No change requests found</p>
                            <p style={{ fontSize: '13px' }}>Proctor change requests for your college will appear here.</p>
                        </div>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {!crLoading && filteredCr.map(req => (
                            <div key={req.id}
                                className={`cl-cr-card${req.status === 'pending' ? ' pending' : req.status === 'approved' ? ' approved' : ' rejected'}`}
                                onClick={() => { if (editingCrId !== req.id) { setSelectedCr(req); setShowCrDetailModal(true); } }}>

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                                    <div style={{ flex: 1 }}>
                                        {/* Header row */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', flexWrap: 'wrap' }}>
                                            <span style={{ fontWeight: 700, color: 'var(--cl-text-primary)', fontSize: '14px' }}>
                                                {req.proctor_name || `Proctor #${req.user_id}`}
                                            </span>
                                            <span className={`cl-avail-badge ${crStatusBadge(req.status)}`}>
                                                {req.status === 'pending'   && <FaClock style={{ fontSize: '10px' }} />}
                                                {req.status === 'approved'  && <FaCheckCircle style={{ fontSize: '10px' }} />}
                                                {req.status === 'rejected'  && <FaTimesCircle style={{ fontSize: '10px' }} />}
                                                {req.status}
                                            </span>
                                        </div>

                                        {/* Detail pills */}
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', fontSize: '12.5px', color: 'var(--cl-text-secondary)', marginBottom: '6px' }}>
                                            <span><strong>Days:</strong> {req.days.map(formatDate).join(', ')}</span>
                                            <span><strong>Slots:</strong> {req.time_slots.join(', ')}</span>
                                            {req.requested_status && <span><strong>Requested:</strong> {req.requested_status}</span>}
                                        </div>

                                        {req.remarks && (
                                            <p style={{ fontSize: '12.5px', color: 'var(--cl-text-muted)', fontStyle: 'italic', margin: '4px 0 0' }}>"{req.remarks}"</p>
                                        )}
                                        {req.created_at && (
                                            <p style={{ fontSize: '11px', color: 'var(--cl-text-muted)', margin: '4px 0 0', fontFamily: 'var(--cl-mono)' }}>
                                                Submitted: {new Date(req.created_at).toLocaleString('en-US')}
                                            </p>
                                        )}

                                        {/* Inline edit */}
                                        {editingCrId === req.id && (
                                            <div className="cl-inline-edit" onClick={e => e.stopPropagation()}>
                                                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--cl-text-secondary)' }}>Change Status:</span>
                                                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                                                    {(['pending', 'approved', 'rejected'] as const).map(s => (
                                                        <button key={s} type="button"
                                                            className={`cl-btn${editingCrStatus === s ? ' primary' : ''}`}
                                                            style={{ height: '30px', fontSize: '12px', padding: '0 12px' }}
                                                            onClick={() => setEditingCrStatus(s)}>
                                                            {s.charAt(0).toUpperCase() + s.slice(1)}
                                                        </button>
                                                    ))}
                                                    <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
                                                        <button type="button" className="cl-btn primary"
                                                            style={{ height: '30px', fontSize: '12px', padding: '0 14px' }}
                                                            onClick={handleCrEditSave} disabled={processingCrId === req.id}>
                                                            {processingCrId === req.id ? 'Saving…' : 'Save'}
                                                        </button>
                                                        <button type="button" className="cl-btn"
                                                            style={{ height: '30px', fontSize: '12px', padding: '0 12px' }}
                                                            onClick={() => setEditingCrId(null)}>
                                                            Cancel
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Action buttons */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end' }}
                                        onClick={e => e.stopPropagation()}>
                                        {req.status === 'pending' && editingCrId !== req.id && (
                                            <div style={{ display: 'flex', gap: '6px' }}>
                                                <button type="button" className="cl-btn"
                                                    style={{ background: 'var(--cl-success)', color: '#fff', borderColor: 'var(--cl-success)', height: '32px', fontSize: '12px' }}
                                                    onClick={() => handleCrAction(req.id, 'approved')} disabled={processingCrId === req.id}>
                                                    <FaCheckCircle style={{ fontSize: '11px' }} /> Approve
                                                </button>
                                                <button type="button" className="cl-btn"
                                                    style={{ background: 'var(--cl-danger)', color: '#fff', borderColor: 'var(--cl-danger)', height: '32px', fontSize: '12px' }}
                                                    onClick={() => handleCrAction(req.id, 'rejected')} disabled={processingCrId === req.id}>
                                                    <FaTimesCircle style={{ fontSize: '11px' }} /> Reject
                                                </button>
                                            </div>
                                        )}
                                        {editingCrId !== req.id && (
                                            <div style={{ display: 'flex', gap: '6px' }}>
                                                <button type="button" className="cl-icon-btn edit"
                                                    onClick={() => { setEditingCrId(req.id); setEditingCrStatus(req.status); }}
                                                    disabled={processingCrId === req.id}>
                                                    <FaPenAlt style={{ fontSize: '10px' }} /> Edit
                                                </button>
                                                <button type="button" className="cl-icon-btn"
                                                    style={{ color: 'var(--cl-danger)', borderColor: 'var(--cl-danger)' }}
                                                    onClick={() => handleCrDelete(req.id)} disabled={processingCrId === req.id}>
                                                    <FaTrash style={{ fontSize: '10px' }} />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}

            {/* ════ ADD / EDIT AVAILABILITY MODAL ════ */}
            {showModal && (
                <div className="cl-modal-overlay" style={{ zIndex: 10002 }} onClick={() => { setShowModal(false); setEditingId(null); }}>
                    <div className="cl-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
                        <div className="cl-modal-header">
                            <h3>{editingId ? 'Edit Availability' : 'Add Availability'}</h3>
                        </div>
                        <div className="cl-modal-body">

                            {/* Date picker */}
                            <div className="cl-field">
                                <label>Days</label>
                                <input type="text" className="cl-input" readOnly
                                    value={selectedDate.length > 0 ? selectedDate.map(d => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })).join(', ') : 'Click to select date(s)'}
                                    onClick={() => allowedDates.length > 0 && setShowDatePicker(v => !v)}
                                    style={{ cursor: 'pointer' }} />
                                {showDatePicker && (
                                    <div className="cl-calendar">
                                        <div className="cl-calendar-header">
                                            <button type="button" className="cl-cal-nav" onClick={goToPreviousMonth}><FaChevronLeft /></button>
                                            <span>{currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
                                            <button type="button" className="cl-cal-nav" onClick={goToNextMonth}><FaChevronRight /></button>
                                        </div>
                                        <div className="cl-calendar-grid">
                                            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                                                <div key={d} className="cl-cal-dayname">{d}</div>
                                            ))}
                                            {getCalendarDays().map((day, idx) => {
                                                const iso = day ? formatLocal(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day)) : '';
                                                const isAllowed  = allowedDates.includes(iso);
                                                const isSelected = selectedDate.includes(iso);
                                                return (
                                                    <div key={idx}
                                                        className={`cl-cal-day${!day ? ' empty' : ''}${isSelected ? ' selected' : ''}${day && !isAllowed ? ' disabled' : ''}`}
                                                        onClick={() => isAllowed && handleDateSelect(day)}>
                                                        {day}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        <div className="cl-calendar-footer">
                                            <button type="button" className="cl-btn" style={{ flex: 1, justifyContent: 'center' }} onClick={goToToday}>Today</button>
                                            <button type="button" className="cl-btn primary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setShowDatePicker(false)}>Done</button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Time slot */}
                            <div className="cl-field">
                                <label>Time Slot</label>
                                <Select
                                    options={Object.values(AvailabilityTimeSlot).map(ts => ({ label: ts, value: ts }))}
                                    value={selectedTimeSlot.map(ts => ({ label: ts, value: ts }))}
                                    onChange={(sel: any) => setSelectedTimeSlot(sel.map((s: any) => s.value))}
                                    isMulti closeMenuOnSelect={false} components={{ MultiValue }}
                                    styles={selectStyles} menuPortalTarget={document.body} menuPosition="fixed"
                                />
                            </div>

                            {/* Remarks */}
                            <div className="cl-field">
                                <label>Remarks</label>
                                <textarea className="cl-input" value={remarks} onChange={e => setRemarks(e.target.value)}
                                    style={{ resize: 'vertical', minHeight: '72px', height: 'auto' }} />
                            </div>

                            {/* Edit-only: status + single instructor */}
                            {editingId ? (
                                <>
                                    <div className="cl-field">
                                        <label>Status</label>
                                        <Select
                                            options={Object.values(AvailabilityStatus).map(s => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) }))}
                                            value={{ value: availabilityStatus, label: availabilityStatus.charAt(0).toUpperCase() + availabilityStatus.slice(1) }}
                                            onChange={(sel: any) => setAvailabilityStatus(sel?.value as AvailabilityStatus)}
                                            styles={selectStyles} menuPortalTarget={document.body} menuPosition="fixed" isSearchable={false}
                                        />
                                    </div>
                                    <div className="cl-field">
                                        <label>Instructor</label>
                                        <Select options={instructors} value={selectedInstructorSingle}
                                            onChange={v => setSelectedInstructorSingle(v)}
                                            styles={selectStyles} menuPortalTarget={document.body} menuPosition="fixed" />
                                    </div>
                                </>
                            ) : (
                                <div className="cl-field">
                                    <label>Instructors</label>
                                    <Select options={instructorOptions} value={selectedInstructors}
                                        onChange={handleMultiChange} isMulti closeMenuOnSelect={false}
                                        components={{ MultiValue }}
                                        styles={selectStyles} menuPortalTarget={document.body} menuPosition="fixed"
                                        placeholder="Select instructor(s)…" />
                                </div>
                            )}
                        </div>
                        <div className="cl-modal-footer">
                            <button type="button" className="cl-btn" onClick={() => { setShowModal(false); setEditingId(null); }} disabled={isSubmitting}>Cancel</button>
                            <button type="button" className="cl-btn primary" onClick={handleSubmitAvailability} disabled={isSubmitting}>
                                {isSubmitting ? 'Saving…' : 'Save'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ════ REMARKS MODAL ════ */}
            {showRemarksModal && (
                <div className="cl-modal-overlay" style={{ zIndex: 10002 }} onClick={() => setShowRemarksModal(false)}>
                    <div className="cl-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '380px' }}>
                        <div className="cl-modal-header"><h3>Remarks</h3></div>
                        <div className="cl-modal-body">
                            <p style={{ fontSize: '13.5px', color: 'var(--cl-text-secondary)', lineHeight: 1.7, margin: 0 }}>{selectedRemarks}</p>
                        </div>
                        <div className="cl-modal-footer">
                            <button type="button" className="cl-btn primary" onClick={() => setShowRemarksModal(false)}>Close</button>
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
                                You are about to delete <strong>{deleteCount}</strong> availability {deleteCount === 1 ? 'entry' : 'entries'}. This cannot be undone.
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

            {/* ════ CR DELETE CONFIRM MODAL ════ */}
            {showCrDeleteConfirm && (
                <div className="cl-modal-overlay" onClick={() => setShowCrDeleteConfirm(false)}>
                    <div className="cl-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '380px' }}>
                        <div className="cl-modal-header"><h3>Delete Change Request?</h3></div>
                        <div className="cl-modal-body">
                            <p style={{ fontSize: '13.5px', color: 'var(--cl-text-secondary)', lineHeight: 1.7, margin: 0 }}>
                                This will permanently remove the change request. This action cannot be undone.
                            </p>
                        </div>
                        <div className="cl-modal-footer">
                            <button type="button" className="cl-btn" onClick={() => { setShowCrDeleteConfirm(false); setDeletingCrId(null); }} disabled={processingCrId === deletingCrId}>Cancel</button>
                            <button type="button" className="cl-btn danger-fill" onClick={confirmCrDelete} disabled={processingCrId === deletingCrId}>
                                {processingCrId === deletingCrId ? 'Deleting…' : 'Yes, Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ════ CR DETAIL MODAL ════ */}
            {showCrDetailModal && selectedCr && (
                <div className="cl-modal-overlay" style={{ zIndex: 10002 }} onClick={() => setShowCrDetailModal(false)}>
                    <div className="cl-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
                        <div className="cl-modal-header">
                            <h3>Change Request Details</h3>
                        </div>
                        <div className="cl-modal-body">
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13.5px' }}>
                                <tbody>
                                    {([
                                        ['Proctor',   selectedCr.proctor_name || `#${selectedCr.user_id}`],
                                        ['Days',      selectedCr.days.map(formatDate).join(', ')],
                                        ['Time Slots', selectedCr.time_slots.join(', ')],
                                        ['Status',    selectedCr.status],
                                        ['Remarks',   selectedCr.remarks || '—'],
                                        ['Submitted', selectedCr.created_at ? new Date(selectedCr.created_at).toLocaleString('en-US') : '—'],
                                    ] as [string, string][]).map(([label, value]) => (
                                        <tr key={label} style={{ borderBottom: '1px solid var(--cl-surface-3)' }}>
                                            <td style={{ padding: '9px 4px', fontWeight: 600, color: 'var(--cl-text-secondary)', width: '38%', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.4px', fontFamily: 'var(--cl-mono)' }}>{label}</td>
                                            <td style={{ padding: '9px 4px', color: 'var(--cl-text-primary)' }}>
                                                {label === 'Status'
                                                    ? <span className={`cl-avail-badge ${crStatusBadge(value)}`}>{value}</span>
                                                    : value}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="cl-modal-footer">
                            {selectedCr.status === 'pending' ? (
                                <>
                                    <button type="button" className="cl-btn"
                                        style={{ background: 'var(--cl-danger)', color: '#fff', borderColor: 'var(--cl-danger)' }}
                                        onClick={() => handleCrAction(selectedCr.id, 'rejected')} disabled={processingCrId === selectedCr.id}>
                                        <FaTimesCircle style={{ fontSize: '11px' }} /> Reject
                                    </button>
                                    <button type="button" className="cl-btn"
                                        style={{ background: 'var(--cl-success)', color: '#fff', borderColor: 'var(--cl-success)' }}
                                        onClick={() => handleCrAction(selectedCr.id, 'approved')} disabled={processingCrId === selectedCr.id}>
                                        <FaCheckCircle style={{ fontSize: '11px' }} /> Approve
                                    </button>
                                </>
                            ) : (
                                <button type="button" className="cl-btn primary" onClick={() => setShowCrDetailModal(false)}>Close</button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <ToastContainer position="top-right" autoClose={3000} />
        </div>
    );
};

export default SchedulerAvailability;