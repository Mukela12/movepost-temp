import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  DollarSign,
  Download,
  Search,
  TrendingUp,
  CreditCard,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Calendar,
  TestTube
} from 'lucide-react';
import toast from 'react-hot-toast';
import ConfirmationModal from '../../components/common/ConfirmationModal';
import MetricCard from '../../components/admin/MetricCard';
import { adminTransactionService } from '../../supabase/api/adminService';
import './AdminTransactions.css';

const AdminTransactions = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [transactions, setTransactions] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  // Refund modal state
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [transactionToRefund, setTransactionToRefund] = useState(null);
  const [isRefunding, setIsRefunding] = useState(false);

  // Filters
  const [filters, setFilters] = useState({
    status: searchParams.get('status') || '',
    dateFrom: searchParams.get('dateFrom') || '',
    dateTo: searchParams.get('dateTo') || '',
    isTestMode: searchParams.get('testMode') === 'true' ? true : searchParams.get('testMode') === 'false' ? false : undefined,
    search: searchParams.get('search') || '',
    limit: 50,
    offset: 0
  });

  const [pagination, setPagination] = useState({
    total: 0,
    currentPage: 1,
    pageSize: 50
  });

  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    loadTransactions();
    loadStats();
  }, [filters.status, filters.dateFrom, filters.dateTo, filters.isTestMode, filters.offset]);

  // Scroll detection for collapsible filters
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;

      if (scrollTop > 50) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const loadTransactions = async () => {
    try {
      setLoading(true);

      const result = await adminTransactionService.getTransactions(filters);

      if (result.success) {
        setTransactions(result.transactions);
        setPagination({
          ...pagination,
          total: result.total,
          currentPage: Math.floor(filters.offset / filters.limit) + 1
        });
      } else {
        toast.error(result.error || 'Failed to load transactions');
      }
    } catch (error) {
      console.error('Error loading transactions:', error);
      toast.error('Error loading transactions');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const result = await adminTransactionService.getRevenueStats({
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
        isTestMode: filters.isTestMode
      });

      if (result.success) {
        setStats(result.stats);
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const handleFilterChange = (key, value) => {
    const newFilters = { ...filters, [key]: value, offset: 0 };
    setFilters(newFilters);

    // Update URL params
    const params = new URLSearchParams();
    if (value) params.set(key === 'isTestMode' ? 'testMode' : key, value);
    setSearchParams(params);
  };

  const handleExportCSV = async () => {
    try {
      setExporting(true);

      const result = await adminTransactionService.exportTransactionsCSV({
        status: filters.status,
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
        isTestMode: filters.isTestMode
      });

      if (result.success) {
        // Create download link
        const blob = new Blob([result.csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `transactions_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        toast.success('Transactions exported successfully');
      } else {
        toast.error(result.error || 'Failed to export transactions');
      }
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Error exporting transactions');
    } finally {
      setExporting(false);
    }
  };

  const handleRefund = (transaction) => {
    setTransactionToRefund(transaction);
    setShowRefundModal(true);
  };

  const confirmRefund = async () => {
    if (!transactionToRefund) return;

    const reason = window.prompt('Enter refund reason (required):');
    if (!reason || reason.trim() === '') {
      toast.error('Refund reason is required');
      return;
    }

    try {
      setIsRefunding(true);
      const result = await adminTransactionService.refundTransaction(transactionToRefund.id, reason);

      if (result.success) {
        toast.success('Transaction refunded successfully');
        loadTransactions();
        loadStats();
      } else {
        toast.error(result.error || 'Failed to refund transaction');
      }
    } catch (error) {
      console.error('Refund error:', error);
      toast.error('Error processing refund');
    } finally {
      setIsRefunding(false);
      setShowRefundModal(false);
      setTransactionToRefund(null);
    }
  };

  const handlePageChange = (newPage) => {
    const newOffset = (newPage - 1) * pagination.pageSize;
    setFilters({ ...filters, offset: newOffset });
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatCurrency = (cents) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  const getStatusColor = (status) => {
    const colors = {
      succeeded: 'success',
      processing: 'warning',
      failed: 'error',
      refunded: 'info'
    };
    return colors[status] || 'default';
  };

  const getStatusIcon = (status) => {
    const icons = {
      succeeded: CheckCircle,
      processing: Clock,
      failed: XCircle,
      refunded: RefreshCw
    };
    return icons[status] || AlertTriangle;
  };

  const getBillingReasonLabel = (reason) => {
    const labels = {
      campaign_approval: 'Campaign Approval',
      new_mover_addition: 'New Mover Addition',
      manual_charge: 'Manual Charge',
      retry: 'Payment Retry'
    };
    return labels[reason] || reason;
  };

  const totalPages = Math.ceil(pagination.total / pagination.pageSize);

  return (
    <div className="admin-transactions">
      <div className="admin-transactions-header">

        <div className="admin-transactions-actions">
          <motion.button
            className="admin-btn admin-btn-primary"
            onClick={handleExportCSV}
            disabled={exporting}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Download size={18} />
            {exporting ? 'Exporting...' : 'Export CSV'}
          </motion.button>
        </div>
      </div>

      {/* Sticky Stats Section */}
      <div className={`admin-sticky-top ${isScrolled ? 'scrolled' : ''}`}>
        {/* Stats Cards */}
        <div className="admin-metrics-grid">
          <MetricCard
            title="Successful Payments"
            value={stats ? stats.successful_count || 0 : '...'}
            icon={CheckCircle}
            color="success"
            loading={!stats}
          />
          <MetricCard
            title="Failed Payments"
            value={stats ? stats.failed_count || 0 : '...'}
            icon={XCircle}
            color="error"
            loading={!stats}
          />
          <MetricCard
            title="Processing"
            value={stats ? stats.processing_count || 0 : '...'}
            icon={Clock}
            color="warning"
            loading={!stats}
          />
        </div>

        {/* Test Mode Indicator */}
        {filters.isTestMode === true && (
          <motion.div
            className="admin-test-mode-banner"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <TestTube size={20} />
            <span>Showing TEST MODE transactions only</span>
            <button onClick={() => handleFilterChange('isTestMode', undefined)}>
              Show All
            </button>
          </motion.div>
        )}

        {filters.isTestMode === false && (
          <motion.div
            className="admin-live-mode-banner"
            style={{ backgroundColor: '#10b981', color: 'white', padding: '12px 20px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <TestTube size={20} />
            <span>Showing LIVE MODE transactions only</span>
            <button
              onClick={() => handleFilterChange('isTestMode', undefined)}
              style={{ marginLeft: 'auto', padding: '6px 12px', background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '4px', color: 'white', cursor: 'pointer' }}
            >
              Show All
            </button>
          </motion.div>
        )}
      </div>

      {/* Filters Panel - Always visible, collapses on scroll */}
      <div className={`admin-filters-panel ${isScrolled ? 'collapsed' : ''}`}>
        <div className="admin-filters-grid">
          <div className="admin-filter-group">
            <label>Status</label>
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="succeeded">Succeeded</option>
              <option value="processing">Processing</option>
              <option value="failed">Failed</option>
              <option value="refunded">Refunded</option>
            </select>
          </div>

          <div className="admin-filter-group">
            <label>Date From</label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
            />
          </div>

          <div className="admin-filter-group">
            <label>Date To</label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => handleFilterChange('dateTo', e.target.value)}
            />
          </div>

          <div className="admin-filter-group">
            <label>Mode</label>
            <select
              value={filters.isTestMode === undefined ? '' : filters.isTestMode.toString()}
              onChange={(e) => {
                const value = e.target.value === '' ? undefined : e.target.value === 'true';
                handleFilterChange('isTestMode', value);
              }}
            >
              <option value="">All Modes</option>
              <option value="true">Test Mode</option>
              <option value="false">Live Mode</option>
            </select>
          </div>
        </div>

        <button
          className="admin-filters-clear"
          onClick={() => {
            setFilters({
              ...filters,
              status: '',
              dateFrom: '',
              dateTo: '',
              isTestMode: undefined,
              search: '',
              offset: 0
            });
            setSearchParams({});
          }}
        >
          Clear Filters
        </button>
      </div>

      {/* Transactions Table */}
      <motion.div
        className="admin-transactions-card"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="admin-transactions-table-container">
          {loading ? (
            <div className="admin-card-loading">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="admin-card-skeleton"></div>
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <div className="admin-empty-state">
              <CreditCard size={48} />
              <p>No transactions found</p>
              <span>Transactions will appear here as payments are processed</span>
            </div>
          ) : (
            <>
              <table className="admin-transactions-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>User</th>
                    <th>Campaign</th>
                    <th>Amount</th>
                    <th>Reason</th>
                    <th>Payment Method</th>
                    <th>Status</th>
                    <th>Mode</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => {
                    const StatusIcon = getStatusIcon(tx.status);

                    return (
                      <motion.tr
                        key={tx.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        whileHover={{ backgroundColor: 'rgba(0, 0, 0, 0.02)' }}
                      >
                        <td className="admin-tx-date">
                          {formatDate(tx.created_at)}
                        </td>

                        <td className="admin-tx-user">
                          <div className="admin-tx-user-info">
                            <span className="admin-tx-user-name">
                              {tx.profile?.full_name || 'Unknown'}
                            </span>
                            <span className="admin-tx-user-email">
                              {tx.profile?.email}
                            </span>
                          </div>
                        </td>

                        <td className="admin-tx-campaign">
                          {tx.campaigns?.campaign_name ? (
                            <button
                              className="admin-tx-link"
                              onClick={() => navigate(`/admin/campaigns/${tx.campaign_id}`)}
                            >
                              {tx.campaigns.campaign_name}
                            </button>
                          ) : (
                            <span className="admin-tx-no-campaign">—</span>
                          )}
                        </td>

                        <td className="admin-tx-amount">
                          <strong>{formatCurrency(tx.amount_cents)}</strong>
                          {tx.new_mover_count > 0 && (
                            <span className="admin-tx-meta">
                              {tx.new_mover_count} postcards
                            </span>
                          )}
                        </td>

                        <td className="admin-tx-reason">
                          {getBillingReasonLabel(tx.billing_reason)}
                        </td>

                        <td className="admin-tx-payment-method">
                          {tx.payment_method_brand && tx.payment_method_last4 ? (
                            <div className="admin-tx-card">
                              <CreditCard size={14} />
                              <span>
                                {tx.payment_method_brand} ••••{tx.payment_method_last4}
                              </span>
                            </div>
                          ) : (
                            <span className="admin-tx-no-method">—</span>
                          )}
                        </td>

                        <td className="admin-tx-status">
                          <div className={`admin-status-badge status-${getStatusColor(tx.status)}`}>
                            <StatusIcon size={14} />
                            {tx.status}
                          </div>
                          {tx.failure_message && (
                            <span className="admin-tx-error" title={tx.failure_message}>
                              {tx.failure_code}
                            </span>
                          )}
                        </td>

                        <td className="admin-tx-mode">
                          {tx.is_test_mode ? (
                            <span className="admin-tx-mode-test">
                              <TestTube size={14} />
                              Test
                            </span>
                          ) : (
                            <span className="admin-tx-mode-live">Live</span>
                          )}
                        </td>

                        <td className="admin-tx-actions">
                          <div className="admin-tx-actions-group">
                            {tx.receipt_url && (
                              <button
                                className="admin-tx-action-btn"
                                onClick={() => window.open(tx.receipt_url, '_blank')}
                                title="View Receipt"
                              >
                                <ExternalLink size={16} />
                              </button>
                            )}

                            {tx.status === 'succeeded' && !tx.refunded_at && (
                              <button
                                className="admin-tx-action-btn admin-tx-action-refund"
                                onClick={() => handleRefund(tx)}
                                title="Refund"
                              >
                                <RefreshCw size={16} />
                              </button>
                            )}

                            {tx.stripe_payment_intent_id && (
                              <button
                                className="admin-tx-action-btn"
                                onClick={() => {
                                  const mode = tx.is_test_mode ? 'test' : '';
                                  window.open(
                                    `https://dashboard.stripe.com/${mode}/payments/${tx.stripe_payment_intent_id}`,
                                    '_blank'
                                  );
                                }}
                                title="View in Stripe"
                              >
                                <ExternalLink size={16} />
                                Stripe
                              </button>
                            )}
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="admin-pagination">
                  <button
                    className="admin-pagination-btn"
                    onClick={() => handlePageChange(pagination.currentPage - 1)}
                    disabled={pagination.currentPage === 1}
                  >
                    Previous
                  </button>

                  <span className="admin-pagination-info">
                    Page {pagination.currentPage} of {totalPages}
                    <span className="admin-pagination-total">
                      ({pagination.total} total)
                    </span>
                  </span>

                  <button
                    className="admin-pagination-btn"
                    onClick={() => handlePageChange(pagination.currentPage + 1)}
                    disabled={pagination.currentPage === totalPages}
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </motion.div>

      <ConfirmationModal
        isOpen={showRefundModal}
        onClose={() => {
          setShowRefundModal(false);
          setTransactionToRefund(null);
        }}
        onConfirm={confirmRefund}
        title="Refund Transaction"
        message={
          transactionToRefund ? (
            <>
              Are you sure you want to refund this transaction of{' '}
              <strong>${(transactionToRefund.amount / 100).toFixed(2)}</strong>?
              This action cannot be undone.
            </>
          ) : (
            'Are you sure you want to refund this transaction? This action cannot be undone.'
          )
        }
        confirmText="Refund Transaction"
        cancelText="Cancel"
        severity="warning"
        isLoading={isRefunding}
        loadingText="Refunding..."
      />
    </div>
  );
};

export default AdminTransactions;
