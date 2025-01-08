/**
 * Redux action creators and thunks for server state management
 * Handles server operations, environmental metrics, and real-time monitoring
 * @version 1.0.0
 */

import { createAsyncThunk } from '@reduxjs/toolkit'; // ^1.9.5
import { io } from 'socket.io-client'; // ^4.7.2
import {
  Server,
  ServerStatus,
  ServerFilter,
  ServerSpecification,
  EnvironmentalMetrics
} from '../../types/server';
import {
  getServers,
  getServerById,
  updateServerStatus,
  toggleMaintenanceMode,
  updateServerSpecification,
  getEnvironmentalMetrics
} from '../../api/servers';
import { handleApiError, retryWithBackoff } from '../../utils/api';
import { ENVIRONMENTAL_CONFIG } from '../../config/constants';

/**
 * Fetches list of servers with environmental metrics and optional filtering
 */
export const fetchServers = createAsyncThunk(
  'server/fetchServers',
  async (filter?: ServerFilter, { rejectWithValue }) => {
    try {
      const serversResponse = await retryWithBackoff(() => getServers(filter, true));
      
      // Validate environmental metrics against thresholds
      const serversWithValidatedMetrics = serversResponse.data.map(server => ({
        ...server,
        carbonMetrics: {
          ...server.carbonMetrics,
          isEfficient: server.carbonMetrics.powerUsageEffectiveness <= ENVIRONMENTAL_CONFIG.EFFECTIVENESS_RATIOS.TARGET_PUE &&
                      server.carbonMetrics.waterUsageEffectiveness <= ENVIRONMENTAL_CONFIG.EFFECTIVENESS_RATIOS.TARGET_WUE &&
                      server.carbonMetrics.carbonUsageEffectiveness <= ENVIRONMENTAL_CONFIG.EFFECTIVENESS_RATIOS.TARGET_CUE
        }
      }));

      return serversWithValidatedMetrics;
    } catch (error) {
      return rejectWithValue(handleApiError(error));
    }
  }
);

/**
 * Fetches detailed server information with real-time environmental metrics
 */
export const fetchServerById = createAsyncThunk(
  'server/fetchServerById',
  async (serverId: string, { rejectWithValue }) => {
    try {
      // Establish WebSocket connection for real-time metrics
      const socket = io('/server-metrics', {
        query: { serverId }
      });

      // Get initial server data
      const serverResponse = await retryWithBackoff(() => getServerById(serverId, true));
      const server = serverResponse.data;

      // Subscribe to real-time environmental metrics updates
      socket.on('metrics-update', (metrics: EnvironmentalMetrics) => {
        // Dispatch metrics update action (handled by reducer)
        return {
          type: 'server/updateEnvironmentalMetrics',
          payload: {
            serverId,
            metrics
          }
        };
      });

      return server;
    } catch (error) {
      return rejectWithValue(handleApiError(error));
    }
  }
);

/**
 * Updates server operational status with environmental impact assessment
 */
export const updateStatus = createAsyncThunk(
  'server/updateStatus',
  async ({
    serverId,
    status,
    environmentalImpact
  }: {
    serverId: string;
    status: ServerStatus;
    environmentalImpact: EnvironmentalMetrics;
  }, { rejectWithValue }) => {
    try {
      // Validate environmental impact before status change
      if (
        environmentalImpact.powerUsageEffectiveness > ENVIRONMENTAL_CONFIG.EFFECTIVENESS_RATIOS.MAX_PUE ||
        environmentalImpact.waterUsageEffectiveness > ENVIRONMENTAL_CONFIG.EFFECTIVENESS_RATIOS.MAX_WUE ||
        environmentalImpact.carbonUsageEffectiveness > ENVIRONMENTAL_CONFIG.EFFECTIVENESS_RATIOS.MAX_CUE
      ) {
        throw new Error('Environmental impact exceeds maximum thresholds');
      }

      const response = await retryWithBackoff(() => 
        updateServerStatus(serverId, status, environmentalImpact)
      );

      return response.data;
    } catch (error) {
      return rejectWithValue(handleApiError(error));
    }
  }
);

/**
 * Toggles server maintenance mode with environmental efficiency preservation
 */
export const setMaintenanceMode = createAsyncThunk(
  'server/setMaintenanceMode',
  async ({
    serverId,
    enabled,
    preserveMetrics
  }: {
    serverId: string;
    enabled: boolean;
    preserveMetrics: boolean;
  }, { rejectWithValue }) => {
    try {
      // Get current environmental metrics
      const metricsResponse = await getEnvironmentalMetrics(serverId);
      const currentMetrics = metricsResponse.data;

      // Schedule maintenance during optimal efficiency periods
      const maintenanceRecord = {
        startTime: Date.now(),
        endTime: Date.now() + (24 * 60 * 60 * 1000), // 24 hours
        type: 'scheduled',
        description: 'Scheduled maintenance with environmental metric preservation',
        environmentalBaseline: preserveMetrics ? currentMetrics : undefined
      };

      const response = await retryWithBackoff(() =>
        toggleMaintenanceMode(serverId, enabled, maintenanceRecord)
      );

      return response.data;
    } catch (error) {
      return rejectWithValue(handleApiError(error));
    }
  }
);

/**
 * Updates server specifications with environmental efficiency metrics
 */
export const updateSpecification = createAsyncThunk(
  'server/updateSpecification',
  async ({
    serverId,
    specifications,
    environmentalMetrics
  }: {
    serverId: string;
    specifications: ServerSpecification;
    environmentalMetrics: EnvironmentalMetrics;
  }, { rejectWithValue }) => {
    try {
      // Calculate environmental impact of specification changes
      const impactAssessment = {
        powerImpact: environmentalMetrics.powerUsageEffectiveness - ENVIRONMENTAL_CONFIG.EFFECTIVENESS_RATIOS.TARGET_PUE,
        waterImpact: environmentalMetrics.waterUsageEffectiveness - ENVIRONMENTAL_CONFIG.EFFECTIVENESS_RATIOS.TARGET_WUE,
        carbonImpact: environmentalMetrics.carbonUsageEffectiveness - ENVIRONMENTAL_CONFIG.EFFECTIVENESS_RATIOS.TARGET_CUE
      };

      // Validate environmental efficiency
      if (
        impactAssessment.powerImpact > 0 ||
        impactAssessment.waterImpact > 0 ||
        impactAssessment.carbonImpact > 0
      ) {
        throw new Error('Specification changes would decrease environmental efficiency');
      }

      const response = await retryWithBackoff(() =>
        updateServerSpecification(serverId, specifications, environmentalMetrics)
      );

      return response.data;
    } catch (error) {
      return rejectWithValue(handleApiError(error));
    }
  }
);