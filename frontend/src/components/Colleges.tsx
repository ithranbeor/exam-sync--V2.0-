// deno-lint-ignore-file no-explicit-any
import React, { useState, useEffect } from 'react';
import { FaTrash, FaEdit, FaSearch, FaDownload, FaPlus, FaFileImport } from 'react-icons/fa';
import { api } from '../lib/apiClient.ts';
import { ToastContainer, toast } from 'react-toastify';
import * as XLSX from 'xlsx';
import 'react-toastify/dist/ReactToastify.css';
import '../styles/colleges.css';

interface College {
  college_id: string;
  college_name: string;
}

const Colleges: React.FC = () => {
  const [colleges, setColleges] = useState<College[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [newCollegeId, setNewCollegeId] = useState<string>('');
  const [newCollegeName, setNewCollegeName] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [editingCollegeId, setEditingCollegeId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true); // new state
  const [isImporting, setIsImporting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Fetch Colleges on Load
  useEffect(() => {
    fetchColleges();
  }, []);

  const fetchColleges = async () => {
    setLoading(true);
    try {
      const response = await api.get('/tbl_college/');
      setColleges(response.data);
    } catch (error: any) {
      console.error('Error fetching colleges:', error.message);
      toast.error('Failed to fetch colleges.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const filteredColleges = colleges.filter(
    (college) =>
      college.college_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      college.college_id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const isAllSelected = colleges.length > 0 && colleges.every((c) => selectedIds.has(c.college_id));

  const toggleSelectAll = () => {
    setSelectedIds(() => {
      if (isAllSelected) return new Set();
      const all = new Set<string>();
      colleges.forEach((c) => all.add(c.college_id));
      return all;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) {
      toast.info('No colleges selected');
      return;
    }
    if (!globalThis.confirm(`Delete ${ids.length} selected college(s)?`)) return;
    setIsBulkDeleting(true);
    try {
      const results = await Promise.allSettled(ids.map((id) => api.delete(`/tbl_college/${id}/`)));
      const ok = results.filter((r) => r.status === 'fulfilled').length;
      const fail = results.length - ok;
      if (ok) toast.success(`Deleted ${ok} college(s)`);
      if (fail) toast.error(`${fail} failed to delete`);
      clearSelection();
      fetchColleges();
    } catch (err) {
      console.error('Bulk delete error:', err);
      toast.error('Bulk delete failed');
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const handleAddCollege = () => {
    setNewCollegeId('');
    setNewCollegeName('');
    setEditMode(false);
    setEditingCollegeId(null);
    setShowModal(true);
  };

  const handleModalSubmit = async () => {
    if (!newCollegeId.trim() || !newCollegeName.trim()) {
      toast.error('Please enter both College ID and Name.');
      return;
    }

    setIsSubmitting(true);

    try {
      if (editMode && editingCollegeId !== null) {
        await api.put(`/tbl_college/${editingCollegeId}/`, {
          college_id: newCollegeId,
          college_name: newCollegeName,
        });
        toast.success('College updated successfully.');
      } else {
        await api.post('/tbl_college/', {
          college_id: newCollegeId,
          college_name: newCollegeName,
        });
        toast.success('College added successfully.');
      }

      fetchColleges();
      setShowModal(false);
    } catch (error: any) {
      console.error(error);
      toast.error('Failed to save college.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Single-item delete removed in favor of bulk delete

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event: any) => {
      setIsImporting(true); // start loading
      const data = new Uint8Array(event.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const json: any[] = XLSX.utils.sheet_to_json(worksheet);

      // Use built-in template check for missing headers
      const requiredHeaders = ['College ID', 'College Name'];
      const missingHeaders = requiredHeaders.filter(
        (h) => !Object.keys(json[0] || {}).includes(h)
      );
      if (missingHeaders.length) {
        toast.error(`Invalid template. Missing headers: ${missingHeaders.join(', ')}`);
        setIsImporting(false);
        return;
      }

      let added = 0;
      for (const row of json) {
        const collegeId = String(row['College ID']).trim();
        const collegeName = row['College Name']?.trim();
        if (!collegeId || !collegeName) continue;

        try {
          await api.post('/tbl_college/', { college_id: collegeId, college_name: collegeName });
          added++;
        } catch {
          toast.warn(`Skipped existing: ${collegeName}`);
        }
      }

      toast.success(`Import completed! ${added} college(s) added.`);
      fetchColleges();
      setShowImport(false);
      setIsImporting(false); // end loading
    };

    reader.readAsArrayBuffer(file);
  };

  const downloadTemplate = () => {
    const worksheet = XLSX.utils.aoa_to_sheet([
      ['College ID', 'College Name'],
      ['CITC', 'College of Information Technology and Computing'],
      ['CSM', 'College of Science and Mathematics'],
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Colleges Template');
    XLSX.writeFile(workbook, 'colleges_template.xlsx');
  };

  return (
    <div className="colleges-container">
      <div className="colleges-header">
        <h2 className="colleges-title">Manage Colleges</h2>
        <div className="search-bar">
          <input
            type="text"
            placeholder="Search Colleges"
            value={searchTerm}
            onChange={handleSearchChange}
          />
          <button type="button" className="search-button">
            <FaSearch />
          </button>
        </div>
      </div>

      <div className="colleges-actions">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button type='button' className="action-button add-new" onClick={handleAddCollege}>
              <FaPlus/>
            </button>
            <button type='button' className="action-button import" onClick={() => setShowImport(true)}>
              <FaFileImport/>
            </button>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              className="action-button delete"
              onClick={handleBulkDelete}
              disabled={isBulkDeleting || selectedIds.size === 0}
              title={selectedIds.size ? `Delete ${selectedIds.size} selected` : 'Delete selected'}
            >
              <FaTrash/>
            </button>
          </div>
        </div>
      </div>

      <div className="colleges-table-container">
        <table className="colleges-table">
          <thead>
            <tr>
              <th>#</th>
              <th>College ID</th>
              <th>College Name</th>
              <th>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>Actions</span>
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={toggleSelectAll}
                    disabled={loading || colleges.length === 0}
                    aria-label="Select all"
                    title="Select all"
                    style={{ marginLeft: 'auto' }}
                  />
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', padding: '20px' }}>
                  Loading colleges...
                </td>
              </tr>
            ) : filteredColleges.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', padding: '20px' }}>
                  No colleges found.
                </td>
              </tr>
            ) : (
              filteredColleges.map((college, index) => (
                <tr key={college.college_id}>
                  <td>{index + 1}</td>
                  <td>{college.college_id}</td>
                  <td>{college.college_name}</td>
                  <td className="action-buttons" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      type="button"
                      className="icon-button edit-button"
                      onClick={() => {
                        setNewCollegeId(college.college_id);
                        setNewCollegeName(college.college_name);
                        setEditMode(true);
                        setEditingCollegeId(college.college_id);
                        setShowModal(true);
                      }}
                    >
                      <FaEdit />
                    </button>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(college.college_id)}
                      onChange={() => toggleSelect(college.college_id)}
                      aria-label={`Select ${college.college_name}`}
                      style={{ marginLeft: 'auto' }}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>{editMode ? 'Edit College' : 'Add New College'}</h3>
            <div className="input-group">
              <label htmlFor="college-id">College ID</label>
              <input
                id="college-id"
                type="text"
                value={newCollegeId}
                onChange={(e) => setNewCollegeId(e.target.value)}
                disabled={editMode}
              />
            </div>
            <div className="input-group">
              <label htmlFor="college-name">College Name</label>
              <input
                id="college-name"
                type="text"
                value={newCollegeName}
                onChange={(e) => setNewCollegeName(e.target.value)}
              />
            </div>
            <div className="modal-actions">
              <button type='button' onClick={handleModalSubmit} disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : 'Save'}
              </button>
              <button type='button' onClick={() => setShowModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImport && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Import Colleges</h3>
            <p style={{ fontSize: '12px', color: '#666', marginBottom: '10px' }}>
              Each college must have a unique College ID. Use the template below.
            </p>
            <input type="file" accept=".xlsx, .xls" onChange={handleImportFile} disabled={isImporting} />
            <button
              type="button"
              className="modal-button download"
              onClick={downloadTemplate}
              disabled={isImporting}
            >
              <FaDownload style={{ marginRight: 5 }} /> Download Template
            </button>
            <div className="modal-actions">
              <button type="button" onClick={() => setShowImport(false)} disabled={isImporting}>
                {isImporting ? 'Importing...' : 'Done'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer position="top-right" autoClose={3000} />
    </div>
  );
};

export default Colleges;
