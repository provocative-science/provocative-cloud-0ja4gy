"""
Pydantic schema models for validating and serializing GPU, carbon capture, and system metrics
data in the Provocative Cloud platform with enhanced validation and environmental metrics tracking.
"""

from datetime import datetime
from typing import Dict, List, Optional
from uuid import UUID, uuid4

from pydantic import BaseModel, Field, validator, root_validator  # version: 2.0+

from db.models.metrics import Base
from api.utils.gpu_metrics import collect_gpu_metrics
from api.utils.carbon_metrics import (
    calculate_power_usage_effectiveness,
    calculate_carbon_usage_effectiveness,
    calculate_co2_captured
)

class GPUMetricsBase(BaseModel):
    """Enhanced Pydantic model for GPU performance metrics with comprehensive validation."""
    id: UUID = Field(default_factory=uuid4)
    gpu_id: UUID
    temperature_celsius: float = Field(ge=0, le=120)
    power_usage_watts: int = Field(ge=0, le=1000)
    memory_used_gb: float = Field(ge=0)
    memory_total_gb: float = Field(ge=0)
    utilization_percent: float = Field(ge=0, le=100)
    memory_bandwidth_gbps: float = Field(ge=0)
    memory_errors_count: int = Field(ge=0)
    power_efficiency_rating: float = Field(ge=0, le=1)
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    @validator('memory_used_gb')
    def validate_memory_usage(cls, v, values):
        """Validate memory usage against total memory."""
        if 'memory_total_gb' in values and v > values['memory_total_gb']:
            raise ValueError('Used memory cannot exceed total memory')
        return v

    @validator('temperature_celsius')
    def validate_temperature(cls, v):
        """Validate temperature is within safe operating range."""
        if v > 85:
            raise ValueError('GPU temperature exceeds safe operating threshold')
        return v

    def to_orm(self) -> Base:
        """Convert Pydantic model to ORM model with validation."""
        return {
            'id': self.id,
            'gpu_id': self.gpu_id,
            'temperature_celsius': self.temperature_celsius,
            'power_usage_watts': self.power_usage_watts,
            'memory_used_gb': self.memory_used_gb,
            'memory_total_gb': self.memory_total_gb,
            'utilization_percent': self.utilization_percent,
            'memory_bandwidth_gbps': self.memory_bandwidth_gbps,
            'memory_errors_count': self.memory_errors_count,
            'power_efficiency_rating': self.power_efficiency_rating,
            'timestamp': self.timestamp,
            'created_at': self.created_at
        }

class CarbonMetricsBase(BaseModel):
    """Enhanced Pydantic model for carbon capture and environmental metrics."""
    id: UUID = Field(default_factory=uuid4)
    co2_captured_kg: float = Field(ge=0)
    co2_capture_rate_kgh: float = Field(ge=0)
    power_usage_effectiveness: float = Field(ge=1.0, le=2.0)
    carbon_usage_effectiveness: float = Field(ge=0, le=2.0)
    water_usage_effectiveness: float = Field(ge=0, le=2.0)
    total_power_consumption_kwh: float = Field(ge=0)
    cooling_power_consumption_kwh: float = Field(ge=0)
    water_consumption_liters: float = Field(ge=0)
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    @validator('co2_capture_rate_kgh')
    def validate_capture_rate(cls, v, values):
        """Validate CO2 capture rate against theoretical maximum."""
        theoretical_max = values.get('total_power_consumption_kwh', 0) * 0.5  # 50% max capture efficiency
        if v > theoretical_max and theoretical_max > 0:
            raise ValueError('CO2 capture rate exceeds theoretical maximum')
        return v

    @root_validator
    def validate_efficiency_metrics(cls, values):
        """Validate relationships between efficiency metrics."""
        pue = values.get('power_usage_effectiveness', 0)
        cue = values.get('carbon_usage_effectiveness', 0)
        wue = values.get('water_usage_effectiveness', 0)

        if pue < 1.0:
            raise ValueError('PUE cannot be less than 1.0')
        if cue > pue:
            raise ValueError('CUE cannot exceed PUE')
        if any(x > 2.0 for x in [pue, cue, wue]):
            raise ValueError('Efficiency metrics exceed expected maximum')
        return values

    def to_orm(self) -> Base:
        """Convert Pydantic model to ORM model with environmental validation."""
        return {
            'id': self.id,
            'co2_captured_kg': self.co2_captured_kg,
            'co2_capture_rate_kgh': self.co2_capture_rate_kgh,
            'power_usage_effectiveness': self.power_usage_effectiveness,
            'carbon_usage_effectiveness': self.carbon_usage_effectiveness,
            'water_usage_effectiveness': self.water_usage_effectiveness,
            'total_power_consumption_kwh': self.total_power_consumption_kwh,
            'cooling_power_consumption_kwh': self.cooling_power_consumption_kwh,
            'water_consumption_liters': self.water_consumption_liters,
            'timestamp': self.timestamp,
            'created_at': self.created_at
        }

