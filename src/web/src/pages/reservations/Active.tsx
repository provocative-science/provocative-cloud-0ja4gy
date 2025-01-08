import React, { useEffect, useCallback, memo } from 'react';
import styled from '@emotion/styled';
import { Typography } from '@mui/material';
import { withErrorBoundary } from 'react-error-boundary';

import DashboardLayout from '../../layouts/DashboardLayout';
import { ReservationList } from '../../components/reservation/ReservationList';
import { useReservation } from '../../hooks/useReservation';
import { ReservationStatus } from '../../types/reservation';

// Constants
const REFRESH_INTERVAL = 30000; // 30 seconds
const PAGE_SIZE = 10;
const WEBSOCKET_RETRY_DELAY = 5000;

// Styled components with responsive design
const PageContainer = styled.div`
  padding: 24px;
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  min-height: calc(100vh - 64px);

  @media (max-width: 768px) {
    padding: 16px;
  }
`;

const PageHeader = styled.div`
  margin-bottom: 24px;
  display: flex;
  flex-direction: column;
  gap: 8px;

  @media (max-width: 768px) {
    margin-bottom: 16px;
  }
`;

/**
 * Active Reservations page component
 * Displays active GPU reservations with real-time updates and environmental metrics
 */
const ActiveReservations: React.FC = memo(() => {
  const {
    refreshReservations,
    wsStatus,
    retryLastOperation,
    error
  } = useReservation();

  // Set up automatic refresh interval
  useEffect(() => {
    const refreshInterval = setInterval(() => {
      refreshReservations();
    }, REFRESH_INTERVAL);

    return () => {
      clearInterval(refreshInterval);
    };
  }, [refreshReservations]);

  // Handle WebSocket reconnection
  useEffect(() => {
    if (wsStatus === 'error') {
      const retryTimeout = setTimeout(() => {
        retryLastOperation();
      }, WEBSOCKET_RETRY_DELAY);

      return () => {
        clearTimeout(retryTimeout);
      };
    }
  }, [wsStatus, retryLastOperation]);

  // Handle error retry
  const handleRetry = useCallback(() => {
    retryLastOperation();
  }, [retryLastOperation]);

  return (
    <DashboardLayout>
      <PageContainer>
        <PageHeader>
          <Typography 
            variant="h4" 
            component="h1"
            gutterBottom
            aria-label="Active GPU Reservations"
          >
            Active GPU Reservations
          </Typography>
          <Typography 
            variant="body1" 
            color="textSecondary"
            paragraph
          >
            Monitor your active GPU rentals and environmental impact metrics in real-time
          </Typography>
        </PageHeader>

        {/* Error message for screen readers */}
        {error && (
          <div role="alert" aria-live="assertive">
            <Typography color="error" gutterBottom>
              {error}
            </Typography>
          </div>
        )}

        {/* Connection status for screen readers */}
        <div aria-live="polite" className="sr-only">
          {wsStatus === 'connected' ? 
            'Real-time updates connected' : 
            'Real-time updates disconnected'
          }
        </div>

        <ReservationList
          filter={ReservationStatus.ACTIVE}
          pageSize={PAGE_SIZE}
          environmentalMetrics={true}
          refreshInterval={REFRESH_INTERVAL}
          onError={handleRetry}
        />
      </PageContainer>
    </DashboardLayout>
  );
});

ActiveReservations.displayName = 'ActiveReservations';

// Wrap with error boundary for production error handling
export default withErrorBoundary(ActiveReservations, {
  fallback: (
    <DashboardLayout>
      <PageContainer>
        <Typography variant="h6" color="error" gutterBottom>
          Error loading active reservations
        </Typography>
        <button onClick={() => window.location.reload()}>
          Retry
        </button>
      </PageContainer>
    </DashboardLayout>
  ),
  onError: (error) => {
    console.error('Active reservations page error:', error);
  }
});