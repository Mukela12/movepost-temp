import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Filter,
  Download,
  Activity as ActivityIcon,
  CheckCircle,
  XCircle,
  Ban,
  PlayCircle,
  PauseCircle,
  Trash2,
  Link as LinkIcon,
  User,
  Calendar,
  Clock,
  RefreshCw,
  CreditCard,
  DollarSign,
  AlertCircle
} from 'lucide-react';
import { adminActivityService } from '../../supabase/api/adminService';
import toast from 'react-hot-toast';
import './AdminActivity.css';

const AdminActivity = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('all');

  useEffect(() => {
    loadActivityLogs();
  }, [searchQuery, actionFilter]);

  const loadActivityLogs = async () => {
    try {
      setLoading(true);
      const result = await adminActivityService.getActivityLogs({
        search: searchQuery,
        action_type: actionFilter
      });

      if (result.success) {
        setLogs(result.logs);
      }
    } catch (error) {
      console.error('Error loading activity logs:', error);
      toast.error('Failed to load activity logs');
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    if (logs.length === 0) {
      toast.error('No data to export');
      return;
    }

    // Prepare CSV data
    const headers = ['Timestamp', 'Admin', 'Action', 'Target Type', 'Target ID', 'Details'];
    const rows = logs.map(log => [
      formatDateTime(log.created_at),
      log.admin_name,
      formatActionType(log.action_type),
      log.target_type,
      log.target_id,
      JSON.stringify(log.metadata || {})
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    // Download CSV
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `activity_log_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success('Activity log exported successfully');
  };

  const getActionIcon = (actionType) => {
    const iconMap = {
      campaign_approved: <CheckCircle size={20} />,
      campaign_rejected: <XCircle size={20} />,
      campaign_paused: <PauseCircle size={20} />,
      campaign_resumed: <PlayCircle size={20} />,
      campaign_deleted: <Trash2 size={20} />,
      provider_connected: <LinkIcon size={20} />,
      user_blocked: <Ban size={20} />,
      user_unblocked: <CheckCircle size={20} />,
      polling_completed: <RefreshCw size={20} />,
      payment_method_added: <CreditCard size={20} />,
      payment_method_failed: <AlertCircle size={20} />,
      payment_method_default_changed: <CreditCard size={20} />,
      payment_method_removed: <Trash2 size={20} />,
      transaction_succeeded: <DollarSign size={20} />,
      transaction_failed: <XCircle size={20} />,
      transaction_refunded: <DollarSign size={20} />
    };

    return iconMap[actionType] || <ActivityIcon size={20} />;
  };

  const getActionColor = (actionType) => {
    const colorMap = {
      campaign_approved: 'success',
      campaign_rejected: 'error',
      campaign_paused: 'warning',
      campaign_resumed: 'success',
      campaign_deleted: 'error',
      provider_connected: 'info',
      user_blocked: 'error',
      user_unblocked: 'success',
      polling_completed: 'info',
      payment_method_added: 'success',
      payment_method_failed: 'error',
      payment_method_default_changed: 'info',
      payment_method_removed: 'warning',
      transaction_succeeded: 'success',
      transaction_failed: 'error',
      transaction_refunded: 'warning'
    };

    return colorMap[actionType] || 'default';
  };

  const formatActionType = (actionType) => {
    return actionType
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatTime = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getActionDetails = (log) => {
    const metadata = log.metadata || {};

    switch (log.action_type) {
      case 'campaign_approved':
        return `Approved campaign: ${metadata.campaign_name || 'Unnamed'}`;
      case 'campaign_rejected':
        return `Rejected campaign: ${metadata.campaign_name || 'Unnamed'}. Reason: ${metadata.reason || 'Not specified'}`;
      case 'campaign_paused':
        return `Paused campaign: ${metadata.campaign_name || 'Unnamed'}`;
      case 'campaign_resumed':
        return `Resumed campaign: ${metadata.campaign_name || 'Unnamed'}`;
      case 'campaign_deleted':
        return `Deleted campaign: ${metadata.campaign_name || 'Unnamed'}. Reason: ${metadata.reason || 'Not specified'}`;
      case 'provider_connected':
        return `Connected ${metadata.provider || 'provider'} for campaign: ${metadata.campaign_name || 'Unnamed'}`;
      case 'user_blocked':
        return `Blocked user. Reason: ${metadata.reason || 'Not specified'}`;
      case 'user_unblocked':
        return `Unblocked user. Reason: ${metadata.unblock_reason || 'Not specified'}`;
      case 'polling_completed':
        return `Polling completed: ${metadata.campaigns_processed || 0} campaigns processed, ${metadata.new_movers_discovered || 0} new movers discovered, ${metadata.postcards_sent || 0} postcards sent${metadata.errors_count > 0 ? `, ${metadata.errors_count} errors` : ''}`;
      case 'payment_method_added':
        return `Added payment method: ${metadata.card_brand?.toUpperCase() || 'Card'} ending in ${metadata.card_last4 || '****'}${metadata.is_default ? ' (set as default)' : ''}`;
      case 'payment_method_failed':
        return `Failed to add payment method: ${metadata.error || 'Unknown error'}`;
      case 'payment_method_default_changed':
        return `Changed default payment method to: ${metadata.card_brand?.toUpperCase() || 'Card'} ending in ${metadata.card_last4 || '****'}`;
      case 'payment_method_removed':
        return `Removed payment method: ${metadata.card_brand?.toUpperCase() || 'Card'} ending in ${metadata.card_last4 || '****'}`;
      case 'transaction_succeeded':
        return `Payment successful: $${metadata.amount_dollars?.toFixed(2) || '0.00'} for ${metadata.billing_reason?.replace(/_/g, ' ') || 'campaign'}${metadata.new_mover_count ? ` (${metadata.new_mover_count} postcards)` : ''}. ${metadata.payment_method_brand?.toUpperCase() || 'Card'} ${metadata.payment_method_last4 ? `ending in ${metadata.payment_method_last4}` : ''}`;
      case 'transaction_failed':
        return `Payment failed: $${metadata.amount_dollars?.toFixed(2) || '0.00'} for ${metadata.billing_reason?.replace(/_/g, ' ') || 'campaign'}. Error: ${metadata.failure_message || metadata.failure_code || 'Unknown error'}`;
      case 'transaction_refunded':
        return `Refund processed: $${metadata.refund_amount_dollars?.toFixed(2) || '0.00'} ${metadata.refund_status === 'partially_refunded' ? '(partial)' : ''} for original payment of $${metadata.original_amount_dollars?.toFixed(2) || '0.00'}`;
      default:
        return formatActionType(log.action_type);
    }
  };

  // Group logs by date
  const groupedLogs = logs.reduce((acc, log) => {
    const date = formatDate(log.created_at);
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(log);
    return acc;
  }, {});

  const actionTypes = [
    { value: 'all', label: 'All Actions' },
    { value: 'campaign_approved', label: 'Approved' },
    { value: 'campaign_rejected', label: 'Rejected' },
    { value: 'campaign_paused', label: 'Paused' },
    { value: 'campaign_resumed', label: 'Resumed' },
    { value: 'campaign_deleted', label: 'Deleted' },
    { value: 'user_blocked', label: 'User Blocked' },
    { value: 'user_unblocked', label: 'User Unblocked' },
    { value: 'polling_completed', label: 'Polling' },
    { value: 'payment_method_added', label: 'Payment Added' },
    { value: 'payment_method_failed', label: 'Payment Failed' },
    { value: 'transaction_succeeded', label: 'Payment Success' },
    { value: 'transaction_failed', label: 'Payment Error' },
    { value: 'transaction_refunded', label: 'Refunds' }
  ];

  return (
    <div className="admin-activity">
      <div className="admin-activity-header">
        <div>
          <h1>Activity Log</h1>
        </div>
        <button
          className="admin-export-btn"
          onClick={handleExportCSV}
          disabled={logs.length === 0}
        >
          <Download size={18} />
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="admin-activity-filters">
        <div className="admin-search-box">
          <Search size={18} />
          <input
            type="text"
            placeholder="Search activity logs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="admin-filter-tabs">
          {actionTypes.map((type) => (
            <button
              key={type.value}
              className={`admin-filter-tab ${actionFilter === type.value ? 'active' : ''}`}
              onClick={() => setActionFilter(type.value)}
            >
              {type.label}
            </button>
          ))}
        </div>
      </div>

      {/* Activity Timeline */}
      <div className="admin-activity-timeline-container">
        {loading ? (
          <div className="admin-table-loading">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="admin-table-skeleton"></div>
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div className="admin-empty-state">
            <Filter size={48} />
            <h3>No activity found</h3>
            <p>Try adjusting your filters or search query</p>
          </div>
        ) : (
          <div className="admin-activity-timeline">
            {Object.entries(groupedLogs).map(([date, dateLogs]) => (
              <div key={date} className="admin-activity-date-group">
                <div className="admin-activity-date-header">
                  <Calendar size={18} />
                  <span>{date}</span>
                </div>

                <div className="admin-activity-items">
                  {dateLogs.map((log) => (
                    <motion.div
                      key={log.id}
                      className={`admin-activity-item action-${getActionColor(log.action_type)}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                    >
                      <div className="activity-item-icon">
                        {getActionIcon(log.action_type)}
                      </div>

                      <div className="activity-item-content">
                        <div className="activity-item-header">
                          <div className="activity-item-title">
                            <span className="activity-action-type">
                              {formatActionType(log.action_type)}
                            </span>
                            <span className="activity-item-time">
                              <Clock size={14} />
                              {formatTime(log.created_at)}
                            </span>
                          </div>
                        </div>

                        <p className="activity-item-description">
                          {getActionDetails(log)}
                        </p>

                        <div className="activity-item-meta">
                          <span className="activity-meta-item">
                            <User size={14} />
                            {log.admin_name}
                          </span>
                          <span className="activity-meta-item activity-target">
                            Target: {log.target_type} #{log.target_id}
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminActivity;
