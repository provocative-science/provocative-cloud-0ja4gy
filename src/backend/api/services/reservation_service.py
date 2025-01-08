"""
Service layer for managing GPU reservations with integrated environmental impact tracking.
Handles business logic for creating, updating, and managing GPU rental periods with
carbon capture system integration.
"""

import asyncio
from datetime import datetime
from typing import Dict, Optional
from uuid import UUID

from prometheus_client import Counter, Gauge, Histogram
from environmental_metrics import CarbonMetricsCollector, calculate_carbon_impact

from api.schemas.reservation import (
    ReservationBase, ReservationCreate, ReservationUpdate, ReservationResponse
)
from api.utils.logger import get_logger
from api.utils.gpu_metrics import GPUMetricsManager
from api.utils.carbon_metrics import (
    calculate_co2_emissions,
    calculate_carbon_capture,
    calculate_carbon_effectiveness
)

# Environmental metrics configuration
ENVIRONMENTAL_METRICS = {
    "co2_capture_rate": 0.5,
    "cooling_efficiency_threshold": 0.8,
    "power_usage_effectiveness": 1.2
}

# Cooling system states
COOLING_SYSTEM_STATES = ["optimal", "degraded", "maintenance_required"]

# Initialize Prometheus metrics
RESERVATION_COUNTER = Counter(
    'gpu_reservations_total',
    'Total number of GPU reservations',
    ['status']
)

ENVIRONMENTAL_IMPACT_GAUGE = Gauge(
    'gpu_environmental_impact',
    'Environmental impact metrics for GPU usage',
    ['gpu_id', 'metric_type']
)

COOLING_EFFICIENCY_GAUGE = Gauge(
    'gpu_cooling_efficiency',
    'Cooling system efficiency metrics',
    ['gpu_id']
)

# Initialize logger
logger = get_logger(__name__)

