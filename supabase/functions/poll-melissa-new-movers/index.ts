import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14?target=denonext'

/**
 * MELISSA NEW MOVER POLLING FUNCTION
 *
 * This Edge Function polls Melissa API for new mover data for active campaigns.
 * Designed to run every 30 minutes via cron.
 *
 * Flow:
 * 1. Query active campaigns with polling_enabled=true
 * 2. For each campaign, fetch Melissa data for campaign's ZIP codes
 * 3. Filter for movers discovered after last_polled_at (or approved_at for first poll)
 * 4. For each new mover:
 *    - Save to newmover table
 *    - Send postcard via PostGrid
 *    - Charge user immediately via Stripe ($3.00)
 *    - Create transaction record
 *    - Create pending_charges audit record
 *    - Update campaign totals
 * 5. Update campaign last_polled_at timestamp
 */

// Initialize environment variables
const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const melissaCustomerId = Deno.env.get('MELISSA_CUSTOMER_ID') || ''
const postgridApiKey = Deno.env.get('POSTGRID_API_KEY') || ''
const postgridApiUrl = 'https://api.postgrid.com/print-mail/v1'

// Initialize Stripe
const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
})

const MELISSA_API_URL = 'https://dataretriever.melissadata.net/web/V1/NewMovers/doLookup'

interface Campaign {
  id: string
  user_id: string
  campaign_name: string
  target_zip_codes: string[]
  last_polled_at: string | null
  created_at: string
  postcard_design_url: string
  postcards_sent: number
  total_cost: number
}

interface MelissaMover {
  melissaaddresskey?: string
  MelissaAddressKey?: string
  fullname?: string
  FullName?: string
  AddressLine: string
  city?: string
  City?: string
  state?: string
  State?: string
  MoveEffectiveDate?: string
  PhoneNumber?: string
  PreviousAddressLine?: string
  PreviousZIPCode?: string
}

interface NewMoverRecord {
  melissa_address_key: string
  full_name: string
  address_line: string
  city: string
  state: string
  zip_code: string
  previous_address_line: string | null
  previous_zip_code: string | null
  phone_number: string | null
  move_effective_date: string | null
  campaign_id: string
  discovered_at: string
  postcard_sent: boolean
}

/**
 * Fetch new movers from Melissa API
 */
async function fetchFromMelissa(zipCodes: string[], page = 1): Promise<MelissaMover[]> {
  try {
    const response = await fetch(MELISSA_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        customerid: melissaCustomerId,
        includes: {
          zips: zipCodes.map(zip => ({ zip }))
        },
        columns: [
          'fullname',
          'melissaaddresskey',
          'AddressLine',
          'MoveEffectiveDate',
          'PhoneNumber',
          'city',
          'PreviousAddressLine',
          'PreviousZIPCode',
          'state'
        ],
        pagination: { page }
      })
    })

    if (!response.ok) {
      throw new Error(`Melissa API error: ${response.statusText}`)
    }

    const data = await response.json()
    return data.Results || []
  } catch (error) {
    console.error('Error fetching from Melissa API:', error)
    throw error
  }
}

/**
 * Transform Melissa data to Supabase format
 */
function transformMelissaData(
  melissaResults: MelissaMover[],
  searchedZipCode: string,
  campaignId: string
): NewMoverRecord[] {
  return melissaResults.map(mover => ({
    melissa_address_key: mover.melissaaddresskey || mover.MelissaAddressKey || '',
    full_name: mover.fullname || mover.FullName || 'Resident',
    address_line: mover.AddressLine || '',
    city: mover.city || mover.City || '',
    state: mover.state || mover.State || '',
    zip_code: searchedZipCode,
    previous_address_line: mover.PreviousAddressLine || null,
    previous_zip_code: mover.PreviousZIPCode || null,
    phone_number: mover.PhoneNumber || null,
    move_effective_date: mover.MoveEffectiveDate
      ? new Date(mover.MoveEffectiveDate).toISOString()
      : null,
    campaign_id: campaignId,
    discovered_at: new Date().toISOString(),
    postcard_sent: false,
  }))
}

/**
 * Send postcard via PostGrid API
 */
