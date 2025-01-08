import React, { useEffect, useMemo, useCallback, useState } from 'react';
import { format, subDays, subHours } from 'date-fns';
import debounce from 'lodash';
import Chart from '../common/Chart';
import { useBilling } from '../../hooks/useBilling';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useTheme } from '../../hooks/useTheme';
import { Transaction, Currency } from '../../types/billing';

interface RevenueChartProps {
  timeRange: '24h' | '7d' | '30d' | '90d';
  refreshInterval?: number;
  height?: number;
  className?: string;
  currency?: Currency;
  onDataUpdate?: (data: ChartData) => void;
  ariaLabel?: string;
}

interface ChartDataPoint {
  timestamp: number;
  amount: number;
}

const DEFAULT_HEIGHT = 300;
const ANIMATION_DURATION = 750;

export const RevenueChart: React.FC<RevenueChartProps> = ({
  timeRange = '24h',
  refreshInterval = 5000,
  height = DEFAULT_HEIGHT,
  className,
  currency = Currency.USD,
  onDataUpdate,
  ariaLabel = 'Revenue Chart'
}) => {
  const { theme } = useTheme();
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const { transactions, loading, fetchTransactions } = useBilling();

  // WebSocket setup for real-time updates
  const { isConnected, subscribe, unsubscribe } = useWebSocket({
    autoConnect: true,
    onMessage: (message) => {
      if (message.type === 'transaction_update') {
        handleWebSocketUpdate(message.payload);
      }
    }
  });

  // Process transaction data based on time range
  const processTransactionData = useCallback((transactions: Transaction[]) => {
    const now = Date.now();
    const timeRangeMap = {
      '24h': subHours(now, 24),
      '7d': subDays(now, 7),
      '30d': subDays(now, 30),
      '90d': subDays(now, 90)
    };

    const startTime = timeRangeMap[timeRange];
    const filteredTransactions = transactions.filter(
      t => new Date(t.createdAt).getTime() >= startTime
    );

    // Group transactions by time period
    const groupedData = filteredTransactions.reduce((acc: ChartDataPoint[], t) => {
      const timestamp = new Date(t.createdAt).getTime();
      const existingPoint = acc.find(p => p.timestamp === timestamp);

      if (existingPoint) {
        existingPoint.amount += t.amount;
      } else {
        acc.push({ timestamp, amount: t.amount });
      }

      return acc;
    }, []);

    return groupedData.sort((a, b) => a.timestamp - b.timestamp);
  }, [timeRange]);

  // Handle real-time WebSocket updates
  const handleWebSocketUpdate = useCallback((transaction: Transaction) => {
    setChartData(prevData => {
      const timestamp = new Date(transaction.createdAt).getTime();
      const newData = [...prevData];
      const existingPoint = newData.find(p => p.timestamp === timestamp);

      if (existingPoint) {
        existingPoint.amount += transaction.amount;
      } else {
        newData.push({ timestamp, amount: transaction.amount });
      }

      return newData.sort((a, b) => a.timestamp - b.timestamp);
    });
  }, []);

  // Generate Chart.js configuration
  const chartConfig = useMemo(() => {
    const formatTime = (timestamp: number) => {
      return timeRange === '24h'
        ? format(timestamp, 'HH:mm')
        : format(timestamp, 'MMM dd');
    };

    const data = {
      labels: chartData.map(d => formatTime(d.timestamp)),
      datasets: [{
        label: 'Revenue',
        data: chartData.map(d => d.amount),
        borderColor: theme.colors.accent,
        backgroundColor: `${theme.colors.accent}33`,
        fill: true,
        tension: 0.4
      }]
    };

    const options = {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: ANIMATION_DURATION
      },
      scales: {
        x: {
          grid: {
            color: theme.colors.border
          },
          ticks: {
            color: theme.colors.secondaryText
          }
        },
        y: {
          grid: {
            color: theme.colors.border
          },
          ticks: {
            color: theme.colors.secondaryText,
            callback: (value: number) => {
              return new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency
              }).format(value);
            }
          }
        }
      },
      plugins: {
        tooltip: {
          enabled: true,
          mode: 'index',
          intersect: false,
          callbacks: {
            label: (context: any) => {
              return new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency
              }).format(context.raw);
            }
          }
        },
        legend: {
          display: false
        }
      }
    };

    return { data, options };
  }, [chartData, theme, currency, timeRange]);

  // Fetch initial data and set up WebSocket subscription
  useEffect(() => {
    fetchTransactions();
    if (isConnected) {
      subscribe('revenue_updates');
    }
    return () => {
      if (isConnected) {
        unsubscribe('revenue_updates');
      }
    };
  }, [fetchTransactions, isConnected, subscribe, unsubscribe]);

  // Update chart data when transactions change
  useEffect(() => {
    if (transactions.length > 0) {
      const processedData = processTransactionData(transactions);
      setChartData(processedData);
      onDataUpdate?.(chartConfig.data);
    }
  }, [transactions, processTransactionData, onDataUpdate]);

  // Debounced resize handler
  const handleResize = useMemo(() => 
    debounce(() => {
      // Force chart update on resize
      setChartData(prev => [...prev]);
    }, 250),
    []
  );

  useEffect(() => {
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      handleResize.cancel();
    };
  }, [handleResize]);

  return (
    <div className={className} style={{ height }}>
      <Chart
        type="line"
        data={chartConfig.data}
        options={chartConfig.options}
        height={height}
        refreshInterval={refreshInterval}
        accessibility={{
          ariaLabel,
          description: `Revenue chart showing ${timeRange} of transaction data`
        }}
      />
      {loading && (
        <div
          role="status"
          aria-live="polite"
          className="chart-loading-overlay"
        >
          Loading revenue data...
        </div>
      )}
    </div>
  );
};

export default React.memo(RevenueChart);