# Database Migrations - Admin Dashboard

This directory contains database migrations for the Super Admin Dashboard feature.

## Migration Files (Sprint 1 - Database Foundation)

Created on: 2025-11-25

### Migration Order

Run these migrations in the following order:

1. **20251125_add_admin_role_system.sql**
   - Adds role system to profile table (user, admin, super_admin)
   - Adds user blocking columns
   - Creates indexes for performance

2. **20251125_add_campaign_approval_system.sql**
   - Adds approval workflow to campaigns
   - Adds pause functionality
   - Adds provider tracking
   - Updates existing campaigns to 'approved' status

3. **20251125_create_admin_activity_logs.sql**
   - Creates admin_activity_logs table
   - Adds indexes and RLS policies
   - Creates helper function for logging

4. **20251125_create_user_blocks.sql**
   - Creates user_blocks table for blocking history
   - Adds indexes and RLS policies
   - Creates helper function for active blocks

5. **20251125_add_admin_rls_policies.sql**
   - Adds RLS policies for admin access
   - Creates helper functions (is_admin, is_super_admin, get_user_role)
   - Grants admin access to campaigns and profiles

## Running Migrations

### Option 1: Supabase CLI (Recommended)

```bash
# Navigate to project root
cd /Users/mukelakatungu/Postcard-frontend

# Run all pending migrations
supabase db push

# Or run specific migration
supabase db push --db-url <your-db-url>
```

### Option 2: Supabase Dashboard

1. Go to https://app.supabase.com
2. Select your project
3. Navigate to SQL Editor
4. Copy and paste each migration file content
5. Run them in order (1-5)

### Option 3: Direct SQL Execution

```bash
# Using psql
psql -h <your-host> -U postgres -d postgres -f supabase/migrations/20251125_add_admin_role_system.sql
psql -h <your-host> -U postgres -d postgres -f supabase/migrations/20251125_add_campaign_approval_system.sql
psql -h <your-host> -U postgres -d postgres -f supabase/migrations/20251125_create_admin_activity_logs.sql
psql -h <your-host> -U postgres -d postgres -f supabase/migrations/20251125_create_user_blocks.sql
psql -h <your-host> -U postgres -d postgres -f supabase/migrations/20251125_add_admin_rls_policies.sql
```

## Post-Migration Setup

### 1. Create Your First Admin User

After running the migrations, you need to assign the admin role to a user:

```sql
-- Replace 'admin@yourcompany.com' with your email
UPDATE profile
SET role = 'super_admin'
WHERE email = 'admin@yourcompany.com';
```

Verify the update:

```sql
SELECT user_id, email, role FROM profile WHERE role IN ('admin', 'super_admin');
```

### 2. Test Admin Access

```sql
-- Check if is_admin() function works
SELECT is_admin() FROM profile WHERE email = 'admin@yourcompany.com';

-- Should return: true
```

### 3. Verify Tables Created

```sql
-- List all tables
\dt

-- Check admin_activity_logs
SELECT COUNT(*) FROM admin_activity_logs;

-- Check user_blocks
SELECT COUNT(*) FROM user_blocks;
```

### 4. Verify RLS Policies

```sql
-- List policies for campaigns
SELECT * FROM pg_policies WHERE tablename = 'campaigns';

-- List policies for profile
SELECT * FROM pg_policies WHERE tablename = 'profile';

-- List policies for admin_activity_logs
SELECT * FROM pg_policies WHERE tablename = 'admin_activity_logs';
```

## Backwards Compatibility

✅ All migrations are **backwards compatible**:
- All new columns are NULLABLE
- Existing campaigns automatically marked as 'approved'
- No breaking changes to user functionality
- RLS policies preserve existing user access

## Rollback Instructions

If you need to rollback these migrations:

### Rollback Order (Reverse of creation)

