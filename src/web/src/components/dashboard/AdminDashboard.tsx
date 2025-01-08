import React, { useState, useEffect, useCallback, useRef } from 'react';
import styled from '@emotion/styled';
import { Grid, useTheme, useMediaQuery } from '@mui/material';
import { Card, CardProps } from '../common/Card';
import { MetricsChart, ChartType } from '../metrics/MetricsChart';
import { ServerList } from '../server/ServerList';
import { RevenueChart } from './RevenueChart';
import { useWebSocket } from '../../hooks/useWebSocket';
import { METRICS_CONFIG, ENVIRONMENTAL_CONFIG } from '../../config/constants';

// Styled components
const StyledDashboard = styled(Grid)`
  padding: ${props => props.theme.spacing(3)};
  gap: ${props => props.theme.spacing(3)};
  min-height: 100vh;
`;

const MetricsCard = styled(Card)<CardProps>`
  height: 100%;
  min-height: 300px;
  display: flex;
  flex-direction: column;
`;

const MetricsHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${props => props.theme.spacing(2)};
`;

const MetricsValue = styled.div`
  font-size: 1.5rem;
  font-weight: 600;
  color: ${props => props.theme.colors.primaryText};
`;

const MetricsLabel = styled.div`
  font-size: 0.875rem;
  color: ${props => props.theme.colors.secondaryText};
`;

// Props interface
interface AdminDashboardProps {
  className?: string;
  refreshInterval?: number;
  environmentalMetricsEnabled?: boolean;
}

// Main component
const AdminDashboard: React.FC<AdminDashboardProps> = ({
  className,
  refreshInterval = METRICS_CONFIG.UPDATE_INTERVAL_MS,
  environmentalMetricsEnabled = true
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  // State management
  const [selectedServerId, setSelectedServerId] = useState<string | null>(null);
  const [environmentalMetrics, setEnvironmentalMetrics] = useState({
    co2Captured: 0,
    powerEfficiency: 0,
    waterEfficiency: 0
  });
  const lastUpdated = useRef<number>(Date.now());

  // WebSocket setup for real-time metrics
  const { isConnected, error: wsError } = useWebSocket({
    autoConnect: true,
    maxRetries: 3,
    onMessage: handleMetricsUpdate,
    onError: (error) => console.error('WebSocket error:', error)
  });

  // Handle real-time metrics updates
  function handleMetricsUpdate(message: any) {
    if (message.type === 'metrics') {
      const { carbonMetrics, systemMetrics } = message.payload;
      
      setEnvironmentalMetrics({
        co2Captured: carbonMetrics.co2CapturedKg,
        powerEfficiency: (1 - (carbonMetrics.powerUsageEffectiveness - 1) / 
          (ENVIRONMENTAL_CONFIG.EFFECTIVENESS_RATIOS.MAX_PUE - 1)) * 100,
        waterEfficiency: (1 - (carbonMetrics.waterUsageEffectiveness - 1) / 
          (ENVIRONMENTAL_CONFIG.EFFECTIVENESS_RATIOS.MAX_WUE - 1)) * 100
      });

      lastUpdated.current = Date.now();
    }
  }

  // Server management handlers
  const handleMaintenanceMode = useCallback(async (serverId: string) => {
    try {
      // Check environmental impact before maintenance
      const efficiency = environmentalMetrics.powerEfficiency;
      if (efficiency < 70) {
        console.warn('Server efficiency below threshold before maintenance');
      }
      
      setSelectedServerId(serverId);
    } catch (error) {
      console.error('Error toggling maintenance mode:', error);
    }
  }, [environmentalMetrics.powerEfficiency]);

  const handleConfigureServer = useCallback((serverId: string) => {
    setSelectedServerId(serverId);
  }, []);

  const handleViewMetrics = useCallback((serverId: string) => {
    setSelectedServerId(serverId);
  }, []);

  return (
    <StyledDashboard 
      container 
      className={className}
      direction={isMobile ? 'column' : 'row'}
    >
      {/* Revenue Overview */}
      <Grid item xs={12} md={8}>
        <MetricsCard>
          <MetricsHeader>
            <h2>Revenue Overview</h2>
          </MetricsHeader>
          <RevenueChart
            timeRange="24h"
            refreshInterval={refreshInterval}
            height={300}
          />
        </MetricsCard>
      </Grid>

      {/* Environmental Impact */}
      {environmentalMetricsEnabled && (
        <Grid item xs={12} md={4}>
          <MetricsCard>
            <MetricsHeader>
              <h2>Environmental Impact</h2>
            </MetricsHeader>
            <MetricsChart
              type={ChartType.LINE}
              metricType="environmental"
              timeRange="24h"
              height={200}
              refreshInterval={refreshInterval}
            />
            <Grid container spacing={2} sx={{ mt: 2 }}>
              <Grid item xs={4}>
                <MetricsLabel>CO₂ Captured</MetricsLabel>
                <MetricsValue>{environmentalMetrics.co2Captured.toFixed(2)} kg</MetricsValue>
              </Grid>
              <Grid item xs={4}>
                <MetricsLabel>Power Efficiency</MetricsLabel>
                <MetricsValue>{environmentalMetrics.powerEfficiency.toFixed(1)}%</MetricsValue>
              </Grid>
              <Grid item xs={4}>
                <MetricsLabel>Water Efficiency</MetricsLabel>
                <MetricsValue>{environmentalMetrics.waterEfficiency.toFixed(1)}%</MetricsValue>
              </Grid>
            </Grid>
          </MetricsCard>
        </Grid>
      )}

      {/* System Health */}
      <Grid item xs={12}>
        <MetricsCard>
          <MetricsHeader>
            <h2>System Health</h2>
          </MetricsHeader>
          <MetricsChart
            type={ChartType.BAR}
            metricType="system"
            timeRange="24h"
            height={200}
            refreshInterval={refreshInterval}
          />
        </MetricsCard>
      </Grid>

      {/* Server Management */}
      <Grid item xs={12}>
        <MetricsCard>
          <MetricsHeader>
            <h2>Server Management</h2>
          </MetricsHeader>
          <ServerList
            showActions={true}
            environmentalMetricsEnabled={environmentalMetricsEnabled}
            groupByEfficiency={true}
            onMaintenanceClick={handleMaintenanceMode}
            onConfigureClick={handleConfigureServer}
            onMetricsClick={handleViewMetrics}
          />
        </MetricsCard>
      </Grid>

      {/* Connection Status */}
      {!isConnected && (
        <div role="alert" aria-live="polite" className="connection-error">
          {wsError ? 
            `Connection error: ${wsError.message}` : 
            'Connecting to metrics service...'}
        </div>
      )}
    </StyledDashboard>
  );
};

export default React.memo(AdminDashboard);