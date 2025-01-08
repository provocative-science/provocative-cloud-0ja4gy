import { useEffect, useState, useMemo, useCallback } from 'react'; // ^18.2.0
import { debounce } from 'lodash'; // ^4.17.21
import { GPU, GPUFilter } from '../types/gpu';
import { useWebSocket } from './useWebSocket';
import { METRICS_CONFIG, ENVIRONMENTAL_CONFIG } from '../config/constants';
import { GPUMetrics, CarbonMetrics } from '../types/metrics';

/**
 * Interface for aggregated metrics across all monitored GPUs
 */
interface AggregatedMetrics {
  totalPowerUsage: number;
  averageUtilization: number;
  totalCO2Captured: number;
  averagePUE: number;
  averageWUE: number;
  averageCUE: number;
}

/**
 * Interface for environmental impact metrics
 */
interface EnvironmentalMetrics extends CarbonMetrics {
  lastUpdated: number;
  trendData: {
    co2CaptureRate: number;
    powerEfficiencyTrend: number;
    waterUsageTrend: number;
  };
}

/**
 * Custom hook for managing GPU resources and environmental metrics
 * @version 1.0.0
 */
export function useGpu(filter?: GPUFilter) {
  // State management
  const [gpus, setGpus] = useState<GPU[]>([]);
  const [selectedGpu, setSelectedGpu] = useState<GPU | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [environmentalMetrics, setEnvironmentalMetrics] = useState<EnvironmentalMetrics>({
    id: '' as UUID,
    co2CapturedKg: 0,
    powerUsageEffectiveness: 1.0,
    carbonUsageEffectiveness: 0,
    waterUsageEffectiveness: 0,
    timestamp: Date.now(),
    lastUpdated: Date.now(),
    trendData: {
      co2CaptureRate: 0,
      powerEfficiencyTrend: 0,
      waterUsageTrend: 0
    }
  });

  // Initialize WebSocket connection
  const { isConnected, subscribe, unsubscribe } = useWebSocket({
    autoConnect: true,
    autoReconnect: true,
    onMessage: handleMetricsUpdate,
    onError: (err) => setError(err.message)
  });

  /**
   * Memoized aggregated metrics calculation
   */
  const aggregatedMetrics = useMemo<AggregatedMetrics>(() => {
    if (!gpus.length) {
      return {
        totalPowerUsage: 0,
        averageUtilization: 0,
        totalCO2Captured: 0,
        averagePUE: 0,
        averageWUE: 0,
        averageCUE: 0
      };
    }

    const metrics = gpus.reduce((acc, gpu) => {
      acc.totalPowerUsage += gpu.metrics.powerUsageWatts;
      acc.averageUtilization += gpu.metrics.utilizationPercent;
      return acc;
    }, {
      totalPowerUsage: 0,
      averageUtilization: 0
    });

    return {
      ...metrics,
      averageUtilization: metrics.averageUtilization / gpus.length,
      totalCO2Captured: environmentalMetrics.co2CapturedKg,
      averagePUE: environmentalMetrics.powerUsageEffectiveness,
      averageWUE: environmentalMetrics.waterUsageEffectiveness,
      averageCUE: environmentalMetrics.carbonUsageEffectiveness
    };
  }, [gpus, environmentalMetrics]);

  /**
   * Debounced metrics update handler
   */
  const handleMetricsUpdate = useCallback(debounce((message: any) => {
    try {
      if (message.type === 'gpu_metrics') {
        setGpus(prevGpus => prevGpus.map(gpu => {
          if (gpu.id === message.payload.gpuId) {
            return {
              ...gpu,
              metrics: message.payload.metrics
            };
          }
          return gpu;
        }));
      } else if (message.type === 'environmental_metrics') {
        setEnvironmentalMetrics(prevMetrics => ({
          ...prevMetrics,
          ...message.payload,
          lastUpdated: Date.now(),
          trendData: calculateEnvironmentalTrends(message.payload)
        }));
      }
    } catch (err) {
      setError('Error processing metrics update');
    }
  }, METRICS_CONFIG.UPDATE_INTERVAL_MS), []);

  /**
   * Calculate environmental metric trends
   */
  const calculateEnvironmentalTrends = useCallback((newMetrics: CarbonMetrics) => {
    const prevMetrics = environmentalMetrics;
    return {
      co2CaptureRate: (newMetrics.co2CapturedKg - prevMetrics.co2CapturedKg) / 
        (ENVIRONMENTAL_CONFIG.CO2_CAPTURE_THRESHOLDS.TARGET_RATE_KG_PER_DAY),
      powerEfficiencyTrend: (prevMetrics.powerUsageEffectiveness - newMetrics.powerUsageEffectiveness) /
        prevMetrics.powerUsageEffectiveness,
      waterUsageTrend: (prevMetrics.waterUsageEffectiveness - newMetrics.waterUsageEffectiveness) /
        prevMetrics.waterUsageEffectiveness
    };
  }, [environmentalMetrics]);

  /**
   * Fetch initial GPU data
   */
  const fetchGpus = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/v1/gpu');
      const data = await response.json();
      setGpus(data);
      data.forEach(gpu => subscribe(gpu.id));
    } catch (err) {
      setError('Failed to fetch GPU data');
    } finally {
      setLoading(false);
    }
  }, [subscribe]);

  /**
   * Refresh GPU data manually
   */
  const refreshGpus = useCallback(async () => {
    await fetchGpus();
  }, [fetchGpus]);

  /**
   * Filter GPUs based on provided criteria
   */
  const filteredGpus = useMemo(() => {
    if (!filter) return gpus;
    return gpus.filter(gpu => 
      filter.model.includes(gpu.specifications.model) &&
      gpu.specifications.vram_gb >= filter.min_vram_gb &&
      gpu.price_per_hour <= filter.max_price_per_hour &&
      filter.status.includes(gpu.status)
    );
  }, [gpus, filter]);

  /**
   * Effect for initial data fetch and WebSocket subscriptions
   */
  useEffect(() => {
    fetchGpus();
    return () => {
      gpus.forEach(gpu => unsubscribe(gpu.id));
    };
  }, []);

  /**
   * Effect for environmental metrics periodic update
   */
  useEffect(() => {
    const fetchEnvironmentalMetrics = async () => {
      try {
        const response = await fetch('/api/v1/environmental/metrics');
        const data = await response.json();
        setEnvironmentalMetrics(prevMetrics => ({
          ...prevMetrics,
          ...data,
          lastUpdated: Date.now()
        }));
      } catch (err) {
        setError('Failed to fetch environmental metrics');
      }
    };

    const intervalId = setInterval(
      fetchEnvironmentalMetrics,
      METRICS_CONFIG.UPDATE_INTERVAL_MS
    );

    return () => clearInterval(intervalId);
  }, []);

  return {
    gpus: filteredGpus,
    loading,
    error,
    selectedGpu,
    setSelectedGpu,
    environmentalMetrics,
    aggregatedMetrics,
    refreshGpus,
    isConnected
  };
}

export type { AggregatedMetrics, EnvironmentalMetrics };