// deno-lint-ignore-file no-explicit-any jsx-button-has-type
import React, { useState, useEffect } from 'react';
import { api } from '../lib/apiClient.ts';
import { ToastContainer, toast } from 'react-toastify';
import { FaSearch, FaTrash, FaDownload, FaPen, FaCalendarAlt, FaLock, FaLockOpen} from 'react-icons/fa';
import * as XLSX from 'xlsx';
import 'react-toastify/dist/ReactToastify.css';
import '../styles/userroles.css';

interface Role {
  role_id: number;
  role_name: string;
}

interface User {
  user_id: number;
  full_name: string;
  created_at: string;
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

  // --- User ---
  user: number;              // Django FK field
  user_id?: number;          // kept for backward compatibility
  user_full_name?: string;   // optional name for display

  // --- Role ---
  role: number;
  role_id?: number;
  role_name?: string;

  // --- College ---
  college: string | null;        // Django FK field (college_id)
  college_id?: string | null;    // backward compatibility
  college_name?: string | null;  // readable name

  // --- Department ---
  department: string | null;         // Django FK field (department_id)
  department_id?: string | null;     // backward compatibility
  department_name?: string | null;   // readable name

  // --- Dates ---
  created_at: string | null;
  date_start: string | null;
  date_ended: string | null;

  // --- Status ---
  status?: string | null;
};



