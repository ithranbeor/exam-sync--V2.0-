import React, { useState, useEffect } from 'react';
import { api } from '../lib/apiClient';
import { toast } from 'react-toastify';
import '../styles/FooterSettingsModal.css';

interface FooterSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  collegeName: string;
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
}

const FooterSettingsModal: React.FC<FooterSettingsModalProps> = ({
  isOpen,
  onClose,
  collegeName,
  onSave
}) => {
  const [footerData, setFooterData] = useState<FooterData>({
    prepared_by_name: '',
    prepared_by_title: `Dean, ${collegeName}`,
    approved_by_name: '',
    approved_by_title: 'VCAA, USTP-CDO',
    address_line: 'C.M Recto Avenue, Lapasan, Cagayan de Oro City 9000 Philippines',
    contact_line: 'Tel Nos. +63 (88) 856 1738; Telefax +63 (88) 856 4696 | http://www.ustp.edu.ph',
    logo_url: null
  });

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen && collegeName && collegeName !== "Add schedule first") {
      fetchFooterData();
    }
  }, [isOpen, collegeName]);

  const fetchFooterData = async () => {
    setIsLoading(true);
    try {
      const response = await api.get('/tbl_schedule_footer/', {
        params: { college_id: collegeName }
      });

      if (response.data && response.data.length > 0) {
        const data = response.data[0];
        setFooterData(data);
        setLogoPreview(data.logo_url);
      } else {
        // Get dean name from college
        try {
          const rolesResponse = await api.get('/tbl_user_role', {
            params: {
              college_name: collegeName,
              role_id: 1
            }
          });

          let deanName = 'Type name';
          if (rolesResponse.data && rolesResponse.data.length > 0) {
            const deanRole = rolesResponse.data[0];
            if (deanRole.user) {
              deanName = `${deanRole.user.first_name} ${deanRole.user.last_name}`;
            }
          }

          setFooterData(prev => ({
            ...prev,
            prepared_by_name: deanName,
            prepared_by_title: `Dean, ${collegeName}`
          }));
        } catch (error) {
          console.error("Error fetching dean info:", error);
        }
      }
    } catch (error) {
      console.error("Error fetching footer data:", error);
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

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Invalid file type. Please upload JPEG, PNG, GIF, or WEBP');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File too large. Maximum size is 5MB');
      return;
    }

    setLogoFile(file);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setLogoPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
    setFooterData(prev => ({
      ...prev,
      logo_url: null
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      let logoUrl = footerData.logo_url;

      // Upload logo if changed
      if (logoFile) {
        const formData = new FormData();
        formData.append('logo', logoFile);
        formData.append('college_id', collegeName);

        const uploadResponse = await api.post('/upload-schedule-logo/', formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        });

        logoUrl = uploadResponse.data.logo_url;
      }

      const dataToSave = {
        ...footerData,
        college_id: collegeName,
        logo_url: logoUrl
      };

      if (footerData.footer_id) {
        // Update existing
        await api.put(`/tbl_schedule_footer/${footerData.footer_id}/`, dataToSave);
        toast.success('Footer settings updated successfully!');
      } else {
        // Create new
        await api.post('/tbl_schedule_footer/', dataToSave);
        toast.success('Footer settings saved successfully!');
      }

      onSave();
      onClose();
    } catch (error: any) {
      console.error("Error saving footer settings:", error);
      toast.error(error?.response?.data?.error || 'Failed to save footer settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setFooterData({
      prepared_by_name: '',
      prepared_by_title: `Dean, ${collegeName}`,
      approved_by_name: '',
      approved_by_title: 'VCAA, USTP-CDO',
      address_line: 'C.M Recto Avenue, Lapasan, Cagayan de Oro City 9000 Philippines',
      contact_line: 'Tel Nos. +63 (88) 856 1738; Telefax +63 (88) 856 4696 | http://www.ustp.edu.ph',
      logo_url: null
    });
    setLogoFile(null);
    setLogoPreview(null);
  };

  if (!isOpen) return null;

  return (
    <div className="footer-settings-overlay">
      <div className="footer-settings-modal">
        <div className="footer-settings-header">
          <h2>Schedule Footer Settings</h2>
          <button className="close-button" onClick={onClose}>&times;</button>
        </div>

        <div className="footer-settings-content">
          {isLoading ? (
            <div className="loading-spinner">Loading...</div>
          ) : (
            <>
              {/* Logo Section */}
              <div className="settings-section">
                <h3>Logo</h3>
                <div className="logo-upload-section">
                  {logoPreview ? (
                    <div className="logo-preview">
                      <img src={logoPreview} alt="Logo Preview" />
                      <button 
                        type="button"
                        className="remove-logo-btn"
                        onClick={handleRemoveLogo}
                      >
                        Remove Logo
                      </button>
                    </div>
                  ) : (
                    <div className="logo-upload-placeholder">
                      <p>No logo uploaded</p>
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                    onChange={handleLogoChange}
                    id="logo-upload"
                    style={{ display: 'none' }}
                  />
                  <label htmlFor="logo-upload" className="upload-logo-btn">
                    {logoPreview ? 'Change Logo' : 'Upload Logo'}
                  </label>
                </div>
              </div>

              {/* Prepared By Section */}
              <div className="settings-section">
                <h3>Prepared By (Left Side)</h3>
                <div className="form-group">
                  <label>Name:</label>
                  <input
                    type="text"
                    value={footerData.prepared_by_name}
                    onChange={(e) => handleInputChange('prepared_by_name', e.target.value)}
                    placeholder="Type name"
                  />
                </div>
                <div className="form-group">
                  <label>Title:</label>
                  <input
                    type="text"
                    value={footerData.prepared_by_title}
                    onChange={(e) => handleInputChange('prepared_by_title', e.target.value)}
                    placeholder={`Dean, ${collegeName}`}
                  />
                </div>
              </div>

              {/* Approved By Section */}
              <div className="settings-section">
                <h3>Approved By (Right Side)</h3>
                <div className="form-group">
                  <label>Name:</label>
                  <input
                    type="text"
                    value={footerData.approved_by_name}
                    onChange={(e) => handleInputChange('approved_by_name', e.target.value)}
                    placeholder="Type name"
                  />
                </div>
                <div className="form-group">
                  <label>Title:</label>
                  <input
                    type="text"
                    value={footerData.approved_by_title}
                    onChange={(e) => handleInputChange('approved_by_title', e.target.value)}
                    placeholder="VCAA, USTP-CDO"
                  />
                </div>
              </div>

              {/* Address Section */}
              <div className="settings-section">
                <h3>Address & Contact (Center)</h3>
                <div className="form-group">
                  <label>Address:</label>
                  <input
                    type="text"
                    value={footerData.address_line}
                    onChange={(e) => handleInputChange('address_line', e.target.value)}
                    placeholder="C.M Recto Avenue, Lapasan, Cagayan de Oro City 9000 Philippines"
                  />
                </div>
                <div className="form-group">
                  <label>Contact Info:</label>
                  <input
                    type="text"
                    value={footerData.contact_line}
                    onChange={(e) => handleInputChange('contact_line', e.target.value)}
                    placeholder="Tel Nos. +63 (88) 856 1738; Telefax +63 (88) 856 4696 | http://www.ustp.edu.ph"
                  />
                </div>
              </div>
            </>
          )}
        </div>

        <div className="footer-settings-actions">
          <button 
            type="button"
            className="reset-btn" 
            onClick={handleReset}
            disabled={isSaving}
          >
            Reset to Default
          </button>
          <div className="action-buttons">
            <button 
              type="button"
              className="cancel-btn" 
              onClick={onClose}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button 
              type="button"
              className="save-btn" 
              onClick={handleSave}
              disabled={isSaving || isLoading}
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FooterSettingsModal;