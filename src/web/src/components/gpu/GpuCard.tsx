import React, { useCallback, useMemo } from 'react';
import styled from '@emotion/styled';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { MetricsChart } from '../metrics/MetricsChart';
import { GPU } from '../../types/gpu';
import { ENVIRONMENTAL_CONFIG } from '../../config/constants';

// Props interface for the GpuCard component
interface GpuCardProps {
  gpu: GPU;
  onClick?: (gpu: GPU) => void;
  onRent?: (gpu: GPU) => void;
  showMetrics?: boolean;
  showEnvironmentalMetrics?: boolean;
  className?: string;
  compact?: boolean;
  ariaLabel?: string;
  highContrast?: boolean;
}

// Styled components
const CardContainer = styled(Card)<{ clickable: boolean }>`
  width: 100%;
  max-width: 400px;
  margin: 8px;
  cursor: ${props => props.clickable ? 'pointer' : 'default'};
  transition: all 0.2s ease-in-out;

  @media (prefers-reduced-motion) {
    transition: none;
  }

  &:hover {
    transform: ${props => props.clickable ? 'translateY(-2px)' : 'none'};
    box-shadow: ${props => props.clickable ? props.theme.shadows.medium : props.theme.shadows.small};
  }
`;

const MetricsContainer = styled.div`
  height: 120px;
  margin-top: 16px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const EnvironmentalMetricsContainer = styled.div<{ highContrast?: boolean }>`
  padding: 16px;
  background-color: ${props => props.highContrast 
    ? props.theme.colors.background.secondary 
    : props.theme.colors.background.tertiary};
  border-radius: 4px;
  margin-top: 16px;
`;

const SpecificationList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 8px 0;
`;

const SpecificationItem = styled.li`
  display: flex;
  justify-content: space-between;
  margin-bottom: 4px;
  font-size: 0.9rem;
`;

const PriceTag = styled.div`
  font-size: 1.2rem;
  font-weight: 600;
  color: ${props => props.theme.colors.accent};
  margin: 8px 0;
`;

const StatusBadge = styled.span<{ status: string }>`
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 0.8rem;
  font-weight: 500;
  background-color: ${props => {
    switch (props.status) {
      case 'available': return props.theme.colors.success;
      case 'in_use': return props.theme.colors.warning;
      case 'maintenance': return props.theme.colors.error;
      default: return props.theme.colors.neutral;
    }
  }};
  color: ${props => props.theme.colors.text.onAccent};
`;

// Helper functions
const formatPrice = (price: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2
  }).format(price);
};

const formatEnvironmentalMetrics = (metrics: GPU['metrics']['environmental_metrics']) => {
  const efficiency = (metrics.co2CapturedKg / ENVIRONMENTAL_CONFIG.CO2_CAPTURE_THRESHOLDS.TARGET_RATE_KG_PER_DAY) * 100;
  return {
    co2Captured: `${metrics.co2CapturedKg.toFixed(2)} kg`,
    efficiency: `${efficiency.toFixed(1)}%`,
    pue: metrics.powerUsageEffectiveness.toFixed(2)
  };
};

export const GpuCard: React.FC<GpuCardProps> = ({
  gpu,
  onClick,
  onRent,
  showMetrics = true,
  showEnvironmentalMetrics = true,
  className,
  compact = false,
  ariaLabel,
  highContrast = false
}) => {
  const handleClick = useCallback((event: React.MouseEvent) => {
    if (onClick) {
      onClick(gpu);
    }
  }, [gpu, onClick]);

  const handleRentClick = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    if (onRent && gpu.status === 'available') {
      onRent(gpu);
    }
  }, [gpu, onRent]);

  const environmentalMetrics = useMemo(() => {
    if (!gpu.metrics.environmental_metrics) return null;
    return formatEnvironmentalMetrics(gpu.metrics.environmental_metrics);
  }, [gpu.metrics.environmental_metrics]);

  return (
    <CardContainer
      clickable={!!onClick}
      onClick={handleClick}
      className={className}
      elevation={2}
      aria-label={ariaLabel || `${gpu.specifications.model} GPU Card`}
      role="article"
    >
      <StatusBadge status={gpu.status}>
        {gpu.status.toUpperCase()}
      </StatusBadge>

      <h3>{gpu.specifications.model}</h3>
      
      <SpecificationList>
        <SpecificationItem>
          <span>VRAM:</span>
          <span>{gpu.specifications.vram_gb} GB</span>
        </SpecificationItem>
        <SpecificationItem>
          <span>CUDA Cores:</span>
          <span>{gpu.specifications.cuda_cores}</span>
        </SpecificationItem>
        {!compact && (
          <SpecificationItem>
            <span>Tensor Cores:</span>
            <span>{gpu.specifications.tensor_cores}</span>
          </SpecificationItem>
        )}
      </SpecificationList>

      <PriceTag aria-label={`Price per hour: ${formatPrice(gpu.price_per_hour)}`}>
        {formatPrice(gpu.price_per_hour)}/hour
      </PriceTag>

      {showMetrics && (
        <MetricsContainer>
          <MetricsChart
            type="line"
            metricType="gpu"
            timeRange="1h"
            gpuId={gpu.id}
            height={100}
            accessibilityLabel={`GPU metrics for ${gpu.specifications.model}`}
          />
        </MetricsContainer>
      )}

      {showEnvironmentalMetrics && environmentalMetrics && (
        <EnvironmentalMetricsContainer highContrast={highContrast}>
          <h4>Environmental Impact</h4>
          <SpecificationList>
            <SpecificationItem>
              <span>CO₂ Captured:</span>
              <span>{environmentalMetrics.co2Captured}</span>
            </SpecificationItem>
            <SpecificationItem>
              <span>Capture Efficiency:</span>
              <span>{environmentalMetrics.efficiency}</span>
            </SpecificationItem>
            <SpecificationItem>
              <span>Power Usage (PUE):</span>
              <span>{environmentalMetrics.pue}</span>
            </SpecificationItem>
          </SpecificationList>
        </EnvironmentalMetricsContainer>
      )}

      {gpu.status === 'available' && onRent && (
        <Button
          variant="primary"
          size="medium"
          onClick={handleRentClick}
          fullWidth
          ariaLabel={`Rent ${gpu.specifications.model} GPU`}
          highContrast={highContrast}
        >
          Rent Now
        </Button>
      )}
    </CardContainer>
  );
};

export default React.memo(GpuCard);