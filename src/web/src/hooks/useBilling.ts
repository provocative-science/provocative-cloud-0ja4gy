import { useState, useEffect, useCallback, useRef } from 'react'; // ^18.0.0
import { useDispatch, useSelector } from 'react-redux'; // ^8.0.0
import { useQueryClient } from 'react-query'; // ^4.0.0
import { useRetry } from 'use-retry-hook'; // ^1.0.0

import {
  fetchTransactionHistory,
  fetchInvoices,
  initiatePayment,
  fetchGPUPricing
} from '../store/actions/billing';

import {
  Payment,
  Transaction,
  GPUPricing,
  PaymentStatus,
  Currency,
  BillingError
} from '../types/billing';

import { useWebSocket } from '../hooks/useWebSocket';

// Constants for retry and caching
const RETRY_ATTEMPTS = 3;
const CACHE_TIME = 5 * 60 * 1000; // 5 minutes
const DEFAULT_PAGE_SIZE = 10;

/**
 * Enhanced custom hook for managing billing operations with real-time updates
 * @param options Configuration options for the hook
 */
export function useBilling(options: {
  autoFetch?: boolean;
  pageSize?: number;
  retryAttempts?: number;
} = {}) {
  const {
    autoFetch = true,
    pageSize = DEFAULT_PAGE_SIZE,
    retryAttempts = RETRY_ATTEMPTS
  } = options;

  const dispatch = useDispatch();
  const queryClient = useQueryClient();

  // State management
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<BillingError | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Refs for request deduplication
  const pendingRequests = useRef(new Set<string>());

  // WebSocket setup for real-time updates
  const { isConnected, subscribe, unsubscribe } = useWebSocket({
    autoConnect: true,
    onMessage: (message) => {
      if (message.type === 'billing_update') {
        void queryClient.invalidateQueries('billing');
      }
    },
    onError: (error) => {
      setError({
        code: 'WEBSOCKET_ERROR',
        message: error.message,
        retryable: true
      });
    }
  });

  // Retry mechanism setup
  const { execute: retryOperation } = useRetry({
    maxAttempts: retryAttempts,
    delayMs: 1000,
    exponentialBackoff: true
  });

  /**
   * Fetches transaction history with pagination
   */
  const fetchTransactions = useCallback(async (page: number = currentPage) => {
    const requestId = `transactions_${page}`;
    if (pendingRequests.current.has(requestId)) return;

    try {
      setLoading(true);
      pendingRequests.current.add(requestId);

      const response = await retryOperation(() =>
        dispatch(fetchTransactionHistory({
          page,
          limit: pageSize
        })).unwrap()
      );

      setCurrentPage(page);
      setTotalPages(Math.ceil(response.total / pageSize));
      return response.data;
    } catch (err) {
      setError({
        code: 'FETCH_TRANSACTIONS_ERROR',
        message: (err as Error).message,
        retryable: true
      });
    } finally {
      setLoading(false);
      pendingRequests.current.delete(requestId);
    }
  }, [dispatch, currentPage, pageSize, retryOperation]);

  /**
   * Fetches invoice history
   */
  const fetchInvoiceHistory = useCallback(async () => {
    if (pendingRequests.current.has('invoices')) return;

    try {
      setLoading(true);
      pendingRequests.current.add('invoices');

      return await retryOperation(() =>
        dispatch(fetchInvoices()).unwrap()
      );
    } catch (err) {
      setError({
        code: 'FETCH_INVOICES_ERROR',
        message: (err as Error).message,
        retryable: true
      });
    } finally {
      setLoading(false);
      pendingRequests.current.delete('invoices');
    }
  }, [dispatch, retryOperation]);

  /**
   * Creates a new payment with validation
   */
  const createPayment = useCallback(async (
    amount: number,
    currency: Currency
  ): Promise<PaymentStatus> => {
    const paymentId = crypto.randomUUID();
    if (pendingRequests.current.has(`payment_${paymentId}`)) return PaymentStatus.FAILED;

    try {
      setLoading(true);
      pendingRequests.current.add(`payment_${paymentId}`);

      const response = await retryOperation(() =>
        dispatch(initiatePayment({
          amount,
          currency,
          metadata: {
            paymentId,
            timestamp: Date.now()
          }
        })).unwrap()
      );

      await subscribe(paymentId);
      return response.status;
    } catch (err) {
      setError({
        code: 'PAYMENT_ERROR',
        message: (err as Error).message,
        retryable: false
      });
      return PaymentStatus.FAILED;
    } finally {
      setLoading(false);
      pendingRequests.current.delete(`payment_${paymentId}`);
    }
  }, [dispatch, subscribe, retryOperation]);

  /**
   * Fetches GPU pricing with caching
   */
  const getGPUPricing = useCallback(async (): Promise<GPUPricing[]> => {
    const cacheKey = 'gpu_pricing';
    const cachedData = queryClient.getQueryData<GPUPricing[]>(cacheKey);

    if (cachedData) return cachedData;

    try {
      setLoading(true);
      const response = await retryOperation(() =>
        dispatch(fetchGPUPricing()).unwrap()
      );

      queryClient.setQueryData(cacheKey, response.data, {
        staleTime: CACHE_TIME
      });

      return response.data;
    } catch (err) {
      setError({
        code: 'FETCH_PRICING_ERROR',
        message: (err as Error).message,
        retryable: true
      });
      return [];
    } finally {
      setLoading(false);
    }
  }, [dispatch, queryClient, retryOperation]);

  /**
   * Retries a failed payment
   */
  const retryFailedPayment = useCallback(async (paymentId: string): Promise<PaymentStatus> => {
    if (pendingRequests.current.has(`retry_${paymentId}`)) return PaymentStatus.FAILED;

    try {
      setLoading(true);
      pendingRequests.current.add(`retry_${paymentId}`);

      const response = await retryOperation(() =>
        dispatch(initiatePayment({
          paymentId,
          retry: true,
          timestamp: Date.now()
        })).unwrap()
      );

      return response.status;
    } catch (err) {
      setError({
        code: 'RETRY_PAYMENT_ERROR',
        message: (err as Error).message,
        retryable: false
      });
      return PaymentStatus.FAILED;
    } finally {
      setLoading(false);
      pendingRequests.current.delete(`retry_${paymentId}`);
    }
  }, [dispatch, retryOperation]);

  /**
   * Clears current error state
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Initial data fetch
  useEffect(() => {
    if (autoFetch && isConnected) {
      void fetchTransactions(1);
      void fetchInvoiceHistory();
      void getGPUPricing();
    }
  }, [autoFetch, isConnected, fetchTransactions, fetchInvoiceHistory, getGPUPricing]);

  // Cleanup subscriptions
  useEffect(() => {
    return () => {
      pendingRequests.current.clear();
      Array.from(pendingRequests.current).forEach(id => {
        if (id.startsWith('payment_')) {
          void unsubscribe(id.replace('payment_', ''));
        }
      });
    };
  }, [unsubscribe]);

  return {
    loading,
    error,
    currentPage,
    totalPages,
    fetchTransactions,
    fetchInvoices: fetchInvoiceHistory,
    createPayment,
    getGPUPricing,
    retryFailedPayment,
    clearError
  };
}