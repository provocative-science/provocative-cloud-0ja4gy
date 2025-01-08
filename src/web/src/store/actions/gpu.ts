import { createAsyncThunk } from '@reduxjs/toolkit';
import { debounce } from 'lodash';
import { io, Socket } from 'socket.io-client';

import { GPU, GPUStatus, isValidGPUFilter } from '../../types/gpu';
import { 
  GPUMetrics, 
  CarbonMetrics,
  isValidGPUMetrics, 
  isValidCarbonMetrics 
} from '../../types/metrics';
import { UUID, ApiResponse, isUUID } from '../../types/common';

// Action Types
export const GPU_ACTIONS = {
  FETCH_GPUS: 'gpu/fetchGPUs',
  UPDATE_METRICS: 'gpu/updateMetrics',
  UPDATE_PRICING: 'gpu/updatePricing',
  SUBSCRIBE_METRICS: 'gpu/subscribeMetrics',
  UNSUBSCRIBE_METRICS: 'gpu/unsubscribeMetrics'
} as const;

// Socket Configuration
const SOCKET_CONFIG = {
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 5
};

let metricsSocket: Socket | null = null;

// Interfaces
interface PricingConfig {
  pricePerHour: number;
  minPrice: number;
  maxPrice: number;
  dynamicPricing: boolean;
}

interface MetricsUpdate {
  gpuId: UUID;
  metrics: GPUMetrics;
  carbonMetrics: CarbonMetrics;
}

// Action Creators
export const fetchGPUs = createAsyncThunk(
  GPU_ACTIONS.FETCH_GPUS,
  async (filter: unknown, { rejectWithValue }) => {
    try {
      if (!isValidGPUFilter(filter)) {
        throw new Error('Invalid GPU filter parameters');
      }

      const response = await fetch('/api/v1/gpus', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(filter)
      });

      const data: ApiResponse<GPU[]> = await response.json();

      if (!data.success) {
        throw new Error(data.message);
      }

      return data.data;
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const updateGPUPricing = createAsyncThunk(
  GPU_ACTIONS.UPDATE_PRICING,
  async ({ gpuId, pricing }: { gpuId: UUID; pricing: PricingConfig }, { rejectWithValue }) => {
    try {
      if (!isUUID(gpuId)) {
        throw new Error('Invalid GPU ID');
      }

      const response = await fetch(`/api/v1/gpus/${gpuId}/pricing`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(pricing)
      });

      const data: ApiResponse<GPU> = await response.json();

      if (!data.success) {
        throw new Error(data.message);
      }

      return data.data;
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

// Debounced metrics update to prevent excessive re-renders
const debouncedMetricsUpdate = debounce(
  (dispatch: any, update: MetricsUpdate) => {
    if (!isValidGPUMetrics(update.metrics) || !isValidCarbonMetrics(update.carbonMetrics)) {
      console.error('Invalid metrics data received');
      return;
    }

    dispatch({
      type: GPU_ACTIONS.UPDATE_METRICS,
      payload: update
    });
  },
  1000,
  { maxWait: 5000 }
);

export const subscribeToGPUMetrics = (gpuId: UUID) => {
  return (dispatch: any) => {
    if (!isUUID(gpuId)) {
      throw new Error('Invalid GPU ID for metrics subscription');
    }

    if (!metricsSocket) {
      metricsSocket = io('/gpu-metrics', SOCKET_CONFIG);

      metricsSocket.on('connect', () => {
        console.log('Connected to GPU metrics socket');
      });

      metricsSocket.on('error', (error) => {
        console.error('GPU metrics socket error:', error);
      });

      metricsSocket.on('metrics', (update: MetricsUpdate) => {
        debouncedMetricsUpdate(dispatch, update);
      });
    }

    metricsSocket.emit('subscribe', { gpuId });

    return {
      type: GPU_ACTIONS.SUBSCRIBE_METRICS,
      payload: { gpuId }
    };
  };
};

export const unsubscribeFromGPUMetrics = (gpuId: UUID) => {
  return (dispatch: any) => {
    if (metricsSocket) {
      metricsSocket.emit('unsubscribe', { gpuId });
    }

    return {
      type: GPU_ACTIONS.UNSUBSCRIBE_METRICS,
      payload: { gpuId }
    };
  };
};

// Helper function to validate GPU status transitions
export const isValidStatusTransition = (
  currentStatus: GPUStatus,
  newStatus: GPUStatus
): boolean => {
  const validTransitions: Record<GPUStatus, GPUStatus[]> = {
    [GPUStatus.AVAILABLE]: [GPUStatus.RESERVED, GPUStatus.MAINTENANCE],
    [GPUStatus.RESERVED]: [GPUStatus.IN_USE, GPUStatus.AVAILABLE],
    [GPUStatus.IN_USE]: [GPUStatus.AVAILABLE, GPUStatus.MAINTENANCE],
    [GPUStatus.MAINTENANCE]: [GPUStatus.AVAILABLE]
  };

  return validTransitions[currentStatus]?.includes(newStatus) ?? false;
};

// Type exports for consumers
export type { PricingConfig, MetricsUpdate };