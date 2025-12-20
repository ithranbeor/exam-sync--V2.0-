// deno-lint-ignore-file no-explicit-any
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { FaTrash, FaEdit, FaSearch, FaDownload, FaPlus, FaFileImport, FaChevronLeft, FaChevronRight, FaSort, FaChevronDown } from 'react-icons/fa';
import { api } from '../lib/apiClient.ts';
import { ToastContainer, toast } from 'react-toastify';
import * as XLSX from 'xlsx';
import 'react-toastify/dist/ReactToastify.css';
import '../styles/A_Department.css';
import { useEscapeKey } from '../hooks/useEscapeKey.ts';

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
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState<number | 'all'>('all');
  const [showItemsPerPageDropdown, setShowItemsPerPageDropdown] = useState(false);
  const [customItemsPerPage, setCustomItemsPerPage] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [sortBy, setSortBy] = useState<string>('none');
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  // Handle ESC key to close modals
  useEscapeKey(() => {
    if (showModal) {
      setShowModal(false);
      setEditMode(false);
      setNewDeptId('');
      setNewDeptName('');
      setNewCollegeId('');
    }
  }, showModal);

  useEscapeKey(() => {
    if (showImport) {
      setShowImport(false);
    }
  }, showImport);

  useEffect(() => {
    fetchDepartments();
    fetchColleges();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showSortDropdown && !target.closest('[data-sort-dropdown]')) {
        setShowSortDropdown(false);
      }
      if (showItemsPerPageDropdown && !target.closest('[data-items-per-page-dropdown]')) {
        setShowItemsPerPageDropdown(false);
      }
    };

    if (showSortDropdown || showItemsPerPageDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSortDropdown, showItemsPerPageDropdown]);

  useEffect(() => {
    const checkScroll = () => {
      const container = tableContainerRef.current;
      if (!container) return;

      const { scrollLeft, scrollWidth, clientWidth } = container;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1);

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
  }, [departments, searchTerm, loading]);

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
      return parseFloat(a) - parseFloat(b);
    } else if (aIsNumeric && !bIsNumeric) {
      return -1;
    } else if (!aIsNumeric && bIsNumeric) {
      return 1;
    } else {
      return a.localeCompare(b);
    }
  };

  const filteredDepartments = useMemo(() => {
    let filtered = departments.filter((dept) => {
      const collegeName = dept.college?.college_name || '';
      return (
        dept.department_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        dept.department_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        collegeName.toLowerCase().includes(searchTerm.toLowerCase())
      );
    });

    // Apply sorting
    if (sortBy !== 'none') {
      filtered = [...filtered].sort((a, b) => {
        if (sortBy === 'department_id') {
          return smartSort(a.department_id, b.department_id);
        } else if (sortBy === 'department_name') {
          return smartSort(a.department_name.toLowerCase(), b.department_name.toLowerCase());
        } else if (sortBy === 'college') {
          const aCollege = a.college?.college_name || a.college?.college_id || '';
          const bCollege = b.college?.college_name || b.college?.college_id || '';
          return smartSort(aCollege.toLowerCase(), bCollege.toLowerCase());
        }
        return 0;
      });
    }

    return filtered;
  }, [departments, searchTerm, sortBy]);

  const totalItems = filteredDepartments.length;

  const effectiveItemsPerPage = useMemo(() => {
    if (totalItems === 0) return 1;

    if (itemsPerPage === 'all') {
      // "Show All" should display 20 rows per page
      return 20;
    }

    return itemsPerPage;
  }, [itemsPerPage, totalItems]);

  const totalPages = useMemo(() => {
    if (totalItems === 0) return 1;
    return Math.max(1, Math.ceil(totalItems / effectiveItemsPerPage));
  }, [totalItems, effectiveItemsPerPage]);

  const paginatedDepartments = useMemo(() => {
    if (totalItems === 0) return [];
    return filteredDepartments.slice(
      (currentPage - 1) * effectiveItemsPerPage,
      currentPage * effectiveItemsPerPage,
    );
  }, [filteredDepartments, currentPage, effectiveItemsPerPage, totalItems]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const isAllSelected = departments.length > 0 && departments.every((d) => selectedIds.has(d.department_id));

  const toggleSelectAll = () => {
    setSelectedIds(() => {
      if (isAllSelected) return new Set();
      const all = new Set<string>();
      departments.forEach((d) => all.add(d.department_id));
      return all;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const handleItemsPerPageChange = (value: number | 'all') => {
    setItemsPerPage(value);
    setShowItemsPerPageDropdown(false);
    setCurrentPage(1);
  };

  const handleCustomItemsPerPage = () => {
    const numValue = parseInt(customItemsPerPage, 10);
    if (!isNaN(numValue) && numValue > 0) {
      setItemsPerPage(numValue);
      setCustomItemsPerPage('');
      setShowItemsPerPageDropdown(false);
      setCurrentPage(1);
    } else {
      toast.error('Please enter a valid positive number.');
    }
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) {
      toast.info('No departments selected');
      return;
    }
    if (!window.confirm(`Delete ${ids.length} selected department(s)?`)) return;
    setIsBulkDeleting(true);
    try {
      const results = await Promise.allSettled(ids.map((id) => api.delete(`/departments/${id}/`)));
      const ok = results.filter((r) => r.status === 'fulfilled').length;
      const fail = results.length - ok;
      if (ok) toast.success(`Deleted ${ok} department(s)`);
      if (fail) toast.error(`${fail} failed to delete`);
      clearSelection();
      fetchDepartments();
    } catch (e) {
      console.error(e);
      toast.error('Bulk delete failed');
    } finally {
      setIsBulkDeleting(false);
    }
  };

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
        <div className="search-bar" style={{ marginLeft: 'auto' }}>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button type="button" className="action-button add-new with-label" onClick={handleAddDepartment}><FaPlus /><span className="btn-label">Add</span></button>
            <button type="button" className="action-button import with-label" onClick={() => setShowImport(true)}><FaFileImport /><span className="btn-label">Import</span></button>
            <div style={{ position: 'relative' }} data-sort-dropdown>
              <button
                type='button'
                className="action-button with-label sort-by-button"
                onClick={() => setShowSortDropdown(!showSortDropdown)}
                title="Sort by"
              >
                <FaSort />
                <span className="btn-label">Sort by</span>
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
                      setSortBy('department_id');
                      setShowSortDropdown(false);
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      textAlign: 'left',
                      border: 'none',
                      backgroundColor: sortBy === 'department_id' ? '#f0f0f0' : 'white',
                      color: '#000',
                      cursor: 'pointer',
                      fontSize: '14px',
                      borderTop: '1px solid #eee'
                    }}
                    onMouseEnter={(e) => {
                      if (sortBy !== 'department_id') e.currentTarget.style.backgroundColor = '#f5f5f5';
                    }}
                    onMouseLeave={(e) => {
                      if (sortBy !== 'department_id') e.currentTarget.style.backgroundColor = 'white';
                    }}
                  >
                    Department ID
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSortBy('department_name');
                      setShowSortDropdown(false);
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      textAlign: 'left',
                      border: 'none',
                      backgroundColor: sortBy === 'department_name' ? '#f0f0f0' : 'white',
                      color: '#000',
                      cursor: 'pointer',
                      fontSize: '14px',
                      borderTop: '1px solid #eee'
                    }}
                    onMouseEnter={(e) => {
                      if (sortBy !== 'department_name') e.currentTarget.style.backgroundColor = '#f5f5f5';
                    }}
                    onMouseLeave={(e) => {
                      if (sortBy !== 'department_name') e.currentTarget.style.backgroundColor = 'white';
                    }}
                  >
                    Department Name
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSortBy('college');
                      setShowSortDropdown(false);
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      textAlign: 'left',
                      border: 'none',
                      backgroundColor: sortBy === 'college' ? '#f0f0f0' : 'white',
                      color: '#000',
                      cursor: 'pointer',
                      fontSize: '14px',
                      borderTop: '1px solid #eee'
                    }}
                    onMouseEnter={(e) => {
                      if (sortBy !== 'college') e.currentTarget.style.backgroundColor = '#f5f5f5';
                    }}
                    onMouseLeave={(e) => {
                      if (sortBy !== 'college') e.currentTarget.style.backgroundColor = 'white';
                    }}
                  >
                    College
                  </button>
                </div>
              )}
            </div>
            <div style={{ position: 'relative' }} data-items-per-page-dropdown>
              <button
                type="button"
                className="action-button with-label show-rows-button"
                onClick={() => setShowItemsPerPageDropdown(!showItemsPerPageDropdown)}
              >
                <FaChevronDown size={12} />
                <span className="btn-label">Show rows: {itemsPerPage === 'all' ? 'All' : itemsPerPage}</span>
              </button>
              {showItemsPerPageDropdown && (
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
                    minWidth: '240px',
                    padding: '8px'
                  }}
                >
                  <button
                    type="button"
                    onClick={() => handleItemsPerPageChange(10)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      textAlign: 'left',
                      border: 'none',
                      backgroundColor: itemsPerPage === 10 ? '#f0f0f0' : 'white',
                      color: '#000',
                      cursor: 'pointer',
                      fontSize: '14px',
                      borderRadius: '4px'
                    }}
                    onMouseEnter={(e) => {
                      if (itemsPerPage !== 10) e.currentTarget.style.backgroundColor = '#f5f5f5';
                    }}
                    onMouseLeave={(e) => {
                      if (itemsPerPage !== 10) e.currentTarget.style.backgroundColor = 'white';
                    }}
                  >
                    10
                  </button>
                  <button
                    type="button"
                    onClick={() => handleItemsPerPageChange(20)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      textAlign: 'left',
                      border: 'none',
                      backgroundColor: itemsPerPage === 20 ? '#f0f0f0' : 'white',
                      color: '#000',
                      cursor: 'pointer',
                      fontSize: '14px',
                      borderRadius: '4px',
                      borderTop: '1px solid #eee'
                    }}
                    onMouseEnter={(e) => {
                      if (itemsPerPage !== 20) e.currentTarget.style.backgroundColor = '#f5f5f5';
                    }}
                    onMouseLeave={(e) => {
                      if (itemsPerPage !== 20) e.currentTarget.style.backgroundColor = 'white';
                    }}
                  >
                    20
                  </button>
                  <button
                    type="button"
                    onClick={() => handleItemsPerPageChange(30)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      textAlign: 'left',
                      border: 'none',
                      backgroundColor: itemsPerPage === 30 ? '#f0f0f0' : 'white',
                      color: '#000',
                      cursor: 'pointer',
                      fontSize: '14px',
                      borderRadius: '4px',
                      borderTop: '1px solid #eee'
                    }}
                    onMouseEnter={(e) => {
                      if (itemsPerPage !== 30) e.currentTarget.style.backgroundColor = '#f5f5f5';
                    }}
                    onMouseLeave={(e) => {
                      if (itemsPerPage !== 30) e.currentTarget.style.backgroundColor = 'white';
                    }}
                  >
                    30
                  </button>
                  <div style={{ borderTop: '1px solid #eee', marginTop: '4px', paddingTop: '8px' }}>
                    <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
                      <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
                        <input
                          type="number"
                          data-custom-input
                          className="custom-number-input"
                          value={customItemsPerPage}
                          onChange={(e) => setCustomItemsPerPage(e.target.value)}
                          placeholder="Custom Number"
                          min="1"
                          style={{
                            width: '100%',
                            padding: '6px 32px 6px 8px',
                            border: '1px solid #0A3765',
                            borderRadius: '4px',
                            fontSize: '14px',
                            backgroundColor: '#ffffff',
                            color: '#333',
                            outline: 'none'
                          }}
                          onFocus={(e) => {
                            e.target.style.borderColor = '#0d4a7a';
                            e.target.style.boxShadow = '0 0 0 2px rgba(10, 55, 101, 0.1)';
                          }}
                          onBlur={(e) => {
                            e.target.style.borderColor = '#0A3765';
                            e.target.style.boxShadow = 'none';
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleCustomItemsPerPage();
                            }
                          }}
                        />
                        <div style={{ position: 'absolute', right: '2px', display: 'flex', flexDirection: 'column', height: 'calc(100% - 4px)', gap: '0px', justifyContent: 'center', alignItems: 'center' }}>
                          <button
                            type="button"
                            onClick={() => {
                              const current = parseInt(customItemsPerPage) || 1;
                              setCustomItemsPerPage(String(current + 1));
                            }}
                            style={{
                              height: 'auto',
                              background: 'transparent',
                              border: 'none',
                              color: '#0A3765',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '10px',
                              fontWeight: 'bold',
                              padding: '0',
                              width: '16px',
                              lineHeight: '1',
                              transition: 'color 0.2s',
                              borderRadius: '0',
                              boxSizing: 'border-box'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.color = '#0d4a7a';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.color = '#0A3765';
                            }}
                          >
                            ^
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const current = parseInt(customItemsPerPage) || 1;
                              if (current > 1) {
                                setCustomItemsPerPage(String(current - 1));
                              }
                            }}
                            style={{
                              height: 'auto',
                              background: 'transparent',
                              border: 'none',
                              color: '#0A3765',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '10px',
                              fontWeight: 'bold',
                              padding: '0',
                              width: '16px',
                              lineHeight: '1',
                              transition: 'color 0.2s',
                              borderRadius: '0',
                              boxSizing: 'border-box'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.color = '#0d4a7a';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.color = '#0A3765';
                            }}
                          >
                            v
                          </button>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleCustomItemsPerPage}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: '#0A3765',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}
                      >
                        Apply
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleItemsPerPageChange('all')}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        textAlign: 'left',
                        border: 'none',
                        backgroundColor: itemsPerPage === 'all' ? '#f0f0f0' : 'white',
                        color: '#000',
                        cursor: 'pointer',
                        fontSize: '14px',
                        borderRadius: '4px',
                        marginTop: '4px'
                      }}
                      onMouseEnter={(e) => {
                        if (itemsPerPage !== 'all') e.currentTarget.style.backgroundColor = '#f5f5f5';
                      }}
                      onMouseLeave={(e) => {
                        if (itemsPerPage !== 'all') e.currentTarget.style.backgroundColor = 'white';
                      }}
                    >
                      Show All
                    </button>
                  </div>
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
              <FaTrash />
            </button>
          </div>
        </div>
      </div>

      <div className="pagination-controls">
        <button
          type="button"
          className="pagination-arrow-btn"
          onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
          disabled={currentPage <= 1 || totalItems === 0}
        >
          {"<"}
        </button>
        <span className="pagination-page-number">
          {totalItems === 0 ? '0/0' : `${currentPage}/${totalPages}`}
        </span>
        <button
          type="button"
          className="pagination-arrow-btn"
          onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
          disabled={currentPage >= totalPages || totalItems === 0}
        >
          {">"}
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
                <th>Department ID</th>
                <th>Department Name</th>
                <th>College</th>
                <th>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>Actions</span>
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      onChange={toggleSelectAll}
                      disabled={loading || departments.length === 0}
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
                paginatedDepartments.map((dept, index) => {
                  const isSelected = selectedIds.has(dept.department_id);
                  return (
                    <tr
                      key={dept.department_id}
                      style={{
                        backgroundColor: isSelected ? '#f8d7da' : 'transparent',
                      }}
                    >
                      <td>{(currentPage - 1) * effectiveItemsPerPage + index + 1}</td>
                      <td>{dept.department_id}</td>
                      <td>{dept.department_name}</td>
                      <td>{dept.college?.college_name || dept.college?.college_id}</td>
                      <td className="action-buttons" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button type="button" className="icon-button edit-button" onClick={() => {
                          setNewDeptId(dept.department_id);
                          setNewDeptName(dept.department_name);
                          setNewCollegeId(dept.college?.college_id || '');
                          setEditMode(true);
                          setEditingDeptId(dept.department_id);
                          setShowModal(true);
                        }}>
                          <FaEdit/> Edit
                        </button>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(dept.department_id)}
                          onChange={() => toggleSelect(dept.department_id)}
                          aria-label={`Select ${dept.department_name}`}
                          style={{ marginLeft: 'auto' }}
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
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
