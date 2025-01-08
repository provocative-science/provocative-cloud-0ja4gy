/**
 * Redux reducer for managing comprehensive GPU, carbon capture, and system metrics
 * Handles real-time updates, historical data, and error states with retry logic
 * @version 1.0.0
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit'; // ^1.9.5
import {
  GPUMetrics,
  CarbonMetrics,
  SystemMetrics,
  MetricsResponse,
  MetricsValidation
} from '../../types/metrics';
import {
  fetchGPUMetrics,
  fetchCarbonMetrics,
  fetchSystemMetrics,
  fetchAllMetrics,
  fetchHistoricalMetrics,
  handleMetricsWebSocketMessage,
  validateMetrics
} from '../actions/metrics';

/**
 * Interface defining the metrics slice of Redux state
 */
interface MetricsState {
  gpuMetrics: GPUMetrics[] | null;
  carbonMetrics: CarbonMetrics | null;
  systemMetrics: SystemMetrics | null;
  historicalMetrics: MetricsResponse[] | null;
  retryCount: number;
  lastUpdated: number;
  loading: boolean;
  error: string | null;
}

/**
 * Initial state for metrics reducer
 */
const initialState: MetricsState = {
  gpuMetrics: null,
  carbonMetrics: null,
  systemMetrics: null,
  historicalMetrics: null,
  retryCount: 0,
  lastUpdated: 0,
  loading: false,
  error: null
};

/**
 * Metrics reducer slice with comprehensive state management
 */
const metricsSlice = createSlice({
  name: 'metrics',
  initialState,
  reducers: {
    setGPUMetrics: (state, action: PayloadAction<GPUMetrics[]>) => {
      state.gpuMetrics = action.payload;
      state.lastUpdated = Date.now();
      state.error = null;
    },
    setCarbonMetrics: (state, action: PayloadAction<CarbonMetrics>) => {
      state.carbonMetrics = action.payload;
      state.lastUpdated = Date.now();
      state.error = null;
    },
    setSystemMetrics: (state, action: PayloadAction<SystemMetrics>) => {
      state.systemMetrics = action.payload;
      state.lastUpdated = Date.now();
      state.error = null;
    },
    setHistoricalMetrics: (state, action: PayloadAction<MetricsResponse[]>) => {
      state.historicalMetrics = action.payload;
      state.lastUpdated = Date.now();
      state.error = null;
    },
    incrementRetryCount: (state) => {
      state.retryCount += 1;
    },
    resetRetryCount: (state) => {
      state.retryCount = 0;
    },
    setError: (state, action: PayloadAction<string>) => {
      state.error = action.payload;
      state.loading = false;
    },
    clearError: (state) => {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    // GPU Metrics
    builder.addCase(fetchGPUMetrics.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(fetchGPUMetrics.fulfilled, (state, action) => {
      state.gpuMetrics = action.payload;
      state.loading = false;
      state.lastUpdated = Date.now();
      state.retryCount = 0;
      state.error = null;
    });
    builder.addCase(fetchGPUMetrics.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload?.message || 'Failed to fetch GPU metrics';
      state.incrementRetryCount;
    });

    // Carbon Metrics
    builder.addCase(fetchCarbonMetrics.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(fetchCarbonMetrics.fulfilled, (state, action) => {
      state.carbonMetrics = action.payload;
      state.loading = false;
      state.lastUpdated = Date.now();
      state.retryCount = 0;
      state.error = null;
    });
    builder.addCase(fetchCarbonMetrics.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload?.message || 'Failed to fetch carbon metrics';
      state.incrementRetryCount;
    });

    // System Metrics
    builder.addCase(fetchSystemMetrics.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(fetchSystemMetrics.fulfilled, (state, action) => {
      state.systemMetrics = action.payload;
      state.loading = false;
      state.lastUpdated = Date.now();
      state.retryCount = 0;
      state.error = null;
    });
    builder.addCase(fetchSystemMetrics.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload?.message || 'Failed to fetch system metrics';
      state.incrementRetryCount;
    });

    // All Metrics
    builder.addCase(fetchAllMetrics.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(fetchAllMetrics.fulfilled, (state, action) => {
      const { gpuMetrics, carbonMetrics, systemMetrics } = action.payload;
      state.gpuMetrics = gpuMetrics;
      state.carbonMetrics = carbonMetrics;
      state.systemMetrics = systemMetrics;
      state.loading = false;
      state.lastUpdated = Date.now();
      state.retryCount = 0;
      state.error = null;
    });
    builder.addCase(fetchAllMetrics.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload?.message || 'Failed to fetch all metrics';
      state.incrementRetryCount;
    });

    // Historical Metrics
    builder.addCase(fetchHistoricalMetrics.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(fetchHistoricalMetrics.fulfilled, (state, action) => {
      state.historicalMetrics = action.payload;
      state.loading = false;
      state.lastUpdated = Date.now();
      state.retryCount = 0;
      state.error = null;
    });
    builder.addCase(fetchHistoricalMetrics.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload?.message || 'Failed to fetch historical metrics';
      state.incrementRetryCount;
    });

    // WebSocket Updates
    builder.addCase(handleMetricsWebSocketMessage, (state, action) => {
      if (!action.payload) return;

      const { gpuMetrics, carbonMetrics, systemMetrics } = action.payload;
      
      if (gpuMetrics) {
        state.gpuMetrics = gpuMetrics;
      }
      if (carbonMetrics) {
        state.carbonMetrics = carbonMetrics;
      }
      if (systemMetrics) {
        state.systemMetrics = systemMetrics;
      }
      
      state.lastUpdated = Date.now();
      state.error = null;
    });
  }
});

export const {
  setGPUMetrics,
  setCarbonMetrics,
  setSystemMetrics,
  setHistoricalMetrics,
  incrementRetryCount,
  resetRetryCount,
  setError,
  clearError
} = metricsSlice.actions;

export default metricsSlice.reducer;