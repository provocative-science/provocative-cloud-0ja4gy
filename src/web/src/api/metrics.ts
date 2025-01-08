/**
 * API module for GPU, carbon capture, and system metrics management
 * Provides real-time monitoring and historical data retrieval capabilities
 * @version 1.0.0
 */

import { io, Socket } from 'socket.io-client'; // ^4.7.0
import retry from 'axios-retry'; // ^3.5.0
import { get, post } from '../utils/api';
import { API_ENDPOINTS } from '../config/api';
import { validateMetrics } from '../utils/validation';
import {
  MetricsTimeRange,
  MetricsQueryParams,
  GPUMetrics,
  CarbonMetrics,
  GPUMetricsResponse,
  CarbonMetricsResponse,
  PaginatedGPUMetrics,
  PaginatedCarbonMetrics,
  isValidGPUMetrics,
  isValidCarbonMetrics
} from '../types/metrics';
import { ApiResponse, UUID } from '../types/common';

// WebSocket configuration for real-time metrics
const WS_RECONNECT_INTERVAL = 5000;
const WS_MAX_RECONNECT_ATTEMPTS = 5;

// Metrics precision configuration
const TEMPERATURE_PRECISION = 1;
const POWER_PRECISION = 1;
const MEMORY_PRECISION = 2;
const EFFICIENCY_PRECISION = 3;

/**
 * Enhanced GPU metrics retrieval with real-time updates and validation
 * @param params Metrics query parameters
 * @param enableRealtime Enable real-time updates via WebSocket
 * @returns Promise resolving to validated GPU metrics
 */
export async function getGPUMetrics(
  params: MetricsQueryParams,
  enableRealtime = false
): Promise<ApiResponse<GPUMetrics[]>> {
  try {
    // Configure retry logic for reliability
    retry(get, {
      retries: 3,
      retryDelay: (retryCount) => retryCount * 1000,
      retryCondition: (error) => {
        return retry.isNetworkOrIdempotentRequestError(error);
      }
    });

    const response = await get<GPUMetrics[]>(`${API_ENDPOINTS.METRICS.GPU}`, {
      params: {
        ...params,
        precision: {
          temperature: TEMPERATURE_PRECISION,
          power: POWER_PRECISION,
          memory: MEMORY_PRECISION
        }
      }
    });

    // Validate metrics data
    const validatedMetrics = response.data.filter(isValidGPUMetrics);

    if (enableRealtime) {
      setupRealtimeGPUMetrics(params.gpuId);
    }

    return {
      ...response,
      data: validatedMetrics
    };
  } catch (error) {
    console.error('GPU metrics fetch error:', error);
    throw error;
  }
}

/**
 * Enhanced carbon metrics retrieval with trend analysis and alerts
 * @param params Metrics query parameters
 * @returns Promise resolving to carbon metrics with trend analysis
 */
export async function getCarbonMetrics(
  params: MetricsQueryParams
): Promise<ApiResponse<CarbonMetrics>> {
  try {
    const response = await get<CarbonMetrics>(`${API_ENDPOINTS.METRICS.SYSTEM}`, {
      params: {
        ...params,
        precision: EFFICIENCY_PRECISION
      }
    });

    if (!isValidCarbonMetrics(response.data)) {
      throw new Error('Invalid carbon metrics data received');
    }

    // Calculate environmental impact trends
    const trends = calculateEnvironmentalTrends(response.data);

    return {
      ...response,
      data: {
        ...response.data,
        trends
      }
    };
  } catch (error) {
    console.error('Carbon metrics fetch error:', error);
    throw error;
  }
}

/**
 * Enhanced system metrics with performance benchmarking
 * @param params Metrics query parameters
 * @returns Promise resolving to system metrics with performance analysis
 */
export async function getSystemMetrics(
  params: MetricsQueryParams
): Promise<ApiResponse<SystemMetrics>> {
  try {
    const response = await get<SystemMetrics>(`${API_ENDPOINTS.METRICS.SYSTEM}`, {
      params
    });

    // Calculate performance benchmarks
    const benchmarks = calculatePerformanceBenchmarks(response.data);

    return {
      ...response,
      data: {
        ...response.data,
        benchmarks
      }
    };
  } catch (error) {
    console.error('System metrics fetch error:', error);
    throw error;
  }
}

/**
 * Enhanced combined metrics with correlation and efficiency analysis
 * @param params Metrics query parameters
 * @returns Promise resolving to correlated metrics with efficiency analysis
 */
