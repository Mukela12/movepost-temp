import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  X,
  Download,
  ExternalLink,
  Calendar,
  Target,
  Mail,
  DollarSign,
  MapPin,
  User,
  Building2,
  Globe,
  CheckCircle,
  Clock,
  AlertCircle,
  XCircle,
  PauseCircle,
  PlayCircle,
  Trash2
} from 'lucide-react';
import { adminCampaignService } from '../../supabase/api/adminService';
import { newMoverService } from '../../supabase/api/newMoverService';
import {
  approveCampaign,
  rejectCampaign,
  pauseCampaign,
  resumeCampaign,
  deleteCampaign,
  getCurrentAdminId
} from '../../supabase/api/adminActions';
import PollingStatusBadge from '../../components/admin/PollingStatusBadge';
import toast from 'react-hot-toast';
import './AdminCampaignDetails.css';

const AdminCampaignDetails = () => {
  const { campaignId } = useParams();
  const navigate = useNavigate();
  const [campaign, setCampaign] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [showRejectPrompt, setShowRejectPrompt] = useState(false);
  const [showPausePrompt, setShowPausePrompt] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [pauseReason, setPauseReason] = useState('');

  useEffect(() => {
    loadCampaignDetails();
  }, [campaignId]);

  const loadCampaignDetails = async () => {
    try {
      setLoading(true);
      const result = await adminCampaignService.getCampaignById(campaignId);

      if (result.success) {
        setCampaign(result.campaign);
      } else {
        setError(result.error || 'Failed to load campaign details');
        toast.error(result.error || 'Failed to load campaign details');
      }
    } catch (err) {
      console.error('Error loading campaign:', err);
      setError('An error occurred while loading campaign details');
      toast.error('An error occurred while loading campaign details');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    navigate('/admin/campaigns');
  };

  const handleDownloadDesign = () => {
    if (campaign?.postcard_design_url) {
      window.open(campaign.postcard_design_url, '_blank');
      toast.success('Opening design file in new tab');
    } else {
      toast.error('No design file available');
    }
  };

  const handleDownloadPreview = () => {
    if (campaign?.postcard_preview_url) {
      window.open(campaign.postcard_preview_url, '_blank');
      toast.success('Opening preview image in new tab');
    } else {
      toast.error('No preview available');
    }
  };

  const handleDownloadNewMovers = async () => {
    if (!campaign) return;

    // Only allow download for ZIP code targeting
    if (campaign.targeting_type !== 'zip_codes' && campaign.targeting_type !== 'zip') {
      toast.error('New mover data download is only available for ZIP code targeting');
      return;
    }

    if (!campaign.target_zip_codes || campaign.target_zip_codes.length === 0) {
      toast.error('No ZIP codes available to download');
      return;
    }

    const loadingToast = toast.loading('Fetching new mover data from Melissa...');

    try {
      // Fetch actual new mover data from the database
      const result = await newMoverService.getByCampaignZipCodes(
        campaign.target_zip_codes,
        10000 // Get up to 10,000 records
      );

      if (!result.success || !result.data || result.data.length === 0) {
        toast.dismiss(loadingToast);
        toast.error('No new mover data found for these ZIP codes');
        return;
      }

      // Remove duplicates based on Melissa Address Key (unique identifier)
      const uniqueMovers = [];
      const seenKeys = new Set();

      result.data.forEach(mover => {
        // Use melissa_address_key as primary unique identifier
        const uniqueKey = mover.melissa_address_key;

        // If no melissa_address_key, create a fallback unique key from name + address
        const fallbackKey = `${mover.full_name}_${mover.address_line}_${mover.zip_code}`.toLowerCase().trim();
        const key = uniqueKey || fallbackKey;

        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          uniqueMovers.push(mover);
        }
      });

      console.log(`Removed ${result.data.length - uniqueMovers.length} duplicate records`);
      console.log(`Exporting ${uniqueMovers.length} unique new mover records`);

      // Create CSV content with actual new mover details
      const csvRows = [];

      // Add header row with all new mover fields
      csvRows.push([
        'Full Name',
        'Address',
        'City',
        'State',
        'ZIP Code',
        'Phone Number',
        'Move Effective Date',
        'Previous Address',
        'Previous ZIP Code',
        'Campaign Name',
        'Melissa Address Key'
      ].join(','));

      // Add new mover data rows (using deduplicated data)
      uniqueMovers.forEach(mover => {
        const formatDate = (dateString) => {
          if (!dateString) return '';
          const date = new Date(dateString);
          return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
          });
        };

        csvRows.push([
          `"${mover.full_name || ''}"`,
          `"${mover.address_line || ''}"`,
          `"${mover.city || ''}"`,
          `"${mover.state || ''}"`,
          `"${mover.zip_code || ''}"`,
          `"${mover.phone_number || ''}"`,
          `"${formatDate(mover.move_effective_date)}"`,
          `"${mover.previous_address_line || ''}"`,
          `"${mover.previous_zip_code || ''}"`,
          `"${campaign.campaign_name}"`,
          `"${mover.melissa_address_key || ''}"`
        ].join(','));
      });

      // Create blob and download
      const csvContent = csvRows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);

      link.setAttribute('href', url);
      link.setAttribute('download', `${campaign.campaign_name.replace(/[^a-z0-9]/gi, '_')}_new_movers_data.csv`);
      link.style.visibility = 'hidden';

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.dismiss(loadingToast);

      // Show success message with deduplication info
      if (result.data.length !== uniqueMovers.length) {
        toast.success(`Exported ${uniqueMovers.length} unique new mover records (removed ${result.data.length - uniqueMovers.length} duplicates)`);
      } else {
        toast.success(`Exported ${uniqueMovers.length} new mover records successfully`);
      }
    } catch (error) {
      console.error('Error downloading new movers data:', error);
      toast.dismiss(loadingToast);
      toast.error('Failed to download new mover data');
    }
  };

  // Admin Action Handlers
  const handleApproveCampaign = async () => {
    if (!campaign) return;

    setActionLoading('approve');
    try {
      const adminId = await getCurrentAdminId();
      if (!adminId) {
        toast.error('Unable to identify admin user');
        return;
      }

      const result = await approveCampaign(campaignId, adminId);

      if (result.success) {
        // Show the detailed success message from the API
        toast.success(result.message || 'Campaign approved successfully', {
          duration: 6000, // Show for 6 seconds to read all details
          style: { whiteSpace: 'pre-line' } // Preserve line breaks
        });

        // Reload to show campaign status changes
        await loadCampaignDetails();
      } else {
        toast.error(result.error || 'Failed to approve campaign');
      }
    } catch (error) {
      console.error('Error approving campaign:', error);
      toast.error('Failed to approve campaign');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectCampaign = async () => {
    if (!campaign) return;
    if (!rejectReason.trim()) {
      toast.error('Please provide a reason for rejection');
      return;
    }

    setActionLoading('reject');
    try {
      const adminId = await getCurrentAdminId();
      if (!adminId) {
        toast.error('Unable to identify admin user');
        return;
      }

      const result = await rejectCampaign(campaignId, adminId, rejectReason);

      if (result.success) {
        toast.success('Campaign rejected');
        setShowRejectPrompt(false);
        setRejectReason('');
        await loadCampaignDetails(); // Reload to show updated status
      } else {
        toast.error(result.error || 'Failed to reject campaign');
      }
    } catch (error) {
      console.error('Error rejecting campaign:', error);
      toast.error('Failed to reject campaign');
    } finally {
      setActionLoading(null);
    }
  };

  const handlePauseCampaign = async () => {
    if (!campaign) return;
    if (!pauseReason.trim()) {
      toast.error('Please provide a reason for pausing');
      return;
    }

    setActionLoading('pause');
    try {
      const adminId = await getCurrentAdminId();
      if (!adminId) {
        toast.error('Unable to identify admin user');
        return;
      }

      const result = await pauseCampaign(campaignId, adminId, pauseReason);

      if (result.success) {
        toast.success('Campaign paused');
        setShowPausePrompt(false);
        setPauseReason('');
        await loadCampaignDetails(); // Reload to show updated status
      } else {
        toast.error(result.error || 'Failed to pause campaign');
      }
    } catch (error) {
      console.error('Error pausing campaign:', error);
      toast.error('Failed to pause campaign');
    } finally {
      setActionLoading(null);
    }
  };

  const handleResumeCampaign = async () => {
    if (!campaign) return;

    setActionLoading('resume');
    try {
      const adminId = await getCurrentAdminId();
      if (!adminId) {
        toast.error('Unable to identify admin user');
        return;
      }

      const result = await resumeCampaign(campaignId, adminId);

      if (result.success) {
        toast.success('Campaign resumed successfully');
        await loadCampaignDetails(); // Reload to show updated status
      } else {
        toast.error(result.error || 'Failed to resume campaign');
      }
    } catch (error) {
      console.error('Error resuming campaign:', error);
      toast.error('Failed to resume campaign');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteCampaign = async () => {
    if (!campaign) return;

    setActionLoading('delete');
    try {
      const adminId = await getCurrentAdminId();
      if (!adminId) {
        toast.error('Unable to identify admin user');
        return;
      }

      const result = await deleteCampaign(campaignId, adminId);

      if (result.success) {
        toast.success('Campaign deleted successfully');
        setShowDeleteConfirm(false);
        navigate('/admin/campaigns'); // Navigate back to campaigns list
      } else {
        toast.error(result.error || 'Failed to delete campaign');
      }
    } catch (error) {
      console.error('Error deleting campaign:', error);
      toast.error('Failed to delete campaign');
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Not set';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0);
  };

  const getStatusBadge = () => {
    const statusMap = {
      draft: { label: 'Draft', color: 'gray', icon: Clock },
      active: { label: 'Active', color: 'green', icon: CheckCircle },
      paused: { label: 'Paused', color: 'orange', icon: AlertCircle },
      completed: { label: 'Completed', color: 'blue', icon: CheckCircle },
      rejected: { label: 'Rejected', color: 'red', icon: AlertCircle }
    };

    const status = statusMap[campaign?.status] || statusMap.draft;
    const Icon = status.icon;

    return (
      <span className={`admin-details-status-badge badge-${status.color}`}>
        <Icon size={16} />
        {status.label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="admin-campaign-details">
        <div className="admin-details-loading">
          <div className="admin-details-spinner"></div>
          <p>Loading campaign details...</p>
        </div>
      </div>
    );
  }

  if (error || !campaign) {
    return (
      <div className="admin-campaign-details">
        <div className="admin-details-error">
          <AlertCircle size={48} />
          <h2>Unable to load campaign</h2>
          <p>{error || 'Campaign not found'}</p>
          <button onClick={handleClose} className="admin-details-btn-primary">
            Back to Campaigns
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-campaign-details">
      {/* Header */}
      <div className="admin-details-header">
        <div className="admin-details-header-content">
          <h1>{campaign.campaign_name}</h1>
          <div className="admin-details-header-meta">
            {getStatusBadge()}
            <span className="admin-details-separator">•</span>
            <PollingStatusBadge
              pollingEnabled={campaign.polling_enabled}
              lastPolledAt={campaign.last_polled_at}
              pollingFrequencyHours={campaign.polling_frequency_hours || 0.5}
              size="small"
            />
            <span className="admin-details-separator">•</span>
            <span className="admin-details-campaign-id">ID: {campaign.id.slice(0, 8)}</span>
          </div>
        </div>
        <button
          className="admin-details-close-btn"
          onClick={handleClose}
          title="Close"
        >
          <X size={24} />
        </button>
      </div>

      {/* Admin Actions */}
      <motion.div
        className="admin-actions-bar"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        {/* Approval Actions - Only for pending campaigns */}
        {campaign.approval_status === 'pending' && (
          <>
            <button
              className="admin-action-btn approve"
              onClick={handleApproveCampaign}
              disabled={actionLoading !== null}
            >
              <CheckCircle size={20} />
              {actionLoading === 'approve' ? 'Approving...' : 'Approve Campaign'}
            </button>
            <button
              className="admin-action-btn reject"
              onClick={() => setShowRejectPrompt(true)}
              disabled={actionLoading !== null}
            >
              <XCircle size={20} />
              Reject Campaign
            </button>
          </>
        )}

        {/* Pause/Resume - Only for active or paused campaigns */}
        {campaign.status === 'active' && (
          <button
            className="admin-action-btn pause"
            onClick={() => setShowPausePrompt(true)}
            disabled={actionLoading !== null}
          >
            <PauseCircle size={20} />
            Pause Campaign
          </button>
        )}

        {campaign.status === 'paused' && (
          <button
            className="admin-action-btn resume"
            onClick={handleResumeCampaign}
            disabled={actionLoading !== null}
          >
            <PlayCircle size={20} />
            {actionLoading === 'resume' ? 'Resuming...' : 'Resume Campaign'}
          </button>
        )}

        {/* Delete - Always available */}
        <button
          className="admin-action-btn delete"
          onClick={() => setShowDeleteConfirm(true)}
          disabled={actionLoading !== null}
        >
          <Trash2 size={20} />
          Delete Campaign
        </button>
      </motion.div>

      {/* Main Content Grid */}
      <div className="admin-details-grid">
        {/* Left Column - Preview & Files */}
        <div className="admin-details-left">
          {/* Postcard Preview */}
          <motion.div
            className="admin-details-card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <h3 className="admin-details-card-title">
              <Mail size={20} />
              Postcard Preview
            </h3>
            <div className="admin-details-preview-container">
              {campaign.postcard_preview_url ? (
                <img
                  src={campaign.postcard_preview_url}
                  alt="Postcard preview"
                  className="admin-details-preview-image"
                  onError={(e) => {
                    e.target.src = '/template-previews/poster-template-preview.png';
                  }}
                />
              ) : (
                <div className="admin-details-preview-placeholder">
                  <Mail size={48} />
                  <p>No preview available</p>
                </div>
              )}
            </div>
            <div className="admin-details-template-info">
              <span className="admin-details-label">Template:</span>
              <span className="admin-details-value">{campaign.template_name || 'Custom Template'}</span>
            </div>
            {campaign.postcard_preview_url && (
              <button
                className="admin-details-download-preview-btn"
                onClick={handleDownloadPreview}
              >
                <Download size={18} />
                Download Preview
              </button>
            )}
          </motion.div>

          {/* Design File */}
          <motion.div
            className="admin-details-card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <h3 className="admin-details-card-title">
              <Download size={20} />
              Design File
            </h3>
            {campaign.postcard_design_url ? (
              <button
                className="admin-details-download-btn"
                onClick={handleDownloadDesign}
              >
                <ExternalLink size={18} />
                View Design in Cloudinary
              </button>
            ) : (
              <p className="admin-details-no-file">No design file available</p>
            )}
          </motion.div>

          {/* Statistics */}
          <motion.div
            className="admin-details-card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <h3 className="admin-details-card-title">
              <CheckCircle size={20} />
              Campaign Statistics
            </h3>
            <div className="admin-details-stats-grid">
              <div className="admin-details-stat">
                <span className="admin-details-stat-value">{campaign.postcards_sent || 0}</span>
                <span className="admin-details-stat-label">Postcards Sent</span>
              </div>
              <div className="admin-details-stat">
                <span className="admin-details-stat-value">{campaign.postcards_delivered || 0}</span>
                <span className="admin-details-stat-label">Delivered</span>
              </div>
              <div className="admin-details-stat">
                <span className="admin-details-stat-value">{campaign.responses || 0}</span>
                <span className="admin-details-stat-label">Responses</span>
              </div>
              <div className="admin-details-stat">
                <span className="admin-details-stat-value">
                  {campaign.response_rate ? `${campaign.response_rate.toFixed(1)}%` : '0%'}
                </span>
                <span className="admin-details-stat-label">Response Rate</span>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Right Column - Details */}
        <div className="admin-details-right">
          {/* User & Company Info */}
          <motion.div
            className="admin-details-card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <h3 className="admin-details-card-title">
              <User size={20} />
              User & Company Information
            </h3>
            <div className="admin-details-info-list">
              <div className="admin-details-info-item">
                <User size={16} />
                <div>
                  <span className="admin-details-info-label">User Email</span>
                  <span className="admin-details-info-value">{campaign.user_email}</span>
                </div>
              </div>
              {campaign.user_name && (
                <div className="admin-details-info-item">
                  <User size={16} />
                  <div>
                    <span className="admin-details-info-label">User Name</span>
                    <span className="admin-details-info-value">{campaign.user_name}</span>
                  </div>
                </div>
              )}
              <div className="admin-details-info-item">
                <Building2 size={16} />
                <div>
                  <span className="admin-details-info-label">Company</span>
                  <span className="admin-details-info-value">{campaign.company_name}</span>
                </div>
              </div>
              {campaign.companies?.website && (
                <div className="admin-details-info-item">
                  <Globe size={16} />
                  <div>
                    <span className="admin-details-info-label">Website</span>
                    <a
                      href={campaign.companies.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="admin-details-info-link"
                    >
                      {campaign.companies.website}
                    </a>
                  </div>
                </div>
              )}
            </div>
          </motion.div>

          {/* Campaign Information */}
          <motion.div
            className="admin-details-card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <h3 className="admin-details-card-title">
              <Calendar size={20} />
              Campaign Information
            </h3>
            <div className="admin-details-info-list">
              <div className="admin-details-info-item">
                <Calendar size={16} />
                <div>
                  <span className="admin-details-info-label">Created</span>
                  <span className="admin-details-info-value">{formatDate(campaign.created_at)}</span>
                </div>
              </div>
              {campaign.launched_at && (
                <div className="admin-details-info-item">
                  <Calendar size={16} />
                  <div>
                    <span className="admin-details-info-label">Launched</span>
                    <span className="admin-details-info-value">{formatDate(campaign.launched_at)}</span>
                  </div>
                </div>
              )}
              <div className="admin-details-info-item">
                <DollarSign size={16} />
                <div>
                  <span className="admin-details-info-label">Total Cost</span>
                  <span className="admin-details-info-value">{formatCurrency(campaign.total_cost)}</span>
                </div>
              </div>
              <div className="admin-details-info-item">
                <DollarSign size={16} />
                <div>
                  <span className="admin-details-info-label">Price per Postcard</span>
                  <span className="admin-details-info-value">{formatCurrency(campaign.price_per_postcard || 3.00)}</span>
                </div>
              </div>
              <div className="admin-details-info-item">
                <CheckCircle size={16} />
                <div>
                  <span className="admin-details-info-label">Payment Status</span>
                  <span className={`admin-details-payment-badge payment-${campaign.payment_status}`}>
                    {campaign.payment_status || 'pending'}
                  </span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Targeting Information */}
          <motion.div
            className="admin-details-card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <h3 className="admin-details-card-title">
              <Target size={20} />
              Targeting Information
            </h3>
            <div className="admin-details-info-list">
              <div className="admin-details-info-item">
                <Target size={16} />
                <div>
                  <span className="admin-details-info-label">Targeting Type</span>
                  <span className="admin-details-info-value">
                    {(campaign.targeting_type === 'zip_codes' || campaign.targeting_type === 'zip') ? 'ZIP Codes' : 'Radius'}
                  </span>
                </div>
              </div>
              <div className="admin-details-info-item">
                <Mail size={16} />
                <div>
                  <span className="admin-details-info-label">Total Recipients</span>
                  <span className="admin-details-info-value">{campaign.total_recipients || 0}</span>
                </div>
              </div>
              {campaign.targeting_type === 'radius' && !['zip', 'zip_codes'].includes(campaign.targeting_type) && campaign.target_radius && (
                <div className="admin-details-info-item">
                  <MapPin size={16} />
                  <div>
                    <span className="admin-details-info-label">Radius</span>
                    <span className="admin-details-info-value">{campaign.target_radius} miles</span>
                  </div>
                </div>
              )}
            </div>

            {/* ZIP Codes */}
            {(campaign.targeting_type === 'zip_codes' || campaign.targeting_type === 'zip') && campaign.target_zip_codes && campaign.target_zip_codes.length > 0 && (
              <div className="admin-details-zip-codes">
                <span className="admin-details-zip-label">Target ZIP Codes ({campaign.target_zip_codes.length})</span>
                <div className="admin-details-zip-list">
                  {campaign.target_zip_codes.slice(0, 20).map((zip, index) => (
                    <span key={index} className="admin-details-zip-badge">
                      {zip}
                    </span>
                  ))}
                  {campaign.target_zip_codes.length > 20 && (
                    <span className="admin-details-zip-more">
                      +{campaign.target_zip_codes.length - 20} more
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Download New Mover Data - Only for ZIP code targeting */}
            {(campaign.targeting_type === 'zip_codes' || campaign.targeting_type === 'zip') && campaign.target_zip_codes && campaign.target_zip_codes.length > 0 && (
              <button
                className="admin-details-download-targeting-btn"
                onClick={handleDownloadNewMovers}
              >
                <Download size={18} />
                Download New Mover Data (CSV)
              </button>
            )}
          </motion.div>

          {/* Polling Information - New Section */}
          <motion.div
            className="admin-details-card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <h3 className="admin-details-card-title">
              <Clock size={20} />
              Polling Information
            </h3>
            <div className="admin-details-info-list">
              <div className="admin-details-info-item">
                <div style={{ width: '100%' }}>
                  <PollingStatusBadge
                    pollingEnabled={campaign.polling_enabled}
                    lastPolledAt={campaign.last_polled_at}
                    pollingFrequencyHours={campaign.polling_frequency_hours || 0.5}
                    size="medium"
                    showDetails={true}
                  />
                </div>
              </div>
              <div className="admin-details-info-item">
                <Mail size={16} />
                <div>
                  <span className="admin-details-info-label">Postcards Sent</span>
                  <span className="admin-details-info-value">{campaign.postcards_sent || 0}</span>
                </div>
              </div>
              <div className="admin-details-info-item">
                <DollarSign size={16} />
                <div>
                  <span className="admin-details-info-label">Total Charged</span>
                  <span className="admin-details-info-value">{formatCurrency(campaign.total_cost || 0)}</span>
                </div>
              </div>
            </div>
            <div style={{ marginTop: '16px', padding: '12px', background: '#F1F5F9', borderRadius: '8px', fontSize: '13px', color: '#475569' }}>
              <strong>How polling works:</strong>
              <ul style={{ marginTop: '8px', marginLeft: '20px', lineHeight: '1.6' }}>
                <li>System checks Melissa API every {campaign.polling_frequency_hours === 0.5 ? '30 minutes' : `${campaign.polling_frequency_hours || 0.5} hours`} for new movers</li>
                <li>When new movers are found, postcards are automatically sent via PostGrid</li>
                <li>You're charged $3.00 immediately when each postcard is sent</li>
              </ul>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Reject Prompt */}
      {showRejectPrompt && (
        <div className="admin-modal-overlay" onClick={() => setShowRejectPrompt(false)}>
          <motion.div
            className="admin-modal"
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <h3>Reject Campaign</h3>
            <p>Please provide a reason for rejecting this campaign:</p>
            <textarea
              placeholder="Enter rejection reason..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={4}
              autoFocus
            />
            <div className="admin-modal-actions">
              <button
                className="admin-modal-btn cancel"
                onClick={() => {
                  setShowRejectPrompt(false);
                  setRejectReason('');
                }}
                disabled={actionLoading === 'reject'}
              >
                Cancel
              </button>
              <button
                className="admin-modal-btn confirm reject"
                onClick={handleRejectCampaign}
                disabled={actionLoading === 'reject' || !rejectReason.trim()}
              >
                {actionLoading === 'reject' ? 'Rejecting...' : 'Reject Campaign'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Pause Prompt */}
      {showPausePrompt && (
        <div className="admin-modal-overlay" onClick={() => setShowPausePrompt(false)}>
          <motion.div
            className="admin-modal"
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <h3>Pause Campaign</h3>
            <p>Please provide a reason for pausing this campaign:</p>
            <textarea
              placeholder="Enter pause reason..."
              value={pauseReason}
              onChange={(e) => setPauseReason(e.target.value)}
              rows={4}
              autoFocus
            />
            <div className="admin-modal-actions">
              <button
                className="admin-modal-btn cancel"
                onClick={() => {
                  setShowPausePrompt(false);
                  setPauseReason('');
                }}
                disabled={actionLoading === 'pause'}
              >
                Cancel
              </button>
              <button
                className="admin-modal-btn confirm pause"
                onClick={handlePauseCampaign}
                disabled={actionLoading === 'pause' || !pauseReason.trim()}
              >
                {actionLoading === 'pause' ? 'Pausing...' : 'Pause Campaign'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="admin-modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <motion.div
            className="admin-modal"
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <div className="admin-modal-icon-warning">
              <AlertCircle size={48} />
            </div>
            <h3>Delete Campaign</h3>
            <p>
              Are you sure you want to delete <strong>{campaign.campaign_name}</strong>?
              This action cannot be undone.
            </p>
            <div className="admin-modal-actions">
              <button
                className="admin-modal-btn cancel"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={actionLoading === 'delete'}
              >
                Cancel
              </button>
              <button
                className="admin-modal-btn confirm delete"
                onClick={handleDeleteCampaign}
                disabled={actionLoading === 'delete'}
              >
                {actionLoading === 'delete' ? 'Deleting...' : 'Delete Campaign'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default AdminCampaignDetails;
