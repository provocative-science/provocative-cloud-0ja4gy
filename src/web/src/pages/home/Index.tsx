import React, { useCallback, useEffect, useMemo } from 'react';
import styled from '@emotion/styled';
import { Box, Container, Typography, useMediaQuery, Skeleton } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useInView } from 'react-intersection-observer';
import { ErrorBoundary } from 'react-error-boundary';

import Layout from '../../components/common/Layout';
import Button from '../../components/common/Button';
import GpuList from '../../components/gpu/GpuList';
import useAuth from '../../hooks/useAuth';
import useGpu from '../../hooks/useGpu';
import useWebSocket from '../../hooks/useWebSocket';

// Styled components
const HeroSection = styled(Box)`
  min-height: calc(100vh - 64px);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
  padding: ${({ theme }) => theme.spacing(8, 2)};
  background: ${({ theme }) => theme.palette.background.default};
  position: relative;
  overflow: hidden;
`;

const GpuSection = styled(Box)`
  padding: ${({ theme }) => theme.spacing(8, 0)};
  background: ${({ theme }) => theme.palette.background.paper};
`;

const EnvironmentalMetrics = styled(Box)`
  position: absolute;
  top: ${({ theme }) => theme.spacing(2)};
  right: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => theme.spacing(2)};
  border-radius: ${({ theme }) => theme.shape.borderRadius}px;
  background: ${({ theme }) => `rgba(${theme.palette.background.paper}, 0.8)`};
  backdrop-filter: blur(8px);
`;

// Constants
const HERO_TITLE = 'High-Performance GPU Rental with Carbon Capture Technology';
const HERO_SUBTITLE = 'Access powerful GPUs while contributing to environmental sustainability';
const ENVIRONMENTAL_METRICS_UPDATE_INTERVAL = 5000;

const HomePage: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { isAuthenticated } = useAuth();
  const { ref: heroRef, inView: heroInView } = useInView();

  // Initialize GPU data and metrics
  const {
    gpus,
    loading,
    error,
    environmentalMetrics,
    aggregatedMetrics,
    refreshGpus,
    isConnected
  } = useGpu();

  // Handle GPU selection
  const handleGpuSelect = useCallback((gpu) => {
    if (isAuthenticated) {
      window.location.href = `/gpu/${gpu.id}`;
    } else {
      window.location.href = '/login';
    }
  }, [isAuthenticated]);

  // Handle GPU rental
  const handleRentGpu = useCallback((gpu) => {
    if (isAuthenticated) {
      window.location.href = `/gpu/${gpu.id}/rent`;
    } else {
      window.location.href = '/login';
    }
  }, [isAuthenticated]);

  // Format environmental metrics for display
  const formattedMetrics = useMemo(() => ({
    co2Captured: `${environmentalMetrics.co2CapturedKg.toFixed(2)} kg`,
    efficiency: `${(environmentalMetrics.powerUsageEffectiveness * 100).toFixed(1)}%`,
    impact: `${aggregatedMetrics.totalCO2Captured.toFixed(2)} kg saved`
  }), [environmentalMetrics, aggregatedMetrics]);

  return (
    <Layout withFooter>
      <ErrorBoundary fallback={<div>Something went wrong</div>}>
        <HeroSection ref={heroRef}>
          <Container maxWidth="lg">
            <Typography
              variant="h1"
              component="h1"
              gutterBottom
              sx={{
                fontSize: { xs: '2rem', md: '3rem' },
                fontWeight: 700,
                marginBottom: 3
              }}
            >
              {HERO_TITLE}
            </Typography>
            <Typography
              variant="h2"
              component="h2"
              color="textSecondary"
              sx={{
                fontSize: { xs: '1.25rem', md: '1.5rem' },
                marginBottom: 4
              }}
            >
              {HERO_SUBTITLE}
            </Typography>
            <Button
              variant="primary"
              size="large"
              onClick={() => window.location.href = '/gpu'}
              ariaLabel="Browse available GPUs"
            >
              Browse GPUs
            </Button>

            <EnvironmentalMetrics>
              <Typography variant="h6" gutterBottom>
                Environmental Impact
              </Typography>
              <Box display="grid" gridTemplateColumns="1fr 1fr" gap={2}>
                <Box>
                  <Typography variant="subtitle2">CO₂ Captured</Typography>
                  <Typography variant="h6">{formattedMetrics.co2Captured}</Typography>
                </Box>
                <Box>
                  <Typography variant="subtitle2">Efficiency</Typography>
                  <Typography variant="h6">{formattedMetrics.efficiency}</Typography>
                </Box>
              </Box>
            </EnvironmentalMetrics>
          </Container>
        </HeroSection>

        <GpuSection>
          <Container maxWidth="lg">
            <Typography
              variant="h3"
              component="h2"
              gutterBottom
              sx={{ marginBottom: 4 }}
            >
              Available GPUs
            </Typography>
            <GpuList
              filter={{}}
              onGpuSelect={handleGpuSelect}
              onRentGpu={handleRentGpu}
              showMetrics
              showEnvironmentalData
              virtualScrolling
              accessibilityMode={false}
            />
          </Container>
        </GpuSection>
      </ErrorBoundary>
    </Layout>
  );
};

export default HomePage;