export async function getAllMetrics(
  params: MetricsQueryParams
): Promise<ApiResponse<MetricsResponse>> {
  try {
    const [gpuMetrics, carbonMetrics, systemMetrics] = await Promise.all([
      getGPUMetrics(params),
      getCarbonMetrics(params),
      getSystemMetrics(params)
    ]);

    // Correlate data across metrics types
    const correlatedData = correlateMetricsData(
      gpuMetrics.data,
      carbonMetrics.data,
      systemMetrics.data
    );

    return {
      success: true,
      data: correlatedData,
      message: 'Combined metrics retrieved successfully',
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('Combined metrics fetch error:', error);
    throw error;
  }
}

/**
 * Enhanced historical metrics with aggregation and forecasting
 * @param params Metrics query parameters
 * @returns Promise resolving to historical data with trends and forecasts
 */
export async function getHistoricalMetrics(
  params: MetricsQueryParams
): Promise<ApiResponse<MetricsResponse[]>> {
  try {
    const response = await get<MetricsResponse[]>(
      `${API_ENDPOINTS.METRICS.HISTORICAL}`,
      { params }
    );

    // Aggregate and analyze historical data
    const analyzedData = analyzeHistoricalData(response.data);

    return {
      ...response,
      data: analyzedData
    };
  } catch (error) {
    console.error('Historical metrics fetch error:', error);
    throw error;
  }
}

/**
 * Sets up WebSocket connection for real-time GPU metrics
 * @param gpuId Optional GPU ID to filter metrics
 * @returns WebSocket instance
 */
function setupRealtimeGPUMetrics(gpuId?: UUID): Socket {
  const socket = io('/metrics', {
    query: gpuId ? { gpuId } : undefined,
    reconnectionDelay: WS_RECONNECT_INTERVAL,
    reconnectionAttempts: WS_MAX_RECONNECT_ATTEMPTS
  });

  socket.on('connect', () => {
    console.log('Metrics WebSocket connected');
  });

  socket.on('metrics_update', (data: GPUMetrics) => {
    if (isValidGPUMetrics(data)) {
      // Emit custom event for UI updates
      window.dispatchEvent(
        new CustomEvent('gpuMetricsUpdate', { detail: data })
      );
    }
  });

  socket.on('error', (error: Error) => {
    console.error('Metrics WebSocket error:', error);
  });

  return socket;
}

/**
 * Calculates environmental impact trends from carbon metrics
 * @param metrics Carbon metrics data
 * @returns Calculated trends and analysis
 */
function calculateEnvironmentalTrends(metrics: CarbonMetrics): any {
  // Implementation of environmental trend analysis
  return {
    co2CaptureRate: calculateTrend(metrics.co2CapturedKg),
    efficiencyTrends: {
      pue: calculateTrend(metrics.powerUsageEffectiveness),
      cue: calculateTrend(metrics.carbonUsageEffectiveness),
      wue: calculateTrend(metrics.waterUsageEffectiveness)
    }
  };
}

/**
 * Calculates performance benchmarks from system metrics
 * @param metrics System metrics data
 * @returns Calculated benchmarks
 */
function calculatePerformanceBenchmarks(metrics: SystemMetrics): any {
  // Implementation of performance benchmarking
  return {
    utilizationScore: calculateUtilizationScore(metrics),
    efficiencyScore: calculateEfficiencyScore(metrics),
    performanceIndex: calculatePerformanceIndex(metrics)
  };
}

/**
 * Correlates data across different metrics types
 * @param gpuMetrics GPU metrics data
 * @param carbonMetrics Carbon metrics data
 * @param systemMetrics System metrics data
 * @returns Correlated metrics data
 */
function correlateMetricsData(
  gpuMetrics: GPUMetrics[],
  carbonMetrics: CarbonMetrics,
  systemMetrics: SystemMetrics
): any {
  // Implementation of metrics correlation
  return {
    correlations: calculateCorrelations(gpuMetrics, carbonMetrics, systemMetrics),
    efficiency: calculateSystemEfficiency(gpuMetrics, carbonMetrics),
    impact: calculateEnvironmentalImpact(gpuMetrics, carbonMetrics)
  };
}

/**
 * Analyzes historical metrics data for trends and forecasting
 * @param data Historical metrics data
 * @returns Analyzed and forecasted data
 */
function analyzeHistoricalData(data: MetricsResponse[]): MetricsResponse[] {
  // Implementation of historical data analysis
  return data.map(metrics => ({
    ...metrics,
    analysis: {
      trends: calculateHistoricalTrends(metrics),
      forecast: generateMetricsForecast(metrics)
    }
  }));
}