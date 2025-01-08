import React, { useEffect, useState, useCallback } from 'react';
import styled from '@emotion/styled';
import { Box, Typography, Skeleton, Alert } from '@mui/material';
import { analytics } from '@segment/analytics-next';

import DashboardLayout from '../../layouts/DashboardLayout';
import { ReservationList } from '../../components/reservation/ReservationList';
import { ReservationStatus } from '../../types/reservation';

// Styled components
const PageContainer = styled(Box)`
  padding: 24px;
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
  min-height: calc(100vh - 64px);

  @media (max-width: 600px) {
    padding: 16px;
  }
`;

const PageTitle = styled(Typography)`
  font-size: 24px;
  font-weight: 500;
  margin-bottom: 16px;
  color: ${props => props.theme.colors.text.primary};

  @media (max-width: 600px) {
    font-size: 20px;
  }
`;

const PageDescription = styled(Typography)`
  font-size: 16px;
  margin-bottom: 24px;
  color: ${props => props.theme.colors.text.secondary};

  @media (max-width: 600px) {
    font-size: 14px;
  }
`;

// Constants
const RESERVATIONS_PER_PAGE = 10;
const ERROR_MESSAGES = {
  FETCH_ERROR: 'Failed to load reservation history. Please try again.',
  NO_RESERVATIONS: 'No historical reservations found.'
};

/**
 * History page component for displaying historical GPU reservations
 * with environmental impact metrics and filtering capabilities
 */
const HistoryPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Track page view
  useEffect(() => {
    analytics.page('Reservation History', {
      title: 'GPU Reservation History',
      path: '/reservations/history'
    });
  }, []);

  // Error handler for reservation operations
  const handleError = useCallback((error: Error) => {
    setError(error.message || ERROR_MESSAGES.FETCH_ERROR);
    analytics.track('Reservation History Error', {
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }, []);

  // Loading state handler
  const handleLoading = useCallback((isLoading: boolean) => {
    setLoading(isLoading);
  }, []);

  return (
    <DashboardLayout>
      <PageContainer>
        <PageTitle variant="h1">
          Reservation History
        </PageTitle>
        
        <PageDescription>
          View your completed and cancelled GPU reservations with environmental impact metrics.
        </PageDescription>

        {error && (
          <Alert 
            severity="error" 
            onClose={() => setError(null)}
            sx={{ marginBottom: 2 }}
          >
            {error}
          </Alert>
        )}

        {loading ? (
          <>
            <Skeleton variant="rectangular" height={200} />
            <Skeleton variant="text" height={40} sx={{ mt: 2 }} />
            <Skeleton variant="text" height={40} />
          </>
        ) : (
          <ReservationList
            filter={[ReservationStatus.COMPLETED, ReservationStatus.CANCELLED]}
            pageSize={RESERVATIONS_PER_PAGE}
            showEnvironmentalMetrics={true}
            onError={handleError}
          />
        )}
      </PageContainer>
    </DashboardLayout>
  );
};

export default HistoryPage;