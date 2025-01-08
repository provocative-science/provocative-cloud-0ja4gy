/**
 * Core date manipulation and validation utilities for Provocative Cloud
 * Provides UTC-based calculations with local time zone display support
 * @version 1.0.0
 */

import {
  addHours,
  subHours,
  isAfter,
  isBefore,
  parseISO,
  differenceInHours,
  startOfHour,
  endOfHour,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
} from 'date-fns'; // v2.30.0
import { DateRange, Timestamp } from '../types/common';

// Constants for business rules and validation
const MIN_RENTAL_HOURS = 1;
const MAX_RENTAL_HOURS = 720; // 30 days
const BUSINESS_HOURS = {
  start: 9,
  end: 17,
} as const;
const TIMEZONE_DEFAULT = 'UTC';

/**
 * Gets current Unix timestamp in milliseconds with UTC timezone handling
 * @returns {number} Current Unix timestamp in UTC
 */
export function getCurrentTimestamp(): Timestamp {
  return Date.now() as Timestamp;
}

/**
 * Creates a DateRange object from start and end timestamps with validation
 * @param {number} startDate - Start timestamp in milliseconds
 * @param {number} endDate - End timestamp in milliseconds
 * @returns {DateRange} Validated date range object
 * @throws {Error} If timestamps are invalid or in wrong order
 */
export function createDateRange(startDate: number, endDate: number): DateRange {
  if (!startDate || !endDate) {
    throw new Error('Start and end dates are required');
  }

  if (endDate < startDate) {
    throw new Error('End date must be after start date');
  }

  return {
    startDate: startDate as Timestamp,
    endDate: endDate as Timestamp,
    inclusive: true,
  };
}

/**
 * Calculates rental period with enhanced validation and business rules
 * @param {number} durationHours - Requested rental duration in hours
 * @returns {DateRange} Validated rental period date range
 * @throws {Error} If duration violates business rules
 */
export function calculateRentalPeriod(durationHours: number): DateRange {
  if (durationHours < MIN_RENTAL_HOURS) {
    throw new Error(`Minimum rental period is ${MIN_RENTAL_HOURS} hour`);
  }

  if (durationHours > MAX_RENTAL_HOURS) {
    throw new Error(`Maximum rental period is ${MAX_RENTAL_HOURS} hours`);
  }

  const now = new Date();
  const startTime = startOfHour(now);
  const endTime = addHours(startTime, durationHours);

  // Validate business hours
  const startHour = startTime.getUTCHours();
  const endHour = endTime.getUTCHours();

  if (
    startHour < BUSINESS_HOURS.start ||
    startHour >= BUSINESS_HOURS.end ||
    endHour < BUSINESS_HOURS.start ||
    endHour >= BUSINESS_HOURS.end
  ) {
    throw new Error('Rental must be within business hours');
  }

  return createDateRange(startTime.getTime(), endTime.getTime());
}

/**
 * Gets date range for metrics with environmental reporting support
 * @param {string} period - Time period ('hour', 'day', 'week', 'month')
 * @returns {DateRange} Metrics collection period date range
 * @throws {Error} If period type is invalid
 */
export function getMetricsTimeRange(period: string): DateRange {
  const now = new Date();
  let startTime: Date;
  let endTime: Date;

  switch (period) {
    case 'hour':
      startTime = startOfHour(now);
      endTime = endOfHour(now);
      break;
    case 'day':
      startTime = startOfDay(now);
      endTime = endOfDay(now);
      break;
    case 'week':
      startTime = startOfWeek(now);
      endTime = endOfWeek(now);
      break;
    case 'month':
      startTime = startOfMonth(now);
      endTime = endOfMonth(now);
      break;
    default:
      throw new Error('Invalid metrics period');
  }

  return createDateRange(startTime.getTime(), endTime.getTime());
}

/**
 * Validates date range with comprehensive business rules
 * @param {DateRange} range - Date range to validate
 * @returns {boolean} True if range is valid
 */
export function validateDateRange(range: DateRange): boolean {
  if (!range.startDate || !range.endDate) {
    return false;
  }

  const startDate = new Date(range.startDate);
  const endDate = new Date(range.endDate);

  // Validate chronological order
  if (isAfter(startDate, endDate)) {
    return false;
  }

  // Validate business hours
  const startHour = startDate.getUTCHours();
  const endHour = endDate.getUTCHours();

  if (
    startHour < BUSINESS_HOURS.start ||
    startHour >= BUSINESS_HOURS.end ||
    endHour < BUSINESS_HOURS.start ||
    endHour >= BUSINESS_HOURS.end
  ) {
    return false;
  }

  // Validate rental period limits
  const duration = calculateDurationHours(range.startDate, range.endDate);
  if (duration < MIN_RENTAL_HOURS || duration > MAX_RENTAL_HOURS) {
    return false;
  }

  return true;
}

/**
 * Calculates precise duration in hours between timestamps
 * @param {number} startTimestamp - Start timestamp in milliseconds
 * @param {number} endTimestamp - End timestamp in milliseconds
 * @returns {number} Duration in hours with decimal precision
 * @throws {Error} If timestamps are invalid
 */
export function calculateDurationHours(
  startTimestamp: number,
  endTimestamp: number
): number {
  if (!startTimestamp || !endTimestamp) {
    throw new Error('Start and end timestamps are required');
  }

  const startDate = new Date(startTimestamp);
  const endDate = new Date(endTimestamp);

  if (isAfter(startDate, endDate)) {
    throw new Error('Start date must be before end date');
  }

  // Calculate difference with precision handling
  const diffHours = differenceInHours(endDate, startDate);
  const diffMillis = endDate.getTime() - startDate.getTime();
  const fractionalHours = (diffMillis % (60 * 60 * 1000)) / (60 * 60 * 1000);

  return Number((diffHours + fractionalHours).toFixed(2));
}