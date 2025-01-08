/**
 * TypeScript type definitions for GPU, carbon capture, and system metrics
 * Provides type-safe interfaces for real-time monitoring and historical data
 * @version 1.0.0
 */

import { UUID, Timestamp, ApiResponse, PaginatedResponse, DateRange } from './common';

/**
 * Time range options for metrics queries
 */
export enum MetricsTimeRange {
  LAST_HOUR = '1h',
  LAST_DAY = '24h',
  LAST_WEEK = '7d',
  LAST_MONTH = '30d',
  CUSTOM = 'custom'
}

/**
 * Interface for GPU performance metrics with validated ranges and precision
 */
export interface GPUMetrics {
  readonly id: UUID;
  readonly gpuId: UUID;
  /**
   * GPU temperature in Celsius
   * @range 0-120°C
   * @precision 1 decimal place
   */
  readonly temperatureCelsius: number;
  /**
   * GPU power consumption in Watts
   * @range 0-500W
   * @precision 1 decimal place
   */
  readonly powerUsageWatts: number;
  /**
   * GPU memory usage in gigabytes
   * @precision 2 decimal places
   */
  readonly memoryUsedGb: number;
  /**
   * Total GPU memory in gigabytes
   * @precision 2 decimal places
   */
  readonly memoryTotalGb: number;
  /**
   * GPU utilization percentage
   * @range 0-100
   * @precision 1 decimal place
   */
  readonly utilizationPercent: number;
  readonly timestamp: Timestamp;
}

/**
 * Interface for carbon capture and environmental metrics
 */
export interface CarbonMetrics {
  readonly id: UUID;
  /**
   * CO2 captured in kilograms
   * @precision 2 decimal places
   * @constraint non-negative
   */
  readonly co2CapturedKg: number;
  /**
   * Power Usage Effectiveness ratio
   * @range 1.0-2.0
   * @precision 3 decimal places
   */
  readonly powerUsageEffectiveness: number;
  /**
   * Carbon Usage Effectiveness ratio
   * @precision 3 decimal places
   * @constraint non-negative
   */
  readonly carbonUsageEffectiveness: number;
  /**
   * Water Usage Effectiveness ratio
   * @precision 3 decimal places
   * @constraint non-negative
   */
  readonly waterUsageEffectiveness: number;
  readonly timestamp: Timestamp;
}

/**
 * Interface for metrics query parameters
 */
export interface MetricsQueryParams {
  readonly timeRange?: MetricsTimeRange;
  readonly dateRange?: DateRange;
  readonly gpuId?: UUID;
  readonly serverId?: string;
}

/**
 * Type alias for paginated GPU metrics response
 */
export type PaginatedGPUMetrics = PaginatedResponse<GPUMetrics>;

/**
 * Type alias for paginated carbon metrics response
 */
export type PaginatedCarbonMetrics = PaginatedResponse<CarbonMetrics>;

/**
 * Type alias for GPU metrics API response
 */
export type GPUMetricsResponse = ApiResponse<GPUMetrics>;

/**
 * Type alias for carbon metrics API response
 */
export type CarbonMetricsResponse = ApiResponse<CarbonMetrics>;

/**
 * Type guard to validate GPU metrics data
 */
export function isValidGPUMetrics(metrics: unknown): metrics is GPUMetrics {
  if (!metrics || typeof metrics !== 'object') {
    return false;
  }

  const m = metrics as GPUMetrics;

  return (
    typeof m.temperatureCelsius === 'number' &&
    m.temperatureCelsius >= 0 &&
    m.temperatureCelsius <= 120 &&
    typeof m.powerUsageWatts === 'number' &&
    m.powerUsageWatts >= 0 &&
    m.powerUsageWatts <= 500 &&
    typeof m.memoryUsedGb === 'number' &&
    m.memoryUsedGb >= 0 &&
    typeof m.memoryTotalGb === 'number' &&
    m.memoryTotalGb >= 0 &&
    typeof m.utilizationPercent === 'number' &&
    m.utilizationPercent >= 0 &&
    m.utilizationPercent <= 100
  );
}

/**
 * Type guard to validate carbon metrics data
 */
export function isValidCarbonMetrics(metrics: unknown): metrics is CarbonMetrics {
  if (!metrics || typeof metrics !== 'object') {
    return false;
  }

  const m = metrics as CarbonMetrics;

  return (
    typeof m.co2CapturedKg === 'number' &&
    m.co2CapturedKg >= 0 &&
    typeof m.powerUsageEffectiveness === 'number' &&
    m.powerUsageEffectiveness >= 1.0 &&
    m.powerUsageEffectiveness <= 2.0 &&
    typeof m.carbonUsageEffectiveness === 'number' &&
    m.carbonUsageEffectiveness >= 0 &&
    typeof m.waterUsageEffectiveness === 'number' &&
    m.waterUsageEffectiveness >= 0
  );
}