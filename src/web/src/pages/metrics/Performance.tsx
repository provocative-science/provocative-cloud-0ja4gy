import React, { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { Box, Container, Grid, Typography, Select, MenuItem, CircularProgress, Alert } from '@mui/material';
import { styled } from '@mui/material/styles';

import DashboardLayout from '../../layouts/DashboardLayout';
import PerformanceMetrics from '../../components/metrics/PerformanceMetrics';
import { useMetrics } from '../../hooks/useMetrics';
import { MetricsTimeRange } from '../../types/metrics';
import { METRICS_CONFIG, ENVIRONMENTAL_CONFIG } from '../../config/constants';

// Styled components
const StyledContainer = styled(Container)(({ theme }) => ({
  padding: theme.spacing(3),
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  role: 'main',
  'aria-label': 'Performance Metrics Dashboard'
}));

const StyledHeader = styled(Box)(({ theme }) => ({
  marginBottom: theme.spacing(3),
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  flexDirection: {
    xs: 'column',
    sm: 'row'
  },
  gap: theme.spacing(2)
}));

const StyledMetricsContainer = styled(Box)(({ theme }) => ({
  flex: 1,
  minHeight: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(3)
}));

interface MetricsPageProps {
  gpuId?: string;
  serverId?: string;
  initialTimeRange?: MetricsTimeRange;
}

const Performance: React.FC<MetricsPageProps> = memo(({
  gpuId,
  serverId,
  initialTimeRange = MetricsTimeRange.LAST_HOUR
}) => {
  // State management
  const [timeRange, setTimeRange] = useState<MetricsTimeRange>(initialTimeRange);

  // Fetch metrics data
  const {
    gpuMetrics,
    carbonMetrics,
    systemMetrics,
    loading,
    error,
    connectionStatus,
    lastUpdated,
    refetch
  } = useMetrics({
    gpuId,
    serverId,
    timeRange
  });

  // Handle time range changes
  const handleTimeRangeChange = useCallback((event: React.ChangeEvent<{ value: unknown }>) => {
    const newRange = event.target.value as MetricsTimeRange;
    setTimeRange(newRange);
  }, []);

  // Memoize environmental efficiency calculation
  const environmentalEfficiency = useMemo(() => {
    if (!carbonMetrics) return null;

    const pueEfficiency = (ENVIRONMENTAL_CONFIG.EFFECTIVENESS_RATIOS.TARGET_PUE / carbonMetrics.powerUsageEffectiveness) * 100;
    const cueEfficiency = (ENVIRONMENTAL_CONFIG.EFFECTIVENESS_RATIOS.TARGET_CUE / carbonMetrics.carbonUsageEffectiveness) * 100;
    const wueEfficiency = (ENVIRONMENTAL_CONFIG.EFFECTIVENESS_RATIOS.TARGET_WUE / carbonMetrics.waterUsageEffectiveness) * 100;

    return {
      pueEfficiency,
      cueEfficiency,
      wueEfficiency,
      overall: (pueEfficiency + cueEfficiency + wueEfficiency) / 3
    };
  }, [carbonMetrics]);

  // Effect for handling WebSocket connection status
  useEffect(() => {
    if (connectionStatus === 'error') {
      console.error('WebSocket connection error - falling back to polling');
    }
  }, [connectionStatus]);

  return (
    <DashboardLayout>
      <StyledContainer maxWidth="xl">
        <StyledHeader>
          <Typography variant="h4" component="h1">
            Performance Metrics
          </Typography>
          <Box display="flex" alignItems="center" gap={2}>
            <Select
              value={timeRange}
              onChange={handleTimeRangeChange}
              variant="outlined"
              size="small"
              aria-label="Time range selection"
            >
              <MenuItem value={MetricsTimeRange.LAST_HOUR}>Last Hour</MenuItem>
              <MenuItem value={MetricsTimeRange.LAST_DAY}>Last 24 Hours</MenuItem>
              <MenuItem value={MetricsTimeRange.LAST_WEEK}>Last Week</MenuItem>
              <MenuItem value={MetricsTimeRange.LAST_MONTH}>Last Month</MenuItem>
            </Select>
            {connectionStatus === 'connected' && (
              <Typography variant="body2" color="textSecondary">
                Last updated: {new Date(lastUpdated).toLocaleTimeString()}
              </Typography>
            )}
          </Box>
        </StyledHeader>

        {loading && (
          <Box display="flex" justifyContent="center" p={4}>
            <CircularProgress aria-label="Loading metrics data" />
          </Box>
        )}

        {error && (
          <Alert 
            severity="error" 
            sx={{ mb: 3 }}
            aria-live="polite"
          >
            {error}
          </Alert>
        )}

        <StyledMetricsContainer>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <PerformanceMetrics
                gpuId={gpuId}
                serverId={serverId}
                timeRange={timeRange}
                environmentalMetrics={carbonMetrics}
                refreshInterval={METRICS_CONFIG.CHART_REFRESH_MS}
              />
            </Grid>

            {environmentalEfficiency && (
              <Grid item xs={12}>
                <Box
                  bgcolor="background.paper"
                  p={3}
                  borderRadius={1}
                  aria-label="Environmental efficiency metrics"
                >
                  <Typography variant="h6" gutterBottom>
                    Environmental Impact
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6} md={3}>
                      <Typography variant="subtitle2">Power Usage Efficiency</Typography>
                      <Typography>
                        {environmentalEfficiency.pueEfficiency.toFixed(1)}% of target
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Typography variant="subtitle2">Carbon Usage Efficiency</Typography>
                      <Typography>
                        {environmentalEfficiency.cueEfficiency.toFixed(1)}% of target
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Typography variant="subtitle2">Water Usage Efficiency</Typography>
                      <Typography>
                        {environmentalEfficiency.wueEfficiency.toFixed(1)}% of target
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Typography variant="subtitle2">Overall Efficiency</Typography>
                      <Typography>
                        {environmentalEfficiency.overall.toFixed(1)}%
                      </Typography>
                    </Grid>
                  </Grid>
                </Box>
              </Grid>
            )}
          </Grid>
        </StyledMetricsContainer>
      </StyledContainer>
    </DashboardLayout>
  );
});

Performance.displayName = 'Performance';

export default Performance;