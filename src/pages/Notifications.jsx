import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, CheckCheck, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import * as notificationService from '../supabase/api/notificationService';
import DashboardLayout from '../components/layout/DashboardLayout';
import './Notifications.css';

function Notifications() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all' or 'unread'

  useEffect(() => {
    loadNotifications();

    // Subscribe to real-time updates
    if (user) {
      const subscription = notificationService.subscribeToNotifications(
        user.id,
        () => {
          // Reload notifications when a new one arrives
          loadNotifications();
        }
      );

      return () => subscription.unsubscribe();
    }
  }, [user, filter]);

  const loadNotifications = async () => {
    if (!user) return;

    setLoading(true);
    const result = await notificationService.getNotifications(user.id, {
      limit: 100,
      unreadOnly: filter === 'unread'
    });

    if (result.success) {
      setNotifications(result.notifications);
    }
    setLoading(false);
  };

  const handleNotificationClick = async (notification) => {
    // Mark as read
    if (!notification.is_read) {
      await notificationService.markAsRead(notification.id);
    }

    // Navigate to action URL if exists
    if (notification.action_url) {
      navigate(notification.action_url);
    }
  };

  const handleMarkAllRead = async () => {
    if (!user) return;

    const result = await notificationService.markAllAsRead(user.id);
    if (result.success) {
      loadNotifications();
    }
  };

  const handleDelete = async (notificationId, e) => {
    e.stopPropagation();

    const result = await notificationService.deleteNotification(notificationId);
    if (result.success) {
      setNotifications(notifications.filter(n => n.id !== notificationId));
    }
  };

  const formatTimeAgo = (timestamp) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInSeconds = Math.floor((now - time) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    return time.toLocaleDateString();
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'campaign_approved':
        return '✅';
      case 'campaign_rejected':
        return '❌';
      case 'campaign_paused':
        return '⏸️';
      case 'campaign_resumed':
        return '▶️';
      case 'payment_failed':
        return '💳';
      default:
        return '🔔';
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <DashboardLayout>
      <div className="notifications-page">
        <div className="notifications-header">
          <div className="notifications-title-section">
            <Bell size={28} />
            <h1>Notifications</h1>
            {unreadCount > 0 && (
              <span className="unread-badge">{unreadCount} new</span>
            )}
          </div>

          {notifications.length > 0 && (
            <button
              className="mark-all-read-button"
              onClick={handleMarkAllRead}
              disabled={unreadCount === 0}
            >
              <CheckCheck size={18} />
              Mark All as Read
            </button>
          )}
        </div>

        <div className="notifications-filters">
          <button
            className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All Notifications
          </button>
          <button
            className={`filter-btn ${filter === 'unread' ? 'active' : ''}`}
            onClick={() => setFilter('unread')}
          >
            Unread ({unreadCount})
          </button>
        </div>

        <div className="notifications-container">
          {loading ? (
            <div className="notifications-loading">
              <div className="loading-spinner"></div>
              <p>Loading notifications...</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="notifications-empty">
              <Bell size={64} />
              <h2>
                {filter === 'unread'
                  ? "You're all caught up!"
                  : 'No notifications yet'}
              </h2>
              <p>
                {filter === 'unread'
                  ? 'Check back later for updates on your campaigns.'
                  : "We'll notify you when something important happens."}
              </p>
            </div>
          ) : (
            <div className="notifications-list">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`notification-card ${notification.is_read ? '' : 'unread'}`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="notification-icon-wrapper">
                    <span className="notification-emoji">
                      {getNotificationIcon(notification.type)}
                    </span>
                  </div>

                  <div className="notification-content">
                    <div className="notification-header-row">
                      <h3>{notification.title}</h3>
                      <span className="notification-time">
                        {formatTimeAgo(notification.created_at)}
                      </span>
                    </div>
                    <p className="notification-message">{notification.message}</p>
                    {notification.action_url && (
                      <span className="notification-action-hint">
                        Click to view details →
                      </span>
                    )}
                  </div>

                  <div className="notification-actions">
                    {!notification.is_read && (
                      <div className="unread-indicator" title="Unread"></div>
                    )}
                    <button
                      className="delete-btn"
                      onClick={(e) => handleDelete(notification.id, e)}
                      title="Delete notification"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

export default Notifications;
