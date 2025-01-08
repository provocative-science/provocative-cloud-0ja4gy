import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Box, Typography, Button, CircularProgress, Alert } from '@mui/material';
import { Add as AddIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import { useWebSocket } from 'react-use-websocket';

import AdminLayout from '../../layouts/AdminLayout';
import ServerList from '../../components/server/ServerList';
import ServerMetrics from '../../components/server/ServerMetrics';
import { useServerList } from '../../hooks/useServer';
import { ENVIRONMENTAL_CONFIG } from '../../config/constants';
import { ServerFilter } from '../../types/server';

/**
 * Admin page component for managing and monitoring GPU servers
 * Includes environmental metrics tracking and carbon capture efficiency monitoring
 */
const ServersPage: React.FC = () => {
  // Server list state and management
  const [filter, setFilter] = useState<ServerFilter>({
    status: null,
    search: '',
    sortBy: 'hostname',
    sortOrder: 'asc',
    environmentalEfficiency: null,
    carbonCaptureRate: null
  });

  // Server metrics and environmental data
  const {
    servers,
    aggregatedMetrics,
    loading,
    error,
    refreshList,
    createServer
  } = useServerList(filter);

  // WebSocket connection for real-time updates
  const { lastMessage } = useWebSocket(process.env.REACT_APP_WS_URL || '', {
    shouldReconnect: true,
    reconnectAttempts: 5,
    reconnectInterval: 3000
  });

  // Calculate environmental efficiency metrics
  const environmentalMetrics = useMemo(() => {
    if (!servers.length) return null;

    const totalCO2Captured = servers.reduce(
      (sum, server) => sum + server.carbonMetrics.co2CapturedKg,
      0
    );

    const avgPowerEfficiency = servers.reduce(
      (sum, server) => sum + server.carbonMetrics.powerUsageEffectiveness,
      0
    ) / servers.length;

    const avgWaterEfficiency = servers.reduce(
      (sum, server) => sum + server.carbonMetrics.waterUsageEffectiveness,
      0
    ) / servers.length;

    return {
      totalCO2Captured,
      avgPowerEfficiency,
      avgWaterEfficiency,
      efficiency: (1 - (avgPowerEfficiency - 1) / 
        (ENVIRONMENTAL_CONFIG.EFFECTIVENESS_RATIOS.MAX_PUE - 1)) * 100
    };
  }, [servers]);

  // Handle real-time updates
  useEffect(() => {
    if (lastMessage) {
      const update = JSON.parse(lastMessage.data);
      if (update.type === 'server_metrics' || update.type === 'environmental_metrics') {
        refreshList();
      }
    }
  }, [lastMessage, refreshList]);

  // Handle filter changes
  const handleFilterChange = useCallback((newFilter: Partial<ServerFilter>) => {
    setFilter(prev => ({
      ...prev,
      ...newFilter
    }));
  }, []);

  // Handle server maintenance mode
  const handleMaintenanceClick = useCallback(async (serverId: string) => {
    try {
      const server = servers.find(s => s.id === serverId);
      if (!server) return;

      // Check environmental metrics before maintenance
      const efficiency = (1 - (server.carbonMetrics.powerUsageEffectiveness - 1) / 
        (ENVIRONMENTAL_CONFIG.EFFECTIVENESS_RATIOS.MAX_PUE - 1)) * 100;

      if (efficiency < 70) {
        console.warn('Server efficiency below threshold before maintenance');
      }

      await server.toggleMaintenance(!server.maintenanceMode, true);
      refreshList();
    } catch (error) {
      console.error('Error toggling maintenance mode:', error);
    }
  }, [servers, refreshList]);

  // Render loading state
  if (loading) {
    return (
      <AdminLayout>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress />
        </Box>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      {/* Header Section */}
      <Box mb={4}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h4" component="h1">
            Server Management
          </Typography>
          <Box>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={() => refreshList()}
              sx={{ mr: 2 }}
            >
              Refresh
            </Button>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => {/* Navigate to add server form */}}
            >
              Add Server
            </Button>
          </Box>
        </Box>

        {/* Environmental Metrics Summary */}
        {environmentalMetrics && (
          <Box mt={2} p={2} bgcolor="background.paper" borderRadius={1}>
            <Typography variant="h6" gutterBottom>
              Environmental Impact
            </Typography>
            <Box display="grid" gridTemplateColumns="repeat(auto-fit, minmax(200px, 1fr))" gap={2}>
              <Box>
                <Typography variant="subtitle2" color="textSecondary">
                  Total CO₂ Captured
                </Typography>
                <Typography variant="h6">
                  {environmentalMetrics.totalCO2Captured.toFixed(2)} kg
                </Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2" color="textSecondary">
                  Avg Power Efficiency
                </Typography>
                <Typography variant="h6">
                  {environmentalMetrics.avgPowerEfficiency.toFixed(2)} PUE
                </Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2" color="textSecondary">
                  Avg Water Efficiency
                </Typography>
                <Typography variant="h6">
                  {environmentalMetrics.avgWaterEfficiency.toFixed(2)} WUE
                </Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2" color="textSecondary">
                  Overall Efficiency
                </Typography>
                <Typography variant="h6">
                  {environmentalMetrics.efficiency.toFixed(1)}%
                </Typography>
              </Box>
            </Box>
          </Box>
        )}
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Server List */}
      <ServerList
        filter={filter}
        showActions={true}
        environmentalMetricsEnabled={true}
        groupByEfficiency={true}
        onMetricsExport={(data) => {/* Handle metrics export */}}
      />
    </AdminLayout>
  );
};

export default ServersPage;