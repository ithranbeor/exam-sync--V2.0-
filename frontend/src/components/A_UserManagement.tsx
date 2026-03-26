import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import {
  FaSearch, FaPen, FaTrash, FaLock, FaLockOpen,
  FaDownload, FaPlus, FaFileImport, FaTimes, FaSort,
  FaChevronDown, FaEye,
} from 'react-icons/fa';
import { api } from '../lib/apiClient.ts';
import { ToastContainer, toast } from 'react-toastify';
import * as XLSX from 'xlsx';
import 'react-toastify/dist/ReactToastify.css';
import '../styles/A_Colleges.css';
import { useEscapeKey } from '../hooks/useEscapeKey.ts';

// ── Interfaces ────────────────────────────────────────────────────────────────

interface UserAccount {
  user_id: number;
  first_name: string;
  last_name: string;
  middle_name?: string;
  email_address: string;
  contact_number: string;
  status: string;
  created_at: string;
  avatar_url?: string | null;
  employment_type?: 'full-time' | 'part-time' | null;
}

interface Role {
  role_id: number;
  role_name: string;
}

interface College {
  college_id: string;
  college_name: string;
}

interface Department {
  department_id: string;
  department_name: string;
}

type UserRole = {
  user_role_id: number;
  user: number;
  role: number;
  role_id?: number;
  role_name?: string;
  college: string | null;
  college_id?: string | null;
  college_name?: string | null;
  department: string | null;
  department_id?: string | null;
  department_name?: string | null;
  created_at: string | null;
  date_start: string | null;
  date_ended: string | null;
  status?: string | null;
};

interface NewAccountRole {
  role_id: number;
  college_id: string | null;
  department_id: string | null;
  date_start: string | null;
  date_ended: string | null;
}

interface UserManagementProps {
  user?: { id: number; email: string } | null;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const UserManagement: React.FC<UserManagementProps> = () => {
  // ── Data ──────────────────────────────────────────────────────────────────
  const [accounts, setAccounts] = useState<UserAccount[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [colleges, setColleges] = useState<College[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);

  // ── UI state ──────────────────────────────────────────────────────────────
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCollege, setSelectedCollege] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [importLoading, setImportLoading] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [sortBy, setSortBy] = useState<string>('none');
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState<number | 'all'>(20);
  const [showItemsPerPageDropdown, setShowItemsPerPageDropdown] = useState(false);
  const [customItemsPerPage, setCustomItemsPerPage] = useState<string>('');

  // ── Selection ─────────────────────────────────────────────────────────────
  const [selectedAccountIds, setSelectedAccountIds] = useState<Set<number>>(new Set());

  // ── Modals ─────────────────────────────────────────────────────────────────
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showAddRoleModal, setShowAddRoleModal] = useState(false);
  const [showImportAccountsModal, setShowImportAccountsModal] = useState(false);
  const [showImportRolesModal, setShowImportRolesModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteCount, setDeleteCount] = useState(0);

  // ── Edit state ─────────────────────────────────────────────────────────────
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [editingRole, setEditingRole] = useState<UserRole | null>(null);

  // ── Forms ──────────────────────────────────────────────────────────────────
  const [newAccount, setNewAccount] = useState<UserAccount>({
    user_id: 0,
    first_name: '',
    last_name: '',
    middle_name: '',
    email_address: '',
    contact_number: '',
    status: 'Active',
    created_at: new Date().toISOString(),
    employment_type: null,
  });
  const [newAccountRoles, setNewAccountRoles] = useState<NewAccountRole[]>([]);
  const [newRole, setNewRole] = useState<Partial<UserRole>>({});

  const sortRef = useRef<HTMLDivElement>(null);
  const itemsRef = useRef<HTMLDivElement>(null);

  // ── ESC handlers ──────────────────────────────────────────────────────────
  useEscapeKey(() => setShowDetailsModal(false), showDetailsModal);
  useEscapeKey(() => { setShowAccountModal(false); setIsEditMode(false); }, showAccountModal);
  useEscapeKey(() => { setShowAddRoleModal(false); setEditingRole(null); setNewRole({}); }, showAddRoleModal);
  useEscapeKey(() => setShowImportAccountsModal(false), showImportAccountsModal);
  useEscapeKey(() => setShowImportRolesModal(false), showImportRolesModal);
  useEscapeKey(() => setShowDeleteConfirm(false), showDeleteConfirm);
  useEscapeKey(() => { setEditingRole(null); }, !!editingRole);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const getAllowedFields = (roleId: number | undefined) => {
    const roleName = roles.find(r => r.role_id === roleId)?.role_name;
    switch (roleName) {
      case 'Bayanihan Leader': return { college: false, department: true };
      case 'Dean':             return { college: true,  department: false };
      case 'Admin':            return { college: false, department: false };
      case 'Scheduler':        return { college: true,  department: false };
      case 'Proctor':          return { college: true,  department: true };
      default:                 return { college: true,  department: true };
    }
  };

  const excelSerialToDate = (serial: string | number): string | null => {
    if (!serial) return null;
    const num = Number(serial);
    if (isNaN(num) && /^\d{4}-\d{2}-\d{2}$/.test(String(serial))) return String(serial);
    if (isNaN(num)) return null;
    const date = new Date(new Date(1899, 11, 30).getTime() + num * 86400000);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };

  const isNumeric = (s: string) => !isNaN(Number(s)) && !isNaN(parseFloat(s));
  const smartSort = (a: string, b: string) => {
    if (isNumeric(a) && isNumeric(b)) return parseFloat(a) - parseFloat(b);
    if (isNumeric(a)) return -1;
    if (isNumeric(b)) return 1;
    return a.localeCompare(b);
  };

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [accountsRes, rolesRes, collegesRes, departmentsRes, userRolesRes] = await Promise.all([
        api.get<UserAccount[]>('/accounts/'),
        api.get('/tbl_roles/'),
        api.get('/tbl_college/'),
        api.get('/departments/'),
        api.get('/tbl_user_role'),
      ]);

      const rolesData: Role[]       = rolesRes.data;
      const collegesData: College[] = collegesRes.data;
      const deptsData: Department[] = departmentsRes.data;

      setAccounts(accountsRes.data);
      setRoles(rolesData);
      setColleges(collegesData);
      setDepartments(deptsData);

      const today = new Date().toISOString().split('T')[0];
      const normalized: UserRole[] = userRolesRes.data.map((r: any) => {
        let computedStatus = r.status ?? 'Active';
        if (r.date_ended && r.date_ended < today) computedStatus = 'Suspended';
        return {
          ...r,
          status: computedStatus,
          role_name:       rolesData.find((role: Role) => role.role_id === r.role)?.role_name || null,
          college_id:      r.college,
          college_name:    collegesData.find((c: College) => c.college_id === r.college)?.college_name || null,
          department_id:   r.department,
          department_name: deptsData.find((d: Department) => d.department_id === r.department)?.department_name || null,
        };
      });
      setUserRoles(normalized);

