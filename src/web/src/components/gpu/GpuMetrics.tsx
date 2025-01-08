import React, { useEffect, useMemo, useCallback } from 'react';
import { debounce } from 'lodash';
import Chart from '../common/Chart';
import { useMetrics } from '../../hooks/useMetrics';
import { GPUMetrics } from '../../types/metrics';
import { METRICS_CONFIG, ENVIRONMENTAL_CONFIG } from '../../config/constants';

interface GpuMetricsProps {
  gpuId: string;
  refreshInterval?: number;
  showHistorical?: boolean;
  showEnvironmental?: boolean;
  className?: string;
}

const GpuMetrics: React.FC<GpuMetricsProps> = ({
  gpuId,
  refreshInterval = METRICS_CONFIG.UPDATE_INTERVAL_MS,
  showHistorical = true,
  showEnvironmental = true,
  className
}) => {
  // Fetch metrics data using custom hook
  const {
    gpuMetrics,
    carbonMetrics,
    loading,
    error,
    connectionStatus,
    refetch
  } = useMetrics({
    gpuId,
    timeRange: showHistorical ? METRICS_CONFIG.DEFAULT_TIME_RANGE : undefined
  });

  // Format metrics data for charts
  const formatMetricsData = useCallback((metrics: GPUMetrics[]) => {
    const timestamps = metrics.map(m => new Date(m.timestamp).toLocaleTimeString());
    
    return {
      performanceData: {
        labels: timestamps,
        datasets: [
          {
            label: 'Temperature (°C)',
            data: metrics.map(m => m.temperatureCelsius),
            borderColor: '#FF6B6B',
            fill: false
          },
          {
            label: 'Power Usage (W)',
            data: metrics.map(m => m.powerUsageWatts),
            borderColor: '#4ECDC4',
            fill: false
          }
        ]
      },
      memoryData: {
        labels: timestamps,
        datasets: [
          {
            label: 'Memory Usage (GB)',
            data: metrics.map(m => m.memoryUsedGb),
            borderColor: '#45B7D1',
            fill: true,
            backgroundColor: 'rgba(69, 183, 209, 0.1)'
          },
          {
            label: 'Utilization (%)',
            data: metrics.map(m => m.utilizationPercent),
            borderColor: '#96CEB4',
            fill: false
          }
        ]
      },
      environmentalData: carbonMetrics ? {
        labels: timestamps,
        datasets: [
          {
            label: 'CO₂ Captured (kg)',
            data: metrics.map(() => carbonMetrics.co2CapturedKg),
            borderColor: '#2ECC71',
            fill: true,
            backgroundColor: 'rgba(46, 204, 113, 0.1)'
          },
          {
            label: 'Cooling Efficiency (%)',
            data: metrics.map(() => (1 - (carbonMetrics.powerUsageEffectiveness - 1)) * 100),
            borderColor: '#3498DB',
            fill: false
          }
        ]
      } : null
    };
  }, [carbonMetrics]);

  // Chart options
  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 0
    },
    scales: {
      x: {
        grid: {
          display: false
        }
      },
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(0, 0, 0, 0.1)'
        }
      }
    },
    plugins: {
      legend: {
        position: 'top' as const
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false
      }
    }
  }), []);

  // Handle real-time updates
  const debouncedRefetch = useMemo(
    () => debounce(refetch, refreshInterval),
    [refetch, refreshInterval]
  );

  useEffect(() => {
    const interval = setInterval(debouncedRefetch, refreshInterval);
    return () => {
      clearInterval(interval);
      debouncedRefetch.cancel();
    };
  }, [debouncedRefetch, refreshInterval]);

  if (loading) {
    return <div>Loading metrics...</div>;
  }

  if (error) {
    return (
      <div className="error-message">
        Error loading metrics: {error}
        <button onClick={refetch}>Retry</button>
      </div>
    );
  }

  if (!gpuMetrics || gpuMetrics.length === 0) {
    return <div>No metrics data available</div>;
  }

  const { performanceData, memoryData, environmentalData } = formatMetricsData(gpuMetrics);

  return (
    <div className={className}>
      <div className="metrics-grid">
        <div className="metrics-chart">
          <h3>Performance Metrics</h3>
          <Chart
            type="line"
            data={performanceData}
            options={chartOptions}
            height={300}
            accessibility={{
              ariaLabel: "GPU performance metrics chart",
              description: "Line chart showing GPU temperature and power usage over time"
            }}
          />
        </div>

        <div className="metrics-chart">
          <h3>Memory & Utilization</h3>
          <Chart
            type="line"
            data={memoryData}
            options={chartOptions}
            height={300}
            accessibility={{
              ariaLabel: "GPU memory and utilization metrics chart",
              description: "Line chart showing GPU memory usage and utilization percentage over time"
            }}
          />
        </div>

        {showEnvironmental && environmentalData && (
          <div className="metrics-chart">
            <h3>Environmental Impact</h3>
            <Chart
              type="line"
              data={environmentalData}
              options={chartOptions}
              height={300}
              accessibility={{
                ariaLabel: "Environmental metrics chart",
                description: "Line chart showing CO2 capture and cooling efficiency metrics"
              }}
            />
          </div>
        )}
      </div>

      <div className="metrics-status">
        <span className={`connection-status ${connectionStatus}`}>
          {connectionStatus === 'connected' ? '●' : '○'} {connectionStatus}
        </span>
        <span className="update-time">
          Last updated: {new Date(gpuMetrics[gpuMetrics.length - 1].timestamp).toLocaleString()}
        </span>
      </div>

      <style jsx>{`
        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 1.5rem;
          margin-bottom: 1rem;
        }

        .metrics-chart {
          background: white;
          border-radius: 8px;
          padding: 1rem;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .metrics-chart h3 {
          margin: 0 0 1rem;
          font-size: 1.1rem;
          color: #333;
        }

        .metrics-status {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 0.9rem;
          color: #666;
        }

        .connection-status {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .connection-status.connected {
          color: #2ECC71;
        }

        .connection-status.disconnected,
        .connection-status.error {
          color: #E74C3C;
        }

        .error-message {
          color: #E74C3C;
          padding: 1rem;
          border: 1px solid #E74C3C;
          border-radius: 4px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .error-message button {
          padding: 0.5rem 1rem;
          background: #E74C3C;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }
      `}</style>
    </div>
  );
};

export default GpuMetrics;