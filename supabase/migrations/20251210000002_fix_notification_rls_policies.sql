-- Fix notification RLS policies to allow cross-user notification creation
-- This migration removes duplicate INSERT policies and applies a single correct policy

-- Drop existing INSERT policies if they exist
DROP POLICY IF EXISTS "Service role can insert notifications" ON notifications;
DROP POLICY IF EXISTS "Authenticated users can insert notifications" ON notifications;

-- Create a single INSERT policy that allows any authenticated user to create notifications
-- This is necessary for admins to create notifications for other users
CREATE POLICY "Allow authenticated inserts"
  ON notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Ensure authenticated users have INSERT permission
GRANT INSERT ON notifications TO authenticated;
