import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { BarChart3 } from 'lucide-react';
import campaignService from '../../supabase/api/campaignService';
import './AnalyticsChart.css';

const AnalyticsChart = ({ data, total }) => {
  const [analyticsData, setAnalyticsData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load analytics data
  useEffect(() => {
    loadAnalyticsData();
  }, []);

  const loadAnalyticsData = async () => {
    try {
      setIsLoading(true);
      const result = await campaignService.getAnalyticsData(6);
      if (result.success) {
        setAnalyticsData(result.analytics);
      }
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Check if we have actual data
  const hasData = analyticsData && analyticsData.length > 0;

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="custom-tooltip">
          <p className="tooltip-label">{label}</p>
          <p className="tooltip-value">
            <span className="tooltip-dot" style={{ background: '#20B2AA' }}></span>
            Postcards: <strong>{payload[0].value.toLocaleString()}</strong>
          </p>
          {payload[1] && (
            <p className="tooltip-value">
              <span className="tooltip-dot" style={{ background: '#F59E0B' }}></span>
              Campaigns: <strong>{payload[1].value}</strong>
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="analytics-chart-container">
      <div className="chart-header">
        <div className="chart-header-left">
          <h3 className="chart-title">Campaign Analytics</h3>
          <div className="chart-total">{(total || 0).toLocaleString()} Postcards Sent</div>
        </div>
      </div>

      {isLoading ? (
        <div className="chart-loading">
          <div className="loading-spinner"></div>
          <p>Loading analytics...</p>
        </div>
      ) : !hasData || (total || 0) === 0 ? (
        <div className="chart-empty-state">
          <div className="empty-state-icon">
            <BarChart3 size={80} strokeWidth={1.5} />
          </div>
          <div className="empty-state-text">
            <h4>No Campaign Data Yet</h4>
            <p>Analytics will appear here once your campaigns start sending postcards</p>
          </div>
        </div>
      ) : (
        <div className="chart-wrapper">
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart
              data={analyticsData}
              margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="colorPostcards" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#20B2AA" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#20B2AA" stopOpacity={0.1}/>
                </linearGradient>
                <linearGradient id="colorCampaigns" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#F59E0B" stopOpacity={0.1}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis
                dataKey="month"
                stroke="#9CA3AF"
                style={{ fontSize: '12px' }}
              />
              <YAxis
                stroke="#9CA3AF"
                style={{ fontSize: '12px' }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: '14px', paddingTop: '10px' }}
              />
              <Area
                type="monotone"
                dataKey="postcards_sent"
                stroke="#20B2AA"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorPostcards)"
                name="Postcards Sent"
              />
              <Area
                type="monotone"
                dataKey="campaigns"
                stroke="#F59E0B"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorCampaigns)"
                name="Active Campaigns"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

export default AnalyticsChart;