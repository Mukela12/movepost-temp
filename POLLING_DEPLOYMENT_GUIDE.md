# Melissa Polling & PostGrid Integration - Deployment Guide

## Overview

This guide covers the deployment and testing of the new Melissa polling system that continuously monitors for new movers and automatically sends postcards via PostGrid.

### What Changed

**Before:** Campaigns fetched Melissa data once during creation and never checked for new movers again.

**After:** Campaigns poll Melissa API every 30 minutes, automatically sending postcards to newly discovered movers and charging clients immediately ($3.00 per postcard).

---

## Prerequisites

- [x] Supabase project with Edge Functions enabled
- [x] PostGrid account with API credentials
- [x] Melissa Data API access
- [x] Supabase CLI installed (`npm install -g supabase`)

---

## Deployment Steps

### 1. Run Database Migrations

Apply the database schema changes to add polling fields:

```bash
cd /Users/mukelakatungu/Postcard-frontend

# Apply polling fields migration
supabase db push

# Or manually apply migrations
supabase migration up
```

**Migrations to apply:**
- `20251206_add_polling_fields.sql` - Adds polling columns to campaigns and newmover tables
- `20251206_configure_polling_cron.sql` - Sets up cron job for 30-minute polling
- `20251208000004_fix_polling_frequency_default.sql` - Updates default polling frequency to 0.5 hours (30 minutes)

**Verify migrations:**
```sql
-- Check campaigns table has new columns
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'campaigns'
AND column_name IN ('polling_enabled', 'last_polled_at', 'polling_frequency_hours');

-- Check newmover table has new columns
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'newmover'
AND column_name IN ('discovered_at', 'postcard_sent', 'postgrid_postcard_id');
```

---

### 2. Deploy Edge Function

Deploy the Melissa polling Edge Function to Supabase:

```bash
# Navigate to project root
cd /Users/mukelakatungu/Postcard-frontend

# Deploy the polling function
supabase functions deploy poll-melissa-new-movers

# Verify deployment
supabase functions list
```

**Expected output:**
```
┌──────────────────────────────┬─────────┬──────────────────┐
│ Function                     │ Status  │ Last Deployed    │
├──────────────────────────────┼─────────┼──────────────────┤
│ poll-melissa-new-movers      │ Active  │ 2025-12-06 10:00 │
└──────────────────────────────┴─────────┴──────────────────┘
```

---

### 3. Configure Environment Variables

Set required environment variables in Supabase Dashboard:

**Go to:** Supabase Dashboard → Project Settings → Edge Functions → Configuration

**Add these secrets:**

```bash
MELISSA_CUSTOMER_ID=k1QaFUgJ-EgAmdhd6lEhRF**
POSTGRID_API_KEY=test_sk_atqJdHXcCuPdBENzNnDUTh
SUPABASE_URL=https://cbombaxhlvproggupdrn.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

**Verify configuration:**
```bash
supabase secrets list
```

---

### 4. Verify Cron Job Schedule

Check that the cron job is properly scheduled:

```sql
-- View all cron jobs
SELECT * FROM get_cron_jobs();

-- Expected result:
-- jobname: poll-melissa-new-movers
-- schedule: */30 * * * *  (every 30 minutes)
-- active: true
```

**If cron job is missing:**
```sql
-- Re-run the cron configuration migration
-- Or manually schedule:
SELECT cron.schedule(
  'poll-melissa-new-movers',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url:='https://cbombaxhlvproggupdrn.supabase.co/functions/v1/poll-melissa-new-movers',
    headers:=jsonb_build_object(
      'Content-Type', 'application/json'
    ),
    body:='{}'::jsonb
  ) AS request_id;
  $$
);
```

---

### 5. Build and Deploy Frontend

Build and deploy the updated frontend with polling UI:

```bash
# Install dependencies (if needed)
npm install

# Build production bundle
npm run build

# Deploy to your hosting platform (example for Vercel)
vercel --prod

# Or for other platforms, upload the /dist folder
```

**Verify frontend changes:**
- Campaign Step 4: Should NOT fetch Melissa data immediately
- Campaign Step 5: Should set `polling_enabled: true`
- Admin Dashboard: Should display PollingStatusBadge

---

## Testing Guide

### Test 1: Create New Campaign

**Objective:** Verify that campaigns start with 0 recipients and polling enabled.

**Steps:**
1. Go to `/campaign/step1` and enter business URL
2. Select template in Step 2
3. Customize design in Step 3
4. In Step 4, enter test ZIP codes: `10001, 10002`
5. Click "Validate ZIP Codes"
6. **Expected:** No Melissa fetch happens, shows "ZIP codes validated!"
7. Continue to Step 5 and activate campaign

**Verification:**
```sql
SELECT
  id,
  campaign_name,
  total_recipients,
  postcards_sent,
  polling_enabled,
  polling_frequency_hours,
  target_zip_codes
