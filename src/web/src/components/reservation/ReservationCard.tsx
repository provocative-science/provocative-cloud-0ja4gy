import React, { useState, useCallback, useEffect, useRef } from 'react';
import styled from '@emotion/styled';
import { formatDistance } from 'date-fns';
import { debounce } from 'lodash';

import { Card } from '../common/Card';
import { GpuMetrics } from '../gpu/GpuMetrics';
import { useReservation } from '../../hooks/useReservation';
import { useWebSocket } from '../../hooks/useWebSocket';

import { ReservationStatus, DeploymentStatus } from '../../types/reservation';
import { ENVIRONMENTAL_CONFIG } from '../../config/constants';

// Styled components
const StyledCard = styled(Card)`
  margin: 16px 0;
  padding: 24px;
  width: 100%;
  transition: all 0.2s ease-in-out;
  position: relative;

  @media (max-width: 768px) {
    padding: 16px;
    margin: 12px 0;
  }
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
`;

const Title = styled.h3`
  margin: 0;
  color: ${props => props.theme.colors.primaryText};
  font-size: 1.2rem;
`;

const Status = styled.span<{ status: ReservationStatus }>`
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.875rem;
  font-weight: 500;
  background-color: ${props => {
    switch (props.status) {
      case ReservationStatus.ACTIVE:
        return '#2ECC71';
      case ReservationStatus.PENDING:
        return '#F1C40F';
      case ReservationStatus.COMPLETED:
        return '#3498DB';
      case ReservationStatus.CANCELLED:
        return '#E74C3C';
      default:
        return '#95A5A6';
    }
  }};
  color: white;
`;

const MetricsContainer = styled.div`
  margin-top: 16px;
  padding: 16px;
  background-color: ${props => props.theme.colors.background};
  border-radius: 8px;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const EnvironmentalMetrics = styled.div`
  margin-top: 16px;
  padding: 16px;
  background-color: ${props => props.theme.colors.background};
  border-radius: 8px;
`;

const Controls = styled.div`
  display: flex;
  gap: 8px;
  margin-top: 16px;

  @media (max-width: 768px) {
    flex-direction: column;
  }
`;

const Button = styled.button<{ variant?: 'primary' | 'danger' }>`
  padding: 8px 16px;
  border-radius: 4px;
  border: none;
  font-weight: 500;
  cursor: pointer;
  background-color: ${props => 
    props.variant === 'danger' 
      ? props.theme.colors.alert 
      : props.theme.colors.accent};
  color: white;
  transition: opacity 0.2s;

  &:hover {
    opacity: 0.9;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

// Props interface
interface ReservationCardProps {
  reservation: ReservationDetails;
  onUpdate: (id: string, data: Partial<ReservationDetails>) => Promise<void>;
  onCancel: (id: string) => Promise<void>;
  className?: string;
  environmentalMetrics?: boolean;
  refreshInterval?: number;
  onError?: (error: Error) => void;
}

export const ReservationCard: React.FC<ReservationCardProps> = ({
  reservation,
  onUpdate,
  onCancel,
  className,
  environmentalMetrics = true,
  refreshInterval = 5000,
  onError
}) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const { updateReservation } = useReservation();
  const updateTimeoutRef = useRef<NodeJS.Timeout>();

  // WebSocket setup for real-time updates
  const { isConnected, error } = useWebSocket({
    autoConnect: true,
    onMessage: handleMetricsUpdate,
    onError: (wsError) => onError?.(wsError)
  });

  // Format duration string
  const formatDuration = useCallback((startTime: number, endTime: number) => {
    return formatDistance(new Date(startTime), new Date(endTime), { addSuffix: true });
  }, []);

  // Handle metrics updates with debouncing
  const handleMetricsUpdate = debounce(async (data: any) => {
    try {
      if (data.gpuId === reservation.gpu.id) {
        await onUpdate(reservation.reservation.id, {
          metrics: data.metrics,
          reservation: {
            ...reservation.reservation,
            carbon_offset: data.carbonMetrics.co2CapturedKg
          }
        });
      }
    } catch (error) {
      onError?.(error as Error);
    }
  }, 1000);

  // Handle reservation cancellation
  const handleCancel = async () => {
    try {
      setIsUpdating(true);
      await onCancel(reservation.reservation.id);
    } catch (error) {
      onError?.(error as Error);
    } finally {
      setIsUpdating(false);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
      handleMetricsUpdate.cancel();
    };
  }, [handleMetricsUpdate]);

  return (
    <StyledCard className={className}>
      <Header>
        <Title>
          {reservation.gpu.specifications.model} - {reservation.gpu.specifications.vram_gb}GB
        </Title>
        <Status status={reservation.reservation.status}>
          {reservation.reservation.status}
        </Status>
      </Header>

      <div>
        <p>Duration: {formatDuration(
          reservation.reservation.start_time,
          reservation.reservation.end_time
        )}</p>
        <p>Cost: ${reservation.reservation.total_cost.toFixed(2)}</p>
      </div>

      <MetricsContainer>
        <GpuMetrics
          gpuId={reservation.gpu.id}
          refreshInterval={refreshInterval}
          environmentalMetrics={environmentalMetrics}
        />
      </MetricsContainer>

      {environmentalMetrics && (
        <EnvironmentalMetrics>
          <h4>Environmental Impact</h4>
          <p>CO₂ Captured: {reservation.reservation.carbon_offset.toFixed(2)} kg</p>
          <p>Power Efficiency: {(
            (1 - (reservation.metrics.powerUsageWatts / reservation.gpu.specifications.max_power_watts)) * 100
          ).toFixed(1)}%</p>
        </EnvironmentalMetrics>
      )}

      <Controls>
        {reservation.reservation.status === ReservationStatus.ACTIVE && (
          <Button
            variant="danger"
            onClick={handleCancel}
            disabled={isUpdating}
          >
            Cancel Reservation
          </Button>
        )}
        {reservation.deployment_status === DeploymentStatus.READY && (
          <>
            {reservation.jupyter_url && (
              <Button
                as="a"
                href={reservation.jupyter_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open Jupyter
              </Button>
            )}
            {reservation.ssh_connection_string && (
              <Button onClick={() => navigator.clipboard.writeText(reservation.ssh_connection_string)}>
                Copy SSH Command
              </Button>
            )}
          </>
        )}
      </Controls>
    </StyledCard>
  );
};

export default ReservationCard;