import React, { useState, useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { supabase } from '../../supabase/integration/client';

const AdminProtectedRoute = ({ children }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      // Get current user from Supabase auth
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        // Not logged in, redirect to admin login
        setIsAuthorized(false);
        setLoading(false);
        return;
      }

      // Check user role from profile table
      const { data: profile, error: profileError } = await supabase
        .from('profile')
        .select('role, is_blocked')
        .eq('user_id', user.id)
        .single();

      if (profileError || !profile) {
        console.error('Error fetching profile:', profileError);
        setIsAuthorized(false);
        setLoading(false);
        return;
      }

      // Check if user is blocked
      if (profile.is_blocked) {
        await supabase.auth.signOut();
        localStorage.removeItem('adminSession');
        setIsAuthorized(false);
        setLoading(false);
        return;
      }

      // Check if user has admin privileges
      if (profile.role === 'admin' || profile.role === 'super_admin') {
        setIsAuthorized(true);
      } else {
        // User is logged in but not an admin, redirect to regular dashboard
        setIsAuthorized(false);
      }

      setLoading(false);
    } catch (err) {
      console.error('Error checking auth:', err);
      setIsAuthorized(false);
      setLoading(false);
    }
  };

  // Show loading state while checking auth
  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        backgroundColor: '#f7fafc',
        color: '#4a5568',
        fontSize: '16px',
        fontWeight: '500'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '3px solid #e2e8f0',
            borderTop: '3px solid #20B2AA',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px'
          }}></div>
          <p>Verifying admin access...</p>
        </div>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // If not authorized, redirect to admin login
  if (!isAuthorized) {
    return <Navigate to="/admin/login" replace />;
  }

  // User is authorized, render the protected content
  return children;
};

export default AdminProtectedRoute;
