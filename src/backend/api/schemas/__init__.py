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

def validate_schema_compatibility(cls: Type[BaseModel]) -> bool:
    """
    Validates schema compatibility for GPU-related models and ensures
    proper validation methods exist for metrics-related schemas.
    """
    # Skip validation for non-GPU or non-metrics models
    if not any(keyword in cls.__name__ for keyword in ["GPU", "Metrics", "System"]):
        return True

    # Define required validation methods for metrics-related models
    required_validators = {
        "validate_metrics",
        "validate_environmental_metrics",
        "validate_schema"
    }

    # Check for missing validators
    missing_validators = {method for method in required_validators if not hasattr(cls, method)}

    if missing_validators:
        raise ValueError(
            f"Missing required validators in {cls.__name__}: {missing_validators}"
        )

    # Verify environmental metrics integration for GPU-related schemas
    if "GPU" in cls.__name__ and not hasattr(cls, "environmental_metrics"):
        raise ValueError(
            f"Missing environmental metrics integration in {cls.__name__}"
        )

    return True

def validate_schema_compatibility(cls: Type[BaseModel]) -> bool:
    """
    Validates schema compatibility and ensures proper validation methods exist
    for metric-related schemas. Non-metric schemas are exempt from this check.
    """
    # Skip validation for non-metrics models
    if "Metrics" not in cls.__name__:
        return True

    # Define required validation methods for metrics-related models
    required_validators = {
        "validate_metrics",
        "validate_environmental_metrics",
        "validate_schema"
    }

    # Check for missing validators
    missing_validators = {method for method in required_validators if not hasattr(cls, method)}

    if missing_validators:
        raise ValueError(
            f"Missing required validators in {cls.__name__}: {missing_validators}"
        )

    return True


# Initialize schema validation on import
for schema in __all__:
    if isinstance(schema, str):
        cls = globals().get(schema)
        if cls and issubclass(cls, BaseModel):
            validate_schema_compatibility(cls)
