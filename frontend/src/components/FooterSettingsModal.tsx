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
    prepared_by_name: 'Loading...', // ✅ Changed from empty string
    prepared_by_title: `Dean, ${collegeName}`,
    approved_by_name: 'Loading...', // ✅ Changed from empty string
    approved_by_title: 'VCAA, USTP-CDO',
    address_line: 'C.M Recto Avenue, Lapasan, Cagayan de Oro City 9000 Philippines',
    contact_line: 'Tel Nos. +63 (88) 856 1738; Telefax +63 (88) 856 4696 | http://www.ustp.edu.ph',
    logo_url: null
  });

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [collegeId, setCollegeId] = useState<string | null>(null);
  const [deanName, setDeanName] = useState<string>('');
  const [vcaaName, setVcaaName] = useState<string>('');

  // Fetch dean name and VCAA name
  useEffect(() => {
    const fetchRoleNames = async () => {
      if (!collegeName || collegeName === "Add schedule first") return;

      try {
        // Fetch Dean name (role_id: 1)
        const deanResponse = await api.get('/tbl_user_role', {
          params: {
            college_name: collegeName,
            role_id: 1
          }
        });

        if (deanResponse.data?.length > 0) {
          const deanRole = deanResponse.data[0];

          // ✅ Case 1: backend already expanded user (future-proof)
          if (deanRole.user?.first_name && deanRole.user?.last_name) {
            const fullName = `${deanRole.user.first_name} ${deanRole.user.last_name}`;
            setDeanName(fullName);
            console.log(`✅ Found dean (expanded): ${fullName}`);
          }

          // ✅ Case 2: only user_id exists → fetch user manually
          else if (deanRole.user_id) {
            try {
              const userRes = await api.get(`/users/${deanRole.user_id}/`);
              const user = userRes.data;

              if (user?.first_name && user?.last_name) {
                const fullName = `${user.first_name} ${user.last_name}`;
                setDeanName(fullName);
                console.log(`✅ Found dean (via user_id): ${fullName}`);
              } else {
                setDeanName('Dean Name Not Found');
                console.warn('⚠️ User record missing name fields', user);
              }
            } catch (err) {
              console.error('❌ Failed to fetch dean user', err);
              setDeanName('Dean Name Not Found');
            }
          }

          // ❌ No usable data
          else {
            console.warn('⚠️ Dean role found but no user reference');
            setDeanName('Dean Name Not Found');
          }
        }

        // Fetch VCAA name (role_id: 2)
        const vcaaResponse = await api.get('/tbl_user_role', {
          params: {
            role_id: 2
          }
        });

        if (vcaaResponse.data && vcaaResponse.data.length > 0) {
          const vcaaRole = vcaaResponse.data[0];
          if (vcaaRole.user && vcaaRole.user.first_name && vcaaRole.user.last_name) {
            const fullVcaaName = `${vcaaRole.user.first_name} ${vcaaRole.user.last_name}`;
            setVcaaName(fullVcaaName);
            console.log(`✅ Found VCAA: ${fullVcaaName}`);
          } else {
            console.warn('⚠️ VCAA user data incomplete');
          }
        } else {
          console.warn('⚠️ No VCAA found');
        }
      } catch (error) {
        console.error("Error fetching role names:", error);
      }
    };

    fetchRoleNames();
  }, [collegeName]);

  // Fetch college_id from college_name
  useEffect(() => {
    const fetchCollegeId = async () => {
      if (!collegeName || collegeName === "Add schedule first") return;

      try {
        const response = await api.get('/tbl_college/');

        if (response.data && response.data.length > 0) {
          const college = response.data.find((c: any) => c.college_name === collegeName);
          if (college) {
            setCollegeId(college.college_id);
            console.log(`✅ Found college_id: ${college.college_id} for ${collegeName}`);
          } else {
            console.error(`❌ College not found: ${collegeName}`);
          }
        }
      } catch (error) {
        console.error("Error fetching college ID:", error);
      }
    };

    fetchCollegeId();
  }, [collegeName]);

  // Wait for collegeId before fetching footer data
  useEffect(() => {
    if (isOpen && collegeId && (deanName || vcaaName)) {
      fetchFooterData();
    }
  }, [isOpen, collegeId, deanName, vcaaName]); // ✅ Added deanName and vcaaName as dependencies

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
        setLogoPreview(data.logo_url);
      } else {
        console.log(`ℹ️ No existing footer found, using role names from state...`);

        // ✅ Use the dean name and VCAA name from state - they should be populated now
        const preparedByName = deanName || 'Dean Name Not Found';
        const approvedByName = vcaaName || 'VCAA Name Not Found';

        console.log(`✅ Setting defaults - Prepared by: ${preparedByName}, Approved by: ${approvedByName}`);

        setFooterData(prev => ({
          ...prev,
          prepared_by_name: preparedByName,
          prepared_by_title: `Dean, ${collegeName}`,
          approved_by_name: approvedByName,
          approved_by_title: 'VCAA, USTP-CDO'
        }));
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
    if (!collegeId) {
      toast.error('College ID not found. Please try again.');
      return;
    }

    // Validate required fields
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
      let logoUrl = footerData.logo_url;

      // Upload logo if changed
      if (logoFile) {
        console.log(`📤 Uploading logo for college_id: ${collegeId}`);

        const formData = new FormData();
        formData.append('logo', logoFile);
        formData.append('college_id', collegeId);

        const uploadResponse = await api.post('/upload-schedule-logo/', formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        });

        logoUrl = uploadResponse.data.logo_url;
        console.log(`✅ Logo uploaded successfully`);
      }

      // Clean data before sending
      const dataToSave = {
        college_id: collegeId,
        prepared_by_name: (footerData.prepared_by_name || '').trim(),
        prepared_by_title: (footerData.prepared_by_title || `Dean, ${collegeName}`).trim(),
        approved_by_name: (footerData.approved_by_name || '').trim(),
        approved_by_title: (footerData.approved_by_title || 'VCAA, USTP-CDO').trim(),
        address_line: (footerData.address_line || 'C.M Recto Avenue, Lapasan, Cagayan de Oro City 9000 Philippines').trim(),
        contact_line: (footerData.contact_line || 'Tel Nos. +63 (88) 856 1738; Telefax +63 (88) 856 4696 | http://www.ustp.edu.ph').trim(),
        logo_url: logoUrl
      };

      console.log(`💾 Saving footer data:`, JSON.stringify(dataToSave, null, 2));

      if (footerData.footer_id) {
        // Update existing
        await api.put(`/tbl_schedule_footer/${footerData.footer_id}/`, dataToSave);
        toast.success('Footer settings updated successfully!');
        console.log(`✅ Footer updated: ${footerData.footer_id}`);
      } else {
        // Create new
        await api.post('/tbl_schedule_footer/', dataToSave);
        toast.success('Footer settings saved successfully!');
        console.log(`✅ New footer created`);
      }

      onSave();
      onClose();
    } catch (error: any) {
      console.error("❌ Error saving footer settings:", error);
      console.error("❌ Error response data:", error?.response?.data);

      // Better error handling
      let errorMessage = 'Failed to save footer settings';

      if (error?.response?.data) {
        const data = error.response.data;
        if (typeof data === 'object') {
          // Extract first error message from validation errors
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
      // Use dean name and VCAA name from state for reset
      const resetData = {
        college_id: collegeId,
        prepared_by_name: (deanName || 'Dean Name Not Found').trim(),
        prepared_by_title: `Dean, ${collegeName}`,
        approved_by_name: (vcaaName || 'VCAA Name Not Found').trim(),
        approved_by_title: 'VCAA, USTP-CDO',
        address_line: 'C.M Recto Avenue, Lapasan, Cagayan de Oro City 9000 Philippines',
        contact_line: 'Tel Nos. +63 (88) 856 1738; Telefax +63 (88) 856 4696 | http://www.ustp.edu.ph',
        logo_url: null
      };

      console.log(`🔄 Resetting footer data to defaults:`, JSON.stringify(resetData, null, 2));

      if (footerData.footer_id) {
        // Update existing
        await api.put(`/tbl_schedule_footer/${footerData.footer_id}/`, resetData);
        toast.success('Footer settings reset to default values!');
        console.log(`✅ Footer reset: ${footerData.footer_id}`);
      } else {
        // Create new with default values
        await api.post('/tbl_schedule_footer/', resetData);
        toast.success('Footer settings reset to default values!');
        console.log(`✅ New footer created with defaults`);
      }

      // Update local state to match saved data
      setFooterData({
        ...resetData,
        footer_id: footerData.footer_id // Keep the footer_id if it exists
      });
      setLogoFile(null);
      setLogoPreview(null);

      // Refresh the data from server
      await fetchFooterData();

      // Trigger parent refresh
      onSave();

    } catch (error: any) {
      console.error("❌ Error resetting footer settings:", error);
      console.error("❌ Error response data:", error?.response?.data);

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

  return (
    <div className="footer-settings-overlay">
      <div className="footer-settings-modal">
        <div className="footer-settings-header">
          <h2>Schedule Footer Settings</h2>
          <button type="button" className="close-button" onClick={onClose}>&times;</button>
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
              disabled={isSaving || isLoading || !collegeId}
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