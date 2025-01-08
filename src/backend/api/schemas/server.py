"""
Pydantic schema models for server resource management in the Provocative Cloud platform.
Defines data models for server specifications, status, operations, and environmental metrics.
"""

from datetime import datetime
from typing import Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, Field, validator  # version: 2.0+
from pydantic.networks import IPvAnyAddress  # version: 2.0+

from api.schemas.gpu import GPUBase
from api.schemas.metrics import SystemMetricsBase

# Global constants for server validation
SERVER_STATUS_CHOICES = ["online", "offline", "maintenance", "error", "carbon_capture_active"]
MIN_GPUS_PER_SERVER = 1
MAX_GPUS_PER_SERVER = 8
MIN_PUE_THRESHOLD = 1.1
MAX_PUE_THRESHOLD = 1.5

class ServerBase(BaseModel):
    """Base schema for server resource information with environmental metrics."""
    id: Optional[UUID] = Field(default=None)
    hostname: str = Field(..., description="Server hostname")
    ip_address: IPvAnyAddress = Field(..., description="Server IP address")
    specs: Dict = Field(..., description="Server hardware specifications")
    maintenance_mode: bool = Field(default=False, description="Server maintenance status")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    pue_ratio: float = Field(
        default=1.2,
        ge=MIN_PUE_THRESHOLD,
        le=MAX_PUE_THRESHOLD,
        description="Power Usage Effectiveness ratio"
    )
    carbon_capture_rate: float = Field(
        default=0.5,
        ge=0.0,
        le=1.0,
        description="CO2 capture rate in kg/hour"
    )
    water_usage_effectiveness: float = Field(
        default=1.0,
        ge=0.0,
        le=2.0,
        description="Water Usage Effectiveness ratio"
    )

    @validator('hostname')
    def validate_hostname(cls, value: str) -> str:
        """Validates server hostname format."""
        if not value or len(value) > 255:
            raise ValueError("Invalid hostname length")
        
        if not value.islower():
            value = value.lower()
            
        if not value.startswith(('gpu-', 'compute-')):
            raise ValueError("Hostname must start with 'gpu-' or 'compute-'")
            
        return value

    @validator('specs')
    def validate_specs(cls, value: Dict) -> Dict:
        """Validates server specifications including environmental metrics."""
        required_keys = {
            'cpu_model', 'cpu_cores', 'memory_gb', 'storage_gb',
            'cooling_system', 'carbon_capture_unit'
        }
        
        if not all(key in value for key in required_keys):
            raise ValueError(f"Missing required specifications: {required_keys - value.keys()}")
            
        # Validate CPU specifications
        if not isinstance(value['cpu_cores'], int) or value['cpu_cores'] < 1:
            raise ValueError("Invalid CPU cores specification")
            
        # Validate memory specifications
        if not isinstance(value['memory_gb'], int) or value['memory_gb'] < 32:
            raise ValueError("Memory must be at least 32GB")
            
        # Validate storage specifications
        if not isinstance(value['storage_gb'], int) or value['storage_gb'] < 100:
            raise ValueError("Storage must be at least 100GB")
            
        # Validate cooling system specifications
        if not isinstance(value['cooling_system'], dict):
            raise ValueError("Invalid cooling system specification")
            
        cooling_required_keys = {'type', 'capacity', 'efficiency'}
        if not all(key in value['cooling_system'] for key in cooling_required_keys):
            raise ValueError(f"Missing cooling system specifications: {cooling_required_keys}")
            
        # Validate carbon capture specifications
        if not isinstance(value['carbon_capture_unit'], dict):
            raise ValueError("Invalid carbon capture unit specification")
            
        capture_required_keys = {'capacity', 'efficiency', 'maintenance_schedule'}
        if not all(key in value['carbon_capture_unit'] for key in capture_required_keys):
            raise ValueError(f"Missing carbon capture specifications: {capture_required_keys}")
            
        return value

    @validator('pue_ratio', 'carbon_capture_rate', 'water_usage_effectiveness')
    def validate_environmental_metrics(cls, value: float, field: Field) -> float:
        """Validates server environmental impact metrics."""
        if field.name == 'pue_ratio':
            if not MIN_PUE_THRESHOLD <= value <= MAX_PUE_THRESHOLD:
                raise ValueError(f"PUE ratio must be between {MIN_PUE_THRESHOLD} and {MAX_PUE_THRESHOLD}")
                
        elif field.name == 'carbon_capture_rate':
            if not 0 <= value <= 1:
                raise ValueError("Carbon capture rate must be between 0 and 1")
                
        elif field.name == 'water_usage_effectiveness':
            if not 0 <= value <= 2:
                raise ValueError("Water usage effectiveness must be between 0 and 2")
                
        return value

class ServerCreate(BaseModel):
    """Schema for creating new server resources with environmental specifications."""
    hostname: str
    ip_address: IPvAnyAddress
    specs: Dict
    environmental_specs: Dict = Field(
        ...,
        description="Environmental specifications including cooling and carbon capture"
    )

class ServerUpdate(BaseModel):
    """Schema for updating server resource information and environmental metrics."""
    specs: Optional[Dict] = None
    maintenance_mode: Optional[bool] = None
    environmental_metrics: Optional[Dict] = Field(
        default=None,
        description="Updated environmental metrics"
    )

class ServerResponse(BaseModel):
    """Schema for server API responses including environmental data."""
    server: ServerBase
    gpus: List[GPUBase]
    metrics: SystemMetricsBase
    status: str = Field(default="online")

    @validator('status')
    def validate_status(cls, value: str) -> str:
        """Validates server status value including carbon capture state."""
        if value not in SERVER_STATUS_CHOICES:
            raise ValueError(f"Invalid status. Must be one of: {', '.join(SERVER_STATUS_CHOICES)}")
            
        if value == "carbon_capture_active":
            # Additional validation for carbon capture status could be added here
            pass
            
        return value