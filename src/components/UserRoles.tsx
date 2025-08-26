// deno-lint-ignore-file no-explicit-any jsx-button-has-type
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient.ts';
import { ToastContainer, toast } from 'react-toastify';
import { FaSearch, FaTrash, FaDownload, FaPen, FaCalendarAlt, FaRedoAlt, FaLock, FaLockOpen} from 'react-icons/fa';
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

interface UserRole {
  user_role_id: number;
  user_id: number;
  role_id: number;
  college_id: string | null;
  department_id: string | null;
  date_start: string | null;
  date_ended: string | null;
  created_at: string;
  status?: string;
}

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

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const [rolesRes, usersRes, collegesRes, departmentsRes, userRolesRes] = await Promise.all([
      supabase.from('tbl_roles').select(),
      supabase.from('tbl_users').select('user_id, first_name, last_name, created_at'),
      supabase.from('tbl_college').select(),
      supabase.from('tbl_department').select(),
      supabase.from('tbl_user_role').select('user_role_id, user_id, role_id, college_id, department_id, date_start, date_ended, created_at, status')
    ]);

    if (rolesRes.error || usersRes.error || collegesRes.error || departmentsRes.error || userRolesRes.error) {
      toast.error('Failed to fetch data');
    } else {
      setRoles(rolesRes.data);
      setUsers(usersRes.data.map((u: any) => ({
        user_id: u.user_id,
        full_name: `${u.last_name}, ${u.first_name}`,
        created_at: u.created_at
      })));
      setColleges(collegesRes.data);
      setDepartments(departmentsRes.data);
      const rolesData = userRolesRes.data;

      const nullStatusRoles = rolesData.filter((r: any) => !r.status);
      for (const role of nullStatusRoles) {
        await supabase
          .from('tbl_user_role')
          .update({ status: 'Active' })
          .eq('user_role_id', role.user_role_id);
      }

      const { data: updatedRoles, error: updatedRolesError } = await supabase
        .from('tbl_user_role')
        .select('user_role_id, user_id, role_id, college_id, department_id, date_start, date_ended, created_at, status');

      if (!updatedRolesError) {
        setUserRoles(updatedRoles);

        const today = new Date().toISOString().split('T')[0];
        for (const role of updatedRoles) {
          if (role.date_ended && role.date_ended < today) {
            await supabase
              .from('tbl_users')
              .update({ status: 'Suspended' })
              .eq('user_id', role.user_id);
          }
        }
      } else {
        toast.error('Failed to re-fetch updated user roles');
      }

      const today = new Date().toISOString().split('T')[0];
      for (const role of userRolesRes.data) {
        if (role.date_ended && role.date_ended < today) {
          await supabase
            .from('tbl_users')
            .update({ status: 'Suspended' })
            .eq('user_id', role.user_id);
        }
      }
    }
  };

  const handleAddRole = async () => {
    if (!newRole.user_id || !newRole.role_id) {
      toast.error('User and Role are required.');
      return;
    }

    const { error } = await supabase.from('tbl_user_role').insert([{
      user_id: newRole.user_id,
      role_id: newRole.role_id,
      college_id: newRole.college_id || null,
      department_id: newRole.department_id || null,
      date_start: newRole.date_start || null,
      date_ended: newRole.date_ended || null
    }]);

    if (error) {
      toast.error('Failed to add role.');
    } else {
      toast.success('Role added.');
      setShowAddRoleModal(false);
      fetchData();
    }
  };

  const toggleUserRoleStatus = async (user_role_id: number, currentStatus: string) => {
    const newStatus = currentStatus === 'Suspended' ? 'Active' : 'Suspended';

    const { error } = await supabase
      .from('tbl_user_role')
      .update({ status: newStatus })
      .eq('user_role_id', user_role_id);

    if (error) {
      toast.error(`Failed to ${newStatus === 'Active' ? 'reactivate' : 'suspend'} role.`);
    } else {
      toast.success(`Role ${newStatus === 'Active' ? 'reactivated' : 'suspended'}.`);
      fetchData();
    }
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async evt => {
      const data = new Uint8Array(evt.target?.result as ArrayBuffer);
      const wb = XLSX.read(data, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json: any[] = XLSX.utils.sheet_to_json(ws);

      for (const row of json) {
        const { user_id, role_id, college_id, department_id, date_start, date_ended } = row;
        if (!user_id || !role_id) {
          toast.error(`Missing user_id or role_id in row: ${JSON.stringify(row)}`);
          continue;
        }

        const { error } = await supabase.from('tbl_user_role').insert([{
          user_id,
          role_id,
          college_id: college_id || null,
          department_id: department_id || null,
          date_start: date_start || null,
          date_ended: date_ended || null
        }]);

        if (error) {
          toast.error(`Failed to import row for ${user_id}`);
        }
      }

      toast.success('Import completed');
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
              <th>Date Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length === 0 ? (
              <tr><td colSpan={3}>No users found</td></tr>
            ) : (
              filteredUsers.map(user => (
                <tr key={user.user_id}>
                  <td>{user.user_id}</td>
                  <td>{user.full_name}</td>
                  <td>
                    <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
                      {userRoles
                        .filter(r => r.user_id === user.user_id)
                        .map(role => {
                          const roleName = roles.find(r => r.role_id === role.role_id)?.role_name;
                          const college = colleges.find(c => c.college_id === role.college_id)?.college_name;
                          const department = departments.find(d => d.department_id === role.department_id)?.department_name;
                          const office = [college, department].filter(Boolean).join(' / ');
                          return `${roleName}${office ? ` - ${office}` : ''}`;
                        })
                        .join('\n') || '-'}
                    </pre>
                  </td>
                  <td>{new Date(user.created_at).toLocaleString('en-US', {
                    month: '2-digit',
                    day: '2-digit',
                    year: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true,
                  })}</td>
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
              ))
            )}
          </tbody>
        </table>
      </div>

      {showDetailsModal && selectedUserId !== null && (
        <div className="modal-overlay">
          <div className="modal" style={{ width: 1300 }}>
            <h3>User Role Details</h3>

            <div style={{
              marginBottom: '1px',
              padding: '5px',
              background: '#eef3f9',
              borderRadius: '10px',
              borderLeft: '5px solidrgb(17, 3, 101)'
            }}>
              <p><strong style={{ color: '#092c4c' }}>User ID:</strong> {selectedUserId}</p>
              <p><strong style={{ color: '#092c4c' }}>Full Name:</strong> {users.find(u => u.user_id === selectedUserId)?.full_name || '-'}</p>
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
                  .filter(r => r.user_id === selectedUserId)
                  .map(role => (
                    <tr key={role.user_role_id}>
                      <td>{roles.find(r => r.role_id === role.role_id)?.role_name}</td>
                      <td>
                        {[
                          colleges.find(c => c.college_id === role.college_id)?.college_name,
                          departments.find(d => d.department_id === role.department_id)?.department_name
                        ]
                          .filter(Boolean)
                          .join(' / ') || '-'}
                      </td>
                      <td>
                        <span style={{ color: 'green', fontWeight: 'bold' }}>
                          {role.date_start?.split('T')[0] || '-'}
                        </span>
                      </td>
                      <td>
                        <span style={{ color: 'red', fontWeight: 'bold' }}>
                          {role.date_ended?.split('T')[0] || '-'}
                        </span>
                      </td>
                      <td>{new Date(role.created_at).toLocaleString('en-US', {
                        month: '2-digit',
                        day: '2-digit',
                        year: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true,
                      })}</td>
                      <td>
                        <span style={{
                          color: role.status === 'Suspended' ? 'red' : 'green',
                          fontWeight: 'bold',
                          backgroundColor: role.status === 'Suspended' ? '#f8d7da' : '#d4edda',
                          padding: '2px 5px',
                          borderRadius: '10px',
                          fontSize: '0.9em'
                        }}>
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
                          className={`icon-button ${role.status === 'Suspended' ? 'reactivate-button' : 'delete-button'}`}
                          onClick={() => toggleUserRoleStatus(role.user_role_id, role.status || 'Active')}
                          title={role.status === 'Suspended' ? 'Reactivate Role' : 'Suspend Role'}
                        >
                          {role.status === 'Suspended' ? <FaLockOpen /> : <FaLock />}
                        </button>
                        <button
                          className="icon-button delete-button"
                          onClick={async () => {
                            if (confirm('Are you sure you want to delete this role? This action cannot be undone.')) {
                              const { error } = await supabase
                                .from('tbl_user_role')
                                .delete()
                                .eq('user_role_id', role.user_role_id);

                              if (error) {
                                toast.error('Failed to delete role.');
                              } else {
                                toast.success('Role deleted.');
                                fetchData();
                              }
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

            <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button className="modal-button cancel" onClick={() => setShowDetailsModal(false)}>Close</button>
              <button className="modal-button save" onClick={() => {
                setNewRole({ user_id: selectedUserId });
                setShowAddRoleModal(true);
              }}>
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
                value={newRole.role_id || ''}
                onChange={e => setNewRole(prev => ({ ...prev, role_id: +e.target.value }))}
              >
                <option value="">Select Role</option>
                {roles.map(r => (
                  <option key={r.role_id} value={r.role_id}>{r.role_name}</option>
                ))}
              </select>
            </div>
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
            <div className="input-group">
              <label>Department</label>
              <select
                value={newRole.department_id || ''}
                onChange={e => setNewRole(prev => ({ ...prev, department_id: e.target.value || null }))}
              >
                <option value="">None</option>
                {departments.map(d => (
                  <option key={d.department_id} value={d.department_id}>{d.department_name}</option>
                ))}
              </select>
            </div>
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
                value={editingRole.role_id}
                onChange={e => setEditingRole(prev => prev && { ...prev, role_id: +e.target.value })}
              >
                {roles.map(r => (
                  <option key={r.role_id} value={r.role_id}>{r.role_name}</option>
                ))}
              </select>
            </div>
            <div className="input-group">
              <label>College</label>
              <select
                value={editingRole.college_id || ''}
                onChange={e => setEditingRole(prev => prev && { ...prev, college_id: e.target.value || null })}
              >
                <option value="">None</option>
                {colleges.map(c => (
                  <option key={c.college_id} value={c.college_id}>{c.college_name}</option>
                ))}
              </select>
            </div>
            <div className="input-group">
              <label>Department</label>
              <select
                value={editingRole.department_id || ''}
                onChange={e => setEditingRole(prev => prev && { ...prev, department_id: e.target.value || null })}
              >
                <option value="">None</option>
                {departments.map(d => (
                  <option key={d.department_id} value={d.department_id}>{d.department_name}</option>
                ))}
              </select>
            </div>
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
              <button className="modal-button save" onClick={async () => {
                const { error } = await supabase
                  .from('tbl_user_role')
                  .update({
                    role_id: editingRole.role_id,
                    college_id: editingRole.college_id,
                    department_id: editingRole.department_id,
                    date_start: editingRole.date_start,
                    date_ended: editingRole.date_ended
                  })
                  .eq('user_role_id', editingRole.user_role_id);

                if (error) {
                  toast.error('Failed to update role.');
                } else {
                  toast.success('Role updated.');
                  setEditingRole(null);
                  fetchData();
                }
              }}>
                Save
              </button>
              <button className="modal-button cancel" onClick={() => setEditingRole(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showImportModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-content import-modal">
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
        </div>
      )}

      <ToastContainer position="top-right" autoClose={3000} />
    </div>
  );
};

export default UserRoles;