const UserRoles = () => {
  const [roles, setRoles] = useState<Role[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [colleges, setColleges] = useState<College[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);

  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showAddRoleModal, setShowAddRoleModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [newRole, setNewRole] = useState<Partial<UserRole>>({});
  const [editingRole, setEditingRole] = useState<UserRole | null>(null);

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
        return { college: true, department: true }; // fallback
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch all data in parallel
      const [rolesRes, usersRes, collegesRes, departmentsRes, userRolesRes] = await Promise.all([
        api.get('/tbl_roles/'),        // GET roles
        api.get('/users/'),        // GET users
        api.get('/tbl_college/'),     // GET colleges
        api.get('/departments/'),  // GET departments
        api.get('/tbl_user_role'),   // GET user_roles
      ]);

      // Check if any request failed
      if (
        !rolesRes.data || !usersRes.data || !collegesRes.data ||
        !departmentsRes.data || !userRolesRes.data
      ) {
        toast.error("Failed to fetch data");
        return;
      }

      // Set roles
      setRoles(rolesRes.data);

      // Normalize users
      setUsers(
        usersRes.data.map((u: any) => ({
          user_id: u.user_id,
          full_name: `${u.last_name}, ${u.first_name}`,
          created_at: u.created_at,
        }))
      );

      // Set colleges & departments
      setColleges(collegesRes.data);
      setDepartments(departmentsRes.data);

      const today = new Date().toISOString().split("T")[0];

      // Compute correct status for each role
      const normalized = userRolesRes.data.map((r: any) => {
        let computedStatus = r.status ?? "Active";
        if (r.date_ended && r.date_ended < today) {
          computedStatus = "Suspended";
        }
        return { ...r, status: computedStatus };
      });

      setUserRoles(normalized);

      // Find roles that need a DB update
      const rolesToUpdate = normalized.filter((r: any) => {
        const dbStatus =
          userRolesRes.data.find((orig: any) => orig.user_role_id === r.user_role_id)?.status ??
          "Active";
        return dbStatus !== r.status;
      });

      // Persist changes
      await Promise.all(
        rolesToUpdate.map((role: any) =>
          api.put(`/tbl_user_role/${role.user_role_id}/`, { status: role.status })
        )
      );
    } catch (err) {
      console.error("Fetch data error:", err);
      toast.error("Failed to fetch data");
    }
  };

  const handleAddRole = async () => {
    const isInsideUserModal = !!selectedUserId;

    if (!isInsideUserModal && (!newRole.user_id || !newRole.role_id)) {
      toast.error("User and Role are required.");
      return;
    }

    try {
      const payload = {
        user: newRole.user_id || selectedUserId,
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

      // ✅ Instantly show the new role in the current modal
      setUserRoles(prev => [...prev, data]);

      // ✅ Close the Add Role modal, but keep the Details modal open
      setShowAddRoleModal(false);

      // optional: reset the form
      setNewRole({});
    } catch (err) {
      console.error(err);
      toast.error("Failed to add role.");
      console.log("New Role Data:", newRole);
    }
  };

  const toggleUserRoleStatus = async (user_role_id: number, currentStatus: string) => {
    const newStatus = currentStatus === "Suspended" ? "Active" : "Suspended";

    try {
      // Update role status
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

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const data = new Uint8Array(evt.target?.result as ArrayBuffer);
      const wb = XLSX.read(data, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json: any[] = XLSX.utils.sheet_to_json(ws);

      for (const row of json) {
        const { user, role, college, department, date_start, date_ended } = row;

        if (!user || !role) {
          toast.error(`Missing user_id or role_id in row: ${JSON.stringify(row)}`);
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
        } catch (err) {
          console.error(err);
          toast.error(`Failed to import row for ${user}`);
        }
      }

      toast.success("Import completed");
      setShowImportModal(false);
      fetchData();
    };

    reader.readAsArrayBuffer(file);
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['user_id', 'role_id', 'college_id', 'department_id', 'date_start', 'date_ended'],
      ['2022000000', 1, 'CITC (Optional, but can be edited)', 'DIT (Optional, but can be edited)', '2025-06-22', '2025-06-23']
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'UserRolesTemplate');
    XLSX.writeFile(wb, 'UserRoles_Import_Template.xlsx');
  };

  const filteredUsers = users.filter(user =>
    user.full_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="accounts-container">
      <div className="accounts-header">
        <h2 className="accounts-title">Manage User Roles</h2>
        <div className="search-bar">
          <input
            type="text"
            placeholder="Search users..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
          <button className="search-button"><FaSearch /></button>
        </div>
      </div>

      <div className="accounts-actions">
        <button className="action-button import" onClick={() => setShowImportModal(true)}>Import Roles</button>
      </div>

      <div className="accounts-table-container">
        <table className="accounts-table">
          <thead>
            <tr>
              <th>ID Number</th>
              <th>Name</th>
              <th>Role/s</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={4}>No users found</td>
              </tr>
            ) : (
              filteredUsers.map((user) => {
                // Get this user's roles directly from userRoles
                const rolesForUser = userRoles.filter((r) => r.user === user.user_id);

                return (
                  <tr key={user.user_id}>
                    <td>{user.user_id}</td>
                    <td>{user.full_name}</td>
                    <td>
                      {rolesForUser.length > 0 ? (
                        <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
                          {rolesForUser
                            .map((role) => {
                              const office = [role.college_name, role.department_name]
                                .filter(Boolean)
                                .join(' / ');
                              const createdAt = role.created_at
                                ? new Date(role.created_at).toLocaleDateString()
                                : '—';
                              return `${role.role_name}${
                                office ? ` - ${office}` : ''
                              } (added: ${createdAt})`;
                            })
                            .join('\n')}
                        </pre>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td>
                      <button
                        className="action-button import"
                        onClick={() => {
                          setSelectedUserId(user.user_id);
                          setShowDetailsModal(true);
                        }}
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {showDetailsModal && selectedUserId !== null && (
        <div className="modal-overlay">
          <div className="modal" style={{ width: 1300 }}>
            <h3>User Role Details</h3>

            <div
              style={{
                marginBottom: '1px',
                padding: '5px',
                background: '#eef3f9',
                borderRadius: '10px',
                borderLeft: '5px solid rgb(17, 3, 101)', // ← fixed missing space
              }}
            >
              <p>
                <strong style={{ color: '#092c4c' }}>User ID:</strong> {selectedUserId}
              </p>
              <p>
                <strong style={{ color: '#092c4c' }}>Full Name:</strong>{' '}
                {users.find((u) => u.user_id === selectedUserId)?.full_name || '-'}
              </p>
            </div>

            <table className="accounts-table">
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
                  .filter((r) => r.user === selectedUserId) // ✅ FIXED: was r.user_id
                  .map((role) => (
                    <tr key={role.user_role_id}>
                      <td>{role.role_name || '-'}</td>

                      <td>
                        {[role.college_name, role.department_name]
                          .filter(Boolean)
                          .join(' / ') || '-'}
                      </td>

                      <td>
                        <span style={{ color: 'green', fontWeight: 'bold' }}>
                          {role.date_start ? role.date_start.split('T')[0] : '-'}
                        </span>
                      </td>

                      <td>
                        <span style={{ color: 'red', fontWeight: 'bold' }}>
                          {role.date_ended ? role.date_ended.split('T')[0] : '-'}
                        </span>
                      </td>

                      <td>
                        {role.created_at
                          ? new Date(role.created_at).toLocaleString('en-US', {
                              month: '2-digit',
                              day: '2-digit',
                              year: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit',
                              hour12: true,
                            })
                          : '—'}
                      </td>

                      <td>
                        <span
                          style={{
                            color: role.status === 'Suspended' ? 'red' : 'green',
                            fontWeight: 'bold',
                            backgroundColor:
                              role.status === 'Suspended' ? '#f8d7da' : '#d4edda',
                            padding: '2px 5px',
                            borderRadius: '10px',
                            fontSize: '0.9em',
                          }}
                        >
                          {role.status || 'Active'}
                        </span>
                      </td>

                      <td>
                        <button
                          className="icon-button edit-button"
                          onClick={() => setEditingRole(role)}
                        >
                          <FaPen />
                        </button>

                        <button
                          className={`icon-button ${
                            role.status === 'Suspended'
                              ? 'reactivate-button'
                              : 'delete-button'
                          }`}
                          onClick={() =>
                            toggleUserRoleStatus(
                              role.user_role_id,
                              role.status || 'Active'
                            )
                          }
                          title={
                            role.status === 'Suspended'
                              ? 'Reactivate Role'
                              : 'Suspend Role'
                          }
                        >
                          {role.status === 'Suspended' ? <FaLockOpen /> : <FaLock />}
                        </button>

                        <button
                          className="icon-button delete-button"
                          onClick={async () => {
                            if (!confirm('Are you sure you want to delete this role?'))
                              return;

                            try {
                              const response = await api.delete(`/tbl_user_role/${role.user_role_id}/`);
                              if (response.status === 200 || response.status === 204) {
                                toast.success("Role deleted successfully.");
                                setUserRoles(prev => prev.filter(r => r.user_role_id !== role.user_role_id)); // instantly update UI
                              } else {
                                toast.error("Failed to delete role.");
                              }
                            } catch (err) {
                              console.error(err);
                              toast.error("Failed to delete role.");
                            }
                          }}
                          title="Delete Role"
                        >
                          <FaTrash />
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>

            <div
              className="modal-actions"
              style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}
            >
              <button
                className="modal-button cancel"
                onClick={() => setShowDetailsModal(false)}
              >
                Close
              </button>
              <button
                className="modal-button save"
                onClick={() => {
                  setNewRole({ user: selectedUserId }); // ✅ changed to match serializer field
                  setShowAddRoleModal(true);
                }}
              >
                Add Role
              </button>
            </div>
          </div>
        </div>
      )}

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
      {editingRole && (
        <div className="modal-overlay">
          <div className="modal" style={{ width: 600 }}>
            <h3>Edit Role</h3>
            <div className="input-group">
              <label>Role</label>
              <select
                value={editingRole?.role_id ?? ''}
                onChange={e => {
                  const role_id = e.target.value ? Number(e.target.value) : undefined;
                  const allowed = getAllowedFields(role_id);

                  setEditingRole(prev => prev && ({
                    ...prev,
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
            {getAllowedFields(editingRole?.role_id).college && (
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

          {getAllowedFields(editingRole?.role_id).department && (
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
              <button
                className="modal-button save"
                onClick={async () => {
                  if (!editingRole) return;

                  try {
                    // Update the role only
                    await api.put(`/tbl_user_role/${editingRole.user_role_id}/`, {
                      role_id: editingRole.role_id,
                      college_id: editingRole.college_id,
                      department_id: editingRole.department_id,
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
                }}
              >
                Save
              </button>
              <button className="modal-button cancel" onClick={() => setEditingRole(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showImportModal && (
        <div className="modal-overlay">
            <div className="modal-contents import-modal">
              <h4 style={{ textAlign: 'center' }}>Import Roles from Excel</h4>
              <div className="input-group">
                <label>Upload Excel File</label>
                <input type="file" accept=".xlsx, .xls" onChange={handleImportFile} />
              </div>
              <div className="modal-buttons">
                <button type="button" className="modal-button download" onClick={downloadTemplate}><FaDownload /> Download Template</button>
                <button type="button" className="modal-button save" onClick={() => setShowImportModal(false)}>Done</button>
                <button type="button" className="modal-button cancel" onClick={() => setShowImportModal(false)}>Cancel</button>
              </div>
            </div>
        </div>
      )}

      <ToastContainer position="top-right" autoClose={3000} />
    </div>
  );
};

export default UserRoles;