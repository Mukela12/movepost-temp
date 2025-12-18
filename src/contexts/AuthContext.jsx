import React, { createContext, useContext, useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import supabaseAuthService from '../supabase/api/authService'
import supabaseOnboardingService from '../supabase/api/onboardingService'

const AuthContext = createContext(null)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [onboardingCompleted, setOnboardingCompleted] = useState(false)
  const [currentOnboardingStep, setCurrentOnboardingStep] = useState(1)
  const [onboardingLoading, setOnboardingLoading] = useState(false)
  const navigate = useNavigate()

  // Ref to prevent duplicate onboarding status checks
  const isCheckingOnboarding = useRef(false)

  // Check onboarding status with debouncing
  const checkOnboardingStatus = async () => {
    // Prevent duplicate calls
    if (isCheckingOnboarding.current) {
      return null
    }

    try {
      isCheckingOnboarding.current = true
      setOnboardingLoading(true)
      const status = await supabaseOnboardingService.getOnboardingStatus()

      setOnboardingCompleted(status.onboardingCompleted)
      setCurrentOnboardingStep(status.currentStep)

      return status
    } catch (error) {
      console.error('Error checking onboarding status:', error)
      return null
    } finally {
      setOnboardingLoading(false)
      isCheckingOnboarding.current = false
    }
  }

  // Initialize auth state
  useEffect(() => {
    // Check for existing session
    const initializeAuth = async () => {
      try {
        const currentSession = await supabaseAuthService.getSession()

        if (currentSession) {
          setSession(currentSession)
          setUser(currentSession.user)
          setIsAuthenticated(true)

          // Load onboarding status for authenticated user
          await checkOnboardingStatus()
        }
      } catch (error) {
        console.error('Error initializing auth:', error)
      } finally {
        setLoading(false)
      }
    }

    initializeAuth()

    // Listen to auth state changes
    const { data: { subscription } } = supabaseAuthService.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state change:', event, session)

        // Filter events: Only respond to meaningful auth events
        // Ignore TOKEN_REFRESHED to prevent reload-like behavior on tab switching
        const meaningfulEvents = ['SIGNED_IN', 'SIGNED_OUT', 'USER_UPDATED', 'INITIAL_SESSION']
        const shouldProcess = meaningfulEvents.includes(event)

        if (!shouldProcess) {
          console.log('Ignoring auth event:', event)
          return
        }

        if (session) {
          setSession(session)
          setUser(session.user)
          setIsAuthenticated(true)

          // Only load onboarding status on sign-in, not on every token refresh
          if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
            await checkOnboardingStatus()
          }
        } else {
          setSession(null)
          setUser(null)
          setIsAuthenticated(false)
          setOnboardingCompleted(false)
          setCurrentOnboardingStep(1)
        }

        setLoading(false)
      }
    )

    // Cleanup subscription
    return () => {
      subscription?.unsubscribe()
    }
  }, [])

  // Register function
  const register = async (userData) => {
    try {
      setLoading(true)
      const response = await supabaseAuthService.register(userData)
      
      toast.success(response.message)
      
      // If email confirmation is required, user will be null until confirmed
      if (response.user) {
        setUser(response.user)
        setSession(response.session)
        setIsAuthenticated(true)
      }
      
      return response
    } catch (error) {
      const errorMessage = error.error || 'Registration failed'
      toast.error(errorMessage)
      throw error
    } finally {
      setLoading(false)
    }
  }

  // Login function
  const login = async (email, password) => {
    try {
      setLoading(true)
      const response = await supabaseAuthService.login(email, password)
      
      setUser(response.user)
      setSession(response.session)
      setIsAuthenticated(true)
      
      toast.success(response.message)
      
      return response
    } catch (error) {
      const errorMessage = error.error || 'Login failed'
      toast.error(errorMessage)
      throw error
    } finally {
      setLoading(false)
    }
  }

  // Google login function
  const googleLogin = async () => {
    try {
      setLoading(true)
      const response = await supabaseAuthService.googleLogin()
      toast.success(response.message)
      return response
    } catch (error) {
      const errorMessage = error.error || 'Google login failed'
      toast.error(errorMessage)
      throw error
    } finally {
      setLoading(false)
    }
  }

  // Logout function
  const logout = async () => {
    try {
      setLoading(true)
      await supabaseAuthService.logout()
      
      setUser(null)
      setSession(null)
      setIsAuthenticated(false)
      
      toast.success('Logged out successfully')
      navigate('/login')
    } catch (error) {
      const errorMessage = error.error || 'Logout failed'
      toast.error(errorMessage)
      throw error
    } finally {
      setLoading(false)
    }
  }

  // Update profile function
  const updateProfile = async (updates) => {
    try {
      setLoading(true)
      const response = await supabaseAuthService.updateProfile(updates)
      
      setUser(response.user)
      toast.success(response.message)
      
      return response
    } catch (error) {
      const errorMessage = error.error || 'Profile update failed'
      toast.error(errorMessage)
      throw error
    } finally {
      setLoading(false)
    }
  }

  // Reset password function
  const resetPassword = async (email) => {
    try {
      setLoading(true)
      const response = await supabaseAuthService.resetPassword(email)
      toast.success(response.message)
      return response
    } catch (error) {
      const errorMessage = error.error || 'Password reset failed'
      toast.error(errorMessage)
      throw error
    } finally {
      setLoading(false)
    }
  }

  // Update password function
  const updatePassword = async (newPassword) => {
    try {
      setLoading(true)
      const response = await supabaseAuthService.updatePassword(newPassword)
      toast.success(response.message)
      return response
    } catch (error) {
      const errorMessage = error.error || 'Password update failed'
      toast.error(errorMessage)
      throw error
    } finally {
      setLoading(false)
    }
  }

  const value = {
    user,
    session,
    loading,
    isAuthenticated,
    onboardingCompleted,
    currentOnboardingStep,
    onboardingLoading,
    register,
    login,
    googleLogin,
    logout,
    updateProfile,
    resetPassword,
    updatePassword,
    checkOnboardingStatus
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export default AuthContext