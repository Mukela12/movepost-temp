import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import AuthLayout from '../../components/auth/AuthLayout';
import Logo from '../../components/common/Logo';
import toast from 'react-hot-toast';
import './Login.css';
import './auth-errors.css'


const Login = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, googleLogin, resetPassword, loading, onboardingCompleted, currentOnboardingStep, checkOnboardingStatus } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    rememberMe: false
  });

  const [showPassword, setShowPassword] = useState(false);
   const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Show success message if user just verified their email
  useEffect(() => {
    const verified = searchParams.get('verified');
    if (verified === 'true') {
      toast.success('Email verified successfully! Please log in to continue.', {
        duration: 4000
      });
    }
  }, [searchParams]);

  const testimonial = {
    text: "MovePost connects us with new homeowners right when they need our services. The targeting is incredibly precise and has transformed our customer acquisition strategy.",
    author: "Sarah Mitchell",
    title: "Owner",
    company: "Elite Home Services"
  };

    const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });
    // Clear error when user types
    if (errors[name]) {
      setErrors({
        ...errors,
        [name]: ''
      });
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await login(formData.email, formData.password);

      // Smart redirect logic based on user status
      try {
        // Refresh onboarding status to get latest data
        const onboardingStatus = await checkOnboardingStatus();

        // Check if email is verified (if confirmation is enabled)
        if (response && response.user && !response.user.email_confirmed_at) {
          toast('Please verify your email to continue');
          navigate('/verify-email');
          return;
        }

        // Check onboarding completion
        if (onboardingStatus && !onboardingStatus.onboardingCompleted) {
          // User hasn't completed onboarding - redirect to their current step
          const step = onboardingStatus.currentStep || 1;
          toast(`Continuing your onboarding from Step ${step}`);
          navigate(`/onboarding/step${step}`);
        } else {
          // User has completed onboarding - go to dashboard
          navigate('/dashboard');
        }
      } catch (error) {
        console.error('Error during redirect logic:', error);
        // Fallback to dashboard if there's an error
        navigate('/dashboard');
      }

    } catch (error) {
      console.error('Login error:', error);
      // Error is already handled by AuthContext with toast
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      await googleLogin();
      // Redirect will happen automatically via OAuth
    } catch (error) {
      console.error('Google login error:', error);
      // Error is already handled by AuthContext with toast
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();

    if (!formData.email.trim()) {
      setErrors({
        ...errors,
        email: 'Please enter your email to reset password'
      });
      return;
    }

    if (!/\S+@\S+\.\S+/.test(formData.email)) {
      setErrors({
        ...errors,
        email: 'Please enter a valid email'
      });
      return;
    }

    try {
      await resetPassword(formData.email);
    } catch (error) {
      console.error('Password reset error:', error);
      // Error is already handled by AuthContext with toast
    }
  };

  return (
    <AuthLayout testimonial={testimonial}>
      <div className="login-form-container">
        <Logo variant="auth" className="login-logo" />
          
        <h1 className="auth-title">Welcome back</h1>
        <p className="auth-subtitle">Welcome back! Please enter your details.</p>

                <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="email" className="form-label">Email</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="Enter your email"
              className={`form-input ${errors.email ? 'error' : ''}`}
              disabled={isSubmitting || loading}
            />
            {errors.email && (
              <span className="error-text">{errors.email}</span>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="password" className="form-label">Password</label>
            <div className="password-input-wrapper">
              <input
                type={showPassword ? "text" : "password"}
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="••••••••"
                className={`form-input ${errors.password ? 'error' : ''}`}
                disabled={isSubmitting || loading}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                disabled={isSubmitting || loading}
              >
                {showPassword ? (
                  <EyeOff size={20} />
                ) : (
                  <Eye size={20} />
                )}
              </button>
            </div>
            {errors.password && (
              <span className="error-text">{errors.password}</span>
            )}
          </div>

          <div className="form-options">
            <a 
              href="#" 
              onClick={handleForgotPassword} 
              className="forgot-link"
            >
              Forgot password
            </a>
          </div>

          <button
            type="submit"
            className="auth-button"
            disabled={isSubmitting || loading}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={18} className="spinner-icon" />
                Signing in...
              </>
            ) : (
              'Sign in'
            )}
          </button>
        </form>

        <button 
          className="google-button" 
          onClick={handleGoogleSignIn}
          disabled={isSubmitting || loading}

        >
          <svg className="google-icon" width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M18.1713 8.36791H17.5V8.33329H10V11.6666H14.7096C14.0225 13.6071 12.1763 15 10 15C7.23877 15 5.00002 12.7612 5.00002 9.99996C5.00002 7.23871 7.23877 4.99996 10 4.99996C11.2746 4.99996 12.4342 5.48079 13.3171 6.26621L15.6738 3.90954C14.1863 2.52204 12.195 1.66663 10 1.66663C5.39752 1.66663 1.66669 5.39746 1.66669 9.99996C1.66669 14.6025 5.39752 18.3333 10 18.3333C14.6025 18.3333 18.3334 14.6025 18.3334 9.99996C18.3334 9.44121 18.2759 8.89579 18.1713 8.36791Z" fill="#FFC107"/>
            <path d="M2.62752 6.12121L5.36544 8.12913C6.10627 6.29538 7.90044 4.99996 10 4.99996C11.2746 4.99996 12.4342 5.48079 13.3171 6.26621L15.6738 3.90954C14.1863 2.52204 12.195 1.66663 10 1.66663C6.79919 1.66663 4.02335 3.47371 2.62752 6.12121Z" fill="#FF3D00"/>
            <path d="M10 18.3333C12.1525 18.3333 14.1084 17.5095 15.5871 16.17L13.0079 13.9875C12.1431 14.6452 11.0865 15.0009 10 15C7.83255 15 5.99213 13.6179 5.29879 11.6891L2.58046 13.7829C3.96046 16.4816 6.76129 18.3333 10 18.3333Z" fill="#4CAF50"/>
            <path d="M18.1713 8.36795H17.5V8.33333H10V11.6667H14.7096C14.3809 12.5902 13.7889 13.3972 13.0067 13.9879L13.0079 13.9871L15.5871 16.1696C15.4046 16.3354 18.3334 14.1667 18.3334 10C18.3334 9.44129 18.2759 8.89587 18.1713 8.36795Z" fill="#1976D2"/>
          </svg>
          Sign in with Google
        </button>

        <p className="auth-switch">
          Don't have an account? <Link to="/signup" className="auth-link">Sign up</Link>
        </p>
      </div>
    </AuthLayout>
  );
};

export default Login;