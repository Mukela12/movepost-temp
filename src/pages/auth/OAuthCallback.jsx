import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import onboardingService from '../../supabase/api/onboardingService';
import toast from 'react-hot-toast';
import './Login.css';

/**
 * OAuth Callback Handler
 * Handles redirect after Google OAuth login
 * Routes user to appropriate destination based on onboarding status
 */
const OAuthCallback = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const handleOAuthCallback = async () => {
      // Wait for auth to load
      if (authLoading) {
        return;
      }

      // If not authenticated, something went wrong - redirect to login
      if (!isAuthenticated || !user) {
        console.error('[OAuthCallback] Not authenticated after OAuth callback');
        toast.error('Authentication failed. Please try again.');
        navigate('/login');
        return;
      }

      try {
        setIsChecking(true);

        console.log('[OAuthCallback] Checking onboarding status for user:', user.id);

        // Check onboarding completion status
        const onboardingStatus = await onboardingService.getOnboardingStatus();

        console.log('[OAuthCallback] Onboarding status:', onboardingStatus);

        // Route based on onboarding completion
        if (onboardingStatus && !onboardingStatus.onboardingCompleted) {
          // User hasn't completed onboarding - redirect to their current step
          const step = onboardingStatus.currentStep || 1;
          console.log(`[OAuthCallback] Resuming onboarding at step ${step}`);
          toast.success(`Welcome back! Continuing your setup from Step ${step}`);
          navigate(`/onboarding/step${step}`);
        } else {
          // User has completed onboarding - go to dashboard
          console.log('[OAuthCallback] Onboarding completed, redirecting to dashboard');
          toast.success('Welcome back!');
          navigate('/dashboard');
        }
      } catch (error) {
        console.error('[OAuthCallback] Error during redirect logic:', error);
        // Fallback to dashboard if there's an error
        toast.error('Error checking account status. Redirecting to dashboard...');
        navigate('/dashboard');
      } finally {
        setIsChecking(false);
      }
    };

    handleOAuthCallback();
  }, [authLoading, isAuthenticated, user, navigate]);

  // Show loading state
  return (
    <div className="login-form-container" style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      textAlign: 'center',
      padding: '2rem'
    }}>
      <div style={{
        width: '48px',
        height: '48px',
        border: '4px solid #E2E8F0',
        borderTopColor: '#20B2AA',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
        marginBottom: '1.5rem'
      }}></div>

      <h2 style={{
        fontSize: '1.5rem',
        fontWeight: '600',
        color: '#1A202C',
        marginBottom: '0.5rem'
      }}>
        {isChecking ? 'Completing sign in...' : 'Redirecting...'}
      </h2>

      <p style={{
        fontSize: '0.875rem',
        color: '#718096'
      }}>
        Please wait while we set up your account
      </p>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default OAuthCallback;