async function sendPostcard(
  recipient: any,
  designUrl: string,
  campaign: Campaign
): Promise<any> {
  // Parse full name into first/last name
  const nameParts = (recipient.full_name || 'Resident').trim().split(' ')
  const firstName = nameParts[0] || 'Resident'
  const lastName = nameParts.slice(1).join(' ') || ''

  const requestBody = {
    to: {
      firstName: firstName,
      lastName: lastName,
      addressLine1: recipient.address_line,
      city: recipient.city,
      provinceOrState: recipient.state,
      postalOrZip: recipient.zip_code,
      countryCode: 'US',
      ...(recipient.phone_number && { phoneNumber: recipient.phone_number }),
    },
    size: '6x4',
    pdf: designUrl,
    description: campaign.campaign_name || 'New Mover Campaign',
    express: false,
    metadata: {
      campaign_id: campaign.id,
      user_id: campaign.user_id,
      new_mover_id: recipient.id,
      melissa_address_key: recipient.melissa_address_key,
      move_effective_date: recipient.move_effective_date,
    },
  }

  const response = await fetch(`${postgridApiUrl}/postcards`, {
    method: 'POST',
    headers: {
      'x-api-key': postgridApiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  })

  if (!response.ok) {
    const errorData = await response.json()
    throw new Error(
      `PostGrid API error: ${errorData.error?.message || response.statusText}`
    )
  }

  return await response.json()
}

/**
 * Charge user immediately when postcard is sent
 * Returns transaction_id on success, null on failure
 */
async function chargeImmediately(
  campaign: Campaign,
  newMoverId: string,
  melissaAddressKey: string,
  postgridPostcardId: string,
  supabase: any
): Promise<string | null> {
  try {
    console.log(`   💳 Charging user for new mover: ${melissaAddressKey}`)

    // ============================================================================
    // 1. GET CUSTOMER AND PAYMENT METHOD
    // ============================================================================
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id, stripe_customer_id')
      .eq('user_id', campaign.user_id)
      .maybeSingle()

    if (customerError || !customer) {
      console.error(`   ❌ Customer not found for user ${campaign.user_id}:`, customerError)
      return null
    }

    const { data: paymentMethod, error: pmError } = await supabase
      .from('payment_methods')
      .select('stripe_payment_method_id')
      .eq('customer_id', customer.id)
      .eq('is_default', true)
      .maybeSingle()

    if (pmError || !paymentMethod) {
      console.error(`   ❌ Payment method not found for customer ${customer.id}:`, pmError)
      return null
    }

    // ============================================================================
    // 2. CREATE STRIPE PAYMENT INTENT
    // ============================================================================
    const amount = 300 // $3.00 in cents
    const idempotencyKey = `campaign_${campaign.id}_mover_${newMoverId}_${Date.now()}`

    console.log(`   💳 Creating Stripe PaymentIntent for $3.00...`)

    const paymentIntentParams: Stripe.PaymentIntentCreateParams = {
      amount: amount,
      currency: 'usd',
      customer: customer.stripe_customer_id,
      payment_method: paymentMethod.stripe_payment_method_id,
      off_session: true,
      confirm: true,
      error_on_requires_action: false,
      description: `New Mover Postcard - ${campaign.campaign_name}`,
      metadata: {
        user_id: campaign.user_id,
        campaign_id: campaign.id,
        new_mover_id: newMoverId,
        melissa_address_key: melissaAddressKey,
        postgrid_postcard_id: postgridPostcardId,
        billing_reason: 'new_mover_addition',
        is_test_mode: postgridApiKey.startsWith('test_').toString(),
      },
    }

    const paymentIntent = await stripe.paymentIntents.create(
      paymentIntentParams,
      { idempotencyKey }
    )

    console.log(`   ✅ PaymentIntent created: ${paymentIntent.id} (${paymentIntent.status})`)

    // ============================================================================
    // 3. CREATE TRANSACTION RECORD
    // ============================================================================
    const transactionData = {
      user_id: campaign.user_id,
      campaign_id: campaign.id,
      stripe_payment_intent_id: paymentIntent.id,
      stripe_charge_id: paymentIntent.charges?.data[0]?.id || null,
      amount_cents: amount,
      amount_dollars: 3.00,
      currency: 'usd',
      status: paymentIntent.status === 'succeeded' ? 'succeeded' :
              paymentIntent.status === 'processing' ? 'processing' : 'failed',
      billing_reason: 'new_mover_addition',
      is_test_mode: postgridApiKey.startsWith('test_'),
      metadata: {
        new_mover_id: newMoverId,
        melissa_address_key: melissaAddressKey,
        postgrid_postcard_id: postgridPostcardId,
        campaign_name: campaign.campaign_name,
      },
    }

    const { data: transaction, error: txError } = await supabase
      .from('transactions')
      .insert(transactionData)
      .select()
      .single()

    if (txError) {
      console.error(`   ⚠️  Transaction record creation failed:`, txError)
      // Payment succeeded but transaction record failed - log but don't fail
      return null
    }

    console.log(`   💰 Transaction recorded: ${transaction.id} ($3.00)`)

    return transaction.id

  } catch (error: any) {
    console.error(`   ❌ Charge failed:`, error)

    // Handle Stripe errors gracefully
    if (error.type === 'StripeCardError') {
      console.error(`   💳 Card Error: ${error.code} - ${error.message}`)
    } else if (error.type === 'StripeInvalidRequestError') {
      console.error(`   ⚠️  Invalid Request: ${error.message}`)
    } else if (error.type === 'StripeAPIError') {
      console.error(`   🔥 Stripe API Error: ${error.message}`)
    }

    return null
  }
}

/**
 * Process a single campaign
 */
async function processCampaign(
  campaign: Campaign,
  supabase: any,
  results: any
): Promise<void> {
  console.log(`\n📬 Processing campaign: ${campaign.campaign_name} (${campaign.id})`)
  console.log(`   ZIP codes: ${campaign.target_zip_codes.join(', ')}`)

  try {
    // Determine cutoff date for new movers
    // Use last_polled_at if available, otherwise approved_at (to only send to NEW movers after approval)
    const cutoffDate = campaign.last_polled_at || campaign.approved_at || campaign.created_at
    const cutoffSource = campaign.last_polled_at ? 'last_polled_at' : campaign.approved_at ? 'approved_at' : 'created_at'
    console.log(`   Cutoff date (${cutoffSource}): ${cutoffDate}`)

    let newMoversCount = 0

    // Process each ZIP code
    for (const zipCode of campaign.target_zip_codes) {
      console.log(`   🔍 Fetching Melissa data for ZIP: ${zipCode}`)

      // Fetch from Melissa API
      const melissaResults = await fetchFromMelissa([zipCode], 1)
      console.log(`   Found ${melissaResults.length} movers from Melissa for ${zipCode}`)

      if (melissaResults.length === 0) {
        continue
      }

      // Transform data
      const transformedMovers = transformMelissaData(melissaResults, zipCode, campaign.id)

      // Filter for movers discovered after cutoff date
      const newMovers = transformedMovers.filter(mover => {
        if (!mover.move_effective_date) return false
        return new Date(mover.move_effective_date) > new Date(cutoffDate)
      })

      console.log(`   ${newMovers.length} new movers since last poll`)

      // Process each new mover
      for (const mover of newMovers) {
        try {
          // Check if mover already exists (by melissa_address_key)
          const { data: existing } = await supabase
            .from('newmover')
            .select('id')
            .eq('melissa_address_key', mover.melissa_address_key)
            .single()

          if (existing) {
            console.log(`   ⏭️  Skipping existing mover: ${mover.melissa_address_key}`)
            continue
          }

          // Save new mover to database
          const { data: savedMover, error: saveError } = await supabase
            .from('newmover')
            .insert(mover)
            .select()
            .single()

          if (saveError) {
            console.error(`   ❌ Error saving mover:`, saveError)
            results.errors.push({
              campaign_id: campaign.id,
              error: `Failed to save mover: ${saveError.message}`,
              mover: mover.melissa_address_key,
            })
            continue
          }

          console.log(`   ✅ Saved new mover: ${savedMover.full_name}`)

          // Send postcard via PostGrid
          try {
            const postcardResult = await sendPostcard(
              savedMover,
              campaign.postcard_design_url,
              campaign
            )

            console.log(`   📮 Postcard sent via PostGrid: ${postcardResult.id}`)

            // Charge immediately via Stripe
            const transactionId = await chargeImmediately(
              campaign,
              savedMover.id,
              savedMover.melissa_address_key,
              postcardResult.id,
              supabase
            )

            // Update new mover with PostGrid and transaction details
            const moverUpdate: any = {
              postcard_sent: true,
              postcard_sent_at: new Date().toISOString(),
              postgrid_postcard_id: postcardResult.id,
              postgrid_status: postcardResult.status,
            }

            if (transactionId) {
              moverUpdate.transaction_id = transactionId
            }

            await supabase
              .from('newmover')
              .update(moverUpdate)
              .eq('id', savedMover.id)

            // Create pending_charges record for audit trail (already processed)
            if (transactionId) {
              await supabase
                .from('pending_charges')
                .insert({
                  campaign_id: campaign.id,
                  user_id: campaign.user_id,
                  new_mover_count: 1,
                  amount_cents: 300,
                  amount_dollars: 3.00,
                  billing_reason: 'new_mover_addition',
                  scheduled_for: new Date().toISOString().split('T')[0],
                  processed: true, // Already charged immediately
                  processed_at: new Date().toISOString(),
                  is_test_mode: postgridApiKey.startsWith('test_'),
                  metadata: {
                    new_mover_id: savedMover.id,
                    melissa_address_key: savedMover.melissa_address_key,
                    postgrid_postcard_id: postcardResult.id,
                    transaction_id: transactionId,
                    charged_immediately: true,
                  },
                })
            }

            // Update campaign totals
            await supabase
              .from('campaigns')
              .update({
                postcards_sent: campaign.postcards_sent + 1,
                total_cost: campaign.total_cost + 3.00,
              })
              .eq('id', campaign.id)

            newMoversCount++
            results.postcards_sent++
          } catch (postcardError: any) {
            console.error(`   ❌ Error sending postcard:`, postcardError)
            results.errors.push({
              campaign_id: campaign.id,
              error: `Failed to send postcard: ${postcardError.message}`,
              mover: savedMover.full_name,
            })
          }
        } catch (moverError: any) {
          console.error(`   ❌ Error processing mover:`, moverError)
          results.errors.push({
            campaign_id: campaign.id,
            error: `Failed to process mover: ${moverError.message}`,
          })
        }
      }
    }

    // Update campaign last_polled_at
    await supabase
      .from('campaigns')
      .update({ last_polled_at: new Date().toISOString() })
      .eq('id', campaign.id)

    console.log(`   ✨ Campaign processing complete. ${newMoversCount} new postcards sent.`)
    results.campaigns_processed++
  } catch (error: any) {
    console.error(`   ❌ Error processing campaign:`, error)
    results.errors.push({
      campaign_id: campaign.id,
      error: `Campaign processing failed: ${error.message}`,
    })
  }
}

/**
 * Main handler
 */
serve(async (req) => {
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  try {
    console.log('🚀 Starting Melissa new mover polling...')
    console.log(`   Timestamp: ${new Date().toISOString()}`)

    // Validate environment variables
    if (!melissaCustomerId) {
      throw new Error('MELISSA_CUSTOMER_ID not configured')
    }
    if (!postgridApiKey) {
      throw new Error('POSTGRID_API_KEY not configured')
    }

    // ============================================================================
    // FETCH ACTIVE CAMPAIGNS WITH POLLING ENABLED
    // ============================================================================
    const { data: campaigns, error: fetchError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('status', 'active')
      .eq('polling_enabled', true)
      .not('target_zip_codes', 'is', null)
      .not('postcard_design_url', 'is', null)

    if (fetchError) {
      console.error('Error fetching campaigns:', fetchError)
      throw fetchError
    }

    if (!campaigns || campaigns.length === 0) {
      console.log('✅ No active campaigns with polling enabled')
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No campaigns to poll',
          campaigns_processed: 0,
          postcards_sent: 0,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    console.log(`📊 Found ${campaigns.length} campaigns to poll`)

    // ============================================================================
    // PROCESS EACH CAMPAIGN
    // ============================================================================
    const results = {
      campaigns_processed: 0,
      postcards_sent: 0,
      errors: [] as any[],
    }

    for (const campaign of campaigns) {
      await processCampaign(campaign, supabase, results)
    }

    // ============================================================================
    // RETURN RESULTS
    // ============================================================================
    const response = {
      success: true,
      message: 'Polling completed',
      timestamp: new Date().toISOString(),
      campaigns_found: campaigns.length,
      campaigns_processed: results.campaigns_processed,
      postcards_sent: results.postcards_sent,
      errors: results.errors,
    }

    console.log('\n✅ Polling complete!')
    console.log(`   Campaigns processed: ${results.campaigns_processed}`)
    console.log(`   Postcards sent: ${results.postcards_sent}`)
    console.log(`   Errors: ${results.errors.length}`)

    // ============================================================================
    // LOG POLLING ACTIVITY FOR ADMIN DASHBOARD
    // ============================================================================
    if (campaigns && campaigns.length > 0) {
      try {
        await supabase.from('admin_activity_logs').insert({
          admin_id: null, // System-generated event
          user_id: null,
          action_type: 'polling_completed',
          target_type: 'system',
          target_id: null,
          metadata: {
            campaigns_found: campaigns.length,
            campaigns_processed: results.campaigns_processed,
            postcards_sent: results.postcards_sent,
            new_movers_discovered: results.postcards_sent,
            errors_count: results.errors.length,
            timestamp: new Date().toISOString(),
            errors: results.errors.length > 0 ? results.errors : undefined,
          },
        })
        console.log('   📝 Activity log created')
      } catch (logError: any) {
        console.error('   ⚠️  Failed to create activity log:', logError.message)
        // Don't fail the entire polling operation if logging fails
      }
    }

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error: any) {
    console.error('❌ Fatal error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
