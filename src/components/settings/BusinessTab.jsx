import React, { useState, useEffect } from 'react';
import { Mail, ChevronDown, Loader } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import companyService from '../../supabase/api/companyService';
import toast from 'react-hot-toast';
import { parseAddress } from '../../utils/addressFormatter';
import './BusinessTab.css';

const BusinessTab = ({ onSave, onCancel }) => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasCompany, setHasCompany] = useState(false);
  const [formData, setFormData] = useState({
    businessName: '',
    businessAddress: '',
    phoneNumber: '',
    street: '',
    city: '',
    state: '',
    postalCode: '',
    country: '',
    industryCategory: ''
  });

  // Load company data on mount
  useEffect(() => {
    const loadCompanyData = async () => {
      if (!user) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);

        // Get company information
        const company = await companyService.getCompanyInfo();

        if (company) {
          setHasCompany(true);
          // Parse address from JSON to separate fields
          const rawAddress = company.location || company.street_address || '';
          const parsedAddress = parseAddress(rawAddress);

          // Extract address components
          let street = '', city = '', state = '', postalCode = '', country = '';

          if (typeof parsedAddress === 'object') {
            street = parsedAddress.street || parsedAddress.streetAddress || '';
            city = parsedAddress.city || '';
            state = parsedAddress.state || parsedAddress.province || '';
            postalCode = parsedAddress.postalCode || parsedAddress.zipCode || parsedAddress.zip || '';
            country = parsedAddress.country || '';
          } else if (typeof parsedAddress === 'string') {
            // If it's a plain string, put it in the street field
            street = parsedAddress;
          }

          setFormData({
            businessName: company.name || '',
            businessAddress: company.website || '',
            phoneNumber: company.phone_number || '',
            street,
            city,
            state,
            postalCode,
            country,
            industryCategory: company.business_category || company.industry || ''
          });
        } else {
          // No company found - keep empty form
          setHasCompany(false);
        }
      } catch (error) {
        console.error('[BusinessTab] Failed to load company data:', error);
        toast.error('Failed to load business data');
      } finally {
        setIsLoading(false);
      }
    };

    loadCompanyData();
  }, [user]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSaveChanges = async () => {
    if (!user) {
      toast.error('No user logged in');
      return;
    }

    try {
      setIsSaving(true);

      // Validate required fields
      if (!formData.businessName.trim()) {
        toast.error('Business name is required');
        return;
      }

      // Combine address fields into a JSON object
      const addressObject = {
        street: formData.street.trim(),
        city: formData.city.trim(),
        state: formData.state.trim(),
        postalCode: formData.postalCode.trim(),
        country: formData.country.trim()
      };

      // Remove empty fields from address object
      Object.keys(addressObject).forEach(key => {
        if (!addressObject[key]) delete addressObject[key];
      });

      // Prepare update data
      const updateData = {
        name: formData.businessName.trim(),
        website: formData.businessAddress.trim(),
        phone_number: formData.phoneNumber.trim(),
        location: JSON.stringify(addressObject),
        street_address: JSON.stringify(addressObject),
        business_category: formData.industryCategory,
        industry: formData.industryCategory
      };

      if (hasCompany) {
        // Update existing company
        await companyService.updateCompanyInfo(updateData);
        toast.success('Business information updated successfully!');
      } else {
        // Create new company if somehow doesn't exist
        await companyService.saveCompanyInfo({
          ...updateData,
          businessCategory: formData.industryCategory
        });
        setHasCompany(true);
        toast.success('Business information saved successfully!');
      }

      // Call parent onSave if provided
      if (onSave) {
        onSave(formData);
      }
    } catch (error) {
      console.error('[BusinessTab] Save error:', error);
      toast.error(error.error || 'Failed to save business information');
    } finally {
      setIsSaving(false);
    }
  };

  const industries = [
    'Restaurant & Food Service',
    'Retail & E-commerce',
    'Real Estate',
    'Home Services',
    'Health & Wellness',
    'Professional Services',
    'Automotive',
    'Education',
    'Entertainment & Events',
    'Technology',
    'Finance',
    'Manufacturing',
    'Non-Profit',
    'Other'
  ];

  // Show loading state
  if (isLoading) {
    return (
      <div className="business-tab">
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '4rem 2rem',
          gap: '1rem'
        }}>
          <Loader className="spinner-icon" size={40} style={{ animation: 'spin 1s linear infinite' }} />
          <p style={{ color: '#718096', fontSize: '14px' }}>Loading business data...</p>
        </div>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="business-tab">
      {/* Business Info Section */}
      <div className="settings-section">
        <h2 className="section-title">Business info</h2>
        
        <div className="form-row">
          <label className="form-label">
            Business Name <span className="required">*</span>
          </label>
          <input
            type="text"
            className="form-input"
            value={formData.businessName}
            onChange={(e) => handleInputChange('businessName', e.target.value)}
            placeholder="Business name"
          />
        </div>

        <div className="form-row">
          <label className="form-label">
            Business Address <span className="required">*</span>
          </label>
          <div className="email-input-container">
            <Mail className="email-icon" size={18} />
            <input
              type="email"
              className="form-input email-input"
              value={formData.businessAddress}
              onChange={(e) => handleInputChange('businessAddress', e.target.value)}
              placeholder="Business email address"
            />
          </div>
        </div>

        <div className="form-row">
          <label className="form-label">
            Phone Number <span className="required">*</span>
          </label>
          <div className="phone-input-container">
            <input
              type="tel"
              className="form-input phone-input"
              value={formData.phoneNumber}
              onChange={(e) => handleInputChange('phoneNumber', e.target.value)}
              placeholder="+1 (555) 123-4567"
            />
            <ChevronDown className="dropdown-icon" size={18} />
          </div>
        </div>

        <div className="form-row">
          <label className="form-label">
            Street Address
          </label>
          <input
            type="text"
            className="form-input"
            value={formData.street}
            onChange={(e) => handleInputChange('street', e.target.value)}
            placeholder="Street address"
          />
        </div>

        <div className="form-row" style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem'}}>
          <div>
            <label className="form-label">
              City <span className="required">*</span>
            </label>
            <input
              type="text"
              className="form-input"
              value={formData.city}
              onChange={(e) => handleInputChange('city', e.target.value)}
              placeholder="City"
            />
          </div>
          <div>
            <label className="form-label">
              State/Province <span className="required">*</span>
            </label>
            <input
              type="text"
              className="form-input"
              value={formData.state}
              onChange={(e) => handleInputChange('state', e.target.value)}
              placeholder="State or Province"
            />
          </div>
        </div>

        <div className="form-row" style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem'}}>
          <div>
            <label className="form-label">
              Postal Code
            </label>
            <input
              type="text"
              className="form-input"
              value={formData.postalCode}
              onChange={(e) => handleInputChange('postalCode', e.target.value)}
              placeholder="Postal/Zip code"
            />
          </div>
          <div>
            <label className="form-label">
              Country <span className="required">*</span>
            </label>
            <input
              type="text"
              className="form-input"
              value={formData.country}
              onChange={(e) => handleInputChange('country', e.target.value)}
              placeholder="Country"
            />
          </div>
        </div>

        <div className="form-row">
          <label className="form-label">
            Industry Category <span className="required">*</span>
          </label>
          <div className="select-container">
            <select
              className="form-select"
              value={formData.industryCategory}
              onChange={(e) => handleInputChange('industryCategory', e.target.value)}
            >
              {industries.map(industry => (
                <option key={industry} value={industry}>{industry}</option>
              ))}
            </select>
            <ChevronDown className="select-icon" size={18} />
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="settings-footer">
        <button
          className="cancel-button"
          onClick={onCancel}
          disabled={isSaving}
        >
          Cancel
        </button>
        <button
          className="save-button"
          onClick={handleSaveChanges}
          disabled={isSaving}
        >
          {isSaving ? (
            <>
              <Loader size={16} style={{ animation: 'spin 1s linear infinite', marginRight: '8px' }} />
              Saving...
            </>
          ) : (
            'Save Changes'
          )}
        </button>
      </div>
    </div>
  );
};

export default BusinessTab;