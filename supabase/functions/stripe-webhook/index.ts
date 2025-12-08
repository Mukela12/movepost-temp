import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import Stripe from 'https://esm.sh/stripe@11.1.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Initialize Stripe
const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2024-11-20.acacia',
})

// Webhook secret for signature verification
const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') || ''

// Initialize Supabase client with service role (bypass RLS)
const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

serve(async (req) => {
  try {
    // ============================================================================
    // VERIFY WEBHOOK SIGNATURE
    // ============================================================================
    const signature = req.headers.get('stripe-signature')
    if (!signature) {
      console.error('Missing Stripe signature header')
      return new Response('Missing signature', { status: 400 })
    }

    const body = await req.text()

    let event: Stripe.Event
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
      console.log(`✅ Webhook verified: ${event.type}`)
    } catch (err: any) {
      console.error(`⚠️ Webhook signature verification failed: ${err.message}`)
      return new Response(`Webhook Error: ${err.message}`, { status: 400 })
    }

    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // ============================================================================
    // HANDLE DIFFERENT EVENT TYPES
    // ============================================================================
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentSuccess(event.data.object as Stripe.PaymentIntent, supabase)
        break

      case 'payment_intent.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.PaymentIntent, supabase)
        break

      case 'payment_intent.requires_action':
        await handleRequiresAction(event.data.object as Stripe.PaymentIntent, supabase)
        break

      case 'charge.refunded':
        await handleRefund(event.data.object as Stripe.Charge, supabase)
        break

      case 'payment_method.attached':
        await handlePaymentMethodAttached(event.data.object as Stripe.PaymentMethod, supabase)
        break

      case 'payment_method.detached':
        await handlePaymentMethodDetached(event.data.object as Stripe.PaymentMethod, supabase)
        break

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 })
  } catch (error: any) {
    console.error('Error processing webhook:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500 }
    )
  }
})