FROM campaigns
ORDER BY created_at DESC
LIMIT 1;

-- Expected:
-- total_recipients: 0
-- postcards_sent: 0
-- polling_enabled: true
-- polling_frequency_hours: 0.5
```

---

### Test 2: Manual Polling Trigger

**Objective:** Test the polling function manually without waiting for cron.

**Steps:**

**Option A: Via Supabase Dashboard**
1. Go to Supabase Dashboard → Edge Functions
2. Find `poll-melissa-new-movers`
3. Click "Invoke" button
4. Send empty request body: `{}`
5. Check response and logs

**Option B: Via SQL**
```sql
SELECT net.http_post(
  url:='https://cbombaxhlvproggupdrn.supabase.co/functions/v1/poll-melissa-new-movers',
  headers:=jsonb_build_object('Content-Type', 'application/json'),
  body:='{}'::jsonb
) AS request_id;
```

**Option C: Via cURL**
```bash
curl -X POST \
  'https://cbombaxhlvproggupdrn.supabase.co/functions/v1/poll-melissa-new-movers' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -d '{}'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Polling completed",
  "timestamp": "2025-12-06T10:30:00.000Z",
  "campaigns_found": 1,
  "campaigns_processed": 1,
  "postcards_sent": 3,
  "errors": []
}
```

**Verify in database:**
```sql
-- Check new movers were saved
SELECT COUNT(*) FROM newmover
WHERE postcard_sent = true
AND created_at > NOW() - INTERVAL '5 minutes';

-- Check PostGrid postcards created
SELECT
  id,
  full_name,
  address_line,
  postcard_sent,
  postgrid_postcard_id,
  postgrid_status
FROM newmover
WHERE postcard_sent = true
ORDER BY postcard_sent_at DESC
LIMIT 5;

-- Check pending charges created
SELECT
  campaign_id,
  new_mover_count,
  amount_dollars,
  scheduled_for,
  processed
FROM pending_charges
WHERE created_at > NOW() - INTERVAL '5 minutes';
```

---

### Test 3: PostGrid Integration

**Objective:** Verify postcards are actually sent to PostGrid API.

**Steps:**

1. **Check PostGrid Dashboard:**
   - Go to: https://dashboard.postgrid.com/
   - Navigate to "Postcards" section
   - Look for recently created postcards

2. **Verify in database:**
```sql
SELECT
  n.id,
  n.full_name,
  n.address_line,
  n.city,
  n.state,
  n.zip_code,
  n.postgrid_postcard_id,
  n.postgrid_status,
  n.postcard_sent_at,
  c.postcard_design_url
FROM newmover n
JOIN campaigns c ON c.id = n.campaign_id
WHERE n.postgrid_postcard_id IS NOT NULL
ORDER BY n.postcard_sent_at DESC
LIMIT 10;
```

3. **Check PostGrid API directly:**
```bash
curl -X GET \
  'https://api.postgrid.com/print-mail/v1/postcards/POSTCARD_ID' \
  -H 'x-api-key: test_sk_atqJdHXcCuPdBENzNnDUTh'
```

**Expected:**
- PostGrid should show postcards with status "ready" (test mode)
- `postgrid_postcard_id` should be populated
- `postgrid_status` should be "ready"

---

### Test 4: Immediate Charging Flow

**Objective:** Verify users are charged immediately when postcards are sent.

**Steps:**

1. **Trigger polling manually** (see Test 2) to discover new movers

2. **Verify immediate transactions created:**
```sql
-- Check transactions created in last 5 minutes
SELECT
  id,
  campaign_id,
  amount_dollars,
  status,
  billing_reason,
  stripe_payment_intent_id,
  is_test_mode,
  created_at
FROM transactions
WHERE billing_reason = 'new_mover_addition'
AND created_at > NOW() - INTERVAL '5 minutes'
ORDER BY created_at DESC;
```

3. **Verify newmover records linked to transactions:**
```sql
-- Check new movers with transaction IDs
SELECT
  n.id,
  n.full_name,
  n.postcard_sent,
  n.postcard_sent_at,
  n.transaction_id,
  t.amount_dollars,
  t.status as payment_status,
  t.stripe_payment_intent_id
