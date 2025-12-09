import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, Loader2, CheckCircle } from 'lucide-react';
import AuthLayout from '../../components/auth/AuthLayout';
import Logo from '../../components/common/Logo';
import toast from 'react-hot-toast';
import supabaseAuthService from '../../supabase/api/authService';
import './Login.css';
import './auth-errors.css';

const ResetPassword = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: ''
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [hasToken, setHasToken] = useState(false);

  const testimonial = {
    text: "Security and ease of use - that's what makes this platform stand out. Password recovery is seamless.",
    author: "Sarah Martinez",
    title: "Product Manager",
    company: "Tech Solutions Inc"
  };

  // Check if user has valid reset token on mount
  useEffect(() => {
    const checkResetToken = async () => {
      // Supabase includes the access token in the URL hash when redirecting from password reset email
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get('access_token');
      const type = hashParams.get('type');

      if (accessToken && type === 'recovery') {
        setHasToken(true);
        toast.success('Ready to reset your password');
      } else {
        toast.error('Invalid or expired reset link. Please request a new one.');
        setTimeout(() => {
          navigate('/login');
        }, 3000);
      }
    };

    checkResetToken();
  }, [navigate]);

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

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
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
      await supabaseAuthService.updatePassword(formData.password);

      setIsSuccess(true);
      toast.success('Password updated successfully!');

      // Redirect to login after 2 seconds
      setTimeout(() => {
        navigate('/login');
      }, 2000);

    } catch (error) {
      console.error('Password update error:', error);
      toast.error(error.error || 'Failed to update password. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Don't render the form until we verify the token
  if (!hasToken) {
    return (
      <AuthLayout testimonial={testimonial}>
        <div className="login-form-container">
          <Logo variant="auth" className="login-logo" />
          <h1 className="auth-title">Verifying reset link...</h1>
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <Loader2 size={32} className="spinner-icon" />
          </div>
        </div>
      </AuthLayout>
    );
  }

  // Show success state
  if (isSuccess) {
    return (
      <AuthLayout testimonial={testimonial}>
        <div className="login-form-container">
          <Logo variant="auth" className="login-logo" />
          <div style={{ textAlign: 'center', padding: '2rem 0' }}>
            <CheckCircle size={64} color="#10b981" style={{ margin: '0 auto 1.5rem' }} />
            <h1 className="auth-title">Password Reset Successful</h1>
            <p className="auth-subtitle">
              Your password has been updated. Redirecting to login...
            </p>
          </div>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout testimonial={testimonial}>
      <div className="login-form-container">
        <Logo variant="auth" className="login-logo" />

        <h1 className="auth-title">Reset your password</h1>
        <p className="auth-subtitle">Enter your new password below.</p>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="password" className="form-label">New Password</label>
            <div className="password-input-wrapper">
              <input
                type={showPassword ? "text" : "password"}
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Enter new password"
                className={`form-input ${errors.password ? 'error' : ''}`}
                disabled={isSubmitting}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                disabled={isSubmitting}
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

          <div className="form-group">
            <label htmlFor="confirmPassword" className="form-label">Confirm Password</label>
            <div className="password-input-wrapper">
              <input
                type={showConfirmPassword ? "text" : "password"}
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="Confirm new password"
                className={`form-input ${errors.confirmPassword ? 'error' : ''}`}
                disabled={isSubmitting}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                disabled={isSubmitting}
              >
                {showConfirmPassword ? (
                  <EyeOff size={20} />
                ) : (
                  <Eye size={20} />
                )}
              </button>
            </div>
            {errors.confirmPassword && (
              <span className="error-text">{errors.confirmPassword}</span>
            )}
          </div>

          <button
            type="submit"
            className="auth-button"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={18} className="spinner-icon" />
                Updating password...
              </>
            ) : (
              'Reset Password'
            )}
          </button>
        </form>

        <p className="auth-switch">
          Remember your password? <a href="/login" className="auth-link">Sign in</a>
        </p>
      </div>
    </AuthLayout>
  );
};

export default ResetPassword;
