import { supabase } from '../integration/client';

/**
 * Notification Service - Handles in-app notifications for users
 */

/**
 * Create a new notification for a user
 * @param {string} userId - UUID of the user
 * @param {string} type - Notification type (campaign_approved, campaign_rejected, etc.)
 * @param {string} title - Notification title
 * @param {string} message - Notification message
 * @param {string} actionUrl - Optional URL to navigate when clicked
 * @returns {Promise<{success: boolean, notification?: object, error?: string}>}
 */
export const createNotification = async (userId, type, title, message, actionUrl = null) => {
  try {
    const { error } = await supabase
      .from('notifications')
      .insert([
        {
          user_id: userId,
          type,
          title,
          message,
          action_url: actionUrl,
        },
      ]);

    if (error) {
      console.error('Error creating notification:', error);
      return { success: false, error: error.message };
    }

    console.log('Notification created successfully for user:', userId);
    return { success: true };
  } catch (error) {
    console.error('Error in createNotification:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get notifications for a user
 * @param {string} userId - UUID of the user
 * @param {object} options - Query options (limit, offset, unreadOnly)
 * @returns {Promise<{success: boolean, notifications?: array, count?: number, error?: string}>}
 */
export const getNotifications = async (userId, options = {}) => {
  try {
    const { limit = 50, offset = 0, unreadOnly = false } = options;

    let query = supabase
      .from('notifications')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (unreadOnly) {
      query = query.eq('is_read', false);
    }

    if (limit) {
      query = query.range(offset, offset + limit - 1);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching notifications:', error);
      return { success: false, error: error.message };
    }

    return { success: true, notifications: data, count };
  } catch (error) {
    console.error('Error in getNotifications:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get unread notification count for a user
 * @param {string} userId - UUID of the user
 * @returns {Promise<{success: boolean, count?: number, error?: string}>}
 */
export const getUnreadCount = async (userId) => {
  try {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) {
      console.error('Error fetching unread count:', error);
      return { success: false, error: error.message };
    }

    return { success: true, count: count || 0 };
  } catch (error) {
    console.error('Error in getUnreadCount:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Mark a notification as read
 * @param {string} notificationId - UUID of the notification
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const markAsRead = async (notificationId) => {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId);

    if (error) {
      console.error('Error marking notification as read:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Error in markAsRead:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Mark all notifications as read for a user
 * @param {string} userId - UUID of the user
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const markAllAsRead = async (userId) => {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) {
      console.error('Error marking all notifications as read:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Error in markAllAsRead:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Delete a notification
 * @param {string} notificationId - UUID of the notification
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const deleteNotification = async (notificationId) => {
  try {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId);

    if (error) {
      console.error('Error deleting notification:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Error in deleteNotification:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Delete all notifications for a user
 * @param {string} userId - UUID of the user
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const deleteAllNotifications = async (userId) => {
  try {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('user_id', userId);

    if (error) {
      console.error('Error deleting all notifications:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Error in deleteAllNotifications:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Subscribe to real-time notification updates
 * @param {string} userId - UUID of the user
 * @param {function} callback - Callback function to handle new notifications
 * @returns {object} Subscription object with unsubscribe method
 */
export const subscribeToNotifications = (userId, callback) => {
  const subscription = supabase
    .channel('notifications-changes')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        console.log('New notification received:', payload.new);
        callback(payload.new);
      }
    )
    .subscribe();

  return {
    unsubscribe: () => {
      subscription.unsubscribe();
    },
  };
};

export default {
  createNotification,
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteAllNotifications,
  subscribeToNotifications,
};
