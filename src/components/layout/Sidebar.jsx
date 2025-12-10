import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Home, Clock, Settings, ChevronDown, LogOut } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import Avatar from '../ui/Avatar';
import NotificationBell from '../common/NotificationBell';
import { cn } from '../../utils/cn';
import './Sidebar.css';

const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const isActive = (path) => {
    return location.pathname === path;
  };

  const navigationItems = [
    {
      path: '/dashboard',
      label: 'Dashboard',
      icon: Home,
    },
    {
      path: '/history',
      label: 'History',
      icon: Clock,
    },
  ];

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="sidebar">
      {/* Logo Section */}
      <div className="sidebar-header">
        <img
          src="/movepost-logo.png"
          alt="MovePost"
          className="sidebar-logo"
        />
        <NotificationBell />
      </div>

      {/* Navigation Menu */}
      <nav className="nav-menu">
        {navigationItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);

          return (
            <motion.div
              key={item.path}
              className={cn(
                'nav-item',
                active && 'active'
              )}
              onClick={() => navigate(item.path)}
              whileHover={{ x: 4 }}
              whileTap={{ scale: 0.98 }}
            >
              <Icon
                className={cn(
                  'nav-icon',
                  active ? 'text-primary-700' : 'text-gray-400'
                )}
                size={20}
              />
              <span className="nav-label">{item.label}</span>
            </motion.div>
          );
        })}
      </nav>

      {/* Footer Section */}
      <div className="sidebar-footer">
        {/* Settings */}
        <motion.div
          className={cn(
            'nav-item',
            isActive('/settings') && 'active'
          )}
          onClick={() => navigate('/settings')}
          whileHover={{ x: 4 }}
          whileTap={{ scale: 0.98 }}
        >
          <Settings
            className={cn(
              'nav-icon',
              isActive('/settings') ? 'text-primary-700' : 'text-gray-400'
            )}
            size={20}
          />
          <span className="nav-label">Settings</span>
        </motion.div>

        {/* User Profile */}
        <div className="user-profile">
          <div className="flex items-center space-x-3 flex-1 min-w-0">
            <Avatar user={user} size="md" />
            <div className="user-info">
              <div className="user-name">{user?.name || user?.email?.split('@')[0] || 'User'}</div>
              <div className="user-email">{user?.email || 'user@company.com'}</div>
            </div>
          </div>
          <motion.button
            className="logout-button"
            onClick={handleLogout}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            title="Logout"
          >
            <LogOut size={18} className="text-gray-400 hover:text-red-600" />
          </motion.button>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;