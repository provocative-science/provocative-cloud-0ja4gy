import { createSlice, PayloadAction, createSelector } from '@reduxjs/toolkit';
import { WebSocket } from 'ws';
import { 
  Reservation, 
  ReservationDetails, 
  ReservationStatus 
} from '../../types/reservation';
import { 
  fetchReservations, 
  fetchReservation, 
  createNewReservation, 
  updateExistingReservation, 
  cancelExistingReservation, 
  updateReservationMetrics, 
  updateCarbonOffset 
} from '../actions/reservation';
import { GPUMetrics, CarbonMetrics } from '../../types/metrics';
import { METRICS_CONFIG, ENVIRONMENTAL_CONFIG } from '../../config/constants';

// WebSocket connection status type
type WebSocketStatus = 'connected' | 'disconnected' | 'connecting' | 'error';

// Interface for the reservation slice state
interface ReservationState {
  reservations: Reservation[];
  selectedReservation: ReservationDetails | null;
  loading: boolean;
  error: string | null;
  lastUpdated: number;
  webSocketStatus: WebSocketStatus;
  retryCount: number;
  optimisticUpdates: Map<string, any>;
}

// Initial state
const initialState: ReservationState = {
  reservations: [],
  selectedReservation: null,
  loading: false,
  error: null,
  lastUpdated: 0,
  webSocketStatus: 'disconnected',
  retryCount: 0,
  optimisticUpdates: new Map()
};

// Constants
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1000;

