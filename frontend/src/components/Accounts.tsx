import React, { useEffect, useState } from 'react';
import { FaSearch, FaPen } from 'react-icons/fa';
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

interface AccountsProps {
  user?: {
    id: number;
    email: string;
  } | null;
}

export const Accounts: React.FC<AccountsProps> = ({ user }) => {
  const [accounts, setAccounts] = useState<UserAccount[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showImport, setShowImport] = useState(false);
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

  // -----------------------------
  // Fetch accounts
  // -----------------------------
  const fetchAccounts = async () => {
    try {
      const response = await api.get<UserAccount[]>('/accounts/');
      setAccounts(response.data);
    } catch (err: any) {
      console.error(err);
      toast.error('Error fetching accounts');
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  // -----------------------------
  // Handle Add / Edit
  // -----------------------------
  const handleSaveAccount = async () => {
    const { user_id, first_name, last_name, email_address, contact_number, status, middle_name } = newAccount;

    if (!(newAccount.user_id > 0) || !newAccount.first_name || !newAccount.last_name || !newAccount.email_address || !newAccount.contact_number) {
      toast.error('Please fill all required fields including User ID');
      return;
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
        await api.post('/accounts/', {
          user_id: user_id, // ✅ send as user_id, not id
          first_name,
          last_name,
          middle_name,
          email_address,
          contact_number,
          status,
          password: defaultPassword,
          created_at: new Date().toISOString(),
        });
        toast.success(`Account created successfully! Default password: user_id@Lastname`);
      }

      setShowModal(false);
      fetchAccounts();
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.detail || 'Error saving account');
    }
  };

  // -----------------------------
  // Handle Delete
  // -----------------------------
  const handleDeleteAccount = async (id: number) => {
    if (!globalThis.confirm('Are you sure you want to delete this account?')) return;

    try {
      await api.delete(`/accounts/${id}/`);
      toast.success('Account deleted');
      fetchAccounts();
    } catch (err: any) {
      console.error(err);
      toast.error('Error deleting account');
    }
  };

  // -----------------------------
  // Excel Import
  // -----------------------------
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async evt => {
      const data = new Uint8Array(evt.target?.result as ArrayBuffer);
      const wb = XLSX.read(data, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

      for (const row of json) {
        try {
          const user_id = Number(row.user_id ?? row.id);
          const first_name = String(row.first_name ?? '');
          const last_name = String(row.last_name ?? '');
          const middle_name = String(row.middle_name ?? '');
          const email_address = String(row.email_address ?? '');
          const contact_number = String(row.contact_number ?? '');
          const status = String(row.status ?? 'Active');

          if (!user_id || !first_name || !last_name || !email_address || !contact_number) {
            console.warn('Skipping invalid row:', row);
            continue;
          }

          const payload = {
            user_id,
            first_name,
            last_name,
            middle_name,
            email_address,
            contact_number,
            status,
            password: `${last_name}@${user_id}`,
            created_at: new Date().toISOString(),
          };

          await api.post('/accounts/', payload);
        } catch (err: any) {
          console.error('Error importing row:', err.response?.data || err.message);
        }
      }

      toast.success('Import completed');
      fetchAccounts();
      setShowImport(false);
    };

    reader.readAsArrayBuffer(file);
  };

  // -----------------------------
  // Excel Template
  // -----------------------------
  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['id', 'first_name', 'last_name', 'middle_name', 'email_address', 'contact_number', 'status'],
      [101, 'Juan', 'Dela Cruz', 'A.', 'juan@example.com', '09123456789', 'Active'],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'ImportTemplate');
    XLSX.writeFile(wb, 'Accounts_Import_Template.xlsx');
  };

  const filtered = accounts.filter(u =>
    `${u.first_name} ${u.last_name} ${u.email_address}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="accounts-container">
      <div className="accounts-header">
        <h2 className="accounts-title">Manage Accounts</h2>
        <div className="search-bar">
          <input
            placeholder="Search..."
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
            setShowModal(true);
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
          }}
        >
          Add New Account
        </button>

        <button
          type="button"
          className="action-button import"
          onClick={() => setShowImport(true)}
        >
          Import Accounts
        </button>
      </div>

      <div className="accounts-table-container">
        <table className="accounts-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Full Name</th>
              <th>Email</th>
              <th>Contact</th>
              <th>Status</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7}>No user accounts found.</td></tr>
            ) : filtered.map((u) => (
              <tr key={u.user_id}>
                <td>{u.user_id}</td>
                <td>{u.last_name}, {u.first_name} {u.middle_name ?? ''}</td>
                <td>{u.email_address}</td>
                <td>{u.contact_number}</td>
                <td>{u.status}</td>
                <td>{new Date(u.created_at).toLocaleDateString()}</td>
                <td className="action-buttons">
                  <button
                    type="button"
                    className="icon-button edit-button"
                    onClick={() => {
                      setNewAccount(u);
                      setIsEditMode(true);
                      setShowModal(true);
                    }}
                  >
                    <FaPen />
                  </button>
                  <button
                    type="button"
                    className="icon-button delete-button"
                    onClick={() => handleDeleteAccount(u.user_id)}
                  >
                    🗑
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
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

            <div className="modal-buttons">
              <button type="button" className="modal-button save" onClick={handleSaveAccount}>Save</button>
              <button type="button" className="modal-button cancel" onClick={() => setShowModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showImport && (
        <div className="modal-overlay">
          <div className="modal">
            <h4 style={{ textAlign: 'center' }}>Import Accounts from Excel</h4>
            <div className="input-group">
              <label>Upload Excel File</label>
              <input type="file" accept=".xlsx, .xls" onChange={handleImport} />
            </div>
            <div className="modal-buttons">
              <button type="button" className="modal-button download" onClick={downloadTemplate}>📥 Download Template</button>
              <button type="button" className="modal-button cancel" onClick={() => setShowImport(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer position="top-right" autoClose={3000} />
    </div>
  );
};

export default Accounts;