FROM newmover n
JOIN transactions t ON t.id = n.transaction_id
WHERE n.postcard_sent = true
AND n.postcard_sent_at > NOW() - INTERVAL '5 minutes'
ORDER BY n.postcard_sent_at DESC
LIMIT 10;
```

4. **Check Stripe Dashboard:**
   - Go to https://dashboard.stripe.com/test/payments
   - Verify PaymentIntents were created and succeeded
   - Amount should be $3.00 per postcard

**Expected:**
- Transaction records created immediately (within seconds of polling)
- Each transaction linked to a specific new mover via `transaction_id`
- Stripe PaymentIntents show status "succeeded"
- Campaign `total_cost` updated in real-time

---

### Test 5: Admin Dashboard

**Objective:** Verify polling status is visible in admin dashboard.

**Steps:**

1. Log in as admin user
2. Navigate to Admin → Campaigns
3. Click on a campaign with polling enabled
4. **Expected UI elements:**
   - ✅ Header shows "Polling Active" badge
   - ✅ "Polling Information" card displays:
     - Polling status with pulse animation
     - Last polled timestamp
     - Postcards sent count
     - Total charged amount
     - "How polling works" explanation

5. **Verify badge states:**
   - Active campaign with `polling_enabled: true` → Green "Polling Active"
   - Campaign with `polling_enabled: false` → Gray "Polling Disabled"

---

### Test 6: Cron Job Execution

**Objective:** Verify cron job runs automatically every 30 minutes.

**Steps:**

1. **Wait for next scheduled run** (runs every 30 minutes, so wait up to 30 minutes)

2. **Check cron job execution history:**
```sql
SELECT * FROM get_cron_job_runs('poll-melissa-new-movers', 5);
```

**Expected columns:**
- `status`: 'succeeded'
- `start_time`: Recent timestamp
- `end_time`: Within seconds of start_time
- `return_message`: NULL (success)

3. **Monitor Edge Function logs:**
   - Go to Supabase Dashboard → Edge Functions → poll-melissa-new-movers
   - Click "Logs" tab
   - Look for recent invocations

**Expected log output:**
```
🚀 Starting Melissa new mover polling...
📊 Found 2 campaigns to poll
📬 Processing campaign: Test Campaign (abc123)
   🔍 Fetching Melissa data for ZIP: 10001
   Found 5 movers from Melissa for 10001
   2 new movers since last poll
   ✅ Saved new mover: John Doe
   📮 Postcard sent via PostGrid: postcard_xyz123
   💳 Charged $3.00 immediately via Stripe
   ✅ Transaction created: txn_xyz123
✅ Polling complete!
   Campaigns processed: 2
   Postcards sent: 4
   Total charged: $12.00
```

---

## Monitoring & Maintenance

### View Cron Job Status

```sql
-- List all cron jobs
SELECT * FROM get_cron_jobs();

-- View recent polling executions
SELECT * FROM get_cron_job_runs('poll-melissa-new-movers', 10);
```

### Pause/Resume Polling

**Pause polling globally:**
```sql
SELECT cron.unschedule('poll-melissa-new-movers');
```

**Resume polling:**
```sql
-- Re-run step 2 from the cron migration file
SELECT cron.schedule(
  'poll-melissa-new-movers',
  '*/30 * * * *',
  $$ ... $$  -- Full command from migration
);
```

**Pause polling for specific campaign:**
```sql
UPDATE campaigns
SET polling_enabled = false
WHERE id = 'campaign-id-here';
```

### Monitor Costs

```sql
-- Total postcards sent today
SELECT
  COUNT(*) as postcards_sent,
  COUNT(*) * 3.00 as total_cost
FROM newmover
WHERE postcard_sent = true
AND postcard_sent_at::date = CURRENT_DATE;

-- Postcards sent per campaign (last 7 days)
SELECT
  c.campaign_name,
  COUNT(n.id) as postcards_sent,
  COUNT(n.id) * 3.00 as total_cost
FROM campaigns c
LEFT JOIN newmover n ON n.campaign_id = c.id AND n.postcard_sent = true
WHERE n.postcard_sent_at > NOW() - INTERVAL '7 days'
GROUP BY c.id, c.campaign_name
ORDER BY postcards_sent DESC;

