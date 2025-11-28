import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown } from 'lucide-react';
import './MetricCard.css';

const MetricCard = ({
  title,
  value,
  icon: Icon,
  trend,
  trendValue,
  color = 'primary',
  loading = false,
  onClick
}) => {
  const colorClasses = {
    primary: 'metric-card-primary',
    success: 'metric-card-success',
    warning: 'metric-card-warning',
    error: 'metric-card-error',
    info: 'metric-card-info'
  };

  return (
    <motion.div
      className={`metric-card ${colorClasses[color]} ${onClick ? 'metric-card-clickable' : ''}`}
      onClick={onClick}
      whileHover={onClick ? { y: -4, scale: 1.02 } : {}}
      whileTap={onClick ? { scale: 0.98 } : {}}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {loading ? (
        <div className="metric-card-loading">
          <div className="metric-card-skeleton metric-card-skeleton-icon"></div>
          <div className="metric-card-skeleton metric-card-skeleton-title"></div>
          <div className="metric-card-skeleton metric-card-skeleton-value"></div>
        </div>
      ) : (
        <>
          <div className="metric-card-header">
            <div className="metric-card-icon">
              {Icon && <Icon size={24} strokeWidth={2.5} />}
            </div>
            {trend && (
              <div className={`metric-card-trend ${trend === 'up' ? 'trend-up' : 'trend-down'}`}>
                {trend === 'up' ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                {trendValue && <span>{trendValue}</span>}
              </div>
            )}
          </div>

          <div className="metric-card-content">
            <h3 className="metric-card-title">{title}</h3>
            <p className="metric-card-value">{value}</p>
          </div>
        </>
      )}
    </motion.div>
  );
};

export default MetricCard;
