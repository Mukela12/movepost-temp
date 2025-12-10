// Admin Service - Real Database Queries
// Phase 1: Fetches real data from Supabase
// Phase 2: Will add write operations after database schema updates

import { supabase } from '../integration/client';

// ============================================
// CAMPAIGN QUERIES (READ-ONLY)
// ============================================

export const adminCampaignService = {
  // Get all campaigns with company/user info
  getAllCampaigns: async (filters = {}) => {
    try {
      let query = supabase
        .from('campaigns')
        .select(`
          *,
          companies (
            name,
            logo_url,
            website,
            business_category
          )
        `)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      // Apply filters
      if (filters.status && filters.status !== 'all') {
        if (filters.status === 'pending_approval' || filters.status === 'pending') {
          // Filter by approval_status column - include NULL and 'pending'
          // Campaigns with NULL approval_status are considered pending
          query = query.or('approval_status.eq.pending,approval_status.is.null');
        } else {
          query = query.eq('status', filters.status);
        }
      }

      // Apply search
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        query = query.or(`campaign_name.ilike.%${searchLower}%,companies.name.ilike.%${searchLower}%`);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching campaigns:', error);
        return { success: false, error: error.message };
      }

      // Fetch all user profiles in one query to avoid N+1 problem
      const userIds = [...new Set(data.map(c => c.user_id).filter(Boolean))];

      const { data: allProfiles } = await supabase
        .from('profile')
        .select('user_id, email, full_name')
        .in('user_id', userIds);

      // Create a lookup map for O(1) access
      const profileMap = (allProfiles || []).reduce((acc, profile) => {
        acc[profile.user_id] = profile;
        return acc;
      }, {});

      // Transform data with user info and calculate target_audience
      const campaignsWithUserInfo = data.map((campaign) => {
        const profileData = profileMap[campaign.user_id];

        // Calculate target_audience for display
        let target_audience = 'Not set';
        if (campaign.targeting_type === 'zip_codes' || campaign.targeting_type === 'zip') {
          const zipCount = campaign.target_zip_codes?.length || 0;
          if (zipCount > 0) {
            target_audience = zipCount === 1
              ? `ZIP: ${campaign.target_zip_codes[0]}`
              : `${zipCount} ZIP codes`;
          }
        }

        return {
          ...campaign,
          company_name: campaign.companies?.name || 'Unknown Company',
          user_email: profileData?.email || 'user@example.com',
          user_name: profileData?.full_name || 'Unknown User',
          // Use real approval_status from database (Phase 2)
          approval_status: campaign.approval_status || 'pending',
          // Map total_cost to budget for UI compatibility
          budget: campaign.total_cost || 0,
          target_audience
        };
      });

      return {
        success: true,
        campaigns: campaignsWithUserInfo,
        total: campaignsWithUserInfo.length
      };
    } catch (error) {
      console.error('Error in getAllCampaigns:', error);
      return { success: false, error: error.message };
    }
  },

  // Get single campaign by ID
  getCampaignById: async (campaignId) => {
    try {
      const { data, error } = await supabase
        .from('campaigns')
        .select(`
          *,
          companies (
            name,
            logo_url,
            logo_icon_url,
            website,
            business_category,
            primary_color,
            secondary_color
          )
        `)
        .eq('id', campaignId)
        .is('deleted_at', null)
        .single();

      if (error) {
        console.error('Error fetching campaign:', error);
        return { success: false, error: error.message };
      }

      // Fetch user email from profile table
      const { data: profileData } = await supabase
        .from('profile')
        .select('email, full_name')
        .eq('user_id', data.user_id)
        .maybeSingle();

      const campaign = {
        ...data,
        company_name: data.companies?.name || 'Unknown Company',
        user_email: profileData?.email || 'user@example.com',
        user_name: profileData?.full_name || 'Unknown User',
        // Use real approval_status from database (Phase 2)
        approval_status: data.approval_status || 'pending',
        // Map total_cost to budget for UI compatibility
        budget: data.total_cost || 0
      };

      return { success: true, campaign };
    } catch (error) {
      console.error('Error in getCampaignById:', error);
      return { success: false, error: error.message };
    }
  }
};

