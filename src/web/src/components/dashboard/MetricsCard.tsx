import React, { useEffect, useState, useCallback, useRef } from 'react';
import styled from '@emotion/styled';
import { useWebSocket } from 'react-use-websocket';
import { ErrorBoundary } from 'react-error-boundary';

import Card, { CardProps } from '../common/Card';
import Chart from '../common/Chart';
import { GPUMetrics, CarbonMetrics, SystemMetrics } from '../../types/metrics';

// Styled components with theme-aware and responsive design
const MetricsCardContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 300px;
  height: 100%;
  transition: all 0.3s ease;

  @media (max-width: 768px) {
    min-width: 100%;
  }
`;

const MetricsTitle = styled.h3<{ highContrast: boolean }>`
  margin: 0;
  font-size: 1.1rem;
  font-weight: 500;
  color: ${props => props.highContrast ? 
    props.theme.colors.highContrast.text : 
    props.theme.colors.text.primary};
`;

const MetricsValue = styled.div<{ highContrast: boolean }>`
  font-size: 2rem;
  font-weight: bold;
  color: ${props => props.highContrast ? 
    props.theme.colors.highContrast.text : 
    props.theme.colors.text.primary};
  transition: color 0.3s ease;
`;

// Props interface with comprehensive type safety
interface MetricsCardProps {
  title: string;
  type: 'gpu' | 'carbon' | 'system';
  data: GPUMetrics | CarbonMetrics | SystemMetrics;
  showChart?: boolean;
  refreshInterval?: number;
  className?: string;
  onClick?: (data: any) => void;
  highContrast?: boolean;
  wsEndpoint?: string;
  errorFallback?: React.ReactNode;
}

// Utility function for formatting metric values with proper units
const formatMetricValue = (value: number, metric: string, locale: string = 'en-US'): string => {
  const formatter = new Intl.NumberFormat(locale, { 
    maximumFractionDigits: 2,
    minimumFractionDigits: 0
  });

  switch (metric) {
    case 'temperature':
      return `${formatter.format(value)}°C`;
    case 'memory':
      return `${formatter.format(value)} GB`;
    case 'utilization':
      return `${formatter.format(value)}%`;
    case 'power':
      return `${formatter.format(value)}W`;
    case 'co2':
      return `${formatter.format(value)} kg`;
    case 'effectiveness':
      return formatter.format(value);
    default:
      return formatter.format(value);
  }
};

// Chart data preparation with theme-aware styling
const getChartData = (
  data: GPUMetrics | CarbonMetrics | SystemMetrics,
  type: string,
  highContrast: boolean
) => {
  const chartData = {
    labels: [],
    datasets: [{
      label: '',
      data: [],
      borderColor: highContrast ? '#000000' : '#0066CC',
      backgroundColor: highContrast ? '#FFFFFF' : 'rgba(0, 102, 204, 0.1)',
      borderWidth: 2,
      tension: 0.4
    }]
  };

  // Configure chart based on metric type
  switch (type) {
    case 'gpu':
      const gpuData = data as GPUMetrics;
      chartData.datasets[0].label = 'GPU Utilization';
      chartData.datasets[0].data = [gpuData.utilizationPercent];
      break;
    case 'carbon':
      const carbonData = data as CarbonMetrics;
      chartData.datasets[0].label = 'CO₂ Captured';
      chartData.datasets[0].data = [carbonData.co2CapturedKg];
      break;
    // Add other metric types as needed
  }

  return chartData;
};

export const MetricsCard: React.FC<MetricsCardProps> = ({
  title,
  type,
  data,
  showChart = false,
  refreshInterval = 5000,
  className,
  onClick,
  highContrast = false,
  wsEndpoint,
  errorFallback
}) => {
  const [metrics, setMetrics] = useState(data);
  const lastUpdateRef = useRef<number>(Date.now());

  // WebSocket integration for real-time updates
  const { lastMessage } = useWebSocket(wsEndpoint, {
    shouldReconnect: () => true,
    reconnectInterval: 3000,
    reconnectAttempts: 10,
    retryOnError: true,
    onError: (event) => {
      console.error('WebSocket error:', event);
    }
  });

  // Handle real-time metric updates
  useEffect(() => {
    if (lastMessage && Date.now() - lastUpdateRef.current >= refreshInterval) {
      try {
        const updatedMetrics = JSON.parse(lastMessage.data);
        setMetrics(updatedMetrics);
        lastUpdateRef.current = Date.now();
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    }
  }, [lastMessage, refreshInterval]);

  // Click handler with accessibility support
  const handleClick = useCallback((event: React.MouseEvent | React.KeyboardEvent) => {
    if (onClick) {
      onClick(metrics);
    }
  }, [metrics, onClick]);

  // Primary metric value based on type
  const getPrimaryMetricValue = useCallback(() => {
    switch (type) {
      case 'gpu':
        const gpuMetrics = metrics as GPUMetrics;
        return formatMetricValue(gpuMetrics.utilizationPercent, 'utilization');
      case 'carbon':
        const carbonMetrics = metrics as CarbonMetrics;
        return formatMetricValue(carbonMetrics.co2CapturedKg, 'co2');
      default:
        return '0';
    }
  }, [metrics, type]);

  return (
    <ErrorBoundary fallback={errorFallback || <div>Error loading metrics</div>}>
      <Card
        className={className}
        onClick={onClick ? handleClick : undefined}
        clickable={!!onClick}
        elevation={2}
        role="region"
        ariaLabel={`${title} metrics card`}
      >
        <MetricsCardContainer>
          <MetricsTitle highContrast={highContrast}>
            {title}
          </MetricsTitle>
          <MetricsValue highContrast={highContrast}>
            {getPrimaryMetricValue()}
          </MetricsValue>
          {showChart && (
            <Chart
              type="line"
              data={getChartData(metrics, type, highContrast)}
              height={150}
              refreshInterval={refreshInterval}
              accessibility={{
                ariaLabel: `${title} metrics chart`,
                description: `Real-time visualization of ${title.toLowerCase()} metrics`
              }}
            />
          )}
        </MetricsCardContainer>
      </Card>
    </ErrorBoundary>
  );
};

export type { MetricsCardProps };
export default MetricsCard;