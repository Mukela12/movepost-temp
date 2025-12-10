import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Filter,
  Users as UsersIcon,
  Ban,
  CheckCircle,
  X,
  Check,
  ChevronDown,
  ChevronUp,
  Target,
  Briefcase,
  DollarSign,
  Calendar
} from 'lucide-react';
import { adminUserService } from '../../supabase/api/adminService';
import { blockUser, unblockUser, getUserCampaigns } from '../../supabase/api/adminUserActions';
import { getCurrentAdminId } from '../../supabase/api/adminActions';
import toast from 'react-hot-toast';
import './AdminUsers.css';

const AdminUsers = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [activeAction, setActiveAction] = useState(null); // { userId, action }
  const [actionReason, setActionReason] = useState('');
  const [expandedUser, setExpandedUser] = useState(null);
  const [userCampaigns, setUserCampaigns] = useState({});

  useEffect(() => {
    loadUsers();
  }, [searchQuery, statusFilter]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const result = await adminUserService.getAllUsers({
        search: searchQuery
      });

      if (result.success) {
        let filteredUsers = result.users;

        // Apply status filter
        if (statusFilter === 'active') {
          filteredUsers = filteredUsers.filter(u => !u.is_blocked);
        } else if (statusFilter === 'blocked') {
          filteredUsers = filteredUsers.filter(u => u.is_blocked);
        }

        setUsers(filteredUsers);
      }
    } catch (error) {
      console.error('Error loading users:', error);
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleExpandUser = async (userId) => {
    if (expandedUser === userId) {
      setExpandedUser(null);
      return;
    }

    setExpandedUser(userId);

    // Load user's campaigns if not already loaded
    if (!userCampaigns[userId]) {
      const result = await getUserCampaigns(userId);
      if (result.success) {
        setUserCampaigns(prev => ({
          ...prev,
          [userId]: result.campaigns
        }));
      }
    }
  };

  const handleBlockClick = (userId) => {
    setActiveAction({ userId, action: 'block' });
    setActionReason('');
  };

  const handleUnblockClick = (userId) => {
    setActiveAction({ userId, action: 'unblock' });
  };

  const handleCancelAction = () => {
    setActiveAction(null);
    setActionReason('');
  };

  const handleConfirmBlock = async (userId) => {
    if (!actionReason.trim()) {
      toast.error('Please enter a block reason');
      return;
    }

    try {
      const adminId = await getCurrentAdminId();
      if (!adminId) {
        toast.error('Authentication required');
        return;
      }

      const result = await blockUser(userId, adminId, actionReason);

      if (result.success) {
        toast.success('User blocked successfully');
        setActiveAction(null);
        setActionReason('');
        loadUsers();
      } else {
        toast.error(result.error || 'Failed to block user');
      }
    } catch (error) {
      console.error('Error blocking user:', error);
      toast.error('Failed to block user');
    }
  };

  const handleConfirmUnblock = async (userId) => {
    try {
      const adminId = await getCurrentAdminId();
      if (!adminId) {
        toast.error('Authentication required');
        return;
      }

      const result = await unblockUser(userId, adminId, 'Unblocked by admin');

      if (result.success) {
        toast.success('User unblocked successfully');
        setActiveAction(null);
        loadUsers();
      } else {
        toast.error(result.error || 'Failed to unblock user');
      }
    } catch (error) {
      console.error('Error unblocking user:', error);
      toast.error('Failed to unblock user');
    }
  };

  const getStatusBadge = (user) => {
    if (user.is_blocked) {
      return (
        <span className="admin-user-status-badge badge-error">
          <Ban size={14} />
          Blocked
        </span>
      );
    }
    return (
      <span className="admin-user-status-badge badge-success">
        <CheckCircle size={14} />
        Active
      </span>
    );
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

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0);
  };

  return (
    <div className="admin-users">
      <div className="admin-users-header">
        <div>
          <h1>Users</h1>
        </div>
      </div>

      {/* Filters */}
      <div className="admin-users-filters">
        <div className="admin-search-box">
          <Search size={18} />
          <input
            type="text"
            placeholder="Search users by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="admin-filter-tabs">
          {['all', 'active', 'blocked'].map((status) => (
            <button
              key={status}
              className={`admin-filter-tab ${statusFilter === status ? 'active' : ''}`}
              onClick={() => setStatusFilter(status)}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Users Table */}
      <div className="admin-users-table-container">
        {loading ? (
          <div className="admin-table-loading">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="admin-table-skeleton"></div>
            ))}
          </div>
        ) : users.length === 0 ? (
          <div className="admin-empty-state">
            <Filter size={48} />
            <h3>No users found</h3>
            <p>Try adjusting your filters or search query</p>
          </div>
        ) : (
          <div className="admin-users-table">
            {users.map((user) => {
              const isActionActive = activeAction?.userId === user.id;
              const isExpanded = expandedUser === user.id;
              const campaigns = userCampaigns[user.id] || [];

              return (
                <motion.div
                  key={user.id}
                  className="admin-user-row"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  {/* User Info - Grid Layout for Perfect Alignment */}
                  <div
                    className="admin-user-main"
                    onClick={() => navigate(`/admin/users/${user.id}`)}
                    style={{ cursor: 'pointer' }}
                  >
                    {/* Avatar - Grid Column 1 */}
                    <div className="admin-user-avatar">
                      {user.full_name?.charAt(0)?.toUpperCase() || 'U'}
                    </div>

                    {/* User Content */}
                    <div className="admin-user-content">
                      <div className="admin-user-header">
                        <h3 className="admin-user-name">{user.full_name}</h3>
                        {getStatusBadge(user)}
                      </div>
                      <span className="admin-user-email">{user.email}</span>

                      <div className="admin-user-stats">
                        <div className="admin-user-stat">
                          <Target size={16} />
                          <span className="admin-stat-label">Campaigns:</span>
                          <span className="admin-stat-value">{user.campaigns_count}</span>
                        </div>
                        <div className="admin-user-stat">
                          <CheckCircle size={16} />
                          <span className="admin-stat-label">Active:</span>
                          <span className="admin-stat-value">{user.active_campaigns}</span>
                        </div>
                        <div className="admin-user-stat">
                          <DollarSign size={16} />
                          <span className="admin-stat-label">Total Spent:</span>
                          <span className="admin-stat-value">{formatCurrency(user.total_spent)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions - Now on the RIGHT */}
                  <AnimatePresence mode="wait">
                    {isActionActive ? (
                      <motion.div
                        className="admin-inline-action"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                      >
                        {activeAction.action === 'block' && (
                          <div className="admin-confirm-box confirm-delete">
                            <label>Block Reason (required)</label>
                            <textarea
                              placeholder="Enter reason for blocking this user..."
                              value={actionReason}
                              onChange={(e) => setActionReason(e.target.value)}
                              rows={3}
                              autoFocus
                            />
                            <div className="admin-confirm-actions">
                              <button
                                className="admin-confirm-btn confirm danger"
                                onClick={() => handleConfirmBlock(user.id)}
                                disabled={!actionReason.trim()}
                              >
                                <Ban size={18} />
                                Block User
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

                        {activeAction.action === 'unblock' && (
                          <div className="admin-confirm-box confirm-approve">
                            <p>Unblock "{user.full_name}"?</p>
                            <div className="admin-confirm-actions">
                              <button
                                className="admin-confirm-btn confirm"
                                onClick={() => handleConfirmUnblock(user.id)}
                              >
                                <Check size={18} />
                                Unblock User
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
                      </motion.div>
                    ) : (
                      <motion.div
                        key="action-buttons"
                        className="admin-user-actions"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                      >
                        {!user.is_blocked ? (
                          <button
                            className="admin-action-btn block"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleBlockClick(user.id);
                            }}
                            title="Block user"
                          >
                            Block User
                          </button>
                        ) : (
                          <button
                            className="admin-action-btn unblock"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUnblockClick(user.id);
                            }}
                            title="Unblock user"
                          >
                            Unblock User
                          </button>
                        )}
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

export default AdminUsers;