// ============================================
// USER QUERIES (READ-ONLY)
// ============================================

export const adminUserService = {
  // Get all users with campaign counts
  getAllUsers: async (filters = {}) => {
    try {
      // Get all campaigns grouped by user
      const { data: campaigns, error: campaignError } = await supabase
        .from('campaigns')
        .select('user_id, status, total_cost')
        .is('deleted_at', null);

      if (campaignError) {
        console.error('Error fetching campaigns:', campaignError);
        return { success: false, error: campaignError.message };
      }

      // Aggregate by user
      const userStats = campaigns.reduce((acc, campaign) => {
        if (!acc[campaign.user_id]) {
          acc[campaign.user_id] = {
            campaigns_count: 0,
            active_campaigns: 0,
            total_spent: 0
          };
        }
        acc[campaign.user_id].campaigns_count++;
        if (campaign.status === 'active') {
          acc[campaign.user_id].active_campaigns++;
        }
        acc[campaign.user_id].total_spent += campaign.total_cost || 0;
        return acc;
      }, {});

      // Get user details from profile table
      const { data: profiles, error: profilesError } = await supabase
        .from('profile')
        .select('user_id, email, full_name, is_blocked, blocked_at, block_reason');

      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
        return { success: false, error: profilesError.message };
      }

      // Combine data
      const usersWithStats = profiles.map(profile => ({
        id: profile.user_id,
        email: profile.email,
        full_name: profile.full_name || profile.email?.split('@')[0] || 'Unknown',
        created_at: new Date().toISOString(), // Will get from auth in Phase 2
        last_sign_in_at: null, // Will get from auth in Phase 2
        is_blocked: profile.is_blocked || false,
        blocked_at: profile.blocked_at,
        block_reason: profile.block_reason,
        campaigns_count: userStats[profile.user_id]?.campaigns_count || 0,
        active_campaigns: userStats[profile.user_id]?.active_campaigns || 0,
        total_spent: userStats[profile.user_id]?.total_spent || 0,
        status: profile.is_blocked ? 'blocked' : 'active'
      }));

      // Apply filters
      let filteredUsers = usersWithStats;

      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        filteredUsers = filteredUsers.filter(u =>
          u.full_name.toLowerCase().includes(searchLower) ||
          u.email.toLowerCase().includes(searchLower)
        );
      }

      return {
        success: true,
        users: filteredUsers,
        total: filteredUsers.length
      };
    } catch (error) {
      console.error('Error in getAllUsers:', error);
      return { success: false, error: error.message };
    }
  },

  // Get user by ID
  getUserById: async (userId) => {
    try {
      // Get user from profile table
      const { data: profile, error } = await supabase
        .from('profile')
        .select('user_id, email, full_name, is_blocked, blocked_at, blocked_by, block_reason')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching user profile:', error);
        return { success: false, error: error.message };
      }

      // Get user's campaigns
      const { data: campaigns } = await supabase
        .from('campaigns')
        .select('status, total_cost')
        .eq('user_id', userId)
        .is('deleted_at', null);

      const stats = (campaigns || []).reduce((acc, campaign) => {
        acc.campaigns_count++;
        if (campaign.status === 'active') acc.active_campaigns++;
        acc.total_spent += campaign.total_cost || 0;
        return acc;
      }, { campaigns_count: 0, active_campaigns: 0, total_spent: 0 });

      return {
        success: true,
        user: {
          id: profile.user_id,
          email: profile.email,
          full_name: profile.full_name || profile.email?.split('@')[0] || 'Unknown',
          created_at: new Date().toISOString(), // Will get from auth in Phase 2
          last_sign_in_at: null, // Will get from auth in Phase 2
          is_blocked: profile.is_blocked || false,
          blocked_reason: profile.block_reason,
          ...stats
        }
      };
    } catch (error) {
      console.error('Error in getUserById:', error);
      return { success: false, error: error.message };
    }
  },

  // Get user campaigns with company info
  getUserCampaigns: async (userId) => {
    try {
      const { data, error } = await supabase
        .from('campaigns')
        .select(`
          *,
          companies (
            name,
            logo_url
          )
        `)
        .eq('user_id', userId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching user campaigns:', error);
        return { success: false, error: error.message };
      }

      const campaigns = data.map(campaign => ({
        ...campaign,
        company_name: campaign.companies?.name || 'Unknown Company',
        zip_codes: campaign.target_zip_codes || [],
        budget: campaign.total_cost || 0
      }));

      return {
        success: true,
        campaigns
      };
    } catch (error) {
      console.error('Error in getUserCampaigns:', error);
      return { success: false, error: error.message };
    }
  },

  // Block user
  blockUser: async (userId, reason = 'Blocked by admin') => {
    try {
      const { error } = await supabase
        .from('profile')
        .update({
          is_blocked: true,
          blocked_at: new Date().toISOString(),
          block_reason: reason
        })
        .eq('user_id', userId);

      if (error) {
        console.error('Error blocking user:', error);
        return { success: false, error: error.message };
      }

      return { success: true, message: 'User blocked successfully' };
    } catch (error) {
      console.error('Error in blockUser:', error);
      return { success: false, error: error.message };
    }
  },

  // Unblock user
  unblockUser: async (userId) => {
    try {
      const { error } = await supabase
        .from('profile')
        .update({
          is_blocked: false,
          blocked_at: null,
          block_reason: null
        })
        .eq('user_id', userId);

      if (error) {
        console.error('Error unblocking user:', error);
        return { success: false, error: error.message };
      }

      return { success: true, message: 'User unblocked successfully' };
    } catch (error) {
      console.error('Error in unblockUser:', error);
      return { success: false, error: error.message };
    }
  },

  // Approve campaign
  approveCampaign: async (campaignId) => {
    try {
      const { error } = await supabase
        .from('campaigns')
        .update({
          approval_status: 'approved',
          approved_at: new Date().toISOString(),
          status: 'active'
        })
        .eq('id', campaignId);

      if (error) {
        console.error('Error approving campaign:', error);
        return { success: false, error: error.message };
      }

      return { success: true, message: 'Campaign approved successfully' };
    } catch (error) {
      console.error('Error in approveCampaign:', error);
      return { success: false, error: error.message };
    }
  },

  // Reject campaign
  rejectCampaign: async (campaignId, reason) => {
    try {
      const { error } = await supabase
        .from('campaigns')
        .update({
          approval_status: 'rejected',
          rejected_at: new Date().toISOString(),
          rejection_reason: reason,
          status: 'rejected'
        })
        .eq('id', campaignId);

      if (error) {
        console.error('Error rejecting campaign:', error);
        return { success: false, error: error.message };
      }

      return { success: true, message: 'Campaign rejected successfully' };
    } catch (error) {
      console.error('Error in rejectCampaign:', error);
      return { success: false, error: error.message };
    }
  }
};