```sql
-- 5. Remove RLS policies
DROP POLICY IF EXISTS "Admins can view all campaigns" ON campaigns;
DROP POLICY IF EXISTS "Admins can update all campaigns" ON campaigns;
DROP POLICY IF EXISTS "Admins can delete all campaigns" ON campaigns;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profile;
DROP POLICY IF EXISTS "Admins can update user blocks" ON profile;
DROP POLICY IF EXISTS "Admins can view all companies" ON companies;
DROP FUNCTION IF EXISTS is_admin();
DROP FUNCTION IF EXISTS is_super_admin();
DROP FUNCTION IF EXISTS get_user_role(UUID);

-- 4. Drop user_blocks table
DROP TABLE IF EXISTS user_blocks CASCADE;
DROP FUNCTION IF EXISTS get_active_block(UUID);

-- 3. Drop admin_activity_logs table
DROP TABLE IF EXISTS admin_activity_logs CASCADE;
DROP FUNCTION IF EXISTS log_admin_activity(UUID, TEXT, TEXT, UUID, JSONB);

-- 2. Remove campaign columns
ALTER TABLE campaigns
DROP COLUMN IF EXISTS approval_status,
DROP COLUMN IF EXISTS approved_by,
DROP COLUMN IF EXISTS approved_at,
DROP COLUMN IF EXISTS rejected_by,
DROP COLUMN IF EXISTS rejected_at,
DROP COLUMN IF EXISTS rejection_reason,
DROP COLUMN IF EXISTS paused_by,
DROP COLUMN IF EXISTS paused_at,
DROP COLUMN IF EXISTS pause_reason,
DROP COLUMN IF EXISTS provider,
DROP COLUMN IF EXISTS provider_campaign_id,
DROP COLUMN IF EXISTS provider_connected_at;

-- 1. Remove profile columns
ALTER TABLE profile
DROP COLUMN IF EXISTS role,
DROP COLUMN IF EXISTS is_blocked,
DROP COLUMN IF EXISTS blocked_at,
DROP COLUMN IF EXISTS blocked_by,
DROP COLUMN IF EXISTS block_reason;
```

## Testing

After running migrations, test the following:

### Test 1: User Login Still Works
```
1. Go to /login
2. Login as a regular user
3. Verify dashboard loads
4. Verify campaigns are visible
```

### Test 2: Admin Login Works
```
1. Go to /admin/login
2. Login with admin credentials
3. Verify admin dashboard loads
4. Verify campaigns list shows all campaigns
```

### Test 3: Database Queries
```sql
-- Test campaign queries with approval_status
SELECT id, campaign_name, approval_status, status FROM campaigns LIMIT 5;

-- Test profile queries with role
SELECT user_id, email, role, is_blocked FROM profile LIMIT 5;

-- Test admin activity logs (should be empty initially)
SELECT * FROM admin_activity_logs LIMIT 5;
```

## Schema Changes Summary

### New Tables
- `admin_activity_logs` - Audit log for all admin actions
- `user_blocks` - History of user blocking/unblocking

### Modified Tables

#### profile
- `role` (TEXT) - user/admin/super_admin
- `is_blocked` (BOOLEAN) - Whether user is blocked
- `blocked_at` (TIMESTAMPTZ) - When user was blocked
- `blocked_by` (UUID) - Admin who blocked user
- `block_reason` (TEXT) - Reason for blocking

#### campaigns
- `approval_status` (TEXT) - pending/approved/rejected
- `approved_by`, `approved_at` - Approval tracking
- `rejected_by`, `rejected_at`, `rejection_reason` - Rejection tracking
- `paused_by`, `paused_at`, `pause_reason` - Pause tracking
- `provider` (TEXT) - lob/postgrid/clicksend
- `provider_campaign_id` (TEXT) - External provider ID
- `provider_connected_at` (TIMESTAMPTZ) - When connected

### New Functions
- `is_admin()` - Check if current user is admin
- `is_super_admin()` - Check if current user is super admin
- `get_user_role(UUID)` - Get user's role
- `log_admin_activity(...)` - Log admin actions
- `get_active_block(UUID)` - Get user's active block

### New Indexes
- 15+ indexes for optimized queries
- Composite indexes for common query patterns

### New RLS Policies
- Admins can view all campaigns
- Admins can update all campaigns
- Admins can view all profiles
- Admins can view all activity logs
- And more...

## Support

If you encounter any issues:
1. Check migration order
2. Verify database permissions
3. Check Supabase logs
4. Review RLS policies

For questions, refer to: `PHASE_2_SPRINT_PLAN.md`
