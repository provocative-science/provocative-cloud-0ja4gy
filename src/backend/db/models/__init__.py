"""
SQLAlchemy database models initialization module for Provocative Cloud platform.
Version: 1.0.0
Author: Provocative Cloud Development Team

This module provides centralized access to all database models with proper initialization
order management and relationship tracking. It ensures type safety and handles circular
dependencies through careful import ordering.
"""

# SQLAlchemy v2.0.0+
from sqlalchemy.orm import declarative_base
from typing import List, Dict, Any

# User and authentication models
from .user import User

# Infrastructure models
from .server import Server
from .gpu import GPU

# Resource management models
from .reservation import Reservation

# Financial models
from .billing import Transaction, Invoice, Payment, GPUPricing

# Metrics and monitoring models
from .metrics import GPUMetrics, CarbonMetrics, SystemMetrics

# Define all models that should be publicly available
__all__ = [
    # Core models
    "User",
    "Server",
    "GPU",
    "Reservation",
    
    # Billing models
    "Transaction",
    "Invoice",
    "Payment",
    "GPUPricing",
    
    # Metrics models
    "GPUMetrics",
    "CarbonMetrics",
    "SystemMetrics"
]

# Module metadata
__version__ = "1.0.0"
__author__ = "Provocative Cloud Development Team"

# Model dependency order for initialization
MODEL_INITIALIZATION_ORDER = [
    User,           # Base user model with no dependencies
    Server,         # Server infrastructure
    GPU,           # GPU resources (depends on Server)
    Reservation,    # Reservations (depends on User and GPU)
    Transaction,    # Financial transactions (depends on User and Reservation)
    Invoice,        # Billing documents (depends on User and Transaction)
    GPUMetrics,     # Performance metrics (depends on GPU)
    CarbonMetrics,  # Environmental metrics (independent)
    SystemMetrics   # System metrics (depends on Server)
]

def get_model_metadata() -> Dict[str, Any]:
    """
    Retrieve metadata about all registered models including relationships
    and dependencies.
    
    Returns:
        Dict[str, Any]: Dictionary containing model metadata and relationships
    """
    metadata = {}
    
    for model in MODEL_INITIALIZATION_ORDER:
        metadata[model.__name__] = {
            'table_name': model.__tablename__,
            'relationships': [
                rel.key for rel in model.__mapper__.relationships
            ],
            'primary_key': [
                key.name for key in model.__table__.primary_key
            ],
            'foreign_keys': [
                col.name for col in model.__table__.columns 
                if col.foreign_keys
            ]
        }
    
    return metadata

def validate_model_relationships() -> bool:
    """
    Validate all model relationships and foreign key constraints.
    
    Returns:
        bool: True if all relationships are valid
        
    Raises:
        ValueError: If any relationship validation fails
    """
    for model in MODEL_INITIALIZATION_ORDER:
        # Check all relationships are properly configured
        for relationship in model.__mapper__.relationships:
            if not relationship.local_remote_pairs:
                raise ValueError(
                    f"Invalid relationship configuration in {model.__name__}: "
                    f"{relationship.key} has no local-remote column pairs"
                )
    
    return True

def get_model_by_name(model_name: str) -> Any:
    """
    Retrieve a model class by its name.
    
    Args:
        model_name (str): Name of the model to retrieve
        
    Returns:
        Any: The requested model class
        
    Raises:
        ValueError: If model name is not found
    """
    for model in MODEL_INITIALIZATION_ORDER:
        if model.__name__ == model_name:
            return model
    raise ValueError(f"Model not found: {model_name}")

# Perform initial validation of model relationships
validate_model_relationships()