import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Chart, type ChartType, type ChartData, type ChartOptions } from '../common/Chart';
import { useMetrics } from '../../hooks/useMetrics';
import { useWebSocket } from '../../hooks/useWebSocket';
import { METRICS_CONFIG, ENVIRONMENTAL_CONFIG } from '../../config/constants';

interface PerformanceMetricsProps {
  gpuId?: string;
  serverId?: string;
  timeRange: MetricsTimeRange;
  refreshInterval?: number;
  className?: string;
  showEnvironmentalMetrics: boolean;
  onMetricsError?: (error: string) => void;
}

const PerformanceMetrics: React.FC<PerformanceMetricsProps> = ({
  gpuId,
  serverId,
  timeRange,
  refreshInterval = METRICS_CONFIG.CHART_REFRESH_MS,
  className,
  showEnvironmentalMetrics = true,
  onMetricsError
}) => {
  // Fetch metrics using custom hook
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
    gpuId,
    serverId,
    timeRange
  });

  // WebSocket connection for real-time updates
  const { isConnected, connect, disconnect } = useWebSocket({
    autoConnect: true,
    onMessage: (data) => {
      // Handle real-time metrics updates
      if (data.gpuMetrics && gpuId === data.gpuMetrics.gpuId) {
        // Metrics will be automatically updated through useMetrics hook
      }
    },
    onError: (wsError) => {
      onMetricsError?.(wsError.message);
    }
  });

  // Format metrics data for charts
  const formatMetricsData = useCallback((
    metrics = [],
    environmentalMetrics = null
  ): ChartData => {
    const timestamps = metrics.map(m => new Date(m.timestamp).toLocaleTimeString());
    
    const datasets = [
      {
        label: 'GPU Utilization (%)',
        data: metrics.map(m => m.utilizationPercent),
        borderColor: '#0066CC',
        fill: false
      },
      {
        label: 'Memory Usage (GB)',
        data: metrics.map(m => m.memoryUsedGb),
        borderColor: '#33CC33',
        fill: false
      },
      {
        label: 'Temperature (°C)',
        data: metrics.map(m => m.temperatureCelsius),
        borderColor: '#FF3300',
        fill: false
      },
      {
        label: 'Power Usage (W)',
        data: metrics.map(m => m.powerUsageWatts),
        borderColor: '#FFCC00',
        fill: false
      }
    ];

    // Add environmental metrics if enabled
    if (showEnvironmentalMetrics && environmentalMetrics) {
      datasets.push(
        {
          label: 'CO₂ Captured (kg)',
          data: [environmentalMetrics.co2CapturedKg],
          borderColor: '#66CC66',
          fill: false
        },
        {
          label: 'Power Usage Effectiveness',
          data: [environmentalMetrics.powerUsageEffectiveness],
          borderColor: '#CC6600',
          fill: false
        },
        {
          label: 'Carbon Usage Effectiveness',
          data: [environmentalMetrics.carbonUsageEffectiveness],
          borderColor: '#666666',
          fill: false
        }
      );
    }

    return {
      labels: timestamps,
      datasets
    };
  }, [showEnvironmentalMetrics]);

  // Generate chart options
  const getChartOptions = useCallback((title: string): ChartOptions => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: true,
          text: title
        },
        tooltip: {
          mode: 'index',
          intersect: false
        },
        legend: {
          position: 'bottom'
        }
      },
      scales: {
        x: {
          display: true,
          title: {
            display: true,
            text: 'Time'
          }
        },
        y: {
          display: true,
          title: {
            display: true,
            text: 'Value'
          },
          beginAtZero: true
        }
      },
      animation: {
        duration: 0 // Disable animations for better performance
      }
    };
  }, []);

  // Memoized chart data and options
  const chartData = useMemo(() => 
    formatMetricsData(gpuMetrics, carbonMetrics),
    [gpuMetrics, carbonMetrics, formatMetricsData]
  );

  const chartOptions = useMemo(() => 
    getChartOptions('GPU Performance Metrics'),
    [getChartOptions]
  );

  // Effect for handling WebSocket connection
  useEffect(() => {
    if (gpuId) {
      connect();
      return () => {
        disconnect();
      };
    }
  }, [gpuId, connect, disconnect]);

  // Effect for handling errors
  useEffect(() => {
    if (error) {
      onMetricsError?.(error);
    }
  }, [error, onMetricsError]);

  // Environmental metrics status indicators
  const renderEnvironmentalStatus = () => {
    if (!showEnvironmentalMetrics || !carbonMetrics) return null;

    const isEfficient = 
      carbonMetrics.powerUsageEffectiveness <= ENVIRONMENTAL_CONFIG.EFFECTIVENESS_RATIOS.TARGET_PUE &&
      carbonMetrics.carbonUsageEffectiveness <= ENVIRONMENTAL_CONFIG.EFFECTIVENESS_RATIOS.TARGET_CUE;

    return (
      <div className="environmental-status">
        <div className={`status-indicator ${isEfficient ? 'efficient' : 'inefficient'}`}>
          <span>Carbon Efficiency Status: {isEfficient ? 'Optimal' : 'Sub-optimal'}</span>
        </div>
        <div className="metrics-details">
          <div>CO₂ Captured: {carbonMetrics.co2CapturedKg.toFixed(2)} kg</div>
          <div>PUE: {carbonMetrics.powerUsageEffectiveness.toFixed(3)}</div>
          <div>CUE: {carbonMetrics.carbonUsageEffectiveness.toFixed(3)}</div>
        </div>
      </div>
    );
  };

  if (loading) {
    return <div>Loading metrics...</div>;
  }

  return (
    <div className={className}>
      <div className="metrics-header">
        <h3>Performance Metrics</h3>
        <div className="connection-status">
          Status: {connectionStatus}
          {lastUpdated && (
            <span className="last-updated">
              Last updated: {new Date(lastUpdated).toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      <Chart
        type="line"
        data={chartData}
        options={chartOptions}
        height={400}
        refreshInterval={refreshInterval}
        accessibility={{
          ariaLabel: 'GPU Performance Metrics Chart',
          description: 'Real-time visualization of GPU performance metrics including utilization, memory usage, temperature, and power consumption'
        }}
      />

      {renderEnvironmentalStatus()}
    </div>
  );
};

export default PerformanceMetrics;