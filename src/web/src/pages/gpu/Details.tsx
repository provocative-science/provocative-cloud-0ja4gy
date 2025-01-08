import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Box, 
  Card, 
  CardContent, 
  Typography, 
  CircularProgress, 
  Alert,
  IconButton,
  Tooltip
} from '@mui/material';
import { ErrorBoundary } from 'react-error-boundary';
import RefreshIcon from '@mui/icons-material/Refresh';

import { GpuDetails } from '../../components/gpu/GpuDetails';
import { getGPUById } from '../../api/gpus';
import { GPU, GPUStatus } from '../../types/gpu';
import { useGpu } from '../../hooks/useGpu';
import { useMetrics } from '../../hooks/useMetrics';
import { METRICS_CONFIG, ENVIRONMENTAL_CONFIG } from '../../config/constants';

// Constants for component behavior
const METRICS_REFRESH_INTERVAL = 5000;
const ERROR_RETRY_ATTEMPTS = 3;
const CACHE_DURATION = 60000;

/**
 * Error Fallback component for error boundary
 */
const ErrorFallback = ({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) => (
  <Box p={3}>
    <Alert 
      severity="error" 
      action={
        <IconButton
          color="inherit"
          size="small"
          onClick={resetErrorBoundary}
        >
          <RefreshIcon />
        </IconButton>
      }
    >
      {error.message}
    </Alert>
  </Box>
);

/**
 * Custom hook for managing GPU data fetching and state
 */
const useGPUData = (gpuId: string) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const { setSelectedGpu } = useGpu();

  const fetchGPUData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getGPUById(gpuId);
      setSelectedGpu(response.data);
      setRetryCount(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch GPU details');
      if (retryCount < ERROR_RETRY_ATTEMPTS) {
        setRetryCount(prev => prev + 1);
        setTimeout(fetchGPUData, 1000 * Math.pow(2, retryCount));
      }
    } finally {
      setLoading(false);
    }
  }, [gpuId, retryCount, setSelectedGpu]);

  return { loading, error, retryCount, fetchGPUData };
};

/**
 * GPU Details page component with enhanced error handling and real-time updates
 */
const GPUDetailsPage: React.FC = () => {
  const { gpuId } = useParams<{ gpuId: string }>();
  const navigate = useNavigate();
  const { loading, error, fetchGPUData } = useGPUData(gpuId!);
  const { selectedGpu, environmentalMetrics } = useGpu();

  // Set up metrics monitoring
  const { 
    gpuMetrics, 
    carbonMetrics,
    connectionStatus,
    refetch: refreshMetrics 
  } = useMetrics({
    gpuId: gpuId!,
    timeRange: METRICS_CONFIG.DEFAULT_TIME_RANGE
  });

  // Initial data fetch
  useEffect(() => {
    if (!gpuId) {
      navigate('/gpus');
      return;
    }
    fetchGPUData();
  }, [gpuId, fetchGPUData, navigate]);

  // Handle refresh action
  const handleRefresh = useCallback(() => {
    fetchGPUData();
    refreshMetrics();
  }, [fetchGPUData, refreshMetrics]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={3}>
        <Alert 
          severity="error"
          action={
            <IconButton
              color="inherit"
              size="small"
              onClick={handleRefresh}
            >
              <RefreshIcon />
            </IconButton>
          }
        >
          {error}
        </Alert>
      </Box>
    );
  }

  if (!selectedGpu) {
    return (
      <Box p={3}>
        <Alert severity="warning">GPU not found</Alert>
      </Box>
    );
  }

  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onReset={handleRefresh}
    >
      <Box p={3}>
        <GpuDetails
          gpuId={selectedGpu.id}
          showMetrics={true}
          showEnvironmentalMetrics={true}
          onClose={() => navigate('/gpus')}
          className="gpu-details-container"
        />

        <Box mt={2} display="flex" justifyContent="flex-end" alignItems="center">
          <Typography variant="caption" color="textSecondary" sx={{ mr: 2 }}>
            Connection status: {connectionStatus}
          </Typography>
          <Tooltip title="Refresh data">
            <IconButton onClick={handleRefresh} size="small">
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
    </ErrorBoundary>
  );
};

export default GPUDetailsPage;