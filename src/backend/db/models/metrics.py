# SQLAlchemy v2.0.0+
from sqlalchemy import Column, Integer, Float, String, DateTime, ForeignKey, UUID, Index
# SQLAlchemy ORM v2.0.0+
from sqlalchemy.orm import relationship
# SQLAlchemy Utils v0.41.0+
from sqlalchemy_utils import TimestampMixin, ValidationMixin
# SQLAlchemy TimescaleDB v0.5.0+
from sqlalchemy_timescaledb import TimescaleDBMixin
from datetime import datetime
import uuid
from typing import Dict, Optional

from db.base import Base

class GPUMetrics(Base, TimescaleDBMixin, ValidationMixin):
    """
    Model for storing GPU performance metrics with TimescaleDB optimization.
    Tracks temperature, power usage, memory utilization, and performance metrics.
    """
    __tablename__ = 'gpu_metrics'
    
    id = Column(UUID, primary_key=True, default=uuid.uuid4)
    gpu_id = Column(UUID, ForeignKey('gpus.id'), nullable=False)
    temperature_celsius = Column(Float, nullable=False)
    power_usage_watts = Column(Integer, nullable=False)
    memory_used_gb = Column(Float, nullable=False)
    memory_total_gb = Column(Float, nullable=False)
    utilization_percent = Column(Float, nullable=False)
    timestamp = Column(DateTime, nullable=False, default=datetime.utcnow)
    thresholds = Column(String, nullable=True)  # JSON string of threshold values
    is_anomaly = Column(Integer, default=0)

    # TimescaleDB hypertable configuration
    __timescaledb_config__ = {
        'time_column': 'timestamp',
        'partition_interval': '1 day'
    }

    def __init__(self, gpu_id: UUID, temperature_celsius: float, power_usage_watts: int,
                 memory_used_gb: float, memory_total_gb: float, utilization_percent: float,
                 thresholds: Optional[Dict] = None) -> None:
        """Initialize GPU metrics record with validation."""
        super().__init__()
        self.gpu_id = gpu_id
        self.temperature_celsius = temperature_celsius
        self.power_usage_watts = power_usage_watts
        self.memory_used_gb = memory_used_gb
        self.memory_total_gb = memory_total_gb
        self.utilization_percent = utilization_percent
        self.thresholds = str(thresholds) if thresholds else None
        self.timestamp = datetime.utcnow()
        self.validate_metrics()
        self.is_anomaly = 1 if self.detect_anomalies() else 0

    def validate_metrics(self) -> bool:
        """Validate GPU metrics against defined thresholds."""
        if not 0 <= self.temperature_celsius <= 120:
            raise ValueError("Temperature must be between 0-120°C")
        
        if not 0 <= self.power_usage_watts <= 1000:
            raise ValueError("Power usage must be between 0-1000 watts")
            
        if not 0 <= self.memory_used_gb <= self.memory_total_gb:
            raise ValueError("Memory used cannot exceed total memory")
            
        if not 0 <= self.utilization_percent <= 100:
            raise ValueError("Utilization must be between 0-100%")
        
        return True

    def detect_anomalies(self) -> bool:
        """Detect anomalies in GPU metrics based on thresholds."""
        if not self.thresholds:
            return False

        thresholds = eval(self.thresholds)  # Convert string back to dict
        return any([
            self.temperature_celsius > thresholds.get('max_temp', 85),
            self.power_usage_watts > thresholds.get('max_power', 800),
            self.utilization_percent < thresholds.get('min_util', 10),
            (self.memory_used_gb / self.memory_total_gb) > thresholds.get('max_mem_ratio', 0.95)
        ])