      if (collegesData.length > 0 && !selectedCollege) setSelectedCollege('');

      // Sync stale statuses
      const rolesToUpdate = normalized.filter((r: any) => {
        const orig = userRolesRes.data.find((o: any) => o.user_role_id === r.user_role_id)?.status ?? 'Active';
        return orig !== r.status;
      });
      await Promise.all(rolesToUpdate.map((r: any) => api.put(`/tbl_user_role/${r.user_role_id}/`, { status: r.status })));
    } catch {
      toast.error('Error fetching data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (showSortDropdown && sortRef.current && !sortRef.current.contains(e.target as Node))
        setShowSortDropdown(false);
      if (showItemsPerPageDropdown && itemsRef.current && !itemsRef.current.contains(e.target as Node))
        setShowItemsPerPageDropdown(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showSortDropdown, showItemsPerPageDropdown]);

  // ── CRUD: Account ──────────────────────────────────────────────────────────

  const handleSaveAccount = async () => {
    const { user_id, first_name, last_name, email_address, contact_number, employment_type, status, middle_name } = newAccount;
    if (!(user_id > 0) || !first_name || !last_name || !email_address || !contact_number) {
      toast.error('Please fill all required fields including User ID'); return;
    }
    if (!isEditMode && newAccountRoles.length === 0) {
      toast.error('Please add at least one role'); return;
    }
    for (const role of newAccountRoles) {
      if (!role.role_id) { toast.error('Please select a role for all entries'); return; }
    }
    setIsSaving(true);
    try {
      if (isEditMode) {
        await api.put(`/accounts/${user_id}/`, { first_name, last_name, middle_name, email_address, contact_number, status, employment_type });
        toast.success('Account updated successfully!');
      } else {
        const defaultPassword = `${last_name}@${user_id}`;
        await api.post('/create-account/', { user_id, first_name, last_name, middle_name, email_address, contact_number, status, employment_type, password: defaultPassword, created_at: new Date().toISOString() });
        for (const role of newAccountRoles) {
          await api.post('/tbl_user_role/CRUD/', { user: user_id, role: role.role_id, college: role.college_id || null, department: role.department_id || null, date_start: role.date_start || null, date_ended: role.date_ended || null, status: 'Active' });
        }
        toast.success(`Account created! Default password: ${last_name}@${user_id}`);
      }
      setShowAccountModal(false);
      setNewAccountRoles([]);
      await fetchData(true);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Error saving account');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAccount = async (id: number) => {
    if (!globalThis.confirm('Are you sure you want to delete this account?')) return;
    try {
      await Promise.all(userRoles.filter(r => r.user === id).map(r => api.delete(`/tbl_user_role/${r.user_role_id}/`)));
      await api.delete(`/accounts/${id}/`);
      toast.success('Account deleted');
      setShowDetailsModal(false);
      fetchData(true);
    } catch { toast.error('Error deleting account'); }
  };

  const handleBulkDelete = () => {
    if (selectedAccountIds.size === 0) { toast.info('No accounts selected'); return; }
    setDeleteCount(selectedAccountIds.size);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    setShowDeleteConfirm(false);
    setIsBulkDeleting(true);
    try {
      await Promise.all(Array.from(selectedAccountIds).map(async id => {
        await Promise.all(userRoles.filter(r => r.user === id).map(r => api.delete(`/tbl_user_role/${r.user_role_id}/`)));
        await api.delete(`/accounts/${id}/`);
      }));
      toast.success(`Deleted ${selectedAccountIds.size} account(s)`);
      setSelectedAccountIds(new Set());
      fetchData(true);
    } catch { toast.error('Error deleting accounts'); }
    finally { setIsBulkDeleting(false); }
  };

  // ── CRUD: Role ─────────────────────────────────────────────────────────────

  const handleAddRole = async () => {
    if (!newRole.role_id) { toast.error('Role is required.'); return; }
    try {
      const { data, status } = await api.post('/tbl_user_role/CRUD/', {
        user: newRole.user || selectedUserId,
        role: newRole.role_id,
        college: newRole.college_id || null,
        department: newRole.department_id || null,
        date_start: newRole.date_start || null,
        date_ended: newRole.date_ended || null,
        status: 'Active',
      });
      if (!data || status !== 201) { toast.error('Failed to add role.'); return; }
      toast.success('Role added successfully.');
      setUserRoles(prev => [...prev, data]);
      setShowAddRoleModal(false);
      setNewRole({});
      fetchData(true);
    } catch { toast.error('Failed to add role.'); }
  };

  const handleUpdateRole = async () => {
    if (!editingRole) return;
    try {
      await api.put(`/tbl_user_role/${editingRole.user_role_id}/`, {
        role: editingRole.role,
        college: editingRole.college_id,
        department: editingRole.department_id,
        date_start: editingRole.date_start,
        date_ended: editingRole.date_ended,
      });
      toast.success('Role updated successfully.');
      setEditingRole(null);
      fetchData(true);
    } catch { toast.error('Failed to update role.'); }
  };

  const toggleUserRoleStatus = async (user_role_id: number, currentStatus: string) => {
    const newStatus = currentStatus === 'Suspended' ? 'Active' : 'Suspended';
    try {
      const { data, status } = await api.put(`/tbl_user_role/${user_role_id}/`, { status: newStatus });
      if (!data || status !== 200) { toast.error('Failed to update role status.'); return; }
      toast.success(`Role ${newStatus === 'Active' ? 'reactivated' : 'suspended'}.`);
      fetchData(true);
    } catch { toast.error('Failed to update role status.'); }
  };

  const handleDeleteRole = async (user_role_id: number) => {
    if (!confirm('Are you sure you want to delete this role?')) return;
    try {
      const response = await api.delete(`/tbl_user_role/${user_role_id}/`);
      if (response.status === 200 || response.status === 204) {
        toast.success('Role deleted.');
        setUserRoles(prev => prev.filter(r => r.user_role_id !== user_role_id));
      } else { toast.error('Failed to delete role.'); }
    } catch { toast.error('Failed to delete role.'); }
  };

  // ── Import ────────────────────────────────────────────────────────────────

  const handleImportAccounts = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async evt => {
      setImportLoading(true);
      toast.info('Importing accounts...', { autoClose: false, toastId: 'import-progress' });
      const data = new Uint8Array(evt.target?.result as ArrayBuffer);
      const wb = XLSX.read(data, { type: 'array' });
      const json: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
      let successCount = 0, updatedCount = 0, errorCount = 0;
      const errors: string[] = [];
      for (let i = 0; i < json.length; i++) {
        const row = json[i];
        const rowNum = i + 2;
        try {
          const user_id = Number(row.user_id ?? row.id);
          const first_name = String(row.first_name ?? '').trim();
          const last_name = String(row.last_name ?? '').trim();
          const middle_name = String(row.middle_name ?? '').trim();
          const email_address = String(row.email_address ?? '').trim();
          const contact_number = String(row.contact_number ?? '').trim();
          const status = String(row.status ?? 'Active');
          if (!user_id || !first_name || !last_name || !email_address || !contact_number) {
            errors.push(`Row ${rowNum}: Missing required fields`); errorCount++; continue;
          }
          const existing = accounts.find(a => a.user_id === user_id);
          if (existing) {
            await api.put(`/accounts/${user_id}/`, { first_name, last_name, middle_name, email_address, contact_number, status });
            updatedCount++;
          } else {
            await api.post('/create-account/', { user_id, first_name, last_name, middle_name, email_address, contact_number, status, password: `${last_name}@${user_id}`, created_at: new Date().toISOString() });
            successCount++;
          }
          const rolesStr = String(row.roles ?? '').trim();
          if (rolesStr) {
            const roleIds = rolesStr.split(';').map((r: string) => Number(r.trim())).filter((r: number) => r > 0);
            const collegeIds = String(row.colleges ?? '').trim().split(';').map((c: string) => c.trim());
            const deptIds = String(row.departments ?? '').trim().split(';').map((d: string) => d.trim());
            const dateStarts = String(row.date_starts ?? '').trim().split(';').map((d: string) => excelSerialToDate(d.trim()));
            const dateEndeds = String(row.date_endeds ?? '').trim().split(';').map((d: string) => excelSerialToDate(d.trim()));
            for (let j = 0; j < roleIds.length; j++) {
              const existingRole = userRoles.find(ur => ur.user === user_id && ur.role === roleIds[j] && ur.college === (collegeIds[j] || null) && ur.department === (deptIds[j] || null));
              if (existingRole) continue;
              try {
                await api.post('/tbl_user_role/CRUD/', { user: user_id, role: roleIds[j], college: collegeIds[j] || null, department: deptIds[j] || null, date_start: dateStarts[j] || null, date_ended: dateEndeds[j] || null, status: 'Active' });
              } catch (err: any) {
                errors.push(`Row ${rowNum}: Role ${roleIds[j]} - ${err.response?.data?.detail || err.message}`);
              }
            }
          }
        } catch (err: any) {
          errors.push(`Row ${rowNum}: ${err.response?.data?.detail || err.message}`);
          errorCount++;
        }
      }
      toast.dismiss('import-progress');
      const msgs = [successCount > 0 && `${successCount} created`, updatedCount > 0 && `${updatedCount} updated`, errorCount > 0 && `${errorCount} failed`].filter(Boolean).join(', ');
      if (msgs) toast.success(msgs);
      if (errors.length > 0) {
        console.error('Import errors:', errors);
        toast.error(<div style={{ maxHeight: '200px', overflowY: 'auto', fontSize: '12px' }}><strong>Errors:</strong><ul style={{ paddingLeft: '16px', marginTop: '6px' }}>{errors.slice(0, 10).map((e, i) => <li key={i}>{e}</li>)}</ul></div>, { autoClose: 10000 });
      }
      await fetchData(true);
      setImportLoading(false);
      setShowImportAccountsModal(false);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleImportRoles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      setImportLoading(true);
      toast.info('Importing roles...', { autoClose: false, toastId: 'import-roles' });
      const data = new Uint8Array(evt.target?.result as ArrayBuffer);
      const wb = XLSX.read(data, { type: 'array' });
      const json: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      let successCount = 0, errorCount = 0;
      for (const row of json) {
        const { user, role, college, department, date_start, date_ended } = row;
        if (!user || !role) { errorCount++; continue; }
        try {
          const ds = excelSerialToDate(date_start), de = excelSerialToDate(date_ended);
          const existing = userRoles.find(ur => ur.user === user && ur.role === role && ur.college === (college || null) && ur.department === (department || null));
          if (existing) {
            if (ds || de) await api.put(`/tbl_user_role/${existing.user_role_id}/`, { date_start: ds || existing.date_start, date_ended: de || existing.date_ended });
          } else {
            await api.post('/tbl_user_role/CRUD/', { user, role, college: college || null, department: department || null, date_start: ds || null, date_ended: de || null, status: 'Active' });
          }
          successCount++;
        } catch { errorCount++; }
      }
      toast.dismiss('import-roles');
      if (successCount > 0) toast.success(`Imported ${successCount} role(s)`);
      if (errorCount > 0) toast.warning(`Failed: ${errorCount} role(s)`);
      await fetchData(true);
      setImportLoading(false);
      setShowImportRolesModal(false);
    };
    reader.readAsArrayBuffer(file);
  };

  const downloadAccountsTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['user_id', 'first_name', 'last_name', 'middle_name', 'email_address', 'contact_number', 'status', 'roles', 'colleges', 'departments', 'date_starts', 'date_endeds'],
      [2025000001, 'Juan', 'Dela Cruz', 'A.', 'juan@example.com', '09123456789', 'Active', '1;2', 'CITC;CITC', 'DIT;', '2025-01-01', '2025-12-31'],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'ImportTemplate');
    XLSX.writeFile(wb, 'Accounts_Import_Template.xlsx');
  };

  const downloadRolesTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['user', 'role', 'college', 'department', 'date_start', 'date_ended'],
      [2025000001, 1, 'CITC', 'DIT', '2025-01-01', '2025-12-31'],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'RolesTemplate');
    XLSX.writeFile(wb, 'UserRoles_Import_Template.xlsx');
  };

  // ── Filtering / Sorting / Pagination ──────────────────────────────────────

  const getUserRoles = useCallback((userId: number) => userRoles.filter(r => r.user === userId), [userRoles]);

  useEffect(() => { setCurrentPage(1); }, [searchTerm, sortBy, selectedCollege]);

  const filteredAccounts = useMemo(() => {
    let filtered = accounts.filter(account => {
      const fullName = `${account.first_name} ${account.last_name} ${account.middle_name || ''}`.toLowerCase();
      const userId = account.user_id.toString();
      const email = account.email_address.toLowerCase();
      const search = searchTerm.toLowerCase();
      const accountRoles = getUserRoles(account.user_id);
      const roleNames = accountRoles.map(r => r.role_name?.toLowerCase() || '').join(' ');
      const matchesSearch = !searchTerm || userId.includes(search) || fullName.includes(search) || email.includes(search) || roleNames.includes(search);
      const matchesCollege = !selectedCollege || accountRoles.some(r => r.college_id === selectedCollege);
      return matchesSearch && matchesCollege;
    });
    if (sortBy !== 'none') {
      filtered = [...filtered].sort((a, b) => {
        if (sortBy === 'user_id') return a.user_id - b.user_id;
        if (sortBy === 'name') return smartSort(`${a.last_name} ${a.first_name}`.toLowerCase(), `${b.last_name} ${b.first_name}`.toLowerCase());
        if (sortBy === 'email') return smartSort(a.email_address.toLowerCase(), b.email_address.toLowerCase());
        if (sortBy === 'status') return smartSort(a.status.toLowerCase(), b.status.toLowerCase());
        if (sortBy === 'created_at') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        return 0;
      });
    }
    return filtered;
  }, [accounts, searchTerm, selectedCollege, getUserRoles, sortBy]);

  const totalPages = Math.max(1, itemsPerPage === 'all' ? 1 : Math.ceil(filteredAccounts.length / itemsPerPage));

  const paginatedAccounts = useMemo(() => {
    if (itemsPerPage === 'all') return filteredAccounts;
    return filteredAccounts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  }, [filteredAccounts, currentPage, itemsPerPage]);

  const isAllSelected = filteredAccounts.length > 0 && filteredAccounts.every(a => selectedAccountIds.has(a.user_id));

  const toggleSelectAll = () => {
    setSelectedAccountIds(prev => {
      const next = new Set(prev);
      if (isAllSelected) filteredAccounts.forEach(a => next.delete(a.user_id));
      else filteredAccounts.forEach(a => next.add(a.user_id));
      return next;
    });
  };

  const toggleSelectAccount = (userId: number) => {
    setSelectedAccountIds(prev => {
      const next = new Set(prev);
      next.has(userId) ? next.delete(userId) : next.add(userId);
      return next;
    });
  };

  const handleCustomItemsPerPage = () => {
    const n = parseInt(customItemsPerPage, 10);
    if (!isNaN(n) && n > 0) {
      setItemsPerPage(n);
      setCustomItemsPerPage('');
      setShowItemsPerPageDropdown(false);
      setCurrentPage(1);
    } else { toast.error('Please enter a valid positive number.'); }
  };

  // New account role helpers
  const addNewAccountRole = () => setNewAccountRoles(prev => [...prev, { role_id: 0, college_id: null, department_id: null, date_start: null, date_ended: null }]);
  const removeNewAccountRole = (i: number) => setNewAccountRoles(prev => prev.filter((_, idx) => idx !== i));
  const updateNewAccountRole = (i: number, field: keyof NewAccountRole, value: any) =>
    setNewAccountRoles(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r));

  // Totals for header subtitle
  const totalActive = accounts.filter(a => a.status === 'Active').length;
  const totalRolesCount = userRoles.length;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="cl-page">

      {/* ── Page Header ── */}
      <div className="cl-page-header">
        <div className="cl-page-header-left">
          <div className="cl-page-icon">
            <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div className="cl-page-title">
            <h1>User Management</h1>
            <p>{accounts.length} accounts · {totalActive} active · {totalRolesCount} role assignments</p>
          </div>
        </div>

        <div className="cl-page-actions">
          <div className="cl-search-bar">
            <FaSearch className="cl-search-icon" />
            <input
              type="text"
              placeholder="Search by ID, name, email, role…"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>

          {/* College filter */}
          <select
            value={selectedCollege}
            onChange={e => setSelectedCollege(e.target.value)}
            style={{
              height: '36px',
              padding: '0 12px',
              border: '1.5px solid var(--cl-border)',
              borderRadius: 'var(--cl-radius-sm)',
              fontSize: '12.5px',
              fontFamily: 'var(--cl-font)',
              color: 'var(--cl-text-secondary)',
              background: 'var(--cl-surface)',
              boxShadow: 'var(--cl-shadow-sm)',
              cursor: 'pointer',
              outline: 'none',
              minWidth: '160px',
              maxWidth: '260px',
            }}
          >
            <option value="">All Colleges</option>
            {colleges.map(c => (
              <option key={c.college_id} value={c.college_id}>{c.college_name}</option>
            ))}
          </select>

          <button
            type="button"
            className="cl-btn primary"
            onClick={() => {
              setIsEditMode(false);
              setNewAccount({ user_id: 0, first_name: '', last_name: '', middle_name: '', email_address: '', contact_number: '', status: 'Active', created_at: new Date().toISOString() });
              setNewAccountRoles([{ role_id: 0, college_id: null, department_id: null, date_start: null, date_ended: null }]);
              setShowAccountModal(true);
            }}
          >
            <FaPlus style={{ fontSize: '11px' }} /> Add Account
          </button>

          <button type="button" className="cl-btn" onClick={() => setShowImportAccountsModal(true)}>
            <FaFileImport style={{ fontSize: '11px' }} /> Import
          </button>

          <button
            type="button"
            className="cl-btn danger"
            onClick={handleBulkDelete}
            disabled={isBulkDeleting || selectedAccountIds.size === 0}
            title={selectedAccountIds.size > 0 ? `Delete ${selectedAccountIds.size} selected` : 'Select accounts to delete'}
          >
            <FaTrash style={{ fontSize: '11px' }} />
            {selectedAccountIds.size > 0 && <span>({selectedAccountIds.size})</span>}
          </button>
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div className="cl-toolbar">
        <div className="cl-toolbar-left">
          {/* Sort */}
          <div ref={sortRef} style={{ position: 'relative' }}>
            <button
              type="button"
              className="cl-toolbar-btn"
              onClick={() => setShowSortDropdown(v => !v)}
            >
              <FaSort style={{ fontSize: '11px' }} />
              Sort{sortBy !== 'none' ? `: ${sortBy === 'user_id' ? 'ID' : sortBy === 'name' ? 'Name' : sortBy === 'email' ? 'Email' : sortBy === 'status' ? 'Status' : 'Created'}` : ''}
              <FaChevronDown style={{ fontSize: '9px', marginLeft: '2px' }} />
            </button>
            {showSortDropdown && (
              <div className="cl-dropdown">
                {[
                  { value: 'none',       label: 'None' },
                  { value: 'user_id',    label: 'User ID' },
                  { value: 'name',       label: 'Name' },
                  { value: 'email',      label: 'Email' },
                  { value: 'status',     label: 'Status' },
                  { value: 'created_at', label: 'Created Date' },
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

          {/* Items per page */}
          <div ref={itemsRef} style={{ position: 'relative' }}>
            <button
              type="button"
              className="cl-toolbar-btn"
              onClick={() => setShowItemsPerPageDropdown(v => !v)}
            >
              <FaChevronDown style={{ fontSize: '9px' }} />
              Show: {itemsPerPage === 'all' ? 'All' : itemsPerPage}
            </button>
            {showItemsPerPageDropdown && (
              <div className="cl-dropdown" style={{ minWidth: '180px' }}>
                {[10, 20, 30].map(n => (
                  <button
                    key={n}
                    type="button"
                    className={`cl-dropdown-item${itemsPerPage === n ? ' active' : ''}`}
                    onClick={() => { setItemsPerPage(n); setCurrentPage(1); setShowItemsPerPageDropdown(false); }}
                  >
                    {n} rows
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
                    onKeyDown={e => e.key === 'Enter' && handleCustomItemsPerPage()}
                  />
                  <button
                    type="button"
                    className="cl-btn primary"
                    style={{ height: '30px', padding: '0 10px', fontSize: '12px' }}
                    onClick={handleCustomItemsPerPage}
                  >
                    Go
                  </button>
                </div>
                <button
                  type="button"
                  className={`cl-dropdown-item${itemsPerPage === 'all' ? ' active' : ''}`}
                  onClick={() => { setItemsPerPage('all'); setCurrentPage(1); setShowItemsPerPageDropdown(false); }}
                >
                  Show All
                </button>
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
          >←</button>
          <span className="cl-page-info">{currentPage} / {totalPages}</span>
          <button
            type="button"
            className="cl-page-btn"
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage >= totalPages}
          >→</button>
        </div>
      </div>

      {/* ── Accounts Table ── */}
      <div className="cl-table-card">
        <div className="cl-table-scroll-wrapper">
          <div className="cl-table-container">
            <table className="cl-table">
              <thead>
                <tr>
                  <th style={{ width: '52px' }}>#</th>
                  <th>ID</th>
                  <th>Full Name</th>
                  <th>Email</th>
                  <th>Contact</th>
                  <th>Role/s</th>
                  <th>Employment</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th style={{ width: '160px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span>Actions</span>
                      <input
                        type="checkbox"
                        checked={isAllSelected}
                        onChange={toggleSelectAll}
                        disabled={loading || filteredAccounts.length === 0}
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
                    <td colSpan={10} className="cl-table-empty">
                      <div className="cl-spinner" /> Loading users…
                    </td>
                  </tr>
                ) : filteredAccounts.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="cl-table-empty">No users found.</td>
                  </tr>
                ) : (
                  paginatedAccounts.map((account, index) => {
                    const accountRoles = getUserRoles(account.user_id);
                    const isSelected = selectedAccountIds.has(account.user_id);
                    const rowNum = itemsPerPage === 'all' ? index + 1 : (currentPage - 1) * (itemsPerPage as number) + index + 1;

                    return (
                      <tr key={account.user_id} className={isSelected ? 'selected' : ''}>
                        <td className="cl-td-num">{rowNum}</td>
                        <td><span className="cl-id-badge">{account.user_id}</span></td>
                        <td style={{ fontWeight: 500, color: 'var(--cl-text-primary)' }}>
                          {account.last_name}, {account.first_name} {account.middle_name ?? ''}
                        </td>
                        <td>{account.email_address}</td>
                        <td>{account.contact_number}</td>
                        <td>
                          {accountRoles.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                              {accountRoles.map(role => {
                                const office = [role.college_id, role.department_id].filter(Boolean).join(' / ');
                                return (
                                  <span key={role.user_role_id} style={{ fontSize: '11.5px', color: 'var(--cl-text-secondary)' }}>
                                    <span style={{ fontWeight: 600, color: 'var(--cl-brand-light)' }}>{role.role_name}</span>
                                    {office && <span style={{ color: 'var(--cl-text-muted)' }}> – {office}</span>}
                                  </span>
                                );
                              })}
                            </div>
                          ) : <span style={{ color: 'var(--cl-text-muted)' }}>—</span>}
                        </td>
                        <td>
                          {account.employment_type ? (
                            <span className="cl-room-type-badge" style={{ background: account.employment_type === 'full-time' ? '#EBF4FF' : '#FFF3E0', color: account.employment_type === 'full-time' ? '#1a5a8a' : '#F57C00' }}>
                              {account.employment_type === 'full-time' ? 'Full-time' : 'Part-time'}
                            </span>
                          ) : <span style={{ color: 'var(--cl-text-muted)' }}>—</span>}
                        </td>
                        <td>
                          <span className="cl-room-count-badge" style={{
                            background: account.status === 'Suspended' ? 'var(--cl-danger-soft)' : 'var(--cl-success-soft)',
                            color: account.status === 'Suspended' ? 'var(--cl-danger)' : 'var(--cl-success)',
                            borderColor: account.status === 'Suspended' ? 'rgba(192,57,43,0.25)' : 'rgba(4,120,87,0.25)',
                          }}>
                            {account.status}
                          </span>
                        </td>
                        <td style={{ fontFamily: 'var(--cl-mono)', fontSize: '12px' }}>
                          {new Date(account.created_at).toLocaleDateString()}
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <button
                              type="button"
                              className="cl-icon-btn view"
                              onClick={() => { setSelectedUserId(account.user_id); setShowDetailsModal(true); }}
                            >
                              <FaEye style={{ fontSize: '10px' }} /> View
                            </button>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectAccount(account.user_id)}
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

      {/* ════ USER DETAILS MODAL ════ */}
      {showDetailsModal && selectedUserId !== null && (() => {
        const account = accounts.find(a => a.user_id === selectedUserId);
        if (!account) return null;
        const accountRoles = userRoles.filter(r => r.user === selectedUserId);
        return (
          <div className="cl-modal-overlay" onClick={() => setShowDetailsModal(false)}>
            <div className="cl-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '820px', maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}>
              <div className="cl-modal-header" style={{ maxWidth: '100%' }}>
                <h3>User Details</h3>
                <p>{account.last_name}, {account.first_name} {account.middle_name || ''} · ID {account.user_id}</p>
              </div>

              <div className="cl-modal-body" style={{ maxHeight: 'none', flex: 1, overflowY: 'auto' }}>
                {/* Account Info Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', padding: '4px 0 16px', borderBottom: '1.5px solid var(--cl-surface-3)' }}>
                  {[
                    { label: 'User ID',    value: String(account.user_id) },
                    { label: 'Email',      value: account.email_address },
                    { label: 'Contact',    value: account.contact_number },
                    { label: 'Status',     value: account.status, colored: true },
                  ].map(item => (
                    <div key={item.label}>
                      <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--cl-text-muted)', marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{item.label}</div>
                      {item.colored ? (
                        <span className="cl-room-count-badge" style={{ background: account.status === 'Suspended' ? 'var(--cl-danger-soft)' : 'var(--cl-success-soft)', color: account.status === 'Suspended' ? 'var(--cl-danger)' : 'var(--cl-success)', borderColor: account.status === 'Suspended' ? 'rgba(192,57,43,0.25)' : 'rgba(4,120,87,0.25)' }}>
                          {account.status}
                        </span>
                      ) : (
                        <div style={{ fontSize: '13px', color: 'var(--cl-text-primary)', fontWeight: 500 }}>{item.value}</div>
                      )}
                    </div>
                  ))}
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--cl-text-muted)', marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Employment</div>
                    {account.employment_type ? (
                      <span className="cl-room-type-badge" style={{ background: account.employment_type === 'full-time' ? '#EBF4FF' : '#FFF3E0', color: account.employment_type === 'full-time' ? '#1a5a8a' : '#F57C00' }}>
                        {account.employment_type === 'full-time' ? 'Full-time' : 'Part-time'}
                      </span>
                    ) : <span style={{ fontSize: '13px', color: 'var(--cl-text-muted)' }}>Not specified</span>}
                  </div>
                </div>

                {/* Roles Table */}
                <div style={{ marginTop: '16px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--cl-text-secondary)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Assigned Roles ({accountRoles.length})
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table className="cl-table" style={{ fontSize: '12.5px', margin: 0 }}>
                      <thead>
                        <tr>
                          <th>Role</th>
                          <th>Office</th>
                          <th>Start</th>
                          <th>End</th>
                          <th>Created</th>
                          <th>Status</th>
                          <th style={{ width: '220px' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {accountRoles.length === 0 ? (
                          <tr><td colSpan={7} className="cl-table-empty" style={{ padding: '24px' }}>No roles assigned.</td></tr>
                        ) : accountRoles.map(role => (
                          <tr key={role.user_role_id}>
                            <td><span className="cl-id-badge" style={{ fontSize: '11px' }}>{role.role_name || '—'}</span></td>
                            <td>{[role.college_name, role.department_name].filter(Boolean).join(' / ') || '—'}</td>
                            <td style={{ fontFamily: 'var(--cl-mono)', fontSize: '11px' }}>{role.date_start?.split('T')[0] || '—'}</td>
                            <td style={{ fontFamily: 'var(--cl-mono)', fontSize: '11px' }}>{role.date_ended?.split('T')[0] || '—'}</td>
                            <td style={{ fontFamily: 'var(--cl-mono)', fontSize: '11px' }}>
                              {role.created_at ? new Date(role.created_at).toLocaleDateString() : '—'}
                            </td>
                            <td>
                              <span className="cl-room-count-badge" style={{ fontSize: '11px', background: role.status === 'Suspended' ? 'var(--cl-danger-soft)' : 'var(--cl-success-soft)', color: role.status === 'Suspended' ? 'var(--cl-danger)' : 'var(--cl-success)', borderColor: role.status === 'Suspended' ? 'rgba(192,57,43,0.25)' : 'rgba(4,120,87,0.25)' }}>
                                {role.status || 'Active'}
                              </span>
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                <button type="button" className="cl-icon-btn edit" onClick={() => setEditingRole(role)}>
                                  <FaPen style={{ fontSize: '9px' }} /> Edit
                                </button>
                                <button
                                  type="button"
                                  className="cl-icon-btn"
                                  style={role.status === 'Suspended'
                                    ? { color: 'var(--cl-success)', border: '1.5px solid rgba(4,120,87,0.3)', background: 'var(--cl-success-soft)' }
                                    : { color: 'var(--cl-warn)', border: '1.5px solid rgba(180,83,9,0.3)', background: 'var(--cl-warn-soft)' }}
                                  onClick={() => toggleUserRoleStatus(role.user_role_id, role.status || 'Active')}
                                >
                                  {role.status === 'Suspended' ? <><FaLockOpen style={{ fontSize: '9px' }} /> Activate</> : <><FaLock style={{ fontSize: '9px' }} /> Suspend</>}
                                </button>
                                <button
                                  type="button"
                                  className="cl-icon-btn"
                                  style={{ color: 'var(--cl-danger)', border: '1.5px solid rgba(192,57,43,0.25)' }}
                                  onClick={() => handleDeleteRole(role.user_role_id)}
                                >
                                  <FaTrash style={{ fontSize: '9px' }} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="cl-modal-footer">
                <button
                  type="button"
                  className="cl-btn danger"
                  onClick={() => handleDeleteAccount(account.user_id)}
                >
                  <FaTrash style={{ fontSize: '10px' }} /> Delete Account
                </button>
                <button
                  type="button"
                  className="cl-btn"
                  onClick={() => { setNewAccount(account); setIsEditMode(true); setShowAccountModal(true); }}
                >
                  <FaPen style={{ fontSize: '10px' }} /> Edit Account
                </button>
                <button
                  type="button"
                  className="cl-btn"
                  onClick={() => { setNewRole({ user: selectedUserId ?? undefined }); setShowAddRoleModal(true); }}
                >
                  <FaPlus style={{ fontSize: '10px' }} /> Add Role
                </button>
                <button type="button" className="cl-btn primary" onClick={() => setShowDetailsModal(false)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ════ ADD / EDIT ACCOUNT MODAL ════ */}
      {showAccountModal && (
        <div className="cl-modal-overlay" style={{ zIndex: 10002 }} onClick={() => { setShowAccountModal(false); setIsEditMode(false); }}>
          <div className="cl-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div className="cl-modal-header" style={{ maxWidth: '100%' }}>
              <h3>{isEditMode ? 'Edit Account' : 'Add New Account'}</h3>
            </div>
            <div className="cl-modal-body" style={{ maxHeight: 'none', flex: 1, overflowY: 'auto' }}>
              {(['user_id', 'first_name', 'last_name', 'middle_name', 'email_address', 'contact_number'] as const).map(field => (
                <div key={field} className="cl-field">
                  <label>{field === 'user_id' ? 'User ID (Employee ID)' : field.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</label>
                  <input
                    className="cl-input"
                    type="text"
                    value={(newAccount as any)[field] ?? ''}
                    disabled={isEditMode && field === 'user_id'}
                    onChange={e => setNewAccount(prev => ({
                      ...prev,
                      [field]: field === 'user_id' ? (e.target.value === '' ? null : Number(e.target.value)) : e.target.value,
                    }))}
                  />
                </div>
              ))}

              <div className="cl-field">
                <label>Employment Type</label>
                <select
                  className="cl-input"
                  value={newAccount.employment_type || ''}
                  onChange={e => setNewAccount(prev => ({ ...prev, employment_type: e.target.value ? e.target.value as 'full-time' | 'part-time' : null }))}
                >
                  <option value="">Not Specified</option>
                  <option value="full-time">Full-time</option>
                  <option value="part-time">Part-time</option>
                </select>
              </div>

              <div className="cl-field">
                <label>Status</label>
                <select className="cl-input" value={newAccount.status} onChange={e => setNewAccount(prev => ({ ...prev, status: e.target.value }))}>
                  <option value="Active">Active</option>
                  <option value="Suspended">Suspended</option>
                </select>
              </div>

              {/* Roles section (add only) */}
              {!isEditMode && (
                <div style={{ borderTop: '1.5px solid var(--cl-surface-3)', marginTop: '8px', paddingTop: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--cl-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Roles (Required)
                    </div>
                    <button type="button" className="cl-btn" style={{ height: '28px', fontSize: '11.5px', padding: '0 10px' }} onClick={addNewAccountRole}>
                      <FaPlus style={{ fontSize: '9px' }} /> Add Role
                    </button>
                  </div>

                  {newAccountRoles.map((role, index) => (
                    <div key={index} style={{ border: '1.5px solid var(--cl-border)', borderRadius: 'var(--cl-radius-md)', padding: '14px', marginBottom: '12px', position: 'relative', background: 'var(--cl-surface-2)' }}>
                      <button
                        type="button"
                        className="cl-btn danger"
                        style={{ position: 'absolute', top: '10px', right: '10px', height: '26px', padding: '0 8px', fontSize: '11px' }}
                        onClick={() => removeNewAccountRole(index)}
                      >
                        <FaTimes style={{ fontSize: '9px' }} />
                      </button>

                      <div className="cl-field">
                        <label>Role</label>
                        <select
                          className="cl-input"
                          value={role.role_id || ''}
                          onChange={e => {
                            const role_id = Number(e.target.value);
                            const allowed = getAllowedFields(role_id);
                            updateNewAccountRole(index, 'role_id', role_id);
                            if (!allowed.college) updateNewAccountRole(index, 'college_id', null);
                            if (!allowed.department) updateNewAccountRole(index, 'department_id', null);
                          }}
                        >
                          <option value="">Select Role</option>
                          {roles.map(r => <option key={r.role_id} value={r.role_id}>{r.role_name}</option>)}
                        </select>
                      </div>

                      {getAllowedFields(role.role_id).college && (
                        <div className="cl-field">
                          <label>College</label>
                          <select className="cl-input" value={role.college_id || ''} onChange={e => updateNewAccountRole(index, 'college_id', e.target.value || null)}>
                            <option value="">None</option>
                            {colleges.map(c => <option key={c.college_id} value={c.college_id}>{c.college_name}</option>)}
                          </select>
                        </div>
                      )}

                      {getAllowedFields(role.role_id).department && (
                        <div className="cl-field">
                          <label>Department</label>
                          <select className="cl-input" value={role.department_id || ''} onChange={e => updateNewAccountRole(index, 'department_id', e.target.value || null)}>
                            <option value="">None</option>
                            {departments.map(d => <option key={d.department_id} value={d.department_id}>({d.department_id}) {d.department_name}</option>)}
                          </select>
                        </div>
                      )}

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div className="cl-field">
                          <label>Start Date</label>
                          <input type="date" className="cl-input" value={role.date_start || ''} onChange={e => updateNewAccountRole(index, 'date_start', e.target.value || null)} />
                        </div>
                        <div className="cl-field">
                          <label>End Date</label>
                          <input type="date" className="cl-input" value={role.date_ended || ''} onChange={e => updateNewAccountRole(index, 'date_ended', e.target.value || null)} />
                        </div>
                      </div>
                    </div>
                  ))}

                  <p style={{ fontSize: '11.5px', color: 'var(--cl-text-muted)', marginTop: '8px', fontFamily: 'var(--cl-mono)' }}>
                    Default password: <strong>{newAccount.last_name || 'LastName'}@{newAccount.user_id || 'ID'}</strong>
                  </p>
                </div>
              )}
            </div>
            <div className="cl-modal-footer">
              <button type="button" className="cl-btn" onClick={() => { setShowAccountModal(false); setIsEditMode(false); }} disabled={isSaving}>Cancel</button>
              <button type="button" className="cl-btn primary" onClick={handleSaveAccount} disabled={isSaving}>
                {isSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════ ADD ROLE MODAL ════ */}
      {showAddRoleModal && (
        <div className="cl-modal-overlay" style={{ zIndex: 10003 }} onClick={() => { setShowAddRoleModal(false); setNewRole({}); }}>
          <div className="cl-modal" onClick={e => e.stopPropagation()}>
            <div className="cl-modal-header" style={{ maxWidth: '100%' }}>
              <h3>Add New Role</h3>
            </div>
            <div className="cl-modal-body">
              <div className="cl-field">
                <label>Role</label>
                <select
                  className="cl-input"
                  value={newRole.role_id ?? ''}
                  onChange={e => {
                    const role_id = e.target.value ? Number(e.target.value) : undefined;
                    const allowed = getAllowedFields(role_id);
                    setNewRole(prev => ({ ...prev, role_id, role: role_id, college_id: allowed.college ? prev.college_id : undefined, department_id: allowed.department ? prev.department_id : undefined }));
                  }}
                >
                  <option value="">Select Role</option>
                  {roles.map(r => <option key={r.role_id} value={r.role_id}>{r.role_name}</option>)}
                </select>
              </div>
              {getAllowedFields(newRole.role_id).college && (
                <div className="cl-field">
                  <label>College</label>
                  <select className="cl-input" value={newRole.college_id || ''} onChange={e => setNewRole(prev => ({ ...prev, college_id: e.target.value || null }))}>
                    <option value="">None</option>
                    {colleges.map(c => <option key={c.college_id} value={c.college_id}>{c.college_name}</option>)}
                  </select>
                </div>
              )}
              {getAllowedFields(newRole.role_id).department && (
                <div className="cl-field">
                  <label>Department</label>
                  <select className="cl-input" value={newRole.department_id || ''} onChange={e => setNewRole(prev => ({ ...prev, department_id: e.target.value || null }))}>
                    <option value="">None</option>
                    {departments.map(d => <option key={d.department_id} value={d.department_id}>({d.department_id}) {d.department_name}</option>)}
                  </select>
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="cl-field">
                  <label>Start Date</label>
                  <input type="date" className="cl-input" value={newRole.date_start?.split('T')[0] || ''} onChange={e => setNewRole(prev => ({ ...prev, date_start: e.target.value }))} />
                </div>
                <div className="cl-field">
                  <label>End Date</label>
                  <input type="date" className="cl-input" value={newRole.date_ended?.split('T')[0] || ''} onChange={e => setNewRole(prev => ({ ...prev, date_ended: e.target.value }))} />
                </div>
              </div>
            </div>
            <div className="cl-modal-footer">
              <button type="button" className="cl-btn" onClick={() => { setShowAddRoleModal(false); setNewRole({}); }}>Cancel</button>
              <button type="button" className="cl-btn primary" onClick={handleAddRole}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* ════ EDIT ROLE MODAL ════ */}
      {editingRole && (
        <div className="cl-modal-overlay" style={{ zIndex: 10003 }} onClick={() => setEditingRole(null)}>
          <div className="cl-modal" onClick={e => e.stopPropagation()}>
            <div className="cl-modal-header" style={{ maxWidth: '100%' }}>
              <h3>Edit Role</h3>
            </div>
            <div className="cl-modal-body">
              <div className="cl-field">
                <label>Role</label>
                <select
                  className="cl-input"
                  value={editingRole.role ?? ''}
                  onChange={e => {
                    const role_id = e.target.value ? Number(e.target.value) : undefined;
                    const allowed = getAllowedFields(role_id);
                    setEditingRole(prev => prev && ({ ...prev, role: role_id!, role_id, college_id: allowed.college ? prev.college_id : undefined, department_id: allowed.department ? prev.department_id : undefined }));
                  }}
                >
                  <option value="">Select Role</option>
                  {roles.map(r => <option key={r.role_id} value={r.role_id}>{r.role_name}</option>)}
                </select>
              </div>
              {getAllowedFields(editingRole.role).college && (
                <div className="cl-field">
                  <label>College</label>
                  <select className="cl-input" value={editingRole.college_id || ''} onChange={e => setEditingRole(prev => prev && { ...prev, college_id: e.target.value || null })}>
                    <option value="">None</option>
                    {colleges.map(c => <option key={c.college_id} value={c.college_id}>{c.college_name}</option>)}
                  </select>
                </div>
              )}
              {getAllowedFields(editingRole.role).department && (
                <div className="cl-field">
                  <label>Department</label>
                  <select className="cl-input" value={editingRole.department_id || ''} onChange={e => setEditingRole(prev => prev && { ...prev, department_id: e.target.value || null })}>
                    <option value="">None</option>
                    {departments.map(d => <option key={d.department_id} value={d.department_id}>{d.department_name}</option>)}
                  </select>
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="cl-field">
                  <label>Start Date</label>
                  <input type="date" className="cl-input" value={editingRole.date_start?.split('T')[0] || ''} onChange={e => setEditingRole(prev => prev && { ...prev, date_start: e.target.value })} />
                </div>
                <div className="cl-field">
                  <label>End Date</label>
                  <input type="date" className="cl-input" value={editingRole.date_ended?.split('T')[0] || ''} onChange={e => setEditingRole(prev => prev && { ...prev, date_ended: e.target.value })} />
                </div>
              </div>
            </div>
            <div className="cl-modal-footer">
              <button type="button" className="cl-btn" onClick={() => setEditingRole(null)}>Cancel</button>
              <button type="button" className="cl-btn primary" onClick={handleUpdateRole}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* ════ IMPORT ACCOUNTS MODAL ════ */}
      {showImportAccountsModal && (
        <div className="cl-modal-overlay" onClick={() => !importLoading && setShowImportAccountsModal(false)}>
          <div className="cl-modal" onClick={e => e.stopPropagation()}>
            <div className="cl-modal-header" style={{ maxWidth: '100%' }}>
              <h3>Import Accounts</h3>
              <p>Upload an .xlsx file using the template format.</p>
            </div>
            <div className="cl-modal-body">
              <p className="cl-import-hint">
                Columns: <strong>user_id, first_name, last_name, middle_name, email_address, contact_number, status, roles, colleges, departments, date_starts, date_endeds</strong>. Separate multiple values with semicolons.
              </p>
              <input type="file" accept=".xlsx,.xls" onChange={handleImportAccounts} disabled={importLoading} className="cl-file-input" />
              <p style={{ fontSize: '11.5px', color: 'var(--cl-text-muted)', marginTop: '6px', fontFamily: 'var(--cl-mono)' }}>
                Default password format: <strong>LastName@UserID</strong>
              </p>
              <button type="button" className="cl-btn" onClick={downloadAccountsTemplate} disabled={importLoading} style={{ width: '100%', justifyContent: 'center', marginTop: '8px' }}>
                <FaDownload style={{ fontSize: '11px' }} /> Download Template
              </button>
            </div>
            <div className="cl-modal-footer">
              <button type="button" className="cl-btn primary" onClick={() => setShowImportAccountsModal(false)} disabled={importLoading}>
                {importLoading ? 'Importing…' : 'Done'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════ IMPORT ROLES MODAL ════ */}
      {showImportRolesModal && (
        <div className="cl-modal-overlay" onClick={() => !importLoading && setShowImportRolesModal(false)}>
          <div className="cl-modal" onClick={e => e.stopPropagation()}>
            <div className="cl-modal-header" style={{ maxWidth: '100%' }}>
              <h3>Import Roles</h3>
              <p>Upload an .xlsx file using the template format.</p>
            </div>
            <div className="cl-modal-body">
              <p className="cl-import-hint">
                Columns: <strong>user, role, college, department, date_start, date_ended</strong>. Each role must have at least one of college or department.
              </p>
              <input type="file" accept=".xlsx,.xls" onChange={handleImportRoles} disabled={importLoading} className="cl-file-input" />
              <button type="button" className="cl-btn" onClick={downloadRolesTemplate} disabled={importLoading} style={{ width: '100%', justifyContent: 'center', marginTop: '8px' }}>
                <FaDownload style={{ fontSize: '11px' }} /> Download Template
              </button>
            </div>
            <div className="cl-modal-footer">
              <button type="button" className="cl-btn primary" onClick={() => setShowImportRolesModal(false)} disabled={importLoading}>
                {importLoading ? 'Importing…' : 'Done'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════ DELETE CONFIRM MODAL ════ */}
      {showDeleteConfirm && (
        <div className="cl-modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="cl-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '380px' }}>
            <div className="cl-modal-header" style={{ maxWidth: '100%' }}>
              <h3>Confirm Deletion</h3>
            </div>
            <div className="cl-modal-body">
              <p style={{ fontSize: '13.5px', color: 'var(--cl-text-secondary)', lineHeight: 1.7, margin: 0 }}>
                You are about to delete <strong>{deleteCount}</strong> account{deleteCount !== 1 ? 's' : ''} and all their associated roles. This action cannot be undone.
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

      {/* Global import loading overlay */}
      {importLoading && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(9,44,76,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, backdropFilter: 'blur(4px)' }}>
          <div style={{ background: 'var(--cl-surface)', padding: '32px 40px', borderRadius: 'var(--cl-radius-xl)', textAlign: 'center', boxShadow: 'var(--cl-shadow-lg)', border: '1.5px solid var(--cl-border)' }}>
            <div className="cl-spinner" style={{ margin: '0 auto 16px' }} />
            <p style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--cl-text-primary)', fontFamily: 'var(--cl-font)' }}>Importing data…</p>
            <p style={{ margin: '6px 0 0', fontSize: '12.5px', color: 'var(--cl-text-muted)', fontFamily: 'var(--cl-font)' }}>Please wait, this may take a moment.</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;