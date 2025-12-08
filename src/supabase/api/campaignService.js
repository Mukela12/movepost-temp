import { supabase } from "../integration/client";

/**
 * Campaign Service
 * Handles all campaign-related database operations
 */
const campaignService = {
  /**
   * Create a new campaign
   * @param {Object} campaignData - Campaign data
   * @returns {Promise<Object>} Created campaign
   */
  async createCampaign(campaignData) {
    try {
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error('User not authenticated');
      }

      // Get company ID for the user
      const { data: company } = await supabase
        .from('companies')
        .select('id')
        .eq('user_id', user.id)
        .single();

      // Prepare campaign record
      const campaignRecord = {
        user_id: user.id,
        company_id: company?.id || null,
        campaign_name: campaignData.campaign_name || campaignData.name || 'Untitled Campaign',
        status: campaignData.status || 'draft',
        approval_status: 'pending', // All new campaigns require admin approval

        // Template & Design
        template_id: campaignData.template_id || null,
        template_name: campaignData.template_name || null,
        postcard_design_url: campaignData.postcard_design_url || null,
        postcard_preview_url: campaignData.postcard_preview_url || null,

        // Targeting
        targeting_type: campaignData.targeting_type || 'zip_codes',
        target_zip_codes: campaignData.target_zip_codes || [],
        target_location: campaignData.target_location || null,
        target_radius: campaignData.target_radius || null,

        // Recipients
        total_recipients: campaignData.total_recipients || 0,
        postcards_sent: campaignData.postcards_sent || 0,
        new_mover_ids: campaignData.new_mover_ids || [],

        // Pricing
        price_per_postcard: campaignData.price_per_postcard || 3.00,
        total_cost: campaignData.total_cost || 0,
        payment_status: campaignData.payment_status || 'pending',
        payment_intent_id: campaignData.payment_intent_id || null,

        // Analytics
        postcards_delivered: 0,
        responses: 0,
        response_rate: 0,

        created_at: new Date().toISOString()
      };

      // Insert campaign
      const { data, error } = await supabase
        .from('campaigns')
        .insert([campaignRecord])
        .select()
        .single();

      if (error) throw error;

      console.log('Campaign created successfully:', data);
      return {
        success: true,
        campaign: data,
        message: 'Campaign created successfully'
      };
    } catch (error) {
      console.error('Error creating campaign:', error);
      throw {
        error: error.message || 'Failed to create campaign',
        statusCode: error.statusCode || 400
      };
    }
  },

  /**
   * Get all campaigns for the current user
   * @param {Object} filters - Optional filters (status, limit, offset)
   * @returns {Promise<Array>} List of campaigns
   */
  async getCampaigns(filters = {}) {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error('User not authenticated');
      }

      let query = supabase
        .from('campaigns')
        .select('*')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      // Apply filters
      if (filters.status) {
        query = query.eq('status', filters.status);
      }

      if (filters.limit) {
        query = query.limit(filters.limit);
      }

      if (filters.offset) {
        query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1);
      }

      const { data, error } = await query;

      if (error) throw error;

      return {
        success: true,
        campaigns: data || [],
        count: data?.length || 0
      };
    } catch (error) {
      console.error('Error fetching campaigns:', error);
      throw {
        error: error.message || 'Failed to fetch campaigns',
        statusCode: error.statusCode || 400
      };
    }
  },

  /**
   * Get a single campaign by ID
   * @param {string} campaignId - Campaign ID
   * @returns {Promise<Object>} Campaign data
   */
  async getCampaignById(campaignId) {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error('User not authenticated');
      }

      // Check if user is admin
      const { data: profile } = await supabase
        .from('profile')
        .select('role')
        .eq('user_id', user.id)
        .single();

      const isAdmin = profile && ['admin', 'super_admin'].includes(profile.role);

      // Build query - skip user_id filter for admins
      let query = supabase
        .from('campaigns')
        .select('*')
        .eq('id', campaignId)
        .is('deleted_at', null);

      // Only filter by user_id for non-admin users
      if (!isAdmin) {
        query = query.eq('user_id', user.id);
      }

      const { data, error } = await query.single();

      if (error) throw error;

      if (!data) {
        throw new Error('Campaign not found');
      }

      return {
        success: true,
        campaign: data
      };
    } catch (error) {
      console.error('Error fetching campaign:', error);
      throw {
        error: error.message || 'Failed to fetch campaign',
        statusCode: error.statusCode || 404
      };
    }
  },

  /**
   * Get user's most recent draft campaign (for recovery if localStorage is lost)
   * @returns {Promise<Object>} Most recent draft campaign or null
   */
  async getMostRecentDraftCampaign() {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase
        .from('campaigns')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'draft')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      return {
        success: true,
        campaign: data || null
      };
    } catch (error) {
      console.error('Error fetching most recent draft campaign:', error);
      return {
        success: false,
        campaign: null,
        error: error.message
      };
    }
  },

  /**
   * Update a campaign
   * @param {string} campaignId - Campaign ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated campaign
   */
  async updateCampaign(campaignId, updates) {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error('User not authenticated');
      }

      // Check if user is admin
      const { data: profile } = await supabase
        .from('profile')
        .select('role')
        .eq('user_id', user.id)
        .single();

      const isAdmin = profile && ['admin', 'super_admin'].includes(profile.role);

      // Add updated_at timestamp
      updates.updated_at = new Date().toISOString();

      // Build query - skip user_id filter for admins
      let query = supabase
        .from('campaigns')
        .update(updates)
        .eq('id', campaignId);

      // Only filter by user_id for non-admin users
      if (!isAdmin) {
        query = query.eq('user_id', user.id);
      }

      const { data, error } = await query
        .select()
        .single();

      if (error) throw error;

      return {
        success: true,
        campaign: data,
        message: 'Campaign updated successfully'
      };
    } catch (error) {
      console.error('Error updating campaign:', error);
      throw {
        error: error.message || 'Failed to update campaign',
        statusCode: error.statusCode || 400
      };
    }
  },

  /**
   * Save PSD/Scene design URL to campaign
   * @param {string} campaignId - Campaign ID
   * @param {string} designUrl - Public URL of the PSD/scene file
   * @param {string} previewUrl - Optional preview image URL
   * @returns {Promise<Object>} Updated campaign
   */
  async saveCampaignDesign(campaignId, designUrl, previewUrl = null) {
    try {
      const updates = {
        postcard_design_url: designUrl
      };

      if (previewUrl) {
        updates.postcard_preview_url = previewUrl;
      }

      console.log('[Campaign Service] Saving design URLs:', updates);

      return await this.updateCampaign(campaignId, updates);
    } catch (error) {
      console.error('Error saving campaign design:', error);
      throw error;
    }
  },

  /**
   * Launch a campaign (change status to active)
   * @param {string} campaignId - Campaign ID
   * @returns {Promise<Object>} Updated campaign
   */
  async launchCampaign(campaignId) {
    try {
      return await this.updateCampaign(campaignId, {
        status: 'active',
        launched_at: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error launching campaign:', error);
      throw error;
    }
  },

  /**
   * Pause a campaign
   * @param {string} campaignId - Campaign ID
   * @returns {Promise<Object>} Updated campaign
   */
  async pauseCampaign(campaignId) {
    try {
      return await this.updateCampaign(campaignId, {
        status: 'paused'
      });
    } catch (error) {
      console.error('Error pausing campaign:', error);
      throw error;
    }
  },

  /**
   * Complete a campaign
   * @param {string} campaignId - Campaign ID
   * @returns {Promise<Object>} Updated campaign
   */
  async completeCampaign(campaignId) {
    try {
      return await this.updateCampaign(campaignId, {
        status: 'completed',
        completed_at: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error completing campaign:', error);
      throw error;
    }
  },

  /**
   * Delete a campaign (soft delete)
   * @param {string} campaignId - Campaign ID
   * @returns {Promise<Object>} Deletion confirmation
   */
  async deleteCampaign(campaignId) {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error('User not authenticated');
      }

      // Soft delete by setting deleted_at timestamp
      const { error } = await supabase
        .from('campaigns')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', campaignId)
        .eq('user_id', user.id);

      if (error) throw error;

      return {
        success: true,
        message: 'Campaign deleted successfully'
      };
    } catch (error) {
      console.error('Error deleting campaign:', error);
      throw {
        error: error.message || 'Failed to delete campaign',
        statusCode: error.statusCode || 400
      };
    }
  },

  /**
   * Duplicate a campaign
   * @param {string} campaignId - Campaign ID to duplicate
   * @returns {Promise<Object>} New campaign
   */
  async duplicateCampaign(campaignId) {
    try {
      // Get the original campaign
      const { campaign } = await this.getCampaignById(campaignId);

      // Create a new campaign with the same data
      const newCampaignData = {
        ...campaign,
        campaign_name: `${campaign.campaign_name} (Copy)`,
        status: 'draft',
        postcards_sent: 0,
        postcards_delivered: 0,
        responses: 0,
        response_rate: 0,
        payment_status: 'pending',
        payment_intent_id: null,
        paid_at: null,
        launched_at: null,
        completed_at: null
      };

      // Remove fields that should not be copied
      delete newCampaignData.id;
      delete newCampaignData.created_at;
      delete newCampaignData.updated_at;
      delete newCampaignData.deleted_at;

      return await this.createCampaign(newCampaignData);
    } catch (error) {
      console.error('Error duplicating campaign:', error);
      throw error;
    }
  },

  /**
   * Get campaign statistics for the current user
   * @returns {Promise<Object>} Campaign statistics
   */
  async getCampaignStats() {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error('User not authenticated');
      }

      // Get all campaigns
      const { data: campaigns, error } = await supabase
        .from('campaigns')
        .select('*')
        .eq('user_id', user.id)
        .is('deleted_at', null);

      if (error) throw error;

      // Calculate statistics
      const stats = {
        total_campaigns: campaigns.length,
        active_campaigns: campaigns.filter(c => c.status === 'active').length,
        completed_campaigns: campaigns.filter(c => c.status === 'completed').length,
        draft_campaigns: campaigns.filter(c => c.status === 'draft').length,
        paused_campaigns: campaigns.filter(c => c.status === 'paused').length,
        total_postcards_sent: campaigns.reduce((sum, c) => sum + (c.postcards_sent || 0), 0),
        total_recipients: campaigns.reduce((sum, c) => sum + (c.total_recipients || 0), 0),
        total_spent: campaigns.reduce((sum, c) => sum + (parseFloat(c.total_cost) || 0), 0),
        avg_response_rate: campaigns.length > 0
          ? campaigns.reduce((sum, c) => sum + (parseFloat(c.response_rate) || 0), 0) / campaigns.length
          : 0
      };

      return {
        success: true,
        stats
      };
    } catch (error) {
      console.error('Error fetching campaign stats:', error);
      throw {
        error: error.message || 'Failed to fetch campaign stats',
        statusCode: error.statusCode || 400
      };
    }
  },

  /**
   * Update payment status for a campaign
   * @param {string} campaignId - Campaign ID
   * @param {string} paymentStatus - New payment status
   * @param {string} paymentIntentId - Stripe payment intent ID (optional)
   * @returns {Promise<Object>} Updated campaign
   */
  async updatePaymentStatus(campaignId, paymentStatus, paymentIntentId = null) {
    try {
      const updates = {
        payment_status: paymentStatus,
        updated_at: new Date().toISOString()
      };

      if (paymentIntentId) {
        updates.payment_intent_id = paymentIntentId;
      }

      if (paymentStatus === 'paid') {
        updates.paid_at = new Date().toISOString();
      }

      return await this.updateCampaign(campaignId, updates);
    } catch (error) {
      console.error('Error updating payment status:', error);
      throw error;
    }
  },

  /**
   * Get analytics data aggregated by month
   * @param {number} months - Number of months to fetch (default: 6)
   * @returns {Promise<Array>} Monthly analytics data
   */
  async getAnalyticsData(months = 6) {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error('User not authenticated');
      }

      // Calculate date range (last N months)
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - months);

      // Fetch campaigns from the last N months
      const { data: campaigns, error } = await supabase
        .from('campaigns')
        .select('created_at, postcards_sent, status')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Group campaigns by month
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthlyData = {};

      // Initialize all months in the range
      for (let i = 0; i < months; i++) {
        const date = new Date();
        date.setMonth(date.getMonth() - (months - 1 - i));
        const monthKey = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
        monthlyData[monthKey] = {
          month: monthNames[date.getMonth()],
          year: date.getFullYear(),
          postcards_sent: 0,
          campaigns: 0
        };
      }

      // Aggregate campaign data
      campaigns.forEach(campaign => {
        const date = new Date(campaign.created_at);
        const monthKey = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;

        if (monthlyData[monthKey]) {
          monthlyData[monthKey].postcards_sent += campaign.postcards_sent || 0;
          monthlyData[monthKey].campaigns += 1;
        }
      });

      // Convert to array and return
      const analyticsArray = Object.values(monthlyData);

      return {
        success: true,
        analytics: analyticsArray
      };
    } catch (error) {
      console.error('Error fetching analytics data:', error);
      throw {
        error: error.message || 'Failed to fetch analytics data',
        statusCode: error.statusCode || 400
      };
    }
  },

  /**
   * Charge campaign when admin approves it
   * @param {string} campaignId - Campaign ID
   * @param {string} approvedBy - Admin user ID who approved
   * @returns {Promise<Object>} Charge result with transaction details
   */
  async chargeCampaignOnApproval(campaignId, approvedBy) {
    try {
      console.log(`[Campaign Service] Charging campaign on approval: ${campaignId}`);

      // Get campaign details
      const { campaign } = await this.getCampaignById(campaignId);

      if (!campaign) {
        throw new Error('Campaign not found');
      }

      // Calculate total cost
      const totalCost = (campaign.postcards_sent || campaign.total_recipients || 0) * 3.00;
      const totalCostCents = Math.round(totalCost * 100);

      if (totalCostCents < 50) {
        throw new Error('Campaign cost must be at least $0.50');
      }

      console.log(`[Campaign Service] Calculated cost: $${totalCost.toFixed(2)} for ${campaign.postcards_sent || campaign.total_recipients} postcards`);

      // Import payment service here to avoid circular dependency
      const { paymentService } = await import('./paymentService.js');

      // Charge the campaign (pass campaign.user_id for admin approvals)
      const chargeResult = await paymentService.chargeCampaign(
        campaignId,
        totalCostCents,
        {
          campaign_name: campaign.campaign_name,
          billing_reason: 'campaign_approval',
          postcard_count: (campaign.postcards_sent || campaign.total_recipients).toString(),
        },
        campaign.user_id
      );

      console.log(`[Campaign Service] Charge result:`, chargeResult);

      // Update campaign based on payment result
      if (chargeResult.success && chargeResult.status === 'succeeded') {
        // Payment succeeded immediately
        await this.updateCampaign(campaignId, {
          payment_status: 'paid',
          payment_intent_id: chargeResult.paymentIntentId,
          paid_at: new Date().toISOString(),
          approved_by: approvedBy,
          approved_at: new Date().toISOString(),
          payment_requires_action: false,
          payment_action_url: null,
          total_cost: totalCost,
        });

        return {
          success: true,
          status: 'succeeded',
          message: 'Campaign approved and payment successful',
          transactionId: chargeResult.paymentIntentId,
          amount: totalCost,
        };

      } else if (chargeResult.requiresAction) {
        // Payment requires 3D Secure authentication
        await this.updateCampaign(campaignId, {
          payment_status: 'processing',
          payment_intent_id: chargeResult.paymentIntentId,
          payment_requires_action: true,
          payment_action_url: chargeResult.actionUrl,
          total_cost: totalCost,
        });

        return {
          success: true,
          status: 'requires_action',
          message: 'Payment requires authentication. User will be notified.',
          actionUrl: chargeResult.actionUrl,
          transactionId: chargeResult.paymentIntentId,
          amount: totalCost,
        };

      } else if (chargeResult.status === 'processing') {
        // Payment is being processed async
        await this.updateCampaign(campaignId, {
          payment_status: 'processing',
          payment_intent_id: chargeResult.paymentIntentId,
          total_cost: totalCost,
        });

        return {
          success: true,
          status: 'processing',
          message: 'Payment is processing. Will be updated via webhook.',
          transactionId: chargeResult.paymentIntentId,
          amount: totalCost,
        };

      } else {
        // Payment failed
        throw new Error(chargeResult.error || 'Payment failed');
      }

    } catch (error) {
      console.error('[Campaign Service] Error charging campaign on approval:', error);

      // Update campaign to keep it in pending state
      try {
        await this.updateCampaign(campaignId, {
          payment_status: 'failed',
        });
      } catch (updateError) {
        console.error('[Campaign Service] Error updating campaign payment status:', updateError);
      }

      throw {
        error: error.message || 'Failed to charge campaign',
        statusCode: error.statusCode || 400,
        userFriendlyMessage: this.getUserFriendlyPaymentError(error.message),
      };
    }
  },

  /**
   * Add new movers to campaign and schedule charge for daily batch
   * @param {string} campaignId - Campaign ID
   * @param {Array} newMoverData - Array of new mover records
   * @param {boolean} chargeImmediately - If true, charge now instead of batching (default: false)
   * @returns {Promise<Object>} Result with charge scheduling details
   */
  async addNewMoversAndScheduleCharge(campaignId, newMoverData, chargeImmediately = false) {
    try {
      console.log(`[Campaign Service] Adding new movers to campaign: ${campaignId}`);

      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error('User not authenticated');
      }

      // Get campaign
      const { campaign } = await this.getCampaignById(campaignId);

      if (!campaign) {
        throw new Error('Campaign not found');
      }

      // Verify campaign is approved and paid
      if (campaign.approval_status !== 'approved' || campaign.payment_status !== 'paid') {
        throw new Error('Campaign must be approved and paid before adding new movers');
      }

      // Calculate new mover count and cost
      const newMoverCount = newMoverData.length;
      const additionalCost = newMoverCount * 3.00;
      const additionalCostCents = Math.round(additionalCost * 100);

      console.log(`[Campaign Service] Adding ${newMoverCount} new movers, cost: $${additionalCost.toFixed(2)}`);

      // Add new movers to campaign (update campaign data)
      const updatedRecipients = campaign.total_recipients + newMoverCount;
      const updatedPostcardsSent = (campaign.postcards_sent || 0) + newMoverCount;

      await this.updateCampaign(campaignId, {
        total_recipients: updatedRecipients,
        postcards_sent: updatedPostcardsSent,
        new_mover_ids: [...(campaign.new_mover_ids || []), ...newMoverData.map(m => m.id)],
      });

      // Determine if test mode (check if Stripe publishable key is test key)
      const isTestMode = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY?.includes('_test_') || false;

      if (chargeImmediately) {
        // Charge immediately
        const { default: paymentService } = await import('./paymentService.js');

        const chargeResult = await paymentService.chargeCampaign(
          campaignId,
          additionalCostCents,
          {
            campaign_name: campaign.campaign_name,
            billing_reason: 'new_mover_addition',
            new_mover_count: newMoverCount.toString(),
          }
        );

        return {
          success: true,
          charged: true,
          newMoverCount,
          amount: additionalCost,
          transactionId: chargeResult.paymentIntentId,
          status: chargeResult.status,
        };

      } else {
        // Schedule for daily batch processing
        const { error: insertError } = await supabase
          .from('pending_charges')
          .insert({
            campaign_id: campaignId,
            user_id: user.id,
            new_mover_count: newMoverCount,
            amount_cents: additionalCostCents,
            amount_dollars: additionalCost,
            billing_reason: 'new_mover_addition',
            scheduled_for: new Date().toISOString().split('T')[0], // Today's date
            is_test_mode: isTestMode,
            metadata: {
              campaign_name: campaign.campaign_name,
              added_at: new Date().toISOString(),
            },
          });

        if (insertError) {
          throw insertError;
        }

        console.log(`[Campaign Service] Pending charge scheduled for daily batch`);

        return {
          success: true,
          charged: false,
          scheduled: true,
          newMoverCount,
          amount: additionalCost,
          scheduledFor: 'tomorrow at 2am UTC',
          message: 'New movers added. Charge will be processed in the next daily batch.',
        };
      }

    } catch (error) {
      console.error('[Campaign Service] Error adding new movers and scheduling charge:', error);
      throw {
        error: error.message || 'Failed to add new movers',
        statusCode: error.statusCode || 400
      };
    }
  },

  /**
   * Get user-friendly payment error message
   * @param {string} errorMessage - Technical error message
   * @returns {string} User-friendly message
   */
  getUserFriendlyPaymentError(errorMessage) {
    if (!errorMessage) return 'Payment failed. Please try again.';

    const message = errorMessage.toLowerCase();

    if (message.includes('no payment method') || message.includes('payment method not found')) {
      return 'User has no payment method on file. Please ask them to add a payment method in Settings → Billing.';
    }

    if (message.includes('declined')) {
      return 'Card was declined. Please ask the user to update their payment method.';
    }

    if (message.includes('insufficient')) {
      return 'Insufficient funds. Please ask the user to use a different payment method.';
    }

    if (message.includes('expired')) {
      return 'Card has expired. Please ask the user to update their payment method.';
    }

    if (message.includes('unauthorized')) {
      return 'User is not authorized for this campaign.';
    }

    // Default to original message if no match
    return errorMessage;
  }
};

export default campaignService;
