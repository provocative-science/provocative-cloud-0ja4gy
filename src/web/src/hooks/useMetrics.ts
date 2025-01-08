import { useState, useEffect, useCallback, useRef } from 'react'; // ^18.0.0
import { debounce } from 'lodash'; // ^4.17.21
import { useDispatch, useSelector } from '../../store/store';
import { 
  fetchGPUMetrics, 
  fetchCarbonMetrics, 
  fetchSystemMetrics 
} from '../../store/actions/metrics';
import {
  GPUMetrics,
  CarbonMetrics,
  SystemMetrics,
  MetricsQueryParams,
  MetricsTimeRange,
  isValidGPUMetrics,
  isValidCarbonMetrics
} from '../../types/metrics';
import { useWebSocket } from '../useWebSocket';
import { METRICS_CONFIG, ENVIRONMENTAL_CONFIG } from '../../config/constants';

// Cache configuration
const CACHE_DURATION_MS = 30000; // 30 seconds
const METRICS_UPDATE_INTERVAL = 5000; // 5 seconds

interface MetricsCache {
  gpuMetrics?: { data: GPUMetrics[]; timestamp: number };
  carbonMetrics?: { data: CarbonMetrics; timestamp: number };
  systemMetrics?: { data: SystemMetrics; timestamp: number };
}

/**
 * Custom hook for managing real-time metrics data with caching and validation
 */
export function useMetrics(params: MetricsQueryParams) {
  const dispatch = useDispatch();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const cacheRef = useRef<MetricsCache>({});
  const updateInterval = useRef<NodeJS.Timeout>();

  // WebSocket connection for real-time updates
  const { 
    isConnected: wsConnected, 
    error: wsError,
    subscribe,
    unsubscribe 
  } = useWebSocket({
    autoConnect: true,
    onMessage: handleWebSocketMessage,
    onError: handleWebSocketError
  });

  // Fetch metrics with cache validation
  const fetchMetricsData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Check cache validity
      const now = Date.now();
      const isCacheValid = (cache: { timestamp: number }) => 
        now - cache.timestamp < CACHE_DURATION_MS;

      // Fetch GPU metrics if needed
      if (!cacheRef.current.gpuMetrics || !isCacheValid(cacheRef.current.gpuMetrics)) {
        const gpuMetricsResponse = await dispatch(fetchGPUMetrics(params)).unwrap();
        if (isValidGPUMetrics(gpuMetricsResponse)) {
          cacheRef.current.gpuMetrics = {
            data: gpuMetricsResponse,
            timestamp: now
          };
        }
      }

      // Fetch carbon metrics if needed
      if (!cacheRef.current.carbonMetrics || !isCacheValid(cacheRef.current.carbonMetrics)) {
        const carbonMetricsResponse = await dispatch(fetchCarbonMetrics(params)).unwrap();
        if (isValidCarbonMetrics(carbonMetricsResponse)) {
          cacheRef.current.carbonMetrics = {
            data: carbonMetricsResponse,
            timestamp: now
          };
        }
      }

      // Fetch system metrics if needed
      if (!cacheRef.current.systemMetrics || !isCacheValid(cacheRef.current.systemMetrics)) {
        const systemMetricsResponse = await dispatch(fetchSystemMetrics(params)).unwrap();
        cacheRef.current.systemMetrics = {
          data: systemMetricsResponse,
          timestamp: now
        };
      }

      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch metrics');
      console.error('Metrics fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [dispatch, params]);

  // Debounced metrics update handler
  const handleMetricsUpdate = debounce((newMetrics: any) => {
    const { gpuMetrics, carbonMetrics, systemMetrics } = newMetrics;
    const now = Date.now();

    if (gpuMetrics && isValidGPUMetrics(gpuMetrics)) {
      cacheRef.current.gpuMetrics = { data: gpuMetrics, timestamp: now };
    }
    if (carbonMetrics && isValidCarbonMetrics(carbonMetrics)) {
      cacheRef.current.carbonMetrics = { data: carbonMetrics, timestamp: now };
    }
    if (systemMetrics) {
      cacheRef.current.systemMetrics = { data: systemMetrics, timestamp: now };
    }

    setLastUpdated(new Date());
  }, 1000);

  // WebSocket message handler
  function handleWebSocketMessage(message: any) {
    if (message.type === 'metrics') {
      handleMetricsUpdate(message.payload);
    }
  }

  // WebSocket error handler
  function handleWebSocketError(wsError: Error) {
    console.error('WebSocket error:', wsError);
    setError(`Real-time metrics connection error: ${wsError.message}`);
  }

  // Setup periodic metrics updates
  useEffect(() => {
    fetchMetricsData();

    updateInterval.current = setInterval(() => {
      fetchMetricsData();
    }, METRICS_UPDATE_INTERVAL);

    return () => {
      if (updateInterval.current) {
        clearInterval(updateInterval.current);
      }
    };
  }, [fetchMetricsData]);

  // Subscribe to real-time updates for specific GPU
  useEffect(() => {
    if (params.gpuId && wsConnected) {
      subscribe(params.gpuId);
      return () => {
        unsubscribe(params.gpuId!);
      };
    }
  }, [params.gpuId, wsConnected, subscribe, unsubscribe]);

  // Clear cache utility
  const clearCache = useCallback(() => {
    cacheRef.current = {};
    setLastUpdated(new Date());
  }, []);

  // Manual refresh utility
  const refetch = useCallback(() => {
    clearCache();
    return fetchMetricsData();
  }, [fetchMetricsData, clearCache]);

  return {
    gpuMetrics: cacheRef.current.gpuMetrics?.data || [],
    carbonMetrics: cacheRef.current.carbonMetrics?.data,
    systemMetrics: cacheRef.current.systemMetrics?.data,
    loading,
    error,
    connectionStatus: wsConnected ? 'connected' : wsError ? 'error' : 'disconnected',
    lastUpdated,
    refetch,
    clearCache
  };
}