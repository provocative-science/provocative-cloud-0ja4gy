/**
 * Utility functions for formatting various data types in the Provocative Cloud web application
 * Provides standardized formatting across the application with localization support
 * @version 1.0.0
 */

import { format, formatDistance } from 'date-fns'; // v2.30.0
import { Currency } from '../types/billing';
import { GPUMetrics } from '../types/metrics';
import { DEFAULT_LOCALE } from '../config/constants';

/**
 * Formats a number as a currency string with the specified currency symbol
 * @param amount The amount to format
 * @param currency The currency to use for formatting
 * @returns Formatted currency string with appropriate symbol and decimal places
 */
export const formatCurrency = (amount: number, currency: Currency): string => {
  const formatter = new Intl.NumberFormat(DEFAULT_LOCALE, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return formatter.format(amount);
};

/**
 * Formats a temperature value in Celsius with unit symbol
 * @param celsius Temperature value in Celsius
 * @returns Formatted temperature string with Celsius symbol
 */
export const formatTemperature = (celsius: number): string => {
  const roundedTemp = Math.round(celsius);
  return `${roundedTemp}°C`;
};

/**
 * Formats power usage in watts with unit symbol
 * @param watts Power usage in watts
 * @returns Formatted power string with watt symbol
 */
export const formatPower = (watts: number): string => {
  const roundedWatts = Math.round(watts);
  return `${roundedWatts}W`;
};

/**
 * Formats memory size in gigabytes with unit symbol
 * @param gigabytes Memory size in gigabytes
 * @returns Formatted memory string with gigabyte unit
 */
export const formatMemory = (gigabytes: number): string => {
  const roundedGB = Number(gigabytes.toFixed(1));
  return `${roundedGB}GB`;
};

/**
 * Formats a decimal value as a percentage string
 * @param value Decimal value to convert to percentage
 * @returns Formatted percentage string with symbol
 */
export const formatPercentage = (value: number): string => {
  const percentage = Math.round(value * 100);
  return `${percentage}%`;
};

/**
 * Formats a timestamp into a localized date and time string
 * @param timestamp Unix timestamp in milliseconds
 * @returns Formatted date/time string according to locale
 */
export const formatDateTime = (timestamp: number): string => {
  const date = new Date(timestamp);
  return format(date, 'PPpp', { locale: DEFAULT_LOCALE });
};

/**
 * Formats a timestamp into a relative time string
 * @param timestamp Unix timestamp in milliseconds
 * @returns Relative time string (e.g., "2 hours ago")
 */
export const formatTimeAgo = (timestamp: number): string => {
  const date = new Date(timestamp);
  return formatDistance(date, new Date(), { addSuffix: true });
};

/**
 * Formats carbon capture amount in kilograms with CO₂ unit
 * @param kilograms Amount of CO₂ captured in kilograms
 * @returns Formatted carbon capture string with CO₂ unit
 */
export const formatCarbonCapture = (kilograms: number): string => {
  const roundedKg = Number(kilograms.toFixed(2));
  return `${roundedKg}kg CO₂`;
};

/**
 * Formats GPU metrics into a standardized string representation
 * @param metrics GPU metrics object
 * @returns Object containing formatted metric strings
 */
export const formatGPUMetrics = (metrics: GPUMetrics): {
  temperature: string;
  power: string;
  memory: string;
  utilization: string;
} => {
  return {
    temperature: formatTemperature(metrics.temperatureCelsius),
    power: formatPower(metrics.powerUsageWatts),
    memory: formatMemory(metrics.memoryUsedGb),
    utilization: formatPercentage(metrics.utilizationPercent / 100)
  };
};