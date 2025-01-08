import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { debounce } from 'lodash';
import Chart from '../common/Chart';
import { useMetrics } from '../../hooks/useMetrics';
import { useWebSocket } from '../../hooks/useWebSocket';
import { METRICS_CONFIG, ENVIRONMENTAL_CONFIG } from '../../config/constants';

interface MetricsChartProps {
  type: 'line' | 'bar';
  metricType: 'gpu' | 'carbon' | 'system' | 'environmental';
  timeRange: MetricsTimeRange;
  gpuId?: string;
  serverId?: string;
  height?: number;
  width?: number;
  className?: string;
  refreshInterval?: number;
  retryAttempts?: number;
  accessibilityLabel?: string;
}

const MetricsChart: React.FC<MetricsChartProps> = ({
  type,
  metricType,
  timeRange,
  gpuId,
  serverId,
  height = 300,
  width,
  className,
  refreshInterval = METRICS_CONFIG.CHART_REFRESH_MS,
  retryAttempts = 3,
  accessibilityLabel
}) => {
  const chartRef = useRef<Chart>(null);
  const [wsRetryCount, setWsRetryCount] = useState(0);

  // Initialize metrics hook with enhanced environmental tracking
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
    timeRange,
    gpuId,
    serverId
  });

  // Initialize WebSocket connection for real-time updates
  const {
    isConnected: wsConnected,
    error: wsError,
    connect: wsConnect,
    disconnect: wsDisconnect
  } = useWebSocket({
    autoConnect: true,
    maxRetries: retryAttempts,
    onMessage: handleDataUpdate,
    onError: (error) => {
      console.error('WebSocket error:', error);
      if (wsRetryCount < retryAttempts) {
        setWsRetryCount(prev => prev + 1);
        wsConnect();
      }
    }
  });

  // Format metrics data based on type with environmental focus
  const formatMetricsData = useCallback((
    metrics: any,
    type: string,
    timeRange: MetricsTimeRange
  ) => {
    if (!metrics) return null;

    const labels = [];
    const datasets = [];

    switch (type) {
      case 'gpu':
        datasets.push({
          label: 'GPU Utilization (%)',
          data: metrics.map((m: any) => m.utilizationPercent),
          borderColor: '#0066CC',
          fill: false
        }, {
          label: 'Memory Usage (GB)',
          data: metrics.map((m: any) => m.memoryUsedGb),
          borderColor: '#33CC33',
          fill: false
        }, {
          label: 'Temperature (°C)',
          data: metrics.map((m: any) => m.temperatureCelsius),
          borderColor: '#FF3300',
          fill: false
        });
        labels.push(...metrics.map((m: any) => new Date(m.timestamp).toLocaleTimeString()));
        break;

      case 'carbon':
        datasets.push({
          label: 'CO₂ Captured (kg)',
          data: [carbonMetrics.co2CapturedKg],
          backgroundColor: '#33CC33',
        }, {
          label: 'Power Usage Effectiveness',
          data: [carbonMetrics.powerUsageEffectiveness],
          backgroundColor: '#0066CC',
        }, {
          label: 'Water Usage Effectiveness',
          data: [carbonMetrics.waterUsageEffectiveness],
          backgroundColor: '#FF9900',
        });
        labels.push('Current Values');
        break;

      case 'environmental':
        const efficiency = calculateEnvironmentalEfficiency(carbonMetrics);
        datasets.push({
          label: 'Carbon Capture Efficiency',
          data: [efficiency.carbonCaptureEfficiency],
          backgroundColor: '#33CC33',
        }, {
          label: 'Cooling Efficiency',
          data: [efficiency.coolingEfficiency],
          backgroundColor: '#0066CC',
        }, {
          label: 'Overall Environmental Score',
          data: [efficiency.overallScore],
          backgroundColor: '#FF9900',
        });
        labels.push('Environmental Metrics');
        break;

      default:
        return null;
    }

    return {
      labels,
      datasets
    };
  }, []);

  // Calculate environmental efficiency metrics
  const calculateEnvironmentalEfficiency = useCallback((metrics: any) => {
    if (!metrics) return null;

    const carbonCaptureEfficiency = (metrics.co2CapturedKg / 
      ENVIRONMENTAL_CONFIG.CO2_CAPTURE_THRESHOLDS.TARGET_RATE_KG_PER_DAY) * 100;

    const coolingEfficiency = (1 - (metrics.powerUsageEffectiveness - 1) / 
      (ENVIRONMENTAL_CONFIG.EFFECTIVENESS_RATIOS.MAX_PUE - 1)) * 100;

    const overallScore = (carbonCaptureEfficiency + coolingEfficiency) / 2;

    return {
      carbonCaptureEfficiency,
      coolingEfficiency,
      overallScore
    };
  }, []);

  // Debounced update handler for real-time data
  const handleDataUpdate = useMemo(() => 
    debounce((newData: any) => {
      if (!chartRef.current) return;

      const formattedData = formatMetricsData(newData, metricType, timeRange);
      if (formattedData) {
        chartRef.current.data = formattedData;
        chartRef.current.update();
      }
    }, 1000),
    [formatMetricsData, metricType, timeRange]
  );

  // Chart options with accessibility support
  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 750,
      easing: 'easeInOutQuart'
    },
    plugins: {
      legend: {
        display: true,
        position: 'top' as const
      },
      tooltip: {
        enabled: true,
        mode: 'index' as const,
        intersect: false
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value: number) => {
            if (metricType === 'carbon') {
              return `${value} kg`;
            }
            return value;
          }
        }
      }
    },
    accessibility: {
      enabled: true,
      description: accessibilityLabel
    }
  }), [metricType, accessibilityLabel]);

  // Effect for WebSocket cleanup
  useEffect(() => {
    return () => {
      wsDisconnect();
    };
  }, [wsDisconnect]);

  // Render loading state
  if (loading) {
    return <div>Loading metrics data...</div>;
  }

  // Render error state
  if (error) {
    return <div>Error loading metrics: {error}</div>;
  }

  // Format data based on metric type
  const data = formatMetricsData(
    metricType === 'gpu' ? gpuMetrics :
    metricType === 'carbon' ? carbonMetrics :
    metricType === 'environmental' ? carbonMetrics :
    systemMetrics,
    metricType,
    timeRange
  );

  if (!data) {
    return <div>No metrics data available</div>;
  }

  return (
    <Chart
      ref={chartRef}
      type={type}
      data={data}
      options={chartOptions}
      height={height}
      width={width}
      className={className}
      refreshInterval={refreshInterval}
      accessibility={{
        ariaLabel: accessibilityLabel,
        description: `Real-time ${metricType} metrics visualization`
      }}
    />
  );
};

export default React.memo(MetricsChart);