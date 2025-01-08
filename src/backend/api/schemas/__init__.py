"""
Schema initialization module for the Provocative Cloud platform.
Provides centralized schema management, validation, and compatibility verification
with integrated environmental metrics tracking.

Version: 1.0.0
"""

from pydantic import BaseModel, validator
from typing import Type

# Authentication schemas
from .auth import (
    TokenResponse, GoogleAuthRequest, GoogleAuthResponse,
    JWTPayload, TokenRefreshRequest, TokenVerifyRequest
)

# Billing schemas
from .billing import (
    PaymentBase, PaymentCreate, TransactionBase, PricingBase
)

# GPU management schemas
from .gpu import (
    GPUBase, GPUCreate, GPUUpdate, GPUMetrics, GPUResponse
)

# Metrics schemas including environmental tracking
from .metrics import (
    GPUMetricsBase, CarbonMetricsBase, SystemMetricsBase, MetricsResponse
)

# Schema version for compatibility tracking
SCHEMA_VERSION = "1.0.0"

# Export all schema models
__all__ = [
    # Authentication schemas
    "TokenResponse",
    "GoogleAuthRequest", 
    "GoogleAuthResponse",
    "JWTPayload",
    "TokenRefreshRequest",
    "TokenVerifyRequest",
    
    # Billing schemas
    "PaymentBase",
    "PaymentCreate",
    "TransactionBase",
    "PricingBase",
    
    # GPU management schemas
    "GPUBase",
    "GPUCreate",
    "GPUUpdate",
    "GPUMetrics",
    "GPUResponse",
    
    # Metrics schemas
    "GPUMetricsBase",
    "CarbonMetricsBase",
    "SystemMetricsBase",
    "MetricsResponse"
]

@validator("*", pre=True)
def validate_schema_compatibility(cls: Type[BaseModel]) -> bool:
    """
    Validates schema compatibility and ensures proper validation methods exist.
    
    Args:
        cls: Pydantic model class to validate
        
    Returns:
        bool: True if schema is compatible, False otherwise
        
    Raises:
        ValueError: If schema validation fails
    """
    # Verify schema version compatibility
    if not hasattr(cls, "__version__"):
        setattr(cls, "__version__", SCHEMA_VERSION)
    elif cls.__version__ != SCHEMA_VERSION:
        raise ValueError(
            f"Schema version mismatch. Expected {SCHEMA_VERSION}, got {cls.__version__}"
        )
    
    # Verify required validation methods
    required_validators = {
        "validate_metrics",
        "validate_environmental_metrics",
        "validate_schema"
    }
    
    missing_validators = required_validators - set(cls.__validators__.keys())
    if missing_validators and any(base == BaseModel for base in cls.__bases__):
        raise ValueError(
            f"Missing required validators in {cls.__name__}: {missing_validators}"
        )
    
    # Verify environmental metrics integration for GPU-related schemas
    if "GPU" in cls.__name__ and not hasattr(cls, "environmental_metrics"):
        raise ValueError(
            f"Missing environmental metrics integration in {cls.__name__}"
        )
    
    return True

# Initialize schema validation on import
for schema in __all__:
    if isinstance(schema, str):
        cls = globals().get(schema)
        if cls and issubclass(cls, BaseModel):
            validate_schema_compatibility(cls)