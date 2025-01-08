import { createAsyncThunk } from '@reduxjs/toolkit';
import { retry } from 'axios-retry';
import WebSocket from 'ws';
import { 
  Reservation, 
  ReservationCreate, 
  ReservationDetails, 
  ReservationStatus, 
  DeploymentType,
  DeploymentStatus
} from '../../types/reservation';
import { GPUMetrics, CarbonMetrics } from '../../types/metrics';
import { api, ws } from '../../utils/api';
import { API_ENDPOINTS } from '../../config/api';
import { METRICS_CONFIG, ENVIRONMENTAL_CONFIG } from '../../config/constants';

// Constants for WebSocket and retry configuration
const METRICS_UPDATE_INTERVAL = 30000; // 30 seconds
const MAX_RETRY_ATTEMPTS = 3;
const WEBSOCKET_RECONNECT_DELAY = 5000;

/**
 * Fetches all reservations with real-time metrics and carbon offset data
 */
export const fetchReservationsWithMetrics = createAsyncThunk(
  'reservation/fetchWithMetrics',
  async (filters?: {
    status?: ReservationStatus[];
    startDate?: number;
    endDate?: number;
    deploymentType?: DeploymentType;
  }) => {
    try {
      // Configure retry mechanism for resilience
      const config = {
        'axios-retry': {
          retries: MAX_RETRY_ATTEMPTS,
          retryDelay: (retryCount: number) => retryCount * WEBSOCKET_RECONNECT_DELAY,
          retryCondition: (error: any) => retry(error)
        }
      };

      // Fetch initial reservations
      const response = await api.get<ReservationDetails[]>(
        API_ENDPOINTS.RESERVATION.LIST,
        { 
          params: filters,
          ...config
        }
      );

      // Set up WebSocket connection for real-time updates
      const metricsSocket = new WebSocket(ws.url);
      const reservations = response.data;

      // Subscribe to metrics updates for each reservation
      reservations.forEach(reservation => {
        metricsSocket.send(JSON.stringify({
          type: 'subscribe',
          reservationId: reservation.reservation.id
        }));
      });

      // Handle real-time metrics updates
      metricsSocket.onmessage = (event) => {
        const update = JSON.parse(event.data);
        if (update.type === 'metrics') {
          // Dispatch metrics update action
          return {
            type: 'reservation/updateMetrics',
            payload: {
              reservationId: update.reservationId,
              metrics: update.metrics as GPUMetrics,
              carbonMetrics: update.carbonMetrics as CarbonMetrics
            }
          };
        }
      };

      return reservations;
    } catch (error) {
      throw error;
    }
  }
);

/**
 * Creates a new GPU reservation with deployment configuration
 */
export const createNewReservationWithDeployment = createAsyncThunk(
  'reservation/createWithDeployment',
  async (data: ReservationCreate) => {
    try {
      // Create initial reservation
      const response = await api.post<ReservationDetails>(
        API_ENDPOINTS.RESERVATION.CREATE,
        data
      );

      const reservation = response.data;

      // Initialize deployment based on type
      const deploymentResponse = await api.post(
        `${API_ENDPOINTS.RESERVATION.DETAILS(reservation.reservation.id)}/deploy`,
        {
          type: data.deployment_type,
          config: {
            autoRenew: data.auto_renew,
            environmentVariables: {},
            resourceLimits: {
              maxMemoryGB: reservation.gpu.specifications.vram_gb,
              maxPowerWatts: reservation.gpu.specifications.max_power_watts
            }
          }
        }
      );

      // Monitor deployment status
      let deploymentStatus = deploymentResponse.data.status;
      while (deploymentStatus === DeploymentStatus.PROVISIONING) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        const statusResponse = await api.get(
          `${API_ENDPOINTS.RESERVATION.DETAILS(reservation.reservation.id)}/status`
        );
        deploymentStatus = statusResponse.data.status;
      }

      // Set up metrics collection
      const metricsInterval = setInterval(async () => {
        const metricsResponse = await api.get(
          `${API_ENDPOINTS.RESERVATION.DETAILS(reservation.reservation.id)}/metrics`
        );
        // Dispatch metrics update action
        return {
          type: 'reservation/updateMetrics',
          payload: {
            reservationId: reservation.reservation.id,
            metrics: metricsResponse.data.metrics,
            carbonMetrics: metricsResponse.data.carbonMetrics
          }
        };
      }, METRICS_CONFIG.UPDATE_INTERVAL_MS);

      return {
        ...reservation,
        deployment: deploymentResponse.data,
        metricsInterval
      };
    } catch (error) {
      throw error;
    }
  }
);

/**
 * Updates an existing reservation with real-time metrics
 */
export const updateReservationWithMetrics = createAsyncThunk(
  'reservation/updateWithMetrics',
  async ({ 
    reservationId, 
    updates 
  }: { 
    reservationId: string; 
    updates: Partial<Reservation> 
  }) => {
    try {
      // Update reservation
      const response = await api.put<ReservationDetails>(
        API_ENDPOINTS.RESERVATION.DETAILS(reservationId),
        updates
      );

      const updatedReservation = response.data;

      // Fetch latest metrics
      const metricsResponse = await api.get(
        `${API_ENDPOINTS.METRICS.GPU}/${updatedReservation.gpu.id}`
      );

      // Calculate carbon offset
      const carbonResponse = await api.get(
        `${API_ENDPOINTS.ENVIRONMENTAL.CO2_CAPTURE}/${updatedReservation.reservation.id}`
      );

      return {
        ...updatedReservation,
        metrics: metricsResponse.data,
        carbonMetrics: carbonResponse.data
      };
    } catch (error) {
      throw error;
    }
  }
);

/**
 * Cancels an active reservation and cleans up resources
 */
export const cancelReservation = createAsyncThunk(
  'reservation/cancel',
  async (reservationId: string) => {
    try {
      // Stop metrics collection
      clearInterval(window.__metricsIntervals?.[reservationId]);

      // Cancel reservation
      const response = await api.post(
        API_ENDPOINTS.RESERVATION.CANCEL(reservationId)
      );

      // Clean up deployment resources
      await api.delete(
        `${API_ENDPOINTS.RESERVATION.DETAILS(reservationId)}/deploy`
      );

      return response.data;
    } catch (error) {
      throw error;
    }
  }
);

/**
 * Extends an existing reservation duration
 */
export const extendReservation = createAsyncThunk(
  'reservation/extend',
  async ({ 
    reservationId, 
    additionalHours 
  }: { 
    reservationId: string; 
    additionalHours: number 
  }) => {
    try {
      const response = await api.post(
        `${API_ENDPOINTS.RESERVATION.DETAILS(reservationId)}/extend`,
        { additionalHours }
      );

      return response.data;
    } catch (error) {
      throw error;
    }
  }
);