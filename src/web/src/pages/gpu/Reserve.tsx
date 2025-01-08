import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { Container, Typography, Box, Skeleton, Alert, CircularProgress } from '@mui/material';
import { debounce } from 'lodash';
import { ErrorBoundary } from 'react-error-boundary';

import DashboardLayout from '../../layouts/DashboardLayout';
import GpuReservationForm from '../../components/gpu/GpuReservationForm';
import useGpu from '../../hooks/useGpu';
import useWebSocket from '../../hooks/useWebSocket';
import { ReservationCreate, DeploymentStatus } from '../../types/reservation';
import { GPU_CONSTANTS, ENVIRONMENTAL_CONFIG } from '../../config/constants';

/**
 * Enhanced GPU reservation page component with real-time updates and environmental metrics
 */
const ReservePage: React.FC = () => {
  const navigate = useNavigate();
  const { gpuId } = useParams<{ gpuId: string }>();
  const location = useLocation();

  // State management
  const [error, setError] = useState<string | null>(null);
  const [deploymentStatus, setDeploymentStatus] = useState<DeploymentStatus>(DeploymentStatus.PENDING);

  // Custom hooks
  const { 
    gpus, 
    selectedGpu, 
    setSelectedGpu, 
    loading, 
    error: gpuError,
    environmentalMetrics,
    refreshGpus 
  } = useGpu();

  // WebSocket connection for real-time updates
  const { 
    isConnected: wsConnected,
    connect: wsConnect,
    subscribe: wsSubscribe,
    disconnect: wsDisconnect
  } = useWebSocket({
    autoConnect: true,
    onMessage: handleMetricsUpdate,
    onError: (err) => setError(err.message)
  });

  // Handle real-time metrics updates
  const handleMetricsUpdate = useCallback(debounce((data: any) => {
    if (data.type === 'gpu_metrics' && selectedGpu?.id === data.gpuId) {
      refreshGpus();
    } else if (data.type === 'environmental_metrics') {
      // Update environmental impact calculations
    }
  }, 1000), [selectedGpu, refreshGpus]);

  // Initialize WebSocket connection and subscriptions
  useEffect(() => {
    if (gpuId && wsConnected) {
      wsSubscribe(gpuId);
    }
    return () => {
      wsDisconnect();
    };
  }, [gpuId, wsConnected, wsSubscribe, wsDisconnect]);

  // Handle form submission
  const handleSubmit = useCallback(async (formData: ReservationCreate) => {
    try {
      setError(null);
      setDeploymentStatus(DeploymentStatus.PROVISIONING);

      // Validate environmental impact thresholds
      const co2Impact = environmentalMetrics.co2CapturedKg;
      if (co2Impact < ENVIRONMENTAL_CONFIG.CO2_CAPTURE_THRESHOLDS.MIN_RATE_KG_PER_DAY) {
        throw new Error('CO2 capture rate below minimum threshold');
      }

      // Create reservation
      const response = await fetch('/api/v1/reservations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        throw new Error('Failed to create reservation');
      }

      const reservation = await response.json();
      navigate(`/reservations/${reservation.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create reservation');
      setDeploymentStatus(DeploymentStatus.ERROR);
    }
  }, [navigate, environmentalMetrics]);

  // Handle cancellation
  const handleCancel = useCallback(() => {
    navigate('/dashboard');
  }, [navigate]);

  // Loading state
  if (loading) {
    return (
      <DashboardLayout>
        <Container maxWidth="lg">
          <Box py={4}>
            <Skeleton variant="rectangular" height={400} />
          </Box>
        </Container>
      </DashboardLayout>
    );
  }

  // Error state
  if (gpuError || error) {
    return (
      <DashboardLayout>
        <Container maxWidth="lg">
          <Box py={4}>
            <Alert severity="error">
              {gpuError || error}
            </Alert>
          </Box>
        </Container>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <Container maxWidth="lg">
        <Box py={4}>
          <Typography variant="h4" component="h1" gutterBottom>
            Reserve GPU
          </Typography>

          {!wsConnected && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              Real-time updates unavailable. Reconnecting...
            </Alert>
          )}

          <GpuReservationForm
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            initialGpuId={gpuId}
          />

          {deploymentStatus === DeploymentStatus.PROVISIONING && (
            <Box display="flex" alignItems="center" mt={2}>
              <CircularProgress size={20} sx={{ mr: 1 }} />
              <Typography>
                Provisioning your GPU environment...
              </Typography>
            </Box>
          )}
        </Box>
      </Container>
    </DashboardLayout>
  );
};

// Add error boundary wrapper
const ReservePageWithErrorBoundary: React.FC = () => (
  <ErrorBoundary
    FallbackComponent={({ error }) => (
      <DashboardLayout>
        <Container maxWidth="lg">
          <Box py={4}>
            <Alert severity="error">
              {error.message}
            </Alert>
          </Box>
        </Container>
      </DashboardLayout>
    )}
  >
    <ReservePage />
  </ErrorBoundary>
);

export default ReservePageWithErrorBoundary;