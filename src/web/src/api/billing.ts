/**
 * API module for handling billing-related operations in Provocative Cloud platform
 * Includes payment processing, transaction management, and GPU pricing functionality
 * @version 1.0.0
 */

import { get, post } from '../utils/api';
import { API_ENDPOINTS } from '../config/api';
import { 
  Payment,
  Transaction,
  GPUPricing,
  PaymentResponse,
  PaymentListResponse,
  PaymentStatus,
  Currency,
  MINIMUM_PAYMENT_AMOUNT,
  DEFAULT_CURRENCY
} from '../types/billing';
import type { AxiosResponse } from 'axios'; // ^1.4.0

/**
 * Creates a new payment for GPU reservation with validation and retry mechanism
 * @param paymentData Payment data including amount, currency, and reservation details
 * @returns Promise resolving to payment response with status and metadata
 */
export async function createPayment(paymentData: Omit<Payment, 'id' | 'status' | 'createdAt' | 'updatedAt'>): Promise<PaymentResponse> {
  // Validate payment amount
  if (paymentData.amount < MINIMUM_PAYMENT_AMOUNT) {
    throw new Error(`Payment amount must be at least ${MINIMUM_PAYMENT_AMOUNT} ${paymentData.currency}`);
  }

  // Ensure valid currency
  if (!Object.values(Currency).includes(paymentData.currency)) {
    throw new Error('Invalid currency specified');
  }

  return post<PaymentResponse>(
    `${API_ENDPOINTS.BILLING.TRANSACTIONS}/payments`,
    paymentData
  );
}

/**
 * Retrieves paginated payment history with filtering and sorting
 * @param page Page number for pagination
 * @param limit Number of items per page
 * @param status Optional payment status filter
 * @param sortBy Optional sorting field
 * @returns Promise resolving to paginated payment list
 */
export async function getPaymentHistory(
  page: number = 1,
  limit: number = 10,
  status?: PaymentStatus,
  sortBy: string = 'createdAt'
): Promise<PaymentListResponse> {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
    sortBy,
    ...(status && { status })
  });

  return get<PaymentListResponse>(
    `${API_ENDPOINTS.BILLING.TRANSACTIONS}/payments?${params.toString()}`
  );
}

/**
 * Retrieves detailed payment information with associated metadata
 * @param paymentId UUID of the payment
 * @returns Promise resolving to detailed payment information
 */
export async function getPaymentDetails(paymentId: string): Promise<PaymentResponse> {
  if (!paymentId?.trim()) {
    throw new Error('Payment ID is required');
  }

  return get<PaymentResponse>(
    `${API_ENDPOINTS.BILLING.TRANSACTIONS}/payments/${paymentId}`
  );
}

/**
 * Retrieves detailed transaction history with metadata and status tracking
 * @param paymentId Optional payment ID filter
 * @param filters Optional transaction metadata filters
 * @returns Promise resolving to list of transactions
 */
export async function getTransactionHistory(
  paymentId?: string,
  filters: Record<string, unknown> = {}
): Promise<Transaction[]> {
  const params = new URLSearchParams({
    ...(paymentId && { paymentId }),
    ...filters
  });

  return get<Transaction[]>(
    `${API_ENDPOINTS.BILLING.TRANSACTIONS}?${params.toString()}`
  );
}

/**
 * Retrieves GPU pricing with time-based validity and currency support
 * @param gpuModel GPU model identifier
 * @param currency Optional currency code (defaults to platform default)
 * @returns Promise resolving to GPU pricing information
 */
export async function getGPUPricing(
  gpuModel: string,
  currency: Currency = DEFAULT_CURRENCY
): Promise<GPUPricing> {
  if (!gpuModel?.trim()) {
    throw new Error('GPU model is required');
  }

  const params = new URLSearchParams({
    model: gpuModel,
    currency
  });

  return get<GPUPricing>(
    `${API_ENDPOINTS.BILLING.USAGE}/pricing?${params.toString()}`
  );
}

/**
 * Validates payment status transition
 * @param currentStatus Current payment status
 * @param newStatus Desired new status
 * @returns boolean indicating if transition is valid
 */
function isValidPaymentStatusTransition(currentStatus: PaymentStatus, newStatus: PaymentStatus): boolean {
  const validTransitions: Record<PaymentStatus, PaymentStatus[]> = {
    [PaymentStatus.PENDING]: [PaymentStatus.COMPLETED, PaymentStatus.FAILED],
    [PaymentStatus.COMPLETED]: [PaymentStatus.REFUNDED],
    [PaymentStatus.FAILED]: [PaymentStatus.PENDING],
    [PaymentStatus.REFUNDED]: []
  };

  return validTransitions[currentStatus]?.includes(newStatus) || false;
}

/**
 * Formats currency amount according to currency-specific rules
 * @param amount Amount to format
 * @param currency Currency code
 * @returns Formatted currency string
 */
function formatCurrencyAmount(amount: number, currency: Currency): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency
  }).format(amount);
}