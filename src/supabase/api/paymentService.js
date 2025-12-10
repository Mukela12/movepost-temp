import { supabase } from "../integration/client";
import { dollarsToCents } from "../../utils/pricing";
import Stripe from "stripe";

const stripekey = new Stripe(import.meta.env.VITE_STRIPE_SECRET_KEY);

export const paymentService = {
  /**
   * Create a customer record in Stripe and database (lightweight, no payment intent)
   * This is faster than createSetupIntent and should be used when only customer creation is needed
   * @returns {Promise<Object>} Customer data (customerId, stripeCustomerId)
   */
  async createCustomerRecord() {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      throw new Error('Not authenticated');
    }

    try {
      const { data: response, error } = await supabase.functions.invoke('create-customer-record', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        console.error('[paymentService] Error creating customer record:', error);
        throw error;
      }

      return response;
    } catch (err) {
      console.error('[paymentService] Failed to create customer record:', err);
      throw new Error('Failed to create customer record: ' + err.message);
    }
  },

  async createSetupIntent(email) {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      throw new Error('Not authenticated');
    }

    const { data: response, error: error } = await supabase.functions.invoke('create-setup-intent', {
      body: { email: email },
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    })
    return response;
  },

  /**
   * Create a payment intent to charge the customer
   * @param {number} amount - Amount in dollars (will be converted to cents)
   * @param {string} description - Description of the charge
   * @param {Object} metadata - Additional metadata (campaign_id, postcard_count, etc.)
   * @returns {Promise<Object>} Payment intent data
   */
  async createPaymentIntent(amount, description, metadata = {}) {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      throw new Error('Not authenticated');
    }

    // Convert dollars to cents for Stripe
    const amountInCents = dollarsToCents(amount);

    if (amountInCents < 50) {
      throw new Error('Amount must be at least $0.50 (Stripe minimum)');
    }

    try {
      const { data: response, error } = await supabase.functions.invoke('create-payment-intent', {
        body: {
          amount: amountInCents,
          description: description || 'Postcard Campaign',
          metadata: metadata
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        throw error;
      }

      return response;
    } catch (error) {
      console.error('Error creating payment intent:', error);
      throw error;
    }
  },

  /**
   * Confirm payment with saved payment method
   * @param {string} paymentIntentId - Payment intent ID from Stripe
   * @param {string} paymentMethodId - Payment method ID (optional if customer has default)
   * @returns {Promise<Object>} Confirmation result
   */
  async confirmPayment(paymentIntentId, paymentMethodId = null) {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      throw new Error('Not authenticated');
    }

    try {
      const { data: response, error } = await supabase.functions.invoke('confirm-payment', {
        body: {
          paymentIntentId,
          paymentMethodId
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        throw error;
      }

      return response;
    } catch (error) {
      console.error('Error confirming payment:', error);
      throw error;
    }
  },

  /**
   * Charge campaign - Main function for automatic billing
   * @param {string} campaignId - Campaign ID
   * @param {number} amountCents - Amount in cents
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<Object>} Charge result
   */
  async chargeCampaign(campaignId, amountCents, metadata = {}, userId = null) {
    console.log('[Payment Service] Charging campaign:', campaignId, 'Amount:', amountCents / 100);

    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      throw new Error('Not authenticated');
    }

    // Use provided userId or fall back to session user (for admin approvals vs self-service)
    const targetUserId = userId || session.user.id;

    try {
      // Get user's customer record
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .select('id, stripe_customer_id')
        .eq('user_id', targetUserId)
        .single();

      if (customerError || !customer) {
        throw new Error('No customer record found. Please add a payment method first.');
      }

      // Get user's default payment method
      const { data: paymentMethod, error: pmError } = await supabase
        .from('payment_methods')
        .select('stripe_payment_method_id, card_brand, card_last4, card_exp_month, card_exp_year')
        .eq('customer_id', customer.id)
        .eq('is_default', true)
        .single();

      if (pmError || !paymentMethod) {
        throw new Error('No payment method on file. Please add a payment method first.');
      }

      // Check if card is expired
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;

      if (
        paymentMethod.card_exp_year < currentYear ||
        (paymentMethod.card_exp_year === currentYear && paymentMethod.card_exp_month < currentMonth)
      ) {
        throw new Error('Payment method has expired. Please update your payment method.');
      }

      // Determine if test mode
      const isTestMode = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY?.includes('_test_') || false;

      // Generate idempotency key to prevent duplicate charges
      const idempotencyKey = `campaign_${campaignId}_${Date.now()}`;

      // Call create-payment-intent Edge Function with all required parameters
      const { data: response, error } = await supabase.functions.invoke('create-payment-intent', {
        body: {
          amount: amountCents,
          description: metadata.campaign_name ?
            `${metadata.campaign_name} - Postcard Campaign` :
            'Postcard Campaign',
          metadata: {
            ...metadata,
            campaign_id: campaignId,
            user_id: targetUserId,
          },
          customerId: customer.stripe_customer_id,
          paymentMethodId: paymentMethod.stripe_payment_method_id,
          campaignId: campaignId,
          isTestMode: isTestMode,
          idempotencyKey: idempotencyKey,
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        console.error('[Payment Service] Error from Edge Function:', error);
        throw error;
      }

      console.log('[Payment Service] Charge response:', response);

      return response;

    } catch (error) {
      console.error('[Payment Service] Error charging campaign:', error);
      throw error;
    }
  },

  /**
   * Legacy function - kept for backward compatibility
   * Charge customer for postcard campaign
   * @param {number} postcardCount - Number of postcards
   * @param {Object} campaignData - Campaign data for metadata
   * @returns {Promise<Object>} Charge result
   * @deprecated Use chargeCampaign() instead
   */
  async chargeForCampaign(postcardCount, campaignData = {}) {
    const { calculatePostcardCost } = await import('../../utils/pricing');

    const pricing = calculatePostcardCost(postcardCount);
    const amountCents = Math.round(pricing.total * 100);

    const metadata = {
      billing_reason: 'campaign_launch',
      postcard_count: postcardCount.toString(),
      campaign_name: campaignData.name || 'Untitled Campaign',
    };

    return await this.chargeCampaign(
      campaignData.campaign_id || 'unknown',
      amountCents,
      metadata
    );
  },

  async confirmSetupIntent(setupIntentId) {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      throw new Error('Not authenticated');
    }

    try {
      const { data: response, error } = await supabase.functions.invoke('confirm-setup-intent', {
        body: { setupIntentId: setupIntentId },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      if (error) {
        console.error('Error confirming setup intent:', error);
        throw error;
      }

      // Check if the response contains an error
      if (response?.error) {
        throw new Error(response.error);
      }

      // Validate response
      if (!response || !response.success) {
        throw new Error('Invalid response from payment confirmation service');
      }

      return response;
    } catch (error) {
      console.error('Failed to confirm setup intent:', error);
      throw error;
    }
  },

  async getPaymentMethods() {
    // Use getSession() to ensure we have a valid JWT token
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session) {
      console.error('[paymentService] No valid session found:', sessionError);
      throw new Error('Not authenticated');
    }

    const user = session.user;
    console.log('[paymentService] Querying with user ID:', user.id);

    try {
      // Try to get customer from customers table
      // Use maybeSingle() instead of single() to handle case where customer doesn't exist
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      // Handle errors (but not "no rows" which is expected if customer doesn't exist)
      if (customerError) {
        console.error('[paymentService] Error querying customers table:', customerError);

        // 406 errors indicate RLS policy issues
        if (customerError.code === 'PGRST116' || customerError.message?.includes('406')) {
          console.error('[paymentService] 406 Error: RLS policies may be blocking access');
          throw new Error('Database access denied. Please contact support.');
        }

        throw customerError;
      }

      // If no customer record exists, return empty array (valid scenario)
      if (!customer) {
        console.log('[paymentService] No customer record found for user');
        return [];
      }

      // Query payment methods for this customer
      const { data, error } = await supabase
        .from('payment_methods')
        .select('*')
        .eq('customer_id', customer.id)
        .order('is_default', { ascending: false });

      if (error) {
        console.error('[paymentService] Error fetching payment methods:', error);

        // Handle 406 errors for payment_methods table
        if (error.code === 'PGRST116' || error.message?.includes('406')) {
          console.error('[paymentService] 406 Error: RLS policies may be blocking access to payment_methods table');
          throw new Error('Database access denied. Please contact support.');
        }

        throw error;
      }

      console.log('[paymentService] Found payment methods:', data?.length || 0);
      return data || [];
    } catch (error) {
      console.error('[paymentService] Error in getPaymentMethods:', error);

      // Re-throw authentication and permission errors
      if (error.message?.includes('406') || error.message?.includes('Database access denied')) {
        throw error;
      }

      // For other errors, return empty array to avoid breaking the UI
      return [];
    }
  },

  async updateOnboardingProgress(step, data) {
    // Use getSession() to ensure we have a valid JWT token
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session) {
      console.error('[paymentService] No valid session found:', sessionError);
      throw new Error('Not authenticated');
    }

    const user = session.user;

    const updateData = {
      current_step: step,
      updated_at: new Date().toISOString(),
    };

    if (step === 5) {
      updateData.payment_completed = true;
    }

    const { error } = await supabase
      .from('onboarding_progress')
      .upsert({
        user_id: user.id,
        ...updateData,
      });

    if (error) {
      console.error('[paymentService] Error updating onboarding progress:', error);
      throw error;
    }
  },

  /**
   * Save a new payment method using Stripe CardElement
   * ✅ FIXED: Now accepts stripe instance as parameter
   * @param {Object} stripe - Stripe instance from useStripe() hook
   * @param {Object} cardElement - Stripe CardElement
   * @returns {Promise<Object>} Result object with success status
   */
  async savePaymentMethod(stripe, cardElement) {
    try {
      // Validate inputs
      if (!stripe) {
        return { success: false, error: 'Stripe is not initialized' };
      }

      if (!cardElement) {
        return { success: false, error: 'Card element is required' };
      }

      // Get session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !session) {
        console.error('[paymentService] No valid session found:', sessionError);
        return { success: false, error: 'Not authenticated' };
      }

      const user = session.user;

      // Get user profile for email
      const { data: profile } = await supabase
        .from('profile')
        .select('email')
        .eq('user_id', user.id)
        .single();

      const email = profile?.email || user.email;

      // Create SetupIntent via Edge Function
      const { data: setupResponse, error: setupError } = await supabase.functions.invoke('create-setup-intent', {
        body: { email },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (setupError || !setupResponse || !setupResponse.clientSecret) {
        // Check if setupResponse has error details from the Edge Function
        const edgeFunctionError = setupResponse?.error || setupResponse?.details;
        const errorMsg = edgeFunctionError || setupError?.message || 'Failed to create setup intent';
        console.error('[paymentService] Setup error:', setupError);
        console.error('[paymentService] Setup response:', setupResponse);
        console.error('[paymentService] Final error message:', errorMsg);
        return { success: false, error: errorMsg };
      }

      // ✅ FIX: Use the stripe instance passed as parameter (same one used for CardElement)
      // Wrap Stripe confirmation with timeout to handle both timeout and actual errors
      const confirmWithTimeout = async () => {
        return Promise.race([
          stripe.confirmCardSetup(
            setupResponse.clientSecret,
            {
              payment_method: {
                card: cardElement,
              },
            }
          ),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Payment confirmation timed out. Please check your connection and try again.')), 30000)
          )
        ]);
      };

      let result;
      try {
        result = await confirmWithTimeout();
      } catch (timeoutError) {
        console.error('[paymentService] Timeout or network error:', timeoutError);
        return { success: false, error: timeoutError.message };
      }

      const { setupIntent, error: confirmError } = result;

      if (confirmError) {
        console.error('[paymentService] Error confirming setup intent:', confirmError);
        return { success: false, error: confirmError.message };
      }

      if (setupIntent.status !== 'succeeded') {
        return { success: false, error: 'Payment method setup failed' };
      }

      const paymentMethod = await stripekey.paymentMethods.retrieve(
        setupIntent.payment_method 
      );

      // Add payment method details to setupIntent object for addPaymentMethod
      setupIntent.payment_method_details = {
        card: {
          brand: paymentMethod?.card?.brand ,
          last4: paymentMethod?.card?.last4,
          exp_month: paymentMethod?.card?.exp_month,
          exp_year: paymentMethod?.card?.exp_year,
        }
      };
      // Add the payment method to database
      await this.addPaymentMethod(setupIntent);

      return { success: true };
    } catch (error) {
      console.error('[paymentService] Error saving payment method:', error);
      return { success: false, error: error.message || 'Failed to save payment method' };
    }
  },

  /**
   * Add a payment method using Stripe SetupIntent
   * @param {Object} setupIntent - Stripe SetupIntent object
   * @returns {Promise<Object>} Created payment method
   */
  async addPaymentMethod(setupIntent) {
    // Use getSession() to ensure we have a valid JWT token
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session) {
      console.error('[paymentService] No valid session found:', sessionError);
      throw new Error('Not authenticated');
    }

    const user = session.user;

    try {
      // Get or create customer
      let { data: customer, error: customerError } = await supabase
        .from('customers')
        .select('id, stripe_customer_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (customerError) {
        console.error('[paymentService] Error getting customer:', customerError);
        throw customerError;
      }

      if (!customer) {
        throw new Error('Customer not found. Please complete onboarding first.');
      }

      // Check if this is the first payment method
      const { data: existingMethods } = await supabase
        .from('payment_methods')
        .select('id')
        .eq('customer_id', customer.id);

      const isFirstMethod = !existingMethods || existingMethods.length === 0;
      // Insert payment method into database
      const { data: paymentMethod, error } = await supabase
        .from('payment_methods')
        .insert({
          customer_id: customer.id,
          stripe_payment_method_id: setupIntent.payment_method,
          card_brand: setupIntent.payment_method_details?.card?.brand || 'unknown',
          card_last4: setupIntent.payment_method_details?.card?.last4 || '0000',
          card_exp_month: setupIntent.payment_method_details?.card?.exp_month || 1,
          card_exp_year: setupIntent.payment_method_details?.card?.exp_year || 2025,
          is_default: isFirstMethod, // First payment method is default
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          type:'card'
        })
        .select()
        .single();

      if (error) {
        console.error('[paymentService] Error inserting payment method:', error);
        throw error;
      }

      return paymentMethod;
    } catch (error) {
      console.error('[paymentService] Error adding payment method:', error);
      throw error;
    }
  },

  /**
   * Set a payment method as default
   * @param {string} paymentMethodId - Payment method ID
   */
  async setDefaultPaymentMethod(paymentMethodId) {
    // Use getSession() to ensure we have a valid JWT token
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session) {
      console.error('[paymentService] No valid session found:', sessionError);
      return { success: false, error: 'Not authenticated' };
    }

    const user = session.user;

    try {
      // Get customer
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (customerError) {
        console.error('[paymentService] Error getting customer:', customerError);
        return { success: false, error: customerError.message };
      }

      if (!customer) {
        return { success: false, error: 'Customer not found' };
      }

      // Remove default flag from all payment methods
      await supabase
        .from('payment_methods')
        .update({ is_default: false })
        .eq('customer_id', customer.id);

      // Set the selected payment method as default
      const { error } = await supabase
        .from('payment_methods')
        .update({
          is_default: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', paymentMethodId)
        .eq('customer_id', customer.id);

      if (error) {
        console.error('[paymentService] Error setting default payment method:', error);
        return { success: false, error: error.message };
      }

      // Log default payment method change to activity logs
      try {
        const { data: pmData } = await supabase
          .from('payment_methods')
          .select('card_brand, card_last4')
          .eq('id', paymentMethodId)
          .single();

        await supabase.from('admin_activity_logs').insert({
          admin_id: null,
          user_id: user.id,
          action_type: 'payment_method_default_changed',
          target_type: 'payment_method',
          target_id: paymentMethodId,
          metadata: {
            card_brand: pmData?.card_brand,
            card_last4: pmData?.card_last4,
            timestamp: new Date().toISOString(),
          },
        });
        console.log('[paymentService] Activity log created for default change');
      } catch (logError) {
        console.error('[paymentService] Failed to create activity log:', logError.message);
        // Don't fail the operation if logging fails
      }

      return { success: true };
    } catch (error) {
      console.error('[paymentService] Error setting default payment method:', error);
      return { success: false, error: error.message || 'Failed to set default payment method' };
    }
  },

  /**
   * Remove a payment method
   * @param {string} paymentMethodId - Payment method ID
   */
  async removePaymentMethod(paymentMethodId) {
    // Use getSession() to ensure we have a valid JWT token
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session) {
      console.error('[paymentService] No valid session found:', sessionError);
      return { success: false, error: 'Not authenticated' };
    }

    const user = session.user;

    try {
      // Get customer
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (customerError) {
        console.error('[paymentService] Error getting customer:', customerError);
        return { success: false, error: customerError.message };
      }

      if (!customer) {
        return { success: false, error: 'Customer not found' };
      }

      // Get payment method details before deleting (for activity log)
      const { data: pmData } = await supabase
        .from('payment_methods')
        .select('card_brand, card_last4')
        .eq('id', paymentMethodId)
        .single();

      // Delete the payment method
      const { error } = await supabase
        .from('payment_methods')
        .delete()
        .eq('id', paymentMethodId)
        .eq('customer_id', customer.id);

      if (error) {
        console.error('[paymentService] Error deleting payment method:', error);
        return { success: false, error: error.message };
      }

      // Log payment method removal to activity logs
      try {
        await supabase.from('admin_activity_logs').insert({
          admin_id: null,
          user_id: user.id,
          action_type: 'payment_method_removed',
          target_type: 'payment_method',
          target_id: paymentMethodId,
          metadata: {
            card_brand: pmData?.card_brand,
            card_last4: pmData?.card_last4,
            timestamp: new Date().toISOString(),
          },
        });
        console.log('[paymentService] Activity log created for removal');
      } catch (logError) {
        console.error('[paymentService] Failed to create activity log:', logError.message);
        // Don't fail the operation if logging fails
      }

      // If this was the default method, set another as default
      const { data: remainingMethods } = await supabase
        .from('payment_methods')
        .select('id, is_default')
        .eq('customer_id', customer.id)
        .limit(1);

      if (remainingMethods && remainingMethods.length > 0 && !remainingMethods[0].is_default) {
        await this.setDefaultPaymentMethod(remainingMethods[0].id);
      }

      return { success: true };
    } catch (error) {
      console.error('[paymentService] Error removing payment method:', error);
      return { success: false, error: error.message || 'Failed to remove payment method' };
    }
  },

  /**
   * Create a Stripe Customer Portal session
   * @param {string} returnUrl - URL to return to after portal session
   * @returns {Promise<Object>} Portal session URL
   */
  async createCustomerPortalSession(returnUrl) {
    // Use getSession() to ensure we have a valid JWT token
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session) {
      console.error('[paymentService] No valid session found:', sessionError);
      throw new Error('Not authenticated');
    }

    try {

      // Call Edge Function to create portal session
      // Note: Edge Function will securely look up customer from database using authenticated user
      const { data: response, error } = await supabase.functions.invoke('create-customer-portal-session', {
        body: {
          returnUrl: returnUrl || window.location.href
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        // Handle 406 errors specifically
        if (error.message?.includes('406') || error.status === 406) {
          console.error('[paymentService] 406 Error creating portal session - RLS policy issue');
          throw new Error('Unable to access billing portal. Database permissions need to be configured. Please run the RLS migration or contact support.');
        }

        throw error;
      }

      // Check if the response contains an error (Edge Function returned error in body)
      if (response?.error) {
        // Check for customer not found errors
        if (response.error.includes('No customer found') || response.error.includes('Customer not found')) {
          console.error('[paymentService] No customer record found for user');
          throw new Error('No billing account found. Please add a payment method first or complete onboarding.');
        }

        throw new Error(response.error);
      }

      // Validate that we got a URL back
      if (!response || !response.url) {
        throw new Error('Invalid response from billing portal service. Please ensure you have added a payment method.');
      }

      return response;
    } catch (error) {
      console.error('[paymentService] Error creating customer portal session:', error);

      // Provide more helpful error messages
      if (error.message?.includes('406')) {
        throw new Error('Database access denied. Please run RLS migration or contact support.');
      }

      if (error.message?.includes('No customer found') || error.message?.includes('Customer not found')) {
        throw new Error('No billing account found. Please add a payment method first.');
      }

      throw error;
    }
  },
};