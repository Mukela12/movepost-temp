import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, LayoutGrid, CheckCircle, Mail, DollarSign } from 'lucide-react';
import DashboardLayout from '../components/layout/DashboardLayout';
import Table from '../components/common/Table';
import StatusBadge from '../components/common/StatusBadge';
import EngagementValue from '../components/common/EngagementValue';
import ActionButtons from '../components/common/ActionButtons';
import Button from '../components/common/Button';
import Card from '../components/common/Card';
import ConfirmationModal from '../components/common/ConfirmationModal';
import campaignService from '../supabase/api/campaignService';
import toast from 'react-hot-toast';
import './History.css';

const History = () => {
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [campaignToDelete, setCampaignToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  // Load campaigns on mount
  useEffect(() => {
    loadCampaigns();
  }, []);

  // Add scroll detection for sticky header styling and collapsible filters
  useEffect(() => {
    const handleScroll = (e) => {
      const scrollContainer = e.target;
      const scrollTop = scrollContainer.scrollTop;
      const stickyElement = document.querySelector('.history-sticky-top');

      if (stickyElement) {
        if (scrollTop > 0) {
          stickyElement.classList.add('scrolled');
          setIsScrolled(true);
        } else {
          stickyElement.classList.remove('scrolled');
          setIsScrolled(false);
        }
      }
    };

    // Get the actual scroll container
    const scrollContainer = document.querySelector('.dashboard-content-wrapper');
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', handleScroll);
      return () => scrollContainer.removeEventListener('scroll', handleScroll);
    }
  }, []);

  const loadCampaigns = async () => {
    try {
      setIsLoading(true);
      const result = await campaignService.getCampaigns();

      if (result.success) {
        // Transform campaign data to match table format
        const transformedCampaigns = result.campaigns.map(campaign => ({
          id: campaign.id,
          blastName: campaign.campaign_name || 'Untitled Campaign',
          status: campaign.status || 'draft',
          createdDate: campaign.created_at ? new Date(campaign.created_at).toLocaleDateString() : 'N/A',
          sentDate: campaign.launched_at ? new Date(campaign.launched_at).toLocaleDateString() : '-',
          recipients: campaign.total_recipients ? campaign.total_recipients.toLocaleString() : '0',
          engagement: campaign.response_rate || 0,
          // Keep original data for editing
          _original: campaign
        }));

        setCampaigns(transformedCampaigns);
      }
    } catch (error) {
      console.error('Error loading campaigns:', error);
      toast.error('Failed to load campaigns');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditCampaign = (campaignId) => {
    navigate(`/campaign/${campaignId}/edit`);
  };

  const handleCopyCampaign = async (campaignId) => {
    try {
      toast.loading('Duplicating campaign...', { id: 'copy-campaign' });

      const result = await campaignService.duplicateCampaign(campaignId);

      if (result.success) {
        toast.success('Campaign duplicated successfully!', { id: 'copy-campaign' });
        // Reload campaigns to show the new copy
        loadCampaigns();
      }
    } catch (error) {
      console.error('Error copying campaign:', error);
      toast.error('Failed to duplicate campaign', { id: 'copy-campaign' });
    }
  };

  const handleRefreshCampaign = () => {
    loadCampaigns();
    toast.success('Campaigns refreshed');
  };

  const handleDeleteCampaign = (campaignId) => {
    const campaign = campaigns.find(c => c.id === campaignId);
    setCampaignToDelete(campaign);
    setShowDeleteModal(true);
  };

  const handleRowClick = (campaign) => {
    navigate(`/campaign/${campaign.id}/details`);
  };

  const confirmDeleteCampaign = async () => {
    if (!campaignToDelete) return;

    try {
      setIsDeleting(true);
      toast.loading('Deleting campaign...', { id: 'delete-campaign' });

      const result = await campaignService.deleteCampaign(campaignToDelete.id);

      if (result.success) {
        toast.success('Campaign deleted successfully', { id: 'delete-campaign' });
        // Remove from local state
        setCampaigns(campaigns.filter(campaign => campaign.id !== campaignToDelete.id));
      }

      // Close modal
      setShowDeleteModal(false);
      setCampaignToDelete(null);
    } catch (error) {
      console.error('Error deleting campaign:', error);
      toast.error('Failed to delete campaign', { id: 'delete-campaign' });
    } finally {
      setIsDeleting(false);
    }
  };

  // Filter campaigns based on status and date range
  const filteredCampaigns = useMemo(() => {
    let filtered = campaigns;

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(campaign =>
        campaign.status.toLowerCase() === statusFilter.toLowerCase()
      );
    }

    // Filter by date range
    if (dateFrom) {
      filtered = filtered.filter(campaign =>
        new Date(campaign.createdAt) >= new Date(dateFrom)
      );
    }
    if (dateTo) {
      filtered = filtered.filter(campaign =>
        new Date(campaign.createdAt) <= new Date(dateTo)
      );
    }

    return filtered;
  }, [campaigns, statusFilter, dateFrom, dateTo]);

  // Calculate summary statistics
  const stats = useMemo(() => {
    const totalCampaigns = campaigns.length;
    const activeCampaigns = campaigns.filter(c => c.status.toLowerCase() === 'active').length;
    const totalPostcards = campaigns.reduce((sum, c) => {
      const count = parseInt(c.recipients) || 0;
      return sum + count;
    }, 0);
    const totalSpent = campaigns.reduce((sum, c) => {
      const cost = parseFloat(c.cost?.replace('$', '').replace(',', '')) || 0;
      return sum + cost;
    }, 0);

    return {
      totalCampaigns,
      activeCampaigns,
      totalPostcards,
      totalSpent
    };
  }, [campaigns]);

  const columns = [
    {
      key: 'blastName',
      title: 'Blast Name',
      sortable: true,
      className: 'blast-name-header',
      cellClassName: 'blast-name-cell'
    },
    {
      key: 'status',
      title: 'Status',
      sortable: true,
      className: 'status-header',
      cellClassName: 'status-cell',
      render: (value) => <StatusBadge status={value} />
    },
    {
      key: 'createdDate',
      title: 'Created Date',
      sortable: true,
      className: 'date-header',
      cellClassName: 'date-cell'
    },
    {
      key: 'sentDate',
      title: 'Sent Date',
      sortable: true,
      className: 'date-header',
      cellClassName: 'date-cell'
    },
    {
      key: 'recipients',
      title: 'Recipients',
      sortable: true,
      className: 'recipients-header',
      cellClassName: 'recipients-cell'
    },
    {
      key: 'engagement',
      title: 'Engagement',
      sortable: true,
      className: 'engagement-header',
      cellClassName: 'engagement-cell',
      render: (value) => <EngagementValue value={value} />
    },
    {
      key: 'actions',
      title: '',
      className: 'actions-header',
      cellClassName: 'actions-cell',
      render: (_, campaign) => (
        <ActionButtons
          onEdit={() => handleEditCampaign(campaign.id)}
          onCopy={() => handleCopyCampaign(campaign.id)}
          onRefresh={() => handleRefreshCampaign(campaign.id)}
          onDelete={() => handleDeleteCampaign(campaign.id)}
        />
      )
    }
  ];

  return (
    <DashboardLayout>
      <div className="history-page">
          {/* Sticky Top Section */}
          <div className="history-sticky-top">
          {/* Summary Statistics */}
          {!isLoading && campaigns.length > 0 && (
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon">
                  <LayoutGrid size={24} />
                </div>
                <div className="stat-content">
                  <div className="stat-value">{stats.totalCampaigns}</div>
                  <div className="stat-label">Total Campaigns</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">
                  <CheckCircle size={24} />
                </div>
                <div className="stat-content">
                  <div className="stat-value">{stats.activeCampaigns}</div>
                  <div className="stat-label">Active Campaigns</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">
                  <Mail size={24} />
                </div>
                <div className="stat-content">
                  <div className="stat-value">{stats.totalPostcards.toLocaleString()}</div>
                  <div className="stat-label">Postcards Sent</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">
                  <DollarSign size={24} />
                </div>
                <div className="stat-content">
                  <div className="stat-value">${stats.totalSpent.toLocaleString()}</div>
                  <div className="stat-label">Total Spent</div>
                </div>
              </div>
            </div>
          )}

          {/* Filters */}
          {!isLoading && campaigns.length > 0 && (
            <div className={`filters-section ${isScrolled ? 'collapsed' : ''}`}>
              <div className="filter-group">
                <label className="filter-label">Status</label>
                <select
                  className="filter-select"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="all">All Campaigns</option>
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="draft">Draft</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
              <div className="filter-group">
                <label className="filter-label">Date From</label>
                <div className="date-input-wrapper">
                  <Calendar size={16} className="date-icon" />
                  <input
                    type="date"
                    className="filter-date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                  />
                </div>
              </div>
              <div className="filter-group">
                <label className="filter-label">Date To</label>
                <div className="date-input-wrapper">
                  <Calendar size={16} className="date-icon" />
                  <input
                    type="date"
                    className="filter-date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                  />
                </div>
              </div>
              {(statusFilter !== 'all' || dateFrom || dateTo) && (
                <button
                  className="clear-filters-btn"
                  onClick={() => {
                    setStatusFilter('all');
                    setDateFrom('');
                    setDateTo('');
                  }}
                >
                  Clear Filters
                </button>
              )}
            </div>
          )}
          </div>

          {/* Data Table */}
          {isLoading ? (
            <div className="loading-container">
              <div>
                <div className="spinner"></div>
                <p>Loading campaigns...</p>
              </div>
            </div>
          ) : campaigns.length === 0 ? (
            <div className="empty-state">
              <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
                <rect x="8" y="16" width="48" height="32" rx="4" stroke="#CBD5E0" strokeWidth="2"/>
                <circle cx="20" cy="28" r="4" fill="#E2E8F0"/>
                <path d="M8 40L24 28L36 36L56 20" stroke="#CBD5E0" strokeWidth="2"/>
              </svg>
              <h3>No campaigns yet</h3>
              <p>Create your first campaign to get started</p>
              <Button variant="primary" onClick={handleCreateNewBlast}>
                Create New Campaign
              </Button>
            </div>
          ) : (
            <Table
              columns={columns}
              data={filteredCampaigns}
              className="history-table"
              onRowClick={handleRowClick}
            />
          )}
      </div>

      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setCampaignToDelete(null);
        }}
        onConfirm={confirmDeleteCampaign}
        title="Delete Campaign"
        message={
          campaignToDelete ? (
            <>
              Are you sure you want to delete <strong>{campaignToDelete.blastName}</strong>?
              This action cannot be undone.
            </>
          ) : (
            'Are you sure you want to delete this campaign? This action cannot be undone.'
          )
        }
        confirmText="Delete Campaign"
        cancelText="Cancel"
        severity="danger"
        isLoading={isDeleting}
        loadingText="Deleting..."
      />

      <style>{`
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 20px;
          margin: 24px 0;
        }

        .stat-card {
          background: white;
          border: 1px solid #E2E8F0;
          border-radius: 12px;
          padding: 20px;
          display: flex;
          gap: 16px;
          align-items: center;
          transition: all 0.2s;
        }

        .stat-card:hover {
          border-color: #20B2AA;
          box-shadow: 0 4px 12px rgba(32, 178, 170, 0.1);
        }

        .stat-icon {
          width: 48px;
          height: 48px;
          border-radius: 10px;
          background: linear-gradient(135deg, #20B2AA 0%, #17a2a2 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
        }

        .stat-content {
          flex: 1;
        }

        .stat-value {
          font-size: 28px;
          font-weight: 700;
          color: #1A202C;
          line-height: 1.2;
        }

        .stat-label {
          font-size: 13px;
          color: #718096;
          margin-top: 4px;
          font-weight: 500;
        }

        .filters-section {
          display: flex;
          gap: 16px;
          align-items: flex-end;
          margin: 24px 0;
          padding: 20px;
          background: white;
          border: 1px solid #E2E8F0;
          border-radius: 12px;
        }

        .filter-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
          flex: 1;
          max-width: 200px;
        }

        .filter-label {
          font-size: 13px;
          font-weight: 600;
          color: #4A5568;
        }

        .filter-select,
        .filter-date {
          padding: 10px 12px;
          border: 1.5px solid #E2E8F0;
          border-radius: 8px;
          font-size: 14px;
          color: #2D3748;
          background: white;
          transition: all 0.2s;
        }

        .filter-select:hover,
        .filter-date:hover {
          border-color: #CBD5E0;
        }

        .filter-select:focus,
        .filter-date:focus {
          outline: none;
          border-color: #20B2AA;
          box-shadow: 0 0 0 3px rgba(32, 178, 170, 0.1);
        }

        .date-input-wrapper {
          position: relative;
        }

        .date-icon {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: #A0AEC0;
          pointer-events: none;
        }

        .filter-date {
          padding-left: 36px;
        }

        .clear-filters-btn {
          padding: 10px 20px;
          background: #EDF2F7;
          border: 1.5px solid #E2E8F0;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          color: #4A5568;
          cursor: pointer;
          transition: all 0.2s;
          white-space: nowrap;
        }

        .clear-filters-btn:hover {
          background: #E2E8F0;
          border-color: #CBD5E0;
        }

        .loading-container {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: calc(100vh - 300px);
          width: 100%;
          padding: 40px 20px;
        }

        .loading-container > div {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 16px;
          animation: fadeIn 0.3s ease-out;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .spinner {
          width: 40px;
          height: 40px;
          border: 4px solid #E2E8F0;
          border-top-color: #20B2AA;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .loading-container p {
          color: #718096;
          font-size: 14px;
          margin: 0;
        }

        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: calc(100vh - 400px);
          padding: 80px 20px;
          gap: 20px;
          text-align: center;
          animation: fadeIn 0.4s ease-out;
        }

        .empty-state svg {
          opacity: 0.6;
          margin-bottom: 12px;
        }

        .empty-state h3 {
          margin: 0;
          font-size: 24px;
          font-weight: 700;
          color: #1A202C;
        }

        .empty-state p {
          margin: 0;
          font-size: 16px;
          color: #718096;
          line-height: 1.6;
          max-width: 400px;
          margin-bottom: 12px;
        }
      `}</style>
    </DashboardLayout>
  );
};

export default History;