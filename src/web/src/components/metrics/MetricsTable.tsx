import React, { memo, useCallback, useEffect, useState } from 'react'; // ^18.0.0
import classNames from 'classnames'; // ^2.3.0
import debounce from 'lodash/debounce'; // ^4.0.8
import Table from '../common/Table';
import { useWebSocket } from '../../hooks/useWebSocket';
import { GPUMetrics, CarbonMetrics, MetricsTimeRange } from '../../types/metrics';
import { ENVIRONMENTAL_CONFIG, METRICS_CONFIG } from '../../config/constants';

interface MetricsTableProps {
  metricsType: 'gpu' | 'carbon' | 'system';
  data: GPUMetrics[] | CarbonMetrics[];
  loading?: boolean;
  onSort?: (key: string, direction: 'asc' | 'desc') => void;
  className?: string;
  updateInterval?: number;
  virtualized?: boolean;
  rowHeight?: number;
  onMetricAlert?: (metric: string, value: number) => void;
}

interface MetricThreshold {
  warning: number;
  critical: number;
  unit: string;
}

const METRIC_THRESHOLDS: Record<string, MetricThreshold> = {
  temperatureCelsius: {
    warning: 75,
    critical: 85,
    unit: '°C'
  },
  utilizationPercent: {
    warning: 90,
    critical: 95,
    unit: '%'
  },
  powerUsageEffectiveness: {
    warning: 1.3,
    critical: 1.5,
    unit: ''
  },
  carbonUsageEffectiveness: {
    warning: 0.8,
    critical: 1.0,
    unit: ''
  }
};

const formatMetricValue = (value: number, type: string, precision: number = 2, unit: string = ''): string => {
  const formattedValue = value.toFixed(precision);
  const threshold = METRIC_THRESHOLDS[type];
  
  if (threshold) {
    if (value >= threshold.critical) {
      return `${formattedValue}${unit} ⚠️`;
    } else if (value >= threshold.warning) {
      return `${formattedValue}${unit} ⚠`;
    }
  }
  
  return `${formattedValue}${unit}`;
};

const MetricsTable = memo(({
  metricsType,
  data,
  loading = false,
  onSort,
  className,
  updateInterval = METRICS_CONFIG.UPDATE_INTERVAL_MS,
  virtualized = true,
  rowHeight = 48,
  onMetricAlert
}: MetricsTableProps) => {
  const [metrics, setMetrics] = useState<(GPUMetrics | CarbonMetrics)[]>(data);
  
  const { isConnected, subscribe, unsubscribe } = useWebSocket({
    autoConnect: true,
    onMessage: (message) => {
      handleMetricUpdate(message);
    }
  });

  const handleMetricUpdate = useCallback(debounce((update: any) => {
    setMetrics(currentMetrics => {
      return currentMetrics.map(metric => {
        if (metric.id === update.id) {
          const updatedMetric = { ...metric, ...update };
          
          // Check thresholds and trigger alerts
          Object.entries(METRIC_THRESHOLDS).forEach(([key, threshold]) => {
            if (key in updatedMetric && updatedMetric[key as keyof typeof updatedMetric] >= threshold.critical) {
              onMetricAlert?.(key, updatedMetric[key as keyof typeof updatedMetric] as number);
            }
          });
          
          return updatedMetric;
        }
        return metric;
      });
    });
  }, 100), [onMetricAlert]);

  useEffect(() => {
    if (isConnected) {
      metrics.forEach(metric => {
        subscribe(metric.id);
      });
    }
    
    return () => {
      metrics.forEach(metric => {
        unsubscribe(metric.id);
      });
    };
  }, [isConnected, metrics, subscribe, unsubscribe]);

  const getColumns = useCallback(() => {
    const baseColumns = [
      {
        key: 'timestamp',
        header: 'Time',
        width: '150px',
        render: (value: number) => new Date(value).toLocaleTimeString(),
      }
    ];

    const metricColumns = {
      gpu: [
        {
          key: 'temperatureCelsius',
          header: 'Temperature',
          sortable: true,
          render: (value: number) => formatMetricValue(value, 'temperatureCelsius', 1, '°C'),
        },
        {
          key: 'utilizationPercent',
          header: 'Utilization',
          sortable: true,
          render: (value: number) => formatMetricValue(value, 'utilizationPercent', 1, '%'),
        },
        {
          key: 'memoryUsedGb',
          header: 'Memory Used',
          sortable: true,
          render: (value: number, row: GPUMetrics) => 
            `${formatMetricValue(value, 'memoryUsedGb', 2)}/${row.memoryTotalGb} GB`,
        },
        {
          key: 'powerUsageWatts',
          header: 'Power Usage',
          sortable: true,
          render: (value: number) => formatMetricValue(value, 'powerUsageWatts', 1, 'W'),
        }
      ],
      carbon: [
        {
          key: 'co2CapturedKg',
          header: 'CO₂ Captured',
          sortable: true,
          render: (value: number) => formatMetricValue(value, 'co2CapturedKg', 2, ' kg'),
        },
        {
          key: 'powerUsageEffectiveness',
          header: 'PUE',
          sortable: true,
          render: (value: number) => formatMetricValue(value, 'powerUsageEffectiveness', 3),
        },
        {
          key: 'carbonUsageEffectiveness',
          header: 'CUE',
          sortable: true,
          render: (value: number) => formatMetricValue(value, 'carbonUsageEffectiveness', 3),
        },
        {
          key: 'waterUsageEffectiveness',
          header: 'WUE',
          sortable: true,
          render: (value: number) => formatMetricValue(value, 'waterUsageEffectiveness', 3),
        }
      ]
    };

    return [...baseColumns, ...(metricColumns[metricsType as keyof typeof metricColumns] || [])];
  }, [metricsType]);

  return (
    <div className={classNames('metrics-table', className)}>
      <Table
        columns={getColumns()}
        data={metrics}
        loading={loading}
        onSort={onSort}
        virtualized={virtualized}
        rowHeight={rowHeight}
        ariaLabel={`${metricsType.toUpperCase()} Metrics Table`}
        highContrast={false}
      />
      <style jsx>{`
        .metrics-table {
          width: 100%;
          margin-bottom: var(--spacing-lg);
          background-color: var(--background-light);
        }

        .metrics-table :global(.table__cell) {
          font-family: var(--font-family-mono);
          text-align: right;
          padding: var(--spacing-sm) var(--spacing-md);
          transition: background-color 0.3s ease;
        }

        .metrics-table :global(.table__cell--updating) {
          background-color: var(--highlight-background);
        }

        :global([data-theme='dark']) .metrics-table {
          background-color: var(--background-dark);
        }

        @media (prefers-reduced-motion: reduce) {
          .metrics-table :global(.table__cell) {
            transition: none;
          }
        }
      `}</style>
    </div>
  );
});

MetricsTable.displayName = 'MetricsTable';

export default MetricsTable;