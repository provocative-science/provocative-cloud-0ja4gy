/**
 * TypeScript type definitions and interfaces for billing functionality
 * Provides type safety for payments, transactions, pricing, and invoices
 * @version 1.0.0
 */

import { UUID, Timestamp, ApiResponse, PaginatedResponse } from './common';

/**
 * Enum for payment status values with strict transition validation
 */
export enum PaymentStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED'
}

/**
 * Enum for transaction status values with state transition rules
 */
export enum TransactionStatus {
  PENDING = 'PENDING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED'
}

/**
 * Enum for supported currency types with precision rules
 */
export enum Currency {
  USD = 'USD',
  EUR = 'EUR',
  GBP = 'GBP'
}

/**
 * Configuration for currency-specific formatting and validation
 */
export interface CurrencyConfig {
  readonly currency: Currency;
  readonly decimalPlaces: number;
  readonly symbol: string;
}

/**
 * Interface for payment data with enhanced validation
 */
export interface Payment {
  readonly id: UUID;
  readonly userId: UUID;
  readonly reservationId: UUID;
  readonly amount: number;
  readonly currency: Currency;
  readonly stripePaymentId: string;
  readonly status: PaymentStatus;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: Timestamp;
  readonly updatedAt: Timestamp;
}

/**
 * Interface for transaction data with status validation
 */
export interface Transaction {
  readonly id: UUID;
  readonly paymentId: UUID;
  readonly amount: number;
  readonly description: string;
  readonly status: TransactionStatus;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: Timestamp;
}

/**
 * Interface for GPU pricing configuration with time-based validity
 */
export interface GPUPricing {
  readonly id: UUID;
  readonly gpuModel: string;
  readonly pricePerHour: number;
  readonly currency: Currency;
  readonly effectiveFrom: Timestamp;
  readonly effectiveTo: Timestamp | null;
  readonly minimumRentalHours: number;
  readonly metadata: Record<string, unknown>;
}

/**
 * Type for payment API responses
 */
export type PaymentResponse = ApiResponse<Payment>;

/**
 * Type for paginated payment list responses
 */
export type PaymentListResponse = PaginatedResponse<Payment>;

/**
 * Currency configuration mapping with formatting rules
 */
export const CURRENCY_CONFIGS: Record<Currency, CurrencyConfig> = {
  [Currency.USD]: {
    currency: Currency.USD,
    decimalPlaces: 2,
    symbol: '$'
  },
  [Currency.EUR]: {
    currency: Currency.EUR,
    decimalPlaces: 2,
    symbol: '€'
  },
  [Currency.GBP]: {
    currency: Currency.GBP,
    decimalPlaces: 2,
    symbol: '£'
  }
};

/**
 * Default currency for the platform
 */
export const DEFAULT_CURRENCY = Currency.USD;

/**
 * Minimum allowed payment amount in any currency
 */
export const MINIMUM_PAYMENT_AMOUNT = 0.01;