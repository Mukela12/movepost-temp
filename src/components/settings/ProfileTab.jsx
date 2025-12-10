import React, { useState, useEffect } from 'react';
import { Mail, Loader } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../supabase/integration/client';
import toast from 'react-hot-toast';
import './ProfileTab.css';

const ProfileTab = ({ onSave, onCancel }) => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showDangerWarning, setShowDangerWarning] = useState(true);

  // Load user data on mount
  useEffect(() => {
    const loadUserData = async () => {
      if (!user) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);

        // Get user profile from profile table
        const { data: profile, error: profileError } = await supabase
          .from('profile')
          .select('full_name, email')
          .eq('user_id', user.id)
          .maybeSingle();

        if (profileError) {
          console.error('[ProfileTab] Error loading profile:', profileError);
        }

        // Parse full name into first and last name
        const fullName = profile?.full_name || user.user_metadata?.full_name || '';
        const nameParts = fullName.trim().split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';

        setFormData({
          firstName,
          lastName,
          email: user.email || '',
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        });
      } catch (error) {
        console.error('[ProfileTab] Failed to load user data:', error);
        toast.error('Failed to load profile data');
      } finally {
        setIsLoading(false);
      }
    };

    loadUserData();
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

      // Validate name fields
      if (!formData.firstName.trim()) {
        toast.error('First name is required');
        return;
      }

      // Validate password change if attempted
      if (formData.newPassword || formData.confirmPassword || formData.currentPassword) {
        if (!formData.currentPassword) {
          toast.error('Current password is required to change password');
          return;
        }
        if (formData.newPassword.length < 8) {
          toast.error('New password must be at least 8 characters');
          return;
        }
        if (formData.newPassword !== formData.confirmPassword) {
          toast.error('New passwords do not match');
          return;
        }
      }

      // Update full name in profile table
      const fullName = `${formData.firstName.trim()} ${formData.lastName.trim()}`.trim();
      const { error: profileError } = await supabase
        .from('profile')
        .update({
          full_name: fullName,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id);

      if (profileError) {
        console.error('[ProfileTab] Error updating profile:', profileError);
        throw new Error('Failed to update profile');
      }

      // Update password if provided
      if (formData.newPassword && formData.currentPassword) {
        const { error: passwordError } = await supabase.auth.updateUser({
          password: formData.newPassword
        });

        if (passwordError) {
          console.error('[ProfileTab] Error updating password:', passwordError);
          throw new Error('Failed to update password: ' + passwordError.message);
        }

        // Clear password fields after successful update
        setFormData(prev => ({
          ...prev,
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        }));

        toast.success('Profile and password updated successfully!');
      } else {
        toast.success('Profile updated successfully!');
      }

      // Call parent onSave if provided
      if (onSave) {
        onSave(formData);
      }
    } catch (error) {
      console.error('[ProfileTab] Save error:', error);
      toast.error(error.message || 'Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAccount = () => {
    console.log('Delete account clicked...');
    toast('Account deletion feature coming soon', { icon: 'ℹ️' });
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="profile-tab">
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '4rem 2rem',
          gap: '1rem'
        }}>
          <Loader className="spinner-icon" size={40} style={{ animation: 'spin 1s linear infinite' }} />
          <p style={{ color: '#718096', fontSize: '14px' }}>Loading profile data...</p>
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
    <div className="profile-tab">
      {/* Personal Info Section */}
      <div className="settings-section">
        <h2 className="section-title">Personal info</h2>
        
        <div className="form-row">
          <label className="form-label">
            Name <span className="required">*</span>
          </label>
          <div className="name-inputs">
            <input
              type="text"
              className="form-input"
              value={formData.firstName}
              onChange={(e) => handleInputChange('firstName', e.target.value)}
              placeholder="First name"
            />
            <input
              type="text"
              className="form-input"
              value={formData.lastName}
              onChange={(e) => handleInputChange('lastName', e.target.value)}
              placeholder="Last name"
            />
          </div>
        </div>

        <div className="form-row">
          <label className="form-label">
            Email address <span className="required">*</span>
          </label>
          <div className="email-input-container">
            <Mail className="email-icon" size={18} />
            <input
              type="email"
              className="form-input email-input"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              placeholder="Email address"
            />
          </div>
        </div>
      </div>

      {/* Password Section */}
      <div className="settings-section">
        <h2 className="section-title">Password</h2>
        <p className="section-description">
          Please enter your current password to change your password.
        </p>

        <div className="form-row">
          <label className="form-label">
            Current password <span className="required">*</span>
          </label>
          <input
            type="password"
            className="form-input"
            value={formData.currentPassword}
            onChange={(e) => handleInputChange('currentPassword', e.target.value)}
            placeholder="••••••••"
          />
        </div>

        <div className="form-row">
          <label className="form-label">
            New password <span className="required">*</span>
          </label>
          <input
            type="password"
            className="form-input"
            value={formData.newPassword}
            onChange={(e) => handleInputChange('newPassword', e.target.value)}
            placeholder="••••••••"
          />
          <p className="password-hint">Your new password must be more than 8 characters.</p>
        </div>

        <div className="form-row">
          <label className="form-label">
            Confirm new password <span className="required">*</span>
          </label>
          <input
            type="password"
            className="form-input"
            value={formData.confirmPassword}
            onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
            placeholder="••••••••"
          />
        </div>
      </div>

      {/* Danger Zone Section */}
      <div className="settings-section danger-zone">
        <h2 className="section-title">Danger Zone</h2>
        <p className="section-description">
          Configuration for deactivate your account
        </p>

        {showDangerWarning && (
          <div className="danger-warning">
            <div className="warning-content">
              <p className="warning-text">
                Please be very careful to deactivate or delete your account. Check out the guidance{' '}
                <a href="#" className="warning-link">here</a>
              </p>
              <button 
                className="close-warning"
                onClick={() => setShowDangerWarning(false)}
              >
                ×
              </button>
            </div>
          </div>
        )}

        <div className="form-row">
          <label className="form-label">
            Account deletion <span className="required">*</span>
          </label>
          <button 
            className="delete-account-button"
            onClick={handleDeleteAccount}
          >
            Delete My Account
          </button>
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

export default ProfileTab;