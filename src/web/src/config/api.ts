/**
 * Core API configuration file for Provocative Cloud platform
 * Defines base URLs, timeouts, headers, and API-related settings for frontend-backend communication
 * @version 1.0.0
 */

import { AxiosRequestConfig } from 'axios'; // ^1.4.0
import CircuitBreaker from 'opossum'; // ^6.0.0
import { HTTP_STATUS } from './constants';

// Global API configuration constants
const API_VERSION = 'v1';
const API_TIMEOUT = 30000;
const WEBSOCKET_TIMEOUT = 30000;
const RETRY_MAX_ATTEMPTS = 3;
const CIRCUIT_BREAKER_TIMEOUT = 10000;

/**
 * Returns environment-specific API base URL
 */
export const getBaseUrl = (): string => {
  const env = process.env.REACT_APP_ENV || 'development';
  const urls = {
    development: 'http://localhost:3000',
    staging: 'https://api.staging.provocative.cloud',
    production: 'https://api.provocative.cloud'
  };
  return `${urls[env as keyof typeof urls]}/${API_VERSION}`;
};

/**
 * Returns environment-specific WebSocket URL
 */
export const getWebSocketUrl = (): string => {
  const env = process.env.REACT_APP_ENV || 'development';
  const urls = {
    development: 'ws://localhost:3001',
    staging: 'wss://ws.staging.provocative.cloud',
    production: 'wss://ws.provocative.cloud'
  };
  return `${urls[env as keyof typeof urls]}/${API_VERSION}`;
};

/**
 * Creates circuit breaker instance for API fault tolerance
 */
export const createCircuitBreaker = (options: CircuitBreaker.Options = {}): CircuitBreaker => {
  return new CircuitBreaker(() => Promise.resolve(), {
    timeout: CIRCUIT_BREAKER_TIMEOUT,
    errorThresholdPercentage: 50,
    resetTimeout: 30000,
    ...options
  });
};

/**
 * Core API configuration for Axios instance
 */
export const apiConfig: AxiosRequestConfig = {
  baseURL: getBaseUrl(),
  timeout: API_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'X-API-Version': API_VERSION
  },
  validateStatus: (status: number) => status === HTTP_STATUS.OK,
  withCredentials: true
};

/**
 * Retry configuration for failed requests
 */
export const retryConfig = {
  maxAttempts: RETRY_MAX_ATTEMPTS,
  initialDelayMs: 1000,
  maxDelayMs: 5000,
  backoffFactor: 2,
  retryableStatuses: [
    HTTP_STATUS.TOO_MANY_REQUESTS,
    500,
    502,
    503,
    504
  ]
};

/**
 * WebSocket configuration for real-time updates
 */
export const wsConfig = {
  url: getWebSocketUrl(),
  timeout: WEBSOCKET_TIMEOUT,
  reconnectInterval: 5000,
  maxReconnectAttempts: 5,
  heartbeatInterval: 30000
};

/**
 * Rate limiting configuration
 */
export const rateLimitConfig = {
  maxRequestsPerHour: {
    user: 1000,
    host: 5000
  },
  burstLimit: {
    requestsPerMinute: 100
  },
  errorStatusCode: HTTP_STATUS.TOO_MANY_REQUESTS
};

/**
 * API endpoints configuration
 */
export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/auth/login',
    LOGOUT: '/auth/logout',
    REFRESH: '/auth/refresh',
    GOOGLE: '/auth/google'
  },
  GPU: {
    LIST: '/gpu',
    DETAILS: (id: string) => `/gpu/${id}`,
    METRICS: (id: string) => `/gpu/${id}/metrics`
  },
  RESERVATION: {
    CREATE: '/reservations',
    LIST: '/reservations',
    DETAILS: (id: string) => `/reservations/${id}`,
    CANCEL: (id: string) => `/reservations/${id}/cancel`
  },
  BILLING: {
    TRANSACTIONS: '/billing/transactions',
    INVOICE: (id: string) => `/billing/invoices/${id}`,
    USAGE: '/billing/usage'
  },
  METRICS: {
    GPU: '/metrics/gpu',
    SYSTEM: '/metrics/system',
    HISTORICAL: '/metrics/historical'
  },
  ENVIRONMENTAL: {
    CO2_CAPTURE: '/environmental/co2',
    POWER_USAGE: '/environmental/power',
    WATER_USAGE: '/environmental/water',
    EFFICIENCY: '/environmental/efficiency'
  }
} as const;

/**
 * Error handling configuration
 */
export const errorConfig = {
  defaultMessage: 'An unexpected error occurred',
  retryableNetworkErrors: [
    'ECONNRESET',
    'ETIMEDOUT',
    'ECONNREFUSED',
    'NETWORK_ERROR'
  ],
  tokenRefreshConfig: {
    retryCount: 1,
    refreshEndpoint: API_ENDPOINTS.AUTH.REFRESH
  }
};

/**
 * Circuit breaker configuration
 */
export const circuitBreakerConfig = {
  timeout: CIRCUIT_BREAKER_TIMEOUT,
  errorThresholdPercentage: 50,
  resetTimeout: 30000,
  rollingCountTimeout: 10000,
  rollingCountBuckets: 10,
  name: 'apiCircuitBreaker'
};