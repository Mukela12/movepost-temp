import { supabase } from '../integration/client';

/**
 * Profile Service - User profile management
 */

/**
 * Get current user's profile
 */
export const getUserProfile = async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    const { data, error } = await supabase
      .from('profile')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error) {
      console.error('Error fetching user profile:', error);
      return { success: false, error: error.message };
    }

    return {
      success: true,
      profile: {
        id: data.user_id,
        firstName: data.full_name?.split(' ')[0] || '',
        lastName: data.full_name?.split(' ').slice(1).join(' ') || '',
        email: data.email,
        full_name: data.full_name,
        phone: data.phone || '',
        avatar: data.avatar_url || '',
        role: data.role || 'user',
        company: data.company_name || '',
        timezone: data.timezone || 'UTC',
        language: data.language || 'en',
        notifications: data.email_notifications !== false,
        twoFactorEnabled: data.two_factor_enabled || false,
        lastLogin: data.last_sign_in_at,
        createdAt: data.created_at
      }
    };
  } catch (error) {
    console.error('Error in getUserProfile:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Update user profile
 */
export const updateUserProfile = async (updates) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    // Map frontend fields to database fields
    const dbUpdates = {
      full_name: updates.firstName && updates.lastName
        ? `${updates.firstName} ${updates.lastName}`.trim()
        : updates.full_name,
      phone: updates.phone,
      avatar_url: updates.avatar,
      company_name: updates.company,
      timezone: updates.timezone,
      language: updates.language,
      email_notifications: updates.notifications,
      updated_at: new Date().toISOString()
    };

    // Remove undefined values
    Object.keys(dbUpdates).forEach(key =>
      dbUpdates[key] === undefined && delete dbUpdates[key]
    );

    const { data, error } = await supabase
      .from('profile')
      .update(dbUpdates)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating user profile:', error);
      return { success: false, error: error.message };
    }

    return {
      success: true,
      profile: {
        id: data.user_id,
        firstName: data.full_name?.split(' ')[0] || '',
        lastName: data.full_name?.split(' ').slice(1).join(' ') || '',
        email: data.email,
        full_name: data.full_name,
        phone: data.phone || '',
        avatar: data.avatar_url || '',
        role: data.role || 'user',
        company: data.company_name || '',
        timezone: data.timezone || 'UTC',
        language: data.language || 'en',
        notifications: data.email_notifications !== false,
        twoFactorEnabled: data.two_factor_enabled || false,
        lastLogin: data.last_sign_in_at,
        createdAt: data.created_at
      }
    };
  } catch (error) {
    console.error('Error in updateUserProfile:', error);
    return { success: false, error: error.message };
  }
};

export default {
  getUserProfile,
  updateUserProfile
};
