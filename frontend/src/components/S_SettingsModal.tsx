import React, { useState, useEffect } from 'react';
import { api } from '../lib/apiClient';
import { toast } from 'react-toastify';
import '../styles/S_SettingsModal.css';
import { FaImage, FaEye, FaFileSignature, FaTimes } from 'react-icons/fa';

interface FooterSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  collegeName: string;
  collegeId: string;
  showIconLabels: boolean;
  onIconLabelsChange: (show: boolean) => void;
  onSave: () => void;
}

interface FooterData {
  footer_id?: number;
  college_id?: string;
  prepared_by_name: string;
  prepared_by_title: string;
  approved_by_name: string;
  approved_by_title: string;
  address_line: string;
  contact_line: string;
  logo_url: string | null;
  logo_urls?: string[];
}

const FooterSettingsModal: React.FC<FooterSettingsModalProps> = ({
  isOpen,
  onClose,
  collegeName,
  collegeId,
  showIconLabels,
  onIconLabelsChange,
  onSave
}) => {
  const [footerData, setFooterData] = useState<FooterData>({
    prepared_by_name: 'Loading...',
    prepared_by_title: `Dean, ${collegeName}`,
    approved_by_name: 'Loading...',
    approved_by_title: 'VCAA, USTP-CDO',
    address_line: 'C.M Recto Avenue, Lapasan, Cagayan de Oro City 9000 Philippines',
    contact_line: 'Tel Nos. +63 (88) 856 1738; Telefax +63 (88) 856 4696 | http://www.ustp.edu.ph',
    logo_url: null,
    logo_urls: []
  });

  const [logoFiles, setLogoFiles] = useState<File[]>([]);
  const [logoPreviews, setLogoPreviews] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [deanName, setDeanName] = useState<string>('');
  const [vcaaName, setVcaaName] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'appearance' | 'display' | 'footer' | 'about'>('appearance');

  useEffect(() => {
    const fetchRoleNames = async () => {
      if (!collegeName || collegeName === "Add schedule first") return;

      try {
        const deanResponse = await api.get('/tbl_user_role', {
          params: {
            college_name: collegeName,
            role_id: 1
          }
        });

        if (deanResponse.data?.length > 0) {
          const deanRole = deanResponse.data[0];

          if (deanRole.user?.first_name && deanRole.user?.last_name) {
            const fullName = `${deanRole.user.first_name} ${deanRole.user.last_name}`;
            setDeanName(fullName);
          } else if (deanRole.user_id) {
            try {
              const userRes = await api.get(`/users/${deanRole.user_id}/`);
              const user = userRes.data;
              if (user?.first_name && user?.last_name) {
                setDeanName(`${user.first_name} ${user.last_name}`);
              }
            } catch (err) { }
          } else {
            setDeanName('Dean Name Not Found');
          }
        }

        const vcaaResponse = await api.get('/tbl_user_role', {
          params: { role_id: 2 }
        });

        if (vcaaResponse.data && vcaaResponse.data.length > 0) {
          const vcaaRole = vcaaResponse.data[0];
          if (vcaaRole.user?.first_name && vcaaRole.user?.last_name) {
            setVcaaName(`${vcaaRole.user.first_name} ${vcaaRole.user.last_name}`);
          }
        }
      } catch (error) { }
    };

    fetchRoleNames();
  }, [collegeName]);

  useEffect(() => {
    if (isOpen && collegeId && (deanName || vcaaName)) {
      fetchFooterData();
    }
  }, [isOpen, collegeId, deanName, vcaaName]);

  const fetchFooterData = async () => {
    if (!collegeId) return;

    setIsLoading(true);
    try {
      const response = await api.get('/tbl_schedule_footer/', {
        params: { college_id: collegeId }
      });

      if (response.data && response.data.length > 0) {
        const data = response.data[0];
        setFooterData({
          ...data,
          prepared_by_name:
            data.prepared_by_name?.trim()
              ? data.prepared_by_name
              : deanName,
        });

        // Support both logo_urls (array) and legacy logo_url (single)
        if (data.logo_urls && data.logo_urls.length > 0) {
          setLogoPreviews(data.logo_urls);
        } else if (data.logo_url) {
          setLogoPreviews([data.logo_url]);
        } else {
          setLogoPreviews([]);
        }
      } else {
        const preparedByName = deanName || 'Dean Name Not Found';
        const approvedByName = vcaaName || 'VCAA Name Not Found';

        setFooterData(prev => ({
          ...prev,
          prepared_by_name: preparedByName,
          prepared_by_title: `Dean, ${collegeName}`,
          approved_by_name: approvedByName,
          approved_by_title: 'VCAA, USTP-CDO'
        }));
        setLogoPreviews([]);
      }
    } catch (error) {
      toast.error("Failed to load footer settings");
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: keyof FooterData, value: string) => {
    setFooterData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Invalid file type. Please upload JPEG, PNG, GIF, or WEBP');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('File too large. Maximum size is 5MB');
      return;
    }

    // Append new file to existing list
    setLogoFiles(prev => [...prev, file]);

    const reader = new FileReader();
    reader.onloadend = () => {
      setLogoPreviews(prev => [...prev, reader.result as string]);
    };
    reader.readAsDataURL(file);

    // Reset input so same file can be re-added
    e.target.value = '';
  };

  const handleRemoveLogo = (index: number) => {
    const isExistingUrl = logoPreviews[index]?.startsWith('http');

    setLogoPreviews(prev => prev.filter((_, i) => i !== index));

    // Only remove from logoFiles if it's a newly added file (not an existing URL)
    if (!isExistingUrl) {
      // Count how many previews before this index are base64 (new files)
      const newFileIndex = logoPreviews
        .slice(0, index)
        .filter(p => !p.startsWith('http')).length;
      setLogoFiles(prev => prev.filter((_, i) => i !== newFileIndex));
    }

    if (logoPreviews.length === 1) {
      setFooterData(prev => ({ ...prev, logo_url: null, logo_urls: [] }));
    }
  };

  const handleSave = async () => {
    if (!collegeId) {
      toast.error('College ID not found. Please try again.');
      return;
    }

    if (!footerData.prepared_by_name?.trim()) {
      toast.error('Prepared by name is required');
      return;
    }

    if (!footerData.approved_by_name?.trim()) {
      toast.error('Approved by name is required');
      return;
    }

    setIsSaving(true);
    try {
      let logoUrls: string[] = [];

      // Keep existing saved URLs (those that are http URLs, not base64)
      const existingUrls = logoPreviews.filter(p => p.startsWith('http'));
      logoUrls = [...existingUrls];

      // Upload any new files (base64 previews)
      for (const file of logoFiles) {
        const formData = new FormData();
        formData.append('logo', file);
        formData.append('college_id', collegeId);

        const uploadResponse = await api.post('/upload-schedule-logo/', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        logoUrls.push(uploadResponse.data.logo_url);
      }

      const dataToSave = {
        college_id: collegeId,
        prepared_by_name: (footerData.prepared_by_name || '').trim(),
        prepared_by_title: (footerData.prepared_by_title || `Dean, ${collegeName}`).trim(),
        approved_by_name: (footerData.approved_by_name || '').trim(),
        approved_by_title: (footerData.approved_by_title || 'VCAA, USTP-CDO').trim(),
        address_line: (footerData.address_line || 'C.M Recto Avenue, Lapasan, Cagayan de Oro City 9000 Philippines').trim(),
        contact_line: (footerData.contact_line || 'Tel Nos. +63 (88) 856 1738; Telefax +63 (88) 856 4696 | http://www.ustp.edu.ph').trim(),
        logo_url: logoUrls[0] || null,   // backward compat
        logo_urls: logoUrls              // all logos
      };

      if (footerData.footer_id) {
        await api.put(`/tbl_schedule_footer/${footerData.footer_id}/`, dataToSave);
        toast.success('Footer settings updated successfully!');
      } else {
        await api.post('/tbl_schedule_footer/', dataToSave);
        toast.success('Footer settings saved successfully!');
      }

      onSave();
      onClose();
    } catch (error: any) {
      let errorMessage = 'Failed to save footer settings';

      if (error?.response?.data) {
        const data = error.response.data;
        if (typeof data === 'object') {
          const firstError = Object.values(data)[0];
          if (Array.isArray(firstError)) {
            errorMessage = firstError[0];
          } else if (typeof firstError === 'string') {
            errorMessage = firstError;
          }
        } else if (typeof data === 'string') {
          errorMessage = data;
        }
      }

      toast.error(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    if (!collegeId) {
      toast.error('College ID not found. Please try again.');
      return;
    }

    setIsSaving(true);
    try {
      const resetData = {
        college_id: collegeId,
        prepared_by_name: (deanName || 'Dean Name Not Found').trim(),
        prepared_by_title: `Dean, ${collegeName}`,
        approved_by_name: (vcaaName || 'VCAA Name Not Found').trim(),
        approved_by_title: 'VCAA, USTP-CDO',
        address_line: 'C.M Recto Avenue, Lapasan, Cagayan de Oro City 9000 Philippines',
        contact_line: 'Tel Nos. +63 (88) 856 1738; Telefax +63 (88) 856 4696 | http://www.ustp.edu.ph',
        logo_url: null,
        logo_urls: []
      };

      if (footerData.footer_id) {
        await api.put(`/tbl_schedule_footer/${footerData.footer_id}/`, resetData);
        toast.success('Footer settings reset to default values!');
      } else {
        await api.post('/tbl_schedule_footer/', resetData);
        toast.success('Footer settings reset to default values!');
      }

      setFooterData({ ...resetData, footer_id: footerData.footer_id });
      setLogoFiles([]);
      setLogoPreviews([]);

      await fetchFooterData();
      onSave();
    } catch (error: any) {
      let errorMessage = 'Failed to reset footer settings';

      if (error?.response?.data) {
        const data = error.response.data;
        if (typeof data === 'object') {
          const firstError = Object.values(data)[0];
          if (Array.isArray(firstError)) {
            errorMessage = firstError[0];
          } else if (typeof firstError === 'string') {
            errorMessage = firstError;
          }
        } else if (typeof data === 'string') {
          errorMessage = data;
        }
      }

      toast.error(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  // Icon helpers
  const IconSettings = () => (
    <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.592c.55 0 1.02.398 1.11.94a6.059 6.059 0 01.1 1.032c0 .199-.01.403-.031.606a6.04 6.04 0 01-.1 1.032c-.09.542-.56.94-1.11.94h-.738a6.025 6.025 0 00-1.146.194c-.487.082-.97-.01-1.386-.25l-.5.866a6.04 6.04 0 01-.1-1.032 6.059 6.059 0 01.1-1.032c.09-.542.56-.94 1.11-.94zm6.593 9.97c.092-.542.56-.94 1.11-.94h2.592c.55 0 1.02.398 1.11.94a6.059 6.059 0 01.1 1.032c0 .199-.01.403-.031.606a6.04 6.04 0 01-.1 1.032c-.09.542-.56.94-1.11.94h-2.592c-.55 0-1.02-.398-1.11-.94a6.059 6.059 0 01-.1-1.032 6.04 6.04 0 01.1-1.032zM9.25 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
    </svg>
  );

  return (
    <div className="settings-overlay">
      <div className="settings-modal">
        {/* Header */}
        <div className="settings-page-header">
          <div className="settings-page-header-left">
            <div className="settings-page-icon"><IconSettings /></div>
            <div className="settings-page-title">
              <h1>Settings</h1>
              <p>Configure schedule appearance and footer information</p>
            </div>
          </div>
          <button
            type="button"
            className="settings-close-btn"
            onClick={onClose}
            title="Close"
          >
            <FaTimes />
          </button>
        </div>

        {/* Loading State */}
        {isLoading ? (
          <div className="settings-loading-state">
            <div className="settings-spinner" />
            <p>Loading settings…</p>
          </div>
        ) : (
          <>
            {/* Tab Navigation */}
            <div className="settings-tabs">
              <button
                className={`settings-tab ${activeTab === 'appearance' ? 'active' : ''}`}
                onClick={() => setActiveTab('appearance')}
              >
                <FaImage />
                Appearance
              </button>
              <button
                className={`settings-tab ${activeTab === 'display' ? 'active' : ''}`}
                onClick={() => setActiveTab('display')}
              >
                <FaEye />
                Display
              </button>
              <button
                className={`settings-tab ${activeTab === 'footer' ? 'active' : ''}`}
                onClick={() => setActiveTab('footer')}
              >
                <FaFileSignature />
                Footer
              </button>
            </div>

            {/* Main Content */}
            <div className="settings-content">
              {/* Appearance Tab */}
              {activeTab === 'appearance' && (
                <div className="settings-tab-content">
                  <div className="settings-card">
                    <div className="settings-card-header">
                      <h3>Logo Management</h3>
                      <p>Upload one or more logos to appear on schedule documents</p>
                    </div>
                    <div className="settings-card-body">
                      {/* Logo Display */}
                      <div className="logo-display-area">
                        {logoPreviews.length === 0 ? (
                          <div className="logo-empty-state">
                            <div className="logo-empty-icon">📷</div>
                            <p>No logos uploaded yet</p>
                            <span>Add logos to include them in schedule documents</span>
                          </div>
                        ) : (
                          <div className="logo-grid">
                            {logoPreviews.map((preview, index) => (
                              <div key={index} className="logo-item">
                                <img src={preview} alt={`Logo ${index + 1}`} />
                                <button
                                  type="button"
                                  className="logo-remove"
                                  onClick={() => handleRemoveLogo(index)}
                                  title="Remove logo"
                                >
                                  <FaTimes />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Upload Controls */}
                      <div className="logo-upload-controls">
                        <input
                          type="file"
                          accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                          onChange={handleLogoChange}
                          id="logo-upload"
                          style={{ display: 'none' }}
                        />
                        <label htmlFor="logo-upload" className="settings-btn primary">
                          <span>+ Add Logo</span>
                        </label>
                        {logoPreviews.length > 0 && (
                          <div className="logo-count-badge">
                            {logoPreviews.length} logo{logoPreviews.length > 1 ? 's' : ''}
                          </div>
                        )}
                      </div>

                      <p className="settings-hint">
                        Supported formats: JPEG, PNG, GIF, WebP. Maximum size: 5MB per image.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Display Tab */}
              {activeTab === 'display' && (
                <div className="settings-tab-content">
                  <div className="settings-card">
                    <div className="settings-card-header">
                      <h3>Toolbar Display</h3>
                      <p>Customize how toolbar icons appear in the schedule view</p>
                    </div>
                    <div className="settings-card-body">
                      <div className="settings-toggle-group">
                        <label className="settings-toggle-item">
                          <input
                            type="checkbox"
                            checked={showIconLabels}
                            onChange={(e) => onIconLabelsChange(e.target.checked)}
                            className="settings-toggle-input"
                          />
                          <span className="settings-toggle-track">
                            <span className="settings-toggle-thumb" />
                          </span>
                          <span className="settings-toggle-label">
                            <span className="settings-toggle-title">Show icon labels</span>
                            <span className="settings-toggle-description">
                              Display text labels below toolbar icons instead of tooltips
                            </span>
                          </span>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Footer Tab */}
              {activeTab === 'footer' && (
                <div className="settings-tab-content">
                  {/* Prepared By */}
                  <div className="settings-card">
                    <div className="settings-card-header">
                      <h3>Prepared By Information</h3>
                      <p>Details for the person who prepared the schedule (left side)</p>
                    </div>
                    <div className="settings-card-body">
                      <div className="settings-form-group">
                        <label htmlFor="prepared-name">Full Name</label>
                        <input
                          id="prepared-name"
                          type="text"
                          value={footerData.prepared_by_name}
                          onChange={(e) => handleInputChange('prepared_by_name', e.target.value)}
                          placeholder="Enter name"
                          className="settings-input"
                        />
                      </div>
                      <div className="settings-form-group">
                        <label htmlFor="prepared-title">Title/Position</label>
                        <input
                          id="prepared-title"
                          type="text"
                          value={footerData.prepared_by_title}
                          onChange={(e) => handleInputChange('prepared_by_title', e.target.value)}
                          placeholder={`Dean, ${collegeName}`}
                          className="settings-input"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Approved By */}
                  <div className="settings-card">
                    <div className="settings-card-header">
                      <h3>Approved By Information</h3>
                      <p>Details for the person who approves the schedule (right side)</p>
                    </div>
                    <div className="settings-card-body">
                      <div className="settings-form-group">
                        <label htmlFor="approved-name">Full Name</label>
                        <input
                          id="approved-name"
                          type="text"
                          value={footerData.approved_by_name}
                          onChange={(e) => handleInputChange('approved_by_name', e.target.value)}
                          placeholder="Enter name"
                          className="settings-input"
                        />
                      </div>
                      <div className="settings-form-group">
                        <label htmlFor="approved-title">Title/Position</label>
                        <input
                          id="approved-title"
                          type="text"
                          value={footerData.approved_by_title}
                          onChange={(e) => handleInputChange('approved_by_title', e.target.value)}
                          placeholder="VCAA, USTP-CDO"
                          className="settings-input"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Contact Information */}
                  <div className="settings-card">
                    <div className="settings-card-header">
                      <h3>Contact Information</h3>
                      <p>Address and contact details shown at the bottom of schedules</p>
                    </div>
                    <div className="settings-card-body">
                      <div className="settings-form-group">
                        <label htmlFor="address">Address</label>
                        <input
                          id="address"
                          type="text"
                          value={footerData.address_line}
                          onChange={(e) => handleInputChange('address_line', e.target.value)}
                          placeholder="C.M Recto Avenue, Lapasan, Cagayan de Oro City 9000 Philippines"
                          className="settings-input"
                        />
                      </div>
                      <div className="settings-form-group">
                        <label htmlFor="contact">Contact Info</label>
                        <input
                          id="contact"
                          type="text"
                          value={footerData.contact_line}
                          onChange={(e) => handleInputChange('contact_line', e.target.value)}
                          placeholder="Tel Nos. +63 (88) 856 1738; Telefax +63 (88) 856 4696 | http://www.ustp.edu.ph"
                          className="settings-input"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="settings-footer">
              <button
                type="button"
                className="settings-btn secondary"
                onClick={handleReset}
                disabled={isSaving}
              >
                Reset to Default
              </button>
              <div className="settings-actions">
                <button
                  type="button"
                  className="settings-btn secondary"
                  onClick={onClose}
                  disabled={isSaving}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="settings-btn primary"
                  onClick={handleSave}
                  disabled={isSaving || isLoading || !collegeId}
                >
                  {isSaving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default FooterSettingsModal;