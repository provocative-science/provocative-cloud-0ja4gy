/**
 * GPU API client module for Provocative Cloud platform
 * Provides functions for GPU resource management, metrics retrieval,
 * and environmental impact monitoring
 * @version 1.0.0
 */

import { get, post, put } from '../utils/api';
import { API_ENDPOINTS } from '../config/api';
import retry from 'axios-retry'; // ^3.5.0
import { io, Socket } from 'socket.io-client'; // ^4.0.0
import type { 
  GPU,
  GPUFilter,
  GPUSpecification,
  GPUStatus
} from '../types/gpu';
import type {
  GPUMetrics,
  CarbonMetrics,
  MetricsTimeRange
} from '../types/metrics';
import type { UUID, ApiResponse } from '../types/common';

// Constants for retry configuration
const RETRY_OPTIONS = {
  retries: 3,
  retryDelay: retry.exponentialDelay,
  retryCondition: (error: any) => {
    return retry.isNetworkOrIdempotentRequestError(error) ||
           error.response?.status === 429;
  }
};

/**
 * Retrieves a filtered list of available GPUs
 * @param filter Optional filtering criteria for GPU search
 * @returns Promise resolving to array of GPU resources
 */
export async function getGPUs(filter?: GPUFilter): Promise<ApiResponse<GPU[]>> {
  const queryParams = filter ? new URLSearchParams({
    model: filter.model.join(','),
    min_vram_gb: filter.min_vram_gb.toString(),
    max_price_per_hour: filter.max_price_per_hour.toString(),
    status: filter.status.join(',')
  }).toString() : '';

  const url = `${API_ENDPOINTS.GPU.LIST}${queryParams ? `?${queryParams}` : ''}`;
  return get<GPU[]>(url);
}

/**
 * Retrieves detailed information about a specific GPU
 * @param id UUID of the GPU resource
 * @returns Promise resolving to GPU details
 */
export async function getGPUById(id: UUID): Promise<ApiResponse<GPU>> {
  return get<GPU>(API_ENDPOINTS.GPU.DETAILS(id));
}

/**
 * Retrieves real-time performance metrics for a GPU
 * @param id UUID of the GPU resource
 * @returns Promise resolving to current GPU metrics
 */
export async function getGPUMetrics(id: UUID): Promise<ApiResponse<GPUMetrics>> {
  return get<GPUMetrics>(API_ENDPOINTS.GPU.METRICS(id));
}

/**
 * Retrieves environmental impact metrics for a GPU
 * @param id UUID of the GPU resource
 * @returns Promise resolving to environmental metrics
 */
export async function getGPUEnvironmentalMetrics(id: UUID): Promise<ApiResponse<CarbonMetrics>> {
  return get<CarbonMetrics>(`${API_ENDPOINTS.ENVIRONMENTAL.CO2_CAPTURE}/${id}`);
}

/**
 * Calculates the rental cost for a GPU including environmental credits
 * @param id UUID of the GPU resource
 * @param hours Number of hours to rent
 * @returns Promise resolving to cost breakdown
 */
export async function calculateRentalCost(
  id: UUID,
  hours: number
): Promise<ApiResponse<{
  basePrice: number;
  environmentalCredits: number;
  totalPrice: number;
}>> {
  return post(`${API_ENDPOINTS.GPU.LIST}/${id}/calculate-cost`, { hours });
}

/**
 * WebSocket connection for real-time GPU metrics
 */
let metricsSocket: Socket | null = null;

/**
 * Subscribes to real-time GPU metrics updates
 * @param id UUID of the GPU resource
 * @param callback Function to handle metrics updates
 * @returns Cleanup function to unsubscribe
 */
export function subscribeToGPUMetrics(
  id: UUID,
  callback: (metrics: GPUMetrics) => void
): () => void {
  if (!metricsSocket) {
    metricsSocket = io(wsConfig.url, {
      path: '/gpu-metrics',
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5
    });

    metricsSocket.on('connect_error', (error) => {
      console.error('GPU metrics WebSocket connection error:', error);
    });
  }

  const channel = `gpu-metrics:${id}`;
  metricsSocket.emit('subscribe', { gpuId: id });
  metricsSocket.on(channel, callback);

  return () => {
    metricsSocket?.off(channel, callback);
    metricsSocket?.emit('unsubscribe', { gpuId: id });
  };
}

/**
 * Retrieves historical GPU metrics within a time range
 * @param id UUID of the GPU resource
 * @param timeRange Time range for historical data
 * @returns Promise resolving to historical metrics
 */
export async function getHistoricalGPUMetrics(
  id: UUID,
  timeRange: MetricsTimeRange
): Promise<ApiResponse<GPUMetrics[]>> {
  return get<GPUMetrics[]>(`${API_ENDPOINTS.METRICS.HISTORICAL}/${id}`, {
    params: { timeRange }
  });
}

/**
 * Updates GPU status for maintenance or availability
 * @param id UUID of the GPU resource
 * @param status New GPU status
 * @returns Promise resolving to updated GPU details
 */
export async function updateGPUStatus(
  id: UUID,
  status: GPUStatus
): Promise<ApiResponse<GPU>> {
  return put<GPU>(`${API_ENDPOINTS.GPU.LIST}/${id}/status`, { status });
}

/**
 * Retrieves aggregated environmental impact metrics
 * @returns Promise resolving to environmental impact summary
 */
export async function getEnvironmentalImpactSummary(): Promise<ApiResponse<{
  totalCO2Captured: number;
  averagePUE: number;
  averageWUE: number;
  averageCUE: number;
}>> {
  return get(`${API_ENDPOINTS.ENVIRONMENTAL.EFFICIENCY}/summary`);
}

// Cleanup function for WebSocket connection
export function cleanup(): void {
  if (metricsSocket) {
    metricsSocket.disconnect();
    metricsSocket = null;
  }
}