// ============================================
// DASHBOARD STATS (READ-ONLY)
// ============================================

export const adminStatsService = {
  // Get dashboard statistics
  getDashboardStats: async () => {
    try {
      // Get campaign counts
      const { data: campaigns, error: campaignError } = await supabase
        .from('campaigns')
        .select('status, approval_status, postcards_sent')
        .is('deleted_at', null);

      if (campaignError) {
        console.error('Error fetching campaign stats:', campaignError);
        return { success: false, error: campaignError.message };
      }

      const stats = campaigns.reduce((acc, campaign) => {
        // Use real approval_status column (Phase 2)
        if (campaign.approval_status === 'pending') acc.pending_campaigns++;
        if (campaign.status === 'active') acc.active_campaigns++;
        acc.total_campaigns++;
        acc.total_postcards_sent += campaign.postcards_sent || 0;
        return acc;
      }, {
        pending_campaigns: 0,
        active_campaigns: 0,
        total_campaigns: 0,
        total_postcards_sent: 0
      });

      // Get user count from profile table
      const { count: userCount, error: userError } = await supabase
        .from('profile')
        .select('*', { count: 'exact', head: true });

      if (userError) {
        console.error('Error fetching user count:', userError);
      }

      return {
        success: true,
        stats: {
          ...stats,
          total_users: userCount || 0,
          active_users: userCount || 0, // Assume all active in Phase 1
          blocked_users: 0 // Will be real in Phase 2
        }
      };
    } catch (error) {
      console.error('Error in getDashboardStats:', error);
      return { success: false, error: error.message };
    }
  }
};

