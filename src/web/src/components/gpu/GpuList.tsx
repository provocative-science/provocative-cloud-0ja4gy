import React, { useCallback, useMemo, useEffect } from 'react';
import styled from '@emotion/styled';
import { useMediaQuery } from '@mui/material';
import { useVirtualizer } from '@tanstack/react-virtual';
import { GpuCard, GpuCardProps } from './GpuCard';
import { useGpu } from '../../hooks/useGpu';
import { Loading } from '../common/Loading';
import { GPU } from '../../types/gpu';
import { ENVIRONMENTAL_CONFIG } from '../../config/constants';

// Styled components
const ListContainer = styled.div<{ $compact: boolean }>`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(${props => props.$compact ? '250px' : '300px'}, 1fr));
  gap: ${props => props.$compact ? '16px' : '24px'};
  padding: ${props => props.$compact ? '16px' : '24px'};
  width: 100%;
  max-width: 1440px;
  margin: 0 auto;
  position: relative;
  min-height: 200px;

  @media (max-width: 768px) {
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: 16px;
    padding: 16px;
  }
`;

const ErrorMessage = styled.div`
  color: var(--alert-light);
  text-align: center;
  padding: 24px;
  width: 100%;
  font-weight: var(--font-weight-medium);
  background-color: var(--background-light);
  border-radius: var(--border-radius-md);
  border: 1px solid var(--alert-light);
  margin: 16px;
  role: alert;
  aria-live: assertive;
`;

interface GpuListProps {
  filter: GPUFilter;
  onGpuSelect: (gpu: GPU) => void;
  onRentGpu: (gpu: GPU) => void;
  className?: string;
  showMetrics?: boolean;
  showEnvironmentalData?: boolean;
  virtualScrolling?: boolean;
  accessibilityMode?: boolean;
}

export const GpuList: React.FC<GpuListProps> = ({
  filter,
  onGpuSelect,
  onRentGpu,
  className = '',
  showMetrics = true,
  showEnvironmentalData = true,
  virtualScrolling = true,
  accessibilityMode = false
}) => {
  // Responsive layout handling
  const isCompact = useMediaQuery('(max-width: 768px)');

  // GPU data and metrics management
  const {
    gpus,
    loading,
    error,
    environmentalMetrics,
    aggregatedMetrics,
    refreshGpus,
    isConnected
  } = useGpu(filter);

  // Virtual scrolling setup for large lists
  const parentRef = React.useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: gpus.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => isCompact ? 300 : 400,
    overscan: 5
  });

  // Handle GPU selection with keyboard support
  const handleGpuClick = useCallback((gpu: GPU, event: React.KeyboardEvent | React.MouseEvent) => {
    if ('key' in event && event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    if (gpu.status === 'available') {
      onGpuSelect(gpu);
      
      // Announce selection to screen readers
      if (accessibilityMode) {
        const announcement = `Selected ${gpu.specifications.model} GPU with ${gpu.specifications.vram_gb}GB VRAM`;
        window.dispatchEvent(new CustomEvent('announce', { detail: announcement }));
      }
    }
  }, [onGpuSelect, accessibilityMode]);

  // Handle GPU rental request
  const handleRentClick = useCallback((gpu: GPU, event: React.MouseEvent) => {
    event.stopPropagation();
    
    if (gpu.status === 'available') {
      // Validate environmental metrics before rental
      const isEnvironmentallyEfficient = 
        environmentalMetrics.powerUsageEffectiveness <= ENVIRONMENTAL_CONFIG.EFFECTIVENESS_RATIOS.TARGET_PUE &&
        environmentalMetrics.carbonUsageEffectiveness <= ENVIRONMENTAL_CONFIG.EFFECTIVENESS_RATIOS.TARGET_CUE;

      if (!isEnvironmentallyEfficient) {
        console.warn('GPU rental may impact environmental metrics');
      }

      onRentGpu(gpu);
    }
  }, [onRentGpu, environmentalMetrics]);

  // Refresh data when WebSocket connection changes
  useEffect(() => {
    if (!isConnected) {
      refreshGpus();
    }
  }, [isConnected, refreshGpus]);

  // Memoized GPU cards with environmental data
  const gpuCards = useMemo(() => {
    if (virtualScrolling) {
      return rowVirtualizer.getVirtualItems().map(virtualRow => {
        const gpu = gpus[virtualRow.index];
        return (
          <GpuCard
            key={gpu.id}
            gpu={gpu}
            onClick={(event) => handleGpuClick(gpu, event)}
            onRent={(event) => handleRentClick(gpu, event)}
            showMetrics={showMetrics}
            showEnvironmentalMetrics={showEnvironmentalData}
            compact={isCompact}
            ariaLabel={`${gpu.specifications.model} GPU with ${gpu.specifications.vram_gb}GB VRAM, ${gpu.status}`}
            highContrast={accessibilityMode}
          />
        );
      });
    }

    return gpus.map(gpu => (
      <GpuCard
        key={gpu.id}
        gpu={gpu}
        onClick={(event) => handleGpuClick(gpu, event)}
        onRent={(event) => handleRentClick(gpu, event)}
        showMetrics={showMetrics}
        showEnvironmentalMetrics={showEnvironmentalData}
        compact={isCompact}
        ariaLabel={`${gpu.specifications.model} GPU with ${gpu.specifications.vram_gb}GB VRAM, ${gpu.status}`}
        highContrast={accessibilityMode}
      />
    ));
  }, [gpus, virtualScrolling, showMetrics, showEnvironmentalData, isCompact, accessibilityMode, handleGpuClick, handleRentClick]);

  if (loading) {
    return <Loading size="lg" text="Loading GPU data..." />;
  }

  if (error) {
    return (
      <ErrorMessage>
        Error loading GPU data: {error}
      </ErrorMessage>
    );
  }

  return (
    <ListContainer
      ref={parentRef}
      className={className}
      $compact={isCompact}
      role="list"
      aria-label="Available GPUs"
      aria-live="polite"
    >
      {gpuCards.length > 0 ? gpuCards : (
        <ErrorMessage>
          No GPUs found matching the current filters
        </ErrorMessage>
      )}
    </ListContainer>
  );
};

export type { GpuListProps };