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
      const userIds = [...new Set(data.map(c => c.user_id))];

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
      let query = supabase
        .from('admin_activity_logs')
        .select('*')
        .order('created_at', { ascending: false });

      // Apply filters
      if (filters.action_type && filters.action_type !== 'all') {
        query = query.eq('action_type', filters.action_type);
      }

      if (filters.admin_id) {
        query = query.eq('admin_id', filters.admin_id);
      }

      if (filters.date_from) {
        query = query.gte('created_at', filters.date_from);
      }

      if (filters.date_to) {
        query = query.lte('created_at', filters.date_to);
      }

      // Apply search
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        query = query.or(`action_type.ilike.%${searchLower}%,target_type.ilike.%${searchLower}%`);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching activity logs:', error);
        return { success: false, error: error.message };
      }

      // Get all unique admin IDs
      const adminIds = [...new Set(data.map(log => log.admin_id))];

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

      return {
        success: true,
        logs: logsWithAdminInfo,
        total: logsWithAdminInfo.length
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

export default {
  campaigns: adminCampaignService,
  users: adminUserService,
  stats: adminStatsService,
  campaignActions: adminCampaignActions,
  userActions: adminUserActions,
  activity: adminActivityService
};
