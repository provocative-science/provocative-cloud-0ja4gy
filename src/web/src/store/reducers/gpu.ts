import { createSlice, PayloadAction } from '@reduxjs/toolkit';
// @version ^1.9.0

import { GPU, GPUStatus } from '../../types/gpu';
import { fetchGPUs } from '../actions/gpu';
import { GPUMetrics, CarbonMetrics } from '../../types/metrics';
import { UUID, Timestamp } from '../../types/common';

// State interface with environmental monitoring
interface GPUState {
  gpus: GPU[];
  selectedGPU: UUID | null;
  loading: boolean;
  error: string | null;
  environmentalMetrics: {
    co2Captured: number;
    coolingEfficiency: number;
    powerUsageEffectiveness: number;
    lastUpdated: Timestamp | null;
  };
  websocketStatus: 'connected' | 'disconnected' | 'error';
  lastUpdated: Timestamp | null;
  retryCount: number;
}

// Initial state with environmental monitoring
const initialState: GPUState = {
  gpus: [],
  selectedGPU: null,
  loading: false,
  error: null,
  environmentalMetrics: {
    co2Captured: 0,
    coolingEfficiency: 0,
    powerUsageEffectiveness: 0,
    lastUpdated: null
  },
  websocketStatus: 'disconnected',
  lastUpdated: null,
  retryCount: 0
};

// Create the GPU slice with enhanced environmental monitoring
const gpuSlice = createSlice({
  name: 'gpu',
  initialState,
  reducers: {
    setSelectedGPU: (state, action: PayloadAction<UUID | null>) => {
      state.selectedGPU = action.payload;
    },
    updateGPUMetrics: (state, action: PayloadAction<{ gpuId: UUID; metrics: GPUMetrics }>) => {
      const { gpuId, metrics } = action.payload;
      const gpu = state.gpus.find(g => g.id === gpuId);
      if (gpu) {
        gpu.metrics = metrics;
        state.lastUpdated = Date.now() as Timestamp;
      }
    },
    updateEnvironmentalMetrics: (state, action: PayloadAction<CarbonMetrics>) => {
      const { co2CapturedKg, powerUsageEffectiveness } = action.payload;
      state.environmentalMetrics = {
        co2Captured: co2CapturedKg,
        coolingEfficiency: 100 - (powerUsageEffectiveness - 1) * 100,
        powerUsageEffectiveness,
        lastUpdated: Date.now() as Timestamp
      };
    },
    updateGPUStatus: (state, action: PayloadAction<{ gpuId: UUID; status: GPUStatus }>) => {
      const { gpuId, status } = action.payload;
      const gpu = state.gpus.find(g => g.id === gpuId);
      if (gpu) {
        gpu.status = status;
        state.lastUpdated = Date.now() as Timestamp;
      }
    },
    updateWebsocketStatus: (state, action: PayloadAction<GPUState['websocketStatus']>) => {
      state.websocketStatus = action.payload;
    },
    clearError: (state) => {
      state.error = null;
      state.retryCount = 0;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchGPUs.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchGPUs.fulfilled, (state, action: PayloadAction<GPU[]>) => {
        state.loading = false;
        state.gpus = action.payload;
        state.lastUpdated = Date.now() as Timestamp;
        state.retryCount = 0;
      })
      .addCase(fetchGPUs.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string || 'Failed to fetch GPUs';
        state.retryCount += 1;
      });
  }
});

// Export actions and reducer
export const {
  setSelectedGPU,
  updateGPUMetrics,
  updateEnvironmentalMetrics,
  updateGPUStatus,
  updateWebsocketStatus,
  clearError
} = gpuSlice.actions;

// Selectors
export const selectAllGPUs = (state: { gpu: GPUState }) => state.gpu.gpus;
export const selectSelectedGPU = (state: { gpu: GPUState }) => 
  state.gpu.selectedGPU ? state.gpu.gpus.find(gpu => gpu.id === state.gpu.selectedGPU) : null;
export const selectEnvironmentalMetrics = (state: { gpu: GPUState }) => state.gpu.environmentalMetrics;
export const selectGPULoading = (state: { gpu: GPUState }) => state.gpu.loading;
export const selectGPUError = (state: { gpu: GPUState }) => state.gpu.error;
export const selectWebsocketStatus = (state: { gpu: GPUState }) => state.gpu.websocketStatus;
export const selectLastUpdated = (state: { gpu: GPUState }) => state.gpu.lastUpdated;

// Export the reducer
export default gpuSlice.reducer;