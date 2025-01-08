/**
 * Redux reducer for managing server state including environmental metrics
 * Handles server listing, status updates, maintenance mode, and carbon capture metrics
 * @version 1.0.0
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit'; // ^1.9.5
import { Server, ServerStatus, EnvironmentalMetrics } from '../../types/server';
import { 
  fetchServers, 
  fetchServerById,
  updateEnvironmentalMetrics 
} from '../actions/server';
import { ENVIRONMENTAL_CONFIG } from '../../config/constants';

/**
 * Interface defining the server state structure
 */
export interface ServerState {
  readonly servers: Record<string, Server>;
  readonly loading: boolean;
  readonly error: string | null;
  readonly selectedServerId: string | null;
  readonly environmentalMetrics: Record<string, EnvironmentalMetrics>;
  readonly carbonCaptureEfficiency: Record<string, number>;
  readonly powerUsageEffectiveness: Record<string, number>;
}

/**
 * Initial state for server reducer
 */
const initialState: ServerState = {
  servers: {},
  loading: false,
  error: null,
  selectedServerId: null,
  environmentalMetrics: {},
  carbonCaptureEfficiency: {},
  powerUsageEffectiveness: {}
};

/**
 * Server state reducer with environmental metrics support
 */
const serverSlice = createSlice({
  name: 'server',
  initialState,
  reducers: {
    /**
     * Updates environmental metrics for a specific server
     */
    updateServerEnvironmentalMetrics(
      state,
      action: PayloadAction<{ serverId: string; metrics: EnvironmentalMetrics }>
    ) {
      const { serverId, metrics } = action.payload;
      state.environmentalMetrics[serverId] = metrics;

      // Calculate efficiency ratios
      state.carbonCaptureEfficiency[serverId] = 
        metrics.co2CapturedKg / ENVIRONMENTAL_CONFIG.CO2_CAPTURE_THRESHOLDS.TARGET_RATE_KG_PER_DAY;
      
      state.powerUsageEffectiveness[serverId] = 
        metrics.powerUsageEffectiveness / ENVIRONMENTAL_CONFIG.EFFECTIVENESS_RATIOS.TARGET_PUE;
    },

    /**
     * Sets the selected server ID for detailed view
     */
    setSelectedServer(state, action: PayloadAction<string | null>) {
      state.selectedServerId = action.payload;
    },

    /**
     * Clears any error state
     */
    clearError(state) {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    // Handle fetchServers action states
    builder.addCase(fetchServers.pending, (state) => {
      state.loading = true;
      state.error = null;
    });

    builder.addCase(fetchServers.fulfilled, (state, action) => {
      state.loading = false;
      state.servers = action.payload.reduce((acc, server) => {
        acc[server.id] = server;
        
        // Initialize environmental metrics
        if (server.carbonMetrics) {
          state.environmentalMetrics[server.id] = server.carbonMetrics;
          state.carbonCaptureEfficiency[server.id] = 
            server.carbonMetrics.co2CapturedKg / ENVIRONMENTAL_CONFIG.CO2_CAPTURE_THRESHOLDS.TARGET_RATE_KG_PER_DAY;
          state.powerUsageEffectiveness[server.id] = 
            server.carbonMetrics.powerUsageEffectiveness / ENVIRONMENTAL_CONFIG.EFFECTIVENESS_RATIOS.TARGET_PUE;
        }
        
        return acc;
      }, {} as Record<string, Server>);
    });

    builder.addCase(fetchServers.rejected, (state, action) => {
      state.loading = false;
      state.error = action.error.message || 'Failed to fetch servers';
    });

    // Handle fetchServerById action states
    builder.addCase(fetchServerById.pending, (state) => {
      state.loading = true;
      state.error = null;
    });

    builder.addCase(fetchServerById.fulfilled, (state, action) => {
      state.loading = false;
      const server = action.payload;
      state.servers[server.id] = server;
      
      if (server.carbonMetrics) {
        state.environmentalMetrics[server.id] = server.carbonMetrics;
        state.carbonCaptureEfficiency[server.id] = 
          server.carbonMetrics.co2CapturedKg / ENVIRONMENTAL_CONFIG.CO2_CAPTURE_THRESHOLDS.TARGET_RATE_KG_PER_DAY;
        state.powerUsageEffectiveness[server.id] = 
          server.carbonMetrics.powerUsageEffectiveness / ENVIRONMENTAL_CONFIG.EFFECTIVENESS_RATIOS.TARGET_PUE;
      }
    });

    builder.addCase(fetchServerById.rejected, (state, action) => {
      state.loading = false;
      state.error = action.error.message || 'Failed to fetch server details';
    });

    // Handle updateEnvironmentalMetrics action states
    builder.addCase(updateEnvironmentalMetrics.pending, (state) => {
      state.loading = true;
      state.error = null;
    });

    builder.addCase(updateEnvironmentalMetrics.fulfilled, (state, action) => {
      state.loading = false;
      const { serverId, metrics } = action.payload;
      
      if (state.servers[serverId]) {
        state.servers[serverId].carbonMetrics = metrics;
        state.environmentalMetrics[serverId] = metrics;
        state.carbonCaptureEfficiency[serverId] = 
          metrics.co2CapturedKg / ENVIRONMENTAL_CONFIG.CO2_CAPTURE_THRESHOLDS.TARGET_RATE_KG_PER_DAY;
        state.powerUsageEffectiveness[serverId] = 
          metrics.powerUsageEffectiveness / ENVIRONMENTAL_CONFIG.EFFECTIVENESS_RATIOS.TARGET_PUE;
      }
    });

    builder.addCase(updateEnvironmentalMetrics.rejected, (state, action) => {
      state.loading = false;
      state.error = action.error.message || 'Failed to update environmental metrics';
    });
  }
});

export const { 
  updateServerEnvironmentalMetrics, 
  setSelectedServer, 
  clearError 
} = serverSlice.actions;

export const serverReducer = serverSlice.reducer;