// deno-lint-ignore-file no-explicit-any
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { FaTrash, FaEdit, FaSearch, FaDownload, FaPlus, FaFileImport, FaChevronLeft, FaChevronRight, FaSort, FaChevronDown } from 'react-icons/fa';
import { api } from '../lib/apiClient.ts';
import { ToastContainer, toast } from 'react-toastify';
import * as XLSX from 'xlsx';
import 'react-toastify/dist/ReactToastify.css';
import '../styles/A_Colleges.css';
import { useEscapeKey } from '../hooks/useEscapeKey.ts';

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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteCount, setDeleteCount] = useState(0);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  // Handle ESC key to close modals
  useEscapeKey(() => {
    if (showModal) {
      setShowModal(false);
      setEditMode(false);
      setNewCollegeId('');
      setNewCollegeName('');
    }
  }, showModal);

  useEscapeKey(() => {
    if (showImport) {
      setShowImport(false);
    }
  }, showImport);

  useEscapeKey(() => {
    if (showDeleteConfirm) {
      setShowDeleteConfirm(false);
    }
  }, showDeleteConfirm);

  // Fetch Colleges on Load
  useEffect(() => {
    fetchColleges();
  }, []);

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
  }, [colleges, searchTerm, loading]);

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

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, sortBy, itemsPerPage]);

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

  const filteredColleges = useMemo(() => {
    let filtered = colleges.filter(
      (college) =>
        college.college_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        college.college_id.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Apply sorting
    if (sortBy !== 'none') {
      filtered = [...filtered].sort((a, b) => {
        if (sortBy === 'college_id') {
          return smartSort(a.college_id, b.college_id);
        } else if (sortBy === 'college_name') {
          return smartSort(a.college_name.toLowerCase(), b.college_name.toLowerCase());
        }
        return 0;
      });
    }

    return filtered;
  }, [colleges, searchTerm, sortBy]);

  const totalItems = filteredColleges.length;

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

  const paginatedColleges = useMemo(() => {
    if (totalItems === 0) return [];
    return filteredColleges.slice(
      (currentPage - 1) * effectiveItemsPerPage,
      currentPage * effectiveItemsPerPage,
    );
  }, [filteredColleges, currentPage, effectiveItemsPerPage, totalItems]);

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

  const handleBulkDelete = () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) {
      toast.info('No colleges selected');
      return;
    }
    setDeleteCount(ids.length);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    const ids = Array.from(selectedIds);
    setShowDeleteConfirm(false);
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
      setIsImporting(false); 
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

  return (
    <div className="cl-page">

      {/* ── Page Header ── */}
      <div className="cl-page-header">
        <div className="cl-page-header-left">
          <div className="cl-page-icon">
            <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
            </svg>
          </div>
          <div className="cl-page-title">
            <h1>Colleges</h1>
            <p>{colleges.length} college{colleges.length !== 1 ? 's' : ''} · {filteredColleges.length} showing</p>
          </div>
        </div>

        <div className="cl-page-actions">
          {/* Search */}
          <div className="cl-search-bar">
            <FaSearch className="cl-search-icon" />
            <input
              type="text"
              placeholder="Search colleges…"
              value={searchTerm}
              onChange={handleSearchChange}
            />
          </div>

          <button type="button" className="cl-btn primary" onClick={handleAddCollege}>
            <FaPlus style={{ fontSize: '11px' }} /> Add
          </button>
          <button type="button" className="cl-btn" onClick={() => setShowImport(true)}>
            <FaFileImport style={{ fontSize: '11px' }} /> Import
          </button>
          <button
            type="button"
            className="cl-btn danger"
            onClick={handleBulkDelete}
            disabled={isBulkDeleting || selectedIds.size === 0}
            title={selectedIds.size ? `Delete ${selectedIds.size} selected` : 'Select rows to delete'}
          >
            <FaTrash style={{ fontSize: '11px' }} />
            {selectedIds.size > 0 && <span>({selectedIds.size})</span>}
          </button>
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div className="cl-toolbar">
        <div className="cl-toolbar-left">

          {/* Sort dropdown */}
          <div style={{ position: 'relative' }} data-sort-dropdown>
            <button
              type="button"
              className="cl-toolbar-btn"
              onClick={() => setShowSortDropdown(!showSortDropdown)}
            >
              <FaSort style={{ fontSize: '11px' }} />
              Sort{sortBy !== 'none' ? `: ${sortBy === 'college_id' ? 'ID' : 'Name'}` : ''}
              <FaChevronDown style={{ fontSize: '9px', marginLeft: '2px' }} />
            </button>
            {showSortDropdown && (
              <div className="cl-dropdown">
                {[
                  { value: 'none', label: 'None' },
                  { value: 'college_id', label: 'College ID' },
                  { value: 'college_name', label: 'College Name' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`cl-dropdown-item${sortBy === opt.value ? ' active' : ''}`}
                    onClick={() => { setSortBy(opt.value); setShowSortDropdown(false); }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Rows per page dropdown */}
          <div style={{ position: 'relative' }} data-items-per-page-dropdown>
            <button
              type="button"
              className="cl-toolbar-btn"
              onClick={() => setShowItemsPerPageDropdown(!showItemsPerPageDropdown)}
            >
              <FaChevronDown style={{ fontSize: '9px' }} />
              Rows: {itemsPerPage === 'all' ? 'All' : itemsPerPage}
            </button>
            {showItemsPerPageDropdown && (
              <div className="cl-dropdown" style={{ minWidth: '200px' }}>
                {[10, 20, 30].map(n => (
                  <button
                    key={n}
                    type="button"
                    className={`cl-dropdown-item${itemsPerPage === n ? ' active' : ''}`}
                    onClick={() => handleItemsPerPageChange(n)}
                  >
                    {n}
                  </button>
                ))}
                <div className="cl-dropdown-divider" />
                <div className="cl-dropdown-custom">
                  <input
                    type="number"
                    className="cl-custom-input"
                    value={customItemsPerPage}
                    onChange={e => setCustomItemsPerPage(e.target.value)}
                    placeholder="Custom…"
                    min="1"
                    onKeyDown={e => { if (e.key === 'Enter') handleCustomItemsPerPage(); }}
                  />
                  <button type="button" className="cl-btn primary" style={{ padding: '5px 10px', fontSize: '11px' }} onClick={handleCustomItemsPerPage}>Apply</button>
                </div>
                <button
                  type="button"
                  className={`cl-dropdown-item${itemsPerPage === 'all' ? ' active' : ''}`}
                  onClick={() => handleItemsPerPageChange('all')}
                >
                  Show All
                </button>
              </div>
            )}
          </div>

        </div>

        {/* Pagination */}
        <div className="cl-pagination">
          <button
            type="button"
            className="cl-page-btn"
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage <= 1 || totalItems === 0}
          >
            <FaChevronLeft style={{ fontSize: '10px' }} />
          </button>
          <span className="cl-page-info">
            {totalItems === 0 ? '0 / 0' : `${currentPage} / ${totalPages}`}
          </span>
          <button
            type="button"
            className="cl-page-btn"
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage >= totalPages || totalItems === 0}
          >
            <FaChevronRight style={{ fontSize: '10px' }} />
          </button>
        </div>
      </div>

      {/* ── Table Card ── */}
      <div className="cl-table-card">
        <div className="cl-table-scroll-wrapper">
          <button
            type="button"
            className="cl-scroll-btn left"
            onClick={() => scrollTable('left')}
            disabled={!canScrollLeft}
          >
            <FaChevronLeft />
          </button>
          <button
            type="button"
            className="cl-scroll-btn right"
            onClick={() => scrollTable('right')}
            disabled={!canScrollRight}
          >
            <FaChevronRight />
          </button>

          <div className="cl-table-container" ref={tableContainerRef}>
            <table className="cl-table">
              <thead>
                <tr>
                  <th style={{ width: '52px' }}>#</th>
                  <th>College ID</th>
                  <th>College Name</th>
                  <th style={{ width: '120px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span>Actions</span>
                      <input
                        type="checkbox"
                        checked={isAllSelected}
                        onChange={toggleSelectAll}
                        disabled={loading || colleges.length === 0}
                        title="Select all"
                        style={{ cursor: 'pointer' }}
                      />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={4} className="cl-table-empty">
                      <div className="cl-spinner" />
                      Loading colleges…
                    </td>
                  </tr>
                ) : filteredColleges.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="cl-table-empty">No colleges found.</td>
                  </tr>
                ) : (
                  paginatedColleges.map((college, index) => {
                    const isSelected = selectedIds.has(college.college_id);
                    return (
                      <tr key={college.college_id} className={isSelected ? 'selected' : ''}>
                        <td className="cl-td-num">{(currentPage - 1) * effectiveItemsPerPage + index + 1}</td>
                        <td><span className="cl-id-badge">{college.college_id}</span></td>
                        <td>{college.college_name}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <button
                              type="button"
                              className="cl-icon-btn edit"
                              onClick={() => {
                                setNewCollegeId(college.college_id);
                                setNewCollegeName(college.college_name);
                                setEditMode(true);
                                setEditingCollegeId(college.college_id);
                                setShowModal(true);
                              }}
                            >
                              <FaEdit style={{ fontSize: '11px' }} /> Edit
                            </button>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelect(college.college_id)}
                              aria-label={`Select ${college.college_name}`}
                              style={{ marginLeft: 'auto', cursor: 'pointer' }}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ════ ADD / EDIT MODAL ════ */}
      {showModal && (
        <div className="cl-modal-overlay" onClick={() => { setShowModal(false); setEditMode(false); }}>
          <div className="cl-modal" onClick={e => e.stopPropagation()}>
            <div className="cl-modal-header">
              <h3>{editMode ? 'Edit College' : 'Add New College'}</h3>
            </div>
            <div className="cl-modal-body">
              <div className="cl-field">
                <label>College ID</label>
                <input
                  type="text"
                  value={newCollegeId}
                  onChange={e => setNewCollegeId(e.target.value)}
                  disabled={editMode}
                  className="cl-input"
                  placeholder="e.g. CITC"
                />
              </div>
              <div className="cl-field">
                <label>College Name</label>
                <input
                  type="text"
                  value={newCollegeName}
                  onChange={e => setNewCollegeName(e.target.value)}
                  className="cl-input"
                  placeholder="e.g. College of Information Technology"
                />
              </div>
            </div>
            <div className="cl-modal-footer">
              <button type="button" className="cl-btn" onClick={() => { setShowModal(false); setEditMode(false); }}>Cancel</button>
              <button type="button" className="cl-btn primary" onClick={handleModalSubmit} disabled={isSubmitting}>
                {isSubmitting ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════ IMPORT MODAL ════ */}
      {showImport && (
        <div className="cl-modal-overlay" onClick={() => setShowImport(false)}>
          <div className="cl-modal" onClick={e => e.stopPropagation()}>
            <div className="cl-modal-header">
              <h3>Import Colleges</h3>
              <p>Upload an .xlsx file using the template below.</p>
            </div>
            <div className="cl-modal-body">
              <p className="cl-import-hint">Each college must have a unique College ID.</p>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleImportFile}
                disabled={isImporting}
                className="cl-file-input"
              />
              <button
                type="button"
                className="cl-btn"
                onClick={downloadTemplate}
                disabled={isImporting}
                style={{ width: '100%', justifyContent: 'center', marginTop: '8px' }}
              >
                <FaDownload style={{ fontSize: '11px' }} /> Download Template
              </button>
            </div>
            <div className="cl-modal-footer">
              <button type="button" className="cl-btn primary" onClick={() => setShowImport(false)} disabled={isImporting}>
                {isImporting ? 'Importing…' : 'Done'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════ DELETE CONFIRM MODAL ════ */}
      {showDeleteConfirm && (
        <div className="cl-modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="cl-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '380px' }}>
            <div className="cl-modal-header">
              <h3>Confirm Deletion</h3>
            </div>
            <div className="cl-modal-body">
              <p style={{ fontSize: '13.5px', color: 'var(--cl-text-secondary)', lineHeight: 1.7, margin: 0 }}>
                {deleteCount === 1
                  ? 'You are about to delete 1 college. This action cannot be undone.'
                  : `You are about to delete ${deleteCount} colleges. This action cannot be undone.`}
              </p>
            </div>
            <div className="cl-modal-footer">
              <button type="button" className="cl-btn" onClick={() => setShowDeleteConfirm(false)} disabled={isBulkDeleting}>Cancel</button>
              <button type="button" className="cl-btn danger-fill" onClick={confirmDelete} disabled={isBulkDeleting}>
                {isBulkDeleting ? 'Deleting…' : 'Yes, Delete'}
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
