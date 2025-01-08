/**
 * TypeScript type definitions for GPU resource management
 * Provides type-safe interfaces for GPU specifications, rental management, and monitoring
 * @version 1.0.0
 */

import { UUID, Timestamp } from './common';
import { GPUMetrics } from './metrics';

/**
 * Supported GPU models with strict type checking
 */
export enum GPUModel {
  NVIDIA_A100 = 'NVIDIA A100',
  NVIDIA_V100 = 'NVIDIA V100'
}

/**
 * GPU availability and operational status
 */
export enum GPUStatus {
  AVAILABLE = 'available',
  RESERVED = 'reserved',
  IN_USE = 'in_use',
  MAINTENANCE = 'maintenance'
}

/**
 * Detailed GPU hardware specifications interface
 */
export interface GPUSpecification {
  readonly model: GPUModel;
  /**
   * GPU memory capacity in gigabytes
   * @minimum DEFAULT_MIN_VRAM
   */
  readonly vram_gb: number;
  /**
   * Number of CUDA cores available
   * @constraint positive integer
   */
  readonly cuda_cores: number;
  /**
   * Number of tensor cores for AI acceleration
   * @constraint positive integer
   */
  readonly tensor_cores: number;
  /**
   * Maximum power consumption in watts
   * @maximum MAX_POWER_WATTS
   */
  readonly max_power_watts: number;
}

/**
 * Comprehensive GPU resource interface including rental information
 */
export interface GPU {
  readonly id: UUID;
  readonly server_id: UUID;
  readonly specifications: GPUSpecification;
  readonly status: GPUStatus;
  /**
   * Hourly rental cost in USD
   * @precision 2 decimal places
   */
  readonly price_per_hour: number;
  /**
   * Current performance metrics
   */
  readonly metrics: GPUMetrics;
  /**
   * ID of current user if GPU is rented
   */
  readonly current_user_id: UUID | null;
  /**
   * Start time of current rental period
   */
  readonly rental_start: Timestamp | null;
  /**
   * End time of current rental period
   */
  readonly rental_end: Timestamp | null;
  /**
   * Last recorded activity timestamp
   */
  readonly last_active: Timestamp;
  /**
   * GPU resource creation timestamp
   */
  readonly created_at: Timestamp;
}

/**
 * Interface for GPU search and filtering parameters
 */
export interface GPUFilter {
  /**
   * Filter by specific GPU models
   */
  readonly model: GPUModel[];
  /**
   * Minimum required VRAM in gigabytes
   * @default DEFAULT_MIN_VRAM
   */
  readonly min_vram_gb: number;
  /**
   * Maximum price per hour in USD
   * @default DEFAULT_MAX_PRICE
   */
  readonly max_price_per_hour: number;
  /**
   * Filter by GPU status
   */
  readonly status: GPUStatus[];
}

/**
 * Global constants for GPU management
 */
export const DEFAULT_MIN_VRAM = 32;
export const DEFAULT_MAX_PRICE = 10.0;
export const MIN_TEMPERATURE_CELSIUS = 0;
export const MAX_TEMPERATURE_CELSIUS = 120;
export const MAX_POWER_WATTS = 500;

/**
 * Type guard to validate GPU specification
 */
export function isValidGPUSpecification(spec: unknown): spec is GPUSpecification {
  if (!spec || typeof spec !== 'object') {
    return false;
  }

  const s = spec as GPUSpecification;

  return (
    Object.values(GPUModel).includes(s.model) &&
    typeof s.vram_gb === 'number' &&
    s.vram_gb >= DEFAULT_MIN_VRAM &&
    typeof s.cuda_cores === 'number' &&
    s.cuda_cores > 0 &&
    typeof s.tensor_cores === 'number' &&
    s.tensor_cores > 0 &&
    typeof s.max_power_watts === 'number' &&
    s.max_power_watts > 0 &&
    s.max_power_watts <= MAX_POWER_WATTS
  );
}

/**
 * Type guard to validate GPU filter parameters
 */
export function isValidGPUFilter(filter: unknown): filter is GPUFilter {
  if (!filter || typeof filter !== 'object') {
    return false;
  }

  const f = filter as GPUFilter;

  return (
    Array.isArray(f.model) &&
    f.model.every(m => Object.values(GPUModel).includes(m)) &&
    typeof f.min_vram_gb === 'number' &&
    f.min_vram_gb >= 0 &&
    typeof f.max_price_per_hour === 'number' &&
    f.max_price_per_hour > 0 &&
    Array.isArray(f.status) &&
    f.status.every(s => Object.values(GPUStatus).includes(s))
  );
}