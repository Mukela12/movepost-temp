import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LayoutGrid, CheckCircle, Mail, DollarSign, Plus, Clock, AlertTriangle } from 'lucide-react';
import DashboardLayout from '../components/layout/DashboardLayout';
import EmptyState from '../components/dashboard/EmptyState';
import CampaignCard from '../components/dashboard/CampaignCard';
import campaignService from '../supabase/api/campaignService';
import toast from 'react-hot-toast';
import './Dashboard.css';

const Dashboard = () => {
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState([]);
  const [campaignStats, setCampaignStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load campaigns and stats on mount
  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setIsLoading(true);

      // Load campaigns
      const campaignsResult = await campaignService.getCampaigns();

      if (campaignsResult.success) {
        // Transform campaigns to match existing format
        const transformedCampaigns = campaignsResult.campaigns.map(campaign => ({
          id: campaign.id,
          name: campaign.campaign_name,
          status: campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1),
          approvalStatus: campaign.approval_status || campaign.status,
          isActive: campaign.status === 'active',
          targetArea: campaign.targeting_type === 'zip_codes' ?
            `${campaign.total_recipients || campaign.target_zip_codes?.length || 0} ZIP${(campaign.total_recipients || campaign.target_zip_codes?.length) !== 1 ? 's' : ''}` :
            'Radius',
          postcardsSent: campaign.postcards_sent || 0,
          totalRecipients: campaign.total_recipients || 0,
          totalCost: campaign.total_cost || 0,
          paymentStatus: campaign.payment_status,
          image: campaign.postcard_preview_url || 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=400&h=300&fit=crop',
          createdAt: campaign.created_at,
          launchedAt: campaign.launched_at,
          approvalHistory: campaign.approval_history || []
        }));

        setCampaigns(transformedCampaigns);
      }

      // Load statistics
      const statsResult = await campaignService.getCampaignStats();

      if (statsResult.success) {
        setCampaignStats(statsResult.stats);
      }

    } catch (error) {
      console.error('Error loading dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateCampaign = () => {
    navigate('/create-campaign'); // Start a new campaign
  };

  const handleNavigateToHistory = () => {
    navigate('/history');
  };

  const handleEditCampaign = (campaignId) => {
    navigate(`/campaign/${campaignId}/edit`);
  };

  const handleDeleteCampaign = async (campaignId) => {
    if (!confirm('Are you sure you want to delete this campaign?')) {
      return;
    }

    try {
      toast.loading('Deleting campaign...', { id: 'delete-campaign' });

      await campaignService.deleteCampaign(campaignId);

      toast.success('Campaign deleted successfully', { id: 'delete-campaign' });

      // Remove from UI
      setCampaigns(campaigns.filter(c => c.id !== campaignId));
    } catch (error) {
      console.error('Error deleting campaign:', error);
      toast.error('Failed to delete campaign', { id: 'delete-campaign' });
    }
  };

  const handleDuplicateCampaign = async (campaignId) => {
    try {
      toast.loading('Duplicating campaign...', { id: 'duplicate-campaign' });

      const result = await campaignService.duplicateCampaign(campaignId);

      if (result.success) {
        toast.success('Campaign duplicated successfully', { id: 'duplicate-campaign' });

        // Reload campaigns
        await loadDashboardData();
      }
    } catch (error) {
      console.error('Error duplicating campaign:', error);
      toast.error('Failed to duplicate campaign', { id: 'duplicate-campaign' });
    }
  };

  const toggleCampaignStatus = async (campaignId) => {
    try {
      const campaign = campaigns.find(c => c.id === campaignId);

      if (!campaign) return;

      const newStatus = campaign.isActive ? 'paused' : 'active';

      toast.loading(campaign.isActive ? 'Pausing campaign...' : 'Activating campaign...', { id: 'toggle-status' });

      await campaignService.updateCampaign(campaignId, { status: newStatus });

      toast.success(campaign.isActive ? 'Campaign paused' : 'Campaign activated', { id: 'toggle-status' });

      // Update UI
      setCampaigns(campaigns.map(c =>
        c.id === campaignId
          ? { ...c, isActive: !c.isActive, status: c.isActive ? 'Paused' : 'Active' }
          : c
      ));
    } catch (error) {
      console.error('Error toggling campaign status:', error);
      toast.error('Failed to update campaign status', { id: 'toggle-status' });
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="dashboard-loading">
          <div className="loading-content">
            <div className="spinner"></div>
            <p>Loading your campaigns...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Empty state when no campaigns
  if (campaigns.length === 0 && !isLoading) {
    return (
      <DashboardLayout>
        <EmptyState onCreateCampaign={handleCreateCampaign} />
      </DashboardLayout>
    );
  }

  // Check for campaigns with specific approval statuses
  const hasPendingCampaigns = campaigns.some(c => c.approvalStatus === 'pending_review');
  const hasRejectedCampaigns = campaigns.some(c => c.approvalStatus === 'rejected');
  const hasDraftCampaignsNeedingPayment = campaigns.some(c => c.status === 'draft' && c.paymentStatus === 'pending');

  // Dashboard with campaigns
  return (
    <DashboardLayout>
      <div className="dashboard-page">
          {/* Header */}
          <div className="dashboard-header">
            <h1 className="dashboard-title">Dashboard</h1>
            <motion.button
              className="create-campaign-button"
              onClick={handleCreateCampaign}
              whileHover={{ scale: 1.02, boxShadow: "0 6px 16px rgba(32, 178, 170, 0.25)" }}
              whileTap={{ scale: 0.98 }}
            >
              <Plus size={16} />
              Create Campaign
            </motion.button>
          </div>

          {/* Workflow Status Banners */}
          {hasPendingCampaigns && (
            <motion.div
              className="workflow-banner workflow-banner-pending"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              <div className="banner-icon">
                <Clock size={24} />
              </div>
              <div className="banner-content">
                <div className="banner-title">Campaign Under Review</div>
                <div className="banner-message">
                  Your postcard design is being reviewed. This usually takes a few hours.
                  You'll be notified once it's approved.
                </div>
              </div>
            </motion.div>
          )}

          {hasRejectedCampaigns && (
            <motion.div
              className="workflow-banner workflow-banner-rejected"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              <div className="banner-icon">
                <AlertTriangle size={24} />
              </div>
              <div className="banner-content">
                <div className="banner-title">Campaign Rejected</div>
                <div className="banner-message">
                  One or more campaigns were rejected. Please review the feedback and make necessary changes.
                  Need help? Contact us at <a href="mailto:contact@movepost.co">contact@movepost.co</a>
                </div>
              </div>
            </motion.div>
          )}

          {hasDraftCampaignsNeedingPayment && (
            <motion.div
              className="workflow-banner workflow-banner-payment"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              <div className="banner-icon">
                <DollarSign size={24} />
              </div>
              <div className="banner-content">
                <div className="banner-title">Payment Required to Activate</div>
                <div className="banner-message">
                  You have campaigns that need a payment method to activate.{' '}
                  <Link to="/settings?tab=billing" style={{ color: '#20B2AA', textDecoration: 'none', fontWeight: 500 }}>
                    Add payment method →
                  </Link>
                </div>
              </div>
            </motion.div>
          )}

          {/* Statistics Summary */}
          {campaignStats && (
            <div className="stats-summary">
              <motion.div
                className="stat-card"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0, ease: "easeOut" }}
                whileHover={{ y: -4, boxShadow: "0 8px 20px rgba(0, 0, 0, 0.12)" }}
              >
                <div className="stat-icon-wrapper stat-icon-primary">
                  <LayoutGrid size={24} />
                </div>
                <div className="stat-content">
                  <div className="stat-value">{campaignStats.total_campaigns}</div>
                  <div className="stat-label">Total Campaigns</div>
                </div>
              </motion.div>
              <motion.div
                className="stat-card"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.1, ease: "easeOut" }}
                whileHover={{ y: -4, boxShadow: "0 8px 20px rgba(0, 0, 0, 0.12)" }}
              >
                <div className="stat-icon-wrapper stat-icon-success">
                  <CheckCircle size={24} />
                </div>
                <div className="stat-content">
                  <div className="stat-value">{campaignStats.active_campaigns}</div>
                  <div className="stat-label">Active Campaigns</div>
                </div>
              </motion.div>
              <motion.div
                className="stat-card"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.2, ease: "easeOut" }}
                whileHover={{ y: -4, boxShadow: "0 8px 20px rgba(0, 0, 0, 0.12)" }}
              >
                <div className="stat-icon-wrapper stat-icon-info">
                  <Mail size={24} />
                </div>
                <div className="stat-content">
                  <div className="stat-value">{campaignStats.total_postcards_sent.toLocaleString()}</div>
                  <div className="stat-label">Postcards Sent</div>
                </div>
              </motion.div>
              <motion.div
                className="stat-card"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.3, ease: "easeOut" }}
                whileHover={{ y: -4, boxShadow: "0 8px 20px rgba(0, 0, 0, 0.12)" }}
              >
                <div className="stat-icon-wrapper stat-icon-warning">
                  <DollarSign size={24} />
                </div>
                <div className="stat-content">
                  <div className="stat-value">${campaignStats.total_spent.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                  <div className="stat-label">Total Spent</div>
                </div>
              </motion.div>
            </div>
          )}

          {/* Campaigns Grid */}
          <div className="campaigns-grid">
            {campaigns.map((campaign) => (
              <CampaignCard
                key={campaign.id}
                campaign={campaign}
                onToggleStatus={toggleCampaignStatus}
                onEdit={handleEditCampaign}
                onDelete={handleDeleteCampaign}
                onDuplicate={handleDuplicateCampaign}
              />
            ))}
          </div>
      </div>

      <style>{`
        .dashboard-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 400px;
          gap: 16px;
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

        .workflow-banner {
          display: flex;
          align-items: flex-start;
          gap: 16px;
          padding: 16px 20px;
          border-radius: 12px;
          margin-bottom: 24px;
          border-left: 4px solid;
          animation: slideDown 0.3s ease-out;
        }

        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .workflow-banner-pending {
          background-color: #FFFBEB;
          border-left-color: #F59E0B;
        }

        .workflow-banner-rejected {
          background-color: #FEF2F2;
          border-left-color: #EF4444;
        }

        .workflow-banner-payment {
          background-color: #FFF3CD;
          border-left-color: #FFC107;
        }

        .banner-icon {
          font-size: 24px;
          line-height: 1;
          flex-shrink: 0;
        }

        .banner-content {
          flex: 1;
        }

        .banner-title {
          font-size: 16px;
          font-weight: 600;
          color: #1A202C;
          margin-bottom: 4px;
        }

        .banner-message {
          font-size: 14px;
          color: #4A5568;
          line-height: 1.5;
        }

        .banner-message a {
          color: #20B2AA;
          text-decoration: none;
          font-weight: 500;
        }

        .banner-message a:hover {
          text-decoration: underline;
        }

        .stats-summary {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 20px;
          margin-bottom: 32px;
        }

        .stat-card {
          background: white;
          border: 1px solid #E2E8F0;
          border-radius: 12px;
          padding: 24px;
          display: flex;
          align-items: center;
          gap: 20px;
          transition: all 0.2s;
          position: relative;
          overflow: hidden;
        }

        .stat-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 3px;
          background: transparent;
          transition: background 0.2s;
        }

        .stat-card:hover {
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
          transform: translateY(-2px);
        }

        .stat-card:hover::before {
          background: linear-gradient(90deg, #20B2AA 0%, #17a097 100%);
        }

        .stat-icon-wrapper {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 56px;
          height: 56px;
          border-radius: 12px;
          flex-shrink: 0;
        }

        .stat-icon-primary {
          background: linear-gradient(135deg, #E6FFFA 0%, #B2F5EA 100%);
          color: #20B2AA;
        }

        .stat-icon-success {
          background: linear-gradient(135deg, #D1FAE5 0%, #A7F3D0 100%);
          color: #059669;
        }

        .stat-icon-info {
          background: linear-gradient(135deg, #DBEAFE 0%, #BFDBFE 100%);
          color: #2563EB;
        }

        .stat-icon-warning {
          background: linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%);
          color: #D97706;
        }

        .stat-content {
          flex: 1;
          min-width: 0;
        }

        .stat-value {
          font-size: 28px;
          font-weight: 700;
          color: #1A202C;
          line-height: 1.2;
          margin-bottom: 4px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .stat-label {
          font-size: 13px;
          color: #718096;
          font-weight: 500;
          letter-spacing: 0.01em;
        }

        @media (max-width: 768px) {
          .stats-summary {
            grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
            gap: 12px;
          }

          .stat-card {
            padding: 16px;
            gap: 12px;
          }

          .stat-icon-wrapper {
            width: 44px;
            height: 44px;
          }

          .stat-icon-wrapper svg {
            width: 18px;
            height: 18px;
          }

          .stat-value {
            font-size: 20px;
          }

          .stat-label {
            font-size: 10px;
            line-height: 1.3;
          }
        }

        @media (max-width: 480px) {
          .stats-summary {
            grid-template-columns: repeat(2, 1fr);
            gap: 10px;
          }

          .stat-card {
            padding: 14px;
            gap: 10px;
          }

          .stat-icon-wrapper {
            width: 40px;
            height: 40px;
          }

          .stat-icon-wrapper svg {
            width: 16px;
            height: 16px;
          }

          .stat-value {
            font-size: 18px;
          }

          .stat-label {
            font-size: 9px;
          }
        }
      `}</style>
    </DashboardLayout>
  );
};

export default Dashboard;