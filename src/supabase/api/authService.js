import { supabase } from "../integration/client"

const supabaseAuthService = {
  /**
   * Register a new user with email and password
   * @param {Object} userData - User registration data
   * @param {string} userData.email - User email
   * @param {string} userData.password - User password
   * @param {string} userData.name - User full name
   * @returns {Promise<Object>} User data and session
   */
  async register({ email, password, name }) {
    try {
      // Sign up the user
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
            name: name
          },
          emailRedirectTo: `${window.location.origin}/login?verified=true`
        }
      })
      if (signUpError) {
        // Handle specific signup errors
        if (signUpError.message?.includes('already registered')) {
          throw {
            message: 'This email is already registered. Please login instead.',
            code: 'EMAIL_EXISTS'
          }
        }
        throw signUpError
      }

      // Insert profile - handle duplicate gracefully
      const { error: profileError } = await supabase
        .from('profile')
        .insert({
          user_id: authData.user.id,
          full_name: name,
          email: email
        });

      if (profileError) {
        // Handle duplicate profile (user might have been created before)
        if (profileError.code === '23505' || profileError.message?.includes('duplicate key')) {
          console.warn('Profile already exists, continuing with registration');
          // Don't throw error - user can still proceed
        } else {
          throw profileError
        }
      }

      // Return user data
      return {
        user: authData.user,
        session: authData.session,
        message: 'Registration successful! Welcome aboard.'
      }
    } catch (error) {
      console.error('Registration error:', error)

      // Provide user-friendly error messages
      let errorMessage = error.message || 'Registration failed'

      if (error.code === '23505' || errorMessage.includes('duplicate key')) {
        errorMessage = 'This email is already registered. Please login instead.'
      } else if (errorMessage.includes('rate limit')) {
        errorMessage = 'Too many registration attempts. Please wait a moment and try again.'
      }

      throw {
        error: errorMessage,
        statusCode: error.status || 400,
        code: error.code || 'REGISTRATION_ERROR'
      }
    }
  },

  /**
   * Login user with email and password
   * @param {string} email - User email
   * @param {string} password - User password
   * @returns {Promise<Object>} User data and session
   */
  async login(email, password) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (error) {
        throw error
      }

      return {
        user: data.user,
        session: data.session,
        message: 'Login successful!'
      }
    } catch (error) {
      console.error('Login error:', error)
      throw {
        error: error.message || 'Login failed',
        statusCode: error.status || 401
      }
    }
  },

  /**
   * Login with Google OAuth
   * @returns {Promise<Object>} OAuth response
   */
  async googleLogin() {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            access_type: 'offline'
          }
        }
      })

      if (error) {
        // Handle specific error cases
        if (error.message?.includes('provider') && error.message?.includes('not enabled')) {
          throw {
            message: 'Google authentication is not configured. Please use email signup or contact support.',
            code: 'PROVIDER_NOT_ENABLED',
            originalError: error
          }
        }

        if (error.message?.includes('validation_failed')) {
          throw {
            message: 'Google authentication configuration error. Please use email signup.',
            code: 'VALIDATION_FAILED',
            originalError: error
          }
        }

        throw error
      }

      return {
        data,
        message: 'Redirecting to Google...'
      }
    } catch (error) {
      console.error('Google login error:', error)

      // Provide user-friendly error messages
      const errorMessage = error.message || error.error || 'Google login failed'
      const errorCode = error.code || error.error_code || 'UNKNOWN_ERROR'

      throw {
        error: errorMessage,
        statusCode: error.status || 400,
        code: errorCode
      }
    }
  },

  /**
   * Logout current user
   * @returns {Promise<void>}
   */
  async logout() {
    try {
      const { error } = await supabase.auth.signOut()
      
      if (error) {
        throw error
      }

      return {
        message: 'Logout successful!'
      }
    } catch (error) {
      console.error('Logout error:', error)
      throw {
        error: error.message || 'Logout failed',
        statusCode: error.status || 400
      }
    }
  },

  /**
   * Get current user session
   * @returns {Promise<Object>} Current session
   */
  async getSession() {
    try {
      const { data: { session }, error } = await supabase.auth.getSession()
      
      if (error) {
        throw error
      }

      return session
    } catch (error) {
      console.error('Get session error:', error)
      return null
    }
  },

  /**
   * Get current user
   * @returns {Promise<Object>} Current user
   */
  async getCurrentUser() {
    try {
      // First check if session exists to avoid AuthSessionMissingError
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        // No session available, return null silently
        return null
      }

      const { data: { user }, error } = await supabase.auth.getUser()

      if (error) {
        throw error
      }

      return user
    } catch (error) {
      console.error('Get current user error:', error)
      return null
    }
  },

  /**
   * Update user profile
   * @param {Object} updates - Profile updates
   * @returns {Promise<Object>} Updated user
   */
  async updateProfile(updates) {
    try {
      const { data, error } = await supabase.auth.updateUser({
        data: updates
      })

      if (error) {
        throw error
      }

      return {
        user: data.user,
        message: 'Profile updated successfully!'
      }
    } catch (error) {
      console.error('Update profile error:', error)
      throw {
        error: error.message || 'Profile update failed',
        statusCode: error.status || 400
      }
    }
  },

  /**
   * Send password reset email
   * @param {string} email - User email
   * @returns {Promise<Object>} Response
   */
  async resetPassword(email) {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`
      })

      if (error) {
        throw error
      }

      return {
        message: 'Password reset email sent! Please check your inbox.'
      }
    } catch (error) {
      console.error('Password reset error:', error)
      throw {
        error: error.message || 'Password reset failed',
        statusCode: error.status || 400
      }
    }
  },

  /**
   * Update password
   * @param {string} newPassword - New password
   * @returns {Promise<Object>} Response
   */
  async updatePassword(newPassword) {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      })

      if (error) {
        throw error
      }

      return {
        message: 'Password updated successfully!'
      }
    } catch (error) {
      console.error('Update password error:', error)
      throw {
        error: error.message || 'Password update failed',
        statusCode: error.status || 400
      }
    }
  },

  /**
   * Resend verification email
   * @param {string} email - User email address
   * @returns {Promise<Object>} Response
   */
  async resendVerificationEmail(email) {
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
        options: {
          emailRedirectTo: `${window.location.origin}/login?verified=true`
        }
      })

      if (error) {
        throw error
      }

      return {
        message: 'Verification email sent! Please check your inbox.'
      }
    } catch (error) {
      console.error('Resend verification error:', error)
      throw {
        error: error.message || 'Failed to resend verification email',
        statusCode: error.status || 400
      }
    }
  },

  /**
   * Listen to auth state changes
   * @param {Function} callback - Callback function
   * @returns {Object} Subscription object
   */
  onAuthStateChange(callback) {
    return supabase.auth.onAuthStateChange((event, session) => {
      callback(event, session)
    })
  }
}

export default supabaseAuthService