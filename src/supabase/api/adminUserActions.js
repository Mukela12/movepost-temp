// Admin User Actions - Block/Unblock/Delete Users
// Phase 2: Real database operations for user management

import { supabase } from '../integration/client';

// ============================================
// USER ACTIONS
// ============================================

/**
 * Block a user
 */
export const blockUser = async (userId, adminId, reason) => {
  try {
    if (!reason || reason.trim().length === 0) {
      return { success: false, error: 'Block reason is required' };
    }

    // Update profile table
    const { data, error } = await supabase
      .from('profile')
      .update({
        is_blocked: true,
        blocked_at: new Date().toISOString(),
        blocked_by: adminId,
        block_reason: reason
      })
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error blocking user:', error);
      return { success: false, error: error.message };
    }

    // Create block record in user_blocks table
    await supabase
      .from('user_blocks')
      .insert({
        user_id: userId,
        blocked_by: adminId,
        reason,
        is_active: true
      });

    // Log admin activity
    await logAdminActivity(adminId, 'user_blocked', 'user', userId, {
      reason
    });

    return { success: true, user: data };
  } catch (error) {
    console.error('Error in blockUser:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Unblock a user
 */
export const unblockUser = async (userId, adminId, unblockReason = 'Unblocked by admin') => {
  try {
    // Update profile table
    const { data, error } = await supabase
      .from('profile')
      .update({
        is_blocked: false,
        blocked_at: null,
        blocked_by: null,
        block_reason: null
      })
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error unblocking user:', error);
      return { success: false, error: error.message };
    }

    // Update user_blocks table - mark as inactive
    await supabase
      .from('user_blocks')
      .update({
        is_active: false,
        unblocked_at: new Date().toISOString(),
        unblocked_by: adminId,
        unblock_reason: unblockReason
      })
      .eq('user_id', userId)
      .eq('is_active', true);

    // Log admin activity
    await logAdminActivity(adminId, 'user_unblocked', 'user', userId, {
      unblock_reason: unblockReason
    });

    return { success: true, user: data };
  } catch (error) {
    console.error('Error in unblockUser:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Delete user (soft delete)
 */
export const deleteUser = async (userId, adminId) => {
  try {
    // Soft delete - set deleted_at timestamp
    const { data, error } = await supabase
      .from('profile')
      .update({
        deleted_at: new Date().toISOString(),
        is_blocked: true // Also block the user
      })
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error deleting user:', error);
      return { success: false, error: error.message };
    }

    // Log admin activity
    await logAdminActivity(adminId, 'user_deleted', 'user', userId, {
      email: data.email,
      full_name: data.full_name
    });

    return { success: true, user: data };
  } catch (error) {
    console.error('Error in deleteUser:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get user's campaigns
 */
export const getUserCampaigns = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('campaigns')
      .select('id, campaign_name, status, postcards_sent, total_cost, created_at')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching user campaigns:', error);
      return { success: false, error: error.message };
    }

    return { success: true, campaigns: data };
  } catch (error) {
    console.error('Error in getUserCampaigns:', error);
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

// Export all functions
export default {
  blockUser,
  unblockUser,
  deleteUser,
  getUserCampaigns
};
