"""
Utility functions for data validation across the Provocative Cloud platform,
including validators for GPU specifications, billing data, metrics, environmental impact data,
and authentication inputs.
"""

import re
from datetime import datetime
from decimal import Decimal
from uuid import UUID

from api.schemas.gpu import GPUBase
from api.schemas.billing import PaymentBase
from api.schemas.metrics import GPUMetricsBase

# Email validation regex
EMAIL_REGEX = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'

# GPU model validation regex
GPU_MODEL_REGEX = r'^NVIDIA\s[A-Z0-9]+$'

# Validation ranges
TEMPERATURE_RANGE = {"min": 0, "max": 100}
VRAM_RANGE = {"min": 16, "max": 80}
PRICE_RANGE = {"min": "0.01", "max": "100.00"}
POWER_EFFICIENCY_RANGE = {"min": 0.1, "max": 1.0}
COOLING_EFFICIENCY_RANGE = {"min": 0.6, "max": 1.0}
CARBON_CAPTURE_RATE = {"min": "0.1", "max": "10.0"}
PUE_RANGE = {"min": 1.0, "max": 1.5}
CUE_RANGE = {"min": 0.0, "max": 1.0}
WUE_RANGE = {"min": 0.0, "max": 2.0}

def validate_email(email: str) -> bool:
    """
    Validates email format using regex pattern.
    
    Args:
        email: Email address to validate
        
    Returns:
        bool: True if email format is valid
    """
    if not email:
        return False
    return bool(re.match(EMAIL_REGEX, email))

def validate_gpu_model(model: str) -> bool:
    """
    Validates GPU model name format.
    
    Args:
        model: GPU model name to validate
        
    Returns:
        bool: True if model format is valid
    """
    if not model:
        return False
    return bool(re.match(GPU_MODEL_REGEX, model))

def validate_temperature(temperature: float) -> bool:
    """
    Validates GPU temperature is within safe operating range.
    
    Args:
        temperature: Temperature in Celsius
        
    Returns:
        bool: True if temperature is within acceptable range
    """
    return TEMPERATURE_RANGE["min"] <= temperature <= TEMPERATURE_RANGE["max"]

def validate_vram(vram_gb: int) -> bool:
    """
    Validates GPU VRAM capacity.
    
    Args:
        vram_gb: VRAM capacity in GB
        
    Returns:
        bool: True if VRAM capacity is valid
    """
    return VRAM_RANGE["min"] <= vram_gb <= VRAM_RANGE["max"]

def validate_price(price: Decimal) -> bool:
    """
    Validates GPU rental price.
    
    Args:
        price: Price per hour
        
    Returns:
        bool: True if price is within acceptable range
    """
    min_price = Decimal(PRICE_RANGE["min"])
    max_price = Decimal(PRICE_RANGE["max"])
    return min_price <= price <= max_price

def validate_power_efficiency(efficiency_ratio: float) -> bool:
    """
    Validates GPU power efficiency ratio.
    
    Args:
        efficiency_ratio: Power efficiency ratio (0-1)
        
    Returns:
        bool: True if efficiency is within acceptable range
    """
    return POWER_EFFICIENCY_RANGE["min"] <= efficiency_ratio <= POWER_EFFICIENCY_RANGE["max"]

def validate_cooling_efficiency(cooling_efficiency: float) -> bool:
    """
    Validates cooling system efficiency.
    
    Args:
        cooling_efficiency: Cooling efficiency ratio (0-1)
        
    Returns:
        bool: True if cooling efficiency is within acceptable range
    """
    return COOLING_EFFICIENCY_RANGE["min"] <= cooling_efficiency <= COOLING_EFFICIENCY_RANGE["max"]

def validate_carbon_metrics(
    carbon_capture_rate: float,
    power_usage_effectiveness: float,
    carbon_usage_effectiveness: float
) -> bool:
    """
    Validates carbon capture and usage metrics.
    
    Args:
        carbon_capture_rate: CO2 capture rate in kg/h
        power_usage_effectiveness: PUE ratio
        carbon_usage_effectiveness: CUE ratio
        
    Returns:
        bool: True if all metrics are within acceptable ranges
    """
    min_capture = float(CARBON_CAPTURE_RATE["min"])
    max_capture = float(CARBON_CAPTURE_RATE["max"])
    
    capture_valid = min_capture <= carbon_capture_rate <= max_capture
    pue_valid = PUE_RANGE["min"] <= power_usage_effectiveness <= PUE_RANGE["max"]
    cue_valid = CUE_RANGE["min"] <= carbon_usage_effectiveness <= CUE_RANGE["max"]
    
    return all([capture_valid, pue_valid, cue_valid])

def validate_water_usage(water_usage_effectiveness: float) -> bool:
    """
    Validates water usage effectiveness for cooling system.
    
    Args:
        water_usage_effectiveness: WUE ratio
        
    Returns:
        bool: True if WUE is within acceptable range
    """
    return WUE_RANGE["min"] <= water_usage_effectiveness <= WUE_RANGE["max"]

def validate_gpu_metrics(metrics: dict) -> bool:
    """
    Validates comprehensive GPU metrics including environmental data.
    
    Args:
        metrics: Dictionary containing GPU metrics
        
    Returns:
        bool: True if all metrics are valid
    """
    try:
        # Validate basic metrics
        if not validate_temperature(metrics.get('temperature', 0)):
            return False
            
        if not validate_power_efficiency(metrics.get('power_efficiency', 0)):
            return False
            
        # Validate environmental metrics
        env_metrics = metrics.get('environmental', {})
        if not validate_cooling_efficiency(env_metrics.get('cooling_efficiency', 0)):
            return False
            
        if not validate_carbon_metrics(
            env_metrics.get('carbon_capture_rate', 0),
            env_metrics.get('power_usage_effectiveness', 1.0),
            env_metrics.get('carbon_usage_effectiveness', 0)
        ):
            return False
            
        return True
    except (KeyError, TypeError, ValueError):
        return False

def validate_billing_data(payment_data: dict) -> bool:
    """
    Validates billing and payment data.
    
    Args:
        payment_data: Dictionary containing payment information
        
    Returns:
        bool: True if payment data is valid
    """
    try:
        # Validate amount
        if not validate_price(Decimal(str(payment_data.get('amount', 0)))):
            return False
            
        # Validate currency
        if payment_data.get('currency', '').upper() not in ['USD', 'EUR', 'GBP']:
            return False
            
        # Validate IDs
        try:
            UUID(payment_data.get('user_id', ''))
            UUID(payment_data.get('reservation_id', ''))
        except ValueError:
            return False
            
        return True
    except (KeyError, TypeError, ValueError, decimal.InvalidOperation):
        return False