import React, { useEffect, useState, useCallback } from 'react';
import {
  Grid,
  Card,
  Typography,
  Button,
  CircularProgress,
  Alert,
  useTheme,
  useMediaQuery,
  Box,
  Divider,
  IconButton,
  Tooltip
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import { GPU, GPUStatus } from '../../types/gpu';
import { useGpu, EnvironmentalMetrics } from '../../hooks/useGpu';
import { ENVIRONMENTAL_CONFIG, METRICS_CONFIG, GPU_CONSTANTS } from '../../config/constants';

/**
 * UserDashboard Component
 * Displays GPU rentals and environmental metrics with real-time updates
 * @version 1.0.0
 */
const UserDashboard: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const {
    gpus,
    loading,
    error,
    environmentalMetrics,
    aggregatedMetrics,
    refreshGpus,
    isConnected
  } = useGpu();

  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  /**
   * Format environmental metrics for display
   */
  const formatMetric = (value: number, precision: number = 2): string => {
    return value.toFixed(precision);
  };

  /**
   * Calculate efficiency indicator color based on thresholds
   */
  const getEfficiencyColor = (value: number, target: number, max: number): string => {
    if (value <= target) return theme.palette.success.main;
    if (value <= max) return theme.palette.warning.main;
    return theme.palette.error.main;
  };

  /**
   * Handle manual refresh of metrics
   */
  const handleRefresh = useCallback(async () => {
    await refreshGpus();
    setLastUpdate(new Date());
  }, [refreshGpus]);

  /**
   * Render GPU rental card with metrics
   */
  const renderGPUCard = (gpu: GPU) => (
    <Card key={gpu.id} sx={{ p: 2, mb: 2 }}>
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6}>
          <Typography variant="h6">
            {gpu.specifications.model} - {gpu.specifications.vram_gb}GB
          </Typography>
          <Typography color="textSecondary">
            Status: {gpu.status === GPUStatus.IN_USE ? 'Running' : gpu.status}
          </Typography>
        </Grid>
        <Grid item xs={12} sm={6}>
          <Typography>
            Temperature: {formatMetric(gpu.metrics.temperatureCelsius)}°C
          </Typography>
          <Typography>
            Utilization: {formatMetric(gpu.metrics.utilizationPercent)}%
          </Typography>
          <Typography>
            Power: {formatMetric(gpu.metrics.powerUsageWatts)}W
          </Typography>
        </Grid>
      </Grid>
    </Card>
  );

  /**
   * Render environmental impact metrics
   */
  const renderEnvironmentalMetrics = () => (
    <Card sx={{ p: 2, mb: 2 }}>
      <Typography variant="h6" gutterBottom>
        Environmental Impact
      </Typography>
      <Grid container spacing={2}>
        <Grid item xs={12} md={4}>
          <Typography variant="subtitle1">Carbon Capture</Typography>
          <Typography variant="h4">
            {formatMetric(environmentalMetrics.co2CapturedKg)}
            <Typography component="span" variant="body2" color="textSecondary">
              {` ${ENVIRONMENTAL_CONFIG.MEASUREMENT_UNITS.CARBON_CAPTURE}`}
            </Typography>
          </Typography>
          <Typography color="textSecondary">
            Trend: {formatMetric(environmentalMetrics.trendData.co2CaptureRate * 100)}%
            {environmentalMetrics.trendData.co2CaptureRate > 0 ? (
              <TrendingUpIcon color="success" />
            ) : (
              <TrendingDownIcon color="error" />
            )}
          </Typography>
        </Grid>
        <Grid item xs={12} md={4}>
          <Typography variant="subtitle1">Power Usage Effectiveness</Typography>
          <Typography variant="h4" style={{
            color: getEfficiencyColor(
              environmentalMetrics.powerUsageEffectiveness,
              ENVIRONMENTAL_CONFIG.EFFECTIVENESS_RATIOS.TARGET_PUE,
              ENVIRONMENTAL_CONFIG.EFFECTIVENESS_RATIOS.MAX_PUE
            )
          }}>
            {formatMetric(environmentalMetrics.powerUsageEffectiveness, 3)}
          </Typography>
        </Grid>
        <Grid item xs={12} md={4}>
          <Typography variant="subtitle1">Water Usage Effectiveness</Typography>
          <Typography variant="h4" style={{
            color: getEfficiencyColor(
              environmentalMetrics.waterUsageEffectiveness,
              ENVIRONMENTAL_CONFIG.EFFECTIVENESS_RATIOS.TARGET_WUE,
              ENVIRONMENTAL_CONFIG.EFFECTIVENESS_RATIOS.MAX_WUE
            )
          }}>
            {formatMetric(environmentalMetrics.waterUsageEffectiveness, 3)}
          </Typography>
        </Grid>
      </Grid>
    </Card>
  );

  /**
   * Render connection status indicator
   */
  const renderConnectionStatus = () => (
    <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <Typography variant="body2" color="textSecondary">
        Last updated: {lastUpdate.toLocaleTimeString()}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography
          variant="body2"
          color={isConnected ? 'success.main' : 'error.main'}
        >
          {isConnected ? 'Connected' : 'Disconnected'}
        </Typography>
        <Tooltip title="Refresh">
          <IconButton onClick={handleRefresh} size="small">
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );

  // Auto-refresh effect
  useEffect(() => {
    const intervalId = setInterval(() => {
      setLastUpdate(new Date());
    }, METRICS_CONFIG.UPDATE_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, []);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
      </Alert>
    );
  }

  return (
    <Box sx={{ p: isMobile ? 2 : 3 }}>
      {renderConnectionStatus()}
      {renderEnvironmentalMetrics()}
      
      <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
        Active GPU Rentals
      </Typography>
      {gpus.length > 0 ? (
        gpus.map(renderGPUCard)
      ) : (
        <Typography color="textSecondary">
          No active GPU rentals
        </Typography>
      )}
      
      <Button
        variant="contained"
        color="primary"
        sx={{ mt: 2 }}
        href="/gpu/rent"
      >
        Rent GPU
      </Button>
    </Box>
  );
};

export default UserDashboard;