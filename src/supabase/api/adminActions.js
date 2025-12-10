// Admin Actions - Real Database Operations
// Phase 2: Campaign approval, rejection, pause, delete, and provider connection

import { supabase } from '../integration/client';
import * as emailService from './emailService';
import * as notificationService from './notificationService';

// ============================================
// CAMPAIGN ACTIONS
// ============================================

/**
 * Approve a campaign and charge the user
 * CRITICAL: This function now integrates with Stripe billing
 */
export const approveCampaign = async (campaignId, adminId) => {
  try {
    console.log('[Admin Actions] Approving campaign:', campaignId);

    // First, check if user has payment method
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('user_id, campaign_name, postcards_sent, total_recipients, payment_status')
      .eq('id', campaignId)
      .single();

    if (campaignError || !campaign) {
      console.error('Error fetching campaign:', campaignError);
      return { success: false, error: 'Campaign not found' };
    }

    // Check if user has payment method
    const { data: customer } = await supabase
      .from('customers')
      .select('id')
      .eq('user_id', campaign.user_id)
      .maybeSingle();

    if (!customer) {
      return {
        success: false,
        error: 'User has no payment method on file. Please ask them to add a payment method in Settings → Billing before approving.',
        needsPaymentMethod: true
      };
    }

    const { data: paymentMethod } = await supabase
      .from('payment_methods')
      .select('id')
      .eq('customer_id', customer.id)
      .eq('is_default', true)
      .maybeSingle();

    if (!paymentMethod) {
      return {
        success: false,
        error: 'User has no default payment method. Please ask them to add a payment method before approving.',
        needsPaymentMethod: true
      };
    }

    console.log(`[Admin Actions] Approving campaign: ${campaign.campaign_name}`);

    // Approve the campaign - NO CHARGE YET
    // Postcards will be charged as they're sent (via polling → daily batch)
    try {
      const approvedAt = new Date().toISOString();

      await supabase
        .from('campaigns')
        .update({
          approval_status: 'approved',
          status: 'active',
          polling_enabled: true,
          polling_frequency_hours: 0.5,
          approved_at: approvedAt,
          approved_by: adminId
        })
        .eq('id', campaignId);

      // Log admin activity
      await logAdminActivity(adminId, 'campaign_approved', 'campaign', campaignId, {
        campaign_name: campaign.campaign_name,
        approved_at: approvedAt
      });

      // Send email and notification to customer
      try {
        // Fetch user email
        const { data: userProfile } = await supabase
          .from('profile')
          .select('email')
          .eq('user_id', campaign.user_id)
          .single();

        if (userProfile?.email) {
          // Send approval email
          await emailService.sendCampaignApprovedEmail(userProfile.email, {
            campaignName: campaign.campaign_name,
            campaignId: campaignId,
            approvedAt: approvedAt
          });

          // Create in-app notification
          await notificationService.createNotification(
            campaign.user_id,
            'campaign_approved',
            'Campaign Approved!',
            `Your campaign "${campaign.campaign_name}" is now live and active.`,
            `/campaign/${campaignId}/details`
          );
        }
      } catch (notifError) {
        console.error('Error sending approval notification:', notifError);
        // Don't fail the approval if notification fails
      }

      return {
        success: true,
        message: `✅ Campaign approved successfully!\n\n` +
                 `Polling enabled: Checks for new movers every 30 minutes\n` +
                 `First poll will run within the next poll cycle\n` +
                 `Postcards will be sent automatically via PostGrid\n` +
                 `You'll be charged $3.00 immediately when each postcard is sent`,
        campaign: campaign
      };

    } catch (approvalError) {
      console.error('[Admin Actions] Approval error:', approvalError);

      await logAdminActivity(adminId, 'campaign_approval_failed', 'campaign', campaignId, {
        campaign_name: campaign.campaign_name,
        error: approvalError.message
      });

      return {
        success: false,
        error: approvalError.message || 'Failed to approve campaign'
      };
    }

  } catch (error) {
    console.error('Error in approveCampaign:', error);
    return {
      success: false,
      error: error.message || 'Failed to approve campaign'
    };
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

    // Send email and notification to customer
    try {
      // Fetch user email
      const { data: userProfile } = await supabase
        .from('profile')
        .select('email')
        .eq('user_id', data.user_id)
        .single();

      if (userProfile?.email) {
        // Send rejection email
        await emailService.sendCampaignRejectedEmail(userProfile.email, {
          campaignName: data.campaign_name,
          campaignId: campaignId,
          rejectionReason: reason
        });

        // Create in-app notification
        await notificationService.createNotification(
          data.user_id,
          'campaign_rejected',
          'Campaign Needs Updates',
          `Your campaign "${data.campaign_name}" requires changes: ${reason}`,
          `/campaign/${campaignId}/edit`
        );
      }
    } catch (notifError) {
      console.error('Error sending rejection notification:', notifError);
      // Don't fail the rejection if notification fails
    }

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

    // Send email and notification to customer
    try {
      // Fetch user email
      const { data: userProfile } = await supabase
        .from('profile')
        .select('email')
        .eq('user_id', data.user_id)
        .single();

      if (userProfile?.email) {
        // Send pause email
        await emailService.sendCampaignPausedEmail(userProfile.email, {
          campaignName: data.campaign_name,
          campaignId: campaignId,
          pauseReason: reason
        });

        // Create in-app notification
        await notificationService.createNotification(
          data.user_id,
          'campaign_paused',
          'Campaign Paused',
          `Your campaign "${data.campaign_name}" has been paused.`,
          `/campaign/${campaignId}/details`
        );
      }
    } catch (notifError) {
      console.error('Error sending pause notification:', notifError);
      // Don't fail the pause if notification fails
    }

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

    // Send email and notification to customer
    try {
      // Fetch user email
      const { data: userProfile } = await supabase
        .from('profile')
        .select('email')
        .eq('user_id', data.user_id)
        .single();

      if (userProfile?.email) {
        // Send resume email
        await emailService.sendCampaignResumedEmail(userProfile.email, {
          campaignName: data.campaign_name,
          campaignId: campaignId
        });

        // Create in-app notification
        await notificationService.createNotification(
          data.user_id,
          'campaign_resumed',
          'Campaign Resumed',
          `Your campaign "${data.campaign_name}" is active again.`,
          `/campaign/${campaignId}/details`
        );
      }
    } catch (notifError) {
      console.error('Error sending resume notification:', notifError);
      // Don't fail the resume if notification fails
    }

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