// ============================================
// ACTIVITY LOG QUERIES (READ-ONLY)
// ============================================

export const adminActivityService = {
  // Get all activity logs with filters
  getActivityLogs: async (filters = {}) => {
    try {
      // Build base query for counting
      let countQuery = supabase
        .from('admin_activity_logs')
        .select('*', { count: 'exact', head: false });

      // Build query for fetching data
      let query = supabase
        .from('admin_activity_logs')
        .select('*')
        .order('created_at', { ascending: false });

      // Apply filters to both queries
      if (filters.action_type && filters.action_type !== 'all') {
        query = query.eq('action_type', filters.action_type);
        countQuery = countQuery.eq('action_type', filters.action_type);
      }

      if (filters.admin_id) {
        query = query.eq('admin_id', filters.admin_id);
        countQuery = countQuery.eq('admin_id', filters.admin_id);
      }

      if (filters.date_from) {
        query = query.gte('created_at', filters.date_from);
        countQuery = countQuery.gte('created_at', filters.date_from);
      }

      if (filters.date_to) {
        query = query.lte('created_at', filters.date_to);
        countQuery = countQuery.lte('created_at', filters.date_to);
      }

      // Get total count first (before pagination)
      const { count, error: countError } = await countQuery;

      if (countError) {
        console.error('Error counting activity logs:', countError);
      }

      // Apply search (simplified for now, will be expanded with join)
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        query = query.or(`action_type.ilike.%${searchLower}%,target_type.ilike.%${searchLower}%`);
      }

      // Apply pagination
      if (filters.offset !== undefined) {
        query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1);
      } else if (filters.limit) {
        query = query.limit(filters.limit);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching activity logs:', error);
        return { success: false, error: error.message };
      }

      // Get all unique admin IDs
      const adminIds = [...new Set(data.map(log => log.admin_id).filter(Boolean))];

      // Fetch admin profiles in bulk
      const { data: adminProfiles } = await supabase
        .from('profile')
        .select('user_id, email, full_name')
        .in('user_id', adminIds);

      // Create lookup map
      const adminMap = (adminProfiles || []).reduce((acc, profile) => {
        acc[profile.user_id] = profile;
        return acc;
      }, {});

      // Transform logs with admin info
      const logsWithAdminInfo = data.map(log => {
        const adminProfile = adminMap[log.admin_id];

        return {
          ...log,
          admin_name: adminProfile?.full_name || adminProfile?.email || 'Unknown Admin',
          admin_email: adminProfile?.email || 'unknown@example.com'
        };
      });

      // If search filter is applied, filter in memory for admin names (temporary solution)
      let filteredLogs = logsWithAdminInfo;
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        filteredLogs = logsWithAdminInfo.filter(log => {
          return (
            log.action_type?.toLowerCase().includes(searchLower) ||
            log.target_type?.toLowerCase().includes(searchLower) ||
            log.admin_name?.toLowerCase().includes(searchLower) ||
            log.admin_email?.toLowerCase().includes(searchLower)
          );
        });
      }

      return {
        success: true,
        logs: filteredLogs,
        total: count || filteredLogs.length
      };
    } catch (error) {
      console.error('Error in getActivityLogs:', error);
      return { success: false, error: error.message };
    }
  },

  // Get activity log statistics
  getActivityStats: async () => {
    try {
      const { data, error } = await supabase
        .from('admin_activity_logs')
        .select('action_type, created_at');

      if (error) {
        console.error('Error fetching activity stats:', error);
        return { success: false, error: error.message };
      }

      const stats = data.reduce((acc, log) => {
        acc[log.action_type] = (acc[log.action_type] || 0) + 1;
        return acc;
      }, {});

      return {
        success: true,
        stats: {
          total_actions: data.length,
          by_type: stats
        }
      };
    } catch (error) {
      console.error('Error in getActivityStats:', error);
      return { success: false, error: error.message };
    }
  }
};

