// deno-lint-ignore-file no-explicit-any
import React, { useState, useEffect } from 'react';
import { FaTrash, FaEdit, FaSearch, FaDownload } from 'react-icons/fa';
import { supabase } from '../lib/supabaseClient.ts';
import { ToastContainer, toast } from 'react-toastify';
import * as XLSX from 'xlsx';
import 'react-toastify/dist/ReactToastify.css';
import '../styles/Department.css';

interface Department {
  department_id: string;
  department_name: string;
  college_id: string;
}

interface College {
  college_id: string;
  college_name: string;
}

interface User {
  user_id: string;
}

interface DepartmentsProps {
  user: User;
}

const Departments: React.FC<DepartmentsProps> = ({ user: _user }) => {
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

  useEffect(() => {
    fetchDepartments();
    fetchColleges();
  }, []);

  const fetchDepartments = async () => {
    const { data, error } = await supabase
      .from('tbl_department')
      .select('department_id, department_name, college_id');

    if (error) {
      toast.error('Failed to fetch departments.');
    } else {
      setDepartments(data);
    }
  };

  const fetchColleges = async () => {
    const { data, error } = await supabase
      .from('tbl_college')
      .select('college_id, college_name');

    if (error) {
      toast.error('Failed to fetch colleges.');
    } else {
      setColleges(data);
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const filteredDepartments = departments.filter((dept) => {
    const collegeName = colleges.find(c => c.college_id === dept.college_id)?.college_name || '';
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

    const isValidCollege = colleges.some(c => c.college_id === newCollegeId);
    if (!isValidCollege) {
      toast.error('Please select a valid College.');
      return;
    }

    setIsSubmitting(true);

    try {
      if (editMode && editingDeptId !== null) {
        const { error } = await supabase
          .from('tbl_department')
          .update({
            department_name: newDeptName,
            college_id: newCollegeId,
          })
          .eq('department_id', editingDeptId);

        if (error) {
          toast.error('Failed to update department.');
        } else {
          toast.success('Department updated.');
          fetchDepartments();
        }
      } else {
        const { error } = await supabase
          .from('tbl_department')
          .insert([{ department_id: newDeptId, department_name: newDeptName, college_id: newCollegeId }]);

        if (error) {
          toast.error('Failed to add department.');
        } else {
          toast.success('Department added.');
          fetchDepartments();
        }
      }

      setShowModal(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('tbl_department').delete().eq('department_id', id);

    if (error) {
      toast.error('Failed to delete department.');
    } else {
      setDepartments(departments.filter((d) => d.department_id !== id));
      toast.success('Department deleted.');
    }
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event: any) => {
      const data = new Uint8Array(event.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const json: any[] = XLSX.utils.sheet_to_json(worksheet);

      for (const row of json) {
        const deptId = row['Department ID']?.trim();
        const deptName = row['Department Name']?.trim();
        const collegeName = row['College Name']?.trim();

        const matchedCollege = colleges.find(c => c.college_name.toLowerCase() === collegeName?.toLowerCase());

        if (!deptId || !deptName || !matchedCollege) {
          toast.error(`Skipped invalid row: ${deptName}`);
          continue;
        }

        const { error } = await supabase
          .from('tbl_department')
          .insert([{ department_id: deptId, department_name: deptName, college_id: matchedCollege.college_id }]);

        if (error) {
          toast.error(`Failed to import: ${deptName}`);
        }
      }

      toast.success('Import completed!');
      fetchDepartments();
      setShowImport(false);
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
        <button type="button" className="action-button add-new" onClick={handleAddDepartment}>
          Add New Department
        </button>
        <button type="button" className="action-button import" onClick={() => setShowImport(true)}>
          Import Departments
        </button>
        <button type="button" className="action-button download" onClick={downloadTemplate}>
          <FaDownload style={{ marginRight: 5 }} /> Download Template
        </button>
      </div>

      <div className="colleges-table-container">
        <table className="colleges-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Department Code</th>
              <th>Department Name</th>
              <th>College</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredDepartments.length === 0 ? (
              <tr><td colSpan={5}>No departments found.</td></tr>
            ) : (
              filteredDepartments.map((dept, index) => (
                <tr key={dept.department_id}>
                  <td>{index + 1}</td>
                  <td>{dept.department_id}</td>
                  <td>{dept.department_name}</td>
                  <td>{colleges.find(c => c.college_id === dept.college_id)?.college_name || dept.college_id}</td>
                  <td className="action-buttons">
                    <button type="button"
                      className="icon-button edit-button"
                      onClick={() => {
                        setNewDeptId(dept.department_id);
                        setNewDeptName(dept.department_name);
                        setNewCollegeId(dept.college_id);
                        setEditMode(true);
                        setEditingDeptId(dept.department_id);
                        setShowModal(true);
                      }}
                    >
                      <FaEdit />
                    </button>
                    <button type="button"
                      className="icon-button delete-button"
                      onClick={() => handleDelete(dept.department_id)}
                    >
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
            <h3 style={{ textAlign: 'center' }}>
              {editMode ? 'Edit Department' : 'Add New Department'}
            </h3>

            <div className="input-group">
              <label htmlFor="dept-id">Department ID</label>
              <input
                id="dept-id"
                type="text"
                placeholder="Department ID"
                value={newDeptId}
                onChange={(e) => setNewDeptId(e.target.value)}
                disabled={editMode}
              />
            </div>

            <div className="input-group">
              <label htmlFor="dept-name">Department Name</label>
              <input
                id="dept-name"
                type="text"
                placeholder="Department Name"
                value={newDeptName}
                onChange={(e) => setNewDeptName(e.target.value)}
              />
            </div>

            <div className="input-group">
              <label htmlFor="college-id">College</label>
              <select
                id="college-id"
                value={newCollegeId}
                onChange={(e) => setNewCollegeId(e.target.value)}
              >
                <option value="">Select College</option>
                {colleges.map((college) => (
                  <option key={college.college_id} value={college.college_id}>
                    {college.college_name} ({college.college_id})
                  </option>
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
            <h3 style={{ textAlign: 'center' }}>Import Departments</h3>
            <input type="file" accept=".xlsx, .xls" onChange={handleImportFile} />
            <div className="modal-actions">
              <button type="button" onClick={() => setShowImport(false)}>Done</button>
              <button type="button" onClick={() => setShowImport(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer position="top-right" autoClose={3000} />
    </div>
  );
};

export default Departments;
