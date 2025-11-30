// deno-lint-ignore-file no-explicit-any
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { FaTrash, FaEdit, FaSearch, FaDownload, FaPlus, FaFileImport, FaChevronLeft, FaChevronRight, FaSort } from 'react-icons/fa';
import { api } from '../lib/apiClient.ts';
import { ToastContainer, toast } from 'react-toastify';
import * as XLSX from 'xlsx';
import 'react-toastify/dist/ReactToastify.css';
import '../styles/programs.css';
import Select from 'react-select';

interface Department {
  department_id: string;
  department_name: string;
}

interface Program {
  program_id: string;
  program_name: string;
  department_id: string;
  department?: string | Department | null;
}

interface User {
  user_id: string;
}

interface ProgramsProps {
  user: User;
}

const Programs: React.FC<ProgramsProps> = ({ user: _user }) => {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [newProgId, setNewProgId] = useState('');
  const [newProgName, setNewProgName] = useState('');
  const [newDeptId, setNewDeptId] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [editingProgId, setEditingProgId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true); // new state
  const [isImporting, setIsImporting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [sortBy, setSortBy] = useState<string>('none');
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchDepartments();
    fetchPrograms();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showSortDropdown && !target.closest('[data-sort-dropdown]')) {
        setShowSortDropdown(false);
      }
    };

    if (showSortDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSortDropdown]);

  // Handle scroll position and update button states
  useEffect(() => {
    const checkScroll = () => {
      const container = tableContainerRef.current;
      if (!container) return;

      const { scrollLeft, scrollWidth, clientWidth } = container;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1);
      
      // Update scroll indicator classes
      container.classList.toggle('scrollable-left', scrollLeft > 0);
      container.classList.toggle('scrollable-right', scrollLeft < scrollWidth - clientWidth - 1);
    };

    const container = tableContainerRef.current;
    if (container) {
      checkScroll();
      container.addEventListener('scroll', checkScroll);
      window.addEventListener('resize', checkScroll);
    }

    return () => {
      if (container) {
        container.removeEventListener('scroll', checkScroll);
        window.removeEventListener('resize', checkScroll);
      }
    };
  }, [programs, searchTerm, loading]);

  const scrollTable = (direction: 'left' | 'right') => {
    const container = tableContainerRef.current;
    if (!container) return;

    const scrollAmount = container.clientWidth * 0.8;
    const scrollTo = direction === 'left' 
      ? container.scrollLeft - scrollAmount 
      : container.scrollLeft + scrollAmount;
    
    container.scrollTo({
      left: scrollTo,
      behavior: 'smooth'
    });
  };

  const fetchPrograms = async () => {
    setLoading(true);
    try {
      const response = await api.get('/programs/');
      const normalized = response.data.map((p: any) => ({
        ...p,
        department_id:
          typeof p.department === 'object' && p.department
            ? p.department.department_id
            : p.department_id,
      }));
      setPrograms(normalized);
    } catch (err: any) {
      console.error('Failed to fetch programs:', err.message);
      toast.error('Failed to fetch programs.');
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const response = await api.get('/departments/');
      setDepartments(response.data);
    } catch (err: any) {
      console.error('Failed to fetch departments:', err.message);
      toast.error('Failed to fetch departments.');
    }
  };

  const getDepartmentName = (prog: Program): string => {
    if (typeof prog.department === 'object' && prog.department)
      return prog.department.department_name;
    if (typeof prog.department === 'string') {
      const match = prog.department.match(/\(([^)]+)\)/);
      if (match && match[1]) {
        const dept = departments.find((d) => d.department_id === match[1]);
        return dept ? dept.department_name : match[1];
      }
      return prog.department;
    }
    const deptObj = departments.find((d) => d.department_id === prog.department_id);
    return deptObj ? deptObj.department_name : 'N/A';
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setSearchTerm(e.target.value);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, sortBy]);

  // Helper function to determine if a string is numeric
  const isNumeric = (str: string): boolean => {
    return !isNaN(Number(str)) && !isNaN(parseFloat(str));
  };

  // Smart sort function that handles both text and numbers
  const smartSort = (a: string, b: string): number => {
    const aIsNumeric = isNumeric(a);
    const bIsNumeric = isNumeric(b);

    if (aIsNumeric && bIsNumeric) {
      // Both are numbers - sort numerically
      return parseFloat(a) - parseFloat(b);
    } else if (aIsNumeric && !bIsNumeric) {
      // a is number, b is text - numbers come first
      return -1;
    } else if (!aIsNumeric && bIsNumeric) {
      // a is text, b is number - numbers come first
      return 1;
    } else {
      // Both are text - sort alphabetically
      return a.localeCompare(b);
    }
  };

  const filteredPrograms = useMemo(() => {
    let filtered = programs.filter((p) => {
      const deptName = getDepartmentName(p).toLowerCase();
      return (
        p.program_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.program_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        deptName.includes(searchTerm.toLowerCase())
      );
    });

    // Apply sorting
    if (sortBy !== 'none') {
      filtered = [...filtered].sort((a, b) => {
        if (sortBy === 'program_id') {
          return smartSort(a.program_id, b.program_id);
        } else if (sortBy === 'program_name') {
          return smartSort(a.program_name.toLowerCase(), b.program_name.toLowerCase());
        } else if (sortBy === 'department') {
          const aDept = getDepartmentName(a).toLowerCase();
          const bDept = getDepartmentName(b).toLowerCase();
          return smartSort(aDept, bDept);
        }
        return 0;
      });
    }

    return filtered;
  }, [programs, searchTerm, sortBy]);

  const paginatedPrograms = useMemo(() => {
    return filteredPrograms.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  }, [filteredPrograms, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredPrograms.length / itemsPerPage);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const isAllSelected = programs.length > 0 && programs.every((p) => selectedIds.has(p.program_id));

  const toggleSelectAll = () => {
    setSelectedIds(() => {
      if (isAllSelected) return new Set();
      const all = new Set<string>();
      programs.forEach((p) => all.add(p.program_id));
      return all;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) {
      toast.info('No programs selected');
      return;
    }
    if (!globalThis.confirm(`Delete ${ids.length} selected program(s)?`)) return;
    setIsBulkDeleting(true);
    try {
      const results = await Promise.allSettled(ids.map((id) => api.delete(`/programs/${id}/`)));
      const ok = results.filter((r) => r.status === 'fulfilled').length;
      const fail = results.length - ok;
      if (ok) toast.success(`Deleted ${ok} program(s)`);
      if (fail) toast.error(`${fail} failed to delete`);
      clearSelection();
      await fetchPrograms();
    } catch (err) {
      console.error('Bulk delete failed:', err);
      toast.error('Bulk delete failed');
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const handleAddProgram = () => {
    setNewProgId('');
    setNewProgName('');
    setNewDeptId('');
    setEditMode(false);
    setEditingProgId(null);
    setShowModal(true);
  };

  const handleModalSubmit = async () => {
    if (!newProgId.trim() || !newProgName.trim() || !newDeptId) {
      toast.error('All fields are required.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editMode && editingProgId) {
        await api.patch(`/programs/${editingProgId}/`, {
          program_name: newProgName,
          department_id: newDeptId,
        });
        toast.success('Program updated.');
      } else {
        await api.post('/programs/', {
          program_id: newProgId,
          program_name: newProgName,
          department_id: newDeptId,
        });
        toast.success('Program added.');
      }
      await fetchPrograms();
      setShowModal(false);
    } catch (err: any) {
      console.error('Failed to save program:', err);
      toast.error('Failed to save program.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Single-item delete replaced with bulk delete

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event: any) => {
      setIsImporting(true);
      const workbook = XLSX.read(new Uint8Array(event.target.result), { type: 'array' });
      const rows: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

      let successCount = 0;
      let failureCount = 0;

      for (const row of rows) {
        const progId = row['Program ID']?.trim();
        const progName = row['Program Name']?.trim();
        const deptName = row['Department Name']?.trim();

        const match = departments.find(
          (d) => d.department_name.trim().toLowerCase() === deptName?.trim().toLowerCase()
        );

        if (!progId || !progName || !match) {
          toast.warn(`Skipped: Invalid data for "${progName || progId || 'Unnamed'}"`);
          failureCount++;
          continue;
        }

        try {
          await api.post('/programs/', {
            program_id: progId,
            program_name: progName,
            department_id: match.department_id,
          });
          successCount++;
        } catch {
          failureCount++;
        }
      }

      toast.success(`Import completed: ${successCount} added, ${failureCount} failed.`);
      await fetchPrograms();
      setShowImport(false);
      setIsImporting(false);
    };

    reader.readAsArrayBuffer(file);
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['Program ID', 'Program Name', 'Department Name'],
      ['BSIT', 'Bachelor of Science in Information Technology', 'Department of IT'],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Programs Template');
    XLSX.writeFile(wb, 'programs_template.xlsx');
  };

  return (
    <div className="colleges-container">
      <div className="colleges-header">
        <div className="search-bar" style={{ marginLeft: 'auto' }}>
          <input
            type="text"
            placeholder="Search for Programs"
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
            <button type="button" onClick={handleAddProgram} className="action-button add-new">
              <FaPlus/>
            </button>
            <button type="button" onClick={() => setShowImport(true)} className="action-button import">
              <FaFileImport/>
            </button>
            <div style={{ position: 'relative' }} data-sort-dropdown>
              <button 
                type='button' 
                className="action-button" 
                onClick={() => setShowSortDropdown(!showSortDropdown)}
                style={{ 
                  backgroundColor: sortBy !== 'none' ? '#0A3765' : '#0A3765',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  minWidth: '100px',
                  transition: 'background-color 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#0d4a7a';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#0A3765';
                }}
                title="Sort"
              >
                <FaSort/>
                <span>Sort</span>
              </button>
              {showSortDropdown && (
                <div 
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    marginTop: '4px',
                    backgroundColor: 'white',
                    border: '1px solid #ddd',
                    borderRadius: '8px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                    zIndex: 1000,
                    minWidth: '150px'
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setSortBy('none');
                      setShowSortDropdown(false);
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      textAlign: 'left',
                      border: 'none',
                      backgroundColor: sortBy === 'none' ? '#f0f0f0' : 'white',
                      color: '#000',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                    onMouseEnter={(e) => {
                      if (sortBy !== 'none') e.currentTarget.style.backgroundColor = '#f5f5f5';
                    }}
                    onMouseLeave={(e) => {
                      if (sortBy !== 'none') e.currentTarget.style.backgroundColor = 'white';
                    }}
                  >
                    None
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSortBy('program_id');
                      setShowSortDropdown(false);
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      textAlign: 'left',
                      border: 'none',
                      backgroundColor: sortBy === 'program_id' ? '#f0f0f0' : 'white',
                      color: '#000',
                      cursor: 'pointer',
                      fontSize: '14px',
                      borderTop: '1px solid #eee'
                    }}
                    onMouseEnter={(e) => {
                      if (sortBy !== 'program_id') e.currentTarget.style.backgroundColor = '#f5f5f5';
                    }}
                    onMouseLeave={(e) => {
                      if (sortBy !== 'program_id') e.currentTarget.style.backgroundColor = 'white';
                    }}
                  >
                    Program ID
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSortBy('program_name');
                      setShowSortDropdown(false);
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      textAlign: 'left',
                      border: 'none',
                      backgroundColor: sortBy === 'program_name' ? '#f0f0f0' : 'white',
                      color: '#000',
                      cursor: 'pointer',
                      fontSize: '14px',
                      borderTop: '1px solid #eee'
                    }}
                    onMouseEnter={(e) => {
                      if (sortBy !== 'program_name') e.currentTarget.style.backgroundColor = '#f5f5f5';
                    }}
                    onMouseLeave={(e) => {
                      if (sortBy !== 'program_name') e.currentTarget.style.backgroundColor = 'white';
                    }}
                  >
                    Program Name
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSortBy('department');
                      setShowSortDropdown(false);
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      textAlign: 'left',
                      border: 'none',
                      backgroundColor: sortBy === 'department' ? '#f0f0f0' : 'white',
                      color: '#000',
                      cursor: 'pointer',
                      fontSize: '14px',
                      borderTop: '1px solid #eee'
                    }}
                    onMouseEnter={(e) => {
                      if (sortBy !== 'department') e.currentTarget.style.backgroundColor = '#f5f5f5';
                    }}
                    onMouseLeave={(e) => {
                      if (sortBy !== 'department') e.currentTarget.style.backgroundColor = 'white';
                    }}
                  >
                    Department
                  </button>
                </div>
              )}
            </div>
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

      <div className="pagination-controls">
        <button type='button'
          onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
          disabled={currentPage === 1}
          className="pagination-arrow-btn"
        >
          &lt;
        </button>
        <span className="pagination-page-number">{currentPage} of {totalPages}</span>
        <button type='button'
          onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
          disabled={currentPage === totalPages}
          className="pagination-arrow-btn"
        >
          &gt;
        </button>
      </div>

      <div className="table-scroll-wrapper">
        <div className="table-scroll-hint">
          <FaChevronLeft /> Swipe or use buttons to scroll <FaChevronRight />
        </div>
        <button
          type="button"
          className="table-scroll-buttons scroll-left"
          onClick={() => scrollTable('left')}
          disabled={!canScrollLeft}
          aria-label="Scroll left"
        >
          <FaChevronLeft />
        </button>
        <button
          type="button"
          className="table-scroll-buttons scroll-right"
          onClick={() => scrollTable('right')}
          disabled={!canScrollRight}
          aria-label="Scroll right"
        >
          <FaChevronRight />
        </button>
        <div className="colleges-table-container" ref={tableContainerRef}>
          <table className="colleges-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Code</th>
              <th>Name</th>
              <th>Department</th>
              <th>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>Actions</span>
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={toggleSelectAll}
                    disabled={loading || programs.length === 0}
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
                <td colSpan={5} style={{ textAlign: 'center', padding: '20px' }}>
                  Loading programs...
                </td>
              </tr>
            ) : filteredPrograms.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '20px' }}>
                  No programs found.
                </td>
              </tr>
            ) : (
              paginatedPrograms.map((p, idx) => (
                <tr key={p.program_id}>
                  <td>{(currentPage - 1) * itemsPerPage + idx + 1}</td>
                  <td>{p.program_id}</td>
                  <td>{p.program_name}</td>
                  <td>{getDepartmentName(p)}</td>
                  <td className="action-buttons" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => {
                        setNewProgId(p.program_id);
                        setNewProgName(p.program_name);
                        setNewDeptId(p.department_id);
                        setEditMode(true);
                        setEditingProgId(p.program_id);
                        setShowModal(true);
                      }}
                      className="icon-button edit-button"
                    >
                      <FaEdit />
                    </button>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(p.program_id)}
                      onChange={() => toggleSelect(p.program_id)}
                      aria-label={`Select ${p.program_name}`}
                      style={{ marginLeft: 'auto' }}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3 style={{ textAlign: 'center' }}>{editMode ? 'Edit Program' : 'Add Program'}</h3>
            <div className="input-group">
              <label>Program Code</label>
              <input
                type="text"
                value={newProgId}
                onChange={(e) => setNewProgId(e.target.value)}
                disabled={editMode}
              />
            </div>
            <div className="input-group">
              <label>Name</label>
              <input
                type="text"
                value={newProgName}
                onChange={(e) => setNewProgName(e.target.value)}
              />
            </div>
            <div className="input-group">
              <label>Department</label>
              <Select
                className="custom-select"
                classNamePrefix="custom"
                options={departments.map((d) => ({
                  value: d.department_id,
                  label: `${d.department_name} (${d.department_id})`,
                }))}
                value={
                  newDeptId
                    ? {
                        value: newDeptId,
                        // Find the department to construct the label, falling back to just the ID if not found
                        label:
                          departments.find((d) => d.department_id === newDeptId)?.department_name +
                          ` (${newDeptId})`,
                      }
                    : null
                }
                onChange={(selected) => setNewDeptId(selected ? selected.value : '')}
                placeholder="Select department"
                isClearable
              />
            </div>
            <div className="modal-actions">
              <button type="button" onClick={handleModalSubmit} disabled={isSubmitting}>
                {isSubmitting ? 'Saving…' : 'Save'}
              </button>
              <button type="button" onClick={() => setShowModal(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showImport && (
        <div className="modal-overlay">
          <div className="modal">
            <h3 style={{ textAlign: 'center' }}>Import Programs</h3>
            <p style={{ fontSize: '12px', color: '#666', marginBottom: '10px' }}>
              Each program must belong to an existing department. Use the template below.
            </p>

            <input type="file" accept=".xlsx,.xls" onChange={handleImportFile} disabled={isImporting} />

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
                {isImporting ? 'Importing…' : 'Done'}
              </button>
              <button type="button" onClick={() => setShowImport(false)} disabled={isImporting}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer position="top-right" autoClose={3000} />
    </div>
  );
};

export default Programs;
