/**
 * Redux action creators and async thunks for billing operations
 * Handles payments, transactions, and GPU pricing with enhanced security and validation
 * @version 1.0.0
 */

import { createAsyncThunk } from '@reduxjs/toolkit'; // ^1.9.5
import { retry } from 'axios-retry'; // ^3.5.0
import { v4 as uuidv4 } from 'uuid'; // ^9.0.0

import {
  createPayment,
  getPaymentHistory,
  getPaymentDetails,
  getTransactionHistory,
  getGPUPricing
} from '../../api/billing';

import {
  Payment,
  Transaction,
  GPUPricing,
  PaymentStatus,
  PaymentResponse,
  PaymentListResponse,
  Currency,
  MINIMUM_PAYMENT_AMOUNT
} from '../../types/billing';

import { validatePaymentAmount, validateGPUPricing } from '../../utils/validation';

// Constants for retry configuration
const RETRY_OPTIONS = {
  retries: 3,
  retryDelay: (retryCount: number) => Math.min(1000 * Math.pow(2, retryCount - 1), 5000),
  retryCondition: (error: any) => {
    return error.response?.status === 429 || error.response?.status >= 500;
  }
};

/**
 * Initiates a new payment for GPU rental with validation and retry logic
 */
export const initiatePayment = createAsyncThunk(
  'billing/initiatePayment',
  async (paymentData: Omit<Payment, 'id' | 'status' | 'createdAt' | 'updatedAt'>, { rejectWithValue }) => {
    try {
      // Validate payment amount
      if (paymentData.amount < MINIMUM_PAYMENT_AMOUNT) {
        throw new Error(`Payment amount must be at least ${MINIMUM_PAYMENT_AMOUNT} ${paymentData.currency}`);
      }

      // Generate idempotency key
      const idempotencyKey = uuidv4();

      // Create payment with retry logic
      const response = await retry(
        async () => createPayment({
          ...paymentData,
          metadata: {
            ...paymentData.metadata,
            idempotencyKey
          }
        }),
        RETRY_OPTIONS
      );

      return response;
    } catch (error: any) {
      return rejectWithValue({
        message: error.message || 'Payment initiation failed',
        code: error.response?.status || 500
      });
    }
  }
);

/**
 * Retrieves paginated payment history with filtering and search capabilities
 */
export const fetchPaymentHistory = createAsyncThunk(
  'billing/fetchPaymentHistory',
  async ({
    page = 1,
    limit = 10,
    filters = {},
    search = ''
  }: {
    page: number;
    limit: number;
    filters?: Record<string, any>;
    search?: string;
  }, { rejectWithValue }) => {
    try {
      // Validate pagination parameters
      if (page < 1 || limit < 1) {
        throw new Error('Invalid pagination parameters');
      }

      const response = await retry(
        () => getPaymentHistory(page, limit, filters.status, filters.sortBy),
        RETRY_OPTIONS
      );

      return response;
    } catch (error: any) {
      return rejectWithValue({
        message: error.message || 'Failed to fetch payment history',
        code: error.response?.status || 500
      });
    }
  }
);

/**
 * Retrieves detailed payment information with associated metadata
 */
export const fetchPaymentDetails = createAsyncThunk(
  'billing/fetchPaymentDetails',
  async (paymentId: string, { rejectWithValue }) => {
    try {
      // Validate payment ID format
      if (!paymentId?.trim()) {
        throw new Error('Invalid payment ID');
      }

      const response = await retry(
        () => getPaymentDetails(paymentId),
        RETRY_OPTIONS
      );

      return response;
    } catch (error: any) {
      return rejectWithValue({
        message: error.message || 'Failed to fetch payment details',
        code: error.response?.status || 500
      });
    }
  }
);

/**
 * Retrieves transaction history with filtering and date range
 */
export const fetchTransactionHistory = createAsyncThunk(
  'billing/fetchTransactionHistory',
  async ({
    paymentId,
    dateRange,
    filters = {}
  }: {
    paymentId?: string;
    dateRange?: { startDate: number; endDate: number };
    filters?: Record<string, any>;
  }, { rejectWithValue }) => {
    try {
      // Validate date range if provided
      if (dateRange && dateRange.startDate > dateRange.endDate) {
        throw new Error('Invalid date range');
      }

      const response = await retry(
        () => getTransactionHistory(paymentId, {
          ...filters,
          ...(dateRange && {
            startDate: dateRange.startDate,
            endDate: dateRange.endDate
          })
        }),
        RETRY_OPTIONS
      );

      return response;
    } catch (error: any) {
      return rejectWithValue({
        message: error.message || 'Failed to fetch transaction history',
        code: error.response?.status || 500
      });
    }
  }
);

/**
 * Retrieves and validates current GPU pricing information
 */
export const fetchGPUPricing = createAsyncThunk(
  'billing/fetchGPUPricing',
  async ({
    gpuModel,
    region
  }: {
    gpuModel: string;
    region: string;
  }, { rejectWithValue }) => {
    try {
      // Validate GPU model
      if (!gpuModel?.trim()) {
        throw new Error('Invalid GPU model');
      }

      const response = await retry(
        () => getGPUPricing(gpuModel, Currency.USD),
        RETRY_OPTIONS
      );

      // Validate returned pricing data
      if (response.pricePerHour <= 0) {
        throw new Error('Invalid pricing data received');
      }

      return response;
    } catch (error: any) {
      return rejectWithValue({
        message: error.message || 'Failed to fetch GPU pricing',
        code: error.response?.status || 500
      });
    }
  }
);