class SystemMetricsBase(BaseModel):
    """Enhanced Pydantic model for system metrics with comprehensive monitoring."""
    id: UUID = Field(default_factory=uuid4)
    server_id: str
    cpu_usage_percent: float = Field(ge=0, le=100)
    memory_usage_percent: float = Field(ge=0, le=100)
    network_bandwidth_mbps: float = Field(ge=0)
    network_latency_ms: float = Field(ge=0)
    active_gpu_count: int = Field(ge=0)
    total_gpu_count: int = Field(ge=0)
    storage_usage_percent: float = Field(ge=0, le=100)
    iops_read: float = Field(ge=0)
    iops_write: float = Field(ge=0)
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    @validator('active_gpu_count')
    def validate_gpu_count(cls, v, values):
        """Validate active GPU count against total GPUs."""
        if 'total_gpu_count' in values and v > values['total_gpu_count']:
            raise ValueError('Active GPU count cannot exceed total GPU count')
        return v

    @root_validator
    def validate_system_metrics(cls, values):
        """Validate system metrics thresholds."""
        if values.get('cpu_usage_percent', 0) > 90:
            raise ValueError('CPU usage exceeds critical threshold')
        if values.get('memory_usage_percent', 0) > 95:
            raise ValueError('Memory usage exceeds critical threshold')
        if values.get('storage_usage_percent', 0) > 90:
            raise ValueError('Storage usage exceeds critical threshold')
        return values

    def to_orm(self) -> Base:
        """Convert Pydantic model to ORM model with system validation."""
        return {
            'id': self.id,
            'server_id': self.server_id,
            'cpu_usage_percent': self.cpu_usage_percent,
            'memory_usage_percent': self.memory_usage_percent,
            'network_bandwidth_mbps': self.network_bandwidth_mbps,
            'network_latency_ms': self.network_latency_ms,
            'active_gpu_count': self.active_gpu_count,
            'total_gpu_count': self.total_gpu_count,
            'storage_usage_percent': self.storage_usage_percent,
            'iops_read': self.iops_read,
            'iops_write': self.iops_write,
            'timestamp': self.timestamp,
            'created_at': self.created_at
        }

class MetricsResponse(BaseModel):
    """Enhanced response model for combined metrics data with aggregation."""
    gpu_metrics: List[GPUMetricsBase]
    carbon_metrics: CarbonMetricsBase
    system_metrics: SystemMetricsBase
    aggregated_metrics: Dict
    timestamp: datetime = Field(default_factory=datetime.utcnow)

    @root_validator
    def calculate_aggregated_metrics(cls, values):
        """Calculate aggregated metrics from individual components."""
        gpu_metrics = values.get('gpu_metrics', [])
        carbon_metrics = values.get('carbon_metrics')
        system_metrics = values.get('system_metrics')

        if not all([gpu_metrics, carbon_metrics, system_metrics]):
            raise ValueError('Missing required metrics components')

        values['aggregated_metrics'] = {
            'total_power_consumption': sum(gm.power_usage_watts for gm in gpu_metrics) / 1000,  # Convert to kW
            'average_gpu_utilization': sum(gm.utilization_percent for gm in gpu_metrics) / len(gpu_metrics),
            'total_co2_captured': carbon_metrics.co2_captured_kg,
            'overall_efficiency': carbon_metrics.power_usage_effectiveness,
            'system_health': 'critical' if system_metrics.cpu_usage_percent > 90 else 'healthy'
        }
        return values

    def to_dict(self) -> Dict:
        """Convert response model to dictionary with enhanced formatting."""
        return {
            'gpu_metrics': [gm.dict() for gm in self.gpu_metrics],
            'carbon_metrics': self.carbon_metrics.dict(),
            'system_metrics': self.system_metrics.dict(),
            'aggregated_metrics': self.aggregated_metrics,
            'timestamp': self.timestamp.isoformat()
        }