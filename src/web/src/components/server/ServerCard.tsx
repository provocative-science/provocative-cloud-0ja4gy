import React, { memo, useCallback, useEffect } from 'react';
import styled from '@emotion/styled';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { MetricsChart } from '../metrics/MetricsChart';
import { useWebSocket } from 'react-use-websocket';
import { Server, ServerStatus } from '../../types/server';
import { ENVIRONMENTAL_CONFIG } from '../../config/constants';

// Styled components
const ServerCardContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 300px;
  max-width: 400px;
  @media (max-width: 768px) {
    min-width: 100%;
    max-width: 100%;
  }
`;

const StatusIndicator = styled.div<{ status: ServerStatus }>`
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background-color: ${props => getStatusColor(props.status)};
  margin-right: 8px;
  position: relative;
  role: status;
  aria-label: ${props => getStatusLabel(props.status)};
`;

const MetricsContainer = styled.div`
  height: 120px;
  transition: height 0.3s ease;
  @media (max-width: 768px) {
    height: 180px;
  }
`;

const EnvironmentalMetricsContainer = styled.div`
  padding: 16px;
  border-top: 1px solid ${props => props.theme.colors.border};
  margin-top: 16px;
`;

const MetricsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-top: 8px;
`;

const MetricItem = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
`;

const MetricLabel = styled.span`
  font-size: 0.875rem;
  color: ${props => props.theme.colors.secondaryText};
`;

const MetricValue = styled.span`
  font-size: 1.125rem;
  font-weight: 500;
  color: ${props => props.theme.colors.primaryText};
`;

// Props interface
interface ServerCardProps {
  server: Server;
  onMaintenanceClick: (serverId: string) => void;
  onConfigureClick: (serverId: string) => void;
  onMetricsClick: (serverId: string) => void;
  showActions?: boolean;
  className?: string;
  showEnvironmentalMetrics?: boolean;
}

// Helper functions
const getStatusColor = (status: ServerStatus): string => {
  const colors = {
    [ServerStatus.ONLINE]: '#33CC33',
    [ServerStatus.OFFLINE]: '#FF3300',
    [ServerStatus.MAINTENANCE]: '#FFCC00',
    [ServerStatus.ERROR]: '#FF3300'
  };
  return colors[status] || '#666666';
};

const getStatusLabel = (status: ServerStatus): string => {
  return `Server is ${status.toLowerCase()}`;
};

// Main component
export const ServerCard: React.FC<ServerCardProps> = memo(({
  server,
  onMaintenanceClick,
  onConfigureClick,
  onMetricsClick,
  showActions = true,
  className,
  showEnvironmentalMetrics = true
}) => {
  // WebSocket connection for real-time metrics
  const { sendMessage, lastMessage } = useWebSocket(`${process.env.REACT_APP_WS_URL}/server/${server.id}/metrics`);

  // Handle real-time metrics updates
  useEffect(() => {
    if (lastMessage) {
      const metrics = JSON.parse(lastMessage.data);
      // Update metrics in parent component if needed
    }
  }, [lastMessage]);

  // Event handlers
  const handleMaintenanceClick = useCallback(() => {
    onMaintenanceClick(server.id);
  }, [server.id, onMaintenanceClick]);

  const handleConfigureClick = useCallback(() => {
    onConfigureClick(server.id);
  }, [server.id, onConfigureClick]);

  const handleMetricsClick = useCallback(() => {
    onMetricsClick(server.id);
  }, [server.id, onMetricsClick]);

  // Calculate environmental efficiency
  const carbonEfficiency = (server.carbonMetrics.co2CapturedKg / 
    ENVIRONMENTAL_CONFIG.CO2_CAPTURE_THRESHOLDS.TARGET_RATE_KG_PER_DAY) * 100;

  const coolingEfficiency = (1 - (server.carbonMetrics.powerUsageEffectiveness - 1) / 
    (ENVIRONMENTAL_CONFIG.EFFECTIVENESS_RATIOS.MAX_PUE - 1)) * 100;

  return (
    <Card className={className}>
      <ServerCardContainer>
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <StatusIndicator status={server.status} />
            <h3 className="text-lg font-semibold">{server.specifications.hostname}</h3>
          </div>
          {showActions && (
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="small"
                onClick={handleMaintenanceClick}
                aria-label={`Toggle maintenance mode for ${server.specifications.hostname}`}
              >
                Maintenance
              </Button>
              <Button
                variant="secondary"
                size="small"
                onClick={handleConfigureClick}
                aria-label={`Configure ${server.specifications.hostname}`}
              >
                Configure
              </Button>
            </div>
          )}
        </div>

        {/* System Metrics */}
        <MetricsContainer>
          <MetricsChart
            type="line"
            metricType="system"
            timeRange="1h"
            serverId={server.id}
            height={100}
          />
        </MetricsContainer>

        {/* Environmental Metrics */}
        {showEnvironmentalMetrics && (
          <EnvironmentalMetricsContainer>
            <h4 className="text-md font-medium">Environmental Impact</h4>
            <MetricsGrid>
              <MetricItem>
                <MetricLabel>CO₂ Captured</MetricLabel>
                <MetricValue>{server.carbonMetrics.co2CapturedKg.toFixed(2)} kg</MetricValue>
              </MetricItem>
              <MetricItem>
                <MetricLabel>Power Usage (PUE)</MetricLabel>
                <MetricValue>{server.carbonMetrics.powerUsageEffectiveness.toFixed(2)}</MetricValue>
              </MetricItem>
              <MetricItem>
                <MetricLabel>Carbon Efficiency</MetricLabel>
                <MetricValue>{carbonEfficiency.toFixed(1)}%</MetricValue>
              </MetricItem>
              <MetricItem>
                <MetricLabel>Cooling Efficiency</MetricLabel>
                <MetricValue>{coolingEfficiency.toFixed(1)}%</MetricValue>
              </MetricItem>
            </MetricsGrid>
          </EnvironmentalMetricsContainer>
        )}

        {/* Actions */}
        {showActions && (
          <Button
            variant="primary"
            onClick={handleMetricsClick}
            fullWidth
            aria-label={`View detailed metrics for ${server.specifications.hostname}`}
          >
            View Detailed Metrics
          </Button>
        )}
      </ServerCardContainer>
    </Card>
  );
});

ServerCard.displayName = 'ServerCard';

export default ServerCard;