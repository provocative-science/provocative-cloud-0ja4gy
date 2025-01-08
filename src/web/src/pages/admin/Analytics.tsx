import React, { useState, useCallback, useEffect } from 'react';
import { Box, Grid, Typography, Tabs, Tab, CircularProgress, Alert } from '@mui/material';
import { useWebSocket } from 'react-use-websocket';

import AdminLayout from '../../layouts/AdminLayout';
import RevenueChart from '../../components/dashboard/RevenueChart';
import CarbonMetrics from '../../components/metrics/CarbonMetrics';
import { MetricsTimeRange, MetricsData, WebSocketMessage } from '../../types/metrics';
import { METRICS_CONFIG } from '../../config/constants';

// Constants for metrics configuration
const TIME_RANGES: { value: MetricsTimeRange; label: string }[] = [
  { value: '24h', label: 'Last 24 Hours' },
  { value: '7d', label: 'Last 7 Days' },
  { value: '30d', label: 'Last 30 Days' },
  { value: '90d', label: 'Last 90 Days' }
];

const METRICS_REFRESH_INTERVAL = 30000; // 30 seconds

const Analytics: React.FC = () => {
  // State management
  const [selectedTimeRange, setSelectedTimeRange] = useState<MetricsTimeRange>('24h');
  const [selectedTab, setSelectedTab] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // WebSocket setup for real-time metrics
  const { sendMessage, lastMessage, readyState } = useWebSocket(
    METRICS_CONFIG.wsEndpoint,
    {
      reconnectAttempts: 3,
      reconnectInterval: 5000,
      shouldReconnect: true
    }
  );

  // Handle WebSocket messages
  useEffect(() => {
    if (lastMessage) {
      try {
        const data = JSON.parse(lastMessage.data) as WebSocketMessage;
        if (data.type === 'metrics') {
          // Handle real-time metrics update
          console.log('Received metrics update:', data);
        } else if (data.type === 'alert') {
          setError(data.data.message);
        }
      } catch (err) {
        console.error('Error parsing WebSocket message:', err);
      }
    }
  }, [lastMessage]);

  // Handle tab changes
  const handleTabChange = useCallback((_: React.SyntheticEvent, newValue: number) => {
    setSelectedTab(newValue);
  }, []);

  // Handle time range changes
  const handleTimeRangeChange = useCallback((range: MetricsTimeRange) => {
    setSelectedTimeRange(range);
  }, []);

  // Handle metrics alerts
  const handleMetricsAlert = useCallback((metric: string, value: number) => {
    setError(`Alert: ${metric} threshold exceeded (${value})`);
  }, []);

  return (
    <AdminLayout>
      <Box sx={{ p: 3 }}>
        {/* Header */}
        <Typography variant="h4" gutterBottom>
          Platform Analytics
        </Typography>

        {/* Error Alert */}
        {error && (
          <Alert 
            severity="error" 
            onClose={() => setError(null)}
            sx={{ mb: 3 }}
          >
            {error}
          </Alert>
        )}

        {/* Time Range Selector */}
        <Box sx={{ mb: 3 }}>
          <Tabs
            value={selectedTimeRange}
            onChange={(_, value) => handleTimeRangeChange(value)}
            aria-label="Time range selection"
          >
            {TIME_RANGES.map(range => (
              <Tab
                key={range.value}
                label={range.label}
                value={range.value}
                aria-label={`Show data for ${range.label}`}
              />
            ))}
          </Tabs>
        </Box>

        {/* Metrics Grid */}
        <Grid container spacing={3}>
          {/* Revenue Metrics */}
          <Grid item xs={12}>
            <Box
              sx={{
                bgcolor: 'background.paper',
                p: 3,
                borderRadius: 1,
                boxShadow: 1
              }}
            >
              <Typography variant="h6" gutterBottom>
                Revenue Overview
              </Typography>
              <RevenueChart
                timeRange={selectedTimeRange}
                refreshInterval={METRICS_REFRESH_INTERVAL}
                height={400}
                className="revenue-chart"
                onDataUpdate={(data) => {
                  // Handle revenue data updates
                  console.log('Revenue data updated:', data);
                }}
                ariaLabel="Platform revenue chart"
              />
            </Box>
          </Grid>

          {/* Environmental Impact Metrics */}
          <Grid item xs={12}>
            <Box
              sx={{
                bgcolor: 'background.paper',
                p: 3,
                borderRadius: 1,
                boxShadow: 1
              }}
            >
              <Typography variant="h6" gutterBottom>
                Environmental Impact
              </Typography>
              <CarbonMetrics
                timeRange={selectedTimeRange}
                refreshInterval={METRICS_REFRESH_INTERVAL}
                className="carbon-metrics"
                onAlert={handleMetricsAlert}
                precision={2}
              />
            </Box>
          </Grid>
        </Grid>

        {/* WebSocket Connection Status */}
        {readyState !== 1 && (
          <Box
            sx={{
              position: 'fixed',
              bottom: 16,
              right: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              bgcolor: 'background.paper',
              p: 1,
              borderRadius: 1,
              boxShadow: 2
            }}
          >
            <CircularProgress size={20} />
            <Typography variant="body2">
              Connecting to real-time metrics...
            </Typography>
          </Box>
        )}
      </Box>
    </AdminLayout>
  );
};

export default Analytics;