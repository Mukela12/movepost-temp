import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import Stripe from 'https://esm.sh/stripe@11.1.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')
console.log('[confirm-setup-intent] Stripe key configured:', !!stripeSecretKey)

if (!stripeSecretKey) {
  console.error('[confirm-setup-intent] CRITICAL: STRIPE_SECRET_KEY is not set!')
}

const stripe = new Stripe(stripeSecretKey || '', {
  apiVersion: '2023-10-16',
})

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { ...corsHeaders, 'X-Function-Version': '2.0' } })
  }

  console.log('[confirm-setup-intent] Request received - Version 2.0')

  try {
    // Get the JWT token from the request
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.error('[confirm-setup-intent] Missing Authorization header')
      throw new Error('Unauthorized: Missing authorization header')
    }

    // Create Supabase client with user's JWT
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    )

    // Extract JWT token from "Bearer <token>" header
    const token = authHeader.replace('Bearer ', '').trim()

    // Verify the JWT and get user (pass token explicitly for Edge Functions)
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)

    if (authError || !user) {
      console.error('[confirm-setup-intent] Auth error:', authError)
      throw new Error('Unauthorized: Invalid token')
    }

    console.log('[confirm-setup-intent] Authenticated user:', user.id)

    // Parse request body
    const { setupIntentId } = await req.json()

    if (!setupIntentId) {
      console.error('[confirm-setup-intent] Missing setupIntentId')
      throw new Error('SetupIntent ID is required')
    }

    console.log('[confirm-setup-intent] SetupIntent ID:', setupIntentId)

    // Retrieve SetupIntent from Stripe with expanded payment method
    console.log('[confirm-setup-intent] Retrieving SetupIntent from Stripe')
    const setupIntent = await stripe.setupIntents.retrieve(setupIntentId, {
      expand: ['payment_method']
    })

    console.log('[confirm-setup-intent] SetupIntent status:', setupIntent.status)

    if (setupIntent.status !== 'succeeded') {
      throw new Error(`SetupIntent has not succeeded. Current status: ${setupIntent.status}`)
    }

    // Get customer from database
    console.log('[confirm-setup-intent] Looking up customer for user:', user.id)
    const { data: customer, error: customerError } = await supabaseClient
      .from('customers')
      .select('id, stripe_customer_id')
      .eq('user_id', user.id)
      .single()

    if (customerError || !customer) {
      console.error('[confirm-setup-intent] Customer not found:', customerError)
      throw new Error('Customer not found for this user. Please complete onboarding first.')
    }

    console.log('[confirm-setup-intent] Found customer:', customer.id)

    // Extract payment method details
    const paymentMethod = setupIntent.payment_method
    let pmDetails

    if (typeof paymentMethod === 'string') {
      console.log('[confirm-setup-intent] Retrieving payment method details')
      pmDetails = await stripe.paymentMethods.retrieve(paymentMethod)
    } else {
      pmDetails = paymentMethod
    }

    console.log('[confirm-setup-intent] Payment method type:', pmDetails.type)
    console.log('[confirm-setup-intent] Card brand:', pmDetails.card?.brand)
    console.log('[confirm-setup-intent] Card last4:', pmDetails.card?.last4)

    // Check if this is the first payment method for this customer
    const { data: existingMethods, error: existingError } = await supabaseClient
      .from('payment_methods')
      .select('id')
      .eq('customer_id', customer.id)

    if (existingError) {
      console.error('[confirm-setup-intent] Error checking existing methods:', existingError)
    }

    const isFirstMethod = !existingMethods || existingMethods.length === 0
    console.log('[confirm-setup-intent] Is first payment method:', isFirstMethod)

    // Save payment method to database
    console.log('[confirm-setup-intent] Saving payment method to database')
    const { data: savedMethod, error: insertError } = await supabaseClient
      .from('payment_methods')
      .insert({
        customer_id: customer.id,
        stripe_payment_method_id: pmDetails.id,
        type: pmDetails.type,
        card_brand: pmDetails.card?.brand || 'unknown',
        card_last4: pmDetails.card?.last4 || '0000',
        card_exp_month: pmDetails.card?.exp_month || 1,
        card_exp_year: pmDetails.card?.exp_year || 2025,
        is_default: isFirstMethod,
        billing_details: pmDetails.billing_details || {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single()

    if (insertError) {
      console.error('[confirm-setup-intent] Error saving payment method:', insertError)
      throw new Error(`Failed to save payment method: ${insertError.message}`)
    }

    console.log('[confirm-setup-intent] Payment method saved:', savedMethod.id)

    // Log payment method addition to activity logs
    try {
      await supabaseClient.from('admin_activity_logs').insert({
        admin_id: null,
        user_id: user.id,
        action_type: 'payment_method_added',
        target_type: 'payment_method',
        target_id: savedMethod.id,
        metadata: {
          card_brand: savedMethod.card_brand,
          card_last4: savedMethod.card_last4,
          is_default: isFirstMethod,
          stripe_payment_method_id: pmDetails.id,
          timestamp: new Date().toISOString(),
        },
      })
      console.log('[confirm-setup-intent] Activity log created')
    } catch (logError: any) {
      console.error('[confirm-setup-intent] Failed to create activity log:', logError.message)
      // Don't fail the operation if logging fails
    }

    // Set as default payment method in Stripe if it's the first one
    if (isFirstMethod) {
      console.log('[confirm-setup-intent] Setting as default payment method in Stripe')
      try {
        await stripe.customers.update(customer.stripe_customer_id, {
          invoice_settings: {
            default_payment_method: pmDetails.id
          }
        })
        console.log('[confirm-setup-intent] Default payment method set in Stripe')
      } catch (stripeError) {
        console.error('[confirm-setup-intent] Error setting default in Stripe:', stripeError)
        // Don't throw - payment method is already saved
      }
    }

    console.log('[confirm-setup-intent] Success!')

    return new Response(
      JSON.stringify({
        success: true,
        paymentMethod: {
          id: savedMethod.id,
          type: savedMethod.type,
          card_brand: savedMethod.card_brand,
          card_last4: savedMethod.card_last4,
          card_exp_month: savedMethod.card_exp_month,
          card_exp_year: savedMethod.card_exp_year,
          is_default: savedMethod.is_default
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Function-Version': '2.0' },
        status: 200,
      },
    )
  } catch (error) {
    console.error('[confirm-setup-intent] Error:', error)
    console.error('[confirm-setup-intent] Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    })

    // Log payment method addition failure to activity logs
    try {
      // Try to get user from auth header if available
      const authHeader = req.headers.get('Authorization')
      if (authHeader) {
        const supabaseClient = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_ANON_KEY') ?? '',
          { global: { headers: { Authorization: authHeader } } }
        )

        const token = authHeader.replace('Bearer ', '').trim()
        const { data: { user } } = await supabaseClient.auth.getUser(token)

        if (user) {
          await supabaseClient.from('admin_activity_logs').insert({
            admin_id: null,
            user_id: user.id,
            action_type: 'payment_method_failed',
            target_type: 'payment_method',
            target_id: null,
            metadata: {
              error: error.message || 'Unknown error',
              timestamp: new Date().toISOString(),
            },
          })
          console.log('[confirm-setup-intent] Failure activity log created')
        }
      }
    } catch (logError: any) {
      console.error('[confirm-setup-intent] Failed to create failure activity log:', logError.message)
      // Don't fail the error response if logging fails
    }

    return new Response(
      JSON.stringify({
        error: error.message || 'Internal server error',
        details: error.toString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Function-Version': '2.0' },
        status: error.message?.includes('Unauthorized') ? 401 :
               error.message?.includes('not found') ? 404 : 500,
      },
    )
  }
})
