import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.11.0?target=deno'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('[create-customer-record] Starting customer creation')

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    })

    // Get the authorization header from the request
    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')

    // Get authenticated user
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)

    if (authError || !user) {
      console.error('[create-customer-record] Auth error:', authError)
      return new Response(
        JSON.stringify({ error: 'Unauthorized', details: authError?.message }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401
        }
      )
    }

    console.log('[create-customer-record] User authenticated:', user.id)

    // Get user email
    const email = user.email
    if (!email) {
      console.error('[create-customer-record] No email found for user')
      return new Response(
        JSON.stringify({ error: 'No email found for user' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      )
    }

    console.log('[create-customer-record] Email:', email)

    // Check if customer already exists in Supabase
    const { data: existingCustomer, error: customerQueryError } = await supabaseClient
      .from('customers')
      .select('id, stripe_customer_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (existingCustomer?.stripe_customer_id) {
      console.log('[create-customer-record] Customer already exists:', existingCustomer.stripe_customer_id)
      return new Response(
        JSON.stringify({
          success: true,
          customerId: existingCustomer.id,
          stripeCustomerId: existingCustomer.stripe_customer_id,
          message: 'Customer already exists'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      )
    }

    console.log('[create-customer-record] No existing customer, creating new Stripe customer')

    // Check if customer exists in Stripe by email
    const existingCustomers = await stripe.customers.list({
      email: email,
      limit: 1
    })

    let stripeCustomer
    if (existingCustomers.data.length > 0) {
      console.log('[create-customer-record] Found existing Stripe customer')
      stripeCustomer = existingCustomers.data[0]
    } else {
      console.log('[create-customer-record] Creating new Stripe customer')

      // Get user profile for additional info (optional)
      const { data: profile } = await supabaseClient
        .from('profile')
        .select('business_name, company_name')
        .eq('user_id', user.id)
        .maybeSingle()

      stripeCustomer = await stripe.customers.create({
        email: email,
        name: profile?.business_name || profile?.company_name || email,
        metadata: {
          source: 'postcard_app',
          user_id: user.id,
          created_via: 'onboarding'
        }
      })
      console.log('[create-customer-record] Stripe customer created:', stripeCustomer.id)
    }

    // Save customer to Supabase
    console.log('[create-customer-record] Saving customer to Supabase')
    const { data: savedCustomer, error: insertError } = await supabaseClient
      .from('customers')
      .upsert({
        user_id: user.id,
        stripe_customer_id: stripeCustomer.id,
        email: email,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      })
      .select()
      .single()

    if (insertError) {
      console.error('[create-customer-record] Error saving customer:', insertError)
      return new Response(
        JSON.stringify({ error: 'Failed to save customer', details: insertError.message }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500
        }
      )
    }

    console.log('[create-customer-record] Customer saved successfully')

    return new Response(
      JSON.stringify({
        success: true,
        customerId: savedCustomer.id,
        stripeCustomerId: stripeCustomer.id,
        message: 'Customer created successfully'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error) {
    console.error('[create-customer-record] Error:', error)
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})
