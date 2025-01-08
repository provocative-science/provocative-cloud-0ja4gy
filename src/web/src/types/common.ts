/**
 * Core TypeScript type definitions and interfaces for Provocative Cloud frontend
 * Provides type safety for API interactions, data management, and error handling
 * @version 1.0.0
 */

/**
 * Branded type for UUID strings ensuring type-safe identifier handling
 * Implements RFC 4122 UUID v4 standard
 */
export type UUID = string & { readonly _brand: unique symbol };

/**
 * Branded type for Unix timestamp values with millisecond precision
 * Ensures type-safe handling of temporal data
 */
export type Timestamp = number & { readonly _brand: unique symbol };

/**
 * Generic interface for standardized API responses
 * @template T The type of data contained in the response
 */
export interface ApiResponse<T> {
  readonly data: T;
  readonly success: boolean;
  readonly message: string;
  readonly timestamp: Timestamp;
}

/**
 * Generic interface for paginated API responses with metadata
 * @template T The type of items in the data array
 */
export interface PaginatedResponse<T> {
  readonly data: readonly T[];
  readonly total: number;
  readonly page: number;
  readonly limit: number;
  readonly hasMore: boolean;
}

/**
 * Comprehensive interface for API error responses
 * Provides detailed context for error handling and debugging
 */
export interface ApiError {
  readonly code: number;
  readonly message: string;
  readonly details: Record<string, unknown>;
  readonly timestamp: Timestamp;
  readonly path: string;
}

/**
 * String literal union type for sort direction in queries
 */
export enum SortDirection {
  ASC = 'asc',
  DESC = 'desc'
}

/**
 * Interface for standardized pagination and sorting parameters
 * Used for consistent data fetching across the application
 */
export interface PaginationParams {
  readonly page: number;
  readonly limit: number;
  readonly sortBy: string;
  readonly sortDirection: SortDirection;
  readonly filters: Record<string, unknown>;
}

/**
 * Interface for date range selections with inclusivity option
 */
export interface DateRange {
  readonly startDate: Timestamp;
  readonly endDate: Timestamp;
  readonly inclusive: boolean;
}

/**
 * Global constants for pagination and date boundaries
 */
export const DEFAULT_PAGE_SIZE = 10;
export const MAX_PAGE_SIZE = 100;
export const DEFAULT_SORT_DIRECTION = SortDirection.DESC;
export const MIN_DATE = 0;
export const MAX_DATE = 8640000000000000; // Maximum safe JavaScript timestamp

/**
 * Type guard function to validate UUID strings
 * Implements RFC 4122 UUID v4 validation
 * @param value The string to validate
 * @returns boolean indicating if the string is a valid UUID v4
 */
export function isUUID(value: string): value is UUID {
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return typeof value === 'string' && UUID_REGEX.test(value);
}

/**
 * Type guard function to validate DateRange objects
 * Ensures temporal boundaries and logical consistency
 * @param range The object to validate
 * @returns boolean indicating if the range is valid
 */
export function isValidDateRange(range: unknown): range is DateRange {
  if (!range || typeof range !== 'object') {
    return false;
  }

  const { startDate, endDate, inclusive } = range as DateRange;

  if (
    typeof startDate !== 'number' ||
    typeof endDate !== 'number' ||
    typeof inclusive !== 'boolean'
  ) {
    return false;
  }

  if (startDate < MIN_DATE || endDate > MAX_DATE) {
    return false;
  }

  if (inclusive) {
    return startDate <= endDate;
  }

  return startDate < endDate;
}