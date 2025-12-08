# Postcard New Mover Marketing Platform

A comprehensive automated postcard marketing platform for targeting new movers. The system automatically discovers new movers via Melissa API, sends personalized postcards through PostGrid, and processes payments via Stripe - all completely automated.

## 🎯 Key Features

- **Automated New Mover Discovery**: Polls Melissa API every 30 minutes for new movers in target ZIP codes
- **Instant Postcard Sending**: Automatically sends postcards via PostGrid when new movers are found
- **Immediate Stripe Charging**: Charges $3.00 per postcard instantly when sent (no batch processing)
- **Admin Approval Workflow**: Campaigns require admin approval before polling begins
- **Real-time Transaction Tracking**: All charges visible immediately in admin dashboard
- **Complete Activity Logging**: Full audit trail of all admin and system actions
- **User Management**: Block/unblock users, view detailed user profiles
- **Campaign Analytics**: Track postcards sent, costs, and campaign performance

---

## 📋 Table of Contents

1. [System Architecture](#system-architecture)
2. [Prerequisites](#prerequisites)
3. [Installation](#installation)
4. [Environment Variables](#environment-variables)
5. [Database Setup](#database-setup)
6. [Edge Functions](#edge-functions)
7. [Workflows](#workflows)
8. [Admin Dashboard](#admin-dashboard)
9. [Database Schema](#database-schema)
10. [API Reference](#api-reference)
11. [Known Issues](#known-issues)
12. [Troubleshooting](#troubleshooting)

---

## 🏗️ System Architecture

```
┌─────────────┐      ┌──────────────┐      ┌─────────────┐
│   React     │─────▶│   Supabase   │─────▶│  PostgreSQL │
│   Frontend  │      │ Edge Functions│      │   Database  │
└─────────────┘      └──────────────┘      └─────────────┘
                            │
                            ├─────▶ Melissa API (New Mover Data)
                            ├─────▶ PostGrid API (Postcard Sending)
                            └─────▶ Stripe API (Payment Processing)
```

### Tech Stack

**Frontend:**
- React 18 + Vite
- Framer Motion (animations)
- React Hot Toast (notifications)
- IMG.LY Creative Engine (postcard editor)

**Backend:**
- Supabase (PostgreSQL + Edge Functions)
- Row Level Security (RLS) for data protection

**External Services:**
- **Melissa API**: New mover data discovery
- **PostGrid API**: Automated postcard mailing
- **Stripe API**: Payment processing
- **Cloudinary**: Image hosting
- **Brandfetch**: Company branding data

---

## 📦 Prerequisites

- Node.js v20.19+ or v22.12+
- npm or yarn
- Supabase account with Edge Functions enabled
- Stripe account (test and live keys)
- PostGrid account
- Melissa API credentials

---

## 🚀 Installation

### 1. Clone and Install

```bash
git clone <repository-url>
cd Postcard-frontend
npm install
```

### 2. Environment Configuration

Create `.env` file:

```bash
cp .env.example .env
```

Update `.env` with your credentials (see [Environment Variables](#environment-variables) section).

### 3. Database Setup

```bash
cd supabase
npx supabase db push
```

This applies all migrations including:
- Campaign approval workflow
- Polling configuration (30-minute intervals)
- Immediate charging infrastructure
- Admin RLS policies
- Activity logging tables

### 4. Deploy Edge Functions

```bash
npx supabase functions deploy poll-melissa-new-movers
npx supabase functions deploy create-payment-intent
npx supabase functions deploy stripe-webhook
```

### 5. Start Development Server

```bash
npm run dev
```

Application will be available at http://localhost:5173

---

## 🔐 Environment Variables

### Required Configuration

```env
# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Supabase Edge Functions (Server-side)
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key  # For Edge Functions only

# Stripe
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...  # Server-side only

# Melissa API
MELISSA_CUSTOMER_ID=your_melissa_customer_id

# PostGrid
POSTGRID_API_KEY=your_postgrid_api_key  # test_ or live_ prefix

# Cloudinary
VITE_CLOUDINARY_CLOUD_NAME=your_cloud_name
VITE_CLOUDINARY_API_KEY=your_api_key
VITE_CLOUDINARY_API_SECRET=your_api_secret

# IMG.LY Creative Engine
VITE_IMGLY_LICENSE_KEY=your_imgly_license

# Brandfetch (Optional)
VITE_BRANDFETCH_API_KEY=your_brandfetch_key
```

### Environment Variable Scopes

- **VITE_** prefixed variables: Available in browser (frontend)
- **No prefix**: Server-side only (Edge Functions, never exposed to browser)

---

## 🗄️ Database Setup

### Tables Created by Migrations

| Table | Purpose |
|-------|---------|
| `profile` | User profiles with role-based access |
| `campaigns` | Campaign details, status, and polling config |
| `newmover` | New mover records from Melissa API |
| `transactions` | All Stripe charges (immediate charging) |
| `pending_charges` | Audit trail of charges (marked processed immediately) |
| `customers` | Stripe customer records |
| `payment_methods` | User payment methods (cards) |
| `admin_activity_logs` | Complete audit trail of admin actions |
| `validated_zipcodes` | Cached ZIP code validation results |

### Key Migrations

**Polling Configuration (30 minutes):**
- `20251206000001_add_polling_fields.sql` - Adds polling fields to campaigns
- `20251206000002_configure_polling_cron.sql` - Sets up cron job (30-minute intervals)
- `20251208000002_update_polling_to_30_minutes.sql` - Updates frequency from 6 hours to 30 minutes

**Immediate Charging:**
- `20251208000001_add_transaction_id_to_newmover.sql` - Links newmovers to transactions

**Admin Access:**
- `20251207000004_add_admin_campaigns_rls_policy.sql` - Admin campaign access
- `20251208000003_add_admin_transactions_rls_policy.sql` - Admin transaction access

---

## ⚡ Edge Functions

### 1. poll-melissa-new-movers

**Trigger:** Cron job every 30 minutes (pg_cron)

**Purpose:** Automatic new mover discovery and postcard sending

**Flow:**
```
1. Query active campaigns with polling_enabled=true
2. For each campaign:
   - Fetch Melissa API for movers in target ZIP codes
   - Filter movers where move_effective_date > approved_at
   - For each new mover:
     a) Save to newmover table
     b) Send postcard via PostGrid
     c) Charge $3.00 immediately via Stripe
     d) Create transaction record
     e) Update campaign totals
3. Update last_polled_at timestamp
4. Log activity to admin_activity_logs
```

**Key Features:**
- Uses service role key (bypasses RLS)
- Immediate Stripe charging (no batching)
- Idempotency keys prevent duplicate charges
- Graceful error handling per mover

**Environment Variables:**
```
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
MELISSA_CUSTOMER_ID
POSTGRID_API_KEY
STRIPE_SECRET_KEY
```

### 2. create-payment-intent

**Trigger:** Manual API call (admin approval, manual charging)

**Purpose:** Create Stripe PaymentIntent for immediate charging

**Flow:**
```
1. Authenticate user (check JWT)
2. Verify admin role OR user owns customer
3. Fetch customer and payment method
4. Validate payment method not expired
5. Create Stripe PaymentIntent (off_session=true, confirm=true)
6. Return result (succeeded/processing/requires_action)
```

**Parameters:**
```typescript
{
  amount: number;           // Amount in cents (300 = $3.00)
  customerId: string;       // Stripe customer ID
  paymentMethodId: string;  // Stripe payment method ID
  campaignId?: string;      // Optional campaign reference
  isTestMode?: boolean;     // Test vs live mode
  description?: string;     // Charge description
  metadata?: object;        // Additional metadata
}
```

### 3. stripe-webhook

**Trigger:** Stripe webhook events

**Purpose:** Handle Stripe payment lifecycle events

**Handles:**
- `payment_intent.succeeded` - Create transaction record
- `payment_intent.failed` - Log failure
- `charge.refunded` - Update transaction status

---

## 🔄 Workflows

### Campaign Creation & Approval Workflow

```
User Journey:
1. User creates campaign
   ├─ Select targeting (ZIP codes)
   ├─ Design postcard
   ├─ Add payment method
   └─ Submit for review

2. Campaign status: "pending_approval"

3. Admin reviews campaign
   ├─ View campaign details
   ├─ Check payment method exists
   └─ Approve or Reject

4. On Approval:
   ├─ Set status = "active"
   ├─ Set approval_status = "approved"
   ├─ Enable polling (polling_enabled = true)
   ├─ Set polling_frequency_hours = 0.5 (30 min)
   ├─ Set approved_at = NOW()
   └─ Log admin activity

5. Polling begins automatically
   └─ Next poll cycle (within 30 minutes)
```

### Automatic Polling & Charging Workflow

```
Every 30 Minutes (pg_cron):
1. poll-melissa-new-movers Edge Function triggers

2. Query active campaigns
   WHERE polling_enabled = true
   AND status = 'active'

3. For each campaign:
   ├─ Fetch Melissa API
   │  └─ Get movers in target_zip_codes
   │
   ├─ Filter NEW movers
   │  └─ WHERE move_effective_date > approved_at
   │
   └─ For each new mover:
      ├─ Insert into newmover table
      │
      ├─ Send PostGrid postcard
      │  ├─ POST /postcards
      │  ├─ Get postcard_id
      │  └─ Update newmover (postgrid_postcard_id)
      │
      ├─ Charge via Stripe IMMEDIATELY
      │  ├─ Get customer & payment_method
      │  ├─ Create PaymentIntent ($3.00)
      │  ├─ Confirm payment (off_session=true)
      │  └─ Get payment_intent_id
      │
      ├─ Create transaction record
      │  ├─ amount_dollars = 3.00
      │  ├─ status = "succeeded"
      │  ├─ stripe_payment_intent_id
      │  └─ billing_reason = "new_mover_addition"
      │
      ├─ Link transaction to mover
      │  └─ UPDATE newmover SET transaction_id
      │
      ├─ Create pending_charges (audit only)
      │  └─ processed = true (already charged)
      │
      └─ Update campaign totals
         ├─ postcards_sent += 1
         └─ total_cost += 3.00

4. Log polling activity
   └─ admin_activity_logs (action_type: "polling_completed")
```

### Payment Flow

```
Immediate Charging (Current):
User Added ─▶ Postcard Sent ─▶ Charged Immediately ─▶ Transaction Created
                    ↓                    ↓                      ↓
               PostGrid API          Stripe API          Database Record
               (3-5 days)           (instant)           (instant)

Timeline:
T+0s:     New mover discovered
T+2s:     Postcard sent via PostGrid
T+4s:     Stripe charge created
T+5s:     Transaction record saved
T+5s:     Admin dashboard shows transaction
```

---

## 👨‍💼 Admin Dashboard

### Accessing Admin Dashboard

**URL:** `http://localhost:5173/admin/login` (development)

**Production:** `https://yourdomain.com/admin/login`

### Creating Admin Users

```sql
-- Promote existing user to admin
UPDATE profile
SET role = 'admin'
WHERE email = 'admin@yourcompany.com';

-- Or create super admin
UPDATE profile
SET role = 'super_admin'
WHERE email = 'superadmin@yourcompany.com';
```

### Admin Features

**Dashboard:**
- Total campaigns (active, pending, completed)
- Total revenue and transaction stats
- Recent activity feed
- System health indicators

**Campaign Management:**
- View all campaigns (any user)
- Approve/reject campaigns
- Pause/resume active campaigns
- View campaign details and analytics
- Delete campaigns (soft delete)

**Transaction Monitoring:**
- View all transactions (test + live modes)
- Filter by status, date, mode
- Export to CSV
- Revenue statistics

**User Management:**
- View all users
- Block/unblock users
- View user campaigns and payment history
- View user activity logs

**Activity Logs:**
- Complete audit trail
- Filter by action type
- See who did what and when
- System events (polling, charges)

### Admin Roles

| Role | Permissions |
|------|-------------|
| `admin` | Full campaign and user management |
| `super_admin` | All admin features (reserved for future use) |

### Admin RLS Policies

Admins bypass user ownership checks:
- Can view all campaigns (not just their own)
- Can view all transactions
- Can view all users
- Can view all payment methods

---

## 📊 Database Schema

### Key Relationships

```
profile (user_id)
  ├─▶ campaigns (user_id)
  │     ├─▶ newmover (campaign_id)
  │     │     └─▶ transactions (id) via transaction_id
  │     └─▶ transactions (campaign_id)
  │
  ├─▶ customers (user_id)
  │     ├─▶ payment_methods (customer_id)
  │     └─▶ transactions (stripe_customer_id)
  │
  └─▶ admin_activity_logs (user_id, admin_id)
```

### Important Fields

**campaigns:**
```sql
- polling_enabled: boolean        -- Enable/disable automatic polling
- polling_frequency_hours: decimal -- 0.5 = 30 minutes
- approved_at: timestamp          -- When admin approved campaign
- last_polled_at: timestamp       -- Last successful poll
- postcards_sent: integer         -- Total postcards sent
- total_cost: decimal             -- Total charges ($3.00 per postcard)
```

**newmover:**
```sql
- melissa_address_key: text       -- Unique Melissa identifier
- move_effective_date: timestamp  -- When person moved (from Melissa)
- postcard_sent: boolean          -- Whether postcard was sent
- postgrid_postcard_id: text      -- PostGrid postcard reference
- transaction_id: uuid            -- Links to transactions table
- discovered_at: timestamp        -- When we found this mover
```

**transactions:**
```sql
- stripe_payment_intent_id: text  -- Stripe PaymentIntent ID
- stripe_charge_id: text          -- Stripe Charge ID
- amount_cents: integer           -- 300 ($3.00)
- amount_dollars: decimal         -- 3.00
- status: text                    -- succeeded, processing, failed
- billing_reason: text            -- new_mover_addition
- is_test_mode: boolean           -- Test vs live transaction
```

---

## 🔌 API Reference

### Frontend API Services

**Location:** `src/supabase/api/`

**adminActions.js:**
- `approveCampaign(campaignId, adminId)` - Approve campaign
- `rejectCampaign(campaignId, adminId, reason)` - Reject campaign
- `pauseCampaign(campaignId, adminId, reason)` - Pause campaign
- `resumeCampaign(campaignId, adminId)` - Resume campaign
- `deleteCampaign(campaignId, adminId)` - Soft delete campaign

**adminService.js:**
- `getTransactions(filters)` - Get transactions with filtering
- `getRevenueStats(filters)` - Get revenue statistics
- `getAllUsers(filters)` - Get all users
- `blockUser(userId, adminId, reason)` - Block user
- `unblockUser(userId, adminId)` - Unblock user

**campaignService.js:**
- `createCampaign(campaignData)` - Create new campaign
- `getCampaignById(id)` - Get campaign details (admin bypass)
- `updateCampaign(id, updates)` - Update campaign (admin bypass)
- `getUserCampaigns()` - Get user's campaigns

### Edge Function Endpoints

**poll-melissa-new-movers:**
```
POST https://your-project.supabase.co/functions/v1/poll-melissa-new-movers
Authorization: Bearer <service_role_key>

Response:
{
  "success": true,
  "campaigns_processed": 7,
  "postcards_sent": 3,
  "errors": []
}
```

**create-payment-intent:**
```
POST https://your-project.supabase.co/functions/v1/create-payment-intent
Authorization: Bearer <anon_key>
Content-Type: application/json

Body:
{
  "amount": 300,
  "customerId": "cus_...",
  "paymentMethodId": "pm_...",
  "campaignId": "uuid",
  "description": "New Mover Postcard"
}

Response:
{
  "success": true,
  "paymentIntentId": "pi_...",
  "status": "succeeded",
  "amount": 300
}
```

---

## ⚠️ Known Issues

### PostGrid PDF URL Issue

**Status:** Being fixed by another team

**Issue:** Campaign postcard_design_url points to non-PDF formats, causing PostGrid API to reject requests with error:
```
"Unable to get PDF information. The file or the link you provided might be incorrect."
```

**Workaround:** For testing, use the test-immediate-charging Edge Function which has a `skip_postcard` flag to test charging without PostGrid.

**Impact:**
- Polling function will skip movers if PostGrid fails
- Error logged but doesn't crash polling
- Transaction NOT created if postcard send fails

**ETA:** TBD (other team working on PDF conversion)

---

## 🐛 Troubleshooting

### Transactions Not Showing in Dashboard

**Symptoms:** Admin dashboard shows 0 transactions despite successful charges

**Causes & Solutions:**

1. **RLS Policy Missing**
   ```sql
   -- Run this SQL:
   CREATE POLICY "Admins can view all transactions"
   ON transactions FOR SELECT TO authenticated
   USING (
     EXISTS (
       SELECT 1 FROM profile
       WHERE profile.user_id = auth.uid()
       AND profile.role IN ('admin', 'super_admin')
     )
   );
   ```

2. **Test Mode Filter**
   - Check Mode filter dropdown in Transactions page
   - Default shows "All Modes" (test + live)
   - Make sure not filtering to only live mode

3. **Browser Cache**
   - Hard refresh (Ctrl+Shift+R / Cmd+Shift+R)
   - Clear browser cache
   - Try incognito mode

### Polling Not Running

**Symptoms:** last_polled_at never updates, no new movers discovered

**Checks:**

1. **Cron Job Status**
   ```sql
   SELECT * FROM cron.job WHERE jobname = 'poll-melissa-new-movers';
   ```
   Should show: `schedule = '*/30 * * * *'` and `active = true`

2. **Campaign Polling Status**
   ```sql
   SELECT id, campaign_name, polling_enabled, polling_frequency_hours, approved_at
   FROM campaigns
   WHERE status = 'active';
   ```
   Should have: `polling_enabled = true` and `polling_frequency_hours = 0.5`

3. **Manual Trigger Test**
   ```bash
   curl -X POST \
     'https://your-project.supabase.co/functions/v1/poll-melissa-new-movers' \
     -H "Authorization: Bearer <anon_key>"
   ```

4. **Check Edge Function Logs**
   - Go to Supabase Dashboard → Edge Functions → poll-melissa-new-movers → Logs
   - Look for errors or exceptions

### Stripe Charges Failing

**Symptoms:** Polling runs but no charges created

**Checks:**

1. **Payment Method Exists**
   ```sql
   SELECT pm.*, c.user_id
   FROM payment_methods pm
   JOIN customers c ON c.id = pm.customer_id
   WHERE c.user_id = '<user_id>'
   AND pm.is_default = true;
   ```

2. **Card Not Expired**
   ```sql
   SELECT card_exp_month, card_exp_year
   FROM payment_methods
   WHERE id = '<payment_method_id>';
   ```

3. **Stripe API Key Valid**
   - Check Edge Function environment variables
   - Verify STRIPE_SECRET_KEY starts with `sk_test_` or `sk_live_`

4. **Test Mode vs Live Mode**
   - PostGrid test key (`test_...`) → Stripe test charges
   - PostGrid live key → Stripe live charges
   - Ensure consistency

### Admin Can't Access Dashboard

**Symptoms:** Redirected to login or 403 errors

**Solutions:**

1. **Check Role**
   ```sql
   SELECT user_id, email, role
   FROM profile
   WHERE email = '<admin_email>';
   ```
   Role should be `admin` or `super_admin`

2. **Update Role**
   ```sql
   UPDATE profile
   SET role = 'admin'
   WHERE email = '<admin_email>';
   ```

3. **Clear Auth Cache**
   - Log out completely
   - Clear browser cookies for localhost/domain
   - Log back in

---

## 📚 Additional Documentation

### PSD Template Requirements

See [PSD Template Requirements](#psd-template-requirements) section in original README for detailed guidelines on creating postcard templates.

### Editor Features

- Brand color integration
- Simple and Advanced editing modes
- Zoom and pan controls
- Export to PNG and PDF

---

## 🤝 Contributing

(Add your contribution guidelines here)

---

## 📄 License

(Add your license information here)

---

## 📞 Support

For issues or questions:
1. Check Troubleshooting section above
2. Review Edge Function logs in Supabase Dashboard
3. Check browser console for frontend errors
4. Review database query logs

---

**Last Updated:** December 8, 2025
**Version:** 2.0.0 (Immediate Charging Implementation)
