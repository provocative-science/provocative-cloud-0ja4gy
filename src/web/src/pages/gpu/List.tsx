import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Skeleton, Alert } from '@mui/material'; // ^5.0.0
import styled from '@emotion/styled';

import Layout from '../../components/common/Layout';
import { GpuList } from '../../components/gpu/GpuList';
import { useGpu } from '../../hooks/useGpu';
import { GPU, GPUModel, GPUStatus } from '../../types/gpu';

// Styled components
const StyledContainer = styled(Container)`
  padding-top: ${({ theme }) => theme.spacing(3)};
  padding-bottom: ${({ theme }) => theme.spacing(3)};
  min-height: 400px;
  position: relative;

  @media (max-width: 768px) {
    padding-top: ${({ theme }) => theme.spacing(2)};
    padding-bottom: ${({ theme }) => theme.spacing(2)};
  }
`;

const MetricsOverview = styled.div`
  margin-bottom: ${({ theme }) => theme.spacing(3)};
  padding: ${({ theme }) => theme.spacing(2)};
  background-color: ${({ theme }) => theme.palette.background.paper};
  border-radius: ${({ theme }) => theme.shape.borderRadius}px;
  box-shadow: ${({ theme }) => theme.shadows[1]};
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: ${({ theme }) => theme.spacing(2)};
`;

const MetricCard = styled.div`
  padding: ${({ theme }) => theme.spacing(2)};
  text-align: center;
  border-right: 1px solid ${({ theme }) => theme.palette.divider};

  &:last-child {
    border-right: none;
  }

  h3 {
    margin: 0;
    font-size: 0.875rem;
    color: ${({ theme }) => theme.palette.text.secondary};
  }

  p {
    margin: ${({ theme }) => theme.spacing(1)} 0 0;
    font-size: 1.5rem;
    font-weight: 600;
    color: ${({ theme }) => theme.palette.text.primary};
  }
`;

const GpuListPage: React.FC = () => {
  const navigate = useNavigate();
  const [filter, setFilter] = useState({
    model: Object.values(GPUModel),
    min_vram_gb: 0,
    max_price_per_hour: 10,
    status: [GPUStatus.AVAILABLE]
  });

  const {
    gpus,
    loading,
    error,
    environmentalMetrics,
    aggregatedMetrics,
    refreshGpus,
    isConnected
  } = useGpu(filter);

  // Handle WebSocket disconnection
  useEffect(() => {
    if (!isConnected) {
      refreshGpus();
    }
  }, [isConnected, refreshGpus]);

  // Handle GPU selection
  const handleGpuSelect = useCallback((gpu: GPU) => {
    navigate(`/gpu/${gpu.id}`);
  }, [navigate]);

  // Handle GPU rental
  const handleRentGpu = useCallback((gpu: GPU) => {
    navigate(`/gpu/${gpu.id}/rent`);
  }, [navigate]);

  if (loading) {
    return (
      <Layout withSidebar>
        <StyledContainer>
          <Skeleton variant="rectangular" height={200} />
          <Skeleton variant="rectangular" height={400} sx={{ mt: 3 }} />
        </StyledContainer>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout withSidebar>
        <StyledContainer>
          <Alert 
            severity="error" 
            sx={{ mb: 3 }}
            action={
              <button onClick={refreshGpus}>Retry</button>
            }
          >
            {error}
          </Alert>
        </StyledContainer>
      </Layout>
    );
  }

  return (
    <Layout withSidebar>
      <StyledContainer>
        <MetricsOverview>
          <MetricCard>
            <h3>Available GPUs</h3>
            <p>{gpus.filter(gpu => gpu.status === GPUStatus.AVAILABLE).length}</p>
          </MetricCard>
          <MetricCard>
            <h3>CO₂ Captured</h3>
            <p>{environmentalMetrics.co2CapturedKg.toFixed(2)} kg</p>
          </MetricCard>
          <MetricCard>
            <h3>Power Efficiency</h3>
            <p>{environmentalMetrics.powerUsageEffectiveness.toFixed(2)} PUE</p>
          </MetricCard>
          <MetricCard>
            <h3>Average Utilization</h3>
            <p>{aggregatedMetrics.averageUtilization.toFixed(1)}%</p>
          </MetricCard>
        </MetricsOverview>

        <GpuList
          filter={filter}
          onGpuSelect={handleGpuSelect}
          onRentGpu={handleRentGpu}
          showMetrics={true}
          showEnvironmentalData={true}
          virtualScrolling={true}
          accessibilityMode={false}
        />
      </StyledContainer>
    </Layout>
  );
};

export default GpuListPage;