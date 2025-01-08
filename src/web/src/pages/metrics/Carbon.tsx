import React, { useState, useCallback, useEffect } from 'react';
import { Box, Container, Typography, Select, MenuItem, Tooltip, CircularProgress, Alert } from '@mui/material';
import { debounce } from 'lodash';
import { useWebSocket } from 'react-use-websocket';
import { ErrorBoundary } from 'react-error-boundary';

import DashboardLayout from '../../layouts/DashboardLayout';
import CarbonMetrics from '../../components/metrics/CarbonMetrics';
import { MetricsTimeRange } from '../../types/metrics';
import { ENVIRONMENTAL_CONFIG } from '../../config/constants';

// Constants
const REFRESH_INTERVAL = 30000; // 30 seconds
const WS_RECONNECT_DELAY = 5000;
const DEFAULT_TIME_RANGE = '24h';

const CarbonPage: React.FC = () => {
  // State management
  const [timeRange, setTimeRange] = useState<MetricsTimeRange>(MetricsTimeRange.LAST_DAY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // WebSocket setup for real-time updates
  const { sendMessage, lastMessage, readyState } = useWebSocket(
    `${process.env.REACT_APP_WS_URL}/metrics/carbon`,
    {
      reconnectAttempts: 5,
      reconnectInterval: WS_RECONNECT_DELAY,
      shouldReconnect: true
    }
  );

  // Handle time range changes with debouncing
  const handleTimeRangeChange = useCallback(
    debounce((event: React.ChangeEvent<{ value: unknown }>) => {
      const newRange = event.target.value as MetricsTimeRange;
      setTimeRange(newRange);
      
      // Update URL parameters
      const searchParams = new URLSearchParams(window.location.search);
      searchParams.set('timeRange', newRange);
      window.history.replaceState(
        null,
        '',
        `${window.location.pathname}?${searchParams.toString()}`
      );
    }, 500),
    []
  );

  // Handle errors from metrics component
  const handleError = useCallback((error: Error) => {
    console.error('Carbon metrics error:', error);
    setError(error.message);
  }, []);

  // Initialize time range from URL parameters
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const urlTimeRange = searchParams.get('timeRange') as MetricsTimeRange;
    if (urlTimeRange && Object.values(MetricsTimeRange).includes(urlTimeRange)) {
      setTimeRange(urlTimeRange);
    }
  }, []);

  // Subscribe to real-time updates
  useEffect(() => {
    if (readyState === 1) { // WebSocket.OPEN
      sendMessage(JSON.stringify({
        type: 'subscribe',
        timeRange
      }));
    }
    return () => {
      if (readyState === 1) {
        sendMessage(JSON.stringify({ type: 'unsubscribe' }));
      }
    };
  }, [readyState, sendMessage, timeRange]);

  return (
    <DashboardLayout>
      <Container maxWidth="xl">
        <Box sx={{ marginTop: 3, marginBottom: 3, position: 'relative' }}>
          {/* Title section with tooltips */}
          <Box sx={{ 
            marginBottom: 4, 
            display: 'flex', 
            alignItems: 'center',
            gap: 1 
          }}>
            <Typography variant="h4" component="h1">
              Environmental Impact
            </Typography>
            <Tooltip title="Real-time monitoring of CO2 capture and environmental efficiency metrics">
              <Typography 
                variant="subtitle1" 
                color="text.secondary"
                sx={{ marginLeft: 2 }}
              >
                Track carbon capture and efficiency metrics in real-time
              </Typography>
            </Tooltip>
          </Box>

          {/* Time range selector */}
          <Box sx={{ marginBottom: 3, minWidth: 200 }}>
            <Select
              value={timeRange}
              onChange={handleTimeRangeChange}
              fullWidth
              variant="outlined"
              disabled={loading}
            >
              <MenuItem value={MetricsTimeRange.LAST_HOUR}>Last Hour</MenuItem>
              <MenuItem value={MetricsTimeRange.LAST_DAY}>Last 24 Hours</MenuItem>
              <MenuItem value={MetricsTimeRange.LAST_WEEK}>Last 7 Days</MenuItem>
              <MenuItem value={MetricsTimeRange.LAST_MONTH}>Last 30 Days</MenuItem>
            </Select>
          </Box>

          {/* Loading overlay */}
          {loading && (
            <Box sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(255, 255, 255, 0.7)',
              zIndex: 1
            }}>
              <CircularProgress />
            </Box>
          )}

          {/* Error display */}
          {error && (
            <Alert 
              severity="error" 
              onClose={() => setError(null)}
              sx={{ marginBottom: 2 }}
            >
              {error}
            </Alert>
          )}

          {/* Main metrics component */}
          <ErrorBoundary
            fallback={<Alert severity="error">Failed to load environmental metrics</Alert>}
            onError={handleError}
          >
            <CarbonMetrics
              timeRange={timeRange}
              refreshInterval={REFRESH_INTERVAL}
              onError={handleError}
            />
          </ErrorBoundary>
        </Box>
      </Container>
    </DashboardLayout>
  );
};

export default CarbonPage;