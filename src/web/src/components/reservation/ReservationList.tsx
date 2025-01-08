import React, { useState, useEffect, useCallback, useRef } from 'react';
import styled from '@emotion/styled';
import { ReservationCard, ReservationCardProps } from './ReservationCard';
import { Pagination } from '../common/Pagination';
import { useReservation } from '../../hooks/useReservation';
import { ReservationStatus } from '../../types/reservation';
import { METRICS_CONFIG, ENVIRONMENTAL_CONFIG } from '../../config/constants';

// Styled components
const ListContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 16px;
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    padding: 16px;
  }
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 48px;
  color: ${props => props.theme.colors.secondaryText};
  font-size: 16px;
  role: 'status';
  aria-live: 'polite';
`;

const LoadingOverlay = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 200px;
  role: 'alert';
  aria-busy: 'true';
`;

const FilterContainer = styled.div`
  display: flex;
  gap: 16px;
  margin-bottom: 24px;
  flex-wrap: wrap;

  @media (max-width: 768px) {
    flex-direction: column;
  }
`;

// Props interface
interface ReservationListProps {
  filter?: ReservationStatus | 'all' | FilterCriteria;
  pageSize?: number;
  className?: string;
  showEnvironmentalMetrics?: boolean;
  enableRealTimeUpdates?: boolean;
  highContrastMode?: boolean;
}

interface FilterCriteria {
  status: ReservationStatus[];
  dateRange: DateRange;
  gpuTypes: string[];
  environmentalImpact: boolean;
}

const ReservationList: React.FC<ReservationListProps> = ({
  filter = 'all',
  pageSize = 10,
  className,
  showEnvironmentalMetrics = true,
  enableRealTimeUpdates = true,
  highContrastMode = false
}) => {
  // State and hooks
  const [currentPage, setCurrentPage] = useState(1);
  const [displayedReservations, setDisplayedReservations] = useState<ReservationCardProps[]>([]);
  const updateTimeoutRef = useRef<NodeJS.Timeout>();

  const {
    reservations,
    loading,
    error,
    updateReservation,
    cancelReservation,
    refreshReservations,
    environmentalMetrics,
    subscribeToUpdates
  } = useReservation();

  // Filter reservations based on criteria
  const filterReservations = useCallback(() => {
    let filtered = [...reservations];

    if (filter !== 'all') {
      if (typeof filter === 'string') {
        filtered = filtered.filter(r => r.status === filter);
      } else {
        filtered = filtered.filter(r => {
          return (
            filter.status.includes(r.status) &&
            filter.gpuTypes.includes(r.gpu.specifications.model) &&
            (filter.environmentalImpact ? r.carbon_offset > 0 : true)
          );
        });
      }
    }

    return filtered;
  }, [reservations, filter]);

  // Handle page changes
  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
    const startIndex = (page - 1) * pageSize;
    const filtered = filterReservations();
    setDisplayedReservations(filtered.slice(startIndex, startIndex + pageSize));

    // Announce page change to screen readers
    const announcement = `Page ${page} of ${Math.ceil(filtered.length / pageSize)}`;
    const ariaLive = document.getElementById('page-change-announcement');
    if (ariaLive) {
      ariaLive.textContent = announcement;
    }
  }, [pageSize, filterReservations]);

  // Handle reservation updates
  const handleReservationUpdate = useCallback(async (
    id: string,
    data: Partial<ReservationCardProps>
  ) => {
    try {
      await updateReservation(id, data);
      refreshReservations();
    } catch (error) {
      console.error('Failed to update reservation:', error);
    }
  }, [updateReservation, refreshReservations]);

  // Setup real-time updates
  useEffect(() => {
    if (enableRealTimeUpdates) {
      const filtered = filterReservations();
      filtered.forEach(reservation => {
        subscribeToUpdates(reservation.id);
      });
    }

    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, [enableRealTimeUpdates, filterReservations, subscribeToUpdates]);

  // Update displayed reservations when filter changes
  useEffect(() => {
    handlePageChange(1);
  }, [filter, handlePageChange]);

  if (loading) {
    return (
      <LoadingOverlay>
        <span>Loading reservations...</span>
      </LoadingOverlay>
    );
  }

  if (error) {
    return (
      <EmptyState>
        Error loading reservations: {error}
        <button onClick={refreshReservations}>Retry</button>
      </EmptyState>
    );
  }

  const filtered = filterReservations();
  if (filtered.length === 0) {
    return (
      <EmptyState>
        No reservations found
      </EmptyState>
    );
  }

  return (
    <div className={className}>
      {/* Accessibility announcement */}
      <div id="page-change-announcement" className="sr-only" aria-live="polite" />

      <ListContainer>
        {displayedReservations.map(reservation => (
          <ReservationCard
            key={reservation.id}
            {...reservation}
            onUpdate={handleReservationUpdate}
            onCancel={cancelReservation}
            environmentalMetrics={showEnvironmentalMetrics}
            refreshInterval={METRICS_CONFIG.UPDATE_INTERVAL_MS}
            highContrast={highContrastMode}
          />
        ))}
      </ListContainer>

      <Pagination
        currentPage={currentPage}
        totalItems={filtered.length}
        pageSize={pageSize}
        onPageChange={handlePageChange}
        ariaLabel="Reservation list navigation"
      />
    </div>
  );
};

export default ReservationList;