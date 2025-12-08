import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import Stripe from 'https://esm.sh/stripe@14?target=denonext'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Initialize Stripe with stable API version (matches working Edge Functions)
const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
})

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  try {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders })
    }

    try {
    // ============================================================================
    // AUTHENTICATION
    // ============================================================================
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing authorization header')
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    )

    // Verify JWT and get user
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser()

    if (userError || !user) {
      throw new Error('Unauthorized')
    }

    // ============================================================================
    // CHECK IF USER IS ADMIN
    // ============================================================================
    const { data: profile } = await supabaseClient
      .from('profile')
      .select('role')
      .eq('user_id', user.id)
      .single()

    const isAdmin = profile && ['admin', 'super_admin'].includes(profile.role)

    // ============================================================================
    // PARSE REQUEST
    // ============================================================================
    const {
      amount,
      description,
      metadata,
      customerId,
      paymentMethodId,
      campaignId,
      isTestMode = false,
      idempotencyKey
    } = await req.json()

    // ============================================================================
    // VALIDATE INPUT
    // ============================================================================
    if (!amount || amount < 50) {
      throw new Error('Amount must be at least $0.50 (50 cents)')
    }

    if (!customerId) {
      throw new Error('Customer ID is required')
    }

    if (!paymentMethodId) {
      throw new Error('Payment method ID is required')
    }

    // ============================================================================
    // VALIDATE CUSTOMER OWNERSHIP
    // ============================================================================
    // Build query - admins can charge any customer, regular users only their own
    let customerQuery = supabaseClient
      .from('customers')
      .select('id, stripe_customer_id, user_id')
      .eq('stripe_customer_id', customerId)

    // Only filter by user_id for non-admin users
    if (!isAdmin) {
      customerQuery = customerQuery.eq('user_id', user.id)
    }

    const { data: customer, error: customerError } = await customerQuery.single()

    if (customerError || !customer) {
      throw new Error('Customer not found or unauthorized')
    }

    // ============================================================================
    // VALIDATE PAYMENT METHOD
    // ============================================================================
    const { data: paymentMethod, error: pmError } = await supabaseClient
      .from('payment_methods')
      .select('id, stripe_payment_method_id, card_exp_month, card_exp_year')
      .eq('customer_id', customer.id)
      .eq('stripe_payment_method_id', paymentMethodId)
      .single()

    if (pmError || !paymentMethod) {
      throw new Error('Payment method not found')
    }

    // Check if card is expired
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth() + 1 // JavaScript months are 0-indexed

    if (
      paymentMethod.card_exp_year < currentYear ||
      (paymentMethod.card_exp_year === currentYear && paymentMethod.card_exp_month < currentMonth)
    ) {
      throw new Error('Payment method has expired. Please update your payment method.')
    }

    // ============================================================================
    // VALIDATE CAMPAIGN OWNERSHIP (if campaignId provided)
    // ============================================================================
    if (campaignId) {
      // Build query - admins can charge any campaign, regular users only their own
      let campaignQuery = supabaseClient
        .from('campaigns')
        .select('id, user_id')
        .eq('id', campaignId)

      // Only filter by user_id for non-admin users
      if (!isAdmin) {
        campaignQuery = campaignQuery.eq('user_id', user.id)
      }

      const { data: campaign, error: campaignError } = await campaignQuery.single()

      if (campaignError || !campaign) {
        throw new Error('Campaign not found or unauthorized')
      }
    }

    // ============================================================================
    // CREATE PAYMENT INTENT
    // ============================================================================
    console.log('Creating PaymentIntent:', {
      amount,
      customerId,
      paymentMethodId,
      campaignId,
      isTestMode,
    })

    const paymentIntentParams: Stripe.PaymentIntentCreateParams = {
      amount: amount, // Amount in cents
      currency: 'usd',
      customer: customerId,
      payment_method: paymentMethodId,
      off_session: true, // CRITICAL: Allows charging without user present
      confirm: true, // Charge immediately
      error_on_requires_action: false, // Don't error on 3D Secure, return requires_action status
      description: description || 'Postcard Campaign Charge',
      metadata: {
        user_id: user.id,
        campaign_id: campaignId || '',
        is_test_mode: isTestMode.toString(),
        ...metadata,
      },
    }

    // Add idempotency key if provided (prevents duplicate charges)
    const requestOptions: Stripe.RequestOptions = {}
    if (idempotencyKey) {
      requestOptions.idempotencyKey = idempotencyKey
    }

    const paymentIntent = await stripe.paymentIntents.create(
      paymentIntentParams,
      requestOptions
    )

    // ============================================================================
    // HANDLE DIFFERENT PAYMENT STATUSES
    // ============================================================================
    console.log('PaymentIntent created:', {
      id: paymentIntent.id,
      status: paymentIntent.status,
      amount: paymentIntent.amount,
    })

    let responseMessage = ''
    let requiresAction = false

    switch (paymentIntent.status) {
      case 'succeeded':
        responseMessage = 'Payment succeeded'
        break
      case 'requires_action':
      case 'requires_source_action':
        responseMessage = 'Payment requires authentication (3D Secure)'
        requiresAction = true
        break
      case 'requires_payment_method':
        responseMessage = 'Payment failed - requires different payment method'
        break
      case 'processing':
        responseMessage = 'Payment is processing'
        break
      default:
        responseMessage = `Payment status: ${paymentIntent.status}`
    }

    // ============================================================================
    // RETURN RESPONSE
    // ============================================================================
    return new Response(
      JSON.stringify({
        success: true,
        paymentIntentId: paymentIntent.id,
        clientSecret: paymentIntent.client_secret,
        status: paymentIntent.status,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        message: responseMessage,
        requiresAction: requiresAction,
        actionUrl: paymentIntent.next_action?.redirect_to_url?.url || null,
        chargeId: paymentIntent.charges?.data[0]?.id || null,
        receiptUrl: paymentIntent.charges?.data[0]?.receipt_url || null,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error: any) {
    console.error('Error creating payment intent:', error)

    // ============================================================================
    // STRIPE ERROR HANDLING
    // ============================================================================
    let errorMessage = error.message || 'Failed to create payment intent'
    let errorCode = 'unknown_error'
    let userFriendlyMessage = 'An error occurred while processing your payment.'

    if (error.type === 'StripeCardError') {
      errorCode = error.code || 'card_error'

      switch (error.code) {
        case 'card_declined':
          userFriendlyMessage = 'Your card was declined. Please try a different payment method.'
          break
        case 'insufficient_funds':
          userFriendlyMessage = 'Insufficient funds. Please use a different payment method.'
          break
        case 'expired_card':
          userFriendlyMessage = 'Your card has expired. Please update your payment method.'
          break
        case 'incorrect_cvc':
          userFriendlyMessage = 'Incorrect CVC code. Please check your card details.'
          break
        case 'processing_error':
          userFriendlyMessage = 'An error occurred while processing your card. Please try again.'
          break
        default:
          userFriendlyMessage = error.message
      }
    } else if (error.type === 'StripeInvalidRequestError') {
      errorCode = 'invalid_request'
      userFriendlyMessage = 'Invalid payment request. Please contact support.'
    } else if (error.type === 'StripeAPIError') {
      errorCode = 'api_error'
      userFriendlyMessage = 'Payment processing is temporarily unavailable. Please try again later.'
    } else if (error.type === 'StripeAuthenticationError') {
      errorCode = 'authentication_error'
      userFriendlyMessage = 'Payment authentication failed. Please contact support.'
    }

      return new Response(
        JSON.stringify({
          success: false,
          error: userFriendlyMessage,
          errorCode: errorCode,
          errorDetails: errorMessage, // For logging/debugging
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        },
      )
    }
  } catch (error: any) {
    // Catch-all for any unexpected errors (e.g., JSON parsing, OPTIONS handler errors)
    console.error('Unexpected error in create-payment-intent:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: 'An unexpected error occurred',
        errorCode: 'unexpected_error',
        errorDetails: error.message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})
