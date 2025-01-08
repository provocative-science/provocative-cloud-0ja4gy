import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Chart } from '../common/Chart';
import { useMetrics } from '../../hooks/useMetrics';
import {
  Server,
  ServerStatus,
  SystemMetrics,
  GPUMetrics,
  CarbonMetrics
} from '../../types/server';
import { METRICS_CONFIG, ENVIRONMENTAL_CONFIG } from '../../config/constants';

interface ServerMetricsProps {
  server: Server;
  refreshInterval?: number;
  className?: string;
  showEnvironmentalMetrics?: boolean;
  onMetricsError?: (error: Error) => void;
}

const ServerMetrics: React.FC<ServerMetricsProps> = ({
  server,
  refreshInterval = METRICS_CONFIG.UPDATE_INTERVAL_MS,
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
    lastUpdated
  } = useMetrics({
    serverId: server.id,
    timeRange: METRICS_CONFIG.DEFAULT_TIME_RANGE
  });

  // Report errors to parent component
  useEffect(() => {
    if (error && onMetricsError) {
      onMetricsError(new Error(error));
    }
  }, [error, onMetricsError]);

  // Format system metrics data for charts
  const formatSystemMetricsData = useCallback((metrics: SystemMetrics) => {
    return {
      labels: ['CPU', 'Memory', 'Network', 'Storage'],
      datasets: [
        {
          label: 'Utilization (%)',
          data: [
            metrics.cpuUtilization,
            (metrics.memoryUsed / metrics.memoryTotal) * 100,
            metrics.networkUtilization,
            (metrics.storageUsed / metrics.storageTotal) * 100
          ],
          backgroundColor: 'rgba(54, 162, 235, 0.5)',
          borderColor: 'rgba(54, 162, 235, 1)',
          borderWidth: 1
        }
      ]
    };
  }, []);

  // Format GPU metrics data for charts
  const formatGPUMetricsData = useCallback((metrics: GPUMetrics[]) => {
    return {
      labels: metrics.map((_, index) => `GPU ${index + 1}`),
      datasets: [
        {
          label: 'Temperature (°C)',
          data: metrics.map(m => m.temperatureCelsius),
          yAxisID: 'temperature',
          borderColor: 'rgba(255, 99, 132, 1)',
          fill: false
        },
        {
          label: 'Utilization (%)',
          data: metrics.map(m => m.utilizationPercent),
          yAxisID: 'utilization',
          borderColor: 'rgba(54, 162, 235, 1)',
          fill: false
        },
        {
          label: 'Memory Usage (GB)',
          data: metrics.map(m => m.memoryUsedGb),
          yAxisID: 'memory',
          borderColor: 'rgba(75, 192, 192, 1)',
          fill: false
        }
      ]
    };
  }, []);

  // Format environmental metrics data for charts
  const formatEnvironmentalMetricsData = useCallback((metrics: CarbonMetrics) => {
    return {
      labels: ['CO2 Captured', 'Power Usage', 'Water Usage', 'Carbon Usage'],
      datasets: [
        {
          label: 'Environmental Metrics',
          data: [
            metrics.co2CapturedKg,
            metrics.powerUsageEffectiveness,
            metrics.waterUsageEffectiveness,
            metrics.carbonUsageEffectiveness
          ],
          backgroundColor: [
            'rgba(75, 192, 192, 0.5)',
            'rgba(255, 99, 132, 0.5)',
            'rgba(54, 162, 235, 0.5)',
            'rgba(255, 206, 86, 0.5)'
          ],
          borderColor: [
            'rgba(75, 192, 192, 1)',
            'rgba(255, 99, 132, 1)',
            'rgba(54, 162, 235, 1)',
            'rgba(255, 206, 86, 1)'
          ],
          borderWidth: 1
        }
      ]
    };
  }, []);

  // Chart options with accessibility support
  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          generateLabels: (chart: any) => {
            const labels = Chart.defaults.plugins.legend.labels.generateLabels(chart);
            return labels.map(label => ({
              ...label,
              text: `${label.text} (Click to toggle)`
            }));
          }
        }
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const label = context.dataset.label || '';
            const value = context.parsed.y;
            return `${label}: ${value.toFixed(2)}`;
          }
        }
      }
    },
    scales: {
      temperature: {
        type: 'linear' as const,
        position: 'left' as const,
        title: {
          display: true,
          text: 'Temperature (°C)'
        }
      },
      utilization: {
        type: 'linear' as const,
        position: 'right' as const,
        title: {
          display: true,
          text: 'Utilization (%)'
        }
      },
      memory: {
        type: 'linear' as const,
        position: 'right' as const,
        title: {
          display: true,
          text: 'Memory Usage (GB)'
        }
      }
    }
  }), []);

  return (
    <div className={className}>
      {/* System Metrics Chart */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">System Performance</h3>
        {systemMetrics && (
          <Chart
            type="bar"
            data={formatSystemMetricsData(systemMetrics)}
            options={chartOptions}
            height={300}
            accessibility={{
              ariaLabel: 'System performance metrics chart',
              description: 'Bar chart showing CPU, memory, network, and storage utilization'
            }}
          />
        )}
      </div>

      {/* GPU Metrics Chart */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">GPU Performance</h3>
        {gpuMetrics && gpuMetrics.length > 0 && (
          <Chart
            type="line"
            data={formatGPUMetricsData(gpuMetrics)}
            options={chartOptions}
            height={300}
            accessibility={{
              ariaLabel: 'GPU performance metrics chart',
              description: 'Line chart showing GPU temperature, utilization, and memory usage'
            }}
          />
        )}
      </div>

      {/* Environmental Metrics Chart */}
      {showEnvironmentalMetrics && carbonMetrics && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-2">Environmental Impact</h3>
          <Chart
            type="radar"
            data={formatEnvironmentalMetricsData(carbonMetrics)}
            options={{
              ...chartOptions,
              scales: {
                r: {
                  min: 0,
                  max: Math.max(
                    ENVIRONMENTAL_CONFIG.EFFECTIVENESS_RATIOS.MAX_PUE,
                    ENVIRONMENTAL_CONFIG.EFFECTIVENESS_RATIOS.MAX_WUE,
                    ENVIRONMENTAL_CONFIG.EFFECTIVENESS_RATIOS.MAX_CUE
                  )
                }
              }
            }}
            height={300}
            accessibility={{
              ariaLabel: 'Environmental impact metrics chart',
              description: 'Radar chart showing CO2 capture, power usage, water usage, and carbon usage effectiveness'
            }}
          />
        </div>
      )}

      {/* Status Information */}
      <div className="text-sm text-gray-600">
        <p>Connection Status: {connectionStatus}</p>
        <p>Last Updated: {new Date(lastUpdated).toLocaleString()}</p>
        {error && <p className="text-red-500">Error: {error}</p>}
      </div>
    </div>
  );
};

export default ServerMetrics;