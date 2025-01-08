import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { Container, Typography, Box, Alert, Skeleton, CircularProgress } from '@mui/material';
import { useSnackbar } from 'notistack';
import { analytics } from '@segment/analytics-next';

import MainLayout from '../../layouts/MainLayout';
import PaymentForm from '../../components/billing/PaymentForm';
import { Payment, Currency, PaymentStatus, PaymentError } from '../../types/billing';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';

// Constants
const PAYMENT_RETRY_DELAY = 3000;
const MAX_RETRY_ATTEMPTS = 3;

interface PaymentPageState {
  amount: number;
  currency: Currency;
  reservationDetails?: {
    id: string;
    gpuModel: string;
    duration: number;
  };
}

const PaymentPage: React.FC = () => {
  const navigate = useNavigate();
  const { reservationId } = useParams<{ reservationId: string }>();
  const location = useLocation();
  const { enqueueSnackbar } = useSnackbar();
  const { isAuthenticated, user } = useAuth();
  const { theme } = useTheme();

  // State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<PaymentError | null>(null);
  const [paymentState, setPaymentState] = useState<PaymentPageState | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  // Initialize analytics
  useEffect(() => {
    analytics.page('Payment Page', {
      reservationId,
      userId: user?.id,
      timestamp: new Date().toISOString()
    });
  }, [reservationId, user?.id]);

  // Load reservation details and validate state
  useEffect(() => {
    const validateAndLoadState = async () => {
      try {
        if (!isAuthenticated) {
          throw new Error('Authentication required');
        }

        if (!reservationId) {
          throw new Error('Reservation ID is required');
        }

        const state = location.state as PaymentPageState;
        if (!state?.amount || !state?.currency || !state?.reservationDetails) {
          throw new Error('Invalid payment state');
        }

        setPaymentState(state);
      } catch (error) {
        setError({
          code: 'validation_error',
          message: error.message,
          details: {}
        });
        enqueueSnackbar(error.message, { variant: 'error' });
      } finally {
        setLoading(false);
      }
    };

    validateAndLoadState();
  }, [isAuthenticated, reservationId, location.state, enqueueSnackbar]);

  // Handle successful payment
  const handlePaymentSuccess = useCallback((payment: Payment) => {
    analytics.track('Payment Success', {
      paymentId: payment.id,
      amount: payment.amount,
      currency: payment.currency,
      reservationId: payment.reservationId,
      timestamp: new Date().toISOString()
    });

    enqueueSnackbar('Payment processed successfully', { variant: 'success' });
    navigate(`/reservations/${payment.reservationId}`, { 
      replace: true,
      state: { paymentStatus: PaymentStatus.COMPLETED }
    });
  }, [navigate, enqueueSnackbar]);

  // Handle payment error with retry mechanism
  const handlePaymentError = useCallback((error: PaymentError) => {
    setError(error);
    analytics.track('Payment Error', {
      error: error.code,
      message: error.message,
      retryCount,
      timestamp: new Date().toISOString()
    });

    if (retryCount < MAX_RETRY_ATTEMPTS) {
      enqueueSnackbar('Payment failed. Retrying...', { variant: 'warning' });
      setTimeout(() => {
        setRetryCount(prev => prev + 1);
        setError(null);
      }, PAYMENT_RETRY_DELAY);
    } else {
      enqueueSnackbar('Payment failed. Please try again later.', { variant: 'error' });
    }
  }, [retryCount, enqueueSnackbar]);

  // Render loading state
  if (loading) {
    return (
      <MainLayout>
        <Container maxWidth="md">
          <Box py={4}>
            <Skeleton variant="rectangular" height={200} />
            <Box mt={2}>
              <Skeleton variant="text" width="60%" />
              <Skeleton variant="text" width="40%" />
            </Box>
          </Box>
        </Container>
      </MainLayout>
    );
  }

  // Render error state
  if (error && retryCount >= MAX_RETRY_ATTEMPTS) {
    return (
      <MainLayout>
        <Container maxWidth="md">
          <Box py={4}>
            <Alert 
              severity="error"
              action={
                <Button
                  onClick={() => {
                    setRetryCount(0);
                    setError(null);
                  }}
                  color="inherit"
                >
                  Retry
                </Button>
              }
            >
              {error.message}
            </Alert>
          </Box>
        </Container>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <Container maxWidth="md">
        <Box py={4}>
          <Typography variant="h4" component="h1" gutterBottom>
            Complete Your Payment
          </Typography>

          {paymentState?.reservationDetails && (
            <Box mb={4}>
              <Typography variant="h6" gutterBottom>
                Reservation Details
              </Typography>
              <Typography>
                GPU Model: {paymentState.reservationDetails.gpuModel}
              </Typography>
              <Typography>
                Duration: {paymentState.reservationDetails.duration} hours
              </Typography>
            </Box>
          )}

          {paymentState && (
            <PaymentForm
              reservationId={reservationId!}
              amount={paymentState.amount}
              currency={paymentState.currency}
              onSuccess={handlePaymentSuccess}
              onError={handlePaymentError}
              className="payment-form"
              testId="payment-form"
            />
          )}

          {retryCount > 0 && (
            <Box mt={2}>
              <Typography color="textSecondary" variant="body2">
                Retry attempt {retryCount} of {MAX_RETRY_ATTEMPTS}
              </Typography>
            </Box>
          )}
        </Box>
      </Container>
    </MainLayout>
  );
};

export default PaymentPage;