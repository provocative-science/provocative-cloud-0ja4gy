import React, { useEffect, useMemo, useCallback, memo } from 'react';
import { Typography, Box, Container, Alert, CircularProgress, Skeleton, useTheme } from '@mui/material';
import { ErrorBoundary } from 'react-error-boundary';
import { Analytics } from '@segment/analytics-next';

import DashboardLayout from '../../layouts/DashboardLayout';
import TransactionHistory from '../../components/billing/TransactionHistory';
import { useBilling } from '../../hooks/useBilling';
import { useWebSocket } from '../../hooks/useWebSocket';

// Initialize analytics
const analytics = new Analytics({
  writeKey: process.env.REACT_APP_SEGMENT_WRITE_KEY || ''
});

// Constants
const TRANSACTIONS_PER_PAGE = 10;
const WEBSOCKET_RETRY_ATTEMPTS = 3;
const WEBSOCKET_RETRY_DELAY = 1000;
const ERROR_MESSAGES = {
  FETCH_ERROR: 'Failed to fetch transaction history',
  WEBSOCKET_ERROR: 'Real-time updates connection failed',
  RETRY_MESSAGE: 'Click to retry'
};

const BillingHistory: React.FC = memo(() => {
  const theme = useTheme();
  const {
    loading,
    error,
    fetchTransactions,
    clearError
  } = useBilling({
    autoFetch: true,
    pageSize: TRANSACTIONS_PER_PAGE
  });

  // WebSocket setup for real-time updates
  const { connect, disconnect } = useWebSocket({
    autoConnect: true,
    maxRetries: WEBSOCKET_RETRY_ATTEMPTS,
    reconnectInterval: WEBSOCKET_RETRY_DELAY,
    onMessage: (message) => {
      if (message.type === 'transaction_update') {
        void fetchTransactions();
      }
    },
    onError: (wsError) => {
      console.error('WebSocket error:', wsError);
      analytics.track('Billing WebSocket Error', {
        error: wsError.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Track page view
  useEffect(() => {
    analytics.page('Billing History', {
      timestamp: new Date().toISOString()
    });
  }, []);

  // Connect to WebSocket for real-time updates
  useEffect(() => {
    void connect();
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  // Error handling with retry capability
  const handleRetry = useCallback(async () => {
    clearError();
    await fetchTransactions();
    void connect();
  }, [clearError, fetchTransactions, connect]);

  // Memoized error component
  const ErrorDisplay = useMemo(() => (
    error && (
      <Alert 
        severity="error"
        onClose={clearError}
        action={
          <Box
            component="button"
            onClick={handleRetry}
            sx={{ cursor: 'pointer', textDecoration: 'underline' }}
            aria-label={ERROR_MESSAGES.RETRY_MESSAGE}
          >
            {ERROR_MESSAGES.RETRY_MESSAGE}
          </Box>
        }
      >
        {error.message || ERROR_MESSAGES.FETCH_ERROR}
      </Alert>
    )
  ), [error, clearError, handleRetry]);

  // Loading skeleton
  const LoadingSkeleton = useMemo(() => (
    <Box sx={{ mt: 3 }}>
      <Skeleton variant="rectangular" height={400} />
      <Skeleton variant="text" sx={{ mt: 1 }} />
      <Skeleton variant="text" />
    </Box>
  ), []);

  return (
    <DashboardLayout>
      <ErrorBoundary
        FallbackComponent={({ error: boundaryError }) => (
          <Alert severity="error">
            {boundaryError.message}
          </Alert>
        )}
        onReset={clearError}
      >
        <Container
          maxWidth="xl"
          sx={{
            mt: 3,
            mb: 3,
            minHeight: 'calc(100vh - 200px)'
          }}
        >
          <Box
            sx={{
              mb: 3,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <Typography
              variant="h4"
              component="h1"
              gutterBottom
              sx={{ color: theme.palette.text.primary }}
            >
              Billing History
            </Typography>
            {loading && (
              <CircularProgress
                size={24}
                aria-label="Loading transactions"
              />
            )}
          </Box>

          {ErrorDisplay}

          {loading ? LoadingSkeleton : (
            <TransactionHistory
              pageSize={TRANSACTIONS_PER_PAGE}
              className="transaction-history"
              enableRealTimeUpdates={true}
              onFilterChange={(filters) => {
                analytics.track('Billing Filter Change', {
                  filters,
                  timestamp: new Date().toISOString()
                });
              }}
            />
          )}
        </Container>
      </ErrorBoundary>

      <style jsx>{`
        .transaction-history {
          background-color: ${theme.palette.background.paper};
          border-radius: ${theme.shape.borderRadius}px;
          box-shadow: ${theme.shadows[1]};
          overflow: hidden;
        }

        @media (prefers-reduced-motion: reduce) {
          .transaction-history {
            transition: none;
          }
        }

        @media (max-width: ${theme.breakpoints.values.md}px) {
          .transaction-history {
            border-radius: 0;
          }
        }
      `}</style>
    </DashboardLayout>
  );
});

BillingHistory.displayName = 'BillingHistory';

export default BillingHistory;