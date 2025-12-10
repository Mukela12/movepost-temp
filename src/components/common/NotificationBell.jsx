import React, { useState, useEffect, useRef } from 'react';
import { Bell, Check, X, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import * as notificationService from '../../supabase/api/notificationService';
import './NotificationBell.css';

const NotificationBell = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Load notifications and subscribe to real-time updates
  useEffect(() => {
    if (!user) return;

    loadNotifications();
    loadUnreadCount();

    // Subscribe to real-time notifications
    const subscription = notificationService.subscribeToNotifications(
      user.id,
      (newNotification) => {
        // Add new notification to the list
        setNotifications((prev) => [newNotification, ...prev].slice(0, 5));
        // Increment unread count
        setUnreadCount((prev) => prev + 1);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [user]);

  const loadNotifications = async () => {
    if (!user) return;

    setLoading(true);
    const result = await notificationService.getNotifications(user.id, { limit: 5 });

    if (result.success) {
      setNotifications(result.notifications);
    }
    setLoading(false);
  };

  const loadUnreadCount = async () => {
    if (!user) return;

    const result = await notificationService.getUnreadCount(user.id);
    if (result.success) {
      setUnreadCount(result.count);
    }
  };

  const handleNotificationClick = async (notification) => {
    // Mark as read
    if (!notification.is_read) {
      await notificationService.markAsRead(notification.id);
      setUnreadCount((prev) => Math.max(0, prev - 1));

      // Update local state
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notification.id ? { ...n, is_read: true } : n
        )
      );
    }

    // Navigate to action URL if provided
    if (notification.action_url) {
      navigate(notification.action_url);
      setIsOpen(false);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!user) return;

    const result = await notificationService.markAllAsRead(user.id);
    if (result.success) {
      setUnreadCount(0);
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, is_read: true }))
      );
    }
  };

  const handleViewAll = () => {
    navigate('/notifications');
    setIsOpen(false);
  };

  const getNotificationIcon = (type) => {
    const iconMap = {
      campaign_approved: '✅',
      campaign_rejected: '⚠️',
      campaign_paused: '⏸️',
      campaign_resumed: '▶️',
      user_blocked: '🔒',
      user_unblocked: '🔓',
      payment_failed: '💳',
      payment_success: '✓',
    };
    return iconMap[type] || '📢';
  };

  const formatTimeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);

    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="notification-bell-container" ref={dropdownRef}>
      <button
        className="notification-bell-button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Notifications"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="notification-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
        )}
      </button>

      {isOpen && (
        <div className="notification-dropdown">
          <div className="notification-dropdown-header">
            <h3>Notifications</h3>
            {unreadCount > 0 && (
              <button
                className="mark-all-read-btn"
                onClick={handleMarkAllAsRead}
              >
                <Check size={14} />
                Mark all read
              </button>
            )}
          </div>

          <div className="notification-list">
            {loading ? (
              <div className="notification-loading">Loading...</div>
            ) : notifications.length === 0 ? (
              <div className="notification-empty">
                <Bell size={32} />
                <p>No notifications yet</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`notification-item ${!notification.is_read ? 'unread' : ''}`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="notification-icon">
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div className="notification-content">
                    <h4>{notification.title}</h4>
                    <p>{notification.message}</p>
                    <span className="notification-time">
                      {formatTimeAgo(notification.created_at)}
                    </span>
                  </div>
                  {!notification.is_read && <div className="unread-dot"></div>}
                </div>
              ))
            )}
          </div>

          {notifications.length > 0 && (
            <div className="notification-dropdown-footer">
              <button className="view-all-btn" onClick={handleViewAll}>
                View All Notifications
                <ExternalLink size={14} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
