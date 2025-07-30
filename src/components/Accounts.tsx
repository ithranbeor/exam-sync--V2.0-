// deno-lint-ignore-file no-explicit-any
import React, { useEffect, useState } from 'react';
import { FaSearch, FaPen } from 'react-icons/fa';
import { supabase } from '../lib/supabaseClient.ts';
import { ToastContainer, toast } from 'react-toastify';
import * as XLSX from 'xlsx';
import 'react-toastify/dist/ReactToastify.css';
import '../styles/accounts.css';

interface UserAccount {
  user_id: number;
  first_name: string;
  last_name: string;
  middle_name?: string;
  email_address?: string;
  contact_number?: string;
  status: string;
  created_at: string;
  avatar_url?: string | null;
}

interface AccountsProps {
  user: any;
}

export const Accounts: React.FC<AccountsProps> = ({ user }) => {
  const [accounts, setAccounts] = useState<UserAccount[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [_loadingStatusId, setLoadingStatusId] = useState<number | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);

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

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    const { data, error } = await supabase
      .from('tbl_users')
      .select('user_id, first_name, last_name, middle_name, email_address, contact_number, status, created_at, avatar_url');

    if (error || !data) {
      toast.error('Error fetching accounts');
      return;
    }
    setAccounts(data);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const handleAddAccount = () => {
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
    setIsEditMode(false);
    setShowModal(true);
  };

  const handleEditAccount = (account: UserAccount) => {
    setNewAccount({ ...account });
    setIsEditMode(true);
    setShowModal(true);
  };

  const handleSaveAccount = async () => {
    const { user_id, first_name, last_name, email_address, contact_number, status, middle_name } = newAccount;

    if (!first_name || !last_name || !email_address || !contact_number || !status) {
      toast.error('Please fill all required fields');
      return;
    }

    try {
      if (isEditMode) {
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_FUNCTION_URL}/edit-user`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            user_id,
            first_name,
            last_name,
            middle_name,
            email_address,
            contact_number,
            status,
          }),
        });

        const result = await response.json();
        if (!response.ok) {
          toast.error(result.message || 'Failed to update account');
          return;
        }

        toast.success('Account updated successfully!');
      } else {
        if (!user_id || isNaN(user_id)) {
          toast.error('Valid numeric User ID is required');
          return;
        }

        const default_password = `${user_id}@${last_name}`;
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_FUNCTION_URL}/create-user`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            user_id,
            first_name,
            last_name,
            middle_name,
            email_address,
            contact_number,
            status,
            password: default_password,
          }),
        });

        const result = await response.json();
        if (!response.ok) {
          toast.error(result.message || 'Error creating account');
          return;
        }

        toast.success('Account created!');
      }

      fetchAccounts();
      setShowModal(false);
    } catch (err: any) {
      console.error('Save error:', err);
      toast.error(err.message || 'Unexpected error occurred');
    }
  };

  const _handleDeleteAccount = async (userId: number) => {
    const account = accounts.find(u => u.user_id === userId);
    if (!account || !account.email_address) {
      toast.error('Invalid user data');
      return;
    }

    setLoadingStatusId(userId);

    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_FUNCTION_URL}/delete-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          user_id: userId,
          email: account.email_address,
        }),
      });

      const result = await response.json();
      setLoadingStatusId(null);

      if (!response.ok) {
        toast.error(result.message || 'Error deleting account');
      } else {
        toast.success('Account deleted successfully');
        fetchAccounts();
      }
    } catch (err: any) {
      setLoadingStatusId(null);
      console.error('Delete error:', err);
      toast.error(err.message || 'Unexpected error occurred');
    }
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['user_id', 'first_name', 'last_name', 'middle_name', 'email_address', 'contact_number', 'status'],
      [2022000000, 'Ithran Beor', 'Turno', '(Optional, just leave blank if not available)', 'Ithran.Beor@example.com', '09123456789', 'Active'],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'ImportTemplate');
    XLSX.writeFile(wb, 'Accounts_Import_Template.xlsx');
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async evt => {
      const data = new Uint8Array(evt.target?.result as ArrayBuffer);
      const wb = XLSX.read(data, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json: any[] = XLSX.utils.sheet_to_json(ws);

      for (const row of json) {
        const { user_id, first_name, last_name, middle_name, email_address, contact_number, status } = row;

        if (!user_id || !first_name || !last_name || !email_address || !contact_number || !status) {
          toast.error(`Missing fields in row for user ID: ${user_id || 'unknown'}`);
          continue;
        }

        const default_password = `${user_id}@${last_name}`;
        try {
          const response = await fetch(`${import.meta.env.VITE_SUPABASE_FUNCTION_URL}/create-user`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY}`,
            },
            body: JSON.stringify({
              user_id,
              first_name,
              last_name,
              middle_name,
              email_address,
              contact_number,
              status,
              password: default_password,
            }),
          });

          const result = await response.json();
          if (!response.ok) {
            toast.error(`Failed to create ${first_name} (${user_id}): ${result.message}`);
            continue;
          }
        } catch (err) {
          console.error(err);
          toast.error(`Error creating ${first_name} (${user_id})`);
        }
      }

      toast.success('Import completed');
      fetchAccounts();
      setShowImport(false);
    };

    reader.readAsArrayBuffer(file);
  };

  const filtered = accounts.filter(u =>
    `${u.user_id} ${u.first_name} ${u.last_name} ${u.middle_name ?? ''}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (u.email_address ?? '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (u.contact_number ?? '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.status.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="accounts-container">
      <div className="accounts-header">
        <h2 className="accounts-title">Manage Accounts</h2>
        <div className="search-bar">
          <input placeholder="Search..." value={searchTerm} onChange={handleSearchChange} />
          <button type="button" className="search-button"><FaSearch /></button>
        </div>
      </div>

      <div className="accounts-actions">
        <button type="button" className="action-button add-new" onClick={handleAddAccount}>Add New Account</button>
        <button type="button" className="action-button import" onClick={() => setShowImport(true)}>Import Accounts</button>
      </div>

      <div className="accounts-table-container">
        <table className="accounts-table">
          <thead>
            <tr>
              <th>Picture</th>
              <th>ID Number</th>
              <th>Full Name</th>
              <th>Email</th>
              <th>Contact</th>
              <th>Account Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7}>No user accounts found.</td></tr>
            ) : filtered.map(u => (
              <tr key={u.user_id}>
                <td>
                  <img
                    src={u.avatar_url || './src/assets/default-pp.jpg'}
                    alt="avatar"
                    style={{ width: '40px', height: '40px', borderRadius: '50%' }}
                  />
                </td>
                <td>{u.user_id}</td>
                <td>{u.last_name}, {u.first_name} {u.middle_name ?? ''}</td>
                <td>{u.email_address}</td>
                <td>{u.contact_number}</td>
                <td>{new Date(u.created_at).toLocaleString('en-US', {
                  month: '2-digit',
                  day: '2-digit',
                  year: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true,
                })}</td>
                <td className="action-buttons">
                  <button type="button" className="icon-button edit-button" onClick={() => handleEditAccount(u)}><FaPen /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-content">
              <h4 style={{ textAlign: 'center' }}>{isEditMode ? 'Edit Account' : 'Add New Account'}</h4>
              {['user_id', 'first_name', 'last_name', 'middle_name', 'email_address', 'contact_number'].map((field) => (
                <div key={field} className="input-group">
                  <label htmlFor={field}>{field.replace('_', ' ').toUpperCase()}</label>
                  <input
                    id={field}
                    value={(newAccount as any)[field] ?? ''}
                    onChange={(e) =>
                      setNewAccount((prev) => ({
                        ...prev,
                        [field]: field === 'user_id' ? parseInt(e.target.value) || 0 : e.target.value,
                      }))
                    }
                    disabled={field === 'user_id' && isEditMode}
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
              <div className="modal-buttons">
                <button type="button" className="modal-button save" onClick={handleSaveAccount}>Save</button>
                <button type="button" className="modal-button cancel" onClick={() => setShowModal(false)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showImport && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-content import-modal">
              <h4 style={{ textAlign: 'center' }}>Import Accounts from Excel</h4>
              <div className="input-group">
                <label>Upload Excel File</label>
                <input type="file" accept=".xlsx, .xls" onChange={handleImport} />
              </div>
              <div className="modal-buttons">
                <button type="button" className="modal-button download" onClick={downloadTemplate}>📥 Download Template</button>
                <button type="button" className="modal-button save" onClick={() => setShowImport(false)}>Done</button>
                <button type="button" className="modal-button cancel" onClick={() => setShowImport(false)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ToastContainer position="top-right" autoClose={3000} />
    </div>
  );
};

export default Accounts;
