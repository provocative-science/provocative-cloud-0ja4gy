import React, { useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Chart as ChartJS,
  ChartConfiguration,
  ChartData,
  ChartOptions,
  ChartType,
  registerables
} from 'chart.js';
import debounce from 'lodash/debounce';
import { colors, breakpoints } from '../../config/theme';

// Register all Chart.js components
ChartJS.register(...registerables);

interface AccessibilityConfig {
  ariaLabel?: string;
  description?: string;
}

interface ChartProps<T extends ChartType = ChartType> {
  type: T;
  data: ChartData<T>;
  options?: ChartOptions<T>;
  height?: number;
  width?: number;
  className?: string;
  refreshInterval?: number;
  onError?: (error: Error) => void;
  accessibility?: AccessibilityConfig;
}

interface ChartState {
  error: Error | null;
  isLoading: boolean;
  lastUpdate: number;
}

const getDefaultOptions = (
  type: ChartType,
  accessibility?: AccessibilityConfig
): ChartOptions => {
  return useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 750,
      easing: 'easeInOutQuart'
    },
    plugins: {
      legend: {
        display: true,
        position: 'top',
        labels: {
          color: colors.primaryText,
          font: {
            family: 'system-ui, -apple-system, sans-serif'
          },
          generateLabels: (chart) => {
            const labels = ChartJS.defaults.plugins.legend.labels.generateLabels(chart);
            return labels.map(label => ({
              ...label,
              text: `${label.text} (${accessibility?.description || ''})`
            }));
          }
        }
      },
      tooltip: {
        enabled: true,
        mode: 'index',
        intersect: false,
        backgroundColor: colors.background,
        titleColor: colors.primaryText,
        bodyColor: colors.secondaryText,
        borderColor: colors.border,
        borderWidth: 1
      }
    },
    scales: {
      x: {
        grid: {
          color: colors.border,
          borderColor: colors.border
        },
        ticks: {
          color: colors.secondaryText
        }
      },
      y: {
        grid: {
          color: colors.border,
          borderColor: colors.border
        },
        ticks: {
          color: colors.secondaryText
        },
        beginAtZero: true
      }
    }
  }), [colors, accessibility]);
};

const Chart = React.memo<ChartProps>(({
  type,
  data,
  options,
  height = 300,
  width,
  className,
  refreshInterval,
  onError,
  accessibility
}) => {
  const chartRef = useRef<ChartJS | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const updateIntervalRef = useRef<number | null>(null);

  const defaultOptions = getDefaultOptions(type, accessibility);
  const mergedOptions = useMemo(() => ({
    ...defaultOptions,
    ...options
  }), [defaultOptions, options]);

  const handleResize = useCallback(debounce(() => {
    if (chartRef.current) {
      chartRef.current.resize();
    }
  }, 250), []);

  const initializeChart = useCallback(() => {
    if (!canvasRef.current) return;

    try {
      const ctx = canvasRef.current.getContext('2d');
      if (!ctx) throw new Error('Failed to get canvas context');

      // Destroy existing chart instance if it exists
      if (chartRef.current) {
        chartRef.current.destroy();
      }

      // Create new chart instance
      chartRef.current = new ChartJS(ctx, {
        type,
        data,
        options: mergedOptions
      });

      // Set ARIA attributes for accessibility
      if (accessibility) {
        canvasRef.current.setAttribute('aria-label', accessibility.ariaLabel || '');
        canvasRef.current.setAttribute('role', 'img');
        if (accessibility.description) {
          canvasRef.current.setAttribute('aria-description', accessibility.description);
        }
      }
    } catch (error) {
      if (error instanceof Error && onError) {
        onError(error);
      }
    }
  }, [type, data, mergedOptions, accessibility, onError]);

  const updateChart = useCallback(() => {
    if (!chartRef.current) return;

    try {
      chartRef.current.data = data;
      chartRef.current.update('active');
    } catch (error) {
      if (error instanceof Error && onError) {
        onError(error);
      }
    }
  }, [data, onError]);

  // Initialize chart on mount
  useEffect(() => {
    initializeChart();

    // Set up resize observer
    const resizeObserver = new ResizeObserver(handleResize);
    if (canvasRef.current) {
      resizeObserver.observe(canvasRef.current);
    }

    return () => {
      resizeObserver.disconnect();
      if (chartRef.current) {
        chartRef.current.destroy();
      }
      if (updateIntervalRef.current) {
        window.clearInterval(updateIntervalRef.current);
      }
    };
  }, [initializeChart, handleResize]);

  // Handle real-time updates
  useEffect(() => {
    if (refreshInterval && refreshInterval > 0) {
      updateIntervalRef.current = window.setInterval(updateChart, refreshInterval);
      return () => {
        if (updateIntervalRef.current) {
          window.clearInterval(updateIntervalRef.current);
        }
      };
    }
  }, [refreshInterval, updateChart]);

  // Update chart when data changes
  useEffect(() => {
    updateChart();
  }, [data, updateChart]);

  return (
    <div 
      className={className}
      style={{
        height: height,
        width: width || '100%',
        position: 'relative'
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          maxWidth: '100%',
          height: '100%'
        }}
      />
    </div>
  );
});

Chart.displayName = 'Chart';

export default Chart;