// ============================================
// REAL ADMIN ACTION METHODS
// Using real Supabase implementations
// ============================================

// Import real admin actions from dedicated service files
import {
  approveCampaign,
  rejectCampaign,
  pauseCampaign,
  resumeCampaign,
  deleteCampaign,
  connectProvider
} from './adminActions';

import {
  blockUser,
  unblockUser,
  deleteUser
} from './adminUserActions';

// Export real admin actions
export const adminCampaignActions = {
  approveCampaign,
  rejectCampaign,
  pauseCampaign,
  resumeCampaign,
  deleteCampaign,
  connectProvider
};

export const adminUserActions = {
  blockUser,
  unblockUser,
  deleteUser
};

// ============================================================================
// ADMIN TRANSACTION MONITORING SERVICE
// ============================================================================
export const adminTransactionService = {
  /**
   * Get transactions with filters and pagination
   * @param {Object} filters - Filter options
   * @returns {Promise<Object>} Transactions with metadata
   */
  async getTransactions(filters = {}) {
    try {
      const {
        status,
        userId,
        campaignId,
        dateFrom,
        dateTo,
        isTestMode,
        limit = 50,
        offset = 0,
        sortBy = 'created_at',
        sortOrder = 'desc'
      } = filters;

      // Build query (without profile relationship - we'll join manually)
      let query = supabase
        .from('transactions')
        .select(`
          *,
          campaigns!left(campaign_name, approval_status)
        `, { count: 'exact' });

      // Apply filters
      if (status) {
        query = query.eq('status', status);
      }

      if (userId) {
        query = query.eq('user_id', userId);
      }

      if (campaignId) {
        query = query.eq('campaign_id', campaignId);
      }

      if (dateFrom) {
        query = query.gte('created_at', dateFrom);
      }

      if (dateTo) {
        query = query.lte('created_at', dateTo);
      }

      if (isTestMode !== undefined) {
        query = query.eq('is_test_mode', isTestMode);
      }

      // Apply sorting
      query = query.order(sortBy, { ascending: sortOrder === 'asc' });

      // Apply pagination
      query = query.range(offset, offset + limit - 1);

      const { data: transactions, error, count } = await query;

      if (error) throw error;

      // Manually join profile data
      if (transactions && transactions.length > 0) {
        // Get unique user IDs
        const userIds = [...new Set(transactions.map(t => t.user_id).filter(Boolean))];

        // Fetch profiles for those users
        const { data: profiles } = await supabase
          .from('profile')
          .select('user_id, email, full_name')
          .in('user_id', userIds);

        // Merge profile data into transactions
        const transactionsWithProfiles = transactions.map(t => ({
          ...t,
          profile: profiles?.find(p => p.user_id === t.user_id) || { email: 'Unknown', full_name: 'Unknown' }
        }));

        return {
          success: true,
          transactions: transactionsWithProfiles,
          total: count || 0,
          limit,
          offset
        };
      }

      return {
        success: true,
        transactions: [],
        total: count || 0,
        limit,
        offset
      };

    } catch (error) {
      console.error('[Admin Transactions] Error fetching transactions:', error);
      throw error;
    }
  },

  /**
   * Get single transaction by ID
   * @param {string} transactionId - Transaction ID
   * @returns {Promise<Object>} Transaction details
   */
  async getTransactionById(transactionId) {
    try {
      const { data: transaction, error } = await supabase
        .from('transactions')
        .select(`
          *,
          campaigns!left(campaign_name, approval_status, user_id)
        `)
        .eq('id', transactionId)
        .single();

      if (error) throw error;

      // Manually join profile data
      if (transaction) {
        const { data: profile } = await supabase
          .from('profile')
          .select('user_id, email, full_name, phone')
          .eq('user_id', transaction.user_id)
          .single();

        return {
          success: true,
          transaction: {
            ...transaction,
            profile: profile || { email: 'Unknown', full_name: 'Unknown', phone: null }
          }
        };
      }

      return {
        success: true,
        transaction: null
      };

    } catch (error) {
      console.error('[Admin Transactions] Error fetching transaction:', error);
      throw error;
    }
  },

  /**
   * Get revenue statistics
   * @param {Object} filters - Date range and test mode filters
   * @returns {Promise<Object>} Revenue stats
   */
  async getRevenueStats(filters = {}) {
    try {
      const {
        dateFrom,
        dateTo,
        isTestMode,
      } = filters;

      // Build query for succeeded transactions
      let query = supabase
        .from('transactions')
        .select('amount_dollars, created_at, billing_reason')
        .eq('status', 'succeeded');

      if (dateFrom) {
        query = query.gte('created_at', dateFrom);
      }

      if (dateTo) {
        query = query.lte('created_at', dateTo);
      }

      if (isTestMode !== undefined) {
        query = query.eq('is_test_mode', isTestMode);
      }

      const { data: succeededTransactions, error: succeededError } = await query;

      if (succeededError) throw succeededError;

      // Get failed transactions count
      let failedQuery = supabase
        .from('transactions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'failed');

      if (isTestMode !== undefined) {
        failedQuery = failedQuery.eq('is_test_mode', isTestMode);
      }

      const { count: failedCount, error: failedError } = await failedQuery;

      if (failedError) throw failedError;

      // Get processing transactions count
      let processingQuery = supabase
        .from('transactions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'processing');

      if (isTestMode !== undefined) {
        processingQuery = processingQuery.eq('is_test_mode', isTestMode);
      }

      const { count: processingCount, error: processingError } = await processingQuery;

      if (processingError) throw processingError;

      // Calculate stats
      const totalRevenue = succeededTransactions.reduce((sum, tx) => sum + parseFloat(tx.amount_dollars), 0);
      const transactionCount = succeededTransactions.length;
      const averageTransactionAmount = transactionCount > 0 ? totalRevenue / transactionCount : 0;

      // Group by billing reason
      const byBillingReason = succeededTransactions.reduce((acc, tx) => {
        const reason = tx.billing_reason || 'unknown';
        if (!acc[reason]) {
          acc[reason] = { count: 0, revenue: 0 };
        }
        acc[reason].count++;
        acc[reason].revenue += parseFloat(tx.amount_dollars);
        return acc;
      }, {});

      // Revenue by day
      const revenueByDay = succeededTransactions.reduce((acc, tx) => {
        const date = new Date(tx.created_at).toISOString().split('T')[0];
        if (!acc[date]) {
          acc[date] = 0;
        }
        acc[date] += parseFloat(tx.amount_dollars);
        return acc;
      }, {});

      return {
        success: true,
        stats: {
          totalRevenue: totalRevenue.toFixed(2),
          transactionCount,
          successful_count: transactionCount,
          failedTransactionCount: failedCount || 0,
          failed_count: failedCount || 0,
          processing_count: processingCount || 0,
          averageTransactionAmount: averageTransactionAmount.toFixed(2),
          successRate: transactionCount > 0 ?
            ((transactionCount / (transactionCount + (failedCount || 0))) * 100).toFixed(2) :
            0,
          byBillingReason,
          revenueByDay,
        }
      };

    } catch (error) {
      console.error('[Admin Transactions] Error fetching revenue stats:', error);
      throw error;
    }
  },

  /**
   * Retry failed payment for a campaign
   * @param {string} campaignId - Campaign ID
   * @returns {Promise<Object>} Retry result
   */
  async retryFailedPayment(campaignId) {
    try {
      // Get campaign details
      const { data: campaign, error: campaignError } = await supabase
        .from('campaigns')
        .select('*')
        .eq('id', campaignId)
        .single();

      if (campaignError || !campaign) {
        throw new Error('Campaign not found');
      }

      // Import campaign service
      const { default: campaignService } = await import('./campaignService.js');

      // Get current admin user
      const { data: { user } } = await supabase.auth.getUser();

      // Retry charge
      const result = await campaignService.chargeCampaignOnApproval(campaignId, user.id);

      return result;

    } catch (error) {
      console.error('[Admin Transactions] Error retrying payment:', error);
      throw error;
    }
  },

  /**
   * Refund a transaction
   * @param {string} transactionId - Transaction ID
   * @param {string} reason - Refund reason
   * @returns {Promise<Object>} Refund result
   */
  async refundTransaction(transactionId, reason) {
    try {
      // Get transaction details
      const { data: transaction, error: txError } = await supabase
        .from('transactions')
        .select('*')
        .eq('id', transactionId)
        .single();

      if (txError || !transaction) {
        throw new Error('Transaction not found');
      }

      if (transaction.status !== 'succeeded') {
        throw new Error('Can only refund succeeded transactions');
      }

      if (transaction.status === 'refunded' || transaction.status === 'partially_refunded') {
        throw new Error('Transaction already refunded');
      }

      // Create refund via Stripe (through Edge Function or direct API)
      // For now, we'll create a simple implementation
      // In production, you'd want a dedicated Edge Function for refunds

      const stripe = await import('https://esm.sh/stripe@11.1.0?target=deno');
      const stripeClient = new stripe.default(Deno.env.get('STRIPE_SECRET_KEY'), {
        apiVersion: '2024-11-20.acacia',
      });

      const refund = await stripeClient.refunds.create({
        payment_intent: transaction.stripe_payment_intent_id,
        reason: 'requested_by_customer',
        metadata: {
          refund_reason: reason,
          refunded_by: 'admin',
        },
      });

      // Update transaction record
      const { error: updateError } = await supabase
        .from('transactions')
        .update({
          status: 'refunded',
          refunded_at: new Date().toISOString(),
          refund_reason: reason,
          refund_amount_cents: refund.amount,
          updated_at: new Date().toISOString(),
        })
        .eq('id', transactionId);

      if (updateError) throw updateError;

      // Update campaign if applicable
      if (transaction.campaign_id) {
        await supabase
          .from('campaigns')
          .update({
            payment_status: 'refunded',
            updated_at: new Date().toISOString(),
          })
          .eq('id', transaction.campaign_id);
      }

      return {
        success: true,
        message: 'Transaction refunded successfully',
        refundId: refund.id,
      };

    } catch (error) {
      console.error('[Admin Transactions] Error refunding transaction:', error);
      throw error;
    }
  },

  /**
   * Export transactions to CSV
   * @param {Object} filters - Same filters as getTransactions
   * @returns {Promise<string>} CSV string
   */
  async exportTransactionsCSV(filters = {}) {
    try {
      // Get all transactions without pagination
      const { transactions } = await this.getTransactions({
        ...filters,
        limit: 10000, // Max export limit
        offset: 0,
      });

      // Generate CSV
      const headers = [
        'Date',
        'Transaction ID',
        'Campaign',
        'User Email',
        'Amount',
        'Status',
        'Billing Reason',
        'Payment Method',
        'Test Mode',
      ];

      const rows = transactions.map(tx => [
        new Date(tx.created_at).toISOString(),
        tx.stripe_payment_intent_id,
        tx.campaigns?.campaign_name || 'N/A',
        tx.profile?.email || 'N/A',
        `$${tx.amount_dollars}`,
        tx.status,
        tx.billing_reason,
        tx.payment_method_brand && tx.payment_method_last4 ?
          `${tx.payment_method_brand} •••• ${tx.payment_method_last4}` :
          'N/A',
        tx.is_test_mode ? 'Yes' : 'No',
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n');

      return {
        success: true,
        csv: csvContent,
        filename: `transactions_${new Date().toISOString().split('T')[0]}.csv`,
      };

    } catch (error) {
      console.error('[Admin Transactions] Error exporting CSV:', error);
      throw error;
    }
  },
};

export default {
  campaigns: adminCampaignService,
  users: adminUserService,
  stats: adminStatsService,
  campaignActions: adminCampaignActions,
  userActions: adminUserActions,
  activity: adminActivityService,
  transactions: adminTransactionService
};
