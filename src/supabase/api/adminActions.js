// Admin Actions - Real Database Operations
// Phase 2: Campaign approval, rejection, pause, delete, and provider connection

import { supabase } from '../integration/client';

// ============================================
// CAMPAIGN ACTIONS
// ============================================

/**
 * Approve a campaign and set it to active
 */
export const approveCampaign = async (campaignId, adminId) => {
  try {
    const { data, error } = await supabase
      .from('campaigns')
      .update({
        approval_status: 'approved',
        approved_by: adminId,
        approved_at: new Date().toISOString(),
        status: 'active' // Change from draft to active when approved
      })
      .eq('id', campaignId)
      .select()
      .single();

    if (error) {
      console.error('Error approving campaign:', error);
      return { success: false, error: error.message };
    }

    // Log admin activity
    await logAdminActivity(adminId, 'campaign_approved', 'campaign', campaignId, {
      campaign_name: data.campaign_name
    });

    return { success: true, campaign: data };
  } catch (error) {
    console.error('Error in approveCampaign:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Reject a campaign with a reason
 */
export const rejectCampaign = async (campaignId, adminId, reason) => {
  try {
    if (!reason || reason.trim().length === 0) {
      return { success: false, error: 'Rejection reason is required' };
    }

    const { data, error } = await supabase
      .from('campaigns')
      .update({
        approval_status: 'rejected',
        rejected_by: adminId,
        rejected_at: new Date().toISOString(),
        rejection_reason: reason,
        status: 'rejected' // Update status field to match approval_status
      })
      .eq('id', campaignId)
      .select()
      .single();

    if (error) {
      console.error('Error rejecting campaign:', error);
      return { success: false, error: error.message };
    }

    // Log admin activity
    await logAdminActivity(adminId, 'campaign_rejected', 'campaign', campaignId, {
      campaign_name: data.campaign_name,
      reason
    });

    return { success: true, campaign: data };
  } catch (error) {
    console.error('Error in rejectCampaign:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Pause an active campaign with a reason
 */
export const pauseCampaign = async (campaignId, adminId, reason) => {
  try {
    if (!reason || reason.trim().length === 0) {
      return { success: false, error: 'Pause reason is required' };
    }

    const { data, error } = await supabase
      .from('campaigns')
      .update({
        paused_by: adminId,
        paused_at: new Date().toISOString(),
        pause_reason: reason,
        status: 'paused'
      })
      .eq('id', campaignId)
      .select()
      .single();

    if (error) {
      console.error('Error pausing campaign:', error);
      return { success: false, error: error.message };
    }

    // Log admin activity
    await logAdminActivity(adminId, 'campaign_paused', 'campaign', campaignId, {
      campaign_name: data.campaign_name,
      reason
    });

    return { success: true, campaign: data };
  } catch (error) {
    console.error('Error in pauseCampaign:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Resume a paused campaign
 */
export const resumeCampaign = async (campaignId, adminId) => {
  try {
    const { data, error } = await supabase
      .from('campaigns')
      .update({
        paused_by: null,
        paused_at: null,
        pause_reason: null,
        status: 'active'
      })
      .eq('id', campaignId)
      .select()
      .single();

    if (error) {
      console.error('Error resuming campaign:', error);
      return { success: false, error: error.message };
    }

    // Log admin activity
    await logAdminActivity(adminId, 'campaign_resumed', 'campaign', campaignId, {
      campaign_name: data.campaign_name
    });

    return { success: true, campaign: data };
  } catch (error) {
    console.error('Error in resumeCampaign:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Soft delete a campaign
 */
export const deleteCampaign = async (campaignId, adminId) => {
  try {
    const { data, error } = await supabase
      .from('campaigns')
      .update({
        deleted_at: new Date().toISOString()
      })
      .eq('id', campaignId)
      .select()
      .single();

    if (error) {
      console.error('Error deleting campaign:', error);
      return { success: false, error: error.message };
    }

    // Log admin activity
    await logAdminActivity(adminId, 'campaign_deleted', 'campaign', campaignId, {
      campaign_name: data.campaign_name
    });

    return { success: true, campaign: data };
  } catch (error) {
    console.error('Error in deleteCampaign:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Connect a provider to a campaign
 */
export const connectProvider = async (campaignId, adminId, provider) => {
  try {
    if (!provider || !['lob', 'postgrid', 'clicksend'].includes(provider)) {
      return { success: false, error: 'Invalid provider' };
    }

    const { data, error } = await supabase
      .from('campaigns')
      .update({
        provider,
        provider_connected_at: new Date().toISOString()
      })
      .eq('id', campaignId)
      .select()
      .single();

    if (error) {
      console.error('Error connecting provider:', error);
      return { success: false, error: error.message };
    }

    // Log admin activity
    await logAdminActivity(adminId, 'provider_connected', 'campaign', campaignId, {
      campaign_name: data.campaign_name,
      provider
    });

    return { success: true, campaign: data };
  } catch (error) {
    console.error('Error in connectProvider:', error);
    return { success: false, error: error.message };
  }
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Log admin activity to database
 */
const logAdminActivity = async (adminId, actionType, targetType, targetId, metadata = {}) => {
  try {
    const { error } = await supabase
      .from('admin_activity_logs')
      .insert({
        admin_id: adminId,
        action_type: actionType,
        target_type: targetType,
        target_id: targetId,
        metadata
      });

    if (error) {
      console.error('Error logging admin activity:', error);
    }
  } catch (error) {
    console.error('Error in logAdminActivity:', error);
  }
};

/**
 * Get current admin user ID from session
 */
export const getCurrentAdminId = async () => {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      console.error('Error getting current user:', error);
      return null;
    }

    return user.id;
  } catch (error) {
    console.error('Error in getCurrentAdminId:', error);
    return null;
  }
};

/**
 * Check if current user is an admin
 */
export const checkIsAdmin = async () => {
  try {
    const userId = await getCurrentAdminId();
    if (!userId) return false;

    const { data, error } = await supabase
      .from('profile')
      .select('role')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      console.error('Error checking admin role:', error);
      return false;
    }

    return ['admin', 'super_admin'].includes(data.role);
  } catch (error) {
    console.error('Error in checkIsAdmin:', error);
    return false;
  }
};

// Export all functions
export default {
  approveCampaign,
  rejectCampaign,
  pauseCampaign,
  resumeCampaign,
  deleteCampaign,
  connectProvider,
  getCurrentAdminId,
  checkIsAdmin
};
