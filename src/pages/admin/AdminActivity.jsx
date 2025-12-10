import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  AlertCircle,
  Target,
  Users,
  ChevronDown,
  X
} from 'lucide-react';
import { adminActivityService } from '../../supabase/api/adminService';
import toast from 'react-hot-toast';
import './AdminActivity.css';

const AdminActivity = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [openDropdown, setOpenDropdown] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const searchTimeoutRef = useRef(null);
  const ITEMS_PER_PAGE = 50;

  // Debounce search input
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1); // Reset to first page on search
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  useEffect(() => {
    loadActivityLogs();
  }, [debouncedSearch, actionFilter, currentPage]);

  const loadActivityLogs = async () => {
    try {
      setLoading(true);
      const offset = (currentPage - 1) * ITEMS_PER_PAGE;

      const result = await adminActivityService.getActivityLogs({
        search: debouncedSearch,
        action_type: actionFilter !== 'all' ? actionFilter : undefined,
        limit: ITEMS_PER_PAGE,
        offset: offset
      });

      if (result.success) {
        setLogs(result.logs);
        setTotalCount(result.total || result.logs.length);
      }
    } catch (error) {
      console.error('Error loading activity logs:', error);
      toast.error('Failed to load activity logs');
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = async () => {
    try {
      // Fetch ALL logs matching current filters (no pagination for export)
      const result = await adminActivityService.getActivityLogs({
        search: debouncedSearch,
        action_type: actionFilter !== 'all' ? actionFilter : undefined,
        // No limit/offset - get all matching records
      });

      if (!result.success || result.logs.length === 0) {
        toast.error('No data to export');
        return;
      }

      const exportLogs = result.logs;

      toast.loading(`Exporting ${exportLogs.length} records...`);

      // Prepare CSV data
      const headers = ['Timestamp', 'Admin', 'Action', 'Target Type', 'Target ID', 'Details'];
      const rows = exportLogs.map(log => [
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

      toast.dismiss();
      toast.success(`Exported ${exportLogs.length} records successfully`);
    } catch (error) {
      toast.dismiss();
      toast.error('Failed to export activity log');
      console.error('Export error:', error);
    }
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

  // Categorized filter structure
  const filterCategories = [
    {
      id: 'all',
      label: 'All Actions',
      icon: <Filter size={18} />,
      filters: [{ value: 'all', label: 'All Actions' }]
    },
    {
      id: 'campaign',
      label: 'Campaign Actions',
      icon: <Target size={18} />,
      filters: [
        { value: 'campaign_approved', label: 'Approved' },
        { value: 'campaign_rejected', label: 'Rejected' },
        { value: 'campaign_paused', label: 'Paused' },
        { value: 'campaign_resumed', label: 'Resumed' },
        { value: 'campaign_deleted', label: 'Deleted' }
      ]
    },
    {
      id: 'user',
      label: 'User Actions',
      icon: <Users size={18} />,
      filters: [
        { value: 'user_blocked', label: 'Blocked' },
        { value: 'user_unblocked', label: 'Unblocked' }
      ]
    },
    {
      id: 'payment',
      label: 'Payment Actions',
      icon: <CreditCard size={18} />,
      filters: [
        { value: 'payment_method_added', label: 'Payment Added' },
        { value: 'payment_method_failed', label: 'Payment Failed' },
        { value: 'transaction_succeeded', label: 'Payment Success' },
        { value: 'transaction_failed', label: 'Payment Error' },
        { value: 'transaction_refunded', label: 'Refunds' },
        { value: 'polling_completed', label: 'Polling' }
      ]
    }
  ];

  const handleClearFilters = () => {
    setSearchQuery('');
    setActionFilter('all');
    setCategoryFilter('all');
    setCurrentPage(1);
    setOpenDropdown(null);
  };

  const handleCategoryClick = (categoryId) => {
    if (categoryId === 'all') {
      setActionFilter('all');
      setCategoryFilter('all');
      setCurrentPage(1);
      setOpenDropdown(null);
    } else {
      setOpenDropdown(openDropdown === categoryId ? null : categoryId);
    }
  };

  const handleActionFilterClick = (value, categoryId) => {
    setActionFilter(value);
    setCategoryFilter(categoryId);
    setCurrentPage(1);
    setOpenDropdown(null);
  };

  const getActiveFilterLabel = () => {
    if (actionFilter === 'all') return 'All Actions';

    for (const category of filterCategories) {
      const filter = category.filters.find(f => f.value === actionFilter);
      if (filter) {
        return `${category.label}: ${filter.label}`;
      }
    }
    return 'All Actions';
  };

  const hasActiveFilters = () => {
    return searchQuery !== '' || actionFilter !== 'all';
  };

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push('...');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      }
    }
    return pages;
  };

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

      {/* Compact Toolbar with Filters */}
      <div className="admin-activity-filters">
        <div className="admin-filters-left">
          <div className="admin-search-box">
            <Search size={18} />
            <input
              type="text"
              placeholder="Search activity logs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="admin-category-filters">
            {filterCategories.map((category) => (
              <div key={category.id} className="admin-category-filter-wrapper">
                <button
                  className={`admin-category-btn ${
                    (category.id === 'all' && actionFilter === 'all') ||
                    (category.id === categoryFilter && actionFilter !== 'all')
                      ? 'active'
                      : ''
                  }`}
                  onClick={() => handleCategoryClick(category.id)}
                >
                  {category.icon}
                  <span>{category.label}</span>
                  {category.id !== 'all' && <ChevronDown size={16} />}
                </button>

                {/* Dropdown Menu */}
                {category.id !== 'all' && openDropdown === category.id && (
                  <div className="admin-category-dropdown">
                    {category.filters.map((filter) => (
                      <button
                        key={filter.value}
                        className={`admin-dropdown-item ${
                          actionFilter === filter.value ? 'active' : ''
                        }`}
                        onClick={() => handleActionFilterClick(filter.value, category.id)}
                      >
                        {filter.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="admin-filters-right">
          {hasActiveFilters() && (
            <button className="admin-clear-filters-btn" onClick={handleClearFilters}>
              <X size={16} />
              Clear Filters
            </button>
          )}
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
          <>
            {/* Result Count */}
            <div className="admin-activity-results-info">
              <span className="results-count">
                Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1}-
                {Math.min(currentPage * ITEMS_PER_PAGE, totalCount)} of {totalCount} results
              </span>
              {actionFilter !== 'all' && (
                <span className="active-filter-label">
                  {getActiveFilterLabel()}
                </span>
              )}
            </div>

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

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="admin-pagination">
                <button
                  className="admin-pagination-btn"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  Previous
                </button>

                <div className="admin-pagination-numbers">
                  {getPageNumbers().map((page, index) => (
                    <React.Fragment key={index}>
                      {page === '...' ? (
                        <span className="admin-pagination-ellipsis">...</span>
                      ) : (
                        <button
                          className={`admin-pagination-number ${
                            currentPage === page ? 'active' : ''
                          }`}
                          onClick={() => handlePageChange(page)}
                        >
                          {page}
                        </button>
                      )}
                    </React.Fragment>
                  ))}
                </div>

                <button
                  className="admin-pagination-btn"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AdminActivity;
