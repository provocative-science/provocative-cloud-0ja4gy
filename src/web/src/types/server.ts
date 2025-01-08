/**
 * TypeScript type definitions for server-related data structures
 * Provides type-safe interfaces for server management, monitoring, and configuration
 * @version 1.0.0
 */

import { UUID, Timestamp } from './common';
import { GPU, GPUStatus } from './gpu';
import { SystemMetrics } from './metrics';

/**
 * Enum representing possible server operational states
 */
export enum ServerStatus {
  ONLINE = 'online',
  OFFLINE = 'offline',
  MAINTENANCE = 'maintenance',
  ERROR = 'error'
}

/**
 * Interface for tracking server maintenance activities
 */
export interface MaintenanceRecord {
  readonly id: UUID;
  readonly startTime: Timestamp;
  readonly endTime: Timestamp;
  readonly type: string;
  readonly description: string;
  readonly status: string;
}

/**
 * Interface for environmental impact metrics
 */
export interface CarbonMetrics {
  /**
   * Total CO2 captured in kilograms
   * @precision 2 decimal places
   */
  readonly co2CapturedKg: number;
  /**
   * Power Usage Effectiveness ratio
   * @range 1.0-2.0
   */
  readonly powerUsageEffectiveness: number;
  /**
   * Carbon Usage Effectiveness ratio
   * @constraint non-negative
   */
  readonly carbonUsageEffectiveness: number;
  /**
   * Water Usage Effectiveness ratio
   * @constraint non-negative
   */
  readonly waterUsageEffectiveness: number;
}

/**
 * Interface for server hardware specifications
 */
export interface ServerSpecification {
  readonly hostname: string;
  readonly ipAddress: string;
  /**
   * Number of CPU cores available
   * @constraint positive integer
   */
  readonly cpuCores: number;
  /**
   * Total system memory in gigabytes
   * @constraint positive number
   */
  readonly memoryGb: number;
  /**
   * Total storage capacity in gigabytes
   * @constraint positive number
   */
  readonly storageGb: number;
  /**
   * Network bandwidth in gigabits per second
   * @constraint positive number
   */
  readonly networkBandwidthGbps: number;
}

/**
 * Main interface for server resource data
 */
export interface Server {
  readonly id: UUID;
  readonly specifications: ServerSpecification;
  readonly status: ServerStatus;
  readonly gpus: GPU[];
  readonly metrics: SystemMetrics;
  readonly maintenanceMode: boolean;
  readonly region: string;
  readonly maintenanceHistory: MaintenanceRecord[];
  /**
   * Overall server performance score
   * @range 0-100
   */
  readonly performanceScore: number;
  readonly carbonMetrics: CarbonMetrics;
  readonly lastHeartbeat: Timestamp;
  readonly createdAt: Timestamp;
}

/**
 * Interface for advanced server search/filter parameters
 */
export interface ServerFilter {
  readonly status?: ServerStatus[];
  readonly hasAvailableGPUs?: boolean;
  /**
   * Minimum number of GPUs required
   * @default DEFAULT_MIN_GPU_COUNT
   */
  readonly minGpuCount?: number;
  readonly region?: string;
  readonly datacenterLocation?: string;
  readonly maintenanceScheduled?: boolean;
  /**
   * Minimum performance score threshold
   * @range 0-100
   */
  readonly performanceThreshold?: number;
  /**
   * Time window in milliseconds for last activity
   */
  readonly lastActiveWithin?: number;
}

/**
 * Global constants for server management
 */
export const HEARTBEAT_TIMEOUT_MS = 30000;
export const DEFAULT_MIN_GPU_COUNT = 1;
export const MAINTENANCE_HISTORY_RETENTION_DAYS = 365;
export const MIN_PERFORMANCE_THRESHOLD = 0;
export const MAX_PERFORMANCE_THRESHOLD = 100;