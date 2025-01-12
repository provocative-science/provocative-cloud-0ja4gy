"""
Pydantic schema models for GPU resource management with integrated environmental impact tracking
in the Provocative Cloud platform.
"""

from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field, validator  # version: 2.0+
from typing import List

from api.schemas.metrics import GPUMetricsBase

# Global constants for GPU resource management
SUPPORTED_GPU_MODELS = ["NVIDIA A100", "NVIDIA V100"]
MIN_VRAM_GB = 16
MAX_VRAM_GB = 80
GPU_STATUS_CHOICES = ["available", "reserved", "maintenance", "error", "cooling_adjustment"]
MIN_COOLING_EFFICIENCY = 0.6
MAX_COOLING_EFFICIENCY = 1.0
MIN_POWER_LIMIT_WATTS = 100
MAX_POWER_LIMIT_WATTS = 400

class GPUBase(BaseModel):
    """Base schema for GPU resource information with environmental metrics."""
    id: UUID = Field(default=None)
    server_id: UUID = Field(..., description="ID of the server hosting this GPU")
    model: str = Field(..., description="GPU model name")
    vram_gb: int = Field(..., ge=MIN_VRAM_GB, le=MAX_VRAM_GB, description="GPU VRAM in GB")
    price_per_hour: Decimal = Field(..., gt=0, description="Hourly rental price")
    maintenance_mode: bool = Field(default=False, description="GPU maintenance status")
    cooling_efficiency: float = Field(
        default=0.8,
        ge=MIN_COOLING_EFFICIENCY,
        le=MAX_COOLING_EFFICIENCY,
        description="Cooling system efficiency"
    )
    power_limit_watts: int = Field(
        default=250,
        ge=MIN_POWER_LIMIT_WATTS,
        le=MAX_POWER_LIMIT_WATTS,
        description="GPU power limit in watts"
    )
    created_at: datetime = Field(default_factory=datetime.utcnow)

    @validator('model')
    def validate_model(cls, value: str) -> str:
        """Validates GPU model against supported models."""
        if value not in SUPPORTED_GPU_MODELS:
            raise ValueError(f"Unsupported GPU model. Must be one of: {', '.join(SUPPORTED_GPU_MODELS)}")
        return value

    @validator('cooling_efficiency')
    def validate_cooling_efficiency(cls, value: float) -> float:
        """Validates GPU cooling efficiency metrics."""
        if not MIN_COOLING_EFFICIENCY <= value <= MAX_COOLING_EFFICIENCY:
            raise ValueError(
                f"Cooling efficiency must be between {MIN_COOLING_EFFICIENCY} and {MAX_COOLING_EFFICIENCY}"
            )
        return value

    @validator('power_limit_watts')
    def validate_power_limit(cls, value: int) -> int:
        """Validates GPU power limit settings."""
        if not MIN_POWER_LIMIT_WATTS <= value <= MAX_POWER_LIMIT_WATTS:
            raise ValueError(
                f"Power limit must be between {MIN_POWER_LIMIT_WATTS} and {MAX_POWER_LIMIT_WATTS} watts"
            )
        return value

class GPUCreate(BaseModel):
    """Schema for creating new GPU resources with environmental settings."""
    server_id: UUID = Field(..., description="ID of the server hosting this GPU")
    model: str = Field(..., description="GPU model name")
    vram_gb: int = Field(..., ge=MIN_VRAM_GB, le=MAX_VRAM_GB)
    price_per_hour: Decimal = Field(..., gt=0)
    cooling_efficiency: Optional[float] = Field(
        default=0.8,
        ge=MIN_COOLING_EFFICIENCY,
        le=MAX_COOLING_EFFICIENCY
    )
    power_limit_watts: Optional[int] = Field(
        default=250,
        ge=MIN_POWER_LIMIT_WATTS,
        le=MAX_POWER_LIMIT_WATTS
    )

class GPUUpdate(BaseModel):
    """Schema for updating GPU resource information including environmental metrics."""
    price_per_hour: Decimal = Field(default=None, gt=0)
    maintenance_mode: bool = Field(default=None)
    cooling_efficiency: float = Field(
        default=None,
        ge=MIN_COOLING_EFFICIENCY,
        le=MAX_COOLING_EFFICIENCY
    )
    power_limit_watts: int = Field(
        default=None,
        ge=MIN_POWER_LIMIT_WATTS,
        le=MAX_POWER_LIMIT_WATTS
    )
    power_management_enabled: bool = Field(default=True)

class GPUResponse(BaseModel):
    """Schema for GPU API responses with environmental impact data."""
    gpu: GPUBase
    metrics: GPUMetricsBase
    available: bool = Field(default=True)
    status: str = Field(default="available")
    environmental_metrics: dict = Field(default_factory=dict)
    carbon_impact: float = Field(default=0.0, ge=0.0)

    @validator('status')
    def validate_status(cls, value: str) -> str:
        """Validates GPU status including cooling states."""
        if value not in GPU_STATUS_CHOICES:
            raise ValueError(f"Invalid status. Must be one of: {', '.join(GPU_STATUS_CHOICES)}")
        return value

    @validator('environmental_metrics')
    def validate_environmental_metrics(cls, value: dict) -> dict:
        """Validates environmental impact metrics."""
        required_keys = {'cooling_efficiency', 'power_usage', 'carbon_impact'}
        if not all(key in value for key in required_keys):
            raise ValueError(f"Environmental metrics must include: {', '.join(required_keys)}")

        if not 0 <= value.get('cooling_efficiency', 0) <= 1:
            raise ValueError("Cooling efficiency must be between 0 and 1")

        if value.get('power_usage', 0) < 0:
            raise ValueError("Power usage cannot be negative")

        if value.get('carbon_impact', 0) < 0:
            raise ValueError("Carbon impact cannot be negative")

        return value

class GPUMetrics(BaseModel):
    """Schema for representing individual GPU metrics."""
    power_usage_watts: float
    utilization_percent: float
    temperature_celsius: float
    fan_speed_percent: Optional[float] = None

    def validate_schema(self):
        """Placeholder schema validation."""
        return True

    def validate_metrics(self):
        """Placeholder metrics validation."""
        return True

    def validate_environmental_metrics(self):
        """Placeholder environmental metrics validation."""
        return True

from pydantic import BaseModel, Field
from decimal import Decimal
from typing import Optional

class GPUEnvironmental(BaseModel):
    """Pydantic model representing environmental metrics for GPUs."""
    power_efficiency: Decimal = Field(..., description="Power efficiency of the GPU")
    thermal_efficiency: Decimal = Field(..., description="Thermal efficiency of the GPU")
    carbon_efficiency: Decimal = Field(..., description="Carbon efficiency of the GPU")
    cooling_status: Optional[str] = Field(None, description="Status of the GPU cooling system")

    class Config:
        schema_extra = {
            "example": {
                "power_efficiency": "0.95",
                "thermal_efficiency": "0.90",
                "carbon_efficiency": "0.80",
                "cooling_status": "optimized"
            }
        }