class CarbonMetrics(Base, TimescaleDBMixin, ValidationMixin):
    """
    Model for storing carbon capture and environmental metrics with time-series optimization.
    Tracks CO2 capture rates and efficiency metrics.
    """
    __tablename__ = 'carbon_metrics'
    
    id = Column(UUID, primary_key=True, default=uuid.uuid4)
    co2_captured_kg = Column(Float, nullable=False)
    power_usage_effectiveness = Column(Float, nullable=False)
    carbon_usage_effectiveness = Column(Float, nullable=False)
    water_usage_effectiveness = Column(Float, nullable=False)
    timestamp = Column(DateTime, nullable=False, default=datetime.utcnow)
    efficiency_targets = Column(String, nullable=True)  # JSON string of target values
    meets_targets = Column(Integer, default=1)

    # TimescaleDB hypertable configuration
    __timescaledb_config__ = {
        'time_column': 'timestamp',
        'partition_interval': '1 hour'
    }

    def __init__(self, co2_captured_kg: float, power_usage_effectiveness: float,
                 carbon_usage_effectiveness: float, water_usage_effectiveness: float,
                 efficiency_targets: Optional[Dict] = None) -> None:
        """Initialize carbon metrics record with validation."""
        super().__init__()
        self.co2_captured_kg = co2_captured_kg
        self.power_usage_effectiveness = power_usage_effectiveness
        self.carbon_usage_effectiveness = carbon_usage_effectiveness
        self.water_usage_effectiveness = water_usage_effectiveness
        self.efficiency_targets = str(efficiency_targets) if efficiency_targets else None
        self.timestamp = datetime.utcnow()
        self.validate_metrics()
        self.meets_targets = self._check_targets()

    def _check_targets(self) -> int:
        """Check if current metrics meet efficiency targets."""
        if not self.efficiency_targets:
            return 1
        
        targets = eval(self.efficiency_targets)
        return 1 if all([
            self.power_usage_effectiveness <= targets.get('max_pue', 1.5),
            self.carbon_usage_effectiveness <= targets.get('max_cue', 1.0),
            self.water_usage_effectiveness <= targets.get('max_wue', 1.8)
        ]) else 0

class SystemMetrics(Base, TimescaleDBMixin, ValidationMixin):
    """
    Model for storing general system metrics with time-series optimization.
    Tracks server performance and resource utilization.
    """
    __tablename__ = 'system_metrics'
    
    id = Column(UUID, primary_key=True, default=uuid.uuid4)
    server_id = Column(String, nullable=False)
    cpu_usage_percent = Column(Float, nullable=False)
    memory_usage_percent = Column(Float, nullable=False)
    network_bandwidth_mbps = Column(Float, nullable=False)
    active_gpu_count = Column(Integer, nullable=False)
    timestamp = Column(DateTime, nullable=False, default=datetime.utcnow)
    system_thresholds = Column(String, nullable=True)  # JSON string of threshold values
    requires_attention = Column(Integer, default=0)

    # TimescaleDB hypertable configuration
    __timescaledb_config__ = {
        'time_column': 'timestamp',
        'partition_interval': '5 minutes'
    }

    # Create indexes for common query patterns
    __table_args__ = (
        Index('ix_system_metrics_server_timestamp', 'server_id', 'timestamp'),
        Index('ix_system_metrics_attention', 'requires_attention'),
    )

    def __init__(self, server_id: str, cpu_usage_percent: float,
                 memory_usage_percent: float, network_bandwidth_mbps: float,
                 active_gpu_count: int, system_thresholds: Optional[Dict] = None) -> None:
        """Initialize system metrics record with validation."""
        super().__init__()
        self.server_id = server_id
        self.cpu_usage_percent = cpu_usage_percent
        self.memory_usage_percent = memory_usage_percent
        self.network_bandwidth_mbps = network_bandwidth_mbps
        self.active_gpu_count = active_gpu_count
        self.system_thresholds = str(system_thresholds) if system_thresholds else None
        self.timestamp = datetime.utcnow()
        self.validate_metrics()
        self.requires_attention = self._check_system_health()

    def _check_system_health(self) -> int:
        """Check if system metrics indicate attention is required."""
        if not self.system_thresholds:
            return 0
            
        thresholds = eval(self.system_thresholds)
        return 1 if any([
            self.cpu_usage_percent > thresholds.get('max_cpu', 90),
            self.memory_usage_percent > thresholds.get('max_memory', 90),
            self.network_bandwidth_mbps > thresholds.get('max_bandwidth', 9500)
        ]) else 0