import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  FileText,
  Users,
  Activity,
  LogOut
} from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../supabase/integration/client';
import './AdminLayout.css';

const AdminLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [adminUser, setAdminUser] = useState(null);

  useEffect(() => {
    // Check for admin session
    const session = localStorage.getItem('adminSession');
    if (!session) {
      navigate('/admin/login');
      return;
    }

    try {
      const user = JSON.parse(session);
      setAdminUser(user);
    } catch (error) {
      console.error('Invalid admin session:', error);
      navigate('/admin/login');
    }
  }, [navigate]);

  const handleLogout = async () => {
    try {
      // Sign out from Supabase
      await supabase.auth.signOut();

      // Clear localStorage
      localStorage.removeItem('adminSession');

      toast.success('Logged out successfully');
      navigate('/admin/login');
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('Error logging out');
    }
  };

  const navItems = [
    {
      path: '/admin/dashboard',
      icon: LayoutDashboard,
      label: 'Dashboard'
    },
    {
      path: '/admin/campaigns',
      icon: FileText,
      label: 'Campaigns'
    },
    {
      path: '/admin/users',
      icon: Users,
      label: 'Users'
    },
    {
      path: '/admin/activity',
      icon: Activity,
      label: 'Activity Log'
    }
  ];

  const isActivePath = (path) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  if (!adminUser) {
    return null;
  }

  return (
    <div className="admin-layout">
      {/* Top Bar */}
      <div className="admin-topbar">
        <div className="admin-topbar-brand">
          <span>MovePost Admin</span>
        </div>

        <div className="admin-topbar-user">
          <div className="admin-user-info">
            <span className="admin-user-name">{adminUser.email}</span>
            <span className="admin-user-role">Super Admin</span>
          </div>
          <button
            className="admin-logout-button"
            onClick={handleLogout}
            title="Logout"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>

      {/* Sidebar - Always visible, non-collapsible */}
      <aside className="admin-sidebar">
        <nav className="admin-nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = isActivePath(item.path);

            return (
              <motion.button
                key={item.path}
                className={`admin-nav-item ${isActive ? 'active' : ''}`}
                onClick={() => navigate(item.path)}
                whileHover={{ x: 4 }}
                whileTap={{ scale: 0.98 }}
              >
                <Icon
                  className="admin-nav-item-icon"
                  size={20}
                  strokeWidth={2}
                />
                <span className="admin-nav-item-label">{item.label}</span>
              </motion.button>
            );
          })}
        </nav>

        <div className="admin-sidebar-footer">
          <div className="admin-sidebar-info">
            <p className="admin-sidebar-version">Version 1.0.0</p>
            <p className="admin-sidebar-copyright">© 2025 MovePost</p>
          </div>
        </div>
      </aside>

      {/* Main Content - Always has left margin for sidebar */}
      <main className="admin-main">
        <div className="admin-content">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;
