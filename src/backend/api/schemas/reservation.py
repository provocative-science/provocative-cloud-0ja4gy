"""
Pydantic schema models for GPU reservation management in the Provocative Cloud platform,
with integrated environmental impact tracking and carbon capture metrics.
"""

from datetime import datetime, timedelta
from decimal import Decimal
from typing import Dict, Optional
from uuid import UUID

from pydantic import BaseModel, Field, validator

from api.schemas.gpu import GPUBase
from api.schemas.billing import PaymentBase

# Reservation status choices
RESERVATION_STATUS_CHOICES = ('pending', 'active', 'completed', 'cancelled', 'failed')
MIN_RENTAL_HOURS = 1
MAX_RENTAL_HOURS = 720  # 30 days
DEPLOYMENT_STATUS_CHOICES = ('pending', 'provisioning', 'ready', 'error')
COOLING_STATUS_CHOICES = ('optimal', 'degraded', 'critical')
CARBON_PREFERENCE_CHOICES = ('standard', 'eco_friendly', 'maximum_efficiency')

class ReservationBase(BaseModel):
    """Base schema for GPU reservation data with environmental metrics."""
    id: Optional[UUID] = Field(default=None)
    user_id: UUID = Field(..., description="User making the reservation")
    gpu_id: UUID = Field(..., description="GPU being reserved")
    start_time: datetime = Field(..., description="Reservation start time")
    end_time: datetime = Field(..., description="Reservation end time")
    auto_renew: bool = Field(default=False, description="Auto-renewal flag")
    status: str = Field(default='pending', description="Reservation status")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    environmental_impact: Dict[str, float] = Field(
        default_factory=dict,
        description="Environmental impact metrics"
    )
    cooling_status: str = Field(
        default='optimal',
        description="Cooling system status"
    )

    @validator('end_time')
    def validate_times(cls, end_time: datetime, values: Dict) -> datetime:
        """Validates reservation time period with cooling system checks."""
        start_time = values.get('start_time')
        if not start_time:
            raise ValueError("start_time is required")

        # Validate time order
        if end_time <= start_time:
            raise ValueError("end_time must be after start_time")

        # Calculate duration
        duration = (end_time - start_time).total_seconds() / 3600

        # Validate rental period
        if duration < MIN_RENTAL_HOURS:
            raise ValueError(f"Minimum rental period is {MIN_RENTAL_HOURS} hour")
        if duration > MAX_RENTAL_HOURS:
            raise ValueError(f"Maximum rental period is {MAX_RENTAL_HOURS} hours")

        return end_time

    @validator('environmental_impact')
    def validate_environmental_impact(cls, value: Dict[str, float]) -> Dict[str, float]:
        """Validates environmental impact metrics."""
        required_metrics = {
            'co2_captured_kg',
            'power_usage_kwh',
            'cooling_efficiency',
            'carbon_offset_kg'
        }

        # Validate required metrics
        if not all(metric in value for metric in required_metrics):
            raise ValueError(f"Required environmental metrics: {', '.join(required_metrics)}")

        # Validate metric ranges
        if not 0 <= value['cooling_efficiency'] <= 1:
            raise ValueError("Cooling efficiency must be between 0 and 1")

        if value['co2_captured_kg'] < 0:
            raise ValueError("CO2 capture cannot be negative")

        if value['power_usage_kwh'] < 0:
            raise ValueError("Power usage cannot be negative")

        if value['carbon_offset_kg'] < 0:
            raise ValueError("Carbon offset cannot be negative")

        return value

    @validator('cooling_status')
    def validate_cooling_status(cls, value: str) -> str:
        """Validates cooling system status."""
        if value not in COOLING_STATUS_CHOICES:
            raise ValueError(f"Cooling status must be one of: {', '.join(COOLING_STATUS_CHOICES)}")
        return value

class ReservationCreate(BaseModel):
    """Schema for creating new GPU reservations with environmental preferences."""
    user_id: UUID = Field(..., description="User making the reservation")
    gpu_id: UUID = Field(..., description="GPU to reserve")
    start_time: datetime = Field(..., description="Desired start time")
    duration_hours: int = Field(
        ...,
        ge=MIN_RENTAL_HOURS,
        le=MAX_RENTAL_HOURS,
        description="Rental duration in hours"
    )
    auto_renew: bool = Field(default=False, description="Auto-renewal flag")
    carbon_preference: str = Field(
        default='standard',
        description="Carbon capture preference"
    )

    @validator('carbon_preference')
    def validate_carbon_preference(cls, value: str) -> str:
        """Validates carbon preference selection."""
        if value not in CARBON_PREFERENCE_CHOICES:
            raise ValueError(f"Carbon preference must be one of: {', '.join(CARBON_PREFERENCE_CHOICES)}")
        return value

    @validator('start_time')
    def validate_start_time(cls, value: datetime) -> datetime:
        """Validates reservation start time."""
        now = datetime.utcnow()
        if value < now:
            raise ValueError("Start time cannot be in the past")
        return value

class ReservationResponse(BaseModel):
    """Schema for reservation API responses with environmental metrics."""
    reservation: ReservationBase
    gpu: GPUBase
    payment: PaymentBase
    deployment_status: str = Field(default='pending')
    ssh_connection_string: Optional[str] = None
    jupyter_url: Optional[str] = None
    environmental_metrics: Dict[str, float] = Field(
        default_factory=dict,
        description="Real-time environmental metrics"
    )
    cooling_efficiency: float = Field(
        default=1.0,
        ge=0.0,
        le=1.0,
        description="Current cooling system efficiency"
    )
    carbon_impact_report: Dict[str, Any] = Field(
        default_factory=dict,
        description="Detailed carbon impact analysis"
    )

    @validator('deployment_status')
    def validate_deployment_status(cls, value: str) -> str:
        """Validates deployment status."""
        if value not in DEPLOYMENT_STATUS_CHOICES:
            raise ValueError(f"Deployment status must be one of: {', '.join(DEPLOYMENT_STATUS_CHOICES)}")
        return value

    @validator('environmental_metrics')
    def validate_environmental_metrics(cls, value: Dict[str, float]) -> Dict[str, float]:
        """Validates real-time environmental metrics."""
        required_metrics = {
            'current_power_usage_watts',
            'temperature_celsius',
            'co2_capture_rate_kgh',
            'cooling_power_usage_watts'
        }

        if not all(metric in value for metric in required_metrics):
            raise ValueError(f"Required real-time metrics: {', '.join(required_metrics)}")

        return value