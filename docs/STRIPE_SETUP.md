# Stripe Integration Setup Guide

Complete guide for setting up Stripe payment processing in the Postcard Marketing Platform.

## Table of Contents
1. [Overview](#overview)
2. [Getting Stripe API Keys](#getting-stripe-api-keys)
3. [Environment Configuration](#environment-configuration)
4. [Setting Up Webhooks](#setting-up-webhooks)
5. [Testing with Stripe CLI](#testing-with-stripe-cli)
6. [Test Cards](#test-cards)
7. [Going Live](#going-live)
8. [Troubleshooting](#troubleshooting)

---

## Overview

Our Stripe integration uses the following pattern:
- **SetupIntent** → Save payment method during onboarding (no charge)
- **PaymentIntent** → Charge saved payment method when campaigns are approved
- **Webhooks** → Handle async payment events (3D Secure, processing, failures)
- **Immediate Charging** → Charge users immediately when postcards are sent ($3.00 per postcard)

### Payment Flow
1. User adds card during onboarding → `create-setup-intent` Edge Function
2. Payment method saved to Stripe + database
3. Admin approves campaign → `create-payment-intent` Edge Function (initial charge)
4. Stripe charges the saved payment method
5. Webhook updates database with payment result
6. Polling discovers new movers → Immediate charge via Stripe ($3.00 each)

---

## Getting Stripe API Keys

### 1. Create a Stripe Account
- Go to [https://dashboard.stripe.com/register](https://dashboard.stripe.com/register)
- Complete registration

### 2. Get Test Mode Keys
1. Navigate to [https://dashboard.stripe.com/test/apikeys](https://dashboard.stripe.com/test/apikeys)
2. Copy your **Publishable key** (starts with `pk_test_`)
3. Click "Reveal test key" and copy your **Secret key** (starts with `sk_test_`)

### 3. Get Live Mode Keys (when ready for production)
1. Toggle to "Live mode" in the dashboard
2. Navigate to [https://dashboard.stripe.com/apikeys](https://dashboard.stripe.com/apikeys)
3. Copy your **Publishable key** (starts with `pk_live_`)
4. Copy your **Secret key** (starts with `sk_live_`)

---

## Environment Configuration

### 1. Update `.env` File

Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

### 2. Add Stripe Keys

Add your Stripe keys to `.env`:

```bash
# FRONTEND: Publishable key (safe to expose in client-side code)
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_51xxxxxxxxxxxxx

# BACKEND: Secret key for Edge Functions (NEVER expose to frontend)
STRIPE_SECRET_KEY=sk_test_51xxxxxxxxxxxxx

# BACKEND: Webhook signing secret (get this after setting up webhooks)
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
```

### 3. Add Supabase Service Role Key

Get your service role key from [https://supabase.com/dashboard/project/_/settings/api](https://supabase.com/dashboard/project/_/settings/api):

```bash
# BACKEND: Service Role Key for Edge Functions
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 4. Update Supabase Edge Function Secrets

Upload secrets to Supabase for Edge Functions:

```bash
# Set Stripe Secret Key
supabase secrets set STRIPE_SECRET_KEY=sk_test_51xxxxxxxxxxxxx

# Set Stripe Webhook Secret (after webhook setup)
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx

# Set Supabase Service Role Key
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Set Supabase URL
supabase secrets set SUPABASE_URL=https://your-project.supabase.co
```

Verify secrets are set:
```bash
supabase secrets list
```

---

## Setting Up Webhooks

Webhooks are **critical** for handling async payment events like 3D Secure authentication and processing delays.

### 1. Deploy Webhook Edge Function

First, deploy your webhook handler to Supabase:

```bash
supabase functions deploy stripe-webhook
```

### 2. Get Your Webhook Endpoint URL

Your webhook URL will be:
```
https://[YOUR-PROJECT-REF].supabase.co/functions/v1/stripe-webhook
```

Example:
```
https://abcdefghijklmnop.supabase.co/functions/v1/stripe-webhook
```

### 3. Create Webhook in Stripe Dashboard

#### Test Mode Setup:
1. Go to [https://dashboard.stripe.com/test/webhooks](https://dashboard.stripe.com/test/webhooks)
2. Click "+ Add endpoint"
3. Enter your endpoint URL
4. Select events to listen for:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `payment_intent.requires_action`
   - `payment_intent.processing`
   - `charge.refunded`
   - `payment_method.attached`
   - `payment_method.detached`
5. Click "Add endpoint"
6. **Copy the Signing Secret** (starts with `whsec_`)

#### Live Mode Setup:
Repeat the same steps in live mode when ready for production.

### 4. Update Environment Variables

Add the webhook signing secret to your `.env` file:

```bash
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
```

And to Supabase:

```bash
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
```

### 5. Verify Webhook

Send a test event from the Stripe Dashboard:
1. Go to your webhook endpoint in Stripe
2. Click "Send test webhook"
3. Select `payment_intent.succeeded`
4. Check Supabase logs to confirm receipt:

```bash
supabase functions logs stripe-webhook
```

---

## Testing with Stripe CLI

The Stripe CLI is the best way to test webhooks locally during development.

### 1. Install Stripe CLI

**macOS:**
```bash
brew install stripe/stripe-cli/stripe
```

**Windows:**
```bash
scoop bucket add stripe https://github.com/stripe/scoop-stripe-cli.git
scoop install stripe
```

**Linux:**
```bash
curl -s https://packages.stripe.dev/api/security/keypair/stripe-cli-gpg/public | gpg --dearmor | sudo tee /usr/share/keyrings/stripe.gpg
echo "deb [signed-by=/usr/share/keyrings/stripe.gpg] https://packages.stripe.dev/stripe-cli-debian-local stable main" | sudo tee -a /etc/apt/sources.list.d/stripe.list
sudo apt update
sudo apt install stripe
```

### 2. Login to Stripe

```bash
stripe login
```

This will open a browser window to authenticate.

### 3. Forward Webhooks to Local Edge Function

Start the Supabase local development server:
```bash
supabase start
supabase functions serve stripe-webhook
```

In another terminal, forward Stripe webhooks:
```bash
stripe listen --forward-to http://localhost:54321/functions/v1/stripe-webhook
```

The CLI will output a webhook signing secret (starts with `whsec_`). Add this to your local `.env`:

```bash
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
```

### 4. Trigger Test Events

Trigger events manually:
```bash
stripe trigger payment_intent.succeeded
stripe trigger payment_intent.payment_failed
stripe trigger charge.refunded
```

Check the logs to see webhook handling:
```bash
supabase functions logs stripe-webhook
```

---

## Test Cards

Use these test cards to simulate different payment scenarios.

### Successful Payments

| Card Number | Brand | Description |
|-------------|-------|-------------|
| `4242 4242 4242 4242` | Visa | Succeeds immediately |
| `5555 5555 5555 4444` | Mastercard | Succeeds immediately |
| `3782 822463 10005` | American Express | Succeeds immediately |

### 3D Secure Authentication

| Card Number | Description |
|-------------|-------------|
| `4000 0027 6000 3184` | Requires 3D Secure authentication |
| `4000 0025 0000 3155` | Requires 3D Secure, always succeeds |
| `4000 0082 6000 3178` | Requires 3D Secure, authentication fails |

### Payment Failures

| Card Number | Error Code |
|-------------|------------|
| `4000 0000 0000 0002` | `card_declined` - Generic decline |
| `4000 0000 0000 9995` | `insufficient_funds` |
| `4000 0000 0000 9987` | `lost_card` |
| `4000 0000 0000 9979` | `stolen_card` |
| `4000 0000 0000 0069` | `expired_card` |
| `4000 0000 0000 0127` | `incorrect_cvc` |
| `4000 0000 0000 0119` | `processing_error` |

### Delayed Processing

| Card Number | Description |
|-------------|-------------|
| `4000 0000 0000 0341` | Charge succeeds but payment is processing |

**Test Details:**
- Use any future expiration date (e.g., `12/34`)
- Use any 3-digit CVC (e.g., `123`)
- Use any postal code (e.g., `12345`)

---

## Going Live

### Checklist Before Production

- [ ] **Stripe Account Activated**
  - Completed business verification in Stripe Dashboard
  - Added bank account for payouts

- [ ] **Live API Keys Configured**
  - Updated `.env` with `pk_live_*` and `sk_live_*` keys
  - Updated Supabase secrets with live keys
  - Removed all test keys from production environment

- [ ] **Webhooks Configured**
  - Created live mode webhook endpoint in Stripe
  - Updated `STRIPE_WEBHOOK_SECRET` with live webhook signing secret
  - Verified webhook events are being received

- [ ] **Database Migration**
  - Applied all migrations to production database
  - Verified RLS policies are correct
  - Tested with production Supabase instance

- [ ] **Edge Functions Deployed**
  - `create-setup-intent`
  - `create-payment-intent`
  - `confirm-payment`
  - `stripe-webhook`
  - `poll-melissa-new-movers`

- [ ] **Cron Job Configured**
  - Set up `poll-melissa-new-movers` to run every 30 minutes
  - Verified in Supabase Dashboard → Edge Functions → Cron
  - Confirmed immediate charging works during polling

- [ ] **Testing Completed**
  - Tested complete onboarding flow
  - Tested campaign approval → billing
  - Tested new mover additions → immediate charging ($3.00 per postcard)
  - Tested failed payments and error handling
  - Tested refunds
  - Tested 3D Secure authentication
  - Tested admin transaction monitoring
  - Verified transactions appear in real-time in admin dashboard

- [ ] **Monitoring Setup**
  - Stripe Dashboard alerts configured
  - Supabase logging enabled for Edge Functions
  - Error tracking configured (Sentry, etc.)

### Switching to Live Mode

1. **Update Environment Variables:**

```bash
# .env
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_xxxxxxxxxxxxx
STRIPE_SECRET_KEY=sk_live_xxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx  # Live webhook secret
```

2. **Update Supabase Secrets:**

```bash
supabase secrets set STRIPE_SECRET_KEY=sk_live_xxxxxxxxxxxxx
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
```

3. **Deploy Updated Code:**

```bash
# Deploy Edge Functions
supabase functions deploy create-setup-intent
supabase functions deploy create-payment-intent
supabase functions deploy confirm-payment
supabase functions deploy stripe-webhook
supabase functions deploy poll-melissa-new-movers

# Build and deploy frontend
npm run build
# Deploy to your hosting provider
```

4. **Verify Live Mode:**
   - Check Stripe Dashboard is in "Live mode"
   - Test with a real credit card (charge yourself $0.50 to verify)
   - Immediately refund the test charge
   - Check webhook events are being received
   - Monitor logs for any errors

---

## Troubleshooting

### Webhook Not Receiving Events

**Symptoms:**
- Payments succeed in Stripe but database not updating
- Campaign stays in pending status after approval

**Solutions:**
1. Verify webhook endpoint is correct in Stripe Dashboard
2. Check webhook signing secret matches in `.env` and Supabase secrets
3. Check Supabase Edge Function logs:
   ```bash
   supabase functions logs stripe-webhook
   ```
4. Verify webhook endpoint is publicly accessible (not localhost)
5. Re-send test webhook from Stripe Dashboard

### Payment Method Not Saving

**Symptoms:**
- User completes onboarding but no payment method in database
- Error: "No payment method on file"

**Solutions:**
1. Check `create-setup-intent` Edge Function logs
2. Verify `STRIPE_SECRET_KEY` is set correctly in Supabase secrets
3. Check `payment_methods` table has correct RLS policies
4. Verify Stripe customer was created (check `customers` table)
5. Check browser console for JavaScript errors

### 3D Secure Not Working

**Symptoms:**
- Payment fails immediately instead of showing 3D Secure modal
- Error: "This PaymentIntent requires action"

**Solutions:**
1. Verify `error_on_requires_action: false` in PaymentIntent creation
2. Check frontend is handling `requires_action` status
3. Verify `payment_action_url` is returned and displayed to user
4. Test with 3D Secure test card: `4000 0027 6000 3184`

### Immediate Charging Not Working

**Symptoms:**
- New movers discovered but no charges created
- Transactions not appearing in admin dashboard
- New movers have `postcard_sent: true` but no `transaction_id`

**Solutions:**
1. Verify Stripe API key is set in `poll-melissa-new-movers` Edge Function
2. Check Edge Function logs for Stripe errors:
   ```bash
   supabase functions logs poll-melissa-new-movers
   ```
3. Verify customer has valid payment method attached in Stripe Dashboard
4. Check for failed transactions in database:
   ```sql
   SELECT * FROM transactions
   WHERE status != 'succeeded'
   ORDER BY created_at DESC LIMIT 10;
   ```
5. Manually trigger polling to test:
   ```bash
   curl -X POST https://[PROJECT].supabase.co/functions/v1/poll-melissa-new-movers \
     -H "Authorization: Bearer [ANON_KEY]"
   ```

### Charge Failing with "No Such Customer"

**Symptoms:**
- Error: "No such customer: 'cus_xxxxx'"
- Charge fails immediately

**Solutions:**
1. Verify customer exists in Stripe Dashboard
2. Check `customers` table has correct `stripe_customer_id`
3. Ensure test/live mode keys match (test customer with live key = error)
4. Re-create customer if necessary

### Amount Mismatch

**Symptoms:**
- Charged amount doesn't match expected amount
- Double charges

**Solutions:**
1. Verify postcard count calculation in `campaignService.js:chargeCampaignOnApproval`
2. Check for duplicate webhook events (verify idempotency handling)
3. Verify pricing: `$3.00 per postcard = 300 cents`
4. Check `total_cost` calculation includes all new movers

### Test Mode Data Mixing with Live Data

**Symptoms:**
- Test transactions appearing in live dashboard
- Live transactions in test mode

**Solutions:**
1. Verify `is_test_mode` flag is set correctly
2. Check frontend is using correct publishable key
3. Add visual indicator in admin dashboard (test mode badge)
4. Filter transactions by `is_test_mode` in queries

### Permission Denied Errors

**Symptoms:**
- Error: "permission denied for table transactions"
- RLS policy blocking query

**Solutions:**
1. Verify RLS policies in migration file
2. Check user authentication (JWT token)
3. For Edge Functions, use `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS
4. Test with `supabase db reset` to reapply policies

---

## Additional Resources

- [Stripe API Documentation](https://stripe.com/docs/api)
- [Stripe Testing Guide](https://stripe.com/docs/testing)
- [Stripe Webhooks Guide](https://stripe.com/docs/webhooks)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Stripe CLI Reference](https://stripe.com/docs/stripe-cli)
- [Stripe Security Best Practices](https://stripe.com/docs/security/guide)

---

## Support

If you encounter issues not covered here:

1. Check Stripe Dashboard → Developers → Logs
2. Check Supabase Dashboard → Edge Functions → Logs
3. Review recent webhook events in Stripe Dashboard
4. Contact Stripe Support: [https://support.stripe.com](https://support.stripe.com)
5. Check Supabase Discord: [https://discord.supabase.com](https://discord.supabase.com)
