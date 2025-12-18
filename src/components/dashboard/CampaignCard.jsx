import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Trash2, Copy, Edit, CheckCircle, Clock, XCircle, FileEdit, Eye, AlertCircle } from 'lucide-react';
import './CampaignCard.css';

const CampaignCard = ({ campaign, onToggleStatus, onEdit, onDelete, onDuplicate }) => {
  const navigate = useNavigate();
  // Get approval status badge info
  const getApprovalBadge = () => {
    const approval = campaign.approvalStatus || campaign.status;
    switch (approval) {
      case 'active':
      case 'approved':
        return { text: 'Active', className: 'approval-active', Icon: CheckCircle };
      case 'pending_review':
      case 'pending':
        return { text: 'Pending Review', className: 'approval-pending', Icon: Clock };
      case 'rejected':
        return { text: 'Rejected', className: 'approval-rejected', Icon: XCircle };
      case 'draft':
        return { text: 'Draft', className: 'approval-draft', Icon: FileEdit };
      default:
        return { text: campaign.status, className: 'approval-default', Icon: CheckCircle };
    }
  };

  const approvalBadge = getApprovalBadge();
  const BadgeIcon = approvalBadge.Icon;

  return (
    <motion.div
      className="campaign-card"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      whileHover={{ y: -4, boxShadow: "0 12px 24px rgba(0, 0, 0, 0.15)" }}
    >
      <div className="campaign-card-header">
        <div className="campaign-status-section">
          <div className="toggle-wrapper">
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={campaign.isActive}
                onChange={() => onToggleStatus(campaign.id)}
                disabled={campaign.approvalStatus === 'pending_review'}
              />
              <span className="toggle-slider"></span>
            </label>
            <span className="status-text">
              {campaign.isActive ? 'Active' : 'Paused'}
            </span>
          </div>
          <span className={`approval-badge ${approvalBadge.className}`}>
            <BadgeIcon className="badge-icon" size={14} />
            {approvalBadge.text}
          </span>
        </div>
      </div>

      <h3 className="campaign-title">{campaign.name}</h3>

      <div className="campaign-image-container">
        <img
          src={campaign.image}
          alt={campaign.name}
          className="campaign-image"
        />
      </div>

      {campaign.status === 'draft' && campaign.paymentStatus === 'pending' && (
        <div className="campaign-payment-warning">
          <AlertCircle size={14} />
          <span>Payment Required to Activate</span>
        </div>
      )}

      <div className="campaign-actions">
        <motion.button
          className="view-details-button"
          onClick={() => navigate(`/campaign/${campaign.id}/details`)}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <Eye size={18} />
          View Details
        </motion.button>
        <div className="action-buttons">
          <motion.button
            className="icon-button edit"
            onClick={() => onEdit(campaign.id)}
            title="Edit"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <Edit size={18} />
          </motion.button>
          <motion.button
            className="icon-button duplicate"
            onClick={() => onDuplicate(campaign.id)}
            title="Duplicate"
            whileHover={{ scale: 1.1, rotate: -5 }}
            whileTap={{ scale: 0.9 }}
          >
            <Copy size={18} />
          </motion.button>
          <motion.button
            className="icon-button delete"
            onClick={() => onDelete(campaign.id)}
            title="Delete"
            whileHover={{ scale: 1.1, rotate: 5 }}
            whileTap={{ scale: 0.9 }}
          >
            <Trash2 size={18} />
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
};

export default CampaignCard;