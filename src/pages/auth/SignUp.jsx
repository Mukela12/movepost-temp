import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import AuthLayout from '../../components/auth/AuthLayout';
import Logo from '../../components/common/Logo';
import './Login.css'; // Import common auth styles
import './signup.css';
import './auth-errors.css'
import { useAuth } from '../../contexts/AuthContext';

const SignUp = () => {
  const navigate = useNavigate();
  const { register, googleLogin, loading } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const testimonial = {
    text: "Within our first month using MovePost, we connected with 40+ new homeowners in our area. The precision targeting means we're reaching people exactly when they need landscaping services.",
    author: "Marcus Rodriguez",
    title: "Founder",
    company: "GreenScape Landscaping"
  };

   const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
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

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
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
      const response = await register({
        email: formData.email,
        password: formData.password,
        name: formData.name
      });

      // Store email for verification page
      localStorage.setItem('pendingVerificationEmail', formData.email);

      // Redirect to email verification page
      // User is logged in but needs to verify email before accessing onboarding
      if (response && response.user) {
        setTimeout(() => {
          navigate('/verify-email');
        }, 500);
      }
    } catch (error) {
      console.error('Registration error:', error);

      // Handle specific error cases with better messaging
      const errorMessage = error.error || error.message || '';

      if (errorMessage.includes('duplicate key') || errorMessage.includes('already exists')) {
        setErrors({ email: 'This email is already registered. Please login instead.' });
        toast.error('Email already registered. Try logging in!');
      } else if (errorMessage.includes('after') && errorMessage.includes('seconds')) {
        // Extract wait time from error message
        const match = errorMessage.match(/after (\d+) seconds/);
        const seconds = match ? match[1] : '60';
        toast.error(`Please wait ${seconds} seconds before trying again`);
      } else if (errorMessage.includes('rate')) {
        toast.error('Too many attempts. Please wait a moment and try again.');
      }
      // Otherwise, error toast is already shown by AuthContext
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignUp = async () => {
    try {
      await googleLogin();
      // Redirect will happen automatically via OAuth
    } catch (error) {
      console.error('Google signup error:', error);

      // Handle specific Google OAuth errors
      const errorMessage = error.error || error.message || '';

      if (errorMessage.includes('provider') && errorMessage.includes('not enabled')) {
        toast.error('Google sign-up is currently unavailable. Please use email signup or contact support.', {
          duration: 5000
        });
      } else if (errorMessage.includes('validation_failed')) {
        toast.error('Google authentication is not configured. Please use email signup.');
      }
      // Otherwise, error toast is already shown by AuthContext
    }
  };


  return (
    <AuthLayout testimonial={testimonial}>
      <div className="signup-form-container">
        <Logo variant="auth" className="signup-logo" />
          
        <h1 className="auth-title">Sign up</h1>
        <p className="auth-subtitle">Start your 30-day free trial.</p>
          
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="name" className="form-label">Name</label>
            <input
              type="text"
              id="name"
              name="name"
              placeholder="Enter your name"
              className={`form-input ${errors.name ? 'error' : ''}`}
              value={formData.name}
              onChange={handleChange}
              disabled={isSubmitting || loading}
            />
            {errors.name && (
              <span className="error-text">{errors.name}</span>
            )}
          </div>
            
          <div className="form-group">
            <label htmlFor="email" className="form-label">Email</label>
            <input
              type="email"
              id="email"
              name="email"
              placeholder="Enter your email"
              className={`form-input ${errors.email ? 'error' : ''}`}
              value={formData.email}
              onChange={handleChange}
              disabled={isSubmitting || loading}
            />
            {errors.email && (
              <span className="error-text">{errors.email}</span>
            )}
          </div>
            
          <div className="form-group">
            <label htmlFor="password" className="form-label">Password</label>
             <input
              type="password"
              id="password"
              name="password"
              placeholder="Create a password"
              className={`form-input ${errors.password ? 'error' : ''}`}
              value={formData.password}
              onChange={handleChange}
              disabled={isSubmitting || loading}
            />
            {errors.password ? (
              <span className="error-text">{errors.password}</span>
            ) : (
              <span className="helper-text">Must be at least 8 characters.</span>
            )}
          </div>
            
          <div className="form-group">
            <label htmlFor="confirmPassword" className="form-label">Confirm Password</label>
             <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              placeholder="Confirm your password"
              className={`form-input ${errors.confirmPassword ? 'error' : ''}`}
              value={formData.confirmPassword}
              onChange={handleChange}
              disabled={isSubmitting || loading}
            />
            {errors.confirmPassword ? (
              <span className="error-text">{errors.confirmPassword}</span>
            ) : (
              <span className="helper-text">
                This password must be the same with previous password.
              </span>
            )}
          </div>
            
          <button
            type="submit"
            className="auth-button"
            disabled={isSubmitting || loading}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={18} className="spinner-icon" />
                Creating account...
              </>
            ) : (
              'Get started'
            )}
          </button>
        </form>
          
        <button 
          onClick={handleGoogleSignUp} 
          className="google-button"
          disabled={isSubmitting || loading}

        >
          <svg className="google-icon" width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M18.1713 8.36791H17.5V8.33329H10V11.6666H14.7096C14.0225 13.6071 12.1763 15 10 15C7.23877 15 5.00002 12.7612 5.00002 9.99996C5.00002 7.23871 7.23877 4.99996 10 4.99996C11.2746 4.99996 12.4342 5.48079 13.3171 6.26621L15.6738 3.90954C14.1863 2.52204 12.195 1.66663 10 1.66663C5.39752 1.66663 1.66669 5.39746 1.66669 9.99996C1.66669 14.6025 5.39752 18.3333 10 18.3333C14.6025 18.3333 18.3334 14.6025 18.3334 9.99996C18.3334 9.44121 18.2759 8.89579 18.1713 8.36791Z" fill="#FFC107"/>
            <path d="M2.62752 6.12121L5.36544 8.12913C6.10627 6.29538 7.90044 4.99996 10 4.99996C11.2746 4.99996 12.4342 5.48079 13.3171 6.26621L15.6738 3.90954C14.1863 2.52204 12.195 1.66663 10 1.66663C6.79919 1.66663 4.02335 3.47371 2.62752 6.12121Z" fill="#FF3D00"/>
            <path d="M10 18.3333C12.1525 18.3333 14.1084 17.5095 15.5871 16.17L13.0079 13.9875C12.1431 14.6452 11.0865 15.0009 10 15C7.83255 15 5.99213 13.6179 5.29879 11.6891L2.58046 13.7829C3.96046 16.4816 6.76129 18.3333 10 18.3333Z" fill="#4CAF50"/>
            <path d="M18.1713 8.36795H17.5V8.33333H10V11.6667H14.7096C14.3809 12.5902 13.7889 13.3972 13.0067 13.9879L13.0079 13.9871L15.5871 16.1696C15.4046 16.3354 18.3334 14.1667 18.3334 10C18.3334 9.44129 18.2759 8.89587 18.1713 8.36795Z" fill="#1976D2"/>
          </svg>
          Sign up with Google
        </button>
          
        <p className="auth-switch">
          Already have an account? <Link to="/login" className="auth-link">Log in</Link>
        </p>
      </div>
    </AuthLayout>
  );
};

export default SignUp;