import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User,
  Mail,
  Building2,
  Calendar,
  Target,
  DollarSign,
  Shield,
  Ban,
  CheckCircle,
  X,
  FileText,
  Eye,
  CheckSquare,
  XSquare,
  AlertCircle,
  ArrowLeft,
  Check
} from 'lucide-react';
import { adminUserService } from '../../supabase/api/adminService';
import toast from 'react-hot-toast';
import './AdminUserDetails.css';

const AdminUserDetails = () => {
  const { userId } = useParams();
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);

  // Inline confirmation states
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [blockReason, setBlockReason] = useState('');
  const [rejectingCampaign, setRejectingCampaign] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    loadUserDetails();
  }, [userId]);

  const loadUserDetails = async () => {
    try {
      setLoading(true);

      // Load user details
      const userResult = await adminUserService.getUserById(userId);
      if (userResult.success) {
        setUser(userResult.user);
      }

      // Load user's campaigns
      const campaignsResult = await adminUserService.getUserCampaigns(userId);
      if (campaignsResult.success) {
        setCampaigns(campaignsResult.campaigns);
      }
    } catch (error) {
      console.error('Error loading user details:', error);
      toast.error('Failed to load user details');
    } finally {
      setLoading(false);
    }
  };

  const handleBlockClick = () => {
    setShowBlockConfirm(true);
    setBlockReason('');
  };

  const handleCancelBlock = () => {
    setShowBlockConfirm(false);
    setBlockReason('');
  };

  const handleConfirmBlock = async () => {
    if (!user.is_blocked && !blockReason.trim()) {
      toast.error('Please enter a block reason');
      return;
    }

    try {
      setActionLoading('block');
      const result = user.is_blocked
        ? await adminUserService.unblockUser(userId)
        : await adminUserService.blockUser(userId, blockReason);

      if (result.success) {
        toast.success(`User ${user.is_blocked ? 'unblocked' : 'blocked'} successfully`);
        setShowBlockConfirm(false);
        setBlockReason('');
        loadUserDetails();
      } else {
        toast.error(result.error || 'Action failed');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Action failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectClick = (campaignId) => {
    setRejectingCampaign(campaignId);
    setRejectReason('');
  };

  const handleCancelReject = () => {
    setRejectingCampaign(null);
    setRejectReason('');
  };

  const handleConfirmReject = async (campaignId) => {
    if (!rejectReason.trim()) {
      toast.error('Please enter a rejection reason');
      return;
    }

    try {
      setActionLoading(campaignId + 'reject');
      const result = await adminUserService.rejectCampaign(campaignId, rejectReason);

      if (result.success) {
        toast.success('Campaign rejected successfully');
        setRejectingCampaign(null);
        setRejectReason('');
        loadUserDetails();
      } else {
        toast.error(result.error || 'Action failed');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Action failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCampaignAction = async (campaignId, action) => {
    if (action === 'reject') {
      handleRejectClick(campaignId);
      return;
    }

    try {
      setActionLoading(campaignId + action);

      const result = await adminUserService.approveCampaign(campaignId);

      if (result.success) {
        toast.success('Campaign approved successfully');
        loadUserDetails();
      } else {
        toast.error(result.error || 'Action failed');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Action failed');
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusColor = (status) => {
    const colors = {
      'pending_approval': 'warning',
      'active': 'success',
      'paused': 'info',
      'completed': 'success',
      'rejected': 'error',
      'draft': 'default'
    };
    return colors[status] || 'default';
  };

  if (loading) {
    return (
      <div className="admin-user-details">
        <div className="admin-details-loading">
          <div className="admin-details-spinner"></div>
          <p>Loading user details...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="admin-user-details">
        <div className="admin-details-error">
          <AlertCircle size={48} />
          <h2>User Not Found</h2>
          <p>The user you're looking for doesn't exist or has been deleted.</p>
          <button
            className="admin-details-btn-primary"
            onClick={() => navigate('/admin/users')}
          >
            Back to Users
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-user-details">
      {/* Header */}
      <div className="admin-details-header">
        <button
          className="admin-details-back-btn"
          onClick={() => navigate('/admin/users')}
        >
          <ArrowLeft size={20} />
          Back to Users
        </button>

        <div className="admin-details-actions">
          {!showBlockConfirm && (
            <button
              className={`admin-action-btn ${user.is_blocked ? 'unblock' : 'block'}`}
              onClick={handleBlockClick}
              disabled={actionLoading === 'block'}
            >
              {user.is_blocked ? 'Unblock User' : 'Block User'}
            </button>
          )}
        </div>
      </div>

      {/* Inline Block/Unblock Confirmation */}
      <AnimatePresence>
        {showBlockConfirm && (
          <motion.div
            className={`admin-confirm-box ${user.is_blocked ? 'confirm-approve' : 'confirm-delete'}`}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            {user.is_blocked ? (
              <>
                <p>Are you sure you want to unblock "{user.full_name || user.email}"?</p>
                <div className="admin-confirm-actions">
                  <button
                    className="admin-confirm-btn confirm"
                    onClick={handleConfirmBlock}
                    disabled={actionLoading === 'block'}
                  >
                    <Check size={18} />
                    Unblock User
                  </button>
                  <button
                    className="admin-confirm-btn cancel"
                    onClick={handleCancelBlock}
                  >
                    <X size={18} />
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <>
                <label>Block Reason (required)</label>
                <textarea
                  placeholder="Enter reason for blocking this user..."
                  value={blockReason}
                  onChange={(e) => setBlockReason(e.target.value)}
                  rows={3}
                  autoFocus
                />
                <div className="admin-confirm-actions">
                  <button
                    className="admin-confirm-btn confirm danger"
                    onClick={handleConfirmBlock}
                    disabled={!blockReason.trim() || actionLoading === 'block'}
                  >
                    <Ban size={18} />
                    Block User
                  </button>
                  <button
                    className="admin-confirm-btn cancel"
                    onClick={handleCancelBlock}
                  >
                    <X size={18} />
                    Cancel
                  </button>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* User Info Card */}
      <motion.div
        className="admin-details-card user-info-card"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="user-info-header">
          <div className="user-avatar">
            {user.full_name ? user.full_name.charAt(0).toUpperCase() : 'U'}
          </div>
          <div className="user-info-main">
            <h2>{user.full_name || 'Unknown User'}</h2>
            <div className="user-status-badges">
              <span className={`status-badge ${user.is_blocked ? 'blocked' : 'active'}`}>
                {user.is_blocked ? (
                  <>
                    <Ban size={14} />
                    Blocked
                  </>
                ) : (
                  <>
                    <CheckCircle size={14} />
                    Active
                  </>
                )}
              </span>
            </div>
          </div>
        </div>

        <div className="user-info-grid">
          <div className="user-info-item">
            <Mail size={18} />
            <div>
              <span className="info-label">Email</span>
              <span className="info-value">{user.email}</span>
            </div>
          </div>

          <div className="user-info-item">
            <Building2 size={18} />
            <div>
              <span className="info-label">Company</span>
              <span className="info-value">{user.company_name || 'N/A'}</span>
            </div>
          </div>

          <div className="user-info-item">
            <Calendar size={18} />
            <div>
              <span className="info-label">Joined</span>
              <span className="info-value">{formatDate(user.created_at)}</span>
            </div>
          </div>

          <div className="user-info-item">
            <Target size={18} />
            <div>
              <span className="info-label">Total Campaigns</span>
              <span className="info-value">{campaigns.length}</span>
            </div>
          </div>
        </div>

        {user.is_blocked && user.blocked_reason && (
          <div className="block-info-box">
            <Shield size={18} />
            <div>
              <strong>Blocked Reason:</strong>
              <p>{user.blocked_reason}</p>
            </div>
          </div>
        )}
      </motion.div>

      {/* Campaigns Section */}
      <motion.div
        className="admin-details-card campaigns-section"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className="section-header">
          <FileText size={20} />
          <h3>User Campaigns ({campaigns.length})</h3>
        </div>

        {campaigns.length === 0 ? (
          <div className="empty-campaigns">
            <FileText size={48} />
            <p>This user hasn't created any campaigns yet.</p>
          </div>
        ) : (
          <div className="campaigns-list">
            {campaigns.map((campaign) => (
              <motion.div
                key={campaign.id}
                className="campaign-card"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                whileHover={{ x: 4 }}
              >
                <div className="campaign-preview">
                  {campaign.cloudinary_url ? (
                    <img src={campaign.cloudinary_url} alt="Campaign preview" />
                  ) : (
                    <div className="preview-placeholder">
                      <FileText size={32} />
                    </div>
                  )}
                </div>

                <div className="campaign-info">
                  <div className="campaign-header">
                    <h4>{campaign.campaign_name}</h4>
                    <span className={`campaign-status badge-${getStatusColor(campaign.status)}`}>
                      {campaign.status.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="campaign-meta">
                    <span>
                      <Calendar size={14} />
                      {formatDate(campaign.created_at)}
                    </span>
                    <span>
                      <Target size={14} />
                      {campaign.zip_codes?.length || 0} ZIP codes
                    </span>
                    <span>
                      <DollarSign size={14} />
                      ${campaign.budget || '0'}
                    </span>
                  </div>

                  {/* Inline Rejection Confirmation */}
                  <AnimatePresence>
                    {rejectingCampaign === campaign.id && (
                      <motion.div
                        className="admin-confirm-box confirm-delete"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                      >
                        <label>Rejection Reason (required)</label>
                        <textarea
                          placeholder="Enter reason for rejecting this campaign..."
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          rows={3}
                          autoFocus
                        />
                        <div className="admin-confirm-actions">
                          <button
                            className="admin-confirm-btn confirm danger"
                            onClick={() => handleConfirmReject(campaign.id)}
                            disabled={!rejectReason.trim() || actionLoading === campaign.id + 'reject'}
                          >
                            <XSquare size={18} />
                            Reject Campaign
                          </button>
                          <button
                            className="admin-confirm-btn cancel"
                            onClick={handleCancelReject}
                          >
                            <X size={18} />
                            Cancel
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {rejectingCampaign !== campaign.id && (
                    <div className="campaign-actions">
                      <button
                        className="campaign-action-btn view"
                        onClick={() => navigate(`/admin/campaigns/${campaign.id}`)}
                      >
                        <Eye size={16} />
                        View Details
                      </button>

                      {campaign.status === 'pending_approval' && (
                        <>
                          <button
                            className="campaign-action-btn approve"
                            onClick={() => handleCampaignAction(campaign.id, 'approve')}
                            disabled={actionLoading === campaign.id + 'approve'}
                          >
                            <CheckSquare size={16} />
                            Approve
                          </button>
                          <button
                            className="campaign-action-btn reject"
                            onClick={() => handleCampaignAction(campaign.id, 'reject')}
                            disabled={actionLoading === campaign.id + 'reject'}
                          >
                            <XSquare size={16} />
                            Reject
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default AdminUserDetails;
