import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  FileText,
  Users,
  Mail,
  CheckCircle,
  Clock,
  AlertCircle,
  Activity
} from 'lucide-react';
import MetricCard from '../../components/admin/MetricCard';
import { adminStatsService, adminCampaignService, adminActivityService } from '../../supabase/api/adminService';
import './AdminDashboard.css';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [pendingCampaigns, setPendingCampaigns] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, []);

  // Scroll detection for sticky stats
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

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      // Load stats
      const statsResult = await adminStatsService.getDashboardStats();
      if (statsResult.success) {
        setStats(statsResult.stats);
      }

      // Load pending campaigns
      const campaignsResult = await adminCampaignService.getAllCampaigns({
        status: 'pending_approval'
      });
      if (campaignsResult.success) {
        setPendingCampaigns(campaignsResult.campaigns.slice(0, 5));
      }

      // Load recent activity
      const activityResult = await adminActivityService.getActivityLogs({ limit: 5 });
      if (activityResult.success) {
        setRecentActivity(activityResult.logs);
      }
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const getActionLabel = (action) => {
    const labels = {
      campaign_approved: 'Approved Campaign',
      campaign_rejected: 'Rejected Campaign',
      campaign_paused: 'Paused Campaign',
      campaign_deleted: 'Deleted Campaign',
      user_blocked: 'Blocked User',
      user_unblocked: 'Unblocked User',
      user_deleted: 'Deleted User',
      provider_connected: 'Connected Provider'
    };
    return labels[action] || action;
  };

  const getActionColor = (action) => {
    if (action.includes('approved') || action.includes('unblocked')) return 'success';
    if (action.includes('rejected') || action.includes('blocked') || action.includes('deleted')) return 'error';
    if (action.includes('paused')) return 'warning';
    return 'info';
  };

  return (
    <div className="admin-dashboard">

      {/* Sticky Stats Section */}
      <div className={`admin-sticky-top ${isScrolled ? 'scrolled' : ''}`}>
        {/* Metrics Grid */}
        <div className="admin-metrics-grid">
          <MetricCard
            title="Pending Approval"
            value={loading ? '...' : stats?.pending_campaigns || 0}
            icon={Clock}
            color="warning"
            loading={loading}
            onClick={() => navigate('/admin/campaigns?status=pending')}
          />
          <MetricCard
            title="Active Campaigns"
            value={loading ? '...' : stats?.active_campaigns || 0}
            icon={CheckCircle}
            color="success"
            loading={loading}
            onClick={() => navigate('/admin/campaigns?status=active')}
          />
          <MetricCard
            title="Total Users"
            value={loading ? '...' : stats?.total_users || 0}
            icon={Users}
            color="info"
            loading={loading}
            onClick={() => navigate('/admin/users')}
          />
          <MetricCard
            title="Postcards Sent"
            value={loading ? '...' : stats?.total_postcards_sent || 0}
            icon={Mail}
            color="primary"
            loading={loading}
          />
        </div>
      </div>

      {/* Content Grid */}
      <div className="admin-dashboard-grid">
        {/* Pending Campaigns */}
        <motion.div
          className="admin-dashboard-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="admin-card-header">
            <div className="admin-card-title">
              <FileText size={20} />
              <h2>Pending Campaigns</h2>
            </div>
            {pendingCampaigns.length > 0 && (
              <button
                className="admin-card-link"
                onClick={() => navigate('/admin/campaigns?status=pending')}
              >
                View All
              </button>
            )}
          </div>

          <div className="admin-card-content">
            {loading ? (
              <div className="admin-card-loading">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="admin-card-skeleton"></div>
                ))}
              </div>
            ) : pendingCampaigns.length === 0 ? (
              <div className="admin-empty-state">
                <CheckCircle size={32} />
                <p>No pending campaigns</p>
                <span>All campaigns have been reviewed</span>
              </div>
            ) : (
              <div className="admin-pending-list">
                {pendingCampaigns.map((campaign) => (
                  <motion.div
                    key={campaign.id}
                    className="admin-pending-item"
                    onClick={() => navigate(`/admin/campaigns/${campaign.id}`)}
                    whileHover={{ x: 4 }}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="admin-pending-info">
                      <div className="admin-pending-header">
                        <span className="admin-pending-name">{campaign.campaign_name}</span>
                        <span className="admin-pending-time">{formatDate(campaign.created_at)}</span>
                      </div>
                      <div className="admin-pending-meta">
                        <span className="admin-pending-company">{campaign.company_name}</span>
                        <span className="admin-pending-separator">•</span>
                        <span className="admin-pending-budget">${campaign.budget.toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="admin-pending-badge">
                      <Clock size={14} />
                      Pending
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </motion.div>

        {/* Recent Activity */}
        <motion.div
          className="admin-dashboard-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="admin-card-header">
            <div className="admin-card-title">
              <Activity size={20} />
              <h2>Recent Activity</h2>
            </div>
            {recentActivity.length > 0 && (
              <button
                className="admin-card-link"
                onClick={() => navigate('/admin/activity')}
              >
                View All
              </button>
            )}
          </div>

          <div className="admin-card-content">
            {loading ? (
              <div className="admin-card-loading">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="admin-card-skeleton"></div>
                ))}
              </div>
            ) : recentActivity.length === 0 ? (
              <div className="admin-empty-state">
                <Activity size={32} />
                <p>No recent activity</p>
                <span>Admin actions will appear here</span>
              </div>
            ) : (
              <div className="admin-activity-list">
                {recentActivity.map((log) => (
                  <motion.div
                    key={log.id}
                    className="admin-activity-item"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    <div className={`admin-activity-dot ${getActionColor(log.action_type)}`}></div>
                    <div className="admin-activity-content">
                      <p className="admin-activity-action">
                        {getActionLabel(log.action_type)}: <strong>{log.metadata?.campaign_name || log.target_type}</strong>
                      </p>
                      <span className="admin-activity-time">{formatDate(log.created_at)}</span>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default AdminDashboard;
