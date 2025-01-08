import React, { useEffect, useState, useCallback } from 'react';
import styled from '@emotion/styled';
import { format, formatDistance, formatDuration } from 'date-fns';
import { Card } from '../common/Card';
import { GpuMetrics } from '../gpu/GpuMetrics';
import { useReservation } from '../../hooks/useReservation';

// Styled components
const DetailsContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.5rem;
`;

const MetricsContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1rem;
  margin-top: 1.5rem;
  height: 400px;
`;

const EnvironmentalMetricsCard = styled.div`
  padding: 1rem;
  background-color: var(--metrics-bg);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
`;

// Props interface
interface ReservationDetailsProps {
  reservationId: string;
  onClose: () => void;
  className?: string;
  showEnvironmentalMetrics?: boolean;
}

// Environmental metrics interface
interface EnvironmentalMetrics {
  co2Captured: number;
  pue: number;
  cue: number;
  wue: number;
  timestamp: Date;
}

export const ReservationDetails: React.FC<ReservationDetailsProps> = ({
  reservationId,
  onClose,
  className,
  showEnvironmentalMetrics = true
}) => {
  const {
    currentReservation,
    updateReservation,
    cancelReservation,
    error,
    wsStatus
  } = useReservation();

  const [environmentalMetrics, setEnvironmentalMetrics] = useState<EnvironmentalMetrics | null>(null);

  // Handle reservation extension
  const handleExtendReservation = useCallback(async (additionalHours: number) => {
    if (!currentReservation) return;

    try {
      const newEndTime = new Date(currentReservation.reservation.end_time).getTime() + 
        (additionalHours * 60 * 60 * 1000);

      await updateReservation(currentReservation.reservation.id, {
        end_time: newEndTime
      });

      // Update environmental metrics subscription
      if (showEnvironmentalMetrics) {
        // Re-subscribe to metrics for extended duration
      }
    } catch (error) {
      console.error('Failed to extend reservation:', error);
    }
  }, [currentReservation, updateReservation, showEnvironmentalMetrics]);

  // Render environmental metrics
  const renderEnvironmentalMetrics = useCallback((metrics: EnvironmentalMetrics) => {
    return (
      <EnvironmentalMetricsCard>
        <h3>Environmental Impact</h3>
        <div>
          <div>CO₂ Captured: {metrics.co2Captured.toFixed(2)} kg</div>
          <div>Power Usage Effectiveness: {metrics.pue.toFixed(3)}</div>
          <div>Carbon Usage Effectiveness: {metrics.cue.toFixed(3)}</div>
          <div>Water Usage Effectiveness: {metrics.wue.toFixed(3)}</div>
          <div>Last Updated: {format(metrics.timestamp, 'PPp')}</div>
        </div>
      </EnvironmentalMetricsCard>
    );
  }, []);

  // Effect for fetching initial data
  useEffect(() => {
    if (!currentReservation || !showEnvironmentalMetrics) return;

    // Subscribe to environmental metrics updates
    const metricsSubscription = {
      gpuId: currentReservation.gpu.id,
      environmentalMetrics: true
    };

    return () => {
      // Cleanup subscriptions
    };
  }, [currentReservation, showEnvironmentalMetrics]);

  if (!currentReservation) {
    return (
      <Card className={className}>
        <div>No reservation data available</div>
      </Card>
    );
  }

  const { reservation, gpu, deployment_status, metrics } = currentReservation;

  return (
    <Card className={className}>
      <DetailsContainer>
        <h2>Reservation Details</h2>
        
        {/* Basic Information */}
        <div>
          <div>Status: {reservation.status}</div>
          <div>
            Duration: {formatDistance(
              new Date(reservation.start_time),
              new Date(reservation.end_time)
            )}
          </div>
          <div>Total Cost: ${reservation.total_cost.toFixed(2)}</div>
        </div>

        {/* GPU Information */}
        <div>
          <h3>GPU Details</h3>
          <div>Model: {gpu.specifications.model}</div>
          <div>VRAM: {gpu.specifications.vram_gb}GB</div>
          <div>Status: {gpu.status}</div>
        </div>

        {/* Deployment Information */}
        <div>
          <h3>Deployment Status</h3>
          <div>Status: {deployment_status}</div>
          {currentReservation.ssh_connection_string && (
            <div>SSH Connection: {currentReservation.ssh_connection_string}</div>
          )}
          {currentReservation.jupyter_url && (
            <div>Jupyter URL: <a href={currentReservation.jupyter_url} target="_blank" rel="noopener noreferrer">
              {currentReservation.jupyter_url}
            </a></div>
          )}
        </div>

        {/* Metrics */}
        <MetricsContainer>
          <GpuMetrics
            gpuId={gpu.id}
            showEnvironmental={showEnvironmentalMetrics}
          />
          {showEnvironmentalMetrics && environmentalMetrics && 
            renderEnvironmentalMetrics(environmentalMetrics)
          }
        </MetricsContainer>

        {/* Actions */}
        <div>
          <button 
            onClick={() => handleExtendReservation(1)}
            disabled={reservation.status !== 'active'}
          >
            Extend 1 Hour
          </button>
          <button 
            onClick={() => cancelReservation(reservation.id)}
            disabled={reservation.status !== 'active'}
          >
            Cancel Reservation
          </button>
        </div>

        {/* Connection Status */}
        <div>
          WebSocket Status: {wsStatus}
          {error && <div className="error">Error: {error}</div>}
        </div>
      </DetailsContainer>
    </Card>
  );
};

export default ReservationDetails;