-- Total revenue collected today (from immediate charges)
SELECT
  COUNT(*) as transactions_count,
  SUM(amount_dollars) as total_revenue
FROM transactions
WHERE billing_reason = 'new_mover_addition'
AND created_at::date = CURRENT_DATE;
```

---

## Troubleshooting

### Issue: Polling function not running

**Check:**
1. Verify cron job is scheduled: `SELECT * FROM get_cron_jobs();`
2. Check Edge Function is deployed: `supabase functions list`
3. Verify environment variables are set in Supabase Dashboard
4. Check Edge Function logs for errors

**Solution:**
```sql
-- Re-schedule cron job
SELECT cron.unschedule('poll-melissa-new-movers');
SELECT cron.schedule( ... );  -- From migration file
```

### Issue: PostGrid API errors

**Check:**
1. Verify `POSTGRID_API_KEY` is set correctly
2. Check PostGrid API status: https://status.postgrid.com/
3. Review Edge Function logs for specific error messages

**Common errors:**
- `Invalid API key` → Check environment variable
- `Contact validation failed` → Check address format in newmover data
- `PDF URL invalid` → Verify campaign `postcard_design_url` is accessible

### Issue: No new movers found

**Check:**
1. Verify Melissa API credentials are correct
2. Check if ZIP codes actually have new movers
3. Review `last_polled_at` timestamp - may be filtering too aggressively

**Debug query:**
```sql
-- Check campaign polling state
SELECT
  campaign_name,
  target_zip_codes,
  polling_enabled,
  last_polled_at,
  created_at,
  postcards_sent
FROM campaigns
WHERE status = 'active'
AND polling_enabled = true;
```

### Issue: Charges not happening immediately

**Check:**
1. Verify Stripe API key is set in Edge Function environment variables
2. Check Edge Function logs for Stripe API errors
3. Verify customer has valid payment method attached
4. Check transactions table for failed payment statuses

**Debug query:**
```sql
-- Check recent failed transactions
SELECT
  id,
  campaign_id,
  amount_dollars,
  status,
  created_at
FROM transactions
WHERE status != 'succeeded'
AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;
```

---

## Rollback Instructions

If you need to rollback the polling feature:

### 1. Disable Cron Job
```sql
SELECT cron.unschedule('poll-melissa-new-movers');
```

### 2. Disable Polling for All Campaigns
```sql
UPDATE campaigns
SET polling_enabled = false
WHERE polling_enabled = true;
```

### 3. Revert Frontend (Optional)
```bash
git revert <commit-hash>
npm run build
# Deploy previous version
```

### 4. Keep Database Schema
**Note:** Do NOT drop the new columns as they may already contain data. Simply disable polling.

---

## Production Checklist

Before going live:

- [ ] All migrations applied successfully
- [ ] Edge Function `poll-melissa-new-movers` deployed
- [ ] Environment variables configured in Supabase
- [ ] Cron job scheduled and active
- [ ] PostGrid API key switched from test to live mode
- [ ] Frontend deployed with polling UI
- [ ] Test campaign created and verified
- [ ] Manually triggered polling test successful
- [ ] PostGrid integration verified
- [ ] Charging flow tested end-to-end
- [ ] Admin dashboard displaying polling status
- [ ] Monitoring queries saved for production use
- [ ] Team trained on new workflow
- [ ] Client notified about new polling behavior

---

## Support & Resources

**Documentation:**
- PostGrid API: https://postgrid.readme.io/docs/sending-postcards-using-the-api
- Melissa Data API: https://www.melissa.com/developer/new-movers
- Supabase Edge Functions: https://supabase.com/docs/guides/functions
- Supabase pg_cron: https://supabase.com/docs/guides/database/extensions/pg_cron

**Contact:**
- PostGrid Support: support@postgrid.com
- Melissa Data Support: https://www.melissa.com/support
- Supabase Support: https://supabase.com/support

---

## Summary

The Melissa polling system is now fully deployed and configured to:
- ✅ Poll Melissa API every 30 minutes for new movers
- ✅ Automatically send postcards via PostGrid when new movers are discovered
- ✅ Charge clients $3.00 immediately per postcard sent (via Stripe)
- ✅ Create transaction records in real-time
- ✅ Display polling status in admin dashboard

**Next Steps:**
1. Monitor first few polling cycles (every 30 minutes)
2. Verify PostGrid delivery status
3. Confirm Stripe charges succeed immediately
4. Check transactions appear in admin dashboard in real-time
5. Gather user feedback on new workflow