// Create the reservation slice
const reservationSlice = createSlice({
  name: 'reservation',
  initialState,
  reducers: {
    setSelectedReservation(state, action: PayloadAction<ReservationDetails | null>) {
      state.selectedReservation = action.payload;
    },
    clearSelectedReservation(state) {
      state.selectedReservation = null;
    },
    clearError(state) {
      state.error = null;
      state.retryCount = 0;
    },
    updateMetrics(state, action: PayloadAction<{ 
      reservationId: string; 
      metrics: GPUMetrics;
    }>) {
      const { reservationId, metrics } = action.payload;
      const reservation = state.reservations.find(r => r.id === reservationId);
      if (reservation && state.selectedReservation?.reservation.id === reservationId) {
        state.selectedReservation = {
          ...state.selectedReservation,
          metrics
        };
      }
    },
    updateCarbonOffset(state, action: PayloadAction<{
      reservationId: string;
      carbonMetrics: CarbonMetrics;
    }>) {
      const { reservationId, carbonMetrics } = action.payload;
      const reservation = state.reservations.find(r => r.id === reservationId);
      if (reservation) {
        reservation.carbon_offset = carbonMetrics.co2CapturedKg;
      }
    },
    setWebSocketStatus(state, action: PayloadAction<WebSocketStatus>) {
      state.webSocketStatus = action.payload;
    }
  },
  extraReducers: (builder) => {
    // Handle fetchReservations
    builder.addCase(fetchReservations.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(fetchReservations.fulfilled, (state, action) => {
      state.loading = false;
      state.reservations = action.payload;
      state.lastUpdated = Date.now();
      state.retryCount = 0;
    });
    builder.addCase(fetchReservations.rejected, (state, action) => {
      state.loading = false;
      state.error = action.error.message || 'Failed to fetch reservations';
      if (state.retryCount < MAX_RETRY_ATTEMPTS) {
        state.retryCount++;
      }
    });

    // Handle fetchReservation
    builder.addCase(fetchReservation.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(fetchReservation.fulfilled, (state, action) => {
      state.loading = false;
      state.selectedReservation = action.payload;
      state.lastUpdated = Date.now();
      state.retryCount = 0;
    });
    builder.addCase(fetchReservation.rejected, (state, action) => {
      state.loading = false;
      state.error = action.error.message || 'Failed to fetch reservation details';
    });

    // Handle createNewReservation
    builder.addCase(createNewReservation.pending, (state, action) => {
      state.loading = true;
      state.error = null;
      // Add optimistic update
      state.optimisticUpdates.set(action.meta.requestId, action.meta.arg);
    });
    builder.addCase(createNewReservation.fulfilled, (state, action) => {
      state.loading = false;
      state.reservations.push(action.payload.reservation);
      state.selectedReservation = action.payload;
      state.lastUpdated = Date.now();
      // Clear optimistic update
      state.optimisticUpdates.delete(action.meta.requestId);
    });
    builder.addCase(createNewReservation.rejected, (state, action) => {
      state.loading = false;
      state.error = action.error.message || 'Failed to create reservation';
      // Rollback optimistic update
      state.optimisticUpdates.delete(action.meta.requestId);
    });

    // Handle updateExistingReservation
    builder.addCase(updateExistingReservation.pending, (state, action) => {
      state.loading = true;
      state.error = null;
      // Add optimistic update
      state.optimisticUpdates.set(action.meta.requestId, action.meta.arg);
    });
    builder.addCase(updateExistingReservation.fulfilled, (state, action) => {
      state.loading = false;
      const index = state.reservations.findIndex(r => r.id === action.payload.reservation.id);
      if (index !== -1) {
        state.reservations[index] = action.payload.reservation;
      }
      if (state.selectedReservation?.reservation.id === action.payload.reservation.id) {
        state.selectedReservation = action.payload;
      }
      state.lastUpdated = Date.now();
      // Clear optimistic update
      state.optimisticUpdates.delete(action.meta.requestId);
    });
    builder.addCase(updateExistingReservation.rejected, (state, action) => {
      state.loading = false;
      state.error = action.error.message || 'Failed to update reservation';
      // Rollback optimistic update
      state.optimisticUpdates.delete(action.meta.requestId);
    });

    // Handle cancelExistingReservation
    builder.addCase(cancelExistingReservation.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(cancelExistingReservation.fulfilled, (state, action) => {
      state.loading = false;
      const index = state.reservations.findIndex(r => r.id === action.payload.id);
      if (index !== -1) {
        state.reservations[index] = {
          ...state.reservations[index],
          status: ReservationStatus.CANCELLED
        };
      }
      if (state.selectedReservation?.reservation.id === action.payload.id) {
        state.selectedReservation = null;
      }
      state.lastUpdated = Date.now();
    });
    builder.addCase(cancelExistingReservation.rejected, (state, action) => {
      state.loading = false;
      state.error = action.error.message || 'Failed to cancel reservation';
    });

    // Handle updateReservationMetrics
    builder.addCase(updateReservationMetrics.fulfilled, (state, action) => {
      const { reservationId, metrics } = action.payload;
      if (state.selectedReservation?.reservation.id === reservationId) {
        state.selectedReservation = {
          ...state.selectedReservation,
          metrics
        };
      }
    });

    // Handle updateCarbonOffset
    builder.addCase(updateCarbonOffset.fulfilled, (state, action) => {
      const { reservationId, carbonMetrics } = action.payload;
      const reservation = state.reservations.find(r => r.id === reservationId);
      if (reservation) {
        reservation.carbon_offset = carbonMetrics.co2CapturedKg;
      }
    });
  }
});

// Export actions
export const {
  setSelectedReservation,
  clearSelectedReservation,
  clearError,
  updateMetrics,
  updateCarbonOffset,
  setWebSocketStatus
} = reservationSlice.actions;

// Export reducer
export default reservationSlice.reducer;

// Selectors
export const selectAllReservations = (state: { reservation: ReservationState }) => 
  state.reservation.reservations;

export const selectSelectedReservation = (state: { reservation: ReservationState }) => 
  state.reservation.selectedReservation;

export const selectReservationById = createSelector(
  [selectAllReservations, (_, id: string) => id],
  (reservations, id) => reservations.find(r => r.id === id)
);

export const selectActiveReservations = createSelector(
  [selectAllReservations],
  (reservations) => reservations.filter(r => r.status === ReservationStatus.ACTIVE)
);

export const selectReservationMetrics = createSelector(
  [selectSelectedReservation],
  (reservation) => reservation?.metrics
);

export const selectReservationCarbonOffset = createSelector(
  [selectSelectedReservation],
  (reservation) => reservation?.reservation.carbon_offset
);

export const selectReservationLoadingState = (state: { reservation: ReservationState }) => ({
  loading: state.reservation.loading,
  error: state.reservation.error,
  retryCount: state.reservation.retryCount
});

export const selectWebSocketStatus = (state: { reservation: ReservationState }) => 
  state.reservation.webSocketStatus;