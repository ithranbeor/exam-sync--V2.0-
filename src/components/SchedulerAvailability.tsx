// deno-lint-ignore-file no-explicit-any
import React, { useState, useEffect } from 'react';
import { FaTrash, FaEdit, FaSearch , FaEye} from 'react-icons/fa';
import { supabase } from '../lib/supabaseClient.ts';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import '../styles/colleges.css';

interface User {
  user_id: number;
  first_name: string;
  last_name: string;
}

interface Availability {
  availability_id: number;
  day: string;
  time_slot: string;
  status: string;
  remarks: string | null;
  user_id: number;
  user_fullname?: string;
}

const SchedulerAvailability: React.FC = () => {
  const [entries, setEntries] = useState<Availability[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showRemarksModal, setShowRemarksModal] = useState(false);
  const [selectedRemarks, setSelectedRemarks] = useState('');

  const [newEntry, setNewEntry] = useState({
    availability_id: 0,
    day: '',
    time_slot: '',
    status: 'available',
    remarks: '',
    user_id: 0,
  });

  useEffect(() => {
    fetchData();
    fetchUsers();
  }, []);

  const fetchData = async () => {
    const { data, error } = await supabase
      .from('tbl_availability')
      .select(`
        availability_id,
        day,
        time_slot,
        status,
        remarks,
        user_id,
        tbl_users (first_name, last_name)
      `);

    if (error) {
      toast.error('Failed to fetch availability');
      console.error(error);
    } else {
      const mapped = data.map((entry: any) => ({
        ...entry,
        user_fullname: `${entry.tbl_users?.first_name || ''} ${entry.tbl_users?.last_name || ''}`
      }));
      setEntries(mapped);
    }
  };

  const fetchUsers = async () => {
    const { data } = await supabase
      .from('tbl_users')
      .select('user_id, first_name, last_name');
    if (data) setUsers(data);
  };

  const handleSubmit = async () => {
    const { availability_id, day, time_slot, status, remarks, user_id } = newEntry;
    if (!day || !time_slot || !status || !user_id) {
      toast.error('All fields are required.');
      return;
    }

    setIsSubmitting(true);

    if (editMode) {
      const { error } = await supabase
        .from('tbl_availability')
        .update({ day, time_slot, status, remarks, user_id })
        .eq('availability_id', availability_id);
      if (error) toast.error('Failed to update entry');
      else toast.success('Entry updated');
    } else {
      const { error } = await supabase
        .from('tbl_availability')
        .insert([{ day, time_slot, status, remarks, user_id }]);
      if (error) toast.error('Failed to add entry');
      else toast.success('Entry added');
    }

    fetchData();
    setShowModal(false);
    setIsSubmitting(false);
  };

  const handleDelete = async (id: number) => {
    const { error } = await supabase
      .from('tbl_availability')
      .delete()
      .eq('availability_id', id);
    if (error) toast.error('Failed to delete entry');
    else {
      toast.success('Entry deleted');
      fetchData();
    }
  };

  const filtered = entries.filter(entry =>
    entry.user_fullname?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    entry.day.includes(searchTerm)
  );

  return (
    <div className="colleges-container">
      <div className="colleges-header">
        <h2 className="colleges-title"></h2>
        <div className="search-bar">
          <input
            type="text"
            placeholder="Search by Day or Instructor"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button type="button" className="search-button"><FaSearch /></button>
        </div>
      </div>

      <div className="colleges-actions">
        <button type="button" className="action-button add-new" onClick={() => {
          setNewEntry({ availability_id: 0, day: '', time_slot: '', status: 'available', remarks: '', user_id: 0 });
          setEditMode(false);
          setShowModal(true);
        }}>
          Add New Entry
        </button>
      </div>

      <div className="colleges-table-container">
        <table className="colleges-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Day</th>
              <th>Time Slot</th>
              <th>Status</th>
              <th>Remarks</th>
              <th>Instructor</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((entry, index) => (
              <tr key={entry.availability_id}>
                <td>{index + 1}</td>
                <td>{entry.day}</td>
                <td>{entry.time_slot}</td>
                <td>
                <span
                    style={{
                    padding: '4px 8px',
                    borderRadius: '999px',
                    color: 'white',
                    backgroundColor: entry.status === 'available' ? 'green' : 'red',
                    fontSize: '0.8rem',
                    textTransform: 'capitalize'
                    }}
                >
                    {entry.status}
                </span>
                </td>
                <td>
                {entry.remarks && entry.remarks.length > 0 ? (
                    <button type="button"
                    className="icon-button view-button"
                    onClick={() => {
                        setSelectedRemarks(entry.remarks || '');
                        setShowRemarksModal(true);
                    }}
                    >
                    <FaEye />
                    </button>
                ) : '—'}
                </td>
                <td>{entry.user_fullname}</td>
                <td className="action-buttons">
                  <button type='button' className="icon-button edit-button" onClick={() => {
                    setNewEntry({
                      availability_id: entry.availability_id,
                      day: entry.day,
                      time_slot: entry.time_slot,
                      status: entry.status,
                      remarks: entry.remarks ?? '',
                      user_id: entry.user_id,
                    });
                    setEditMode(true);
                    setShowModal(true);
                  }}>
                    <FaEdit />
                  </button>
                  <button type='button' className="icon-button delete-button" onClick={() => handleDelete(entry.availability_id)}>
                    <FaTrash />
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={7}>No entries found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3 style={{ textAlign: 'center' }}>{editMode ? 'Edit Availability' : 'Add New Availability'}</h3>
            <div className="input-group">
              <label>Day</label>
              <input type="date" value={newEntry.day}
                     onChange={(e) => setNewEntry({ ...newEntry, day: e.target.value })} />
            </div>
            <div className="input-group">
              <label>Time Slot</label>
              <input type="text" value={newEntry.time_slot}
                     onChange={(e) => setNewEntry({ ...newEntry, time_slot: e.target.value })} />
            </div>
            <div className="input-group">
              <label>Status</label>
              <select value={newEntry.status}
                      onChange={(e) => setNewEntry({ ...newEntry, status: e.target.value })}>
                <option value="available">Available</option>
                <option value="unavailable">Unavailable</option>
              </select>
            </div>
            <div className="input-group">
              <label>Remarks</label>
              <textarea value={newEntry.remarks || ''}
                        onChange={(e) => setNewEntry({ ...newEntry, remarks: e.target.value })} />
            </div>
            <div className="input-group">
              <label>Instructor</label>
              <select value={newEntry.user_id}
                      onChange={(e) => setNewEntry({ ...newEntry, user_id: parseInt(e.target.value) })}>
                <option value="">Select Instructor</option>
                {users.map(user => (
                  <option key={user.user_id} value={user.user_id}>
                    {user.first_name} {user.last_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="modal-actions">
              <button type="button" onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : 'Save'}
              </button>
              <button type="button" onClick={() => setShowModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showRemarksModal && (
        <div className="modal-overlays">
            <div className="modals">
            <h3 style={{ textAlign: 'center' }}>Remarks</h3>
            <div className="modal-remarks">
                {selectedRemarks}
            </div>
            <div className="modal-actions">
                <button type="button" onClick={() => setShowRemarksModal(false)}>Close</button>
            </div>
            </div>
        </div>
        )}
      <ToastContainer position="top-right" autoClose={3000} />
    </div>
  );
};

export default SchedulerAvailability;
