-- Create notifications table for in-app notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'campaign_approved', 'campaign_rejected', 'payment_failed', etc.
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  action_url TEXT, -- URL to navigate when notification is clicked
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  read_at TIMESTAMP WITH TIME ZONE
);

-- Create index on user_id for faster queries
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);

-- Create index on is_read for faster unread counts
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);

-- Create index on created_at for sorting
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- Enable Row Level Security
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own notifications
CREATE POLICY "Users can view own notifications"
  ON notifications
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can update their own notifications (mark as read)
CREATE POLICY "Users can update own notifications"
  ON notifications
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Policy: Users can delete their own notifications
CREATE POLICY "Users can delete own notifications"
  ON notifications
  FOR DELETE
  USING (auth.uid() = user_id);

-- Policy: Any authenticated user can insert notifications
-- This allows admins to create notifications for other users
CREATE POLICY "Allow authenticated inserts"
  ON notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Function to automatically set read_at timestamp when marking as read
CREATE OR REPLACE FUNCTION set_notification_read_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_read = true AND OLD.is_read = false THEN
    NEW.read_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to set read_at automatically
CREATE TRIGGER notification_read_at_trigger
  BEFORE UPDATE ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION set_notification_read_at();

-- Grant access to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON notifications TO authenticated;
