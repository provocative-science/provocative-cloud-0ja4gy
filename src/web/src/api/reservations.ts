/**
 * API client module for managing GPU reservations in the Provocative Cloud platform
 * Provides comprehensive functions for creating, updating, retrieving, and canceling GPU rentals
 * @version 1.0.0
 */

import { get, post, put, del } from '../utils/api';
import { API_ENDPOINTS } from '../config/api';
import { 
  Reservation,
  ReservationCreate,
  ReservationDetails,
  ReservationStatus,
  DeploymentStatus,
  MIN_RENTAL_HOURS,
  MAX_RENTAL_HOURS,
  isValidReservationCreate,
  isValidStatusTransition
} from '../types/reservation';
import { ApiResponse, PaginatedResponse } from '../types/common';
import { GPU_CONSTANTS } from '../config/constants';

/**
 * Creates a new GPU reservation with comprehensive validation and deployment configuration
 * @param data Reservation creation parameters
 * @returns Promise resolving to created reservation details
 */
export async function createReservation(
  data: ReservationCreate
): Promise<ApiResponse<ReservationDetails>> {
  // Validate rental duration
  if (data.duration_hours < MIN_RENTAL_HOURS || data.duration_hours > MAX_RENTAL_HOURS) {
    throw new Error(
      `Rental duration must be between ${MIN_RENTAL_HOURS} and ${MAX_RENTAL_HOURS} hours`
    );
  }

  // Validate reservation parameters
  if (!isValidReservationCreate(data)) {
    throw new Error('Invalid reservation parameters');
  }

  // Calculate end time based on duration
  const endTime = data.start_time + (data.duration_hours * 3600 * 1000);

  const createData = {
    ...data,
    end_time: endTime
  };

  return post<ReservationDetails>(API_ENDPOINTS.RESERVATION.CREATE, createData);
}

/**
 * Retrieves detailed reservation information including real-time metrics and deployment status
 * @param id Reservation identifier
 * @returns Promise resolving to detailed reservation information
 */
export async function getReservation(
  id: string
): Promise<ApiResponse<ReservationDetails>> {
  return get<ReservationDetails>(`${API_ENDPOINTS.RESERVATION.DETAILS(id)}`);
}

/**
 * Retrieves paginated list of reservations with advanced filtering and sorting
 * @param filters Optional filtering and pagination parameters
 * @returns Promise resolving to paginated reservation list
 */
export async function listReservations(
  filters: {
    status?: ReservationStatus[];
    startDate?: number;
    endDate?: number;
    deploymentType?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  } = {}
): Promise<PaginatedResponse<Reservation>> {
  const queryParams = new URLSearchParams();

  // Add optional filters to query parameters
  if (filters.status?.length) {
    queryParams.append('status', filters.status.join(','));
  }
  if (filters.startDate) {
    queryParams.append('startDate', filters.startDate.toString());
  }
  if (filters.endDate) {
    queryParams.append('endDate', filters.endDate.toString());
  }
  if (filters.deploymentType) {
    queryParams.append('deploymentType', filters.deploymentType);
  }

  // Add pagination parameters
  queryParams.append('page', (filters.page || 1).toString());
  queryParams.append('limit', (filters.limit || GPU_CONSTANTS.DEFAULT_PAGE_SIZE).toString());

  // Add sorting parameters
  if (filters.sortBy) {
    queryParams.append('sortBy', filters.sortBy);
    queryParams.append('sortOrder', filters.sortOrder || 'desc');
  }

  return get<PaginatedResponse<Reservation>>(
    `${API_ENDPOINTS.RESERVATION.LIST}?${queryParams.toString()}`
  );
}

/**
 * Updates reservation with enhanced validation and state transition checks
 * @param id Reservation identifier
 * @param data Update parameters
 * @returns Promise resolving to updated reservation details
 */
export async function updateReservation(
  id: string,
  data: {
    duration_hours?: number;
    auto_renew?: boolean;
    deployment_config?: object;
  }
): Promise<ApiResponse<ReservationDetails>> {
  // Validate duration if provided
  if (data.duration_hours !== undefined) {
    if (data.duration_hours < MIN_RENTAL_HOURS || data.duration_hours > MAX_RENTAL_HOURS) {
      throw new Error(
        `Rental duration must be between ${MIN_RENTAL_HOURS} and ${MAX_RENTAL_HOURS} hours`
      );
    }
  }

  return put<ReservationDetails>(
    API_ENDPOINTS.RESERVATION.DETAILS(id),
    data
  );
}

/**
 * Cancels reservation with graceful shutdown and resource cleanup
 * @param id Reservation identifier
 * @returns Promise resolving to cancellation confirmation
 */
export async function cancelReservation(
  id: string
): Promise<ApiResponse<void>> {
  return del<void>(API_ENDPOINTS.RESERVATION.CANCEL(id));
}

/**
 * Validates if a reservation can transition to a new status
 * @param currentStatus Current reservation status
 * @param newStatus Desired new status
 * @returns boolean indicating if transition is valid
 */
export function validateStatusTransition(
  currentStatus: ReservationStatus,
  newStatus: ReservationStatus
): boolean {
  return isValidStatusTransition(currentStatus, newStatus);
}