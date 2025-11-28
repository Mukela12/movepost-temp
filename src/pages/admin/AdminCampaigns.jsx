import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Filter,
  CheckCircle,
  XCircle,
  Pause,
  Play,
  Trash2,
  ExternalLink,
  Clock,
  Check,
  X,
  Eye
} from 'lucide-react';
import { adminCampaignService } from '../../supabase/api/adminService';
import {
  approveCampaign,
  rejectCampaign,
  pauseCampaign,
  deleteCampaign,
  getCurrentAdminId
} from '../../supabase/api/adminActions';
import toast from 'react-hot-toast';
import './AdminCampaigns.css';

const AdminCampaigns = () => {
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeAction, setActiveAction] = useState(null); // { campaignId, action }
  const [rejectionReason, setRejectionReason] = useState('');

  useEffect(() => {
    loadCampaigns();
  }, [statusFilter, searchQuery]);

  const loadCampaigns = async () => {
    try {
      setLoading(true);
      const result = await adminCampaignService.getAllCampaigns({
        status: statusFilter,
        search: searchQuery
      });

      if (result.success) {
        setCampaigns(result.campaigns);
      }
    } catch (error) {
      console.error('Error loading campaigns:', error);
      toast.error('Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  };

  const handleApproveClick = (campaignId) => {
    setActiveAction({ campaignId, action: 'approve' });
  };

  const handleRejectClick = (campaignId) => {
    setActiveAction({ campaignId, action: 'reject' });
    setRejectionReason('');
  };

  const handlePauseClick = (campaignId) => {
    setActiveAction({ campaignId, action: 'pause' });
  };

  const handleDeleteClick = (campaignId) => {
    setActiveAction({ campaignId, action: 'delete' });
  };

  const handleCancelAction = () => {
    setActiveAction(null);
    setRejectionReason('');
  };

  const handleConfirmApprove = async (campaignId) => {
    try {
      const adminId = await getCurrentAdminId();
      if (!adminId) {
        toast.error('Authentication required');
        return;
      }

      const result = await approveCampaign(campaignId, adminId);

      if (result.success) {
        toast.success('Campaign approved successfully');
        setActiveAction(null);
        loadCampaigns();
      } else {
        toast.error(result.error || 'Failed to approve campaign');
      }
    } catch (error) {
      console.error('Error approving campaign:', error);
      toast.error('Failed to approve campaign');
    }
  };

  const handleConfirmReject = async (campaignId) => {
    if (!rejectionReason.trim()) {
      toast.error('Please enter a rejection reason');
      return;
    }

    try {
      const adminId = await getCurrentAdminId();
      if (!adminId) {
        toast.error('Authentication required');
        return;
      }

      const result = await rejectCampaign(campaignId, adminId, rejectionReason);

      if (result.success) {
        toast.success('Campaign rejected successfully');
        setActiveAction(null);
        setRejectionReason('');
        loadCampaigns();
      } else {
        toast.error(result.error || 'Failed to reject campaign');
      }
    } catch (error) {
      console.error('Error rejecting campaign:', error);
      toast.error('Failed to reject campaign');
    }
  };

  const handleConfirmPause = async (campaignId) => {
    try {
      const adminId = await getCurrentAdminId();
      if (!adminId) {
        toast.error('Authentication required');
        return;
      }

      const result = await pauseCampaign(campaignId, adminId, 'Paused by admin');

      if (result.success) {
        toast.success('Campaign paused successfully');
        setActiveAction(null);
        loadCampaigns();
      } else {
        toast.error(result.error || 'Failed to pause campaign');
      }
    } catch (error) {
      console.error('Error pausing campaign:', error);
      toast.error('Failed to pause campaign');
    }
  };

  const handleConfirmDelete = async (campaignId) => {
    try {
      const adminId = await getCurrentAdminId();
      if (!adminId) {
        toast.error('Authentication required');
        return;
      }

      const result = await deleteCampaign(campaignId, adminId);

      if (result.success) {
        toast.success('Campaign deleted successfully');
        setActiveAction(null);
        loadCampaigns();
      } else {
        toast.error(result.error || 'Failed to delete campaign');
      }
    } catch (error) {
      console.error('Error deleting campaign:', error);
      toast.error('Failed to delete campaign');
    }
  };

  const getStatusBadge = (campaign) => {
    const statusMap = {
      pending_approval: { label: 'Pending', color: 'warning', icon: Clock },
      active: { label: 'Active', color: 'success', icon: CheckCircle },
      paused: { label: 'Paused', color: 'warning', icon: Pause },
      rejected: { label: 'Rejected', color: 'error', icon: XCircle },
      completed: { label: 'Completed', color: 'info', icon: CheckCircle }
    };

    const status = statusMap[campaign.status] || { label: campaign.status, color: 'default', icon: Clock };
    const Icon = status.icon;

    return (
      <span className={`admin-status-badge badge-${status.color}`}>
        <Icon size={14} />
        {status.label}
      </span>
    );
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className="admin-campaigns">
      <div className="admin-campaigns-header">
        <div>
          <h1>Campaigns</h1>
        </div>
      </div>

      {/* Filters */}
      <div className="admin-campaigns-filters">
        <div className="admin-search-box">
          <Search size={18} />
          <input
            type="text"
            placeholder="Search campaigns, companies, or users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="admin-filter-tabs">
          {['all', 'pending_approval', 'active', 'paused', 'rejected'].map((status) => (
            <button
              key={status}
              className={`admin-filter-tab ${statusFilter === status ? 'active' : ''}`}
              onClick={() => setStatusFilter(status)}
            >
              {status === 'all' ? 'All' : status.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Campaigns Table */}
      <div className="admin-campaigns-table-container">
        {loading ? (
          <div className="admin-table-loading">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="admin-table-skeleton"></div>
            ))}
          </div>
        ) : campaigns.length === 0 ? (
          <div className="admin-empty-state">
            <Filter size={48} />
            <h3>No campaigns found</h3>
            <p>Try adjusting your filters or search query</p>
          </div>
        ) : (
          <div className="admin-campaigns-table">
            {campaigns.map((campaign) => {
              const isActionActive = activeAction?.campaignId === campaign.id;

              return (
                <motion.div
                  key={campaign.id}
                  className="admin-campaign-row"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  {/* Campaign Info */}
                  <div className="admin-campaign-main">
                    <div className="admin-campaign-info">
                      <div className="admin-campaign-header-row">
                        <h3 className="admin-campaign-name">{campaign.campaign_name}</h3>
                        {getStatusBadge(campaign)}
                      </div>
                      <div className="admin-campaign-meta">
                        <span className="admin-campaign-company">{campaign.company_name}</span>
                        <span className="admin-campaign-separator">•</span>
                        <span className="admin-campaign-user">{campaign.user_email}</span>
                        <span className="admin-campaign-separator">•</span>
                        <span className="admin-campaign-date">Created {formatDate(campaign.created_at)}</span>
                      </div>
                      <div className="admin-campaign-details">
                        <div className="admin-campaign-detail-item">
                          <span className="admin-detail-label">Budget:</span>
                          <span className="admin-detail-value">${campaign.budget.toLocaleString()}</span>
                        </div>
                        <div className="admin-campaign-detail-item">
                          <span className="admin-detail-label">Targeting:</span>
                          <span className="admin-detail-value">{campaign.target_audience}</span>
                        </div>
                        {campaign.provider && (
                          <div className="admin-campaign-detail-item">
                            <span className="admin-detail-label">Provider:</span>
                            <span className="admin-detail-value provider">{campaign.provider.toUpperCase()}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Preview */}
                    {campaign.postcard_preview_url && (
                      <div className="admin-campaign-preview">
                        <img
                          src={campaign.postcard_preview_url}
                          alt="Postcard preview"
                          onError={(e) => { e.target.style.display = 'none' }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <AnimatePresence mode="wait">
                    {isActionActive ? (
                      <motion.div
                        key="inline-action"
                        className="admin-inline-action"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                      >
                        {activeAction.action === 'approve' && (
                          <div className="admin-confirm-box confirm-approve">
                            <p>Approve "{campaign.campaign_name}"?</p>
                            <div className="admin-confirm-actions">
                              <button
                                className="admin-confirm-btn confirm"
                                onClick={() => handleConfirmApprove(campaign.id)}
                              >
                                <Check size={18} />
                                Confirm
                              </button>
                              <button
                                className="admin-confirm-btn cancel"
                                onClick={handleCancelAction}
                              >
                                <X size={18} />
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}

                        {activeAction.action === 'reject' && (
                          <div className="admin-confirm-box confirm-reject">
                            <label>Rejection Reason (required)</label>
                            <textarea
                              placeholder="Enter reason for rejection..."
                              value={rejectionReason}
                              onChange={(e) => setRejectionReason(e.target.value)}
                              rows={3}
                              autoFocus
                            />
                            <div className="admin-confirm-actions">
                              <button
                                className="admin-confirm-btn confirm"
                                onClick={() => handleConfirmReject(campaign.id)}
                                disabled={!rejectionReason.trim()}
                              >
                                Reject Campaign
                              </button>
                              <button
                                className="admin-confirm-btn cancel"
                                onClick={handleCancelAction}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}

                        {activeAction.action === 'pause' && (
                          <div className="admin-confirm-box confirm-pause">
                            <p>Pause "{campaign.campaign_name}"?</p>
                            <div className="admin-confirm-actions">
                              <button
                                className="admin-confirm-btn confirm"
                                onClick={() => handleConfirmPause(campaign.id)}
                              >
                                <Pause size={18} />
                                Confirm
                              </button>
                              <button
                                className="admin-confirm-btn cancel"
                                onClick={handleCancelAction}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}

                        {activeAction.action === 'delete' && (
                          <div className="admin-confirm-box confirm-delete">
                            <p>Delete "{campaign.campaign_name}"? This action cannot be undone.</p>
                            <div className="admin-confirm-actions">
                              <button
                                className="admin-confirm-btn confirm danger"
                                onClick={() => handleConfirmDelete(campaign.id)}
                              >
                                <Trash2 size={18} />
                                Delete Permanently
                              </button>
                              <button
                                className="admin-confirm-btn cancel"
                                onClick={handleCancelAction}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </motion.div>
                    ) : (
                      <motion.div
                        key="action-buttons"
                        className="admin-campaign-actions"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                      >
                        <button
                          className="admin-action-btn view-details"
                          onClick={() => navigate(`/admin/campaigns/${campaign.id}`)}
                          title="View details"
                        >
                          <Eye size={18} />
                          View Details
                        </button>

                        {campaign.approval_status === 'pending' && (
                          <>
                            <button
                              className="admin-action-btn approve"
                              onClick={() => handleApproveClick(campaign.id)}
                              title="Approve campaign"
                            >
                              <CheckCircle size={18} />
                              Approve
                            </button>
                            <button
                              className="admin-action-btn reject"
                              onClick={() => handleRejectClick(campaign.id)}
                              title="Reject campaign"
                            >
                              <XCircle size={18} />
                              Reject
                            </button>
                          </>
                        )}

                        {campaign.status === 'active' && (
                          <>
                            <button
                              className="admin-action-btn pause"
                              onClick={() => handlePauseClick(campaign.id)}
                              title="Pause campaign"
                            >
                              <Pause size={18} />
                              Pause
                            </button>
                          </>
                        )}

                        <button
                          className="admin-action-btn delete"
                          onClick={() => handleDeleteClick(campaign.id)}
                          title="Delete campaign"
                        >
                          <Trash2 size={18} />
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminCampaigns;