// ============================================================================
// HANDLER: Payment Intent Succeeded
// ============================================================================
async function handlePaymentSuccess(
  paymentIntent: Stripe.PaymentIntent,
  supabase: any
) {
  console.log(`💰 Payment succeeded: ${paymentIntent.id}`)

  const campaignId = paymentIntent.metadata.campaign_id
  const userId = paymentIntent.metadata.user_id
  const billingReason = paymentIntent.metadata.billing_reason || 'campaign_approval'
  const newMoverCount = parseInt(paymentIntent.metadata.new_mover_count || '0')
  const isTestMode = paymentIntent.metadata.is_test_mode === 'true'

  const charge = paymentIntent.charges?.data[0]
  const paymentMethod = charge?.payment_method_details

  try {
    // ============================================================================
    // INSERT TRANSACTION RECORD
    // ============================================================================
    const { data: transaction, error: txError } = await supabase
      .from('transactions')
      .insert({
        user_id: userId,
        campaign_id: campaignId || null,
        stripe_payment_intent_id: paymentIntent.id,
        stripe_charge_id: charge?.id || null,
        stripe_customer_id: paymentIntent.customer as string,
        amount_cents: paymentIntent.amount,
        amount_dollars: paymentIntent.amount / 100,
        currency: paymentIntent.currency,
        status: 'succeeded',
        billing_reason: billingReason,
        new_mover_count: newMoverCount > 0 ? newMoverCount : null,
        payment_method_last4: paymentMethod?.card?.last4 || null,
        payment_method_brand: paymentMethod?.card?.brand || null,
        receipt_url: charge?.receipt_url || null,
        is_test_mode: isTestMode,
        metadata: paymentIntent.metadata,
      })
      .select()
      .single()

    if (txError) {
      console.error('Error inserting transaction:', txError)
      throw txError
    }

    console.log(`✅ Transaction recorded: ${transaction.id}`)

    // ============================================================================
    // LOG SUCCESSFUL TRANSACTION TO ACTIVITY LOGS
    // ============================================================================
    try {
      await supabase.from('admin_activity_logs').insert({
        admin_id: null,
        user_id: userId,
        action_type: 'transaction_succeeded',
        target_type: 'transaction',
        target_id: transaction.id,
        metadata: {
          amount_dollars: transaction.amount_dollars,
          billing_reason: billingReason,
          new_mover_count: newMoverCount > 0 ? newMoverCount : null,
          campaign_id: campaignId,
          stripe_payment_intent_id: paymentIntent.id,
          payment_method_last4: paymentMethod?.card?.last4,
          payment_method_brand: paymentMethod?.card?.brand,
          is_test_mode: isTestMode,
          timestamp: new Date().toISOString(),
        },
      })
      console.log('   📝 Activity log created for successful transaction')
    } catch (logError: any) {
      console.error('   ⚠️  Failed to create activity log:', logError.message)
      // Don't fail the transaction if logging fails
    }

    // ============================================================================
    // UPDATE CAMPAIGN STATUS
    // ============================================================================
    if (campaignId) {
      const { error: campaignError } = await supabase
        .from('campaigns')
        .update({
          payment_status: 'paid',
          payment_intent_id: paymentIntent.id,
          paid_at: new Date().toISOString(),
          payment_requires_action: false,
          payment_action_url: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', campaignId)

      if (campaignError) {
        console.error('Error updating campaign:', campaignError)
      } else {
        console.log(`✅ Campaign ${campaignId} marked as paid`)
      }
    }

    // ============================================================================
    // UPDATE PENDING CHARGES (if this was a batched charge)
    // ============================================================================
    if (billingReason === 'new_mover_addition' && campaignId) {
      const { error: pendingError } = await supabase
        .from('pending_charges')
        .update({
          processed: true,
          processed_at: new Date().toISOString(),
          transaction_id: transaction.id,
        })
        .eq('campaign_id', campaignId)
        .eq('processed', false)

      if (pendingError) {
        console.error('Error updating pending charges:', pendingError)
      } else {
        console.log(`✅ Pending charges marked as processed`)
      }
    }

    // ============================================================================
    // SEND EMAIL NOTIFICATION (optional)
    // ============================================================================
    // You can implement email notification here using Supabase Auth
    // or a third-party service like SendGrid

  } catch (error) {
    console.error('Error handling payment success:', error)
    throw error
  }
}

// ============================================================================
// HANDLER: Payment Intent Failed
// ============================================================================
async function handlePaymentFailed(
  paymentIntent: Stripe.PaymentIntent,
  supabase: any
) {
  console.log(`❌ Payment failed: ${paymentIntent.id}`)

  const campaignId = paymentIntent.metadata.campaign_id
  const userId = paymentIntent.metadata.user_id
  const billingReason = paymentIntent.metadata.billing_reason || 'campaign_approval'
  const newMoverCount = parseInt(paymentIntent.metadata.new_mover_count || '0')
  const isTestMode = paymentIntent.metadata.is_test_mode === 'true'

  const charge = paymentIntent.charges?.data[0]
  const failureCode = charge?.failure_code || paymentIntent.last_payment_error?.code
  const failureMessage = charge?.failure_message || paymentIntent.last_payment_error?.message

  try {
    // ============================================================================
    // INSERT FAILED TRANSACTION RECORD
    // ============================================================================
    const { error: txError } = await supabase
      .from('transactions')
      .insert({
        user_id: userId,
        campaign_id: campaignId || null,
        stripe_payment_intent_id: paymentIntent.id,
        stripe_charge_id: charge?.id || null,
        stripe_customer_id: paymentIntent.customer as string,
        amount_cents: paymentIntent.amount,
        amount_dollars: paymentIntent.amount / 100,
        currency: paymentIntent.currency,
        status: 'failed',
        billing_reason: billingReason,
        new_mover_count: newMoverCount > 0 ? newMoverCount : null,
        failure_code: failureCode || null,
        failure_message: failureMessage || null,
        is_test_mode: isTestMode,
        metadata: paymentIntent.metadata,
      })

    if (txError) {
      console.error('Error inserting failed transaction:', txError)
    } else {
      console.log(`✅ Failed transaction recorded`)
    }

    // ============================================================================
    // LOG FAILED TRANSACTION TO ACTIVITY LOGS
    // ============================================================================
    try {
      await supabase.from('admin_activity_logs').insert({
        admin_id: null,
        user_id: userId,
        action_type: 'transaction_failed',
        target_type: 'transaction',
        target_id: null,
        metadata: {
          amount_dollars: paymentIntent.amount / 100,
          billing_reason: billingReason,
          new_mover_count: newMoverCount > 0 ? newMoverCount : null,
          campaign_id: campaignId,
          stripe_payment_intent_id: paymentIntent.id,
          failure_code: failureCode,
          failure_message: failureMessage,
          is_test_mode: isTestMode,
          timestamp: new Date().toISOString(),
        },
      })
      console.log('   📝 Activity log created for failed transaction')
    } catch (logError: any) {
      console.error('   ⚠️  Failed to create activity log:', logError.message)
      // Don't fail the webhook if logging fails
    }

    // ============================================================================
    // UPDATE CAMPAIGN STATUS TO FAILED
    // ============================================================================
    if (campaignId) {
      const { error: campaignError } = await supabase
        .from('campaigns')
        .update({
          payment_status: 'failed',
          payment_intent_id: paymentIntent.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', campaignId)

      if (campaignError) {
        console.error('Error updating campaign to failed:', campaignError)
      } else {
        console.log(`✅ Campaign ${campaignId} marked as payment failed`)
      }

      // Get user email for notification
      const { data: user } = await supabase
        .from('profile')
        .select('email, full_name')
        .eq('user_id', userId)
        .single()

      if (user) {
        console.log(`📧 Should send payment failure notification to: ${user.email}`)
        // TODO: Implement email notification
        // Example: Send email via Supabase Auth or SendGrid
        // - Subject: "Payment Failed for Campaign"
        // - Body: Include failure reason and link to update payment method
      }
    }

  } catch (error) {
    console.error('Error handling payment failure:', error)
    throw error
  }
}

// ============================================================================
// HANDLER: Payment Requires Action (3D Secure)
// ============================================================================
async function handleRequiresAction(
  paymentIntent: Stripe.PaymentIntent,
  supabase: any
) {
  console.log(`🔐 Payment requires action: ${paymentIntent.id}`)

  const campaignId = paymentIntent.metadata.campaign_id
  const userId = paymentIntent.metadata.user_id
  const isTestMode = paymentIntent.metadata.is_test_mode === 'true'

  try {
    // ============================================================================
    // INSERT PROCESSING TRANSACTION RECORD
    // ============================================================================
    const { error: txError } = await supabase
      .from('transactions')
      .insert({
        user_id: userId,
        campaign_id: campaignId || null,
        stripe_payment_intent_id: paymentIntent.id,
        stripe_customer_id: paymentIntent.customer as string,
        amount_cents: paymentIntent.amount,
        amount_dollars: paymentIntent.amount / 100,
        currency: paymentIntent.currency,
        status: 'processing',
        billing_reason: paymentIntent.metadata.billing_reason || 'campaign_approval',
        is_test_mode: isTestMode,
        metadata: paymentIntent.metadata,
      })

    if (txError) {
      console.error('Error inserting processing transaction:', txError)
    }

    // ============================================================================
    // UPDATE CAMPAIGN WITH ACTION URL
    // ============================================================================
    if (campaignId) {
      const actionUrl = paymentIntent.next_action?.redirect_to_url?.url

      const { error: campaignError } = await supabase
        .from('campaigns')
        .update({
          payment_status: 'processing',
          payment_intent_id: paymentIntent.id,
          payment_requires_action: true,
          payment_action_url: actionUrl || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', campaignId)

      if (campaignError) {
        console.error('Error updating campaign with action required:', campaignError)
      } else {
        console.log(`✅ Campaign ${campaignId} marked as requiring action`)
      }

      // Get user email for notification
      const { data: user } = await supabase
        .from('profile')
        .select('email, full_name')
        .eq('user_id', userId)
        .single()

      if (user && actionUrl) {
        console.log(`📧 Should send 3D Secure notification to: ${user.email}`)
        console.log(`🔗 Action URL: ${actionUrl}`)
        // TODO: Implement email notification
        // - Subject: "Action Required: Complete Payment Authentication"
        // - Body: Include link to complete 3D Secure authentication
      }
    }

  } catch (error) {
    console.error('Error handling requires action:', error)
    throw error
  }
}

// ============================================================================
// HANDLER: Charge Refunded
// ============================================================================
async function handleRefund(charge: Stripe.Charge, supabase: any) {
  console.log(`💸 Charge refunded: ${charge.id}`)

  const paymentIntentId = charge.payment_intent as string

  try {
    // Find the transaction
    const { data: transaction, error: findError } = await supabase
      .from('transactions')
      .select('*')
      .eq('stripe_payment_intent_id', paymentIntentId)
      .single()

    if (findError || !transaction) {
      console.error('Transaction not found for refund:', findError)
      return
    }

    // Determine refund status
    const refundStatus = charge.refunded ? 'refunded' : 'partially_refunded'
    const refundAmount = charge.amount_refunded

    // Update transaction
    const { error: updateError } = await supabase
      .from('transactions')
      .update({
        status: refundStatus,
        refunded_at: new Date().toISOString(),
        refund_amount_cents: refundAmount,
        updated_at: new Date().toISOString(),
      })
      .eq('id', transaction.id)

    if (updateError) {
      console.error('Error updating transaction refund status:', updateError)
    } else {
      console.log(`✅ Transaction ${transaction.id} updated to ${refundStatus}`)
    }

    // ============================================================================
    // LOG REFUND TO ACTIVITY LOGS
    // ============================================================================
    try {
      await supabase.from('admin_activity_logs').insert({
        admin_id: null,
        user_id: transaction.user_id,
        action_type: 'transaction_refunded',
        target_type: 'transaction',
        target_id: transaction.id,
        metadata: {
          original_amount_dollars: transaction.amount_dollars,
          refund_amount_dollars: refundAmount / 100,
          refund_status: refundStatus,
          campaign_id: transaction.campaign_id,
          stripe_payment_intent_id: paymentIntentId,
          stripe_charge_id: charge.id,
          timestamp: new Date().toISOString(),
        },
      })
      console.log('   📝 Activity log created for refund')
    } catch (logError: any) {
      console.error('   ⚠️  Failed to create activity log:', logError.message)
      // Don't fail the webhook if logging fails
    }

    // If campaign was refunded, update campaign status
    if (transaction.campaign_id && charge.refunded) {
      const { error: campaignError } = await supabase
        .from('campaigns')
        .update({
          payment_status: 'refunded',
          updated_at: new Date().toISOString(),
        })
        .eq('id', transaction.campaign_id)

      if (campaignError) {
        console.error('Error updating campaign refund status:', campaignError)
      } else {
        console.log(`✅ Campaign ${transaction.campaign_id} marked as refunded`)
      }
    }

  } catch (error) {
    console.error('Error handling refund:', error)
    throw error
  }
}

// ============================================================================
// HANDLER: Payment Method Attached
// ============================================================================
async function handlePaymentMethodAttached(
  paymentMethod: Stripe.PaymentMethod,
  supabase: any
) {
  console.log(`💳 Payment method attached: ${paymentMethod.id}`)

  // This event is already handled by the confirm-setup-intent function
  // We're just logging it here for audit purposes

  // You could implement additional logging or analytics here
}

// ============================================================================
// HANDLER: Payment Method Detached
// ============================================================================
async function handlePaymentMethodDetached(
  paymentMethod: Stripe.PaymentMethod,
  supabase: any
) {
  console.log(`🗑️ Payment method detached: ${paymentMethod.id}`)

  // The payment_methods table should be updated via frontend API calls
  // This is just for logging/audit purposes

  // You could implement additional cleanup or logging here
}
