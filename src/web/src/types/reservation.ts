/**
 * TypeScript type definitions for GPU reservation management
 * Provides type-safe interfaces for creating, updating, and tracking GPU rentals
 * @version 1.0.0
 */

import { UUID, Timestamp } from './common';
import { GPU } from './gpu';
import { GPUMetrics } from './metrics';

/**
 * Enum for reservation status with strict state transitions
 */
export enum ReservationStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  FAILED = 'failed'
}

/**
 * Enum for deployment status with validated state transitions
 */
export enum DeploymentStatus {
  PENDING = 'pending',
  PROVISIONING = 'provisioning',
  READY = 'ready',
  ERROR = 'error'
}

/**
 * Main interface for GPU reservations with cost and environmental impact tracking
 */
export interface Reservation {
  readonly id: UUID;
  readonly user_id: UUID;
  readonly gpu_id: UUID;
  readonly start_time: Timestamp;
  readonly end_time: Timestamp;
  /**
   * Flag for automatic renewal of reservation
   */
  readonly auto_renew: boolean;
  readonly status: ReservationStatus;
  readonly created_at: Timestamp;
  /**
   * Total cost of reservation in USD
   * @precision 2 decimal places
   */
  readonly total_cost: number;
  /**
   * Amount of CO2 captured during reservation in kg
   * @precision 2 decimal places
   */
  readonly carbon_offset: number;
}

/**
 * Interface for creating new reservations with deployment preferences
 */
export interface ReservationCreate {
  readonly user_id: UUID;
  readonly gpu_id: UUID;
  readonly start_time: Timestamp;
  /**
   * Duration of reservation in hours
   * @minimum MIN_RENTAL_HOURS
   * @maximum MAX_RENTAL_HOURS
   */
  readonly duration_hours: number;
  readonly auto_renew: boolean;
  /**
   * Type of deployment environment requested
   */
  readonly deployment_type: 'ssh' | 'jupyter' | 'docker';
}

/**
 * Interface for detailed reservation information including GPU and deployment details
 */
export interface ReservationDetails {
  readonly reservation: Reservation;
  readonly gpu: GPU;
  readonly deployment_status: DeploymentStatus;
  /**
   * SSH connection string if deployment_type is 'ssh'
   */
  readonly ssh_connection_string: string | null;
  /**
   * Jupyter notebook URL if deployment_type is 'jupyter'
   */
  readonly jupyter_url: string | null;
  /**
   * Real-time GPU performance metrics
   */
  readonly metrics: GPUMetrics;
  /**
   * Deployment progress and error logs
   */
  readonly deployment_logs: string[];
}

/**
 * Global constants for reservation management
 */
export const MIN_RENTAL_HOURS = 1;
export const MAX_RENTAL_HOURS = 720; // 30 days
export const DEPLOYMENT_TIMEOUT_SECONDS = 300;
export const AUTO_RENEW_THRESHOLD_HOURS = 2;

/**
 * Type guard to validate reservation creation parameters
 */
export function isValidReservationCreate(params: unknown): params is ReservationCreate {
  if (!params || typeof params !== 'object') {
    return false;
  }

  const p = params as ReservationCreate;

  return (
    typeof p.user_id === 'string' &&
    typeof p.gpu_id === 'string' &&
    typeof p.start_time === 'number' &&
    typeof p.duration_hours === 'number' &&
    p.duration_hours >= MIN_RENTAL_HOURS &&
    p.duration_hours <= MAX_RENTAL_HOURS &&
    typeof p.auto_renew === 'boolean' &&
    ['ssh', 'jupyter', 'docker'].includes(p.deployment_type)
  );
}

/**
 * Type guard to validate reservation status transitions
 */
export function isValidStatusTransition(
  currentStatus: ReservationStatus,
  newStatus: ReservationStatus
): boolean {
  const validTransitions: Record<ReservationStatus, ReservationStatus[]> = {
    [ReservationStatus.PENDING]: [
      ReservationStatus.ACTIVE,
      ReservationStatus.FAILED,
      ReservationStatus.CANCELLED
    ],
    [ReservationStatus.ACTIVE]: [
      ReservationStatus.COMPLETED,
      ReservationStatus.CANCELLED,
      ReservationStatus.FAILED
    ],
    [ReservationStatus.COMPLETED]: [],
    [ReservationStatus.CANCELLED]: [],
    [ReservationStatus.FAILED]: []
  };

  return validTransitions[currentStatus]?.includes(newStatus) ?? false;
}

/**
 * Type guard to validate deployment status transitions
 */
export function isValidDeploymentTransition(
  currentStatus: DeploymentStatus,
  newStatus: DeploymentStatus
): boolean {
  const validTransitions: Record<DeploymentStatus, DeploymentStatus[]> = {
    [DeploymentStatus.PENDING]: [
      DeploymentStatus.PROVISIONING,
      DeploymentStatus.ERROR
    ],
    [DeploymentStatus.PROVISIONING]: [
      DeploymentStatus.READY,
      DeploymentStatus.ERROR
    ],
    [DeploymentStatus.READY]: [
      DeploymentStatus.ERROR
    ],
    [DeploymentStatus.ERROR]: [
      DeploymentStatus.PENDING
    ]
  };

  return validTransitions[currentStatus]?.includes(newStatus) ?? false;
}