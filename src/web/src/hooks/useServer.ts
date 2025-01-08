import { useState, useEffect, useCallback, useRef } from 'react'; // ^18.0.0
import { useDispatch, useSelector } from 'react-redux'; // ^8.0.0
import { io } from 'socket.io-client'; // ^4.7.2

import {
  Server,
  ServerStatus,
  ServerFilter,
  ServerSpecification,
  CarbonMetrics
} from '../types/server';
import {
  fetchServersThunk,
  fetchServerThunk,
  createServerThunk,
  updateServerThunk,
  deleteServerThunk,
  fetchServerMetricsThunk,
  toggleMaintenanceModeThunk,
  fetchEnvironmentalMetricsThunk
} from '../store/actions/server';
import { ENVIRONMENTAL_CONFIG } from '../config/constants';

// Constants for polling and caching
const METRICS_POLLING_INTERVAL = 30000;
const SERVER_LIST_REFRESH_INTERVAL = 60000;
const WEBSOCKET_RECONNECT_DELAY = 5000;
const METRICS_CACHE_DURATION = 300000;

/**
 * Custom hook for managing individual server operations and environmental metrics
 * @param serverId - UUID of the server to manage
 */
export const useServer = (serverId: string) => {
  const dispatch = useDispatch();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const metricsIntervalRef = useRef<NodeJS.Timeout>();

  // Server and metrics state
  const server = useSelector((state: any) => state.servers.byId[serverId]);
  const environmentalMetrics = useSelector((state: any) => state.servers.environmentalMetrics[serverId]);

  /**
   * Establishes WebSocket connection for real-time environmental metrics
   */
  const setupWebSocket = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = io('/server-metrics', {
      query: { serverId }
    });

    ws.on('connect', () => {
      console.log(`WebSocket connected for server ${serverId}`);
    });

    ws.on('metrics-update', (metrics: CarbonMetrics) => {
      // Validate metrics against environmental thresholds
      const isEfficient = 
        metrics.powerUsageEffectiveness <= ENVIRONMENTAL_CONFIG.EFFECTIVENESS_RATIOS.TARGET_PUE &&
        metrics.waterUsageEffectiveness <= ENVIRONMENTAL_CONFIG.EFFECTIVENESS_RATIOS.TARGET_WUE &&
        metrics.carbonUsageEffectiveness <= ENVIRONMENTAL_CONFIG.EFFECTIVENESS_RATIOS.TARGET_CUE;

      if (!isEfficient) {
        console.warn('Server environmental metrics exceeding target thresholds');
      }

      dispatch({
        type: 'server/updateEnvironmentalMetrics',
        payload: { serverId, metrics }
      });
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      setTimeout(() => setupWebSocket(), WEBSOCKET_RECONNECT_DELAY);
    });

    wsRef.current = ws;
  }, [serverId, dispatch]);

  /**
   * Updates server configuration while monitoring environmental impact
   */
  const updateServer = useCallback(async (
    updates: Partial<ServerSpecification>,
    environmentalMetrics: CarbonMetrics
  ) => {
    try {
      setError(null);
      // Validate environmental impact before applying updates
      const impactAssessment = {
        powerImpact: environmentalMetrics.powerUsageEffectiveness - ENVIRONMENTAL_CONFIG.EFFECTIVENESS_RATIOS.TARGET_PUE,
        waterImpact: environmentalMetrics.waterUsageEffectiveness - ENVIRONMENTAL_CONFIG.EFFECTIVENESS_RATIOS.TARGET_WUE,
        carbonImpact: environmentalMetrics.carbonUsageEffectiveness - ENVIRONMENTAL_CONFIG.EFFECTIVENESS_RATIOS.TARGET_CUE
      };

      if (Object.values(impactAssessment).some(impact => impact > 0)) {
        throw new Error('Server updates would decrease environmental efficiency');
      }

      await dispatch(updateServerThunk({ serverId, updates, environmentalMetrics }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update server');
      throw err;
    }
  }, [serverId, dispatch]);

  /**
   * Toggles server maintenance mode with environmental metric preservation
   */
  const toggleMaintenance = useCallback(async (
    enabled: boolean,
    preserveMetrics: boolean = true
  ) => {
    try {
      setError(null);
      await dispatch(toggleMaintenanceModeThunk({
        serverId,
        enabled,
        preserveMetrics
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle maintenance mode');
      throw err;
    }
  }, [serverId, dispatch]);

  /**
   * Deletes server after environmental impact assessment
   */
  const deleteServer = useCallback(async () => {
    try {
      setError(null);
      await dispatch(deleteServerThunk(serverId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete server');
      throw err;
    }
  }, [serverId, dispatch]);

  /**
   * Refreshes server metrics and environmental data
   */
  const refreshMetrics = useCallback(async () => {
    try {
      setError(null);
      await Promise.all([
        dispatch(fetchServerMetricsThunk(serverId)),
        dispatch(fetchEnvironmentalMetricsThunk(serverId))
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh metrics');
      throw err;
    }
  }, [serverId, dispatch]);

  // Initialize server data and setup real-time updates
  useEffect(() => {
    const initializeServer = async () => {
      try {
        setLoading(true);
        setError(null);
        await dispatch(fetchServerThunk(serverId));
        await refreshMetrics();
        setupWebSocket();
        
        // Setup periodic metrics polling
        metricsIntervalRef.current = setInterval(refreshMetrics, METRICS_POLLING_INTERVAL);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to initialize server');
      } finally {
        setLoading(false);
      }
    };

    initializeServer();

    return () => {
      wsRef.current?.close();
      if (metricsIntervalRef.current) {
        clearInterval(metricsIntervalRef.current);
      }
    };
  }, [serverId, dispatch, refreshMetrics, setupWebSocket]);

  return {
    server,
    environmentalMetrics,
    loading,
    error,
    updateServer,
    deleteServer,
    toggleMaintenance,
    refreshMetrics
  };
};

/**
 * Custom hook for managing server list with environmental metrics aggregation
 * @param filter - Optional server filtering criteria
 */
export const useServerList = (filter?: ServerFilter) => {
  const dispatch = useDispatch();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refreshIntervalRef = useRef<NodeJS.Timeout>();

  // Server list and aggregated metrics state
  const servers = useSelector((state: any) => state.servers.list);
  const aggregatedMetrics = useSelector((state: any) => state.servers.aggregatedMetrics);

  /**
   * Creates new server with environmental baseline metrics
   */
  const createServer = useCallback(async (
    specification: ServerSpecification,
    initialMetrics: CarbonMetrics
  ) => {
    try {
      setError(null);
      // Validate initial environmental metrics
      if (
        initialMetrics.powerUsageEffectiveness > ENVIRONMENTAL_CONFIG.EFFECTIVENESS_RATIOS.TARGET_PUE ||
        initialMetrics.waterUsageEffectiveness > ENVIRONMENTAL_CONFIG.EFFECTIVENESS_RATIOS.TARGET_WUE ||
        initialMetrics.carbonUsageEffectiveness > ENVIRONMENTAL_CONFIG.EFFECTIVENESS_RATIOS.TARGET_CUE
      ) {
        throw new Error('Initial environmental metrics exceed target thresholds');
      }

      await dispatch(createServerThunk({ specification, initialMetrics }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create server');
      throw err;
    }
  }, [dispatch]);

  /**
   * Refreshes server list and updates aggregated metrics
   */
  const refreshList = useCallback(async () => {
    try {
      setError(null);
      await dispatch(fetchServersThunk(filter));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh server list');
      throw err;
    }
  }, [dispatch, filter]);

  // Initialize server list and setup periodic refresh
  useEffect(() => {
    const initializeList = async () => {
      try {
        setLoading(true);
        await refreshList();
        refreshIntervalRef.current = setInterval(refreshList, SERVER_LIST_REFRESH_INTERVAL);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to initialize server list');
      } finally {
        setLoading(false);
      }
    };

    initializeList();

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [refreshList]);

  return {
    servers,
    aggregatedMetrics,
    loading,
    error,
    refreshList,
    createServer
  };
};