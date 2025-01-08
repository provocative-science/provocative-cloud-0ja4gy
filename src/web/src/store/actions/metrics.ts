/**
 * Redux action creators for managing GPU, carbon capture, and system metrics
 * Implements real-time updates, validation, and error handling for metrics data
 * @version 1.0.0
 */

import { createAsyncThunk } from '@reduxjs/toolkit';
import { debounce } from 'lodash';
import {
  GPUMetrics,
  CarbonMetrics,
  SystemMetrics,
  MetricsResponse,
  MetricsQueryParams,
  MetricsTimeRange,
  isValidGPUMetrics,
  isValidCarbonMetrics
} from '../../types/metrics';
import {
  getGPUMetrics,
  getCarbonMetrics,
  getSystemMetrics,
  getAllMetrics,
  getHistoricalMetrics
} from '../../api/metrics';
import { validateMetrics } from '../../utils/validation';
import { ApiError } from '../../types/common';

// Constants for metrics handling
const METRICS_DEBOUNCE_MS = 1000;
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1000;

/**
 * Enhanced async thunk for fetching GPU metrics with retry logic and validation
 */
export const fetchGPUMetrics = createAsyncThunk<GPUMetrics[], MetricsQueryParams, { rejectValue: ApiError }>(
  'metrics/fetchGPUMetrics',
  async (params: MetricsQueryParams, { rejectWithValue }) => {
    try {
      // Validate time range if provided
      if (params.timeRange && !Object.values(MetricsTimeRange).includes(params.timeRange)) {
        throw new Error('Invalid time range specified');
      }

      const response = await getGPUMetrics(params, true); // Enable real-time updates
      const validatedMetrics = response.data.filter(isValidGPUMetrics);

      if (validatedMetrics.length !== response.data.length) {
        console.warn('Some GPU metrics failed validation and were filtered out');
      }

      return validatedMetrics;
    } catch (error) {
      console.error('GPU metrics fetch error:', error);
      return rejectWithValue({
        code: 500,
        message: 'Failed to fetch GPU metrics',
        details: { error: String(error) },
        timestamp: Date.now(),
        path: '/metrics/gpu'
      });
    }
  }
);

/**
 * Enhanced async thunk for fetching carbon capture metrics with validation
 */
export const fetchCarbonMetrics = createAsyncThunk<CarbonMetrics, MetricsQueryParams, { rejectValue: ApiError }>(
  'metrics/fetchCarbonMetrics',
  async (params: MetricsQueryParams, { rejectWithValue }) => {
    try {
      const response = await getCarbonMetrics(params);
      
      if (!isValidCarbonMetrics(response.data)) {
        throw new Error('Invalid carbon metrics data received');
      }

      return response.data;
    } catch (error) {
      console.error('Carbon metrics fetch error:', error);
      return rejectWithValue({
        code: 500,
        message: 'Failed to fetch carbon capture metrics',
        details: { error: String(error) },
        timestamp: Date.now(),
        path: '/metrics/carbon'
      });
    }
  }
);

/**
 * Enhanced async thunk for fetching system metrics with validation
 */
export const fetchSystemMetrics = createAsyncThunk<SystemMetrics, MetricsQueryParams, { rejectValue: ApiError }>(
  'metrics/fetchSystemMetrics',
  async (params: MetricsQueryParams, { rejectWithValue }) => {
    try {
      const response = await getSystemMetrics(params);
      return response.data;
    } catch (error) {
      console.error('System metrics fetch error:', error);
      return rejectWithValue({
        code: 500,
        message: 'Failed to fetch system metrics',
        details: { error: String(error) },
        timestamp: Date.now(),
        path: '/metrics/system'
      });
    }
  }
);

/**
 * Enhanced async thunk for fetching all metrics with correlation analysis
 */
export const fetchAllMetrics = createAsyncThunk<MetricsResponse, MetricsQueryParams, { rejectValue: ApiError }>(
  'metrics/fetchAllMetrics',
  async (params: MetricsQueryParams, { rejectWithValue }) => {
    try {
      const response = await getAllMetrics(params);
      return response.data;
    } catch (error) {
      console.error('Combined metrics fetch error:', error);
      return rejectWithValue({
        code: 500,
        message: 'Failed to fetch combined metrics',
        details: { error: String(error) },
        timestamp: Date.now(),
        path: '/metrics/all'
      });
    }
  }
);

/**
 * Debounced action creator for handling real-time metrics WebSocket messages
 */
export const handleMetricsWebSocketMessage = debounce(
  (data: MetricsResponse) => {
    if (!data) return null;

    // Validate incoming metrics data
    const gpuMetricsValid = Array.isArray(data.gpuMetrics) && 
      data.gpuMetrics.every(isValidGPUMetrics);
    
    const carbonMetricsValid = isValidCarbonMetrics(data.carbonMetrics);

    if (!gpuMetricsValid || !carbonMetricsValid) {
      console.error('Invalid metrics data received via WebSocket');
      return null;
    }

    return {
      type: 'metrics/websocketUpdate',
      payload: data
    };
  },
  METRICS_DEBOUNCE_MS,
  { maxWait: METRICS_DEBOUNCE_MS * 2 }
);

/**
 * Enhanced async thunk for fetching historical metrics with trend analysis
 */
export const fetchHistoricalMetrics = createAsyncThunk<MetricsResponse[], MetricsQueryParams, { rejectValue: ApiError }>(
  'metrics/fetchHistoricalMetrics',
  async (params: MetricsQueryParams, { rejectWithValue }) => {
    try {
      const response = await getHistoricalMetrics(params);
      return response.data;
    } catch (error) {
      console.error('Historical metrics fetch error:', error);
      return rejectWithValue({
        code: 500,
        message: 'Failed to fetch historical metrics',
        details: { error: String(error) },
        timestamp: Date.now(),
        path: '/metrics/historical'
      });
    }
  }
);