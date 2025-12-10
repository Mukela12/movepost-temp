import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/layout/DashboardLayout';
import Tabs from '../components/common/Tabs';
import ProfileTab from '../components/settings/ProfileTab';
import BusinessTab from '../components/settings/BusinessTab';
import BillingTab from '../components/settings/BillingTab';
import './Settings.css';

const Settings = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('Profile');
  
  const tabs = ['Profile', 'Business', 'Billing'];

  const handleSaveChanges = (data) => {
    console.log('Saving changes...', data);
  };

  const handleCancel = () => {
    console.log('Cancelling changes...');
  };

  return (
    <DashboardLayout>
      <div className="settings-page">
        {/* Header */}
        <div className="settings-header">
          <h1 className="settings-title">Settings</h1>
        </div>

        {/* Settings Content */}
        <div className="settings-content">
          {/* Tab Navigation */}
          <Tabs 
            tabs={tabs}
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />

          {/* Tab Content */}
          <div className="tab-content">
            {activeTab === 'Profile' && (
              <ProfileTab 
                onSave={handleSaveChanges}
                onCancel={handleCancel}
              />
            )}
            
            {activeTab === 'Business' && (
              <BusinessTab
                onSave={handleSaveChanges}
                onCancel={handleCancel}
              />
            )}

            {activeTab === 'Billing' && (
              <BillingTab activeTab={activeTab} />
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Settings;