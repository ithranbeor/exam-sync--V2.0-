import React, { useEffect, useState } from 'react';
import { FaSearch, FaPen, FaTrash, FaCalendarAlt, FaLock, FaLockOpen, FaDownload,  FaPlus, FaFileImport, FaTimes } from 'react-icons/fa';
import { api } from '../lib/apiClient.ts';
import { ToastContainer, toast } from 'react-toastify';
import * as XLSX from 'xlsx';
import 'react-toastify/dist/ReactToastify.css';
import '../styles/accounts.css';

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

interface UserManagementProps {
  user?: {
    id: number;
    email: string;
  } | null;
}

interface NewAccountRole {
  role_id: number;
  college_id: string | null;
  department_id: string | null;
  date_start: string | null;
  date_ended: string | null;
}

export const UserManagement: React.FC<UserManagementProps> = ({ user }) => {
  const [accounts, setAccounts] = useState<UserAccount[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [colleges, setColleges] = useState<College[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCollege, setSelectedCollege] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [importLoading, setImportLoading] = useState(false); 

  // Modals
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showAddRoleModal, setShowAddRoleModal] = useState(false);
  const [showImportAccountsModal, setShowImportAccountsModal] = useState(false);
  const [showImportRolesModal, setShowImportRolesModal] = useState(false);
  
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [editingRole, setEditingRole] = useState<UserRole | null>(null);

  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [selectedAccounts, setSelectedAccounts] = useState<number[]>([]);

  const [newAccount, setNewAccount] = useState<UserAccount>({
    user_id: 0,
    first_name: '',
    last_name: '',
    middle_name: '',
    email_address: '',
    contact_number: '',
    status: 'Active',
    created_at: new Date().toISOString(),
  });

  const [newAccountRoles, setNewAccountRoles] = useState<NewAccountRole[]>([]);

  const [newRole, setNewRole] = useState<Partial<UserRole>>({});

  const getAllowedFields = (roleId: number | undefined) => {
    const roleName = roles.find(r => r.role_id === roleId)?.role_name;
    switch (roleName) {
      case "Bayanihan Leader":
        return { college: false, department: true };
      case "Dean":
        return { college: true, department: false };
      case "Admin":
        return { college: false, department: false };
      case "Scheduler":
        return { college: true, department: false };
      case "Proctor":
        return { college: true, department: true };
      default:
        return { college: true, department: true };
    }
  };

  // Fetch all data
  const fetchData = async () => {
    setLoading(true);
    try {
      const [accountsRes, rolesRes, collegesRes, departmentsRes, userRolesRes] = await Promise.all([
        api.get<UserAccount[]>('/accounts/'),
        api.get('/tbl_roles/'),
        api.get('/tbl_college/'),
        api.get('/departments/'),
        api.get('/tbl_user_role'),
      ]);

      setAccounts(accountsRes.data);
      const rolesData = rolesRes.data;
      const collegesData = collegesRes.data;
      const departmentsData = departmentsRes.data;
      
      setRoles(rolesData);
      setColleges(collegesData);
      setDepartments(departmentsData);

      const today = new Date().toISOString().split("T")[0];
      
      // Enrich user roles with names
      const normalized = userRolesRes.data.map((r: any) => {
        let computedStatus = r.status ?? "Active";
        if (r.date_ended && r.date_ended < today) {
          computedStatus = "Suspended";
        }

        // Find and attach role name
        const roleData = rolesData.find((role: any) => role.role_id === r.role);
        const collegData = collegesData.find((college: any) => college.college_id === r.college);
        const deptData = departmentsData.find((dept: any) => dept.department_id === r.department);

        return {
          ...r,
          status: computedStatus,
          role_name: roleData?.role_name || null,
          college_id: r.college,
          college_name: collegData?.college_name || null,
          department_id: r.department,
          department_name: deptData?.department_name || null,
        };
      });

      setUserRoles(normalized);

      // Set default college filter to first college
      if (collegesData.length > 0 && !selectedCollege) {
        setSelectedCollege(collegesData[0].college_id);
      }

      // Update roles with outdated status
      const rolesToUpdate = normalized.filter((r: any) => {
        const dbStatus = userRolesRes.data.find((orig: any) => orig.user_role_id === r.user_role_id)?.status ?? "Active";
        return dbStatus !== r.status;
      });

      await Promise.all(
        rolesToUpdate.map((role: any) =>
          api.put(`/tbl_user_role/${role.user_role_id}/`, { status: role.status })
        )
      );
    } catch (err: any) {
      console.error(err);
      toast.error('Error fetching data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Handle Account Save (Add/Edit)
  const handleSaveAccount = async () => {
    const { user_id, first_name, last_name, email_address, contact_number, status, middle_name } = newAccount;

    if (!(newAccount.user_id > 0) || !first_name || !last_name || !email_address || !contact_number) {
      toast.error('Please fill all required fields including User ID');
      return;
    }

    // Validate roles when adding new account
    if (!isEditMode && newAccountRoles.length === 0) {
      toast.error('Please add at least one role for the new account');
      return;
    }

    // Validate each role
    for (const role of newAccountRoles) {
      if (!role.role_id) {
        toast.error('Please select a role for all role entries');
        return;
      }
      
      if (!role.college_id && !role.department_id) {
        toast.error('Each role must have either a college or department assigned');
        return;
      }
    }

    try {
      if (isEditMode) {
        await api.put(`/accounts/${user_id}/`, {
          first_name,
          last_name,
          middle_name,
          email_address,
          contact_number,
          status,
        });
        toast.success('Account updated successfully!');
      } else {
        const defaultPassword = `${last_name}@${user_id}`;
        
        // Create account
        await api.post('/create-account/', {
          user_id,
          first_name,
          last_name,
          middle_name,
          email_address,
          contact_number,
          status,
          password: defaultPassword,
          created_at: new Date().toISOString(),
        });

        // Add roles
        for (const role of newAccountRoles) {
          await api.post("/tbl_user_role/CRUD/", {
            user: user_id,
            role: role.role_id,
            college: role.college_id || null,
            department: role.department_id || null,
            date_start: role.date_start || null,
            date_ended: role.date_ended || null,
            status: "Active",
          });
        }

        toast.success(`Account created with ${newAccountRoles.length} role(s)! Default password: ${last_name}@${user_id}`);
      }

      setShowAccountModal(false);
      setNewAccountRoles([]);
      await fetchData(); // Make sure to await this
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.detail || 'Error saving account');
    }
  };

  // Handle Account Delete
  const handleDeleteAccount = async (id: number) => {
    if (!globalThis.confirm('Are you sure you want to delete this account?')) return;

    try {
      // First, delete all roles associated with this user
      const userRolesToDelete = userRoles.filter(r => r.user === id);
      await Promise.all(
        userRolesToDelete.map(role => api.delete(`/tbl_user_role/${role.user_role_id}/`))
      );

      // Then delete the account
      await api.delete(`/accounts/${id}/`);
      toast.success('Account and associated roles deleted');
      fetchData();
    } catch (err: any) {
      console.error(err);
      toast.error('Error deleting account');
    }
  };

  const handleDeleteAllByCollege = async () => {
    if (!selectedCollege) {
        toast.warning('Please select a college first.');
        return;
    }

    if (!confirm(`Are you sure you want to delete all accounts for this college? This action cannot be undone.`)) return;

    try {
        // Filter userRoles for the selected college
        const accountsToDelete = userRoles
        .filter(r => r.college_id === selectedCollege)
        .map(r => r.user);

        // Remove duplicates
        const uniqueUserIds = Array.from(new Set(accountsToDelete));

        // For each user, delete their roles first, then the account
        for (const userId of uniqueUserIds) {
          const userRolesToDelete = userRoles.filter(r => r.user === userId);
          await Promise.all(
            userRolesToDelete.map(role => api.delete(`/tbl_user_role/${role.user_role_id}/`))
          );
          await api.delete(`/accounts/${userId}/`);
        }

        toast.success(`Deleted ${uniqueUserIds.length} account(s) and their roles from the selected college.`);
        fetchData();
    } catch (err: any) {
        console.error(err);
        toast.error('Error deleting accounts by college.');
    }
  };

  // Handle Role Add
  const handleAddRole = async () => {
    if (!newRole.role_id) {
      toast.error("Role is required.");
      return;
    }

    try {
      const payload = {
        user: newRole.user || selectedUserId,
        role: newRole.role_id,
        college: newRole.college_id || null,
        department: newRole.department_id || null,
        date_start: newRole.date_start || null,
        date_ended: newRole.date_ended || null,
        status: "Active",
      };

      const { data, status } = await api.post("/tbl_user_role/CRUD/", payload);

      if (!data || status !== 201) {
        toast.error("Failed to add role.");
        return;
      }

      toast.success("Role added successfully.");
      setUserRoles(prev => [...prev, data]);
      setShowAddRoleModal(false);
      setNewRole({});
    } catch (err) {
      console.error(err);
      toast.error("Failed to add role.");
    }
  };

  // Handle Role Edit
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

      toast.success("Role updated successfully.");
      setEditingRole(null);
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error("Failed to update role.");
    }
  };

  // Toggle Role Status
  const toggleUserRoleStatus = async (user_role_id: number, currentStatus: string) => {
    const newStatus = currentStatus === "Suspended" ? "Active" : "Suspended";

    try {
      const { data, status } = await api.put(`/tbl_user_role/${user_role_id}/`, {
        status: newStatus,
      });

      if (!data || status !== 200) {
        toast.error(`Failed to ${newStatus === "Active" ? "reactivate" : "suspend"} role.`);
        return;
      }

      toast.success(`Role ${newStatus === "Active" ? "reactivated" : "suspended"}.`);
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error(`Failed to ${newStatus === "Active" ? "reactivate" : "suspend"} role.`);
    }
  };

  // Delete Role
  const handleDeleteRole = async (user_role_id: number) => {
    if (!confirm('Are you sure you want to delete this role?')) return;

    try {
      const response = await api.delete(`/tbl_user_role/${user_role_id}/`);
      if (response.status === 200 || response.status === 204) {
        toast.success("Role deleted successfully.");
        setUserRoles(prev => prev.filter(r => r.user_role_id !== user_role_id));
      } else {
        toast.error("Failed to delete role.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete role.");
    }
  };

  // Import Accounts
  const handleImportAccounts = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async evt => {
      setImportLoading(true);
      toast.info('Importing accounts... Please wait.', { autoClose: false, toastId: 'import-progress' });
      
      const data = new Uint8Array(evt.target?.result as ArrayBuffer);
      const wb = XLSX.read(data, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

      let successCount = 0;
      let updatedCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      for (let rowIndex = 0; rowIndex < json.length; rowIndex++) {
        const row = json[rowIndex];
        const rowNumber = rowIndex + 2; // +2 because Excel rows start at 1 and header is row 1
        
        try {
          const user_id = Number(row.user_id ?? row.id);
          const first_name = String(row.first_name ?? '').trim();
          const last_name = String(row.last_name ?? '').trim();
          const middle_name = String(row.middle_name ?? '').trim();
          const email_address = String(row.email_address ?? '').trim();
          const contact_number = String(row.contact_number ?? '').trim();
          const status = String(row.status ?? 'Active');

          // Validation
          if (!user_id) {
            errors.push(`Row ${rowNumber}: Missing user_id`);
            errorCount++;
            continue;
          }
          if (!first_name) {
            errors.push(`Row ${rowNumber}: Missing first_name for user ${user_id}`);
            errorCount++;
            continue;
          }
          if (!last_name) {
            errors.push(`Row ${rowNumber}: Missing last_name for user ${user_id}`);
            errorCount++;
            continue;
          }
          if (!email_address) {
            errors.push(`Row ${rowNumber}: Missing email_address for user ${user_id}`);
            errorCount++;
            continue;
          }
          if (!contact_number) {
            errors.push(`Row ${rowNumber}: Missing contact_number for user ${user_id}`);
            errorCount++;
            continue;
          }

          // Check if account exists
          const existingAccount = accounts.find(acc => acc.user_id === user_id);
          const defaultPassword = `${last_name}@${user_id}`;

          if (existingAccount) {
            // Update existing account - only update fields that are not null/empty in the Excel
            const updateData: any = {};
            if (first_name) updateData.first_name = first_name;
            if (last_name) updateData.last_name = last_name;
            if (middle_name) updateData.middle_name = middle_name;
            if (email_address) updateData.email_address = email_address;
            if (contact_number) updateData.contact_number = contact_number;
            if (status) updateData.status = status;

            await api.put(`/accounts/${user_id}/`, updateData);
            updatedCount++;
          } else {
            // Create new account
            await api.post('/create-account/', {
              user_id,
              first_name,
              last_name,
              middle_name,
              email_address,
              contact_number,
              status,
              password: defaultPassword,
              created_at: new Date().toISOString(),
            });
            successCount++;
          }

          // Parse and add/update roles
          const rolesStr = String(row.roles ?? '').trim();
          const collegesStr = String(row.colleges ?? '').trim();
          const departmentsStr = String(row.departments ?? '').trim();
          const dateStartsStr = String(row.date_starts ?? '').trim();
          const dateEndedsStr = String(row.date_endeds ?? '').trim();

          if (rolesStr) {
            const roleIds = rolesStr.split(';').map(r => Number(r.trim())).filter(r => r > 0);
            const collegeIds = collegesStr.split(';').map(c => c.trim());
            const departmentIds = departmentsStr.split(';').map(d => d.trim());
            const dateStarts = dateStartsStr.split(';').map(d => excelSerialToDate(d.trim()));
            const dateEndeds = dateEndedsStr.split(';').map(d => excelSerialToDate(d.trim()));

            // Validate role data counts match
            if (roleIds.length !== collegeIds.length || roleIds.length !== departmentIds.length) {
              errors.push(`Row ${rowNumber}: Mismatch in role data counts (roles: ${roleIds.length}, colleges: ${collegeIds.length}, departments: ${departmentIds.length})`);
              continue;
            }

            for (let i = 0; i < roleIds.length; i++) {
              const roleId = roleIds[i];
              const collegeId = collegeIds[i] || null;
              const departmentId = departmentIds[i] || null;
              const dateStart = dateStarts[i];
              const dateEnded = dateEndeds[i];

              // Validate role exists
              const roleExists = roles.find(r => r.role_id === roleId);
              if (!roleExists) {
                errors.push(`Row ${rowNumber}: Invalid role ID ${roleId} for user ${user_id}`);
                continue;
              }

              // Validate college or department is provided
              if (!collegeId && !departmentId) {
                errors.push(`Row ${rowNumber}: Role ${roleId} for user ${user_id} must have either college or department`);
                continue;
              }

              // Validate college exists if provided
              if (collegeId && !colleges.find(c => c.college_id === collegeId)) {
                errors.push(`Row ${rowNumber}: Invalid college ID "${collegeId}" for user ${user_id}`);
                continue;
              }

              // Validate department exists if provided
              if (departmentId && !departments.find(d => d.department_id === departmentId)) {
                errors.push(`Row ${rowNumber}: Invalid department ID "${departmentId}" for user ${user_id}`);
                continue;
              }

              // Validate dates
              if (dateStart && !/^\d{4}-\d{2}-\d{2}$/.test(dateStart)) {
                errors.push(`Row ${rowNumber}: Invalid date_start format for user ${user_id}, role ${roleId}`);
                continue;
              }
              if (dateEnded && !/^\d{4}-\d{2}-\d{2}$/.test(dateEnded)) {
                errors.push(`Row ${rowNumber}: Invalid date_ended format for user ${user_id}, role ${roleId}`);
                continue;
              }

              try {
                await api.post("/tbl_user_role/CRUD/", {
                  user: user_id,
                  role: roleId,
                  college: collegeId,
                  department: departmentId,
                  date_start: dateStart,
                  date_ended: dateEnded,
                  status: "Active",
                });
              } catch (roleErr: any) {
                const errorMsg = roleErr.response?.data?.detail || roleErr.response?.data?.error || roleErr.message || 'Unknown error';
                errors.push(`Row ${rowNumber}: Failed to add role ${roleId} for user ${user_id} - ${errorMsg}`);
              }
            }
          }
        } catch (err: any) {
          const errorMsg = err.response?.data?.detail || err.response?.data?.error || err.message || 'Unknown error';
          errors.push(`Row ${rowNumber}: ${errorMsg}`);
          errorCount++;
        }
      }

      toast.dismiss('import-progress');

      // Show results
      const messages: string[] = [];
      if (successCount > 0) messages.push(`${successCount} new account(s) created`);
      if (updatedCount > 0) messages.push(`${updatedCount} account(s) updated`);
      if (errorCount > 0) messages.push(`${errorCount} account(s) failed`);

      if (messages.length > 0) {
        toast.success(messages.join(', '));
      }

      // Show detailed errors
      if (errors.length > 0) {
        console.error('Import errors:', errors);
        toast.error(
          <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
            <strong>Import errors:</strong>
            <ul style={{ margin: '10px 0', paddingLeft: '20px', fontSize: '12px' }}>
              {errors.slice(0, 10).map((error, idx) => (
                <li key={idx}>{error}</li>
              ))}
              {errors.length > 10 && <li>... and {errors.length - 10} more errors (check console)</li>}
            </ul>
          </div>,
          { autoClose: 10000 }
        );
      }
      
      await fetchData();
      setImportLoading(false);
      setShowImportAccountsModal(false);
    };

    reader.readAsArrayBuffer(file);
  };

  // Import Roles
  const handleImportRoles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      setImportLoading(true); // Start loading
      toast.info('Importing roles... Please wait.', { autoClose: false, toastId: 'import-roles-progress' });
      
      const data = new Uint8Array(evt.target?.result as ArrayBuffer);
      const wb = XLSX.read(data, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json: any[] = XLSX.utils.sheet_to_json(ws);

      let successCount = 0;
      let errorCount = 0;

      for (const row of json) {
        const { user, role, college, department, date_start, date_ended } = row;

        if (!user || !role) {
          console.warn('Skipping invalid row:', row);
          errorCount++;
          continue;
        }

        try {
          await api.post("/tbl_user_role/CRUD/", {
            user,
            role,
            college: college || null,
            department: department || null,
            date_start: date_start || null,
            date_ended: date_ended || null,
            status: "Active",
          });
          successCount++;
        } catch (err) {
          console.error(err);
          errorCount++;
        }
      }

      toast.dismiss('import-roles-progress'); // Dismiss loading toast

      if (successCount > 0) {
        toast.success(`Successfully imported ${successCount} role(s)`);
      }
      if (errorCount > 0) {
        toast.warning(`Failed to import ${errorCount} role(s)`);
      }

      await fetchData();
      setImportLoading(false); // End loading
      setShowImportRolesModal(false);
    };

    reader.readAsArrayBuffer(file);
  };

  // Download Templates
  const downloadAccountsTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['user_id', 'first_name', 'last_name', 'middle_name', 'email_address', 'contact_number', 'status', 'roles', 'colleges', 'departments', 'date_starts', 'date_endeds'],
      [2025000001, 'Juan', 'Dela Cruz', 'A.', 'juan@example.com', '09123456789', 'Active', '1;2', 'CITC;CITC', 'DIT;', '2025-01-01', '2025-12-31'],
      [2025000002, 'Maria', 'Santos', 'B.', 'maria@example.com', '09987654321', 'Active', '3', '', 'DIT', '2025-01-01', '2025-12-31'],
    ]);
    
    // Add note
    XLSX.utils.sheet_add_aoa(ws, [
      [''],
      ['INSTRUCTIONS:'],
      ['- Multiple roles can be added by separating values with semicolons (;)'],
      ['- roles: Use role IDs (e.g., 1;2;3 for three roles)'],
      ['- Roles: 1 (Dean), 2 (Admin), 3 (Scheduler), 4 (Bayanihan Leader), 5 (Proctor)'],
      ['- colleges: Use college IDs or leave empty (e.g., CITC;CAS)'],
      ['- departments: Use department IDs or leave empty (e.g., DIT;DCIT;)'],
      ['- Each role must have either a college OR department (or both)'],
      ['- date_starts and date_endeds: Use format YYYY-MM-DD or leave empty'],
      ['- Make sure the number of values in roles, colleges, departments, date_starts, and date_endeds match']
    ], { origin: 'A5' });
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'ImportTemplate');
    XLSX.writeFile(wb, 'Accounts_Import_Template.xlsx');
  };

  const downloadRolesTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['user', 'role', 'college', 'department', 'date_start', 'date_ended'],
      [2025000001, 1, 'CITC', 'DIT', '2025-01-01', '2025-12-31'],
      [2025000001, 2, 'CITC', '', '2025-01-01', '2025-12-31']
    ]);
    
    // Add note
    XLSX.utils.sheet_add_aoa(ws, [
      [''],
      ['INSTRUCTIONS:'],
      ['- user: User ID number'],
      ['- role: Role ID number'],
      ['- college: College ID (can be empty if department is provided)'],
      ['- department: Department ID (can be empty if college is provided)'],
      ['- Each role must have either college OR department (or both)'],
      ['- date_start and date_ended: Use format YYYY-MM-DD or leave empty']
    ], { origin: 'A5' });
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'RolesTemplate');
    XLSX.writeFile(wb, 'UserRoles_Import_Template.xlsx');
  };

  // Get roles for a user
  const getUserRoles = (userId: number) => {
    return userRoles.filter(r => r.user === userId);
  };

  // Enhanced filtering with college and search
  const filteredAccounts = accounts.filter(account => {
    const fullName = `${account.first_name} ${account.last_name} ${account.middle_name || ''}`.toLowerCase();
    const userId = account.user_id.toString();
    const email = account.email_address.toLowerCase();
    const search = searchTerm.toLowerCase();

    // Get user's roles
    const accountRoles = getUserRoles(account.user_id);
    const roleNames = accountRoles.map(r => r.role_name?.toLowerCase() || '').join(' ');

    // Check if matches search term (ID, name, email, or role)
    const matchesSearch = !searchTerm || 
      userId.includes(search) || 
      fullName.includes(search) || 
      email.includes(search) ||
      roleNames.includes(search);

    // Check if matches college filter
    const matchesCollege = !selectedCollege || 
      accountRoles.some(r => r.college_id === selectedCollege);

    return matchesSearch && matchesCollege;
  });

  // Add new account role
  const addNewAccountRole = () => {
    setNewAccountRoles(prev => [...prev, {
      role_id: 0,
      college_id: null,
      department_id: null,
      date_start: null,
      date_ended: null
    }]);
  };

  // Remove account role
  const removeNewAccountRole = (index: number) => {
    setNewAccountRoles(prev => prev.filter((_, i) => i !== index));
  };

  // Update account role
  const updateNewAccountRole = (index: number, field: keyof NewAccountRole, value: any) => {
    setNewAccountRoles(prev => prev.map((role, i) => 
      i === index ? { ...role, [field]: value } : role
    ));
  };

  // Helper function to convert Excel serial date to YYYY-MM-DD format
  const excelSerialToDate = (serial: string | number): string | null => {
    if (!serial) return null;
    
    const num = Number(serial);
    
    // If it's already a valid date string (YYYY-MM-DD format), return it
    if (isNaN(num) && /^\d{4}-\d{2}-\d{2}$/.test(String(serial))) {
      return String(serial);
    }
    
    // If it's not a number, return null
    if (isNaN(num)) return null;
    
    // Excel serial date starts from 1900-01-01
    // Note: Excel incorrectly treats 1900 as a leap year, so we need to account for that
    const excelEpoch = new Date(1899, 11, 30); // December 30, 1899
    const date = new Date(excelEpoch.getTime() + num * 24 * 60 * 60 * 1000);
    
    // Format as YYYY-MM-DD
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  };

  return (
    <div className="accounts-container">
      <div className="accounts-header">
        <h2 className="accounts-title">User Management</h2>
        <div className="search-bar">
          <input
            placeholder="Search by ID, name, email, or role..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button type="button" className="search-button"><FaSearch /></button>
        </div>
      </div>

      <div className="accounts-actions">
        <button
          type="button"
          className="action-button add-new"
          onClick={() => {
            setIsEditMode(false);
            setShowAccountModal(true);
            setNewAccount({
              user_id: 0,
              first_name: '',
              last_name: '',
              middle_name: '',
              email_address: '',
              contact_number: '',
              status: 'Active',
              created_at: new Date().toISOString(),
            });
            setNewAccountRoles([{
              role_id: 0,
              college_id: null,
              department_id: null,
              date_start: null,
              date_ended: null
            }]);
          }}
        >
          <FaPlus/>
        </button>

        <button
          type="button"
          className="action-button import"
          onClick={() => setShowImportAccountsModal(true)}
        >
          <FaFileImport/>
        </button>

        <button
        type="button"
        className="action-button delete"
        style={{ backgroundColor: multiSelectMode ? '#d9534f' : '#f0ad4e', color: 'white', justifyContent: 'center', alignContent: 'center', fontSize: 'small', display: 'flex', borderRadius: '50px' }}
        onClick={() => {
            if (multiSelectMode && selectedAccounts.length > 0) {
              // Delete selected accounts
              if (!confirm(`Delete ${selectedAccounts.length} selected account(s)?`)) return;

              Promise.all(
                selectedAccounts.map(async id => {
                  // Delete roles first
                  const userRolesToDelete = userRoles.filter(r => r.user === id);
                  await Promise.all(
                    userRolesToDelete.map(role => api.delete(`/tbl_user_role/${role.user_role_id}/`))
                  );
                  // Then delete account
                  return api.delete(`/accounts/${id}/`);
                })
              )
                  .then(() => {
                  toast.success(`${selectedAccounts.length} account(s) and their roles deleted.`);
                  fetchData();
                  setSelectedAccounts([]);
                  })
                  .catch(err => {
                  console.error(err);
                  toast.error('Error deleting selected accounts.');
                  });
            }
            setMultiSelectMode(!multiSelectMode);
        }}
        >
        {multiSelectMode ? 'Delete Selected' : 'Select Accounts'}
        </button>

        <button
            type="button"
            className="action-button delete"
            onClick={handleDeleteAllByCollege}
            style={{ backgroundColor: '#d9534f', color: 'white', justifyContent: 'center', alignContent: 'center', fontSize: 'small', display: 'flex', borderRadius: '50px' }}
        >
            Delete All by College
        </button>
        
        <div className="input-group">
          <select
            value={selectedCollege}
            onChange={(e) => setSelectedCollege(e.target.value)}
            style={{backgroundColor: 'white', color: 'black', justifyContent: 'center', padding: '8px', alignContent: 'center', fontSize: 'small', display: 'flex', borderRadius: '50px' }}
          >
            <option value="">All Colleges</option>
            {colleges.map(college => (
              <option key={college.college_id} value={college.college_id}>
                {college.college_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="accounts-table-container">
        <table className="accounts-table">
          <thead>
            <tr>
              <th>#</th>
              <th>ID</th>
              <th>Full Name</th>
              <th>Email</th>
              <th>Contact</th>
              <th>Role/s</th>
              <th>Status</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} style={{ textAlign: "center", padding: "20px" }}>
                  Loading users...
                </td>
              </tr>
            ) : filteredAccounts.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: "center", padding: "20px" }}>
                  No users found.
                </td>
              </tr>
            ) : (
                filteredAccounts.map((account, index) => {
                    const accountRoles = getUserRoles(account.user_id);
                    const isSelected = selectedAccounts.includes(account.user_id);

                    return (
                    <tr
                        key={account.user_id}
                        style={{
                        backgroundColor: isSelected ? '#f8d7da' : 'transparent',
                        cursor: multiSelectMode ? 'pointer' : 'default'
                        }}
                        onClick={() => {
                        if (!multiSelectMode) return;
                        setSelectedAccounts(prev =>
                            prev.includes(account.user_id)
                            ? prev.filter(id => id !== account.user_id)
                            : [...prev, account.user_id]
                        );
                        }}
                    >
                        <td>{index + 1}</td>
                        <td>{account.user_id}</td>
                        <td>{account.last_name}, {account.first_name} {account.middle_name ?? ''}</td>
                        <td>{account.email_address}</td>
                        <td>{account.contact_number}</td>
                        <td>
                        {accountRoles.length > 0 ? (
                            <pre style={{ whiteSpace: 'pre-wrap', margin: 0, fontSize: '0.85em' }}>
                            {accountRoles
                                .map(role => {
                                const office = [role.college_id, role.department_id].filter(Boolean).join(' / ');
                                return `${role.role_name}${office ? ` - ${office}` : ''}`;
                                })
                                .join('\n')}
                            </pre>
                        ) : '-'}
                        </td>
                        <td style={{ color: account.status === 'Suspended' ? 'red' : 'green', fontWeight: 'bold' }}>
                        {account.status}
                        </td>
                        <td>{new Date(account.created_at).toLocaleDateString()}</td>
                        <td className="action-buttons">
                        {!multiSelectMode && (
                            <button
                            type="button"
                            className="action-button import"
                            style={{ fontSize: '0.85em', padding: '5px 10px' }}
                            onClick={() => {
                                setSelectedUserId(account.user_id);
                                setShowDetailsModal(true);
                            }}
                            >
                            View
                            </button>
                        )}
                        </td>
                    </tr>
                    );
                })
            )}
            </tbody>
        </table>
      </div>

      {/* User Details Modal */}
      {showDetailsModal && selectedUserId !== null && (
        <div className="modal-overlay">
            <div className="user-details-modal fixed-modal">
            <h3 className="modal-title">User Details</h3>

            {(() => {
                const account = accounts.find(a => a.user_id === selectedUserId);
                if (!account) return null;

                return (
                <div className="account-summary-card horizontal-layout">
                    <div className="account-column">
                    <p><strong className="account-label">User ID:</strong> {account.user_id}</p>
                    <p><strong className="account-label">Full Name:</strong> {account.last_name}, {account.first_name} {account.middle_name || ''}</p>
                    <p><strong className="account-label">Email:</strong> {account.email_address}</p>
                    </div>
                    <div className="account-column">
                    <p><strong className="account-label">Contact:</strong> {account.contact_number}</p>
                    <p><strong className="account-label">Status:</strong>
                        <span className={`account-status ${account.status === 'Suspended' ? 'suspended' : 'active'}`}>
                        {account.status}
                        </span>
                    </p>
                    <div className="account-actions">
                        <button
                        type="button"
                        className="icon-button edit-button"
                        onClick={() => {
                            setNewAccount(account);
                            setIsEditMode(true);
                            setShowAccountModal(true);
                        }}
                        title="Edit Account"
                        >
                        <FaPen /> Edit Account
                        </button>
                        <button
                        type="button"
                        className="icon-button delete-button"
                        onClick={() => handleDeleteAccount(account.user_id)}
                        title="Delete Account"
                        >
                        <FaTrash /> Delete Account
                        </button>
                    </div>
                    </div>
                </div>
                );
            })()}

            <h4 className="modal-subtitle">Assigned Roles</h4>
            <table className="accounts-table user-roles-table">
                <thead>
                <tr>
                    <th>Role</th>
                    <th>Office</th>
                    <th>Start</th>
                    <th>End</th>
                    <th>Created At</th>
                    <th>Status</th>
                    <th>Actions</th>
                </tr>
                </thead>
                <tbody>
                {userRoles
                    .filter(r => r.user === selectedUserId)
                    .map(role => (
                    <tr key={role.user_role_id}>
                        <td>{role.role_name || '-'}</td>
                        <td>{[role.college_name, role.department_name].filter(Boolean).join(' / ') || '-'}</td>
                        <td className="role-date start">{role.date_start?.split('T')[0] || '-'}</td>
                        <td className="role-date end">{role.date_ended?.split('T')[0] || '-'}</td>
                        <td>{role.created_at ? new Date(role.created_at).toLocaleString('en-US', {
                            month: '2-digit',
                            day: '2-digit',
                            year: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true,
                        }) : '—'}</td>
                        <td>
                        <span className={`role-status ${role.status === 'Suspended' ? 'suspended' : 'active'}`}>
                            {role.status || 'Active'}
                        </span>
                        </td>
                        <td className="role-actions">
                        <button className="icon-button edit-button" onClick={() => setEditingRole(role)} title="Edit Role">
                            <FaPen />
                        </button>
                        <button
                            className={`icon-button ${role.status === 'Suspended' ? 'reactivate-button' : 'delete-button'}`}
                            onClick={() => toggleUserRoleStatus(role.user_role_id, role.status || 'Active')}
                            title={role.status === 'Suspended' ? 'Reactivate Role' : 'Suspend Role'}
                        >
                            {role.status === 'Suspended' ? <FaLockOpen /> : <FaLock />}
                        </button>
                        <button className="icon-button delete-button" onClick={() => handleDeleteRole(role.user_role_id)} title="Delete Role">
                            <FaTrash />
                        </button>
                        </td>
                    </tr>
                    ))}
                </tbody>
            </table>

            <div className="modal-footer">
                <button className="modal-button cancel" onClick={() => setShowDetailsModal(false)}>Close</button>
                <button className="modal-button save" onClick={() => { setNewRole({ user: selectedUserId }); setShowAddRoleModal(true); }}>Add Role</button>
            </div>
            </div>
        </div>
        )}

      {/* Add/Edit Account Modal */}
      {showAccountModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h4 style={{ textAlign: 'center' }}>{isEditMode ? 'Edit Account' : 'Add New Account'}</h4>

            {['user_id', 'first_name', 'last_name', 'middle_name', 'email_address', 'contact_number'].map((field) => (
              <div key={field} className="input-group">
                <label htmlFor={field}>
                  {field === 'user_id' ? 'USER ID' : field.replace('_', ' ').toUpperCase()}
                </label>
                <input
                  id={field}
                  type={field === 'user_id' ? 'number' : 'text'}
                  value={(newAccount as any)[field] ?? ''}
                  onChange={(e) =>
                    setNewAccount((prev) => ({
                      ...prev,
                      [field]: field === 'user_id' ? Number(e.target.value) : e.target.value,
                    }))
                  }
                  disabled={isEditMode && field === 'user_id'}
                />
              </div>
            ))}

            <div className="input-group">
              <label htmlFor="status">STATUS</label>
              <select
                id="status"
                value={newAccount.status}
                onChange={(e) => setNewAccount(prev => ({ ...prev, status: e.target.value }))}
              >
                <option value="Active">Active</option>
                <option value="Suspended">Suspended</option>
              </select>
            </div>

            {!isEditMode && (
              <>
                <div style={{ borderTop: '2px solid #ddd', marginTop: '20px', paddingTop: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                    <h4 style={{ margin: 0 }}>Roles (Required)</h4>
                    <button
                      type="button"
                      className="action-button add-new"
                      style={{ fontSize: '0.85em', padding: '5px 10px' }}
                      onClick={addNewAccountRole}
                    >
                      <FaPlus /> Add Role
                    </button>
                  </div>

                  {newAccountRoles.map((role, index) => (
                    <div key={index} style={{ border: '1px solid #ddd', padding: '15px', marginBottom: '15px', borderRadius: '5px', position: 'relative' }}>
                      <button
                        type="button"
                        onClick={() => removeNewAccountRole(index)}
                        style={{
                          position: 'absolute',
                          top: '10px',
                          right: '10px',
                          background: '#d9534f',
                          color: 'white',
                          border: 'none',
                          borderRadius: '50%',
                          width: '25px',
                          height: '25px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        <FaTimes />
                      </button>

                      <div className="input-group">
                        <label>Role</label>
                        <select
                          value={role.role_id || ''}
                          onChange={(e) => {
                            const role_id = Number(e.target.value);
                            const allowed = getAllowedFields(role_id);
                            updateNewAccountRole(index, 'role_id', role_id);
                            if (!allowed.college) updateNewAccountRole(index, 'college_id', null);
                            if (!allowed.department) updateNewAccountRole(index, 'department_id', null);
                          }}
                        >
                          <option value="">Select Role</option>
                          {roles.map(r => (
                            <option key={r.role_id} value={r.role_id}>{r.role_name}</option>
                          ))}
                        </select>
                      </div>

                      {getAllowedFields(role.role_id).college && (
                        <div className="input-group">
                          <label>College</label>
                          <select
                            value={role.college_id || ''}
                            onChange={(e) => updateNewAccountRole(index, 'college_id', e.target.value || null)}
                          >
                            <option value="">None</option>
                            {colleges.map(c => (
                              <option key={c.college_id} value={c.college_id}>{c.college_name}</option>
                            ))}
                          </select>
                        </div>
                      )}

                      {getAllowedFields(role.role_id).department && (
                        <div className="input-group">
                          <label>Department</label>
                          <select
                            value={role.department_id || ''}
                            onChange={(e) => updateNewAccountRole(index, 'department_id', e.target.value || null)}
                          >
                            <option value="">None</option>
                            {departments.map(d => (
                              <option key={d.department_id} value={d.department_id}>({d.department_id}) {d.department_name}</option>
                            ))}
                          </select>
                        </div>
                      )}

                      <div className="input-group">
                        <label>Start Date</label>
                        <div className="date-input-wrapper">
                          <FaCalendarAlt className="calendar-icon" />
                          <input
                            type="date"
                            value={role.date_start || ''}
                            onChange={(e) => updateNewAccountRole(index, 'date_start', e.target.value || null)}
                          />
                        </div>
                      </div>

                      <div className="input-group">
                        <label>End Date</label>
                        <div className="date-input-wrapper">
                          <FaCalendarAlt className="calendar-icon" />
                          <input
                            type="date"
                            value={role.date_ended || ''}
                            onChange={(e) => updateNewAccountRole(index, 'date_ended', e.target.value || null)}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <p style={{ fontSize: '12px', color: '#666', marginTop: '10px' }}>
                  Default password will be: <strong>{newAccount.last_name}@{newAccount.user_id}</strong>
                </p>
              </>
            )}

            <div className="modal-buttons">
              <button type="button" className="modal-button save" onClick={handleSaveAccount}>Save</button>
              <button type="button" className="modal-button cancel" onClick={() => setShowAccountModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Role Modal */}
      {showAddRoleModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ width: 600 }}>
            <h3>Add New Role</h3>
            <div className="input-group">
              <label>Role</label>
              <select
                value={newRole.role_id ?? ''}
                onChange={e => {
                  const role_id = e.target.value ? Number(e.target.value) : undefined;
                  const allowed = getAllowedFields(role_id);

                  setNewRole(prev => ({
                    ...prev,
                    role_id,
                    role: role_id,
                    college_id: allowed.college ? prev.college_id : undefined,
                    department_id: allowed.department ? prev.department_id : undefined,
                  }));
                }}
              >
                <option value="">Select Role</option>
                {roles.map(role => (
                  <option key={role.role_id} value={role.role_id}>{role.role_name}</option>
                ))}
              </select>
            </div>
            {getAllowedFields(newRole.role_id).college && (
              <div className="input-group">
                <label>College</label>
                <select
                  value={newRole.college_id || ''}
                  onChange={e => setNewRole(prev => ({ ...prev, college_id: e.target.value || null }))}
                >
                  <option value="">None</option>
                  {colleges.map(c => (
                    <option key={c.college_id} value={c.college_id}>{c.college_name}</option>
                  ))}
                </select>
              </div>
            )}
            {getAllowedFields(newRole.role_id).department && (
              <div className="input-group">
                <label>Department</label>
                <select
                  value={newRole.department_id || ''}
                  onChange={e => setNewRole(prev => ({ ...prev, department_id: e.target.value || null }))}
                >
                  <option value="">None</option>
                  {departments.map(d => (
                    <option key={d.department_id} value={d.department_id}>({d.department_id}) {d.department_name}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="input-group">
              <label>Start Date</label>
              <div className="date-input-wrapper">
                <FaCalendarAlt className="calendar-icon" />
                <input
                  type="date"
                  value={newRole.date_start?.split('T')[0] || ''}
                  onChange={e => setNewRole(prev => ({ ...prev, date_start: e.target.value }))}
                />
              </div>
            </div>
            <div className="input-group">
              <label>End Date</label>
              <div className="date-input-wrapper">
                <FaCalendarAlt className="calendar-icon" />
                <input
                  type="date"
                  value={newRole.date_ended?.split('T')[0] || ''}
                  onChange={e => setNewRole(prev => ({ ...prev, date_ended: e.target.value }))}
                />
              </div>
            </div>
            <div className="modal-actions">
              <button className="modal-button save" onClick={handleAddRole}>Save</button>
              <button className="modal-button cancel" onClick={() => setShowAddRoleModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Role Modal */}
      {editingRole && (
        <div className="modal-overlay">
          <div className="modal" style={{ width: 600 }}>
            <h3>Edit Role</h3>
            <div className="input-group">
              <label>Role</label>
              <select
                value={editingRole?.role ?? ''}
                onChange={e => {
                  const role_id = e.target.value ? Number(e.target.value) : undefined;
                  const allowed = getAllowedFields(role_id);

                  setEditingRole(prev => prev && ({
                    ...prev,
                    role: role_id!,
                    role_id,
                    college_id: allowed.college ? prev.college_id : undefined,
                    department_id: allowed.department ? prev.department_id : undefined,
                  }));
                }}
              >
                <option value="">Select Role</option>
                {roles.map(role => (
                  <option key={role.role_id} value={role.role_id}>{role.role_name}</option>
                ))}
              </select>
            </div>
            {getAllowedFields(editingRole?.role).college && (
              <div className="input-group">
                <label>College</label>
                <select
                  value={editingRole?.college_id || ''}
                  onChange={e => setEditingRole(prev => prev && { ...prev, college_id: e.target.value || null })}
                >
                  <option value="">None</option>
                  {colleges.map(c => (
                    <option key={c.college_id} value={c.college_id}>{c.college_name}</option>
                  ))}
                </select>
              </div>
            )}
            {getAllowedFields(editingRole?.role).department && (
              <div className="input-group">
                <label>Department</label>
                <select
                  value={editingRole?.department_id || ''}
                  onChange={e => setEditingRole(prev => prev && { ...prev, department_id: e.target.value || null })}
                >
                  <option value="">None</option>
                  {departments.map(d => (
                    <option key={d.department_id} value={d.department_id}>{d.department_name}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="input-group">
              <label>Start Date</label>
              <div className="date-input-wrapper">
                <FaCalendarAlt className="calendar-icon" />
                <input
                  type="date"
                  value={editingRole.date_start?.split('T')[0] || ''}
                  onChange={e => setEditingRole(prev => prev && { ...prev, date_start: e.target.value })}
                />
              </div>
            </div>
            <div className="input-group">
              <label>End Date</label>
              <div className="date-input-wrapper">
                <FaCalendarAlt className="calendar-icon" />
                <input
                  type="date"
                  value={editingRole.date_ended?.split('T')[0] || ''}
                  onChange={e => setEditingRole(prev => prev && { ...prev, date_ended: e.target.value })}
                />
              </div>
            </div>
            <div className="modal-actions">
              <button className="modal-button save" onClick={handleUpdateRole}>Save</button>
              <button className="modal-button cancel" onClick={() => setEditingRole(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Import Accounts Modal */}
      {showImportAccountsModal && (
        <div className="modal-overlay">
          <div className="modal" style={{
            background: "#fff",
            padding: "25px",
            borderRadius: "12px",
            width: "420px",
            maxWidth: "95%",
            boxShadow: "0px 4px 20px rgba(0,0,0,0.15)",
            display: "flex",
            flexDirection: "column",
            }}>
            <h3 style={{ textAlign: "center", marginBottom: "20px", color: "#333" }}>
                Import Accounts from Excel
            </h3>

            {/* Info Box */}
            <div
                style={{
                backgroundColor: "#f1f3f5",
                padding: "15px",
                borderRadius: "8px",
                marginTop: "20px",
                fontSize: "13px",
                lineHeight: "1.4",
                color: "#333",
                }}
            >
                <strong style={{ color: "#000" }}>Excel Format Requirements:</strong>
                <ul style={{ marginTop: "10px", paddingLeft: "20px" }}>
                <li><strong>roles:</strong> IDs separated by semicolons (e.g., "1;2;3")</li>
                <li><strong>colleges:</strong> IDs separated by semicolons (e.g., "CITC;CAS")</li>
                <li><strong>departments:</strong> IDs separated by semicolons (e.g., "DIT;DCIT;")</li>
                <li><strong>date_starts/date_endeds:</strong> YYYY-MM-DD format, separated by semicolons</li>
                <li>Blank colleges/departments allowed, but each role must have at least one</li>
                <li>All role-related columns must have the same number of values</li>
                </ul>
            </div>

            {/* File Input */}
            <div style={{ marginBottom: "15px" }}>
                <label style={{ color: "#000", fontWeight: 600, display: "block", marginBottom: "6px" }}>
                Upload Excel File
                </label>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleImportAccounts}
                  disabled={importLoading}
                  style={{
                    width: "100%",
                    padding: "8px",
                    borderRadius: "6px",
                    border: "1px solid #ccc",
                    opacity: importLoading ? 0.5 : 1,
                    cursor: importLoading ? 'not-allowed' : 'pointer'
                  }}
                />
            </div>

            <p style={{ fontSize: "12px", color: "#444", marginBottom: "20px" }}>
                Default password format: <strong>LastName@UserID</strong>
            </p>

            {/* Buttons */}
            <div style={{
                display: "flex",
                justifyContent: "space-between",
                marginTop: "10px",
            }}>
                <button
                type="button"
                className="modal-button download"
                onClick={downloadAccountsTemplate}
                style={{
                    background: "#2d6cdf",
                    color: "#fff",
                    padding: "10px 15px",
                    borderRadius: "8px",
                    border: "none",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    cursor: "pointer",
                    fontWeight: 600,
                }}
                >
                <FaDownload /> Download Template
                </button>

                <button
                type="button"
                className="modal-button cancel"
                onClick={() => setShowImportAccountsModal(false)}
                style={{
                    background: "#ddd",
                    padding: "10px 15px",
                    borderRadius: "8px",
                    border: "none",
                    cursor: "pointer",
                    fontWeight: 600,
                }}
                >
                Close
                </button>
            </div>
            </div>
        </div>
      )}

      {/* Import Roles Modal */}
      {showImportRolesModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h4 style={{ textAlign: 'center' }}>Import Roles from Excel</h4>
            <div style={{ backgroundColor: '#f8f9fa', padding: '15px', borderRadius: '5px', marginBottom: '15px', fontSize: '13px' }}>
              <div
                style={{
                backgroundColor: "#f1f3f5",
                padding: "15px",
                borderRadius: "8px",
                marginBottom: "-50px",
                fontSize: "13px",
                lineHeight: "1.4",
                color: "#333",
                }}
            >
                <strong style={{ color: "#000" }}>Excel Format Requirements:</strong>
                <ul style={{ marginTop: "1px", paddingLeft: "20px" }}>
                    <li><strong>user:</strong> User ID (number)</li>
                    <li><strong>role:</strong> Role ID (number)</li>
                    <li><strong>college:</strong> College ID (can be empty if department provided)</li>
                    <li><strong>department:</strong> Department ID (can be empty if college provided)</li>
                    <li>Each role must have at least one: college OR department (or both)</li>
                </ul>
              </div>
            </div>
            <div className="input-group">
              <label>Upload Excel File</label>
              <input 
                type="file" 
                accept=".xlsx, .xls" 
                onChange={handleImportRoles}
                disabled={importLoading}
                style={{
                  opacity: importLoading ? 0.5 : 1,
                  cursor: importLoading ? 'not-allowed' : 'pointer'
                }}
              />
            </div>
            <div className="modal-buttons">
              <button type="button" className="modal-button download" onClick={downloadRolesTemplate}>
                <FaDownload /> Download Template
              </button>
              <button type="button" className="modal-button cancel" onClick={() => setShowImportRolesModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer position="top-right" autoClose={3000} />
      {importLoading && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '30px',
            borderRadius: '10px',
            textAlign: 'center'
          }}>
            <div style={{
              border: '4px solid #f3f3f3',
              borderTop: '4px solid #3498db',
              borderRadius: '50%',
              width: '50px',
              height: '50px',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 20px'
            }}></div>
            <p style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Importing data...</p>
            <p style={{ margin: '10px 0 0', fontSize: '14px', color: '#666' }}>Please wait, this may take a moment.</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;