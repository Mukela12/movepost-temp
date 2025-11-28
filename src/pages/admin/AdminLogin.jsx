import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Shield, Mail, Lock, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../supabase/integration/client';
import './AdminLogin.css';

const AdminLogin = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Check if user is already logged in
  useEffect(() => {
    checkExistingSession();
  }, []);

  const checkExistingSession = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        // Check if user is an admin
        const { data: profile } = await supabase
          .from('profile')
          .select('role')
          .eq('user_id', user.id)
          .single();

        if (profile && (profile.role === 'admin' || profile.role === 'super_admin')) {
          // Already logged in as admin, redirect to dashboard
          navigate('/admin/dashboard');
        }
      }
    } catch (err) {
      console.error('Error checking session:', err);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    // Clear error when user starts typing
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!formData.email || !formData.password) {
      setError('Please fill in all fields');
      return;
    }

    // Simple email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('Please enter a valid email address');
      return;
    }

    setIsLoading(true);

    try {
      // Sign in with Supabase
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password
      });

      if (authError) {
        console.error('Auth error:', authError);
        setError('Invalid email or password');
        setIsLoading(false);
        return;
      }

      if (!authData.user) {
        setError('Authentication failed. Please try again.');
        setIsLoading(false);
        return;
      }

      // Check user role from profile table
      const { data: profile, error: profileError } = await supabase
        .from('profile')
        .select('role, full_name, email')
        .eq('user_id', authData.user.id)
        .single();

      if (profileError) {
        console.error('Profile error:', profileError);
        await supabase.auth.signOut();
        setError('Failed to load user profile. Please try again.');
        setIsLoading(false);
        return;
      }

      // Verify user has admin privileges
      if (profile.role !== 'admin' && profile.role !== 'super_admin') {
        await supabase.auth.signOut();
        setError('Access denied. Admin privileges required.');
        setIsLoading(false);
        return;
      }

      // Store admin session info in localStorage for quick access
      localStorage.setItem('adminSession', JSON.stringify({
        id: authData.user.id,
        email: profile.email,
        name: profile.full_name,
        role: profile.role,
        logged_in_at: new Date().toISOString()
      }));

      toast.success(`Welcome back${profile.full_name ? ', ' + profile.full_name : ''}!`);
      navigate('/admin/dashboard');
    } catch (err) {
      console.error('Login error:', err);
      setError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="admin-login-container">
      <div className="admin-login-background">
        <div className="admin-login-gradient"></div>

        {/* SVG Geometric Pattern Background */}
        <svg
          style={{
            position: 'absolute',
            left: 'max(50%, 25rem)',
            top: 0,
            height: '64rem',
            width: '128rem',
            transform: 'translateX(-50%)',
            stroke: '#5EEAD4',
            maskImage: 'radial-gradient(64rem 64rem at top, white, transparent)'
          }}
          aria-hidden="true"
        >
          <defs>
            <pattern
              id="admin-pattern"
              width={200}
              height={200}
              x="50%"
              y={-1}
              patternUnits="userSpaceOnUse"
            >
              <path d="M.5 200V.5H200" fill="none" stroke="#2DD4BF" strokeWidth="1" opacity="0.5" />
              <circle cx="100" cy="100" r="50" fill="none" stroke="#2DD4BF" strokeWidth="1.5" opacity="0.4" />
              <circle cx="50" cy="50" r="25" fill="none" stroke="#2DD4BF" strokeWidth="1" opacity="0.35" />
              <circle cx="150" cy="150" r="25" fill="none" stroke="#2DD4BF" strokeWidth="1" opacity="0.35" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" strokeWidth={0} fill="url(#admin-pattern)" />
        </svg>

        {/* Floating Animated Dots */}
        <motion.div
          style={{
            position: 'absolute',
            top: '25%',
            left: '25%',
            width: '12px',
            height: '12px',
            backgroundColor: '#14B8A6',
            borderRadius: '50%',
            opacity: 0.6
          }}
          animate={{
            y: [0, -30, 0],
            x: [0, 15, 0],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        <motion.div
          style={{
            position: 'absolute',
            top: '33%',
            right: '25%',
            width: '10px',
            height: '10px',
            backgroundColor: '#06B6D4',
            borderRadius: '50%',
            opacity: 0.5
          }}
          animate={{
            y: [0, -40, 0],
            x: [0, -20, 0],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 1
          }}
        />
        <motion.div
          style={{
            position: 'absolute',
            bottom: '25%',
            left: '33%',
            width: '11px',
            height: '11px',
            backgroundColor: '#5EEAD4',
            borderRadius: '50%',
            opacity: 0.55
          }}
          animate={{
            y: [0, -25, 0],
            x: [0, 10, 0],
          }}
          transition={{
            duration: 9,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 2
          }}
        />
      </div>

      <motion.div
        className="admin-login-card"
        style={{
          backdropFilter: 'blur(24px)',
          backgroundColor: 'rgba(255, 255, 255, 0.85)',
          border: '1px solid rgba(255, 255, 255, 0.3)'
        }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="admin-login-header">
          <div className="admin-shield-icon">
            <Shield size={32} strokeWidth={2.5} />
          </div>
          <h1>MovePost Admin</h1>
          <p>Sign in to access the admin dashboard</p>
        </div>

        <form onSubmit={handleSubmit} className="admin-login-form">
          {error && (
            <motion.div
              className="admin-error-message"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <AlertCircle size={18} />
              <span>{error}</span>
            </motion.div>
          )}

          <div className="admin-form-group">
            <label htmlFor="email">
              <Mail size={18} />
              Email Address
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="admin@postcard.com"
              disabled={isLoading}
              autoComplete="email"
              autoFocus
            />
          </div>

          <div className="admin-form-group">
            <label htmlFor="password">
              <Lock size={18} />
              Password
            </label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Enter your password"
              disabled={isLoading}
              autoComplete="current-password"
            />
          </div>

          <motion.button
            type="submit"
            className="admin-login-button"
            disabled={isLoading}
            whileHover={!isLoading ? { scale: 1.02 } : {}}
            whileTap={!isLoading ? { scale: 0.98 } : {}}
          >
            {isLoading ? (
              <>
                <span className="admin-login-spinner"></span>
                Signing in...
              </>
            ) : (
              'Sign In'
            )}
          </motion.button>
        </form>

        <div className="admin-login-footer">
          <p className="admin-security-notice">
            Secure admin access. Your account must have admin privileges.
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default AdminLogin;
