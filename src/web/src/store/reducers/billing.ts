/**
 * Redux reducer for managing billing state in Provocative Cloud platform
 * Handles payments, transactions, GPU pricing, and enhanced error handling
 * @version 1.0.0
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit'; // ^1.9.5
import {
  Payment,
  Transaction,
  GPUPricing,
  PaymentStatus,
  BillingError,
  FilterOptions,
  SortOptions
} from '../../types/billing';
import {
  initiatePayment,
  fetchPaymentHistory,
  fetchPaymentDetails,
  fetchTransactionHistory,
  fetchGPUPricing,
  retryFailedPayment
} from '../actions/billing';

/**
 * Interface for billing state with enhanced error handling and filtering
 */
interface BillingState {
  payments: Payment[];
  currentPayment: Payment | null;
  transactions: Transaction[];
  gpuPricing: Record<string, GPUPricing> | null;
  loading: boolean;
  error: BillingError | null;
  retryCount: number;
  lastFailedOperation: string | null;
  filters: {
    dateRange: { startDate: number; endDate: number } | null;
    status: PaymentStatus | null;
    search: string;
    gpuModel: string | null;
  };
  sort: {
    field: string;
    direction: 'asc' | 'desc';
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
}

/**
 * Initial state for billing reducer with default values
 */
const initialState: BillingState = {
  payments: [],
  currentPayment: null,
  transactions: [],
  gpuPricing: null,
  loading: false,
  error: null,
  retryCount: 0,
  lastFailedOperation: null,
  filters: {
    dateRange: null,
    status: null,
    search: '',
    gpuModel: null
  },
  sort: {
    field: 'date',
    direction: 'desc'
  },
  pagination: {
    page: 1,
    limit: 10,
    total: 0
  }
};

/**
 * Billing slice with enhanced error handling and optimistic updates
 */
const billingSlice = createSlice({
  name: 'billing',
  initialState,
  reducers: {
    resetBillingState: (state) => {
      return initialState;
    },
    clearBillingError: (state) => {
      state.error = null;
      state.lastFailedOperation = null;
    },
    updateFilters: (state, action: PayloadAction<Partial<typeof initialState.filters>>) => {
      state.filters = {
        ...state.filters,
        ...action.payload
      };
      state.pagination.page = 1; // Reset pagination when filters change
    },
    updateSort: (state, action: PayloadAction<typeof initialState.sort>) => {
      state.sort = action.payload;
      state.pagination.page = 1; // Reset pagination when sort changes
    },
    updatePagination: (state, action: PayloadAction<Partial<typeof initialState.pagination>>) => {
      state.pagination = {
        ...state.pagination,
        ...action.payload
      };
    }
  },
  extraReducers: (builder) => {
    // Initiate Payment
    builder.addCase(initiatePayment.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(initiatePayment.fulfilled, (state, action) => {
      state.loading = false;
      state.currentPayment = action.payload;
      state.payments = [action.payload, ...state.payments];
      state.retryCount = 0;
    });
    builder.addCase(initiatePayment.rejected, (state, action) => {
      state.loading = false;
      state.error = {
        message: action.payload?.message || 'Payment initiation failed',
        code: action.payload?.code || 500,
        operation: 'initiatePayment'
      };
      state.lastFailedOperation = 'initiatePayment';
      state.retryCount += 1;
    });

    // Fetch Payment History
    builder.addCase(fetchPaymentHistory.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(fetchPaymentHistory.fulfilled, (state, action) => {
      state.loading = false;
      state.payments = action.payload.data;
      state.pagination.total = action.payload.total;
      state.retryCount = 0;
    });
    builder.addCase(fetchPaymentHistory.rejected, (state, action) => {
      state.loading = false;
      state.error = {
        message: action.payload?.message || 'Failed to fetch payment history',
        code: action.payload?.code || 500,
        operation: 'fetchPaymentHistory'
      };
      state.lastFailedOperation = 'fetchPaymentHistory';
    });

    // Fetch Payment Details
    builder.addCase(fetchPaymentDetails.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(fetchPaymentDetails.fulfilled, (state, action) => {
      state.loading = false;
      state.currentPayment = action.payload;
      // Update payment in list if exists
      const index = state.payments.findIndex(p => p.id === action.payload.id);
      if (index !== -1) {
        state.payments[index] = action.payload;
      }
    });
    builder.addCase(fetchPaymentDetails.rejected, (state, action) => {
      state.loading = false;
      state.error = {
        message: action.payload?.message || 'Failed to fetch payment details',
        code: action.payload?.code || 500,
        operation: 'fetchPaymentDetails'
      };
      state.lastFailedOperation = 'fetchPaymentDetails';
    });

    // Fetch Transaction History
    builder.addCase(fetchTransactionHistory.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(fetchTransactionHistory.fulfilled, (state, action) => {
      state.loading = false;
      state.transactions = action.payload;
    });
    builder.addCase(fetchTransactionHistory.rejected, (state, action) => {
      state.loading = false;
      state.error = {
        message: action.payload?.message || 'Failed to fetch transaction history',
        code: action.payload?.code || 500,
        operation: 'fetchTransactionHistory'
      };
      state.lastFailedOperation = 'fetchTransactionHistory';
    });

    // Fetch GPU Pricing
    builder.addCase(fetchGPUPricing.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(fetchGPUPricing.fulfilled, (state, action) => {
      state.loading = false;
      state.gpuPricing = {
        ...state.gpuPricing,
        [action.payload.gpuModel]: action.payload
      };
    });
    builder.addCase(fetchGPUPricing.rejected, (state, action) => {
      state.loading = false;
      state.error = {
        message: action.payload?.message || 'Failed to fetch GPU pricing',
        code: action.payload?.code || 500,
        operation: 'fetchGPUPricing'
      };
      state.lastFailedOperation = 'fetchGPUPricing';
    });
  }
});

// Export actions and reducer
export const {
  resetBillingState,
  clearBillingError,
  updateFilters,
  updateSort,
  updatePagination
} = billingSlice.actions;

export default billingSlice.reducer;