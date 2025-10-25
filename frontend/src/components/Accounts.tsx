import React, { useEffect, useState } from 'react';
import { FaSearch, FaPen } from 'react-icons/fa';
import { api } from '../lib/apiClient.ts'; // <-- Axios instance for Django API
import { ToastContainer, toast } from 'react-toastify';
import * as XLSX from 'xlsx';
import 'react-toastify/dist/ReactToastify.css';
import '../styles/accounts.css';

// -----------------------------
//  Interfaces
// -----------------------------
interface UserAccount {
  id: number;
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

// -----------------------------
//  Component
// -----------------------------
export const Accounts: React.FC<AccountsProps> = ({ user }) => {
  const [accounts, setAccounts] = useState<UserAccount[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  const [newAccount, setNewAccount] = useState<UserAccount>({
    id: 0,
    first_name: '',
    last_name: '',
    middle_name: '',
    email_address: '',
    contact_number: '',
    status: 'Active',
    created_at: new Date().toISOString(),
  });

  // -----------------------------
  //  Fetch accounts
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
  //  Handle Add / Edit
  // -----------------------------
  const handleSaveAccount = async () => {
    const { id, first_name, last_name, email_address, contact_number, status, middle_name } = newAccount;

    if (!first_name || !last_name || !email_address || !contact_number) {
      toast.error('Please fill all required fields');
      return;
    }

    try {
      if (isEditMode) {
        await api.put(`/accounts/${id}/`, {
          first_name,
          last_name,
          middle_name,
          email_address,
          contact_number,
          status,
        });
        toast.success('Account updated successfully!');
      } else {
        await api.post('/accounts/', {
          first_name,
          last_name,
          middle_name,
          email_address,
          contact_number,
          status,
        });
        toast.success('Account created successfully!');
      }

      setShowModal(false);
      fetchAccounts();
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.detail || 'Error saving account');
    }
  };

  // -----------------------------
  //  Handle Delete
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
  //  Excel Import
  // -----------------------------
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async evt => {
      const data = new Uint8Array(evt.target?.result as ArrayBuffer);
      const wb = XLSX.read(data, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json: Partial<UserAccount>[] = XLSX.utils.sheet_to_json(ws);

      for (const row of json) {
        try {
          await api.post('/accounts/', row);
        } catch (err) {
          console.error('Error importing row:', err);
        }
      }

      toast.success('Import completed');
      fetchAccounts();
      setShowImport(false);
    };

    reader.readAsArrayBuffer(file);
  };

  // -----------------------------
  //  Excel Template
  // -----------------------------
  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['first_name', 'last_name', 'middle_name', 'email_address', 'contact_number', 'status'],
      ['Juan', 'Dela Cruz', 'A.', 'juan@example.com', '09123456789', 'Active'],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'ImportTemplate');
    XLSX.writeFile(wb, 'Accounts_Import_Template.xlsx');
  };

  // -----------------------------
  //  Filtered accounts
  // -----------------------------
  const filtered = accounts.filter(u =>
    `${u.first_name} ${u.last_name} ${u.email_address}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // -----------------------------
  //  Render
  // -----------------------------
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
              id: 0,
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
              <tr key={u.id}>
                <td>{u.id}</td>
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
                    onClick={() => handleDeleteAccount(u.id)}
                  >
                    🗑
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h4 style={{ textAlign: 'center' }}>{isEditMode ? 'Edit Account' : 'Add New Account'}</h4>

            {['first_name', 'last_name', 'middle_name', 'email_address', 'contact_number'].map((field) => (
              <div key={field} className="input-group">
                <label htmlFor={field}>{field.replace('_', ' ').toUpperCase()}</label>
                <input
                  id={field}
                  value={(newAccount as any)[field] ?? ''}
                  onChange={(e) =>
                    setNewAccount((prev) => ({
                      ...prev,
                      [field]: e.target.value,
                    }))
                  }
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

      {/* Import Modal */}
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
