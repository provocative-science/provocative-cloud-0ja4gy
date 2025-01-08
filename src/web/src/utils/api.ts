/**
 * Core API utility functions for making HTTP requests, handling responses,
 * and managing API interactions in the frontend application.
 * @version 1.0.0
 */

import axios, { AxiosInstance, AxiosError, AxiosRequestConfig } from 'axios'; // ^1.4.0
import axiosRetry from 'axios-retry'; // ^3.5.0
import CircuitBreaker from 'opossum'; // ^7.1.0
import { apiConfig, retryConfig, wsConfig } from '../config/api';
import { getAuthToken } from './auth';
import { ApiResponse, ApiError } from '../types/common';

// Global constants
const DEFAULT_ERROR_MESSAGE = 'An unexpected error occurred. Please try again.';
const NETWORK_ERROR_MESSAGE = 'Network error. Please check your connection.';
const MAX_RETRIES = 3;
const CIRCUIT_BREAKER_OPTIONS = {
  timeout: 3000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000
};
const WS_RECONNECT_INTERVAL = 5000;

/**
 * Creates and configures an enhanced axios instance with retry logic,
 * circuit breaker, and WebSocket support
 */
function createAxiosInstance(): AxiosInstance {
  // Create base axios instance
  const instance = axios.create(apiConfig);

  // Configure retry mechanism
  axiosRetry(instance, {
    retries: retryConfig.maxAttempts,
    retryDelay: (retryCount) => {
      return Math.min(
        retryConfig.initialDelayMs * Math.pow(retryConfig.backoffFactor, retryCount - 1),
        retryConfig.maxDelayMs
      );
    },
    retryCondition: (error: AxiosError) => {
      return (
        axiosRetry.isNetworkOrIdempotentRequestError(error) ||
        (error.response?.status ? retryConfig.retryableStatuses.includes(error.response.status) : false)
      );
    }
  });

  // Create circuit breaker
  const breaker = new CircuitBreaker(instance, CIRCUIT_BREAKER_OPTIONS);

  // Add request interceptor for authentication
  instance.interceptors.request.use(
    async (config) => {
      const token = await getAuthToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error) => Promise.reject(error)
  );

  // Add response interceptor for error handling
  instance.interceptors.response.use(
    (response) => response,
    async (error) => {
      const enhancedError = await handleApiError(error);
      return Promise.reject(enhancedError);
    }
  );

  return instance;
}

/**
 * Enhanced error handling with retry logic and detailed error transformation
 * @param error AxiosError instance
 * @returns Standardized ApiError object
 */
async function handleApiError(error: AxiosError): Promise<ApiError> {
  const apiError: ApiError = {
    code: error.response?.status || 500,
    message: error.response?.data?.message || DEFAULT_ERROR_MESSAGE,
    details: {},
    retryable: false
  };

  if (error.code === 'ECONNABORTED' || !error.response) {
    apiError.code = 503;
    apiError.message = NETWORK_ERROR_MESSAGE;
    apiError.retryable = true;
  }

  // Extract detailed error information if available
  if (error.response?.data) {
    apiError.details = {
      path: error.response.config.url,
      method: error.response.config.method?.toUpperCase(),
      timestamp: new Date().toISOString(),
      ...error.response.data
    };
  }

  // Determine if error is retryable
  apiError.retryable = retryConfig.retryableStatuses.includes(apiError.code);

  // Log error for monitoring
  console.error('API Error:', {
    ...apiError,
    stack: error.stack
  });

  return apiError;
}

/**
 * Configures WebSocket connection for real-time metrics
 * @returns Configured WebSocket instance
 */
function setupWebSocket(): WebSocket {
  const ws = new WebSocket(wsConfig.url);
  let reconnectAttempts = 0;
  let reconnectTimeout: NodeJS.Timeout;

  const connect = () => {
    ws.onopen = () => {
      console.log('WebSocket connected');
      reconnectAttempts = 0;
      // Setup ping/pong heartbeat
      const heartbeat = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, wsConfig.heartbeatInterval);

      ws.onclose = () => {
        clearInterval(heartbeat);
        handleReconnect();
      };
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'pong') return;
        
        // Emit custom event for metrics updates
        const metricsEvent = new CustomEvent('metricsUpdate', { detail: data });
        window.dispatchEvent(metricsEvent);
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      ws.close();
    };
  };

  const handleReconnect = () => {
    if (reconnectAttempts >= wsConfig.maxReconnectAttempts) {
      console.error('Max WebSocket reconnection attempts reached');
      return;
    }

    reconnectTimeout = setTimeout(() => {
      reconnectAttempts++;
      connect();
    }, WS_RECONNECT_INTERVAL);
  };

  connect();

  return ws;
}

// Create enhanced axios instance
const api = createAxiosInstance();

// Setup WebSocket connection
const ws = setupWebSocket();

// Export configured instances and utilities
export {
  api,
  ws,
  handleApiError,
  ApiResponse,
  ApiError
};

// Type-safe request methods with response transformation
export async function get<T>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
  const response = await api.get<ApiResponse<T>>(url, config);
  return response.data;
}

export async function post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
  const response = await api.post<ApiResponse<T>>(url, data, config);
  return response.data;
}

export async function put<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
  const response = await api.put<ApiResponse<T>>(url, data, config);
  return response.data;
}

export async function del<T>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
  const response = await api.delete<ApiResponse<T>>(url, config);
  return response.data;
}