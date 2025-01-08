import React, { useEffect, useMemo, useCallback, useState } from 'react';
import styled from '@emotion/styled';
import { useWebSocket } from 'react-use-websocket';
import { ErrorBoundary } from 'react-error-boundary';

import ServerCard from './ServerCard';
import Loading from '../common/Loading';
import { useServerList } from '../../hooks/useServer';
import { ENVIRONMENTAL_CONFIG } from '../../config/constants';

// Styled components
const ServerListContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 24px;
  padding: 16px;
  width: 100%;
  position: relative;
  min-height: 200px;
`;

const ErrorMessage = styled.div`
  color: var(--error);
  text-align: center;
  padding: 16px;
  background-color: var(--error-bg);
  border-radius: 4px;
  margin: 16px;
`;

const EmptyMessage = styled.div`
  text-align: center;
  padding: 32px;
  color: var(--text-secondary);
  background-color: var(--background-secondary);
  border-radius: 4px;
`;

const MetricsContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
  background-color: var(--background-tertiary);
  border-radius: 4px;
  margin-bottom: 24px;
`;

// Props interface
interface ServerListProps {
  filter?: ServerFilter;
  showActions?: boolean;
  className?: string;
  environmentalMetricsEnabled?: boolean;
  groupByEfficiency?: boolean;
  onMetricsExport?: (data: ServerMetrics[]) => void;
}

const ServerList: React.FC<ServerListProps> = ({
  filter,
  showActions = true,
  className,
  environmentalMetricsEnabled = true,
  groupByEfficiency = false,
  onMetricsExport
}) => {
  // Get server list data and metrics
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

  // Local state for metrics aggregation
  const [totalCO2Captured, setTotalCO2Captured] = useState(0);
  const [averageEfficiency, setAverageEfficiency] = useState(0);

  // Calculate environmental metrics
  useEffect(() => {
    if (servers.length > 0) {
      const co2Total = servers.reduce((sum, server) => 
        sum + server.carbonMetrics.co2CapturedKg, 0);
      
      const efficiencyAvg = servers.reduce((sum, server) => 
        sum + (1 - (server.carbonMetrics.powerUsageEffectiveness - 1) / 
        (ENVIRONMENTAL_CONFIG.EFFECTIVENESS_RATIOS.MAX_PUE - 1)), 0) / servers.length * 100;

      setTotalCO2Captured(co2Total);
      setAverageEfficiency(efficiencyAvg);
    }
  }, [servers]);

  // Handle real-time updates
  useEffect(() => {
    if (lastMessage) {
      const update = JSON.parse(lastMessage.data);
      if (update.type === 'metrics') {
        refreshList();
      }
    }
  }, [lastMessage, refreshList]);

  // Group servers by efficiency if enabled
  const groupedServers = useMemo(() => {
    if (!groupByEfficiency) return { all: servers };

    return servers.reduce((groups, server) => {
      const efficiency = (1 - (server.carbonMetrics.powerUsageEffectiveness - 1) / 
        (ENVIRONMENTAL_CONFIG.EFFECTIVENESS_RATIOS.MAX_PUE - 1)) * 100;
      
      const category = efficiency >= 90 ? 'high' : 
                      efficiency >= 70 ? 'medium' : 'low';
      
      if (!groups[category]) groups[category] = [];
      groups[category].push(server);
      return groups;
    }, {} as Record<string, Server[]>);
  }, [servers, groupByEfficiency]);

  // Handle maintenance mode toggle
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

  if (loading) {
    return <Loading size="lg" text="Loading servers..." />;
  }

  if (error) {
    return <ErrorMessage>{error}</ErrorMessage>;
  }

  if (servers.length === 0) {
    return <EmptyMessage>No servers found</EmptyMessage>;
  }

  return (
    <ErrorBoundary fallback={<ErrorMessage>Error displaying servers</ErrorMessage>}>
      <div className={className}>
        {environmentalMetricsEnabled && (
          <MetricsContainer>
            <h3>Environmental Impact</h3>
            <div>
              <div>Total CO₂ Captured: {totalCO2Captured.toFixed(2)} kg</div>
              <div>Average Efficiency: {averageEfficiency.toFixed(1)}%</div>
            </div>
          </MetricsContainer>
        )}

        <ServerListContainer>
          {Object.entries(groupedServers).map(([group, groupServers]) => (
            <React.Fragment key={group}>
              {groupByEfficiency && (
                <h3>{group.charAt(0).toUpperCase() + group.slice(1)} Efficiency</h3>
              )}
              {groupServers.map(server => (
                <ServerCard
                  key={server.id}
                  server={server}
                  onMaintenanceClick={handleMaintenanceClick}
                  onConfigureClick={() => {}}
                  onMetricsClick={() => {}}
                  showActions={showActions}
                  showEnvironmentalMetrics={environmentalMetricsEnabled}
                />
              ))}
            </React.Fragment>
          ))}
        </ServerListContainer>
      </div>
    </ErrorBoundary>
  );
};

export default ServerList;