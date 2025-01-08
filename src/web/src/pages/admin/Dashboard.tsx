import React, { useEffect, useCallback, useState } from 'react';
import { Grid, Box } from '@mui/material';
import { useWebSocket } from 'react-use-websocket';

import AdminLayout from '../../layouts/AdminLayout';
import AdminDashboard from '../../components/dashboard/AdminDashboard';
import { useMetrics } from '../../hooks/useMetrics';

// Constants for metrics refresh intervals
const GPU_METRICS_INTERVAL = 5000;
const CARBON_METRICS_INTERVAL = 30000;
const SYSTEM_METRICS_INTERVAL = 15000;

/**
 * Admin Dashboard page component that provides comprehensive system monitoring
 * including GPU management, revenue tracking, and environmental metrics
 */
const DashboardPage: React.FC = () => {
  // Initialize metrics hooks with environmental monitoring
  const {
    gpuMetrics,
    carbonMetrics,
    systemMetrics,
    loading,
    error,
    connectionStatus,
    lastUpdated,
    refetch
  } = useMetrics({
    timeRange: '24h',
    gpuId: undefined,
    serverId: undefined
  });

  // WebSocket connection for real-time updates
  const { sendMessage, lastMessage, readyState } = useWebSocket(
    process.env.REACT_APP_WS_URL || 'wss://api.provocative.cloud/ws',
    {
      shouldReconnect: true,
      reconnectAttempts: 5,
      reconnectInterval: 3000
    }
  );

  // Local state for staggered updates
  const [lastGPUUpdate, setLastGPUUpdate] = useState<number>(0);
  const [lastCarbonUpdate, setLastCarbonUpdate] = useState<number>(0);
  const [lastSystemUpdate, setLastSystemUpdate] = useState<number>(0);

  /**
   * Handle real-time metrics updates from WebSocket
   */
  useEffect(() => {
    if (lastMessage !== null) {
      const data = JSON.parse(lastMessage.data);
      if (data.type === 'metrics') {
        const now = Date.now();

        // Stagger updates to prevent UI thrashing
        if (data.gpuMetrics && now - lastGPUUpdate >= GPU_METRICS_INTERVAL) {
          setLastGPUUpdate(now);
        }
        if (data.carbonMetrics && now - lastCarbonUpdate >= CARBON_METRICS_INTERVAL) {
          setLastCarbonUpdate(now);
        }
        if (data.systemMetrics && now - lastSystemUpdate >= SYSTEM_METRICS_INTERVAL) {
          setLastSystemUpdate(now);
        }
      }
    }
  }, [lastMessage, lastGPUUpdate, lastCarbonUpdate, lastSystemUpdate]);

  /**
   * Handle manual refresh with debouncing
   */
  const handleRefresh = useCallback(async () => {
    try {
      await refetch();
    } catch (error) {
      console.error('Error refreshing metrics:', error);
    }
  }, [refetch]);

  /**
   * Cleanup WebSocket subscriptions on unmount
   */
  useEffect(() => {
    return () => {
      if (readyState === WebSocket.OPEN) {
        sendMessage(JSON.stringify({ type: 'unsubscribe_all' }));
      }
    };
  }, [sendMessage, readyState]);

  return (
    <AdminLayout>
      <Box sx={{ flexGrow: 1, p: 3 }}>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <AdminDashboard
              refreshInterval={GPU_METRICS_INTERVAL}
              environmentalMetricsEnabled={true}
              gpuMetrics={gpuMetrics}
              carbonMetrics={carbonMetrics}
              systemMetrics={systemMetrics}
              loading={loading}
              error={error}
              connectionStatus={connectionStatus}
              lastUpdated={lastUpdated}
              onRefresh={handleRefresh}
            />
          </Grid>
        </Grid>
      </Box>
    </AdminLayout>
  );
};

// Add display name for debugging
DashboardPage.displayName = 'AdminDashboardPage';

// Export with error boundary and metrics provider decorators
export default DashboardPage;