import React from 'react';
import { motion } from 'framer-motion';
import { Radio, Pause, Clock } from 'lucide-react';
import './PollingStatusBadge.css';

/**
 * Polling Status Badge Component
 * Displays the current polling status of a campaign
 *
 * @param {boolean} pollingEnabled - Whether polling is enabled for this campaign
 * @param {string} lastPolledAt - ISO timestamp of last poll
 * @param {number} pollingFrequencyHours - How often the campaign is polled (in hours)
 * @param {string} size - Size variant: 'small', 'medium', 'large'
 * @param {boolean} showDetails - Whether to show additional details
 */
const PollingStatusBadge = ({
  pollingEnabled = false,
  lastPolledAt = null,
  pollingFrequencyHours = 6,
  size = 'medium',
  showDetails = false
}) => {
  const getTimeAgo = (timestamp) => {
    if (!timestamp) return 'Never';

    const now = new Date();
    const polled = new Date(timestamp);
    const diffMs = now - polled;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const getStatusConfig = () => {
    if (!pollingEnabled) {
      return {
        icon: Pause,
        text: 'Polling Disabled',
        className: 'polling-status-paused',
        color: '#94A3B8' // gray
      };
    }

    return {
      icon: Radio,
      text: 'Polling Active',
      className: 'polling-status-active',
      color: '#10B981' // green
    };
  };

  const status = getStatusConfig();
  const Icon = status.icon;

  return (
    <div className={`polling-status-badge polling-status-${size}`}>
      <motion.div
        className={`polling-status-container ${status.className}`}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2 }}
      >
        <div className="polling-status-main">
          <div className="polling-status-icon">
            <Icon size={size === 'small' ? 14 : size === 'large' ? 20 : 16} />
          </div>
          <span className="polling-status-text">{status.text}</span>
        </div>

        {showDetails && (
          <div className="polling-status-details">
            <div className="polling-detail-item">
              <Clock size={12} />
              <span className="polling-detail-label">Last polled:</span>
              <span className="polling-detail-value">{getTimeAgo(lastPolledAt)}</span>
            </div>
            {pollingEnabled && (
              <div className="polling-detail-item">
                <span className="polling-detail-label">Frequency:</span>
                <span className="polling-detail-value">Every {pollingFrequencyHours}h</span>
              </div>
            )}
          </div>
        )}
      </motion.div>

      {pollingEnabled && (
        <motion.div
          className="polling-status-pulse"
          animate={{
            scale: [1, 1.5, 1],
            opacity: [0.5, 0, 0.5],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          style={{ backgroundColor: status.color }}
        />
      )}
    </div>
  );
};

export default PollingStatusBadge;
