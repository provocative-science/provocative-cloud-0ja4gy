/**
 * Core configuration constants for Provocative Cloud web application
 * Includes API endpoints, feature flags, validation rules, and system-wide defaults
 * @version 1.0.0
 */

import { GPUModel, GPUStatus } from '../types/gpu';
import { MetricsTimeRange } from '../types/metrics';

/**
 * API configuration and endpoints
 */
export const API_CONFIG = {
  BASE_URL: process.env.REACT_APP_API_URL || 'https://api.provocative.cloud',
  VERSION: 'v1',
  TIMEOUT_MS: 30000,
  RETRY_ATTEMPTS: 3,
  ENDPOINTS: {
    AUTH: '/auth',
    GPU: '/gpu',
    METRICS: '/metrics',
    CARBON: '/carbon',
    BILLING: '/billing'
  },
  HEADERS: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
} as const;

/**
 * WebSocket configuration
 */
export const WEBSOCKET_CONFIG = {
  BASE_URL: process.env.REACT_APP_WS_URL || 'wss://ws.provocative.cloud',
  RECONNECT_INTERVAL_MS: 5000,
  MAX_RECONNECT_ATTEMPTS: 5,
  PING_INTERVAL_MS: 30000
} as const;

/**
 * GPU rental configuration constants
 */
export const GPU_CONSTANTS = {
  MIN_RENTAL_HOURS: 1,
  MAX_RENTAL_HOURS: 720, // 30 days
  SUPPORTED_MODELS: [GPUModel.NVIDIA_A100, GPUModel.NVIDIA_V100],
  DEFAULT_STATUS_FILTERS: [GPUStatus.AVAILABLE, GPUStatus.IN_USE],
  PRICING: {
    [GPUModel.NVIDIA_A100]: 4.50,
    [GPUModel.NVIDIA_V100]: 2.75
  },
  TEMPERATURE_THRESHOLDS: {
    MIN_CELSIUS: 30,
    MAX_CELSIUS: 85,
    WARNING_CELSIUS: 75
  }
} as const;

/**
 * Metrics collection and monitoring configuration
 */
export const METRICS_CONFIG = {
  UPDATE_INTERVAL_MS: 5000,
  RETENTION_DAYS: 90,
  DEFAULT_TIME_RANGE: MetricsTimeRange.LAST_HOUR,
  CHART_REFRESH_MS: 10000,
  MAX_DATA_POINTS: 1000,
  AGGREGATION_INTERVALS: {
    [MetricsTimeRange.LAST_HOUR]: '1m',
    [MetricsTimeRange.LAST_DAY]: '5m',
    [MetricsTimeRange.LAST_WEEK]: '1h',
    [MetricsTimeRange.LAST_MONTH]: '6h'
  }
} as const;

/**
 * Environmental impact tracking configuration
 */
export const ENVIRONMENTAL_CONFIG = {
  CO2_CAPTURE_THRESHOLDS: {
    MIN_RATE_KG_PER_DAY: 50,
    TARGET_RATE_KG_PER_DAY: 100,
    ALERT_THRESHOLD_KG_PER_DAY: 25
  },
  EFFECTIVENESS_RATIOS: {
    TARGET_PUE: 1.2,
    MAX_PUE: 1.5,
    TARGET_WUE: 1.5,
    MAX_WUE: 2.0,
    TARGET_CUE: 0.7,
    MAX_CUE: 1.0
  },
  MEASUREMENT_UNITS: {
    CARBON_CAPTURE: 'kg/day',
    POWER_CONSUMPTION: 'kWh',
    WATER_USAGE: 'L/kWh',
    TEMPERATURE: '°C'
  },
  RETENTION_DAYS: 365
} as const;

/**
 * User interface configuration
 */
export const UI_CONFIG = {
  LOCALE: 'en-US',
  TIMEZONE: 'UTC',
  DATE_FORMAT: 'YYYY-MM-DD HH:mm:ss z',
  CURRENCY: 'USD',
  THEME: {
    DARK_MODE_DEFAULT: false,
    COLOR_SCHEME: {
      PRIMARY: '#0066CC',
      SECONDARY: '#666666',
      SUCCESS: '#33CC33',
      WARNING: '#FFCC00',
      ERROR: '#FF3300'
    }
  },
  PAGINATION: {
    DEFAULT_PAGE_SIZE: 10,
    MAX_PAGE_SIZE: 100
  }
} as const;

/**
 * File upload and storage configuration
 */
export const STORAGE_CONFIG = {
  MAX_FILE_SIZE_MB: 100,
  ALLOWED_EXTENSIONS: ['.ipynb', '.py', '.sh', '.env'],
  UPLOAD_CHUNK_SIZE_MB: 5,
  MAX_CONCURRENT_UPLOADS: 3
} as const;

/**
 * Session and security configuration
 */
export const SECURITY_CONFIG = {
  SESSION_TIMEOUT_MIN: 60,
  MAX_LOGIN_ATTEMPTS: 5,
  PASSWORD_REQUIREMENTS: {
    MIN_LENGTH: 12,
    REQUIRE_UPPERCASE: true,
    REQUIRE_LOWERCASE: true,
    REQUIRE_NUMBERS: true,
    REQUIRE_SPECIAL: true
  },
  JWT_REFRESH_THRESHOLD_MIN: 5
} as const;

/**
 * Feature flags and toggles
 */
export const FEATURES = {
  ENABLE_DARK_MODE: true,
  ENABLE_METRICS_EXPORT: true,
  ENABLE_AUTO_RENEWAL: true,
  ENABLE_JUPYTER_INTEGRATION: true,
  ENABLE_DOCKER_SUPPORT: true,
  ENABLE_SSH_ACCESS: true,
  ENABLE_CARBON_TRACKING: true
} as const;

/**
 * Error messages and codes
 */
export const ERROR_CONSTANTS = {
  CODES: {
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    RATE_LIMITED: 429,
    SERVER_ERROR: 500
  },
  MESSAGES: {
    DEFAULT: 'An unexpected error occurred',
    NETWORK_ERROR: 'Unable to connect to server',
    SESSION_EXPIRED: 'Your session has expired',
    RATE_LIMITED: 'Too many requests, please try again later'
  }
} as const;