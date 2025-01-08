import { useState, useEffect, useCallback, useRef } from 'react'; // ^18.0.0
import { useDispatch, useSelector } from 'react-redux';
import { debounce } from 'lodash'; // ^4.17.21

import {
  fetchReservations,
  fetchReservation,
  createNewReservation,
  updateExistingReservation,
  cancelExistingReservation
} from '../store/actions/reservation';

import {
  Reservation,
  ReservationCreate,
  ReservationDetails,
  ReservationStatus,
  DeploymentType,
  isValidReservationCreate,
  isValidStatusTransition
} from '../types/reservation';

import {
  selectReservations,
  selectSelectedReservation,
  selectReservationError,
  selectReservationLoading,
  selectWebSocketStatus
} from '../store/reducers/reservation';

import { useWebSocket } from '../hooks/useWebSocket';
import { METRICS_CONFIG } from '../config/constants';

/**
 * Custom hook for managing GPU reservations with real-time updates
 * @returns Object containing reservation state and management functions
 */
export function useReservation() {
  const dispatch = useDispatch();
  const [retryTimeout, setRetryTimeout] = useState<NodeJS.Timeout | null>(null);

  // Redux selectors
  const reservations = useSelector(selectReservations);
  const currentReservation = useSelector(selectSelectedReservation);
  const loading = useSelector(selectReservationLoading);
  const error = useSelector(selectReservationError);

  // WebSocket setup for real-time updates
  const { 
    isConnected: wsConnected,
    error: wsError,
    subscribe,
    unsubscribe
  } = useWebSocket({
    onMessage: handleWebSocketMessage,
    onError: (error) => console.error('WebSocket error:', error)
  });

  // Debounced metrics update handler
  const debouncedMetricsUpdate = useCallback(
    debounce((data) => {
      if (currentReservation) {
        dispatch({
          type: 'reservation/updateMetrics',
          payload: {
            reservationId: currentReservation.reservation.id,
            metrics: data.metrics,
            carbonMetrics: data.carbonMetrics
          }
        });
      }
    }, METRICS_CONFIG.UPDATE_INTERVAL_MS),
    [currentReservation, dispatch]
  );

  /**
   * Creates a new GPU reservation with deployment configuration
   */
  const createReservation = useCallback(async (data: ReservationCreate) => {
    try {
      if (!isValidReservationCreate(data)) {
        throw new Error('Invalid reservation parameters');
      }

      const result = await dispatch(createNewReservation(data)).unwrap();
      
      // Subscribe to real-time updates for the new reservation
      if (wsConnected) {
        await subscribe(result.reservation.id);
      }

      return result;
    } catch (error) {
      console.error('Reservation creation error:', error);
      throw error;
    }
  }, [dispatch, wsConnected, subscribe]);

  /**
   * Updates an existing reservation with validation
   */
  const updateReservation = useCallback(async (
    reservationId: string,
    updates: Partial<Reservation>
  ) => {
    try {
      const reservation = reservations.find(r => r.id === reservationId);
      if (!reservation) {
        throw new Error('Reservation not found');
      }

      if (updates.status && !isValidStatusTransition(reservation.status, updates.status)) {
        throw new Error('Invalid status transition');
      }

      return await dispatch(updateExistingReservation({ 
        reservationId, 
        updates 
      })).unwrap();
    } catch (error) {
      console.error('Reservation update error:', error);
      throw error;
    }
  }, [dispatch, reservations]);

  /**
   * Cancels an active reservation with cleanup
   */
  const cancelReservation = useCallback(async (reservationId: string) => {
    try {
      // Unsubscribe from updates before cancelling
      if (wsConnected) {
        await unsubscribe(reservationId);
      }

      const result = await dispatch(cancelExistingReservation(reservationId)).unwrap();
      return result;
    } catch (error) {
      console.error('Reservation cancellation error:', error);
      throw error;
    }
  }, [dispatch, wsConnected, unsubscribe]);

  /**
   * Fetches detailed reservation information
   */
  const fetchReservationDetails = useCallback(async (reservationId: string) => {
    try {
      const result = await dispatch(fetchReservation(reservationId)).unwrap();
      
      // Subscribe to updates for the fetched reservation
      if (wsConnected) {
        await subscribe(reservationId);
      }

      return result;
    } catch (error) {
      console.error('Reservation fetch error:', error);
      throw error;
    }
  }, [dispatch, wsConnected, subscribe]);

  /**
   * Refreshes the reservations list
   */
  const refreshReservations = useCallback(async () => {
    try {
      await dispatch(fetchReservations()).unwrap();
    } catch (error) {
      console.error('Reservations refresh error:', error);
      throw error;
    }
  }, [dispatch]);

  /**
   * Retries the last failed operation
   */
  const retryLastOperation = useCallback(() => {
    if (retryTimeout) {
      clearTimeout(retryTimeout);
    }
    refreshReservations();
  }, [refreshReservations, retryTimeout]);

  /**
   * Handles incoming WebSocket messages
   */
  function handleWebSocketMessage(message: any) {
    switch (message.type) {
      case 'metrics':
        debouncedMetricsUpdate(message.data);
        break;
      case 'status':
        if (message.data.reservationId) {
          dispatch({
            type: 'reservation/updateStatus',
            payload: {
              reservationId: message.data.reservationId,
              status: message.data.status
            }
          });
        }
        break;
      case 'error':
        console.error('Reservation WebSocket error:', message.data);
        break;
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
      debouncedMetricsUpdate.cancel();
    };
  }, [retryTimeout, debouncedMetricsUpdate]);

  return {
    reservations,
    currentReservation,
    loading,
    error,
    createReservation,
    updateReservation,
    cancelReservation,
    fetchReservationDetails,
    refreshReservations,
    retryLastOperation,
    wsStatus: wsConnected ? 'connected' : wsError ? 'error' : 'disconnected'
  };
}

export type UseReservationType = ReturnType<typeof useReservation>;