class ReservationService:
    """Service class for managing GPU reservations with environmental impact tracking."""

    def __init__(self, db_session, env_metrics, gpu_service, billing_service):
        """Initialize reservation service with environmental monitoring."""
        self._db = db_session
        self._env_metrics = env_metrics
        self._gpu_service = gpu_service
        self._billing_service = billing_service
        self._metrics_manager = GPUMetricsManager()
        self._carbon_collector = CarbonMetricsCollector()

    async def create_reservation(self, reservation_data: ReservationCreate) -> ReservationResponse:
        """Create a new GPU reservation with environmental impact assessment."""
        try:
            # Validate GPU availability
            gpu = await self._gpu_service.get_gpu(reservation_data.gpu_id)
            if not gpu.available:
                raise ValueError("Selected GPU is not available")

            # Check cooling system status
            cooling_status = await self._check_cooling_status(gpu.id)
            if cooling_status == "maintenance_required":
                raise ValueError("Cooling system maintenance required")

            # Calculate initial environmental impact
            env_impact = await self._calculate_environmental_impact(
                gpu.id,
                reservation_data.duration_hours
            )

            # Create reservation with environmental tracking
            reservation = ReservationBase(
                user_id=reservation_data.user_id,
                gpu_id=reservation_data.gpu_id,
                start_time=reservation_data.start_time,
                end_time=reservation_data.start_time + \
                    timedelta(hours=reservation_data.duration_hours),
                auto_renew=reservation_data.auto_renew,
                environmental_impact=env_impact,
                cooling_status=cooling_status
            )

            # Validate reservation times
            reservation.validate_times(reservation.end_time, 
                                    {"start_time": reservation.start_time})

            # Process payment
            payment = await self._billing_service.process_reservation_payment(
                reservation_data.user_id,
                gpu.price_per_hour * reservation_data.duration_hours
            )

            # Save reservation
            db_reservation = await self._db.add(reservation)
            await self._db.commit()

            # Initialize environmental monitoring
            await self._initialize_monitoring(db_reservation.id, gpu.id)

            # Update metrics
            RESERVATION_COUNTER.labels(status='created').inc()
            ENVIRONMENTAL_IMPACT_GAUGE.labels(
                gpu_id=str(gpu.id),
                metric_type='co2_captured'
            ).set(env_impact['co2_captured_kg'])

            return ReservationResponse(
                reservation=db_reservation,
                gpu=gpu,
                payment=payment,
                environmental_metrics=env_impact
            )

        except Exception as e:
            await self._db.rollback()
            logger.error(f"Reservation creation failed: {str(e)}")
            raise

    async def monitor_environmental_impact(self, reservation_id: UUID) -> Dict:
        """Track and optimize environmental metrics for reservation."""
        try:
            reservation = await self._db.get(reservation_id)
            if not reservation:
                raise ValueError("Reservation not found")

            # Collect current metrics
            gpu_metrics = await self._metrics_manager.get_metrics(
                reservation.gpu_id,
                include_environmental=True
            )

            # Calculate environmental impact
            co2_emissions = calculate_co2_emissions(gpu_metrics)
            co2_captured = calculate_carbon_capture(co2_emissions)
            effectiveness = calculate_carbon_effectiveness(
                co2_emissions,
                co2_captured
            )

            # Update environmental metrics
            env_metrics = {
                'co2_emissions_kg': co2_emissions,
                'co2_captured_kg': co2_captured,
                'effectiveness_ratio': effectiveness,
                'cooling_efficiency': gpu_metrics['cooling_efficiency'],
                'power_usage_kwh': gpu_metrics['power_usage'] / 1000,
                'timestamp': datetime.utcnow()
            }

            # Update Prometheus metrics
            ENVIRONMENTAL_IMPACT_GAUGE.labels(
                gpu_id=str(reservation.gpu_id),
                metric_type='effectiveness'
            ).set(effectiveness)
            
            COOLING_EFFICIENCY_GAUGE.labels(
                gpu_id=str(reservation.gpu_id)
            ).set(gpu_metrics['cooling_efficiency'])

            # Check for optimizations
            if effectiveness < ENVIRONMENTAL_METRICS['co2_capture_rate']:
                await self._optimize_environmental_impact(reservation.gpu_id)

            return env_metrics

        except Exception as e:
            logger.error(f"Environmental monitoring failed: {str(e)}")
            raise

    async def _check_cooling_status(self, gpu_id: UUID) -> str:
        """Check cooling system status and efficiency."""
        try:
            metrics = await self._metrics_manager.get_metrics(gpu_id)
            efficiency = metrics['cooling_efficiency']

            if efficiency < ENVIRONMENTAL_METRICS['cooling_efficiency_threshold']:
                if efficiency < 0.6:
                    return "maintenance_required"
                return "degraded"
            return "optimal"

        except Exception as e:
            logger.error(f"Cooling status check failed: {str(e)}")
            raise

    async def _calculate_environmental_impact(
        self,
        gpu_id: UUID,
        duration_hours: int
    ) -> Dict:
        """Calculate projected environmental impact for reservation."""
        try:
            gpu_metrics = await self._metrics_manager.get_metrics(gpu_id)
            
            return calculate_carbon_impact(
                gpu_metrics['power_usage'],
                duration_hours,
                gpu_metrics['cooling_efficiency'],
                ENVIRONMENTAL_METRICS['co2_capture_rate']
            )

        except Exception as e:
            logger.error(f"Environmental impact calculation failed: {str(e)}")
            raise

    async def _initialize_monitoring(self, reservation_id: UUID, gpu_id: UUID) -> None:
        """Initialize environmental monitoring for reservation."""
        try:
            # Start metrics collection
            await self._metrics_manager.start_collection(
                include_environmental=True
            )

            # Initialize carbon metrics collection
            self._carbon_collector.start_collection()

            logger.info(
                f"Environmental monitoring initialized for reservation {reservation_id}"
            )

        except Exception as e:
            logger.error(f"Monitoring initialization failed: {str(e)}")
            raise

    async def _optimize_environmental_impact(self, gpu_id: UUID) -> None:
        """Optimize GPU operation for better environmental efficiency."""
        try:
            await self._gpu_service.optimize_environmental_impact(gpu_id)
            logger.info(f"Environmental optimization applied for GPU {gpu_id}")

        except Exception as e:
            logger.error(f"Environmental optimization failed: {str(e)}")
            raise