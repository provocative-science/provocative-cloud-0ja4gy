import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useMetrics } from '../../hooks/useMetrics';
import { Chart } from '../common/Chart';
import {
  CarbonMetrics as CarbonMetricsType,
  MetricsTimeRange,
  MetricPrecision,
  MetricThresholds
} from '../../types/metrics';
import { ENVIRONMENTAL_CONFIG } from '../../config/constants';

interface CarbonMetricsProps {
  timeRange: MetricsTimeRange;
  refreshInterval: number;
  className?: string;
  thresholds?: MetricThresholds;
  precision?: MetricPrecision;
  onAlert?: (metric: string, value: number) => void;
}

const CarbonMetrics: React.FC<CarbonMetricsProps> = ({
  timeRange,
  refreshInterval,
  className,
  thresholds = ENVIRONMENTAL_CONFIG.EFFECTIVENESS_RATIOS,
  precision = 2,
  onAlert
}) => {
  const [chartData, setChartData] = useState<any>(null);
  const { carbonMetrics, loading, error, wsStatus } = useMetrics({
    timeRange,
    refreshInterval
  });

  // Format metrics data for chart visualization
  const formatChartData = useCallback((metrics: CarbonMetricsType[]) => {
    if (!metrics?.length) return null;

    const labels = metrics.map(m => new Date(m.timestamp).toLocaleTimeString());
    
    return {
      labels,
      datasets: [
        {
          label: 'CO₂ Captured (kg)',
          data: metrics.map(m => Number(m.co2CapturedKg.toFixed(precision))),
          borderColor: '#33CC33',
          backgroundColor: 'rgba(51, 204, 51, 0.1)',
          fill: true
        },
        {
          label: 'Power Usage Effectiveness',
          data: metrics.map(m => Number(m.powerUsageEffectiveness.toFixed(precision))),
          borderColor: '#0066CC',
          backgroundColor: 'rgba(0, 102, 204, 0.1)',
          yAxisID: 'effectiveness'
        },
        {
          label: 'Carbon Usage Effectiveness',
          data: metrics.map(m => Number(m.carbonUsageEffectiveness.toFixed(precision))),
          borderColor: '#FF3300',
          backgroundColor: 'rgba(255, 51, 0, 0.1)',
          yAxisID: 'effectiveness'
        },
        {
          label: 'Water Usage Effectiveness',
          data: metrics.map(m => Number(m.waterUsageEffectiveness.toFixed(precision))),
          borderColor: '#3399FF',
          backgroundColor: 'rgba(51, 153, 255, 0.1)',
          yAxisID: 'effectiveness'
        }
      ]
    };
  }, [precision]);

  // Detect anomalies in metrics data
  const detectAnomalies = useCallback((metrics: CarbonMetricsType) => {
    if (!metrics) return;

    if (metrics.powerUsageEffectiveness > thresholds.TARGET_PUE) {
      onAlert?.('PUE', metrics.powerUsageEffectiveness);
    }
    if (metrics.carbonUsageEffectiveness > thresholds.TARGET_CUE) {
      onAlert?.('CUE', metrics.carbonUsageEffectiveness);
    }
    if (metrics.waterUsageEffectiveness > thresholds.TARGET_WUE) {
      onAlert?.('WUE', metrics.waterUsageEffectiveness);
    }
  }, [thresholds, onAlert]);

  // Chart options with accessibility support
  const chartOptions = useMemo(() => ({
    responsive: true,
    interaction: {
      intersect: false,
      mode: 'index'
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Time'
        }
      },
      y: {
        title: {
          display: true,
          text: 'CO₂ Captured (kg)'
        },
        min: 0
      },
      effectiveness: {
        type: 'linear',
        position: 'right',
        title: {
          display: true,
          text: 'Effectiveness Ratio'
        },
        min: 1,
        max: 2,
        grid: {
          drawOnChartArea: false
        }
      }
    },
    plugins: {
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const value = context.raw.toFixed(precision);
            return `${context.dataset.label}: ${value}`;
          }
        }
      },
      legend: {
        position: 'top'
      }
    }
  }), [precision]);

  // Update chart data when metrics change
  useEffect(() => {
    if (carbonMetrics) {
      setChartData(formatChartData(carbonMetrics));
      detectAnomalies(carbonMetrics[carbonMetrics.length - 1]);
    }
  }, [carbonMetrics, formatChartData, detectAnomalies]);

  // Render loading state
  if (loading) {
    return <div className="loading">Loading environmental metrics...</div>;
  }

  // Render error state
  if (error) {
    return <div className="error">Error loading metrics: {error}</div>;
  }

  // Render metrics cards and chart
  return (
    <div className={className}>
      <div className="metrics-cards">
        {carbonMetrics && carbonMetrics.length > 0 && (
          <>
            <div className="metric-card">
              <h3>Total CO₂ Captured</h3>
              <div className="value">
                {carbonMetrics[carbonMetrics.length - 1].co2CapturedKg.toFixed(precision)} kg
              </div>
            </div>
            <div className="metric-card">
              <h3>Power Usage Effectiveness</h3>
              <div className="value">
                {carbonMetrics[carbonMetrics.length - 1].powerUsageEffectiveness.toFixed(precision)}
              </div>
            </div>
            <div className="metric-card">
              <h3>Carbon Usage Effectiveness</h3>
              <div className="value">
                {carbonMetrics[carbonMetrics.length - 1].carbonUsageEffectiveness.toFixed(precision)}
              </div>
            </div>
            <div className="metric-card">
              <h3>Water Usage Effectiveness</h3>
              <div className="value">
                {carbonMetrics[carbonMetrics.length - 1].waterUsageEffectiveness.toFixed(precision)}
              </div>
            </div>
          </>
        )}
      </div>

      {chartData && (
        <Chart
          type="line"
          data={chartData}
          options={chartOptions}
          height={400}
          accessibility={{
            ariaLabel: "Environmental metrics chart",
            description: "Line chart showing CO2 capture and effectiveness metrics over time"
          }}
          refreshInterval={refreshInterval}
        />
      )}

      {wsStatus !== 'connected' && (
        <div className="websocket-status">
          Real-time updates {wsStatus === 'error' ? 'failed' : 'disconnected'}
        </div>
      )}
    </div>
  );
};

export default CarbonMetrics;