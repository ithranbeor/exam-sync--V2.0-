// deno-lint-ignore-file no-explicit-any
import React, { useState, useEffect } from 'react';
import { FaTrash, FaEdit, FaSearch, FaDownload,  FaPlus, FaFileImport } from 'react-icons/fa';
import { api } from '../lib/apiClient.ts';
import { ToastContainer, toast } from 'react-toastify';
import * as XLSX from 'xlsx';
import 'react-toastify/dist/ReactToastify.css';
import '../styles/Department.css';

interface Department {
  department_id: string;
  department_name: string;
  college: { college_id: string; college_name: string };
}

interface College {
  college_id: string;
  college_name: string;
}

const Departments: React.FC = () => {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [colleges, setColleges] = useState<College[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [newDeptId, setNewDeptId] = useState('');
  const [newDeptName, setNewDeptName] = useState('');
  const [newCollegeId, setNewCollegeId] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [editingDeptId, setEditingDeptId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => {
    fetchDepartments();
    fetchColleges();
  }, []);

  // Fetch all departments
  const fetchDepartments = async () => {
    setLoading(true);
    try {
      const res = await api.get('/departments/');
      setDepartments(res.data);
    } catch (err) {
      console.error(err);
      toast.error('Failed to fetch departments.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch all colleges
  const fetchColleges = async () => {
    try {
      const res = await api.get('/tbl_college/');
      setColleges(res.data);
    } catch (err) {
      console.error(err);
      toast.error('Failed to fetch colleges.');
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const filteredDepartments = departments.filter((dept) => {
    const collegeName = dept.college?.college_name || '';
    return (
      dept.department_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      dept.department_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      collegeName.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const handleAddDepartment = () => {
    setNewDeptId('');
    setNewDeptName('');
    setNewCollegeId('');
    setEditMode(false);
    setEditingDeptId(null);
    setShowModal(true);
  };

  const handleModalSubmit = async () => {
    if (!newDeptId.trim() || !newDeptName.trim() || !newCollegeId) {
      toast.error('Please fill all fields.');
      return;
    }

    setIsSubmitting(true);

    try {
      if (editMode && editingDeptId) {
        await api.patch(`/departments/${editingDeptId}/`, {
          department_name: newDeptName,
          college_id: newCollegeId,
        });
        toast.success('Department updated.');
      } else {
        await api.post('/departments/', {
          department_id: newDeptId,
          department_name: newDeptName,
          college_id: newCollegeId,
        });
        toast.success('Department added.');
      }
      fetchDepartments();
      setShowModal(false);
    } catch (err: any) {
      console.error(err);
      if (err.response?.data) toast.error(JSON.stringify(err.response.data));
      else toast.error('Failed to save department.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!globalThis.confirm('Are you sure you want to delete this department?')) return;
    try {
      await api.delete(`/departments/${id}/`);
      setDepartments(departments.filter(d => d.department_id !== id));
      toast.success('Department deleted.');
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete department.');
    }
  };

  // Import Excel
  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event: any) => {
      setIsImporting(true);
      const data = new Uint8Array(event.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const json: any[] = XLSX.utils.sheet_to_json(worksheet);

      let added = 0;
      for (const row of json) {
        const deptId = row['Department ID']?.toString().trim();
        const deptName = row['Department Name']?.toString().trim();
        const collegeName = row['College Name']?.toString().trim();

        const matchedCollege = colleges.find(
          (c) => c.college_name.toLowerCase() === collegeName?.toLowerCase()
        );

        if (!deptId || !deptName || !matchedCollege) {
          toast.warn(`Skipped invalid row: ${deptName || 'Unknown'}`);
          continue;
        }

        try {
          await api.post('/departments/', {
            department_id: deptId,
            department_name: deptName,
            college_id: matchedCollege.college_id,
          });
          added++;
        } catch {
          toast.warn(`Skipped existing or invalid: ${deptName}`);
        }
      }

      toast.success(`Import completed! ${added} department(s) added.`);
      fetchDepartments();
      setShowImport(false);
      setIsImporting(false);
    };

    reader.readAsArrayBuffer(file);
  };

  const downloadTemplate = () => {
    const worksheet = XLSX.utils.aoa_to_sheet([
      ['Department ID', 'Department Name', 'College Name'],
      ['DIT', 'Department of Information Technology', 'College of Information Technology and Computing'],
      ['DTCM', 'Department of Technology Communication Management', 'College of Information Technology and Computing'],
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Departments Template');
    XLSX.writeFile(workbook, 'departments_template.xlsx');
  };

  return (
    <div className="colleges-container">
      <div className="colleges-header">
        <h2 className="colleges-title">Manage Departments</h2>
        <div className="search-bar">
          <input
            type="text"
            placeholder="Search for Departments"
            value={searchTerm}
            onChange={handleSearchChange}
          />
          <button type="button" className="search-button"><FaSearch /></button>
        </div>
      </div>

      <div className="colleges-actions">
        <button type="button" className="action-button add-new" onClick={handleAddDepartment}><FaPlus/></button>
        <button type="button" className="action-button import" onClick={() => setShowImport(true)}><FaFileImport/></button>
      </div>

      <div className="colleges-table-container">
        <table className="colleges-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Department ID</th>
              <th>Department Name</th>
              <th>College</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '20px' }}>
                  Loading departments...
                </td>
              </tr>
            ) : filteredDepartments.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '20px' }}>
                  No departments found.
                </td>
              </tr>
            ) : (
              filteredDepartments.map((dept, index) => (
                <tr key={dept.department_id}>
                  <td>{index + 1}</td>
                  <td>{dept.department_id}</td>
                  <td>{dept.department_name}</td>
                  <td>{dept.college?.college_name || dept.college?.college_id}</td>
                  <td className="action-buttons">
                    <button type="button" className="icon-button edit-button" onClick={() => {
                      setNewDeptId(dept.department_id);
                      setNewDeptName(dept.department_name);
                      setNewCollegeId(dept.college?.college_id || '');
                      setEditMode(true);
                      setEditingDeptId(dept.department_id);
                      setShowModal(true);
                    }}>
                      <FaEdit />
                    </button>
                    <button type="button" className="icon-button delete-button" onClick={() => handleDelete(dept.department_id)}>
                      <FaTrash />
                    </button>
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
            <h3>{editMode ? 'Edit Department' : 'Add New Department'}</h3>

            <div className="input-group">
              <label htmlFor="dept-id">Department ID</label>
              <input
                id="dept-id"
                type="text"
                value={newDeptId}
                onChange={e => setNewDeptId(e.target.value)}
                disabled={editMode}
              />
            </div>

            <div className="input-group">
              <label htmlFor="dept-name">Department Name</label>
              <input
                id="dept-name"
                type="text"
                value={newDeptName}
                onChange={e => setNewDeptName(e.target.value)}
              />
            </div>

            <div className="input-group">
              <label htmlFor="college-id">College</label>
              <select
                id="college-id"
                value={newCollegeId}
                onChange={e => setNewCollegeId(e.target.value)}
              >
                <option value="">Select College</option>
                {colleges.map(c => (
                  <option key={c.college_id} value={c.college_id}>{c.college_name} ({c.college_id})</option>
                ))}
              </select>
            </div>

            <div className="modal-actions">
              <button type="button" onClick={handleModalSubmit} disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : 'Save'}
              </button>
              <button type="button" onClick={() => setShowModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImport && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Import Departments</h3>
            <p style={{ fontSize: '12px', color: '#666', marginBottom: '10px' }}>
              Each department must belong to an existing college. Use the template below.
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

export default Departments;
